import { getDefaultTranBoxView } from "./TranBox";

jest.mock("../../hooks/Setting", () => ({
  SettingProvider: ({ children }) => children,
}));
jest.mock("../../hooks/Theme", () => ({
  __esModule: true,
  default: ({ children }) => children,
}));
jest.mock("../../hooks/I18n", () => ({ useI18n: () => (key) => key }));
jest.mock("../../hooks/ColorMode", () => ({
  useDarkMode: () => ({ darkMode: "light", toggleDarkMode: jest.fn() }),
}));
jest.mock("../../libs/msg", () => ({ sendBgMsg: jest.fn() }));
jest.mock("../../libs/client", () => ({ isExt: false }));
jest.mock("./DraggableResizable", () => () => null);
jest.mock("./TranForm", () => () => null);

describe("getDefaultTranBoxView", () => {
  test("opens the dictionary for a word when translation is disabled", () => {
    expect(getDefaultTranBoxView("library", true)).toBe("dictionary");
  });

  test("opens translation for phrases and normal word translation", () => {
    expect(getDefaultTranBoxView("hello world", true)).toBe("translation");
    expect(getDefaultTranBoxView("library", false)).toBe("translation");
  });
});
