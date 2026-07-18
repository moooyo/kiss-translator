const POPUP_MANAGER_KEY = Symbol.for("kiss-translator.popup-manager");

jest.mock(
  "./shadowDomManager",
  () =>
    class MockShadowDomManager {
      constructor(options) {
        this.options = options;
      }

      get isVisible() {
        return false;
      }

      show() {}

      destroy() {}
    }
);

jest.mock("../views/Action", () => () => null);

jest.mock("../config", () => ({
  APP_CONSTS: { popupID: "kiss-translator-popup" },
  EVENT_KISS_INNER: "kiss-inner",
  MSG_POPUP_TOGGLE: "popup-toggle",
}));

const { PopupManager } = require("./popupManager");

describe("PopupManager singleton", () => {
  afterEach(() => {
    delete globalThis[POPUP_MANAGER_KEY];
    document.body.innerHTML = "";
  });

  test("keeps only one popup manager in the current window", () => {
    const first = new PopupManager({
      translator: {},
      processActions: jest.fn(),
    });
    const destroyFirst = jest.spyOn(first, "destroy");

    const second = new PopupManager({
      translator: {},
      processActions: jest.fn(),
    });

    expect(destroyFirst).toHaveBeenCalledTimes(1);
    expect(globalThis[POPUP_MANAGER_KEY]).toBe(second);

    second.destroy();
    expect(globalThis[POPUP_MANAGER_KEY]).toBeUndefined();
  });
});
