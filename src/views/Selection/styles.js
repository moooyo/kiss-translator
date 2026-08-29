/**
 * @file styles.js
 * @description 划词翻译框的 Material 3 样式。
 *
 * 这些规则依赖 hooks/M3Theme 注入的 CSS 变量（--kt-sf0 / --kt-linev / --kt-spring 等）
 * 与 src/styles/m3.js 里的 kt-m3-rise / kt-m3-pop 关键帧，因此只能在 M3Theme 内部使用。
 *
 * KT-draggable* 这几个类名由 DraggableResizable.js 输出，覆写时带 !important 是必要的：
 * 那些节点自身带 MUI 的 sx 内联样式，优先级高于普通类选择器。
 */
export const SELECTION_STYLES = String.raw`
.KT-draggable { overflow: visible !important; border-radius: 16px !important; animation: kt-m3-rise .45s var(--kt-spring); }
.KT-draggable-body { overflow: visible !important; border: 1px solid var(--kt-linev) !important; border-radius: 16px !important; background: var(--kt-sf0) !important; box-shadow: var(--kt-shadow-2) !important; }
.KT-draggable-header { overflow: visible; border-radius: 16px 16px 0 0; background: var(--kt-sf0); }
.KT-draggable-container { overflow-x: hidden; border-radius: 0 0 16px 16px; background: var(--kt-sf0) !important; }

.kt-tranbox-header { min-height: 56px; display: flex; align-items: center; gap: 6px; position: relative; padding: 7px 8px 7px 10px; border-bottom: 1px solid var(--kt-linev); border-radius: 16px 16px 0 0; background: var(--kt-sf0); color: var(--kt-on); }
.kt-tranbox-header__drag { display: flex; color: var(--kt-onv); cursor: move; }
.kt-tranbox-header__drag svg { width: 19px; height: 19px; }
.kt-tranbox-header__brand { min-width: 0; flex: 1; display: flex; align-items: center; gap: 7px; overflow: hidden; }
.kt-tranbox-header__logo { width: 22px; height: 22px; flex: none; display: grid; place-items: center; border-radius: 7px; background: var(--kt-sf1); }
.kt-tranbox-header__title { min-width: 0; overflow: hidden; color: var(--kt-onv); font-size: 11.5px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.kt-tranbox-header__actions { display: flex; flex: none; align-items: center; gap: 1px; }
.kt-tranbox-header .MuiIconButton-root { width: 34px; height: 34px; }
.kt-tranbox-header .MuiIconButton-root svg { width: 18px; height: 18px; }
.kt-tranbox-header .MuiIconButton-root[aria-pressed="true"] { background: var(--kt-pric); color: var(--kt-onpric); }
.kt-tranbox-header__menu { min-width: 206px; display: flex; flex-direction: column; position: absolute; top: 48px; right: 42px; z-index: 4; overflow: hidden; padding: 6px; border: 1px solid var(--kt-linev); border-radius: 12px; background: var(--kt-sf0); box-shadow: var(--kt-shadow-2); animation: kt-m3-rise .3s var(--kt-spring); }
.kt-tranbox-header__menu button { min-height: 39px; display: flex; align-items: center; gap: 10px; padding: 0 11px; border: 0; border-radius: 8px; background: transparent; color: var(--kt-on); cursor: pointer; font: inherit; font-size: 11.5px; text-align: left; }
.kt-tranbox-header__menu button:hover,
.kt-tranbox-header__menu button[aria-checked="true"] { background: var(--kt-pric); color: var(--kt-onpric); }
.kt-tranbox-header__menu svg { width: 18px; height: 18px; flex: none; }

.kt-tranbox-content { padding: 14px !important; background: var(--kt-sf0) !important; color: var(--kt-on) !important; }
.KT-draggable-container .MuiStack-root { gap: 12px; }
.KT-draggable-container .MuiGrid-container { width: 100%; margin: 0; padding: 5px; border-radius: 12px; background: var(--kt-sf1); }
.KT-draggable-container .MuiGrid-item { padding: 5px !important; }
.KT-draggable-container .MuiFilledInput-root { border-radius: 12px; }
.KT-draggable-container .MuiInputLabel-root { font-size: 12px; }
.KT-draggable-container .MuiInputBase-input { font-size: 12.5px; }
.KT-draggable-container .MuiTabs-root { min-height: 40px; }
.KT-draggable-container .MuiTab-root { min-height: 32px; padding: 5px 13px; font-size: 11.5px; }
.KT-draggable-container .MuiFormHelperText-root { margin-inline: 8px; }
.KT-draggable-container .MuiAlert-root { border-radius: 12px; }
.KT-draggable-container .MuiCircularProgress-root { color: var(--kt-pri); }

.KT-tranbtn { width: 40px; height: 40px; display: grid; place-items: center; padding: 0; border-radius: 12px; background: var(--kt-pric); box-shadow: var(--kt-shadow-2); transition: background .2s, transform .15s; animation: kt-m3-pop .3s var(--kt-spring); }
.KT-tranbtn:hover { background: color-mix(in srgb, var(--kt-onpric) 8%, var(--kt-pric)); }
.KT-tranbtn:active { transform: scale(.94); }
.KT-tranbtn svg { width: 24px; height: 24px; border-radius: 8px; }
`;
