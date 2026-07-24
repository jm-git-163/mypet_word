# -*- coding: utf-8 -*-
"""rembg 로 3D 갈매기 포즈를 깨끗하게 잘라냅니다."""
from rembg import remove
from PIL import Image, ImageEnhance, ImageDraw, ImageFilter
import os

SHEET = r"C:\Users\user\.cursor\projects\c-Users-user-Desktop\assets\c__Users_user_AppData_Roaming_Cursor_User_workspaceStorage_ee02ce764893aadd8c07fd7da609fa44_images_ChatGPT_Image_2026__7__24_____11_38_46-ee5d7b1d-7f2e-4048-98f2-2c1971a03332.png"
HAPPY = r"C:\Users\user\.cursor\projects\c-Users-user-Desktop\assets\c__Users_user_AppData_Roaming_Cursor_User_workspaceStorage_ee02ce764893aadd8c07fd7da609fa44_images_ChatGPT_Image_2026__7__24_____11_39_01-48a7a373-59c4-4c16-a5c1-e346751280eb.png"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "images", "gull")
os.makedirs(OUT, exist_ok=True)


def trim_alpha(im, pad=10):
    bbox = im.split()[-1].getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad),
                    min(im.width, r + pad), min(im.height, b + pad)))


def square_pad(im, size=512, pad_ratio=0.06):
    im = trim_alpha(im)
    w, h = im.size
    side = int(max(w, h) * (1 + pad_ratio * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2), im)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def cutout(im):
    return remove(im.convert("RGBA"))


def save_preview(im, path):
    bg = Image.new("RGBA", im.size, (186, 214, 200, 255))
    bg.alpha_composite(im)
    bg.convert("RGB").save(path, quality=92)


def obscure_brand(im):
    """새우깡 상표 글자를 가립니다 — 주황 봉지에 간단한 새우 실루엣만."""
    # 왼쪽 봉지 영역 대략 덮기 (512 기준, 포즈마다 다를 수 있어 알파로 찾기)
    px = im.load()
    w, h = im.size
    # 주황 봉지 픽셀 중 왼쪽 절반에서 글자(검정)만 주황으로 메움
    for y in range(h):
        for x in range(w // 2):
            r, g, b, a = px[x, y]
            if a < 40:
                continue
            # 검정/진한 글자·흰 글자 영역
            light = (r + g + b) / 3
            warm = r > 180 and g > 80 and b < 120 and r > g
            dark_on_bag = light < 90 and r < 100
            white_on_bag = light > 220 and abs(r - g) < 20
            # 주변에 주황이 있으면 글자로 보고 메움
            if dark_on_bag or white_on_bag:
                # 이웃에 주황 있는지
                neighbors = []
                for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2), (-4, 0), (4, 0)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        neighbors.append(px[nx, ny])
                if any(n[3] > 40 and n[0] > 180 and n[1] > 90 and n[2] < 130 for n in neighbors):
                    px[x, y] = (242, 140, 48, a)
    return im


sheet = Image.open(SHEET).convert("RGBA")
W, H = sheet.size
mx, my = int(W * 0.01), int(H * 0.012)
cw, ch = (W - mx * 2) // 2, (H - my * 2) // 2
inset = int(min(cw, ch) * 0.02)
cells = {
    "eat": (mx + inset, my + inset, mx + cw - inset, my + ch - inset),
    "stand": (mx + cw + inset, my + inset, mx + 2 * cw - inset, my + ch - inset),
    "cheer": (mx + inset, my + ch + inset, mx + cw - inset, my + 2 * ch - inset),
    "run": (mx + cw + inset, my + ch + inset, mx + 2 * cw - inset, my + 2 * ch - inset),
}

print("rembg 모델 첫 실행은 내려받느라 조금 걸릴 수 있습니다…")
for name, box in cells.items():
    crop = sheet.crop(box)
    cut = cutout(crop)
    if name == "eat":
        cut = obscure_brand(cut)
    sq = square_pad(cut, 512)
    sq.save(os.path.join(OUT, f"{name}.png"), optimize=True)
    save_preview(sq, os.path.join(OUT, f"_preview_{name}.jpg"))
    print("saved", name)

happy = square_pad(cutout(Image.open(HAPPY).convert("RGBA")), 512)
happy.save(os.path.join(OUT, "happy.png"), optimize=True)
save_preview(happy, os.path.join(OUT, "_preview_happy.jpg"))
print("saved happy")

miss = ImageEnhance.Color(happy).enhance(0.78)
miss = ImageEnhance.Brightness(miss).enhance(0.94)
miss.save(os.path.join(OUT, "miss.png"), optimize=True)
save_preview(miss, os.path.join(OUT, "_preview_miss.jpg"))

sleep = happy.copy()
sp = sleep.load()
for y in range(sleep.height):
    for x in range(sleep.width):
        r, g, b, a = sp[x, y]
        if a > 20:
            sp[x, y] = (int(r * 0.93 + 16), int(g * 0.95 + 14), int(b * 0.99 + 24), a)
sleep.save(os.path.join(OUT, "sleep.png"), optimize=True)
save_preview(sleep, os.path.join(OUT, "_preview_sleep.jpg"))
print("done")
