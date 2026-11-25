// BLACKTOP LIVE: the games, the seats, the dribble moves and the pace, checked headless. King of the Hill's rules (make it take it, the clear,
// out of bounds, the shot clock, 11 by 2 capped at 15, no passing), three-way win rates, 2v2 with four people each on
// his own man, the call for the ball, the room's seats for 1v1 / 2v2 / King of the Hill, and the rematch.
// Bundle and run from the repo root (it imports the live room too):
//   node_modules/.bin/esbuild scripts/btlive/modes-check.mjs --bundle --platform=node --format=esm --outfile=/tmp/mc.mjs \
//     --define:import.meta.env='{"DEV":false}' --loader:.json=json && node /tmp/mc.mjs [--runs=300]
import { createGame, step, cpuInput, flatBuild, referee as ref, passTarget, HZ, COURT, RULES, MODES, modeKey, MOVES, MOVE_KEYS, PACE, T, gticks, rticks, meterSpec, meterQuality, derive } from '../../src/lib/btlive/index.js'
import { BtLiveRoom } from '../../live/src/btlive.js'

const args = process.argv.slice(2)
const RUNS = Number(args.find(a => a.startsWith('--runs='))?.slice(7)) || 300
let fails = 0
const ok = (cond, what) => { console.log(`${cond ? 'ok  ' : 'FAIL'}  ${what}`); if (!cond) fails++ }
const head = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(4, 96 - t.length))}`)
const gradeFor = ovr => 1 + (ovr - 57) / 44 * 9
const man = (id, ovr = 80, pos = 'guard') => ({ id, name: id, pos, build: flatBuild(pos, gradeFor(ovr)) })
const IDLE = () => ({ mx: 0, my: 0 })
const idle = s => s.players.map(IDLE)
const toLive = s => { let n = 0; while (s.phase !== 'live' && n++ < 300) step(s, idle(s)); return s }
const koth = (seed = 'k', ovrs = [80, 80, 80]) => createGame({ teams: ovrs.map((o, i) => [man(`k${i}`, o)]), seed, mode: 'koth' })
const put = (p, x, y) => { p.x = x; p.y = y; p.vx = p.vy = 0 }

// ── the score ──────────────────────────────────────────────────────────────────────────────────────
head('The score: first to 11, win by 2 over the next man, capped at 15')
for (const [sc, over, winner] of [[[11, 9, 0], true, 0], [[11, 10, 3], false, null], [[9, 11, 10], false, null], [[12, 10, 11], false, null], [[13, 11, 10], true, 0],
  [[14, 13, 15], true, 2], [[15, 14, 14], true, 0], [[11, 9], true, 0], [[11, 10], false, null], [[14, 15], true, 1], [[10, 10, 9], false, null]]) {
  const st = ref.scoreState(sc)
  ok(st.over === over && st.winner === winner, `${sc.join('-')}: ${over ? `over, ${winner} wins` : 'not over'}`)
}
ok(ref.scoreState([9, 5, 7]).gamePoint && !ref.scoreState([8, 5, 7]).gamePoint, 'game point at 9 (a two makes 11 by 2+), not at 8')
ok(ref.scoreState([10, 10, 3]).gamePoint, '10-10-3 is game point (a two makes 12-10)')

// ── King of the Hill, scripted ─────────────────────────────────────────────────────────────────────
head('King of the Hill: the rules, one at a time')
{
  const s = toLive(koth('mitt'))
  const k = s.king, P = s.players
  ok(s.mode === 'koth' && s.score.length === 3 && P.every(p => p.team === p.i), 'three sides of one: players[i].team === i, a score each')
  ok(k === s.poss && s.ball.holder === k && P.every(p => p.i === k || p.man === k), 'the king has it at the check and both others guard him')
  ok(passTarget(s, k, 1, 0) === -1, 'no one to pass to')
  // a made basket: the scorer checks it again
  put(P[k], 28, 8)
  Object.assign(s.ball, { st: 'shot', from: k, sx: 28, sy: 8, sz: 8, t: 0, n: 3, kind: 'layup', verdict: { made: true, pts: 1, three: false, kind: 'layup', d: 3.5, c: 0, p: 1, q: 1, by: null } })
  let made = null
  for (let n = 0; n < 10 && !made; n++) { step(s, idle(s)); made = s.events.find(e => e.e === 'make') }
  ok(made && s.score[k] === 1 && s.next?.carrier === k, 'make it, take it: a make and the scorer has it next')
  toLive(s)
  ok(s.king === k && s.ball.holder === k && s.mustClear === null, '...he checks it at the top and he is still the king, nothing to clear')
}
{
  // a defensive board: a live ball, he has to clear it
  const s = toLive(koth('clear')), P = s.players, k = s.king
  const [a, b] = P.filter(p => p.i !== k).map(p => p.i)
  put(P[k], 45, 30); put(P[a], 28, 12); put(P[b], 12, 30)
  Object.assign(s.ball, { st: 'loose', x: 28, y: 12.3, z: 2, vx: 0, vy: 0, vz: 0, reb: true, grabAt: 0, t: 0, lastTeam: k })
  step(s, idle(s))
  ok(s.phase === 'live' && s.ball.holder === a && s.poss === a && s.king === a && s.mustClear === a, 'a defensive board: still live, his ball, he must clear (mustClear = him)')
  ok(P.every(p => p.i === a || p.man === a), '...and the other two guard him at once')
  for (let n = 0; n < 12; n++) step(s, idle(s))
  const press = s.players.map(IDLE); press[a] = { mx: 0, my: 0, shoot: true }
  step(s, press)
  ok(P[a].act === 'free' && !s.events.some(e => e.e === 'gather'), 'inside the arc with it before clearing: SHOOT does nothing')
  step(s, idle(s))
  put(P[a], 28, 33)
  step(s, idle(s))
  ok(s.events.some(e => e.e === 'cleared' && e.pid === a) && s.mustClear === null, 'past the arc with it: cleared, he is the king')
  put(P[a], 28, 14)
  step(s, idle(s)); step(s, press)
  ok(P[a].act === 'gather', '...and now he can shoot, from anywhere')
}
{
  // out of bounds: the king steps out with it
  const s = toLive(koth('oob1')), P = s.players, k = s.king
  const [a, b] = P.filter(p => p.i !== k).map(p => p.i)
  put(P[k], COURT.minX - 1, 20); put(P[a], 20, 20); put(P[b], 10, 22)
  step(s, idle(s))
  ok(s.events.some(e => e.e === 'oob') && s.next?.carrier === b, 'the king steps out: it goes to the closer of the other two')
  toLive(s)
  ok(s.king === b && s.ball.holder === b && s.mustClear === null, '...who checks it at the top as the king (no clear on a dead ball)')
}
{
  // out of bounds off a loose ball: not the man who touched it last, the closer of the other two
  const s = toLive(koth('oob2')), P = s.players, k = s.king
  const [a, b] = P.filter(p => p.i !== k).map(p => p.i)
  put(P[k], 40, 20); put(P[a], 8, 20); put(P[b], 20, 20)
  Object.assign(s.ball, { st: 'loose', x: COURT.minX - 1, y: 20, z: 0, vx: -2, vy: 0, vz: 0, reb: false, grabAt: s.tick + 99, t: 0, lastTeam: a })
  step(s, idle(s))
  ok(s.next?.carrier === b, 'a loose ball out off A, with A nearest: it goes to the closer of the other two, not A')
}
{
  // the shot clock: the closer of the other two to the ball
  const s = toLive(koth('clock')), P = s.players, k = s.king
  const [a, b] = P.filter(p => p.i !== k).map(p => p.i)
  put(P[k], 28, 25); put(P[a], 28, 30); put(P[b], 10, 10)
  s.clock = 1
  step(s, idle(s))
  ok(s.events.some(e => e.e === 'clock') && s.next?.carrier === a, 'the shot clock runs out: the closer of the other two checks it')
}

// ── King of the Hill, played: invariants and win rates ─────────────────────────────────────────────
function playKoth(ovrs, seed, lvl = 'pro', poss = null) {
  const s = koth(seed, ovrs)
  if (poss != null) { /* (who starts is the seed's call) */ }
  const bad = []
  let mustAt = -1, nan = 0
  const inp = []
  while (s.phase !== 'over' && s.tick < 40 * 60 * HZ) {
    for (let i = 0; i < 3; i++) inp[i] = cpuInput(s, i, lvl)
    const before = { mc: s.mustClear, king: s.king, phase: s.phase }
    step(s, inp)
    for (const e of s.events) {
      if (e.e === 'gather' && before.mc === e.pid) bad.push(`t${s.tick} gather while clearing`)
      if (e.e === 'pass') bad.push(`t${s.tick} a pass`)
      if (e.e === 'make' && s.phase !== 'over' && s.next?.carrier !== e.pid) bad.push(`t${s.tick} make, not take`)
      // (secured behind the arc, he's cleared in the same tick)
      if ((e.e === 'steal' || (e.e === 'board' && !e.off)) && s.phase === 'live' && s.mustClear !== e.pid && !s.events.some(c => c.e === 'cleared' && c.pid === e.pid)) bad.push(`t${s.tick} ${e.e} without a clear`)
    }
    if (s.mustClear != null) { if (mustAt < 0) mustAt = s.tick } else mustAt = -1
    for (const p of s.players) if (!Number.isFinite(p.x + p.y + p.vx + p.vy)) nan++
  }
  return { s, bad, nan, stuck: s.phase !== 'over' }
}
head(`King of the Hill: ${RUNS} games of three equal CPUs (80 guards, pro)`)
{
  const wins = [0, 0, 0], first = [0, 0]
  let secs = 0, stuck = 0, nan = 0, bad = [], top = 0, cap = 0, pts = 0, clears = 0, stops = 0
  for (let g = 0; g < RUNS; g++) {
    const r = playKoth([80, 80, 80], `eq-${g}`)
    if (r.stuck) { stuck++; continue }
    wins[r.s.winner]++; secs += r.s.tick / HZ; nan += r.nan; bad = bad.concat(r.bad)
    top += Math.max(...r.s.score); if (Math.max(...r.s.score) >= RULES.cap) cap++
    pts += r.s.score.reduce((a, b) => a + b, 0)
  }
  const n = RUNS - stuck
  console.log(`wins by seat ${wins.map(w => (100 * w / n).toFixed(0) + '%').join(' / ')}   length ${(secs / n / 60).toFixed(1)} min   points a game ${(pts / n).toFixed(1)}   to the cap ${(100 * cap / n).toFixed(0)}%`)
  ok(!stuck && !nan, `no stuck game, no NaN (${stuck} stuck, ${nan} NaN)`)
  ok(!bad.length, `the rules held in every game (no shot before a clear, no pass, make it take it, every stop a clear)${bad.length ? ': ' + bad.slice(0, 5).join('; ') : ''}`)
  ok(wins.every(w => Math.abs(w / n - 1 / 3) < 0.08), 'each man wins about a third')
  void first; void clears; void stops
}
head(`King of the Hill: one better man (90 against two 80s), ${RUNS} games, the better man in every seat in turn`)
{
  let w = 0, n = 0
  for (let g = 0; g < RUNS; g++) {
    const seat = g % 3, ovrs = [80, 80, 80]; ovrs[seat] = 90
    const r = playKoth(ovrs, `gap-${g}`)
    if (r.stuck) continue
    n++; if (r.s.winner === seat) w++
  }
  console.log(`the 90 wins ${(100 * w / n).toFixed(0)}% (a third would be even)`)
  ok(w / n > 0.45 && w / n < 0.9, 'the better man wins more, not every time')
}
head('King of the Hill: same seed, same inputs, same game')
{
  const a = playKoth([80, 85, 78], 'det').s, b = playKoth([80, 85, 78], 'det').s
  ok(JSON.stringify(a.score) === JSON.stringify(b.score) && a.tick === b.tick && a.rn === b.rn, `two runs: ${a.score.join('-')} in ${a.tick} ticks both times`)
}

// ── 2v2 ───────────────────────────────────────────────────────────────────────────────────────────
head('2v2: the call for the ball, the pass to the teammate')
{
  const s = toLive(createGame({ teams: [[man('a0'), man('a1', 80, 'big')], [man('b0'), man('b1', 80, 'big')]], seed: 'call' }))
  ok(s.mode === '2v2', "a 2v2 game: state.mode is '2v2'")
  const h = s.ball.holder, mate = s.players.find(p => p.team === s.poss && p.i !== h)
  ok(passTarget(s, h, mate.x - s.players[h].x, mate.y - s.players[h].y) === mate.i && passTarget(s, h, -(mate.x - s.players[h].x), 0) === mate.i, 'the pass goes to his teammate (the only one), wherever the stick is')
  // the teammate calls: a person's call is a signal (the event and s.call); a CPU holder answers it when the lane is open
  let calls = 0, answered = 0, open = 0, openAns = 0
  for (let g = 0; g < 400; g++) {
    const t = toLive(createGame({ teams: [[man('a0'), man('a1', 80, 'big')], [man('b0'), man('b1', 80, 'big')]], seed: `call-${g}` }))
    for (let n = 0; n < 20; n++) step(t, t.players.map((_, i) => cpuInput(t, i, 'pro')))
    if (t.phase !== 'live' || t.ball.st !== 'held') continue
    const hh = t.ball.holder, cm = t.players.find(p => p.team === t.poss && p.i !== hh)
    const inp = t.players.map((_, i) => cpuInput(t, i, 'pro')); inp[cm.i] = { mx: 0, my: 0, pass: true }
    step(t, inp)
    if (!t.events.some(e => e.e === 'call' && e.pid === cm.i) || !t.call) continue
    calls++
    if (t.players[hh].act === 'gather') continue                     // (already going up with it: no pass from the air)
    // open: nobody within 5 ft of him, nobody in the lane
    const H = t.players[hh], dx = cm.x - H.x, dy = cm.y - H.y, L2 = dx * dx + dy * dy
    const isOpen = t.players.every(o => o.team === t.poss || (Math.hypot(o.x - cm.x, o.y - cm.y) > 5 && (() => { const q = Math.min(1, Math.max(0, ((o.x - H.x) * dx + (o.y - H.y) * dy) / L2)); return q < 0.12 || Math.hypot(H.x + dx * q - o.x, H.y + dy * q - o.y) >= 3.4 })()))
    if (isOpen) open++
    for (let n = 0; n < 24; n++) {
      const ii = t.players.map((_, i) => (i === cm.i ? IDLE() : cpuInput(t, i, 'pro')))
      step(t, ii)
      if (t.events.some(e => e.e === 'pass' && e.to === cm.i)) { answered++; if (isOpen) openAns++; break }
      if (t.phase !== 'live' || t.ball.st !== 'held') break
    }
  }
  console.log(`a CPU with the ball answers a call: ${answered} of ${calls}; when the caller is open (nobody within 5 ft, a clear lane): ${openAns} of ${open}`)
  ok(calls > 300, 'a call is an event and s.call ({ pid, tick }) for the teammate\'s screen')
  ok(open >= 10 && openAns / open > 0.8, 'a CPU teammate (practice) passes to an open man who calls for it')
}


// ── the dribble moves ─────────────────────────────────────────────────────────────────────────────
head('Dribble moves: NBA 2K\'s pro stick, read from the basket (forward) and the hand the ball is in')
{
  // a 1v1, the ball at the top of the key (the rim straight up the floor), his man well off him
  const fresh = (x = 28, y = 30) => { const s = toLive(createGame({ teams: [[man('a0', 86)], [man('b0', 86)]], seed: 'mv' })); const h = s.ball.holder; put(s.players[h], x, y); put(s.players[1 - h], 28, 12); s.players[h].moveCd = 0; step(s, idle(s)); return s }
  const flick = (s, dx, dy) => { const inp = idle(s); inp[s.ball.holder] = { mx: 0, my: 0, dx, dy }; step(s, inp); return s.events.find(e => e.e === 'move') }
  // (the ball in his right hand: left is toward the off hand)
  for (const [dx, dy, kind, hand, word] of [[0, -1, 'hesi', 1, 'toward the basket: a hesitation'], [-1, 0, 'btl', -1, 'left (the off hand): between the legs, to the left hand'], [1, 0, 'inout', 1, 'right (the ball hand): the in-and-out, same hand'], [0, 1, 'back', 1, 'straight back: a step-back'],
    [-0.72, 0.7, 'btb', -1, 'back and left: behind the back, to the left hand'], [0.72, 0.7, 'back', 1, 'back and right (the ball hand): the side step-back'], [-0.77, -0.64, 'cross', -1, 'forward and left (50 degrees off the basket): a crossover'], [-0.5, -0.87, 'cross', -1, 'forward, a little left (30 degrees): a crossover'],
    [0.77, -0.64, 'inout', 1, 'forward and right: the in-and-out'], [-0.15, -0.99, 'hesi', 1, 'at the basket, a touch left: the hesitation']]) {
    const s = fresh(), h = s.ball.holder, e = flick(s, dx, dy), p = s.players[h]
    ok(e?.kind === kind && MOVE_KEYS[p.mv] === kind && p.burst === gticks(MOVES[kind].time) && p.hand === hand && p.moveCd > p.burst, `${word} (${kind}), its burst on, the ball in his ${hand > 0 ? 'right' : 'left'} hand`)
  }
  {
    // the ball in his left hand: the same flicks mirror
    const s = fresh(), p = s.players[s.ball.holder]; p.hand = -1
    ok(flick(s, -1, 0)?.kind === 'inout' && p.hand === -1, 'the ball in his left hand: left is the in-and-out')
    const t = fresh(), q = t.players[t.ball.holder]; q.hand = -1
    ok(flick(t, 1, 0)?.kind === 'btl' && q.hand === 1, '...and right is between the legs, to the right hand')
  }
  {
    // in the corner the basket is across the floor: the same flicks are different moves
    const s = fresh(50, 5), e = flick(s, -1, 0); ok(e?.kind === 'hesi', 'from the right corner a flick left (at the basket) is the hesitation')
    const t = fresh(50, 5); ok(flick(t, 1, 0)?.kind === 'back' && flick(fresh(50, 5), 0, 1)?.kind === 'btl', '...right (away from it) the step-back, down the floor (his left) between the legs')
  }
  {
    const s = fresh(), h = s.ball.holder, p = s.players[h]
    ok(!flick(s, 0.3, 0) && p.burst === 0, 'a small push of the stick (under half way) is no move')
    flick(s, -0.77, -0.64); const x0 = p.x
    for (let n = 0; n < 20 && p.burst > 0; n++) step(s, idle(s))
    ok(p.mv === 0 && x0 - p.x > 2.2 && p.hand === -1, `a crossover takes him ${(x0 - p.x).toFixed(1)} ft that way, the ball to his left hand`)
    // the chain: a flick made while a move is on goes as soon as that one is done
    const c = fresh(), cp = c.players[c.ball.holder], kinds = []
    const chain = [[-0.77, -0.64], [0, -1], [0, 1]]
    let next = 0, t0 = c.tick
    for (let n = 0; n < 60; n++) {
      const inp = idle(c)
      if (next < chain.length && (n === 0 || (cp.burst > 0 && cp.bn - cp.burst === 4))) { inp[c.ball.holder] = { mx: 0, my: 0, dx: chain[next][0], dy: chain[next][1] }; next++ }
      step(c, inp)
      for (const e of c.events) if (e.e === 'move') kinds.push(e.kind)
    }
    ok(kinds.join(' ') === 'cross hesi back' && c.tick - t0 <= 60, `a chain: crossover into hesitation into step-back, each flicked while the one before was on (${kinds.join(', ')})`)
    const d = fresh(), dh = d.ball.holder; d.ball.st = 'loose'; d.ball.z = 0; d.ball.x = 5; d.ball.y = 38; d.ball.grabAt = d.tick + 99
    const inp = idle(d); inp[dh] = { mx: 0, my: 0, dx: 1, dy: 0 }; step(d, inp)
    ok(!d.events.some(e => e.e === 'move'), 'without the ball a flick is nothing')
  }
  {
    // the spin: a second flick, round from the first, while the first is still on
    const s = fresh(), h = s.ball.holder, p = s.players[h]
    flick(s, 1, 0); step(s, idle(s)); step(s, idle(s))
    const e = flick(s, -0.5, -0.87)
    ok(e?.kind === 'spin' && MOVE_KEYS[p.mv] === 'spin', 'a second flick a third of a turn round, early in the move: a spin')
    ok(!flick(s, 0, 1) && MOVE_KEYS[p.mv] === 'spin', '...and a third waits for the spin to end')
    let x1 = p.x, turned = false
    for (let n = 0; n < 20; n++) { const vy = p.vy; step(s, idle(s)); if (p.burst > 0 && vy < -6) turned = true }
    ok(turned && p.mv === 0, 'the burst bends round: by its end he is going the new way')
    const t = fresh(), q = t.players[t.ball.holder]
    flick(t, 1, 0); step(t, idle(t))
    ok(!flick(t, 0.9, -0.44) && MOVE_KEYS[q.mv] === 'inout', 'a second flick only a little round (26 degrees) leaves the in-and-out as it is')
    void x1
  }
  {
    // the step-back: backwards with his man still in front of him, and he lands set
    const s = fresh(), h = s.ball.holder, p = s.players[h], y0 = p.y
    flick(s, 0, 1); step(s, idle(s))
    const facing = p.fy < -0.9
    let v = 0
    for (let n = 0; n < 12 && p.burst > 0; n++) { v = Math.hypot(p.vx, p.vy); step(s, idle(s)) }
    ok(facing && p.y - y0 > 2 && Math.hypot(p.vx, p.vy) < v * 0.5, `the step-back: ${(p.y - y0).toFixed(1)} ft back, facing the basket all the way, his feet set as it ends (${v.toFixed(1)} to ${Math.hypot(p.vx, p.vy).toFixed(1)} ft/s)`)
  }
  {
    // a move against his man: sometimes frozen, the roll seeded (the same every time)
    let fz = 0, n = 0, same = true
    for (let g = 0; g < 300; g++) {
      const mk = () => { const s = toLive(createGame({ teams: [[man('a0', 90)], [man('b0', 80)]], seed: `fz-${g}` })); const h = s.ball.holder; put(s.players[h], 28, 30); put(s.players[1 - h], 28, 26); s.players[h].moveCd = 0; return s }
      const a = mk(), b = mk(), ea = flick(a, -1, 0), eb = flick(b, -1, 0)
      n++; if (ea.freeze) fz++; if (ea.freeze !== eb.freeze || a.rn !== b.rn) same = false
    }
    ok(same && fz > 15 && fz < 200, `a move at a man on him freezes him now and then (${fz} of ${n}), by the game's seeded roll`)
  }
  {
    // CPUs use every move, by the same flicks
    const by = {}; let games = 0
    for (let g = 0; g < Math.max(60, RUNS / 3); g++) {
      const s = createGame({ teams: [[man('a0', 84)], [man('b0', 84)]], seed: `cm-${g}` })
      while (s.phase !== 'over' && s.tick < 40 * 60 * HZ) { step(s, s.players.map((_, i) => cpuInput(s, i, 'allstar'))); for (const e of s.events) if (e.e === 'move') by[e.kind] = (by[e.kind] || 0) + 1 }
      games++
    }
    console.log(`CPU moves in ${games} games (all-star): ${Object.entries(by).map(([k, v]) => `${k} ${(v / games).toFixed(1)}/g`).join('  ')}`)
    ok(['cross', 'hesi', 'back', 'btb', 'spin', 'inout', 'btl'].every(k => by[k] > 0), 'the CPUs make every move: crossover, hesitation, step-back, behind the back, spin, in-and-out, between the legs')
  }
  {
    // same seed, same inputs (flicks among them): the same game
    const run = () => { const s = createGame({ teams: [[man('a0', 84)], [man('b0', 84)]], seed: 'det-mv' }); for (let n = 0; n < 2400 && s.phase !== 'over'; n++) { const inp = s.players.map((_, i) => cpuInput(s, i, 'pro')); if (n % 37 === 5) { inp[0].dx = n % 2 ? 1 : -0.6; inp[0].dy = n % 3 ? -0.5 : 0.8 } step(s, inp) } return JSON.stringify([s.score, s.tick, s.rn, s.players.map(p => [p.x, p.y, p.mv, p.burst])]) }
    ok(run() === run(), 'same seed, same inputs with flicks in them: the same game to the last number')
  }
}
head(`The pace: the game ${PACE}x quicker, the things a person does in real time`)
{
  const R = derive(flatBuild('guard', gradeFor(80)), 'guard')
  ok(PACE === 1.2 && HZ === 36, `PACE ${PACE}: the game's own step is what it was (30 to one of its seconds), ${HZ} of them go by in a real second`)
  // a man at a full run, a real second of it
  const s = toLive(createGame({ teams: [[man('a0')], [man('b0')]], seed: 'pace' })), h = s.ball.holder, p = s.players[h]
  put(p, 8, 36); put(s.players[1 - h], 45, 8)
  for (let n = 0; n < 15; n++) { const inp = idle(s); inp[h] = { mx: 1, my: 0 }; step(s, inp) }
  const x0 = p.x
  for (let n = 0; n < HZ; n++) { const inp = idle(s); inp[h] = { mx: 1, my: 0 }; step(s, inp) }
  ok(Math.abs((p.x - x0) / (R.topBall * PACE) - 1) < 0.02, `with the ball at a full run: ${(p.x - x0).toFixed(1)} ft in a real second (${R.topBall.toFixed(1)} x ${PACE})`)
  ok(gticks(RULES.checkTime) === Math.round(RULES.checkTime * HZ / PACE) && gticks(T.jumpTime) < rticks(T.jumpTime), `game times are ${PACE}x shorter on a watch (the check ${gticks(RULES.checkTime)} ticks = ${(gticks(RULES.checkTime) / HZ).toFixed(2)} s, a jump ${gticks(T.jumpTime)} ticks = ${(gticks(T.jumpTime) / HZ).toFixed(2)} s)`)
  const t = toLive(createGame({ teams: [[man('a0')], [man('b0')]], seed: 'pace2' }))
  ok(t.clock === RULES.shotClock[0] * HZ, `the shot clock is real seconds: ${RULES.shotClock[0]} s is ${t.clock} ticks`)
  const j = meterSpec('jumper', R), l = meterSpec('layup', R)
  ok(j.total === 900 && j.ideal === 500 && l.total === 620 && l.ideal === 300, `the shot meter is real milliseconds, as it was: jumper ${j.ideal} of ${j.total}, layup ${l.ideal} of ${l.total}, green +/- ${j.win.toFixed(0)} and ${l.win.toFixed(0)} at an 80`)
  // the meter in the step: a CPU release held 500 real ms is a release at tick 15
  const u = toLive(createGame({ teams: [[man('a0')], [man('b0')]], seed: 'pace3' })), uh = u.ball.holder
  put(u.players[uh], 28, 26); put(u.players[1 - uh], 45, 8)
  // the step's own meter (a CPU's hold, a release that comes without a quality) reads the hold in real milliseconds
  const up = u.players[uh], hold = rticks(0.5)
  let rel = -1, heldT = 0
  for (let n = 0; n < 60 && rel < 0; n++) { const inp = idle(u); inp[uh] = { mx: 0, my: 0, shoot: n < hold }; if (up.act === 'gather') heldT = up.actT; step(u, inp); if (u.events.some(e => e.e === 'release')) rel = n }
  const q = u.events.find(e => e.e === 'release')?.q, ms = (heldT + 1) * 1000 / HZ
  ok(rel >= 0 && Math.abs(ms - 500) <= 1000 / HZ && q === meterQuality(meterSpec('jumper', up.R), ms) && q === 1, `SHOOT held ${hold} ticks is a release at ${ms.toFixed(0)} ms on a watch: in the green (q ${q})`)
}

