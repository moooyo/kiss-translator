import fs from "fs";
import path from "path";
import { SEPARATE_WINDOW_CONTENT_WIDTH } from "../../config/app";
import { POPUP_STYLES } from "./styles";

/**
 * 从源码文本里读出独立窗口的出厂尺寸。
 *
 * background.js 不导出任何东西,顶层还有 `globalThis.__KISS_CONTEXT__` 和
 * 一堆监听器注册 —— 为了一个常量去 import 它,要 mock 掉整个扩展环境。
 * releaseTargets.test.js 对 release.yml 也是同样的做法。
 *
 * @returns {{widthExpr: string, height: number}} 宽度表达式原文与出厂高度
 */
function readDefaultWindowBounds() {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../../background.js"),
    "utf-8"
  );
  const block = source.match(
    /const DEFAULT_SEPARATE_WINDOW_BOUNDS = \{([^}]*)\}/
  )?.[1];

  return {
    widthExpr: block.match(/width:\s*([^,\n]+)/)?.[1].trim(),
    height: Number(block.match(/height:\s*(\d+)/)?.[1]),
  };
}

// 出厂尺寸曾经是 400x400 —— 连「输入框 + 语言行 + 译文卡片」都放不下,
// 每次打开都得先手动拉大。现在它只是「量出真实高度之前」的起手值,
// 页面渲染完会由 MSG_FIT_SEPARATE_WINDOW 收到刚好合适的大小。
describe("separate translation window default size", () => {
  const bounds = readDefaultWindowBounds();

  test("derives its width from the shared content cap", () => {
    // 写死数字就会和 CSS 里的上限各走各的。这里要求它由常量算出来,
    // 那样改一处两处都跟着动。
    expect(bounds.widthExpr).toContain("SEPARATE_WINDOW_CONTENT_WIDTH");
  });

  test("opens tall enough for the whole form before it is measured", () => {
    // 起手值太矮的话,自适应生效前会先闪一下滚动条。
    expect(bounds.height).toBeGreaterThanOrEqual(640);
  });
});

describe("separate window content cap", () => {
  test("is the single source for the CSS panel width", () => {
    expect(POPUP_STYLES).toContain(
      `width: min(${SEPARATE_WINDOW_CONTENT_WIDTH}px, 100%)`
    );
  });

  test("stays wide enough to be worth capping", () => {
    expect(SEPARATE_WINDOW_CONTENT_WIDTH).toBeGreaterThanOrEqual(560);
  });
});
