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

  const hsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;

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
    make(level, hue, landKind) {
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
        const r = time.sun === 'moon' ? 16 + rng() * 8 : 20 + rng() * 12;
        g += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${(r * 2.6).toFixed(0)}" fill="${glowC}" opacity=".45"/>`;
        g += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${hsl(hSky - 10, sat + 16, 95)}" opacity=".9"/>`;
        if (time.sun === 'moon' && rng() < .6) {
          for (let i = 0; i < 12; i++) {
            g += `<circle cx="${(rng() * W).toFixed(0)}" cy="${(rng() * 120).toFixed(0)}" r="1.4" fill="#fff" opacity="${(.3 + rng() * .4).toFixed(2)}"/>`;
          }
        }
      }

      // 구름
      for (let i = 0; i < weather.cloud; i++) {
        const cx = rng() * W, cy = 30 + rng() * 80, s = 22 + rng() * 30;
        g += `<g opacity="${(.3 + rng() * .25).toFixed(2)}" fill="${hsl(hSky, sat * .5, 97)}">`;
        g += `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${s.toFixed(0)}" ry="${(s * .38).toFixed(0)}"/>`;
        g += `<ellipse cx="${(cx + s * .5).toFixed(0)}" cy="${(cy + 4).toFixed(0)}" rx="${(s * .7).toFixed(0)}" ry="${(s * .3).toFixed(0)}"/>`;
        g += `</g>`;
      }

      /* ── 땅의 생김새 ────────────────────────────
         산만 나오면 몇 판 지나 똑같아 보입니다.
         동네(백 단계)마다 생김새를 바꿔 다른 곳에 온 느낌을 냅니다. */
      const land = landKind || LAND_BY_THEME.coral;
      const ink = (i, extra) => hsl(hRidge, sat * (.5 + i * .16), time.ridgeL[i] + (extra || 0));

      if (land === '들') {
        // 나지막한 밭이랑 — 지평선이 낮고 넓습니다
        for (let i = 0; i < 3; i++) {
          g += `<path d="${ridge(rng, 214 + i * 20, 5 + i * 3, W)}" fill="${ink(i)}"/>`;
        }
        for (let i = 0; i < 7; i++) {
          const y = 250 + i * 7;
          g += `<path d="M0 ${y} Q${(W / 2).toFixed(0)} ${(y - 6).toFixed(0)} ${W} ${y}" stroke="${ink(2, -4)}" stroke-width="1.4" fill="none" opacity=".35"/>`;
        }
      } else if (land === '물가') {
        // 멀리 낮은 산, 앞쪽은 잔물결이 이는 물
        for (let i = 0; i < 2; i++) {
          g += `<path d="${ridge(rng, 176 + i * 16, 12 + i * 6, W)}" fill="${ink(i)}"/>`;
        }
        g += `<rect y="216" width="${W}" height="${H - 216}" fill="${hsl(hSky + 6, sat * .9, time.skyL[1] - 6)}" opacity=".85"/>`;
        for (let i = 0; i < 9; i++) {
          const y = 226 + i * 8, x = rng() * W * .6;
          g += `<path d="M${x.toFixed(0)} ${y} q10 -3 20 0 q10 3 20 0" stroke="${hsl(hSky, 30, 98)}" stroke-width="1.5" fill="none" opacity="${(.28 + rng() * .22).toFixed(2)}"/>`;
        }
      } else if (land === '숲') {
        // 나무가 빽빽한 숲 — 뒤로 갈수록 옅어집니다
        g += `<path d="${ridge(rng, 186, 14, W)}" fill="${ink(0)}"/>`;
        for (let layer = 0; layer < 3; layer++) {
          const yb = 214 + layer * 26, op = .34 + layer * .2, c = ink(layer + 0, -layer * 3);
          for (let i = 0; i < 14; i++) {
            const x = (i * (W / 13)) + (rng() - .5) * 16, th = 26 + rng() * 22 + layer * 8;
            g += `<path d="M${(x - th * .34).toFixed(0)} ${yb} L${x.toFixed(0)} ${(yb - th).toFixed(0)} L${(x + th * .34).toFixed(0)} ${yb} Z" fill="${c}" opacity="${op.toFixed(2)}"/>`;
          }
        }
      } else if (land === '마을') {
        // 기와지붕이 층층이 — 장터 거리·기와 골목에 어울립니다
        g += `<path d="${ridge(rng, 172, 14, W)}" fill="${ink(0)}"/>`;
        g += `<path d="${ridge(rng, 206, 8, W)}" fill="${ink(1)}"/>`;
        for (let row = 0; row < 2; row++) {
          const yb = 244 + row * 24;
          for (let i = 0; i < 6; i++) {
            const x = i * (W / 5.4) + (rng() - .5) * 18, w2 = 30 + rng() * 22;
            g += `<path d="M${(x - w2 / 2).toFixed(0)} ${yb} q${(w2 / 2).toFixed(0)} -${(11 + rng() * 6).toFixed(0)} ${w2.toFixed(0)} 0 Z" fill="${ink(2 - row, -2)}" opacity="${(.5 + row * .2).toFixed(2)}"/>`;
          }
        }
      } else if (land === '언덕') {
        // 완만한 언덕 둘 — 들꽃 언덕처럼 부드러운 곳
        for (let i = 0; i < 2; i++) {
          g += `<path d="${ridge(rng, 196 + i * 30, 22 + i * 8, W)}" fill="${ink(i + 1)}"/>`;
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
        // 갈매기 둘
        for (let i = 0; i < 2; i++) {
          const gx = 60 + rng() * (W - 120), gy = 96 + rng() * 46;
          g += `<path d="M${gx.toFixed(0)} ${gy.toFixed(0)} q5 -5 10 0 q5 -5 10 0"
                 stroke="${hsl(hRidge, 18, 52)}" stroke-width="1.5" fill="none" opacity=".4"/>`;
        }
      } else if (land === '설산') {
        // 눈 덮인 산 — 봉우리 위쪽만 하얗게
        const bases = [166, 196, 230];
        for (let i = 0; i < 3; i++) {
          const d = ridge(rng, bases[i], 20 + i * 8, W);
          g += `<path d="${d}" fill="${ink(i)}"/>`;
          if (i < 2) g += `<path d="${d}" fill="${hsl(hSky, 12, 97)}" opacity="${(.5 - i * .18).toFixed(2)}"
                            transform="translate(0 ${(6 + i * 4)})"/>`;
        }
      } else if (land === '과수원') {
        // 줄지어 선 과일나무 — 열매가 조금씩 달려 있습니다
        g += `<path d="${ridge(rng, 192, 10, W)}" fill="${ink(0)}"/>`;
        for (let row = 0; row < 2; row++) {
          const yb = 244 + row * 26, sc = 1 + row * .35;
          for (let i = 0; i < 6; i++) {
            const x = i * (W / 5.4) + (row ? 18 : 0) + (rng() - .5) * 10;
            g += `<rect x="${(x - 1.6 * sc).toFixed(1)}" y="${(yb - 12 * sc).toFixed(0)}" width="${(3.2 * sc).toFixed(1)}" height="${(12 * sc).toFixed(0)}" fill="${ink(2, -6)}" opacity=".7"/>`;
            g += `<ellipse cx="${x.toFixed(0)}" cy="${(yb - 20 * sc).toFixed(0)}" rx="${(12 * sc).toFixed(0)}" ry="${(11 * sc).toFixed(0)}" fill="${ink(2 - row, -3)}" opacity=".75"/>`;
            for (let k = 0; k < 2; k++) {
              g += `<circle cx="${(x + (k ? 5 : -5) * sc).toFixed(0)}" cy="${(yb - 20 * sc + (k ? 3 : -2)).toFixed(0)}" r="${(2.2 * sc).toFixed(1)}" fill="${hsl(base - 8, 55, 68)}" opacity=".8"/>`;
            }
          }
        }
      } else if (land === '꽃밭') {
        // 들꽃이 흐드러진 밭 — 낮은 언덕에 점점이
        for (let i = 0; i < 2; i++) g += `<path d="${ridge(rng, 200 + i * 26, 16, W)}" fill="${ink(i + 1)}"/>`;
        for (let i = 0; i < 46; i++) {
          const x = rng() * W, y = 232 + rng() * 62, r = 2 + rng() * 3;
          g += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${hsl(base + (rng() - .5) * 40, 52, 72)}" opacity="${(.5 + rng() * .35).toFixed(2)}"/>`;
        }
      } else if (land === '논') {
        // 계단식 논 — 물을 댄 논이 층층이
        for (let i = 0; i < 5; i++) {
          const y = 214 + i * 18;
          g += `<path d="M0 ${y} Q${(W / 2).toFixed(0)} ${(y - 10).toFixed(0)} ${W} ${y} L${W} ${(y + 18)} L0 ${(y + 18)} Z"
                 fill="${ink(Math.min(2, Math.floor(i / 2)), -i * 2)}" opacity="${(.88 - i * .07).toFixed(2)}"/>`;
          g += `<path d="M0 ${y} Q${(W / 2).toFixed(0)} ${(y - 10).toFixed(0)} ${W} ${y}"
                 stroke="${hsl(hSky, 24, 96)}" stroke-width="1.2" fill="none" opacity=".38"/>`;
        }
      } else if (land === '기와') {
        // 기와지붕이 겹겹이 — 처마 끝이 살짝 들립니다
        g += `<path d="${ridge(rng, 178, 12, W)}" fill="${ink(0)}"/>`;
        for (let row = 0; row < 3; row++) {
          const yb = 226 + row * 26;
          for (let i = 0; i < 5; i++) {
            const x = i * (W / 4.4) + (row % 2 ? 22 : 0) + (rng() - .5) * 12;
            const w2 = 44 + rng() * 20;
            g += `<path d="M${(x - w2 / 2 - 6).toFixed(0)} ${yb} q6 -4 10 -6 q${(w2 / 2 - 10).toFixed(0)} -12 ${(w2 - 20).toFixed(0)} 0 q4 2 10 6 Z"
                   fill="${ink(2 - Math.min(2, row), -2)}" opacity="${(.55 + row * .15).toFixed(2)}"/>`;
          }
        }
      } else if (land === '억새') {
        // 억새밭 — 바람에 한쪽으로 누운 이삭
        for (let i = 0; i < 2; i++) g += `<path d="${ridge(rng, 198 + i * 24, 14, W)}" fill="${ink(i + 1)}"/>`;
        for (let i = 0; i < 44; i++) {
          const x = rng() * W, y = 238 + rng() * 58, hgt = 16 + rng() * 22;
          g += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q4 -${(hgt * .6).toFixed(0)} ${(9 + rng() * 5).toFixed(0)} -${hgt.toFixed(0)}"
                 stroke="${ink(2, 8)}" stroke-width="1.5" fill="none" opacity="${(.34 + rng() * .3).toFixed(2)}"/>`;
          g += `<ellipse cx="${(x + 10).toFixed(0)}" cy="${(y - hgt).toFixed(0)}" rx="3.4" ry="1.8" fill="${hsl(hSky, 18, 94)}" opacity="${(.4 + rng() * .3).toFixed(2)}" transform="rotate(-28 ${(x + 10).toFixed(0)} ${(y - hgt).toFixed(0)})"/>`;
        }
      } else {
        // 산 — 능선 세 겹 (멀수록 옅게)
        const bases = [168, 198, 232];
        for (let i = 0; i < 3; i++) {
          g += `<path d="${ridge(rng, bases[i], 16 + i * 9, W)}" fill="${ink(i)}"/>`;
        }
      }

      // 앞쪽 나무나 억새
      const kind = rng();
      const n = 3 + Math.floor(rng() * 5);
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

      /* 앞쪽 잔풀과 돌 — 어느 풍경이든 아래쪽이 휑하지 않게.
         바다는 물이라 넣지 않습니다. */
      if (land !== '바다') {
        for (let i = 0; i < 12; i++) {
          const x = rng() * W, y = 276 + rng() * 26;
          if (rng() < .45) {
            g += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(3 + rng() * 5).toFixed(1)}" ry="${(2 + rng() * 2.4).toFixed(1)}"
                   fill="${ink(2, -8)}" opacity="${(.22 + rng() * .2).toFixed(2)}"/>`;
          } else {
            for (let k = 0; k < 3; k++) {
              g += `<path d="M${(x + k * 2.6).toFixed(1)} ${y.toFixed(0)} q2 -${(5 + rng() * 6).toFixed(0)} ${(3 + rng() * 3).toFixed(0)} -${(8 + rng() * 7).toFixed(0)}"
                     stroke="${ink(2, -4)}" stroke-width="1.3" fill="none" opacity="${(.24 + rng() * .2).toFixed(2)}"/>`;
            }
          }
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
        season: season.name, time: time.name,
        land,
        skyTop, skyBot, glow: glowC,
        svg,
        url: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
      };
    }
  };

  global.Scene = Scene;
})(window);
