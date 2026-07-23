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
});
