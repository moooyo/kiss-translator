import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import GTranslateRoundedIcon from "@mui/icons-material/GTranslateRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import SelectAllRoundedIcon from "@mui/icons-material/SelectAllRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import { useCallback, useMemo, useState } from "react";
import ThemeProvider from "../../hooks/Theme";
import { SettingProvider } from "../../hooks/Setting";
import { useI18n } from "../../hooks/I18n";
import {
  MSG_OPEN_OPTIONS,
  MSG_OPEN_TRANBOX,
  MSG_TRANS_TOGGLE,
  MSG_TRANS_TOGGLE_STYLE,
} from "../../config";
import { isExt } from "../../libs/client";
import { sendBgMsg } from "../../libs/msg";
import useWindowSize from "../../hooks/WindowSize";
import Draggable from "./Draggable";
import { ACTION_STYLES } from "./styles";

function ContentFabContent({
  fabConfig: { x: fabX, y: fabY, fabClickAction = 0 } = {},
  processActions,
}) {
  const i18n = useI18n();
  const fabSize = 58;
  const windowSize = useWindowSize();
  const [moved, setMoved] = useState(false);
  const [open, setOpen] = useState(false);

  const runAction = useCallback(
    (action) => {
      processActions({ action });
      setOpen(false);
    },
    [processActions]
  );

  const openSettings = useCallback(() => {
    if (isExt) sendBgMsg(MSG_OPEN_OPTIONS);
    else window.open(process.env.REACT_APP_OPTIONSPAGE, "_blank");
    setOpen(false);
  }, []);

  const handleMainClick = useCallback(() => {
    if (moved) return;
    if (fabClickAction === 1 && !open) {
      runAction(MSG_TRANS_TOGGLE);
      return;
    }
    setOpen((current) => !current);
  }, [fabClickAction, moved, open, runAction]);

  const fabProps = useMemo(
    () => ({
      windowSize,
      width: fabSize,
      height: fabSize,
      left: fabX ?? Math.max(12, windowSize.w - fabSize - 26),
      top: fabY ?? Math.max(12, windowSize.h - fabSize - 26),
    }),
    [fabX, fabY, windowSize]
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
      label: i18n("open_setting"),
      icon: SettingsRoundedIcon,
      action: openSettings,
    },
  ];

  return (
    <Draggable
      key="fab"
      {...fabProps}
      persistPosition
      onStart={() => setMoved(false)}
      onMove={() => setMoved(true)}
      handler={
        <button
          type="button"
          className="kt-content-fab"
          aria-expanded={open}
          aria-label={i18n("translate")}
          onClick={handleMainClick}
        >
          {open ? <CloseRoundedIcon /> : <GTranslateRoundedIcon />}
        </button>
      }
    >
      {open && (
        <div className="kt-content-fab-menu">
          {items.map(({ label, icon: Icon, action }, index) => (
            <button
              type="button"
              className="kt-content-fab-menu__item"
              style={{ animationDelay: `${index * 0.045}s` }}
              onClick={action}
              key={label}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>
      )}
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
