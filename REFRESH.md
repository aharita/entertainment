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
| `node tools/todo.mjs <tab> <site>` | Worklist for a site that has to be read in the browser: due titles with their page (or a search) and a patch template in `.cache/`. `--list N` for one list, `--stale DAYS` (default 21). |
| `node tools/apply.mjs patch.json` | Merges ratings, page ids, new works, series and list changes from a patch file (format at the top of the script). |
| `node tools/check.mjs` | Checks the data, then shows per-site coverage and age, thin titles, a stale Current window and unused covers. |
| `node tools/diff.mjs [REV]` | Rank changes against a git revision (default `HEAD`), for reviewing a refresh before committing. |

Sites without an API (Goodreads, Amazon, Audible, Letterboxd, Rotten Tomatoes, Backloggd, Metacritic) are read in the user's own Chrome through Claude in Chrome. Only read pages; never sign in or submit forms. Save each page's id with its rating (`ids` in the patch) so the next refresh can open the page directly. Letterboxd needs no id when the film has an IMDb id, because `letterboxd.com/imdb/<tt id>/` redirects to the film.

Notes on counts:
- **Steam** is the store's "All Reviews" summary across languages (whole-number percent). Before October 2026 the counts came from a different Steam endpoint and were higher, so the first refresh lowers them. Scores barely move, because the counts are far above the 50,000 threshold.
- **AniList**'s count is how many people have the show on their list (`popularity`), and its rating is `averageScore`.
- **IMDb** rates a whole anime show, so every season of a show shares one IMDb id and number.

## Prompt for a refresh session

Paste this into a new Claude Code session in this repo:

```text
Refresh the ratings for "Ranked" in this repo. Read REFRESH.md, ROADMAP.md and ranking.js first, and keep the design, tabs, features and scoring as they are.

1. Run node tools/refresh.mjs, then node tools/find-ids.mjs for titles still missing ids. Check every "looks odd" line and fix wrong ids before going on.

2. For each site without an API (Goodreads, Amazon, Audible, Letterboxd, Rotten Tomatoes, Backloggd, Metacritic), run node tools/todo.mjs <tab> <site>, open the pages in my Chrome with Claude in Chrome (read only), fill in the patch with [rating, count] and the page id, and apply it with node tools/apply.mjs. Use the most-rated listing for each title. Watch for wrong matches: editions, translations, study guides, remakes vs originals, and titles that start with the same words. Harry Potter uses the Jim Dale Audible recordings.

3. Rebuild the Current lists: titles released in the six months before today (for TV, shows with new episodes in that window; for anime, the two most recent seasons). Take the best-rated 25–30 per tab with at least two sources. A series with a new entry in that window goes in with all its entries, ranked by its best one, and its new entries are tagged "New". Update "current" (from, to, about) in each data file.

4. Add widely loved titles released since the last update to the Modern lists. There is no fixed list size; keep existing titles unless they no longer meet the rules. Classics cutoffs stay the same: books before 1970, movies before 1980, games before 2005, TV series before 1999, anime before 2000. Group titles only when they tell one continuing story with the same main characters. Franchises of standalone stories (Zelda, Mario, Silent Hill, Resident Evil, Dark Souls) stay separate. Anime films belong in Anime, not Movies, and anime series don't appear in TV Series.

5. Update the awards: the new year's Goodreads Choice winners, Oscars, Emmys, The Game Awards, D.I.C.E. Game of the Year and the Crunchyroll Anime of the Year. Awards are display-only.

6. Give every new title a cover saved as a small .webp in covers/ (about 112×168, named like the existing ones and set as "img") and a short, original, spoiler-free summary. Delete covers that node tools/check.mjs reports as unused.

7. Before committing, run node tools/check.mjs (it must say OK) and node tools/diff.mjs, check the page on desktop and phone, and tell me which ratings changed the most and which titles entered or left the lists. If the #1 title of any Modern list changed, update tools/og.html and run tools/render-images.sh.
```
