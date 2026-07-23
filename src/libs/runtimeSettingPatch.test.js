jest.mock("webextension-polyfill", () => ({}));
jest.mock("@streamparser/json", () => ({ JSONParser: jest.fn() }));

import { KV_SETTING_KEY } from "../config/storage";
import { applyRuntimeSettingPatch } from "./runtimeSettingPatch";

describe("applyRuntimeSettingPatch", () => {
  test("deeply persists a patch", async () => {
    const setSetting = jest.fn();
    const markSyncMeta = jest.fn();

    await expect(
      applyRuntimeSettingPatch(
        { patch: { subtitleSetting: { enabled: false } } },
        {
          getSetting: jest.fn().mockResolvedValue({
            injectRules: true,
            subtitleSetting: { enabled: true, apiSlug: "Microsoft" },
          }),
          setSetting,
          markSyncMeta,
        }
      )
    ).resolves.toEqual({
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
    };

    const firstPatch = applyRuntimeSettingPatch(
      { patch: { injectRules: false } },
      dependencies
    );
    await firstReadStarted.promise;
    const secondPatch = applyRuntimeSettingPatch(
      { patch: { subtitleSetting: { enabled: false } } },
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
    };

    await expect(
      applyRuntimeSettingPatch({ patch: { injectRules: false } }, dependencies)
    ).rejects.toBe(persistenceError);
    await expect(
      applyRuntimeSettingPatch(
        { patch: { subtitleSetting: { enabled: false } } },
        dependencies
      )
    ).resolves.toEqual({
      setting: {
        injectRules: true,
        subtitleSetting: { enabled: false },
      },
    });
  });

  test("rejects non-object patches before reading storage", async () => {
    const getSetting = jest.fn();

    await expect(
      applyRuntimeSettingPatch({ patch: ["invalid"] }, { getSetting })
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
