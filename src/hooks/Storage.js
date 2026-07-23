import { useCallback, useEffect, useRef, useState } from "react";
import { MSG_RUNTIME_SETTING_PATCH } from "../config/msg";
import { STOKEY_SETTING } from "../config/storage";
import { storage } from "../libs/storage";
import { kissLog } from "../libs/log";
import { syncData } from "../libs/sync";
import { isExt } from "../libs/client";
import { sendBgMsg } from "../libs/msg";
import { createSettingPatch, mergeSettingPatch } from "../libs/settingPatch";
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
  const dataRef = useRef(defaultVal);
  const persistedSettingRef = useRef(defaultVal);
  const settingWriteQueueRef = useRef(Promise.resolve());
  const storageRevisionRef = useRef(0);
  const localChangeRevisionRef = useRef(0);
  const remoteSyncRevisionRef = useRef(0);
  const isBackgroundManagedSetting = isExt && key === STOKEY_SETTING;

  dataRef.current = data;

  const applyPersistedSetting = useCallback(
    (storedValue) => {
      const pendingPatch = createSettingPatch(
        persistedSettingRef.current,
        dataRef.current
      );
      const nextPersisted = storedValue ?? {};
      const visiblePersisted = storedValue ?? defaultVal;
      const nextData =
        pendingPatch === undefined
          ? visiblePersisted
          : mergeSettingPatch(visiblePersisted, pendingPatch);

      persistedSettingRef.current = nextPersisted;
      dataRef.current = nextData;
      setData((currentValue) =>
        isSameStorageValue(currentValue, nextData) ? currentValue : nextData
      );
    },
    [defaultVal]
  );

  // Subscribe before reading so a late initial read cannot overwrite a newer
  // value delivered by the storage change channel.
  useEffect(() => {
    let isMounted = true;
    externalStorageValueRef.current = undefined;
    skipRemoteSyncValueRef.current = undefined;
    persistedSettingRef.current = defaultVal;
    settingWriteQueueRef.current = Promise.resolve();
    storageRevisionRef.current = 0;
    localChangeRevisionRef.current = 0;
    remoteSyncRevisionRef.current = 0;

    const unsubscribe = storage.subscribeObj?.(key, (storedValue) => {
      if (!isMounted) return;
      storageRevisionRef.current += 1;

      if (isBackgroundManagedSetting) {
        applyPersistedSetting(storedValue);
        return;
      }

      const nextValue = storedValue ?? defaultVal;
      setData((currentValue) => {
        if (isSameStorageValue(currentValue, nextValue)) return currentValue;
        externalStorageValueRef.current = nextValue;
        skipRemoteSyncValueRef.current = { value: nextValue };
        dataRef.current = nextValue;
        return nextValue;
      });
    });

    const loadInitialData = async () => {
      const revisionAtStart = storageRevisionRef.current;
      try {
        const storedVal = await storage.getObj(key);
        if (!isMounted || storageRevisionRef.current !== revisionAtStart) {
          return;
        }

        if (storedVal === undefined || storedVal === null) {
          if (isBackgroundManagedSetting) {
            const revisionBeforeInitialization = storageRevisionRef.current;
            const response = await sendBgMsg(MSG_RUNTIME_SETTING_PATCH, {
              patch: {},
            });
            if (!isMounted) return;
            if (
              storageRevisionRef.current === revisionBeforeInitialization &&
              response &&
              "setting" in response
            ) {
              persistedSettingRef.current = response.setting;
              dataRef.current = response.setting;
              setData(response.setting);
            } else if (
              storageRevisionRef.current === revisionBeforeInitialization
            ) {
              persistedSettingRef.current = {};
              dataRef.current = defaultVal;
              setData(defaultVal);
            }
          } else {
            // 如果存储中没有该值，写入初始默认值
            await storage.setObj(key, defaultVal);
          }
        } else {
          if (isBackgroundManagedSetting) {
            persistedSettingRef.current = storedVal;
          }
          dataRef.current = storedVal;
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
  }, [key, defaultVal, isBackgroundManagedSetting, applyPersistedSetting]);

  // 远端同步处理器
  const runSync = useCallback(
    async (keyToSync, valueToSync) => {
      try {
        const res = await syncData(keyToSync, valueToSync);
        if (res?.isNew) {
          const nextValue = res.value;
          if (!isBackgroundManagedSetting) {
            skipRemoteSyncValueRef.current = { value: nextValue };
          }
          dataRef.current = nextValue;
          setData(nextValue);
        }
      } catch (error) {
        kissLog("Sync failed", keyToSync);
      }
    },
    [isBackgroundManagedSetting]
  );

  // 对远端同步逻辑进行防抖，防止高频触发写盘和网络请求
  const debouncedSync = useDebouncedCallback(runSync, 3000);

  const enqueueSettingWrite = useCallback(() => {
    const operation = settingWriteQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const patch = createSettingPatch(
          persistedSettingRef.current,
          dataRef.current
        );
        if (patch === undefined) return;

        const localRevision = localChangeRevisionRef.current;
        const storageRevision = storageRevisionRef.current;
        const response = await sendBgMsg(MSG_RUNTIME_SETTING_PATCH, { patch });
        if (!response || !("setting" in response)) return;

        if (storageRevisionRef.current === storageRevision) {
          applyPersistedSetting(response.setting);
        }
        if (
          syncKey &&
          isOptions() &&
          localRevision > remoteSyncRevisionRef.current
        ) {
          remoteSyncRevisionRef.current = localRevision;
          debouncedSync(syncKey, response.setting);
        }
      });

    settingWriteQueueRef.current = operation;
    void operation.catch((err) => {
      kissLog(`storage save error for key: ${key}`, err);
    });
  }, [key, syncKey, applyPersistedSetting, debouncedSync]);

  // 数据发生改变时触发本地写盘及远端同步
  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (data === null) {
      return;
    }

    if (isBackgroundManagedSetting) {
      enqueueSettingWrite();
      return;
    }

    if (isSameStorageValue(externalStorageValueRef.current, data)) {
      externalStorageValueRef.current = undefined;
      skipRemoteSyncValueRef.current = undefined;
      return;
    }

    storage.setObj(key, data).catch((err) => {
      kissLog(`storage save error for key: ${key}`, err);
    });

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
  }, [
    key,
    syncKey,
    isLoading,
    data,
    debouncedSync,
    isBackgroundManagedSetting,
    enqueueSettingWrite,
  ]);

  /**
   * 全量替换状态值并自动触发写盘副作用
   * @param {any | ((prevData: any) => any)} valueOrFn 新的值或一个返回新值的函数。
   */
  const save = useCallback((valueOrFn) => {
    setData((prevData) => {
      const nextData =
        typeof valueOrFn === "function" ? valueOrFn(prevData) : valueOrFn;
      externalStorageValueRef.current = undefined;
      skipRemoteSyncValueRef.current = undefined;
      if (!isSameStorageValue(prevData, nextData)) {
        localChangeRevisionRef.current += 1;
      }
      dataRef.current = nextData;
      return nextData;
    });
  }, []);

  /**
   * 合并部分对象到当前状态（假设状态是一个对象）。
   * @param {object | ((prevData: object) => object)} partialDataOrFn 要合并的对象或一个返回该对象的函数。
   */
  const update = useCallback((partialDataOrFn) => {
    setData((prevData) => {
      const partialData =
        typeof partialDataOrFn === "function"
          ? partialDataOrFn(prevData)
          : partialDataOrFn;
      // 确保 preData 是一个对象，避免展开 null 或 undefined
      const baseObj =
        typeof prevData === "object" && prevData !== null ? prevData : {};
      const nextData = { ...baseObj, ...partialData };
      externalStorageValueRef.current = undefined;
      skipRemoteSyncValueRef.current = undefined;
      if (!isSameStorageValue(prevData, nextData)) {
        localChangeRevisionRef.current += 1;
      }
      dataRef.current = nextData;
      return nextData;
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
      externalStorageValueRef.current = undefined;
      skipRemoteSyncValueRef.current = undefined;
      dataRef.current = null;
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
      if (isBackgroundManagedSetting) {
        persistedSettingRef.current = storedVal ?? {};
        dataRef.current = nextData;
        setData((currentValue) =>
          isSameStorageValue(currentValue, nextData) ? currentValue : nextData
        );
        return;
      }
      if (isSameStorageValue(data, nextData)) {
        return;
      }
      if (!Object.is(data, nextData)) {
        skipRemoteSyncValueRef.current = { value: nextData };
      }
      setData(nextData);
    } catch (err) {
      kissLog(`storage reload error for key: ${key}`, err);
    }
  }, [key, defaultVal, data, isBackgroundManagedSetting]);

  return { data, save, update, remove, reload, isLoading };
}
