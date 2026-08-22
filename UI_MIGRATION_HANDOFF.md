# UI 迁移进度 Handoff

**最后更新:** 2026-08-22 · `dev-newui` @ `ca24567`

把 `newui` 这个单体分支上的 UI 重构,切成可评审的小块逐步合进 `dev-newui` 的进度记录。

## 分支约定

| 分支 | 用途 |
|---|---|
| `dev` | `fishjar/kiss-translator:dev` 的**纯镜像**,不要直接提交 |
| `dev-newui` | 新 UI 主线。所有新 UI 工作从这里切、合回这里 |
| `newui` | 原始单体分支,包含完整重构。停更于 2026-08-09,**落后大量上游特性** |
| `beta` | `newui` 的祖先(7/20 旧快照),无独有内容,**可忽略** |
| `backup/dev-before-sync-*` | 同步前的安全快照,内容已含于 `newui`/`beta` |

`dev-newui` 目前与 `upstream/dev` 齐平,无待同步的上游工作。

## 已完成

| 内容 | commit | 说明 |
|---|---|---|
| 设置页 Material 3 | `5ffbe66` | PR #1004,`agent/settings-new-ui` |
| Popup Material 3 | `a96fdf8` | PR #1013,`agent/popup-m3-redesign` |
| 固定 pnpm 9.14.4 | `2904560` | 见下方「已知坑」 |
| 内容页运行时样式/注入器泄漏修复 | `ffcfbb1` | PR #5(仅评审用),`fix/runtime-style-leak-dev` |
| 设置页草稿身份抖动守卫 | 本次 | `StylesSetting.js` / `Prompts.js`,各带一条回归测试;是下方 `b47873c` 的前置条件 |

上述两个 UI PR 的 base 仍指向上游 `fishjar:dev`,在 GitHub 上依旧 open 且显示冲突 —— 本地合并不会自动关闭它们。

## 待办(按优先级)

### 1. `agent/atomic-setting-patch` — 拆开逐个 cherry-pick,**不要整合**

2026-08-22 对三个 commit 逐个复审,推翻了此前「合栈顶即含全部三个」的建议 —— 那样做会踩下面的陷阱。三个 commit 应得三种不同结论。

#### `cdf403a` 编辑草稿保护 —— **丢弃**

