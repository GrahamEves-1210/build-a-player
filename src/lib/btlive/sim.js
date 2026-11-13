// BLACKTOP LIVE: the simulation. A fixed step (30 a second): step(state, inputs) moves the game one tick on.
// The next state is a function of the state, every player's input for the tick and the seed, and of nothing
// else: no clock, no Math.random, no DOM. The state is plain data (JSON-safe), so it can be copied, sent, replayed
// and run in Node (scripts/btlive/balance.mjs) or on the live server. Everything discrete is decided by the
// referee (referee.js) from the facts it is handed and a seeded roll; the simulation moves bodies and the ball.
//
//   const s = createGame({ teams: [[p, ...], [p, ...]], seed })      p = { id, name, pos: 'guard' | 'big', build }
//   step(s, inputs)                 inputs[i] for s.players[i] (missing: standing still)
//   input = { mx, my,               the stick, -1..1 each (length <= 1): a little push walks, all the way runs
//             shoot, pass, move,    held buttons with the ball (pass without it: call for the ball)
//             steal, jump,          held buttons without it
//             q,                    the release quality 0-1 from the shooter's own meter, on the tick shoot is let go
//             t }                   the tick the input was made on (online: for ordering; the step doesn't read it)
//   s.events                        what happened this tick (emptied at the start of the next): the screen and the
//                                   balance script read it. { e: 'release' | 'make' | 'miss' | 'block' | 'steal' | ... }
import { HZ, DT, COURT, RULES, T } from './tune.js'
import { derive } from './ratings.js'
import { rollAt, hashSeed } from './rng.js'
import { meterSpec, meterQuality } from './meter.js'
import * as ref from './referee.js'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const RIM = COURT.rim
const G = 32                                   // gravity, ft/s²
const ticks = sec => Math.max(1, Math.round(sec * HZ))
const B_SHOOT = 1, B_PASS = 2, B_MOVE = 4, B_STEAL = 8, B_JUMP = 16
const IDLE = { mx: 0, my: 0 }

const rnd = s => rollAt(s.seed, s.rn++)
// what the referee is handed about a player
const fact = p => ({ id: p.id, x: p.x, y: p.y, vx: p.vx, vy: p.vy, fx: p.fx, fy: p.fy, act: p.act, actT: p.actT * DT, burst: p.burst, R: p.R })
const stat0 = () => ({ pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ast: 0, reb: 0, oreb: 0, stl: 0, blk: 0, tov: 0 })

