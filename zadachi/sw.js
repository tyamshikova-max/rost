// Офлайн-кэш приложения «Задачи»
const CACHE = 'zd-app-2026-10-16-313';
const CORE = ['./', 'index.html', 'help.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'brand-64.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('zd-app-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.startsWith(new URL(self.registration.scope).pathname)) {
    // свои файлы: сначала сеть (с проверкой на сервере — иначе браузер до 10 минут отдаёт старую версию из своего кэша), без сети — кэш
    const fresh = req.mode === 'navigate' ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(req, { cache: 'no-cache' });
    e.respondWith(fetch(fresh).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(n => { const cp = n.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return n; })));
  }
});
// напоминания в браузере: клик по уведомлению или кнопки «Готово» / «+15 мин»
self.addEventListener('notificationclick', e => {
  const id = (e.notification.data || {}).id || '', act = e.action || 'open';
  e.notification.close();
  if (!id) { e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./'))); return; }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs[0];
    if (c) { c.postMessage({ zd: 'notif', act: act, id: id }); return act === 'open' ? c.focus() : undefined; }
    return self.clients.openWindow('./?nact=' + encodeURIComponent(act) + '&nid=' + encodeURIComponent(id));
  }));
});
// push-уведомления с сервера (когда приложение закрыто): {t, b, task, tag}
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { t: e.data ? e.data.text() : '' }; }
  const opt = { body: d.b || '', tag: d.tag || 'zd-push', icon: 'icon-192.png', badge: 'icon-192.png', data: { id: d.task || '' } };
  if (d.task) opt.actions = [{ action: 'done', title: '✓ Готово' }, { action: 'snooze', title: '+15 мин' }];
  e.waitUntil(self.registration.showNotification(d.t || 'Задачи', opt));
});
