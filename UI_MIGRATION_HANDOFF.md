# UI 迁移进度 Handoff

**最后更新:** 2026-08-23 · `dev-newui` @ `4c28586`

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
| 设置页草稿身份抖动守卫 | `3876bae` | `StylesSetting.js` / `Prompts.js`,各带一条回归测试;是存储订阅的前置条件 |
| 跨上下文存储订阅 | `a6bf0b1` | `agent/storage-subscriptions-v2`,三个 commit,`--no-ff` 便于整体回滚。详见下方 |
| 字幕运行时四处修复 | `96d8c1d` | 关闭按钮失效 / 悬停暂停卡住 / 空数组当结果 / 样式改动丢失。**均需实机确认** |
| 字幕 CSS 往返截断修复 | `4e9f70e` | `splitCssDeclarations`,16 行。上游 bug,非本次迁移引入 |
| 字幕设置页移植的安全网 | `283cdd7` | 6 个 i18n key + i18n 存在性守卫 + 3 条行为测试。页面未动 |
| 字幕设置页 Material 3 移植 | `55dc0b1` / `01a8947` / `f9ab384` | 10 个控件进 M3 卡片、12 个进高级折叠、样式面板进带标题 section。**已在 dev server 浏览器中验收通过** |

上述两个 UI PR 的 base 仍指向上游 `fishjar:dev`,在 GitHub 上依旧 open 且显示冲突 —— 本地合并不会自动关闭它们。

## 待办(按优先级)

### 1. `agent/atomic-setting-patch` — 仅剩 `94fcf96`,建议下个版本再处理

2026-08-22 对三个 commit 逐个复审,推翻了此前「合栈顶即含全部三个」的建议 —— 那样做会踩下面的陷阱。三个 commit 得到三种不同结论:`cdf403a` 丢弃、`b47873c` 已合入、`94fcf96` 待改造。

`94fcf96` 不急:它依赖的 `b47873c` 刚落地,建议先跑一个版本观察订阅在真实环境(尤其油猴和 iOS)的表现,再动设置写入的序列化。

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

#### `b47873c` 跨上下文存储订阅 —— **已合入 `a6bf0b1`**

以 `agent/storage-subscriptions-v2` 落地,三个 commit:cherry-pick 原样搬入 → 三个前置修复 → 对抗式复审揪出的四个缺陷。零冲突,和预估一致。

复审发现的问题里有一个是**订阅本身引入的回归**,记在这里以免后人重新踩:每一次写入都会回到写入方自己(扩展走 `browser.storage.onChanged`,油猴走 `set()` 里的 `emitStorageChange`,后者在 `await setValue` resolve 之后才发)。两次写入同时在途时,第 N-1 次的回声会把状态打回去,而写盘副作用随即提前返回,新值再也写不出去。在油猴桥接上这个窗口经常超过两次击键的间隔,`syncKey` 这类字段会被看着往回跳。现在 `useStorage` 按实例记住自己写出的载荷并丢弃对应回声 —— 抑制是**按 hook 实例**且**一次性**的,兄弟 provider 照常收到变更。

另外三处:`reload()` 补上 external 标记(和挂载路径同一个毛病);`gm.js` 的 value-change handler 校验载荷形状(`listenerId` 与 `promiseGM` 的 pong 取自同一个约 1e6 名字池,而这个分支第一次让通道长期存活,撞名会把设置静默重置成默认值);`save()`/`update()` 的副作用移出 state 更新函数。

**仍未关闭 —— 写 PR/发版说明时不要说反了:** 整对象覆盖依然存在。五个 provider 各写各的整份快照,「A 改 X 的同时 B 改 Y」仍是最后写的人赢。订阅把过期窗口从数小时压到一次存储往返,概率低了几个数量级,但**后果更重**:输的一方现在带着 external 标记采纳赢家快照,不再像以前那样在下次编辑时自愈。只有 `94fcf96` 的字段级 patch 序列化能让它可交换。

**iOS 安装问题已排除,不必实机验证** —— 理由见下方「待实机验证」一节末尾。运行时该 app 不支持值变更监听,降级路径是安全的(`storage.js` 的 `getOptionalGmMethod` 会吞掉异常,退化成同 realm 内同步)。`src/scripts/userscriptGrants.test.js` 守着这 4 行不被误删,但 CI 不跑 jest,所以只在本地有效。

#### `94fcf96` 设置原子写入 —— **重新实现,不要 cherry-pick**

`settingPatch.js` 本身干净、纯函数、测试扎实(含一条移除队列就会失败的真实交错测试),零夹带。但:

**它现在会冲突了,而且冲突是语义分歧而非漂移。**`a6bf0b1` 之后实测:

```
git merge-tree --write-tree --name-only dev-newui 94fcf96
→ CONFLICT (content): Merge conflict in src/hooks/Storage.js
→ CONFLICT (content): Merge conflict in src/hooks/Storage.test.js
```

它的 hunk 写在 `b47873c` 那版 hook 之上,而 `828b1bd` 又改了同一处。其中两个 hunk 会把副作用装回 `setData` 更新函数里 —— 那正是 `828b1bd` 有意移出去的(原因见 `src/hooks/Storage.js` 里 `save()` 上方的注释:React 会主动调用更新函数,返回原值时直接退出、既不重渲染也不提交,而 `hooks/Rules.js` 的 `add`/`del`/`merge` 正是这么写的)。所以**照着当前文件重写,别解冲突**。

三处待改造:

- 后台经 `getSettingWithDefault()` 读写回存,而 `storage.js:173` 上方注释明说那层归一化**只在内存中**做。持久化它会把 `config/api.js` 里 `thinkingEffort: "_default"`(「接口默认,不注入参数」)替换成具体值写死 —— 用户从未选择的推理强度参数从此被注入,且不可恢复。应改读原始 `getSetting()`
- 「Serialize」名不副实:`sync.js:394` 和 `:519` 仍在做未入队的整对象 `setSetting` —— 这是**最大的整对象覆盖来源**,而这个 commit 完全没碰它
- SW 往返无失败兜底。不会丢(patch 是累积的、会向前 rebase),但反过来:一个未刷出的 delta 会变成不可见、无上限的 per-tab override,遮盖其他上下文的值。需要 sendBgMsg 失败时直接写存储的 plan B

#### 合并机制与陷阱

`cdf403a` 是**最老**的 commit,不能「合栈顶跳过它」—— `b47873c` 已用 cherry-pick 单独取出(见上),`94fcf96` 同理。两边文件集无交集(`comm -12` 为空),后两个从不引用该 hook 或任何 Options 文件,所以这样做是安全的。

**陷阱:** 直接 `git merge` 整个 `agent/atomic-setting-patch` 时 `Prompts.js` 会**无冲突标记地自动合并**,悄悄把 `ed5e79b` 从该文件移除的机制装回去,而 `Apis.js` / `StylesSetting.js` 还挂在冲突里。谁按 `dev-newui` 解完那几处冲突,就会得到三个组件用两套草稿机制、且没有任何信号。cherry-pick 可完全避开。

处理完 `94fcf96` 之后,`agent/atomic-setting-patch` 这个分支就可以删了 —— 它剩下的唯一内容是已被否决的 `cdf403a`。

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
