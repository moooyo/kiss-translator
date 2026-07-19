import { act } from "react";
import { createRoot } from "react-dom/client";
import { SettingsAdvanced, SettingsRange } from "./SettingsCard";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@mui/material/Slider", () => {
  return function MockSlider({ value, onChange, onChangeCommitted }) {
    const ReactApi = jest.requireActual("react");
    return ReactApi.createElement("input", {
      type: "range",
      value,
      onInput: (event) => onChange(event, Number(event.currentTarget.value)),
      onMouseUp: (event) =>
        onChangeCommitted(event, Number(event.currentTarget.value)),
    });
  };
});

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

describe("SettingsRange", () => {
  test("updates its preview continuously and persists only on commit", () => {
    const onChange = jest.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <SettingsRange
          value={20}
          min={0}
          max={100}
          unit=" ms"
          label="Delay"
          onChange={onChange}
        />
      );
    });
    const input = container.querySelector('input[type="range"]');

    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      ).set.call(input, "30");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelector("output").textContent).toBe("30 ms");
    expect(onChange).not.toHaveBeenCalled();

    act(() =>
      input.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
    );
    expect(onChange).toHaveBeenCalledWith(30);
    act(() => root.unmount());
  });
});
