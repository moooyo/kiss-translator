import { act } from "react";
import { createRoot } from "react-dom/client";
import Layout from "./Layout";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-router-dom", () => ({
  Outlet: () => null,
  useLocation: () => ({ pathname: "/" }),
}));
jest.mock("../../hooks/I18n", () => ({ useI18n: () => (key) => key }));
jest.mock("./styles", () => ({ OPTIONS_STYLES: "" }));
jest.mock("./Header", () => {
  const React = require("react");
  return ({ onDrawerToggle, navigationOpen }) =>
    React.createElement(
      "button",
      {
        type: "button",
        "aria-expanded": navigationOpen,
        onClick: onDrawerToggle,
      },
      "menu"
    );
});
jest.mock("./Navigator", () => {
  const React = require("react");
  return ({ open, isMobile }) =>
    React.createElement(
      "aside",
      {
        id: "kt-options-navigation",
        "aria-hidden": isMobile && !open,
        inert: isMobile && !open ? "" : undefined,
      },
      React.createElement("input", { "aria-label": "search" }),
      React.createElement("a", { href: "#/" }, "overview")
    );
});

describe("mobile settings navigation", () => {
  beforeEach(() => {
    window.matchMedia = jest.fn(() => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
  });

  test("moves focus into the drawer and restores it after Escape", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<Layout />));

    const menuButton = container.querySelector("button");
    act(() => menuButton.click());
    expect(document.activeElement).toBe(
      container.querySelector('input[aria-label="search"]')
    );

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });
    expect(menuButton.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(menuButton);

    act(() => root.unmount());
    container.remove();
  });
});
