import { YouTubeSubtitleList } from "./YouTubeSubtitleList";
import { apiMicrosoftDict } from "../apis/index.js";

jest.mock("../libs/storage.js", () => ({
  getSettingWithDefault: jest.fn(() => Promise.resolve({ darkMode: "light" })),
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

function renderVisibleSubtitleItems(manager) {
  manager._cancelVirtualRender();
  manager.subtitleListEl.getClientRects = () => [{ width: 320, height: 300 }];
  Object.defineProperty(manager.subtitleScrollContainer, "clientHeight", {
    value: 300,
    configurable: true,
  });
  manager._renderVirtualSubtitles(true);
  manager._cancelVirtualRender();
}

describe("YouTubeSubtitleList", () => {
  beforeEach(() => {
    apiMicrosoftDict.mockReset();
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
    expect(buttons.find((button) => button.textContent === "×").title).toBe(
      "Close panel"
    );

    await Promise.resolve();
    await Promise.resolve();
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

    await Promise.resolve();
    await Promise.resolve();
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

    await Promise.resolve();
    await Promise.resolve();
    manager.destroy();
  });

  test("updates presentation and visibility without losing panel state", async () => {
    const videoEl = createVideoElement();
    const initialI18n = (key) =>
      ({
        bilingual_subtitles: "Subtitles",
        vocabulary_book: "Vocabulary",
        download_subtitles_vtt: "Download VTT",
        download_raw_subtitle_events_json: "Download JSON",
        close: "Close panel",
      })[key] || "";
    const manager = new YouTubeSubtitleList(videoEl, initialI18n, {
      enableHoverLookup: false,
      theme: { darkMode: "light" },
    });
    manager.initialize([subtitle], [], 100);
    renderVisibleSubtitleItems(manager);

    const container = manager.container;
    const scrollContainer = manager.subtitleScrollContainer;
    scrollContainer.scrollTop = 96;
    manager.vocabulary.push({ word: "hello", timestamp: 0 });
    Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Vocabulary")
      .click();

    const i18n = (key) =>
      ({
        bilingual_subtitles: "Bilingual subtitles",
        vocabulary_book: "Vocabulary",
        download_subtitles_vtt: "Download VTT",
        download_raw_subtitle_events_json: "Download JSON",
        close: "Close panel",
      })[key] || "";
    manager.updateSetting({
      i18n,
      enableHoverLookup: true,
      theme: { darkMode: "dark" },
    });
    Array.from(container.querySelectorAll("button"))
      .find((button) => button.title === "Close panel")
      .click();
    expect(manager.container).toBe(container);
    expect(container.style.display).toBe("none");
    Object.defineProperty(videoEl, "paused", {
      value: false,
      configurable: true,
    });
    videoEl.dispatchEvent(new Event("play"));
    expect(manager.loopAutoScroll).toBeNull();
    manager.setVisible(true);
    expect(manager.loopAutoScroll).not.toBeNull();

    expect(manager.container).toBe(container);
    expect(manager.subtitleScrollContainer).toBe(scrollContainer);
    expect(manager.subtitleScrollContainer.scrollTop).toBe(96);
    expect(manager.activeTab).toBe("vocabulary");
    expect(manager.vocabulary).toEqual([
      expect.objectContaining({ word: "hello" }),
    ]);
    expect(container.style.display).toBe("flex");
    expect(container.style.getPropertyValue("--kt-bg")).toBe(
      "rgba(18,18,18,0.85)"
    );
    expect(
      Array.from(container.querySelectorAll("button")).map(
        (button) => button.textContent
      )
    ).toEqual(
      expect.arrayContaining(["Bilingual subtitles [100%]", "Vocabulary"])
    );

    Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Bilingual subtitles [100%]")
      .click();
    renderVisibleSubtitleItems(manager);
    expect(
      Array.from(
        document.querySelectorAll(".kiss-youtube-original .kiss-subtitle-word")
      ).map((node) => node.textContent)
    ).toEqual(["hello", "world"]);
    manager.destroy();
  });

  test("attaches lookup listeners to every row in a virtual range", async () => {
    jest.useFakeTimers();
    apiMicrosoftDict.mockResolvedValue({ trs: [{ def: "definition" }] });
    const videoEl = createVideoElement();
    const manager = new YouTubeSubtitleList(videoEl, () => "", {
      enableHoverLookup: true,
    });
    manager.initialize(
      [
        { ...subtitle, start: 1000, text: "first row" },
        { ...subtitle, start: 2000, text: "second row" },
        { ...subtitle, start: 3000, text: "third row" },
      ],
      [],
      100
    );
    renderVisibleSubtitleItems(manager);

    const words = document.querySelectorAll(
      ".kiss-youtube-original .kiss-subtitle-word:first-child"
    );
    for (const word of words) {
      word.dispatchEvent(new Event("pointerenter", { bubbles: true }));
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      word.dispatchEvent(new Event("pointerleave", { bubbles: true }));
      jest.advanceTimersByTime(100);
    }

    expect(apiMicrosoftDict.mock.calls.map(([word]) => word)).toEqual([
      "first",
      "second",
      "third",
    ]);

    manager.setBilingualSubtitles([], 100);
    manager._renderVirtualSubtitles(true);
    words[0].dispatchEvent(new Event("pointerenter", { bubbles: true }));
    jest.advanceTimersByTime(300);

    expect(apiMicrosoftDict).toHaveBeenCalledTimes(3);
    expect(words[0].hasAttribute("role")).toBe(false);
    manager.destroy();
    jest.useRealTimers();
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
    await Promise.resolve();
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

    document.removeEventListener("kiss-add-word", addWordHandler);
    manager.destroy();
    jest.useRealTimers();
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

    document.querySelector(".kiss-youtube-item span").click();
    expect(videoEl.currentTime).toBe(33);

    await Promise.resolve();
    await Promise.resolve();
    manager.destroy();
  });
});