export function createGame({ teams, seed = 'bt', rules = RULES }) {
  const size = teams[0].length
  const players = []
  teams.forEach((list, team) => list.forEach((p, slot) => players.push({
    id: p.id, i: players.length, team, slot, name: p.name || p.id, pos: p.pos === 'big' ? 'big' : 'guard', R: derive(p.build, p.pos),
    x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: -1,
    act: 'free', actT: 0, actN: 0,           // 'free' | 'gather' | 'follow' | 'jump' | 'land' | 'frozen' | 'down'
    burst: 0, bdx: 0, bdy: 0,                // a MOVE in progress: ticks left, its direction
    moveCd: 0, stealCd: 0, noAct: 0, pb: 0,  // cooldowns (ticks), the buttons held last tick
    shot: null,                              // going up: { kind, spec, d, three, run, read }
    catchT: -999, catchFrom: -1,             // the last catch: when, from whom (index)
    man: -1, sx: 0, sy: 0,                   // the man he guards (index), his spot at the check
  })))
  // who guards whom, for the game: bigs on bigs, guards on guards, then whoever is left, in order
  for (let t = 0; t < 2; t++) {
    const mine = players.filter(p => p.team === t), theirs = players.filter(p => p.team !== t)
    const left = new Set(theirs.map(p => p.i))
    const take = p => { const m = theirs.find(o => left.has(o.i) && o.pos === p.pos) ?? theirs.find(o => left.has(o.i)); left.delete(m.i); p.man = m.i }
    mine.forEach(take)
  }
  const s = {
    v: 1, seed: hashSeed(seed), rn: 0, tick: 0, size, rules,
    players, score: [0, 0], poss: 0, phase: 'check', phaseT: ticks(rules.checkTime),
    clock: 0, next: null, winner: null, gamePoint: false, possN: 0,
    ball: { st: 'held', holder: 0, x: 0, y: 0, z: 3, vx: 0, vy: 0, vz: 0, from: -1, to: -1, t: 0, n: 0, sx: 0, sy: 0, sz: 0, tx: 0, ty: 0, verdict: null, near: [], tried: [], lastTeam: 0, reb: false, grabAt: 0, speed: 0, kind: null },
    call: null,                              // a teammate calling for the ball: { pid (index), tick }
    stats: players.map(stat0),
    cpu: players.map(() => null),            // the CPU players' own notes (cpu.js)
    cn: 0,                                   // ...and their roll count
    events: [],
  }
  s.poss = rnd(s) < 0.5 ? 0 : 1
  setSpots(s, s.poss, pointOf(s, s.poss))
  for (const p of players) { p.x = p.sx; p.y = p.sy }
  s.ball.holder = pointOf(s, s.poss)
  s.clock = ticks(rules.shotClock[size - 1])
  holdBall(s)
  s.events.push({ e: 'check', team: s.poss, pid: s.ball.holder })
  return s
}

// the team's point: who brings it up when nobody in particular has it
function pointOf(s, team) {
  let best = null
  for (const p of s.players) if (p.team === team && (!best || p.R.hnd > best.R.hnd)) best = p
  return best.i
}

// The check: the ball at the top, teammates on the wings and the block, each defender between his man and the rim
function setSpots(s, team, carrier) {
  const C = COURT.check
  let wing = 0
  const WINGS = [{ x: 44.5, y: 26.5 }, { x: 11.5, y: 26.5 }], POSTS = [{ x: 35.6, y: 11.5 }, { x: 20.4, y: 11.5 }]
  for (const p of s.players) {
    if (p.team !== team) continue
    if (p.i === carrier) { p.sx = C.x; p.sy = C.y; continue }
    const at = (p.pos === 'big' ? POSTS : WINGS)[wing++ % 2]
    p.sx = at.x; p.sy = at.y
  }
  for (const p of s.players) {
    if (p.team === team) continue
    const m = s.players[p.man]
    const d = Math.hypot(RIM.x - m.sx, RIM.y - m.sy) || 1
    const off = p.man === carrier ? 4.6 / d : 0.3
    p.sx = m.sx + (RIM.x - m.sx) * off; p.sy = m.sy + (RIM.y - m.sy) * off
  }
}

function holdBall(s) {
  const b = s.ball, h = s.players[b.holder]
  b.st = 'held'; b.x = h.x + h.fx * 1.1; b.y = h.y + h.fy * 1.1; b.z = 3; b.vx = b.vy = b.vz = 0; b.lastTeam = h.team
}

// The possession is over: a basket, a turnover, a defensive board. next: who gets it, and who checks it
function endPossession(s, pts, nextTeam, carrier, why) {
  s.events.push({ e: 'poss', team: s.poss, pts, why })
  s.possN++
  const st = ref.scoreState(s.score, s.rules)
  s.gamePoint = st.gamePoint
  for (const p of s.players) { p.burst = 0; p.shot = null; if (p.act !== 'down') { p.act = 'free'; p.actT = 0 } p.pb = 0 }
  s.call = null
  if (st.over) {
    s.phase = 'over'; s.winner = st.winner
    s.events.push({ e: 'final', winner: st.winner, score: [...s.score] })
    return
  }
  s.phase = 'dead'; s.phaseT = ticks(s.rules.deadTime)
  const c = carrier != null && s.players[carrier].team === nextTeam ? carrier : pointOf(s, nextTeam)
  s.next = { team: nextTeam, carrier: c }
  setSpots(s, nextTeam, c)
  // the ball stays in the hands of whoever checks it next; otherwise it's dead where it is
  if (s.ball.st === 'held' && s.ball.holder !== c) { s.ball.st = 'dead'; s.ball.vx = s.ball.vy = s.ball.vz = 0 }
}

