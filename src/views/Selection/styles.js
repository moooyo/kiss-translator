export const SELECTION_STYLES = String.raw`
.KT-draggable { overflow: visible !important; border-radius: 22px !important; animation: kt-m3-rise .45s var(--kt-spring); }
.KT-draggable-body { overflow: visible !important; border: 1px solid var(--kt-linev) !important; border-radius: 22px !important; background: var(--kt-sf0) !important; box-shadow: var(--kt-shadow-2) !important; }
.KT-draggable-header { overflow: visible; border-radius: 21px 21px 0 0; background: var(--kt-sf0); }
.KT-draggable-container { overflow-x: hidden; border-radius: 0 0 21px 21px; background: var(--kt-sf0) !important; }
.kt-tranbox-header { min-height: 56px; display: flex; align-items: center; gap: 6px; position: relative; padding: 7px 8px 7px 10px; border-bottom: 1px solid var(--kt-linev); border-radius: 21px 21px 0 0; background: var(--kt-sf0); color: var(--kt-on); }
.kt-tranbox-header__drag { display: flex; color: var(--kt-onv); cursor: move; }
.kt-tranbox-header__drag svg { width: 19px; height: 19px; }
.kt-tranbox-header__segments { min-width: 0; max-width: 174px; flex: 1; }
.kt-tranbox-header__segments button { min-width: 0; min-height: 34px; padding-inline: 9px; font-size: 11px; }
.kt-tranbox-header__actions { display: flex; align-items: center; gap: 1px; }
.kt-tranbox-header .MuiIconButton-root { width: 34px; height: 34px; }
.kt-tranbox-header .MuiIconButton-root[aria-pressed="true"] { background: var(--kt-pric); color: var(--kt-onpric); }
.kt-tranbox-header__menu { min-width: 206px; display: flex; flex-direction: column; position: absolute; top: 48px; right: 42px; z-index: 4; overflow: hidden; padding: 6px; border: 1px solid var(--kt-linev); border-radius: 18px; background: var(--kt-sf0); box-shadow: var(--kt-shadow-2); animation: kt-m3-rise .3s var(--kt-spring); }
.kt-tranbox-header__menu button { min-height: 39px; display: flex; align-items: center; gap: 10px; padding: 0 11px; border: 0; border-radius: 13px; background: transparent; color: var(--kt-on); cursor: pointer; font: inherit; font-size: 11.5px; text-align: left; }
.kt-tranbox-header__menu button:hover,
.kt-tranbox-header__menu button[aria-pressed="true"] { background: var(--kt-pric); color: var(--kt-onpric); }
.kt-tranbox-header__menu svg { width: 18px; height: 18px; flex: none; }
.kt-tranbox-content { padding: 14px !important; background: var(--kt-sf0) !important; color: var(--kt-on) !important; }
.KT-draggable-container .MuiStack-root { gap: 12px; }
.KT-draggable-container .MuiGrid-container { width: 100%; margin: 0; padding: 5px; border-radius: 18px; background: var(--kt-sf1); }
.KT-draggable-container .MuiGrid-item { padding: 5px !important; }
.KT-draggable-container .MuiFilledInput-root { border-radius: 15px; }
.KT-draggable-container .MuiInputLabel-root { font-size: 12px; }
.KT-draggable-container .MuiInputBase-input { font-size: 12.5px; }
.KT-draggable-container .MuiTabs-root { min-height: 40px; }
.KT-draggable-container .MuiTab-root { min-height: 32px; padding: 5px 13px; font-size: 11.5px; }
.KT-draggable-container .MuiFormHelperText-root { margin-inline: 8px; }
.KT-draggable-container .MuiAlert-root { border-radius: 16px; }
.KT-draggable-container .MuiCircularProgress-root { color: var(--kt-pri); }
.KT-tranbtn { display: grid; place-items: center; padding: 7px; border-radius: 14px; background: var(--kt-pric); box-shadow: var(--kt-shadow-2); transition: border-radius .3s var(--kt-spring), transform .15s; animation: kt-m3-pop .3s var(--kt-spring); }
.KT-tranbtn:hover { border-radius: 999px; }
.KT-tranbtn:active { transform: scale(.94); }
.KT-tranbtn svg { width: 24px; height: 24px; border-radius: 8px; }
`;
