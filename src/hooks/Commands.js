import { useEffect, useMemo, useState } from "react";
import { MSG_COMMAND_SHORTCUTS } from "../config";
import { isExt } from "../libs/client";
import { sendBgMsg } from "../libs/msg";
import { normalizeShortcutKeys } from "../libs/shortcutLabel";

export function buildOverviewShortcutMap(setting, browserCommands = []) {
  const commandMap = Object.fromEntries(
    browserCommands.map(({ name, shortcut }) => [name, shortcut])
  );
  const configured = setting?.shortcuts || {};

  return {
    page: normalizeShortcutKeys(
      commandMap.toggleTranslate || configured.toggleTranslate
    ),
    popup: normalizeShortcutKeys(
      commandMap._execute_action || configured.togglePopup
    ),
    style: normalizeShortcutKeys(
      commandMap.toggleStyle || configured.toggleStyle
    ),
    selection: normalizeShortcutKeys(
      commandMap.openTranbox || setting?.tranboxSetting?.tranboxShortcut
    ),
    input: normalizeShortcutKeys(setting?.inputRule?.triggerShortcut),
    settings: normalizeShortcutKeys(
      commandMap.openOptions || configured.openSetting
    ),
  };
}

export function useOverviewShortcuts(setting) {
  const [browserCommands, setBrowserCommands] = useState([]);

  useEffect(() => {
    if (!isExt) return undefined;
    let active = true;
    Promise.resolve(sendBgMsg(MSG_COMMAND_SHORTCUTS))
      .then((commands) => {
        if (active) setBrowserCommands(commands || []);
      })
      .catch(() => {
        if (active) setBrowserCommands([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return useMemo(
    () => buildOverviewShortcutMap(setting, browserCommands),
    [browserCommands, setting]
  );
}
