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
    }

    .kiss-word-tooltip-close:hover {
      color: white;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
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
    '<span class="kiss-subtitle-word" data-word="$1">$1</span>'
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

// 离开单词后多久收起提示框。
//
// 这里必须给足鼠标**走过去**的时间:提示框固定显示在播放器右上角,而字幕在
// 底部中间,一次移动要跨半个播放器。原来是 100ms —— 走不到,所以提示框里的
// 收藏和关闭两个按钮**从来就点不到**,不是「× 坏了」而是根本够不着。
// 指针一旦进入提示框,这个计时器就会被取消(见 showWordTooltip)。
const TOOLTIP_HIDE_DELAY = 500;

export class WordTooltipController {
  constructor({
    getVideoContainer,
    getTimestamp,
    autoFavWord = false,
    i18n = () => "",
    onTooltipHoverChange,
  } = {}) {
    this.getVideoContainer = getVideoContainer;
    this.getTimestamp = getTimestamp;
    this.autoFavWord = autoFavWord;
    this.i18n = i18n;
    // 指针是否停在提示框上。字幕管理器用它决定要不要恢复播放 ——
    // 用户正在读释义时把视频放走,等于让字幕从他眼皮底下跑掉。
    this.onTooltipHoverChange = onTooltipHoverChange;
    this.tooltipEl = null;
    this.hoverTimeout = null;
    this.activeWordEl = null;
  }

  /**
   * 安排收起提示框,可被指针重新进入取消。
   * @returns {void}
   */
  #scheduleHideTooltip() {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    this.hoverTimeout = setTimeout(() => {
      this.hideWordTooltip();
    }, TOOLTIP_HIDE_DELAY);
  }

  attachSpanListeners(root, getTimestamp = this.getTimestamp) {
    if (!root) return;

    const spans = root.querySelectorAll(".kiss-subtitle-word");
    spans.forEach((span) => {
      if (span.dataset.kissListenerAttached) return;
      const enterHandler = (event) =>
        this.#handleWordHover(event, getTimestamp);
      const leaveHandler = (event) => this.#handleWordHoverOut(event);
      span.addEventListener("pointerenter", enterHandler);
      span.addEventListener("pointerleave", leaveHandler);
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

    this.#scheduleHideTooltip();
  }

  async showWordTooltip(word, { timestamp = 0 } = {}) {
    if (this.tooltipEl) {
      this.tooltipEl.remove();
    }

    // 本次查词创建的气泡必须用局部变量持有。await 期间用户可能已经移到别的词上，
    // 那时 this.tooltipEl 指向的是新词的气泡 —— 慢响应若直接写 this.tooltipEl，
    // 会把上一个词的标题、释义和收藏按钮整个画进当前这个词的气泡里。
    // 所以下面每一处 DOM 写入之前都要先比对身份。
    const tooltipEl = document.createElement("div");
    this.tooltipEl = tooltipEl;
    tooltipEl.className = "kiss-word-tooltip";
    tooltipEl.innerHTML = trustedTypesHelper.createHTML(
      '<div class="kiss-word-loading">Looking up...</div>'
    );

    // 关闭按钮用事件委托，不能写成内联 onclick：所有 innerHTML 都要过
    // trustedTypesHelper.createHTML，而它的两条分支都是无配置的
    // DOMPurify.sanitize，会把 on* 属性一律剥掉。监听器挂在 tooltip 元素
    // 自身，随元素一起销毁，无需手动解绑。
    tooltipEl.addEventListener("click", (event) => {
      if (event.target?.closest?.(".kiss-word-tooltip-close")) {
        this.hideWordTooltip();
      }
    });

    // 指针停在提示框上时不能收起它 —— 否则收藏和关闭两个按钮永远够不着:
    // 离开单词就启动了收起计时器,而提示框在播放器另一头。
    // 同时通知外面别恢复播放,不然用户刚要点,字幕就从眼皮底下跑掉了。
    tooltipEl.addEventListener("pointerenter", () => {
      if (this.hoverTimeout) {
        clearTimeout(this.hoverTimeout);
        this.hoverTimeout = null;
      }
      this.onTooltipHoverChange?.(true);
    });

    tooltipEl.addEventListener("pointerleave", () => {
      this.#scheduleHideTooltip();
      this.onTooltipHoverChange?.(false);
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
    }
  }

  hideWordTooltip() {
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
      // 提示框没了,指针当然也就不在它上面 —— 不通知的话,
      // 「按住不放」的状态会一直挂着,视频再也不会自己恢复。
      this.onTooltipHoverChange?.(false);
    }
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
