/* ============================================================
   shrink-images.js — 배경 그림을 앱에 알맞게 줄입니다

   받아 온 사진은 화면에 쓰기엔 지나치게 큽니다.
   어르신 휴대전화는 저장 공간과 데이터가 넉넉하지 않은 경우가 많아,
   가로 720px 로 줄이고 살짝 흐리게 만들어 용량을 크게 줄입니다.
   (흐리게 하면 낱말 칸이 더 또렷하게 보이는 효과도 있습니다.)

   쓰는 법:  node tools/shrink-images.js
   ※ 파이썬의 Pillow 를 씁니다. 없으면 건너뜁니다.
   ============================================================ */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const env = require('./env');

const DIR = path.join(env.ROOT, 'images', 'bg');

const PY = `
import os, sys, glob
try:
    from PIL import Image, ImageFilter
except Exception:
    print("NOPIL"); sys.exit(0)

d = sys.argv[1]
before = after = 0
for f in sorted(glob.glob(os.path.join(d, "*.jpg"))):
    before += os.path.getsize(f)
    im = Image.open(f).convert("RGB")
    w, h = im.size
    tw = 720
    if w > tw:
        im = im.resize((tw, int(h * tw / w)), Image.LANCZOS)
    # 살짝 흐리게 — 배경으로 물러나게 하고 글자 칸을 돋보이게 합니다
    im = im.filter(ImageFilter.GaussianBlur(1.6))
    im.save(f, "JPEG", quality=72, optimize=True, progressive=True)
    after += os.path.getsize(f)
print(f"OK {before} {after}")
`;

function main() {
  if (!fs.existsSync(DIR)) {
    console.log('images/bg 폴더가 없습니다. 먼저 node tools/build-images.js 를 실행하세요.');
    return;
  }
  const tmp = path.join(env.ROOT, 'tools', '_shrink.py');
  fs.writeFileSync(tmp, PY, 'utf8');
  try {
    const out = execFileSync('python', [tmp, DIR], { encoding: 'utf8' }).trim();
    if (out.startsWith('NOPIL')) {
      console.log('⚠ 파이썬 Pillow 가 없어 줄이지 못했습니다.  pip install pillow');
      return;
    }
    const [, b, a] = out.split(/\s+/);
    console.log(`✅ 배경 그림을 줄였습니다.`);
    console.log(`   ${(b / 1048576).toFixed(1)}MB → ${(a / 1048576).toFixed(1)}MB  (${(100 - a / b * 100).toFixed(0)}% 절약)`);
  } catch (e) {
    console.log('⚠ 줄이기 실패: ' + e.message.split('\n')[0]);
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) { }
  }
}

main();
