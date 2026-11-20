// NBA Franchise: draft night end to end, headless (the lottery's order, both rounds, the GM's picks, the rookies signed)
import * as N from '../../src/lib/franchise2/nba/index'
const F = N.createNbaFranchise({ seed: 'dchk', team: 'BOS', owner: 'Graham' })
N.simTo(F, F.days); N.startPostseason(F); N.simPostseason(F); N.closeSeason(F); N.nextStep(F); N.nextStep(F)
let guard = 0
while (N.onClock(F) && guard++ < 200) { const pk = N.onClock(F); if (pk.t === F.team) { const r = N.makePick(F, null); console.log('GM pick', pk.n, r?.man?.n) } else { const m = N.draftTo(F); if (!m.length && N.onClock(F)?.t !== F.team) { console.log('stuck at', N.onClock(F)); break } } }
console.log('made', F.dn.made.length, 'order picks', N.draftOrder(F).length, N.draftOrder(F).map(p => p.n).join(','))
