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
    apiMicrosoftDict.mockImplementation(() => new Promise(() => {}));
  });

  test("ignores hover changes while a clicked word is pinned", () => {
    const controller = new WordTooltipController({});
    const root = document.getElementById("captions");
    const [first, second] = root.querySelectorAll(".kiss-subtitle-word");
    controller.attachSpanListeners(root);

    first.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    second.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    second.dispatchEvent(new Event("pointerleave", { bubbles: true }));

    expect(controller.activeWordEl).toBe(first);
    expect(first.classList.contains("kiss-word-hover")).toBe(true);
    expect(second.classList.contains("kiss-word-hover")).toBe(false);

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
