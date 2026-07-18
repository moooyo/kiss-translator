import { formatShortcutKey } from "./ShortcutInput";

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key) => key,
}));

describe("formatShortcutKey", () => {
  test.each([
    ["ControlLeft", "Ctrl"],
    ["AltRight", "Alt"],
    ["KeyI", "I"],
    ["Digit3", "3"],
    [" ", "Space"],
  ])("formats %s as %s", (key, label) => {
    expect(formatShortcutKey(key)).toBe(label);
  });
});
