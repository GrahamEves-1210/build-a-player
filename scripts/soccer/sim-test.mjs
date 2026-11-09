// Soccer sim check: node scripts/soccer/sim-test.mjs [seasons=500]
// Bundles src/utils/soccerSimulation.js with esbuild (SOCCER_FIXTURE=1: always the fixture). The data imports go to src/data/soccer-*.js when the data
// agent's files are there, and to scripts/soccer/fixture/ when they aren't (printed at the top).
// Plays N club seasons for an elite, good, average and poor build at the Premier League's best and worst
// clubs, N World Cups for each at a top and a weak nation, then checks determinism, script mode and that
// every line adds up.
import { build } from 'esbuild'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { tmpdir } from 'os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const N = Number(process.argv[2] ?? 500)
const used = {}
const dataPlugin = {
  name: 'soccer-data',
  setup(b) {
    b.onResolve({ filter: /\/data\/soccer-(clubs|nations|strikers)$/ }, args => {
      const name = args.path.match(/soccer-(clubs|nations|strikers)$/)[0]
      const real = join(ROOT, 'src', 'data', `${name}.js`)
      const p = existsSync(real) && !process.env.SOCCER_FIXTURE ? real : join(ROOT, 'scripts', 'soccer', 'fixture', `${name}.js`)
      used[name] = existsSync(real) && !process.env.SOCCER_FIXTURE ? 'src/data' : 'fixture'
      return { path: p }
    })
  },
}
const outDir = join(process.env.SOCCER_TEST_OUT ?? tmpdir(), 'bap-soccer-test')
mkdirSync(outDir, { recursive: true })
const outfile = join(outDir, `sim-${Date.now()}.mjs`)
await build({ entryPoints: [join(ROOT, 'src', 'utils', 'soccerSimulation.js')], bundle: true, format: 'esm', platform: 'node', outfile, plugins: [dataPlugin], logLevel: 'error', define: { 'import.meta.env': '{}' } })
const S = await import(pathToFileURL(outfile).href)
const D = {
  clubs: (await import(pathToFileURL(used['soccer-clubs'] === 'src/data' ? join(ROOT, 'src/data/soccer-clubs.js') : join(ROOT, 'scripts/soccer/fixture/soccer-clubs.js')).href)),
  nations: (await import(pathToFileURL(used['soccer-nations'] === 'src/data' ? join(ROOT, 'src/data/soccer-nations.js') : join(ROOT, 'scripts/soccer/fixture/soccer-nations.js')).href)),
}
console.log('data:', JSON.stringify(used))

const T = S.SOCCER_TRAITS
const mk = vals => Object.fromEntries(T.map((t, i) => [t, { type: t, val: vals[i] }]))
//                          fin sp hd dr ft lu pa st ob co
const BUILDS = {
  elite: mk([10, 9, 8, 7, 9, 7, 9, 8, 10, 9]),
  good: mk([8, 8, 7, 7, 8, 7, 8, 7, 8, 7]),
  average: mk([6, 6, 6, 6, 6, 6, 6, 6, 6, 6]),
  poor: mk([4, 4, 4, 3, 4, 4, 4, 4, 4, 4]),
}
for (const [k, b] of Object.entries(BUILDS)) console.log(`${k.padEnd(8)} OVR ${S.calcSoccerOVR(b, T)}  ${S.getSoccerArchetype(S.calcSoccerOVR(b, T), b, T)}`)

const L0 = D.clubs.SOCCER_LEAGUES[0]
const pl = D.clubs.SOCCER_CLUBS.filter(c => c.league === L0.id).sort((a, b) => b.ovr - a.ovr || (b.att + b.def) - (a.att + a.def))
const TOP = pl[0], WEAK = pl[pl.length - 1], MID = pl[Math.floor(pl.length / 2)]
const nat = D.nations.WC_NATIONS.slice().sort((a, b) => b.ovr - a.ovr)
const NTOP = nat[0], NWEAK = nat[nat.length - 1]
console.log(`clubs: top ${TOP.short} (${TOP.name}), mid ${MID.short} (${MID.name}), weak ${WEAK.short} (${WEAK.name}) · nations: top ${NTOP.short}, weak ${NWEAK.short}`)

