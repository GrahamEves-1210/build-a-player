// Several seasons headless, watching what players reported (2026-11-19): free-agent signings kept through the
// draft and the cut-down, a year of age a season, who retires (by spot, age and rating), the rushing leaders, the
// user's roster at each step, and where Malik Willis is.
//   bash scripts/franchise2/run.sh scripts/franchise2/frfix-probe.mjs [seasons=4] [team=MIA] [moments=1]
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'

const N = Number(process.argv[2] ?? 4), team = process.argv[3] ?? 'MIA', moments = process.argv[4] !== '0'
console.log(`real contracts: ${FR.useContracts(CONTRACTS)}`)
const F = FR.createFranchise({ seed: 'frfix-' + team, team, owner: 'Graham', builds: [] })
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const where = n => { for (const s of FR.SHORTS) { const p = F.teams[s].r.find(x => x.n === n); if (p) return `${s} age ${p.ag} OVR ${p.o}` } const f = (F.fa ?? []).find(x => x.n === n); return f ? `free agent age ${f.ag}` : 'gone' }
const WATCH = ['Malik Willis', 'Jacob Rodriguez', 'Carson Schwesinger', 'Saquon Barkley', 'Jonathan Taylor', 'Ashton Jeanty', 'Derrick Henry']
console.log('start:', WATCH.map(n => `${n}: ${where(n)}`).join(' · '))
const roomTxt = () => { const r = F.teams[team].r; return FR.POS.map(p => `${p.toUpperCase()} ${r.filter(x => x.p === p && !x.fl).length}`).join(' ') + ` (${r.length} men, ${r.filter(x => x.fl).length} fillers)` }
const retire = {}   // `${pos}|${ageBand}|${start?}` -> [men, retired]
const band = a => (a <= 26 ? '≤26' : a <= 29 ? '27-29' : a <= 31 ? '30-31' : a <= 33 ? '32-33' : '34+')
const ageJumps = []
const rush = []
for (let y = 0; y < N; y++) {
  console.log(`\n== ${F.year} season · ${team} ${roomTxt()}`)
  while (F.phase === 'season') { const r = FR.playWeek(F, { moments }); if (r.pending) while (F.pend) FR.finishMoment(F, null); if (F.ev) FR.chooseEvent(F, 0) }
  const tot = FR.leagueStats(F)
  const men = FR.SHORTS.flatMap(s => F.teams[s].r.map(p => ({ p, s })))
  const top = men.filter(({ p }) => p.p === 'rb').map(({ p, s }) => ({ n: p.n, s, o: p.o, ry: tot[p.i]?.ry ?? 0, td: tot[p.i]?.rtd ?? 0 })).sort((a, b) => b.ry - a.ry).slice(0, 5)
  const tdTop = men.map(({ p, s }) => ({ n: p.n, s, td: tot[p.i]?.rtd ?? 0 })).sort((a, b) => b.td - a.td)[0]
  rush.push({ y: F.year, top, tdTop })
  { const tm = FR.SHORTS.map(s => F.teams[s].r.reduce((a, p) => a + (tot[p.i]?.rtd ?? 0), 0)), ptd = FR.SHORTS.map(s => F.teams[s].r.reduce((a, p) => a + (tot[p.i]?.ptd ?? 0), 0))
    const rbs = men.filter(({ p }) => p.p === 'rb').map(({ p }) => tot[p.i]?.rtd ?? 0).sort((a, b) => b - a)
    const qbTop = men.filter(({ p }) => p.p === 'qb').map(({ p }) => tot[p.i]?.ptd ?? 0).sort((a, b) => b - a)
    console.log(`team rushing TDs avg ${(tm.reduce((a, b) => a + b, 0) / 32).toFixed(1)} (passing ${(ptd.reduce((a, b) => a + b, 0) / 32).toFixed(1)}) · backs' rushing TDs, top ten: ${rbs.slice(0, 10).join(' ')} · 15+: ${rbs.filter(x => x >= 15).length} · passers' top five: ${qbTop.slice(0, 5).join(' ')}`) }
  console.log(`rushing: ${top.map(x => `${x.n} (${x.s} ${x.o}) ${x.ry} yds ${x.td} TD`).join(' · ')} | most rushing TDs ${tdTop.n} ${tdTop.td}`)
  FR.intoPlayoffs(F)
  while (F.phase === 'playoffs') { const r = FR.playWeek(F, { moments }); if (r.pending) while (F.pend) FR.finishMoment(F, null) }
  FR.closeSeason(F); FR.closeCarousel(F)
  // before the league ages: every man, his age, rating and whether he starts
  const starters = new Set(FR.SHORTS.flatMap(s => Object.values(FR.lineup(F.teams[s])).map(p => p.i)))
  const before = new Map(FR.SHORTS.flatMap(s => F.teams[s].r.filter(p => !p.fl).map(p => [p.i, { ag: p.ag, o: p.o, p: p.p, n: p.n, st: starters.has(p.i) }])))
  FR.ageLeague(F)
  const after = new Map(FR.SHORTS.flatMap(s => F.teams[s].r.map(p => [p.i, p])))
  const gone = []
  for (const [i, b] of before) {
    const k = `${b.p}|${band(b.ag + 1)}|${b.st && b.o >= 78 ? 'starter' : 'other'}`
    const c = (retire[k] ??= [0, 0]); c[0]++
    const a = after.get(i)
    if (!a) { c[1]++; gone.push(b); continue }
    if (a.ag !== b.ag + 1) ageJumps.push(`${b.n} ${b.ag} -> ${a.ag}`)
  }
  const goodGone = gone.filter(b => b.st && b.o >= 80)
  console.log(`aged: ${gone.length} retired, starters 80+ who retired: ${goodGone.map(b => `${b.p.toUpperCase()} ${b.n} ${b.ag + 1} (${b.o})`).join(', ') || 'none'}`)
  FR.openResign(F)
  for (const id of [...F.rs]) {
    const p = F.teams[team].r.find(x => x.i === id)
    if (FR.optionDue(p)) { FR.resignOne(F, id, p.o >= 80 ? 'option' : 'decline'); continue }
    FR.resignOne(F, id, p.o >= 76 && FR.canSign(F, FR.resignAsk(p, F).$))
  }
  FR.openFA(F)
  const signed = []
  while (F.fad) {
    for (const p of FR.faBoard(F, 30).filter(x => FR.canSign(F, x.$) && x.o >= 72).slice(0, 2)) { const b = FR.placeBid(F, p.i, p.$ * 1.1); if (b?.to === team) signed.push(p) }
    FR.nextFADay(F)
  }
  console.log(`FA: signed ${signed.map(p => `${p.p.toUpperCase()} ${p.n} ${p.ag} (${p.o})`).join(', ') || 'nobody'} · ${roomTxt()}`)
  FR.openDraft(F)
  FR.startNight?.(F)
  while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  FR.closeDraft(F)
  console.log(`after the draft: ${roomTxt()}`)
  const over = FR.campCuts ? FR.campCuts(F) : null
  if (over) { console.log(`camp cuts needed: ${over.map(r => `${r.pos.toUpperCase()} ${r.have}/${r.max}`).join(', ') || 'none'}`); FR.autoCamp?.(F) }
  const deadBefore = FR.capSheet(F, team).dead
  const campGone = signed.filter(p => !F.teams[team].r.some(x => x.i === p.i))
  if (campGone.length) console.log(`   (the GM's own cuts took FA signings: ${campGone.map(p => p.n).join(', ')})`)
  const kept = F.teams[team].r.filter(p => !p.fl)
  FR.newSeason(F)
  const lost = kept.filter(p => !F.teams[team].r.some(x => x.i === p.i))
  if (lost.length) bad(`${F.year}: the game cut the GM's men: ${lost.map(p => `${p.p} ${p.n} (${p.o})`).join(', ')}`)
  const notFa = (F.fa ?? []).length
  console.log(`   street after camp: ${notFa} men`)
  const rel = (F.news ?? []).filter(x => x.tag === 'RELEASED' && x.s === team && x.y === F.year)
  console.log(`new season ${F.year}: ${roomTxt()} · dead cap ${deadBefore} -> ${FR.capSheet(F, team).dead} · RELEASED lines ${rel.length}`)
  console.log('watch:', WATCH.map(n => `${n}: ${where(n)}`).join(' · '))
}
console.log('\nage jumps (not one year):', ageJumps.length ? ageJumps.slice(0, 10).join(', ') : 'none')
console.log('retirement rate a year by spot, age, starter 78+ (men, %):')
for (const pos of FR.POS) {
  const row = ['≤26', '27-29', '30-31', '32-33', '34+'].map(b => { const s = retire[`${pos}|${b}|starter`] ?? [0, 0], o = retire[`${pos}|${b}|other`] ?? [0, 0]; return `${b}: st ${s[0] ? Math.round(100 * s[1] / s[0]) + '%' : '-'}/${s[0]} oth ${o[0] ? Math.round(100 * o[1] / o[0]) + '%' : '-'}/${o[0]}` })
  console.log(`  ${pos.toUpperCase()} ${row.join(' | ')}`)
}
console.log(problems.length ? `${problems.length} problems` : 'no problems')
