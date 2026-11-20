// A probe of one summer's market: each team's money, the best free agents' asks and offers, day by day.
//   FR_TMP=F:/bap-agents/frnba-cap/tmp bash scripts/franchise2/run.sh scripts/franchise2/nba/fa-probe.mjs [seed]
import { makeLeague, playDay, runDraft, ageLeague } from './fixture'
import * as CAP from '../../../src/lib/franchise2/nba/cap'
import * as K from '../../../src/lib/franchise2/nba/contracts'
import * as M from '../../../src/lib/franchise2/nba/market'

const F = makeLeague({ seed: process.argv[2] ?? 'nba-cap', team: 'BOS' })
for (let d = 0; d < F.days; d++) playDay(F)
F.phase = 'off'; F.off = { step: 'awards' }
runDraft(F)
F.off.step = 'resign'
ageLeague(F)
K.seasonEndDeals(F)
F.off.step = 'fa'
const year = CAP.capYear(F)
const S = Object.keys(F.teams)
const show = tag => {
  console.log(`-- ${tag}: ` + S.map(s => { const c = CAP.capSheet(F, s); const m = K.mleFor(F, s); return `${s} $${c.pay}${c.holds.length ? `(${c.holds.length}h)` : ''} room ${c.room} ${m ? m.k + ' ' + m.$ : '-'} n${CAP.standardOf(F.teams[s]).length}` }).join(' | '))
}
show('open')
const top = M.faBoard(F, 12)
console.log(top.map(p => `${p.n} ${p.o}/${p.ag} fr ${p.fr} mv $${K.marketValue(F, p)} out $${K.outsideBest(F, p)} rs ${JSON.stringify(K.resignOffer(F, p))}`).join('\n'))
for (let d = 1; d <= M.FA_DAYS; d++) {
  const n = M.faDay(F, d)
  console.log(`day ${d}: ${n.length} items; ` + n.slice(0, 8).map(x => x.text).join(' / '))
  if (d === 1) { show('after day 1'); console.log(M.faBoard(F, 8).map(p => `${p.n} ${p.o}/${p.ag} ask ${JSON.stringify(p.ask)}`).join(' · ')) }
}
