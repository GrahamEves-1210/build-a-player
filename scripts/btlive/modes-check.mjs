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
head('King of the Hill: the rules, one at a time (two play, one sits, they rotate)')
// the three of them right now: the king, the man on him, the man sitting out
const roles = s => ({ k: s.king, d: s.players.find(p => p.i !== s.king && !p.out)?.i, sit: s.sit })
{
  const s = toLive(koth('mitt'))
  const { k, d, sit } = roles(s), P = s.players
  ok(s.mode === 'koth' && s.score.length === 3 && P.every(p => p.team === p.i), 'three sides of one: players[i].team === i, a score each')
  ok(k === s.poss && s.ball.holder === k && sit >= 0 && sit !== k && d !== sit && P[sit].out && !P[k].out && !P[d].out, 'two on the floor, one sitting out (players[sit].out)')
  ok(P[d].man === k && P[sit].man === -1, 'the one on the floor guards the king; the one sitting guards nobody')
  ok(Math.hypot(P[sit].x - T.bench.x, P[sit].y - T.bench.y) < 1 && !ref.inBounds(P[sit].x, P[sit].y), '...and he waits off the sideline')
  ok(passTarget(s, k, 1, 0) === -1, 'no one to pass to')
  // a made basket: the scorer keeps it, the man he scored on sits, the one sitting comes in on him
  put(P[k], 28, 8)
  Object.assign(s.ball, { st: 'shot', from: k, sx: 28, sy: 8, sz: 8, t: 0, n: 3, kind: 'layup', verdict: { made: true, pts: 1, three: false, kind: 'layup', d: 3.5, c: 0, p: 1, q: 1, by: null } })
  let made = null, rot = null
  for (let n = 0; n < 10 && !made; n++) { step(s, idle(s)); made = s.events.find(e => e.e === 'make'); rot = s.events.find(e => e.e === 'rotate') }
  ok(made && s.score[k] === 1 && s.next?.carrier === k, 'make it, take it: a make and the scorer has it next')
  ok(rot && s.sit === d && !P[sit].out && P[d].out && P[sit].man === k, '...the man he scored on sits, the one sitting comes in to guard him')
  toLive(s)
  ok(s.king === k && s.ball.holder === k && s.mustClear === null && s.phase === 'live', '...checked at the top, he is still the king')
}
{
  // a defensive board: the defender takes the crown, the king sits, the one sitting comes in; checked at the top
  const s = toLive(koth('dreb')), P = s.players
  const { k, d, sit } = roles(s)
  put(P[k], 45, 30); put(P[d], 28, 12)
  Object.assign(s.ball, { st: 'loose', x: 28, y: 12.3, z: 2, vx: 0, vy: 0, vz: 0, reb: true, grabAt: 0, t: 0, lastTeam: k })
  step(s, idle(s))
  ok(s.phase === 'dead' && s.next?.carrier === d && s.king === d && s.sit === k && P[k].out && !P[sit].out && P[sit].man === d, 'a defensive board: his crown, the old king sits, the one sitting comes in on him')
  ok(s.mustClear === null, '...a dead ball, nothing to take back (he checks it)')
  toLive(s)
  ok(s.ball.holder === d && s.poss === d && s.phase === 'live' && Math.hypot(P[d].x - COURT.check.x, P[d].y - COURT.check.y) < 1.5, '...at the top with the ball')
  ok(Math.hypot(P[k].x - T.bench.x, P[k].y - T.bench.y) < 2, '...and the old king has walked off to wait')
}
{
  // an offensive board: play on, nobody moves
  const s = toLive(koth('oreb')), P = s.players
  const { k, d, sit } = roles(s)
  put(P[k], 28, 12); put(P[d], 45, 30)
  Object.assign(s.ball, { st: 'loose', x: 28, y: 12.3, z: 2, vx: 0, vy: 0, vz: 0, reb: true, grabAt: 0, t: 0, lastTeam: k })
  step(s, idle(s))
  ok(s.phase === 'live' && s.ball.holder === k && s.king === k && s.sit === sit, 'an offensive board: still live, still his, nobody rotates')
}
{
  // a steal: his crown
  const s = toLive(koth('stl')), P = s.players
  const { k, d, sit } = roles(s)
  let got = false
  for (let n = 0; n < 400 && !got; n++) { const q = idle(s); q[d] = { mx: 0, my: 0, steal: n % 2 === 0 }; P[d].stealCd = 0; P[d].act = 'free'; put(P[k], 28, 20); P[k].fx = 0; P[k].fy = -1; put(P[d], 28, 18.6); step(s, q); got = s.events.some(e => e.e === 'steal') }
  ok(got && s.king === d && s.sit === k && s.next?.carrier === d, 'a steal: the defender is king, the old king sits')
}
{
  // the man sitting out can't touch anything
  const s = toLive(koth('bench')), P = s.players
  const { k, sit } = roles(s)
  const x0 = P[sit].x, y0 = P[sit].y
  const q = idle(s); q[sit] = { mx: -1, my: 0, steal: true, shoot: true }
  for (let n = 0; n < 20; n++) step(s, q)
  ok(Math.hypot(P[sit].x - x0, P[sit].y - y0) < 0.01 && s.ball.holder === k, 'sitting out: his stick and buttons do nothing')
  put(P[k], 28, 10)
  const v = ref.contestOf(P[k], s.players.filter(o => o.team !== P[k].team && !o.out), 'layup')
  put(P[sit], 28, 8)
  ok(ref.contestOf(P[k], s.players.filter(o => o.team !== P[k].team && !o.out), 'layup').c === v.c, '...and he is in nobody\'s way')
}
{
  // out of bounds: the king steps out -> the defender's crown, the king sits
  const s = toLive(koth('oob1')), P = s.players
  const { k, d, sit } = roles(s)
  put(P[k], COURT.minX - 1, 20); put(P[d], 20, 20)
  step(s, idle(s))
  ok(s.events.some(e => e.e === 'oob') && s.next?.carrier === d && s.sit === k && !P[sit].out, 'the king steps out: the defender has it, the king sits, the one sitting comes in')
}
{
  // out of bounds off the defender: the king keeps it, nobody moves
  const s = toLive(koth('oob2')), P = s.players
  const { k, d, sit } = roles(s)
  put(P[k], 40, 20); put(P[d], 8, 20)
  Object.assign(s.ball, { st: 'loose', x: COURT.minX - 1, y: 20, z: 0, vx: -2, vy: 0, vz: 0, reb: false, grabAt: s.tick + 99, t: 0, lastTeam: d })
  step(s, idle(s))
  ok(s.next?.carrier === k && s.sit === sit, 'a loose ball out off the defender: the king keeps it, no rotation')
}
{
  // the shot clock: a stop
  const s = toLive(koth('clock')), P = s.players
  const { k, d } = roles(s)
  put(P[k], 28, 25); put(P[d], 28, 30)
  s.clock = 1
  step(s, idle(s))
  ok(s.events.some(e => e.e === 'clock') && s.next?.carrier === d && s.sit === k, 'the shot clock runs out: the defender\'s crown, the king sits')
}

