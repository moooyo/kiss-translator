import { act } from "react";
import { createRoot } from "react-dom/client";
import ContentFab, { FAB_POPPER_MODIFIERS } from "./ContentFab";
import { MSG_POPUP_TOGGLE } from "../../config";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let mockIsVideoFullscreen = false;

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
jest.mock("../../hooks/useFullscreenDetect", () => ({
  useFullscreenDetect: () => ({ isVideoFullscreen: mockIsVideoFullscreen }),
}));
jest.mock("./Draggable", () => {
  const React = require("react");
  return ({ handler, children, snapEdge, edge, show }) =>
    React.createElement(
      "div",
      {
        "data-testid": "draggable",
        "data-snap-edge": String(snapEdge),
        "data-edge": edge || "",
        "data-show": String(show),
      },
      handler,
      children
    );
});

describe("ContentFab", () => {
  beforeEach(() => {
    mockIsVideoFullscreen = false;
  });

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

  test("preserves the saved edge and closes the menu in video fullscreen", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const props = {
      fabConfig: { edge: "right", fabClickAction: 0 },
      processActions: jest.fn(),
    };

    act(() => root.render(<ContentFab {...props} />));
    const draggable = container.querySelector('[data-testid="draggable"]');
    expect(draggable.dataset.edge).toBe("right");
    expect(draggable.dataset.show).toBe("true");

    act(() => container.querySelector(".kt-content-fab").click());
    expect(
      container.querySelector(".kt-content-fab-menu__item")
    ).not.toBeNull();

    mockIsVideoFullscreen = true;
    act(() => root.render(<ContentFab {...props} />));
    expect(draggable.dataset.show).toBe("false");
    expect(container.querySelector(".kt-content-fab-menu__item")).toBeNull();

    act(() => root.unmount());
  });
});
