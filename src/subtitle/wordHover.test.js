import { apiMicrosoftDict } from "../apis";
import { saveFavoriteWordIfMissing } from "./favoriteWords";
import { WordTooltipController } from "./wordHover";

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

describe("WordTooltipController", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    apiMicrosoftDict.mockReset();
    saveFavoriteWordIfMissing.mockReset();
    saveFavoriteWordIfMissing.mockResolvedValue(false);
  });

  // 关闭按钮曾经写成内联 onclick，而所有 innerHTML 都要过
  // trustedTypesHelper.createHTML → 无配置的 DOMPurify.sanitize，
  // on* 属性会被一律剥掉。于是四个发行渠道里的 × 全都点不动。
  test.each([
    ["a dictionary result", { trs: [{ pos: "n.", def: "definition" }] }],
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

  // trs / aus / sentences 由 apiMicrosoftDict 以 `const trs = []` 起头再 push，
  // 所以「查到词条但没有释义」返回的是空数组——而空数组是真值。
  test("treats empty dictionary arrays as no result", async () => {
    apiMicrosoftDict.mockResolvedValue({ trs: [], aus: [], sentences: [] });
    const controller = new WordTooltipController({ autoFavWord: true });

    await controller.showWordTooltip("first");

    expect(saveFavoriteWordIfMissing).not.toHaveBeenCalled();
    expect(controller.tooltipEl.textContent).toContain("No definition found");
    controller.destroy();
  });

  test("still saves and renders a real dictionary result", async () => {
    apiMicrosoftDict.mockResolvedValue({
      trs: [{ pos: "n.", def: "a definition" }],
      aus: [],
      sentences: [],
    });
    const controller = new WordTooltipController({ autoFavWord: true });

    await controller.showWordTooltip("first");

    expect(saveFavoriteWordIfMissing).toHaveBeenCalledTimes(1);
    expect(controller.tooltipEl.textContent).toContain("a definition");
    expect(controller.tooltipEl.textContent).not.toContain(
      "No definition found"
    );
    controller.destroy();
  });
});
