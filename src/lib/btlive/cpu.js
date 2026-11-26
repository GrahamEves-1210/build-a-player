// BLACKTOP LIVE: the CPU players. cpuInput(state, i, level) returns the input a CPU player makes this tick: the
// same input a thumb makes, through the same step, so a CPU can't do anything a person can't. It sees what's on
// the court, late (a reaction time), and lets go of the meter with a timing error. Its notes live in the state
// (state.cpu[i]) and its rolls are seeded from the state, so a game with CPUs replays exactly. Pure.
//
// A defender stays between his man and the rim, closes out and gets a hand up (not on everything), swipes now
// and then, helps when a teammate is beaten. A scorer takes what his ratings and the defender give: the shot
// worth the most right now, a drive around his man, a pull-up, a post-up, a pass to a better look. Teammates
// space the floor, cut, and crash the glass.
import { HZ, GHZ, DT, PACE, COURT, T, MOVES } from './tune.js'
import { rollAt, gauss } from './rng.js'
import { meterQuality, windowFor, greenOdds, sdFor } from './meter.js'
import * as ref from './referee.js'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const RIM = COURT.rim
const MS = 1000 / HZ                             // a tick on a watch (the meter)
const SPIN_AT = 3                                // ticks into a crossover he reads whether it got him by
const THINK = 4                                  // he thinks again this often (ticks)
const JUMP_LEAD = 6                              // a hand goes up this many ticks before the release it's timed to

// How good the CPU is. meterSd: ms of error on the release. react: ticks before he sees what his man did (the game's
// ticks: a level is as quick against the game at any pace; a person's own reaction is real time: balance.mjs HUMANS).
// contest: how often he gets a hand up on a shot. steal: swipes a second with the ball in reach. help: how often
// he comes over when a teammate is beaten. ev: how far off his judgment of a shot is. move: how often he uses
// a dribble move on a set defender. gap: extra feet he gives his man. jumpSd: ticks off on the timing of a hand up.
// fake: how often he pump-fakes a man closing out on his shot. bite: how readily he goes up for a fake (x the sell)
export const LEVELS = {
  // (the owner, 11-26: "CPU too good on Rookie": a new kid has to be able to beat him: loose on his release, slow to
  // see it, few hands up, rare swipes, late help, poor shots, a big cushion)
  rookie:  { label: 'ROOKIE',   jumpSd: 6, meterSd: 144, react: 15, contest: 0.24, steal: 0.05, help: 0.08, ev: 0.28, move: 0.18, gap: 2.0, fake: 0.04, bite: 1.4 },
  pro:     { label: 'PRO',      jumpSd: 3.5, meterSd: 90,  react: 10, contest: 0.50, steal: 0.11, help: 0.25, ev: 0.15, move: 0.45, gap: 1.0, fake: 0.12, bite: 1.0 },
  allstar: { label: 'ALL-STAR', jumpSd: 2.5, meterSd: 62,  react: 6,  contest: 0.75, steal: 0.17, help: 0.45, ev: 0.08, move: 0.75, gap: 0.4, fake: 0.18, bite: 0.75 },
  legend:  { label: 'LEGEND',   jumpSd: 1.5, meterSd: 42,  react: 4,  contest: 0.92, steal: 0.22, help: 0.60, ev: 0.04, move: 0.92, gap: 0.1, fake: 0.22, bite: 0.55 },
}

const roll = s => rollAt(s.seed ^ 0x5bd1e995, s.cn++)
const ticks = sec => Math.max(1, Math.round(sec * GHZ))
// (counts for the balance scripts: pump fakes a CPU defender read, and how many he went up for)
export const CPU_STATS = { fakes: 0, bites: 0 }
// (left: seconds before a frozen or floored man is back on his feet)
// (a man who bit on a pump fake is out of the play while he comes down: beaten)
const fact = p => ({ id: p.id, x: p.x, y: p.y, vx: p.vx, vy: p.vy, fx: p.fx, fy: p.fy, act: p.bit ? 'frozen' : p.act, actT: p.actT * DT, burst: p.burst, mv: p.mv, R: p.R, bit: p.bit,
  left: p.act === 'frozen' || p.act === 'down' ? Math.max(0, p.actN - p.actT) / HZ : 0 })

// walk to a point: full push far away, a little push close
function steer(p, tx, ty, out, stop = 0.5) {
  tx = clamp(tx, COURT.minX + 1.2, COURT.maxX - 1.2); ty = clamp(ty, COURT.minY + 1.2, COURT.maxY - 1.2)
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy)
  if (d < stop) { out.mx = 0; out.my = 0; return d }
  // (he has weight: coming in at speed he lets up in time to stop on it, not past it and back)
  const vin = (p.vx * dx + p.vy * dy) / d
  if (vin > 2 && vin * vin / (2 * T.brake * 0.8) > d) { out.mx = 0; out.my = 0; return d }
  const m = clamp(d / 2.2, 0.35, 1)
  out.mx = dx / d * m; out.my = dy / d * m
  return d
}

// what a shot from where he stands is worth to him right now (1 = a sure one-pointer)
export function shotValue(s, p, lvl, defs, extra = 0) {
  const d = ref.rimDist(p)
  const kind = d <= T.layRange ? 'layup' : 'jumper'
  const three = kind === 'jumper' && ref.isThree(p.x, p.y)
  // the defense closes while he rises: a man in reach runs at him for as long as the shot takes to go up (less the
  // beat it takes to see it), and gets a hand up. extra: feet more (a pass in the air first)
  const me = fact(p)
  const rise = (kind === 'jumper' ? T.jIdealMs : T.lIdealMs) / 1000
  // a frozen man is only frozen for a moment: he runs at it for whatever is left of the rise after that
  const closed = defs.map(o => {
    const dd = Math.hypot(o.x - p.x, o.y - p.y)
    const run = o.R.topDef * PACE * Math.max(0, rise - 0.12 - (o.left ?? 0)) * 0.9 + extra      // (the rise is real time, his feet are on the game's)
    if (run <= 0.2) return o
    if (dd > T.contestRange + run) return o
    const k = Math.min(run, Math.max(0, dd - T.contestNear)) / (dd || 1)
    return { ...o, x: o.x + (p.x - o.x) * k, y: o.y + (p.y - o.y) * k, act: 'jump' }
  })
  const c = ref.lateContest(ref.contestOf(me, closed, kind).c, ref.contestOf(me, defs.map(ref.handUp), kind).c, kind)
  const cs = p.catchFrom >= 0 && s.tick - p.catchT <= T.csWindow * HZ * 0.6 ? s.players[p.catchFrom].R.pas : null
  // the green window that shot would have (sim.js shotWindow), and how often his release lands in it: that's the make
  const pT = ref.makeChance({ R: p.R, kind, d, past: kind === 'jumper' ? ref.arcPast(p.x, p.y) : 0, c, run: Math.hypot(p.vx, p.vy) / p.R.topBall, cs, rushed: false, sta: p.sta })
  const pMake = greenOdds(windowFor(pT, kind), sdFor(lvl.meterSd, kind))
  // make it, take it: a make is worth its points and the ball back, so a two is worth one and a half ones, not two
  return { v: pMake * (three ? T.twoValue : 1), kind, three, c, d }
}