const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
const pct = a => `${(mean(a.map(x => (x ? 1 : 0))) * 100).toFixed(1)}%`
const f1 = x => x.toFixed(1)
const errs = []
function check(r, tag) {
  for (const g of r.fixtures ?? r.games) {
    const bad = []
    if (g.goals > g.mySc) bad.push('goals>score')
    if (g.sot > g.shots) bad.push('sot>shots')
    if (g.goals - g.pens > g.sot) bad.push('npg>sot')
    if (g.assists > g.mySc - g.goals) bad.push('assists')
    if (g.mins < 0 || g.mins > 120) bad.push('mins')
    if (g.mins === 0 && (g.goals || g.shots || g.rating != null)) bad.push('ghost line')
    if (bad.length) errs.push(`${tag} ${g.comp} ${g.round}: ${bad.join(',')}`)
  }
  if (r.mode === 'current') {
    const t = r.standings
    const gf = t.reduce((s, x) => s + x.gf, 0), ga = t.reduce((s, x) => s + x.ga, 0)
    if (gf !== ga) errs.push(`${tag} table gf ${gf} != ga ${ga}`)
    const w = r.games.filter(g => g.won).length, d = r.games.filter(g => g.drawn).length
    if (w !== r.wins || d !== r.draws || r.points !== 3 * r.wins + r.draws) errs.push(`${tag} record mismatch`)
    if (r.games.length !== 2 * (t.length - 1)) errs.push(`${tag} ${r.games.length} league games for ${t.length} clubs`)
  }
}

function clubRun(bk, club, n) {
  const R = []
  const t0 = Date.now()
  for (let i = 0; i < n; i++) { const r = S.runSoccerSimulation(BUILDS[bk], T, club, 'current', `test-${bk}-${club.short}-${i}`); check(r, `${bk}/${club.short}/${i}`); R.push(r) }
  const ms = (Date.now() - t0) / n
  const g = k => mean(R.map(r => r[k] ?? 0))
  return {
    build: bk, club: club.short, ovr: R[0].ovr, ms: ms.toFixed(1),
    goals: f1(g('goals')), sd: Math.sqrt(mean(R.map(r => (r.goals - g('goals')) ** 2))).toFixed(1), ast: f1(g('assists')), xg: f1(g('xg')), npxg90: g('xgPer90').toFixed(2),
    shots: f1(g('shots')), conv: f1(g('conversion')), sotPct: f1(g('sotPct')), bcm: f1(g('bcm')), pens: f1(g('pens')),
    mins: Math.round(g('mins')), apps: f1(g('apps')), starts: f1(g('starts')), rtg: g('avgRating').toFixed(2),
    allGoals: f1(mean(R.map(r => r.allComps.goals))), max: Math.max(...R.map(r => r.goals)), rec36: pct(R.map(r => r.goals > 36)),
    pos: f1(g('seed')), pts: f1(g('points')), teamGF: f1(g('gf')), share: (g('goals') / g('gf') * 100).toFixed(0) + '%', down: pct(R.map(r => r.relegated)),
    title: pct(R.map(r => r.champion)), cup: pct(R.map(r => r.cup.champion)), euro: pct(R.map(r => r.europe?.champion)),
    boot: pct(R.map(r => r.goldenBoot.won)), pots: pct(R.map(r => r.playerOfSeason.won)), tots: pct(R.map(r => r.teamOfSeason)), shoe: pct(R.map(r => r.goldenShoe.won)),
    bdo: pct(R.map(r => r.ballonDor.finish === 'winner')), bdo3: pct(R.map(r => r.ballonDor.rank <= 3)), bdo10: pct(R.map(r => r.ballonDor.rank <= 10)), nom: pct(R.map(r => r.ballonDor.rank <= 30)),
    R,
  }
}
function wcRun(bk, nation, n) {
  const R = []
  for (let i = 0; i < n; i++) { const r = S.runSoccerSimulation(BUILDS[bk], T, nation, 'alltime', `wc-${bk}-${nation.short}-${i}`); check(r, `wc/${bk}/${nation.short}/${i}`); R.push(r) }
  const g = k => mean(R.map(r => r[k] ?? 0))
  const fin = k => pct(R.map(r => r.finish === k))
  return {
    build: bk, nation: nation.short, ovr: R[0].ovr, games: f1(mean(R.map(r => r.games.length))), apps: f1(g('apps')), mins: Math.round(g('mins')),
    goals: f1(g('goals')), ast: f1(g('assists')), xg: f1(g('xg')),
    boot: pct(R.map(r => r.goldenBoot.won)), ball: pct(R.map(r => r.goldenBall.won)), ballMedal: pct(R.map(r => r.goldenBall.rank <= 3)),
    win: fin('Winners'), final: pct(R.map(r => ['Winners', 'Runners-up'].includes(r.finish))), semi: pct(R.map(r => ['Winners', 'Runners-up', 'Third place', 'Fourth place'].includes(r.finish))),
    qf: pct(R.map(r => !['Group stage', 'Round of 32', 'Round of 16'].includes(r.finish))), out: fin('Group stage'),
    R,
  }
}
const show = (rows, cols) => {
  console.log(cols.join(' | '))
  for (const r of rows) console.log(cols.map(c => String(r[c])).join(' | '))
}

