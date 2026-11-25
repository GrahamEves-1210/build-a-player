// BLACKTOP LIVE: the simulation. A fixed step (tune.js: 30 to one of the game's seconds, 36 of them in a real second):
// step(state, inputs) moves the game one tick on.
// The next state is a function of the state, every player's input for the tick and the seed, and of nothing
// else: no clock, no Math.random, no DOM. The state is plain data (JSON-safe), so it can be copied, sent, replayed
// and run in Node (scripts/btlive/balance.mjs) or on the live server. Everything discrete is decided by the
// referee (referee.js) from the facts it is handed and a seeded roll; the simulation moves bodies and the ball.
//
//   const s = createGame({ teams: [[p, ...], [p, ...]], seed })      p = { id, name, pos: 'guard' | 'big', build }
//   King of the Hill (modes.js): three sides of one, teams: [[a], [b], [c]]. Then players[i].team === i, s.score[i]
//   is his score, s.poss is the king's side (= his index), s.king the king, s.mustClear the man who has to take it
//   past the arc before he can shoot (or null)
//   step(s, inputs)                 inputs[i] for s.players[i] (missing: standing still)
//   input = { mx, my,               the stick, -1..1 each (length <= 1): a little push walks, all the way runs
//             shoot, pass,          held buttons with the ball (pass without it: call for the ball)
//             steal, jump,          held buttons without it
//             dx, dy,               a dribble move: the small stick's flick, -1..1 each, sent on the one tick it's made
//                                   (pushed T.moveAt or more). Which move it is: where it points (referee.moveKind);
//                                   a second one a quarter turn round while the first is still on: a spin
//             q,                    the release quality 0-1 from the shooter's own meter, on the tick shoot is let go
//             t,                    the tick the input was made on (online: for ordering; the step doesn't read it)
//             pos }                 online: { x, y, vx, vy } where his own device has him. His device is the authority
//                                   for his position (no lag on his own moves): the step puts him there (no farther
//                                   than he could have run since the last one) instead of moving him, bodies don't push
//                                   him, and his shot waits for the release quality his device timed (q)
//   s.events                        what happened this tick (emptied at the start of the next): the screen and the
//                                   balance script read it. { e: 'release' | 'make' | 'miss' | 'block' | 'steal' | ... }
import { HZ, DT, gticks, rticks, COURT, RULES, T, MOVES, MOVE_KEYS } from './tune.js'
import { derive } from './ratings.js'
import { rollAt, hashSeed } from './rng.js'
import { meterSpec, meterQuality } from './meter.js'
import * as ref from './referee.js'
import { modeOfTeams } from './modes.js'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const RIM = COURT.rim
const G = 32                                   // gravity, ft/s²
const ticks = gticks                           // a time in the game's seconds (tune.js PACE) as ticks; rticks: a real one
const B_SHOOT = 1, B_PASS = 2, B_STEAL = 8, B_JUMP = 16
const IDLE = { mx: 0, my: 0 }

const rnd = s => rollAt(s.seed, s.rn++)
// what the referee is handed about a player
const fact = p => ({ id: p.id, x: p.x, y: p.y, vx: p.vx, vy: p.vy, fx: p.fx, fy: p.fy, act: p.act, actT: p.actT * DT, burst: p.burst, mv: p.mv, bdx: p.bdx, bdy: p.bdy, R: p.R })
const stat0 = () => ({ pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ast: 0, reb: 0, oreb: 0, stl: 0, blk: 0, tov: 0 })