function startGather(s, p) {
  const d = ref.rimDist(p)
  const kind = ref.shotKind(p.R, d, rnd(s))
  const spec = meterSpec(kind, p.R, s.gamePoint)
  const defs = s.players.filter(o => o.team !== p.team).map(fact)
  const c0 = ref.contestOf(fact(p), defs, kind).c
  // the read on the meter: how open he is. A high IQ reads it true; a low one is a step off about half the time
  let read = c0 < 0.2 ? 0 : c0 < 0.5 ? 1 : 2
  const r = rnd(s)
  if (r > 0.45 + 0.55 * p.R.iq) read = clamp(read + (r > 0.8 ? 1 : -1), 0, 2)
  const top = p.R.topBall
  p.shot = { kind, spec, d, three: kind === 'jumper' && ref.isThree(p.x, p.y), run: clamp(Math.hypot(p.vx, p.vy) / top, 0, 1), read }
  p.act = 'gather'; p.actT = 0; p.burst = 0
  s.events.push({ e: 'gather', pid: p.i, kind })
}

function release(s, p, q) {
  const b = s.ball, sh = p.shot
  const cs = sh.kind === 'jumper' && p.catchFrom >= 0 && s.tick - p.catchT <= T.csWindow * HZ ? s.players[p.catchFrom].R.pas : null
  const rushed = s.clock <= T.rushAt * HZ
  const defs = s.players.filter(o => o.team !== p.team)
  const v = ref.judgeShot(fact(p), defs.map(fact), { kind: sh.kind, d: sh.d, three: sh.three, q, run: sh.run, cs, rushed },
    { block: defs.map(() => rnd(s)), make: rnd(s) })
  const st = s.stats[p.i]
  p.act = 'follow'; p.actT = 0; p.actN = ticks(T.follow); p.shot = null
  b.lastTeam = p.team; b.from = p.i; b.kind = sh.kind
  if (v.blocked != null) {
    const d = s.players.find(o => o.id === v.blocked)
    s.stats[d.i].blk++; st.fga++; if (sh.three) st.tpa++
    // swatted away from the rim, back up the floor
    const a = Math.atan2(p.y - RIM.y, p.x - RIM.x) + (rnd(s) - 0.5) * 1.6
    b.st = 'loose'; b.x = p.x; b.y = p.y; b.z = 8.5; b.vx = Math.cos(a) * T.swatSpeed; b.vy = Math.abs(Math.sin(a)) * T.swatSpeed * 0.8 + 3; b.vz = 3
    b.reb = false; b.grabAt = s.tick + 6; b.lastTeam = d.team; b.t = 0
    s.events.push({ e: 'block', pid: d.i, on: p.i, chase: v.chase, kind: sh.kind })
    return
  }
  st.fga++; if (sh.three) st.tpa++
  const spot = ref.reboundSpot(p, sh.d, rnd(s), rnd(s))
  b.st = 'shot'; b.sx = p.x; b.sy = p.y; b.sz = sh.kind === 'dunk' ? 10.5 : 8; b.x = p.x; b.y = p.y; b.z = b.sz
  b.t = 0; b.n = ticks(sh.kind === 'dunk' ? 0.16 : sh.kind === 'layup' ? 0.36 : 0.5 + sh.d * 0.014)
  b.tx = spot.x; b.ty = spot.y
  b.verdict = { made: v.made, pts: v.pts, poster: !!v.poster, deep: !!v.deep, three: sh.three, kind: sh.kind, d: sh.d, c: v.c, p: v.p, q, by: v.by ?? null }
  s.events.push({ e: 'release', pid: p.i, kind: sh.kind, three: sh.three, d: sh.d, q, c: v.c, p: v.p, cs: cs != null })
}

