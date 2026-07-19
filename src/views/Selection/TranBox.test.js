import { act } from "react";
import { createRoot } from "react-dom/client";
import TranBox, {
  getDefaultTranBoxView,
  resolveTranBoxApiSlugs,
  resolveTranBoxView,
} from "./TranBox";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../hooks/Setting", () => ({
  SettingProvider: ({ children }) => children,
}));
jest.mock("../../hooks/Theme", () => ({
  __esModule: true,
  default: ({ children }) => children,
}));
jest.mock("../../hooks/I18n", () => ({ useI18n: () => (key) => key }));
jest.mock("../../hooks/ColorMode", () => ({
  useDarkMode: () => ({ darkMode: "light", toggleDarkMode: jest.fn() }),
}));
jest.mock("../../libs/msg", () => ({ sendBgMsg: jest.fn() }));
jest.mock("../../libs/client", () => ({ isExt: false }));
jest.mock("./DraggableResizable", () => {
  const React = require("react");
  return ({ header, children }) =>
    React.createElement("div", null, header, children);
});
jest.mock("./TranForm", () => {
  const React = require("react");
  return ({ viewMode }) =>
    React.createElement("div", {
      "data-testid": "tran-form",
      "data-view-mode": viewMode,
    });
});

function createTranBoxProps(overrides = {}) {
  return {
    text: "library",
    setText: jest.fn(),
    showBox: true,
    setShowBox: jest.fn(),
    simpleStyle: true,
    setSimpleStyle: jest.fn(),
    hideClickAway: false,
    setHideClickAway: jest.fn(),
    followSelection: true,
    setFollowSelection: jest.fn(),
    boxPosition: { x: 0, y: 0 },
    boxSize: { width: 400, height: 300 },
    setBoxPosition: jest.fn(),
    setBoxSize: jest.fn(),
    extStyles: "",
    prompts: [],
    transApis: [],
    selectionContext: "",
    tranboxSetting: {
      apiSlugs: ["Microsoft"],
      singleWordNoTrans: true,
      autoHeight: false,
      fromLang: "en",
      toLang: "zh-CN",
      toLang2: "-",
      enDict: "Bing",
      enSug: "-",
      aiDictApiSlug: "-",
    },
    ...overrides,
  };
}

function renderTranBox(props) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<TranBox {...props} />));
  return { container, root };
}

describe("getDefaultTranBoxView", () => {
  test("opens the dictionary for a word when translation is disabled", () => {
    expect(getDefaultTranBoxView("library", true)).toBe("dictionary");
  });

  test("opens translation for phrases and normal word translation", () => {
    expect(getDefaultTranBoxView("hello world", true)).toBe("translation");
    expect(getDefaultTranBoxView("library", false)).toBe("translation");
  });

  test("opens translation when a word has no dictionary capability", () => {
    expect(getDefaultTranBoxView("library", true, false)).toBe("translation");
    expect(
      resolveTranBoxView({
        requestedView: "dictionary",
        dictionaryAvailable: false,
      })
    ).toBe("translation");
  });

  test("restores translation services after the user selects translation", () => {
    const params = {
      apiSlugs: ["Microsoft"],
      text: "library",
      singleWordNoTrans: true,
    };

    expect(
      resolveTranBoxApiSlugs({ ...params, activeView: "dictionary" })
    ).toEqual([]);
    expect(
      resolveTranBoxApiSlugs({ ...params, activeView: "translation" })
    ).toEqual(["Microsoft"]);
  });
});

describe("TranBox dictionary view", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("does not render the dictionary tab without a capability", () => {
    const { container, root } = renderTranBox(
      createTranBoxProps({
        tranboxSetting: {
          ...createTranBoxProps().tranboxSetting,
          enDict: "-",
          enSug: "-",
        },
      })
    );

    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(1);
    expect(
      container
        .querySelector('[data-testid="tran-form"]')
        .getAttribute("data-view-mode")
    ).toBe("translation");
    act(() => root.unmount());
  });

  test("renders and selects the dictionary tab for suggestions only", () => {
    const { container, root } = renderTranBox(
      createTranBoxProps({
        tranboxSetting: {
          ...createTranBoxProps().tranboxSetting,
          enDict: "-",
          enSug: "Youdao",
        },
      })
    );

    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2);
    expect(
      container
        .querySelector('[data-testid="tran-form"]')
        .getAttribute("data-view-mode")
    ).toBe("dictionary");
    act(() => root.unmount());
  });

  test("falls back synchronously when text changes or capability is lost", () => {
    const initialProps = createTranBoxProps();
    const { container, root } = renderTranBox(initialProps);
    expect(
      container
        .querySelector('[data-testid="tran-form"]')
        .getAttribute("data-view-mode")
    ).toBe("dictionary");

    act(() => {
      root.render(<TranBox {...initialProps} text="hello world" />);
    });
    expect(
      container
        .querySelector('[data-testid="tran-form"]')
        .getAttribute("data-view-mode")
    ).toBe("translation");

    act(() => {
      root.render(
        <TranBox
          {...initialProps}
          tranboxSetting={{
            ...initialProps.tranboxSetting,
            enDict: "-",
          }}
        />
      );
    });
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(1);
    expect(
      container
        .querySelector('[data-testid="tran-form"]')
        .getAttribute("data-view-mode")
    ).toBe("translation");
    act(() => root.unmount());
  });
});
