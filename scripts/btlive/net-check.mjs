// BLACKTOP LIVE online: the wire, checked headless against the live room (live/src/btlive.js) in-process. A new
// device (hello v 2) and an old one (no v, an app build from before wire 2) in one game:
//   - the new one gets a snapshot every tick, written against the one it said it has, and reads every one back to
//     exactly the whole state; asking for a whole one (sk -1) gets one; a snapshot against one it lost asks again
//   - the old one gets wire 1 as it always did: every SEND_EVERY ticks, whole, with the last 1.5 s of events
//   - every event reaches the new one exactly once, through dropped snapshots (none lost, none twice)
//   - a dropped input loses no press (counts) and the referee keeps what each device said it has (sk) and draws (vk)
// Bundle and run from the repo root:
//   node_modules/.bin/esbuild scripts/btlive/net-check.mjs --bundle --platform=node --format=esm --outfile=/tmp/nc.mjs \
//     --define:import.meta.env='{"DEV":false}' --loader:.json=json && node /tmp/nc.mjs
import { BtLiveRoom } from '../../live/src/btlive.js'
import { snapIn, snapOf, SEND_EVERY, WIRE, EVENT_KEEP, lerpAt } from '../../src/lib/btlive/proto.js'

let fails = 0
const ok = (c, what) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${what}`); if (!c) fails++ }
const fakeWs = () => { const w = { got: [], send(d) { w.got.push(d) }, close() {} }; return w }

const r = new BtLiveRoom(null, {})
const ws = [fakeWs(), fakeWs()]
const hello = (i, v) => r.onMessage(ws[i], JSON.stringify({ t: 'hello', ...(v ? { v } : {}), vid: `v${i}`, name: `P${i}`, pos: 'guard', build: {}, look: {}, mode: '1v1' }))
hello(0, WIRE); hello(1, null)
r.stop()
const g = r.g
ok(!!g, 'the game starts with a new device and an old one in it')
for (const w of ws) w.got.length = 0

const hist = new Map()
let lastK = -1, ackK = -1, wrong = 0, applied = 0, asked = 0, whole = 0, k = 0, seenSq = new Set(), v2Bytes = 0, v1Bytes = 0, v1Every = new Set(), v1Events = 0
for (let t = 0; t < 36 * 90 && g.phase !== 'over'; t++) {
  // the new device: a message every other tick (one in eight lost), with the newest snapshot it has
  if (t % 2 === 0 && Math.random() > 0.125) r.onMessage(ws[0], JSON.stringify({ t: 'in', k: ++k, mx: 0, my: 0, x: g.players[0].x, y: g.players[0].y, vx: 0, vy: 0, h: 0, n: [0, 0, 0, 0, 0], sk: ackK, vk: g.tick - 3 }))
  r.tickOnce(Date.now())
  const want = JSON.stringify({ ...snapOf(g, [], null), e: 0, a: 0, st: 0, gn: 0 })
  // what the new device got this tick (one in ten dropped on the way)
  for (const d of ws[0].got.splice(0)) {
    v2Bytes += d.length
    const m0 = JSON.parse(d)
    if (m0.v !== WIRE) continue
    if (Math.random() < 0.1 || m0.k <= lastK) continue
    if (m0.bk == null) whole++
    const m = snapIn(m0, hist)
    if (!m) { ackK = -1; asked++; continue }
    lastK = m.k; ackK = m.k; applied++
    for (const e of m.e) seenSq.add(e.sq)
    if (JSON.stringify({ ...m, e: 0, a: 0, st: 0, gn: 0 }) !== want) { if (!wrong++) console.log(JSON.stringify(m).slice(0, 400), '\n', want.slice(0, 400)) }
  }
  for (const d of ws[1].got.splice(0)) { v1Bytes += d.length; const m = JSON.parse(d); if (m.t === 's') { v1Every.add(m.k % SEND_EVERY); if (m.v == null && Array.isArray(m.e) && m.b && !Array.isArray(m.b)) v1Events++ } }
}
const ticks = g.tick
ok(applied > ticks * 0.8 && wrong === 0, `the new device read ${applied} of ${ticks} ticks' snapshots back to the whole state, field for field (${wrong} wrong)`)
ok(whole >= 1, `...it got a whole one to start, and when it asked (${whole} whole)`)
ok(v1Every.size === 1 && v1Every.has(0) && v1Events > ticks / SEND_EVERY * 0.95, `the old device got wire 1: every ${SEND_EVERY} ticks, whole, the ball as an object (${v1Events} snapshots)`)
// every event the game made reached the new one, once each (the first whole snapshot has the ones before it)
ok(r.evq > 20 && seenSq.size === r.evq, `every event reached the new device through the dropped snapshots, once each (${seenSq.size} of ${r.evq})`)
console.log(`      bytes a second: new device ${Math.round(v2Bytes / (ticks / 36))} (36 a second), old device ${Math.round(v1Bytes / (ticks / 36))} (18 a second)`)
ok(v2Bytes < v1Bytes, '...the new device\'s snapshots, twice as many, are fewer bytes in all')

