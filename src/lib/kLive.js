// ── K_LIVE: the one switch for everything players can see about the kicker ──────────
// false: K is wired (data, sims, career, squad, compete kit, boards, mini games, SQL) but nothing about it
// renders except the locked SOON tab: no Home tab to pick, no career position, no Squad Builder slot, no cards,
// wiki rows, board tabs or Practice row.
// Flip to true to ship it. On the dev server only, ?k=1 in the address turns it on for testing.
// (its own tiny file so Home can read it without loading the kicker rosters)
const K_DEV = typeof location !== 'undefined' && !!import.meta.env?.DEV && /[?&]k=1\b/.test(location.search)
export const K_LIVE = false || K_DEV   // built Nov 10; the owner flips it
// While it's off, K keeps a locked tab with a SOON tag at the end of football's defense on Home (components/app/AppHome.jsx,
// and the classic Home's SOON tile); it can't be picked there or anywhere else.
export const K_SOON = !K_LIVE
