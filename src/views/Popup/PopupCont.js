import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import MouseRoundedIcon from "@mui/icons-material/MouseRounded";
import SelectAllRoundedIcon from "@mui/icons-material/SelectAllRounded";
import SubtitlesRoundedIcon from "@mui/icons-material/SubtitlesRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Switch from "@mui/material/Switch";
import { sendBgMsg, sendTabMsg, getCurTab } from "../../libs/msg";
import { isExt } from "../../libs/client";
import { useI18n } from "../../hooks/I18n";
import {
  MSG_TRANS_TOGGLE,
  MSG_TRANS_PUTRULE,
  MSG_SAVE_RULE,
  MSG_TRANSBOX_TOGGLE,
  MSG_MOUSEHOVER_TOGGLE,
  MSG_TRANSINPUT_TOGGLE,
  MSG_RUNTIME_SETTING_PATCH,
  OPT_LANGS_FROM_REVERSED as OPT_LANGS_FROM,
  OPT_LANGS_TO_REVERSED as OPT_LANGS_TO,
} from "../../config";
import { saveRule } from "../../libs/rules";
import { tryClearCaches } from "../../libs/cache";
import { kissLog } from "../../libs/log";
import { getDomainOptions, truncateMiddle } from "../../libs/url";
import { useAllTextStyles } from "../../hooks/CustomStyles";
import { useOverviewShortcuts } from "../../hooks/Commands";
import { isInBlacklist } from "../../libs/blacklist";
import { useSetting } from "../../hooks/Setting";
import ApiProviderIcon from "../../components/ApiProviderIcon";
import { COLLAPSED_SERVICE_LIMIT, getVisibleServices } from "./services";
import { css } from "@emotion/css";

export function resolvePopupTextStyles(
  allTextStyles,
  activeStyleSlug,
  expanded
) {
  if (expanded) return allTextStyles;

  const activeStyle = allTextStyles.find(
    (style) => style.styleSlug === activeStyleSlug
  );
  const seen = new Set();
  return [activeStyle, ...allTextStyles]
    .filter(Boolean)
    .filter((style) => {
      if (seen.has(style.styleSlug)) return false;
      seen.add(style.styleSlug);
      return true;
    })
    .slice(0, 5);
}

