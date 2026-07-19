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

  test("does not accumulate notifications across repeated teardown cycles", () => {
    document.body.innerHTML = "<div><div><video></video></div></div>";
    const videoEl = document.querySelector("video");
    const ui = createUi(videoEl);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      ui.showNotification(`cycle-${cycle}`, 1000);
      expect(document.querySelectorAll(".kiss-notification")).toHaveLength(1);
      expect(jest.getTimerCount()).toBe(1);

      ui.destroyNotification();
      expect(document.querySelectorAll(".kiss-notification")).toHaveLength(0);
      expect(jest.getTimerCount()).toBe(0);
    }

    ui.showNotification("resumed", 1000);
    expect(document.querySelectorAll(".kiss-notification")).toHaveLength(1);
    expect(document.querySelector(".kiss-notification").textContent).toBe(
      "resumed"
    );
  });

  test("destroys only the notification owned by the UI instance", () => {
    document.body.innerHTML = "<div><div><video></video></div></div>";
    const videoEl = document.querySelector("video");
    const ui = createUi(videoEl);
    const foreignNotification = document.createElement("div");
    foreignNotification.className = "kiss-notification";
    document.body.appendChild(foreignNotification);

    ui.showNotification("owned");
    expect(document.querySelectorAll(".kiss-notification")).toHaveLength(2);

    ui.destroyNotification();
    expect(document.querySelectorAll(".kiss-notification")).toHaveLength(1);
    expect(document.querySelector(".kiss-notification")).toBe(
      foreignNotification
    );
  });
});
