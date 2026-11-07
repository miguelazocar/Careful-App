"""
Generates every app asset from the brand identity sheets in docs/brand/.

    python -I scripts/generate-brand-assets.py

Outputs (assets/images/):
  icon.png                      1024² full-bleed icon (legacy launchers / stores)
  icon-rounded.png              1024² rounded icon on transparent background (splash, in-app)
  android-icon-foreground.png   1024² adaptive-icon foreground (content inside the safe zone)
  android-icon-background.png   1024² adaptive-icon background (brand gradient)
  android-icon-monochrome.png   1024² themed-icon silhouette (Android 13+)
  notification-icon.png         96²  white status-bar icon
  wordmark-light.png            "Careful" for light backgrounds (transparent)
  wordmark-dark.png             "Careful" for dark backgrounds (transparent)
"""
from __future__ import annotations

import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC_LIGHT = os.path.join(ROOT, "docs", "brand", "careful-identity-light.png")
SRC_DARK = os.path.join(ROOT, "docs", "brand", "careful-identity-dark.png")
OUT = os.path.join(ROOT, "assets", "images")

GRAD_A = (47, 128, 255)   # #2F80FF
GRAD_B = (5, 71, 201)     # #0547C9


def is_blue(p) -> bool:
    r, g, b = p[:3]
    return b > 150 and b - r > 90 and b - g > 40


