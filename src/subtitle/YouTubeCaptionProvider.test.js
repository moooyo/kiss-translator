import { act } from "react";
import { apiSubtitle, apiSummarizeContext } from "../apis/index.js";
import { YouTubeCaptionProvider } from "./YouTubeCaptionProvider.js";
import { getCaptionTracks, getSubtitleEvents } from "./youtubeCaptionTracks.js";
import { waitForElement } from "./youtubePlayerUi.js";
import { eventsToSubtitles } from "./youtubeAiSegmentation.js";
import { prepareTimedTextEvents } from "./youtubeSubtitleProcessing.js";

const mockIsSameLang = jest.fn(() => false);
const mockManagerSettings = [];

jest.mock("../config", () => ({
  MSG_XHR_DATA_YOUTUBE: "xhr-youtube",
  API_SPE_TYPES: { ai: new Set(["openai"]) },
  OPT_ENHANCE_ON: "on",
  OPT_ENHANCE_OFF: "off",
  OPT_ENHANCE_MOBILE_OFF: "mobile_off",
  newI18n: () => (key) => key,
}));

jest.mock("../apis/index.js", () => ({
  apiSubtitle: jest.fn(),
  apiSummarizeContext: jest.fn(),
}));

jest.mock("../apis/history.js", () => ({ clearMsgHistory: jest.fn() }));
jest.mock("../libs/docInfo.js", () => ({ getDocInfo: () => ({}) }));

jest.mock("./youtubePlayerUi.js", () => ({
  CONTROLS_SELECTOR: ".controls",
  VIDEO_SELECTOR: "video",
  YT_AD_SELECTOR: ".ad",
  YT_SUBTITLE_BUTTON_SELECTOR: ".captions",
  waitForElement: jest.fn(),
  YouTubePlayerUi: class {
    injectToggleButton = jest.fn();
    removeToggleButton = jest.fn();
    updateMenuProps = jest.fn();
    showNotification = jest.fn();
    hideNotification = jest.fn();
    hideYtCaption = jest.fn();
    showYtCaption = jest.fn();
  },
}));

jest.mock("./youtubeCaptionTracks.js", () => ({
  buildTrackKey: () => "track-1",
  findCaptionTrack: (tracks) => tracks[0],
  getCaptionTracks: jest.fn(),
  getSubtitleEvents: jest.fn(),
  isChatCaptionTrack: (track) => Boolean(track?.isChat),
  // 用真实实现：默认轨的判定规则正是这里要测的行为，假的会让测试变成测 mock
  findDefaultCaptionTrack: jest.requireActual("./youtubeCaptionTracks.js")
    .findDefaultCaptionTrack,
  isSameLang: (...args) => mockIsSameLang(...args),
}));

jest.mock("./youtubeSubtitleProcessing.js", () => ({
  builtinSegment: jest.fn(),
  formatSubtitles: jest.fn(),
  getFromLang: () => "en",
  prepareTimedTextEvents: jest.fn(),
}));

jest.mock("./youtubeAiSegmentation.js", () => ({
  eventsToSubtitles: jest.fn(),
}));

jest.mock("./BilingualSubtitleManager.js", () => ({
  BilingualSubtitleManager: class {
    constructor({ setting }) {
      mockManagerSettings.push(setting);
    }
    start = jest.fn();
    destroy = jest.fn();
    repairChunkTranslations = jest.fn();
  },
}));

jest.mock("./YouTubeSubtitleList.js", () => ({
  YouTubeSubtitleList: jest.fn(),
}));

