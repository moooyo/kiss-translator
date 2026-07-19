import { KV_SETTING_KEY, MSG_RUNTIME_SETTING_PATCH } from "../config";
import { applyRuntimeSettingPatch } from "./runtimeSettingPatch";

describe("applyRuntimeSettingPatch", () => {
  test("deeply persists a patch and broadcasts it to every valid tab", async () => {
    const setSetting = jest.fn();
    const sendTabMessage = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("restricted tab"));
    const patch = { subtitleSetting: { enabled: false } };
    const markSyncMeta = jest.fn();

    await expect(
      applyRuntimeSettingPatch({ patch, scope: "all" }, undefined, {
        getSetting: jest.fn().mockResolvedValue({
          extensionEnabled: true,
          subtitleSetting: { enabled: true, apiSlug: "Microsoft" },
        }),
        setSetting,
        markSyncMeta,
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
    expect(markSyncMeta).toHaveBeenCalledWith(KV_SETTING_KEY);
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
    const markSyncMeta = jest.fn();

    await applyRuntimeSettingPatch(
      { patch: { subtitleSetting: { enabled: false } }, scope: "current" },
      {},
      {
        getSetting: jest.fn().mockResolvedValue({
          subtitleSetting: { enabled: true, apiSlug: "Microsoft" },
        }),
        setSetting,
        markSyncMeta,
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
    expect(markSyncMeta).toHaveBeenCalledWith(KV_SETTING_KEY);
    expect(getActiveTabId).toHaveBeenCalledTimes(1);
    expect(sendTabMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ action: MSG_RUNTIME_SETTING_PATCH })
    );
  });

  test("serializes concurrent patches so neither persisted update is lost", async () => {
    let storedSetting = {
      extensionEnabled: true,
      subtitleSetting: { enabled: true, apiSlug: "Microsoft" },
    };
    const firstReadStarted = createDeferred();
    const releaseFirstRead = createDeferred();
    const getSetting = jest.fn(async () => {
      if (getSetting.mock.calls.length === 1) {
        firstReadStarted.resolve();
        await releaseFirstRead.promise;
      }
      return JSON.parse(JSON.stringify(storedSetting));
    });
    const setSetting = jest.fn(async (setting) => {
      storedSetting = JSON.parse(JSON.stringify(setting));
    });
    const dependencies = {
      getSetting,
      setSetting,
      markSyncMeta: jest.fn(),
      queryTabs: jest.fn().mockResolvedValue([]),
    };

    const masterPatch = applyRuntimeSettingPatch(
      { patch: { extensionEnabled: false } },
      undefined,
      dependencies
    );
    await firstReadStarted.promise;
    const subtitlePatch = applyRuntimeSettingPatch(
      { patch: { subtitleSetting: { enabled: false } } },
      undefined,
      dependencies
    );

    await Promise.resolve();
    expect(getSetting).toHaveBeenCalledTimes(1);
    releaseFirstRead.resolve();
    await Promise.all([masterPatch, subtitlePatch]);

    expect(storedSetting).toEqual({
      extensionEnabled: false,
      subtitleSetting: { enabled: false, apiSlug: "Microsoft" },
    });
    expect(dependencies.markSyncMeta).toHaveBeenNthCalledWith(
      1,
      KV_SETTING_KEY
    );
    expect(dependencies.markSyncMeta).toHaveBeenNthCalledWith(
      2,
      KV_SETTING_KEY
    );
  });

  test("delivers concurrent same-field patches in persistence order", async () => {
    let storedSetting = { extensionEnabled: true };
    const firstDeliveryStarted = createDeferred();
    const releaseFirstDelivery = createDeferred();
    const deliveredValues = [];
    const sendTabMessage = jest.fn(async (_tabId, message) => {
      if (sendTabMessage.mock.calls.length === 1) {
        firstDeliveryStarted.resolve();
        await releaseFirstDelivery.promise;
      }
      deliveredValues.push(message.args.patch.extensionEnabled);
    });
    const dependencies = {
      getSetting: jest.fn(async () => storedSetting),
      setSetting: jest.fn(async (setting) => {
        storedSetting = setting;
      }),
      markSyncMeta: jest.fn(),
      queryTabs: jest.fn().mockResolvedValue([{ id: 7 }]),
      sendTabMessage,
    };

    const firstPatch = applyRuntimeSettingPatch(
      { patch: { extensionEnabled: false } },
      undefined,
      dependencies
    );
    await firstDeliveryStarted.promise;
    const secondPatch = applyRuntimeSettingPatch(
      { patch: { extensionEnabled: true } },
      undefined,
      dependencies
    );

    await Promise.resolve();
    expect(sendTabMessage).toHaveBeenCalledTimes(1);
    releaseFirstDelivery.resolve();
    await Promise.all([firstPatch, secondPatch]);

    expect(deliveredValues).toEqual([false, true]);
    expect(storedSetting.extensionEnabled).toBe(true);
  });

  test("continues processing patches after an earlier persistence failure", async () => {
    let storedSetting = { extensionEnabled: true };
    const persistenceError = new Error("storage unavailable");
    const setSetting = jest
      .fn()
      .mockRejectedValueOnce(persistenceError)
      .mockImplementation(async (setting) => {
        storedSetting = setting;
      });
    const dependencies = {
      getSetting: jest.fn(async () => storedSetting),
      setSetting,
      markSyncMeta: jest.fn(),
      queryTabs: jest.fn().mockResolvedValue([]),
    };

    await expect(
      applyRuntimeSettingPatch(
        { patch: { extensionEnabled: false } },
        undefined,
        dependencies
      )
    ).rejects.toBe(persistenceError);
    await expect(
      applyRuntimeSettingPatch(
        { patch: { subtitleSetting: { enabled: false } } },
        undefined,
        dependencies
      )
    ).resolves.toEqual({ delivered: 0, attempted: 0 });

    expect(storedSetting).toEqual({
      extensionEnabled: true,
      subtitleSetting: { enabled: false },
    });
    expect(dependencies.markSyncMeta).toHaveBeenCalledTimes(1);
  });
});

function createDeferred() {
  let resolve;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}
