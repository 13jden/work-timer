## [Unreleased] · 2026-08-30

### 版本索引

| 版本 | 日期 | 主题 | 文档 |
|---|---|---|---|
| v2.5 | 2026-09-04 | 导航手势体验修正 + 存池结算方式 | [`docs/CHANGELOG-v2.5.md`](./CHANGELOG-v2.5.md) |
| v2.5-patch2 | 2026-09-05 | time → accounting 联动 + 多 bug 修复 (TASK-046) | [`docs/CHANGELOG-v2.5.md`](./CHANGELOG-v2.5.md) |
| v2.5-patch1 | 2026-09-04 | 均摊池资产口径修正 + UX 微调 (TASK-043 patch) | [`docs/CHANGELOG-v2.5.md`](./CHANGELOG-v2.5.md) |
| v2.4 | 2026-09-04 | 多账户钱包 + 存钱目标 + 池自动退休 | [`docs/CHANGELOG-v2.4.md`](./CHANGELOG-v2.4.md) |
| v2.3 | 2026-09-04 | 池机制(到期逐日生成 + 认领标记 + 日历选日期范围) | [`docs/CHANGELOG-v2.3.md`](./CHANGELOG-v2.3.md) |
| v2.2 | 2026-09-04 | 统计页三视图 + 记账日历 + 分类记录页 | [`docs/CHANGELOG-v2.2.md`](./CHANGELOG-v2.2.md) |
| v2.1 | 2026-09-03 | 线稿图标 + 移动端双主题框架(上下滑切换) | [`docs/CHANGELOG-v2.1.md`](./CHANGELOG-v2.1.md) |
| v2.0 | 2026-09-02 | 独立记账页(快速记录 + 未分类 + 分类文件夹) | [`docs/CHANGELOG-v2.0.md`](./CHANGELOG-v2.0.md) |
| v1.3.5 | 2026-09-03 | 已赚记录定型 + 自由兼职兼容 + 日视图日期切换 | [`docs/CHANGELOG-v1.3.md`](./CHANGELOG-v1.3.md) |
| v1.3.4-patch3 | 2026-08-31 | 右栏加宽到 1/3 + 撤销 patch2 居中(撑满整个页面) | [`docs/CHANGELOG-v1.3.md`](./CHANGELOG-v1.3.md) |
| v1.3.4-patch2 | 2026-08-30 | 桌面端主内容 max-width 居中 + 日历页分栏放宽 | [`docs/CHANGELOG-v1.3.md`](./CHANGELOG-v1.3.md) |
| v1.3.4-patch1 | 2026-08-30 | 跨天班次 + 夜班加成计算口径修正 | [`docs/CHANGELOG-v1.3.md`](./CHANGELOG-v1.3.md) |
| v1.3.4 | 2026-08-30 | 桌面端三栏布局重构 | [`docs/CHANGELOG-v1.3.md`](./CHANGELOG-v1.3.md) |
| v1.3.3 | 2026-08-30 | 图标替换 + 时间记录重设计 | [`docs/CHANGELOG-v1.3.md`](./CHANGELOG-v1.3.md) |
| v1.3.2 | 2026-08-30 | SettingsPage 极简化 + DaySheet 自由日配置增强 | [`docs/CHANGELOG-v1.3.md`](./CHANGELOG-v1.3.md) |
| v1.3.1 | 2026-08-30 | Bug 修复 + 图标库 + 弹窗重设计 | [`docs/CHANGELOG-v1.3.md`](./CHANGELOG-v1.3.md) |
| v1.3.0 | 2026-08-29 | 增强版薪资模型(加班/摸鱼/自由/多段) | [`docs/CHANGELOG-v1.3.md`](./CHANGELOG-v1.3.md) |
| v1.0–v1.2 | 阶段 1 | 见本文档历史记录 | 本文 |

### Changed · 主页面各组件内文字间隔收紧

整体缩小 TodayPage 各组件内部的 padding / margin / gap，让布局更紧凑：

- **TodayPage 页面级**：
  - `.topbar`: `padding` 从 `16/20/12` → `12/16/8`，`.topbarEyebrowRow` `margin-bottom` 从 `6/10` → `4/8`
  - `.timerWrap`: `padding` 从 `16/24` → `12/18`
  - `.quoteWrap`: `padding` 从 `12/16` → `8/12`
  - `.statsRow`: `gap` 从 `12/18` → `8/14`，`padding` 从 `16/24` → `12/18`，`margin-bottom` 从 `12/20` → `8/16`
- **TimerCard**：
  - `.card`: `padding` 从 `22/30` → `16/24`
  - `.status`: `gap` 从 `8` → `6`，`margin-bottom` 从 `12/24` → `8/18`
  - `.display`: `margin` 从 `8/10` → `6/8`
  - `.label`: `margin-bottom` 从 `14/28` → `10/22`
  - `.shift`: `margin-bottom` 从 `8/14` → `6/10`，`.shiftLeft` `gap` 从 `8` → `6`
  - `.range`: `margin-top` 从 `20/12` → `14/10`
- **StatCard**：
  - `.card`: `padding` 从 `10/22` → `8/18`
  - `.index`: `margin-bottom` 从 `10/16` → `6/12`
  - `.value`: `margin-bottom` 从 `6/10` → `4/8`
  - `.extra`: `margin-top` 从 `6/9` → `4/7`
- **QuoteCard**：
  - `.card`: `padding` 从 `14/22` → `10/16`，`gap` 从 `12/18` → `8/14`

### Changed · StatCard 数字字体调瘦高，防当日总薪资截断

首页 StatCard（收入卡 / 等价物卡）数字字体调整，解决薪资数字过长时被 `overflow: hidden` + `text-overflow: ellipsis` 截断的问题：

- **`.value`（主数字）**：
  - `font-size`: `clamp(26px, 4.5vh, 36px)` → **`clamp(22px, 4vh, 32px)`**（整体缩小，上限降低防宽溢）
  - `line-height`: `1` → **`1.12`**（高度稍增，数字更挺拔）
  - `letter-spacing`: `-1px` → **`-1.5px`**（字距收紧，横宽更紧凑）
- **`.flavor`（等价物数字）**：
  - `font-size`: `clamp(20px, 3.5vh, 28px)` → **`clamp(18px, 3.2vh, 24px)`**（与主数字同比例缩小）
  - `letter-spacing`: `-0.3px` → **`-0.5px`**

