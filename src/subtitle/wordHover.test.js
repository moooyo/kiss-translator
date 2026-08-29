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

describe("WordTooltipController", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    apiMicrosoftDict.mockReset();
    saveFavoriteWordIfMissing.mockReset();
    saveFavoriteWordIfMissing.mockResolvedValue(false);
  });

  test("keeps the close button circular before hover and focus", () => {
    addWordHoverStyles();
    const css = document.getElementById("kiss-word-hover-styles").textContent;
    const baseRule = css.match(/\.kiss-word-tooltip-close\s*\{([^}]*)\}/)?.[1];
    const hoverRule = css.match(
      /\.kiss-word-tooltip-close:hover,[\s\S]*?:focus-visible\s*\{([^}]*)\}/
    )?.[1];

    expect(baseRule).toContain("border-radius: 50%");
    expect(baseRule).toContain("transition: background 160ms ease");
    expect(hoverRule).not.toContain("border-radius");
    document.getElementById("kiss-word-hover-styles").remove();
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

// 实机测出来的:提示框里的收藏和关闭两个按钮**从来就点不到**。
//
// 它固定显示在播放器右上角,字幕在底部中间 —— 够到它要跨半个播放器。
// 早先靠「离开单词后 N 毫秒收起」留出这段时间,那是在赌用户能在超时前走到,
// 播放器多大、鼠标多快都会翻盘。现在它是 popover:开着就一直开着。
describe("WordTooltipController popover lifecycle", () => {
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

  // 核心:这是让按钮够得着的唯一原因。多久都不该自己消失。
  test("stays open indefinitely after the pointer leaves the word", async () => {
    const controller = new WordTooltipController({});
    const { span, tooltip } = await hoverWordUntilTooltip(controller);

    span.dispatchEvent(new Event("pointerleave"));
    jest.advanceTimersByTime(60000);

    expect(controller.tooltipEl).toBe(tooltip);
    expect(tooltip.isConnected).toBe(true);
    controller.destroy();
  });

  test("closes when the close button is clicked", async () => {
    const controller = new WordTooltipController({});
    const { span, tooltip } = await hoverWordUntilTooltip(controller);
    span.dispatchEvent(new Event("pointerleave"));

    tooltip.querySelector(".kiss-word-tooltip-close").click();

    expect(controller.tooltipEl).toBeNull();
    expect(tooltip.isConnected).toBe(false);
    controller.destroy();
  });

  // 不会自己消失,就必须留一个不用瞄准 × 的退出口。
  test("closes when the pointer goes down outside it", async () => {
    const controller = new WordTooltipController({});
    await hoverWordUntilTooltip(controller);

    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));

    expect(controller.tooltipEl).toBeNull();
    controller.destroy();
  });

  test("survives a pointer press inside it", async () => {
    const controller = new WordTooltipController({});
    const { tooltip } = await hoverWordUntilTooltip(controller);

    tooltip.dispatchEvent(new Event("pointerdown", { bubbles: true }));

    expect(controller.tooltipEl).toBe(tooltip);
    controller.destroy();
  });

  // 字幕管理器据此决定要不要恢复播放:开着说明用户在读释义,
  // 这时候放视频走,等于让字幕从他眼皮底下跑掉。
  test("reports open and closed so the caller can hold playback", async () => {
    const onTooltipOpenChange = jest.fn();
    const controller = new WordTooltipController({ onTooltipOpenChange });
    const { tooltip } = await hoverWordUntilTooltip(controller);

    expect(onTooltipOpenChange).toHaveBeenLastCalledWith(true);

    tooltip.querySelector(".kiss-word-tooltip-close").click();
    expect(onTooltipOpenChange).toHaveBeenLastCalledWith(false);
    controller.destroy();
  });

  // 漏掉关闭通知,「开着」会一直挂着,视频再也不会自己恢复。
  test("reports closed when torn down while still open", async () => {
    const onTooltipOpenChange = jest.fn();
    const controller = new WordTooltipController({ onTooltipOpenChange });
    await hoverWordUntilTooltip(controller);
    onTooltipOpenChange.mockClear();

    controller.destroy();

    expect(onTooltipOpenChange).toHaveBeenCalledWith(false);
  });

  // 换一个词要换掉旧的,不能两个并存。
  test("replaces the tooltip when another word is hovered", async () => {
    const controller = new WordTooltipController({});
    const { tooltip: first } = await hoverWordUntilTooltip(controller);

    await controller.showWordTooltip("second");

    expect(first.isConnected).toBe(false);
    expect(document.querySelectorAll(".kiss-word-tooltip")).toHaveLength(1);
    controller.destroy();
  });
});
