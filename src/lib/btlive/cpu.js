// BLACKTOP LIVE: the CPU players. cpuInput(state, i, level) returns the input a CPU player makes this tick: the
// same input a thumb makes, through the same step, so a CPU can't do anything a person can't. It sees what's on
// the court, late (a reaction time), and lets go of the meter with a timing error. Its notes live in the state
// (state.cpu[i]) and its rolls are seeded from the state, so a game with CPUs replays exactly. Pure.
//
// A defender stays between his man and the rim, closes out and gets a hand up (not on everything), swipes now
// and then, helps when a teammate is beaten. A scorer takes what his ratings and the defender give: the shot
// worth the most right now, a drive around his man, a pull-up, a post-up, a pass to a better look. Teammates
// space the floor, cut, and crash the glass.
import { HZ, COURT, T } from './tune.js'
import { rollAt, gauss } from './rng.js'
import { meterQuality } from './meter.js'
import * as ref from './referee.js'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const RIM = COURT.rim
const MS = 1000 / HZ

// How good the CPU is. meterSd: ms of error on the release. react: ticks before he sees what his man did.
// contest: how often he gets a hand up on a shot. steal: swipes a second with the ball in reach. help: how often
// he comes over when a teammate is beaten. ev: how far off his judgment of a shot is. move: how often he uses
// a dribble move on a set defender. gap: extra feet he gives his man.
export const LEVELS = {
  rookie:  { label: 'ROOKIE',   meterSd: 85, react: 11, contest: 0.40, steal: 0.10, help: 0.15, ev: 0.20, move: 0.30, gap: 1.2 },
  pro:     { label: 'PRO',      meterSd: 56, react: 7,  contest: 0.66, steal: 0.16, help: 0.35, ev: 0.12, move: 0.60, gap: 0.5 },
  allstar: { label: 'ALL-STAR', meterSd: 38, react: 5,  contest: 0.84, steal: 0.20, help: 0.50, ev: 0.06, move: 0.85, gap: 0.2 },
  legend:  { label: 'LEGEND',   meterSd: 24, react: 3,  contest: 0.95, steal: 0.24, help: 0.65, ev: 0.03, move: 0.95, gap: 0 },
}

const roll = s => rollAt(s.seed ^ 0x5bd1e995, s.cn++)
const fact = p => ({ id: p.id, x: p.x, y: p.y, vx: p.vx, vy: p.vy, fx: p.fx, fy: p.fy, act: p.act, actT: p.actT / HZ, burst: p.burst, R: p.R })

// walk to a point: full push far away, a little push close
function steer(p, tx, ty, out, stop = 0.5) {
  tx = clamp(tx, COURT.minX + 1.2, COURT.maxX - 1.2); ty = clamp(ty, COURT.minY + 1.2, COURT.maxY - 1.2)
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy)
  if (d < stop) { out.mx = 0; out.my = 0; return d }
  const m = clamp(d / 2.2, 0.35, 1)
  out.mx = dx / d * m; out.my = dy / d * m
  return d
}

// what a shot from where he stands is worth to him right now (1 = a sure one-pointer)
function shotValue(s, p, lvl, defs, closeBy = 2.0) {
  const d = ref.rimDist(p)
  const kind = d <= T.layRange ? 'layup' : 'jumper'
  const three = kind === 'jumper' && ref.isThree(p.x, p.y)
  // the defense closes while he rises: count on a man in reach taking a step in with a hand up
  const me = fact(p)
  const closed = defs.map(o => {
    const dd = Math.hypot(o.x - p.x, o.y - p.y)
    if (dd > 6 + closeBy || o.act === 'frozen' || o.act === 'down') return o
    const k = Math.min(kind === 'jumper' ? closeBy : closeBy * 0.5, Math.max(0, dd - T.contestNear)) / (dd || 1)
    return { ...o, x: o.x + (p.x - o.x) * k, y: o.y + (p.y - o.y) * k, act: 'jump' }
  })
  const c = ref.contestOf(me, defs, kind).c * 0.15 + ref.contestOf(me, closed, kind).c * 0.85
  const win = kind === 'jumper' ? T.jWinMs + T.jWinJs * p.R.js : T.lWinMs + T.lWinFin * p.R.fin
  const green = clamp(win / (lvl.meterSd * 1.25), 0.12, 0.97)
  const rel = green + (1 - green) * (kind === 'jumper' ? 0.72 : 0.84)
  const cs = kind === 'jumper' && p.catchFrom >= 0 && s.tick - p.catchT <= T.csWindow * HZ * 0.6 ? s.players[p.catchFrom].R.pas : null
  const pMake = ref.makeChance({ R: p.R, kind, d, q: 1, c, run: Math.hypot(p.vx, p.vy) / p.R.topBall, cs, rushed: false }) * rel
  // make it, take it: a make is worth its points and the ball back, so a two is worth one and a half ones, not two
  return { v: pMake * (three ? 1.5 : 1), kind, three, c, d }
}

