/* ============================================================
   theme.js — 그 단계의 풍경을 화면에 입힙니다

   풍경 자체는 js/scene.js 가 레벨 번호로부터 그려 냅니다.
   여기서는 그것을 화면 배경과 낱말판 안쪽에 입히는 일만 합니다.

   · 글자는 절대 그림 위에 바로 얹지 않습니다. 판과 글상자는 불투명합니다.
     (배경 밝기에 따라 글자가 사라지면 안 됩니다 — DESIGN §4.2-8)
   · 「또렷하게 보기」에서는 배경을 완전히 끕니다.
   ============================================================ */
(function (global) {
  'use strict';

  /* 계절마다 흩날리는 것 — 어느 풍경에나 무언가 떨어집니다 */
  const DUST = {
    '봄': ['🌸', '🌸', '🌼'],
    '여름': ['🍃', '🍃', '🌿'],
    '가을': ['🍁', '🍂', '🍁'],
    '겨울': ['❄', '❄', '🌨']
  };
  /* 때와 날씨에 따라 한 가지가 더 섞입니다 */
  const EXTRA = {
    '밤': '✨',
    '해질녘': '🍂',
    '새벽': '·'
  };

  function darken(css, amt) {
    // hsl(h s% l%) 문자열의 밝기만 낮춥니다
    const m = css.match(/hsl\((\d+) (\d+)% (\d+)%\)/);
    if (!m) return css;
    const [, h, s, l] = m;
    return `hsl(${h} ${Math.round(+s * 0.55)}% ${Math.max(8, Math.round(+l * amt))}%)`;
  }

  /* 계절·때 이름 ↔ 사진 파일 이름 */
  const SEASON_KEY = { '봄': 'spring', '여름': 'summer', '가을': 'autumn', '겨울': 'winter' };
  const TIME_KEY = { '새벽': 'dawn', '아침': 'morning', '한낮': 'noon', '해질녘': 'dusk', '밤': 'night' };

  const Theme = {
    current: -1,
    cache: {},
    photos: null,          // images/bg/index.json 을 읽어 둡니다

    /** 사진 목록을 한 번만 확인합니다 (없으면 그림만 씁니다) */
    loadPhotos() {
      if (this.photos !== null) return;
      this.photos = {};
      fetch('images/bg/index.json', { cache: 'no-cache' })
        .then(r => r.ok ? r.json() : null)
        .then(j => { if (j && j.slots) { this.photos = j.slots; this.apply(this.current > 0 ? this.current : 1); } })
        .catch(() => { });
    },

    /**
     * 그 단계의 계절·때에 어울리는 사진 한 장.
     * 아무 사진이나 쓰면 톤이 어긋나므로 반드시 같은 갈래에서만 고릅니다.
     */
    photoFor(sc) {
      const slot = SEASON_KEY[sc.season] + '-' + TIME_KEY[sc.time];
      const list = this.photos && this.photos[slot];
      if (!list || !list.length) return null;
      const pick = list[(sc.level + list.length) % list.length];
      return new URL('images/bg/' + pick, document.baseURI).href;
    },

    /** 그 단계의 풍경 정보 (그림은 한 번 그리면 재활용합니다) */
    forLevel(level) {
      if (!this.cache[level]) {
        this.cache[level] = global.Scene.make(level);
        // 오래된 것은 버립니다 (메모리 아끼기)
        const keys = Object.keys(this.cache);
        if (keys.length > 40) delete this.cache[keys[0]];
      }
      return this.cache[level];
    },

    apply(level) {
      const sc = this.forLevel(level);
      const dark = document.body.classList.contains('dark');
      const plain = document.body.classList.contains('contrast');
      const root = document.documentElement.style;

      if (plain) {
        root.setProperty('--scene-a', '#ffffff');
        root.setProperty('--scene-b', '#ffffff');
        root.setProperty('--scene-glow', 'transparent');
        root.setProperty('--scene-img', 'none');
      } else if (dark) {
        root.setProperty('--scene-a', darken(sc.skyTop, 0.20));
        root.setProperty('--scene-b', darken(sc.skyBot, 0.16));
        root.setProperty('--scene-glow', darken(sc.glow, 0.42));
        root.setProperty('--scene-img', `url("${sc.url}")`);
      } else {
        root.setProperty('--scene-a', sc.skyTop);
        root.setProperty('--scene-b', sc.skyBot);
        root.setProperty('--scene-glow', sc.glow);
        root.setProperty('--scene-img', `url("${sc.url}")`);
      }
      // 같은 계절·때의 사진을 뒤에 아주 옅게 깔아 결을 더합니다
      const photo = plain ? null : this.photoFor(sc);
      root.setProperty('--scene-photo', photo ? `url("${photo}")` : 'none');
      // 그림 위에 덮는 반투명 막 — 낱말 칸이 또렷하게 보이도록
      root.setProperty('--scene-veil', dark ? 'rgba(26,19,16,.80)' : 'rgba(255,255,255,.68)');

      this.current = level;
      this.loadPhotos();
      this.dust(plain ? null : sc);
      // 배경음도 이 풍경에 맞춥니다 (봄은 밝고 겨울은 느긋하게)
      if (global.Audio2 && global.Audio2.setScene) global.Audio2.setScene(sc);
      return sc;
    },

    /**
     * 배경에 흩날리는 것 (글자를 가리지 않도록 옅고 느리게)
     * 계절 것 + 때에 어울리는 것 한 가지를 섞어 열두 개를 띄웁니다.
     */
    dust(sc) {
      let box = document.getElementById('dustbox');
      if (!box) {
        box = document.createElement('div');
        box.id = 'dustbox';
        box.className = 'dustbox';
        box.setAttribute('aria-hidden', 'true');   // 화면 낭독기는 읽지 않습니다
        document.body.insertBefore(box, document.body.firstChild);
      }
      const key = sc ? sc.season + '|' + sc.time : '';
      if (box.dataset.key === key) return;         // 같은 것이면 다시 만들지 않습니다
      box.dataset.key = key;
      box.innerHTML = '';
      if (!sc || document.body.classList.contains('reduce-motion')) return;

      const pool = DUST[sc.season] || ['🍃'];
      const extra = EXTRA[sc.time];
      const anims = ['driftA', 'driftB', 'driftC'];
      const COUNT = 12;

      for (let i = 0; i < COUNT; i++) {
        const s = document.createElement('span');
        // 다섯에 하나쯤은 때에 어울리는 것으로
        s.textContent = (extra && i % 5 === 3) ? extra : pool[i % pool.length];
        s.style.left = ((i * 8.3 + (i % 5) * 3.1) % 96) + '%';
        s.style.animationName = anims[i % anims.length];
        s.style.animationDelay = (-i * 2.9).toFixed(1) + 's';   // 처음부터 골고루 떠 있게
        s.style.animationDuration = (17 + (i % 5) * 4.5).toFixed(1) + 's';
        s.style.fontSize = (13 + (i % 4) * 7) + 'px';
        s.style.setProperty('--dust-o', (0.22 + (i % 4) * 0.07).toFixed(2));
        box.appendChild(s);
      }
    },

    clear() {
      const box = document.getElementById('dustbox');
      if (box) { box.innerHTML = ''; box.dataset.ch = ''; }
    }
  };

  global.Theme = Theme;
})(window);
