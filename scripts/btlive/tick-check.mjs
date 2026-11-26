// BLACKTOP LIVE online: the referee's clock (live/src/btlive.js BtLiveRoom), timed on real timers. A 1v1 room runs
// for a while with two lines in it; every tick and every snapshot sent is stamped. Reported: the gap between ticks and
// between snapshots (mean, spread, p50/p99/max), how often several ticks ran back to back in one go (a batch: what a
// late timer used to do), how far the clock drifted from 30 a second, and how it gets over a stall (the isolate busy
// for 120 ms every 2 s: the ticks it owes are caught up one at a time with the inputs read between them, and a stall
// longer than the cap is let go instead of run all at once).
// Bundle and run from the repo root:
//   node_modules/.bin/esbuild scripts/btlive/tick-check.mjs --bundle --platform=node --format=esm --outfile=/tmp/tc.mjs \
//     --define:import.meta.env='{"DEV":false}' --loader:.json=json && node /tmp/tc.mjs [--secs=10] [--stall=120] [--json]
import { HZ } from '../../src/lib/btlive/index.js'
import { BtLiveRoom } from '../../live/src/btlive.js'

const args = process.argv.slice(2)
const arg = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? Number(a.slice(k.length + 3)) : d }
const SECS = arg('secs', 10), STALL = arg('stall', 120), JSON_OUT = args.includes('--json')
const STEP = 1000 / HZ
let fails = 0
const ok = (cond, what) => { console.log(`${cond ? 'ok  ' : 'FAIL'}  ${what}`); if (!cond) fails++ }

function stats(gaps) {
  const a = [...gaps].sort((x, y) => x - y), n = a.length
  const mean = a.reduce((s, v) => s + v, 0) / (n || 1)
  const sd = Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / (n || 1))
  const q = f => a[Math.min(n - 1, Math.floor(f * n))] ?? 0
  return { n, mean: +mean.toFixed(2), sd: +sd.toFixed(2), p50: +q(0.5).toFixed(2), p99: +q(0.99).toFixed(2), max: +(a[n - 1] ?? 0).toFixed(2) }
}
const fmt = s => `n ${s.n}, mean ${s.mean} ms, sd ${s.sd}, p50 ${s.p50}, p99 ${s.p99}, max ${s.max}`

async function run(stall) {
  const r = new BtLiveRoom(null, {})
  const snaps = [], ticks = []
  // (the snapshots one device gets)
  const mk = me => ({ send(d) { if (me && d.startsWith('{"t":"s"')) snaps.push(performance.now()) }, close() {} })
  const ws = [mk(true), mk(false)]
  ws.forEach((w, i) => r.onMessage(w, JSON.stringify({ t: 'hello', vid: `v${i}`, name: `P${i}`, pos: 'guard', build: {}, look: {}, mode: '1v1' })))
  const tickOnce = r.tickOnce.bind(r)
  // (each tick: when it ran, and whether it ran in the same go as the one before it)
  r.tickOnce = now => { ticks.push(performance.now()); return tickOnce(now) }
  // the lines stay heard (a person on each seat), sending 15 inputs a second each
  let k = 0
  const feed = setInterval(() => { k++; ws.forEach(w => r.onMessage(w, JSON.stringify({ t: 'in', k, mx: Math.sin(k / 7), my: Math.cos(k / 9), h: 0, n: [0, 0, 0, 0, 0], d: [] }))) }, 1000 / 15)
  const stallT = stall ? setInterval(() => { const t = performance.now(); while (performance.now() - t < stall); }, 2000) : null
  const t0 = performance.now(), k0 = r.g.tick
  await new Promise(res => setTimeout(res, SECS * 1000))
  clearInterval(feed); clearInterval(stallT); r.stop()
  const el = performance.now() - t0
  const gaps = ticks.slice(1).map((t, i) => t - ticks[i])
  const sg = snaps.slice(1).map((t, i) => t - snaps[i])
  const batched = gaps.filter(g => g < 2).length
  return { tick: stats(gaps), snap: stats(sg), batched, ran: r.g.tick - k0, due: Math.floor(el / STEP), secs: +(el / 1000).toFixed(2) }
}

const steady = await run(0)
console.log(`\nsteady (${steady.secs} s): ticks ${fmt(steady.tick)}`)
console.log(`                 snapshots ${fmt(steady.snap)}`)
console.log(`                 ticks run back to back (under 2 ms apart): ${steady.batched}; ran ${steady.ran} of ${steady.due} due`)
const st = await run(STALL)
console.log(`\na ${STALL} ms stall every 2 s (${st.secs} s): ticks ${fmt(st.tick)}`)
console.log(`                 snapshots ${fmt(st.snap)}`)
console.log(`                 ticks run back to back: ${st.batched}; ran ${st.ran} of ${st.due} due`)
if (JSON_OUT) console.log(JSON.stringify({ steady, stall: st }))
console.log('')
ok(Math.abs(steady.tick.mean - STEP) < 1.5, `steady: a tick every ${STEP.toFixed(1)} ms on average (${steady.tick.mean})`)
ok(steady.tick.p99 < STEP + 6 && steady.tick.sd < 3, `steady: p99 gap under ${(STEP + 6).toFixed(0)} ms, spread under 3 ms (${steady.tick.p99}, ${steady.tick.sd})`)
ok(steady.batched <= steady.ran * 0.01, `steady: (almost) never two ticks in one go (${steady.batched})`)
ok(Math.abs(steady.ran - steady.due) <= 2, `steady: no drift (${steady.ran} ticks for ${steady.due} due)`)
ok(Math.abs(steady.snap.mean - 2 * STEP) < 2 && steady.snap.p99 < 2 * STEP + 8, `steady: a snapshot every ${(2 * STEP).toFixed(1)} ms, p99 under ${(2 * STEP + 8).toFixed(0)} (${steady.snap.mean}, ${steady.snap.p99})`)
ok(st.due - st.ran <= Math.ceil(SECS / 2) * Math.ceil(STALL / STEP), `stall: the ticks it owes are caught up or let go, never more than the stalls (${st.ran} of ${st.due})`)
console.log(`\n${fails ? `${fails} FAILED` : 'all ok'}`)
process.exit(fails ? 1 : 0)