// what taking his man to the rim is worth: a layup from 4 ft, open if he gets by him (likelier the quicker and
// better handler he is against the man's feet and Perimeter D; a man already sitting back at the rim isn't got by),
// walled up with a hand in his face if he doesn't; less the risk on the way
function driveValue(s, p, D, dD, lvl) {
  const dR = ref.rimDist(p) || 1, ux = (RIM.x - p.x) / dR, uy = (RIM.y - p.y) / dR
  const me = { ...fact(p), x: RIM.x - ux * 4, y: RIM.y - uy * 4, vx: 0, vy: 0 }
  const beaten = !D || D.act === 'frozen' || D.act === 'down' || ref.rimDist(D) > dR + 0.8
  const lay = c => ref.makeChance({ R: p.R, kind: 'layup', d: 4, q: 1, c, run: 0, cs: null, rushed: false })
  const open = lay(0)
  let by = 1, walled = 0
  if (!beaten) {
    walled = lay(ref.contestOf(me, [{ ...fact(D), x: me.x + ux * 3.2, y: me.y + uy * 3.2, vx: 0, vy: 0, act: 'jump' }], 'layup').c)
    // (a man already a long way back toward the rim, sagging or getting back, isn't got by: he's waiting there)
    const back = dR - ref.rimDist(D)
    by = clamp(T.cpuBeat + T.cpuBeatR * ((p.R.spd + p.R.hnd) - (D.R.per + D.R.spd)) / 2, 0.12, 0.75) * clamp(1 - (back - 3.5) / 4, 0.2, 1)
  }
  const rel = x => greenOdds(windowFor(x, 'layup'), sdFor(lvl.meterSd, 'layup'))    // the window that layup would have, and his release in it
  if (beaten) return rel(open) * T.cpuDriveRisk
  return (by * rel(open) + (1 - by) * rel(walled)) * T.cpuDriveRisk
}

// is the lane from a to b clear of defenders
function laneOpen(s, a, b, team) {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1
  for (const o of s.players) {
    if (o.team === team || o.act === 'down' || o.act === 'frozen' || o.out) continue
    const t = clamp(((o.x - a.x) * dx + (o.y - a.y) * dy) / L2, 0, 1)
    if (t < 0.12) continue
    if (Math.hypot(a.x + dx * t - o.x, a.y + dy * t - o.y) < 3.4) return false
  }
  return true
}

// a step behind the line: the corners, the wings, the slots, the top
const ARC = [{ x: 5.0, y: 7.5 }, { x: 51.0, y: 7.5 }, { x: 10.7, y: 24.9 }, { x: 45.3, y: 24.9 }, { x: 18.6, y: 30.2 }, { x: 37.4, y: 30.2 }, { x: 28, y: 32.1 }]
const MID = [{ x: 19.5, y: 20 }, { x: 36.5, y: 20 }, { x: 28, y: 22.5 }, { x: 14.5, y: 11 }, { x: 41.5, y: 11 }]
const LOW = [{ x: 21.5, y: 9 }, { x: 34.5, y: 9 }, { x: 22.5, y: 13.5 }, { x: 33.5, y: 13.5 }]

function nearestDef(s, p) {
  let best = null, bd = 99
  for (const o of s.players) if (o.team !== p.team && !o.out) { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o } }
  return { def: best, d: bd }
}

function pickPlan(s, p, m, only = null) {
  const R = p.R
  const w = {
    drive: 0.25 + R.fin * 0.6 + R.spd * 0.2 + R.hnd * 0.3 + R.bnc * 0.15,
    // (a man sitting back off him is giving him the jumper)
    three: Math.max(0.03, (R.js - 0.45) * 2.2) * (1 + clamp((m.sag ?? 0) - 6, 0, 6) / 2),
    mid: Math.max(0.02, (R.js - 0.5) * 0.6),
    post: R.big ? 0.25 + R.size * 0.7 + R.fin * 0.3 : R.size > 0.7 ? 0.15 : 0,
  }
  if (m.driveOnly) w.three = w.mid = w.post = 0             // (a balance-script bot: drives only)
  if (only) for (const k in w) if (k !== only) w[k] = 0
  let t = roll(s) * (w.drive + w.three + w.mid + w.post)
  m.plan = 'drive'
  for (const k of ['drive', 'three', 'mid', 'post']) { t -= w[k]; if (t <= 0) { m.plan = k; break } }
  // a look at a jumper is a quick one: if the spot isn't there in a second or so, he drives from where he is
  m.planT = s.tick + Math.round((m.plan === 'three' || m.plan === 'mid' ? 1.0 + roll(s) * 0.8 : 2.2 + roll(s) * 1.6) * GHZ)
  m.side = roll(s) < 0.5 ? -1 : 1
  m.spot = null
  if (m.plan === 'three' || m.plan === 'mid') {
    // the spot farthest from the defense, not too far to walk
    const list = m.plan === 'three' ? ARC : MID
    let best = -99
    for (const sp of list) {
      let open = 99
      for (const o of s.players) if (o.team !== p.team && !o.out) open = Math.min(open, Math.hypot(o.x - sp.x, o.y - sp.y))
      const sc = Math.min(open, 9) - Math.hypot(sp.x - p.x, sp.y - p.y) * 0.22 + roll(s) * 3
      if (sc > best) { best = sc; m.spot = sp }
    }
  } else if (m.plan === 'post') m.spot = { x: RIM.x + (p.x < RIM.x ? -5.5 : 5.5), y: 9.5 }
}

// After a stop: where to take it back to, a couple of feet past the arc and away from the two defenders
function pickClear(s, p, m) {
  m.plan = 'clear'; m.planT = s.tick + Math.round(1.2 * GHZ)
  if (!m.side) m.side = roll(s) < 0.5 ? -1 : 1
  let best = -99
  for (const sp of ARC) {
    const ax = sp.x - COURT.arcC.x, ay = sp.y - COURT.arcC.y, a = Math.hypot(ax, ay) || 1
    const at = sp.y <= COURT.arcSideY ? { x: sp.x, y: sp.y } : { x: sp.x + ax / a * 2.5, y: sp.y + ay / a * 2.5 }
    let open = 99
    for (const o of s.players) if (o.team !== p.team && !o.out) open = Math.min(open, Math.hypot(o.x - at.x, o.y - at.y))
    const sc = Math.min(open, 12) - Math.hypot(at.x - p.x, at.y - p.y) * 0.3 + roll(s) * 2
    if (sc > best) { best = sc; m.spot = at }
  }
}

