// BLACKTOP LIVE online, measured: two headless phones (390x844) play one on one against a local referee
// (wrangler dev) through the lag harness (net.js ?btlag), each driven by a small bot on its own device's screen,
// and this reports what a player feels:
//   - how long from a press to his own screen showing it (a shot, a dribble move, a steal swipe, a block jump)
//   - how far behind the other man is drawn (his device's own spot against where this one draws him, the best fit)
//   - how often the other man jumps on the screen (a snap: farther in one frame than anyone can run)
//   - steals: of the swipes that looked in reach on his screen, how many the referee had in reach
//   - blocks: going up the moment he sees the release, how often the referee has him up in time (T.blockAfter)
//   - bytes a second each way
// Needs the dev server and the referee running:
//   npx vite --port 5391 --strictPort      (cd live && npx wrangler dev --port 8791)
//   node scripts/btlive/net-lag.mjs --lag=150-400 --jit=60 --drop=0.05 --secs=60 [--shots=DIR]
import { launch, sleep } from '../rail-audit/cdp.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d }
const VITE = arg('vite', 'http://localhost:5391'), WS = arg('ws', 'ws://localhost:8791')
const LAG = arg('lag', '0-0'), JIT = arg('jit', '0'), DROP = arg('drop', '0'), SECS = +arg('secs', '60'), SHOTS = arg('shots', '')
const room = 'L' + Math.random().toString(36).slice(2, 7).toUpperCase()
const url = v => `${VITE}/bucket?btlive=1&btserver=${encodeURIComponent(WS)}&btroom=${room}&btvid=${v}&mode=1v1&stick=one&btlag=${LAG}&btjit=${JIT}&btdrop=${DROP}`

