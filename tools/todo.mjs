// Worklist for a site that has to be read in the browser (Claude in Chrome): which works to
// read and where. Writes a patch template to fill in and pass to apply.mjs.
//   node tools/todo.mjs <tab> <site> [--stale DAYS] [--list N] [--limit 40]
// A work is due when it has no rating from the site, or the rating is older than DAYS (default 21).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, load, today } from './lib.mjs';
const { CFG, pageUrl } = createRequire(import.meta.url)('../ranking.js');

const [tab, site, ...rest] = process.argv.slice(2);
const opt = (k, dflt) => rest.includes(k) ? rest[rest.indexOf(k) + 1] : dflt;
const src = CFG[tab]?.src.find(p => p.k === site);
if (!src) { console.error(`usage: node tools/todo.mjs <${Object.keys(CFG).join('|')}> <site>; ${tab ? `sites for ${tab}: ${CFG[tab]?.src.map(p => p.k).join(', ')}` : ''}`); process.exit(1); }
const STALE = +opt('--stale', 21), LIMIT = +opt('--limit', 40), LIST = opt('--list', null);

const d = load(tab), cutoff = new Date(Date.parse(today()) - STALE * 864e5).toISOString().slice(0, 10);
const listed = new Set();
for (const e of LIST ? [LIST] : ['N', 'M', 'C']) for (const id of d.lists[e]) for (const w of d.series[id] ? d.series[id].members.map(m => m.w) : [id]) listed.add(w);
const due = [...listed].filter(id => { const v = d.works[id].s[site]; return !v || v[2] < cutoff; }).slice(0, LIMIT);

const template = { [tab]: {} };
for (const id of due) {
  const w = d.works[id], v = w.s[site];
  const q = encodeURIComponent(w.t + (tab === 'books' && w.by ? ' ' + w.by : ''));
  console.log(`${id}\t${w.t} (${w.y})\t${v ? `${v[0]} / ${v[1]} on ${v[2]}` : 'not rated'}\t${pageUrl(site, w.ids) || src.url(q)}`);
  template[tab][id] = { [site]: null, ...(w.ids[site] ? {} : { ids: { [site]: null } }) };
}
const out = path.join(ROOT, '.cache', `todo-${tab}-${site}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(template, null, 1) + '\n');
console.error(`${due.length} due${due.length === LIMIT ? ` (limited to ${LIMIT})` : ''}. Fill in [rating, count] and page ids in ${path.relative(ROOT, out)}, then: node tools/apply.mjs ${path.relative(ROOT, out)}`);
