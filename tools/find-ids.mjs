// Fills in missing site ids (IMDb, Steam, AniList, MyAnimeList) by searching each site
// and keeping only matches whose rating agrees with the one on file.
//   node tools/find-ids.mjs [imdb|steam|al ...] [--tab anime] [--dry]
// Titles it can't settle are listed in .cache/find-ids.txt; add those ids by hand or with apply.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, TABS, load, save } from './lib.mjs';
import { SOURCES } from './sources.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const tabArg = args.includes('--tab') ? args[args.indexOf('--tab') + 1] : null;
const keys = args.filter(a => SOURCES[a] && SOURCES[a].find);
const report = [];

for (const key of keys.length ? keys : ['imdb', 'steam', 'al']) {
  const src = SOURCES[key];
  for (const tab of src.tabs.filter(t => !tabArg || t === tabArg)) {
    const d = load(tab), items = [], seriesOf = {};
    for (const [sid, s] of Object.entries(d.series)) for (const m of s.members) seriesOf[m.w] = s;
    for (const [id, w] of Object.entries(d.works)) {
      if (w.ids[key]) continue;
      const s = seriesOf[id];
      let q = w.t;
      if (s && tab === 'anime') q = key === 'imdb' || /^(season 1|tv series|first stage)$/i.test(w.t) ? s.t : w.t === s.t || w.t.startsWith(s.t) ? w.t : `${s.t} ${w.t}`;
      // An anime show's seasons share one IMDb page, so search with the show's first year
      const year = s && tab === 'anime' && key === 'imdb' ? Math.min(...s.members.map(m => d.works[m.w].y)) : w.y;
      items.push({ work: w, q, year });
    }
    if (!items.length) continue;
    process.stderr.write(`${key} ${tab}: looking up ${items.length}\n`);
    const res = await src.find(items);
    let found = 0;
    for (const r of res) {
      if (r.id) { r.it.work.ids[key] = r.id; found++; if (r.mal && !r.it.work.ids.mal) r.it.work.ids.mal = r.mal; }
      else report.push(`${key}\t${tab}\t${r.it.work.t} (${r.it.work.y})\tsearched "${r.it.q}"\t${r.how}`);
    }
    console.log(`${key} ${tab}: found ${found} of ${items.length}`);
    if (!dry) save(tab, d);
  }
}
fs.mkdirSync(path.join(ROOT, '.cache'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.cache/find-ids.txt'), report.join('\n') + '\n');
console.log(`${report.length} not found; see .cache/find-ids.txt`);
