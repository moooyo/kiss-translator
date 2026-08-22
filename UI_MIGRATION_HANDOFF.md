# UI 迁移进度 Handoff

**最后更新:** 2026-08-23 · `dev-newui` @ `39bec28`

把 `newui` 这个单体分支上的 UI 重构,切成可评审的小块逐步合进 `dev-newui` 的进度记录。

## 分支约定

| 分支 | 用途 |
|---|---|
| `dev` | `fishjar/kiss-translator:dev` 的**纯镜像**,不要直接提交 |
| `dev-newui` | 新 UI 主线。所有新 UI 工作从这里切、合回这里 |
| `newui` | 原始单体分支,包含完整重构。停更于 2026-08-09,**落后大量上游特性** |
| `beta` | `newui` 的祖先(7/20 旧快照),无独有内容,**可忽略** |
| `backup/dev-before-sync-*` | 同步前的安全快照,内容已含于 `newui`/`beta` |
| `archive/atomic-setting-patch`(标签) | 已归档的三 commit 栈。本文档多处按 SHA 引用它,**不要删这个标签** |

`dev-newui` 目前与 `upstream/dev` 齐平,无待同步的上游工作。

## 已完成

| 内容 | commit | 说明 |
|---|---|---|
| 设置页 Material 3 | `5ffbe66` | PR #1004,`agent/settings-new-ui` |
| Popup Material 3 | `a96fdf8` | PR #1013,`agent/popup-m3-redesign` |
| 固定 pnpm 9.14.4 | `2904560` | 见下方「已知坑」 |
| 内容页运行时样式/注入器泄漏修复 | `ffcfbb1` | PR #5(仅评审用),`fix/runtime-style-leak-dev` |
| 设置页草稿身份抖动守卫 | `3876bae` | `StylesSetting.js` / `Prompts.js`,各带一条回归测试;是存储订阅的前置条件 |
| 跨上下文存储订阅 | `a6bf0b1` | `agent/storage-subscriptions-v2`,三个 commit,`--no-ff` 便于整体回滚。详见下方 |
| 字幕运行时四处修复 | `96d8c1d` | 关闭按钮失效 / 悬停暂停卡住 / 空数组当结果 / 样式改动丢失。**均需实机确认** |
| 字幕 CSS 往返截断修复 | `4e9f70e` | `splitCssDeclarations`,16 行。上游 bug,非本次迁移引入 |
| 字幕设置页移植的安全网 | `283cdd7` | 6 个 i18n key + i18n 存在性守卫 + 3 条行为测试。页面未动 |
| 字幕设置页 Material 3 移植 | `55dc0b1` / `01a8947` / `f9ab384` | 10 个控件进 M3 卡片、12 个进高级折叠、样式面板进带标题 section。**已在 dev server 浏览器中验收通过** |
| 词典提示词过期测试修复 | `91039d0` | 测试基线转全绿,解开了 CI 的拦路石 |
| push/PR CI | `4c28586` | `.github/workflows/test.yml`,已在 fork 实跑通过 |
| 同步先落值后落元数据 | `ca0f1ee` | 修掉「设备永久停在旧数据且无报错」;元数据改按键合并 |
| 设置写入改为补丁 | `39bec28` | `settingPatch.js` + `storage.patchObj`;`94fcf96` 的核心重写 |

上述两个 UI PR 的 base 仍指向上游 `fishjar:dev`,在 GitHub 上依旧 open 且显示冲突 —— 本地合并不会自动关闭它们。

## 待办(按优先级)

### ~~1. `agent/atomic-setting-patch`~~ — **三个 commit 全部有结论,分支已归档**

分支已删,内容保存在标签 **`archive/atomic-setting-patch`**。
打标签而不是留分支,是因为本文档引用 `94fcf96` 十三处、含可执行命令
(`git show 94fcf96:<path>`、`git merge-tree --merge-base=94fcf96^ ...`),
而它**只能从这个 ref 到达** —— 直接删分支会让它变成不可达、迟早被 gc,那些引用全部作废。

