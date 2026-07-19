import { act } from "react";
import { createRoot } from "react-dom/client";
import ContentFab, { FAB_POPPER_MODIFIERS } from "./ContentFab";
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
  test("flips and constrains the action menu at every viewport edge", () => {
    const flip = FAB_POPPER_MODIFIERS.find(({ name }) => name === "flip");
    const preventOverflow = FAB_POPPER_MODIFIERS.find(
      ({ name }) => name === "preventOverflow"
    );

    expect(flip.options.fallbackPlacements).toEqual(
      expect.arrayContaining(["top-start", "bottom-start", "right", "left"])
    );
    expect(preventOverflow).toEqual(
      expect.objectContaining({ enabled: true, options: { padding: 12 } })
    );
  });

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
