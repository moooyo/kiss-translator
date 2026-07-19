import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import { M3Switch } from "../../components/M3";
import { useI18n } from "../../hooks/I18n";
import { useSetting } from "../../hooks/Setting";
import { useRules } from "../../hooks/Rules";
import { useOverviewShortcuts } from "../../hooks/Commands";
import { isExt } from "../../libs/client";
import { sendBgMsg } from "../../libs/msg";
import { kissLog } from "../../libs/log";
import {
  GLOBLA_RULE,
  MSG_RUNTIME_SETTING_PATCH,
  OPT_LANGS_FROM_REVERSED as OPT_LANGS_FROM,
  OPT_LANGS_TO_REVERSED as OPT_LANGS_TO,
} from "../../config";

export default function OverviewHero() {
  const i18n = useI18n();
  const { setting, updateSetting } = useSetting();
  const { list: rules } = useRules();
  const shortcutMap = useOverviewShortcuts(setting);
  const enabled = setting.extensionEnabled !== false;
  const globalRule = rules.find((rule) => rule.pattern === "*") || GLOBLA_RULE;
  const activeApi = (setting.transApis || []).find(
    (api) => api.apiSlug === globalRule.apiSlug
  );
  const serviceName =
    activeApi?.apiName || activeApi?.apiType || globalRule.apiSlug || "—";
  const sourceLanguage =
    OPT_LANGS_FROM.find(([key]) => key === globalRule.fromLang)?.[1] ||
    globalRule.fromLang ||
    "—";
  const targetLanguage =
    OPT_LANGS_TO.find(([key]) => key === globalRule.toLang)?.[1] ||
    globalRule.toLang ||
    "—";
  const shortcuts = [
    [i18n("popup_translate_page"), shortcutMap.page],
    [i18n("popup_text_translation"), shortcutMap.popup],
    [i18n("text_style_alt"), shortcutMap.style],
    [i18n("selection_translate"), shortcutMap.selection],
    [i18n("input_translate"), shortcutMap.input],
    [i18n("setting"), shortcutMap.settings],
  ];

  const handleExtensionEnabledChange = (event) => {
    const extensionEnabled = event.target.checked;
    updateSetting({ extensionEnabled });
    if (isExt) {
      void sendBgMsg(MSG_RUNTIME_SETTING_PATCH, {
        scope: "all",
        patch: { extensionEnabled },
      }).catch((error) => kissLog("apply runtime extension setting", error));
    }
  };

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
            onChange={handleExtensionEnabledChange}
            aria-label={i18n("translate_switch")}
          />
        </div>
        <div className="kt-overview-hero__chips">
          <span className="kt-overview-hero__chip">{serviceName}</span>
          <span className="kt-overview-hero__chip">
            {sourceLanguage.split(" - ")[0]} → {targetLanguage.split(" - ")[0]}
          </span>
        </div>
      </div>
      <div className="kt-overview-shortcuts">
        <h2>{i18n("options_shortcuts")}</h2>
        {shortcuts.map(([label, keys]) => (
          <div className="kt-overview-shortcut" key={label}>
            <span>{label}</span>
            <span className="kt-overview-shortcut__keys">
              {(keys.length ? keys : ["—"]).map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