// is the lane from a to b clear of defenders
function laneOpen(s, a, b, team) {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1
  for (const o of s.players) {
    if (o.team === team || o.act === 'down' || o.act === 'frozen') continue
    const t = clamp(((o.x - a.x) * dx + (o.y - a.y) * dy) / L2, 0, 1)
    if (t < 0.12) continue
    if (Math.hypot(a.x + dx * t - o.x, a.y + dy * t - o.y) < 3.4) return false
  }
  return true
}

const ARC = [{ x: 5.6, y: 7 }, { x: 50.4, y: 7 }, { x: 8.2, y: 23.5 }, { x: 47.8, y: 23.5 }, { x: 17, y: 30.6 }, { x: 39, y: 30.6 }, { x: 28, y: 32.4 }]
const MID = [{ x: 19.5, y: 18 }, { x: 36.5, y: 18 }, { x: 28, y: 20.5 }, { x: 14.5, y: 11 }, { x: 41.5, y: 11 }]
const LOW = [{ x: 21.5, y: 7.5 }, { x: 34.5, y: 7.5 }, { x: 22.5, y: 12 }, { x: 33.5, y: 12 }]

function nearestDef(s, p) {
  let best = null, bd = 99
  for (const o of s.players) if (o.team !== p.team) { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o } }
  return { def: best, d: bd }
}

function pickPlan(s, p, m) {
  const R = p.R
  const w = {
    drive: 0.25 + R.fin * 0.6 + R.spd * 0.2 + R.hnd * 0.3 + R.bnc * 0.15,
    three: R.js > 0.3 ? R.js * 1.5 - 0.3 : 0.03,
    mid: R.js * 0.3,
    post: R.big ? 0.25 + R.size * 0.7 + R.fin * 0.3 : R.size > 0.7 ? 0.15 : 0,
  }
  let t = roll(s) * (w.drive + w.three + w.mid + w.post)
  m.plan = 'drive'
  for (const k of ['drive', 'three', 'mid', 'post']) { t -= w[k]; if (t <= 0) { m.plan = k; break } }
  m.planT = s.tick + Math.round((2.2 + roll(s) * 1.6) * HZ)
  m.side = roll(s) < 0.5 ? -1 : 1
  m.spot = null
  if (m.plan === 'three' || m.plan === 'mid') {
    // the spot farthest from the defense, not too far to walk
    const list = m.plan === 'three' ? ARC : MID
    let best = -99
    for (const sp of list) {
      let open = 99
      for (const o of s.players) if (o.team !== p.team) open = Math.min(open, Math.hypot(o.x - sp.x, o.y - sp.y))
      const sc = Math.min(open, 9) - Math.hypot(sp.x - p.x, sp.y - p.y) * 0.22 + roll(s) * 3
      if (sc > best) { best = sc; m.spot = sp }
    }
  } else if (m.plan === 'post') m.spot = { x: RIM.x + (p.x < RIM.x ? -5.5 : 5.5), y: 9.5 }
}

