import {
  objectToCss,
  parseCssToObject,
  patchCssProperty,
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

  test("patches only the last matching declaration without rewriting source", () => {
    const source = [
      "/* keep: this comment; exactly */",
      "color: red;",
      "color : blue /* keep the priority note */ !important;",
      "@future syntax(foo: bar) { nested: value; };",
      '--raw-token: {"key":"value;still"};',
    ].join("\n");

    expect(patchCssProperty(source, "color", "#123456")).toBe(
      [
        "/* keep: this comment; exactly */",
        "color: red;",
        "color : #123456 /* keep the priority note */ !important;",
        "@future syntax(foo: bar) { nested: value; };",
        '--raw-token: {"key":"value;still"};',
      ].join("\n")
    );
  });

  test("appends a missing property without normalizing unknown syntax", () => {
    const source = "color: red;\nunknown ???;\n/* untouched */";

    expect(patchCssProperty(source, "font-size", "18px")).toBe(
      `${source}\nfont-size: 18px;`
    );
  });

  test("removes matching declarations while preserving surrounding source", () => {
    const source = [
      "/* first */ text-shadow: 1px 1px black;",
      "color: red;",
      "/* second */ text-shadow: 2px 2px black;",
      "unknown ???;",
    ].join("\n");

    expect(patchCssProperty(source, "text-shadow", "")).toBe(
      ["/* first */ ", "color: red;", "/* second */ ", "unknown ???;"].join(
        "\n"
      )
    );
  });

  test("preserves declaration comments when removing a property", () => {
    const source = [
      'content: "/* not a comment */";',
      "text-shadow: 1px 1px black /* keep this reason */;",
      "color: red;",
    ].join("\n");

    expect(patchCssProperty(source, "text-shadow", "")).toBe(
      [
        'content: "/* not a comment */";',
        "/* keep this reason */",
        "color: red;",
      ].join("\n")
    );
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
