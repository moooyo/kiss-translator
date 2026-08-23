# UI 迁移进度 Handoff

**最后更新:** 2026-08-24 · `dev-newui`

把 `newui` 这个单体分支上的 UI 重构,切成可评审的小块逐步合进 `dev-newui` 的进度记录。

---

## 现在卡在哪

**剩下三项实机验证** —— 需要装未打包扩展 + 真实 YouTube 页面,仓库内无法证明。
步骤、期望、以及「没过说明什么」都在文末附录,构建产物在 `build/chrome`。

全量 **1031 通过 / 0 失败**(112 → 114 suite),CI 在每次 push 和 PR 上跑(jest + 两个 target 构建 +
lockfile 校验 + manifest 产物校验)。

还开着的技术项:**跨 realm 设置写入竞态**(「待办 4」)、**AI 词典的存量值校验**(「待办 6」)、
**发布 target 清单双写**(「待办 7」)。三项都不阻塞发版。

## 分支约定

| 分支 | 用途 |
|---|---|
| `dev` | `fishjar/kiss-translator:dev` 的**纯镜像**,不要直接提交 |
| `dev-newui` | **我们自己的发布分支**。所有新 UI 工作从这里切、合回这里。**永远不要合进 `dev`** |
| `newui` | 原始单体分支,包含完整重构。停更于 2026-08-09,**落后大量上游特性**。仍是 M3 移植的唯一参照物,**不要删** |
| `gh-pages` | 网站产物 |
| `archive/atomic-setting-patch`(**标签**) | 已归档的三 commit 栈。本文档多处按 SHA 引用它,**不要删这个标签** |
| `archive/live-settings-combined`(**标签**) | 已归档的 `8414d5f5`(原 `backup/live-settings-combined-20260723`)。内容已全部有归宿,见「已否决」 |

**`dev-newui` 不走上游。** 它是这个 fork 自己的发布分支 —— `.github/workflows/release.yml` 由 `v*` 标签触发,
产出 5 个渠道的 zip。上游 PR #1004 / #1013 已于 2026-08-22 由作者本人关闭,当前没有任何在途的上游 PR。
`dev-newui` 与 `upstream/dev` 齐平(领先 61,落后 0),无待同步的上游工作。

`archive/atomic-setting-patch` 里三个 commit 的归宿:`cdf403a` **否决**、`b47873c` **已合入 `a6bf0b1`**、`94fcf96` **核心已重写为 `storage.patchObj`**。前两者与后者的详情见「已否决(备查)」。

