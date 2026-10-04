const VERSION = '1.0.0';
const BUILD = 'dev'; // CI při nasazení nahradí zkráceným SHA commitu, aby každé nasazení vyvolalo aktualizaci
const CACHE = 'tuk-' + VERSION + '-' + BUILD;
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'js/app.js', 'js/cs.js', 'js/version.js', 'js/store.js', 'js/series.js', 'js/csv.js', 'js/triggers.js',
  'js/settings.js', 'js/repo.js', 'js/backup.js', 'js/report.js', 'js/pdf.js', 'js/install.js', 'js/share.js',
  'js/vendor/qrcode.js', 'js/vendor/pdf-lib.js', 'js/vendor/fontkit.js', 'fonts/NotoSans-Regular.ttf',
  'assets/icon-192.png', 'assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' obejde HTTP cache (GitHub Pages ~10 min), aby se do nové cache nedostala směs starých a nových souborů
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tuk-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cached) =>
      cached ||
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match('index.html'))
    )
  );
});
