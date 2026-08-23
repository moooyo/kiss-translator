import fs from "fs";
import path from "path";
import { BUILTIN_RULES } from "./config/rules";

/**
 * 这是一个在构建 (Build) 阶段由 Node.js 运行的辅助脚本。
 * 作用是生成内置规则的静态 JSON 文件，供云端分发。
 */
(() => {
  // 1. 生成内置翻译规则的静态 JSON 配置文件
  try {
    const data = JSON.stringify(BUILTIN_RULES, null, 2);
    // 生成的目标路径在打包输出文件夹的 web 目录下
    const dir = path.resolve(__dirname, "../build/web");
    const file = path.join(dir, "kiss-translator-rules.json");
    // 完整 build 里 build:web 排在前面，目录一定存在；但单独跑 pnpm build:rules
    // (新克隆、或只想刷新规则文件时) 目录还没有，writeFileSync 会 ENOENT，
    // 被下面的 catch 吞成一行 console.error，退出码仍是 0 —— 规则文件静默缺失。
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, data);
    console.info(`Built-in rules generated: ${file}`);
  } catch (err) {
    console.error("Failed to generate built-in rules file:", err);
  }
})();
