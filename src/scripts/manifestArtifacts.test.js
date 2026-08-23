import fs from "fs";
import path from "path";
import {
  findMissingManifestArtifacts,
  getManifestArtifactReferences,
} from "./manifest-artifacts.mjs";

// 这个模块支撑 CI 的产物校验（verify-manifest.mjs）。构建本身只保证退出码为 0 ——
// 漏打包的图标、缺失的 content script、写错的 options 页路径都不会让构建失败，
// 只会在用户安装扩展时炸。
describe("manifest artifact references", () => {
  test("always includes the manifest itself", () => {
    expect(getManifestArtifactReferences({})).toEqual(["manifest.json"]);
  });

  test("collects every reference kind this repo's manifests use", () => {
    const references = getManifestArtifactReferences({
      background: { service_worker: "background.js" },
      content_scripts: [{ js: ["content.js"], css: ["content.css"] }],
      action: { default_popup: "popup.html", default_icon: { 16: "i16.png" } },
      options_ui: { page: "options.html" },
      icons: { 48: "i48.png", 128: "i128.png" },
      web_accessible_resources: [{ resources: ["injector.js", "api/*"] }],
      default_locale: "en",
    });

    expect(references).toEqual(
      expect.arrayContaining([
        "manifest.json",
        "background.js",
        "content.js",
        "content.css",
        "popup.html",
        "i16.png",
        "options.html",
        "i48.png",
        "i128.png",
        "injector.js",
        "api/*",
        "_locales/en/messages.json",
      ])
    );
  });

  test("reports a reference that has no matching artifact", () => {
    const manifest = { content_scripts: [{ js: ["content.js"] }] };
    expect(findMissingManifestArtifacts(manifest, ["manifest.json"])).toEqual([
      "content.js",
    ]);
    expect(
      findMissingManifestArtifacts(manifest, ["manifest.json", "content.js"])
    ).toEqual([]);
  });

  // web_accessible_resources 允许通配，逐字比对会误报
  test("matches wildcard resources against real paths", () => {
    const manifest = {
      web_accessible_resources: [{ resources: ["api/*"] }],
    };
    expect(
      findMissingManifestArtifacts(manifest, [
        "manifest.json",
        "api/rules.json",
      ])
    ).toEqual([]);
    expect(findMissingManifestArtifacts(manifest, ["manifest.json"])).toEqual([
      "api/*",
    ]);
  });

  // Windows 上目录遍历产出反斜杠，manifest 里永远是正斜杠
  test("normalizes backslashes so Windows paths still match", () => {
    const backslash = String.fromCharCode(92);
    const manifest = {
      web_accessible_resources: [{ resources: ["api/x.json"] }],
    };
    expect(
      findMissingManifestArtifacts(manifest, [
        "manifest.json",
        `api${backslash}x.json`,
      ])
    ).toEqual([]);
  });

  // 拿仓库里真实的 manifest 跑一遍，确保上面那些形状不是我编的
  test("handles this repo's actual manifest without crashing", () => {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "..", "public", "manifest.json"),
        "utf8"
      )
    );
    const references = getManifestArtifactReferences(manifest);
    expect(references).toContain("manifest.json");
    expect(references.length).toBeGreaterThan(1);
  });
});