// the bot, on each page: plays (drives at the rim and shoots, flicks moves; on defense stays between his man and the
// rim, swipes at varied distances, goes up at the release he sees) and writes down what it saw
const BOT = `(() => {
  const R = { mine: [], seen: [], own: [], drawn: [], snaps: 0, frames: 0, lat: { shot: [], move: [], steal: [], jump: [] }, taps: [], jumps: [], rels: [], b0: null, t0: 0, rk: [] }
  const reach = 3.9
  let lastTap = -1e9, lastFlick = -1e9, shootAt = 0, upAt = 0, jumpedFor = new Set(), pend = [], lastDraw = null, lastT = 0, lastSq = 0, wasLive = false
  const rim = { x: 28, y: 5.25 }
  function frame() {
    const eng = window.__btlive
    if (!eng || !eng.online) return requestAnimationFrame(frame)
    const s = eng.state, me = eng.me, o = 1 - me, P = s.players, p = P[me], q = P[o], now = performance.now(), wall = performance.timeOrigin + now
    const net = window.__btnet
    if (!R.b0 && s.phase === 'live') { R.b0 = { bin: net.stats.bin, bout: net.stats.bout }; R.s0 = net.stats.sent; R.t0 = now }
    const dr = eng.drawn, live = s.phase === 'live'
    R.frames++
    // every man drawn, and his own man, at a real spot on the court (the owner, 11-27: "jumped to top left corner")
    const onC = (x, y) => Number.isFinite(x) && Number.isFinite(y) && x > 0 && x < 56 && y > -1 && y < 52.5 && !(x < 4 && y < 4)
    for (let i = 0; i < dr.length; i++) if (!onC(dr[i][0], dr[i][1])) { R.offC = (R.offC || 0) + 1; (R.offLog ??= []).length < 5 && R.offLog.push({ i, x: dr[i][0], y: dr[i][1], ph: s.phase, act: P[i].act, pick: P[i].pick }) }
    if (!onC(p.x, p.y)) R.offOwn = (R.offOwn || 0) + 1
    R.badpos = eng.badpos ? eng.badpos.length : 0
    if (p.pick) R.pickF = (R.pickF || 0) + 1
    if (p.act === 'fake') R.fakeF = (R.fakeF || 0) + 1
    R.own.push([wall, p.x, p.y]); R.drawn.push([wall, dr[o][0], dr[o][1]])
    const ni = eng.netInfo
    if (ni.rk != null && ni.k >= 0) R.rk.push(ni.k - ni.rk)
    if (lastDraw && live && wasLive) { const d = Math.hypot(dr[o][0] - lastDraw[0], dr[o][1] - lastDraw[1]); if (d > 0.6 + 35 * (now - lastT) / 1000) { R.snaps++; (R.snapLog ??= []).push({ d: +d.toFixed(2), dt: Math.round(now - lastT), act: q.act, ph: s.phase, near: eng.near, ball: s.ball.st }) } }
    lastDraw = [dr[o][0], dr[o][1]]; lastT = now; wasLive = live
    // what was pressed, till his own screen shows it
    {
      const q = P[o], sw = eng.anim?.[o]?.swipe
      if (sw && sw !== R.oSw) R.seen.push(['steal', wall]); R.oSw = sw
      if (q.act === 'jump' && R.oAct !== 'jump') R.seen.push(['jump', wall])
      if (q.act === 'gather' && R.oAct !== 'gather') R.seen.push(['shot', wall])
      R.oAct = q.act
      if (q.burst > 0 && !(R.oBu > 0)) R.seen.push(['move', wall]); R.oBu = q.burst
    }
    for (const x of pend.splice(0)) { if (x.done()) R.lat[x.k].push(now - x.t); else if (now - x.t < 1500) pend.push(x) }
    // what the referee said happened, as it comes in
    for (const e of eng.evlog) {
      if (e.sq <= lastSq) continue
      lastSq = e.sq
      if (e.e === 'release' && e.pid === o) R.rels.push({ k: e.k })
      if ((e.e === 'swipe' || e.e === 'steal') && e.pid === me) {
        const t = R.taps.find(x => x.srv == null && !x.none)
        if (t) {
          const b = eng.nbuf; let row = null
          for (const x of b) if (x.k <= e.k) row = x
          if (row) t.srv = Math.hypot(row.p[me * 2] - row.p[o * 2], row.p[me * 2 + 1] - row.p[o * 2 + 1]); else t.none = true
          t.ev = e.e
        }
      }
      if (e.e === 'jump' && e.pid === me) { const j = R.jumps.find(x => x.srvK == null && e.k >= x.rel && e.k - x.rel < 60); if (j) j.srvK = e.k }
    }
    for (const t of R.taps) if (t.srv == null && !t.none && now - t.t > 2000) t.none = true
    if (live) {
      const has = s.ball.st === 'held' && s.ball.holder === me
      const def = p.team !== s.poss
      if (has) {
        const dx = rim.x - p.x, dy = rim.y - p.y, d = Math.hypot(dx, dy) || 1
        const w = Math.sin(now / 500) * 0.7
        eng.stick(dx / d - dy / d * w, dy / d + dx / d * w)
        if (now - lastFlick > 1300 && p.act === 'free' && d > 12) { lastFlick = now; const a = Math.random() * 6.283; eng.flick(Math.cos(a), Math.sin(a)); R.mine.push(['move', wall]); const b0 = p.burst; pend.push({ k: 'move', t: now, done: () => eng.state.players[me].burst > 0 }) }
        // (--fakes: after a move, pump fakes, then the pivot: picked up, the stick turns him on his pivot foot)
        if (window.__fakes && !shootAt && p.act === 'free' && now - lastFlick > 250 && now - (R.lastFake || 0) > 700 && Math.random() < 0.08) { R.lastFake = now; R.fakes = (R.fakes || 0) + 1; eng.press('a', true); setTimeout(() => eng.press('a', false), 60) }
        else if (!shootAt && p.act === 'free' && d < 16 && now - lastFlick > 500 && Math.random() < (window.__fakes ? 0.006 : 0.02)) { shootAt = now; eng.press('a', true); R.mine.push(['shot', wall]); pend.push({ k: 'shot', t: now, done: () => eng.state.players[me].act === 'gather' }) }
      } else if (def) {
        const hx = dr[o][0], hy = dr[o][1]
        const tx = hx + (rim.x - hx) * 0.18, ty = hy + (rim.y - hy) * 0.18
        const ex = tx - p.x, ey = ty - p.y, ed = Math.hypot(ex, ey)
        eng.stick(ed > 0.4 ? ex / ed * Math.min(1, ed / 3) : 0, ed > 0.4 ? ey / ed * Math.min(1, ed / 3) : 0)
        const seen = Math.hypot(p.x - hx, p.y - hy)
        if (s.ball.st === 'held' && now - lastTap > 2100 && p.act === 'free' && seen < reach * 1.5 && Math.random() < 0.05) {
          lastTap = now
          const sw = eng.anim?.[me]?.swipe
          R.taps.push({ t: now, seen, srv: null })
          eng.right(0, 1); R.mine.push(['steal', wall])
          pend.push({ k: 'steal', t: now, done: () => { const a = eng.anim?.[me]?.swipe; return !!a && a !== sw } })
        }
        // up the moment the release shows on his screen (the render reaches the release's tick)
        for (const r of R.rels) if (!jumpedFor.has(r.k) && ni.rk >= r.k && ni.rk - r.k < 6 && p.act === 'free' && !upAt) {
          jumpedFor.add(r.k); upAt = now; eng.press('a', true); R.mine.push(['jump', wall]); R.jumps.push({ rel: r.k, srvK: null, seen: Math.hypot(p.x - hx, p.y - hy) })
          pend.push({ k: 'jump', t: now, done: () => eng.state.players[me].act === 'jump' })
        }
      } else eng.stick(0, 0)
    } else eng.stick(0, 0)
    if (shootAt && now - shootAt > 420) { eng.press('a', false); shootAt = 0 }
    if (upAt && now - upAt > 90) { eng.press('a', false); upAt = 0 }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  window.__botR = R
  window.__botDone = () => { const n = window.__btnet, secs = (performance.now() - R.t0) / 1000; return { ...R, sentRate: (n.stats.sent - R.s0) / secs, secs, perf: window.__btlive.perf(), bin: (n.stats.bin - R.b0.bin) / secs, bout: (n.stats.bout - R.b0.bout) / secs, rtt: n.stats.rtt } }
})()`

