import { MSG_TRANS_GETRULE } from "../../config";
import { browser } from "../../libs/browser";
import { getCurTab, sendTabMsg, sendTopFrameMsg } from "../../libs/msg";

const sleep = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const hasPopupData = (response) =>
  !!response && !response.error && !!response.rule && !!response.setting;

const canInjectIntoTab = (tab) =>
  Number.isInteger(tab?.id) && /^(https?|file):/i.test(tab?.url || "");

async function trySend(sendMessage) {
  try {
    return await sendMessage();
  } catch (_error) {
    return undefined;
  }
}

async function resolvePopupData(
  response,
  sendFallbackMessage = () => sendTabMsg(MSG_TRANS_GETRULE)
) {
  if (response != null) return response;

  // A blocked top-level page can still contain an enabled child frame.
  // Prefer the top frame whenever it responds, including explicit errors.
  const fallback = await trySend(sendFallbackMessage);
  return hasPopupData(fallback) ? fallback : response;
}

export async function queryPopupData() {
  return resolvePopupData(
    await trySend(() => sendTopFrameMsg(MSG_TRANS_GETRULE))
  );
}

export async function loadPopupData({
  sendMessage = () => sendTopFrameMsg(MSG_TRANS_GETRULE),
  sendFallbackMessage = () => sendTabMsg(MSG_TRANS_GETRULE),
  getTab = getCurTab,
  executeScript = (details) => browser?.scripting?.executeScript(details),
  wait = sleep,
} = {}) {
  let response = await trySend(sendMessage);
  if (hasPopupData(response)) return response;

  await wait(80);
  response = await trySend(sendMessage);
  if (hasPopupData(response)) return response;

  let tab;
  try {
    tab = await getTab();
  } catch (_error) {}

  if (!canInjectIntoTab(tab))
    return resolvePopupData(response, sendFallbackMessage);

  try {
    const injection = executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["content.js"],
    });
    if (!injection) return resolvePopupData(response, sendFallbackMessage);
    await injection;
  } catch (_error) {
    return resolvePopupData(response, sendFallbackMessage);
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    await wait(100);
    response = await trySend(sendMessage);
    if (hasPopupData(response)) return response;
  }

  return resolvePopupData(response, sendFallbackMessage);
}
