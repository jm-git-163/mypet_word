/* ============================================================
   gull.js — 움직이는 부산 갈매기 마스코트 (입체·귀여움 버전)

   그림 파일(GIF) 대신 그려서 움직입니다.
   · 수 KB, 어떤 크기로 키워도 또렷, 인터넷 없이도 됩니다.
   · 방사형 그라데이션으로 통통한 입체감을, 큰 눈으로 귀여움을 냅니다.
   · SVG 안 SMIL 애니메이션으로 스스로 움직입니다(외부 CSS 불필요).
   · 기분(mood) 여러 버전 + '새우깡 먹기(먹이)' 실감 모션.
   · 「움직임 줄이기」를 켜면 멈춘 그림으로 나옵니다.

   ※ 마스코트/스낵은 특정 상표를 베끼지 않은 원본 그림입니다.
   ============================================================ */
(function (global) {
  'use strict';

  const MOODS = {
    반가움:   { eye: 'open',   beak: 'open',   flap: 'mid',  bob: 'mid',  extra: '' },
    편안함:   { eye: 'open',   beak: 'closed', flap: 'slow', bob: 'slow', extra: '' },
    갸웃:     { eye: 'open',   beak: 'closed', flap: 'slow', bob: 'slow', tilt: -8, extra: '' },
    신남:     { eye: 'happy',  beak: 'open',   flap: 'fast', bob: 'hop',  extra: 'hearts' },
    보고싶음: { eye: 'sad',    beak: 'closed', flap: 'slow', bob: 'slow', extra: '' },
    졸림:     { eye: 'closed', beak: 'closed', flap: 'none', bob: 'slow', extra: 'zzz' },
    먹이:     { eye: 'happy',  beak: 'wide',   flap: 'fast', bob: 'mid',  extra: 'snack' }
  };

  const FLAP = { none: 0, slow: 3.2, mid: 2.0, fast: 1.0 };

  function eyes(kind, reduce) {
    const blink = reduce ? '' :
      `<animate attributeName="ry" values="10;10;1.4;10" keyTimes="0;.88;.94;1" dur="4.6s" repeatCount="indefinite"/>`;
    const L = 92, R = 116, y = 88;   // 작아진 머리(104,90 r33)에 맞춘 자리
    if (kind === 'closed')
      return `<path d="M${L - 8} ${y} q8 7 16 0" stroke="#3a2e26" stroke-width="3" fill="none" stroke-linecap="round"/>` +
             `<path d="M${R - 8} ${y} q8 7 16 0" stroke="#3a2e26" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    if (kind === 'happy')
      return `<path d="M${L - 8} ${y + 1} q8 -10 16 0" stroke="#3a2e26" stroke-width="3.2" fill="none" stroke-linecap="round"/>` +
             `<path d="M${R - 8} ${y + 1} q8 -10 16 0" stroke="#3a2e26" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
    const dy = kind === 'sad' ? 3 : 0;
    const eye = (cx) =>
      `<ellipse cx="${cx}" cy="${y + dy}" rx="8" ry="10" fill="#2c2016">${blink}</ellipse>` +
      `<circle cx="${cx + 2.8}" cy="${y + dy - 3.6}" r="2.9" fill="#fff"/>` +
      `<circle cx="${cx - 2.8}" cy="${y + dy + 2.8}" r="1.4" fill="#fff" opacity=".8"/>`;
    return eye(L) + eye(R);
  }

  function beak(kind, reduce) {
    // 부리는 얼굴 가운데 아래. 벌리면 위·아래로 갈라집니다.
    const cx = 104, y = 106;   // 작아진 머리 중심에 맞춤
    if (kind === 'closed')
      return `<path d="M${cx - 9} ${y} L${cx} ${y + 13} L${cx + 9} ${y} Q${cx} ${y + 4} ${cx - 9} ${y} Z" fill="url(#gbeak)" stroke="#e0902a" stroke-width="1"/>`;
    const openAnim = (kind === 'wide' && !reduce)
      ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 3;0 0" dur="0.45s" repeatCount="indefinite"/>` : '';
    /* 위·아래 부리가 서로 다른 방향(둘 다 아래로 뾰족)이면 부리 하나가
       중간에서 꺾인 것처럼 보입니다. 위 부리는 납작한 지붕 모양으로,
       그 사이 어두운 입속을 보여야 '벌어진 입'으로 읽힙니다.
       wide(새우깡 먹을 때)는 open(그냥 기분 좋을 때)보다 더 크게 벌립니다. */
    const wide = kind === 'wide';
    const r = wide ? 1.5 : 1;   // 벌어짐 크기 배율
    return `<g>${openAnim}` +
      `<path d="M${cx - 10} ${y - 2} Q${cx} ${y + 2 * r} ${cx + 10} ${y - 2} ` +
      `L${cx + 8} ${y + 1} Q${cx} ${y + 4} ${cx - 8} ${y + 1} Z" fill="url(#gbeak)" stroke="#e0902a" stroke-width="1"/>` +
      `<path d="M${cx - 9} ${y} Q${cx} ${y + 16 * r} ${cx + 9} ${y} Q${cx} ${y + 7} ${cx - 9} ${y} Z" fill="#7a3b2e" opacity=".9"/>` +
      `<path d="M${cx - 9} ${y + 3} Q${cx} ${y + 3 + 17 * r} ${cx + 9} ${y + 3} Q${cx} ${y + 9} ${cx - 9} ${y + 3} Z" ` +
      `fill="#e8952c" stroke="#cf8320" stroke-width="1"/>` +
      `</g>`;
  }

  function make(mood, size, opts) {
    const m = MOODS[mood] || MOODS['반가움'];
    const s = size || 120;
    const reduce = (opts && opts.still) ||
      (typeof document !== 'undefined' && document.body && document.body.classList.contains('reduce-motion'));

    const flapDur = FLAP[m.flap] || 0;
    /* 날개는 몸에 붙인 채 살짝 들썩이기만 합니다.
       크게 펼쳐 회전시키면 갈매기가 아니라 박쥐처럼 보입니다.
       다만 쓰다듬었을 때는 '진짜 파닥인다'는 게 느껴져야 하므로,
       그때만 훨씬 크게 두 번 퍼덕이고 멈춥니다(끝없이 반복하지 않음). */
    const wingAnim = (opts && opts.flapBurst && !reduce)
      ? `<animateTransform attributeName="transform" type="rotate" ` +
        `values="0 128 126;-26 128 126;6 128 126;-26 128 126;6 128 126;0 128 126" ` +
        `dur="0.85s" repeatCount="1" additive="sum"/>`
      : (reduce || !flapDur) ? '' :
        `<animateTransform attributeName="transform" type="rotate" values="0 128 126;-7 128 126;0 128 126" dur="${flapDur}s" repeatCount="indefinite" additive="sum"/>`;

    /* 반대쪽(뒤) 날개 — 앞 날개를 x=100 기준으로 뒤집은 것입니다.
       몸통 타원 뒤에 먼저 그려 대부분 가려지고, 몸 밖으로 살짝 삐져나온
       만큼만 보입니다. 각도 부호도 뒤집어야 앞 날개와 "같이" 퍼덕입니다
       (그대로 두면 서로 반대로 움직여 어색합니다). */
    const backWingAnim = (opts && opts.flapBurst && !reduce)
      ? `<animateTransform attributeName="transform" type="rotate" ` +
        `values="0 72 126;26 72 126;-6 72 126;26 72 126;-6 72 126;0 72 126" ` +
        `dur="0.85s" repeatCount="1" additive="sum"/>`
      : (reduce || !flapDur) ? '' :
        `<animateTransform attributeName="transform" type="rotate" values="0 72 126;7 72 126;0 72 126" dur="${flapDur}s" repeatCount="indefinite" additive="sum"/>`;

    const bobDur = m.bob === 'hop' ? 0.7 : (m.bob === 'slow' ? 3.4 : 2.1);
    const bobVals = m.bob === 'hop' ? '0 0;0 -11;0 0' : '0 0;0 -4;0 0';
    const bobAnim = reduce ? '' :
      `<animateTransform attributeName="transform" type="translate" values="${bobVals}" dur="${bobDur}s" repeatCount="indefinite" additive="sum"/>`;

    // 머리 — 먹이 상태에서는 고개를 들어 받아먹고 꿀꺽합니다
    // 먹이: 앞으로 콕 집었다가(살짝 숙임) 고개를 들어 꿀꺽 삼킵니다
    const headAnim = (m.extra === 'snack' && !reduce)
      ? `<animateTransform attributeName="transform" type="rotate" values="0 104 92;8 104 92;8 104 92;-15 104 92;0 104 92" keyTimes="0;.3;.42;.62;1" dur="1.6s" repeatCount="indefinite" additive="sum"/>`
      : (m.tilt ? '' : '');
    const tilt = m.tilt ? `rotate(${m.tilt} 104 92)` : '';

    // 기분 덧그림
    let extra = '';
    if (m.extra === 'hearts' && !reduce) {
      extra = [0, 1, 2].map(i =>
        `<path d="M0 0 q-5 -6 -10 0 q-5 6 10 15 q15 -9 10 -15 q-5 -6 -10 0 Z" fill="#ef7183" opacity="0" transform="translate(${146 + i * 10} 66) scale(${0.55 + i * 0.12})">` +
        `<animateTransform attributeName="transform" type="translate" values="${146 + i * 10} 66;${150 + i * 10} 22" dur="1.7s" begin="${i * 0.5}s" repeatCount="indefinite" additive="sum"/>` +
        `<animate attributeName="opacity" values="0;.9;0" dur="1.7s" begin="${i * 0.5}s" repeatCount="indefinite"/></path>`).join('');
    } else if (m.extra === 'zzz' && !reduce) {
      extra = `<text x="150" y="58" font-size="20" fill="#9aa7ae" font-family="sans-serif" font-weight="700" opacity="0">Z` +
        `<animate attributeName="opacity" values="0;1;0" dur="2.6s" repeatCount="indefinite"/>` +
        `<animateTransform attributeName="transform" type="translate" values="0 0;12 -20" dur="2.6s" repeatCount="indefinite"/></text>`;
    } else if (m.extra === 'snack') {
      /* 새우깡 — 옆에서 다가와 부리 앞에 닿으면 사라집니다(먹은 것).
         위에서 떨어뜨리면 어디서 오는지 알 수 없어 어색합니다. */
      const drop = reduce ? '' :
        `<animateTransform attributeName="transform" type="translate" values="52 -20;3 0;3 0" keyTimes="0;.36;1" dur="1.6s" repeatCount="indefinite" additive="sum"/>` +
        `<animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.36;.43;1" dur="1.6s" repeatCount="indefinite"/>`;
      const crumbs = reduce ? '' : [[-1, 0.55], [1, 0.68]].map(([dir, bg]) =>
        `<circle cx="104" cy="120" r="1.9" fill="#e8952c" opacity="0">` +
        `<animate attributeName="opacity" values="0;1;0" keyTimes="0;.12;1" dur="1.6s" begin="${bg}s" repeatCount="indefinite"/>` +
        `<animateTransform attributeName="transform" type="translate" values="0 0;${dir * 13} 13" dur="1.6s" begin="${bg}s" repeatCount="indefinite" additive="sum"/></circle>`).join('');
      extra = `<g transform="translate(104 112)"><g opacity="1">${drop}` +
        `<rect x="-9" y="-4.5" width="18" height="9" rx="4" fill="url(#gsnack)" stroke="#d98e28" stroke-width="1.4"/>` +
        `<path d="M-5 -1.6 h10 M-5 1.6 h10" stroke="#d98e28" stroke-width="1.1"/></g></g>` + crumbs;
    }

    return `
<svg class="gullsvg" viewBox="0 0 200 200" width="${s}" height="${s}" aria-hidden="true">
  <defs>
    <radialGradient id="gbody" cx="42%" cy="30%" r="75%">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#fbf6ef"/><stop offset="1" stop-color="#ece0d1"/>
    </radialGradient>
    <radialGradient id="ghead" cx="38%" cy="30%" r="72%">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".62" stop-color="#fdf9f3"/><stop offset="1" stop-color="#ecdfce"/>
    </radialGradient>
    <linearGradient id="gwing" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eef3f5"/><stop offset="1" stop-color="#c4d0d6"/>
    </linearGradient>
    <linearGradient id="gbeak" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffcf6b"/><stop offset="1" stop-color="#f2a733"/>
    </linearGradient>
    <linearGradient id="gsnack" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7c266"/><stop offset="1" stop-color="#eea23a"/>
    </linearGradient>
  </defs>
  <ellipse cx="100" cy="186" rx="44" ry="7" fill="#000" opacity=".08"/>
  <g transform="${tilt}">
   <g>${bobAnim}
    <!-- 다리 -->
    <path d="M88 164 v14 M82 178 h13 M112 164 v14 M106 178 h13" stroke="#f2a733" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <!-- 꼬리 — 왼쪽 뒤로 뻗습니다(새다운 실루엣) -->
    <path d="M54 142 q-26 3 -37 15 q25 10 45 3 Z" fill="#eef2f4" stroke="#d3dde2" stroke-width="1.2"/>
    <!-- 반대쪽 날개 — 몸통에 대부분 가려지고, 삐져나온 만큼만 살짝 보여
         "이쪽도 날개가 있고, 같이 퍼덕인다"는 게 느껴지게 합니다.
         그늘진 쪽이라 앞 날개보다 살짝 어둡게 둡니다. -->
    <g transform="rotate(20 72 126)">
    <g>${backWingAnim}
      <path d="M76 124 q-18 2 -20 22 q-2 16 12 24 q11 6 18 -3 q-8 -7 -9 -18 q-1 -14 6 -23 q-3 -3 -7 -2 Z"
        fill="#d7dee1" stroke="#a9b7bd" stroke-width="1.3"/>
      <path d="M82 168 q-8 4 -13 -2 q-2 7 8 9 q7 -1 5 -7 Z" fill="#8b969c"/>
    </g>
    </g>
    <!-- 몸통 — 낮고 넓은 타원. 동그란 공이면 눈사람이 됩니다 -->
    <ellipse cx="100" cy="142" rx="56" ry="33" fill="url(#gbody)" stroke="#e6dccf" stroke-width="2.4"/>
    <!-- 배 하이라이트 -->
    <ellipse cx="78" cy="136" rx="26" ry="15" fill="#ffffff" opacity=".6"/>
    <!-- '등 회색' 패치는 없앴습니다 — 머리 바로 밑(턱 아래)에 걸쳐
         그림자처럼 보였습니다. 몸통·날개만으로도 입체감은 충분합니다. -->
    <!-- 접은 날개 — 몸통 '바깥쪽 옆선'을 따라 붙입니다. 배 쪽으로 걸치면
         뱃대에 두른 붕대처럼 보이므로 반드시 몸 오른쪽 가장자리 안에서만 그립니다.
         꼬리 쪽으로 -20도 기울여야 실제로 접어 쉬는 날개처럼 보입니다
         (0도로 곧게 두면 팔을 옆으로 편 것처럼 뻣뻣합니다). -->
    <g transform="rotate(-20 128 126)">
    <g>${wingAnim}
      <path d="M124 124 q18 2 20 22 q2 16 -12 24 q-11 6 -18 -3 q8 -7 9 -18 q1 -14 -6 -23 q3 -3 7 -2 Z"
        fill="url(#gwing)" stroke="#a9b7bd" stroke-width="1.3"/>
      <!-- 검은 날개 끝 깃 -->
      <path d="M118 168 q8 4 13 -2 q2 7 -8 9 q-7 -1 -5 -7 Z" fill="#5b6770"/>
    </g>
    </g>

    <!-- 머리 -->
    <g transform="${tilt ? '' : ''}">${headAnim ? '' : ''}
     <g>${headAnim}
      <!-- 머리 — 몸통보다 작고, 몸에 파묻히듯 겹칩니다(따로 얹히면 눈사람) -->
      <circle cx="104" cy="90" r="33" fill="url(#ghead)" stroke="#e6dccf" stroke-width="2.4"/>
      <!-- 머리 위 깃털 -->
      <path d="M104 57 q-4 -9 2 -12 q4 5 -2 12 M111 59 q3 -8 9 -8 q-2 6 -9 8" fill="#dfe7eb"/>
      <!-- 볼 -->
      <ellipse cx="84" cy="100" rx="8" ry="5.5" fill="#ffc0cb" opacity=".7"/>
      <ellipse cx="124" cy="100" rx="8" ry="5.5" fill="#ffc0cb" opacity=".7"/>
      ${eyes(m.eye, reduce)}
      ${beak(m.beak, reduce)}
     </g>
    </g>
   </g>
  </g>
  ${extra}
</svg>`;
  }

  global.Gull = { make, MOODS };
})(window);