export function createGame({ teams, seed = 'bt', rules = RULES, mode = null }) {
  const size = teams[0].length
  mode = mode === 'koth' || teams.length === 3 ? 'koth' : mode || modeOfTeams(teams)
  const koth = mode === 'koth'
  const players = []
  teams.forEach((list, team) => list.forEach((p, slot) => players.push({
    id: p.id, i: players.length, team, slot, name: p.name || p.id, pos: p.pos === 'big' ? 'big' : 'guard', R: derive(p.build, p.pos),
    x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: -1,
    act: 'free', actT: 0, actN: 0,           // 'free' | 'gather' | 'follow' | 'jump' | 'land' | 'frozen' | 'down'
    burst: 0, bdx: 0, bdy: 0,                // a dribble move in progress: ticks left, the way it goes (a spin: ends up going)
    mv: 0, bn: 0, bs: 0,                     // ...which one (MOVES[..].n), how many ticks it lasts, a spin's turn (radians, signed)
    moveCd: 0, stealCd: 0, noAct: 0, pb: 0,  // cooldowns (ticks: till the next move can start, a swipe...), the buttons held last tick
    hand: 1, frzCd: 0,                       // the hand the ball is in (1 his right, -1 his left); till a move can freeze his man again
    fkx: 0, fky: -1, mqx: 0, mqy: 0, mqT: -1,  // the flick that made the move on now; a flick waiting for it to end (until tick mqT)
    sq: -1,                                  // the tick of his latest SHOOT press that hasn't started a shot (-1: none)
    shot: null,                              // going up: { kind, spec, d, three, run, read }
    catchT: -999, catchFrom: -1,             // the last catch: when, from whom (index)
    man: -1, sx: 0, sy: 0,                   // the man he guards (index), his spot at the check
  })))
  // who guards whom, for the game: bigs on bigs, guards on guards, then whoever is left, in order
  // (King of the Hill: everybody guards the king, set at every change: kingIs)
  if (!koth) for (let t = 0; t < 2; t++) {
    const mine = players.filter(p => p.team === t), theirs = players.filter(p => p.team !== t)
    const left = new Set(theirs.map(p => p.i))
    const take = p => { const m = theirs.find(o => left.has(o.i) && o.pos === p.pos) ?? theirs.find(o => left.has(o.i)); left.delete(m.i); p.man = m.i }
    mine.forEach(take)
  }
  const s = {
    v: 1, seed: hashSeed(seed), rn: 0, tick: 0, size, rules, mode,
    players, score: teams.map(() => 0), poss: 0, phase: 'check', phaseT: ticks(rules.checkTime),
    king: null, mustClear: null,             // King of the Hill: the king (index), the man who must clear it (index)
    clock: 0, next: null, winner: null, gamePoint: false, possN: 0,
    ball: { st: 'held', holder: 0, x: 0, y: 0, z: 3, vx: 0, vy: 0, vz: 0, from: -1, to: -1, t: 0, n: 0, sx: 0, sy: 0, sz: 0, tx: 0, ty: 0, verdict: null, near: [], tried: [], lastTeam: 0, reb: false, grabAt: 0, speed: 0, kind: null,
      fd: -1, fD: 0, fl: false },            // a dead ball on its way to the man who checks it: to whom, from how far; has it hit the floor
    call: null,                              // a teammate calling for the ball: { pid (index), tick }
    stats: players.map(stat0),
    cpu: players.map(() => null),            // the CPU players' own notes (cpu.js)
    cn: 0,                                   // ...and their roll count
    events: [],
  }
  s.poss = koth ? Math.min(2, Math.floor(rnd(s) * 3)) : rnd(s) < 0.5 ? 0 : 1
  if (koth) kingIs(s, pointOf(s, s.poss))
  setSpots(s, s.poss, pointOf(s, s.poss))
  for (const p of players) { p.x = p.sx; p.y = p.sy }
  s.ball.holder = pointOf(s, s.poss)
  s.clock = rticks(rules.shotClock[size - 1])
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
  if (s.mode === 'koth') {
    // both of the others on the king, a step either side of the line to the rim
    const m = s.players[carrier], d = Math.hypot(RIM.x - m.sx, RIM.y - m.sy) || 1
    const ux = (RIM.x - m.sx) / d, uy = (RIM.y - m.sy) / d
    let side = -1
    for (const p of s.players) {
      if (p.team === team) continue
      p.sx = m.sx + ux * 4.6 - uy * 2.4 * side; p.sy = m.sy + uy * 4.6 + ux * 2.4 * side
      side = -side
    }
    return
  }
  for (const p of s.players) {
    if (p.team === team) continue
    const m = s.players[p.man]
    const d = Math.hypot(RIM.x - m.sx, RIM.y - m.sy) || 1
    const off = p.man === carrier ? 4.2 / d : 0.3                   // the man checking it is right up on him
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
  for (const p of s.players) { p.burst = 0; p.mv = 0; p.bs = 0; p.mqT = -1; p.shot = null; if (p.act !== 'down') { p.act = 'free'; p.actT = 0 } p.pb = 0 }
  s.call = null; s.mustClear = null
  if (st.over) {
    s.phase = 'over'; s.winner = st.winner
    s.events.push({ e: 'final', winner: st.winner, score: [...s.score] })
    return
  }
  s.phase = 'dead'; s.phaseT = ticks(s.rules.deadTime)
  const c = carrier != null && s.players[carrier].team === nextTeam ? carrier : pointOf(s, nextTeam)
  s.next = { team: nextTeam, carrier: c }
  if (s.mode === 'koth') kingIs(s, c)
  setSpots(s, nextTeam, c)
  // the ball stays in the hands of whoever checks it next; otherwise it's dead where it is
  if (s.ball.st === 'held' && s.ball.holder !== c) { s.ball.st = 'dead'; s.ball.vx = s.ball.vy = s.ball.vz = 0 }
}

// King of the Hill: he's the king (or about to be: s.mustClear), and the other two guard him
function kingIs(s, i) {
  s.king = i
  for (const p of s.players) p.man = p.i === i ? -1 : i
}

// King of the Hill: a stop (a defensive board, a steal, a block the defense comes up with). The ball stays live: the
// man who has it is on the attack at once, but he has to clear it past the arc before he can shoot
function kothStop(s, p, why) {
  s.events.push({ e: 'poss', team: s.poss, pts: 0, why })
  s.possN++
  s.poss = p.team; kingIs(s, p.i); s.mustClear = p.i
  s.call = null
  for (const o of s.players) { o.burst = 0; o.mv = 0; o.bs = 0; o.mqT = -1; if (o.act === 'gather') { o.act = 'free'; o.actT = 0; o.shot = null } }
  s.ball.holder = p.i; holdBall(s)
  p.noAct = ticks(0.2); p.catchFrom = -1
  if (p.act === 'jump') { p.act = 'land'; p.actT = 0 }
  s.clock = rticks(s.rules.shotClock[s.size - 1])
  s.events.push({ e: 'clear', pid: p.i, why })
}

// King of the Hill: a dead ball (out of bounds, the shot clock) goes to whichever of the men who didn't touch it
// last is closer to it (last: the index of the man who did)
function kothNext(s, last, at) {
  let best = -1, bd = Infinity
  for (const p of s.players) {
    if (p.i === last) continue
    const d = Math.hypot(p.x - at.x, p.y - at.y)
    if (d < bd) { bd = d; best = p.i }
  }
  return best
}

// a layup or a dunk: one roll a player a possession, from the seed, so a device can show the right meter before the
// referee's word arrives (a dunk's green window is wider)
export const dunkRoll = (s, i) => rollAt(s.seed ^ 0x0d0c, s.possN * 8 + i)
export const shotKindAt = (s, i) => ref.shotKind(s.players[i].R, ref.rimDist(s.players[i]), dunkRoll(s, i))

function startGather(s, p) {
  const d = ref.rimDist(p)
  const kind = shotKindAt(s, p.i)
  const spec = meterSpec(kind, p.R, s.gamePoint)
  const defs = s.players.filter(o => o.team !== p.team).map(fact)
  const c0 = ref.contestOf(fact(p), defs, kind).c
  // how well he could be contested as he rises (every man in reach with a hand up): a man who only gets there late
  // takes less off the shot (referee.judgeShot)
  const cUp = ref.contestOf(fact(p), defs.map(ref.handUp), kind).c
  // the read on the meter: how open he is. A high IQ reads it true; a low one is a step off about half the time
  let read = c0 < 0.2 ? 0 : c0 < 0.5 ? 1 : 2
  const r = rnd(s)
  if (r > 0.45 + 0.55 * p.R.iq) read = clamp(read + (r > 0.8 ? 1 : -1), 0, 2)
  const top = p.R.topBall
  p.shot = { kind, spec, d, three: kind === 'jumper' && ref.isThree(p.x, p.y), run: clamp(Math.hypot(p.vx, p.vy) / top, 0, 1), read, cUp }
  p.act = 'gather'; p.actT = 0; p.burst = 0; p.mv = 0; p.bs = 0; p.mqT = -1
  s.events.push({ e: 'gather', pid: p.i, kind })
}

function release(s, p, q) {
  const b = s.ball, sh = p.shot
  const cs = p.catchFrom >= 0 && s.tick - p.catchT <= T.csWindow * HZ ? s.players[p.catchFrom].R.pas : null
  const rushed = s.clock <= T.rushAt * HZ
  // late in the game (game point, or anyone three from the goal): Clutch counts
  const late = s.gamePoint || Math.max(...s.score) >= s.rules.goal - T.clutchFrom
  const defs = s.players.filter(o => o.team !== p.team)
  const v = ref.judgeShot(fact(p), defs.map(fact), { kind: sh.kind, d: sh.d, three: sh.three, q, run: sh.run, cs, rushed, cUp: sh.cUp, gp: late },
    { block: defs.map(() => rnd(s)), make: rnd(s) })
  const st = s.stats[p.i]
  p.act = 'follow'; p.actT = 0; p.actN = ticks(T.follow); p.shot = null
  b.lastTeam = p.team; b.from = p.i; b.kind = sh.kind
  if (v.blocked != null) {
    const d = s.players.find(o => o.id === v.blocked)
    s.stats[d.i].blk++; st.fga++; if (sh.three) st.tpa++
    swat(s, p, d)
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

// A blocked shot: off the blocker's hand at the ball, away from him and driven down, sideways as often as not, and it
// dies fast; now and then he keeps it himself (tipped up on his own side, or caught). He touched it last: out of
// bounds off him is the offense's ball.
function swat(s, p, d) {
  const b = s.ball
  let ux = p.x - d.x, uy = p.y - d.y, ul = Math.hypot(ux, uy)
  if (ul < 0.3) { ux = p.x - RIM.x; uy = p.y - RIM.y; ul = Math.hypot(ux, uy) || 1 }
  ux /= ul; uy /= ul
  b.st = 'loose'; b.x = p.x - ux * 0.6; b.y = p.y - uy * 0.6; b.z = 8.5
  const tip = rnd(s) < T.swatTip
  if (tip) {
    // kept: it pops up soft, back over his own side
    const k = 1.5 + 2.5 * rnd(s)
    b.vx = -ux * k; b.vy = -uy * k; b.vz = 3 + 4 * rnd(s)
  } else {
    // swatted: mostly down into the floor near him; now and then a big one sent flying (out of bounds, often)
    const big = rnd(s) < T.swatBig
    const a = Math.atan2(uy, ux) + (rnd(s) * 2 - 1) * T.swatSpread, r = rnd(s)
    const v = big ? T.swatMax + 8 * r : T.swatMin + (T.swatMax - T.swatMin) * r
    b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.vz = big ? 4 * rnd(s) - 1 : -(2 + 10 * rnd(s))
  }
  b.reb = false; b.grabAt = s.tick + (tip ? 4 : T.swatGrab); b.lastTeam = d.team; b.t = 0
}

function shotLands(s) {
  const b = s.ball, v = b.verdict, p = s.players[b.from], st = s.stats[p.i]
  if (v.made) {
    s.score[p.team] += v.pts
    st.pts += v.pts; st.fgm++; if (v.three) st.tpm++
    let ast = -1
    if (p.catchFrom >= 0 && s.tick - p.catchT <= ticks(4) && s.players[p.catchFrom].team === p.team) { ast = p.catchFrom; s.stats[ast].ast++ }
    // through the net: it drops straight down under the rim (the screen draws it through the net while it's right
    // under it), bounces, and from the bounce it goes out to whoever checks it (betweenPlays)
    // (a dunk is thrown down through it: it hits the floor hard under the rim)
    b.st = 'dead'; b.x = RIM.x; b.y = RIM.y; b.z = 9.4; b.vx = b.vy = 0; b.vz = v.kind === 'dunk' ? -26 : -3
    s.events.push({ e: 'make', pid: p.i, pts: v.pts, kind: v.kind, three: v.three, poster: v.poster, deep: v.deep, on: v.by, ast, score: [...s.score] })
    const keep = s.rules.makeItTakeIt || s.mode === 'koth'
    endPossession(s, v.pts, keep ? p.team : 1 - p.team, keep ? p.i : null, 'make')
    return
  }
  // off the rim: it comes down at the spot the referee picked
  b.st = 'loose'; b.x = RIM.x; b.y = RIM.y; b.z = 10
  b.vx = (b.tx - RIM.x) / T.rebAir; b.vy = (b.ty - RIM.y) / T.rebAir; b.vz = (0.5 * G * T.rebAir * T.rebAir - b.z) / T.rebAir
  b.reb = true; b.grabAt = s.tick + 3; b.t = 0
  s.events.push({ e: 'miss', pid: p.i, kind: v.kind, three: v.three })
}

// Who a pass goes to: the teammate nearest the way the stick points; stick at rest, the most open one.
// (the screen uses it too, to mark him before the button is pressed). Returns his index, or -1
export function passTarget(s, i, mx = 0, my = 0) {
  const p = s.players[i]
  const m = Math.hypot(mx, my)
  let to = -1, best = -Infinity
  for (const o of s.players) {
    if (o.team !== p.team || o === p || o.act === 'down') continue
    const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1
    let score
    if (m >= 0.3) score = (dx * mx + dy * my) / (d * m)
    else {
      let open = 99
      for (const q of s.players) if (q.team !== p.team) open = Math.min(open, Math.hypot(q.x - o.x, q.y - o.y))
      score = open
    }
    if (score > best) { best = score; to = o.i }
  }
  return to
}

function doPass(s, p, inp) {
  const b = s.ball
  const ti = passTarget(s, p.i, inp.mx || 0, inp.my || 0)
  if (ti < 0) return
  const to = s.players[ti]
  b.st = 'pass'; b.from = p.i; b.to = to.i; b.x = p.x; b.y = p.y; b.z = 4.5; b.t = 0; b.speed = p.R.passSpeed
  b.near = s.players.map(() => null); b.tried = s.players.map(() => false); b.lastTeam = p.team
  p.act = 'follow'; p.actT = 0; p.actN = ticks(0.15); p.burst = 0; p.mv = 0; p.bs = 0; p.mqT = -1
  s.call = null
  s.events.push({ e: 'pass', pid: p.i, to: to.i })
}

// A dribble move starts: which one (where the flick points, and the hand the ball is in), its burst. No roll in here:
// a device calls it too, to move its own man before the referee has heard (moveLocal). dir: the flick (unit).
// Returns the move's key
export function moveBegin(p, dir) {
  const m = ref.moveOf(p, dir), M = MOVES[m.kind]
  p.mv = M.n; p.bn = p.burst = ticks(M.time); p.bdx = m.x; p.bdy = m.y; p.bs = 0; p.fkx = dir.x; p.fky = dir.y
  if (m.swap) p.hand = -(p.hand || 1)
  p.moveCd = p.bn + ticks(T.chainRec - T.chainRecHnd * p.R.hnd)
  p.mqT = -1
  return m.kind
}
// ...and turns into a spin: the burst bends round from the way it was going to the new way, over the spin's time
export function moveSpin(p, dir) {
  const a0 = Math.atan2(p.bdy, p.bdx)
  let turn = Math.atan2(dir.y, dir.x) - a0
  if (turn > Math.PI) turn -= 2 * Math.PI; else if (turn < -Math.PI) turn += 2 * Math.PI
  // (the short way round; all but a half turn goes round by his back, away from the basket: a real spin)
  if (Math.abs(turn) > 2.6) {
    const m = a0 + turn / 2
    if (Math.cos(m) * (RIM.x - p.x) + Math.sin(m) * (RIM.y - p.y) > 0) turn += turn > 0 ? -2 * Math.PI : 2 * Math.PI
  }
  p.mv = MOVES.spin.n; p.bn = p.burst = ticks(MOVES.spin.time); p.bdx = dir.x; p.bdy = dir.y; p.bs = turn; p.fkx = dir.x; p.fky = dir.y
  p.moveCd = p.bn + ticks(T.chainRec - T.chainRecHnd * p.R.hnd)
  p.mqT = -1
}
// A flick from the stick with the ball: a move now, the spin (rolled round early in a move), or one that waits for
// the move on now to end (the chain). tick: now. Returns 'spin', the move's key, or null (waiting). The device runs it
// too (moveLocal), so it has no roll in it
export function moveInput(p, dir, tick) {
  if (p.burst > 0 && p.mv !== MOVES.spin.n && p.bn - p.burst <= p.bn * T.spinWithin && ref.spinTurn(p, dir)) { moveSpin(p, dir); return 'spin' }
  if (p.burst > 0 || p.moveCd > 0) { p.mqx = dir.x; p.mqy = dir.y; p.mqT = tick + ticks(T.moveBuffer); return null }
  return moveBegin(p, dir)
}
// the flick that was waiting, now the move before it is done (null: none, or not yet)
export function moveQueued(p, tick) {
  if (p.mqT < 0) return null
  if (tick > p.mqT) { p.mqT = -1; return null }
  if (p.burst > 0 || p.moveCd > 0) return null
  return moveBegin(p, { x: p.mqx, y: p.mqy })
}
// a tick of a move's clock; the step-back ends with his feet set
function burstTick(p) {
  if (p.burst <= 0) return
  if (--p.burst > 0) return
  const M = MOVES[MOVE_KEYS[p.mv]]
  if (M?.set != null) { p.vx *= M.set; p.vy *= M.set }
  p.mv = 0; p.bs = 0
}
// how fast and which way a move has him going this tick: [x, y] of top speed. The burst builds, holds and eases off;
// a hesitation and an in-and-out start with a beat nearly standing (the in-and-out's a lean the other way: the fake)
const BV = [0, 0]
function burstVel(p) {
  const M = MOVES[MOVE_KEYS[p.mv]] ?? MOVES.cross, done = p.bn - p.burst
  const f = p.bn > 1 ? done / (p.bn - 1) : 1
  let sp = M.speed * (f < 0.18 ? 0.5 + 0.5 * f / 0.18 : f > 0.65 ? 1 - 0.3 * (f - 0.65) / 0.35 : 1), x = p.bdx, y = p.bdy
  if (M.stall && done < ticks(M.stall)) {
    sp = M.stallSpeed
    if (M.fake) {
      // the fake: his weight to the other side (the burst's way mirrored across the line to the basket)
      const d = ref.rimDist(p) || 1, fx = (RIM.x - p.x) / d, fy = (RIM.y - p.y) / d, k = 2 * (x * fx + y * fy)
      x = k * fx - x; y = k * fy - y
    }
  }
  if (p.bs) {
    // a spin: from the way it was going round to the way it ends up
    const a = Math.atan2(p.bdy, p.bdx) - p.bs * (1 - f)
    x = Math.cos(a); y = Math.sin(a)
  }
  BV[0] = x * sp; BV[1] = y * sp
  return BV
}

function doMove(s, p, dir) {
  const kind = dir ? moveInput(p, dir, s.tick) : moveQueued(p, s.tick)
  if (!kind) return
  if (kind === 'spin') { s.events.push({ e: 'move', pid: p.i, def: -1, freeze: false, ankles: false, kind: 'spin', hand: p.hand }); return }
  // his man: the nearest defender (he can only be frozen so often: T.moveCd)
  let def = null, dd = T.moveRange
  for (const o of s.players) if (o.team !== p.team) { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d <= dd) { dd = d; def = o } }
  let v = { freeze: false, ankles: false }
  if (p.frzCd <= 0 && def) {
    v = ref.judgeMove(fact(p), fact(def), { x: p.bdx, y: p.bdy }, rnd(s), rnd(s))
    p.frzCd = ticks(p.R.moveCd)
  }
  if (v.freeze) {
    def.act = v.ankles ? 'down' : 'frozen'; def.actT = 0; def.actN = ticks(v.ankles ? T.ankleDown : T.moveFreeze); def.vx = def.vy = 0
  }
  s.events.push({ e: 'move', pid: p.i, def: def ? def.i : -1, freeze: v.freeze, ankles: v.ankles, kind, hand: p.hand })
}

function doSteal(s, p) {
  const b = s.ball, h = s.players[b.holder]
  p.stealCd = ticks(T.stealCd)
  const v = ref.judgeSteal(fact(p), fact(h), rnd(s))
  if (v.ok) {
    s.stats[p.i].stl++; s.stats[h.i].tov++
    b.holder = p.i; holdBall(s)
    s.events.push({ e: 'steal', pid: p.i, from: h.i })
    if (s.mode === 'koth') kothStop(s, p, 'steal')
    else endPossession(s, 0, p.team, p.i, 'steal')
    return
  }
  p.act = 'frozen'; p.actT = 0; p.actN = ticks(v.reach ? T.stealReachFreeze : T.stealMiss)
  s.events.push({ e: 'swipe', pid: p.i, reach: v.reach })
}

function act(s, p, inp) {
  const b = s.ball
  const now = (inp.shoot ? B_SHOOT : 0) | (inp.pass ? B_PASS : 0) | (inp.steal ? B_STEAL : 0) | (inp.jump ? B_JUMP : 0)
  const edge = now & ~p.pb
  p.pb = now
  // (a press on defense is a swipe, not a shot that waits for the ball)
  if (edge & B_SHOOT) p.sq = p.team === s.poss ? s.tick : -1
  const has = b.st === 'held' && b.holder === p.i
  if (p.act === 'gather') {
    const held = p.actT * 1000 / HZ
    // a player on his own device: the shot goes when his device's quality arrives (it timed the meter); if it never
    // does, it goes late
    if (inp.pos) { if (inp.q != null || held >= p.shot.spec.total + T.remoteWaitMs) release(s, p, inp.q != null ? clamp(inp.q, 0, 1) : meterQuality(p.shot.spec, held)); return }
    if (inp.q != null || !(now & B_SHOOT) || held >= p.shot.spec.total) release(s, p, inp.q != null ? clamp(inp.q, 0, 1) : meterQuality(p.shot.spec, held))
    return
  }
  if (p.act !== 'free') return
  if (has) {
    if (p.noAct > 0) return
    // SHOOT pressed in the last half second (on the catch, on the board, a beat before the ball got there) goes now
    // (King of the Hill: not while he still has to clear it; a press then doesn't wait for it)
    if (s.mustClear === p.i) p.sq = -1
    if (p.sq >= 0 && s.tick - p.sq <= rticks(T.shootBuffer)) { p.sq = -1; startGather(s, p) }
    else if ((edge & B_PASS) && s.size > 1) doPass(s, p, inp)
    else {
      const dl = Math.hypot(+inp.dx || 0, +inp.dy || 0)
      if (dl >= T.moveAt) doMove(s, p, { x: inp.dx / dl, y: inp.dy / dl })
      else if (p.mqT >= 0) doMove(s, p, null)
    }
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
  if (p.frzCd > 0) p.frzCd--
  if (p.stealCd > 0) p.stealCd--
  if (p.noAct > 0) p.noAct--
  burstTick(p)
  if (p.act === 'free') return
  p.actT++
  if (p.act === 'jump') { if (p.actT >= ticks(T.jumpTime)) { p.act = 'land'; p.actT = 0 } }
  else if (p.act === 'land') { if (p.actT >= ticks(T.jumpLand)) { p.act = 'free'; p.actT = 0 } }
  else if (p.act !== 'gather' && p.actT >= p.actN) { p.act = 'free'; p.actT = 0 }
}

// where his own device says he is: taken as it comes, but never farther from the last spot than he could have run
function placeAt(s, p, pos) {
  const x = +pos.x, y = +pos.y
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy)
  const max = p.R.top * T.moveSpeed * DT * T.remoteSlack + T.remoteStep
  const k = d > max ? max / d : 1
  p.x = clamp(p.x + dx * k, COURT.minX - 2, COURT.maxX + 2); p.y = clamp(p.y + dy * k, COURT.minY - 2, COURT.maxY + 2)
  const vx = clamp(+pos.vx || 0, -30, 30), vy = clamp(+pos.vy || 0, -30, 30)
  p.vx = vx; p.vy = vy
  const sp = Math.hypot(vx, vy)
  if (sp > 1) { p.fx = vx / sp; p.fy = vy / sp }
  else if (s.ball.st === 'held' && s.ball.holder === p.i) { const r = ref.rimDist(p) || 1; p.fx = (RIM.x - p.x) / r; p.fy = (RIM.y - p.y) / r }
}

function move(s, p, inp) {
  if (inp.pos) { p.remote = true; placeAt(s, p, inp.pos); return }
  p.remote = false
  const has = s.ball.st === 'held' && s.ball.holder === p.i
  const def = p.team !== s.poss
  let top = has ? p.R.topBall : def ? p.R.topDef : p.R.top
  let mx = inp.mx || 0, my = inp.my || 0
  let m = Math.hypot(mx, my)
  if (m > 1) { mx /= m; my /= m; m = 1 }
  if (m < T.walk) { mx = my = 0 }
  if (p.act === 'frozen' || p.act === 'down') { p.vx = p.vy = 0 }
  else if (p.burst > 0) { const v = burstVel(p); p.vx = v[0] * top; p.vy = v[1] * top }
  else {
    if (p.act === 'gather') {
      if (p.shot.kind === 'jumper') {
        // off his feet: the stick does nothing, and the slide stops on takeoff the way a jump stops it
        top *= T.gatherSlowJ; mx = my = 0
        const v = Math.hypot(p.vx, p.vy)
        if (p.actT === 0 && v > top) { p.vx *= top / v; p.vy *= top / v }
      } else top *= T.gatherSlowL                // going up for a layup: the drive carries him
    } else if (p.act === 'follow') top *= 0.5
    else if (p.act === 'jump' || p.act === 'land') top *= 0.15
    const a = (def ? p.R.accelDef : p.R.accel) * DT
    const dvx = mx * top - p.vx, dvy = my * top - p.vy, dv = Math.hypot(dvx, dvy)
    if (dv <= a) { p.vx = mx * top; p.vy = my * top } else { p.vx += dvx / dv * a; p.vy += dvy / dv * a }
  }
  p.x += p.vx * DT; p.y += p.vy * DT
  const sp = Math.hypot(p.vx, p.vy)
  // (a step-back goes backwards: he still faces the way he was going, his man in front of him)
  if (p.burst > 0 && p.mv === MOVES.back.n) { p.fx = -p.bdx; p.fy = -p.bdy }
  else if (sp > 1) { p.fx = p.vx / sp; p.fy = p.vy / sp }
  else if (has) { const d = ref.rimDist(p) || 1; p.fx = (RIM.x - p.x) / d; p.fy = (RIM.y - p.y) / d }
  if (!has) keepIn(p, T.lineKeep)
  else if (p.act === 'gather') keepIn(p, 0)    // in the air with it: a shot that goes before he lands is good (step()), but he comes down on the court
}

// Never past a line; inside `keep` of it he's eased back in (no jump), and he doesn't walk farther out
function keepIn(p, keep) {
  const E = 0.15
  if (p.x < COURT.minX + keep) { p.x = Math.min(COURT.minX + keep, Math.max(COURT.minX, p.x) + E); if (p.vx < 0) p.vx = 0 }
  if (p.x > COURT.maxX - keep) { p.x = Math.max(COURT.maxX - keep, Math.min(COURT.maxX, p.x) - E); if (p.vx > 0) p.vx = 0 }
  if (p.y < COURT.minY + keep) { p.y = Math.min(COURT.minY + keep, Math.max(COURT.minY, p.y) + E); if (p.vy < 0) p.vy = 0 }
  if (p.y > COURT.maxY - keep) { p.y = Math.max(COURT.maxY - keep, Math.min(COURT.maxY, p.y) - E); if (p.vy > 0) p.vy = 0 }
}

// Bodies: nobody walks through anybody. A set defender in the handler's path, or anyone standing still, holds his ground
function collide(s, walk = false, slip = null) {
  const P = s.players, R2 = T.radius * 2, hb = s.ball.st === 'held' ? s.ball.holder : -1, holder = walk ? -1 : hb, n = P.length
  // (pairs in a different order every other tick: with three or more in a crowd nobody always goes first)
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = P[s.tick & 1 ? n - 1 - i : i], b = P[s.tick & 1 ? n - 1 - j : j]
    let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy)
    if (d >= R2 || (slip && (slip(a) || slip(b)))) continue
    if (d < 0.001) { dx = 1; dy = 0; d = 1 }
    const nx = dx / d, ny = dy / d, over = R2 - d
    // (the man guarding the ball holds a little ground, only while he's set: his weight, his Size, does the rest,
    // so a big backs a small man down and a small man doesn't move a big; between plays (walk) nobody is set: a man on
    // his spot gives a step to one going by)
    const set = (p, o) => walk || !(p.act === 'free' || p.act === 'jump' || p.act === 'land') ? 1
      : Math.hypot(p.vx, p.vy) < 1.2 && !(o.i === holder && p.team !== o.team) ? T.ground
      : o.i === holder && p.team !== o.team && Math.hypot(p.vx, p.vy) < T.groundDefSpeed ? T.groundDef : 1
    const ma = a.R.mass * set(a, b), mb = b.R.mass * set(b, a)
    // a man placed by his own device isn't pushed here (his device does its own bumping); the other one gives way
    let fa = mb / (ma + mb), fb = ma / (ma + mb)
    if (a.remote && b.remote) continue
    if (a.remote) { fa = 0; fb = 1 } else if (b.remote) { fa = 1; fb = 0 }
    // nobody bumps the man with the ball out of bounds (that's a foul, not his foot): at the line he holds his ground
    else if (a.i === hb && !ref.inBounds(a.x - nx * over * fa, a.y - ny * over * fa, -T.footIn - 0.05)) { fa = 0; fb = 1 }
    else if (b.i === hb && !ref.inBounds(b.x + nx * over * fb, b.y + ny * over * fb, -T.footIn - 0.05)) { fa = 1; fb = 0 }
    a.x -= nx * over * fa; a.y -= ny * over * fa
    b.x += nx * over * fb; b.y += ny * over * fb
    // the speed into each other is lost (he has to go around)
    const va = a.vx * nx + a.vy * ny, vb = b.vx * nx + b.vy * ny
    if (va > 0 && a.burst <= 0) { a.vx -= nx * va * fa; a.vy -= ny * va * fa }
    if (vb < 0 && b.burst <= 0) { b.vx -= nx * vb * fb; b.vy -= ny * vb * fb }
  }
}

