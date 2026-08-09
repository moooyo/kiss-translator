jest.mock("@streamparser/json", () => ({ JSONParser: jest.fn() }));
jest.mock("webextension-polyfill", () => ({}));

function loadStorageModule({ isExt = false, isGm = false, browser } = {}) {
  let storageModule;
  jest.isolateModules(() => {
    jest.doMock("./client", () => ({ isExt, isGm }));
    jest.doMock("./browser", () => ({
      browser,
      isExtensionContextInvalidatedError: (error) =>
        error?.message === "Extension context invalidated",
    }));
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
    expect(listener).toHaveBeenCalledTimes(1);
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

  test("delivers extension writes once through storage.onChanged", async () => {
    const changeListeners = new Set();
    const browser = {
      storage: {
        local: {
          set: jest.fn(async (values) => {
            changeListeners.forEach((listener) =>
              listener(
                Object.fromEntries(
                  Object.entries(values).map(([key, newValue]) => [
                    key,
                    { newValue },
                  ])
                ),
                "local"
              )
            );
          }),
          remove: jest.fn(async (keys) => {
            changeListeners.forEach((listener) =>
              listener(
                Object.fromEntries(
                  keys.map((key) => [key, { newValue: null }])
                ),
                "local"
              )
            );
          }),
        },
        onChanged: {
          addListener: jest.fn((listener) => changeListeners.add(listener)),
          removeListener: jest.fn((listener) =>
            changeListeners.delete(listener)
          ),
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

  test("uses the KISS_GM listener bridge and cancels pending registration", async () => {
    let valueChangeListener;
    let resolveRegistration;
    const registration = new Promise((resolve) => {
      resolveRegistration = resolve;
    });
    window.KISS_GM = {
      addValueChangeListener: jest.fn((_key, listener) => {
        valueChangeListener = listener;
        return registration;
      }),
      removeValueChangeListener: jest.fn(async () => {}),
    };
    const { storage } = loadStorageModule({ isGm: true });
    const listener = jest.fn();
    const unsubscribe = storage.subscribeObj("setting", listener);
    await Promise.resolve();

    valueChangeListener(
      "setting",
      JSON.stringify({ enabled: true }),
      JSON.stringify({ enabled: false }),
      true
    );
    expect(listener).toHaveBeenCalledWith({ enabled: false });

    listener.mockClear();
    unsubscribe();
    unsubscribe();
    valueChangeListener(
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

  test("captures synchronous GM registration failures", async () => {
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

  test("supports legacy GM listener APIs", async () => {
    let valueChangeListener;
    globalThis.GM = {};
    globalThis.GM_addValueChangeListener = jest.fn((key, listener) => {
      valueChangeListener = listener;
      return 42;
    });
    globalThis.GM_removeValueChangeListener = jest.fn();
    const { storage } = loadStorageModule({ isGm: true });
    const listener = jest.fn();
    const unsubscribe = storage.subscribeObj("setting", listener);
    await Promise.resolve();

    valueChangeListener(
      "setting",
      JSON.stringify({ enabled: true }),
      JSON.stringify({ enabled: false }),
      true
    );
    expect(listener).toHaveBeenCalledWith({ enabled: false });

    unsubscribe();
    await flushPromises();
    expect(globalThis.GM_removeValueChangeListener).toHaveBeenCalledWith(42);
  });
});
