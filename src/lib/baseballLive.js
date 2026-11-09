// ── BASEBALL_LIVE: the one switch for everything players can see about baseball ──
// false: baseball is wired (the /baseball app, its data, sims, modes, boards, mini games) but nothing about it
// renders: no BASEBALL on Home's sport switch, no /baseball page (it goes to football's Home), no cards,
// board tabs or Practice rows. Flip to true to ship it. On the dev server only, ?baseball=1 in the
// address turns it on for testing.
// (its own tiny file so Home can read it without loading the baseball rosters)
const BASEBALL_DEV = typeof location !== 'undefined' && !!import.meta.env?.DEV && /[?&]baseball=1\b/.test(location.search)
export const BASEBALL_LIVE = false || BASEBALL_DEV
