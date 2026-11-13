// ── FRANCHISE_LIVE: the one switch for everything players can see about Franchise ──────────
// Franchise (football): take over an NFL team as its general manager, build the players you want on the game's
// own build screen, and run it season after season (components/franchise, lib/franchise).
// false: the mode is wired but nothing about it renders: football's Home keeps its SQUAD BUILDER card and the
// mode can't be opened. true: a FRANCHISE card takes SQUAD BUILDER's place on football's Home (both home looks).
// Squad Builder itself is untouched for the other sports, and its football saves are never deleted.
// Flip to true to ship it. On the dev server only, ?franchise=1 in the address turns it on for testing.
// (its own tiny file so Home can read it without loading the mode, its engine or its art)
// (the switch sticks on this browser: ?franchise=1 once turns it on until ?franchise=0, so it survives refreshes
// and moving between pages. Dev server only: it is always off in the production build)
const FRANCHISE_DEV = (() => {
  if (typeof location === 'undefined' || !import.meta.env?.DEV) return false
  try {
    if (/[?&]franchise=1\b/.test(location.search)) localStorage.setItem('bap_franchise_dev', '1')
    if (/[?&]franchise=0\b/.test(location.search)) localStorage.removeItem('bap_franchise_dev')
    return localStorage.getItem('bap_franchise_dev') === '1'
  } catch { return /[?&]franchise=1\b/.test(location.search) }
})()
export const FRANCHISE_LIVE = false || FRANCHISE_DEV   // off until the owner flips it

// What Home's card says about the franchise on this device, without loading the mode: the mode leaves this
// small note every time it saves (components/franchise/frStore.js)
//   { team: 'KC', color: '#E31837', rows: [['KC', '3-1'], ['WEEK', '5'], ['NEXT', '@ BUF']] }
export const FRANCHISE_CARD_KEY = 'bap_franchise_card'
export const franchiseCard = () => { try { const c = JSON.parse(localStorage.getItem(FRANCHISE_CARD_KEY)); return c && Array.isArray(c.rows) ? c : null } catch { return null } }

// The mode's art (public/franchise/art/, made with the trophy scene): the picture on Home's card and the hero on
// the New Franchise screen. null: the file isn't there yet, and its box isn't drawn
export const FRANCHISE_ART = { card: null, hero: null }
