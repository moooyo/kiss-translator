import {
  OPT_STYLE_DASHLINE,
  OPT_STYLE_DASHLINE_BOLD,
  OPT_STYLE_FUZZY,
  OPT_STYLE_GRADIENT,
  OPT_STYLE_WAVYLINE,
  OPT_STYLE_WAVYLINE_BOLD,
} from "../config";
import { builtinStylesMap, genTextClass } from "./style";

describe("built-in translation styles", () => {
  test("keeps regular and bold underline variants visually distinct", () => {
    expect(builtinStylesMap[OPT_STYLE_DASHLINE]).toContain(
      "text-decoration-thickness: 1px"
    );
    expect(builtinStylesMap[OPT_STYLE_DASHLINE_BOLD]).toContain(
      "text-decoration-thickness: 2px"
    );
    expect(builtinStylesMap[OPT_STYLE_WAVYLINE]).not.toBe(
      builtinStylesMap[OPT_STYLE_WAVYLINE_BOLD]
    );
  });

  test("generates stable isolated class names without host style insertion", () => {
    const customStyles = [
      { styleSlug: "custom-preview", styleCode: "color: rebeccapurple;" },
    ];
    const [firstMap, firstCss] = genTextClass(customStyles);
    const [secondMap] = genTextClass(customStyles);

    expect(firstMap).toEqual(secondMap);
    expect(firstMap["custom-preview"]).toMatch(/^kiss-style-custom-preview-/);
    expect(firstCss).toContain(`.${firstMap["custom-preview"]}`);
    expect(firstCss).toContain("color:rebeccapurple");
  });

  test("flattens nested selectors and embeds animation keyframes", () => {
    const [classMap, css] = genTextClass();

    expect(css).not.toContain("&:hover");
    expect(css).not.toContain("& *");
    expect(css).toContain(`.${classMap[OPT_STYLE_FUZZY]}:hover`);
    expect(css).toContain(`.${classMap[OPT_STYLE_GRADIENT]} *`);
    expect(css).toContain("@keyframes kt-gradient-flow");
    expect(css).toContain("@keyframes kt-translation-blink");
    expect(css).toContain("@keyframes kt-translation-glow");
  });
});
