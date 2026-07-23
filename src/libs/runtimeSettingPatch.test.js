jest.mock("webextension-polyfill", () => ({}));
jest.mock("@streamparser/json", () => ({ JSONParser: jest.fn() }));

import { KV_SETTING_KEY } from "../config";
import { applyRuntimeSettingPatch } from "./runtimeSettingPatch";

describe("applyRuntimeSettingPatch", () => {
  test("deeply persists a patch without broadcasting when scope is none", async () => {
    const setSetting = jest.fn();
    const markSyncMeta = jest.fn();
    const queryTabs = jest.fn();

    await expect(
      applyRuntimeSettingPatch(
        { patch: { subtitleSetting: { enabled: false } }, scope: "none" },
        undefined,
        {
          getSetting: jest.fn().mockResolvedValue({
            injectRules: true,
            subtitleSetting: { enabled: true, apiSlug: "Microsoft" },
          }),
          setSetting,
          markSyncMeta,
          queryTabs,
        }
      )
    ).resolves.toEqual({
      delivered: 0,
      attempted: 0,
      setting: {
        injectRules: true,
        subtitleSetting: { enabled: false, apiSlug: "Microsoft" },
      },
    });

    expect(setSetting).toHaveBeenCalledWith({
      injectRules: true,
      subtitleSetting: { enabled: false, apiSlug: "Microsoft" },
    });
    expect(markSyncMeta).toHaveBeenCalledWith(KV_SETTING_KEY);
    expect(queryTabs).not.toHaveBeenCalled();
  });

  test("serializes concurrent patches so neither update is lost", async () => {
    let storedSetting = {
      injectRules: true,
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

    const firstPatch = applyRuntimeSettingPatch(
      { patch: { injectRules: false }, scope: "none" },
      undefined,
      dependencies
    );
    await firstReadStarted.promise;
    const secondPatch = applyRuntimeSettingPatch(
      { patch: { subtitleSetting: { enabled: false } }, scope: "none" },
      undefined,
      dependencies
    );

    await Promise.resolve();
    expect(getSetting).toHaveBeenCalledTimes(1);
    releaseFirstRead.resolve();
    await Promise.all([firstPatch, secondPatch]);

    expect(storedSetting).toEqual({
      injectRules: false,
      subtitleSetting: { enabled: false, apiSlug: "Microsoft" },
    });
  });

  test("continues after an earlier persistence failure", async () => {
    let storedSetting = { injectRules: true };
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
        { patch: { injectRules: false }, scope: "none" },
        undefined,
        dependencies
      )
    ).rejects.toBe(persistenceError);
    await expect(
      applyRuntimeSettingPatch(
        { patch: { subtitleSetting: { enabled: false } }, scope: "none" },
        undefined,
        dependencies
      )
    ).resolves.toEqual(
      expect.objectContaining({
        setting: {
          injectRules: true,
          subtitleSetting: { enabled: false },
        },
      })
    );
  });

  test("rejects non-object patches before reading storage", async () => {
    const getSetting = jest.fn();

    await expect(
      applyRuntimeSettingPatch({ patch: ["invalid"] }, undefined, {
        getSetting,
      })
    ).rejects.toThrow("Runtime setting patch must be an object");
    expect(getSetting).not.toHaveBeenCalled();
  });
});

function createDeferred() {
  let resolve;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}
