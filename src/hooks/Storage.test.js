import { act } from "react";
import { createRoot } from "react-dom/client";
import { useStorage } from "./Storage";
import { storage } from "../libs/storage";
import { syncData } from "../libs/sync";
import { isOptions } from "../libs/browser";

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
    isOptions.mockReturnValue(true);
  });

  afterEach(() => {
    delete globalThis.__KISS_CONTEXT__;
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

  test("does not write back the value it just loaded", async () => {
    storage.getObj.mockResolvedValue({ loaded: true });
    const host = createHookHost();
    host.render();
    await waitForLoaded(host.hookResult);
    await flushEffects();

    // 挂载时读到的值原样写回是多余的，而且会经订阅广播出去：接收方回退到这个
    // 旧值、设上自己的 external 标记，其写盘副作用随即提前返回，于是较新的编辑
    // 在界面和存储中同时消失且无法自愈。
    expect(host.hookResult.data).toEqual({ loaded: true });
    expect(storage.setObj).not.toHaveBeenCalled();

    host.unmount();
  });

  test("writes the default exactly once when storage is empty", async () => {
    storage.getObj.mockResolvedValue(undefined);
    const host = createHookHost();
    host.render();
    await waitForLoaded(host.hookResult);
    await flushEffects();

    expect(storage.setObj).toHaveBeenCalledTimes(1);
    expect(storage.setObj).toHaveBeenCalledWith("local-setting", {
      local: true,
    });

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

  test("does not retain an external marker after a batched local overwrite", async () => {
    const host = createHookHost();
    host.render();
    await waitForLoaded(host.hookResult);
    await flushEffects();

    storage.setObj.mockClear();
    syncData.mockClear();
    act(() => {
      storageListeners.forEach((listener) => listener({ source: "remote" }));
      host.hookResult.save({ source: "local" });
    });
    await flushEffects();

    expect(storage.setObj).toHaveBeenCalledWith("local-setting", {
      source: "local",
    });
    expect(syncData).toHaveBeenCalledWith("kiss-setting_v2.json", {
      source: "local",
    });

    storage.setObj.mockClear();
    syncData.mockClear();
    await act(async () => {
      host.hookResult.save({ source: "remote" });
    });
    await flushEffects();

    expect(storage.setObj).toHaveBeenCalledWith("local-setting", {
      source: "remote",
    });
    expect(syncData).toHaveBeenCalledWith("kiss-setting_v2.json", {
      source: "remote",
    });

    host.unmount();
  });
});
