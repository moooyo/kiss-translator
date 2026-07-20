import { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import Apis from "./Apis";
import { OPT_TRANS_BUILTINAI, OPT_TRANS_OPENAI } from "../../config";
import { fetchModelList } from "../../libs/modelList";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
HTMLElement.prototype.scrollTo = jest.fn();
const mockConfirm = jest.fn();

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key, fallback) => fallback || key,
}));

jest.mock("../../hooks/Api", () => ({
  useApiList: jest.fn(),
  useApiItem: jest.fn(),
}));

jest.mock("../../hooks/Prompt", () => ({
  usePromptList: () => ({ prompts: [] }),
}));

jest.mock("../../hooks/Confirm", () => ({
  useConfirm: () => mockConfirm,
}));

jest.mock("../../hooks/Alert", () => ({
  useAlert: () => ({
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock("../../hooks/Setting", () => ({
  useSetting: () => ({
    setting: { prompts: [], subtitleSetting: {}, uiLang: "zh" },
  }),
}));

jest.mock("../../apis", () => ({
  apiTranslate: jest.fn(),
}));

jest.mock("../../libs/modelList", () => ({
  fetchModelList: jest.fn(),
}));

jest.mock("./ReusableAutocomplete", () => {
  return function MockReusableAutocomplete({
    name,
    label,
    value,
    options = [],
    onChange,
    onFocus,
    textFieldProps = {},
  }) {
    return (
      <label>
        {label}
        <input
          name={name}
          value={value || ""}
          onChange={onChange}
          onFocus={onFocus}
          data-options={options.join(",")}
          aria-invalid={textFieldProps.error ? "true" : "false"}
        />
        {textFieldProps.helperText ? (
          <span>{textFieldProps.helperText}</span>
        ) : null}
      </label>
    );
  };
});

const { useApiList, useApiItem } = require("../../hooks/Api");

function createApi(overrides = {}) {
  return {
    apiSlug: "OpenAI",
    apiName: "OpenAI",
    apiType: OPT_TRANS_OPENAI,
    url: "https://api.openai.com/v1/chat/completions",
    key: "sk-test",
    model: "gpt-4",
    modelListUrl: "https://api.openai.com/v1/models",
    sortOrder: 0,
    httpTimeout: 30,
    ...overrides,
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderApis(api = createApi(), update = jest.fn()) {
  const apis = Array.isArray(api) ? api : [api];
  const reset = jest.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  useApiList.mockReturnValue({
    transApis: apis,
    addApi: jest.fn(),
    deleteApi: jest.fn(),
    deleteApis: jest.fn(),
    pinApis: jest.fn(),
    disableApis: jest.fn(),
    enableApis: jest.fn(),
    copyApi: jest.fn(),
    alphaSortApis: jest.fn(),
    reorderApis: jest.fn(),
  });
  useApiItem.mockImplementation((apiSlug) => ({
    api: apis.find((item) => item.apiSlug === apiSlug),
    update,
    reset,
  }));

  await act(async () => {
    root.render(<Apis />);
  });
  await flushEffects();

  return {
    container,
    reset,
    update,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function getInput(container, name) {
  const input = container.querySelector(`input[name="${name}"]`);
  if (!input) {
    throw new Error(`Unable to find input named ${name}`);
  }
  return input;
}

function getSaveButton(container) {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "save"
  );
}

function getButton(root, label) {
  const button = Array.from(root.querySelectorAll("button")).find(
    (item) => item.textContent === label
  );
  if (!button) {
    throw new Error(`Unable to find button labeled ${label}`);
  }
  return button;
}

function getApiListItem(container, apiName) {
  const item = Array.from(
    container.querySelectorAll(".MuiListItemButton-root")
  ).find((element) => element.textContent.includes(apiName));
  if (!item) {
    throw new Error(`Unable to find list item for ${apiName}`);
  }
  return item;
}

async function editUrlDraft(container) {
  const urlInput = getInput(container, "url");
  await act(async () => {
    Simulate.change(urlInput, {
      target: { name: "url", value: "https://draft.example/v1" },
    });
  });
  return urlInput;
}

function getListToggle(container, apiName) {
  const input = container.querySelector(`input[aria-label="${apiName}"]`);
  if (!input) {
    throw new Error(`Unable to find list toggle for ${apiName}`);
  }
  return input;
}

describe("Apis conditional option groups", () => {
  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  test("omits the runtime option shell when the API has no matching controls", async () => {
    const view = await renderApis(
      createApi({ apiSlug: "BuiltinAI", apiType: OPT_TRANS_BUILTINAI })
    );

    expect(view.container.querySelector(".kt-api-runtime-options")).toBeNull();
    expect(
      Array.from(view.container.querySelectorAll(".MuiGrid-item")).filter(
        (item) => !item.firstElementChild && !item.textContent.trim()
      )
    ).toHaveLength(0);

    view.unmount();
  });

  test("keeps runtime options for APIs that support them", async () => {
    const view = await renderApis();

    expect(
      view.container.querySelector(".kt-api-runtime-options")
    ).not.toBeNull();

    view.unmount();
  });
});

describe("Apis model list", () => {
  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  test("loads model list once when model input is focused", async () => {
    fetchModelList.mockResolvedValue(["gpt-4o", "gpt-4.1"]);
    const view = await renderApis();
    const modelInput = getInput(view.container, "model");

    await act(async () => {
      Simulate.focus(modelInput);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      Simulate.focus(modelInput);
      await Promise.resolve();
    });

    expect(fetchModelList).toHaveBeenCalledTimes(1);
    expect(fetchModelList).toHaveBeenCalledWith({
      apiType: OPT_TRANS_OPENAI,
      modelListUrl: "https://api.openai.com/v1/models",
      key: "sk-test",
      httpTimeout: 30,
    });
    expect(modelInput.getAttribute("data-options")).toContain("gpt-4o");

    view.unmount();
  });

  test("does not load model list without url or key", async () => {
    const view = await renderApis(createApi({ key: "" }));
    const modelInput = getInput(view.container, "model");

    await act(async () => {
      Simulate.focus(modelInput);
      await Promise.resolve();
    });

    expect(fetchModelList).not.toHaveBeenCalled();

    view.unmount();
  });

  test("keeps manual model input saveable", async () => {
    const update = jest.fn();
    const view = await renderApis(createApi(), update);
    const modelInput = getInput(view.container, "model");

    await act(async () => {
      Simulate.change(modelInput, {
        target: {
          name: "model",
          value: "manual-model",
        },
      });
    });

    const saveButton = getSaveButton(view.container);
    await act(async () => {
      Simulate.click(saveButton);
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "manual-model",
      })
    );

    view.unmount();
  });

  test("shows fetch failure without clearing model", async () => {
    fetchModelList.mockRejectedValue(new Error("network failed"));
    const view = await renderApis();
    const modelInput = getInput(view.container, "model");

    await act(async () => {
      Simulate.focus(modelInput);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(modelInput.value).toBe("gpt-4");
    expect(modelInput.getAttribute("aria-invalid")).toBe("true");
    expect(view.container.textContent).toContain("model_list_fetch_failed");

    view.unmount();
  });

  test("resets model list error when url or key changes", async () => {
    fetchModelList.mockRejectedValue(new Error("network failed"));
    const view = await renderApis();
    const modelInput = getInput(view.container, "model");
    const modelListUrlInput = getInput(view.container, "modelListUrl");

    await act(async () => {
      Simulate.focus(modelInput);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(modelInput.getAttribute("aria-invalid")).toBe("true");
    expect(view.container.textContent).toContain("model_list_fetch_failed");

    await act(async () => {
      Simulate.change(modelListUrlInput, {
        target: {
          name: "modelListUrl",
          value: "https://api.openai.com/v1/models?fixed=1",
        },
      });
      await Promise.resolve();
    });

    expect(modelInput.getAttribute("aria-invalid")).toBe("false");
    expect(view.container.textContent).not.toContain("model_list_fetch_failed");

    view.unmount();
  });
});

describe("Apis list toggles", () => {
  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  test("keeps a selected API draft when its toggle is cancelled", async () => {
    const api = createApi();
    const view = await renderApis(api);
    const { disableApis } = useApiList.mock.results[0].value;
    const urlInput = getInput(view.container, "url");

    await act(async () => {
      Simulate.change(urlInput, {
        target: { name: "url", value: "https://draft.example/v1" },
      });
    });
    mockConfirm.mockResolvedValueOnce(false);

    await act(async () => {
      Simulate.change(getListToggle(view.container, api.apiName));
      await Promise.resolve();
    });

    expect(mockConfirm).toHaveBeenCalledWith({
      message: "This API has unsaved changes. Discard them?",
      confirmText: "discard_changes",
      cancelText: "cancel",
    });
    expect(disableApis).not.toHaveBeenCalled();
    expect(urlInput.value).toBe("https://draft.example/v1");
    expect(view.update).not.toHaveBeenCalled();

    view.unmount();
  });

  test("confirms before toggling another API and deliberately discards the draft", async () => {
    const selectedApi = createApi();
    const otherApi = createApi({
      apiSlug: "Other",
      apiName: "Other",
      isDisabled: true,
    });
    const view = await renderApis([selectedApi, otherApi]);
    const { enableApis } = useApiList.mock.results[0].value;
    const urlInput = getInput(view.container, "url");

    await act(async () => {
      Simulate.change(urlInput, {
        target: { name: "url", value: "https://draft.example/v1" },
      });
    });
    mockConfirm.mockResolvedValueOnce(true);

    await act(async () => {
      Simulate.change(getListToggle(view.container, otherApi.apiName));
      await Promise.resolve();
    });

    expect(enableApis).toHaveBeenCalledWith([otherApi.apiSlug]);
    expect(getInput(view.container, "url").value).toBe(selectedApi.url);
    expect(view.update).not.toHaveBeenCalled();

    view.unmount();
  });

  test("toggles immediately when the detail has no draft", async () => {
    const api = createApi();
    const view = await renderApis(api);
    const { disableApis } = useApiList.mock.results[0].value;

    await act(async () => {
      Simulate.change(getListToggle(view.container, api.apiName));
      await Promise.resolve();
    });

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(disableApis).toHaveBeenCalledWith([api.apiSlug]);

    view.unmount();
  });
});

describe("Apis unsaved detail guard", () => {
  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  test("keeps the draft and selection when switching APIs is cancelled", async () => {
    const selectedApi = createApi();
    const otherApi = createApi({
      apiSlug: "Other",
      apiName: "Other",
      url: "https://other.example/v1",
    });
    const view = await renderApis([selectedApi, otherApi]);
    const urlInput = await editUrlDraft(view.container);
    mockConfirm.mockResolvedValueOnce(false);

    await act(async () => {
      Simulate.click(getApiListItem(view.container, otherApi.apiName));
      await Promise.resolve();
    });

    expect(mockConfirm).toHaveBeenCalledWith({
      message: "This API has unsaved changes. Discard them?",
      confirmText: "discard_changes",
      cancelText: "cancel",
    });
    expect(urlInput.value).toBe("https://draft.example/v1");
    expect(getInput(view.container, "apiName").value).toBe(selectedApi.apiName);

    view.unmount();
  });

  test("switches APIs after the draft is deliberately discarded", async () => {
    const selectedApi = createApi();
    const otherApi = createApi({
      apiSlug: "Other",
      apiName: "Other",
      url: "https://other.example/v1",
    });
    const view = await renderApis([selectedApi, otherApi]);
    await editUrlDraft(view.container);
    mockConfirm.mockResolvedValueOnce(true);

    await act(async () => {
      Simulate.click(getApiListItem(view.container, otherApi.apiName));
      await Promise.resolve();
    });

    expect(getInput(view.container, "url").value).toBe(otherApi.url);
    expect(getInput(view.container, "apiName").value).toBe(otherApi.apiName);

    view.unmount();
  });

  test("does not sort APIs when discarding the draft is cancelled", async () => {
    const view = await renderApis();
    const { alphaSortApis } = useApiList.mock.results[0].value;
    const urlInput = await editUrlDraft(view.container);
    mockConfirm.mockResolvedValueOnce(false);

    await act(async () => {
      Simulate.click(getButton(view.container, "sort_alphabetically"));
      await Promise.resolve();
    });

    expect(alphaSortApis).not.toHaveBeenCalled();
    expect(urlInput.value).toBe("https://draft.example/v1");

    view.unmount();
  });

  test.each([
    ["pin_to_top", "pinApis"],
    ["enable", "enableApis"],
    ["disable", "disableApis"],
  ])(
    "does not run the %s bulk action when discarding the draft is cancelled",
    async (buttonLabel, actionName) => {
      const api = createApi();
      const view = await renderApis(api);
      const apiList = useApiList.mock.results[0].value;
      const urlInput = await editUrlDraft(view.container);

      await act(async () => {
        Simulate.click(getButton(view.container, "bulk_actions"));
      });
      await act(async () => {
        Simulate.change(getListToggle(view.container, api.apiName));
      });
      mockConfirm.mockResolvedValueOnce(false);

      await act(async () => {
        Simulate.click(getButton(view.container, buttonLabel));
        await Promise.resolve();
      });

      expect(apiList[actionName]).not.toHaveBeenCalled();
      expect(urlInput.value).toBe("https://draft.example/v1");

      view.unmount();
    }
  );

  test("does not add an API when discarding the draft is cancelled", async () => {
    const view = await renderApis();
    const { addApi } = useApiList.mock.results[0].value;
    const urlInput = await editUrlDraft(view.container);

    await act(async () => {
      Simulate.click(getButton(view.container, "add"));
    });
    const menuItem = Array.from(
      document.body.querySelectorAll('[role="menuitem"]')
    ).find((item) => item.textContent.trim() === OPT_TRANS_OPENAI);
    expect(menuItem).toBeDefined();
    mockConfirm.mockResolvedValueOnce(false);

    await act(async () => {
      Simulate.click(menuItem);
      await Promise.resolve();
    });

    expect(addApi).not.toHaveBeenCalled();
    expect(urlInput.value).toBe("https://draft.example/v1");

    view.unmount();
  });

  test("does not reorder APIs when discarding the draft is cancelled", async () => {
    const selectedApi = createApi();
    const otherApi = createApi({ apiSlug: "Other", apiName: "Other" });
    const view = await renderApis([selectedApi, otherApi]);
    const { reorderApis } = useApiList.mock.results[0].value;
    const urlInput = await editUrlDraft(view.container);
    const selectedItem = getApiListItem(view.container, selectedApi.apiName);
    const otherItem = getApiListItem(view.container, otherApi.apiName);
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: jest.fn(),
      getData: jest.fn(() => selectedApi.apiSlug),
    };

    await act(async () => {
      Simulate.dragStart(selectedItem.querySelector('[draggable="true"]'), {
        dataTransfer,
      });
    });
    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => {
      Simulate.drop(otherItem.closest("li"), { dataTransfer });
      await Promise.resolve();
    });

    expect(reorderApis).not.toHaveBeenCalled();
    expect(urlInput.value).toBe("https://draft.example/v1");

    view.unmount();
  });

  test("does not restore defaults when discarding the draft is cancelled", async () => {
    const view = await renderApis();
    const urlInput = await editUrlDraft(view.container);
    mockConfirm.mockResolvedValueOnce(false);

    await act(async () => {
      Simulate.click(getButton(view.container, "restore_default"));
      await Promise.resolve();
    });

    expect(view.reset).not.toHaveBeenCalled();
    expect(urlInput.value).toBe("https://draft.example/v1");

    view.unmount();
  });

  test("keeps the API draft when deletion is confirmed but discard is cancelled", async () => {
    const view = await renderApis();
    const { deleteApi } = useApiList.mock.results[0].value;
    const urlInput = await editUrlDraft(view.container);
    mockConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await act(async () => {
      Simulate.click(getButton(view.container, "delete"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(deleteApi).not.toHaveBeenCalled();
    expect(urlInput.value).toBe("https://draft.example/v1");

    view.unmount();
  });

  test("keeps the API draft when bulk deletion is confirmed but discard is cancelled", async () => {
    const api = createApi();
    const view = await renderApis(api);
    const { deleteApis } = useApiList.mock.results[0].value;
    const urlInput = await editUrlDraft(view.container);

    await act(async () => {
      Simulate.click(getButton(view.container, "bulk_actions"));
    });
    await act(async () => {
      Simulate.change(getListToggle(view.container, api.apiName));
    });
    mockConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await act(async () => {
      Simulate.click(getButton(view.container, "delete"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(deleteApis).not.toHaveBeenCalled();
    expect(urlInput.value).toBe("https://draft.example/v1");

    view.unmount();
  });
});
