/* Patrimônio — service worker: abre o app sem internet.
   Os dados ficam no cache do Firestore (IndexedDB); aqui só guardamos o "casco" do app e as bibliotecas. */
const V = 'pt-shell-v6';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon.svg', './apple-touch-icon.png'];
const LIBS = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdnjs\.cloudflare\.com\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== 'pt-dados').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const timeout = (p, ms) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), ms); p.then(r => { clearTimeout(t); ok(r) }, er => { clearTimeout(t); no(er) }) });

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  // páginas do app: rede primeiro (versão nova), cache se estiver sem internet
  if (u.origin === location.origin) {
    if (r.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html')) {
      e.respondWith(timeout(fetch(r), 4000).then(res => {
        if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put('./index.html', cp)) }
        return res;
      }).catch(() => caches.match('./index.html').then(m => m || caches.match('./'))));
      return;
    }
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)) } return res })));
    return;
  }
  // bibliotecas com versão fixa (Firebase, PDF, fontes): cache primeiro
  if (LIBS.test(r.url)) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)) } return res })));
  }
  // banco de dados e login passam direto (o Firestore cuida do modo offline)
});

/* ---------- lembretes: o app deixa a lista de vencimentos em cache; aqui o celular confere e avisa ---------- */
const hoje = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10) };
const amanha = () => { const d = new Date(Date.now() + 864e5); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10) };
const brl = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
async function lembrar() {
  if (!self.registration || Notification.permission !== 'granted') return;
  const c = await caches.open('pt-dados'), r = await c.match('./__lembretes.json'); if (!r) return;
  const L = await r.json(), vr = await c.match('./__avisados.json'), ja = vr ? await vr.json() : {};
  const t = hoje(), am = amanha(), novos = [];
  (L.itens || []).forEach(x => { if (!x || ja[x.id]) return; if (x.v ? (x.d === t || x.d === am) : x.d === t) novos.push(x) });
  const contas = novos.filter(x => x.v), outros = novos.filter(x => !x.v);
  if (contas.length) {
    const hj = contas.filter(x => x.d === t), tot = contas.reduce((a, x) => a + (x.r ? 0 : x.v), 0);
    await self.registration.showNotification(contas.length === 1 ? (contas[0].r ? 'A receber ' : 'Vence ') + (contas[0].d === t ? 'hoje' : 'amanhã') : `${contas.length} vencimentos ${hj.length ? 'hoje e amanhã' : 'amanhã'}`,
      { body: contas.slice(0, 4).map(x => `${x.t} · ${brl(x.v)}${x.d === t ? ' (hoje)' : ''}`).join('\n') + (contas.length > 4 ? `\n+${contas.length - 4}` : '') + (tot && contas.length > 1 ? `\nTotal ${brl(tot)}` : ''), icon: 'icon-192.png', badge: 'icon-192.png', tag: 'pt-venc', data: { url: './#inicio' } });
  }
  for (const x of outros) await self.registration.showNotification(x.t, { body: x.info || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'pt-' + x.id, data: { url: x.url || './#inicio' } });
  novos.forEach(x => ja[x.id] = t);
  Object.keys(ja).forEach(k => { if (ja[k] < t.slice(0, 8) + '01' && ja[k] < t) { const d = new Date(ja[k]); if (Date.now() - d > 40 * 864e5) delete ja[k] } });
  await c.put('./__avisados.json', new Response(JSON.stringify(ja), { headers: { 'content-type': 'application/json' } }));
}
self.addEventListener('periodicsync', e => { if (e.tag === 'pt-lembretes') e.waitUntil(lembrar()) });
self.addEventListener('message', e => { if (e.data && e.data.tipo === 'lembretes') e.waitUntil ? e.waitUntil(lembrar()) : lembrar() });
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { const w = ws.find(c => c.url.includes(self.registration.scope)); if (w) { w.focus(); return w.navigate ? w.navigate(url).catch(() => {}) : null } return clients.openWindow(url) }));
});
