import React from "react";
import ReactDOM from "react-dom/client";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { logger } from "./log";
import { isolateShadowHost, setShadowHostVisible } from "./shadowHost";

/**
 * 把任意 id 规整成 Emotion 能接受的 cache key。
 *
 * Emotion 只允许小写字母和连字符 —— 传进数字会直接抛
 * "Emotion key must only contain lower case alphabetical characters and -"，
 * 而 ShadowDomManager 捕获后只记一条 warn，表现是整个组件**静默挂不上**。
 * 应用名里带数字（KISS-Translator-M3）就会踩到，所以在这里统一兜住，
 * 而不是让每个调用方各自记得。
 *
 * @param {string} key 原始 key（默认是宿主元素 id）
 * @returns {string} 只含 [a-z-] 的 key
 */
export function toEmotionCacheKey(key) {
  const sanitized = String(key || "")
    .toLowerCase()
    .replace(/[^a-z-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "kiss";
}

export default class ShadowDomManager {
  #hostElement = null;
  #reactRoot = null;
  #isVisible = false;
  #isProcessing = false;

  _id;
  _className;
  _cacheKey;
  _ReactComponent;
  _props;

  constructor({
    id,
    className = "",
    cacheKey = id,
    reactComponent,
    props = {},
    rootElement = document.documentElement,
  }) {
    if (!id || !reactComponent) {
      throw new Error("ID and a React Component must be provided.");
    }
    this._id = id;
    this._className = className;
    this._cacheKey = toEmotionCacheKey(cacheKey);
    this._ReactComponent = reactComponent;
    this._props = props;
    this._rootElement = rootElement;
  }

  get isVisible() {
    return this.#isVisible;
  }

  /**
   * 显示组件
   * // REVIEW: 热更新 props 失效漏洞。
   * // 如果组件当前已被挂载且处于隐藏状态，此时调用 `show(props)` 并传入了新的 props，
   * // 由于 `this.#hostElement` 已经存在，执行流会直接跳过 `#mount()` 重新挂载渲染的过程，
   * // 仅仅同步修改样式为显示状态 `this.#hostElement.style.display = ""`。
   * // 这导致新传入的 `props` 根本没有应用并渲染到界面上，仍然只显示先前挂载时的旧属性值。
   * @param {Object} props - 可选的新 props
   */
  show(props) {
    if (this.#isVisible || this.#isProcessing) {
      return;
    }

    if (!this.#hostElement) {
      this.#isProcessing = true;
      try {
        this.#mount(props || this._props);
      } catch (error) {
        logger.warn(`Failed to mount component with id "${this._id}":`, error);
        this.#isProcessing = false;
        return;
      } finally {
        this.#isProcessing = false;
      }
    }

    setShadowHostVisible(this.#hostElement, true);
    this.#isVisible = true;
  }

  hide() {
    if (!this.#isVisible || !this.#hostElement) {
      return;
    }
    setShadowHostVisible(this.#hostElement, false);
    this.#isVisible = false;
  }

  destroy() {
    if (!this.#hostElement) {
      return;
    }
    this.#isProcessing = true;

    if (this.#reactRoot) {
      this.#reactRoot.unmount();
    }

    this.#hostElement.remove();

    this.#hostElement = null;
    this.#reactRoot = null;
    this.#isVisible = false;
    this.#isProcessing = false;
    logger.info(`Component with id "${this._id}" has been destroyed.`);
  }

  toggle(props) {
    if (this.#isVisible) {
      this.hide();
    } else {
      this.show(props || this._props);
    }
  }

  #mount(props) {
    const host = document.createElement("div");
    host.id = this._id;
    if (this._className) {
      host.className = this._className;
    }
    isolateShadowHost(host);

    this._rootElement.appendChild(host);
    this.#hostElement = host;
    const shadowContainer = host.attachShadow({ mode: "open" });
    const appRoot = document.createElement("div");
    appRoot.className = `${this._id}_wrapper notranslate`;
    shadowContainer.appendChild(appRoot);

    const cache = createCache({
      key: this._cacheKey,
      prepend: true,
      container: shadowContainer,
    });

    const enhancedProps = {
      ...props,
      onClose: this.hide.bind(this),
    };

    const ComponentToRender = this._ReactComponent;
    this.#reactRoot = ReactDOM.createRoot(appRoot);
    this.#reactRoot.render(
      <React.StrictMode>
        <CacheProvider value={cache}>
          <ComponentToRender {...enhancedProps} />
        </CacheProvider>
      </React.StrictMode>
    );
  }
}
