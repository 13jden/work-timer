# CHANGELOG · v3.2

> **版本主题**：后端服务 + 管理后台 + 打赏入口
> **分支**：`feat/v3.2-backend`

---

## v3.2 · 2026-11-12

### 打赏弹层极简化 + 分类自定义图片 (TASK-070)

#### 打赏弹层极简化

- **删除**金额输入框、留言输入框、收据卡片、独立的「打开支付宝」按钮
- 三个档位按钮排成一行：小红花 **¥2** / 咖啡 **¥9.9** / **自定义**
- **点任意档位直接跳转支付宝**，不再是「先选再确认」两步
- 下方只跟一行文字提示：*点任意档位打开支付宝 · 个人收款码无法预置金额，请在 App 内输入金额*

**为什么这么改**：支付宝**个人**收款码无法预置金额 —— 跳转后仍需用户在 App 内自己输入数字。
既然金额最终由用户在 App 里填，页面上再填一遍就是重复劳动，还会让人误以为「这里填了 App 里就不用填了」。
所以整个输入环节去掉，只用一行字把这件事说清楚。

**降级路径保持不变**：

| 场景 | 行为 |
|---|---|
| 正常浏览器 | 点档位 → 直接跳转支付宝 |
| 微信内置浏览器 | 微信拦截支付宝链接 → 点档位变为复制链接，提示到系统浏览器打开 |
| 后台未配置收款链接 | 三个按钮置灰不可点 + 提示「收款链接待配置」 |

#### 分类自定义图片

- 新建分类时支持**上传一张图片**当分类图标，自动压缩到 256px JPEG
- 现有的 Phosphor 线稿图标选择器（65 个）**保留**，自定义图片作为额外选项
- 图片存 IndexedDB（复用 `imageStore`），不进 localStorage
- 分类图标渲染统一走新的 `CategoryIcon` 组件：有自定义图显示图，没有则回落线稿图标
- 覆盖全部 12 处分类图标渲染点：首页分类网格 / 分类详情面板 / 记账弹窗分类选择 / 记录行 / 统计页排行 / 今日记录 / 日详情 / 分类记录页 / 账户详情 / 一程详情 / 一程记录选择器

**数据模型**：`Category` 与 `Folder` 新增可选字段 `iconImageId`（IndexedDB imageId）。
可选字段 → 老数据没有就是 `undefined`，**零迁移成本**。

**已知限制**：本次只支持在**新建分类**时选择自定义图片，老分类暂不支持修改
（项目当前没有「编辑分类」界面，本次不新增）。

#### 顺带修复

- `JourneyRecordPicker` 的分类标签原来直接输出 `category.icon` 文本，
  Phosphor key（如 `food`）会显示成字面字符串 —— 改走 `CategoryIcon` 统一渲染

### 涉及文件

- `src/components/Accounting/MinePage/DonateSheet.tsx` · `MinePage.module.css`
- `src/components/IconByKey/CategoryIcon.tsx`（新增） · `index.ts`
- `src/components/Accounting/AddCategoryModal/AddCategoryModal.tsx` · `.module.css`
- `src/lib/types.ts` · `src/store/accountStore.ts`
- 11 个分类图标渲染点组件
- `docs/plans/tauri-migration/v3.2/TASK-070-v3.2-donate-simple-and-category-image.md`