### Built · SalaryTimer-0.1.0-arm64-v2.apk · 新图标(四周留白防裁剪) · 11.51MB

#### APK 图标防溢出处理
- 用户提供竖长方形原图 `image/316c1e2063e73a0dcf1e1a2d61935ef5.jpg`(964×1030)，直接作为 APK 图标被 Android 自适应圆形 mask 裁剪后会切掉边缘的星星、¥元宝袋、白圈描边(溢出效果)
- **处理方案**:1024×1024 方形黑色画布 + 原图等比缩放到 76%(728×778)居中放置，四周留 **12%~15% 黑色安全边距**，输出 `resources/logo-square.png`
- 运行 `npx tauri icon resources/logo-square.png` 重刷全部图标资源：
  - src-tauri/icons/ (ico / icns / png / Square*)
  - Android mipmap-mdpi / hdpi / xhdpi / xxhdpi / xxxhdpi 五密度 `ic_launcher.png` + `ic_launcher_round.png` + `ic_launcher_foreground.png`

#### Tauri jniLibs 符号链接问题(Windows 非管理员)
- 本机未开 Developer Mode，Windows `CreateSymbolicLink` 导致 Tauri CLI 的 symlinking 阶段固定报错 `os error 2`(clobber enabled 时悬垂 symlink 无法删除/重建)
- **绕过方案**:
  1. `npx tauri android build -t aarch64 --apk` 完整执行 `beforeBuildCommand`(前端 dist 构建嵌入 Rust .so)→ `cargo build`(4 个 android targets 编译好)→ 允许 symlink 阶段失败
  2. 手动把 `target/<triple>/release/libapp_lib.so` 以 **NTFS HardLink** 方式写入 `jniLibs/<arch>/libapp_lib.so`(HardLink 无需管理员权限、同卷即可)
  3. 修改 `src-tauri/gen/android/app/build.gradle.kts` 的 `defaultConfig { ndk { abiFilters += listOf("arm64-v8a") } }`，强制只打包 arm64 ABI(其余三架构 .so 为旧版 HardLink 残留，直接丢弃不参与打包)
  4. `gradlew.bat assembleRelease -x rustBuild<All>Tasks` **跳过 rustBuild 任务**(避免再次调用 `cargo tauri android android-studio-script` 导致 WebSocket Connection refused)，Gradle 直接用现成的 HardLink .so + 已构建资源完成打包

#### 签名方案(沿用 TASK-016 修复)
- zipalign 4 字节对齐(apksigner 签名前对齐)
- apksigner(RSA 2048, `release.keystore` / alias `salary-timer`)**只签 v2+v3 方案**:
  - `--v1-signing-enabled false --v2-signing-enabled true --v3-signing-enabled true --min-sdk-version 24`
  - 彻底避免 build-tools 35.0.0 的 v1 SF/RSA 校验失败导致国产 ROM 安装器误判(解析 v1 签名报 false)
- verify 结果:`v1=false · v2=true · v3=true · signers=1`(targetSdk 36 要求最少 v2，达标)

#### 产物
| APK | 路径 | 大小 | 签名 | 架构 |
|---|---|---|---|---|
| arm64 精简 | `dist-android/SalaryTimer-0.1.0-arm64-v2.apk` | **11.51 MB** | v2+v3 (apksigner, 无 v1) | arm64-v8a only |

### Changed · SettingsPage 保存语义重写:修改不立刻生效，必须点保存配置

原行为:设置页所有 input / select / swatch 都是 onChange 即写入 configStore/themeStore，全局立即生效，保存配置按钮仅为 UI 装饰。
新行为:引入本地 **draft(草稿) 状态**(useState)，所有控件只修改 draft，与全局 store 的差异用 **isDirty** 实时判断。
点击保存配置按钮才把草稿一次性写入（setConfig + setTheme）并持久化到 localStorage。未保存时，Month/Today/Convert 等页面完全不受影响。

#### 细节
- 脏态反馈: isDirty 期间按钮增加 **savePulse 脉冲阴影**（accent 色呼吸环），disabled 时不触发。disabled={!isDirty} 无更改时按钮保持半透明禁点。
- 工作日预览: restMode 修改时，当月工作日计算基于 **draft.restMode** 实时预览，但不写入 store，符合所见即所得但未生效的语义。
- 主题: swatch 点击仅改 draft.theme（高亮指示器也按 draft 判断），不点保存则不调用 setTheme，真正的全局配色 / meta theme-color 不变。
- 月薪 / 单价: Number(value) 空值兜底 || 0，避免 NaN 污染全局。
- 外层: SettingsPage 新增 wrap 节点 + `padding-bottom:120px` 防止底部保存按钮 / Footer 被 BottomNav 遮挡（与 Today 页对齐）。
- `src/pages/SettingsPage.module.css` : 新增 `.wrap` / `.saveBtn:disabled` / `.saveBtnDirty`（及 savePulse 动画）
- `src/pages/SettingsPage.tsx` :
  - 新增 `Draft` 类型 + `useState<Draft>` 草稿
  - `handleSave()` 批量写入 configStore（除 theme） + themeStore（theme）
  - 所有控件 value / onChange 从 `config.X + setConfig({X})` 改为 `draft.X + setDraft(d => ({...d, X}))`

### Changed · Today 页 TimerCard 高度 / 计时数字字宽 / 导航图标三件套微调

#### 改动清单
- **`src/components/TimerCard/TimerCard.module.css`**
  - `.card` 最小高度: `300px` → **`450px`**（防溢出，视觉更舒展）
  - `.display` 倒计时数字整体调瘦高：
    - `font-size`: `clamp(36px, 9vh, 72px)` → **`clamp(30px, 7.5vh, 64px)`**（上限降低防宽溢）
    - `line-height`: `1` → **`1.08`**（高度稍增，数字更挺拔）
    - `letter-spacing`: `-1.5px` → **`-2px`**（字距收紧，横宽更紧凑）
- **`src/components/BottomNav/BottomNav.module.css`**
  - `.tabIcon` 尺寸: `26px × 26px` → **`30px × 30px`**（点击热区增大，视觉更醒目）
