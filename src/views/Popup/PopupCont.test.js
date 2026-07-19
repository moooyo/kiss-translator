import { act } from "react";
import { createRoot } from "react-dom/client";
import PopupCont from "./PopupCont";
import { getVisibleServices } from "./services";
import { MSG_RUNTIME_SETTING_PATCH } from "../../config";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockStyles = Array.from({ length: 7 }, (_, index) => ({
  styleSlug: `style_${index}`,
  styleName: `Style ${index}`,
  styleCode: `color: rgb(${index}, 0, 0);`,
}));
const mockUpdateSetting = jest.fn();
const mockSendBgMsg = jest.fn(async () => []);
let mockIsExt = false;

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key, fallback) => fallback || key,
}));

jest.mock("../../hooks/Setting", () => ({
  useSetting: () => ({
    setting: { blacklist: "" },
    updateSetting: mockUpdateSetting,
  }),
}));

jest.mock("../../hooks/CustomStyles", () => ({
  useAllTextStyles: () => ({ allTextStyles: mockStyles }),
}));

jest.mock("../../libs/msg", () => ({
  getCurTab: jest.fn(async () => ({ url: "https://example.com/page" })),
  sendBgMsg: (...args) => mockSendBgMsg(...args),
  sendTabMsg: jest.fn(async () => undefined),
}));

