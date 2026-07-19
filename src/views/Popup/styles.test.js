import { POPUP_STYLES } from "./styles";

describe("Safari popup sizing", () => {
  test("uses intrinsic fixed dimensions instead of viewport-relative sizing", () => {
    const shellRule = POPUP_STYLES.match(/\.kt-popup-shell\s*\{([^}]*)\}/)?.[1];
    const scrollRule = POPUP_STYLES.match(
      /\.kt-popup-scroll\s*\{([^}]*)\}/
    )?.[1];

    expect(shellRule).toContain("width: 396px");
    expect(shellRule).toContain("min-width: 396px");
    expect(shellRule).not.toMatch(/max-(?:width|height):\s*100v[wh]/);
    const expandedRule = POPUP_STYLES.match(
      /\.kt-popup-scroll--expanded\s*\{([^}]*)\}/
    )?.[1];

    expect(scrollRule).toContain("height: auto");
    expect(scrollRule).toContain("overflow: visible");
    expect(scrollRule).not.toContain("100vh");
    expect(expandedRule).toContain("max-height: 492px");
    expect(expandedRule).toContain("overflow-y: auto");
    expect(expandedRule).toContain("scrollbar-width: none");
    expect(POPUP_STYLES).toMatch(
      /\.kt-popup-scroll--expanded::-webkit-scrollbar[\s\S]*?display:\s*none;/
    );
    expect(POPUP_STYLES).toMatch(
      /\.kt-popup-main-switch\.MuiSwitch-root\s*\{[^}]*width:\s*46px;[^}]*height:\s*28px;/
    );
    expect(POPUP_STYLES).toMatch(
      /\.kt-popup-main-switch \.MuiSwitch-switchBase\.Mui-checked\s*\{[^}]*transform:\s*translateX\(18px\);/
    );
    expect(POPUP_STYLES).toMatch(
      /\.kt-popup-main-switch \.MuiSwitch-switchBase\.Mui-checked \+ \.MuiSwitch-track\s*\{[^}]*background:\s*var\(--kt-pri\);/
    );
    expect(POPUP_STYLES).not.toMatch(
      /@media\s*\(max-width:\s*395px\)[\s\S]*?\.kt-popup-shell\s*\{\s*width:\s*100vw;/
    );
  });
});
