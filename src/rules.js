import fs from "fs";
import path from "path";
import { BUILTIN_RULES } from "./config/rules";

const webBuildDirectory = path.resolve(__dirname, "../build/web");
const packagePath = path.resolve(__dirname, "../package.json");

fs.mkdirSync(webBuildDirectory, { recursive: true });

const rulesPath = path.join(webBuildDirectory, "kiss-translator-rules.json");
fs.writeFileSync(rulesPath, JSON.stringify(BUILTIN_RULES, null, 2));

const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const versionPath = path.join(webBuildDirectory, "version.txt");
fs.writeFileSync(versionPath, packageJson.version);

console.info(`Built-in rules generated: ${rulesPath}`);
console.info(`Version file generated: ${versionPath}`);
