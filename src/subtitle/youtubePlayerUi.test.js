import DomManager from "../libs/domManager.js";
import { YouTubePlayerUi } from "./youtubePlayerUi.js";

const mockDestroy = jest.fn();
const mockHide = jest.fn();
const mockShow = jest.fn();
const mockUpdateProps = jest.fn();

jest.mock("../libs/domManager.js", () => jest.fn());

jest.mock("../config", () => ({
  APP_NAME: "Kiss Translator",
}));

jest.mock("../libs/svg.js", () => ({
  createLogoSVG: ({ isSelected } = {}) => {
    const el = global.document.createElement("span");
    el.dataset.selected = isSelected ? "true" : "false";
    return el;
  },
}));

jest.mock("./Menus.js", () => ({
  Menus: () => null,
}));

describe("YouTubePlayerUi", () => {
  let setting;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    DomManager.mockImplementation(() => ({
      destroy: mockDestroy,
      hide: mockHide,
      show: mockShow,
      updateProps: mockUpdateProps,
      isVisible: true,
    }));
    document.body.innerHTML = "";
    setting = { hideSubtitleButton: false, showLoadNotification: true };
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  function createUi(videoEl = null) {
    return new YouTubePlayerUi({
      getSetting: () => setting,
      getMenuProps: () => ({ progressed: 0 }),
      getVideoEl: () => videoEl,
    });
  }

  test("removes and reinjects the subtitle toggle button", () => {
    document.body.innerHTML = '<div class="ytp-right-controls"></div>';
    const controls = document.querySelector(".ytp-right-controls");
    const ui = createUi();

    ui.injectToggleButton(controls);
    expect(document.querySelector(".kiss-subtitle-button")).not.toBeNull();

    setting.hideSubtitleButton = true;
    ui.removeToggleButton();
    expect(document.querySelector(".kiss-subtitle-button")).toBeNull();
    expect(mockDestroy).toHaveBeenCalledTimes(1);

    setting.hideSubtitleButton = false;
    ui.injectToggleButton(controls);
    expect(document.querySelector(".kiss-subtitle-button")).not.toBeNull();
  });

  test("keeps the subtitle menu button semantics in sync with visibility", () => {
    document.body.innerHTML = '<div class="ytp-right-controls"></div>';
    const controls = document.querySelector(".ytp-right-controls");
    const ui = createUi();

    ui.injectToggleButton(controls);
    const button = document.querySelector(".kiss-subtitle-button");

    expect(button.type).toBe("button");
    expect(button.getAttribute("aria-label")).toBe("Kiss Translator");
    expect(button.getAttribute("aria-controls")).toBe("kiss-subtitle-menus");
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.getAttribute("aria-expanded")).toBe("false");

    button.click();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.firstChild.dataset.selected).toBe("true");
    expect(mockShow).toHaveBeenCalledTimes(1);

    button.click();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.firstChild.dataset.selected).toBe("false");
    expect(mockHide).toHaveBeenCalledTimes(1);
  });

  test("collapses the menu and restores trigger focus on managed close", () => {
    document.body.innerHTML = '<div class="ytp-right-controls"></div>';
    const controls = document.querySelector(".ytp-right-controls");
    const ui = createUi();

    ui.injectToggleButton(controls);
    const button = document.querySelector(".kiss-subtitle-button");
    button.click();
    button.blur();

    const managedProps = DomManager.mock.calls[0][0].props;
    managedProps.onClose();
    jest.runOnlyPendingTimers();

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.firstChild.dataset.selected).toBe("false");
    expect(mockHide).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(button);
  });

  test("keeps the menu button collapsed when mounting fails", () => {
    DomManager.mockImplementationOnce(() => ({
      destroy: mockDestroy,
      hide: mockHide,
      show: mockShow,
      updateProps: mockUpdateProps,
      isVisible: false,
    }));
    document.body.innerHTML = '<div class="ytp-right-controls"></div>';
    const controls = document.querySelector(".ytp-right-controls");
    const ui = createUi();

    ui.injectToggleButton(controls);
    const button = document.querySelector(".kiss-subtitle-button");
    button.click();

    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.firstChild.dataset.selected).toBe("false");
    expect(mockUpdateProps).not.toHaveBeenCalled();
  });

  test("hides notification when loading notification setting is disabled", () => {
    document.body.innerHTML = "<div><div><video></video></div></div>";
    const videoEl = document.querySelector("video");
    const ui = createUi(videoEl);

    ui.showNotification("loading");
    const notification = document.querySelector(".kiss-notification");
    expect(notification.textContent).toBe("loading");
    expect(notification.style.opacity).toBe("1");

    setting.showLoadNotification = false;
    ui.showNotification("hidden");
    expect(notification.style.opacity).toBe("0");
  });
});
