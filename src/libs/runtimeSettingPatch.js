import { MSG_RUNTIME_SETTING_PATCH } from "../config";
import { browser } from "./browser";
import { getCurTabId } from "./msg";
import { mergeSettingPatch } from "./settingPatch";
import { getSettingWithDefault, setSetting as persistSetting } from "./storage";

export async function applyRuntimeSettingPatch(
  { patch = {}, scope = "all" } = {},
  sender,
  dependencies = {}
) {
  const getSetting = dependencies.getSetting || getSettingWithDefault;
  const setSetting = dependencies.setSetting || persistSetting;
  const getActiveTabId = dependencies.getActiveTabId || getCurTabId;
  const queryTabs =
    dependencies.queryTabs || ((query) => browser.tabs.query(query));
  const sendTabMessage =
    dependencies.sendTabMessage ||
    ((tabId, message) => browser.tabs.sendMessage(tabId, message));

  const currentSetting = await getSetting();
  const nextSetting = mergeSettingPatch(currentSetting, patch);
  await setSetting(nextSetting);

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
    delivered: results.filter((result) => result.status === "fulfilled").length,
    attempted: results.length,
  };
}
