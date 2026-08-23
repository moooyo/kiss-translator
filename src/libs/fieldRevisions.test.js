import {
  bumpRevisions,
  buildReplayPatch,
  collectPatchPaths,
  compareRevisions,
  decodePath,
  encodePath,
  findRegressedPaths,
} from "./fieldRevisions";
import { SETTING_PATCH_DELETE } from "./settingPatch";

describe("patch path collection", () => {
  test("lists every leaf a patch touches", () => {
    const paths = collectPatchPaths({
      alpha: 1,
      nested: { beta: 2, deeper: { gamma: 3 } },
    });

    expect(paths.sort()).toEqual(
      [
        encodePath(["alpha"]),
        encodePath(["nested", "beta"]),
        encodePath(["nested", "deeper", "gamma"]),
      ].sort()
    );
  });

  // 删除同样是一次改动。不给它一个更高的戳，「A 删掉某字段、B 用旧快照把它
  // 写回来」这种覆盖就检测不到。
  test("treats a delete as a touched leaf", () => {
    expect(collectPatchPaths({ alpha: SETTING_PATCH_DELETE })).toEqual([
      encodePath(["alpha"]),
    ]);
  });

  test("treats an array value as a single leaf", () => {
    expect(collectPatchPaths({ list: [1, 2, 3] })).toEqual([
      encodePath(["list"]),
    ]);
  });

  // 设置里的键名可能带点号（提示词 slug 之类），用点号拼路径会产生歧义。
  test("keeps dotted key names unambiguous", () => {
    const dotted = collectPatchPaths({ "a.b": { c: 1 } });
    const nested = collectPatchPaths({ a: { b: { c: 1 } } });

    expect(dotted).not.toEqual(nested);
    expect(decodePath(dotted[0])).toEqual(["a.b", "c"]);
  });

  test("survives a round trip through encode and decode", () => {
    expect(decodePath(encodePath(["a", "b.c", "d"]))).toEqual([
      "a",
      "b.c",
      "d",
    ]);
    expect(decodePath("not json")).toBeNull();
  });
});

describe("revision comparison", () => {
  test("orders by counter first", () => {
    expect(compareRevisions([2, "a"], [1, "z"])).toBeGreaterThan(0);
    expect(compareRevisions([1, "z"], [2, "a"])).toBeLessThan(0);
  });

  // 只比 counter 不够：两个 realm 各自把 3 推到 4，谁也看不出对方覆盖了自己。
  test("breaks counter ties on realm id", () => {
    expect(compareRevisions([4, "b"], [4, "a"])).toBeGreaterThan(0);
    expect(compareRevisions([4, "a"], [4, "b"])).toBeLessThan(0);
    expect(compareRevisions([4, "a"], [4, "a"])).toBe(0);
  });

  test("treats a missing revision as the oldest", () => {
    expect(compareRevisions(undefined, [1, "a"])).toBeLessThan(0);
    expect(compareRevisions([1, "a"], undefined)).toBeGreaterThan(0);
    expect(compareRevisions(undefined, undefined)).toBe(0);
  });
});

describe("regression detection", () => {
  const alpha = encodePath(["alpha"]);
  const beta = encodePath(["beta"]);

  test("flags a field whose stored revision went backwards", () => {
    expect(
      findRegressedPaths({ [alpha]: [1, "a"] }, { [alpha]: [2, "a"] })
    ).toEqual([alpha]);
  });

  test("ignores a field that still carries my revision", () => {
    expect(
      findRegressedPaths({ [alpha]: [2, "a"] }, { [alpha]: [2, "a"] })
    ).toEqual([]);
  });

  // 别人在我之后做了真正的修改，戳会更高。那是正常的后来者获胜，
  // 回滚它就等于复活用户刚在另一个标签页改掉的设置。
  test("never rolls back a genuinely newer write", () => {
    expect(
      findRegressedPaths({ [alpha]: [3, "b"] }, { [alpha]: [2, "a"] })
    ).toEqual([]);
  });

  test("flags a field the other realm dropped entirely", () => {
    expect(findRegressedPaths({}, { [alpha]: [1, "a"] })).toEqual([alpha]);
  });

  test("checks each field independently", () => {
    expect(
      findRegressedPaths(
        { [alpha]: [1, "a"], [beta]: [5, "b"] },
        { [alpha]: [2, "a"], [beta]: [2, "a"] }
      )
    ).toEqual([alpha]);
  });
});

describe("replay patch construction", () => {
  test("rebuilds a nested patch from the value I wrote", () => {
    const patch = buildReplayPatch(
      { nested: { beta: 2, other: 9 }, alpha: 1 },
      [encodePath(["nested", "beta"])]
    );

    expect(patch).toEqual({ nested: { beta: 2 } });
  });

  // 原本那次写入就是一次删除，重放也必须重放成删除，否则字段会被复活。
  test("replays a vanished path as a delete", () => {
    expect(buildReplayPatch({}, [encodePath(["alpha"])])).toEqual({
      alpha: SETTING_PATCH_DELETE,
    });
  });

  test("returns nothing when there is nothing to replay", () => {
    expect(buildReplayPatch({ alpha: 1 }, [])).toBeUndefined();
  });

  test("merges several paths into one patch", () => {
    expect(
      buildReplayPatch({ a: { b: 1, c: 2 } }, [
        encodePath(["a", "b"]),
        encodePath(["a", "c"]),
      ])
    ).toEqual({ a: { b: 1, c: 2 } });
  });
});

describe("revision bumping", () => {
  const alpha = encodePath(["alpha"]);

  test("raises the counter and records the writing realm", () => {
    expect(bumpRevisions({ [alpha]: [1, "a"] }, [alpha], "b")).toEqual({
      [alpha]: [2, "b"],
    });
  });

  test("starts from one for a field nobody has stamped", () => {
    expect(bumpRevisions({}, [alpha], "a")).toEqual({ [alpha]: [1, "a"] });
  });

  test("leaves untouched fields alone", () => {
    const beta = encodePath(["beta"]);
    expect(bumpRevisions({ [beta]: [7, "z"] }, [alpha], "a")).toEqual({
      [alpha]: [1, "a"],
      [beta]: [7, "z"],
    });
  });
});
