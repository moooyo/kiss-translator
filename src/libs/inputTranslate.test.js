const mockUnregisterShortcut = jest.fn();

jest.mock("../config", () => ({
  DEFAULT_INPUT_RULE: {
    transOpen: true,
    triggerShortcut: ["AltLeft", "KeyI"],
    triggerCount: 1,
    triggerTime: 200,
    showDot: "always",
  },
  DEFAULT_INPUT_SHORTCUT: ["AltLeft", "KeyI"],
  OPT_LANGS_LIST: [],
  DEFAULT_API_SETTING: {},
  OPT_INPUT_DOT_DISABLE: "-",
  OPT_INPUT_DOT_MOBILE: "mobile",
  newI18n: jest.fn(),
}));

jest.mock("../config/prompt", () => ({
  resolveApiPromptSettings: jest.fn(),
}));

jest.mock("./mobile", () => ({ isMobile: false }));

jest.mock("./utils", () => ({
  genEventName: jest.fn(() => "event"),
  removeEndchar: jest.fn((text) => text),
  matchInputStr: jest.fn(),
  sleep: jest.fn(() => Promise.resolve()),
}));

jest.mock("./shortcut", () => ({
  stepShortcutRegister: jest.fn(() => mockUnregisterShortcut),
}));

jest.mock("../apis", () => ({ apiTranslate: jest.fn() }));
jest.mock("./svg", () => ({ createLoadingSVG: jest.fn() }));
jest.mock("./log", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { InputTranslator } = require("./inputTranslate");
const { newI18n } = require("../config");
const { stepShortcutRegister } = require("./shortcut");
const { resolveApiPromptSettings } = require("../config/prompt");
const { apiTranslate } = require("../apis");
const { createLoadingSVG } = require("./svg");
const { genEventName, removeEndchar } = require("./utils");

function makeRect({ top = 100, right = 200, width = 100, height = 30 } = {}) {
  return {
    top,
    right,
    bottom: top + height,
    left: right - width,
    width,
    height,
    x: right - width,
    y: top,
    toJSON: () => {},
  };
}

function focusTarget(translator, target, rect = makeRect()) {
  target.getBoundingClientRect = jest.fn(() => rect);
  document.body.appendChild(target);
  target.focus();
  translator.handleFocusIn();
}

function getFloatButton(target) {
  return Array.from(document.body.children).find(
    (node) => node !== target && node.style.position === "fixed"
  );
}

describe("InputTranslator input button", () => {
  let originalResizeObserver;
  let translator;

  beforeAll(() => {
    originalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 600,
    });
  });

  afterAll(() => {
    window.ResizeObserver = originalResizeObserver;
  });

  beforeEach(() => {
    document.body.innerHTML = "";
    newI18n.mockImplementation(
      () => (key) =>
        ({
          input_translate: "Translate input",
          popup_translating: "Translating input",
        })[key] || ""
    );
    genEventName.mockReturnValue("event");
    removeEndchar.mockImplementation((text) => text);
    mockUnregisterShortcut.mockClear();
    stepShortcutRegister.mockReturnValue(mockUnregisterShortcut);
    translator = new InputTranslator({
      inputRule: {
        transOpen: true,
        triggerShortcut: ["AltLeft", "KeyI"],
        triggerCount: 1,
        triggerTime: 200,
        showDot: "always",
      },
    });
  });

  afterEach(() => {
    translator.disable();
    document.body.innerHTML = "";
  });

  test.each([
    ["input without an explicit type", () => document.createElement("input")],
    [
      "search input",
      () => Object.assign(document.createElement("input"), { type: "search" }),
    ],
    ["textarea", () => document.createElement("textarea")],
    [
      "contenteditable",
      () => {
        const node = document.createElement("div");
        node.tabIndex = 0;
        node.setAttribute("contenteditable", "true");
        return node;
      },
    ],
  ])("shows the button for %s", (_label, createTarget) => {
    const target = createTarget();
    focusTarget(translator, target);

    expect(getFloatButton(target)).toBeTruthy();
  });

  test.each([
    "checkbox",
    "radio",
    "submit",
    "button",
    "image",
    "file",
    "password",
  ])("does not show the button for %s input", (type) => {
    const target = document.createElement("input");
    target.type = type;
    focusTarget(translator, target);

    expect(getFloatButton(target)).toBeUndefined();
  });

  test.each([
    [
      "disabled",
      (target) => {
        target.disabled = true;
      },
    ],
    [
      "read-only",
      (target) => {
        target.readOnly = true;
      },
    ],
  ])("does not show the button for a %s text input", (_label, configure) => {
    const target = document.createElement("input");
    configure(target);
    focusTarget(translator, target);

    expect(getFloatButton(target)).toBeUndefined();
  });

  test("places a short input button above when space is available", () => {
    const target = document.createElement("input");
    focusTarget(translator, target, makeRect({ top: 100, height: 30 }));

    expect(getFloatButton(target).style.top).toBe("68px");
  });

  test("places a short input button below when the top edge has no room", () => {
    const target = document.createElement("input");
    focusTarget(translator, target, makeRect({ top: 10, height: 30 }));

    expect(getFloatButton(target).style.top).toBe("42px");
  });

  test("keeps the button above an input near the bottom edge", () => {
    const target = document.createElement("input");
    focusTarget(translator, target, makeRect({ top: 560, height: 30 }));

    expect(getFloatButton(target).style.top).toBe("528px");
  });

  test("keeps a tall input button inside its bottom-right corner", () => {
    const target = document.createElement("textarea");
    focusTarget(translator, target, makeRect({ top: 100, height: 100 }));

    expect(getFloatButton(target).style.top).toBe("165px");
  });

  test("uses a stable rounded shape and animated visibility", () => {
    const target = document.createElement("input");
    focusTarget(translator, target);
    const button = getFloatButton(target);

    expect(button.tagName).toBe("BUTTON");
    expect(button.type).toBe("button");
    expect(button.getAttribute("aria-label")).toBe("Translate input");
    expect(button.style.border).toBe("0px");
    expect(button.style.borderRadius).toBe("8px");
    expect(button.style.transition).toContain("opacity 160ms");
    expect(button.dataset.visible).toBe("true");
    expect(button.style.visibility).toBe("visible");

    translator.hideFloatButton();

    expect(button.dataset.visible).toBe("false");
    expect(button.style.opacity).toBe("0");
    expect(button.style.visibility).toBe("hidden");
    expect(button.style.pointerEvents).toBe("none");
  });

  test("activates the input translation from a keyboard click", () => {
    const target = document.createElement("input");
    const handleTranslate = jest
      .spyOn(translator, "handleTranslate")
      .mockResolvedValue(undefined);
    focusTarget(translator, target);

    getFloatButton(target).click();

    expect(handleTranslate).toHaveBeenCalledWith({ isBtnTrigger: true });
  });

  test.each([
    [20, "0px"],
    [900, "768px"],
  ])("clamps horizontal position for right edge %i", (right, expectedLeft) => {
    const target = document.createElement("input");
    focusTarget(translator, target, makeRect({ top: 100, right }));

    expect(getFloatButton(target).style.left).toBe(expectedLeft);
  });

  test("removes the button and shortcut when disabled", () => {
    const target = document.createElement("input");
    focusTarget(translator, target);

    translator.disable();

    expect(getFloatButton(target)).toBeUndefined();
    expect(mockUnregisterShortcut).toHaveBeenCalledTimes(1);
  });

  test("requests editable content as plain text", async () => {
    translator.disable();
    const apiSetting = {
      apiSlug: "google-cloud",
      apiType: "GoogleCloud",
    };
    translator = new InputTranslator({
      inputRule: {
        transOpen: true,
        triggerShortcut: ["."],
        triggerCount: 1,
        triggerTime: 200,
        showDot: "always",
        apiSlug: "google-cloud",
        fromLang: "auto",
        toLang: "en",
      },
      transApis: [apiSetting],
    });
    resolveApiPromptSettings.mockReturnValue(apiSetting);
    createLoadingSVG.mockReturnValue(
      document.createElementNS("http://www.w3.org/2000/svg", "svg")
    );
    apiTranslate.mockResolvedValueOnce({
      trText: "First isn't & simple\n\nSecond",
      isSame: false,
    });
    const target = document.createElement("textarea");
    target.value = "First & simple\n\nSecond.";
    focusTarget(translator, target);
    removeEndchar.mockReturnValueOnce("First & simple\n\nSecond");

    await translator.handleTranslate();

    expect(apiTranslate).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "First & simple\n\nSecond",
        textFormat: "text",
      })
    );
    expect(target.value).toBe("First isn't & simple\n\nSecond");
  });

  test("exposes and clears the input translation loading state", async () => {
    translator.disable();
    const apiSetting = {
      apiSlug: "google-cloud",
      apiType: "GoogleCloud",
    };
    translator = new InputTranslator({
      inputRule: {
        transOpen: true,
        triggerShortcut: ["AltLeft", "KeyI"],
        triggerCount: 1,
        triggerTime: 200,
        showDot: "always",
        apiSlug: "google-cloud",
        fromLang: "auto",
        toLang: "en",
      },
      transApis: [apiSetting],
    });
    resolveApiPromptSettings.mockReturnValue(apiSetting);
    const loadingIcon = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    loadingIcon.setAttribute("aria-hidden", "true");
    createLoadingSVG.mockReturnValue(loadingIcon);

    let resolveTranslation;
    apiTranslate.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveTranslation = resolve;
      })
    );
    const target = document.createElement("textarea");
    target.value = "Hello";
    focusTarget(translator, target);

    const request = translator.handleTranslate({ isBtnTrigger: true });
    await Promise.resolve();

    const status = document.getElementById("kiss-loading-event");
    expect(target.getAttribute("aria-busy")).toBe("true");
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("aria-atomic")).toBe("true");
    expect(status.getAttribute("aria-label")).toBe("Translating input");
    expect(status.querySelector("svg").getAttribute("aria-hidden")).toBe(
      "true"
    );

    resolveTranslation({ trText: "", isSame: true });
    await request;

    expect(document.getElementById("kiss-loading-event")).toBeNull();
    expect(target.hasAttribute("aria-busy")).toBe(false);
  });

  test("does not overwrite newer input state when requests resolve late", async () => {
    translator.disable();
    const apiSetting = {
      apiSlug: "google-cloud",
      apiType: "GoogleCloud",
    };
    translator = new InputTranslator({
      inputRule: {
        transOpen: true,
        triggerShortcut: ["AltLeft", "KeyI"],
        triggerCount: 1,
        triggerTime: 200,
        showDot: "always",
        apiSlug: "google-cloud",
        fromLang: "auto",
        toLang: "en",
      },
      transApis: [apiSetting],
    });
    resolveApiPromptSettings.mockReturnValue(apiSetting);
    createLoadingSVG.mockImplementation(() =>
      document.createElementNS("http://www.w3.org/2000/svg", "svg")
    );
    genEventName
      .mockReturnValueOnce("older-request")
      .mockReturnValueOnce("newer-request");

    let resolveOlder;
    let resolveNewer;
    apiTranslate
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOlder = resolve;
        })
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveNewer = resolve;
        })
      );

    const target = document.createElement("textarea");
    target.value = "Older source";
    focusTarget(translator, target);
    const olderRequest = translator.handleTranslate({ isBtnTrigger: true });
    await Promise.resolve();

    target.value = "Newer source";
    const newerRequest = translator.handleTranslate({ isBtnTrigger: true });
    await Promise.resolve();

    expect(document.getElementById("kiss-loading-older-request")).toBeNull();
    expect(
      document.getElementById("kiss-loading-newer-request")
    ).not.toBeNull();

    resolveNewer({ trText: "Newest result", isSame: false });
    await newerRequest;
    expect(target.value).toBe("Newest result");
    expect(target.hasAttribute("aria-busy")).toBe(false);

    resolveOlder({ trText: "Stale result", isSame: false });
    await olderRequest;
    expect(target.value).toBe("Newest result");
    expect(target.hasAttribute("aria-busy")).toBe(false);

    let resolveManualEditRequest;
    genEventName.mockReturnValueOnce("manual-edit-request");
    apiTranslate.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveManualEditRequest = resolve;
      })
    );
    target.value = "Source before manual edit";
    const manualEditRequest = translator.handleTranslate({
      isBtnTrigger: true,
    });
    await Promise.resolve();

    target.value = "User draft while waiting";
    resolveManualEditRequest({ trText: "Late result", isSame: false });
    await manualEditRequest;

    expect(target.value).toBe("User draft while waiting");
    expect(target.hasAttribute("aria-busy")).toBe(false);

    let resolveDetachedRequest;
    genEventName.mockReturnValueOnce("detached-request");
    apiTranslate.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDetachedRequest = resolve;
      })
    );
    target.value = "Detached source";
    const detachedRequest = translator.handleTranslate({
      isBtnTrigger: true,
    });
    await Promise.resolve();
    expect(
      document.getElementById("kiss-loading-detached-request")
    ).not.toBeNull();

    target.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById("kiss-loading-detached-request")).toBeNull();
    expect(target.hasAttribute("aria-busy")).toBe(false);
    expect(getFloatButton(target)).toBeUndefined();

    resolveDetachedRequest({ trText: "Detached result", isSame: false });
    await detachedRequest;
    expect(target.value).toBe("Detached source");
    expect(getFloatButton(target)).toBeUndefined();
  });

  test("clears a pending loading context when disabled", async () => {
    translator.disable();
    const apiSetting = {
      apiSlug: "google-cloud",
      apiType: "GoogleCloud",
    };
    translator = new InputTranslator({
      inputRule: {
        transOpen: true,
        triggerShortcut: ["AltLeft", "KeyI"],
        triggerCount: 1,
        triggerTime: 200,
        showDot: "always",
        apiSlug: "google-cloud",
        fromLang: "auto",
        toLang: "en",
      },
      transApis: [apiSetting],
    });
    resolveApiPromptSettings.mockReturnValue(apiSetting);
    createLoadingSVG.mockReturnValue(
      document.createElementNS("http://www.w3.org/2000/svg", "svg")
    );

    let resolveTranslation;
    apiTranslate.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveTranslation = resolve;
      })
    );
    const target = document.createElement("textarea");
    target.value = "Hello";
    target.setAttribute("aria-busy", "false");
    focusTarget(translator, target);

    const request = translator.handleTranslate({ isBtnTrigger: true });
    await Promise.resolve();
    expect(target.getAttribute("aria-busy")).toBe("true");
    expect(document.getElementById("kiss-loading-event")).not.toBeNull();

    translator.disable();
    expect(target.getAttribute("aria-busy")).toBe("false");
    expect(document.getElementById("kiss-loading-event")).toBeNull();

    resolveTranslation({ trText: "Translated", isSame: false });
    await request;
    expect(target.value).toBe("Hello");
    expect(getFloatButton(target)).toBeUndefined();
  });
});
