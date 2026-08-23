import {
  STOKEY_SETTING,
  STOKEY_SETTING_BACKUP_V1_BEFORE_V2,
  SETTINGS_VERSION_V2,
  SETTINGS_VERSION_V3,
  DEFAULT_SUBTITLE_SETTING,
  OPT_TRANS_DEEPSEEK,
  OPT_TRANS_OPENAI,
  OPT_TRANS_TENCENT,
} from "../config";
import { getSettingWithDefault, runDataMigration, storage } from "./storage";
import { encodePath, findRegressedPaths } from "./fieldRevisions";

// 存储测试不涉及流式解析，隔离 ESM-only 依赖以免 Jest 27 在加载阶段失败。
jest.mock("@streamparser/json", () => ({ JSONParser: jest.fn() }));
// jsdom 并非扩展页面，使用空实现避免 webextension-polyfill 在模块初始化时主动抛错。
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

// patchObj 的意义全在「串行」二字：读-改-写不是原子的，两次并发调用
// 会各自读到补丁应用前的值，后写的那次连同别人改过的字段一起抹掉。
describe("patchObj serialization", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("keeps both fields when two patches race", async () => {
    await storage.setObj("race-key", { alpha: 1, beta: 1 });

    await Promise.all([
      storage.patchObj("race-key", { alpha: 2 }),
      storage.patchObj("race-key", { beta: 2 }),
    ]);

    expect(readStoredJson("race-key")).toEqual({ alpha: 2, beta: 2 });
  });

  // 跨 realm：另一个上下文的写入落在我们的读和写之间。patchQueues 是模块级的，
  // 只能串行化本 realm 内的调用，拦不住这一种 —— 存储层没法阻止覆盖发生，
  // 它只负责留下可靠的痕迹：覆盖方拿的是过期的戳表，写回去会把被覆盖字段的戳
  // 一起抹掉。真正的重放在 hooks/Storage.js，见那边的
  // "repairs fields another realm clobbered"。
  test("a stale foreign write leaves the clobbered field's revision behind", async () => {
    const beta = encodePath(["beta"]);
    await storage.setObj("race-key", { alpha: 1, beta: 1 });

    const proto = Object.getPrototypeOf(window.localStorage);
    const realGetItem = proto.getItem;
    const realSetItem = proto.setItem;
    const foreignRevisions = { [beta]: [1, "realm-other"] };
    let injected = false;

    const spy = jest.spyOn(proto, "getItem").mockImplementation(function (k) {
      const value = realGetItem.call(this, k);
      // patchObj 先读值、再读戳。在读戳这一刻注入，模拟「我们两样都读完了，
      // 对方才落盘」—— 我们手上的戳表因此不含对方刚推高的那一条。
      if (k === "race-key__kissFieldRevisions" && !injected) {
        injected = true;
        realSetItem.call(
          this,
          "race-key",
          JSON.stringify({ alpha: 1, beta: 99 })
        );
        realSetItem.call(
          this,
          "race-key__kissFieldRevisions",
          JSON.stringify(foreignRevisions)
        );
      }
      return value;
    });

    await storage.patchObj("race-key", { alpha: 2 });
    spy.mockRestore();

    // 覆盖确实发生了：beta 被写回了旧值
    expect(readStoredJson("race-key")).toEqual({ alpha: 2, beta: 1 });

    // 而痕迹留下了：我们手上的戳表不含 beta，写回去就把对方的戳抹掉了。
    // 对方比对「存储里的戳 vs 我写进去的戳」就能发现自己被覆盖。
    const after = await storage.getFieldRevisions("race-key");
    expect(after[beta]).toBeUndefined();
    expect(findRegressedPaths(after, foreignRevisions)).toEqual([beta]);
  });

  test("a failed patch does not wedge later patches on the same key", async () => {
    await storage.setObj("race-key", { alpha: 1 });

    const failing = storage.patchObj("race-key", null).catch(() => "failed");
    const following = storage.patchObj("race-key", { alpha: 2 });

    await failing;
    await following;

    expect(readStoredJson("race-key")).toEqual({ alpha: 2 });
  });
});

