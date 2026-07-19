import { useCallback, useMemo } from "react";
import { API_SPE_TYPES, SUBTITLE_BACKGROUND_STYLES } from "../config";
import {
  createM3CssVariables,
  resolveM3Colors,
  resolveM3ThemeMode,
} from "../styles/m3";
import { useSystemDarkPreference } from "../hooks/SystemColorScheme";

export const MENU_STYLES = String.raw`
.kt-subtitle-panel {
  --kt-spring: cubic-bezier(.3, 1.4, .4, 1);
  width: min(322px, calc(100vw - 24px));
  position: absolute;
  right: 0;
  bottom: 78px;
  z-index: 2147483647;
  max-height: calc(100vh - 112px);
  max-height: min(640px, calc(100dvh - 112px));
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 18px;
  border: 1px solid var(--kt-linev);
  border-radius: 24px;
  background: var(--kt-sf0);
  box-shadow: 0 4px 8px 3px rgba(0,0,0,.1), 0 1px 3px rgba(0,0,0,.18);
  color: var(--kt-on);
  font-family: "Google Sans Flex", "Noto Sans SC", system-ui, sans-serif;
  line-height: 1.4;
  animation: kt-subtitle-up .4s var(--kt-spring);
  display: flex;
  flex-direction: column;
  scrollbar-gutter: stable;
}
.kt-subtitle-panel * { box-sizing: border-box; }
.kt-subtitle-panel::-webkit-scrollbar { width: 8px; }
.kt-subtitle-panel::-webkit-scrollbar-thumb { border: 2px solid transparent; border-radius: 999px; background: var(--kt-linev); background-clip: content-box; }
.kt-subtitle-panel__header { display: flex; align-items: center; gap: 10px; order: -1; position: sticky; top: -18px; z-index: 2; margin-bottom: 8px; padding: 10px 0 8px; background: var(--kt-sf0); font-size: 15px; font-weight: 700; }
.kt-subtitle-panel__header-icon { width: 29px; height: 29px; display: grid; place-items: center; border-radius: 10px; background: var(--kt-pric); color: var(--kt-onpric); font-size: 15px; }
.kt-subtitle-row { min-height: 62px; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 9px 0; border-bottom: 1px solid var(--kt-linev); }
.kt-subtitle-row__copy { min-width: 0; }
.kt-subtitle-row__label { overflow: hidden; font-size: 12.5px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.kt-subtitle-row__hint { margin-top: 2px; color: var(--kt-onv); font-size: 10.5px; }
.kt-subtitle-switch { width: 52px; height: 32px; flex: none; position: relative; padding: 0; border: 2px solid var(--kt-line); border-radius: 999px; background: var(--kt-sf3); cursor: pointer; transition: background .35s var(--kt-spring), border-color .35s var(--kt-spring); }
.kt-subtitle-switch::after { content: ""; width: 16px; height: 16px; position: absolute; top: 50%; left: 6px; border-radius: 50%; background: var(--kt-line); transform: translateY(-50%); transition: all .35s var(--kt-spring); }
.kt-subtitle-switch[aria-checked="true"] { border-color: var(--kt-pri); background: var(--kt-pri); }
.kt-subtitle-switch[aria-checked="true"]::after { width: 24px; height: 24px; top: 50%; left: 22px; background: var(--kt-onpri); }
.kt-subtitle-select { max-width: 142px; min-height: 38px; padding: 0 30px 0 12px; border: 0; border-radius: 999px; outline: 0; background: var(--kt-sf2); color: var(--kt-on); font: inherit; font-size: 11.5px; font-weight: 650; }
.kt-subtitle-segmented { display: flex; gap: 3px; margin: 8px 0 5px; padding: 3px; border-radius: 999px; background: var(--kt-sf2); }
.kt-subtitle-segmented button { min-width: 0; min-height: 34px; flex: 1; overflow: hidden; padding: 0 8px; border: 0; border-radius: 999px; background: transparent; color: var(--kt-onv); cursor: pointer; font: inherit; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.kt-subtitle-segmented button[aria-pressed="true"] { background: var(--kt-secc); color: var(--kt-onsecc); font-weight: 700; }
.kt-subtitle-section-label { margin-top: 12px; font-size: 11.5px; font-weight: 700; }
.kt-subtitle-range { min-height: 62px; display: grid; grid-template-columns: minmax(0, 1fr) 104px 42px; align-items: center; gap: 9px; padding: 9px 0; border-bottom: 1px solid var(--kt-linev); }
.kt-subtitle-range label { min-width: 0; overflow: hidden; font-size: 12.5px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.kt-subtitle-range input { width: 100%; accent-color: var(--kt-pri); cursor: pointer; }
.kt-subtitle-range output { color: var(--kt-onv); font-size: 11px; font-weight: 700; text-align: right; }
.kt-subtitle-progress { height: 4px; margin-top: 14px; overflow: hidden; border-radius: 999px; background: var(--kt-sf2); }
.kt-subtitle-progress span { height: 100%; display: block; border-radius: inherit; background: var(--kt-pri); transition: width .3s; }
.kt-subtitle-download { width: 100%; min-height: 42px; margin-top: 12px; border: 1px solid transparent; border-radius: 999px; background: var(--kt-pric); color: var(--kt-onpric); cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; transition: background .3s, border-color .3s, color .3s, transform .15s; }
.kt-subtitle-download[data-partial="true"] { border-color: var(--kt-linev); background: var(--kt-sf2); color: var(--kt-on); }
.kt-subtitle-download:not(:disabled):active { transform: scale(.98); }
.kt-subtitle-download:disabled { cursor: default; opacity: .45; }
.kt-subtitle-all-settings { width: 100%; min-height: 42px; margin-top: 8px; border: 0; border-radius: 999px; background: transparent; color: var(--kt-pri); cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; }
.kt-subtitle-all-settings:hover { background: var(--kt-sf2); }
@keyframes kt-subtitle-up { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
`;

