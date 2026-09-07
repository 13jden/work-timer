# TASK-052 · PWA Manifest + iOS 完整支持

| 字段 | 值 |
|---|---|
| **分支** | 待定(基于当前 v2.5-patch14 HEAD) |
| **所属版本** | v2.5 patch |
| **优先级** | P2(纯加法、不改业务逻辑;为后续 iOS Web 用户铺路) |
| **状态** | 🚧 开发中(草稿) |

---

## 1. 背景

Salary Timer 已经能在 Android 上以 APK 形式分发(TASK-016),但**还没有 PWA 形态**。
当前 `index.html` 已经具备部分 iOS meta(`apple-mobile-web-app-capable` / `apple-mobile-web-app-status-bar-style`),
但缺少 manifest、apple-touch-icon、favicon、service worker 等关键件,导致:

- **iOS 用户**:Safari 打开后**无法「添加到主屏幕」获得全屏 App 体验**(会保留 Safari 顶部地址栏)
- **Android Chrome 用户**:可以装但 Splash 屏 / 应用图标 / theme-color 都没配置,体验割裂
- **桌面端 Chrome / Edge**:无法「安装到桌面」
- **断网 / 弱网**:首次打开 / 二次启动不缓存,加载慢

本次目标:**加 PWA Manifest + iOS 完整 meta + Service Worker**,不改任何业务逻辑。

---

## 2. 任务清单

| ID | 标题 | 说明 |
|---|---|---|
| T-521 | 安装 `vite-plugin-pwa` 依赖 | devDependency,只用于构建期注入 manifest + SW |
| T-522 | 复用 `src-tauri/icons/icon.png` 作为 PWA 图标源 | 已经过 TASK-016 防裁剪处理(1024×1024 黑色安全边距);PWA 用 192 + 512 两档 |
| T-523 | `vite.config.ts` 接 PWA 插件 | `registerType: 'autoUpdate'`、`manifest` 字段(name/short_name/icons/theme_color/background_color/display/start_url/scope)、Workbox precache 所有 dist 静态资源 |
| T-524 | `index.html` 加齐 iOS meta + apple-touch-icon + favicon | `<link rel="apple-touch-icon">` 180×180、`<link rel="icon" type="image/png">` 32×32 / 192×192、`apple-mobile-web-app-title` |
| T-525 | `index.html` theme-color 跟随 data-theme | 用 `<meta name="theme-color">` + 媒体查询或在 `bootstrapTheme()` 里动态写 `<meta>`;三主题不同色 |
| T-526 | `main.tsx` 注册 SW | `virtual:pwa-register` 自动注入;`registerType: 'autoUpdate'` 模式仅 `import` 即可 |
| T-527 | `src/store/themeStore.ts` 主题切换时同步 meta theme-color | 切 obsidian / paper / gold 时改 `<meta name="theme-color">` 的 content;非 PWA 场景也用得上(Safari 地址栏 tint) |
| T-528 | 验证 dev server 出 manifest + SW + 三主题切换 | `curl localhost:5176/manifest.webmanifest` 返回 JSON;`curl localhost:5176/sw.js` 返回 SW;`curl /apple-touch-icon.png` 返回 200;`curl /favicon.ico` 返回 200 |

---

## 3. 设计要点

### 3.1 复用 Tauri 图标

`src-tauri/icons/icon.png` 是 1024×1024 方形图,经过 TASK-016 黑色安全边距处理,
PWA 直接复用:

- 192×192 → `pwa-192x192.png`
- 512×512 → `pwa-512x512.png`
- 180×180 → `apple-touch-icon.png`(iOS home screen)
- 32×32 → `favicon.png`(浏览器 tab)

> 不重画 logo,直接用现成的,避免图标风格不一致。

### 3.2 Manifest 关键字段

```json
{
  "name": "今日出售时间 · Salary Timer",
  "short_name": "秒薪",
  "description": "实时薪资计时器 · 打工人的秒薪计数器",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F5F2EA",
  "theme_color": "#0F0F0F",
  "lang": "zh-CN",
  "icons": [
    { "src": "pwa-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "pwa-512x512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "pwa-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

### 3.3 三主题 theme-color

- `paper` → `#0F0F0F`(深字)
- `obsidian` → `#131320`(深底)
- `gold` → `#2A2520`(深棕字)

> 浏览器 / OS 根据 `theme_color` 给地址栏 / 状态栏上色。

### 3.4 Service Worker 策略

- **开发模式**(`devOptions.enabled: false`):不注册 SW,避免 dev server 缓存炸
- **生产模式**(`build`):自动注入 `sw.js`,precache 所有 dist 静态资源 + Google Fonts 字体
- **缓存策略**:静态资源 cache-first,HTML network-first(用户随时拿到最新版本)
- `registerType: 'autoUpdate'`:新版本后台自动激活,下次启动生效

### 3.5 不做的事

- ❌ 不改任何业务组件 / store / 计算逻辑
- ❌ 不引入路由 / 不改 App.tsx 结构
- ❌ 不写 CHANGELOG / 不创建 commit(验收通过后再做)
- ❌ 不动 tokens.css 三主题(theme-color 在 JS 里写,不动 CSS)
- ❌ 不重复造 manifest 直接写死文件(用 vite-plugin-pwa 自动生成)

---

## 4. 验收标准

- [ ] T-521-528 全部完成
- [ ] `npm run typecheck` 0 错误
- [ ] `npm run test` 全过(本次不新增业务单测)
- [ ] `npm run build` 成功,`dist/manifest.webmanifest` + `dist/sw.js` + `dist/apple-touch-icon.png` 都在
- [ ] `npm run dev` 起来后,Chrome DevTools → Application → Manifest 字段全对、Service Worker 状态 OK
- [ ] Chrome DevTools → Lighthouse → PWA 类别不再有「Installable」失败
- [ ] 三主题切换时 `<meta name="theme-color">` 的 content 实时变化
- [ ] 用户在 Chrome / Safari(桌面或真机)真实验证「添加到主屏幕」可用

## 5. 不做的事(再次声明)

- ❌ 不写 CHANGELOG / commit / TASK 文档终稿 —— 验收通过后才能动
- ❌ 不动业务逻辑(本次是纯加法)
- ❌ 不改三主题的 CSS(只补 JS 同步 meta)
- ❌ 不做「打赏 / 变现 / 商店发布」(那是另一组任务,见根目录 CHANGELOG 索引外的用户对话)

---

*创建于 2026-09-07 · PWA Manifest + iOS 完整支持(草稿)*
