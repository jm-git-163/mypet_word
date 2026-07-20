/* 자동 검사 — TECH_SPEC §6.9 생성기 시뮬레이션 / §15 품질 게이트
   실행: node test/selftest.js  */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');

// 브라우저 흉내
const sandbox = { window: {}, console, Date, Math, JSON, localStorage: null, setTimeout, document: undefined };
sandbox.window = sandbox;
vm.createContext(sandbox);
['js/hangul.js', 'js/data.js', 'js/data2.js', 'js/data3.js', 'js/data4.js', 'js/data5.js', 'js/data6.js', 'js/data7.js', 'js/crossword.js', 'js/engine.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f }));

const H = sandbox.Hangul, E = sandbox.Engine, DB = E.DB.build();
let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + msg); } };
const head = t => console.log('\n■ ' + t);

/* 1. 한글 엔진 — 전수 검증 */
head('한글 엔진 (음절 11,172자 전수)');
let roundtrip = 0;
for (let c = 0xac00; c <= 0xd7a3; c++) {
  const ch = String.fromCharCode(c);
  const { lead, vowel, tail } = H.decomposeIndex(ch);
  if (H.compose(lead, vowel, tail) === ch) roundtrip++;
}
ok(roundtrip === 11172, `분해→조합 왕복 실패 (${roundtrip}/11172)`);
ok(H.choseong('온고지신') === 'ㅇㄱㅈㅅ', '초성 추출');
ok(H.choseong('사자성어') === 'ㅅㅈㅅㅇ', '초성 추출 2');
ok(H.particle('사과', '을', '를') === '를', '조사: 받침 없음');
ok(H.particle('온고지신', '을', '를') === '을', '조사: 받침 있음');
ok(H.particle('서울', '으로', '로') === '로', "조사: ㄹ받침 '로' 예외");
ok(H.syllableBagKey('온고지신') === H.syllableBagKey('신지고온'), '음절 집합 키');
ok(H.isSubsetOfBag('고지', ['온', '고', '지', '신']), '부분집합 판정');
ok(!H.isSubsetOfBag('고고', ['온', '고', '지', '신']), '중복 음절 부분집합 거부');

/* 2. 낱말 꾸러미 규정 검사 (§3.7) */
head(`낱말 꾸러미 (${DB.entries.length}개)`);
ok(DB.entries.length >= 350, `엔트리 수 부족: ${DB.entries.length}`);
let badMeaning = 0, badHangul = 0, badHint = 0, dup = 0, noHint = 0;
const seen = new Set();
for (const e of DB.entries) {
  // 뜻풀이가 없는 낱말(판 채우기용)은 길이를 보지 않습니다
  if (e.meaning && (e.meaning.length < 10 || e.meaning.length > 70)) badMeaning++;
  if (!e.meaning.endsWith('다.') && !e.meaning.endsWith('니다.')) { /* 해요체/입니다체 허용 */ }
  for (const ch of e.surface) if (ch !== ' ' && !H.isSyllable(ch)) badHangul++;
  if (!e.hints || e.hints.length !== 3) noHint++;
  if (e.hints && e.hints[0].includes(e.surface)) badHint++;   // 1단계 힌트에 정답 누설 금지
  const k = e.type + '|' + e.surface;
  if (seen.has(k)) dup++; seen.add(k);
}
ok(badMeaning === 0, `뜻풀이 길이 위반 ${badMeaning}건`);
ok(badHangul === 0, `표제어에 한글 아닌 글자 ${badHangul}건`);
ok(noHint === 0, `힌트 3단계 누락 ${noHint}건`);
ok(badHint === 0, `1단계 힌트 정답 누설 ${badHint}건`);
ok(dup === 0, `중복 표제어 ${dup}건`);
ok(DB.byType.IDIOM.every(e => e.len >= 4 && e.len <= 6), '고사성어 글자 수(4~6)');
ok(DB.byType.IDIOM.filter(e => e.len === 4).length >= 90, '판에 넣을 네 글자 성어 확보');
ok(DB.byType.PROVERB.every(e => e.front && e.back), '속담 앞뒤 구절 (속담 마당 전용)');
console.log(`  낱말 ${DB.byType.WORD.length} · 사자성어 ${DB.byType.IDIOM.length} · 속담 ${DB.byType.PROVERB.length} · 갈래 ${DB.categories.length}`);

