# KISS Translator M3 · Handoff

**最后更新:** 2026-08-24 · `moooyo/kiss-translator-m3` @ `dev-newui`

`newui` 那个单体分支上的 M3 重构,已经切成可评审的小块逐步落到 `dev-newui`;
2026-08-24 起这个 fork 与上游分家成独立产品 **KISS Translator M3**。
这份文档写的是**现在的状态和约束**,不是过程流水 —— 过程在 git log 里。

接手时先看「现状」和「未完成的事」,动代码前看「改这些地方前必须知道的约束」,
想搬 `newui` 的东西前看「已否决」,那里记的是**查证过的结论,不要重复评估**。

---

## 现状

| | |
|---|---|
| 代码 | 无已知开放技术项 |
| 测试 | **1113 通过 / 0 失败**(122 suite) |
| CI | 每次 push 和 PR 都跑:jest + chrome/web 两个 target 构建 + lockfile 校验 + manifest 产物校验,约 2 分钟 |
| 上游 | `dev-newui` 与 `upstream/dev` 齐平(领先 61,落后 0),无待同步工作,无在途 PR |
| 身份 | 已与上游分家(存储 / DOM / 油猴 / 扩展 id / 更新 URL),见「产品身份」 |
| 未完成 | **实机验证还剩 2 项**(装机四连检 + `ffcfbb1` 泄漏)。清单 2026-08-24 第一次被执行,当场推翻两项 |

有两件事**不是待办、但必须知道**:跨 realm 设置写入竞态只是被收窄、没有彻底关掉
(见「跨 realm 写入竞态」);以及 `ffcfbb1` 的内容页运行时泄漏修复**从未实机验证过**。

## 分支与仓库约定

仓库是 **`moooyo/kiss-translator-m3`**,站点是 **https://moooyo.github.io/kiss-translator-m3/** 。
2026-08-24 从 `moooyo/kiss-translator` 改名而来,GitHub 为旧名和旧 Pages 地址保留了重定向。

| 分支 | 用途 |
|---|---|
| `dev-newui` | **默认分支兼发布分支**。所有工作从这里切、合回这里,tag 也从这里打 |
| `dev` | `fishjar/kiss-translator:dev` 的**纯镜像**,不要直接提交,**永远不要把 `dev-newui` 合进去** |
| `newui` | 原始单体分支,包含完整重构。停更于 2026-08-09,**落后大量上游特性**。仍是 M3 移植的唯一参照物,**不要删** |
| `gh-pages` | 网站产物 |
| `archive/atomic-setting-patch`(**标签**) | 已归档的三 commit 栈。本文档多处按 SHA 引用它,**不要删这个标签** |
| `archive/live-settings-combined`(**标签**) | 已归档的 `8414d5f5`(原 `backup/live-settings-combined-20260723`)。内容已全部有归宿,见「已否决」 |

**`dev-newui` 不走上游。** `.github/workflows/release.yml` 由 `v*` 标签触发,产出 5 个渠道的 zip,
**第一步会校验 tag 确实在 `dev-newui` 上,不在就直接失败**(那一步需要 `fetch-depth: 0`,
浅克隆拿不到 `merge-base`)。上游 PR #1004 / #1013 已于 2026-08-22 由作者本人关闭。

`archive/atomic-setting-patch` 里三个 commit 的归宿:`cdf403a` **否决**、`b47873c` **已合入 `a6bf0b1`**、
`94fcf96` **核心已重写为 `storage.patchObj`**。详情见「已否决」。

