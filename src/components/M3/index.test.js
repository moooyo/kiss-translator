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
            { value: "blue", label: "Google 蓝" },
            { value: "cyan", label: "青碧" },
          ]}
        />
      );
    });

    const selectedButton = container.querySelector(
      'button[aria-selected="true"]'
    );
    expect(selectedButton.querySelector("svg")).toBeNull();
    expect(selectedButton.title).toBe("Google 蓝");
    expect(
      selectedButton.querySelector(".kt-m3-segmented__label").textContent
    ).toBe("Google 蓝");

    act(() => root.unmount());
    container.remove();
  });
});
