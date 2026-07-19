import { useCallback } from "react";
import {
  MSG_MOUSEHOVER_TOGGLE,
  MSG_RUNTIME_SETTING_PATCH,
  MSG_TRANSBOX_TOGGLE,
  MSG_TRANSINPUT_TOGGLE,
} from "../../config";
import { isExt } from "../../libs/client";
import { kissLog } from "../../libs/log";
import { sendBgMsg, sendTabMsg } from "../../libs/msg";

export function usePopupFeatureToggles({
  processActions,
  setSetting,
  updateSetting,
}) {
  const dispatchPageAction = useCallback(
    async (action, logLabel) => {
      try {
        if (processActions) processActions({ action });
        else await sendTabMsg(action);
      } catch (error) {
        kissLog(logLabel, error);
      }
    },
    [processActions]
  );

  const handleTransboxToggle = useCallback(
    async (enabled) => {
      setSetting((previous) => ({
        ...previous,
        tranboxSetting: {
          ...previous.tranboxSetting,
          transOpen: enabled,
        },
      }));
      await dispatchPageAction(
        MSG_TRANSBOX_TOGGLE,
        "toggle selection translation"
      );
    },
    [dispatchPageAction, setSetting]
  );

  const handleMouseHoverToggle = useCallback(
    async (enabled) => {
      setSetting((previous) => ({
        ...previous,
        mouseHoverSetting: {
          ...previous.mouseHoverSetting,
          useMouseHover: enabled,
        },
      }));
      await dispatchPageAction(
        MSG_MOUSEHOVER_TOGGLE,
        "toggle hover translation"
      );
    },
    [dispatchPageAction, setSetting]
  );

  const handleInputToggle = useCallback(
    async (enabled) => {
      setSetting((previous) => ({
        ...previous,
        inputRule: { ...previous.inputRule, transOpen: enabled },
      }));
      await dispatchPageAction(
        MSG_TRANSINPUT_TOGGLE,
        "toggle input translation"
      );
    },
    [dispatchPageAction, setSetting]
  );

  const handleSubtitleToggle = useCallback(
    (enabled) => {
      setSetting((previous) => ({
        ...previous,
        subtitleSetting: { ...previous.subtitleSetting, enabled },
      }));
      if (isExt) {
        void sendBgMsg(MSG_RUNTIME_SETTING_PATCH, {
          scope: "current",
          patch: { subtitleSetting: { enabled } },
        }).catch((error) => kissLog("apply runtime subtitle setting", error));
        return;
      }
      updateSetting((previous) => ({
        ...previous,
        subtitleSetting: { ...previous.subtitleSetting, enabled },
      }));
    },
    [setSetting, updateSetting]
  );

  return {
    handleInputToggle,
    handleMouseHoverToggle,
    handleSubtitleToggle,
    handleTransboxToggle,
  };
}
