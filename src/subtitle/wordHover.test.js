import { apiMicrosoftDict } from "../apis";
import { saveFavoriteWordIfMissing } from "./favoriteWords";
import { addWordHoverStyles, WordTooltipController } from "./wordHover";

jest.mock("../apis", () => ({ apiMicrosoftDict: jest.fn() }));
jest.mock("../libs/log", () => ({ logger: { info: jest.fn() } }));
jest.mock("./favoriteWords", () => ({
  createFavoriteButton: ({ word }) => {
    const button = global.document.createElement("button");
    button.type = "button";
    button.className = "kiss-favorite-word-button";
    button.textContent = "♡";
    button.setAttribute("aria-label", `Favorite ${word}`);
    return button;
  },
  saveFavoriteWordIfMissing: jest.fn(),
}));

describe("WordTooltipController hover behavior", () => {
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
    saveFavoriteWordIfMissing.mockReset();
    saveFavoriteWordIfMissing.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("looks up a word after hovering and hides the tooltip after leaving", () => {
    jest.useFakeTimers();
    const getTimestamp = jest.fn(() => 42);
    const controller = new WordTooltipController({});
    const root = document.getElementById("captions");
    const first = root.querySelector(".kiss-subtitle-word");
    controller.attachSpanListeners(root, getTimestamp);

    first.dispatchEvent(new Event("pointerenter", { bubbles: true }));

    expect(first.classList.contains("kiss-word-hover")).toBe(true);
    expect(controller.activeWordEl).toBe(first);
    jest.advanceTimersByTime(299);
    expect(apiMicrosoftDict).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(apiMicrosoftDict).toHaveBeenCalledWith("first");
    expect(getTimestamp).toHaveBeenCalledTimes(1);
    expect(controller.tooltipEl).not.toBeNull();

    first.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    expect(first.classList.contains("kiss-word-hover")).toBe(false);
    expect(controller.activeWordEl).toBeNull();

    jest.advanceTimersByTime(100);
    expect(controller.tooltipEl).toBeNull();
    controller.destroy();
  });

  test("does not duplicate listeners and removes them on destroy", () => {
    jest.useFakeTimers();
    const controller = new WordTooltipController({});
    const root = document.getElementById("captions");
    const first = root.querySelector(".kiss-subtitle-word");
    controller.attachSpanListeners(root);
    controller.attachSpanListeners(root);

    first.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    jest.advanceTimersByTime(300);
    expect(apiMicrosoftDict).toHaveBeenCalledTimes(1);

    controller.destroy();
    first.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    jest.advanceTimersByTime(300);
    expect(apiMicrosoftDict).toHaveBeenCalledTimes(1);
  });

  test("keeps listeners for detached batches until pruning is requested", () => {
    jest.useFakeTimers();
    const controller = new WordTooltipController({});
    const detachedRoot = document.createElement("div");
    const connectedRoot = document.createElement("div");
    detachedRoot.innerHTML =
      '<span class="kiss-subtitle-word" data-word="first">first</span>';
    connectedRoot.innerHTML =
      '<span class="kiss-subtitle-word" data-word="second">second</span>';
    const first = detachedRoot.firstElementChild;
    const second = connectedRoot.firstElementChild;
    document.body.appendChild(connectedRoot);

    controller.attachSpanListeners(detachedRoot);
    controller.attachSpanListeners(connectedRoot);
    controller.pruneDetachedSpanListeners();

    first.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    second.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    jest.advanceTimersByTime(300);

    expect(apiMicrosoftDict).toHaveBeenCalledTimes(1);
    expect(apiMicrosoftDict).toHaveBeenCalledWith("second");
    controller.destroy();
  });

  test("clears pending hover state when the active word is pruned", () => {
    jest.useFakeTimers();
    const controller = new WordTooltipController({});
    const root = document.getElementById("captions");
    const first = root.querySelector(".kiss-subtitle-word");
    controller.attachSpanListeners(root);

    first.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    expect(controller.activeWordEl).toBe(first);

    root.remove();
    controller.pruneDetachedSpanListeners();
    jest.advanceTimersByTime(300);

    expect(controller.activeWordEl).toBeNull();
    expect(controller.tooltipEl).toBeNull();
    expect(apiMicrosoftDict).not.toHaveBeenCalled();
    controller.destroy();
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

    const firstLookup = controller.showWordTooltip("first");
    const secondLookup = controller.showWordTooltip("second");
    pending[0]({ trs: [{ def: "first definition" }] });
    await firstLookup;

    expect(controller.tooltipEl.textContent).toBe("Looking up...");

    pending[1]({ trs: [{ def: "second definition" }] });
    await secondLookup;

    expect(controller.tooltipEl.textContent).toContain("second");
    expect(controller.tooltipEl.textContent).toContain("second definition");
    expect(controller.tooltipEl.textContent).not.toContain("first definition");
    controller.destroy();
  });

  test("keeps a successful definition visible when automatic saving fails", async () => {
    apiMicrosoftDict.mockResolvedValue({ trs: [{ def: "definition" }] });
    saveFavoriteWordIfMissing.mockRejectedValue(new Error("save failed"));
    const controller = new WordTooltipController({ autoFavWord: true });

    await controller.showWordTooltip("first");

    expect(controller.tooltipEl.textContent).toContain("definition");
    expect(controller.tooltipEl.textContent).not.toContain(
      "Failed to load definition"
    );
    controller.destroy();
  });

  test("does not render a stale lookup after automatic saving completes", async () => {
    let resolveFirstSave;
    apiMicrosoftDict.mockImplementation((word) =>
      Promise.resolve({ trs: [{ def: `${word} definition` }] })
    );
    saveFavoriteWordIfMissing
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstSave = resolve;
          })
      )
      .mockResolvedValue(false);
    const controller = new WordTooltipController({ autoFavWord: true });

    const firstLookup = controller.showWordTooltip("first");
    await Promise.resolve();
    await Promise.resolve();
    const secondLookup = controller.showWordTooltip("second");
    await secondLookup;
    resolveFirstSave(true);
    await firstLookup;

    expect(controller.tooltipEl.textContent).toContain("second definition");
    expect(controller.tooltipEl.textContent).not.toContain("first definition");
    controller.destroy();
  });

  test("does not automatically save empty dictionary arrays", async () => {
    apiMicrosoftDict.mockResolvedValue({ trs: [], aus: [], sentences: [] });
    const controller = new WordTooltipController({ autoFavWord: true });

    await controller.showWordTooltip("first");

    expect(saveFavoriteWordIfMissing).not.toHaveBeenCalled();
    expect(controller.tooltipEl.textContent).toContain("No definition found");
    controller.destroy();
  });

  test.each([
    ["a dictionary result", { trs: [{ def: "definition" }] }],
    ["an empty dictionary result", {}],
    ["a failed dictionary request", new Error("lookup failed")],
  ])("closes the tooltip after %s", async (_case, result) => {
    if (result instanceof Error) {
      apiMicrosoftDict.mockRejectedValue(result);
    } else {
      apiMicrosoftDict.mockResolvedValue(result);
    }
    const controller = new WordTooltipController({});

    await controller.showWordTooltip("first");
    const tooltip = controller.tooltipEl;
    const closeButton = tooltip.querySelector(".kiss-word-tooltip-close");

    expect(closeButton).not.toBeNull();
    expect(closeButton.hasAttribute("onclick")).toBe(false);
    closeButton.click();
    expect(controller.tooltipEl).toBeNull();
    expect(tooltip.isConnected).toBe(false);
    controller.destroy();
  });

  test("builds tooltip colors from the shared M3 token set", () => {
    addWordHoverStyles({ brandColor: "violet", darkMode: "dark" });
    const css = document.getElementById("kiss-word-hover-styles").textContent;

    expect(css).toContain("--kt-pri: #D0BCFF;");
    expect(css).toContain("--kt-bg: #131314;");
    expect(css).toContain(".kiss-word-tooltip-close");
    expect(css).not.toContain("@media (prefers-color-scheme: dark)");
  });
});
