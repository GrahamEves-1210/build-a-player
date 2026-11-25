// BASKETBALL FRANCHISE: what the setup shows before the franchise exists (NbaSetup.jsx, NbaBuilds.jsx).
//   lastSeason(short)   each team's real 2025-26 season, for the team card (football's lib/franchise2/lastSeason.js)
//   setupLeague(S)      the league this setup will tip off with: the seed, the team and the rules createNbaFranchise
//                       builds from, so the made-up men at the end of each bench carry the names they will have
//   buildWaives(S)      who a full roster waives for each of the GM's builds, as placeBuilds will (builds.js)
//   setupStarters(S)    the team's starting five by spot, { PG: man, ... }: the man each build replaces (rotation.js)
//   fixSetup(S)         a setup saved before 2026-11-25 in today's shape (null when it already is)
// Checked by scripts/franchise2/nba-setup.mjs.
import { FIRST_YEAR, buildTeams, DIV_OF, SPOTS, groupOfSpot, ovrOfAttrs } from './league'
import { waiveFor, buildSpot, attrsOfBuild } from './builds'
import { spotFive, dressed } from './rotation'
import { styleOf } from './coach'
import * as X from './seams'

// ── Last season ──────────────────────────────────────────────────────────────
// Final 2025-26 regular-season records and how each team's season ended (en.wikipedia.org "2025-26 NBA season" and
// "2026 NBA playoffs", and basketball-reference.com/playoffs/NBA_2026.html, read 2026-11-24). New York beat
// San Antonio 4-1 in the Finals.
//   [wins, losses, how it ended, division champions]
export const LAST_YEAR = 2025
const R = {
  DET: [60, 22, 'LOST EAST SEMIFINALS', 1], BOS: [56, 26, 'LOST FIRST ROUND', 1], NYK: [53, 29, 'WON NBA FINALS'], CLE: [52, 30, 'LOST EAST FINALS'],
  TOR: [46, 36, 'LOST FIRST ROUND'], ATL: [46, 36, 'LOST FIRST ROUND', 1], PHI: [45, 37, 'LOST EAST SEMIFINALS'], ORL: [45, 37, 'LOST FIRST ROUND'],
  CHA: [44, 38, 'LOST IN THE PLAY-IN'], MIA: [43, 39, 'LOST IN THE PLAY-IN'], MIL: [32, 50], CHI: [31, 51], BKN: [20, 62], IND: [19, 63], WAS: [17, 65],
  OKC: [64, 18, 'LOST WEST FINALS', 1], SAS: [62, 20, 'LOST NBA FINALS', 1], DEN: [54, 28, 'LOST FIRST ROUND'], LAL: [53, 29, 'LOST WEST SEMIFINALS', 1],
  HOU: [52, 30, 'LOST FIRST ROUND'], MIN: [49, 33, 'LOST WEST SEMIFINALS'], PHX: [45, 37, 'LOST FIRST ROUND'], POR: [42, 40, 'LOST FIRST ROUND'],
  LAC: [42, 40, 'LOST IN THE PLAY-IN'], GSW: [37, 45, 'LOST IN THE PLAY-IN'], NOP: [26, 56], DAL: [26, 56], MEM: [25, 57], SAC: [22, 60], UTA: [22, 60],
}
// { year, season: '2025-26', w, l, rec: '60-22', end: 'WON NBA FINALS' | 'MISSED THE PLAYOFFS' | ..., div: 'CENTRAL' | null, champ }
export function lastSeason(short) {
  const x = R[short]
  if (!x) return null
  const [w, l, end, div] = x
  return { year: LAST_YEAR, season: `${LAST_YEAR}-${String(LAST_YEAR + 1).slice(2)}`, w, l, rec: `${w}-${l}`, end: end ?? 'MISSED THE PLAYOFFS', div: div ? DIV_OF[short].toUpperCase() : null, champ: end === 'WON NBA FINALS' }
}

