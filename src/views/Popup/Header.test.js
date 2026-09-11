/* eslint-disable testing-library/no-unnecessary-act */
import { act } from "react";
import { createRoot } from "react-dom/client";
import Header from "./Header";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key) => key,
}));

jest.mock("../../components/Logo", () => () => null);

// The fork offers window and settings actions without store or donation links.
describe("Popup Header actions", () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
  });

  const renderHeader = (props = {}) => {
    act(() => {
      root.render(
        <Header
          openSeparateWindow={jest.fn()}
          openSettings={jest.fn()}
          {...props}
        />
      );
    });
  };

  test("offers exactly the separate window and settings actions", () => {
    renderHeader();

    const buttons = container.querySelectorAll(
      ".kt-popup-header__actions button"
    );

    expect(
      [...buttons].map((button) => button.getAttribute("aria-label"))
    ).toEqual(["open_separate_window", "setting"]);
  });

  test("carries no donation or review entry point", () => {
    renderHeader();

    expect(container.querySelector('[aria-label="popup_support"]')).toBeNull();
    expect(container.textContent).not.toContain("appreciate_support");
    expect(container.textContent).not.toContain("comment_support");
  });

  test("collapses to a close button when hosted in the page", () => {
    const onClose = jest.fn();
    renderHeader({ onClose });

    const close = container.querySelector('[aria-label="close"]');
    expect(close).not.toBeNull();
    expect(
      container.querySelector('[aria-label="open_separate_window"]')
    ).toBeNull();

    act(() => close.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
