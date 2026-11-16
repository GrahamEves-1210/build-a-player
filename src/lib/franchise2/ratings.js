// FRANCHISE: the team ratings. OFFENSE and DEFENSE on the same scale as a player's OVR, and the TEAM OVR made of
// the two (owner, 11-15: "team OVR doesn't vary enough, it's all 80-85", "I don't know if the off/def grade reflects
// the overall"). What the screens show is what the games play: the sim's 1-12 ratings ARE these two numbers.
//
//   teamRating(team, L, ce)  { ovr, off, def }  the numbers on screen (off / def 40-99; ovr = the two's average)
//   toSim(v)                 a side's number on the football sim's 1-12 scale (6 + (v - 80) / 2.8)
//   lastSeasonRes(short, r)  year one's carry-over from the real 2025 season (league.js calibrate)
//   The letter for OFFENSE / DEFENSE is league.js gradeOf: the same letters (and numbers) a player's OVR uses.
//
// HOW A SIDE IS RATED
// 1. The men who play it, weighted the way the NFL pays and values the spots (the cap's top deals and what a spot
//    moves in a team's points): the quarterback most by far, then the pass rush, the tackles, the corners, the
//    receivers, the interior line, and least the back, the linebackers and the safeties. The starters, and the key
//    depth who play real snaps every week (the nickel corner, the third edge and tackle in the rotation, the RB2 in a
//    committee, WR4, TE2). An empty slot (a room run dry) counts as a man off the street.
// 2. Stretched around the league's middle so 32 rosters read like a real football game's team ratings: the best in
//    the high 80s to 90s, a real middle near 80, the worst in the low-to-mid 70s. Offense spreads wider than defense
//    (the NFL's: offenses differ more, and more lastingly, than defenses). The centre and stretch are fixed numbers
//    fitted once to the 2026 rosters, not re-fitted each year: a league that gets better or worse shows it.
// 3. The play-caller (coach.js coachEdge, the side's sim edge) in rating points: a great caller is worth 2-3.
// 4. Year one only: a share of the real 2025 season (points scored and allowed), the way a preseason power rating
//    carries last year in. It fades every offseason (offseason.js: x 0.6 a year) and the rosters take over.
// OVR = (OFFENSE + DEFENSE) / 2. The kicker isn't in it: his kicks are played in the game itself (game.js fgChance).
//
// WIN ODDS: the games read toSim of the two numbers. The sim is about 1.5 points of margin a point of edge (the
// offense's sim rating minus the defense's), so 10 points of OVR is 20 of the two sides = 7.1 of edge = a 10-point
// line on game day; over a season (the OVR at kickoff of Week 1 against every game played, injuries and all) a
// 10-point gap plays as about a 9-point favourite (the NFL's 7-10), and the 32 teams' win totals spread close to
// the NFL's (sd about 2.9 against the real 3.1; three teams a year at 13 wins or more, two or three at 4 or fewer).
// (scripts/franchise2/team-ratings.mjs measures all of it.)
import { startersOfTeam, benchOfTeam, groupOf, GROUP } from './roster'

// ── The weights ──────────────────────────────────────────────────────────────
// (ol1..5 stand LT LG C RG RT; the depth slots are the rotation's first man behind the starters)
export const W_OFF = {
  qb1: 0.36,
  ol1: 0.075, ol5: 0.06, ol3: 0.05, ol2: 0.045, ol4: 0.045,
  wr1: 0.10, wr2: 0.07, wr3: 0.04, wr4: 0.01,
  te1: 0.05, te2: 0.01,
  rb1: 0.04, rb2: 0.015,
}
export const W_DEF = {
  edge1: 0.16, edge2: 0.11, edge3: 0.03,
  dt1: 0.10, dt2: 0.07, dt3: 0.02,
  cb1: 0.12, cb2: 0.09, cb3: 0.06,
  s1: 0.06, s2: 0.045,
  lb1: 0.065, lb2: 0.045, lb3: 0.02,
}
const REPL = 60   // (a man off the street)
// the league's middle and the stretch (fitted to 2026's rosters: scripts/franchise2/team-ratings.mjs)
export const CENTER = { off: 82.6, def: 81.8 }, STRETCH = { off: 1.9, def: 2.4 }
export const MID = 80        // the league's middle team on screen
export const SIM_PER = 2.8   // rating points a point of the sim's 1-12

// ── A team ───────────────────────────────────────────────────────────────────
// every slot that counts: the starting 22 and the depth behind them (rb2 wr4 te2 edge3 dt3 cb3)
export function slotsOf(team, L = startersOfTeam(team)) {
  const out = { ...L }, n = {}
  for (const p of benchOfTeam(team, L)) { const k = groupOf(p); n[k] = (n[k] ?? GROUP[k].n) + 1; out[`${k}${n[k]}`] ??= p }
  return out
}
const sideOf = (S, W) => { let a = 0, w = 0; for (const [k, x] of Object.entries(W)) { a += (S[k]?.o ?? REPL) * x; w += x } return a / w }
// the weighted OVR of the men on each side, before the stretch
export function rawRating(team, L) {
  const S = slotsOf(team, L)
  return { off: sideOf(S, W_OFF), def: sideOf(S, W_DEF) }
}
// the roster's number for a side (steps 1-2)
export const rosterSide = (raw, k) => MID + (raw - CENTER[k]) * STRETCH[k]
const clip = v => Math.max(40, Math.min(99, v))
// ce: the play-callers' edge on the sim's scale ({ off, def }, coach.js coachEdge)
export function teamRating(team, L, ce = null) {
  const raw = rawRating(team, L), res = team.res ?? [0, 0]
  const off = Math.round(clip(rosterSide(raw.off, 'off') + (ce?.off ?? 0) * SIM_PER + (res[0] ?? 0)))
  const def = Math.round(clip(rosterSide(raw.def, 'def') + (ce?.def ?? 0) * SIM_PER + (res[1] ?? 0)))
  return { ovr: Math.round((off + def) / 2), off, def }
}
export const toSim = v => Math.max(1, Math.min(12, 6 + (v - MID) / SIM_PER))
export const fromSim = s => MID + (s - 6) * SIM_PER

