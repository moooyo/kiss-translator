/**
 * @file fieldRevisions.js
 * @description 逐字段的 Lamport 版本戳,用来识别「跨 realm 写入把别人的字段抹掉了」。
 *
 * ## 为什么需要它
 *
 * `patchObj` 是读-改-写,不是原子的。同 realm 内有队列串行化,跨 realm(选项页 /
 * 弹窗 / 各标签页的内容脚本)拦不住:A 读 → B 读 → B 写 → A 写,A 会连同 B 刚改过
 * 的字段一起写回旧值。
 *
 * ## 为什么必须是版本戳,而不是「比一比值」
 *
 * 事后看到「beta 变回了旧值」有两种可能:B 故意把它改回去了,或者 B 用一份过期快照
 * 把它顺手抹了。**光看值分不出来**,一律重放就会复活用户在另一个标签页刚改掉的设置。
 *
 * 版本戳能分:戳是单调递增的,所以「存储里这个字段的戳比我写进去的还旧」只可能是
 * 有人拿过期快照覆盖了它 —— 故意的修改一定会把戳推得更高。
 *
 * ## 戳的形状
 *
 * `[counter, realmId]`,按字典序比较。只用 counter 不够:两个 realm 各自把 3 推到 4,
 * 谁也看不出对方覆盖了自己。realmId 提供确定性的平手判定。
 *
 * 路径用 `JSON.stringify(["a","b"])` 做键 —— 设置里的键名可能含点号(提示词 slug 之类),
 * 用点号拼接会产生歧义。
 *
 * ## 它没有关掉什么
 *
 * 这是**事后识别 + 重放**,不是预防。覆盖照样会发生,只是随后会被修回来 ——
 * 期间另一个上下文的界面上可能短暂闪回旧值。
 *
 * 而且还剩一条更窄的缝:值和戳是两次写、也是两次读,不是原子的。
 * 对方的戳写入落在我读戳之前、值写入落在我读值之后时,我会保留它的戳却丢掉它的值 ——
 * 这种覆盖检测不到。宽度是一次存储往返内的一小段,而不是原来的「整个交错窗口」。
 * 要彻底消灭它需要值与戳的原子写入,存储后端(chrome.storage / GM / localStorage)
 * 都不提供。
 *
 * iOS 上没有值变更监听(见 handoff 附录),收不到回声,因此也不会重放 ——
 * 那条渠道退化成今天的行为。
 */

import { SETTING_PATCH_DELETE } from "./settingPatch";

const DELETE_OPERATION_KEY = "__kissTranslatorSettingPatchOperation__";

function isPlainObject(value) {
  if (!value || Object.prototype.toString.call(value) !== "[object Object]") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

function isDeleteOperation(value) {
  return (
    isPlainObject(value) &&
    Object.keys(value).length === 1 &&
    value[DELETE_OPERATION_KEY] === "delete"
  );
}

/**
 * 把路径数组编码成稳定的字符串键。
 *
 * @param {string[]} path 路径分段
 * @returns {string} 可作为对象键的编码
 */
export function encodePath(path) {
  return JSON.stringify(path);
}

/**
 * 还原被 encodePath 编码过的路径。
 *
 * @param {string} encoded 编码后的路径
 * @returns {string[]|null} 路径分段,无法解析时返回 null
 */
export function decodePath(encoded) {
  try {
    const path = JSON.parse(encoded);
    return Array.isArray(path) ? path : null;
  } catch (error) {
    return null;
  }
}

/**
 * 列出一个补丁真正改动到的叶子路径。
 *
 * 删除操作也算叶子:它同样是一次对该字段的改动,同样需要一个更高的戳,
 * 否则「A 删掉某字段、B 用旧快照把它写回来」就检测不到。
 *
 * @param {Object} patch createSettingPatch 产出的补丁
 * @returns {string[]} 编码后的叶子路径列表
 */
export function collectPatchPaths(patch) {
  const paths = [];

  const walk = (node, path) => {
    if (isDeleteOperation(node) || !isPlainObject(node)) {
      paths.push(encodePath(path));
      return;
    }

    const keys = Object.keys(node);
    if (keys.length === 0) {
      paths.push(encodePath(path));
      return;
    }

    keys.forEach((key) => walk(node[key], [...path, key]));
  };

  if (patch !== undefined) {
    walk(patch, []);
  }
  return paths;
}

/**
 * 比较两个版本戳。
 *
 * @param {Array|undefined} a 戳 A
 * @param {Array|undefined} b 戳 B
 * @returns {number} a 比 b 新返回正数,旧返回负数,相同返回 0
 */
export function compareRevisions(a, b) {
  const [counterA = 0, realmA = ""] = Array.isArray(a) ? a : [];
  const [counterB = 0, realmB = ""] = Array.isArray(b) ? b : [];

  if (counterA !== counterB) return counterA - counterB;
  if (realmA === realmB) return 0;
  return realmA > realmB ? 1 : -1;
}

/**
 * 为补丁改动到的每个叶子路径推高版本戳。
 *
 * @param {Object} revisions 当前的戳表
 * @param {string[]} paths 编码后的叶子路径
 * @param {string} realmId 本 realm 的标识
 * @returns {Object} 新的戳表
 */
export function bumpRevisions(revisions, paths, realmId) {
  const next = { ...(isPlainObject(revisions) ? revisions : {}) };
  paths.forEach((path) => {
    const [counter = 0] = Array.isArray(next[path]) ? next[path] : [];
    next[path] = [counter + 1, realmId];
  });
  return next;
}

/**
 * 找出「我写进去之后被人用过期快照覆盖掉」的路径。
 *
 * 只认**严格更旧**:相同说明我的写入还在,更新说明别人在我之后做了真正的修改
 * (那是正常的后来者获胜,不能回滚人家)。
 *
 * @param {Object} storedRevisions 存储里当前的戳表
 * @param {Object} writtenRevisions 我上次写入时的戳表
 * @returns {string[]} 需要重放的编码路径
 */
export function findRegressedPaths(storedRevisions, writtenRevisions) {
  if (!isPlainObject(writtenRevisions)) return [];
  const stored = isPlainObject(storedRevisions) ? storedRevisions : {};

  return Object.keys(writtenRevisions).filter(
    (path) => compareRevisions(stored[path], writtenRevisions[path]) < 0
  );
}

/**
 * 从一份完整值里,按路径取出那些字段,拼成一个可以直接喂给 patchObj 的补丁。
 *
 * 路径在值里已经不存在时,补成删除操作 —— 原本那次写入就是一次删除,
 * 重放也必须重放成删除。
 *
 * @param {Object} value 我上次写入的完整值
 * @param {string[]} paths 编码后的路径
 * @returns {Object|undefined} 重放补丁,无可重放内容时返回 undefined
 */
export function buildReplayPatch(value, paths) {
  const patch = {};
  let hasAny = false;

  paths.forEach((encoded) => {
    const path = decodePath(encoded);
    if (!path || path.length === 0) return;

    let source = value;
    let missing = false;
    for (const segment of path) {
      if (!isPlainObject(source) || !(segment in source)) {
        missing = true;
        break;
      }
      source = source[segment];
    }

    let target = patch;
    path.slice(0, -1).forEach((segment) => {
      if (!isPlainObject(target[segment])) target[segment] = {};
      target = target[segment];
    });
    target[path[path.length - 1]] = missing ? SETTING_PATCH_DELETE : source;
    hasAny = true;
  });

  return hasAny ? patch : undefined;
}
