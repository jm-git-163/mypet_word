/* ============================================================
   app.js — 앱 뼈대: 저장 · 화면 이동 · 설정 · 소리 · 첫 인사
   ============================================================ */
(function (global) {
  'use strict';
  const { DB, FSRS, Generator, NEIGHBORHOODS, DAY } = global.Engine;
  const H = global.Hangul;
  const KEY = 'nanmal-sanchaek-v1';

  /* ══════════ 저장소 ══════════════════════════════ */
  const Store = {
    data: null,
    fresh() {
      return {
        v: 1,
        trackId: Math.floor(Math.random() * 9000) + 1000,
        level: 1, footprints: 15, totalDone: 0,
        firstMs: Date.now(), lastMs: 0, days: [],
        ability: { GLOBAL: { theta: 1200, n: 0 } },
        memory: {}, fav: [], recent: [],
        pet: { name: '해운이', bond: 1 },
        onboarded: false,
        settings: {
          fs: 1, sfx: true, bgm: true, hue: 'auto', gentle: false, theme: 'light', contrast: false, motion: false,
          // 맞춤 보기 — 여쭤보고 동의하실 때만 씁니다. null=아직 안 여쭘, true=맞춤, false=전체 보기
          personalize: null,
          // 맞춤에 쓰는 항목 — 이 기기에만 저장되고 밖으로 나가지 않습니다
          interests: [], ageBand: null, dong: null
        }
      };
    },
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        // 기본값을 먼저 따로 떠 둡니다.
        // Object.assign(base, saved) 는 base 를 고쳐 버리므로,
        // 나중에 base.settings 를 봐도 이미 저장된 값으로 바뀌어 있습니다.
        const def = this.fresh();
        this.data = raw ? Object.assign(this.fresh(), JSON.parse(raw)) : def;
        // 저장된 settings·pet 은 통째로 갈아끼워집니다. 그대로 두면
        // 나중에 더한 항목이 undefined 로 남아 화면에 그대로 찍힙니다
        // (「유대 undefined단계」가 그 경우였습니다).
        this.data.settings = Object.assign({}, def.settings, this.data.settings || {});
        this.data.pet = Object.assign({}, def.pet, this.data.pet || {});
        if (!this.data.ability.GLOBAL) this.data.ability.GLOBAL = { theta: 1200, n: 0 };

        // 배경음을 기본으로 켜 드립니다 (딱 한 번).
        // 예전에는 꺼진 채로 시작해서, 있는 줄도 모르고 지나치셨습니다.
        // 한 번 켜 드린 뒤 끄시면 그 뜻을 그대로 지킵니다.
        if (!this.data.settings.bgmDefaultOn) {
          this.data.settings.bgm = true;
          this.data.settings.bgmDefaultOn = true;
          this.save();
        }
      } catch (e) { this.data = this.fresh(); }
      return this.data;
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { } },
    /** 오늘 방문 기록 */
    touchToday() {
      const today = new Date().toISOString().slice(0, 10);
      const d = this.data;
      if (!d.days.includes(today)) {
        d.days.push(today);
        if (d.days.length > 400) d.days = d.days.slice(-400);
        d.footprints += 10;                        // 오늘 첫 방문 선물
        d.pet.bond = Math.min(50, 1 + Math.floor(d.days.length / 3));  // 유대는 '함께한 날'로만
        this.save();
        return true;
      }
      return false;
    },
    ability(key) { return (this.data.ability[key] = this.data.ability[key] || { theta: this.data.ability.GLOBAL.theta, n: 0 }); }
  };

  /* ══════════ 소리 ════════════════════════════════
     실제 소리 만들기는 js/bgm.js(Audio2) 가 맡습니다.
     오답에는 소리를 내지 않습니다 (DESIGN §13).
     ══════════════════════════════════════════════ */
  const Sound = {
    tap() { global.Audio2.tap(); },
    place() { global.Audio2.place(); },
    right() { global.Audio2.word(); },
    hint() { global.Audio2.hint(); },
    clear() { global.Audio2.clear(); },
    bark() { global.Audio2.bark(); },
    chirp() { global.Audio2.chirp(); },
    eat() { global.Audio2.eat(); }
  };

  /* ══════════ 화면 도구 ══════════════════════════ */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== false && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    }
    kids.flat().forEach(c => { if (c === null || c === undefined || c === false) return; e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); });
    return e;
  }
  const $ = id => document.getElementById(id);

  /**
   * 오터치 막기 (DESIGN §4.4)
   * 화면이 새로 그려진 직후 손가락이 그대로 놓여 있으면
   * 바로 아래 놓인 단추가 저절로 눌립니다. 잠깐 손길을 받지 않습니다.
   */
  let tapGuardUntil = 0;
  function guardTaps(ms) {
    const v = $('view'); if (!v) return;
    tapGuardUntil = Date.now() + (ms || 320);
    v.style.pointerEvents = 'none';
    clearTimeout(guardTaps._t);
    guardTaps._t = setTimeout(() => { v.style.pointerEvents = ''; }, ms || 320);
  }
  /**
   * 누른 자리에서 물결이 번지게 합니다.
   * 어르신께는 '내가 눌렀다'는 확인이 특히 중요합니다.
   */
  document.addEventListener('pointerdown', ev => {
    if (Store.data && Store.data.settings.motion) return;      // 움직임 줄이기
    const el = ev.target.closest('.btn, .tile, .opt, .tool-btn, .list-item, .xcell:not(.gap):not(.done)');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const d = Math.max(r.width, r.height);
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.width = s.style.height = d + 'px';
    s.style.left = (ev.clientX - r.left - d / 2) + 'px';
    s.style.top = (ev.clientY - r.top - d / 2) + 'px';
    el.appendChild(s);
    setTimeout(() => s.remove(), 560);
  }, true);

  /** 같은 자리 연속 터치 무시 (손떨림 보정) */
  let lastTap = { x: -99, y: -99, t: 0 };
  document.addEventListener('click', ev => {
    if (Date.now() < tapGuardUntil) { ev.stopPropagation(); ev.preventDefault(); return; }
    const now = Date.now();
    if (now - lastTap.t < 220 && Math.abs(ev.clientX - lastTap.x) < 24 && Math.abs(ev.clientY - lastTap.y) < 24) {
      ev.stopPropagation(); ev.preventDefault(); return;
    }
    lastTap = { x: ev.clientX, y: ev.clientY, t: now };
  }, true);

  /**
   * 지금 쓸 빛깔 이름.
   * 「산책마다」로 두시면 산책 한 판이 끝날 때마다 빛깔이 바뀝니다.
   * 백 걸음마다 바뀌게 두었더니 한참을 같은 색으로 걸어야 했습니다.
   * (풍경의 생김새는 동네가 정하므로, 색만 매 판 바뀌고 땅은 그대로입니다)
   */
  function hueNow() {
    const s = Store.data.settings;
    if (s.hue && s.hue !== 'auto') return s.hue;
    // 이웃한 판끼리 비슷한 색이 이어지지 않도록 일곱 칸씩 건너뜁니다.
    // 건너뛰는 수와 빛깔 수(15)가 서로 나누어지지 않아야 열다섯 빛깔을 모두 돕니다.
    const i = ((Store.data.level - 1) * 7) % HUES.length;
    return HUES[i][0];
  }

  function applySettings() {
    const s = Store.data.settings;
    document.documentElement.style.setProperty('--fs', s.fs);
    // 빛깔 한 벌만 남기고 나머지는 벗깁니다
    HUES.forEach(([id]) => document.body.classList.remove('t-' + id));
    document.body.classList.add('t-' + hueNow());
    document.body.classList.toggle('dark', s.theme === 'dark');
    document.body.classList.toggle('contrast', !!s.contrast);
    document.body.classList.toggle('reduce-motion', !!s.motion);
    if (global.Theme) global.Theme.apply(Store.data.level);   // 배경도 함께 맞춥니다
  }

  /* ── 아래에서 올라오는 창 ── */
  function sheet(buildInner, onClose) {
    const back = h('div', { class: 'sheet-back' });
    const box = h('div', { class: 'sheet' }, h('div', { class: 'grip' }));
    buildInner(box, close);
    back.appendChild(box);
    back.addEventListener('click', e => { if (e.target === back) close(); });
    document.body.appendChild(back);
    function close() { back.remove(); if (onClose) onClose(); }
    return close;
  }

  function say(msg, emoji) {
    sheet((box, close) => {
      // 안내창에도 같은 강아지가 나옵니다.
      // 화면마다 다른 그림이 나오면 '한 마리'로 느껴지지 않습니다.
      box.appendChild(emoji && emoji !== '🐕'
        ? h('div', { class: 'center', style: 'font-size:calc(56px * var(--fs))' }, emoji)
        : h('div', { class: 'center' }, dogEl('갸웃', 96, 'saydog')));
      box.appendChild(h('p', { class: 'center', style: 'font-size:calc(23px * var(--fs));font-weight:700;word-break:keep-all' }, msg));
      box.appendChild(h('button', { class: 'btn primary wide', onclick: close }, '알겠어요'));
    });
  }

  /**
   * 이름 지어 주기 창.
   * 브라우저의 prompt() 창은 앱으로 설치해 쓰면 아예 뜨지 않는 일이 있고,
   * 떠도 글씨가 작아 읽기 어렵습니다. 그래서 앱 안에서 직접 받습니다.
   * @param cur 지금 이름
   * @param cb  새 이름을 받을 곳
   */
  function askName(cur, cb) {
    sheet((box, close) => {
      box.appendChild(h('div', { class: 'center' }, dogEl('반가움', 96, 'namedog')));
      box.appendChild(h('h2', { class: 'center', style: 'margin:6px 0 4px' }, '이름을 지어 주세요'));
      box.appendChild(h('p', { class: 'muted center', style: 'margin:0 0 14px' }, '여덟 글자까지 쓸 수 있어요.'));

      const input = h('input', {
        class: 'namefield', type: 'text', maxlength: '8',
        value: cur || '', 'aria-label': '갈매기 이름',
        placeholder: '예) 해운이'
      });
      box.appendChild(input);

      // 고르기만 해도 되도록 미리 지은 이름을 함께 놓습니다
      const chips = h('div', { class: 'chips' });
      ['해운이', '바다', '파도', '갈매기', '모래', '구름', '달이', '별이'].forEach(n =>
        chips.appendChild(h('button', {
          class: 'chip', onclick: () => { input.value = n; Sound.tap(); }
        }, n)));
      box.appendChild(chips);

      const done = () => {
        const n = (input.value || '').trim().slice(0, 8);
        if (!n) { input.focus(); return; }
        close(); Sound.right(); cb(n);
      };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') done(); });
      box.appendChild(h('div', { class: 'row', style: 'margin-top:16px' },
        h('button', { class: 'btn tool', onclick: close }, '그만두기'),
        h('button', { class: 'btn primary grow', onclick: done }, '이 이름으로 할게요')));

      setTimeout(() => { input.focus(); input.select(); }, 120);
    });
  }

  /* 아이콘을 그리는 틀 — 아래 여러 곳에서 씁니다.
     const 는 선언보다 먼저 쓸 수 없으므로 반드시 맨 위에 둡니다. */
  /* 관심 주제 칩 ↔ 게시판이 붙이는 분류.
     칩은 어르신께 익숙한 말로, 분류는 기관이 쓰는 말로 되어 있어
     하나의 칩이 여러 갈래를 아우릅니다. */
  const INTEREST_MAP = {
    '복지': ['복지'],
    '건강': ['건강'],
    '안전': ['안전'],
    '나들이': ['행사', '관광', '문화'],
    '배움': ['교육'],
    '일자리': ['일자리', '창업'],
    '교통': ['교통'],
    '살림': ['주거', '환경', '세금', '생활']
  };

  const TAB_NAME = { walk: '산책', hood: '동네', pet: '갈매기', learn: '해운대', set: '설정' };

  /* 나에게 맞는 정보를 고르는 데 쓰는 항목.
     이름·주민번호 같은 것은 받지 않습니다. 나이대와 사는 동네만, 그것도 이 기기 안에만 둡니다. */
  const AGE_BANDS = [['under65', '65세 미만'], ['65-74', '65~74세'], ['75-84', '75~84세'], ['85+', '85세 이상']];
  const DONG = ['우1동', '우2동', '우3동', '중1동', '중2동', '좌1동', '좌2동', '좌3동', '좌4동',
    '송정동', '반여1동', '반여2동', '반여3동', '반여4동', '반송1동', '반송2동', '재송1동', '재송2동'];
  const SVG = (inner) =>
    `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none"
       stroke="currentColor" stroke-width="2" stroke-linecap="round"
       stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

  /* 마당의 상태 — 지남 / 지금 여기 / 아직
     ⬜ 같은 이모지는 그냥 네모로 보여 무슨 뜻인지 알 수 없습니다. */
  const STEP_ICON = {
    done: SVG('<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/>' +
      '<path d="M8 12.3l2.6 2.6L16 9.6" stroke="var(--white)" stroke-width="2.2"/>'),
    // 갈매기 물갈퀴 발자국 — 강아지 발바닥(패드+발가락)이 아닙니다
    here: SVG('<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/>' +
      '<g transform="translate(12 12) scale(0.62) translate(-12 -12)" fill="var(--white)" stroke="none">' +
      '<path d="M12 3.6 C10.4 8 7.8 9.8 4.4 10.9 C7.4 13.4 10 15.2 12 20 C14 15.2 16.6 13.4 19.6 10.9 C16.2 9.8 13.6 8 12 3.6 Z"/>' +
      '<circle cx="12" cy="3.8" r="1.5"/><circle cx="4.5" cy="11" r="1.4"/><circle cx="19.5" cy="11" r="1.4"/>' +
      '</g>'),
    todo: SVG('<circle cx="12" cy="12" r="8.4" stroke-dasharray="3 3.4" opacity=".75"/>')
  };

  /* 고를 수 있는 빛깔 — [이름표, 보이는 이름, 동그라미 색] */
  const HUES = [
    ['coral', '감빛', '#ef8f22'],
    ['apricot', '살구', '#e0975a'],
    ['sunset', '노을', '#dd6a7e'],
    ['plum', '자두', '#b3688b'],
    ['lavender', '라벤더', '#8c78bd'],
    ['sky', '하늘', '#6089c2'],
    ['ocean', '바다', '#4595b0'],
    ['mint', '민트', '#45a08e'],
    ['forest', '숲', '#57a86c'],
    ['olive', '올리브', '#8d9c52'],
    ['clay', '흙', '#a98953'],
    ['cocoa', '코코아', '#a67464'],
    ['canola', '유채', '#c9ae3c'],
    ['hydrangea', '수국', '#6f7bc4'],
    ['magnolia', '자목련', '#b06bb8']
  ];

  /* ══════════ 아래 띠 아이콘 ══════════════════════
     이모지(🏡🐕📖⚙️) 대신 직접 그립니다.
     이모지는 기기마다 그림·색·굵기가 달라 한 벌로 보이지 않고,
     그것이 화면이 어수선해 보이는 가장 큰 까닭이었습니다.
     여기서는 굵기 2, 크기 24 로 통일해 한 손에서 그린 것처럼 만듭니다.
     ══════════════════════════════════════════════ */
  /* 놀이 화면에서도 쓰는 아이콘 */
  const ICON = {
    // 갈매기 물갈퀴 발자국 — 강아지 발바닥(패드+발가락)이 아닙니다
    paw: SVG('<path d="M12 3.6 C10.4 8 7.8 9.8 4.4 10.9 C7.4 13.4 10 15.2 12 20 C14 15.2 16.6 13.4 19.6 10.9 C16.2 9.8 13.6 8 12 3.6 Z" fill="currentColor" stroke="none"/>' +
      '<circle cx="12" cy="3.8" r="1.5" fill="currentColor" stroke="none"/>' +
      '<circle cx="4.5" cy="11" r="1.4" fill="currentColor" stroke="none"/>' +
      '<circle cx="19.5" cy="11" r="1.4" fill="currentColor" stroke="none"/>' +
      '<path d="M12 19.4 L12 22.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>'),
    // 글자 하나 — 과녁
    letter: SVG('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>' +
      '<circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>'),
    // 낱말 하나 — 반짝임
    word: SVG('<path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9Z"/>' +
      '<path d="M18.5 15.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7Z"/>'),
    // 소리 켜짐 / 꺼짐
    sound: SVG('<path d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4Z"/>' +
      '<path d="M16 9.4a3.6 3.6 0 0 1 0 5.2"/><path d="M18.4 7a7 7 0 0 1 0 10"/>'),
    mute: SVG('<path d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4Z"/><path d="m16.5 10 4 4M20.5 10l-4 4"/>')
  };

  const TAB_ICON = {
    // 갈매기 발자국 — 산책
    // 물갈퀴가 세 발가락 사이를 잇습니다. 강아지 발바닥(패드+발가락)과는 모양이 아주 다릅니다.
    // 뒤꿈치 하나에서 발가락 셋이 뻗고, 그 사이를 물갈퀴가 잇습니다.
    // 작게 줄여도 '물갈퀴'가 보이도록 사이를 깊게 파 두었습니다.
    walk: SVG('<path d="M12 20.4 L4.9 6.6 Q9.4 11.8 12 4.6 Q14.6 11.8 19.1 6.6 Z"' +
      ' fill="currentColor" stroke="none"/>' +
      '<path d="M12 20.2 v2.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/>'),
    // 집 — 동네
    hood: SVG('<path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.6V19h11V9.6"/><path d="M10 19v-4.5h4V19"/>'),
    // 갈매기 — 마스코트 탭
    pet: SVG('<path d="M3 12c3 0 4-2.4 6-2.4S12 12 12 12s1-2.4 3-2.4S18 12 21 12"/>' +
      '<path d="M12 12c0 3 1.4 5.4 4 6.6"/>' +
      '<path d="M16 18.6c-1.2.3-2.6.4-4 .4"/>'),
    // 두루마리 — 속담
    learn: SVG('<path d="M7 4h10a2.4 2.4 0 0 1 2.4 2.4v11.2A2.4 2.4 0 0 1 17 20H7"/>' +
      '<path d="M7 4a2.4 2.4 0 0 0-2.4 2.4c0 1.3 1 2.4 2.4 2.4h2.2"/>' +
      '<path d="M7 20a2.4 2.4 0 0 0 2.4-2.4c0-1.3-1-2.4-2.4-2.4"/>' +
      '<path d="M12 9.6h4M12 13.2h4"/>'),
    // 톱니 — 설정
    set: SVG('<circle cx="12" cy="12" r="3.1"/>' +
      '<path d="M12 3.6v2.2M12 18.2v2.2M20.4 12h-2.2M5.8 12H3.6' +
      'M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6M18.1 18.1l-1.6-1.6M7.5 7.5 5.9 5.9"/>')
  };

  /* ══════════ 강아지 ══════════════════════════════ */
  const DOG_FACES = { 반가움: '🐕', 편안함: '🐶', 갸웃: '🐕‍🦺', 신남: '🐩', 보고싶음: '🐕' };

  /**
   * 갈매기 발자국 하나 (물갈퀴 자국).
   * 이모지는 작게 쓰면 무엇인지 알아보기 어려워 직접 그립니다.
   * @param state 'on'(지나옴) | 'now'(지금 여기) | ''(아직)
   */
  function paw(state) {
    const el = h('span', { class: 'paw' + (state ? ' ' + state : ''), 'aria-hidden': 'true' });
    el.innerHTML =
      '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor">' +
      // 물갈퀴 — 발가락 셋 사이가 이어진 갈매기 발자국
      '<path d="M12 3.6 C10.4 8 7.8 9.8 4.4 10.9 C7.4 13.4 10 15.2 12 20 C14 15.2 16.6 13.4 19.6 10.9 C16.2 9.8 13.6 8 12 3.6 Z"/>' +
      '<circle cx="12" cy="3.8" r="1.5"/><circle cx="4.5" cy="11" r="1.4"/><circle cx="19.5" cy="11" r="1.4"/>' +
      // 뒷발가락
      '<path d="M12 19.4 L12 22.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
      '</svg>';
    return el;
  }

  /** 움직이는 강아지 하나 (그림 파일이 아니라 그려서 움직입니다) */
  // 마스코트는 이제 '부산 갈매기'입니다. (강아지 그림 대신 갈매기를 그립니다)
  function dogEl(mood, size, id, opts) {
    const box = h('div', { class: 'dog', id: id || 'dog' });
    box.innerHTML = global.Gull.make(mood, size || 96, opts);
    return box;
  }

  /* 해운대 갈매기 — 소식을 전해 주는 안내자입니다.
     부산 상징(갈매기)을 앱 그림체로 새로 그린 원본입니다.
     ※ 부산시 공식 캐릭터 '부기'를 쓰려면 공공누리(출처표시) 규정에 따라
       official 이미지를 images/ 에 넣고 이 함수만 바꾸면 됩니다. */
  function gullSVG(size) {
    const s = size || 64;
    return `<svg viewBox="0 0 100 100" width="${s}" height="${s}" aria-hidden="true">
      <ellipse cx="50" cy="88" rx="18" ry="4" fill="#000" opacity=".06"/>
      <path d="M28 54 q-16 -6 -22 6 q14 2 22 7 Z" fill="#eef3f5" stroke="#dbe4e8" stroke-width="1.5"/>
      <path d="M72 54 q16 -6 22 6 q-14 2 -22 7 Z" fill="#eef3f5" stroke="#dbe4e8" stroke-width="1.5"/>
      <ellipse cx="50" cy="58" rx="24" ry="20" fill="#ffffff" stroke="#dbe4e8" stroke-width="2"/>
      <path d="M32 50 q18 -9 36 0 q-18 6 -36 0 Z" fill="#cfd8dd" opacity=".85"/>
      <circle cx="50" cy="35" r="15" fill="#ffffff" stroke="#dbe4e8" stroke-width="2"/>
      <path d="M50 33 l17 5 l-17 5 Z" fill="#f6a623"/>
      <circle cx="45" cy="33" r="2.7" fill="#33414a"/>
      <circle cx="46" cy="32" r="1" fill="#fff"/>
      <path d="M44 77 v6 M56 77 v6" stroke="#f6a623" stroke-width="2.6" fill="none"/>
    </svg>`;
  }
  function gullEl(size) {
    const box = h('div', { class: 'gull' });
    box.innerHTML = gullSVG(size);
    return box;
  }

  /* 해운대 삽화 한 장 (그림 우월효과 — 글보다 오래 기억됩니다) */
  function illEl(key) {
    const svg = (global.Haeundae && global.Haeundae.ILLUST[key]) || '';
    const box = h('div', { style: 'width:100%;aspect-ratio:100/72;overflow:hidden' });
    box.innerHTML = svg;
    const s = box.firstChild;
    if (s) { s.setAttribute('width', '100%'); s.setAttribute('height', '100%'); s.setAttribute('preserveAspectRatio', 'xMidYMid slice'); }
    return box;
  }

  /* 읽어주기 — 눈이 어두우시거나 글이 어려운 분을 위해 소리로 읽어 드립니다.
     기기에 내장된 음성(Web Speech)을 쓰므로 따로 받을 것이 없습니다. */
  function stopSpeak() { try { if (global.speechSynthesis) global.speechSynthesis.cancel(); } catch (e) { } }
  function resetReadButtons() { document.querySelectorAll('.readbtn').forEach(b => b.textContent = '🔊 읽어주기'); }
  function speakToggle(btn, text) {
    const synth = global.speechSynthesis;
    if (!synth) return say('이 기기에서는 읽어주기가 안 돼요.', '🔊');
    if (synth.speaking) { stopSpeak(); resetReadButtons(); if (btn.dataset.on === '1') { btn.dataset.on = ''; return; } }
    resetReadButtons();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = 0.92;
    u.onend = () => { btn.textContent = '🔊 읽어주기'; btn.dataset.on = ''; };
    btn.textContent = '⏹ 멈추기'; btn.dataset.on = '1';
    synth.speak(u);
  }

  /* '해운대 알아두기' 카드 — 삽화 + 쉬운 요지 + 좋은점 + 이렇게하세요 (+읽어주기·맞춤배지) */
  /* 소식을 카톡으로 건네 드립니다.
     어르신들 사이에서 좋은 정보는 카톡으로 오갑니다.
     "이거 봐라" 하고 넘기지 못하면 앱 안에 갇힌 정보가 됩니다.
     · 휴대전화 — 브라우저가 주는 공유창(카톡·문자·메일)을 띄웁니다.
     · 컴퓨터   — 공유창이 없으므로 글을 복사해 드립니다. */
  function shareNotice(n) {
    const body = String(n.body || '').replace(/…$/, '').trim();
    const text = `[해운대 소식 · ${n.cat}] ${n.title}\n\n${body}\n\n` +
      (n.sourceUrl ? `자세히 보기 ▶ ${n.sourceUrl}\n` : '') +
      `(출처 ${n.source})`;

    if (navigator.share) {
      navigator.share({ title: n.title, text, url: n.sourceUrl || location.href })
        .catch(() => { /* 어르신이 그냥 닫으신 경우입니다 */ });
      return;
    }
    const done = () => say('글을 복사했어요. 카톡 대화창에 붙여 넣으세요.', '💬');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }

  /** 클립보드가 막힌 브라우저를 위한 옛 방식 */
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); }
    catch (e) { say('복사가 막혀 있어요. 글을 길게 눌러 복사해 주세요.', '💬'); }
    ta.remove();
  }

  function guideCard(g, m) {
    const CAT = { 복지: '🧡', 건강: '🩺', 안전: '🛡️', 생활: '🏠', 나들이: '🚶' };
    const readText = `${g.title}. 쉽게 풀면, ${g.lead} 이렇게 하세요. ${(g.how || []).join('. ')}`;
    return h('div', { class: 'card', style: 'text-align:left;padding:0;overflow:hidden' },
      illEl(g.ill),
      h('div', { style: 'padding:12px 14px 14px' },
        h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px' },
          h('span', { class: 'badge warm' }, (CAT[g.cat] || '📌') + ' ' + g.cat),
          (m && m.mine) ? h('span', { class: 'badge green' }, '✅ 나에게 맞는 정보') : null),
        h('h3', { style: 'margin:8px 0 5px' }, g.title),
        (m && m.mine && m.reasons.length)
          ? h('p', { class: 'muted small', style: 'margin:0 0 6px' }, m.reasons.join(' · ') + ' 에 해당돼요')
          : null,
        h('p', { style: 'margin:0 0 4px;line-height:1.75;word-break:keep-all;font-weight:700' }, '쉽게 풀면 — ' + g.lead),
        h('p', { class: 'muted small', style: 'margin:0 0 10px;word-break:keep-all' }, '💡 ' + g.good),
        g.official ? h('details', { class: 'fold', style: 'margin:0 0 10px' },
          h('summary', null, '📋 공식 안내 원문 보기'),
          h('div', { class: 'muted', style: 'padding:8px 2px 2px;line-height:1.7;word-break:keep-all;font-size:14px' }, g.official)) : null,
        h('div', { style: 'background:rgba(0,0,0,.05);border-radius:12px;padding:11px 13px' },
          h('b', null, '이렇게 하세요'),
          h('ol', { style: 'margin:7px 0 0;padding-left:20px;line-height:1.85' },
            ...g.how.map(s => h('li', { style: 'word-break:keep-all' }, s)))),
        h('button', {
          class: 'btn tool wide readbtn', style: 'margin-top:10px',
          onclick: (e) => speakToggle(e.currentTarget, readText)
        }, '🔊 읽어주기'),
        g.source
          ? h('div', { style: 'margin-top:10px;text-align:right' },
            g.sourceUrl
              ? h('a', {
                class: 'muted small', href: g.sourceUrl, target: '_blank', rel: 'noopener noreferrer',
                style: 'text-decoration:underline', onclick: () => Sound.tap()
              }, '출처 · ' + g.source)
              : h('span', { class: 'muted small' }, '출처 · ' + g.source))
          : null));
  }

  /** 강아지 + 말풍선 한 줄 */
  function dogBlock(mood, line) {
    // 강아지를 116 → 88 로 줄였습니다.
    // 인사말 한 줄에 화면 위쪽을 통째로 내주고 있었습니다.
    // 말풍선은 글자 길이만큼만 벌어지게 합니다.
    // 늘 폭을 가득 채우면 「오후에도 반가워요!」 한마디에도
    // 상자가 화면 끝까지 늘어나 허전해 보입니다.
    return h('div', { class: 'dog-area' },
      dogEl(mood, 88),
      line ? h('div', { class: 'speech' }, line) : null);
  }

  /** 표정 바꾸기 */
  function dogMood(id, mood, size, opts) {
    const box = $(id || 'dog');
    if (box) box.innerHTML = global.Gull.make(mood, size || 96, opts);
  }

  /* ══════════ 화면들 ══════════════════════════════ */
  const App = {
    tab: 'walk',
    mount() {
      Store.load(); applySettings(); DB.build();
      global.Theme.apply(Store.data.level);
      // 소리는 사용자가 화면을 한 번 누른 뒤에야 시작할 수 있습니다(브라우저 규칙)
      const wake = () => { global.Audio2.resume(); global.Audio2.sync(); document.removeEventListener('pointerdown', wake); };
      document.addEventListener('pointerdown', wake);
      document.body.appendChild(h('div', { id: 'app' },
        h('div', { class: 'topbar', id: 'topbar' }),
        h('div', { class: 'scroll', id: 'view' }),
        h('nav', { class: 'tabbar', id: 'tabbar' })
      ));
      this.renderTabs();
      this.loadFeed();   // 실시간 정보 피드를 받아 옵니다(백그라운드)
      if (!Store.data.onboarded) this.onboarding();
      else { Store.touchToday(); this.go('walk'); }
    },

    renderTabs() {
      const tabs = ['walk', 'hood', 'pet', 'learn', 'set'];
      const bar = $('tabbar'); bar.innerHTML = '';
      tabs.forEach(id => {
        const btn = h('button', {
          class: (this.tab === id ? 'on ' : '') + (id === 'walk' ? 'mid' : ''),
          'aria-label': TAB_NAME[id], onclick: () => { Sound.tap(); this.go(id); }
        });
        const ic = h('span', { class: 'ic' });
        ic.innerHTML = TAB_ICON[id];
        btn.appendChild(ic);
        btn.appendChild(h('span', null, TAB_NAME[id]));
        bar.appendChild(btn);
      });
      // 나가기 — 화면마다 「설정」까지 들어가지 않아도 바로 끝낼 수 있게
      // 아래 메뉴줄에 늘 있게 둡니다. 다른 칸과 달리 화면을 바꾸지 않고
      // 곧바로 끝내므로 '선택된 칸(on)' 표시는 하지 않습니다.
      {
        const btn = h('button', {
          'aria-label': '나가기', onclick: () => { Sound.tap(); this.quit(); }
        });
        const ic = h('span', { class: 'ic' });
        ic.innerHTML = SVG('<path d="M15 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8"/>' +
          '<path d="M11 12h9m0 0-3.5-3.5M20 12l-3.5 3.5"/>');
        btn.appendChild(ic);
        btn.appendChild(h('span', null, '나가기'));
        bar.appendChild(btn);
      }
    },

    go(tab) {
      stopSpeak();   // 화면을 옮기면 읽어주던 소리는 멈춥니다
      // 놀이 중에 아래 메뉴를 누르셨으면 판을 정리하고 나옵니다.
      // 하단 메뉴를 늘 보이게 두었으므로 이 길로도 나가실 수 있습니다.
      if (document.body.classList.contains('playing')) {
        document.body.classList.remove('playing');
        if (global.Game && global.Game.stopHere) global.Game.stopHere();
      }
      this.tab = tab;
      this.renderTabs();
      const v = $('view'); v.innerHTML = ''; v.scrollTop = 0;
      ({ walk: this.scrWalk, hood: this.scrHood, pet: this.scrPet, learn: this.scrLearn, set: this.scrSet })[tab].call(this, v);
      guardTaps();
    },

    /** 위 띠의 발자국 숫자를 새로 적습니다 */
    topFootprints() {
      const el = document.getElementById('footchip');
      if (el) el.innerHTML = paw('on').outerHTML.replace('class="paw on"', 'class="paw on" style="width:16px;height:16px;vertical-align:-3px;margin-right:3px"') + Store.data.footprints;
    },

    /**
     * 소리 켜기·끄기 단추.
     * 어느 화면에서든 곧바로 끌 수 있어야 합니다.
     * (조용해야 하는 자리에서 놀이 화면까지 들어가 끄게 하면 안 됩니다)
     */
    soundBtn() {
      const paint = (btn) => {
        const s = Store.data.settings;
        const on = s.sfx || s.bgm;
        btn.innerHTML = '<i class="chip-ic">' + (on ? ICON.sound : ICON.mute) + '</i>';
        btn.setAttribute('aria-label', on ? '소리 끄기' : '소리 켜기');
        btn.classList.toggle('off', !on);
      };
      const btn = h('button', {
        class: 'iconbtn soundbtn', id: 'soundbtn',
        onclick: () => {
          const s = Store.data.settings;
          const on = s.sfx || s.bgm;
          s.sfx = !on;
          if (!on) { if (s.bgmWasOn) s.bgm = true; }
          else { s.bgmWasOn = s.bgm; s.bgm = false; }
          Store.save(); global.Audio2.sync(); paint(btn);
        }
      });
      paint(btn);
      return btn;
    },

    /**
     * 위 띠.
     * 오른쪽 자리에는 화면마다 다른 것이 오는데,
     * 소리 단추만은 늘 함께 붙입니다.
     */
    top(title, left, right) {
      const t = $('topbar'); t.innerHTML = '';
      t.appendChild(left || h('div', { class: 'spacer' }));
      // 제목을 누르면 언제든 첫 화면으로 돌아옵니다
      t.appendChild(h('h1', {
        class: 'homelink', role: 'button', tabindex: '0',
        title: '첫 화면으로', 'aria-label': title + ' — 첫 화면으로',
        onclick: () => { Sound.tap(); if (global.Game) global.Game.stage = null; this.tab = null; this.go('walk'); }
      }, title));
      const box = h('div', { class: 'row topright' });
      if (right) box.appendChild(right);
      box.appendChild(this.soundBtn());
      t.appendChild(box);
    },

    /* ── 산책 (홈) ── */
    scrWalk(v) {
      const d = Store.data;
      // 도움말은 동그란 단추 하나로 둡니다.
      // 「？도움말」처럼 글자가 길면 왼쪽 빈자리(64px)보다 넓어져
      // 가운데 있어야 할 제목이 왼쪽으로 밀립니다 — 그게 눈에 거슬립니다.
      this.top('낱말 산책', null,
        h('button', { class: 'helpbtn', 'aria-label': '도움말 보기', onclick: () => this.help() }, '？'));
      const due = Generator.dueEntries(d, Date.now()).length;
      const hood = NEIGHBORHOODS[Math.floor((d.level - 1) / 100) % NEIGHBORHOODS.length];
      const step = ((d.level - 1) % 10) + 1;

      const scene = global.Theme.apply(d.level);
      v.appendChild(dogBlock('반가움', this.greet()));
      v.appendChild(h('div', { class: 'card center' },
        h('div', { class: 'hood-tag' }, hood.name),
        h('div', { style: 'font-size:calc(34px * var(--fs));font-weight:800;line-height:1.4;margin:6px 0 10px' },
          d.level + '번째 산책'),
        h('div', { class: 'steps' }, Array.from({ length: 10 }, (_, i) =>
          paw(i < step - 1 ? 'on' : (i === step - 1 ? 'now' : '')))),
        h('div', { class: 'muted small', style: 'margin:8px 0 16px' }, `마당 ${Math.floor((d.level - 1) / 10) + 1} · ${11 - step}걸음 남았어요`),
        h('button', { class: 'btn primary big wide', onclick: () => global.Game.start() },
          d.totalDone === 0 ? '산책 나가기' : '이어서 산책하기')
      ));

      if (due > 0) v.appendChild(h('div', { class: 'card' },
        h('h2', null, '되새길 낱말이 있어요'),
        h('p', { class: 'muted', style: 'margin:0 0 14px' }, `지난번에 만난 낱말 ${due}개를 다시 볼까요?`),
        h('button', { class: 'btn go wide', onclick: () => global.Game.startReview() }, '되새기러 가기')));

      v.appendChild(h('div', { class: 'card' },
        h('div', { class: 'statrow' },
          h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'muted small' }, '함께한 날'), h('div', { class: 'bignum' }, d.days.length + '일')),
          h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'muted small' }, '만난 낱말'), h('div', { class: 'bignum' }, Object.keys(d.memory).length + '개')),
          h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'muted small' }, '발자국'), h('div', { class: 'bignum' }, d.footprints + '개'))
        )));

      // 「바탕화면에 놓기」 안내가 들어올 자리.
      // 이미 앱으로 여셨거나 안내를 닫으셨으면 아무것도 그리지 않습니다.
      v.appendChild(h('div', { id: 'installhost' }));
      if (global.Install) global.Install.render();
    },

    greet() {
      const d = Store.data, n = d.pet.name;
      const gap = d.lastMs ? (Date.now() - d.lastMs) / DAY : 0;
      const hour = new Date().getHours();
      if (d.totalDone === 0) return `안녕하세요! 저는 ${n}${H.particle(n, '이에요', '예요')}. 같이 걸어요.`;
      if (gap > 14) return '오랜만이에요! 많이 기다렸어요.';
      if (gap > 3) return '오셨네요! 오늘도 반가워요.';
      if (hour < 11) return '좋은 아침이에요. 오늘도 같이 걸어요.';
      if (hour < 17) return '오후에도 반가워요!';
      return '저녁에 오시니 더 반갑네요.';
    },

    /* ── 동네 ── */
    scrHood(v) {
      const d = Store.data;
      this.top('우리 동네');
      const hoodIdx = Math.floor((d.level - 1) / 100) % NEIGHBORHOODS.length;
      const hood = NEIGHBORHOODS[hoodIdx];
      // 동네 그림 — 지금 걷고 있는 풍경을 그대로 보여 드립니다
      const card = h('div', { class: 'card center hood-card' });
      const pic = h('div', { class: 'hood-pic' });
      // 이 동네의 명소를 그린 커스텀 삽화가 있으면 그것을, 없으면 산책 풍경을 씁니다
      const art = (global.Landmarks && hood.art
        && global.Landmarks.url(hood.art, global.Theme.hueDeg())) || global.Theme.forLevel(d.level).url;
      pic.style.backgroundImage = `url("${art}")`;
      card.appendChild(pic);
      card.appendChild(h('h2', { class: 'center', style: 'margin:14px 0 2px' }, hood.name));
      card.appendChild(h('p', { class: 'muted center', style: 'margin:0' }, `${d.level}번째 산책 중이에요`));
      v.appendChild(card);

      v.appendChild(h('div', { class: 'section-title' }, '이 동네의 마당'));
      const base = Math.floor((d.level - 1) / 100) * 100;
      for (let c = 0; c < 10; c++) {
        const startLv = base + c * 10 + 1;
        const done = d.level > startLv + 9;
        const here = d.level >= startLv && d.level <= startLv + 9;
        v.appendChild(h('button', {
          class: 'list-item', onclick: () => {
            if (startLv > d.level) return say('아직 가지 않은 길이에요. 차근차근 가 볼까요?', '🐾');
            Store.data.level = startLv; Store.save(); global.Game.start();
          }
        },
          (() => {
            const i = h('span', { class: 'step-ic ' + (done ? 'done' : here ? 'here' : 'todo') });
            i.innerHTML = done ? STEP_ICON.done : here ? STEP_ICON.here : STEP_ICON.todo;
            return i;
          })(),
          h('span', { class: 'grow' + (done || here ? '' : ' dim') },
            `마당 ${Math.floor(startLv / 10) + 1} · ${startLv}~${startLv + 9}번째 산책`),
          h('span', { class: 'badge' + (done ? ' green' : here ? ' warm' : '') }, done ? '마침' : here ? '여기' : '다음')));
      }

      v.appendChild(h('div', { class: 'section-title' }, '지나갈 동네'));
      NEIGHBORHOODS.forEach((n, i) => {
        const row = h('div', { class: 'list-item oneline' + (i === hoodIdx ? '' : ' faded') });
        const dot = h('span', { class: 'hue-dot' });
        const found = HUES.find(x => x[0] === n.hue);
        dot.style.background = found ? found[2] : '#ef8f22';
        row.appendChild(dot);
        row.appendChild(h('span', { class: 'grow' }, n.name));
        if (i === hoodIdx) row.appendChild(h('span', { class: 'badge warm' }, '지금 여기'));
        v.appendChild(row);
      });
    },

    /* ── 강아지 ── */
    scrPet(v) {
      const d = Store.data;
      this.top('우리 갈매기');
      const moods = ['편안함', '반가움', '신남'];
      const mood = moods[d.days.length % moods.length];
      /* 갈매기를 둥근 창(월문) 안에 앉히고, 창 너머로 오늘의 풍경이 비치게 합니다. */
      v.appendChild(h('div', { class: 'card center pet-card' },
        h('div', { class: 'moonwin' }, dogEl(mood, 150, 'petdog')),
        h('h2', { class: 'center', style: 'margin-top:14px' }, d.pet.name),
        h('p', { class: 'muted center' }, `함께한 지 ${d.days.length}일 · 유대 ${d.pet.bond}단계`),
        h('p', { class: 'muted center small', style: 'margin:0 0 6px' }, '부산 갈매기예요. 새우깡을 주면 아주 좋아해요.'),
        h('div', { class: 'petacts' },
          h('button', {
            class: 'btn go', onclick: () => {
              // 쓰다듬으면 크게 두 번 확 파닥이고, 이어서 신난 표정으로 자리잡습니다
              dogMood('petdog', '신남', 150, { flapBurst: true });
              setTimeout(() => dogMood('petdog', '신남', 150), 900);
              setTimeout(() => dogMood('petdog', '반가움', 150), 1600);
              Sound.chirp();
              this.toast(v, `${H.withParticle(d.pet.name, '이/가')} 좋아서 날개를 파닥여요!`);
            }
          }, h('span', { class: 'btn-stack' },
            h('b', null, '쓰다듬기'),
            h('span', { class: 'sub' }, '언제든 괜찮아요'))),
          h('button', {
            class: 'btn', onclick: () => {
              if (d.footprints < 8) return say('발자국이 조금 모자라요. 산책을 다녀오면 채워져요.', '🐾');
              d.footprints -= 8; Store.save();
              Sound.eat();                      // 냠냠 꿀꺽
              // 새우깡을 주면 아주 신나서 냠냠 받아먹습니다
              dogMood('petdog', '먹이', 150);
              setTimeout(() => dogMood('petdog', '반가움', 150), 2600);
              App.topFootprints();
              this.toast(v, `${H.withParticle(d.pet.name, '이/가')} 새우깡을 냠냠 받아먹어요!`);
            }
          }, (() => {
            const w = h('span', { class: 'btn-stack' },
              h('b', null, '새우깡 주기'),
              h('span', { class: 'sub' }, '발자국 8개를 써요'));
            return w;
          })()))
      ));
      /* 기록 — 줄마다 큰 상자를 쓰면 빈자리만 넓어집니다.
         좁으면 두 칸, 넓으면 세 칸으로 저절로 접힙니다. */
      v.appendChild(h('div', { class: 'card' },
        h('h2', null, '함께한 기록'),
        h('div', { class: 'factgrid' },
          h('div', { class: 'fact' }, h('span', { class: 'k' }, '함께한 날'), h('b', null, d.days.length + '일')),
          h('div', { class: 'fact' }, h('span', { class: 'k' }, '모은 발자국'), h('b', null, d.footprints + '개')),
          h('div', { class: 'fact' }, h('span', { class: 'k' }, '함께 걸은 산책'), h('b', null, d.totalDone + '번'))),
        h('button', {
          class: 'btn tool wide', style: 'margin-top:16px', onclick: () => {
            askName(d.pet.name, n => { d.pet.name = n; Store.save(); this.go('pet'); });
          }
        }, '이름 바꾸기')));
    },

    toast(v, msg) {
      const old = document.getElementById('toastbox'); if (old) old.remove();
      const box = h('div', { class: 'card center', id: 'toastbox', style: 'background:var(--secondary-c);color:var(--on-secondary-c);font-weight:700' }, msg);
      v.insertBefore(box, v.firstChild); v.scrollTop = 0;
    },

    /* ── 배움 ── */
    /* ── 해운대 ──
       배움 탭을 해운대 정보 퀴즈로 바꿨습니다.
       낱말 공부는 이미 판에서 실컷 하시므로,
       여기서는 우리 고장 해운대를 묻고 답하는 것만 남깁니다.
       (문제는 부산 공공데이터·해운대구 안내를 바탕으로 합니다) */
    /* 오늘 보여 드릴 소식만 고릅니다.
       올린 날(date)이 지났고 마감일(until)이 아직 안 지난 것만,
       최신순으로. 마감일이 지난 소식은 저절로 사라집니다. */
    validNotices() {
      const stat = this.feedNotices();            // 실시간 피드(없으면 내장 데이터)
      const api = this._festivalNotices || [];   // 부산축제정보 OpenAPI에서 받아 온 행사 소식
      const t = new Date();
      const ymd = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
      const seen = new Set();
      return stat.concat(api)
        .filter(n => n && n.title && !seen.has(n.title) && seen.add(n.title))   // 같은 제목 중복 제거
        .filter(n => (!n.date || n.date <= ymd) && (!n.until || n.until >= ymd))
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    },

    noticeCard(n, m) {
      const CAT = {
        복지: '🧡', 건강: '🩺', 안전: '🛡️', 행사: '🎉', 교육: '📚', 일자리: '💼',
        창업: '🏪', 교통: '🚌', 주거: '🏠', 환경: '🌿', 세금: '🧾',
        문화: '🎨', 관광: '🗺️', 생활: '🏠'
      };
      const emoji = CAT[n.cat] || '📌';
      const day = String(n.date || '').replace(/-/g, '.');
      return h('div', { class: 'card', style: 'text-align:left' },
        h('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px' },
          h('span', null,
            h('span', { class: 'badge warm' }, emoji + ' ' + n.cat),
            (m && m.mine) ? h('span', { class: 'badge green', style: 'margin-left:6px' }, '✅ 나에게') : null),
          h('span', { class: 'muted small' }, day)),
        h('h3', { style: 'margin:0 0 6px;font-size:var(--t-body)' }, n.title),
        // 동 소식지는 대부분 사진 한 장입니다. 사진을 카드 안에 바로 보여 드려
        // 정부 사이트를 헤매지 않고 그 자리에서 다 보실 수 있게 합니다.
        n.imageUrl
          ? h('img', {
            src: n.imageUrl, alt: n.title, loading: 'lazy',
            style: 'width:100%;border-radius:12px;margin:0 0 8px;display:block;' +
              'max-height:480px;object-fit:contain;background:#f3ede4'
          })
          : null,
        // AI가 쉬운 말로 바꾼 문장이 있으면 그것만 보여 드립니다
        // (원문은 아래 출처 링크를 누르면 언제든 대조할 수 있습니다).
        n.aiSimplified
          ? h('div', { style: 'margin:0 0 8px' },
            h('div', { style: 'display:flex;align-items:center;gap:6px;margin-bottom:4px' },
              h('span', { class: 'badge', style: 'background:#e8f0ff;color:#2a5db0' }, '🤖 AI가 쉽게 풀어드려요')),
            h('p', { style: 'margin:0;line-height:1.7;word-break:keep-all;font-weight:700' }, n.aiSimplified))
          : h('p', { style: 'margin:0 0 8px;line-height:1.7;word-break:keep-all' }, n.body),
        // 왜 이 소식이 나에게 왔는지 밝힙니다 — 「알아서 골라 준다」는 말만으로는 못 믿습니다
        (m && m.reasons && m.reasons.length)
          ? h('p', { class: 'muted small', style: 'margin:0 0 8px' }, '내 ' + m.reasons.join(' · ') + ' 에 해당돼요')
          : null,
        // 요약만 보고 끝나면 어르신은 정작 필요한 신청 방법·기간을 못 찾습니다.
        // 원문으로 가는 길을 크고 분명하게 둡니다.
        h('div', { style: 'display:flex;gap:8px;margin:2px 0 10px' },
          n.sourceUrl
            ? h('a', {
              class: 'btn', href: n.sourceUrl, target: '_blank', rel: 'noopener noreferrer',
              style: 'flex:1;display:flex;align-items:center;justify-content:center;' +
                'text-decoration:none',
              onclick: () => Sound.tap()
            }, '전문 보기')
            : null,
          h('button', {
            class: 'btn tool', style: 'flex:1',
            onclick: () => { Sound.tap(); shareNotice(n); }
          }, '💬 카톡으로 보내기')),
        h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px' },
          // 어느 기관에서 왔는지도 눌러서 바로 확인할 수 있어야 합니다.
          // 작은 글씨라 눈에 안 띌 수 있으니 밑줄로 눌러지는 곳임을 알립니다.
          n.sourceUrl
            ? h('a', {
              class: 'muted small', href: n.sourceUrl, target: '_blank', rel: 'noopener noreferrer',
              style: 'text-decoration:underline', onclick: () => Sound.tap()
            }, '출처 · ' + n.source)
            : h('span', { class: 'muted small' }, '출처 · ' + n.source),
          n.auto ? h('span', { class: 'muted small', style: 'white-space:nowrap' }, '🔄 공공데이터 자동수집') : null));
    },

    /* ── 실시간 정보 피드 ──
       data/feed.json 을 받아 소식·알아두기를 채웁니다.
       이 파일은 파이프라인(tools/build_feed.mjs)이 공식 소스에서
       수집·가공·검수해 갱신합니다. 못 받으면 내장 데이터로 폴백하므로
       인터넷이 없어도 앱은 그대로 동작합니다. */
    loadFeed() {
      fetch('data/feed.json', { cache: 'no-cache' })
        .then(r => (r && r.ok) ? r.json() : null)
        .then(f => { if (f && (f.notices || f.guides)) { this._feed = f; if (this.tab === 'learn') this.go('learn'); } })
        .catch(() => { });
    },
    feedNotices() { return (this._feed && this._feed.notices) || (global.RAW && global.RAW.NOTICES) || []; },
    feedGuides() { return (this._feed && this._feed.guides) || (global.Haeundae && global.Haeundae.GUIDE) || []; },
    feedUpdated() { return this._feed && this._feed.meta && this._feed.meta.lastUpdated; },

    /* ── 나에게 해당되는 정보인가 ──
       나이대·사는 동네·관심 주제를 견주어 점수를 냅니다.
       · 특정 동에만 해당하는 소식인데 내 동네가 아니면 감춥니다(엉뚱한 정보 차단).
       · 왜 나에게 왔는지 이유(reasons)를 함께 돌려주어 화면에 밝힙니다. */
    matchInfo(x) {
      const s = Store.data.settings;
      const senior = !!s.ageBand && s.ageBand !== 'under65';
      const reasons = [];
      let score = 0, blocked = false;

      if (x.for65) {                                   // 만 65세 이상 대상 정보
        if (senior) { score += 2; reasons.push('만 65세 이상'); }
      }
      const reg = x.region;                            // 특정 동 한정 소식
      if (Array.isArray(reg) && reg.length && !reg.includes('해운대구')) {
        if (s.dong && reg.includes(s.dong)) { score += 1.5; reasons.push(s.dong); }
        else if (s.dong) blocked = true;               // 내 동네가 아니면 감춤
      }
      /* 관광객·사업자용 소식은 어르신 화면에서 감춥니다.
         벡스코 임대 공고나 관광 이벤트가 연금 안내 사이에 끼면
         "내 것이 아닌 글"이 늘어나 결국 아무것도 안 읽게 됩니다. */
      const aud = x.audience;
      if (Array.isArray(aud) && aud.length
        && !aud.includes('senior') && !aud.includes('resident')) blocked = true;

      /* 관심 주제를 고르셨으면 '고른 것만' 보여 드립니다.
         점수만 올리고 다 보여 주면 고른 보람이 없습니다. */
      /* 게시판이 붙이는 이름(행사·관광·문화…)과 어르신께 익숙한 말(나들이)은 다릅니다.
         칩 하나가 여러 갈래를 아우르게 이어 둡니다.
         이어 두지 않으면 「나들이」를 고르신 분께는 아무것도 안 보입니다. */
      const its = [];
      (s.interests || []).forEach(c => its.push(...(INTEREST_MAP[c] || [c])));
      if (its.length) {
        if (its.includes(x.cat)) { score += 1.2; reasons.push(x.cat); }
        else blocked = true;
      }

      return { mine: !blocked && score > 0, blocked, score, reasons };
    },

    /* ── 해운대 정보 통합 검색 ──
       소식·알아두기·퀴즈를 한 번에 찾습니다.
       모든 검색은 '기기 안에서만' 이뤄집니다(외부 전송 없음 · 오프라인). */
    buildSearchIndex() {
      const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();
      const idx = [];
      const push = (kind, data, parts) => idx.push({ kind, data, key: norm(parts.join(' ')) });
      this.feedNotices().forEach(n => push('notice', n, [n.title, n.body, n.source, n.cat]));
      (this._festivalNotices || []).forEach(n => push('notice', n, [n.title, n.body, n.source, n.cat]));
      this.feedGuides().forEach(g => push('guide', g, [g.title, g.lead, g.good, g.official, (g.how || []).join(' '), g.cat]));
      (DB.byType.PROVERB || []).forEach(e => push('quiz', e, [e.front, e.back, e.meaning]));
      return idx;
    },

    searchHaeundae(q) {
      const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();
      const toks = String(q || '').trim().split(/\s+/).map(norm).filter(Boolean);
      if (!toks.length) return [];
      const dedupe = list => {
        const seen = new Set();
        return list.filter(it => {
          const id = it.kind + '|' + (it.data.title || it.data.front || it.data.surface);
          if (seen.has(id)) return false; seen.add(id); return true;
        });
      };
      const idx = this.buildSearchIndex();

      // "노인 일자리"처럼 두 낱말을 다 가진 글이 없을 수 있습니다.
      // 그렇다고 검색 결과가 텅 비면 어르신은 "여긴 없구나" 하고 앱을 덮습니다.
      // 낱말을 하나라도 가진 글을, 많이 겹치는 순서로라도 보여 드립니다.
      const strict = dedupe(idx.filter(it => toks.every(t => it.key.includes(t))));
      if (strict.length || toks.length < 2) return strict;

      return dedupe(idx
        .map(it => ({ it, hit: toks.filter(t => it.key.includes(t)).length }))
        .filter(o => o.hit > 0)
        .sort((a, b) => b.hit - a.hit)
        .map(o => o.it));
    },

    resultCard(it) {
      if (it.kind === 'guide') return guideCard(it.data);
      if (it.kind === 'notice') return this.noticeCard(it.data);
      const e = it.data;                                          // 퀴즈(해운대 지식) 결과
      const tip = (global.Haeundae && global.Haeundae.TIPS[e.back]) || null;
      return h('div', { class: 'card', style: 'text-align:left' },
        h('span', { class: 'badge warm' }, '❓ 해운대 상식'),
        h('h3', { style: 'margin:7px 0 4px' }, e.front + ' → ' + e.back),
        h('p', { style: 'margin:0;line-height:1.7;word-break:keep-all' }, e.meaning),
        tip ? h('p', { class: 'muted small', style: 'margin:7px 0 0;word-break:keep-all' }, '💡 ' + tip.tip) : null);
    },

    scrLearn(v) {
      const d = Store.data;
      this.top('해운대 정보');

      // 부산축제정보 OpenAPI에서 해운대 행사 소식을 한 번 받아 옵니다(받으면 다시 그림).
      if (!this._festivalTried && global.BusanAPI) {
        this._festivalTried = true;
        global.BusanAPI.festivalNotices()
          .then(ns => { this._festivalNotices = ns || []; if (this.tab === 'learn') this.go('learn'); })
          .catch(() => { });
      }

      // 🔎 검색 — 궁금한 것을 낱말로 찾습니다 (기기 안에서만 · 오프라인)
      const results = h('div');
      const content = h('div');
      const search = h('input', {
        type: 'search', value: this._searchQ || '',
        placeholder: '예) 지하철, 연금, 보이스피싱, 축제',
        'aria-label': '해운대 정보 검색',
        style: 'width:100%;box-sizing:border-box;font-size:calc(19px*var(--fs));padding:12px 14px;border:2px solid #e0d5c8;border-radius:12px'
      });
      const run = () => {
        const q = search.value.trim();
        this._searchQ = q;
        results.innerHTML = '';
        if (!q) { content.style.display = ''; results.style.display = 'none'; return; }
        content.style.display = 'none'; results.style.display = '';
        const hits = this.searchHaeundae(q);
        results.appendChild(h('div', { class: 'section-title' }, `‘${q}’ 검색 결과 ${hits.length}가지`));
        if (!hits.length) results.appendChild(h('div', { class: 'card center' },
          h('p', { class: 'muted', style: 'margin:0' }, '찾는 정보가 없어요. 다른 낱말로 찾아 보세요.')));
        hits.forEach(it => results.appendChild(this.resultCard(it)));
      };
      search.addEventListener('input', run);
      v.appendChild(h('div', { class: 'card', style: 'padding:12px' },
        h('div', { style: 'font-weight:700;margin:0 0 8px' }, '🔎 해운대 정보 검색'),
        search));
      v.appendChild(results);
      v.appendChild(content);

      // 정보 갱신일 — 언제 최신화됐는지 보여 드려 신뢰를 높입니다
      const upd = this.feedUpdated();
      content.appendChild(h('p', { class: 'muted small', style: 'margin:0 4px 4px;text-align:right' },
        (upd ? '정보 갱신 ' + upd.replace(/-/g, '.') : '기본 정보') + ' · 공식 출처'));

      /* 나에게 맞는 정보 받기 — 나이대·사는 동네·관심만 고르면 해당 정보를 먼저 보여 드립니다.
         이름·연락처는 묻지 않고, 고른 값은 이 기기 안에만 남습니다. */
      const st = d.settings;
      const interests = st.interests || (st.interests = []);
      const personalizeOn = st.personalize === true;
      const personalized = personalizeOn && !!(st.ageBand || st.dong || interests.length);

      if (st.personalize === null) {
        /* 아직 여쭤보지 않았습니다 — 먼저 여쭙고, 원하실 때만 맞춤으로 보여 드립니다. */
        content.appendChild(h('div', { class: 'card', style: 'padding:14px;text-align:left' },
          h('div', { style: 'font-weight:700;font-size:calc(19px*var(--fs));margin:0 0 6px' }, '정보를 어떻게 보여 드릴까요?'),
          h('p', { class: 'muted small', style: 'margin:0 0 13px;line-height:1.7;word-break:keep-all' },
            '나이와 사는 동네를 알려 주시면 나에게 해당되는 것만 골라 드려요. 이름·연락처는 묻지 않고, 이 기기에만 저장돼요.'),
          h('button', {
            class: 'btn primary big wide', style: 'margin-bottom:9px',
            onclick: () => { st.personalize = true; this._profileOpen = true; Store.save(); this.go('learn'); }
          }, '나에게 맞는 것만 볼래요'),
          h('button', {
            class: 'btn tool wide',
            onclick: () => { st.personalize = false; Store.save(); this.go('learn'); }
          }, '그냥 전체 다 볼래요')));

      } else if (!personalizeOn) {
        /* 전체 보기를 고르셨습니다 — 아무것도 거르지 않고, 언제든 바꾸실 수 있게 둡니다. */
        content.appendChild(h('div', { class: 'card', style: 'padding:12px;text-align:left' },
          h('p', { class: 'muted small', style: 'margin:0 0 9px' }, '지금은 모든 정보를 보고 계세요.'),
          h('button', {
            class: 'btn tool wide',
            onclick: () => { st.personalize = null; Store.save(); this.go('learn'); }
          }, '나에게 맞는 것만 보기')));

      } else {
      const open = this._profileOpen || !st.ageBand || !st.dong;   // 아직 안 고르셨으면 펼쳐 둡니다

      const prof = h('div', { class: 'card', style: 'padding:13px;text-align:left' });
      prof.appendChild(h('div', { style: 'font-weight:700;margin:0 0 3px' }, '나에게 맞는 정보 받기'));

      if (!open) {
        const parts = [];
        const ab = AGE_BANDS.find(a => a[0] === st.ageBand);
        if (ab) parts.push(ab[1]);
        if (st.dong) parts.push(st.dong);
        if (interests.length) parts.push(interests.join('·'));
        prof.appendChild(h('p', { class: 'muted', style: 'margin:3px 0 11px' }, parts.join(' · ')));
        prof.appendChild(h('button', {
          class: 'btn tool wide', onclick: () => { this._profileOpen = true; this.go('learn'); }
        }, '고치기'));
        prof.appendChild(h('button', {
          class: 'btn tool wide', style: 'margin-top:8px',
          onclick: () => { st.personalize = false; Store.save(); this.go('learn'); }
        }, '전체 다 보기'));
      } else {
        prof.appendChild(h('p', { class: 'muted small', style: 'margin:0 0 11px;word-break:keep-all;line-height:1.6' },
          '나이와 사는 동네를 알려 주시면 나에게 해당되는 정보를 먼저 보여 드려요. 이름은 묻지 않고, 이 기기에만 저장돼요.'));

        prof.appendChild(h('div', { style: 'font-weight:700;font-size:15px;margin:0 0 7px' }, '나이대'));
        const ageRow = h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin:0 0 13px' });
        AGE_BANDS.forEach(([k, label]) => ageRow.appendChild(h('button', {
          class: 'btn ' + (st.ageBand === k ? 'primary' : 'tool'), style: 'padding:9px 14px',
          onclick: () => { st.ageBand = k; Store.save(); this.go('learn'); }
        }, label)));
        prof.appendChild(ageRow);

        prof.appendChild(h('div', { style: 'font-weight:700;font-size:15px;margin:0 0 7px' }, '사는 동네'));
        const sel = h('select', {
          'aria-label': '사는 동네',
          style: 'width:100%;box-sizing:border-box;font-size:calc(18px*var(--fs));padding:11px;border:2px solid #e0d5c8;border-radius:12px;margin:0 0 13px'
        });
        sel.appendChild(h('option', { value: '' }, '고르지 않음'));
        DONG.forEach(dn => { const o = h('option', { value: dn }, dn); if (st.dong === dn) o.selected = true; sel.appendChild(o); });
        sel.addEventListener('change', () => { st.dong = sel.value || null; Store.save(); this.go('learn'); });
        prof.appendChild(sel);

        prof.appendChild(h('div', { style: 'font-weight:700;font-size:15px;margin:0 0 7px' }, '관심 있는 것'));
        const chips = h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px' });
        Object.keys(INTEREST_MAP).forEach(c => chips.appendChild(h('button', {
          class: 'btn ' + (interests.includes(c) ? 'primary' : 'tool'), style: 'padding:8px 15px',
          onclick: () => { const i = interests.indexOf(c); if (i >= 0) interests.splice(i, 1); else interests.push(c); Store.save(); this._noticeShown = 0; this.go('learn'); }
        }, c)));
        prof.appendChild(chips);

        if (st.ageBand && st.dong) prof.appendChild(h('button', {
          class: 'btn primary wide', style: 'margin-top:13px',
          onclick: () => { this._profileOpen = false; this.go('learn'); }
        }, '다 골랐어요'));
      }
      content.appendChild(prof);
      }

      // 해운대 갈매기가 오늘의 소식을 전해 드립니다
      content.appendChild(h('div', { class: 'card', style: 'display:flex;align-items:center;gap:12px;text-align:left' },
        gullEl(60),
        h('div', null,
          h('h3', { style: 'margin:0 0 2px' }, '해운대 갈매기'),
          h('p', { class: 'muted small', style: 'margin:0' }, '오늘의 해운대 소식을 전해 드려요'))));

      // 흩어진 기관 홈페이지를 일일이 뒤지지 않아도, 여기 다 모여 있다는 것 —
      // 그게 이 화면의 핵심입니다. 숫자로 보여 드리고, 눌러서 '어디어디인지' 밝힙니다.
      {
        const all = this.feedNotices();
        const orgCount = new Set(all.map(n => n.source)).size;
        const upd = this.feedUpdated();
        content.appendChild(h('button', {
          class: 'card', style: 'width:100%;text-align:center;background:var(--primary-c);' +
            'display:flex;justify-content:space-around;align-items:center;padding:14px 8px;border:0;cursor:pointer',
          onclick: () => { Sound.tap(); this.showSources(); }
        },
          h('div', null,
            h('div', { style: 'font-size:22px;font-weight:800' }, orgCount + '곳'),
            h('div', { class: 'muted small' }, '공공기관 통합 · 눌러 보기')),
          h('div', null,
            h('div', { style: 'font-size:22px;font-weight:800' }, all.length + '건'),
            h('div', { class: 'muted small' }, '실시간 소식')),
          h('div', null,
            h('div', { style: 'font-size:22px;font-weight:800' }, upd ? String(upd).slice(5).replace('-', '.') : '오늘'),
            h('div', { class: 'muted small' }, '마지막 갱신'))));
      }

      // 오늘의 해운대 소식 — 믿을 수 있는 공지를 제때, 꾸준히 올립니다
      // 내 동네가 아닌 소식은 감추고, 나에게 해당되는 것부터 보여 드립니다.
      const scored = this.validNotices().map(n => ({ x: n, m: this.matchInfo(n) }));
      const picked = scored.filter(o => !o.m.blocked);
      const wideOpen = !personalizeOn || this._showAllNotices;
      const notices = wideOpen
        ? scored.map(o => ({ x: o.x, m: personalizeOn ? o.m : null }))
        : picked;
      if (personalized) notices.sort((a, b) => (b.m ? b.m.score : 0) - (a.m ? a.m.score : 0));

      content.appendChild(h('div', { class: 'section-title' }, '오늘의 해운대 소식'));

      // 골라 준 개수와 전체 개수를 함께 보여 주고, 언제든 전체를 펼 수 있게 합니다.
      if (personalizeOn && picked.length !== scored.length) {
        content.appendChild(h('button', {
          class: 'btn quiet wide', style: 'margin:0 0 10px',
          onclick: () => { Sound.tap(); this._showAllNotices = !this._showAllNotices; this._noticeShown = 0; this.go('learn'); }
        }, wideOpen
          ? '← 내게 맞는 소식만 보기 (' + picked.length + '건)'
          : '전체 소식도 보기 (' + scored.length + '건)'));
      }

      if (!notices.length) {
        content.appendChild(h('div', { class: 'card center' },
          h('p', { class: 'muted', style: 'margin:0 0 10px' },
            '고르신 주제에 맞는 소식이 아직 없어요.'),
          h('button', {
            class: 'btn wide',
            onclick: () => { Sound.tap(); this._showAllNotices = true; this._noticeShown = 0; this.go('learn'); }
          }, '전체 소식 ' + scored.length + '건 보기')));
      } else {
        /* 소식이 백 건을 넘습니다. 한 번에 다 쏟아 놓으면
           어르신은 끝없이 손가락을 밀다 지쳐 그만둡니다.
           열두 건씩 보여 드리고, 더 보고 싶으실 때만 늘립니다. */
        const STEP = 12;
        const shown = this._noticeShown || STEP;
        notices.slice(0, shown).forEach(o => content.appendChild(this.noticeCard(o.x, o.m)));
        if (notices.length > shown) {
          content.appendChild(h('button', {
            class: 'btn tool wide', style: 'margin:2px 0 6px',
            onclick: () => {
              Sound.tap();
              this._noticeShown = shown + STEP;
              this.go('learn');
            }
          }, '소식 ' + Math.min(STEP, notices.length - shown) + '건 더 보기 ' +
          '(' + shown + ' / ' + notices.length + ')'));
        }
      }

      // 해운대 알아두기 — 삽화와 쉬운 안내, 실행법. 내게 맞는 것 먼저.
      const guide = personalizeOn
        ? this.feedGuides().map(g => ({ x: g, m: this.matchInfo(g) })).filter(o => !o.m.blocked)
        : this.feedGuides().map(g => ({ x: g, m: null }));
      if (personalized) guide.sort((a, b) => b.m.score - a.m.score);
      if (guide.length) {
        content.appendChild(h('div', { class: 'section-title' }, personalized ? '해운대 알아두기 · 나에게 맞는 정보 먼저' : '해운대 알아두기'));
        guide.forEach(o => content.appendChild(guideCard(o.x, o.m)));
      }

      // 해운대 퀴즈
      const all = DB.byType.PROVERB || [];
      const met = all.filter(e => d.memory[e.id]).length;

      content.appendChild(h('div', { class: 'section-title' }, '해운대 퀴즈'));
      content.appendChild(h('div', { class: 'card center' },
        h('p', { class: 'muted', style: 'margin:0 0 4px' }, '우리 고장 이야기'),
        h('h2', { class: 'center', style: 'margin:0 0 6px' }, '해운대를 얼마나 아시나요'),
        h('p', { class: 'muted small', style: 'margin:0 0 18px' },
          `해운대 이야기 ${all.length}가지 가운데 ${met}가지를 만나셨어요`),
        h('button', {
          class: 'btn primary big wide', onclick: () => global.Game.startProverbs()
        }, '해운대 퀴즈 풀러 가기')));

      run();   // 저장된 검색어가 있으면 결과를 바로 보여 줍니다
    },


    listWords(list, title) {
      sheet((box, close) => {
        box.appendChild(h('h2', { class: 'center' }, title));
        if (!list.length) {
          box.appendChild(h('div', { class: 'empty' }, h('div', { class: 'face' }, '🧺'),
            h('p', { class: 'muted' }, '아직 담긴 낱말이 없어요. 함께 모아 볼까요?')));
        } else {
          [...new Set(list)].slice().reverse().forEach(e => box.appendChild(
            h('button', { class: 'list-item', onclick: () => { close(); global.Game.card(e, null); } },
              h('span', { class: 'grow' }, e.surface),
              h('span', { class: 'badge' }, global.Engine.GRADE_NAME[e.grade]))));
        }
        box.appendChild(h('button', { class: 'btn primary wide', style: 'margin-top:10px', onclick: close }, '닫기'));
      });
    },

    stats() {
      const d = Store.data;
      sheet((box, close) => {
        box.appendChild(h('h2', { class: 'center' }, '나의 기록'));
        // 게임을 하는 데 실제로 쓰이는 것만 둡니다.
        // 갈래별 순위·달력 같은 것은 재미로 보는 것일 뿐 놀이에 쓰이지 않아 뺐습니다.
        const rows = [
          ['함께한 날', d.days.length + '일'],
          ['마친 산책', d.totalDone + '번'],
          ['만난 낱말', Object.keys(d.memory).length + '개'],
          ['모은 발자국', d.footprints + '개']
        ];
        rows.forEach(([k, val]) => box.appendChild(h('div', { class: 'list-item' },
          h('span', { class: 'grow' }, k), h('span', { class: 'badge' }, val))));

        box.appendChild(h('button', { class: 'btn primary wide', style: 'margin-top:16px', onclick: close }, '닫기'));
      });
    },

    /* ── 설정 ── */
    scrSet(v) {
      const s = Store.data.settings;
      this.top('설정');

      v.appendChild(h('div', { class: 'card' },
        h('h2', null, '빛깔'),
        h('p', { class: 'muted small', style: 'margin:-6px 0 14px' },
          '「산책마다」로 두시면 산책을 한 판 마칠 때마다 빛깔이 저절로 바뀝니다. ' +
          '한 가지로 두고 싶으시면 아래에서 골라 주세요.'),
        (() => {
          const box = h('div', { class: 'hues' });
          const mk = (id, label, dot) => {
            const b = h('button', {
              class: 'hue' + (s.hue === id ? ' on' : ''),
              onclick: () => { s.hue = id; Store.save(); applySettings(); Sound.tap(); this.go('set'); }
            });
            const d = h('span', { class: 'dot' });
            d.style.background = dot;
            b.appendChild(d); b.appendChild(h('span', null, label));
            return b;
          };
          box.appendChild(mk('auto', '산책마다',
            'conic-gradient(#ef8f22,#57a86c,#4595b0,#8c78bd,#dd6a7e,#a98953,#ef8f22)'));
          HUES.forEach(([id, label, dot]) => box.appendChild(mk(id, label, dot)));
          return box;
        })()));

      v.appendChild(h('div', { class: 'card' },
        h('h2', null, '글씨 크기'),
        (() => {
          const bar = h('div', { class: 'sizebar' });
          [1, 1.15, 1.3, 1.5, 1.75].forEach((val, i) => bar.appendChild(h('button', {
            class: Math.abs(s.fs - val) < 0.01 ? 'on' : '',
            style: `font-size:${16 + i * 4}px`,
            onclick: () => { s.fs = val; Store.save(); applySettings(); this.go('set'); }
          }, '가')));
          return bar;
        })(),
        h('div', { class: 'preview-box' },
          h('div', { style: 'font-size:calc(30px * var(--fs));font-weight:800' }, '온고지신'),
          h('div', { class: 'muted', style: 'margin-top:6px' }, '옛것을 익혀 새로운 것을 안다는 뜻입니다.'))
      ));

      const tg = (label, key, hint) => h('button', {
        class: 'toggle' + (s[key] ? ' on' : ''),
        onclick: () => { s[key] = !s[key]; Store.save(); applySettings(); this.go('set'); }
      }, h('span', { style: 'flex:1' }, label, hint ? h('div', { class: 'small', style: 'font-weight:500;opacity:.85' }, hint) : null),
        h('span', { class: 'knob' }));

      v.appendChild(h('div', { class: 'card' },
        h('h2', null, '소리'),
        tg('효과음', 'sfx', '맞혔을 때 짧은 소리가 나요'),
        h('button', {
          class: 'toggle' + (s.bgm ? ' on' : ''),
          onclick: () => { s.bgm = !s.bgm; Store.save(); global.Audio2.sync(); this.go('set'); }
        }, h('span', { style: 'flex:1' }, '배경음 켜기',
          h('div', { class: 'small', style: 'font-weight:500;opacity:.85' }, '잔잔한 소리가 아주 작게 흘러요')),
          h('span', { class: 'knob' }))));

      v.appendChild(h('div', { class: 'card' },
        h('h2', null, '보기'),
        tg('천천히 즐기기', 'gentle', '문제를 조금 더 쉽게 내드려요'),
        tg('또렷하게 보기', 'contrast', '글자와 테두리를 더 진하게 해요'),
        tg('움직임 줄이기', 'motion', '화면이 덜 움직이게 해요'),
        h('button', {
          class: 'toggle' + (s.theme === 'dark' ? ' on' : ''),
          onclick: () => { s.theme = s.theme === 'dark' ? 'light' : 'dark'; Store.save(); applySettings(); this.go('set'); }
        }, h('span', { style: 'flex:1' }, '어둡게 보기', h('div', { class: 'small', style: 'font-weight:500;opacity:.85' }, '밤에 눈이 덜 부셔요')), h('span', { class: 'knob' }))));

      v.appendChild(h('div', { class: 'card' },
        h('h2', null, '도움말과 정보'),
        h('button', { class: 'list-item', onclick: () => this.help() }, h('span', { class: 'grow' }, '사용법 보기'), h('span', { class: 'badge' }, '보기')),
        h('button', { class: 'list-item', onclick: () => this.about() }, h('span', { class: 'grow' }, '앱 정보와 자료 출처'), h('span', { class: 'badge' }, '보기')),
        h('button', {
          class: 'list-item', onclick: () => {
            sheet((box, close) => {
              box.appendChild(h('h2', { class: 'center' }, '처음부터 다시 시작할까요?'));
              box.appendChild(h('p', { class: 'muted center', style: 'word-break:keep-all' }, '지금까지 걸어온 산책과 모은 낱말이 모두 지워져요. 되돌릴 수 없어요.'));
              box.appendChild(h('button', { class: 'btn primary wide', style: 'margin-bottom:12px', onclick: close }, '그냥 둘게요'));
              box.appendChild(h('button', {
                class: 'btn wide', style: 'color:var(--error)',
                onclick: () => { localStorage.removeItem(KEY); location.reload(); }
              }, '네, 모두 지울게요'));
            });
          }
        }, h('span', { class: 'lead' }, '🧹'), h('span', { class: 'grow' }, '처음부터 다시 시작하기'))));

      // 앱 끝내기 — 소리를 모두 멈추고 창을 닫습니다.
      v.appendChild(h('div', { class: 'card' },
        h('h2', null, '앱 끝내기'),
        h('p', { class: 'muted small', style: 'margin:-6px 0 14px' },
          '소리를 모두 멈추고 앱을 닫아요. 걸어오신 기록은 그대로 저장돼 있어요.'),
        h('button', {
          class: 'btn primary wide', onclick: () => this.quit()
        }, '소리 끄고 앱 끝내기')));
    },

    /**
     * 앱 끝내기.
     *
     * 브라우저는 「스스로 창을 닫는 것」을 대개 막습니다. 다만 바탕화면
     * 아이콘으로 설치해 여신 경우(standalone)에는 닫을 수 있습니다.
     * 그래서 이렇게 합니다.
     *   ① 소리부터 확실히 멈춥니다 — 이게 어르신께 가장 급한 일입니다.
     *      (닫히지 않더라도 최소한 조용해집니다)
     *   ② 창을 닫아 봅니다.
     *   ③ 안 닫히면 「이제 홈 단추를 누르셔도 돼요」라고 알려 드립니다.
     *      닫히지도 않고 아무 말도 없으면 고장 난 것처럼 보입니다.
     */
    quit() {
      const s = Store.data.settings;
      s.bgmWasOn = s.bgm;
      s.sfx = false; s.bgm = false;
      Store.save();
      try { global.Audio2.sync(); global.Audio2.stop(); } catch (e) { /* 소리가 없어도 그만 */ }
      if (global.Game && global.Game.stopHere) global.Game.stopHere();

      let closed = false;
      try { window.close(); closed = window.closed; } catch (e) { /* 막혀 있음 */ }
      if (closed) return;

      setTimeout(() => {
        sheet((box, close) => {
          box.appendChild(h('div', { class: 'center' },
            dogEl('졸림', 108),
            h('h2', { style: 'margin:10px 0 6px' }, '소리를 껐어요'),
            h('p', { class: 'muted', style: 'word-break:keep-all;margin:0 0 18px' },
              '브라우저에서는 앱이 스스로 닫히지 않아요. ' +
              '이제 홈 단추를 누르시거나 창을 닫으셔도 돼요. ' +
              '걸어오신 기록은 그대로 저장돼 있어요.'),
            h('button', { class: 'btn primary wide', onclick: close }, '알겠어요')));
        });
      }, 60);
    },

    /**
     * 사용법.
     * 글만 줄줄이 늘어놓으면 어르신은 읽다가 놓칩니다.
     * ① 어떻게 노는지 ② 도움은 어떻게 받는지 ③ 발자국은 어떻게 모이는지
     * 세 묶음으로 나누고, 값은 표처럼 나란히 세워 한눈에 보이게 했습니다.
     */
    help() {
      sheet((box, close) => {
        box.appendChild(dogEl('반가움', 88, 'helpdog'));
        box.appendChild(h('h2', { class: 'center', style: 'margin:8px 0 2px' }, '이렇게 하시면 돼요'));
        box.appendChild(h('p', { class: 'muted center', style: 'margin:0 0 4px' },
          '천천히 하셔도 괜찮아요. 틀려도 아무 일 없어요.'));

        /* 발자국 값(💰 자리)에는 사람 발자국 이모지가 아니라
           앱 전체에서 쓰는 '갈매기 물갈퀴 발자국'을 그립니다.
           이모지 사람 발자국을 그대로 쓰면 산책 탭 아이콘·진행 표시와 어긋납니다. */
        const gullPawTag = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" ' +
          'style="vertical-align:-3px;margin-right:3px">' +
          '<path d="M12 3.6 C10.4 8 7.8 9.8 4.4 10.9 C7.4 13.4 10 15.2 12 20 C14 15.2 16.6 13.4 19.6 10.9 C16.2 9.8 13.6 8 12 3.6 Z"/>' +
          '<circle cx="12" cy="3.8" r="1.5"/><circle cx="4.5" cy="11" r="1.4"/><circle cx="19.5" cy="11" r="1.4"/>' +
          '<path d="M12 19.4 L12 22.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
        const priceHtml = n => gullPawTag + n;

        /* ── 한 묶음 ──
           [그림, 설명, 값, 덧붙이는 말]
           값은 오른쪽에 세로로 맞춰 값표처럼 훑을 수 있게 둡니다. */
        const group = (title, rows) => {
          const g = h('div', { class: 'help-group' }, h('div', { class: 'help-head' }, title));
          rows.forEach(([ic, t, price, note]) => g.appendChild(h('div', { class: 'help-row' },
            ic === '👣' ? h('span', { class: 'help-ic', html: gullPawTag }) : h('span', { class: 'help-ic' }, ic),
            h('span', { class: 'help-txt' }, t,
              note ? h('span', { class: 'help-note' }, note) : null),
            price ? h('span', { class: 'help-price', html: priceHtml(price.replace(/^👣\s*/, '')) }) : null)));
          box.appendChild(g);
        };

        group('놀이 방법', [
          ['👣', '「산책 나가기」를 누르면 낱말 판이 나와요.'],
          ['👆', '아래 글자를 누르면 판의 빈 칸에 들어가요.'],
          ['↩', '잘못 넣으셨으면 「지우기」를 누르시면 돼요.'],
          ['⏭', '어려우면 「오늘은 넘어가기」로 넘기셔도 돼요.', null, '아무 손해가 없어요.']
        ]);

        group('막히면 이렇게', [
          ['🎯', '「글자 하나」·「낱말 하나」 단추를 누르면 발자국을 써서 채워드려요.']
        ]);

        group('발자국은', [
          ['👣', '낱말을 맞히거나 판을 채우면 저절로 쌓여요.']
        ]);

        group('해운대 정보', [
          ['👣', '아래 「해운대」 탭을 누르면 구청·주민센터·도서관·보건소 등의 소식을 모아 보여 드려요.'],
          ['🔎', '알고 싶은 말을 넣으면 소식·안내·퀴즈를 한 번에 찾아 드려요.'],
          ['✅', '내 나이·동네·관심사를 넣으시면 나에게 맞는 소식만 추려 드려요.', null, '언제든 전체 보기로 되돌릴 수 있어요.']
        ]);

        group('편하게 보시려면', [
          ['🅰', '글씨가 작으면 「설정」에서 크게 키우세요.'],
          ['🔊', '소리가 나면 안 될 때는 오른쪽 위 「소리」를 누르세요.'],
          ['👣', '갈매기는 매일 기다려요. 못 오셔도 괜찮아요.']
        ]);

        box.appendChild(h('button', { class: 'btn primary wide', style: 'margin-top:18px', onclick: close }, '알겠어요'));
      });
    },

    /* ── 참여 기관 목록 ──
       "믿을 수 있는 정보"라는 말만으로는 못 믿습니다. 지금 이 소식들이
       실제로 어느 기관에서 왔는지 이름을 하나하나 밝혀 드립니다. */
    showSources() {
      sheet((box, close) => {
        const all = this.feedNotices();
        const guides = this.feedGuides();
        const bySource = {};
        [...all, ...guides].forEach(x => {
          if (!x.source) return;
          (bySource[x.source] = bySource[x.source] || { count: 0, url: null }).count++;
          if (!bySource[x.source].url && x.sourceUrl) bySource[x.source].url = x.sourceUrl;
        });
        const rows = Object.entries(bySource).sort((a, b) => b[1].count - a[1].count);

        box.appendChild(h('h2', { class: 'center', style: 'margin:8px 0 2px' }, '어디서 모아 왔나요'));
        box.appendChild(h('p', { class: 'muted center', style: 'margin:0 0 14px' },
          rows.length + '곳 공공기관 누리집에서 받아 왔어요.'));

        rows.forEach(([name, info]) => box.appendChild(h('div', {
          class: 'list-item', style: 'display:flex;justify-content:space-between;align-items:center;gap:8px'
        },
          info.url
            ? h('a', {
              href: info.url, target: '_blank', rel: 'noopener noreferrer',
              style: 'text-decoration:underline;color:inherit', onclick: () => Sound.tap()
            }, name)
            : h('span', null, name),
          h('span', { class: 'muted small', style: 'white-space:nowrap' }, info.count + '건'))));

        box.appendChild(h('p', { class: 'muted small', style: 'margin:14px 0 0;word-break:keep-all' },
          '기관 이름을 누르면 그 기관 누리집으로 바로 이동해요. ' +
          '개인·업체 정보는 담지 않고, 공공기관 정보만 다룹니다.'));
        box.appendChild(h('button', { class: 'btn primary wide', style: 'margin-top:14px', onclick: close }, '닫기'));
      });
    },

    about() {
      sheet((box, close) => {
        box.appendChild(h('h2', { class: 'center' }, '해운대 낱말 산책'));
        box.appendChild(h('p', { class: 'center muted' }, '판 1.0'));
        box.appendChild(h('div', { class: 'card' },
          h('h2', null, '자료 출처'),
          h('p', { class: 'small muted', style: 'word-break:keep-all;margin:0' },
            '낱말의 뜻풀이와 예문은 어르신께서 편히 읽으실 수 있도록 이 앱에서 직접 새로 썼습니다. ' +
            '낱말 선정과 난이도는 국립국어원의 「한국어 학습용 어휘 목록」 등 공공 자료를 참고했습니다. ' +
            '해운대 정보는 해운대구청·도서관·보건소·문화회관·벡스코·미술관 등 공공기관 누리집에서 ' +
            '주기적으로 받아 오며, 원문 주소를 함께 남겨 언제든 직접 확인하실 수 있습니다.')));
        box.appendChild(h('div', { class: 'card' },
          h('h2', null, '약속'),
          h('p', { class: 'small muted', style: 'word-break:keep-all;margin:0' },
            '놀이 화면에는 광고를 넣지 않습니다. 개인정보를 모으지 않습니다. ' +
            '내 나이·동네 정보는 이 기기 안에만 저장되고 바깥으로 나가지 않습니다. ' +
            '모든 기록은 이 기기 안에만 저장되며, 인터넷이 없어도 그대로 사용하실 수 있습니다.')));
        box.appendChild(h('button', { class: 'btn primary wide', onclick: close }, '닫기'));
      });
    },

    /* ── 첫 인사 (온보딩) ── */
    onboarding() {
      let step = 0;
      const d = Store.data;
      const render = () => {
        const v = $('view'); v.innerHTML = ''; guardTaps();
        $('tabbar').classList.add('hidden');
        this.top('처음 오셨네요', null,
          h('button', { class: 'iconbtn', onclick: finish }, '건너뛰기'));

        if (step === 0) {
          v.appendChild(h('div', { class: 'center', style: 'padding-top:24px' },
            dogEl('반가움', 150, 'introdog'),
            h('h2', { class: 'twoline', style: 'font-size:calc(28px * var(--fs));line-height:1.45;word-break:keep-all' }, '안녕하세요!\n오늘부터 함께 걸어요.'),
            h('p', { class: 'muted', style: 'word-break:keep-all' }, '이름을 지어 주시면 제가 인사드릴게요.'),
            h('button', { class: 'btn primary big wide', style: 'margin-top:20px', onclick: () => { step = 1; render(); } }, '다음')));
          
        } else if (step === 1) {
          // 첫 화면에서 "이름을 지어 주시면"이라 약속했으니, 다음은 곧바로 이름 짓기입니다.
          // (글씨 크기 조정이 먼저 나오면 약속과 순서가 어긋나 헷갈립니다)
          // '갸웃'은 몸 전체가 -8도 기울어 그려집니다(고개만 갸웃하는 게 아닙니다).
          // 이름을 소개하는 자리에서는 반듯한 인사 자세가 낫습니다.
          v.appendChild(h('div', { class: 'center' }, dogEl('반가움', 130, 'introdog2')));
          v.appendChild(h('div', { class: 'card' },
            h('h2', null, '갈매기 이름을 지어 주세요'),
            h('p', { class: 'muted' }, '마음에 드는 이름을 골라 주세요.'),
            (() => {
              const box = h('div', { class: 'stack' });
              ['누리', '해운이', '바다', '파도', '구름', '달이'].forEach(n => box.appendChild(
                h('button', { class: 'btn tool wide', onclick: () => { d.pet.name = n; Store.save(); step = 2; render(); } }, n)));
              return box;
            })(),
            h('button', {
              class: 'btn quiet wide', style: 'margin-top:10px', onclick: () => {
                askName(d.pet.name || '누리', n => { d.pet.name = n; Store.save(); step = 2; render(); });
              }
            }, '직접 지어 줄게요')));
        } else if (step === 2) {
          v.appendChild(h('div', { class: 'card' },
            h('h2', null, '글씨가 잘 보이시나요?'),
            h('p', { class: 'muted' }, '아래 단추를 눌러 편한 크기로 맞춰 주세요.'),
            (() => {
              const bar = h('div', { class: 'sizebar' });
              [1, 1.15, 1.3, 1.5, 1.75].forEach((val, i) => bar.appendChild(h('button', {
                class: Math.abs(d.settings.fs - val) < 0.01 ? 'on' : '', style: `font-size:${16 + i * 4}px`,
                onclick: () => { d.settings.fs = val; Store.save(); applySettings(); render(); }
              }, '가')));
              return bar;
            })(),
            h('div', { class: 'preview-box' },
              h('div', { style: 'font-size:calc(34px * var(--fs));font-weight:800' }, '온고지신'),
              h('div', { style: 'margin-top:8px' }, '옛것을 익혀 새로운 것을 안다는 뜻입니다.'))));
          v.appendChild(h('button', { class: 'btn primary big wide', onclick: () => { step = 3; render(); } }, '이 크기가 좋아요'));
        } else {
          v.appendChild(h('div', { class: 'center' },
            dogEl('신남', 130, 'introdog3'),
            h('h2', { class: 'twoline', style: 'word-break:keep-all;line-height:1.45' }, `안녕하세요!\n저는 ${d.pet.name}${H.particle(d.pet.name, '이에요', '예요')}.`),
            h('p', { class: 'muted', style: 'word-break:keep-all' }, '함께 낱말을 찾으며 천천히 걸어요. 어렵지 않아요.'),
            h('button', { class: 'btn primary big wide', style: 'margin-top:20px', onclick: finish }, '산책 나가기')));
        }
      };
      const finish = () => {
        d.onboarded = true; Store.save();
        $('tabbar').classList.remove('hidden');
        Store.touchToday();
        this.go('walk');
      };
      render();
    }
  };

  global.UI = { h, $, sheet, say, dogBlock, dogEl, dogMood, paw, applySettings, guardTaps, DOG_FACES, ICON, HUES };
  global.Store = Store; global.Sound = Sound; global.App = App;
  window.addEventListener('DOMContentLoaded', () => App.mount());
})(window);
