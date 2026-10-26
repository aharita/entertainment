// Fills in page ids for sites read in the browser (Rotten Tomatoes, Metacritic,
// Backloggd) from Wikidata, starting from ids we already trust (IMDb for films and shows,
// Steam for games). Never overwrites an id that's already set.
//   node tools/link-ids.mjs [--tab movies] [--dry]
import { TABS, load, save, getJSON } from './lib.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const tabArg = args.includes('--tab') ? args[args.indexOf('--tab') + 1] : null;

// from: the id we match on; to: site key → Wikidata property (pre: prefix added to the value)
const LINKS = {
  movies: { from: ['imdb', 'P345'], to: { rt: 'P1258', mc: 'P1712' } },
  tv: { from: ['imdb', 'P345'], to: { rt: 'P1258', mc: 'P1712' } },
  games: { from: ['steam', 'P1733'], to: { mc: 'P12054', bl: 'P5794' }, pre: { mc: 'game/' } },
};
const OK = { rt: /^(m|tv)\/[\w-]+$/, mc: /^(movie|tv|game)\/[\w-]+$/, lbx: /^[\w-]+$/, bl: /^[\w-]+$/ };
// a Steam id often belongs to a re-release (Director's Cut, HD edition, a remake sharing the name as "--1"),
// so those pages are left for todo.mjs, where the original is picked by hand
const EDITION = /(directors-cut|special-edition|enhanced-edition|hd-edition|definitive-edition|final-cut|remaster|--\d+)$|-(remastered|remake)-/;

async function query(from, to, values) {
  const vars = Object.keys(to);
  const q = `SELECT ?k ${vars.map(v => '?' + v).join(' ')} WHERE { VALUES ?k {${values.map(v => JSON.stringify(v)).join(' ')}} ?x wdt:${from} ?k. ${vars.map(v => `OPTIONAL{?x wdt:${to[v]} ?${v}}`).join(' ')} }`;
  const j = await getJSON('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { accept: 'application/sparql-results+json' } });
  return j.results.bindings;
}

for (const tab of TABS.filter(t => LINKS[t] && (!tabArg || t === tabArg))) {
  const { from: [key, prop], to, pre = {} } = LINKS[tab], d = load(tab);
  const byId = {};
  for (const w of Object.values(d.works)) if (w.ids[key] && Object.keys(to).some(k => !w.ids[k])) (byId[w.ids[key]] ||= []).push(w);
  const keys = Object.keys(byId), added = {};
  for (let i = 0; i < keys.length; i += 150) {
    for (const b of await query(prop, to, keys.slice(i, i + 150))) for (const w of byId[b.k.value]) for (const k in to) {
      const v = b[k] && (pre[k] || '') + b[k].value;
      if (v && !w.ids[k] && OK[k].test(v) && !(tab === 'games' && EDITION.test(v))) { w.ids[k] = v; added[k] = (added[k] || 0) + 1; }
    }
  }
  console.log(`${tab}: ${Object.entries(added).map(([k, n]) => `${n} ${k}`).join(', ') || 'nothing new'}`);
  if (!dry) save(tab, d);
}
