import { act } from "react";
import { createRoot } from "react-dom/client";
import { STOKEY_RULES } from "../config";
import { encodePath } from "../libs/fieldRevisions";
import { storage } from "../libs/storage";
import { useRules } from "./Rules";
import { useStorage } from "./Storage";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../libs/client", () => ({
  isExt: false,
  isGm: false,
  isWeb: true,
}));
jest.mock("../libs/browser", () => ({ isOptions: () => false }));
jest.mock("../libs/gm", () => ({ getGmMethod: jest.fn() }));
jest.mock("../libs/sync", () => ({ syncData: jest.fn() }));
jest.mock("../libs/subRules", () => ({ loadOrFetchSubRules: jest.fn() }));

const initialRules = [
  { pattern: "first.example", selector: "p", enabled: true },
  { pattern: "second.example", selector: "article", enabled: true },
  { pattern: "*", selector: "p" },
];
const emptyList = [];
const listKey = "root-array-regression";

function useRootList() {
  return useStorage(listKey, emptyList);
}

function createHookHost(useValue) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let value;
  let mounted = true;

  function Probe() {
    value = useValue();
    return null;
  }

  return {
    get value() {
      return value;
    },
    async render() {
      await act(async () => root.render(<Probe />));
    },
    unmount() {
      if (!mounted) return;
      act(() => root.unmount());
      container.remove();
      mounted = false;
    },
  };
}

describe("rule arrays in real storage", () => {
  let hosts;

  async function mountHook(useValue = useRules) {
    const host = createHookHost(useValue);
    hosts.push(host);
    await host.render();
    expect(host.value.isLoading).toBe(false);
    return host;
  }

  beforeEach(async () => {
    hosts = [];
    jest.useFakeTimers();
    localStorage.clear();
    await storage.setObj(STOKEY_RULES, initialRules);
  });

  afterEach(() => {
    hosts.forEach((host) => host.unmount());
    jest.clearAllTimers();
    jest.useRealTimers();
    localStorage.clear();
  });

  test.each([
    {
      operation: "editing",
      update: (rules) => rules.put("first.example", { selector: "main" }),
      expected: [
        { ...initialRules[0], selector: "main" },
        ...initialRules.slice(1),
      ],
    },
    {
      operation: "adding",
      update: (rules) => rules.add({ pattern: "new.example", selector: "div" }),
      expected: [{ pattern: "new.example", selector: "div" }, ...initialRules],
    },
    {
      operation: "deleting",
      update: (rules) => rules.del("first.example"),
      expected: initialRules.slice(1),
    },
    {
      operation: "clearing",
      update: (rules) => rules.clear(),
      expected: [initialRules[2]],
    },
  ])(
    "persists $operation rules across remounts",
    async ({ update, expected }) => {
      const host = await mountHook();

      await act(async () => update(host.value));

      expect(host.value.list).toEqual(expected);
      expect(await storage.getObj(STOKEY_RULES)).toEqual(expected);
      const revisions = await storage.getFieldRevisions(STOKEY_RULES);
      expect(revisions[encodePath([])]).toEqual([1, expect.any(String)]);

      host.unmount();
      const reloaded = await mountHook();
      expect(reloaded.value.list).toEqual(expected);
    }
  );

  test("persists an empty root array across remounts", async () => {
    await storage.setObj(listKey, [{ value: "original" }]);
    const host = await mountHook(useRootList);

    await act(async () => host.value.save([]));

    expect(await storage.getObj(listKey)).toEqual([]);
    host.unmount();
    const reloaded = await mountHook(useRootList);
    expect(reloaded.value.data).toEqual([]);
  });

  test.each([{ value: [] }, { value: [{ value: "saved" }] }])(
    "repairs a stale root array in storage",
    async ({ value }) => {
      const original = [{ value: "original" }];
      await storage.setObj(listKey, original);
      const host = await mountHook(useRootList);
      await act(async () => host.value.save(value));
      expect(await storage.getObj(listKey)).toEqual(value);

      // A stale foreign snapshot also loses the revision of our completed write.
      await act(async () => {
        await storage.clearFieldRevisions(listKey);
        await storage.setObj(listKey, original);
      });

      expect(await storage.getObj(listKey)).toEqual(value);
      host.unmount();
      const reloaded = await mountHook(useRootList);
      expect(reloaded.value.data).toEqual(value);
    }
  );

  test("accepts a newer root array from another writer", async () => {
    await storage.setObj(listKey, [{ value: "original" }]);
    const host = await mountHook(useRootList);
    await act(async () => host.value.save([{ value: "local" }]));
    const newer = [{ value: "newer" }];

    await act(async () => storage.patchObj(listKey, newer));

    expect(await storage.getObj(listKey)).toEqual(newer);
    expect(host.value.data).toEqual(newer);
  });
});
