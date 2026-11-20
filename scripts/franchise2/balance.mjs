// The league's talent over many seasons (potential.js, aging.js, carousel.js): does it hold, do stars stay stars,
// do a few unknowns break out each year, how do the positions age, how do the coaches move.
//   bash scripts/franchise2/run.sh scripts/franchise2/balance.mjs [seasons=12] [seed=bal]
// Sim only (no moments, the user's calls automatic, his deals kept at the ask). Prints the tables and a verdict.
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'

const N = Number(process.argv[2] ?? 12), SEED = process.argv[3] ?? 'bal'
FR.useContracts(CONTRACTS)
const F = FR.createFranchise({ seed: SEED, team: 'CHI', owner: 'G', builds: [], coach: { name: 'Test Coach', style: 'developer', r: { talentDev: 6, offPlaycalling: 6, defPlaycalling: 6, culture: 6, situational: 6 }, ovr: 76 } })
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const all = () => FR.SHORTS.flatMap(s => F.teams[s].r)
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const f1 = v => (Math.round(v * 10) / 10).toFixed(1)
const GROUPS = ['qb', 'rb', 'wr', 'te', 'ol', 'dl', 'lb', 'db']

// per year: the league's numbers
const years = []
// age curves: OVR change in one offseason, by group and age (starters and backups alike)
const dByAge = {}   // g -> age -> [sum, n]
const oByAge = {}   // g -> age -> [sum, n] (OVR at that age, starters only)
// stars: every man's years at 90+, followed
const starYears = new Map()   // id -> { n, first, last, name, pos }
const breakouts = [], jumps = [], huge = []   // [year, name, pos, age, from, to]
const coachRows = []
function snap(label) {
  const men = all()
  const st = FR.SHORTS.flatMap(s => Object.values(FR.lineup(F.teams[s])))
  const coaches = FR.SHORTS.map(s => FR.staffMen(F, s)).flatMap(M => [['hc', M.hc], ['oc', M.oc], ['dc', M.dc]]).filter(([, c]) => c && Array.isArray(c.r) && !c.mine)
  const grades = {}
  for (const [k, c] of coaches) { const g = FR.coachGrade(FR.rOf(c), k); grades[g] = (grades[g] ?? 0) + 1 }
  const r = {
    y: label, all: avg(men.map(p => p.o)), st: avg(st.map(p => p.o)), n90: men.filter(p => p.o >= 90).length, n95: men.filter(p => p.o >= 95).length, n99: men.filter(p => p.o >= 99).length,
    n85: men.filter(p => p.o >= 85).length, age: avg(st.map(p => p.ag)), men: men.length,
    hcMean: avg(coaches.filter(([k]) => k === 'hc').map(([, c]) => avg(c.r))), coMean: avg(coaches.filter(([k]) => k !== 'hc').map(([, c]) => avg(c.r))),
    grades, cAge: avg(coaches.map(([, c]) => c.ag)),
    qb85: men.filter(p => p.p === 'qb' && p.o >= 85).length,
  }
  years.push(r)
  for (const p of st) { const g = p.p; const a = (oByAge[g] ??= {}); (a[p.ag] ??= [0, 0]); a[p.ag][0] += p.o; a[p.ag][1]++ }
  for (const p of men) if (p.o >= 90) { const s = starYears.get(p.i) ?? { n: 0, first: label, name: p.n, pos: p.p }; s.n++; s.last = label; starYears.set(p.i, s) }
  return r
}
const t0 = performance.now()
snap(F.year)
for (let y = 0; y < N; y++) {
  FR.simWeeks(F); FR.intoPlayoffs(F); FR.simPlayoffs(F); FR.closeSeason(F); FR.closeCarousel(F)
  const before = new Map(all().map(p => [p.i, { o: p.o, ag: p.ag, n: p.n, p: p.p }]))
  FR.ageLeague(F)
  for (const p of all()) {
    const b = before.get(p.i)
    if (!b) continue
    const d = p.o - b.o, g = p.p
    const a = (dByAge[g] ??= {}); (a[p.ag] ??= [0, 0]); a[p.ag][0] += d; a[p.ag][1]++
    // a breakout: a man nobody had as a starter (under 78), past his rookie years (24+), who comes back from one
    // offseason a quality starter (83+); a jump: anyone 25 or older up 6 or more
    if (b.o < 78 && p.o >= 83 && p.ag >= 24) breakouts.push([F.year, p.n, p.p, p.ag, b.o, p.o])
    if (d >= 6 && p.ag >= 25) jumps.push([F.year, p.n, p.p, p.ag, b.o, p.o])
    if (d >= 9) huge.push([F.year, p.n, p.p, p.ag, b.o, p.o])
  }
  FR.openResign(F)
  for (const id of [...F.rs]) { const p = F.teams[F.team].r.find(x => x.i === id); FR.resignOne(F, id, FR.optionDue(p) ? (p.o >= 80 ? 'option' : 'decline') : p.o >= 76 && FR.canSign(F, FR.resignAsk(p, F).$)) }
  FR.openFA(F); while (F.fad) FR.nextFADay(F)
  FR.openDraft(F); FR.startNight(F); while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  FR.closeDraft(F)
  FR.autoCamp(F); FR.newSeason(F)
  const r = snap(F.year)
  console.log(`${r.y}: all ${f1(r.all)} · starters ${f1(r.st)} · 85+ ${r.n85} · 90+ ${r.n90} · 95+ ${r.n95} · 99 ${r.n99} · QB 85+ ${r.qb85} · starters' age ${f1(r.age)} · men ${r.men} · coaches HC ${f1(r.hcMean)} coord ${f1(r.coMean)} age ${f1(r.cAge)} · ${((performance.now() - t0) / (y + 1) / 1000).toFixed(1)} s/season`)
}
const Y0 = years[0]
console.log('\nOVR BY YEAR (league average, all men / starters; 90+; 99s)')
console.log(years.map(r => `${r.y} ${f1(r.all)}/${f1(r.st)} ${r.n90} ${r.n99}`).join(' | '))
console.log('\nCOACH GRADES BY YEAR (every HC, OC, DC in the league, as the letter the screens show)')
const LET = ['S', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'D-', 'F']
for (const r of years) console.log(`${r.y}: ` + LET.filter(l => r.grades[l]).map(l => `${l} ${r.grades[l]}`).join(' · '))
console.log('\nAGE CURVES: average OVR change in an offseason, by age (all men) | average OVR of starters at that age')
for (const g of GROUPS) {
  const a = dByAge[g] ?? {}, o = oByAge[g] ?? {}
  const ages = Object.keys(a).map(Number).filter(x => a[x][1] >= 8).sort((x, y) => x - y)
  console.log(`${g.toUpperCase().padEnd(3)} ` + ages.map(x => `${x}:${a[x][0] / a[x][1] >= 0 ? '+' : ''}${f1(a[x][0] / a[x][1])}${o[x]?.[1] >= 5 ? `/${Math.round(o[x][0] / o[x][1])}` : ''}`).join(' '))
}
console.log('\nSTARS: years at 90+ for the men who got there (the whole run)')
const spans = [...starYears.values()]
const hist = {}
for (const s of spans) hist[Math.min(8, s.n)] = (hist[Math.min(8, s.n)] ?? 0) + 1
console.log(Object.entries(hist).map(([n, c]) => `${n === '8' ? '8+' : n} yr: ${c}`).join(' · '))
const opening90 = spans.filter(s => s.first === Y0.y)
console.log(`the ${opening90.length} men 90+ in ${Y0.y}: still 90+ after 3 years ${opening90.filter(s => s.last >= Y0.y + 3).length}, after 5 ${opening90.filter(s => s.last >= Y0.y + 5).length}, after 8 ${opening90.filter(s => s.last >= Y0.y + 8).length}`)
console.log('\nBREAKOUTS (24 or older, under 78, back as an 83+ after one offseason): a year', f1(breakouts.length / N), '· jumps of 6+ at 25 or older a year', f1(jumps.length / N), '· jumps of 9+ (any age)', huge.length)
const byY = {}
for (const b of breakouts) (byY[b[0]] ??= []).push(b)
for (const [y, list] of Object.entries(byY)) console.log(`${y}: ${list.length} · ` + list.slice(0, 5).map(b => `${b[1]} ${b[2].toUpperCase()} ${b[3]} ${b[4]}→${b[5]}`).join(', '))
// the verdict: the league holds
const late = years.slice(-4)
const m = avg(late.map(r => r.all)), n90 = avg(late.map(r => r.n90))
if (Math.abs(m - Y0.all) > 1.5) bad(`league average ${f1(m)} in the last 4 years vs ${f1(Y0.all)} at the start`)
if (n90 < Y0.n90 * 0.6 || n90 > Y0.n90 * 1.5) bad(`90+ men ${f1(n90)} in the last 4 years vs ${Y0.n90} at the start`)
if (Math.max(...years.slice(1).map(r => r.n99)) > Y0.n99 + 2) bad(`${Math.max(...years.map(r => r.n99))} men at 99 in one year (${Y0.n99} at the start)`)
const bpy = breakouts.length / N
if (bpy < 1 || bpy > 8) bad(`${f1(bpy)} breakouts a year`)
if (huge.length) bad(`${huge.length} men up 9 or more in one offseason`)
const hcM = avg(late.map(r => r.hcMean)), coM = avg(late.map(r => r.coMean))
if (Math.abs(hcM - Y0.hcMean) > 0.6 || Math.abs(coM - Y0.coMean) > 0.6) bad(`coaches drift: HC ${f1(Y0.hcMean)} -> ${f1(hcM)}, coordinators ${f1(Y0.coMean)} -> ${f1(coM)}`)
console.log(problems.length ? `\n${problems.length} PROBLEMS` : '\nOK: the league holds')
