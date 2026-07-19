export const releaseTargets = Object.freeze([
  "chrome",
  "edge",
  "firefox",
  "thunderbird",
  "userscript",
]);

export function getExpectedReleaseArchives(version) {
  return releaseTargets.map(
    (target) => `kiss-translator_v${version}_${target}.zip`
  );
}

export function findReleaseArchiveSetFailures(version, fileNames) {
  const expectedArchives = new Set(getExpectedReleaseArchives(version));
  const actualArchives = new Set(
    fileNames.filter((fileName) => fileName.endsWith(".zip"))
  );
  const failures = [];

  for (const archiveName of expectedArchives) {
    if (!actualArchives.has(archiveName)) {
      failures.push(`${archiveName} is missing`);
    }
  }

  for (const archiveName of actualArchives) {
    if (!expectedArchives.has(archiveName)) {
      failures.push(`${archiveName} is an unexpected release archive`);
    }
  }

  return failures;
}