function shotLands(s) {
  const b = s.ball, v = b.verdict, p = s.players[b.from], st = s.stats[p.i]
  if (v.made) {
    s.score[p.team] += v.pts
    st.pts += v.pts; st.fgm++; if (v.three) st.tpm++
    let ast = -1
    if (p.catchFrom >= 0 && s.tick - p.catchT <= 4 * HZ && s.players[p.catchFrom].team === p.team) { ast = p.catchFrom; s.stats[ast].ast++ }
    b.st = 'dead'; b.x = RIM.x; b.y = RIM.y; b.z = 9; b.vx = b.vy = 0; b.vz = -6
    s.events.push({ e: 'make', pid: p.i, pts: v.pts, kind: v.kind, three: v.three, poster: v.poster, deep: v.deep, on: v.by, ast, score: [...s.score] })
    const keep = s.rules.makeItTakeIt
    endPossession(s, v.pts, keep ? p.team : 1 - p.team, keep ? p.i : null, 'make')
    return
  }
  // off the rim: it comes down at the spot the referee picked
  b.st = 'loose'; b.x = RIM.x; b.y = RIM.y; b.z = 10
  b.vx = (b.tx - RIM.x) / T.rebAir; b.vy = (b.ty - RIM.y) / T.rebAir; b.vz = (0.5 * G * T.rebAir * T.rebAir - b.z) / T.rebAir
  b.reb = true; b.grabAt = s.tick + 3; b.t = 0
  s.events.push({ e: 'miss', pid: p.i, kind: v.kind, three: v.three })
}

function doPass(s, p, inp) {
  const b = s.ball
  const mates = s.players.filter(o => o.team === p.team && o !== p && o.act !== 'down')
  if (!mates.length) return
  const m = Math.hypot(inp.mx || 0, inp.my || 0)
  let to = null, best = -Infinity
  for (const o of mates) {
    const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1
    let score
    if (m >= 0.3) score = (dx * inp.mx + dy * inp.my) / (d * m)        // the teammate nearest the way the stick points
    else {                                                              // stick at rest: the most open one
      let open = 99
      for (const q of s.players) if (q.team !== p.team) open = Math.min(open, Math.hypot(q.x - o.x, q.y - o.y))
      score = open
    }
    if (score > best) { best = score; to = o }
  }
  b.st = 'pass'; b.from = p.i; b.to = to.i; b.x = p.x; b.y = p.y; b.z = 4.5; b.t = 0; b.speed = p.R.passSpeed
  b.near = s.players.map(() => null); b.tried = s.players.map(() => false); b.lastTeam = p.team
  p.act = 'follow'; p.actT = 0; p.actN = ticks(0.15); p.burst = 0
  s.call = null
  s.events.push({ e: 'pass', pid: p.i, to: to.i })
}

function doMove(s, p, inp) {
  const m = Math.hypot(inp.mx || 0, inp.my || 0)
  const dir = m >= T.walk ? { x: inp.mx / m, y: inp.my / m } : { x: p.fx, y: p.fy }
  p.burst = ticks(T.moveTime); p.bdx = dir.x; p.bdy = dir.y; p.moveCd = ticks(p.R.moveCd)
  // his man: the nearest defender
  let def = null, dd = T.moveRange
  for (const o of s.players) if (o.team !== p.team) { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d <= dd) { dd = d; def = o } }
  const v = ref.judgeMove(fact(p), def && fact(def), dir, rnd(s), rnd(s))
  if (v.freeze) {
    def.act = v.ankles ? 'down' : 'frozen'; def.actT = 0; def.actN = ticks(v.ankles ? T.ankleDown : T.moveFreeze); def.vx = def.vy = 0
  }
  s.events.push({ e: 'move', pid: p.i, def: def ? def.i : -1, freeze: v.freeze, ankles: v.ankles })
}

