// ── SOCCER_LIVE: the one switch for everything players can see about soccer ──
// false: soccer is wired (the /soccer app, its data, sims, modes, boards, mini games) but nothing about it
// renders: no SOCCER on Home's sport switch, no /soccer page (it goes to football's Home), no cards,
// board tabs or Practice rows. Flip to true to ship it. On the dev server only, ?soccer=1 in the
// address turns it on for testing.
// (its own tiny file so Home can read it without loading the soccer rosters)
// (the switch sticks on this browser: ?soccer=1 once turns it on until ?soccer=0, so it survives refreshes and
// moving between pages. Dev server only: it is always off in the production build)
const SOCCER_DEV = (() => {
  if (typeof location === 'undefined' || !import.meta.env?.DEV) return false
  try {
    if (/[?&]soccer=1\b/.test(location.search)) localStorage.setItem('bap_soccer_dev', '1')
    if (/[?&]soccer=0\b/.test(location.search)) localStorage.removeItem('bap_soccer_dev')
    return localStorage.getItem('bap_soccer_dev') === '1'
  } catch { return /[?&]soccer=1\b/.test(location.search) }
})()
export const SOCCER_LIVE = false || SOCCER_DEV
// While it's off, soccer still sits on Home's sport switch: /soccer opens its Home as it is, under a COMING SOON
// board (components/SoccerComingSoon.jsx), and nothing on it can be played. (The owner, 11-08: "show soccer as it
// is now but with a coming soon over it")
export const SOCCER_SOON = !SOCCER_LIVE
