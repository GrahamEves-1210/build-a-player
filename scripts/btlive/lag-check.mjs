// BLACKTOP LIVE online: the lag compensation (src/lib/btlive/lagcomp.js, the rule), checked through the real referee
// (live/src/btlive.js BtLiveRoom: its seats, its inputs, its pings) on a modelled line.
//
// A steal: the man with the ball runs past a defender standing 3.3 ft off his line, at his full speed with it. The
// defender swipes when his own screen shows the handler at a given spot (his on-screen timing: from too early, through
// in front of him and beside him, to past him and gone). His screen is a beat behind (the 200 ms every screen draws the
// others behind) plus his line: a snapshot takes one way to reach him, and his swipe one way back. So the swipe gets to
// the referee DELAY + 2 x one-way after the moment his screen showed. Hundreds of swipes a timing, each on its own seed,
// at a round trip of 0, 80 and 150 ms (what the game shows as the ping; and 300 ms, over the cap), with the rewind on
// and off. With it on, the rate at each timing is about the same at every round trip up to the cap; off, it falls off
// as the line gets worse. And a defender who was late on his own screen gets nothing from it.
// Then the rule's edges: no rewind past the handler's last action (a dribble move), none for a CPU or a quiet seat, the
// cap, the smoothing; and a block from a man who went up just after the release, at every round trip.
// Bundle and run from the repo root:
//   node_modules/.bin/esbuild scripts/btlive/lag-check.mjs --bundle --platform=node --format=esm --outfile=/tmp/lc.mjs \
//     --define:import.meta.env='{"DEV":false}' --loader:.json=json && node /tmp/lc.mjs [--runs=1000]
import { createGame, step, flatBuild, setLag, HZ, DT, T } from '../../src/lib/btlive/index.js'
import { lagNew, lagRtt, lagRecord, lagView, lagTicks, LAG_CAP_MS } from '../../src/lib/btlive/lagcomp.js'
import { BtLiveRoom } from '../../live/src/btlive.js'

