import { useCallback, useEffect, useMemo, useState } from "react";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import { sendBgMsg, sendTabMsg } from "../../libs/msg";
import { browser } from "../../libs/browser";
import { useI18n } from "../../hooks/I18n";
import Header from "./Header";
import {
  MSG_OPEN_SEPARATE_WINDOW,
  MSG_TRANS_GETRULE,
  DEFAULT_SETTING,
  GLOBLA_RULE,
  resolveApiPromptList,
} from "../../config";
import { kissLog } from "../../libs/log";
import PopupCont from "./PopupCont";
import TranForm from "../Selection/TranForm";
import { useSetting } from "../../hooks/Setting";
import { M3Button, M3Segmented } from "../../components/M3";
import { POPUP_STYLES } from "./styles";

function TranslationTab() {
  const [text, setText] = useState("");
  const { setting } = useSetting();

  if (!setting?.tranboxSetting) {
    return (
      <div className="kt-popup-loading" role="status">
        <AutorenewRoundedIcon />
      </div>
    );
  }

  const {
    tranboxSetting: {
      enDict,
      enSug,
      apiSlugs,
      fromLang,
      toLang,
      toLang2,
      aiDictApiSlug,
      aiDictPromptSlug,
    },
    transApis = [],
    langDetector = {},
    prompts = [],
    subtitleSetting,
  } = setting;
  const resolvedTransApis = resolveApiPromptList(
    transApis,
    prompts,
    subtitleSetting
  );

  return (
    <div className="kt-popup-text-panel">
      <TranForm
        text={text}
        setText={setText}
        apiSlugs={apiSlugs}
        fromLang={fromLang}
        toLang={toLang}
        toLang2={toLang2}
        transApis={resolvedTransApis}
        simpleStyle={false}
        langDetector={langDetector}
        enDict={enDict}
        enSug={enSug}
        aiDictApiSlug={aiDictApiSlug}
        aiDictPromptSlug={aiDictPromptSlug}
        prompts={prompts}
      />
    </div>
  );
}

export default function Popup() {
  const i18n = useI18n();
  const [rule, setRule] = useState(null);
  const [setting, setSetting] = useState(null);
  const [activeTab, setActiveTab] = useState("page");
  const [isSeparate, setIsSeparate] = useState(false);

  const handleOpenSetting = useCallback(() => {
    browser?.runtime.openOptionsPage();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const previewMode =
          process.env.NODE_ENV === "development" &&
          new URLSearchParams(window.location.search).has("preview");
        if (previewMode) {
          setRule({
            ...GLOBLA_RULE,
            transOpen: "true",
            textStyle: "dash_line",
          });
          setSetting({
            ...DEFAULT_SETTING,
            uiLang: "zh",
            darkMode: "light",
            tranboxSetting: {
              ...DEFAULT_SETTING.tranboxSetting,
              transOpen: true,
            },
            mouseHoverSetting: {
              ...DEFAULT_SETTING.mouseHoverSetting,
              useMouseHover: true,
            },
          });
          return;
        }
        const cleanHash = window.location.hash.slice(1);
        if (cleanHash === "tranbox") {
          if (active) setIsSeparate(true);
          return;
        }
        const response = await sendTabMsg(MSG_TRANS_GETRULE);
        if (active && response && !response.error) {
          setRule(response.rule);
          setSetting(response.setting);
        }
      } catch (error) {
        kissLog("query rule", error);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const openSeparateWindow = useCallback(() => {
    sendBgMsg(MSG_OPEN_SEPARATE_WINDOW);
    window.close();
  }, []);

  const tabs = useMemo(
    () => [
      { value: "page", label: i18n("popup_page_translation") },
      { value: "text", label: i18n("popup_text_translation") },
    ],
    [i18n]
  );

  if (isSeparate) {
    return (
      <main className="kt-popup-shell kt-popup-shell--window">
        <style>{POPUP_STYLES}</style>
        <TranslationTab />
      </main>
    );
  }

  return (
    <main className="kt-popup-shell">
      <style>{POPUP_STYLES}</style>
      <Header
        openSeparateWindow={openSeparateWindow}
        openSettings={handleOpenSetting}
      />
      <M3Segmented
        className="kt-popup-tabs"
        items={tabs}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel={i18n("translate")}
      />
      <div
        className={`kt-popup-scroll ${
          activeTab === "text" ? "kt-popup-scroll--text" : ""
        }`}
      >
        {activeTab === "text" ? (
          <TranslationTab />
        ) : rule && setting ? (
          <PopupCont
            rule={rule}
            setting={setting}
            setRule={setRule}
            setSetting={setSetting}
            handleOpenSetting={handleOpenSetting}
          />
        ) : (
          <div className="kt-popup-empty">
            <span>{i18n("load_setting_err")}</span>
            <div className="kt-popup-empty__actions">
              <M3Button
                variant="text"
                onClick={() =>
                  window.open(
                    "https://chromewebstore.google.com/detail/kiss-translator/bdiifdefkgmcblbcghdlonllpjhhjgof/reviews",
                    "_blank"
                  )
                }
              >
                {i18n("comment_support")}
              </M3Button>
              <M3Button variant="text" onClick={handleOpenSetting}>
                {i18n("setting")}
              </M3Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
