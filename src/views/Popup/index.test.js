import { act } from "react";
import { createRoot } from "react-dom/client";
import { useSetting } from "../../hooks/Setting";
import { readClipboardTextIfAllowed } from "../../libs/clipboard";
import { Trantab } from ".";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../hooks/Setting", () => ({ useSetting: jest.fn() }));
jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key) => key,
}));
jest.mock("../../libs/client", () => ({
  isAutoTranslateClipboardSupported: true,
}));
jest.mock("../../libs/clipboard", () => ({
  readClipboardTextIfAllowed: jest.fn(),
}));
jest.mock("../../libs/browser", () => ({
  browser: {
    storage: {
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
  },
}));
jest.mock("./PopupCont", () => () => null);
jest.mock("./Header", () => () => null);
jest.mock("../Selection/TranForm", () => {
  const React = require("react");
  return ({ text, autoFocusInput, syncExternalTextWhileEditing }) =>
    React.createElement(
      "div",
      {
        "data-testid": "tran-form",
        "data-auto-focus": String(autoFocusInput),
        "data-sync-external": String(syncExternalTextWhileEditing),
      },
      text
    );
});

const setting = {
  autoTranslateClipboard: true,
  tranboxSetting: {
    enDict: "-",
    enSug: "-",
    apiSlugs: [],
    fromLang: "auto",
    toLang: "zh-CN",
    toLang2: "en",
    aiDictApiSlug: "-",
    aiDictPromptSlug: "-",
  },
  transApis: [],
  langDetector: "-",
  prompts: [],
  subtitleSetting: {},
  translateVariants: true,
};

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderTrantab(props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Trantab {...props} />));
  return {
    container,
    root,
    rerender: (nextProps = props) => {
      act(() => root.render(<Trantab {...nextProps} />));
    },
  };
}

describe("Trantab clipboard translation", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    readClipboardTextIfAllowed.mockReset();
    useSetting.mockReturnValue({ setting });
  });

  test("loads clipboard text when the panel opens", async () => {
    readClipboardTextIfAllowed.mockResolvedValue("  clipboard text  ");
    const { container, root } = renderTrantab();
    await flushEffects();

    expect(readClipboardTextIfAllowed).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-testid="tran-form"]').textContent
    ).toBe("clipboard text");
    expect(
      container.querySelector('[data-testid="tran-form"]').dataset.autoFocus
    ).toBe("false");
    expect(
      container.querySelector('[data-testid="tran-form"]').dataset.syncExternal
    ).toBe("true");
    act(() => root.unmount());
  });

  test.each([null, "   "])(
    "allows input focus when the initial clipboard result is %p",
    async (clipboardText) => {
      readClipboardTextIfAllowed.mockResolvedValue(clipboardText);
      const { container, root } = renderTrantab();
      await flushEffects();

      expect(
        container.querySelector('[data-testid="tran-form"]').dataset.autoFocus
      ).toBe("true");
      act(() => root.unmount());
    }
  );

  test("loads changed clipboard text when a separate window regains focus", async () => {
    readClipboardTextIfAllowed
      .mockResolvedValueOnce("first")
      .mockResolvedValue("second");
    const { container, root } = renderTrantab({ isSeparate: true });
    await flushEffects();

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushEffects();

    expect(readClipboardTextIfAllowed).toHaveBeenCalledTimes(2);
    expect(
      container.querySelector('[data-testid="tran-form"]').textContent
    ).toBe("second");
    act(() => root.unmount());
  });

  test("does not read when the setting is disabled", async () => {
    useSetting.mockReturnValue({
      setting: { ...setting, autoTranslateClipboard: false },
    });
    const { root } = renderTrantab();
    await flushEffects();

    expect(readClipboardTextIfAllowed).not.toHaveBeenCalled();
    expect(
      document.querySelector('[data-testid="tran-form"]').dataset.autoFocus
    ).toBe("true");
    act(() => root.unmount());
  });

  test("reacts to the setting being enabled in another extension page", async () => {
    useSetting.mockReturnValue({
      setting: { ...setting, autoTranslateClipboard: false },
    });
    readClipboardTextIfAllowed.mockResolvedValue("new clipboard text");
    const { container, root, rerender } = renderTrantab({ isSeparate: true });
    await flushEffects();
    expect(readClipboardTextIfAllowed).not.toHaveBeenCalled();

    // 另一个扩展页面改了设置：storage 订阅把新值送进 SettingProvider，
    // 组件从 useSetting 读到它并重新渲染。这是跨上下文变更真实走的路径 ——
    // 此前这里手工喂给 chrome.storage.onChanged 一个对象载荷，
    // 而 setObj 存的是 JSON 字符串，那种事件在生产中不会出现。
    useSetting.mockReturnValue({
      setting: { ...setting, autoTranslateClipboard: true },
    });
    await act(async () => {
      rerender({ isSeparate: true });
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushEffects();

    expect(readClipboardTextIfAllowed).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-testid="tran-form"]').textContent
    ).toBe("new clipboard text");
    act(() => root.unmount());
  });
});
