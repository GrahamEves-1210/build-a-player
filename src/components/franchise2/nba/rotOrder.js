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
// swap two men: exactly those two change places; every other man (and every minutes target) stays put
export function swapRot(X, a, b, opts) {
  const ids = fullOrder(X, opts)
  const i = ids.indexOf(a), j = ids.indexOf(b)
  if (i < 0 || j < 0 || i === j) return
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  X.teams[X.team].rot = ids
}
// move a man one place up (d -1) or down (d 1) among the healthy men listed
export function moveRot(X, id, d, opts) {
  const shown = rotOrder(X, opts).map(p => p.i)
  const k = shown.indexOf(id), to = k + d
  if (k < 0 || to < 0 || to >= shown.length) return
  swapRot(X, id, shown[to], opts)
}
