// 左右拉伸触发区的宽度 (8px 左侧 + 8px 右侧)
// 来源：DraggableResizable 的 lineWidth = 4，gridTemplateColumns 两侧各 lineWidth * 2
const TRANBOX_SIDE_GRIP_WIDTH = 16;
// 翻译框非内容区的高度 (56px Header + 8px 顶部拉伸区 + 8px 底部拉伸区 + 2px 卡片边框)
// 三个数都在 CSS 里，改版时必须一起改：
//   56px  Selection/styles.js 的 .kt-tranbox-header { min-height }
//   8 + 8 DraggableResizable 的 gridTemplateRows 上下两行
//   2px   Selection/styles.js 的 .KT-draggable-body { border: 1px } 上下各一
// M3 改版把 header 从 36px 提到 56px、又加了卡片边框，这个常量当时没跟着改，
// 结果 getMaxTranBoxContentHeight / getMaxTranBoxY 都放宽了 22px，小视口下框体会探出屏幕。
const TRANBOX_CHROME_HEIGHT = 74;

/**
 * 获取翻译框包含拉伸触发区在内的整体外部宽度
 */
export function getTranBoxOuterWidth(contentWidth) {
  return contentWidth + TRANBOX_SIDE_GRIP_WIDTH;
}

/**
 * 获取翻译框包含 Header 和拉伸触发区在内的整体外部高度
 */
export function getTranBoxOuterHeight(contentHeight) {
  return contentHeight + TRANBOX_CHROME_HEIGHT;
}

/**
 * 获取翻译框内容区允许的最大宽度 (防止整体外部宽度超出视口)
 */
export function getMaxTranBoxContentWidth() {
  return Math.max(0, window.innerWidth - TRANBOX_SIDE_GRIP_WIDTH);
}

/**
 * 获取翻译框内容区允许的最大高度 (防止整体外部高度超出视口)
 */
export function getMaxTranBoxContentHeight() {
  return Math.max(0, window.innerHeight - TRANBOX_CHROME_HEIGHT);
}

/**
 * 获取翻译框允许的最大 X 坐标 (防止右侧拉伸区溢出屏幕)
 */
export function getMaxTranBoxX(contentWidth) {
  return Math.max(0, window.innerWidth - getTranBoxOuterWidth(contentWidth));
}

/**
 * 获取翻译框允许的最大 Y 坐标 (防止底部拉伸区溢出屏幕)
 */
export function getMaxTranBoxY(contentHeight) {
  return Math.max(0, window.innerHeight - getTranBoxOuterHeight(contentHeight));
}