function doSteal(s, p) {
  const b = s.ball, h = s.players[b.holder]
  p.stealCd = ticks(T.stealCd)
  const v = ref.judgeSteal(fact(p), fact(h), rnd(s))
  if (v.ok) {
    s.stats[p.i].stl++; s.stats[h.i].tov++
    b.holder = p.i; holdBall(s)
    s.events.push({ e: 'steal', pid: p.i, from: h.i })
    endPossession(s, 0, p.team, p.i, 'steal')
    return
  }
  p.act = 'frozen'; p.actT = 0; p.actN = ticks(v.reach ? T.stealReachFreeze : T.stealMiss)
  s.events.push({ e: 'swipe', pid: p.i, reach: v.reach })
}

function act(s, p, inp) {
  const b = s.ball
  const now = (inp.shoot ? B_SHOOT : 0) | (inp.pass ? B_PASS : 0) | (inp.move ? B_MOVE : 0) | (inp.steal ? B_STEAL : 0) | (inp.jump ? B_JUMP : 0)
  const edge = now & ~p.pb
  p.pb = now
  const has = b.st === 'held' && b.holder === p.i
  if (p.act === 'gather') {
    const held = p.actT * 1000 / HZ
    if (inp.q != null || !(now & B_SHOOT) || held >= p.shot.spec.total) release(s, p, inp.q != null ? clamp(inp.q, 0, 1) : meterQuality(p.shot.spec, held))
    return
  }
  if (p.act !== 'free') return
  if (has) {
    if (p.noAct > 0) return
    if (edge & B_SHOOT) startGather(s, p)
    else if ((edge & B_PASS) && s.size > 1) doPass(s, p, inp)
    else if ((edge & B_MOVE) && p.moveCd <= 0) doMove(s, p, inp)
    return
  }
  const ballUp = b.st === 'shot' || b.st === 'loose'
  if (p.team !== s.poss) {
    if ((edge & B_STEAL) && p.stealCd <= 0 && b.st === 'held') { doSteal(s, p); return }
    if (edge & B_JUMP) { p.act = 'jump'; p.actT = 0; s.events.push({ e: 'jump', pid: p.i }) }
    return
  }
  if ((edge & B_JUMP) && ballUp) { p.act = 'jump'; p.actT = 0; s.events.push({ e: 'jump', pid: p.i }) }
  else if ((edge & B_PASS) && b.st === 'held') { s.call = { pid: p.i, tick: s.tick }; s.events.push({ e: 'call', pid: p.i }) }
}

function timers(p) {
  if (p.moveCd > 0) p.moveCd--
  if (p.stealCd > 0) p.stealCd--
  if (p.noAct > 0) p.noAct--
  if (p.burst > 0) p.burst--
  if (p.act === 'free') return
  p.actT++
  if (p.act === 'jump') { if (p.actT >= ticks(T.jumpTime)) { p.act = 'land'; p.actT = 0 } }
  else if (p.act === 'land') { if (p.actT >= ticks(T.jumpLand)) { p.act = 'free'; p.actT = 0 } }
  else if (p.act !== 'gather' && p.actT >= p.actN) { p.act = 'free'; p.actT = 0 }
}

