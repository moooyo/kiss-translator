import { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { StyleAccordion } from "./StylesSetting";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@emotion/css", () => ({
  css: jest.fn(() => "mock-preview-class"),
}));

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key) => key,
}));

jest.mock("../../hooks/Setting", () => ({
  useSetting: () => ({ setting: { uiLang: "en" } }),
}));

jest.mock("../../hooks/CustomStyles", () => ({
  useStyleList: () => ({
    customStyles: [],
    addStyle: jest.fn(),
    deleteStyle: jest.fn(),
    updateStyle: jest.fn(),
  }),
  useAllTextStyles: () => ({ builtinStyles: [] }),
}));

jest.mock("../../hooks/Confirm", () => ({
  useConfirm: () => jest.fn(async () => true),
}));

const CUSTOM_STYLE = {
  styleSlug: "custom_style",
  styleName: "Custom style",
  styleCode: "color: red;",
};

function renderStyleAccordion(customStyle) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = (nextStyle) => {
    root.render(
      <StyleAccordion
        customStyle={nextStyle}
        deleteStyle={jest.fn()}
        updateStyle={jest.fn()}
      />
    );
  };

  act(() => {
    render(customStyle);
  });
  act(() => {
    container.querySelector(".MuiAccordionSummary-root").click();
  });

  return {
    container,
    rerender(nextStyle) {
      act(() => {
        render(nextStyle);
      });
    },
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("StylesSetting persisted updates", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("follows clean updates without discarding a dirty style draft", () => {
    const view = renderStyleAccordion(CUSTOM_STYLE);
    const cleanUpdate = {
      ...CUSTOM_STYLE,
      styleName: "Remote clean style",
    };

    view.rerender(cleanUpdate);
    expect(view.container.querySelector('input[name="styleName"]').value).toBe(
      "Remote clean style"
    );

    act(() => {
      Simulate.change(view.container.querySelector('input[name="styleName"]'), {
        target: { name: "styleName", value: "Local style draft" },
        preventDefault: jest.fn(),
      });
    });
    view.rerender({ ...cleanUpdate });
    expect(view.container.querySelector('input[name="styleName"]').value).toBe(
      "Local style draft"
    );

    view.rerender({
      ...cleanUpdate,
      styleCode: "color: rebeccapurple;",
    });
    expect(view.container.querySelector('input[name="styleName"]').value).toBe(
      "Local style draft"
    );
    const saveButton = Array.from(
      view.container.querySelectorAll("button")
    ).find((button) => button.textContent === "save");
    expect(saveButton.disabled).toBe(false);

    view.unmount();
  });
});
