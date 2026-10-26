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

## Iteration 3 — maintainability

- [ ] Split `DATA` into `data.json` and covers into files, so refreshes produce readable diffs.
- [ ] Keep the "3 Oct 2026" check date in one constant instead of six strings.
- [ ] The scripts that fetched the ratings aren't in the repo. Rebuild or recover them before the next refresh.
- [ ] Current lists cover April–October 2026 and will look stale within a few months. Decide on a refresh cadence.
