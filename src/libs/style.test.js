import {
  OPT_STYLE_DASHLINE,
  OPT_STYLE_DASHLINE_BOLD,
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
    expect(firstCss).toContain("color: rebeccapurple");
  });
});
