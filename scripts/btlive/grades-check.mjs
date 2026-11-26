// BLACKTOP LIVE: how far apart a low and a high grade are, one rating at a time (the owner, 11-26: "make grades matter
// a little more across the board"). Everything else at 6; the man across from him a flat 6. Run:
// node scripts/btlive/grades-check.mjs [--lib=src/lib/btlive]
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const lib = path.resolve(process.argv.find(a => a.startsWith('--lib='))?.slice(6) || 'src/lib/btlive')
const L = await import(pathToFileURL(path.join(lib, 'index.js')).href)
const { derive, flatBuild, referee: ref, COURT, T, ovrOf } = L
const RIM = COURT.rim
const R = (pos, over) => derive(flatBuild(pos, 6, over), pos)
const pc = v => `${(100 * v).toFixed(1)}%`
const avgD = R('guard', {}), avgB = R('big', {})
const rows = []
const row = (what, lo, hi, f) => rows.push([what, f(lo), f(hi)])
// an open three from the wing (the make chance an average kid's green window is made from)
row('open three, Jump Shot 4 v 10', 4, 10, g => pc(ref.makeChance({ R: R('guard', { jumpShot: g }), kind: 'jumper', d: 24, past: 0.3, c: 0, run: 0 })))
row('open mid-range, Jump Shot 4 v 10', 4, 10, g => pc(ref.makeChance({ R: R('guard', { jumpShot: g }), kind: 'jumper', d: 15, past: -8, c: 0, run: 0 })))
row('contested layup, Finishing 4 v 10', 4, 10, g => pc(ref.makeChance({ R: R('guard', { finishing: g }), kind: 'layup', d: 4, c: 0.5, run: 0 })))
row('top speed (ft/s), Speed 3 v 10', 3, 10, g => R('guard', { speed: g }).top.toFixed(2))
row('first step (ft/s2), Speed 3 v 10', 3, 10, g => R('guard', { speed: g }).accel.toFixed(1))
row('a move freezes him, Handles 4 v 10', 4, 10, g => { let n = 0; for (let i = 0; i < 400; i++) if (ref.judgeMove({ x: 28, y: 30, R: R('guard', { handles: g }), sta: 1 }, { x: 28, y: 26, vx: 0, vy: 0, act: 'free', R: avgD }, { x: -1, y: 0 }, i / 400, 1).freeze) n++; return pc(n / 400) })
const blk = g => { const d = R('big', { interiorDefense: g }); let n = 0; for (let i = 0; i < 400; i++) if (ref.judgeShot({ id: 'a', x: RIM.x, y: RIM.y + 4, vx: 0, vy: 0, act: 'gather', R: avgD }, [{ id: 'b', x: RIM.x, y: RIM.y + 1.6, vx: 0, vy: 0, act: 'jump', actT: 0.25, R: d }], { kind: 'layup', d: 4, q: 1 }, { block: [i / 400] }).blocked) n++; return pc(n / 400) }
row('block on a layup, Interior D 4 v 10', 4, 10, blk)
const stl = g => { const d = R('guard', { perimeterDefense: g }); let n = 0; for (let i = 0; i < 400; i++) if (ref.judgeSteal({ x: 28, y: 27, R: d }, { x: 28, y: 30, fx: 0, fy: -1, act: 'free', burst: 0, R: avgD }, i / 400).ok) n++; return pc(n / 400) }
row('a swipe gets it, Perimeter D 4 v 10', 4, 10, stl)
row('contest on a jumper 4 ft off, Perimeter D 4 v 10', 4, 10, g => ref.contestOf({ x: 28, y: 30, R: avgD }, [{ id: 'd', x: 28, y: 26, vx: 0, vy: 0, act: 'free', R: R('guard', { perimeterDefense: g }) }], 'jumper').c.toFixed(3))
row('rebound reach (ft), Rebounding 4 v 10', 4, 10, g => R('big', { rebounding: g }).grab.toFixed(2))
row('board in a scramble v a 6, Rebounding 4 v 10', 4, 10, g => { const a = R('big', { rebounding: g }); let n = 0; for (let i = 0; i < 400; i++) if (ref.judgeBoard([{ id: 0, R: a, d: 1 }, { id: 1, R: avgB, d: 1 }], i / 400) === 0) n++; return pc(n / 400) })
row('pass speed (ft/s), Passing 4 v 10', 4, 10, g => R('guard', { passing: g }).passSpeed.toFixed(1))
row('jump reach (ft), Bounce 4 v 10', 4, 10, g => R('guard', { bounce: g }).jumpReach.toFixed(2))
row('OVR (unchanged), all 6s / all 9s', 6, 9, g => ovrOf(flatBuild('guard', g)))
console.log(`lib: ${path.relative(process.cwd(), lib) || '.'}   spread ${T.spread}`)
for (const [w, a, b] of rows) console.log(`  ${w.padEnd(48)} ${String(a).padStart(8)}  ${String(b).padStart(8)}`)
