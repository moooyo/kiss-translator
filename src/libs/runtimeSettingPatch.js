import { KV_SETTING_KEY } from "../config/storage";
import { mergeSettingPatch } from "./settingPatch";
import {
  getSettingWithDefault,
  putSyncMeta,
  setSetting as persistSetting,
} from "./storage";

let operationQueue = Promise.resolve();

function enqueueOperation(task) {
  const result = operationQueue.then(task);
  operationQueue = result.catch(() => undefined);
  return result;
}

export async function applyRuntimeSettingPatch(
  { patch = {} } = {},
  dependencies = {}
) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new TypeError("Runtime setting patch must be an object");
  }

  const getSetting = dependencies.getSetting || getSettingWithDefault;
  const setSetting = dependencies.setSetting || persistSetting;
  const markSyncMeta = dependencies.markSyncMeta || putSyncMeta;

  return enqueueOperation(async () => {
    const currentSetting = await getSetting();
    const mergedSetting = mergeSettingPatch(currentSetting, patch);
    await setSetting(mergedSetting);
    await markSyncMeta(KV_SETTING_KEY);
    return { setting: mergedSetting };
  });
}
