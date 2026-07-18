import { act } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_SUBTITLE_SETTING, OPT_TRANS_OPENAI } from "../config";
import { Menus } from "./Menus";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderMenus({
  autoTranslate = true,
  formData = {},
  progressed = 0,
  updateSetting = jest.fn(),
  downloadSubtitle = jest.fn(),
  openSettings,
  transApis = [],
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
