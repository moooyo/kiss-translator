import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import SelectAllRoundedIcon from "@mui/icons-material/SelectAllRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import TranslateIcon from "@mui/icons-material/Translate";
import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Fab from "@mui/material/Fab";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import SpeedDialIcon from "@mui/material/SpeedDialIcon";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import ThemeProvider from "../../hooks/M3Theme";
import Draggable from "./Draggable";
import { SettingProvider } from "../../hooks/Setting";
import {
  MSG_OPEN_OPTIONS,
  MSG_OPEN_TRANBOX,
  MSG_POPUP_TOGGLE,
  MSG_TRANS_TOGGLE,
  MSG_TRANS_TOGGLE_STYLE,
} from "../../config";
import { useI18n } from "../../hooks/I18n";
import { isExt } from "../../libs/client";
import { sendBgMsg } from "../../libs/msg";
import useWindowSize from "../../hooks/WindowSize";
import { useFullscreenDetect } from "../../hooks/useFullscreenDetect";
import { ACTION_STYLES } from "./styles";

// 菜单贴边时的翻转与避让策略。悬浮球可以被拖到视口任意一角，
// 所以候选位置必须覆盖四个方向，否则贴到顶部或右侧时菜单会被裁掉。
export const FAB_POPPER_MODIFIERS = [
  {
    name: "flip",
    enabled: true,
    options: {
      fallbackPlacements: [
        "top-start",
        "bottom-end",
        "bottom-start",
        "right",
        "left",
      ],
    },
  },
  {
    name: "preventOverflow",
    enabled: true,
    options: { padding: 12 },
  },
  { name: "offset", options: { offset: [0, 10] } },
];

/**
 * 内容页悬浮翻译球 (Floating Action Button) 组件
 * 支持拖拽、贴边吸附隐藏，以及点击展开 Material 3 动作菜单
 */