function change(s, p, why, reb) {
  if (s.mode === 'koth') { kothStop(s, p, why); return }
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
    if (b.t > ticks(2.5)) { b.st = 'loose'; b.vx = b.vy = b.vz = 0; b.reb = false; b.grabAt = s.tick }
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
    const by = s.mode === 'koth' ? kothNext(s, b.lastTeam, b) : -1
    const to = s.mode === 'koth' ? s.players[by].team : 1 - b.lastTeam
    s.events.push({ e: 'oob', team: b.lastTeam, ball: true, to })
    b.st = 'dead'
    endPossession(s, 0, to, by >= 0 ? by : null, to === s.poss ? 'oob-keep' : 'oob')
    return
  }
  if (s.tick < b.grabAt) return
  let cands = null
  for (const p of P) {
    if (p.act === 'frozen' || p.act === 'down' || p.act === 'gather') continue
    if (p.act === 'follow' && p.i === b.from && !b.reb) continue     // blocked: he's still coming down
    const d = Math.hypot(p.x - b.x, p.y - b.y)
    if (d > p.R.grab) continue
    const up = p.act === 'jump' ? Math.sin(Math.PI * clamp(p.actT / ticks(T.jumpTime), 0, 1)) : 0
    if (b.z > p.R.standReach + (p.R.jumpReach - p.R.standReach) * up) continue
    ;(cands ??= []).push({ id: p.i, R: p.R, d, jump: p.act === 'jump' })
  }
  // nobody got to it: after a while it goes to whoever is nearest
  if (!cands && b.t > ticks(6)) {
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
    if (b.reb) s.clock = Math.max(s.clock, rticks(s.rules.orebClock))
    b.reb = false
  } else change(s, p, b.reb ? 'dreb' : 'loose')
}

