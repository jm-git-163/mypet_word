/* ============================================================
   set-domain.js — 사이트 주소를 한 번에 바꾸기

   애드센스는 '내가 소유한 도메인' 을 요구합니다.
   vercel.app 은 Vercel 소유라 심사에서 걸러집니다.
   도메인을 사신 뒤 이 도구로 주소를 한꺼번에 갈아 끼우세요.

   쓰는 법
       node tools/set-domain.js nanmal.co.kr
       node tools/set-domain.js nanmal.co.kr --dry     (바꾸지 않고 보기만)

   바뀌는 곳
       canonical · og:url · og:image · sitemap.xml · robots.txt
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const raw = args.find(a => !a.startsWith('--'));

if (!raw) {
  console.error('\n쓰는 법:  node tools/set-domain.js 새주소.com  [--dry]\n');
  process.exit(1);
}

// https:// 나 끝의 / 를 붙여 오셔도 알아서 다듬습니다
const host = raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) {
  console.error(`\n주소가 이상합니다: ${host}\n예)  nanmal.co.kr  ·  www.nanmal.com\n`);
  process.exit(1);
}
const NEW = 'https://' + host;

/** 지금 파일에 적혀 있는 주소를 찾아냅니다 */
function currentBase() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/<link rel="canonical" href="(https?:\/\/[^/"]+)/);
  return m ? m[1] : null;
}

const OLD = currentBase();
if (!OLD) { console.error('\nindex.html 에서 지금 주소를 찾지 못했습니다.\n'); process.exit(1); }
if (OLD === NEW) { console.log(`\n이미 ${NEW} 입니다. 바꿀 것이 없습니다.\n`); process.exit(0); }

/** 손볼 파일 모으기 */
function collect(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'images') return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collect(p, out);
    else if (/\.(html|xml|txt|json|webmanifest)$/i.test(e.name)) out.push(p);
  });
  return out;
}

const files = collect(ROOT, []);
let changed = 0, hits = 0;

files.forEach(p => {
  const before = fs.readFileSync(p, 'utf8');
  if (!before.includes(OLD)) return;
  const n = before.split(OLD).length - 1;
  hits += n; changed++;
  const rel = path.relative(ROOT, p).replace(/\\/g, '/');
  console.log(`  ${DRY ? '·' : '✓'} ${rel.padEnd(34)} ${n}곳`);
  if (!DRY) fs.writeFileSync(p, before.split(OLD).join(NEW));
});

console.log(`\n${DRY ? '── 미리보기 ──' : '✅ 끝났습니다'}`);
console.log(`   ${OLD}  →  ${NEW}`);
console.log(`   파일 ${changed}개 · ${hits}곳`);
if (DRY) console.log('\n   실제로 바꾸려면 --dry 를 빼고 다시 실행하세요.');
else console.log('\n   이제 커밋·푸시하고 배포하시면 됩니다.');
