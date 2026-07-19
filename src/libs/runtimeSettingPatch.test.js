import { MSG_RUNTIME_SETTING_PATCH } from "../config";
import { applyRuntimeSettingPatch } from "./runtimeSettingPatch";

describe("applyRuntimeSettingPatch", () => {
  test("deeply persists a patch and broadcasts it to every valid tab", async () => {
    const setSetting = jest.fn();
    const sendTabMessage = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("restricted tab"));
    const patch = { subtitleSetting: { enabled: false } };

    await expect(
      applyRuntimeSettingPatch({ patch, scope: "all" }, undefined, {
        getSetting: jest.fn().mockResolvedValue({
          extensionEnabled: true,
          subtitleSetting: { enabled: true, apiSlug: "Microsoft" },
        }),
        setSetting,
        queryTabs: jest
          .fn()
          .mockResolvedValue([{ id: 1 }, { id: 2 }, { id: undefined }]),
        sendTabMessage,
      })
    ).resolves.toEqual({ delivered: 1, attempted: 2 });

    expect(setSetting).toHaveBeenCalledWith({
      extensionEnabled: true,
      subtitleSetting: { enabled: false, apiSlug: "Microsoft" },
    });
    expect(sendTabMessage).toHaveBeenCalledWith(1, {
      action: MSG_RUNTIME_SETTING_PATCH,
      args: { patch },
    });
  });

  test("targets the active tab when an extension page sends a current patch", async () => {
    const sendTabMessage = jest.fn().mockResolvedValue(undefined);
    const getActiveTabId = jest.fn().mockResolvedValue(42);
    const setSetting = jest.fn();
    const onPersisted = jest.fn();

    await applyRuntimeSettingPatch(
      { patch: { subtitleSetting: { enabled: false } }, scope: "current" },
      {},
      {
        getSetting: jest.fn().mockResolvedValue({
          subtitleSetting: { enabled: true, apiSlug: "Microsoft" },
        }),
        setSetting,
        getActiveTabId,
        sendTabMessage,
        onPersisted,
      }
    );

    expect(setSetting).toHaveBeenCalledWith({
      subtitleSetting: { enabled: false, apiSlug: "Microsoft" },
    });
    expect(onPersisted).toHaveBeenCalledWith(
      { subtitleSetting: { enabled: false, apiSlug: "Microsoft" } },
      { subtitleSetting: { enabled: false } }
    );
    expect(getActiveTabId).toHaveBeenCalledTimes(1);
    expect(sendTabMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ action: MSG_RUNTIME_SETTING_PATCH })
    );
  });
});