// ── The league the setup will start ──────────────────────────────────────────
// (one at a time: a setup has one seed; a change of team or rules builds it again, a few milliseconds)
let LG = null
export function setupLeague(S) {
  const k = `${S.seed}|${S.team}|${S.rules?.cap === false ? 0 : 1}${S.rules?.inj === false ? 0 : 1}`
  if (LG?.k !== k) {
    const F = { sport: 'nba', seed: S.seed, team: S.team, year: FIRST_YEAR, nid: 1, builds: [], phase: 'season' }
    if (S.rules?.cap === false) F.noCap = 1
    if (S.rules?.inj === false) F.noInj = 1
    buildTeams(F, { dealOnLoad: X.dealOnLoad })
    LG = { k, F }
  }
  return LG.F
}
// { [pick id]: the man waived for him } (a build with an open spot waiting has none). The builds go on in the order
// the setup holds them (S.picks: NbaFranchise start), each read off the roster the ones before him left.
export function buildWaives(S) {
  if (!S?.team || !S.seed) return {}
  const F = setupLeague(S), T = F.teams[S.team]
  const t = { ...T, r: [...T.r] }, out = {}
  for (const p of S.picks ?? []) {
    if (t.r.filter(x => !x.tw).length >= 15) { const m = waiveFor(F, t, p.pos); if (m) { out[p.id] = m; t.r = t.r.filter(x => x !== m) } }
    t.r.push({ i: -1, g: p.pos, b: 0 })
  }
  return out
}

// The starter at each spot: the coach's five on opening night (rotation.js spotFive, the men dressed, less the men a
// full roster waives for the builds: buildWaives), the man a build at that spot replaces in the five (planRotation's
// bst). He goes to the bench; he stays on the roster.
export function setupStarters(S) {
  if (!S?.team || !S.seed) return {}
  const F = setupLeague(S)
  const T = F.teams[S.team], gone = new Set(Object.values(buildWaives(S)).map(m => m.i))
  // (the builds on the roster as they'll be, so the men dressed are the opening night's: a two-way man suits up only
  // when the team is short; a build not built yet counts as a 70)
  const ovr = p => { const B = S.builds?.[p.id]; return B?.build ? ovrOfAttrs(p.pos, attrsOfBuild(p.pos, B.build)) : 70 }
  const r = [...T.r.filter(p => !gone.has(p.i)), ...(S.picks ?? []).map((p, k) => ({ i: -1 - k, b: k, g: p.pos, p: p.spot, o: ovr(p) }))]
  const five = spotFive(dressed({ ...T, r }, { year: F.year }).filter(p => p.b == null))
  return Object.fromEntries(SPOTS.map((k, j) => [k, five[j]]))
}

// A setup from before: PLAYERS by spot (PG..C, one each) where it had guards and bigs (a pick { id, pos } gets the
// spot his ratings read as, or the first open one in his group; one with no open spot in his group is dropped, his
// build with him), the coach's ROTATIONS line as CULTURE BUILDING, the old styles as football's (coach.js)
export function fixSetup(S) {
  if (!S) return null
  let out = S
  const picks = S.picks ?? []
  if (picks.some(p => !p.spot)) {
    const used = new Set(picks.filter(p => p.spot).map(p => p.spot)), keep = [], builds = { ...(S.builds ?? {}) }
    for (const p of picks) {
      if (p.spot) { keep.push(p); continue }
      const B = S.builds?.[p.id], g = p.pos === 'big' ? 'big' : 'guard'
      const want = B?.build ? buildSpot(g, attrsOfBuild(g, B.build)) : null
      const spot = want && !used.has(want) ? want : SPOTS.find(k => groupOfSpot(k) === g && !used.has(k))
      if (!spot) { delete builds[p.id]; continue }
      used.add(spot); keep.push({ ...p, pos: g, spot })
    }
    out = { ...out, picks: keep, builds }
  }
  const L = S.cb?.lines
  if (L?.rot && !L.cul) { const { rot, ...x } = L; out = { ...out, cb: { ...S.cb, lines: { ...x, cul: rot } } } }
  if (S.coach?.style && styleOf(S.coach.style) !== S.coach.style) out = { ...out, coach: { ...S.coach, style: styleOf(S.coach.style) } }
  return out === S ? null : out
}
