/* 낱말 산책 — 오프라인 우선 (TECH_SPEC §4.3)
   인터넷이 없어도 앱의 모든 기능이 그대로 동작합니다. */
const CACHE = 'busan-nanmal-v124';
const FILES = [
  './', './play.html', './manifest.json', './css/style.css', './data/feed.json',
  './js/hangul.js', './js/data.js', './js/data2.js', './js/data3.js', './js/data4.js', './js/data5.js', './js/data6.js', './js/data7.js', './js/proverbs2.js', './js/notices.js', './js/busan_api.js', './js/haeundae_media.js', './js/crossword.js', './js/bgm.js', './js/scene.js', './js/landmarks.js', './js/theme.js', './js/dog.js', './js/gull.js', './js/install.js', './js/intro.js', './js/update.js', './js/open-outside.js',
   './js/engine.js', './js/app.js', './js/game.js',
  './images/gull/stand.png', './images/gull/happy.png', './images/gull/cheer.png',
  './images/gull/eat.png', './images/gull/run.png', './images/gull/miss.png', './images/gull/sleep.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
/* 캐시 우선 + 뒤에서 갱신(stale-while-revalidate)
   - 인터넷이 없어도 즉시 화면이 뜹니다(캐시에서 바로 응답).
   - 동시에 뒤에서 최신 파일을 받아 캐시를 갱신하므로,
     다음에 앱을 열 때 새 판이 반영됩니다.
     (캐시 우선만 쓰면 사용자가 영영 갱신을 받지 못합니다.) */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  /* 배경음악은 저장하지 않습니다.
     열일곱 곡이 24MB 라, 저장해 두면 어르신 휴대전화가 그만큼 찹니다.
     음악은 없어도 놀이에 지장이 없으므로 그때그때 받아서 틉니다.
     (놀이에 필요한 파일은 그대로 저장하므로 인터넷이 없어도 게임은 됩니다) */
  if (url.pathname.startsWith('/audio/')) return;
  /* 정보 피드(data/)는 '네트워크 우선' — 온라인이면 늘 최신을 보여 주고,
     오프라인이면 마지막에 받아 둔 것을 씁니다. */
  if (url.pathname.includes('/data/')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(hit => {
        const net = fetch(e.request).then(res => {
          if (res && res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => hit || cache.match('./play.html'));
        return hit || net;
      })
    )
  );
});
