// ── CBB_LIVE: the one switch for everything players can see about College Basketball ──
// false: the mode is wired (its data, sim, build and season screens, Career's Start in College for guards and
// bigs) but nothing about it renders: no COLLEGE BASKETBALL card in basketball's MORE WAYS TO PLAY, no START IN
// COLLEGE on a new basketball career, and the mode can't be opened.
// Flip to true to ship it. On the dev server only, ?cbb=1 in the address turns it on for testing.
// (its own tiny file so Home can read it without loading the college rosters)
const CBB_DEV = typeof location !== 'undefined' && !!import.meta.env?.DEV && /[?&]cbb=1\b/.test(location.search)
export const CBB_LIVE = false || CBB_DEV   // built Nov 12; the owner flips it

// the schools on Home's card: their logos only, never the rosters (a school College Football has keeps its file there)
export const CBB_CARD_LOGOS = ['/logos/cfb/DUKE.png', '/logos/cfb/KAN.png', '/logos/cfb/UKY.png', '/logos/cfb/CONN.png', '/logos/cbb/GONZ.png']
