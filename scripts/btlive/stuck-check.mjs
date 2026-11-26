// BLACKTOP LIVE: does a CPU ever get stuck? CPUs play whole games of 1v1, 2v2 and King of the Hill (every level, guards
// and bigs, a "person" seat that only walks around or stands still too), every man's spot logged every tick of live
// play, and a man is called stuck when, for more than a second, he runs back and forth (his way flips again and again)
// inside a few feet, or pins himself against a line (moving into the sideline/baseline and getting nowhere).
// A jab out top (the handler sizing his man up, cpu.js) is a shimmy on purpose and is left out; so is a man guarding
// one who is doing it.
// Run from the repo root:  node scripts/btlive/stuck-check.mjs [--games=60] [--verbose]
import { createGame, step, cpuInput, flatBuild, HZ, COURT } from '../../src/lib/btlive/index.js'

const args = process.argv.slice(2)
const GAMES = Number(args.find(a => a.startsWith('--games='))?.slice(8)) || 60
const VERBOSE = args.includes('--verbose')
const gradeFor = ovr => 1 + (ovr - 57) / 44 * 9
const man = (id, ovr, pos) => ({ id, name: id, pos, build: flatBuild(pos, gradeFor(ovr)) })
const LV = ['rookie', 'pro', 'allstar', 'legend']
const WIN = Math.round(1.2 * HZ)          // over this long...
const FLIPS = 4                            // ...this many turns back the way he came...
const BOX = 5                              // ...all inside this many feet
const EDGE = 4.5                           // within this of a sideline or the baseline: "in the corner / on the line"

// a "person" seat: wanders to random spots, sometimes stands still for a while (what a thumb does that a CPU doesn't)
function wanderer(seed) {
  let n = seed >>> 0, tx = 28, ty = 20, t = 0
  const r = () => ((n = (n * 1103515245 + 12345) >>> 0) / 4294967296)
  return (s, i) => {
    const p = s.players[i]
    if (s.tick >= t) { t = s.tick + Math.round((0.5 + r() * 2) * HZ); tx = COURT.minX + r() * 50; ty = COURT.minY + r() * 30; if (r() < 0.3) { tx = p.x; ty = p.y } }
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy)
    const b = s.ball, mine = b.st === 'held' && b.holder === i
    return { mx: d < 0.6 ? 0 : dx / d, my: d < 0.6 ? 0 : dy / d, shoot: mine && r() < 0.01, pass: mine && r() < 0.01 }
  }
}

function setup(mode, g) {
  const lv = LV[g % 4], pos = k => ((g >> k) & 1 ? 'big' : 'guard'), ovr = k => 66 + ((g * 7 + k * 13) % 30)
  let teams
  if (mode === 'koth') teams = [0, 1, 2].map(k => [man(`k${k}`, ovr(k), pos(k))])
  else if (mode === '2v2') teams = [0, 1].map(t => [0, 1].map(k => man(`t${t}${k}`, ovr(t * 2 + k), pos(t * 2 + k))))
  else teams = [0, 1].map(t => [man(`t${t}`, ovr(t), pos(t))])
  const s = createGame({ teams, seed: `stuck-${mode}-${g}`, mode })
  // every third game, one seat is a "person" who wanders
  const human = g % 3 === 2 ? 0 : -1
  const bots = s.players.map((_, i) => (i === human ? wanderer(g * 31 + 7) : (st, k) => cpuInput(st, k, LV[(g + k) % 4] ?? lv)))
  return { s, bots, human }
}