function move(s, p, inp) {
  const has = s.ball.st === 'held' && s.ball.holder === p.i
  const def = p.team !== s.poss
  let top = has ? p.R.topBall : def ? p.R.topDef : p.R.top
  let mx = inp.mx || 0, my = inp.my || 0
  let m = Math.hypot(mx, my)
  if (m > 1) { mx /= m; my /= m; m = 1 }
  if (m < T.walk) { mx = my = 0 }
  if (p.act === 'frozen' || p.act === 'down') { p.vx = p.vy = 0 }
  else if (p.burst > 0) { p.vx = p.bdx * top * T.moveSpeed; p.vy = p.bdy * top * T.moveSpeed }
  else {
    if (p.act === 'gather') top *= p.shot.kind === 'jumper' ? T.gatherSlowJ : T.gatherSlowL
    else if (p.act === 'follow') top *= 0.5
    else if (p.act === 'jump' || p.act === 'land') top *= 0.15
    const a = T.accel * (def ? 0.85 + T.defAccelPer * p.R.per : 1) * DT
    const dvx = mx * top - p.vx, dvy = my * top - p.vy, dv = Math.hypot(dvx, dvy)
    if (dv <= a) { p.vx = mx * top; p.vy = my * top } else { p.vx += dvx / dv * a; p.vy += dvy / dv * a }
  }
  p.x += p.vx * DT; p.y += p.vy * DT
  const sp = Math.hypot(p.vx, p.vy)
  if (sp > 1) { p.fx = p.vx / sp; p.fy = p.vy / sp }
  else if (has) { const d = ref.rimDist(p) || 1; p.fx = (RIM.x - p.x) / d; p.fy = (RIM.y - p.y) / d }
  if (!has) { p.x = clamp(p.x, COURT.minX + 0.4, COURT.maxX - 0.4); p.y = clamp(p.y, COURT.minY + 0.4, COURT.maxY - 0.4) }
}

// Bodies: nobody walks through anybody. A set defender in the handler's path, or anyone standing still, holds his ground
function collide(s) {
  const P = s.players, R2 = T.radius * 2, holder = s.ball.st === 'held' ? s.ball.holder : -1
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], b = P[j]
    let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy)
    if (d >= R2) continue
    if (d < 0.001) { dx = 1; dy = 0; d = 1 }
    const nx = dx / d, ny = dy / d, over = R2 - d
    const set = (p, o) => (p.act === 'free' || p.act === 'jump' || p.act === 'land') && ((o.i === holder && p.team !== o.team) || Math.hypot(p.vx, p.vy) < 1.2)
    const ma = a.R.mass * (set(a, b) ? T.ground : 1), mb = b.R.mass * (set(b, a) ? T.ground : 1)
    const fa = mb / (ma + mb), fb = ma / (ma + mb)
    a.x -= nx * over * fa; a.y -= ny * over * fa
    b.x += nx * over * fb; b.y += ny * over * fb
    // the speed into each other is lost (he has to go around)
    const va = a.vx * nx + a.vy * ny, vb = b.vx * nx + b.vy * ny
    if (va > 0 && a.burst <= 0) { a.vx -= nx * va * fa; a.vy -= ny * va * fa }
    if (vb < 0 && b.burst <= 0) { b.vx -= nx * vb * fb; b.vy -= ny * vb * fb }
  }
}

function change(s, p, why, reb) {
  s.ball.holder = p.i; holdBall(s)
  endPossession(s, 0, p.team, p.i, why)
  void reb
}

