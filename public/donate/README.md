# 打赏收款码目录

把作者的收款码图片放到这个目录，文件名固定为：

- `wechat-qr.png` —— 微信收款码
- `alipay-qr.png` —— 支付宝收款码

前端（`src/components/Accounting/MinePage/DonateSheet.tsx`）按
`/donate/<method>-qr.png` 加载；图片不存在时会自动回落到占位提示，
所以放之前不会报错。