// Between possessions: everyone walks to his spot for the check, around anybody in his way (bodies collide as they do
// in play). A dead ball (through the net, out of bounds, dropped at the horn) comes down, bounces and goes back to
// whoever checks it; nothing jumps. The ball is live once he has it, the check has had its second and everyone is on
// his spot, or a little after that wherever they are.
function betweenPlays(s) {
  const b = s.ball, P = s.players
  const dead = s.phase === 'dead', since = dead ? ticks(s.rules.deadTime) - s.phaseT : -1     // ticks into the dead ball
  const jog = !dead || since >= ticks(0.45)
  const off = dead ? s.next.team : s.poss
  const late = s.phase === 'check' && s.phaseT < -ticks(0.5)   // (see the contact below)
  if (since === 0) { b.fd = -1; b.fl = b.z <= 4 }          // a ball at hand height can go back now; one up high comes down first
  for (const p of P) {
    p.remote = false                                       // between plays the referee moves everyone
    if (p.act !== 'free') { p.actT++; if (p.actT >= p.actN || p.act === 'jump' || p.act === 'land' || p.act === 'gather') { p.act = 'free'; p.actT = 0 } }
    if (!jog || p.act !== 'free') { p.vx *= 0.7; p.vy *= 0.7; p.x += p.vx * DT; p.y += p.vy * DT; continue }
    walkToSpot(s, p, p.team === off, late)
  }
  // (half a second past the check and a man still isn't on his spot: two of them are stuck in each other's way, so
  // he slips by: no contact for him until he's there. Rare, and never with the ball live)
  collide(s, true, late ? p => Math.hypot(p.sx - p.x, p.sy - p.y) > T.spotNear : null)
  for (const p of P) keepIn(p, 0)
  if (b.st === 'held') holdBall(s)
  // (a dunk: the ball is left under the rim a beat longer, while the man who threw it down is still on his way down)
  else if (b.st === 'dead') deadBall(s, dead ? s.next.carrier : b.fd, !dead || since >= ticks(b.kind === 'dunk' && b.verdict?.made ? 0.6 : 0.2))
  s.phaseT--
  if (dead) {
    if (s.phaseT > 0) return
    s.phase = 'check'; s.phaseT = ticks(s.rules.checkTime)
    s.poss = s.next.team
    const c = s.next.carrier
    s.next = null
    if (s.mode === 'koth') kingIs(s, c)
    if (b.st === 'held') holdBall(s)                       // (only ever in his hands: endPossession)
    else if (b.fd < 0) feedStart(s, c)                     // still coming down: it goes to him from here
    s.events.push({ e: 'check', team: s.poss, pid: c })
    return
  }
  // the check
  if (s.phaseT > 0) return
  if (b.st !== 'held') {
    if (s.phaseT > -ticks(T.checkWait + 2)) return
    b.holder = b.fd; b.fd = -1; holdBall(s)                // (never: the ball is quicker than any man)
  }
  const there = P.every(p => Math.hypot(p.sx - p.x, p.sy - p.y) <= T.spotNear)
  if (!there && s.phaseT > -ticks(T.checkWait)) return
  // the ball is live: everyone where he stands (on his spot, or a step from it), set
  for (const p of P) {
    p.vx = p.vy = 0; p.act = 'free'; p.actT = 0; p.noAct = 0; p.pb = 0; p.sq = -1
    faceCheck(p, p.team === s.poss)
    p.catchFrom = -1
  }
  s.phase = 'live'; s.clock = rticks(s.rules.shotClock[s.size - 1])
  holdBall(s)
  s.events.push({ e: 'live', team: s.poss })
}

