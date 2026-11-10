import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { rmSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import http from 'node:http';
/**
 * v3.0 修复:APK 体积从 16.5 MB 暴涨到 73 MB 的根因
 *
 * public/downloads/ 里放着网站下载页用的旧 APK(SalaryTimer-2.5.0-arm64.apk, 16.5 MB)。
 * Vite 会把 public/ 原样复制进 dist/,而 Tauri 又把整个 dist/ 压缩成
 * tauri-codegen-assets 并链进 Rust 二进制,导致:
 *   1) 旧 APK 被嵌进新 APK 的 .so(每个架构一份)→ .so 从 ~11 MB 涨到 ~18 MB
 *   2) universal APK 4 个架构叠加 → 73 MB
 *
 * 修法:Tauri 构建(TAURI_BUILD=1)时把 dist/downloads/ 删掉。
 * 网站部署走纯 npm run build,downloads 目录照常保留,下载页不受影响。
 */
const isTauriBuild = process.env.TAURI_BUILD === '1';

/** Tauri 构建时移除 dist/downloads,避免把旧 APK 嵌进二进制 */
function excludeDownloads(): Plugin {
  let outDir = '';
  return {
    name: 'exclude-downloads',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const target = resolve(outDir, 'downloads');
      rmSync(target, { recursive: true, force: true });
      console.log(`[exclude-downloads] 已移除 ${target}`);
    },
  };
}

/**
 * 注入当前 App 版本号（v3.2 公告/更新功能）
 *
 * App 端收到「更新」类型公告时,要把客户端版本号发给后端做比对,
 * 所以版本号必须是**编译期常量** —— 不能靠运行时猜测。
 *
 * 版本来源:src-tauri/tauri.conf.json 的 version 字段。
 * 用正则从 tauri.conf.json 里读,避免两处维护导致版本漂移。
 */
function appVersionPlugin(): Plugin {
  const confPath = resolve(__dirname, 'src-tauri', 'tauri.conf.json');
  let version = '0.0.0';
  try {
    const raw = readFileSync(confPath, 'utf-8');
    const m = raw.match(/"version"\s*:\s*"([^"]+)"/);
    if (m?.[1]) version = m[1];
  } catch {
    console.warn('[app-version] 读取 tauri.conf.json 失败,版本号回落为 0.0.0');
  }

  return {
    name: 'salary-timer-app-version',
    apply: 'build',
    configResolved(config) {
      config.define = {
        ...config.define,
        __APP_VERSION__: JSON.stringify(version),
      };
    },
    config() {
      return {
        define: {
          __APP_VERSION__: JSON.stringify(version),
        },
      };
    },
  };
}

/**
 * 注入后端 API 基址（v3.2）
 *
 * ## 为什么必须编译期注入
 *
 * 原生 App（Tauri WebView）的 origin 是 `tauri://localhost`(桌面) /
 * `http://tauri.localhost`(Android),**不是**线上站点。
 * 所以 App 里如果用相对路径 `/api/ping`,请求会打到 WebView 自己的
 * 虚拟域名上,根本到不了线上后端 —— 日活永远记不上、公告永远拉不到,
 * 而且还不报错(被 request() 吞掉),排查起来极难。
 *
 * 因此把 API 基址**烤进二进制**:打 APK 时确定,运行时不再猜。
 *
 * ## 优先级
 *
 * 1. 环境变量 `VITE_API_BASE` —— 自建后端 / 镜像站时显式指定
 * 2. 默认 `https://persecond.work` —— 生产站点(Caddy 站点地址)
 *
 * Web 端不受影响:它走同域相对路径,由 Caddy 反代到 api 容器
 * (见 Caddyfile 的 `handle /api/*`)。详见 src/lib/platform.ts。
 */
const DEFAULT_API_BASE = 'https://persecond.work';

function apiBasePlugin(): Plugin {
  const base = (process.env.VITE_API_BASE ?? '').trim() || DEFAULT_API_BASE;
  return {
    name: 'salary-timer-api-base',
    apply: 'build',
    config() {
      return {
        define: {
          __API_BASE__: JSON.stringify(base),
        },
      };
    },
  };
}

/**
 * 后端开发代理（v3.2）
 *
 * 为什么不用 Vite 内置的 `server.proxy`：
 * 内置代理在后端没启动时会打 `http proxy error` + 完整堆栈到终端，
 * 而且 Vite 5.4 的错误监听器是在 `configure` 之后注册的，无法拦截/降噪。
 *
 * 这里自己写一个中间件：
 * - 后端在线 → 原样转发
 * - 后端没起 → /api/ping 返回 200 + { ok:false }（完全无声），
 *   其他路径返回 503 + 一行可读提示，**终端不打印任何堆栈**
 *
 * 前端本来就吞掉了所有网络错误，所以这里只负责让开发体验干净。
 *
 * 目标地址可用 `API_PROXY_TARGET` 环境变量覆盖（默认 http://localhost:8800），
 * 便于本机端口被别的服务占用时临时换端口调试。
 */
