// Shared helpers for the data tools. Data lives in data/<tab>.json:
//   works:  every rated thing once (a book, film, game, show, season), keyed by id,
//           with ratings s:{site:[rating, count, "YYYY-MM-DD"]} and site ids in ids:{}
//   series: groups of works ranked by their best member
//   lists:  M (modern), C (classics), N (current) as arrays of work or series ids
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TABS = ['books', 'movies', 'games', 'tv', 'anime'];
export const today = () => new Date().toISOString().slice(0, 10);

export const dataPath = tab => path.join(ROOT, 'data', tab + '.json');
export const load = tab => JSON.parse(fs.readFileSync(dataPath(tab), 'utf8'));

// Pretty JSON, with short arrays (ratings, awards, ids) kept on one line so diffs stay readable.
export function format(v) {
  return JSON.stringify(v, null, 1).replace(/\[\s+([^\[\]{}]*?)\s+\]/g, (_, a) => '[' + a.replace(/,\s+/g, ', ') + ']') + '\n';
}
export const save = (tab, d) => fs.writeFileSync(dataPath(tab), format(d));

export const slug = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Every list entry id → the works it covers.
export function worksOf(d, id) {
  return d.series[id] ? d.series[id].members.map(m => m.w) : [id];
}

// Sets one rating; returns true if it changed.
export function setRating(work, site, rating, count, date = today()) {
  const old = work.s[site];
  work.s[site] = [rating, count, date];
  return !old || old[0] !== rating || old[1] !== count;
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function getJSON(url, opts = {}, tries = 4) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { ...opts, headers: { 'user-agent': 'ranked-refresh/1 (github.com/aharita/entertainment)', ...opts.headers } });
    if (r.ok) return r.json();
    if (i >= tries || ![429, 500, 502, 503, 504].includes(r.status)) throw new Error(`${r.status} ${url}`);
    await sleep(1500 * 2 ** i);
  }
}
