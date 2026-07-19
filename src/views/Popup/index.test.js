import { act } from "react";
import { createRoot } from "react-dom/client";
import Popup from ".";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockSendTabMsg = jest.fn();
let mockPopupContentAutofocus = false;

jest.mock("./loadData", () => ({
  loadPopupData: () => mockSendTabMsg(),
}));

jest.mock("../../libs/msg", () => ({
  sendBgMsg: jest.fn(),
  sendTabMsg: (...args) => mockSendTabMsg(...args),
}));

jest.mock("../../libs/browser", () => ({
  browser: { runtime: { openOptionsPage: jest.fn() } },
}));

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key) => key,
}));

jest.mock("../../hooks/Setting", () => ({
  useSetting: () => ({ setting: {} }),
}));

jest.mock("./Header", () => {
  const React = require("react");
  return () => React.createElement("div", null, "header");
});

jest.mock("./PopupCont", () => {
  const React = require("react");
  return () =>
    mockPopupContentAutofocus
      ? React.createElement("select", { autoFocus: true }, null)
      : React.createElement("div", null, "content");
});

jest.mock("../Selection/TranForm", () => {
  const React = require("react");
  return () => React.createElement("div", null, "translation");
});

describe("Popup focus", () => {
  beforeEach(() => {
    mockPopupContentAutofocus = false;
    mockSendTabMsg.mockResolvedValue(undefined);
    window.history.replaceState({}, "", "/popup.html");
  });

  test("focuses the popup shell instead of the first form control", async () => {
    const previousControl = document.createElement("select");
    document.body.appendChild(previousControl);
    previousControl.focus();

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Popup />);
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    });

    const shell = container.querySelector(".kt-popup-shell");
    expect(shell.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(shell);

    act(() => root.unmount());
    container.remove();
    previousControl.remove();
  });

  test("restores shell focus after asynchronously loaded controls mount", async () => {
    mockPopupContentAutofocus = true;
    mockSendTabMsg.mockResolvedValue({
      rule: { transOpen: "false" },
      setting: { darkMode: "auto" },
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Popup />);
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    });

    const shell = container.querySelector(".kt-popup-shell");
    const select = container.querySelector("select");
    expect(select).not.toBeNull();
    expect(document.activeElement).toBe(shell);

    await act(async () => {
      select.focus();
      window.dispatchEvent(new Event("focus"));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(shell);

    await act(async () => {
      select.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      select.focus();
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    });
    expect(document.activeElement).toBe(select);

    act(() => root.unmount());
    container.remove();
  });
});
