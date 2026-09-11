import { act } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_SUBTITLE_SETTING } from "../config";
import { Menus } from "./Menus";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderMenus({
  apiSlug = "api-a",
  autoTranslate = true,
  displayOrder = "original-first",
  updateSetting = jest.fn(),
  downloadSubtitle = jest.fn(),
  transApis = [],
  progressed = 0,
  onClose = jest.fn(),
} = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <Menus
        i18n={(key) => key}
        formData={{
          apiSlug,
          segSlug: "-",
          skipAd: false,
          isBilingual: true,
          blurTranslation: false,
          autoTranslate,
          aiContextSlug: "-",
          displayOrder,
        }}
        updateSetting={updateSetting}
        downloadSubtitle={downloadSubtitle}
        transApis={transApis}
        progressed={progressed}
        onClose={onClose}
      />
    );
  });

  return {
    container,
    updateSetting,
    downloadSubtitle,
    onClose,
    cleanup() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function dispatchKey(element, key, options = {}) {
  let event;
  act(() => {
    event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    });
    element.dispatchEvent(event);
  });
  return event;
}

describe("subtitle Menus", () => {
  test("keeps immediate translation enabled by default", () => {
    expect(DEFAULT_SUBTITLE_SETTING.autoTranslate).toBe(true);
  });

  test("exposes the composite controls as a named dialog", () => {
    const view = renderMenus();
    const dialog = view.container.querySelector('[role="dialog"]');

    expect(dialog.getAttribute("aria-label")).toBe("enable_subtitle_translate");
    expect(document.activeElement).toBe(
      dialog.querySelector('button[role="switch"]')
    );
    view.cleanup();
  });

  test("closes on Escape", () => {
    const view = renderMenus();
    const dialog = view.container.querySelector('[role="dialog"]');

    const event = dispatchKey(dialog, "Escape");

    expect(event.defaultPrevented).toBe(true);
    expect(view.onClose).toHaveBeenCalledTimes(1);
    view.cleanup();
  });

  test("renders an animated native switch with explicit ARIA state", () => {
    const view = renderMenus();
    const control = view.container.querySelector(
      '[role="switch"][aria-label="enable_subtitle_translate"]'
    );
    const track = control.querySelector('[aria-hidden="true"]');

    expect(control.tagName).toBe("BUTTON");
    expect(control.type).toBe("button");
    expect(control.getAttribute("aria-checked")).toBe("true");
    expect(control.getAttribute("aria-disabled")).toBe("false");
    expect(track.style.borderRadius).toBe("12px");
    expect(track.style.transition).toContain("background");
    expect(track.firstElementChild.style.borderRadius).toBe("10px");
    expect(track.firstElementChild.style.transition).toContain("transform");
    view.cleanup();
  });

  test.each(["Enter", " "])(
    "toggles the switch once with the %p key",
    (key) => {
      const view = renderMenus({ autoTranslate: false });
      const control = view.container.querySelector(
        '[role="switch"][aria-label="enable_subtitle_translate"]'
      );

      const event = dispatchKey(control, key);

      expect(event.defaultPrevented).toBe(true);
      expect(view.updateSetting).toHaveBeenCalledTimes(1);
      expect(view.updateSetting).toHaveBeenCalledWith({
        name: "autoTranslate",
        value: true,
      });
      view.cleanup();
    }
  );

  test("ignores repeated keyboard activation", () => {
    const view = renderMenus({ autoTranslate: false });
    const control = view.container.querySelector(
      '[role="switch"][aria-label="enable_subtitle_translate"]'
    );

    const event = dispatchKey(control, " ", { repeat: true });

    expect(event.defaultPrevented).toBe(true);
    expect(view.updateSetting).not.toHaveBeenCalled();
    view.cleanup();
  });

  test("keeps automatic subtitle word favorites disabled by default", () => {
    expect(DEFAULT_SUBTITLE_SETTING.autoFavWord).toBe(false);
  });

  test("lets the in-player menu switch bilingual display order", () => {
    const view = renderMenus({ displayOrder: "original-first" });
    const trigger = view.container.querySelector(
      '[role="button"][aria-haspopup="listbox"][aria-label^="trans_order:"]'
    );
    act(() => trigger.click());

    const option = Array.from(
      view.container.querySelectorAll('[role="option"]')
    ).find((element) => element.textContent === "translation_first");
    act(() => option.click());

    expect(view.updateSetting).toHaveBeenCalledWith({
      name: "displayOrder",
      value: "translation-first",
    });
    view.cleanup();
  });

  test("supports keyboard listbox navigation and returns focus on Escape", () => {
    const view = renderMenus({ displayOrder: "original-first" });
    const trigger = view.container.querySelector(
      '[role="button"][aria-haspopup="listbox"][aria-label^="trans_order:"]'
    );

    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("aria-label")).toBe(
      "trans_order: original_first"
    );
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    dispatchKey(trigger, "Enter");

    let listbox = view.container.querySelector('[role="listbox"]');
    let options = Array.from(listbox.querySelectorAll('[role="option"]'));
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.tabIndex).toBe(-1);
    expect(options.every((option) => option.tagName === "BUTTON")).toBe(true);
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    expect(options[0].tabIndex).toBe(0);
    expect(options[1].tabIndex).toBe(-1);
    expect(document.activeElement).toBe(options[0]);

    dispatchKey(options[0], "Enter", { repeat: true });
    expect(view.updateSetting).not.toHaveBeenCalled();
    expect(view.container.querySelector('[role="listbox"]')).toBe(listbox);

    dispatchKey(options[0], "ArrowDown");
    expect(options[0].tabIndex).toBe(-1);
    expect(options[1].tabIndex).toBe(0);
    expect(document.activeElement).toBe(options[1]);

    dispatchKey(options[1], "Escape");
    expect(view.container.querySelector('[role="listbox"]')).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);

    dispatchKey(trigger, " ");
    listbox = view.container.querySelector('[role="listbox"]');
    options = Array.from(listbox.querySelectorAll('[role="option"]'));
    dispatchKey(options[1], " ");

    expect(view.updateSetting).toHaveBeenCalledWith({
      name: "displayOrder",
      value: "translation-first",
    });
    expect(view.container.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    view.cleanup();
  });

  test("closes the listbox when focus leaves without stealing focus", () => {
    const view = renderMenus({ displayOrder: "original-first" });
    const trigger = view.container.querySelector(
      '[role="button"][aria-haspopup="listbox"][aria-label^="trans_order:"]'
    );
    const outsideButton = document.createElement("button");
    document.body.appendChild(outsideButton);

    dispatchKey(trigger, "Enter");
    const option = view.container.querySelector('[role="option"]');
    dispatchKey(option, "Tab");
    act(() => outsideButton.focus());

    expect(view.container.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(outsideButton);
    outsideButton.remove();
    view.cleanup();
  });

  test("closes the listbox when a non-focusable page area is pressed", () => {
    const view = renderMenus({ displayOrder: "original-first" });
    const trigger = view.container.querySelector(
      '[role="button"][aria-haspopup="listbox"][aria-label^="trans_order:"]'
    );
    const pageSurface = document.createElement("div");
    document.body.appendChild(pageSurface);

    dispatchKey(trigger, "Enter");
    expect(view.container.querySelector('[role="listbox"]')).not.toBeNull();
    act(() => {
      pageSurface.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, cancelable: true })
      );
    });

    expect(view.container.querySelector('[role="listbox"]')).toBeNull();
    pageSurface.remove();
    view.cleanup();
  });

  test("skips the trigger and closes the listbox on backward focus exit", () => {
    const view = renderMenus({ displayOrder: "original-first" });
    const trigger = view.container.querySelector(
      '[role="button"][aria-haspopup="listbox"][aria-label^="trans_order:"]'
    );
    const beforeButton = document.createElement("button");
    view.container.before(beforeButton);

    dispatchKey(trigger, "Enter");
    const option = view.container.querySelector('[role="option"]');
    expect(trigger.tabIndex).toBe(-1);
    dispatchKey(option, "Tab", { shiftKey: true });
    act(() => beforeButton.focus());

    expect(view.container.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(beforeButton);
    beforeButton.remove();
    view.cleanup();
  });

  test("keeps a disabled select trigger inert", () => {
    const view = renderMenus();
    const trigger = view.container.querySelector(
      '[role="button"][aria-haspopup="listbox"][aria-label^="ai_segmentation:"]'
    );

    expect(trigger.disabled).toBe(true);
    expect(trigger.getAttribute("aria-disabled")).toBe("true");
    dispatchKey(trigger, "Enter");
    act(() => trigger.click());

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(view.container.querySelector('[role="listbox"]')).toBeNull();
    expect(view.updateSetting).not.toHaveBeenCalled();
    view.cleanup();
  });

  test.each(["Enter", " "])(
    "activates the download button once with the %p key",
    (key) => {
      const view = renderMenus({ progressed: 100 });
      const button = Array.from(
        view.container.querySelectorAll('button[role="button"]')
      ).find((element) => element.textContent.includes("download_subtitles"));

      const event = dispatchKey(button, key);

      expect(event.defaultPrevented).toBe(true);
      expect(view.downloadSubtitle).toHaveBeenCalledTimes(1);
      view.cleanup();
    }
  );

  test("disables subtitle download while no result is available", () => {
    const view = renderMenus({ progressed: 0 });
    const button = Array.from(
      view.container.querySelectorAll('button[role="button"]')
    ).find((element) => element.textContent.includes("waiting_subtitles"));

    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    view.cleanup();
  });

  test("renders translation first and updates the current video state", () => {
    const view = renderMenus({ autoTranslate: false });
    const control = view.container.querySelector(
      '[role="switch"][aria-label="enable_subtitle_translate"]'
    );

    expect(
      view.container.textContent.startsWith("enable_subtitle_translate")
    ).toBe(true);

    act(() => control.click());

    expect(view.updateSetting).toHaveBeenCalledWith({
      name: "autoTranslate",
      value: true,
    });
    view.cleanup();
  });

  test("renders enabled translation services immediately after the toggle", () => {
    const view = renderMenus({
      transApis: [
        { apiSlug: "api-a", apiName: "API A", apiType: "builtin" },
        { apiSlug: "api-b", apiName: "API B", apiType: "builtin" },
        {
          apiSlug: "api-disabled",
          apiName: "Disabled API",
          apiType: "builtin",
          isDisabled: true,
        },
      ],
    });
    const menuItems = view.container.firstElementChild.children;

    expect(menuItems[0].textContent).toContain("enable_subtitle_translate");
    expect(menuItems[1].textContent).toContain("translate_service");
    expect(menuItems[2].textContent).toContain("ai_segmentation");

    act(() => {
      menuItems[1].firstElementChild.click();
    });

    expect(view.container.textContent).toContain("API A");
    expect(view.container.textContent).toContain("API B");
    expect(view.container.textContent).not.toContain("Disabled API");

    const apiBOption = Array.from(
      view.container.querySelectorAll('[role="option"]')
    ).find((element) => element.textContent === "API B");
    act(() => {
      apiBOption.click();
    });

    expect(view.updateSetting).toHaveBeenCalledWith({
      name: "apiSlug",
      value: "api-b",
    });
    view.cleanup();
  });

  test("disables translation service selection when no API is enabled", () => {
    const view = renderMenus({
      transApis: [
        {
          apiSlug: "api-disabled",
          apiName: "Disabled API",
          apiType: "builtin",
          isDisabled: true,
        },
      ],
    });
    const serviceMenuItem = view.container.firstElementChild.children[1];

    act(() => {
      serviceMenuItem.firstElementChild.click();
    });

    expect(view.container.textContent).not.toContain("Disabled API");
    expect(view.updateSetting).not.toHaveBeenCalled();
    view.cleanup();
  });
});
