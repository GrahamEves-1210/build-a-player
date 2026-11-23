// How spread out the league's records are, season by season (a player's report, 2026-11-23: "most teams go 12-5,
// the #1 seed and the last seed all close"). Prints each season's best and worst record, the spread of wins
// (standard deviation; the real NFL runs about 3.1) and the most common record, plus the user's team.
//   bash scripts/franchise2/run.sh scripts/franchise2/records-spread.mjs [franchises=2] [seasons=10]
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'

const NF = Number(process.argv[2] ?? 2), NS = Number(process.argv[3] ?? 10)
FR.useContracts(CONTRACTS)
const TEAMS = ['DEN', 'DET', 'CIN', 'TEN']
const all = []
for (let f = 0; f < NF; f++) {
  const team = TEAMS[f % TEAMS.length]
  const F = FR.createFranchise({ seed: `spread-${f}`, team, owner: 'Check', builds: [], coach: { name: 'Coach Reyes', style: 'developer', r: { talentDev: 7, offPlaycalling: 7, defPlaycalling: 5, culture: 6, situational: 6 } } })
  for (let y = 0; y < NS; y++) {
    while (F.phase === 'season') { FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0) }
    const rec = FR.records(F)
    const wins = FR.SHORTS.map(s => rec[s].w + rec[s].t / 2)
    const mean = wins.reduce((a, b) => a + b, 0) / wins.length
    const sd = Math.sqrt(wins.reduce((a, w) => a + (w - mean) ** 2, 0) / wins.length)
    const cnt = {}; for (const s of FR.SHORTS) { const k = `${rec[s].w}-${rec[s].l}`; cnt[k] = (cnt[k] ?? 0) + 1 }
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]
    const s = { f, y: F.year, best: Math.max(...wins), worst: Math.min(...wins), sd: +sd.toFixed(2), mode: `${top[0]} x${top[1]}`, mine: `${rec[team].w}-${rec[team].l}` }
    all.push(s)
    console.log(`f${f} ${s.y}  best ${s.best}  worst ${s.worst}  sd ${s.sd}  most common ${s.mode}  ${team} ${s.mine}`)
    FR.intoPlayoffs(F)
    while (F.phase === 'playoffs') FR.playWeek(F, { moments: false })
    FR.closeSeason(F); FR.closeCarousel(F); FR.ageLeague(F)
    FR.openResign(F)
    for (const id of [...F.rs]) { const p = F.teams[team].r.find(x => x.i === id); FR.resignOne(F, id, FR.optionDue(p) ? (p.o >= 80 ? 'option' : 'decline') : p.b != null || p.o >= 76) }
    FR.openFA(F); while (F.fad) FR.nextFADay(F)
    FR.openDraft(F); FR.startNight(F)
    while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
    FR.closeDraft(F); FR.autoCamp(F); FR.newSeason(F)
  }
}
const avg = k => (all.reduce((a, s) => a + s[k], 0) / all.length).toFixed(2)
console.log(`\n${all.length} seasons: wins sd ${avg('sd')} (NFL ~3.1), best ${avg('best')} (NFL ~14), worst ${avg('worst')} (NFL ~3)`)
