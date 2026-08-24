import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * 由 manifest 的 key 字段推导 Chrome 扩展 ID。
 *
 * ID = DER 公钥的 SHA-256 前 128 位，十六进制每个 nibble 按 0-f → a-p 映射。
 *
 * @param {string} manifestKey manifest.json 里 key 字段的 base64 公钥
 * @returns {string} 32 个字符的扩展 ID
 */
function deriveExtensionId(manifestKey) {
  const der = Buffer.from(manifestKey, "base64");
  const digest = crypto.createHash("sha256").update(der).digest("hex");

  return digest
    .slice(0, 32)
    .split("")
    .map((nibble) => String.fromCharCode(97 + parseInt(nibble, 16)))
    .join("");
}

const readManifest = (name) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../public", name), "utf-8")
  );

// 没有 key 字段时，Chrome 对「加载已解压的扩展程序」是**按目录绝对路径**推导 ID 的,
// 而 chrome.storage 按扩展 ID 分区 —— 用户把新版本解压到另一个目录，
// 设置、规则、生词本就全部读不到了。我们又是按 zip 发版的，这条路径很常走。
//
// key 一旦变更，所有现有用户的 ID 随之改变，等同于清空他们的数据。
// 这里把公钥和它推导出的 ID 一起钉死：换 key 必须是一次有意识的决定。
describe("chrome extension identity", () => {
  const EXPECTED_ID = "enhckapfllnpbdljjmkdkihlcjjikpob";

  test("pins the extension ID through the manifest key", () => {
    const manifest = readManifest("manifest.json");

    expect(typeof manifest.key).toBe("string");
    expect(deriveExtensionId(manifest.key)).toBe(EXPECTED_ID);
  });

  test("derives an ID Chrome would accept", () => {
    const id = deriveExtensionId(readManifest("manifest.json").key);

    expect(id).toHaveLength(32);
    expect(id).toMatch(/^[a-p]{32}$/);
  });

  test("does not collide with the upstream store listing", () => {
    // 上游 Chrome 应用商店的 item id，出现在它的商店与评价链接里。
    expect(deriveExtensionId(readManifest("manifest.json").key)).not.toBe(
      "bdiifdefkgmcblbcghdlonllpjhhjgof"
    );
  });

  // key 是 Chromium 专有的。Gecko 走 browser_specific_settings.gecko.id，
  // 两边各管各的，混进去只会让人以为改一处就够了。
  test.each(["manifest.firefox.json", "manifest.thunderbird.json"])(
    "%s identifies through gecko.id instead of a key",
    (name) => {
      const manifest = readManifest(name);

      expect(manifest.key).toBeUndefined();
      expect(manifest.browser_specific_settings.gecko.id).toBe(
        "kiss-translator-m3@moooyo.github.io"
      );
    }
  );
});
