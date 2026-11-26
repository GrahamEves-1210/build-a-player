// BLACKTOP LIVE: the simulation. A fixed step (tune.js: 30 to one of the game's seconds, 36 of them in a real second):
// step(state, inputs) moves the game one tick on.
// The next state is a function of the state, every player's input for the tick and the seed, and of nothing
// else: no clock, no Math.random, no DOM. The state is plain data (JSON-safe), so it can be copied, sent, replayed
// and run in Node (scripts/btlive/balance.mjs) or on the live server. Everything discrete is decided by the
// referee (referee.js) from the facts it is handed and a seeded roll; the simulation moves bodies and the ball.
//
//   const s = createGame({ teams: [[p, ...], [p, ...]], seed })      p = { id, name, pos: 'guard' | 'big', build }
//   King of the Hill (modes.js): three sides of one, teams: [[a], [b], [c]]. Then players[i].team === i, s.score[i]
//   is his score, s.poss is the king's side (= his index), s.king the king (on the ball), s.sit the man sitting out
//   (players[s.sit].out: he waits off the sideline, T.bench; nothing he does counts). The other one guards the king.
//   A make: the king keeps it (make it, take it), the man he scored on sits and the one sitting comes in to guard him.
//   A stop (a defensive board, a steal, a block he comes up with, the king stepping out or the shot clock): the
//   defender is the new king, the old king sits, the one sitting comes in. Every change is checked at the top
//   s.mustClear                     the side (team index) that has to take it back past the arc before a basket counts,
//                                   or null. 1v1 and 2v2: a stop (a defensive board, a steal, a pick, a block the defense
//                                   comes up with) is a live ball, no check; whoever secures it has to take it back
//                                   behind the arc first (a pass out to a teammate behind it does it too). A basket
//                                   before that is waved off and it's the other side's ball at the check. An offensive
//                                   board needs no clear. The check stays for the start, a make, out of bounds and the
//                                   shot clock
//   step(s, inputs)                 inputs[i] for s.players[i] (missing: standing still)
//   input = { mx, my,               the stick, -1..1 each (length <= 1): a little push walks, all the way runs
//             shoot, pass,          held buttons with the ball (pass without it: call for the ball)
//             steal, jump,          held buttons without it (SHOOT without the ball is BLOCK on defense and a jump for
//                                   the board with a shot or a loose ball up: there is no button of its own for a jump)
//             dx, dy,               a dribble move: the stick's flick, -1..1 each, sent on the one tick it's made
//                                   (pushed T.moveAt or more). Which move it is: where it points, and how he's going
//                                   (referee.moveOf). In the post it's a post move (a side: the drop step or the spin;
//                                   away from the rim: he faces up). Picked up (a pump fake after dribbling), nothing
//             sp,                   with dx, dy: the stick rolled round (gesture.js 'roll', SHIFT): the spin, rolled
//                                   that way (1 or -1) to end up going dx, dy
//             fake,                 SHOOT tapped (let go inside T.fakeMs of the press): a pump fake, not a shot (a
//                                   release on the sim's own clock that quick is one too; online: q -1)
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
import { meterSpec, meterQuality, windowFor } from './meter.js'
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
// (a man who bit on a pump fake is out of the play while he comes down: to the referee he's beaten)
const fact = p => ({ id: p.id, x: p.x, y: p.y, vx: p.vx, vy: p.vy, fx: p.fx, fy: p.fy, act: p.bit ? 'frozen' : p.act, actT: p.actT * DT, burst: p.burst, mv: p.mv, bdx: p.bdx, bdy: p.bdy, R: p.R })
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
    hand: 1, frzCd: 0, mvT: -1,                       // the hand the ball is in (1 his right, -1 his left); till a move can freeze his man again
    fkx: 0, fky: -1, mqx: 0, mqy: 0, mqT: -1, chn: 0, bk: 1,   // (chn: ticks since a move ended that make the next a chained one; bk: this move's speed share)  // the flick that made the move on now; a flick waiting for it to end (until tick mqT)
    sq: -1,                                  // the tick of his latest SHOOT press that hasn't started a shot (-1: none)
    shot: null,                              // going up: { kind, spec, d, three, run, read, cUp, mx, my (the way he was going into it) }
    catchT: -999, catchFrom: -1,             // the last catch: when, from whom (index)
    man: -1, sx: 0, sy: 0,                   // the man he guards (index), his spot at the check
    boost: 0,                                // ticks left of the quick beat out of a dribble move
    sta: 1,                                  // his dribble legs, 0-1: every move costs some (a chained one more), simple
                                             // dribbling, standing and the time off the ball give it back
    out: false,                              // King of the Hill: sitting out this possession
    // the ball in his hands this time (all back to 0 the moment it leaves them):
    dr: 0,                                   // he has dribbled (moved with it, a move): a pump fake now picks it up
    pick: 0, pvx: 0, pvy: 0,                 // his dribble picked up: no more dribbling, he pivots on this foot
    fakeN: 0, fkEnd: -99,                    // pump fakes this time, and the tick the last one came down
    openT: 0, openBy: -1,                    // a man bit on his fake: the next shot started before this tick is wide open
    post: 0, postN: 0, postL: 0, postCd: 0, postBy: -1, bump: 0, awayT: 0,   // in the post (his back to his man postBy)
    smx: 0, smy: 0,                          // his stick last tick (a fadeaway: SHOOT in the post with it away from the rim)
    bit: 0,                                  // on defense: he went up for a pump fake (comes down slow, out of the play)
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
    king: null, sit: -1, mustClear: null,    // King of the Hill: the king, the man sitting out (indexes); 1v1/2v2: the side that must take it back (team)
    clock: 0, next: null, winner: null, gamePoint: false, possN: 0, ck: 0, ckT: 0,   // (ck: King of the Hill's check, betweenPlays)
    ball: { st: 'held', holder: 0, x: 0, y: 0, z: 3, vx: 0, vy: 0, vz: 0, from: -1, to: -1, t: 0, n: 0, sx: 0, sy: 0, sz: 0, tx: 0, ty: 0, verdict: null, near: [], tried: [], lastTeam: 0, reb: false, grabAt: 0, speed: 0, kind: null,
      fd: -1, fD: 0, fl: false },            // a dead ball on its way to the man who checks it: to whom, from how far; has it hit the floor
    call: null,                              // a teammate calling for the ball: { pid (index), tick }
    stats: players.map(stat0),
    cpu: players.map(() => null),            // the CPU players' own notes (cpu.js)
    cn: 0,                                   // ...and their roll count
    events: [],
  }
  s.poss = koth ? Math.min(2, Math.floor(rnd(s) * 3)) : rnd(s) < 0.5 ? 0 : 1
  if (koth) { const others = [0, 1, 2].filter(t => t !== s.poss), d = others[rnd(s) < 0.5 ? 0 : 1]; kingIs(s, pointOf(s, s.poss), others.find(t => t !== d)) }
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
  const WINGS = [{ x: 44.5, y: 26.5 }, { x: 11.5, y: 26.5 }], POSTS = [{ x: 35.6, y: 12.5 }, { x: 20.4, y: 12.5 }]
  for (const p of s.players) {
    if (p.team !== team) continue
    if (p.i === carrier) { p.sx = C.x; p.sy = C.y; continue }
    const at = (p.pos === 'big' ? POSTS : WINGS)[wing++ % 2]
    p.sx = at.x; p.sy = at.y
  }
  if (s.mode === 'koth') {
    // the man guarding the king checks it, right up on him; the one sitting out waits off the sideline
    const m = s.players[carrier], d = Math.hypot(RIM.x - m.sx, RIM.y - m.sy) || 1
    for (const p of s.players) {
      if (p.team === team) continue
      if (p.out) { p.sx = T.bench.x; p.sy = T.bench.y; continue }
      p.sx = m.sx + (RIM.x - m.sx) * 4.2 / d; p.sy = m.sy + (RIM.y - m.sy) * 4.2 / d
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
  for (const p of s.players) { p.burst = 0; p.mv = 0; p.bs = 0; p.mqT = -1; p.shot = null; if (p.act !== 'down') { p.act = 'free'; p.actT = 0 } p.pb = 0; p.bit = 0; p.sta = 1; letGoOf(p) }
  s.call = null; s.mustClear = null
  if (st.over) {
    s.phase = 'over'; s.winner = st.winner
    s.events.push({ e: 'final', winner: st.winner, score: [...s.score] })
    return
  }
  s.phase = 'dead'; s.phaseT = ticks(s.rules.deadTime)
  const c = carrier != null && s.players[carrier].team === nextTeam ? carrier : pointOf(s, nextTeam)
  s.next = { team: nextTeam, carrier: c }
  if (s.mode === 'koth') {
    // the rotation: a make sends the man he scored on to sit; a stop sends the king. The one sitting comes in on D
    // (out of bounds off the defender: nobody moves)
    const king = s.king, def = kothDef(s), sit = s.sit
    if (why === 'make') kingIs(s, c, def)
    else if (c !== king) kingIs(s, c, king)
    else kingIs(s, c, sit)
    s.next.sit = s.sit
    // the check: the ball goes to the man guarding the king, and he checks it up to him at the top (betweenPlays)
    s.next.checker = kothDef(s)
    if (s.sit !== sit) s.events.push({ e: 'rotate', king: c, sit: s.sit, in: sit, why })
  }
  setSpots(s, nextTeam, c)
  // the ball stays in the hands of whoever checks it next; otherwise it's dead where it is
  if (s.ball.st === 'held' && s.ball.holder !== c) { s.ball.st = 'dead'; s.ball.vx = s.ball.vy = s.ball.vz = 0 }
}

// King of the Hill: he's the king, sit sits out, and the other one guards him
function kingIs(s, i, sit) {
  s.king = i; s.sit = sit
  for (const p of s.players) { p.out = p.i === sit; p.man = p.i === i || p.out ? -1 : i }
}
// King of the Hill: the man guarding the king
export const kothDef = s => { for (const p of s.players) if (p.i !== s.king && !p.out) return p.i; return -1 }
// everyone who's playing (not the man sitting out)
const on = p => !p.out

// A stop (a defensive board, a steal, a pick, a block the defense comes up with), in every mode. (A new possession:
// everyone's legs full again, as after a basket or a check) No check: the ball
// stays live and the man who has it is on the attack at once, but his side has to take it back past the arc before a
// basket counts (King of the Hill: and then he's the king)
function stop(s, p, why) {
  if (s.mode === 'koth') {
    // King of the Hill: the stop is his crown. A dead ball: the old king sits, the one sitting out comes in to guard
    // him, and he checks it at the top
    s.ball.holder = p.i; holdBall(s)
    if (p.act === 'jump') { p.act = 'land'; p.actT = 0 }
    endPossession(s, 0, p.team, p.i, why)
    return
  }
  s.events.push({ e: 'poss', team: s.poss, pts: 0, why })
  s.possN++
  s.poss = p.team; s.mustClear = p.team
  if (s.mode === 'koth') kingIs(s, p.i)
  s.call = null
  for (const o of s.players) { o.burst = 0; o.mv = 0; o.bs = 0; o.mqT = -1; o.boost = 0; if (o.act === 'gather' || o.act === 'fake') { o.act = 'free'; o.actT = 0; o.shot = null } o.sta = 1; letGoOf(o) }
  s.ball.holder = p.i; holdBall(s)
  p.noAct = ticks(0.2); p.catchFrom = -1
  if (p.act === 'jump') { p.act = 'land'; p.actT = 0 }
  s.clock = rticks(s.rules.shotClock[s.size - 1])
  s.events.push({ e: 'clear', pid: p.i, team: p.team, why })
}

// King of the Hill: a dead ball (out of bounds, the shot clock) goes to the other man on the floor from the one who
// touched it last (last: his index): off the king it's the defender's crown, off the defender the king keeps it
function kothNext(s, last) {
  for (const p of s.players) if (on(p) && p.i !== last) return p.i
  return -1
}

// a layup or a dunk: one roll a player a possession, from the seed, so a device can show the right meter before the
// referee's word arrives (a dunk's green window is wider)
export const dunkRoll = (s, i) => rollAt(s.seed ^ 0x0d0c, s.possN * 8 + i)
// (an open lane, going at the rim: an able dunker takes off from farther out)
// In the post (farther out than T.postLay): the hook, or with the stick away from the rim the fadeaway. Picked up after
// a fake his man bit on, a step through toward the rim from close in: the up-and-under (a layup)
export const shotKindAt = (s, i) => {
  const p = s.players[i], defs = s.players.filter(o => o.team !== p.team && on(o)), d = ref.rimDist(p)
  if (p.pick && p.openT > s.tick && d <= T.uauRange && ref.rimDist({ x: p.pvx, y: p.pvy }) - d >= 0.5) return 'layup'
  if (p.post && d > T.postLay) {
    const m = Math.hypot(p.smx, p.smy), away = m > 0.3 && (p.smx * (RIM.x - p.x) + p.smy * (RIM.y - p.y)) / (m * (d || 1)) < -0.4
    return away ? 'fade' : 'hook'
  }
  return ref.shotKind(p.R, d, dunkRoll(s, i), ref.laneOpen(p, defs), ref.dunkGuarded(p, defs), clamp(Math.hypot(p.vx, p.vy) / (p.R.top || 9), 0, 1))
}
// The ball out of his hands: his dribble, the post, a fake's open window, all done with
function letGoOf(p) { p.dr = 0; p.pick = 0; p.post = 0; p.postN = 0; p.postL = 0; p.fakeN = 0; p.openT = 0; p.openBy = -1; p.bump = 0; p.awayT = 0 }

// How hard his shot is right now, and so how wide its green window: his rating from there, how far behind the line,
// the hand in his face as it is this tick (a man closing out shrinks it while he rises), on the move, his legs, a shot
// straight off the check, game point. Sets p.shot.spec.win (the meter reads it live), .read and .p
export function shotWindow(s, p) {
  const sh = p.shot
  if (!sh) return
  const defs = s.players.filter(o => o.team !== p.team && on(o)).map(fact)
  const c = ref.contestOf(fact(p), defs, sh.kind).c
  const cs = p.catchFrom >= 0 && s.tick - p.catchT <= T.csWindow * HZ ? s.players[p.catchFrom].R.pas : null
  const pT = ref.makeChance({ R: p.R, kind: sh.kind, d: sh.d, past: sh.kind === 'jumper' ? ref.arcPast(p.x, p.y) : 0, c, run: sh.run, cs, rushed: s.clock <= T.rushAt * HZ, gp: s.gamePoint || Math.max(...s.score) >= s.rules.goal - T.clutchFrom, sta: p.sta, fresh: freshOf(s, p) })
  sh.p = pT; sh.c = c
  sh.spec.win = windowFor(pT, sh.kind) * (sh.spec.clutch ?? 1)
  // his man bit on the fake: wide open (T.fakeOpen), past the usual most
  if (sh.open) sh.spec.win = Math.min(sh.spec.win * T.fakeOpen, (ref.jumpLike(sh.kind) || sh.kind === 'hook' ? T.winMax : T.winMaxL) * 1.5)
  sh.read = c < 0.2 ? 0 : c < 0.5 ? 1 : 2
}
// a shot straight off the check: 1 at the check, fading to 0 over T.checkRushS or at his first move
const freshOf = (s, p) => (s.liveT == null || p.mvT > s.liveT ? 0 : clamp(1 - (s.tick - s.liveT) / rticks(T.checkRushS), 0, 1))

function startGather(s, p) {
  const d = ref.rimDist(p)
  const kind = shotKindAt(s, p.i)
  const spec = meterSpec(kind, p.R, s.gamePoint, ref.dunkLift(p.R))
  const defs = s.players.filter(o => o.team !== p.team && on(o)).map(fact)
  const c0 = ref.contestOf(fact(p), defs, kind).c
  // how well he could be contested as he rises (every man in reach with a hand up): a man who only gets there late
  // takes less off the shot (referee.judgeShot)
  const cUp = ref.contestOf(fact(p), defs.map(ref.handUp), kind).c
  // the read on the meter: how open he is. A high IQ reads it true; a low one is a step off about half the time
  let read = c0 < 0.2 ? 0 : c0 < 0.5 ? 1 : 2
  const r = rnd(s)
  if (r > 0.45 + 0.55 * p.R.iq) read = clamp(read + (r > 0.8 ? 1 : -1), 0, 2)
  const top = p.R.topBall
  // (on the move: how fast he was going into it, of his speed with the ball. A step-back lands him set)
  const run = clamp(Math.hypot(p.vx, p.vy) / top, 0, 1), rl = Math.hypot(p.vx, p.vy) || 1
  p.shot = { kind, spec, d, three: kind === 'jumper' && ref.isThree(p.x, p.y), run, read, cUp, mx: run > 0.3 ? p.vx / rl : 0, my: run > 0.3 ? p.vy / rl : 0, open: p.openT > s.tick }
  // (the fadeaway goes back off his man: the drift is away from the rim)
  if (kind === 'fade') { p.shot.mx = -(RIM.x - p.x) / (d || 1); p.shot.my = -(RIM.y - p.y) / (d || 1); p.shot.run = 0.6 }
  p.act = 'gather'; p.actT = 0; p.burst = 0; p.mv = 0; p.bs = 0; p.mqT = -1; p.boost = 0
  shotWindow(s, p)
  s.events.push({ e: 'gather', pid: p.i, kind })
}

function release(s, p, q) {
  const b = s.ball, sh = p.shot
  const cs = p.catchFrom >= 0 && s.tick - p.catchT <= T.csWindow * HZ ? s.players[p.catchFrom].R.pas : null
  const rushed = s.clock <= T.rushAt * HZ
  // late in the game (game point, or anyone three from the goal): Clutch counts
  const late = s.gamePoint || Math.max(...s.score) >= s.rules.goal - T.clutchFrom
  const defs = s.players.filter(o => o.team !== p.team && on(o))
  const v = ref.judgeShot(fact(p), defs.map(fact), { kind: sh.kind, d: sh.d, past: sh.kind === 'jumper' ? ref.arcPast(p.x, p.y) : 0, three: sh.three, q, run: sh.run, cs, rushed, cUp: sh.cUp, gp: late, sta: p.sta, fresh: freshOf(s, p) },
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
  b.st = 'shot'; b.sx = p.x; b.sy = p.y; b.sz = sh.kind === 'dunk' ? 10.5 : sh.kind === 'hook' ? 8.8 : 8; b.x = p.x; b.y = p.y; b.z = b.sz
  b.t = 0; b.n = ticks(sh.kind === 'dunk' ? 0.16 : sh.kind === 'layup' ? 0.36 : sh.kind === 'hook' ? 0.4 + sh.d * 0.01 : 0.5 + sh.d * 0.014)
  b.tx = spot.x; b.ty = spot.y; b.rx = p.x; b.ry = p.y
  b.verdict = { made: v.made, pts: v.pts, poster: !!v.poster, deep: !!v.deep, three: sh.three, kind: sh.kind, d: sh.d, c: v.c, p: v.p, q, by: v.by ?? null, uncl: s.mustClear === p.team }
  s.events.push({ e: 'release', pid: p.i, kind: sh.kind, three: sh.three, d: sh.d, q, c: v.c, p: v.p, cs: cs != null, run: sh.run })
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
  if (v.made && v.uncl) {
    // it went in, but his side never took it back past the arc: no basket, and it's the other side's ball (King of
    // the Hill: the closer of the other two men)
    b.st = 'dead'; b.x = RIM.x; b.y = RIM.y; b.z = 9.4; b.vx = b.vy = 0; b.vz = v.kind === 'dunk' ? -26 : -3
    st.tov++
    s.events.push({ e: 'waved', pid: p.i, pts: v.pts, kind: v.kind, three: v.three })
    const by = s.mode === 'koth' ? kothNext(s, p.i) : -1
    endPossession(s, 0, by >= 0 ? s.players[by].team : 1 - p.team, by >= 0 ? by : null, 'waved')
    return
  }
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
export function moveBegin(p, dir, sp = 0) {
  if (sp) return spinBegin(p, dir, sp)
  const m = ref.moveOf(p, dir), M = MOVES[m.kind]
  p.mv = M.n; p.bn = p.burst = ticks(M.time); p.bdx = m.x; p.bdy = m.y; p.bs = 0; p.fkx = dir.x; p.fky = dir.y
  if (m.swap) p.hand = -(p.hand || 1)
  // a spin from the stick: it rolls round from the way the flick went (back, off his man) to the way it comes out
  if (m.kind === 'spin') { let t = Math.atan2(m.y, m.x) - Math.atan2(dir.y, dir.x); if (t > Math.PI) t -= 2 * Math.PI; else if (t < -Math.PI) t += 2 * Math.PI; p.bs = t }
  // tired legs: a slower, shorter burst (never none)
  p.bk = (p.chn > 0 ? T.chainSlow : 1) * (T.staFloor + (1 - T.staFloor) * (p.sta ?? 1))
  p.sta = Math.max(0, (p.sta ?? 1) - T.staMove - (p.chn > 0 ? T.staChain : 0))
  p.moveCd = p.bn + ticks(T.chainRec - T.chainRecHnd * p.R.hnd)
  p.mqT = -1; p.dr = 1
  return m.kind
}
// A spin from the stick rolled round (sp: the way it rolled, 1 or -1): from the way he's going (or facing) round by his
// back to dir, over the spin's time
function spinBegin(p, dir, sp) {
  const M = MOVES.spin, sv = Math.hypot(p.vx, p.vy)
  const a0 = sv > 2 ? Math.atan2(p.vy, p.vx) : Math.atan2(p.fy, p.fx)
  let turn = Math.atan2(dir.y, dir.x) - a0
  while (turn > Math.PI) turn -= 2 * Math.PI
  while (turn < -Math.PI) turn += 2 * Math.PI
  // (the way the thumb rolled it: a short turn the other way round goes the long way instead, but never more than
  // a turn and a quarter)
  if (sp && Math.sign(turn) !== Math.sign(sp) && Math.abs(turn) > 0.35) turn += sp > 0 ? 2 * Math.PI : -2 * Math.PI
  if (Math.abs(turn) < 1.2) turn = Math.sign(sp || turn || 1) * 1.2
  p.mv = M.n; p.bn = p.burst = ticks(M.time); p.bdx = dir.x; p.bdy = dir.y; p.bs = turn; p.fkx = dir.x; p.fky = dir.y
  p.bk = (p.chn > 0 ? T.chainSlow : 1) * (T.staFloor + (1 - T.staFloor) * (p.sta ?? 1))
  p.sta = Math.max(0, (p.sta ?? 1) - T.staMove - (p.chn > 0 ? T.staChain : 0))
  p.moveCd = p.bn + ticks(T.chainRec - T.chainRecHnd * p.R.hnd)
  p.mqT = -1; p.dr = 1
  return 'spin'
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
  if (p.chn > 0) p.bk = T.chainSlow * (T.staFloor + (1 - T.staFloor) * (p.sta ?? 1))
  p.sta = Math.max(0, (p.sta ?? 1) - T.staSpin)
  p.moveCd = p.bn + ticks(T.chainRec - T.chainRecHnd * p.R.hnd)
  p.mqT = -1
}
// A flick from the stick with the ball: a move now, or one that waits for the move on now to end (the chain). sp: the
// stick was rolled round (the spin; early in another move it bends that one round). Only a roll is a spin: a flick
// never is. tick: now. Returns 'spin', the move's key, or null (waiting). The device runs it too (moveLocal), so it
// has no roll in it
export function moveInput(p, dir, tick, sp = 0) {
  if (sp && p.burst > 0 && p.mv !== MOVES.spin.n && p.bn - p.burst <= p.bn * T.spinWithin) { moveSpin(p, dir); return 'spin' }
  if (p.burst > 0 || p.moveCd > 0) { p.mqx = dir.x; p.mqy = dir.y; p.mqs = sp || 0; p.mqT = tick + ticks(T.moveBuffer); return null }
  return moveBegin(p, dir, sp)
}
// the flick that was waiting, now the move before it is done (null: none, or not yet)
export function moveQueued(p, tick) {
  if (p.mqT < 0) return null
  if (tick > p.mqT) { p.mqT = -1; return null }
  if (p.burst > 0 || p.moveCd > 0) return null
  return moveBegin(p, { x: p.mqx, y: p.mqy }, p.mqs || 0)
}
// a tick of a move's clock; the step-back ends with his feet set
function burstTick(p) {
  if (p.chn > 0) p.chn--
  // the legs come back: off a move (a beat after the last one), quicker off the ball than working it
  if (p.burst <= 0 && p.chn <= 0 && p.sta < 1) p.sta = Math.min(1, p.sta + T.staBack * DT)
  if (p.burst <= 0) return
  if (--p.burst > 0) return
  p.chn = ticks(T.chainGap)
  const M = MOVES[MOVE_KEYS[p.mv]]
  if (M?.set != null) { p.vx *= M.set; p.vy *= M.set }
  // out of a hesitation, a crossover, between the legs or an in-and-out: a beat quicker (he's gone)
  else if (M && M.boost) p.boost = ticks(T.boostTime)
  p.mv = 0; p.bs = 0
}
// how fast and which way a move has him going this tick: [x, y] of top speed. The burst builds, holds and eases off;
// a hesitation and an in-and-out start with a beat nearly standing (the in-and-out's a lean the other way: the fake)
const BV = [0, 0]
function burstVel(p) {
  const M = MOVES[MOVE_KEYS[p.mv]] ?? MOVES.cross, done = p.bn - p.burst
  const f = p.bn > 1 ? done / (p.bn - 1) : 1
  let sp = M.speed * (p.bk || 1) * (f < 0.18 ? 0.5 + 0.5 * f / 0.18 : f > 0.65 ? 1 - 0.3 * (f - 0.65) / 0.35 : 1), x = p.bdx, y = p.bdy
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

function doMove(s, p, dir, sp = 0) {
  const kind = dir ? moveInput(p, dir, s.tick, sp) : moveQueued(p, s.tick)
  if (!kind) return
  p.mvT = s.tick
  if (kind === 'spin') { s.events.push({ e: 'move', pid: p.i, def: -1, freeze: false, ankles: false, kind: 'spin', hand: p.hand }); return }
  // his man: the nearest defender (he can only be frozen so often: T.moveCd)
  let def = null, dd = T.moveRange
  for (const o of s.players) if (o.team !== p.team && on(o)) { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d <= dd) { dd = d; def = o } }
  let v = { freeze: false, ankles: false }
  if (p.frzCd <= 0 && def) {
    v = ref.judgeMove({ ...fact(p), sta: p.sta }, fact(def), { x: p.bdx, y: p.bdy }, rnd(s), rnd(s))
    p.frzCd = ticks(p.R.moveCd)
  }
  if (v.freeze) {
    def.act = v.ankles ? 'down' : 'frozen'; def.actT = 0; def.actN = ticks(v.ankles ? T.ankleDown : T.moveFreeze); def.vx = def.vy = 0
  }
  s.events.push({ e: 'move', pid: p.i, def: def ? def.i : -1, freeze: v.freeze, ankles: v.ankles, kind, hand: p.hand })
}

// ── the post ──────────────────────────────────────────────────────────────────────────────────────
// the man on him in the post: the nearest defender within reach, between him and the rim (or -1)
function postMan(s, p, reach) {
  const d = ref.rimDist(p) || 1, ux = (RIM.x - p.x) / d, uy = (RIM.y - p.y) / d
  let best = -1, bd = reach
  for (const o of s.players) {
    if (o.team === p.team || !on(o)) continue
    const dd = Math.hypot(o.x - p.x, o.y - p.y)
    if (dd > bd || dd < 0.01) continue
    if (((o.x - p.x) * ux + (o.y - p.y) * uy) / dd < T.postFront) continue
    bd = dd; best = o.i
  }
  return best
}
const postSized = (p, backing) => p.pos === 'big' || (backing && (p.R.sizeRaw ?? 0) >= T.postGuard)
// Every tick, for the man with the ball: into the post (his man on him, near the rim, slowed to a dribble or backing
// in), and out of it (his man gone off him). inp: his input this tick
function postWatch(s, p, inp) {
  if (p.postCd > 0) p.postCd--
  const free = p.act === 'free' && p.burst <= 0 && !p.pick
  if (!p.post) {
    const d = ref.rimDist(p), m = Math.hypot(inp.mx || 0, inp.my || 0)
    const back = m >= 0.3 && ((inp.mx || 0) * (RIM.x - p.x) + (inp.my || 0) * (RIM.y - p.y)) / (m * (d || 1)) > 0.45
    const idle = m < T.walk
    const D = free && p.postCd <= 0 && d <= T.postRange && (back || idle) && postSized(p, back) && Math.hypot(p.vx, p.vy) < T.postSlow ? postMan(s, p, T.postDef) : -1
    if (D < 0) { p.postN = 0; return }
    if (++p.postN < ticks(back ? T.postEnterBack : T.postEnter)) return
    p.post = 1; p.postBy = D; p.postL = 0; p.bump = 0; p.awayT = 0; p.dr = 1
    s.events.push({ e: 'post', pid: p.i, on: D })
    return
  }
  // in it: his man still on him?
  const D = postMan(s, p, T.postDef + 1.5)
  if (D >= 0) { p.postBy = D; p.postL = 0 } else if (++p.postL >= ticks(T.postLose)) postOff(s, p, 'lost')
}
function postOff(s, p, why) {
  if (!p.post) return
  p.post = 0; p.postN = 0; p.postCd = ticks(T.postCd); p.bump = 0; p.awayT = 0
  s.events.push({ e: 'postoff', pid: p.i, why })
}
// A flick in the post: to a side the drop step (the baseline side) or the spin (the middle), round his man to the rim;
// away from the rim he faces up (out of the post, the dribble still live)
function postMove(s, p, dir) {
  const d = ref.rimDist(p) || 1, ux = (RIM.x - p.x) / d, uy = (RIM.y - p.y) / d, rx = -uy, ry = ux
  const fwd = dir.x * ux + dir.y * uy
  if (fwd < -0.55) {
    postOff(s, p, 'faceup')
    p.fx = ux; p.fy = uy
    s.events.push({ e: 'faceup', pid: p.i })
    return
  }
  if (p.burst > 0 || p.moveCd > 0) return
  const lat = dir.x * rx + dir.y * ry, side = lat >= 0 ? 1 : -1
  // (the baseline side: the side of the rim he's on, away from the middle of the lane)
  const off = (p.x - RIM.x) * rx + (p.y - RIM.y) * ry
  const base = Math.abs(off) > 0.8 ? Math.sign(off) : (p.hand || 1)
  const kind = side === base ? 'drop' : 'spin', M = MOVES[kind]
  const c = Math.cos(0.9), sn = Math.sin(0.9)
  p.mv = M.n; p.bn = p.burst = ticks(M.time); p.bdx = ux * c + rx * side * sn; p.bdy = uy * c + ry * side * sn; p.fkx = dir.x; p.fky = dir.y
  p.bs = kind === 'spin' ? side * 0.01 : 0
  p.bk = T.staFloor + (1 - T.staFloor) * (p.sta ?? 1)
  p.sta = Math.max(0, (p.sta ?? 1) - T.staMove)
  p.moveCd = p.bn + ticks(T.chainRec - T.chainRecHnd * p.R.hnd)
  p.hand = side; p.mqT = -1; p.dr = 1; p.mvT = s.tick
  const def = p.postBy >= 0 ? s.players[p.postBy] : null
  const v = ref.judgePost({ ...fact(p), sta: p.sta }, def ? fact(def) : null, rnd(s))
  if (def && v.by) { def.act = 'frozen'; def.actT = 0; def.actN = ticks(T.dropFreeze); def.vx = def.vy = 0 }
  else if (def) p.bk *= T.dropCut
  postOff(s, p, kind)
  s.events.push({ e: 'move', pid: p.i, def: def ? def.i : -1, freeze: !!(def && v.by), ankles: false, kind, hand: p.hand, post: true })
}

// ── pump fakes ───────────────────────────────────────────────────────────────────────────────────
// SHOOT tapped: he shows the ball and brings it down. If he'd dribbled, that's his dribble picked up (he pivots from
// here on). A man already up for it (he went up as it started) bit
function pumpFake(s, p) {
  p.act = 'fake'; p.actT = 0; p.actN = ticks(T.fakeTime); p.shot = null; p.fakeN++
  if (p.dr && !p.pick) { p.pick = 1; p.pvx = p.x; p.pvy = p.y }
  s.events.push({ e: 'fake', pid: p.i, pick: !!p.pick, n: p.fakeN })
  for (const o of s.players) if (o.team !== p.team && on(o) && o.act === 'jump' && !o.bit && o.actT <= ticks(0.3) && Math.hypot(o.x - p.x, o.y - p.y) < 9) bite(s, o, p)
}
// d went up for h's fake: he's out of the play while he comes down, and h's next shot is wide open
function bite(s, d, h) {
  d.bit = 1
  h.openT = s.tick + rticks(T.fakeOpenS); h.openBy = d.i
  s.events.push({ e: 'bite', pid: d.i, on: h.i })
}
// a defender just went up: at a pump fake (on now, or only just come down)?
function biteCheck(s, d) {
  const b = s.ball
  if (b.st !== 'held') return
  const h = s.players[b.holder]
  if (h.team === d.team || Math.hypot(h.x - d.x, h.y - d.y) > 9) return
  if (h.act === 'fake' || (h.act === 'free' && s.tick - h.fkEnd <= rticks(T.biteAfter))) bite(s, d, h)
}

function doSteal(s, p) {
  const b = s.ball, h = s.players[b.holder]
  p.stealCd = ticks(T.stealCd)
  const v = ref.judgeSteal(fact(p), fact(h), rnd(s))
  if (v.ok) {
    s.stats[p.i].stl++; s.stats[h.i].tov++
    b.holder = p.i; holdBall(s)
    s.events.push({ e: 'steal', pid: p.i, from: h.i })
    stop(s, p, 'steal')
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
  p.smx = +inp.mx || 0; p.smy = +inp.my || 0
  if (p.act === 'gather') {
    const held = p.actT * 1000 / HZ
    // a tap (let go inside T.fakeMs): a pump fake, not a shot. His own device says so (fake, or q -1 online); on the
    // step's own clock, SHOOT up that quick with no quality timed
    if (inp.fake || inp.q === -1 || (!inp.pos && inp.q == null && !(now & B_SHOOT) && held < T.fakeMs)) { pumpFake(s, p); return }
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
    // (before his side has taken it back it still goes up: a make then is waved off, shotLands)
    if (p.sq >= 0 && s.tick - p.sq <= rticks(T.shootBuffer)) { p.sq = -1; startGather(s, p) }
    else if ((edge & B_PASS) && s.size > 1) doPass(s, p, inp)
    else {
      const dl = Math.hypot(+inp.dx || 0, +inp.dy || 0)
      // (picked up: no dribble move, the stick pivots him: move. In the post a flick is a post move)
      if (p.pick) { p.mqT = -1; return }
      if (p.post) { if (dl >= T.moveAt) postMove(s, p, { x: inp.dx / dl, y: inp.dy / dl }); return }
      if (dl >= T.moveAt) doMove(s, p, { x: inp.dx / dl, y: inp.dy / dl }, inp.sp ? Math.sign(+inp.sp) : 0)
      else if (p.mqT >= 0) doMove(s, p, null)
    }
    return
  }
  const ballUp = b.st === 'shot' || b.st === 'loose'
  // no button of its own for a jump: SHOOT without the ball is BLOCK on defense (a hand up at the shot, a block, a
  // board) and on offense a jump for the board with a shot or a loose ball up (a press while it's in a teammate's
  // hands waits for the catch: shootBuffer)
  const up = (edge & B_JUMP) || ((edge & B_SHOOT) && (p.team !== s.poss || ballUp))
  if (p.team !== s.poss) {
    if ((edge & B_STEAL) && p.stealCd <= 0 && b.st === 'held') { doSteal(s, p); return }
    if (up) { p.act = 'jump'; p.actT = 0; s.events.push({ e: 'jump', pid: p.i }); lateBlock(s, p); biteCheck(s, p) }
    return
  }
  if (up && ballUp) { p.act = 'jump'; p.actT = 0; p.sq = -1; s.events.push({ e: 'jump', pid: p.i }) }
  else if ((edge & B_PASS) && b.st === 'held') { s.call = { pid: p.i, tick: s.tick }; s.events.push({ e: 'call', pid: p.i }) }
}

// a man who goes up just after the release (T.blockAfter) can still get a hand on it, near where it left the hand
function lateBlock(s, d) {
  const b = s.ball
  if (b.st !== 'shot' || b.t > ticks(T.blockAfter) || b.from < 0) return
  const sh = s.players[b.from]
  const at = { ...fact(sh), x: b.rx ?? sh.x, y: b.ry ?? sh.y }
  const v = ref.judgeShot(at, [{ ...fact(d), act: 'jump', after: true }], { kind: b.kind, d: b.verdict?.d ?? 0, q: 0 }, { block: [rnd(s)] })
  if (v.blocked == null) return
  s.stats[d.i].blk++
  b.verdict = null
  swat(s, sh, d)
  s.events.push({ e: 'block', pid: d.i, on: sh.i, chase: v.chase, kind: b.kind, late: true })
}

function timers(p, s) {
  if (p.boost > 0) p.boost--
  if (p.moveCd > 0) p.moveCd--
  if (p.frzCd > 0) p.frzCd--
  if (p.stealCd > 0) p.stealCd--
  if (p.noAct > 0) p.noAct--
  burstTick(p)
  if (p.act === 'free') return
  p.actT++
  if (p.act === 'jump') { if (p.actT >= ticks(T.jumpTime)) { p.act = 'land'; p.actT = 0 } }
  // (a man who bit on a fake comes down slow: T.bitLand)
  else if (p.act === 'land') { if (p.actT >= ticks(p.bit ? T.bitLand : T.jumpLand)) { p.act = 'free'; p.actT = 0; p.bit = 0 } }
  else if (p.act !== 'gather' && p.actT >= p.actN) { if (p.act === 'fake') p.fkEnd = s.tick; p.act = 'free'; p.actT = 0 }
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
  // (going anywhere with it is dribbling it: a pump fake from here on picks it up)
  if (has && p.act === 'free' && !p.pick && m > 0 && s.phase === 'live') p.dr = 1
  if (p.act === 'frozen' || p.act === 'down') { p.vx = p.vy = 0 }
  else if (p.burst > 0) { const v = burstVel(p); p.vx = v[0] * top; p.vy = v[1] * top }
  else if (has && p.pick && p.act === 'free') { pivot(p, mx, my, m); return }
  else if (has && p.act === 'fake') { p.vx *= 0.6; p.vy *= 0.6 }
  else if (has && p.post && p.act === 'free') { postFeet(s, p, mx, my, m) }
  else {
    if (p.act === 'gather') {
      if (p.shot.kind === 'jumper' || p.shot.kind === 'hook' || p.shot.kind === 'fade') {
        // off his feet: the stick does nothing, and the slide stops on takeoff the way a jump stops it
        top *= T.gatherSlowJ; mx = my = 0
        // (the fadeaway: back off his man as he rises)
        if (p.shot.kind === 'fade' && p.actT < ticks(0.35)) { mx = p.shot.mx; my = p.shot.my; top = 3.4 }
        const v = Math.hypot(p.vx, p.vy)
        if (p.actT === 0 && v > top) { p.vx *= top / v; p.vy *= top / v }
      } else top *= T.gatherSlowL                // going up for a layup: the drive carries him
    } else if (p.act === 'follow') top *= 0.5
    else if (p.act === 'jump' || p.act === 'land') top *= 0.15
    // a dunk from out in the open lane: the takeoff carries him to the rim, in the air, by the time it's thrown down
    const glide = p.act === 'gather' && p.shot?.kind === 'dunk' ? ref.rimDist(p) : 0
    if (glide > 1.6) {
      const left = Math.max(2, Math.round(p.shot.spec.ideal / 1000 * HZ) - p.actT)
      const v = clamp((glide - 1.4) / (left * DT), Math.hypot(p.vx, p.vy) * 0.8, 26)
      p.vx = (RIM.x - p.x) / glide * v; p.vy = (RIM.y - p.y) / glide * v
    } else {
      // guarding: he faces his man, so going backwards (giving ground) or sliding sideways is slower than going at him
      if (def && !has && p.act === 'free' && m > 0) {
        const o = p.man >= 0 ? s.players[p.man] : null, od = o ? Math.hypot(o.x - p.x, o.y - p.y) : 99
        if (od < 14 && od > 0.1) {
          const dot = (mx * (o.x - p.x) + my * (o.y - p.y)) / (od * m)
          top *= dot >= 0 ? T.slide + (1 - T.slide) * dot : T.slide + (T.backpedal - T.slide) * -dot
        }
      }
      if (p.boost > 0 && p.act === 'free') top *= 1 + T.boost
      // a beaten defender (his man between him and the rim) running to get back: a burst, on his legs
      // (running back toward the rim, off the lines)
      if (def && !has && p.act === 'free' && m > 0 && p.man >= 0 && beatenBy(p, s.players[p.man]) && ref.inBounds(p.x, p.y, -3)
        && (mx * (RIM.x - p.x) + my * (RIM.y - p.y)) / (m * (ref.rimDist(p) || 1)) > 0.3) { top *= 1 + T.recover; p.sta = Math.max(0, (p.sta ?? 1) - T.recoverSta * DT) }
      if (p.act === 'jump') {
        // in the air: he goes where his jump was taking him (a running jump carries), the stick does nothing
        p.vx *= 1 - T.airDrag * DT; p.vy *= 1 - T.airDrag * DT
      } else {
        // a sprint: built going one way, not in a defensive stance
        const stance = def && !has && p.man >= 0 && Math.hypot(s.players[p.man].x - p.x, s.players[p.man].y - p.y) < 9 && !beatenBy(p, s.players[p.man])
        if (!stance && p.act === 'free') top *= 1 + T.sprint * clamp((p.runT ?? 0) / T.sprintTime, 0, 1)
        move2(p, mx * top, my * top, top, (def ? p.R.accelDef : p.R.accel) / T.accel, p.R.spdRaw ?? 0.5)
      }
      // the ball in the hand on the side he's going (his right as he faces the basket): across to the other hand when
      // he turns that way; straight at the basket or back keeps the hand it's in
      if (has && p.act === 'free') {
        const d = ref.rimDist(p) || 1, lat = p.vx * -(RIM.y - p.y) / d + p.vy * (RIM.x - p.x) / d
        if (Math.abs(lat) > T.handSwitch && Math.sign(lat) !== (p.hand || 1)) { p.hand = Math.sign(lat); s.events.push({ e: 'hand', pid: p.i, hand: p.hand }) }
      }
    }
  }
  p.x += p.vx * DT; p.y += p.vy * DT
  const sp = Math.hypot(p.vx, p.vy)
  // the sprint's clock: on while he keeps going one way near full speed, cut back by a turn, gone when he slows
  if (p.act !== 'jump') {
    const hx = p.hx ?? 0, hy = p.hy ?? 0, full = sp > 0.6 * (p.R.top || 9)
    if (full) {
      const dot = (p.vx * hx + p.vy * hy) / sp
      p.runT = dot >= 0.985 ? (p.runT ?? 0) + DT : (p.runT ?? 0) * clamp((dot - T.sprintKeep) / (0.985 - T.sprintKeep), 0, 1)
    } else p.runT = (p.runT ?? 0) * 0.8
    if (sp > 0.1) { p.hx = p.vx / sp; p.hy = p.vy / sp }
  }
  // (a step-back goes backwards: he still faces the way he was going, his man in front of him)
  if (p.burst > 0 && p.mv === MOVES.back.n) { p.fx = -p.bdx; p.fy = -p.bdy }
  // (in the post: his back to his man and the rim; a fake: square to the rim)
  else if (has && p.post && p.burst <= 0 && p.act === 'free') { const d = ref.rimDist(p) || 1; p.fx = -(RIM.x - p.x) / d; p.fy = -(RIM.y - p.y) / d }
  else if (has && p.act === 'fake') { const d = ref.rimDist(p) || 1; p.fx = (RIM.x - p.x) / d; p.fy = (RIM.y - p.y) / d }
  else if (def && !has && p.man >= 0 && p.act === 'free' && Math.hypot(s.players[p.man].x - p.x, s.players[p.man].y - p.y) < 14) {
    // guarding: square to his man, whichever way his feet go
    const o = s.players[p.man], od = Math.hypot(o.x - p.x, o.y - p.y) || 1
    p.fx = (o.x - p.x) / od; p.fy = (o.y - p.y) / od
  }
  else if (sp > 1) { p.fx = p.vx / sp; p.fy = p.vy / sp }
  else if (has) { const d = ref.rimDist(p) || 1; p.fx = (RIM.x - p.x) / d; p.fy = (RIM.y - p.y) / d }
  if (!has) keepIn(p, T.lineKeep)
  else if (p.act === 'gather') keepIn(p, 0)    // in the air with it: a shot that goes before he lands is good (step()), but he comes down on the court
}

// Picked up: his pivot foot stays down (pvx, pvy) and the other one steps round it, no farther than T.pivotR (a step
// through, the up-and-under), turning him the way the stick points. Pushed off it by a body, the pivot goes with him
function pivot(p, mx, my, m) {
  let x = p.x + mx * T.pivotSpeed * DT, y = p.y + my * T.pivotSpeed * DT
  let dx = x - p.pvx, dy = y - p.pvy, d = Math.hypot(dx, dy)
  if (d > T.pivotR) { x = p.pvx + dx / d * T.pivotR; y = p.pvy + dy / d * T.pivotR }
  p.vx = (x - p.x) / DT; p.vy = (y - p.y) / DT; p.x = x; p.y = y
  // (where he's turned: the way he's stepping, or square to the rim)
  if (m > 0.3) { p.fx = mx / m; p.fy = my / m }
  else { const r = ref.rimDist(p) || 1; p.fx = (RIM.x - p.x) / r; p.fy = (RIM.y - p.y) / r }
  keepIn(p, 0)
}
// The post's feet. The stick toward the rim: he backs his man down, bump by bump (a shove, then he settles), each one
// taking ground off him by Size against Size (and his strength, and the man's Interior D), his man pushed back with
// him; nobody on him: he backs into the space. Across: he slides along the block. Away: he faces up, after a beat
// (T.postAway; a flick away does it at once). Nothing: he holds his spot
function postFeet(s, p, mx, my, m) {
  const d = ref.rimDist(p) || 1, ux = (RIM.x - p.x) / d, uy = (RIM.y - p.y) / d
  const dot = m > 0 ? (mx * ux + my * uy) / m : 0
  const D = p.postBy >= 0 ? s.players[p.postBy] : null
  let vx = 0, vy = 0
  if (m >= 0.3 && dot > 0.45 && d > 2.2) {
    p.awayT = 0
    const cyc = ticks(T.postBump), push = Math.max(1, Math.round(cyc * T.postPush)), ph = p.bump % cyc
    p.bump++
    const touch = D && Math.hypot(D.x - p.x, D.y - p.y) < T.radius * 2 + 0.45 && D.act !== 'frozen' && D.act !== 'down'
    if (!touch) { vx = ux * T.postFree; vy = uy * T.postFree }
    else if (ph < push) {
      const R = p.R, Q = D.R
      const k = clamp((1 + T.postSize * ((R.sizeRaw ?? R.size) - (Q.sizeRaw ?? Q.size))) * (1 + T.postStr * (R.fin - 0.75)) * (1 - T.postInt * ((Q.intRaw ?? Q.int) - 0.5)), T.postGainMin, T.postGainMax)
        * (T.staFloor + (1 - T.staFloor) * (p.sta ?? 1))
      const g = T.postGain * k / push                    // ft this tick
      vx = ux * g / DT; vy = uy * g / DT
      // his man goes back with him (a man in the air or stepping round isn't moved)
      if (D.act === 'free' || D.act === 'land') { D.x += ux * g; D.y += uy * g }
      if (ph === 0) { p.sta = Math.max(0, (p.sta ?? 1) - T.postSta); s.events.push({ e: 'bump', pid: p.i, on: D.i, gain: +(T.postGain * k).toFixed(2) }) }
    }
  } else if (m >= 0.3 && dot < -0.45) {
    p.bump = 0
    if (++p.awayT >= ticks(T.postAway)) { postOff(s, p, 'faceup'); s.events.push({ e: 'faceup', pid: p.i }) }
  } else if (m >= 0.3) {
    p.bump = 0; p.awayT = 0
    const lat = mx * -uy + my * ux
    vx = -uy * lat * T.postSide; vy = ux * lat * T.postSide
  } else { p.bump = 0; p.awayT = 0 }
  p.vx += (vx - p.vx) * 0.6; p.vy += (vy - p.vy) * 0.6
}

// a defender beaten: his man nearer the rim than him by a step, and close enough to matter
const beatenBy = (p, o) => !!o && !o.out && Math.hypot(o.x - p.x, o.y - p.y) < 16 && ref.rimDist(o) < ref.rimDist(p) - 1.5

// Feet: from where he's going to where the stick wants him (tvx, tvy). Speeding up along the way he's going is
// quickest on the first step and slows as he nears top speed; slowing down (or reversing) is a brake, quicker than
// that but not instant; a turn at speed has its own limit, so cutting hard costs speed through the cut. rf: his rating's
// share of the base push (Speed, Size; Perimeter D guarding)
function move2(p, tvx, tvy, top, rf, spd = 0.5) {
  const sp = Math.hypot(p.vx, p.vy)
  // a hard cut at speed (the stick over 50 degrees off the way he's going): he bleeds speed through it, a quick man less
  const tv = Math.hypot(tvx, tvy)
  if (sp > 0.6 * top && tv > 0.1 && (tvx * p.vx + tvy * p.vy) / (tv * sp) < 0.64) { const k = 1 - T.cutLoss * (1 - T.cutSpd * spd) * DT; p.vx *= k; p.vy *= k }
  const push = T.accel * rf * Math.max(0.4, T.firstStep - T.stepFade * clamp(sp / (top || 1), 0, 1)) * DT
  const dvx = tvx - p.vx, dvy = tvy - p.vy
  if (sp < 0.3) {
    const dv = Math.hypot(dvx, dvy)
    if (dv <= push) { p.vx = tvx; p.vy = tvy } else { p.vx += dvx / dv * push; p.vy += dvy / dv * push }
    return
  }
  const ux = p.vx / sp, uy = p.vy / sp
  const par = dvx * ux + dvy * uy, px = dvx - par * ux, py = dvy - par * uy, perp = Math.hypot(px, py)
  const lim = par > 0 ? push : T.brake * rf * DT
  const dp = clamp(par, -lim, lim)
  const tl = Math.max(push, T.brake * 0.8 * rf * DT)
  const k = perp > tl ? tl / perp : 1
  p.vx += ux * dp + px * k; p.vy += uy * dp + py * k
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
    if (a.out || b.out) continue
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

function change(s, p, why) { stop(s, p, why) }

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
      if (o.team === to.team || b.tried[o.i] || o.out) continue
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
    const arc = ref.jumpLike(b.kind) ? 5 + b.verdict.d * 0.22 : b.kind === 'hook' ? 4 : b.kind === 'layup' ? 2 : 0.4
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
    const by = s.mode === 'koth' ? kothNext(s, b.lastTeam) : -1
    const to = s.mode === 'koth' ? s.players[by].team : 1 - b.lastTeam
    s.events.push({ e: 'oob', team: b.lastTeam, ball: true, to })
    b.st = 'dead'
    endPossession(s, 0, to, by >= 0 ? by : null, to === s.poss ? 'oob-keep' : 'oob')
    return
  }
  if (s.tick < b.grabAt) return
  let cands = null
  for (const p of P) {
    if (p.act === 'frozen' || p.act === 'down' || p.act === 'gather' || p.out) continue
    if (p.act === 'follow' && p.i === b.from && !b.reb) continue     // blocked: he's still coming down
    const own = b.reb && p.i === b.from
    const d = Math.hypot(p.x - b.x, p.y - b.y)
    // (his own miss: he's still landing, so his reach for it is shorter for a beat)
    if (own && b.t < ticks(T.selfRebWait) && d > p.R.grab * 0.5) continue
    if (d > p.R.grab) continue
    const up = p.act === 'jump' ? Math.sin(Math.PI * clamp(p.actT / ticks(T.jumpTime), 0, 1)) : 0
    if (b.z > p.R.standReach + (p.R.jumpReach - p.R.standReach) * up) continue
    ;(cands ??= []).push({ id: p.i, R: p.R, d, jump: p.act === 'jump', own })
  }
  // nobody got to it: after a while it goes to whoever is nearest
  if (!cands && b.t > ticks(6)) {
    let near = P.find(on)
    for (const p of P) if (on(p) && Math.hypot(p.x - b.x, p.y - b.y) < Math.hypot(near.x - b.x, near.y - b.y)) near = p
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
  for (const p of P) if (!p.out) keepIn(p, 0)
  if (b.st === 'held') holdBall(s)
  // (a dunk: the ball is left under the rim a beat longer, while the man who threw it down is still on his way down)
  else if (b.st === 'dead') deadBall(s, dead ? s.next.checker ?? s.next.carrier : b.fd, !dead || since >= ticks(b.kind === 'dunk' && b.verdict?.made ? 0.6 : 0.2))
  s.phaseT--
  if (dead) {
    if (s.phaseT > 0) return
    s.phase = 'check'; s.phaseT = ticks(s.rules.checkTime)
    s.poss = s.next.team
    const c = s.next.carrier, chk = s.next.checker ?? -1
    s.next = null
    // King of the Hill: a dead ball goes to the man guarding the king, who checks it up to him (s.ck: 1 waiting for it)
    s.ck = chk >= 0 ? 1 : 0
    if (b.st === 'held') holdBall(s)                       // (only ever in his hands: endPossession)
    else if (b.fd < 0) feedStart(s, s.ck ? chk : c)        // still coming down: it goes to him from here
    s.events.push({ e: 'check', team: s.poss, pid: c })
    return
  }
  // the check
  if (s.ck === 2) { checkPass(s); return }
  if (s.ck === 3) { if (--s.ckT > 0) return; s.ck = 0 }
  else {
    if (s.phaseT > 0) return
    if (b.st !== 'held') {
      if (s.phaseT > -ticks(T.checkWait + 2)) return
      b.holder = b.fd; b.fd = -1; holdBall(s)              // (never: the ball is quicker than any man)
    }
    const there = P.every(p => p.out || Math.hypot(p.sx - p.x, p.sy - p.y) <= T.spotNear)
    if (!there && s.phaseT > -ticks(T.checkWait)) return
    // King of the Hill: CHECK. The man guarding the king bounces it to him; a beat, and it's live
    if (s.ck === 1) {
      s.ck = 0
      if (b.holder !== s.king) {
        const d = P[b.holder], k = P[s.king]
        s.ck = 2; b.st = 'check'; b.from = d.i; b.to = k.i; b.t = 0; b.n = ticks(T.checkPass)
        b.sx = b.x; b.sy = b.y; b.sz = b.z
        s.events.push({ e: 'checkup', pid: d.i, to: k.i })
        return
      }
    }
  }
  // the ball is live: everyone where he stands (on his spot, or a step from it), set
  for (const p of P) {
    p.vx = p.vy = 0; p.act = 'free'; p.actT = 0; p.noAct = 0; p.pb = 0; p.sq = -1
    faceCheck(p, p.team === s.poss)
    p.catchFrom = -1
  }
  s.phase = 'live'; s.clock = rticks(s.rules.shotClock[s.size - 1]); s.liveT = s.tick
  holdBall(s)
  s.events.push({ e: 'live', team: s.poss })
}

// King of the Hill: the check, a bounce pass from the man guarding the king to the king's hands (down to the floor
// half way, back up), then a beat (T.checkBeat) and the ball is live
function checkPass(s) {
  const b = s.ball, k = s.players[b.to]
  b.t++
  const f = clamp(b.t / b.n, 0, 1), tx = k.x + k.fx * 1.1, ty = k.y + k.fy * 1.1
  b.vx = (tx - b.x) * HZ; b.vy = (ty - b.y) * HZ
  b.x = b.sx + (tx - b.sx) * f; b.y = b.sy + (ty - b.sy) * f
  b.z = f < 0.5 ? b.sz * (1 - f / 0.5) : 3 * (f - 0.5) / 0.5
  if (b.t === Math.round(b.n / 2)) s.events.push({ e: 'checkbounce' })
  if (b.t < b.n) return
  b.holder = k.i; holdBall(s)
  s.ck = 3; s.ckT = ticks(T.checkBeat)
  s.events.push({ e: 'checked', pid: k.i })
}

// set for the check: the offense faces the rim, the defense faces his man (away from it)
function faceCheck(p, offense) {
  if (p.out) { p.fx = -1; p.fy = 0; return }               // (sitting out: watching the game)
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
    if (up[p.i] && p.act !== 'gather' && p.act !== 'fake' && !s.events.some(e => (e.e === 'release' && e.pid === p.i) || (e.e === 'block' && e.on === p.i))) s.events.push({ e: 'noshot', pid: p.i })
  }
  return s
}

function tick(s, inputs) {
  s.tick++
  if (s.phase !== 'live') { betweenPlays(s); return s }
  const P = s.players
  for (const p of P) timers(p, s)
  for (const p of P) if (p.act === 'gather' && p.shot) shotWindow(s, p)
  // everyone's buttons in turn, starting with a different man each tick: two things on the same tick (a swipe and a
  // shot going up, a jump and a release) don't always go the same man's way
  for (let k = 0; k < P.length; k++) { const p = P[(k + s.tick) % P.length]; if (s.phase !== 'live') return s; if (!p.out) act(s, p, inputs?.[p.i] || IDLE) }
  if (s.phase !== 'live') return s
  // the man with the ball: into the post, or out of it; everyone else's dribble, post and fakes are done with
  for (const p of P) { if (s.ball.st === 'held' && s.ball.holder === p.i) postWatch(s, p, inputs?.[p.i] || IDLE); else if (p.dr || p.pick || p.post || p.fakeN || p.openT) letGoOf(p) }
  // (the man sitting out stands at the side and watches)
  for (const p of P) { if (p.out) { p.pb = 0; p.sx = T.bench.x; p.sy = T.bench.y; walkToSpot(s, p, false, true); continue } move(s, p, inputs?.[p.i] || IDLE) }
  collide(s)
  ballStep(s)
  if (s.phase !== 'live') return s
  const b = s.ball
  if (b.st === 'held') {
    const h = P[b.holder]
    // out: his foot on the line (T.footIn), on the floor; a shooter in the air is still in (he lets it go before he lands)
    if (h.act !== 'gather' && !ref.inBounds(h.x, h.y, -T.footIn)) {
      s.stats[h.i].tov++
      const by = s.mode === 'koth' ? kothNext(s, h.i) : -1
      const to = by >= 0 ? s.players[by].team : 1 - h.team
      s.events.push({ e: 'oob', team: h.team, pid: h.i, to })
      endPossession(s, 0, to, by >= 0 ? by : null, 'oob')
      return s
    }
    // taken back: behind the arc with it, both feet (King of the Hill: then he's the king)
    if (s.mustClear === h.team && ref.behindArc(h.x, h.y, T.clearPast)) { s.mustClear = null; s.events.push({ e: 'cleared', pid: h.i, team: h.team }) }
  }
  if (b.st === 'held' || b.st === 'pass') {
    if (--s.clock <= 0) {
      const h = P[b.st === 'held' ? b.holder : b.from]
      s.stats[h.i].tov++
      s.events.push({ e: 'clock', team: s.poss, pid: h.i })
      if (b.st === 'pass') b.st = 'dead'
      const by = s.mode === 'koth' ? kothNext(s, h.i) : -1
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
