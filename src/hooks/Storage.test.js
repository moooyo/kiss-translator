import { act } from "react";
import { createRoot } from "react-dom/client";
import { useStorage } from "./Storage";
import { storage } from "../libs/storage";
import { syncData } from "../libs/sync";
import { isOptions } from "../libs/browser";
import { sendBgMsg } from "../libs/msg";
import { MSG_RUNTIME_SETTING_PATCH, STOKEY_SETTING } from "../config";
import { mergeSettingPatch } from "../libs/settingPatch";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../libs/storage", () => ({
  storage: {
    getObj: jest.fn(),
    setObj: jest.fn(() => Promise.resolve()),
    del: jest.fn(() => Promise.resolve()),
    subscribeObj: jest.fn(),
  },
}));

jest.mock("../libs/sync", () => ({
  syncData: jest.fn(() => Promise.resolve()),
}));

jest.mock("../libs/client", () => ({
  get isExt() {
    return globalThis.__TEST_STORAGE_IS_EXT__ !== false;
  },
}));

jest.mock("../libs/msg", () => ({
  sendBgMsg: jest.fn(() => Promise.resolve()),
}));

jest.mock("../libs/browser", () => ({
  isOptions: jest.fn(() => true),
}));

jest.mock("./DebouncedCallback", () => ({
  useDebouncedCallback: (callback) => {
    const debounced = (...args) => callback(...args);
    debounced.cancel = jest.fn();
    return debounced;
  },
}));

jest.mock("../libs/log", () => ({
  kissLog: jest.fn(),
  LogLevel: { INFO: { value: 2 } },
}));