/* 3. 적응 난이도 (§7) */
head('적응 난이도');
ok(Math.abs(E.Ability.p(1200, 1200) - 0.5) < 1e-9, 'P(θ=b)=0.5');
ok(E.Ability.p(1400, 1200) > 0.7, '실력이 높으면 정답 확률 상승');
ok(Math.abs(E.Ability.targetB(1200, 0.8) - (1200 - 241)) < 1, '목표 난이도 b=θ-241');
ok(E.Ability.score(0, 0, false) === 1, '무결점 점수 1.0');
ok(E.Ability.score(3, 3, true) < 0.5, '도움 많이 쓰면 점수 하락');
const up = E.Ability.updateTheta(1200, 0, 1200, 1);
ok(up > 1200 && up < 1230, `θ 상승 폭 적정 (${up.toFixed(1)})`);

/* 4. 기억 FSRS (§8) */
head('기억(FSRS)');
let st = E.FSRS.review(null, 3, Date.now());
ok(st.S > 0 && st.D >= 1 && st.D <= 10, '첫 복습 상태 생성');
ok(st.due > Date.now(), '다음 복습일이 미래');
const st2 = E.FSRS.review(st, 4, Date.now() + E.DAY);
ok(st2.S > st.S, '잘 맞히면 안정성 증가');
const st3 = E.FSRS.review(st, 1, Date.now() + E.DAY);
ok(st3.S < st.S, '잊으면 안정성 감소');
ok(st3.lapses === 1, '망각 횟수 기록');
// FSRS 정의: 경과일 t 가 안정성 S 와 같을 때 인출확률은 정확히 0.9
ok(Math.abs(E.FSRS.R(10, 10) - 0.9) < 0.005, `R(t=S)=0.9 (실제 ${E.FSRS.R(10, 10).toFixed(3)})`);
ok(E.FSRS.R(0, 10) > 0.999, 'R(0)=1');
let mono = true;
for (let t = 1; t < 400; t++) if (E.FSRS.R(t, 10) >= E.FSRS.R(t - 1, 10)) mono = false;
ok(mono, '인출확률이 시간에 따라 단조 감소');