function withBall(s, p, m, lvl, out) {
  const defs = s.players.filter(o => o.team !== p.team && !o.out).map(fact)
  const clockS = s.clock * DT                     // what's left of the shot clock, in the game's seconds (as his plans are)
  // going up: hold the meter, let go with his timing error
  if (p.act === 'gather') {
    // a pump fake: SHOOT let go before the meter is under way (no quality: the step reads it as a fake)
    if (m.faking) { if (p.actT >= 2) { out.shoot = false; m.faking = false } else out.shoot = true; return }
    if (!m.rel) {
      const held = clamp(p.shot.spec.ideal + gauss(roll(s), roll(s)) * sdFor(lvl.meterSd, p.shot.kind), T.minHoldMs, p.shot.spec.total)
      m.rel = { n: Math.max(2, Math.round(held / MS)), held }
    }
    // (judged against the window as it is when he lets go: it moves while he rises)
    if (p.actT >= m.rel.n) { out.shoot = false; out.q = meterQuality(p.shot.spec, m.rel.held); m.rel = null } else out.shoot = true
    if (p.shot && (p.shot.kind === 'layup' || p.shot.kind === 'dunk')) steer(p, RIM.x, RIM.y, out, 1.5)
    return
  }
  m.rel = null
  m.faking = false
  // the fake going up and down: nothing to do till it's done
  if (p.act === 'fake') return
  // his dribble picked up (a fake after he'd dribbled): a shot, a pass or a pivot, nothing else
  if (p.pick) { pickedUp(s, p, m, lvl, out); return }
  m.pickT = null
  // in the post: back him down, then the hook, the drop step, the fadeaway or the fake
  if (p.post) { postUp(s, p, m, lvl, out); return }
  m.driveOnly = !!lvl.driveOnly
  // off a stop (every mode): his side has to take it back past the arc before a basket counts, so no shot till then
  const clearing = s.mustClear === p.team
  if (clearing) { if (m.plan !== 'clear' || s.tick >= m.planT) pickClear(s, p, m) }
  else if (m.plan === 'clear') m.plan = null
  if (m.plan == null) {
    m.gotT = s.tick; m.sag = nearestDef(s, p).d
    // he works for his shot: sizes his man up first, a beat or more (a shooter less, a smart one as long as it takes),
    // and doesn't settle for the first look; off a catch or a board it's quicker
    const fresh = s.tick - p.catchT < 6
    m.work = Math.round((fresh ? 0.25 : 0.75 + 0.9 * roll(s)) * (1.15 - 0.45 * p.R.js) * GHZ)
    m.jab = roll(s) < 0.5 ? -1 : 1; m.jabbed = false; m.commit = 0
  }
  if (m.plan == null) pickPlan(s, p, m)
  else if (s.tick >= m.planT && !clearing) { if (m.plan === 'three' || m.plan === 'mid') { m.plan = 'drive'; m.planT = m.commit = s.tick + Math.round(2 * GHZ) } else pickPlan(s, p, m) }
  if (s.tick >= (m.thinkT ?? 0)) { m.thinkT = s.tick + THINK; m.noise = (roll(s) - 0.5) * 2 * lvl.ev; m.go = roll(s) }
  const { def: D, d: dD } = nearestDef(s, p)
  // a crossover his man has stayed in front of: now and then he spins back the other way off it (a second flick,
  // round from the first, while the move is on: the same thing a thumb does)
  if (p.burst > 0 && p.mv === MOVES.cross.n && p.bn - p.burst === SPIN_AT && D && dD < 4.8 && D.act === 'free' && roll(s) < lvl.move * 0.6) {
    if (((D.x - p.x) * p.bdx + (D.y - p.y) * p.bdy) / (dD || 1) > 0.3) {
      const dR = ref.rimDist(p) || 1, ux = (RIM.x - p.x) / dR, uy = (RIM.y - p.y) / dR, k = 2 * (ux * p.bdx + uy * p.bdy)
      const rx = k * ux - p.bdx, ry = k * uy - p.bdy
      // (the thumb rolls it round: sp, the way it rolls)
      if (ref.inBounds(p.x + rx * 6.5, p.y + ry * 6.5, -1) && ref.spinTurn(p, { x: rx, y: ry })) { out.mx = rx; out.my = ry; out.dx = rx; out.dy = ry; out.sp = p.bdx * ry - p.bdy * rx >= 0 ? 1 : -1; m.side = -m.side; m.sideT = s.tick + Math.round(GHZ); return }
    }
  }
  const mine = shotValue(s, p, lvl, defs)
  const dRim = mine.d
  // his man sitting back at the rim (camped in the paint, or sagged way off him): he isn't driven on, he's shot over
  // (not while he's going to the rim off a jumper he gave up on: that's his read made, see below)
  const sitting = !clearing && s.tick >= (m.commit ?? 0) && D && dD > 6.5 && ref.rimDist(D) < Math.min(10, dRim - 5) && D.act !== 'frozen' && D.act !== 'down'
  if (sitting && m.plan !== 'three' && m.plan !== 'mid') pickPlan(s, p, m, p.R.js > 0.45 ? 'three' : 'mid')
  const beat = !clearing && (!D || D.act === 'frozen' || D.act === 'down' || ref.rimDist(D) > dRim + 0.8)
  // how good a shot has to be: a good one early, any shot late (a low IQ lets the clock run down further)
  const late = 1.3 + 1.0 * p.R.iq
  const held = (s.tick - (m.gotT ?? s.tick)) * DT
  const working = !clearing && s.tick - (m.gotT ?? s.tick) < (m.work ?? 0)
  let need = clockS <= late ? -1 : clamp(T.cpuNeed - Math.max(0, 8 - clockS) * 0.05 - held * T.cpuHurry, 0.3, T.cpuNeed)
  // a contested jumper is the worst shot there is: with time left to get to the rim, he goes and gets a layup instead
  // (a smart player sees it sooner)
  // (and a jumper better than the drive is the shot: a man who sags off a shooter gets shot over)
  const toRim = Math.max(0, dRim - 4.5) / p.R.topBall + 0.5
  if (mine.kind === 'jumper' && clockS > toRim + 0.3 + 0.5 * (1 - p.R.iq)) need = clockS <= late ? need : clamp(driveValue(s, p, D, dD, lvl) + T.cpuJumpEdge - Math.max(0, held - 2) * T.cpuHurry, 0.3, T.cpuDriveV)
  if (sitting && mine.kind === 'jumper' && clockS > late) need = Math.min(need, Math.max(T.cpuSitV, driveValue(s, p, D, dD, lvl)))
  // on his way out to the arc for a three: no long two on the way (unless it's a better shot than the three would be)
  if (m.plan === 'three' && mine.kind === 'jumper' && !mine.three && clockS > 4) need = Math.max(need, Math.min(0.6, mine.v * T.twoValue))
  if (mine.kind === 'jumper' && need >= T.cpuDriveV && clockS < 5.5 && m.plan !== 'drive' && mine.v < need) m.plan = 'drive'
  // a better look for a teammate
  // (taking it back: a teammate already behind the arc is a way to do it)
  if (s.size > 1 && p.noAct <= 0) {
    let to = null, tv = 0
    const called = s.call && s.tick - s.call.tick < 24 ? s.call.pid : -1
    for (const o of s.players) {
      if (o.team !== p.team || o === p) continue
      if (clearing && !ref.behindArc(o.x, o.y, T.clearPast + 1)) continue
      if (!laneOpen(s, p, o, p.team)) continue
      if (o.i === called) { to = o; tv = 9; break }
      const v = shotValue(s, o, lvl, defs, Math.hypot(o.x - p.x, o.y - p.y) / p.R.passSpeed * 9).v      // his man closes while the pass is in the air
      if (v > tv) { tv = v; to = o }
    }
    const held = s.tick - Math.max(p.catchT, m.gotT ?? 0) > 0.7 * GHZ
    const want = tv >= 9 || (clearing && to && ref.rimDist(p) < 18) || (held && tv > mine.v + 0.15 + m.noise && tv > need - 0.05) || (clockS < 4 && tv > mine.v + 0.05)
    if (to && want && clockS > 2.2 && (tv >= 9 || m.go < 0.5 + 0.4 * p.R.iq)) {
      const dx = to.x - p.x, dy = to.y - p.y, d = Math.hypot(dx, dy) || 1
      out.mx = dx / d; out.my = dy / d; out.pass = true
      m.plan = null
      return
    }
  }
  // a jumper with a hand in his face isn't a shot unless the clock says so (a great shooter takes a little more of
  // one); sizing his man up, only a wide-open look goes
  const handy = mine.kind === 'jumper' && mine.c > 0.38 + 0.25 * (p.R.jsRaw ?? p.R.js) && clockS > late
  const wide = mine.c < 0.12
  // a layup from the edge of the paint into a man set in front of it isn't a shot: he keeps working to the rim
  const walled = mine.kind !== 'jumper' && mine.d > 4.6 && mine.c > 0.45 && clockS > late
  if (!clearing && p.noAct <= 0 && (!working || wide || clockS <= late) && !handy && !walled && mine.v + m.noise >= need && (mine.kind !== 'jumper' || clockS <= late || mine.v >= 0.3)) {
    // a jumper on the run with his man not on him yet: he squares up and sets his feet first (a beat to stop)
    if (mine.kind === 'jumper' && Math.hypot(p.vx, p.vy) > 0.45 * p.R.topBall && dD > 4.5 && clockS > 2.5) { out.mx = 0; out.my = 0; return }
    // his man flying at him: now and then a pump fake first (never twice, never with the clock nearly gone)
    if (fakeNow(s, p, D, dD, lvl, clockS)) { out.shoot = true; m.faking = true; return }
    out.shoot = true; return
  }
  // near the rim with a step on his man, or stuck under it: go up
  if (!clearing && dRim <= (beat ? 5.4 : 4.6) && p.noAct <= 0) { out.shoot = true; return }
  // sizing him up out top: a jab, a shimmy one way and back, the ball live; now and then a move to get him leaning
  if (working && !clearing && D && dD < 7.5 && dRim > 15 && s.tick - (m.gotT ?? s.tick) < (m.work ?? 0) * 0.7) {
    const dR = dRim || 1, ux = (RIM.x - p.x) / dR, uy = (RIM.y - p.y) / dR
    if (s.tick % 14 === 0) m.jab = -m.jab
    out.mx = -uy * m.jab * 0.4 + ux * 0.12; out.my = ux * m.jab * 0.4 + uy * 0.12
    if (!m.jabbed && dD < 5.2 && p.moveCd <= 0 && p.frzCd <= 0 && s.tick - m.gotT > 8 && roll(s) < lvl.move * 0.05) {
      m.jabbed = true
      const go = { x: ux * 0.7 - uy * m.jab * 0.7, y: uy * 0.7 + ux * m.jab * 0.7 }, f = ref.flickFor(p, go)
      if (ref.inBounds(p.x + go.x * 6.5, p.y + go.y * 6.5, -1)) { out.dx = f.x; out.dy = f.y; out.mx = go.x; out.my = go.y }
    }
    return
  }
  // otherwise move: the plan's target
  let tx = RIM.x, ty = RIM.y + 1.5
  if (clearing) { tx = m.spot.x; ty = m.spot.y }
  else if (m.plan === 'three' || m.plan === 'mid') {
    tx = m.spot.x; ty = m.spot.y
    if (Math.hypot(tx - p.x, ty - p.y) < 1.2) {
      // on his spot and still covered: make space with a move, or go
      if (dD < 5.1 && p.moveCd <= 0 && p.frzCd <= 0 && m.go < lvl.move) {
        // (straight back off him, a touch to one side: the step-back; now and then more across: behind the back)
        const ax = p.x - D.x, ay = p.y - D.y, a = Math.hypot(ax, ay) || 1, across = m.go < lvl.move * 0.3 ? 0.8 : 0.3
        out.mx = ax / a * (across > 0.5 ? 0.6 : 0.95) + (-ay / a) * m.side * across; out.my = ay / a * (across > 0.5 ? 0.6 : 0.95) + (ax / a) * m.side * across
        const l = Math.hypot(out.mx, out.my) || 1
        out.mx /= l; out.my /= l
        if (ref.inBounds(p.x + out.mx * 6.5, p.y + out.my * 6.5, -1)) { const f = ref.flickFor(p, { x: out.mx, y: out.my }); out.dx = f.x; out.dy = f.y; return }
        m.side = -m.side
      }
      // covered on his spot and no move to make: he doesn't stand there, he goes
      // (and he goes now, and keeps going: it used to aim this tick at the spot he stood on, a step back, and with
      // his man sat in the paint the next tick put him back on the jumper, on the same spot, which sent him to the
      // rim again: a step each way, over and over, in the corner)
      if (p.moveCd > 0 || p.frzCd > 0 || s.tick > m.planT - GHZ || m.go >= lvl.move) { m.plan = 'drive'; m.planT = m.commit = s.tick + Math.round(2 * GHZ); tx = RIM.x; ty = RIM.y + 1.5 }
    }
  } else if (m.plan === 'post') {
    if (m.spot && Math.hypot(m.spot.x - p.x, m.spot.y - p.y) < 2.5) m.spot = null
    if (m.spot) { tx = m.spot.x; ty = m.spot.y }
    // getting nowhere on his way to the block (his man holding him off out on the wing, a line beside him): he stops
    // backing in and takes him off the dribble instead
    const left = m.spot ? Math.hypot(m.spot.x - p.x, m.spot.y - p.y) : 0
    if (!m.spot || m.postN !== s.possN || left < (m.postD ?? 99) - 1) { m.postD = left; m.postT = s.tick; m.postN = s.possN }
    else if (s.tick - m.postT > Math.round(0.8 * GHZ)) { m.plan = 'drive'; m.postD = 99; m.planT = m.commit = s.tick + Math.round(2 * GHZ); tx = RIM.x; ty = RIM.y + 1.5 }
  }
  // around the man in the way
  let dirx = tx - p.x, diry = ty - p.y
  const dl = Math.hypot(dirx, diry) || 1
  dirx /= dl; diry /= dl
  if (D && !beat && dD < 6.4 && m.plan !== 'post') {
    const inWay = ((D.x - p.x) * dirx + (D.y - p.y) * diry) / (dD || 1)
    if (inWay > 0.35) {
      // which side: away from where he's leaning, kept for a while
      if (s.tick >= (m.sideT ?? 0)) {
        const lat = D.vx * -diry + D.vy * dirx
        m.side = Math.abs(lat) > 1.5 ? (lat > 0 ? -1 : 1) : m.side
        m.sideT = s.tick + Math.round(GHZ)
      }
      let ang = (dD < 4.2 ? 1.05 : 0.6) * m.side
      // (not the side with a line on it: that way the line takes the step away and he only runs into his man, in
      // the corner, again and again. He goes round the other side, and keeps to it)
      const room = a => ref.inBounds(p.x + (dirx * Math.cos(a) - diry * Math.sin(a)) * 3, p.y + (dirx * Math.sin(a) + diry * Math.cos(a)) * 3, -2.4)
      if (!room(ang) && room(-ang)) { m.side = -m.side; m.sideT = s.tick + Math.round(GHZ); ang = -ang }
      const cx = dirx * Math.cos(ang) - diry * Math.sin(ang), cy = dirx * Math.sin(ang) + diry * Math.cos(ang)
      dirx = cx; diry = cy
      // (no dribble move with a line at his feet: the burst would carry him over it)
      if (dD < 5.0 && p.moveCd <= 0 && p.frzCd <= 0 && m.go < lvl.move * 0.5 && ref.inBounds(p.x, p.y, -4.5) && ref.inBounds(p.x + dirx * 6.5, p.y + diry * 6.5, -1)) { const f = ref.flickFor(p, { x: dirx, y: diry }); out.mx = dirx; out.my = diry; out.dx = f.x; out.dy = f.y; return }
    }
  }
  // keep it in bounds: a step that would take him over a line loses the part of it going that way (he slides along
  // the line), looking no farther ahead than his spot. (It used to turn him round toward the rim whenever a point
  // 3 ft ahead was out, so going to a spot near a line, the corner three above all, he turned round, took a step,
  // turned back and went again: back and forth in the corner for as long as the plan lasted.)
  const look = Math.min(3, dl)
  const nx = p.x + dirx * look, ny = p.y + diry * look
  let kx = dirx, ky = diry
  // ...but a man already at the line, or carrying over it (his speed that way), is pushed back off it. Every spot he
  // goes to is farther in than that, so the push never fights his spot
  // (the baseline keeps him farther off it than a sideline: no spot is near it, and a man going along it with his
  // defender on his hip gets leaned out over it)
  const near = (d, vOut, band = 1.6) => d - Math.max(0, vOut) * 0.3 < band
  if (near(p.x - COURT.minX, -p.vx)) kx = Math.abs(kx) + 0.3; else if (near(COURT.maxX - p.x, p.vx)) kx = -Math.abs(kx) - 0.3
  else if ((nx < COURT.minX + 1.6 && kx < 0) || (nx > COURT.maxX - 1.6 && kx > 0)) kx = 0
  if (near(p.y - COURT.minY, -p.vy, 3)) ky = Math.abs(ky) + 0.3; else if (near(COURT.maxY - p.y, p.vy)) ky = -Math.abs(ky) - 0.3
  else if ((ny < COURT.minY + 1.6 && ky < 0) || (ny > COURT.maxY - 1.6 && ky > 0)) ky = 0
  const kl = Math.hypot(kx, ky)
  // (and he slows into a spot rather than running through it: one by a line he'd carry over it)
  const arrive = clearing || m.plan === 'three' || m.plan === 'mid' ? clamp(dl / 2.2, 0.35, 1) : 1
  if (kl > 0.25) { out.mx = kx / kl * arrive; out.my = ky / kl * arrive; return }
  // (nothing left of it: straight for his spot, which is in bounds)
  steer(p, tx, ty, out, 0.5)
}