const args = process.argv.slice(2)
const RUNS = Number(args.find(a => a.startsWith('--runs='))?.slice(7)) || 1000
const STEP = 1000 / HZ
const DELAY = Math.round(0.2 * HZ)          // engine.js: the others are drawn this many ticks behind
let fails = 0
const ok = (cond, what) => { console.log(`${cond ? 'ok  ' : 'FAIL'}  ${what}`); if (!cond) fails++ }
const head = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(4, 96 - t.length))}`)
const pct = v => `${Math.round(v * 100)}%`.padStart(4)

// ── a steal at the referee, through its seats ──────────────────────────────────────────────────────
const fakeWs = () => ({ send() {}, close() {} })
// one swipe: the handler is on his line at full speed, the defender sees him at `seen` ft along it (x) and swipes;
// rtt: the defender's round trip (ms); comp: the rewind on
const OFF = 3.3, DX = 28, DY = 20
function swipe(seen, rtt, comp) {
  const r = new BtLiveRoom(null, {})
  const ws = [fakeWs(), fakeWs()]
  ws.forEach((w, i) => r.onMessage(w, JSON.stringify({ t: 'hello', vid: `v${i}`, name: `P${i}`, pos: 'guard', build: flatBuild('guard', 6), look: {}, mode: '1v1' })))
  r.stop()
  const g = r.g
  // (a ball-hawk on a loose handler, so there are steals enough to count)
  for (const p of g.players) { p.R.per = 0.95; p.R.hnd = 0.15; p.R.iq = 0.3 }
  // to the check, the ball live
  let k = 0
  let guard = 0
  while (g.phase !== 'live' && guard++ < 400) { r.seats.forEach(x => { x.seat.heard = Date.now() }); r.tickOnce(Date.now()) }
  const hi = g.ball.holder, di = 1 - hi
  const H = g.players[hi]
  const hws = r.seats[hi].ws, dws = r.seats[di].ws
  // the defender's round trip (his device says it with its pings; a few, so the smoothing has settled)
  for (let j = 0; j < 6; j++) r.onMessage(dws, JSON.stringify({ t: 'ping', c: 1, r: rtt }))
  if (!comp) setLag(g, null)
  const speed = H.R.topBall * DT                           // ft a tick, at his full speed with it
  const x0 = DX - 9, t0 = g.tick
  const at = t => x0 + speed * (t - t0)
  // the tick whose state shows the handler at `seen`; the swipe reaches the referee DELAY + the round trip after it
  const A = t0 + Math.round((seen - x0) / speed)
  const arrive = A + DELAY + Math.round(rtt / STEP)
  let got = null
  for (let t = t0; t <= arrive + 2 && got == null; t++) {
    // (both lines heard every tick: each one's device sends its own spot)
    const hx = at(g.tick + 1)
    r.onMessage(hws, JSON.stringify({ t: 'in', k: ++k, mx: 1, my: 0, x: hx, y: DY, vx: speed / DT, vy: 0, h: 0, n: [0, 0, 0, 0, 0], d: [] }))
    const sw = g.tick + 1 >= arrive ? 1 : 0
    r.onMessage(dws, JSON.stringify({ t: 'in', k: k, mx: 0, my: 0, x: DX, y: DY + OFF, vx: 0, vy: 0, h: 0, n: [0, 0, 0, sw, 0], d: [] }))
    r.tickOnce(Date.now())
    for (const e of g.events) if (e.e === 'steal' && e.pid === di) got = true; else if (e.e === 'swipe' && e.pid === di) got = false
    if (g.phase !== 'live') break
  }
  return !!got
}
function rate(seen, rtt, comp) { let n = 0; for (let i = 0; i < RUNS; i++) n += swipe(seen, rtt, comp) ? 1 : 0; return n / RUNS }

head(`Steals: the handler at full speed past a man ${OFF} ft off his line; the swipe as the defender's screen shows it (${RUNS} a cell)`)
// his on-screen timing: where the handler is on his screen as he swipes (the defender stands at x ${DX})
// (every screen draws him a beat behind, the same at any ping: a swipe lands as he's a few feet on from what it shows,
// so the timing that pays is a touch early. That's how the game is now, at every ping, and it isn't changed here)
const SEEN = [[DX - 9, 'too early (9 ft short)'], [DX - 6, '6 ft short of him'], [DX - 4, '4 ft short'], [DX - 2, '2 ft short'], [DX, 'beside him: late'], [DX + 3, 'past him: very late']]
const RTTS = [0, 80, 150, 300]
const table = {}
console.log(`\n  ${'on his screen'.padEnd(26)}${RTTS.map(r => `rtt ${r}`.padStart(9)).join('')}  |${RTTS.slice(1).map(r => `off ${r}`.padStart(9)).join('')}`)
for (const [seen, what] of SEEN) {
  const on = RTTS.map(rt => rate(seen, rt, true)), off = RTTS.slice(1).map(rt => rate(seen, rt, false))
  table[seen] = { on, off }
  console.log(`  ${what.padEnd(26)}${on.map(v => pct(v).padStart(9)).join('')}  |${off.map(v => pct(v).padStart(9)).join('')}`)
}
console.log('  (rtt: the rewind on, at that round trip; off: the same swipes with no rewind)')
// two cells' rates: "about the same" is inside the noise of RUNS tries each (2.5 standard errors of the difference) + 3 points
const close = (a, b) => Math.abs(a - b) <= 2.5 * Math.sqrt(2 * Math.max(b * (1 - b), 0.02) / RUNS) + 0.03
for (const [seen, what] of SEEN) {
  const { on } = table[seen]
  ok(close(on[1], on[0]) && close(on[2], on[0]), `${what}: about the same at 0, 80 and 150 ms (${on.slice(0, 3).map(pct).join(' /')})`)
}
const reachable = SEEN.filter(([s]) => table[s].on[0] > 0.05).map(([s]) => s)
ok(reachable.some(s => table[s].off[1] < table[s].on[1] - 0.05 || table[s].off[1] > table[s].on[1] + 0.05) || reachable.some(s => table[s].off[2] < table[s].on[2] - 0.05), 'off, the same swipes come out different as the line gets worse (what the rewind puts right)')
{
  // late: a swipe that gets nothing on a 0 ms line
  const late = SEEN.filter(([s]) => table[s].on[0] <= 0.02)
  ok(late.length >= 2 && late.every(([s]) => table[s].on.slice(0, 3).every(v => v <= 0.03)), `a swipe that gets nothing at 0 ms (too early or late on his own screen) gets nothing at 80 or 150 either (${late.map(([, w]) => w).join('; ')})`)
  const best = SEEN.map(([s]) => table[s].on[0]).reduce((a, b) => Math.max(a, b))
  ok(SEEN.every(([s]) => table[s].on.slice(0, 3).every(v => v <= best + 0.06)), `up to the cap no round trip does better than the best a 0 ms line gets (${pct(best)})`)
  console.log(`  (300 ms is over the ${LAG_CAP_MS} ms cap: the rest of his line is his, as anywhere, and his timing has to allow for it)`)
}

