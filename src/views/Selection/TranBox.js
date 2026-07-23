import { SettingProvider } from "../../hooks/Setting";
import ThemeProvider from "../../hooks/Theme";
import DraggableResizable from "./DraggableResizable";
import Box from "@mui/material/Box";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import CloseIcon from "@mui/icons-material/Close";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import IconButton from "@mui/material/IconButton";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { useI18n } from "../../hooks/I18n";
import { useCallback, useEffect, useState } from "react";
import TranForm from "./TranForm.js";
import { MSG_OPEN_SEPARATE_WINDOW } from "../../config/msg.js";
import { sendBgMsg } from "../../libs/msg.js";
import { isExt } from "../../libs/client.js";
import { useTheme, alpha } from "@mui/material/styles";
import { isValidWord } from "../../libs/utils";
import { useDarkMode } from "../../hooks/ColorMode";
import { SELECTION_STYLES } from "./styles";
import { resolveDictionaryCapabilities } from "./dictionaryCapabilities";

/**
 * 划词翻译框的顶部导航栏组件
 *
 * @param {Object} props
 * @param {Function} props.setShowBox - 控制划词翻译框显隐的 React setter
 * @param {boolean} props.simpleStyle - 极简模式开关状态
 * @param {Function} props.setSimpleStyle - 控制极简模式开关的 React setter
 * @param {boolean} props.hideClickAway - 点击外部是否自动隐藏划词框的锁定开关状态
 * @param {Function} props.setHideClickAway - 锁定开关的 React setter
 * @param {boolean} props.followSelection - 划词框是否紧跟选区的定位锁定状态
 * @param {Function} props.setFollowSelection - 定位锁定状态的 React setter
 */
