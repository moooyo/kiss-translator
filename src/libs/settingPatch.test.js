import { mergeSettingPatch } from "./settingPatch";

describe("mergeSettingPatch", () => {
  test("deeply patches setting branches without dropping siblings", () => {
    expect(
      mergeSettingPatch(
        {
          extensionEnabled: true,
          subtitleSetting: { enabled: true, apiSlug: "Microsoft" },
        },
        { subtitleSetting: { enabled: false } }
      )
    ).toEqual({
      extensionEnabled: true,
      subtitleSetting: { enabled: false, apiSlug: "Microsoft" },
    });
  });
});