const pages = []
for (const v of ['AA', 'BB']) {
  const c = await launch({ width: 390, height: 844, mobile: true })
  pages.push(c)
  await c.goto(url(`lag${v}${room}`))
}
// both in: the game starts
for (let i = 0; i < 120; i++) { const ok = await Promise.all(pages.map(c => c.evaluate('!!window.__btlive && window.__btlive.online', { soft: true }))); if (ok.every(x => x === true)) break; await sleep(500) }
const FAKES = process.argv.includes('--fakes')
for (const c of pages) await c.evaluate((FAKES ? 'window.__fakes = true;' : '') + BOT)
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const t0 = Date.now()
let n = 0
while (Date.now() - t0 < SECS * 1000) {
  await sleep(SHOTS ? 2500 : 1000)
  if (SHOTS) for (let i = 0; i < pages.length; i++) writeFileSync(`${SHOTS}/p${i}-${String(n).padStart(2, '0')}.jpg`, await pages[i].screenshot(null, 'jpeg'))
  n++
}
const errs = pages.map(c => c.errors.slice(0, 3))
const res = await Promise.all(pages.map(c => c.evaluate('window.__botDone()')))
for (const c of pages) await c.close()

// how far behind the other is drawn: page j's drawing of i against i's own spot, shifted by tau (the best fit)
function behind(own, drawn) {
  const at = (arr, t) => { let lo = 0, hi = arr.length - 1; if (t <= arr[0][0] || t >= arr[hi][0]) return null; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m][0] <= t) lo = m; else hi = m } const a = arr[lo], b = arr[hi], f = (t - a[0]) / (b[0] - a[0] || 1); return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f] }
  let best = null
  for (let tau = 0; tau <= 900; tau += 5) {
    let e = 0, c = 0
    for (let i = 0; i < drawn.length; i += 3) { const d = drawn[i], q = at(own, d[0] - tau); if (!q) continue; e += Math.hypot(q[0] - d[1], q[1] - d[2]); c++ }
    if (c && (!best || e / c < best.err)) best = { tau, err: e / c }
  }
  return best
}
const med = a => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return Math.round(b[Math.floor(b.length / 2)]) }
const p95 = a => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return Math.round(b[Math.floor(b.length * 0.95)]) }
const out = { lag: LAG, jit: JIT, drop: DROP, secs: Math.round(res[0].secs) }
const lat = {}; for (const k of ['shot', 'move', 'steal', 'jump']) { const all = res.flatMap(r => r.lat[k]); lat[k] = `${med(all)} ms (p95 ${p95(all)}, n ${all.length})` }
out.latency = lat
const b0 = behind(res[0].own, res[1].drawn), b1 = behind(res[1].own, res[0].drawn)
out.behindMs = [b0?.tau, b1?.tau]; out.fitErrFt = [b0?.err?.toFixed(2), b1?.err?.toFixed(2)]
out.renderLagTicks = res.map(r => med(r.rk.map(x => x * 100)) / 100)
const frames = res.reduce((a, r) => a + r.frames, 0), snaps = res.reduce((a, r) => a + r.snaps, 0)
out.snapLog = res.map(r => r.snapLog ?? []).flat().slice(0, 8)
out.snaps = `${snaps} in ${frames} frames (${(snaps / (frames / 60) * 60).toFixed(1)} a minute)`
const taps = res.flatMap(r => r.taps).filter(t => t.srv != null)
const seenIn = taps.filter(t => t.seen <= 3.9)
out.steals = `${seenIn.filter(t => t.srv <= 3.9).length}/${seenIn.length} looked in reach and were; ${taps.filter(t => t.seen > 3.9 && t.srv <= 3.9).length}/${taps.filter(t => t.seen > 3.9).length} looked out and weren't; mean |seen-referee| ${(taps.reduce((a, t) => a + Math.abs(t.seen - t.srv), 0) / (taps.length || 1)).toFixed(2)} ft`
const jumps = res.flatMap(r => r.jumps).filter(j => j.srvK != null)
out.blocks = `${jumps.filter(j => j.srvK - j.rel <= 5).length}/${jumps.length} up in time on the referee (median ${med(jumps.map(j => j.srvK - j.rel))} ticks after the release, window 5)`
// the other man's press to it showing on this screen: each press on one page, the first showing of the same kind on
// the other page after it (within 1 s)
const shown = {}
for (const [a, b] of [[0, 1], [1, 0]]) for (const [kind, t] of res[a].mine) {
  const hit = res[b].seen.find(([k2, t2]) => k2 === kind && t2 >= t && t2 - t < 1000)
  if (hit) (shown[kind] ??= []).push(hit[1] - t)
}
out.oppInputShown = Object.fromEntries(Object.entries(shown).map(([k, v]) => [k, `${med(v)} ms (p95 ${p95(v)}, n ${v.length})`]))
// the visual error: where this page draws the other man against where he is on his own device at the same moment;
// all frames, and the worst in the 400 ms after each sharp change of direction (over 100 degrees within 150 ms, moving)
function visErr(own, drawn) {
  const at = (arr, t) => { let lo = 0, hi = arr.length - 1; if (t <= arr[0][0] || t >= arr[hi][0]) return null; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m][0] <= t) lo = m; else hi = m } const a = arr[lo], b = arr[hi], f = (t - a[0]) / (b[0] - a[0] || 1); return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f] }
  const errs = drawn.map(d => { const q = at(own, d[0]); return q ? [d[0], Math.hypot(q[0] - d[1], q[1] - d[2])] : null }).filter(Boolean)
  const turns = []
  for (let i = 10; i < own.length - 10; i += 3) {
    const a = own[i - 9], b = own[i], c = own[Math.min(own.length - 1, i + 9)]
    const v1 = [b[1] - a[1], b[2] - a[2]], v2 = [c[1] - b[1], c[2] - b[2]], l1 = Math.hypot(...v1), l2 = Math.hypot(...v2)
    if (l1 < 0.6 || l2 < 0.6 || c[0] - a[0] > 400) continue
    if ((v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2) < -0.17 && (!turns.length || b[0] - turns.at(-1) > 500)) turns.push(b[0])
  }
  const peak = turns.map(t => Math.max(0, ...errs.filter(e => e[0] >= t && e[0] <= t + 400).map(e => e[1])))
  const mean = errs.reduce((x, e) => x + e[1], 0) / (errs.length || 1)
  return { mean: +mean.toFixed(2), turnPeak: peak.length ? +(peak.reduce((x, y) => x + y, 0) / peak.length).toFixed(2) : null, turns: peak.length }
}
out.visualErrFt = [visErr(res[0].own, res[1].drawn), visErr(res[1].own, res[0].drawn)]
out.bytesPerSec = { down: res.map(r => Math.round(r.bin)), up: res.map(r => Math.round(r.bout)) }
out.msgsUpPerSec = res.map(r => Math.round(r.sentRate))
out.rtt = res.map(r => r.rtt)
if (errs.some(e => e.length)) out.pageErrors = errs
out.fps = res.map(r => Math.round(r.frames / r.secs)); out.frameWorkMs = res.map(r => r.perf.workAvg)
out.positions = res.map(r => ({ fakes: r.fakes || 0, fakeFrames: r.fakeF || 0, pickedUpFrames: r.pickF || 0, offCourtDrawn: r.offC || 0, offCourtOwn: r.offOwn || 0, putBack: r.badpos || 0, first: r.offLog || [] }))
console.log(JSON.stringify(out, null, 1))
if (process.argv.includes('--fakes') && res.some(r => (r.offC || 0) + (r.offOwn || 0) > 0)) { console.log('FAIL  a man drawn (or his own man) off the court'); process.exitCode = 1 }
