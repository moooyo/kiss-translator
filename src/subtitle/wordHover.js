import { apiMicrosoftDict } from "../apis/index.js";
import { logger } from "../libs/log.js";
import { trustedTypesHelper } from "../libs/trustedTypes.js";
import {
  createFavoriteButton,
  saveFavoriteWordIfMissing,
} from "./favoriteWords.js";

/**
 * 动态向网页 document.head 中注入生词 hover 及详情气泡弹窗所需的 CSS 样式
 */
export const addWordHoverStyles = () => {
  // 如果已经注入过该样式表，直接返回，避免重复创建
  if (document.getElementById("kiss-word-hover-styles")) return;

  const style = document.createElement("style");
  style.id = "kiss-word-hover-styles";
  style.textContent = `
    /* 鼠标 hover 的单词样式：呈现下划线，指示可点击查词 */
    .kiss-word-hover {
      cursor: pointer;
      text-decoration: underline;
      text-decoration-color: #4fc3f7;
      text-decoration-thickness: 2px;
    }

    .kiss-subtitle-word {
      padding: 0;
      border-radius: 2px;
      outline: none;
    }

    .kiss-subtitle-word:focus-visible {
      box-shadow: 0 0 0 2px #4fc3f7;
      text-decoration: underline;
      text-decoration-color: #4fc3f7;
      text-decoration-thickness: 2px;
    }

    /* 查词气泡弹窗主体样式 */
    .kiss-word-tooltip {
      position: fixed;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      border-radius: 6px;
      padding: 12px;
      font-size: 14px;
      z-index: 2147483647;
      max-width: 300px;
      word-wrap: break-word;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      font-family: Arial, sans-serif;
    }

    /* 气泡弹窗头部（包含单词名和关闭按钮） */
    .kiss-word-tooltip-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-weight: bold;
      font-size: 16px;
      color: #4fc3f7;
    }

    /* 关闭气泡弹窗的 X 按钮 */
    .kiss-word-tooltip-close {
      background: none;
      border: none;
      color: #aaa;
      cursor: pointer;
      font-size: 18px;
      padding: 0;
      margin-left: 10px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 160ms ease, color 160ms ease;
    }

    .kiss-word-tooltip-close:hover,
    .kiss-word-tooltip-close:focus-visible {
      color: white;
      background: rgba(255, 255, 255, 0.1);
    }

    /* 释义加载中状态文案 */
    .kiss-word-loading {
      color: #bbb;
      font-style: italic;
    }

    /* 单词词性释义行 */
    .kiss-word-definition {
      margin: 4px 0;
    }

    /* 词性前缀标记（如 n. / v. 等） */
    .kiss-word-pos {
      color: #4fc3f7;
      font-weight: bold;
    }

    /* 音标字符样式 */
    .kiss-word-phonetic {
      color: #bbb;
      font-style: italic;
      margin-right: 10px;
    }

    /* 例句包裹区 */
    .kiss-word-example {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #444;
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
      color: #bbb;
      font-style: italic;
    }
  `;
  document.head.appendChild(style);
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
    '<span class="kiss-subtitle-word" data-word="$1" role="button" tabindex="0">$1</span>'
  );
}

/**
 * 判断词典结果里是否真的有可展示的内容。
 *
 * trs / aus / sentences 由 apiMicrosoftDict 以 `const trs = []` 起头再 push 填充，
 * 因此「查到词条但没有释义」返回的是空数组——而空数组是真值，直接用 `||` 串联
 * 会把查无结果判成查到了：既渲染出一个没有内容的释义框，也会把空词条自动收藏。
 *
 * @param {Object|null} dictResult 词典接口返回值
 * @returns {boolean} 是否含有可展示内容
 */
function hasDictionaryPayload(dictResult) {
  if (!dictResult) return false;
  return [dictResult.trs, dictResult.aus, dictResult.sentences].some((field) =>
    Array.isArray(field) ? field.length > 0 : Boolean(field)
  );
}

// 悬停多久才弹提示框。短了会在扫读时乱弹。
const TOOLTIP_OPEN_DELAY = 300;

