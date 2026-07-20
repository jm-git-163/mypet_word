/* ============================================================
   import-bgm.js — 배경음 파일 들여오기

   내려받은 mp3 를 앱에 넣습니다. 그냥 복사하지 않고 다시 눌러 담습니다.

   왜 다시 담나
     픽사베이에서 받은 파일은 256kbps 스테레오라 한 곡에 4MB 가 넘습니다.
     열일곱 곡이면 66MB 인데, 그대로 넣으면
       · 어머니 휴대전화에 66MB 가 쌓이고
       · 앱을 처음 열 때 한참 기다려야 합니다.
     배경음은 말소리를 덮지 않게 아주 작게 깔리는 소리라
     96kbps 한 갈래(모노)면 휴대전화 스피커에서 차이를 못 느낍니다.

   ※ 픽사베이 API 는 음악을 주지 않습니다(이미지·영상만).
     음악은 https://pixabay.com/music/ 에서 직접 받아 주세요.
     유튜브 오디오 보관함(studio.youtube.com)도 좋습니다.

   쓰는 법
       node tools/import-bgm.js "C:/Users/user/Downloads"
       node tools/import-bgm.js "경로" --dry        (얼마나 줄어드는지만 보기)
       node tools/import-bgm.js "경로" --kbps 128   (음질 올리기)

   ※ ffmpeg 가 있어야 합니다.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.dirname(__dirname);
const OUT = path.join(ROOT, 'audio', 'bgm');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const kbpsIdx = args.indexOf('--kbps');
const KBPS = kbpsIdx >= 0 && args[kbpsIdx + 1] ? Number(args[kbpsIdx + 1]) : 96;
const SRC = args.filter(a => !a.startsWith('--'))
  .filter(a => a !== String(KBPS))[0];

if (!SRC) {
  console.error('\n쓰는 법:  node tools/import-bgm.js "mp3 가 있는 폴더" [--dry] [--kbps 96]\n');
  process.exit(1);
}
if (!fs.existsSync(SRC)) {
  console.error(`\n폴더를 찾지 못했습니다: ${SRC}\n`);
  process.exit(1);
}

try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); }
catch (e) { console.error('\n❌ ffmpeg 를 찾지 못했습니다.  https://ffmpeg.org\n'); process.exit(1); }

/** 파일 이름을 앱에서 쓰기 좋게 다듬습니다 */
function tidy(name) {
  return name
    .replace(/\.mp3$/i, '')
    .replace(/-\d{5,}$/, '')          // 픽사베이가 붙이는 일련번호 떼기
    .replace(/[^a-z0-9-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() + '.mp3';
}

const files = fs.readdirSync(SRC).filter(f => /\.mp3$/i.test(f)).sort();
if (!files.length) { console.log('mp3 파일이 없습니다.'); process.exit(0); }

fs.mkdirSync(OUT, { recursive: true });
console.log(`\n${files.length}개 발견 · ${KBPS}kbps 모노로 다시 담습니다\n`);

let before = 0, after = 0, done = 0, failed = 0;
const made = [];

files.forEach(f => {
  const src = path.join(SRC, f);
  const name = tidy(f);
  const dst = path.join(OUT, name);
  const sz = fs.statSync(src).size;
  before += sz;

  if (DRY) { after += Math.round(sz * (KBPS / 256) * 0.55); made.push(name); return; }

  try {
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', src,
      '-ac', '1',                      // 한 갈래 — 배경음이라 좌우가 필요 없습니다
      '-ar', '44100',
      '-b:a', KBPS + 'k',
      '-map_metadata', '-1',           // 군더더기 정보 지우기
      dst
    ], { stdio: 'ignore' });
    after += fs.statSync(dst).size; done++; made.push(name);
    process.stdout.write(`\r  담는 중… ${done}/${files.length}   `);
  } catch (e) {
    failed++;
    console.log(`\n  ⚠ ${f} 를 담지 못했습니다`);
  }
});

if (!DRY) {
  // 앱이 읽을 목록
  fs.writeFileSync(path.join(OUT, 'index.json'),
    JSON.stringify({ files: made.slice().sort() }, null, 1));
}

const mb = n => (n / 1048576).toFixed(1) + 'MB';
console.log(`\n\n${DRY ? '── 미리보기 ──' : '✅ 끝났습니다'}`);
console.log(`   ${made.length}곡 · ${mb(before)} → ${mb(after)}  (${Math.round((1 - after / before) * 100)}% 줄었습니다)`);
console.log(`   한 곡에 평균 ${(after / made.length / 1048576).toFixed(2)}MB`);
if (failed) console.log(`   ⚠ ${failed}개 실패`);
if (DRY) console.log('\n   실제로 담으려면 --dry 를 빼고 다시 실행하세요.');
else console.log('\n   audio/bgm/ 에 넣었습니다. 설정에서 「배경음 켜기」를 켜면 나옵니다.');
