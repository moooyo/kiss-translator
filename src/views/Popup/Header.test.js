/* eslint-disable testing-library/no-unnecessary-act */
import { act } from "react";
import { createRoot } from "react-dom/client";
import Header from "./Header";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key) => key,
}));

jest.mock("../../components/Logo", () => () => null);

// 这个文件原本测的是赞赏菜单。那个功能已经删掉:它指向的「评价」是我们没有的
// 商店页、「赞赏」是我们没有的捐赠页,对这个 fork 是两个死链接。
// 现在钉住的是删干净这件事本身 —— header 只剩独立窗口和设置两个动作。
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
