import {
  buildTrackKey,
  findCaptionTrack,
  findDefaultCaptionTrack,
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

  test("matches language families by their leading language code", () => {
    expect(isSameLang("zh-CN", "zh-TW")).toBe(true);
    expect(isSameLang("en", "fr")).toBe(false);
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

  test("does not let an aborted recovery poison a same-video request", async () => {
    let resolveFetch;
    global.fetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );
    const recoveryController = new AbortController();
    const recovery = getCaptionTracks("abort-video", {
      signal: recoveryController.signal,
    });

    recoveryController.abort();
    await expect(recovery).resolves.toEqual({});

    const intercepted = getCaptionTracks("abort-video");
    resolveFetch({
      text: async () =>
        'ytInitialPlayerResponse = {"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"languageCode":"en"}]}}};',
    });

    await expect(intercepted).resolves.toEqual(
      expect.objectContaining({
        captionTracks: [{ languageCode: "en" }],
      })
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("selects the second caption track from reliable audio metadata", () => {
    const captionTracks = [{ languageCode: "en" }, { languageCode: "fr" }];

    expect(
      findDefaultCaptionTrack({
        captionTracks,
        audioTracks: [
          {
            defaultCaptionTrackIndex: 1,
            hasDefaultTrack: true,
          },
        ],
      })
    ).toBe(captionTracks[1]);
  });

  test("does not guess a default when multiple caption tracks are ambiguous", () => {
    expect(
      findDefaultCaptionTrack({
        captionTracks: [{ languageCode: "en" }, { languageCode: "fr" }],
      })
    ).toBeNull();
  });

  test("uses the only caption track when no default metadata is available", () => {
    const onlyTrack = { languageCode: "en" };

    expect(findDefaultCaptionTrack({ captionTracks: [onlyTrack] })).toBe(
      onlyTrack
    );
  });

  test("returns default-track metadata from the player response", async () => {
    const originalFetch = global.fetch;
    const tracklistRenderer = {
      captionTracks: [{ languageCode: "en" }, { languageCode: "fr" }],
      audioTracks: [{ defaultCaptionTrackIndex: 1, hasDefaultTrack: true }],
      defaultAudioTrackIndex: 0,
    };
    const playerResponse = {
      captions: { playerCaptionsTracklistRenderer: tracklistRenderer },
      videoDetails: { shortDescription: "Description" },
    };
    global.fetch = jest.fn().mockResolvedValue({
      text: jest
        .fn()
        .mockResolvedValue(
          `ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};`
        ),
    });

    try {
      await expect(getCaptionTracks("video-1")).resolves.toEqual({
        ...tracklistRenderer,
        defaultCaptionTrackIndex: undefined,
        fullDescription: "Description",
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("fetches the selected track when no intercepted response is available", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ events: [{ text: "hello" }] }),
    });
    const trackUrl = new URL(
      "https://www.youtube.com/api/timedtext?v=video-1&lang=en&kind=asr"
    );

    try {
      await expect(
        getSubtitleEvents(trackUrl, new URL(trackUrl.href), null)
      ).resolves.toEqual([{ text: "hello" }]);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("fmt=json3")
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
