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

// 实机测出来的:提示框固定显示在播放器右上角,而字幕在底部中间。离开单词后
// 只留 100ms 就收起,鼠标根本走不到 —— 收藏和关闭两个按钮**从来就点不到**。
// 所以这里钉的是「够得着」,不是「点了有反应」。
//
// 这些用例必须走真实路径:通过 attachSpanListeners 挂上监听,再在单词 span 上
// 派发 pointerenter/pointerleave。直接在提示框上派发事件是测不出东西的 ——
// 撤掉修复后根本没有计时器被安排,断言会照样通过。
describe("WordTooltipController reachability", () => {
  const OPEN_DELAY = 300;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = "";
    apiMicrosoftDict.mockReset();
    apiMicrosoftDict.mockResolvedValue({
      trs: [{ pos: "n.", def: "a definition" }],
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  /** 挂上监听、悬停单词、等提示框真正弹出来。 */
  const hoverWordUntilTooltip = async (controller) => {
    document.body.innerHTML =
      '<div id="root"><span class="kiss-subtitle-word" data-word="behind">behind</span></div>';
    const root = document.getElementById("root");
    controller.attachSpanListeners(root);
    const span = root.querySelector(".kiss-subtitle-word");

    span.dispatchEvent(new Event("pointerenter"));
    jest.advanceTimersByTime(OPEN_DELAY);
    // showWordTooltip 是异步的,放行词典请求那几个微任务
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    return { span, tooltip: controller.tooltipEl };
  };

  test("opens a tooltip after hovering a word", async () => {
    const controller = new WordTooltipController({});
    const { tooltip } = await hoverWordUntilTooltip(controller);

    expect(tooltip).not.toBeNull();
    expect(tooltip.isConnected).toBe(true);
    controller.destroy();
  });

  // 核心:离开单词已经安排了收起,指针走到提示框上必须把它取消掉。
  test("keeps the tooltip alive once the pointer reaches it", async () => {
    const controller = new WordTooltipController({});
    const { span, tooltip } = await hoverWordUntilTooltip(controller);

    span.dispatchEvent(new Event("pointerleave"));
    tooltip.dispatchEvent(new Event("pointerenter"));
    jest.advanceTimersByTime(10000);

    expect(controller.tooltipEl).toBe(tooltip);
    expect(tooltip.isConnected).toBe(true);
    controller.destroy();
  });

  // 修复前离开单词只留 100ms,而提示框在播放器另一头,鼠标那时还在半路上。
  test("still shows the tooltip 100ms after leaving the word", async () => {
    const controller = new WordTooltipController({});
    const { span, tooltip } = await hoverWordUntilTooltip(controller);

    span.dispatchEvent(new Event("pointerleave"));
    jest.advanceTimersByTime(100);

    expect(controller.tooltipEl).toBe(tooltip);
    controller.destroy();
  });

  test("hides when the pointer never arrives", async () => {
    const controller = new WordTooltipController({});
    const { span } = await hoverWordUntilTooltip(controller);

    span.dispatchEvent(new Event("pointerleave"));
    jest.advanceTimersByTime(10000);

    expect(controller.tooltipEl).toBeNull();
    controller.destroy();
  });

  test("hides again after the pointer leaves the tooltip", async () => {
    const controller = new WordTooltipController({});
    const { span, tooltip } = await hoverWordUntilTooltip(controller);

    span.dispatchEvent(new Event("pointerleave"));
    tooltip.dispatchEvent(new Event("pointerenter"));
    jest.advanceTimersByTime(10000);
    expect(controller.tooltipEl).toBe(tooltip);

    tooltip.dispatchEvent(new Event("pointerleave"));
    jest.advanceTimersByTime(10000);

    expect(controller.tooltipEl).toBeNull();
    controller.destroy();
  });

  test("reports pointer presence so the caller can hold playback", async () => {
    const onTooltipHoverChange = jest.fn();
    const controller = new WordTooltipController({ onTooltipHoverChange });
    const { tooltip } = await hoverWordUntilTooltip(controller);

    tooltip.dispatchEvent(new Event("pointerenter"));
    expect(onTooltipHoverChange).toHaveBeenLastCalledWith(true);

    tooltip.dispatchEvent(new Event("pointerleave"));
    expect(onTooltipHoverChange).toHaveBeenLastCalledWith(false);
    controller.destroy();
  });

  // 提示框消失了指针当然也不在它上面。漏掉这条通知,「按住不放」会一直挂着,
  // 视频再也不会自己恢复播放。
  test("clears pointer presence when the tooltip goes away", async () => {
    const onTooltipHoverChange = jest.fn();
    const controller = new WordTooltipController({ onTooltipHoverChange });
    const { tooltip } = await hoverWordUntilTooltip(controller);
    tooltip.dispatchEvent(new Event("pointerenter"));
    onTooltipHoverChange.mockClear();

    controller.hideWordTooltip();

    expect(onTooltipHoverChange).toHaveBeenCalledWith(false);
    controller.destroy();
  });
});
