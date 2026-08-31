import { YouTubeSubtitleList } from "./YouTubeSubtitleList";
import { apiMicrosoftDict } from "../apis/index.js";
import { EVENT_FAVORITE_WORD_CHANGE } from "../config";

jest.mock("../libs/storage.js", () => ({
  getSettingWithDefault: jest.fn(() => Promise.resolve({ darkMode: "light" })),
  getWordsWithDefault: jest.fn(),
  setWords: jest.fn(),
  debounceSyncMeta: jest.fn(),
}));

jest.mock("../apis/index.js", () => ({
  apiMicrosoftDict: jest.fn(),
}));

function createVideoElement({ playerHeight = 360 } = {}) {
  document.body.innerHTML = '<div id="secondary-inner"></div>';
  let currentPlayerHeight = playerHeight;
  const player = document.createElement("div");
  player.className = "html5-video-player";
  player.getBoundingClientRect = () => ({ height: currentPlayerHeight });
  const video = document.createElement("video");

  Object.defineProperty(video, "paused", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(video, "currentTime", {
    value: 0,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(video, "play", {
    value: jest.fn(() => Promise.resolve()),
    configurable: true,
  });
  Object.defineProperty(video, "__setPlayerHeight", {
    value: (height) => {
      currentPlayerHeight = height;
    },
  });

  player.appendChild(video);
  document.body.appendChild(player);
  return video;
}

const subtitle = {
  start: 0,
  end: 1000,
  text: "hello world",
  translation: "你好世界",
};

let favoriteWords = {};

function renderVisibleSubtitleItems(manager) {
  manager.subtitleListEl.getClientRects = () => [{ width: 320, height: 300 }];
  Object.defineProperty(manager.subtitleScrollContainer, "clientHeight", {
    value: 300,
    configurable: true,
  });
  manager._renderVirtualSubtitles(true);
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("YouTubeSubtitleList", () => {
  beforeEach(() => {
    apiMicrosoftDict.mockReset();
    const storage = require("../libs/storage.js");
    favoriteWords = {};
    storage.getWordsWithDefault.mockImplementation(() =>
      Promise.resolve(favoriteWords)
    );
    storage.setWords.mockImplementation((words) => {
      favoriteWords = words;
      return Promise.resolve();
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("renders panel controls with i18n text", async () => {
    const videoEl = createVideoElement();
    const i18n = jest.fn(
      (key) =>
        ({
          bilingual_subtitles: "Bilingual subtitles",
          vocabulary_book: "Vocabulary",
          download_subtitles_vtt: "Download subtitles (VTT)",
          download_raw_subtitle_events_json: "Download source data (JSON)",
          close: "Close panel",
        })[key] || ""
    );
    const manager = new YouTubeSubtitleList(videoEl, i18n);

    manager.initialize([subtitle], [], 75);

    const buttons = Array.from(document.querySelectorAll("button"));
    expect(buttons.map((button) => button.textContent)).toEqual(
      expect.arrayContaining([
        "Bilingual subtitles [75%]",
        "Vocabulary",
        "Download subtitles (VTT)",
        "Download source data (JSON)",
      ])
    );
    const closeButton = buttons.find((button) => button.textContent === "×");
    expect(closeButton.type).toBe("button");
    expect(closeButton.title).toBe("Close panel");
    expect(closeButton.getAttribute("aria-label")).toBe("Close panel");

    await flushPromises();
    manager.destroy();
  });

  test("exposes accessible tab semantics and supports arrow key navigation", async () => {
    const videoEl = createVideoElement();
    const manager = new YouTubeSubtitleList(videoEl, (key) => {
      if (key === "bilingual_subtitles") return "Bilingual subtitles";
      if (key === "vocabulary_book") return "Vocabulary";
      return "";
    });

    manager.initialize([subtitle], [], 100);

    const tablist = document.querySelector('[role="tablist"]');
    const subtitleTab = document.getElementById("kiss-youtube-subtitles-tab");
    const vocabularyTab = document.getElementById(
      "kiss-youtube-vocabulary-tab"
    );
    const subtitlePanel = document.getElementById("kiss-youtube-subtitle-list");
    const vocabularyPanel = document.getElementById(
      "kiss-youtube-vocabulary-list"
    );
    const focusStyle = document.querySelector(
      "#kiss-youtube-subtitle-list-container style"
    );

    expect(tablist).not.toBeNull();
    expect(Array.from(tablist.children)).toEqual([subtitleTab, vocabularyTab]);
    expect(focusStyle.textContent).toContain(".kiss-youtube-tab:focus-visible");
    expect(focusStyle.textContent).toContain(
      "outline: 2px solid var(--kt-primary)"
    );
    expect(subtitleTab.getAttribute("role")).toBe("tab");
    expect(vocabularyTab.getAttribute("role")).toBe("tab");
    expect(subtitleTab.getAttribute("aria-controls")).toBe(subtitlePanel.id);
    expect(vocabularyTab.getAttribute("aria-controls")).toBe(
      vocabularyPanel.id
    );
    expect(subtitlePanel.getAttribute("role")).toBe("tabpanel");
    expect(vocabularyPanel.getAttribute("role")).toBe("tabpanel");
    expect(subtitlePanel.getAttribute("aria-labelledby")).toBe(subtitleTab.id);
    expect(vocabularyPanel.getAttribute("aria-labelledby")).toBe(
      vocabularyTab.id
    );
    expect(subtitlePanel.tabIndex).toBe(-1);
    expect(vocabularyPanel.tabIndex).toBe(-1);
    expect(manager.subtitleScrollContainer.tabIndex).toBe(0);
    expect(manager.subtitleScrollContainer.getAttribute("aria-label")).toBe(
      "Bilingual subtitles"
    );
    expect(vocabularyPanel.lastElementChild.tabIndex).toBe(0);
    expect(vocabularyPanel.lastElementChild.getAttribute("aria-label")).toBe(
      "Vocabulary"
    );
    expect(subtitleTab.style.fontWeight).toBe("600");
    expect(vocabularyTab.style.fontWeight).toBe("600");
    expect(subtitleTab.style.transition).toContain("color 160ms ease");
    expect(subtitleTab.style.transition).toContain("border-color 160ms ease");
    expect(subtitleTab.style.outline).toBe("");
    expect(vocabularyTab.style.outline).toBe("");
    expect(subtitleTab.getAttribute("aria-selected")).toBe("true");
    expect(vocabularyTab.getAttribute("aria-selected")).toBe("false");
    expect(subtitleTab.tabIndex).toBe(0);
    expect(vocabularyTab.tabIndex).toBe(-1);
    expect(subtitlePanel.hidden).toBe(false);
    expect(vocabularyPanel.hidden).toBe(true);

    subtitleTab.focus();
    const arrowRight = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    subtitleTab.dispatchEvent(arrowRight);

    expect(arrowRight.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(vocabularyTab);
    expect(subtitleTab.getAttribute("aria-selected")).toBe("false");
    expect(vocabularyTab.getAttribute("aria-selected")).toBe("true");
    expect(subtitleTab.tabIndex).toBe(-1);
    expect(vocabularyTab.tabIndex).toBe(0);
    expect(subtitlePanel.hidden).toBe(true);
    expect(vocabularyPanel.hidden).toBe(false);

    vocabularyTab.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        bubbles: true,
        cancelable: true,
      })
    );
    expect(document.activeElement).toBe(subtitleTab);
    expect(subtitleTab.getAttribute("aria-selected")).toBe("true");

    await flushPromises();
    manager.destroy();
  });

  test("notifies its owner when the close control destroys the panel", () => {
    const onClose = jest.fn();
    const videoEl = createVideoElement();
    const manager = new YouTubeSubtitleList(videoEl, () => "", { onClose });
    manager.initialize([subtitle], [], 100);

    const closeButton = Array.from(
      manager.container.querySelectorAll("button")
    ).find((button) => button.textContent === "×");
    closeButton.click();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(manager.container).toBeNull();
  });

  test("uses interpolable colors for subtitle download button states", async () => {
    const storage = require("../libs/storage.js");
    storage.getSettingWithDefault.mockResolvedValueOnce({ darkMode: "dark" });
    const videoEl = createVideoElement();
    const manager = new YouTubeSubtitleList(videoEl);

    manager.initialize([subtitle], [], 100);
    await flushPromises();

    const buttons = Array.from(
      document.querySelectorAll("#kiss-youtube-subtitle-list button")
    ).filter((button) => button.style.transition.includes("background-color"));
    expect(buttons).toHaveLength(3);
    buttons.forEach((button) => {
      expect(button.style.transition).toContain("background-color 220ms ease");
      button.dispatchEvent(new MouseEvent("mouseenter"));
      const hoverColor = button.style.backgroundColor;
      expect(hoverColor).not.toBe("");
      button.dispatchEvent(new MouseEvent("mouseleave"));
      expect(button.style.backgroundColor).not.toBe("");
      expect(button.style.backgroundColor).not.toBe(hoverColor);
    });
    expect(manager.container.style.getPropertyValue("--kt-btn-bg")).not.toMatch(
      /gradient/
    );
    expect(
      manager.container.style.getPropertyValue("--kt-btn-hover-bg")
    ).not.toMatch(/gradient/);

    manager.destroy();
  });

  test("matches the subtitle panel height to the YouTube player", async () => {
    const videoEl = createVideoElement({ playerHeight: 420 });
    const manager = new YouTubeSubtitleList(videoEl);

    manager.initialize([subtitle], [], 100);

    const container = document.getElementById(
      "kiss-youtube-subtitle-list-container"
    );
    expect(container.style.height).toBe("420px");
    expect(container.style.maxHeight).toBe("420px");

    videoEl.__setPlayerHeight(360);
    window.dispatchEvent(new Event("resize"));

    expect(container.style.height).toBe("360px");
    expect(container.style.maxHeight).toBe("360px");

    await flushPromises();
    manager.destroy();
  });

  test("adds hover lookup spans to original text when enabled", async () => {
    const videoEl = createVideoElement();
    const manager = new YouTubeSubtitleList(videoEl, () => "", {
      enableHoverLookup: true,
    });

    manager.initialize([subtitle], [], 100);
    renderVisibleSubtitleItems(manager);

    expect(
      Array.from(
        document.querySelectorAll(".kiss-youtube-original .kiss-subtitle-word")
      ).map((node) => node.textContent)
    ).toEqual(["hello", "world"]);
    const words = Array.from(
      document.querySelectorAll(".kiss-youtube-original .kiss-subtitle-word")
    );
    expect(words.every((node) => node.getAttribute("role") === "button")).toBe(
      true
    );
    expect(words.every((node) => node.tabIndex === 0)).toBe(true);

    await flushPromises();
    manager.destroy();
  });

  test("looks up hovered list words and records the subtitle start timestamp", async () => {
    jest.useFakeTimers();
    apiMicrosoftDict.mockResolvedValue({
      aus: [{ key: "美", phonetic: "/redi/" }],
      trs: [{ pos: "adj.", def: "准备好的" }],
      sentences: [{ eng: "ready to go", chs: "准备出发" }],
    });
    const videoEl = createVideoElement();
    const manager = new YouTubeSubtitleList(videoEl, () => "", {
      enableHoverLookup: true,
    });
    const addWordHandler = jest.fn();
    document.addEventListener("kiss-add-word", addWordHandler);

    manager.initialize(
      [{ ...subtitle, start: 33000, text: "ready to go" }],
      [],
      100
    );
    renderVisibleSubtitleItems(manager);
    document
      .querySelector(".kiss-subtitle-word")
      .dispatchEvent(new Event("pointerenter"));
    jest.advanceTimersByTime(300);
    await apiMicrosoftDict.mock.results[0].value;
    await flushPromises();
    await Promise.resolve();

    expect(apiMicrosoftDict).toHaveBeenCalledWith("ready");
    expect(addWordHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          word: "ready",
          timestamp: 33000,
          definition: "adj. 准备好的",
        }),
      })
    );

    const storage = require("../libs/storage.js");
    const favoriteButton = document.querySelector(".kiss-favorite-word-button");
    expect(storage.setWords).not.toHaveBeenCalled();
    expect(favoriteButton.getAttribute("aria-pressed")).toBe("false");

    favoriteButton.click();
    await flushPromises();

    expect(storage.setWords).toHaveBeenCalledWith({
      ready: expect.objectContaining({
        phonetic: "/redi/",
        definition: "adj. 准备好的",
      }),
    });
    expect(storage.setWords.mock.calls[0][0].ready.timestamp).toBeUndefined();

    document.removeEventListener("kiss-add-word", addWordHandler);
    manager.destroy();
    jest.useRealTimers();
  });

  test("automatically favorites successful hovered word lookups when enabled", async () => {
    jest.useFakeTimers();
    apiMicrosoftDict.mockResolvedValue({
      aus: [{ key: "美", phonetic: "/redi/" }],
      trs: [{ pos: "adj.", def: "准备好的" }],
      sentences: [{ eng: "ready to go", chs: "准备出发" }],
    });
    const storage = require("../libs/storage.js");
    const videoEl = createVideoElement();
    const manager = new YouTubeSubtitleList(videoEl, () => "", {
      enableHoverLookup: true,
      autoFavWord: true,
    });

    manager.initialize(
      [{ ...subtitle, start: 33000, text: "ready to go" }],
      [],
      100
    );
    renderVisibleSubtitleItems(manager);
    document
      .querySelector(".kiss-subtitle-word")
      .dispatchEvent(new Event("pointerenter"));
    jest.advanceTimersByTime(300);
    await apiMicrosoftDict.mock.results[0].value;
    await flushPromises();

    expect(storage.setWords).toHaveBeenCalledWith({
      ready: expect.objectContaining({
        phonetic: "/redi/",
        definition: "adj. 准备好的",
        examples: [{ eng: "ready to go", chs: "准备出发" }],
      }),
    });
    expect(storage.setWords.mock.calls[0][0].ready.timestamp).toBeUndefined();

    manager.destroy();
    jest.useRealTimers();
  });

  test("toggles a vocabulary item's global favorite state", async () => {
    const storage = require("../libs/storage.js");
    const handleFavoriteChange = jest.fn();
    document.addEventListener(EVENT_FAVORITE_WORD_CHANGE, handleFavoriteChange);
    const videoEl = createVideoElement();
    const manager = new YouTubeSubtitleList(videoEl);
    const item = {
      word: "ready",
      timestamp: 33000,
      phonetic: "/redi/",
      definition: "adj. 准备好的",
      examples: [{ eng: "ready to go", chs: "准备出发" }],
    };

    manager.initialize([subtitle], [], 100);
    manager.addWord(
      item.word,
      item.phonetic,
      item.definition,
      item.examples,
      item.timestamp
    );
    manager._renderVocabulary();
    const button = document.querySelector(".kiss-favorite-word-button");

    await flushPromises();
    expect(button.style.marginLeft).toBe("auto");
    expect(button.getAttribute("aria-pressed")).toBe("false");

    button.click();
    await flushPromises();

    expect(storage.setWords).toHaveBeenCalledWith({
      ready: expect.objectContaining({
        phonetic: "/redi/",
        definition: "adj. 准备好的",
        examples: item.examples,
      }),
    });
    expect(storage.setWords.mock.calls[0][0].ready.timestamp).toBeUndefined();
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(handleFavoriteChange).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { word: "ready", isFavorite: true },
      })
    );

    manager.destroy();
    document.removeEventListener(
      EVENT_FAVORITE_WORD_CHANGE,
      handleFavoriteChange
    );
  });

  test("clears word tooltip when the subtitle list scrolls away from the hovered word", async () => {
    jest.useFakeTimers();
    apiMicrosoftDict.mockResolvedValue({
      trs: [{ pos: "adj.", def: "准备好的" }],
    });
    const videoEl = createVideoElement();
    const manager = new YouTubeSubtitleList(videoEl, () => "", {
      enableHoverLookup: true,
    });

    manager.initialize([{ ...subtitle, text: "ready to go" }], [], 100);
    renderVisibleSubtitleItems(manager);
    const word = document.querySelector(".kiss-subtitle-word");

    word.dispatchEvent(new Event("pointerenter"));
    jest.advanceTimersByTime(300);
    await apiMicrosoftDict.mock.results[0].value;
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector(".kiss-word-tooltip")).not.toBeNull();
    expect(word.classList.contains("kiss-word-hover")).toBe(true);

    manager.subtitleScrollContainer.dispatchEvent(new Event("scroll"));

    expect(document.querySelector(".kiss-word-tooltip")).toBeNull();
    expect(word.classList.contains("kiss-word-hover")).toBe(false);

    manager.destroy();
  });

  test("jumps only when clicking the time label", async () => {
    const videoEl = createVideoElement();
    const manager = new YouTubeSubtitleList(videoEl);

    manager.initialize([{ ...subtitle, start: 33000 }], [], 100);
    renderVisibleSubtitleItems(manager);

    document.querySelector(".kiss-youtube-original").click();
    expect(videoEl.currentTime).toBe(0);

    const timeButton = document.querySelector(".kiss-youtube-item button");
    expect(timeButton.type).toBe("button");
    timeButton.click();
    expect(videoEl.currentTime).toBe(33);

    await Promise.resolve();
    await Promise.resolve();
    manager.destroy();
  });
});