function run(mode, g) {
  const { s, bots, human } = setup(mode, g)
  const hist = s.players.map(() => [])      // per man: { t, x, y, mx, my, jab }
  const found = []
  const open = s.players.map(() => null)    // an episode going on: { from, kind, x, y }
  const cap = 30 * 60 * HZ
  const inp = []
  while (s.phase !== 'over' && s.tick < cap) {
    for (let i = 0; i < s.players.length; i++) inp[i] = bots[i](s, i)
    const live = s.phase === 'live'
    step(s, inp)
    const met = s.players.map(p => {
      const h = hist[p.i]
      if (!live || s.phase !== 'live' || p.out || p.act !== 'free') { h.length = 0; return null }
      // a jab out top on purpose (the handler), or guarding him while he does it
      const handler = s.ball.st === 'held' ? s.players[s.ball.holder] : null
      const hm = handler ? s.cpu[handler.i] || {} : {}
      const jabbing = handler && hm.work != null && s.tick - (hm.gotT ?? s.tick) < hm.work * 0.7 && Math.hypot(handler.x - 28, handler.y - COURT.rim.y) > 15
      const jab = jabbing && (handler === p || p.man === handler.i)
      h.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, mx: inp[p.i].mx || 0, my: inp[p.i].my || 0, jab })
      while (h.length > WIN) h.shift()
      if (h.length < WIN) return null
      let x0 = 99, x1 = -99, y0 = 99, y1 = -99
      for (const q of h) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y) }
      const box = Math.max(x1 - x0, y1 - y0)
      // flips: he is really moving (over 3 ft/s) and his way swings round more than 120 degrees from the way he last went
      let flips = 0, rx = 0, ry = 0
      for (const q of h) {
        const l = Math.hypot(q.vx, q.vy)
        if (l < 3) continue
        const ux = q.vx / l, uy = q.vy / l
        if (rx || ry) { if (ux * rx + uy * ry < -0.5) flips++ }
        rx = ux; ry = uy
      }
      // pinned: pushing hard the whole time and getting almost nowhere, right up against a line
      const ex = Math.min(p.x - COURT.minX, COURT.maxX - p.x), ey = p.y - COURT.minY
      const edge = ex < EDGE || ey < EDGE, onLine = ex < 2.6 || ey < 2.6
      let push = 0
      for (const q of h) push += Math.hypot(q.mx, q.my) > 0.6 ? 1 : 0
      const net = Math.hypot(h[h.length - 1].x - h[0].x, h[h.length - 1].y - h[0].y)
      return { flips, box, edge, jab: h.some(q => q.jab), osc: flips >= FLIPS && box < BOX, pinned: onLine && push > WIN * 0.9 && net < 1.0 && box < 1.5 }
    })
    for (const p of s.players) {
      const r = met[p.i]
      if (!r || p.i === human || r.jab) { close(p.i, s.tick); continue }
      const m = s.cpu[p.i] || {}
      // a defender going side to side with a man who is going side to side is guarding him: the man is the one to look at
      const mm = p.team !== s.poss && p.man >= 0 ? met[p.man] : null
      const mirror = mm && mm.flips >= Math.max(2, r.flips - 2)
      const { osc, pinned, flips, box, edge } = r
      if ((osc && !mirror) || pinned) {
        if (!open[p.i]) open[p.i] = { mode, g, pid: p.i, from: s.tick - WIN, kind: osc ? 'osc' : 'pinned', edge, x: +p.x.toFixed(1), y: +p.y.toFixed(1), team: p.team, poss: s.poss,
          role: s.ball.st === 'held' && s.ball.holder === p.i ? 'ball' : p.team === s.poss ? 'off' : 'def', ball: s.ball.st, plan: m.plan, flips,
          manRim: p.man >= 0 ? +Math.hypot(s.players[p.man].x - 28, s.players[p.man].y - COURT.rim.y).toFixed(1) : null, mySt: `${p.act}${p.post ? " post" : ""}${p.pick ? " pick" : ""} sta${(p.sta ?? 1).toFixed(2)}`, manPlan: p.man >= 0 ? s.cpu[p.man]?.plan : null, manSt: p.man >= 0 ? `${s.players[p.man].act}${s.players[p.man].post ? " post" : ""}${s.players[p.man].pick ? " pick" : ""}` : null,
          myRim: +Math.hypot(p.x - 28, p.y - COURT.rim.y).toFixed(1), box: +box.toFixed(1) }
        else open[p.i].flips = Math.max(open[p.i].flips, flips)
      } else close(p.i, s.tick)
    }
  }
  for (const p of s.players) close(p.i, s.tick)
  return { found, secs: s.tick / HZ, over: s.phase === 'over' }
  function close(i, t) { if (open[i]) { open[i].secs = +((t - open[i].from) / HZ).toFixed(2); found.push(open[i]); open[i] = null } }
}

