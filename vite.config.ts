import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
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
        navigateFallback: '/index.html',
        // 静态资源 cache-first
        runtimeCaching: [
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
    watch: {
      // v3.0:排除 src-tauri —— Android/Gradle 构建会生成并锁住大量报告文件
      // (problems-report.html 等),Vite 监听它们时会抛 EBUSY 导致 dev server 崩溃
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    outDir: 'dist',
    // v3.0:Tauri 构建关闭 sourcemap(约 2.4 MB .map 会被嵌进二进制);网站构建保留便于调试
    sourcemap: !isTauriBuild,
    target: 'es2022',
  },
});
