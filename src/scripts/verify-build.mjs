#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "../..");
const buildDirectory = path.join(rootDirectory, "build");
const releaseMode = process.argv.includes("--release");

const packageJson = JSON.parse(
  await fs.readFile(path.join(rootDirectory, "package.json"), "utf8")
);

const requiredFiles = [
  "chrome/manifest.json",
  "chrome/popup.html",
  "chrome/options.html",
  "chrome/background.js",
  "edge/manifest.json",
  "edge/popup.html",
  "safari/manifest.json",
  "safari/popup.html",
  "safari/options.html",
  "safari/background.js",
  "firefox/manifest.json",
  "firefox/background.js",
  "thunderbird/manifest.json",
  "thunderbird/background.js",
  "web/index.html",
  "web/options.html",
  "web/kiss-translator.user.js",
  "web/kiss-translator-ios-safari.user.js",
  "web/kiss-translator-rules.json",
  "web/version.txt",
  "userscript/kiss-translator.user.js",
  "userscript/kiss-translator-ios-safari.user.js",
];

if (releaseMode) {
  requiredFiles.push(
    ...["chrome", "edge", "firefox", "thunderbird", "userscript"].map(
      (target) => `kiss-translator_v${packageJson.version}_${target}.zip`
    )
  );
}

const failures = [];

const readZipEntries = async (filePath) => {
  const data = await fs.readFile(filePath);
  const signature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  const entries = [];
  let offset = 0;

  while (offset < data.length) {
    const entryOffset = data.indexOf(signature, offset);
    if (entryOffset < 0 || entryOffset + 46 > data.length) break;
    const fileNameLength = data.readUInt16LE(entryOffset + 28);
    const extraLength = data.readUInt16LE(entryOffset + 30);
    const commentLength = data.readUInt16LE(entryOffset + 32);
    const fileNameStart = entryOffset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    entries.push(data.toString("utf8", fileNameStart, fileNameEnd));
    offset = fileNameEnd + extraLength + commentLength;
  }

  return entries;
};

for (const relativePath of requiredFiles) {
  const filePath = path.join(buildDirectory, relativePath);
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile() || stats.size === 0) {
      failures.push(`${relativePath} is empty or is not a file`);
    }
  } catch {
    failures.push(`${relativePath} is missing`);
  }
}

const manifestPaths = [
  "chrome/manifest.json",
  "edge/manifest.json",
  "safari/manifest.json",
  "firefox/manifest.json",
  "thunderbird/manifest.json",
];

for (const relativePath of manifestPaths) {
  try {
    const manifest = JSON.parse(
      await fs.readFile(path.join(buildDirectory, relativePath), "utf8")
    );
    if (manifest.version !== packageJson.version) {
      failures.push(
        `${relativePath} has version ${manifest.version}, expected ${packageJson.version}`
      );
    }
  } catch (error) {
    failures.push(`${relativePath} is not valid JSON: ${error.message}`);
  }
}

try {
  const builtVersion = (
    await fs.readFile(path.join(buildDirectory, "web/version.txt"), "utf8")
  ).trim();
  if (builtVersion !== packageJson.version) {
    failures.push(
      `web/version.txt has version ${builtVersion}, expected ${packageJson.version}`
    );
  }
} catch (error) {
  failures.push(`web/version.txt could not be read: ${error.message}`);
}

const forbiddenFiles = [
  "chrome/manifest.firefox.json",
  "chrome/manifest.thunderbird.json",
  "firefox/manifest.firefox.json",
  "thunderbird/manifest.thunderbird.json",
  "web/manifest.json",
];

for (const relativePath of forbiddenFiles) {
  try {
    await fs.access(path.join(buildDirectory, relativePath));
    failures.push(`${relativePath} should not be present`);
  } catch {
    // Absence is expected.
  }
}

if (releaseMode) {
  const archiveExpectations = {
    [`kiss-translator_v${packageJson.version}_chrome.zip`]: "manifest.json",
    [`kiss-translator_v${packageJson.version}_edge.zip`]: "manifest.json",
    [`kiss-translator_v${packageJson.version}_firefox.zip`]: "manifest.json",
    [`kiss-translator_v${packageJson.version}_thunderbird.zip`]:
      "manifest.json",
    [`kiss-translator_v${packageJson.version}_userscript.zip`]:
      "kiss-translator.user.js",
  };

  for (const [archiveName, expectedEntry] of Object.entries(
    archiveExpectations
  )) {
    try {
      const entries = await readZipEntries(
        path.join(buildDirectory, archiveName)
      );
      if (entries.length === 0) {
        failures.push(`${archiveName} contains no files`);
      } else if (!entries.includes(expectedEntry)) {
        failures.push(`${archiveName} is missing root entry ${expectedEntry}`);
      }
    } catch (error) {
      failures.push(`${archiveName} could not be inspected: ${error.message}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Build verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Verified ${requiredFiles.length} ${releaseMode ? "release" : "build"} artifacts for version ${packageJson.version}.`
);
