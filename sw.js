/* Patrimônio — service worker: abre o app sem internet.
   Os dados ficam no cache do Firestore (IndexedDB); aqui só guardamos o "casco" do app e as bibliotecas. */
const V = 'pt-shell-v12';
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
  const t = hoje(), am = amanha(), novos = [], ant = L.ant === undefined ? 1 : +L.ant;
  const dias = d => Math.round((new Date(d + 'T12:00:00') - new Date(t + 'T12:00:00')) / 864e5);
  /* contas: um aviso antes (conforme a antecedência escolhida) e outro no dia; demais avisos só no dia */
  (L.itens || []).forEach(x => { if (!x) return; if (x.v) { const n = dias(x.d); if (n === 0 && !ja[x.id + '|0'] && !ja[x.id]) novos.push(Object.assign({}, x, { k: x.id + '|0', n })); else if (n > 0 && n <= (x.a !== undefined ? +x.a : ant) && !ja[x.id + '|a'] && !ja[x.id]) novos.push(Object.assign({}, x, { k: x.id + '|a', n })) } else if (!ja[x.id] && x.d === t) novos.push(Object.assign({}, x, { k: x.id })) });
  const contas = novos.filter(x => x.v), outros = novos.filter(x => !x.v);
  const quando = n => n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`;
  if (contas.length) {
    const hj = contas.filter(x => x.n === 0), tot = contas.reduce((a, x) => a + (x.r ? 0 : x.v), 0), mx = Math.max(...contas.map(x => x.n));
    await self.registration.showNotification(contas.length === 1 ? (contas[0].r ? 'A receber ' : 'Vence ') + quando(contas[0].n) : `${contas.length} vencimentos ${hj.length === contas.length ? 'hoje' : hj.length ? 'hoje e nos próximos dias' : mx === 1 ? 'amanhã' : 'nos próximos dias'}`,
      { body: contas.slice(0, 4).map(x => `${x.t} · ${brl(x.v)}${contas.length > 1 ? ' (' + quando(x.n) + ')' : ''}`).join('\n') + (contas.length > 4 ? `\n+${contas.length - 4}` : '') + (tot && contas.length > 1 ? `\nTotal ${brl(tot)}` : ''), icon: 'icon-192.png', badge: 'icon-192.png', tag: 'pt-venc', data: { url: './#inicio' } });
  }
  for (const x of outros) await self.registration.showNotification(x.t, { body: x.info || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'pt-' + x.id, data: { url: x.url || './#inicio' } });
  novos.forEach(x => ja[x.k] = t);
  Object.keys(ja).forEach(k => { if (ja[k] < t.slice(0, 8) + '01' && ja[k] < t) { const d = new Date(ja[k]); if (Date.now() - d > 40 * 864e5) delete ja[k] } });
  await c.put('./__avisados.json', new Response(JSON.stringify(ja), { headers: { 'content-type': 'application/json' } }));
}
self.addEventListener('periodicsync', e => { if (e.tag === 'pt-lembretes') e.waitUntil(lembrar()) });
self.addEventListener('message', e => { if (e.data && e.data.tipo === 'lembretes') e.waitUntil ? e.waitUntil(lembrar()) : lembrar() });
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { const w = ws.find(c => c.url.includes(self.registration.scope)); if (w) { w.focus(); return w.navigate ? w.navigate(url).catch(() => {}) : null } return clients.openWindow(url) }));
});
