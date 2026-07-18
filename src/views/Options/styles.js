export const OPTIONS_STYLES = String.raw`
.kt-options-shell { min-height: 100vh; background: var(--kt-bg); color: var(--kt-on); }
.kt-options-mobile-header { display: none; }
.kt-options-layout { min-height: 100vh; display: grid; grid-template-columns: 270px minmax(0, 1fr); }
.kt-options-sidebar {
  width: 270px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  z-index: 20;
  overflow: hidden;
  border-right: 1px solid var(--kt-linev);
  background: var(--kt-bg);
}
.kt-options-brand { min-height: 68px; display: flex; align-items: center; gap: 10px; padding: 14px 22px 10px; color: var(--kt-on); text-decoration: none; }
.kt-options-brand img { border-radius: 9px; }
.kt-options-brand__name { font-size: 14px; font-weight: 700; }
.kt-options-brand__name,
.kt-options-brand__version { display: block; }
.kt-options-brand__version { margin-top: 1px; color: var(--kt-onv); font-size: 10.5px; }
.kt-options-search { display: flex; align-items: center; gap: 10px; margin: 0 14px 12px; padding: 0 15px; border-radius: 999px; background: var(--kt-sf3); color: var(--kt-onv); }
.kt-options-search svg { width: 19px; height: 19px; flex: none; }
.kt-options-search input { width: 100%; height: 46px; border: 0; outline: 0; background: transparent; font-size: 13px; }
.kt-options-nav { flex: 1; overflow-y: auto; padding: 2px 14px 22px; }
.kt-options-nav__group { margin-top: 14px; }
.kt-options-nav__group:first-child { margin-top: 0; }
.kt-options-nav__label { margin: 0 14px 6px; color: var(--kt-onv); font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.kt-options-nav__link { min-height: 44px; display: flex; align-items: center; gap: 13px; padding: 0 16px; border-radius: 999px; color: var(--kt-onv); text-decoration: none; font-size: 13px; font-weight: 550; transition: background .3s var(--kt-spring), color .3s, transform .15s; }
.kt-options-nav__link:hover { background: var(--kt-sf2); color: var(--kt-on); }
.kt-options-nav__link:active { transform: scale(.98); }
.kt-options-nav__link.active { background: var(--kt-pric); color: var(--kt-onpric); font-weight: 650; }
.kt-options-nav__link svg { width: 20px; height: 20px; flex: none; }
.kt-options-nav__empty { padding: 24px 16px; color: var(--kt-onv); font-size: 12px; text-align: center; }
.kt-options-overlay { display: none; }

.kt-options-main { min-width: 0; padding: 38px clamp(24px, 5vw, 72px) 80px; }
.kt-options-main__inner { width: min(790px, 100%); margin: 0 auto; }
.kt-options-page-header { margin: 0 0 26px; }
.kt-options-page-header h1 { margin: 0; color: var(--kt-on); font-size: clamp(27px, 3vw, 31px); font-weight: 650; letter-spacing: -.035em; line-height: 1.2; }
.kt-options-page-header p { margin: 8px 0 0; color: var(--kt-onv); font-size: 13.5px; line-height: 1.5; }
.kt-options-version-alert { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; padding: 12px 16px; border-radius: 16px; background: var(--kt-terc); color: var(--kt-onterc); font-size: 12px; }
.kt-options-version-alert a { color: inherit; font-weight: 700; }
.kt-options-page { min-width: 0; }

.kt-options-page > .MuiBox-root > .MuiStack-root { gap: 18px; }
.kt-options-page .MuiAlert-root { border: 0; border-radius: 18px; background: var(--kt-sf1); color: var(--kt-onv); }
.kt-options-page .MuiGrid-container { width: 100%; margin: 0; padding: 8px; border: 1px solid var(--kt-linev); border-radius: 20px; background: var(--kt-sf0); }
.kt-options-page .MuiGrid-item { padding: 8px !important; }
.kt-options-page .MuiTextField-root { min-width: 0; }
.kt-options-page .MuiFormControlLabel-root { min-height: 48px; gap: 8px; margin: 0; padding: 4px 8px 4px 14px; border-radius: 14px; background: var(--kt-sf1); }
.kt-options-page .MuiFormControlLabel-label { font-size: 13px; font-weight: 550; }
.kt-options-page .MuiAccordion-root { border-radius: 20px !important; background: var(--kt-sf0); }
.kt-options-page .MuiAccordion-root:not(:last-child) { margin-bottom: 8px; }
.kt-options-page .MuiAccordionSummary-root { min-height: 58px; padding-inline: 18px; }
.kt-options-page .MuiButton-root { white-space: nowrap; }
.kt-options-page .MuiTabs-root { width: fit-content; max-width: 100%; }

.kt-overview-top { display: grid; grid-template-columns: 1.35fr 1fr; gap: 14px; margin-bottom: 20px; }
.kt-overview-hero { min-height: 200px; display: flex; flex-direction: column; position: relative; padding: 24px; border-radius: 26px; background: var(--kt-pric); color: var(--kt-onpric); overflow: hidden; }
.kt-overview-hero__status { display: flex; align-items: center; gap: 13px; }
.kt-overview-hero__icon { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 17px; background: var(--kt-pri); color: var(--kt-onpri); }
.kt-overview-hero__icon svg { width: 26px; height: 26px; }
.kt-overview-hero__copy { min-width: 0; flex: 1; }
.kt-overview-hero__title { display: block; font-size: 17px; font-weight: 700; }
.kt-overview-hero__subtitle { display: block; margin-top: 3px; font-size: 11.5px; opacity: .75; }
.kt-overview-hero__chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 18px; }
.kt-overview-hero__chip { padding: 5px 10px; border-radius: 999px; background: color-mix(in srgb, var(--kt-sf0) 45%, transparent); font-size: 10.5px; font-weight: 650; }
.kt-overview-shortcuts { padding: 20px; border-radius: 24px; background: var(--kt-sf1); }
.kt-overview-shortcuts h2 { margin: 0 0 12px; font-size: 13px; font-weight: 700; }
.kt-overview-shortcut { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 25px; color: var(--kt-onv); font-size: 11.5px; }
.kt-overview-shortcut__keys { display: flex; gap: 4px; }
.kt-overview-shortcut kbd { min-width: 24px; padding: 2px 5px; border: 1px solid var(--kt-linev); border-bottom-width: 2px; border-radius: 6px; background: var(--kt-sf0); color: var(--kt-on); font-family: ui-monospace, monospace; font-size: 9.5px; text-align: center; }

.kt-api-grid { max-height: 340px; display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; overflow-y: auto; padding: 0 4px 0 0 !important; }
.kt-api-grid .MuiListItem-root { min-height: 72px; padding: 8px !important; border: 1px solid var(--kt-linev); border-radius: 20px; background: var(--kt-sf0); }
.kt-api-grid .MuiListItemButton-root { min-height: 54px; border-radius: 15px; }
.kt-api-grid .MuiListItemButton-root.Mui-selected { background: var(--kt-pric); color: var(--kt-onpric); }
.kt-api-grid .MuiSwitch-root { flex: none; }
.kt-api-provider-icon { width: 38px !important; height: 38px !important; border: 1px solid var(--kt-linev); border-radius: 50%; background: #fff; }
.kt-api-detail { margin-top: 14px; padding: 22px; border-radius: 24px; background: var(--kt-sf1); animation: kt-m3-rise .35s var(--kt-spring); }
.kt-sync-methods { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.kt-sync-method { min-height: 116px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 16px; border: 1px solid var(--kt-linev); border-radius: 20px; background: var(--kt-sf0); color: var(--kt-on); cursor: pointer; text-align: left; transition: border-color .3s, background .3s, transform .15s; }
.kt-sync-method:active { transform: scale(.98); }
.kt-sync-method[aria-pressed="true"] { border: 2px solid var(--kt-pri); background: var(--kt-pric); color: var(--kt-onpric); }
.kt-sync-method svg { width: 25px; height: 25px; color: var(--kt-pri); }
.kt-sync-method__name { font-size: 13.5px; font-weight: 700; }
.kt-sync-method__description { color: var(--kt-onv); font-size: 10.5px; line-height: 1.4; }
.kt-sync-method[aria-pressed="true"] .kt-sync-method__description { color: inherit; opacity: .72; }

@media (max-width: 859px) {
  .kt-options-layout { display: block; }
  .kt-options-mobile-header { min-height: 62px; display: flex; align-items: center; gap: 10px; position: sticky; top: 0; z-index: 30; padding: 8px 14px; border-bottom: 1px solid var(--kt-linev); background: color-mix(in srgb, var(--kt-bg) 92%, transparent); backdrop-filter: blur(14px); }
  .kt-options-mobile-header__name { flex: 1; font-size: 14px; font-weight: 700; }
  .kt-options-sidebar { position: fixed; left: 0; transform: translateX(-105%); transition: transform .35s var(--kt-spring); box-shadow: var(--kt-shadow-2); }
  .kt-options-sidebar--open { transform: translateX(0); }
  .kt-options-overlay { display: block; position: fixed; inset: 0; z-index: 15; border: 0; background: rgba(0, 0, 0, .35); opacity: 0; pointer-events: none; transition: opacity .25s; }
  .kt-options-overlay--open { opacity: 1; pointer-events: auto; }
  .kt-options-main { padding: 26px 18px 60px; }
}

@media (max-width: 620px) {
  .kt-overview-top { grid-template-columns: 1fr; }
  .kt-api-grid { grid-template-columns: 1fr; }
  .kt-options-main { padding-inline: 14px; }
  .kt-sync-methods { grid-template-columns: 1fr; }
}
`;
