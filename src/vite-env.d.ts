/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

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