console.log(`\n=== Club seasons: ${N} each ===`)
const rows = []
for (const club of [TOP, MID, WEAK]) for (const bk of Object.keys(BUILDS)) rows.push(clubRun(bk, club, N))
show(rows, ['build', 'club', 'ovr', 'goals', 'sd', 'max', 'rec36', 'ast', 'xg', 'npxg90', 'shots', 'conv', 'sotPct', 'bcm', 'pens', 'mins', 'apps', 'starts', 'rtg', 'allGoals'])
console.log('')
show(rows, ['build', 'club', 'pos', 'pts', 'teamGF', 'share', 'down', 'title', 'cup', 'euro', 'boot', 'pots', 'tots', 'shoe', 'bdo', 'bdo3', 'bdo10', 'nom', 'ms'])

// the league itself (from every season played above at the top club)
const all = rows.flatMap(r => r.R)
const champPts = mean(all.map(r => r.standings[0].points)), lastPts = mean(all.map(r => r.standings[r.standings.length - 1].points))
const fourth = mean(all.map(r => r.standings[3].points)), safe = mean(all.map(r => r.standings[r.standings.length - 4].points))
const gpg = mean(all.map(r => r.standings.reduce((s, x) => s + x.gf, 0) / (r.standings.length * (r.standings.length - 1))))
const bootWin = mean(all.map(r => Math.max(r.goals, ...r.book.league.map(x => x.goals))))
const shoeWin = mean(all.map(r => Math.max(r.goals, ...r.book.shoe.map(x => x.goals))))
const ug = all.flatMap(r => r.games.filter(g => g.home))
const hw = mean(ug.map(g => g.won)), hd = mean(ug.map(g => g.drawn))
const drawRate = mean(all.map(r => r.standings.reduce((s, x) => s + x.draws, 0) / r.standings.reduce((s, x) => s + x.played, 0)))
console.log(`\nall league matches: ${(drawRate * 100).toFixed(1)}% drawn`)
// every league (the field's top scorer and the champions' points, from the same seasons)
for (const L of D.clubs.SOCCER_LEAGUES) {
  const bw = mean(all.map(r => Math.max(...r.book.shoe.filter(x => x.lid === L.id).map(x => x.goals), L.id === L0.id ? r.goals : 0)))
  const cp = mean(all.map(r => (L.id === L0.id ? r.standings : r.otherLeagues[L.id].top)[0].points))
  console.log(`  ${L.name.padEnd(15)} top scorer ${f1(bw)} · champions ${f1(cp)} pts`)
}
const ucl = all.filter(r => r.europe?.comp === 'ucl').flatMap(r => r.europe.table)
console.log(`\nleague: champions ${f1(champPts)} pts, 4th ${f1(fourth)}, 17th ${f1(safe)}, last ${f1(lastPts)}; ${gpg.toFixed(2)} goals a game`)
console.log(`his home games: won ${(hw * 100).toFixed(0)}% drawn ${(hd * 100).toFixed(0)}%`)
console.log(`Golden Boot winning total ${f1(bootWin)} · Golden Shoe winner ${f1(shoeWin)} goals · CL league phase ${ucl.length ? (ucl.reduce((s, x) => s + x.gf, 0) / (ucl.length * 4)).toFixed(2) : '-'} goals a game`)
const sample = rows.find(r => r.build === 'elite' && r.club === TOP.short).R[0]
console.log(`sample (elite at ${TOP.short}): ${sample.goals} G ${sample.assists} A in ${sample.apps} apps, ${sample.mins} min, xG ${sample.xg}, pos ${sample.seed}, cup ${sample.cup.result}, ${sample.europe?.name ?? '-'} ${sample.europe?.result ?? ''}, BdO ${sample.ballonDor.finish} (#${sample.ballonDor.rank}), boot winner ${sample.goldenBoot.winner?.name ?? 'build'} ${sample.goldenBoot.winner?.goals}`)
console.log(`  archetype ${sample.archetype}, trophies ${sample.trophies.join(', ') || '-'}, finals ${sample.finalsOpp ?? '-'} ${sample.finalsSeries ?? ''}`)