let longest = 0, total = 0, edgeN = 0, gamesN = 0, stuckGames = 0, secs = 0
const byKind = {}
for (const mode of ['1v1', '2v2', 'koth']) {
  let n = 0, e = 0
  for (let g = 0; g < GAMES; g++) {
    const r = run(mode, g)
    gamesN++; secs += r.secs
    if (!r.over) stuckGames++
    for (const f of r.found) {
      n++; if (f.edge) e++
      longest = Math.max(longest, f.secs)
      const k = `${f.kind}/${f.role}/${f.ball}/${f.plan ?? '-'}${f.edge ? '/edge' : ''}`
      byKind[k] = (byKind[k] || 0) + 1
      if (VERBOSE) console.log(JSON.stringify(f))
    }
  }
  console.log(`${mode.padEnd(5)} ${GAMES} games: ${n} stuck episodes (${e} at a line or in a corner)`)
  total += n; edgeN += e
}
console.log(`\n${gamesN} games, ${(secs / 60).toFixed(0)} min played, ${stuckGames} games that never finished`)
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`)
// (a second and a bit of give and take in a crowd under the rim happens to people too: a couple in a few hundred
// games is allowed. Stuck is what's not: at a line or in a corner at all, or anywhere for over 2 seconds)
const rate = total / (secs / 60) * 1000
let fails = 0
const ok = (c, what) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${what}`); if (!c) fails++ }
ok(stuckGames === 0, `every game finishes (${stuckGames} didn't)`)
ok(edgeN === 0, `no CPU runs back and forth or pins himself at a line or in a corner (${edgeN})`)
ok(longest <= 2, `no back and forth anywhere lasts over 2 s (longest ${longest.toFixed(2)} s)`)
ok(rate < 5, `back and forth over ${(WIN / HZ).toFixed(1)} s anywhere: under 5 per 1000 min played (${total}: ${rate.toFixed(1)} per 1000 min)`)

