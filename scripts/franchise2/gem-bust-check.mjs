// Gems and busts, class by class: how many each draft has (real chance, not a set number), and where they went.
//   bash scripts/franchise2/run.sh scripts/franchise2/gem-bust-check.mjs [classes=8] [out.json]
// A GEM: taken after the first round, headed for a starter's grade the consensus didn't see (5 or more over his
// board grade). A BUST: a first- or second-round pick headed short of a starter, 5 or more under his board grade.
import { writeFileSync } from 'node:fs'
import * as FR from '../../src/lib/franchise2/index'
const N = Number(process.argv[2] ?? 8), out = process.argv[3]
const F = FR.createFranchise({ seed: 'gembust', team: 'DEN', owner: 'Graham', builds: [], coach: { name: 'Coach', scheme: 'balanced', style: 'developer' } })
const dump = [], counts = []
for (let y = 0; y < N; y++) {
  while (F.phase === 'season') { FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0) }
  FR.intoPlayoffs(F)
  while (F.phase === 'playoffs') FR.playWeek(F, { moments: false })
  FR.runCombine(F)
  FR.closeSeason(F); FR.ageLeague(F)
  FR.openResign(F); for (const id of [...F.rs]) FR.resignOne(F, id, true)
  FR.openFA(F); for (let k = 0; k < 9 && !FR.nextFADay(F).done; k++);
  FR.openDraft(F); FR.startNight(F); FR.simRest(F)
  const rv = FR.draftReview(F)
  const g = F.dr.picks.filter(p => p.tag === 'G').length, b = F.dr.picks.filter(p => p.tag === 'B').length
  counts.push([g, b])
  console.log(`${F.year + 1}: gems ${g} (review ${rv.gems.length}: ${rv.gems.map(p => `${FR.pickSpot(p)}@${p.at + 1} ${FR.gradeOf(p.bz)}->${FR.gradeOf(p.pk)}`).join(', ') || 'none'}) · busts ${b} (review ${rv.busts.length}: ${rv.busts.map(p => `${FR.pickSpot(p)}@${p.at + 1} ${FR.gradeOf(p.bz)}->${FR.gradeOf(p.pk)}`).join(', ') || 'none'})`)
  dump.push(F.dr.picks.map(p => [p.at, p.pk, p.bz, p.p]))
  FR.closeDraft(F); FR.autoCamp(F); FR.newSeason(F)
}
const avg = i => (counts.reduce((a, c) => a + c[i], 0) / counts.length).toFixed(1)
console.log(`per class: gems ${counts.map(c => c[0]).join(' ')} (avg ${avg(0)}) · busts ${counts.map(c => c[1]).join(' ')} (avg ${avg(1)})`)
if (out) writeFileSync(out, JSON.stringify(dump))
const same = counts.every(c => c[0] === counts[0][0]) && counts.every(c => c[1] === counts[0][1])
if (N >= 4 && same) { console.log('!! every class has the same count'); process.exit(1) }
