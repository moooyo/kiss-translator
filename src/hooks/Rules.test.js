import { patchRuleList } from "./Rules";

jest.mock("./Storage", () => ({ useStorage: jest.fn() }));
jest.mock("../libs/rules", () => ({ checkRules: jest.fn((rules) => rules) }));
jest.mock("../libs/storage", () => ({
  storage: {},
  debounceSyncMeta: jest.fn(),
}));
jest.mock("../libs/sync", () => ({ syncData: jest.fn() }));

describe("patchRuleList", () => {
  test("patches only the selected rule", () => {
    const rules = [
      { pattern: "*", hasRichText: "false" },
      { pattern: "example.com", hasRichText: "true" },
    ];

    expect(patchRuleList(rules, "*", { hasRichText: "true" })).toEqual([
      { pattern: "*", hasRichText: "true" },
      { pattern: "example.com", hasRichText: "true" },
    ]);
  });
});
