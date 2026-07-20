/* ============================================================
   game.js — 퍼즐 진행 화면
   TECH_SPEC §6.6 도움말 · §6.7 실패 처리 · §7.3 점수 · §8 기억
   ============================================================ */
(function (global) {
  'use strict';
  const { DB, Ability, FSRS, Generator, GRADE_NAME } = global.Engine;
  const H = global.Hangul;
  const { h, $, sheet, say, dogBlock, dogMood, paw, sceneCaption } = global.UI;
  const Store = global.Store, Sound = global.Sound, App = global.App;

  const Game = {
    stage: null, idx: 0, session: null, item: null,
    hintLevel: 0, wrong: 0, startMs: 0, typed: '', found: [], usedTiles: [],
    metEntries: [], reviewOnly: false,

    /**
     * 세션은 '앱을 켜서 쓰는 동안' 이어집니다.
     * 레벨마다 새로 만들면 "세션 첫 두 문항은 쉽게" 규칙이 매번 적용되어
     * 난이도가 영영 올라가지 않습니다.
     */
    newSession() {
      this.session = { itemsDone: 0, forceEasy: Store.data.settings.gentle ? 99 : 0, last: [] };
      return this.session;
    },
    ensureSession() {
      if (!this.session) this.newSession();
      const gentle = Store.data.settings.gentle;          // 설정이 바뀌면 반영
      if (gentle) this.session.forceEasy = 99;
      else if (this.session.forceEasy === 99) this.session.forceEasy = 0;
      return this.session;
    },

    /* ── 시작 ── */
    start() {
      this.reviewOnly = false;
      this.ensureSession();
      this.stage = Generator.build(Store.data.level, Store.data, this.session);
      this.idx = 0; this.metEntries = [];
      this.renderItem();
    },

    /** 되새김만 모아서 */
    startReview() {
      this.reviewOnly = true;
      this.ensureSession();
      const due = Generator.dueEntries(Store.data, Date.now());
      const rng = global.Engine.rngFrom('review', Date.now());
      const items = Generator.review(rng, Store.data.ability.GLOBAL.theta - 241, due, Store.data, 0.8);
      this.stage = { level: Store.data.level, mode: 'REVIEW_MIX', modeName: '되새김 판', guide: '지난번에 만난 낱말로 판을 짰어요. 다시 만나 볼까요?', hood: { name: '되새김 마당', emoji: '📖' }, stepInChapter: 1, items };
      this.idx = 0; this.metEntries = [];
      if (!items.length) return say('되새길 낱말이 아직 없어요. 산책을 다녀오면 생겨요.', '📖');
      this.renderItem();
    },

    /**
     * 속담 마당 — 레벨과 따로 있는 코너입니다.
     * 속담은 길어서 가로세로 판에 들어가지 않기 때문에 여기서 따로 즐깁니다.
     */
    startProverbs() {
      this.reviewOnly = true;
      this.ensureSession();
      const rng = global.Engine.rngFrom('proverb', Date.now());
      const theta = Store.data.ability.GLOBAL.theta;
      const bTarget = Ability.targetB(theta, 0.8) - (global.Engine.MODE_DELTA.PROVERB_MATCH || 0);
      const items = Generator.proverb(rng, bTarget, []);
      if (!items.length) return say('속담을 준비하지 못했어요. 잠시 뒤에 다시 해 볼까요?', '🧧');
      this.stage = {
        level: Store.data.level, mode: 'PROVERB_MATCH', modeName: '속담 마당',
        guide: '속담의 뒷부분을 이어 보세요.',
        hood: { name: '속담 마당', emoji: '🧧' }, stepInChapter: 1, items
      };
      this.idx = 0; this.metEntries = [];
      this.renderItem();
    },

    /* ── 문항 그리기 ── */
    renderItem() {
      if (this.idx >= this.stage.items.length) return this.finish();
      this.item = this.stage.items[this.idx];
      this.hintLevel = 0; this.wrong = 0; this.startMs = Date.now();
      this.usedTiles = [];
      this.gridState = null; this.solvedWords = []; this.tileAt = {}; this.metThisGrid = [];
      this.wordSt = {}; this.selfSolved = 0;

      $('tabbar').classList.add('hidden');

      App.top(this.reviewOnly ? this.stage.modeName : this.stage.level + '번째 산책',
        h('button', { class: 'iconbtn back', 'aria-label': '나가기', onclick: () => this.leave() },
          h('span', { class: 'ic' }, '←'), h('span', { class: 'tx' }, '나가기')),
        (() => {
          const chip = h('span', { class: 'footchip', id: 'footchip' });
          chip.innerHTML = '<i class="chip-ic">' + global.UI.ICON.paw + '</i>' +
            '<b>' + Store.data.footprints + '</b>';
          return chip;
        })());

      const v = $('view'); v.innerHTML = ''; v.scrollTop = 0;

      // 진행 발자국 (마당 단위 — 전체 진행률은 보여주지 않습니다)
      // 문항이 여럿일 때만 발자국으로 진행을 보여 줍니다.
      // 하나뿐인데 발자국 한 개만 놓이면 무엇을 뜻하는지 알 수 없습니다.
      if (this.stage.items.length > 1) {
        v.appendChild(h('div', { class: 'steps' },
          Array.from({ length: this.stage.items.length }, (_, i) =>
            paw(i < this.idx ? 'on' : (i === this.idx ? 'now' : '')))));
      }

      // 모드와 풍경을 한 줄로 합칩니다.
      // 비슷하게 생긴 줄이 둘이면 어느 쪽을 봐야 할지 알 수 없습니다.
      const scene = global.Theme.apply(this.stage.level);
      // 풍경 이름만 한 줄로. 모드 이름은 판을 보면 알 수 있어 빼고,
      // 좁은 화면에서 두 줄로 넘치던 것을 막습니다.
      v.appendChild(sceneCaption(scene.name));

      const body = h('div', { id: 'play' });
      v.appendChild(body);
      ({ crossword: this.drawGrid, choice: this.drawChoice, blank: this.drawBlank })[this.item.kind].call(this, body);

      // 도구 칸 — 무엇을 얼마에 쓸 수 있는지 한눈에 보이게
      v.appendChild(h('div', { class: 'tools', id: 'tools' }));
      this.drawTools();
      v.appendChild(h('div', { class: 'row', style: 'margin-top:14px;justify-content:center' },
        h('button', { class: 'btn quiet', id: 'skipbtn', onclick: () => this.skip() }, '오늘은 넘어가기')));
      v.appendChild(h('div', { id: 'hintbox', style: 'margin-top:12px' }));

      global.UI.guardTaps();   // 화면이 바뀐 직후 오터치 방지

      // 오래 걸리면 강아지가 먼저 다가옵니다 (막힘 방지)
      clearTimeout(this._nudge);
      this._nudge = setTimeout(() => {
        dogMood('dog', '갸웃');
        setTimeout(() => dogMood('dog', '편안함'), 3000);
      }, 30000);
    },

    /* ══════════════════════════════════════════════
       주력 모드: 가로세로 낱말
       ══════════════════════════════════════════════ */
    drawGrid(box) {
      const it = this.item, g = it.grid;
      const K = global.Crossword.key;

      // 판 상태 준비
      if (!this.gridState) {
        this.gridState = {};
        it.prefilled.forEach(k => this.gridState[k] = g.letters[k]);
        this.solvedWords = [];
        this.usedTiles = [];
        this.wordIdx = 0;
        this.selectFirstUnsolved();
      }

      // 칸 크기는 CSS 가 정확히 맞춰 넣습니다.
      // (자바스크립트로 px 을 계산하면 여백을 조금만 잘못 재도 판이 좌우로 넘쳐
      //  마지막 칸을 보려고 옆으로 밀어야 합니다.)
      // 1fr 로 나누면 화면이 좁아도 절대 넘치지 않고, 넓으면 74px 까지만 커집니다.
      const GAP = 5, MAXCELL = 74;
      const grid = h('div', {
        class: 'xgrid', id: 'xgrid',
        style: `grid-template-columns:repeat(${g.w}, minmax(0, 1fr));` +
          `gap:${GAP}px;width:100%;max-width:${g.w * MAXCELL + (g.w - 1) * GAP}px;`
      });

      const cur = g.words[this.wordIdx];
      const inCur = (r, c) => cur && (cur.dir === 'H'
        ? (r === cur.r && c >= cur.c && c < cur.c + cur.len)
        : (c === cur.c && r >= cur.r && r < cur.r + cur.len));

      for (let r = 0; r < g.h; r++) for (let c = 0; c < g.w; c++) {
        const k = K(r, c);
        const need = g.letters[k];
        if (!need) { grid.appendChild(h('div', { class: 'xcell gap' })); continue; }
        const val = this.gridState[k];
        const done = this.isCellSolved(r, c);
        const fixed = it.prefilled.includes(k);
        grid.appendChild(h('button', {
          class: 'xcell' + (done ? ' done' : '') + (fixed ? ' fixed' : '') + (inCur(r, c) ? ' cur' : ''),
          'data-k': k,
          onclick: () => this.tapCell(r, c)
        }, val || ''));
      }
      box.appendChild(h('div', { class: 'xwrap' }, grid));

      // 칸이 실제로 몇 px 인지 재어 글자 크기를 맞춥니다.
      // (CSS 만으로는 '칸 크기에 비례한 글자'를 안전하게 만들 수 없습니다)
      const probe = grid.querySelector('.xcell');
      if (probe) {
        const px = probe.getBoundingClientRect().width;
        if (px > 0) grid.style.setProperty('--cellfs', Math.round(px * 0.62) + 'px');
      }


      // 글자 쟁반
      const tray = h('div', { class: 'tray', id: 'tray' });
      it.tray.forEach((ch, i) => tray.appendChild(h('button', {
        class: 'tile' + (this.usedTiles.includes(i) ? ' used' : ''),
        'data-i': i, onclick: (ev) => this.tapTile(i, ev.currentTarget)
      }, ch)));
      box.appendChild(tray);

      box.appendChild(h('div', { class: 'row', style: 'margin-top:14px;gap:12px' },
        h('button', { class: 'btn tool', style: 'flex:1', onclick: () => this.eraseWord() }, '↩ 지우기'),
        h('button', { class: 'btn tool', style: 'flex:1', onclick: () => this.nextWord() }, '⇄ 다른 낱말')));
    },

    /* ══════════════════════════════════════════════
       발자국 셈 (§12)

       발자국이 너무 헤프면 도움을 아무 생각 없이 눌러도 계속 남아돌아
       '아껴 쓸까 말까' 하는 재미가 사라집니다.
       반대로 너무 빡빡하면 막혔을 때 답답합니다.

       그래서 이렇게 맞췄습니다.
         · 도움 없이 다 맞힌 한 판 = 23개 남짓
         · 낱말 하나(10) 는 한 판 벌이의 반쯤 됩니다 → 정말 막혔을 때만
         · 글자 하나(3) 는 한 판에 서너 번까지는 넉넉합니다
         · 뜻 보기(2) 는 싸고, 20초 기다리거나 네 번 틀리면 그냥 열립니다
           → 발자국이 하나도 없어도 게임이 막히는 일은 없습니다
       ══════════════════════════════════════════════ */

    /** 발자국을 받는 곳 (한 군데로 모아 둡니다) */
    PAY: {
      word: 1,        // 혼자 힘으로 맞힌 낱말 하나
      board: 8,       // 판을 다 채웠을 때
      chapter: 20,    // 열 판(마당 하나)을 마쳤을 때
      corner: 3       // 되새김 판·속담 마당을 마쳤을 때
    },

    /* 도구 칸 — 무엇을 얼마에 쓸 수 있는지 늘 보이게 둡니다.
       ※ 광고 보고 얻기·상점·뽑기는 넣지 않습니다(DESIGN §12.1). */
    TOOLS: [
      { id: 'letter', icon: '🎯', name: '글자 하나', cost: 3, desc: '지금 낱말의 빈 칸 하나를 채워 드려요' },
      { id: 'word', icon: '✨', name: '낱말 하나', cost: 10, desc: '지금 낱말을 통째로 채워 드려요' }
    ],

    drawTools() {
      const box = $('tools'); if (!box) return;
      box.innerHTML = '';
      const isGrid = this.item && this.item.kind === 'crossword';
      const foot = Store.data.footprints;

      this.TOOLS.forEach(t => {
        if (t.id !== 'meaning' && !isGrid) return;          // 판이 아닐 땐 뜻 보기만
        const canPay = foot >= t.cost;
        box.appendChild(h('button', {
          class: 'tool-btn' + (canPay ? '' : ' poor'),
          onclick: () => this.useTool(t)
        },
          (() => { const i = h('span', { class: 'tool-ic' });
            i.innerHTML = global.UI.ICON[t.id] || ''; return i; })(),
          h('span', { class: 'tool-nm' }, t.name),
          (() => { const c = h('span', { class: 'tool-cost' });
            c.innerHTML = '<i class="chip-ic">' + global.UI.ICON.paw + '</i><b>' + t.cost + '</b>';
            return c; })()));
      });

    },

    useTool(t) {
      const d = Store.data;
      if (d.footprints < t.cost) {
        return say(`발자국이 ${t.cost}개 필요해요. 산책을 조금 더 하시면 모여요.`, '🐾');
      }
      const g = this.item.grid, w = g.words[this.wordIdx];
      const empty = this.wordCells(w).filter(k => !this.gridState[k]);
      if (!empty.length) { this.nextWord(); return; }

      d.footprints -= t.cost; Store.save();
      this.wordState(this.wordIdx).helped = true;   // 도움을 받은 낱말로 표시
      const fill = (t.id === 'word') ? empty : [empty[0]];
      fill.forEach(k => { this.gridState[k] = g.letters[k]; this.item.prefilled.push(k); });
      this.hintLevel = Math.min(3, this.hintLevel + (t.id === 'word' ? 3 : 1));
      Sound.hint();
      this.checkWords();
      this.redrawGrid();
      this.drawTools();
      App.topFootprints();
    },

    wordState(i) {
      this.wordSt = this.wordSt || {};
      if (!this.wordSt[i]) this.wordSt[i] = { since: Date.now(), tries: 0, revealed: false, helped: false };
      return this.wordSt[i];
    },



    /** 그 칸이 이미 완성된 낱말에 속하는지 */
    isCellSolved(r, c) {
      const g = this.item.grid;
      return this.solvedWords.some(wi => {
        const w = g.words[wi];
        return w.dir === 'H' ? (r === w.r && c >= w.c && c < w.c + w.len)
          : (c === w.c && r >= w.r && r < w.r + w.len);
      });
    },

    wordCells(w) {
      const K = global.Crossword.key;
      const out = [];
      for (let k = 0; k < w.len; k++) out.push(K(w.dir === 'V' ? w.r + k : w.r, w.dir === 'H' ? w.c + k : w.c));
      return out;
    },

    selectFirstUnsolved() {
      const g = this.item.grid;
      for (let i = 0; i < g.words.length; i++) {
        if (!this.solvedWords.includes(i)) { this.wordIdx = i; return; }
      }
    },

    nextWord() {
      Sound.tap();
      const g = this.item.grid;
      for (let n = 1; n <= g.words.length; n++) {
        const i = (this.wordIdx + n) % g.words.length;
        if (!this.solvedWords.includes(i)) { this.wordIdx = i; break; }
      }
      this.wordState(this.wordIdx);
      this.redrawGrid();
    },

    /** 칸을 누르면 그 칸이 속한 낱말을 고릅니다 (칸이 작아도 헤매지 않게) */
    tapCell(r, c) {
      const g = this.item.grid;
      const hits = g.words.map((w, i) => i).filter(i => {
        const w = g.words[i];
        return w.dir === 'H' ? (r === w.r && c >= w.c && c < w.c + w.len)
          : (c === w.c && r >= w.r && r < w.r + w.len);
      }).filter(i => !this.solvedWords.includes(i));
      if (!hits.length) return;
      Sound.tap();
      this.wordIdx = hits.includes(this.wordIdx) && hits.length > 1
        ? hits[(hits.indexOf(this.wordIdx) + 1) % hits.length] : hits[0];
      this.redrawGrid();
    },

    /** 쟁반 글자를 지금 낱말의 빈 칸에 넣습니다 */
    tapTile(i, el) {
      // 이미 놓은 글자를 한 번 더 누르면 도로 빼냅니다.
      // 잘못 넣었을 때 「지우기」를 찾아 누르지 않아도 되게 합니다.
      if (this.usedTiles.includes(i)) return this.pullBack(i);
      const it = this.item, g = it.grid;
      const w = g.words[this.wordIdx];
      if (!w) return;
      const cells = this.wordCells(w);
      const target = cells.find(k => !this.gridState[k]);
      if (!target) return;

      Sound.place();
      this.wordState(this.wordIdx).tries++;      // 궁리한 만큼 뜻이 빨리 열립니다
      this.gridState[target] = it.tray[i];
      this.usedTiles.push(i);
      this.tileAt = this.tileAt || {};
      this.tileAt[target] = i;                    // 어느 쟁반 글자가 들어갔는지 기억
      this.checkWords();
      this.redrawGrid();
    },

    /**
     * 쟁반 글자 하나를 도로 빼냅니다.
     * 이미 맞힌 낱말에 들어간 글자는 건드리지 않습니다.
     */
    pullBack(i) {
      this.tileAt = this.tileAt || {};
      const key = Object.keys(this.tileAt).find(k => this.tileAt[k] === i);
      if (key === undefined) return;

      // 맞힌 낱말에 속한 칸이면 그대로 둡니다
      const [r, c] = key.split(',').map(Number);
      if (this.isCellSolved(r, c)) return;

      delete this.gridState[key];
      delete this.tileAt[key];
      this.usedTiles = this.usedTiles.filter(x => x !== i);
      Sound.tap();
      this.redrawGrid();
    },

    /** 지금 낱말을 지웁니다 (미리 채워진 칸과 이미 맞힌 낱말은 그대로) */
    eraseWord() {
      Sound.tap();
      const w = this.item.grid.words[this.wordIdx];
      if (!w) return;
      this.wordCells(w).forEach(k => {
        if (this.item.prefilled.includes(k)) return;
        if (this.isCellSolvedKey(k)) return;
        const ti = this.tileAt && this.tileAt[k];
        if (ti !== undefined) { this.usedTiles = this.usedTiles.filter(x => x !== ti); delete this.tileAt[k]; }
        delete this.gridState[k];
      });
      this.redrawGrid();
    },

    isCellSolvedKey(k) {
      const [r, c] = k.split(',').map(Number);
      return this.isCellSolved(r, c);
    },

    /** 다 채워진 낱말을 검사합니다 */
    checkWords() {
      const g = this.item.grid;
      let newlySolved = false, wrong = false;
      g.words.forEach((w, i) => {
        if (this.solvedWords.includes(i)) return;
        const cells = this.wordCells(w);
        if (cells.some(k => !this.gridState[k])) return;      // 아직 덜 참
        const made = cells.map(k => this.gridState[k]).join('');
        if (made === w.surface) {
          this.solvedWords.push(i); newlySolved = true;
          const st = this.wordState(i);
          if (!st.revealed && !st.helped) {          // 뜻도 안 보고 도움도 안 받은 낱말
            this.selfSolved = (this.selfSolved || 0) + 1;
            Store.data.footprints += this.PAY.word; Store.save(); App.topFootprints();
          }
        }
        else wrong = true;
      });

      if (newlySolved) {
        Sound.right();
        const e = global.Engine.DB.byId[g.words[this.solvedWords[this.solvedWords.length - 1]].entryId];
        if (e) this.metThisGrid = (this.metThisGrid || []).concat([e]);
        this.selectFirstUnsolved();
        if (this.solvedWords.length >= g.words.length) {
          setTimeout(() => this.solvedGrid(), 600);
        }
      } else if (wrong) {
        this.miss();
        // 틀린 낱말은 부드럽게 되돌립니다 (야단치지 않습니다)
        setTimeout(() => {
          g.words.forEach((w, i) => {
            if (this.solvedWords.includes(i)) return;
            const cells = this.wordCells(w);
            if (cells.some(k => !this.gridState[k])) return;
            cells.forEach(k => {
              if (this.item.prefilled.includes(k) || this.isCellSolvedKey(k)) return;
              const ti = this.tileAt && this.tileAt[k];
              if (ti !== undefined) { this.usedTiles = this.usedTiles.filter(x => x !== ti); delete this.tileAt[k]; }
              delete this.gridState[k];
            });
          });
          this.redrawGrid();
        }, 420);
      }
    },

    redrawGrid() {
      const box = $('play'); if (!box) return;
      box.innerHTML = '';
      this.drawGrid(box);
    },

    /** 판을 다 채웠을 때 */
    solvedGrid() {
      clearTimeout(this._nudge);
      const list = this.item.entries.filter(Boolean);
      list.forEach(e => this.record(e, this.hintLevel, this.wrong, true));
      const self = this.selfSolved || 0;
      this.gridState = null;
      const praise = self >= list.length
        ? `모두 혼자 힘으로 맞히셨어요! 🐾+${self * this.PAY.word}`
        : self > 0
          ? `낱말 ${list.length}개 완성! 그중 ${self}개는 혼자 힘으로 🐾+${self * this.PAY.word}`
          : `낱말 ${list.length}개를 모두 찾으셨어요!`;
      this.praise(praise, () => { this.idx++; this.session.itemsDone++; this.renderItem(); });
    },

    /**
     * 판을 다 채웠을 때 짧게 축하만 하고 넘어갑니다.
     * 예전에는 낱말 뜻 카드를 띄웠는데, 한 판에 열다섯 낱말을 맞히고 나서
     * 그중 하나의 뜻만 보여 주는 것이라 흐름만 끊겼습니다.
     */
    praise(text, next) {
      sheet((box, close) => {
        box.appendChild(h('div', { class: 'celebrate' },
          h('div', { class: 'burst' }, global.UI.dogEl('신남', 104)),
          h('div', { class: 'big' }, text)));
        box.appendChild(h('button', {
          class: 'btn primary wide', style: 'margin-top:6px',
          onclick: () => { close(); if (next) next(); }
        }, '다음 ▸'));
      }, null);
    },

    /* ── 모드 2: 보기 고르기 ── */
    drawChoice(box) {
      const it = this.item, e = it.entry;
      const q = h('div', { class: 'qbox' });
      if (it.prompt === 'choseong') {
        q.appendChild(h('div', { class: 'qbig' }, e.choseong.split('').join(' ')));
        q.appendChild(h('div', { class: 'qsub' }, e.meaning));
      } else { // 속담
        q.appendChild(h('div', { class: 'qmid' }, e.front));
        q.appendChild(h('div', { class: 'qsub' }, '뒤에 어떤 말이 이어질까요?'));
      }
      box.appendChild(q);

      const opts = h('div', { class: 'opts', id: 'opts' });
      it.options.forEach((o, i) => opts.appendChild(h('button', {
        class: 'opt', 'data-i': i, onclick: (ev) => this.pick(o, ev.currentTarget)
      }, h('span', { class: 'mark' }, String(i + 1)), h('span', { style: 'flex:1' }, o.text))));
      box.appendChild(opts);
    },

    /* ── 모드 3: 사자성어 빈칸 ── */
    drawBlank(box) {
      const it = this.item, e = it.entry;
      const masked = [...e.surface].map((c, i) => (i === it.maskIndex ? '○' : c)).join(' ');
      box.appendChild(h('div', { class: 'qbox' },
        h('div', { class: 'qbig', id: 'blankq' }, masked),
        e.hanja ? h('div', { class: 'qsub' }, e.hanja) : null,
        h('div', { class: 'qsub' }, e.meaning)));

      const opts = h('div', { class: 'opts', id: 'opts' });
      it.options.forEach((s, i) => opts.appendChild(h('button', {
        class: 'opt', style: 'justify-content:center', 'data-i': i,
        onclick: (ev) => this.pick({ text: s, correct: s === it.correct }, ev.currentTarget)
      }, h('span', { style: 'font-size:calc(34px * var(--fs));font-weight:800' }, s))));
      box.appendChild(opts);
    },

    /** 보기를 골랐을 때 */
    pick(opt, el) {
      if (el.disabled) return;
      if (opt.correct) {
        el.classList.add('right');
        el.querySelector('.mark').textContent = '✓';
        document.querySelectorAll('#opts .opt').forEach(b => b.disabled = true);
        Sound.right();
        setTimeout(() => this.solved(this.item.entry), 520);
      } else {
        el.classList.add('wrong');
        el.querySelector('.mark').textContent = '↺';
        el.disabled = true;
        this.miss();
      }
    },

    /* ── 틀렸을 때 (DESIGN §13 예의) ── */
    miss() {
      this.wrong++;
      const t = $('typed');
      if (t) { t.classList.add('shake'); setTimeout(() => this.clearTyped(true), 260); }
      dogMood('dog', '갸웃');
      setTimeout(() => dogMood('dog', '편안함'), 1400);
      // 세 번 틀리면 먼저 도와드립니다
      if (this.wrong >= 3 && this.hintLevel === 0) {
        this.hint(true);
      }
    },

    /* ── 도와주세요 (§6.6) ── */
    hint(free) {
      if (this.hintLevel >= 3) return say('더 알려드릴 것이 없네요. 「오늘은 넘어가기」를 누르셔도 괜찮아요.');

      // 가로세로 낱말: 지금 낱말의 빈 칸 하나를 채워 드립니다
      if (this.item.kind === 'crossword') {
        this.hintLevel++;
        const g = this.item.grid, w = g.words[this.wordIdx];
        const empty = this.wordCells(w).filter(k => !this.gridState[k]);
        if (!empty.length) { this.nextWord(); return; }
        const k = empty[0];
        this.gridState[k] = g.letters[k];
        this.item.prefilled.push(k);                 // 도와드린 칸은 지워지지 않게
        this.wordState(this.wordIdx).helped = true;
        Sound.hint();
        this.checkWords();
        this.redrawGrid();
        const hb = $('hintbox');
        if (hb) hb.appendChild(h('div', { class: 'card', style: 'background:var(--tertiary-c);color:var(--on-tertiary-c)' },
          h('div', { style: 'font-weight:700' }, '💡 ' + (free ? '제가 한 번 도와드릴까요? ' : '') + `‘${g.letters[k]}’ 자리를 채워 드렸어요.`)));
        const hbtn = $('hintbtn');
        if (hbtn) hbtn.textContent = this.hintLevel >= 3 ? '💡 도움을 다 썼어요' : `💡 도와주세요 (${3 - this.hintLevel}번)`;
        return;
      }

      this.hintLevel++;
      const e = this.item.entry;
      const box = $('hintbox');
      const line = free ? '제가 한 번 도와드릴까요? ' : '';

      // 세 번째 도움: 보기를 둘로 줄여 드립니다
      if (this.hintLevel === 3 && (this.item.kind === 'choice' || this.item.kind === 'blank')) {
        const opts = [...document.querySelectorAll('#opts .opt')];
        const wrongs = opts.filter(b => !b.disabled && !b.classList.contains('right'))
          .filter(b => {
            const i = +b.dataset.i;
            const o = this.item.kind === 'blank'
              ? { correct: this.item.options[i] === this.item.correct }
              : this.item.options[i];
            return !o.correct;
          });
        wrongs.slice(0, 2).forEach(b => { b.disabled = true; b.style.opacity = '.35'; });
        box.appendChild(h('div', { class: 'card', style: 'background:var(--tertiary-c);color:var(--on-tertiary-c)' },
          h('div', { style: 'font-weight:700' }, '💡 ' + line + '보기를 둘로 줄여 드렸어요.')));
      } else {
        const text = e.hints[this.hintLevel - 1];
        box.appendChild(h('div', { class: 'card', style: 'background:var(--tertiary-c);color:var(--on-tertiary-c)' },
          h('div', { style: 'font-weight:700;word-break:keep-all' }, '💡 ' + line + text)));
      }
      Sound.tap();
      $('hintbtn').textContent = this.hintLevel >= 3 ? '💡 도움을 다 썼어요' : `💡 도와주세요 (${3 - this.hintLevel}번)`;
    },

    /* ── 넘어가기 — 언제나 무료 ── */
    skip() {
      if (this.item.kind === 'crossword') {
        const list = this.item.entries.filter(Boolean);
        list.forEach(e => this.record(e, 3, this.wrong, false));
        this.gridState = null;
        return this.card(list[0], () => { this.idx++; this.session.itemsDone++; this.renderItem(); },
          '괜찮아요. 이 낱말들은 다음에 또 만나요.');
      }
      const e = this.item.entry;
      this.record(e, 3, this.wrong, false);
      this.card(e, () => { this.idx++; this.session.itemsDone++; this.renderItem(); }, '괜찮아요. 이 낱말은 다음에 또 만나요.');
    },

    leave() {
      clearTimeout(this._nudge);
      $('tabbar').classList.remove('hidden');
      App.go('walk');
    },

    /* ── 맞혔을 때 ── */
    solved(entry) {
      clearTimeout(this._nudge);
      this.record(entry, this.hintLevel, this.wrong, true);
      const praise = ['잘하셨어요!', '맞았어요!', '역시 아시는군요!', '척척 찾으시네요!'][Math.floor(Math.random() * 4)];
      this.card(entry, () => { this.idx++; this.session.itemsDone++; this.renderItem(); }, praise);
    },

    /* ── 기록 (Elo + FSRS) ── */
    record(entry, hintLevel, wrong, solved) {
      const d = Store.data;
      const elapsed = Date.now() - this.startMs;
      const expected = 9000 + entry.len * 2600;
      const slow = elapsed > expected;
      const score = solved ? Ability.score(hintLevel, wrong, slow) : 0;

      // 다차원 실력 갱신 (§7.5) — 모드 난이도까지 반영한 체감 난이도로 계산
      const itemB = Ability.itemB(entry, this.stage.mode);
      ['GLOBAL', 'TYPE:' + entry.type, 'CAT:' + entry.category, 'MODE:' + this.stage.mode].forEach(key => {
        const a = Store.ability(key);
        a.theta = Ability.updateTheta(a.theta, a.n, itemB, score);
        a.n++;
      });
      // 세션 안 변동 제한 (§7.6)
      const g = d.ability.GLOBAL;
      g.theta = Math.max(600, Math.min(2200, g.theta));

      // 연속 좌절 보호
      this.session.last.push(score >= 0.6 ? 1 : 0);
      if (this.session.last.length > 5) this.session.last.shift();
      const acc = this.session.last.reduce((a, b) => a + b, 0) / this.session.last.length;
      if (this.session.last.length >= 4 && acc < 0.4) this.session.forceEasy = 3;
      else if (this.session.forceEasy > 0 && this.session.forceEasy < 90) this.session.forceEasy--;

      // 기억 갱신 (§8)
      const grade = FSRS.grade(hintLevel, solved, slow);
      d.memory[entry.id] = FSRS.review(d.memory[entry.id], grade, Date.now());

      // 최근 만난 낱말
      d.recent = d.recent.filter(id => id !== entry.id);
      d.recent.push(entry.id);
      // 최근 목록을 넉넉히 둡니다. 한 판에 열다섯 낱말이 나오므로
      // 60개면 겨우 네 판 분량이라 금세 같은 낱말이 다시 나왔습니다.
      // 800개면 쉰 판 남짓 동안 겹치지 않습니다.
      // (낱말이 3,889개라 이만큼 기억해도 고를 것이 넉넉합니다)
      if (d.recent.length > 800) d.recent.shift();

      // 가로세로 판은 낱말을 맞힐 때마다 이미 드렸습니다(checkWords).
      // 여기서 또 드리면 두 번 드리는 셈이 됩니다.
      if (solved && hintLevel === 0 && this.item && this.item.kind !== 'crossword') {
        d.footprints += this.PAY.word;
      }
      App.topFootprints();
      d.lastMs = Date.now();
      this.metEntries.push(entry);
      Store.save();
    },

    /* ── 낱말 카드 (§8.5) ── */
    card(e, next, praise) {
      const d = Store.data;
      sheet((box, close) => {
        if (praise) box.appendChild(h('div', { class: 'celebrate' },
          h('div', { class: 'burst' }, global.UI.dogEl('신남', 104)),
          h('div', { class: 'big' }, praise)));

        box.appendChild(h('div', { class: 'word-title' }, e.surface));
        if (e.hanja) box.appendChild(h('div', { class: 'word-hanja' }, e.hanja));

        box.appendChild(h('p', {
          class: e.hasMeaning ? '' : 'muted',
          style: 'font-size:var(--t-body);line-height:1.75;word-break:keep-all;text-align:center;margin:0 0 16px'
        }, e.clue));

        if (e.example) box.appendChild(h('details', { class: 'fold' },
          h('summary', null, '이런 때 써요'),
          h('div', { class: 'body' }, '“' + e.example + '”')));
        if (e.type === 'PROVERB') box.appendChild(h('details', { class: 'fold' },
          h('summary', null, '속담 전체'),
          h('div', { class: 'body' }, e.front + ' ' + e.back)));
        // 간직하기는 판이 끝난 뒤 낱말 목록에서 합니다.
        // 여기에도 두면 같은 일을 두 군데서 하게 되어 번거롭습니다.
        box.appendChild(h('button', {
          class: 'btn primary wide', style: 'margin-top:18px',
          onclick: () => { close(); if (next) next(); }
        }, next ? '다음 ▸' : '닫기'));
      }, null);
    },

    /* ── 산책 마침 ── */
    finish() {
      clearTimeout(this._nudge);
      const d = Store.data;
      if (!this.reviewOnly) {
        d.level++; d.totalDone++;
        const chapterDone = (d.level - 1) % 10 === 0;
        d.footprints += chapterDone ? this.PAY.chapter : this.PAY.board;
        Store.save();
      } else {
        // 되새김 판·속담 마당도 마치면 조금 드립니다
        d.footprints += this.PAY.corner;
        Store.save();
      }
      Sound.clear();

      const v = $('view'); v.innerHTML = ''; v.scrollTop = 0; global.UI.guardTaps(450);
      App.top('잘하셨어요', h('button', { class: 'iconbtn', onclick: () => this.leave() }, '← 나가기'));
      const chapterDone = !this.reviewOnly && (d.level - 1) % 10 === 0;

      v.appendChild(h('div', { class: 'celebrate' },
        h('div', { class: 'burst' }, global.UI.dogEl('신남', 104)),
        h('div', { class: 'big' }, chapterDone ? '마당 하나를 다 걸었어요!' : '산책을 마쳤어요!'),
        h('p', { class: 'muted', style: 'word-break:keep-all' },
          this.reviewOnly ? `${d.pet.name}와 함께 되새겼어요.` : `${d.pet.name}가 꼬리를 흔들어요.`)));

      v.appendChild(h('div', { class: 'card center' },
        h('div', { class: 'muted small' }, '오늘 받은 발자국'),
        h('div', { class: 'bignum' }, '🐾 ' + (this.reviewOnly ? this.PAY.corner : (chapterDone ? this.PAY.chapter : this.PAY.board))),
        h('div', { class: 'muted small' }, '모두 ' + d.footprints + '개')));

      // 다음 산책 단추는 낱말 목록보다 위에 둡니다.
      // 아래에 두면 낱말 열댓 개를 다 지나쳐 내려가야 이어서 걸을 수 있습니다.
      // 대부분은 바로 이어서 하시므로, 가장 하고 싶은 일을 손 닿는 곳에 둡니다.
      if (!this.reviewOnly) v.appendChild(h('button', {
        class: 'btn primary big wide', style: 'margin-bottom:8px', onclick: () => this.start()
      }, d.level + '번째 산책 가기'));

      /* 판이 끝난 뒤 낱말을 죽 늘어놓던 것을 없앴습니다.
         열다섯 줄이 화면을 한참 차지하는데, 정작 하시려는 일은
         다음 판으로 넘어가는 것입니다. */

      v.appendChild(h('div', { style: 'height:12px' }));
      v.appendChild(h('button', { class: 'btn tool wide', onclick: () => this.leave() }, '오늘은 여기까지 할게요'));

      // 오래 하셨으면 쉬기를 권합니다 (강요하지 않습니다)
      if (d.totalDone > 0 && d.totalDone % 12 === 0) {
        v.appendChild(h('div', { class: 'card', style: 'background:var(--sunshine);color:var(--on-sunshine);margin-top:16px' },
          h('div', { style: 'font-weight:700;word-break:keep-all' }, '우리 잠깐 쉬었다 할까요? 물도 한 잔 드시고요.')));
      }
    }
  };

  global.Game = Game;
})(window);
