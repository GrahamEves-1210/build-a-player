// NBA FRANCHISE: the GM's own builds. A build is made on the game's build page (a guard or a big, its ten ratings),
// named and numbered in the setup, and joins the team as a rookie: 20 years old, a first-round rookie-scale deal at
// the slot his OVR would have gone, his spot read off his ratings. The man he replaces (the last man in his group on
// the bench) is released to the street with his deal off the books.
// Builds grow by the game's own rule, not the sim's dice: each summer a young build's grades go up a step at a time.
// From 28 he ages the way every man does (aging.js ageBuild: the league's curve, the legs first), and he retires the
// way they do, a little later (from 35, the same odds x0.6, as football's builds), at 40 at the latest. His
// retirement is on the wire and his card keeps the year (F.builds[b].done).
import { TEAM, TYPES, ovrOfAttrs, SPOTS, groupOfSpot } from './league'
import { rngOf, clamp } from '../rng'
import { addNews } from './news'
import * as X from './seams'

export const BUILD_MAX = 3
// his spot: a guard who runs the offence is a point guard, a big wing a small forward; a big with size a center
export function buildSpot(pos, a) {
  if (pos === 'big') return (a.size ?? 5) + (a.interiorDefense ?? 5) >= (a.jumpShot ?? 5) + (a.speed ?? 5) + 2 ? 'C' : 'PF'
  const pg = (a.passing ?? 5) + (a.handles ?? 5), wing = (a.size ?? 5) * 2
  return pg >= 15 && pg >= wing ? 'PG' : wing >= 13 && (a.size ?? 5) >= 7 ? 'SF' : 'SG'
}
const HT = { PG: 75, SG: 77, SF: 79, PF: 81, C: 83 }, WT = { PG: 190, SG: 205, SF: 220, PF: 235, C: 255 }
// the draft slot his OVR goes at (a 90 the first pick, a 75 late in the first round)
export const buildSlot = o => clamp(1, 30, Math.round(31 - (o - 72) * 1.6))
export const attrsOfBuild = (pos, build) => Object.fromEntries((TYPES[pos] ?? []).map(t => [t, clamp(0, 11, Math.round(build?.[t]?.val ?? 0))]))

export function makeBuild(F, idx, B) {
  const a = attrsOfBuild(B.pos, B.build)
  const spot = buildSpot(B.pos, a)
  const o = ovrOfAttrs(B.pos, a)
  const p = { i: F.nid++, n: B.name, p: spot, g: groupOfSpot(spot) === B.pos ? B.pos : B.pos, o, ag: B.age ?? 20, a, ht: HT[spot], wt: WT[spot], num: B.num, ys: 0, b: idx, rk: F.year, pk: Math.min(99, o + 4) }
  p.dr = [F.year, 1, buildSlot(o), F.team]
  return p
}
// the builds onto the GM's roster at the start of the franchise (F.builds already filled in)
export function placeBuilds(F) {
  const t = F.teams[F.team]
  for (let idx = 0; idx < F.builds.length; idx++) {
    const B = F.builds[idx]
    const p = makeBuild(F, idx, B)
    // the man he replaces: the last man in his group (the two-way men aside), off to the street, his deal off the books
    const same = t.r.filter(x => !x.tw && x.b == null && x.g === p.g).sort((x, y) => x.o - y.o)[0]
    if (same) {
      t.r = t.r.filter(x => x !== same)
      for (const k of ['$', 'y', 'sc', 'opt', 'rs', 'bird', 'sgn']) delete same[k]
      same.was = F.team
      F.fa = [...(F.fa ?? []), same]
    }
    t.r.push(p)
    X.rookieDeal(F, p, { n: buildSlot(p.o), r: 1 })
    B.i = p.i
    addNews(F, { k: 'sign', tag: 'SIGNED', s: F.team, text: `The ${TEAM[F.team].nick} sign ${p.n}, a ${p.p}, to a rookie-scale deal${same ? `; ${same.n} is released` : ''}` })
  }
}
// a summer older (after ageLeague has aged him): a young build's grades go up a step at a time (two or three steps
// at 20-23, one or two to 27, maybe one at 28); his OVR follows his grades, his card follows him (F.builds)
export function growBuilds(F) {
  const out = []
  for (const s of Object.keys(F.teams)) for (const p of F.teams[s].r) {
    if (p.b == null) continue
    const B = F.builds[p.b]
    const R = rngOf(`${F.seed}-grow-${F.year}-${p.i}`)
    const T = TYPES[p.g] ?? []
    const was = p.o
    const up = p.ag <= 23 ? R.int(2, 3) : p.ag <= 27 ? R.int(1, 2) : p.ag <= 28 ? R.int(0, 1) : 0
    for (let k = 0; k < up; k++) {
      // (the lower grades first, the way a player works on what he can't do)
      const open = T.filter(t => p.a[t] < 11).sort((x, y) => p.a[x] - p.a[y] + (R.u() - 0.5) * 3)
      if (open.length) p.a[open[0]]++
    }
    p.o = ovrOfAttrs(p.g, p.a)
    p.pk = Math.max(p.pk ?? p.o, p.o)
    if (B) { B.age = p.ag; for (const t of T) if (B.build?.[t]) B.build[t] = { ...B.build[t], val: p.a[t] } }
    if (p.o !== was) out.push({ i: p.i, n: p.n, from: was, to: p.o })
  }
  return out
}
export { SPOTS }
