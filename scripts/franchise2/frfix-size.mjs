// One franchise's save after 1, 3 and 10 seasons (moments off, the GM's calls automatic): bytes raw (what
// localStorage holds) and gzipped (what a sync would send). For the cloud-save question, 2026-11-19.
//   bash scripts/franchise2/run.sh scripts/franchise2/frfix-size.mjs [seasons=10]
import { gzipSync } from 'node:zlib'
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'

const N = Number(process.argv[2] ?? 10)
FR.useContracts(CONTRACTS)
const F = FR.createFranchise({ seed: 'size-sync', team: 'DEN', owner: 'G', builds: [] })
const at = n => { const s = FR.packFranchise(F), raw = Buffer.byteLength(s), gz = gzipSync(s, { level: 9 }).length; console.log(`after ${n} season${n === 1 ? '' : 's'}: ${(raw / 1024).toFixed(1)} KB raw, ${(gz / 1024).toFixed(1)} KB gzipped`) }
const t0 = (() => { const s = FR.packFranchise(F); return [Buffer.byteLength(s), gzipSync(s, { level: 9 }).length] })()
console.log(`new franchise: ${(t0[0] / 1024).toFixed(1)} KB raw, ${(t0[1] / 1024).toFixed(1)} KB gzipped`)
for (let y = 1; y <= N; y++) {
  FR.simWeeks(F); FR.intoPlayoffs(F); FR.simPlayoffs(F); FR.closeSeason(F); FR.ageLeague(F); FR.openResign(F)
  for (const id of [...F.rs]) { const p = F.teams[F.team].r.find(x => x.i === id); FR.resignOne(F, id, FR.optionDue(p) ? 'option' : p.o >= 76) }
  FR.openFA(F); while (F.fad) FR.nextFADay(F)
  FR.openDraft(F); while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  FR.closeDraft(F); FR.autoCamp(F); FR.newSeason(F)
  if (y === 1 || y === 3 || y === 10 || y === N) at(y)
}
