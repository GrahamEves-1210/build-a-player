// Career football's playoff moments: is the chance the screen shows the chance they win? The round card shows the
// game's chance before a ball is played (plan.all); the game screen shows "Land it: about X% to win. Miss it: about
// Y%" (plan.hit, plan.miss), from the state the moment comes up in (the score, the clock, who has the ball) with the
// rest of the game still to play. Here thousands of moments are planned and played the way playoffRound plays them
// (lib/inGame.js planMoment, playMoment), landed, missed and at the build's usual rate, and the shown chance is put
// next to how often they won, in bands. Every band should win about as often as it says.
// Run from the repo root:  node scripts/moments/winodds-check.mjs [moments-per-position]
import { planMoment, playMoment } from '../../src/lib/inGame.js'
import { momentFacts } from '../../src/lib/situations.js'
import { seeded } from '../../src/lib/rng.js'

const POOLS = {
  qb: ['hot-read', 'bomb', 'escape', 'sneak', 'two-minute', 'third-long', 'audible', 'goal-line'],
  rb: ['gap', 'juke', 'goal-line', 'kick-return'], wr: ['catch', 'juke-wr', 'release', 'goal-line', 'kick-return'], te: ['catch', 'seal', 'juke-te', 'goal-line', 'release'],
  ol: ['pass-pro', 'seal'], db: ['jump-route', 'tackle-angle'], dl: ['pass-rush', 'run-stuff', 'tackle-angle'], lb: ['tackle-angle', 'run-stuff', 'zone-drop', 'hit-stick', 'pass-rush'],
  k: ['game-winner', 'deep-kick', 'onside'],
}
const N = Number(process.argv[2] ?? 1500)
const RATES = [0.5, 0.68, 0.86]
const bands = { hit: {}, miss: {}, all: {} }
const put = (kind, shown, won) => { const b = Math.min(95, Math.floor(shown * 20) * 5); const x = (bands[kind][b] ??= { n: 0, s: 0, w: 0 }); x.n++; x.s += shown; x.w += won ? 1 : 0 }
let hi = { n: 0, w: 0 }
const t0 = Date.now()
for (const pos of Object.keys(POOLS)) for (let j = 0; j < N; j++) {
  const p = 0.3 + (j % 11) * 0.05, h = RATES[j % 3]
  const ctx = { sport: 'nfl', seed: `wo-${pos}-${j}`, pGame: p, pool: POOLS[pos], used: [], hOf: () => h, us: 'AAA', them: 'BBB' }
  const plan = planMoment(ctx)
  // landed and missed, with the facts a report with nothing extra in it gives (the way playoffRound reads one)
  const wonHit = playMoment(plan, true, momentFacts(plan.game, null, true), null).won
  const wonMiss = playMoment(plan, false, momentFacts(plan.game, null, false), null).won
  const sim = seeded(`mg-sim-${ctx.seed}`)() < plan.b.h
  const wonSim = playMoment(plan, sim, momentFacts(plan.game, null, sim), null).won
  put('hit', plan.hit, wonHit); put('miss', plan.miss, wonMiss); put('all', plan.all, wonSim)
  if (plan.hit >= 0.85) { hi.n++; hi.w += wonHit ? 1 : 0 }
}
const pc = x => `${(x * 100).toFixed(1)}%`.padStart(6)
let worst = 0
for (const [kind, title] of [['hit', 'LAND IT (shown on the game screen, then landed)'], ['miss', 'MISS IT (shown, then missed)'], ['all', 'THE CARD (shown before the game, the build\'s usual rate)']]) {
  console.log(`\n${title}\n  band    moments  shown    won`)
  for (const b of Object.keys(bands[kind]).map(Number).sort((a, b) => a - b)) {
    const x = bands[kind][b]
    // (a band's gap in standard errors: luck in a band of a few hundred is a few points)
    const m = x.s / x.n, se = Math.sqrt(Math.max(0.0025, m * (1 - m)) / x.n)
    if (x.n >= 150) worst = Math.max(worst, Math.abs(x.w / x.n - m) / se)
    console.log(`  ${String(b).padStart(2)}-${String(b + 5).padStart(3)}%  ${String(x.n).padStart(6)}  ${pc(x.s / x.n)} ${pc(x.w / x.n)}`)
  }
}
console.log(`\nshown 85% or more to win after landing it: ${hi.n} moments, won ${pc(hi.w / hi.n)}`)
console.log(`largest gap in a band of 150+: ${worst.toFixed(1)} standard errors · ${((Date.now() - t0) / 1000).toFixed(0)}s`)
process.exit(worst > 4 || hi.w / hi.n < 0.85 ? 1 : 0)
