/* ============================================================
   intro.js — 앱을 열 때 나오는 짧은 인트로

   바탕화면 아이콘을 누르면 흰 화면이 잠깐 있다가 앱이 떴습니다.
   그 잠깐이 「덜 만든 것 같은」 첫인상을 만듭니다.
   그 자리를 복실이가 채웁니다.

   흐름 (모두 2.7초)
     ① 복실이가 담긴 유리 공이 왼쪽에서 굴러 들어와 통 튀고 멈춥니다
     ② 「낱말 산책」 글자가 한 자씩 올라옵니다
     ③ 발자국이 톡톡 찍히고 종소리 한 번
     ④ 스르르 사라지고 앱이 나옵니다

   지키는 것
     · 아무 데나 누르면 곧바로 건너뜁니다 (기다리게 하지 않습니다)
     · 「움직임 줄이기」를 켜셨으면 움직이지 않고 짧게만 보입니다
     · 같은 창에서 새로고침할 때는 다시 보이지 않습니다
       (앱을 새로 열 때만 — 매번 보면 성가십니다)

   ※ 소리는 브라우저가 「사용자가 한 번 누르기 전에는」 막습니다.
     그래서 첫 실행에서는 종소리가 안 날 수 있습니다. 정상입니다.
   ============================================================ */
(function (global) {
  'use strict';

  const KEY = 'nanmal.intro.shown';
  const WORD = '낱말 산책';

  function skipReason() {
    // 같은 창에서 새로고침한 경우
    try { if (sessionStorage.getItem(KEY)) return '이미 봄'; } catch (e) { /* 무시 */ }
    return null;
  }

  /**
   * 저장해 둔 기록을 읽습니다.
   *
   * 앱(app.js)이 Store 를 세우기 전에 인트로가 먼저 뜨므로,
   * 저장소를 직접 읽습니다. 없거나 깨져 있으면 첫 방문으로 봅니다.
   */
  function saved() {
    try {
      const d = JSON.parse(localStorage.getItem('nanmal.v1') || '{}');
      return {
        name: (d.pet && d.pet.name) || '복실이',
        bond: (d.pet && d.pet.bond) || 1,
        days: (d.days && d.days.length) || 0,
        done: d.totalDone || 0
      };
    } catch (e) { return { name: '복실이', bond: 1, days: 0, done: 0 }; }
  }

  function reduced() {
    try {
      const raw = localStorage.getItem('nanmal.v1');
      if (raw && JSON.parse(raw).settings && JSON.parse(raw).settings.motion) return true;
    } catch (e) { /* 저장한 값이 없으면 그냥 움직입니다 */ }
    return global.matchMedia
      && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function build(slow) {
    const box = document.createElement('div');
    box.id = 'intro';
    box.className = 'intro' + (slow ? ' still' : '');
    box.setAttribute('role', 'presentation');

    const inner = document.createElement('div');
    inner.className = 'intro-in';

    /* 복실이가 유리 공에 담겨 굴러 들어옵니다.
       공은 굴러야 공답습니다. 다만 강아지까지 같이 돌면 거꾸로
       뒤집혀 우스워지므로, 공만 돌리고 강아지는 그대로 둡니다. */
    const ball = document.createElement('div');
    ball.className = 'intro-ball';

    const shell = document.createElement('div');
    shell.className = 'intro-shell';
    ball.appendChild(shell);

    const me = saved();
    const dog = document.createElement('div');
    dog.className = 'intro-dog';
    // 오래 함께 걸으셨을수록 더 신이 나 있습니다
    dog.innerHTML = global.Dog
      ? global.Dog.make(me.bond >= 8 ? '신남' : me.done > 0 ? '반가움' : '갸웃', 132) : '';
    ball.appendChild(dog);

    inner.appendChild(ball);

    // 글자 한 자씩. 띄어쓰기는 자리만 차지하게 둡니다.
    const word = document.createElement('div');
    word.className = 'intro-word';
    [...WORD].forEach((ch, i) => {
      const s = document.createElement('span');
      if (ch === ' ') { s.className = 'sp'; s.innerHTML = '&nbsp;'; }
      else { s.textContent = ch; s.style.animationDelay = (0.98 + i * 0.07).toFixed(2) + 's'; }
      word.appendChild(s);
    });
    inner.appendChild(word);

    const sub = document.createElement('div');
    sub.className = 'intro-sub';
    sub.textContent = me.done > 0
      ? `${me.name}와 함께 걸은 지 ${me.days}일`
      : '매일 함께 걷는 낱말 퍼즐';
    inner.appendChild(sub);

    /* 발자국으로 친화도를 보여 드립니다.
       다섯 칸 가운데 자란 만큼만 색이 찹니다. 늘 같은 그림이면
       두 번째부터는 볼 까닭이 없어 건너뛰게 됩니다.
       (유대는 함께한 날로 자랍니다 — 1~50단계) */
    const paws = document.createElement('div');
    paws.className = 'intro-paws';
    const lit = me.done > 0 ? Math.max(1, Math.min(5, Math.ceil(me.bond / 10))) : 0;
    for (let i = 0; i < 5; i++) {
      const p = document.createElement('span');
      if (i < lit) p.className = 'on';
      p.style.animationDelay = (1.60 + i * 0.10).toFixed(2) + 's';
      p.innerHTML =
        '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor">' +
        '<ellipse cx="12" cy="16.6" rx="6.1" ry="5.1"/>' +
        '<ellipse cx="4.6" cy="10.2" rx="2.7" ry="3.3"/>' +
        '<ellipse cx="9.6" cy="6.3" rx="2.7" ry="3.5"/>' +
        '<ellipse cx="14.4" cy="6.3" rx="2.7" ry="3.5"/>' +
        '<ellipse cx="19.4" cy="10.2" rx="2.7" ry="3.3"/></svg>';
      paws.appendChild(p);
    }
    inner.appendChild(paws);

    box.appendChild(inner);
    return box;
  }

  /** 종소리 한 번 — 막혀 있으면 조용히 넘어갑니다 */
  function chime() {
    const A = global.Audio2;
    if (!A) return;
    try {
      if (!global.Store || !global.Store.data.settings.sfx) return;
      A.fx([
        [523.25, 0.00, 0.7, 0.55],
        [783.99, 0.10, 0.7, 0.6],
        [1046.50, 0.20, 1.1, 0.7],
        [1567.98, 0.30, 1.0, 0.28]
      ], 'bell', 0.26);
      A.fx([[130.81, 0, 1.0, 1]], 'soft', 0.16);
    } catch (e) { /* 소리가 막혀 있어도 인트로는 그대로 나옵니다 */ }
  }

  function run() {
    if (skipReason()) return;
    try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* 무시 */ }

    const slow = reduced();
    const box = build(slow);
    document.body.appendChild(box);
    document.body.classList.add('introing');

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      box.classList.add('out');
      document.body.classList.remove('introing');
      setTimeout(() => box.remove(), 340);
    };

    // 아무 데나 누르면 곧바로 넘어갑니다
    box.addEventListener('pointerdown', finish);

    // 종소리는 공이 바닥에 닿는 순간에
    if (!slow) setTimeout(chime, 900);
    setTimeout(finish, slow ? 900 : 2750);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  global.Intro = { run };
})(window);
