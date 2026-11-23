// The team stats page's numbers (stats.js teamSeasonStats) against the NFL's: a season played, every team's
// numbers a game, the league's averages next to the NFL's typical ones, and one team's page as it would read.
//   bash scripts/franchise2/run.sh scripts/franchise2/team-stats-check.mjs [weeks=18] [team=DEN]
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'

const WK = Number(process.argv[2] ?? 18), TEAM = process.argv[3] ?? 'DEN'
FR.useContracts(CONTRACTS)
const F = FR.createFranchise({ seed: 'team-stats', team: TEAM, owner: 'Check', builds: [], coach: { name: 'Coach Reyes', style: 'developer', r: { talentDev: 7, offPlaycalling: 7, defPlaycalling: 5, culture: 6, situational: 6 } } })
while (F.phase === 'season' && F.wk < WK) { FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0) }
const NFL = { ppg: 21.8, ypg: 330, pypg: 215, rypg: 115, ypp: 6.9, ypc: 4.3, skd: 2.5, sks: 2.5, take: 1.3, give: 1.3 }
let bad = 0
const all = FR.SHORTS.map(s => FR.teamSeasonStats(F, s)).filter(Boolean)
console.log(`${all.length} teams after week ${F.wk}`)
for (const k of Object.keys(NFL)) {
  const vs = all.map(T => { const r = T.rows.find(x => x.k === k); return r ? (['skd', 'sks', 'take', 'give'].includes(k) ? r.v / T.g : r.v) : null }).filter(v => v != null)
  const avg = vs.reduce((a, v) => a + v, 0) / vs.length
  const off = Math.abs(avg - NFL[k]) / NFL[k] > 0.25
  if (off) bad++
  console.log(`${k.padEnd(5)} league ${avg.toFixed(1).padStart(6)}  NFL ~${NFL[k]}${off ? '   !! more than 25% off' : ''}`)
}
// the ranks: 1 to 32, each used, the best number first
for (const k of ['ppg', 'papg', 'diff']) {
  const ranks = all.map(T => T.rows.find(x => x.k === k)?.rank).sort((a, b) => a - b)
  if (ranks[0] !== 1) { bad++; console.log(`  !! ${k}: nobody ranks 1st`) }
}
const T = FR.teamSeasonStats(F, TEAM)
console.log(`\n${TEAM} after ${T.gp} games (${T.g} with box scores)`)
for (const r of T.rows) console.log(`  ${r.label.padEnd(32)} ${r.txt.padStart(6)}  ${r.rank}/${r.of}`)
for (const l of T.leaders) console.log(`  ${l.label.padEnd(14)} ${l.p.n.padEnd(22)} ${l.txt}`)
console.log(`\n${bad} problems`)
process.exit(bad ? 1 : 0)