export function ContentFabContent({
  fabConfig: { x: fabX, y: fabY, edge: fabEdge, fabClickAction = 0 } = {},
  processActions,
}) {
  const i18n = useI18n();
  const fabWidth = 56; // Material 3 regular FAB size.
  const opensMenu = fabClickAction !== 1;
  const windowSize = useWindowSize();
  const [moved, setMoved] = useState(false); // 标记是否发生了拖动
  const [showFab, setShowFab] = useState(true);
  const [open, setOpen] = useState(false); // 动作菜单展开状态
  const anchorRef = useRef(null);
  const { isVideoFullscreen } = useFullscreenDetect();

  useEffect(() => {
    setShowFab(!isVideoFullscreen);
    // 进入视频全屏时悬浮球会被隐藏，菜单必须一并收起，
    // 否则它会成为一个没有锚点、点不到也关不掉的悬空面板。
    if (isVideoFullscreen) {
      setOpen(false);
    }
  }, [isVideoFullscreen]);

  // 拖拽开始时的回调
  const handleStart = useCallback(() => {
    setMoved(false);
  }, []);

  // 拖拽移动中的回调
  const handleMove = useCallback(() => {
    setMoved(true);
  }, []);

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) anchorRef.current?.focus();
  }, []);

  // 执行一个动作并收起菜单
  const runAction = useCallback(
    (action) => {
      processActions({ action });
      closeMenu(true);
    },
    [closeMenu, processActions]
  );

  // 在浏览器新标签页中打开扩展 Options 设置页
  const openSettings = useCallback(() => {
    if (isExt) {
      sendBgMsg(MSG_OPEN_OPTIONS);
    } else {
      window.open(
        process.env.REACT_APP_OPTIONSPAGE,
        "_blank",
        "noopener,noreferrer"
      );
    }
    closeMenu(true);
  }, [closeMenu]);

  // 处理点击事件。如果拖拽移动过，则忽略该次点击，防止误触
  const handleClick = useCallback(() => {
    if (moved) {
      return;
    }
    // fabClickAction === 1 keeps the legacy direct translation action.
    if (!opensMenu) {
      runAction(MSG_TRANS_TOGGLE);
      return;
    }
    setOpen((current) => !current);
  }, [moved, opensMenu, runAction]);

  // Esc 关闭菜单并把焦点还给悬浮球，避免焦点掉进已卸载的菜单项里
  const handleMenuKeyDown = useCallback(
    (event) => {
      if (event.key !== "Escape" && event.key !== "Tab") return;
      event.preventDefault();
      closeMenu(true);
    },
    [closeMenu]
  );

  // 计算悬浮球的位置参数，如果是初次加载则放置在视口垂直居中、贴在边缘的位置
  const fabProps = useMemo(
    () => ({
      windowSize,
      width: fabWidth,
      height: fabWidth,
      left: fabX ?? -fabWidth,
      top: fabY ?? windowSize.h / 2,
      edge: fabEdge,
    }),
    [windowSize, fabWidth, fabX, fabY, fabEdge]
  );

  const items = [
    {
      label: i18n("popup_translate_page"),
      icon: TranslateRoundedIcon,
      action: () => runAction(MSG_TRANS_TOGGLE),
    },
    {
      label: i18n("text_style_alt"),
      icon: PaletteRoundedIcon,
      action: () => runAction(MSG_TRANS_TOGGLE_STYLE),
    },
    {
      label: i18n("selection_translate"),
      icon: SelectAllRoundedIcon,
      action: () => runAction(MSG_OPEN_TRANBOX),
    },
    {
      label: i18n("open_menu"),
      icon: TuneRoundedIcon,
      action: () => runAction(MSG_POPUP_TOGGLE),
    },
    {
      label: i18n("open_setting"),
      icon: SettingsRoundedIcon,
      action: openSettings,
    },
  ];

  return (
    <Draggable
      key="fab"
      snapEdge // Keep the idle FAB partially hidden at the viewport edge.
      fitContent // The fixed menu must not be constrained by the 56px FAB wrapper.
      expanded={opensMenu && open} // Keep the anchor fully revealed while the menu is open.
      {...fabProps}
      show={showFab}
      onStart={handleStart}
      onMove={handleMove}
      handler={
        <Fab
          id="kt-content-fab-button"
          ref={anchorRef}
          className="kt-content-fab"
          aria-expanded={opensMenu ? open : undefined}
          aria-haspopup={opensMenu ? "menu" : undefined}
          aria-controls={opensMenu && open ? "kt-content-fab-menu" : undefined}
          aria-label={i18n("translate")}
          onClick={handleClick}
        >
          {opensMenu ? (
            <SpeedDialIcon
              icon={<TranslateIcon />}
              openIcon={<CloseRoundedIcon />}
              open={open}
            />
          ) : (
            <TranslateIcon />
          )}
        </Fab>
      }
    >
      <Popper
        open={opensMenu && open && Boolean(anchorRef.current)}
        anchorEl={anchorRef.current}
        placement="top-end"
        // 内容页是 shadow DOM，portal 到 document.body 会逃出 shadow root，
        // 连带丢掉 M3Theme 注入的全部样式，所以这里必须就地渲染。
        disablePortal
        popperOptions={{ strategy: "fixed" }}
        modifiers={FAB_POPPER_MODIFIERS}
      >
        <ClickAwayListener
          onClickAway={(event) => {
            // 点在悬浮球自己身上时交给 handleClick 处理，
            // 否则这里会先关一次、handleClick 再开一次，表现为点了没反应。
            if (anchorRef.current?.contains(event.target)) {
              return;
            }
            setOpen(false);
          }}
        >
          <Paper className="kt-content-fab-menu" elevation={6}>
            <MenuList
              id="kt-content-fab-menu"
              aria-labelledby="kt-content-fab-button"
              autoFocusItem
              onKeyDown={handleMenuKeyDown}
            >
              {items.map(({ label, icon: Icon, action }) => (
                <MenuItem
                  className="kt-content-fab-menu__item"
                  onClick={action}
                  key={label}
                >
                  <ListItemIcon>
                    <Icon />
                  </ListItemIcon>
                  <ListItemText>{label}</ListItemText>
                </MenuItem>
              ))}
            </MenuList>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </Draggable>
  );
}

export default function ContentFab(props) {
  return (
    <SettingProvider context="fab">
      <ThemeProvider>
        <style>{ACTION_STYLES}</style>
        <ContentFabContent {...props} />
      </ThemeProvider>
    </SettingProvider>
  );
}
