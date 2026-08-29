import { getMuiSwitchStyleOverrides } from "./themeStyles";

describe("MUI switch alignment", () => {
  test("centers the switch thumb with a fixed grid in both states", () => {
    const styles = getMuiSwitchStyleOverrides({
      outline: "#777",
      primary: "#06f",
      onPrimary: "#fff",
      onSurface: "#111",
      surfaceHigh: "#eee",
    });

    expect(styles.switchBase).toEqual(
      expect.objectContaining({
        width: 32,
        height: 32,
        display: "grid",
        placeItems: "center",
        top: 0,
        padding: 0,
        transform: "none",
      })
    );
    expect(styles.switchBase["&.Mui-checked"].transform).toBe(
      "translateX(20px)"
    );
    expect(
      styles.root["&.MuiSwitch-sizeSmall .MuiSwitch-switchBase.Mui-checked"]
        .transform
    ).toBe("translateX(20px)");
    expect(
      styles.switchBase["&.Mui-checked"]["&.Mui-disabled + .MuiSwitch-track"]
        .opacity
    ).toBe(0.12);
    expect(styles.switchBase.transition).toContain("transform");
    expect(styles.switchBase.transition).not.toContain("all");
    expect(styles.thumb.transition).toContain("width");
    expect(styles.thumb.transition).toContain("height");
    expect(styles.track.transition).toContain("background-color");
    expect(styles.switchBase["&:hover"].backgroundColor).toContain("#111");
    expect(
      styles.switchBase["&.Mui-checked"]["&:hover"].backgroundColor
    ).toContain("#06f");
    expect(
      styles.switchBase["&:hover"]["@media (hover: none)"].backgroundColor
    ).toBe("transparent");
  });
});