function TranBoxHeader({
  setShowBox,
  simpleStyle,
  setSimpleStyle,
  hideClickAway,
  setHideClickAway,
  followSelection,
  setFollowSelection,
  activeView,
  setActiveView,
  dictionaryAvailable,
}) {
  const i18n = useI18n();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [showMore, setShowMore] = useState(false);

  // 请求在独立的无边框小窗口中打开翻译框
  const openSeparateWindow = useCallback(() => {
    sendBgMsg(MSG_OPEN_SEPARATE_WINDOW);
    setShowBox(false);
  }, [setShowBox]);

  return (
    <div className="kt-tranbox-header" onMouseUp={(e) => e.stopPropagation()}>
      <span className="kt-tranbox-header__drag" aria-hidden="true">
        <DragIndicatorRoundedIcon />
      </span>
      <Tabs
        className="kt-tranbox-header__segments"
        aria-label={i18n("translate")}
        value={activeView}
        onChange={(_event, value) => setActiveView(value)}
        variant="fullWidth"
      >
        <Tab
          value="translation"
          label={i18n("translate")}
          id="kt-tranbox-translation-tab"
          aria-controls="kt-tranbox-active-panel"
        />
        {dictionaryAvailable && (
          <Tab
            value="dictionary"
            label={i18n("dictionary")}
            id="kt-tranbox-dictionary-tab"
            aria-controls="kt-tranbox-active-panel"
          />
        )}
      </Tabs>
      <span className="kt-tranbox-header__actions">
        <IconButton
          title={i18n("btn_tip_click_away")}
          aria-pressed={hideClickAway}
          onClick={() => setHideClickAway((previous) => !previous)}
        >
          {hideClickAway ? <PushPinIcon /> : <PushPinOutlinedIcon />}
        </IconButton>
        <IconButton
          title={i18n("more")}
          aria-expanded={showMore}
          onClick={() => setShowMore((previous) => !previous)}
        >
          <MoreVertIcon />
        </IconButton>
        <IconButton title={i18n("close")} onClick={() => setShowBox(false)}>
          <CloseIcon />
        </IconButton>
      </span>
      {showMore && (
        <div className="kt-tranbox-header__menu">
          {isExt && (
            <button type="button" onClick={openSeparateWindow}>
              <OpenInNewIcon />
              {i18n("open_separate_window")}
            </button>
          )}
          <button
            type="button"
            aria-pressed={simpleStyle}
            onClick={() => setSimpleStyle((previous) => !previous)}
          >
            {simpleStyle ? <UnfoldMoreIcon /> : <UnfoldLessIcon />}
            {i18n("btn_tip_simple_style")}
          </button>
          <button
            type="button"
            aria-pressed={followSelection}
            onClick={() => setFollowSelection((previous) => !previous)}
          >
            {followSelection ? <PushPinOutlinedIcon /> : <PushPinIcon />}
            {i18n("btn_tip_follow_selection")}
          </button>
          <button type="button" onClick={toggleDarkMode}>
            {darkMode === "dark" ? (
              <DarkModeIcon />
            ) : darkMode === "auto" ? (
              <BrightnessAutoIcon />
            ) : (
              <LightModeIcon />
            )}
            {i18n("btn_tip_dark_mode")}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 划词翻译框的内部表单内容渲染容器组件
 */
function TranBoxContent({
  simpleStyle,
  text,
  setText,
  apiSlugs,
  fromLang,
  toLang,
  toLang2,
  transApis,
  langDetector,
  enDict,
  enSug,
  aiDictApiSlug,
  aiDictPromptSlug,
  prompts,
  selectionContext,
  activeView,
  dictionaryCapabilities,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const scrollbarTrackColor =
    theme.palette.mode === "dark" ? "#1f1f23" : theme.palette.background.paper;
  const scrollbarThumbColor =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.text.primary, 0.28)
      : alpha(theme.palette.text.primary, 0.24);

  return (
    <Box
      id="kt-tranbox-active-panel"
      role="tabpanel"
      aria-labelledby={`kt-tranbox-${activeView}-tab`}
      className="kt-tranbox-content"
      sx={{
        p: simpleStyle ? 1 : 2,
        backgroundColor: theme.palette.background.paper,

        "&::-webkit-scrollbar": {
          width: 10,
          height: 10,
        },
        "&::-webkit-scrollbar-track": {
          background: scrollbarTrackColor,
        },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: scrollbarThumbColor,
          borderRadius: 8,
          border: `2px solid ${theme.palette.background.paper}`,
        },
        "&::-webkit-scrollbar-thumb:hover": {
          backgroundColor: alpha(theme.palette.text.primary, 0.36),
        },
        // Firefox
        scrollbarWidth: "thin",
        scrollbarColor: `${scrollbarThumbColor} ${scrollbarTrackColor}`,

        color: isDark
          ? "rgba(255,255,255,0.82)" // 柔白字体, 避免极暗背景下过于刺眼
          : theme.palette.text.primary,

        lineHeight: 1.55,
      }}
    >
      {/* 嵌入实际的翻译表单 */}
      <TranForm
        text={text}
        setText={setText}
        apiSlugs={apiSlugs}
        fromLang={fromLang}
        toLang={toLang}
        toLang2={toLang2}
        transApis={transApis}
        prompts={prompts}
        simpleStyle={simpleStyle}
        langDetector={langDetector}
        enDict={enDict}
        enSug={enSug}
        aiDictApiSlug={aiDictApiSlug}
        aiDictPromptSlug={aiDictPromptSlug}
        selectionContext={selectionContext}
        viewMode={activeView}
        dictionaryCapabilities={dictionaryCapabilities}
      />
    </Box>
  );
}

/**
 * 划词翻译框的主容器入口组件 (控制拖拽外壳及规则分发)
 */
export default function TranBox(props) {
  const dictionaryCapabilities = resolveDictionaryCapabilities({
    text: props.text,
    enDict: props.tranboxSetting.enDict,
    enSug: props.tranboxSetting.enSug,
    aiDictApiSlug: props.tranboxSetting.aiDictApiSlug,
    aiDictPromptSlug: props.tranboxSetting.aiDictPromptSlug,
    prompts: props.prompts,
    transApis: props.transApis,
  });
  const defaultView = getDefaultTranBoxView(
    props.text,
    props.tranboxSetting.singleWordNoTrans,
    dictionaryCapabilities.dictionaryAvailable
  );
  const viewContext = [
    props.text,
    Boolean(props.tranboxSetting.singleWordNoTrans),
    dictionaryCapabilities.defaultDictionaryAvailable,
    dictionaryCapabilities.aiDictionaryAvailable,
    dictionaryCapabilities.suggestionAvailable,
  ].join("\u0000");
  const [viewSelection, setViewSelection] = useState(() => ({
    context: viewContext,
    view: defaultView,
  }));
  const activeView = resolveTranBoxView({
    requestedView:
      viewSelection.context === viewContext ? viewSelection.view : defaultView,
    dictionaryAvailable: dictionaryCapabilities.dictionaryAvailable,
  });

  const setActiveView = useCallback(
    (view) => {
      setViewSelection({
        context: viewContext,
        view: resolveTranBoxView({
          requestedView: view,
          dictionaryAvailable: dictionaryCapabilities.dictionaryAvailable,
        }),
      });
    },
    [viewContext, dictionaryCapabilities.dictionaryAvailable]
  );

  useEffect(() => {
    setViewSelection((current) => {
      if (current.context === viewContext && current.view === activeView) {
        return current;
      }
      return { context: viewContext, view: activeView };
    });
  }, [activeView, viewContext]);

  const simpleStyle = props.simpleStyle;
  const setSimpleStyle = props.setSimpleStyle;
  const hideClickAway = props.hideClickAway;
  const setHideClickAway = props.setHideClickAway;
  const followSelection = props.followSelection;
  const setFollowSelection = props.setFollowSelection;

  const realApiSlugs = resolveTranBoxApiSlugs({
    apiSlugs: props.tranboxSetting.apiSlugs,
    text: props.text,
    singleWordNoTrans: props.tranboxSetting.singleWordNoTrans,
    activeView,
  });

  return (
    // 为子组件提供独立翻译框专属的 Setting 上下文
    <SettingProvider context="tranbox">
      {/* 提供独立翻译框专属的自定义样式 CSS 作用的主题 */}
      <ThemeProvider styles={props.extStyles}>
        <style>{SELECTION_STYLES}</style>
        {props.showBox && (
          // 渲染可拖动可缩放的外壳
          <DraggableResizable
            position={props.boxPosition}
            size={props.boxSize}
            setSize={props.setBoxSize}
            setPosition={props.setBoxPosition}
            autoHeight={props.tranboxSetting.autoHeight}
            header={
              <TranBoxHeader
                setShowBox={props.setShowBox}
                simpleStyle={simpleStyle}
                setSimpleStyle={setSimpleStyle}
                hideClickAway={hideClickAway}
                setHideClickAway={setHideClickAway}
                followSelection={followSelection}
                setFollowSelection={setFollowSelection}
                activeView={activeView}
                setActiveView={setActiveView}
                dictionaryAvailable={dictionaryCapabilities.dictionaryAvailable}
              />
            }
            onClick={(e) => e.stopPropagation()}
          >
            <TranBoxContent
              simpleStyle={simpleStyle}
              text={props.text}
              setText={props.setText}
              apiSlugs={realApiSlugs}
              fromLang={props.tranboxSetting.fromLang}
              toLang={props.tranboxSetting.toLang}
              toLang2={props.tranboxSetting.toLang2}
              transApis={props.transApis}
              prompts={props.prompts}
              langDetector={props.langDetector}
              enDict={props.tranboxSetting.enDict}
              enSug={props.tranboxSetting.enSug}
              aiDictApiSlug={props.tranboxSetting.aiDictApiSlug}
              aiDictPromptSlug={props.tranboxSetting.aiDictPromptSlug}
              selectionContext={props.selectionContext}
              activeView={activeView}
              dictionaryCapabilities={dictionaryCapabilities}
            />
          </DraggableResizable>
        )}
      </ThemeProvider>
    </SettingProvider>
  );
}

export function getDefaultTranBoxView(
  text,
  singleWordNoTrans,
  dictionaryAvailable = true
) {
  return singleWordNoTrans && isValidWord(text) && dictionaryAvailable
    ? "dictionary"
    : "translation";
}

export function resolveTranBoxView({ requestedView, dictionaryAvailable }) {
  return requestedView === "dictionary" && dictionaryAvailable
    ? "dictionary"
    : "translation";
}

export function resolveTranBoxApiSlugs({
  apiSlugs = [],
  text,
  singleWordNoTrans,
  activeView,
}) {
  const shouldSuppressAutomaticTranslation =
    activeView === "dictionary" && singleWordNoTrans && isValidWord(text);
  return shouldSuppressAutomaticTranslation ? [] : apiSlugs;
}
