import { ACTION_STYLES } from "./styles";

describe("content FAB Material 3 shape", () => {
  test("uses regular FAB geometry without morphing between states", () => {
    const baseRule = ACTION_STYLES.match(
      /\.kt-content-fab\.MuiFab-root\s*\{([^}]*)\}/
    )?.[1];
    const hoverRule = ACTION_STYLES.match(
      /\.kt-content-fab\.MuiFab-root:hover\s*\{([^}]*)\}/
    )?.[1];
    const activeStateRule = ACTION_STYLES.match(
      /\.kt-content-fab\.MuiFab-root\.Mui-focusVisible,[\s\S]*?\.kt-content-fab\.MuiFab-root:active\s*\{([^}]*)\}/
    )?.[1];

    expect(baseRule).toContain("width: 56px");
    expect(baseRule).toContain("height: 56px");
    expect(baseRule).toContain("min-width: 56px");
    expect(baseRule).toContain("min-height: 56px");
    expect(baseRule).toContain("border-radius: 16px");
    expect(baseRule).toContain("background-color: var(--kt-pric)");
    expect(baseRule).not.toMatch(/transition:[^;]*border-radius/);
    expect(hoverRule).toContain("var(--kt-onpric) 8%");
    expect(hoverRule).not.toContain("border-radius");
    expect(activeStateRule).not.toContain("border-radius");
    expect(ACTION_STYLES).not.toContain("border-radius: 999px");
  });

  test("overrides MUI state colors while keeping compact menu shapes", () => {
    expect(ACTION_STYLES).toMatch(
      /\.kt-content-fab\.MuiFab-root\.Mui-focusVisible,[\s\S]*?\.kt-content-fab\.MuiFab-root:active\s*\{[^}]*var\(--kt-onpric\) 10%/
    );
    expect(ACTION_STYLES).toMatch(
      /\.kt-content-fab-menu\s*\{[^}]*border-radius:\s*12px;/
    );
    expect(ACTION_STYLES).toMatch(
      /\.kt-content-fab-menu__item\s*\{[^}]*border-radius:\s*8px;/
    );
    expect(ACTION_STYLES).toMatch(
      /\.kt-content-fab-menu__item\s*\{[^}]*transition:[^;}]*transform[^}]*animation:[^;}]*backwards;/
    );
  });
});