// CRA 的 jest 默认 resetMocks: true，会连 jest.fn() 的默认实现一起清掉，
// 所以实现必须在每个用例里重设。
function wireWaitForElement() {
  waitForElement.mockImplementation((selector, callback) => {
    const element = document.querySelector(selector);
    if (element) callback(element);
  });
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("YouTubeCaptionProvider manual translation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockManagerSettings.length = 0;
    window.history.replaceState({}, "", "/watch?v=video-1");
    document.body.innerHTML =
      '<video></video><button class="captions" aria-pressed="true"></button>';
    getCaptionTracks.mockResolvedValue({
      captionTracks: [{ baseUrl: "https://www.youtube.com/timedtext" }],
      fullDescription: "",
    });
    getSubtitleEvents.mockResolvedValue([{ text: "hello" }]);
    // 新准备接口一次返回规范化事件和展平事件，避免测试继续依赖已删除的两段处理。
    prepareTimedTextEvents.mockReturnValue({
      events: [{ text: "hello" }],
      flatEvents: [{ start: 0, end: 1000, text: "hello" }],
    });
    eventsToSubtitles.mockResolvedValue([
      [{ start: 0, end: 1000, text: "hello", translation: "你好" }],
      100,
      null,
    ]);
    apiSummarizeContext.mockResolvedValue("");
  });

  test("prepares source subtitles and waits for the menu before translating", async () => {
    const onSubtitlePositionChange = jest.fn();
    const provider = new YouTubeCaptionProvider({
      autoTranslate: false,
      aiContextSlug: "-",
      apiSlug: "mock-api",
      toLang: "zh-CN",
      showList: "off",
      rememberPosition: true,
      positionRatio: 0.05,
      onSubtitlePositionChange,
    });
    provider.initialize();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "xhr-youtube",
          url: "https://www.youtube.com/api/timedtext?v=video-1&lang=en",
          response: "{}",
        },
      })
    );
    await act(async () => flushPromises());

    expect(getSubtitleEvents).toHaveBeenCalledTimes(1);
    expect(prepareTimedTextEvents).toHaveBeenCalledTimes(1);
    expect(mockIsSameLang).toHaveBeenCalledWith("en", "zh-CN", true);
    expect(apiSubtitle).not.toHaveBeenCalled();
    expect(eventsToSubtitles).not.toHaveBeenCalled();

    provider.updateSetting({ name: "autoTranslate", value: true });
    await act(async () => flushPromises());

    expect(eventsToSubtitles).toHaveBeenCalledTimes(1);
    expect(mockManagerSettings).toHaveLength(1);

    mockManagerSettings[0].onSubtitlePositionChange(0.3);
    expect(onSubtitlePositionChange).toHaveBeenCalledWith(0.3);

    window.dispatchEvent(new Event("yt-navigate-finish"));
    window.history.replaceState({}, "", "/watch?v=video-2");
    provider.updateSetting({ name: "autoTranslate", value: true });
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "xhr-youtube",
          url: "https://www.youtube.com/api/timedtext?v=video-2&lang=en",
          response: "{}",
        },
      })
    );
    await act(async () => flushPromises());

    expect(mockManagerSettings).toHaveLength(2);
    expect(mockManagerSettings[1].positionRatio).toBe(0.3);
  });
});

// XHR 拦截器是异步注入的（追加 <script src>），content.js 也没声明 run_at，
// 所以「YouTube 已经发出 timedtext 请求、拦截器才装好」是结构上可能的。
// 此前这条路径没有任何回退：#handleInterceptedRequest 永不被调用，字幕永不出现。
// 恢复链路是「定时器 → 若干层 await」。只推进定时器或只排微任务都不够，
// 必须交替进行直到静止。
const settle = async () => {
  for (let i = 0; i < 20; i += 1) {
    jest.advanceTimersByTime(200);
    await Promise.resolve();
    await Promise.resolve();
  }
};

// 只排微任务、不推定时器。用来让拦截链路跑完而不会顺带触发恢复定时器。
const drain = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

