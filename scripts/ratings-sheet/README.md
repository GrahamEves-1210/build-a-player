# Ratings sheet

The ratings editor's Google Sheet ("Build-A-Player Ratings") is built from the roster files here.

1. `dump.mjs` (bundle with esbuild, then run with an output path) writes every football and basketball pool to `pools.json`.
2. `build.py <folder holding pools.json and a pylib/ with openpyxl>` writes `Build-A-Player Ratings.xlsx`: one tab per position
   (current, then All-Time), sorted by team then position, letter grades with a dropdown. Size is left out of OL, DL, LB and DB:
   it comes from height and weight there. Kickers (K, after DB) are sorted by team then name.
3. The .xlsx is uploaded to Google Drive, which converts it to a Sheet.

Edits come back by exporting the Sheet and applying the changed grades to `src/data/*.js` on main and app.
