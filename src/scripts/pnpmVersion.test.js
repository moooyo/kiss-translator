import fs from "fs";
import path from "path";

/**
 * pnpm 版本在仓库里有两处记录：package.json 的 packageManager（权威，
 * pnpm/action-setup 与 corepack 都读它）和 .pnpm-version（目前没有任何
 * 代码或工作流读取）。
 *
 * 版本本身是有要求的：pnpm 10+ 不再读 package.json 的 pnpm.overrides，
 * 会把 pnpm-lock.yaml 里的 overrides 块整个删掉 —— 那是针对 CVE-2026-54466
 * 的三个 pin（fast-xml-parser / shell-quote / websocket-driver）。
 *
 * 这条测试不判断哪个对，只保证两处不会各说各话：升级时漏改一处会当场变红，
 * 而不是等到某个读 .pnpm-version 的工具装出另一个版本才发现。
 */
test("the pnpm version is recorded consistently", () => {
  const root = path.join(__dirname, "..", "..");
  const { packageManager } = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  );

  expect(packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
  const declared = packageManager.slice("pnpm@".length);

  const pinned = fs
    .readFileSync(path.join(root, ".pnpm-version"), "utf8")
    .trim();

  expect(pinned).toBe(declared);
});