// a pump fake now, at a man closing out on him (in front, close, coming at him or set up to contest)
function fakeNow(s, p, D, dD, lvl, clockS) {
  if (!D || p.fakeN > 0 || clockS < 3 || dD > 5.6 || dD < 2.5 || D.act !== 'free') return false
  const toMe = ((p.x - D.x) * D.vx + (p.y - D.y) * D.vy) / (dD || 1)
  const front = ((D.x - p.x) * (RIM.x - p.x) + (D.y - p.y) * (RIM.y - p.y)) / ((dD || 1) * (ref.rimDist(p) || 1)) > 0.3
  return front && (toMe > 2 || dD < 4.2) && roll(s) < lvl.fake * (0.6 + 0.6 * p.R.iq)
}
// Picked up: his man bit, so shoot (from close, a step through first: the up-and-under); else a pass if there's one,
// else he shoots it
function pickedUp(s, p, m, lvl, out) {
  if (m.pickT == null) m.pickT = s.tick
  const clearing = s.mustClear === p.team
  const open = p.openT > s.tick, d = ref.rimDist(p)
  if (open && d <= T.uauRange && !clearing) {
    const stepped = ref.rimDist({ x: p.pvx, y: p.pvy }) - d
    if (stepped < 0.8 && s.tick - m.pickT < GHZ) { out.mx = (RIM.x - p.x) / (d || 1); out.my = (RIM.y - p.y) / (d || 1); return }
    out.shoot = true; return
  }
  if (open && !clearing) { out.shoot = true; return }
  if (s.size > 1 && p.noAct <= 0) {
    const defs = s.players.filter(o => o.team !== p.team && !o.out).map(fact)
    let to = null, tv = 0.25
    for (const o of s.players) {
      if (o.team !== p.team || o === p || !laneOpen(s, p, o, p.team)) continue
      if (clearing && !ref.behindArc(o.x, o.y, T.clearPast + 1)) continue
      const v = shotValue(s, o, lvl, defs, Math.hypot(o.x - p.x, o.y - p.y) / p.R.passSpeed * 9).v
      if (v > tv) { tv = v; to = o }
    }
    if (to) { const dx = to.x - p.x, dy = to.y - p.y, l = Math.hypot(dx, dy) || 1; out.mx = dx / l; out.my = dy / l; out.pass = true; return }
  }
  if (s.tick - m.pickT >= Math.round(0.35 * GHZ) && !clearing) out.shoot = true
}
// In the post: back his man down a few bumps (more against a smaller man, fewer against one he can't move), then the
// shot: the hook from close, the drop step when he has the edge or his man is leaning, the fadeaway against a man he
// can't move, a fake now and then. Out of it (faces up) if he's getting nowhere a long way out
function postUp(s, p, m, lvl, out) {
  const d = ref.rimDist(p) || 1, ux = (RIM.x - p.x) / d, uy = (RIM.y - p.y) / d
  const D = p.postBy >= 0 ? s.players[p.postBy] : null
  const key = s.possN * 1000 + (p.catchT & 255)
  if (m.postKey !== key) {
    m.postKey = key; m.postAt = s.tick; m.postGoal = 5.5 + roll(s) * 3; m.postBumps = 0
    m.postPick = roll(s)                                    // which finish he goes to, decided once
    // (he went there to post up; stopped on a drive he plays it from there now and then, else faces up)
    m.postPlay = m.plan === 'post' || roll(s) < 0.3
  }
  if (!m.postPlay) { out.mx = -ux * 0.3; out.my = -uy * 0.3; out.dx = -ux; out.dy = -uy; return }
  const clockS = s.clock * DT
  const edge = D ? (p.R.sizeRaw ?? p.R.size) - (D.R.sizeRaw ?? D.R.size) : 0.5
  const t = (s.tick - m.postAt) * DT
  // backing: until he's where he wants to be, or it's taking too long, or the clock says go
  if (d > m.postGoal && t < 1.6 + 1.2 * clamp(edge + 0.3, 0, 1) && clockS > 3) {
    out.mx = ux; out.my = uy
    // stuck out on the wing against a man he can't move: face up
    if (t > 1.2 && d > 11 && edge < -0.1) { out.mx = -ux; out.my = -uy; out.dx = -ux; out.dy = -uy }
    return
  }
  // the finish
  if (p.moveCd > 0 || p.noAct > 0) return
  const r = m.postPick
  if (D && D.act === 'free' && r < 0.25 + 0.3 * clamp(edge, 0, 1) && d < 10) {
    // a drop step or the spin: to the side his man isn't leaning (or the baseline)
    const rx = -uy, ry = ux, lat = D.vx * rx + D.vy * ry, side = Math.abs(lat) > 0.6 ? -Math.sign(lat) : (roll(s) < 0.5 ? -1 : 1)
    out.dx = rx * side; out.dy = ry * side; m.postPick = 1
    return
  }
  // (the fadeaway: a big who can shoot it against a man as big as him; the stick away from the rim as he goes up)
  if (r > 0.82 && p.R.js > 0.5 && edge < 0.1) { out.mx = -ux; out.my = -uy; out.shoot = true; return }
  if (fakeNow(s, p, D ? fact(D) : null, D ? Math.hypot(D.x - p.x, D.y - p.y) : 99, lvl, clockS)) { out.shoot = true; m.faking = true; return }
  out.shoot = true
}

