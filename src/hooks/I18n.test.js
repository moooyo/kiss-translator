import { getI18n } from "./I18n";

jest.mock("./Setting", () => ({
  useSetting: () => ({ setting: { uiLang: "en" } }),
}));

jest.mock("./Fetch", () => ({
  useGet: jest.fn(),
}));

describe("getI18n", () => {
  test("uses the requested locale when available", () => {
    expect(getI18n("zh", "settings_brand_color")).toBe("主题色");
  });

  test("falls back to English for a missing locale", () => {
    expect(getI18n("ja", "settings_brand_color")).toBe("Brand color");
  });

  test("uses the caller fallback for an unknown key", () => {
    expect(getI18n("en", "missing_key", "Fallback")).toBe("Fallback");
  });
});
