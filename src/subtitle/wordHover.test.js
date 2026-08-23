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

  // 悬停有 300ms 延时、移出有 100ms 延时，快速掠过两个词时两次查词必然重叠。
  // 早先的实现在 await 之后直接写 this.tooltipEl，而那时它已经指向新词的气泡，
  // 于是慢响应会把上一个词的标题、释义和收藏按钮整个画进当前这个词的气泡里。
  test("a slow lookup does not overwrite the tooltip of a newer word", async () => {
    let resolveFirst;
    apiMicrosoftDict
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce({
        trs: [{ pos: "n.", def: "second definition" }],
      });
    const controller = new WordTooltipController({});

    const firstLookup = controller.showWordTooltip("first");
    await controller.showWordTooltip("second");
    const secondTooltip = controller.tooltipEl;

    resolveFirst({ trs: [{ pos: "n.", def: "first definition" }] });
    await firstLookup;

    expect(controller.tooltipEl).toBe(secondTooltip);
    expect(
      secondTooltip.querySelector(".kiss-word-tooltip-header span").textContent
    ).toBe("second");
    expect(secondTooltip.textContent).toContain("second definition");
    expect(secondTooltip.textContent).not.toContain("first definition");
    controller.destroy();
  });

  test("a slow failed lookup does not overwrite the tooltip of a newer word", async () => {
    let rejectFirst;
    apiMicrosoftDict
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFirst = reject;
          })
      )
      .mockResolvedValueOnce({
        trs: [{ pos: "n.", def: "second definition" }],
      });
    const controller = new WordTooltipController({});

    const firstLookup = controller.showWordTooltip("first");
    await controller.showWordTooltip("second");
    const secondTooltip = controller.tooltipEl;

    rejectFirst(new Error("lookup failed"));
    await firstLookup;

    expect(secondTooltip.textContent).toContain("second definition");
    expect(secondTooltip.textContent).not.toContain(
      "Failed to load definition"
    );
    controller.destroy();
  });

  // 身份守卫只挡 DOM 写入。用户确实查了那个词，晚到的结果仍应进生词表。
  test("a stale lookup still records its word in the vocabulary list", async () => {
    const added = [];
    const onAddWord = (event) => added.push(event.detail.word);
    document.addEventListener("kiss-add-word", onAddWord);

    let resolveFirst;
    apiMicrosoftDict
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce({ trs: [{ pos: "n.", def: "second" }] });
    const controller = new WordTooltipController({});

    const firstLookup = controller.showWordTooltip("first");
    await controller.showWordTooltip("second");
    resolveFirst({ trs: [{ pos: "n.", def: "first" }] });
    await firstLookup;

    expect(added).toEqual(["second", "first"]);
    document.removeEventListener("kiss-add-word", onAddWord);
    controller.destroy();
  });

  // 收藏写存储失败曾经会掉进外层 catch，把一次成功的查词显示成查询失败。
  test("keeps the definition when saving the favorite word fails", async () => {
    apiMicrosoftDict.mockResolvedValue({
      trs: [{ pos: "n.", def: "a definition" }],
    });
    saveFavoriteWordIfMissing.mockRejectedValue(new Error("quota exceeded"));
    const controller = new WordTooltipController({ autoFavWord: true });

    await controller.showWordTooltip("first");

    expect(controller.tooltipEl.textContent).toContain("a definition");
    expect(controller.tooltipEl.textContent).not.toContain(
      "Failed to load definition"
    );
    controller.destroy();
  });
});