// going after a ball that's up or loose; true if he's handling it
function chaseBall(s, p, m, lvl, out) {
  const b = s.ball
  // his own shot: he doesn't follow every one (the owner, 11-26: "CPU grabs its own rebound every time"). Decided once a
  // shot: a crasher goes (more often the better rebounder he is); else he lands, holds a beat and only then goes for it
  if ((b.st === 'shot' || (b.st === 'loose' && b.reb)) && b.from === p.i) {
    const key = s.possN * 4096 + Math.round(b.sx * 37 + b.sy)
    if (m.crashKey !== key) { m.crashKey = key; m.crash = roll(s) < T.cpuCrash + T.cpuCrashReb * p.R.reb }
    if (!m.crash && (b.st === 'shot' || b.t < ticks(T.cpuHold))) { out.mx = 0; out.my = 0; return true }
  }
  if (b.st === 'shot') {
    // get inside position: bigs under it, guards a step out; a defender boxes out, between his man and the rim
    const man = p.team !== s.poss && p.man >= 0 ? s.players[p.man] : null
    // a shot at the rim: the defender turns and goes to where it comes off (he's between the shooter and the glass)
    if (man && b.from === man.i && (b.kind !== 'jumper' || (b.verdict?.d ?? 20) < 10)) { steer(p, b.tx, b.ty, out, 0.4); return true }
    if (man) {
      const ax = man.x - RIM.x, ay = Math.max(1, man.y - RIM.y), a = Math.hypot(ax, ay) || 1
      const r = clamp(a - 2.6, 3.0, 7.5)
      steer(p, RIM.x + ax / a * r, RIM.y + ay / a * r, out, 0.5)
      return true
    }
    const r = p.pos === 'big' ? 4.5 : 8.5
    const ax = p.x - RIM.x, ay = Math.max(1, p.y - RIM.y), a = Math.hypot(ax, ay) || 1
    steer(p, RIM.x + ax / a * r, RIM.y + ay / a * r, out, 1)
    return true
  }
  if (b.st !== 'loose') return false
  const air = b.z > 0.5 || b.vz !== 0
  const tx = b.reb && air ? b.tx : b.x + b.vx * 0.25, ty = b.reb && air ? b.ty : b.y + b.vy * 0.25
  // not everyone runs at a long rebound: the nearest two on each side go
  let nearer = 0
  for (const o of s.players) if (o.team === p.team && o !== p && Math.hypot(o.x - tx, o.y - ty) < Math.hypot(p.x - tx, p.y - ty)) nearer++
  if (nearer >= 2) return false
  steer(p, tx, ty, out, 0.4)
  const d = Math.hypot(p.x - b.x, p.y - b.y)
  if (d <= p.R.grab - 0.3 && b.z > p.R.standReach && b.z <= p.R.jumpReach + 0.5 && p.act === 'free' && roll(s) < lvl.contest * 0.5) out.jump = true
  return true
}

