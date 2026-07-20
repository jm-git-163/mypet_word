# -*- coding: utf-8 -*-
"""
make_dog_gif.py — 움직이는 강아지 GIF 만들기

앱 안에서는 SVG 강아지가 움직입니다(가볍고 표정이 바뀝니다).
이 도구는 '같은 그림'을 GIF 로도 뽑아 줍니다.
  · 홍보물, 스토어 소개 그림, 메신저 공유 등 GIF 가 필요한 곳에 씁니다.
  · 앱의 축하 화면처럼 표정이 바뀌지 않는 자리에도 쓸 수 있습니다.

쓰는 법
    python tools/make_dog_gif.py
결과
    images/dog/idle.gif      숨쉬고 꼬리 흔들고 눈 깜빡임
    images/dog/happy.gif     신나서 꼬리를 빠르게
    images/dog/jump.gif      폴짝폴짝 뛰기
    images/dog/tilt.gif      고개 갸웃

※ 파이썬 Pillow 가 필요합니다.  pip install pillow
"""
import os, sys, math

# 윈도우 콘솔이 한글·기호를 못 찍는 일을 막습니다
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

try:
    from PIL import Image, ImageDraw
except Exception:
    print("Pillow 가 없습니다.  pip install pillow"); sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "images", "dog")

S = 4                      # 4배로 그린 뒤 줄여서 매끄럽게 만듭니다
W = H = 200
FUR = (250, 243, 235)
FUR_EDGE = (226, 205, 184)
DARK = (58, 36, 24)
CHEEK = (255, 197, 208)
WHITE = (255, 255, 255)


def E(d, cx, cy, rx, ry, fill, outline=None, w=3):
    """가운데와 반지름으로 타원 그리기 (SVG 와 같은 방식)"""
    box = [(cx - rx) * S, (cy - ry) * S, (cx + rx) * S, (cy + ry) * S]
    d.ellipse(box, fill=fill, outline=outline, width=int(w * S))


