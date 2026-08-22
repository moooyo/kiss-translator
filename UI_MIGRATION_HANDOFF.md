# UI 迁移进度 Handoff

**最后更新:** 2026-08-23 · `dev-newui` @ `016971c5`

把 `newui` 这个单体分支上的 UI 重构,切成可评审的小块逐步合进 `dev-newui` 的进度记录。

---

## 现在卡在哪

**三项实机验证** —— 需要装未打包扩展 + 真实 YouTube 页面,仓库内无法证明。详细步骤见文末附录。

在它们完成前,**建议不要动字幕的两个运行时项**(`0d533e8` / `cadfde2`)—— 它们改的是同一批文件,叠上去之后万一验证出问题,分不清是哪一批引入的。

除此之外没有阻塞项。全量 **973 通过 / 0 失败**,CI 在每次 push 和 PR 上跑,`build:chrome` 和 `build:web` 均通过。

## 分支约定

| 分支 | 用途 |
|---|---|
| `dev` | `fishjar/kiss-translator:dev` 的**纯镜像**,不要直接提交 |
| `dev-newui` | 新 UI 主线。所有新 UI 工作从这里切、合回这里 |
| `newui` | 原始单体分支,包含完整重构。停更于 2026-08-09,**落后大量上游特性** |
| `beta` | `newui` 的祖先(7/20 旧快照),无独有内容,**可忽略** |
| `backup/dev-before-sync-*` | 同步前的安全快照,内容已含于 `newui`/`beta` |
| `archive/atomic-setting-patch`(**标签**) | 已归档的三 commit 栈。本文档多处按 SHA 引用它,**不要删这个标签** |

所有 `agent/*` 分支及其 worktree 已于 2026-08-23 清理(本地 + origin)。删除前逐个确认过可达性:
三个 atomic-setting-patch 栈分支包含在归档标签里,`settings-new-ui` / `popup-m3-redesign` /
`storage-subscriptions-v2` 的 tip 已是 `dev-newui` 的祖先 —— 没有 commit 被孤儿化。

> Windows 路径长度限制导致两个 worktree 目录未能删净(`splits/editor-draft-protection`、
> `kiss-translator-popup-m3-review`)。git 侧注册已移除,磁盘上是纯残留,可手工删。

`dev-newui` 与 `upstream/dev` 齐平,无待同步的上游工作。

`archive/atomic-setting-patch` 里三个 commit 的归宿:`cdf403a` **否决**、`b47873c` **已合入 `a6bf0b1`**、`94fcf96` **核心已重写为 `storage.patchObj`**。前两者与后者的详情见「已否决(备查)」。

> **`gh` 默认指向上游。** 在这个 checkout 里 `gh` 解析到 `fishjar/kiss-translator` 而不是你的 fork。查自己的 CI 运行记录必须显式带 `-R moooyo/kiss-translator`,否则看到的是上游的历史,会误判成「Actions 没触发」。按 AGENTS.md 上游是只读的。

## 待办

### 1. 三项实机验证 —— 暂缓

按 2026-08-23 的决定,推迟到**代码工作全部结束后统一做**。步骤见文末附录。

### 2. `0d533e8` 字幕轨道恢复 / 播放期重配置

**前置阻塞:`wordHover.js`。** `96d8c1d` 重写过它,它在 merge 冲突集里。newui 的
`YouTubeSubtitleList.js` 调用 `_wordTooltipController.updateSetting(...)`(:221)和
`pruneDetachedSpanListeners()`(:578),而 `dev-newui` 的 controller 公开面只有
`attachSpanListeners` / `destroy` / `clearHoverState` / `hideWordTooltip` —— **两个都不存在**。
`:578` 那处的 `?.` 挡的是 controller 为 null、不是方法缺失,所以悬停查词开着时每次虚拟渲染都会抛。

**注意 `spanListeners` 是回归不是修复:** `dev-newui` 用 `span.dataset.kissListenerAttached`,
监听器随 span 消亡;newui 换成以 span 为键的强引用 Map,`pruneDetachedSpanListeners`
存在的唯一目的就是擦它自己造的泄漏。引入等于给一个不存在的问题加上泄漏和每帧开销。

**另有一处静默失败:** newui `YTSL:219` 调 `addWordHoverStyles(this.theme)`,而 `dev-newui` 的
`wordHover.js:12` 是 `export const addWordHoverStyles = () => {` —— 零参数,还有幂等早退。
参数被接受并丢弃,整套 brandColor/darkMode 管线**看起来接好了,实际什么也不做**。

