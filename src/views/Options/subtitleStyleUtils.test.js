import {
  objectToCss,
  parseCssToObject,
  resolveBackgroundRgba,
} from "./subtitleStyleUtils";

describe("subtitleStyleUtils", () => {
  test("preserves semicolons and colons inside CSS function values", () => {
    const css =
      'background-image: url("data:image/svg+xml;utf8,<svg></svg>"); color: red;';

    expect(parseCssToObject(css)).toEqual({
      "background-image": 'url("data:image/svg+xml;utf8,<svg></svg>")',
      color: "red",
    });
  });

  test("serializes editable declarations without dropping values", () => {
    expect(
      objectToCss({
        "background-color": "rgba(10, 12, 16, 0.62)",
        "background-image": "linear-gradient(#000, transparent)",
      })
    ).toContain("background-image: linear-gradient(#000, transparent)");
  });

  test("reads both the canonical color and legacy background shorthand", () => {
    expect(
      resolveBackgroundRgba({
        "background-color": "rgba(10, 12, 16, 0.62)",
      })
    ).toEqual({ r: 10, g: 12, b: 16, a: 0.62 });
    expect(resolveBackgroundRgba({ background: "rgba(1, 2, 3, 0.4)" })).toEqual(
      { r: 1, g: 2, b: 3, a: 0.4 }
    );
  });
});
