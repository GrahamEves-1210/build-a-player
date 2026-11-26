// Do playoff moments inflate win odds? For each sport and matchup band, about 20k rounds played four ways:
//   off   Career's mini games set to None: no moment, the round on the matchup's own odds
//   sim   the moment played at the build's usual rate (MiniGame's sim: lib/career.js momentHitRate)
//   hit   every moment landed      miss  every moment missed
// The moment is planned and played by lib/inGame.js, the way a playoff round plays it. sim should sit on off; hit and
// miss show how much one play is worth. Builds are spread over the grades (a rate of 0.5, 0.68 and 0.86 at the play;
// a striker's chances at their own real rates at a grade of 3, 6 and 9: lib/minigames.js simRate).
// Run from the repo root:  node scripts/moments/calibrate.mjs [rounds] [sport: nfl | hoops | soccer | baseball]
import { planMoment, playMoment, expectAt } from '../../src/lib/inGame.js'
import { seeded } from '../../src/lib/rng.js'
import { simRate } from '../../src/lib/minigames.js'

const N = Number(process.argv[2] ?? 20000)
const POOLS = {
  qb: ['hot-read', 'bomb', 'escape', 'sneak', 'two-minute', 'third-long', 'audible', 'goal-line'],
  rb: ['gap', 'juke', 'goal-line', 'kick-return'], wr: ['catch', 'juke-wr', 'release', 'goal-line', 'kick-return'], te: ['catch', 'seal', 'juke-te', 'goal-line', 'release'],
  ol: ['pass-pro', 'seal'], db: ['jump-route', 'tackle-angle'], dl: ['pass-rush', 'run-stuff', 'tackle-angle'], lb: ['tackle-angle', 'run-stuff', 'zone-drop', 'hit-stick', 'pass-rush'],
  k: ['game-winner', 'deep-kick', 'onside'],
  guard: ['iso', 'pnr', 'clutch-shot', 'free-throws', 'lockdown', 'fast-break', 'half-court', 'board'],
  big: ['post-up', 'board', 'rim-protect', 'free-throws', 'clutch-shot', 'alley-oop', 'iso', 'pnr'],
  st: ['penalty', 'one-on-one', 'header', 'volley', 'free-kick', 'two-on-one'],
  bat: ['at-bat', 'walk-off', 'steal-second'], pit: ['strike-out', 'escape-jam'],
}
const SPORTS = [
  { name: 'Football (QB RB WR TE OL DB DL LB)', sport: 'nfl', pos: ['qb', 'rb', 'wr', 'te', 'ol', 'db', 'dl', 'lb'], bands: [0.25, 0.4, 0.5, 0.6, 0.75] },
  { name: 'Football kicker', sport: 'nfl', pos: ['k'], bands: [0.25, 0.4, 0.5, 0.6, 0.75] },
  { name: 'Basketball (one game of a series, the play-in)', sport: 'hoops', pos: ['guard', 'big'], bands: [0.3, 0.4, 0.5, 0.6, 0.7] },
  { name: 'Soccer (a tie: two legs or a final)', sport: 'soccer', pos: ['st'], bands: [0.25, 0.4, 0.5, 0.6, 0.75] },
  { name: 'Baseball (one game of a series)', sport: 'baseball', pos: ['bat', 'pit'], bands: [0.38, 0.45, 0.5, 0.55, 0.62] },
]
const RATES = [0.5, 0.68, 0.86], GRADES = [3, 6, 9]
const pct = x => `${(x * 100).toFixed(1)}`.padStart(5)
const t0 = Date.now()
const rows = []
for (const S of SPORTS.filter(x => !process.argv[3] || x.sport === process.argv[3])) {
  console.log(`\n${S.name}`)
  console.log('  band    off    sim    hit   miss   card  (sim - off)')
  for (const p of S.bands) {
    const r = seeded(`calib-${S.sport}-${p}`)
    const w = { off: 0, sim: 0, hit: 0, miss: 0 }
    let card = 0
    for (let i = 0; i < N; i++) {
      const pos = S.pos[i % S.pos.length], j = Math.floor(i / S.pos.length) % RATES.length, hr = RATES[j]
      const hOf = S.sport === 'soccer' ? g => simRate(g, GRADES[j]) : () => hr
      const extra = S.sport === 'soccer' ? { legs: i % 3 === 0 ? 1 : 2, home: i % 3 === 0 ? null : i % 2 === 0 } : S.sport === 'baseball' ? { home: i % 2 === 0, gameNo: 1 + (i % 4) } : {}
      const ctx = { sport: S.sport, seed: `cal-${S.sport}-${p}-${i}`, pGame: p, pool: POOLS[pos], used: [], hOf, us: 'AAA', them: 'BBB', ...extra }
      const plan = planMoment(ctx)
      card += plan.all
      if (r() < p) w.off++
      const u = seeded(`mg-sim-${ctx.seed}`)()
      if (playMoment(plan, u < plan.b.h, null, null).won) w.sim++
      if (playMoment(plan, true, null, null).won) w.hit++
      if (playMoment(plan, false, null, null).won) w.miss++
    }
    const row = { sport: S.name, p, off: w.off / N, sim: w.sim / N, hit: w.hit / N, miss: w.miss / N, card: card / N }
    rows.push(row)
    console.log(`  ${pct(p)}  ${pct(row.off)}  ${pct(row.sim)}  ${pct(row.hit)}  ${pct(row.miss)}  ${pct(row.card)}  ${(row.sim - row.off >= 0 ? '+' : '') + ((row.sim - row.off) * 100).toFixed(1)}`)
  }
}
console.log(`\n${N} rounds a band, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
void expectAt
