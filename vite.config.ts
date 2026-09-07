import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Vite 配置
 *
 * v2.5 patch:接入 vite-plugin-pwa(TASK-052)
 *  - 自动生成 /manifest.webmanifest
 *  - 生产构建自动注入 /sw.js(Workbox precache 所有 dist 静态资源)
 *  - dev 模式不启用 SW,避免 HMR 缓存炸
 *  - 三主题切换由 src/store/themeStore.ts 动态同步 <meta name="theme-color">
 */
export default defineConfig({
  plugins: [
    react(),
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
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
});
