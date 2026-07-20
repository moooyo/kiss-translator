import { act } from "react";
import { createRoot } from "react-dom/client";
import { getI18n, useI18n } from "./I18n";
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

  test("registers the unsaved API warning", () => {
    expect(I18N.discard_api_changes_confirm).toBeDefined();
    expect(getI18n("en", "discard_api_changes_confirm")).toBe(
      "This API has unsaved changes. Discard them?"
    );
  });

  test("covers every supported locale for every registered label", () => {
    const locales = UI_LANGS.map(([locale]) => locale);
    const missing = Object.entries(I18N).flatMap(([key, translations]) =>
      locales
        .filter((locale) => !translations[locale])
        .map((locale) => `${key}:${locale}`)
    );
    expect(missing).toEqual([]);
  });

  test("keeps the translation function stable while the locale is unchanged", () => {
    const functions = [];
    const container = document.createElement("div");
    const root = createRoot(container);
    function Harness({ renderId }) {
      functions.push(useI18n());
      return <span>{renderId}</span>;
    }

    act(() => root.render(<Harness renderId={1} />));
    act(() => root.render(<Harness renderId={2} />));

    expect(functions[1]).toBe(functions[0]);
    act(() => root.unmount());
  });
});