function defend(s, p, m, lvl, out) {
  const b = s.ball
  const man = s.players[p.man]
  const h = b.st === 'held' ? s.players[b.holder] : b.st === 'pass' ? s.players[b.to] : null
  // what he sees of his man is a beat old
  const hist = m.hist ?? (m.hist = [])
  hist.push(man.x, man.y, man.vx, man.vy)
  // ...and later against a man who can shoot: he has to respect the jumper, so the first step gets on him a beat late
  // (a man who can't shoot gets played for the drive)
  const react = Math.max(1, lvl.react + Math.round((man.R.js - 0.55) * T.cpuRespect))
  while (hist.length > react * 4 + 4) hist.splice(0, 4)
  // ...and he reads where the man is going from it: a steady run is tracked, a change of direction is seen late
  const lead = (hist.length / 4 - 1) * DT + 0.08
  const mx = hist[0] + hist[2] * lead, my = hist[1] + hist[3] * lead
  const onBall = h === man
  const dRimM = Math.hypot(RIM.x - mx, RIM.y - my) || 1
  const ux = (RIM.x - mx) / dRimM, uy = (RIM.y - my) / dRimM
  let tx, ty
  // King of the Hill: two on the king. The nearer one plays him; the other one sits back between him and the rim
  // (and goes up with him when he shoots close by)
  if (s.mode === 'koth' && onBall) {
    const o = s.players.find(q => q.team !== s.poss && q !== p && !q.out)
    if (o && (m.roleN !== s.possN || s.tick >= (m.roleT ?? 0))) {
      m.roleN = s.possN; m.roleT = s.tick + Math.round(GHZ)
      const dp = Math.hypot(man.x - p.x, man.y - p.y), dq = Math.hypot(man.x - o.x, man.y - o.y)
      // (an even split, as at the check, goes by a turn that moves on every possession: not always the same seat)
      m.help = dp > dq + 0.5 || (Math.abs(dp - dq) <= 0.5 && (p.i + s.possN) % 3 > (o.i + s.possN) % 3)
    }
    if (o && m.help) {
      const side = ((p.x - man.x) * uy - (p.y - man.y) * ux) >= 0 ? 1 : -1
      const back = Math.min(dRimM * 0.45, Math.max(0, dRimM - 3))
      tx = mx + ux * back + uy * 2.2 * side; ty = my + uy * back - ux * 2.2 * side
      if (man.act === 'gather') {
        const key = s.tick - man.actT, dd = Math.hypot(man.x - p.x, man.y - p.y)
        if (m.hKey !== key && man.actT >= Math.min(lvl.react, 6)) { m.hKey = key; m.hUp = roll(s) < lvl.contest * 0.6 }
        if (m.hKey === key && m.hUp && dd <= 5.6 && p.act === 'free') { out.jump = true; m.hUp = false }
      }
      steer(p, tx, ty, out, 0.35)
      return
    }
  }
  if (onBall && man.act === 'fake') {
    // a pump fake: he goes up for it or he doesn't (the sell: how much of a shot it is from there, the shooter's
    // read; his own IQ; his level), decided once, a beat in (his reaction)
    const key = s.tick - man.actT
    if (m.fKey !== key) {
      m.fKey = key
      const d = ref.rimDist(man), kind = d <= T.layRange ? 'layup' : 'jumper'
      const threat = clamp(ref.makeChance({ R: man.R, kind, d, past: kind === 'jumper' ? ref.arcPast(man.x, man.y) : 0, c: 0, run: 0 }) / 0.55, 0, 1)
      const sell = clamp(T.sell0 + T.sellShot * threat + T.sellIq * man.R.iq, 0.1, 1) * Math.pow(T.sellAgain, Math.max(0, (man.fakeN || 1) - 1))
      m.fBite = roll(s) < clamp(sell * (T.bite0 - T.biteIq * (p.R.iq - 0.5)) * (lvl.bite ?? 1), 0.02, 0.9)
      m.fAt = clamp(Math.round(lvl.react * 0.35), 1, 4)
      CPU_STATS.fakes++; if (m.fBite) CPU_STATS.bites++
    }
    const dd = Math.hypot(man.x - p.x, man.y - p.y)
    if (m.fBite && man.actT >= m.fAt && p.act === 'free' && dd <= 7.5) { out.jump = true; m.fBite = false }
    // (and he doesn't move off his spot for it)
    out.mx = 0; out.my = 0
    return
  }
  if (onBall && man.post && man.act === 'free') {
    // guarding the post: bodied up behind him, between him and the rim, leaning into him (he has to move him; he
    // doesn't step up and back with every bump)
    const dd = Math.hypot(man.x - p.x, man.y - p.y) || 1, dR = ref.rimDist(man) || 1
    const sx = man.x + (RIM.x - man.x) / dR * 3.1, sy = man.y + (RIM.y - man.y) / dR * 3.1
    // (one steady push: to his spot, and into the man; never a step up and a step back)
    const vx = sx - p.x + (man.x - p.x) / dd * 0.5, vy = sy - p.y + (man.y - p.y) / dd * 0.5, vl = Math.hypot(vx, vy) || 1, k = clamp(vl / 2, 0.3, 1)
    out.mx = vx / vl * k; out.my = vy / vl * k
    return
  }
  if (onBall) {
    // up on a shooter in his range, off a man who can't shoot, tight near the rim
    // (a step off a man who can't shoot: more than that only gives him a running start)
    const shooter = man.R.js > 0.45 && dRimM > 14 && dRimM < 31
    let gap = (dRimM < 10 ? 3.2 : shooter ? 3.3 : dRimM > 26 ? 4.2 : 3.6) + lvl.gap
    // a man standing still out there is looking to shoot: up on him
    if (dRimM > 19 && Math.hypot(man.vx, man.vy) < 1.5 && man.R.js > 0.5) gap = Math.min(gap, 2.9 + lvl.gap * 0.5)
    // ...and a great shooter out there gets no air at all: make him put it on the floor
    if (dRimM > 19 && man.R.js > 0.92 && ref.isThree(man.x, man.y)) gap = Math.min(gap, 2.3 + lvl.gap * 0.5)
    if (man.act === 'gather') gap = 2.5
    // in the post: bodied up on him, between him and the rim; picked up: all over him (he can't go anywhere)
    if (man.post) gap = 3.05
    else if (man.pick) gap = 3.15
    gap = Math.min(gap, Math.max(0.5, dRimM - 1.2))
    tx = mx + ux * gap; ty = my + uy * gap
    const dd = Math.hypot(man.x - p.x, man.y - p.y)
    // on his hip as he drives (beside him, not yet in front): don't run into him, race him to a spot down his line
    // and cut in front there (running into his body only takes the speed off)
    const mv = Math.hypot(man.vx, man.vy)
    // (not every time: a read he makes on some drives, more often the better he is)
    if (m.raceN !== s.possN) { m.raceN = s.possN; m.races = roll(s) < T.cpuRace * lvl.contest }
    if (m.races && dd < 4.6 && mv > 5 && man.act === 'free' && dRimM > 6) {
      const vx = man.vx / mv, vy = man.vy / mv
      const ahead = ((p.x - man.x) * vx + (p.y - man.y) * vy) / (dd || 1)
      if (ahead < 0.55 && vx * ux + vy * uy > 0.3) {
        const side = ((p.x - man.x) * -vy + (p.y - man.y) * vx) >= 0 ? 1 : -1
        tx = man.x + vx * 5.5 - vy * side * 2.4; ty = man.y + vy * 5.5 + vx * side * 2.4
      }
    }
    if (man.act === 'gather') {
      // a hand up, timed to the release (decided once a shot, after his reaction)
      const key = s.tick - man.actT
      if (man.actT >= Math.min(lvl.react, 6) && m.cKey !== key) {
        m.cKey = key
        const ideal = Math.round(man.shot.spec.ideal / MS)
        // (his timing is as good as his level: off by a few ticks either way, late or early)
        m.cAt = roll(s) < lvl.contest ? Math.max(man.actT, ideal - JUMP_LEAD + Math.round(gauss(roll(s), roll(s)) * (lvl.jumpSd ?? 3))) : -1
      }
      if (m.cKey === key && m.cAt >= 0 && man.actT >= m.cAt && dd <= 5.8 && p.act === 'free') { out.jump = true; m.cAt = -1 }
    } else if (p.stealCd <= 0 && dd <= T.stealReach - 0.3 && man.burst <= 0 && p.act === 'free' && man.noAct <= 0) {
      const front = ((p.x - man.x) * man.fx + (p.y - man.y) * man.fy) / (dd || 1) > 0
      if (front && roll(s) < lvl.steal / GHZ) out.steal = true
    }
  } else {
    // off the ball: between his man and the rim, a step toward the ball
    tx = mx + ux * dRimM * 0.24; ty = my + uy * dRimM * 0.24
    if (h) { tx += (h.x - tx) * 0.1; ty += (h.y - ty) * 0.1 }
    // a big on the block, the ball out top: front him (a smaller man, between him and the ball) or play behind him,
    // a hand on him, a step to the ball side (three-quarters)
    if (h && h.team !== p.team && man.pos === 'big' && dRimM < 11 && Math.hypot(h.x - mx, h.y - my) > 9) {
      if (m.frontN !== s.possN) { m.frontN = s.possN; m.fronts = (p.R.sizeRaw ?? p.R.size) < (man.R.sizeRaw ?? man.R.size) - 0.1 ? roll(s) < 0.7 : roll(s) < 0.25 }
      const bx = h.x - mx, by = h.y - my, bl = Math.hypot(bx, by) || 1
      // (a body's width off him: on him, not into him)
      if (m.fronts) { tx = mx + bx / bl * 3.4; ty = my + by / bl * 3.4 }
      else { const vx = ux * 3.2 + bx / bl * 1.2, vy = uy * 3.2 + by / bl * 1.2, vl = Math.hypot(vx, vy) || 1; tx = mx + vx / vl * 3.4; ty = my + vy / vl * 3.4 }
    }
    if (b.st === 'pass' && b.to === man.i) { tx = mx + ux * 3.4; ty = my + uy * 3.4 }
    else if (h && h.team !== p.team) {
      // help: the handler has a step on his man and is coming
      const hd = s.players.find(o => o.man === h.i && o.team === p.team)
      const hr = ref.rimDist(h)
      const beaten = !hd || hd.act === 'frozen' || hd.act === 'down' || ref.rimDist(hd) > hr + 0.6
      if (m.helpN !== s.possN) { m.helpN = s.possN; m.helps = roll(s) < lvl.help }
      if (beaten && hr < 10 && m.helps) {
        let closer = false
        for (const o of s.players) if (o.team === p.team && o !== p && o !== hd && ref.rimDist(o) < ref.rimDist(p)) closer = true
        if (!closer) {
          const k = Math.min(3.2, hr * 0.5)
          tx = RIM.x + (h.x - RIM.x) / (hr || 1) * k; ty = RIM.y + (h.y - RIM.y) / (hr || 1) * k
          const dd = Math.hypot(h.x - p.x, h.y - p.y)
          if (h.act === 'gather' && dd <= 5.6 && p.act === 'free' && h.actT >= 2 && roll(s) < lvl.contest * 0.4) out.jump = true
        }
      }
    }
  }
  // (off the ball he doesn't chase every half step his man's feet make: what he sees of a man shuffling in place,
  // led a beat ahead, swings a foot either way, and stepping at each swing had him rocking side to side)
  steer(p, tx, ty, out, onBall ? 0.35 : 1.0)
}

