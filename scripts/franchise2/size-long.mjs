// A long save's size: N seasons (moments off, the user's calls automatic), then where the bytes go, by part and by
// player field.   bash scripts/franchise2/run.sh scripts/franchise2/size-long.mjs [seasons=15]
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'

const N = Number(process.argv[2] ?? 15)
// (the real contracts: Vite reads the file itself; a headless run hands it in)
console.log(`real contracts: ${FR.useContracts(CONTRACTS)}`)
const F = FR.createFranchise({ seed: 'long', team: 'DEN', owner: 'G', builds: [] })
for (let y = 0; y < N; y++) {
  FR.simWeeks(F); FR.intoPlayoffs(F); FR.simPlayoffs(F); FR.closeSeason(F); FR.ageLeague(F); FR.openResign(F)
  for (const id of [...F.rs]) { const p = F.teams[F.team].r.find(x => x.i === id); FR.resignOne(F, id, FR.optionDue(p) ? 'option' : p.o >= 76) }
  FR.openFA(F); while (F.fad) FR.nextFADay(F)
  FR.openDraft(F); while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  FR.closeDraft?.(F)
  FR.autoCamp(F); FR.newSeason(F)
  if (y % 5 === 4 || y === N - 1) console.log(`after ${y + 1} seasons: ${(FR.saveSize(F) / 1024).toFixed(1)} KB`)
}
const P = JSON.parse(FR.packFranchise(F))
console.log('by part (KB):', Object.entries(P).map(([k, v]) => [k, JSON.stringify(v ?? null).length]).filter(([, n]) => n > 800).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${(n / 1024).toFixed(1)}`).join(', '))
const men = FR.SHORTS.flatMap(s => F.teams[s].r)
const by = {}
for (const p of men) for (const [k, v] of Object.entries(p)) by[k] = (by[k] ?? 0) + JSON.stringify(v).length
console.log('player fields (KB):', Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${(n / 1024).toFixed(1)}`).join(', '), `· ${men.length} men`)
const T = P.teams.KC
console.log('KC', JSON.stringify(T).length, Object.keys(T), JSON.stringify(T.r.slice(0, 3)))