console.log(`\n=== World Cups: ${N} each ===`)
const wrows = []
for (const n of [NTOP, NWEAK]) for (const bk of ['elite', 'average']) wrows.push(wcRun(bk, n, N))
show(wrows, ['build', 'nation', 'ovr', 'games', 'apps', 'mins', 'goals', 'ast', 'xg', 'boot', 'ball', 'ballMedal', 'win', 'final', 'semi', 'qf', 'out'])
const wall = wrows.flatMap(r => r.R)
console.log(`WC Golden Boot winning total ${f1(mean(wall.map(r => Math.max(r.goals, ...r.book.boot.map(x => x.goals)))))} · goals a game ${(mean(wall.map(r => Object.values(r.groups).flat().reduce((s, x) => s + x.gf, 0) / 72))).toFixed(2)} (group stage)`)
const champs = {}
for (const r of wall) champs[r.worldChampion] = (champs[r.worldChampion] ?? 0) + 1
console.log('world champions:', Object.entries(champs).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${(v / wall.length * 100).toFixed(0)}%`).join(', '))

// determinism
console.log('\n=== Checks ===')
const a = JSON.stringify(S.runSoccerSimulation(BUILDS.elite, T, TOP, 'current', 12345))
const b = JSON.stringify(S.runSoccerSimulation(BUILDS.elite, T, TOP, 'current', 12345))
const c = JSON.stringify(S.runSoccerSimulation(BUILDS.elite, T, TOP, 'current', 12346))
const wa = JSON.stringify(S.runSoccerSimulation(BUILDS.good, T, NTOP, 'alltime', 'abc'))
const wb = JSON.stringify(S.runSoccerSimulation(BUILDS.good, T, NTOP, 'alltime', 'abc'))
console.log(`same seed, same season: club ${a === b}, World Cup ${wa === wb}; another seed differs: ${a !== c}`)
// script mode
const sc = S.scriptSoccerSeason(TOP, { att: TOP.att + 3, def: TOP.def }, 777)
const s1 = S.runSoccerSimulation(BUILDS.elite, T, { ...TOP, squad: true, usage: 0.8 }, 'current', 'b1', 'classic', sc)
const s2 = S.runSoccerSimulation(BUILDS.average, T, { ...TOP, squad: true, usage: 0.5 }, 'current', 'b2', 'classic', sc)
const sameScores = s1.games.every((g, i) => g.mySc === sc.games[i].mySc && g.oppSc === sc.games[i].oppSc && s2.games[i].mySc === g.mySc)
check(s1, 'script1'); check(s2, 'script2')
console.log(`script: scores kept for both builds ${sameScores}; record ${sc.wins}-${sc.draws}-${sc.losses} (pos ${sc.seed}); builds ${s1.goals} and ${s2.goals} goals, together ≤ team ${s1.games.every((g, i) => g.goals + s2.games[i].goals <= g.mySc + 2)}`)
const ws = S.scriptSoccerSeason(NTOP, { att: NTOP.att, def: NTOP.def }, 99, 'alltime')
const w1 = S.runSoccerSimulation(BUILDS.elite, T, NTOP, 'alltime', 'w1', 'classic', ws)
check(w1, 'wcscript')
console.log(`WC script: finish ${ws.finish} = ${w1.finish} ${ws.finish === w1.finish}`)
// awards again from new totals
const re = S.soccerAwards(s1, { goals: s1.goals + 10, assists: s1.assists })
console.log(`soccerAwards: boot rank ${s1.goldenBoot.rank} → ${re.goldenBoot.rank} with 10 more goals`)
// career and director-style teams
const car = S.runSoccerSimulation(BUILDS.good, T, { short: WEAK.short, name: WEAK.name, career: true, off: 8, def: 7, usage: 0.9 }, 'current', 5)
const mod = S.runSoccerSimulation(BUILDS.good, T, { ...WEAK, offMod: 2 }, 'current', 5)
const plain = S.runSoccerSimulation(BUILDS.good, T, WEAK, 'current', 5)
console.log(`career team (off 8, def 7) at ${WEAK.short}: pos ${car.seed}, att ${car.team.att}; offMod +2: att ${mod.team.att} vs ${plain.team.att}, pos ${mod.seed} vs ${plain.seed}`)
console.log(`10-scale: ${JSON.stringify(S.soccerTeam10(TOP))} ${JSON.stringify(S.soccerTeam10(WEAK))} · lift at ${WEAK.short}: elite ${JSON.stringify(S.soccerStrikerLift(BUILDS.elite, WEAK))}, poor ${JSON.stringify(S.soccerStrikerLift(BUILDS.poor, WEAK))}`)
const nr = S.runSoccerSimulation(BUILDS.good, T, TOP, 'current', null)
console.log(`no seed runs: ${nr.games.length} league games`)
console.log(errs.length ? `ERRORS (${errs.length}):\n${errs.slice(0, 20).join('\n')}` : 'every line adds up: OK')
