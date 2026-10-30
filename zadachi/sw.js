// Офлайн-кэш приложения «Задачи»
const CACHE = 'zd-app-2026-10-16-335';
const FONTS = 'zd-fonts'; // шрифты стилей: отдельный кэш, который не стирается при обновлении версии
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
    // шрифты Google: сначала кэш (без сети стиль не теряет шрифт), иначе сеть и в кэш
    e.respondWith(caches.open(FONTS).then(c => c.match(req, { ignoreVary: true }).then(r => r || fetch(req).then(n => { if (n.ok || n.type === 'opaque') c.put(req, n.clone()); return n; }))));
  }
});
// прогрев шрифтов: приложение присылает адреса CSS Google Fonts выбранного стиля — скачиваем CSS и все файлы шрифтов из него,
// чтобы они были в кэше ещё до того, как понадобятся без сети
async function warmFonts(urls) {
  const c = await caches.open(FONTS);
  for (const u of urls) {
    try {
      let css = await c.match(u, { ignoreVary: true });
      if (!css) { const r = await fetch(u, { mode: 'cors' }); if (!r.ok) continue; await c.put(u, r.clone()); css = r; }
      const txt = await css.clone().text(), m = txt.match(/https:\/\/fonts\.gstatic\.com\/[^)\s'"]+/g) || [];
      for (const f of m) { if (await c.match(f, { ignoreVary: true })) continue; try { const fr = await fetch(f, { mode: 'cors' }); if (fr.ok) await c.put(f, fr); } catch (x) { /* без сети — в следующий раз */ } }
    } catch (x) { /* без сети — в следующий раз */ }
  }
}
self.addEventListener('message', e => { const d = e.data || {}; if (d.zd === 'fonts' && Array.isArray(d.urls)) e.waitUntil(warmFonts(d.urls.filter(u => /^https:\/\/fonts\.googleapis\.com\//.test(u)))); });
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