// ── Year one: the real 2025 season ───────────────────────────────────────────
// [W, L, T, points for, points against] (the final regular-season standings)
export const SEASON_2025 = {
  NE: [14, 3, 0, 490, 320], BUF: [12, 5, 0, 481, 365], MIA: [7, 10, 0, 347, 424], NYJ: [3, 14, 0, 300, 503],
  PIT: [10, 7, 0, 397, 387], BAL: [8, 9, 0, 424, 398], CIN: [6, 11, 0, 414, 492], CLE: [5, 12, 0, 279, 379],
  JAX: [13, 4, 0, 474, 336], HOU: [12, 5, 0, 404, 295], IND: [8, 9, 0, 466, 412], TEN: [3, 14, 0, 284, 478],
  DEN: [14, 3, 0, 401, 311], LAC: [11, 6, 0, 368, 340], KC: [6, 11, 0, 362, 328], LV: [3, 14, 0, 241, 432],
  PHI: [11, 6, 0, 379, 325], DAL: [7, 9, 1, 471, 511], WAS: [5, 12, 0, 356, 451], NYG: [4, 13, 0, 381, 439],
  CHI: [11, 6, 0, 441, 415], GB: [9, 7, 1, 391, 360], MIN: [9, 8, 0, 344, 333], DET: [9, 8, 0, 481, 413],
  CAR: [8, 9, 0, 311, 380], TB: [8, 9, 0, 380, 411], ATL: [8, 9, 0, 353, 401], NO: [6, 11, 0, 306, 383],
  SEA: [14, 3, 0, 483, 292], LAR: [12, 5, 0, 518, 346], SF: [12, 5, 0, 437, 371], ARI: [3, 14, 0, 355, 488],
}
// The live 2026 season so far: [W, L, T, points for, points against] (ESPN standings, through week 10, 2026-11-16).
// Year one leans a little toward it as well (owner 11-16: "steer closer", nothing drastic; player ratings untouched)
export const SEASON_2026 = {
  NE: [5, 5, 0, 221, 242], BUF: [8, 1, 0, 287, 199], MIA: [1, 8, 0, 148, 224], NYJ: [2, 8, 0, 194, 254],
  PIT: [6, 3, 0, 198, 182], BAL: [4, 5, 0, 189, 236], CIN: [7, 2, 0, 278, 193], CLE: [6, 4, 0, 188, 220],
  JAX: [7, 2, 0, 269, 144], HOU: [3, 6, 0, 233, 219], IND: [3, 7, 0, 208, 271], TEN: [1, 8, 0, 167, 239],
  DEN: [7, 2, 0, 198, 186], LAC: [0, 8, 0, 121, 219], KC: [7, 2, 0, 237, 156], LV: [4, 6, 0, 251, 289],
  PHI: [2, 7, 0, 148, 221], DAL: [4, 6, 0, 286, 282], WAS: [3, 5, 1, 196, 223], NYG: [5, 3, 1, 203, 196],
  CHI: [7, 2, 0, 241, 184], GB: [6, 4, 0, 226, 221], MIN: [7, 2, 0, 176, 126], DET: [7, 2, 0, 257, 199],
  CAR: [4, 5, 0, 219, 236], TB: [3, 6, 0, 202, 178], ATL: [3, 7, 0, 201, 258], NO: [3, 6, 0, 202, 236],
  SEA: [6, 4, 0, 223, 175], LAR: [6, 4, 0, 248, 187], SF: [8, 1, 0, 281, 196], ARI: [3, 7, 0, 184, 289],
}
const PPG = Object.values(SEASON_2025).reduce((a, r) => a + r[3], 0) / 32 / 17   // (the league's points a game, 23.4)
const PTS_PER = 1.48 / SIM_PER   // points a game a rating point moves (the sim: 1.48 a point of edge)
// how much of last season a preseason rating carries (last year's points regress about halfway to the middle)
export const CARRY = 0.3   // (0.25 before the live 2026 season came in: a nudge, not a copy)
// what the season's points say a side was, in rating points
// (points a game: last season's blended with the live 2026 season, the live one weighted by the games it has, g / (g + 6):
// about 60% after nine games; the league average stays last season's so the scale doesn't move)
const perGame = (short, i) => {
  const a = SEASON_2025[short], b = SEASON_2026[short]
  if (!a) return null
  const g = b ? b[0] + b[1] + b[2] : 0, w = g ? g / (g + 6) : 0
  return (1 - w) * a[i] / 17 + (g ? w * b[i] / g : 0)
}
export const seasonSide = (short, k) => { const v = perGame(short, k === 'off' ? 3 : 4); return v == null ? null : MID + (k === 'off' ? v - PPG : PPG - v) / PTS_PER }
// year one's carry-over for a team: a share of the gap between what its 2025 season said and what its men add up to
// (the roster's number with its play-callers in: r = teamRating without res)
export function lastSeasonRes(short, r) {
  const o = seasonSide(short, 'off'), d = seasonSide(short, 'def')
  if (o == null) return [0, 0]
  return [Math.round(CARRY * (o - r.off) * 10) / 10, Math.round(CARRY * (d - r.def) * 10) / 10]
}
