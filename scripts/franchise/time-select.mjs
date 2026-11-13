// How long the selectors a screen calls take (median of 15 calls, after a season has been played).
//   bash scripts/franchise/run.sh scripts/franchise/time-select.mjs
import * as FR from '../../src/lib/franchise/index'

let F = FR.createFranchise({ team: 'DEN', gmName: 'Graham', seed: 'time-select' })
for (let i = 0; i < 10; i++) F = FR.autopilot(F, { until: 'week' })
const pid = FR.roster(F)[0].id
const calls = {
  hub: () => FR.hub(F), weekTasks: () => FR.weekTasks(F), pregame: () => FR.pregame(F), roster: () => FR.roster(F), depthChart: () => FR.depthChart(F), playerCard: () => FR.playerCard(F, pid),
  capSheet: () => FR.capSheet(F), teamNeeds: () => FR.teamNeeds(F), standings: () => FR.standings(F), playoffPicture: () => FR.playoffPicture(F), leaders: () => FR.leaders(F), teamStats: () => FR.teamStats(F),
  awardRaces: () => FR.awardRaces(F), news: () => FR.news(F), powerRankings: () => FR.powerRankings(F), history: () => FR.history(F), tradeBlock: () => FR.tradeBlock(F), tradeAssets: () => FR.tradeAssets(F, F.team),
  teamState: () => FR.teamState(F), leagueStates: () => FR.leagueStates(F), teamInfo: () => FR.teamInfo(F, 'KC'), draftBoard: () => FR.draftBoard(F), freeAgents: () => FR.freeAgents(F), scoutingReport: () => FR.scoutingReport(F),
  staff: () => FR.staff(F), schedule: () => FR.schedule(F), ownerView: () => FR.ownerView(F), packFranchise: () => FR.packFranchise(F),
}
const out = []
for (const [k, f] of Object.entries(calls)) {
  const t = []
  for (let i = 0; i < 15; i++) { const a = performance.now(); f(); t.push(performance.now() - a) }
  t.sort((a, b) => a - b)
  out.push([k, t[7], t[0], t[14]])
}
out.sort((a, b) => b[1] - a[1])
for (const [k, med, lo, hi] of out) console.log(k.padEnd(16), med.toFixed(2).padStart(7), 'ms   (best', lo.toFixed(2), ', first/worst', hi.toFixed(1) + ')')
