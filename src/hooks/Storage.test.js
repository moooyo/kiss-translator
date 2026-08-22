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
    patchObj: jest.fn(),
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

// CRA 的 jest 配置默认 resetMocks: true，会连 jest.fn() 的默认实现一起清掉，
// 所以实现必须在每个用例里重设 —— 现有的 getObj/setObj 也是这么做的。
// 这里刻意用真实的 mergeSettingPatch：合并语义本身就是被测行为的一部分。
function wirePatchObj() {
  const { mergeSettingPatch } = jest.requireActual("../libs/settingPatch");
  // 真实实现按键串行（见 libs/storage.js 与 storage.test.js 的
  // "patchObj serialization"）。mock 必须忠实于同一契约，否则两次并发补丁
  // 会读到同一个初值，测出来的就不是 hook 的行为而是 mock 的缺陷。
  let queue = Promise.resolve();
  storage.patchObj.mockImplementation((key, patch, { onWillWrite } = {}) => {
    const run = async () => {
      const cur = (await storage.getObj(key)) ?? {};
      const next = mergeSettingPatch(cur, patch);
      onWillWrite?.(next);
      await storage.setObj(key, next);
      return next;
    };
    const result = queue.then(run, run);
    queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  });
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

// 两个 SettingProvider 各改一份整对象快照里的不同字段，看订阅落地后
// 还剩不剩得下彼此的修改。这是 94fcf96（设置写入序列化）声称要解决的场景，
// 在这里用测试而不是推理把它钉下来：跑得通说明残余不存在，跑不通说明它是真的。
describe("useStorage concurrent whole-object writes", () => {
  let listeners;
  let store;

  // 让 mock 真的存值并广播，否则测不出「谁覆盖谁」
  const wireLiveStorage = (initial) => {
    store = initial;
    listeners = new Set();

    storage.getObj.mockImplementation(async () => store);
    storage.subscribeObj.mockImplementation((_key, listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    });
    storage.setObj.mockImplementation(async (_key, value) => {
      store = value;
      // 订阅通道把写入回放给所有上下文，含写入方自己
      listeners.forEach((listener) => listener(value));
    });
    wirePatchObj();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    globalThis.__KISS_CONTEXT__ = "options";
    storage.del.mockResolvedValue(undefined);
    syncData.mockResolvedValue(undefined);
    isOptions.mockReturnValue(false); // 关掉远端同步，只看本地写入
  });

  afterEach(() => {
    delete globalThis.__KISS_CONTEXT__;
    jest.useRealTimers();
  });

  test("keeps both fields when two providers edit different keys", async () => {
    wireLiveStorage({ alpha: 1, beta: 1 });

    const a = createHookHost({ key: "shared", syncKey: "" });
    const b = createHookHost({ key: "shared", syncKey: "" });
    a.render();
    b.render();
    await waitForLoaded(a.hookResult);
    await waitForLoaded(b.hookResult);
    await flushEffects();

    expect(a.hookResult.data).toEqual({ alpha: 1, beta: 1 });
    expect(b.hookResult.data).toEqual({ alpha: 1, beta: 1 });

    // 两边几乎同时各改一个字段，各自都写出整份快照
    await act(async () => {
      a.hookResult.update({ alpha: 2 });
      b.hookResult.update({ beta: 2 });
    });
    await flushEffects();
    await flushEffects();

    expect(store).toEqual({ alpha: 2, beta: 2 });

    a.unmount();
    b.unmount();
  });
});

describe("useStorage remote sync", () => {
  let storageListeners;
  let store;

  // 模拟外部变更：生产里订阅之所以触发，是因为存储真的变了。
  // 只调监听器而不动 store，会让随后的 patchObj 读到过期值。
  const deliverExternal = (value) => {
    store = value;
    storageListeners.forEach((listener) => listener(value));
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    globalThis.__KISS_CONTEXT__ = "options";
    // getObj 必须反映已写入的值：patchObj 是读-改-写，若读到的永远是初始快照，
    // 合并结果会带上早已被覆盖的幽灵字段，测出来的就不是产品行为。
    store = { local: true };
    storage.getObj.mockImplementation(async () => store);
    storage.setObj.mockImplementation(async (_key, value) => {
      store = value;
    });
    storage.del.mockResolvedValue(undefined);
    wirePatchObj();
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
      deliverExternal({ remote: true });
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
    expect(syncData).not.toHaveBeenCalled();

    host.unmount();
  });

  test("does not write back a value pulled in by reload", async () => {
    const host = createHookHost();
    host.render();
    await waitForLoaded(host.hookResult);
    await flushEffects();

    storage.setObj.mockClear();
    storage.getObj.mockResolvedValueOnce({ reloaded: true });

    await act(async () => {
      await host.hookResult.reload();
    });
    await flushEffects();

    // 与挂载路径同理：刚读出来的值再写回去会经订阅广播，把其他上下文回退。
    expect(host.hookResult.data).toEqual({ reloaded: true });
    expect(storage.setObj).not.toHaveBeenCalled();

    host.unmount();
  });

  test("ignores the echo of a write this context issued", async () => {
    const host = createHookHost();
    host.render();
    await waitForLoaded(host.hookResult);
    await flushEffects();

    await act(async () => {
      host.hookResult.save({ typed: "ab" });
    });
    await flushEffects();
    await act(async () => {
      host.hookResult.save({ typed: "abc" });
    });
    await flushEffects();
    expect(host.hookResult.data).toEqual({ typed: "abc" });

    // 桥接环境下第一次写入的回声可能在第二次之后才回来。照单全收会把正在
    // 输入的字段回退两个字符，随后敲下的内容再把较新的值永久覆盖掉。
    act(() => {
      deliverExternal({ typed: "ab" });
    });
    await flushEffects();

    expect(host.hookResult.data).toEqual({ typed: "abc" });

    host.unmount();
  });

  test("stops suppressing an echoed value once it has been consumed", async () => {
    const host = createHookHost();
    host.render();
    await waitForLoaded(host.hookResult);
    await flushEffects();

    await act(async () => {
      host.hookResult.save({ typed: "ab" });
    });
    await flushEffects();

    // 第一次投递是自己的回声，丢弃。
    act(() => {
      deliverExternal({ typed: "ab" });
    });
    await flushEffects();

    await act(async () => {
      host.hookResult.save({ typed: "xyz" });
    });
    await flushEffects();
    expect(host.hookResult.data).toEqual({ typed: "xyz" });

    // 抑制是一次性的，不是永久黑名单：别的上下文之后真的写出同样的值，
    // 必须照常采纳。
    act(() => {
      deliverExternal({ typed: "ab" });
    });
    await flushEffects();

    expect(host.hookResult.data).toEqual({ typed: "ab" });

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
      deliverExternal({ remote: "new" });
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
      deliverExternal({ source: "remote" });
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