// ── the rule's edges ───────────────────────────────────────────────────────────────────────────────
head('The rule: never past the handler\'s last action; the CPU and a quiet seat get none; the cap; the smoothing')
{
  const man = (id, pos = 'guard') => ({ id, name: id, pos, build: flatBuild(pos, 6) })
  const s = createGame({ teams: [[man('a')], [man('b')]], seed: 'edge', mode: '1v1' })
  s.phase = 'live'
  const L = lagNew(2)
  lagRtt(L, 1, 150); L.on[1] = 1; L.on[0] = 1
  const h = s.players[0]
  s.ball.st = 'held'; s.ball.holder = 0
  for (let t = 0; t < 12; t++) { s.tick++; h.x = 10 + t; lagRecord(L, s) }
  s.tick++
  const v = lagView(L, s, 1, 0)
  ok(v && v.n === Math.round(150 / STEP) && Math.abs(v.x - (h.x - v.n)) < 1e-9, `a 150 ms line goes back ${Math.round(150 / STEP)} ticks: the handler ${v?.n} ft back down his line`)
  // a dribble move starts 2 ticks ago (his act changes): the rewind stops there
  s.tick--; h.act = 'move'
  for (let t = 0; t < 2; t++) { s.tick++; h.x += 1; lagRecord(L, s) }
  s.tick++
  const w = lagView(L, s, 1, 0)
  ok(w && w.n === 1, `his crossover started 2 ticks back: the rewind only reaches the tick it started on (${w?.n} back, not ${lagTicks(L, 1)})`)
  L.on[1] = 0
  ok(lagView(L, s, 1, 0) === null && lagTicks(L, 1) === 0, 'a CPU (or a seat whose line is quiet): no rewind')
  const L2 = lagNew(2); L2.on[1] = 1
  ok(lagTicks(L2, 1) === 0, 'no round trip known (an older app): no rewind')
  lagRtt(L2, 1, 900)
  ok(lagTicks(L2, 1) === Math.round(LAG_CAP_MS / STEP), `a 900 ms line: the cap, ${LAG_CAP_MS} ms (${lagTicks(L2, 1)} ticks)`)
  const L3 = lagNew(1); L3.on[0] = 1
  lagRtt(L3, 0, 60); for (let i = 0; i < 4; i++) lagRtt(L3, 0, 60)
  lagRtt(L3, 0, 2000)
  ok(L3.rtt[0] < 160, `one 2 s hitch on a 60 ms line moves the estimate only part of the way (${L3.rtt[0].toFixed(0)} ms)`)
}
{
  // the referee times its own: sp out, spr back (a newer app), and a device's own word (r) is ignored after that
  const r = new BtLiveRoom(null, {})
  const ws = [fakeWs(), fakeWs()]
  const sent = []
  ws[0].send = d => sent.push(JSON.parse(d))
  ws.forEach((w, i) => r.onMessage(w, JSON.stringify({ t: 'hello', vid: `v${i}`, name: `P${i}`, pos: 'guard', build: {}, look: {}, mode: '1v1' })))
  r.stop()
  r.probe(Date.now() - 90)
  const sp = sent.find(m => m.t === 'sp')
  r.onMessage(ws[0], JSON.stringify({ t: 'spr', c: sp.c }))
  const i = r.seats.findIndex(x => x.vid === 'v0')
  r.onMessage(ws[0], JSON.stringify({ t: 'ping', c: 1, r: 900 }))
  ok(sp && Math.abs(r.lag.rtt[i] - 90) < 15, `the room times the round trip itself (sp, spr): ${r.lag.rtt[i].toFixed(0)} ms, and his device's own word after that doesn't move it`)
}

