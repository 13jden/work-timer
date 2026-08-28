# Legacy · 历史归档

> 本目录保存重构前的旧版代码,作为历史归档。**不再维护,不再修改**。
> 仅在以下情况下使用:
> - 查阅旧版的视觉设计 / 交互细节
> - 提取旧版的 CSS / 文案参考
> - 旧数据(localStorage)迁移参考

## 文件

| 文件 | 来源 | 用途 |
|---|---|---|
| `index.html` | 旧版 HTML 单文件入口(含 inline CSS/JS) | 视觉与交互参考 |
| `www/index.html` | Capacitor 同步目录,保留旧版本 | 旧版 APK 仍能跑 |

**重构产物在**:`src/` + Vite 工程目录 + 后续的 `src-tauri/`。