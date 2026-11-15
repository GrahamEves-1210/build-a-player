// FRANCHISE: the league ages a year (the offseason, after the awards).
//
// Each position has its own curve, the way the NFL's do: a young man grows toward what he's headed for (pk), faster
// when he starts and with a coach who develops players; in his prime he holds, a point either way; past it he
// slips, a little more each year. Backs fall off first (28), quarterbacks last (34). Men retire when the curve and
// their rating say so; a man past 31 who's no longer good enough to start is likelier to go.
//   ageLeague(F)   every man a year older, his OVR moved, his deal a year shorter; the retirements
//   growth(F, p, R, starter, short)   the OVR change for one man this year
//   growBuild(B, d)   the player's build moves a trait a step at a time until his OVR has moved by d
import { SHORTS, lineup } from './league'
import { tickDeal } from './contracts'
import { coachDev } from './coach'
import { carryInjury } from './injury'
import { ovrOf, TYPES_OF } from '../squadSeason'
import { rngOf, clamp } from './rng'

// [still growing until, prime until, the age most are gone by]
export const CURVE = { qb: [27, 33, 38], rb: [24, 27, 31], wr: [25, 29, 33], te: [26, 30, 34], ol: [26, 31, 35], dl: [25, 29, 33], lb: [25, 28, 32], db: [24, 28, 32] }
export function growth(F, p, R, starter = false, short = null) {
  const [grow, prime] = CURVE[p.p] ?? [26, 29, 33]
  const dev = short ? coachDev(F, short, p) : 0
  let d
  if (p.ag <= grow) {
    // the rest of the way to his peak, spread over the years he has left to grow (a wide spread: some boom early)
    // (a late bloomer, the one the draft missed (hb), gets there in two or three years once he's in the building)
    const left = Math.max(1, p.hb ? Math.min(2, grow + 1 - p.ag) : grow + 1 - p.ag)
    d = Math.max(0, ((p.pk ?? p.o) - p.o) / left) * (0.55 + 0.9 * R.u()) + dev + (starter && p.ag <= 25 ? 0.6 : 0) + R.n() * 0.8
  } else if (p.ag <= prime) d = R.n() * 0.9 + (p.o < (p.pk ?? p.o) ? 0.4 : -0.1)
  else d = -(0.9 + (p.ag - prime) * 0.75) * (0.5 + R.u())
  return Math.round(d)
}
// A build grows a step at a time: a trait up a grade until his OVR has moved by d (or down, the same way)
export function growBuild(B, d) {
  const types = TYPES_OF[B.pos]
  const start = ovrOf(B.pos, B.build)
  const goal = clamp(40, 99, start + d)
  for (let guard = 0; guard < 40 && ovrOf(B.pos, B.build) !== goal; guard++) {
    const up = goal > ovrOf(B.pos, B.build)
    const ts = types.filter(t => B.build[t] && (up ? B.build[t].val < 11 : B.build[t].val > 1)).sort((a, b) => (up ? B.build[a].val - B.build[b].val : B.build[b].val - B.build[a].val))
    if (!ts.length) break
    const t = ts[0]
    B.build = { ...B.build, [t]: { ...B.build[t], val: B.build[t].val + (up ? 1 : -1) } }
    const after = ovrOf(B.pos, B.build)
    if (up ? after > goal + 1 : after < goal - 1) { B.build = { ...B.build, [t]: { ...B.build[t], val: B.build[t].val + (up ? -1 : 1) } }; break }
  }
  B.ups = (B.ups ?? 0) + (ovrOf(B.pos, B.build) - start)
  return ovrOf(B.pos, B.build) - start
}
// the chance he retires this offseason
export function retireChance(p, starter) {
  const [, prime, gone] = CURVE[p.p] ?? [26, 29, 33]
  if (p.ag >= gone + 5) return 1
  if (p.ag <= prime) return p.o < 62 ? 0.25 : 0
  const past = (p.ag - prime) / Math.max(1, gone - prime)           // 0 at the end of his prime, 1 at the usual age
  const level = (80 - p.o) * 0.035 - (starter ? 0.12 : 0)            // a starter hangs on, a backup is let go
  return clamp(0, 0.97, past * 0.55 + level + (p.ag >= gone ? 0.25 : 0))
}
export function ageLeague(F) {
  const R = rngOf(`${F.seed}-${F.year}-age`)
  const changes = []
  const starters = new Set(SHORTS.flatMap(s => Object.values(lineup(F.teams[s])).map(p => p.i)))
  F.gone = []
  for (const s of SHORTS) {
    const t = F.teams[s]
    const keep = []
    for (const p of t.r) {
      p.ag++
      carryInjury(p)
      const was = p.o
      const d = growth(F, p, R, starters.has(p.i), s)
      if (p.b != null) { p.o = was + growBuild(F.builds[p.b], d); F.builds[p.b].age = p.ag }
      else p.o = clamp(40, 99, p.o + d)
      if (p.o > (p.pk ?? 0)) p.pk = p.o
      // (past his prime what he was headed for no longer matters: dropped, the save stays small)
      if (p.ag > (CURVE[p.p]?.[1] ?? 29)) delete p.pk
      const out = R.u() < retireChance(p, starters.has(p.i)) * (p.b != null ? 0.6 : 1)
      if (out) {
        if (p.b != null) retireBuild(F, p)
        if (s === F.team) changes.push({ k: 'ret', pid: p.i, n: p.n, p: p.p, b: p.b ?? null })
        // (the wire: a notable man's retirement)
        if (was >= 84 || p.b != null || s === F.team) F.gone.push({ n: p.n, p: p.p, s, ag: p.ag, o: was, i: p.i, ...(p.b != null && { b: p.b }), ...(p.cr && { cr: p.cr.length }) })
        continue
      }
      tickDeal(p)
      if (s === F.team && p.o !== was) changes.push({ k: p.o > was ? 'up' : 'down', pid: p.i, n: p.n, p: p.p, b: p.b ?? null, from: was, to: p.o })
      keep.push(p)
    }
    t.r = keep
    t.dead = []
  }
  F.aging = changes
  return changes
}
function retireBuild(F, p) {
  const B = F.builds[p.b]
  B.done = F.year
  const seasons = B.car.length
  if (seasons >= 4 || B.car.some(c => c.aw || c.ring)) F.retired.push({ num: B.num, n: p.n, p: p.p, b: p.b, y: F.year, seasons })
}