// 提示框**不随鼠标离开而收起**。
//
// 它里面有收藏和关闭两个按钮,所以它是 popover 而不是 hover card。而它固定
// 显示在播放器右上角、字幕在底部中间 —— 鼠标要跨半个播放器才够得着。
// 早先靠「离开后 N 毫秒收起」来留出这段时间,那是在赌用户能在超时前走到:
// 播放器多大、鼠标多快都会翻盘,实测就是点不到。
//
// 现在只有这四件事会收起它,都与时间无关:
//   1. 点 ×
//   2. 点提示框以外的地方
//   3. 悬停另一个单词(换成新的)
//   4. 字幕管理器销毁

export class WordTooltipController {
  constructor({
    getVideoContainer,
    getTimestamp,
    autoFavWord = false,
    i18n = () => "",
    onTooltipOpenChange,
  } = {}) {
    this.getVideoContainer = getVideoContainer;
    this.getTimestamp = getTimestamp;
    this.autoFavWord = autoFavWord;
    this.i18n = i18n;
    // 提示框开着的时候通知外面:字幕管理器据此决定要不要恢复播放 ——
    // 用户正在读释义时把视频放走,等于让字幕从他眼皮底下跑掉。
    this.onTooltipOpenChange = onTooltipOpenChange;
    this.tooltipEl = null;
    this.hoverTimeout = null;
    this.activeWordEl = null;
    this.dismissListener = null;
    this.tooltipTriggerEl = null;
  }

