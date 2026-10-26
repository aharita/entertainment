// Merges a patch file into the data, for numbers read by hand or in the browser.
//   node tools/apply.mjs patch.json [--date YYYY-MM-DD] [--dry]
// Patch format (any number of tabs and works; null values are skipped):
// {
//   "movies": {
//     "the-shawshank-redemption-1994": { "lbx": [4.6, 3153021], "ids": { "rt": "m/shawshank_redemption" } },
//     "new-film-2026": { "t": "New Film", "y": 2026, "by": "Someone", "g": "Drama", "sum": "…", "img": "m900",
//                        "imdb": [7.9, 12000] }
//   },
//   "series": { "movies": { "toy-story": { "t": "Toy Story", "by": "Pixar", "members": [{ "w": "toy-story-1995", "no": "#1" }] } } },
//   "lists": { "movies": { "add": { "N": ["new-film-2026"] }, "remove": { "N": ["old-film-2026"] } } }
// }
// A work that doesn't exist yet is created when the patch gives it a title (t) and year (y).
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { TABS, load, save, setRating, today } from './lib.mjs';
const { CFG, PAGE } = createRequire(import.meta.url)('../ranking.js');

const args = process.argv.slice(2);
const file = args.find(a => a.endsWith('.json'));
if (!file) { console.error('usage: node tools/apply.mjs patch.json [--date YYYY-MM-DD] [--dry]'); process.exit(1); }
const date = args.includes('--date') ? args[args.indexOf('--date') + 1] : today();
const dry = args.includes('--dry');
const patch = JSON.parse(fs.readFileSync(file, 'utf8'));
const FIELDS = ['t', 'y', 'by', 'g', 'sum', 'img', 'aw', 'note', 'audQ'];
let problems = 0;
const bad = m => { problems++; console.log('skipped: ' + m); };

for (const tab of TABS) {
  const p = patch[tab], lp = patch.lists?.[tab], ps = patch.series?.[tab];
  if (!p && !lp && !ps) continue;
  const d = load(tab), sites = CFG[tab].src;
  let rated = 0, ids = 0, created = 0;
  for (const [id, ch] of Object.entries(p || {})) {
    let w = d.works[id];
    if (!w) {
      if (!ch.t || !Number.isInteger(ch.y)) { bad(`${tab}/${id} doesn't exist; give t and y to create it`); continue; }
      w = d.works[id] = { ids: {}, s: {} }; created++;
    }
    for (const f of FIELDS) if (ch[f] != null) w[f] = ch[f];
    for (const [k, v] of Object.entries(ch.ids || {})) {
      if (v == null || v === '') continue;
      if (!PAGE[k]) { bad(`${tab}/${id}: unknown site id "${k}"`); continue; }
      if (w.ids[k] !== String(v)) { w.ids[k] = String(v); ids++; }
    }
    for (const sp of sites) {
      const v = ch[sp.k];
      if (v == null) continue;
      if (!Array.isArray(v) || typeof v[0] !== 'number' || !Number.isInteger(v[1]) || v[1] < 1) { bad(`${tab}/${id} ${sp.k}: expected [rating, count], got ${JSON.stringify(v)}`); continue; }
      const r5 = sp.to5(v[0]);
      if (r5 < 0.5 || r5 > 5) { bad(`${tab}/${id} ${sp.k}: ${v[0]} is out of range for ${sp.l}`); continue; }
      if (setRating(w, sp.k, v[0], v[1], v[2] || date)) rated++;
    }
    // keep a stable key order so diffs stay small
    d.works[id] = Object.fromEntries([...FIELDS.filter(f => w[f] != null).map(f => [f, w[f]]), ['ids', w.ids], ['s', w.s]]);
  }
  for (const [id, ser] of Object.entries(ps || {})) {
    const missing = (ser.members || d.series[id]?.members || []).filter(m => !d.works[m.w]);
    if (missing.length) { bad(`${tab}: series ${id} has unknown members ${missing.map(m => m.w).join(', ')}`); continue; }
    d.series[id] = { ...d.series[id], ...ser };
  }
  for (const [e, add] of Object.entries(lp?.add || {})) for (const id of add) {
    if (!d.works[id] && !d.series[id]) bad(`${tab}: can't add unknown ${id} to ${e}`);
    else if (!d.lists[e].includes(id)) d.lists[e].push(id);
  }
  for (const [e, rm] of Object.entries(lp?.remove || {})) d.lists[e] = d.lists[e].filter(id => !rm.includes(id));
  console.log(`${tab}: ${rated} ratings, ${ids} page ids${created ? `, ${created} new works` : ''}`);
  if (!dry) save(tab, d);
}
console.log(problems ? `${problems} skipped` : 'all applied' + (dry ? ' (dry run, nothing saved)' : '') + '. Run node tools/check.mjs next.');