// set for the check: the offense faces the rim, the defense faces his man (away from it)
function faceCheck(p, offense) {
  const d = ref.rimDist(p) || 1
  p.fx = (RIM.x - p.x) / d; p.fy = (RIM.y - p.y) / d
  if (!offense) { p.fx = -p.fx; p.fy = -p.fy }
}

// a walk (a jog from far) to his spot, stepping around a man in the way; the last step slows, and he turns to set up
function walkToSpot(s, p, offense, late) {
  const dx = p.sx - p.x, dy = p.sy - p.y, d = Math.hypot(dx, dy)
  if (d < 0.02) { p.vx = p.vy = 0; faceCheck(p, offense); return }
  const ux = dx / d, uy = dy / d, R2 = T.radius * 2
  let wx = ux, wy = uy
  if (!late) for (const o of s.players) {
    if (o === p) continue
    const ox = o.x - p.x, oy = o.y - p.y, od = Math.hypot(ox, oy)
    if (od < 0.01 || od > R2 + 2.5 || od > d + R2 * 0.5) continue      // not between him and his spot
    const ahead = (ox * ux + oy * uy) / od
    if (ahead < 0.25) continue
    const cr = ux * oy - uy * ox                                      // > 0: the man is on his left, so he goes right
    const side = cr > 0.05 ? 1 : cr < -0.05 ? -1 : (p.i < o.i ? 1 : -1)
    const w = 1.6 * ahead * clamp(1 - (od - R2) / 2.5, 0, 1)
    wx += side * uy * w; wy -= side * ux * w
  }
  const wl = Math.hypot(wx, wy) || 1
  const sp = Math.min(17, d / DT, Math.max(6, d * 1.4))
  p.vx = wx / wl * sp; p.vy = wy / wl * sp
  p.x += p.vx * DT; p.y += p.vy * DT
  if (d < 1.5) faceCheck(p, offense)
  else { p.fx = wx / wl; p.fy = wy / wl }
}

