import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import Button from "@mui/material/Button";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { sendBgMsg } from "../../libs/msg";
import { useI18n } from "../../hooks/I18n";
import Header from "./Header";
import {
  MSG_OPEN_OPTIONS,
  MSG_OPEN_SEPARATE_WINDOW,
  MSG_FIT_SEPARATE_WINDOW,
  SEPARATE_WINDOW_CONTENT_WIDTH,
  DEFAULT_SETTING,
  GLOBLA_RULE,
  resolveApiPromptList,
} from "../../config";
import { kissLog } from "../../libs/log";
import PopupCont from "./PopupCont";
import TranForm from "../Selection/TranForm";
import { useSetting } from "../../hooks/Setting";
import { isAutoTranslateClipboardSupported } from "../../libs/client";
import { readClipboardTextIfAllowed } from "../../libs/clipboard";
import { POPUP_STYLES } from "./styles";
import { loadPopupData } from "./loadData";

/**
 * 独立窗口打开后,量出内容真正需要多高,请后台把窗口收到那个尺寸。
 *
 * 为什么不在后台直接算:高度取决于界面语言(标签换不换行)、浏览器缩放、
 * 系统字号 —— 这些只有页面自己渲染完才知道。宽度反过来不测,它有设计上限
 * (SEPARATE_WINDOW_CONTENT_WIDTH),再宽一行文字就长到扫不过来了。
 *
 * 只量一次:内容会随着输入和译文返回变高,跟着变会让窗口在用户打字时乱跳。
 *
 * @param {boolean} enabled 是否处于独立窗口且内容已经渲染
 * @returns {void}
 */
