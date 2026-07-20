import { mergeSettingPatch } from "./settingPatch";

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
});
