import { compileRuntimeCss } from "./cssCompiler";

describe("compileRuntimeCss", () => {
  test("flattens nesting and emits compatibility prefixes", () => {
    const css = compileRuntimeCss(`
      .sample {
        user-select: none;
        &:hover { appearance: none; }
      }
    `);

    expect(css).toContain(".sample:hover");
    expect(css).not.toContain("&:hover");
    expect(css).toContain("-webkit-user-select:none");
    expect(css).toContain("-webkit-appearance:none");
  });
});
