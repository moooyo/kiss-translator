import { act } from "react";
import { apiSubtitle, apiSummarizeContext } from "../apis/index.js";
import {
  YouTubeCaptionProvider,
  YouTubeInitializer,
} from "./YouTubeCaptionProvider.js";
import { getCaptionTracks, getSubtitleEvents } from "./youtubeCaptionTracks.js";
import { eventsToSubtitles } from "./youtubeAiSegmentation.js";
import { prepareTimedTextEvents } from "./youtubeSubtitleProcessing.js";

const mockManagerInstances = [];
const mockPlayerUiInstances = [];
const mockSubtitleListInstances = [];
const mockIsSameLang = jest.fn(() => false);

jest.mock("../config", () => ({
  MSG_XHR_DATA_YOUTUBE: "xhr-youtube",
  API_SPE_TYPES: { ai: new Set(["openai"]) },
  OPT_ENHANCE_ON: "on",
  OPT_ENHANCE_OFF: "off",
  OPT_ENHANCE_MOBILE_OFF: "mobile_off",
  newI18n: (lang) => (key) => `${lang}:${key}`,
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
    constructor() {
      mockPlayerUiInstances.push(this);
    }

    injectToggleButton = jest.fn();
    removeToggleButton = jest.fn();
    updateMenuProps = jest.fn();
    showNotification = jest.fn();
    hideNotification = jest.fn();
    destroyNotification = jest.fn();
    hideYtCaption = jest.fn();
    showYtCaption = jest.fn();
  },
}));

jest.mock("./youtubeCaptionTracks.js", () => ({
  buildTrackKey: (url) =>
    [
      url.searchParams.get("v") || "",
      url.searchParams.get("lang") || "",
      url.searchParams.get("kind") || "",
    ].join("|"),
  findCaptionTrack: (tracks) => tracks[0],
  getCaptionTracks: jest.fn(),
  getSubtitleEvents: jest.fn(),
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
    constructor(options) {
      this.options = options;
      mockManagerInstances.push(this);
    }

    start = jest.fn();
    destroy = jest.fn();
    updateSetting = jest.fn();
    repairChunkTranslations = jest.fn();
  },
}));

