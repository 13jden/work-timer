import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { registerSW } from 'virtual:pwa-register';

// 注册 Service Worker(TASK-052)
// registerType: 'autoUpdate' 模式下只需 import;新版本后台自动激活,下次启动生效
// dev 模式(registerSW.enabled = false)时 noop,不报错
registerSW({ immediate: true });

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found in index.html');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
