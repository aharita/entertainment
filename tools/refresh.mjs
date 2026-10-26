// Re-reads ratings from the sites that have an API or data file, for every work with that site's id.
//   node tools/refresh.mjs [imdb|steam|al|mal ...] [--dry]
// Jumps that look like a wrong id (rating moved a lot, or fewer ratings than before) are listed for review.
import { TABS, load, save } from './lib.mjs';
import { SOURCES } from './sources.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const keys = args.filter(a => SOURCES[a]);
const MAX = { imdb: 0.3, steam: 4, al: 4, mal: 0.3 }; // biggest believable move between refreshes

for (const key of keys.length ? keys : ['imdb', 'steam', 'al', 'mal']) {
  const src = SOURCES[key], files = {}, works = [], before = new Map();
  for (const tab of src.tabs) {
    files[tab] = load(tab);
    for (const [id, w] of Object.entries(files[tab].works)) if (w.ids[key]) { works.push(w); before.set(w, { tab, id, v: w.s[key] }); }
  }
  if (!works.length) { console.log(`${key}: no ids yet; run tools/find-ids.mjs ${key}`); continue; }
  let res;
  try { res = await src.refresh(works); } catch (e) { console.log(`${key}: ${e.message}`); continue; }
  const odd = [];
  for (const w of works) {
    const { tab, id, v } = before.get(w), nv = w.s[key];
    if (v && nv !== v && (Math.abs(nv[0] - v[0]) > MAX[key] || nv[1] < v[1] * 0.9)) odd.push(`  ${tab}/${id}: ${v[0]} (${v[1]}) → ${nv[0]} (${nv[1]})  ids.${key}=${w.ids[key]}`);
  }
  console.log(`${key}: ${res.changed} of ${works.length} changed${res.missing.length ? `, ${res.missing.length} not returned (${res.missing.slice(0, 5).join(', ')}${res.missing.length > 5 ? '…' : ''})` : ''}`);
  if (odd.length) console.log(`${key}: ${odd.length} look odd, check the id:\n${odd.join('\n')}`);
  if (!dry) for (const tab in files) save(tab, files[tab]);
}
if (dry) console.log('(dry run, nothing saved)');
