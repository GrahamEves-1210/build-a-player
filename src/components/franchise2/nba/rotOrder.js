// NBA FRANCHISE: the GM's rotation order, the one the Team screen shows and the one it stores. Team.rot keeps every
// standard man (the injured too, so a starter back from a sprain walks back into his place); the screen lists the
// healthy ones in that order, the first five start (rotation.js planRotation starts the first five available).
// With no order of his own (Team.rot null) it is the coach's (league.js coachOrder).
import { coachOrder, CAP_SIM } from '../../../lib/franchise2/nba'

// every standard man's id, in the GM's order: his stored order (men no longer here dropped), then anyone new in the
// coach's order, then the injured
function fullOrder(F, opts) {
  const T = F.teams[F.team]
  const std = T.r.filter(p => !p.tw)
  const coach = coachOrder(F, F.team, CAP_SIM.rotationOf, opts).filter(p => !p.tw).map(p => p.i)
  const out = (T.rot ?? []).filter(i => std.some(p => p.i === i))
  for (const i of [...coach, ...std.map(p => p.i)]) if (!out.includes(i)) out.push(i)
  return out
}
// the healthy standard men, in order (what the screen lists; the first five are the starters)
export function rotOrder(F, opts) {
  const T = F.teams[F.team]
  const coach = coachOrder(F, F.team, CAP_SIM.rotationOf, opts).filter(p => !p.tw)
  if (!T.rot?.length) return coach
  const by = new Map(coach.map(p => [p.i, p]))
  return fullOrder(F, opts).map(i => by.get(i)).filter(Boolean)
}
// swap two men: exactly those two change places; every other man (and every minutes target) stays put. A man set to
// DNP who is swapped into the five is a starter again: his DNP comes off and the coach gives him a starter's minutes.
export function swapRot(X, a, b, opts) {
  const ids = fullOrder(X, opts)
  const i = ids.indexOf(a), j = ids.indexOf(b)
  if (i < 0 || j < 0 || i === j) return
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  const T = X.teams[X.team]
  T.rot = ids
  if (T.min) {
    const five = rotOrder(X, opts).slice(0, 5).map(p => p.i)
    for (const id of [a, b]) if (five.includes(id) && T.min[id] === 0) delete T.min[id]
    if (!Object.keys(T.min).length) T.min = null
  }
}
// A DNP man can't start. A starter whose minutes are set to 0 goes to the bench: he changes places with the first
// bench man who plays (with nobody to take his place, his DNP comes off). Called after the minutes change, and by the
// Team screen for a save that already has a DNP man in its five.
export const dnpStarter = (X, opts) => { const T = X.teams[X.team]; return T.rot?.length && T.min ? rotOrder(X, opts).slice(0, 5).find(p => T.min[p.i] === 0)?.i ?? null : null }
export function benchDnp(X, opts) {
  const T = X.teams[X.team]
  for (let guard = 0; guard < 6; guard++) {
    const id = dnpStarter(X, opts)
    if (id == null) return
    const to = rotOrder(X, opts).slice(5).find(p => T.min[p.i] !== 0)?.i
    if (to == null) { delete T.min[id]; continue }
    const ids = fullOrder(X, opts), i = ids.indexOf(id), j = ids.indexOf(to)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    T.rot = ids
  }
}
// move a man one place up (d -1) or down (d 1) among the healthy men listed
export function moveRot(X, id, d, opts) {
  const shown = rotOrder(X, opts).map(p => p.i)
  const k = shown.indexOf(id), to = k + d
  if (k < 0 || to < 0 || to >= shown.length) return
  swapRot(X, id, shown[to], opts)
}
