jest.mock("@streamparser/json", () => ({ JSONParser: jest.fn() }));
jest.mock("webextension-polyfill", () => ({}));

function loadStorageModule({ isExt = false, isGm = false, browser } = {}) {
  let storageModule;
  jest.isolateModules(() => {
    jest.doMock("./client", () => ({ isExt, isGm }));
    jest.doMock("./browser", () => ({ browser }));
    storageModule = require("./storage");
  });
  jest.dontMock("./client");
  jest.dontMock("./browser");
  return storageModule;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("storage subscriptions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.KISS_GM;
    delete globalThis.GM;
    delete globalThis.GM_addValueChangeListener;
    delete globalThis.GM_removeValueChangeListener;
  });

  afterEach(() => {
    delete window.KISS_GM;
    delete globalThis.GM;
    delete globalThis.GM_addValueChangeListener;
    delete globalThis.GM_removeValueChangeListener;
  });

  test("notifies same-page web subscribers after local writes", async () => {
    const { storage } = loadStorageModule();
    const listener = jest.fn();
    const unsubscribe = storage.subscribeObj("setting", listener);

    await storage.setObj("setting", { enabled: true });
    expect(listener).toHaveBeenCalledWith({ enabled: true });

    unsubscribe();
    await storage.setObj("setting", { enabled: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("forwards cross-document web storage events", () => {
    const { storage } = loadStorageModule();
    const listener = jest.fn();
    const unsubscribe = storage.subscribeObj("setting", listener);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "setting",
        newValue: JSON.stringify({ enabled: false }),
        storageArea: window.localStorage,
      })
    );

    expect(listener).toHaveBeenCalledWith({ enabled: false });
    unsubscribe();
  });

  test("subscribes to extension local storage changes", () => {
    let handleChanged;
    const removeListener = jest.fn();
    const browser = {
      storage: {
        onChanged: {
          addListener: jest.fn((listener) => {
            handleChanged = listener;
          }),
          removeListener,
        },
      },
    };
    const { storage } = loadStorageModule({ isExt: true, browser });
    const listener = jest.fn();
    const unsubscribe = storage.subscribeObj("setting", listener);

    handleChanged(
      {
        setting: {
          newValue: JSON.stringify({ enabled: false }),
        },
      },
      "local"
    );
    handleChanged(
      {
        setting: {
          newValue: JSON.stringify({ enabled: true }),
        },
      },
      "sync"
    );

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ enabled: false });
    unsubscribe();
    expect(removeListener).toHaveBeenCalledWith(handleChanged);
  });

  test("delivers same-context extension writes only once", async () => {
    let handleChanged;
    const browser = {
      storage: {
        local: {
          set: jest.fn(async (values) => {
            handleChanged(
              Object.fromEntries(
                Object.entries(values).map(([key, newValue]) => [
                  key,
                  { newValue },
                ])
              ),
              "local"
            );
          }),
          remove: jest.fn(async (keys) => {
            handleChanged(
              Object.fromEntries(keys.map((key) => [key, { newValue: null }])),
              "local"
            );
          }),
        },
        onChanged: {
          addListener: jest.fn((listener) => {
            handleChanged = listener;
          }),
          removeListener: jest.fn(),
        },
      },
    };
    const { storage } = loadStorageModule({ isExt: true, browser });
    const listener = jest.fn();
    const unsubscribe = storage.subscribeObj("setting", listener);

    await storage.setObj("setting", { enabled: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith({ enabled: true });

    await storage.del("setting");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(null);

    unsubscribe();
    unsubscribe();
    expect(browser.storage.onChanged.removeListener).toHaveBeenCalledTimes(1);
  });

  test("falls back to local delivery without extension onChanged", async () => {
    const browser = {
      storage: {
        local: {
          set: jest.fn(async () => {}),
        },
      },
    };
    const { storage } = loadStorageModule({ isExt: true, browser });
    const listener = jest.fn();
    const unsubscribe = storage.subscribeObj("setting", listener);

    await storage.setObj("setting", { enabled: true });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ enabled: true });
    unsubscribe();
  });

  test("does not throw when extension listener cleanup is invalidated", () => {
    const browser = {
      storage: {
        onChanged: {
          addListener: jest.fn(),
          removeListener: jest.fn(() => {
            throw new Error("Extension context invalidated");
          }),
        },
      },
    };
    const { storage } = loadStorageModule({ isExt: true, browser });
    const unsubscribe = storage.subscribe("setting", jest.fn());

    expect(unsubscribe).not.toThrow();
  });

  test("subscribes through modern GM value change APIs", async () => {
    let handleValueChange;
    const removeValueChangeListener = jest.fn();
    globalThis.GM = {
      addValueChangeListener: jest.fn((key, listener) => {
        handleValueChange = listener;
        return 41;
      }),
      removeValueChangeListener,
    };
    const { storage } = loadStorageModule({ isGm: true });
    const listener = jest.fn();
    const unsubscribe = storage.subscribeObj("setting", listener);
    await Promise.resolve();

    handleValueChange(
      "setting",
      JSON.stringify({ enabled: true }),
      JSON.stringify({ enabled: false }),
      true
    );
    expect(listener).toHaveBeenCalledWith({ enabled: false });

    listener.mockClear();
    handleValueChange(
      "setting",
      JSON.stringify({ enabled: false }),
      JSON.stringify({ enabled: true }),
      false
    );
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
    await Promise.resolve();
    expect(removeValueChangeListener).toHaveBeenCalledWith(41);
  });

  test("subscribes through legacy GM value change APIs", async () => {
    let handleValueChange;
    globalThis.GM = {};
    globalThis.GM_addValueChangeListener = jest.fn((key, listener) => {
      handleValueChange = listener;
      return 42;
    });
    globalThis.GM_removeValueChangeListener = jest.fn();
    const { storage } = loadStorageModule({ isGm: true });
    const listener = jest.fn();
    const unsubscribe = storage.subscribeObj("setting", listener);
    await Promise.resolve();

    handleValueChange(
      "setting",
      JSON.stringify({ enabled: true }),
      JSON.stringify({ enabled: false }),
      true
    );
    expect(listener).toHaveBeenCalledWith({ enabled: false });

    unsubscribe();
    await Promise.resolve();
    expect(globalThis.GM_removeValueChangeListener).toHaveBeenCalledWith(42);
  });

  test("uses KISS_GM and cancels a pending listener registration", async () => {
    let handleValueChange;
    let resolveRegistration;
    const registration = new Promise((resolve) => {
      resolveRegistration = resolve;
    });
    window.KISS_GM = {
      addValueChangeListener: jest.fn((_key, listener) => {
        handleValueChange = listener;
        return registration;
      }),
      removeValueChangeListener: jest.fn(async () => {}),
    };
    const { storage } = loadStorageModule({ isGm: true });
    const listener = jest.fn();
    const unsubscribe = storage.subscribeObj("setting", listener);
    await Promise.resolve();

    handleValueChange(
      "setting",
      JSON.stringify({ enabled: true }),
      JSON.stringify({ enabled: false }),
      true
    );
    expect(listener).toHaveBeenCalledWith({ enabled: false });

    listener.mockClear();
    unsubscribe();
    unsubscribe();
    handleValueChange(
      "setting",
      JSON.stringify({ enabled: false }),
      JSON.stringify({ enabled: true }),
      true
    );
    expect(listener).not.toHaveBeenCalled();

    resolveRegistration("bridge-listener-1");
    await registration;
    await flushPromises();
    expect(window.KISS_GM.removeValueChangeListener).toHaveBeenCalledTimes(1);
    expect(window.KISS_GM.removeValueChangeListener).toHaveBeenCalledWith(
      "bridge-listener-1"
    );
  });

  test("captures synchronous GM listener registration failures", async () => {
    window.KISS_GM = {
      addValueChangeListener: jest.fn(() => {
        throw new Error("registration failed");
      }),
      removeValueChangeListener: jest.fn(),
    };
    const { storage } = loadStorageModule({ isGm: true });

    expect(() => storage.subscribeObj("setting", jest.fn())).not.toThrow();
    await flushPromises();
  });
});
