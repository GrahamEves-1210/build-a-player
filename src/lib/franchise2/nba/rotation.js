// NBA FRANCHISE: the rotation. Who starts, who plays, how many minutes each man is meant to get.
//
// A coach sets five starters and an eight-to-ten-man rotation; stars play 34-37, the rest of the starters 28-33, the
// sixth man 24-28, the end of the bench a few minutes or none. The game (game.js) plays toward these targets and moves
// off them the way a real game does: foul trouble sits a man, a blowout empties the bench, a close fourth quarter goes
// to the closers, an overtime adds minutes.
//
//   rotationOf(F, short)       the seam (STATE.md): [{ i, st, min }] the men who play tonight, starters first, with
//                              their targets; honours team.rot (his order, the first five start) and team.min
//   planRotation(players, set) { st: [5 ids], order: [ids, starters first], min: { id: target minutes }, closers: [5 ids] }
//       players: the men who can play tonight (healthy, not resting). set (the user's screen, optional):
//         { st: [ids] }        his five starters (any left out or not available: filled by the coach)
//         { order: [ids] }     his order for the bench
//         { min: { id: m } }   minutes he wants for a man (0 = out of the rotation); the rest are scaled to fill 240
//   startersOf(players)        the coach's best five: at least one ball-handler, one or two bigs, no more than three
//   MIN_CAP                    the most a target can be (40: nobody plays 44 a night in the modern league)
import { prof, groupOf } from './skills'

// tonight's men: under contract, not hurt, not resting (a two-way man dresses too; the coach rarely plays him)
export const dressed = T => T.r.filter(p => !(p.inj?.g > 0) && !p.rest)
export const setOf = T => ({ st: T.rot ? T.rot.slice(0, 5) : [], order: T.rot ?? null, min: T.min ?? null })
export function rotationOf(F, short) {
  const T = F.teams[short], L = planRotation(dressed(T), setOf(T))
  return L.order.filter(i => L.min[i] > 0).map(i => ({ i, st: L.st.includes(i), min: L.min[i] }))
}

export const MIN_CAP = 40
export const GAME_MIN = 240
const ovr = p => p.o ?? 70
// the regular-season shape of a rotation (minutes by slot, a 9-to-10-man night)
const SLOT = [34, 33, 32, 31, 30, 25, 21, 17, 11, 6]

// the five a coach starts: the best men, shaped like a lineup
export function startersOf(players) {
  const by = [...players].sort((a, b) => ovr(b) - ovr(a))
  const five = by.slice(0, 5)
  const bigs = list => list.filter(p => groupOf(p) === 'big').length
  const handler = p => { const s = prof(p); return s.pas + s.hnd }
  // too many bigs: the worst big out for the best guard on the bench
  while (bigs(five) > 3) {
    const g = by.find(p => !five.includes(p) && groupOf(p) === 'guard'); if (!g) break
    const b = [...five].filter(p => groupOf(p) === 'big').sort((x, y) => ovr(x) - ovr(y))[0]
    five.splice(five.indexOf(b), 1, g)
  }
  // no big at all: the best big in for the worst guard
  if (!bigs(five)) {
    const b = by.find(p => !five.includes(p) && groupOf(p) === 'big')
    if (b) { const g = [...five].sort((x, y) => ovr(x) - ovr(y))[0]; five.splice(five.indexOf(g), 1, b) }
  }
  // nobody to bring it up: the best ball-handler in for the worst non-big
  if (!five.some(p => groupOf(p) === 'guard' && handler(p) >= 11)) {
    const h = by.filter(p => !five.includes(p) && groupOf(p) === 'guard').sort((x, y) => handler(y) - handler(x))[0]
    const out = [...five].filter(p => groupOf(p) === 'guard').sort((x, y) => ovr(x) - ovr(y))[0]
    if (h && out && handler(h) > handler(out) + 2 && ovr(h) >= ovr(out) - 6) five.splice(five.indexOf(out), 1, h)
  }
  return five
}

export function planRotation(players, set = {}) {
  const ids = new Set(players.map(p => p.i))
  let five
  const want = (set.st ?? []).filter(id => ids.has(id))
  if (want.length) {
    five = want.slice(0, 5).map(id => players.find(p => p.i === id))
    for (const p of startersOf(players.filter(p => !want.includes(p.i)).concat([]))) if (five.length < 5 && !five.includes(p)) five.push(p)
    for (const p of [...players].sort((a, b) => ovr(b) - ovr(a))) if (five.length < 5 && !five.includes(p)) five.push(p)
  } else five = startersOf(players)
  five.sort((a, b) => ovr(b) - ovr(a))
  const bench = players.filter(p => !five.includes(p)).sort((a, b) => ovr(b) - ovr(a))
  // his order for the bench (team.rot past the first five); men he didn't place go after, best first
  if (set.order?.length) { const at = id => { const j = set.order.indexOf(id); return j < 0 ? 999 : j }; bench.sort((a, b) => at(a.i) - at(b.i)) }
  const order = [...five, ...bench]
  // the coach's targets: the slot's minutes, a star a bit more, a weak starter a bit less
  const min = {}
  const top = ovr(order[0] ?? {})
  order.forEach((p, k) => {
    let m = SLOT[k] ?? 0
    if (k < 5) m += Math.max(-4, Math.min(3, (ovr(p) - 84) * 0.28))
    // a bench man much worse than the one before him gets less (a thin team plays its starters more)
    if (k >= 5 && k < 10) m *= Math.max(0.35, Math.min(1.25, 1 + (ovr(p) - (top - 12)) * 0.03))
    min[p.i] = Math.max(0, m)
  })
  // the user's own numbers: kept as set, the coach's men scaled to fill the rest of the 240
  const byKey = new Map(players.map(p => [String(p.i), p]))
  const fixed = new Set()
  let fixedSum = 0
  for (const [k, m] of Object.entries(set.min ?? {})) {
    const p = byKey.get(String(k)); if (!p) continue
    fixed.add(p); min[p.i] = Math.max(0, Math.min(MIN_CAP + 4, +m || 0)); fixedSum += min[p.i]
  }
  const free = order.filter(p => !fixed.has(p))
  const freeSum = free.reduce((s, p) => s + min[p.i], 0)
  const room = Math.max(0, GAME_MIN - fixedSum)
  if (freeSum > 0) for (const p of free) min[p.i] = Math.min(MIN_CAP, min[p.i] * room / freeSum)
  // the scale-down's leftovers (a man at the cap): to the next men in line who are under it
  let left = GAME_MIN - order.reduce((s, p) => s + min[p.i], 0)
  for (let pass = 0; pass < 3 && left > 0.5; pass++) for (const p of free) { if (left <= 0) break; const add = Math.min(left, MIN_CAP - min[p.i], 8); if (add > 0 && min[p.i] > 0) { min[p.i] += add; left -= add } }
  for (const p of order) min[p.i] = Math.round(min[p.i] * 10) / 10
  // closing a close game: the five best who play real minutes (a coach's closers; the starters most nights)
  const closers = [...order].filter(p => min[p.i] >= 14).sort((a, b) => ovr(b) - ovr(a)).slice(0, 5)
  for (const p of order) if (closers.length < 5 && !closers.includes(p)) closers.push(p)
  return { st: five.map(p => p.i), order: order.map(p => p.i), min, closers: closers.map(p => p.i) }
}
