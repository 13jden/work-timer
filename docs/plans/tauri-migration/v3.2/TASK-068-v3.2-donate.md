# TASK-068 · v3.2 MINE 页打赏入口 + 打赏弹层

> **状态**：🧩 实现中，待验收
> **分支**：`feat/v3.2-backend`
> **范围**：`src/components/Accounting/MinePage/DonateSheet.tsx`（新增）+ `MinePage.tsx` / `MinePage.module.css`

---

## 目标

MINE 页加一个「打赏作者」按钮，点开能选**微信 / 支付宝**，选**小红花 ¥2** 或**咖啡 ¥9.9**，
展示对应收款码。设计要跟主题匹配、简约。

---

## 设计方向

项目本身是**纸感编辑风**：Cormorant Garamond 衬线标题 + Figtree 正文 + JetBrains Mono 数字，
暖白纸底 + 墨黑 + 柠檬黄 accent，三套主题（paper / obsidian / gold）。

打赏弹层因此不做常见的「彩色卡片 + 渐变按钮」，而是做成一张**咖啡店收据**：

- **收据卡**：`--paper-4` 底 + 细边框 + 打孔撕线（虚线贴图），行间用等宽字体列「项目 / 金额 / 方式」
- **金额卡**：小红花 / 咖啡 两张并排，选中态是 `--ink` 描边 + 柠檬黄 12% 淡染
- **支付切换**：胶囊分段控件，微信 / 支付宝
- **收款码**：168×168 白底圆角，缺图时回落成虚线占位（提示图片该放哪）
- **动效**：底部 sheet 上滑 280ms，`cubic-bezier(0.32, 0.72, 0, 1)`

唯一花活是那张收据的撕线——其他元素保持安静。

---

## 实现

### 新增 `DonateSheet.tsx`

```tsx
type TipId = 'flower' | 'coffee';
type PayMethod = 'wechat' | 'alipay';

const TIPS = [
  { id: 'flower', label: '小红花', amount: '¥2',   note: '一朵花的心意' },
  { id: 'coffee', label: '咖啡',   amount: '¥9.9', note: '换一杯续命' },
];
```

- 金额卡图标用 `@phosphor-icons/react` 的 `FlowerLotus` / `Coffee`
- 收款码 `<img src="/donate/${method}-qr.png">`，`onError` → `qrFailed` 态渲染占位块
- 默认选中「咖啡 ¥9.9 + 微信」

### `MinePage.tsx`

- 新增 `donateOpen` state
- 在 `settingsList`（结余目标 / 隐藏计时模式）下面加一行「打赏作者」按钮
- 按钮文案：`打赏作者` / `小红花 ¥2 · 咖啡 ¥9.9，支持一下这个项目`，右侧 `HeartStraight` 图标
- 底部挂 `<DonateSheet open={donateOpen} onClose={...} />`

### `MinePage.module.css`

新增类（全部新前缀，不动已有样式）：
`donateModal` / `donateTitle` / `donateSub` / `tipGrid` / `tipCard` / `tipCardActive` / `tipIcon` /
`tipAmount` / `tipLabel` / `tipNote` / `payTabs` / `payTab` / `payTabActive` /
`receipt` / `receiptRow` / `receiptMono` / `receiptPerf` / `receiptQr` / `qrImage` /
`qrPlaceholder` / `qrPlaceholderHint` / `receiptFoot` / `donateEntry` / `donateEntryText` /
`donateEntryTitle` / `donateEntryHint` / `donateEntryRight`

---

## 收款码

真实收款码还没放，位置约定：

```
public/donate/
├── wechat-qr.png     ← 微信收款码
└── alipay-qr.png     ← 支付宝收款码
```

放进去即生效，代码不用改。`public/donate/README.md` 说明了这件事。

---

## 验证

- `npm run typecheck` 通过
- `npm run build` 通过
- Playwright 截图（`scripts/shoot-donate.mjs`）→ `design-preview/v32-donate-sheet.png`
  - 桌面端布局（1440×900，宽高比 ≥ 3/2）→ 侧栏「我的」→ MINE 页 → 点「打赏作者」
  - 截图确认：两张金额卡、微信/支付宝切换、收据三行、收款码占位、关闭按钮，排版正常

---

## 待用户验收

- [ ] 真机 / 浏览器打开 MINE 页，弹层观感是否满意
- [ ] 收款码放入后能正常显示
- [ ] 三个主题（paper / obsidian / gold）下弹层是否都正常
