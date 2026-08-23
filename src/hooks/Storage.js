import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "../libs/storage";
import { createSettingPatch } from "../libs/settingPatch";
import { buildReplayPatch, findRegressedPaths } from "../libs/fieldRevisions";
import { kissLog } from "../libs/log";
import { syncData } from "../libs/sync";
import { useDebouncedCallback } from "./DebouncedCallback";
import { isOptions } from "../libs/browser";

function isSameStorageValue(a, b) {
  if (Object.is(a, b)) return true;

  if (
    a &&
    b &&
    typeof a === "object" &&
    typeof b === "object" &&
    Array.isArray(a) === Array.isArray(b)
  ) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (err) {
      return false;
    }
  }

  return false;
}

// 记住多少条自己写出去的载荷。回声通常一拍就回来，队列只是给桥接环境下
// 连续写入留出余量；写入失败时不会有回声，靠这个上限防止无限增长。
const SELF_WRITE_MEMORY = 8;

function serializeStorageValue(value) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return undefined;
  }
}

function rememberSelfWrite(queue, value) {
  const payload = serializeStorageValue(value);
  if (payload === undefined) return;
  queue.push(payload);
  if (queue.length > SELF_WRITE_MEMORY) {
    queue.shift();
  }
}

/**
 * 认领并消费一条自己写出去的回声。返回 true 表示这次通知是本上下文自己造成的，
 * 调用方应当直接忽略。
 */
function claimSelfWrite(queue, value) {
  const payload = serializeStorageValue(value);
  if (payload === undefined) return false;
  const index = queue.indexOf(payload);
  if (index === -1) return false;
  queue.splice(index, 1);
  return true;
}

/**
 * 自定义 Storage 同步 Hook，用于在 React 组件生命周期中存取本地 Storage 状态
 *
 * // REVIEW: 1. 多实例数据非同步隐患。
 * //    `useStorage` 在内部通过 React 的 `useState` 管理局部状态，并在副作用中调用 `storage.setObj` 写入存储。
 * //    但是，如果同一个 key 被页面中多个相互隔离的组件组件（例如 Popup、Options 或 Content 中的不同组件实例）同时使用，
 * //    其中一个组件调用了 `save(newVal)` 修改了 Storage，其他组件是无法自动感知这一数据更新的（因为缺乏监听本地存储改变的广播事件）。
 * //    建议通过增加 `chrome.storage.onChanged`（扩展模式下）或 `window.addEventListener('storage')`（网页模式下）的监听器，
 * //    在监听到对应 Key 变化时自动 `setData` 同步刷新局部 React 状态。
 *
 * @param {string} key 用于在 Storage 中存取值的键
 * @param {*} defaultVal 默认值。建议在组件外定义为常量。
 * @param {string} [syncKey=""] 用于远端同步的可选键名
 * @returns {{
 * data: *,
 * save: (valueOrFn: any | ((prevData: any) => any)) => void,
 * update: (partialDataOrFn: object | ((prevData: object) => object)) => void,
 * remove: () => Promise<void>,
 * reload: () => Promise<void>,
 * isLoading: boolean
 * }}
 */
