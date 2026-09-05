# TASK-049 · account 模式三主题适配（obsidian / gold 修复）

| 字段 | 值 |
|---|---|
| **分支** | `fix/v2.5-account-theme-adapt`（基于当前 HEAD） |
| **所属版本** | v2.5 patch（任务编号接 TASK-048） |
| **优先级** | P1（视觉一致性；不影响数据） |
| **状态** | 🚧 开发中 |

---

## 1. 背景

time 模式（SettingsPage）通过 `data-theme` 切换三主题色（柠檬黄 / 曜石青 / 香槟金），
CSS 全用 `--paper-*` `--ink` `--accent` 等语义 token，三主题表现统一。

account 模式（Accounting/* 全部组件）开发时大量写 `var(--paper-3, #f9f7f0)`、`var(--paper-2, #EDE9DD)`、
`var(--ink-muted, #6B6B6B)` 等**带硬编码回退**的写法，而 `--paper-3` / `--paper-4` 在 tokens.css 里
**从未被定义**。结果：

- **paper 主题**：硬编码回退值刚好与设计稿吻合 → 看起来 OK（用户默认体验）
- **obsidian 主题**：所有 `paper-3` 输入框 / `paper-4` 弹窗背景变成 **亮奶油色 #f9f7f0 / #fffdf6**，浮在
  黑色背景上像「白板贴」，破坏深色主题沉浸感；`ink-muted #6B6B6B` 在黑底上对比度过低
- **gold 主题**：与 paper 主题同为浅色，差异不大但部分 chip 文字 fallback 颜色不准

另外 MinePage `TotalAssetsCard` 用 `background: var(--ink)`，在 obsidian 主题下 `--ink` 自动反转
为 `#F2F4F8`（亮色）→ 黑卡变白卡，破坏「墨黑大卡」视觉签名（参照 TimerCard 的 `:global([data-theme='obsidian'])` 处理）。

## 2. 任务清单

| ID | 标题 | 说明 |
|---|---|---|
| T-491 | tokens.css 定义 `--paper-3` / `--paper-4` 三主题 | paper: `#f9f7f0` / `#fffdf6`（保留 fallback 一致）；obsidian: `#1C212C` / `#242B38`（与 `--card` / `--card-hover` 同值）；gold: `#FFFFFF` / `#FFFFFF` |
| T-492 | 移除 Accounting/* 所有 `var(--paper-3, #f9f7f0)` / `var(--paper-4, #fffdf6)` 硬编码回退 | 改写为 `var(--paper-3)` / `var(--paper-4)`，由 token 提供真值；同理 `var(--paper-2, #EDE9DD)` → `var(--paper-2)`（三主题都已定义） |
| T-493 | 替换 `var(--ink-muted, #6B6B6B)` / `var(--ink, #0F0F0F)` 等带 fallback 的语义色 | `--ink-muted` 当前未定义；要么补充进 tokens.css，要么改用现有 `--muted` / `--ink`。**优先新增 `--ink-muted`**（paper: `#6B6B6B`，obsidian: `#9AA4B8`，gold: `#8C8070`） |
| T-494 | 替换 `var(--accent-2, #9fcc00)` 写法 | 这是 v1.3 旧名，token 里没有 `--accent-2`。改为 `var(--accent-deep)`（三主题已定义） |
| T-495 | 替换 `var(--danger, #e5484d)` 等带 fallback 的语义色 | 移除 fallback，三主题都已定义 `--danger` |
| T-496 | MinePage `TotalAssetsCard` 加 obsidian 反转 | 参照 TimerCard `:global([data-theme='obsidian']) .card` 写法：obsidian 下用 `var(--paper)` 当 bg、`var(--ink)` 当字色，保留墨黑大卡视觉签名 |
| T-497 | 替换 QuickAddRow / AccountingTopCard / RecordActionSheet / TodayRecordsList 中的硬编码 `#FFFFFF` `#F2F1EA` `#FFF4E0` `#fef2f2` `#A86A1F` | 用主题 token 表达：白文字 → `var(--paper)`；品牌渐变 → `var(--accent)`；红/黄 chip → `color-mix(var(--danger))` / `color-mix(var(--accent))` |

---

## 3. 设计原则

1. **绝不在 CSS 写死颜色**：每条颜色声明都用 `var(--xxx)`；fallback 仅在 token 缺失时允许
2. **每主题都定义全部 token**：不留回退坑
3. **墨黑卡 / 浅卡差异用 `:global([data-theme='xxx'])`**：当某组件在 obsidian 下需要反转保持设计意图时，加显式 override（参照 TimerCard 模式）
4. **不动 time 模式 / 稳定组件**（TimerCard / StatCard / QuoteCard / BottomNav）—— 只动 Accounting/* 与 tokens.css

## 4. 验收标准

- [ ] T-491：`tokens.css` 三主题都定义了 `--paper-3` `--paper-4` `--ink-muted`
- [ ] T-492-495：grep `var(--paper-[234], #` `var(--ink-muted, #` `var(--accent-2, #` `var(--danger, #` 在 `Accounting/` 下零命中
- [ ] T-496：obsidian 主题下 MinePage 总资产卡仍是深色墨黑底
- [ ] T-497：obsidian 主题下 QuickAddRow 等不再有硬编码白字浮在深色组件上
- [ ] typecheck + 单测 + build 全过
- [ ] 用户在浏览器三主题都肉眼验证通过（默认 paper 保持不变；obsidian / gold 不再有亮奶油白板贴 / 灰底文字消失）

## 5. 不做的事

- ❌ 不改 Accounting 之外的 CSS（time 模式稳定）
- ❌ 不引入新色板 / 改主题定义（只补缺失 token）
- ❌ 不动 stat 数 / 文案 / 组件结构
- ❌ 不写新 TASK 文档终稿（验收通过后再写）

---

*创建于 2026-09-05 · v2.5 patch 适配(account 三主题)*
