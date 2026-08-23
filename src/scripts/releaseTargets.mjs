/**
 * @file releaseTargets.mjs
 * @description 发布渠道的唯一来源。
 *
 * 这份清单原本写在两处：archive.mjs 的 tasks[] 决定打出哪些 zip，
 * .github/workflows/release.yml 的 matrix.client 决定上传哪些 zip。
 * 两处必须一致，但谁也不校验谁 —— 只往 archive.mjs 里加一个 target，
 * zip 会照常打出来却永远不会被上传，**发布里静默少一个渠道**，
 * 而 CI 全绿、release 页面看起来也正常。
 *
 * archive.mjs 直接读这里；release.yml 的 matrix 是 YAML 写不了 import，
 * 由 releaseTargets.test.js 把它钉在这份清单上，漂移会在 CI 当场变红。
 *
 * flat: true 表示打包目录内容而不是目录本身（Firefox / Thunderbird 要求
 * manifest.json 位于压缩包根部，多一层目录会被商店拒绝）。
 */
export const RELEASE_TARGETS = Object.freeze([
  Object.freeze({ name: "chrome", flat: false }),
  Object.freeze({ name: "edge", flat: false }),
  Object.freeze({ name: "userscript", flat: false }),
  Object.freeze({ name: "firefox", flat: true }),
  Object.freeze({ name: "thunderbird", flat: true }),
]);

export const RELEASE_TARGET_NAMES = Object.freeze(
  RELEASE_TARGETS.map(({ name }) => name)
);

/**
 * 把渠道清单展开成 archive.mjs 要执行的打包任务。
 *
 * @returns {Array<{output: string, source: string, cwd?: string}>} 打包任务列表
 */
export function getArchiveTasks() {
  return RELEASE_TARGETS.map(({ name, flat }) =>
    flat
      ? // 进到子目录里打包 *，输出写回上一级的 build/
        { output: `../${name}.zip`, source: "*", cwd: name }
      : { output: `${name}.zip`, source: name }
  );
}

/**
 * 从 release.yml 的文本里取出 upload-release 那个 job 的 matrix.client。
 *
 * 放在这里而不是测试文件里，是为了让「清单长什么样」和「怎么从工作流里读它」
 * 待在一起 —— 改了 YAML 结构就会同时看到这个解析器。
 *
 * @param {string} workflow release.yml 的完整文本
 * @returns {string[]|null} 解析出的渠道名列表，解析不到时返回 null
 */
export function parseWorkflowMatrixClients(workflow) {
  const match = String(workflow).match(/client:\s*\[([^\]]*)\]/);
  if (!match) {
    return null;
  }

  return match[1]
    .split(",")
    .map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}