### 3. `cadfde2` 字幕背景预设 / M3 改版 —— **卡在一个产品决定上**

它重写 `src/views/Options/subtitleStyleUtils.js`(+236)—— 而那正是 `1b10d45` 因为
「PR #1004 把字幕排除在 M3 改版之外」而**有意删掉**的 533 行。要动它,先得决定
**要不要推翻那个范围决定**。这不是合并问题。

若两个都要做,**顺序是 `0d533e8` 在前** —— 它带着 provider 的 reconciliation 块,
而 `cadfde2` 的 `Menus.js` 改动假定它已存在。

### 4. 已知开口:跨 realm 设置写入竞态

同 realm(内容脚本里三个 provider 同处一页,最常见)已由 `39bec28` 完全关闭;跨 realm 的窗口从「该上下文上次加载至今」缩到**一次存储往返**。要彻底关掉需要跨 realm 的单一序列化点 —— 那正是被否决的后台 worker 的作用。收窄后的窗口若被证明仍会出问题,再回头看。

### 5. 零散(互不阻塞,随时可做)

- `release.yml` 仍把 pnpm 版本硬编码为 9.14.4,而 `test.yml` 已改为从 `packageManager` 读
- `.pnpm-version` 记录了同一版本号,但**仓库里没有任何地方读取它**
- 并发的 `trySyncSetting/Rules/Words` 仍可能在 `putSyncMeta` 的读-改-写之间交错(窗口已是微秒级)

## 已完成

| 内容 | commit | 说明 |
|---|---|---|
| 设置页 Material 3 | `5ffbe66` | PR #1004,`agent/settings-new-ui` |
| Popup Material 3 | `a96fdf8` | PR #1013,`agent/popup-m3-redesign` |
| 固定 pnpm 9.14.4 | `2904560` | 见「已知坑」 |
| 内容页运行时样式/注入器泄漏修复 | `ffcfbb1` | PR #5(仅评审用)。**从未实机验证过** |
| 设置页草稿身份抖动守卫 | `3876bae` | `StylesSetting.js` / `Prompts.js`,各带回归测试 |
| 跨上下文存储订阅 | `a6bf0b1` | `agent/storage-subscriptions-v2`,`--no-ff` 便于整体回滚 |
| 字幕运行时四处修复 | `96d8c1d` | 关闭按钮失效 / 悬停暂停卡住 / 空数组当结果 / 样式改动丢失。**均需实机确认** |
| 字幕 CSS 往返截断修复 | `4e9f70e` | `splitCssDeclarations`,16 行 |
| 字幕设置页移植安全网 | `283cdd7` | 6 个 i18n key + 存在性守卫 + 3 条行为测试。页面未动 |
| 字幕设置页 Material 3 | `55dc0b1` / `01a8947` / `f9ab384` | **已在 dev server 浏览器验收通过** |
| 词典提示词过期测试修复 | `91039d0` | 测试基线转全绿,解开 CI 拦路石 |
| push/PR CI | `4c28586` | `.github/workflows/test.yml`,已在 fork 实跑通过 |
| 同步先落值后落元数据 | `ca0f1ee` | 修掉「设备永久停在旧数据且无报错」 |
| 设置写入改为补丁 | `39bec28` | `settingPatch.js` + `storage.patchObj`;`94fcf96` 的核心重写 |
| 播放器内菜单加显示顺序 | `7355d2a1` | 从 `Menus.js` 提取的唯一一块;管路本来就通,只缺控件 |
| CI 校验 manifest 产物 | `016971c5` | `manifest-artifacts.mjs` + `verify-manifest.mjs`,已在 CI 实跑 |

> 上述两个 UI PR 的 base 仍指向上游 `fishjar:dev`,在 GitHub 上依旧 open 且显示冲突 —— 本地合并不会自动关闭它们。

## 改这些地方前必须知道的约束

### 字幕设置页(`Subtitle.js`)