def find_icon_box(img: Image.Image) -> tuple[int, int, int, int]:
    """Bounding box of the blue rounded square in the top-left quadrant."""
    w, h = img.size
    px = img.load()
    xs, ys = [], []
    # the vertical divider sits at ~40% of the width; the blue "Car" wordmark is to its right
    for y in range(0, h // 2, 2):
        for x in range(0, int(w * 0.39), 2):
            if is_blue(px[x, y]):
                xs.append(x)
                ys.append(y)
    return min(xs), min(ys), max(xs) + 2, max(ys) + 2


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = lerp(GRAD_A, GRAD_B, t)
    return img


def estimate_background(icon: Image.Image):
    """Fits bg(x, y) = c0 + cx*x + cy*y per channel using blue pixels (least squares)."""
    px = icon.load()
    w, h = icon.size
    sums = [[0.0] * 3 for _ in range(3)]
    rhs = [[0.0] * 3 for _ in range(3)]
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            p = px[x, y]
            if len(p) == 4 and p[3] < 250:
                continue
            if not is_blue(p):
                continue
            v = (1.0, x / w, y / h)
            for i in range(3):
                for j in range(3):
                    sums[i][j] += v[i] * v[j]
                for c in range(3):
                    rhs[c][i] += v[i] * p[c]

    def solve(m, r):
        m = [row[:] + [r[i]] for i, row in enumerate(m)]
        n = 3
        for i in range(n):
            piv = max(range(i, n), key=lambda k: abs(m[k][i]))
            m[i], m[piv] = m[piv], m[i]
            for k in range(n):
                if k != i:
                    f = m[k][i] / m[i][i]
                    for j in range(i, n + 1):
                        m[k][j] -= f * m[i][j]
        return [m[i][n] / m[i][i] for i in range(n)]

    coefs = [solve(sums, rhs[c]) for c in range(3)]
    return lambda x, y: tuple(coefs[c][0] + coefs[c][1] * x / w + coefs[c][2] * y / h for c in range(3))


def extract_foreground(icon: Image.Image, threshold: float = 110.0) -> Image.Image:
    """Separates the white/mint artwork from the blue gradient (color-difference keying)."""
    icon = icon.convert("RGB")
    bg = estimate_background(icon)
    w, h = icon.size
    src = icon.load()
    out = Image.new("RGBA", (w, h))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            p = src[x, y]
            b = bg(x, y)
            d = math.sqrt(sum((p[i] - b[i]) ** 2 for i in range(3)))
            a = max(0.0, min(1.0, (d - 18) / threshold))
            if a <= 0:
                dst[x, y] = (0, 0, 0, 0)
                continue
            col = tuple(max(0, min(255, int(round(b[i] + (p[i] - b[i]) / a)))) for i in range(3))
            dst[x, y] = (*col, int(round(a * 255)))
    return out


def mono_silhouette(fg: Image.Image) -> Image.Image:
    """Single-color version: the checklist marks and lines on the card become cut-outs."""
    w, h = fg.size
    src = fg.load()
    out = Image.new("RGBA", (w, h))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            whiteness = min(r, g, b) / 255
            on_card = x > w * 0.5 and y > h * 0.5
            alpha = a * (max(0.0, (whiteness - 0.55) / 0.35) if on_card else 1.0)
            dst[x, y] = (255, 255, 255, int(max(0, min(255, alpha))))
    return out


def rounded_mask(size: int, radius_ratio: float = 0.225) -> Image.Image:
    scale = 4
    m = Image.new("L", (size * scale, size * scale), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size * scale - 1, size * scale - 1), radius=int(size * scale * radius_ratio), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def place(fg: Image.Image, canvas: int, scale: float) -> Image.Image:
    side = int(canvas * scale)
    art = fg.resize((side, side), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    off = (canvas - side) // 2
    out.alpha_composite(art, (off, off))
    return out


def wordmark(src: Image.Image, bg_rgb, box) -> Image.Image:
    crop = src.crop(box).convert("RGB")
    w, h = crop.size
    px = crop.load()
    out = Image.new("RGBA", (w, h))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            d = math.sqrt(sum((p[i] - bg_rgb[i]) ** 2 for i in range(3)))
            a = max(0.0, min(1.0, (d - 10) / 120.0))
            if a <= 0:
                dst[x, y] = (0, 0, 0, 0)
                continue
            col = tuple(max(0, min(255, int(round(bg_rgb[i] + (p[i] - bg_rgb[i]) / a)))) for i in range(3))
            dst[x, y] = (*col, int(round(a * 255)))
    bbox = out.getbbox()
    out = out.crop(bbox)
    pad = 8
    framed = Image.new("RGBA", (out.width + pad * 2, out.height + pad * 2), (0, 0, 0, 0))
    framed.alpha_composite(out, (pad, pad))
    return framed


def sample_bg(img: Image.Image, at=(20, 20)):
    return img.convert("RGB").getpixel(at)


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    light = Image.open(SRC_LIGHT).convert("RGBA")
    dark = Image.open(SRC_DARK).convert("RGBA")

    x0, y0, x1, y1 = find_icon_box(light)
    side = max(x1 - x0, y1 - y0)
    icon_crop = light.crop((x0, y0, x0 + side, y0 + side))
    # inset 4% to drop the anti-aliased rounded corner against the page background
    inset = int(side * 0.04)
    inner = icon_crop.crop((inset, inset, side - inset, side - inset))

    fg = extract_foreground(inner)
    # drop the page background that shows through the source's rounded corners
    corner = rounded_mask(side, 0.235).resize((side, side)).crop((inset, inset, side - inset, side - inset))
    corner = corner.filter(ImageFilter.MinFilter(9))
    fg.putalpha(Image.composite(fg.getchannel("A"), Image.new("L", fg.size, 0), corner))

    # full-bleed legacy icon: gradient + artwork at the original proportion
    full = gradient(1024).convert("RGBA")
    full.alpha_composite(place(fg, 1024, 0.92 * (side - 2 * inset) / side))
    full.convert("RGB").save(os.path.join(OUT, "icon.png"))

    rounded = full.copy()
    rounded.putalpha(rounded_mask(1024))
    rounded.save(os.path.join(OUT, "icon-rounded.png"))

    # adaptive icon: artwork scaled into the 66/108 safe zone
    place(fg, 1024, 0.70).save(os.path.join(OUT, "android-icon-foreground.png"))
    gradient(1024).save(os.path.join(OUT, "android-icon-background.png"))

    silhouette = mono_silhouette(fg)
    mono = Image.new("RGBA", (1024, 1024), (255, 255, 255, 0))
    mono.putalpha(place(silhouette, 1024, 0.70).getchannel("A"))
    mono.save(os.path.join(OUT, "android-icon-monochrome.png"))

    notif = Image.new("RGBA", (1024, 1024), (255, 255, 255, 0))
    notif.putalpha(place(silhouette, 1024, 0.96).getchannel("A"))
    notif.resize((96, 96), Image.LANCZOS).save(os.path.join(OUT, "notification-icon.png"))

    # wordmark (top-right block of the sheet)
    wm_box = (530, 260, 1210, 470)
    wordmark(light, sample_bg(light), wm_box).save(os.path.join(OUT, "wordmark-light.png"))
    wordmark(dark, sample_bg(dark), wm_box).save(os.path.join(OUT, "wordmark-dark.png"))

    print("icon box:", (x0, y0, x0 + side, y0 + side))
    print("assets written to", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
