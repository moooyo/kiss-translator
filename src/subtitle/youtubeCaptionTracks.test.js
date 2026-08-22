import {
  buildTrackKey,
  findCaptionTrack,
  getCaptionTracks,
  getSubtitleEvents,
  isChatCaptionTrack,
  isSameLang,
} from "./youtubeCaptionTracks.js";

jest.mock("../libs/log.js", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

describe("youtubeCaptionTracks", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterAll(() => {
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }
  });

  // getSubtitleEvents 此前完全没有测试。这三条钉的是「有没有响应体」这个分叉：
  // 拦截器装载晚于 timedtext 请求时就没有响应体，而解析快路径对 null 的处理
  // 是静默返回 undefined —— 调用方会把它当成「这条轨没有字幕」。
  describe("getSubtitleEvents", () => {
    const capUrl = () =>
      new URL("https://www.youtube.com/api/timedtext?v=abc&lang=en&fmt=json3");
    const potUrl = () =>
      new URL("https://www.youtube.com/api/timedtext?v=abc&lang=en");

    test("parses the intercepted body without fetching", async () => {
      const events = [{ segs: [{ utf8: "hello" }] }];
      const result = await getSubtitleEvents(
        capUrl(),
        potUrl(),
        JSON.stringify({ events })
      );

      expect(result).toEqual(events);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test.each([
      ["a null body", null],
      ["an empty body", ""],
      ["a non-string body", undefined],
    ])("fetches the track when there is %s", async (_case, body) => {
      const events = [{ segs: [{ utf8: "fetched" }] }];
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ events }),
      });

      const result = await getSubtitleEvents(capUrl(), potUrl(), body);

      expect(result).toEqual(events);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch.mock.calls[0][0]).toContain("fmt=json3");
    });

    test("returns null when the fallback fetch fails", async () => {
      global.fetch.mockResolvedValue({ ok: false, status: 404 });

      expect(await getSubtitleEvents(capUrl(), potUrl(), null)).toBeNull();
    });
  });

  test("matches caption tracks by normalized language family", () => {
    expect(isSameLang("zh-CN", "zh-TW")).toBe(true);
    expect(isSameLang("zh-Hans", "zh-CN")).toBe(true);
    expect(isSameLang("en-US", "en")).toBe(true);
    expect(isSameLang("qaa-US", "qaa-GB")).toBe(true);
    expect(isSameLang("en", "fr")).toBe(false);
  });

  test("keeps Chinese variants distinct when deciding whether to translate", () => {
    expect(isSameLang("zh-CN", "zh-TW", true)).toBe(false);
    expect(isSameLang("zh-Hans", "zh-CN", true)).toBe(true);
  });

  test("builds a stable track key from timedtext query parameters", () => {
    const url = new URL(
      "https://example.test/api?v=video-1&lang=en&kind=asr&name=English&tlang=zh"
    );

    expect(buildTrackKey(url)).toBe("video-1|en|asr|English|zh");
  });

  test("detects live chat caption tracks", () => {
    expect(
      isChatCaptionTrack({ name: { simpleText: "Live Chat replay" } })
    ).toBe(true);
    expect(isChatCaptionTrack({ name: { simpleText: "English" } })).toBe(false);
  });

  test("prefers exact language and kind matches", () => {
    const exact = { languageCode: "en", kind: "asr" };
    const manual = { languageCode: "en" };

    expect(findCaptionTrack([manual, exact], "en", "asr")).toBe(exact);
  });

  test("falls back from ASR to a same-language manual track", () => {
    const asr = { languageCode: "en", kind: "asr" };
    const manual = { languageCode: "en-US" };

    expect(findCaptionTrack([asr, manual], "fr", null)).toBe(manual);
  });

  test("falls back away from chat tracks when possible", () => {
    const chat = { languageCode: "en", name: { simpleText: "Live chat" } };
    const normal = { languageCode: "en", name: { simpleText: "English" } };

    expect(findCaptionTrack([chat, normal], "en", null)).toBe(normal);
  });

  test("does not mutate tracks when using the fallback", () => {
    const tracks = [{ languageCode: "de" }];

    expect(findCaptionTrack(tracks, "en", null)).toEqual({
      languageCode: "de",
    });
    expect(tracks).toHaveLength(1);
  });

  test("reuses one page request for concurrent tracks of the same video", async () => {
    const playerResponse = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{ languageCode: "en" }],
        },
      },
    };
    global.fetch.mockResolvedValue({
      text: async () =>
        `ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};`,
    });

    const results = await Promise.all([
      getCaptionTracks("cache-video-1"),
      getCaptionTracks("cache-video-1"),
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(results[0].captionTracks).toHaveLength(1);
    expect(results[1].captionTracks).toHaveLength(1);
  });

  test("fetches again when the video changes", async () => {
    global.fetch.mockResolvedValue({
      text: async () =>
        'ytInitialPlayerResponse = {"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"languageCode":"en"}]}}};',
    });

    await getCaptionTracks("cache-video-2");
    await getCaptionTracks("cache-video-3");

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("allows a retry after invalid page metadata", async () => {
    global.fetch
      .mockResolvedValueOnce({ text: async () => "invalid response" })
      .mockResolvedValueOnce({
        text: async () =>
          'ytInitialPlayerResponse = {"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"languageCode":"en"}]}}};',
      });

    await getCaptionTracks("retry-video");
    const result = await getCaptionTracks("retry-video");

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.captionTracks).toHaveLength(1);
  });
});
