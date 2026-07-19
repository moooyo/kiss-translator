import { apiMicrosoftDict } from "../apis";
import { addWordHoverStyles, WordTooltipController } from "./wordHover";

jest.mock("../apis", () => ({ apiMicrosoftDict: jest.fn() }));
jest.mock("../libs/log", () => ({ logger: { info: jest.fn() } }));

describe("WordTooltipController pinned state", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="captions">
        <span class="kiss-subtitle-word" data-word="first">first</span>
        <span class="kiss-subtitle-word" data-word="second">second</span>
      </div>
    `;
    document.getElementById("kiss-word-hover-styles")?.remove();
    apiMicrosoftDict.mockClear();
    apiMicrosoftDict.mockImplementation(() => new Promise(() => {}));
  });

  test("ignores hover changes while a clicked word is pinned", () => {
    jest.useFakeTimers();
    const controller = new WordTooltipController({});
    const root = document.getElementById("captions");
    const [first, second] = root.querySelectorAll(".kiss-subtitle-word");
    controller.attachSpanListeners(root);

    first.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    second.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    second.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    jest.advanceTimersByTime(150);

    expect(controller.activeWordEl).toBe(first);
    expect(controller.isPinned).toBe(true);
    expect(controller.tooltipEl).not.toBeNull();
    expect(first.classList.contains("kiss-word-hover")).toBe(true);
    expect(second.classList.contains("kiss-word-hover")).toBe(false);

    controller.destroy();
    jest.useRealTimers();
  });

  test("adds button semantics and provides roving keyboard focus", () => {
    const controller = new WordTooltipController({});
    const root = document.getElementById("captions");
    const [first, second] = root.querySelectorAll(".kiss-subtitle-word");
    first.setAttribute("aria-label", "Existing accessible name");
    controller.attachSpanListeners(root);

    expect(first.getAttribute("role")).toBe("button");
    expect(first.getAttribute("aria-label")).toBe("Existing accessible name");
    expect(first.getAttribute("aria-pressed")).toBe("false");
    expect(first.getAttribute("tabindex")).toBe("0");
    expect(second.getAttribute("tabindex")).toBe("-1");

    first.focus();
    first.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );

    expect(document.activeElement).toBe(second);
    expect(first.getAttribute("tabindex")).toBe("-1");
    expect(second.getAttribute("tabindex")).toBe("0");
    controller.destroy();
    expect(first.getAttribute("aria-label")).toBe("Existing accessible name");
  });

  test.each(["Enter", " "])("pins a word with the %p key", (key) => {
    const getTimestamp = jest.fn(() => 42);
    const controller = new WordTooltipController({});
    const root = document.getElementById("captions");
    const first = root.querySelector(".kiss-subtitle-word");
    controller.attachSpanListeners(root, getTimestamp);
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });

    first.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(apiMicrosoftDict).toHaveBeenCalledTimes(1);
    expect(apiMicrosoftDict).toHaveBeenCalledWith("first");
    expect(getTimestamp).toHaveBeenCalledTimes(1);
    expect(first.getAttribute("aria-pressed")).toBe("true");
    expect(controller.activeWordEl).toBe(first);
    expect(controller.isPinned).toBe(true);
    controller.destroy();
  });

  test("does not duplicate listeners and removes them on destroy", () => {
    const controller = new WordTooltipController({});
    const root = document.getElementById("captions");
    const first = root.querySelector(".kiss-subtitle-word");
    controller.attachSpanListeners(root);
    controller.attachSpanListeners(root);

    first.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(apiMicrosoftDict).toHaveBeenCalledTimes(1);

    controller.destroy();
    expect(first.hasAttribute("role")).toBe(false);
    expect(first.hasAttribute("tabindex")).toBe(false);
    expect(first.hasAttribute("aria-pressed")).toBe(false);

    first.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(apiMicrosoftDict).toHaveBeenCalledTimes(1);
  });

  test("ignores a stale dictionary response after another lookup starts", async () => {
    const pending = [];
    apiMicrosoftDict.mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.push(resolve);
        })
    );
    const controller = new WordTooltipController({});
    const root = document.getElementById("captions");
    const [first, second] = root.querySelectorAll(".kiss-subtitle-word");
    controller.attachSpanListeners(root);

    first.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    second.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    pending[0]({ trs: [{ def: "first definition" }] });
    await Promise.resolve();

    expect(controller.tooltipEl.textContent).toBe("Looking up...");

    pending[1]({ trs: [{ def: "second definition" }] });
    await Promise.resolve();

    expect(controller.tooltipEl.textContent).toContain("second");
    expect(controller.tooltipEl.textContent).toContain("second definition");
    expect(controller.tooltipEl.textContent).not.toContain("first definition");
    controller.destroy();
  });

  test("builds tooltip colors from the shared M3 token set", () => {
    addWordHoverStyles({ brandColor: "violet", darkMode: "dark" });
    const css = document.getElementById("kiss-word-hover-styles").textContent;

    expect(css).toContain("--kt-pri: #D0BCFF;");
    expect(css).toContain("--kt-bg: #131314;");
    expect(css).not.toContain("@media (prefers-color-scheme: dark)");
  });
});
