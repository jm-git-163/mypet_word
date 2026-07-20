# -*- coding: utf-8 -*-
"""
make_brand.py — 로고와 아이콘 한 벌 만들기

만드는 것
    images/icon-192.png        홈 화면에 추가했을 때
    images/icon-512.png        큰 아이콘
    images/icon-maskable.png   안드로이드가 모양을 잘라 쓰는 아이콘
    images/apple-touch-icon.png  아이폰
    images/og.png              카톡·문자로 보낼 때 뜨는 미리보기 (1200×630)

로고는 앱 안의 강아지와 같은 얼굴입니다.
아이콘마다 다른 그림을 쓰면 '같은 앱'으로 보이지 않습니다.

쓰는 법
    python tools/make_brand.py
"""
import os, sys, math

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
except Exception:
    print("Pillow 가 없습니다.  pip install pillow"); sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "images")

# 앱과 같은 빛깔 (css/style.css 의 감빛)
CREAM = (253, 247, 241)
CREAM_EDGE = (232, 214, 194)
DARK = (41, 33, 27)
CHEEK = (246, 185, 196)
AMBER = (239, 143, 34)
AMBER_DEEP = (194, 108, 5)
BG_TOP = (255, 238, 219)
BG_BOT = (255, 224, 194)
MUTED = (91, 78, 68)

FONT_BD = "C:/Windows/Fonts/malgunbd.ttf"
FONT_RG = "C:/Windows/Fonts/malgun.ttf"


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def squircle(size, radius_ratio=0.235):
    """iOS 처럼 모서리가 부드럽게 흐르는 사각형 마스크"""
    S = 4
    m = Image.new("L", (size * S, size * S), 0)
    d = ImageDraw.Draw(m)
    r = int(size * S * radius_ratio)
    d.rounded_rectangle([0, 0, size * S - 1, size * S - 1], radius=r, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def dog_face(size, pad=0.16):
    """
    강아지 얼굴 — 앱의 SVG 와 같은 비율.
    아이콘은 작게 쓰이므로 몸통 없이 얼굴만 크게 담습니다.
    """
    S = 4
    W = size * S
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 200 기준 좌표를 아이콘 크기로 옮깁니다
    inner = W * (1 - pad * 2)
    def X(v): return W * pad + inner * (v / 200.0)
    def R(v): return inner * (v / 200.0)

    def ell(cx, cy, rx, ry, fill, outline=None, w=2.4):
        d.ellipse([X(cx) - R(rx), X(cy) - R(ry), X(cx) + R(rx), X(cy) + R(ry)],
                  fill=fill, outline=outline, width=max(1, int(R(w))))

    # 귀 (늘어진)
    ell(52, 112, 21, 34, CREAM, CREAM_EDGE)
    ell(148, 112, 21, 34, CREAM, CREAM_EDGE)
    # 머리
    ell(100, 100, 62, 60, CREAM, CREAM_EDGE)
    # 이마 털
    ell(100, 48, 26, 12, (255, 255, 255, 220))
    # 눈웃음
    for ex in (78, 122):
        d.arc([X(ex - 13), X(92 - 12), X(ex + 13), X(92 + 12)],
              start=200, end=340, fill=DARK, width=max(2, int(R(4.6))))
    # 코
    ell(100, 112, 10, 8, DARK)
    ell(96, 109, 3, 2, (255, 255, 255, 160))
    # 입
    ell(100, 130, 12, 10, (194, 86, 106))
    ell(100, 135, 7, 5, (240, 140, 160))
    # 볼
    ell(62, 116, 11, 7.5, CHEEK + (170,))
    ell(138, 116, 11, 7.5, CHEEK + (170,))

    return img.resize((size, size), Image.LANCZOS)


def icon(size, maskable=False):
    """감빛 바탕에 강아지 얼굴을 담은 아이콘"""
    S = 2
    W = size * S
    base = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    # 위에서 아래로 흐르는 감빛
    for y in range(W):
        t = y / W
        c = tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t) for i in range(3))
        d.line([(0, y), (W, y)], fill=c)

    # 마스커블은 가장자리가 잘리므로 얼굴을 더 작게 넣습니다
    face = dog_face(W, pad=0.26 if maskable else 0.15)
    base.alpha_composite(face)

    out = base.resize((size, size), Image.LANCZOS)
    if not maskable:
        m = squircle(size)
        res = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        res.paste(out, (0, 0), m)
        return res
    return out


def og():
    """카톡·문자 미리보기 (1200×630)"""
    W, H, S = 1200, 630, 2
    img = Image.new("RGBA", (W * S, H * S), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    for y in range(H * S):
        t = (y / (H * S)) ** 0.85
        c = tuple(int(BG_TOP[i] + (255 - BG_TOP[i]) * t * 0.55) for i in range(3))
        d.line([(0, y), (W * S, y)], fill=c)

    # 은은한 빛무리
    glow = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-200 * S, -260 * S, 620 * S, 420 * S], fill=AMBER + (26,))
    glow = glow.filter(ImageFilter.GaussianBlur(90 * S // 2))
    img.alpha_composite(glow)

    # 로고 — 왼쪽
    ic = icon(300 * S)
    img.alpha_composite(ic, (150 * S, (H * S - 300 * S) // 2))

    # 글자 — 오른쪽
    f_title = font(FONT_BD, 100 * S)
    f_sub = font(FONT_RG, 40 * S)
    f_tag = font(FONT_BD, 33 * S)
    tx = 520 * S
    d.text((tx, 200 * S), "낱말 산책", font=f_title, fill=DARK)
    d.text((tx, 330 * S), "매일 함께 걷는", font=f_sub, fill=MUTED)
    d.text((tx, 382 * S), "한국어 낱말 퍼즐", font=f_sub, fill=MUTED)

    tag = "무료 · 광고 없음"
    bb = d.textbbox((0, 0), tag, font=f_tag)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    px, py = 26 * S, 14 * S
    bx, by = tx, 460 * S
    bh = th + py * 2
    d.rounded_rectangle([bx, by, bx + tw + px * 2, by + bh], radius=int(bh / 2), fill=AMBER)
    d.text((bx + px, by + py - 4 * S), tag, font=f_tag, fill=(61, 31, 0))

    return img.convert("RGB").resize((W, H), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    made = []
    for name, size, mask in [("icon-192.png", 192, False), ("icon-512.png", 512, False),
                             ("icon-maskable.png", 512, True), ("apple-touch-icon.png", 180, False)]:
        p = os.path.join(OUT, name)
        icon(size, mask).save(p, "PNG", optimize=True)
        made.append((name, os.path.getsize(p)))
    p = os.path.join(OUT, "og.png")
    og().save(p, "PNG", optimize=True)
    made.append(("og.png", os.path.getsize(p)))

    for n, sz in made:
        print(f"  ✓ images/{n:22s} {sz/1024:6.0f}KB")


if __name__ == "__main__":
    main()
