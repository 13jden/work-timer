# TASK-005 · 迁移换算页 + 物品 sheet

| 字段 | 值 |
|---|---|
| **阶段** | 阶段 1:React 重写 |
| **估时** | 0.5 天 |
| **依赖** | TASK-004 |
| **优先级** | P2 |
| **状态** | ✅ 已完成(2026-08-28) |

---

## 1. 目标

把 `#page-convert`(换算页)迁移为 React,包含:
- 物品列表渲染
- 添加物品 sheet(底部弹出)
- 编辑 / 删除功能

---

## 2. 验收标准

- [ ] `src/pages/ConvertPage.tsx`
- [ ] `src/components/ItemSheet/`(底部弹窗)
- [ ] `src/components/EmojiPicker/`(emoji 选择网格)
- [ ] 列表显示每个物品:`图标 + 名称 + 需要工作 X 小时 X 分钟`
- [ ] 添加按钮打开 sheet,表单:名称 + 单价 + emoji 选择
- [ ] 编辑模式:点物品 → sheet 打开,字段预填
- [ ] 删除按钮(仅编辑模式可见)
- [ ] 价格变化时**实时重算**(订阅 `itemsStore`)
- [ ] `docs/CHANGELOG.md` 追加变更

---

## 3. 组件结构

```
src/pages/
└── ConvertPage.tsx

src/components/
├── ItemCard/
│   ├── ItemCard.tsx
│   └── ItemCard.module.css
├── ItemSheet/
│   ├── ItemSheet.tsx
│   ├── ItemSheet.module.css
│   └── index.ts
└── EmojiPicker/
    ├── EmojiPicker.tsx
    ├── EmojiPicker.module.css
    └── index.ts
```

---

## 4. 关键计算

```ts
// ConvertPage.tsx
import { useConfigStore } from '../store/configStore';
import { useItemsStore } from '../store/itemsStore';
import { useNow } from '../hooks/useNow';
import { hourlyRate } from '../lib/compute';

export function ConvertPage() {
  const config = useConfigStore();
  const items = useItemsStore(s => s.items);
  const now = useNow();

  const rate = hourlyRate(now, config, ...);

  return (
    <div>
      {items.map(item => (
        <ItemCard
          key={item.id}
          item={item}
          hours={item.price / rate}
        />
      ))}
      <button onClick={() => openSheet()}>+ 添加</button>
      <ItemSheet ... />
    </div>
  );
}
```

**注意**:`hourlyRate` 现在是纯函数,store 数据作为参数传入。

---

## 5. ItemSheet 设计

```tsx
interface ItemSheetProps {
  open: boolean;
  editingItem?: Item | null;
  onClose: () => void;
  onSave: (item: { name: string; price: number; icon: string }) => void;
  onDelete?: () => void;
}
```

**底部弹出动画**:用 CSS transition + 状态控制,而不是库(避免引入 framer-motion)。

---

## 6. 操作步骤

1. 从 `src/styles/page-convert.css` 和 `src/styles/sheets.css` 复制样式
2. 创建 `ItemCard` 组件
3. 创建 `EmojiPicker`(从 `EMOJI_CHOICES` 渲染网格)
4. 创建 `ItemSheet`(受控表单)
5. 创建 `ConvertPage`
6. 接入 `itemsStore` 的 add / update / remove
7. 接入 `useConfigStore` 读取 config
8. `npm run dev` 验证功能
9. 更新 `docs/CHANGELOG.md`

---

## 7. 不要做的事

- ❌ 不要做 emoji 搜索功能(MVP 不需要)
- ❌ 不要引入模态框库(自己用 CSS + state 实现)
- ❌ 不要换 `itemsStore` 的存储 key

---

## 8. 完成提交信息

```
feat(convert): migrate Convert page with item sheet

- Componentize ItemCard, ItemSheet, EmojiPicker
- Wire itemsStore add/update/remove
- Live recalculation on price change
- Update CHANGELOG.md
```

---

*创建于 2026-08-28*