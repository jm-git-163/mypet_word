/* ============================================================
   build-images.js — 풍경 사진 받아오기 (픽사베이)

   ※ 픽사베이 API 는 '이미지와 영상'만 지원합니다(음악 없음).

   앱의 풍경은 레벨 번호로 그려 냅니다(js/scene.js). 사진은 그 위가 아니라
   '뒤'에 아주 옅게 깔려 결을 더하는 역할입니다.
   그래서 계절(4) × 때(5) = 스무 갈래로 나누어 받고,
   앱은 그 단계의 계절·때에 맞는 사진만 씁니다. 그래야 톤이 어긋나지 않습니다.

   쓰는 법
     node tools/build-images.js            # 갈래마다 두 장씩 (모두 40장)
     node tools/build-images.js --dry      # 무엇을 받을지만 보기
     node tools/build-images.js --per 3    # 갈래마다 세 장씩
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const env = require('./env');

const OUT = path.join(env.ROOT, 'images', 'bg');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const PER = Number((args[args.indexOf('--per') + 1]) || 2) || 2;

/* 계절 × 때 — js/scene.js 의 SEASONS · TIMES 와 이름을 맞춥니다 */
const SEASONS = [
  { key: 'spring', name: '봄', q: 'spring blossom' },
  { key: 'summer', name: '여름', q: 'summer green forest' },
  { key: 'autumn', name: '가을', q: 'autumn foliage' },
  { key: 'winter', name: '겨울', q: 'winter snow landscape' }
];
const TIMES = [
  { key: 'dawn', name: '새벽', q: 'misty dawn' },
  { key: 'morning', name: '아침', q: 'morning light' },
  { key: 'noon', name: '한낮', q: 'bright daylight' },
  { key: 'dusk', name: '해질녘', q: 'golden hour sunset' },
  { key: 'night', name: '밤', q: 'night sky moon' }
];

/* 사람이 크게 나온 사진은 배경으로 알맞지 않습니다(시선을 뺏습니다) */
const NO_PEOPLE = /\b(girl|boy|kid|kids|child|children|woman|man|men|women|people|person|portrait|face|couple|family|baby|model|hand|hands|wedding|party)\b/i;

async function search(key, q, want) {
  const url = new URL('https://pixabay.com/api/');
  url.searchParams.set('key', key);
  url.searchParams.set('q', q);
  url.searchParams.set('image_type', 'photo');
  url.searchParams.set('orientation', 'vertical');
  url.searchParams.set('safesearch', 'true');
  url.searchParams.set('order', 'popular');
  url.searchParams.set('per_page', '40');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => '')).slice(0, 140)}`);
  const j = await res.json();
  const hits = (j.hits || []).filter(h => !NO_PEOPLE.test(h.tags || ''));
  return hits.slice(0, want);
}

async function main() {
  const key = env.require('PIXABAY_API_KEY', 'https://pixabay.com/api/docs/');
  console.log(`픽사베이 열쇠 ${env.mask(key)}\n`);
  if (!DRY) fs.mkdirSync(OUT, { recursive: true });

  const credits = [];
  const index = {};
  let made = 0, failed = 0;

  for (const s of SEASONS) {
    for (const t of TIMES) {
      const q = `${s.q} ${t.q}`;
      const slot = `${s.key}-${t.key}`;
      try {
        const hits = await search(key, q, PER);
        if (!hits.length) { console.log(`  ⚠ ${s.name} ${t.name}: 어울리는 사진 없음`); failed++; continue; }
        index[slot] = [];
        for (let i = 0; i < hits.length; i++) {
          const hit = hits[i];
          const file = `${slot}-${i + 1}.jpg`;
          if (!DRY) {
            const img = await fetch(hit.largeImageURL || hit.webformatURL);
            if (!img.ok) throw new Error('내려받기 실패 ' + img.status);
            fs.writeFileSync(path.join(OUT, file), Buffer.from(await img.arrayBuffer()));
            made++;
          }
          index[slot].push(file);
          credits.push({ file, slot, author: hit.user, page: hit.pageURL });
        }
        console.log(`  ✓ ${s.name} ${t.name.padEnd(4)} → ${index[slot].join(', ')}`);
        await new Promise(r => setTimeout(r, 250));
      } catch (e) {
        failed++;
        console.log(`  ⚠ ${s.name} ${t.name}: ${e.message}`);
        if (/^(400|401|403)/.test(e.message)) { console.log('  열쇠가 올바르지 않습니다. 중단합니다.'); return; }
      }
    }
  }

  if (!DRY) {
    fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ per: PER, slots: index }, null, 1));
    fs.writeFileSync(path.join(OUT, 'credits.json'), JSON.stringify({ source: 'Pixabay', items: credits }, null, 1));
    console.log(`\n✅ 받은 사진 ${made}장 · 실패 ${failed} → images/bg/`);
    console.log('   이어서 용량을 줄이세요:  node tools/shrink-images.js');
  } else {
    console.log('\n(시험 보기였습니다. 실제로 받으려면 --dry 를 빼세요.)');
  }
}

main().catch(e => { console.error('\n❌ ' + e.message); process.exit(1); });
