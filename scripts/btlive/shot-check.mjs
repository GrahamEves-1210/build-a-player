// BLACKTOP LIVE: shooting, dunks and blocks by situation, for an average kid's timing (T.kidSd: his release error).
// Make rates and green windows: open / contested x at the line / 2 ft back / 5 ft back, a mid-range jumper, a layup;
// dunk range and rate by Bounce; block rate by matchup with a blocker who goes up like an average kid (a reaction to
// the rise). Run: node scripts/btlive/shot-check.mjs [dir of the lib/btlive files to measure, default the repo's]
const dir = process.argv[2] || new URL('../../src/lib/btlive/', import.meta.url).pathname
const { T, COURT } = await import(dir + '/tune.js')
const ref = await import(dir + '/referee.js')
const M = await import(dir + '/meter.js')
const { derive, flatBuild } = await import(dir + '/ratings.js')
const NEW = !!M.windowFor
let seed = 11
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd())
const SD = 75, N = 20000
const man = (pos, g, over = {}) => derive(flatBuild(pos, g, over), pos)
const RIM = COURT.rim
const topY = COURT.arcC.y + COURT.arcR                       // the top of the key, on the line
const pct = v => (100 * v).toFixed(0).padStart(3) + '%'

// one shot: { kind, x, y, def: null | 'hand' (3 ft in front, a hand up) | 'feet' (4 ft, feet down) }
function shot(R, kind, x, y, def) {
  const sh = { id: 'a', x, y, vx: 0, vy: 0, fx: 0, fy: -1, act: 'gather', R }
  const d = Math.hypot(x - RIM.x, y - RIM.y)
  const defs = []
  if (def) { const u = [(RIM.x - x) / d, (RIM.y - y) / d], o = def === 'hand' ? 3 : 4.5; defs.push({ id: 'b', x: x + u[0] * o, y: y + u[1] * o, vx: 0, vy: 0, act: def === 'hand' ? 'jump' : 'free', actT: 0, R: man('guard', 6) }) }
  const c = ref.contestOf(sh, defs, kind).c
  const past = ref.arcPast ? ref.arcPast(x, y) : 0
  if (NEW) {
    const p = ref.makeChance({ R, kind, d, past, c, run: 0, cs: null, rushed: false })
    const w = M.windowFor(p, kind)
    return { w, rate: M.greenOdds(w, SD) }
  }
  // before: a green went in (a layup unless walled up), anything else rolled its chance off the release
  const spec = M.meterSpec(kind, R, false)
  let made = 0
  for (let i = 0; i < N; i++) {
    const q = M.meterQuality(spec, spec.ideal + gauss() * SD)
    const green = q >= 1 && (kind === 'jumper' || c < T.greenWallL)
    if (green || rnd() < ref.makeChance({ R, kind, d, q, c, run: 0, cs: null, rushed: false })) made++
  }
  return { w: spec.win, rate: made / N }
}
const R80 = man('guard', 5.7)
console.log(`\n${NEW ? 'AFTER' : 'BEFORE'}: an 80 guard (Jump Shot 5.7), an average kid's release (sd ${SD} ms). window: ms either side`)
console.log('situation'.padEnd(26) + 'open (window)     closing, 4.5 ft   hand up 3 ft (window)')
const row = (name, kind, x, y) => { const a = shot(R80, kind, x, y, null), f = shot(R80, kind, x, y, 'feet'), b = shot(R80, kind, x, y, 'hand'); console.log(name.padEnd(26) + `${pct(a.rate)}  (${a.w.toFixed(0)})`.padEnd(18) + `${pct(f.rate)}  (${f.w.toFixed(0)})`.padEnd(18) + `${pct(b.rate)}  (${b.w.toFixed(0)})`) }
row('three, on the line (top)', 'jumper', RIM.x, topY + 0.6)
row('three, 2 ft back', 'jumper', RIM.x, topY + 2)
row('three, 5 ft back', 'jumper', RIM.x, topY + 5)
row('three, corner', 'jumper', RIM.x - COURT.arcSideX - 0.6, RIM.y + 2)
row('mid-range, 15 ft', 'jumper', RIM.x, RIM.y + 15)
row('layup, 3 ft', 'layup', RIM.x, RIM.y + 3)
// a great and a poor shooter at the line
for (const [nm, g] of [['Jump Shot 10', 10], ['Jump Shot 3', 3]]) { const R = man('guard', 5.7, { jumpShot: g }), a = shot(R, 'jumper', RIM.x, topY + 0.6, null), b = shot(R, 'jumper', RIM.x, topY + 0.6, 'hand'); console.log(`three on the line, ${nm}`.padEnd(26) + `${pct(a.rate)}  (${a.w.toFixed(0)})`.padEnd(18) + `${pct(b.rate)}  (${b.w.toFixed(0)})`) }

