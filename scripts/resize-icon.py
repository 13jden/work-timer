"""
把 src-tauri/icon-source.png 缩小并居中到 safe zone(~62%)内,输出 src-tauri/icon-source.png。
Android adaptive icon 的 inner safe zone 是 66%, 留 4% buffer 让内容在所有 launcher 都不会被裁。
"""
from PIL import Image
import os

SRC = r'd:\MyProject\work-timer\src-tauri\icon-source.png'
OUT = SRC  # 直接覆写

im = Image.open(SRC).convert('RGBA')
w, h = im.size
print(f'原图: {w}x{h}')

# 1. 方形化 (取最小边, 居中裁剪)
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
im = im.crop((left, top, left + side, top + side))
print(f'方形化后: {im.size}')

# 2. 计算原图的非透明 bbox
alpha = im.split()[3]
bbox = alpha.getbbox()
print(f'原内容 bbox: {bbox}, 占比 {(bbox[2]-bbox[0])/side*100:.1f}% x {(bbox[3]-bbox[1])/side*100:.1f}%')

# 3. 缩到 62% 内圈 (safe zone = 66% 圆形内圈, 留 4% buffer)
target_ratio = 0.62
target_size = int(side * target_ratio)

# 裁掉原图的透明 padding, 让内容紧凑
cx0, cy0, cx1, cy1 = bbox
crop = im.crop((cx0, cy0, cx1, cy1))
cw, ch = crop.size
print(f'裁后内容: {cw}x{ch}')

# 等比缩放使最长边 = target_size
scale = target_size / max(cw, ch)
new_w = int(cw * scale)
new_h = int(ch * scale)
crop_resized = crop.resize((new_w, new_h), Image.LANCZOS)
print(f'缩到: {new_w}x{new_h}, 实际占比 {new_w/side*100:.1f}%')

# 4. 居中贴到透明画布
out = Image.new('RGBA', (side, side), (0, 0, 0, 0))
out.paste(crop_resized, ((side - new_w) // 2, (side - new_h) // 2), crop_resized)

# 5. 保存
out.save(OUT, 'PNG')
print(f'保存到: {OUT}')

# 验证
im2 = Image.open(OUT).convert('RGBA')
px = im2.load()
W = im2.size[0]
xs, ys = [], []
for y in range(W):
    for x in range(W):
        if px[x, y][3] > 10:
            xs.append(x); ys.append(y)
print(f'\n验证: 内容占 x={min(xs)}-{max(xs)} ({round((max(xs)-min(xs))/W*100,1)}%) y={min(ys)}-{max(ys)} ({round((max(ys)-min(ys))/W*100,1)}%)')
print(f'安全区 (66% 内圈): 像素 {W*0.17:.0f}-{W*0.83:.0f}')
print(f'4 边留白: 上 {min(ys)}px, 下 {W-max(ys)}px, 左 {min(xs)}px, 右 {W-max(xs)}px')
