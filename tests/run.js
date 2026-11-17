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
  'openSemana openAjuda openRelMes openMeta openAssessor openInvestDash openSpread openBackups openLanc openTour openBemVindo openAPagar atrasos catList projecao relPeriodo mesCalc closeSheet').split(' ');

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
        ['despesa no cartão', { tipo: 'despesa', cartao: 'roxo' }, ['Descrição', 'Categoria', 'Pago com', 'Repetir lançamento', 'Divisão'], { pg: false, chips: 2 }],
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
      if (atv) { const n = await p.evaluate(() => document.querySelectorAll('.atr').length); ok(n > 0, 'lançamentos: lista de atrasos', String(n)) }
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
          if (F.cur) { const P = F.Pv; eq(m + ' quadro: hoje + a realizar = previsto', F.balHoje + P.rec - P.desp - P.fat + P.ac + (P.cv || 0) + (P.gab || 0), F.final) }
          if (F.past) eq(m + ' passado início + realizado = fim', F.inicial + Q.rec - Q.desp - Q.fat + Q.ac + Q.res + Q.aj, F.final);
          eq(m + ' fim = início do seguinte', F.final, T.mesFluxo(T.ymAdd(m, 1), me).inicial);
        }
        { const PJ = T.projecao(me); let prev = T.realBal(me, t); PJ.rows.forEach(r => { eq('projeção ' + r.ym + ': caixa = anterior + movimentos', r.cash, prev + r.livre - r.cvm * 0, 1); prev = r.cash }) }
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
        { const pr = T.S.lanc.filter(l => l.pend && l.tipo === 'receita' && l.data > t && l.data.slice(0, 7) === ym); if (pr.length) { const M = T.mesCalc(ym, me); is(M.recP >= sum(pr, l => +l.valor) - .01, 'mês: receita a receber conta como prevista', M.recP + '') } }
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
  await b.close();
  console.log(`${oks.length} ok · ${falhas.length} falha${falhas.length === 1 ? '' : 's'}`);
  falhas.forEach(f => console.log('FALHA  ' + f));
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1) });
