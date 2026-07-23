import { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import {
  PROMPT_CATEGORY_BATCH_SYSTEM,
  PROMPT_CATEGORY_DICTIONARY,
  PROMPT_CATEGORY_SUBTITLE,
  PROMPT_CATEGORY_USER,
} from "../../config";
import Prompts from "./Prompts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
HTMLElement.prototype.scrollTo = jest.fn();

const mockUsePromptList = jest.fn();

jest.mock("../../hooks/Prompt", () => ({
  usePromptList: () => mockUsePromptList(),
}));

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key, fallback) => fallback || key,
}));

jest.mock("../../hooks/Confirm", () => ({
  useConfirm: () => jest.fn(),
}));

function createPrompt(category) {
  return {
    slug: `prompt_${category.replaceAll(" ", "_")}`,
    category,
    name: category,
    systemPrompt: "system prompt",
    userPrompt: "user prompt",
  };
}

function renderPrompts(category) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let prompt = createPrompt(category);
  const promptListValue = {
    addPrompt: jest.fn(),
    updatePrompt: jest.fn(),
    deletePrompt: jest.fn(),
    copyPrompt: jest.fn(),
    isPresetPromptSlug: () => false,
  };

  const setPrompt = (nextPrompt) => {
    prompt = nextPrompt;
    mockUsePromptList.mockReturnValue({
      prompts: [prompt],
      ...promptListValue,
    });
  };

  setPrompt(prompt);

  act(() => {
    root.render(<Prompts />);
  });

  return {
    container,
    prompt,
    rerender(nextPrompt) {
      setPrompt(nextPrompt);
      act(() => {
        root.render(<Prompts />);
      });
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("Prompts", () => {
  afterEach(() => {
    mockUsePromptList.mockReset();
    document.body.innerHTML = "";
  });

  test("shows system and user prompt fields for dictionary prompts", () => {
    const { container, unmount } = renderPrompts(PROMPT_CATEGORY_DICTIONARY);

    expect(container.textContent).toContain("系统提示词");
    expect(container.textContent).toContain("用户提示词");

    unmount();
  });

  test("keeps user prompt field visibility scoped to prompt categories that use it", () => {
    const visibleCategories = [
      PROMPT_CATEGORY_USER,
      PROMPT_CATEGORY_DICTIONARY,
    ];
    const hiddenCategories = [
      PROMPT_CATEGORY_BATCH_SYSTEM,
      PROMPT_CATEGORY_SUBTITLE,
    ];

    for (const category of visibleCategories) {
      const { container, unmount } = renderPrompts(category);
      expect(container.textContent).toContain("用户提示词");
      unmount();
    }

    for (const category of hiddenCategories) {
      const { container, unmount } = renderPrompts(category);
      expect(container.textContent).not.toContain("用户提示词");
      unmount();
    }
  });

  test("follows clean updates without discarding a dirty prompt draft", () => {
    const view = renderPrompts(PROMPT_CATEGORY_USER);
    const cleanUpdate = { ...view.prompt, name: "Remote clean prompt" };

    view.rerender(cleanUpdate);
    expect(view.container.querySelector('input[name="name"]').value).toBe(
      "Remote clean prompt"
    );

    act(() => {
      Simulate.change(view.container.querySelector('input[name="name"]'), {
        target: { name: "name", value: "Local prompt draft" },
      });
    });
    view.rerender({ ...cleanUpdate });
    expect(view.container.querySelector('input[name="name"]').value).toBe(
      "Local prompt draft"
    );

    view.rerender({
      ...cleanUpdate,
      systemPrompt: "Remote conflicting system prompt",
    });
    expect(view.container.querySelector('input[name="name"]').value).toBe(
      "Local prompt draft"
    );
    const saveButton = Array.from(
      view.container.querySelectorAll("button")
    ).find((button) => button.textContent === "save");
    expect(saveButton.disabled).toBe(false);

    view.unmount();
  });
});
