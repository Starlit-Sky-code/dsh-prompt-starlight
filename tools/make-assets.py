# 星芒 · 提示词一键优化（dsh-prompt-starlight）
# Copyright (c) 2026 Starlit Sky · SPDX-License-Identifier: AGPL-3.0-only
# https://github.com/Starlit-Sky-code/dsh-prompt-starlight
# 保留本署名是使用条件（AGPL-3.0 第 4、5、13 条）。商业授权请联系作者。
"""生成插件图标与 GitHub 社交预览图。

输入：.tmp/icon-src.webp（320×320，用户提供的作品）
输出：
  assets/icon.png            320×320  PNG（原尺寸，不放大，避免伪造分辨率）
  assets/icon-640.png        640×640  2 倍图（LANCZOS）
  assets/social-preview.png  1280×640 GitHub 社交预览

配色从作品本身取样（右上角那个橙色四角星），保证与插画一致。
所有半透明叠加都走 RGBA 图层再 alpha_composite——RGB 画布会吞掉 alpha。
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".tmp" / "icon-src.webp"
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)

FONT_CJK = "C:/Windows/Fonts/msyh.ttc"
FONT_CJK_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_LATIN = "C:/Windows/Fonts/segoeuib.ttf"

BG = (17, 19, 24)


def sample_accent(image: Image.Image) -> tuple[int, int, int]:
    """从右上角区域找出饱和度最高的像素，作为强调色。"""
    w, h = image.size
    best, best_score = (0, 0, 0), -1.0
    for y in range(0, int(h * 0.45), 2):
        for x in range(int(w * 0.5), w, 2):
            r, g, b = image.getpixel((x, y))[:3]
            mx, mn = max(r, g, b), min(r, g, b)
            score = (mx - mn) * (mx / 255)
            if score > best_score:
                best, best_score = (r, g, b), score
    return best


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def rounded(im: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), radius=radius, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def glow_layer(size: tuple[int, int], blobs) -> Image.Image:
    """在纯黑上画光斑再模糊，供 screen 叠加上色。"""
    layer = Image.new("RGB", size, (0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for box, color in blobs:
        draw.ellipse(box, fill=color)
    return layer.filter(ImageFilter.GaussianBlur(140))


def main() -> None:
    src = Image.open(SRC).convert("RGB")
    accent = sample_accent(src)
    accent_hex = "#%02x%02x%02x" % accent
    print(f"取样强调色: {accent_hex} {accent}")

    # —— 图标：原尺寸 + 2 倍图 ——
    src.save(ASSETS / "icon.png", "PNG")
    src.resize((640, 640), Image.LANCZOS).save(ASSETS / "icon-640.png", "PNG")

    # —— 社交预览 1280×640 ——
    W, H = 1280, 640
    canvas = Image.new("RGB", (W, H), BG)

    # 光斑：强调色在左上，深蓝在右下
    blobs = [
        ((-300, -340, 640, 520), (accent[0] // 7, accent[1] // 7, accent[2] // 7)),
        ((860, 200, 1620, 920), (22, 30, 62)),
    ]
    canvas = Image.composite(canvas, glow_layer((W, H), blobs), Image.new("L", (W, H), 0)).convert("RGB")
    canvas = Image.blend(Image.new("RGB", (W, H), BG), glow_layer((W, H), blobs), 0.55)

    # 极淡网格 + 图标底座光晕，统一在 RGBA 图层里做
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    for x in range(0, W, 40):
        odraw.line([(x, 0), (x, H)], fill=(255, 255, 255, 8), width=1)
    for y in range(0, H, 40):
        odraw.line([(0, y), (W, y)], fill=(255, 255, 255, 8), width=1)

    size = 300
    ix, iy = 88, (H - size) // 2
    halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(halo).rounded_rectangle(
        (ix - 30, iy - 20, ix + size + 30, iy + size + 52), radius=80, fill=accent + (90,)
    )
    overlay = Image.alpha_composite(overlay, halo.filter(ImageFilter.GaussianBlur(52)))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay)

    icon = rounded(src.resize((size, size), Image.LANCZOS), 56)
    canvas.paste(icon, (ix, iy), icon)

    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((ix, iy, ix + size - 1, iy + size - 1), radius=56, outline=(255, 255, 255, 48), width=2)

    # 文案
    tx = ix + size + 64
    draw.text((tx, 128), "DSH  ·  PROMPT  PLUGIN", font=font(FONT_LATIN, 22), fill=(140, 148, 166))
    draw.text((tx, 168), "星芒 · 提示词一键优化", font=font(FONT_CJK_BOLD, 64), fill=(240, 242, 246))
    draw.text((tx, 252), "Starlit Sky", font=font(FONT_CJK_BOLD, 36), fill=accent)
    draw.text(
        (tx + 208, 260), "/  dsh-prompt-starlight", font=font(FONT_LATIN, 24), fill=(150, 158, 176)
    )
    draw.text(
        (tx, 316), "输入框旁的四角星：一键把草稿改写成高质量提示词",
        font=font(FONT_CJK, 25), fill=(176, 184, 199),
    )
    draw.text(
        (tx, 354), "规则 / 风格 / 语言 / 模型全部可自定义，带独立设置页",
        font=font(FONT_CJK, 25), fill=(146, 154, 172),
    )

    # 卖点 chip（半透明描边 + 深色底，画在 RGBA 图层后合成）
    chip_font = font(FONT_CJK, 21)
    chips = ["11 条内置规则", "模型切换", "一键撤销", "AGPL-3.0"]
    chips_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cdraw = ImageDraw.Draw(chips_layer)
    cxp = tx
    for text in chips:
        bbox = cdraw.textbbox((0, 0), text, font=chip_font)
        cw = bbox[2] - bbox[0] + 34
        cdraw.rounded_rectangle(
            (cxp, 424, cxp + cw, 466), radius=21, fill=(30, 34, 42, 220), outline=(255, 255, 255, 36), width=1
        )
        cdraw.text((cxp + 17, 434), text, font=chip_font, fill=(208, 214, 226))
        cxp += cw + 12
    canvas = Image.alpha_composite(canvas, chips_layer)

    draw = ImageDraw.Draw(canvas)
    draw.text(
        (tx, 502), "github.com/Starlit-Sky-code/dsh-prompt-starlight",
        font=font(FONT_LATIN, 20), fill=(128, 136, 152),
    )
    draw.rectangle((0, H - 6, W, H), fill=accent + (255,))

    out = ASSETS / "social-preview.png"
    canvas.convert("RGB").save(out, "PNG", optimize=True)

    print(f"写出 icon.png {src.size} / icon-640.png / social-preview.png {canvas.size}")
    for f in sorted(ASSETS.glob("*.png")):
        print(f"  {f.name:22} {f.stat().st_size / 1024:7.1f} KB")


if __name__ == "__main__":
    main()
