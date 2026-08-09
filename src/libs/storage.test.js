import {
  STOKEY_SETTING,
  STOKEY_SETTING_BACKUP_V1_BEFORE_V2,
  SETTINGS_VERSION_V2,
  SETTINGS_VERSION_V3,
  DEFAULT_SUBTITLE_SETTING,
} from "../config";
import { getSettingWithDefault, runDataMigration } from "./storage";

// Storage tests do not use streaming parsing, so isolate the ESM-only dependency from Jest 27.
jest.mock("@streamparser/json", () => ({ JSONParser: jest.fn() }));
// jsdom is not an extension page, so prevent webextension-polyfill from throwing during initialization.
jest.mock("webextension-polyfill", () => ({}));

const readStoredJson = (key) => JSON.parse(window.localStorage.getItem(key));

function loadGmStorageModule() {
  let storageModule;
  jest.isolateModules(() => {
    jest.doMock("./client", () => ({
      isExt: false,
      isGm: true,
    }));
    storageModule = require("./storage");
  });
  jest.dontMock("./client");
  return storageModule;
}

function loadExtensionPreviewStorageModule() {
  let storageModule;
  jest.isolateModules(() => {
    jest.doMock("./client", () => ({
      isExt: true,
      isGm: false,
    }));
    jest.doMock("./browser", () => ({ browser: undefined }));
    storageModule = require("./storage");
  });
  jest.dontMock("./client");
  jest.dontMock("./browser");
  return storageModule;
}

