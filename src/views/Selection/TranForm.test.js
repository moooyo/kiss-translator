import { act } from "react";
import { createRoot } from "react-dom/client";
import TranForm from "./TranForm";
import { apiDict } from "../../apis";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../apis", () => ({
  apiDict: jest.fn(),
}));

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key, fallback) => fallback || key,
}));

jest.mock("../../libs/detect", () => ({
  tryDetectLang: jest.fn(async () => "en"),
}));

jest.mock("react-markdown", () => {
  const React = require("react");

  return ({ children }) => React.createElement("div", null, children);
});

jest.mock("./TranCont", () => {
  const React = require("react");

  return ({ apiSlug, playgroundStyle, text }) =>
    React.createElement("div", {
      "data-testid": "tran-cont",
      "data-api-slug": apiSlug,
      "data-playground-style": String(Boolean(playgroundStyle)),
      "data-text": text,
    });
});

jest.mock("./DictCont", () => {
  const React = require("react");

  return ({ text }) =>
    React.createElement("div", {
      "data-testid": "default-dict",
      "data-text": text,
    });
});

jest.mock("./Zdic", () => () => null);
jest.mock("./SugCont", () => {
  const React = require("react");

  return () => React.createElement("div", { "data-testid": "suggestions" });
});

jest.mock("./AudioBtn", () => {
  const React = require("react");

  return {
    BrowserTtsBtn: () =>
      React.createElement("button", { type: "button" }, "speak"),
  };
});

jest.mock("./CopyBtn", () => {
  const React = require("react");

  return () => React.createElement("button", { type: "button" }, "copy");
});

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderTranForm(props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <TranForm
        text="library"
        setText={jest.fn()}
        apiSlugs={[]}
        fromLang="en"
        toLang="zh-CN"
        toLang2="-"
        transApis={[
          {
            apiSlug: "openai",
            apiName: "OpenAI",
            apiType: "OpenAI",
            dictPrompt: "Dictionary prompt",
          },
        ]}
        simpleStyle
        langDetector="-"
        enDict="Bing"
        enSug="-"
        aiDictApiSlug="openai"
        selectionContext="The library is open."
        {...props}
      />
    );
  });

  return { container, root };
}

describe("TranForm Playground presentation", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("marks the editable source and result fields for M3 styling", () => {
    const { container, root } = renderTranForm({
      apiSlugs: ["openai"],
      isPlaygound: true,
      simpleStyle: false,
    });

    const sourceField = container.querySelector(
      ".kt-translation-text-field--source"
    );
    const actions = sourceField.querySelector(
      ".kt-translation-text-field__actions"
    );
    const translateButton = sourceField.querySelector(
      'button[aria-label="translate"]'
    );
    const result = container.querySelector('[data-testid="tran-cont"]');

    expect(sourceField.querySelector("textarea")).not.toBeNull();
    expect(actions).not.toBeNull();
    expect(translateButton).not.toBeNull();
    expect(sourceField.querySelector('[aria-label="submit"]')).toBeNull();
    expect(result.getAttribute("data-playground-style")).toBe("true");

    act(() => root.unmount());
  });
});

describe("TranForm AI dictionary tab", () => {
  beforeEach(() => {
    apiDict.mockReset();
    apiDict.mockResolvedValue("## library");
    document.body.innerHTML = "";
  });

  test.each([true, false])(
    "opens the AI dictionary tab once with selection context when simpleStyle is %s",
    async (simpleStyle) => {
      const { container, root } = renderTranForm({ simpleStyle });
      await flushEffects();

      const tabs = container.querySelectorAll('[role="tab"]');
      expect(tabs).toHaveLength(2);
      expect(apiDict).not.toHaveBeenCalled();

      await act(async () => {
        tabs[1].dispatchEvent(
          new MouseEvent("click", { bubbles: true, button: 0 })
        );
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(apiDict).toHaveBeenCalledTimes(1);
      expect(apiDict).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "library",
          context: "The library is open.",
        })
      );

      act(() => {
        root.unmount();
      });
    }
  );

  test("keeps the AI dictionary tab selected when text changes", async () => {
    const { container, root } = renderTranForm();
    await flushEffects();

    let tabs = container.querySelectorAll('[role="tab"]');
    await act(async () => {
      tabs[1].dispatchEvent(
        new MouseEvent("click", { bubbles: true, button: 0 })
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiDict).toHaveBeenCalledTimes(1);

    act(() => {
      root.render(
        <TranForm
          text="baseline"
          setText={jest.fn()}
          apiSlugs={[]}
          fromLang="en"
          toLang="zh-CN"
          toLang2="-"
          transApis={[
            {
              apiSlug: "openai",
              apiName: "OpenAI",
              apiType: "OpenAI",
              dictPrompt: "Dictionary prompt",
            },
          ]}
          simpleStyle
          langDetector="-"
          enDict="Bing"
          enSug="-"
          aiDictApiSlug="openai"
          selectionContext="If you create a baseline at this point."
        />
      );
    });
    await flushEffects();

    tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(apiDict).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: "baseline",
        context: "If you create a baseline at this point.",
      })
    );

    act(() => {
      root.unmount();
    });
  });
});

