import {
  createSettingPatch,
  mergeSettingPatch,
  SETTING_PATCH_DELETE,
} from "./settingPatch";

describe("mergeSettingPatch", () => {
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

  test("creates only the changed nested branches", () => {
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

  test("uses an explicit serializable sentinel for deleted keys", () => {
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

  test("applies nested operations after a concurrent branch type change", () => {
    expect(
      mergeSettingPatch(
        { customStyles: "invalidated externally" },
        {
          customStyles: {
            removed: SETTING_PATCH_DELETE,
            retained: "color: red",
          },
        }
      )
    ).toEqual({ customStyles: { retained: "color: red" } });
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
