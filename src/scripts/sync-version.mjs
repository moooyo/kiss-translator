#!/usr/bin/env zx

const rootDir = path.resolve(__dirname, "../..");
const packagePath = path.join(rootDir, "package.json");
const packageJson = await fs.readJSON(packagePath);
const expectedVersion = packageJson.version;
const checkOnly = process.argv.includes("--check");

const targets = [
  {
    path: path.join(rootDir, ".env"),
    type: "env",
    pattern: /^REACT_APP_VERSION=(.+)$/m,
  },
  {
    path: path.join(rootDir, "public/manifest.json"),
    type: "json",
    key: "version",
  },
  {
    path: path.join(rootDir, "public/manifest.firefox.json"),
    type: "json",
    key: "version",
  },
  {
    path: path.join(rootDir, "public/manifest.thunderbird.json"),
    type: "json",
    key: "version",
  },
];

let changedCount = 0;
const mismatches = [];

for (const target of targets) {
  const relativePath = path.relative(rootDir, target.path);

  if (target.type === "env") {
    const content = await fs.readFile(target.path, "utf8");
    const match = content.match(target.pattern);
    if (!match) {
      throw new Error(`Version key is missing from ${relativePath}`);
    }

    if (match[1] === expectedVersion) continue;
    mismatches.push(`${relativePath}: ${match[1]} -> ${expectedVersion}`);
    if (!checkOnly) {
      const updated = content.replace(
        target.pattern,
        `REACT_APP_VERSION=${expectedVersion}`
      );
      await fs.writeFile(target.path, updated, "utf8");
      changedCount += 1;
    }
    continue;
  }

  const json = await fs.readJSON(target.path);
  const currentVersion = json[target.key];
  if (currentVersion === expectedVersion) continue;
  mismatches.push(
    `${relativePath}: ${currentVersion ?? "<missing>"} -> ${expectedVersion}`
  );
  if (!checkOnly) {
    json[target.key] = expectedVersion;
    await fs.writeJSON(target.path, json, { spaces: 2 });
    changedCount += 1;
  }
}

if (checkOnly && mismatches.length > 0) {
  console.error("Version metadata is out of sync:");
  mismatches.forEach((mismatch) => console.error(`- ${mismatch}`));
  process.exit(1);
}

if (checkOnly) {
  console.log(`Version metadata is synchronized at ${expectedVersion}.`);
} else {
  console.log(
    `Synchronized ${changedCount} file(s) to version ${expectedVersion}.`
  );
}
