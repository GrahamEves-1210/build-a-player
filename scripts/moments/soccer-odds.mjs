// What a striker's key moment is worth in a knockout (the owner, 2026-11-26: "don't make failing a goal hurt win odds
// much, remember this is soccer"). For each kind of chance and the state it comes up in: the chance to go through as
// it stood at the moment (at his usual rate), then after scoring it and after missing it, and for a final (one match)
// the match itself at full time: won, level (extra time, penalties), lost. "old" is the rate the sim used before
// 2026-11-26 (45-92% by grade for every play), "new" the chance's real rate (lib/minigames.js simRate).
// node scripts/moments/soccer-odds.mjs [rounds a chance] [pGame]
import { planMoment, playMoment } from '../../src/lib/inGame.js'
import { simRate } from '../../src/lib/minigames.js'

const N = Number(process.argv[2] ?? 3000), P = Number(process.argv[3] ?? 0.5)
const GAMES = ['penalty', 'one-on-one', 'two-on-one', 'header', 'volley', 'free-kick']
const V = 6   // a middling grade (C+/B-)
const RATES = { old: () => 0.45 + 0.47 * (V - 1) / 10, new: g => simRate(g, V) }
const pc = x => (x * 100).toFixed(0).padStart(3)
const state = (plan) => {
  const agg = plan.mine - plan.opp + (plan.leg1 ? plan.leg1[0] - plan.leg1[1] : 0)
  const late = plan.b.minute >= 82 ? 'late' : 'mid'
  return `${agg > 0 ? 'ahead' : agg < 0 ? 'behind' : 'level'} ${late}`
}
const out = {}
for (const [tag, hOf] of Object.entries(RATES)) {
  for (const game of GAMES) {
    for (const legs of [1, 2]) {
      for (let i = 0; i < N; i++) {
        const ctx = { sport: 'soccer', seed: `so-${game}-${legs}-${i}`, pGame: P, pool: [game], used: [], hOf, us: 'AAA', them: 'BBB', legs, home: legs === 1 ? null : i % 2 === 0 }
        const plan = planMoment(ctx)
        const h = plan.b.h, pre = h * plan.hit + (1 - h) * plan.miss
        for (const key of [`${legs === 1 ? 'final' : 'two legs'} · all`, `${legs === 1 ? 'final' : 'two legs'} · ${state(plan)}`]) {
          const k = `${game}|${key}`, o = (out[k] ??= {})
          const row = (o[tag] ??= { n: 0, pre: 0, hit: 0, miss: 0, card: 0, h: 0, wH: [0, 0, 0], wM: [0, 0, 0] })
          row.n++; row.pre += pre; row.hit += plan.hit; row.miss += plan.miss; row.card += plan.all; row.h += h
          if (legs === 1) for (const [hit, arr] of [[true, row.wH], [false, row.wM]]) {
            const res = playMoment(plan, hit)
            const l = res.legs[0], et = res.et != null
            arr[et ? 1 : l[0] > l[1] ? 0 : 2]++
          }
        }
      }
    }
  }
}
console.log(`pGame ${P}, grade ${V}: through % (at the moment / scored / missed: the shift), a final's match at 90' W-D-L after scoring and missing`)
console.log('chance        state                 rate |  old: at  hit  miss (+hit/-miss)            |  new: at  hit  miss (+hit/-miss)            | n')
for (const [k, o] of Object.entries(out)) {
  const [game, st] = k.split('|')
  if (!o.old || o.old.n < 60) continue
  const f = r => { const n = r.n; const at = r.pre / n, hi = r.hit / n, mi = r.miss / n; const wdl = a => (a[0] + a[1] + a[2] ? a.map(x => pc(x / (a[0] + a[1] + a[2]))).join('-') : '   -   -   '); return `${pc(r.h / n)}% | ${pc(at)} ${pc(hi)} ${pc(mi)} (+${pc(hi - at)}/-${pc(at - mi)}) W-D-L ${wdl(r.wH)} / ${wdl(r.wM)}` }
  console.log(`${game.padEnd(12)}  ${st.padEnd(20)} old ${f(o.old)}`)
  console.log(`${''.padEnd(12)}  ${''.padEnd(20)} new ${f(o.new)}   n ${o.old.n}`)
}
