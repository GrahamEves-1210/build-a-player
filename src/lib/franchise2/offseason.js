// FRANCHISE: the offseason, four quick stops, then a new season.
//   1 AWARDS   the NFL's awards and All-Pros (awards.js); then the league ages a year (aging.js)
//   2 RE-SIGN  the player's men whose deals are up: keep at the market's price, or let go (market.js)
//   3 FREE AGENCY  three days of bidding against the league, under the cap (market.js, contracts.js)
//   4 THE DRAFT    the class scouted all season, the combine, seven rounds in the real order (draft.js)
// The draft class is made when the season starts so it can be scouted while it's played.
import { TEAM, SHORTS, POS, OFFENSE, MIN, POS_LABEL, lineup, strength, worth, yearsFor, payroll, trim, fillUp, makeGen, fakeName, gradeIdx, GRADES, gradeFloor, FIRST_YEAR } from './league'
import { makeSchedule, DIVISIONS } from './schedule'
import { standings, finishOf } from './standings'
import { rngOf, clamp, r1 } from './rng'
import { fbCase, honorsOf } from '../teamSeason'
import { ovrOf, TYPES_OF } from '../squadSeason'
import { makeClass } from './draft'

// (1 awards: awards.js · the league ages: aging.js · 2 re-sign and 3 free agency: market.js · the cap: contracts.js)

// (4 the draft, and the class scouted during the season: draft.js)

// ── A new season ─────────────────────────────────────────────────────────────
export function newSeason(F) {
  const R = rngOf(`${F.seed}-${F.year}-newyear`)
  const before = new Set(F.lastStarters ?? [])
  F.dc = []; F.dr = null; F.offers = null; F.rs = null; F.fa = []
  for (const s of SHORTS) {
    const t = F.teams[s]
    // (this year's picks from the first four rounds make the team; the cuts come from the men at the bottom)
    const { roster } = trim(t.r, new Set(t.r.filter(p => p.rk === F.year + 1 && (p.dr?.[0] ?? 7) <= 4).map(p => p.i)))
    t.r = fillUp(F, roster, R)
    for (const p of t.r) { if (p.y <= 0) { p.$ = worth(p); p.y = yearsFor(p) } }
    t.res = (t.res ?? [0, 0]).map(v => r1(v * 0.6))
    if (s !== F.team) t.lk = {}
  }
  // the schedule follows last season's finish in each division
  const S = standings(F)
  F.year++
  F.sched = makeSchedule(F.seed, F.year, S.div)
  F.wk = 0; F.log = []; F.ss = {}; F.ssr = null; F.po = null; F.moments = 0; F.streak = 0; F.nx = 0; F.ev = null; F.nextEv = 3; F.evSeen = []
  F.phase = 'season'; F.stage = null; F.aging = null
  // chemistry: a core that stays together grows; many new starters set it back. Hype cools toward the middle.
  const now = Object.values(lineup(F.teams[F.team])).map(p => p.i)
  const changed = now.filter(i => !before.has(i)).length
  F.chem = clamp(5, 100, Math.round(F.chem * 0.8 + 18 - changed * 1.6))
  F.hype = clamp(0, 100, Math.round(F.hype * 0.75 + 12.5))
  F.lastStarters = now
  F.sp = 3
  F.board = []
  makeClass(F)
}
export { POS_LABEL, FIRST_YEAR }
