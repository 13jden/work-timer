# TASK-070 · v3.2 打赏弹层极简化 + 分类自定义图片

> **状态**：🧩 实现中，待验收
> **分支**：`feat/v3.2-backend`
> **范围**：`src/components/Accounting/MinePage/DonateSheet.tsx` / `src/lib/donate.ts` / `src/components/IconByKey/` / `src/components/Accounting/AddCategoryModal/` / `src/lib/types.ts` / `src/store/accountStore.ts`

---

## 目标

两件事：

1. **打赏弹层极简化** —— 去掉金额输入框，只留三个档位按钮，点任意一个都直接跳转支付宝。
2. **分类支持自定义图片** —— 新建分类时能上传一张图当分类图标（自动压缩）。

---

## 一、打赏弹层极简化（TASK-070-A）

### 改动

- **删除**金额输入框、留言输入框、收据卡片（撕线 / 三行明细）、独立的「打开支付宝」按钮
- **保留**三个档位按钮：小红花 ¥2 / 咖啡 ¥9.9 / 自定义
- **点任意档位 → 直接跳转支付宝**（不再有「先选再确认」两步）
- 下方只跟**一行文字提示**

### 为什么

支付宝**个人**收款码无法预置金额 —— 跳转后仍需用户在支付宝 App 里自己输入数字。
既然金额最终由用户在 App 内填写，页面上再填一遍就是无意义的重复劳动，
还会让人误以为「这里填了 App 里就不用填了」。

所以整个输入环节去掉，只用一行字把这事说清楚：

> 点任意档位打开支付宝 · 个人收款码无法预置金额，请在 App 内输入金额

### 保留的降级路径

| 场景 | 行为 |
|---|---|
| 正常浏览器 | 点档位 → `window.location.href = alipayUrl` |
| 微信内置浏览器 | 微信拦截支付宝链接 → 点档位变成复制链接，提示「微信里打不开支付宝，点任意档位复制链接」 |
| 后台没配链接 | 三个按钮 `disabled`（半透明）+ 提示「收款链接待配置」 |

### 删除的 CSS

`receipt` / `receiptRow` / `receiptMono` / `receiptPerf` / `receiptFoot` /
`payLinkBtn` / `payLinkHint` / `donateCustom` / `donateField` / `donateFieldLabel` /
`donateOptional` / `donateAmountRow` / `donateAmountPrefix` / `donateAmountInput` /
`donateNoteInput` / `donateError` / `tipCardActive`

新增 `donateNote`（虚线框 + 一行说明）。

### 保留的 lib API

`validateDonation` / `DONATE_MAX_AMOUNT` / `DONATE_MAX_NOTE_LEN` / `reportDonation`
保留在 `src/lib/donate.ts` —— 它们是 lib 的公开 API 且有单测覆盖，
等将来接正式支付接口（预置金额）时会重新用上。

---

## 二、分类自定义图片（TASK-070-B）

### 数据模型

`Category` / `Folder` 增加可选字段：

```ts
export interface Category {
  ...
  icon: string;
  /** 自定义图片（IndexedDB imageId）；有值时优先渲染图片，忽略 icon */
  iconImageId?: string;
  ...
}
```

- `icon` 保持 string 不变 → **零数据迁移**（老数据没这字段就是 undefined）
- 图片存 IndexedDB（复用 `src/lib/imageStore.ts`），不进 localStorage（5MB 配额撑不住）

### 渲染层：新增 `CategoryIcon`

新增 `src/components/IconByKey/CategoryIcon.tsx`：

```tsx
<CategoryIcon icon={cat.icon} imageId={cat.iconImageId} size={18} color={...} />
```

逻辑：
- 有 `imageId` → 用 `useImage(imageId)` 读 Blob → 渲染 `<img>`（圆形裁切）
- 读不到 / 没有 imageId → 回落渲染 `<IconByKey>`（老分类零影响）

**为什么不改 `IconByKey` 而是新组件**：`IconByKey` 的职责是「key → Phosphor 图标」，
塞进 imageId 会污染它的语义。新组件包一层，16 个渲染点改成用它。

### 压缩

复用 `src/lib/imageCompress.ts`，但分类图标用**更小的参数**：

```ts
compressImage(file, 256, 0.8)   // 记账图片是 1280px，分类图标 256px 就够
```

`compressImage` 的 `maxEdge` / `quality` 本来就是参数，直接传。

### UI：AddCategoryModal 加「自定义图片」

现有 Phosphor 线稿 picker **保留**（用户要求），在它下面加一块：

```
图标
[现有的 65 个线稿图标分组网格]

┌─────────────────────────────┐
│  [上传图标]                  │  ← 选图 / 预览缩略图
│  或从相册选一张图             │
└─────────────────────────────┘
```

- 选图后 → 压缩 → 预览缩略图（圆形）
- 预览卡（弹层顶部）实时显示自定义图片
- 保存时：`putImage(imageId, blob)` → 写进 `category.iconImageId` 和 `folder.iconImageId`
- 选了自定义图片后，线稿 picker 的选中态清空（图片优先）

### Store

`addCategory` 已经会同步创建 Folder 并复制 `icon` —— 现在也要复制 `iconImageId`：

```ts
const folder: Folder = {
  ...,
  icon: newCategory.icon,
  iconImageId: newCategory.iconImageId,
  ...
};
```

⚠️ 关键：`CategoryFolderGrid` 渲染的是 `folder.icon` 而不是 `category.icon`，
所以图片必须同时写进 Folder，否则首页网格显示不出自定义图片。

### 范围

- **只在「新建分类」时能选**（用户确认）
- 老分类**不能改**（项目里没有编辑分类的 UI，本次不新增）
- 后端无关（分类全在 localStorage）

---

## 验证

- `npm run typecheck` 通过
- `npm run test` 通过
- `npm run build` 通过
- 浏览器验收：
  - 打赏弹层：三个按钮一行，点任意一个都跳转
  - 新建分类：上传图片 → 压缩 → 预览 → 保存 → 首页网格显示自定义图片

---

## 待用户验收

- [ ] 打赏弹层极简版观感
- [ ] 三个档位点击跳转是否都正常
- [ ] 分类图片上传 → 显示效果
- [ ] 三个主题下是否都正常
