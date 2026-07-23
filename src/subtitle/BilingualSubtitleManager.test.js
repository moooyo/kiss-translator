import { BilingualSubtitleManager } from "./BilingualSubtitleManager";
import { apiMicrosoftDict, apiTranslate } from "../apis/index.js";

jest.mock("../apis/index.js", () => ({
  apiTranslate: jest.fn(),
  apiMicrosoftDict: jest.fn(),
}));

jest.mock("../libs/log.js", () => ({
  LogLevel: {
    INFO: { value: "info" },
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

/**
 * 创建一个可由测试主动 resolve/reject 的 Promise。
 *
 * @returns {{promise: Promise<unknown>, resolve: Function, reject: Function}} 可控 Promise。
 */
function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * 构造 YouTube 播放器附近的最小 DOM 结构。
 *
 * @returns {HTMLVideoElement} 测试用 video 节点。
 */
function createVideoElement({ playerHeight = 400 } = {}) {
  document.body.innerHTML = "";
  const outer = document.createElement("div");
  outer.className = "html5-video-player ytp-autohide";
  const inner = document.createElement("div");
  const video = document.createElement("video");
  const controlBar = document.createElement("div");
  controlBar.className = "ytp-left-controls";
  controlBar.style.height = "40px";

  Object.defineProperty(video, "currentTime", {
    value: 0,
    writable: true,
  });
  Object.defineProperty(outer, "clientHeight", {
    value: playerHeight,
    configurable: true,
  });

  inner.appendChild(video);
  outer.appendChild(inner);
  outer.appendChild(controlBar);
  document.body.appendChild(outer);
  return video;
}

function mockVideoPlayback(videoEl, { paused }) {
  let isPaused = paused;
  Object.defineProperty(videoEl, "paused", {
    configurable: true,
    get: () => isPaused,
  });
  videoEl.pause = jest.fn(() => {
    isPaused = true;
  });
  videoEl.play = jest.fn(() => {
    isPaused = false;
    return Promise.resolve();
  });
}

const subtitle = {
  start: 0,
  end: 1000,
  text: "hello world",
  translation: "",
};

const setting = {
  fromLang: "en",
  toLang: "zh-CN",
  apiSetting: {
    apiSlug: "openai",
    apiType: "OpenAI",
    useStream: true,
  },
  docInfo: {},
  preTrans: 90,
  throttleTrans: 0,
  windowStyle: "",
  originStyle: "",
  translationStyle: "",
  isBilingual: true,
  blurTranslation: false,
  hoverLookupMode: "off",
  enhanceMode: "off",
};

function getCaptionLines() {
  return Array.from(document.querySelectorAll(".kiss-caption-window p")).map(
    (node) => node.textContent
  );
}

function getCaptionBottom() {
  return parseFloat(document.querySelector(".kiss-caption-paper").style.bottom);
}

function setControlBarVisible(videoEl, isVisible) {
  const player = videoEl.closest(".html5-video-player");
  player.classList.toggle("ytp-autohide", !isVisible);
}

async function waitForMutationObserver() {
  await Promise.resolve();
}

describe("BilingualSubtitleManager", () => {
  beforeEach(() => {
    apiTranslate.mockReset();
    apiMicrosoftDict.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("renders original subtitle before translation by default", () => {
    const videoEl = createVideoElement();
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "你好世界" }],
      setting,
    });

    manager.start();

    expect(getCaptionLines()).toEqual(["hello world", "你好世界"]);
    manager.destroy();
  });

  test("applies updated subtitle window styles immediately", () => {
    const videoEl = createVideoElement();
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "你好世界" }],
      setting,
    });

    manager.start();
    manager.updateSetting({
      windowStyle: "background: transparent; border-radius: 16px;",
    });

    const captionWindow = document.querySelector(".kiss-caption-window");
    expect(captionWindow.style.background).toBe("transparent");
    expect(captionWindow.style.borderRadius).toBe("16px");
    expect(captionWindow.style.pointerEvents).toBe("auto");
    manager.destroy();
  });

  test("applies and updates the subtitle font scale immediately", () => {
    const videoEl = createVideoElement();
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "你好世界" }],
      setting: {
        ...setting,
        fontScale: 150,
        originStyle: "font-size: 20px;",
        translationStyle: "font-size: 10px;",
      },
    });

    manager.start();
    const paper = document.querySelector(".kiss-caption-paper");
    const captionWindow = document.querySelector(".kiss-caption-window");
    paper.style.left = "72px";
    paper.style.bottom = "88px";
    let lines = document.querySelectorAll(".kiss-caption-window p");
    expect(lines[0].style.fontSize).toBe("30px");
    expect(lines[1].style.fontSize).toBe("15px");

    manager.updateSetting({ fontScale: 80 });
    lines = document.querySelectorAll(".kiss-caption-window p");
    expect(lines[0].style.fontSize).toBe("16px");
    expect(lines[1].style.fontSize).toBe("8px");
    expect(document.querySelector(".kiss-caption-paper")).toBe(paper);
    expect(document.querySelector(".kiss-caption-window")).toBe(captionWindow);
    expect(paper.style.left).toBe("72px");
    expect(paper.style.bottom).toBe("88px");
    manager.destroy();
  });

  test("enables and disables hover lookup without recreating the manager", async () => {
    jest.useFakeTimers();
    apiMicrosoftDict.mockResolvedValue({
      trs: [{ pos: "n.", def: "a greeting" }],
    });
    const videoEl = createVideoElement();
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "translated hello" }],
      setting,
    });

    manager.start();
    const paper = document.querySelector(".kiss-caption-paper");
    manager.updateSetting({ hoverLookupMode: "on" });

    const word = document.querySelector(".kiss-subtitle-word");
    expect(word).not.toBeNull();
    word.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    jest.advanceTimersByTime(300);
    await Promise.resolve();
    expect(apiMicrosoftDict).toHaveBeenCalledWith("hello");
    expect(document.querySelector(".kiss-caption-paper")).toBe(paper);

    manager.updateSetting({ hoverLookupMode: "off" });
    expect(document.querySelector(".kiss-subtitle-word")).toBeNull();
    expect(document.querySelector(".kiss-caption-paper")).toBe(paper);
    manager.destroy();
  });

  test("applies hover playback changes without recreating the caption window", () => {
    const videoEl = createVideoElement();
    mockVideoPlayback(videoEl, { paused: false });
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "translated hello" }],
      setting,
    });

    manager.start();
    const captionWindow = document.querySelector(".kiss-caption-window");
    captionWindow.dispatchEvent(new Event("pointerenter"));
    expect(videoEl.pause).not.toHaveBeenCalled();

    manager.updateSetting({ hoverLookupMode: "on" });
    captionWindow.dispatchEvent(new Event("pointerenter"));
    expect(videoEl.pause).toHaveBeenCalledTimes(1);
    captionWindow.dispatchEvent(new Event("pointerleave"));
    expect(videoEl.play).toHaveBeenCalledTimes(1);

    captionWindow.dispatchEvent(new Event("pointerenter"));
    expect(videoEl.pause).toHaveBeenCalledTimes(2);
    manager.updateSetting({ hoverLookupMode: "off" });
    expect(videoEl.play).toHaveBeenCalledTimes(2);
    captionWindow.dispatchEvent(new Event("pointerenter"));
    expect(videoEl.pause).toHaveBeenCalledTimes(2);
    expect(document.querySelector(".kiss-caption-window")).toBe(captionWindow);
    manager.destroy();
  });

  test("resumes video on destroy when hover lookup paused it", () => {
    const videoEl = createVideoElement();
    mockVideoPlayback(videoEl, { paused: false });
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "translated hello" }],
      setting: { ...setting, hoverLookupMode: "on" },
    });

    manager.start();
    document
      .querySelector(".kiss-caption-window")
      .dispatchEvent(new Event("pointerenter"));
    expect(videoEl.pause).toHaveBeenCalledTimes(1);

    manager.destroy();
    expect(videoEl.play).toHaveBeenCalledTimes(1);
  });

  test("does not play a video that was already paused before hover", () => {
    const videoEl = createVideoElement();
    mockVideoPlayback(videoEl, { paused: true });
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "translated hello" }],
      setting: { ...setting, hoverLookupMode: "on" },
    });

    manager.start();
    document
      .querySelector(".kiss-caption-window")
      .dispatchEvent(new Event("pointerenter"));
    manager.updateSetting({ hoverLookupMode: "off" });
    manager.destroy();

    expect(videoEl.pause).not.toHaveBeenCalled();
    expect(videoEl.play).not.toHaveBeenCalled();
  });

  test("renders hover lookup word spans when enabled", () => {
    const videoEl = createVideoElement();
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "你好世界" }],
      setting: { ...setting, hoverLookupMode: "on" },
    });

    manager.start();

    expect(
      Array.from(document.querySelectorAll(".kiss-subtitle-word")).map(
        (node) => node.textContent
      )
    ).toEqual(["hello", "world"]);
    manager.destroy();
  });

  test("opens subtitle word lookup after the hover delay", async () => {
    jest.useFakeTimers();
    apiMicrosoftDict.mockResolvedValue({
      trs: [{ pos: "n.", def: "a greeting" }],
    });
    const videoEl = createVideoElement();
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "你好世界" }],
      setting: { ...setting, hoverLookupMode: "on" },
    });

    manager.start();
    document
      .querySelector(".kiss-subtitle-word")
      .dispatchEvent(new Event("pointerenter", { bubbles: true }));
    jest.advanceTimersByTime(300);
    jest.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(apiMicrosoftDict).toHaveBeenCalledWith("hello");
    expect(document.querySelector(".kiss-word-tooltip").textContent).toContain(
      "a greeting"
    );
    manager.destroy();
  });

  test("reconciles word listeners after replacing the caption rows", () => {
    jest.useFakeTimers();
    apiMicrosoftDict.mockResolvedValue({ trs: [{ def: "definition" }] });
    const videoEl = createVideoElement();
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [
        {
          ...subtitle,
          text: "first row",
          translation: "translated first row",
        },
        {
          ...subtitle,
          start: 1500,
          end: 3000,
          text: "second row",
          translation: "translated second row",
        },
      ],
      setting: { ...setting, hoverLookupMode: "on" },
    });

    manager.start();
    const detachedWord = document.querySelector(".kiss-subtitle-word");
    videoEl.currentTime = 2;
    videoEl.dispatchEvent(new Event("timeupdate"));
    const currentWord = document.querySelector(".kiss-subtitle-word");

    detachedWord.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    currentWord.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    jest.advanceTimersByTime(300);

    expect(apiMicrosoftDict).toHaveBeenCalledTimes(1);
    expect(apiMicrosoftDict).toHaveBeenCalledWith("second");
    manager.destroy();
  });

  test("renders translation before original when display order is translation first", () => {
    const videoEl = createVideoElement();
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "你好世界" }],
      setting: { ...setting, displayOrder: "translation-first" },
    });

    manager.start();

    expect(getCaptionLines()).toEqual(["你好世界", "hello world"]);
    manager.destroy();
  });

  test("renders only translation when bilingual display is disabled", () => {
    const videoEl = createVideoElement();
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "你好世界" }],
      setting: {
        ...setting,
        isBilingual: false,
        displayOrder: "translation-first",
      },
    });

    manager.start();

    expect(getCaptionLines()).toEqual(["你好世界"]);
    manager.destroy();
  });

  test("updates current subtitle and list callback with streaming translation chunk", async () => {
    const deferred = createDeferred();
    apiTranslate.mockImplementation(({ onStreamChunk }) => {
      // 单句翻译流式 chunk 到达时，应立即刷新当前字幕和侧边栏更新事件。
      onStreamChunk({ text: "部分译文", isComplete: false });
      return deferred.promise;
    });

    const videoEl = createVideoElement();
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle }],
      setting,
    });
    manager.onSubtitleUpdate = jest.fn();

    manager.start();
    await Promise.resolve();

    expect(
      document.querySelector(".kiss-caption-window").textContent
    ).toContain("部分译文");
    expect(manager.onSubtitleUpdate).toHaveBeenCalledWith({
      start: 0,
      end: 1000,
      text: "hello world",
      translation: "部分译文",
    });

    deferred.resolve({ trText: "最终译文" });
    await deferred.promise;
    await Promise.resolve();

    expect(
      document.querySelector(".kiss-caption-window").textContent
    ).toContain("最终译文");

    manager.destroy();
  });

  test("repairs failed chunk translations immediately", async () => {
    const deferred = createDeferred();
    apiTranslate.mockReturnValue(deferred.promise);

    const videoEl = createVideoElement();
    const failedSubtitle = {
      ...subtitle,
      translation: "[Translation failed]",
    };
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [failedSubtitle],
      setting,
    });

    manager.repairChunkTranslations([failedSubtitle]);

    expect(apiTranslate).toHaveBeenCalledTimes(1);
    expect(apiTranslate).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "hello world",
        fromLang: "en",
        toLang: "zh-CN",
        apiSetting: expect.objectContaining(setting.apiSetting),
      })
    );

    deferred.resolve({ trText: "修复译文" });
    await deferred.promise;
    manager.destroy();
  });

  test("does not repair untranslated chunk subtitles immediately", () => {
    const videoEl = createVideoElement();
    const untranslatedSubtitle = {
      ...subtitle,
      translation: "",
    };
    const missingTranslationSubtitle = {
      start: 1000,
      end: 2000,
      text: "missing translation",
    };
    const draftSubtitle = {
      ...subtitle,
      start: 2000,
      end: 3000,
      translation: "draft translation",
      _isDraftTranslation: true,
    };
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [
        untranslatedSubtitle,
        missingTranslationSubtitle,
        draftSubtitle,
      ],
      setting,
    });

    manager.repairChunkTranslations([
      untranslatedSubtitle,
      missingTranslationSubtitle,
      draftSubtitle,
    ]);

    expect(apiTranslate).not.toHaveBeenCalled();
    manager.destroy();
  });

  test("streams repaired chunk translations to caption and list callback", async () => {
    const deferred = createDeferred();
    apiTranslate.mockImplementation(({ onStreamChunk }) => {
      onStreamChunk({ text: "补翻中", isComplete: false });
      return deferred.promise;
    });

    const videoEl = createVideoElement();
    const failedSubtitle = {
      ...subtitle,
      translation: "[Translation failed]",
    };
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [failedSubtitle],
      setting,
    });
    manager.onSubtitleUpdate = jest.fn();

    manager.start();
    manager.repairChunkTranslations([failedSubtitle]);
    await Promise.resolve();

    expect(
      document.querySelector(".kiss-caption-window").textContent
    ).toContain("补翻中");
    expect(manager.onSubtitleUpdate).toHaveBeenCalledWith({
      start: 0,
      end: 1000,
      text: "hello world",
      translation: "补翻中",
    });

    deferred.resolve({ trText: "补翻完成" });
    await deferred.promise;
    await Promise.resolve();

    expect(
      document.querySelector(".kiss-caption-window").textContent
    ).toContain("补翻完成");

    manager.destroy();
  });

  test("skips chunk subtitles that are already translating", () => {
    const videoEl = createVideoElement();
    const translatingSubtitle = {
      ...subtitle,
      translation: "[Translation failed]",
      isTranslating: true,
    };
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [translatingSubtitle],
      setting,
    });

    manager.repairChunkTranslations([translatingSubtitle]);

    expect(apiTranslate).not.toHaveBeenCalled();
    manager.destroy();
  });

  test("reports playback lookahead window for lazy AI segmentation", () => {
    const videoEl = createVideoElement();
    const onSubtitleTimeWindow = jest.fn();
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "浣犲ソ涓栫晫" }],
      setting: {
        ...setting,
        preTrans: 45,
        onSubtitleTimeWindow,
      },
    });

    manager.start();
    expect(onSubtitleTimeWindow).toHaveBeenCalledWith({
      currentTimeMs: 0,
      preTrans: 45,
    });

    videoEl.currentTime = 12;
    manager.onTimeUpdate();

    expect(onSubtitleTimeWindow).toHaveBeenLastCalledWith({
      currentTimeMs: 12000,
      preTrans: 45,
    });
    manager.destroy();
  });

  test("floats low captions above visible player controls and sinks back when hidden", async () => {
    const videoEl = createVideoElement({ playerHeight: 400 });
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "你好世界" }],
      setting,
    });

    manager.start();
    expect(getCaptionBottom()).toBe(20);

    setControlBarVisible(videoEl, true);
    await waitForMutationObserver();
    expect(getCaptionBottom()).toBe(60);

    setControlBarVisible(videoEl, false);
    await waitForMutationObserver();
    expect(getCaptionBottom()).toBe(20);

    manager.destroy();
  });

  test("keeps high captions fixed when player controls toggle", async () => {
    const videoEl = createVideoElement({ playerHeight: 1600 });
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "你好世界" }],
      setting,
    });

    manager.start();
    expect(getCaptionBottom()).toBe(80);

    setControlBarVisible(videoEl, true);
    await waitForMutationObserver();
    expect(getCaptionBottom()).toBe(80);

    setControlBarVisible(videoEl, false);
    await waitForMutationObserver();
    expect(getCaptionBottom()).toBe(80);

    manager.destroy();
  });

  test("does not treat a click without movement as a drag position update", () => {
    const videoEl = createVideoElement({ playerHeight: 400 });
    setControlBarVisible(videoEl, true);
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "你好世界" }],
      setting,
    });

    manager.start();
    const handle = document.querySelector(".kiss-caption-window");

    expect(getCaptionBottom()).toBe(60);

    handle.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, clientY: 100 })
    );
    document.dispatchEvent(new MouseEvent("mouseup", { clientY: 100 }));

    expect(getCaptionBottom()).toBe(60);

    manager.destroy();
  });

  test("keeps the caption horizontally centered while dragging vertically", () => {
    const videoEl = createVideoElement({ playerHeight: 400 });
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "你好世界" }],
      setting,
    });

    manager.start();
    const paper = document.querySelector(".kiss-caption-paper");
    const container = document.querySelector(".kiss-caption-container");
    const handle = document.querySelector(".kiss-caption-window");

    Object.defineProperty(container, "clientHeight", {
      value: 400,
      configurable: true,
    });
    Object.defineProperty(paper, "offsetHeight", {
      value: 40,
      configurable: true,
    });
    container.getBoundingClientRect = () => ({ bottom: 400 });
    paper.getBoundingClientRect = () => ({ bottom: 380 });

    handle.dispatchEvent(
      new MouseEvent("mousedown", {
        button: 0,
        clientX: 100,
        clientY: 100,
      })
    );
    document.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 180, clientY: 130 })
    );

    expect(paper.style.left).toBe("50%");
    expect(paper.style.transform).toBe("translateX(-50%)");
    expect(getCaptionBottom()).toBe(0);

    document.dispatchEvent(
      new MouseEvent("mouseup", { clientX: 180, clientY: 130 })
    );
    manager.destroy();
  });

  test("treats dragged position as the hidden-controls bottom and floats after drag ends", async () => {
    const videoEl = createVideoElement({ playerHeight: 400 });
    setControlBarVisible(videoEl, true);
    const manager = new BilingualSubtitleManager({
      videoEl,
      formattedSubtitles: [{ ...subtitle, translation: "你好世界" }],
      setting,
    });

    manager.start();
    const paper = document.querySelector(".kiss-caption-paper");
    const container = document.querySelector(".kiss-caption-container");
    const handle = document.querySelector(".kiss-caption-window");

    Object.defineProperty(container, "clientHeight", {
      value: 400,
      configurable: true,
    });
    Object.defineProperty(paper, "offsetHeight", {
      value: 40,
      configurable: true,
    });
    container.getBoundingClientRect = () => ({ bottom: 400 });
    paper.getBoundingClientRect = () => ({
      bottom: 400 - getCaptionBottom(),
    });

    expect(getCaptionBottom()).toBe(60);

    handle.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, clientY: 100 })
    );
    document.dispatchEvent(new MouseEvent("mousemove", { clientY: 130 }));

    expect(getCaptionBottom()).toBe(30);

    document.dispatchEvent(new MouseEvent("mouseup", { clientY: 130 }));

    expect(getCaptionBottom()).toBe(70);

    setControlBarVisible(videoEl, false);
    await waitForMutationObserver();
    expect(getCaptionBottom()).toBe(30);

    manager.destroy();
  });
});
