#!/usr/bin/env python3
"""
星芒 · 提示词一键优化（dsh-prompt-starlight）
Copyright (c) 2026 Starlit Sky · SPDX-License-Identifier: AGPL-3.0-only
https://github.com/Starlit-Sky-code/dsh-prompt-starlight

把 docs/screenshots/ 里的 PNG 转成 256 色调色板图。

界面截图是少色内容，量化到 256 色后肉眼无差别，而体积只剩约 40%：
这些图会随包发布（README 在 npm 页面上要渲染它们），不压的话光截图就 1 MB。

跑法：python tools/optimize-shots.py
"""

import pathlib
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = ROOT / "docs" / "screenshots"


def main() -> int:
    files = sorted(SHOTS.glob("*.png"))
    if not files:
        print(f"没有找到 PNG：{SHOTS}")
        return 1

    before_total = after_total = 0
    for path in files:
        before = path.stat().st_size
        # RGB → 调色板；FLOYDSTEINBERG 抖动保住柔和阴影的过渡
        image = Image.open(path).convert("RGB")
        quantized = image.quantize(
            colors=256,
            method=Image.Quantize.MEDIANCUT,
            dither=Image.Dither.FLOYDSTEINBERG,
        )
        quantized.save(path, "PNG", optimize=True)
        after = path.stat().st_size
        before_total += before
        after_total += after
        print(f"  {path.name:26} {before / 1024:7.1f} KB -> {after / 1024:7.1f} KB")

    saved = (before_total - after_total) / 1024 / 1024
    print(
        f"合计 {before_total / 1024 / 1024:.2f} MB -> {after_total / 1024 / 1024:.2f} MB"
        f"（省下 {saved:.2f} MB，{len(files)} 张）"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
