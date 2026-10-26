# Ranked

Books, movies, games, TV series and anime, ranked by a volume-weighted score that blends three audience rating sites per medium, split into Modern, Classics and Current.

Live site: https://aharita.github.io/entertainment/

A static site on GitHub Pages, with no build step:

- `index.html`: the page
- `ranking.js`: scoring config and ranking, shared with the tools
- `data/`: the titles and ratings, one file per tab
- `covers/`: cover images
- `tools/`: scripts that refresh and check the data, and the sources for `og.png` (link preview) and `apple-touch-icon.png` (render with `tools/render-images.sh`)

The page loads `data/*.json` with `fetch`, so preview it through a local server (`python3 -m http.server`), not by opening the file directly.

To update the ratings, see [REFRESH.md](REFRESH.md).
