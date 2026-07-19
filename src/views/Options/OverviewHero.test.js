import { act } from "react";
import { createRoot } from "react-dom/client";
import OverviewHero from "./OverviewHero";
import { MSG_RUNTIME_SETTING_PATCH } from "../../config";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockUpdateSetting = jest.fn();
const mockSendBgMsg = jest.fn();
let mockIsExt = false;

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key) => key,
}));
jest.mock("../../hooks/Setting", () => ({
  useSetting: () => ({
    setting: {
      extensionEnabled: true,
      transApis: [
        { apiSlug: "BuiltinAI", apiName: "BuiltinAI" },
        { apiSlug: "Microsoft", apiName: "Microsoft" },
      ],
    },
    updateSetting: mockUpdateSetting,
  }),
}));
jest.mock("../../hooks/Rules", () => ({
  useRules: () => ({
    list: [
      {
        pattern: "*",
        apiSlug: "Microsoft",
        fromLang: "auto",
        toLang: "zh-CN",
      },
    ],
  }),
}));
jest.mock("../../hooks/Commands", () => ({
  useOverviewShortcuts: () => ({
    page: ["Ctrl", "Q"],
    popup: ["Ctrl", "K"],
    style: ["Ctrl", "C"],
    selection: ["Ctrl", "S"],
    input: ["Ctrl", "I"],
    settings: ["Ctrl", "O"],
  }),
}));
jest.mock("../../libs/client", () => ({
  get isExt() {
    return mockIsExt;
  },
}));
jest.mock("../../libs/msg", () => ({
  sendBgMsg: (...args) => mockSendBgMsg(...args),
}));

describe("OverviewHero", () => {
  beforeEach(() => {
    mockIsExt = false;
    mockUpdateSetting.mockClear();
    mockSendBgMsg.mockReset();
    mockSendBgMsg.mockResolvedValue(undefined);
  });

  test("renders the global rule and actual command shortcuts", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => root.render(<OverviewHero />));

    expect(container.textContent).toContain("Microsoft");
    expect(container.textContent).not.toContain("BuiltinAI");
    expect(container.textContent).toContain("Ctrl");

    act(() => root.unmount());
  });

  test("uses the background as the only extension setting writer", async () => {
    mockIsExt = true;
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => root.render(<OverviewHero />));
    const switchInput = container.querySelector('input[type="checkbox"]');
    await act(async () => {
      switchInput.click();
      await Promise.resolve();
    });

    expect(mockSendBgMsg).toHaveBeenCalledWith(MSG_RUNTIME_SETTING_PATCH, {
      scope: "all",
      patch: { extensionEnabled: false },
    });
    expect(mockUpdateSetting).not.toHaveBeenCalled();

    act(() => root.unmount());
  });
});
