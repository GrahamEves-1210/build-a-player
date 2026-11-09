// ── SOCCER_LIVE: the one switch for everything players can see about soccer ──
// false: soccer is wired (the /soccer app, its data, sims, modes, boards, mini games) but nothing about it
// renders: no SOCCER on Home's sport switch, no /soccer page (it goes to football's Home), no cards,
// board tabs or Practice rows. Flip to true to ship it. On the dev server only, ?soccer=1 in the
// address turns it on for testing.
// (its own tiny file so Home can read it without loading the soccer rosters)
const SOCCER_DEV = typeof location !== 'undefined' && !!import.meta.env?.DEV && /[?&]soccer=1\b/.test(location.search)
export const SOCCER_LIVE = false || SOCCER_DEV
// While it's off, soccer still sits on Home's sport switch: /soccer opens its Home as it is, under a COMING SOON
// board (components/SoccerComingSoon.jsx), and nothing on it can be played. (The owner, 11-08: "show soccer as it
// is now but with a coming soon over it")
export const SOCCER_SOON = !SOCCER_LIVE
