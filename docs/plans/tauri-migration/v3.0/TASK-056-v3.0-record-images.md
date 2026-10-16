# TASK-056 · 记录附图：本地图片（Phase 2）

| 字段 | 值 |
|---|---|
| **分支** | `feat/v3.0-mobile` |
| **所属版本** | v3.0 |
| **依赖** | 无 |
| **优先级** | P0（用户明确需求 ④） |
| **状态** | ✅ 完成 |

---

## 1. 背景

单个记账记录希望可以关联一张图片（小票、截图、现场照片），**图片存放用户本地**，延续「不上云、不注册、不联网」原则。
同时本任务搭建的图片管线（压缩 + IndexedDB）将被 TASK-059「一程」封面复用。

**关键约束**：主数据在 localStorage（配额约 5MB），**图片绝不能进 localStorage**——走 IndexedDB。

## 2. 任务清单

| ID | 任务 | 说明 |
|---|---|---|
| T-561 | 图片存储层 | `lib/imageStore.ts`：IndexedDB 封装（put / get / delete / has），库 `salary_timer_images`，`imageId → Blob` |
| T-562 | 压缩管线 | `lib/imageCompress.ts`：File → canvas 缩放（最长边 ≤1280px）→ JPEG 0.8 → Blob；返回压缩后 Blob 与尺寸信息 |
| T-563 | 记录数据扩展 | `AccountRecord.imageId?: string`；addRecord / updateRecord 支持写入与清除 |
| T-564 | 记账弹窗附图区 | AddRecordModal 新增「图片」区：无图显示「＋ 添加图片」虚线框；有图显示缩略图 + 「替换 / 移除」 |
| T-565 | 列表缩略图 | 记录行（RecordRow / DayDetailSheet / TodayRecordsList）有图时显示 36px 圆角缩略图 |
| T-566 | 全屏预览 | `ImagePreview` 共用弹层：点缩略图 / 弹窗大图打开，遮罩 + 关闭；编辑弹窗内大图同样可点 |
| T-567 | 级联清理 | 删除记录时，若该 imageId 无其他记录引用 → deleteImage；更新换图时旧图同规则清理 |

## 3. 详细设计

### 3.1 IndexedDB 封装（T-561）

```ts
// lib/imageStore.ts —— 全部 async，失败静默降级（返回 null / false），不阻塞记账主流程
openImageDB(): Promise<IDBDatabase>        // 懒打开，单例缓存；版本 1
putImage(imageId: string, blob: Blob): Promise<boolean>
getImage(imageId: string): Promise<Blob | null>
deleteImage(imageId: string): Promise<void>
```

- imageId 生成：`img-<uuid>`（与现有 id 风格一致）
- 测试环境无 IndexedDB：所有函数走 `typeof indexedDB === 'undefined'` 早返回，单测只覆盖该降级分支与 id 生成；真实读写靠浏览器验收
- 读取侧提供 `useImage(imageId)` hook：挂载时 `getImage` → `URL.createObjectURL`，卸载时 `revokeObjectURL`，避免内存泄漏

### 3.2 压缩管线（T-562）

```ts
compressImage(file: File, maxEdge = 1280, quality = 0.8): Promise<{ blob: Blob; width: number; height: number }>
```

- `createImageBitmap(file)`（降级 `Image + FileReader`）→ 计算缩放比 → `canvas.drawImage` → `canvas.toBlob('image/jpeg', quality)`
- HEIC 等浏览器解不了的格式：压缩失败时提示「该图片格式暂不支持」，不保存
- 原图小于 1280px 且 ≤300KB 时跳过重压缩，直接入库

### 3.3 记账弹窗附图区（T-564）

- 位置：备注输入下方（图片是低频可选项，不挤占金额 / 分类主路径）
- `<input type="file" accept="image/*">` 隐藏触发；移动端系统自动给出「拍照 / 相册」选择
- 压缩中显示占位 loading；失败给 toast 文案
- 编辑已有附图记录：显示大图（高度 120px 裁剪）+ 移除按钮；保存时才执行 put / delete（取消不产生副作用）

### 3.4 级联清理规则（T-567）

```
删除记录 r：
  if r.imageId && 无其他 record.imageId === r.imageId（排除 r 自身）
    → deleteImage(r.imageId)
编辑记录换图（old → new）：
  保存成功后，对 old 执行同上引用检查清理
```

纯函数 `findOrphanedImageId(records, removedOrChangedRecord)` 放 `lib/accounting/`，**必须单测**。

## 4. 新增 / 改动文件

| 文件 | 改动 |
|---|---|
| `src/lib/imageStore.ts` | 新增：IndexedDB 封装 |
| `src/lib/imageCompress.ts` | 新增：压缩管线（纯逻辑可测部分抽函数） |
| `src/lib/accounting/images.ts` + 单测 | 新增：`findOrphanedImageId` 等引用检查纯函数 |
| `src/hooks/useImage.ts` | 新增：按 imageId 读图并管理 ObjectURL |
| `src/lib/types.ts` | `AccountRecord.imageId?: string` |
| `src/store/accountStore.ts` | addRecord / updateRecord / deleteRecord 支持 imageId 与级联清理 |
| `src/components/Accounting/AddRecordModal/*` | 附图区 UI |
| `src/components/Accounting/RecordRow/*`、`DayDetailSheet/*`、`TodayRecordsList/*` | 缩略图展示 |
| `src/components/Accounting/ImagePreview/*` | 新增：全屏预览弹层 |

## 5. 验收标准

- [ ] 记账弹窗可拍照 / 选图附图，保存后列表行出现缩略图
- [ ] 图片经压缩（抽验存储体积 ≤ 约 300KB/张），存于 IndexedDB，localStorage 体积不增长
- [ ] 编辑弹窗可替换 / 移除图片；点图可全屏预览
- [ ] 删除记录后其图片被清理（DevTools 验证 IndexedDB 无孤儿）
- [ ] 无 IndexedDB 环境（隐私模式等）降级不崩溃：仅图片功能不可用，记账正常
- [ ] 日历日详情、快速记录今日列表中的记录行同样显示缩略图
- [ ] 三套主题配色正确；桌面端布局不受影响
- [ ] typecheck / test / build 全绿 + 用户浏览器 / 真机验收通过

## 6. 不做的事

- ❌ 多图（一条记录一张，控制存储与 UI 复杂度）
- ❌ 图片编辑 / 滤镜 / 捏合缩放预览
- ❌ 独立「相册」页（删图级联即可，见 PRD §09 Q3）

---

*创建于 2026-10-09 · 状态：待开发*