// ── 1v1 and 2v2: no check after a stop, take it back ─────────────────────────────────────────────
head('1v1 and 2v2: a stop is a live ball; take it back past the arc before a basket counts')
const duo = (seed, size = 1) => createGame({ teams: [0, 1].map(t => [...Array(size).keys()].map(i => man(`d${t}${i}`, 80, i ? 'big' : 'guard'))), seed })
const holderOf = s => (s.ball.st === 'held' ? s.ball.holder : -1)
{
  // a defensive board
  const s = toLive(duo('dreb')), P = s.players, o = s.poss, d = 1 - o
  const D = P.find(p => p.team === d), O = P.find(p => p.team === o)
  put(O, 40, 25); put(D, 28, 12)
  Object.assign(s.ball, { st: 'loose', x: 28, y: 12.3, z: 2, vx: 0, vy: 0, vz: 0, reb: true, grabAt: 0, t: 0, lastTeam: o })
  step(s, idle(s))
  ok(s.phase === 'live' && holderOf(s) === D.i && s.poss === d && s.mustClear === d, '1v1, a defensive board: no check, still live, his ball, his side must take it back')
  ok(s.events.some(e => e.e === 'clear' && e.pid === D.i), '...the screen is told (a clear event)')
  // a make before he takes it back
  const sc = [...s.score]
  Object.assign(s.ball, { st: 'shot', from: D.i, sx: 28, sy: 12, sz: 8, t: 0, n: 3, kind: 'layup', verdict: { made: true, pts: 1, three: false, kind: 'layup', d: 7.5, c: 0, p: 1, q: 1, by: null, uncl: true } })
  let ev = null
  for (let n = 0; n < 10 && !ev; n++) { step(s, idle(s)); ev = s.events.find(e => e.e === 'waved' || e.e === 'make') }
  ok(ev?.e === 'waved' && s.score.join() === sc.join() && s.next?.team === o, '1v1, a make before taking it back: waved off, the other side checks it')
  toLive(s)
  ok(s.poss === o && s.mustClear === null, '...from the top, nothing to clear')
}
{
  // a real release before taking it back: the verdict carries it
  const s = toLive(duo('rel')), P = s.players, o = s.poss, d = 1 - o
  const D = P.find(p => p.team === d), O = P.find(p => p.team === o)
  put(O, 45, 30); put(D, 28, 12)
  Object.assign(s.ball, { st: 'loose', x: 28, y: 12.3, z: 2, vx: 0, vy: 0, vz: 0, reb: true, grabAt: 0, t: 0, lastTeam: o })
  step(s, idle(s))
  for (let n = 0; n < 12; n++) step(s, idle(s))
  const press = idle(s); press[D.i] = { mx: 0, my: 0, shoot: true }
  step(s, press)
  ok(D.act === 'gather', '1v1: inside the arc before taking it back, SHOOT still shoots')
  let rel = false
  for (let n = 0; n < 60 && !rel; n++) { const q = idle(s); q[D.i] = { mx: 0, my: 0, shoot: n < 20 }; step(s, q); rel = s.events.some(e => e.e === 'release' || e.e === 'block') }
  ok(rel && (s.ball.st !== 'shot' || s.ball.verdict?.uncl === true), '...and the shot in the air is marked as not taken back')
}
{
  // taking it back, then a make counts
  const s = toLive(duo('back')), P = s.players, o = s.poss, d = 1 - o
  const D = P.find(p => p.team === d), O = P.find(p => p.team === o)
  put(O, 40, 12); put(D, 28, 12)
  Object.assign(s.ball, { st: 'loose', x: 28, y: 12.3, z: 2, vx: 0, vy: 0, vz: 0, reb: true, grabAt: 0, t: 0, lastTeam: o })
  step(s, idle(s))
  put(D, 28, 33); step(s, idle(s))
  ok(s.mustClear === null && s.events.some(e => e.e === 'cleared' && e.pid === D.i), '1v1: behind the arc with it, both feet: taken back')
  const sc = s.score[d]
  put(D, 28, 9)
  Object.assign(s.ball, { st: 'shot', from: D.i, sx: 28, sy: 9, sz: 8, t: 0, n: 3, kind: 'layup', verdict: { made: true, pts: 1, three: false, kind: 'layup', d: 4.5, c: 0, p: 1, q: 1, by: null, uncl: false } })
  let ev = null
  for (let n = 0; n < 10 && !ev; n++) { step(s, idle(s)); ev = s.events.find(e => e.e === 'waved' || e.e === 'make') }
  ok(ev?.e === 'make' && s.score[d] === sc + 1 && s.next?.team === d, '...then a make counts, and he checks it again (make it, take it)')
}
{
  // a steal: live, take it back; an offensive board: nothing to take back
  const s = toLive(duo('stl')), P = s.players, o = s.poss, d = 1 - o
  const D = P.find(p => p.team === d), O = P.find(p => p.team === o)
  s.events.length = 0
  put(O, 28, 20); put(D, 28, 18.5); O.fx = 0; O.fy = -1
  let got = false
  for (let n = 0; n < 400 && !got; n++) { const q = idle(s); q[D.i] = { mx: 0, my: 0, steal: n % 2 === 0 }; D.stealCd = 0; D.act = 'free'; put(O, 28, 20); put(D, 28, 18.6); step(s, q); got = s.events.some(e => e.e === 'steal') }
  ok(got && s.phase === 'live' && holderOf(s) === D.i && s.mustClear === d, '1v1, a steal: no check, his ball, take it back')
}
{
  const s = toLive(duo('oreb')), P = s.players, o = s.poss
  const O = P.find(p => p.team === o), D = P.find(p => p.team !== o)
  put(O, 28, 12); put(D, 45, 30)
  Object.assign(s.ball, { st: 'loose', x: 28, y: 12.3, z: 2, vx: 0, vy: 0, vz: 0, reb: true, grabAt: 0, t: 0, lastTeam: o })
  step(s, idle(s))
  ok(holderOf(s) === O.i && s.poss === o && s.mustClear === null, 'an offensive board: his own miss, nothing to take back')
}
{
  // 2v2: a pass out to a teammate behind the arc takes it back
  const s = toLive(duo('pass', 2)), P = s.players, o = s.poss, d = 1 - o
  const [D1, D2] = P.filter(p => p.team === d), Os = P.filter(p => p.team === o)
  put(Os[0], 40, 30); put(Os[1], 14, 30); put(D1, 28, 12); put(D2, 44.5, 27)
  Object.assign(s.ball, { st: 'loose', x: 28, y: 12.3, z: 2, vx: 0, vy: 0, vz: 0, reb: true, grabAt: 0, t: 0, lastTeam: o })
  step(s, idle(s))
  ok(s.mustClear === d && holderOf(s) === D1.i, '2v2, a defensive board: his side must take it back')
  for (let n = 0; n < 12; n++) step(s, idle(s))
  const q = idle(s); q[D1.i] = { mx: (D2.x - D1.x), my: (D2.y - D1.y), pass: true }
  const l = Math.hypot(q[D1.i].mx, q[D1.i].my); q[D1.i].mx /= l; q[D1.i].my /= l
  step(s, q)
  let caught = false
  for (let n = 0; n < 60 && !caught; n++) { step(s, idle(s)); caught = s.events.some(e => e.e === 'catch' && e.pid === D2.i) }
  ok(caught && s.mustClear === null, '...a pass out to his teammate behind the arc does it')
}
// the CPU takes it back too: 1v1 and 2v2 games, every stop cleared before any shot, no basket waved off
function playDuo(size, seed) {
  const s = duo(seed, size), bad = [], inp = []
  let stops = 0, clears = 0, waved = 0
  while (s.phase !== 'over' && s.tick < 40 * 60 * HZ) {
    for (let i = 0; i < s.players.length; i++) inp[i] = cpuInput(s, i, 'pro')
    const mc = s.mustClear
    step(s, inp)
    for (const e of s.events) {
      if (e.e === 'gather' && mc != null && s.players[e.pid].team === mc) bad.push(`t${s.tick} gather before taking it back`)
      if (e.e === 'clear') stops++
      if (e.e === 'cleared') clears++
      if (e.e === 'waved') waved++
      if (e.e === 'poss' && (e.why === 'dreb' || e.why === 'steal' || e.why === 'pick') && s.phase !== 'live' && s.phase !== 'over') bad.push(`t${s.tick} a check after a ${e.why}`)
    }
  }
  return { s, bad, stops, clears, waved, stuck: s.phase !== 'over' }
}
for (const size of [1, 2]) {
  let bad = [], stops = 0, clears = 0, waved = 0, stuck = 0
  const n = Math.max(40, RUNS / 5)
  for (let g = 0; g < n; g++) { const r = playDuo(size, `duo${size}-${g}`); bad = bad.concat(r.bad); stops += r.stops; clears += r.clears; waved += r.waved; if (r.stuck) stuck++ }
  console.log(`${size}v${size}: ${n} CPU games, ${(stops / n).toFixed(1)} stops a game, ${(clears / n).toFixed(1)} taken back`)
  ok(!stuck && !bad.length && waved === 0, `${size}v${size}: the CPU never shoots before taking it back, no check after a stop, nothing waved off${bad.length ? ': ' + bad.slice(0, 4).join('; ') : ''}`)
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
    const before = { mc: s.mustClear, king: s.king, sit: s.sit, phase: s.phase }
    step(s, inp)
    for (const e of s.events) {
      if (e.e === 'gather' && before.mc === e.pid) bad.push(`t${s.tick} gather while clearing`)
      if (e.e === 'pass') bad.push(`t${s.tick} a pass`)
      if (e.e === 'make' && s.phase !== 'over' && s.next?.carrier !== e.pid) bad.push(`t${s.tick} make, not take`)
      // every make and every stop rotates: the loser of the play sits, the one sitting comes in
      if (e.e === 'make' && s.phase !== 'over' && !(s.sit !== before.sit && s.sit !== e.pid)) bad.push(`t${s.tick} a make without the rotation`)
      if ((e.e === 'steal' || (e.e === 'board' && !e.off)) && s.phase !== 'over' && !(s.phase === 'dead' && s.king === e.pid && s.sit === before.king)) bad.push(`t${s.tick} ${e.e} without the crown changing`)
      if ((e.e === 'gather' || e.e === 'steal' || e.e === 'board' || e.e === 'jump') && e.pid === before.sit) bad.push(`t${s.tick} the man sitting out played`)
      if (e.e === 'clear') bad.push(`t${s.tick} a take-it-back in King of the Hill`)
    }
    if (s.players.filter(p => p.out).length !== 1) bad.push(`t${s.tick} not one man sitting out`)
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
  ok(!bad.length, `the rules held in every game (no pass, make it take it, every make and stop rotates, the man sitting out never plays)${bad.length ? ': ' + bad.slice(0, 5).join('; ') : ''}`)
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
head('Dribble moves: read from the basket (forward), the hand the ball is in and how he\'s going; a spin only rolled')
{
  // a 1v1, the ball at the top of the key (the rim straight up the floor), his man well off him
  const fresh = (x = 28, y = 30) => { const s = toLive(createGame({ teams: [[man('a0', 86)], [man('b0', 86)]], seed: 'mv' })); const h = s.ball.holder; put(s.players[h], x, y); put(s.players[1 - h], 28, 12); s.players[h].moveCd = 0; step(s, idle(s)); return s }
  const flick = (s, dx, dy) => { const inp = idle(s); inp[s.ball.holder] = { mx: 0, my: 0, dx, dy }; step(s, inp); return s.events.find(e => e.e === 'move') }
  // (the ball in his right hand: left is toward the off hand)
  for (const [dx, dy, kind, hand, word, vy = 0] of [[0, -1, 'hesi', 1, 'toward the basket: a hesitation'], [-1, 0, 'cross', -1, 'left (the off hand), standing: the crossover, to the left hand'], [1, 0, 'inout', 1, 'right (the ball hand): the in-and-out, same hand'], [0, 1, 'back', 1, 'straight back: a step-back'],
    [-0.72, 0.7, 'cross', -1, 'back and left, standing: a crossover (no spin off a flick)'], [0.72, 0.7, 'inout', 1, 'back and right (the ball hand): the in-and-out, never a spin'], [-0.77, -0.64, 'cross', -1, 'forward and left (50 degrees off the basket): a crossover'],
    [-1, 0, 'btl', -1, 'left going forward at an easy pace: between the legs', -3.5], [-1, 0, 'btb', -1, 'left going forward at speed: behind the back', -8.5],
    [0.77, -0.64, 'inout', 1, 'forward and right: the in-and-out'], [-0.15, -0.99, 'hesi', 1, 'at the basket, a touch left: the hesitation'], [-0.5, -0.87, 'hesi', 1, 'forward, a little left (30 degrees): the hesitation']]) {
    const s = fresh(), h = s.ball.holder, p0 = s.players[h]; p0.vx = 0; p0.vy = vy
    const e = flick(s, dx, dy), p = s.players[h]
    ok(e?.kind === kind && MOVE_KEYS[p.mv] === kind && p.burst === gticks(MOVES[kind].time) && p.hand === hand && p.moveCd > p.burst, `${word} (${kind}), its burst on, the ball in his ${hand > 0 ? 'right' : 'left'} hand`)
  }
  {
    // the ball in his left hand: the same flicks mirror
    const s = fresh(), p = s.players[s.ball.holder]; p.hand = -1
    ok(flick(s, -1, 0)?.kind === 'inout' && p.hand === -1, 'the ball in his left hand: left is the in-and-out')
    const t = fresh(), q = t.players[t.ball.holder]; q.hand = -1
    ok(flick(t, 1, 0)?.kind === 'cross' && q.hand === 1, '...and right is the crossover, to the right hand')
  }
  {
    // in the corner the basket is across the floor: the same flicks are different moves
    const s = fresh(50, 5), e = flick(s, -1, 0); ok(e?.kind === 'hesi', 'from the right corner a flick left (at the basket) is the hesitation')
    const t = fresh(50, 5); ok(flick(t, 1, 0)?.kind === 'back' && flick(fresh(50, 5), 0, 1)?.kind === 'cross', '...right (away from it) the step-back, down the floor (his left, standing) the crossover')
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
    // the spin: only the stick rolled round (sp); a second plain flick round from the first is never one
    const n = fresh(), np = n.players[n.ball.holder]
    flick(n, 1, 0); step(n, idle(n)); step(n, idle(n))
    ok(!flick(n, -0.5, -0.87) && MOVE_KEYS[np.mv] === 'inout', 'a second plain flick a third of a turn round, early in the move: no spin (it waits its turn)')
    const s = fresh(), h = s.ball.holder, p = s.players[h]
    const roll = (dx, dy, sp) => { const inp = idle(s); inp[h] = { mx: 0, my: 0, dx, dy, sp }; step(s, inp); return s.events.find(e => e.e === 'move') }
    const e0 = roll(-1, 0, 1)
    ok(e0?.kind === 'spin' && MOVE_KEYS[p.mv] === 'spin', 'the stick rolled round (sp): the spin, from standing')
    for (let k = 0; k < 30 && (p.burst > 0 || p.moveCd > 0); k++) step(s, idle(s))
    flick(s, 1, 0); step(s, idle(s)); step(s, idle(s))
    const e = roll(-0.5, -0.87, -1)
    ok(e?.kind === 'spin' && MOVE_KEYS[p.mv] === 'spin', 'rolled round early in a move: the move bends into a spin')
    ok(!flick(s, 0, 1) && MOVE_KEYS[p.mv] === 'spin', '...and a flick then waits for the spin to end')
    let x1 = p.x, turned = false
    for (let n = 0; n < 20; n++) { const vy = p.vy; step(s, idle(s)); if (p.burst > 0 && vy < -6) turned = true }
    ok(turned && p.mv === 0, 'the burst bends round: by its end he is going the new way')
    const t = fresh(), q = t.players[t.ball.holder]
    flick(t, 1, 0); step(t, idle(t))
    ok(!flick(t, 0.9, -0.44) && MOVE_KEYS[q.mv] === 'inout', 'a second flick a little round (26 degrees) leaves the in-and-out as it is')
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
    ok(same && fz > 8 && fz < 200, `a move at a man on him freezes him now and then (${fz} of ${n}), by the game's seeded roll`)
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
    ok((by.spin || 0) < (by.cross || 0) + (by.inout || 0), 'a spin is the rarer move: the CPU rolls it only off a crossover his man stayed with')
  }
  {
    // same seed, same inputs (flicks among them): the same game
    const run = () => { const s = createGame({ teams: [[man('a0', 84)], [man('b0', 84)]], seed: 'det-mv' }); for (let n = 0; n < 2400 && s.phase !== 'over'; n++) { const inp = s.players.map((_, i) => cpuInput(s, i, 'pro')); if (n % 37 === 5) { inp[0].dx = n % 2 ? 1 : -0.6; inp[0].dy = n % 3 ? -0.5 : 0.8 } step(s, inp) } return JSON.stringify([s.score, s.tick, s.rn, s.players.map(p => [p.x, p.y, p.mv, p.burst])]) }
    ok(run() === run(), 'same seed, same inputs with flicks in them: the same game to the last number')
  }
}
head('Dribble legs: every move costs some, a chained one more; tired legs make a shorter, weaker move; they come back')
{
  const s = toLive(duo('sta')), P = s.players, h = P[s.ball.holder], d = P.find(p => p.team !== h.team)
  put(h, 28, 30); put(d, 28, 24)
  const fl = (dx, dy) => { const q = idle(s); q[h.i] = { mx: 0, my: 0, dx, dy }; step(s, q) }
  const sta0 = h.sta
  fl(-1, -0.3); const bk1 = h.bk, after1 = h.sta
  for (let n = 0; n < 40 && (h.burst > 0 || h.moveCd > 0); n++) step(s, idle(s))
  fl(1, -0.3); const after2 = h.sta, bk2 = h.bk
  ok(sta0 === 1 && after1 < 1 && sta0 - after1 > 0.1 && sta0 - after1 < 0.15, `a move costs legs, a little (${sta0.toFixed(2)} to ${after1.toFixed(2)}: 3-4 strung together before he's low)`)
  ok(after1 - after2 > sta0 - after1, `...one chained straight off it costs more (${(after1 - after2).toFixed(2)})`)
  for (let i = 0; i < 4; i++) { for (let n = 0; n < 40 && (h.burst > 0 || h.moveCd > 0); n++) step(s, idle(s)); fl(i % 2 ? 1 : -1, -0.3) }
  ok(h.sta < 0.15 && h.bk < bk1 * 0.7 && h.bk >= T.staFloor * T.chainSlow - 1e-9, `spammed: the legs run out (${h.sta.toFixed(2)}) and the move goes at ${(100 * h.bk).toFixed(0)}% (never nothing)`)
  void bk2
  const tired = h.sta
  for (let n = 0; n < Math.round(3.2 * 30); n++) step(s, idle(s))
  const mid = h.sta
  for (let n = 0; n < Math.round(5 * 30); n++) step(s, idle(s))
  // (slower since 11-26: about 8 s empty to full, so a spammed handle stays tired for a while)
  ok(mid < tired + 0.6 && h.sta > tired + 0.85, `...and they come back slowly with simple dribbling (${tired.toFixed(2)} to ${mid.toFixed(2)} in 3 s, ${h.sta.toFixed(2)} in 8 s)`)
  const fz = sta => ref.judgeMove({ x: 28, y: 30, vx: 0, vy: 0, R: h.R, sta }, { x: 28, y: 26, vx: 0, vy: 0, act: 'free', R: d.R }, { x: -1, y: 0 }, 0.12, 1).freeze
  let a = 0, b = 0
  for (let i = 0; i < 100; i++) { const r = i / 100; if (ref.judgeMove({ x: 28, y: 30, vx: 0, vy: 0, R: h.R, sta: 1 }, { x: 28, y: 26, vx: d.R.topDef, vy: 0, act: 'free', R: d.R }, { x: -1, y: 0 }, r, 1).freeze) a++; if (ref.judgeMove({ x: 28, y: 30, vx: 0, vy: 0, R: h.R, sta: 0 }, { x: 28, y: 26, vx: d.R.topDef, vy: 0, act: 'free', R: d.R }, { x: -1, y: 0 }, r, 1).freeze) b++ }
  void fz
  ok(b < a, `tired legs freeze his man less (${a} fresh, ${b} tired in 100)`)
  // a new possession: everyone's legs full again (the owner, 11-26)
  {
    const u = toLive(duo('sta2')), U = u.players, uh = U[u.ball.holder]
    for (const q of U) q.sta = 0.2
    uh.x = 1; step(u, idle(u))
    for (let n = 0; n < 400 && u.phase !== 'live'; n++) step(u, idle(u))
    ok(U.every(q => q.sta === 1), `out of bounds, the check: everyone starts the next possession on full legs (${U.map(q => q.sta.toFixed(2)).join(', ')})`)
    const v = toLive(duo('sta3')), V = v.players, vh = V[v.ball.holder], vd = V.find(q => q.team !== vh.team)
    for (const q of V) q.sta = 0.3
    v.ball.st = 'loose'; v.ball.x = vd.x; v.ball.y = vd.y; v.ball.z = 1; v.ball.vx = v.ball.vy = v.ball.vz = 0; v.ball.reb = true; v.ball.grabAt = v.tick
    for (let n = 0; n < 20 && v.poss !== vd.team; n++) step(v, idle(v))
    ok(v.poss === vd.team && V.every(q => q.sta === 1), `a defensive board, no check: full legs for the new possession too (${V.map(q => q.sta.toFixed(2)).join(', ')})`)
  }
}
{
  // the CPU plays under the same legs: no CPU move ever starts with more legs than it has, and it can't spam
  let n = 0, low = 0
  for (let g = 0; g < 20; g++) {
    const s = duo(`sta-cpu-${g}`), inp = []
    while (s.phase !== 'over' && s.tick < 30 * 60 * HZ) { for (let i = 0; i < 2; i++) inp[i] = cpuInput(s, i, 'legend'); step(s, inp); for (const e of s.events) if (e.e === 'move') { n++; if (s.players[e.pid].sta < 0.2) low++ } }
  }
  ok(n > 0 && low / n < 0.25, `the CPU's moves pay the same: ${n} moves in 20 games, ${(100 * low / n).toFixed(0)}% of them on tired legs`)
}
head('Defense: SHOOT without the ball is the jump (BLOCK); there is no other jump button')
{
  const s = toLive(duo('blk')), P = s.players, h = P[s.ball.holder], d = P.find(p => p.team !== h.team)
  const q = idle(s); q[d.i] = { mx: 0, my: 0, shoot: true }
  step(s, q)
  ok(d.act === 'jump', 'on defense, SHOOT goes up (a hand up, a block)')
  const s2 = toLive(duo('blk2')), O = s2.players[s2.ball.holder], mate = null
  void mate
  const q2 = idle(s2); q2[O.i] = { mx: 0, my: 0, shoot: true }; step(s2, q2)
  ok(O.act === 'gather', '...with the ball it shoots')
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
  // (a straight run builds a sprint on top of his top speed: T.sprint, the owner 11-26)
  { const r = (p.x - x0) / (R.topBall * PACE); ok(r > 0.98 && r < 1 + T.sprint + 0.02, `with the ball at a full run: ${(p.x - x0).toFixed(1)} ft in a real second (${R.topBall.toFixed(1)} x ${PACE}, up to +${Math.round(T.sprint * 100)}% sprinting)`) }
  ok(gticks(RULES.checkTime) === Math.round(RULES.checkTime * HZ / PACE) && gticks(T.jumpTime) < rticks(T.jumpTime), `game times are ${PACE}x shorter on a watch (the check ${gticks(RULES.checkTime)} ticks = ${(gticks(RULES.checkTime) / HZ).toFixed(2)} s, a jump ${gticks(T.jumpTime)} ticks = ${(gticks(T.jumpTime) / HZ).toFixed(2)} s)`)
  const t = toLive(createGame({ teams: [[man('a0')], [man('b0')]], seed: 'pace2' }))
  ok(t.clock === RULES.shotClock[0] * HZ, `the shot clock is real seconds: ${RULES.shotClock[0]} s is ${t.clock} ticks`)
  const j = meterSpec('jumper', R), l = meterSpec('layup', R)
  ok(j.total === 1000 && j.ideal === 500 && l.total === 870 && l.ideal === 435, `the shot meter is real milliseconds, one sweep up to the green and back down (the layup's slower since 11-26): jumper ${j.ideal} of ${j.total}, layup ${l.ideal} of ${l.total}, green +/- ${j.win.toFixed(0)} and ${l.win.toFixed(0)} at an 80`)
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
  ok(snap.p[h].length === 32 && typeof snap.p[h][30] === 'string', 'a snapshot carries each man\'s move (which one, how long, where it is going, his ball hand; in the post, picked up, bit) for the screens')
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
head('The room: online plays the same take-it-back rule (the referee runs the same step)')
{
  const { r, ws } = room('1v1', ['guard'])
  r.onMessage(ws[0], JSON.stringify({ t: 'start' })); r.stop()
  const g = r.g
  while (g.phase !== 'live') r.tickOnce(Date.now())
  const o = g.poss, d = 1 - o, D = g.players.find(p => p.team === d), O = g.players.find(p => p.team === o)
  put(O, 40, 25); put(D, 28, 12)
  Object.assign(g.ball, { st: 'loose', x: 28, y: 12.3, z: 2, vx: 0, vy: 0, vz: 0, reb: true, grabAt: 0, t: 0, lastTeam: o })
  r.tickOnce(Date.now())
  const live = g.phase === 'live' && g.mustClear === d
  r.broadcast()
  const snap = last(ws[0], 's')
  ok(live && g.mustClear === d && snap?.mc === d && snap.ph === 'live', 'online, a defensive board: no check, and every screen is told his side must take it back (mc)')
  ok((snap?.e || []).some(e => e.e === 'clear'), '...with the clear in the snapshot\'s events')
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
