// NBA Franchise: the GM's builds through two seasons (on the roster as rookies, his man released, growth each summer)
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-builds.mjs
import * as N from '../../src/lib/franchise2/nba/index'
import { NBA_GUARD_PLAYERS } from '../../src/data/nba-guards'
import { NBA_BIG_PLAYERS } from '../../src/data/nba-bigs'
const asB = a => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, { val: v }]))
const g = NBA_GUARD_PLAYERS.find(p => p.name === 'Stephen Curry'), b = NBA_BIG_PLAYERS.find(p => p.attrs && p.position === 'C')
const F = N.createNbaFranchise({ seed: 'bld', team: 'CHA', owner: 'G', builds: [{ pos: 'guard', build: asB(g.attrs), name: 'Marcus Reed', num: 3 }, { pos: 'big', build: asB(b.attrs), name: 'Tre Holloway', num: 50 }] })
const show = () => F.teams.CHA.r.filter(p => p.b != null).map(p => `${p.n} ${p.p} ${p.o} age ${p.ag} $${p.$}x${p.y} rk ${p.rk}`).join(' | ')
console.log('roster', F.teams.CHA.r.filter(p => !p.tw).length, '|', show())
console.log(F.news.slice(0, 3).map(x => x.text).join('\n'))
for (let y = 0; y < 2; y++) {
  N.simTo(F, F.days); N.startPostseason(F); N.simPostseason(F); N.closeSeason(F)
  const ss = F.teams.CHA.r.filter(p => p.b != null).map(p => { const c = p.car?.at(-1); return c ? `${p.n} ${(c.pts / c.gp).toFixed(1)} ppg ${c.gp} gp` : p.n })
  console.log(F.year, ss.join(' | '), 'ROY', F.hist.at(-1).aw.ROY?.n)
  while (F.phase === 'off') {
    if (F.off.step === 'camp') {
      const T = F.teams[F.team]
      while (T.r.filter(p => !p.tw).length > 15) N.CAP_SIM.cutMan(F, F.team, T.r.filter(p => !p.tw && p.b == null).sort((a, c) => a.o - c.o)[0].i)
      for (const p of N.minPool(F)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) }
    }
    N.nextStep(F)
  }
  console.log('  after summer:', show())
}
