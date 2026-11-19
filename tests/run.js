/* Testes do Patrimônio: abre o app num navegador sem tela, com um banco falso de dados fictícios,
   e confere (1) que nenhuma tela ou janela quebra, (2) que nada estoura a largura do celular,
   (3) as amarrações contábeis (caixa, mês, patrimônio, balanço, dívidas, margem, categorias) e
   (4) cálculos isolados (frase, IR de ações, quitação de dívidas, metas, cenários).
   Uso: node tests/run.js   (precisa do pacote playwright com o Chromium instalado) */
const fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require('playwright');
const { fixture } = require('./fixture');

const ROOT = path.join(__dirname, '..');
const EXPOR = ('S ME today recV recVI ymAdd addD dayIn lastDay realBal saldoConta scopeContas fracOf mesFluxo agendaPessoal patrimonio balanco dividasAll ' +
  'acerto acertoLedger credGab gabId candlesCaixa saidasDia margemCalc planoCalc mesCalc catWatch catMesMap contaMov isCaixa movs ' +
  'parseFrase rvCalc rvIR divSim divLista ORD metaCalc cenBase cenProj baseMes casaCalc pjMes filhoCalc progRet retroCalc semRev ' +
  'openRV openRVIR openCenarios openDividasPlano openCasa openPJ openPontos openFilhos openRetro openPrefs openFrase openSimCompra ' +
  'openSemana openAjuda openRelMes openMeta openAssessor openInvestDash openSpread openBackups openLanc openTour openBemVindo openAPagar atrasos catList projecao relPeriodo mesCalc periodoConta aRealizar recPrevistos fatRecs recPendAnt openRecPend assinRevisar assinRevisao recsCartaoAtivos sazLista sazProv mdiff ntfDecisao parseFrase carteiraGeral caixaSim addD openKpi kpiVal openMetasKpi KPM caixaLivre openInvestDash openGuardar guardSug guardFeito guardMeta guardNudge openAbater faturasAbertas caixaNoDia realBal fatComp movKind fatTot openCardDet baseDue card closeSheet').split(' ');

function montar(dados) {
  let h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const D = {};
  const cols = { contas: 'contas', cartoes: 'cartoes', lanc: 'lancamentos', dividas: 'dividas', recorrentes: 'recorrentes', acertos: 'acertos', relatorios: 'relatorios' };
  for (const [c, k] of Object.entries(cols)) { D[c] = {}; (dados[k] || []).forEach((x, i) => { const o = Object.assign({}, x); delete o.id; D[c][x.id || String(i)] = o }) }
  D['config/app'] = dados.config; if (dados.rv) D.config = { rv: dados.rv };
  const mock = `<script>(function(){const D=${JSON.stringify(D)};const L={};let n=0;const fire=k=>(L[k]||[]).forEach(f=>f());
const get=p=>{const [c,id]=p.split('/');return p==='config/app'?D[p]:(D[c]||{})[id]};
const db={collection:c=>({onSnapshot:cb=>{const f=()=>cb({docs:Object.entries(D[c]||{}).map(([id,v])=>({id,data:()=>v}))});(L[c]=L[c]||[]).push(f);setTimeout(f,0)},add:async x=>{const id='m'+(++n);(D[c]=D[c]||{})[id]=JSON.parse(JSON.stringify(x));fire(c);return {id}}}),
doc:p=>{const [c,id]=p.split('/');return {onSnapshot:cb=>{const f=()=>{const v=get(p);cb({exists:!!v,data:()=>v})};(L[p]=L[p]||[]).push(f);setTimeout(f,0)},get:async()=>{const v=get(p);return {exists:!!v,data:()=>v}},
set:async x=>{x=JSON.parse(JSON.stringify(x));if(p==='config/app')D[p]=x;else (D[c]=D[c]||{})[id]=x;fire(p);fire(c)},delete:async()=>{delete (D[c]||{})[id];fire(c)}}}};
const api={use:async n=>n==='db'?db:n==='downloads'?{save:async o=>{window.__dl=o.filename;return {ok:true}}}:null};
window.__fbSair=()=>{};setTimeout(()=>window.__fbReady(api),0);})();</script>`;
  const antes = h.length;
  h = h.replace(/<script type="module">[\s\S]*?<\/script>/, () => mock);
  if (h.length === antes) throw new Error('não achei o bloco do Firebase para trocar pelo banco falso');
  const exp = 'window.__T={' + EXPOR.map(n => `${n}:typeof ${n}!=='undefined'?${n}:null`).join(',') + '};';
  if (!h.includes('\nroute();\n')) throw new Error('não achei o ponto de partida route()');
  h = h.replace('\nroute();\n', '\nroute();' + exp + '\n');
  const f = path.join(os.tmpdir(), 'patrimonio-teste.html'); fs.writeFileSync(f, h); return f;
}

