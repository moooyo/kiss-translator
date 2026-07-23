// Horizontal resize grips: 8px on each side.
const TRANBOX_SIDE_GRIP_WIDTH = 16;
// Vertical chrome: 56px header, 16px resize grips, and 2px card border.
const TRANBOX_CHROME_HEIGHT = 74;

/** Returns the translation box width including its resize grips. */
export function getTranBoxOuterWidth(contentWidth) {
  return contentWidth + TRANBOX_SIDE_GRIP_WIDTH;
}

/** Returns the translation box height including all vertical chrome. */
export function getTranBoxOuterHeight(contentHeight) {
  return contentHeight + TRANBOX_CHROME_HEIGHT;
}

/** Returns the maximum content width that fits within the viewport. */
export function getMaxTranBoxContentWidth() {
  return Math.max(0, window.innerWidth - TRANBOX_SIDE_GRIP_WIDTH);
}

/** Returns the maximum content height that fits within the viewport. */
export function getMaxTranBoxContentHeight() {
  return Math.max(0, window.innerHeight - TRANBOX_CHROME_HEIGHT);
}

/** Returns the maximum X coordinate that keeps the box in the viewport. */
export function getMaxTranBoxX(contentWidth) {
  return Math.max(0, window.innerWidth - getTranBoxOuterWidth(contentWidth));
}

/** Returns the maximum Y coordinate that keeps the box in the viewport. */
export function getMaxTranBoxY(contentHeight) {
  return Math.max(0, window.innerHeight - getTranBoxOuterHeight(contentHeight));
}
