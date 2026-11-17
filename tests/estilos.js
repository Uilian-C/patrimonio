/* Guarda contra conflito de nomes de estilo: o mesmo nome de classe definido em dois lugares
   distantes do arquivo com regras de layout diferentes (display/grid/colunas) quase sempre é
   um componente novo pisando num antigo — já quebrou legenda, listas e gráficos. */
const fs = require('fs'), path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const LAYOUT = /(?:^|;)(display|grid-template-columns|flex-direction):([^;!]+)/g;
const defs = {};
for (const m of s.matchAll(/(?:^|[}\n,;])\s*\.([a-zA-Z][\w-]*)\{([^{}]*)\}/g)) {
  const props = {}; for (const x of m[2].matchAll(LAYOUT)) props[x[1]] = x[2].trim();
  (defs[m[1]] = defs[m[1]] || []).push({ at: m.index, props, txt: m[2].slice(0, 70), txtAll: m[2] });
}
/* sobrescritas intencionais de tema/versão (mesmo componente, ajuste de layout) */
const OK = new Set(['hs', 'lfab', 'sheet', 'sbar', 'ltg', 'lfoot', 'qa', 'pll', 'thumbs', 'lva', 'sheet-bar', 'cqa']);
const ruins = [];
for (const [c, L] of Object.entries(defs)) {
  if (OK.has(c) || L.length < 2) continue;
  const comLayout = L.filter(x => Object.keys(x.props).length);
  for (let i = 0; i < comLayout.length; i++) for (let j = i + 1; j < comLayout.length; j++) {
    const a = comLayout[i], b = comLayout[j]; if (b.at - a.at < 40000) continue;
    const np = x => x.txtAll.split(';').filter(Boolean).length;
    const dif = Object.keys(a.props).some(k => k in b.props && a.props[k] !== b.props[k]) || ('display' in a.props && 'display' in b.props && np(a) >= 3 && np(b) >= 3 && !/!important/.test(a.txtAll + b.txtAll));
    if (dif) ruins.push(`.${c}: "${a.txt}" × "${b.txt}"`);
  }
}
module.exports = ruins;
if (require.main === module) { ruins.forEach(r => console.log('CONFLITO', r)); console.log(ruins.length ? ruins.length + ' conflito(s)' : 'sem conflitos'); process.exit(ruins.length ? 1 : 0) }
