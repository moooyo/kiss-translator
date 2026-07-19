import { act } from "react";
import { createRoot } from "react-dom/client";
import OverviewHero from "./OverviewHero";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockUpdateSetting = jest.fn();

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

describe("OverviewHero", () => {
  test("renders the global rule and actual command shortcuts", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => root.render(<OverviewHero />));

    expect(container.textContent).toContain("Microsoft");
    expect(container.textContent).not.toContain("BuiltinAI");
    expect(container.textContent).toContain("Ctrl");

    act(() => root.unmount());
  });
});
