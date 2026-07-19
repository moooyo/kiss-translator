import { run } from "./common";
import { browser } from "./libs/browser";

// 标记全局运行上下文为 "content"，辅助 getContext() 判断运行宿主
globalThis.__KISS_CONTEXT__ = "content";

const runtimeOrigin = browser?.runtime?.getURL?.("") || "default";
const runtimeMarker = `__KISS_CONTENT_RUNTIME__${runtimeOrigin}`;

// 动态补注入可能与声明式 content script 同时触发；同一扩展运行时只启动一次。
if (!globalThis[runtimeMarker]) {
  globalThis[runtimeMarker] = true;
  run().catch((error) => {
    delete globalThis[runtimeMarker];
    console.error("[KISS-Translator] Failed to start content runtime", error);
  });
}