// A dead ball: on its own it falls, bounces and rolls to a stop; once it has hit the floor (or was at hand height) and
// may go (go), it's tossed back to the man who checks it (to), coming up into his hands
function deadBall(s, to, go) {
  const b = s.ball
  if (b.fd < 0) {
    b.vz -= G * DT
    b.x += b.vx * DT; b.y += b.vy * DT; b.z += b.vz * DT
    if (b.z <= 0) { b.z = 0; b.fl = true; if (b.vz < -4) { b.vz = -b.vz * 0.45; b.vx *= 0.65; b.vy *= 0.65 } else b.vz = 0 }
    if (b.z === 0 && b.vz === 0) { b.vx *= T.looseFriction; b.vy *= T.looseFriction }
    if (!go || !b.fl || to == null || to < 0) return
    feedStart(s, to)
  }
  const h = s.players[b.fd], hx = h.x + h.fx * 1.1, hy = h.y + h.fy * 1.1
  const dx = hx - b.x, dy = hy - b.y, d = Math.hypot(dx, dy), v = T.feedSpeed * DT
  if (d <= v) { b.holder = b.fd; b.fd = -1; holdBall(s); return }
  b.fD = Math.max(b.fD, d)
  b.x += dx / d * v; b.y += dy / d * v
  const f = clamp(1 - (d - v) / b.fD, 0, 1)
  b.z = b.sz + (3 - b.sz) * f + Math.min(4, b.fD * 0.12) * 4 * f * (1 - f)
  b.vx = dx / d * T.feedSpeed; b.vy = dy / d * T.feedSpeed; b.vz = 0
}
function feedStart(s, to) {
  const b = s.ball, h = s.players[to]
  b.fd = to; b.sz = b.z; b.fD = Math.max(1, Math.hypot(h.x + h.fx * 1.1 - b.x, h.y + h.fy * 1.1 - b.y))
}