function apiProxyPlugin(target = process.env.API_PROXY_TARGET ?? 'http://localhost:8800'): Plugin {
  return {
    name: 'salary-timer-api-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/') && !url.startsWith('/admin')) {
          next();
          return;
        }

        // host 头必须重写成后端地址（http.request 不接受 undefined 值）
        const headers = { ...req.headers };
        delete headers.host;

        const proxyReq = http.request(
          `${target}${url}`,
          {
            method: req.method,
            headers,
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
            proxyRes.pipe(res);
          },
        );

        // 后端没启动 → 静默降级，不打堆栈
        proxyReq.on('error', () => {
          if (res.headersSent) return;

          // /api/ping 是「后台遥测」,失败必须**完全无声**:
          //   浏览器会把任何非 2xx 响应打印成红色 console error。
          //   这里返回 200 + { ok:false },前端据此判定「今天没记上」,
          //   下次打开 App 会自动重试,用户和终端都看不到任何报错。
          if (url.startsWith('/api/ping')) {
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'backend unavailable' }));
            return;
          }

          res.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              ok: false,
              error: 'backend unavailable',
              hint: '后端未启动：cd server && npm run dev',
            }),
          );
        });

        req.pipe(proxyReq);
      });
    },
  };
}

/**
 * Vite 配置
 *
 * v2.5 patch:接入 vite-plugin-pwa(TASK-052)
 *  - 自动生成 /manifest.webmanifest
 *  - 生产构建自动注入 /sw.js(Workbox precache 所有 dist 静态资源)
 *  - dev 模式不启用 SW,避免 HMR 缓存炸
 *  - 三主题切换由 src/store/themeStore.ts 动态同步 <meta name="theme-color">
 *
 * v3.0 修复:
 *  - TAURI_BUILD=1 时剔除 dist/downloads(旧 APK 不能进二进制)
 *  - 关闭 sourcemap(约 2.4 MB .map 同样会被嵌入二进制)
 */
export default defineConfig({
  plugins: [
    react(),
    ...(isTauriBuild ? [excludeDownloads()] : []),
    appVersionPlugin(),
    apiBasePlugin(),
    apiProxyPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      // dev 模式不注册 SW,避免 HMR 与缓存冲突
      devOptions: { enabled: false },
      includeAssets: [
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'robots.txt',
        '*.woff2',
      ],
      manifest: {
        name: '今日出售时间 · Salary Timer',
        short_name: '秒薪',
        description: '实时薪资计时器 · 打工人的秒薪计数器',
        // theme_color 默认 paper 主题,运行时由 themeStore 按 data-theme 动态改 <meta>
        theme_color: '#F5F2EA',
        background_color: '#F5F2EA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'zh-CN',
        dir: 'ltr',
        categories: ['finance', 'productivity', 'utilities'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // precache 所有 dist 静态资源(JS / CSS / HTML / 字体)
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,ttf,eot}'],
        // 清理过期缓存(超过 30 个版本)
        cleanupOutdatedCaches: true,
        // SPA fallback:任何未知路由回 index.html
        //
        // ⚠️ navigateFallback 会捕获**所有**导航请求(navigate 类型的 fetch),
        //    包括 /admin 和 /api/*。这会造成:
        //    - 手机主屏 PWA 打开 /admin → 被 SW 重写成 /index.html,
        //      用户看到的是首页而不是管理后台(普通浏览器标签页却正常,
        //      因为没装 SW)—— 表现为「时好时坏」,极难排查。
        //    - /api/* 的请求被 HTML 化,后端接口在 PWA 里全部拿不到 JSON。
        //
        // 所以这里必须用 denylist 把这两类路径排除在 fallback 之外,
        // 让它们**直接走网络**,由服务端(Caddy → api 容器)处理。
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/admin(\/|$)/],
        // ── /api 与 /admin 显式走网络 ──────────────────────────
        //
        // navigateFallbackDenylist 只解决**导航请求**(浏览器地址栏跳转、
        // 主屏图标启动)。但 App 里的 fetch(/api/ping) 这类
        // **非导航**请求同样会被 SW 拦截,拿不到后端 JSON。
        //
        // workbox 的路由按注册顺序匹配,**先注册先生效**,
        // 所以把这两条放在 runtimeCaching 开头,
        // 就能抢在 NavigationRoute 之前接管:
        //   - /admin → NetworkOnly(管理后台永远拿服务端最新版本)
        //   - /api/* → NetworkOnly(接口数据绝不走缓存)
        //
        // NetworkOnly 而不是 NetworkFirst:缓存对管理后台和接口
        // 没有任何价值,只会在后端短暂不可用时给出**误导性的旧数据**。
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.mode === 'navigate' && /^\/admin(\/|$)/.test(url.pathname),
            handler: 'NetworkOnly',
            method: 'GET',
          },
          {
            urlPattern: ({ url }) => /^\/api\//.test(url.pathname),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5176,
    host: true,
    // v3.2：本地开发把 /api 与 /admin 反代到后端服务（server/，默认 :8787）
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
      '/admin': { target: 'http://localhost:8787', changeOrigin: true },
    },
    watch: {
      // v3.0:排除 src-tauri —— Android/Gradle 构建会生成并锁住大量报告文件
      // (problems-report.html 等),Vite 监听它们时会抛 EBUSY 导致 dev server 崩溃
      // v3.1:同样排除 dist-android —— APK 打包产物会被占用,监听时抛 EBUSY
      ignored: ['**/src-tauri/**', '**/dist-android/**'],
    },
  },
  build: {
    outDir: 'dist',
    // v3.0:Tauri 构建关闭 sourcemap(约 2.4 MB .map 会被嵌进二进制);网站构建保留便于调试
    sourcemap: !isTauriBuild,
    target: 'es2022',
  },
});
