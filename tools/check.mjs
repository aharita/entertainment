// Checks the data files and reports what needs attention. Exits 1 if anything would break the page.
//   node tools/check.mjs [--stale DAYS]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, TABS, load, today } from './lib.mjs';
const { CFG, PAGE } = createRequire(import.meta.url)('../ranking.js');

const args = process.argv.slice(2);
const STALE = args.includes('--stale') ? +args[args.indexOf('--stale') + 1] : 60;
const days = d => Math.round((Date.parse(today()) - Date.parse(d)) / 864e5);
const errors = [], notes = [];
const used = new Set();

for (const tab of TABS) {
  const d = load(tab), sites = CFG[tab].src.map(p => p.k), err = m => errors.push(`${tab}: ${m}`);
  for (const k of ['current', 'works', 'series', 'lists']) if (!d[k]) err(`missing "${k}"`);
  const listed = new Set();
  for (const e of ['M', 'C', 'N']) for (const id of d.lists[e] || []) {
    if (d.series[id]) { used.add(d.series[id].img); for (const m of d.series[id].members) { listed.add(m.w); if (!d.works[m.w]) err(`series ${id} has unknown member ${m.w}`); } }
    else if (d.works[id]) listed.add(id);
    else err(`list ${e} has unknown id ${id}`);
  }
  const thin = [], cov = Object.fromEntries(sites.map(k => [k, { rated: 0, ids: 0, oldest: '9999' }]));
  for (const [id, w] of Object.entries(d.works)) {
    if (!listed.has(id)) notes.push(`${tab}: ${id} isn't in any list`);
    if (typeof w.t !== 'string' || !Number.isInteger(w.y)) err(`${id} needs a title (t) and a year (y)`);
    if (!w.ids || !w.s) { err(`${id} needs ids:{} and s:{}`); continue; }
    if (w.img) used.add(w.img);
    for (const k in w.ids) if (!PAGE[k]) err(`${id} has an id for unknown site "${k}"`);
    for (const [k, v] of Object.entries(w.s)) {
      if (!sites.includes(k)) { err(`${id} has a rating from "${k}", which this tab doesn't use`); continue; }
      if (!Array.isArray(v) || typeof v[0] !== 'number' || !Number.isInteger(v[1]) || v[1] < 1 || !/^\d{4}-\d\d-\d\d$/.test(v[2] || '')) { err(`${id} ${k} should be [rating, count, "YYYY-MM-DD"], got ${JSON.stringify(v)}`); continue; }
      const r5 = CFG[tab].src.find(p => p.k === k).to5(v[0]);
      if (r5 < 0.5 || r5 > 5) err(`${id} ${k} rating ${v[0]} is out of range`);
      cov[k].rated++; if (v[2] < cov[k].oldest) cov[k].oldest = v[2];
    }
    for (const k of sites) if (w.ids[k] || (k === 'lbx' && w.ids.imdb)) cov[k].ids++;
    const n = Object.keys(w.s).length;
    if (n < 2) thin.push(`${w.t} (${w.y})${n ? '' : ' — no ratings'}`);
  }
  const total = Object.keys(d.works).length;
  console.log(`\n${tab}: ${total} works, ${Object.keys(d.series).length} series, lists M ${d.lists.M.length} · C ${d.lists.C.length} · N ${d.lists.N.length}`);
  for (const k of sites) {
    const c = cov[k], old = c.rated ? days(c.oldest) : null;
    console.log(`  ${k.padEnd(6)} rated ${String(c.rated).padStart(3)}/${total}  page id ${String(c.ids).padStart(3)}/${total}  oldest ${c.rated ? `${c.oldest} (${old} days)` : '—'}${old > STALE ? '  STALE' : ''}`);
  }
  if (thin.length) console.log(`  ${thin.length} scored on one site or none: ${thin.slice(0, 6).join('; ')}${thin.length > 6 ? '…' : ''}`);
  const age = days(d.current.to);
  if (age > 45) console.log(`  Current list ends ${d.current.to}, ${age} days ago — time to rebuild it`);
}

const files = fs.readdirSync(path.join(ROOT, 'covers')).filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5));
const missing = [...used].filter(k => k && !files.includes(k)), unused = files.filter(f => !used.has(f));
if (missing.length) errors.push(`missing covers: ${missing.join(', ')}`);
if (unused.length) notes.push(`${unused.length} covers aren't used: ${unused.join(', ')}`);

console.log('');
for (const n of notes) console.log('note: ' + n);
for (const e of errors) console.log('ERROR: ' + e);
console.log(errors.length ? `${errors.length} errors` : 'OK');
process.exit(errors.length ? 1 : 0);
