# TASK-069 · v3.2 打赏弹层：支付宝一键跳转

> **状态**：🧩 实现中，待验收
> **分支**：`feat/v3.2-donate-alipay`
> **范围**：`src/lib/donate.ts` / `src/components/Accounting/MinePage/DonateSheet.tsx` / `MinePage.module.css` / `server/src/index.ts` / `server/public/admin/index.html`

---

## 目标

MINE 页「打赏作者」弹层：**去掉二维码、去掉微信**，只留一个「打开支付宝」按钮，点一下直接唤起支付宝 App 付款。

---

## 为什么只做支付宝

各类收款码二维码里的原文协议决定了能不能跳转：

| 收款码类型 | 二维码原文协议 | 能否点击跳转 |
|---|---|---|
| 微信**个人**收款码 | `wxp://f2f0qa_fsPnKMI5UzB1...` | ❌ 微信官方限制，只能扫码 / 微信内长按识别 |
| 微信**经营码**（小微商户） | `https://payapp.weixin.qq.com/qrpay/order/home2?key=...` | ✅ 能（需先申请经营账户） |
| 支付宝**个人**收款码 | `https://qr.alipay.com/fkx06550...` | ✅ 能 |

支付宝个人收款码是标准 https 链接，点一下直接唤起支付宝 App 的付款页。

**微信那一档已按用户要求整个去掉** —— 微信个人码这条路走不通
（`wxp://` 私有协议，官方明确不允许第三方页面直接跳转唤起），
既然不做二维码，微信就没有存在意义。

**正式支付接口（微信 Native / 支付宝当面付）本次不做**：
- 微信 Native 需要营业执照 + 身份证 + 对公/法人账户 + **已认证应用的 APPID**，四项缺一不可
- 支付宝当面付个人账号申请**也要营业执照** + 经营场所照片 + 店铺名称 + 实际经营地址
- 属于「资质门槛」问题，不是技术问题

---

## 设计

### 收款链接来源

走**已有的** `/api/config`（后端公开配置接口）+ 管理后台「系统配置」，
而不是新建静态 JSON 文件：

- 收款链接会变（换码、换服务商），放后台就能随时改，不必重新部署前端
- 也不必把收款链接提交进 git（静态文件方案会泄露）

后端新增白名单字段 `alipayPayUrl`，管理后台「系统配置」加一个输入框。

### 交互

**支付宝**
- 收据撕线下方一个**实心墨块**按钮「打开支付宝」→ `window.location.href = alipayUrl`
- 微信内置浏览器会拦截支付宝链接 → 该场景下按钮变成「复制链接」，
  提示「微信里打不开支付宝，复制到浏览器打开」（三级兜底复制，与 MoreSheet 同思路）
- 后台没配链接 → 不显示按钮，显示「收款链接待配置」

**金额错位提示**

个人收款码**无法预置金额** —— 选了 ¥50，跳转后仍需自己在支付 App 里输入 50 块。
这一点必须在 UI 上说明，否则会造成「金额对不上」的误会：

- 按钮下方一行小字：`个人收款码无法预置金额，请在 App 内手动输入该金额`

### 金额选项排一行

三个选项（小红花 / 咖啡 / 自定义）改成 `grid-template-columns: repeat(3, 1fr)` 一行排布。

- 「自定义」卡原来横跨两列、横向布局（被当成另一个层级的「入口」），
  现在跟另外两个平级，改回纵向
- 「自定义」标题用**正文字体**而不是等宽数字字体 ——
  它是词不是金额，用 mono 22px 会跟 ¥2 / ¥9.9 抢视觉重量
- 卡片变窄后放不下 note 文案（「一朵花的心意」），**去掉 note**，
  每张卡只留图标 + 金额 + 标签

### 删除的东西

- `public/donate/` 整个目录（收款码图片不再需要）
- CSS 类：`payTabs` / `payTab` / `payTabActive` / `receiptQr` / `qrImage` /
  `qrPlaceholder` / `qrPlaceholderHint` / `tipNote`
- `DonatePayUrls.wechatUrl` 字段
- 后端 `PUBLIC_SETTING_KEYS` 里的 `wechatPayUrl`
- 管理后台的「微信收款链接」输入框

---

## 实现

### `src/lib/donate.ts`

```ts
export interface DonatePayUrls {
  alipayUrl: string;
}

export const EMPTY_PAY_URLS: DonatePayUrls = { alipayUrl: '' };

export async function fetchDonatePayUrls(): Promise<DonatePayUrls>
export function isWechatBrowser(): boolean
```

`fetchDonatePayUrls` 走 `request('/api/config')`，**永不抛错**，拿不到就返回空配置。

### `src/components/Accounting/MinePage/DonateSheet.tsx`

- 删掉 `PayMethod` / `METHODS` / `method` state / `qrFailed` state
- 收据「方式」行固定显示「支付宝」
- 收款码区换成跳转按钮

### `server/src/index.ts`

`PUBLIC_SETTING_KEYS` 增加 `alipayPayUrl`。

### `server/public/admin/index.html`

「系统配置」加「支付宝收款链接」输入框 + 读取/保存。

---

## 验证

- `npm run typecheck` 通过
- `npm run test` 通过（560 个，`donate.test.ts` 补了 `fetchDonatePayUrls` 容错用例 + `isWechatBrowser`）
- `npm run build` 通过（前端 + server）
- 浏览器验收（本地 dev + 本地后端）：
  - 三张卡同一行（实测 `rows: 1`，y 坐标一致，等宽 585px）
  - 「打开支付宝」按钮存在，实心墨块（`rgb(15,15,15)` 底 + 米白字）
  - 自定义档展开正常，收据联动正确（输入 50 → 收据「金额 ¥50」）
  - 点击按钮确实发生导航（跳到 `qr.alipay.com/...`）
  - 后台未配链接时不显示按钮

---

## 待用户验收

- [ ] 真机点「打开支付宝」能否唤起支付宝 App 并进入付款页
- [ ] 金额手输提示是否清楚
- [ ] 三个主题下弹层是否正常
- [ ] 三卡一行在窄屏（手机）上是否挤
