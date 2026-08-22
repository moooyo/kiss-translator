import fs from "fs";
import path from "path";

/**
 * GM 的值变更监听是跨上下文设置同步在油猴模式下的唯一通道
 * （扩展模式走 chrome.storage.onChanged，油猴没有对应物）。
 *
 * 这几条 @grant 一旦从脚本头部丢失，整条链路会退化成永久静默的 no-op：
 * 不报错、不提示、也不降级，只是设置在多个标签页之间不再同步。
 * src/libs/gm.js 的 getOptionalGmMethod 会吞掉缺失方法的异常，
 * 所以运行时不会有任何迹象——只能靠这里守住。
 */
const REQUIRED_VALUE_CHANGE_GRANTS = [
  "GM.addValueChangeListener",
  "GM_addValueChangeListener",
  "GM.removeValueChangeListener",
  "GM_removeValueChangeListener",
];

test("userscript banner grants the GM value-change listener APIs", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../../config-overrides.js"),
    "utf8"
  );
  const granted = new Set(
    Array.from(
      source.matchAll(/^\/\/[^\S\r\n]*@grant[^\S\r\n]+(\S+)[^\S\r\n]*$/gm),
      (match) => match[1]
    )
  );

  expect(
    REQUIRED_VALUE_CHANGE_GRANTS.filter((grant) => !granted.has(grant))
  ).toEqual([]);
});
