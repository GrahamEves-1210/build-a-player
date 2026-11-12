// ── CBB_LIVE: the one switch for everything players can see about College Basketball ──
// false: the mode is wired (its data, sim, build and season screens, Career's Start in College for guards and
// bigs) but nothing about it renders: no COLLEGE BASKETBALL card in basketball's MORE WAYS TO PLAY, no START IN
// COLLEGE on a new basketball career, and the mode can't be opened.
// Flip to true to ship it. On the dev server only, ?cbb=1 in the address turns it on for testing.
// (its own tiny file so Home can read it without loading the college rosters)
const CBB_DEV = typeof location !== 'undefined' && !!import.meta.env?.DEV && /[?&]cbb=1\b/.test(location.search)
export const CBB_LIVE = true || CBB_DEV   // on 2026-11-12 (the owner); live site needs supabase/cbb_mode.sql run

// the schools on Home's card: their logos only, never the rosters (a school College Football has keeps its file there)
export const CBB_CARD_LOGOS = ['/logos/cfb/DUKE.png', '/logos/cfb/KAN.png', '/logos/cfb/UKY.png', '/logos/cfb/CONN.png', '/logos/cbb/GONZ.png']

// The patch-note section for the update that turns College Basketball on. It is NOT in the notes (lib/whatsNew.js
// lists only what's live): when the switch flips, add this object to that update's `sections`.
export const CBB_PATCH_NOTES = {
  name: 'New Mode: College Basketball',
  items: [
    'Added College Basketball: spin a conference, then one of its starters',
    'Guards and bigs, with 146 schools in eleven conferences and their real 2026-27 players',
    'All-Time pool: flip the switch on the first screen and the wheels deal each school\'s legends (Duke: Laettner, Hill and Zion; UCLA: Alcindor and Walton)',
    'Pick your school from scholarship offers: your stars, national rank and the 10 schools offering you',
    'Name your player and pick a class: freshman, sophomore, junior or senior',
    'A full season against real opponents with the AP Top 25 every week',
    'Conference tournaments, Selection Sunday and the 68-team NCAA Tournament, with your games live on the scoreboard',
    'The bracket fills in region by region as you play',
    'Wooden Award ceremony with the five finalists and the vote, the Naismith, position awards and three All-America teams',
    'Draft stock after every season: a scouting report with the projected pick, what scouts like and question, and the board at your position',
    'Enter the NBA Draft after any season, return to school, or transfer through the portal',
    'Each season earns 1 to 3 upgrade points to spend on your traits in the offseason',
    'Enter the NBA Draft turns a college build into a Career, and the college draft stock sets where he goes in the draft',
    'Every trait drops two grades on the jump to the NBA (A+ to A-, B to C+), except Size',
    'Added Start in College for guard and big careers',
    'Sandbox works in College Basketball too (a 5,000-coin unlock)',
  ],
}
