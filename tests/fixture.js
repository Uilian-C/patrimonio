/* Dados fictícios para os testes, sempre relativos à data de hoje (nenhum dado pessoal real).
   Duas pessoas, contas, reserva com CDI, dois cartões com parcelas, faturas pagas, recorrências,
   uma dívida Price, compras comuns, renda variável, metas e uma conta de empresa. */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addD = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d) };
const ymAdd = (ym, n) => { const [y, m] = ym.split('-').map(Number), t = y * 12 + m - 1 + n; return `${Math.floor(t / 12)}-${pad(t % 12 + 1)}` };
const dayIn = (ym, d) => { const [y, m] = ym.split('-').map(Number), ld = new Date(y, m, 0).getDate(); return `${ym}-${pad(Math.min(d, ld))}` };

function fixture(hoje) {
  const t = hoje || iso(new Date()), ym = t.slice(0, 7), ini = dayIn(ymAdd(ym, -4), 1);
  let n = 0; const id = p => `${p}${++n}`;
  const config = {
    eu: 'ana', pessoas: [{ id: 'ana', nome: 'Ana Teste', ini: 'A' }, { id: 'bruno', nome: 'Bruno Teste', ini: 'B' }],
    quinzenas: { q1: { dia: 15, nome: 'Adiantamento' }, q2: { dia: 30, nome: 'Salário' } },
    tags: [{ nome: 'viagem' }, { nome: 'leo' }], histIni: ini, cdiAA: 14.15,
    metasP: [{ id: 'm1', nome: 'Viagem', valor: 12000, prazo: ymAdd(ym, 10), conta: 'res', ini: addD(t, -60), v0: 2000 }],
    filhos: [{ id: 'f1', nome: 'Léo', tag: 'leo', rec: '' }],
    pj: { nome: 'Empresa Teste', contas: ['pj'], cartoes: [], separar: false }
  };
  const contas = [
    { id: 'cc', nome: 'Banco Azul', tipo: 'corrente', dono: 'ana', saldoIni: 3200, dataIni: ini, ativo: true, cor: '#1E6FD9', instituicao: 'Banco Azul' },
    { id: 'ccb', nome: 'Banco Verde', tipo: 'corrente', dono: 'bruno', saldoIni: 1800, dataIni: ini, ativo: true, cor: '#2C8C62', instituicao: 'Banco Verde' },
    { id: 'res', nome: 'Reserva', tipo: 'reserva', dono: 'ana', saldoIni: 6000, dataIni: ini, ativo: true, rend: { tipo: 'cdi', taxa: 100 } },
    { id: 'cdb', nome: 'CDB Liquidez', tipo: 'investimento', dono: 'ana', saldoIni: 4000, dataIni: ini, ativo: true, rend: { tipo: 'cdi', taxa: 110 } },
    { id: 'pj', nome: 'Conta Empresa', tipo: 'corrente', dono: 'ana', saldoIni: 900, dataIni: ini, ativo: true }
  ];
  const cartoes = [
    { id: 'roxo', nome: 'Roxo', banco: 'Roxo', dono: 'ana', limite: 8000, fechamento: 3, vencimento: 10, ativo: true, conta: 'cc', cor: '#7A2BD6', final: '1111', prog: { t: 'pts', v: 2, mil: 20 } },
    { id: 'lar', nome: 'Laranja', banco: 'Laranja', dono: 'ana', limite: 4000, fechamento: 20, vencimento: 28, ativo: true, conta: 'cc', cor: '#E0702C', final: '2222', prog: { t: 'cb', v: 1 } }
  ];
  const L = [], add = o => L.push(Object.assign({ id: id('l'), tags: [], divisao: 'pessoal', criadoEm: new Date().toISOString() }, o));
  for (let k = 4; k >= 0; k--) {
    const m = ymAdd(ym, -k), cur = k === 0;
    const at = d => dayIn(m, d), passou = d => at(d) <= t;
    if (passou(5)) add({ tipo: 'receita', conta: 'cc', data: at(5), valor: 6500, desc: 'Salário', categoria: 'Salário' });
    if (passou(5)) add({ tipo: 'receita', conta: 'ccb', data: at(5), valor: 4200, desc: 'Salário', categoria: 'Salário' });
    [[3, 'Mercado da esquina', 'Mercado', 320, 'comum'], [8, 'Padaria', 'Mercado', 45, 'pessoal'], [12, 'Restaurante', 'Restaurante', 140, 'comum'], [17, 'Farmácia', 'Farmácia', 62, 'pessoal'], [22, 'Posto', 'Combustível', 230, 'pessoal'], [26, 'Mercado grande', 'Mercado', 410, 'comum']]
      .forEach(([d, desc, cat, v, div], j) => { if (passou(d)) add({ tipo: 'despesa', cartao: j % 2 ? 'lar' : 'roxo', data: at(d), valor: v + k * 7, desc, categoria: cat, divisao: div, parcelas: 1, parcela: 1 }) });
    if (passou(9)) add({ tipo: 'despesa', conta: 'cc', data: at(9), valor: 85, desc: 'Uber', categoria: 'Transporte' });
    if (passou(14)) add({ tipo: 'despesa', conta: 'cc', data: at(14), valor: 180, desc: 'Escola natação', categoria: 'Educação', tags: ['leo'] });
    if (passou(10) && !cur) add({ tipo: 'transf', conta: 'cc', destino: 'res', data: at(10), valor: 500, desc: 'Guardar' });
    if (passou(18)) add({ tipo: 'receita', conta: 'pj', data: at(18), valor: 2400, desc: 'Venda cliente', categoria: 'Renda extra' });
    if (passou(19)) add({ tipo: 'despesa', conta: 'pj', data: at(19), valor: 700, desc: 'Fornecedor', categoria: 'Outros' });
  }
  /* compra parcelada antiga e uma nova */
  add({ tipo: 'despesa', cartao: 'roxo', data: dayIn(ymAdd(ym, -3), 15), valor: 3600, desc: 'Geladeira', categoria: 'Casa', parcelas: 10, parcela: 1, divisao: 'comum' });
  /* agendados: efetivados com data futura (não contam no saldo de hoje, entram na projeção) */
  add({ tipo: 'receita', conta: 'cc', data: addD(t, 2), valor: 777, desc: 'Receita agendada', categoria: 'Renda extra' });
  add({ tipo: 'despesa', conta: 'cc', data: addD(t, 1), valor: 123, desc: 'Boleto agendado', categoria: 'Casa' });
  add({ tipo: 'transf', conta: 'cc', destino: 'res', data: addD(t, 3), valor: 200, desc: 'Guardar agendado' });
  add({ tipo: 'receita', conta: 'cc', data: addD(t, 2), valor: 500, desc: 'A receber teste', categoria: 'Renda extra', pend: true });
  add({ tipo: 'receita', conta: 'cc', data: t, valor: 640, desc: 'A receber hoje', categoria: 'Renda extra', pend: true });
  add({ tipo: 'receita', conta: 'ccb', data: addD(t, -2), valor: 310, desc: 'A receber atrasada', categoria: 'Renda extra', pend: true });
  add({ tipo: 'despesa', conta: 'cc', data: t, valor: 95, desc: 'Boleto pendente hoje', categoria: 'Casa', pend: true });
  add({ tipo: 'despesa', cartao: 'lar', data: addD(t, -2), valor: 900, desc: 'Passagem', categoria: 'Viagem', parcelas: 3, parcela: 1, tags: ['viagem'] });
  /* faturas já vencidas pagas: pagamento pelo total da fatura (calculado no teste pelo próprio app seria circular; aqui usamos o valor aproximado) */
  const recs = [
    { id: 'aluguel', tipo: 'despesa', nome: 'Aluguel', valor: 2200, dia: 7, dono: 'ana', conta: 'cc', categoria: 'Casa', inicio: ymAdd(ym, -4), ativo: true },
    { id: 'stream', tipo: 'despesa', nome: 'Streaming', valor: 45, dia: 12, dono: 'ana', cartao: 'roxo', conta: '', categoria: 'Assinaturas', inicio: ymAdd(ym, -4), ativo: true, divisao: 'pessoal' },
    { id: 'curso', tipo: 'despesa', nome: 'Curso', valor: 300, dia: 20, dono: 'ana', conta: 'cc', categoria: 'Educação', inicio: ymAdd(ym, -2), parcelas: 12, ativo: true, taxaAm: 1.2 },
    { id: 'bonus', tipo: 'receita', nome: 'Vale extra', valor: 400, dia: 25, dono: 'ana', conta: 'cc', categoria: 'Renda extra', inicio: ym, ativo: true }
  ];
  /* confirma as recorrências dos meses passados */
  recs.forEach(r => { for (let k = 4; k >= 1; k--) { const m = ymAdd(ym, -k); if (m < r.inicio) continue; const d = dayIn(m, r.dia); if (r.cartao) add({ tipo: r.tipo, cartao: r.cartao, data: d, valor: r.valor, desc: r.nome, categoria: r.categoria, rec: r.id, recYm: m, parcelas: 1, parcela: 1 }); else add({ tipo: r.tipo, conta: r.conta, data: d, valor: r.valor, desc: r.nome, categoria: r.categoria, rec: r.id, recYm: m }) } });
  const dividas = [{ id: 'emp', nome: 'Empréstimo', credor: 'Banco Azul', valor: 10000, taxaAm: 1.9, prazo: 24, sistema: 'PRICE', primeiro: dayIn(ymAdd(ym, -2), 15), status: 'ativa', parte: { ana: 100, bruno: 0 } }];
  const rv = {
    ops: [{ id: 'o1', tk: 'PETR4', t: 'c', q: 100, p: 30, tx: 2, d: addD(t, -200), dono: 'ana' }, { id: 'o2', tk: 'WEGE3', t: 'c', q: 400, p: 45, tx: 6, d: addD(t, -150), dono: 'ana' },
      { id: 'o3', tk: 'WEGE3', t: 'v', q: 400, p: 55, tx: 6, d: addD(t, -40), dono: 'ana' }, { id: 'o4', tk: 'HGLG11', t: 'c', q: 20, p: 160, tx: 1, d: addD(t, -90), dono: 'ana' }],
    prov: [{ id: 'p1', tk: 'HGLG11', k: 'rend', v: 22, d: addD(t, -20), dono: 'ana' }], man: { PETR4: { p: 36, em: t }, HGLG11: { p: 158, em: t } },
    alvo: { rf: 60, acao: 25, fii: 10, etf: 5, bdr: 0 }
  };
  return { app: 'patrimonio', versao: 3, geradoEm: new Date().toISOString(), config, contas, cartoes, lancamentos: L, dividas, recorrentes: recs, acertos: [], relatorios: [], rv };
}
module.exports = { fixture, iso, addD, ymAdd, dayIn };
if (require.main === module) process.stdout.write(JSON.stringify(fixture(process.argv[2]), null, 1));
