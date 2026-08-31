/* eslint-disable testing-library/no-container, testing-library/no-unnecessary-act */
import { act } from "react";
import { createRoot } from "react-dom/client";
import ContentFab from "./ContentFab";
import {
  MSG_OPEN_OPTIONS,
  MSG_OPEN_TRANBOX,
  MSG_POPUP_TOGGLE,
  MSG_TRANS_TOGGLE,
  MSG_TRANS_TOGGLE_STYLE,
} from "../../config";
import { sendBgMsg } from "../../libs/msg";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockIsVideoFullscreen = false;
let draggableProps = null;

jest.mock("../../hooks/Setting", () => ({
  SettingProvider: ({ children }) => children,
}));
jest.mock("../../hooks/M3Theme", () => ({
  __esModule: true,
  default: ({ children }) => {
    const React = require("react");
    return React.createElement("div", { className: "kt-m3-root" }, children);
  },
}));
jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key) => key,
}));
jest.mock("../../hooks/WindowSize", () => ({
  __esModule: true,
  default: () => ({ w: 800, h: 600 }),
}));
jest.mock("../../hooks/useFullscreenDetect", () => ({
  useFullscreenDetect: () => ({ isVideoFullscreen: mockIsVideoFullscreen }),
}));
jest.mock("../../libs/client", () => ({ isExt: true }));
jest.mock("../../libs/msg", () => ({ sendBgMsg: jest.fn() }));

// Draggable 只负责定位与拖拽，这里替换掉它以便直接触达悬浮球与菜单；
// onStart/onMove 保留成可调用的引用，用来模拟「拖过之后的那一下点击」。
jest.mock("./Draggable", () => {
  const React = require("react");
  return function Draggable(props) {
    draggableProps = props;
    return React.createElement(
      "div",
      { "data-testid": "draggable" },
      props.handler,
      props.children
    );
  };
});

