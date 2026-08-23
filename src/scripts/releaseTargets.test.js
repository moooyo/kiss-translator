import fs from "fs";
import path from "path";
import {
  RELEASE_TARGET_NAMES,
  getArchiveTasks,
  parseWorkflowMatrixClients,
} from "./releaseTargets.mjs";

/**
 * 发布渠道原本写在两处：archive.mjs 打哪些 zip、release.yml 的 matrix.client
 * 上传哪些 zip。两处必须一致，但谁也不校验谁。
 *
 * 危险的方向是单向的：只往打包侧加一个渠道，zip 会照常打出来却永远不会被上传 ——
 * 发布里静默少一个包，CI 全绿、release 页面看起来也正常。（反过来只加 matrix
 * 会让 upload-release-asset 找不到 asset_path 当场报错，那反而是安全的。）
 *
 * archive.mjs 现在直接读 releaseTargets.mjs；YAML 写不了 import，所以由这条
 * 测试把 matrix 钉在同一份清单上。
 */
describe("release targets stay single-sourced", () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, "..", "..", ".github", "workflows", "release.yml"),
    "utf8"
  );

  test("release.yml uploads exactly the declared targets", () => {
    const clients = parseWorkflowMatrixClients(workflow);

    // 解析不到就说明 matrix 的写法变了，这条测试已经在空跑 —— 必须当失败处理，
    // 否则它会安静地一直绿下去，而漂移照样发生。
    expect(clients).not.toBeNull();

    // 比成员而不是比顺序：matrix 里每个 client 是各自独立的一次 job，
    // 谁先谁后没有语义。钉死顺序只会让一次纯粹的可读性调整无端变红。
    expect([...clients].sort()).toEqual([...RELEASE_TARGET_NAMES].sort());
  });

  test("every declared target is packed into a zip of its own name", () => {
    const outputs = getArchiveTasks().map(({ output }) =>
      path.posix.basename(output)
    );

    expect(outputs).toEqual(RELEASE_TARGET_NAMES.map((name) => `${name}.zip`));
  });

  // release.yml 是按 ./build/<client>.zip 取文件的，所以打包侧的落点必须是
  // build/ 根部。flat 的那两个从子目录里打包，输出要写回上一级。
  test("flat targets write their zip back up into build/", () => {
    const flat = getArchiveTasks().filter((task) => task.cwd);

    expect(flat.map((task) => task.cwd)).toEqual(["firefox", "thunderbird"]);
    flat.forEach((task) => {
      expect(task.output.startsWith("../")).toBe(true);
      expect(task.source).toBe("*");
    });
  });

  test("the target list has no duplicates", () => {
    expect(new Set(RELEASE_TARGET_NAMES).size).toBe(
      RELEASE_TARGET_NAMES.length
    );
  });
});
