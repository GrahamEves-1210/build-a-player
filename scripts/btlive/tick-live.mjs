// BLACKTOP LIVE online: the referee's clock as a device sees it, against a real referee (wrangler dev, workerd). Two
// lines open a 1v1 dev room, send their inputs 18 times a second, and stamp every snapshot as it lands: the gap between
// snapshots (mean, spread, p50/p99/max), how many came in the same few ms (two ticks' worth sent in one go) and the
// ticks each one moved on. A ping every second gives the round trip.
//   cd live && npx wrangler dev --port 8811        (then, from the repo root)
//   node scripts/btlive/tick-live.mjs [--server=ws://localhost:8811] [--secs=15] [--json]
const args = process.argv.slice(2)
const arg = (k, d) => args.find(x => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const SERVER = arg('server', 'ws://localhost:8811'), SECS = Number(arg('secs', 15))
const room = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')
const opts = { headers: { Origin: 'http://localhost:5199' } }

function stats(gaps) {
  const a = [...gaps].sort((x, y) => x - y), n = a.length
  const mean = a.reduce((s, v) => s + v, 0) / (n || 1)
  const sd = Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / (n || 1))
  const q = f => a[Math.min(n - 1, Math.floor(f * n))] ?? 0
  return { n, mean: +mean.toFixed(2), sd: +sd.toFixed(2), p50: +q(0.5).toFixed(2), p99: +q(0.99).toFixed(2), max: +(a[n - 1] ?? 0).toFixed(2) }
}
const fmt = s => `n ${s.n}, mean ${s.mean} ms, sd ${s.sd}, p50 ${s.p50}, p99 ${s.p99}, max ${s.max}`

const snaps = [], dk = [], rtts = []
let lastK = -1
const lines = [0, 1].map(i => {
  const ws = new WebSocket(`${SERVER}/btlive/room/${room}`, opts)
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', vid: `probe${i}`, name: `P${i}`, pos: 'guard', build: {}, look: {}, mode: '1v1' }))
  ws.onmessage = e => {
    const m = JSON.parse(e.data)
    if (i === 0 && m.t === 's') { snaps.push(performance.now()); if (lastK >= 0) dk.push(m.k - lastK); lastK = m.k }
    if (i === 0 && m.t === 'pong') rtts.push(performance.now() - m.c)
  }
  return ws
})
let k = 0
const feed = setInterval(() => { k++; for (const w of lines) if (w.readyState === 1) w.send(JSON.stringify({ t: 'in', k, mx: Math.sin(k / 7), my: Math.cos(k / 9), h: 0, n: [0, 0, 0, 0, 0], d: [] })) }, 1000 / 18)
const ping = setInterval(() => { if (lines[0].readyState === 1) lines[0].send(JSON.stringify({ t: 'ping', c: performance.now(), r: rtts.length ? Math.round(rtts[rtts.length - 1]) : 0 })) }, 1000)
await new Promise(res => setTimeout(res, SECS * 1000))
clearInterval(feed); clearInterval(ping); for (const w of lines) w.close()
const gaps = snaps.slice(1).map((t, i) => t - snaps[i])
const s = stats(gaps)
const together = gaps.filter(g => g < 5).length
const skips = dk.filter(d => d !== 2).length
console.log(`snapshots: ${fmt(s)}`)
console.log(`  landed within 5 ms of the one before: ${together}; ticks moved on other than 2: ${skips} (${[...new Set(dk)].join(',')})`)
console.log(`  round trip: ${stats(rtts).mean} ms mean`)
if (args.includes('--json')) console.log(JSON.stringify({ snap: s, together, skips }))
process.exit(s.n > 10 ? 0 : 1)
