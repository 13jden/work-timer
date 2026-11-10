/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * v3.2：构建期注入的 App 版本号
 *
 * 由 `vite.config.ts` 的 `appVersionPlugin()` 从 `src-tauri/tauri.conf.json`
 * 的 version 字段读取并注入，保证前后端 / APK / 前端显示的版本号永远一致。
 */
declare const __APP_VERSION__: string;

/**
 * v3.2：编译期注入的后端 API 基址
 *
 * 由 `vite.config.ts` 的 `apiBasePlugin()` 注入（可用 `VITE_API_BASE` 覆盖）。
 * 原生 App 必须用它拼绝对地址 —— WebView 的 origin 不是线上站点。
 */
declare const __API_BASE__: string | undefined;

/**
 * v3.2：后端 API 基址（可选）
 *
 * 留空 = 走默认解析逻辑（见 `src/lib/platform.ts`）：
 * - Web 生产包：同域相对路径（Caddy 反代到 api 容器）
 * - 原生 App 生产包：`https://persecond.work` 绝对地址
 *
 * 想指向自建后端时，构建前设置环境变量即可：
 *   VITE_API_BASE=https://api.example.com npm run build
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Vite 环境类型 + PWA 虚拟模块类型
 *
 * - `virtual:pwa-register` 由 vite-plugin-pwa 提供
 *   registerSW({ immediate: true }) / { onNeedRefresh, onOfflineReady }
 * - `virtual:pwa-register/react` 提供 React 风格的 useRegisterSW hook
 *
 * TASK-052:接入 PWA 所需的最小类型声明
 */
declare module 'virtual:pwa-register' {
  import type { RegisterSWOptions } from 'vite-plugin-pwa';
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  }
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}
