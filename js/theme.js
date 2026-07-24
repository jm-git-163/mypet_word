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

  /* ── 흩날리는 것들 ────────────────────────────────
     벚꽃·단풍·눈·씨앗이 다 같은 동그라미면 계절이 바뀐 줄 모릅니다.
     저마다 다른 모양으로 그립니다. */
  const svgd = (inner) =>
    `<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">${inner}</svg>`;

  /** 벚꽃잎 — 끝이 살짝 갈라진 한 장 */
  const petal = (fill) => svgd(
    `<path d="M12 2C8 6.5 5.5 10 5.5 14A6.5 6.5 0 0 0 12 20.5 6.5 6.5 0 0 0 18.5 14C18.5 10 16 6.5 12 2Z" fill="${fill}"/>`);

  /** 벚꽃 한 송이 — 다섯 잎 */
  const blossom = (fill) => {
    let p = '';
    for (let k = 0; k < 5; k++) {
      p += `<ellipse cx="12" cy="6.6" rx="3.4" ry="5" fill="${fill}" transform="rotate(${k * 72} 12 12)"/>`;
    }
    return svgd(p + `<circle cx="12" cy="12" r="2" fill="#ffe9a8"/>`);
  };

  /** 단풍잎 — 다섯 갈래 */
  const maple = (fill) => svgd(
    `<path d="M12 2l2.4 4.6 3.2-1.2-1.3 3.4 4.4.6-3.2 2.6 2.6 3.4-4.4-.6.4 4.6L12 16.6l-4.1 2.8.4-4.6-4.4.6L6.5 12 3.3 9.4l4.4-.6L6.4 5.4l3.2 1.2L12 2Z" fill="${fill}"/>`);

  /** 은행잎 — 부채 모양 */
  const ginkgo = (fill) => svgd(
    `<path d="M12 21v-7M12 14c-5 0-8-2.6-8-5.4C4 5 8 3 12 3s8 2 8 5.6c0 2.8-3 5.4-8 5.4Z" fill="${fill}" stroke="${fill}" stroke-width="1.4" stroke-linecap="round"/>`);

  /** 나뭇잎 */
  const leaf = (fill) => svgd(
    `<path d="M20 4C11 4 4 9 4 15.5c0 2 .8 3.6 1.8 4.5C9 16 13 13.4 18 12c-4 2.4-7.4 5.2-9.6 9C15 21 20 15.5 20 4Z" fill="${fill}"/>`);

  /** 눈송이 — 여섯 갈래에 잔가지 */
  const flake = (fill) => svgd(
    `<g fill="none" stroke="${fill}" stroke-width="1.6" stroke-linecap="round"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2L3.8 16.8"/><path d="M12 6l-2.4-2M12 6l2.4-2M12 18l-2.4 2M12 18l2.4 2M7 9.2 4.2 8.8M7 9.2 6.4 6.4M17 14.8l2.8.4M17 14.8l.6 2.8M17 9.2l2.8-.4M17 9.2l.6-2.8M7 14.8l-2.8.4M7 14.8l-.6 2.8"/></g>`);

  /** 진눈깨비 — 짧게 그은 선 */
  const sleet = (fill) => svgd(
    `<path d="M14 3 8 21" stroke="${fill}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`);

  /** 민들레 홀씨 */
  const seed = (fill) => svgd(
    `<g stroke="${fill}" stroke-width="1.3" stroke-linecap="round" fill="none"><path d="M12 21v-8"/><path d="M12 13 6 7M12 13l6-6M12 13l-8 2M12 13l8 2M12 13v-9"/></g><circle cx="12" cy="21" r="1.6" fill="${fill}"/>`);

  /** 반짝임 — 네 갈래 별빛 */
  const spark = (fill) => svgd(
    `<path d="M12 3c.9 5 3.1 7.2 8 8-4.9.9-7.1 3.1-8 8-.9-4.9-3.1-7.1-8-8 4.9-.8 7.1-3 8-8Z" fill="${fill}"/>`);

  /** 물보라 */
  const spray = (fill) => svgd(
    `<ellipse cx="12" cy="13" rx="7" ry="4.4" fill="${fill}"/><ellipse cx="12" cy="11.4" rx="3.4" ry="2" fill="#fff" opacity=".5"/>`);

  /** 모래알 */
  const grain = (fill) => svgd(`<circle cx="12" cy="12" r="4" fill="${fill}"/>`);

  /** 해파리 — 갓 아래로 촉수가 흔들립니다 */
  const jelly = (fill) => svgd(
    `<path d="M4.5 12a7.5 6.5 0 0 1 15 0Z" fill="${fill}"/>
     <path d="M4.5 12q2.2 2 4.6 0M9.1 12q2.4 2 4.8 0M13.9 12q2.4 2 4.8 0" fill="${fill}" opacity=".75"/>
     <g stroke="${fill}" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".85">
       <path d="M8 13.6q1.6 3 0 5.4"/><path d="M11.2 13.8q-1.4 3.4 .4 6.2"/>
       <path d="M14.2 13.8q1.6 3 .2 5.8"/><path d="M17 13.4q-1.4 2.6 .2 4.8"/>
     </g>`);

  /** 조개껍데기 — 부챗살 무늬 */
  const shell = (fill) => svgd(
    `<path d="M12 20a9 9 0 0 1-9-9 9 9 0 0 1 18 0 9 9 0 0 1-9 9Z" fill="${fill}" opacity=".9"/>
     <g stroke="#fff" stroke-width="1" opacity=".55" fill="none">
       <path d="M12 20V11M12 20l-5-7.6M12 20l5-7.6"/></g>`);

  /** 물방울 */
  const drop = (fill) => svgd(
    `<path d="M12 3c4 5.4 6 8.4 6 11a6 6 0 0 1-12 0c0-2.6 2-5.6 6-11Z" fill="${fill}"/>
     <ellipse cx="9.6" cy="14" rx="1.6" ry="2.4" fill="#fff" opacity=".5"/>`);

  /** 안개 알갱이 */
  const mote = (fill) => svgd(
    `<circle cx="12" cy="12" r="7" fill="${fill}" opacity=".55"/><circle cx="12" cy="12" r="3.4" fill="${fill}"/>`);

  /* 계절 — 같은 계절 안에서도 세 가지가 섞여 떨어집니다 */
  const DUST = {
    '봄': [blossom('#f7bcc8'), petal('#ffd3dc'), petal('#f9c9d2')],
    '여름': [leaf('#8fbf7a'), seed('#cfe0c2'), leaf('#a8cf95')],
    '가을': [maple('#e0954a'), ginkgo('#e8c25a'), leaf('#d2762f')],
    '겨울': [flake('#dcecf5'), flake('#ffffff'), sleet('#e3eef5')]
  };
  const EXTRA = {
    '밤': spark('#ffe6a8'),
    '해질녘': maple('#d98b45'),
    '새벽': mote('#e6dcd2')
  };

  /* 땅에 어울리는 것이 우선입니다. 바다에 벚꽃이 날리면 어색합니다. */
  const DUST_BY_LAND = {
    '바다': [jelly('#cfe6f2'), shell('#f0dcc4'), drop('#d8eef7'), spray('#eaf4f8')],
    '설산': [flake('#e8f2f8'), flake('#ffffff'), sleet('#dcecf5')],
    '숲': [leaf('#7fae6c'), seed('#cfe0c2'), ginkgo('#c9d8a0')],
    '꽃밭': [blossom('#f6b9c4'), blossom('#e2c4f0'), petal('#ffd9b0')],
    '과수원': [blossom('#f9d0d8'), leaf('#a8cf95'), petal('#f2dcc4')],
    '억새': [seed('#efe6d4'), seed('#e8dcc0'), grain('#dcc79a')],
    '논': [seed('#eee6cf'), grain('#dfe8cd'), leaf('#b9c98c')],
    '기와': [maple('#d8a05e'), leaf('#c9b48a'), grain('#e8dcc8')],
    '마을': [maple('#e0a868'), leaf('#c8b892'), petal('#f0d8c0')],
    '개울': [drop('#dceef2'), leaf('#a8cf95'), spray('#e6f2f4')],
    '산': [maple('#d68a4a'), leaf('#9cb87e'), seed('#dcd4c0')],
    '언덕': [petal('#f4c6cf'), seed('#e4dcc8'), leaf('#b6c795')]
  };

  /* 날씨가 가장 셉니다 — 눈이 오는데 벚꽃이 날리면 안 됩니다 */
  const DUST_BY_WEATHER = {
    '안개 낀': [mote('#f0f0f0'), mote('#e8e8e8'), mote('#f6f6f6')],
    '별 총총한': [spark('#ffe6a8'), spark('#fff3cf'), grain('#ffd98a')],
    '달빛 어린': [spark('#fff0c8'), mote('#f6ecd6'), grain('#ffe6a8')]
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

    /** 지금 테마의 색상각 — 풍경도 이 빛깔을 따릅니다 */
    HUE_DEG: {
      coral: 28, apricot: 30, sunset: 344, plum: 330,
      lavender: 262, sky: 216, ocean: 197, mint: 168,
      forest: 138, olive: 74, clay: 36, cocoa: 18,
      canola: 52, hydrangea: 240, magnolia: 302
    },

    /** 지금 켜져 있는 빛깔 이름 */
    themeKey() {
      const cls = [...document.body.classList].find(c => this.HUE_DEG[c.slice(2)] !== undefined);
      return cls ? cls.slice(2) : 'coral';
    },

    hueDeg() { return this.HUE_DEG[this.themeKey()]; },


    /** 그 단계의 풍경 정보 (그림은 한 번 그리면 재활용합니다) */
    forLevel(level) {
      /* 빛깔은 테마가, 풍경은 동네가 정합니다.
         빛깔을 하나로 고정해 두셔도 백 걸음마다 풍경은 바뀝니다. */
      const dark = document.body.classList.contains('dark');
      const tk = this.themeKey();
      const hoods = (global.Engine && global.Engine.NEIGHBORHOODS) || [];
      const hood = hoods.length
        ? hoods[Math.floor((level - 1) / 100) % hoods.length] : null;
      const land = (hood && hood.land) || (global.Scene.LAND_BY_THEME || {})[tk];

      const key = level + '|' + tk + '|' + land + (dark ? '|d' : '');
      if (!this.cache[key]) {
        this.cache[key] = global.Scene.make(level, this.HUE_DEG[tk], land, dark);
        // 오래된 것은 버립니다 (메모리 아끼기)
        const keys = Object.keys(this.cache);
        if (keys.length > 40) delete this.cache[keys[0]];
      }
      return this.cache[key];
    },

    apply(level) {
      const sc = this.forLevel(level);
      const dark = document.body.classList.contains('dark');
      const plain = document.body.classList.contains('contrast');
      const root = document.documentElement.style;

      /* 이 동네의 명소 그림이 있으면 그것을 '모든 화면'의 배경으로 씁니다.
         (동네 탭에서만 보이면 명소를 만든 보람이 없습니다) */
      const hoods = (global.Engine && global.Engine.NEIGHBORHOODS) || [];
      const hood = hoods.length ? hoods[Math.floor((level - 1) / 100) % hoods.length] : null;
      const artUrl = (hood && hood.art && global.Landmarks
        && global.Landmarks.url(hood.art, this.hueDeg())) || null;
      const bgUrl = artUrl || sc.url;

      /* 풍경은 4:3 그림인데 화면은 세로로 길어, background-size:cover 를 쓰면
         가로 폭의 절반 가까이가 잘려 나가 늘 같은 가운데 부분만 보입니다.
         (건물·파라솔 같은 볼거리가 양옆에 있으면 통째로 안 보이고,
         매 판 똑같은 자리만 보이니 단조롭습니다.)
         레벨마다 보이는 가로 위치를 다르게 돌려 다른 부분이 드러나게 합니다. */
      const px = 22 + ((level * 41) % 57);   // 22%~78% 사이를 오갑니다
      root.setProperty('--scene-px', px + '%');

      if (plain) {
        root.setProperty('--scene-a', '#ffffff');
        root.setProperty('--scene-b', '#ffffff');
        root.setProperty('--scene-glow', 'transparent');
        root.setProperty('--scene-img', 'none');
      } else if (dark) {
        root.setProperty('--scene-a', darken(sc.skyTop, 0.20));
        root.setProperty('--scene-b', darken(sc.skyBot, 0.16));
        root.setProperty('--scene-glow', darken(sc.glow, 0.42));
        root.setProperty('--scene-img', `url("${bgUrl}")`);
      } else {
        root.setProperty('--scene-a', sc.skyTop);
        root.setProperty('--scene-b', sc.skyBot);
        root.setProperty('--scene-glow', sc.glow);
        root.setProperty('--scene-img', `url("${bgUrl}")`);
      }
      // 같은 계절·때의 사진을 뒤에 아주 옅게 깔아 결을 더합니다
      const photo = plain ? null : this.photoFor(sc);
      root.setProperty('--scene-photo', photo ? `url("${photo}")` : 'none');
      // 그림 위에 덮는 반투명 막 — 낱말 칸이 또렷하게 보이도록
      // 사진을 더 옅게 덮습니다. 사진이 선명하면 낱말 칸의 글자가 묻혀
      // 눈이 피로해집니다. 배경은 '분위기'만 내면 됩니다.
      root.setProperty('--scene-veil', dark ? 'rgba(23,19,15,.88)' : 'rgba(250,247,244,.86)');

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
      const key = sc ? [sc.season, sc.time, sc.weather, sc.land].join('|') : '';
      if (box.dataset.key === key) return;         // 같은 것이면 다시 만들지 않습니다
      box.dataset.key = key;
      box.innerHTML = '';
      if (!sc || document.body.classList.contains('reduce-motion')) return;

      /* 무엇이 떨어질지 고르는 순서
           ① 겨울이면 무조건 눈  ② 날씨가 특별하면 그것
           ③ 땅에 어울리는 것    ④ 그래도 없으면 계절 것
         「눈 내린 마을에 벚꽃」 같은 어긋남을 이 순서가 막아 줍니다. */
      const pool =
        (sc.season === '겨울' ? DUST['겨울'] : null) ||
        DUST_BY_WEATHER[sc.weather] ||
        DUST_BY_LAND[sc.land] ||
        DUST[sc.season] || DUST['봄'];
      // 계절과 어긋나는 곁들이는 넣지 않습니다
      const extra = (sc.season === '겨울' || DUST_BY_WEATHER[sc.weather]) ? null : EXTRA[sc.time];
      const anims = ['driftA', 'driftB', 'driftC'];
      const COUNT = 12;

      for (let i = 0; i < COUNT; i++) {
        const s = document.createElement('span');
        // 다섯에 하나쯤은 때에 어울리는 것으로
        s.innerHTML = (extra && i % 5 === 3) ? extra : pool[i % pool.length];
        s.style.left = ((i * 8.3 + (i % 5) * 3.1) % 96) + '%';
        s.style.animationName = anims[i % anims.length];
        s.style.animationDelay = (-i * 2.9).toFixed(1) + 's';   // 처음부터 골고루 떠 있게
        s.style.animationDuration = (17 + (i % 5) * 4.5).toFixed(1) + 's';
        const sz = 11 + (i % 4) * 6;
        s.style.width = sz + 'px'; s.style.height = sz + 'px';
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
