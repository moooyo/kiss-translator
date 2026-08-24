import fs from "fs";
import path from "path";
import { POPUP_STYLES } from "./styles";

/**
 * 从源码文本里读出独立窗口的出厂尺寸。
 *
 * background.js 不导出任何东西,顶层还有 `globalThis.__KISS_CONTEXT__` 和
 * 一堆监听器注册 —— 为了一个常量去 import 它,要 mock 掉整个扩展环境。
 * releaseTargets.test.js 对 release.yml 也是同样的做法:两处必须一致的值,
 * 与其加一层抽象,不如直接读文本比对。
 *
 * @returns {{width: number, height: number}} 出厂宽高
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
    width: Number(block.match(/width:\s*(\d+)/)?.[1]),
    height: Number(block.match(/height:\s*(\d+)/)?.[1]),
  };
}

const readContentCapPx = () =>
  Number(
    POPUP_STYLES.match(
      /\.kt-popup-shell--window \.kt-popup-text-panel,[^{]*\{[^}]*width:\s*min\((\d+)px/
    )?.[1]
  );

// 出厂尺寸曾经是 400x400。那个高度连「输入框 + 语言行 + 译文卡片」都放不下,
// 每次打开都得先手动拉大窗口。
describe("separate translation window default size", () => {
  const bounds = readDefaultWindowBounds();

  test("opens wide enough for the content not to be clipped", () => {
    const cap = readContentCapPx();

    expect(cap).toBeGreaterThan(0);
    // 窗口比内容限宽还窄的话,一打开就是被裁的或者带横向滚动条。
    // 加宽 styles.js 里那个 min() 时,这条会提醒你回来一起改。
    expect(bounds.width).toBeGreaterThanOrEqual(cap);
  });

  test("opens tall enough for the whole form", () => {
    // 输入框 112 + 页脚 52 + 语言行 60 + 译文卡片 180 + 对比更多服务 70
    // + 内外边距,再加窗口标题栏。低于这个数就又回到「一打开就得拉大」。
    expect(bounds.height).toBeGreaterThanOrEqual(640);
  });
});
