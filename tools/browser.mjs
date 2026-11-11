// Reads a site's ratings in the user's own Chrome (Claude in Chrome), for sites that block scripts.
//   node tools/browser.mjs <tab> <site> [--stale DAYS] [--limit N] [--list N]   writes .cache/browser-<tab>-<site>.js
//   --list N reads only the titles in that list (M, C or N), e.g. Current between full refreshes: --list N --stale 1
//   node tools/browser.mjs <tab> <site> --merge results.json          turns the results into a patch
// Steps:
//   1. open any page of the printed site in a Chrome tab (read only: no sign-in, no forms),
//   2. run the .js file there with javascript_tool. It fetches the pages one at a time from that tab
//      and keeps going in the background; `window.__ranked.done` shows progress,
//   3. when done, run `window.__ranked.show()`, which puts the results on the page, read them with
//      get_page_text, and save them to .cache/browser-<tab>-<site>.out.json,
//   4. --merge that file, then node tools/apply.mjs on the patch it writes.
// Only works with a page id (or, for Letterboxd, an IMDb id; for Goodreads, a search) are read; the rest are listed for todo.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, load, today } from './lib.mjs';
const { CFG } = createRequire(import.meta.url)('../ranking.js');

// Per site: where to run, which path to fetch, and how to read [rating, count, page id] from the HTML.
// The extractors run in the browser, so they are plain function sources.
const LD = `h => { const m = h.match(/<script type="application\\/ld\\+json">([\\s\\S]*?)<\\/script>/); return m ? JSON.parse(m[1].replace(/\\/\\* <!\\[CDATA\\[ \\*\\/|\\/\\* \\]\\]> \\*\\//g, '')) : null; }`;
// a title's key: no trailing "(...)", subtitle or ", Book N"; letters and digits only
const KEY = `s => s.replace(/\\s*\\(.*\\)\\s*$/, '').replace(/,\\s*Book\\s+\\d+.*$/i, '').split(':')[0].toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')`;
// bylines are compared as plain letters and digits (no title rules: "By: Matt Dinniman" has a colon)
const NORM = `s => s.toLowerCase().replace(/[^a-z0-9]/g, '')`;
// the author's surname, to look for in a search result's byline
const LAST = `by => by && (${NORM})(by.replace(/,.*/, '').trim().split(/\\s+/).pop())`;
// a game page's address is guessable from its title: "&" as "and" or dropped, an apostrophe dropped
// or as "-" (Backloggd: thief-s-end), a closing number as a Roman numeral, and "--1" for a reused name
const ROMAN = { 2: 'ii', 3: 'iii', 4: 'iv', 5: 'v' };
const slugs = t => {
  const b = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\./g, '');
  const out = [];
  for (const amp of ['and', '']) for (const apo of ['', '-']) {
    const x = b.replace(/&/g, amp).replace(/['’]/g, apo).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    out.push(x, x.replace(/-([2-5])$/, (_, n) => '-' + ROMAN[n]));
  }
  return [...new Set(out)].flatMap(x => [x, x + '--1']);
};
const SITES = {
  lbx: {
    origin: 'https://letterboxd.com',
    path: w => w.ids.lbx ? `/film/${w.ids.lbx}/` : w.ids.imdb && `/imdb/${w.ids.imdb}/`,
    read: `(h, url) => { const a = (${LD})(h)?.aggregateRating; return a && [+(+a.ratingValue).toFixed(2), a.ratingCount, url.match(/\\/film\\/([^/]+)/)?.[1]]; }`,
  },
  rt: {
    origin: 'https://www.rottentomatoes.com',
    path: w => w.ids.rt && `/${w.ids.rt}`,
    // only a banded count ("25,000+ Ratings") is shown (films lost their exact totals in November 2026),
    // so --merge keeps a larger count already on file
    band: true,
    read: `h => { const m = h.match(/<script[^>]*id="media-scorecard-json"[^>]*>([\\s\\S]*?)<\\/script>/); const a = m && JSON.parse(m[1]).audienceScore; const sc = a && parseInt(a.scorePercent ?? a.score); if (!sc) return null;
      const n = a.likedCount != null ? a.likedCount + a.notLikedCount : parseInt(String(a.bandedRatingCount).replace(/\\D/g, '')); return [sc, n]; }`,
  },
  mc: {
    origin: 'https://www.metacritic.com',
    path: w => w.ids.mc && `/${w.ids.mc}/`,
    // guessed pages are kept only when the release year is within a year of ours
    guess: { tabs: ['games'], paths: w => slugs(w.t).map(x => `/game/${x}/`), year: `h => +h.match(/"datePublished":"(\\d{4})/)?.[1]`, id: `url => url.match(/\\/(game\\/[^/]+)/)[1]` },
    read: `h => { const m = h.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').match(/USER SCORE.{0,80}?Based on ([\\d,]+) User Ratings?\\s*([\\d.]+)/i); return m && [+m[2], +m[1].replace(/,/g, '')]; }`,
  },
  bl: {
    origin: 'https://backloggd.com',
    path: w => w.ids.bl && `/games/${w.ids.bl}/`,
    guess: { tabs: ['games'], paths: w => slugs(w.t).map(x => `/games/${x}/`), year: `h => +h.match(/<title>[^<]*\\((\\d{4})\\)/)?.[1]`, id: `url => url.match(/\\/games\\/([^/]+)/)[1]` },
    // the ld+json is the AggregateRating itself
    read: `h => { const a = (${LD})(h); return a?.ratingValue && [+(+a.ratingValue).toFixed(3), +a.ratingCount]; }`,
  },
  gr: {
    origin: 'https://www.goodreads.com',
    // search by title only: adding the author fills the results with study guides
    path: w => w.ids.gr ? `/book/show/${w.ids.gr}` : `/search?q=${encodeURIComponent(w.t)}`,
    // a book page has ld+json; a search lists every edition and spin-off, so keep the most-rated row
    // whose title (before any subtitle or series note) is the work's title, by the work's author when known
    read: `(h, url, t, by) => { const key = ${KEY}, norm = ${NORM}, last = (${LAST})(by);
      if (/\\/book\\/show\\//.test(url)) { const a = (${LD})(h)?.aggregateRating; return a && [+a.ratingValue, +a.ratingCount, url.match(/show\\/(\\d+)/)[1]]; }
      let best = null;
      for (const tr of new DOMParser().parseFromString(h, 'text/html').querySelectorAll('tr[itemtype$="Book"]')) {
        const a = tr.querySelector('a.bookTitle'), m = tr.textContent.replace(/\\s+/g, ' ').match(/([\\d.]+) avg rating — ([\\d,]+) ratings?/);
        if (!a || !m || key(a.textContent.trim()) !== key(t) || last && !norm(tr.querySelector('a.authorName')?.textContent || '').includes(last)) continue;
        const n = +m[2].replace(/,/g, '');
        if (!best || n > best[1]) best = [+m[1], n, a.getAttribute('href').match(/show\\/(\\d+)/)[1]];
      }
      return best; }`,
  },
  // Amazon and Audible are searched every time (no page id kept): ratings move between editions,
  // so the most-rated listing by the work's author is taken fresh
  amz: {
    origin: 'https://www.amazon.com',
    path: (w, by) => `/s?k=${encodeURIComponent(w.t + ' ' + by)}&i=stripbooks`,
    gap: [1500, 2500],
    read: `(h, url, t, by) => { const key = ${KEY}, norm = ${NORM}, last = (${LAST})(by); let best = null;
      for (const r of new DOMParser().parseFromString(h, 'text/html').querySelectorAll('div[data-component-type="s-search-result"]')) {
        const a = r.querySelector('h2'), v = r.querySelector('.a-icon-alt')?.textContent.match(/([\\d.]+) out of 5/), n = r.querySelector('[aria-label$=" ratings"], [aria-label$=" rating"]')?.getAttribute('aria-label').match(/^([\\d,]+)/);
        if (!a || !v || !n || key(a.textContent.trim()) !== key(t) || last && !norm(r.textContent).includes(last)) continue;
        const c = +n[1].replace(/,/g, '');
        if (!best || c > best[1]) best = [+v[1], c];
      }
      return best; }`,
  },
  aud: {
    origin: 'https://www.audible.com',
    path: (w, by) => `/search?keywords=${encodeURIComponent(w.t + ' ' + by)}`,
    read: `(h, url, t, by) => { const key = ${KEY}, norm = ${NORM}, last = (${LAST})(by); let best = null;
      for (const li of new DOMParser().parseFromString(h, 'text/html').querySelectorAll('li.productListItem')) {
        const a = li.querySelector('h3 a'), m = li.querySelector('.ratingsLabel')?.textContent.replace(/\\s+/g, ' ').match(/([\\d.]+) ([\\d,]+) ratings?/);
        if (!a || !m || key(a.textContent.trim()) !== key(t) || last && !norm(li.querySelector('.authorLabel')?.textContent || '').includes(last)) continue;
        const c = +m[2].replace(/,/g, '');
        if (!best || c > best[1]) best = [+m[1], c];
      }
      return best; }`,
  },
  mal: {
    origin: 'https://myanimelist.net',
    path: w => w.ids.mal && `/anime/${w.ids.mal}`,
    read: `h => { const r = h.match(/itemprop="ratingValue"[^>]*>([\\d.]+)</), n = h.match(/itemprop="ratingCount"[^>]*>([\\d,]+)</); return r && n && [+r[1], +n[1].replace(/,/g, '')]; }`,
  },
};

const [tab, site, ...rest] = process.argv.slice(2);
const opt = (k, dflt) => rest.includes(k) ? rest[rest.indexOf(k) + 1] : dflt;
const S = SITES[site];
if (!S || !CFG[tab]?.src.some(p => p.k === site)) {
  console.error(`usage: node tools/browser.mjs <tab> <${Object.keys(SITES).join('|')}>${tab && CFG[tab] ? `; sites for ${tab}: ${CFG[tab].src.map(p => p.k).filter(k => SITES[k]).join(', ')}` : ''}`);
  process.exit(1);
}
const base = path.join(ROOT, '.cache', `browser-${tab}-${site}`);

if (rest.includes('--merge')) {
  // results are [rating, count, page id?] per job, in job order, or null where the page couldn't be read
  const jobs = JSON.parse(fs.readFileSync(base + '.jobs.json', 'utf8'));
  const out = JSON.parse(fs.readFileSync(opt('--merge'), 'utf8'));
  if (out.length !== jobs.length) { console.error(`expected ${jobs.length} results, got ${out.length}`); process.exit(1); }
  const patch = { [tab]: {} }, miss = [];
  jobs.forEach(([id, p], i) => {
    const v = out[i];
    if (!v) return miss.push(`${id}  ${S.origin}${p}`);
    const was = S.band && load(tab).works[id]?.s[site]?.[1] || 0;
    patch[tab][id] = { [site]: [v[0], Math.max(v[1], was)], ...(v[2] ? { ids: { [site]: v[2] } } : {}) };
  });
  fs.writeFileSync(base + '.patch.json', JSON.stringify(patch, null, 1) + '\n');
  console.log(`${jobs.length - miss.length} read, patch in ${path.relative(ROOT, base)}.patch.json${miss.length ? `\n${miss.length} not read:\n  ${miss.join('\n  ')}` : ''}`);
  process.exit(0);
}

const STALE = +opt('--stale', 21), LIMIT = +opt('--limit', 1000);
const cutoff = new Date(Date.parse(today()) - STALE * 864e5).toISOString().slice(0, 10);
const d = load(tab), jobs = [], noId = [];
// a work in a series takes the series' author
const by = {};
for (const sr of Object.values(d.series || {})) for (const m of sr.members) by[m.w] = sr.by;
// --list: only the works in that list (a series counts with all its members)
const LIST = opt('--list', ''), only = LIST && new Set(d.lists[LIST].flatMap(k => d.series[k] ? d.series[k].members.map(m => m.w) : [k]));
for (const [id, w] of Object.entries(d.works)) {
  if (only && !only.has(id)) continue;
  const v = w.s[site];
  if (v && v[2] >= cutoff) continue;
  const p = S.path(w, w.by || by[id] || '') || S.guess?.tabs.includes(tab) && S.guess.paths(w);
  if (p) jobs.push([id, p]); else noId.push(id);
}
jobs.splice(LIMIT);

const [lo, hi] = S.gap || [400, 800];
const js = `// ${tab} ${site}: ${jobs.length} pages on ${S.origin}, made by tools/browser.mjs on ${today()}
(() => {
  const PATHS = ${JSON.stringify(jobs.map(j => j[1]))};
  const WORKS = ${JSON.stringify(jobs.map(j => [d.works[j[0]].t, d.works[j[0]].by || by[j[0]] || '']))};
  const read = ${S.read};
${S.guess ? `  // a list of paths is a guess: try each, and keep a page only if its year is close to ours
  const YEARS = ${JSON.stringify(jobs.map(j => d.works[j[0]].y))}, YEAR = ${S.guess.year}, ID = ${S.guess.id};
` : ''}  const R = window.__ranked = { total: PATHS.length, done: 0, out: [],
    show() { const pre = document.createElement('pre'); pre.textContent = JSON.stringify(R.out); const m = document.createElement('main'); m.append(pre); document.body.replaceChildren(m); return R.out.filter(Boolean).length + ' of ' + R.total + ' read'; } };
  (async () => {
    // a plain loop: some sites patch Array.prototype.entries
    for (let i = 0; i < PATHS.length; i++) {
      const ps = Array.isArray(PATHS[i]) ? PATHS[i] : [PATHS[i]];
      let v = null;
      for (let j = 0; j < ps.length && !v; j++) {
        try {
          const r = await fetch(ps[j]); if (!r.ok) continue;
          const h = await r.text(); v = read(h, r.url, ...WORKS[i]);
          if (v && ps === PATHS[i]) v = Math.abs(YEAR(h) - YEARS[i]) <= 1 ? [v[0], v[1], ID(r.url)] : null;
        } catch (e) { v = null; }
      }
      R.out[i] = v && v[0] && v[1] ? v : null;
      R.done++;
      await new Promise(f => setTimeout(f, ${lo} + Math.random() * ${hi - lo}));
    }
  })();
  return 'reading ' + PATHS.length;
})()
`;
fs.mkdirSync(path.dirname(base), { recursive: true });
fs.writeFileSync(base + '.js', js);
fs.writeFileSync(base + '.jobs.json', JSON.stringify(jobs));
console.log(`${jobs.length} to read on ${S.origin}; run ${path.relative(ROOT, base)}.js in a tab there`);
if (noId.length) console.log(`${noId.length} due but without a page id (use node tools/todo.mjs ${tab} ${site}): ${noId.slice(0, 8).join(', ')}${noId.length > 8 ? '…' : ''}`);