export default function PopupCont({
  rule,
  setting,
  setRule,
  setSetting,
  handleOpenSetting,
  processActions,
  isContent = false,
  onExpandedChange,
}) {
  const i18n = useI18n();
  const { setting: contextSetting, updateSetting } = useSetting();
  const shortcutMap = useOverviewShortcuts(setting);
  const [domainOptions, setDomainOptions] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [currentHref, setCurrentHref] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);
  const [showAllStyles, setShowAllStyles] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [translationBusy, setTranslationBusy] = useState(false);
  const busyTimerRef = useRef(null);
  const translationTogglePendingRef = useRef(false);
  const { allTextStyles } = useAllTextStyles();
  const popupTextStyles = useMemo(
    () =>
      resolvePopupTextStyles(allTextStyles, rule?.textStyle, showAllStyles).map(
        (style) => ({
          ...style,
          previewClass: css`
            ${style.styleCode || ""}
          `,
        })
      ),
    [allTextStyles, rule?.textStyle, showAllStyles]
  );

  const showMessage = useCallback((message) => {
    setSnackbar({ open: true, message });
  }, []);

  useEffect(
    () => () => {
      if (busyTimerRef.current) window.clearTimeout(busyTimerRef.current);
    },
    []
  );

  useEffect(() => {
    onExpandedChange?.(showAdvanced || showAllServices || showSupport);
  }, [onExpandedChange, showAdvanced, showAllServices, showSupport]);

  useEffect(
    () => () => {
      onExpandedChange?.(false);
    },
    [onExpandedChange]
  );

  const blacklistValue = contextSetting?.blacklist || "";
  const isInCurrentBlacklist = useMemo(() => {
    if (!selectedDomain || !blacklistValue) return false;
    return isInBlacklist(currentHref, blacklistValue);
  }, [blacklistValue, currentHref, selectedDomain]);

  const handleAddToBlacklist = useCallback(() => {
    if (!selectedDomain) return;
    const nextBlacklist = blacklistValue
      ? `${blacklistValue}\n${selectedDomain}`
      : selectedDomain;
    updateSetting((previous) => ({
      ...previous,
      blacklist: nextBlacklist,
    }));
    showMessage(`${i18n("add_to_blacklist")}: ${selectedDomain}`);
  }, [blacklistValue, i18n, selectedDomain, showMessage, updateSetting]);

  const handleRemoveFromBlacklist = useCallback(() => {
    if (!selectedDomain) return;
    const nextBlacklist = blacklistValue
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter((item) => item !== selectedDomain)
      .join("\n");
    updateSetting((previous) => ({
      ...previous,
      blacklist: nextBlacklist,
    }));
    showMessage(`${i18n("remove_from_blacklist")}: ${selectedDomain}`);
  }, [blacklistValue, i18n, selectedDomain, showMessage, updateSetting]);

  const putRuleValue = useCallback(
    async (name, value) => {
      setRule((previous) => ({ ...previous, [name]: value }));
      try {
        if (processActions) {
          processActions({
            action: MSG_TRANS_PUTRULE,
            args: { [name]: value },
          });
        } else {
          await sendTabMsg(MSG_TRANS_PUTRULE, { [name]: value });
        }
      } catch (error) {
        kissLog("update rule", error);
      }
    },
    [processActions, setRule]
  );

  const handleTransToggle = useCallback(
    async (event) => {
      if (translationTogglePendingRef.current) return;
      translationTogglePendingRef.current = true;
      const enabled = event.target.checked;
      let resolvedEnabled = enabled;
      setRule((previous) => ({
        ...previous,
        transOpen: enabled ? "true" : "false",
      }));
      setTranslationBusy(enabled);
      try {
        let response;
        if (processActions) {
          response = processActions({
            action: MSG_TRANS_TOGGLE,
            args: { enabled },
          });
        } else {
          response = await sendTabMsg(MSG_TRANS_TOGGLE, { enabled });
        }
        if (response?.rule) {
          resolvedEnabled =
            response.rule.transOpen === true ||
            response.rule.transOpen === "true";
          setRule(response.rule);
        }
      } catch (error) {
        kissLog("toggle translation", error);
      } finally {
        translationTogglePendingRef.current = false;
        if (busyTimerRef.current) window.clearTimeout(busyTimerRef.current);
        busyTimerRef.current = window.setTimeout(
          () => {
            setTranslationBusy(false);
            showMessage(
              resolvedEnabled ? i18n("popup_enabled") : i18n("popup_disabled")
            );
          },
          resolvedEnabled ? 900 : 0
        );
      }
    },
    [i18n, processActions, setRule, showMessage]
  );

  const handleTransboxToggle = useCallback(
    async (event) => {
      const enabled = event.target.checked;
      setSetting((previous) => ({
        ...previous,
        tranboxSetting: {
          ...previous.tranboxSetting,
          transOpen: enabled,
        },
      }));
      try {
        if (processActions) processActions({ action: MSG_TRANSBOX_TOGGLE });
        else await sendTabMsg(MSG_TRANSBOX_TOGGLE);
      } catch (error) {
        kissLog("toggle selection translation", error);
      }
    },
    [processActions, setSetting]
  );

  const handleMouseHoverToggle = useCallback(
    async (event) => {
      const enabled = event.target.checked;
      setSetting((previous) => ({
        ...previous,
        mouseHoverSetting: {
          ...previous.mouseHoverSetting,
          useMouseHover: enabled,
        },
      }));
      try {
        if (processActions) processActions({ action: MSG_MOUSEHOVER_TOGGLE });
        else await sendTabMsg(MSG_MOUSEHOVER_TOGGLE);
      } catch (error) {
        kissLog("toggle hover translation", error);
      }
    },
    [processActions, setSetting]
  );

  const handleInputToggle = useCallback(
    async (event) => {
      const enabled = event.target.checked;
      setSetting((previous) => ({
        ...previous,
        inputRule: { ...previous.inputRule, transOpen: enabled },
      }));
      try {
        if (processActions) processActions({ action: MSG_TRANSINPUT_TOGGLE });
        else await sendTabMsg(MSG_TRANSINPUT_TOGGLE);
      } catch (error) {
        kissLog("toggle input translation", error);
      }
    },
    [processActions, setSetting]
  );

  const handleSubtitleToggle = useCallback(
    (event) => {
      const enabled = event.target.checked;
      setSetting((previous) => ({
        ...previous,
        subtitleSetting: { ...previous.subtitleSetting, enabled },
      }));
      if (isExt) {
        void sendBgMsg(MSG_RUNTIME_SETTING_PATCH, {
          scope: "current",
          patch: { subtitleSetting: { enabled } },
        }).catch((error) => kissLog("apply runtime subtitle setting", error));
      } else {
        updateSetting((previous) => ({
          ...previous,
          subtitleSetting: { ...previous.subtitleSetting, enabled },
        }));
      }
    },
    [setSetting, updateSetting]
  );

  const handleClearCache = useCallback(() => {
    tryClearCaches();
    showMessage(i18n("clear_success"));
  }, [i18n, showMessage]);

  const handleSaveRule = useCallback(async () => {
    if (!selectedDomain) return;
    try {
      const currentRule = { ...rule, pattern: selectedDomain };
      if (isExt && isContent) sendBgMsg(MSG_SAVE_RULE, currentRule);
      else saveRule(currentRule);
      showMessage(`${i18n("save_rule")}: ${selectedDomain}`);
    } catch (error) {
      kissLog("save rule", error);
    }
  }, [i18n, isContent, rule, selectedDomain, showMessage]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const href = isContent
          ? window.location?.href
          : (await getCurTab())?.url || "";
        if (!active || !href) return;
        const options = getDomainOptions(href);
        setCurrentHref(href);
        setDomainOptions(options);
        setSelectedDomain(options[0] || "");
      } catch (error) {
        kissLog("get domain options", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [isContent]);

  const services = useMemo(
    () =>
      (setting?.transApis || [])
        .filter((api) => !api.isDisabled)
        .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0))
        .map((api) => ({
          key: api.apiSlug,
          type: api.apiType || api.apiSlug,
          name: api.apiName || api.apiSlug,
        })),
    [setting?.transApis]
  );

  const {
    transOpen,
    apiSlug,
    fromLang,
    toLang,
    textStyle,
    autoScan,
    transOnly,
    hasRichText,
    scanAll,
    isPlainText: plainTextValue = false,
  } = rule || {};
  const translationEnabled = transOpen === true || transOpen === "true";
  const isPlainText = plainTextValue === true || plainTextValue === "true";
  const tranboxEnabled = !!setting?.tranboxSetting?.transOpen;
  const mouseHoverEnabled = !!setting?.mouseHoverSetting?.useMouseHover;
  const inputEnabled = !!setting?.inputRule?.transOpen;
  const subtitleEnabled = !!setting?.subtitleSetting?.enabled;
  const targetName =
    OPT_LANGS_TO.find(([key]) => key === toLang)?.[1] || toLang;
  const activeService = services.find(({ key }) => key === apiSlug);
  const activeServiceName = activeService?.name || apiSlug || "—";
  const pageShortcutLabel = shortcutMap.page.join("+");
  const enabledSummary = [
    i18n("popup_enabled"),
    `${activeServiceName} → ${targetName}`,
    pageShortcutLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  const isAutoSource =
    !fromLang || fromLang === "auto" || fromLang === "$global";

  const visibleServices = useMemo(
    () => getVisibleServices(services, apiSlug, showAllServices),
    [apiSlug, services, showAllServices]
  );

  const scenes = [
    {
      key: "selection",
      label: i18n("selection_translate"),
      icon: SelectAllRoundedIcon,
      enabled: tranboxEnabled,
      onChange: handleTransboxToggle,
    },
    {
      key: "hover",
      label: i18n("mousehover_translate"),
      icon: MouseRoundedIcon,
      enabled: mouseHoverEnabled,
      onChange: handleMouseHoverToggle,
    },
    {
      key: "input",
      label: i18n("input_translate"),
      icon: KeyboardRoundedIcon,
      enabled: inputEnabled,
      onChange: handleInputToggle,
    },
    {
      key: "subtitle",
      label: i18n("subtitle_translate"),
      icon: SubtitlesRoundedIcon,
      enabled: subtitleEnabled,
      onChange: handleSubtitleToggle,
    },
  ];

  const advancedRows = [
    ["transOnly", i18n("transonly_alt"), transOnly === "true"],
    ["hasRichText", i18n("richtext_alt"), hasRichText === "true"],
    ["scanAll", i18n("scan_all_nodes"), scanAll === "true"],
    ["isPlainText", i18n("plain_text_translate"), isPlainText],
  ];

  return (
    <section className="kt-popup-content">
      <div
        className={`kt-popup-hero ${
          translationEnabled ? "" : "kt-popup-hero--off"
        } ${translationBusy ? "kt-popup-hero--busy" : ""}`}
        onClick={() =>
          handleTransToggle({ target: { checked: !translationEnabled } })
        }
      >
        <span className="kt-popup-hero__icon" aria-hidden="true">
          {translationBusy ? (
            <AutorenewRoundedIcon />
          ) : (
            <TranslateRoundedIcon />
          )}
        </span>
        <span className="kt-popup-hero__copy">
          <span className="kt-popup-hero__title">
            {i18n("popup_translate_page")}
          </span>
          <span className="kt-popup-hero__subtitle">
            {translationBusy
              ? i18n("popup_translating")
              : translationEnabled
                ? enabledSummary
                : i18n("popup_disabled")}
          </span>
        </span>
        <Switch
          className="kt-popup-main-switch"
          checked={translationEnabled}
          onChange={handleTransToggle}
          onClick={(event) => event.stopPropagation()}
          inputProps={{ "aria-label": i18n("popup_translate_page") }}
        />
        {translationBusy && <span className="kt-popup-hero__progress" />}
      </div>

      <div className="kt-popup-language-row">
        <label className="kt-popup-language">
          <span>{i18n("from_lang")}</span>
          <select
            value={fromLang}
            onChange={(event) => putRuleValue("fromLang", event.target.value)}
          >
            {OPT_LANGS_FROM.map(([key, name]) => (
              <option key={key} value={key}>
                {name.split(" - ")[0]}
              </option>
            ))}
          </select>
        </label>
        <IconButton
          className="kt-popup-swap"
          disabled={isAutoSource}
          title={i18n("swap_languages")}
          onClick={async () => {
            await putRuleValue("fromLang", toLang);
            await putRuleValue("toLang", fromLang);
          }}
        >
          <SwapHorizRoundedIcon />
        </IconButton>
        <label className="kt-popup-language">
          <span>{i18n("to_lang")}</span>
          <select
            value={toLang}
            onChange={(event) => putRuleValue("toLang", event.target.value)}
          >
            {OPT_LANGS_TO.map(([key, name]) => (
              <option key={key} value={key}>
                {name.split(" - ")[0]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <div className="kt-popup-section-label">
          {i18n("translate_service")}
        </div>
        <div
          className={`kt-popup-services ${
            showAllServices ? "kt-popup-services--open" : ""
          }`}
        >
          {visibleServices.map((service) => (
            <button
              type="button"
              className="kt-popup-service"
              aria-pressed={service.key === apiSlug}
              key={service.key}
              onClick={() => putRuleValue("apiSlug", service.key)}
            >
              <ApiProviderIcon
                apiType={service.type}
                className="kt-service-logo"
              />
              <span className="kt-popup-service__name">{service.name}</span>
            </button>
          ))}
          {services.length > COLLAPSED_SERVICE_LIMIT && (
            <button
              type="button"
              className="kt-popup-service kt-popup-more-service"
              onClick={() => setShowAllServices((current) => !current)}
            >
              {showAllServices
                ? i18n("popup_collapse")
                : `+${services.length - visibleServices.length}`}
              <ExpandMoreRoundedIcon />
            </button>
          )}
        </div>
      </div>

      <div className="kt-popup-scenes">
        {scenes.map((scene) => {
          const SceneIcon = scene.icon;
          return (
            <button
              type="button"
              className="kt-popup-scene"
              aria-pressed={scene.enabled}
              key={scene.key}
              onClick={() =>
                scene.onChange({ target: { checked: !scene.enabled } })
              }
            >
              <SceneIcon />
              <span className="kt-popup-scene__copy">
                <span className="kt-popup-scene__label">{scene.label}</span>
                <span className="kt-popup-scene__state">
                  {i18n(scene.enabled ? "popup_enabled" : "popup_disabled")}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="kt-popup-site">
        <div className="kt-popup-site__top">
          <select
            className="kt-popup-site__select"
            value={selectedDomain}
            aria-label={i18n("domain")}
            onChange={(event) => setSelectedDomain(event.target.value)}
          >
            {domainOptions.map((domain) => (
              <option key={domain} value={domain} title={domain}>
                {truncateMiddle(domain)}
              </option>
            ))}
          </select>
          <span
            className={`kt-popup-site__badge ${
              isInCurrentBlacklist ? "kt-popup-site__badge--blocked" : ""
            }`}
          >
            {i18n(
              isInCurrentBlacklist
                ? "popup_domain_blocked"
                : "popup_domain_active"
            )}
          </span>
        </div>
        <div className="kt-popup-site__actions">
          <Button
            variant="contained"
            color="secondary"
            onClick={handleSaveRule}
            disabled={!domainOptions.length}
          >
            {i18n("save_rule")}
          </Button>
          <Button
            variant={isInCurrentBlacklist ? "contained" : "outlined"}
            color={isInCurrentBlacklist ? "error" : "primary"}
            onClick={
              isInCurrentBlacklist
                ? handleRemoveFromBlacklist
                : handleAddToBlacklist
            }
            disabled={!domainOptions.length}
          >
            {i18n(
              isInCurrentBlacklist
                ? "remove_from_blacklist"
                : "add_to_blacklist"
            )}
          </Button>
          <IconButton
            onClick={handleClearCache}
            aria-label={i18n("clear_cache")}
          >
            <DeleteSweepRoundedIcon />
          </IconButton>
        </div>
      </div>

      <div className="kt-popup-disclosure-row">
        <button
          type="button"
          className="kt-popup-disclosure"
          aria-expanded={showAdvanced}
          onClick={() => setShowAdvanced((current) => !current)}
        >
          {i18n("popup_advanced_options")}
          <ExpandMoreRoundedIcon />
        </button>
        {!isContent && (
          <Button
            className="kt-popup-disclosure-support"
            variant="text"
            aria-expanded={showSupport}
            onClick={() => setShowSupport((current) => !current)}
          >
            {i18n("popup_support")}
          </Button>
        )}
      </div>

      {showAdvanced && (
        <div className="kt-popup-advanced">
          <div>
            <div className="kt-popup-section-label">
              {i18n("text_style_alt")}
            </div>
            <div
              className={`kt-popup-style-chips ${
                showAllStyles ? "kt-popup-style-chips--open" : ""
              }`}
            >
              {popupTextStyles.map((style) => (
                <button
                  type="button"
                  className="kt-popup-style-chip"
                  aria-pressed={style.styleSlug === textStyle}
                  key={style.styleSlug}
                  onClick={() => putRuleValue("textStyle", style.styleSlug)}
                >
                  <span className={style.previewClass}>
                    {i18n("style_preview_translation")}
                  </span>
                  <small>{style.styleName}</small>
                </button>
              ))}
            </div>
            {allTextStyles.length > 5 && (
              <button
                type="button"
                className="kt-popup-style-more"
                aria-expanded={showAllStyles}
                onClick={() => setShowAllStyles((current) => !current)}
              >
                {i18n(showAllStyles ? "popup_collapse" : "popup_all_styles")}
                <ExpandMoreRoundedIcon />
              </button>
            )}
          </div>
          <div className="kt-popup-advanced-grid">
            {advancedRows.map(([name, label, checked]) => (
              <div className="kt-popup-advanced-row" key={name}>
                <span>{label}</span>
                <Switch
                  size="small"
                  checked={checked}
                  onChange={(event) =>
                    putRuleValue(
                      name,
                      name === "isPlainText"
                        ? event.target.checked
                        : event.target.checked
                          ? "true"
                          : "false"
                    )
                  }
                  inputProps={{ "aria-label": label }}
                />
              </div>
            ))}
          </div>
          <div className="kt-popup-advanced-row">
            <span>{i18n("autoscan_alt")}</span>
            <Switch
              size="small"
              checked={autoScan === "true"}
              onChange={(event) =>
                putRuleValue(
                  "autoScan",
                  event.target.checked ? "true" : "false"
                )
              }
              inputProps={{ "aria-label": i18n("autoscan_alt") }}
            />
          </div>
        </div>
      )}

      {showSupport && (
        <div className="kt-popup-support" role="menu">
          <a
            role="menuitem"
            href={process.env.REACT_APP_REVIEW_URL}
            target="_blank"
            rel="noreferrer"
          >
            {i18n("comment_support")}
          </a>
          <a
            role="menuitem"
            href={process.env.REACT_APP_SUPPORT_URL}
            target="_blank"
            rel="noreferrer"
          >
            {i18n("appreciate_support")}
          </a>
        </div>
      )}

      {isContent && (
        <footer className="kt-popup-footer">
          {[shortcutMap.page, shortcutMap.selection]
            .filter((keys) => keys.length > 0)
            .map((keys) => (
              <span className="kt-popup-footer__keys" key={keys.join("+")}>
                {keys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </span>
            ))}
          <span className="kt-popup-footer__spacer" />
          <Button
            variant="text"
            aria-expanded={showSupport}
            onClick={() => setShowSupport((current) => !current)}
          >
            {i18n("popup_support")}
          </Button>
          <Button variant="text" onClick={handleOpenSetting}>
            {i18n("popup_all_settings")}
          </Button>
        </footer>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2200}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        onClose={() => setSnackbar({ open: false, message: "" })}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setSnackbar({ open: false, message: "" })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </section>
  );
}