2026-08-24 的清理:已删远程 `beta`、`backup/dev-before-sync-20260809-4fe89cf`、`fix/runtime-style-leak-dev`
(三者均验证过「0 个独有 commit」;删第三个连带关闭了 fork PR #5,其内容早已以 `ffcfbb1` 合入)。
本地 `backup/live-settings-combined-20260723` 归档成标签后删除。
`kiss-translator-splits/` 与 `kiss-translator-popup-m3-review/` 6 个残留目录全部清空 ——
删前逐文件比对过,660 个文件的内容**全部已存在于仓库对象库**,没有丢东西。fork 上仅剩
`dev` / `dev-newui` / `gh-pages` / `newui` 四个分支。

> **`gh` 默认指向上游。** 在这个 checkout 里 `gh` 解析到 `fishjar/kiss-translator` 而不是你的 fork。查自己的 CI 运行记录必须显式带 `-R moooyo/kiss-translator`,否则看到的是上游的历史,会误判成「Actions 没触发」。按 AGENTS.md 上游是只读的。

## 待办

### 1. 三项实机验证 —— 暂缓

按 2026-08-23 的决定,推迟到**代码工作全部结束后统一做**。步骤见文末附录。

### ~~2. `0d533e8`~~ / ~~3. `cadfde2`~~ — 两个都处理完了,只取了值得取的部分

两个 commit 都不是整体移植,而是按**行为**逐条查证后只做缺的那几条。
拆开后 `0d533e8` 的 7 条行为里只有 2 条该做,`cadfde2` 的 3 组里只有 1 组该做。

| 行为 | 结论 |
|---|---|
| 悬停播放:destroy 时恢复播放 / 不误播用户已暂停的视频 | **`96d8c1d` 早已做过**,连测试名都几乎一样 |
| 展示类设置不重建 manager | **本来就有** —— provider 对 `isBilingual`/`blurTranslation`/`displayOrder` 已走 live update |
| 字幕列表在设置变更中存活 | 随上一条免费得到 |
| 悬停查词实时切换 | **不可达** —— 不在播放器内菜单,设置页的变更又被一次性的 `YouTubeInitializer` 丢弃 |
| 面板可见性不丢状态 | 是 dev-newui 的**独立 bug**,但移植 `setVisible` 修不了 —— 没有重开面板的入口 |
| 挂起期间导航后加载 | 其测试调 `YouTubeInitializer.suspend()`,dev-newui 没有 |
| **无响应体时回退取轨** | **已做** `870b7d72` |
| **拦截器晚装时恢复轨道** | **已做** `cca901af` |
| **按默认轨元数据选轨** | **已做** `a12f05ab` |
| 设置页样式编辑(`subtitleStyleUtils.js`) | 属于已否决的模块,见「已否决」 |

**更正:此前本文档说 `cadfde2` 卡在一个产品决定上(要不要推翻 `1b10d45`)。那是错的。**
它确实有一部分依赖那个决定 —— 但那部分早就决定了(否决);而值得取的轨道选取部分
**从来不依赖它**,`findDefaultCaptionTrack` 是纯函数,不 import 设置页那半边任何东西。

**恢复路径的两个设计要点**(改这块前请保留):

- **门控必须实时查询按钮且缺失即关闭。** 不能用 `#isYtSubtitleEnabled()` —— 它在按钮
  不存在时返回 `true`(失败开放),而下游是取轨 → AI 上下文增强 → 翻译,没有任何成本门槛;
  也不能缓存按钮引用 —— 导航后 YouTube 重建控制栏,旧节点已游离,`aria-pressed` 还停在
  导航前的值(这是测试抓出来的真 bug,不是假想)
- **拿不准就不恢复。** `findDefaultCaptionTrack` 在多轨且元数据不足时返回 `null`。
  等真实拦截没有代价(恢复本就是兜底),猜错的代价是加载并翻译一条用户没选的轨

**测试脚手架限制:** `YouTubeCaptionProvider` 没有销毁入口,每次 `initialize()` 挂的
`window` 监听器都留着,provider 在用例间累积。新加的 describe 因此放在文件末尾,
且自身断言避免绝对调用次数。

### 4. 已知开口:跨 realm 设置写入竞态

同 realm(内容脚本里三个 provider 同处一页,最常见)已由 `39bec28` 完全关闭;跨 realm 的窗口从「该上下文上次加载至今」缩到**一次存储往返**。要彻底关掉需要跨 realm 的单一序列化点 —— 那正是被否决的后台 worker 的作用。收窄后的窗口若被证明仍会出问题,再回头看。

### ~~5. 零散~~ — 已做完(`957742b8`)

- 云同步已串行化。`Options/index.js:60` 就是 `Promise.all([trySyncSetting(), trySyncRules()])`,
  交错会丢掉某个键的 `syncAt`,而 `syncAt === 0` 会让 `syncData` 强制 `updateAt = 0`,
  此后远端无条件获胜。**队列里的任务不得再调用入队函数,否则死锁** ——
  `changeSyncEncryptKey` / `syncSettingAndRules` 刻意留在队列外
- pnpm 版本收敛到 `packageManager` 单一来源,两个 workflow 都不再写死
- `.pnpm-version` 保留(可能有外部工具读),但加了测试与 `packageManager` 钉死,漂移会变红

### 6. AI 词典的存量值校验 —— 值得做,不阻塞

`newui` 的 `Selection/dictionaryCapabilities.js` **不是纯重构**。`dev-newui` 在
`TranForm.js:217-245` 有等价的内联逻辑,但少了 4 道校验:

| 校验 | newui | dev-newui 内联 |
|---|---|---|
| API 必须启用 | `!api.isDisabled` | 只按 `apiSlug` 找 |
| API 必须是 AI 类型 | `API_SPE_TYPES.ai.has(apiType)` | 不查 |
| 提示词必须是词典分类 | `category === PROMPT_CATEGORY_DICTIONARY` | 只查 `!prompt` |
| 提示词不能是空白串 | `trim()` 非空 | 纯 truthy,`"   "` 算有 |

**可达性:存量值失效。** 设置页选择器(`Options/Tranbox.js` 的 `aiEnabledApis` /
`dictionaryPromptOptions`)在**选的时候**已经过滤了,所以这 4 道只在用户先选好、
之后再把那个接口停用 / 改成非 AI 类型 / 把提示词改分类时才生效。届时 `dev-newui`
仍会拿它当 AI 词典用,把词典提示词发给一个非 AI 端点。

**另一半 `normalizeDictionaryTab` 不是缺口** —— `TranForm.js:302` 的
`value={defaultDictAvailable ? dictTab : "ai"}` 加 useEffect 已覆盖同样的降级,
`TranForm.js:297` 有 `(defaultDictAvailable || aiDictAvailable)` 总闸,`AiDictCont`
自己也挡了 null。**该取的是那 4 道校验,不是整个文件。**

### 7. 发布 target 清单是双写的

`archive.mjs` 的 `tasks[]` 产出 5 个**不带版本号**的 zip(`chrome.zip`…),
`release.yml` 的 `matrix.client` 又**另外列了一遍**同样 5 个,上传时才拼成
`kiss-translator_<tag>_<client>.zip`。两份清单必须一致,但没有任何东西保证:

- 只加进 `archive.mjs` → zip 造出来了却不上传,**发布里静默少一个包**
- 只加进 `release.yml` → `asset_path` 找不到,当场报错(这个反而安全)

`newui` 的 `release-archives.mjs` 价值就在于把 target 收成一处 frozen 常量 ——
和 `957742b8` 把 pnpm 版本收敛到 `packageManager` 是同一招。**但不能照搬**:
它内部写死 `kiss-translator_v${version}_${target}.zip`,而 `dev-newui` 磁盘上根本
不是这个名字(版本号是 release workflow 拼的)。该取的是「单一来源的 target 列表」。

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
| 字幕轨恢复 | `870b7d72` / `cca901af` / `a12f05ab` | 拦截器晚装时不再永远无字幕;按 YouTube 默认轨元数据选轨,拿不准就不猜 |
| 云同步串行化 + pnpm 单一来源 | `957742b8` | 修掉「丢 syncAt → 远端永远获胜」;`.pnpm-version` 与 `packageManager` 用测试钉死 |
| 划词翻译框 Material 3 + header 重建 | 本次 | `Selection/styles.js` 新增;header 换成 56px + 拖拽手柄 + 溢出菜单。**已在 dev server 浏览器验收(明暗两套)** |
| 悬浮球 Material 3 + 动作菜单 | 本次 | `Action/styles.js` 新增;58px squircle,点击展开 5 项 Popper 菜单。**已在 dev server 浏览器验收(明暗两套)** |
| 拖拽 cancel 兜底 + header 控件护栏 | 本次 | 两个 Draggable 都补了 `pointercancel`/`touchcancel`;详见「拖拽的两条护栏」 |

> 上述两个 UI PR(#1004 / #1013)的 base 曾指向上游 `fishjar:dev`,**已于 2026-08-22 由作者本人关闭**,
> 内容早已以 `5ffbe66` / `a96fdf8` 合入 `dev-newui`。当前没有任何在途的上游 PR。

### 划词框 / 悬浮球 M3 的移植边界

参照物只有 `newui` 一个分支(已删的 `beta` 是它的祖先,`upstream/feat/tones-setting` 动 Selection
是加「翻译风格」功能、与 M3 无关)。两个 `styles.js` 用到的 M3 变量和 `kt-m3-pop` / `kt-m3-rise`
关键帧 `dev-newui` 本来就有,CSS 基本直接可用。

**刻意没取的部分:**

- **`newui` header 上的「翻译/词典」分栏 Tabs** —— 它依赖 `dictionaryCapabilities` 和 `activeView`,
  要连带改 `TranForm`,而 `TranForm` / `TranCont` 是划词面板与 Popup **共用**的。原来 Logo + 版本号
  占的位置保留下来了
- **`newui` 把 `hideClickAway` 画成图钉** —— `dev-newui` 一直是「锁 = 点击外部不消失」「图钉 = 跟随选区」,
  改图标会让老用户对不上。保留原语义
- **`openSeparateWindow` 打开后顺手 `setShowBox(false)`** —— `newui` 这么做了,`dev-newui` 没有。
  那是行为变更不是换皮,连同原 REVIEW 注释一起留着

**6 个 header 控件一个没少**,只是重新分了层:常驻区放「锁定 / 更多 / 关闭」,
其余四个(独立窗口 / 极简模式 / 跟随选区 / 深色模式)收进溢出菜单,`TranBox.test.js` 逐个钉住了。

### 拖拽的两条护栏

- **`pointercancel` / `touchcancel` 必须绑到 `handlePointerUp`**(两个 Draggable 都是)。
  规范上 cancel 之后浏览器**不会再补发 `pointerup` / `touchend`**,而清空 `origin` 的唯一出口就在
  `handlePointerUp` 里。少了它,一次被系统手势(触屏滚动、缩放)打断的拖拽会让 `origin` 永久残留,
  之后指针只要掠过触发区就继续拖动 —— **没有按下任何键**
- **`Selection/DraggableResizable` 的「按在 button 上不起拖」护栏不能照抄到 `Action/Draggable`。**
  前者的触发区是 header 那个 div、按钮是它的子节点,加护栏正确;后者的触发区**本身就是那个
  `<button>`(悬浮球)**,加了护栏整个球就拖不动了。动作菜单挂在 `children` 上,那一侧没绑指针监听
- **`Draggable` 的 `fitContent` / `expanded` 两个新 prop 都是为悬浮球菜单加的**:
  容器带 `willChange: transform`,是内部 fixed 子节点的包含块,58px 固定宽度会把菜单裁掉(`fitContent`);
  贴边时容器只有 0.2 不透明度,菜单挂在同一个容器里会跟着变透明,而这时指针并不在球上(`expanded`)

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

**耦合警告:** `TranForm.js` / `TranCont.js` 是划词面板与 Popup **共用**的,`dev-newui` 上刚被 #1013 改过并带有上游特性,不能直接取 `newui` 版本。悬浮球 `ContentFab.js` 已按 `newui` 的设计重写(M3 + 动作菜单),见「划词框 / 悬浮球 M3 的移植边界」。

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
其中 `manifest-artifacts.mjs` 已单独提取(`016971c5`)。

> **本文档此前说「唯一有价值且无对应物的是 `manifest-artifacts.mjs`」,那句话不准。**
> 同一批里的 `release-archives.mjs` 也无对应物 —— 但它的价值不在文件本身而在「单一来源的
> target 列表」,直接照搬反而会错。详见「待办 7」。
> (另一个 `userscript-metadata.mjs` 确实已有对应物:`src/scripts/userscriptGrants.test.js`。)

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
- **划词面板不是新功能** —— `src/views/Selection/` 最早的 commit 是 2023-10-26,上游 `TranBox.js` 501 行、`newui` 394 行,是**重写+精简**。真正的新增只有「翻译/词典」分栏(**未取**,理由见「移植边界」)、`dictionaryCapabilities.js`(**部分取**,见「待办 6」),以及两个修复:`DraggableResizable` 的 cancel 兜底(**已取**)和 `Action/index.js` 的 `width={360}` 硬编码(**不需要** —— `dev-newui` 的那个 Box 已经不写死宽度,由 `popProps` 传)
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
