// BLACKTOP LIVE: the referee. Every discrete thing in a game is decided here and nowhere else: what kind of shot
// it is, how contested, whether it's blocked, whether it goes in, a steal, a dribble move that freezes a defender,
// a picked pass, who comes down with a board, where a miss comes off to, the score and when the game is over.
// Each function takes plain facts (positions, ratings, what each player is doing) and the rolls it needs, and
// returns a verdict: no state of its own, no clock, no randomness of its own. The simulation calls it locally in
// practice; online the same file runs on the live server, so nobody's phone decides its own makes. Pure.
import { COURT, RULES, T } from './tune.js'
import { releaseMult } from './meter.js'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const RIM = COURT.rim
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
export const rimDist = p => Math.hypot(p.x - RIM.x, p.y - RIM.y)

// behind the three-point line: outside the side lines low, outside the curve up top
export function isThree(x, y) {
  if (y <= COURT.arcSideY) return Math.abs(x - RIM.x) > COURT.arcSideX
  return Math.hypot(x - COURT.arcC.x, y - COURT.arcC.y) > COURT.arcR
}
export const inPaint = (x, y) => x >= COURT.paint.x0 && x <= COURT.paint.x1 && y <= COURT.paint.y1
export const inBounds = (x, y, pad = 0) => x >= COURT.minX - pad && x <= COURT.maxX + pad && y >= COURT.minY - pad && y <= COURT.maxY + pad

// A shot from here by him: a layup or a dunk near the rim, a jumper anywhere else. roll: one roll (the dunk)
export function shotKind(R, d, roll) {
  if (d > T.layRange) return 'jumper'
  if (d <= T.dunkRange && R.bnc > T.dunkBounce && roll < (R.bnc - T.dunkBounce) * T.dunkChance * (0.7 + 0.6 * R.fin)) return 'dunk'
  return 'layup'
}

const beaten = p => p.act === 'frozen' || p.act === 'down'
// a defender as he'd be with a hand up (a beaten one stays beaten)
export const handUp = d => (beaten(d) ? d : { ...d, act: 'jump' })
// A late closeout: the contest at the release, but a man who wasn't in the shot as it went up (cUp: the contest at the
// gather, every hand up) only gets part of it
export const lateContest = (c, cUp) => (cUp == null ? c : c * (1 - T.lateShare) + Math.min(c, cUp) * T.lateShare)

// How much the defense is in the shot, 0..1, and whose hand it is. Players: { id, x, y, act, R }
export function contestOf(shooter, defenders, kind) {
  const sd = rimDist(shooter)
  const paint = kind !== 'jumper' || inPaint(shooter.x, shooter.y)
  let best = 0, second = 0, by = null
  for (const d of defenders) {
    const dd = dist(d, shooter)
    if (dd > T.contestRange) continue
    const near = kind === 'jumper' ? T.contestNear : T.contestNearL
    const prox = Math.pow(clamp(1 - (dd - near) / (T.contestRange - near), 0, 1), T.contestCurve)
    // between the shooter and the rim, or beside/behind him
    let front = 1
    if (sd > 2 && dd > 0.01) {
      const dot = ((d.x - shooter.x) * (RIM.x - shooter.x) + (d.y - shooter.y) * (RIM.y - shooter.y)) / (dd * sd)
      if (dot < 0.2) front = T.contestSide
    }
    // a hand up, or feet on the floor; a man set in front of a layup (straight up, not moving) is almost as good as a jump
    const set = kind !== 'jumper' && front === 1 && Math.hypot(d.vx || 0, d.vy || 0) < 3
    const stance = beaten(d) ? T.contestBeat : d.act === 'jump' ? 1 : set ? T.contestSet : T.contestStand
    const rate = T.contestRate + T.contestRateDef * (paint ? d.R.int : d.R.per)
    const size = 1 + T.contestSize * (d.R.size - shooter.R.size)
    const c = clamp(prox * stance * front * rate * size, 0, 1)
    if (c > best) { second = best; best = c; by = d.id } else if (c > second) second = c
  }
  return { c: clamp(best + second * 0.35, 0, 1), by }
}

