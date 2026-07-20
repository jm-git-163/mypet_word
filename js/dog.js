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
        <ellipse cx="83" cy="${97 + dy}" rx="9.5" ry="10.5" fill="#3a2418"/>
        <ellipse cx="117" cy="${97 + dy}" rx="9.5" ry="10.5" fill="#3a2418"/>
        <circle cx="86" cy="${93 + dy}" r="3.2" fill="#fff"/>
        <circle cx="120" cy="${93 + dy}" r="3.2" fill="#fff"/>
        <circle cx="80" cy="${101 + dy}" r="1.6" fill="#fff" opacity=".75"/>
        <circle cx="114" cy="${101 + dy}" r="1.6" fill="#fff" opacity=".75"/>
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
    <radialGradient id="dfur" cx="42%" cy="34%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#f3e6da"/>
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
    <!-- 몸통 -->
    <ellipse cx="100" cy="150" rx="46" ry="34" fill="url(#dfur)" stroke="#e2cdb8" stroke-width="2.5"/>
    <!-- 앞발 -->
    <ellipse cx="80" cy="176" rx="13" ry="9" fill="url(#dfur)" stroke="#e2cdb8" stroke-width="2.5"/>
    <ellipse cx="120" cy="176" rx="13" ry="9" fill="url(#dfur)" stroke="#e2cdb8" stroke-width="2.5"/>

    <g class="d-head">
      <!-- 귀 -->
      <g class="d-ear d-ear-l">
        <ellipse cx="55" cy="104" rx="17" ry="30" fill="url(#dfur)" stroke="#e2cdb8" stroke-width="2.5"/>
      </g>
      <g class="d-ear d-ear-r">
        <ellipse cx="145" cy="104" rx="17" ry="30" fill="url(#dfur)" stroke="#e2cdb8" stroke-width="2.5"/>
      </g>
      <!-- 머리 -->
      <circle cx="100" cy="98" r="52" fill="url(#dfur)" stroke="#e2cdb8" stroke-width="2.5"/>
      <!-- 이마 털 -->
      <path d="M78 56 q10 -12 22 -6 q12 -6 22 6 q-11 8 -22 6 q-11 2 -22 -6" fill="#fff" opacity=".9"/>
      <!-- 눈썹 -->
      <g transform="translate(0 ${m.brow})">
        <path d="M72 80 q11 -5 21 -1" class="d-line" opacity=".55"/>
        <path d="M107 79 q10 -4 21 1" class="d-line" opacity=".55"/>
      </g>
      ${eyes(m.eye)}
      <!-- 코 -->
      <ellipse cx="100" cy="110" rx="8" ry="6" fill="#3a2418"/>
      <ellipse cx="97" cy="108" rx="2.5" ry="1.8" fill="#fff" opacity=".55"/>
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
