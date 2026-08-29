/* eslint-disable testing-library/no-container, testing-library/no-unnecessary-act */
import { act } from "react";
import { createRoot } from "react-dom/client";
import IconButton from "@mui/material/IconButton";
import { useTheme } from "@mui/material/styles";
import M3Theme from "./M3Theme";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("./ColorMode", () => ({
  useDarkMode: () => ({ darkMode: "auto" }),
}));
jest.mock("./SystemColorScheme", () => ({
  useSystemDarkPreference: () => true,
}));

test("scopes the resolved Material 3 palette to its root", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <M3Theme>
        <span>content</span>
        <IconButton aria-label="default icon">D</IconButton>
        <IconButton aria-label="primary icon" color="primary">
          P
        </IconButton>
        <ThemeProbe />
      </M3Theme>
    );
  });

  const themeRoot = container.querySelector(".kt-m3-root");
  expect(themeRoot.dataset.theme).toBe("dark");
  expect(themeRoot.style.getPropertyValue("--kt-pri")).toBe("#A8C7FA");
  expect(themeRoot.querySelector("style").textContent).toContain(
    "@keyframes kt-m3-pop"
  );
  expect(capturedTheme.shape.borderRadius).toBe(12);
  expect(
    capturedTheme.components.MuiFilledInput.styleOverrides.root
  ).toMatchObject({
    borderRadius: 12,
    overflow: "hidden",
  });
  expect(
    capturedTheme.components.MuiFilledInput.styleOverrides.root[
      "&:not(.Mui-disabled):hover"
    ].backgroundColor
  ).toBe("#2D2F31");
  expect(capturedTheme.components.MuiCard.styleOverrides.root).toMatchObject({
    borderRadius: 12,
  });
  expect(capturedTheme.components.MuiTab.styleOverrides.root).toMatchObject({
    fontWeight: 650,
    transition: "background-color .2s ease, color .2s ease",
  });
  const iconButtonRoot =
    capturedTheme.components.MuiIconButton.styleOverrides.root;
  const defaultIconButton = iconButtonRoot({
    ownerState: { color: "default" },
  });
  const primaryIconButton = iconButtonRoot({
    ownerState: { color: "primary" },
  });
  expect(defaultIconButton.color).toBe("#C4C7C5");
  expect(defaultIconButton["&:hover"].backgroundColor).toBe("#282A2C");
  expect(
    defaultIconButton["&:hover"]["@media (hover: none)"].backgroundColor
  ).toBe("transparent");
  expect(primaryIconButton.color).toBe(undefined);
  expect(primaryIconButton["&:hover"]).toBe(undefined);
  expect(
    getComputedStyle(container.querySelector('[aria-label="default icon"]'))
      .color
  ).toBe("rgb(196, 199, 197)");
  expect(
    getComputedStyle(container.querySelector('[aria-label="primary icon"]'))
      .color
  ).toBe("rgb(168, 199, 250)");

  act(() => root.unmount());
  container.remove();
});

let capturedTheme;

function ThemeProbe() {
  capturedTheme = useTheme();
  return null;
}
