// NBA Franchise: a key moment's save (waiting on it, and after it): packs and reads back
import * as N from '../../src/lib/franchise2/nba/index'
const F = N.createNbaFranchise({ seed: 'msave', team: 'CHA', owner: 'G' })
let k = 0
while (!F.pend && k++ < 40) N.playNext(F, { moments: true, wantMoment: () => true })
const tryPack = tag => { try { const s = N.packNba(F); const G = N.unpackNba(s); console.log(tag, (s.length / 1024).toFixed(0), 'KB', 'pend', !!G.pend) } catch (e) { console.log(tag, 'FAILS', e.message) } }
tryPack('waiting')
const G0 = N.unpackNba(N.packNba(F))
const plan = N.momentPlan(G0)
N.momentDone(G0, plan, { hit: true, raw: null })
console.log('after the moment on the read-back save: log', G0.log.length, 'pend', !!G0.pend)
try { const s = N.packNba(G0); console.log('after', (s.length / 1024).toFixed(0), 'KB') } catch (e) { console.log('after FAILS', e.message) }
