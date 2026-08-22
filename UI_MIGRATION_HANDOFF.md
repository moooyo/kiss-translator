# UI 迁移进度 Handoff

**最后更新:** 2026-08-22 · `dev-newui` @ `ffcfbb1`

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

上述两个 UI PR 的 base 仍指向上游 `fishjar:dev`,在 GitHub 上依旧 open 且显示冲突 —— 本地合并不会自动关闭它们。

## 待办(按优先级)

### 1. `agent/atomic-setting-patch` — 建议优先

设置原子写入 / 跨上下文存储订阅 / 编辑草稿保护,三个 commit 的栈(合栈顶即含全部三个,不必单独处理 `agent/storage-subscriptions`、`agent/editor-draft-protection`)。

三个问题均已核实在 `dev-newui` 上存在:并发写入无串行化、storage 层无订阅、`usePersistedEntityDraft` 不存在。`src/hooks/Storage.js` 顶部的 `REVIEW:` 注释本身就建议加 `chrome.storage.onChanged` 监听。源码约 700 行,测试约 1320 行。

**合并冲突预估**(已试合验证):核心层 `storage.js` / `Storage.js` / `gm.js` / `settingPatch.js` 干净通过;冲突集中在 5 个 Options 文件:

```
Apis.js               4 处 /  83 行
Apis.test.js          6 处 / 385 行
Prompts.test.js       5 处 / 219 行
StylesSetting.js      4 处 /  47 行
StylesSetting.test.js 10 处 / 266 行
```

冲突性质是同一问题的两种实现竞争:`dev-newui`(来自 #1004)用 `useEffect` 同步草稿,该分支用 `usePersistedEntityDraft` 取代。需逐处取舍并保留 M3 的 `SettingsCard` 结构。**拖得越久,这几个文件的冲突越难解。**

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
