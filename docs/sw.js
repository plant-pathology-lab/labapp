// Service worker: funzionamento offline dell'interfaccia e notifiche push.
// Quando aggiorni i file dell'app cambia VERSION per forzare l'aggiornamento sui telefoni.
const VERSION = 'labapp-v59';
const SHELL = ['./', './index.html', './styles.css', './app.js', './api.js', './spiegazioni.js', './funghi.js', './config.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/badge-96.png', './icons/emblema.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

// giro 25: le foto già viste restano sul telefono (non cambiano mai: ogni foto ha un nome nuovo), così non si riscaricano
// a ogni apertura. Miniature e foto intere in due cache separate, con un tetto; si svuotano quando si esce dall'account.
const PHOTO_CACHES = { thumb: ['labapp-foto-t', 800], full: ['labapp-foto', 150] };
async function photoFromCache(req, url) {
  const [name, max] = /\.t\.jpg$/i.test(url.pathname) ? PHOTO_CACHES.thumb : PHOTO_CACHES.full;
  const key = url.origin + url.pathname;
  const c = await caches.open(name);
  const hit = await c.match(key);
  if (hit) return hit;
  let res;
  try { res = await fetch(req.url, { mode: 'cors', credentials: 'omit' }); } catch { return fetch(req); }
  if (res.ok) {
    await c.put(key, res.clone());
    const keys = await c.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - max))) await c.delete(k);
  }
  return res;
}

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && !k.startsWith('labapp-foto')).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // libreria Supabase dal CDN: prima la cache
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  // foto del laboratorio (indirizzi firmati di Supabase): prima il telefono, poi la rete
  if (/\/storage\/v1\/object\/sign\/foto\//.test(url.pathname)) { e.respondWith(photoFromCache(req, url)); return; }
  if (url.origin !== location.origin) return;
  // giro 45: le foto di riferimento delle schede dei funghi non cambiano: prima il telefono, poi la rete
  // giro 46: lo stesso per le foto dei nostri isolati (cartella isolati)
  if (url.pathname.includes('/atlante/') || url.pathname.includes('/isolati/')) {
    e.respondWith(caches.open('labapp-foto-atlante').then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  // le chiamate ai dati non passano mai dalla cache
  if (/^\/(rest|auth|storage|functions)\/v1\//.test(url.pathname)) return;
  // file dell'app: rete se c'è (così gli aggiornamenti arrivano subito), altrimenti cache
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
    return res;
  }).catch(async () => (await caches.match(req)) || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: 'LabApp', body: e.data?.text() }; }
  const title = data.title || 'LabApp';
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-96.png',
    tag: data.tag,
    renotify: !!data.tag,
    data: { url: data.url || './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = all.find((c) => c.url.startsWith(self.registration.scope));
    if (win) {
      await win.focus();
      win.postMessage({ type: 'nav', url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
