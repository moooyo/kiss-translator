import { persistSubtitlePosition } from "./subtitle.js";
import { debounceSyncMeta, storage } from "../libs/storage.js";
import { encodePath } from "../libs/fieldRevisions.js";
import { logger } from "../libs/log.js";
import { KV_SETTING_KEY, STOKEY_SETTING } from "../config/storage.js";
import { DEFAULT_SUBTITLE_SETTING } from "../config/setting.js";

jest.mock("../libs/storage.js", () => ({
  ...jest.requireActual("../libs/storage.js"),
  debounceSyncMeta: jest.fn(),
}));

jest.mock("../libs/client.js", () => ({ isExt: false, isGm: false }));
jest.mock("webextension-polyfill", () => ({}));
jest.mock("@streamparser/json", () => ({ JSONParser: jest.fn() }));

jest.mock("../libs/log.js", () => ({
  LogLevel: {
    INFO: { value: "info" },
  },
  kissLog: jest.fn(),
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../injectors/index.js", () => ({
  injectJs: jest.fn(),
  INJECTOR: { subtitle: "subtitle" },
}));

jest.mock("./YouTubeCaptionProvider.js", () => ({
  YouTubeInitializer: jest.fn(),
}));

const readSetting = () => storage.getObj(STOKEY_SETTING);

describe("persistSubtitlePosition", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("merges the ratio without replacing unrelated settings", async () => {
    await storage.setObj(STOKEY_SETTING, {
      darkMode: "dark",
      subtitleSetting: {
        apiSlug: "microsoft",
        rememberPosition: true,
      },
    });

    await persistSubtitlePosition(0.3);

    expect(await readSetting()).toEqual({
      darkMode: "dark",
      subtitleSetting: {
        apiSlug: "microsoft",
        rememberPosition: true,
        positionRatio: 0.3,
      },
    });
    expect(debounceSyncMeta).toHaveBeenCalledWith(KV_SETTING_KEY);
    const revisions = await storage.getFieldRevisions(STOKEY_SETTING);
    expect(Object.keys(revisions)).toEqual([
      encodePath(["subtitleSetting", "positionRatio"]),
    ]);
  });

  test("keeps a concurrent settings edit and the dragged position", async () => {
    await storage.setObj(STOKEY_SETTING, {
      darkMode: "light",
      subtitleSetting: {
        apiSlug: "microsoft",
        rememberPosition: true,
        positionRatio: 0.05,
      },
    });

    // Both writers start before either finishes reading its stored snapshot.
    await Promise.all([
      persistSubtitlePosition(0.3),
      storage.patchObj(STOKEY_SETTING, {
        darkMode: "dark",
        subtitleSetting: { apiSlug: "deepl" },
      }),
    ]);

    expect(await readSetting()).toEqual({
      darkMode: "dark",
      subtitleSetting: {
        apiSlug: "deepl",
        rememberPosition: true,
        positionRatio: 0.3,
      },
    });
    const revisions = await storage.getFieldRevisions(STOKEY_SETTING);
    expect(revisions).toEqual({
      [encodePath(["darkMode"])]: [1, expect.any(String)],
      [encodePath(["subtitleSetting", "apiSlug"])]: [1, expect.any(String)],
      [encodePath(["subtitleSetting", "positionRatio"])]: [
        1,
        expect.any(String),
      ],
    });
  });

  test("does not break rendering or later saves when storage fails", async () => {
    const prototype = Object.getPrototypeOf(window.localStorage);
    const originalSetItem = prototype.setItem;
    let failNextSettingWrite = true;
    jest.spyOn(prototype, "setItem").mockImplementation(function (key, value) {
      if (key === STOKEY_SETTING && failNextSettingWrite) {
        failNextSettingWrite = false;
        throw new Error("storage unavailable");
      }
      return originalSetItem.call(this, key, value);
    });

    await expect(persistSubtitlePosition(0.3)).resolves.toBeUndefined();
    expect(await readSetting()).toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(debounceSyncMeta).not.toHaveBeenCalled();

    await persistSubtitlePosition(0.4);

    expect((await readSetting()).subtitleSetting.positionRatio).toBe(0.4);
    expect(debounceSyncMeta).toHaveBeenCalledTimes(1);
  });

  test("keeps complete subtitle defaults when storage is initially empty", async () => {
    await persistSubtitlePosition(0.3);

    expect(await readSetting()).toEqual({
      subtitleSetting: { ...DEFAULT_SUBTITLE_SETTING, positionRatio: 0.3 },
    });
    const revisions = await storage.getFieldRevisions(STOKEY_SETTING);
    expect(revisions[encodePath(["subtitleSetting", "enabled"])]).toEqual([
      1,
      expect.any(String),
    ]);
  });

  test("checks whether defaults are needed after earlier queued edits finish", async () => {
    const settingEdit = storage.patchObj(STOKEY_SETTING, {
      subtitleSetting: { enabled: false, apiSlug: "deepl" },
    });
    const positionWrite = persistSubtitlePosition(0.3);
    await Promise.all([settingEdit, positionWrite]);

    expect(await readSetting()).toEqual({
      subtitleSetting: {
        enabled: false,
        apiSlug: "deepl",
        positionRatio: 0.3,
      },
    });
  });

  test("keeps the latest ratio when several drags are saved together", async () => {
    await storage.setObj(STOKEY_SETTING, {
      darkMode: "dark",
      subtitleSetting: { rememberPosition: true, positionRatio: 0.05 },
    });

    await Promise.all([
      persistSubtitlePosition(0.3),
      persistSubtitlePosition(0.4),
    ]);

    expect(await readSetting()).toEqual({
      darkMode: "dark",
      subtitleSetting: { rememberPosition: true, positionRatio: 0.4 },
    });
    expect(debounceSyncMeta).toHaveBeenCalledTimes(2);
    const revisions = await storage.getFieldRevisions(STOKEY_SETTING);
    expect(revisions[encodePath(["subtitleSetting", "positionRatio"])][0]).toBe(
      2
    );
  });
});