// dunks by Bounce: how far out he takes off (open lane, and not), how often he dunks at 3 ft open / with a man on him
console.log('\ndunks by Bounce (a guard, Finishing 6)            from (open lane)  from (set)  dunks at 3 ft open  ...a man on him')
for (const [nm, g] of [['low (Bounce 3)', 3], ['low-mid (Bounce 5)', 5], ['mid (Bounce 7)', 7], ['high (Bounce 10)', 10]]) {
  const R = man('guard', 6, { bounce: g })
  const far = ref.dunkFrom(R, true), near = ref.dunkLift ? ref.dunkFrom(R, false) : T.dunkRange
  let o = 0, gd = 0
  for (let i = 0; i < 4000; i++) { const r = rnd(); if (ref.shotKind(R, 3, r, true) === 'dunk') o++; if (ref.shotKind(R, 3, r, false, true) === 'dunk') gd++ }
  const able = (R.bncRaw ?? R.bnc) > (T.dunkBounce ?? 0.25)
  console.log(nm.padEnd(50) + `${able ? far.toFixed(1) + ' ft' : '  -'}`.padEnd(18) + `${able ? near.toFixed(1) + ' ft' : '  -'}`.padEnd(12) + pct(o / 4000).padEnd(20) + pct(gd / 4000))
}

// blocks: the blocker 3 ft in front, going up a reaction after the shooter starts to rise (an average kid:
// 250 ms, sd 90); the shooter lets go on his meter (an average kid too)
console.log('\nblocks (the blocker 3 ft in front, up 250 ms after the rise, sd 90)       on a layup   on a jumper')
const blocks = (B, S, kind, d = 3) => {
  let n = 0
  const spec = M.meterSpec(kind, S, false)
  for (let i = 0; i < N; i++) {
    const rel = Math.max(T.minHoldMs, spec.ideal + gauss() * SD), up = 250 + gauss() * 90
    const sh = { id: 'a', x: RIM.x, y: RIM.y + (kind === 'layup' ? 3.5 : 16), vx: 0, vy: 0, fx: 0, fy: -1, act: 'gather', R: S }
    const df = { id: 'b', x: sh.x, y: sh.y - d, vx: 0, vy: 0, act: 'jump', actT: 0, R: B }
    // (real ms -> the game's seconds: the jump is on the game's clock)
    const tAir = (rel - up) / 1000 * 1.2
    let roll = rnd(), v
    if (tAir >= 0 && tAir <= T.jumpTime) v = ref.judgeShot(sh, [{ ...df, actT: tAir }], { kind, d: 10, q: 0 }, { block: [roll], make: 1 })
    else if (NEW && tAir < 0 && -tAir <= T.blockAfter) v = ref.judgeShot(sh, [{ ...df, after: true }], { kind, d: 10, q: 0 }, { block: [roll], make: 1 })
    if (v?.blocked) n++
  }
  return n / N
}
const WEMBY = man('big', 9, { interiorDefense: 11, size: 11, bounce: 9 }), AVG = man('guard', 6), SMALL = man('guard', 6, { size: 2, bounce: 5 }), BIG = man('big', 7, { size: 10 })
for (const [nm, B, S] of [['elite rim protector (Wemby-like) vs an 80 guard', WEMBY, AVG], ['average guard vs average guard', AVG, AVG], ['small guard vs a big', SMALL, BIG]]) console.log(nm.padEnd(74) + pct(blocks(B, S, 'layup')).padEnd(13) + pct(blocks(B, S, 'jumper')))

// ...and by how close he is to the shooter: right on him (1.5 ft: bodies touching), 3 ft, 5 ft (owner 11-26: a man
// right on the shooter, up with him, gets a real chance at it)
console.log('\nblocks by distance (the same timing)                 layup: 1.5 ft   3 ft   5 ft      jumper: 1.5 ft   3 ft   5 ft')
for (const [nm, B, S] of [['elite rim protector vs an 80 guard', WEMBY, AVG], ['average guard vs average guard', AVG, AVG], ['big vs a guard', BIG, AVG], ['small guard vs a big', SMALL, BIG]])
  console.log(nm.padEnd(52) + [1.5, 3, 5].map(d => pct(blocks(B, S, 'layup', d))).join('   ').padEnd(30) + [1.5, 3, 5].map(d => pct(blocks(B, S, 'jumper', d))).join('   '))