// ── a block: up just after the release (T.blockAfter), at every round trip ───────────────────────────
head(`Blocks: a man who goes up just after the release on his screen, at 0, 80 and 150 ms (${RUNS} a cell)`)
{
  const man = (id, pos) => ({ id, name: id, pos, build: flatBuild(pos, 8) })
  function block(after, rtt, comp, n) {
    const s = createGame({ teams: [[man('a', 'guard')], [man('b', 'big')]], seed: `blk-${n}`, mode: '1v1' })
    let g = 0; while (s.phase !== 'live' && g++ < 400) step(s, s.players.map(() => ({ mx: 0, my: 0 })))
    const sh = s.players[s.ball.holder], d = s.players[1 - sh.i]
    const L = lagNew(2); L.on[d.i] = 1; lagRtt(L, d.i, rtt)
    if (comp) setLag(s, L)
    sh.x = 28; sh.y = 14; d.x = 28; d.y = 11.5; d.vx = d.vy = 0; d.act = 'free'
    Object.assign(s.ball, { st: 'shot', from: sh.i, sx: 28, sy: 14, sz: 8, x: 28, y: 14, z: 8, t: 0, n: 20, kind: 'jumper', rx: 28, ry: 14, verdict: { made: false, d: 12 } })
    sh.act = 'follow'; sh.actN = 30
    // he goes up `after` ticks after the release on his screen: at the referee, the round trip later
    const up = after + Math.round(rtt / STEP)
    for (let t = 0; t <= up; t++) {
      const q = s.players.map(() => ({ mx: 0, my: 0 }))
      if (t === up) q[d.i] = { mx: 0, my: 0, jump: true }
      step(s, q); lagRecord(L, s)
      if (s.events.some(e => e.e === 'block')) return true
      if (s.ball.st !== 'shot') return false
    }
    return false
  }
  for (const after of [1, 3]) {
    const on = [0, 80, 150].map(rt => { let k = 0; for (let i = 0; i < RUNS; i++) k += block(after, rt, true, `${after}-${rt}-${i}`) ? 1 : 0; return k / RUNS })
    const off = [80, 150].map(rt => { let k = 0; for (let i = 0; i < RUNS; i++) k += block(after, rt, false, `${after}-${rt}-${i}`) ? 1 : 0; return k / RUNS })
    console.log(`  up ${after} tick${after > 1 ? 's' : ''} after the release: on ${on.map(pct).join(' /')}   off (80, 150) ${off.map(pct).join(' /')}`)
    ok(close(on[1], on[0]) && close(on[2], on[0]), `up ${after} after on his screen: about the same at 0, 80 and 150 ms`)
  }
}

console.log(`\n${fails ? `${fails} FAILED` : 'all ok'}`)
process.exit(fails ? 1 : 0)