describe("ContentFab action menu", () => {
  let container;
  let root;
  let processActions;

  beforeEach(() => {
    mockIsVideoFullscreen = false;
    draggableProps = null;
    processActions = jest.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    sendBgMsg.mockReset();
  });

  function render(fabConfig = {}) {
    act(() =>
      root.render(
        <ContentFab fabConfig={fabConfig} processActions={processActions} />
      )
    );
  }

  const fab = () => container.querySelector(".kt-content-fab");
  const menuItems = () =>
    Array.from(container.querySelectorAll(".kt-content-fab-menu__item"));
  const clickFab = () => act(() => fab().click());

  test("uses Material 3 regular FAB geometry for edge snapping", () => {
    render();

    expect(draggableProps).toEqual(
      expect.objectContaining({
        width: 56,
        height: 56,
        snapEdge: true,
        fitContent: true,
      })
    );
  });

  test("opens the action menu on click and lists every action", () => {
    render();
    expect(menuItems()).toHaveLength(0);
    expect(fab().getAttribute("aria-expanded")).toBe("false");
    const speedDialIcon = fab().querySelector(".MuiSpeedDialIcon-root");
    expect(fab().querySelectorAll(".MuiSpeedDialIcon-root svg")).toHaveLength(
      2
    );
    expect(
      speedDialIcon.querySelector(".MuiSpeedDialIcon-iconOpen")
    ).toBeNull();
    expect(
      speedDialIcon.querySelector(".MuiSpeedDialIcon-openIconOpen")
    ).toBeNull();

    clickFab();

    expect(fab().getAttribute("aria-expanded")).toBe("true");
    expect(fab().id).toBe("kt-content-fab-button");
    expect(fab().getAttribute("aria-controls")).toBe("kt-content-fab-menu");
    const menu = container.querySelector("#kt-content-fab-menu");
    expect(menu.getAttribute("aria-labelledby")).toBe(fab().id);
    expect(menu.closest(".kt-m3-root")).not.toBeNull();
    expect(menuItems().map((item) => item.textContent)).toEqual([
      "popup_translate_page",
      "text_style_alt",
      "selection_translate",
      "open_menu",
      "open_setting",
    ]);
    expect(fab().querySelectorAll(".MuiSpeedDialIcon-root svg")).toHaveLength(
      2
    );
    expect(
      speedDialIcon.querySelector(".MuiSpeedDialIcon-iconOpen")
    ).not.toBeNull();
    expect(
      speedDialIcon.querySelector(".MuiSpeedDialIcon-openIconOpen")
    ).not.toBeNull();
    expect(menuItems().every((item) => item.style.animationDelay === "")).toBe(
      true
    );

    clickFab();
    expect(
      speedDialIcon.querySelector(".MuiSpeedDialIcon-iconOpen")
    ).toBeNull();
    expect(
      speedDialIcon.querySelector(".MuiSpeedDialIcon-openIconOpen")
    ).toBeNull();
  });

  test.each([
    [0, MSG_TRANS_TOGGLE],
    [1, MSG_TRANS_TOGGLE_STYLE],
    [2, MSG_OPEN_TRANBOX],
    [3, MSG_POPUP_TOGGLE],
  ])("menu item %i dispatches its action and closes", (index, action) => {
    render();
    clickFab();

    act(() => menuItems()[index].click());

    expect(processActions).toHaveBeenCalledWith({ action });
    expect(menuItems()).toHaveLength(0);
    expect(document.activeElement).toBe(fab());
  });

  test.each(["Escape", "Tab"])(
    "%s closes the menu and restores focus to the FAB",
    (key) => {
      render();
      clickFab();
      menuItems()[0].focus();
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      });

      act(() => menuItems()[0].dispatchEvent(event));

      expect(event.defaultPrevented).toBe(true);
      expect(menuItems()).toHaveLength(0);
      expect(document.activeElement).toBe(fab());
    }
  );

  test("the settings item goes to the background, not through processActions", () => {
    render();
    clickFab();

    act(() => menuItems()[4].click());

    expect(sendBgMsg).toHaveBeenCalledWith(MSG_OPEN_OPTIONS);
    expect(processActions).not.toHaveBeenCalled();
    expect(menuItems()).toHaveLength(0);
  });

  // fabClickAction === 1 是既有设置项「单击直接翻译」。移植动作菜单不能把它吃掉，
  // 否则升级后这批用户的悬浮球会从「一下就翻译」变成「还要再点一次菜单」。
  test("fabClickAction=1 translates directly and never opens the menu", () => {
    render({ fabClickAction: 1 });

    expect(fab().getAttribute("aria-expanded")).toBeNull();
    expect(fab().getAttribute("aria-haspopup")).toBeNull();
    expect(fab().getAttribute("aria-controls")).toBeNull();
    expect(fab().querySelector(".MuiSpeedDialIcon-root")).toBeNull();
    expect(fab().querySelectorAll("svg")).toHaveLength(1);
    clickFab();

    expect(processActions).toHaveBeenCalledWith({ action: MSG_TRANS_TOGGLE });
    expect(menuItems()).toHaveLength(0);
    expect(draggableProps.expanded).toBe(false);
  });

  test("a drag suppresses the click that ends it", () => {
    render();

    act(() => {
      draggableProps.onStart();
      draggableProps.onMove();
    });
    clickFab();

    expect(processActions).not.toHaveBeenCalled();
    expect(menuItems()).toHaveLength(0);
  });

  // 悬浮球在视频全屏时会被隐藏。菜单若不跟着收起，就会剩下一个没有锚点、
  // 点不到也关不掉的悬空面板盖在视频上。
  test("entering video fullscreen closes an open menu", () => {
    render();
    clickFab();
    expect(menuItems()).toHaveLength(5);

    mockIsVideoFullscreen = true;
    act(() =>
      root.render(<ContentFab fabConfig={{}} processActions={processActions} />)
    );

    expect(menuItems()).toHaveLength(0);
  });
});