describe("settings storage migration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.KISS_GM;
    delete globalThis.GM;
    delete globalThis.GM_setValue;
    delete globalThis.GM_getValue;
    delete globalThis.GM_deleteValue;
    delete globalThis.GM_addValueChangeListener;
    delete globalThis.GM_removeValueChangeListener;
  });

  afterEach(() => {
    delete globalThis.GM;
    delete globalThis.GM_setValue;
    delete globalThis.GM_getValue;
    delete globalThis.GM_deleteValue;
    delete globalThis.GM_addValueChangeListener;
    delete globalThis.GM_removeValueChangeListener;
  });

  test("runDataMigration backs up raw v1 settings and stores current settings", async () => {
    const oldSetting = {
      uiLang: "zh-CN",
      transApis: [
        {
          apiSlug: "openai",
          apiName: "OpenAI",
          systemPrompt: "custom batch prompt",
        },
      ],
    };
    window.localStorage.setItem(STOKEY_SETTING, JSON.stringify(oldSetting));

    await runDataMigration();

    const backup = readStoredJson(STOKEY_SETTING_BACKUP_V1_BEFORE_V2);
    const stored = readStoredJson(STOKEY_SETTING);

    expect(backup).toEqual(oldSetting);
    expect(stored.version).toBe(SETTINGS_VERSION_V3);
    expect(stored.transApis[0].batchPromptSlug).toMatch(
      /^prompt_migrated_batch_/
    );
    expect(stored.transApis[0]).not.toHaveProperty("systemPrompt");
  });

  test("getSettingWithDefault returns current settings for stored v1 data", async () => {
    const oldSetting = {
      uiLang: "zh",
      transApis: [
        {
          apiSlug: "openai",
          apiName: "OpenAI",
          systemPrompt: "custom batch prompt",
        },
      ],
    };
    window.localStorage.setItem(STOKEY_SETTING, JSON.stringify(oldSetting));

    const setting = await getSettingWithDefault();

    expect(setting.version).toBe(SETTINGS_VERSION_V3);
    expect(setting.transApis[0].batchPromptSlug).toMatch(
      /^prompt_migrated_batch_/
    );
    expect(setting.transApis[0]).not.toHaveProperty("systemPrompt");
  });

  test("extension development preview falls back to local storage", async () => {
    const { storage } = loadExtensionPreviewStorageModule();

    await storage.setObj("extension-preview", { ready: true });
    await expect(storage.getObj("extension-preview")).resolves.toEqual({
      ready: true,
    });
    await storage.del("extension-preview");

    expect(window.localStorage.getItem("extension-preview")).toBeNull();
  });

  test("notifies object subscribers after local writes", async () => {
    const { storage } = require("./storage");
    const listener = jest.fn();
    const unsubscribe = storage.subscribeObj("subscribed-key", listener);

    await storage.setObj("subscribed-key", { synced: true });
    expect(listener).toHaveBeenCalledWith({ synced: true });

    unsubscribe();
    await storage.setObj("subscribed-key", { synced: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("isolates subscriber failures from successful storage writes", async () => {
    const { storage } = require("./storage");
    const unsubscribe = storage.subscribe("throwing-subscriber", () => {
      throw new Error("listener failed");
    });

    await expect(
      storage.setObj("throwing-subscriber", { saved: true })
    ).resolves.toBeUndefined();
    await expect(storage.getObj("throwing-subscriber")).resolves.toEqual({
      saved: true,
    });

    unsubscribe();
  });

  test("keeps an explicitly stored subtitle chunk length", async () => {
    // The new default only affects new settings; preserve an explicitly stored value of 2000.
    expect(DEFAULT_SUBTITLE_SETTING.chunkLength).toBe(1000);
    window.localStorage.setItem(
      STOKEY_SETTING,
      JSON.stringify({
        version: SETTINGS_VERSION_V2,
        subtitleSetting: { chunkLength: 2000 },
      })
    );

    const setting = await getSettingWithDefault();

    expect(setting.subtitleSetting.chunkLength).toBe(2000);
  });

  test("GM storage reports a clear error when GM APIs are unavailable", async () => {
    const { storage } = loadGmStorageModule();

    await expect(storage.get("missing-gm")).rejects.toThrow(
      "GM API is not available"
    );
  });

  test("GM storage uses KISS_GM when it is available", async () => {
    const stored = new Map();
    window.KISS_GM = {
      setValue: jest.fn(async (key, value) => stored.set(key, value)),
      getValue: jest.fn(async (key) => stored.get(key)),
      deleteValue: jest.fn(async (key) => stored.delete(key)),
    };
    globalThis.GM = {
      setValue: jest.fn(),
      getValue: jest.fn(),
      deleteValue: jest.fn(),
    };
    const { storage } = loadGmStorageModule();

    await storage.setObj("gm-key", { local: true });
    await expect(storage.getObj("gm-key")).resolves.toEqual({ local: true });
    await storage.del("gm-key");

    expect(window.KISS_GM.setValue).toHaveBeenCalledWith(
      "gm-key",
      JSON.stringify({ local: true })
    );
    expect(window.KISS_GM.getValue).toHaveBeenCalledWith("gm-key");
    expect(window.KISS_GM.deleteValue).toHaveBeenCalledWith("gm-key");
    expect(globalThis.GM.setValue).not.toHaveBeenCalled();
    expect(globalThis.GM.getValue).not.toHaveBeenCalled();
    expect(globalThis.GM.deleteValue).not.toHaveBeenCalled();
    expect(stored.has("gm-key")).toBe(false);
  });

  test("GM storage uses native GM storage APIs without KISS_GM", async () => {
    const stored = new Map();
    globalThis.GM = {
      setValue: jest.fn(async (key, value) => stored.set(key, value)),
      getValue: jest.fn(async (key) => stored.get(key)),
      deleteValue: jest.fn(async (key) => stored.delete(key)),
    };
    globalThis.GM_setValue = jest.fn();
    globalThis.GM_getValue = jest.fn();
    globalThis.GM_deleteValue = jest.fn();
    const { storage } = loadGmStorageModule();

    await storage.setObj("native-gm-key", { ios: true });
    await expect(storage.getObj("native-gm-key")).resolves.toEqual({
      ios: true,
    });
    await storage.del("native-gm-key");

    expect(globalThis.GM.setValue).toHaveBeenCalledWith(
      "native-gm-key",
      JSON.stringify({ ios: true })
    );
    expect(globalThis.GM.getValue).toHaveBeenCalledWith("native-gm-key");
    expect(globalThis.GM.deleteValue).toHaveBeenCalledWith("native-gm-key");
    expect(globalThis.GM_setValue).not.toHaveBeenCalled();
    expect(globalThis.GM_getValue).not.toHaveBeenCalled();
    expect(globalThis.GM_deleteValue).not.toHaveBeenCalled();
    expect(stored.has("native-gm-key")).toBe(false);
  });

  test("GM storage falls back to legacy GM storage APIs", async () => {
    const stored = new Map();
    globalThis.GM = {};
    globalThis.GM_setValue = jest.fn(async (key, value) =>
      stored.set(key, value)
    );
    globalThis.GM_getValue = jest.fn(async (key) => stored.get(key));
    globalThis.GM_deleteValue = jest.fn(async (key) => stored.delete(key));
    const { storage } = loadGmStorageModule();

    await storage.setObj("legacy-gm-key", { ios: true });
    await expect(storage.getObj("legacy-gm-key")).resolves.toEqual({
      ios: true,
    });
    await storage.del("legacy-gm-key");

    expect(globalThis.GM_setValue).toHaveBeenCalledWith(
      "legacy-gm-key",
      JSON.stringify({ ios: true })
    );
    expect(globalThis.GM_getValue).toHaveBeenCalledWith("legacy-gm-key");
    expect(globalThis.GM_deleteValue).toHaveBeenCalledWith("legacy-gm-key");
    expect(stored.has("legacy-gm-key")).toBe(false);
  });

  test("GM storage forwards external value changes to object subscribers", async () => {
    let handleValueChange;
    const addValueChangeListener = jest.fn((key, listener) => {
      handleValueChange = listener;
      return 41;
    });
    const removeValueChangeListener = jest.fn();
    globalThis.GM = {
      addValueChangeListener,
      removeValueChangeListener,
    };
    const { storage } = loadGmStorageModule();
    const listener = jest.fn();

    const unsubscribe = storage.subscribeObj("setting", listener);
    await Promise.resolve();
    expect(addValueChangeListener).toHaveBeenCalledWith(
      "setting",
      expect.any(Function)
    );

    handleValueChange(
      "setting",
      JSON.stringify({ enabled: false }),
      JSON.stringify({ enabled: true }),
      true
    );
    expect(listener).toHaveBeenCalledWith({ enabled: true });

    listener.mockClear();
    handleValueChange(
      "setting",
      JSON.stringify({ enabled: true }),
      JSON.stringify({ enabled: false }),
      false
    );
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
    await Promise.resolve();
    expect(removeValueChangeListener).toHaveBeenCalledWith(41);
  });

  test("GM storage subscribes through legacy value change APIs", async () => {
    let handleValueChange;
    globalThis.GM = {};
    globalThis.GM_addValueChangeListener = jest.fn((key, listener) => {
      handleValueChange = listener;
      return 42;
    });
    globalThis.GM_removeValueChangeListener = jest.fn();
    const { storage } = loadGmStorageModule();
    const listener = jest.fn();

    const unsubscribe = storage.subscribeObj("setting", listener);
    await Promise.resolve();
    expect(globalThis.GM_addValueChangeListener).toHaveBeenCalledWith(
      "setting",
      expect.any(Function)
    );

    handleValueChange(
      "setting",
      JSON.stringify({ enabled: true }),
      JSON.stringify({ enabled: false }),
      true
    );
    expect(listener).toHaveBeenCalledWith({ enabled: false });

    unsubscribe();
    await Promise.resolve();
    expect(globalThis.GM_removeValueChangeListener).toHaveBeenCalledWith(42);
  });
});
