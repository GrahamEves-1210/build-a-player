// ── OL_LIVE: the one switch for everything players can see about OL ──────────
// false: OL is wired (data, sims, career, squad, compete kits, boards, mini games, SQL) but nothing about it
// renders: no Home tab, no career position, no Squad Builder slot, no cards, wiki rows, board tabs or Practice row.
// It waits on the OL silhouette: until then the build screen draws a placeholder figure (OL_SILHOUETTE in data/ols.js).
// Flip to true to ship it. On the dev server only, ?ol=1 in the address turns it on for testing.
// (its own tiny file so Home can read it without loading the OL rosters)
const OL_DEV = typeof location !== 'undefined' && !!import.meta.env?.DEV && /[?&]ol=1\b/.test(location.search)
export const OL_LIVE = false || OL_DEV
