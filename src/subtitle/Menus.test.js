import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  DEFAULT_SUBTITLE_SETTING,
  OPT_TRANS_OPENAI,
  SUBTITLE_BACKGROUND_STYLES,
} from "../config";
import {
  MENU_STYLES,
  Menus,
  patchSubtitleBackgroundStyle,
  resolveSubtitleBackgroundMode,
} from "./Menus";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("subtitle control alignment", () => {
  test("centers switch thumbs and constrains selected labels", () => {
    expect(MENU_STYLES).toMatch(
      /\.kt-subtitle-switch::after\s*\{[^}]*top:\s*50%;[^}]*transform:\s*translateY\(-50%\);/
    );
    expect(MENU_STYLES).toMatch(
      /\.kt-subtitle-segmented button\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;/
    );
  });

  test("recognizes canonical and legacy background declarations", () => {
    expect(
      resolveSubtitleBackgroundMode(SUBTITLE_BACKGROUND_STYLES.gradient)
    ).toBe("gradient");
    expect(
      resolveSubtitleBackgroundMode(
        "background:linear-gradient(180deg,transparent,#000);"
      )
    ).toBe("gradient");
    expect(resolveSubtitleBackgroundMode(SUBTITLE_BACKGROUND_STYLES.none)).toBe(
      "none"
    );
  });

  test("patches only background properties when selecting a preset", () => {
    const source = [
      "/* keep the layout and custom tokens */",
      "--caption-padding: 12px;",
      "--caption-line-height: 1.6;",
      "padding: var(--caption-padding) 20px;",
      "line-height: var(--caption-line-height);",
      "background: var(--caption-background);",
      "background-color: #123456 /* keep the color note */;",
      "background-image: url(custom.png);",
      "backdrop-filter: saturate(1.2);",
      "border-radius: 24px;",
    ].join("\n");

    const patched = patchSubtitleBackgroundStyle(
      source,
      SUBTITLE_BACKGROUND_STYLES.gradient
    );

    expect(patched).toContain("/* keep the layout and custom tokens */");
    expect(patched).toContain("--caption-padding: 12px;");
    expect(patched).toContain("padding: var(--caption-padding) 20px;");
    expect(patched).toContain("line-height: var(--caption-line-height);");
    expect(patched).toContain("border-radius: 24px;");
    expect(patched).toContain("/* keep the color note */");
    expect(patched).not.toContain("background: var(--caption-background)");
    expect(patched).toContain("background-color: rgba(10, 12, 16, 0.62)");
    expect(patched).toContain(
      "background-image: linear-gradient(180deg, rgba(10, 12, 16, 0.08), rgba(10, 12, 16, 0.78))"
    );
    expect(patched).toContain("backdrop-filter: none");
  });
});