- **`segSlug` 必须保留原生 `TextField`**,不能换 `SettingsSelect` —— 后者不暴露 `helperText`/`error`,而 `seg_trans_diff_warning` 那条红字必须活着(`b436d5b` 加入 → `a07d39f` 删除 → `1b10d45` **有意恢复**)
- **`useAlgorithmBreaker` 必须是独立可达的控件**,不要像 `newui` 那样并进 `segSlug`。选了 AI 断句时它仍是活的兜底,`youtubeAiSegmentation.js` 三条路径读它,`SubtitleSegmentationPlayground.js` 也读
- **样式面板的滑块不能换成 `SettingsRange`** —— 它只在 `onChangeCommitted` 提交、拖动期间只更新本地 `draftValue`,会杀掉 rAF 实时预览
- **样式面板不能放进 `SettingsAdvanced`** —— 那是惰性挂载,首屏不渲染,`useFlexGap` 守卫会以 `.closest()` of undefined 抛 TypeError 而不是给出可读的断言失败
- **`handleChange` 的事件签名不能改** —— 三个 `CodeField` 依赖 `e.target.name`,而所有 M3 原语的 `onChange` 都只给裸值

### `hooks/Alert.js` —— **不要动**

`dev-newui`、`upstream/dev` 和 merge-base 三者**字节完全相同**(`528c7617...`),`newui` 是 `578b2b76...`。

`base == ours` 意味着三方合并会**无冲突标记地静默采用 `newui` 那版**,顺手丢掉上游 `ab93d1f`(wordBreak/maxWidth)、把 `autoHideDuration` 从 5000 退回 2600(反 `0fe680b`)、去掉退出动画和 `elevation={6}`。文件里 `setTimeout(..., 0)` 那条 REVIEW 注释是真的,但代价是把一个和上游同步的文件变成永久冲突点。要修就在 `dev-newui` 上单独小改。

### 别直接 merge `newui`

