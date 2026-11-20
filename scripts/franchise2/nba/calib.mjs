// One season of games, no injuries or aging: the box score's league-wide numbers against the 2024-25 NBA.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba/calib.mjs [seasons=1]
import { makeLeague, schedule, SHORTS } from './league.mjs'
import { simGame } from '../../../src/lib/franchise2/nba/game'
import { recordGame, leadersIn, teamSeason, perGame } from '../../../src/lib/franchise2/nba/stats'
const N = +(process.argv[2] ?? 1)
const t0 = performance.now()
const names = {}
for (let y = 0; y < N; y++) {
  const F = makeLeague('calib' + y)
  for (const T of Object.values(F.teams)) for (const p of T.r) names[p.i] = `${p.n} ${T.s} ${p.o}`
  const res = []
  let home = 0
  for (const g of schedule('calib' + y, 2026)) {
    F.day = g.d
    const r = simGame(F, g.h, g.a, { seed: `${y}-${g.d}-${g.h}` })
    recordGame(F, g, r); res.push({ ...r, h: g.h, a: g.a }); home += r.hs - r.as
  }
  const T = teamSeason(res), L = Object.values(T)
  const avg = k => (L.reduce((s, t) => s + t[k] / t.g, 0) / L.length).toFixed(1)
  const W = L.map(t => t.w).sort((a, b) => b - a)
  console.log(`PPG ${avg('pts')} pace ${(L.reduce((s, t) => s + t.pace, 0) / 30).toFixed(1)} FGA ${avg('fga')} FG% ${(L.reduce((s, t) => s + t.fgm, 0) / L.reduce((s, t) => s + t.fga, 0) * 100).toFixed(1)} 3PA ${avg('tpa')} 3P% ${(L.reduce((s, t) => s + t.tpm, 0) / L.reduce((s, t) => s + t.tpa, 0) * 100).toFixed(1)} FTA ${avg('fta')} FT% ${(L.reduce((s, t) => s + t.ftm, 0) / L.reduce((s, t) => s + t.fta, 0) * 100).toFixed(1)}`)
  console.log(`ORB ${avg('oreb')} REB ${avg('reb')} AST ${avg('ast')} STL ${avg('stl')} BLK ${avg('blk')} TOV ${avg('tov')} PF ${avg('pf')} home margin ${(home / res.length).toFixed(2)} home win ${(res.filter(r => r.hs > r.as).length / res.length * 100).toFixed(1)}% OT ${res.filter(r => r.ot).length}`)
  console.log('wins', W.join(' '))
  console.log('team ppg range', Math.min(...L.map(t => t.ppg)), Math.max(...L.map(t => t.ppg)))
  for (const k of ['ppg', 'rpg', 'apg', 'spg', 'bpg', 'tpm', 'mpg']) console.log(k.padEnd(4), leadersIn(F.ss, k, { n: 5 }).map(r => `${names[r.i]}: ${r.v}`).join(' | '))
  console.log('30+ ppg:', leadersIn(F.ss, 'ppg', { n: 30 }).filter(r => r.v >= 30).length, ' 25+:', leadersIn(F.ss, 'ppg', { n: 60 }).filter(r => r.v >= 25).length, ' 20+:', leadersIn(F.ss, 'ppg', { n: 90 }).filter(r => r.v >= 20).length)
  // minutes shape: per team, sorted mpg of the top 10
  const byT = {}
  for (const [id, r] of Object.entries(F.ss)) (byT[r.s] ??= []).push(perGame(r).mpg * r.gp / 82)
  const shape = Array.from({ length: 11 }, (_, j) => (SHORTS.reduce((s, t) => s + ((byT[t] ?? []).sort((a, b) => b - a)[j] ?? 0), 0) / 30).toFixed(1))
  console.log('min by slot', shape.join(' '))
}
console.log(`${((performance.now() - t0) / 1000).toFixed(1)}s`)
