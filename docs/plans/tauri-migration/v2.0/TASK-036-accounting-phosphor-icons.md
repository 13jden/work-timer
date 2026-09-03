# TASK-036 · 记账模块图标系统升级(emoji → Phosphor thin/light)

| 字段 | 值 |
|---|---|
| **分支** | `feat/v2.1-mobile` |
| **依赖** | v2.0 记账 MVP |
| **优先级** | P1 |
| **状态** | ✅ 已完成(2026-09-03,用户验收通过) |

---

## 1. 背景

记账分类 / 文件夹 / 备注图标当前为写死 emoji(`🍜` `🚌` ``…),问题:
- 颜色不跟主题(三套主题下均为 emoji 原色)
- 跨平台渲染不一致(小米 / 苹果 emoji 风格差异)
- 卡通感与现有编辑感 UI 不搭

方案:改用项目已安装的 `@phosphor-icons/react`,**thin / light 字重**线稿图标。
图标名已逐一在已安装版本 `dist/*.d.ts` 校验存在。

## 2. 设计

### 2.1 数据模型
- `Category.icon` / `Folder.icon` 继续为 `string`,值改为 **icon key**(如 `'food'`)
- 老 localStorage 数据存的是 emoji → 渲染层查不到 map 时**回退显示原 emoji**,无缝兼容

### 2.2 新组件 `src/components/IconByKey/`
```tsx
interface IconByKeyProps {
  icon: string;            // key 或旧 emoji
  size?: number;           // 默认 18
  weight?: 'thin' | 'light' | 'regular';  // 默认 thin
  color?: string;          // 默认 currentColor
}
```
- key → Phosphor 组件映射表 `ICON_MAP`(约 60 个,分组清单 `ACCOUNTING_ICON_GROUPS`)
- 未命中 → `<span>{icon}</span>` emoji 回退

### 2.3 图标分组(picker)
餐饮 / 出行 / 购物 / 娱乐 / 居家 / 健康成长 / 钱财工作 / 其他,共 8 组。

### 2.4 默认分类映射
| 分类 | 旧 emoji | 新 key |
|---|---|---|
| 餐饮 | 🍜 | food(ForkKnife) |
| 交通 | 🚌 | bus(Bus) |
| 购物 | 🛒 | bag(ShoppingBag) |
| 娱乐 | 🎮 | game(GameController) |
| 住房 | 🏠 | home(HouseSimple) |
| 水电 | 💡 | bulb(Lightbulb) |
| 医疗 | 💊 | pill(Pill) |
| 教育 | 📚 | book(BookOpen) |
| 其他(支) | 📦 | box(Package) |
| 工资 | 💰 | wallet(Wallet) |
| 奖金 | 🎁 | gift(Gift) |
| 投资 | 📈 | trend(TrendUp) |
| 兼职 | 💼 | handcoins(HandCoins) |
| 红包 | 🧧 | envelope(EnvelopeSimple) |
| 退款 | ↩️ | coins(Coins) |
| 其他(收) | ✨ | sparkle(Sparkle) |

## 3. 改动文件

| 文件 | 改动 |
|---|---|
| `src/components/IconByKey/*` | 新增共用组件 + ICON_MAP + 分组清单 |
| `src/lib/constants.ts` | 默认分类 icon 换 key;`ACCOUNTING_EMOJI_CHOICES` → `ACCOUNTING_ICON_GROUPS` |
| `AddCategoryModal.tsx` | picker 换线稿图标网格(分组) |
| `CategoryFolderGrid.tsx` | 文件夹图标 → IconByKey |
| `CategoryDetailPanel.tsx` | 大图标 / 卡片图标 → IconByKey |
| `AddRecordModal.tsx` | 分类选择图标 → IconByKey |
| `TodayRecordsList.tsx` | 记录行图标 → IconByKey |

## 4. 验收标准

- [ ] 记账页所有分类 / 文件夹 / 记录显示线稿图标,风格统一
- [ ] 添加分类弹窗为分组线稿 picker,选中态跟主题 accent
- [ ] 三套主题下图标颜色正确(跟随 currentColor / 显式色)
- [ ] 手动在 localStorage 造一条 emoji 旧数据,页面回退显示 emoji 不崩
- [ ] typecheck / test / build 全绿
- [ ] 用户浏览器验收通过

## 5. 不做的事

- ❌ 物品交换模块图标(下一 TASK 接入同套组件)
- ❌ 存钱目标 emoji(SAVINGS_GOAL_EMOJI_CHOICES 保留)
- ❌ 自定义图标上传

---

*创建于 2026-09-03 · 状态:开发中*