function useFitSeparateWindow(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;

    // 等一帧,让布局落定再量,否则量到的是上一帧的高度
    const frame = requestAnimationFrame(() => {
      const panel = document.querySelector(".kt-popup-text-panel");
      if (!panel) return;

      // outer - inner 就是标题栏和边框占掉的部分,各平台不一样,只能实测
      const chromeHeight = Math.max(0, window.outerHeight - window.innerHeight);
      const chromeWidth = Math.max(0, window.outerWidth - window.innerWidth);

      sendBgMsg(MSG_FIT_SEPARATE_WINDOW, {
        width: SEPARATE_WINDOW_CONTENT_WIDTH + chromeWidth,
        height: Math.ceil(panel.scrollHeight) + chromeHeight,
        availWidth: window.screen?.availWidth,
        availHeight: window.screen?.availHeight,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [enabled]);
}

/**
 * 文本翻译面板组件 (用于直接在 Popup 中输入文本进行翻译)
 */
export function Trantab({ isSeparate = false }) {
  const [text, setText] = useState("");
  const i18n = useI18n();
  const { setting } = useSetting();
  const shouldReadClipboardInitially =
    isAutoTranslateClipboardSupported &&
    (setting?.autoTranslateClipboard ?? false);
  const [autoTranslateClipboard, setAutoTranslateClipboard] = useState(
    setting?.autoTranslateClipboard ?? false
  );
  const [autoFocusInput, setAutoFocusInput] = useState(
    !shouldReadClipboardInitially
  );
  const initialClipboardReadRef = useRef(shouldReadClipboardInitially);
  const readingClipboardRef = useRef(false);
  const lastClipboardTextRef = useRef("");
  const textRef = useRef(text);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    setAutoTranslateClipboard(setting?.autoTranslateClipboard ?? false);
  }, [setting?.autoTranslateClipboard]);

  const translateClipboard = useCallback(async () => {
    if (
      !isAutoTranslateClipboardSupported ||
      !autoTranslateClipboard ||
      readingClipboardRef.current
    ) {
      return;
    }

    readingClipboardRef.current = true;
    let hasClipboardText = false;
    try {
      const clipboardText = await readClipboardTextIfAllowed();
      if (clipboardText === null) return;

      const normalizedText = clipboardText.trim();
      hasClipboardText = Boolean(normalizedText);
      if (
        !normalizedText ||
        normalizedText === lastClipboardTextRef.current ||
        normalizedText === textRef.current
      ) {
        lastClipboardTextRef.current = normalizedText;
        return;
      }

      lastClipboardTextRef.current = normalizedText;
      setText(normalizedText);
    } finally {
      if (initialClipboardReadRef.current) {
        initialClipboardReadRef.current = false;
        setAutoFocusInput(!hasClipboardText);
      }
      readingClipboardRef.current = false;
    }
  }, [autoTranslateClipboard]);

  useEffect(() => {
    translateClipboard();
    if (!isSeparate) return;

    window.addEventListener("focus", translateClipboard);
    return () => window.removeEventListener("focus", translateClipboard);
  }, [isSeparate, translateClipboard]);

  // 必须等设置加载完 —— 在那之前渲染的是 260px 高的加载态,
  // 这时候量会把窗口收成一条缝。
  useFitSeparateWindow(isSeparate && Boolean(setting?.tranboxSetting));

  if (!setting?.tranboxSetting) {
    return (
      <div
        className="kt-popup-loading"
        role="status"
        aria-label={i18n("popup_loading")}
      >
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
    translateVariants,
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
        translateVariants={translateVariants}
        autoFocusInput={autoFocusInput}
        syncExternalTextWhileEditing
        popupStyle
      />
    </div>
  );
}

export default function Popup() {
  const i18n = useI18n();
  const [rule, setRule] = useState(null);
  const [setting, setSetting] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("page");
  const [isSeparate, setIsSeparate] = useState(false);
  const popupShellRef = useRef(null);
  const initialFocusGuardRef = useRef(true);

  useLayoutEffect(() => {
    if (!isSeparate) {
      popupShellRef.current?.focus({ preventScroll: true });
    }
  }, [isSeparate]);

  useEffect(() => {
    if (isSeparate || isLoading) return undefined;

    let activationTimer;
    const clearSafariAutofocus = () => {
      if (!initialFocusGuardRef.current) return;
      const shell = popupShellRef.current;
      if (!shell) return;
      if (shell.contains(document.activeElement)) {
        document.activeElement?.blur?.();
      }
      shell.focus({ preventScroll: true });
    };
    const handleWindowFocus = (event) => {
      if (event.target !== window) return;
      window.clearTimeout(activationTimer);
      activationTimer = window.setTimeout(clearSafariAutofocus, 0);
    };

    window.addEventListener("focus", handleWindowFocus);
    const mountTimer = window.setTimeout(clearSafariAutofocus, 0);
    const settleTimer = window.setTimeout(clearSafariAutofocus, 120);
    const guardTimer = window.setTimeout(() => {
      initialFocusGuardRef.current = false;
      window.removeEventListener("focus", handleWindowFocus);
    }, 300);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      window.clearTimeout(activationTimer);
      window.clearTimeout(mountTimer);
      window.clearTimeout(settleTimer);
      window.clearTimeout(guardTimer);
    };
  }, [isLoading, isSeparate]);

  const handleOpenSetting = useCallback(() => {
    sendBgMsg(MSG_OPEN_OPTIONS);
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
        const response = await loadPopupData();
        if (active && response && !response.error) {
          setRule(response.rule);
          setSetting(response.setting);
        }
      } catch (error) {
        kissLog("query rule", error);
      } finally {
        if (active) setIsLoading(false);
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
      {
        value: "page",
        label: i18n("popup_page_translation"),
        tabId: "kt-popup-page-tab",
        panelId: "kt-popup-active-panel",
      },
      {
        value: "text",
        label: i18n("popup_text_translation"),
        tabId: "kt-popup-text-tab",
        panelId: "kt-popup-active-panel",
      },
    ],
    [i18n]
  );

  if (isSeparate) {
    return (
      <main className="kt-popup-shell kt-popup-shell--window">
        <style>{POPUP_STYLES}</style>
        <Trantab isSeparate />
      </main>
    );
  }

  return (
    <main
      className="kt-popup-shell"
      ref={popupShellRef}
      tabIndex={-1}
      onPointerDownCapture={() => {
        initialFocusGuardRef.current = false;
      }}
      onKeyDownCapture={() => {
        initialFocusGuardRef.current = false;
      }}
    >
      <style>{POPUP_STYLES}</style>
      <div className="kt-popup-chrome">
        <Header
          openSeparateWindow={openSeparateWindow}
          openSettings={handleOpenSetting}
        />
        <Tabs
          className="kt-popup-tabs"
          value={activeTab}
          onChange={(_event, value) => setActiveTab(value)}
          aria-label={i18n("translate")}
          variant="fullWidth"
        >
          {tabs.map((tab) => (
            <Tab
              value={tab.value}
              label={tab.label}
              id={tab.tabId}
              aria-controls={tab.panelId}
              key={tab.value}
            />
          ))}
        </Tabs>
      </div>
      <div
        id="kt-popup-active-panel"
        role="tabpanel"
        aria-labelledby={`kt-popup-${activeTab}-tab`}
        className="kt-popup-scroll"
      >
        {activeTab === "text" ? (
          <Trantab />
        ) : rule && setting ? (
          <PopupCont
            rule={rule}
            setting={setting}
            setRule={setRule}
            setSetting={setSetting}
            handleOpenSetting={handleOpenSetting}
          />
        ) : isLoading ? (
          <div
            className="kt-popup-loading"
            role="status"
            aria-label={i18n("popup_loading")}
          >
            <AutorenewRoundedIcon />
          </div>
        ) : (
          <div className="kt-popup-empty">
            <span>{i18n("load_setting_err")}</span>
            <div className="kt-popup-empty__actions">
              <Button variant="text" onClick={handleOpenSetting}>
                {i18n("setting")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
