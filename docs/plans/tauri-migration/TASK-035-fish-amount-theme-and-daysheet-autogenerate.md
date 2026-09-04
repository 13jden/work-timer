# TASK-035 · Fish 页金额主题色 + DaySheet 保存自动定型已赚

| 字段 | 值 |
|---|---|
| **分支** | `v1.3.5-fix-bug` |
| **依赖** | TASK-032(v1.3.5 已赚记录)、TASK-034(主题审计) |
| **优先级** | P1 |
| **状态** | ✅ 已完成(2026-09-03,用户验收通过,随 v1.3.5 APK 发布) |

---

## 1. 背景与问题(用户反馈)

1. **Fish 页深色卡金额不跟主题**:净时薪 / 累计已赚的文字颜色写死为金色系 token(`--gold-bright`),柠檬黄主题下仍是金色。
2. **DaySheet 弹窗去掉「已赚生成」区域**:手动点单个日期编辑时,不再显示"已赚记录 / 生成已赚"区块,保存即自动定型。
3. **保存薪资不记录 Bug**:过去日期保存后已赚记录不生成——兼职(freelance)正常(原本就保存即生成),工作日 / 加班(paid_overtime)不生成(需手动点「生成已赚」)。

## 2. 根因

- `FishPage.module.css`:`.darkValue` 用 `--gold-bright`、`.fishValue` 用 `--gold`,未走主题 accent。
- `DaySheet.handleSave`:仅 `isFreelance && isPast` 时调用 `onGenerateEarned`;work / paid_overtime 依赖弹窗内手动按钮。

## 3. 方案

### 3.1 金额主题色

| 选择器 | 旧 | 新 | 说明 |
|---|---|---|---|
| `.darkValue`(深色卡金额) | `var(--gold-bright)` | `var(--accent)` | 深底上用 accent 高亮 |
| `.fishValue`(摸鱼总薪资) | `var(--gold)` | `var(--accent-deep)` | 浅底卡片用 deep 保证可读 |

### 3.2 DaySheet 保存自动定型

- 删除「已赚生成」整块 UI 及对应 CSS(`.earned*`)。
- `handleSave` 中,过去日期保存后:
  - type ∈ {work, paid_overtime, freelance} → 自动 `onGenerateEarned()`
  - type ∈ {rest, leave} → 自动 `onCancelEarned()`(清除旧快照,避免残留金额)
- 仍用 `setTimeout(0)` 等 store 落盘后执行;父级(CalendarPage / DesktopRightPanel)的 `generateSingleEarned` 已读 store 最新值,无需改动。
- 日历页批量生成 / 取消多选能力保留不动。

## 4. 验收标准

- [ ] 三主题下 Fish 页深色卡金额颜色随主题变化(柠檬黄 / 曜石青 / 香槟金)
- [ ] DaySheet 不再出现「已赚记录 / 生成已赚」区块
- [ ] 过去日期:保存工作日 / 加班 / 兼职后,日历与 Fish 页统计立即计入已赚
- [ ] 过去日期改休息 / 请假保存后,旧已赚快照被清除
- [ ] typecheck / test / build 全绿
- [ ] 用户浏览器验收通过

## 5. 不做的事

- ❌ 不动日历页批量生成 / 取消入口
- ❌ 不改 `batchGenerateEarned` 计算口径
- ❌ 验收前不写 CHANGELOG、不提交

---

*创建于 2026-09-03 · 完成于 2026-09-03 · 随 v1.3.5 APK 发布*
