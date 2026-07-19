import { act } from "react";
import { createRoot } from "react-dom/client";
import { M3Segmented, M3Switch } from ".";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("M3Switch", () => {
  test("does not bubble track clicks into a clickable parent", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const handleParentClick = jest.fn();
    const handleChange = jest.fn();

    act(() => {
      root.render(
        <div onClick={handleParentClick}>
          <M3Switch checked={false} onChange={handleChange} />
        </div>
      );
    });

    act(() => {
      container.querySelector(".kt-m3-switch__track").click();
    });

    expect(handleParentClick).not.toHaveBeenCalled();
    expect(handleChange).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });
});

describe("M3Segmented", () => {
  test("uses selected styling without adding a check icon to the label", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <M3Segmented
          value="blue"
          onChange={jest.fn()}
          ariaLabel="Theme"
          items={[
            {
              value: "blue",
              label: "Google blue",
              tabId: "blue-tab",
              panelId: "blue-panel",
            },
            {
              value: "cyan",
              label: "Cyan",
              tabId: "cyan-tab",
              panelId: "cyan-panel",
            },
          ]}
        />
      );
    });

    const selectedButton = container.querySelector(
      'button[aria-selected="true"]'
    );
    expect(selectedButton.querySelector("svg")).toBeNull();
    expect(selectedButton.title).toBe("Google blue");
    expect(selectedButton.id).toBe("blue-tab");
    expect(selectedButton.getAttribute("aria-controls")).toBe("blue-panel");
    expect(
      selectedButton.querySelector(".kt-m3-segmented__label").textContent
    ).toBe("Google blue");

    act(() => root.unmount());
    container.remove();
  });

  test("uses radio semantics and supports arrow-key selection", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
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
    container.remove();
  });
});
