// ── OL_LIVE: the one switch for everything players can see about OL ──────────
// false: OL is wired (data, sims, career, squad, compete kits, boards, mini games, SQL) but nothing about it
// renders: no Home tab, no career position, no Squad Builder slot, no cards, wiki rows, board tabs or Practice row.
// (OL has its own figure now: OL_SILHOUETTE in data/ols.js, components/OLFigureOverlay.jsx.)
// Flip to true to ship it. On the dev server only, ?ol=1 in the address turns it on for testing.
// (its own tiny file so Home can read it without loading the OL rosters)
const OL_DEV = typeof location !== 'undefined' && !!import.meta.env?.DEV && /[?&]ol=1\b/.test(location.search)
export const OL_LIVE = true || OL_DEV   // shipped with the Nov 10 update (the owner, 11-09)
// While it's off, OL keeps a locked tab with a SOON tag at the end of football's offense on Home (components/app/AppHome.jsx,
// and the classic Home's SOON tile); it can't be picked there or anywhere else. (The owner, 11-09)
export const OL_SOON = !OL_LIVE