describe("YouTubeCaptionProvider track recovery", () => {
  const makeProvider = () =>
    new YouTubeCaptionProvider({
      autoTranslate: false,
      aiContextSlug: "-",
      apiSlug: "mock-api",
      toLang: "zh-CN",
      showList: "off",
    });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    wireWaitForElement();
    window.history.replaceState({}, "", "/watch?v=video-1");
    document.body.innerHTML =
      '<div class="controls"><button class="captions" aria-pressed="true"></button></div><video></video>';
    getCaptionTracks.mockResolvedValue({
      captionTracks: [
        { baseUrl: "https://www.youtube.com/api/timedtext?v=video-1&lang=en" },
      ],
      fullDescription: "",
    });
    getSubtitleEvents.mockResolvedValue([{ text: "hello" }]);
    prepareTimedTextEvents.mockReturnValue({
      events: [{ text: "hello" }],
      flatEvents: [{ start: 0, end: 1000, text: "hello" }],
    });
    apiSummarizeContext.mockResolvedValue("");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("loads the track when no timedtext request was intercepted", async () => {
    const provider = makeProvider();
    provider.initialize();

    expect(getSubtitleEvents).not.toHaveBeenCalled();

    await act(async () => settle());

    expect(getSubtitleEvents).toHaveBeenCalled();
    // 响应体为 null，getSubtitleEvents 因此走 fetch 回退
    expect(getSubtitleEvents.mock.calls[0][2]).toBeNull();
  });

  // 门控是这里最容易写错的地方：现成的 #isYtSubtitleEnabled() 在按钮缺失时
  // 返回 true，用它会让每个没开字幕的视频都跑一遍取轨+AI增强+翻译。
  test.each([
    ["the captions button is off", 'aria-pressed="false"'],
    ["the captions button is absent", null],
  ])("stays out of the way when %s", async (_case, attrs) => {
    document.body.innerHTML = attrs
      ? `<div class="controls"><button class="captions" ${attrs}></button></div><video></video>`
      : '<div class="controls"></div><video></video>';

    const provider = makeProvider();
    provider.initialize();

    await act(async () => settle());

    expect(getSubtitleEvents).not.toHaveBeenCalled();
  });

  test("does not recover when the intercept already delivered a track", async () => {
    const provider = makeProvider();
    provider.initialize();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "xhr-youtube",
          url: "https://www.youtube.com/api/timedtext?v=video-1&lang=en",
          response: "{}",
        },
      })
    );
    await act(async () => drain());
    expect(getSubtitleEvents).toHaveBeenCalled();

    // 断言的是「恢复有没有再跑」，而不是总调用次数：provider 没有公开的销毁
    // 入口，每个用例 initialize() 挂上的 window 监听器会累积到后续用例，
    // 用绝对次数会把别的 provider 的响应也算进来。
    getSubtitleEvents.mockClear();
    await act(async () => settle());

    expect(getSubtitleEvents).not.toHaveBeenCalled();
  });

  // 导航后也会重新调度恢复，而那时 YouTube 可能正在重建控制栏、按钮短暂不存在。
  // 这条是唯一能区分两种门控写法的用例：现成的 #isYtSubtitleEnabled() 在按钮
  // 缺失时返回 true（失败开放），会让每个视频都跑一遍取轨 + AI 增强 + 翻译。
  test("does not recover after navigation when the captions button is gone", async () => {
    const provider = makeProvider();
    provider.initialize();

    // 让首次调度先过去，避免和导航后的调度混淆
    await act(async () => settle());
    getSubtitleEvents.mockClear();

    // 控制栏被重建，按钮暂时不在
    document.body.innerHTML = '<div class="controls"></div><video></video>';
    window.dispatchEvent(new CustomEvent("yt-navigate-finish"));

    await act(async () => settle());

    expect(getSubtitleEvents).not.toHaveBeenCalled();
  });

  // 猜错的代价是加载并翻译一条用户没选的字幕轨，所以宁可不恢复。
  test("does not guess when several tracks are ambiguous", async () => {
    getCaptionTracks.mockResolvedValue({
      captionTracks: [
        { baseUrl: "https://www.youtube.com/api/timedtext?v=video-1&lang=en" },
        { baseUrl: "https://www.youtube.com/api/timedtext?v=video-1&lang=ja" },
      ],
      fullDescription: "",
    });

    const provider = makeProvider();
    provider.initialize();
    await act(async () => settle());

    expect(getSubtitleEvents).not.toHaveBeenCalled();
  });

  test("uses the track YouTube marks as default when there are several", async () => {
    getCaptionTracks.mockResolvedValue({
      captionTracks: [
        { baseUrl: "https://www.youtube.com/api/timedtext?v=video-1&lang=en" },
        { baseUrl: "https://www.youtube.com/api/timedtext?v=video-1&lang=ja" },
      ],
      defaultCaptionTrackIndex: 1,
      fullDescription: "",
    });

    const provider = makeProvider();
    provider.initialize();
    await act(async () => settle());

    expect(getSubtitleEvents).toHaveBeenCalled();
    expect(getSubtitleEvents.mock.calls[0][1].searchParams.get("lang")).toBe(
      "ja"
    );
  });

  test("resolves the default through the default audio track", async () => {
    getCaptionTracks.mockResolvedValue({
      captionTracks: [
        { baseUrl: "https://www.youtube.com/api/timedtext?v=video-1&lang=en" },
        { baseUrl: "https://www.youtube.com/api/timedtext?v=video-1&lang=ja" },
      ],
      audioTracks: [
        { defaultCaptionTrackIndex: 0 },
        { defaultCaptionTrackIndex: 1, hasDefaultTrack: true },
      ],
      fullDescription: "",
    });

    const provider = makeProvider();
    provider.initialize();
    await act(async () => settle());

    expect(getSubtitleEvents.mock.calls[0][1].searchParams.get("lang")).toBe(
      "ja"
    );
  });

  test("stays out of the way when the resolved default is a live chat track", async () => {
    getCaptionTracks.mockResolvedValue({
      captionTracks: [
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=video-1&lang=en",
          isChat: true,
        },
      ],
      fullDescription: "",
    });

    const provider = makeProvider();
    provider.initialize();
    await act(async () => settle());

    expect(getSubtitleEvents).not.toHaveBeenCalled();
  });
});