- **`src/pages/TodayPage.module.css`**
  - `.page`: `height: 70vh` + `overflow: hidden` → **`min-height: 70vh`** + `overflow-y: auto`，新增 `padding-bottom: 120px`（允许 TimerCard 450px 高度完整撑开，底部不被 BottomNav 遮挡）
  - `.timerWrap`: `flex: 1 1 0` + `min-height: 0` + `overflow: hidden` → **`flex: 1 1 auto`**（取消高度收缩限制，允许卡片自然撑开）

### Added · Month 页「工作日」卡片支持点击切换休息模式(双休/单休/无休)

Month 页 summary 三卡中,**绿色"工作日"卡片**现在可点击,弹出 RestModeSheet 底部弹窗:

- 三个选项:**双休(2) / 单休(1) / 无休(0)**
- **当前月** → 修改全局 config.restMode,立即生效到首页、设置页等所有页面
- **历史月** → 仅写入 calendarStore.monthlyRestModes[key] 覆盖该月,不影响全局
- 历史月弹窗额外显示「恢复全局设置」按钮,可清除覆盖
- 弹窗标题格式:YYYY年 M月,副标题说明当前操作模式

#### 改动清单

- **src/store/calendarStore.ts**: 新增 monthlyRestModes: Record<string, RestMode> 持久化字段 + setMonthlyRestMode(key, mode | null) action
- **src/pages/CalendarPage.tsx**: 构建 effectiveConfig = { ...config, restMode: effectiveRestMode },所有 compute 函数调用均使用 effectiveConfig;工作日 <div> 改为 <button class="summaryRest">;RestModeSheet 渲染
- **src/pages/CalendarPage.module.css**: 新增 .summaryRest 按钮样式(cursor+active scale)
- **src/components/RestModeSheet/**: 新增组件(RestModeSheet.tsx + RestModeSheet.module.css + index.ts),复用 GenerateSheet 的 sheet 底弹风格
- **src/lib/compute.ts**: **未修改函数签名**,通过 effectiveConfig 覆盖 restMode 实现零侵入

### Changed · 移动端布局还原 · Today / Swap / Mine 回归 index.html

用户从历史恢复了 `index.html`(原始 HTML + Capacitor 版)并反馈:React 重构后的移动端布局不及原版美观。
本次按恢复的 `index.html` 逐项还原 **字体 / 排版 / 间距 / 卡片圆角** 等视觉细节,
**逻辑层 100% 不变**(Zustand stores、compute.ts 纯函数、sheet 组件均未触碰)。

#### ── Today 页 (主页面,参考用户截图) ──
- **`src/pages/TodayPage.tsx` + `TodayPage.module.css`**
  - 新增 **TopBar** 三栏区(匹配 index.html `.topbar`):
    - 左: `Today · MM.DD` (monospace 大写 eyebrow, muted)
    - 中: `今日出售时间` (Cormorant Garamond 斜体 17px, ink)
    - 右: `MM.DD` (11px muted)
  - 重排移动端顺序:**TimerCard → QuoteCard → StatsRow**(Quote 卡在中间)
  - 去掉桌面端 hero 双栏(桌面端布局后续再完善,本次专注移动端)
  - Stats 卡片两栏使用 1fr 1fr grid,与原版 `.stats-row` 一致
- **`src/components/TimerCard/TimerCard.tsx` + `TimerCard.module.css`**
  - **REST 模式还原参考图**:显示大字号衬线 **"REST"**(72px Cormorant Garamond,白色),不再是 "—"
  - 状态栏文本: `今日休息` (原为 休息日)
  - 标签文本: `享受休息日` (原为 今天不上班)
  - 休息日仍完整显示 SHIFT 行 / 进度条 / 时间区间 (参考图明确可见)
  - 去掉 `.rest` 的 `grayscale + opacity` 整体降灰滤镜(保持深色卡底色)

#### ── Swap 页 (Convert) ──
- **`src/pages/ConvertPage.tsx` + `ConvertPage.module.css`**
  - page-head 还原为:eyebrow **"What does it cost"** + 衬线斜体标题 **"等价换算"**
    - (原为 "02 / CONVERT" + "你买的每样东西值多少小时")
  - 移除顶部时薪大号 figure (¥XX.XX + "你的时薪…" 子标题) —— 原版 HTML 换算页无该区块
  - 列表行保持原版结构:icon(44×44 圆角 12) / name+price / count+"需要工作"
  - 添加按钮文字改回 **"＋ 添加喜欢的东西"** (原为 "＋ 添加物品")
  - 按钮 :active 态改为 `border-color:ink + color:ink + rgba 背景`(与原版一致)

#### ── Mine 页 (Settings) ──
- **`src/pages/SettingsPage.tsx` + `SettingsPage.module.css`**
  - 新增 page-head:eyebrow **"Preferences"** + 衬线斜体 **"设置"**
  - 按原版拆分为 5 个独立 group (眉毛标题 + 白色卡片 + 行分隔):
    1. **薪资 · Salary**: 月薪 input + 当月工作日(天数,只读)
    2. **时间 · Hours**: 上班时间 / 下班时间 / **休息模式下拉 + › 角标**(原混在薪资 card)
    3. **换算 · Convert**: 咖啡默认单价(原混在薪资 card)
    4. **主题 · Theme**: 三色圆点点(swatch 大小从 28 调回原版 24,active 扩大 1.2 倍 + accent-shadow)
    5. **月度记录 · Salary History**: 从 monthlyStore.getAllSnapshots() 读取快照列表
        - 空态:"暂无月度记录 / 到 Month 页点击已赚卡片生成" (多行提示)
        - 每行:YYYY年 X月 / ¥金额 · N天 / **本月** 或 **已锁定** 角标
  - Footer 还原原版 **"v1.1 · 本地存储"** (原为 "Salary Timer · 年份")
  - 所有 row/label/value/prefix 样式与原版像素级对齐(monospace、字号、圆角 16、分隔线 line-soft)

#### ── Month 页 (Calendar) 两项专项修复 ──
- **`src/pages/CalendarPage.module.css`**
  - **Fix 1 · 左右月份切换不再加深颜色**:
    - 删除 `.navBtn:hover { background: var(--ink); color: var(--accent); }`
    - 删除 `.navTitle:hover { background: var(--ink); }`
    - 点击时只切换月份,不产生颜色加深(保留 transition,不再注入深底规则)
  - **Fix 2 · 日历数字限制最大宽度(防屏幕溢出)**:
    - `.grid` / `.weekdays` / `.days` 新增 `max-width:100% + box-sizing:border-box`
    - `.day` 新增 `max-width:100% + min-width:0` 强制遵守 grid 边界
    - `.dayNum` 新增 `max-width:100% + overflow:hidden + ellipsis + nowrap + inline-block` 截断长数字
    - `.earn` 新增同样 overflow/ellipsis 截断,避免金额溢出单元格

#### ── Critical Fix · index.html 重写为 Vite React 入口 ──
- **根因**:用户恢复的 `index.html` 是完全自包含的原生 HTML/CSS/JS Demo(有 inline `<style>` 块、完整 DOM 结构、原生 `<script>` 逻辑),不是 Vite React 入口。React SPA 渲染的是 `<div id="root">` 挂载点,但 index.html 里根本没有这个 div,导致浏览器跑的全是原生 Demo,所有 React 代码改动都被忽略。
- **修复**:将 `index.html` 精简为标准 Vite React 入口:
  - 保留:所有 `<meta>` 标签(viewport/theme-color/apple-mobile-web-app)+ Google Fonts link
  - 移除:全部 inline `<style>` 块(已在 `src/styles/tokens.css` 和各 `.module.css` 中)+ 全部 `<body>` DOM(React 会渲染)+ 全部原生 `<script>`(逻辑已迁移到 React/Zustand)
  - 新增:`<div id="root"></div>` + `<script type="module" src="/src/main.tsx"></script>`
- **结果**:React SPA 正确渲染,StatusBar 时间/电量/日期彻底消失,字体通过 tokens.css 的 CSS 变量正确加载(Cormorant Garamond / JetBrains Mono / Figtree)

### Verified (browser check + typecheck)
- ✅ `npm run typecheck` 通过,无 TS 错误
- ✅ **Today 页**:StatusBar 已移除,TopBar 只显示居中 "今日出售时间"(衬线斜体),字体正确
- ✅ **Month 页**:navBtn 点击无深底效果(只切换月份),日历数字不溢出屏幕,点击日期弹出 DaySheet,点击月份/已赚弹出 GenerateSheet
- ✅ 月份切换正常(八月 → 七月,非当前月显示 "now" 按钮)

---
# Changelog · Salary Timer

All notable changes are documented here.

Format: `## [Unreleased] · YYYY-MM-DD` for unreleased, `## [v1.x.x] · YYYY-MM-DD` for releases.

## [Unreleased] · 2026-08-29
### Added · Month 页「工作日」卡片支持点击切换休息模式(双休/单休/无休)

Month 页 summary 三卡中,**绿色"工作日"卡片**现在可点击,弹出 RestModeSheet 底部弹窗:

- 三个选项:**双休(2) / 单休(1) / 无休(0)**
- **当前月** → 修改全局 config.restMode,立即生效到首页、设置页等所有页面
- **历史月** → 仅写入 calendarStore.monthlyRestModes[key] 覆盖该月,不影响全局
- 历史月弹窗额外显示「恢复全局设置」按钮,可清除覆盖
- 弹窗标题格式:YYYY年 M月,副标题说明当前操作模式

#### 改动清单

- **src/store/calendarStore.ts**: 新增 monthlyRestModes: Record<string, RestMode> 持久化字段 + setMonthlyRestMode(key, mode | null) action
- **src/pages/CalendarPage.tsx**: 构建 effectiveConfig = { ...config, restMode: effectiveRestMode },所有 compute 函数调用均使用 effectiveConfig;工作日 <div> 改为 <button class="summaryRest">;RestModeSheet 渲染
- **src/pages/CalendarPage.module.css**: 新增 .summaryRest 按钮样式(cursor+active scale)
- **src/components/RestModeSheet/**: 新增组件(RestModeSheet.tsx + RestModeSheet.module.css + index.ts),复用 GenerateSheet 的 sheet 底弹风格
- **src/lib/compute.ts**: **未修改函数签名**,通过 effectiveConfig 覆盖 restMode 实现零侵入

### Added · TASK-016 完成 · Android APK 打包 + 自定义 Logo

- **自定义 Logo 全图标集**:柠檬绿 ¥ 秒表(`image/LS20260827102934.png`)替换 Tauri 默认图标
  - `resources/logo-square.png`:方形化源图(原图 1228×1225 → 1225×1225)
  - `npx tauri icon` 重生 `src-tauri/icons/`(ico / icns / png / Square*)+ Android mipmap 全密度 + 自适应图标 `mipmap-anydpi-v26`
- **Release universal APK**:四架构(aarch64 / armv7 / i686 / x86_64),`npx tauri android build --apk`
- **签名链路**:zipalign 4 字节对齐 + apksigner(RSA 2048 keystore,v2/v3 签名方案校验通过)
- **产物**:`dist-android/SalaryTimer-0.1.0-universal.apk`(37MB,可 `adb install`)
- **签名资产**:`release.keystore` + `keystore.properties`(均 gitignore,勿提交)
- **`docs/plans/tauri-migration/TASK-016-android-apk.md`**:任务文档

### Fixed · TASK-016 签名修复 · v2-only 签名 + arm64 精简包

经过多轮排查,确认"安装包异常"的**两个根因**:

1. **apksigner 默认生成的 v1 签名文件无效**:build-tools 35.0.0 的 apksigner 即使 `--v1-signing-enabled true --min-sdk-version 22` 也创建了校验失败的 v1 文件(SF/RSA 存在但 verify 报 false)。国产 ROM 安装器检测到 v1 文件后尝试校验,失败即拒绝安装。
2. **targetSdk 36 要求 v2**:纯 v1 签名(jarsigner)在 targetSdk 36 下被拒绝(`ERROR: Target SDK version 36 requires a minimum of signature scheme v2`)。

**最终方案**:apksigner `--v1-signing-enabled false` 只签 v2/v3,**完全不生成 v1 文件**,消除安装器对 v1 的误判。
**签名顺序**:剔除非目标架构 → zipalign 4 字节对齐 → apksigner 签名(apksigner 保留对齐)。

### 产物

| APK | 大小 | 签名 | 架构 |
|---|---|---|---|
| `SalaryTimer-0.1.0-arm64-v2.apk` | 11.81MB | v2+v3 (apksigner, 无 v1) | arm64-only |
| `SalaryTimer-0.1.0-universal-v2.apk` | 35.38MB | v2+v3 (apksigner, 无 v1) | 四架构 |

### Notes

- 本机未开 Developer Mode,Tauri Android 构建的 jniLibs 符号链接**需要管理员权限**,构建须在提权 shell 运行
- 旧 `jniLibs/*.so` 失效符号链接会导致 clobber 失败(os error 2),重建前需先删除
- **签名方案**:targetSdk 36 下用 apksigner `--v1-signing-enabled false` 只签 v2/v3,不生成可能干扰安装器的 v1 文件
- **精简方法**:直接从 APK ZIP 中删除非目标架构的 `lib/` 子目录 → zipalign → 签名,无需重建无需提权
- **jarsigner 顺序**:若用 jarsigner(v1),必须先签名再 zipalign(签名会破坏对齐);apksigner 则要求先 zipalign 再签名
- 阶段 3 进度:TASK-015 ✅(用户手动配置)/ TASK-016 ✅

---

## [Unreleased] · 2026-08-28

### Changed · TASK-011 增量调整 · 月份主题色 + 圆点规则 + now 按钮 + 已赚合并到 GenerateSheet

#### 月份主题色(随主题切换)
- `paper`(浅色):月份「八月」= **纯黑 `#000`**
- `obsidian`(暗紫):月份 = **accent 紫 `#7C6FF7`**
- `gold`(香槟金):月份 = **accent 金 `#C9A84C`**

#### 圆点规则:过去月 + 当前月显示,未来月不显示
- 删掉 `isBeforeRecordedDate` 判断(`recordedFromDate` 太严,会把历史月挡掉)
- 新增 `isFutureMonth`:未来月不能生成/调整,Header 灰显 + 已赚卡片无圆点

#### nav `now` 按钮
- 仅 `!isCurrentMonth` 时显示
- 颜色 = `var(--accent)`,hover 加深色背景

#### 已赚点击 → 合并到 GenerateSheet
- 删除 `EarnSheet` 组件的使用 / import / handleEarnEdit
- 已赚卡片点击 → 统一打开 `GenerateSheet`(展示月薪 input + 工作日 + 日均 + 总收入预览)
- 无快照 → 创建快照;有快照 → 覆盖
- 当前月同步 `useConfigStore.setState({ monthlySalary })`

---

## [Unreleased] · 2026-08-28

### Added · TASK-011 完成 · CalendarPage header 居中 + 历史月份引导

- **`src/pages/CalendarPage.tsx`** — Header 改 `<button>`(月份居中可点),Summary 始终三卡,已赚卡片改 button + 圆点指示器
- **`src/pages/CalendarPage.module.css`** — 新增 `.headInner` / `.summaryEarn` / `.earnDot`,删除 `.headLeft` / `.dotBtn` / `.dotEmpty` / `.dotGenerated` / `.noSnapshot`
- **`docs/plans/bugfix/TASK-011-calendar-header-rework.md`** — 计划文档

### Changed

- **Header 月份居中**:删掉右上角 dot 按钮,「月份 / 年份」整块可点击 → 弹出 `GenerateSheet`
- **Summary 始终三卡**:无论是否有快照,都显示「工作日 / 日均 / 已赚」三张卡片
- **无快照时已赚 = ¥0**:`monthEarned` / `todayEarn` 在无快照时直接返回 0,日历格不显示金额
- **已赚卡片圆点指示器**:无快照 + 未到记录区间 → 右上角 6px 圆点 + 1.6s 脉冲动画,提示可点击
- **已赚卡片点击逻辑**:
  - 无快照 → 打开 `GenerateSheet`(生成 → 圆点消失,已赚显示真实数字)
  - 有快照 → 打开 `EarnSheet`(调整月薪;当前月同步 `config.monthlySalary`,历史月仅更新快照)
- **Header 禁用态**:早于 `recordedFromDate` 时整个 header 灰显且不可点

### Removed

- `.dotBtn` / `.dotEmpty` / `.dotGenerated`(右上角圆点按钮 + 其样式)
- `.noSnapshot` 提示条(已无意义,改用三卡 + 圆点)

### Verified

- ✅ `npm run typecheck`:0 errors
- ✅ `npm run test`:93 / 93 通过
- ✅ `npm run build`:184KB / gzip 60KB

### Notes

- 本次只调整 UI 行为,store / compute / sheet 组件均未改动,所有原有逻辑保留
- 阶段 1 进度:**8 / 9 → 9 / 9**(阶段 1 完成,待 TASK-008 / 009 收尾)

---

## [Unreleased] · 2026-08-28

### Added · TASK-010 完成 · 月度记录重做 + 工作日类型 + 用户记录区间

- **`src/lib/types.ts`** — 新增 `DayType` / `DayOverrideEntry` / `MonthlySnapshot`
- **`src/lib/constants.ts`** — 新增 `STORAGE_KEY_V2` / `OVERRIDES_KEY_V2` / `SNAPSHOTS_KEY` / `DAY_TYPE_OPTIONS`
- **`src/lib/compute.ts`** — 新增 `dayUnits` / `getDayOverride`(兼容旧 v1 字符串)
- **`src/store/configStore.ts`** — v2 升级 + `recordedFromDate` 初始化
- **`src/store/calendarStore.ts`** — 新增 `setDayOverride` action,v2 key
- **`src/store/monthlyStore.ts`** — 重构为 `MonthlySnapshot` 快照表,用户手动 `createSnapshot`
- **`src/components/DaySheet/`** — UI 重做:类型 select 下拉 + 加班倍率 input + 保存/重置
- **`src/components/GenerateSheet/`** — 新增:点击 Month header dot 生成月度薪资(月薪 input + 预览)
- **`src/components/EarnSheet/`** — 新增:点击已赚卡片修改月薪
- **`src/pages/CalendarPage.tsx`** — header dot 指示器 + GenerateSheet + EarnSheet + day cell ¥daily × units
- **`docs/plans/bugfix/TASK-010-month-records.md`** — 计划文档

### Features

- **工作日类型**:工作日(1x)/ 加班(默认 1.5x,自定义)/ 请假(0x)/ 休息(0x)
- **倍率可自定义**:加班日可在 DaySheet 里改倍率 input,实时保存
- **请假扣减**:请假日的 units=0,贡献 = 0,等同从已赚中扣除 daily
- **加班加成**:加班日的 units=1.5(可改),贡献 = daily × 1.5
- **月度快照**:用户手动点击「生成当月薪资」创建,锁定该月月薪不受 config 变化影响
- **历史月份独立**:每个快照独立存储 salary、workDays、dailyRate、totalUnits
- **用户记录区间**:`recordedFromDate` 在 configStore 初始化时自动写入今天
- **数据兼容**:旧 v1 字符串 override (`'work'|'rest'`) 在读取时自动归一化为 v2 entry

### Storage 变更

- `salary_timer_config_v1` → `salary_timer_config_v2`(加 `recordedFromDate`)
- `salary_timer_day_overrides_v1` → `salary_timer_day_overrides_v2`(值改为 entry 对象)
- 新增 `salary_timer_monthly_snapshots_v1`(月度快照表)
- 旧 v1 keys 保留不动,数据**直接覆盖**(用户接受)

### Verified

- ✅ `npm run typecheck`:0 errors
- ✅ `npm run test`:93 / 93 通过(compute 71 + store 22)
- ✅ `npm run build`:179KB / gzip 59KB

### Notes

- 阶段 1 进度:**7 / 9 → 8 / 9**(TASK-010 加入并完成)
- TASK-008(响应式布局)/ TASK-009(主题系统接入)未做
- future scope:记账功能已为 `MonthlySnapshot` 预留 schema

---

## [Unreleased] · 2026-08-28

### Added · TASK-007 完成 · 设置页 + 月度记录

- **`src/store/monthlyStore.ts`** — 月度记录 store
- **`src/pages/SettingsPage.tsx`** + `SettingsPage.module.css`

### Features

- 薪资配置:月薪 / 上班 / 下班 / 咖啡价(实时双向绑定 → configStore)
- 休息模式下拉(0 无休 / 1 单休 / 2 双休)
- 主题切换:三色圆点点,点击立即切换
- 当月工作日数实时计算显示
- 月度记录列表:本月"本月"、历史"已锁定"
- monthlyStore:当月自动生成、跨月自动锁定历史

### Verified

- ✅ `npm run typecheck`:0 errors
- ✅ `npm run test`:67 / 67 通过

### Notes

- 阶段 1 进度:**7 / 9**
- 导出/导入配置未做

---

## [Unreleased] · 2026-08-28

### Added · TASK-006 完成 · 日历页 + 日期 sheet

- **`src/pages/CalendarPage.tsx`** + `CalendarPage.module.css`
- **`src/components/DaySheet/`** — 日期详情弹窗

### Features

- 月度网格:工作日白 / 周末灰 / 今日黑色高亮
- override 天数右上角小圆点标记
- 上月 / 下月 / 今天 导航
- Summary:工作日数 + 日均 + 已赚
- 点击日期 → DaySheet(切换 work/rest + 重置)
- 订阅 calendarStore,月切换和 override 均持久化
- 网格 1 分钟级更新,避免秒级重渲染

### Verified

- ✅ `npm run typecheck`:0 errors
- ✅ `npm run test`:67 / 67 通过

### Notes

- 阶段 1 进度:**6 / 9**
- 农历 / 节日高亮未做(节假日仅用于判定)

---

## [Unreleased] · 2026-08-28

### Added · TASK-005 完成 · 换算页 + 物品 sheet

- **`src/pages/ConvertPage.tsx`** + `ConvertPage.module.css`
- **`src/components/ItemSheet/`** — 底部弹窗(添加 / 编辑 / 删除)

### Features

- 物品列表:`icon / name / 需要工作 X 小时分钟`
- 点击列表项 → 编辑模式(sheet 预填字段)
- 添加按钮 → sheet 空白,默认 icon `📦`
- 实时校验:名称正则、单价 > 0
- 删除按钮仅编辑模式可见
- 订阅 itemsStore / configStore 实现实时重算
- sheet 关闭:点 backdrop 或保存 / 删除后自动 close

### Verified

- ✅ `npm run typecheck`:0 errors
- ✅ `npm run test`:67 / 67 通过

### Notes

- 阶段 1 进度:**5 / 9**
- 路由未接入,App.tsx 暂未显示 ConvertPage(由后续 TAB 切换组件统一管理)
- 滑动删除未做(TASK-008 响应式时一起处理)

---

## [Unreleased] · 2026-08-28

### Added · TASK-004 完成 · 今日页 UI

- **`src/hooks/useNow.ts`** — 全局 ticker,每秒返回 Date
- **`src/hooks/useNowTime.ts`** — StatusBar 用,分钟级同步时间
- **`src/components/StatusBar/`** — 顶栏(时间 + 信号 + 电池)
- **`src/components/TimerCard/`** — 主计时卡(签名元素)
- **`src/components/StatCard/`** — 数据卡(Income / Worth)
- **`src/components/QuoteCard/`** — 每日 quote
- **`src/pages/TodayPage.tsx`** — 今日页组合
- **`src/pages/TodayPage.module.css`** — 响应式 grid 布局
- **`src/styles/tokens.css`** — 全局设计令牌(三套主题 + reset)
- **`src/css.d.ts`** — CSS Modules 类型声明

### Changed

- **`src/App.tsx`** — 接入 `bootstrapTheme()`(防止主题闪烁),渲染 `<TodayPage />`

### Verified

- ✅ `npm run typecheck`:0 errors
- ✅ `npm run test`:67 / 67 通过(本任务未加新测试)
- ✅ `npm run build`:**155KB / gzip 51KB**

### Notes

- 阶段 1 进度:**4 / 9**(TASK-001 ~ 004 完成)
- TimerCard 黑底 / 倒计时 display 字体 / 进度条 / dot 脉冲动画与原 HTML 版完全一致
- Obsidian 主题下 TimerCard 自动反转配色
- 桌面端 quote 在 hero 下方,移动端 quote 在 hero 内(响应式)
- 路由层未接入,目前只有 TodayPage;TASK-005 完成后接 Tab 切换

---

## [Unreleased] · 2026-08-28

### Added · TASK-003 完成 · 状态层迁移到 Zustand

- **`zustand`** v5 安装
- **`src/lib/constants.ts`** — 从 `state.js` 迁移所有常量(STORAGE_KEY、DEFAULT_CONFIG、THEMES、DEFAULT_ITEMS、QUOTES、EMOJI_CHOICES、HOLIDAYS)
- **`src/lib/storage.ts`** — `loadJSON` / `saveJSON` / `removeJSON` 类型化封装
- **`src/store/configStore.ts`** — 配置 store(自动持久化,排除 theme 字段)
- **`src/store/itemsStore.ts`** — 物品 store(自动持久化,add 时 uuid 自增 order)
- **`src/store/calendarStore.ts`** — 日历 store(年/月 + dayOverrides)
- **`src/store/themeStore.ts`** — 主题 store(独立 storage key,DOM + meta 同步,导出 `bootstrapTheme()`)
- **`src/lib/storage.test.ts`** — storage 单测(7 例)
- **`src/store/store.test.ts`** — 全部 store 单测(19 例)

### Changed

- **`storage key 保持向后兼容`**:
  - `salary_timer_config_v1`(config)
  - `salary_timer_items_v1`(items)
  - `salary_timer_day_overrides_v1`(overrides)
  - `salary_timer_theme_v1`(新增,独立管理 theme)
- 旧版 HTML 应用的数据**无需迁移**即可被 React 版读取

### Verified

- ✅ `npm run typecheck`:0 errors
- ✅ `npm run test`:**67 / 67 通过**
- ✅ 覆盖率:**96.92% statements / 91.3% branches / 95.23% functions / 99.11% lines**
- ✅ `npm run build`:143KB / 600ms

### Notes

- 阶段 1 进度:**3 / 9**(TASK-001 ✅ TASK-002 ✅ TASK-003 ✅)
- 状态层完成,后续 UI 任务可以直接订阅 store
- `bootstrapTheme()` 需要在 App.tsx 启动时调用,防止主题闪烁

---

## [Unreleased] · 2026-08-28

### Added · TASK-002 完成 · 核心计算层迁移

- **`src/lib/types.ts`** — 类型定义(Config / DayOverrides / HolidayMap / DayState 判别联合等)
- **`src/lib/time.ts`** — 时间工具(parseTime / toMinutes / pad2 / formatDateKey / formatHMS)
- **`src/lib/compute.ts`** — 核心计算纯函数,所有依赖从隐式 state 改为显式参数
- **`src/lib/compute.test.ts`** — 40 个单元测试用例
- **`vitest.config.ts`** — vitest + jsdom + v8 coverage 配置

### Changed · 计算层重构

**所有原 `src/js/compute.js` 的隐式 state 依赖改为显式参数**:
- `isWorkday(date, config, overrides, holidays)` — 4 参数
- `dailySalary(year, month, config, overrides, holidays)` — 5 参数
- `hourlyRate(...)` / `perSecond(...)` / `todayEarned(...)` / `monthEarnedSoFar(...)` / `progressPct(...)` 同模式
- `dayState(...)` 返回 `DayState` 判别联合(TS 自动收窄)

**好处**:
- 100% 可测试(无全局 state 依赖)
- 调用方(store)负责注入状态
- 类型安全:DayState 通过 `mode` 自动收窄

### Verified

- ✅ `npm run typecheck` 0 errors
- ✅ `npm run test` **40 / 40 通过**(耗时 ~1.3s)
- ✅ 覆盖率:**Statements 99% / Branches 97.36% / Functions 94.44% / Lines 98.86%**(目标 >90%)
- ✅ `npm run build` 仍成功(143KB / gzip 46KB)

### Notes

- 阶段 1 进度:**2 / 9**(TASK-001 ✅ TASK-002 ✅)
- 旧版 `src/js/compute.js` 仍保留(用于 Capacitor),新逻辑在 `src/lib/compute.ts`
- `nowInMinutes` 未被 compute.ts 使用,从 export 列表移除

---

## [Unreleased] · 2026-08-28

### Changed · 文档结构调整

- `docs/plans/` 目录按项目分组:
  - 新建 `docs/plans/README.md` 作为索引
  - 所有 `TASK-XXX.md` + `ROADMAP.md` 移入 `docs/plans/tauri-migration/`
  - `AGENTS.md` 同步更新路径引用

### Added · TASK-001 完成

- **`index.html`** — 重写为 Vite 入口(指向 `/src/main.tsx`)
- **`src/main.tsx`** — React 入口,挂载 `<App />`
- **`src/App.tsx`** — 根组件占位,显示阶段进度
- **`vite.config.ts`** — Vite 5 配置(端口 5173、source map、ES2022 target)
- **`tsconfig.json`** — TypeScript 严格模式(`strict` + `noUncheckedIndexedAccess`)
- **`tsconfig.node.json`** — Vite 配置专用
- **`package.json`** — 2.0.0,移除 `@capacitor/*` 依赖,新增 React/Vite/TS
- **`legacy/`** — 新建历史归档目录,保留旧版 `index.html`(只读,不再维护)
- **`.gitignore`** — 补充 `dist/`、`.vite/`、`src-tauri/target/`、`src-tauri/gen/`

### Removed · 清理

- `@capacitor/android` `@capacitor/assets` `@capacitor/cli` `@capacitor/core` 全部卸载
- `ws` 旧依赖移除
- `node_modules` 从 218 包精简到 66 包

### Verified

- ✅ `npm run typecheck` 通过(0 errors)
- ✅ `npm run build` 成功(`dist/index.html` 1KB,`dist/assets/index-*.js` 143KB / gzip 46KB)
- ✅ 构建耗时 ~572ms
- ✅ 旧版 `www/index.html` 保留,Capacitor 端未受影响

### Notes

- 阶段 1 进度:**1 / 9** (TASK-001 ✅)
- 旧版 HTML 应用仍可运行(Capacitor 走 `www/index.html`)
- 重构产物独立在 `src/` + `dist/`,两个版本暂共存

---

## [Unreleased] · 2026-08-28

### Architecture · 重构启动

**决策**:从"HTML + Capacitor + Android Studio"激进重构为"Tauri + React + TypeScript"多端架构。

**目标**:
- 一份代码覆盖 Web / Windows / macOS / iOS / Android
- 摆脱 Capacitor 的笨重链路(JDK 21 / Android Studio / Gradle)
- 用 Vite 替代静态 HTML,获得现代化开发体验
- 用 Tauri 2.x 替代 Capacitor,体积更小、性能更好

### Added · 文档体系建立

- **`AGENTS.md`** — AI Agent 强制必读文件,包含项目定义、技术栈现状、行为守则、启动检查清单
- **`docs/ARCHITECTURE.md`** — 重写,加入多端目标、技术栈选型理由、数据流图
- **`docs/CONVENTIONS.md`** — 新建,代码规范(命名、TypeScript、React、Git、测试、文档同步)
- **`docs/plans/ROADMAP.md`** — 新建,完整重构路线图(4 阶段 23 个 TASK)
- **`docs/plans/TASK-001` ~ `TASK-009`** — 阶段 1 的 9 个详细任务规格
  - TASK-001: 初始化 Vite + React + TS
  - TASK-002: 迁移 `compute.ts` 纯函数 + 单测
  - TASK-003: 迁移到 Zustand store
  - TASK-004: 迁移今日页 UI
  - TASK-005: 迁移换算页 + 物品 sheet
  - TASK-006: 迁移日历页 + 日期 sheet
  - TASK-007: 迁移设置页 + 月度记录
  - TASK-008: 响应式布局
  - TASK-009: 主题系统接入

### Planned · 阶段划分

| 阶段 | 内容 | 状态 |
|---|---|---|
| 0 | HTML + Capacitor(现有) | ✅ |
| 1 | React + TS + Vite 重写 | ⏳ 计划 |
| 2 | Tauri 桌面端 | ⏳ 计划 |
| 3 | Tauri 移动端 | ⏳ 计划 |
| 4 | 上架 + 自动更新 | ⏸ 可选 |

### Notes

- 阶段 1 完成后,旧 `index.html` 标记 deprecated,保留用于 Capacitor
- 阶段 3 完成后,删除整个 `android/` 目录、`capacitor.config.json`、`build-apk.ps1`
- 所有 storage key 保持向后兼容,旧数据可平滑迁移
- `src/lib/compute.ts` 是核心,所有计算逻辑 100% 迁移并 100% 单测覆盖

---

## [Unreleased] · 2026-08-27

### Added
- **休息模式配置** (`restMode`): 设置页新增下拉选择双休 / 单休 / 无休,联动工作日数量计算
- **月度薪资记录** (`salary_timer_monthly_v1`): 每月生成一条记录,当月实时累计,月初自动锁定上月记录,不再受薪资调整影响
- **月度记录列表**: 设置页底部展示所有历史月度薪资记录,显示已锁定金额和工作天数
- **主题切换**: 三套配色方案(paper/dark/gold),设置页一键切换,配置持久化
- **文档目录**: `docs/ARCHITECTURE.md` + `docs/CHANGELOG.md`

### Fixed
- 改下班时间后进度条不更新: `submitSettings()` 末尾补调 `renderToday()`
- 改休息日后日薪/时薪不刷新: `toggleDay()` 末尾补调 `renderToday()`
- 进度条百分比未扣除午休时长,导致下班时间越晚误差越大: `progressPct()` 改用 `totalWorkMins = endM - startM - lunchBreak * 60`
- `todayEarned()` 午休判断添加 `config.lunchRest` 开关

### Changed
- `config.workDays` 字段移除,工作日数量完全由 `restMode` + 月份 + `dayOverrides` 动态计算
- `DEFAULT_CONFIG` 新增 `restMode: 2`, `lunchRest: true`, `theme: 'paper'`
- `progressPct()` 修复: 分母从 `(endM - startM)` 改为 `(endM - startM - lunchBreak * 60)`,排除午休时长

---

## [Unreleased] · 2026-08-28

### Added
- **Desktop Sidebar (≥1024px)**: 左侧 240px 固定侧边栏
  - `Salary Timer` 品牌头
  - 仅两个导航项: `今日` (默认激活) + `设置` (可点击展开)
  - **设置面板内嵌 sidebar**: 月薪 / 上班时间 / 下班时间 / 休息模式 / 咖啡单价,实时双向绑定到 `config`
  - **实时派生统计**: 时薪 / 每秒 / 日均,跟随输入立刻刷新
  - 主题切换器 (柠檬黄 / 靛蓝 / 香槟金) 置于 sidebar footer
  - 移动端 (<1024px) 隐藏 sidebar,保留底部 tab 导航
- **Desktop 集成主页**: timer card + 收入/价值双卡 + quote 全部直接显示,无需切换 tab
- **桌面端今日页默认始终可见** (`.page-today` 永久 `is-active`),移动端仍走 tab 切换
- **Theme swatch active class 统一同步**: `applyTheme()` 自动标记当前主题 active 态

### Removed
- **午休设置功能** (`config.lunchBreak` / `config.lunchStart` / `config.lunchRest` 字段)
  - 设置页移除「午休开始 / 午休时长」输入项
  - `todayEarned()` / `progressPct()` / `workSeconds()` 不再扣除午休时长
  - 计算逻辑简化为: `hourly = monthly / days / workHours`,workHours = end - start

### Fixed
- **手机框移除**: 移除了原来的手机模拟框(`.stage` + `.device`),改为自适应全宽布局;桌面端切换到 sidebar + main 双栏结构
- **`dayState` / `progressPct` 时间 bug**: 漏写 `now.getMinutes()`,全天时间判断比真实时间慢约 30 分钟
- **完成工时定格**: 下班后 (`now >= endTime`) 计时器显示定格 `00:00:00` + 「今日已完成」,不再继续倒数

### Changed
- **`DEFAULT_CONFIG`**: 移除 `lunchBreak` / `lunchStart` / `lunchRest` 三个字段
- **`workSeconds()`**: 简化为 `Math.max(endM - startM, 0) * 60`
- **`progressPct()`**: 分母从 `(endM - startM - lunchBreak * 60)` 改为 `(endM - startM)`
- **`dayState()` done 模式**: 不再返回总工作时长,而是定格 `00:00:00` + 「今日已完成」
- **`updateQuote()`**: 简化为单一 quote 元素 (桌面/移动共享)
- **`bindEvents()`**: 增加 sidebar 设置面板交互 + 实时 config 同步 + `syncMobileForm()` 双向同步移动端表单

---

## [v1.0.0] · 2026-08-27

### Added
- **计时器卡片**: 实时显示距下班倒计时,支持上班前/工作中/已下班三种状态
- **进度条**: 实时进度百分比 + 进度填充动画
- **今日收入卡片**: 实时显示已赚金额、时薪、每秒收益
- **等价换算页**: 预设咖啡/奶茶/球鞋,支持自定义物品,显示需要工作多少时间
- **日历页**: 月度工作日网格,点击日期可手动切换工作日/休息日,显示每日薪资
- **设置页**: 月薪、上班时间、下班时间、午休时长、咖啡单价
- **法定节假日**: 内置 2026 年节假日映射
- ** Capacitor Android 打包**: 完整 Android 工程,支持生成 APK

