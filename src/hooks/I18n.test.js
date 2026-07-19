import { getI18n } from "./I18n";
import { I18N, UI_LANGS } from "../config";

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

  test("uses an explicit fallback before English", () => {
    expect(getI18n("fr", "settings_brand_color", "Couleur")).toBe("Couleur");
    expect(getI18n("fr", "settings_brand_color")).toBe("Brand color");
  });

  test("uses the caller fallback for an unknown key", () => {
    expect(getI18n("en", "missing_key", "Fallback")).toBe("Fallback");
  });

  test("covers every supported locale for redesigned settings labels", () => {
    const locales = UI_LANGS.map(([locale]) => locale);
    const missing = Object.entries(I18N)
      .filter(([key]) => key.startsWith("settings_"))
      .flatMap(([key, translations]) =>
        locales
          .filter((locale) => !translations[locale])
          .map((locale) => `${key}:${locale}`)
      );
    expect(missing).toEqual([]);
  });
});
