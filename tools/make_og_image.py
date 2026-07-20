# -*- coding: utf-8 -*-
"""
make_og_image.py — 카톡·문자로 보낼 때 뜨는 썸네일 그림 만들기

카카오톡은 링크를 보내면 og:image 에 적힌 그림을 카드로 보여 줍니다.
  · SVG 는 쓸 수 없습니다. PNG/JPG 여야 합니다.
  · 1200×630 이 표준입니다(카톡은 가운데를 잘라 씁니다).
  · 그래서 중요한 것(강아지·글자)은 가운데에 몰아 둡니다.

쓰는 법
    python tools/make_og_image.py
결과
    images/og.png       카톡·페이스북·문자 미리보기용 (1200×630)

※ 파이썬 Pillow 가 필요합니다.  pip install pillow
"""
import os, sys, math

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

try:
    from PIL import Image, ImageDraw, ImageFont
except Exception:
    print("Pillow 가 없습니다.  pip install pillow"); sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "images")

W, H = 1200, 630
S = 2                       # 두 배로 그린 뒤 줄여 매끄럽게

# 앱의 빛깔을 그대로 씁니다 (css/style.css 와 같은 값)
BG_TOP = (255, 240, 224)
BG_BOT = (250, 247, 244)
FUR = (250, 243, 235)
FUR_EDGE = (226, 205, 184)
DARK = (41, 33, 27)
CHEEK = (246, 185, 196)
AMBER = (239, 143, 34)
BROWN = (154, 82, 0)
MUTED = (91, 78, 68)

FONT_BD = "C:/Windows/Fonts/malgunbd.ttf"
FONT_RG = "C:/Windows/Fonts/malgun.ttf"


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def E(d, cx, cy, rx, ry, fill, outline=None, w=3):
    d.ellipse([(cx - rx) * S, (cy - ry) * S, (cx + rx) * S, (cy + ry) * S],
              fill=fill, outline=outline, width=int(w * S))


def draw_dog(img, cx, cy, scale):
    """앱의 SVG 강아지와 같은 비율로 그립니다"""
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)

    def p(x, y):
        return (cx + (x - 100) * scale, cy + (y - 100) * scale)

    def ell(x, y, rx, ry, fill, outline=None, w=2.5):
        px, py = p(x, y)
        E(d, px, py, rx * scale, ry * scale, fill, outline, w * scale)

    # 그림자
    ell(100, 186, 46, 7, (45, 21, 13, 30))
    # 꼬리
    ell(158, 128, 12, 20, FUR, FUR_EDGE)
    # 몸통
    ell(100, 150, 46, 34, FUR, FUR_EDGE)
    # 앞발
    ell(80, 176, 13, 9, FUR, FUR_EDGE)
    ell(120, 176, 13, 9, FUR, FUR_EDGE)
    # 귀
    ell(55, 104, 17, 30, FUR, FUR_EDGE)
    ell(145, 104, 17, 30, FUR, FUR_EDGE)
    # 머리
    ell(100, 98, 52, 52, FUR, FUR_EDGE)
    # 눈웃음 (반가운 표정)
    for ex in (83, 117):
        x1, y1 = p(ex - 11, 92)
        x2, y2 = p(ex + 11, 110)
        d.arc([x1 * S, y1 * S, x2 * S, y2 * S], start=200, end=340,
              fill=DARK, width=int(3.4 * scale * S))
    # 코
    ell(100, 110, 8, 6, DARK)
    ell(97, 108, 2.5, 1.8, (255, 255, 255, 150))
    # 벌린 입
    ell(100, 126, 11, 9, (194, 86, 106))
    ell(100, 131, 7, 5, (240, 140, 160))
    # 볼
    ell(64, 112, 9, 6, CHEEK + (160,))
    ell(136, 112, 9, 6, CHEEK + (160,))

    img.alpha_composite(lay)


def main():
    os.makedirs(OUT, exist_ok=True)
    img = Image.new("RGBA", (W * S, H * S), BG_BOT + (255,))
    d = ImageDraw.Draw(img)

    # 위에서 아래로 옅어지는 바탕
    for y in range(H * S):
        t = y / (H * S)
        t = t ** 0.7
        c = tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t) for i in range(3))
        d.line([(0, y), (W * S, y)], fill=c)

    # 흩날리는 꽃잎 (앱과 같은 분위기)
    import random
    random.seed(7)
    for _ in range(26):
        x = random.uniform(0, W)
        y = random.uniform(0, H)
        r = random.uniform(5, 13)
        a = random.randint(40, 105)
        E(d, x, y, r, r * 0.72, CHEEK + (a,))

    # 강아지 — 왼쪽에 크게
    draw_dog(img, 305, 322, 1.5)     # 좌표는 S 를 곱하지 않은 값으로 (E 가 곱합니다)

    # 글자 — 오른쪽
    f_title = font(FONT_BD, 96 * S)
    f_sub = font(FONT_RG, 40 * S)
    f_tag = font(FONT_BD, 34 * S)

    tx = 560 * S
    d.text((tx, 218 * S), "낱말 산책", font=f_title, fill=DARK)
    d.text((tx, 340 * S), "매일 함께 걷는", font=f_sub, fill=MUTED)
    d.text((tx, 392 * S), "한국어 낱말 퍼즐", font=f_sub, fill=MUTED)

    # 감빛 딱지
    tag = "무료 · 광고 없음"
    bbox = d.textbbox((0, 0), tag, font=f_tag)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad_x, pad_y = 26 * S, 14 * S
    bx, by = tx, 470 * S
    box_h = th + pad_y * 2
    d.rounded_rectangle([bx, by, bx + tw + pad_x * 2, by + box_h],
                        radius=int(box_h / 2), fill=AMBER)
    d.text((bx + pad_x, by + pad_y - 4 * S), tag, font=f_tag, fill=(61, 31, 0))

    out = img.convert("RGB").resize((W, H), Image.LANCZOS)
    path = os.path.join(OUT, "og.png")
    out.save(path, "PNG", optimize=True)
    print(f"  ✓ images/og.png  {W}×{H}  ({os.path.getsize(path)/1024:.0f}KB)")


if __name__ == "__main__":
    main()