function withBall(s, p, m, lvl, out) {
  const defs = s.players.filter(o => o.team !== p.team).map(fact)
  const clockS = s.clock / HZ
  // going up: hold the meter, let go with his timing error
  if (p.act === 'gather') {
    if (!m.rel) {
      const held = clamp(p.shot.spec.ideal + gauss(roll(s), roll(s)) * lvl.meterSd, T.minHoldMs, p.shot.spec.total)
      m.rel = { n: Math.max(2, Math.round(held / MS)), q: meterQuality(p.shot.spec, held) }
    }
    if (p.actT >= m.rel.n) { out.shoot = false; out.q = m.rel.q; m.rel = null } else out.shoot = true
    if (p.shot && p.shot.kind !== 'jumper') steer(p, RIM.x, RIM.y, out, 1.5)
    return
  }
  m.rel = null
  if (m.plan == null) m.gotT = s.tick
  if (m.plan == null || s.tick >= m.planT) pickPlan(s, p, m)
  if (s.tick >= (m.thinkT ?? 0)) { m.thinkT = s.tick + 4; m.noise = (roll(s) - 0.5) * 2 * lvl.ev; m.go = roll(s) }
  const mine = shotValue(s, p, lvl, defs)
  const { def: D, d: dD } = nearestDef(s, p)
  const dRim = mine.d
  const beat = !D || D.act === 'frozen' || D.act === 'down' || ref.rimDist(D) > dRim + 0.8
  // how good a shot has to be: a good one early, any shot late (a low IQ lets the clock run down further)
  const late = 1.3 + 1.0 * p.R.iq
  const need = clockS <= late ? -1 : clamp(0.5 - Math.max(0, 7 - clockS) * 0.04, 0.26, 0.5)
  // a better look for a teammate
  if (s.size > 1 && p.noAct <= 0) {
    let to = null, tv = 0
    const called = s.call && s.tick - s.call.tick < 24 ? s.call.pid : -1
    for (const o of s.players) {
      if (o.team !== p.team || o === p) continue
      if (!laneOpen(s, p, o, p.team)) continue
      if (o.i === called) { to = o; tv = 9; break }
      const v = shotValue(s, o, lvl, defs, 4.5).v      // his man closes while the pass is in the air
      if (v > tv) { tv = v; to = o }
    }
    const held = s.tick - Math.max(p.catchT, m.gotT ?? 0) > 0.7 * HZ
    const want = tv >= 9 || (held && tv > mine.v + 0.15 + m.noise && tv > need - 0.05) || (clockS < 4 && tv > mine.v + 0.05)
    if (to && want && clockS > 2.2 && (tv >= 9 || m.go < 0.5 + 0.4 * p.R.iq)) {
      const dx = to.x - p.x, dy = to.y - p.y, d = Math.hypot(dx, dy) || 1
      out.mx = dx / d; out.my = dy / d; out.pass = true
      m.plan = null
      return
    }
  }
  if (p.noAct <= 0 && mine.v + m.noise >= need && (mine.kind !== 'jumper' || clockS <= late || mine.v >= 0.3)) { out.shoot = true; return }
  // near the rim with a step on his man, or stuck under it: go up
  if (dRim <= (beat ? 5.4 : 4.6) && p.noAct <= 0) { out.shoot = true; return }
  // otherwise move: the plan's target
  let tx = RIM.x, ty = RIM.y + 1.5
  if (m.plan === 'three' || m.plan === 'mid') {
    tx = m.spot.x; ty = m.spot.y
    if (Math.hypot(tx - p.x, ty - p.y) < 1.2) {
      // on his spot and still covered: make space with a move, or go
      if (dD < 5.1 && p.moveCd <= 0 && m.go < lvl.move) {
        const ax = p.x - D.x, ay = p.y - D.y, a = Math.hypot(ax, ay) || 1
        out.mx = ax / a * 0.6 + (-ay / a) * m.side * 0.8; out.my = ay / a * 0.6 + (ax / a) * m.side * 0.8
        const l = Math.hypot(out.mx, out.my) || 1
        out.mx /= l; out.my /= l
        if (ref.inBounds(p.x + out.mx * 6.5, p.y + out.my * 6.5, -1)) { out.move = true; return }
        m.side = -m.side
      }
      if (s.tick > m.planT - HZ) m.plan = 'drive'
    }
  } else if (m.plan === 'post') {
    if (m.spot && Math.hypot(m.spot.x - p.x, m.spot.y - p.y) < 2.5) m.spot = null
    if (m.spot) { tx = m.spot.x; ty = m.spot.y }
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
        m.sideT = s.tick + HZ
      }
      const ang = (dD < 4.2 ? 1.05 : 0.6) * m.side
      const cx = dirx * Math.cos(ang) - diry * Math.sin(ang), cy = dirx * Math.sin(ang) + diry * Math.cos(ang)
      dirx = cx; diry = cy
      if (dD < 5.0 && p.moveCd <= 0 && m.go < lvl.move * 0.5 && ref.inBounds(p.x + dirx * 6.5, p.y + diry * 6.5, -1)) { out.mx = dirx; out.my = diry; out.move = true; return }
    }
  }
  // keep it in bounds
  const nx = p.x + dirx * 3, ny = p.y + diry * 3
  if (nx < COURT.minX + 1.6 || nx > COURT.maxX - 1.6) dirx = (RIM.x - p.x) > 0 ? Math.abs(dirx) : -Math.abs(dirx)
  if (ny < COURT.minY + 1.6) diry = Math.abs(diry)
  if (ny > COURT.maxY - 1.6) diry = -Math.abs(diry)
  out.mx = dirx; out.my = diry
}

