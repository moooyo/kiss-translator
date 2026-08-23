import {
  getMaxTranBoxContentHeight,
  getMaxTranBoxY,
  getTranBoxOuterHeight,
} from "./tranboxPosition";

// 这里的数字直接钉住 TRANBOX_CHROME_HEIGHT。M3 改版把 header 从 36px 提到 56px
// 并加了 1px 卡片边框，常量当时没跟着改，垂直边界因此放宽了 22px。
describe("translation box vertical bounds", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 500,
    });
  });

  test("includes the 56px header, resize grips, and card border", () => {
    expect(getTranBoxOuterHeight(200)).toBe(274);
    expect(getMaxTranBoxContentHeight()).toBe(426);
    expect(getMaxTranBoxY(200)).toBe(226);
  });

  test("never returns negative height or position limits", () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 50,
    });

    expect(getMaxTranBoxContentHeight()).toBe(0);
    expect(getMaxTranBoxY(200)).toBe(0);
  });
});
