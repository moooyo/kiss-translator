import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  findMissingUserscriptValueChangeGrants,
  getUserscriptGrants,
  REQUIRED_USERSCRIPT_VALUE_CHANGE_GRANTS,
} from "./userscript-metadata.mjs";

const metadata = (grants) => `// ==UserScript==
${grants.map((grant) => `// @grant         ${grant}`).join("\n")}
// ==/UserScript==
`;

test("accepts all grants required for cross-tab value changes", () => {
  const source = metadata(REQUIRED_USERSCRIPT_VALUE_CHANGE_GRANTS);

  assert.deepEqual(findMissingUserscriptValueChangeGrants(source), []);
  assert.deepEqual(
    [...getUserscriptGrants(source)],
    REQUIRED_USERSCRIPT_VALUE_CHANGE_GRANTS
  );
});

test("reports missing modern and legacy grants", () => {
  const source = metadata([
    "GM.addValueChangeListener",
    "GM_removeValueChangeListener",
  ]);

  assert.deepEqual(findMissingUserscriptValueChangeGrants(source), [
    "GM_addValueChangeListener",
    "GM.removeValueChangeListener",
  ]);
});

test("ignores grant-like text outside the metadata block", () => {
  const source = `${metadata([])}
// @grant         GM.addValueChangeListener
`;

  assert.deepEqual(
    findMissingUserscriptValueChangeGrants(source),
    REQUIRED_USERSCRIPT_VALUE_CHANGE_GRANTS
  );
});

test("rejects metadata without an opening marker", () => {
  const source = `${REQUIRED_USERSCRIPT_VALUE_CHANGE_GRANTS.map(
    (grant) => `// @grant         ${grant}`
  ).join("\n")}
// ==/UserScript==
`;

  assert.deepEqual(
    findMissingUserscriptValueChangeGrants(source),
    REQUIRED_USERSCRIPT_VALUE_CHANGE_GRANTS
  );
});

test("keeps every required grant in the userscript build banner", async () => {
  const configSource = await readFile(
    new URL("../../config-overrides.js", import.meta.url),
    "utf8"
  );

  for (const grant of REQUIRED_USERSCRIPT_VALUE_CHANGE_GRANTS) {
    assert.match(
      configSource,
      new RegExp(`^// @grant\\s+${grant.replaceAll(".", "\\.")}$`, "m")
    );
  }
});
