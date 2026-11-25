// NBA Franchise, headless: a season's box-score balance against the real league's (2024-25).
//   bash scripts/franchise2/run.sh scripts/franchise2/nba-balance.mjs [seeds=s1,s2] [team=BOS]
// Per season: team totals a game, the scorers (20+ / 25+ / 30+ PPG among qualified men), triple-doubles and who gets
// them, the margins (30+ and 40+ games, the lowest score), overtime and home wins.
import * as N from '../../src/lib/franchise2/nba/index'
import { perGame } from '../../src/lib/franchise2/nba/stats'
import { TUNE } from '../../src/lib/franchise2/nba/game'
import { prof } from '../../src/lib/franchise2/nba/skills'
const SEEDS = (process.argv[2] ?? 's1,s2').split(','), TEAMX = process.argv[3] ?? 'BOS'
// (a tuning run: the dials to try, as JSON, e.g. '{"usage":0.12}'; "v" in the fifth place lists the scorers 11-50)
if (process.argv[4] && process.argv[4] !== '-') { const o = JSON.parse(process.argv[4]); for (const [k, v] of Object.entries(o)) TUNE[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...TUNE[k], ...v } : v; console.log('TUNE', JSON.stringify(o)) }
const VERBOSE = process.argv[5] === 'v'
const f1 = v => v.toFixed(1)
const sum = { td: 0, p20: 0, p25: 0, p30: 0, m30: 0, m40: 0, lo: 999, n: 0 }
for (const seed of SEEDS) {
  const t0 = Date.now()
  const F = N.createNbaFranchise({ seed, team: TEAMX, owner: 'T' })
  N.simTo(F, F.days)
  const games = F.sched.length, tg = games * 2
  const mg = F.sched.map(g => Math.abs(g.hs - g.as)), sc = F.sched.flatMap(g => [g.hs, g.as])
  const rows = Object.entries(F.ss).map(([i, l]) => ({ p: N.manOf(F, +i), l, g: perGame(l) })).filter(x => x.p)
  const q = rows.filter(x => x.l.gp >= 58)
  const T = {}; for (const k of ['pts', 'fga', 'fgm', 'tpa', 'tpm', 'fta', 'ast', 'reb', 'tov', 'stl', 'blk']) T[k] = rows.reduce((a, x) => a + (x.l[k] ?? 0), 0)
  const td = rows.reduce((a, x) => a + (x.l.td ?? 0), 0)
  const cnt = (k, v) => q.filter(x => x.g[k] >= v).length
  console.log(`\n== ${seed} (${Date.now() - t0} ms)`)
  console.log(`team/g: pts ${f1(T.pts / tg)} fga ${f1(T.fga / tg)} fg% ${f1(T.fgm / T.fga * 100)} 3pa ${f1(T.tpa / tg)} 3p% ${f1(T.tpm / T.tpa * 100)} fta ${f1(T.fta / tg)} ast ${f1(T.ast / tg)} reb ${f1(T.reb / tg)} tov ${f1(T.tov / tg)} stl ${f1(T.stl / tg)} blk ${f1(T.blk / tg)}`)
  console.log(`scorers: 30+ ${cnt('ppg', 30)}, 25+ ${cnt('ppg', 25)}, 20+ ${cnt('ppg', 20)} (real ~3 / 12-15 / ~40) · 10+ rpg ${cnt('rpg', 10)} (real ~12) · 8+ apg ${cnt('apg', 8)} (real ~8) · 10+ apg ${cnt('apg', 10)} (real 2-3)`)
  console.log(`triple-doubles ${td} (real 130-150), by ${rows.filter(x => x.l.td).length} men: ${rows.filter(x => x.l.td).sort((a, b) => b.l.td - a.l.td).slice(0, 14).map(x => `${x.p.n} ${x.p.p} ${x.l.td} (${x.g.ppg}/${x.g.rpg}/${x.g.apg})`).join(', ')}`)
  console.log(`PPG ${q.slice().sort((a, b) => b.g.ppg - a.g.ppg).slice(0, 10).map(x => `${x.p.n}(${x.p.o}) ${x.g.ppg}`).join(', ')}`)
  if (VERBOSE) console.log(`PPG 11-50 ${q.slice().sort((a, b) => b.g.ppg - a.g.ppg).slice(10, 50).map(x => `${x.p.n.split(' ').pop()} ${x.p.p} off${prof(x.p).off.toFixed(1)} ${x.g.mpg}m ${x.g.ppg}`).join(', ')}`)
  console.log(`APG ${q.slice().sort((a, b) => b.g.apg - a.g.apg).slice(0, 10).map(x => `${x.p.n} ${x.g.apg}`).join(', ')}`)
  console.log(`RPG ${q.slice().sort((a, b) => b.g.rpg - a.g.rpg).slice(0, 10).map(x => `${x.p.n} ${x.g.rpg}`).join(', ')}`)
  console.log(`margins: avg ${f1(mg.reduce((a, b) => a + b, 0) / games)}, within 5 ${Math.round(mg.filter(m => m <= 5).length / games * 100)}% (real ~27%), 20+ ${mg.filter(m => m >= 20).length} (real ~230), 30+ ${mg.filter(m => m >= 30).length} (real 60-70), 40+ ${mg.filter(m => m >= 40).length} (real 10-15), max ${Math.max(...mg)}`)
  console.log(`scores: min ${Math.min(...sc)}, under 80 ${sc.filter(x => x < 80).length}, under 90 ${sc.filter(x => x < 90).length}, 140+ ${sc.filter(x => x >= 140).length}, max ${Math.max(...sc)} · OT ${f1(F.sched.filter(g => g.ot).length / games * 100)}% (real ~6) · home ${f1(F.sched.filter(g => g.hs > g.as).length / games * 100)}% (real ~55)`)
  const R = N.records(F); console.log(`wins ${N.SHORTS.map(s => R[s].w).sort((a, b) => b - a).join(' ')}`)
  sum.td += td; sum.p20 += cnt('ppg', 20); sum.p25 += cnt('ppg', 25); sum.p30 += cnt('ppg', 30); sum.m30 += mg.filter(m => m >= 30).length; sum.m40 += mg.filter(m => m >= 40).length; sum.lo = Math.min(sum.lo, ...sc); sum.n++
}
console.log(`\nAVERAGE of ${sum.n}: triple-doubles ${f1(sum.td / sum.n)}, 20+ ${f1(sum.p20 / sum.n)}, 25+ ${f1(sum.p25 / sum.n)}, 30+ ${f1(sum.p30 / sum.n)}, margins 30+ ${f1(sum.m30 / sum.n)}, 40+ ${f1(sum.m40 / sum.n)}, lowest score ${sum.lo}`)