fork 上仅剩 `dev` / `dev-newui` / `gh-pages` / `newui` 四个分支。2026-08-24 删掉了远程 `beta`、
`backup/dev-before-sync-20260809-4fe89cf`、`fix/runtime-style-leak-dev`(三者均验证过「0 个独有 commit」;
删第三个连带关闭了 fork PR #5,其内容早已以 `ffcfbb1` 合入),本地 `backup/live-settings-combined-20260723`
归档成标签后删除。`kiss-translator-splits/` 与 `kiss-translator-popup-m3-review/` 6 个残留目录也清空了 ——
删前逐文件比对过,660 个文件的内容全部已存在于仓库对象库。

> **`gh` 默认指向上游。** 在这个 checkout 里 `gh` 解析到 `fishjar/kiss-translator` 而不是 fork。
> 查自己的 CI 运行记录必须显式带 `-R moooyo/kiss-translator-m3`,否则看到的是上游的历史,
> 会误判成「Actions 没触发」。按 AGENTS.md 上游是只读的。

## 未完成的事:实机验证

需要**装未打包扩展**,仓库内证明不了。完整步骤、期望、以及「没过说明什么」
都在文末附录,构建产物在 `build/chrome`。

> **2026-08-24 这份清单第一次被真正执行,原有两项当场垮掉。** 一项的步骤
> 根本无法执行(见附录第 2 项),另一项测的功能压根不能用(见附录第 1 项)。
> 此前它是**从代码推出来的、从没人跑过**的 —— 那种清单看着扎实,证明不了任何事。
> 附录里每一条现在都注明了是否真被执行过。
>
> 同一天修完后第 1、3 两项已实机通过,剩下第 0 项(装机四连检)和第 4 项
> (`ffcfbb1` 泄漏)还没跑。

> **不能让 agent 代跑(2026-08-24 实测)**:预览浏览器被限制在 localhost,导航到
> `https://www.youtube.com/` 会直接弹回 `localhost:3000`;页面里也没有 `chrome.runtime`,
> 不是扩展上下文,装不了未打包扩展。**只能人工做。**
>
> 但 popup 和独立窗口**可以**在 dev server 里看(`/popup.html`、`/popup.html#tranbox`),
> 那条路径已经跑通,布局问题不必等实机。

曾经列在这里的「SPA 反复导航下样式累积」**已改由测试覆盖,不必手工做**:
`translator.test.js` 连跑 4 轮「注入 → stop」,`document` 与 shadow root 的 `adoptedStyleSheets`
每轮都回到 0;把 `stop()` 里的 `#removeTextStyles()` 去掉这条测试立刻变红、且只有它红。
触发链也查证过:`TranslatorManager.restart()` → `#destroyRuntimeModules()` → `translator.stop()`
→ `#removeTextStyles()`。

## 跨 realm 写入竞态 —— 收窄了,但关不掉

同 realm 由 `39bec28` 的队列**完全关闭**。跨 realm 现在走**逐字段 Lamport 版本戳 + 事后重放**
(`src/libs/fieldRevisions.js`),覆盖仍会发生,但会被识别并修回来。

**为什么是版本戳而不是比值。** 事后看到「beta 变回了旧值」有两种可能:对方故意改回去了,
或者对方用过期快照把它顺手抹了。**光看值分不出来**,一律重放就会复活用户在另一个标签页
刚改掉的设置 —— 那正是 `94fcf96` 那对 revision ref「怎么解都是错」的坑。戳能分:戳单调递增,
所以「存储里这个字段的戳比我写进去的还旧」只可能是被过期快照覆盖了。

**改这块前必须保留的设计点:**

- **戳放旁挂键 `<key>__kissFieldRevisions`,不进设置对象。** 设置对象会被
  `getSettingWithDefault` 到处读、还会整份上云同步,往里塞内部字段要牵动迁移、同步和
  每一个消费方
- **写入顺序是先戳后值。** 值的写入才会触发订阅回声,对方收到回声时才去读戳 ——
  反过来写的话,那一刻戳还没落盘,对方读到旧戳、判定「我的写入还在」,漏掉一次重放;
  而戳键本身没有订阅者,不会再唤醒任何人
- **戳是 `[counter, realmId]`。** 只比 counter 不够:两个 realm 各自把 3 推到 4,
  谁也看不出对方覆盖了自己
- **只认严格更旧。** 相同说明我的写入还在,更新说明对方在我之后做了真正的修改。
  去掉这个判断会让重放**永不收敛** —— 实测直接把测试跑挂
- **删除也要算一次改动。** 不给它更高的戳,「A 删掉某字段、B 用旧快照写回来」检测不到

**还剩什么(诚实记账):**

1. 这是**事后修复**,不是预防。期间另一个上下文的界面可能短暂闪回旧值
2. 还剩一条更窄的缝:值和戳是两次写、两次读,不是原子的。对方的戳写入落在我读戳之前、
   值写入落在我读值之后时,我会保留它的戳却丢掉它的值 —— 这种检测不到。宽度是一次
   存储往返内的一小段,而不是原来的整个交错窗口。**要消灭它需要值与戳的原子写入,
   `chrome.storage` / GM / localStorage 都不提供** —— 所以这不是「还没做」,是做不了
3. **iOS 没有值变更监听**(见附录末尾),收不到回声也就不会重放,那条渠道退化成今天的行为

---

# 改这些地方前必须知道的约束

## 产品身份:改名会牵动哪些东西

2026-08-24 从上游分家成独立产品 `KISS Translator M3`。**这是一个新项目,不做任何迁移** ——
不兼容上游的数据,也不兼容我们自己 v2.0.28–30 的数据。

`.env` 的 `REACT_APP_NAME` 是总开关。`src/config/app.js` 从它推导 `APP_NAME`
(`.trim().split(/\s+/).join("-")`)和 `APP_LCNAME`,再连锁决定:

```
存储键前缀   KISS-Translator-M3_setting_v0 等全部 STOKEY_*
             (尾部的 v0 来自 APP_VERSION[0],版本回到 0.0.1 后就是 0)
CacheStorage KISS-Translator-M3_cache
DOM ID       #kiss-translator-m3-fab / -box / -popup
译文 CSS 类  .kiss-translator-m3-wrapper / -inner / -term ... 共 10 个
WebDAV 目录  /kiss-translator-m3/
```

**动 `REACT_APP_NAME` 就是动上面全部五项**,而且没有任何迁移兜底。

### 不由 `APP_NAME` 推导、必须单独维护的身份面

| 位置 | 值 | 为什么必须是我们自己的 |
|---|---|---|
| `manifest.firefox.json` / `.thunderbird.json` 的 `gecko.id` | `kiss-translator-m3@moooyo.github.io` | 上游 thunderbird 那份写的是**上游作者的邮箱**,不改就是同一个扩展 |
| `build-safari.mjs` 的 `identifier` | `com.moooyo.kiss-translator-m3` | Safari bundle id |
| `config-overrides.js` 的 banner | `@name` + `@namespace` | 油猴管理器认的就是这两个的组合 |
| `config-overrides.js` 的 entry key | `kiss-translator-m3.user` | 决定产物文件名,`build-ios.mjs` 里也硬编码了两处 |
| `src/config/storage.js` 的 `KV_*_KEY` / `KV_SALT_*` | `kiss-m3-*` / `KISS-Translator-M3-*` | WebDAV 靠目录分家,但 Gist / KISS-Worker 是扁平的,只有文件名能分 |

### Chrome 的 `key` 字段:换掉它等于清空所有用户数据

`public/manifest.json` 里的 `key` 是 DER 公钥的 base64,决定扩展 ID
**`enhckapfllnpbdljjmkdkihlcjjikpob`**。

Chrome 的 ID 是公钥 SHA-256 前 128 位、十六进制每个 nibble 按 `0-f → a-p` 映射。
**没有 `key` 时,「加载已解压的扩展程序」按目录的绝对路径推导 ID** ——
而 `chrome.storage` 是按扩展 ID 分区的。我们按 zip 发版、解压出来是一个 `chrome/` 目录,
用户把新版本解到另一个位置,设置、规则、生词本就全部读不到。`key` 就是为这个加的。

反过来:**换掉这个 key,所有现有用户的 ID 随之改变,等同于清空他们的数据。**
`src/scripts/extensionId.test.js` 把公钥和推导出的 ID 一起钉死,改 key 会当场变红 ——
那条红必须是一次有意识的决定,不是顺手接受。

- **私钥不在仓库里,也不需要它。** 只有公钥进 manifest(公钥本来就是公开的)。
  私钥仅在签 `.crx` 时才用得上,而我们发的是 zip 让用户 Load unpacked。
  生成时那份 `.pem` 落在 gitignore 掉的 `tmp/` 下,**要留就自己挪进密码管理器,别提交**。
- **`key` 是 Chromium 专有的。** Edge 复用 chrome 产物,所以一并生效;
  Gecko 两个 manifest 走 `browser_specific_settings.gecko.id`,**不要**给它们加 `key`,
  测试里也钉了这一条。
- **以后真要上 Chrome 应用商店时需要单独查一次**:商店用它自己的密钥,
  manifest 里带着自选的 `key` 可能要先删掉。这条没有查证过,不要当结论用。

Chrome MV3 本身没有 `id` 字段,`key` 是唯一能固定 ID 的途径。

### 三个「会互相破坏」的碰撞面(改名时最容易漏)

这三个不改的话,两个扩展装在一起会**真的把对方弄坏**,不是「显示重复」那么轻:

- **Trusted Types 策略名**(`libs/trustedTypes.js`)。同一个文档里 `createPolicy` 重名会**直接抛**,
  后装的那个拿不到策略,所有 `innerHTML` 消毒路径失效
- **`data-<app>-shadow-host` 属性**(`libs/shadowHost.js`)。`content.js` 的 `removeStaleShadowHosts`
  按它清理陈旧宿主 —— 沿用同一个属性名就会**把对方的宿主一起删掉**
- **`Symbol.for("<app>.popup-manager")`**(`libs/popupManager.js`)。全局符号注册表是整页共享的,
  两个扩展会抢同一个 popup manager 单例

**反过来,`injectors/xmlhttp.js` 刻意不改。** 它的 `__KISS_TRANSLATOR_XHR_INTERCEPTOR__` 守卫
让两个扩展**共用一份** XHR 拦截器,而 `KISS_XHR_DATA_YOUTUBE` 本来就是广播消息 —— 各自装一份
反而会双重包装 `XMLHttpRequest.open`、字幕数据收两遍。

### Emotion cache key 不接受数字

`@emotion/cache` 的 `key` **只允许小写字母和连字符**,传进数字直接抛
"Emotion key must only contain lower case alphabetical characters and -"。
而 `ShadowDomManager` 捕获后只记一条 warn —— 表现是**整个组件静默挂不上**,不是报错。

应用名带了 `M3`,`kiss-translator-m3-popup` 当场就踩中。已在
`shadowDomManager.js` 的 `toEmotionCacheKey()` 里统一兜住(`kiss-translator-m-popup`),
`shadowDomManager.test.js` 钉着。**新增 ShadowDomManager 调用方时不用再各自处理。**

### 一个副产物:旧版迁移代码已经不可达

`STOKEY_SETTING_OLD` / `STOKEY_RULES_OLD` / `STOKEY_SETTING_BACKUP_V1_BEFORE_V2` 都是
`${APP_NAME}_*` 拼的,改名后它们指向的键**从来没被写过**,`runDataMigration()`
(`src/libs/storage.js`)和 v1→v2→v3 那套迁移永远不会触发。

没在改名这一轮删它 —— 那会牵动 `background.js` / `common.js` / `Options/index.js` 三个调用点
和一批测试,混在一起不好评审。**留作单独一轮清理**,现在只是死代码,不影响行为。

## 字幕设置页(`Subtitle.js`)

- **`segSlug` 必须保留原生 `TextField`**,不能换 `SettingsSelect` —— 后者不暴露 `helperText`/`error`,而 `seg_trans_diff_warning` 那条红字必须活着(`b436d5b` 加入 → `a07d39f` 删除 → `1b10d45` **有意恢复**)
- **`useAlgorithmBreaker` 必须是独立可达的控件**,不要像 `newui` 那样并进 `segSlug`。选了 AI 断句时它仍是活的兜底,`youtubeAiSegmentation.js` 三条路径读它,`SubtitleSegmentationPlayground.js` 也读
- **样式面板的滑块不能换成 `SettingsRange`** —— 它只在 `onChangeCommitted` 提交、拖动期间只更新本地 `draftValue`,会杀掉 rAF 实时预览
- **样式面板不能放进 `SettingsAdvanced`** —— 那是惰性挂载,首屏不渲染,`useFlexGap` 守卫会以 `.closest()` of undefined 抛 TypeError 而不是给出可读的断言失败
- **`handleChange` 的事件签名不能改** —— 三个 `CodeField` 依赖 `e.target.name`,而所有 M3 原语的 `onChange` 都只给裸值

## `hooks/Alert.js` —— **不要动**

`dev-newui`、`upstream/dev` 和 merge-base 三者**字节完全相同**(`528c7617...`),`newui` 是 `578b2b76...`。

`base == ours` 意味着三方合并会**无冲突标记地静默采用 `newui` 那版**,顺手丢掉上游 `ab93d1f`(wordBreak/maxWidth)、把 `autoHideDuration` 从 5000 退回 2600(反 `0fe680b`)、去掉退出动画和 `elevation={6}`。文件里 `setTimeout(..., 0)` 那条 REVIEW 注释是真的,但代价是把一个和上游同步的文件变成永久冲突点。要修就在 `dev-newui` 上单独小改。

## 划词框的垂直几何

`libs/tranboxPosition.js` 的 `TRANBOX_CHROME_HEIGHT` **是三处 CSS 的手工汇总,没有任何东西自动同步**:

```
56px   Selection/styles.js 的 .kt-tranbox-header { min-height }
8 + 8  DraggableResizable 的 lineWidth = 4 → gridTemplateRows 上下两行
2px    Selection/styles.js 的 .KT-draggable-body { border: 1px } 上下各一
```

M3 改版把 header 从 36px 提到 56px、又加了卡片边框,这个常量当时留在 52 没动,
`getMaxTranBoxContentHeight` / `getMaxTranBoxY` 因此整整放宽了 22px —— 小视口下框体探出屏幕底部。
`6eeddc06` 已改为 74。

**改这三处 CSS 中的任何一处,都要回来改这个常量**,并同步下面三个测试里写死的数字:
`tranboxPosition.test.js`、`useTranBoxState.test.js`(3 处)、`useSelectionController.test.js`(1 处)。
后两者的断言里都写了推导算式,照着改即可。

## 查词气泡是 popover,**不要让它自己消失**(`wordHover.js`)

它里面有收藏(♡)和关闭(×)两个按钮,而它固定显示在播放器右上角、字幕在
底部中间 —— 够到它要跨半个播放器。**任何「离开就收起」的实现都会让这两个
按钮点不到**,不管超时给多长:播放器多大、鼠标多快都会翻盘。

这不是假设。2026-08-24 实机测出来的原话是「鼠标一移出去马上就没了」,
当时是 100ms。第一次修把它提到 500ms 并加了「指针进入就取消」,**实测依旧不行**,
才换成现在的模型。

只有这四件事会关掉它,都与时间无关:点 ×、在它外面按下指针、悬停另一个单词、
管理器销毁。离开单词只取消**还没弹出来**的那次。

播放恢复用同一套逻辑:`BilingualSubtitleManager` 看两个状态位
(指针是否在字幕上、提示框是否开着),**两个都为假才恢复**,没有计时器。
`pointerenter` 里 `#wasPlayingBeforeHover` 必须用 `||=` 而不是直接赋值 ——
从提示框走回字幕时视频还停着,直接赋值会把「本来在播」的记录冲掉,之后永不恢复。

## 查词气泡的异步守卫(`wordHover.js`)

`showWordTooltip` **必须用局部变量持有本次创建的气泡,每次 DOM 写入前比对身份**。
悬停有 300ms 延时、移出有 100ms 延时,掠过两个词时两次查词必然重叠;直接写 `this.tooltipEl`
会把上一个词的标题、释义和收藏按钮整个画进当前这个词的气泡里(`e41c0578` 修掉)。

**守卫只挡 DOM 写入,不要往上挪。** `#dispatchAddWord` 喂的是 `YouTubeSubtitleList.addWord` ——
按拼写合并的「用户查过的词」流水账,不是当前显示内容。用户确实查了那个词,晚到的结果仍该收录。
`newui` 的版本把守卫放在 dispatch 之前,连生词记录一起丢了。有一条测试专门钉这个决定。

`saveFavoriteWordIfMissing` **必须有自己的 catch** —— 裸放在外层 try 里,一次收藏写存储失败
会把成功的查词渲染成 "Failed to load definition"。

## 字幕轨恢复的两个设计要点

`870b7d72` / `cca901af` / `a12f05ab` 三个 commit 的恢复路径,改前请保留:

- **门控必须实时查询按钮且缺失即关闭。** 不能用 `#isYtSubtitleEnabled()` —— 它在按钮
  不存在时返回 `true`(失败开放),而下游是取轨 → AI 上下文增强 → 翻译,没有任何成本门槛;
  也不能缓存按钮引用 —— 导航后 YouTube 重建控制栏,旧节点已游离,`aria-pressed` 还停在
  导航前的值(这是测试抓出来的真 bug,不是假想)
- **拿不准就不恢复。** `findDefaultCaptionTrack` 在多轨且元数据不足时返回 `null`。
  等真实拦截没有代价(恢复本就是兜底),猜错的代价是加载并翻译一条用户没选的轨

## `YouTubeCaptionProvider` 的测试脚手架限制

**它没有销毁入口**,每次 `initialize()` 挂的 `window` 监听器都留着,provider 在用例间累积。
新加的 describe 因此要放在文件末尾,且断言要避开绝对调用次数。

顺带:正因为它是一次性单例(`YouTubeInitializer` 的 `initialized` 标志,永不重跑),
播放器 UI 那些「清理」在这边是不可达的 —— 见「已否决 → `newui` 复核」。

## 云同步队列不得自调用

`957742b8` 把云同步串行化了。**队列里的任务不得再调用入队函数,否则死锁** ——
`changeSyncEncryptKey` / `syncSettingAndRules` 是刻意留在队列外的。

为什么要串行:`Options/index.js:60` 原来是 `Promise.all([trySyncSetting(), trySyncRules()])`,
交错会丢掉某个键的 `syncAt`,而 `syncAt === 0` 会让 `syncData` 强制 `updateAt = 0`,
此后远端无条件获胜。

## 发布渠道清单:比成员,不比顺序

渠道清单的单一来源是 `src/scripts/releaseTargets.mjs`,`archive.mjs` 直接读它。
YAML 写不了 import,所以 `releaseTargets.test.js` 把 `release.yml` 的 `matrix.client`
钉在同一份清单上 —— 只往一边加渠道会当场变红。

**断言比的是成员不是顺序**:matrix 里每个 client 是各自独立的 job,钉死顺序只会让
一次可读性调整无端变红。

历史上两份清单是双写的:只加进 `archive.mjs` → zip 造出来了却不上传,**发布里静默少一个包**;
只加进 `release.yml` → `asset_path` 找不到,当场报错(这个反而安全)。

## 划词框 / 悬浮球 M3 的移植边界

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

## 拖拽的三条护栏

- **`pointercancel` / `touchcancel` 必须绑到 `handlePointerUp`**(两个 Draggable 都是)。
  规范上 cancel 之后浏览器**不会再补发 `pointerup` / `touchend`**,而清空 `origin` 的唯一出口就在
  `handlePointerUp` 里。少了它,一次被系统手势(触屏滚动、缩放)打断的拖拽会让 `origin` 永久残留,
  之后指针只要掠过触发区就继续拖动 —— **没有按下任何键**
- **`Selection/DraggableResizable` 的「按在 button 上不起拖」护栏不能照抄到 `Action/Draggable`。**
  前者的触发区是 header 那个 div、按钮是它的子节点,加护栏正确;后者的触发区**本身就是那个
  `<button>`(悬浮球)**,加了护栏整个球就拖不动了。动作菜单挂在 `children` 上,那一侧没绑指针监听
- **`Draggable` 的 `fitContent` / `expanded` 两个 prop 都是为悬浮球菜单加的**:
  容器带 `willChange: transform`,是内部 fixed 子节点的包含块,58px 固定宽度会把菜单裁掉(`fitContent`);
  贴边时容器只有 0.2 不透明度,菜单挂在同一个容器里会跟着变透明,而这时指针并不在球上(`expanded`)

## 别直接 merge `newui`

它停更于 2026-08-09,直接合会回退这些上游特性:QwenMT、Yandex、Google Cloud Translation、
剪贴板自动翻译(#1024)、悬停气泡独立翻译服务(#1015)、生词本词典提示(#1014)、
语言变体翻译(#1017)、英文词典提示词预设(#1022)、CVE-2026-54466 修复(#1001)。

**`newui` 自己也落后:** 它的 `pnpm.overrides` 只有 2 个 CVE pin(缺 `websocket-driver`),
`config/msg.js` 里删掉了 `EVENT_FAVORITE_WORD_CHANGE`(上游 #1014),
也没有 `sendTopFrameMsg` / `shadowHost.js` / `useRules` 的 `isLoading` / `translateVariants` /
`packageManager` 钉版 / `test.yml`。

**耦合警告:** `TranForm.js` / `TranCont.js` 是划词面板与 Popup **共用**的,`dev-newui` 上刚被
#1013 改过并带有上游特性,不能直接取 `newui` 版本。悬浮球 `ContentFab.js` 已按 `newui` 的设计
重写(M3 + 动作菜单),见「划词框 / 悬浮球 M3 的移植边界」。

## 已知坑(构建 / 测试 / 环境)

**`pnpm format` 的 glob 含 `.mjs`,并且有 CI 闸。** 曾经是 `"**/*.{js,json,html}"`,`.mjs` 不在里面 ——
`build-task.mjs` / `sync-version.mjs` / `update-version.mjs` 三个发布脚本因此从未被格式化过,
谁跑一次 `pnpm format` 都会冒出一堆无关 diff。现在 glob 加宽了、三个文件也格式化了,
CI 走 `pnpm run format:check`,`formatGlob.test.js` 把 `format` 和 `format:check` 两条脚本的
glob 钉在一起。**加新文件类型时两条都要改**,只改一条会当场变红。

**pnpm 版本必须是 9.14.4。** `package.json` 的 `packageManager` 字段已固定。用更高版本
(如 `npx pnpm` 拉到的最新版)执行安装或构建时,pnpm 10+ 不再读取 `pnpm.overrides`,
会把 `pnpm-lock.yaml` 的 `overrides` 块整个删掉 —— 那是 `0273e52` 针对 CVE-2026-54466 的
三个 pin(`fast-xml-parser`、`shell-quote`、`websocket-driver`)。CI 里的
`git diff --exit-code pnpm-lock.yaml` 会当场抓到这种情况。

**测试基线是全绿的**(2026-08-23 起)。此前 `trans.dict.test.js` 长期有 1 条失败,本文档一度把它
当成「可接受的非全绿基线」—— 其实是条过期测试:上游 `2432ec1`(#1022)有意把词典提示词标签
从「所在段落:」改成英文,测试没跟着改。现在断言从 `defaultDictUserPrompt` 模板自身推导,
文案再变也不会误报。**看到失败就当真,别再对照什么基线。**

**本地验证命令:**

```
CI=true npx react-app-rewired test --watchAll=false
CI=true pnpm run build:chrome
```

CI(`test.yml`)跑的是同样的内容加 `build:web`,约 2 分钟。它和 `release.yml` 有一处刻意的不同:
不写死 pnpm 版本,由 `pnpm/action-setup@v4` 读 `packageManager`。

---

# 已否决(备查,避免重复评估)

## `newui` 复核(2026-08-24)

**方法。** 以 merge-base `8c99a340` 做三方比对,而不是直接 diff 两个 tip ——
两边都动过的文件里,「谁改了 base」才分得出是「没搬」还是「重做过」。
结果:236 个文件有差异,其中 146 个两边都改过(**26 个已字节收敛**),38 个只有 `newui` 改过。
另外把 `newui` 独有的 6 个测试文件真拷进仓库跑了一遍 jest —— 光读代码判断不了它们能不能过。

**捞出 5 个此前没记录的真实缺口,已全部修完**,见「已完成索引」表末尾。

**下面 3 条曾被怀疑、查证后不成立,不要再评估:**

- **`youtubePlayerUi.js` 的 `waitForElement` 无清理句柄 / 没有 `destroyNotification()`** ——
  **不可达**。`waitForElement` 命中即 `obs.disconnect()`;`YouTubeInitializer` 是一次性单例
  (`initialized` 标志,永不重跑),provider 也没有销毁入口。那两个清理是给 `newui` 自己的
  `suspend()` / `destroy()` 用的,而那套机制属于已否决的后台通道
- **`config/setting.js` 的 `logLevel: LogLevel?.INFO?.value ?? 1`** —— 看着像循环引用防御,
  实际是 `newui` 自己 `subtitle.test.js` 里 `jest.mock("../libs/log.js")` 没提供 `LogLevel`
  造成的。**是测试 mock 的缺陷,不是源码问题,别改源码**
- **`newui` 独有的另外 4 个测试文件** —— `subtitle.test.js` 测的全是
  `setSubtitleInterceptorEnabled` / `stopSubtitle` / `suspend`,即已否决的机制;
  `Alert.test.js` 测 `newui` 的 Alert 重写(见「`hooks/Alert.js` —— 不要动」);
  `Rules.test.js` 要求先把 `patchRuleList` 从 `useRules` 里提出来,是纯重构;
  `I18n.test.js` 有 2 条断言已否决的 `settings_brand_color` key。四个都不取

**下面几项是有意不做的产品/工程决定:**

- **ESLint 独立闸(`newui` 的 `check:lint`)** —— 实测 `npx eslint src --ext .js` 共 311 个问题,
  **全部在测试文件里**,非测试源码 0 问题。搬 `newui` 的 `eslintConfig.overrides` 能消掉 304 个,
  剩 7 个中 5 个是真的(3 × `no-unused-vars` + 2 × `no-useless-escape`)、2 个是误报
  (`await-async-utils` 撞了项目自己的同名 `waitForElement`;`jest/valid-expect` 在
  `batchQueue.test.js:99` 是「先存变量再 await」的刻意写法)。**这道闸目前抓不到任何真 bug**,
  价值只有防回归,不做
- **`sync-version --check`** —— `newui` 有只校验不写的模式,`dev-newui` 没有。不做
- **字幕默认渲染样式** —— `newui` 把 `originStyle` / `translationStyle` / `windowStyle` 换成了
  M3 排版(px clamp + 字重 + 译文 `#C6DAFF` + 圆角背景)。**保持上游默认**(2026-08-24 决定)
- **播放器内菜单的「全部字幕设置 →」入口(`all_subtitle_settings`)** —— 不做
- **`release.yml` 的硬化项**(action SHA 钉版 / `concurrency` group / `timeout-minutes` /
  `workflow_dispatch` 重发已有 tag)—— 整套竞争实现已否决,这 4 项可单独摘但当前不做

## `0d533e8` / `cadfde2` 的逐条裁定

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
| 设置页样式编辑(`subtitleStyleUtils.js`) | 属于已否决的模块,见下文 |

**更正:此前本文档说 `cadfde2` 卡在一个产品决定上(要不要推翻 `1b10d45`)。那是错的。**
它确实有一部分依赖那个决定 —— 但那部分早就决定了(否决);而值得取的轨道选取部分
**从来不依赖它**,`findDefaultCaptionTrack` 是纯函数,不 import 设置页那半边任何东西。

## AI 词典存量值校验(部分取,`b2de7684`)

只取了 4 道校验补进 `TranForm.js` 的 `aiDictApiSetting`,**没有引入
`dictionaryCapabilities.js` 整个文件**。`TranForm.test.js` 里 5 条反例 + 1 条正例钉住
(去掉任一道校验都会让对应那条变红)。

`dev-newui` 在 `TranForm.js:217-245` 本来就有等价的内联逻辑,少的是这 4 道:

| 校验 | newui | dev-newui 原内联 |
|---|---|---|
| API 必须启用 | `!api.isDisabled` | 只按 `apiSlug` 找 |
| API 必须是 AI 类型 | `API_SPE_TYPES.ai.has(apiType)` | 不查 |
| 提示词必须是词典分类 | `category === PROMPT_CATEGORY_DICTIONARY` | 只查 `!prompt` |
| 提示词不能是空白串 | `trim()` 非空 | 纯 truthy,`"   "` 算有 |

**可达性:存量值失效。** 设置页选择器(`Options/Tranbox.js` 的 `aiEnabledApis` /
`dictionaryPromptOptions`)在**选的时候**已经过滤了,所以这 4 道只在用户先选好、
之后再把那个接口停用 / 改成非 AI 类型 / 把提示词改分类时才生效。

**另一半 `normalizeDictionaryTab` 不是缺口** —— `TranForm.js:302` 的
`value={defaultDictAvailable ? dictTab : "ai"}` 加 useEffect 已覆盖同样的降级,
`TranForm.js:297` 有 `(defaultDictAvailable || aiDictAvailable)` 总闸,`AiDictCont`
自己也挡了 null。

## `cdf403a` 编辑草稿保护

核心文件与 `a07d39f`(#1004 的 M3 基线)上曾存在过的版本**字节相同**,后被 `ed5e79b`
「Narrow settings UI behavior changes」整个删除 —— 是对一次有意决策的 revert:

```
git rev-parse cdf403a:src/views/Options/usePersistedEntityDraft.js  → 9559628c...
git rev-parse a07d39f:src/views/Options/usePersistedEntityDraft.js  → 9559628c...
```

它带的 `StylesSetting.test.js` 用例也是把 `ed5e79b` 删除并反转过的断言原样复活。另有一处缺陷:
`rebaseLocalChanges` 中 baseline 与 draft 一致的 key 走 early return、从不写入 `next`,
persisted 侧为 `{}` 时脏草稿会塌缩成只剩被编辑的字段。

其中唯一值得留下的是 `StylesSetting` 的草稿丢失,已用 6 行内容比对守卫单独修掉(`3876bae`)。

## `94fcf96` 的后台序列化(核心已重写)

**先复现再修。** 关于这个 commit 的记录被测量推翻过两次,所以没有凭推理动手,而是先写测试
证明残余存在:两个 hook 同一个键,一个改 `alpha` 一个改 `beta`,断言两者都活下来。
**它红了** —— `beta` 在存储里完全消失。

**取的部分:** `settingPatch.js` 原样搬入。`runtimeSettingPatch.js` 重写为 `storage.patchObj`,
形状完全相同:

| `runtimeSettingPatch.js` | `storage.patchObj`(`39bec28`) |
|---|---|
| `enqueueOperation` promise 队列 | `patchQueues` 按键队列 |
| 读 → `mergeSettingPatch` → 写 | 同上,同一个 `mergeSettingPatch` |
| `putSyncMeta(KV_SETTING_KEY)` | 现有 `debounceSyncMeta` 本来就在做(`Setting.js:99`) |

**关键细节:** hook 登记的自写载荷是**合并结果**而不是打算写的值 —— 别人的字段可能一并落进
同一次合并,回声携带的是合并形态,拿原值比对会认领不上,`828b1bd` 修掉的输入框回退就会复活。
`patchObj` 为此留了 `onWillWrite` 同步回调(回声在 `setObj` 内部发出,等 promise resolve 就晚了)。

**否决的部分:** 后台 worker 序列化。被 `isExt` 挡住,对油猴和 iOS 完全无效 —— 而那正是回声窗口
最宽的地方 —— 代价是一个没有重试、没有超时、失败时静默丢弃的 MV3 依赖。其余机件
(`localChangeRevisionRef` / `remoteSyncRevisionRef` / `dataRef` / `enqueueSettingWrite` /
`applyPersistedSetting` / `isBackgroundManagedSetting`)全是后台通道的配套,没有后台就不需要 ——
那对 revision ref 正是「怎么解都是错」的合并陷阱来源。

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
> 第二次是 grep 模式没覆盖实际新增的行(`localChangeRevisionRef` / `dataRef`),
> 漏判成「没碰 save/update」。**量之前先确认量法本身。**

## `subtitleStyleUtils.js` / `useSubtitleStyleEditor.js`

这两个模块(673 行)号称修复 CSS 往返的四类问题,实测只有一类是真的:

- ~~摧毁手写注释~~ —— 假的,注释被吸收进 key 名后原样写回,含冒号的也完好
- ~~丢掉没有冒号的声明~~ —— 假的,内容完整保留
- ~~每次滑块 tick 重排整个块~~ —— 假的,`Object.entries` 保序
- **分号出现在引号/括号/注释内部时值被截断** —— 真的,已用 16 行的 `splitCssDeclarations` 修掉(`4e9f70e`)

引入它们的真实风险:`serializeFontSize` 改变字号滑块在出厂默认 `clamp(1rem, 2cqw, 3rem)` 上的语义。
用 673 行加一个行为变更换一个 16 行能解决的问题,不划算。

**该 CSS 往返 bug 不是本次迁移引入的** —— `upstream/dev` 的 `Subtitle.js` 同样第 39、58 行、
同样 12 处 Slider。

## `src/subtitle/YouTubeSubtitleList.js` 单独取

不是一个独立的文件问题 —— 它的实质改动是 `0d533e8` 的客户端一半。同一个 commit
同时引入 `setVisible` **和它唯一的调用者**(provider 的 changedNames reconciliation),
`dev-newui` 的 provider 对这两个符号都是零命中。单独取这个文件会得到死代码,
外加悬停查词开着时每次虚拟渲染必抛的 `pruneDetachedSpanListeners`。
按文件逐个决策在这里是个分类错误 —— 它归 `0d533e8` 管,见上文的逐条裁定。

## `src/scripts/verify-build.mjs` 整体取

脚本本身在 `dev-newui` 上跑不起来:引用 4 个 `pnpm build` 从不产出的 safari 路径,
`--release` 那半边编码了 newui 自己的归档命名与目录约定,而 CI 只构建 7 个 target 中的 2 个。
其中 `manifest-artifacts.mjs` 已单独提取(`016971c5`)。

> **本文档此前说「唯一有价值且无对应物的是 `manifest-artifacts.mjs`」,那句话不准。**
> 同一批里的 `release-archives.mjs` 也无对应物 —— 但它的价值不在文件本身而在「单一来源的
> target 列表」,直接照搬反而会错(它内部写死 `kiss-translator_v${version}_${target}.zip`,
> 而 `dev-newui` 磁盘上不是这个名字,版本号是 release workflow 拼的)。
> 见「发布渠道清单:比成员,不比顺序」。
> (另一个 `userscript-metadata.mjs` 确实已有对应物:`src/scripts/userscriptGrants.test.js`。)

## `src/subtitle/Menus.js` 整体取

600 行里只有 `displayOrder` 值得单独取(已做,`7355d2a1`)。其余是 M3 改版加背景预设,
归 `cadfde2` —— 见上文的逐条裁定。逐个控件追过出处才敢单独取:
`displayOrder` / `apiSlug` 来自 `1efda9d`,`fontScale` 来自 `348c090`,只有 `windowStyle` 在 `cadfde2` 里。

**一个曾被标记、但查证后不成立的风险:** 怀疑 newui 的 `Menus.js` 会绕过悬停暂停修复
依赖的拆除路径。**不成立** —— 它整个写入面只有 3 行,全是同一个 `updateSetting` prop,
没有写存储、没有 hook、没有直接调 manager;而 `96d8c1d` 动的 5 个文件里既没有
`Menus.js` 也没有 `YouTubeCaptionProvider.js`。

## `9fe10d6`「Align subtitle interactions with upstream behavior」

零价值。它是对 `newui` 自己新增内容的纯 revert(`isPinned`、`#handleWordClick`、
`#setRovingTabStop`、`spanListeners` Map),这些在 `dev-newui` 上根本不存在。
**特别注意:不要把 `pruneDetachedSpanListeners` 当泄漏修复搬过来** —— 它修的是 `newui`
自己引入的泄漏,`dev-newui` 用 `span.dataset.kissListenerAttached`,监听器随 span 一起消亡。

## `fontScale`

不做(2026-08-22 决定)。`newui` 独有特性,`dev-newui` 全库零引用,做它要连带拉进 7 个文件的运行时改动。

## 其他

- **`hooks/Theme.js`**(+200/-39)—— 依赖 `brandColor` 新设置项(`dev-newui` 全库无此字段),属于「加功能」而非「修 bug」;其中抽取 `useSystemDarkPreference` 的部分已随 #1004 合入,是重复的
- **`newui` 的 CI / 发布流程** —— 不建议合,那是竞争实现(+159/-69),合入会覆盖上游成果
- **`apis/index.js` 批量并发兜底值** `1` → `DEFAULT_BATCH_CONCURRENCY`:默认值本来就是 10,兜底只在值非法时触发,`1` 是更安全的落点
- **`subtitleIndexAlign.js`** —— 纯提取变量,零行为变化
- **`MSG_TRANS_TOGGLE` 支持 `args.enabled`** —— `dev-newui` 已从上游获得
- **划词面板不是新功能** —— `src/views/Selection/` 最早的 commit 是 2023-10-26,上游 `TranBox.js` 501 行、`newui` 394 行,是**重写+精简**。真正的新增只有「翻译/词典」分栏(**未取**,见「移植边界」)、`dictionaryCapabilities.js`(**部分取**,见「AI 词典存量值校验」),以及两个修复:`DraggableResizable` 的 cancel 兜底(**已取**)和 `Action/index.js` 的 `width={360}` 硬编码(**不需要** —— `dev-newui` 的那个 Box 已经不写死宽度,由 `popProps` 传)
- **预览面板没有丢弃 kebab-case 属性** —— 本文档一度这么记载,是从 `Warning: Unsupported style property` 反推的,**方向反了**。浏览器实测这些属性全在且实际渲染。React 对连字符写法只是开发模式告警,照样应用
- **iOS 的 `@grant` 安装问题** —— 已排除,理由见附录末尾

---

# 已完成索引

按主题查「这块是谁做的、在哪个 commit」。**「已在 dev server 浏览器验收」和「从未实机验证过」
这两类标注要当真** —— 前者是真看过,后者是明确的空白。

| 内容 | commit | 说明 |
|---|---|---|
| 设置页 Material 3 | `5ffbe66` | PR #1004,`agent/settings-new-ui` |
| Popup Material 3 | `a96fdf8` | PR #1013,`agent/popup-m3-redesign` |
| 固定 pnpm 9.14.4 | `2904560` | 见「已知坑」 |
| 内容页运行时样式/注入器泄漏修复 | `ffcfbb1` | PR #5(仅评审用)。**从未实机验证过** |
| 设置页草稿身份抖动守卫 | `3876bae` | `StylesSetting.js` / `Prompts.js`,各带回归测试 |
| 跨上下文存储订阅 | `a6bf0b1` | `agent/storage-subscriptions-v2`,`--no-ff` 便于整体回滚 |
| 字幕运行时四处修复 | `96d8c1d` | 关闭按钮失效 / 悬停暂停卡住 / 空数组当结果 / 样式改动丢失。**其中两项待实机确认** |
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
| 划词框 + 悬浮球 Material 3、拖拽护栏 | `cc5d1a93` | `Selection/styles.js` / `Action/styles.js` 新增;header 56px + 溢出菜单,58px squircle + 5 项动作菜单。**已在 dev server 浏览器验收(明暗两套)** |
| AI 词典存量值校验 | `b2de7684` | 补 4 道校验,5 反例 + 1 正例钉住 |
| 发布渠道单一来源 | `f0ce3830` | `releaseTargets.mjs`;`release.yml` 的 matrix 由测试钉住 |
| SPA 样式累积测试 | `1442abfb` | 把原第 3 项实机检查转成自动化 |
| 跨 realm 写入竞态收窄 | `4b2053f2` | `fieldRevisions.js` + 旁挂戳 + 事后重放 |
| 划词框高度常量修正 | `6eeddc06` | `TRANBOX_CHROME_HEIGHT` 52 → 74 |
| 查词气泡陈旧响应守卫 | `e41c0578` | 身份守卫 + 收藏失败单独兜底,3 条测试钉住 |
| `useLangMap` 加 `useCallback` | `e264efa7` | 十几处 `useMemo` 的依赖里有 `i18n`。**这条没有测试钉着** |
| `vtt.test.js` | `ff92a239` | 从 `newui` 原样取,`buildTranslationOnlyVtt` 此前零覆盖 |
| 扩展上下文失效不再冒泡 | `bde78562` | `msg.js` 的 `getCurTab` / `sendBgMsg` / `sendTabMsg` |
| `build:rules` 自建输出目录 | `2335fc2c` | 单独跑时 `build/web` 不存在会 ENOENT 被吞掉、退出码仍是 0 |

---

# 附录:实机验证清单

> **这份清单在 2026-08-24 被实际执行过一次,两条原有项目当场垮掉。**
>
> 它此前是**从代码推出来的、从没人跑过**:第 2 项的步骤根本无法执行,
> 第 1 项测的功能压根不能用。写检查清单时如果没真跑一遍,
> 得到的是一份看着很扎实、实际证明不了任何事的东西。
> 下面每一条都注明了它是否真被执行过。

需要**未打包扩展**。dev server 里的浏览器加载不了扩展
(2026-08-24 实测:预览浏览器被限制在 localhost,页面里也没有 `chrome.runtime`),
所以这几项只能人工做。

## 前置(做一次)

```
CI=true pnpm run build:chrome
```

Chrome → `chrome://extensions` → 开发者模式 → 「加载已解压的扩展程序」→ 选 `build/chrome`。
**已经装过的话点卡片上的刷新图标**,否则测的是旧产物。

### 0. 装上就能确认的四件事(不需要 YouTube)

1. 扩展列表里显示 **简约翻译 M3 / KISS Translator M3**,ID 是
   `enhckapfllnpbdljjmkdkihlcjjikpob`
2. **把同一份 `build/chrome` 复制到另一个目录再 Load unpacked 一次,两个 ID 应该相同** ——
   这是 `key` 字段唯一能实机验的地方(没有它时 ID 跟着目录路径走,用户换个目录就丢数据)。
   验完把多装的那份删掉
3. 点开 Popup:能弹出、标题是 M3、右上角**只有独立窗口和设置两个按钮**。
   能弹出这件事本身就是结论 —— Emotion cache key 不接受数字,应用名带 `M3` 时
   它会**静默挂不上**而不是报错
4. 拨「翻译此页」开关:状态文字跟着变,**底部不再弹绿色提示条**

## ~~1. 查词提示框能点到~~ — `ecbb950d` · **2026-08-24 通过**

改成 popover 之后实机确认可用:提示框不再自己消失,♡ 和 × 都点得到。
这一项**不必再跑**,除非动了 `wordHover.js` 的生命周期 —— 那时看
「查词气泡是 popover」那节的约束。

下面留档,因为它是一个**跑过两轮才对**的修复:

**步骤:** 悬停某个英文字幕单词 → 提示框在播放器右上角弹出 →
**不用急,慢慢把鼠标移过去** → 点 ♡ 或 ×
**期望:** 提示框一直在,♡ 能收藏、× 能关闭;点它外面任意处也会关闭

**第一次执行的结果:** 「鼠标一移出去马上就没了」。原因不是 × 坏了 ——
提示框在播放器右上角、字幕在底部中间,够到它要跨半个播放器,
而离开单词后只留 100ms 就收起。**♡ 和 × 从来就点不到**,整张卡片是装饰。

**中间还错过一次:** 先把收起延时提到 500ms 并加了「指针进入就取消」。
那仍然是赌用户能在超时前走到,播放器多大、鼠标多快都会翻盘,实测依旧不行。
带按钮的东西是 popover 不是 hover card —— 最终改成**不会自己消失**。

**顺带看:**
- 查一个必应词典没有释义的生僻词,应显示「No definition found」而不是空释义框
- **快速掠过两个不同的单词**(`e41c0578`):第二个词的气泡里不应出现第一个词的标题或释义
- 提示框开着时视频保持暂停,关掉后才恢复

## 2. ~~悬停暂停后能恢复播放~~ — **这条已删除,它无法执行**

**不要再把它加回来。**

原步骤是「悬停单词(视频暂停)→ **鼠标别动** → 改播放器内菜单的 `segSlug`」。
**做不到**:要碰任何控件就得移开鼠标,一移开 `pointerleave` 正常触发、视频恢复,
那条「容器在光标底下被拆掉」的路径永远进不去。SPA 导航那个等效路径同理。

**但修复要留着。** 那个状态不需要用户操作也会到达 —— 只要 `destroy()` 发生时
鼠标恰好停在字幕上:provider 的异步链会反复销毁重建 manager、广告开始结束、
字幕轨切换、从另一个窗口改设置经存储订阅传过来。手动触发不了,不等于不会发生。

拆成两半,两半都可执行:

| 要验的 | 怎么验 | 状态 |
|---|---|---|
| 机制:`destroy()` 时会恢复播放 | `BilingualSubtitleManager.test.js` 的 `resumes hover-paused playback when the caption window is torn down` | 已绿 |
| 路由:改 `segSlug` 真的走到 `destroy()` | 正常改设置(鼠标随便动),Console 里应出现 `Bilingual Subtitle Manager: Destroying...` | 10 秒 |

> 曾经试过给这条触发路径补自动化测试(断言改 `segSlug` 会让 manager 被 destroy),
> **没做成,已回退**:provider 的异步处理链本身就会反复销毁重建 manager,
> 断言在「把 `segSlug` 的路由整个改掉」之后照样通过 —— 是条空跑的测试。
> 要补的话得先给 provider 一个可控的静止点,别再照原样试一遍。

## ~~3. 独立翻译窗口~~ — **2026-08-24 通过**

实机确认:打开尺寸正常、最大化后布局正常。这一项不必再跑。留档:

**步骤:** Popup 右上角点「独立窗口」图标
**期望:**
- 打开时就能看全整个表单,**不需要手动拉大**;位置在当前窗口中央
- **最大化后**内容居中、左右留白对称,不是贴左边、右侧一大片空白

布局本身已在 dev server 里量过(1400px 视口下面板 720px、左右各 340px)。
**测不了的是开窗与按内容收窄** —— 那要真实的 `browser.windows` API。
所以这一项看的是「打开那一瞬间的尺寸对不对」。

## 4. 内容页运行时泄漏(`ffcfbb1`)— 从未验证过

做上面几项时顺手看一眼:在 YouTube 里**点链接**在视频间反复跳转 10 次以上
(别刷新,刷新会重置一切),每隔几次在 Console 跑:

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

**期望:** `sheets` 稳定在小数值,不随导航次数单调增长。

## 如果哪一项没过,说明什么

- **第 1 项提示框仍然会自己消失** —— 装的是旧产物。Console 跑
  `document.querySelector(".kiss-word-tooltip")`,离开单词几秒后它应该还在
- **第 1 项按钮点了没反应** —— 看 `.kiss-word-tooltip-close` 的 `outerHTML`。
  带 `onclick` 说明是旧构建(那个属性会被 DOMPurify 剥掉);
  不带但点击无效,查 `showWordTooltip` 里那个 `addEventListener("click", ...)`
- **第 2 项 Console 里没有 `Destroying...`** —— 改设置走的不是 `#destroyManager()`,
  那条路径也要补 `#resumeVideoPausedForHover()`
- **第 3 项窗口还是很小** —— 之前存过窗口尺寸。清掉
  `chrome.storage.local` 里的 `KISS-Translator-M3_separate_window` 再试

## iOS 的 `@grant` 已排除,无需验证

理由不是「大概没事」,而是这个仓库自己就是现成的对照实验:`build-ios.mjs` 只改 banner 里的
**一行**(`// @grant unsafeWindow` → `// @inject-into content`),其余 18 条原样发往 iOS。
而 Userscripts app 的 `validGrants`(`src/ext/shared/utils.js`)是个 15 项的 Set,
只收点号拼写的值存储 API。对照下来,**这 7 条现在就在往 iOS 发且都不在白名单里**:

```
GM.registerMenuCommand    GM_registerMenuCommand
GM.unregisterMenuCommand  GM_unregisterMenuCommand
GM_setValue   GM_getValue   GM_deleteValue
```

iOS 版是 Options 页的一级入口且一直装得上,所以不认识的 grant 显然不会导致拒装。
(该 app 的原生解析器只在缺 `==UserScript==` 块或缺 `@name` 时失败,grant 是 `.filter` 掉的,
不是 `guard`。)

**运行时该 app 不支持值变更监听**,两种拼写都没有。所以 iOS 用户拿不到跨标签页设置同步 ——
这正是预期的降级路径,`getOptionalGmMethod` 会吞掉缺失方法。唯一可见影响是 macOS 端在
app 内置编辑器里手工粘贴脚本时会看到 4 条黄色 lint 提示(`severity: "warning"`,不阻止保存)。
