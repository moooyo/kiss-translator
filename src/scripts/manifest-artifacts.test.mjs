import assert from "node:assert/strict";
import test from "node:test";
import {
  findMissingManifestArtifacts,
  getManifestArtifactReferences,
} from "./manifest-artifacts.mjs";

const manifest = {
  manifest_version: 3,
  default_locale: "en",
  background: { service_worker: "background.js" },
  content_scripts: [{ js: ["content.js"], css: ["content.css"] }],
  action: {
    default_popup: "popup.html",
    default_icon: { 16: "images/action16.png" },
  },
  icons: { 48: "images/logo48.png" },
  web_accessible_resources: [
    { resources: ["api/*", "injector.js"], matches: ["<all_urls>"] },
  ],
};

test("collects executable, UI, locale, icon, and public resources", () => {
  assert.deepEqual(
    getManifestArtifactReferences(manifest).sort(),
    [
      "_locales/en/messages.json",
      "api/*",
      "background.js",
      "content.css",
      "content.js",
      "images/action16.png",
      "images/logo48.png",
      "injector.js",
      "manifest.json",
      "popup.html",
    ].sort()
  );
});

test("reports missing exact paths while accepting populated globs", () => {
  const artifacts = [
    "manifest.json",
    "background.js",
    "content.js",
    "popup.html",
    "images/action16.png",
    "images/logo48.png",
    "api/Google.svg",
    "injector.js",
    "_locales/en/messages.json",
  ];

  assert.deepEqual(findMissingManifestArtifacts(manifest, artifacts), [
    "content.css",
  ]);
});
