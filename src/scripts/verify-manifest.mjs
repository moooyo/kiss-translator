import fs from "node:fs";
import path from "node:path";
import { findMissingManifestArtifacts } from "./manifest-artifacts.mjs";

// 校验构建产物里 manifest.json 声明的每个文件是否真的存在。
// CI 只验证构建退出码为 0 —— 而一个漏打包的图标、缺失的 content script
// 或写错的 options 页路径都不会让构建失败，只会在用户安装时炸。
const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("usage: node src/scripts/verify-manifest.mjs <buildDir>...");
  process.exit(2);
}

const listFiles = (dir, prefix = "") =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory()
      ? listFiles(path.join(dir, entry.name), rel)
      : [rel];
  });

let failed = false;
for (const target of targets) {
  const manifestPath = path.join(target, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(`✗ ${target}: no manifest.json`);
    failed = true;
    continue;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const missing = findMissingManifestArtifacts(manifest, listFiles(target));
  if (missing.length > 0) {
    console.error(`✗ ${target}: manifest references missing files:`);
    missing.forEach((entry) => console.error(`    ${entry}`));
    failed = true;
  } else {
    console.log(`✓ ${target}: every manifest reference exists`);
  }
}

process.exit(failed ? 1 : 0);