export function useStorage(key, defaultVal = null, syncKey = "") {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState(defaultVal);
  const skipRemoteSyncValueRef = useRef();
  const externalStorageValueRef = useRef();
  const selfWrittenPayloadsRef = useRef([]);
  // 本上下文已知的落盘值。写入时据它算出补丁，只写自己真正改过的字段。
  const persistedValueRef = useRef(undefined);
  // 本上下文上次写入时的逐字段版本戳，以及那次写入的完整值。
  // 跨 realm 的覆盖只能事后识别：别人拿过期快照写回来时，会把我推高过的戳
  // 一起抹掉，于是「存储里的戳比我写进去的还旧」就成了可靠信号。
  const writtenRevisionsRef = useRef({});
  const writtenValueRef = useRef(undefined);

  // Subscribe before reading so a late initial read cannot overwrite a newer
  // value delivered by the storage change channel.
  useEffect(() => {
    let isMounted = true;
    let storageRevision = 0;
    externalStorageValueRef.current = undefined;
    skipRemoteSyncValueRef.current = undefined;
    selfWrittenPayloadsRef.current = [];
    persistedValueRef.current = undefined;
    writtenRevisionsRef.current = {};
    writtenValueRef.current = undefined;

    // 跨 realm 覆盖的事后修复。别人用过期快照写回来时会连同我推高过的版本戳
    // 一起抹掉，所以「存储里某个字段的戳比我写进去的还旧」只可能是被覆盖了 ——
    // 真正的后续修改一定会把戳推得更高，那种情况不能回滚。
    const repairClobberedFields = async () => {
      const written = writtenRevisionsRef.current;
      if (!written || Object.keys(written).length === 0) return;

      try {
        const stored = await storage.getFieldRevisions?.(key);
        const regressed = findRegressedPaths(stored, written);
        if (regressed.length === 0) return;

        const replay = buildReplayPatch(writtenValueRef.current, regressed);
        if (replay === undefined) return;

        // 重放本身也是一次 patchObj，会把戳推到更高，对方看到的是「更新」
        // 而不是「回退」，因此不会反过来再修一次 —— 一轮即收敛。
        await storage.patchObj(key, replay, {
          onWillWrite: (merged, revisions) => {
            persistedValueRef.current = merged;
            writtenValueRef.current = merged;
            writtenRevisionsRef.current = revisions;
            rememberSelfWrite(selfWrittenPayloadsRef.current, merged);
          },
        });
      } catch (error) {
        kissLog(`storage repair error for key: ${key}`, error);
      }
    };

    const unsubscribe = storage.subscribeObj?.(key, (storedValue) => {
      if (!isMounted) return;
      storageRevision += 1;

      const nextValue = storedValue ?? defaultVal;

      // 本上下文自己的写入也会经订阅回声回来（扩展走 browser.storage.onChanged，
      // 油猴走 emitStorageChange）。回声携带的是写入当时的快照——在 CustomEvent
      // 桥接环境下它可能比当前状态旧好几拍。照单全收会把正在输入的字段回退，
      // 其间敲下的字符随后被永久覆盖，同步凭据这类字段尤其危险。
      // 同一页面里的其他 provider 不受影响：它们各自的队列里没有这条载荷。
      if (claimSelfWrite(selfWrittenPayloadsRef.current, nextValue)) {
        return;
      }

      // 到这里说明是别的 realm 写的。它有可能是拿过期快照写的，
      // 顺手把我刚落盘的字段抹回了旧值 —— 查一下版本戳，是的话重放。
      repairClobberedFields();

      persistedValueRef.current = nextValue;
      setData((currentValue) => {
        if (isSameStorageValue(currentValue, nextValue)) return currentValue;
        externalStorageValueRef.current = nextValue;
        skipRemoteSyncValueRef.current = { value: nextValue };
        return nextValue;
      });
    });

    const loadInitialData = async () => {
      const revisionAtStart = storageRevision;
      try {
        const storedVal = await storage.getObj(key);
        if (!isMounted || storageRevision !== revisionAtStart) return;

        if (storedVal === undefined || storedVal === null) {
          // 如果存储中没有该值，写入初始默认值。
          // 同时标记为「来自存储」，避免下方写盘副作用把刚写进去的默认值再写一遍。
          externalStorageValueRef.current = defaultVal;
          skipRemoteSyncValueRef.current = { value: defaultVal };
          persistedValueRef.current = defaultVal;
          await storage.setObj(key, defaultVal);
        } else {
          // 刚从存储读出来的值不需要再写回去。不加这个标记的话，写盘副作用会把它
          // 原样写回、并经订阅广播给其他上下文；接收方回退到这个旧值后会设上自己
          // 的 external 标记，其写盘副作用随即提前返回，于是较新的编辑在界面和存
          // 储中同时消失，且没有任何东西能把它恢复回来。
          externalStorageValueRef.current = storedVal;
          skipRemoteSyncValueRef.current = { value: storedVal };
          persistedValueRef.current = storedVal;
          setData(storedVal);
        }
      } catch (err) {
        kissLog(`storage load error for key: ${key}`, err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [key, defaultVal]);

  // 远端同步处理器
  const runSync = useCallback(async (keyToSync, valueToSync) => {
    try {
      const res = await syncData(keyToSync, valueToSync);
      if (res?.isNew) {
        setData(res.value);
      }
    } catch (error) {
      kissLog("Sync failed", keyToSync);
    }
  }, []);

  // 对远端同步逻辑进行防抖，防止高频触发写盘和网络请求
  const debouncedSync = useDebouncedCallback(runSync, 3000);

  // 数据发生改变时触发本地写盘及远端同步
  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (data === null) {
      return;
    }

    if (isSameStorageValue(externalStorageValueRef.current, data)) {
      externalStorageValueRef.current = undefined;
      skipRemoteSyncValueRef.current = undefined;
      return;
    }

    // 只写自己真正改动的字段，而不是整份快照。
    // 每个上下文都持有一份独立快照，整体写回时后写的会连同别人刚改过的字段
    // 一起抹掉（「A 改 X 的同时 B 改 Y」丢一个）。补丁 + 存储层的按键串行
    // 让这种情况可交换。
    const patch = createSettingPatch(persistedValueRef.current, data);
    if (patch !== undefined) {
      storage
        .patchObj(key, patch, {
          onWillWrite: (merged, revisions) => {
            // 登记的是**合并结果**而不是 data：别人的字段可能一并落了进来，
            // 回声携带的是合并结果，用 data 去比对会认领不上。
            persistedValueRef.current = merged;
            // 重放要用「我写进去的那份完整值」取字段，不能用 data ——
            // 合并可能把别人的字段也带了进来，那些不该由我来重放。
            writtenValueRef.current = merged;
            writtenRevisionsRef.current = revisions;
            rememberSelfWrite(selfWrittenPayloadsRef.current, merged);
          },
        })
        .catch((err) => {
          kissLog(`storage save error for key: ${key}`, err);
        });
    }

    if (
      skipRemoteSyncValueRef.current &&
      Object.is(skipRemoteSyncValueRef.current.value, data)
    ) {
      skipRemoteSyncValueRef.current = undefined;
      return;
    }

    // 仅在配置后台页面中触发远端同步
    if (syncKey && isOptions()) {
      debouncedSync(syncKey, data);
    }
  }, [key, syncKey, isLoading, data, debouncedSync]);

  /**
   * 全量替换状态值并自动触发写盘副作用
   * @param {any | ((prevData: any) => any)} valueOrFn 新的值或一个返回新值的函数。
   */
  const save = useCallback((valueOrFn) => {
    // 标记清除放在更新函数外面：React 会主动调用更新函数，若它返回原值则直接
    // 退出、既不重渲染也不提交，而此时副作用已经发生。src/hooks/Rules.js 的
    // add / del / merge 在无操作时正是返回原值。
    externalStorageValueRef.current = undefined;
    skipRemoteSyncValueRef.current = undefined;
    setData((prevData) =>
      typeof valueOrFn === "function" ? valueOrFn(prevData) : valueOrFn
    );
  }, []);

  /**
   * 合并部分对象到当前状态（假设状态是一个对象）。
   * @param {object | ((prevData: object) => object)} partialDataOrFn 要合并的对象或一个返回该对象的函数。
   */
  const update = useCallback((partialDataOrFn) => {
    externalStorageValueRef.current = undefined;
    skipRemoteSyncValueRef.current = undefined;
    setData((prevData) => {
      const partialData =
        typeof partialDataOrFn === "function"
          ? partialDataOrFn(prevData)
          : partialDataOrFn;
      // 确保 preData 是一个对象，避免展开 null 或 undefined
      const baseObj =
        typeof prevData === "object" && prevData !== null ? prevData : {};
      return { ...baseObj, ...partialData };
    });
  }, []);

  /**
   * 从 Storage 中删除该值，并将状态重置为 null。
   */
  const remove = useCallback(async () => {
    externalStorageValueRef.current = undefined;
    skipRemoteSyncValueRef.current = undefined;
    try {
      await storage.del(key);
      // 整个键都删掉了，就没有「我的字段被谁覆盖了」这回事。
      // 不清掉这两个 ref，随后任何一次外部写入都会触发一次重放，
      // 把刚被删除的数据又写回去。
      writtenRevisionsRef.current = {};
      writtenValueRef.current = undefined;
      persistedValueRef.current = undefined;
      await storage.clearFieldRevisions?.(key);
      externalStorageValueRef.current = undefined;
      skipRemoteSyncValueRef.current = undefined;
      setData(null);
    } catch (err) {
      kissLog(`storage remove error for key: ${key}`, err);
    }
  }, [key]);

  /**
   * 从 Storage 重新加载数据以覆盖当前状态。
   */
  const reload = useCallback(async () => {
    try {
      const storedVal = await storage.getObj(key);
      const nextData = storedVal ?? defaultVal;
      if (isSameStorageValue(data, nextData)) {
        return;
      }
      if (!Object.is(data, nextData)) {
        skipRemoteSyncValueRef.current = { value: nextData };
      }
      // 与 loadInitialData 同理：刚从存储读出来的值不需要再写回去，否则会经
      // 订阅广播出去，把其他上下文回退到这个刚被读取前的快照。
      externalStorageValueRef.current = nextData;
      persistedValueRef.current = nextData;
      setData(nextData);
    } catch (err) {
      kissLog(`storage reload error for key: ${key}`, err);
    }
  }, [key, defaultVal, data]);

  return { data, save, update, remove, reload, isLoading };
}