function ballStep(s) {
  const b = s.ball, P = s.players
  if (b.st === 'held') { holdBall(s); return }
  b.t++
  if (b.st === 'pass') {
    const to = P[b.to]
    const dx = to.x - b.x, dy = to.y - b.y, d = Math.hypot(dx, dy), stepLen = b.speed * DT
    if (d <= T.catchReach + stepLen) {
      b.holder = to.i; to.catchT = s.tick; to.catchFrom = b.from; to.noAct = ticks(T.passCd)
      holdBall(s)
      s.events.push({ e: 'catch', pid: to.i, from: b.from })
      return
    }
    b.x += dx / d * stepLen; b.y += dy / d * stepLen
    // a defender it goes by can pick it, judged at its nearest to him
    for (const o of P) {
      if (o.team === to.team || b.tried[o.i]) continue
      const dd = Math.hypot(o.x - b.x, o.y - b.y), prev = b.near[o.i]
      if (prev != null && dd > prev && prev <= T.pickReach) {
        b.tried[o.i] = true
        if (ref.judgePick(fact(o), P[b.from].R, prev, rnd(s))) {
          s.stats[o.i].stl++; s.stats[b.from].tov++
          s.events.push({ e: 'pick', pid: o.i, from: b.from })
          change(s, o, 'pick')
          return
        }
      }
      b.near[o.i] = dd
    }
    if (b.t > 2.5 * HZ) { b.st = 'loose'; b.vx = b.vy = b.vz = 0; b.reb = false; b.grabAt = s.tick }
    return
  }
  if (b.st === 'shot') {
    const f = Math.min(1, b.t / b.n)
    const arc = b.kind === 'jumper' ? 5 + b.verdict.d * 0.22 : b.kind === 'layup' ? 2 : 0.4
    b.x = b.sx + (RIM.x - b.sx) * f; b.y = b.sy + (RIM.y - b.sy) * f
    b.z = b.sz + (10 - b.sz) * f + arc * 4 * f * (1 - f)
    if (b.t >= b.n) shotLands(s)
    return
  }
  if (b.st !== 'loose') return
  // in the air or on the floor
  b.vz -= G * DT
  b.x += b.vx * DT; b.y += b.vy * DT; b.z += b.vz * DT
  if (b.z <= 0) {
    b.z = 0
    if (b.vz < -4) { b.vz = -b.vz * 0.45; b.vx *= 0.65; b.vy *= 0.65 } else b.vz = 0
  }
  if (b.z === 0 && b.vz === 0) { b.vx *= T.looseFriction; b.vy *= T.looseFriction }
  if (!ref.inBounds(b.x, b.y, 0.6)) {
    const to = 1 - b.lastTeam
    s.events.push({ e: 'oob', team: b.lastTeam, ball: true })
    b.st = 'dead'
    endPossession(s, 0, to, null, to === s.poss ? 'oob-keep' : 'oob')
    return
  }
  if (s.tick < b.grabAt) return
  let cands = null
  for (const p of P) {
    if (p.act === 'frozen' || p.act === 'down' || p.act === 'gather') continue
    const d = Math.hypot(p.x - b.x, p.y - b.y)
    if (d > p.R.grab) continue
    const up = p.act === 'jump' ? Math.sin(Math.PI * clamp(p.actT / ticks(T.jumpTime), 0, 1)) : 0
    if (b.z > p.R.standReach + (p.R.jumpReach - p.R.standReach) * up) continue
    ;(cands ??= []).push({ id: p.i, R: p.R, d, jump: p.act === 'jump' })
  }
  // nobody got to it: after a while it goes to whoever is nearest
  if (!cands && b.t > 6 * HZ) {
    let near = P[0]
    for (const p of P) if (Math.hypot(p.x - b.x, p.y - b.y) < Math.hypot(near.x - b.x, near.y - b.y)) near = p
    cands = [{ id: near.i, R: near.R, d: 0, jump: false }]
  }
  if (!cands) return
  const p = P[ref.judgeBoard(cands, cands.length > 1 ? rnd(s) : 0)]
  const off = p.team === s.poss
  if (b.reb) { s.stats[p.i].reb++; if (off) s.stats[p.i].oreb++ }
  s.events.push({ e: 'board', pid: p.i, off, reb: b.reb, fought: cands.length > 1 })
  if (off) {
    b.holder = p.i; holdBall(s)
    p.noAct = ticks(0.2); p.catchFrom = -1
    if (p.act === 'jump') { p.act = 'land'; p.actT = 0 }
    if (b.reb) s.clock = Math.max(s.clock, ticks(s.rules.orebClock))
    b.reb = false
  } else change(s, p, b.reb ? 'dreb' : 'loose')
}

