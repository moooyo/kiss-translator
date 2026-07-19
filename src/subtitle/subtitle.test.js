import {
  runSubtitle,
  setSubtitleInterceptorEnabled,
  stopSubtitle,
  SUBTITLE_INTERCEPTOR_ATTRIBUTE,
} from "./subtitle";

jest.mock("./YouTubeCaptionProvider.js", () => ({
  YouTubeInitializer: Object.assign(jest.fn(), {
    destroy: jest.fn(),
    suspend: jest.fn(),
  }),
}));
jest.mock("../libs/utils.js", () => ({ isMatch: jest.fn() }));
jest.mock("../libs/log.js", () => ({ logger: { error: jest.fn() } }));
jest.mock("../libs/browser.js", () => ({
  isExtensionContextInvalidatedError: (error) =>
    error?.message?.includes("Extension context invalidated") === true,
}));
jest.mock("../injectors/index.js", () => ({
  injectJs: jest.fn(),
  INJECTOR: { subtitle: "injector-subtitle.js" },
}));

describe("subtitle interceptor state", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(SUBTITLE_INTERCEPTOR_ATTRIBUTE);
  });

  test("publishes enabled and disabled state through the shared document", () => {
    setSubtitleInterceptorEnabled(true);
    expect(
      document.documentElement.getAttribute(SUBTITLE_INTERCEPTOR_ATTRIBUTE)
    ).toBe("enabled");

    stopSubtitle();
    expect(
      document.documentElement.getAttribute(SUBTITLE_INTERCEPTOR_ATTRIBUTE)
    ).toBe("disabled");

    const { YouTubeInitializer } = require("./YouTubeCaptionProvider.js");
    expect(YouTubeInitializer.suspend).toHaveBeenCalledTimes(1);
    expect(YouTubeInitializer.destroy).not.toHaveBeenCalled();
  });

  test("swallows an invalidated context from an async provider start", async () => {
    const { YouTubeInitializer } = require("./YouTubeCaptionProvider.js");
    const { isMatch } = require("../libs/utils.js");
    const { logger } = require("../libs/log.js");
    isMatch.mockReturnValue(true);
    YouTubeInitializer.mockRejectedValueOnce(
      new Error("Extension context invalidated.")
    );

    await expect(
      runSubtitle({
        href: "https://www.youtube.com/watch?v=test",
        setting: { subtitleSetting: { enabled: true }, transApis: [] },
      })
    ).resolves.toBeUndefined();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
