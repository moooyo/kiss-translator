import { OPTIONS_STYLES } from "./styles";

describe("settings segmented controls", () => {
  test("keeps selected and focused states inside the segmented track", () => {
    const trackRule = OPTIONS_STYLES.match(
      /\.kt-settings-segmented\s*\{([^}]*)\}/
    )?.[1];
    const buttonRule = OPTIONS_STYLES.match(
      /\.kt-settings-segmented > button\s*\{([^}]*)\}/
    )?.[1];
    const focusRule = OPTIONS_STYLES.match(
      /\.kt-settings-segmented > button:focus-visible\s*\{([^}]*)\}/
    )?.[1];
    const labelRule = OPTIONS_STYLES.match(
      /\.kt-settings-segmented__label\s*\{([^}]*)\}/
    )?.[1];

    expect(trackRule).toContain("overflow: hidden");
    expect(trackRule).toContain("padding: 3px");
    expect(trackRule).toContain("min-width: 260px");
    expect(trackRule).toContain("max-width: 100%");
    expect(buttonRule).toContain("min-height: 34px");
    expect(buttonRule).toContain("overflow: hidden");
    expect(labelRule).toContain("text-overflow: ellipsis");
    expect(labelRule).toContain("white-space: nowrap");
    expect(focusRule).toContain("outline: none");
    expect(focusRule).toContain("box-shadow: inset");
    expect(OPTIONS_STYLES).toMatch(
      /\.kt-options-page \.MuiSwitch-root\.MuiSwitch-sizeSmall \.MuiSwitch-switchBase\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center;/
    );
  });
});
