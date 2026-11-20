// FRANCHISE: the offseason, four quick stops, then a new season.
//   1 AWARDS   the NFL's awards and All-Pros (awards.js); then the league ages a year (aging.js)
//   2 RE-SIGN  the player's men whose deals are up: keep at the market's price, or let go (market.js)
//   3 FREE AGENCY  three days of bidding against the league, under the cap (market.js, contracts.js)
//   4 THE DRAFT    the class scouted all season, the combine, seven rounds in the real order (draft.js)
// The draft class is made when the season starts so it can be scouted while it's played.
import { TEAM, SHORTS, POS, OFFENSE, MIN, MAX, POS_LABEL, lineup, strength, worth, yearsFor, payroll, trim, fillUp, makeGen, fakeName, gradeIdx, GRADES, gradeFloor, FIRST_YEAR } from './league'
import { makeSchedule, DIVISIONS } from './schedule'
import { standings, finishOf } from './standings'
import { rngOf, clamp, r1 } from './rng'
import { fbCase, honorsOf } from '../teamSeason'
import { ovrOf, TYPES_OF } from '../squadSeason'
import { makeClass } from './draft'
import { leagueUnderCap, restructureMine } from './market'
import { signRookie, cutCost, cutMan, marketValue, termFor, capSheet, cutRoom, restructurable } from './contracts'
import { addNews } from './news'
import { sortChartAfterCamp, fixNumbers } from './roster'
import { clearLines } from './deals'

// (1 awards: awards.js · the league ages: aging.js · 2 re-sign and 3 free agency: market.js · the cap: contracts.js)

// (4 the draft, and the class scouted during the season: draft.js)

