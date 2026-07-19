import { act } from "react";
import { createRoot } from "react-dom/client";
import { SettingsAdvanced } from "./SettingsCard";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SettingsAdvanced", () => {
  test("mounts advanced content only while expanded", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <SettingsAdvanced label="Details">
          <span data-testid="advanced-content">Advanced content</span>
        </SettingsAdvanced>
      );
    });

    const summary = container.querySelector(".MuiAccordionSummary-root");
    expect(
      container.querySelector('[data-testid="advanced-content"]')
    ).toBeNull();

    act(() => {
      summary.click();
    });
    expect(
      container.querySelector('[data-testid="advanced-content"]')
    ).not.toBeNull();

    act(() => root.unmount());
  });
});
