/* Testes do Patrimônio: abre o app num navegador sem tela, com um banco falso de dados fictícios,
   e confere (1) que nenhuma tela ou janela quebra, (2) que nada estoura a largura do celular,
   (3) as amarrações contábeis (caixa, mês, patrimônio, balanço, dívidas, margem, categorias) e
   (4) cálculos isolados (frase, IR de ações, quitação de dívidas, metas, cenários).
   Uso: node tests/run.js   (precisa do pacote playwright com o Chromium instalado) */
const fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require('playwright');
const { fixture } = require('./fixture');

const ROOT = path.join(__dirname, '..');
const EXPOR = ('S ME today ymAdd addD dayIn lastDay realBal saldoConta scopeContas fracOf mesFluxo agendaPessoal patrimonio balanco dividasAll ' +
  'acerto acertoLedger credGab gabId candlesCaixa saidasDia margemCalc planoCalc mesCalc catWatch catMesMap contaMov isCaixa movs ' +
  'parseFrase rvCalc rvIR divSim divLista ORD metaCalc cenBase cenProj baseMes casaCalc pjMes filhoCalc progRet retroCalc semRev ' +
  'openRV openRVIR openCenarios openDividasPlano openCasa openPJ openPontos openFilhos openRetro openPrefs openFrase openSimCompra ' +
  'openSemana openAjuda openRelMes openMeta openAssessor openInvestDash openSpread openBackups openLanc openTour openBemVindo closeSheet').split(' ');

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
      for (const fn of ['openRV', 'openRVIR', 'openCenarios', 'openDividasPlano', 'openCasa', 'openPJ', 'openPontos', 'openFilhos', 'openRetro', 'openPrefs', 'openFrase', 'openSimCompra', 'openSemana', 'openAjuda', 'openRelMes', 'openMeta', 'openAssessor', 'openInvestDash', 'openSpread', 'openLanc', 'openTour', 'openBemVindo']) {
        const r = await p.evaluate(fn => { try { window.__T[fn](); return '' } catch (e) { return e.message } }, fn); await p.waitForTimeout(250);
        const sw = await p.evaluate(() => { const o = document.querySelector('#overlay'); if (!o || o.hidden) return 0;
          /* a janela em si e as áreas que rolam na vertical não podem ficar mais largas que a tela (rolagem lateral interna, como tabelas, é permitida) */
          const els = [...o.querySelectorAll('*')].filter(e => { const c = getComputedStyle(e); return e.parentElement === o || (/auto|scroll/.test(c.overflowY) && !/auto|scroll/.test(c.overflowX)) });
          return Math.max(0, ...els.map(e => Math.max(e.getBoundingClientRect().right, e.getBoundingClientRect().left + e.scrollWidth))) });
        ok(!r, 'abre ' + fn, r); ok(sw <= 392, 'largura da janela ' + fn, Math.round(sw) + 'px');
        await p.evaluate(() => window.__T.closeSheet(true)); await p.waitForTimeout(120);
      }
      /* amarrações contábeis e cálculos */
      const R = await p.evaluate(() => {
        const T = window.__T, me = T.ME(), t = T.today(), ym = t.slice(0, 7), out = [], sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
        const eq = (n, a, b, tol = 0.02) => out.push([Math.abs(a - b) <= tol, n, (+a).toFixed(2) + ' vs ' + (+b).toFixed(2)]), is = (c, n, d) => out.push([!!c, n, d || '']);
        eq('caixa = soma das contas', T.realBal(me, t), sum(T.scopeContas(me), a => T.saldoConta(a, t) * T.fracOf(a.dono, me)));
        for (const m of [T.ymAdd(ym, -1), ym, T.ymAdd(ym, 1)]) {
          const F = T.mesFluxo(m, me), Q = F.R;
          if (F.cur) { eq(m + ' início + realizado = hoje', F.inicial + Q.rec - Q.desp - Q.fat + Q.ac + Q.res + Q.aj, F.balHoje); eq(m + ' hoje + agenda = fim', F.balHoje + sum(T.agendaPessoal(me, T.dayIn(m, 31), t, { cv: 1 }), x => x.v), F.final) }
          if (F.past) eq(m + ' passado início + realizado = fim', F.inicial + Q.rec - Q.desp - Q.fat + Q.ac + Q.res + Q.aj, F.final);
          eq(m + ' fim = início do seguinte', F.final, T.mesFluxo(T.ymAdd(m, 1), me).inicial);
        }
        const Pt = T.patrimonio(me), B = T.balanco(Pt);
        eq('patrimônio = ativos − passivos', Pt.liq, Pt.ativos - Pt.passivos); eq('balanço: ativo', B.AT, Pt.ativos); eq('balanço: passivo', B.PC + B.PL, Pt.passivos);
        const D = T.dividasAll(me); eq('dívidas: total = soma', D.tot, sum(D.at, x => x.v));
        const C = T.candlesCaixa(me, 6); C.forEach((c, i) => { if (i) eq('candle contínuo ' + c.ym, C[i - 1].c, c.o) });
        const M = T.margemCalc(me, ym); eq('margem livre', M.livre, M.renda - M.fixo - M.cz); eq('margem resta', M.resta, M.livre - M.usado);
        eq('plano: renda = mês', T.planoCalc(ym, me).renda, T.mesCalc(ym, me).rec);
        eq('categorias: alerta = mapa', sum(T.catWatch(me, ym), x => x.v), sum(Object.values(T.catMesMap(ym, me)), v => v), 1);
        T.S.contas.filter(a => T.isCaixa(a)).forEach(a => eq('extrato da conta ' + a.nome, T.contaMov(a).v, T.saldoConta(a)));
        /* casa = soma das pessoas */
        const K = T.casaCalc(); eq('casa: caixa = soma', K.cx, sum(K.R, x => x.cx)); eq('casa: sobra = soma', K.rec - K.desp, sum(K.R, x => x.M.rec - x.M.desp));
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
  await b.close();
  console.log(`${oks.length} ok · ${falhas.length} falha${falhas.length === 1 ? '' : 's'}`);
  falhas.forEach(f => console.log('FALHA  ' + f));
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1) });
