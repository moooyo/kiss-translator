import { buildTranslationOnlyVtt } from "./vtt";

describe("buildTranslationOnlyVtt", () => {
  test("uses translations and falls back to original text", () => {
    expect(
      buildTranslationOnlyVtt([
        {
          start: 0,
          end: 1500,
          text: "Hello",
          translation: "你好",
        },
        {
          start: 2000,
          end: 3000,
          text: "Fallback\nline",
          translation: "",
        },
      ])
    ).toBe(
      [
        "WEBVTT",
        "1\n00:00:00.000 --> 00:00:01.500\n你好",
        "2\n00:00:02.000 --> 00:00:03.000\nFallback\nline",
      ].join("\n\n")
    );
  });

  test("returns only the VTT header for invalid or empty input", () => {
    expect(buildTranslationOnlyVtt(null)).toBe("WEBVTT");
    expect(buildTranslationOnlyVtt([])).toBe("WEBVTT");
  });
});
