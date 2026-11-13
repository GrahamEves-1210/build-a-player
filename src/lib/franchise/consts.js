// FRANCHISE: the league's fixed numbers. Engine notes live here: roster limits, the cap, the calendar.

export const SAVE_VERSION = 1
export const FIRST_YEAR = 2026

// ── Positions ────────────────────────────────────────────────────────────────
// pos: the game's nine position groups (the build screen's). spot: where a man lines up, the depth chart's slots.
export const POS = ['qb', 'rb', 'wr', 'te', 'ol', 'dl', 'lb', 'db', 'k']
export const POS_LABEL = { qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', ol: 'OL', dl: 'DL', lb: 'LB', db: 'DB', k: 'K' }
export const OL_SPOTS = ['LT', 'LG', 'C', 'RG', 'RT']
// every depth-chart slot, in the order a depth chart reads; n: how many start
export const SLOTS = [
  { slot: 'QB', pos: 'qb', n: 1, name: 'Quarterback', side: 'off' },
  { slot: 'RB', pos: 'rb', n: 1, name: 'Running Back', side: 'off' },
  { slot: 'WR', pos: 'wr', n: 3, name: 'Wide Receiver', side: 'off' },
  { slot: 'TE', pos: 'te', n: 1, name: 'Tight End', side: 'off' },
  { slot: 'LT', pos: 'ol', n: 1, name: 'Left Tackle', side: 'off' },
  { slot: 'LG', pos: 'ol', n: 1, name: 'Left Guard', side: 'off' },
  { slot: 'C', pos: 'ol', n: 1, name: 'Center', side: 'off' },
  { slot: 'RG', pos: 'ol', n: 1, name: 'Right Guard', side: 'off' },
  { slot: 'RT', pos: 'ol', n: 1, name: 'Right Tackle', side: 'off' },
  { slot: 'EDGE', pos: 'dl', n: 2, name: 'Edge Rusher', side: 'def' },
  { slot: 'DT', pos: 'dl', n: 2, name: 'Defensive Tackle', side: 'def' },
  { slot: 'LB', pos: 'lb', n: 3, name: 'Linebacker', side: 'def' },
  { slot: 'CB', pos: 'db', n: 2, name: 'Cornerback', side: 'def' },
  { slot: 'S', pos: 'db', n: 2, name: 'Safety', side: 'def' },
  { slot: 'K', pos: 'k', n: 1, name: 'Kicker', side: 'st' },
  { slot: 'KR', pos: null, n: 1, name: 'Kick Returner', side: 'st' },
]
export const SLOT_BY = Object.fromEntries(SLOTS.map(s => [s.slot, s]))
// a man's own slot from his position and sub-position
export const slotOf = p => (p.pos === 'ol' ? p.sub : p.pos === 'dl' ? (p.sub === 'dt' ? 'DT' : 'EDGE') : p.pos === 'db' ? (p.sub === 's' ? 'S' : 'CB') : POS_LABEL[p.pos])
// roster groups: what a roster is counted in (position minimums, the build at league start, team needs)
export const GROUPS = ['QB', 'RB', 'WR', 'TE', 'OL', 'EDGE', 'DT', 'LB', 'CB', 'S', 'K']
export const groupOf = p => (p.pos === 'ol' ? 'OL' : slotOf(p))

// ── Roster limits (the engine's rules) ───────────────────────────────────────
// In season a team carries 40 to 46 active players; men on injured reserve do not count. From the end of the
// season to the cut at the end of camp the limit is 62 (re-signings, free agents, the draft class, undrafted
// signings). A legal roster also has at least MIN_AT healthy-or-not bodies in every group, so injuries, cuts
// and the draft always have someone behind the starter.
export const ROSTER_MAX = 46
export const ROSTER_MIN = 40
export const CAMP_MAX = 62
export const MIN_AT = { QB: 2, RB: 3, WR: 5, TE: 2, OL: 7, EDGE: 3, DT: 3, LB: 4, CB: 3, S: 3, K: 1 }
// what a full 46 looks like (league build and the CPU's cut-down aim at this)
export const TARGET_AT = { QB: 3, RB: 4, WR: 6, TE: 3, OL: 8, EDGE: 4, DT: 4, LB: 5, CB: 4, S: 4, K: 1 }
// how many the user may build at each position: Squad Builder's caps (lib/squad.js CAPS.nfl), and the kicker
export const BUILD_CAPS = { qb: 1, rb: 2, wr: 3, te: 2, db: 4, dl: 4, lb: 3, ol: 5, k: 1 }

// ── Money ────────────────────────────────────────────────────────────────────
// All money is in millions of dollars, to two places. The 2026 cap is the league's real figure; it grows 5-8% a year.
export const CAP_2026 = 301.2
export const MIN_SALARY = 0.9          // a rookie or street free agent
export const VET_MIN = 1.25            // three or more seasons in the league
// the top of each market, as a share of the cap (a top quarterback is about a fifth of it)
export const TOP_SHARE = { QB: 0.205, EDGE: 0.135, WR: 0.13, DT: 0.1, LT: 0.095, RT: 0.085, CB: 0.098, LG: 0.07, RG: 0.07, C: 0.06, S: 0.07, LB: 0.068, TE: 0.063, RB: 0.066, K: 0.022 }

// ── Calendar ─────────────────────────────────────────────────────────────────
export const REG_WEEKS = 18            // 17 games and a bye
export const TRADE_DEADLINE = 9        // trades close after Week 9's games
export const PLAYOFF_ROUNDS = [
  { week: 19, id: 'wc', name: 'Wild Card' },
  { week: 20, id: 'div', name: 'Divisional Round' },
  { week: 21, id: 'conf', name: 'Conference Championship' },
  { week: 22, id: 'sb', name: 'Super Bowl' },
]
export const weekLabel = w => (w <= REG_WEEKS ? `WEEK ${w}` : (PLAYOFF_ROUNDS.find(r => r.week === w)?.name ?? '').toUpperCase())
// the offseason's stages, in order
export const STAGES = [
  { id: 'review', name: 'Season Review' },
  { id: 'staff', name: 'Coaching Staff' },
  { id: 'resign', name: 'Re-Sign Players' },
  { id: 'fa', name: 'Free Agency' },
  { id: 'draft', name: 'The Draft' },
  { id: 'udfa', name: 'Undrafted Free Agents' },
  { id: 'camp', name: 'Training Camp' },
  { id: 'cuts', name: 'Final Cuts' },
]

// ── Development ──────────────────────────────────────────────────────────────
export const DEV = ['NORMAL', 'STAR', 'SUPERSTAR', 'ELITE']
export const DEV_RATE = [1, 1.3, 1.65, 2.05]      // how fast each tier earns XP
export const DRIVES = ['MONEY', 'RING', 'ROLE', 'LOYAL', 'MENTOR', 'COMPETITOR']
export const DRIVE_TEXT = {
  MONEY: 'Wants to be paid what he is worth',
  RING: 'Wants to win a championship',
  ROLE: 'Wants to start and get the ball',
  LOYAL: 'Wants to stay where he is',
  MENTOR: 'Takes pride in bringing young players along',
  COMPETITOR: 'Hates losing more than he likes winning',
}

// ── Settings (stored in the save) ────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  moments: true,        // PLAY THE MOMENTS: the user's game stops at its biggest plays
  calls: true,          // coach's calls: 4th downs and two-point tries (same toggle family as moments)
  injuries: true,
  cap: true,            // the salary cap is enforced
  autoUpgrade: false,   // the staff spends upgrade points
  autoDepth: true,      // the staff sets the depth chart every week
  autoRoster: true,     // the staff signs a body when the roster is short at a position
  tradeAI: 'fair',      // 'easy' | 'fair' | 'hard': how much the CPU wants back
  firing: true,         // the owner can fire the coach
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
export const r1 = v => Math.round(v * 10) / 10
export const r2 = v => Math.round(v * 100) / 100
export const GRADES = ['F', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S']
export const gradeOf = v => GRADES[clamp(Math.round(v), 0, 11)]
// an OVR as a letter (Career's scale: 60 is an F, every 3.5 points a grade)
export const ovrGrade = ovr => gradeOf(clamp((ovr - 60) / 3.5, 0, 11))
