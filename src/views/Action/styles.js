export const ACTION_STYLES = String.raw`
.kt-content-fab {
  width: 58px;
  height: 58px;
  min-width: 58px;
  min-height: 58px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 19px;
  background: var(--kt-pric);
  box-shadow: var(--kt-shadow-2);
  color: var(--kt-onpric);
  cursor: pointer;
  transition: border-radius .35s var(--kt-spring), background .3s, transform .2s var(--kt-spring);
}
.kt-content-fab:hover { border-radius: 999px; }
.kt-content-fab:active { transform: scale(.96); }
.kt-content-fab[aria-expanded="true"] { border-radius: 999px; }
.kt-content-fab svg { width: 26px; height: 26px; transition: transform .35s var(--kt-spring); }
.kt-content-fab[aria-expanded="true"] svg { transform: rotate(90deg); }
.kt-content-fab-menu { min-width: 210px; max-height: min(360px, calc(100vh - 24px)); overflow-y: auto; overscroll-behavior: contain; padding: 5px; border: 1px solid var(--kt-linev); border-radius: 20px; background: var(--kt-sf0); }
.kt-content-fab-menu .MuiMenu-list { display: flex; flex-direction: column; gap: 4px; padding: 0; }
.kt-content-fab-menu__item { min-height: 44px; gap: 10px; padding: 0 14px; border-radius: 15px; color: var(--kt-on); font-size: 12.5px; font-weight: 650; white-space: nowrap; animation: kt-m3-pop .4s var(--kt-spring) both; }
.kt-content-fab-menu__item:hover { background: var(--kt-sf1); }
.kt-content-fab-menu__item:active { transform: scale(.97); }
.kt-content-fab-menu__item .MuiListItemIcon-root { min-width: 24px; color: var(--kt-pri); }
.kt-content-fab-menu__item svg { width: 19px; height: 19px; }
`;
