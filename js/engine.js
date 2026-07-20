/* ============================================================
   engine.js — 낱말 꾸러미 · 적응 난이도 · 기억 · 무한 스테이지 생성
   TECH_SPEC.md §3.4 §5.4 §6 §7 §8 구현
   ============================================================ */
(function (global) {
  'use strict';
  const H = global.Hangul;

  /* ══════════ 1. 시드 난수 (결정적) ══════════════════ */
  function hash32(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngFrom(...parts) { return mulberry32(hash32(parts.join('|'))); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function shuffled(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ══════════ 2. 낱말 꾸러미 만들기 ══════════════════ */
  /* 난이도 눈금(Elo 척도, 기준 1200).
     쉬운 쪽 폭을 넉넉히 둡니다. 실력이 낮은 분께 낼 만큼 쉬운 낱말이
     꾸러미에 없으면, 아무리 계산해도 문제를 쉽게 만들 수 없습니다. */
  const GRADE_OFFSET = { 1: -380, 2: -60, 3: 200, 4: 400 };
  const TYPE_OFFSET = { WORD: 0, IDIOM: 120, PROVERB: 80 };
  const GRADE_NAME = { 1: '초급', 2: '중급', 3: '고급', 4: '희귀' };

  function lengthOffset(n) { return n <= 2 ? -90 : n === 3 ? 0 : n === 4 ? 40 : 90; }

  /** 뜻풀이가 없는 낱말에는 갈래로 단서를 만들어 줍니다 */
  function autoClue(e) {
    return `‘${e.category}’ 갈래의 ${e.len}글자 낱말입니다.`;
  }

  function makeHints(e) {
    let t1 = e.type === 'IDIOM' ? '옛말에서 온 사자성어입니다.'
      : e.type === 'PROVERB' ? '오래 전해 온 속담입니다.'
        : `‘${e.category}’ 갈래의 낱말입니다.`;
    // 갈래 이름이 곧 정답인 경우(예: 낱말 ‘마음’ / 갈래 ‘마음’)엔 정답이 새어 나갑니다
    if (t1.includes(e.surface)) t1 = `${[...e.surface].length}글자 낱말이에요. 천천히 떠올려 보세요.`;
    const first = [...e.surface][0];
    const t2 = `첫 글자는 ‘${first}’입니다.`;
    const n = [...e.surface].length;
    const t3 = H.mask(e.surface, n - 1, '○').split('').join(' ');
    return [t1, t2, t3];
  }

  const DB = {
    entries: [], byId: {}, byType: {}, byCategory: {}, categories: [],
    bySyllableCount: {},

    build() {
      const R = global.RAW;
      let n = 0;
      const add = (o) => {
        o.id = 'W' + String(++n).padStart(5, '0');
        o.syllables = [...o.surface].filter(H.isSyllable);
        o.len = o.syllables.length;
        o.choseong = H.choseong(o.surface);
        o.bagKey = H.syllableBagKey(o.surface);
        o.difficulty = Math.max(600, Math.min(2200,
          1200 + GRADE_OFFSET[o.grade] + TYPE_OFFSET[o.type] + lengthOffset(o.len)));
        o.hasMeaning = !!(o.meaning && o.meaning.length);
        o.clue = o.hasMeaning ? o.meaning : autoClue(o);
        o.hints = makeHints(o);
        this.entries.push(o);
        this.byId[o.id] = o;
        (this.byType[o.type] = this.byType[o.type] || []).push(o);
        (this.byCategory[o.category] = this.byCategory[o.category] || []).push(o);
        (this.bySyllableCount[o.len] = this.bySyllableCount[o.len] || []).push(o);
      };

      R.WORDS.forEach(([surface, meaning, example, category, grade]) =>
        add({ type: 'WORD', surface, hanja: '', meaning, example, category, grade }));
      // 간결 형식 [표기, 뜻풀이, 갈래, 등급] — 예문 없이 낱말을 많이 담기 위한 것입니다
      [].concat(R.WORDS2 || [], R.WORDS3 || [], R.WORDS4 || [], R.WORDS5 || [], R.WORDS6 || [], R.WORDS7 || []).forEach(([surface, meaning, category, grade]) =>
        add({ type: 'WORD', surface, hanja: '', meaning, example: '', category, grade }));
      [].concat(R.IDIOMS, R.IDIOMS2 || []).forEach(([surface, hanja, meaning, example, grade]) =>
        add({ type: 'IDIOM', surface, hanja, meaning, example, category: '말의 뿌리', grade }));
      R.PROVERBS.forEach(([front, back, meaning, grade]) =>
        add({ type: 'PROVERB', surface: front + ' ' + back, front, back, hanja: '', meaning, example: '', category: '말의 뿌리', grade }));

      this.categories = Object.keys(this.byCategory).sort();
      this.minB = Math.min(...this.entries.map(e => e.difficulty));
      this.maxB = Math.max(...this.entries.map(e => e.difficulty));
      const four = this.byType.IDIOM.filter(e => e.len === 4);
      this.easiestIdiom = four.length ? Math.min(...four.map(e => e.difficulty)) : 1300;

      // 혼동어를 만들 때 뒤질 자리를 미리 나눠 둡니다 (갈래·글자 수별)
      this._bucket = {};
      this.byType.WORD.concat(this.byType.IDIOM).forEach(e => {
        const k = e.type + '|' + e.len;
        (this._bucket[k] = this._bucket[k] || []).push(e);
      });
      return this;
    },

    /**
     * 오답 보기로 쓸 '닮은 낱말' — 필요할 때 그때 만듭니다.
     *
     * 예전에는 앱을 켤 때 모든 낱말을 서로 견주어 미리 만들어 두었습니다.
     * 낱말이 늘수록 견주는 횟수가 제곱으로 불어나(3,800개면 1,400만 번)
     * 앱이 켜지기까지 삼십 초 넘게 멈춰 섰습니다.
     * 닮은 낱말은 사자성어 빈칸·속담 같은 데서 한 판에 몇 번밖에 쓰이지 않으므로,
     * 쓰일 때 한 번만 셈해서 넣어 둡니다.
     */
    confusableFor(a) {
      if (a._conf) return a._conf;
      const cands = (this._bucket[a.type + '|' + a.len] || []).filter(b => b !== a);
      return (a._conf = cands
        .map(b => ({ b, s: H.similarity(a.surface, b.surface) }))
        .sort((x, y) => y.s - x.s).slice(0, 6).map(x => x.b.id));
    },

    minB: 600, maxB: 2200,

    /**
     * 목표 난이도 근처의 낱말 후보.
     * 대역 안에 후보가 모자라면 '전체 무작위'로 흩어지면 안 됩니다.
     * (그러면 난이도 조절이 통째로 무력화되어 문제가 너무 어려워집니다.)
     * 가장 가까운 것들만 골라 줍니다.
     */
    near(target, band, filter) {
      const pool = filter ? this.entries.filter(filter) : this.entries;
      if (!pool.length) return [];
      const inBand = pool.filter(e => Math.abs(e.difficulty - target) <= band);
      if (inBand.length >= 3) return inBand;
      return pool.slice()
        .sort((a, b) => Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target))
        .slice(0, Math.min(12, pool.length));
    }
  };

  /* ══════════ 3. 적응 난이도 (Elo) — TECH_SPEC §7 ═════ */

  /**
   * 모드가 문제를 얼마나 쉽게 만드는가 (Elo 점수, 음수일수록 쉬움).
   * 같은 낱말이라도 '직접 떠올리기'와 '넷 중 고르기'는 난이도가 전혀 다릅니다.
   * 이걸 모델에 넣지 않으면 사자성어·속담 문제만 유난히 어려워집니다.
   */
  const MODE_DELTA = {
    CROSSWORD: -160,  // 글자가 모두 주어지고 서로 물려 있어 단서가 됨
    CHOSEONG: -280,  // 첫소리와 뜻이 함께 주어지고 넷 중 고르기 (사자성어 전용)
    IDIOM_BLANK: -240,  // 한 글자만 고르면 됨
    PROVERB_MATCH: -200,  // 앞구절이 주어짐 (속담 마당 전용)
    REVIEW_MIX: -120
  };

  const Ability = {
    /** 모드까지 반영한 실제 체감 난이도 */
    itemB(entry, mode) { return entry.difficulty + (MODE_DELTA[mode] || 0); },

    /** 정답 확률 */
    p(theta, b) { return 1 / (1 + Math.pow(10, (b - theta) / 400)); },

    /** 목표 정답률 p 를 만드는 난이도 */
    targetB(theta, p) { return theta - 400 * Math.log10(p / (1 - p)); },

    /**
     * 슬롯 추첨: 자신감 22% / 주력 55% / 도전 20% / 탐색 3%
     * 가중평균 목표 정답률 ≈ 0.81.
     * (도전·탐색 비중이 크면 평균이 0.77까지 내려가 시니어에게는 버겁습니다.)
     */
    pickSlot(rng, session) {
      if (session.itemsDone < 2) return 0.92;           // 세션 첫 2문항은 반드시 자신감
      if (session.forceEasy > 0) return 0.92;           // 연속 좌절 보호
      const r = rng();
      return r < 0.22 ? 0.92 : r < 0.77 ? 0.80 : r < 0.97 ? 0.70 : 0.55;
    },

    /** 부분 점수 (§7.3) */
    score(hintLevel, wrongCount, slow) {
      return Math.max(0, Math.min(1,
        1 - 0.15 * hintLevel - 0.10 * Math.min(wrongCount, 3) / 3 - (slow ? 0.10 : 0)));
    },

    /** θ 갱신 (동적 K) */
    updateTheta(theta, n, b, score) {
      const K = Math.max(8, 40 / (1 + 0.05 * n));
      return theta + K * (score - this.p(theta, b));
    },

    /** 유효 실력 (다차원 축소 결합, §7.5) */
    effective(store, type, category, mode) {
      const g = store.ability.GLOBAL || { theta: 1200, n: 0 };
      const sub = (key) => {
        const s = store.ability[key];
        if (!s) return g.theta;
        const w = s.n / (s.n + 25);
        return w * s.theta + (1 - w) * g.theta;
      };
      return 0.55 * g.theta + 0.20 * sub('TYPE:' + type) + 0.15 * sub('CAT:' + category) + 0.10 * sub('MODE:' + mode);
    }
  };

  /* ══════════ 4. 기억 (FSRS) — TECH_SPEC §8 ═══════════ */
  const W = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722,
    0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542];
  const DECAY = -0.5, FACTOR = Math.pow(0.9, 1 / DECAY) - 1;
  const DAY = 86400000;

  const FSRS = {
    retention: 0.9,
    /** 인출확률 R(t,S) */
    R(elapsedDays, S) { return Math.pow(1 + FACTOR * elapsedDays / S, DECAY); },
    initS(g) { return Math.max(0.1, W[g - 1]); },
    initD(g) { return Math.min(10, Math.max(1, W[4] - Math.exp(W[5] * (g - 1)) + 1)); },
    nextD(D, g) {
      const dp = D - W[6] * (g - 3);
      return Math.min(10, Math.max(1, W[7] * this.initD(4) + (1 - W[7]) * dp));
    },
    nextS(D, S, R, g) {
      if (g === 1) { // 잊음
        return Math.min(S, W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R)));
      }
      const hard = g === 2 ? W[15] : 1, easy = g === 4 ? W[16] : 1;
      return S * (1 + Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * hard * easy);
    },
    interval(S) { return Math.max(1, Math.round(S / FACTOR * (Math.pow(this.retention, 1 / DECAY) - 1))); },

    /** 퍼즐 결과 → 등급 (§8.3) */
    grade(hintLevel, solved, slow) {
      if (!solved || hintLevel >= 3) return 1;
      if (hintLevel >= 1) return 2;
      return slow ? 3 : 4;
    },

    /** 상태 갱신 */
    review(state, g, now) {
      if (!state) {
        const S = this.initS(g), D = this.initD(g);
        return { S, D, last: now, due: now + this.interval(S) * DAY, reps: 1, lapses: g === 1 ? 1 : 0 };
      }
      const elapsed = Math.max(0, (now - state.last) / DAY);
      const R = this.R(elapsed, state.S);
      const D = this.nextD(state.D, g);
      const S = Math.max(0.1, this.nextS(state.D, state.S, R, g));
      return { S, D, last: now, due: now + this.interval(S) * DAY, reps: state.reps + 1, lapses: state.lapses + (g === 1 ? 1 : 0) };
    },

    /** 지금 이 낱말의 인출확률 */
    now(state, now) {
      if (!state) return null;
      return this.R(Math.max(0, (now - state.last) / DAY), state.S);
    }
  };

  /* ══════════ 5. 무한 스테이지 생성 — TECH_SPEC §6 ════ */
  /* 낱말의 '뜻 고르기'는 없앴습니다.
     가로세로 낱말에서 이미 낱말을 충분히 익히므로,
     쉬운 낱말을 다시 묻는 것은 지루하기만 합니다.
     따로 내는 문제는 사자성어와 속담처럼 배울 거리가 있는 것만 남깁니다. */
  /* 뜻이나 낱말을 넷 중에서 고르는 문제는 모두 없앴습니다.
     가로세로 낱말에서 이미 낱말을 충분히 익히므로 지루하기만 합니다.
     사자성어는 판 안에 섞여 나오고, 속담만 마당에 한 번씩 두 문항 들어갑니다. */
  const MODES = ['CROSSWORD', 'REVIEW_MIX', 'PROVERB_MATCH'];
  const MODE_NAME = {
    CROSSWORD: '가로세로 낱말', PROVERB_MATCH: '속담 잇기', REVIEW_MIX: '되새김 판'
  };
  const MODE_GUIDE = {
    CROSSWORD: '아래 글자를 눌러 낱말 판을 채워 보세요.',
    PROVERB_MATCH: '속담의 뒷부분을 이어 보세요.',
    REVIEW_MIX: '지난번에 만난 낱말로 판을 짰어요. 다시 만나 볼까요?'
  };

  /** 마당(10걸음) 안 위치별 모드 — 열 걸음 중 여덟이 낱말 판입니다 */
  function modeForLevel(level, rng) {
    const pos = ((level - 1) % 10) + 1;
    if (pos === 5) return 'PROVERB_MATCH';   // 속담 두 문항으로 잠깐 쉬어 갑니다
    if (pos === 7) return 'REVIEW_MIX';      // 배운 낱말로 짠 판
    return 'CROSSWORD';
  }

  /**
   * 판의 크기·도움을 정합니다.
   * 목표 정답률이 낮을수록(=도전) 판이 커지고,
   * 산책을 오래 하실수록 조금씩 더 커집니다.
   */
  /**
   * 판의 크기·도움을 정합니다.
   * 한 판에 스무 낱말 안팎을 담습니다 (가로세로를 합쳐 스무 문제).
   *
   * 미리 채워 주는 칸은 '개수'가 아니라 '비율'로 정합니다.
   * 낱말이 스무 개면 글자 칸이 사십 개가 넘는데, 그걸 전부 쟁반에 담으면
   * 쟁반이 화면을 가득 채워 도리어 어지럽습니다. (본보기 그림도 절반쯤 채워져 있습니다)
   */
  function gridSpec(targetP, level) {
    let s;
    if (targetP >= 0.90) s = { words: 15, fill: 0.50, decoys: 0 };
    else if (targetP >= 0.78) s = { words: 16, fill: 0.42, decoys: 2 };
    else if (targetP >= 0.62) s = { words: 17, fill: 0.34, decoys: 3 };
    else s = { words: 18, fill: 0.28, decoys: 4 };

    // 단계가 쌓이면 판이 조금씩 커지고 미리 채워 주는 칸이 줄어듭니다
    const lv = level || 1;
    const grow = lv >= 400 ? 2 : lv >= 120 ? 1 : 0;
    const less = lv >= 250 ? 0.06 : 0;
    return {
      words: Math.min(20, s.words + grow),
      fill: Math.max(0.20, s.fill - less),
      decoys: s.decoys + (lv >= 600 ? 2 : 0)
    };
  }

  /* 판 하나에 들어갈 낱말 수의 하한.
     이보다 적으면 판이 허전해서 후보를 넓혀 다시 짭니다. */
  const MIN_WORDS = 12;

  /**
   * 오래 걸으실수록 조금씩 어려워집니다.
   *
   * 로그로 올려 초반에는 빠르게, 나중에는 아주 천천히 오릅니다.
   * 그래야 처음 백 단계에서 '늘고 있다'는 느낌이 나면서도
   * 천 단계쯤에서 갑자기 벽에 부딪히지 않습니다.
   * 위쪽은 220점에서 멈춥니다 — 더 올리면 실력이 좋은 분도
   * 정답률이 70% 아래로 떨어져 재미가 사라집니다.
   */
  function levelRamp(level) {
    return Math.min(220, 78 * Math.log10(1 + (level || 1) / 15));
  }

  /* 동네마다 어울리는 빛깔을 둡니다.
     백 단계를 걸어 동네가 바뀌면 화면 빛깔도 함께 바뀝니다.
     수천 단계를 걸으시는 분께 같은 빛깔만 보여 드리면 지루합니다. */
  const NEIGHBORHOODS = [
    { name: '봄 골목', hue: 'sunset' }, { name: '개울 마을', hue: 'ocean' },
    { name: '단풍 언덕', hue: 'coral' }, { name: '눈 내린 마을', hue: 'ocean' },
    { name: '들꽃 언덕', hue: 'lavender' }, { name: '솔밭 길', hue: 'forest' },
    { name: '바닷가 마을', hue: 'ocean' }, { name: '장터 거리', hue: 'coral' },
    { name: '기와 골목', hue: 'clay' }, { name: '별 뜨는 언덕', hue: 'lavender' },
    { name: '감나무 집', hue: 'coral' }, { name: '아랫목 마을', hue: 'clay' }
  ];

  const Generator = {
    /** 복습 대상 (R이 0.70~0.95인 '거의 잊을 뻔한' 낱말, §8.4) */
    dueEntries(store, now) {
      const out = [];
      for (const id in store.memory) {
        const st = store.memory[id], e = DB.byId[id];
        if (!e) continue;
        const R = FSRS.now(st, now);
        if (st.due <= now && R !== null && R >= 0.55 && R <= 0.96) out.push({ e, R });
      }
      return out.sort((a, b) => (0.95 - a.R) - (0.95 - b.R)).map(x => x.e);
    },

    /** 레벨 → 완전한 스테이지 명세 */
    build(level, store, session) {
      const rng = rngFrom('core-v1', store.trackId, level);
      let mode = modeForLevel(level, rng);
      const now = Date.now();
      const due = this.dueEntries(store, now);
      const theta = store.ability.GLOBAL.theta;
      const chapter = Math.floor((level - 1) / 10) + 1;
      const hoodIdx = Math.floor((level - 1) / 100) % NEIGHBORHOODS.length;

      const targetP = Ability.pickSlot(rng, session);
      // 모드가 쉬운 만큼 낱말은 더 어려운 것을 골라야 체감 난이도가 맞습니다.
      // 여기에 '오래 걸으실수록 조금씩 오르는' 보정을 더합니다.
      const bTarget = Ability.targetB(theta, targetP) - (MODE_DELTA[mode] || 0) + levelRamp(level);

      let items = [];
      for (let attempt = 0; attempt < 8 && items.length === 0; attempt++) {
        const r = rngFrom('core-v1', store.trackId, level, attempt);
        items = this.compose(mode, r, bTarget, due, store, targetP, level);
      }
      if (items.length === 0) items = this.compose('CROSSWORD', rngFrom('fb', level), bTarget, [], store, targetP, level);

      return {
        level, chapter, mode, modeName: MODE_NAME[mode], guide: MODE_GUIDE[mode],
        hood: NEIGHBORHOODS[hoodIdx], stepInChapter: ((level - 1) % 10) + 1,
        targetP, bTarget: Math.round(bTarget), ramp: Math.round(levelRamp(level)), items
      };
    },

    compose(mode, rng, bTarget, due, store, targetP, level) {
      switch (mode) {
        case 'CROSSWORD': return this.crossword(rng, bTarget, due, targetP, level, store);
        case 'PROVERB_MATCH': return this.proverb(rng, bTarget, due);   // 두 문항
        case 'REVIEW_MIX': return this.review(rng, bTarget, due, store, targetP, level);
        default: return [];
      }
    },

    /* ── 가로세로 낱말 (주력 모드) ── */
    crossword(rng, bTarget, due, targetP, level, store) {
      const spec = gridSpec(targetP || 0.8, level);
      const ok = e => (e.type === 'WORD' || e.type === 'IDIOM') && e.len >= 2 && e.len <= 4;

      /**
       * 후보 낱말을 모아 판을 짭니다.
       * 후보를 난이도로 좁힐수록 실력에는 잘 맞지만,
       * 서로 물릴 글자가 모자라 판이 허전해집니다.
       * 그래서 먼저 좁게 시도하고, 판이 너무 작으면 조금씩 넓혀 갑니다.
       */
      /*
       * ‘난이도 ±얼마’ 로 후보를 고르면 쉬운 낱말이 훨씬 많아서
       * 뽑히는 낱말이 자꾸 쉬운 쪽으로 쏠립니다.
       * (실력이 높은 분께 자꾸 쉬운 문제가 나가 실력이 제대로 안 읽힙니다.)
       * 그래서 '목표 난이도에 가까운 순으로 몇 개' 를 세어 고릅니다.
       */
      /*
       * 방금 만난 낱말은 뒤로 미룹니다.
       * 난이도로만 고르면 목표 근처의 같은 낱말이 판마다 되풀이됩니다.
       * 최근 목록에 있으면 '난이도가 260점 먼 낱말'인 셈 치고 순위를 내려
       * 다른 낱말이 먼저 뽑히게 합니다. (아주 빼지는 않습니다 —
       * 되새김에는 다시 만나는 것이 필요합니다)
       */
      const recent = (store && store.recent) || [];
      const seen = new Set(recent);
      /*
       * 최근일수록 더 세게 밀어냅니다.
       * 방금 만난 낱말은 900점, 오래된 것일수록 약해져 300점까지 내려옵니다.
       * (아주 빼지는 않습니다 — 되새김에는 다시 만나는 것이 필요합니다)
       */
      const age = {};
      recent.forEach((id, i) => { age[id] = i; });
      const n = recent.length;
      const push = e => {
        if (!seen.has(e.id)) return 0;
        const fresh = (age[e.id] + 1) / n;      // 1에 가까울수록 방금 만난 것
        return 300 + 600 * fresh;
      };
      const rank = e => Math.abs(e.difficulty - bTarget) + push(e);
      const byNear = DB.entries.filter(ok).sort((a, b) => rank(a) - rank(b));

      const makePool = (size) => {
        const p = byNear.slice(0, size);
        // 되새길 낱말이 있으면 판에 들어갈 확률을 높입니다
        const dueOk = due.filter(e => ok(e) && !p.includes(e));
        shuffled(rng, dueOk).slice(0, 6).forEach(e => p.push(e));
        return p;
      };

      let grid = null;
      // 좁게 → 조금 넓게 → 넉넉하게. 열두 낱말이 넘으면 그 자리에서 멈춥니다.
      for (const size of [260, 420, 700]) {
        const p = makePool(size);
        if (p.length < 20) continue;
        const g = global.Crossword.buildBest(rng, p, { words: spec.words, maxW: 7, maxH: 18 });
        if (g && (!grid || g.words.length > grid.words.length)) grid = g;
        if (grid && grid.words.length >= MIN_WORDS) break;
      }
      if (!grid || grid.words.length < 3) return [];

      // 미리 채울 칸 수는 판이 실제로 몇 칸인지 보고 정합니다
      const cellCount = Object.keys(grid.letters).length;
      const prefilled = global.Crossword.pickPrefilled(rng, grid, Math.round(cellCount * spec.fill));
      const tray = global.Crossword.makeTray(rng, grid, prefilled, spec.decoys);
      const entries = grid.words.map(w => DB.byId[w.entryId]).filter(Boolean);

      return [{
        kind: 'crossword', grid, tray,
        prefilled: [...prefilled],
        entries, entry: entries[0]
      }];
    },

    /**
     * 복습 대상을 우선 섞어 고르기 (§8.4 주입)
     * 대역(band)은 좁게 잡습니다. Elo 400점이 정답확률 10배 차이이므로
     * ±260이면 정답률이 92%에서 49%까지 널뛰어 밴드가 깨집니다.
     */
    choose(rng, bTarget, due, filter, band = 130) {
      const fits = due.filter(e => filter(e) && Math.abs(e.difficulty - bTarget) <= band + 70);
      if (fits.length && rng() < 0.4) return { e: pick(rng, fits), review: true };
      const cands = DB.near(bTarget, band, filter);
      if (!cands.length) return null;
      return { e: pick(rng, cands), review: false };
    },

    /* ── 글자 모아 낱말 ── */
    wheel(rng, bTarget, due) {
      const isWord = e => e.type === 'WORD' && e.len >= 2 && e.len <= 4;
      const main = this.choose(rng, bTarget, due, e => isWord(e) && e.len >= 3);
      if (!main) return [];
      let bag = main.e.syllables.slice();
      const targets = [main.e];

      // 트레이 글자로 만들 수 있는 다른 낱말 찾기
      const extras = DB.byType.WORD.filter(e =>
        e !== main.e && e.len >= 2 && H.isSubsetOfBag(e.surface, bag));
      shuffled(rng, extras).slice(0, 2).forEach(e => targets.push(e));

      // 부족하면 짧은 낱말을 합쳐 트레이를 넓힘
      if (targets.length < 2) {
        const second = pick(rng, DB.byType.WORD.filter(e => e.len === 2 && e !== main.e));
        if (second) { targets.push(second); bag = bag.concat(second.syllables); }
      }
      // 트레이를 6~7칸으로 채움
      const filler = '가나다마바사자하고기소무이';
      while (bag.length < Math.min(7, Math.max(6, bag.length))) bag.push(pick(rng, [...filler]));

      return [{
        kind: 'wheel', entry: main.e, targets,
        tray: shuffled(rng, bag),
        answers: targets.map(t => t.surface)
      }];
    },



    /* ── 속담 잇기 ── */
    proverb(rng, bTarget, due, count) {
      const pool = DB.byType.PROVERB;
      const n = count || 2;                 // 마당 안에서는 두 문항만 (쉬어 가는 자리)
      const used = new Set(), chosen = [];
      for (let i = 0; i < n; i++) {
        // 속담도 실력에 맞춰 고릅니다(예전엔 아무거나 뽑아 유난히 어려웠습니다)
        const c = this.choose(rng, bTarget, due || [], e => e.type === 'PROVERB' && !used.has(e.id), 160);
        if (!c) break;
        used.add(c.e.id); chosen.push(c.e);
      }
      if (chosen.length < n) return [];
      return chosen.map(e => ({
        kind: 'choice', entry: e, prompt: 'proverb', options: this.backOptions(rng, e, pool)
      }));
    },

    /** 속담 뒷구절 보기 — 같은 뒷구절을 가진 속담은 오답에서 제외(정답 유일성) */
    backOptions(rng, e, pool) {
      const wrongs = [];
      const seen = new Set([e.back]);
      for (const p of shuffled(rng, pool)) {
        if (wrongs.length >= 3) break;
        if (p === e || seen.has(p.back)) continue;
        seen.add(p.back); wrongs.push(p.back);
      }
      return shuffled(rng, [e.back, ...wrongs]).map(t => ({ text: t, correct: t === e.back }));
    },

    /* ── 되새김 판 ──
       예전에는 배운 낱말의 뜻을 묻는 퀴즈였지만,
       쉬운 낱말을 다시 묻는 것은 지루합니다.
       이제는 '배운 낱말로 짠 십자말 판'을 드립니다.
       똑같이 되새기면서도 손으로 채우는 재미가 있습니다. */
    review(rng, bTarget, due, store, targetP, level) {
      const ok = e => store.memory[e.id] && (e.type === 'WORD' || e.type === 'IDIOM') && e.len >= 2 && e.len <= 4;
      // 되새김이라고 난이도 밴드를 깨면 안 됩니다.
      // 배운 낱말 가운데 지금 실력에 맞는 것부터 씁니다.
      let learned = DB.entries.filter(e => ok(e) && Math.abs(e.difficulty - bTarget) <= 300);
      if (learned.length < 80) {
        learned = DB.entries.filter(ok)
          .sort((a, b) => Math.abs(a.difficulty - bTarget) - Math.abs(b.difficulty - bTarget))
          .slice(0, 150);
      }
      const pool = learned.length >= 60 ? learned : null;

      if (pool) {
        const spec = gridSpec(targetP || 0.8, level);
        const grid = global.Crossword.buildBest(rng, pool, { words: spec.words, maxW: 7, maxH: 18 });
        if (grid && grid.words.length >= 3) {
          // 미리 채울 칸 수는 판이 실제로 몇 칸인지 보고 정합니다
      const cellCount = Object.keys(grid.letters).length;
      const prefilled = global.Crossword.pickPrefilled(rng, grid, Math.round(cellCount * spec.fill));
          const tray = global.Crossword.makeTray(rng, grid, prefilled, spec.decoys);
          const entries = grid.words.map(w => DB.byId[w.entryId]).filter(Boolean);
          return [{ kind: 'crossword', grid, tray, prefilled: [...prefilled], entries, entry: entries[0], review: true }];
        }
      }
      // 아직 배운 낱말이 적으면 평범한 판으로 대신합니다
      return this.crossword(rng, bTarget, due, targetP, level);
    },

    /** 오답 보기 만들기 — 혼동어 우선 (§3.2) */
    options(rng, entry, field) {
      const wrongs = [];
      const seen = new Set([entry.id]);
      for (const id of shuffled(rng, DB.confusableFor(entry))) {
        if (wrongs.length >= 3) break;
        const e = DB.byId[id];
        if (e && !seen.has(e.id)) { seen.add(e.id); wrongs.push(e); }
      }
      const same = DB.entries.filter(e => e.type === entry.type && !seen.has(e.id));
      for (const e of shuffled(rng, same)) {
        if (wrongs.length >= 3) break;
        seen.add(e.id); wrongs.push(e);
      }
      const val = e => (field === 'meaning' ? e.meaning : e.surface);
      return shuffled(rng, [
        { text: val(entry), correct: true },
        ...wrongs.map(e => ({ text: val(e), correct: false }))
      ]);
    }
  };

  global.Engine = { DB, Ability, FSRS, Generator, rngFrom, pick, shuffled, hash32, MODE_NAME, MODE_DELTA, MODES, NEIGHBORHOODS, GRADE_NAME, DAY, gridSpec, levelRamp };
})(window);