function Switch({ label, hint, name, value, onChange, disabled = false }) {
  const handleClick = useCallback(() => {
    if (!disabled) onChange({ name, value: !value });
  }, [disabled, name, onChange, value]);

  return (
    <div className="kt-subtitle-row" onClick={handleClick}>
      <div className="kt-subtitle-row__copy">
        <div className="kt-subtitle-row__label">{label}</div>
        {hint && <div className="kt-subtitle-row__hint">{hint}</div>}
      </div>
      <button
        type="button"
        className="kt-subtitle-switch"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          handleClick();
        }}
      />
    </div>
  );
}

function Select({ label, name, value, options, onChange, disabled = false }) {
  return (
    <label className="kt-subtitle-row">
      <span className="kt-subtitle-row__label">{label}</span>
      <select
        className="kt-subtitle-select"
        name={name}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange({ name, value: event.target.value })}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Segmented({ label, value, items, onChange }) {
  return (
    <div>
      <div className="kt-subtitle-section-label">{label}</div>
      <div className="kt-subtitle-segmented">
        {items.map((item) => (
          <button
            type="button"
            aria-pressed={value === item.value}
            onClick={() => onChange(item.value)}
            key={item.value}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Range({ label, name, value, min, max, onChange }) {
  return (
    <div className="kt-subtitle-range">
      <label htmlFor={`kt-subtitle-${name}`}>{label}</label>
      <input
        id={`kt-subtitle-${name}`}
        name={name}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) =>
          onChange({ name, value: Number(event.target.value) })
        }
      />
      <output htmlFor={`kt-subtitle-${name}`}>{value}%</output>
    </div>
  );
}

export function resolveSubtitleBackgroundMode(windowStyle = "") {
  if (/background(?:-image)?\s*:\s*linear-gradient/i.test(windowStyle)) {
    return "gradient";
  }
  if (/background(?:-color)?\s*:\s*(?:transparent|none)/i.test(windowStyle)) {
    return "none";
  }
  return "translucent";
}

export function Menus({
  i18n,
  formData,
  progressed = 0,
  updateSetting,
  downloadSubtitle,
  openSettings,
  transApis,
  brandColor = "blue",
  darkMode = "auto",
}) {
  const prefersDark = useSystemDarkPreference();
  const resolvedMode = resolveM3ThemeMode(darkMode, prefersDark);
  const themeVariables = useMemo(
    () => createM3CssVariables(resolveM3Colors(resolvedMode, brandColor)),
    [brandColor, resolvedMode]
  );
  const handleChange = useCallback(
    ({ name, value }) => updateSetting({ name, value }),
    [updateSetting]
  );

  const enabledApis = useMemo(
    () => (transApis || []).filter((api) => !api.isDisabled),
    [transApis]
  );
  const aiEnabledApis = useMemo(
    () => enabledApis.filter((api) => API_SPE_TYPES.ai.has(api.apiType)),
    [enabledApis]
  );
  const segOptions = useMemo(
    () => [
      { value: "-", label: i18n("disable") },
      ...aiEnabledApis.map((api) => ({
        value: api.apiSlug,
        label: api.apiName,
      })),
    ],
    [aiEnabledApis, i18n]
  );
  const aiContextOptions = useMemo(
    () => [
      { value: "-", label: i18n("disable") },
      ...aiEnabledApis.map((api) => ({
        value: api.apiSlug,
        label: api.apiName,
      })),
    ],
    [aiEnabledApis, i18n]
  );
  const serviceOptions = useMemo(
    () =>
      enabledApis.map((api) => ({
        value: api.apiSlug,
        label: api.apiName,
      })),
    [enabledApis]
  );

  const {
    segSlug = "-",
    skipAd = false,
    isBilingual = true,
    blurTranslation = false,
    fontScale = 100,
    autoTranslate = true,
    aiContextSlug = "-",
    displayOrder = "original-first",
    apiSlug = serviceOptions[0]?.value || "",
    windowStyle = "",
  } = formData;
  const backgroundMode = resolveSubtitleBackgroundMode(windowStyle);
  const normalizedProgress = Math.min(
    100,
    Math.max(0, Number(progressed) || 0)
  );
  const isPartialDownload = normalizedProgress > 0 && normalizedProgress < 100;
  const downloadLabel =
    normalizedProgress === 0
      ? i18n("waiting_subtitles")
      : normalizedProgress === 100
        ? i18n("download_subtitles")
        : i18n("download_processed_subtitles");

  return (
    <div
      className="kt-subtitle-panel"
      data-theme={resolvedMode}
      data-brand={brandColor}
      style={{ ...themeVariables, colorScheme: resolvedMode }}
    >
      <Switch
        name="autoTranslate"
        value={autoTranslate}
        label={i18n("enable_subtitle_translate")}
        onChange={handleChange}
      />
      <Range
        name="fontScale"
        value={fontScale}
        min={80}
        max={150}
        label={i18n("subtitle_font_scale")}
        onChange={handleChange}
      />
      <div className="kt-subtitle-panel__header">
        <span className="kt-subtitle-panel__header-icon">CC</span>
        <span>{i18n("subtitle_translate")}</span>
      </div>
      <Switch
        name="isBilingual"
        value={isBilingual}
        label={i18n("bilingual_subtitles")}
        onChange={handleChange}
      />
      <Segmented
        label={i18n("subtitle_display_order")}
        value={displayOrder}
        onChange={(value) => handleChange({ name: "displayOrder", value })}
        items={[
          { value: "original-first", label: i18n("original_first") },
          { value: "translation-first", label: i18n("translation_first") },
        ]}
      />
      <Switch
        name="blurTranslation"
        value={blurTranslation}
        label={i18n("is_blur_translation")}
        onChange={handleChange}
      />
      <Select
        name="segSlug"
        value={segSlug}
        options={segOptions}
        label={i18n("ai_segmentation")}
        disabled={segOptions.length <= 1}
        onChange={handleChange}
      />
      <Select
        name="aiContextSlug"
        value={aiContextSlug}
        options={aiContextOptions}
        label={i18n("ai_enhanced_context")}
        disabled={aiContextOptions.length <= 1}
        onChange={handleChange}
      />
      <Segmented
        label={i18n("subtitle_background")}
        value={backgroundMode}
        onChange={(value) =>
          handleChange({
            name: "windowStyle",
            value: SUBTITLE_BACKGROUND_STYLES[value],
          })
        }
        items={[
          {
            value: "translucent",
            label: i18n("subtitle_background_translucent"),
          },
          { value: "gradient", label: i18n("subtitle_background_gradient") },
          { value: "none", label: i18n("subtitle_background_none") },
        ]}
      />
      {serviceOptions.length > 0 && (
        <Select
          name="apiSlug"
          value={apiSlug}
          options={serviceOptions}
          label={i18n("translate_service")}
          onChange={handleChange}
        />
      )}
      <Switch
        name="skipAd"
        value={skipAd}
        label={i18n("is_skip_ad")}
        onChange={handleChange}
      />
      <div className="kt-subtitle-progress" aria-hidden="true">
        <span style={{ width: `${normalizedProgress}%` }} />
      </div>
      <button
        type="button"
        className="kt-subtitle-download"
        data-partial={isPartialDownload}
        disabled={normalizedProgress === 0}
        onClick={downloadSubtitle}
      >
        {downloadLabel} · {normalizedProgress}%
      </button>
      {openSettings && (
        <button
          type="button"
          className="kt-subtitle-all-settings"
          onClick={openSettings}
        >
          {i18n("all_subtitle_settings")} →
        </button>
      )}
      <style>{MENU_STYLES}</style>
    </div>
  );
}
