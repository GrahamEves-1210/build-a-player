// The game sim against the NFL's team game (2023-25 averages): points, touchdowns, field goals (tries, makes, how
// long), punts, turnovers, 4th-down tries, drives, overtime and ties, home wins. The 32 teams' year-one ratings
// (league.js strength: the same numbers the games play), random matchups.
//   bash scripts/franchise2/run.sh scripts/franchise2/game-stats.mjs [games=6000]
import { playGame } from '../../src/lib/franchise2/game'
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { seeded } from '../../src/lib/rng'

const N = Number(process.argv[2] ?? 6000)
const R = seeded('stats')
FR.useContracts(CONTRACTS)
const L = FR.createFranchise({ seed: 'stats', team: 'DEN', owner: 'G', builds: [] })
// (each team's kicker kicks: kick.js kickTraits, game.js fgChance)
const T = FR.SHORTS.map(short => ({ short, ...FR.strength(L, short), k: FR.kickTraits(L, FR.kickerOf(L, short)) }))
const sum = {}, add = (k, v) => { sum[k] = (sum[k] ?? 0) + v }
let hw = 0, ot = 0, tie = 0
for (let i = 0; i < N; i++) {
  const a = T[Math.floor(R() * T.length)], b = T[Math.floor(R() * T.length)]
  const S = playGame({ h: a.short, a: b.short, sh: { off: a.off, def: a.def }, sa: { off: b.off, def: b.def }, seed: `g${i}`, homeEdge: 0.9, k: { h: a.k, a: b.k } })
  for (const p of S.plays) if (p.k === 'fg') { add('made', 1); if (p.d >= 50) add('m50', 1); if (p.d >= 55) add('m55', 1); if (p.d >= 60) add('m60', 1) }
  for (const s of ['h', 'a']) { const kk = S.kk?.[s]; if (kk) { add('a50', kk[5]); add('k50', kk[6]) } }
  add('pts', S.hs + S.as)
  for (const s of ['h', 'a']) for (const [k, v] of Object.entries(S.ct[s])) add(k, v)
  add('fgm', S.plays.filter(p => p.k === 'fg').length)
  add('xp', S.plays.filter(p => p.k === 'td' && (p.tr === 'xp' || p.tr === 'xpx')).length)
  add('xpm', S.plays.filter(p => p.k === 'td' && p.tr === 'xp').length)
  if (S.hs > S.as) hw++; if (S.ot) ot++; if (S.tie) tie++
}
const g = k => (sum[k] ?? 0) / N / 2
const row = (label, v, nfl) => console.log(`${label.padEnd(26)} ${v.padStart(7)}   NFL ${nfl}`)
row('points / team game', g('pts').toFixed(1), '~22.5')
row('touchdowns', g('td').toFixed(2), '~2.5')
row('field goal tries', g('fga').toFixed(2), '~1.9')
row('field goals made', g('fgm').toFixed(2), '~1.6')
row('field goal %', (100 * sum.fgm / sum.fga).toFixed(1), '~85')
const kb = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].map(k => sum[k] ?? 0), kt = kb.reduce((x, y) => x + y, 0)
console.log(`   tries by range: under 30 ${(100 * (kb[0] + kb[1]) / kt).toFixed(0)}%, 30-39 ${(100 * kb[2] / kt).toFixed(0)}%, 40-49 ${(100 * kb[3] / kt).toFixed(0)}%, 50-59 ${(100 * kb[4] / kt).toFixed(0)}%, 60+ ${(100 * kb[5] / kt).toFixed(1)}%   NFL ~18 / 29 / 31 / 21 / under 1`)
console.log(`   made by range: 50+ ${(100 * sum.m50 / sum.made).toFixed(1)}%, 55+ ${(100 * sum.m55 / sum.made).toFixed(1)}%, 60+ ${(100 * sum.m60 / sum.made).toFixed(1)}% (NFL: about 20%, 5%, 1%)`)
row('50+ make %', (100 * sum.k50 / sum.a50).toFixed(1), '~70')
row('extra points %', (100 * sum.xpm / sum.xp).toFixed(1), '~95.5')
row('punts', g('punt').toFixed(2), '~3.9')
row('turnovers', g('to').toFixed(2), '~1.2')
row('4th-down tries', g('go').toFixed(2), '~1.2')
row('turned over on downs', g('downs').toFixed(2), '~0.55')
row('drives', g('dr').toFixed(1), '~10.5-11')
row('home wins %', (100 * hw / N).toFixed(1), '~54')
row('overtime %', (100 * ot / N).toFixed(1), '~5-6')
row('ties %', (100 * tie / N).toFixed(2), '~0.3')
