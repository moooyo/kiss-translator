import assert from "node:assert/strict";
import test from "node:test";
import {
  findReleaseArchiveSetFailures,
  getExpectedReleaseArchives,
} from "./release-archives.mjs";

const version = "2.0.28";
const expectedArchives = getExpectedReleaseArchives(version);

test("accepts exactly the five canonical release archives", () => {
  assert.deepEqual(
    findReleaseArchiveSetFailures(version, expectedArchives),
    []
  );
});

test("reports a missing canonical release archive", () => {
  assert.deepEqual(
    findReleaseArchiveSetFailures(version, expectedArchives.slice(1)),
    [`${expectedArchives[0]} is missing`]
  );
});

test("reports extra release archives", () => {
  assert.deepEqual(
    findReleaseArchiveSetFailures(version, [
      ...expectedArchives,
      "kiss-translator_v1.0.0_chrome.zip",
      "legacy-release.zip",
    ]),
    [
      "kiss-translator_v1.0.0_chrome.zip is an unexpected release archive",
      "legacy-release.zip is an unexpected release archive",
    ]
  );
});