jest.mock("./YouTubeSubtitleList.js", () => ({
  YouTubeSubtitleList: class {
    constructor(videoEl, i18n, options) {
      this.videoEl = videoEl;
      this.i18n = i18n;
      this.options = options;
      mockSubtitleListInstances.push(this);
    }

    initialize = jest.fn();
    destroy = jest.fn();
    setVisible = jest.fn();
    updateSetting = jest.fn();
    updateSingleSubtitle = jest.fn();
    turnOnAutoSub = jest.fn();
  },
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));
const waitForCurrentTrackRecovery = () =>
  new Promise((resolve) => setTimeout(resolve, 550));

describe("YouTubeCaptionProvider manual translation", () => {
  beforeEach(() => {
    YouTubeInitializer.destroy();
    jest.clearAllMocks();
    mockManagerInstances.length = 0;
    mockPlayerUiInstances.length = 0;
    mockSubtitleListInstances.length = 0;
    window.history.replaceState({}, "", "/watch?v=video-1");
    document.body.innerHTML =
      '<video></video><button class="captions" aria-pressed="true"></button>';
    getCaptionTracks.mockResolvedValue({
      captionTracks: [{ baseUrl: "https://www.youtube.com/timedtext" }],
      fullDescription: "",
    });
    getSubtitleEvents.mockResolvedValue([{ text: "hello" }]);
    // Prepare normalized and flattened events through the shared contract.
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
    mockIsSameLang.mockReturnValue(false);
  });

  afterEach(() => {
    YouTubeInitializer.destroy();
  });

  test("prepares source subtitles and waits for the menu before translating", async () => {
    const initialApi = { apiSlug: "mock-api", apiType: "Microsoft" };
    const nextApi = { apiSlug: "another-api", apiType: "Google" };
    const provider = new YouTubeCaptionProvider({
      autoTranslate: false,
      aiContextSlug: "-",
      apiSlug: "mock-api",
      apiSetting: initialApi,
      transApis: [initialApi, nextApi],
      showList: "off",
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
    expect(apiSubtitle).not.toHaveBeenCalled();
    expect(eventsToSubtitles).not.toHaveBeenCalled();

    provider.updateSetting({ name: "autoTranslate", value: true });
    await act(async () => flushPromises());

    expect(eventsToSubtitles).toHaveBeenCalledTimes(1);

    provider.updateSetting({ name: "apiSlug", value: "another-api" });
    await act(async () => flushPromises());

    expect(eventsToSubtitles).toHaveBeenCalledTimes(2);
    expect(eventsToSubtitles.mock.calls[1][0].setting).toEqual(
      expect.objectContaining({
        apiSlug: "another-api",
        apiSetting: nextApi,
      })
    );

    provider.destroy();
  });

  test("destroys and recreates the singleton provider", async () => {
    const first = await YouTubeInitializer({ autoTranslate: false });
    const second = await YouTubeInitializer({ autoTranslate: true });
    expect(second).toBe(first);

    YouTubeInitializer.destroy();
    const third = await YouTubeInitializer({ autoTranslate: true });
    expect(third).not.toBe(first);
    YouTubeInitializer.destroy();
  });

  test("restores the intercepted current track after suspend without a new request", async () => {
    const provider = await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      showList: "off",
    });

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

    expect(mockManagerInstances).toHaveLength(1);
    expect(getSubtitleEvents).toHaveBeenCalledTimes(1);
    expect(eventsToSubtitles).toHaveBeenCalledTimes(1);

    YouTubeInitializer.suspend();
    expect(mockManagerInstances[0].destroy).toHaveBeenCalledTimes(1);

    const resumedProvider = await YouTubeInitializer({ autoTranslate: true });
    await act(async () => flushPromises());

    expect(resumedProvider).toBe(provider);
    expect(mockManagerInstances).toHaveLength(2);
    expect(getSubtitleEvents).toHaveBeenCalledTimes(1);
    expect(eventsToSubtitles).toHaveBeenCalledTimes(1);

    await YouTubeInitializer({ autoTranslate: true });
    expect(mockManagerInstances).toHaveLength(2);
  });

  test("loads the current track when initialized without an intercepted request", async () => {
    getCaptionTracks.mockResolvedValue({
      captionTracks: [
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=video-1&lang=en",
          languageCode: "en",
        },
      ],
      fullDescription: "",
    });

    await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      showList: "off",
    });
    await act(async () => {
      await waitForCurrentTrackRecovery();
      await flushPromises();
    });

    expect(getCaptionTracks).toHaveBeenCalledWith(
      "video-1",
      expect.objectContaining({ signal: expect.anything() })
    );
    expect(getSubtitleEvents).toHaveBeenCalledTimes(1);
    expect(eventsToSubtitles).toHaveBeenCalledTimes(1);
    expect(mockManagerInstances).toHaveLength(1);
  });

  test("loads the new video after navigation while suspended", async () => {
    const initialApi = { apiSlug: "initial-api", apiType: "Microsoft" };
    const nextApi = { apiSlug: "next-api", apiType: "Google" };
    await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      apiSlug: "initial-api",
      apiSetting: initialApi,
      transApis: [initialApi, nextApi],
      showList: "off",
    });
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

    YouTubeInitializer.suspend();
    window.history.replaceState({}, "", "/watch?v=video-2");
    window.dispatchEvent(new Event("yt-navigate-finish"));
    getCaptionTracks.mockResolvedValue({
      captionTracks: [
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=video-2&lang=en",
          languageCode: "en",
        },
      ],
      fullDescription: "",
    });

    await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      apiSlug: "next-api",
      apiSetting: nextApi,
      transApis: [initialApi, nextApi],
      showList: "off",
    });
    await act(async () => {
      await waitForCurrentTrackRecovery();
      await flushPromises();
    });

    expect(getCaptionTracks).toHaveBeenLastCalledWith(
      "video-2",
      expect.objectContaining({ signal: expect.anything() })
    );
    expect(eventsToSubtitles).toHaveBeenLastCalledWith(
      expect.objectContaining({
        videoId: "video-2",
        setting: expect.objectContaining({ apiSlug: "next-api" }),
      })
    );
    expect(mockManagerInstances).toHaveLength(2);
  });

  test("reprocesses cached events with semantic settings received while suspended", async () => {
    const initialApi = { apiSlug: "initial-api", apiType: "Microsoft" };
    const nextApi = { apiSlug: "next-api", apiType: "Google" };
    await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      apiSlug: "initial-api",
      apiSetting: initialApi,
      transApis: [initialApi, nextApi],
      showList: "off",
    });
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

    YouTubeInitializer.suspend();
    await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      apiSlug: "next-api",
      apiSetting: nextApi,
      transApis: [initialApi, nextApi],
      showList: "off",
    });
    await act(async () => flushPromises());

    expect(getCaptionTracks).toHaveBeenCalledTimes(1);
    expect(getSubtitleEvents).toHaveBeenCalledTimes(1);
    expect(eventsToSubtitles).toHaveBeenCalledTimes(2);
    expect(eventsToSubtitles.mock.calls[1][0].setting).toEqual(
      expect.objectContaining({ apiSlug: "next-api", apiSetting: nextApi })
    );
  });

  test("reprocesses cached events when the segmentation prompt changes", async () => {
    await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      segPromptMode: "global",
      segPromptSlug: "subtitle-prompt-a",
      showList: "off",
    });
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

    await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      segPromptMode: "global",
      segPromptSlug: "subtitle-prompt-b",
      showList: "off",
    });
    await act(async () => flushPromises());

    expect(getSubtitleEvents).toHaveBeenCalledTimes(1);
    expect(eventsToSubtitles).toHaveBeenCalledTimes(2);
    expect(eventsToSubtitles.mock.calls[1][0].setting).toEqual(
      expect.objectContaining({ segPromptSlug: "subtitle-prompt-b" })
    );
  });

  test("replays an interrupted request after automatic translation is re-enabled", async () => {
    let resolveInterruptedRequest;
    getCaptionTracks
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveInterruptedRequest = resolve;
          })
      )
      .mockResolvedValue({
        captionTracks: [{ baseUrl: "https://www.youtube.com/timedtext" }],
        fullDescription: "",
      });

    await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      apiSlug: "initial-api",
      showList: "off",
    });
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

    await YouTubeInitializer({
      autoTranslate: false,
      aiContextSlug: "-",
      apiSlug: "next-api",
      showList: "off",
    });
    await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      apiSlug: "next-api",
      showList: "off",
    });
    await act(async () => flushPromises());

    expect(getCaptionTracks).toHaveBeenCalledTimes(2);
    expect(getSubtitleEvents).toHaveBeenCalledTimes(1);
    expect(eventsToSubtitles).toHaveBeenCalledTimes(1);

    resolveInterruptedRequest({
      captionTracks: [{ baseUrl: "https://www.youtube.com/timedtext" }],
      fullDescription: "",
    });
    await act(async () => flushPromises());
    expect(getSubtitleEvents).toHaveBeenCalledTimes(1);
  });

  test("does not translate cached subtitles when target and source languages match", async () => {
    await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      toLang: "zh-CN",
      showList: "off",
    });
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
    expect(eventsToSubtitles).toHaveBeenCalledTimes(1);

    mockIsSameLang.mockReturnValue(true);
    await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      toLang: "en",
      showList: "off",
    });
    await act(async () => flushPromises());

    expect(eventsToSubtitles).toHaveBeenCalledTimes(1);
    expect(mockPlayerUiInstances[0].showNotification).toHaveBeenCalledWith(
      "zh:subtitle_same_lang"
    );
  });

  test("updates presentation settings without recreating managers", async () => {
    const provider = await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      fontScale: 100,
      showList: "off",
      uiLang: "zh",
    });
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

    const sameProvider = await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      fontScale: 125,
      showList: "off",
      uiLang: "en",
    });

    expect(sameProvider).toBe(provider);
    expect(eventsToSubtitles).toHaveBeenCalledTimes(1);
    expect(mockManagerInstances).toHaveLength(1);
    expect(mockManagerInstances[0].destroy).not.toHaveBeenCalled();
    expect(mockManagerInstances[0].updateSetting).toHaveBeenCalledWith(
      expect.objectContaining({ fontScale: 125, uiLang: "en" })
    );
  });

  test("preserves the subtitle list while presentation settings change", async () => {
    const provider = await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      fontScale: 100,
      showList: "on",
      enhanceMode: "on",
      uiLang: "zh",
    });
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

    const manager = mockManagerInstances[0];
    const subtitleList = mockSubtitleListInstances[0];
    await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      fontScale: 125,
      showList: "on",
      enhanceMode: "on",
      uiLang: "en",
    });

    expect(mockManagerInstances).toEqual([manager]);
    expect(mockSubtitleListInstances).toEqual([subtitleList]);
    expect(manager.destroy).not.toHaveBeenCalled();
    expect(subtitleList.destroy).not.toHaveBeenCalled();
    expect(subtitleList.updateSetting).toHaveBeenCalled();

    provider.updateSetting({ name: "showList", value: "off" });
    provider.updateSetting({ name: "showList", value: "on" });

    expect(mockSubtitleListInstances).toEqual([subtitleList]);
    expect(subtitleList.destroy).not.toHaveBeenCalled();
    expect(subtitleList.setVisible).toHaveBeenNthCalledWith(1, false);
    expect(subtitleList.setVisible).toHaveBeenNthCalledWith(2, true);
  });

  test("uses the latest external auto-translate value after navigation", async () => {
    const provider = await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      showList: "off",
    });
    await YouTubeInitializer({
      autoTranslate: false,
      aiContextSlug: "-",
      showList: "off",
    });
    provider.updateSetting({ name: "autoTranslate", value: true });
    window.dispatchEvent(new Event("yt-navigate-finish"));
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
    expect(eventsToSubtitles).not.toHaveBeenCalled();
  });

  test("replays the intercepted track when suspension interrupts loading", async () => {
    let resolveInterruptedRequest;
    getCaptionTracks
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveInterruptedRequest = resolve;
          })
      )
      .mockResolvedValue({
        captionTracks: [{ baseUrl: "https://www.youtube.com/timedtext" }],
        fullDescription: "",
      });

    await YouTubeInitializer({
      autoTranslate: true,
      aiContextSlug: "-",
      showList: "off",
    });
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
    expect(getCaptionTracks).toHaveBeenCalledTimes(1);
    const interruptedSignal = getCaptionTracks.mock.calls[0][1].signal;
    expect(interruptedSignal.aborted).toBe(false);

    YouTubeInitializer.suspend();
    expect(interruptedSignal.aborted).toBe(true);
    await YouTubeInitializer({ autoTranslate: true });
    await act(async () => flushPromises());

    expect(getCaptionTracks).toHaveBeenCalledTimes(2);
    expect(getSubtitleEvents).toHaveBeenCalledTimes(1);
    expect(eventsToSubtitles).toHaveBeenCalledTimes(1);
    expect(mockManagerInstances).toHaveLength(1);

    resolveInterruptedRequest({
      captionTracks: [{ baseUrl: "https://www.youtube.com/timedtext" }],
      fullDescription: "",
    });
    await act(async () => flushPromises());
    expect(getSubtitleEvents).toHaveBeenCalledTimes(1);
    expect(mockManagerInstances).toHaveLength(1);
  });

  test("tears down the notification on every suspend cycle", async () => {
    const provider = await YouTubeInitializer({ autoTranslate: false });
    expect(mockPlayerUiInstances).toHaveLength(1);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      YouTubeInitializer.suspend();
      expect(
        mockPlayerUiInstances[0].destroyNotification
      ).toHaveBeenCalledTimes(cycle + 1);

      const resumedProvider = await YouTubeInitializer({
        autoTranslate: false,
      });
      expect(resumedProvider).toBe(provider);
    }
  });
});
