#!/usr/bin/env zx

import bestzip from "bestzip";

const buildDirectory = path.resolve("build");
if (!(await fs.pathExists(buildDirectory))) {
  throw new Error("Build directory is missing. Run the release build first.");
}

const targets = ["chrome", "edge", "firefox", "thunderbird", "userscript"];
const packageJson = await fs.readJSON(path.resolve("package.json"));
const releasePrefix = `kiss-translator_v${packageJson.version}`;

const oldArchives = (await fs.readdir(buildDirectory))
  .filter((fileName) => fileName.endsWith(".zip"))
  .map((fileName) => fs.remove(path.join(buildDirectory, fileName)));
await Promise.all(oldArchives);

for (const target of targets) {
  const sourceDirectory = path.join(buildDirectory, target);
  const destination = path.join(
    buildDirectory,
    `${releasePrefix}_${target}.zip`
  );
  if (!(await fs.pathExists(sourceDirectory))) {
    throw new Error(`Archive source is missing: ${sourceDirectory}`);
  }

  console.log(`Creating ${path.basename(destination)}...`);
  await bestzip.nodeZip({
    cwd: sourceDirectory,
    source: "*",
    destination,
  });
}

console.log("Release archives created successfully.");
