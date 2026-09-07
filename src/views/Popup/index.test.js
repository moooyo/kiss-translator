import { browser } from "../../libs/browser";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useSetting } from "../../hooks/Setting";
import { readClipboardTextIfAllowed } from "../../libs/clipboard";
import { sendBgMsg } from "../../libs/msg";
import { MSG_FIT_SEPARATE_WINDOW } from "../../config";
import { SEPARATE_WINDOW_CONTENT_WIDTH } from "../../config/app";
import { Trantab } from ".";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let mockIsFirefox = false;

jest.mock("../../hooks/Setting", () => ({ useSetting: jest.fn() }));
jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key) => key,
}));
jest.mock("../../libs/client", () => ({
  isAutoTranslateClipboardSupported: true,
  get isFirefox() {
    return mockIsFirefox;
  },
}));
jest.mock("../../libs/clipboard", () => ({
  readClipboardTextIfAllowed: jest.fn(),
}));
jest.mock("../../libs/browser", () => ({
  browser: {
    windows: {
      getCurrent: jest.fn(),
    },
    tabs: {
      getCurrent: jest.fn(),
      getZoom: jest.fn(),
    },
    storage: {
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
  },
}));
jest.mock("../../libs/msg", () => ({ sendBgMsg: jest.fn() }));
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

// 独立窗口的高度编译期算不准 —— 界面语言、浏览器缩放、系统字号都会改变它。
// 所以窗口先按起手值打开,内容渲染完页面量一遍再让后台收到刚好。
describe("separate window auto-fit", () => {
  let container;
  let root;
  let rafCallbacks;
  let originalRaf;

  const setWindowMetric = (name, value) =>
    Object.defineProperty(window, name, {
      configurable: true,
      writable: true,
      value,
    });

  beforeEach(() => {
    sendBgMsg.mockClear();
    mockIsFirefox = false;
    browser.windows.getCurrent.mockResolvedValue({ width: 760, height: 800 });
    browser.tabs.getCurrent.mockResolvedValue({ id: 7 });
    browser.tabs.getZoom.mockResolvedValue(1);
    Object.defineProperty(window.screen, "availWidth", {
      configurable: true,
      value: 2560,
    });
    Object.defineProperty(window.screen, "availHeight", {
      configurable: true,
      value: 1440,
    });
    useSetting.mockReturnValue({ setting });
    readClipboardTextIfAllowed.mockResolvedValue(null);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    // 先把 rAF 的回调攒起来:面板要先渲染出来,才能给它设 scrollHeight
    rafCallbacks = [];
    originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    };

    setWindowMetric("outerHeight", 800);
    setWindowMetric("innerHeight", 760); // 标题栏 + 边框 = 40
    setWindowMetric("outerWidth", 760);
    setWindowMetric("innerWidth", 744); // 左右边框 = 16
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRaf;
    act(() => root.unmount());
    document.body.innerHTML = "";
  });

  const renderAndMeasure = async (panelHeight) => {
    await act(async () => {
      root.render(<Trantab isSeparate />);
      await Promise.resolve();
    });
    const panel = container.querySelector(".kt-popup-text-panel");
    if (panel && panelHeight !== undefined) {
      Object.defineProperty(panel, "scrollHeight", {
        configurable: true,
        value: panelHeight,
      });
    }
    act(() => rafCallbacks.forEach((callback) => callback()));
  };

  test("asks the background to fit the measured content height", async () => {
    await renderAndMeasure(612);

    expect(sendBgMsg).toHaveBeenCalledTimes(1);
    const [action, args] = sendBgMsg.mock.calls[0];
    expect(action).toBe(MSG_FIT_SEPARATE_WINDOW);
    // 内容 612 + 窗口边框 40
    expect(args.height).toBe(652);
  });

  test("keeps width at the design cap rather than measuring it", async () => {
    await renderAndMeasure(612);

    // 宽度不测:超过上限只会让一行文字长到扫不过来。加的是左右边框。
    expect(sendBgMsg.mock.calls[0][1].width).toBe(
      SEPARATE_WINDOW_CONTENT_WIDTH + 16
    );
  });

  test.each([0.8, 1.5, 2])(
    "fits screen dimensions at tab zoom %s",
    async (zoom) => {
      browser.tabs.getZoom.mockResolvedValue(zoom);
      setWindowMetric("innerWidth", 744 / zoom);
      setWindowMetric("innerHeight", 760 / zoom);
      // DOM outer dimensions differ across browsers and must not affect fitting.
      setWindowMetric("outerWidth", 760 / zoom);
      setWindowMetric("outerHeight", 800 / zoom);

      await renderAndMeasure(612);

      expect(browser.tabs.getZoom).toHaveBeenCalledWith(7);
      expect(sendBgMsg).toHaveBeenCalledWith(
        MSG_FIT_SEPARATE_WINDOW,
        expect.objectContaining({
          width: Math.round(SEPARATE_WINDOW_CONTENT_WIDTH * zoom + 16),
          height: Math.ceil(612 * zoom + 40),
        })
      );
    }
  );

  test("converts Gecko screen limits from layout pixels", async () => {
    mockIsFirefox = true;
    browser.tabs.getZoom.mockResolvedValue(2);
    setWindowMetric("innerWidth", 372);
    setWindowMetric("innerHeight", 380);
    setWindowMetric("outerWidth", 380);
    setWindowMetric("outerHeight", 400);
    Object.defineProperty(window.screen, "availWidth", {
      configurable: true,
      value: 960,
    });
    Object.defineProperty(window.screen, "availHeight", {
      configurable: true,
      value: 600,
    });

    Object.defineProperty(window.screen, "availLeft", {
      configurable: true,
      value: -640,
    });
    Object.defineProperty(window.screen, "availTop", {
      configurable: true,
      value: -360,
    });
    await renderAndMeasure(430);

    expect(sendBgMsg).toHaveBeenCalledWith(
      MSG_FIT_SEPARATE_WINDOW,
      expect.objectContaining({
        width: 1456,
        height: 900,
        availWidth: 1920,
        availHeight: 1200,
        availLeft: -1280,
        availTop: -720,
      })
    );
  });

  test("does not apply Gecko text-only zoom twice", async () => {
    mockIsFirefox = true;
    browser.tabs.getZoom.mockResolvedValue(2);
    await renderAndMeasure(900);

    expect(sendBgMsg).toHaveBeenCalledWith(
      MSG_FIT_SEPARATE_WINDOW,
      expect.objectContaining({
        width: 736,
        height: 940,
        availWidth: 2560,
        availHeight: 1440,
      })
    );
  });
  test("measures wrapping at the final width and restores inline styles", async () => {
    browser.tabs.getZoom.mockResolvedValue(2);
    setWindowMetric("innerWidth", 372);
    setWindowMetric("innerHeight", 380);
    Object.defineProperty(window.screen, "availWidth", {
      configurable: true,
      value: 1000,
    });
    await act(async () => root.render(<Trantab isSeparate />));
    const panel = container.querySelector(".kt-popup-text-panel");
    panel.style.setProperty("width", "300px", "important");
    Object.defineProperty(panel, "scrollHeight", {
      configurable: true,
      get: () => (panel.style.width === "472px" ? 500 : 700),
    });

    act(() => rafCallbacks.forEach((callback) => callback()));

    expect(sendBgMsg).toHaveBeenCalledWith(
      MSG_FIT_SEPARATE_WINDOW,
      expect.objectContaining({ width: 960, height: 1040 })
    );
    expect(panel.style.width).toBe("300px");
    expect(panel.style.getPropertyPriority("width")).toBe("important");
  });

  test("does not fit after unmounting while the zoom request is pending", async () => {
    let resolveZoom;
    browser.tabs.getZoom.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveZoom = resolve;
      })
    );
    await act(async () => root.render(<Trantab isSeparate />));
    act(() => root.render(null));
    await act(async () => resolveZoom(2));
    act(() => rafCallbacks.forEach((callback) => callback()));

    expect(sendBgMsg).not.toHaveBeenCalled();
  });

  test("preserves the default size when the zoom API fails", async () => {
    browser.tabs.getZoom.mockRejectedValueOnce(
      new Error("Zoom is unavailable")
    );
    await renderAndMeasure(612);

    expect(sendBgMsg).not.toHaveBeenCalled();
  });
  test("does not measure the ordinary popup", async () => {
    await act(async () => {
      root.render(<Trantab />);
      await Promise.resolve();
    });
    act(() => rafCallbacks.forEach((callback) => callback()));

    expect(sendBgMsg).not.toHaveBeenCalled();
  });

  test("waits for the settings before measuring", async () => {
    // 设置没加载完时渲染的是固定高的加载态,这时候量会把窗口收成一条缝
    useSetting.mockReturnValue({ setting: null });
    await act(async () => {
      root.render(<Trantab isSeparate />);
      await Promise.resolve();
    });
    act(() => rafCallbacks.forEach((callback) => callback()));

    expect(sendBgMsg).not.toHaveBeenCalled();
  });
});
