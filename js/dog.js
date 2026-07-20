/* ============================================================
   dog.js — 움직이는 말티즈 강아지

   그림 파일(GIF) 대신 그려서 움직입니다.
   · 용량이 수 KB 라 앱이 무거워지지 않고, 어떤 크기로 키워도 또렷합니다.
   · 상황에 따라 표정과 몸짓이 달라집니다(가만히 있는 그림과 다릅니다).
   · 「움직임 줄이기」를 켜면 모든 움직임이 멈춥니다.

   DESIGN.md §10.2 를 따릅니다 — 머리:몸 = 1:1.2(아기 비율),
   흰 털 + 크림빛 그림자(순백 금지), 큰 눈에 반사점 두 개, 표정 다섯 가지.
   ============================================================ */
(function (global) {
  'use strict';

  /* 표정과 몸짓 */
  const MOODS = {
    반가움: { brow: 0, eye: 'open', mouth: 'smile', tail: 'wag', body: 'breathe', ear: 'flop' },
    편안함: { brow: 0, eye: 'open', mouth: 'soft', tail: 'slow', body: 'breathe', ear: 'rest' },
    갸웃: { brow: -6, eye: 'open', mouth: 'soft', tail: 'slow', body: 'tilt', ear: 'flop' },
    신남: { brow: 0, eye: 'happy', mouth: 'open', tail: 'fast', body: 'bounce', ear: 'flap' },
    보고싶음: { brow: 8, eye: 'sad', mouth: 'soft', tail: 'slow', body: 'breathe', ear: 'droop' },
    졸림: { brow: 4, eye: 'closed', mouth: 'soft', tail: 'slow', body: 'breathe', ear: 'droop' }
  };

  function eyes(kind) {
    if (kind === 'closed') {
      return `<path d="M74 96 q9 7 18 0" class="d-line"/><path d="M108 96 q9 7 18 0" class="d-line"/>`;
    }
    if (kind === 'happy') {
      return `<path d="M74 99 q9 -10 18 0" class="d-line"/><path d="M108 99 q9 -10 18 0" class="d-line"/>`;
    }
    const dy = kind === 'sad' ? 3 : 0;
    return `
      <g class="d-blink">
        <ellipse cx="83" cy="${97 + dy}" rx="10" ry="11" fill="url(#deye)"/>
        <ellipse cx="117" cy="${97 + dy}" rx="10" ry="11" fill="url(#deye)"/>
        <circle cx="86.5" cy="${92.5 + dy}" r="3.4" fill="#fff"/>
        <circle cx="120.5" cy="${92.5 + dy}" r="3.4" fill="#fff"/>
        <circle cx="79.5" cy="${101.5 + dy}" r="1.7" fill="#fff" opacity=".7"/>
        <circle cx="113.5" cy="${101.5 + dy}" r="1.7" fill="#fff" opacity=".7"/>
        <path d="M74 ${90 + dy} q9 -5 18 -1" stroke="#e6d2be" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M108 ${89 + dy} q9 -4 18 1" stroke="#e6d2be" stroke-width="2" fill="none" stroke-linecap="round"/>
      </g>`;
  }

  function mouth(kind) {
    if (kind === 'open') {
      return `<ellipse cx="100" cy="126" rx="11" ry="9" fill="#c2566a"/>
              <ellipse cx="100" cy="131" rx="7" ry="5" fill="#f08ca0"/>`;
    }
    if (kind === 'smile') {
      return `<path d="M89 121 q11 10 22 0" class="d-line"/>
              <path d="M100 113 v6" class="d-line"/>`;
    }
    return `<path d="M92 120 q8 6 16 0" class="d-line"/>
            <path d="M100 113 v5" class="d-line"/>`;
  }

  /**
   * 강아지 하나를 만듭니다.
   * @param mood  표정 이름
   * @param size  픽셀 크기
   */
  function make(mood, size) {
    const m = MOODS[mood] || MOODS.편안함;
    const s = size || 110;
    return `
<svg class="dogsvg" viewBox="0 0 200 200" width="${s}" height="${s}"
     data-tail="${m.tail}" data-body="${m.body}" data-ear="${m.ear}" aria-hidden="true">
  <defs>
    <radialGradient id="dfur" cx="40%" cy="28%" r="78%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".62" stop-color="#fdf7f1"/>
      <stop offset="1" stop-color="#efe0d1"/>
    </radialGradient>
    <radialGradient id="dfur2" cx="42%" cy="26%" r="80%">
      <stop offset="0" stop-color="#fffdfb"/>
      <stop offset="1" stop-color="#f2e5d8"/>
    </radialGradient>
    <!-- 몸과 머리가 만나는 자리를 살짝 어둡게 해 앞뒤가 생깁니다 -->
    <radialGradient id="dneck" cx="50%" cy="0%" r="70%">
      <stop offset="0" stop-color="#dcc7b2" stop-opacity=".55"/>
      <stop offset="1" stop-color="#dcc7b2" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="deye" cx="34%" cy="28%">
      <stop offset="0" stop-color="#5d4030"/>
      <stop offset="1" stop-color="#312014"/>
    </radialGradient>
  </defs>

  <!-- 그림자 -->
  <ellipse cx="100" cy="186" rx="46" ry="7" fill="#2d150d" opacity=".10"/>

  <g class="d-body">
    <!-- 꼬리 -->
    <g class="d-tail">
      <path d="M148 150 q22 -6 20 -30 q-2 -14 -14 -12 q-10 2 -8 14 q1 10 8 12"
            fill="url(#dfur)" stroke="#e2cdb8" stroke-width="2.5" stroke-linejoin="round"/>
    </g>
    <!-- 몸통 — 가장자리를 물결지게 해 털처럼 보이게 합니다 -->
    <path d="M100 116
             c 16 0 24 4 31 9 c 8 -3 15 1 14 8 c 6 4 9 10 9 17
             c 2 7 -1 13 -6 17 c -3 8 -11 12 -19 12
             c -8 4 -19 5 -29 5 c -10 0 -21 -1 -29 -5
             c -8 0 -16 -4 -19 -12 c -5 -4 -8 -10 -6 -17
             c 0 -7 3 -13 9 -17 c -1 -7 6 -11 14 -8 c 7 -5 15 -9 31 -9 Z"
          fill="url(#dfur)" stroke="#e6d2be" stroke-width="2.2" stroke-linejoin="round"/>
    <ellipse cx="100" cy="126" rx="34" ry="16" fill="url(#dneck)"/>
    <!-- 앞발 -->
    <ellipse cx="80" cy="176" rx="13" ry="9" fill="url(#dfur)" stroke="#e2cdb8" stroke-width="2.5"/>
    <ellipse cx="120" cy="176" rx="13" ry="9" fill="url(#dfur)" stroke="#e2cdb8" stroke-width="2.5"/>

    <g class="d-head">
      <!-- 귀 -->
      <g class="d-ear d-ear-l">
        <path d="M62 76 c -14 -2 -24 8 -25 24 c -1 15 5 29 14 33 c 9 4 16 -3 18 -14
                 c 2 -12 3 -28 -1 -37 c -1 -4 -3 -6 -6 -6 Z"
              fill="url(#dfur)" stroke="#e0cab4" stroke-width="2.2" stroke-linejoin="round"/>
      </g>
      <g class="d-ear d-ear-r">
        <path d="M138 76 c 14 -2 24 8 25 24 c 1 15 -5 29 -14 33 c -9 4 -16 -3 -18 -14
                 c -2 -12 -3 -28 1 -37 c 1 -4 3 -6 6 -6 Z"
              fill="url(#dfur)" stroke="#e0cab4" stroke-width="2.2" stroke-linejoin="round"/>
      </g>
      <!-- 머리 — 둘레를 잔물결로 둘러 복슬복슬하게 -->
      <path d="M100 46
               c 13 0 20 3 26 8 c 9 -2 16 3 15 11 c 8 4 12 11 11 19
               c 5 6 5 14 0 20 c 1 8 -5 15 -13 16 c -5 7 -14 10 -22 9
               c -6 5 -16 5 -22 0 c -8 1 -17 -2 -22 -9 c -8 -1 -14 -8 -13 -16
               c -5 -6 -5 -14 0 -20 c -1 -8 3 -15 11 -19 c -1 -8 6 -13 15 -11
               c 6 -5 13 -8 26 -8 Z"
            fill="url(#dfur2)" stroke="#e6d2be" stroke-width="2.2" stroke-linejoin="round"/>
      <!-- 이마 털 뭉치 -->
      <path d="M100 48 c -9 0 -16 4 -19 10 c 5 -3 12 -5 19 -5 c 7 0 14 2 19 5 c -3 -6 -10 -10 -19 -10 Z"
            fill="#fff" opacity=".85"/>
      <!-- 눈썹 -->
      <g transform="translate(0 ${m.brow})">
        <path d="M72 80 q11 -5 21 -1" class="d-line" opacity=".55"/>
        <path d="M107 79 q10 -4 21 1" class="d-line" opacity=".55"/>
      </g>
      ${eyes(m.eye)}
      <!-- 코 -->
      <path d="M92 107 c 0 -4 4 -6 8 -6 c 4 0 8 2 8 6 c 0 4 -4 8 -8 8 c -4 0 -8 -4 -8 -8 Z"
            fill="#3a2418"/>
      <ellipse cx="96.5" cy="106" rx="2.4" ry="1.6" fill="#fff" opacity=".6"/>
      ${mouth(m.mouth)}
      <!-- 볼 -->
      <ellipse cx="64" cy="112" rx="9" ry="6" fill="#ffb7c5" opacity=".55"/>
      <ellipse cx="136" cy="112" rx="9" ry="6" fill="#ffb7c5" opacity=".55"/>
    </g>
  </g>
</svg>`;
  }

  global.Dog = { make, MOODS };
})(window);
