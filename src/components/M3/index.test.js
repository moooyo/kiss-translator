import { act } from "react";
import { createRoot } from "react-dom/client";
import { M3Segmented } from "./index";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("M3Segmented", () => {
  test("uses radio semantics and supports arrow-key selection", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onChange = jest.fn();

    act(() => {
      root.render(
        <M3Segmented
          mode="radio"
          ariaLabel="Theme"
          value="light"
          onChange={onChange}
          items={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      );
    });

    const group = container.querySelector('[role="radiogroup"]');
    const radios = container.querySelectorAll('[role="radio"]');
    expect(group).not.toBeNull();
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
    expect(radios[0].tabIndex).toBe(0);
    expect(radios[1].tabIndex).toBe(-1);

    act(() => {
      radios[0].dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
    });
    expect(onChange).toHaveBeenCalledWith("dark");
    act(() => root.unmount());
  });
});