// Between possessions: everyone jogs to his spot for the check; the ball goes to the top
function betweenPlays(s) {
  const b = s.ball
  const jog = s.phase === 'check' || s.phaseT < ticks(s.rules.deadTime) - ticks(0.45)
  for (const p of s.players) {
    if (p.act !== 'free') { p.actT++; if (p.actT >= p.actN || p.act === 'jump' || p.act === 'land' || p.act === 'gather') { p.act = 'free'; p.actT = 0 } }
    if (!jog || p.act !== 'free') { p.vx *= 0.7; p.vy *= 0.7; p.x += p.vx * DT; p.y += p.vy * DT; continue }
    const dx = p.sx - p.x, dy = p.sy - p.y, d = Math.hypot(dx, dy)
    const sp = Math.min(17, d / DT, Math.max(6, d * 1.4))
    if (d > 0.01) { p.vx = dx / d * sp; p.vy = dy / d * sp; p.x += p.vx * DT; p.y += p.vy * DT; if (sp > 1) { p.fx = dx / d; p.fy = dy / d } } else { p.vx = p.vy = 0 }
  }
  if (b.st === 'held') holdBall(s)
  if (b.st === 'dead') { b.vz -= G * DT; b.z = Math.max(0, b.z + b.vz * DT); if (b.z === 0) b.vz = 0; b.x += b.vx * DT; b.y += b.vy * DT; b.vx *= 0.9; b.vy *= 0.9 }
  if (--s.phaseT > 0) return
  if (s.phase === 'dead') {
    s.phase = 'check'; s.phaseT = ticks(s.rules.checkTime)
    s.poss = s.next.team; b.holder = s.next.carrier; s.next = null
    holdBall(s)
    s.events.push({ e: 'check', team: s.poss, pid: b.holder })
    return
  }
  // the ball is live
  for (const p of s.players) {
    p.x = p.sx; p.y = p.sy; p.vx = p.vy = 0; p.act = 'free'; p.actT = 0; p.noAct = 0; p.pb = 0
    const d = ref.rimDist(p) || 1
    p.fx = (RIM.x - p.x) / d; p.fy = (RIM.y - p.y) / d
    if (p.team !== s.poss) { p.fx = -p.fx; p.fy = -p.fy }
    p.catchFrom = -1
  }
  s.phase = 'live'; s.clock = ticks(s.rules.shotClock[s.size - 1])
  holdBall(s)
  s.events.push({ e: 'live', team: s.poss })
}

export function step(s, inputs) {
  s.events.length = 0
  if (s.phase === 'over') return s
  s.tick++
  if (s.phase !== 'live') { betweenPlays(s); return s }
  const P = s.players
  for (const p of P) timers(p)
  for (const p of P) { if (s.phase !== 'live') return s; act(s, p, inputs?.[p.i] || IDLE) }
  if (s.phase !== 'live') return s
  for (const p of P) move(s, p, inputs?.[p.i] || IDLE)
  collide(s)
  ballStep(s)
  if (s.phase !== 'live') return s
  const b = s.ball
  if (b.st === 'held') {
    const h = P[b.holder]
    if (!ref.inBounds(h.x, h.y, 0.25)) {
      s.stats[h.i].tov++
      s.events.push({ e: 'oob', team: h.team, pid: h.i })
      endPossession(s, 0, 1 - h.team, null, 'oob')
      return s
    }
  }
  if (b.st === 'held' || b.st === 'pass') {
    if (--s.clock <= 0) {
      const h = P[b.st === 'held' ? b.holder : b.from]
      s.stats[h.i].tov++
      s.events.push({ e: 'clock', team: s.poss, pid: h.i })
      if (b.st === 'pass') b.st = 'dead'
      endPossession(s, 0, 1 - s.poss, null, 'clock')
    }
  }
  return s
}

// a copy of the state (it is plain data)
export const cloneState = s => JSON.parse(JSON.stringify(s))

// What the meter by a shooter needs (the screen): his shot's spec and read, or null
export const shotOf = (s, i) => s.players[i].shot
