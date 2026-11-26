// BLACKTOP LIVE: the drawing path, checked headless. Whole CPU games (1v1, 2v2, King of the Hill, high-flying bigs
// and quick guards) go through the poser (pose.js) and the figure drawing (figure.js) frame by frame, two frames a
// tick, into a stand-in canvas that fails on any number that isn't finite. A throw or a NaN in a pose blanks the whole
// frame on the court (the owner, 11-26: the dunker, the rim and the ball blinked out for a second on dunks: glide()
// read a 'lift' that had been commented out). Also: no foot jumps between frames (no pops), arms within reach.
// Run: node scripts/btlive/pose-check.mjs [--games=24]
import { createGame, step, cpuInputs, flatBuild, HZ } from '../../src/lib/btlive/index.js'
import { createPoser } from '../../src/components/btlive/pose.js'
import { drawFigure, drawShadow, pointAt, lookOf, ballHz } from '../../src/components/btlive/figure.js'

const args = process.argv.slice(2)
const GAMES = Number(args.find(a => a.startsWith('--games='))?.slice(8)) || 24
let fails = 0
const ok = (cond, what) => { console.log(`${cond ? 'ok  ' : 'FAIL'}  ${what}`); if (!cond) fails++ }

// a canvas that checks every number it's given
let bad = null
const fin = (name, a) => { for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) { bad = bad || `${name}(${a.map(x => typeof x === 'number' ? +x.toFixed?.(2) : typeof x).join(', ')})`; return } }
const grad = { addColorStop() {} }
const ctx = new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k]
    if (k === 'createRadialGradient' || k === 'createLinearGradient') return (...a) => { fin(k, a); return grad }
    return (...a) => fin(String(k), a)
  },
  set(t, k, v) { if (typeof v === 'number' && !Number.isFinite(v)) bad = bad || `${String(k)} = ${v}`; return true },
})

const gradeFor = ovr => 1 + (ovr - 57) / 44 * 9
const man = (id, pos, over = {}) => ({ id, name: id, pos, build: flatBuild(pos, gradeFor(86), over) })
const flyer = id => man(id, 'big', { bounce: 11, size: 9, finishing: 10 })
const guard = id => man(id, 'guard', { speed: 11, handles: 10 })
const setups = [
  ['1v1 flyer v guard', [[flyer('a')], [guard('b')]], null],
  ['1v1 flyer v flyer', [[flyer('a')], [flyer('b')]], null],
  ['2v2', [[flyer('a'), guard('b')], [guard('c'), flyer('d')]], null],
  ['King of the Hill', [[flyer('a')], [guard('b')], [flyer('c')]], 'koth'],
]

const STEP = 1000 / HZ
let frames = 0, dunks = 0, maxFootJump = 0, maxJumpAt = '', maxReach = 0, throws = 0
for (let g = 0; g < GAMES; g++) {
  const [nm, teams, mode] = setups[g % setups.length]
  const s = createGame({ teams, seed: 'pc' + g, mode })
  const N = s.players.length, poser = createPoser(N)
  const looks = s.players.map((p, i) => lookOf({ name: 'p' + i, col: '#4da3ff', size: p.R?.sizeRaw ?? 0.5, big: !!p.R?.big }))
  const levels = s.players.map(() => 'allstar'), prev = s.players.map(() => null)
  let now = 0, hb = 0
  for (let t = 0; t < HZ * 150 && s.phase !== 'over'; t++) {
    step(s, cpuInputs(s, levels))
    for (const e of s.events) { poser.on(e, s, now); if (e.e === 'make' && e.kind === 'dunk') dunks++ }
    for (let sub = 0; sub < 2; sub++) {
      now += STEP / 2; frames++
      for (let i = 0; i < N; i++) {
        const p = s.players[i]
        let z
        try { z = poser.pose(s, i, now, { x: p.x, y: p.y, a: sub / 2, dt: STEP / 2, held: (p.actT + sub / 2) * STEP, sFt: 3.6 }) } catch (err) { throws++; if (throws < 4) console.log('  pose threw:', err.message, nm, 'tick', t); continue }
        const f = { x: (p.x + z.ox) * 10, y: (p.y + z.oy) * 10, s: 36, ang: z.ang, scale: z.scale, air: z.air, lean: z.lean, down: z.down, lh: z.lh, rh: z.rh, lf: z.lf, rf: z.rf, toeL: z.toeL, toeR: z.toeR, tw: z.tw, hip: z.hip, look: looks[i] }
        bad = null
        try { drawShadow(ctx, f); drawFigure(ctx, f); if (z.ball) pointAt(f, z.bl[0], z.bl[1], [0, 0, 0], z.bounce ? null : ballHz(z.bl[2])) } catch (err) { throws++; if (throws < 4) console.log('  draw threw:', err.message); continue }
        for (const v of [f.x, f.y, f.ang, f.scale, f.air, f.lean, f.tw ?? 0, f.hip ?? 0, ...f.lh, ...f.rh, ...f.lf, ...f.rf, f.toeL, f.toeR]) if (!Number.isFinite(v)) bad = bad || 'pose value ' + v
        if (bad) { throws++; if (throws < 4) console.log('  not finite:', bad, nm, 'tick', t, p.act, s.ball.st); continue }
        // a foot's jump between two frames (his own frame, his size units), on the floor and not turning hard
        const q = prev[i]
        if (q && !z.air && !q.air && Math.abs(z.ang - q.ang) < 0.15 && p.act === 'free') {
          const j = Math.max(Math.hypot(z.lf[0] - q.lf[0], z.lf[1] - q.lf[1]), Math.hypot(z.rf[0] - q.rf[0], z.rf[1] - q.rf[1]))
          if (j > maxFootJump) { maxFootJump = j; maxJumpAt = `${nm} tick ${t} ${p.act}` }
        }
        maxReach = Math.max(maxReach, z.lh[3] ? 0 : Math.hypot(z.lh[0], z.lh[1]), z.rh[3] ? 0 : Math.hypot(z.rh[0], z.rh[1]))
        prev[i] = { lf: [...z.lf], rf: [...z.rf], air: z.air, ang: z.ang }
      }
    }
  }
}
console.log(`${GAMES} games, ${frames} frames, ${dunks} dunks`)
ok(throws === 0, `every frame posed and drawn with finite numbers, nothing thrown (${throws} bad)`)
ok(dunks >= 5, `dunks were played through (${dunks})`)
ok(maxFootJump < 0.09, `no foot pops between frames on the floor (largest step a frame ${maxFootJump.toFixed(3)} at ${maxJumpAt})`)
ok(maxReach < 1.2, `hands within reach (${maxReach.toFixed(2)})`)
console.log(fails ? `\n${fails} FAILED` : '\nall ok')
process.exit(fails ? 1 : 0)
