import {
  API_SPE_TYPES,
  OPT_DICT_MAP,
  OPT_SUG_MAP,
  PROMPT_CATEGORY_DICTIONARY,
  PROMPT_MODE_FOLLOW_API,
  findPromptBySlug,
} from "../../config";
import { isSingleChineseChar, isValidWord } from "../../libs/utils";

function hasPrompt(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function resolveAiDictionaryApiSetting({
  aiDictApiSlug,
  aiDictPromptSlug,
  prompts,
  transApis,
}) {
  if (!aiDictApiSlug || aiDictApiSlug === "-") {
    return null;
  }

  const apiSetting = transApis.find(
    (api) =>
      api.apiSlug === aiDictApiSlug &&
      !api.isDisabled &&
      API_SPE_TYPES.ai.has(api.apiType)
  );
  if (!apiSetting) {
    return null;
  }

  if (aiDictPromptSlug === PROMPT_MODE_FOLLOW_API) {
    return hasPrompt(apiSetting.dictPrompt) ? apiSetting : null;
  }

  const prompt = findPromptBySlug(prompts, aiDictPromptSlug);
  if (
    !prompt ||
    prompt.category !== PROMPT_CATEGORY_DICTIONARY ||
    !hasPrompt(prompt.systemPrompt)
  ) {
    return null;
  }

  return {
    ...apiSetting,
    dictPromptSlug: prompt.slug,
    dictPrompt: prompt.systemPrompt,
    dictUserPrompt: prompt.userPrompt,
  };
}

export function resolveDictionaryCapabilities({
  text = "",
  enDict = "-",
  enSug = "-",
  aiDictApiSlug = "-",
  aiDictPromptSlug = PROMPT_MODE_FOLLOW_API,
  prompts = [],
  transApis = [],
} = {}) {
  const normalizedText = typeof text === "string" ? text : "";
  const isWord = isValidWord(normalizedText);
  const isChineseChar = isSingleChineseChar(normalizedText);
  const defaultDictionaryAvailable =
    (isWord && OPT_DICT_MAP.has(enDict)) || isChineseChar;
  const suggestionAvailable = isWord && OPT_SUG_MAP.has(enSug);
  const aiDictionaryApiSetting = resolveAiDictionaryApiSetting({
    aiDictApiSlug,
    aiDictPromptSlug,
    prompts,
    transApis,
  });
  const aiDictionaryAvailable = Boolean(
    normalizedText.trim() && aiDictionaryApiSetting
  );

  return {
    isWord,
    isChineseChar,
    defaultDictionaryAvailable,
    aiDictionaryAvailable,
    suggestionAvailable,
    dictionaryAvailable:
      defaultDictionaryAvailable ||
      aiDictionaryAvailable ||
      suggestionAvailable,
    aiDictionaryApiSetting,
  };
}

export function normalizeDictionaryTab(
  requestedTab,
  { defaultDictionaryAvailable, aiDictionaryAvailable }
) {
  if (requestedTab === "default" && defaultDictionaryAvailable) {
    return "default";
  }
  if (requestedTab === "ai" && aiDictionaryAvailable) {
    return "ai";
  }
  if (defaultDictionaryAvailable) {
    return "default";
  }
  if (aiDictionaryAvailable) {
    return "ai";
  }
  return null;
}
