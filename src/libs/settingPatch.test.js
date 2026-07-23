import {
  createSettingPatch,
  mergeSettingPatch,
  SETTING_PATCH_DELETE,
} from "./settingPatch";

describe("setting patches", () => {
  test("deeply patches setting branches without dropping siblings", () => {
    expect(
      mergeSettingPatch(
        {
          injectRules: true,
          subtitleSetting: { enabled: true, apiSlug: "Microsoft" },
        },
        { subtitleSetting: { enabled: false } }
      )
    ).toEqual({
      injectRules: true,
      subtitleSetting: { enabled: false, apiSlug: "Microsoft" },
    });
  });

  test("creates only changed nested branches", () => {
    expect(
      createSettingPatch(
        {
          injectRules: true,
          subtitleSetting: { enabled: true, apiSlug: "Microsoft" },
        },
        {
          injectRules: true,
          subtitleSetting: { enabled: false, apiSlug: "Microsoft" },
        }
      )
    ).toEqual({ subtitleSetting: { enabled: false } });
  });

  test("replaces arrays and primitive values instead of merging them", () => {
    const current = {
      blacklist: ["old.example"],
      darkMode: "auto",
      nested: { values: [1, 2], enabled: true },
    };
    const next = {
      blacklist: ["new.example"],
      darkMode: false,
      nested: { values: [3], enabled: true },
    };
    const patch = createSettingPatch(current, next);

    expect(patch).toEqual({
      blacklist: ["new.example"],
      darkMode: false,
      nested: { values: [3] },
    });
    expect(mergeSettingPatch(current, patch)).toEqual(next);
  });

  test("uses a serializable sentinel for deleted keys", () => {
    const current = {
      customStyles: { retained: "color: red", removed: "display: none" },
      injectRules: true,
    };
    const next = {
      customStyles: { retained: "color: red" },
      injectRules: true,
    };
    const patch = createSettingPatch(current, next);

    expect(patch).toEqual({
      customStyles: { removed: SETTING_PATCH_DELETE },
    });
    expect(JSON.parse(JSON.stringify(patch))).toEqual(patch);
    expect(mergeSettingPatch(current, patch)).toEqual(next);
  });

  test("returns no patch for structurally equal settings", () => {
    expect(
      createSettingPatch(
        { nested: { enabled: true }, values: [1, 2] },
        { nested: { enabled: true }, values: [1, 2] }
      )
    ).toBeUndefined();
  });
});
