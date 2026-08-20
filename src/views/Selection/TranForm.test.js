/* eslint-disable testing-library/no-container, testing-library/no-unnecessary-act */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import TranForm, { formatLanguageOptionName } from "./TranForm";
import { apiDict } from "../../apis";
import { tryDetectLang } from "../../libs/detect";

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

  return ({ apiSlug, text, toLang, translateVariants, popupStyle }) =>
    React.createElement("div", {
      "data-testid": "tran-cont",
      "data-api-slug": apiSlug,
      "data-text": text,
      "data-to-lang": toLang,
      "data-translate-variants": String(translateVariants),
      "data-popup-style": String(Boolean(popupStyle)),
    });
});

jest.mock("./DictCont", () => {
  const React = require("react");

  return () => React.createElement("div", { "data-testid": "default-dict" });
});

jest.mock("./Zdic", () => () => null);
jest.mock("./SugCont", () => () => null);

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
  beforeEach(() => {
    apiDict.mockReset();
    document.body.innerHTML = "";
  });

  test.each([
    ["English - English", "English"],
    ["AutoDetect - AutoDetect", "AutoDetect"],
    ["Résumé - Resume", "Résumé - Resume"],
    ["简体中文 - Simplified Chinese", "简体中文 - Simplified Chinese"],
  ])("formats language label %j as %j", (label, expected) => {
    expect(formatLanguageOptionName(label)).toBe(expected);
  });

  test("uses a responsive config grid and a read-only detection result", async () => {
    const { container, root } = renderTranForm({
      simpleStyle: false,
      isPlaygound: true,
      fromLang: "auto",
      toLang: "en",
      toLang2: "en",
      playgroundConfigHeader: <div data-testid="config-header" />,
    });
    await flushEffects();

    expect(
      container.querySelector(".kt-playground-config__grid")
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="config-header"]')
    ).not.toBeNull();
    expect(
      container.querySelector(".kt-playground-translator__source")
    ).not.toBeNull();
    expect(
      container.querySelector(".kt-playground-translator__empty").textContent
    ).toContain("请先选择至少一个");

    const detectionResult = container.querySelector('input[name="deLang"]');
    expect(detectionResult.readOnly).toBe(true);
    expect(detectionResult.disabled).toBe(false);

    act(() => root.unmount());
  });

  test("shows the service empty state when configured services are unavailable", async () => {
    const { container, root } = renderTranForm({
      simpleStyle: false,
      isPlaygound: true,
      apiSlugs: ["disabled"],
      transApis: [
        {
          apiSlug: "disabled",
          apiName: "Disabled",
          apiType: "Google",
          isDisabled: true,
        },
      ],
    });
    await flushEffects();

    expect(
      container.querySelector(".kt-playground-translator__empty").textContent
    ).toContain("请先选择至少一个");

    act(() => root.unmount());
  });

  test("keeps the submit action mounted through pointer down and commits once", async () => {
    const setText = jest.fn();
    const { container, root } = renderTranForm({
      text: "before",
      setText,
      simpleStyle: false,
      isPlaygound: true,
    });
    await flushEffects();

    const textarea = container.querySelector(
      ".kt-playground-translator__source textarea:not([aria-hidden='true'])"
    );
    act(() => Simulate.focus(textarea));
    act(() => Simulate.change(textarea, { target: { value: "  after  " } }));

    const submitButton = container.querySelector('button[title="submit"]');
    const pointerDown = new MouseEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
    });
    act(() => submitButton.dispatchEvent(pointerDown));
    expect(pointerDown.defaultPrevented).toBe(true);
    expect(container.querySelector('button[title="submit"]')).toBe(
      submitButton
    );

    act(() => submitButton.click());
    expect(setText).toHaveBeenCalledTimes(1);
    expect(setText).toHaveBeenCalledWith("after");
    expect(document.activeElement).not.toBe(textarea);

    act(() => Simulate.focus(textarea));
    expect(container.querySelector('button[title="submit"]')).toBeNull();
    act(() => Simulate.change(textarea, { target: { value: "again" } }));
    expect(container.querySelector('button[title="submit"]')).not.toBeNull();

    act(() => root.unmount());
  });

  test("keeps multiple translation results together and spans auxiliary content", async () => {
    const { container, root } = renderTranForm({
      simpleStyle: false,
      isPlaygound: true,
      apiSlugs: ["google", "openai"],
      transApis: [
        { apiSlug: "google", apiName: "Google", apiType: "Google" },
        { apiSlug: "openai", apiName: "OpenAI", apiType: "OpenAI" },
      ],
      enDict: "Bing",
    });
    await flushEffects();

    const results = container.querySelector(
      ".kt-playground-translator__results"
    );
    expect(results.querySelectorAll('[data-testid="tran-cont"]')).toHaveLength(
      2
    );
    expect(
      container
        .querySelector('[data-testid="default-dict"]')
        .closest(".kt-playground-translator__auxiliary")
    ).not.toBeNull();

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

  test("submits the popup input with Ctrl+Enter", () => {
    const setText = jest.fn();
    const { container, root } = renderTranForm({
      text: "library",
      setText,
      popupStyle: true,
    });
    const textarea = container.querySelector("textarea");

    act(() => {
      const setTextareaValue = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      ).set;
      setTextareaValue.call(textarea, "updated library");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: "Enter",
    });

    act(() => textarea.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
    expect(setText).toHaveBeenCalledWith("updated library");
    act(() => root.unmount());
  });

  test("shows M3 results before the expandable service choices", () => {
    const { container, root } = renderTranForm({
      apiSlugs: ["openai"],
      popupStyle: true,
    });
    const form = container.querySelector(".kt-popup-translation-form");
    const results = form.querySelector(".kt-popup-translation-results");
    const compareButton = form.querySelector(".kt-popup-translation-compare");

    expect(results.querySelector('[data-popup-style="true"]')).not.toBeNull();
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

describe("TranForm translation service selection", () => {
  beforeEach(() => {
    apiDict.mockReset();
    tryDetectLang.mockResolvedValue("en");
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

  test("switches to the secondary target when Chinese variants are disabled", async () => {
    tryDetectLang.mockResolvedValue("zh-TW");
    const { container, root } = renderTranForm({
      text: "繁體中文",
      apiSlugs: ["openai"],
      fromLang: "auto",
      toLang: "zh-CN",
      toLang2: "en",
      translateVariants: false,
    });
    await flushEffects();

    const translation = container.querySelector('[data-testid="tran-cont"]');
    expect(translation.dataset.toLang).toBe("en");
    expect(translation.dataset.translateVariants).toBe("false");

    act(() => root.unmount());
  });

  test("keeps the primary target when Chinese variants are enabled", async () => {
    tryDetectLang.mockResolvedValue("zh-TW");
    const { container, root } = renderTranForm({
      text: "繁體中文",
      apiSlugs: ["openai"],
      fromLang: "auto",
      toLang: "zh-CN",
      toLang2: "en",
      translateVariants: true,
    });
    await flushEffects();

    expect(
      container.querySelector('[data-testid="tran-cont"]').dataset.toLang
    ).toBe("zh-CN");

    act(() => root.unmount());
  });

  test.each([true, false])(
    "does not translate with explicitly empty service slugs when simpleStyle is %s",
    async (simpleStyle) => {
      const { container, root } = renderTranForm({
        apiSlugs: [],
        simpleStyle,
      });
      await flushEffects();

      expect(container.querySelector('[data-testid="tran-cont"]')).toBeNull();

      act(() => root.unmount());
    }
  );

  test("falls back when the service selection is missing rather than explicitly empty", async () => {
    const { container, root } = renderTranForm({ apiSlugs: undefined });
    await flushEffects();

    expect(
      container.querySelectorAll('[data-testid="tran-cont"]')
    ).toHaveLength(1);

    act(() => root.unmount());
  });

  test("falls back to the first enabled service when persisted slugs are stale", async () => {
    const { container, root } = renderTranForm({
      apiSlugs: ["removed", "disabled"],
      transApis: [
        {
          apiSlug: "disabled",
          apiName: "Disabled",
          apiType: "Google",
          isDisabled: true,
        },
        { apiSlug: "google", apiName: "Google", apiType: "Google" },
        { apiSlug: "openai", apiName: "OpenAI", apiType: "OpenAI" },
      ],
      popupStyle: true,
    });
    await flushEffects();

    expect(
      [...container.querySelectorAll('[data-testid="tran-cont"]')].map((el) =>
        el.getAttribute("data-api-slug")
      )
    ).toEqual(["google"]);

    act(() => root.unmount());
  });

  test("keeps one valid popup service after removing stale selections", async () => {
    const { container, root } = renderTranForm({
      apiSlugs: ["removed", "disabled", "google"],
      transApis: [
        {
          apiSlug: "disabled",
          apiName: "Disabled",
          apiType: "Google",
          isDisabled: true,
        },
        { apiSlug: "google", apiName: "Google", apiType: "Google" },
        { apiSlug: "openai", apiName: "OpenAI", apiType: "OpenAI" },
      ],
      popupStyle: true,
    });
    await flushEffects();

    const resultSlugs = () =>
      [...container.querySelectorAll('[data-testid="tran-cont"]')].map((el) =>
        el.getAttribute("data-api-slug")
      );
    act(() => container.querySelector(".kt-popup-translation-compare").click());
    const serviceButtons = [
      ...container.querySelectorAll(".kt-popup-translation-services button"),
    ];
    const googleButton = serviceButtons.find(
      (button) => button.textContent === "Google"
    );
    const openAiButton = serviceButtons.find(
      (button) => button.textContent === "OpenAI"
    );

    act(() => googleButton.click());
    expect(resultSlugs()).toEqual(["google"]);

    act(() => openAiButton.click());
    expect(resultSlugs()).toEqual(["google", "openai"]);

    act(() => googleButton.click());
    expect(resultSlugs()).toEqual(["openai"]);

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

describe("TranForm input focus and external text synchronization", () => {
  beforeEach(() => {
    apiDict.mockReset();
    tryDetectLang.mockResolvedValue("en");
    document.body.innerHTML = "";
  });

  test("focuses the original text input when auto focus is enabled", async () => {
    const { container, root } = renderTranForm({
      text: "",
      simpleStyle: false,
      autoFocusInput: true,
    });
    await flushEffects();

    expect(document.activeElement).toBe(container.querySelector("textarea"));
    act(() => root.unmount());
  });

  test("does not focus the original text input when auto focus is disabled", async () => {
    const { container, root } = renderTranForm({
      text: "bug",
      simpleStyle: false,
      autoFocusInput: false,
    });
    await flushEffects();

    expect(document.activeElement).not.toBe(
      container.querySelector("textarea")
    );
    act(() => root.unmount());
  });

  test("focuses after asynchronous initialization allows auto focus", async () => {
    const props = {
      text: "",
      simpleStyle: false,
      autoFocusInput: false,
    };
    const { container, root } = renderTranForm(props);
    await flushEffects();
    const input = container.querySelector("textarea");
    expect(document.activeElement).not.toBe(input);

    act(() => {
      root.render(
        <TranForm
          text=""
          setText={jest.fn()}
          apiSlugs={[]}
          fromLang="en"
          toLang="zh-CN"
          toLang2="-"
          transApis={[]}
          simpleStyle={false}
          langDetector="-"
          enDict="Bing"
          enSug="-"
          aiDictApiSlug="-"
          autoFocusInput
        />
      );
    });
    await flushEffects();

    expect(document.activeElement).toBe(input);
    act(() => root.unmount());
  });

  test("keeps clipboard text visible and submits it after blur while editing", async () => {
    const setText = jest.fn();
    const transApis = [];
    const { container, root } = renderTranForm({
      text: "",
      setText,
      transApis,
      simpleStyle: false,
      autoFocusInput: true,
      syncExternalTextWhileEditing: true,
    });
    await flushEffects();

    act(() => {
      root.render(
        <TranForm
          text="bug"
          setText={setText}
          apiSlugs={[]}
          fromLang="en"
          toLang="zh-CN"
          toLang2="-"
          transApis={transApis}
          simpleStyle={false}
          langDetector="-"
          enDict="Bing"
          enSug="-"
          aiDictApiSlug="-"
          autoFocusInput={false}
          syncExternalTextWhileEditing
        />
      );
    });
    await flushEffects();

    const input = container.querySelector("textarea");
    expect(input.value).toBe("bug");

    await act(async () => {
      input.blur();
      await Promise.resolve();
    });
    expect(setText).toHaveBeenLastCalledWith("bug");
    act(() => root.unmount());
  });
});