// The chance a shot goes in: what the rating gives at that spot x how good the release was x how well it was contested
//   s: { R, kind, d (ft from the rim), q (release 0-1), c (contest 0-1), run (0-1 of top speed at the gather),
//        cs (the passer's Passing 0-1 on a jumper off the catch, else null), rushed }
export function makeChance(s) {
  const R = s.R
  let base, pen
  if (s.kind === 'dunk') { base = T.dunkBase + T.dunkFin * R.fin; pen = T.contestMaxD * s.c }
  else if (s.kind === 'layup') {
    base = T.layBase + T.layFin * R.fin - T.layFar * Math.max(0, s.d - 3)
    pen = T.contestMaxL * s.c * (1 - T.finThrough * R.fin)
  } else {
    const close = T.closeBase + T.closeJs * R.js, arc = T.arcBase + T.arcJs * R.js
    const t = clamp((s.d - 8) / (T.arcRef - 8), 0, 1)
    base = close + (arc - close) * Math.pow(t, T.curve)
    if (s.d > T.deepAt) base -= (s.d - T.deepAt) * (T.deepFall - T.deepJs * R.js)
    base *= 1 - T.setFeet * clamp(s.run ?? 0, 0, 1)
    if (s.cs != null) base *= 1 + T.csBoost * s.cs
    pen = T.contestMaxJ * s.c
  }
  let p = base * releaseMult(s.kind, s.q) * (1 - pen)
  if (s.rushed) p *= 1 - T.rushPen * (1 - R.iq)
  return clamp(p, 0.02, 0.98)
}

// The release: blocked, made or missed. shooter/defenders: { id, x, y, vx, vy, act, actT (s into the jump), R }
// rolls: { block: [one per defender, in order], make }
export function judgeShot(shooter, defenders, shot, rolls) {
  const sd = rimDist(shooter)
  // a block first: a defender in the air, close, on time
  let i = 0
  for (const d of defenders) {
    const roll = rolls.block[i++] ?? 1
    if (d.act !== 'jump') continue
    const dd = dist(d, shooter)
    const reach = T.blockReach + T.blockReachBnc * d.R.bnc + T.blockReachSize * d.R.size
    if (dd > reach) continue
    const phase = d.actT / T.jumpTime
    const onTime = phase >= T.blockIn && phase <= T.blockOut ? 1 : 0.25
    const kind = shot.kind === 'jumper' ? T.blockJumper : shot.kind === 'dunk' ? T.blockDunk : 1
    const p = clamp(T.blockBase * onTime * (0.55 + T.blockInt * d.R.int) * (1 + T.blockSize * (d.R.size - shooter.R.size))
      * (1 + T.blockBnc * (d.R.bnc - 0.5)) * kind * (1 - 0.4 * dd / reach), 0, T.blockMax)
    if (roll < p) {
      const dot = sd > 2 && dd > 0.01 ? ((d.x - shooter.x) * (RIM.x - shooter.x) + (d.y - shooter.y) * (RIM.y - shooter.y)) / (dd * sd) : 1
      return { blocked: d.id, chase: dot < -T.chaseAngle && Math.hypot(shooter.vx, shooter.vy) > 3, made: false, pts: 0, c: 1, p: 0 }
    }
  }
  const cr = contestOf(shooter, defenders, shot.kind), by = cr.by
  const c = lateContest(cr.c, shot.cUp)
  const p = makeChance({ R: shooter.R, kind: shot.kind, d: shot.d, q: shot.q, c, run: shot.run, cs: shot.cs, rushed: shot.rushed })
  const made = rolls.make < p
  return {
    blocked: null, made, pts: made ? (shot.three ? 2 : 1) : 0, c, by, p,
    // a poster: a dunk made on a man who went up to stop it, square in it
    poster: made && shot.kind === 'dunk' && c >= T.posterContest && defenders.some(d => d.id === by && d.act === 'jump'),
    deep: made && shot.three && shot.d >= T.deepWord,
  }
}