它的核心文件与 `a07d39f`(#1004 的 M3 基线)上曾存在过的版本**字节相同**,后被 `ed5e79b`「Narrow settings UI behavior changes」整个删除。这是对一次有意决策的 revert,不是新修复:

```
git rev-parse cdf403a:src/views/Options/usePersistedEntityDraft.js  → 9559628c...
git rev-parse a07d39f:src/views/Options/usePersistedEntityDraft.js  → 9559628c...
```

它带的 `StylesSetting.test.js` 用例也是把 `ed5e79b` 删除并反转过的断言原样复活。

另有一处 `ed5e79b` 时期没有的缺陷:`rebaseLocalChanges` 中 baseline 与 draft 一致的 key 走 early return、从不写入 `next`。当 persisted 侧为 `{}` 时(`Apis.js` 以 `usePersistedEntityDraft(api || {}, apiSlug)` 调用,`api` 来自可能瞬时落空的 `transApis.find(...)`),脏草稿会塌缩成只剩被编辑的那个字段。它替代的旧代码最多回退到已持久化的值,造不出残缺实体。

**而它贡献了整个栈 100% 的冲突**(29 处 / 约 1000 行 / 5 文件)。`git merge-tree` 对三个 commit 分别测得的冲突数完全相同 —— 后两个 commit 自身零冲突。

其中唯一值得留下的是 `StylesSetting` 的草稿丢失,已用 6 行内容比对守卫在 `dev-newui` 上单独修掉(见「已完成」),契约不变:持久化内容真的变化时草稿照样被覆盖,只是「对象换身份、内容未改」不再被误判。

#### `b47873c` 跨上下文存储订阅 —— **合,但需带三个修复**

缺口确认存在:`src/hooks/Storage.js:31` 的 `REVIEW:` 注释就是它的 spec,`storage.js` 导出的对象里没有任何 subscribe。**零冲突** —— `dev-newui` 从未改过 `src/hooks/Storage.js` 和 `src/libs/gm.js`。这两个 commit 合起来是全栈 78% 的新增代码量。

注意:持有独立快照的 `SettingProvider` 是**五个**(popup / fab / contentPopup / options / `TranBox.js:451` 的 tranbox),不是四个。

前两项是**前置条件而非后续优化**:

1. `loadInitialData` 调 `setData(storedVal)` 时未设 `externalStorageValueRef`,挂载回写照发、且现在是广播。接收端会回退旧值、设上自己的 external 标记,其写 effect 随即提前 return —— 新编辑从 UI 和存储同时消失,没有东西能自愈。**比现状更差。**`Storage.js:8` 已有 `isSameStorageValue` 可用
2. `StylesSetting` / `Prompts` 的草稿守卫必须先落地 —— **已完成**。订阅一上,每次外部写入都会重建实体身份,把今天很难触发的草稿丢失变成常态
3. 删掉 `src/views/Popup/index.js:63-75` 那个失效的手写监听器及其测试(`setObj` 存的是 JSON 字符串,监听器却对它取 `.autoTranslateClipboard`)

`config-overrides.js` / `package.json` 加的 4 行 `@grant` 是**必需的**,没有它整个 GM 分支在油猴下是永久静默 no-op。`userscript-metadata.mjs` 那 105 行工具可丢(CI 不跑测试)。待验证:iOS Safari 的 Userscripts app 是否会因不认识这些 grant 而拒装 —— 运行时降级是安全的(`getOptionalGmMethod` 会吞掉异常),但安装时行为需实机试一次。

#### `94fcf96` 设置原子写入 —— **先改造再合**

`settingPatch.js` 本身干净、纯函数、测试扎实(含一条移除队列就会失败的真实交错测试),零冲突,零夹带。但三处要先改:

- 后台经 `getSettingWithDefault()` 读写回存,而 `storage.js:173` 上方注释明说那层归一化**只在内存中**做。持久化它会把 `config/api.js` 里 `thinkingEffort: "_default"`(「接口默认,不注入参数」)替换成具体值写死 —— 用户从未选择的推理强度参数从此被注入,且不可恢复。应改读原始 `getSetting()`
- 「Serialize」名不副实:`sync.js:394` 和 `:519` 仍在做未入队的整对象 `setSetting`
- SW 往返无失败兜底。不会丢(patch 是累积的、会向前 rebase),但反过来:一个未刷出的 delta 会变成不可见、无上限的 per-tab override,遮盖其他上下文的值。需要 sendBgMsg 失败时直接写存储的 plan B

**无法单独 cherry-pick** —— 其 `Storage.js` hunk 是写在 `b47873c` 重写后的 hook 之上的(`subscribeObj` / `externalStorageValueRef` / `revisionAtStart`),且没有 `subscribeObj` 时约 40% 的新增行是没有东西驱动的 revision 机制。

#### 合并机制与陷阱

`cdf403a` 是**最老**的 commit,不能「合栈顶跳过它」——必须逐个 cherry-pick `b47873c`、`94fcf96`。两边文件集无交集(`comm -12` 为空),后两个从不引用该 hook 或任何 Options 文件,所以这样做是安全的。

**陷阱:** 直接 `git merge` 整个分支时 `Prompts.js` 会**无冲突标记地自动合并**,悄悄把 `ed5e79b` 从该文件移除的机制装回去,而 `Apis.js` / `StylesSetting.js` 还挂在冲突里。谁按 `dev-newui` 解完那几处冲突,就会得到三个组件用两套草稿机制、且没有任何信号。cherry-pick 可完全避开。

### 2. 字幕 — 最大剩余块,需先拆分

约 2000 行源码 / 11 文件,`src/views/Options/Subtitle.js` 单文件 +755/-990。混杂两类内容,建议拆成两个 PR:

- **运行时修复**(可先做):`YouTubeCaptionProvider.js` +499、`BilingualSubtitleManager.js` +178、`wordHover.js` +163、`youtubeCaptionTracks.js` +121。相关 commit:`0d533e8` / `cadfde2` / `9fe10d6`
- **设置页 UI**:`Subtitle.js`、`subtitleStyleUtils.js`(+533)、`useSubtitleStyleEditor.js`(+140)

PR #1004 当初显式排除了字幕(`1b10d45`),所以这块与已合入内容重叠最少。

### 3. `hooks/Alert.js` — 小而独立,约 90 行

`dev-newui` 现状的 `setTimeout(..., 0)` 在组件快速卸载时回调仍会触发(该文件注释已自认)。`newui` 改为单 state + `useRef` 递增 id。无依赖,随时可做。

## 暂缓

- **`hooks/Theme.js`**(+200/-39)— 依赖 `brandColor` 新设置项(`dev-newui` 全库无此字段),属于「加功能」而非「修 bug」;其中抽取 `useSystemDarkPreference` 的部分已随 #1004 合入,是重复的
- **划词面板 / 悬浮球** — 详见下方「已调研」
- **CI / 发布流程** — **不建议合**。`dev-newui` 已从上游拿到 `91a5976 Automate KISS Translator release workflow`(96 行 `release.yml`),`newui` 那套是另一套竞争实现(+159/-69),合入会覆盖上游成果
- **`hooks/I18n.js`、`useTranBoxState.js`、`tranboxPosition.js`、`subtitleIndexAlign.js`** — 上述几块的附属,或零行为变化的重构

## 已调研(结论备查,避免重复劳动)

**划词面板不是新功能。** `src/views/Selection/` 最早的 commit 是 2023-10-26,上游 `dev` 上 `TranBox.js` 501 行,`newui` 是 394 行 —— 是**重写+精简**,不是新增。真正的新增只有「翻译/词典」分栏、`dictionaryCapabilities.js`,以及两个修复(按在按钮上不再误触发拖拽、打开独立窗口时关闭页面内的框)。

**耦合警告:** `TranForm.js` / `TranCont.js` 是划词面板与 Popup **共用**的,`dev-newui` 上刚被 #1013 改过并带有上游特性,不能直接取 `newui` 版本。悬浮球 `ContentFab.js` 耦合最小,`dev-newui` 侧自分叉后未被改动过。

**已明确排除的 newui 改动:**
- `apis/index.js` 批量并发兜底值 `1` → `DEFAULT_BATCH_CONCURRENCY`:`DEFAULT_API_SETTING` 和 Options UI 都已默认 10,兜底只在值非法时触发,`1` 是更安全的落点
- `subtitleIndexAlign.js`:纯提取变量,零行为变化
- `MSG_TRANS_TOGGLE` 支持 `args.enabled`:`dev-newui` 已从上游获得

**别直接 merge `newui`。** 它停更于 2026-08-09,缺失这些上游特性,直接合会造成回退:QwenMT、Yandex、Google Cloud Translation、剪贴板自动翻译(#1024)、悬停气泡独立翻译服务(#1015)、生词本词典提示(#1014)、语言变体翻译(#1017)、英文词典提示词预设(#1022)、CVE-2026-54466 修复(#1001)。

## 已知坑

**pnpm 版本必须是 9.14.4。** `package.json` 的 `packageManager` 字段已固定。若用更高版本(如 `npx pnpm` 拉到的最新版)执行任何安装或构建,pnpm 10+ 不再读取 `package.json` 的 `pnpm.overrides`,会把 `pnpm-lock.yaml` 里的 `overrides` 块整个删掉 —— 那是 `0273e52` 针对 CVE-2026-54466 的三个 pin(`fast-xml-parser`、`shell-quote`、`websocket-driver`)。改动 lockfile 后请确认 `overrides` 仍在。

`.pnpm-version` 文件记录了同一版本号,但**仓库里没有任何地方读取它**,升级时注意两处同步(或收敛到单一来源)。

**测试基线不是全绿。** 在 `dev-newui` 上 `src/apis/trans.dict.test.js` 有 1 个用例失败,是既有问题,与本轮改动无关。在 `dev` 基线上则是 4 个套件 / 2 个用例失败(`trans.dict`、`batchQueue`、`BilingualSubtitleManager`、`Options/Layout`)。评估新改动时请对照基线,而不是期望全绿。

**仓库无 lint script、CI 无 lint/test 步骤**(只有 `release.yml`),所以测试和 lint 需要本地手动跑:

```
CI=true npx react-app-rewired test --watchAll=false
pnpm run build:chrome
```

**未被测试覆盖的验证项:** 已合入的样式回收(`translator.js` 的 `#removeTextStyles`)和 XHR 安装哨兵,其实际效果依赖 SPA 反复导航,单测只能验证逻辑。需装未打包扩展、在 YouTube 上反复导航,观察页面 shadow root 的 `adoptedStyleSheets` 是否仍在累积。