它停更于 2026-08-09,直接合会回退这些上游特性:QwenMT、Yandex、Google Cloud Translation、剪贴板自动翻译(#1024)、悬停气泡独立翻译服务(#1015)、生词本词典提示(#1014)、语言变体翻译(#1017)、英文词典提示词预设(#1022)、CVE-2026-54466 修复(#1001)。

**耦合警告:** `TranForm.js` / `TranCont.js` 是划词面板与 Popup **共用**的,`dev-newui` 上刚被 #1013 改过并带有上游特性,不能直接取 `newui` 版本。悬浮球 `ContentFab.js` 耦合最小,自分叉后未被改动过。

## 已知坑

**pnpm 版本必须是 9.14.4。** `package.json` 的 `packageManager` 字段已固定。用更高版本(如 `npx pnpm` 拉到的最新版)执行安装或构建时,pnpm 10+ 不再读取 `pnpm.overrides`,会把 `pnpm-lock.yaml` 的 `overrides` 块整个删掉 —— 那是 `0273e52` 针对 CVE-2026-54466 的三个 pin(`fast-xml-parser`、`shell-quote`、`websocket-driver`)。CI 里的 `git diff --exit-code pnpm-lock.yaml` 会当场抓到这种情况。

**测试基线是全绿的**(2026-08-23 起)。此前 `trans.dict.test.js` 长期有 1 条失败,本文档一度把它当成「可接受的非全绿基线」—— 其实是条过期测试:上游 `2432ec1`(#1022)有意把词典提示词标签从「所在段落:」改成英文,测试没跟着改。现在断言从 `defaultDictUserPrompt` 模板自身推导,文案再变也不会误报。**看到失败就当真,别再对照什么基线。**

**本地验证命令:**

```
CI=true npx react-app-rewired test --watchAll=false
CI=true pnpm run build:chrome
```

CI(`test.yml`)跑的是同样的内容加 `build:web`,约 2 分钟。它和 `release.yml` 有一处刻意的不同:不写死 pnpm 版本,由 `pnpm/action-setup@v4` 读 `packageManager`。

## 已否决(备查,避免重复评估)

### `cdf403a` 编辑草稿保护

核心文件与 `a07d39f`(#1004 的 M3 基线)上曾存在过的版本**字节相同**,后被 `ed5e79b`「Narrow settings UI behavior changes」整个删除 —— 是对一次有意决策的 revert:

```
git rev-parse cdf403a:src/views/Options/usePersistedEntityDraft.js  → 9559628c...
git rev-parse a07d39f:src/views/Options/usePersistedEntityDraft.js  → 9559628c...
```

它带的 `StylesSetting.test.js` 用例也是把 `ed5e79b` 删除并反转过的断言原样复活。另有一处缺陷:`rebaseLocalChanges` 中 baseline 与 draft 一致的 key 走 early return、从不写入 `next`,persisted 侧为 `{}` 时脏草稿会塌缩成只剩被编辑的字段。

其中唯一值得留下的是 `StylesSetting` 的草稿丢失,已用 6 行内容比对守卫单独修掉(`3876bae`)。

### `94fcf96` 的后台序列化(核心已重写)

**先复现再修。** 关于这个 commit 的记录被测量推翻过两次,所以没有凭推理动手,而是先写测试证明残余存在:两个 hook 同一个键,一个改 `alpha` 一个改 `beta`,断言两者都活下来。**它红了** —— `beta` 在存储里完全消失。

**取的部分:** `settingPatch.js` 原样搬入。`runtimeSettingPatch.js` 重写为 `storage.patchObj`,形状完全相同:

| `runtimeSettingPatch.js` | `storage.patchObj`(`39bec28`) |
|---|---|
| `enqueueOperation` promise 队列 | `patchQueues` 按键队列 |
| 读 → `mergeSettingPatch` → 写 | 同上,同一个 `mergeSettingPatch` |
| `putSyncMeta(KV_SETTING_KEY)` | 现有 `debounceSyncMeta` 本来就在做(`Setting.js:99`) |

**关键细节:** hook 登记的自写载荷是**合并结果**而不是打算写的值 —— 别人的字段可能一并落进同一次合并,回声携带的是合并形态,拿原值比对会认领不上,`828b1bd` 修掉的输入框回退就会复活。`patchObj` 为此留了 `onWillWrite` 同步回调(回声在 `setObj` 内部发出,等 promise resolve 就晚了)。

**否决的部分:** 后台 worker 序列化。被 `isExt` 挡住,对油猴和 iOS 完全无效 —— 而那正是回声窗口最宽的地方 —— 代价是一个没有重试、没有超时、失败时静默丢弃的 MV3 依赖。其余机件(`localChangeRevisionRef` / `remoteSyncRevisionRef` / `dataRef` / `enqueueSettingWrite` / `applyPersistedSetting` / `isBackgroundManagedSetting`)全是后台通道的配套,没有后台就不需要 —— 那对 revision ref 正是「怎么解都是错」的合并陷阱来源。

> **测量方法警告 —— 这个 commit 上反转过两轮,两次都是量法错而非看错代码:**
>
> ```
> # 错：旧三参形式输出 diff，冲突标记带 "+" 前缀，锚定 ^ 的 grep 计到 0
> git merge-tree 94fcf96^ dev-newui 94fcf96 | grep -c '^<<<<<<<'   # → 0，假的
>
> # 对：
> git merge-tree --write-tree --merge-base=94fcf96^ dev-newui 94fcf96
> # → EXIT=1, CONFLICT (content): Merge conflict in src/hooks/Storage.js
> ```
>
> 第二次是 grep 模式没覆盖实际新增的行(`localChangeRevisionRef` / `dataRef`),漏判成「没碰 save/update」。**量之前先确认量法本身。**

### `subtitleStyleUtils.js` / `useSubtitleStyleEditor.js`

这两个模块(673 行)号称修复 CSS 往返的四类问题,实测只有一类是真的:

- ~~摧毁手写注释~~ —— 假的,注释被吸收进 key 名后原样写回,含冒号的也完好
- ~~丢掉没有冒号的声明~~ —— 假的,内容完整保留
- ~~每次滑块 tick 重排整个块~~ —— 假的,`Object.entries` 保序
- **分号出现在引号/括号/注释内部时值被截断** —— 真的,已用 16 行的 `splitCssDeclarations` 修掉(`4e9f70e`)

引入它们的真实风险:`serializeFontSize` 改变字号滑块在出厂默认 `clamp(1rem, 2cqw, 3rem)` 上的语义。用 673 行加一个行为变更换一个 16 行能解决的问题,不划算。

**该 CSS 往返 bug 不是本次迁移引入的** —— `upstream/dev` 的 `Subtitle.js` 同样第 39、58 行、同样 12 处 Slider。

### `src/subtitle/YouTubeSubtitleList.js` 单独取

不是一个独立的文件问题 —— 它的实质改动是 `0d533e8` 的客户端一半。同一个 commit
同时引入 `setVisible` **和它唯一的调用者**(provider 的 changedNames reconciliation),
`dev-newui` 的 provider 对这两个符号都是零命中。单独取这个文件会得到死代码,
外加悬停查词开着时每次虚拟渲染必抛的 `pruneDetachedSpanListeners`。
按文件逐个决策在这里是个分类错误 —— 它归 `0d533e8` 管,见「待办 2」。

### `src/scripts/verify-build.mjs` 整体取

脚本本身在 `dev-newui` 上跑不起来:引用 4 个 `pnpm build` 从不产出的 safari 路径,
`--release` 那半边编码了 newui 自己的归档命名与目录约定,而 CI 只构建 7 个 target 中的 2 个。
其中唯一有价值且无对应物的是 `manifest-artifacts.mjs`,已单独提取(`016971c5`)。

### `src/subtitle/Menus.js` 整体取

600 行里只有 `displayOrder` 值得单独取(已做,`7355d2a1`)。其余是 M3 改版加背景预设,
归 `cadfde2` —— 见「待办 3」的产品决定。逐个控件追过出处才敢单独取:
`displayOrder` / `apiSlug` 来自 `1efda9d`,`fontScale` 来自 `348c090`,只有 `windowStyle` 在 `cadfde2` 里。

**一个曾被标记、但查证后不成立的风险:** 怀疑 newui 的 `Menus.js` 会绕过悬停暂停修复
依赖的拆除路径。**不成立** —— 它整个写入面只有 3 行,全是同一个 `updateSetting` prop,
没有写存储、没有 hook、没有直接调 manager;而 `96d8c1d` 动的 5 个文件里既没有
`Menus.js` 也没有 `YouTubeCaptionProvider.js`。

### `9fe10d6`「Align subtitle interactions with upstream behavior」

零价值。它是对 `newui` 自己新增内容的纯 revert(`isPinned`、`#handleWordClick`、`#setRovingTabStop`、`spanListeners` Map),这些在 `dev-newui` 上根本不存在。**特别注意:不要把 `pruneDetachedSpanListeners` 当泄漏修复搬过来** —— 它修的是 `newui` 自己引入的泄漏,`dev-newui` 用 `span.dataset.kissListenerAttached`,监听器随 span 一起消亡。

### `fontScale`

不做(2026-08-22 决定)。`newui` 独有特性,`dev-newui` 全库零引用,做它要连带拉进 7 个文件的运行时改动。

### 其他

- **`hooks/Theme.js`**(+200/-39)—— 依赖 `brandColor` 新设置项(`dev-newui` 全库无此字段),属于「加功能」而非「修 bug」;其中抽取 `useSystemDarkPreference` 的部分已随 #1004 合入,是重复的
- **`newui` 的 CI / 发布流程** —— 不建议合。`dev-newui` 的 `.github/` 与 `upstream/dev` 字节一致,`newui` 那套是竞争实现(+159/-69),合入会覆盖上游成果
- **`apis/index.js` 批量并发兜底值** `1` → `DEFAULT_BATCH_CONCURRENCY`:默认值本来就是 10,兜底只在值非法时触发,`1` 是更安全的落点
- **`subtitleIndexAlign.js`** —— 纯提取变量,零行为变化
- **`MSG_TRANS_TOGGLE` 支持 `args.enabled`** —— `dev-newui` 已从上游获得
- **划词面板不是新功能** —— `src/views/Selection/` 最早的 commit 是 2023-10-26,上游 `TranBox.js` 501 行、`newui` 394 行,是**重写+精简**。真正的新增只有「翻译/词典」分栏、`dictionaryCapabilities.js`,以及两个修复
- **预览面板没有丢弃 kebab-case 属性** —— 本文档一度这么记载,是从 `Warning: Unsupported style property` 反推的,**方向反了**。浏览器实测这些属性全在且实际渲染。React 对连字符写法只是开发模式告警,照样应用
- **iOS 的 `@grant` 安装问题** —— 已排除,理由见附录末尾

---

# 附录:实机验证清单(三项)

三项都需要**未打包扩展 + 真实 YouTube 页面**。dev server 里的浏览器加载不了扩展,`YouTubeCaptionProvider.test.js` 又把 XHR 拦截整个 mock 了,所以仓库内无法证明。建议一次做完 —— 前置条件相同。

## 前置(做一次)

```
CI=true pnpm run build:chrome
```

Chrome → `chrome://extensions` → 开发者模式 → 「加载已解压的扩展程序」→ 选 `build/chrome`。

打开一个**有英文字幕**的 YouTube 视频,确认:

- 字幕翻译已启用、`Start automatically` 已开。**第 2 项依赖 `autoTranslate`** —— `#reProcessEvents()` 开头就是 `if (!this.#setting.autoTranslate) return;`,关着的话整条路径不触发、**看起来像通过了**
- 悬停查词没被关掉。默认值 `mobile_off` 在桌面端就是启用的(`isSubtitleModeEnabled`:`mobile_off && !isMobile` → true),不用改,只要确认不是 `off`

## 1. 划词提示框的 × 能关掉 — `96d8c1d`

**步骤:** 悬停某个英文字幕单词 → 出现查词提示框 → 点右上角 ×
**期望:** 提示框消失
**修复前:** 点 × 毫无反应。三处关闭按钮当时写成内联 `onclick`,而所有 `innerHTML` 都要过 `trustedTypesHelper.createHTML` → 无配置的 `DOMPurify.sanitize`,`on*` 属性被一律剥掉。**四个发行渠道都是坏的**,不是 CSP 或 YouTube 特有

**顺带看:** 查一个 Bing 词典没有释义的生僻词,应显示「No definition found」而不是空的释义框

## 2. 悬停暂停后能恢复播放 — `96d8c1d`

**步骤:** 悬停某个字幕单词(视频自动暂停)→ **鼠标别动** → 从播放器内字幕菜单改 `segSlug`(AI 断句)或 `aiContextSlug`(智能上下文)
**期望:** 字幕窗口重建,视频**恢复播放**
**修复前:** 视频永远停在暂停,而字幕窗口已消失、无从恢复。改这两个设置会走 `#reProcessEvents()` → `#destroyManager()`(`YouTubeCaptionProvider.js:798`)→ `BilingualSubtitleManager.destroy()`,后者移除的正是光标底下的容器,`pointerleave` 因此永不触发

**等效路径:** 悬停单词时直接 SPA 导航到另一个视频

## 3. SPA 反复导航下样式不再累积 — `ffcfbb1`

**步骤:** 在 YouTube 内**点击链接**在视频间反复跳转(别刷新,刷新会重置一切),10 次以上。每隔几次在 Console 跑:

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

**期望:** `sheets` 稳定在小数值,不随导航次数单调增长
**修复前:** 每次 SPA 重启往 shadow root 再叠一张样式表,数字一路涨

## 如果哪一项没过,说明什么

前两项的**机制**已被测试钉死(DOMPurify 剥 `on*`、`destroy()` 时 `pointerleave` 不触发),每条测试都验证过「破坏对应修复它就红、且只有它红」。所以实机不通过的话,问题几乎一定在**集成层**而不是修复本身:

- **第 1 项点 × 仍无反应** —— Console 看 `document.querySelector(".kiss-word-tooltip-close").outerHTML`。带 `onclick` 说明加载的是旧构建;不带但点击无效,说明委托监听没挂上,查 `showWordTooltip` 里那个 `addEventListener("click", ...)`
- **第 2 项视频仍卡暂停** —— 触发路径和记录的不一致。观察改设置时是否真的走到 `#destroyManager()`;若走别的路径,那条路径也要补 `#resumeVideoPausedForHover()`
- **第 3 项 `sheets` 仍在涨** —— `ffcfbb1` 的修复没生效。它从来没被实机验证过,`#removeTextStyles()` 只有一个调用点(`translator.js:4057`,在整体拆除流程里),要确认 SPA 导航是否真的走到那个流程

## iOS 的 `@grant` 已排除,无需验证

理由不是「大概没事」,而是这个仓库自己就是现成的对照实验:`build-ios.mjs` 只改 banner 里的**一行**(`// @grant unsafeWindow` → `// @inject-into content`),其余 18 条原样发往 iOS。而 Userscripts app 的 `validGrants`(`src/ext/shared/utils.js`)是个 15 项的 Set,只收点号拼写的值存储 API。对照下来,**这 7 条现在就在往 iOS 发且都不在白名单里**:

```
GM.registerMenuCommand    GM_registerMenuCommand
GM.unregisterMenuCommand  GM_unregisterMenuCommand
GM_setValue   GM_getValue   GM_deleteValue
```

iOS 版是 Options 页的一级入口且一直装得上,所以不认识的 grant 显然不会导致拒装。(该 app 的原生解析器只在缺 `==UserScript==` 块或缺 `@name` 时失败,grant 是 `.filter` 掉的,不是 `guard`。)

**运行时该 app 不支持值变更监听**,两种拼写都没有。所以 iOS 用户拿不到跨标签页设置同步 —— 这正是预期的降级路径,`getOptionalGmMethod` 会吞掉缺失方法。唯一可见影响是 macOS 端在 app 内置编辑器里手工粘贴脚本时会看到 4 条黄色 lint 提示(`severity: "warning"`,不阻止保存)。