def draw_dog(t, mood):
    """t: 0~1 한 바퀴 위치, mood: idle|happy|jump|tilt"""
    img = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 몸 전체 움직임
    breathe = math.sin(t * 2 * math.pi) * 0.02
    dy = 0.0
    squash = 1.0
    if mood == "jump":
        # 한 바퀴에 두 번 뜁니다
        p = (t * 2) % 1.0
        dy = -38 * math.sin(p * math.pi) ** 0.85
        squash = 1.0 + 0.10 * math.sin(p * math.pi) - (0.12 if p < 0.10 or p > 0.92 else 0)
    body_y = dy

    # ── 그림자 (뛰면 작아집니다) ──
    sh = 1.0 - min(0.55, abs(dy) / 60.0)
    E(d, 100, 186, 46 * sh, 7 * sh, (45, 21, 13, 34))

    # ── 꼬리 ── (좌우로 흔들림)
    speed = {"idle": 1, "happy": 3, "jump": 4, "tilt": 1}[mood]
    ang = math.sin(t * 2 * math.pi * speed) * (22 if mood != "idle" else 16)
    tail = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    td = ImageDraw.Draw(tail)
    E(td, 158, 128, 12, 20, FUR, FUR_EDGE, 2.5)
    tail = tail.rotate(-ang, center=(150 * S, 152 * S), resample=Image.BICUBIC)
    img.alpha_composite(tail)

    # ── 몸통 ──
    E(d, 100, 150 + body_y, 46, 34 * (1 + breathe) * squash, FUR, FUR_EDGE, 2.5)
    # 앞발
    E(d, 80, 176 + body_y * 0.4, 13, 9, FUR, FUR_EDGE, 2.5)
    E(d, 120, 176 + body_y * 0.4, 13, 9, FUR, FUR_EDGE, 2.5)

    # ── 머리 (갸웃이면 기울입니다) ──
    head = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    hd = ImageDraw.Draw(head)
    hy = 98 + body_y

    ear_sway = math.sin(t * 2 * math.pi * speed) * (7 if mood != "idle" else 4)
    # 귀
    E(hd, 55, hy + 6 + ear_sway * 0.4, 17, 30, FUR, FUR_EDGE, 2.5)
    E(hd, 145, hy + 6 - ear_sway * 0.4, 17, 30, FUR, FUR_EDGE, 2.5)
    # 머리
    E(hd, 100, hy, 52, 52, FUR, FUR_EDGE, 2.5)

    # 눈 — 깜빡임 (한 바퀴에 한 번, 아주 잠깐)
    blink = 1.0
    if mood in ("idle", "tilt") and 0.86 < t < 0.92:
        blink = 0.12
    if mood in ("happy", "jump"):
        # 눈웃음
        for cx in (83, 117):
            hd.arc([(cx - 11) * S, (hy - 6) * S, (cx + 11) * S, (hy + 12) * S],
                   start=200, end=340, fill=DARK, width=int(3.4 * S))
    else:
        for cx in (83, 117):
            E(hd, cx, hy - 1, 9.5, 10.5 * blink, DARK)
            if blink > 0.5:
                E(hd, cx + 3, hy - 5, 3.2, 3.2, WHITE)
                E(hd, cx - 3, hy + 3, 1.6, 1.6, (255, 255, 255, 190))

    # 코
    E(hd, 100, hy + 12, 8, 6, DARK)
    E(hd, 97, hy + 10, 2.5, 1.8, (255, 255, 255, 150))
    # 입
    if mood in ("happy", "jump"):
        E(hd, 100, hy + 28, 11, 9, (194, 86, 106))
        E(hd, 100, hy + 33, 7, 5, (240, 140, 160))
    else:
        hd.arc([92 * S, (hy + 16) * S, 108 * S, (hy + 28) * S],
               start=0, end=180, fill=DARK, width=int(3.2 * S))
        hd.line([100 * S, (hy + 15) * S, 100 * S, (hy + 20) * S], fill=DARK, width=int(3.2 * S))
    # 볼
    E(hd, 64, hy + 14, 9, 6, CHEEK + (150,))
    E(hd, 136, hy + 14, 9, 6, CHEEK + (150,))

    if mood == "tilt":
        a = math.sin(t * 2 * math.pi) * 13
        head = head.rotate(a, center=(100 * S, 130 * S), resample=Image.BICUBIC)
    img.alpha_composite(head)

    return img.resize((W, H), Image.LANCZOS)


def build(mood, frames, ms):
    imgs = [draw_dog(i / frames, mood) for i in range(frames)]
    # GIF 는 반투명을 못 다루므로 완전투명/불투명으로만 나눕니다
    out = []
    for im in imgs:
        p = im.convert("RGBA")
        bg = Image.new("RGBA", p.size, (255, 255, 255, 0))
        bg.alpha_composite(p)
        q = bg.convert("P", palette=Image.ADAPTIVE, colors=255)
        alpha = bg.split()[3]
        mask = alpha.point(lambda a: 255 if a <= 128 else 0)
        q.paste(255, mask)
        out.append(q)
    path = os.path.join(OUT, mood + ".gif")
    out[0].save(path, save_all=True, append_images=out[1:], duration=ms,
                loop=0, transparency=255, disposal=2, optimize=True)
    return path, os.path.getsize(path)


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [("idle", 30, 70), ("happy", 20, 55), ("jump", 24, 55), ("tilt", 26, 70)]
    total = 0
    for mood, n, ms in jobs:
        path, size = build(mood, n, ms)
        total += size
        print(f"  ✓ {mood:6s} {n:2d}컷 → images/dog/{mood}.gif  ({size/1024:.0f}KB)")
    print(f"\n✅ 모두 {total/1024:.0f}KB")


if __name__ == "__main__":
    main()