// ── the room ──────────────────────────────────────────────────────────────────────────────────────
const fakeWs = () => { const w = { got: [], send(d) { w.got.push(JSON.parse(d)) }, close() {} }; return w }
const last = (w, t) => [...w.got].reverse().find(m => m.t === t)
function room(mode, people, more = {}) {
  const r = new BtLiveRoom(null, {})
  const ws = people.map(() => fakeWs())
  people.forEach((p, i) => r.onMessage(ws[i], JSON.stringify({ t: 'hello', vid: `v${i}`, name: `P${i}`, pos: p, build: {}, look: {}, mode, ...more,
    cpus: [{ name: 'CG1', pos: 'guard' }, { name: 'CB1', pos: 'big' }, { name: 'CG2', pos: 'guard' }, { name: 'CB2', pos: 'big' }] })))
  r.stop()
  return { r, ws }
}
head('The room: seats for 1v1, 2v2 and King of the Hill')
for (const [mode, n] of [['1v1', 2], ['2v2', 4], ['koth', 3]]) {
  const people = ['guard', 'guard', 'big', 'big'].slice(0, n)
  const { r, ws } = room(mode, people)
  const seats = ws.map(w => last(w, 'seat'))
  ok(r.g && r.g.mode === mode && r.seats.length === MODES[mode].seats && r.g.players.length === n, `${mode}: it starts when all ${n} are in, ${n} men, state.mode '${mode}'`)
  ok(seats.every((m, i) => m && r.seats[m.i].vid === `v${i}` && m.mode === mode), `${mode}: every person has his own seat, and his device is told which`)
  ok(r.seats.every(x => x.vid), `${mode}: no CPU in a full room`)
  if (mode === '2v2') ok([0, 1].every(t => r.seats.filter(x => x.team === t).length === 2), '2v2: two people a side')
  if (mode === 'koth') ok(r.g.players.every(p => p.team === p.i) && r.g.score.length === 3, 'King of the Hill: three sides of one')
}
{
  const { r } = room(undefined, ['guard', 'guard'], { size: 3 })
  ok(r.mode === '1v1' && r.seats.length === 2, 'an old device asking for size 3 (3v3) gets 1v1')
  ok(modeKey(3) === '1v1' && modeKey('3') === '1v1' && modeKey(2) === '2v2' && modeKey('koth') === 'koth' && modeKey('3v3') === '1v1', 'old sizes: 1 and 3 open 1v1, 2 opens 2v2')
}
head('The room: a flick of the small stick reaches the game once, with the way it pointed')
{
  const { r, ws } = room('1v1', ['guard', 'guard'])
  const g = r.g
  while (g.phase !== 'live') r.tickOnce(Date.now())
  const now = Date.now(), mine = ws.map(w => last(w, 'seat').i), hj = mine.indexOf(g.ball.holder), h = g.ball.holder
  const msg = (j, k, n, d) => r.onMessage(ws[j], JSON.stringify({ t: 'in', k, mx: 0, my: 0, x: g.players[mine[j]].x, y: g.players[mine[j]].y, vx: 0, vy: 0, h: 0, n, d }))
  g.players[h].moveCd = 0
  msg(hj, 1, [0, 0, 1], [[-1, 0]])
  let inp = r.tickOnce(now)
  ok(inp[h].dx === -1 && inp[h].dy === 0 && g.events.some(e => e.e === 'move' && e.pid === h), 'one flick in a message: the man moves on the next tick, that way')
  msg(hj, 2, [0, 0, 1], [[-1, 0]])
  inp = r.tickOnce(now)
  ok(!inp[h].dx && !inp[h].dy, 'the same flick sent again (the next message carries it too) is not a second one')
  msg(hj, 3, [0, 0, 3], [[-1, 0], [1, 0], [0.5, -0.87]])
  const a = r.tickOnce(now)[h], b = r.tickOnce(now)[h], c = r.tickOnce(now)[h]
  ok(a.dx === 1 && Math.abs(b.dx - 0.5) < 0.01 && Math.abs(b.dy + 0.87) < 0.01 && !c.dx, 'two flicks in one message (a move and the roll round after it): one a tick, in order, each once')
  msg(hj, 4, [0, 0, 4], [[9, 'x']])
  ok(Math.abs(r.tickOnce(now)[h].dx - 1) < 1e-9, 'a flick is cleaned up as it comes in (held to the stick\'s range, a unit direction)')
  // the right stick without the ball: down a swipe at it, up a jump; each flick is one, once
  const dj = 1 - hj, d = mine[dj]
  msg(dj, 1, [0, 0, 0, 1, 0], [])
  let di = r.tickOnce(now)[d]
  ok(di.steal && !di.jump && !di.shoot && !r.tickOnce(now)[d].steal, 'a defender\'s right stick down: one swipe at the ball (SHOOT and PASS untouched)')
  msg(dj, 2, [0, 0, 0, 1, 1], [])
  di = r.tickOnce(now)[d]
  ok(di.jump && !di.steal && !r.tickOnce(now)[d].jump, '...up: one jump')
  const snap = last(ws[0], 's')
  ok(snap.p[h].length === 23 && typeof snap.p[h][21] === 'string', 'a snapshot carries each man\'s move (which one, how long, where it is going, his ball hand) for the screens')
}
head('2v2 with four people: each one moves his own man, and only his')
{
  const { r, ws } = room('2v2', ['guard', 'big', 'guard', 'big'])
  const g = r.g
  while (g.phase !== 'live') r.tickOnce(Date.now())
  const now = Date.now()
  const mine = ws.map(w => last(w, 'seat').i)
  // each one pushes his stick a different way and has his man at a different spot
  const sticks = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  ws.forEach((w, j) => r.onMessage(w, JSON.stringify({ t: 'in', k: 1, mx: sticks[j][0], my: sticks[j][1], x: g.players[mine[j]].x, y: g.players[mine[j]].y, vx: 0, vy: 0, h: 0, n: [0, 0, 0] })))
  const inp = r.tickOnce(now)
  ok(ws.every((_, j) => inp[mine[j]].mx === sticks[j][0] && inp[mine[j]].my === sticks[j][1] && inp[mine[j]].pos), 'every man gets his own person\'s stick and position, nobody else\'s')
  // the man with the ball passes: it goes to his teammate (a person); the teammate is never moved by anyone else
  const h = g.ball.holder, hj = mine.indexOf(h), mate = g.players.find(p => p.team === g.players[h].team && p.i !== h).i
  ok(passTarget(g, h, 0, 0) === mate, 'a pass from the man with the ball goes to his teammate')
  // one line goes quiet: only that seat is played by the CPU until it comes back
  const late = now + 1600
  ws.forEach((w, j) => { if (j !== 2) r.onMessage(w, JSON.stringify({ t: 'in', k: 2, mx: 0, my: 0, x: g.players[mine[j]].x, y: g.players[mine[j]].y, vx: 0, vy: 0, h: 0, n: [0, 0, 0] })) })
  ws.forEach((_, j) => { if (j !== 2) r.seats[mine[j]].seat.heard = late })
  const inp2 = r.tickOnce(late)
  ok(!inp2[mine[2]].pos && ws.every((_, j) => j === 2 || inp2[mine[j]].pos), 'a quiet line: his seat (only his) is the CPU\'s until he is back')
  void hj
}
head('Practice: a missing person is a CPU')
{
  const { r, ws } = room('2v2', ['guard'])
  ok(!r.g && last(ws[0], 'wait')?.need === 4, 'one person in a 2v2 room: it waits for 4')
  r.onMessage(ws[0], JSON.stringify({ t: 'start' })); r.stop()
  ok(r.g && r.seats.filter(x => !x.vid).length === 3 && r.seats.every(x => x.name), 'START: the three empty seats are CPUs')
  const mate = r.seats.find(x => x.team === r.seats.find(y => y.vid).team && !x.vid)
  ok(mate.pos === 'big', 'his CPU teammate plays the other position (a guard gets a big)')
  const k = room('koth', ['guard'])
  k.r.onMessage(k.ws[0], JSON.stringify({ t: 'start' })); k.r.stop()
  ok(k.r.g?.mode === 'koth' && k.r.seats.filter(x => !x.vid).length === 2, 'King of the Hill practice: the person and two CPUs')
}
head('Rematch: the same people in the same seats, the same CPUs, a new seed')
{
  const { r, ws } = room('2v2', ['guard', 'big'], { humans: 2 })
  const before = r.seats.map(x => `${x.vid}|${x.name}|${x.team}|${x.pos}|${JSON.stringify(x.build)}`)
  const seed0 = r.seed
  r.g.phase = 'over'
  r.onMessage(ws[0], JSON.stringify({ t: 'again' })); r.stop()
  ok(r.seed === seed0 && last(ws[1], 'again')?.have === 1, 'one asks: it waits for the other (he is told 1 of 2)')
  r.onMessage(ws[1], JSON.stringify({ t: 'again' })); r.stop()
  const after = r.seats.map(x => `${x.vid}|${x.name}|${x.team}|${x.pos}|${JSON.stringify(x.build)}`)
  ok(r.seed !== seed0 && r.g.phase !== 'over', 'both asked: a new game on a new seed')
  ok(JSON.stringify(before) === JSON.stringify(after), 'every seat as it was: the same people, the same CPUs with the same builds')
  ok(ws.every((w, j) => r.seats[last(w, 'seat').i].vid === `v${j}`), 'each device is told the same seat again')
}

console.log(`\n${fails ? `${fails} FAILED` : 'all ok'}`)
process.exit(fails ? 1 : 0)
