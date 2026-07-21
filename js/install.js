/* ============================================================
   install.js — 바탕화면에 놓기

   카톡에서 링크를 눌러 크롬으로 넘어와도, 거기서 끝나면
   다음에 또 카톡을 뒤져 링크를 찾아야 합니다.
   어르신께는 이게 가장 큰 걸림돌입니다.

   그래서 크롬에서 열렸을 때 「바탕화면에 놓기」를 크게 안내합니다.
     · 안드로이드 크롬 — 브라우저가 주는 설치 창을 바로 띄웁니다(한 번 누름).
     · 아이폰 사파리   — 설치 창이 없어 그림으로 자리를 짚어 드립니다.
     · 이미 놓으셨으면 — 아무것도 보이지 않습니다.

   ※ 브라우저는 beforeinstallprompt 를 페이지가 열리자마자 던집니다.
     그때 붙잡아 두지 않으면 나중에 불러도 창이 뜨지 않습니다.
   ============================================================ */
(function (global) {
  'use strict';

  let deferred = null;      // 붙잡아 둔 설치 창
  let asked = false;

  const KEY = 'nanmal.install.hidden';
  const isStandalone = () =>
    (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) ||
    global.navigator.standalone === true;

  const ua = (global.navigator.userAgent || '').toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const inKakao = ua.indexOf('kakaotalk') !== -1;

  global.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    render();
  });

  global.addEventListener('appinstalled', () => {
    deferred = null;
    try { localStorage.setItem(KEY, '1'); } catch (e) { /* 저장이 막혀 있어도 그만입니다 */ }
    const box = document.getElementById('installbar');
    if (box) box.remove();
  });

  /** 안내를 보여 드릴 자리인가 */
  function shouldShow() {
    if (isStandalone()) return false;     // 이미 앱으로 여셨습니다
    if (inKakao) return false;            // 카톡 안에서는 어차피 설치가 안 됩니다
    try { if (localStorage.getItem(KEY)) return false; } catch (e) { /* 무시 */ }
    return !!deferred || isIOS;           // 크롬은 설치 창이 있을 때만, 아이폰은 늘
  }

  /** 산책 화면 맨 아래에 놓는 안내 띠 */
  function render() {
    const host = document.getElementById('installhost');
    if (!host) return;
    host.innerHTML = '';
    if (!shouldShow()) return;

    const wrap = document.createElement('div');
    wrap.id = 'installbar';
    wrap.className = 'card install-bar';

    const img = document.createElement('img');
    img.src = 'images/icon-192.png';
    img.alt = '';
    img.width = 52; img.height = 52;
    img.className = 'install-ico';

    const txt = document.createElement('div');
    txt.className = 'install-txt';
    txt.innerHTML = isIOS && !deferred
      ? '<b>바탕화면에 놓아 두세요</b><span>아래 <b>￼공유</b> 를 누르고 ' +
        '<b>「홈 화면에 추가」</b> 를 골라 주세요.</span>'
      : '<b>바탕화면에 놓아 두세요</b><span>다음부터 카톡을 뒤지지 않고 ' +
        '바로 여실 수 있어요.</span>';

    const row = document.createElement('div');
    row.className = 'install-row';
    row.appendChild(img);
    row.appendChild(txt);
    wrap.appendChild(row);

    if (deferred) {
      const btn = document.createElement('button');
      btn.className = 'btn primary wide';
      btn.style.marginTop = '12px';
      btn.textContent = '바탕화면에 놓기';
      btn.addEventListener('click', install);
      wrap.appendChild(btn);
    }

    const no = document.createElement('button');
    no.className = 'btn quiet wide';
    no.style.marginTop = '4px';
    no.textContent = '나중에 할게요';
    no.addEventListener('click', () => {
      try { localStorage.setItem(KEY, '1'); } catch (e) { /* 무시 */ }
      wrap.remove();
    });
    wrap.appendChild(no);

    host.appendChild(wrap);
  }

  async function install() {
    if (!deferred || asked) return;
    asked = true;
    deferred.prompt();
    try { await deferred.userChoice; } catch (e) { /* 무시 */ }
    deferred = null; asked = false;
    render();
  }

  global.Install = { render, install, get ready() { return !!deferred; }, isStandalone, isIOS };
})(window);
