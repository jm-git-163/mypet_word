/* ============================================================
   gull.js — 부산 갈매기 마스코트 (3D 그림판)

   카톡·바탕화면 썸네일과 같은 입체 갈매기 PNG 를 씁니다.
   기분(mood)마다 다른 포즈 그림을 보여주고,
   가벼운 CSS 움직임(들썩·갸웃·펄쩍)을 덧붙입니다.
   「움직임 줄이기」를 켜면 정지 그림만 나옵니다.
   ============================================================ */
(function (global) {
  'use strict';

  /* 배포 캐시를 갈아엎을 때 숫자만 올리면 됩니다 */
  const VER = '2';

  /* 기분 → 그림 파일 · CSS 움직임 클래스 */
  const MOODS = {
    반가움:   { src: 'stand.png',  anim: 'gull-bob' },
    편안함:   { src: 'happy.png',  anim: 'gull-soft' },
    갸웃:     { src: 'stand.png',  anim: 'gull-tilt' },
    신남:     { src: 'cheer.png',  anim: 'gull-hop' },
    보고싶음: { src: 'miss.png',   anim: 'gull-soft' },
    졸림:     { src: 'sleep.png',  anim: 'gull-soft', zzz: true },
    먹이:     { src: 'eat.png',    anim: 'gull-bob' },
    달림:     { src: 'run.png',    anim: 'gull-hop' }
  };

  function assetUrl(file) {
    /* play.html 기준 상대경로. file:// 에서도 동작합니다. */
    try {
      return new URL('images/gull/' + file + '?v=' + VER, document.baseURI || location.href).href;
    } catch (e) {
      return 'images/gull/' + file + '?v=' + VER;
    }
  }

  function reduceMotion(opts) {
    return (opts && opts.still) ||
      (typeof document !== 'undefined' && document.body &&
        document.body.classList.contains('reduce-motion'));
  }

  /**
   * @param {string} mood  반가움|편안함|갸웃|신남|보고싶음|졸림|먹이|달림
   * @param {number} size  가로·세로 px
   * @param {{still?:boolean, flapBurst?:boolean}} opts
   * @returns {string} HTML
   */
  function make(mood, size, opts) {
    const m = MOODS[mood] || MOODS['반가움'];
    const s = size || 120;
    const still = reduceMotion(opts);
    const burst = opts && opts.flapBurst && !still;
    const anim = still ? '' : (burst ? 'gull-burst' : m.anim);
    const zzz = (!still && m.zzz)
      ? '<span class="gull-zzz" aria-hidden="true">Z</span>' : '';

    return (
      '<span class="gullmascot' + (anim ? ' ' + anim : '') + '" ' +
        'style="width:' + s + 'px;height:' + s + 'px" aria-hidden="true">' +
        '<img class="gullimg" src="' + assetUrl(m.src) + '" ' +
          'alt="" width="' + s + '" height="' + s + '" draggable="false" ' +
          'decoding="async">' +
        zzz +
      '</span>'
    );
  }

  global.Gull = { make, MOODS, VER };
})(window);
