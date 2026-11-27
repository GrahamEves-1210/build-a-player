// BLACKTOP LIVE: what an S does (the owner, 11-27: "when you get an S in something it should be like 'let's go' and
// it's apparent in game"). Each trait at A (9), A+ (10) and S (11), the rest of the build at A, against an A man: the
// numbers that trait moves. Then whole builds in CPU games (all-star): all S against all A, all A+ against all A,
// one S against the same build with an A+ there. Run: node scripts/btlive/s-check.mjs [--lib=src/lib/btlive] [--games=200]
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const lib = path.resolve(arg('lib') || 'src/lib/btlive')
const L = await import(pathToFileURL(path.join(lib, 'index.js')).href)
const { derive, flatBuild, referee: ref, meterSpec, windowFor, greenOdds, COURT, T, createGame, step, cpuInput, HZ } = L
const GAMES = Number(arg('games')) || 200
const RIM = COURT.rim
const A = 9
const R = (pos, over) => derive(flatBuild(pos, A, over), pos)
const pc = v => `${(100 * v).toFixed(1)}%`
const rate = (fn, n = 2000) => { let k = 0; for (let i = 0; i < n; i++) if (fn((i + 0.5) / n)) k++; return k / n }
const D = R('guard', {}), DB = R('big', {})
const odds = (p, kind) => greenOdds(windowFor(p, kind), T.kidSd * (kind === 'layup' || kind === 'dunk' ? (T.lSlow ?? 1) : 1))
const rows = [
  ['Speed: top speed (ft/s)', g => R('guard', { speed: g }).top.toFixed(2)],
  ['Speed: first step (ft/s2)', g => R('guard', { speed: g }).accel.toFixed(1)],
  ['Jump Shot: deep three (28 ft) open, a kid makes', g => { const r = R('guard', { jumpShot: g }); return pc(odds(ref.makeChance({ R: r, kind: 'jumper', d: 28, past: 4, c: 0, run: 0 }), 'jumper')) }],
  ['Jump Shot: three, a hand up (c 0.5), a kid makes', g => { const r = R('guard', { jumpShot: g }); return pc(odds(ref.makeChance({ R: r, kind: 'jumper', d: 24, past: 0.3, c: 0.5, run: 0 }), 'jumper')) }],
  ['Jump Shot: open three green window (ms)', g => { const r = R('guard', { jumpShot: g }); return windowFor(ref.makeChance({ R: r, kind: 'jumper', d: 24, past: 0.3, c: 0, run: 0 }), 'jumper').toFixed(0) }],
  ['Finishing: layup through contact (c 0.6)', g => { const r = R('guard', { finishing: g }); return pc(odds(ref.makeChance({ R: r, kind: 'layup', d: 3, c: 0.6, run: 0 }), 'layup')) }],
  ['Bounce: dunks from (ft, open lane)', g => ref.dunkFrom(R('guard', { bounce: g }), true).toFixed(1)],
  ['Bounce: block on a layup (as the blocker)', g => { const d = R('guard', { bounce: g }); return pc(rate(r => !!ref.judgeShot({ id: 'a', x: RIM.x, y: RIM.y + 4, vx: 0, vy: 0, act: 'gather', R: D }, [{ id: 'b', x: RIM.x, y: RIM.y + 1.6, vx: 0, vy: 0, act: 'jump', actT: 0.25, R: d }], { kind: 'layup', d: 4, q: 1 }, { block: [r] }).blocked)) }],
  ['Bounce: dunk over a man on him (dunk chance)', g => { const r = R('guard', { bounce: g }); return pc(rate(x => ref.shotKind(r, 3, x, false, true, 0.6) === 'dunk')) }],
  ['Handles: a move freezes his man', g => { const h = R('guard', { handles: g }); return pc(rate(x => ref.judgeMove({ x: 28, y: 30, R: h, sta: 1 }, { x: 28, y: 26, vx: 0, vy: 0, act: 'free', R: D }, { x: -1, y: 0 }, x, 1).freeze)) }],
  ['Perimeter D: a swipe gets it', g => { const d = R('guard', { perimeterDefense: g }); return pc(rate(x => ref.judgeSteal({ x: 28, y: 27, R: d }, { x: 28, y: 30, fx: 0, fy: -1, act: 'free', burst: 0, R: D }, x).ok)) }],
  ['Perimeter D: a move freezes HIM (lower is better)', g => { const d = R('guard', { perimeterDefense: g }); return pc(rate(x => ref.judgeMove({ x: 28, y: 30, R: D, sta: 1 }, { x: 28, y: 26, vx: 0, vy: 0, act: 'free', R: d }, { x: -1, y: 0 }, x, 1).freeze)) }],
  ['Perimeter D: speed guarding (ft/s)', g => R('guard', { perimeterDefense: g }).topDef.toFixed(2)],
  ['Size: a scramble for a board, vs an A', g => { const a = R('big', { size: g }); return pc(rate(x => ref.judgeBoard([{ id: 0, R: a, d: 1 }, { id: 1, R: DB, d: 1 }], x) === 0)) }],
  ['Size: drop step gets by an A big', g => pc(ref.judgePost({ R: R('big', { size: g }), sta: 1 }, { R: DB, act: 'free' }, 0).p)],
  ['IQ: a move freezes HIM (lower is better)', g => { const d = R('guard', { basketballIQ: g }); return pc(rate(x => ref.judgeMove({ x: 28, y: 30, R: D, sta: 1 }, { x: 28, y: 26, vx: 0, vy: 0, act: 'free', R: d }, { x: -1, y: 0 }, x, 1).freeze)) }],
  ['Clutch: green window at game point (x)', g => meterSpec('jumper', R('guard', { clutch: g }), true).clutch.toFixed(2)],
]
console.log(`lib: ${path.relative(process.cwd(), lib) || '.'}   (the rest of the build A; against an A)`)
console.log('trait'.padEnd(52) + '     A        A+       S')
for (const [w, f] of rows) console.log(`  ${w.padEnd(50)} ${String(f(9)).padStart(7)}  ${String(f(10)).padStart(7)}  ${String(f(11)).padStart(7)}`)
// whole builds, CPU all-star both sides, 1v1 guards
function series(a, b, n) {
  let w = 0
  for (let g = 0; g < n; g++) {
    const s = createGame({ teams: [[{ id: 'a', pos: 'guard', build: a }], [{ id: 'b', pos: 'guard', build: b }]], seed: `s-${g}` })
    while (s.phase !== 'over' && s.tick < 30 * 60 * HZ) step(s, [cpuInput(s, 0, 'allstar'), cpuInput(s, 1, 'allstar')])
    if (s.winner === 0) w++
  }
  return w / n
}
console.log(`\nCPU games (all-star both sides, 1v1 guards, ${GAMES} each)`)
console.log(`  all S  v all A:   ${pc(series(flatBuild('guard', 11), flatBuild('guard', 9), GAMES))}`)
console.log(`  all A+ v all A:   ${pc(series(flatBuild('guard', 10), flatBuild('guard', 9), GAMES))}`)
console.log(`  all S  v all A+:  ${pc(series(flatBuild('guard', 11), flatBuild('guard', 10), GAMES))}`)
for (const k of ['jumpShot', 'speed', 'handles', 'finishing', 'perimeterDefense', 'bounce']) console.log(`  one S (${k}) v the same with A+ there:  ${pc(series(flatBuild('guard', 9, { [k]: 11 }), flatBuild('guard', 9, { [k]: 10 }), GAMES))}`)