export function step(s, inputs) {
  s.events.length = 0
  if (s.phase === 'over') return s
  const up = s.players.map(p => p.act === 'gather')
  tick(s, inputs)
  // a shot that never left his hand (the shot clock, a steal, the possession over): no release, so no grade for it.
  // { e: 'noshot', pid } (the screen shows no meter grade for it)
  for (const p of s.players) {
    if (up[p.i] && p.act !== 'gather' && !s.events.some(e => (e.e === 'release' && e.pid === p.i) || (e.e === 'block' && e.on === p.i))) s.events.push({ e: 'noshot', pid: p.i })
  }
  return s
}

function tick(s, inputs) {
  s.tick++
  if (s.phase !== 'live') { betweenPlays(s); return s }
  const P = s.players
  for (const p of P) timers(p)
  // everyone's buttons in turn, starting with a different man each tick: two things on the same tick (a swipe and a
  // shot going up, a jump and a release) don't always go the same man's way
  for (let k = 0; k < P.length; k++) { const p = P[(k + s.tick) % P.length]; if (s.phase !== 'live') return s; act(s, p, inputs?.[p.i] || IDLE) }
  if (s.phase !== 'live') return s
  for (const p of P) move(s, p, inputs?.[p.i] || IDLE)
  collide(s)
  ballStep(s)
  if (s.phase !== 'live') return s
  const b = s.ball
  if (b.st === 'held') {
    const h = P[b.holder]
    // out: his foot on the line (T.footIn), on the floor; a shooter in the air is still in (he lets it go before he lands)
    if (h.act !== 'gather' && !ref.inBounds(h.x, h.y, -T.footIn)) {
      s.stats[h.i].tov++
      const by = s.mode === 'koth' ? kothNext(s, h.i, h) : -1
      const to = by >= 0 ? s.players[by].team : 1 - h.team
      s.events.push({ e: 'oob', team: h.team, pid: h.i, to })
      endPossession(s, 0, to, by >= 0 ? by : null, 'oob')
      return s
    }
    // King of the Hill: past the arc with it, he's the king
    if (s.mustClear === h.i && ref.isThree(h.x, h.y)) { s.mustClear = null; s.events.push({ e: 'cleared', pid: h.i }) }
  }
  if (b.st === 'held' || b.st === 'pass') {
    if (--s.clock <= 0) {
      const h = P[b.st === 'held' ? b.holder : b.from]
      s.stats[h.i].tov++
      s.events.push({ e: 'clock', team: s.poss, pid: h.i })
      if (b.st === 'pass') b.st = 'dead'
      const by = s.mode === 'koth' ? kothNext(s, h.i, b) : -1
      endPossession(s, 0, by >= 0 ? s.players[by].team : 1 - s.poss, by >= 0 ? by : null, 'clock')
    }
  }
  return s
}

// Online, on a player's own device: his own body moves now, with the same rules as the step (speed, the ball, a
// dribble move's burst, rising for a shot), against everyone else where the screen has them (they don't give way here; the
// referee settles real contact). Nothing else in the state changes.
export function moveLocal(s, i, inp) {
  const p = s.players[i]
  burstTick(p)
  const wasRemote = p.remote
  move(s, p, { mx: inp.mx, my: inp.my })
  p.remote = wasRemote
  const R2 = T.radius * 2
  for (const o of s.players) {
    if (o === p) continue
    let dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy)
    if (d >= R2) continue
    if (d < 0.001) { dx = 1; dy = 0; d = 1 }
    const nx = dx / d, ny = dy / d
    p.x += nx * (R2 - d); p.y += ny * (R2 - d)
    const v = p.vx * nx + p.vy * ny
    if (v < 0 && p.burst <= 0) { p.vx -= nx * v; p.vy -= ny * v }
  }
}

// a copy of the state (it is plain data)
export const cloneState = s => JSON.parse(JSON.stringify(s))

// What the meter by a shooter needs (the screen): his shot's spec and read, or null
export const shotOf = (s, i) => s.players[i].shot
