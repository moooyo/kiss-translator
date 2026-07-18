import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import { M3Switch } from "../../components/M3";
import { useI18n } from "../../hooks/I18n";
import { useSetting } from "../../hooks/Setting";

export default function OverviewHero() {
  const i18n = useI18n();
  const { setting, updateSetting } = useSetting();
  const enabled = setting.extensionEnabled !== false;
  const activeApi = (setting.transApis || []).find((api) => !api.isDisabled);
  const serviceName = activeApi?.apiName || activeApi?.apiType || "—";
  const language = setting.tranboxSetting?.toLang || "zh-CN";
  const shortcuts = [
    [i18n("popup_translate_page"), ["Alt", "Q"]],
    [i18n("popup_text_translation"), ["Alt", "K"]],
    [i18n("text_style_alt"), ["Alt", "C"]],
    [i18n("selection_translate"), ["Alt", "S"]],
    [i18n("input_translate"), ["Alt", "I"]],
    [i18n("setting"), ["Alt", "O"]],
  ];

  return (
    <section className="kt-overview-top">
      <div className="kt-overview-hero">
        <div className="kt-overview-hero__status">
          <span className="kt-overview-hero__icon" aria-hidden="true">
            <TranslateRoundedIcon />
          </span>
          <span className="kt-overview-hero__copy">
            <span className="kt-overview-hero__title">
              {i18n(
                enabled
                  ? "options_translation_enabled"
                  : "options_translation_disabled"
              )}
            </span>
            <span className="kt-overview-hero__subtitle">
              {enabled ? i18n("popup_enabled") : i18n("popup_disabled")}
            </span>
          </span>
          <M3Switch
            checked={enabled}
            onChange={(event) =>
              updateSetting({ extensionEnabled: event.target.checked })
            }
            aria-label={i18n("translate_switch")}
          />
        </div>
        <div className="kt-overview-hero__chips">
          <span className="kt-overview-hero__chip">{serviceName}</span>
          <span className="kt-overview-hero__chip">Auto → {language}</span>
        </div>
      </div>
      <div className="kt-overview-shortcuts">
        <h2>{i18n("options_shortcuts")}</h2>
        {shortcuts.map(([label, keys]) => (
          <div className="kt-overview-shortcut" key={label}>
            <span>{label}</span>
            <span className="kt-overview-shortcut__keys">
              {keys.map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
