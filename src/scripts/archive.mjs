#!/usr/bin/env zx

import { getArchiveTasks } from "./releaseTargets.mjs";

console.log(chalk.cyan("\nStarting compression tasks...\n"));

// 1. 进入 build 目录
cd("build");

// 2. 清理旧的 zip 文件
await $`npx shx rm -f *.zip`;

/**
 * 打包任务配置来自 releaseTargets.mjs —— 那里是发布渠道的唯一来源，
 * release.yml 的 matrix.client 也被测试钉在同一份清单上。
 * 不要在这里就地加渠道，否则打出来的 zip 不会被上传。
 *
 * @property {string} output - 输出文件名
 * @property {string} source - 要打包的源（文件或目录名）
 * @property {string} [cwd]  - (可选) 执行打包命令时所在的目录。
 */
const tasks = getArchiveTasks();

try {
  for (const task of tasks) {
    if (task.cwd) {
      // === 特殊打包：进入目录内部打包 (Firefox/Thunderbird) ===
      const originalCwd = process.cwd(); // 记录当前位置 (build/)

      // 1. 进入子目录
      cd(task.cwd);
      console.log(`Zipping contents of ${task.cwd} (flat structure)...`);

      // 2. 执行打包: 将当前目录所有文件 (*) 打包到父级目录的 zip 中
      await $`npx bestzip ${task.output} *`;

      // 3. 回到原目录
      cd(originalCwd);
    } else {
      // === 普通打包：打包文件夹本身 (Chrome/Edge) ===
      console.log(`Zipping folder ${task.source}...`);
      await $`npx bestzip ${task.output} ${task.source}`;
    }
  }
  console.log(chalk.green("\n✅ All zip files created successfully."));
} catch (err) {
  console.error(chalk.red("❌ Error during zipping:"), err);
  process.exit(1);
}