function offBall(s, p, m, lvl, out) {
  const b = s.ball
  const h = b.st === 'held' ? s.players[b.holder] : null
  if (b.st === 'pass' && b.to === p.i) { out.mx = 0; out.my = 0; return }
  // reads off the ball, before the plan: the man with it driving, his own man helping off him
  if (h && h.team === p.team && m.read !== s.possN * 1000 + (h.i + 1) * 7 + Math.floor(s.tick / 9)) {
    m.read = s.possN * 1000 + (h.i + 1) * 7 + Math.floor(s.tick / 9)
    const hr = ref.rimDist(h), hv = Math.hypot(h.vx, h.vy)
    const driving = hr < 18 && hv > 4 && (h.vx * (RIM.x - h.x) + h.vy * (RIM.y - h.y)) / (hr * hv || 1) > 0.5
    const myD = s.players.find(o => o.team !== p.team && !o.out && o.man === p.i)
    const helping = myD && Math.hypot(myD.x - p.x, myD.y - p.y) > 7 && Math.hypot(myD.x - h.x, myD.y - h.y) < Math.hypot(myD.x - p.x, myD.y - p.y)
    if (driving && !m.cut && m.drift !== s.possN) {
      // he drives: get out of the way and give him a target, the spot behind the arc farthest from the drive (the
      // drift to the corner or the slot), so his man has to choose
      m.drift = s.possN
      let best = -99
      for (const sp of ARC) { const sc = Math.hypot(sp.x - h.x, sp.y - h.y) - Math.hypot(sp.x - p.x, sp.y - p.y) * 0.35; if (sc > best) { best = sc; m.spot = sp } }
      m.spotT = s.tick + Math.round(1.6 * GHZ); m.cut = false
    } else if (helping && !m.cut && ref.rimDist(p) > 9 && roll(s) < 0.35 + 0.4 * p.R.iq) {
      // his man has left him to help: cut behind him to the rim (or a big dives), else spot up where the pass can find him
      m.spot = { x: RIM.x + (p.x < RIM.x ? -2.5 : 2.5), y: RIM.y + 3 }; m.spotT = s.tick + Math.round(1.4 * GHZ); m.cut = true
    }
  }
  if (m.spot == null || s.tick >= (m.spotT ?? 0) || (!m.cut && Math.hypot(m.spot.x - p.x, m.spot.y - p.y) < 0.9 && s.tick >= (m.spotT ?? 0) - Math.round(0.9 * GHZ))) {
    // (never long on one spot: a beat there, then a V-cut, a relocation or a cut)
    m.spotT = s.tick + Math.round((1.3 + roll(s) * 1.4) * GHZ)
    const { d: dD } = nearestDef(s, p)
    // a cut when his man loses him or just to move the defense; a smart player cuts more
    m.cut = false
    if (roll(s) < 0.3 + 0.25 * p.R.iq + (dD > 6 ? 0.15 : 0) && h && ref.rimDist(h) > 12) { m.spot = { x: RIM.x + (roll(s) - 0.5) * 5, y: RIM.y + 2.5 }; m.spotT = s.tick + Math.round(1.6 * GHZ); m.cut = true }
    else {
      const list = p.pos === 'big' ? (p.R.js > 0.6 ? LOW.concat(MID, ARC) : LOW.concat(MID)) : (p.R.js > 0.3 ? ARC : ARC.concat(MID))
      let best = -99
      for (const sp of list) {
        let mate = 99, open = 99
        for (const o of s.players) {
          if (o === p) continue
          const d = Math.hypot(o.x - sp.x, o.y - sp.y)
          if (o.team === p.team) mate = Math.min(mate, d); else if (o.i !== s.players.findIndex(q => q.man === p.i && q.team !== p.team)) open = Math.min(open, d)
        }
        // (not the spot he's on: he moves)
        const sc = Math.min(mate, 16) + Math.min(open, 8) * 0.3 - Math.hypot(sp.x - p.x, sp.y - p.y) * 0.18 + roll(s) * 3 - (Math.hypot(sp.x - p.x, sp.y - p.y) < 2 ? 4 : 0)
        if (sc > best) { best = sc; m.spot = sp }
      }
    }
  }
  steer(p, m.spot.x, m.spot.y, out, 0.8)
  // on a cut with a step on his man: he calls for it (the handler hears a call: sim.js s.call)
  if (m.cut && h && h.team === p.team && ref.rimDist(p) < 10) {
    const { def: D } = nearestDef(s, p)
    const behind = !D || ref.rimDist(D) > ref.rimDist(p) + 1 || Math.hypot(D.x - p.x, D.y - p.y) > 6
    if (behind && !(s.call && s.call.pid === p.i && s.tick - s.call.tick < 20) && roll(s) < 0.25 + 0.5 * p.R.iq) out.pass = true
  }
}

