// BLACKTOP LIVE: nobody is ever drawn or stepped at a position that isn't one (the owner, 11-27: "my player jumped to
// top left corner like 0,0 coordinates after a pump fake or shot clock"). Scripted play, every tick, every man's x/y
// finite and on the court (or just off it):
//   practice   pump fakes one after another; a fake right at the shot-clock buzzer; never shooting (the shot clock
//              every time); a fake then a pass. 1v1, 2v2, King of the Hill, many seeds
//   online     the same, his own man moved on his own device (moveLocal) between the referee's snapshots (snapOf /
//              applySnap), his position sent back with his input as the wire does. The device's man after a pump
//              fake (picked up: he pivots on his pivot foot) must stay where the referee has him
// (The online engine's drawing has the same guard: engine.js places, its DEV badpos list; lobby-live-check and net-lag
// run it on the real line.) Run: node scripts/btlive/pos-check.mjs [--lib=src/lib/btlive] [--n=30]
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const lib = path.resolve(arg('lib') || 'src/lib/btlive')
const L = await import(pathToFileURL(path.join(lib, 'index.js')).href)
const P = await import(pathToFileURL(path.join(lib, 'proto.js')).href)
const { createGame, step, cpuInput, moveLocal, flatBuild, HZ, COURT } = L
const N = Number(arg('n')) || 30
const g = 1 + (80 - 57) / 44 * 9
const mk = (id, pos) => ({ id, name: id, pos, build: flatBuild(pos, g) })
const onCourt = p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > COURT.minX - 6 && p.x < COURT.maxX + 6 && p.y > COURT.minY - 6 && p.y < COURT.maxY + 6
let fails = 0
const ok = (c, w) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${w}`); if (!c) fails++ }
const TEAMS = { '1v1': () => [[mk('a', 'guard')], [mk('b', 'guard')]], '2v2': () => [[mk('a', 'guard'), mk('c', 'big')], [mk('b', 'guard'), mk('d', 'big')]], koth: () => [[mk('a', 'guard')], [mk('b', 'guard')], [mk('c', 'big')]] }
const has = (s, i) => s.ball.st === 'held' && s.ball.holder === i && s.phase === 'live'
const SCRIPTS = {
  // (a dribble move first, now and then: his dribble used, so a fake picks it up and he pivots)
  'pump fakes in a row': (s, t) => ({ mx: Math.sin(t / 9), my: Math.cos(t / 13), shoot: t % 14 < 2, dx: t % 28 === 7 ? 1 : 0, dy: 0 }),
  'a move, then fakes and the pivot': (s, t) => { const c = t % 60; return { mx: c > 20 ? Math.sin(t / 5) : 0.6, my: c > 20 ? Math.cos(t / 7) : -0.6, dx: c === 3 ? -1 : 0, dy: 0, shoot: c === 12 || c === 13 || c === 30 || c === 31 } },
  'a fake at the buzzer': (s, t) => ({ mx: 0.3 * Math.sin(t / 7), my: 0, shoot: s.clock < 8 && s.clock % 6 < 2 }),
  'never shoots (the shot clock)': (s, t) => ({ mx: Math.sin(t / 20) * 0.8, my: Math.cos(t / 25) * 0.8 }),
  'a fake, then a pass': (s, t) => { const c = t % 30; return { mx: 0.5, my: -0.5, shoot: c < 2, pass: c === 16 } },
}
// practice: the step alone
for (const [nm, sc] of Object.entries(SCRIPTS)) {
  let bad = 0, ticks = 0, fakes = 0
  for (const [mode, tm] of Object.entries(TEAMS)) for (let k = 0; k < N; k++) {
    const s = createGame({ teams: tm(), seed: `pos-${nm}-${mode}-${k}` })
    for (let t = 0; t < 40 * HZ && s.phase !== 'over'; t++) {
      step(s, s.players.map((_, i) => (i === 0 && has(s, 0) ? sc(s, t) : cpuInput(s, i, 'pro'))))
      ticks++
      for (const e of s.events) if (e.e === 'fake') fakes++
      if (!s.players.every(onCourt) || !Number.isFinite(s.ball.x)) { bad++; break }
    }
  }
  ok(bad === 0, `practice, ${nm}: every man on the court every tick (${ticks} ticks, ${fakes} fakes, ${bad} bad)`)
}
// online: his own man on his own device, between snapshots
for (const [nm, sc] of Object.entries(SCRIPTS)) {
  let bad = 0, off = 0, ticks = 0, picked = 0
  for (const [mode, tm] of Object.entries(TEAMS)) for (let k = 0; k < N; k++) {
    const seed = `posn-${nm}-${mode}-${k}`
    const s = createGame({ teams: tm(), seed }), d = createGame({ teams: tm(), seed })
    const me = 0
    let fail = false
    for (let t = 0; t < 40 * HZ && s.phase !== 'over' && !fail; t++) {
      // his device: the referee's word (a snapshot), then his own man moved there now
      P.applySnap(d, P.snapOf(s, [], null), s.phase === 'live' ? me : -1)
      const live = s.phase === 'live'
      const mine = live && has(s, me) ? sc(s, t) : cpuInput(s, me, 'pro')
      if (live) moveLocal(d, me, { mx: mine.mx || 0, my: mine.my || 0 })
      const q = d.players[me]
      if (!onCourt(q)) { bad++; fail = true; break }
      if (d.players[me].pick) picked++
      // ...and the referee: his input with the spot his device has him at
      // (his device timed it: SHOOT let go that quick is a fake, sent as one: q -1 on the wire, fake here)
      const r = s.players[me]
      if (r.act === 'gather' && !mine.shoot && mine.q == null && r.actT * 1000 / HZ < 130) mine.fake = true
      const inp = s.players.map((_, i) => (i === me ? { ...mine, pos: live ? { x: q.x, y: q.y, vx: q.vx, vy: q.vy } : undefined } : cpuInput(s, i, 'pro')))
      step(s, inp)
      ticks++
      if (!s.players.every(onCourt)) { bad++; fail = true }
      if (live && Math.hypot(s.players[me].x - q.x, s.players[me].y - q.y) > 6) off++
    }
  }
  ok(bad === 0 && off === 0, `online, ${nm}: his own man (moved on his device) and everyone at the referee on the court every tick (${ticks} ticks, ${picked} picked up, ${bad} bad, ${off} over 6 ft from the referee)`)
}
console.log(fails ? `${fails} FAILED` : 'all ok')
process.exit(fails ? 1 : 0)