| commit | 结论 |
|---|---|
| `cdf403a` 编辑草稿保护 | **否决**。与 `a07d39f` 上曾存在的版本字节相同,后被 `ed5e79b` 有意删除 —— 是对一次决策的 revert。详见下方 |
| `b47873c` 跨上下文存储订阅 | **已合入 `a6bf0b1`**,带三个前置修复 |
| `94fcf96` 设置原子写入 | **核心已重写**,见下方 |

#### `cdf403a` 为什么否决(保留备查)

它的核心文件与 `a07d39f`(#1004 的 M3 基线)上曾存在过的版本**字节相同**,后被
`ed5e79b`「Narrow settings UI behavior changes」整个删除:

```
git rev-parse cdf403a:src/views/Options/usePersistedEntityDraft.js  → 9559628c...
git rev-parse a07d39f:src/views/Options/usePersistedEntityDraft.js  → 9559628c...
```

它带的 `StylesSetting.test.js` 用例也是把 `ed5e79b` 删除并反转过的断言原样复活。
另有一处缺陷:`rebaseLocalChanges` 中 baseline 与 draft 一致的 key 走 early return、
从不写入 `next`,persisted 侧为 `{}` 时脏草稿会塌缩成只剩被编辑的字段。

其中唯一值得留下的是 `StylesSetting` 的草稿丢失,已用 6 行内容比对守卫单独修掉(`3876bae`)。

#### `94fcf96` 怎么重写的 —— 取了一半,否决了一半

**先复现再修。** 关于这个 commit 的记录被测量推翻过两次(见文末「测量方法警告」),
所以没有凭推理动手,而是先写测试证明残余存在:两个 hook 同一个键,一个改 `alpha`
一个改 `beta`,断言两者都活下来。**它红了** —— `beta` 在存储里完全消失。残余是真的。

**取:** `settingPatch.js` 原样搬入(纯函数、零依赖、数组整体替换而非按下标合并、
用哨兵处理删除)。`runtimeSettingPatch.js` 重写为 `storage.patchObj` —— 形状完全相同:

| `runtimeSettingPatch.js` | `storage.patchObj`(`39bec28`) |
|---|---|
| `enqueueOperation` promise 队列 | `patchQueues` 按键队列 |
| 读 → `mergeSettingPatch` → 写 | 同上,同一个 `mergeSettingPatch` |
| `putSyncMeta(KV_SETTING_KEY)` | 现有 `debounceSyncMeta` 本来就在做(`Setting.js:99`) |

hook 只写自己改动的字段。**关键细节:** 它登记的自写载荷是**合并结果**而不是打算写的值 ——
别人的字段可能一并落进同一次合并,回声携带的是合并形态,拿原值比对会认领不上,
`828b1bd` 修掉的输入框回退就会复活。`patchObj` 为此留了 `onWillWrite` 同步回调
(回声在 `setObj` 内部发出,等 promise resolve 就晚了)。

**否决:** 后台 worker 序列化。它被 `isExt` 挡住,对油猴和 iOS 完全无效 ——
而那正是回声窗口最宽的地方 —— 代价是一个没有重试、没有超时、失败时静默丢弃的 MV3 依赖。
它另外那些东西(`localChangeRevisionRef` / `remoteSyncRevisionRef` / `dataRef` /
`enqueueSettingWrite` / `applyPersistedSetting` / `isBackgroundManagedSetting`)
全是后台通道的配套,没有后台就不需要 —— 其中那对 revision ref 正是「怎么解都是错」的合并陷阱来源。

**仍开口:** 跨 realm 竞态。同 realm(内容脚本里三个 provider 同处一页,最常见)已完全关闭;
跨 realm 的窗口从「该上下文上次加载至今」缩到**一次存储往返**。要彻底关掉需要跨 realm 的
单一序列化点 —— 那正是后台 worker 的作用。收窄后的窗口若被证明仍会出问题,再回头看。

#### 测量方法警告 —— 这个 commit 上反转过两轮

```
# 错的：旧三参形式输出 diff，冲突标记带 "+" 前缀，锚定 ^ 的 grep 计到 0
git merge-tree 94fcf96^ dev-newui 94fcf96 | grep -c '^<<<<<<<'   # → 0，假的

# 对的：
git merge-tree --write-tree --merge-base=94fcf96^ dev-newui 94fcf96
# → EXIT=1, CONFLICT (content): Merge conflict in src/hooks/Storage.js
```

第二个错误是 grep 模式没覆盖实际新增的行(`localChangeRevisionRef` / `dataRef`),
漏判成「没碰 save/update」。**教训:量之前先确认量法本身。**

### 2. 字幕 — 运行时的高价值部分已做完,剩设置页

**已完成(`96d8c1d`):** 划词提示框关闭按钮失效、悬停暂停后视频卡住、空数组被当成查到词、字幕样式改动 200ms 内切页丢失。四处都配了回归测试,`wordHover.js` 从零覆盖变成有覆盖。

**`9fe10d6`「Align subtitle interactions with upstream behavior」零价值,已划掉。** 它是对 `newui` 自己新增内容的纯 revert(`isPinned`、`#handleWordClick`、`#setRovingTabStop`、`spanListeners` Map),这些在 `dev-newui` 上根本不存在。特别注意:**不要把 `pruneDetachedSpanListeners` 当泄漏修复搬过来** —— 它修的是 `newui` 自己引入的泄漏,`dev-newui` 用 `span.dataset.kissListenerAttached`,监听器随 span 一起消亡。

**剩余运行时部分(`0d533e8` / `cadfde2`):** 字幕轨道恢复、播放期设置热更新。都是针对 `newui` 重构过的文件的重写,且无法脱离真实 YouTube 会话验证,优先级低于设置页。

其中「播放期设置热更新」有战略价值而不只是锦上添花:`a6bf0b1` 的存储订阅目前**只接了一半线** —— 内容脚本消费不了批量设置变更,因为 `YouTubeInitializer` 是一次性的 `if (initialized) return;`,拿着新 setting 对象再调一次会被静默丢弃。

**设置页 UI(`Subtitle.js`)—— 已完成。** 见「已完成」表。移植中确立的几条约束,后人改这个页面时请保留:

- **`segSlug` 保留原生 `TextField`** 而非 `SettingsSelect` —— 后者不暴露 `helperText`/`error`,而 `seg_trans_diff_warning` 那条红字必须活着(`b436d5b` 加入 → `a07d39f` 删除 → `1b10d45` 有意恢复,这是本次迁移第二次撞上「撤销的撤销」)
- **`useAlgorithmBreaker` 必须是独立可达的控件**,不要像 `newui` 那样并进 `segSlug`。选了 AI 断句时它仍是活的兜底,`youtubeAiSegmentation.js` 在三条路径上读它,`SubtitleSegmentationPlayground.js` 也读
- **样式面板的滑块不能换成 `SettingsRange`** —— 它只在 `onChangeCommitted` 提交并在拖动期间只更新本地 `draftValue`,会杀掉 rAF 实时预览
- **样式面板不能放进 `SettingsAdvanced`** —— 那是惰性挂载,首屏不渲染,`Subtitle.test.js` 的 `useFlexGap` 守卫会以 `.closest()` of undefined 抛 TypeError 而不是给出可读的断言失败
- **`handleChange` 的事件签名不能改** —— 三个 `CodeField` 依赖 `e.target.name`,而所有 M3 原语的 `onChange` 都只给裸值

**更正:预览面板没有丢弃 kebab-case 属性。** 本文档一度记载 `SubtitleStylePreview` 把解析出的 CSS 摊进 `style={{...}}` 会导致 React 丢掉 `font-size`、`background-color` 等属性 —— 那是从测试输出里 `Warning: Unsupported style property font-size` 反推的,**方向反了**。浏览器实测:inline style 里这些属性全在,`background-color` 实际渲染成 `rgba(0, 0, 0, 0.5)`,拖字号滑块预览等比跟随。React 对连字符写法只是开发模式告警,照样应用。这里没有 bug,不需要修。

**`subtitleStyleUtils.js` / `useSubtitleStyleEditor.js` 已否决,不要再评估。** 这两个模块(673 行)号称修复 CSS 往返的四类问题,实测只有一类是真的:

- ~~摧毁手写注释~~ —— 假的,注释被吸收进 key 名后原样写回,含冒号的注释也完好
- ~~丢掉没有冒号的声明~~ —— 假的,内容完整保留
- ~~每次滑块 tick 重排整个块~~ —— 假的,`Object.entries` 保序
- **分号出现在引号/括号/注释内部时值被截断** —— 真的,已用 16 行的 `splitCssDeclarations` 修掉(`4e9f70e`)

而引入它们会带来真实风险:`serializeFontSize` 改变字号滑块在出厂默认 `clamp(1rem, 2cqw, 3rem)` 上的语义。用 673 行和一个行为变更去换一个 16 行能解决的问题,不划算。

**另注:该 CSS 往返 bug 不是本次迁移引入的。** `upstream/dev` 的 `Subtitle.js` 同样第 39、58 行、同样 12 处 Slider。评估这块时别把它当成新 UI 的债。

**`fontScale` 不做**(2026-08-22 决定)。它是 `newui` 独有特性,`dev-newui` 全库零引用,做它要连带拉进 7 个文件的运行时改动。设置页移植时直接去掉这个滑块。

`Subtitle.js` 在 `dev-newui` 上已有 37 个提交 —— 上游还在往这个 pre-M3 栅格里加控件,拖越久移植面越大。

### 3. `hooks/Alert.js` — **不要动**

`dev-newui` 的版本与 `upstream/dev` **字节完全相同**,而且 merge-base 也相同:

```
merge-base   : 528c7617...
dev-newui    : 528c7617...
upstream/dev : 528c7617...    ← 三者一致
newui        : 578b2b76...
```

`base == ours` 意味着三方合并会**无冲突标记地静默采用 `newui` 那版**,顺手丢掉上游的 `ab93d1f`(alert 的 wordBreak/maxWidth)、把 `autoHideDuration` 从 5000 退回 2600(反 `0fe680b`)、去掉 Snackbar 退出动画和 `elevation={6}`。文件里那条 `setTimeout(..., 0)` 的 REVIEW 注释是真的,但换来的是把一个和上游同步的文件变成永久冲突点,不值。要修就在 `dev-newui` 上单独小改。

## 暂缓

- **`hooks/Theme.js`**(+200/-39)— 依赖 `brandColor` 新设置项(`dev-newui` 全库无此字段),属于「加功能」而非「修 bug」;其中抽取 `useSystemDarkPreference` 的部分已随 #1004 合入,是重复的
- **划词面板 / 悬浮球** — 详见下方「已调研」
- **CI / 发布流程** — **不建议合**。`dev-newui` 的 `.github/` 与 `upstream/dev` 字节完全一致,`newui` 那套是另一套竞争实现(+159/-69),合入会覆盖上游成果。(更正:此处原先把 `release.yml` 记在 `91a5976` 名下,那个 commit 只动了 `.agents/skills/`、`src/config/api.js` 和 `Apis.test.js`,从未碰过 `.github/`。工作流来自更早的一串 `add workflow` 提交。结论不变,但别照着错的引用去追溯。)
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

**测试基线现在是全绿的**(2026-08-23 起,`91039d0`)。此前 `src/apis/trans.dict.test.js` 长期有 1 条失败,本文档一度把它当成「可接受的非全绿基线」——其实那是一条过期测试:上游 `2432ec1`(#1022)有意把词典提示词的标签从「所在段落:」改成英文,测试没跟着改。现在断言改为从 `defaultDictUserPrompt` 模板自身推导,文案再变也不会误报。

这条清掉后 push/PR CI 才得以加上 —— 见下方。

**push/PR CI 已经有了**(`4c28586`,`.github/workflows/test.yml`)。`on: [push, pull_request]`,跑全量 jest + `build:chrome` + `build:web`,约 2 分钟。已在 fork 上实跑通过:109 套件 / 963 用例全绿。

它和 `release.yml` 有一处**刻意的不同**:不写死 pnpm 版本。`pnpm/action-setup@v4` 会读 `package.json` 的 `packageManager` 字段,这样 pin 只有一处而不是三处(`release.yml` 目前仍硬编码 9.14.4,升级时两个文件都要动)。另外加了一步 `git diff --exit-code pnpm-lock.yaml` —— 一旦有人把 pnpm 提到 10+,overrides 块被删会当场变红,而不是等到发版才发现。

**注意:`gh` 在这个仓库里默认指向上游 `fishjar/kiss-translator`,不是你的 fork。** 查自己的运行记录要显式带 `-R moooyo/kiss-translator`,否则看到的是上游的。按 AGENTS.md 上游是只读的。

## 待实机验证(三项,没有测试能覆盖)

三项都需要**未打包扩展 + 真实 YouTube 页面**。dev server 里的浏览器加载不了扩展,
`YouTubeCaptionProvider.test.js` 又把 XHR 拦截整个 mock 了,所以仓库内无法证明。
建议一次做完 —— 前置条件相同。

### 如果哪一项没过,说明什么

前两项的**机制**已经被测试钉死了(DOMPurify 剥 `on*`、`destroy()` 时 `pointerleave` 不触发),
每条测试都验证过「破坏对应修复它就红、且只有它红」。所以实机不通过的话,
问题几乎一定在**集成层**而不是修复本身:

- **第 1 项点 × 仍无反应** —— 先在 Console 看 `document.querySelector(".kiss-word-tooltip-close").outerHTML`。
  若元素上带着 `onclick`,说明加载的是旧构建;若不带 `onclick` 但点击无效,
  说明委托监听没挂上,查 `showWordTooltip` 里那个 `addEventListener("click", ...)`
- **第 2 项视频仍卡暂停** —— 说明触发路径和记录的不一致。在 Console 观察改设置时
  `YouTubeCaptionProvider` 是否真的走到 `#destroyManager()`;若走的是别的路径,
  那条路径上也要补 `#resumeVideoPausedForHover()`
- **第 3 项 `sheets` 仍在涨** —— 那 `ffcfbb1` 的修复就是没生效。它从来没被实机验证过,
  `#removeTextStyles()` 只有一个调用点(`translator.js:4057`,在整体拆除流程里),
  要确认 SPA 导航是否真的走到那个拆除流程

### 前置(做一次)

```
CI=true pnpm run build:chrome
```

Chrome → `chrome://extensions` → 打开「开发者模式」→「加载已解压的扩展程序」→ 选 `build/chrome`。
然后打开一个**有英文字幕**的 YouTube 视频,在扩展设置里确认:

- 字幕翻译已启用、`Start automatically` 已开(第 2 项依赖 `autoTranslate`,
  `#reProcessEvents()` 开头就是 `if (!this.#setting.autoTranslate) return;`)
- 悬停查词**没被关掉**。默认值 `mobile_off` 在桌面端就是启用的
  (`isSubtitleModeEnabled`:`mobile_off && !isMobile` → true),所以不用改;
  只要确认它不是 `off` 即可。设为 `on` 也行,效果相同。

### 1. 划词提示框的 × 能关掉 — `96d8c1d`

**步骤:** 鼠标悬停在某个英文字幕单词上 → 出现查词提示框 → 点右上角 ×。

**期望:** 提示框消失。

**修复前长什么样:** 点 × 毫无反应。三处关闭按钮当时把逻辑写成内联 `onclick`,
而所有 `innerHTML` 都要过 `trustedTypesHelper.createHTML` → 无配置的 `DOMPurify.sanitize`,
`on*` 属性被一律剥掉。**四个发行渠道都是坏的**,不是 CSP 或 YouTube 特有。

**顺带看:** 查一个 Bing 词典没有释义的生僻词,应当显示「No definition found」
而不是一个空的释义框(空数组曾被当成查到了)。

### 2. 悬停暂停后能恢复播放 — `96d8c1d`

**步骤:** 悬停某个字幕单词(视频会自动暂停)→ **保持鼠标不动**,
从播放器内的字幕菜单改 `segSlug`(AI 断句)或 `aiContextSlug`(智能上下文)。

**期望:** 字幕窗口重建,视频**恢复播放**。

**修复前长什么样:** 视频永远停在暂停,而字幕窗口已经消失、无从恢复。
改这两个设置会走 `#reProcessEvents()` → `#destroyManager()`(`YouTubeCaptionProvider.js:798`)
→ `BilingualSubtitleManager.destroy()`,后者移除的正是光标底下的容器,
于是 `pointerleave` 永远不触发,`#wasPlayingBeforeHover` 永远不清。

**另一条等效路径:** 悬停单词时直接 SPA 导航到另一个视频。

### 3. SPA 反复导航下样式不再累积 — `ffcfbb1`

**步骤:** 在 YouTube 内**点击链接**在视频之间反复跳转(不要刷新页面,刷新会重置一切),
来回 10 次以上。每隔几次在 DevTools Console 跑:

```js
(() => {
  let sheets = 0, roots = 0;
  const walk = (node) => node.querySelectorAll("*").forEach((el) => {
    if (el.shadowRoot) {
      roots++;
      sheets += (el.shadowRoot.adoptedStyleSheets || []).length;
      walk(el.shadowRoot);
    }
  });
  walk(document);
  return { roots, sheets, doc: (document.adoptedStyleSheets || []).length };
})()
```

**期望:** `sheets` 稳定在一个小数值,不随导航次数单调增长。

**修复前长什么样:** 每次 SPA 重启都往 shadow root 里再叠一张样式表,数字一路涨。
`translator.js` 的 `#removeTextStyles()` 只有一个调用点(`:4057`,在整体拆除流程里,
紧挨着 `#removeInjector()`),单测只能验证过滤逻辑,验不了生命周期。

**iOS 的 `@grant` 安装问题已排除,无需实机验证**(2026-08-22 查证)。理由不是「大概没事」,而是这个仓库自己就是现成的对照实验:

`build-ios.mjs` 只改 banner 里的**一行**(`// @grant unsafeWindow` → `// @inject-into content`),其余 18 条原样发往 iOS。而 Userscripts app 的 `validGrants`(`src/ext/shared/utils.js`)是个 15 项的 Set,只收点号拼写的值存储 API。对照下来,**这 7 条现在就在往 iOS 发且都不在白名单里**:

```
GM.registerMenuCommand    GM_registerMenuCommand
GM.unregisterMenuCommand  GM_unregisterMenuCommand
GM_setValue   GM_getValue   GM_deleteValue
```

iOS 版是 Options 页的一级入口且一直装得上,所以不认识的 grant 显然不会导致拒装 —— 新加的 4 条与这 7 条性质完全相同。(该 app 的原生解析器只在缺 `==UserScript==` 块或缺 `@name` 时失败,grant 是 `.filter` 掉的,不是 `guard`。)

**运行时该 app 不支持值变更监听**,两种拼写都没有,也没有 stub。所以 iOS 用户拿不到跨标签页设置同步 —— 这正是我们预期的降级路径,`storage.js` 的 `getOptionalGmMethod` 会吞掉缺失方法,无需额外处理。唯一可见影响是 macOS 端在 app 内置编辑器里手工粘贴脚本时会看到 4 条黄色 lint 提示(`severity: "warning"`,不阻止保存)。

**仓库无 lint script、CI 无 lint/test 步骤**(只有 `release.yml`),所以测试和 lint 需要本地手动跑:

```
CI=true npx react-app-rewired test --watchAll=false
pnpm run build:chrome
```