(async () => {
  const dados = fixture(), arq = montar(dados), falhas = [], oks = [];
  const ok = (c, n, det) => (c ? oks : falhas).push(n + (c || !det ? '' : ' — ' + det));
  { const ruins = require('./estilos'); ok(!ruins.length, 'estilos sem conflito de nomes', ruins.join(' | ')) }
  const b = await chromium.launch();
  for (const [w, esquema] of [[390, 'light'], [390, 'dark'], [1280, 'light']]) {
    const p = await b.newPage({ viewport: { width: w, height: 844 }, colorScheme: esquema }), erros = [];
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('pt-tour', '1') } catch (e) { } });
    await p.route(/fonts\.(googleapis|gstatic)|gstatic|cdnjs|bcb\.gov|brapi/, r => r.abort());
    await p.goto('file://' + arq); await p.waitForTimeout(1500);
    for (const v of ['inicio', 'lanc', 'cartoes', 'relatorios', 'carteira', 'decidir']) {
      await p.evaluate(v => location.hash = v, v); await p.waitForTimeout(450);
      if (w === 390) { const sw = await p.evaluate(() => document.documentElement.scrollWidth); ok(sw <= 392, `largura ${v} (${esquema})`, `${sw}px`) }
    }
    if (w === 390 && esquema === 'light') {
      for (const fn of ['openRV', 'openRVIR', 'openCenarios', 'openDividasPlano', 'openCasa', 'openPJ', 'openPontos', 'openFilhos', 'openRetro', 'openPrefs', 'openFrase', 'openSimCompra', 'openSemana', 'openAjuda', 'openRelMes', 'openMeta', 'openAssessor', 'openInvestDash', 'openSpread', 'openLanc', 'openTour', 'openBemVindo', 'openAPagar']) {
        const r = await p.evaluate(fn => { try { window.__T[fn](); return '' } catch (e) { return e.message } }, fn); await p.waitForTimeout(250);
        const sw = await p.evaluate(() => { const o = document.querySelector('#overlay'); if (!o || o.hidden) return 0;
          /* a janela em si e as áreas que rolam na vertical não podem ficar mais largas que a tela (rolagem lateral interna, como tabelas, é permitida) */
          const els = [...o.querySelectorAll('*')].filter(e => { const c = getComputedStyle(e); return e.parentElement === o || (/auto|scroll/.test(c.overflowY) && !/auto|scroll/.test(c.overflowX)) });
          return Math.max(0, ...els.map(e => Math.max(e.getBoundingClientRect().right, e.getBoundingClientRect().left + e.scrollWidth))) });
        ok(!r, 'abre ' + fn, r); ok(sw <= 392, 'largura da janela ' + fn, Math.round(sw) + 'px');
        await p.evaluate(() => window.__T.closeSheet(true)); await p.waitForTimeout(120);
      }
      /* criar categoria e subcategoria pelo lançamento */
      await p.evaluate(() => window.__T.openLanc(null)); await p.waitForTimeout(400);
      await p.evaluate(() => document.querySelector('[data-catp]').click()); await p.waitForTimeout(300);
      await p.evaluate(() => document.querySelector('.cptn').click()); await p.waitForTimeout(200);
      await p.fill('#cpnn', 'Categoria nova'); await p.evaluate(() => document.querySelector('#cpns').click()); await p.waitForTimeout(500);
      await p.evaluate(() => document.querySelector('[data-catp]').click()); await p.waitForTimeout(300);
      await p.evaluate(() => [...document.querySelectorAll('[data-root]')].find(x => x.dataset.root === 'Mercado').click()); await p.waitForTimeout(200);
      await p.evaluate(() => document.querySelector('.cpr.cpnew').click()); await p.waitForTimeout(200);
      await p.fill('#cpnn', 'Feira livre'); await p.evaluate(() => document.querySelector('#cpns').click()); await p.waitForTimeout(500);
      const cn = await p.evaluate(() => { const L = window.__T.catList('despesa'); return [L.some(x => x.nome === 'Categoria nova'), (L.find(x => x.nome === 'Mercado') || {}).subs || [], document.querySelector('[data-catp]').innerText] });
      ok(cn[0], 'lançamento: cria categoria'); ok(cn[1].includes('Feira livre') && /Feira livre/.test(cn[2]), 'lançamento: cria subcategoria e já usa', JSON.stringify(cn));
      const sv = await p.evaluate(() => { const r = document.querySelector('.lfoot').getBoundingClientRect(); return Math.round(Math.min(r.bottom, innerHeight) - r.top) }); ok(sv <= 90, 'lançamento: barra de salvar compacta', sv + 'px');
      await p.evaluate(() => window.__T.closeSheet(true)); await p.waitForTimeout(200);
      /* formulário de lançamento: cada tipo tem o que precisa */
      const T0 = await p.evaluate(() => window.__T.today());
      const fut = await p.evaluate(() => window.__T.addD(window.__T.today(), 3));
      const casos = [
        ['despesa na conta', { tipo: 'despesa', conta: 'cc' }, ['Descrição', 'Categoria', 'Pago com', 'Repetir lançamento', 'Divisão'], { pg: true, chips: 3 }],
        ['despesa no cartão', { tipo: 'despesa', cartao: 'roxo' }, ['Descrição', 'Categoria', 'Pago com', 'Repetir lançamento', 'Divisão'], { pg: false, chips: 3 }],
        ['receita na conta', { tipo: 'receita', conta: 'cc' }, ['Descrição', 'Categoria', 'Entrou em', 'Repetir lançamento'], { pg: true, chips: 2 }],
        ['transferência', { tipo: 'transf', conta: 'cc', destino: 'res' }, ['De', 'Para', 'Descrição'], { pg: false, chips: 0 }]];
      for (const [nome, pre, secs, exp] of casos) {
        await p.evaluate(pre => window.__T.openLanc(pre), pre); await p.waitForTimeout(350);
        const r = await p.evaluate(() => ({ secs: [...document.querySelectorAll('#overlay .lsl')].map(x => x.textContent.trim()), pg: !!document.querySelector('#l-pg'), chips: document.querySelectorAll('#overlay [data-rep]').length, more: !!document.querySelector('#overlay [data-more]'), save: !!document.querySelector('#lsv') }));
        const falta = secs.filter(x => !r.secs.some(y => y.startsWith(x)));
        ok(!falta.length && r.save, 'formulário ' + nome + ': seções', 'faltam ' + falta.join(', ') + ' · tem ' + r.secs.join(', '));
        ok(r.pg === exp.pg, 'formulário ' + nome + ': ' + (exp.pg ? 'tem' : 'sem') + ' efetivada/pendente');
        ok(r.chips === exp.chips, 'formulário ' + nome + ': opções de repetir', String(r.chips));
        await p.evaluate(() => window.__T.closeSheet(true)); await p.waitForTimeout(150);
      }
      /* assinatura no cartão: fixo mensal cria a recorrência no cartão e o mês seguinte já prevê a cobrança */
      await p.evaluate(() => window.__T.openLanc({ tipo: 'despesa', cartao: 'roxo', desc: 'Assinatura teste', valor: 21.9, categoria: 'Assinaturas' })); await p.waitForTimeout(350);
      await p.evaluate(() => document.querySelector('#overlay [data-rep="fixo"]').click()); await p.waitForTimeout(200);
      await p.evaluate(() => document.querySelector('#lsv').click()); await p.waitForTimeout(600);
      const ass = await p.evaluate(() => { const T = window.__T, r = T.S.recs.find(x => x.nome === 'Assinatura teste'), l = T.S.lanc.find(x => x.desc === 'Assinatura teste'), ym = T.today().slice(0, 7);
        return { r: r && { cartao: r.cartao, valor: r.valor, conta: r.conta }, l: l && { cartao: l.cartao, rec: !!l.rec }, prox: r ? T.recPrevistos(T.ymAdd(ym, 1), T.ymAdd(ym, 1)).some(x => x.r.id === r.id) : false } });
      const fr = await p.evaluate(() => { const T = window.__T, c = T.card('roxo'), ym = T.today().slice(0, 7), y1 = T.ymAdd(ym, 1), y2 = T.ymAdd(ym, 2);
        const f = [y1, y2].map(y => T.fatRecs(c, y).map(x => x.r.nome)); const ag = T.aRealizar(T.ME(), T.dayIn(y2, 31)).filter(x => /^rec:/.test(x.nav || '') && /stream|Assinatura/.test(x.nav + x.t));
        return { f, ag: ag.length } });
      ok(fr.f.some(L => L.includes('Streaming')) && fr.f.some(L => L.includes('Assinatura teste')), 'cartão: fatura futura mostra fixos previstos', JSON.stringify(fr));
      ok(fr.ag > 0, 'cartão: fixos previstos entram nas projeções de caixa', JSON.stringify(fr));
      const cp = await p.evaluate(async () => { const T = window.__T, c = T.card('roxo'), ym = T.ymAdd(T.today().slice(0, 7), 1), k = T.fatComp(c, ym);
        T.openCardDet(c); await new Promise(r => setTimeout(r, 400)); const sh = document.querySelector('.sheet');
        const rows = sh.querySelectorAll('#cd-an .fck').length, rec = [...sh.querySelectorAll('#cd-rec .fpr')].map(b => b.innerText);
        const n0 = sh.querySelectorAll('#cd-ext .cdi').length, chip = sh.querySelector('[data-lk="parc"]'); if (chip) chip.click(); await new Promise(r => setTimeout(r, 200));
        const n1 = document.querySelectorAll('.sheet #cd-ext .cdi').length; T.closeSheet();
        location.hash = 'inicio'; await new Promise(r => setTimeout(r, 300)); location.hash = 'cartoes'; await new Promise(r => setTimeout(r, 500)); const as = document.querySelector('#c-assin');
        return { soma: Math.abs(k.parc + k.fix + k.avu - T.fatTot(c, ym)) < .01, rows, rec, n0, n1, chip: !!chip, as: as ? as.innerText : '' } });
      ok(cp.soma, 'cartão: parcelas + fixos + avulsos = total lançado da fatura', JSON.stringify(cp));
      const hx = await p.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); location.hash = 'lanc'; await w(300); location.hash = 'inicio'; await w(600);
        const h = document.querySelector('#v-inicio .hnx'), ag = (document.querySelector('#v-inicio') || {}).innerText || ''; return { h: h ? h.innerText.replace(/\s+/g, ' ') : '', ag: /A receber teste/.test(ag.replace(h ? h.innerText : '', '')) } });
      const vb = await p.evaluate(() => { const r = [...document.querySelectorAll('#v-inicio .hero .vbars rect.in')]; return { n: r.length, fut: r.filter(x => x.classList.contains('fut')).map(x => x.dataset.vb.split('|')[0]) } });
      ok(vb.n > 0 && vb.fut.length > 0, 'início: entradas no gráfico do mês, com previstas tracejadas', JSON.stringify(vb));
      const ab = await p.evaluate(async () => { const T = window.__T, w = ms => new Promise(r => setTimeout(r, ms)); T.openAbater(); await w(400); const ok = () => document.querySelector('#ab-ok');
        const n = document.querySelector('[data-abs="none"]'); if (!n) { T.closeSheet(); await w(300); return { semLista: true } } n.click(); await w(100); const a = [ok().disabled, ok().textContent];
        document.querySelector('[data-abs="all"]').click(); await w(100); const b = [ok().disabled, ok().textContent, document.querySelector('#ab-im').innerText]; T.closeSheet(); await w(300); return { a, b } });
      ok(ab.semLista || (ab.a[0] === true && ab.b[0] === false && /Abater R\$/.test(ab.b[1]) && /Abatendo/.test(ab.b[2])), 'abatimento: resumo vivo e botão com o valor ao marcar em lote', JSON.stringify(ab));
      const iv = await p.evaluate(async () => { const T = window.__T, w = ms => new Promise(r => setTimeout(r, ms)); T.openInvestDash(); await w(500);
        const f = [...document.querySelectorAll('.ivf b')].map(b => parseFloat(b.innerText.replace(/[^\d,−-]/g, '').replace(/\./g, '').replace(',', '.').replace('−', '-'))), lb = document.querySelector('.ivf span').innerText, pts = document.querySelectorAll('.ivs .chart polyline')[0].getAttribute('points').split(' ').length, nums = [...document.querySelectorAll('.ivs .chart text.acv')].map(x => x.textContent); T.closeSheet(); await w(300); return { f, lb, pts, nums } });
      ok(iv.f.length === 5 && Math.abs(iv.f[0] + iv.f[1] - Math.abs(iv.f[2]) + iv.f[3] - iv.f[4]) <= 2, 'investimentos: saldo inicial + aportes − resgates + rendimentos = hoje', JSON.stringify(iv));
      ok(/Ao cadastrar/.test(iv.lb) && iv.pts <= 7 && iv.nums.length === iv.pts && iv.nums.at(-1) === (iv.f[4] / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k', 'investimentos: gráfico começa quando as aplicações entraram no app', JSON.stringify(iv));
      const nd = await p.evaluate(async () => { const T = window.__T, w = ms => new Promise(r => setTimeout(r, ms)), me = T.ME(); const a0 = T.guardNudge(me);
        await T.S.db.collection('lanc').add({ tipo: 'receita', conta: 'cc', data: T.today(), valor: 6000, desc: 'Bônus teste', categoria: 'Renda extra', tags: [], divisao: 'pessoal', criadoEm: new Date().toISOString() }); await w(400);
        const a1 = T.guardNudge(me); return { a0: !!a0, a1: /Entrou/.test(a1) && /data-guardar/.test(a1) } });
      ok(nd.a1, 'início: lembrete de guardar depois de uma entrada grande', JSON.stringify(nd));
      const gd = await p.evaluate(async () => { const T = window.__T, w = ms => new Promise(r => setTimeout(r, ms)), me = T.ME(), ym = T.today().slice(0, 7);
        const s0 = T.guardSug(me), g0 = T.guardFeito(ym, me); T.openGuardar({ v: 100 }); await w(400); const ok = document.querySelector('#gd-ok'), txt = ok ? ok.textContent : '';
        const dests = [...document.querySelectorAll('[data-gdt]')].map(b => b.innerText.split('\n')[0]); ok.click(); await w(800);
        const g1 = T.guardFeito(ym, me); location.hash = 'inicio'; await w(200); location.hash = 'carteira'; await w(700); const card = (document.querySelector('#v-carteira .gdc') || {}).innerText || ''; location.hash = 'decidir'; await w(500); const naoDec = !document.querySelector('#v-decidir .gdc');
        return { naoDec, s0: { v: s0.v, meta: s0.M.v, fonte: s0.M.fonte, safe: s0.sg.v }, g0, g1, txt, dests, card: card.replace(/\s+/g, ' ') } });
      ok(/Guardar R\$\s100,00 em/.test(gd.txt) && /Reserva/.test(gd.dests[0]), 'guardar: abre com valor, reserva sugerida primeiro', JSON.stringify(gd));
      ok(Math.abs(gd.g1 - gd.g0 - 100) < .01, 'guardar: a transferência conta no guardado do mês', JSON.stringify(gd));
      ok(gd.naoDec && /Guardado em/.test(gd.card) && /Últimos 6 meses/.test(gd.card) && gd.s0.meta > 0, 'carteira: Guardar mora na Carteira, com meta, progresso e histórico', gd.card);
      const cl = await p.evaluate(async () => { const T = window.__T, w = ms => new Promise(r => setTimeout(r, ms)); location.hash = 'lanc'; await w(200); location.hash = 'inicio'; await w(600);
        const b = [...document.querySelectorAll('#v-inicio .hsplit > *')].find(d => /Pode gastar sem faltar|Vai faltar/.test(d.innerText)), v = b ? (b.querySelector('b').classList.contains('neg') ? '−' : '') + b.querySelector('b').innerText : ''; return { v, cl: T.caixaLivre(T.ME()).livre } });
      ok(cl.v && Math.abs(parseFloat(cl.v.replace(/[^\d,−-]/g, '').replace(/\./g, '').replace(',', '.').replace('−', '-')) - Math.round(cl.cl)) <= 1, 'início: pode gastar do resumo = caixa livre (regra única)', JSON.stringify(cl));
      const mk = await p.evaluate(async () => { const T = window.__T, w = ms => new Promise(r => setTimeout(r, ms)); const m0 = T.KPM().pou; T.openMetasKpi(); await w(400);
        const row = document.querySelector('.kmtr[data-mk="pou"]'); row.querySelector('[data-mkd="1"]').click(); await w(100); const v1 = row.querySelector('input').value;
        const inp = document.querySelector('.kmtr[data-mk="pcta"], .kmtr[data-mk="cdv"] input'); const c = document.querySelector('.kmtr[data-mk="cdv"] input'); c.value = '1,5'; c.dispatchEvent(new Event('input')); await w(1000);
        const r = { m0, v1, pou: T.KPM().pou, cdv: T.KPM().cdv }; document.querySelector('#mk-rs').click(); await w(1000); r.rs = T.KPM().pou; T.closeSheet(); await w(300); return r });
      ok(mk.v1 === '25' && Math.abs(mk.pou - .25) < 1e-9 && Math.abs(mk.cdv - .015) < 1e-9 && Math.abs(mk.rs - .2) < 1e-9, 'metas: + e − e digitação com vírgula salvam sozinhos; padrões voltam', JSON.stringify(mk));
      const kc = await p.evaluate(async () => { const T = window.__T, w = ms => new Promise(r => setTimeout(r, ms)), K = T.kpiVal(T.ME()), out = {};
        const num = s => parseFloat(s.replace(/[^\d,−-]/g, '').replace(/\./g, '').replace(',', '.').replace('−', '-'));
        for (const k of ['pou', 'res', 'com', 'lim', 'end', 'liq', 'dia', 'cdv']) { if (K.v[k] == null) continue; T.openKpi(k); await w(250); const e = document.querySelector('.sheet .kpceq');
          if (!e) { out[k] = 'sem'; T.closeSheet(); await w(250); continue } const b = [...e.querySelectorAll('b')].map(x => x.innerText); const a = num(b[0]), d = num(b[1]); const v = K.v[k];
          const calc = ['res', 'liq'].includes(k) ? a / d : k === 'cdv' ? a / d : a / d; out[k] = { a, d, v, ok: Math.abs(calc - v) <= Math.max(.015 * Math.abs(v), .011), grupos: document.querySelectorAll('.sheet .kpcg').length }; T.closeSheet(); await w(250) } return out });
      ok(Object.keys(kc).length >= 5 && Object.values(kc).every(x => x !== 'sem' && x.ok && x.grupos >= 1), 'painel: cada indicador mostra a conta que forma o número e ela bate', JSON.stringify(kc));
      const cg = await p.evaluate(async () => { const T = window.__T, w = ms => new Promise(r => setTimeout(r, ms)), me = T.ME(), t = T.today(), S0 = T.caixaSim(me, T.addD(t, 30));
        const num = s => parseFloat(s.replace(/[^\d,−-]/g, '').replace(/\./g, '').replace(',', '.').replace('−', '-')); const go = async () => { location.hash = 'inicio'; await w(200); location.hash = 'carteira'; await w(700) };
        localStorage.setItem('pt-cgm', '30'); await go(); let c = document.querySelector('#v-carteira .cgc'); if (!c) return { sem: true }; const v30 = num(c.querySelector('.cgh > b').innerText) * (c.querySelector('.cgh > b').classList.contains('neg') ? -1 : 1);
        const mn = Math.min(...S0.dias.map(x => x.v)), pl = [...c.querySelectorAll('.cgpl b')].map(b => num(b.innerText)), tiers = [...c.querySelectorAll('.cgti')].map(d => d.dataset.cgtile), cr = !!c.querySelector('.cgcr'); localStorage.setItem('pt-cgtile', ''); c.querySelector('[data-cgtile="conta"]').click(); await w(400); c = document.querySelector('#v-carteira .cgc'); const sx = !!c.querySelector('.cgpn .sxc'); c.querySelector('.cgpn [data-cgtile]').click(); await w(300); c = document.querySelector('#v-carteira .cgc'); const fechou = !c.querySelector('.cgpn');
        const fim = S0.dias.at(-1).v, chk = Math.abs(S0.bal + S0.A.filter(x => x.e <= T.addD(t, 30)).reduce((s, x) => s + x.v, 0) - fim) < .02;
        document.querySelector('[data-cgm="agora"]').click(); await w(400); c = document.querySelector('#v-carteira .cgc'); const vAg = num(c.querySelector('.cgh > b').innerText); localStorage.setItem('pt-cgm', '30'); await go(); c = document.querySelector('#v-carteira .cgc');
        const eqb = [...c.querySelectorAll('.cgeq b')].map(b => num(b.textContent)); return { fechou, eqok: eqb.length === 4 && Math.abs(eqb[0] + eqb[1] - eqb[2] - eqb[3]) <= 2, v30, mn, vAg, bal: S0.bal, chk, pl, tiers, sx, cr, dup: document.querySelectorAll('#v-carteira .card.sxc').length } });
      ok(!cg.sem && cg.fechou && cg.eqok && Math.abs(cg.v30 - cg.mn) < .01 && Math.abs(Math.abs(cg.vAg) - Math.abs(cg.bal)) < .01 && cg.chk && Math.abs(cg.pl[0] - cg.pl[1] - cg.pl[2]) <= 1 && cg.sx && cg.cr && cg.dup === 0 && ['conta', 'comp', 'res', 'inv'].every(k => cg.tiers.includes(k)), 'carteira: agora = saldo; 30 dias = menor saldo previsto; crédito separado; tem − deve = patrimônio', JSON.stringify(cg));
      { const vp = p.viewportSize(); await p.setViewportSize({ width: 320, height: 800 }); await p.addStyleTag({ content: 'html.tq-big{font-size:120%}' }); await p.evaluate(() => document.documentElement.classList.add('tq-big'));
        const ov = await p.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)), res = {};
          for (const v of ['inicio', 'lanc', 'cartoes', 'relatorios', 'carteira', 'decidir']) { location.hash = v; await w(500); const W = document.documentElement.clientWidth, bad = new Set();
            document.querySelectorAll('#v-' + v + ' *').forEach(e => { if (e.closest('.tkw')) return; const b = e.getBoundingClientRect(); if (!b.width || b.right <= W + 1 || getComputedStyle(e).position === 'fixed') return; let a = e.parentElement, clip = false;
              while (a && a !== document.body) { const o = getComputedStyle(a).overflowX; if ((o === 'hidden' || o === 'auto' || o === 'scroll') && a.getBoundingClientRect().right <= W + 1) { clip = true; break } a = a.parentElement } if (!clip) bad.add(String(e.className.baseVal ?? e.className) || e.tagName) });
            if (bad.size) res[v] = [...bad].slice(0, 6) } document.documentElement.classList.remove('tq-big'); return res });
        await p.setViewportSize(vp); ok(Object.keys(ov).length === 0, 'telas a 320 px com fonte 120%: nada vaza para fora da tela', JSON.stringify(ov)) }
      const ac = await p.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); location.hash = 'lanc'; await w(200); location.hash = 'inicio'; await w(600); const c = document.querySelector('#v-inicio .acx'); return c ? [...c.querySelectorAll('.acxr')].map(r => r.innerText.split('\n')[0]) : [] });
      ok(ac.length >= 1 && ac.length <= 3 && /atraso/.test(ac[0]), 'início: para fazer agora, com atrasos primeiro e no máximo 3', JSON.stringify(ac));
      const pf2 = await p.evaluate(() => { const T = window.__T; return [
          T.parseFrase('Compra aprovada no cartão final 1111 de R$ 45,90 em MERCADO BOM PRECO LTDA em 17/11 às 12:30'),
          T.parseFrase('Nubank: Compra de R$ 1.234,56 APROVADA em MAGAZINE LUIZA para o cartão com final 1111. Parcelado em 3x'),
          T.parseFrase('Você recebeu um Pix de R$ 300,00 de JOAO SILVA'),
          T.parseFrase('45,90 mercado roxo')].map(x => ({ v: x.valor, tp: x.tipo, c: x.cartao || '', d: x.desc || '', n: x.parcelas, dt: x.data })) });
      ok(pf2[0].v === 45.9 && pf2[0].c === 'roxo' && /mercado/i.test(pf2[0].d) && pf2[0].dt.slice(5) === '11-17' && pf2[1].v === 1234.56 && pf2[1].n === 3 && pf2[1].c === 'roxo' && /magazine/i.test(pf2[1].d) && pf2[2].tp === 'receita' && pf2[2].v === 300 && pf2[3].v === 45.9 && pf2[3].c === 'roxo', 'lançar: entende aviso de banco (valor, cartão pelo final, loja, data, parcelas, Pix recebido)', JSON.stringify(pf2));
      const nd2 = await p.evaluate(async () => { const T = window.__T, me = T.ME(); const a = T.ntfDecisao(me).map(x => x.id.split('|')[0]);
        const ref = await T.S.db.collection('lanc').add({ tipo: 'despesa', cartao: 'roxo', data: T.today(), valor: 49.9, desc: 'Streaming', categoria: 'Assinaturas', rec: 'stream', recYm: T.today().slice(0, 7), parcelas: 1, parcela: 1, tags: [], divisao: 'pessoal', criadoEm: new Date().toISOString() }); await new Promise(r => setTimeout(r, 300));
        const b = T.ntfDecisao(me); const id = ref && ref.id || (T.S.lanc.find(l => l.rec === 'stream' && l.valor === 49.9) || {}).id; if (id) await T.S.db.doc('lanc/' + id).delete(); await new Promise(r => setTimeout(r, 300)); return { a, b: b.map(x => x.id.split('|')[0] + ':' + x.t), del: !T.S.lanc.some(l => l.id === id) } });
      ok(nd2.b.some(x => /^asr:Streaming cobrou/.test(x)) && nd2.b.every(x => !/undefined|NaN/.test(x)), 'avisos: assinatura que mudou de valor gera alerta', JSON.stringify(nd2));
      const sz = await p.evaluate(async () => { const T = window.__T, me = T.ME(), cm = T.today().slice(0, 7), w = ms => new Promise(r => setTimeout(r, ms)); const g0 = T.guardMeta(cm, me).v;
        const prox = T.ymAdd(cm, 2), m1 = +prox.slice(5), m2 = +T.ymAdd(cm, 3).slice(5);
        await T.S.db.collection('recorrentes').add({ tipo: 'despesa', nome: 'IPVA teste', valor: 600, dia: 15, dono: me, conta: 'cc', categoria: 'Transporte', meses: [m1, m2], ativo: true }); await w(300);
        const L = T.sazLista(me).find(x => x.r.nome === 'IPVA teste'), prev = T.recPrevistos(cm, T.ymAdd(cm, 4)).filter(x => x.r.nome === 'IPVA teste').map(x => x.ym), g1 = T.guardMeta(cm, me).v;
        location.hash = 'inicio'; await w(200); location.hash = 'decidir'; await w(600); const card = (document.querySelector('.szc') || {}).innerText || '';
        return { L: L && { ym: L.ym, tot: L.tot, m: L.m, porMes: L.porMes }, prev, exp: [prox, T.ymAdd(cm, 3)], dg: Math.round((g1 - g0) * 100) / 100, card: card.slice(0, 120) } });
      ok(sz.L && sz.L.tot === 1200 && sz.L.ym === sz.exp[0] && sz.L.m === 2 && sz.L.porMes === 600 && JSON.stringify(sz.prev) === JSON.stringify(sz.exp) && Math.abs(sz.dg - 600) < .02 && /IPVA teste/.test(sz.card), 'despesas do ano: só nos meses escolhidos, separar por mês e meta de guardar', JSON.stringify(sz));
      const pdx = await p.evaluate(async () => { const T = window.__T, w = ms => new Promise(r => setTimeout(r, ms)), P0 = JSON.parse(JSON.stringify((T.S.cfg || {}).padrao || {}));
        const ct = T.S.contas.find(a => a.ativo !== false && a.dono === T.ME()), cd = T.S.cards.find(c => c.ativo !== false && c.dono === T.ME());
        const src = () => { const s = document.querySelector('.sheet [data-pick][aria-pressed="true"],.sheet .lsrc.on,.sheet [data-src].on'); return (document.querySelector('.sheet').innerText.match(new RegExp(cd.nome + '|' + ct.nome)) || [''])[0] };
        const open = async () => { T.openLanc(); await w(500); const t = (document.querySelector('.sheet [data-tog="src"] .lrt') || {}).innerText || ''; T.closeSheet(); await w(200); return t };
        await T.S.db.doc('config/app').set(Object.assign({}, T.S.cfg, { padrao: { conta: ct.id, cartao: cd.id } })); await w(300); const a = await open();
        await T.S.db.doc('config/app').set(Object.assign({}, T.S.cfg, { padrao: { conta: ct.id, cartao: cd.id, desp: 'conta' } })); await w(300); const b = await open();
        await T.S.db.doc('config/app').set(Object.assign({}, T.S.cfg, { padrao: P0 })); await w(300);
        const pos = (t, n) => t.indexOf(n); return { a: [pos(a, cd.nome), pos(a, ct.nome)], b: [pos(b, cd.nome), pos(b, ct.nome)], cn: cd.nome, an: ct.nome } });
      ok(pdx.a[0] === 0 && pdx.a[1] < 0 && pdx.b[1] === 0 && pdx.b[0] < 0, 'lançamento: conta padrão para despesas abre na conta em vez do cartão', JSON.stringify(pdx));
      const vr = await p.evaluate(async () => { const T = window.__T, me = T.ME(), cm = T.today().slice(0, 7), w = ms => new Promise(r => setTimeout(r, ms));
        const ref = await T.S.db.collection('recorrentes').add({ tipo: 'despesa', nome: 'Energia teste', valor: 250, dia: 28, dono: me, conta: 'cc', categoria: 'Casa', varia: true, ativo: true }); await w(300);
        const r = T.S.recs.find(x => x.nome === 'Energia teste'), v0 = T.recV(r), prox = T.ymAdd(cm, 1);
        const ids = []; for (const [k, v] of [[-3, 200], [-2, 300], [-1, 310], [-4, 900]]) { const y = T.ymAdd(cm, k); const d = await T.S.db.collection('lanc').add({ tipo: 'despesa', conta: 'cc', data: T.dayIn(y, 28), valor: v, desc: 'Energia teste', categoria: 'Casa', rec: r.id, recYm: y, tags: [], divisao: 'pessoal', criadoEm: new Date().toISOString() }); ids.push(d && d.id) } await w(400);
        const I = T.recVI(T.S.recs.find(x => x.nome === 'Energia teste')), pv = T.recPrevistos(prox, prox).find(x => x.r.nome === 'Energia teste'), ag = T.agendaPessoal(me, T.dayIn(prox, 31)).find(x => x.t === 'Energia teste' && x.d.startsWith(prox));
        for (const id of ids) if (id) await T.S.db.doc('lanc/' + id).delete(); await T.S.db.doc('recorrentes/' + r.id).delete(); await w(300);
        return { v0, I, pv: pv && { v: pv.valor, varia: pv.varia }, ag: ag && { v: ag.v, s: ag.s } } });
      ok(vr.v0 === 250 && vr.I.n === 3 && vr.I.v === 270 && vr.pv && vr.pv.v === 270 && vr.pv.varia && vr.ag && vr.ag.v === -270 && /≈ valor varia · média de 3 meses/.test(vr.ag.s), 'recorrência com valor que varia: prevê pela média dos 3 últimos pagamentos', JSON.stringify(vr));
      const rp = await p.evaluate(async () => { const T = window.__T, me = T.ME(), cm = T.today().slice(0, 7), w = ms => new Promise(r => setTimeout(r, ms)), m1 = T.ymAdd(cm, -1), m2 = T.ymAdd(cm, -2);
        await T.S.db.collection('recorrentes').add({ tipo: 'despesa', nome: 'Academia', valor: 120, dia: 5, dono: me, conta: 'cc', categoria: 'Saúde', inicio: m2, ativo: true });
        await T.S.db.collection('lanc').add({ tipo: 'despesa', conta: 'cc', data: T.dayIn(m1, 6), valor: 120, desc: 'Smart Fit', categoria: 'Saúde', tags: [], divisao: 'pessoal', criadoEm: new Date().toISOString() }); await w(300);
        const a = T.recPendAnt(me).filter(x => x.r.nome === 'Academia').map(x => ({ ym: x.ym, c: x.cand ? x.cand.desc : '' }));
        T.openRecPend(); await w(400); const bl = document.querySelector('.sheet [data-rpl]'); if (bl) bl.click(); await w(800);
        const bn = document.querySelector('.sheet [data-rpn]'); if (bn) bn.click(); await w(800); T.closeSheet(); await w(300);
        const b = T.recPendAnt(me).filter(x => x.r.nome === 'Academia').length, lig = T.S.lanc.some(l => l.desc === 'Smart Fit' && l.rec && l.recYm === m1);
        const n1 = T.assinRevisar(me), n2 = T.assinRevisao(T.recsCartaoAtivos(me)).filter(x => x.f.length).length; return { a, b, lig, n1, n2, m1, m2 } });
      ok(rp.a.length === 2 && rp.a.some(x => x.ym === rp.m1 && x.c === 'Smart Fit') && rp.lig && rp.b === 0, 'contas fixas de meses anteriores: aparecem, vinculam ao lançamento parecido e "não houve" resolve', JSON.stringify(rp));
      ok(rp.n1 === rp.n2, 'assinaturas para revisar: uma regra só (Cartões = Para fazer agora)', JSON.stringify(rp));
      const nav = await p.evaluate(() => ({ tabs: [...document.querySelectorAll('nav.tabs a')].map(a => a.dataset.v), top: [...document.querySelectorAll('.topw[data-v]')].map(a => a.dataset.v) }));
      ok(JSON.stringify(nav.tabs) === JSON.stringify(['inicio', 'lanc', 'cartoes', 'carteira', 'relatorios']) && nav.top.includes('decidir'), 'navegação: Carteira na barra, Decidir no topo', JSON.stringify(nav));
      ok(/Próxima entrada/.test(hx.h) && /A receber teste/.test(hx.h) && /Receita agendada/.test(hx.h), 'início: próxima entrada aparece no resumo (a receber e agendada)', hx.h);
      const pf = await p.evaluate(async () => { const T = window.__T, w = ms => new Promise(r => setTimeout(r, ms)); T.openLanc(null); await w(400);
        const tab = document.querySelector('.sheet [data-tpf]'); if (!tab) return { tab: false }; tab.click(); await w(400);
        const rows = [...document.querySelectorAll('.sheet [data-pfk]')], n = rows.length, F = T.faturasAbertas(); if (!n) return { tab: true, n };
        rows[0].click(); await w(700); const h = /Pagar fatura/.test(document.querySelector('#overlay').innerText) ? 'Pagar fatura' : '', v = document.querySelector('.sheet #l-v');
        const r = { tab: true, n, nf: F.length, h, v: v && v.value, tot: F[0].tot }; T.closeSheet(); await w(300); return r });
      ok(pf.tab && pf.n > 0 && pf.n === pf.nf && pf.h === 'Pagar fatura' && pf.v && Math.abs(parseFloat(String(pf.v).replace(/\./g, '').replace(',', '.')) - pf.tot) < .01, 'lançamento: aba Fatura escolhe a fatura e abre o pagamento com o total', JSON.stringify(pf));
      const fe = await p.evaluate(() => { const T = window.__T, c = Object.assign({}, T.card('roxo')), d = '2026-11-03';
        const a = T.baseDue({ data: d }, c), b = T.baseDue({ data: '2026-11-02' }, c); c.fechaInc = true; const x = T.baseDue({ data: d }, c), y = T.baseDue({ data: '2026-11-04' }, c); return { a, b, x, y } });
      ok(fe.a === '2026-12' && fe.b === '2026-11' && fe.x === '2026-11' && fe.y === '2026-12', 'cartão: compra no dia do fechamento segue a opção do cartão', JSON.stringify(fe));
      const cx = await p.evaluate(async () => { const T = window.__T, me = T.ME(), d = T.dayIn(T.ymAdd(T.today().slice(0, 7), 1), 10), c = T.caixaNoDia(d, [me])[0];
        const F = T.mesFluxo(d.slice(0, 7), me); location.hash = 'inicio'; await new Promise(r => setTimeout(r, 300)); location.hash = 'cartoes'; await new Promise(r => setTimeout(r, 500));
        const el = document.querySelector('#v-cartoes'); return { c, alt: T.realBal(me, T.today()) + T.aRealizar(me, d).reduce((s, x) => s + x.v, 0), ag: [...el.querySelectorAll('.agd')].map(x => x.innerText.replace(/\s+/g, ' ')), kp: el.querySelector('.cc .kpis') ? el.querySelector('.cc .kpis').innerText.replace(/\s+/g, ' ') : '', lib: !!el.querySelector('.plib'), rv: (el.querySelector('#c-assin .rvh') || {}).innerText || '', sub: [...el.querySelectorAll('.ccr .sub')].map(x => x.innerText.replace(/\s+/g, ' ')) } });
      ok(cx.c && Math.abs(cx.c.v - cx.alt) < .01, 'cartões: caixa no vencimento = saldo de hoje + a realizar', JSON.stringify(cx.c) + ' ' + cx.alt);
      ok(cx.ag.length && cx.ag.every(x => /caixa cobre|faltam/.test(x)), 'cartões: cada vencimento diz se o caixa cobre', JSON.stringify(cx.ag));
      ok(/Vence em/.test(cx.kp) && /Parcelas a vencer/.test(cx.kp) && /Assinaturas/.test(cx.kp) && cx.lib, 'cartões: indicadores novos e liberação do limite', cx.kp);
      ok(/para revisar/.test(cx.rv), 'cartões: assinatura não lançada aparece para revisar', cx.rv);
      ok(cx.sub.some(x => /com fixos/.test(x)) && cx.sub.some(x => /vs média/.test(x)), 'cartões: linha do cartão com fixos previstos e comparação com a média', JSON.stringify(cx.sub));
      ok(cp.rows === 3 && cp.rec.filter(x => /Streaming/.test(x)).length === 1, 'cartão: composição com 3 linhas e cada assinatura listada uma só vez', JSON.stringify(cp));
      ok(cp.chip && cp.n1 > 0 && cp.n1 < cp.n0, 'cartão: filtro Parcelas na lista da fatura', JSON.stringify(cp));
      ok(/Streaming/.test(cp.as) && /Assinatura teste/.test(cp.as) && /\/mês/.test(cp.as), 'Cartões: painel de assinaturas nos cartões', cp.as.slice(0, 120));
      ok(ass.r && ass.r.cartao === 'roxo' && !ass.r.conta && ass.l && ass.l.cartao === 'roxo' && ass.l.rec && ass.prox, 'cartão: fixo mensal cria recorrência no cartão', JSON.stringify(ass));
      await p.evaluate(() => window.__T.closeSheet(true)); await p.waitForTimeout(150);
      /* receita com data futura nasce "a receber" e é salva como pendente */
      await p.evaluate(fut => window.__T.openLanc({ tipo: 'receita', conta: 'cc', data: fut, desc: 'Férias teste', valor: 1000, categoria: 'Salário' }), fut); await p.waitForTimeout(350);
      const rf = await p.evaluate(() => { const g = document.querySelector('#l-pg'); return g ? !g.checked : null });
      ok(rf === true, 'receita futura começa como a receber');
      await p.evaluate(() => document.querySelector('#lsv').click()); await p.waitForTimeout(500);
      const salvo = await p.evaluate(() => window.__T.S.lanc.find(l => l.desc === 'Férias teste'));
      ok(salvo && salvo.pend === true && salvo.tipo === 'receita', 'receita a receber salva como pendente', JSON.stringify(salvo && { pend: salvo.pend, tipo: salvo.tipo }));
      await p.evaluate(() => window.__T.closeSheet(true)); await p.waitForTimeout(150);
      /* lançamentos › em atraso */
      await p.evaluate(() => location.hash = 'lanc'); await p.waitForTimeout(400);
      const atv = await p.evaluate(() => { const b = document.querySelector('[data-atrv]'); if (b) b.click(); return !!b }); await p.waitForTimeout(400);
      if (atv) { const n = await p.evaluate(() => document.querySelectorAll('.atrw').length); ok(n > 0, 'lançamentos: lista de atrasos', String(n)) }
      /* período: tudo o que está a realizar (agendado, pendente de hoje ou atrasado, previsto) aparece nas entradas e saídas previstas */
      for (const prk of ['semana', 'quinzena', 'mes', 'tri']) {
        await p.evaluate(k => { localStorage.setItem('pt-prk', k); location.hash = 'inicio' }, prk); await p.waitForTimeout(150);
        await p.evaluate(() => location.hash = 'relatorios'); await p.waitForTimeout(300);
        await p.evaluate(() => { const c = [...document.querySelectorAll('.chips.rp .chip')].find(x => /Período/.test(x.textContent)); c && c.click() }); await p.waitForTimeout(300);
        await p.evaluate(k => { const c = document.querySelector(`[data-prk="${k}"]`); c && c.click() }, prk); await p.waitForTimeout(400);
        const r = await p.evaluate(() => { const T = window.__T, txt = document.querySelector('.prk3') ? document.querySelector('.prk3').innerText : '';
          const fim = (txt.match(/previstos até (\d\d)\/(\d\d)/) || []); const num = s => +String(s).replace(/[^\d,]/g, '').replace(',', '.');
          const m = txt.match(/Entradas[\s\S]*?\+\s*R\$\s*([\d.]+)\s*previstos/); const ms = txt.match(/Saídas[\s\S]*?\+\s*R\$\s*([\d.]+)\s*previstos/);
          const y = T.today().slice(0, 4), b = fim[1] ? `${y}-${fim[2]}-${fim[1]}` : null; if (!b) return { txt };
          const ag = T.aRealizar(T.ME(), b), e = ag.filter(x => x.v > 0).reduce((a, x) => a + x.v, 0), o = -ag.filter(x => x.v < 0).reduce((a, x) => a + x.v, 0);
          return { b, ent: m ? num(m[1]) : 0, sai: ms ? num(ms[1]) : 0, e: Math.round(e), o: Math.round(o), txt: txt.slice(0, 200) } });
        ok(r.b && Math.abs(r.ent - r.e) <= 1 && Math.abs(r.sai - r.o) <= 1, 'período ' + prk + ': previstos = tudo a realizar', JSON.stringify(r));
      }
      /* legenda das saídas do mês (já quebrou por conflito de nome de estilo) */
      await p.evaluate(() => location.hash = 'relatorios'); await p.waitForTimeout(400);
      await p.evaluate(() => { const c = [...document.querySelectorAll('.chips.rp .chip')].find(x => /Fluxo/.test(x.textContent)); c && c.click() }); await p.waitForTimeout(500);
      const lg = await p.evaluate(() => [...document.querySelectorAll('.stl .sti')].map(e => Math.round(e.getBoundingClientRect().width)));
      ok(lg.length && lg.every(w => w >= 120), 'legenda das saídas do mês legível', lg.join(','));
      /* amarrações contábeis e cálculos */
      const R = await p.evaluate(() => {
        const T = window.__T, me = T.ME(), t = T.today(), ym = t.slice(0, 7), out = [], sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
        const eq = (n, a, b, tol = 0.02) => out.push([Math.abs(a - b) <= tol, n, (+a).toFixed(2) + ' vs ' + (+b).toFixed(2)]), is = (c, n, d) => out.push([!!c, n, d || '']);
        eq('caixa = soma das contas', T.realBal(me, t), sum(T.scopeContas(me), a => T.saldoConta(a, t) * T.fracOf(a.dono, me)));
        for (const m of [T.ymAdd(ym, -1), ym, T.ymAdd(ym, 1)]) {
          const F = T.mesFluxo(m, me), Q = F.R;
          if (F.cur) { eq(m + ' início + realizado = hoje', F.inicial + Q.rec - Q.desp - Q.fat + Q.ac + Q.res + Q.aj, F.balHoje); eq(m + ' hoje + agenda = fim', F.balHoje + sum(T.agendaPessoal(me, T.dayIn(m, 31), t, { cv: 1 }), x => x.v), F.final) }
          if (F.cur) { const P = F.Pv; eq(m + ' quadro: hoje + a realizar = previsto', F.balHoje + P.rec - P.desp - P.fat + P.ac + (P.cv || 0) + (P.gab || 0) + (P.res || 0) + (P.aj || 0), F.final) }
          if (F.past) eq(m + ' passado início + realizado = fim', F.inicial + Q.rec - Q.desp - Q.fat + Q.ac + Q.res + Q.aj, F.final);
          eq(m + ' fim = início do seguinte', F.final, T.mesFluxo(T.ymAdd(m, 1), me).inicial);
        }
        { /* premissa central: uma única lista "a realizar" amarra o fluxo do mês, a projeção e o período */
          const eom = T.dayIn(ym, 31), F = T.mesFluxo(ym, me), AR = T.aRealizar(me, eom), soma = sum(AR, x => x.v);
          eq('premissa: previsto do mês = hoje + a realizar', F.final - (F.Pv.cv || 0), F.balHoje + soma);
          eq('premissa: projeção começa no previsto do mês', T.projecao(me).rows[0].cash, F.final);
          is(AR.every(x => x.e >= t), 'premissa: nada a realizar fica antes de hoje') }
        { const PJ = T.projecao(me); let prev = T.realBal(me, t); PJ.rows.forEach(r => { eq('projeção ' + r.ym + ': caixa = anterior + movimentos', r.cash, prev + r.livre - r.cvm * 0, 1); prev = r.cash }) }
        const Pt = T.patrimonio(me), B = T.balanco(Pt);
        eq('patrimônio = ativos − passivos', Pt.liq, Pt.ativos - Pt.passivos); eq('balanço: ativo', B.AT, Pt.ativos); eq('balanço: passivo', B.PC + B.PL, Pt.passivos);
        const D = T.dividasAll(me); eq('dívidas: total = soma', D.tot, sum(D.at, x => x.v));
        const C = T.candlesCaixa(me, 6); C.forEach((c, i) => { if (i) eq('candle contínuo ' + c.ym, C[i - 1].c, c.o) });
        const M = T.margemCalc(me, ym); eq('margem livre', M.livre, M.renda - M.fixo - M.cz); eq('margem resta', M.resta, M.livre - M.usado);
        eq('plano: renda = mês', T.planoCalc(ym, me).renda, T.mesCalc(ym, me).rec);
        eq('categorias: alerta = mapa', sum(T.catWatch(me, ym), x => x.v), sum(Object.values(T.catMesMap(ym, me)), v => v), 1);
        T.S.contas.filter(a => T.isCaixa(a)).forEach(a => eq('extrato da conta ' + a.nome, T.contaMov(a).v, T.saldoConta(a)));
        T.S.contas.filter(a => T.isCaixa(a)).forEach(a => { const R = T.periodoConta(a, ym), k = R.k;
          eq('resumo da conta ' + a.nome + ': inicial + movimentos = hoje', R.ini + k.rec + k.tin - k.tout - k.desp - k.fat + k.aj, R.fin);
          eq('resumo da conta ' + a.nome + ': hoje + programado = previsto', R.fin + sum(R.it, x => x.v), R.prevFim) });
        { const fl = T.S.lanc.find(l => l.desc === 'Férias teste'); if (fl) { const R = T.periodoConta(T.S.contas.find(a => a.id === fl.conta), fl.data.slice(0, 7)); is(R.it.some(x => x.id === fl.id), 'resumo da conta: receita a receber aparece no programado') } }
        /* casa = soma das pessoas */
        const K = T.casaCalc(); eq('casa: caixa = soma', K.cx, sum(K.R, x => x.cx)); eq('casa: sobra = soma', K.rec - K.desp, sum(K.R, x => x.M.rec - x.M.desp));
        { const pr = T.S.lanc.filter(l => l.pend && l.tipo === 'receita' && l.data > t && l.data.slice(0, 7) === ym); if (pr.length) { const M = T.mesCalc(ym, me); is(M.recP >= sum(pr, l => +l.valor) - .01, 'mês: receita a receber conta como prevista', M.recP + '') } }
        { const fut = T.S.lanc.filter(l => (l.data || '') > t && ['Receita agendada', 'Boleto agendado', 'Guardar agendado', 'A receber teste'].includes(l.desc));
          const fimAg = fut.reduce((m, l) => l.data > m ? l.data : m, t), AG = T.agendaPessoal(me, fimAg);
          fut.forEach(l => is(AG.some(x => x.nav === 'l:' + l.id), 'agenda inclui ' + l.desc));
          const cc = T.S.contas.find(a => a.id === 'cc'); eq('saldo de hoje não conta agendados', T.saldoConta(cc), T.saldoConta(cc, t));
          const ymF = T.ymAdd(ym, 0), F2 = T.mesFluxo(fimAg.slice(0, 7), me); is(F2.final !== undefined, 'fluxo do mês com agendados') }
        const AT = T.atrasos(me); is(AT.pag.every(x => x.d < t && x.v < 0) && AT.rec.every(x => x.d < t && x.v > 0), 'atrasos: só o que já venceu'); eq('atrasos: total', AT.tp, sum(AT.pag, x => -x.v));
        /* frase */
        const f1 = T.parseFrase('mercado 182,40 no roxo ontem'); is(f1.valor === 182.4 && f1.cartao === 'roxo' && f1.data === T.addD(t, -1) && f1.categoria === 'Mercado', 'frase: valor, cartão, data e categoria', JSON.stringify(f1));
        const f2 = T.parseFrase('tv 3.000 em 10x no laranja'); is(f2.valor === 3000 && f2.parcelas === 10 && f2.cartao === 'lar', 'frase: milhar e parcelas', JSON.stringify(f2));
        const f3 = T.parseFrase('recebi 1.200 freela pix'); is(f3.tipo === 'receita' && f3.valor === 1200 && !!f3.conta, 'frase: receita', JSON.stringify(f3));
        const f4 = T.parseFrase('almoço 86 dividido'); is(f4.divisao === 'comum' && f4.categoria === 'Restaurante', 'frase: dividido', JSON.stringify(f4));
        /* IR de ações: venda de 22 mil (acima da isenção), lucro conhecido */
        const RV = T.rvCalc(me), IR = T.rvIR(me, RV), venda = IR.M.find(x => x.vendas > 0);
        eq('IR: lucro WEGE3', venda ? venda.lA : 0, 22000 - 6 - (400 * 45 + 6)); eq('IR: DARF 15% − 0,005%', venda ? venda.pagar : 0, ((22000 - 6 - 18006) * .15) - 22000 * .00005);
        is(venda && !venda.isento, 'IR: vendas acima de R$ 20 mil não são isentas');
        eq('bolsa: valor = soma das posições', RV.v, sum(RV.ab, x => x.v));
        /* dívidas: avalanche nunca paga mais juros que só as parcelas; com extra quita antes */
        const DL = T.divLista(me);
        if (DL.length) { const base = T.divSim(DL, 0, T.ORD.ava, false), av = T.divSim(DL, 500, T.ORD.ava, true), bo = T.divSim(DL, 500, T.ORD.bola, true);
          is(av.juros <= base.juros + .01, 'quitação: avalanche ≤ só parcelas'); is(av.k <= base.k, 'quitação: extra antecipa'); is(av.juros <= bo.juros + .01, 'quitação: avalanche ≤ bola de neve') }
        /* metas */
        const mt = T.metaCalc({ nome: 'x', valor: 1200, prazo: T.ymAdd(ym, 12), guardado: 0 }, me);
        is(mt.pmt > 0 && mt.pmt <= 100 + .01, 'meta: aporte com rendimento ≤ sem rendimento', String(mt.pmt));
        /* cenários: sem mudança, sobra igual à base; perder renda deixa a sobra negativa */
        const Z = T.cenBase(me), a = T.cenProj(Z, { r: 0, d: 0, ch: 0 }, 12), s = T.cenProj(Z, { r: -100, d: 0, ch: 0 }, 12);
        eq('cenário: sobra base', a.s, Z.B.R - Z.B.D); is(s.s < 0 && s.fol != null, 'cenário: sem renda tem fôlego finito');
        /* empresa e pontos */
        const pm = T.pjMes(ym); is(pm.rec >= 0 && Math.abs(pm.res - (pm.rec - pm.desp)) < .01, 'empresa: resultado = faturamento − despesas');
        eq('cashback 1%', T.progRet({ prog: { t: 'cb', v: 1 } }), .01, 1e-9);
        return out;
      });
      R.forEach(([c, n, d]) => ok(c, n, d));
    }
    ok(!erros.length, `sem erros de script (${w}px ${esquema})`, erros.slice(0, 3).join(' | '));
    await p.close();
  }
  /* camadas: o essencial à vista, o detalhe abre no lugar — sem perder nenhum recurso */
  { const p = await b.newPage({ viewport: { width: 375, height: 812 }, colorScheme: 'dark' }), erros = [];
    p.on('pageerror', e => erros.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('pt-tour', '1') } catch (e) { } });
    await p.route(/fonts\.(googleapis|gstatic)|gstatic|cdnjs|bcb\.gov|brapi/, r => r.abort());
    await p.goto('file://' + arq); await p.waitForTimeout(1500);
    const vis = sel => p.evaluate(s => { const e = document.querySelector(s); return !!e && !!e.offsetParent && e.getBoundingClientRect().height > 0 }, sel);
    await p.evaluate(() => location.hash = 'inicio'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => [...document.querySelectorAll('#v-inicio .card.acx')].length) <= 1, 'início: "Para fazer agora" aparece uma vez só');
    /* herói: camada 1 com caixa, a pagar, pode gastar e próxima entrada; o mês abre no lugar */
    const h1 = await p.evaluate(() => { const h = document.querySelector('.hero'); return [h.innerText, !!h.querySelector('.hmes'), h.querySelector('.hmes .fob').hidden] });
    ok(/Em caixa hoje/.test(h1[0]) && /Pode gastar sem faltar|Vai faltar/.test(h1[0]) && /A pagar/.test(h1[0]) && h1[1] && !h1[2], 'início: herói com o gráfico do mês já aberto', JSON.stringify(h1.slice(1)));
    await p.evaluate(() => document.querySelector('.hmes>.foh').click()); await p.waitForTimeout(400);
    ok(await p.evaluate(() => document.querySelector('.hmes .fob').hidden && JSON.parse(localStorage.getItem('pt-fo') || '{}').hmes === 0), 'início: o mês recolhe e fica lembrado');
    await p.evaluate(() => document.querySelector('.hmes>.foh').click()); await p.waitForTimeout(400);
    const h2 = await p.evaluate(() => { const f = document.querySelector('.hmes'); return [f.classList.contains('on'), f.querySelector('.foh').getAttribute('aria-expanded'), !!f.querySelector('.hflow') && f.querySelector('.hflow').getBoundingClientRect().height > 100, JSON.parse(localStorage.getItem('pt-fo') || '{}').hmes] });
    ok(h2[0] && h2[1] === 'true' && h2[2] && h2[3] === 1, 'início: o mês abre no lugar e fica lembrado', JSON.stringify(h2));
    await p.evaluate(() => location.hash = 'lanc'); await p.waitForTimeout(300); await p.evaluate(() => location.hash = 'inicio'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => document.querySelector('.hmes').classList.contains('on') && !document.querySelector('.hmes .fob').hidden), 'início: dobra continua aberta ao voltar');
    /* listas: 3 à vista, o resto abre no lugar */
    const rv = await p.evaluate(() => { const l = document.querySelector('.rsv2 .rvl'); if (!l) return null; const vis = [...l.querySelectorAll('.rvr')].filter(x => x.offsetParent).length, all = l.querySelectorAll('.rvr').length; return [vis, all] });
    ok(rv && rv[0] === Math.min(3, rv[1]), 'início: para resolver mostra 3 e guarda o resto', JSON.stringify(rv));
    if (rv && rv[1] > 3) { await p.evaluate(() => document.querySelector('.rsv2 .fmore>.foh').click()); await p.waitForTimeout(350);
      ok(await p.evaluate(() => [...document.querySelectorAll('.rsv2 .rvl .rvr')].every(x => x.offsetParent) && /Mostrar menos/.test(document.querySelector('.rsv2 .fmore>.foh').innerText)), 'início: "mostrar mais" abre todos no lugar');
      await p.evaluate(() => document.querySelector('.rsv2 .fmore>.foh').click()); await p.waitForTimeout(350) }
    /* cartão que começa recolhido mostra o resumo e abre ao toque (teclado também) */
    const gm = await p.evaluate(() => { const c = document.querySelector('.card.gmc'); if (!c) return null; const s = c.querySelector('.colsum'); return [c.classList.contains('colp'), s && s.offsetParent ? s.innerText : '', c.querySelector('.ch>h2').getAttribute('aria-expanded'), c.querySelector('.ch>h2').tabIndex] });
    ok(gm && gm[0] && /R\$/.test(gm[1]) && gm[2] === 'false' && gm[3] === 0, 'início: "quanto posso gastar" recolhido com resumo', JSON.stringify(gm));
    if (gm) { await p.focus('.card.gmc>.ch>h2'); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
      ok(await p.evaluate(() => { const c = document.querySelector('.card.gmc'); return !c.classList.contains('colp') && c.querySelectorAll('.gmi').length === 3 && [...c.querySelectorAll('.gmi')].every(x => x.offsetParent) }), 'início: abre pelo teclado com as três visões');
      await p.evaluate(() => document.querySelector('.card.gmc>.ch>h2').click()); await p.waitForTimeout(300) }
    /* Carteira: cada área é uma linha com o número-chave; o detalhe completo está dentro */
    await p.evaluate(() => location.hash = 'carteira'); await p.waitForTimeout(600);
    const cx = await p.evaluate(() => ['invest', 'guardar', 'patrim'].map(k => { const s = document.querySelector(`.cx[data-cx="${k}"]`); return s ? [k, s.querySelector('.cxv').innerText.trim(), s.querySelector('.cxb').hidden] : [k, null] }));
    ok(cx.every(x => x[1] && /R\$/.test(x[1]) && x[2] === true), 'carteira: investimentos, guardar e patrimônio em linhas com valor', JSON.stringify(cx));
    for (const k of ['invest', 'guardar', 'patrim']) { await p.evaluate(k => document.querySelector(`.cx[data-cx="${k}"] .cxh`).click(), k); await p.waitForTimeout(350) }
    const ct = await p.evaluate(() => document.querySelector('#v-carteira').innerText);
    const falta = ['Rendimento em 12 meses', 'Aportar por mês', 'Abertura', 'Renda variável', 'Guardado em', 'Últimos 6 meses', 'Ativo', 'Passivo', 'Patrimônio líquido de'].filter(t => !ct.includes(t));
    ok(!falta.length, 'carteira: ao abrir, todo o detalhe de antes está lá', falta.join(', '));
    ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 377, 'carteira aberta cabe na tela');
    for (const k of ['invest', 'guardar', 'patrim']) await p.evaluate(k => document.querySelector(`.cx[data-cx="${k}"] .cxh`).click(), k);
    await p.evaluate(() => { const b = document.querySelector('[data-cgpat]'); b && b.click() }); await p.waitForTimeout(700);
    ok(await p.evaluate(() => { const s = document.querySelector('.cx[data-cx="patrim"]'), c = document.querySelector('#v-carteira .cxs.pat'); const r = c && c.getBoundingClientRect(); return !!s && s.classList.contains('open') && !s.querySelector('.cxb').hidden && r && r.height > 50 && r.top < innerHeight }), 'carteira: "ver ativo e passivo" abre a seção e leva até ela');
    await p.evaluate(() => document.querySelector('.cx[data-cx="patrim"] .cxh').click());
    /* Cartões e Decidir: detalhe recolhido, mas presente */
    await p.evaluate(() => location.hash = 'cartoes'); await p.waitForTimeout(600);
    const cr = await p.evaluate(() => { const v = document.querySelector('#v-cartoes'); const c = [...v.querySelectorAll('.card')].filter(x => /Faturas: passado|Parcelas em andamento/.test((x.querySelector('.ch>h2') || {}).textContent || '')); return [c.length, c.every(x => x.classList.contains('colp')), /Por tipo/.test(v.textContent), (c[0] && c[0].querySelector('.colsum') || {}).innerText || ''] });
    ok(cr[0] === 2 && cr[1] && cr[2] && /R\$/.test(cr[3]), 'cartões: faturas e parcelas recolhidas com resumo', JSON.stringify(cr));
    await p.evaluate(() => location.hash = 'decidir'); await p.waitForTimeout(600);
    const dc = await p.evaluate(() => { const f = document.querySelector('.fo.fcat'); return f ? [f.querySelector('.fob').hidden, /Categoria/.test(f.textContent)] : null });
    ok(dc && dc[0] && dc[1], 'decidir: categorias do dia a dia abrem no lugar', JSON.stringify(dc));
    /* gráficos: todo gráfico mostra números e nenhum texto fica abaixo de 10 px na tela */
    { const ruins = {}, semNum = [];
      for (const v of ['inicio', 'cartoes', 'carteira', 'decidir']) {
        await p.evaluate(v => location.hash = v, v); await p.waitForTimeout(500);
        await p.evaluate(() => { document.querySelectorAll('.fo:not(.on)>.foh').forEach(h => h.click()); document.querySelectorAll('.colp>.ch>h2').forEach(h => h.click()); document.querySelectorAll('.cx:not(.open)>.cxh').forEach(h => h.click()) }); await p.waitForTimeout(600);
        const r = await p.evaluate(() => { const out = { small: [], none: [] }; document.querySelectorAll('svg[viewBox][role="img"]').forEach(g => { const bb = g.getBoundingClientRect(); if (bb.width < 200 || bb.height < 50) return; const m = g.getScreenCTM(); if (!m) return; const sc = Math.min(m.a, m.d);
          const T = [...g.querySelectorAll('text')].filter(t => t.getBBox().width > 0), lab = g.getAttribute('aria-label') || '?';
          T.forEach(t => { const fs = parseFloat(getComputedStyle(t).fontSize) * sc; if (fs < 9.9) out.small.push(lab + ':' + t.textContent.trim() + '@' + fs.toFixed(1)) });
          if (!T.some(t => /\d[\d.,]*k?$|R\$/.test(t.textContent.trim()) && !/^\d{1,2}$/.test(t.textContent.trim()))) out.none.push(lab) }); return out });
        if (r.small.length) ruins[v] = r.small.slice(0, 4); semNum.push(...r.none.map(x => v + ':' + x));
        await p.evaluate(() => { document.querySelectorAll('.fo.on>.foh').forEach(h => h.click()) }) }
      ok(!Object.keys(ruins).length, 'gráficos: textos legíveis (≥ 10 px na tela)', JSON.stringify(ruins));
      ok(!semNum.length, 'gráficos: todos mostram números', semNum.join(', ')) }
    /* tudo aberto a 320 px: nada vaza */
    await p.setViewportSize({ width: 320, height: 800 });
    const ovs = {};
    for (const v of ['inicio', 'carteira', 'cartoes', 'decidir']) {
      await p.evaluate(v => location.hash = v, v); await p.waitForTimeout(500);
      await p.evaluate(() => { document.querySelectorAll('.fo:not(.on)>.foh').forEach(h => h.click()); document.querySelectorAll('.colp>.ch>h2').forEach(h => h.click()); document.querySelectorAll('.cx:not(.open)>.cxh').forEach(h => h.click()) }); await p.waitForTimeout(500);
      const sw = await p.evaluate(() => document.documentElement.scrollWidth); if (sw > 322) ovs[v] = sw;
      await p.evaluate(() => { document.querySelectorAll('.fo.on>.foh').forEach(h => h.click()) }) }
    ok(!Object.keys(ovs).length, 'camadas: tudo aberto a 320 px cabe na tela', JSON.stringify(ovs));
    await p.evaluate(() => { try { localStorage.removeItem('pt-fo'); localStorage.removeItem('pt-col'); localStorage.removeItem('pt-colo'); localStorage.removeItem('pt-cx') } catch (e) { } });
    ok(!erros.length, 'camadas: sem erros de script', erros.slice(0, 3).join(' | '));
    await p.close() }
  await b.close();
  console.log(`${oks.length} ok · ${falhas.length} falha${falhas.length === 1 ? '' : 's'}`);
  falhas.forEach(f => console.log('FALHA  ' + f));
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1) });