// A swipe at the ball. def/handler: { x, y, fx, fy (the handler's facing), act, burst, R }
export function judgeSteal(def, handler, roll) {
  const dd = dist(def, handler)
  if (dd > T.stealReach) return { ok: false, reach: true }
  const behind = dd > 0.01 && ((def.x - handler.x) * handler.fx + (def.y - handler.y) * handler.fy) / dd < -0.25
  const p = clamp(T.stealBase * (0.55 + T.stealPer * def.R.per) * (1.3 - T.stealHnd * handler.R.hnd) * (1.12 - T.stealIq * handler.R.iq)
    * (handler.burst > 0 ? T.stealBurst : 1) * (handler.act === 'gather' ? T.stealGather : 1) * (behind ? T.stealBehind : 1), 0, T.stealMax)
  const ok = roll < p
  return { ok, reach: !ok && behind }
}

// A dribble move against his man: frozen, or sat down. dir: the way the burst goes (unit)
export function judgeMove(handler, def, dir, roll1, roll2) {
  if (!def || beaten(def) || dist(def, handler) > T.moveRange) return { freeze: false, ankles: false }
  const lean = clamp(-(def.vx * dir.x + def.vy * dir.y) / def.R.topDef, 0, 1)
  const p = clamp(T.moveBase + T.moveLean * lean + T.moveHnd * (handler.R.hnd - def.R.per) - T.moveIq * (def.R.iq - 0.5), 0.04, 0.85)
  const freeze = roll1 < p
  return { freeze, ankles: freeze && roll2 < T.ankleBase * (0.5 + handler.R.hnd) * (1 + lean) }
}

// A pass going by a defender at its nearest (near: ft from him)
export function judgePick(def, passerR, near, roll) {
  if (beaten(def) || near > T.pickReach) return false
  const p = clamp(T.pickBase * (0.55 + T.pickPer * def.R.per) * (1.35 - T.pickPas * passerR.pas) * (1.15 - T.pickIq * passerR.iq) * (1 - near / T.pickReach) * (def.act === 'jump' ? 1.2 : 1), 0, T.pickMax)
  return roll < p
}

// Two or more under the same ball: who comes down with it. cands: [{ id, R, d (ft from the ball), jump }]
export function judgeBoard(cands, roll) {
  if (cands.length === 1) return cands[0].id
  const w = cands.map(c => (1 + T.boardReb * c.R.reb + T.boardSize * c.R.size + T.boardBnc * c.R.bnc) * (1.3 - 0.3 * clamp(c.d / T.grabDist, 0, 1)) * (c.jump ? 1.25 : 1))
  let t = roll * w.reduce((s, x) => s + x, 0)
  for (let i = 0; i < cands.length; i++) { t -= w[i]; if (t <= 0) return cands[i].id }
  return cands[cands.length - 1].id
}

// Where a miss comes off to: mostly the far side of the rim from the shooter, longer off a long shot
export function reboundSpot(from, d, r1, r2) {
  const out = T.rebMin + (T.rebMax - T.rebMin) * r1 * r1 + T.rebLong * d
  const a = Math.atan2(RIM.y - from.y, RIM.x - from.x) + (r2 - 0.5) * 3.8
  let x = RIM.x + Math.cos(a) * out, y = RIM.y + Math.sin(a) * out
  const board = RIM.y + 0.6
  if (y < board) y = board + (board - y) * 0.6            // off the backboard, back into play
  return { x: clamp(x, COURT.minX + 1.5, COURT.maxX - 1.5), y: clamp(y, COURT.minY + 1.2, COURT.maxY - 2) }
}

// The score: is it over, who won, is it game point
export function scoreState(score, rules = RULES) {
  const hi = Math.max(score[0], score[1]), lead = Math.abs(score[0] - score[1])
  const over = hi >= rules.cap || (hi >= rules.goal && lead >= rules.winBy)
  // game point: the next basket (a two counts) can end it
  const can = t => { const s = score[t] + 2, o = score[1 - t]; return s >= rules.cap || (s >= rules.goal && s - o >= rules.winBy) }
  return { over, winner: over ? (score[0] > score[1] ? 0 : 1) : null, gamePoint: !over && (can(0) || can(1)) }
}
