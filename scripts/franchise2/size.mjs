// Where a save's bytes go, after a season and an offseason.  bash scripts/franchise2/run.sh scripts/franchise2/size.mjs
import * as FR from '../../src/lib/franchise2/index'
const F = FR.createFranchise({ seed: 'size', team: 'DEN', owner: 'G', builds: [] })
console.log('new league', FR.saveSize(F))
FR.simWeeks(F); FR.intoPlayoffs(F); FR.simPlayoffs(F); FR.closeSeason(F); FR.ageLeague(F); FR.openResign(F)
for (const id of [...F.rs]) FR.resignOne(F, id, true)
FR.openFA(F); while (F.fad) FR.nextFADay(F)
FR.openDraft(F); while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
FR.newSeason(F)
const packed = JSON.parse(FR.packFranchise(F))
for (const [k, v] of Object.entries(packed)) { const n = JSON.stringify(v ?? null).length; if (n > 200) console.log(k.padEnd(12), n) }
console.log('total', FR.saveSize(F))
const t = packed.teams.DEN
console.log('one team', Object.fromEntries(Object.entries(t).map(([k, v]) => [k, JSON.stringify(v).length])))
console.log('men with careers', FR.SHORTS.reduce((a, s) => a + F.teams[s].r.filter(p => p.cr).length, 0))
console.log('rows', JSON.stringify(t.r.slice(0, 3)))