// going after a ball that's up or loose; true if he's handling it
function chaseBall(s, p, m, lvl, out) {
  const b = s.ball
  if (b.st === 'shot') {
    // get inside position: bigs under it, guards a step out
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
  while (hist.length > lvl.react * 4 + 4) hist.splice(0, 4)
  // ...and he reads where the man is going from it: a steady run is tracked, a change of direction is seen late
  const lead = (hist.length / 4 - 1) / HZ + 0.08
  const mx = hist[0] + hist[2] * lead, my = hist[1] + hist[3] * lead
  const onBall = h === man
  const dRimM = Math.hypot(RIM.x - mx, RIM.y - my) || 1
  const ux = (RIM.x - mx) / dRimM, uy = (RIM.y - my) / dRimM
  let tx, ty
  if (onBall) {
    // up on a shooter in his range, off a man who can't shoot, tight near the rim
    const shooter = man.R.js > 0.45 && dRimM > 14 && dRimM < 31
    let gap = (dRimM < 10 ? 3.2 : shooter ? 3.3 : dRimM > 26 ? 5.8 : 4.5) + lvl.gap
    if (man.act === 'gather') gap = 2.5
    gap = Math.min(gap, Math.max(0.5, dRimM - 1.2))
    tx = mx + ux * gap; ty = my + uy * gap
    const dd = Math.hypot(man.x - p.x, man.y - p.y)
    if (man.act === 'gather') {
      // a hand up, timed to the release (decided once a shot, after his reaction)
      const key = s.tick - man.actT
      if (man.actT >= Math.min(lvl.react, 6) && m.cKey !== key) {
        m.cKey = key
        const ideal = Math.round(man.shot.spec.ideal / MS)
        m.cAt = roll(s) < lvl.contest ? Math.max(man.actT, ideal - 6 + Math.floor(roll(s) * 4)) : -1
      }
      if (m.cKey === key && m.cAt >= 0 && man.actT >= m.cAt && dd <= 5.8 && p.act === 'free') { out.jump = true; m.cAt = -1 }
    } else if (p.stealCd <= 0 && dd <= T.stealReach - 0.3 && man.burst <= 0 && p.act === 'free' && man.noAct <= 0) {
      const front = ((p.x - man.x) * man.fx + (p.y - man.y) * man.fy) / (dd || 1) > 0
      if (front && roll(s) < lvl.steal / HZ) out.steal = true
    }
  } else {
    // off the ball: between his man and the rim, a step toward the ball
    tx = mx + ux * dRimM * 0.24; ty = my + uy * dRimM * 0.24
    if (h) { tx += (h.x - tx) * 0.1; ty += (h.y - ty) * 0.1 }
    if (b.st === 'pass' && b.to === man.i) { tx = mx + ux * 3.4; ty = my + uy * 3.4 }
    else if (h && h.team !== p.team) {
      // help: the handler has a step on his man and is coming
      const hd = s.players.find(o => o.man === h.i && o.team === p.team)
      const hr = ref.rimDist(h)
      const beaten = !hd || hd.act === 'frozen' || hd.act === 'down' || ref.rimDist(hd) > hr + 0.6
      if (m.helpN !== s.possN) { m.helpN = s.possN; m.helps = roll(s) < lvl.help }
      if (beaten && hr < 15 && m.helps) {
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
  steer(p, tx, ty, out, 0.35)
}

function offBall(s, p, m, lvl, out) {
  const b = s.ball
  const h = b.st === 'held' ? s.players[b.holder] : null
  if (b.st === 'pass' && b.to === p.i) { out.mx = 0; out.my = 0; return }
  if (m.spot == null || s.tick >= (m.spotT ?? 0)) {
    m.spotT = s.tick + Math.round((2 + roll(s) * 2) * HZ)
    const { d: dD } = nearestDef(s, p)
    // a cut when his man loses him or just to move the defense; a smart player cuts more
    if (roll(s) < 0.2 + 0.2 * p.R.iq + (dD > 6 ? 0.15 : 0) && h && ref.rimDist(h) > 12) { m.spot = { x: RIM.x + (roll(s) - 0.5) * 5, y: RIM.y + 2.5 }; m.spotT = s.tick + Math.round(1.4 * HZ) }
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
        const sc = Math.min(mate, 16) + Math.min(open, 8) * 0.3 - Math.hypot(sp.x - p.x, sp.y - p.y) * 0.18 + roll(s) * 3
        if (sc > best) { best = sc; m.spot = sp }
      }
    }
  }
  steer(p, m.spot.x, m.spot.y, out, 0.8)
}

// The input a CPU player makes this tick. level: a key of LEVELS, or a level object (the balance script's "humans")
export function cpuInput(s, i, level = 'pro') {
  const lvl = typeof level === 'string' ? LEVELS[level] || LEVELS.pro : level
  const p = s.players[i]
  const m = s.cpu[i] ?? (s.cpu[i] = {})
  const out = { mx: 0, my: 0, shoot: false, pass: false, move: false, steal: false, jump: false, q: null, t: s.tick }
  if (s.phase !== 'live') { m.plan = null; m.rel = null; m.hist = null; m.spot = null; return out }
  const b = s.ball
  if (b.st === 'held' && b.holder === i) { withBall(s, p, m, lvl, out); return out }
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
