/**
 * @file styles.js
 * @description 内容页悬浮球及其动作菜单的 Material 3 样式。
 *
 * 这些规则依赖 hooks/M3Theme 注入的 CSS 变量（--kt-pric / --kt-sf0 / --kt-spring 等）
 * 与 src/styles/m3.js 里的 kt-m3-pop 关键帧，因此只能在 M3Theme 内部使用。
 */
export const ACTION_STYLES = String.raw`
.kt-content-fab.MuiFab-root {
  width: 56px;
  height: 56px;
  min-width: 56px;
  min-height: 56px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 16px;
  background-color: var(--kt-pric);
  box-shadow: var(--kt-shadow-2);
  color: var(--kt-onpric);
  cursor: pointer;
  transition: background-color .2s ease, box-shadow .2s ease, transform .2s var(--kt-spring);
}
.kt-content-fab.MuiFab-root:hover {
  background-color: var(--kt-pric);
  background-color: color-mix(in srgb, var(--kt-onpric) 8%, var(--kt-pric));
}
.kt-content-fab.MuiFab-root.Mui-focusVisible,
.kt-content-fab.MuiFab-root[aria-expanded="true"],
.kt-content-fab.MuiFab-root:active {
  background-color: var(--kt-pric);
  background-color: color-mix(in srgb, var(--kt-onpric) 10%, var(--kt-pric));
}
.kt-content-fab.MuiFab-root:active { transform: scale(.96); }
.kt-content-fab svg { width: 24px; height: 24px; transition: transform .35s var(--kt-spring); }
.kt-content-fab[aria-expanded="true"] svg { transform: rotate(90deg); }
.kt-content-fab-menu { min-width: 210px; max-height: min(360px, calc(100vh - 24px)); overflow-y: auto; overscroll-behavior: contain; padding: 5px; border: 1px solid var(--kt-linev); border-radius: 12px; background: var(--kt-sf0); }
.kt-content-fab-menu .MuiMenu-list { display: flex; flex-direction: column; gap: 4px; padding: 0; }
.kt-content-fab-menu__item { min-height: 44px; gap: 10px; padding: 0 14px; border-radius: 8px; color: var(--kt-on); font-size: 12.5px; font-weight: 650; white-space: nowrap; transition: background .15s ease, transform .15s ease; animation: kt-m3-pop .4s var(--kt-spring) backwards; }
.kt-content-fab-menu__item:hover { background: var(--kt-sf1); }
.kt-content-fab-menu__item:active { transform: scale(.97); }
.kt-content-fab-menu__item .MuiListItemIcon-root { min-width: 24px; color: var(--kt-pri); }
.kt-content-fab-menu__item svg { width: 19px; height: 19px; }
`;
