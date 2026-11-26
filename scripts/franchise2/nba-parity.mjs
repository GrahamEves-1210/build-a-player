// NBA Franchise: the league over a long run, the way the real NBA looks. Seasons auto-run (the GM's team too); per
// season the champion, the scoring leader (age, ppg) and the top ten scorers' ages, the men 35 and older who scored
// 20+, the best free agent on the market the day free agency opens, and the league's trades with each side's value
// (trades.js manValue, as the log keeps it). The last lines: titles by team, the most by one team, the scoring
// leaders' ages, the oldest 20-point scorers, the free agents, the most lopsided league trade.
//   FR_TMP=<dir> bash scripts/franchise2/run.sh scripts/franchise2/nba-parity.mjs [seasons=12] [seed=a] [team=CHA] [quiet]
import * as N from '../../src/lib/franchise2/nba/index'
const Y = +(process.argv[2] ?? 12), SEED = process.argv[3] ?? 'a', TEAMX = process.argv[4] ?? 'CHA', QUIET = process.argv[5] === 'quiet'
const F = N.createNbaFranchise({ seed: SEED.startsWith('=') ? SEED.slice(1) : 'par-' + SEED, team: TEAMX, owner: 'G' })
const log = (...m) => { if (!QUIET) console.log(...m) }
const champs = [], leaders = [], old20 = [], fas = [], trades = [], stars = {}
const t0 = Date.now()
const man = new Map(), wasOf = new Map()
let bestWon = 0
const WATCH = ['Stephen Curry', 'LeBron James', 'Kevin Durant', 'James Harden', 'Nikola Jokic', 'Giannis Antetokounmpo', 'Shai Gilgeous-Alexander', 'Victor Wembanyama']
for (let y = 0; y < Y; y++) {
  N.simTo(F, F.days)
  // the season's scorers (58+ games)
  const all = N.SHORTS.flatMap(s => F.teams[s].r.map(p => [p, s]))
  for (const [p] of all) man.set(p.i, p)
  const rows = all.map(([p, s]) => { const l = F.ss[p.i]; return l && l.gp >= 58 ? { n: p.n, ag: p.ag, o: p.o, s, ppg: l.pts / l.gp, mpg: l.min / l.gp } : null }).filter(Boolean).sort((a, b) => b.ppg - a.ppg)
  const L = rows[0]
  leaders.push(L)
  const t10 = rows.slice(0, 10)
  for (const r of rows.filter(r => r.ag >= 35 && r.ppg >= 20)) old20.push({ ...r, y: F.year })
  for (const [p] of all) if (WATCH.includes(p.n)) { const l = F.ss[p.i]; (stars[p.n] ??= []).push(`${p.ag}:${p.o}/${l?.gp ? (l.pts / l.gp).toFixed(1) : '-'}`) }
  N.startPostseason(F); N.simPostseason(F)
  const c = F.po.champ
  champs.push(c)
  { const R = N.records(F), best = N.SHORTS.slice().sort((a, b) => R[b].w - R[a].w)[0]; if (best === c) bestWon++ }
  const core = s => F.teams[s].r.slice().sort((a, b) => b.o - a.o).slice(0, 4).map(p => `${p.n.split(' ').pop()} ${p.o}/${p.ag}`).join(', ')
  log(`${F.year} champ ${c} [${core(c)} · $${N.CAP_SIM.payroll(F, c, F.year).toFixed(0)}] | leader ${L.n} ${L.ag} (${L.o}) ${L.ppg.toFixed(1)} | top ten ages ${t10.map(r => r.ag).join(' ')} | 35+ at 20+: ${rows.filter(r => r.ag >= 35 && r.ppg >= 20).map(r => `${r.n} ${r.ag} ${r.ppg.toFixed(1)}`).join(', ') || 'none'}`)
  N.closeSeason(F)
  while (F.phase === 'off') {
    if (F.off.step === 'fa' && !F.off.faSeen) {
      // (the market after the first morning: the men the league's teams kept are off it)
      F.off.faSeen = 1
      wasOf.clear(); for (const p of F.fa ?? []) wasOf.set(p.i, p.was ?? p.fr)
      N.CAP_SIM.faDay(F, 1)
      const best = (F.fa ?? []).slice().sort((a, b) => b.o - a.o)
      fas.push({ y: F.year + 1, top: best[0]?.o ?? 0, n80: best.filter(p => p.o >= 80).length, n85: best.filter(p => p.o >= 85).length, best: best.slice(0, 3).map(p => `${p.n} ${p.o}/${p.ag}${p.rfa ? ' (R)' : ''}`) })
      log(`   ${F.year + 1} free agents after day one: ${best.slice(0, 6).map(p => `${p.n} ${p.o}/${p.ag}${p.rfa ? ' RFA' : ''} was ${p.was ?? p.fr ?? '?'}`).join(', ')}`)
    }
    if (F.off.step === 'camp' && !F.off.moved) {
      // (the summer's moves: men 80+ who signed with a new team in free agency)
      F.off.moved = 1
      const mv = [...wasOf].map(([i, w]) => { const s = N.SHORTS.find(t => F.teams[t].r.some(x => x.i === i)), p = s && F.teams[s].r.find(x => x.i === i); return p && w && w !== s && p.o >= 80 ? `${p.n} ${p.o} ${w}>${s}` : null }).filter(Boolean)
      fas.at(-1).moved = mv
      log(`   moved in free agency (80+): ${mv.join(', ') || 'none'}`)
    }
    if (F.off.step === 'camp') {
      const T = F.teams[F.team]
      while (T.r.filter(p => !p.tw).length > 15) N.CAP_SIM.cutMan(F, F.team, T.r.filter(p => !p.tw).sort((a, b) => a.o - b.o)[0].i)
      for (const p of N.minPool(F)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) }
    }
    N.nextStep(F)
  }
  for (const d of F.trl ?? []) if (!d.u && !d.seen) { d.seen = 1; trades.push(d) }
}
const cnt = {}
for (const c of champs) cnt[c] = (cnt[c] ?? 0) + 1
const mean = a => a.reduce((x, v) => x + v, 0) / (a.length || 1)
console.log(`PARITY par-${SEED} ${Y} seasons: titles ${JSON.stringify(cnt)} · most ${Math.max(...Object.values(cnt))} · champions ${Object.keys(cnt).length} · best record won it ${bestWon}`)
console.log(`  scoring leaders: ages ${leaders.map(l => l.ag).join(' ')} (mean ${mean(leaders.map(l => l.ag)).toFixed(1)}), ppg ${leaders.map(l => l.ppg.toFixed(1)).join(' ')}`)
console.log(`  35+ at 20+ ppg: ${old20.length} (${old20.map(r => `${r.y} ${r.n} ${r.ag} ${r.ppg.toFixed(1)}`).join('; ')})`)
console.log(`  37+ at 20+ ppg: ${old20.filter(r => r.ag >= 37).length}`)
for (const [n, v] of Object.entries(stars)) console.log(`  ${n}: ${v.join(' ')}`)
console.log(`  best free agent each summer: ${fas.map(f => f.best[0]).join(' · ')}`)
console.log(`  free agents after day one: best ${fas.map(f => f.top).join(' ')}; 80+ ${mean(fas.map(f => f.n80)).toFixed(1)} a summer, 85+ ${mean(fas.map(f => f.n85)).toFixed(1)}; 80+ who changed teams ${mean(fas.map(f => f.moved?.length ?? 0)).toFixed(1)} a summer`)
// (a trade's imbalance by the engine's own values, trades.js gauge as the log keeps it: the gap between what the two
// sides give, over the bigger of them (8 at least: two end-of-bench men for each other aren't lopsided))
const lop = trades.map(d => ({ d, r: Math.abs(d.gv[0] - d.gv[1]) / Math.max(8, d.gv[0], d.gv[1]) })).sort((a, b) => b.r - a.r)
const two = trades.filter(d => /pick/.test(d.t) && ((d.t.split(' for ')[1] ?? '').match(/first-round/g)?.length >= 2 || (d.t.split(' for ')[0] ?? '').match(/first-round/g)?.length >= 2))
console.log(`  league trades: ${trades.length} (${trades.filter(d => d.k === 'sell').length} salary moves), imbalance median ${(lop[Math.floor(lop.length / 2)]?.r ?? 0).toFixed(2)}, over 0.5: ${lop.filter(x => x.r > 0.5).length}; two firsts or more one way: ${two.length}`)
for (const { d, r } of lop.slice(0, 4)) console.log(`    ${r.toFixed(2)} ${d.y}${d.k ? ` (${d.k})` : ''} values ${d.gv.join(' / ')}: ${d.t}`)
for (const d of two.slice(0, 4)) console.log(`    two firsts ${d.y}${d.k ? ` (${d.k})` : ''} values ${d.gv.join(' / ')}: ${d.t}`)
console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`)
