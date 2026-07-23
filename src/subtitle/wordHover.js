import { apiMicrosoftDict } from "../apis/index.js";
import { logger } from "../libs/log.js";
import { trustedTypesHelper } from "../libs/trustedTypes.js";
import {
  createM3CssVariableDeclarations,
  resolveM3Colors,
} from "../styles/m3.js";

/**
 * 动态向网页 document.head 中注入生词 hover 及详情气泡弹窗所需的 CSS 样式
 */
export const addWordHoverStyles = ({
  brandColor = "blue",
  darkMode = "auto",
} = {}) => {
  const lightColors = resolveM3Colors("light", brandColor);
  const darkColors = resolveM3Colors("dark", brandColor);
  const baseColors = darkMode === "dark" ? darkColors : lightColors;
  const baseVariables = createM3CssVariableDeclarations(baseColors);
  const autoDarkStyles =
    darkMode === "auto"
      ? `
    @media (prefers-color-scheme: dark) {
      .kiss-word-tooltip { ${createM3CssVariableDeclarations(darkColors)} }
      .kiss-word-hover { background: ${darkColors.primaryContainer}; }
    }`
      : "";

  const style =
    document.getElementById("kiss-word-hover-styles") ||
    document.createElement("style");
  style.id = "kiss-word-hover-styles";
  style.textContent = `
    /* 鼠标 hover 的单词样式：呈现下划线，指示可点击查词 */
    .kiss-word-hover {
      cursor: pointer;
      border-radius: 5px;
      background: ${baseColors.primaryContainer};
      text-decoration: none;
    }

    /* 查词气泡弹窗主体样式 */
    .kiss-word-tooltip {
      ${baseVariables}
      position: fixed;
      background: var(--kt-sf0);
      color: var(--kt-on);
      border-radius: 16px;
      padding: 12px 14px;
      font-size: 13px;
      z-index: 2147483647;
      max-width: 240px;
      word-wrap: break-word;
      box-shadow: 0 4px 8px 3px rgba(0,0,0,.1), 0 1px 3px rgba(0,0,0,.18);
      border: 1px solid var(--kt-linev);
      font-family: "Google Sans Flex", "Noto Sans SC", system-ui, sans-serif;
    }

    /* Tooltip header */
    .kiss-word-tooltip-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-weight: bold;
      font-size: 16px;
      color: var(--kt-on);
    }

    .kiss-word-tooltip-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      margin-left: 10px;
      border: none;
      border-radius: 50%;
      background: none;
      color: var(--kt-onv);
      font-size: 18px;
      cursor: pointer;
    }

    .kiss-word-tooltip-close:hover {
      background: var(--kt-sf2);
      color: var(--kt-on);
    }

    /* 释义加载中状态文案 */
    .kiss-word-loading {
      color: var(--kt-onv);
      font-style: italic;
    }

    /* 单词词性释义行 */
    .kiss-word-definition {
      margin: 4px 0;
    }

    /* 词性前缀标记（如 n. / v. 等） */
    .kiss-word-pos {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 999px;
      background: var(--kt-terc);
      color: var(--kt-onterc);
      font-weight: 700;
    }

    /* 音标字符样式 */
    .kiss-word-phonetic {
      color: var(--kt-onv);
      font-style: italic;
      margin-right: 10px;
    }

    /* 例句包裹区 */
    .kiss-word-example {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid var(--kt-linev);
    }

    .kiss-word-example-title {
      font-weight: bold;
      margin-bottom: 5px;
    }

    /* 例句英文正文 */
    .kiss-word-example-sentence {
      margin-bottom: 3px;
    }

    /* 例句中文翻译 */
    .kiss-word-example-translation {
      color: var(--kt-onv);
      font-style: italic;
    }

    ${autoDarkStyles}
  `;
  if (!style.isConnected) document.head.appendChild(style);
};

/**
 * 使用正则表达式，将英文字幕文本中的每一个独立英文单词（包括带单引号/撇号的如 it's）使用 span 标签包裹。
 *
 * @param {string} text - 原文字幕字符串
 * @returns {string} 替换为带 span 标签的 HTML 字符串
 */
