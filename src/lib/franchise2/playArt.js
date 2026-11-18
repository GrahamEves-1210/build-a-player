// FRANCHISE: the key moments' play art (owner, 2026-11-17: "the key moments play picker should use play art not just
// the concept"). Its own module: it reads the mini games' engines (their line-ups), so it loads with the moment's
// picker (Week.jsx, lazily), not with the franchise.
import { PLAYS, sideOf } from './moments'
import { rngOf } from './rng'
import { passLook, YD as PASS_YD, SL, SR } from '../mg/throw.js'
import { fadeLook } from '../mg/goalline.js'
import { runLook } from '../mg/kickret.js'
import { stopLook } from '../mg/hitstick.js'

// ── THE PLAY ART: the call drawn as the coaches draw it (owner, 2026-11-17: "the key moments play picker should use
// play art not just the concept") ──
// From the engine's own line-up for this very snap (the seed the moment plays it on): the formation in Os (and the
// defense in Xs where the play is drawn against it), the routes, the blocks and the ball carrier's path. Yards: x
// across from the middle of the field, y up the field from the line of scrimmage (the offense below it).
//   { view: [x0, x1, y0, y1], men: [{ x, y, k: 'o' | 'd', me }], paths: [{ pts, k: 'route' | 'carry' | 'block' |
//   'read' }], labels: [{ x, y, t }], ltg (yards to the line to gain, null at the goal), goal (yards to the goal line) }
const XYD = (SR - SL) / 53.33
const FIELD = [-27, 27, -7, 20]
export function playArt(v, playId) {
  const P = PLAYS[playId]
  if (!P) return null
  const seed = `${v.seed}-${playId}`
  const toGoal = 100 - (v.y ?? 50)
  const out = { view: FIELD, men: [], paths: [], labels: [], ltg: v.goal ? null : v.d ?? null, goal: toGoal, kind: P.kind }
  const man = (x, y, k = 'o', me = false) => out.men.push({ x, y, k, me })
  const path = (pts, k) => out.paths.push({ pts, k })
  if (P.game === 'fr-pass') {
    const { men } = passLook(seed, P.call)
    const X = x => (x - 180) / XYD, Y = y => y / PASS_YD
    for (const k of ['X', 'H', 'Z', 'TE', 'RB']) {
      const [x, y, pts] = men[k]
      man(X(x), Y(y))
      if (pts) path(pts.map(([a, b]) => [X(a), Y(b)]), 'route')
    }
    for (const [x, y] of men.OL) man(X(x), Y(y))
    man(X(men.QB[0]), Y(men.QB[1]), 'o', true)
  } else if (P.game === 'fr-fade') {
    const L = fadeLook(seed)
    const X = x => (x - 180) / L.xu
    for (const k of ['X', 'Z', 'TE', 'RB']) {
      const { pts } = L.men[k]
      man(X(pts[0][0]), pts[0][1])
      path(pts.map(([a, b]) => [X(a), b]), 'route')
    }
    for (const [x, y] of L.ol) man(X(x), y)
    man(X(L.qb[0]), L.qb[1], 'o', true)
    out.goal = L.goal
    out.ltg = null
  } else if (P.game === 'fr-run') {
    const side = sideOf(rngOf(seed))
    const L = runLook(P.hole, side)
    out.side = side
    for (const [x, y] of [...L.d.front, ...L.d.backers, ...L.d.cb, ...L.d.s]) man(x, y, 'd')
    for (const [x, y] of [...L.o.ol, L.o.te, ...L.o.wr, L.o.qb, L.o.slot]) man(x, y)
    // the blocks: each man into his, stopped short (the block's bar at the end)
    for (const [[ax, ay], [bx, by]] of L.blocks) path([[ax, ay], [ax + (bx - ax) * 0.72, ay + (by - ay) * 0.72]], 'block')
    const [bx, by] = L.o.back
    man(bx, by, 'o', true)
    // the back's path: to the hole and through it (the draw: a beat in the backfield first, the quarterback showing pass)
    if (L.draw) { path([L.o.qb, [L.o.qb[0], L.o.qb[1] - 2.4]], 'route'); path([[bx, by], [bx, by + 1.2], [L.hole, 1.2], [L.hole, 8]], 'carry') }
    else path([[bx, by], [L.hole * 0.85, -1.5], [L.hole, 1.2], [L.hole, 8]], 'carry')
    out.view = [-22.5, 22.5, -7.5, 15]
  } else {
    // the stop: their run at our backer (the offense below the line, our front above it)
    const L = stopLook()
    for (const [x, y] of [...L.ol, L.te, L.qb]) man(x, y)
    man(L.rb[0], L.rb[1])
    for (const [x, y] of [...L.dl, ...L.lbs]) man(x, y, 'd')
    man(L.me[0], L.me[1], 'd', true)
    path([L.rb, [0, L.mesh], [0, -0.6]], 'read')
    path([L.me, [0, 1.6]], 'carry')
    for (const [x, t] of L.gaps) out.labels.push({ x, y: -3.3, t })
    out.view = [-13.5, 13.5, -8.5, 6.5]
    out.ltg = null
    out.goal = null
  }
  return out
}
