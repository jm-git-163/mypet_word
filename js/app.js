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
        pet: { name: '복실이', bond: 1 },
        onboarded: false,
        settings: { fs: 1, sfx: true, bgm: false, hue: 'auto', gentle: false, theme: 'light', contrast: false, motion: false }
      };
    },
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        this.data = raw ? Object.assign(this.fresh(), JSON.parse(raw)) : this.fresh();
        if (!this.data.ability.GLOBAL) this.data.ability.GLOBAL = { theta: 1200, n: 0 };
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
    bark() { global.Audio2.bark(); }
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

  /** 지금 쓸 빛깔 이름 ('자동'이면 지금 동네의 빛깔) */
  function hueNow() {
    const s = Store.data.settings;
    if (s.hue && s.hue !== 'auto') return s.hue;
    const i = Math.floor((Store.data.level - 1) / 100) % NEIGHBORHOODS.length;
    return NEIGHBORHOODS[i].hue || 'coral';
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
        value: cur || '', 'aria-label': '강아지 이름',
        placeholder: '예) 복실이'
      });
      box.appendChild(input);

      // 고르기만 해도 되도록 미리 지은 이름을 함께 놓습니다
      const chips = h('div', { class: 'chips' });
      ['복실이', '누리', '해피', '보리', '초코', '설이', '몽이', '별이'].forEach(n =>
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
  const TAB_NAME = { walk: '산책', hood: '동네', pet: '강아지', learn: '배움', set: '설정' };
  const SVG = (inner) =>
    `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none"
       stroke="currentColor" stroke-width="2" stroke-linecap="round"
       stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

  /* 마당의 상태 — 지남 / 지금 여기 / 아직
     ⬜ 같은 이모지는 그냥 네모로 보여 무슨 뜻인지 알 수 없습니다. */
  const STEP_ICON = {
    done: SVG('<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/>' +
      '<path d="M8 12.3l2.6 2.6L16 9.6" stroke="var(--white)" stroke-width="2.2"/>'),
    here: SVG('<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/>' +
      '<ellipse cx="12" cy="14.4" rx="3.1" ry="2.5" fill="var(--white)" stroke="none"/>' +
      '<ellipse cx="8.1" cy="11" rx="1.4" ry="1.8" fill="var(--white)" stroke="none"/>' +
      '<ellipse cx="10.7" cy="8.9" rx="1.4" ry="1.8" fill="var(--white)" stroke="none"/>' +
      '<ellipse cx="13.3" cy="8.9" rx="1.4" ry="1.8" fill="var(--white)" stroke="none"/>' +
      '<ellipse cx="15.9" cy="11" rx="1.4" ry="1.8" fill="var(--white)" stroke="none"/>'),
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
    ['cocoa', '코코아', '#a67464']
  ];

  /* ══════════ 아래 띠 아이콘 ══════════════════════
     이모지(🏡🐕📖⚙️) 대신 직접 그립니다.
     이모지는 기기마다 그림·색·굵기가 달라 한 벌로 보이지 않고,
     그것이 화면이 어수선해 보이는 가장 큰 까닭이었습니다.
     여기서는 굵기 2, 크기 24 로 통일해 한 손에서 그린 것처럼 만듭니다.
     ══════════════════════════════════════════════ */
  /* 놀이 화면에서도 쓰는 아이콘 */
  const ICON = {
    paw: SVG('<ellipse cx="12" cy="16" rx="4.2" ry="3.4" fill="currentColor" stroke="none"/>' +
      '<ellipse cx="6.6" cy="11.4" rx="1.9" ry="2.4" fill="currentColor" stroke="none"/>' +
      '<ellipse cx="10.2" cy="8.4" rx="1.9" ry="2.5" fill="currentColor" stroke="none"/>' +
      '<ellipse cx="13.8" cy="8.4" rx="1.9" ry="2.5" fill="currentColor" stroke="none"/>' +
      '<ellipse cx="17.4" cy="11.4" rx="1.9" ry="2.4" fill="currentColor" stroke="none"/>'),
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
    // 발자국 — 산책
    walk: SVG('<ellipse cx="12" cy="16" rx="4.2" ry="3.4" fill="currentColor" stroke="none"/>' +
      '<ellipse cx="6.6" cy="11.4" rx="1.9" ry="2.4" fill="currentColor" stroke="none"/>' +
      '<ellipse cx="10.2" cy="8.4" rx="1.9" ry="2.5" fill="currentColor" stroke="none"/>' +
      '<ellipse cx="13.8" cy="8.4" rx="1.9" ry="2.5" fill="currentColor" stroke="none"/>' +
      '<ellipse cx="17.4" cy="11.4" rx="1.9" ry="2.4" fill="currentColor" stroke="none"/>'),
    // 집 — 동네
    hood: SVG('<path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.6V19h11V9.6"/><path d="M10 19v-4.5h4V19"/>'),
    // 강아지 얼굴
    pet: SVG('<path d="M5 7.5c0-2 1.2-2.8 2.6-2 1 .6 1.7 1.6 2 2.4"/>' +
      '<path d="M19 7.5c0-2-1.2-2.8-2.6-2-1 .6-1.7 1.6-2 2.4"/>' +
      '<path d="M12 19c-3.6 0-6.2-2.4-6.2-5.6S8.4 7.6 12 7.6s6.2 2.6 6.2 5.8S15.6 19 12 19Z"/>' +
      '<circle cx="9.8" cy="13" r="1" fill="currentColor" stroke="none"/>' +
      '<circle cx="14.2" cy="13" r="1" fill="currentColor" stroke="none"/>' +
      '<path d="M12 15.2v1.1"/>'),
    // 펼친 책 — 배움
    learn: SVG('<path d="M12 7.2C10.4 6 8.4 5.5 5 5.6v11.6c3.4-.1 5.4.4 7 1.6"/>' +
      '<path d="M12 7.2c1.6-1.2 3.6-1.7 7-1.6v11.6c-3.4-.1-5.4.4-7 1.6"/><path d="M12 7.2v11.6"/>'),
    // 톱니 — 설정
    set: SVG('<circle cx="12" cy="12" r="3.1"/>' +
      '<path d="M12 3.6v2.2M12 18.2v2.2M20.4 12h-2.2M5.8 12H3.6' +
      'M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6M18.1 18.1l-1.6-1.6M7.5 7.5 5.9 5.9"/>')
  };

  /* ══════════ 강아지 ══════════════════════════════ */
  const DOG_FACES = { 반가움: '🐕', 편안함: '🐶', 갸웃: '🐕‍🦺', 신남: '🐩', 보고싶음: '🐕' };

  /**
   * 강아지 발바닥 하나.
   * 이모지(🐾)는 작게 쓰면 무엇인지 알아보기 어려워 직접 그립니다.
   * @param state 'on'(지나옴) | 'now'(지금 여기) | ''(아직)
   */
  function paw(state) {
    const el = h('span', { class: 'paw' + (state ? ' ' + state : ''), 'aria-hidden': 'true' });
    el.innerHTML =
      '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor">' +
      '<ellipse cx="12" cy="16.6" rx="6.1" ry="5.1"/>' +
      '<ellipse cx="4.6" cy="10.2" rx="2.7" ry="3.3"/>' +
      '<ellipse cx="9.6" cy="6.3" rx="2.7" ry="3.5"/>' +
      '<ellipse cx="14.4" cy="6.3" rx="2.7" ry="3.5"/>' +
      '<ellipse cx="19.4" cy="10.2" rx="2.7" ry="3.3"/>' +
      '</svg>';
    return el;
  }

  /** 풍경 이름 — 상자 없이, 곁말로 */
  function sceneCaption(name) {
    return h('div', { class: 'scene-caption' }, h('span', null, name));
  }

  /** 움직이는 강아지 하나 (그림 파일이 아니라 그려서 움직입니다) */
  function dogEl(mood, size, id) {
    const box = h('div', { class: 'dog', id: id || 'dog' });
    box.innerHTML = global.Dog.make(mood, size || 96);
    return box;
  }

  /** 강아지 + 말풍선 한 줄 */
  function dogBlock(mood, line) {
    // 강아지를 116 → 88 로 줄였습니다.
    // 인사말 한 줄에 화면 위쪽을 통째로 내주고 있었습니다.
    return h('div', { class: 'dog-area' },
      dogEl(mood, 88),
      line ? h('div', { class: 'speech' }, line) : null);
  }

  /** 표정 바꾸기 */
  function dogMood(id, mood, size) {
    const box = $(id || 'dog');
    if (box) box.innerHTML = global.Dog.make(mood, size || 96);
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
    },

    go(tab) {
      this.tab = tab;
      this.renderTabs();
      const v = $('view'); v.innerHTML = ''; v.scrollTop = 0;
      ({ walk: this.scrWalk, hood: this.scrHood, pet: this.scrPet, learn: this.scrLearn, set: this.scrSet })[tab].call(this, v);
      guardTaps();
    },

    /** 위 띠의 발자국 숫자를 새로 적습니다 */
    topFootprints() {
      const el = document.getElementById('footchip');
      if (el) el.textContent = '🐾 ' + Store.data.footprints;
    },

    top(title, left, right) {
      const t = $('topbar'); t.innerHTML = '';
      t.appendChild(left || h('div', { class: 'spacer' }));
      t.appendChild(h('h1', null, title));
      t.appendChild(right || h('div', { class: 'spacer' }));
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
      v.appendChild(sceneCaption(scene.name));
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
      pic.style.backgroundImage = `url("${global.Theme.forLevel(d.level).url}")`;
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
        const row = h('div', { class: 'list-item' + (i === hoodIdx ? '' : ' faded') });
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
      this.top('우리 강아지');
      const moods = ['편안함', '반가움', '신남'];
      const mood = moods[d.days.length % moods.length];
      v.appendChild(h('div', { class: 'card center' },
        dogEl(mood, 150, 'petdog'),
        h('h2', { class: 'center', style: 'margin-top:8px' }, d.pet.name),
        h('p', { class: 'muted center' }, `함께한 지 ${d.days.length}일 · 유대 ${d.pet.bond}단계`),
        h('div', { class: 'row', style: 'justify-content:center;margin-top:8px' },
          h('button', {
            class: 'btn go', onclick: () => {
              dogMood('petdog', '신남', 150);
              const svg = $('petdog').querySelector('.dogsvg');
              if (svg) { svg.classList.add('pat'); setTimeout(() => dogMood('petdog', '반가움', 150), 1600); }
              Sound.right();
              this.toast(v, `${d.pet.name}가 꼬리를 흔들어요!`);
            }
          }, '🤗 쓰다듬기'),
          h('button', {
            class: 'btn', onclick: () => {
              if (d.footprints < 8) return say('발자국이 조금 모자라요. 산책을 다녀오면 채워져요.', '🐾');
              d.footprints -= 8; Store.save();
              Sound.bark();                     // 멍멍!
              // 간식을 주면 아주 신나서 방방 뜁니다
              dogMood('petdog', '신남', 150);
              const sv = $('petdog').querySelector('.dogsvg');
              if (sv) {
                sv.classList.add('jump');
                setTimeout(() => { sv.classList.remove('jump'); dogMood('petdog', '반가움', 150); }, 2600);
              }
              App.topFootprints();
              this.toast(v, `${d.pet.name}가 폴짝폴짝 뛰며 먹었어요!`);
            }
          }, '🦴 간식 주기 ', h('span', { class: 'nobr' }, '🐾8')))
      ));
      v.appendChild(h('div', { class: 'card' },
        h('h2', null, '함께한 기록'),
        h('div', { class: 'list-item' }, h('span', { class: 'lead' }, '📅'), h('span', { class: 'grow' }, '함께한 날'), h('span', { class: 'badge' }, d.days.length + '일')),
        h('div', { class: 'list-item' }, h('span', { class: 'lead' }, '🐾'), h('span', { class: 'grow' }, '모은 발자국'), h('span', { class: 'badge' }, d.footprints + '개')),
        h('div', { class: 'list-item' }, h('span', { class: 'lead' }, '🚶'), h('span', { class: 'grow' }, '함께 걸은 산책'), h('span', { class: 'badge' }, d.totalDone + '번'))
      ));
      v.appendChild(h('div', { class: 'card' },
        h('h2', null, '이름 바꾸기'),
        h('button', {
          class: 'btn tool wide', onclick: () => {
            askName(d.pet.name, n => { d.pet.name = n; Store.save(); this.go('pet'); });
          }
        }, '✏️ 이름 바꾸기')));
    },

    toast(v, msg) {
      const old = document.getElementById('toastbox'); if (old) old.remove();
      const box = h('div', { class: 'card center', id: 'toastbox', style: 'background:var(--secondary-c);color:var(--on-secondary-c);font-weight:700' }, msg);
      v.insertBefore(box, v.firstChild); v.scrollTop = 0;
    },

    /* ── 배움 ── */
    scrLearn(v) {
      const d = Store.data;
      this.top('배움');
      const due = Generator.dueEntries(d, Date.now());
      const known = Object.keys(d.memory);

      v.appendChild(h('div', { class: 'card' },
        h('h2', null, '오늘 되새길 낱말'),
        h('p', { class: 'muted', style: 'margin:0 0 14px' }, due.length ? `${due.length}개를 다시 볼 때가 되었어요.` : '오늘은 되새길 낱말이 없어요. 편히 쉬셔도 돼요.'),
        due.length ? h('button', { class: 'btn go wide', onclick: () => global.Game.startReview() }, '되새기러 가기') : null));

      const nav = [
        ['속담 마당', () => global.Game.startProverbs()],
        ['최근 만난 낱말', () => this.listWords(d.recent.map(id => DB.byId[id]).filter(Boolean), '최근 만난 낱말')],
        ['간직한 낱말', () => this.listWords(d.fav.map(id => DB.byId[id]).filter(Boolean), '간직한 낱말')],
        ['나의 기록', () => this.stats()]
      ];
      nav.forEach(([name, fn]) => v.appendChild(
        h('button', { class: 'list-item', onclick: fn }, h('span', { class: 'grow' }, name), h('span', { class: 'badge' }, '보기'))));

      v.appendChild(h('div', { class: 'card center' },
        h('div', { class: 'muted small' }, '지금까지 만난 낱말'),
        h('div', { class: 'bignum' }, known.length + '개'),
        h('div', { class: 'muted small' }, `꾸러미에 담긴 낱말 ${DB.entries.length}개 가운데`)));
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
          '「동네 따라」로 두시면 백 걸음마다 분위기가 바뀝니다.'),
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
          box.appendChild(mk('auto', '동네 따라',
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

        /* ── 한 묶음 ──
           [그림, 설명, 값, 덧붙이는 말]
           값은 오른쪽에 세로로 맞춰 값표처럼 훑을 수 있게 둡니다. */
        const group = (title, rows) => {
          const g = h('div', { class: 'help-group' }, h('div', { class: 'help-head' }, title));
          rows.forEach(([ic, t, price, note]) => g.appendChild(h('div', { class: 'help-row' },
            h('span', { class: 'help-ic' }, ic),
            h('span', { class: 'help-txt' }, t,
              note ? h('span', { class: 'help-note' }, note) : null),
            price ? h('span', { class: 'help-price' }, price) : null)));
          box.appendChild(g);
        };

        group('놀이 방법', [
          ['🐾', '「산책 나가기」를 누르면 낱말 판이 나와요.'],
          ['👆', '아래 글자를 누르면 판의 빈 칸에 들어가요.'],
          ['↩', '잘못 넣으셨으면 「지우기」를 누르시면 돼요.'],
          ['⏭', '어려우면 「오늘은 넘어가기」로 넘기셔도 돼요.', null, '아무 손해가 없어요.']
        ]);

        group('막히셨을 때', [
          ['🕒', '기다리기', '공짜', '가만히 계시면 뜻풀이가 저절로 열려요'],
          ['🎯', '글자 하나', '🐾 3', '빈 칸 하나를 채워드려요'],
          ['✨', '낱말 하나', '🐾 10', '낱말을 통째로 채워드려요']
        ]);

        group('발자국 모으기', [
          ['🐾', '혼자 힘으로 낱말을 맞히면', '🐾 1'],
          ['🎉', '판을 다 채우면', '🐾 8'],
          ['🏅', '열 판을 걸어 마당 하나를 마치면', '🐾 20'],
          ['🌅', '하루에 처음 오시면', '🐾 10']
        ]);

        group('편하게 보시려면', [
          ['🅰', '글씨가 작으면 「설정」에서 크게 키우세요.'],
          ['🔊', '소리가 나면 안 될 때는 오른쪽 위 「소리」를 누르세요.'],
          ['🏠', '강아지는 매일 기다려요. 못 오셔도 괜찮아요.']
        ]);

        box.appendChild(h('button', { class: 'btn primary wide', style: 'margin-top:18px', onclick: close }, '알겠어요'));
      });
    },

    about() {
      sheet((box, close) => {
        box.appendChild(h('h2', { class: 'center' }, '낱말 산책'));
        box.appendChild(h('p', { class: 'center muted' }, '판 1.0'));
        box.appendChild(h('div', { class: 'card' },
          h('h2', null, '자료 출처'),
          h('p', { class: 'small muted', style: 'word-break:keep-all;margin:0' },
            '낱말의 뜻풀이와 예문은 어르신께서 편히 읽으실 수 있도록 이 앱에서 직접 새로 썼습니다. ' +
            '낱말 선정과 난이도는 국립국어원의 「한국어 학습용 어휘 목록」 등 공공 자료를 참고했습니다.')));
        box.appendChild(h('div', { class: 'card' },
          h('h2', null, '약속'),
          h('p', { class: 'small muted', style: 'word-break:keep-all;margin:0' },
            '놀이 화면에는 광고를 넣지 않습니다. 개인정보를 모으지 않습니다. ' +
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
            h('h2', { style: 'font-size:calc(30px * var(--fs));line-height:1.4;word-break:keep-all' }, '안녕하세요!\n오늘부터 함께 걸어요.'),
            h('p', { class: 'muted', style: 'word-break:keep-all' }, '이름을 지어 주시면 제가 인사드릴게요.'),
            h('button', { class: 'btn primary big wide', style: 'margin-top:20px', onclick: () => { step = 1; render(); } }, '다음')));
          
        } else if (step === 1) {
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
          v.appendChild(h('button', { class: 'btn primary big wide', onclick: () => { step = 2; render(); } }, '이 크기가 좋아요'));
        } else if (step === 2) {
          v.appendChild(h('div', { class: 'center' }, dogEl('갸웃', 130, 'introdog2')));
          v.appendChild(h('div', { class: 'card' },
            h('h2', null, '강아지 이름을 지어 주세요'),
            h('p', { class: 'muted' }, '마음에 드는 이름을 골라 주세요.'),
            (() => {
              const box = h('div', { class: 'stack' });
              ['복실이', '누리', '해피', '보리', '초코', '설이'].forEach(n => box.appendChild(
                h('button', { class: 'btn tool wide', onclick: () => { d.pet.name = n; Store.save(); step = 3; render(); } }, n)));
              return box;
            })(),
            h('button', {
              class: 'btn quiet wide', style: 'margin-top:10px', onclick: () => {
                askName(d.pet.name || '복실이', n => { d.pet.name = n; Store.save(); step = 3; render(); });
              }
            }, '직접 지어 줄게요')));
        } else {
          v.appendChild(h('div', { class: 'center' },
            dogEl('신남', 130, 'introdog3'),
            h('h2', { style: 'word-break:keep-all;line-height:1.4' }, `안녕하세요!\n저는 ${d.pet.name}${H.particle(d.pet.name, '이에요', '예요')}.`),
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

  global.UI = { h, $, sheet, say, dogBlock, dogEl, dogMood, paw, sceneCaption, applySettings, guardTaps, DOG_FACES, ICON, HUES };
  global.Store = Store; global.Sound = Sound; global.App = App;
  window.addEventListener('DOMContentLoaded', () => App.mount());
})(window);
