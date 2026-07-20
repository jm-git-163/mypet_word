/* ============================================================
   scene.js — 산책 한 걸음마다 새로 그리는 풍경

   사진을 수만 장 받아 둘 수는 없습니다. 그래서 풍경도 '그립니다'.
   레벨 번호를 씨앗 삼아 하늘·해달·능선·나무·날씨를 그려 내므로
   단계가 수만이든 수십만이든 풍경이 겹치지 않습니다.

   · 그림 파일이 없어 앱이 무거워지지 않고, 인터넷 없이도 나옵니다.
   · 색은 '봄·여름·가을·겨울 × 새벽·아침·한낮·해질녘·밤' 스무 가지
     고운 색조 안에서만 고릅니다. 그래서 아무리 많아도 분위기가 흐트러지지 않습니다.
   · 채도를 낮게 잡아 눈이 편하고, 낱말 칸을 가리지 않습니다.
   ============================================================ */
(function (global) {
  'use strict';

  /* ── 씨앗 난수 ── */
  function hash32(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function rngFrom(seed) {
    let a = hash32(String(seed));
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── 색조 밑그림 ────────────────────────────
     계절이 색깔을, 때가 밝기를 정합니다. */
  const SEASONS = [
    { name: '봄', hue: 344, hue2: 96, leaf: 96 },   // 분홍 하늘, 연둣빛 산
    { name: '여름', hue: 168, hue2: 140, leaf: 140 },  // 물빛 하늘, 짙은 초록
    { name: '가을', hue: 28, hue2: 18, leaf: 24 },   // 감빛 하늘, 단풍
    { name: '겨울', hue: 208, hue2: 210, leaf: 205 }   // 시린 하늘, 눈빛 산
  ];
  const TIMES = [
    { name: '새벽', skyL: [93, 86], sat: 22, ridgeL: [78, 68, 58], sun: 'none', glow: 30 },
    { name: '아침', skyL: [95, 88], sat: 34, ridgeL: [80, 70, 60], sun: 'sun', glow: 46 },
    { name: '한낮', skyL: [96, 90], sat: 30, ridgeL: [78, 68, 57], sun: 'sun', glow: 40 },
    { name: '해질녘', skyL: [92, 82], sat: 46, ridgeL: [72, 61, 50], sun: 'sun', glow: 58 },
    { name: '밤', skyL: [88, 80], sat: 26, ridgeL: [70, 60, 50], sun: 'moon', glow: 34 }
  ];
  /* 날씨: t 는 어울리는 때. (한낮에 노을이 지면 말이 안 됩니다) */
  const WEATHERS = [
    { name: '맑은', cloud: 0, veil: 0 },
    { name: '구름 낀', cloud: 3, veil: 0 },
    { name: '바람 부는', cloud: 2, veil: 0.06 },
    { name: '고요한', cloud: 1, veil: 0.10 },
    { name: '안개 낀', cloud: 1, veil: 0.22, t: ['새벽', '아침', '밤'] },
    { name: '볕 좋은', cloud: 0, veil: 0.04, t: ['아침', '한낮'] },
    { name: '이슬 맺힌', cloud: 1, veil: 0.14, t: ['새벽', '아침'] },
    { name: '노을 진', cloud: 2, veil: 0.03, t: ['해질녘'] },
    { name: '달빛 어린', cloud: 1, veil: 0.08, t: ['밤'] },
    { name: '별 총총한', cloud: 0, veil: 0, t: ['밤'] }
  ];

  /* 철의 앞뒤 (이름만 달라지고 색은 같은 계절을 따릅니다) */
  const PHASES = ['이른 ', '', '늦'];

  /* 자리 이름. s 는 어울리는 계절. (겨울에 단풍 골짜기는 말이 안 됩니다) */
  const PLACES = [
    ['언덕'], ['나지막한 언덕'], ['언덕배기'], ['바위 언덕'], ['뒷동산'],
    ['들녘'], ['너른 들녘'], ['산모롱이'], ['산길'], ['갈림길'],
    ['골짜기'], ['깊은 골짜기'], ['여울목'], ['시냇가'],
    ['개울가'], ['자갈 개울가'], ['연못가'], ['나루터'], ['모래톱'],
    ['솔밭'], ['솔밭 길'], ['깊은 솔밭'], ['대숲'], ['밤나무 숲'],
    ['바닷가'], ['조용한 바닷가'], ['갯벌 바닷가'],
    ['마을 어귀'], ['기와 마을'], ['초가 마을'], ['마을 뒷길'], ['돌담길'],
    ['오솔길'], ['호젓한 오솔길'], ['숲 오솔길'],
    ['둑길'], ['강 둑길'], ['논 둑길'], ['섶다리'], ['징검다리'],
    ['고갯마루'], ['옛 고갯마루'], ['옛 성터'], ['절 마당'],
    ['느티나무 아래'], ['나무 그늘'], ['우물가'], ['빨래터'], ['물레방아'],
    ['장터 거리'], ['장독대'],
    // 철을 타는 자리
    ['들꽃 언덕', ['봄']], ['버들 개울가', ['봄']], ['진달래 언덕', ['봄']],
    ['보리밭', ['봄', '여름']], ['연잎 연못', ['여름']], ['미루나무 길', ['여름']],
    ['누런 들녘', ['가을']], ['단풍 골짜기', ['가을']], ['감나무 마당', ['가을']],
    ['억새밭', ['가을']], ['메밀밭', ['가을']], ['갈대밭', ['가을', '겨울']],
    ['눈 덮인 언덕', ['겨울']], ['서리 내린 들', ['겨울']]
  ];

  /* 어두운 화면에서는 밝기를 통째로 낮춰 그립니다.
     밝은 그림을 그대로 두고 투명도만 낮추면
     어두운 화면에 환한 풍경이 떠 있게 됩니다. */
  let DIM = false;
  const hsl = (h, s, l) => {
    const L = DIM ? 6 + l * 0.26 : l;          // 96% → 31%, 60% → 22%
    const S = DIM ? s * 0.72 : s;
    return `hsl(${Math.round(h)} ${Math.round(S)}% ${Math.round(L)}%)`;
  };

  /** 능선 하나를 그립니다 (씨앗에 따라 모양이 달라집니다) */
  function ridge(rng, baseY, amp, W) {
    const pts = 5 + Math.floor(rng() * 3);
    let d = `M0 ${baseY + (rng() - .5) * amp}`;
    for (let i = 1; i <= pts; i++) {
      const x = (W / pts) * i;
      const y = baseY + (rng() - .5) * amp * 2;
      const cx = x - W / pts / 2;
      d += ` Q${cx.toFixed(0)} ${(y - amp * (0.3 + rng() * 0.9)).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)}`;
    }
    return d + ` L${W} 320 L0 320 Z`;
  }

  /* 빛깔마다 다른 땅을 씁니다.
     색만 바뀌고 그림이 늘 산이면 몇 판 지나 똑같아 보입니다. */
  const LAND_BY_THEME = {
    coral: '산', apricot: '마을', sunset: '언덕', plum: '과수원',
    lavender: '꽃밭', sky: '설산', ocean: '바다', mint: '개울',
    forest: '숲', olive: '논', clay: '기와', cocoa: '억새'
  };

  const Scene = {
    SEASONS, TIMES, WEATHERS, PLACES, LAND_BY_THEME,

    /**
     * 레벨 번호 → 풍경 정보 (이름·색·그림)
     * @param level 단계
     * @param hue   테마 빛깔의 색상각(0~360). 주면 하늘·능선을 그 빛깔로 맞춥니다.
     *              (테마를 바꿔도 배경이 분홍으로 남으면 화면이 따로 놉니다)
     * @param landKind 땅의 생김새. 빛깔마다 다른 것을 씁니다.
     */
    make(level, hue, landKind, dark) {
      DIM = !!dark;
      const rng = rngFrom('scene|' + level);
      const W = 400, H = 300;

      // 계절과 때는 단계가 흐르며 천천히 옮겨 갑니다 (갑자기 바뀌지 않게)
      const season = SEASONS[Math.floor((level - 1) / 5) % SEASONS.length];
      const time = TIMES[(level - 1) % TIMES.length];
      const phase = PHASES[Math.floor((level - 1) / 20) % PHASES.length];

      // 그 계절·그 때에 어울리는 것만 고릅니다 (톤이 어긋나지 않게)
      const wPool = WEATHERS.filter(w => !w.t || w.t.includes(time.name));
      const weather = wPool[Math.floor(rng() * wPool.length)];
      const pPool = PLACES.filter(p => !p[1] || p[1].includes(season.name));
      const place = pPool[Math.floor(rng() * pPool.length)][0];
      const seasonName = phase + season.name;

      // 같은 색조 안에서 아주 조금씩만 흔듭니다 (톤이 흐트러지지 않게)
      const jitter = (rng() - .5) * 14;
      /* 테마 빛깔이 주어지면 그 색을 따르고, 계절은 색조를 살짝 밀어 주는
         역할만 합니다. 그래야 '숲 테마의 봄'과 '바다 테마의 봄'이
         각각 다르면서도 화면 전체와는 어울립니다. */
      const base = (typeof hue === 'number') ? hue : season.hue;
      const lean = (typeof hue === 'number') ? 14 : 0;   // 계절 쪽으로 기울이는 정도
      const hSky = base + jitter + (season.hue - base) * 0 + lean * Math.sin(season.hue / 57);
      const hRidge = base + 18 + jitter * 0.6;
      const sat = time.sat;

      const skyTop = hsl(hSky, sat, time.skyL[0]);
      const skyBot = hsl(hSky + 8, sat * 0.8, time.skyL[1]);
      const glowC = hsl(hSky - 6, Math.min(70, sat + 22), Math.min(96, time.skyL[0] + 2));

      let g = '';

      // 하늘
      g += `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;

      // 해 또는 달
      if (time.sun !== 'none') {
        const cx = 60 + rng() * (W - 120), cy = 40 + rng() * 70;
        const r = time.sun === 'moon' ? 20 + rng() * 10 : 26 + rng() * 14;
        g += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${(r * 2.6).toFixed(0)}" fill="${glowC}" opacity=".45"/>`;
        g += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${hsl(hSky - 10, sat + 16, 95)}" opacity=".9"/>`;
        if (time.sun === 'moon' && rng() < .6) {
          for (let i = 0; i < 12; i++) {
            g += `<circle cx="${(rng() * W).toFixed(0)}" cy="${(rng() * 120).toFixed(0)}" r="1.4" fill="#fff" opacity="${(.3 + rng() * .4).toFixed(2)}"/>`;
          }
        }
      }

      /* 멀리 아득한 산줄기 — 어느 풍경에나 깝니다.
         가운데가 하늘로만 넓게 비어 있으면 밋밋해 보입니다.
         아주 옅게 두 겹 겹쳐 '멀다'는 느낌만 냅니다. */
      for (let i = 0; i < 2; i++) {
        g += `<path d="${ridge(rng, 126 + i * 26, 22 - i * 6, W)}"
               fill="${hsl(hRidge, sat * .3, Math.min(97, time.ridgeL[0] + 16 - i * 5))}"
               opacity="${(.5 - i * .14).toFixed(2)}"/>`;
      }

      // 구름 — 크게, 그리고 늘 몇 조각은 있게
      for (let i = 0; i < Math.max(2, weather.cloud) + 1; i++) {
        const cx = rng() * W, cy = 22 + rng() * 96, s = 34 + rng() * 44;
        g += `<g opacity="${(.34 + rng() * .26).toFixed(2)}" fill="${hsl(hSky, sat * .5, 97)}">`;
        g += `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${s.toFixed(0)}" ry="${(s * .34).toFixed(0)}"/>`;
        g += `<ellipse cx="${(cx + s * .48).toFixed(0)}" cy="${(cy + 5).toFixed(0)}" rx="${(s * .68).toFixed(0)}" ry="${(s * .28).toFixed(0)}"/>`;
        g += `<ellipse cx="${(cx - s * .42).toFixed(0)}" cy="${(cy + 4).toFixed(0)}" rx="${(s * .5).toFixed(0)}" ry="${(s * .24).toFixed(0)}"/>`;
        g += `<ellipse cx="${(cx + s * .1).toFixed(0)}" cy="${(cy - s * .2).toFixed(0)}" rx="${(s * .44).toFixed(0)}" ry="${(s * .3).toFixed(0)}"/>`;
        g += `</g>`;
      }

      /* ── 땅의 생김새 ────────────────────────────
         산만 나오면 몇 판 지나 똑같아 보입니다.
         동네(백 단계)마다 생김새를 바꿔 다른 곳에 온 느낌을 냅니다. */
      const land = landKind || LAND_BY_THEME.coral;
      const ink = (i, extra) => hsl(hRidge, sat * (.5 + i * .16), time.ridgeL[i] + (extra || 0));

      /* ══════════════════════════════════════════════
         땅의 생김새 열두 가지

         ★ 앞줄 소품만 바꾸면 실루엣이 다 비슷해 보입니다.
           산·언덕·설산이 모두 능선이고 마을·기와가 모두 지붕이면
           몇 판 지나 "다 똑같네" 가 됩니다.
           그래서 '땅의 뼈대' 자체를 열둘 다르게 짭니다.
         ══════════════════════════════════════════════ */

      /** 뾰족한 봉우리 능선 (산·설산용) */
      const peaks = (baseY, h1, count, seedShift) => {
        let d = `M0 ${baseY}`;
        for (let i = 0; i < count; i++) {
          const x0 = (W / count) * i, x1 = (W / count) * (i + 1);
          const px = x0 + (W / count) * (.3 + rng() * .4);
          const py = baseY - h1 * (.55 + rng() * .75) - seedShift;
          d += ` L${px.toFixed(0)} ${py.toFixed(0)} L${x1.toFixed(0)} ${(baseY - rng() * 8).toFixed(0)}`;
        }
        return d + ` L${W} 320 L0 320 Z`;
      };

      /** 나지막이 굽이치는 언덕 */
      const rolls = (baseY, amp) => {
        let d = `M0 ${baseY}`;
        const n2 = 3;
        for (let i = 1; i <= n2; i++) {
          const x = (W / n2) * i;
          d += ` Q${(x - W / n2 / 2).toFixed(0)} ${(baseY - amp * (.8 + rng() * .5)).toFixed(0)} ${x.toFixed(0)} ${(baseY + (rng() - .5) * 6).toFixed(0)}`;
        }
        return d + ` L${W} 320 L0 320 Z`;
      };

      if (land === '산') {
        /* 산 — 뾰족한 봉우리가 세 겹. 가장 높고 날카롭습니다. */
        g += `<path d="${peaks(196, 74, 3, 0)}" fill="${ink(0)}"/>`;
        g += `<path d="${peaks(222, 54, 4, 0)}" fill="${ink(1)}"/>`;
        g += `<path d="${peaks(250, 34, 6, 0)}" fill="${ink(2)}"/>`;

      } else if (land === '설산') {
        /* 설산 — 더 날카롭고, 봉우리 꼭대기에 눈이 얹힙니다. */
        for (let i = 0; i < 3; i++) {
          const by = 186 + i * 30, hh = 84 - i * 22;
          const d = peaks(by, hh, 2 + i, 0);
          g += `<path d="${d}" fill="${ink(i)}"/>`;
          // 눈 — 봉우리 위쪽만 하얗게 덮습니다
          g += `<path d="${d}" fill="${DIM ? '#c9d6de' : '#ffffff'}" opacity="${(.72 - i * .2).toFixed(2)}"
                 clip-path="inset(0 0 ${(320 - by + hh * .45).toFixed(0)}px 0)"/>`;
        }

      } else if (land === '언덕') {
        /* 언덕 — 부드럽게 굽이치는 곡선. 뾰족한 데가 없습니다. */
        g += `<path d="${rolls(212, 34)}" fill="${ink(0)}"/>`;
        g += `<path d="${rolls(244, 26)}" fill="${ink(1)}"/>`;
        g += `<path d="${rolls(272, 16)}" fill="${ink(2)}"/>`;

      } else if (land === '숲') {
        /* 숲 — 나무 지붕이 화면을 가득 메웁니다. 능선이 거의 안 보입니다. */
        g += `<path d="${rolls(206, 16)}" fill="${ink(0)}"/>`;
        for (let layer = 0; layer < 3; layer++) {
          const yb = 224 + layer * 28, c = ink(layer, -layer * 4);
          for (let i = 0; i < 16 - layer * 2; i++) {
            const x = (i * (W / (15 - layer * 2))) + (rng() - .5) * 18;
            const th = 34 + rng() * 26 + layer * 10;
            g += `<path d="M${(x - th * .36).toFixed(0)} ${yb} L${x.toFixed(0)} ${(yb - th).toFixed(0)} L${(x + th * .36).toFixed(0)} ${yb} Z"
                   fill="${c}" opacity="${(.45 + layer * .2).toFixed(2)}"/>`;
          }
        }

      } else if (land === '개울') {
        /* 개울 — 물줄기가 S 자로 굽이쳐 내려옵니다. 다른 어떤 곳과도 다릅니다. */
        g += `<path d="${rolls(198, 26)}" fill="${ink(0)}"/>`;
        g += `<path d="${rolls(230, 18)}" fill="${ink(1)}"/>`;
        const water = hsl(hSky + 6, sat * 1.1, time.skyL[1] - 4);
        // 위에서 아래로 넓어지며 굽이치는 물줄기
        g += `<path d="M${(W * .42).toFixed(0)} 228
                 C${(W * .30).toFixed(0)} 252 ${(W * .66).toFixed(0)} 262 ${(W * .48).toFixed(0)} 288
                 L${(W * .74).toFixed(0)} 300 L${(W * .16).toFixed(0)} 300
                 C${(W * .40).toFixed(0)} 274 ${(W * .18).toFixed(0)} 250 ${(W * .36).toFixed(0)} 228 Z"
               fill="${water}" opacity=".9"/>`;
        // 물살
        for (let i = 0; i < 5; i++) {
          const y = 244 + i * 12;
          g += `<path d="M${(W * (.30 + rng() * .1)).toFixed(0)} ${y} q14 -4 26 2"
                 stroke="${hsl(hSky, 24, 98)}" stroke-width="1.6" fill="none" opacity="${(.35 + rng() * .25).toFixed(2)}"/>`;
        }

      } else if (land === '논') {
        /* 논 — 물을 댄 계단이 층층이. 가로줄이 뚜렷합니다. */
        for (let i = 0; i < 6; i++) {
          const y = 208 + i * 16;
          g += `<path d="M0 ${y} Q${(W / 2).toFixed(0)} ${(y - 12).toFixed(0)} ${W} ${y} L${W} ${(y + 17)} L0 ${(y + 17)} Z"
                 fill="${ink(Math.min(2, Math.floor(i / 2)), -i * 3)}" opacity="${(.9 - i * .06).toFixed(2)}"/>`;
          // 물빛이 비치는 논둑
          g += `<path d="M0 ${y} Q${(W / 2).toFixed(0)} ${(y - 12).toFixed(0)} ${W} ${y}"
                 stroke="${hsl(hSky, 26, 97)}" stroke-width="1.6" fill="none" opacity=".45"/>`;
        }

      } else if (land === '꽃밭') {
        /* 꽃밭 — 평평한 들에 꽃이 빽빽합니다. 색점이 많은 것이 특징. */
        g += `<path d="${rolls(226, 18)}" fill="${ink(1)}"/>`;
        g += `<path d="${rolls(256, 10)}" fill="${ink(2)}"/>`;
        for (let i = 0; i < 90; i++) {
          const x = rng() * W, y = 240 + rng() * 60;
          const r = 1.6 + rng() * 3.4;
          g += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}"
                 fill="${hsl(base + (rng() - .5) * 56, 54, 76)}" opacity="${(.45 + rng() * .4).toFixed(2)}"/>`;
        }

      } else if (land === '억새') {
        /* 억새 — 키 큰 풀이 화면 아래를 가득 채우고 한쪽으로 눕습니다. */
        g += `<path d="${rolls(222, 20)}" fill="${ink(1)}"/>`;
        for (let i = 0; i < 90; i++) {
          const x = rng() * W, y = 250 + rng() * 52, hgt = 22 + rng() * 34;
          const bend = 8 + rng() * 12;
          g += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q${(bend * .4).toFixed(0)} -${(hgt * .6).toFixed(0)} ${bend.toFixed(0)} -${hgt.toFixed(0)}"
                 stroke="${ink(2, 6)}" stroke-width="1.5" fill="none" opacity="${(.3 + rng() * .32).toFixed(2)}"/>`;
          if (rng() < .5) {
            g += `<ellipse cx="${(x + bend).toFixed(0)}" cy="${(y - hgt).toFixed(0)}" rx="4.4" ry="2"
                   fill="${hsl(base - 6, 24, 93)}" opacity="${(.4 + rng() * .3).toFixed(2)}"
                   transform="rotate(-34 ${(x + bend).toFixed(0)} ${(y - hgt).toFixed(0)})"/>`;
          }
        }

      } else if (land === '과수원') {
        /* 과수원 — 동그란 나무가 줄지어 서고, 앞줄일수록 큽니다. */
        g += `<path d="${rolls(202, 14)}" fill="${ink(0)}"/>`;
        for (let row = 0; row < 3; row++) {
          const yb = 236 + row * 24, sc = .6 + row * .32;
          for (let i = 0; i < 7 - row; i++) {
            const x = i * (W / (6.4 - row)) + (row % 2 ? 22 : 0) + (rng() - .5) * 10;
            g += `<rect x="${(x - 1.8 * sc).toFixed(1)}" y="${(yb - 13 * sc).toFixed(0)}"
                   width="${(3.6 * sc).toFixed(1)}" height="${(14 * sc).toFixed(0)}" fill="${ink(2, -12)}" opacity=".75"/>`;
            g += `<circle cx="${x.toFixed(0)}" cy="${(yb - 22 * sc).toFixed(0)}" r="${(13 * sc).toFixed(0)}"
                   fill="${ink(2 - Math.min(2, row), -4)}" opacity="${(.62 + row * .12).toFixed(2)}"/>`;
            for (let k = 0; k < 3; k++) {
              g += `<circle cx="${(x + (k - 1) * 6 * sc).toFixed(0)}" cy="${(yb - 22 * sc + (k % 2 ? 4 : -3) * sc).toFixed(0)}"
                     r="${(2.4 * sc).toFixed(1)}" fill="${hsl(base - 12, 58, 68)}" opacity=".85"/>`;
            }
          }
        }

      } else if (land === '마을') {
        /* 마을 — 네모난 집에 창이 달리고 지붕이 얹힙니다. 지붕만 있는 기와와 다릅니다. */
        g += `<path d="${rolls(190, 20)}" fill="${ink(0)}"/>`;
        for (let row = 0; row < 2; row++) {
          const yb = 250 + row * 28, sc = .8 + row * .4;
          for (let i = 0; i < 5 - row; i++) {
            const x = i * (W / (4.6 - row)) + (row % 2 ? 26 : 6) + (rng() - .5) * 10;
            const bw = 34 * sc, bh = 26 * sc;
            g += `<rect x="${(x - bw / 2).toFixed(0)}" y="${(yb - bh).toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}"
                   fill="${ink(2 - row, -3)}" opacity="${(.6 + row * .16).toFixed(2)}"/>`;
            g += `<path d="M${(x - bw / 2 - 4).toFixed(0)} ${(yb - bh).toFixed(0)} L${x.toFixed(0)} ${(yb - bh - 15 * sc).toFixed(0)} L${(x + bw / 2 + 4).toFixed(0)} ${(yb - bh).toFixed(0)} Z"
                   fill="${ink(2 - row, -12)}" opacity="${(.7 + row * .14).toFixed(2)}"/>`;
            // 불 켜진 창
            g += `<rect x="${(x - 5 * sc).toFixed(0)}" y="${(yb - bh * .62).toFixed(0)}" width="${(10 * sc).toFixed(0)}" height="${(8 * sc).toFixed(0)}"
                   rx="1.5" fill="${hsl(46, 62, 82)}" opacity="${(.5 + rng() * .3).toFixed(2)}"/>`;
          }
        }

      } else if (land === '기와') {
        /* 기와 — 처마가 길게 휘어 오른 한옥 지붕. 집채는 거의 안 보입니다. */
        g += `<path d="${rolls(184, 16)}" fill="${ink(0)}"/>`;
        for (let row = 0; row < 3; row++) {
          const yb = 232 + row * 26, sc = .8 + row * .28;
          for (let i = 0; i < 4; i++) {
            const x = i * (W / 3.5) + (row % 2 ? 30 : 0) + (rng() - .5) * 12;
            const w2 = 74 * sc;
            // 처마 끝이 위로 들린 곡선
            g += `<path d="M${(x - w2 / 2).toFixed(0)} ${yb}
                     q${(w2 * .10).toFixed(0)} -${(9 * sc).toFixed(0)} ${(w2 * .22).toFixed(0)} -${(11 * sc).toFixed(0)}
                     q${(w2 * .18).toFixed(0)} -${(9 * sc).toFixed(0)} ${(w2 * .28).toFixed(0)} 0
                     q${(w2 * .18).toFixed(0)} ${(2 * sc).toFixed(0)} ${(w2 * .22).toFixed(0)} ${(11 * sc).toFixed(0)} Z"
                   fill="${ink(2 - Math.min(2, row), -6)}" opacity="${(.6 + row * .14).toFixed(2)}"/>`;
            // 지붕 아래 기둥
            g += `<rect x="${(x - w2 * .28).toFixed(0)}" y="${yb}" width="${(3 * sc).toFixed(1)}" height="${(12 * sc).toFixed(0)}"
                   fill="${ink(2, -14)}" opacity=".5"/>`;
            g += `<rect x="${(x + w2 * .25).toFixed(0)}" y="${yb}" width="${(3 * sc).toFixed(1)}" height="${(12 * sc).toFixed(0)}"
                   fill="${ink(2, -14)}" opacity=".5"/>`;
          }
        }

      } else if (land === '들') {
        /* 들 — 밭이랑이 사선으로 뻗습니다. */
        g += `<path d="${rolls(216, 12)}" fill="${ink(0)}"/>`;
        for (let i = 0; i < 9; i++) {
          const y = 240 + i * 7;
          g += `<path d="M0 ${y} Q${(W / 2).toFixed(0)} ${(y - 8).toFixed(0)} ${W} ${(y + 4)}"
                 stroke="${ink(2, -6)}" stroke-width="2" fill="none" opacity="${(.28 + i * .03).toFixed(2)}"/>`;
        }

      } else if (land === '바다') {
        /* 바다 — 선 하나만 있으면 너무 밋밋합니다.
           먼 섬 둘, 물빛 두 겹, 햇빛이 부서지는 길, 물결,
           그리고 앞쪽 갯바위와 갈매기까지 얹습니다. */
        // 먼바다와 앞바다 (색을 나눠 깊이를 냅니다)
        g += `<rect y="192" width="${W}" height="${H - 192}" fill="${hsl(hSky + 4, sat, time.skyL[1] - 8)}"/>`;
        g += `<rect y="240" width="${W}" height="${H - 240}" fill="${hsl(hSky + 10, sat * 1.1, time.skyL[1] - 15)}" opacity=".7"/>`;

        // 멀리 보이는 섬 둘 (하나는 작게 겹쳐서)
        const ix = 40 + rng() * (W - 180);
        g += `<path d="M${ix.toFixed(0)} 192 q14 -16 26 -17 q14 1 30 17 Z" fill="${ink(0)}" opacity=".85"/>`;
        g += `<path d="M${(ix + 44).toFixed(0)} 192 q9 -10 18 -11 q9 1 19 11 Z" fill="${ink(1)}" opacity=".7"/>`;

        // 해가 물에 부서지는 길
        if (time.sun !== 'none') {
          for (let i = 0; i < 7; i++) {
            const y = 200 + i * 13, w2 = 10 + i * 7;
            g += `<rect x="${(W * .62 - w2 / 2).toFixed(0)}" y="${y}" width="${w2.toFixed(0)}" height="3.4" rx="1.7"
                   fill="${hsl(hSky - 8, 30, 97)}" opacity="${(.34 - i * .035).toFixed(2)}"/>`;
          }
        }

        // 물결 — 멀수록 촘촘하고 옅게
        for (let i = 0; i < 9; i++) {
          const y = 202 + i * 11 + i * i * .5;
          g += `<path d="M0 ${y.toFixed(0)} q${(W / 6).toFixed(0)} -${(4 + i * .7).toFixed(0)} ${(W / 3).toFixed(0)} 0 t${(W / 3).toFixed(0)} 0 t${(W / 3).toFixed(0)} 0"
                 stroke="${hsl(hSky, 26, 97)}" stroke-width="${(1.2 + i * .28).toFixed(1)}" fill="none" opacity="${(.2 + i * .06).toFixed(2)}"/>`;
        }

        // 앞쪽 갯바위
        const bx = rng() < .5 ? 26 : W - 86;
        g += `<path d="M${bx} 300 q10 -30 30 -26 q16 -14 30 6 q10 8 8 20 Z" fill="${ink(2, -10)}" opacity=".62"/>`;

        /* 물 밖으로 뛰어오르는 물고기 */
        if (rng() < .7) {
          const fx = 70 + rng() * (W - 150), fy = 236 + rng() * 36;
          g += `<g opacity=".5" fill="${ink(2, -12)}">` +
            `<path d="M${fx} ${fy} q9 -7 18 0 q-9 7 -18 0 Z"/>` +
            `<path d="M${(fx + 18).toFixed(0)} ${fy} l7 -5 v10 Z"/></g>`;
          for (let k = 0; k < 3; k++) {
            g += `<circle cx="${(fx - 6 - k * 5).toFixed(0)}" cy="${(fy + 6 + k * 3).toFixed(0)}" r="${(1.6 - k * .3).toFixed(1)}"
                   fill="${hsl(hSky, 26, 97)}" opacity="${(.5 - k * .12).toFixed(2)}"/>`;
          }
        }

        /* ── 모래톱 ──
           화면에는 그림의 아래쪽이 주로 보입니다.
           그러니 여기가 가장 볼거리여야 합니다. */
        const sand = hsl(base - 18, 34, 90);
        g += `<path d="M0 272 q60 -12 130 -6 q80 7 150 -4 q70 -10 120 4 L${W} 300 L0 300 Z" fill="${sand}" opacity=".85"/>`;
        // 물결이 모래에 닿는 자리
        g += `<path d="M0 272 q60 -12 130 -6 q80 7 150 -4 q70 -10 120 4"
               stroke="${hsl(hSky, 26, 98)}" stroke-width="2.4" fill="none" opacity=".55"/>`;

        /* 조개 · 불가사리 · 소라 — 큼직하게 */
        for (let i = 0; i < 7; i++) {
          const sx = 22 + rng() * (W - 44), sy = 280 + rng() * 16;
          const sc = 1.4 + rng() * .8;
          const op = (.55 + rng() * .3).toFixed(2);
          const pick = rng();
          if (pick < .38) {
            // 부채 조개 (결이 보이게)
            const c = hsl(base - 26, 40, 86);
            g += `<g opacity="${op}" transform="translate(${sx.toFixed(0)} ${sy.toFixed(0)}) scale(${sc.toFixed(2)})">` +
              `<path d="M0 0 a10 10 0 0 1 18 0 Z" fill="${c}" stroke="${ink(2, -18)}" stroke-width=".8"/>` +
              `<path d="M4 0 l1.5 -7M9 0 v-8M14 0 l-1.5 -7" stroke="${ink(2, -18)}" stroke-width=".8" fill="none"/></g>`;
          } else if (pick < .68) {
            // 불가사리
            let d2 = '';
            for (let k = 0; k < 5; k++) {
              const a1 = (k * 72 - 90) * Math.PI / 180, a2 = ((k + .5) * 72 - 90) * Math.PI / 180;
              d2 += (k ? 'L' : 'M') + (Math.cos(a1) * 9).toFixed(1) + ' ' + (Math.sin(a1) * 9).toFixed(1) +
                'L' + (Math.cos(a2) * 3.6).toFixed(1) + ' ' + (Math.sin(a2) * 3.6).toFixed(1);
            }
            g += `<g opacity="${op}" transform="translate(${sx.toFixed(0)} ${sy.toFixed(0)}) scale(${sc.toFixed(2)})">` +
              `<path d="${d2} Z" fill="${hsl(base - 34, 46, 80)}"/></g>`;
          } else if (pick < .86) {
            // 소라 (돌돌 말린 껍데기)
            g += `<g opacity="${op}" transform="translate(${sx.toFixed(0)} ${sy.toFixed(0)}) scale(${sc.toFixed(2)})">` +
              `<path d="M0 0 q-2 -9 6 -11 q9 -2 9 6 q0 6 -6 6 q-5 0 -5 -4 q0 -3 3 -3"
                 fill="${hsl(base - 20, 42, 88)}" stroke="${ink(2, -18)}" stroke-width=".9"/></g>`;
          } else {
            // 작은 게
            g += `<g opacity="${op}" transform="translate(${sx.toFixed(0)} ${sy.toFixed(0)}) scale(${sc.toFixed(2)})">` +
              `<ellipse rx="7" ry="5" fill="${hsl(base - 40, 44, 76)}"/>` +
              `<path d="M-7 -1 l-4 -4M7 -1 l4 -4M-5 4 l-4 4M5 4 l4 4"
                 stroke="${hsl(base - 40, 44, 70)}" stroke-width="1.4" fill="none"/>` +
              `<circle cx="-2.6" cy="-2" r="1.1" fill="#fff"/><circle cx="2.6" cy="-2" r="1.1" fill="#fff"/></g>`;
          }
        }

        /* 물속에서 헤엄치는 물고기 떼 */
        for (let i = 0; i < 4; i++) {
          const fx = 20 + rng() * (W - 60), fy = 248 + rng() * 20, sc = 1 + rng() * .7;
          g += `<g opacity="${(.3 + rng() * .22).toFixed(2)}" fill="${ink(2, -16)}" ` +
            `transform="translate(${fx.toFixed(0)} ${fy.toFixed(0)}) scale(${sc.toFixed(2)})">` +
            `<path d="M0 0 q8 -6 16 0 q-8 6 -16 0 Z"/><path d="M16 0 l6 -4 v8 Z"/></g>`;
        }

        /* 미역 줄기 */
        for (let i = 0; i < 5; i++) {
          const wx = rng() * W, wy = 268 + rng() * 20;
          g += `<path d="M${wx.toFixed(0)} ${wy.toFixed(0)} q8 -8 3 -16 q-6 -8 5 -15"
                 stroke="${ink(1, -18)}" stroke-width="2.4" fill="none" opacity="${(.3 + rng() * .2).toFixed(2)}"/>`;
        }
        // 갈매기 둘
        for (let i = 0; i < 2; i++) {
          const gx = 60 + rng() * (W - 120), gy = 96 + rng() * 46;
          g += `<path d="M${gx.toFixed(0)} ${gy.toFixed(0)} q5 -5 10 0 q5 -5 10 0"
                 stroke="${hsl(hRidge, 18, 52)}" stroke-width="1.5" fill="none" opacity=".4"/>`;
        }
      }

      /* 앞쪽 나무나 억새.
         땅 종류를 가리지 않고 그리면 바다 위에 소나무가 떠 있게 됩니다.
         나무가 어울리지 않는 곳에는 넣지 않습니다. */
      const NO_TREE = ['바다', '논', '기와', '과수원', '숲'];
      const kind = rng();
      const n = NO_TREE.indexOf(land) >= 0 ? 0 : 3 + Math.floor(rng() * 5);
      for (let i = 0; i < n; i++) {
        const x = rng() * W, y = 246 + rng() * 44;
        const c = hsl(season.leaf + jitter * .5, sat * .8, time.ridgeL[2] - 6);
        if (kind < .34) {                       // 나무
          const th = 16 + rng() * 20;
          g += `<rect x="${(x - 1.6).toFixed(0)}" y="${(y - th * .4).toFixed(0)}" width="3" height="${(th * .5).toFixed(0)}" fill="${c}" opacity=".7"/>`;
          g += `<ellipse cx="${x.toFixed(0)}" cy="${(y - th * .55).toFixed(0)}" rx="${(th * .5).toFixed(0)}" ry="${(th * .6).toFixed(0)}" fill="${c}" opacity=".62"/>`;
        } else if (kind < .67) {                // 억새·풀
          for (let k = 0; k < 4; k++) {
            const bx = x + k * 3 - 4;
            g += `<path d="M${bx.toFixed(0)} ${y.toFixed(0)} q3 -${(12 + rng() * 14).toFixed(0)} ${(4 + rng() * 5).toFixed(0)} -${(18 + rng() * 12).toFixed(0)}" stroke="${c}" stroke-width="1.6" fill="none" opacity=".5"/>`;
          }
        } else {                                 // 소나무
          const th = 20 + rng() * 18;
          g += `<rect x="${(x - 1.4).toFixed(0)}" y="${(y - th * .3).toFixed(0)}" width="2.8" height="${(th * .4).toFixed(0)}" fill="${c}" opacity=".7"/>`;
          for (let k = 0; k < 3; k++) {
            const w2 = (th * .5) * (1 - k * .22);
            g += `<path d="M${(x - w2).toFixed(0)} ${(y - th * .3 - k * th * .22).toFixed(0)} L${x.toFixed(0)} ${(y - th * .62 - k * th * .22).toFixed(0)} L${(x + w2).toFixed(0)} ${(y - th * .3 - k * th * .22).toFixed(0)} Z" fill="${c}" opacity=".6"/>`;
          }
        }
      }

      /* ── 맨 앞줄 ────────────────────────────────
         화면에는 그림의 아래쪽이 주로 보입니다.
         땅마다 다른 것을 크게 놓아 여기가 볼거리가 되게 합니다.
         (바다는 위에서 모래톱으로 따로 그렸습니다) */
      const near = (x, y, sc, body, op) =>
        `<g opacity="${op}" transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${sc.toFixed(2)})">${body}</g>`;

      if (land !== '바다') {
        const FG = {
          '산': () => {            // 바위와 들풀
            let o = '';
            for (let i = 0; i < 5; i++) {
              const x = rng() * W, y = 278 + rng() * 18, sc = 1 + rng() * 1.2;
              o += near(x, y, sc, `<path d="M0 0 q3 -11 12 -9 q9 -4 12 9 Z" fill="${ink(2, -12)}"/>`, (.4 + rng() * .24).toFixed(2));
            }
            return o;
          },
          '언덕': () => {          // 흔들리는 들꽃
            let o = '';
            for (let i = 0; i < 9; i++) {
              const x = rng() * W, y = 282 + rng() * 16, sc = 1 + rng();
              o += near(x, y, sc, `<path d="M0 0 v-11" stroke="${ink(2, -6)}" stroke-width="1.4" fill="none"/>` +
                `<circle cy="-13" r="3.4" fill="${hsl(base - 12, 48, 80)}"/>`, (.45 + rng() * .3).toFixed(2));
            }
            return o;
          },
          '숲': () => {            // 고사리와 버섯
            let o = '';
            for (let i = 0; i < 7; i++) {
              const x = rng() * W, y = 284 + rng() * 14, sc = 1 + rng() * .9;
              o += rng() < .5
                ? near(x, y, sc, `<path d="M0 0 q1 -12 8 -16 M0 -5 l-6 -4 M0 -10 l-5 -5" stroke="${ink(2, -12)}" stroke-width="1.5" fill="none"/>`, (.4 + rng() * .25).toFixed(2))
                : near(x, y, sc, `<path d="M-6 0 q0 -8 6 -8 q6 0 6 8 Z" fill="${hsl(base - 26, 40, 82)}"/><rect x="-1.4" y="0" width="2.8" height="5" fill="${ink(2, -6)}"/>`, (.45 + rng() * .25).toFixed(2));
            }
            return o;
          },
          '꽃밭': () => {          // 활짝 핀 꽃 다섯 잎
            let o = '';
            for (let i = 0; i < 10; i++) {
              const x = rng() * W, y = 280 + rng() * 18, sc = .9 + rng() * .9;
              let pet = '';
              for (let k = 0; k < 5; k++) {
                const a1 = k * 72 * Math.PI / 180;
                pet += `<ellipse cx="${(Math.cos(a1) * 4.6).toFixed(1)}" cy="${(Math.sin(a1) * 4.6).toFixed(1)}" rx="3.4" ry="2.4" fill="${hsl(base + (rng() - .5) * 40, 52, 80)}"/>`;
              }
              o += near(x, y, sc, `<path d="M0 0 v10" stroke="${ink(2, -6)}" stroke-width="1.3" fill="none"/>` + pet +
                `<circle r="2" fill="${hsl(48, 60, 76)}"/>`, (.5 + rng() * .3).toFixed(2));
            }
            return o;
          },
          '억새': () => {          // 이삭이 크게
            let o = '';
            for (let i = 0; i < 11; i++) {
              const x = rng() * W, y = 286 + rng() * 14, sc = 1 + rng() * 1.1;
              o += near(x, y, sc, `<path d="M0 0 q5 -14 14 -22" stroke="${ink(2, -4)}" stroke-width="1.6" fill="none"/>` +
                `<ellipse cx="15" cy="-24" rx="5" ry="2.4" fill="${hsl(base - 8, 26, 92)}" transform="rotate(-32 15 -24)"/>`, (.42 + rng() * .3).toFixed(2));
            }
            return o;
          },
          '과수원': () => {        // 떨어진 열매와 바구니
            let o = '';
            for (let i = 0; i < 8; i++) {
              const x = rng() * W, y = 286 + rng() * 12, sc = 1 + rng() * .7;
              o += near(x, y, sc, `<circle r="4.4" fill="${hsl(base - 10, 52, 76)}"/>` +
                `<path d="M0 -4 q2 -4 5 -4" stroke="${ink(2, -10)}" stroke-width="1.2" fill="none"/>`, (.5 + rng() * .28).toFixed(2));
            }
            return o;
          },
          '논': () => {            // 볏단과 허수아비
            let o = '';
            for (let i = 0; i < 6; i++) {
              const x = rng() * W, y = 288 + rng() * 10, sc = 1 + rng() * .8;
              o += near(x, y, sc, `<path d="M0 0 l-6 -14 M0 0 l0 -16 M0 0 l6 -14" stroke="${hsl(base - 6, 34, 78)}" stroke-width="2" fill="none"/>`, (.42 + rng() * .26).toFixed(2));
            }
            const sx = W * (.2 + rng() * .6);
            o += near(sx, 292, 1.5, `<path d="M0 0 v-22 M-9 -15 h18" stroke="${ink(2, -14)}" stroke-width="2" fill="none"/>` +
              `<circle cy="-25" r="4.6" fill="${hsl(base - 10, 30, 86)}"/>`, '.5');
            return o;
          },
          '기와': () => {          // 담장과 항아리
            let o = '';
            o += `<rect y="286" width="${W}" height="14" fill="${ink(2, -8)}" opacity=".35"/>`;
            for (let i = 0; i < 5; i++) {
              const x = rng() * W, y = 288 + rng() * 8, sc = 1 + rng() * .8;
              o += near(x, y, sc, `<path d="M-6 0 q-3 -9 0 -12 q6 -3 12 0 q3 3 0 12 Z" fill="${hsl(base - 30, 30, 72)}"/>`, (.45 + rng() * .25).toFixed(2));
            }
            return o;
          },
          '마을': () => {          // 장독과 나무 울타리
            let o = '';
            for (let i = 0; i < 6; i++) {
              const x = i * (W / 5.4) + rng() * 10, y = 292;
              o += near(x, y, 1.2, `<path d="M0 0 v-14 M-7 -10 h14" stroke="${ink(2, -10)}" stroke-width="2" fill="none"/>`, '.4');
            }
            for (let i = 0; i < 3; i++) {
              const x = rng() * W;
              o += near(x, 292, 1.4, `<path d="M-6 0 q-3 -8 0 -11 q6 -3 12 0 q3 3 0 11 Z" fill="${hsl(base - 32, 28, 70)}"/>`, '.45');
            }
            return o;
          },
          '개울': () => {          // 징검다리와 물풀
            let o = '';
            for (let i = 0; i < 5; i++) {
              const x = 30 + i * (W / 5.5) + (rng() - .5) * 14;
              o += near(x, 284 + (rng() - .5) * 8, 1.3 + rng() * .5,
                `<ellipse rx="9" ry="5" fill="${ink(2, -14)}"/>`, (.42 + rng() * .2).toFixed(2));
            }
            for (let i = 0; i < 6; i++) {
              const x = rng() * W;
              o += near(x, 294, 1 + rng() * .8,
                `<path d="M0 0 q3 -9 -1 -14 M0 0 q-4 -8 -1 -13" stroke="${ink(1, -18)}" stroke-width="1.5" fill="none"/>`, '.4');
            }
            return o;
          },
          '설산': () => {          // 눈 쌓인 바위와 침엽수
            let o = '';
            for (let i = 0; i < 6; i++) {
              const x = rng() * W, y = 284 + rng() * 12, sc = 1 + rng();
              o += near(x, y, sc, `<path d="M0 0 q3 -10 11 -8 q8 -3 11 8 Z" fill="${ink(2, -10)}"/>` +
                `<path d="M1 -6 q5 -4 12 -2" stroke="${DIM ? '#c9d6de' : '#fff'}" stroke-width="2.4" fill="none" opacity=".8"/>`, (.44 + rng() * .24).toFixed(2));
            }
            return o;
          }
        };
        g += (FG[land] || FG['산'])();
      }

      /* ── 하늘 쪽 채우기 ────────────────────────────
         그림이 아래에만 몰려 있으면 위가 휑합니다.
         땅 종류에 어울리는 것을 하늘에도 얹습니다. */
      const hi = (x, y, body, op) =>
        `<g opacity="${op}" transform="translate(${x.toFixed(0)} ${y.toFixed(0)})">${body}</g>`;

      /* ── 하늘의 주인공 ────────────────────────────
         작은 점 몇 개로는 위쪽이 여전히 허전합니다.
         땅마다 '한눈에 보이는 것' 을 하나씩 크게 놓습니다. */
      if (land === '바다') {
        // 돛단배 한 척
        const bx2 = W * (.18 + rng() * .5), by2 = 176 + rng() * 12;
        g += `<g opacity=".55" transform="translate(${bx2.toFixed(0)} ${by2.toFixed(0)})">` +
          `<path d="M-16 0 L16 0 L11 8 L-11 8 Z" fill="${ink(0, -16)}"/>` +
          `<path d="M0 -2 L0 -30" stroke="${ink(0, -16)}" stroke-width="2"/>` +
          `<path d="M1 -28 L14 -4 L1 -4 Z" fill="${hsl(hSky, 22, 96)}"/>` +
          `<path d="M-1 -24 L-11 -4 L-1 -4 Z" fill="${hsl(hSky, 18, 92)}"/></g>`;
      } else if (land === '개울') {
        // 개울을 가로지르는 나무다리
        g += `<g opacity=".5">` +
          `<path d="M${(W * .18).toFixed(0)} 214 Q${(W / 2).toFixed(0)} 196 ${(W * .82).toFixed(0)} 214"
             stroke="${ink(1, -18)}" stroke-width="5" fill="none"/>` +
          `<path d="M${(W * .18).toFixed(0)} 214 Q${(W / 2).toFixed(0)} 204 ${(W * .82).toFixed(0)} 214"
             stroke="${ink(1, -18)}" stroke-width="2" fill="none"/>` +
          `<path d="M${(W * .3).toFixed(0)} 208 v12M${(W * .5).toFixed(0)} 202 v14M${(W * .7).toFixed(0)} 208 v12"
             stroke="${ink(1, -18)}" stroke-width="2.4"/></g>`;
      } else if (land === '억새' || land === '논') {
        // 기러기 떼가 V 자로
        const gx0 = W * (.2 + rng() * .5), gy0 = 74 + rng() * 40;
        for (let k = 0; k < 7; k++) {
          const side = k % 2 ? 1 : -1, step = Math.ceil(k / 2);
          const x = gx0 + side * step * 15, y = gy0 + step * 9;
          g += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q5 -5 10 0 q5 -5 10 0"
                 stroke="${hsl(hRidge, 16, 44)}" stroke-width="1.5" fill="none" opacity=".4"/>`;
        }
      } else if (land === '마을' || land === '기와') {
        // 연 두 개가 하늘에 떠 있습니다
        for (let k = 0; k < 2; k++) {
          const kx = W * (.2 + rng() * .6), ky = 62 + rng() * 46;
          g += `<g opacity=".45" transform="translate(${kx.toFixed(0)} ${ky.toFixed(0)}) rotate(${(-18 + rng() * 36).toFixed(0)})">` +
            `<path d="M0 -13 L11 0 L0 15 L-11 0 Z" fill="${hsl(base - 14, 46, 74)}"/>` +
            `<path d="M0 -13 L0 15M-11 0 L11 0" stroke="${hsl(hSky, 14, 96)}" stroke-width="1.2"/>` +
            `<path d="M0 15 q6 8 -2 14 q-7 6 2 13" stroke="${hsl(base - 14, 40, 70)}" stroke-width="1.3" fill="none"/></g>`;
        }
      } else if (land === '산' || land === '설산') {
        // 능선 위에 작은 정자
        const px2 = W * (.16 + rng() * .66), py2 = 190;
        g += `<g opacity=".45" transform="translate(${px2.toFixed(0)} ${py2.toFixed(0)})">` +
          `<path d="M-17 0 q8 -12 17 -13 q9 1 17 13 Z" fill="${ink(0, -18)}"/>` +
          `<path d="M-11 0 v11M11 0 v11M0 0 v11" stroke="${ink(0, -18)}" stroke-width="2"/></g>`;
      } else if (land === '숲' || land === '과수원') {
        // 앞으로 크게 드리운 나뭇가지 (위쪽 모서리에서)
        const side = rng() < .5 ? 0 : W;
        const dir = side ? -1 : 1;
        g += `<g opacity=".34" fill="none" stroke="${ink(0, -20)}" stroke-width="3.4" stroke-linecap="round">` +
          `<path d="M${side} 26 q${dir * 52} 14 ${dir * 96} 8"/>` +
          `<path d="M${side + dir * 34} 33 q${dir * 8} -14 ${dir * 20} -18"/>` +
          `<path d="M${side + dir * 62} 36 q${dir * 6} -15 ${dir * 18} -20"/>` +
          `<path d="M${side + dir * 48} 35 q${dir * 4} 14 ${dir * 14} 20"/></g>`;
      } else if (land === '꽃밭' || land === '언덕') {
        // 커다란 나비 둘
        for (let k = 0; k < 2; k++) {
          const bx3 = W * (.15 + rng() * .7), by3 = 96 + rng() * 60;
          g += `<g opacity=".5" transform="translate(${bx3.toFixed(0)} ${by3.toFixed(0)}) rotate(${(-20 + rng() * 40).toFixed(0)})">` +
            `<ellipse cx="-7" cy="-4" rx="7.5" ry="6" fill="${hsl(base - 20, 52, 78)}"/>` +
            `<ellipse cx="7" cy="-4" rx="7.5" ry="6" fill="${hsl(base - 20, 52, 78)}"/>` +
            `<ellipse cx="-5.5" cy="5" rx="5.5" ry="4.5" fill="${hsl(base + 16, 48, 84)}"/>` +
            `<ellipse cx="5.5" cy="5" rx="5.5" ry="4.5" fill="${hsl(base + 16, 48, 84)}"/>` +
            `<rect x="-1" y="-7" width="2" height="14" rx="1" fill="${ink(2, -22)}"/></g>`;
        }
      }

      if (land === '바다') {
        // 갈매기 떼가 줄지어 납니다
        for (let i = 0; i < 5; i++) {
          const x = 40 + rng() * (W - 80), y = 58 + rng() * 74, sc = .7 + rng() * .7;
          g += hi(x, y, `<path d="M0 0 q${(5 * sc).toFixed(1)} -${(5 * sc).toFixed(1)} ${(10 * sc).toFixed(1)} 0 q${(5 * sc).toFixed(1)} -${(5 * sc).toFixed(1)} ${(10 * sc).toFixed(1)} 0"
            stroke="${hsl(hRidge, 16, 48)}" stroke-width="1.4" fill="none"/>`, (.26 + rng() * .22).toFixed(2));
        }
      } else if (land === '숲' || land === '언덕' || land === '억새') {
        // 산새 한 마리와 흩날리는 씨앗
        for (let i = 0; i < 9; i++) {
          const x = rng() * W, y = 46 + rng() * 110;
          g += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1 + rng() * 1.8).toFixed(1)}"
                 fill="${hsl(hSky - 10, 26, 92)}" opacity="${(.3 + rng() * .3).toFixed(2)}"/>`;
        }
      } else if (land === '마을' || land === '기와') {
        // 굴뚝 연기와 처마에 걸린 등
        for (let i = 0; i < 3; i++) {
          const x = 50 + rng() * (W - 100), y = 120 + rng() * 40;
          g += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q-8 -16 2 -26 q9 -10 1 -24"
                 stroke="${hsl(hSky, 14, 97)}" stroke-width="6" stroke-linecap="round" fill="none"
                 opacity="${(.2 + rng() * .16).toFixed(2)}"/>`;
        }
      } else if (land === '논' || land === '과수원' || land === '꽃밭') {
        // 잠자리와 나비가 낮게 납니다
        for (let i = 0; i < 7; i++) {
          const x = rng() * W, y = 120 + rng() * 76;
          g += hi(x, y, `<ellipse rx="4" ry="1.6" fill="${hsl(base - 16, 44, 74)}"/>` +
            `<ellipse cx="0" cy="-2" rx="2.6" ry="1.2" fill="${hsl(base + 12, 40, 86)}"/>`,
            (.34 + rng() * .28).toFixed(2));
        }
      } else if (land === '설산') {
        // 흩날리는 눈발이 하늘에도
        for (let i = 0; i < 16; i++) {
          const x = rng() * W, y = 40 + rng() * 150;
          g += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1 + rng() * 1.6).toFixed(1)}"
                 fill="${DIM ? '#dfe8ee' : '#fff'}" opacity="${(.35 + rng() * .35).toFixed(2)}"/>`;
        }
      } else if (land === '개울') {
        // 물안개가 피어오릅니다
        for (let i = 0; i < 4; i++) {
          const x = rng() * W, y = 150 + rng() * 40;
          g += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(24 + rng() * 26).toFixed(0)}" ry="${(6 + rng() * 5).toFixed(0)}"
                 fill="${hsl(hSky, 18, 98)}" opacity="${(.18 + rng() * .14).toFixed(2)}"/>`;
        }
      }

      /* ── 때와 날씨가 만드는 것 ────────────────────
         같은 장소라도 아침·밤·안개에 따라 달리 보여야
         스무 판을 걸어도 새롭습니다. */
      if (time.name === '밤') {
        // 별을 흩뿌리고, 몇 개는 크게
        for (let i = 0; i < 26; i++) {
          const x = rng() * W, y = rng() * 150, r = .8 + rng() * 1.5;
          g += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="#fff" opacity="${(.3 + rng() * .5).toFixed(2)}"/>`;
        }
        if (rng() < .45) {   // 별똥별
          const sx = W * (.2 + rng() * .6), sy = 30 + rng() * 50;
          g += `<path d="M${sx.toFixed(0)} ${sy.toFixed(0)} l26 14" stroke="#fff" stroke-width="1.6"
                 stroke-linecap="round" fill="none" opacity=".55"/>`;
        }
      } else if (time.name === '해질녘') {
        // 노을이 하늘을 가로로 물들입니다
        for (let i = 0; i < 4; i++) {
          const y = 84 + i * 22;
          g += `<rect y="${y}" width="${W}" height="${(9 + rng() * 8).toFixed(0)}" rx="5"
                 fill="${hsl(hSky - 16, Math.min(70, sat + 26), 88 - i * 2)}" opacity="${(.3 - i * .05).toFixed(2)}"/>`;
        }
      } else if (time.name === '새벽') {
        // 아직 남은 달과 옅은 기운
        g += `<circle cx="${(W * (.14 + rng() * .2)).toFixed(0)}" cy="${(46 + rng() * 26).toFixed(0)}" r="13"
               fill="${hsl(hSky, 18, 98)}" opacity=".5"/>`;
      } else if (time.name === '아침') {
        // 아침 햇살이 비스듬히 내려옵니다
        for (let i = 0; i < 5; i++) {
          const x = W * (.55 + i * .12);
          g += `<path d="M${x.toFixed(0)} 0 L${(x - 60).toFixed(0)} 210"
                 stroke="${hsl(hSky - 8, 40, 98)}" stroke-width="${(10 + rng() * 12).toFixed(0)}"
                 fill="none" opacity="${(.10 + rng() * .06).toFixed(2)}"/>`;
        }
      }

      if (weather.name === '안개 낀') {
        for (let i = 0; i < 5; i++) {
          const y = 130 + i * 26;
          g += `<rect y="${y}" width="${W}" height="${(16 + rng() * 14).toFixed(0)}"
                 fill="${hsl(hSky, 12, 98)}" opacity="${(.24 + rng() * .12).toFixed(2)}"/>`;
        }
      } else if (weather.name === '바람 부는') {
        // 바람결이 비스듬히 지나갑니다
        for (let i = 0; i < 6; i++) {
          const y = 60 + rng() * 140, x = rng() * W * .7;
          g += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q22 -5 44 0 q10 2 18 -2"
                 stroke="${hsl(hSky, 20, 98)}" stroke-width="1.6" fill="none" opacity="${(.22 + rng() * .18).toFixed(2)}"/>`;
        }
      } else if (weather.name === '이슬 맺힌') {
        for (let i = 0; i < 14; i++) {
          const x = rng() * W, y = 250 + rng() * 46;
          g += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1.4 + rng() * 1.6).toFixed(1)}"
                 fill="${DIM ? '#dfe8ee' : '#fff'}" opacity="${(.4 + rng() * .3).toFixed(2)}"/>`;
        }
      }

      // 옅은 안개 한 겹 — 멀고 가까움이 살아납니다
      g += `<rect y="188" width="${W}" height="52" fill="${hsl(hSky, 20, 96)}" opacity=".22"/>`;

      // 새 몇 마리
      if (rng() < .45) {
        const bx = 40 + rng() * (W - 80), by = 60 + rng() * 60;
        for (let i = 0; i < 2 + Math.floor(rng() * 2); i++) {
          const x = bx + i * (10 + rng() * 12), y = by + (rng() - .5) * 18;
          g += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q3 -3 6 0 q3 -3 6 0" stroke="${hsl(hRidge, 20, 45)}" stroke-width="1.3" fill="none" opacity=".38"/>`;
        }
      }

      // 안개 막
      if (weather.veil > 0) {
        g += `<rect width="${W}" height="${H}" fill="#fff" opacity="${weather.veil}"/>`;
      }

      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">` +
        `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyBot}"/></linearGradient></defs>` +
        g + `</svg>`;

      return {
        level,
        name: `${seasonName} ${time.name} · ${weather.name} ${place}`,
        short: `${weather.name} ${place}`,
        season: season.name, time: time.name, weather: weather.name,
        land,
        skyTop, skyBot, glow: glowC,
        svg,
        url: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
      };
    }
  };

  global.Scene = Scene;
})(window);
