import { KV_SETTING_KEY, MSG_RUNTIME_SETTING_PATCH } from "../config";
import { browser } from "./browser";
import { getCurTabId } from "./msg";
import { mergeSettingPatch } from "./settingPatch";
import {
  debounceSyncMeta,
  getSettingWithDefault,
  setSetting as persistSetting,
} from "./storage";

let operationQueue = Promise.resolve();

function enqueueOperation(task) {
  const result = operationQueue.then(task);
  operationQueue = result.catch(() => undefined);
  return result;
}

export async function applyRuntimeSettingPatch(
  { patch = {}, scope = "all" } = {},
  sender,
  dependencies = {}
) {
  const getSetting = dependencies.getSetting || getSettingWithDefault;
  const setSetting = dependencies.setSetting || persistSetting;
  const markSyncMeta = dependencies.markSyncMeta || debounceSyncMeta;
  const getActiveTabId = dependencies.getActiveTabId || getCurTabId;
  const queryTabs =
    dependencies.queryTabs || ((query) => browser.tabs.query(query));
  const sendTabMessage =
    dependencies.sendTabMessage ||
    ((tabId, message) => browser.tabs.sendMessage(tabId, message));

  // The patch always updates the global default. Scope controls only which
  // already-open tabs receive the live update; other tabs keep session state
  // until their next runtime start.
  return enqueueOperation(async () => {
    const currentSetting = await getSetting();
    const mergedSetting = mergeSettingPatch(currentSetting, patch);
    await setSetting(mergedSetting);
    await markSyncMeta(KV_SETTING_KEY);
    await dependencies.onPersisted?.(mergedSetting, patch);

    let tabs;
    if (scope === "current") {
      const tabId = sender?.tab?.id ?? (await getActiveTabId());
      tabs = Number.isInteger(tabId) ? [{ id: tabId }] : [];
    } else {
      tabs = await queryTabs({});
    }

    const message = {
      action: MSG_RUNTIME_SETTING_PATCH,
      args: { patch },
    };
    const results = await Promise.allSettled(
      tabs
        .filter((tab) => Number.isInteger(tab.id))
        .map((tab) => sendTabMessage(tab.id, message))
    );
    return {
      delivered: results.filter((result) => result.status === "fulfilled")
        .length,
      attempted: results.length,
    };
  });
}