/* 5. 무한 스테이지 생성 시뮬레이션 (§6.9) */
head('무한 스테이지 생성 — 3트랙 × 900레벨');
const modeCount = {}, entryUse = new Set();
let empty = 0, badItem = 0, noAnswer = 0, tooMany = 0, autoSolved = 0;
const t0 = Date.now();
for (const track of [1234, 5678, 9012]) {
  const store = {
    trackId: track, memory: {}, ability: { GLOBAL: { theta: 1200, n: 0 } },
    settings: { gentle: false }
  };
  for (let lv = 1; lv <= 900; lv++) {
    // 실력을 조금씩 올려 다양한 난이도 구간을 훑습니다
    store.ability.GLOBAL.theta = 900 + (lv % 900);
    const s = E.Generator.build(lv, store, { itemsDone: 5, forceEasy: 0, last: [] });
    if (!s.items.length) { empty++; continue; }
    modeCount[s.mode] = (modeCount[s.mode] || 0) + 1;
    for (const it of s.items) {
      if (it.kind === 'choice') {
        const c = it.options.filter(o => o.correct).length;
        if (c !== 1) noAnswer++;                       // 정답 유일성
        if (it.options.length !== 4) tooMany++;
        if (!it.entry) badItem++;
        it.options.forEach(o => { if (!o.text) badItem++; });
      } else if (it.kind === 'blank') {
        if (!it.options.includes(it.correct)) noAnswer++;
        if (new Set(it.options).size !== it.options.length) tooMany++;
      } else if (it.kind === 'crossword') {
        const g = it.grid;
        if (!g || g.words.length < 3) { noAnswer++; continue; }
        if (g.w > 7 || g.h > 18) tooMany++;
        // 판에 적힌 글자와 낱말이 일치해야 합니다
        g.words.forEach(w => {
          let made = '';
          for (let k = 0; k < w.len; k++)
            made += g.letters[(w.dir === 'V' ? w.r + k : w.r) + ',' + (w.dir === 'H' ? w.c + k : w.c)] || '?';
          if (made !== w.surface) badItem++;
        });
        // 쟁반 글자로 빈 칸을 모두 채울 수 있어야 합니다
        const needCells = Object.keys(g.letters).filter(k => !it.prefilled.includes(k));
        const bag = it.tray.slice();
        needCells.forEach(k => {
          const i = bag.indexOf(g.letters[k]);
          if (i === -1) badItem++; else bag.splice(i, 1);
        });
        // 낱말끼리 반드시 물려 있어야 합니다(따로 노는 낱말 금지)
        const touched = new Set();
        g.words.forEach((w, wi) => {
          for (let k = 0; k < w.len; k++) {
            const kk = (w.dir === 'V' ? w.r + k : w.r) + ',' + (w.dir === 'H' ? w.c + k : w.c);
            g.words.forEach((o, oi) => {
              if (oi === wi) return;
              for (let m = 0; m < o.len; m++) {
                const ok2 = (o.dir === 'V' ? o.r + m : o.r) + ',' + (o.dir === 'H' ? o.c + m : o.c);
                if (ok2 === kk) { touched.add(wi); touched.add(oi); }
              }
            });
          }
        });
        if (touched.size !== g.words.length) badItem++;

        // 미리 채운 칸만으로 저절로 완성되는 낱말이 있으면 안 됩니다
        // (손도 대기 전에 맞은 것이 되어 궁리할 거리가 사라집니다)
        const pre = new Set(it.prefilled);
        g.words.forEach(w => {
          let allPre = true;
          for (let k = 0; k < w.len; k++) {
            const kk = (w.dir === 'V' ? w.r + k : w.r) + ',' + (w.dir === 'H' ? w.c + k : w.c);
            if (!pre.has(kk)) allPre = false;
          }
          if (allPre) autoSolved++;
        });
      }
      if (it.entries) it.entries.forEach(x => entryUse.add(x.id)); else if (it.entry) entryUse.add(it.entry.id);
    }
  }
}
const ms = Date.now() - t0;
ok(empty === 0, `빈 스테이지 ${empty}건`);
ok(badItem === 0, `문항 구성 오류 ${badItem}건`);
ok(noAnswer === 0, `정답 유일성 위반 ${noAnswer}건`);
ok(tooMany === 0, `보기 구성 오류 ${tooMany}건`);
ok(autoSolved === 0, `미리 채운 칸만으로 저절로 완성되는 낱말 ${autoSolved}건`);
// 속담은 레벨에 나오지 않고 '속담 마당' 코너에서만 쓰입니다.
//
// ※ '꾸러미의 몇 %를 썼는가' 로 재면 낱말을 새로 넣을 때마다 수치가 떨어집니다.
//    표본(2,700판)은 그대로인데 분모만 커지기 때문입니다.
//    정작 봐야 할 것은 '판마다 같은 낱말만 우려먹지 않는가' 이므로
//    서로 다른 낱말이 얼마나 나왔는지를 바로 셉니다.
const levelPool = DB.entries.filter(e => e.type !== 'PROVERB').length;
const VARIETY = 2500;
ok(entryUse.size >= VARIETY,
  `어휘 다양성 ${entryUse.size}종 (적어도 ${VARIETY}종 · 꾸러미 ${levelPool}개 가운데 ${(entryUse.size / levelPool * 100).toFixed(0)}%)`);
ok(ms / 2700 < 45, `평균 생성 시간 ${(ms / 2700).toFixed(1)}ms`);
console.log('  모드 분포:', Object.entries(modeCount).map(([k, v]) => `${E.MODE_NAME[k]} ${(v / 2700 * 100).toFixed(0)}%`).join(' · '));
console.log(`  2,700스테이지 생성 ${ms}ms · 사용된 낱말 ${entryUse.size}개`);

/* 6. 결정성 — 같은 레벨은 언제나 같은 문제 (§6.2) */
head('결정적 생성');
const mk = () => ({ trackId: 777, memory: {}, ability: { GLOBAL: { theta: 1200, n: 0 } }, settings: {} });
const a1 = E.Generator.build(42, mk(), { itemsDone: 5, forceEasy: 0, last: [] });
const a2 = E.Generator.build(42, mk(), { itemsDone: 5, forceEasy: 0, last: [] });
ok(a1.mode === a2.mode, '같은 레벨 = 같은 모드');
ok(JSON.stringify(a1.items.map(i => i.entry && i.entry.id)) === JSON.stringify(a2.items.map(i => i.entry && i.entry.id)), '같은 레벨 = 같은 낱말');
const b1 = E.Generator.build(42, Object.assign(mk(), { trackId: 999 }), { itemsDone: 5, forceEasy: 0, last: [] });
ok(JSON.stringify(a1.items.map(i => i.entry && i.entry.id)) !== JSON.stringify(b1.items.map(i => i.entry && i.entry.id)), '트랙이 다르면 다른 문제');