// ── A new season ─────────────────────────────────────────────────────────────
export function newSeason(F) {
  const R = rngOf(`${F.seed}-${F.year}-newyear`)
  const before = new Set(F.lastStarters ?? [])
  const released = []
  signUDFAs(F, R)
  F.dc = []; F.dr = null; F.offers = null; F.rs = null; F.fa = (F.fa ?? []).filter(p => p.cc)
  for (const s of SHORTS) {
    const t = F.teams[s]
    // the cuts to the roster: the men at the bottom go. The player's new class is his to cut, never the game's, and so
    // are his picks from the first four rounds while they're on their rookie deals; a late pick from an earlier class
    // competes for his job like anyone, and if camp cuts him he's released the way the wire sees it (2026-11-17: a
    // pick from two drafts ago was being dropped here without a word). The league's teams keep their picks from the
    // first four rounds and let the late ones compete.
    // (2026-11-19, players' reports: the cut-down was letting go of the player's free-agent signings and his veteran
    // starters, a whole offensive line once, with their dead money. His team is cut by him now, on the cut-down screen
    // (campCuts): the game keeps every man he has; only a made-up filler no room needs goes.)
    const mine = s === F.team
    const keep = t.r.filter(p => (mine ? !p.fl : p.rk === F.year + 1 && (p.dr?.[0] ?? 8) <= 4)).map(p => p.i)
    const { roster, cut } = trim(t.r, new Set(keep), { cpu: !mine })
    if (mine) {
      // (anyone the cut-down does let go from the player's team is released the way the wire and the cap see it:
      // his dead money on the books, a RELEASED line, and he's a free agent)
      for (const p of cut) if (!p.fl) { released.push(p); t.dead = [...(t.dead ?? []), ...(cutCost(p).dead > 0 ? [[p.n, cutCost(p).dead]] : [])] }
    }
    t.r = fillUp(F, roster, R)
    for (const p of t.r) { if (p.y <= 0) { p.$ = worth(p); p.y = yearsFor(p) } }
    t.res = (t.res ?? [0, 0]).map(v => r1(v * 0.6))
    if (s !== F.team) t.lk = {}
  }
  // the roster cuts and fill-ins done: every league team under the cap for the new season
  // (the men the player let go at the cut-down stay on the street for the season's signings)
  // (and the player's, by restructures, once his cut-down's dead money is on: the cut-down screen won't start the
  // season past what they clear)
  leagueUnderCap(F); restructureMine(F); F.fa = (F.fa ?? []).filter(p => p.cc); for (const p of F.fa) delete p.cc
  for (const p of released) { p.$ = marketValue(p, F.year + 1); p.y = termFor(p); p.g = 0; delete p.rc; delete p.op; delete p.ox; F.fa.push(p) }
  // the schedule follows last season's finish in each division
  const S = standings(F)
  F.year++
  F.sched = makeSchedule(F.seed, F.year, S.div)
  // (the season's kept lines start over: box.js; last season's are in the men's careers, awards.js)
  F.lg = {}; F.lgp = {}; F.wkl = null
  F.wk = 0; F.log = []; F.ss = {}; F.kst = {}; F.ssr = null; F.po = null; F.moments = 0; F.streak = 0; F.nx = 0; F.ev = null; F.nextEv = 3; F.evSeen = []
  for (const p of released) addNews(F, { k: 'cut', tag: 'RELEASED', s: F.team, text: `${TEAM[F.team].nick} release ${p.n}` })
  F.phase = 'season'; F.stage = null; F.aging = null
  // (the offseason's own lists go: the wire has moved on; the league's history keeps what lasts)
  F.fas = null; F.ext = null; F.gone = null; F.aw = null; F.fad = null
  F.talks = null; F.rsd = null; F.fao = null; F.far = null; clearLines(F)
  // camp's over: the player's chart set again by rating (last year's order was for last year's men), and every
  // newcomer's number settled before anyone sees it (roster.js)
  sortChartAfterCamp(F)
  for (const s of SHORTS) fixNumbers(F, s)
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
// Undrafted free agents: after the draft every league team signs the best men left (three years at the minimum,
// the way UDFAs sign). Most don't make the team; the ones better than the bottom of a room get their shot at the
// cuts (trim), and a thin room keeps one.
function signUDFAs(F, R) {
  const left = (F.dc ?? []).filter(x => x.b == null).sort((a, b) => b.o - a.o || b.pk - a.pk)
  if (!left.length) return
  for (const s of R.shuffle(SHORTS.filter(x => x !== F.team))) {
    const t = F.teams[s]
    let n = 0
    for (const x of [...left]) {
      if (n >= 3) break
      const room = t.r.filter(p => p.p === x.p)
      const worst = room.reduce((m, p) => Math.min(m, p.o), 99)
      if (room.length >= MIN[x.p] && x.o < worst - 1 && x.pk - (x.hb ?? 0) < worst + 6) continue   // (what the teams can see)
      const p = { i: F.nid++, n: x.n, p: x.p, ...(x.s && { s: x.s }), o: x.o, ag: x.ag, pk: x.pk, rk: F.year + 1, c: x.col, a: x.a, nu: x.nu, ...(x.hb && { hb: x.hb }) }
      signRookie(p, 262, F.year + 1); p.y = 3; p.g = 0
      t.r.push(p)
      left.splice(left.indexOf(x), 1)
      n++
    }
  }
}
export { POS_LABEL, FIRST_YEAR }

// ── The cut-down (the player's own team) ─────────────────────────────────────
// Before the new season every room has to fit its limit (MAX: the men who play). The league's teams cut their own
// (newSeason, trim); the player's are his calls (2026-11-19: "releases should be manual"). The draft done, the rooms
// over the limit: [{ pos, have, max, men }] (the made-up fillers don't count: the game lets them go itself)
export function campCuts(F) {
  const t = F.teams[F.team]
  return POS.map(pos => { const men = t.r.filter(p => p.p === pos && !p.fl); return { pos, have: men.length, max: MAX[pos], men } }).filter(x => x.have > x.max)
}
// he lets a man go: off the roster, his bonus still owed on the books as dead money (contracts.js cutMan), and he's
// on the street for the season (newSeason keeps him there). Only from a room over its limit.
export function campCut(F, id) {
  const room = campCuts(F).find(r => r.men.some(p => p.i === id))
  if (!room) return null
  const c = cutMan(F, id)
  if (c?.p) c.p.cc = 1
  return c
}
// Over the cap at the cut-down (past what the front office's restructures will clear when the season starts): the
// season can't start until he's under. capOver: the $M still to clear (0: under, or no release would help);
// capCuts: the men whose release clears the most room (never a build, never the last men a room needs);
// capCut: one of them let go, the way campCut does it.
export function capOver(F) {
  const c = capSheet(F)
  if (c.nocap) return 0
  const over = r1(-(c.room + restructurable(F)))
  return over > 0 && capCuts(F).length ? over : 0
}
export function capCuts(F, n = 8) {
  const t = F.teams[F.team]
  return t.r.filter(p => p.b == null && !p.fl && p.y > 0 && t.r.filter(x => x.p === p.p && !x.fl).length > MIN[p.p])
    .map(p => ({ p, saves: cutRoom(F, p) })).filter(x => x.saves > 0.05).sort((a, b) => b.saves - a.saves).slice(0, n)
}
export function capCut(F, id) {
  if (!capCuts(F, 99).some(x => x.p.i === id)) return null
  const c = cutMan(F, id)
  if (c?.p) c.p.cc = 1
  return c
}
// (the headless sims' cut-down: the player's calls made the way the old cut-down made them: his builds, the new class
// and his early picks on their rookie deals kept, the rest by rating)
export function autoCamp(F) {
  const kept = p => p.b != null || p.rk === F.year + 1 || (p.rc && (p.dr?.[0] ?? 8) <= 4)
  for (const r of campCuts(F)) for (const p of [...r.men].sort((a, b) => kept(a) - kept(b) || a.o - b.o).slice(0, r.have - r.max)) campCut(F, p.i)
}
