// NBA Franchise: the save at every stop of a season and its summer (packs, unpacks, the size)
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-savecheck.mjs
import * as N from '../../src/lib/franchise2/nba/index'
const F = N.createNbaFranchise({ seed: 'savechk', team: 'CHA', owner: 'G' })
const check = tag => {
  try {
    const s = N.packNba(F)
    const G = N.unpackNba(s)
    console.log(`${tag}: ${(s.length / 1024).toFixed(0)} KB, men ${Object.values(G.teams).reduce((a, t) => a + t.r.length, 0)}, fa ${G.fa.length}`)
  } catch (e) { console.log(`${tag}: SAVE FAILS ${e.message}`) }
}
check('start')
N.simTo(F, F.days); check('season over'); N.startPostseason(F)
for (let k = 0; k < 8; k++) N.playPoNight(F)
// (a save read back in the middle of a round goes on: each night's games still point at their series)
{ const G = N.unpackNba(N.packNba(F)); N.simPostseason(G); console.log('reloaded mid-playoffs, champion:', G.po.champ, G.po.all.length === 4 ? 'four rounds' : `ROUNDS ${G.po.all.length}`) }
N.simPostseason(F); check('finals'); N.closeSeason(F); check('awards')
while (F.phase === 'off') {
  const st = F.off.step
  N.nextStep(F)
  check(`after ${st}`)
  if (F.off?.step === 'fa') { N.faNext(F); check('fa day 2') }
}
