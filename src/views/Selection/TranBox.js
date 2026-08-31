import DraggableResizable from "./DraggableResizable";
import Box from "@mui/material/Box";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import IconButton from "@mui/material/IconButton";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import CloseIcon from "@mui/icons-material/Close";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useI18n } from "../../hooks/I18n";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import TranForm from "./TranForm.js";
import { MSG_OPEN_SEPARATE_WINDOW } from "../../config/msg.js";
import { sendBgMsg } from "../../libs/msg.js";
import { isExt } from "../../libs/client.js";
import { useTheme, alpha } from "@mui/material/styles";
import Logo from "../../components/Logo";
import { isValidWord } from "../../libs/utils";
import { useDarkMode } from "../../hooks/ColorMode";

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
  const [showMore, setShowMore] = useState(false);
  const menuId = useId();
  const menuButtonId = `${menuId}-button`;
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    if (showMore) {
      menuRef.current?.querySelector('[role^="menuitem"]')?.focus();
    }
  }, [showMore]);

  const handleMenuKeyDown = (event) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll('[role^="menuitem"]') || []
    ).filter((item) => !item.disabled);
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement);
    let nextIndex;

    if (event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1 + items.length) % items.length;
    } else if (event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    } else if (event.key === "Escape") {
      event.preventDefault();
      setShowMore(false);
      menuButtonRef.current?.focus();
      return;
    } else if (event.key === "Tab") {
      setShowMore(false);
      return;
    } else {
      return;
    }

    event.preventDefault();
    items[nextIndex]?.focus();
  };

  // 请求在独立的无边框小窗口中打开翻译框
  const openSeparateWindow = useCallback(() => {
    sendBgMsg(MSG_OPEN_SEPARATE_WINDOW);
    // REVIEW: 在独立小窗口中打开翻译后，并未同时调用 setShowBox(false) 来隐藏当前页面上的划词翻译框，这可能导致页面上残留已打开的翻译框，体验上可进一步优化。
  }, []);

  return (
    // onMouseUp 的 stopPropagation 必须保留：整条 header 同时是拖拽触发区，
    // 松手事件冒到外层会干扰页面自身的选区处理。
    <div className="kt-tranbox-header" onMouseUp={(e) => e.stopPropagation()}>
      <span className="kt-tranbox-header__drag" aria-hidden="true">
        <DragIndicatorRoundedIcon />
      </span>

      {/* 左侧：Logo 图标与版本号显示 */}
      <span className="kt-tranbox-header__brand">
        <span className="kt-tranbox-header__logo">
          <Logo size={16} />
        </span>
        <span className="kt-tranbox-header__title">
          {`${process.env.REACT_APP_NAME} v${process.env.REACT_APP_VERSION}`}
        </span>
      </span>

      {/* 右侧：常驻操作按钮组 */}
      <span className="kt-tranbox-header__actions">
        {/* 锁定划词框 (点击外部不消失) */}
        <IconButton
          title={i18n("btn_tip_click_away")}
          aria-pressed={hideClickAway}
          onClick={() => setHideClickAway((pre) => !pre)}
        >
          {hideClickAway ? <LockOpenIcon /> : <LockIcon />}
        </IconButton>

        {/* 其余低频开关收进溢出菜单 */}
        <IconButton
          id={menuButtonId}
          ref={menuButtonRef}
          title={i18n("more")}
          aria-expanded={showMore}
          aria-haspopup="menu"
          aria-controls={showMore ? menuId : undefined}
          onClick={() => setShowMore((pre) => !pre)}
        >
          <MoreVertIcon />
        </IconButton>

        {/* 关闭翻译框 */}
        <IconButton title={i18n("close")} onClick={() => setShowBox(false)}>
          <CloseIcon />
        </IconButton>
      </span>

      {showMore && (
        <ClickAwayListener onClickAway={() => setShowMore(false)}>
          <div
            ref={menuRef}
            id={menuId}
            className="kt-tranbox-header__menu"
            role="menu"
            aria-labelledby={menuButtonId}
            onKeyDown={handleMenuKeyDown}
          >
            {/* 独立窗口打开 */}
            {isExt && (
              <button
                type="button"
                role="menuitem"
                onClick={openSeparateWindow}
              >
                <OpenInNewIcon />
                {i18n("open_separate_window")}
              </button>
            )}

            {/* 极简折叠样式切换 */}
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={simpleStyle}
              onClick={() => setSimpleStyle((pre) => !pre)}
            >
              {simpleStyle ? <UnfoldMoreIcon /> : <UnfoldLessIcon />}
              {i18n("btn_tip_simple_style")}
            </button>

            {/* 固定位置/跟随划词选区位置切换 */}
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={followSelection}
              onClick={() => setFollowSelection((pre) => !pre)}
            >
              {followSelection ? <PushPinOutlinedIcon /> : <PushPinIcon />}
              {i18n("btn_tip_follow_selection")}
            </button>

            {/* 深色/浅色/自动主题模式切换 */}
            <button type="button" role="menuitem" onClick={toggleDarkMode}>
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
        </ClickAwayListener>
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
  translateVariants,
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
          borderRadius: "999px",
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
        translateVariants={translateVariants}
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

  return props.showBox ? (
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
        translateVariants={props.translateVariants}
        enDict={props.tranboxSetting.enDict}
        enSug={props.tranboxSetting.enSug}
        aiDictApiSlug={props.tranboxSetting.aiDictApiSlug}
        aiDictPromptSlug={props.tranboxSetting.aiDictPromptSlug}
        selectionContext={props.selectionContext}
      />
    </DraggableResizable>
  ) : null;
}
