# Roadmap

Pre-launch review, 25 Oct 2026. One iteration at a time, review after each.

## Iteration 1 — launch blockers

- [x] **Page weight.** Covers moved from inline base64 to `covers/*.webp` and lazy-loaded: HTML 5.5 MB → 328 KB, first load is that plus the ~10 covers on screen. Dropped 16 unused covers.
- [x] **Links and Back button.** Tab and era changes add history entries; Back/Forward and pasted `#games/classics` links work; `#method` still scrolls without changing tabs.
- [x] **Sharing and metadata.** Favicon, apple-touch icon, Open Graph/Twitter card with `og.png`, theme-color, and an updated description.
- [x] **Refresh prompt is public.** Moved to `REFRESH.md`, updated for GitHub Pages and the `covers/` folder.
- [x] ~~Missing covers~~ — false alarm: every title has one (series covers sit on the series, not its entries).

## Iteration 2 — polish

- [ ] **Phone density.** Each entry is ~360 px tall at 390 px wide, so only about two fit on screen. Try a compact row and tap to expand the summary and ratings.
- [ ] **Phone navigation.** The tabs and filters scroll away on phones (`.controls{position:static}`). Add a sticky mini bar or a back-to-top button.
- [ ] **Theme button.** It just says "Theme". Show the current mode, or cycle Auto / Light / Dark.
- [ ] **Thin data.** 87 titles (counting each book or season in a series) are scored on fewer than 3 sites, mostly games and classic TV, and 13 on only one. Show "2 of 3 sites" on these, or require at least 2.

## Iteration 3 — data pipeline (done, in review)

- [x] **Data out of the page.** Titles and ratings live in `data/<tab>.json`, one record per work (a title in two lists is stored once) with the date each rating was read. Scoring config moved to `ranking.js`, shared by the page and the tools.
- [x] **Check dates come from the data.** The page works out "Ratings checked" from the stored dates instead of six hard-coded strings.
- [x] **Refresh tools** in `tools/`: `refresh` (IMDb, Steam, AniList, MyAnimeList via APIs), `find-ids`, `todo` + `apply` for sites read in Chrome, `check`, `diff`. Each work keeps its page id per site, so later refreshes open pages directly.
- [x] Page ids found: IMDb 650 of 670 films/shows/anime, Steam 118 of 190 games (most of the rest aren't on Steam), AniList and MyAnimeList 303 of 323 anime.
- [ ] **Cadence.** Current lists cover April–October 2026. Suggest a monthly `refresh.mjs` (APIs only, minutes) and a quarterly full refresh with Current rebuilt.

## Iteration 4 — first refresh on the pipeline

- [ ] Run the API refresh, then the Chrome worklists site by site; rebuild Current; add new releases and awards; review `diff.mjs` before committing.
