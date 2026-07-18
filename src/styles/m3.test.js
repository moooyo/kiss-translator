import { M3_BRAND_COLORS, M3_GLOBAL_CSS } from "./m3";

describe("M3 brand colors", () => {
  test("matches the handoff tokens for alternate brands", () => {
    expect(M3_BRAND_COLORS.cyan.light).toEqual(
      expect.objectContaining({
        primary: "#006874",
        primaryContainer: "#97F0FF",
      })
    );
    expect(M3_BRAND_COLORS.violet.dark).toEqual(
      expect.objectContaining({
        primary: "#D0BCFF",
        primaryContainer: "#4F378B",
      })
    );
  });
});

describe("M3 switch alignment", () => {
  test("vertically centers switch thumbs in both states", () => {
    expect(M3_GLOBAL_CSS).toMatch(
      /\.kt-m3-switch__thumb\s*\{[^}]*top:\s*50%;[^}]*transform:\s*translateY\(-50%\);/
    );
    expect(M3_GLOBAL_CSS).toMatch(
      /input:checked \+ \.kt-m3-switch__track \.kt-m3-switch__thumb\s*\{[^}]*top:\s*50%;/
    );
  });
});

describe("M3 selected labels", () => {
  test("keeps segmented labels inside their selected container", () => {
    expect(M3_GLOBAL_CSS).toMatch(
      /\.kt-m3-segmented__label\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/
    );
  });
});