describe("settings storage migration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.KISS_GM;
    delete globalThis.GM;
    delete globalThis.GM_setValue;
    delete globalThis.GM_getValue;
    delete globalThis.GM_deleteValue;
  });

  afterEach(() => {
    delete globalThis.GM;
    delete globalThis.GM_setValue;
    delete globalThis.GM_getValue;
    delete globalThis.GM_deleteValue;
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

  test("merges the language variant default without overriding an explicit choice", async () => {
    window.localStorage.setItem(
      STOKEY_SETTING,
      JSON.stringify({ version: SETTINGS_VERSION_V3, uiLang: "zh" })
    );
    await expect(getSettingWithDefault()).resolves.toMatchObject({
      translateVariants: true,
    });

    window.localStorage.setItem(
      STOKEY_SETTING,
      JSON.stringify({
        version: SETTINGS_VERSION_V3,
        translateVariants: false,
      })
    );
    await expect(getSettingWithDefault()).resolves.toMatchObject({
      translateVariants: false,
    });
  });

  test("keeps clipboard auto-translation opt-in for existing settings", async () => {
    window.localStorage.setItem(
      STOKEY_SETTING,
      JSON.stringify({ version: SETTINGS_VERSION_V3, uiLang: "zh" })
    );
    await expect(getSettingWithDefault()).resolves.toMatchObject({
      autoTranslateClipboard: false,
    });

    window.localStorage.setItem(
      STOKEY_SETTING,
      JSON.stringify({
        version: SETTINGS_VERSION_V3,
        autoTranslateClipboard: true,
      })
    );
    await expect(getSettingWithDefault()).resolves.toMatchObject({
      autoTranslateClipboard: true,
    });
  });

  test("does not replace explicitly stored Tencent entry points", async () => {
    window.localStorage.setItem(
      STOKEY_SETTING,
      JSON.stringify({
        version: SETTINGS_VERSION_V3,
        inputRule: { apiSlug: OPT_TRANS_TENCENT },
        tranboxSetting: { apiSlugs: [OPT_TRANS_TENCENT] },
        subtitleSetting: { apiSlug: OPT_TRANS_TENCENT },
      })
    );

    await expect(getSettingWithDefault()).resolves.toMatchObject({
      inputRule: { apiSlug: OPT_TRANS_TENCENT },
      tranboxSetting: { apiSlugs: [OPT_TRANS_TENCENT] },
      subtitleSetting: { apiSlug: OPT_TRANS_TENCENT },
    });
  });

  test("keeps an explicitly stored subtitle chunk length", async () => {
    // 新默认值只影响新配置；已有用户明确保存的 2000 不应被默认设置覆盖。
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

  test("normalizes legacy default thinking effort only in the loaded setting", async () => {
    const storedSetting = {
      version: SETTINGS_VERSION_V3,
      transApis: [
        {
          apiSlug: "openai",
          apiType: OPT_TRANS_OPENAI,
          model: "gpt-5.6-sol",
          thinkingMode: "enabled",
          thinkingEffort: "_default",
        },
      ],
    };
    window.localStorage.setItem(STOKEY_SETTING, JSON.stringify(storedSetting));

    const setting = await getSettingWithDefault();

    expect(setting.transApis[0].thinkingEffort).toBeNull();
    expect(readStoredJson(STOKEY_SETTING)).toEqual(storedSetting);
  });

  test("normalizes thinking settings for a fresh installation", async () => {
    const setting = await getSettingWithDefault();
    const deepseek = setting.transApis.find(
      (api) => api.apiType === OPT_TRANS_DEEPSEEK
    );

    expect(deepseek).toMatchObject({
      thinkingMode: "disabled",
      thinkingEffort: null,
    });
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
});
