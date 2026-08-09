import fs from "fs";
import path from "path";
import { BUILTIN_RULES } from "./config/rules";

const webBuildDirectory = path.resolve(__dirname, "../build/web");
fs.mkdirSync(webBuildDirectory, { recursive: true });

const rulesPath = path.join(webBuildDirectory, "kiss-translator-rules.json");
fs.writeFileSync(rulesPath, JSON.stringify(BUILTIN_RULES, null, 2));

console.info(`Built-in rules generated: ${rulesPath}`);
