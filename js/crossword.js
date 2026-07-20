/* ============================================================
   crossword.js — 십자말(가로세로 낱말) 판 생성기
   낱말들이 서로 글자를 나누어 물리도록 배치합니다.
   같은 레벨은 언제나 같은 판이 나오도록 시드 난수만 씁니다.
   ============================================================ */
(function (global) {
  'use strict';
  const H = global.Hangul;

  const key = (r, c) => r + ',' + c;

  function makeIndex(pool) {
    const bySyl = {};
    pool.forEach(e => {
      new Set(e.syllables).forEach(s => (bySyl[s] = bySyl[s] || []).push(e));
    });
    return bySyl;
  }

  /**
   * 판 하나 만들기
   * @param rng   시드 난수
   * @param pool  쓸 낱말들 (2~4글자, 한글만)
   * @param opt   {words:목표 낱말 수, maxW, maxH}
   * @returns {w,h,words:[{entry,r,c,dir}],cells:Map} 또는 null
   */
  function build(rng, pool, opt) {
    const want = opt.words || 5, maxW = opt.maxW || 7, maxH = opt.maxH || 8;
    const bySyl = opt.index || makeIndex(pool);
    const seeds = pool.filter(e => e.len >= 3);
    if (!seeds.length) return null;

    const first = seeds[Math.floor(rng() * seeds.length)];
    const cells = new Map();          // "r,c" -> 글자
    const placed = [];
    const used = new Set();

    // 판 크기는 그때그때 갱신합니다 (매번 전체를 훑으면 느립니다)
    let minR = 0, maxR = 0, minC = 0, maxC = 0;

    function put(entry, r, c, dir) {
      entry.syllables.forEach((ch, k) => {
        const rr = dir === 'V' ? r + k : r, cc = dir === 'H' ? c + k : c;
        cells.set(key(rr, cc), ch);
      });
      placed.push({ entry, r, c, dir });
      used.add(entry.id);
      const er = dir === 'V' ? r + entry.len - 1 : r;
      const ec = dir === 'H' ? c + entry.len - 1 : c;
      minR = Math.min(minR, r); maxR = Math.max(maxR, er);
      minC = Math.min(minC, c); maxC = Math.max(maxC, ec);
    }

    /** 놓을 수 있는 자리인지 검사 (십자말 규칙) */
    function fits(entry, r, c, dir) {
      const n = entry.len;
      // 낱말 앞뒤 칸은 비어 있어야 합니다 (붙어서 엉뚱한 낱말이 생기지 않게)
      const beforeR = dir === 'V' ? r - 1 : r, beforeC = dir === 'H' ? c - 1 : c;
      const afterR = dir === 'V' ? r + n : r, afterC = dir === 'H' ? c + n : c;
      if (cells.has(key(beforeR, beforeC)) || cells.has(key(afterR, afterC))) return false;

      let crossings = 0;
      for (let k = 0; k < n; k++) {
        const rr = dir === 'V' ? r + k : r, cc = dir === 'H' ? c + k : c;
        const cur = cells.get(key(rr, cc));
        if (cur !== undefined) {
          if (cur !== entry.syllables[k]) return false;   // 글자가 다르면 불가
          crossings++;
        } else {
          // 새로 채우는 칸은 좌우(또는 위아래) 이웃이 비어 있어야 합니다
          const n1 = dir === 'V' ? key(rr, cc - 1) : key(rr - 1, cc);
          const n2 = dir === 'V' ? key(rr, cc + 1) : key(rr + 1, cc);
          if (cells.has(n1) || cells.has(n2)) return false;
        }
      }
      return crossings >= 1;
    }

    put(first, 0, 0, 'H');

    let tries = 0, sinceLast = 0;
    const maxTries = 90 * want;          // 낱말을 많이 넣으려면 더 많이 시도해야 합니다
    const stall = 40 * Math.max(6, want); // 더 놓을 데가 없으면 일찍 그만둡니다
    while (placed.length < want && tries < maxTries) {
      tries++; sinceLast++;
      if (sinceLast > stall) break;      // 헛도는 시도로 시간을 버리지 않습니다
      const base = placed[Math.floor(rng() * placed.length)];
      const i = Math.floor(rng() * base.entry.len);
      const ch = base.entry.syllables[i];
      const cands = bySyl[ch];
      if (!cands || !cands.length) continue;

      const w = cands[Math.floor(rng() * cands.length)];
      if (used.has(w.id)) continue;

      const jList = [];
      w.syllables.forEach((s, j) => { if (s === ch) jList.push(j); });
      const j = jList[Math.floor(rng() * jList.length)];

      const ar = base.dir === 'V' ? base.r + i : base.r;
      const ac = base.dir === 'H' ? base.c + i : base.c;
      const dir = base.dir === 'H' ? 'V' : 'H';
      const r = dir === 'V' ? ar - j : ar;
      const c = dir === 'H' ? ac - j : ac;

      if (!fits(w, r, c, dir)) continue;

      // 판이 너무 커지면 놓지 않습니다
      const er = dir === 'V' ? r + w.len - 1 : r;
      const ec = dir === 'H' ? c + w.len - 1 : c;
      if (Math.max(maxR, er) - Math.min(minR, r) + 1 > maxH) continue;
      if (Math.max(maxC, ec) - Math.min(minC, c) + 1 > maxW) continue;

      put(w, r, c, dir);
      sinceLast = 0;
    }

    if (placed.length < Math.min(3, want)) return null;

    // 좌표를 0부터 시작하도록 옮깁니다
    const r0 = minR, c0 = minC;
    const grid = {
      h: maxR - r0 + 1,
      w: maxC - c0 + 1,
      words: placed.map((p, idx) => ({
        idx, entryId: p.entry.id, surface: p.entry.surface, meaning: p.entry.meaning,
        r: p.r - r0, c: p.c - c0, dir: p.dir, len: p.entry.len
      })),
      letters: {}
    };
    cells.forEach((ch, k) => {
      const [r, c] = k.split(',').map(Number);
      grid.letters[key(r - r0, c - c0)] = ch;
    });
    return grid;
  }

  /** 여러 번 시도해서 가장 나은 판을 고릅니다 */
  function buildBest(rng, pool, opt) {
    let best = null;
    const want = opt.words || 5;
    const rounds = want >= 14 ? 14 : 10;
    // 글자 색인은 한 번만 만들어 돌려 씁니다 (판마다 다시 만들면 느립니다)
    const o = Object.assign({}, opt, { index: opt.index || makeIndex(pool) });
    const enough = Math.max(3, Math.round(want * 0.9));   // 목표의 90%면 충분히 좋은 판입니다
    for (let t = 0; t < rounds; t++) {
      const g = build(rng, pool, o);
      if (!g) continue;
      if (!best || g.words.length > best.words.length) best = g;
      if (best.words.length >= enough) break;
    }
    return best;
  }

  /** 글자 쟁반 만들기 (필요한 글자 + 헷갈림용 덤 글자) */
  function makeTray(rng, grid, prefilled, decoys) {
    const need = [];
    Object.keys(grid.letters).forEach(k => { if (!prefilled.has(k)) need.push(grid.letters[k]); });
    const extra = [];
    const pool = Object.values(grid.letters);
    for (let i = 0; i < decoys; i++) extra.push(pool[Math.floor(rng() * pool.length)]);
    const all = need.concat(extra);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
  }

  /**
   * 미리 보여줄 칸 고르기 (여러 낱말이 겹치는 칸을 우선 — 도움이 가장 큽니다)
   *
   * ★ 어떤 낱말도 '미리 채운 칸만으로 저절로 완성되면 안 됩니다.'
   *   그러면 손도 대기 전에 맞은 것이 되어, 스스로 궁리할 거리가 사라집니다.
   *   그래서 낱말마다 최소 한 칸은 반드시 비워 둡니다.
   */
  function pickPrefilled(rng, grid, count) {
    if (count <= 0) return new Set();

    const cellsOf = w => {
      const out = [];
      for (let k = 0; k < w.len; k++) out.push(key(w.dir === 'V' ? w.r + k : w.r, w.dir === 'H' ? w.c + k : w.c));
      return out;
    };

    const useCount = {};
    grid.words.forEach(w => cellsOf(w).forEach(kk => { useCount[kk] = (useCount[kk] || 0) + 1; }));

    const ordered = Object.keys(grid.letters)
      .sort((a, b) => (useCount[b] || 0) - (useCount[a] || 0) || (rng() - 0.5));

    const chosen = new Set();
    for (const k of ordered) {
      if (chosen.size >= count) break;
      chosen.add(k);
      // 이 칸을 넣어서 어떤 낱말이 통째로 채워지면 되돌립니다
      const wouldComplete = grid.words.some(w => cellsOf(w).every(kk => chosen.has(kk)));
      if (wouldComplete) chosen.delete(k);
    }
    return chosen;
  }

  global.Crossword = { build, buildBest, makeTray, makeIndex, pickPrefilled, key };
})(window);
