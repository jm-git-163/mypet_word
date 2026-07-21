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
    return !!deferred || isIOS || waited;
  }

  /**
   * 크롬이 설치 창을 안 줄 때도 있습니다.
   * 이미 설치했다가 지운 경우, 아직 충분히 안 둘러본 경우 등입니다.
   * 그때 아무것도 안 보이면 어머니는 방법을 찾을 길이 없으므로,
   * 잠시 기다렸다가 손으로 하시는 길을 적어 드립니다.
   */
  let waited = false;
  setTimeout(() => {
    if (deferred || isStandalone() || inKakao) return;
    waited = true;
    render();
  }, 3500);

  /**
   * 놓을 자리를 찾습니다.
   *
   * 놀이 화면(play.html)에는 산책 화면 안에 자리(#installhost)가 있습니다.
   * 소개 화면(index.html)에는 그런 자리가 없으므로 화면 아래에 띄웁니다.
   * 카톡으로 보낸 주소가 소개 화면이면 어머니는 여기서 멈추시기 때문에,
   * 안내가 이 화면에도 반드시 떠야 합니다.
   */
  function hostEl() {
    const inApp = document.getElementById('installhost');
    if (inApp) return inApp;

    // 놀이 화면(#view 가 있는 곳)에서는 떠 있는 띠를 만들지 않습니다.
    // 아래 탭바를 가리기 때문입니다. 산책 화면이 그려질 때
    // scrWalk 가 자리를 만들고 다시 불러 주므로 그때까지 기다립니다.
    if (document.getElementById('view')) return null;

    let float = document.getElementById('installfloat');
    if (!float) {
      float = document.createElement('div');
      float.id = 'installfloat';
      float.className = 'install-float';
      document.body.appendChild(float);
    }
    return float;
  }

  /** 안내 띠 그리기 */
  function render() {
    const host = hostEl();
    if (!host) return;
    host.innerHTML = '';
    if (!shouldShow()) return;

    ensureStyle();

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
    // 한 번 누르면 되는 길이 있으면 그것만 말씀드리고,
    // 없으면 메뉴 위치를 짚어 드립니다. 두 가지를 함께 적으면 헷갈립니다.
    txt.innerHTML = deferred
      ? '<b>바탕화면에 놓아 두세요</b><span>다음부터 카톡을 뒤지지 않고 ' +
        '바로 여실 수 있어요.</span>'
      : isIOS
        ? '<b>바탕화면에 놓아 두세요</b><span>아래 <b>공유</b> 단추를 누르고 ' +
          '<b>「홈 화면에 추가」</b> 를 골라 주세요.</span>'
        : '<b>바탕화면에 놓아 두세요</b><span>오른쪽 위 <b>⋮</b> 를 누르고 ' +
          '<b>「홈 화면에 추가」</b> 를 골라 주세요.</span>';

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

  /**
   * 소개 화면에는 앱 CSS(style.css)가 없습니다.
   * 안내가 모양 없이 덩그러니 뜨지 않도록 필요한 것만 한 번 넣어 둡니다.
   * 놀이 화면에서는 style.css 가 이미 같은 이름을 정의하고 있어
   * 여기 값이 덮어쓰지 않도록 :where() 로 우선순위를 0 으로 둡니다.
   */
  function ensureStyle() {
    if (document.getElementById('installcss')) return;
    const st = document.createElement('style');
    st.id = 'installcss';
    st.textContent = `
.install-float{position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;
 max-width:520px;margin:0 auto}
:where(.install-float) .install-bar{background:#fff;border-radius:22px;padding:18px 18px 14px;
 box-shadow:0 10px 40px -8px rgba(45,21,13,.35);
 font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#29211b;text-align:left}
:where(.install-float) .install-row{display:flex;align-items:center;gap:14px}
:where(.install-float) .install-ico{border-radius:16px;flex:none}
:where(.install-float) .install-txt b{display:block;font-size:20px;font-weight:800;line-height:1.4}
:where(.install-float) .install-txt span{display:block;margin-top:4px;font-size:16px;
 line-height:1.55;color:#5b4e44;word-break:keep-all}
:where(.install-float) .install-txt span b{display:inline;font-size:inherit}
:where(.install-float) .btn{display:block;width:100%;min-height:56px;margin-top:12px;
 border:0;border-radius:999px;font-family:inherit;font-size:19px;font-weight:800;cursor:pointer}
:where(.install-float) .btn.primary{background:#ef8f22;color:#3d1f00}
:where(.install-float) .btn.quiet{background:none;color:#5b4e44;min-height:44px;
 text-decoration:underline;font-size:16px;font-weight:600;margin-top:2px}`;
    document.head.appendChild(st);
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
