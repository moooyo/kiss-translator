import { SELECTION_STYLES } from "./styles";

describe("selection Material 3 shapes", () => {
  test("uses restrained surface and menu radii", () => {
    expect(SELECTION_STYLES).toMatch(
      /\.KT-draggable-body\s*\{[^}]*border-radius:\s*16px !important;/
    );
    expect(SELECTION_STYLES).toMatch(
      /\.kt-tranbox-header__menu\s*\{[^}]*border-radius:\s*12px;/
    );
    expect(SELECTION_STYLES).toMatch(
      /\.kt-tranbox-header__menu button\s*\{[^}]*border-radius:\s*8px;/
    );
  });

  test("keeps the small translation FAB shape stable on hover", () => {
    const baseRule = SELECTION_STYLES.match(/\.KT-tranbtn\s*\{([^}]*)\}/)?.[1];
    const hoverRule = SELECTION_STYLES.match(
      /\.KT-tranbtn:hover\s*\{([^}]*)\}/
    )?.[1];

    expect(baseRule).toContain("border-radius: 12px");
    expect(baseRule).toContain("width: 40px");
    expect(baseRule).toContain("height: 40px");
    expect(baseRule).not.toMatch(/transition:[^;]*border-radius/);
    expect(hoverRule).toContain("var(--kt-onpric) 8%");
    expect(hoverRule).not.toContain("border-radius");
  });
});
