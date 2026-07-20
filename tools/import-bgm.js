/* ============================================================
   import-bgm.js — 직접 받아 두신 배경음악을 앱에 등록합니다

   ※ 픽사베이 API 는 음악을 주지 않습니다(이미지·영상만 지원).
     그래서 음악은 픽사베이 누리집에서 직접 내려받아 넣어 주셔야 합니다.

   쓰는 법
     1) https://pixabay.com/music/  에서 마음에 드는 곡을 내려받습니다.
        · 검색어 추천: calm piano, gentle acoustic, korean traditional,
                      relaxing ambient, meditation, spring
        · 어르신용이니 드럼이 세거나 빠른 곡은 피해 주세요.
     2) 받은 mp3 파일을  audio/bgm/  폴더에 넣습니다.
     3) 이 도구를 실행합니다.
          node tools/import-bgm.js
     4) 앱 설정에서 「배경음 켜기」를 켜면 그 곡들이 흘러나옵니다.

   ※ 파일을 하나도 넣지 않으셔도 됩니다.
     그때는 앱이 잔잔한 소리를 스스로 만들어 냅니다(js/bgm.js).
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const env = require('./env');

const DIR = path.join(env.ROOT, 'audio', 'bgm');

function main() {
  if (!fs.existsSync(DIR)) {
    fs.mkdirSync(DIR, { recursive: true });
    console.log(`\n폴더를 만들었습니다: audio/bgm/`);
    console.log('여기에 mp3 파일을 넣고 다시 실행해 주세요.\n');
    console.log('  https://pixabay.com/music/  (검색어: calm piano, gentle acoustic …)\n');
    return;
  }

  const files = fs.readdirSync(DIR)
    .filter(f => /\.(mp3|m4a|ogg|wav)$/i.test(f))
    .sort();

  if (!files.length) {
    console.log('\naudio/bgm/ 폴더가 비어 있습니다.');
    console.log('mp3 파일을 넣고 다시 실행해 주세요.');
    console.log('(넣지 않으셔도 앱이 잔잔한 소리를 스스로 만들어 냅니다.)\n');
    fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify({ files: [] }, null, 1));
    return;
  }

  let total = 0;
  files.forEach(f => {
    const size = fs.statSync(path.join(DIR, f)).size;
    total += size;
    console.log(`  ✓ ${f}  (${(size / 1048576).toFixed(1)}MB)`);
  });

  fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify({ files }, null, 1));

  console.log(`\n✅ 배경음 ${files.length}곡을 등록했습니다. (모두 ${(total / 1048576).toFixed(1)}MB)`);
  if (total > 15 * 1048576) {
    console.log('⚠ 용량이 큽니다. 어르신 휴대전화는 저장 공간이 넉넉하지 않은 경우가 많습니다.');
    console.log('  3~5분짜리 두세 곡이면 충분합니다.');
  }
  console.log('   앱 설정 → 소리 → 「배경음 켜기」를 켜 보세요.\n');

  // 서비스 워커가 음악 파일도 챙기도록 목록을 알려 줍니다
  console.log('※ 오프라인에서도 들으시려면 sw.js 의 FILES 목록에 아래를 더해 주세요:');
  files.forEach(f => console.log(`     './audio/bgm/${f}',`));
}

main();