// a snapshot written against one the device doesn't have: it asks for a whole one
ws[0].got.length = 0
r.onMessage(ws[0], JSON.stringify({ t: 'in', k: ++k, mx: 0, my: 0, x: g.players[0].x, y: g.players[0].y, vx: 0, vy: 0, h: 0, n: [0, 0, 0, 0, 0], sk: lastK }))
r.tickOnce(Date.now())
const m0 = JSON.parse(ws[0].got.at(-1))
ok(m0.bk === lastK, 'the referee writes against the one the device said it has')
ok(snapIn(m0, new Map()) === null, '...and a device without that one asks again (snapIn null)')
ws[0].got.length = 0
r.onMessage(ws[0], JSON.stringify({ t: 'in', k: ++k, mx: 0, my: 0, x: g.players[0].x, y: g.players[0].y, vx: 0, vy: 0, h: 0, n: [0, 0, 0, 0, 0], sk: -1, vk: 123.7 }))
r.tickOnce(Date.now())
ok(JSON.parse(ws[0].got.at(-1)).bk == null, 'sk -1: a whole snapshot')
const st = r.seats.find(x => x.vid === 'v0').seat
ok(st.sk === -1 && st.vk === 123, 'the seat keeps what the device has (sk) and the tick it draws the others at (vk)')

// a press in a dropped message is carried by the next (the counts)
const before = st.n[3]
r.onMessage(ws[0], JSON.stringify({ t: 'in', k: ++k + 1, mx: 0, my: 0, x: g.players[0].x, y: g.players[0].y, h: 0, n: [0, 0, 0, before + 1, 0], sk: -1 }))
ok(st.n[3] === before + 1, 'a press whose own message was lost comes with the next one (no d, no rel, no vx: still taken)')

// the drawing: past the newest snapshot it's carried on a little, then waits
const buf = [{ k: 10, p: new Float32Array([0, 0]), b: [0, 0, 0] }, { k: 11, p: new Float32Array([1, 0]), b: [0, 0, 0] }]
const out = new Float32Array(2), ball = [0, 0, 0]
let o = lerpAt(buf, 12.5, out, ball, 3)
ok(Math.abs(out[0] - 2.5) < 1e-6 && Math.abs(o - 1.5) < 1e-9, 'a late snapshot: the others carry on the way they were going (1.5 ticks past: 2.5)')
o = lerpAt(buf, 20, out, ball, 3)
ok(Math.abs(out[0] - 4) < 1e-6, '...for 3 ticks at most')
o = lerpAt(buf, 10.5, out, ball, 3)
ok(Math.abs(out[0] - 0.5) < 1e-6 && o < 0, 'between two: eased')

console.log(fails ? `\n${fails} FAILED` : '\nall ok')
process.exit(fails ? 1 : 0)