jest.mock("../../libs/client", () => ({
  get isExt() {
    return mockIsExt;
  },
}));
jest.mock("../../libs/cache", () => ({ tryClearCaches: jest.fn() }));
jest.mock("../../libs/rules", () => ({ saveRule: jest.fn() }));

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderPopupCont(props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const setting = {
    transApis: [
      {
        apiSlug: "google",
        apiName: "Google",
        apiType: "Google",
      },
    ],
    tranboxSetting: { transOpen: true },
    mouseHoverSetting: { useMouseHover: false },
    inputRule: { transOpen: true },
    subtitleSetting: { enabled: true },
    shortcuts: { toggleTranslate: ["AltLeft", "KeyQ"] },
  };
  const rule = {
    transOpen: "true",
    apiSlug: "google",
    fromLang: "auto",
    toLang: "zh-CN",
    textStyle: "style_6",
    autoScan: "true",
    transOnly: "false",
    hasRichText: "true",
    scanAll: "false",
    isPlainText: false,
  };

  act(() => {
    root.render(
      <PopupCont
        rule={rule}
        setting={setting}
        setRule={jest.fn()}
        setSetting={jest.fn()}
        handleOpenSetting={jest.fn()}
        {...props}
      />
    );
  });

  return {
    container,
    cleanup() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("PopupCont capability parity", () => {
  beforeEach(() => {
    mockIsExt = false;
    mockSendBgMsg.mockReset();
    mockSendBgMsg.mockResolvedValue([]);
    mockUpdateSetting.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("keeps the active style visible and expands to every style", async () => {
    const view = renderPopupCont();
    await flushEffects();

    const advancedButton = Array.from(
      view.container.querySelectorAll("button")
    ).find((button) => button.textContent.includes("popup_advanced_options"));
    act(() => advancedButton.click());
    expect(view.container.querySelectorAll("label label")).toHaveLength(0);

    let styleButtons = view.container.querySelectorAll(".kt-popup-style-chip");
    expect(styleButtons).toHaveLength(5);
    expect(
      view.container.querySelector(
        '.kt-popup-style-chip[aria-pressed="true"] small'
      ).textContent
    ).toBe("Style 6");

    const allStylesButton = Array.from(
      view.container.querySelectorAll("button")
    ).find((button) => button.textContent.includes("popup_all_styles"));
    act(() => allStylesButton.click());

    styleButtons = view.container.querySelectorAll(".kt-popup-style-chip");
    expect(styleButtons).toHaveLength(7);
    view.cleanup();
  });

  test("exposes support actions as a keyboard-accessible disclosure", async () => {
    const view = renderPopupCont();
    await flushEffects();

    const supportButton = Array.from(
      view.container.querySelectorAll("button")
    ).find((button) => button.textContent.includes("popup_support"));
    expect(supportButton.getAttribute("aria-expanded")).toBe("false");
    act(() => supportButton.click());

    const supportDisclosure = view.container.querySelector(".kt-popup-support");
    const supportLinks = supportDisclosure.querySelectorAll("a");
    expect(supportButton.getAttribute("aria-controls")).toBe(
      supportDisclosure.id
    );
    expect(supportDisclosure.getAttribute("aria-labelledby")).toBe(
      supportButton.id
    );
    expect(supportButton.compareDocumentPosition(supportDisclosure)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(
      supportButton.closest(".kt-popup-disclosure-row").nextElementSibling
    ).toBe(supportDisclosure);
    expect(supportLinks).toHaveLength(2);
    expect(supportLinks[0].textContent).toBe("comment_support");
    expect(supportLinks[1].textContent).toBe("appreciate_support");
    expect(supportDisclosure.getAttribute("role")).toBe("region");
    expect(supportLinks[0].hasAttribute("role")).toBe(false);
    expect(document.activeElement).toBe(supportLinks[0]);

    act(() => {
      supportLinks[0].dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });

    expect(view.container.querySelector(".kt-popup-support")).toBeNull();
    expect(supportButton.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(supportButton);
    view.cleanup();
  });

  test("places the content popup support disclosure after its trigger", async () => {
    const view = renderPopupCont({
      isContent: true,
      processActions: jest.fn(),
    });
    await flushEffects();

    const footerButtons = view.container.querySelectorAll(
      ".kt-popup-footer button"
    );
    const supportButton = footerButtons[footerButtons.length - 1];
    expect(supportButton.textContent).toContain("popup_support");

    act(() => supportButton.click());

    const supportDisclosure = view.container.querySelector(".kt-popup-support");
    const firstSupportLink = supportDisclosure.querySelector("a");
    expect(supportButton.compareDocumentPosition(supportDisclosure)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(supportButton.closest("footer").nextElementSibling).toBe(
      supportDisclosure
    );
    expect(supportButton.getAttribute("aria-controls")).toBe(
      supportDisclosure.id
    );
    expect(document.activeElement).toBe(firstSupportLink);
    view.cleanup();
  });

  test("formats stored physical shortcut codes for display", async () => {
    const view = renderPopupCont();
    await flushEffects();

    expect(
      view.container.querySelector(".kt-popup-hero__subtitle").textContent
    ).toContain("Alt+Q");
    expect(
      view.container.querySelector(".kt-popup-hero__subtitle").textContent
    ).not.toContain("AltLeft+KeyQ");
    view.cleanup();
  });

  test("uses the background as the only extension setting writer", async () => {
    mockIsExt = true;
    const view = renderPopupCont();
    await flushEffects();
    mockSendBgMsg.mockClear();

    const subtitleButton = Array.from(
      view.container.querySelectorAll(".kt-popup-scene")
    ).find((button) => button.textContent.includes("subtitle_translate"));
    act(() => subtitleButton.click());
    await flushEffects();

    expect(mockSendBgMsg).toHaveBeenCalledWith(MSG_RUNTIME_SETTING_PATCH, {
      scope: "current",
      patch: { subtitleSetting: { enabled: false } },
    });
    expect(mockUpdateSetting).not.toHaveBeenCalled();
    view.cleanup();
  });
});

describe("getVisibleServices", () => {
  const services = [
    { key: "builtin", name: "BuiltinAI" },
    { key: "google", name: "Google" },
    { key: "microsoft", name: "Microsoft" },
    { key: "deepl", name: "DeepL" },
  ];

  test("shows two services while preserving an active service outside the first two", () => {
    expect(getVisibleServices(services, "microsoft", false)).toEqual([
      services[0],
      services[2],
    ]);
  });

  test("shows every service after expanding more", () => {
    expect(getVisibleServices(services, "microsoft", true)).toEqual(services);
  });
});
