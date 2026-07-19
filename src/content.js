import { run } from "./common";
import { browser, isExtensionContextInvalidatedError } from "./libs/browser";

// 标记全局运行上下文为 "content"，辅助 getContext() 判断运行宿主
globalThis.__KISS_CONTEXT__ = "content";

let runtimeOrigin = "default";
let runtimeAvailable = true;
try {
  runtimeOrigin = browser?.runtime?.getURL?.("") || runtimeOrigin;
} catch (error) {
  if (!isExtensionContextInvalidatedError(error)) throw error;
  runtimeAvailable = false;
}
const runtimeMarker = `__KISS_CONTENT_RUNTIME__${runtimeOrigin}`;

// 动态补注入可能与声明式 content script 同时触发；同一扩展运行时只启动一次。
if (runtimeAvailable && !globalThis[runtimeMarker]) {
  globalThis[runtimeMarker] = true;
  run().catch((error) => {
    delete globalThis[runtimeMarker];
    if (isExtensionContextInvalidatedError(error)) return;
    console.error("[KISS-Translator] Failed to start content runtime", error);
  });
}
