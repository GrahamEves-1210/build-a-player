// BLACKTOP LIVE: the games and the seats, checked headless. King of the Hill's rules (make it take it, the clear,
// out of bounds, the shot clock, 11 by 2 capped at 15, no passing), three-way win rates, 2v2 with four people each on
// his own man, the call for the ball, the room's seats for 1v1 / 2v2 / King of the Hill, and the rematch.
// Bundle and run from the repo root (it imports the live room too):
//   node_modules/.bin/esbuild scripts/btlive/modes-check.mjs --bundle --platform=node --format=esm --outfile=/tmp/mc.mjs \
//     --define:import.meta.env='{"DEV":false}' --loader:.json=json && node /tmp/mc.mjs [--runs=300]
import { createGame, step, cpuInput, flatBuild, referee as ref, passTarget, HZ, COURT, RULES, MODES, modeKey } from '../../src/lib/btlive/index.js'
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
