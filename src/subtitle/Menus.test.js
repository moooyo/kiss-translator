import { act } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_SUBTITLE_SETTING } from "../config";
import { Menus } from "./Menus";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderMenus({
  autoTranslate = true,
  displayOrder = "original-first",
  updateSetting = jest.fn(),
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
          displayOrder,
        }}
        updateSetting={updateSetting}
        downloadSubtitle={jest.fn()}
        transApis={[]}
      />
    );
  });

  return {
    container,
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

  test("keeps automatic subtitle word favorites disabled by default", () => {
    expect(DEFAULT_SUBTITLE_SETTING.autoFavWord).toBe(false);
  });

  // 这个控件的管路本来就是通的（YouTubeCaptionProvider 路由、
  // BilingualSubtitleManager 读取），此前只是播放器内菜单没有入口。
  // 断言的是**写出的 name/value**，不只是渲染出来了 —— 名字写错的话
  // provider 那条 `name === "displayOrder"` 分支就接不到。
  test("lets the in-player menu switch bilingual display order", () => {
    const view = renderMenus({ displayOrder: "original-first" });

    expect(view.container.textContent).toContain("trans_order");

    const trigger = Array.from(view.container.querySelectorAll("div")).find(
      (element) => element.textContent === "original_first"
    );
    act(() => trigger.click());

    const option = Array.from(view.container.querySelectorAll("div")).find(
      (element) => element.textContent === "translation_first"
    );
    act(() => option.click());

    expect(view.updateSetting).toHaveBeenCalledWith({
      name: "displayOrder",
      value: "translation-first",
    });
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
});
