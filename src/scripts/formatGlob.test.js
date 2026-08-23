import fs from "fs";
import path from "path";

/**
 * `format` 和 `format:check` 必须覆盖同一批文件。
 *
 * 这是有前科的:format 的 glob 长期是 `**\/*.{js,json,html}`,不含 `.mjs` ——
 * 于是 build-task / sync-version / update-version 三个发布脚本从来没有被格式化过,
 * 每次有人跑 `pnpm format` 都会冒出一堆无关 diff,而 CI 里没有任何东西发现得了。
 *
 * 现在 CI 走 `format:check`。两条脚本各写一份 glob 就又成了双写:
 * 只加宽 `format` 而漏了 `format:check`,新纳入的文件照样没人管;
 * 只加宽 `format:check` 会让 CI 红在一个 `pnpm format` 修不好的文件上。
 */
test("format and format:check cover the same files", () => {
  const { scripts } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8")
  );

  const globOf = (script) => {
    const match = String(script ?? "").match(/"([^"]+)"/);
    return match?.[1];
  };

  const writeGlob = globOf(scripts.format);
  const checkGlob = globOf(scripts["format:check"]);

  // 取不到就说明脚本写法变了,这条测试已经在空跑 —— 必须当失败处理。
  expect(writeGlob).toBeTruthy();
  expect(checkGlob).toBe(writeGlob);

  expect(scripts.format).toContain("--write");
  expect(scripts["format:check"]).toContain("--check");

  // .mjs 是当初漏掉的那一个,单独钉住,免得再被摘出去。
  expect(writeGlob).toContain("mjs");
});
