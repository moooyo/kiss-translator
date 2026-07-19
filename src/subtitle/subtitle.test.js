import {
  setSubtitleInterceptorEnabled,
  stopSubtitle,
  SUBTITLE_INTERCEPTOR_ATTRIBUTE,
} from "./subtitle";

jest.mock("./YouTubeCaptionProvider.js", () => ({
  YouTubeInitializer: Object.assign(jest.fn(), { destroy: jest.fn() }),
}));
jest.mock("../libs/utils.js", () => ({ isMatch: jest.fn() }));
jest.mock("../libs/log.js", () => ({ logger: { error: jest.fn() } }));
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
  });
});
