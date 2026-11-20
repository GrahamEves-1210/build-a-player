// NBA Franchise: key moments add up. Every game of the GM's is forced into a moment; the possession made or missed,
// then the sim plays out what's left. A team down with the last shot that misses should lose (an offensive rebound
// or a foul now and then aside); one that makes it should win or go to overtime most of the time.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-moments.mjs [games=60]
import * as N from '../../src/lib/franchise2/nba/index'
const G = +(process.argv[2] ?? 60)
const tally = {}
const add = (k, won) => { const t = (tally[k] ??= { n: 0, w: 0 }); t.n++; if (won) t.w++ }
for (const hit of [false, true]) {
  const F = N.createNbaFranchise({ seed: `mom-${hit}`, team: 'BOS', owner: 'G' })
  let n = 0
  while (n < G && F.phase === 'season') {
    const out = N.playNext(F, { moments: true, wantMoment: x => x >= -3 && x <= 2 })
    if (!out?.pending) continue
    const plan = N.momentPlan(F)
    const m = F.pend.us - F.pend.them
    N.momentDone(F, plan, { hit, raw: null })
    const row = F.log[F.log.length - 1]
    const key = `${plan.def ? 'stop' : plan.game}|${m > 0 ? '+' : ''}${m}|${hit ? 'made' : 'missed'}`
    add(key, row.w)
    n++
  }
}
for (const [k, t] of Object.entries(tally).sort()) console.log(k.padEnd(28), `${t.w}/${t.n} won`)
