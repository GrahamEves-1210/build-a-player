// BASKETBALL FRANCHISE: what the setup shows before the franchise exists (NbaSetup.jsx, NbaBuilds.jsx).
//   lastSeason(short)   each team's real 2025-26 season, for the team card (football's lib/franchise2/lastSeason.js)
//   setupLeague(S)      the league this setup will tip off with: the seed, the team and the rules createNbaFranchise
//                       builds from, so the made-up men at the end of each bench carry the names they will have
//   buildWaives(S)      who a full roster waives for each of the GM's builds, as placeBuilds will (builds.js)
// Checked by scripts/franchise2/nba-setup.mjs.
import { FIRST_YEAR, buildTeams, DIV_OF } from './league'
import { waiveFor } from './builds'
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
