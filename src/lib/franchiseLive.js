// ── FRANCHISE_LIVE: the one switch for everything players can see about Franchise ──────────
// Franchise (football): take over an NFL team as its general manager, build the players you want on the game's
// own build screen, and run it season after season (components/franchise2, lib/franchise2).
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
export const FRANCHISE_LIVE = true || FRANCHISE_DEV   // on (the owner, 2026-11-14)

// What Home's card says about the franchise on this device, without loading the mode: the mode leaves this
// small note every time it saves (components/franchise2/FranchiseMode.jsx leaveNote)
//   { slot: 0, team: 'KC', color: '#E31837', line: 'Chiefs 3-1 · Week 5' }   (the team, its record, where the season is)
export const FRANCHISE_CARD_KEY = 'bap_franchise_card'
export const franchiseCard = () => { try { const c = JSON.parse(localStorage.getItem(FRANCHISE_CARD_KEY)); return c && typeof c.line === 'string' && c.line ? c : null } catch { return null } }

// The mode's art (public/franchise/art/, made with the trophy scene: the championship trophy on the mode's own
// near-black): the picture on Home's card (the trophy's football alone, zoomed in, 3:2) and the hero on the mode's
// first screen. (null: no picture, no box)
export const FRANCHISE_ART = { card: '/franchise/art/football-card.webp', hero: '/franchise/art/football-card.webp' }   // (the save screen: the football, owner 11-18)
// ...and each one turning, slowly (components/franchise2/TrophyTurn.jsx: .mp4, or .webm where H.264 can't play). The
// card's is the football taken from the trophy, zoomed in and spinning about its long axis like a slow spiral (owner
// 11-15), 5 s a turn, its first frame the card's still; the hero's is the whole trophy turning, the middle of the
// 16:9 still. (null: the still only)
export const FRANCHISE_TURN = { card: '/franchise/art/football-card-turn', hero: '/franchise/art/football-card-turn' }

// ── NBA_FRANCHISE_LIVE: basketball Franchise (components/franchise2/nba, lib/franchise2/nba) ────────────────────────
// false: nothing about it renders; basketball's Home is as it was. true: a FRANCHISE card on basketball's Home.
// On the dev server only, ?nbafranchise=1 turns it on for testing (it sticks on this browser until ?nbafranchise=0).
const NBA_FRANCHISE_DEV = (() => {
  if (typeof location === 'undefined' || !import.meta.env?.DEV) return false
  try {
    if (/[?&]nbafranchise=1\b/.test(location.search)) localStorage.setItem('bap_frnba_dev', '1')
    if (/[?&]nbafranchise=0\b/.test(location.search)) localStorage.removeItem('bap_frnba_dev')
    return localStorage.getItem('bap_frnba_dev') === '1'
  } catch { return /[?&]nbafranchise=1\b/.test(location.search) }
})()
export const NBA_FRANCHISE_LIVE = false || NBA_FRANCHISE_DEV
// Home's card note, the same shape as football's (components/franchise2/nba/NbaFranchise.jsx leaveNote)
export const NBA_FRANCHISE_CARD_KEY = 'bap_frnba_card'
export const nbaFranchiseCard = () => { try { const c = JSON.parse(localStorage.getItem(NBA_FRANCHISE_CARD_KEY)); return c && typeof c.line === 'string' && c.line ? c : null } catch { return null } }
