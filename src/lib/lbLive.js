// ── LB_LIVE: the one switch for everything players can see about LB ──────────
// false: LB is wired (data, sims, career, squad, compete kits, boards, SQL) but nothing about it renders:
// no Home tab, no career position, no Squad Builder slot, no cards, wiki rows, board tabs or Practice row.
// Flip to true to ship it. On the dev server only, ?lb=1 in the address turns it on for testing.
// (its own tiny file so Home can read it without loading the LB rosters)
const LB_DEV = typeof location !== 'undefined' && !!import.meta.env?.DEV && /[?&]lb=1\b/.test(location.search)
export const LB_LIVE = false || LB_DEV