  /**
   * 在 document 上装一次性的「点外面就关」监听。
   *
   * 提示框既然不会自己消失,就必须留一个不用瞄准 × 的退出口 ——
   * 否则用户点到别处时它会一直挂在画面上。
   *
   * @returns {void}
   */
  #listenForOutsideDismiss() {
    this.#stopListeningForOutsideDismiss();
    this.dismissListener = (event) => {
      if (this.tooltipEl?.contains(event.target)) return;
      this.hideWordTooltip();
    };
    // 捕获阶段:页面自己的处理器可能会 stopPropagation
    document.addEventListener("pointerdown", this.dismissListener, true);
  }

  #stopListeningForOutsideDismiss() {
    if (!this.dismissListener) return;
    document.removeEventListener("pointerdown", this.dismissListener, true);
    this.dismissListener = null;
  }

  attachSpanListeners(root, getTimestamp = this.getTimestamp) {
    if (!root) return;

    const spans = root.querySelectorAll(".kiss-subtitle-word");
    spans.forEach((span) => {
      if (span.dataset.kissListenerAttached) return;
      span.setAttribute("role", "button");
      span.tabIndex = 0;
      const enterHandler = (event) =>
        this.#handleWordHover(event, getTimestamp);
      const leaveHandler = (event) => this.#handleWordHoverOut(event);
      const keyHandler = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (event.repeat) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        this.showWordTooltip(span.dataset.word, {
          timestamp: getTimestamp?.() ?? 0,
          trigger: span,
        });
      };
      span.addEventListener("pointerenter", enterHandler);
      span.addEventListener("pointerleave", leaveHandler);
      span.addEventListener("keydown", keyHandler);
      span.dataset.kissListenerAttached = "1";
    });
  }

  destroy() {
    this.clearHoverState();
  }

  clearHoverState() {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    this.activeWordEl?.classList.remove("kiss-word-hover");
    this.activeWordEl = null;
    this.hideWordTooltip();
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
    }, TOOLTIP_OPEN_DELAY);
  }

  #handleWordHoverOut(event) {
    const target = event.target;
    if (!target.classList.contains("kiss-subtitle-word")) return;

    target.classList.remove("kiss-word-hover");
    if (this.activeWordEl === target) {
      this.activeWordEl = null;
    }

    // 还没弹出来就取消,已经弹出来的**留着** —— 用户正要走过去点它。
    if (!this.tooltipEl && this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }

  async showWordTooltip(word, { timestamp = 0, trigger = null } = {}) {
    if (this.tooltipEl) {
      this.tooltipEl.remove();
    }

    // 本次查词创建的气泡必须用局部变量持有。await 期间用户可能已经移到别的词上，
    // 那时 this.tooltipEl 指向的是新词的气泡 —— 慢响应若直接写 this.tooltipEl，
    // 会把上一个词的标题、释义和收藏按钮整个画进当前这个词的气泡里。
    // 所以下面每一处 DOM 写入之前都要先比对身份。
    const tooltipEl = document.createElement("div");
    this.tooltipEl = tooltipEl;
    this.tooltipTriggerEl = trigger;
    tooltipEl.className = "kiss-word-tooltip";
    tooltipEl.setAttribute("role", "dialog");
    tooltipEl.setAttribute("aria-label", word);
    tooltipEl.setAttribute("aria-busy", "true");
    tooltipEl.tabIndex = -1;
    tooltipEl.innerHTML = trustedTypesHelper.createHTML(
      '<div class="kiss-word-loading" role="status" aria-live="polite">Looking up...</div>'
    );

    // 关闭按钮用事件委托，不能写成内联 onclick：所有 innerHTML 都要过
    // trustedTypesHelper.createHTML，而它的两条分支都是无配置的
    // DOMPurify.sanitize，会把 on* 属性一律剥掉。监听器挂在 tooltip 元素
    // 自身，随元素一起销毁，无需手动解绑。
    tooltipEl.addEventListener("click", (event) => {
      if (event.target?.closest?.(".kiss-word-tooltip-close")) {
        this.hideWordTooltip({ restoreFocus: true });
      }
    });
    tooltipEl.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      this.hideWordTooltip({ restoreFocus: true });
    });

    const videoContainer = this.getVideoContainer?.();
    if (videoContainer) {
      const containerRect = videoContainer.getBoundingClientRect();
      const tooltipWidth = 300;
      const tooltipHeight = 400;

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
    if (trigger) tooltipEl.focus();
    this.#listenForOutsideDismiss();
    this.onTooltipOpenChange?.(true);

    try {
      const dictResult = await apiMicrosoftDict(word);
      const { phonetic, definition, examples } =
        this.#extractDictionaryData(dictResult);

      // 落生词表与气泡是否还在无关：用户确实查了这个词，晚到的结果也该收录。
      // 因此身份守卫只挡 DOM 写入，不挡这里。
      this.#dispatchAddWord({
        word,
        phonetic,
        definition,
        examples,
        timestamp,
      });
      const wordData = { timestamp, phonetic, definition, examples };
      const hasDictionaryResult = hasDictionaryPayload(dictResult);
      if (this.autoFavWord && hasDictionaryResult) {
        // 收藏写存储失败不该掉进外层 catch —— 那会把一次成功的查词
        // 显示成 "Failed to load definition"。
        try {
          await saveFavoriteWordIfMissing(word, wordData);
        } catch (error) {
          logger.info("Failed to save favorite subtitle word:", word, error);
        }
      }
      if (this.tooltipEl !== tooltipEl) return;
      this.#renderDictionaryResult(word, dictResult, wordData);
      tooltipEl.setAttribute("aria-busy", "false");
    } catch (error) {
      logger.info("Dictionary lookup failed for word:", word, error);
      this.#dispatchAddWord({
        word,
        phonetic: "",
        definition: "",
        examples: [],
        timestamp,
      });

      if (this.tooltipEl !== tooltipEl) return;
      this.tooltipEl.innerHTML =
        trustedTypesHelper.createHTML(`<div class="kiss-word-tooltip-header">
        <span>${word}</span>
        <button type="button" class="kiss-word-tooltip-close">×</button>
      </div>
      <div class="kiss-word-definition">Failed to load definition</div>`);
      this.#addFavoriteButton(word, { timestamp });
      tooltipEl.setAttribute("aria-busy", "false");
    }
  }

  hideWordTooltip({ restoreFocus = false } = {}) {
    this.#stopListeningForOutsideDismiss();
    const trigger = this.tooltipTriggerEl;
    this.tooltipTriggerEl = null;
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
      // 必须通知,否则「提示框开着」的状态会一直挂着,视频再也不会自己恢复。
      this.onTooltipOpenChange?.(false);
    }
    if (restoreFocus && trigger?.isConnected) trigger.focus();
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

  #addFavoriteButton(word, data) {
    const header = this.tooltipEl?.querySelector(".kiss-word-tooltip-header");
    const closeButton = header?.querySelector(".kiss-word-tooltip-close");
    if (!header || !closeButton) return;

    const closeLabel = this.i18n("close") || "Close";
    closeButton.setAttribute("aria-label", closeLabel);
    closeButton.title = closeLabel;

    header.insertBefore(
      createFavoriteButton({ word, data, i18n: this.i18n }),
      closeButton
    );
  }

  #renderDictionaryResult(word, dictResult, wordData) {
    if (hasDictionaryPayload(dictResult)) {
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
        this.#addFavoriteButton(word, wordData);
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
      this.#addFavoriteButton(word, wordData);
    }
  }
}
