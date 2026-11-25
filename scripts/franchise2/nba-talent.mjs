// NBA Franchise: the league's talent over a long run. Seasons auto-run (the GM re-signs his men 72+, fills at camp);
// each year the count of 90+, 85+ and 80+ men, the men 35 and older, the worst CPU record, duplicate names, and the
// summer's rating change by age. The last lines say how far the counts drifted from where the league starts.
//   FR_TMP=... bash scripts/franchise2/run.sh scripts/franchise2/nba-talent.mjs [seasons=20] [seed=q4] [team=CHA] [quiet]
import * as N from '../../src/lib/franchise2/nba/index'
const Y = +(process.argv[2] ?? 20), SEED = process.argv[3] ?? 'q4', TEAMX = process.argv[4] ?? 'CHA', QUIET = process.argv[5] === 'quiet'
const F = N.createNbaFranchise({ seed: SEED, team: TEAMX, owner: 'QA' })
const rostered = () => N.SHORTS.flatMap(s => F.teams[s].r)
const all = () => [...rostered(), ...(F.fa ?? [])]
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1)
const rows = [], worst = [], issues = []
const prevO = new Map()
const dev = {}
const t0 = Date.now()
for (let y = 0; y < Y; y++) {
  const men = rostered(), o = men.map(p => p.o), ag = men.map(p => p.ag)
  const row = { y: F.year, n90: o.filter(v => v >= 90).length, n85: o.filter(v => v >= 85).length, n80: o.filter(v => v >= 80).length, a35: ag.filter(v => v >= 35).length, age: mean(ag), max: Math.max(...o) }
  rows.push(row)
  const names = new Map()
  for (const p of all()) names.set(p.n, (names.get(p.n) ?? 0) + 1)
  const dup = [...names].filter(([, c]) => c > 1).map(x => x[0])
  if (dup.length) issues.push(`${F.year}: duplicate names ${dup.join(', ')}`)
  N.simTo(F, F.days)
  const R = N.records(F)
  const cpu = N.SHORTS.filter(s => s !== F.team).sort((a, b) => R[a].w - R[b].w)
  const w = cpu[0]
  worst.push(R[w].w)
  const top = cpu[cpu.length - 1]
  if (!QUIET) console.log(`${row.y} | 90+ ${row.n90} 85+ ${row.n85} 80+ ${row.n80} max ${row.max} | 35+ ${row.a35} age ${row.age.toFixed(1)} | worst CPU ${w} ${N.recText(R[w])} (ovr ${N.teamOvr(F, w)}, ${F.teams[w].r.filter(p => !p.gn && !p.fl).length} real or drafted) best ${top} ${N.recText(R[top])} | GM ${N.recText(R[F.team])}`)
  N.startPostseason(F); N.simPostseason(F); N.closeSeason(F)
  let guard = 0
  while (F.phase === 'off' && guard++ < 20) {
    const st = F.off.step
    if (st === 'resign') {
      for (const p of all()) if (prevO.has(p.i)) { const k = p.ag <= 22 ? '<=22' : p.ag <= 25 ? '23-25' : p.ag <= 29 ? '26-29' : p.ag <= 32 ? '30-32' : p.ag <= 35 ? '33-35' : '36+'; (dev[k] ??= []).push(p.o - prevO.get(p.i)) }
      for (const id of [...(F.off.mine ?? [])]) { const p = F.fa.find(x => x.i === id); if (p && p.o >= 72) N.resignMine(F, id, true) }
    }
    if (st === 'camp') {
      const T = F.teams[F.team]
      while (T.r.filter(p => !p.tw).length > 15) N.CAP_SIM.cutMan(F, F.team, T.r.filter(p => !p.tw && p.b == null).sort((a, b) => a.o - b.o)[0].i)
      for (const p of N.minPool(F)) { if (T.r.filter(x => !x.tw).length >= 14) break; N.signMin(F, p.i) }
      const ck = N.campCheck(F)
      if (!ck.ok) issues.push(`${F.year} camp not legal: ${ck.why}`)
    }
    N.nextStep(F)
  }
  if (F.phase !== 'season') { issues.push(`${F.year} stuck in the offseason at ${F.off?.step}`); break }
  for (const p of all()) prevO.set(p.i, p.o)
}
const r0 = rows[0], late = rows.slice(5)
const rng = k => `${Math.min(...late.map(r => r[k]))}-${Math.max(...late.map(r => r[k]))} (mean ${mean(late.map(r => r[k])).toFixed(0)})`
console.log(`seed ${SEED} ${TEAMX}, ${Y} seasons`)
console.log(`  start: 90+ ${r0.n90}, 85+ ${r0.n85}, 80+ ${r0.n80}, 35+ ${r0.a35}`)
console.log(`  seasons 6-${Y}: 90+ ${rng('n90')}, 85+ ${rng('n85')}, 80+ ${rng('n80')}, 35+ ${rng('a35')}`)
console.log(`  summer change by age (new age): ${['<=22', '23-25', '26-29', '30-32', '33-35', '36+'].map(k => `${k} ${mean(dev[k] ?? []).toFixed(2)}`).join(' | ')}`)
console.log(`  worst CPU wins a season: min ${Math.min(...worst)}, mean ${mean(worst).toFixed(1)}, under 12: ${worst.filter(v => v < 12).length} of ${worst.length}, under 15: ${worst.filter(v => v < 15).length}`)
console.log(`  issues ${issues.length}`); for (const x of issues.slice(0, 30)) console.log('   -', x)
console.log(`  ${((Date.now() - t0) / 1000).toFixed(0)}s`)