export function wrapWordsWithSpans(text) {
  return String(text || "").replace(
    /\b([a-zA-Z]+(?:'[a-zA-Z]+)?)\b/g,
    '<span class="kiss-subtitle-word" data-word="$1">$1</span>'
  );
}

export class WordTooltipController {
  constructor({ getVideoContainer, getTimestamp }) {
    this.getVideoContainer = getVideoContainer;
    this.getTimestamp = getTimestamp;
    this.tooltipEl = null;
    this.hoverTimeout = null;
    this.activeWordEl = null;
    this.lookupRequestId = 0;
    this.spanListeners = new Map();
  }

  attachSpanListeners(root, getTimestamp = this.getTimestamp) {
    if (!root) return;

    const spans = Array.from(root.querySelectorAll(".kiss-subtitle-word"));
    spans.forEach((span) => {
      const existingRecord = this.spanListeners.get(span);
      if (existingRecord) {
        existingRecord.getTimestamp = getTimestamp;
        existingRecord.root = root;
        return;
      }

      const record = {
        getTimestamp,
        root,
      };
      const enterHandler = (event) =>
        this.#handleWordHover(event, record.getTimestamp);
      const leaveHandler = (event) => this.#handleWordHoverOut(event);
      record.handlers = {
        enterHandler,
        leaveHandler,
      };

      span.addEventListener("pointerenter", enterHandler);
      span.addEventListener("pointerleave", leaveHandler);
      this.spanListeners.set(span, record);
    });
  }

  pruneDetachedSpanListeners() {
    this.spanListeners.forEach((record, span) => {
      if (!span.isConnected || !record.root.contains(span)) {
        this.#detachSpanListeners(span, record);
      }
    });
  }

  destroy() {
    this.clearHoverState();
    this.spanListeners.forEach((record, span) => {
      this.#detachSpanListeners(span, record);
    });
    this.spanListeners.clear();
  }

  clearHoverState() {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    this.hideWordTooltip();
  }

  #detachSpanListeners(span, record) {
    if (span === this.activeWordEl) {
      this.clearHoverState();
    }
    const { enterHandler, leaveHandler } = record.handlers;
    span.removeEventListener("pointerenter", enterHandler);
    span.removeEventListener("pointerleave", leaveHandler);
    this.spanListeners.delete(span);
  }

  #handleWordHover(event, getTimestamp) {
    const target = event.target;
    if (!target.classList.contains("kiss-subtitle-word")) return;

    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }

    target.classList.add("kiss-word-hover");
    this.activeWordEl = target;

    this.hoverTimeout = setTimeout(() => {
      this.showWordTooltip(target.dataset.word, {
        timestamp: getTimestamp?.() ?? 0,
      });
    }, 300);
  }

  #handleWordHoverOut(event) {
    const target = event.target;
    if (!target.classList.contains("kiss-subtitle-word")) return;

    target.classList.remove("kiss-word-hover");
    if (this.activeWordEl === target) {
      this.activeWordEl = null;
    }

    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }

    this.hoverTimeout = setTimeout(() => {
      this.hideWordTooltip();
    }, 100);
  }

  async showWordTooltip(word, { timestamp = 0 } = {}) {
    const requestId = ++this.lookupRequestId;
    if (this.tooltipEl) {
      this.tooltipEl.remove();
    }

    const tooltipEl = document.createElement("div");
    this.tooltipEl = tooltipEl;
    tooltipEl.className = "kiss-word-tooltip";
    tooltipEl.innerHTML = trustedTypesHelper.createHTML(
      '<div class="kiss-word-loading">Looking up...</div>'
    );
    tooltipEl.addEventListener("click", (event) => {
      if (event.target.closest?.(".kiss-word-tooltip-close")) {
        this.hideWordTooltip();
      }
    });

    const videoContainer = this.getVideoContainer?.();
    if (videoContainer) {
      const containerRect = videoContainer.getBoundingClientRect();
      const tooltipWidth = 240;
      const tooltipHeight = 320;

      const left = containerRect.right - tooltipWidth - 45;
      const top = containerRect.top + 20;

      const maxLeft = window.innerWidth - tooltipWidth - 10;
      tooltipEl.style.left = Math.min(maxLeft, Math.max(10, left)) + "px";
      tooltipEl.style.top = Math.max(10, top) + "px";
      tooltipEl.style.maxWidth = tooltipWidth + "px";
      tooltipEl.style.maxHeight = tooltipHeight + "px";
      tooltipEl.style.overflow = "auto";
    }

    document.body.appendChild(tooltipEl);

    try {
      const dictResult = await apiMicrosoftDict(word);
      if (requestId !== this.lookupRequestId || this.tooltipEl !== tooltipEl) {
        return;
      }
      const { phonetic, definition, examples } =
        this.#extractDictionaryData(dictResult);

      this.#dispatchAddWord({
        word,
        phonetic,
        definition,
        examples,
        timestamp,
      });
      this.#renderDictionaryResult(word, dictResult);
    } catch (error) {
      if (requestId !== this.lookupRequestId || this.tooltipEl !== tooltipEl) {
        return;
      }
      logger.info("Dictionary lookup failed for word:", word, error);
      this.#dispatchAddWord({
        word,
        phonetic: "",
        definition: "",
        examples: [],
        timestamp,
      });

      if (this.tooltipEl) {
        this.tooltipEl.innerHTML =
          trustedTypesHelper.createHTML(`<div class="kiss-word-tooltip-header">
        <span>${word}</span>
        <button type="button" class="kiss-word-tooltip-close">×</button>
      </div>
      <div class="kiss-word-definition">Failed to load definition</div>`);
      }
    }
  }

  hideWordTooltip() {
    this.lookupRequestId += 1;
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
    }
    this.activeWordEl?.classList.remove("kiss-word-hover");
    this.activeWordEl = null;
  }

  #extractDictionaryData(dictResult) {
    let phonetic = "";
    if (dictResult && dictResult.aus) {
      const usPhonetic = dictResult.aus.find((au) => au.key === "美");
      if (usPhonetic && usPhonetic.phonetic) {
        phonetic = usPhonetic.phonetic;
      } else if (dictResult.aus.length > 0 && dictResult.aus[0].phonetic) {
        phonetic = dictResult.aus[0].phonetic;
      }
    }

    let definition = "";
    if (dictResult && dictResult.trs) {
      definition = dictResult.trs
        .slice(0, 3)
        .map((tr) => `${tr.pos ? tr.pos + " " : ""}${tr.def}`)
        .join("; ");
    }

    let examples = [];
    if (dictResult && dictResult.sentences) {
      examples = dictResult.sentences.slice(0, 2).map((sentence) => ({
        eng: sentence.eng,
        chs: sentence.chs,
      }));
    }

    return { phonetic, definition, examples };
  }

  #dispatchAddWord(detail) {
    document.dispatchEvent(new CustomEvent("kiss-add-word", { detail }));
  }

  #renderDictionaryResult(word, dictResult) {
    if (
      dictResult &&
      (dictResult.trs || dictResult.aus || dictResult.sentences)
    ) {
      let content = `<div class="kiss-word-tooltip-header">
          <span>${word}</span>
          <button type="button" class="kiss-word-tooltip-close">×</button>
        </div>`;

      if (dictResult.aus && dictResult.aus.length > 0) {
        content += "<div>";
        dictResult.aus.forEach((au) => {
          if (au.phonetic) {
            content += `<span class="kiss-word-phonetic">${au.phonetic}</span>`;
          }
        });
        content += "</div>";
      }

      if (dictResult.trs) {
        dictResult.trs.slice(0, 3).forEach((tr) => {
          content += `<div class="kiss-word-definition">${tr.pos ? '<span class="kiss-word-pos">' + tr.pos + "</span> " : ""}${tr.def}</div>`;
        });
      }

      if (dictResult.sentences && dictResult.sentences.length > 0) {
        content += `<div class="kiss-word-example">
            <div class="kiss-word-example-title">例句</div>`;
        dictResult.sentences.slice(0, 2).forEach((sentence) => {
          content += `<div class="kiss-word-example-sentence">${sentence.eng}</div>
              <div class="kiss-word-example-translation">${sentence.chs}</div>`;
        });
        content += "</div>";
      }

      if (this.tooltipEl) {
        this.tooltipEl.innerHTML = trustedTypesHelper.createHTML(content);
      }
      return;
    }

    if (this.tooltipEl) {
      this.tooltipEl.innerHTML =
        trustedTypesHelper.createHTML(`<div class="kiss-word-tooltip-header">
          <span>${word}</span>
          <button type="button" class="kiss-word-tooltip-close">×</button>
        </div>
        <div class="kiss-word-definition">No definition found</div>`);
    }
  }
}
