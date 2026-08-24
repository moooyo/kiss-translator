import { toEmotionCacheKey } from "./shadowDomManager";

// Emotion 只接受 [a-z-]，传别的会抛，而 ShadowDomManager 只把异常记成一条 warn ——
// 表现是组件静默挂不上，不是报错。应用名从 KISS-Translator 改成 KISS-Translator-M3
// 时就踩到了这个（"m3" 里的 3）。
describe("toEmotionCacheKey", () => {
  test("strips digits from an app name that carries a version suffix", () => {
    expect(toEmotionCacheKey("kiss-translator-m3-popup")).toBe(
      "kiss-translator-m-popup"
    );
  });

  test("accepts an already valid key unchanged", () => {
    expect(toEmotionCacheKey("kiss-translator-popup")).toBe(
      "kiss-translator-popup"
    );
  });

  test("lowercases and collapses runs of invalid characters", () => {
    expect(toEmotionCacheKey("KISS_Translator 2.0__Box")).toBe(
      "kiss-translator-box"
    );
  });

  test("never returns a key Emotion would reject", () => {
    for (const input of ["", null, undefined, "123", "---", "!!"]) {
      const key = toEmotionCacheKey(input);
      expect(key).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });
});
