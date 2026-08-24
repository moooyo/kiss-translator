import { homepageContent, languageOptions } from "./content";

const expectedLanguages = [
  "en",
  "zh_CN",
  "zh_TW",
  "ja",
  "ko",
  "fr",
  "de",
  "es",
  "vi",
  "ru",
];

const expectedOpenOptions = {
  en: "Open Script Settings",
  zh_CN: "打开脚本设置",
  zh_TW: "開啟腳本設定",
  ja: "スクリプト設定を開く",
  ko: "스크립트 설정 열기",
  fr: "Ouvrir les paramètres du script",
  de: "Skripteinstellungen öffnen",
  es: "Abrir configuración del script",
  vi: "Mở cài đặt tập lệnh",
  ru: "Открыть настройки скрипта",
};

describe("homepage content", () => {
  test("provides complete content for every homepage language", () => {
    expect(languageOptions.map(({ value }) => value)).toEqual(
      expectedLanguages
    );

    languageOptions.forEach(({ value }) => {
      const content = homepageContent[value];

      expect(content.title).toBeTruthy();
      expect(content.subtitle).toBeTruthy();
      expect(content.videoTitle).toBeTruthy();
      expect(content.videoSubtitle).toBeTruthy();
      expect(content.videoLabel).toBeTruthy();
      expect(content.watchOnYouTube).toBeTruthy();
      expect(content.features).toHaveLength(9);
      expect(content.installs).toHaveLength(6);
      expect(content.ecosystemProjects).toHaveLength(2);
      expect(content.ecosystemProjects.map(({ name }) => name)).toEqual([
        "kiss-worker",
        "kiss-rules",
      ]);
    });
  });

  // 这个 fork 不在任何商店上架。以前这里断言的是上游商店链接的语言参数；
  // 现在要钉住的是相反的事：没有任何一个安装入口会把访客送去装原版。
  test("never points an install target at an upstream listing", () => {
    expectedLanguages.forEach((language) => {
      homepageContent[language].installs.forEach(({ name, href }) => {
        expect(typeof href).toBe("string");
        expect(href).not.toMatch(/fishjar|rayjar/i);
        expect(href).not.toMatch(
          /chrome\.google\.com|microsoftedge\.microsoft\.com|addons\.mozilla\.org/i
        );
        expect(href).toMatch(/moooyo/i);
        expect(name).toBeTruthy();
      });
    });
  });

  test("keeps non-store download targets unchanged", () => {
    const englishTargets = homepageContent.en.installs
      .slice(3)
      .map(({ href }) => href);

    languageOptions.forEach(({ value }) => {
      expect(
        homepageContent[value].installs.slice(3).map(({ href }) => href)
      ).toEqual(englishTargets);
    });
  });

  test("labels the options action as script settings in every language", () => {
    Object.entries(expectedOpenOptions).forEach(([language, label]) => {
      expect(homepageContent[language].openOptions).toBe(label);
    });
  });
});
