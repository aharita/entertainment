// What a refresh did to the rankings: compares the data files with a git revision (default HEAD).
//   node tools/diff.mjs [REV] [--top 25]
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { ROOT, TABS, load } from './lib.mjs';
const { expand, rankList } = createRequire(import.meta.url)('../ranking.js');

const args = process.argv.slice(2);
const TOP = args.includes('--top') ? +args[args.indexOf('--top') + 1] : 25;
const rev = args.find(a => !a.startsWith('--') && a !== String(TOP)) || 'HEAD';
const NAMES = { M: 'Modern', C: 'Classics', N: 'Current' };

const ranked = (tab, d) => {
  const x = expand(d), out = {};
  for (const e in x) out[e] = new Map(rankList(tab, x[e]).map(it => [it.id, it]));
  return out;
};
for (const tab of TABS) {
  let old;
  try { old = JSON.parse(execFileSync('git', ['show', `${rev}:data/${tab}.json`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 })); }
  catch { console.log(`${tab}: no data/${tab}.json at ${rev}`); continue; }
  const a = ranked(tab, old), b = ranked(tab, load(tab));
  for (const e of ['M', 'C', 'N']) {
    const lines = [];
    for (const [id, it] of b[e]) {
      const was = a[e].get(id);
      if (!was) { lines.push([it.rank, `  new  #${it.rank} ${it.t}  ${it.score.toFixed(2)}`]); continue; }
      if (was.rank !== it.rank && (it.rank <= TOP || was.rank <= TOP)) lines.push([it.rank, `  ${was.rank > it.rank ? '▲' : '▼'} ${String(Math.abs(was.rank - it.rank)).padStart(2)} #${was.rank} → #${it.rank} ${it.t}  ${was.score.toFixed(2)} → ${it.score.toFixed(2)}`]);
    }
    for (const [id, it] of a[e]) if (!b[e].has(id)) lines.push([999, `  gone #${it.rank} ${it.t}`]);
    if (lines.length) console.log(`${tab} ${NAMES[e]}:\n${lines.sort((x, y) => x[0] - y[0]).map(l => l[1]).join('\n')}`);
  }
}