// The input a CPU player makes this tick. level: a key of LEVELS, or a level object (the balance script's "humans")
export function cpuInput(s, i, level = 'pro') {
  const lvl = typeof level === 'string' ? LEVELS[level] || LEVELS.pro : level
  const p = s.players[i]
  const m = s.cpu[i] ?? (s.cpu[i] = {})
  const out = { mx: 0, my: 0, shoot: false, pass: false, dx: 0, dy: 0, steal: false, jump: false, q: null, t: s.tick }
  if (s.phase !== 'live' || p.out) { m.plan = null; m.rel = null; m.hist = null; m.spot = null; return out }
  const b = s.ball
  if (b.st === 'held' && b.holder === i) {
    withBall(s, p, m, lvl, out)
    // (he knows where the lines are: by one, no push out over it; the step only holds him in: sim.js softEdge)
    const E = T.footIn + T.softEdge + 0.8
    if (out.mx < 0 && p.x - COURT.minX < E) out.mx = 0
    if (out.mx > 0 && COURT.maxX - p.x < E) out.mx = 0
    if (out.my < 0 && p.y - COURT.minY < E) out.my = 0
    if (out.my > 0 && COURT.maxY - p.y < E) out.my = 0
    return out
  }
  m.rel = null
  if ((b.st === 'shot' || b.st === 'loose') && chaseBall(s, p, m, lvl, out)) return out
  if (p.team !== s.poss) defend(s, p, m, lvl, out)
  else { m.plan = null; offBall(s, p, m, lvl, out) }
  return out
}

// Every CPU's input for the tick: levels[i] is a level for a CPU player, null for a person (his input comes from the screen)
export function cpuInputs(s, levels, into = []) {
  for (let i = 0; i < s.players.length; i++) if (levels[i]) into[i] = cpuInput(s, i, levels[i])
  return into
}