function renderMenus({
  autoTranslate = true,
  formData = {},
  progressed = 0,
  updateSetting = jest.fn(),
  downloadSubtitle = jest.fn(),
  openSettings,
  transApis = [],
  brandColor,
  darkMode,
} = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <Menus
        i18n={(key) => key}
        formData={{
          segSlug: "-",
          skipAd: false,
          isBilingual: true,
          blurTranslation: false,
          autoTranslate,
          aiContextSlug: "-",
          ...formData,
        }}
        progressed={progressed}
        updateSetting={updateSetting}
        downloadSubtitle={downloadSubtitle}
        openSettings={openSettings}
        transApis={transApis}
        brandColor={brandColor}
        darkMode={darkMode}
      />
    );
  });

  return {
    container,
    downloadSubtitle,
    updateSetting,
    cleanup() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("subtitle Menus", () => {
  test("keeps immediate translation enabled by default", () => {
    expect(DEFAULT_SUBTITLE_SETTING.autoTranslate).toBe(true);
  });

  test("uses the shared brand and dark-mode token set", () => {
    const view = renderMenus({ brandColor: "violet", darkMode: "dark" });
    const panel = view.container.querySelector(".kt-subtitle-panel");

    expect(panel.dataset.theme).toBe("dark");
    expect(panel.dataset.brand).toBe("violet");
    expect(panel.style.getPropertyValue("--kt-pri")).toBe("#D0BCFF");
    expect(panel.style.getPropertyValue("--kt-bg")).toBe("#131314");

    view.cleanup();
  });

  test("renders translation first and updates the current video state", () => {
    const view = renderMenus({ autoTranslate: false });
    const label = Array.from(view.container.querySelectorAll("div")).find(
      (element) =>
        element.textContent === "enable_subtitle_translate" &&
        element.children.length === 0
    );

    expect(
      view.container.textContent.startsWith("enable_subtitle_translate")
    ).toBe(true);

    act(() => {
      label.parentElement.click();
    });

    expect(view.updateSetting).toHaveBeenCalledWith({
      name: "autoTranslate",
      value: true,
    });
    view.cleanup();
  });

  test("updates the AI context service from the player panel", () => {
    const view = renderMenus({
      transApis: [
        {
          apiType: OPT_TRANS_OPENAI,
          apiSlug: "openai",
          apiName: "OpenAI",
        },
      ],
    });
    const contextSelect = Array.from(
      view.container.querySelectorAll("select")
    ).find((select) =>
      select.parentElement.textContent.includes("ai_enhanced_context")
    );

    act(() => {
      contextSelect.value = "openai";
      contextSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(view.updateSetting).toHaveBeenCalledWith({
      name: "aiContextSlug",
      value: "openai",
    });
    view.cleanup();
  });

  test("reflects the current player menu settings", () => {
    const view = renderMenus({
      formData: {
        aiContextSlug: "openai",
        apiSlug: "openai",
        displayOrder: "translation-first",
        windowStyle: "background:linear-gradient(180deg,transparent,#000);",
      },
      transApis: [
        {
          apiType: OPT_TRANS_OPENAI,
          apiSlug: "openai",
          apiName: "OpenAI",
        },
      ],
    });

    expect(
      view.container.querySelector('select[name="aiContextSlug"]').value
    ).toBe("openai");
    expect(view.container.querySelector('select[name="apiSlug"]').value).toBe(
      "openai"
    );
    expect(
      Array.from(view.container.querySelectorAll('button[aria-pressed="true"]'))
        .map((button) => button.textContent)
        .sort()
    ).toEqual(["subtitle_background_gradient", "translation_first"].sort());
    view.cleanup();
  });

  test("downloads the processed portion before completion", () => {
    const view = renderMenus({ progressed: 64 });
    const downloadButton = view.container.querySelector(
      ".kt-subtitle-download"
    );

    expect(downloadButton.disabled).toBe(false);
    expect(downloadButton.dataset.partial).toBe("true");
    expect(downloadButton.textContent).toBe(
      "download_processed_subtitles · 64%"
    );

    act(() => downloadButton.click());
    expect(view.downloadSubtitle).toHaveBeenCalledTimes(1);
    view.cleanup();
  });

  test("keeps download disabled until processed subtitles exist", () => {
    const view = renderMenus({ progressed: 0 });
    const downloadButton = view.container.querySelector(
      ".kt-subtitle-download"
    );

    expect(downloadButton.disabled).toBe(true);
    expect(downloadButton.textContent).toBe("waiting_subtitles · 0%");
    view.cleanup();
  });

  test("updates subtitle scale and opens the complete settings page", () => {
    const openSettings = jest.fn();
    const view = renderMenus({
      formData: { fontScale: 120 },
      openSettings,
    });
    const range = view.container.querySelector('input[name="fontScale"]');
    expect(range.value).toBe("120");

    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      ).set.call(range, "135");
      range.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(view.updateSetting).toHaveBeenCalledWith({
      name: "fontScale",
      value: 135,
    });

    act(() => {
      view.container.querySelector(".kt-subtitle-all-settings").click();
    });
    expect(openSettings).toHaveBeenCalledTimes(1);
    view.cleanup();
  });
});