describe("TranForm translation service selection", () => {
  beforeEach(() => {
    apiDict.mockReset();
    document.body.innerHTML = "";
  });

  test("uses translationText for every translation service", async () => {
    const { container, root } = renderTranForm({
      text: "First line\nSecond line",
      translationText: "First line Second line",
      apiSlugs: ["google", "openai"],
      transApis: [
        { apiSlug: "google", apiName: "Google", apiType: "Google" },
        { apiSlug: "openai", apiName: "OpenAI", apiType: "OpenAI" },
      ],
      simpleStyle: false,
    });
    await flushEffects();

    expect(
      [...container.querySelectorAll('[data-testid="tran-cont"]')].map(
        (element) => element.dataset.text
      )
    ).toEqual(["First line Second line", "First line Second line"]);

    act(() => root.unmount());
  });

  test("keeps the original text for dictionary content", async () => {
    const { container, root } = renderTranForm({
      text: "library",
      translationText: "normalized library",
      apiSlugs: ["openai"],
    });
    await flushEffects();

    expect(
      container.querySelector('[data-testid="tran-cont"]').dataset.text
    ).toBe("normalized library");
    expect(
      container.querySelector('[data-testid="default-dict"]').dataset.text
    ).toBe("library");

    act(() => root.unmount());
  });

  test("keeps user-selected services when text changes", async () => {
    const setText = jest.fn();
    const transApis = [
      {
        apiSlug: "google",
        apiName: "Google",
        apiType: "Google",
      },
      {
        apiSlug: "openai",
        apiName: "OpenAI",
        apiType: "OpenAI",
      },
    ];
    const { container, root } = renderTranForm({
      text: "hello",
      setText,
      apiSlugs: ["google"],
      transApis,
      simpleStyle: false,
    });
    await flushEffects();

    expect(
      [...container.querySelectorAll('[data-testid="tran-cont"]')].map((el) =>
        el.getAttribute("data-api-slug")
      )
    ).toEqual(["google"]);

    const apiSlugsInput = container.querySelector('input[name="apiSlugs"]');
    const apiSlugsButton = apiSlugsInput
      .closest(".MuiInputBase-root")
      .querySelector(
        '[role="combobox"], [role="button"], [aria-haspopup="listbox"]'
      );
    await act(async () => {
      apiSlugsButton.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true })
      );
      await Promise.resolve();
    });

    await act(async () => {
      [...document.body.querySelectorAll('[role="option"]')]
        .find((option) => option.getAttribute("data-value") === "openai")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(
      [...container.querySelectorAll('[data-testid="tran-cont"]')].map((el) =>
        el.getAttribute("data-api-slug")
      )
    ).toEqual(["google", "openai"]);

    act(() => {
      root.render(
        <TranForm
          text="hello world"
          setText={setText}
          apiSlugs={["google"]}
          fromLang="en"
          toLang="zh-CN"
          toLang2="-"
          transApis={transApis}
          simpleStyle={false}
          langDetector="-"
          enDict="Bing"
          enSug="-"
          aiDictApiSlug="-"
        />
      );
    });
    await flushEffects();

    expect(
      [...container.querySelectorAll('[data-testid="tran-cont"]')].map((el) =>
        el.getAttribute("data-api-slug")
      )
    ).toEqual(["google", "openai"]);

    act(() => {
      root.unmount();
    });
  });
});

