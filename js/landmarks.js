/* ============================================================
   landmarks.js — 해운대 명소 커스텀 삽화 (앱 그림톤)

   scene.js의 일반 풍경 대신, 각 명소의 '실제 모습 특징'을 살려
   부드러운 앱 그림톤(낮은 채도·둥근 형태)으로 그린 SVG입니다.
   동네 탭의 그림과 갤러리에 쓰입니다.

   Landmarks.svg(key) → SVG 문자열
   Landmarks.url(key) → data URI (배경 이미지용)
   ============================================================ */
(function (global) {
  'use strict';
  const wrap = inner =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;

  // 자주 쓰는 조각
  const skyDay = '<rect width="120" height="90" fill="#dff1f6"/>';
  const skyDusk = '<defs><linearGradient id="sd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9a8"/><stop offset="1" stop-color="#f6b6a0"/></linearGradient></defs><rect width="120" height="90" fill="url(#sd)"/>';
  const skyNight = '<defs><linearGradient id="sn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2a4a"/><stop offset="1" stop-color="#39406a"/></linearGradient></defs><rect width="120" height="90" fill="url(#sn)"/>';
  const stars = n => { let s = ''; for (let i = 0; i < n; i++) s += `<circle cx="${(i * 37 % 118) + 2}" cy="${(i * 19 % 34) + 3}" r="${i % 3 ? 0.8 : 1.2}" fill="#fff" opacity="${0.4 + (i % 4) * 0.15}"/>`; return s; };
  const sun = (x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="#ffe6a3"/>`;
  const moon = (x, y) => `<circle cx="${x}" cy="${y}" r="8" fill="#fdf6df"/><circle cx="${x - 3}" cy="${y - 2}" r="1.5" fill="#eadfc0" opacity=".6"/>`;

  /* 서핑 자세 — 보드 위에 서서 무릎을 굽히고 두 팔을 벌려 균형을 잡습니다.
     x,y = 보드가 놓인 자리 / s = 크기 / top = 래시가드 색 */
  const surferPose = (x, y, s, top) =>
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="M-13 7 L13 3 L15 6.5 L-11 10.5 Z" fill="#2f3a44"/>` +                       // 보드
    `<g stroke="#2b3440" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M-6 6 L-3.5 0.5 L0 -1.5"/><path d="M6.5 3.5 L3 -0.5 L0 -1.5"/></g>` +        // 굽힌 두 다리
    `<path d="M-2.4 -9.5 q3 -2.2 5.4 0 l0.8 8 h-7 Z" fill="${top}"/>` +                    // 상체(래시가드)
    `<circle cx="1.6" cy="-12.6" r="2.9" fill="#3a2e26"/>` +                               // 머리
    `<g stroke="${top}" stroke-width="2" fill="none" stroke-linecap="round">` +
    `<path d="M-1.5 -8 L-10 -10.5"/><path d="M3.5 -8.5 L11 -13"/></g>` +                   // 벌린 두 팔
    `</g>`;

  const L = {};

  // 해운대해수욕장 — 마천루 스카이라인 뒤, 넓은 백사장과 파라솔
  L.haeundae_beach = wrap(skyDay + sun(100, 16) +
    '<g fill="#cbd5db">' +
    '<rect x="4" y="26" width="8" height="24"/><rect x="15" y="18" width="7" height="32"/><rect x="24" y="30" width="9" height="20"/><rect x="35" y="12" width="6" height="38"/><rect x="43" y="24" width="8" height="26"/><rect x="70" y="20" width="7" height="30"/><rect x="79" y="10" width="6" height="40"/><rect x="87" y="26" width="9" height="24"/><rect x="99" y="22" width="7" height="28"/></g>' +
    '<rect y="50" width="120" height="22" fill="#7fc3dc"/><path d="M0 50 q20 4 40 0 t40 0 t40 0 v6H0Z" fill="#a7dcec"/>' +
    '<rect y="66" width="120" height="24" fill="#f0e2c4"/>' +
    '<g><line x1="26" y1="76" x2="26" y2="66" stroke="#caa" stroke-width="1.4"/><path d="M18 66a8 8 0 0 1 16 0Z" fill="#e46a5a"/>' +
    '<line x1="54" y1="80" x2="54" y2="69" stroke="#caa" stroke-width="1.4"/><path d="M46 69a8 8 0 0 1 16 0Z" fill="#4f93c4"/>' +
    '<line x1="90" y1="78" x2="90" y2="68" stroke="#caa" stroke-width="1.4"/><path d="M82 68a8 8 0 0 1 16 0Z" fill="#e9b44a"/></g>');

  // 마린시티 — 물가에 솟은 고층 마천루 야경 + 물빛 반영
  L.marine_city = wrap(skyNight + stars(10) + moon(104, 14) +
    '<g>' +
    '<rect x="8" y="30" width="12" height="42" fill="#2c3a5e"/><rect x="22" y="16" width="14" height="56" fill="#33436b"/><rect x="38" y="36" width="10" height="36" fill="#2a3860"/><rect x="50" y="10" width="15" height="62" fill="#38487094"/><rect x="50" y="10" width="15" height="62" fill="#38486f"/><rect x="67" y="26" width="12" height="46" fill="#2e3c64"/><rect x="81" y="18" width="13" height="54" fill="#34446c"/><rect x="96" y="34" width="11" height="38" fill="#2b3960"/>' +
    '</g>' +
    // 불 켜진 창
    '<g fill="#ffd98a">' + (() => { let w = ''; const cols = [[10, 32], [24, 18], [40, 38], [52, 12], [69, 28], [83, 20], [98, 36]]; cols.forEach(([x, y]) => { for (let r = 0; r < 6; r++)for (let c = 0; c < 2; c++) if ((r + c + x) % 3) w += `<rect x="${x + c * 5}" y="${y + r * 6}" width="3" height="3"/>`; }); return w; })() + '</g>' +
    '<rect y="72" width="120" height="18" fill="#1a2848"/>' +
    '<g fill="#ffd98a" opacity=".5">' + [16, 30, 44, 58, 74, 88, 102].map(x => `<rect x="${x}" y="73" width="2" height="12"/>`).join('') + '</g>');

  // 동백섬 누리마루 — 물가의 육각 한옥 지붕 회의장 + 등대
  L.nurimaru = wrap(skyDusk + sun(24, 18) +
    '<path d="M0 40q40 -12 120 0v50H0Z" fill="#8bbf8f"/>' +      // 섬 초록
    '<rect y="66" width="120" height="24" fill="#7ab6cf"/>' +
    // 누리마루 (육각 겹지붕)
    '<g transform="translate(70 40)">' +
    '<path d="M-26 14h52l-8 10h-36Z" fill="#d9c9b0"/>' +
    '<path d="M-30 14q30 -20 60 0Z" fill="#c98a5a"/>' +
    '<path d="M-22 2q22 -15 44 0Z" fill="#d9a06a"/>' +
    '<path d="M-14 -8q14 -10 28 0Z" fill="#e0b07a"/>' +
    '</g>' +
    // 등대
    '<g transform="translate(20 44)"><rect x="-3" y="0" width="6" height="22" fill="#fff"/><rect x="-3" y="6" width="6" height="4" fill="#e46a5a"/><rect x="-2" y="-6" width="4" height="6" fill="#ffd98a"/></g>');

  // 영화의 거리 — 흰 벽 테라스에 선 촬영 카메라·양팔 벌린 조형물, 뒤로 푸른 바다와 광안대교
  L.movie_street = wrap(
    '<defs><linearGradient id="mss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ccdee"/><stop offset="1" stop-color="#dbeefb"/></linearGradient></defs>' +
    '<rect width="120" height="90" fill="url(#mss)"/>' +
    // 먼 산
    '<path d="M0 40q14 -13 27 -5 q11 -9 21 3 q11 -7 20 4v6H0Z" fill="#a2b7c6" opacity=".85"/>' +
    '<path d="M74 42q10 -9 20 -2 q9 -5 26 4v6H74Z" fill="#b0c2ce" opacity=".8"/>' +
    // 바다
    '<rect y="44" width="120" height="14" fill="#3f9fd0"/>' +
    '<path d="M0 44q30 3 60 0t60 0v3H0Z" fill="#6bbde4" opacity=".65"/>' +
    // 광안대교 (낮) — 흰 주탑·상판·케이블
    '<g>' +
    '<path d="M4 40Q24 29 42 26 Q60 38 78 26 Q98 31 118 40" fill="none" stroke="#e4ecf1" stroke-width="1.3"/>' +
    '<line x1="4" y1="41" x2="118" y2="41" stroke="#eef4f7" stroke-width="2.2"/>' +
    '<line x1="4" y1="43.6" x2="118" y2="43.6" stroke="#c6d4dd" stroke-width="1"/>' +
    '<g stroke="#f4f8fa" stroke-width="2.6"><line x1="42" y1="42" x2="42" y2="24"/><line x1="78" y1="42" x2="78" y2="24"/></g>' +
    '<g stroke="#dae4ea" stroke-width="0.7">' + [12, 22, 32, 52, 62, 70, 88, 98, 108].map(x => `<line x1="${x}" y1="${34 + Math.abs(x - 60) * 0.09}" x2="${x}" y2="41"/>`).join('') + '</g>' +
    '</g>' +
    // 오른쪽 흰 건물 (파란 돔·아치창)
    '<path d="M92 72V48h28v24Z" fill="#f3f1ec"/>' +
    '<path d="M96 48q10 -9 20 0Z" fill="#3f7fc4"/>' +
    '<rect x="102" y="57" width="8" height="14" rx="4" fill="#3f7fc4"/>' +
    '<rect x="92" y="53" width="28" height="1.4" fill="#ddd9d1"/>' +
    // 가운데·왼쪽 흰 벽 (계단식)
    '<path d="M0 72V54h26v18Z" fill="#efede7"/>' +
    '<path d="M26 72V60h44v12Z" fill="#e8e6df"/>' +
    '<rect x="0" y="58" width="26" height="1.6" fill="#5a97cc"/>' +
    // 돌 테라스
    '<rect y="72" width="120" height="18" fill="#cfc9bc"/>' +
    '<g stroke="#bdb6a8" stroke-width="0.7">' + [77, 83].map(y => `<line x1="0" y1="${y}" x2="120" y2="${y}"/>`).join('') +
    [16, 40, 64, 88, 108].map(x => `<line x1="${x}" y1="72" x2="${x}" y2="90"/>`).join('') + '</g>' +
    // 조형물① 양팔 벌린 사람
    '<g transform="translate(18 72)" stroke="#23262c" stroke-width="2.1" fill="none" stroke-linecap="round">' +
    '<circle cx="0" cy="-20" r="2.6" fill="#23262c" stroke="none"/>' +
    '<path d="M0 -18v11"/><path d="M0 -15l-9 -7M0 -15l9 -7"/><path d="M0 -7l-5 7M0 -7l5 7"/></g>' +
    // 조형물② 촬영 카메라와 촬영기사
    '<g transform="translate(62 60)">' +
    '<path d="M0 6l-8 12M0 6l8 12M0 6v12" stroke="#23262c" stroke-width="1.9" fill="none" stroke-linecap="round"/>' +
    '<rect x="-9" y="-4" width="15" height="10" rx="1.6" fill="#23262c"/>' +
    '<rect x="6" y="-1" width="6" height="5" rx="1" fill="#23262c"/>' +
    '<circle cx="-5" cy="-7" r="3.4" fill="#23262c"/><circle cx="1" cy="-7" r="3.4" fill="#23262c"/>' +
    '<g transform="translate(14 0)" stroke="#23262c" stroke-width="2.1" fill="none" stroke-linecap="round">' +
    '<circle cx="0" cy="-8" r="2.4" fill="#23262c" stroke="none"/>' +
    '<path d="M0 -6v8"/><path d="M0 -4l-8 -1"/><path d="M0 2l-3 10M0 2l3 10"/></g></g>');

  // 달맞이길 — 굽이길, 벚꽃, 보름달
  L.dalmaji = wrap(skyDusk + moon(96, 18) +
    '<path d="M0 46q40 -10 120 4v40H0Z" fill="#9ab98f"/>' +
    '<path d="M0 62q30 -14 60 -2 t60 6" fill="none" stroke="#e8d9bf" stroke-width="5"/>' +   // 굽이길
    '<path d="M0 62q30 -14 60 -2 t60 6" fill="none" stroke="#cbb89a" stroke-width="1.5" stroke-dasharray="3 4"/>' +
    // 벚나무 (분홍 뭉치)
    '<g>' + [[16, 58], [34, 52], [92, 66], [108, 60]].map(([x, y]) => `<rect x="${x - 1}" y="${y}" width="2" height="10" fill="#8a6d4b"/><circle cx="${x}" cy="${y - 3}" r="8" fill="#f6c1cf"/><circle cx="${x - 5}" cy="${y}" r="6" fill="#f8cdd8"/><circle cx="${x + 5}" cy="${y}" r="6" fill="#efb3c4"/>`).join('') + '</g>' +
    '<rect y="78" width="120" height="12" fill="#84a6cf"/>');   // 바다 한 줄

  // 청사포 — 빨강·흰 등대가 마주 선 포구
  L.cheongsapo = wrap(skyDay + sun(96, 16) +
    '<rect y="46" width="120" height="44" fill="#7fc3dc"/><path d="M0 46q20 4 40 0t40 0t40 0v6H0Z" fill="#a7dcec"/>' +
    '<rect x="10" y="60" width="40" height="6" fill="#c9b9a6"/><rect x="70" y="60" width="40" height="6" fill="#c9b9a6"/>' + // 방파제 둘
    '<g transform="translate(24 42)"><rect x="-4" y="0" width="8" height="20" fill="#e0655a"/><rect x="-3" y="-7" width="6" height="7" fill="#ffd98a"/><rect x="-5" y="-10" width="10" height="3" fill="#b34a40"/></g>' +
    '<g transform="translate(92 42)"><rect x="-4" y="0" width="8" height="20" fill="#fff" stroke="#dcd0bf" stroke-width="1"/><rect x="-3" y="-7" width="6" height="7" fill="#ffd98a"/><rect x="-5" y="-10" width="10" height="3" fill="#e0655a"/></g>');

  // 해변열차 (블루라인파크) — 짙푸른 바다를 끼고 해안 선로를 달리는 알록달록 열차
  L.beach_train = wrap(skyDay + sun(102, 14) +
    // 짙푸른 동해 바다
    '<rect y="14" width="120" height="48" fill="#1f9fd4"/>' +
    '<path d="M0 14q30 5 60 0t60 0v6H0Z" fill="#57c2e6" opacity=".55"/>' +
    '<g stroke="#cbeaf5" stroke-width="1" fill="none" opacity=".55">' +
    '<path d="M66 26q8 -3 16 0"/><path d="M88 38q8 -3 16 0"/><path d="M72 50q8 -3 16 0"/></g>' +
    // 왼쪽 솔숲 언덕
    '<path d="M0 20q20 -4 32 16 q7 13 5 54H0Z" fill="#5f9f6d"/>' +
    '<g fill="#4a8557">' + [[10, 30], [20, 42], [7, 50], [24, 58]].map(([x, y]) => `<path d="M${x} ${y}l6 10h-12Z"/><path d="M${x} ${y + 5}l7 11h-14Z"/>`).join('') + '</g>' +
    // 해안 산책로 + 사람들
    '<path d="M0 76q46 -10 120 -18v32H0Z" fill="#ead9bd"/>' +
    '<g fill="#7d7168" opacity=".75">' + [[34, 74], [46, 71], [58, 69], [72, 66], [86, 64]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6"/><rect x="${x - 1}" y="${y + 1}" width="2" height="4" rx="1"/>`).join('') + '</g>' +
    // 고가 선로(콘크리트 구조 + 레일)
    '<path d="M2 66q48 -12 118 -24" stroke="#e3e9ec" stroke-width="8" fill="none"/>' +
    '<path d="M2 62q48 -12 118 -24" stroke="#98a5ac" stroke-width="1.6" fill="none"/>' +
    '<path d="M2 64.5q48 -12 118 -24" stroke="#98a5ac" stroke-width="1.6" fill="none"/>' +
    // 열차 세 량 (파랑·노랑·초록)
    '<g transform="translate(16 58) rotate(-11)">' +
    [['#2f6fd0', 0], ['#f5c542', 25], ['#46b06a', 50]].map(([c, x]) =>
      `<g transform="translate(${x} 0)">` +
      `<rect x="0" y="-13" width="23" height="15" rx="4" fill="${c}"/>` +
      `<rect x="2.5" y="-10.5" width="7.5" height="6" rx="1.6" fill="#eaf6fb"/>` +
      `<rect x="12" y="-10.5" width="7.5" height="6" rx="1.6" fill="#eaf6fb"/>` +
      `<rect x="0" y="1" width="23" height="2" rx="1" fill="#5b6770"/></g>`).join('') +
    '</g>');

  // 송정해수욕장 — 솔숲 언덕 아래 서핑의 바다, 백사장의 컬러 SONGJEONG 조형물
  L.songjeong = wrap(
    '<defs><linearGradient id="sjs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6d7ef"/><stop offset="1" stop-color="#e0f1f9"/></linearGradient></defs>' +
    '<rect width="120" height="90" fill="url(#sjs)"/>' +
    '<g fill="#ffffff" opacity=".7"><ellipse cx="22" cy="11" rx="13" ry="4.4"/><ellipse cx="92" cy="8" rx="11" ry="3.8"/></g>' +
    // 빽빽한 솔숲 언덕
    '<path d="M0 46q16 -24 36 -23 q26 1 40 -6 q22 -10 44 7 v22H0Z" fill="#3c6a44"/>' +
    '<g fill="#4e8455" opacity=".95">' +
    [[8, 30], [18, 26], [28, 24], [38, 22], [50, 21], [62, 22], [74, 24], [86, 26], [98, 28], [110, 31]]
      .map(([x, y]) => `<path d="M${x} ${y}l6 12h-12Z"/><path d="M${x} ${y + 6}l7 13h-14Z"/>`).join('') + '</g>' +
    // 흰 서프하우스
    '<rect x="93" y="35" width="19" height="13" fill="#f5f9fb" stroke="#c9d7de" stroke-width="0.8"/>' +
    '<g fill="#7fb3d5">' + [[96, 38], [102, 38], [108, 38], [96, 43], [102, 43]].map(([x, y]) => `<rect x="${x}" y="${y}" width="4" height="3"/>`).join('') + '</g>' +
    '<rect x="91" y="48" width="23" height="2" rx="1" fill="#dfe7ea"/>' +
    // 회녹빛 바다
    '<rect y="50" width="120" height="18" fill="#7fa8a6"/>' +
    '<path d="M0 50q30 3 60 0t60 0v3H0Z" fill="#9cc0bb" opacity=".7"/>' +
    // 서퍼들이 타는 파도 마루
    '<g fill="#cfeaf0" opacity=".85">' +
    '<path d="M22 60q10 -7 20 -2 q-9 5 -20 2Z"/><path d="M66 56q8 -6 17 -2 q-8 4 -17 2Z"/><path d="M92 62q7 -5 15 -2 q-7 4 -15 2Z"/></g>' +
    // 부서지는 파도 거품
    '<path d="M0 63q16 -6 32 -1 q16 5 30 -1 q16 -6 30 -1 q16 5 28 1v5H0Z" fill="#eef8f8" opacity=".92"/>' +
    // 보드 위에 선 서퍼들 — 무릎을 굽히고 양팔을 벌린 균형 자세
    [[34, 60, 1.15, '#d0453f'], [76, 55, 0.85, '#2f6fd0'], [100, 61, 0.68, '#f2b32e']]
      .map(([x, y, s, top]) => surferPose(x, y, s, top)).join('') +
    // 엎드려 노 젓는 서퍼 (멀리)
    '<g transform="translate(16 56) scale(.85)">' +
    '<ellipse cx="0" cy="2.5" rx="9.5" ry="2" fill="#2f3a44"/>' +
    '<path d="M-5 0.5q5 -3.5 10 0" stroke="#2b3440" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
    '<circle cx="6.5" cy="-2" r="2.1" fill="#3a2e26"/>' +
    '<path d="M-4 1l-4 3" stroke="#2b3440" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>' +
    // 백사장
    '<rect y="68" width="120" height="22" fill="#efe3c8"/>' +
    // SONGJEONG 컬러 조형물
    '<g font-family="sans-serif" font-size="15" font-weight="700" text-anchor="middle">' +
    (() => { const ch = ['S', 'O', 'N', 'G', 'J', 'E', 'O', 'N', 'G'], c = ['#2f7ed8', '#e0433c', '#3fa45b', '#2f7ed8', '#f2b32e', '#2f7ed8', '#3fa45b', '#e0433c', '#2f7ed8']; return ch.map((s, i) => `<text x="${9 + i * 12.7}" y="85" fill="${c[i]}">${s}</text>`).join(''); })() +
    '</g>');

  // 장산 — 도심을 굽어보는 능선
  L.jangsan = wrap(skyDay + sun(98, 16) +
    '<path d="M0 54L28 24l16 18 12 -12 20 22 14 -10 20 20v36H0Z" fill="#8bbf8f"/>' +
    '<path d="M28 24l8 9-7 8-7-9Z" fill="#e7f0e9" opacity=".6"/>' +
    '<path d="M0 60q60 -6 120 2v28H0Z" fill="#6fa876"/>' +
    '<g fill="#e6dccf">' + [6, 14, 22, 34, 46, 78, 90, 102, 110].map(x => `<rect x="${x}" y="${68 + (x % 3) * 2}" width="6" height="${18 - (x % 3) * 2}"/>`).join('') + '</g>');

  // 영화의전당 — 하늘을 덮는 거대 캔틸레버 지붕, 아랫면이 무지개 LED 로 빛나는 야경
  L.bic = wrap(
    '<defs><linearGradient id="sn2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f1830"/><stop offset="1" stop-color="#2a3358"/></linearGradient>' +
    '<linearGradient id="led" x1="0" y1="0" x2="1" y2="0">' +
    '<stop offset="0" stop-color="#ff5f6d"/><stop offset=".18" stop-color="#ffa64d"/><stop offset=".36" stop-color="#ffe66d"/><stop offset=".54" stop-color="#5ee0a0"/><stop offset=".72" stop-color="#4fa8f5"/><stop offset="1" stop-color="#b07cf0"/>' +
    '</linearGradient></defs>' +
    '<rect width="120" height="90" fill="url(#sn2)"/>' + stars(9) +
    // 뒤편 도심 실루엣
    '<g fill="#243154"><rect x="1" y="30" width="10" height="36"/><rect x="13" y="21" width="9" height="45"/><rect x="97" y="26" width="10" height="40"/><rect x="109" y="34" width="9" height="32"/></g>' +
    '<g fill="#ffd98a" opacity=".5">' + [[3, 34], [16, 26], [99, 30], [111, 38]].map(([x, y]) => `<rect x="${x}" y="${y}" width="2" height="2"/><rect x="${x + 4}" y="${y + 8}" width="2" height="2"/>`).join('') + '</g>' +
    // 거대 지붕 — 아랫면 LED(무지개). 평평하지 않고 완만하게 휜 곡면입니다.
    '<path d="M2 56 Q60 43 118 40 L118 53 Q60 57 2 69 Z" fill="url(#led)"/>' +
    // 곡면을 따라 흐르는 결
    '<g stroke="#ffffff" stroke-width="0.6" fill="none" opacity=".25">' +
    '<path d="M2 60 Q60 47 118 44"/><path d="M2 64 Q60 52 118 48"/></g>' +
    // LED 위로 반짝이는 별빛 (곡선을 따라 배치)
    '<g fill="#ffffff">' + [[12, 62], [26, 57], [40, 53], [54, 50], [68, 48], [82, 46], [96, 45], [110, 44], [20, 64], [62, 53], [90, 49]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 0.9 : 1.5}" opacity="${0.65 + (i % 3) * 0.12}"/>`).join('') + '</g>' +
    // 지붕 두께(윗면) — 같은 곡률
    '<path d="M2 49 Q60 36 118 33 L118 40 Q60 43 2 56 Z" fill="#e6ebee"/>' +
    '<path d="M2 49 Q60 36 118 33" stroke="#ffffff" stroke-width="1" fill="none" opacity=".7"/>' +
    // 지붕을 받치는 기둥 하나
    '<path d="M55 67 L66 65.5 L64 82 L57 82 Z" fill="#8d99a4"/>' +
    // 각진 건물 몸체
    '<path d="M22 82 L98 82 L88 66 L32 68 Z" fill="#33415e"/>' +
    '<g fill="#7fb3d5" opacity=".55">' + [38, 50, 62, 74].map(x => `<rect x="${x}" y="72" width="6" height="8"/>`).join('') + '</g>' +
    '<rect y="82" width="120" height="8" fill="#161f3a"/>');

  // 벡스코 — 가로로 긴 유리 전시장, 지붕 위 BEXCO 사인과 왼쪽 흰 첨탑, 하늘의 비둘기 떼
  L.bexco = wrap(
    '<defs><linearGradient id="bxs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fbfe6"/><stop offset="1" stop-color="#dff0fa"/></linearGradient>' +
    '<linearGradient id="bxg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d3e5f0"/><stop offset="1" stop-color="#9dbdd2"/></linearGradient></defs>' +
    '<rect width="120" height="90" fill="url(#bxs)"/>' +
    // 구름
    '<g fill="#ffffff" opacity=".75"><ellipse cx="24" cy="15" rx="15" ry="5"/><ellipse cx="33" cy="12" rx="9" ry="3.6"/><ellipse cx="95" cy="11" rx="13" ry="4.4"/></g>' +
    // 비둘기 떼
    '<g stroke="#6a7b88" stroke-width="1" fill="none" opacity=".75">' +
    [[40, 8], [47, 13], [54, 7], [60, 16], [66, 10], [72, 18], [78, 12], [84, 20], [50, 22], [62, 25]]
      .map(([x, y]) => `<path d="M${x} ${y}q2.5 -2.5 5 0q2.5 -2.5 5 0"/>`).join('') + '</g>' +
    // 왼쪽 흰 첨탑
    '<rect x="15" y="16" width="5" height="30" fill="#f4f8fa" stroke="#c8d7e0" stroke-width="0.8"/>' +
    '<rect x="13.5" y="13" width="8" height="4" rx="1.5" fill="#e6eef3"/>' +
    // BEXCO 사인 (지붕 위)
    '<text x="62" y="40" font-size="12" font-weight="700" text-anchor="middle" fill="#31465a" font-family="sans-serif" letter-spacing="1.2">BEXCO</text>' +
    // 옥상 코니스 — 반듯하지 않고 완만하게 휘었습니다
    '<path d="M1 45 Q60 38 119 45 L119 50 Q60 43 1 50 Z" fill="#eef4f8"/>' +
    // 유리 본체(곡면 파사드)
    '<path d="M3 50 Q60 43 117 50 L117 74 Q60 69 3 74 Z" fill="url(#bxg)" stroke="#89a9bd" stroke-width="0.8"/>' +
    // 곡률을 따라 흐르는 유리 가로줄
    '<g stroke="#b7d0de" stroke-width="0.9" fill="none">' +
    [54, 59, 64, 69].map(y => `<path d="M3 ${y} Q60 ${y - 6} 117 ${y}"/>`).join('') + '</g>' +
    // 세로 멀리언
    '<g stroke="#c6dae5" stroke-width="0.6" opacity=".65">' +
    [20, 38, 56, 74, 92, 108].map(x => `<line x1="${x}" y1="${49 + Math.abs(x - 60) * 0.11}" x2="${x}" y2="${73 + Math.abs(x - 60) * 0.06}"/>`).join('') + '</g>' +
    // 파사드를 가로지르는 대형 현수막
    '<path d="M14 59 Q60 53.5 106 59 L106 67 Q60 61.5 14 67 Z" fill="#1b4f8a"/>' +
    '<g fill="#eaf3fb" opacity=".92">' +
    '<rect x="22" y="61.4" width="26" height="1.6" rx="0.8"/><rect x="22" y="64.4" width="18" height="1.4" rx="0.7"/>' +
    '<rect x="72" y="60.6" width="24" height="1.6" rx="0.8"/><rect x="72" y="63.6" width="16" height="1.4" rx="0.7"/></g>' +
    // 광장
    '<rect y="74" width="120" height="16" fill="#dde6ec"/>' +
    // 흰 천막 부스 줄
    '<g fill="#fbfdfe" stroke="#c9d6de" stroke-width="0.7">' +
    [8, 24, 40, 56, 72, 88, 104].map(x => `<path d="M${x - 8} 82 l8 -7 l8 7 Z"/>`).join('') + '</g>' +
    '<g fill="#b9c8d2">' + [[34, 85], [66, 86], [98, 85]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8"/><rect x="${x - 1.3}" y="${y + 1}" width="2.6" height="4" rx="1"/>`).join('') + '</g>');

  // 부산아쿠아리움 — 아치형 수중터널. 천장의 웃는 가오리, 상어, 물고기 떼, 관람객 실루엣
  L.aquarium = wrap(
    '<defs><linearGradient id="aqw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#33a6dd"/><stop offset=".55" stop-color="#1569ab"/><stop offset="1" stop-color="#0b3e75"/></linearGradient>' +
    '<linearGradient id="aqf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9b8bf0"/><stop offset="1" stop-color="#453aa8"/></linearGradient></defs>' +
    '<rect width="120" height="90" fill="url(#aqw)"/>' +
    // 터널 안쪽(밝은 물빛)과 소실점
    '<path d="M12 90V52a48 30 0 0 1 96 0v38Z" fill="#4fb4e2" opacity=".42"/>' +
    '<ellipse cx="60" cy="60" rx="21" ry="13" fill="#93dcf4" opacity=".5"/>' +
    // 아크릴 아치 테두리 두 겹(원근)
    '<path d="M12 90V52a48 30 0 0 1 96 0v38" fill="none" stroke="#d3f0fc" stroke-width="1.8" opacity=".7"/>' +
    '<path d="M24 90V57a36 22 0 0 1 72 0v33" fill="none" stroke="#d3f0fc" stroke-width="1" opacity=".45"/>' +
    // 바닥 통로(보랏빛 조명)
    '<path d="M26 90 L50 61 L70 61 L94 90 Z" fill="url(#aqf)" opacity=".9"/>' +
    '<path d="M45 90 L56 63 L64 63 L75 90 Z" fill="#cbbcff" opacity=".35"/>' +
    // 천장의 가오리 — 흰 배에 웃는 얼굴
    '<g transform="translate(40 27) rotate(-8)">' +
    '<path d="M0 0 q-17 3 -26 14 q14 -1 26 6 q12 -7 26 -6 q-9 -11 -26 -14 Z" fill="#e2ebf1"/>' +
    '<path d="M24 15 q7 4 11 13" stroke="#e2ebf1" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
    '<circle cx="-6" cy="7" r="1.5" fill="#596b77"/><circle cx="6" cy="7" r="1.5" fill="#596b77"/>' +
    '<path d="M-6 12 q6 5 12 0" stroke="#596b77" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
    '</g>' +
    // 상어 (오른쪽 위, 오른쪽을 향해)
    '<g fill="#0d3a6d" opacity=".92" transform="translate(88 34) rotate(-5)">' +
    '<ellipse cx="0" cy="0" rx="17" ry="5.2"/>' +
    '<path d="M-17 0 l-9 -6 v12 Z"/><path d="M-1 -5 l4 -8 4 8 Z"/><path d="M2 5 l4 6 5 -4 Z"/>' +
    '</g>' +
    // 작은 상어 (왼쪽 아래)
    '<g fill="#12467f" opacity=".8" transform="translate(24 52) rotate(6) scale(.6)">' +
    '<ellipse cx="0" cy="0" rx="16" ry="5"/><path d="M-16 0 l-8 -5 v10 Z"/><path d="M-1 -5 l4 -7 3 7 Z"/></g>' +
    // 물고기 떼
    '<g fill="#eaf7ff" opacity=".85">' +
    [[70, 20], [76, 24], [82, 19], [88, 23], [94, 18], [73, 28], [85, 29]]
      .map(([x, y]) => `<path d="M${x} ${y}q3.5 -2.6 7 0q-3.5 2.6 -7 0Z"/>`).join('') + '</g>' +
    // 바위·해초
    '<path d="M0 90V72q8 -4 14 4 q6 8 6 14Z" fill="#0a3260"/>' +
    '<path d="M120 90V70q-9 -3 -15 6 q-5 7 -5 14Z" fill="#0a3260"/>' +
    '<g stroke="#2f8f6a" stroke-width="2" fill="none" opacity=".8">' +
    '<path d="M10 90q4 -8 0 -14"/><path d="M16 90q-3 -7 1 -12"/><path d="M108 90q-4 -8 0 -13"/></g>' +
    // 관람객 실루엣 (아이가 손으로 가리킵니다)
    '<g fill="#07203f">' +
    '<circle cx="33" cy="73" r="4.2"/><path d="M27 90v-11a6 6 0 0 1 12 0v11Z"/>' +
    '<circle cx="45" cy="78" r="3.2"/><path d="M41 90v-8.5a4 4 0 0 1 8 0V90Z"/>' +
    '<path d="M47 79 l7 -8" stroke="#07203f" stroke-width="2.6" stroke-linecap="round"/>' +
    '</g>' +
    // 물방울
    '<g fill="#ffffff" opacity=".3">' + [[16, 22], [34, 16], [104, 26], [58, 14]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4"/>`).join('') + '</g>');

  // 수영만 요트경기장 — 흰 돛단배들의 마리나
  L.suyeong_marina = wrap(skyDay + sun(100, 16) +
    '<g fill="#c9d5db"><rect x="4" y="30" width="6" height="18"/><rect x="12" y="24" width="6" height="24"/><rect x="20" y="32" width="7" height="16"/></g>' +
    '<rect y="48" width="120" height="42" fill="#6fb8d6"/>' +
    '<path d="M0 48q20 4 40 0t40 0t40 0v5H0Z" fill="#9fd3e8"/>' +
    // 돛단배들
    '<g>' + [[24, 60, 1], [52, 66, 1.2], [82, 58, 0.9], [102, 68, 1.1]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-8 6h16l-3 5h-10Z" fill="#eef3f5"/><path d="M0 4V-14" stroke="#8a7f76" stroke-width="1.4"/><path d="M1 -12L11 2H1Z" fill="#fff"/><path d="M-1 -8L-8 2H-1Z" fill="#e46a5a"/></g>`).join('') + '</g>' +
    '<line x1="0" y1="55" x2="120" y2="55" stroke="#e6dccf" stroke-width="2" opacity=".5"/>');

  // 해운대온천 — 김이 오르는 온천탕
  // 해운대온천 — 바다가 내다보이는 인피니티 노천탕. 석양·김·소나무 가지·바다를 보는 사람들
  L.haeundae_spa = wrap(
    '<defs><linearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9a2"/><stop offset="1" stop-color="#ffb489"/></linearGradient>' +
    '<linearGradient id="spw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#addfe9"/><stop offset="1" stop-color="#6bbccf"/></linearGradient></defs>' +
    '<rect width="120" height="90" fill="url(#spk)"/>' +
    // 석양
    '<circle cx="74" cy="33" r="15" fill="#ffeec8" opacity=".5"/>' +
    '<circle cx="74" cy="33" r="7.5" fill="#fff7de"/>' +
    // 바다
    '<rect y="42" width="120" height="16" fill="#e9a877"/>' +
    '<path d="M0 42q30 3 60 0t60 0v3H0Z" fill="#f5c497" opacity=".7"/>' +
    // 해가 물에 부서지는 길
    '<g fill="#ffe6b8" opacity=".7">' + [44, 48, 52, 56].map((y, i) => `<rect x="${71 - i * 3}" y="${y}" width="${6 + i * 6}" height="2" rx="1"/>`).join('') + '</g>' +
    // 먼 방파제
    '<rect x="96" y="43" width="22" height="2" rx="1" fill="#c98a61" opacity=".75"/>' +
    // 인피니티 가장자리(물이 바다와 이어지는 선)
    '<rect y="57" width="120" height="2" fill="#ffffff" opacity=".8"/>' +
    // 온천물
    '<rect y="59" width="120" height="24" fill="url(#spw)"/>' +
    '<g stroke="#e0f4f9" stroke-width="1" fill="none" opacity=".6"><path d="M6 67q10 -3 20 0t20 0"/><path d="M70 74q10 -3 20 0t20 0"/></g>' +
    // 피어오르는 김
    '<g fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".45">' +
    '<path d="M18 58q-6 -8 0 -15 q6 -8 0 -14"/><path d="M52 56q-6 -8 0 -14 q6 -7 0 -13"/><path d="M94 58q-6 -8 0 -14 q6 -8 0 -13"/></g>' +
    // 드리운 소나무 가지
    '<g stroke="#4a7a56" stroke-width="2.4" fill="none" stroke-linecap="round">' +
    '<path d="M0 11q18 7 36 5"/><path d="M11 14q4 6 2 11"/><path d="M24 17q5 5 4 10"/></g>' +
    '<g fill="#5d8f66" opacity=".95">' + [[7, 13], [17, 16], [27, 16], [35, 14]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="7.5" ry="4"/>`).join('') + '</g>' +
    // 정원 등롱
    '<circle cx="8" cy="36" r="4.2" fill="#ffe9b0" stroke="#e3bb7c" stroke-width="0.9"/>' +
    '<circle cx="20" cy="31" r="3.2" fill="#ffe9b0" stroke="#e3bb7c" stroke-width="0.8"/>' +
    // 바다를 바라보는 두 사람(뒷모습)
    '<g fill="#4a3a33">' +
    '<path d="M40 65q0 -8 5.5 -8 q5.5 0 5.5 8 q-2 9 -5.5 10 q-3.5 -1 -5.5 -10Z"/>' +   // 긴 머리
    '<path d="M35 78q0 -9 10.5 -9 q10.5 0 10.5 9Z"/>' +                                 // 어깨
    '<circle cx="63" cy="67" r="4.3"/>' +
    '<path d="M55 79q0 -8 8 -8 q8 0 8 8Z"/>' +
    '</g>' +
    // 나무 데크
    '<rect y="83" width="120" height="7" fill="#cbb89a"/>' +
    '<g stroke="#b8a488" stroke-width="0.8">' + [14, 34, 54, 74, 94].map(x => `<line x1="${x}" y1="83" x2="${x}" y2="90"/>`).join('') + '</g>');

  /* 고른 빛깔(팔레트)을 명소 그림에도 입힙니다.
     화면은 살구빛인데 그림만 파랗게 남아 있으면 두 화면처럼 보입니다.
     다만 색을 통째로 돌리면 바다가 보라색이 되므로,
     기준 하늘빛(약 197도)에서 벗어난 만큼만 '조금' 돌립니다. */
  const BASE_HUE = 197;
  const tint = (svg, deg, opt) => {
    const o = opt || {};
    // 색을 많이 돌리면 바다가 분홍이 되고 모래가 초록이 됩니다.
    // 팔레트 기운만 감돌 정도로 아주 조금(최대 ±18도)만 돌립니다.
    const raw = ((deg - BASE_HUE + 540) % 360 - 180) * (o.strength == null ? 0.14 : o.strength);
    const cap = o.cap == null ? 18 : o.cap;
    const rot = Math.round(Math.max(-cap, Math.min(cap, raw)));
    const sat = o.sat == null ? 1.03 : o.sat;
    if (!rot && sat === 1) return svg;
    const f = `<filter id="tn" color-interpolation-filters="sRGB">` +
      `<feColorMatrix type="hueRotate" values="${rot}"/>` +
      `<feColorMatrix type="saturate" values="${sat}"/></filter>`;
    // 그림 전체를 필터 안에 넣습니다. 원본 문자열은 건드리지 않습니다.
    return svg.replace(/^(<svg[^>]*>)([\s\S]*)(<\/svg>)$/,
      (m, head, body, tail) => `${head}<defs>${f}</defs><g filter="url(#tn)">${body}</g>${tail}`);
  };

  /* 그림 맨 위(하늘)의 바탕색 — 산책 화면에서 그림 아래 남는 자리를
     이 색으로 채워, 그림과 이어 붙인 것처럼 보이게 합니다. */
  const TOP = {
    haeundae_beach: '#dff1f6', marine_city: '#1d2a4a', nurimaru: '#ffd9a8',
    movie_street: '#8ccdee', dalmaji: '#ffd9a8', cheongsapo: '#dff1f6',
    beach_train: '#dff1f6', songjeong: '#a6d7ef', jangsan: '#dff1f6',
    bic: '#0f1830', bexco: '#7fbfe6', aquarium: '#33a6dd',
    suyeong_marina: '#dff1f6', haeundae_spa: '#ffd9a2'
  };
  // tint()와 같은 만큼(±18도)만 돌려, 그림에 입힌 빛깔과 어긋나지 않게 맞춥니다.
  const hexToHsl = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    let h = 0, s = 0;
    const d = max - min;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  };
  const hslToHex = (h, s, l) => {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
      h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    const to255 = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + to255(r) + to255(g) + to255(b);
  };

  global.Landmarks = {
    svg: (k, deg, opt) => L[k] ? (deg == null ? L[k] : tint(L[k], deg, opt)) : '',
    has: k => !!L[k],
    keys: () => Object.keys(L),
    url: (k, deg, opt) => L[k]
      ? 'data:image/svg+xml;utf8,' + encodeURIComponent(deg == null ? L[k] : tint(L[k], deg, opt))
      : '',
    /** 그 명소의 하늘색(빛깔 톤 반영). deg 를 안 주면 원래 색 그대로. */
    topColor: (k, deg) => {
      const base = TOP[k] || '#dff1f6';
      if (deg == null) return base;
      const raw = ((deg - BASE_HUE + 540) % 360 - 180) * 0.14;
      const rot = Math.max(-18, Math.min(18, raw));
      const [h, s, l] = hexToHsl(base);
      return hslToHex(h + rot, Math.min(1, s * 1.03), l);
    }
  };
})(window);
