// Sites that can be read without a browser. Each source can
//   refresh(works): update s[key] for every work that has ids[key]
//   find(items):    look up ids[key] for works that don't have one yet, by title,
//                   accepting a match only when its rating agrees with the one on file
// items are {work, q, year} where q is the title to search for.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { Readable } from 'node:stream';
import { ROOT, setRating, getJSON, sleep, slug } from './lib.mjs';

const CACHE = path.join(ROOT, '.cache');
const norm = s => slug(s).replace(/^(the|a)-/, '');
const near = (a, b, tol) => a > 0 && b > 0 && Math.abs(Math.log(a / b)) < Math.log(1 + tol);

/* ---------- IMDb: the official daily datasets ---------- */
async function download(name) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, name);
  const fresh = fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < 20 * 3600e3;
  if (!fresh) {
    process.stderr.write(`downloading ${name}…\n`);
    const r = await fetch('https://datasets.imdbws.com/' + name);
    if (!r.ok) throw new Error(`${r.status} ${name}`);
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  return file;
}
async function* tsv(name) {
  const rl = readline.createInterface({ input: fs.createReadStream(await download(name)).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  let head;
  for await (const line of rl) { const f = line.split('\t'); if (!head) { head = f; continue; } yield f; }
}
let ratings;
async function imdbRatings() {
  if (!ratings) { ratings = new Map(); for await (const [id, r, n] of tsv('title.ratings.tsv.gz')) ratings.set(id, [+r, +n]); }
  return ratings;
}
const imdb = {
  key: 'imdb', tabs: ['movies', 'tv', 'anime'],
  async refresh(works) {
    const R = await imdbRatings(); let n = 0, missing = [];
    for (const w of works) { const v = R.get(w.ids.imdb); if (!v) { missing.push(w.ids.imdb); continue; } if (setRating(w, 'imdb', v[0], v[1])) n++; }
    return { changed: n, missing };
  },
  async find(items) {
    const R = await imdbRatings();
    const TYPES = new Set(['movie', 'tvSeries', 'tvMiniSeries', 'tvMovie', 'video', 'tvSpecial']);
    const want = new Set(items.map(i => norm(i.q)));
    const byTitle = new Map(), all = [];
    for await (const [id, type, primary, original, , start] of tsv('title.basics.tsv.gz')) {
      if (!TYPES.has(type) || !R.has(id)) continue;
      const row = { id, y: +start || 0, v: R.get(id) };
      all.push(row);
      for (const t of new Set([norm(primary), norm(original)])) if (want.has(t)) (byTitle.get(t) || byTitle.set(t, []).get(t)).push(row);
    }
    const out = [];
    for (const it of items) {
      const old = it.work.s.imdb, ok = c => !old || (Math.abs(c.v[0] - old[0]) <= 0.2 && near(c.v[1], old[1], 0.25));
      let c = (byTitle.get(norm(it.q)) || []).filter(c => Math.abs(c.y - it.year) <= 2 && ok(c));
      // No title match: try a unique rating + vote count match, which is very specific for well-rated titles
      if (!c.length && old && old[1] >= 20000) c = all.filter(c => c.v[0] === old[0] && near(c.v[1], old[1], 0.03) && Math.abs(c.y - it.year) <= 3);
      c.sort((a, b) => b.v[1] - a.v[1]);
      if (c.length === 1 || (c.length > 1 && c[0].v[1] > 5 * c[1].v[1])) out.push({ it, id: c[0].id, how: `${c[0].v[0]} / ${c[0].v[1]}` });
      else out.push({ it, id: null, how: c.length ? `${c.length} candidates` : 'no match' });
    }
    return out;
  },
};

/* ---------- Steam: the store's own review summary (all languages) ---------- */
async function steamSummaries(appids) {
  const out = new Map();
  for (let i = 0; i < appids.length; i += 50) {
    const input = { ids: appids.slice(i, i + 50).map(appid => ({ appid: +appid })), context: { language: 'english', country_code: 'US' }, data_request: { include_reviews: true } };
    const d = await getJSON('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=' + encodeURIComponent(JSON.stringify(input)));
    for (const it of d.response.store_items || []) { const s = it.reviews?.summary_filtered; if (s?.review_count) out.set(String(it.appid), [s.percent_positive, s.review_count, it.name]); }
  }
  return out;
}
const steam = {
  key: 'steam', tabs: ['games'],
  async refresh(works) {
    const S = await steamSummaries(works.map(w => w.ids.steam)); let n = 0, missing = [];
    for (const w of works) { const v = S.get(String(w.ids.steam)); if (!v) { missing.push(w.ids.steam); continue; } if (setRating(w, 'steam', v[0], v[1])) n++; }
    return { changed: n, missing };
  },
  async find(items) {
    const out = [];
    for (const it of items) {
      const d = await getJSON(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(it.q)}&cc=us&l=en`);
      const cands = (d.items || []).filter(c => c.type === 'app');
      const S = cands.length ? await steamSummaries(cands.map(c => c.id)) : new Map();
      const old = it.work.s.steam;
      const ok = cands.filter(c => { const v = S.get(String(c.id)); return v && (!old || Math.abs(v[0] - old[0]) <= 3); });
      const exact = ok.filter(c => norm(c.name) === norm(it.q));
      const pick = exact.length === 1 ? exact[0] : ok.length === 1 && old ? ok[0] : null;
      out.push(pick ? { it, id: String(pick.id), how: `${pick.name} · ${S.get(String(pick.id)).slice(0, 2).join('% of ')}` } : { it, id: null, how: ok.length ? `${ok.length} candidates` : 'no match' });
      await sleep(400);
    }
    return out;
  },
};

/* ---------- AniList: public GraphQL API (score and list count; also gives the MyAnimeList id) ---------- */
const AL = 'https://graphql.anilist.co';
const alQuery = async (query, variables) => {
  const d = await getJSON(AL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  await sleep(2100); // 30 requests a minute
  return d.data;
};
const anilist = {
  key: 'al', tabs: ['anime'],
  async refresh(works) {
    let n = 0, missing = [];
    const ids = [...new Set(works.map(w => +w.ids.al))], got = new Map();
    for (let i = 0; i < ids.length; i += 50) {
      const d = await alQuery('query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){id averageScore popularity}}}', { ids: ids.slice(i, i + 50) });
      for (const m of d.Page.media) got.set(m.id, m);
    }
    for (const w of works) { const m = got.get(+w.ids.al); if (!m?.averageScore) { missing.push(w.ids.al); continue; } if (setRating(w, 'al', m.averageScore, m.popularity)) n++; }
    return { changed: n, missing };
  },
  async find(items) {
    const out = [];
    for (const it of items) {
      const d = await alQuery('query($q:String){Page(perPage:20){media(search:$q,type:ANIME){id idMal seasonYear startDate{year} averageScore popularity title{english romaji}}}}', { q: it.q });
      const old = it.work.s.al;
      const c = d.Page.media.filter(m => {
        const y = m.seasonYear || m.startDate?.year;
        return (!y || Math.abs(y - it.year) <= 1) && (old ? m.averageScore && Math.abs(m.averageScore - old[0]) <= 2 && near(m.popularity, old[1], 0.35) : true);
      });
      if (!old) c.splice(0, c.length, ...c.filter(m => [m.title.english, m.title.romaji].some(t => t && norm(t) === norm(it.q))));
      if (old) c.sort((a, b) => Math.abs(Math.log(a.popularity / old[1])) - Math.abs(Math.log(b.popularity / old[1])));
      const pick = c.length === 1 || (old && c.length > 1 && Math.abs(Math.log(c[1].popularity / old[1])) > 3 * Math.abs(Math.log(c[0].popularity / old[1])) + 0.05) ? c[0] : null;
      out.push(pick ? { it, id: String(pick.id), mal: pick.idMal && String(pick.idMal), how: `${pick.title.english || pick.title.romaji} · ${pick.averageScore}% / ${pick.popularity}` } : { it, id: null, how: c.length ? `${c.length} candidates` : 'no match' });
    }
    return out;
  },
};

/* ---------- MyAnimeList via Jikan (unofficial API); ids come from AniList ---------- */
const mal = {
  key: 'mal', tabs: ['anime'],
  async refresh(works) {
    let n = 0, missing = [];
    const ids = [...new Set(works.map(w => w.ids.mal))], got = new Map();
    for (const id of ids) {
      try { const d = await getJSON(`https://api.jikan.moe/v4/anime/${id}`, { signal: AbortSignal.timeout(20000) }); got.set(String(id), d.data); }
      catch (e) { if (e.name === 'TimeoutError' && !got.size) throw new Error('Jikan is not responding; read MyAnimeList in Chrome instead (tools/todo.mjs anime mal)'); missing.push(id); }
      await sleep(1100);
    }
    for (const w of works) { const m = got.get(String(w.ids.mal)); if (!m?.score) { missing.push(w.ids.mal); continue; } if (setRating(w, 'mal', m.score, m.scored_by)) n++; }
    return { changed: n, missing };
  },
};

export const SOURCES = { imdb, steam, al: anilist, mal };