// TAKING IT BACK (the owner, 11-26: "the CPU runs to the corner after getting the ball and just stands there, never
// clearing it"): a CPU comes down with a defensive board under the rim and in each corner, every level, 1v1 and 2v2,
// 20 times each. Cleared (past the arc) inside about 3 s (4 at the most: from under the rim it's 29 ft, and in 2v2
// there are three men round him), never standing still with it while it's still to be done; and with
// it in the corner (cleared already: he got it behind the line) never standing there with it for over 1.5 s.
// (King of the Hill: a stop is a dead ball and a check, nothing to take back)
{
  const gr = 1 + (80 - 57) / 44 * 9, mk2 = (id, pos) => ({ id, name: id, pos, build: flatBuild(pos, gr) })
  let runs = 0, fast = 0, worst = 0, idle = 0, camp = 0, campRuns = 0, in3 = 0
  for (const mode of ['1v1', '2v2']) for (const lvl of LV) for (const [x, y] of [[30, 3.6], [4.6, 5.5], [51.4, 6]]) for (let k = 0; k < 20; k++) {
    const teams = mode === '1v1' ? [[mk2('a', 'guard')], [mk2('b', k % 2 ? 'big' : 'guard')]] : [[mk2('a', 'guard'), mk2('c', 'big')], [mk2('b', 'guard'), mk2('d', 'big')]]
    const s = createGame({ teams, seed: `clr-${mode}-${lvl}-${x}-${k}` })
    for (let i = 0; i < 400 && s.phase !== 'live'; i++) step(s, s.players.map(() => ({})))
    const d = s.players.find(p => p.team !== s.poss)
    d.x = x; d.y = y; d.vx = d.vy = 0
    Object.assign(s.ball, { st: 'loose', x, y, z: 4, vx: 0, vy: 0, vz: 0, reb: true, grabAt: s.tick, from: -1, t: 99 })
    let t0 = -1, done = -1, still = 0, corner = 0
    for (let t = 0; t < 8 * HZ && done < 0; t++) {
      step(s, s.players.map((_, i) => cpuInput(s, i, lvl)))
      for (const e of s.events) if (e.e === 'clear' && t0 < 0) t0 = t
      if (t0 < 0 && t > 40) break
      if (t0 < 0) continue
      const h = s.ball.st === 'held' ? s.players[s.ball.holder] : null
      if (s.mustClear == null) {
        // (cleared: in the corner with it, he doesn't stand there)
        if (h && Math.abs(h.x - 28) > 19 && h.y < 12 && Math.hypot(h.vx, h.vy) < 1 && h.act === 'free') { if (++corner > 1.5 * HZ) { camp++; break } } else corner = 0
        if (t - t0 > 2.5 * HZ || !h) { done = done < 0 ? t : done; break }
        if (done < 0) done = t
        continue
      }
      if (h && h.act === 'free' && Math.hypot(h.vx, h.vy) < 0.8) { if (++still > HZ) { idle++; still = -1e9 } } else still = Math.max(0, still)
    }
    if (t0 < 0) continue
    runs++
    if (x !== 30) campRuns++
  }
  // (timing taken back separately: the first point it's done)
  for (const mode of ['1v1', '2v2']) for (const lvl of LV) for (const [x, y] of [[30, 3.6], [4.6, 5.5], [51.4, 6]]) for (let k = 0; k < 20; k++) {
    const teams = mode === '1v1' ? [[mk2('a', 'guard')], [mk2('b', k % 2 ? 'big' : 'guard')]] : [[mk2('a', 'guard'), mk2('c', 'big')], [mk2('b', 'guard'), mk2('d', 'big')]]
    const s = createGame({ teams, seed: `clr-${mode}-${lvl}-${x}-${k}` })
    for (let i = 0; i < 400 && s.phase !== 'live'; i++) step(s, s.players.map(() => ({})))
    const d = s.players.find(p => p.team !== s.poss)
    d.x = x; d.y = y; d.vx = d.vy = 0
    Object.assign(s.ball, { st: 'loose', x, y, z: 4, vx: 0, vy: 0, vz: 0, reb: true, grabAt: s.tick, from: -1, t: 99 })
    let t0 = -1
    for (let t = 0; t < 8 * HZ; t++) {
      step(s, s.players.map((_, i) => cpuInput(s, i, lvl)))
      for (const e of s.events) if (e.e === 'clear' && t0 < 0) t0 = t
      if (t0 < 0 && t > 40) break
      if (t0 >= 0 && s.mustClear == null) { const sec = (t - t0) / HZ; worst = Math.max(worst, sec); if (sec <= 4) fast++; if (sec <= 3) in3 = (in3 || 0) + 1; break }
      if (t0 >= 0 && t === 8 * HZ - 1) worst = 99
    }
  }
  console.log(`
taking it back after a CPU's defensive board (under the rim, each corner; every level; 1v1, 2v2): ${runs} runs, ${in3} cleared inside 3 s and ${fast} inside 4 s, the slowest ${worst.toFixed(1)} s; stood still with it still to clear: ${idle}; stood in the corner with it over 1.5 s: ${camp} of ${campRuns}`)
  ok(fast === runs && idle === 0 && camp === 0, 'a CPU always takes it back after a stop, quickly, and never stands with it in the corner')
}
process.exit(fails ? 1 : 0)
