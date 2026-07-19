import { PROMPT_MODE_FOLLOW_API } from "../../config";
import { resolveDictionaryCapabilities } from "./dictionaryCapabilities";

const validApi = {
  apiSlug: "openai",
  apiType: "OpenAI",
  dictPrompt: "Define the selected text.",
};

describe("resolveDictionaryCapabilities", () => {
  test("reports no dictionary capability when every provider is unavailable", () => {
    expect(
      resolveDictionaryCapabilities({
        text: "hello world",
        enDict: "-",
        enSug: "-",
        aiDictApiSlug: "missing",
        transApis: [validApi],
      })
    ).toMatchObject({
      defaultDictionaryAvailable: false,
      aiDictionaryAvailable: false,
      suggestionAvailable: false,
      dictionaryAvailable: false,
    });
  });

  test("treats suggestions as a standalone dictionary capability", () => {
    expect(
      resolveDictionaryCapabilities({
        text: "library",
        enDict: "-",
        enSug: "Youdao",
      })
    ).toMatchObject({
      defaultDictionaryAvailable: false,
      aiDictionaryAvailable: false,
      suggestionAvailable: true,
      dictionaryAvailable: true,
    });
  });

  test("requires an enabled AI API with a valid prompt", () => {
    const base = {
      text: "library",
      enDict: "-",
      enSug: "-",
      aiDictApiSlug: "openai",
      aiDictPromptSlug: PROMPT_MODE_FOLLOW_API,
    };

    expect(
      resolveDictionaryCapabilities({ ...base, transApis: [validApi] })
        .aiDictionaryAvailable
    ).toBe(true);
    expect(
      resolveDictionaryCapabilities({
        ...base,
        transApis: [{ ...validApi, isDisabled: true }],
      }).aiDictionaryAvailable
    ).toBe(false);
    expect(
      resolveDictionaryCapabilities({
        ...base,
        transApis: [{ ...validApi, apiType: "Google" }],
      }).aiDictionaryAvailable
    ).toBe(false);
    expect(
      resolveDictionaryCapabilities({
        ...base,
        transApis: [{ ...validApi, dictPrompt: " " }],
      }).aiDictionaryAvailable
    ).toBe(false);
  });

  test("accepts a valid selected prompt and rejects missing or empty prompts", () => {
    const base = {
      text: "library",
      aiDictApiSlug: "openai",
      transApis: [validApi],
    };
    const prompts = [
      {
        slug: "custom-dictionary",
        category: "dictionary prompt",
        name: "Custom dictionary",
        systemPrompt: "Explain the word.",
        userPrompt: "{{text}}",
      },
      {
        slug: "empty-dictionary",
        category: "dictionary prompt",
        name: "Empty dictionary",
        systemPrompt: " ",
      },
      {
        slug: "wrong-category",
        category: "subtitle prompt",
        name: "Wrong category",
        systemPrompt: "Do not use this for dictionary lookups.",
      },
    ];

    const valid = resolveDictionaryCapabilities({
      ...base,
      prompts,
      aiDictPromptSlug: "custom-dictionary",
    });
    expect(valid.aiDictionaryAvailable).toBe(true);
    expect(valid.aiDictionaryApiSetting).toMatchObject({
      dictPromptSlug: "custom-dictionary",
      dictPrompt: "Explain the word.",
      dictUserPrompt: "{{text}}",
    });

    expect(
      resolveDictionaryCapabilities({
        ...base,
        prompts,
        aiDictPromptSlug: "missing-dictionary",
      }).aiDictionaryAvailable
    ).toBe(false);
    expect(
      resolveDictionaryCapabilities({
        ...base,
        prompts,
        aiDictPromptSlug: "empty-dictionary",
      }).aiDictionaryAvailable
    ).toBe(false);
    expect(
      resolveDictionaryCapabilities({
        ...base,
        prompts,
        aiDictPromptSlug: "wrong-category",
      }).aiDictionaryAvailable
    ).toBe(false);
  });
});
