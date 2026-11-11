# Refreshing the rankings

## How the data is kept

Each tab has one file in `data/` (`books.json`, `movies.json`, `games.json`, `tv.json`, `anime.json`):

- **`works`**: every rated thing once (a book, film, game, show or anime season), keyed by a stable id such as `the-shawshank-redemption-1994`. Each work has its ratings in `s` as `[rating, count, "date read"]` and its page on each site in `ids`.
- **`series`**: groups of works ranked by their best member (`members` lists work ids, with an optional `no` label such as `"#2 · New"`).
- **`lists`**: `M` (Modern), `C` (Classics) and `N` (Current), each an array of work or series ids. A title in two lists is still one work, so it is refreshed once.
- **`current`**: the window the Current list covers and the sentence the page shows for it.

`ranking.js` holds the scoring config (sites, weights, typical scores, thresholds) and is shared by the page and the tools. The "Ratings checked" dates on the page come from the dates stored with each rating.

## Tools

Run with Node 18 or newer from the repo root. None need installing.

| Command | What it does |
|---|---|
| `node tools/refresh.mjs` | Re-reads IMDb (official daily data files), Steam (store review summary), AniList (public API) and MyAnimeList (Jikan API) for every work with that site's id. Lists any jump that looks like a wrong id. `--dry` to preview. |
| `node tools/find-ids.mjs [imdb\|steam\|al]` | Finds missing ids on those sites, keeping a match only when its rating agrees with the one on file. Leftovers go to `.cache/find-ids.txt`. |
| `node tools/link-ids.mjs` | Fills in Rotten Tomatoes, Metacritic and Backloggd page ids from Wikidata, starting from IMDb and Steam ids. Skips game pages for re-releases (Director's Cut, remasters, `--1` slugs). `--dry` to preview. |
| `node tools/browser.mjs <tab> <site>` | Writes a script that reads every due title of one site from a Chrome tab on that site (see below). `--merge out.json` turns its results into a patch. `--stale DAYS` (default 21). `--list N --stale 1` re-reads just one list, e.g. Current between full refreshes. |
| `node tools/todo.mjs <tab> <site>` | Worklist for titles `browser.mjs` can't read (no page id): due titles with a search link and a patch template in `.cache/`. `--list N` for one list. |
| `node tools/apply.mjs patch.json` | Merges ratings, page ids, new works, series and list changes from a patch file (format at the top of the script). |
| `node tools/check.mjs` | Checks the data, then shows per-site coverage and age, thin titles, a stale Current window and unused covers. |
| `node tools/diff.mjs [REV]` | Rank changes against a git revision (default `HEAD`), for reviewing a refresh before committing. |

Sites without an API (Goodreads, Amazon, Audible, Letterboxd, Rotten Tomatoes, Backloggd, Metacritic, MyAnimeList pages) are read in the user's own Chrome through Claude in Chrome. Only read pages; never sign in or submit forms.

### Reading a site in Chrome

1. `node tools/browser.mjs <tab> <site>` writes `.cache/browser-<tab>-<site>.js`.
2. Open any page of that site in a Chrome tab and run the script there with `javascript_tool`. It fetches each title's page from that tab, one every second or two, and keeps going in the background. Check progress with `__ranked.done + '/' + __ranked.total`.
3. When it's done, run `__ranked.show()`, which puts the results on the page as JSON, read them with `get_page_text` and save them to `.cache/browser-<tab>-<site>.out.json`. (`javascript_tool` cuts long output short, so don't return the results from it directly.)
4. `node tools/browser.mjs <tab> <site> --merge .cache/browser-<tab>-<site>.out.json`, look over the titles it couldn't read and any big jumps, then `node tools/apply.mjs` on the patch.

