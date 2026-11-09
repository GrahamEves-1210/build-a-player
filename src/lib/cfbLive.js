// ── CFB_LIVE: the one switch for everything players can see about College Football ──
// false: the mode is wired (its data, sim, build and season screens) but nothing about it renders:
// no COLLEGE FOOTBALL card in football's MORE WAYS TO PLAY, and the mode can't be opened.
// Flip to true to ship it. On the dev server only, ?cfb=1 in the address turns it on for testing.
// (its own tiny file so Home can read it without loading the college rosters)
const CFB_DEV = typeof location !== 'undefined' && !!import.meta.env?.DEV && /[?&]cfb=1\b/.test(location.search)
export const CFB_LIVE = true || CFB_DEV   // (ships in the Nov 10 update)

// the schools on Home's card: their logos only (public/logos/cfb/{short}.png), never the rosters
export const CFB_CARD_SCHOOLS = ['UGA', 'OSU', 'TEX', 'ORE', 'NDAM']
