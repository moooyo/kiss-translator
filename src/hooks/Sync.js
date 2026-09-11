import { useCallback, useEffect, useRef, useState } from "react";
import { STOKEY_SYNC, DEFAULT_SYNC } from "../config";
import { useStorage } from "./Storage";
import { getSyncWithDefault, storage } from "../libs/storage";
import { SETTING_PATCH_DELETE } from "../libs/settingPatch";
import { kissLog } from "../libs/log";

/**
 * 远端云同步（如 WebDAV）配置数据的读取与更新自定义 Hook
 * @returns {object} { sync: *, updateSync: function, reloadSync: function }
 */
export function useSync() {
  // 使用 useStorage 代理同步配置 STOKEY_SYNC 的持久化存储
  const { data, update, reload } = useStorage(STOKEY_SYNC, DEFAULT_SYNC);
  return { sync: data, updateSync: update, reloadSync: reload };
}

/**
 * 更新特定同步配置键对应更新时间戳的自定义 Hook
 * 用于向云端元数据标识该类配置发生了更改
 * @returns {object} { updateSyncMeta: function }
 */
export function useSyncMeta() {
  const { updateSync } = useSync();

  // 接收一个规则或配置的 key (例如 'rules', 'setting')，更新其对应的 syncMeta 时间戳并写入存储
  const updateSyncMeta = useCallback(
    (key) => {
      updateSync((prevSync) => {
        const newSyncMeta = {
          ...(prevSync?.syncMeta || {}),
          [key]: {
            ...(prevSync?.syncMeta?.[key] || {}),
            updateAt: Date.now(),
          },
        };
        return { syncMeta: newSyncMeta };
      });
    },
    [updateSync]
  );

  return { updateSyncMeta };
}

// Keep cache mutations ordered even when the initiating Rules view unmounts.
let syncCacheWriteQueue = Promise.resolve();

function enqueueSyncCacheOperation(operation) {
  const pending = syncCacheWriteQueue.then(operation, operation);
  syncCacheWriteQueue = pending.then(
    () => undefined,
    () => undefined
  );
  return pending;
}

async function readSyncCacheState() {
  // Userscript settings can be opened before any background initialization.
  await storage.trySetObj(STOKEY_SYNC, DEFAULT_SYNC);
  return getSyncWithDefault();
}

function writeSyncCache(url, timestamp) {
  return enqueueSyncCacheOperation(async () => {
    await readSyncCacheState();
    // Share the settings write queue and revisions, changing only this URL.
    const sync = await storage.patchObj(STOKEY_SYNC, {
      dataCaches: {
        [url]: timestamp === undefined ? SETTING_PATCH_DELETE : timestamp,
      },
    });
    return sync.dataCaches || {};
  });
}

/** Load cache timestamps without persisting previously loaded sync snapshots. */
export function useSyncCaches() {
  const [dataCaches, setDataCaches] = useState({});
  const mountedRef = useRef(false);
  const readRevisionRef = useRef(0);

  const reloadSync = useCallback(async () => {
    const revision = ++readRevisionRef.current;
    const sync = await enqueueSyncCacheOperation(readSyncCacheState);
    if (mountedRef.current && revision === readRevisionRef.current) {
      setDataCaches(sync.dataCaches || {});
    }
    return sync;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = storage.subscribeObj(STOKEY_SYNC, (sync) => {
      if (!mountedRef.current) return;
      readRevisionRef.current += 1;
      setDataCaches(sync?.dataCaches || {});
    });
    reloadSync().catch((error) => kissLog("load sync caches", error));
    return () => {
      mountedRef.current = false;
      readRevisionRef.current += 1;
      unsubscribe?.();
    };
  }, [reloadSync]);

  const mutateCache = useCallback(async (url, timestamp) => {
    const revision = ++readRevisionRef.current;
    const nextCaches = await writeSyncCache(url, timestamp);
    if (mountedRef.current && revision === readRevisionRef.current) {
      setDataCaches(nextCaches);
    }
    return nextCaches;
  }, []);

  const updateDataCache = useCallback(
    (url) => mutateCache(url, Date.now()),
    [mutateCache]
  );
  const deleteDataCache = useCallback(
    (url) => mutateCache(url, undefined),
    [mutateCache]
  );

  return { dataCaches, updateDataCache, deleteDataCache, reloadSync };
}