How each site is found:
- **Rotten Tomatoes, Metacritic, Backloggd, MyAnimeList**: by page id (`link-ids.mjs` finds most; the rest by hand with `todo.mjs`). Since November 2026 Rotten Tomatoes shows only a rounded-down count ("25,000+ Ratings"), so `--merge` keeps a larger count already on file.
- **Metacritic and Backloggd games without an id**: the script guesses the page address from the title (`&` as "and" or dropped, an apostrophe dropped or turned into `-`, a closing number as a Roman numeral, `--1` for a reused name). It keeps a page only when its release year is within one year of ours, and then saves the page id. Pre-1995 games are mostly missing from Metacritic, and its pages for some classics are later remakes, so those keep the rating already on file.
- **Letterboxd**: by page id, or `letterboxd.com/imdb/<tt id>/`, which redirects to the film.
- **Goodreads**: by book id, otherwise a title search (adding the author fills the results with study guides). It keeps the most-rated result with the same title by the same author and saves its id.
- **Amazon, Audible**: a title-and-author search every time, keeping the most-rated listing with the same title by the same author. No id is kept, because ratings move between editions. Harry Potter should come out as the Jim Dale recordings on Audible; check it.

Notes on counts:
- **Steam** is the store's "All Reviews" summary across languages (whole-number percent). Before October 2026 the counts came from a different Steam endpoint and were higher, so the first refresh lowers them. Scores barely move, because the counts are far above the 50,000 threshold.
- **AniList**'s count is how many people have the show on their list (`popularity`), and its rating is `averageScore`.
- **MyAnimeList**: if the Jikan API is down (`refresh.mjs mal` hangs or times out), stop it and read MyAnimeList in Chrome with `browser.mjs anime mal`.
- **IMDb** rates a whole anime show, so every season of a show shares one IMDb id and number.

## Prompt for a refresh session

Paste this into a new Claude Code session in this repo:

```text
Refresh the ratings for "Ranked" in this repo. Read REFRESH.md, ROADMAP.md and ranking.js first, and keep the design, tabs, features and scoring as they are.

1. Run node tools/refresh.mjs, then node tools/find-ids.mjs for titles still missing ids. Check every "looks odd" line and fix wrong ids before going on.

2. Run node tools/link-ids.mjs. Then for each site without an API (Goodreads, Amazon, Audible, Letterboxd, Rotten Tomatoes, Backloggd, Metacritic), read it in my Chrome with Claude in Chrome (read only) using node tools/browser.mjs as described in "Reading a site in Chrome", and apply the patch with node tools/apply.mjs. Titles without a page id go through node tools/todo.mjs. Use the most-rated listing for each title. Watch for wrong matches: editions, translations, study guides, remakes vs originals, and titles that start with the same words. Harry Potter uses the Jim Dale Audible recordings.

3. Rebuild the Current lists: titles released in the six months before today (for TV, shows with new episodes in that window; for anime, the two most recent seasons). Take the best-rated 25–30 per tab with at least two sources. A series with a new entry in that window goes in with all its entries, ranked by its best one, and its new entries are tagged "New". Update "current" (from, to, about) in each data file.

4. Add widely loved titles released since the last update to the Modern lists. There is no fixed list size; keep existing titles unless they no longer meet the rules. Classics cutoffs stay the same: books before 1970, movies before 1980, games before 2005, TV series before 1999, anime before 2000. Group titles only when they tell one continuing story with the same main characters. Franchises of standalone stories (Zelda, Mario, Silent Hill, Resident Evil, Dark Souls) stay separate. Anime films belong in Anime, not Movies, and anime series don't appear in TV Series.

5. Update the awards: the new year's Goodreads Choice winners, Oscars, Emmys, The Game Awards, D.I.C.E. Game of the Year and the Crunchyroll Anime of the Year. Awards are display-only.

6. Give every new title a cover saved as a small .webp in covers/ (about 112×168, named like the existing ones and set as "img") and a short, original, spoiler-free summary. Delete covers that node tools/check.mjs reports as unused.

7. Before committing, run node tools/check.mjs (it must say OK) and node tools/diff.mjs, check the page on desktop and phone, and tell me which ratings changed the most and which titles entered or left the lists. If the #1 title of any Modern list changed, update tools/og.html and run tools/render-images.sh.
```
