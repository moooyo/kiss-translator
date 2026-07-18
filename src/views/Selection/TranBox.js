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
import { useI18n } from "../../hooks/I18n";
import { useCallback, useState } from "react";
import TranForm from "./TranForm.js";
import { MSG_OPEN_SEPARATE_WINDOW } from "../../config/msg.js";
import { sendBgMsg } from "../../libs/msg.js";
import { isExt } from "../../libs/client.js";
import { useTheme, alpha } from "@mui/material/styles";
import { isValidWord } from "../../libs/utils";
import { useDarkMode } from "../../hooks/ColorMode";
import { M3IconButton } from "../../components/M3";
import { SELECTION_STYLES } from "./styles";

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
}) {
  const i18n = useI18n();
  const { darkMode, toggleDarkMode } = useDarkMode();

  // 请求在独立的无边框小窗口中打开翻译框
  const openSeparateWindow = useCallback(() => {
    sendBgMsg(MSG_OPEN_SEPARATE_WINDOW);
    // REVIEW: 在独立小窗口中打开翻译后，并未同时调用 setShowBox(false) 来隐藏当前页面上的划词翻译框，这可能导致页面上残留已打开的翻译框，体验上可进一步优化。
  }, []);

  return (
    <div
      className="kt-tranbox-header"
      onMouseUp={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <span className="kt-tranbox-header__drag" aria-hidden="true">
        <DragIndicatorRoundedIcon />
      </span>
      <span className="kt-tranbox-header__title">{i18n("app_name")}</span>
      <span className="kt-tranbox-header__actions">
        {isExt && (
          <M3IconButton
            title={i18n("open_separate_window")}
            onClick={openSeparateWindow}
          >
            <OpenInNewIcon />
          </M3IconButton>
        )}
        <M3IconButton
          title={i18n("btn_tip_simple_style")}
          aria-pressed={simpleStyle}
          onClick={() => setSimpleStyle((previous) => !previous)}
        >
          {simpleStyle ? <UnfoldMoreIcon /> : <UnfoldLessIcon />}
        </M3IconButton>
        <M3IconButton
          title={i18n("btn_tip_click_away")}
          aria-pressed={hideClickAway}
          onClick={() => setHideClickAway((previous) => !previous)}
        >
          {hideClickAway ? <PushPinIcon /> : <PushPinOutlinedIcon />}
        </M3IconButton>
        <M3IconButton
          title={i18n("btn_tip_follow_selection")}
          aria-pressed={!followSelection}
          onClick={() => setFollowSelection((previous) => !previous)}
        >
          {followSelection ? <PushPinOutlinedIcon /> : <PushPinIcon />}
        </M3IconButton>
        <M3IconButton
          title={i18n("btn_tip_dark_mode")}
          onClick={toggleDarkMode}
        >
          {darkMode === "dark" ? (
            <DarkModeIcon />
          ) : darkMode === "auto" ? (
            <BrightnessAutoIcon />
          ) : (
            <LightModeIcon />
          )}
        </M3IconButton>
        <M3IconButton title={i18n("close")} onClick={() => setShowBox(false)}>
          <CloseIcon />
        </M3IconButton>
      </span>
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
      />
    </Box>
  );
}

/**
 * 划词翻译框的主容器入口组件 (控制拖拽外壳及规则分发)
 */
export default function TranBox(props) {
  const [mouseHover, setMouseHover] = useState(false);

  const simpleStyle = props.simpleStyle;
  const setSimpleStyle = props.setSimpleStyle;
  const hideClickAway = props.hideClickAway;
  const setHideClickAway = props.setHideClickAway;
  const followSelection = props.followSelection;
  const setFollowSelection = props.setFollowSelection;

  let realApiSlugs = props.tranboxSetting.apiSlugs;
  // 检查是否开启了“如果是单字，则不进行全文大模型/机器翻译，仅展示词典与建议”的性能优化设置
  if (props.tranboxSetting.singleWordNoTrans && isValidWord(props.text)) {
    // 强制清空要调用的翻译引擎 API slugs
    realApiSlugs = [];
  }

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
                mouseHover={mouseHover}
              />
            }
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => setMouseHover(true)}
            onMouseLeave={() => setMouseHover(false)}
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
            />
          </DraggableResizable>
        )}
      </ThemeProvider>
    </SettingProvider>
  );
}
