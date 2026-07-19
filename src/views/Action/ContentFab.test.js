import { act } from "react";
import { createRoot } from "react-dom/client";
import ContentFab from "./ContentFab";
import { MSG_POPUP_TOGGLE } from "../../config";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../hooks/Setting", () => ({
  SettingProvider: ({ children }) => children,
}));
jest.mock("../../hooks/Theme", () => ({
  __esModule: true,
  default: ({ children }) => children,
}));
jest.mock("../../hooks/I18n", () => ({ useI18n: () => (key) => key }));
jest.mock("../../hooks/WindowSize", () => ({
  __esModule: true,
  default: () => ({ w: 1280, h: 720 }),
}));
jest.mock("../../libs/client", () => ({ isExt: false }));
jest.mock("../../libs/msg", () => ({ sendBgMsg: jest.fn() }));
jest.mock("./Draggable", () => {
  const React = require("react");
  return ({ handler, children, snapEdge }) =>
    React.createElement(
      "div",
      { "data-testid": "draggable", "data-snap-edge": String(snapEdge) },
      handler,
      children
    );
});

describe("ContentFab", () => {
  test("keeps edge snapping and exposes the full popup action", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const processActions = jest.fn();

    act(() => {
      root.render(
        <ContentFab
          fabConfig={{ fabClickAction: 0 }}
          processActions={processActions}
        />
      );
    });

    expect(
      container.querySelector('[data-testid="draggable"]').dataset.snapEdge
    ).toBe("true");
    act(() => container.querySelector(".kt-content-fab").click());
    const popupButton = Array.from(
      container.querySelectorAll(".kt-content-fab-menu__item")
    ).find((button) => button.textContent.includes("open_menu"));
    expect(popupButton).toBeDefined();
    act(() => popupButton.click());
    expect(processActions).toHaveBeenCalledWith({
      action: MSG_POPUP_TOGGLE,
    });

    act(() => root.unmount());
  });
});
