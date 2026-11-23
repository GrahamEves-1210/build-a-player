// The college games worth a scout's trip, week by week (a player's report, 2026-11-23: "Texas and Tennessee played
// 14 straight weeks"). Plays a season and prints each week's slate; fails if two schools meet twice in a season
// (title week's rematches aside), a school plays twice in one week or plays two bowls.
//   bash scripts/franchise2/run.sh scripts/franchise2/slate-check.mjs [franchises=3] [seasons=2]
import * as FR from '../../src/lib/franchise2/index'
import { slateOf } from '../../src/lib/franchise2/draft'
import CONTRACTS from '../../src/data/nfl-contracts.json'

const NF = Number(process.argv[2] ?? 3), NS = Number(process.argv[3] ?? 2)
FR.useContracts(CONTRACTS)
let bad = 0, games = 0
for (let f = 0; f < NF; f++) {
  const team = ['DEN', 'TEN', 'CIN'][f % 3]
  const F = FR.createFranchise({ seed: `slate-${f}`, team, owner: 'Check', builds: [], coach: { name: 'Coach Reyes', style: 'developer', r: { talentDev: 7, offPlaycalling: 7, defPlaycalling: 5, culture: 6, situational: 6 } } })
  for (let y = 0; y < NS; y++) {
    const met = new Map(), schools = new Map(), bowls = new Set()
    while (F.phase === 'season') {
      const sl = slateOf(F)
      if (sl) {
        const week = new Set()
        const line = sl.games.filter(g => g.k === 'g').map(g => {
          games++
          const k = [g.h, g.a].sort().join('-')
          if (met.has(k) && sl.label !== 'CONFERENCE TITLES') { bad++; console.log(`  !! ${k} again in ${sl.label} (first in ${met.get(k)})`) }
          met.set(k, sl.label)
          if (sl.label === 'BOWL SEASON') for (const c of [g.h, g.a]) { if (bowls.has(c)) { bad++; console.log(`  !! ${c} in two bowls`) } bowls.add(c) }
          for (const c of [g.h, g.a]) { if (week.has(c)) { bad++; console.log(`  !! ${c} twice in ${sl.label}`) } week.add(c); schools.set(c, (schools.get(c) ?? 0) + 1) }
          return `${g.a} at ${g.h} (${g.xs.length})`
        })
        if (y === 0 && f === 0) console.log(`${sl.label.padEnd(24)} ${line.join(' · ')}`)
      }
      FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0)
    }
    const most = [...schools.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => `${c} ${n}`).join(', ')
    console.log(`f${f} ${F.year}: ${met.size} games, most-scouted schools: ${most}`)
    FR.intoPlayoffs(F)
    while (F.phase === 'playoffs') FR.playWeek(F, { moments: false })
    FR.closeSeason(F); FR.closeCarousel(F); FR.ageLeague(F)
    FR.openResign(F)
    for (const id of [...F.rs]) FR.resignOne(F, id, false)
    FR.openFA(F); while (F.fad) FR.nextFADay(F)
    FR.openDraft(F); FR.startNight(F)
    while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
    FR.closeDraft(F); FR.autoCamp(F); FR.newSeason(F)
  }
}
console.log(`\n${games} games checked, ${bad} problems`)
process.exit(bad ? 1 : 0)
