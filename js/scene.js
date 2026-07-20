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

  const Scene = {
    SEASONS, TIMES, WEATHERS, PLACES,

    /** 레벨 번호 → 풍경 정보 (이름·색·그림) */
    make(level) {
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
      const hSky = season.hue + jitter;
      const hRidge = season.hue2 + jitter * 0.6;
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

      // 능선 세 겹 (멀수록 옅게)
      const bases = [168, 198, 232];
      for (let i = 0; i < 3; i++) {
        g += `<path d="${ridge(rng, bases[i], 16 + i * 9, W)}" fill="${hsl(hRidge, sat * (.5 + i * .16), time.ridgeL[i])}"/>`;
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
        skyTop, skyBot, glow: glowC,
        svg,
        url: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
      };
    }
  };

  global.Scene = Scene;
})(window);
