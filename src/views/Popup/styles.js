export const POPUP_STYLES = String.raw`
.kt-popup-shell {
  width: 396px;
  max-width: 100vw;
  max-height: 100vh;
  overflow: hidden;
  background: var(--kt-sf0);
  color: var(--kt-on);
}

.kt-popup-shell--window {
  width: min(560px, 100vw);
  min-height: 100vh;
}

.kt-popup-header {
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px 8px;
  background: var(--kt-sf0);
}

.kt-popup-header__logo { border-radius: 8px; }
.kt-popup-brand-button { display: block; padding: 0; border: 0; border-radius: 8px; background: transparent; cursor: pointer; }
.kt-popup-header__title { min-width: 0; font-size: 15px; font-weight: 650; white-space: nowrap; }
.kt-popup-header__version { padding: 3px 8px; border-radius: 999px; background: var(--kt-sf2); color: var(--kt-onv); font-size: 10.5px; font-weight: 650; }
.kt-popup-header__spacer { flex: 1; }
.kt-popup-header__drag { display: flex; color: var(--kt-onv); cursor: move; }

.kt-popup-tabs { margin: 0 18px; }
.kt-popup-scroll { height: min(492px, calc(100vh - 108px)); overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; }
.kt-popup-scroll--text { max-height: 560px; }
.kt-popup-content { display: flex; flex-direction: column; gap: 14px; padding: 14px 18px 18px; }

.kt-popup-loading {
  min-height: 260px;
  display: grid;
  place-items: center;
  color: var(--kt-onv);
}

.kt-popup-loading svg { animation: kt-m3-spin .8s linear infinite; }

.kt-popup-hero {
  display: flex;
  align-items: center;
  gap: 13px;
  position: relative;
  overflow: hidden;
  padding: 17px 16px;
  border-radius: 24px;
  background: var(--kt-pric);
  cursor: pointer;
  transition: background .35s var(--kt-spring), transform .15s;
}

.kt-popup-hero:active { transform: scale(.98); }
.kt-popup-hero--off { background: var(--kt-sf2); }

.kt-popup-hero__icon {
  width: 48px;
  height: 48px;
  display: grid;
  flex: none;
  place-items: center;
  border-radius: 17px;
  background: var(--kt-pri);
  color: var(--kt-onpri);
  animation: kt-m3-pop .55s var(--kt-spring);
}

.kt-popup-hero__icon svg { width: 27px; height: 27px; }
.kt-popup-hero--off .kt-popup-hero__icon { background: var(--kt-sf4); color: var(--kt-onv); animation: none; }
.kt-popup-hero--busy .kt-popup-hero__icon { animation: kt-m3-glow 1.1s ease-in-out infinite; }
.kt-popup-hero--busy .kt-popup-hero__icon svg { animation: kt-m3-spin .9s linear infinite; }
.kt-popup-hero__copy { min-width: 0; display: block; flex: 1; }
.kt-popup-hero__title { display: block; color: var(--kt-onpric); font-size: 16px; font-weight: 700; }
.kt-popup-hero--off .kt-popup-hero__title { color: var(--kt-on); }
.kt-popup-hero__subtitle { display: block; margin-top: 3px; overflow: hidden; color: var(--kt-onpric); font-size: 11.5px; opacity: .76; text-overflow: ellipsis; white-space: nowrap; }
.kt-popup-hero--off .kt-popup-hero__subtitle { color: var(--kt-onv); opacity: 1; }
.kt-popup-hero__progress { height: 4px; position: absolute; right: 0; bottom: 0; left: 0; background: color-mix(in srgb, var(--kt-pri) 18%, transparent); }
.kt-popup-hero__progress::after { content: ""; position: absolute; inset-block: 0; border-radius: 999px; background: var(--kt-pri); animation: kt-m3-sweep 1.05s ease-in-out infinite; }

.kt-popup-language-row { display: grid; grid-template-columns: 1fr 40px 1fr; gap: 8px; }
.kt-popup-language {
  min-width: 0;
  padding: 9px 14px;
  border: 0;
  border-radius: 16px;
  background: var(--kt-sf2);
  text-align: left;
}

.kt-popup-language > span { display: block; color: var(--kt-onv); font-size: 10.5px; font-weight: 600; pointer-events: none; }
.kt-popup-language select { width: 100%; margin-top: 1px; border: 0; outline: 0; background: transparent; color: var(--kt-on); font-size: 13px; font-weight: 600; cursor: pointer; }
.kt-popup-swap:disabled { cursor: not-allowed; opacity: .35; }

.kt-popup-section-label { margin: 0 4px 8px; color: var(--kt-onv); font-size: 11.5px; font-weight: 650; }
.kt-popup-services { display: flex; flex-wrap: nowrap; gap: 6px; margin: -2px; padding: 2px; overflow: hidden; }
.kt-popup-services--open { flex-wrap: wrap; overflow: visible; }
.kt-popup-service {
  min-width: 0;
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 7px;
  padding: 5px 11px 5px 6px;
  border: 1.5px solid var(--kt-linev);
  border-radius: 999px;
  background: var(--kt-sf0);
  color: var(--kt-on);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.kt-popup-service:hover { background: var(--kt-sf1); }
.kt-popup-service[aria-pressed="true"] { border-color: var(--kt-pri); background: var(--kt-pric); color: var(--kt-onpric); font-weight: 650; }
.kt-popup-service__name { min-width: 0; display: block; overflow: hidden; text-overflow: ellipsis; }
.kt-service-logo { width: 22px; height: 22px; display: grid; flex: none; place-items: center; border: 1px solid var(--kt-linev); border-radius: 50%; background: #fff; }
.kt-service-logo img { width: 14px; height: 14px; object-fit: contain; }
.kt-popup-more-service { min-width: max-content; padding-inline: 11px 8px; border-color: transparent; background: var(--kt-sf2); color: var(--kt-onv); font-weight: 650; }
.kt-popup-more-service svg { width: 17px; height: 17px; }

.kt-popup-scenes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.kt-popup-scene {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 0;
  border-radius: 17px;
  background: var(--kt-sf2);
  color: var(--kt-onv);
  cursor: pointer;
  text-align: left;
  transition: background .35s var(--kt-spring), color .35s, transform .15s;
}

.kt-popup-scene:active { transform: scale(.97); }
.kt-popup-scene[aria-pressed="true"] { background: var(--kt-secc); color: var(--kt-onsecc); }
.kt-popup-scene > svg { width: 21px; height: 21px; flex: none; }
.kt-popup-scene__copy { min-width: 0; display: block; }
.kt-popup-scene__label { display: block; overflow: hidden; font-size: 12px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.kt-popup-scene__state { display: block; margin-top: 1px; font-size: 10.5px; opacity: .72; }

.kt-popup-site { padding: 14px; border: 0; border-radius: 20px; background: var(--kt-sf1); }
.kt-popup-site__top { display: flex; align-items: center; gap: 8px; }
.kt-popup-site__select { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: var(--kt-on); font-size: 12.5px; font-weight: 650; }
.kt-popup-site__badge { flex: none; padding: 4px 8px; border-radius: 999px; background: var(--kt-terc); color: var(--kt-onterc); font-size: 10.5px; font-weight: 700; }
.kt-popup-site__badge--blocked { background: var(--kt-errc); color: var(--kt-onerrc); }
.kt-popup-site__actions { display: flex; align-items: center; gap: 4px; margin: 10px -4px -4px; }
.kt-popup-site__actions .kt-m3-button { min-height: 36px; padding-inline: 12px; font-size: 11.5px; }
.kt-popup-site__actions .kt-m3-button:first-child { flex: 1; }
.kt-popup-site__actions .kt-m3-icon-button { width: 36px; height: 36px; }

.kt-popup-disclosure { width: 100%; min-height: 38px; display: flex; align-items: center; gap: 8px; padding: 0 4px; border: 0; background: transparent; color: var(--kt-onv); cursor: pointer; font-size: 12.5px; font-weight: 650; }
.kt-popup-disclosure::after { content: ""; height: 1px; flex: 1; order: -1; background: var(--kt-linev); }
.kt-popup-disclosure svg { transition: transform .35s var(--kt-spring); }
.kt-popup-disclosure[aria-expanded="true"] svg { transform: rotate(180deg); }
.kt-popup-advanced { display: flex; flex-direction: column; gap: 12px; animation: kt-m3-rise .35s var(--kt-spring); }
.kt-popup-style-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.kt-popup-style-chip { min-height: 34px; padding: 0 12px; border: 1px solid var(--kt-linev); border-radius: 999px; background: var(--kt-sf0); color: var(--kt-onv); cursor: pointer; font-size: 11.5px; }
.kt-popup-style-chip[aria-pressed="true"] { border-color: var(--kt-pri); background: var(--kt-pric); color: var(--kt-onpric); font-weight: 650; }
.kt-popup-advanced-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.kt-popup-advanced-row { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 9px 10px 9px 12px; border-radius: 15px; background: var(--kt-sf2); font-size: 11.5px; font-weight: 550; }
.kt-popup-advanced-row .kt-m3-switch { transform: scale(.76); transform-origin: right center; }

.kt-popup-footer { display: flex; align-items: center; gap: 8px; padding-top: 2px; color: var(--kt-onv); font-size: 10.5px; }
.kt-popup-footer__keys { display: flex; align-items: center; gap: 4px; }
.kt-popup-footer kbd { padding: 2px 6px; border: 1px solid var(--kt-linev); border-bottom-width: 2px; border-radius: 6px; background: var(--kt-sf1); color: var(--kt-on); font-family: ui-monospace, monospace; font-size: 9.5px; }
.kt-popup-footer__spacer { flex: 1; }
.kt-popup-footer .kt-m3-button { min-height: 34px; padding-inline: 10px; font-size: 11.5px; }

.kt-popup-text-panel { padding: 14px 18px 18px; animation: kt-m3-rise .35s var(--kt-spring); }
.kt-popup-text-panel .MuiTabs-root { margin-bottom: 12px; }
.kt-popup-empty { min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; color: var(--kt-onv); text-align: center; }
.kt-popup-empty__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }

@media (max-width: 395px) {
  .kt-popup-shell { width: 100vw; }
  .kt-popup-content { padding-inline: 14px; }
  .kt-popup-tabs { margin-inline: 14px; }
}
`;