describe("TranForm panel views", () => {
  beforeEach(() => {
    apiDict.mockReset();
    document.body.innerHTML = "";
  });

  test("separates translation and dictionary content", async () => {
    const translation = renderTranForm({
      apiSlugs: ["openai"],
      viewMode: "translation",
    });
    await flushEffects();

    expect(
      translation.container.querySelector('[data-testid="tran-cont"]')
    ).not.toBeNull();
    expect(
      translation.container.querySelector('[data-testid="default-dict"]')
    ).toBeNull();
    act(() => translation.root.unmount());

    const dictionary = renderTranForm({
      apiSlugs: ["openai"],
      viewMode: "dictionary",
    });
    await flushEffects();

    expect(
      dictionary.container.querySelector('[data-testid="tran-cont"]')
    ).toBeNull();
    expect(
      dictionary.container.querySelector('[data-testid="default-dict"]')
    ).not.toBeNull();
    act(() => dictionary.root.unmount());
  });

  test("renders suggestions as the only dictionary capability", async () => {
    const { container, root } = renderTranForm({
      enDict: "-",
      enSug: "Youdao",
      aiDictApiSlug: "-",
      viewMode: "dictionary",
    });
    await flushEffects();

    expect(container.querySelector('[data-testid="default-dict"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="suggestions"]')
    ).not.toBeNull();
    act(() => root.unmount());
  });

  test("falls back to the default dictionary when AI capability is lost", async () => {
    const { container, root } = renderTranForm({ viewMode: "dictionary" });
    await flushEffects();

    let tabs = container.querySelectorAll('[role="tab"]');
    await act(async () => {
      tabs[1].dispatchEvent(
        new MouseEvent("click", { bubbles: true, button: 0 })
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(apiDict).toHaveBeenCalledTimes(1);

    act(() => {
      root.render(
        <TranForm
          text="library"
          setText={jest.fn()}
          apiSlugs={[]}
          fromLang="en"
          toLang="zh-CN"
          toLang2="-"
          transApis={[
            {
              apiSlug: "openai",
              apiName: "OpenAI",
              apiType: "OpenAI",
              dictPrompt: "Dictionary prompt",
              isDisabled: true,
            },
          ]}
          simpleStyle
          langDetector="-"
          enDict="Bing"
          enSug="-"
          aiDictApiSlug="openai"
          selectionContext="The library is open."
          viewMode="dictionary"
        />
      );
    });
    await flushEffects();

    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(0);
    expect(
      container.querySelector('[data-testid="default-dict"]')
    ).not.toBeNull();
    act(() => root.unmount());
  });
});

describe("TranForm popup input", () => {
  beforeEach(() => {
    apiDict.mockReset();
    document.body.innerHTML = "";
  });

  test("pastes clipboard text into an empty popup input", async () => {
    const setText = jest.fn();
    const readText = jest.fn().mockResolvedValue("  clipboard text  ");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText },
    });
    const { container, root } = renderTranForm({
      text: "",
      setText,
      popupStyle: true,
    });
    await flushEffects();

    const pasteButton = container.querySelector('button[aria-label="paste"]');
    expect(pasteButton).not.toBeNull();

    await act(async () => {
      pasteButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(readText).toHaveBeenCalledTimes(1);
    expect(setText).toHaveBeenCalledWith("clipboard text");

    act(() => root.unmount());
  });

  test("shows service choices below the results and compare control", () => {
    const { container, root } = renderTranForm({
      apiSlugs: ["openai"],
      popupStyle: true,
    });
    const form = container.querySelector(".kt-popup-translation-form");
    const results = form.querySelector(".kt-popup-translation-results");
    const compareButton = form.querySelector(".kt-popup-translation-compare");

    expect(form.querySelector(".kt-popup-translation-services")).toBeNull();

    act(() => {
      compareButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const services = form.querySelector(".kt-popup-translation-services");
    const children = [...form.children];
    expect(children.indexOf(results)).toBeLessThan(
      children.indexOf(compareButton)
    );
    expect(children.indexOf(compareButton)).toBeLessThan(
      children.indexOf(services)
    );

    act(() => root.unmount());
  });
});