function createHookHost({
  key = "local-setting",
  defaultVal = { local: true },
  syncKey = "kiss-setting_v2.json",
} = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const hookResult = {};

  function TestComponent() {
    Object.assign(hookResult, useStorage(key, defaultVal, syncKey));
    return null;
  }

  return {
    hookResult,
    render: () => {
      act(() => {
        root.render(<TestComponent />);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function waitForLoaded(hookResult) {
  for (let i = 0; i < 5; i += 1) {
    await flushEffects();
    if (hookResult.isLoading === false) return;
  }
}

describe("useStorage remote sync", () => {
  let storageListeners;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    globalThis.__KISS_CONTEXT__ = "options";
    storage.getObj.mockResolvedValue({ local: true });
    storage.setObj.mockResolvedValue(undefined);
    storage.del.mockResolvedValue(undefined);
    storageListeners = new Set();
    storage.subscribeObj.mockImplementation((_key, listener) => {
      storageListeners.add(listener);
      return () => storageListeners.delete(listener);
    });
    syncData.mockResolvedValue(undefined);
    sendBgMsg.mockResolvedValue(undefined);
    isOptions.mockReturnValue(true);
    globalThis.__TEST_STORAGE_IS_EXT__ = true;
  });

  afterEach(() => {
    delete globalThis.__KISS_CONTEXT__;
    delete globalThis.__TEST_STORAGE_IS_EXT__;
    jest.useRealTimers();
  });

  test("syncs user saves after debounce", async () => {
    const host = createHookHost();
    host.render();
    await waitForLoaded(host.hookResult);
    await flushEffects();
    expect(host.hookResult.isLoading).toBe(false);
    expect(isOptions()).toBe(true);

    syncData.mockClear();
    jest.clearAllTimers();

    await act(async () => {
      host.hookResult.save({ changed: true });
    });

    await flushEffects();
    expect(storage.setObj).toHaveBeenCalledWith("local-setting", {
      changed: true,
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    await flushEffects();

    expect(syncData).toHaveBeenCalledWith("kiss-setting_v2.json", {
      changed: true,
    });

    host.unmount();
  });

  test("does not remote sync data loaded through reload", async () => {
    const host = createHookHost();
    host.render();
    await waitForLoaded(host.hookResult);
    await flushEffects();

    syncData.mockClear();
    jest.clearAllTimers();
    storage.getObj.mockResolvedValueOnce({ reloaded: true });

    await act(async () => {
      await host.hookResult.reload();
    });

    await flushEffects();
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    await flushEffects();

    expect(syncData).not.toHaveBeenCalledWith("kiss-setting_v2.json", {
      reloaded: true,
    });

    host.unmount();
  });

  test("does not update state when reload returns equivalent data", async () => {
    const host = createHookHost();
    host.render();
    await waitForLoaded(host.hookResult);
    await flushEffects();

    storage.setObj.mockClear();
    storage.getObj.mockResolvedValueOnce({ local: true });

    await act(async () => {
      await host.hookResult.reload();
    });
    await flushEffects();

    expect(storage.setObj).not.toHaveBeenCalled();

    host.unmount();
  });

  test("applies external storage changes without writing them back", async () => {
    const host = createHookHost();
    host.render();
    await waitForLoaded(host.hookResult);
    await flushEffects();

    storage.setObj.mockClear();
    syncData.mockClear();
    act(() => {
      storageListeners.forEach((listener) => listener({ remote: true }));
    });
    await flushEffects();

    expect(host.hookResult.data).toEqual({ remote: true });
    expect(storage.setObj).not.toHaveBeenCalledWith("local-setting", {
      remote: true,
    });
    expect(syncData).not.toHaveBeenCalled();

    host.unmount();
  });

  test("does not let a late initial read overwrite a newer event", async () => {
    let resolveInitialRead;
    storage.getObj.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInitialRead = resolve;
        })
    );
    const host = createHookHost();
    host.render();
    await flushEffects();

    act(() => {
      storageListeners.forEach((listener) => listener({ remote: "new" }));
    });
    await act(async () => {
      resolveInitialRead({ local: "stale" });
      await Promise.resolve();
    });
    await waitForLoaded(host.hookResult);

    expect(host.hookResult.data).toEqual({ remote: "new" });
    host.unmount();
  });

  test("sends a minimal deep setting patch to the background writer", async () => {
    let storedSetting = {
      darkMode: "auto",
      injectRules: true,
      subtitleSetting: { enabled: true, apiSlug: "Microsoft" },
    };
    storage.getObj.mockResolvedValue(storedSetting);
    sendBgMsg.mockImplementation(async (_action, { patch }) => {
      storedSetting = mergeSettingPatch(storedSetting, patch);
      return { setting: storedSetting, delivered: 0, attempted: 0 };
    });
    const host = createHookHost({
      key: STOKEY_SETTING,
      defaultVal: storedSetting,
    });
    host.render();
    await waitForLoaded(host.hookResult);
    await flushEffects();

    storage.setObj.mockClear();
    sendBgMsg.mockClear();
    await act(async () => {
      host.hookResult.save((current) => ({
        ...current,
        subtitleSetting: {
          ...current.subtitleSetting,
          enabled: false,
        },
      }));
    });
    await flushEffects();

    expect(sendBgMsg).toHaveBeenCalledWith(MSG_RUNTIME_SETTING_PATCH, {
      patch: { subtitleSetting: { enabled: false } },
      scope: "none",
    });
    expect(storage.setObj).not.toHaveBeenCalledWith(
      STOKEY_SETTING,
      expect.anything()
    );
    expect(storedSetting).toEqual({
      darkMode: "auto",
      injectRules: true,
      subtitleSetting: { enabled: false, apiSlug: "Microsoft" },
    });

    host.unmount();
  });

  test("preserves fields changed by concurrent extension contexts", async () => {
    let storedSetting = {
      darkMode: "auto",
      subtitleSetting: { enabled: true, apiSlug: "Microsoft" },
    };
    const sentPatches = [];
    storage.getObj.mockResolvedValue(storedSetting);
    sendBgMsg.mockImplementation(async (_action, { patch }) => {
      sentPatches.push(patch);
      storedSetting = mergeSettingPatch(storedSetting, patch);
      return { setting: storedSetting, delivered: 0, attempted: 0 };
    });
    const firstHost = createHookHost({
      key: STOKEY_SETTING,
      defaultVal: storedSetting,
    });
    const secondHost = createHookHost({
      key: STOKEY_SETTING,
      defaultVal: storedSetting,
    });
    firstHost.render();
    secondHost.render();
    await waitForLoaded(firstHost.hookResult);
    await waitForLoaded(secondHost.hookResult);

    await act(async () => {
      firstHost.hookResult.save((current) => ({
        ...current,
        darkMode: "dark",
      }));
      secondHost.hookResult.save((current) => ({
        ...current,
        subtitleSetting: {
          ...current.subtitleSetting,
          enabled: false,
        },
      }));
    });
    await flushEffects();
    await flushEffects();

    expect(sentPatches).toEqual(
      expect.arrayContaining([
        { darkMode: "dark" },
        { subtitleSetting: { enabled: false } },
      ])
    );
    expect(storedSetting).toEqual({
      darkMode: "dark",
      subtitleSetting: { enabled: false, apiSlug: "Microsoft" },
    });

    firstHost.unmount();
    secondHost.unmount();
  });
});
