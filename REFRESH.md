# Refreshing the rankings

Paste this prompt into a new Claude Code session in this repo to update every rating and add new releases and awards.

```text
Update the site "Ranked" in this repo for this year. Read the current index.html first and keep its design, tabs and features. The site is served by GitHub Pages: index.html holds the data and code, covers/ holds the cover images.

1. Refresh every rating. For every title in all fifteen lists (Books, Movies, Games, TV Series and Anime, each Modern, Classics and Current), re-read the rating and rating count from the same sources:
   - Books: Goodreads, Amazon (book search), Audible.
   - Movies: IMDb, Letterboxd, Rotten Tomatoes audience score.
   - Games: Backloggd, Steam user reviews, Metacritic user score. For classic games, Steam only counts where an official PC version exists.
   - TV series: IMDb, Metacritic user score, Rotten Tomatoes audience score.
   - Anime: MyAnimeList and AniList per season, IMDb for the whole show. Anime films (Ghibli and others) belong in Anime, not Movies, and anime series don't appear in TV Series.
   Use the most-rated listing for each title.

   Then rebuild the Current lists (the third option next to Modern and Classics) from scratch: titles released in the six months before the update date (for TV, shows with new episodes in that window; for anime, the two most recent seasons). Take the best-rated 25–30 per tab with at least two sources. A series with a new entry in that window goes in with all its entries, ranked by its best one, and its new entries are tagged "New". Watch for wrong matches: editions, translations, study guides, remakes vs originals, and titles that start with the same words (e.g. every "Harry Potter and the..." book). Harry Potter uses the Jim Dale Audible recordings.

2. Add new releases. Add widely loved titles released since the last update to the Modern lists. There is no fixed list size, so keep existing titles unless they no longer meet the rules. Classics cutoffs stay the same: books before 1970, movies before 1980, games before 2005, TV series before 1999, anime before 2000. Group titles only when they tell one continuing story with the same main characters, the kind you'd go through in order. Franchises of standalone stories (Zelda, Mario, Silent Hill, Resident Evil, Dark Souls) stay separate. When a new entry joins an existing series, add it and check the series is complete.

3. Keep the scoring the same. Each rating is converted to a 5-point scale, adjusted toward that site's typical score with the same thresholds (shown in "How the ranking works"), then blended with the same weights and per-tab starting point. A series sits in the list of its first entry and is ranked by its best-scoring entry.

4. Update the awards. Add the new year's Goodreads Choice winners, Oscars, Emmys, The Game Awards, D.I.C.E. Game of the Year and the Crunchyroll Anime of the Year. Awards stay display-only and don't change the score.

5. Covers and text. Give every new title a cover, poster or box art saved as a small .webp in covers/ (about 112×168, like the existing ones) and listed in IMGS, and a short, original, spoiler-free summary. Delete covers no title uses any more.

6. Before publishing, check it works on desktop and phone, and tell me which ratings changed the most and which titles entered or left the lists. Update the "Ratings checked" dates on the page. If the #1 title of any Modern list changed, update tools/og.html and run tools/render-images.sh.
```