/* 7. 복습 주입 (§8.4) */
head('복습 주입');
const rs = { trackId: 1, memory: {}, ability: { GLOBAL: { theta: 1200, n: 0 } }, settings: {} };
const now = Date.now();
DB.entries.slice(0, 40).forEach(e => { rs.memory[e.id] = { S: 3, D: 5, last: now - 5 * E.DAY, due: now - E.DAY, reps: 2, lapses: 0 }; });
const due = E.Generator.dueEntries(rs, now);
ok(due.length > 0, `복습 대상 추출 (${due.length}개)`);
ok(due.every(e => { const R = E.FSRS.now(rs.memory[e.id], now); return R >= 0.55 && R <= 0.96; }), '인출확률 구간 필터');

/* 8. 실력 추정 정확도 + 정답률 밴드 (§7.2) */
head('실력 추정과 정답률 밴드');
function simulate(trueTheta, levels, gentle) {
  const store = {
    trackId: 4242, memory: {}, ability: { GLOBAL: { theta: 1200, n: 0 } },
    settings: { gentle: !!gentle }, level: 1, recent: [], footprints: 0
  };
  const session = { itemsDone: 0, forceEasy: gentle ? 99 : 0, last: [] };
  let c = 0, t = 0;
  for (let lv = 1; lv <= levels; lv++) {
    const st = E.Generator.build(lv, store, session);
    for (const it of st.items) {
      // 판 하나에는 낱말이 여럿 들어 있고, 앱은 그 낱말을 모두 기록합니다.
      // 한 개만 세면 실력 추정이 따라가지 못해 검사가 헛돌게 됩니다.
      const list = it.kind === 'crossword' ? it.entries : [it.entry];
      let win = true;
      for (const e of list) {
        const b = E.Ability.itemB(e, st.mode);
        win = Math.random() < E.Ability.p(trueTheta, b);   // 진짜 실력으로 판정
        t++; if (win) c++;
        const score = win ? 1 : 0;
        ['GLOBAL', 'TYPE:' + e.type, 'CAT:' + e.category, 'MODE:' + st.mode].forEach(k => {
          const a = store.ability[k] = store.ability[k] || { theta: store.ability.GLOBAL.theta, n: 0 };
          a.theta = E.Ability.updateTheta(a.theta, a.n, b, score); a.n++;
        });
        store.memory[e.id] = E.FSRS.review(store.memory[e.id], win ? 4 : 1, Date.now());
      }
      session.itemsDone++;
      session.last.push(win ? 1 : 0); if (session.last.length > 5) session.last.shift();
      const acc = session.last.reduce((x, y) => x + y, 0) / session.last.length;
      if (!gentle) { if (session.last.length >= 4 && acc < 0.4) session.forceEasy = 3; else if (session.forceEasy > 0) session.forceEasy--; }
    }
  }
  return { acc: c / t * 100, est: store.ability.GLOBAL.theta };
}
for (const tt of [1100, 1300, 1500]) {
  const r = simulate(tt, 60);
  ok(Math.abs(r.est - tt) < 130, `θ 추정 오차 (진짜 ${tt} → 추정 ${r.est.toFixed(0)})`);
  ok(r.acc >= 68 && r.acc <= 90, `정답률 밴드 (진짜 ${tt} → ${r.acc.toFixed(0)}%)`);
  console.log(`  진짜 ${tt} → 추정 ${r.est.toFixed(0)} · 정답률 ${r.acc.toFixed(0)}%`);
}
// 모드별로 유난히 어려운 구간이 없어야 합니다
const perMode = {};
{
  const store = { trackId: 7, memory: {}, ability: { GLOBAL: { theta: 1200, n: 200 } }, settings: {} };
  for (let lv = 1; lv <= 150; lv++) {
    const st = E.Generator.build(lv, store, { itemsDone: 20, forceEasy: 0, last: [1, 1, 1, 1] });
    for (const it of st.items) {
      const e = it.kind === 'crossword' ? it.entries[0] : it.entry;
      const m = perMode[st.mode] = perMode[st.mode] || { n: 0, p: 0 };
      m.n++; m.p += E.Ability.p(1200, E.Ability.itemB(e, st.mode));
    }
  }
}
for (const [mode, m] of Object.entries(perMode)) {
  const p = m.p / m.n * 100;
  ok(p >= 60 && p <= 96, `${E.MODE_NAME[mode]} 예상 정답률 ${p.toFixed(0)}%`);
  console.log(`  ${E.MODE_NAME[mode]}: ${p.toFixed(0)}%`);
}

/* 결과 */
console.log('\n' + '─'.repeat(52));
console.log(fail === 0 ? `✅ 전부 통과 — ${pass}개 검사` : `❌ ${fail}개 실패 / ${pass}개 통과`);
process.exit(fail === 0 ? 0 : 1);
