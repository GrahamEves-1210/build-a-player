// Champions League campaign check: node scripts/soccer/ucl-test.mjs [campaigns=600]
// Bundles src/utils/soccerSimulation.js with esbuild (as sim-test.mjs does) and plays N seeded campaigns (a build's
// season, mode 'current'), rotating the build and his club. Checks every league phase (eight different opponents,
// two from each pot, one at home and one away per pot, four and four, no pairing twice), the table (its sums, its
// order, every row against the matches), the bracket (seeding, who meets whom, aggregates, extra time and penalties,
// winners moving on), his line against his club's scores, that a seed always plays the same campaign, and reports
// who wins it and what the top scorer scores.
import { build } from 'esbuild'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { tmpdir } from 'os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const N = Number(process.argv[2] ?? 600)
const dataPlugin = {
  name: 'soccer-data',
  setup(b) {
    b.onResolve({ filter: /\/data\/soccer-(clubs|nations|strikers)$/ }, args => {
      const name = args.path.match(/soccer-(clubs|nations|strikers)$/)[0]
      const real = join(ROOT, 'src', 'data', `${name}.js`)
      return { path: existsSync(real) && !process.env.SOCCER_FIXTURE ? real : join(ROOT, 'scripts', 'soccer', 'fixture', `${name}.js`) }
    })
  },
}
const outDir = join(process.env.SOCCER_TEST_OUT ?? tmpdir(), 'bap-soccer-test')
mkdirSync(outDir, { recursive: true })
const outfile = join(outDir, `ucl-${Date.now()}.mjs`)
await build({ entryPoints: [join(ROOT, 'src', 'utils', 'soccerSimulation.js')], bundle: true, format: 'esm', platform: 'node', outfile, plugins: [dataPlugin], logLevel: 'error', define: { 'import.meta.env': '{}' } })
const S = await import(pathToFileURL(outfile).href)
const C = await import(pathToFileURL(join(ROOT, 'src', 'data', 'soccer-clubs.js')).href)

const T = S.SOCCER_TRAITS
const mk = v => Object.fromEntries(T.map(t => [t, { type: t, val: v }]))
const BUILDS = { elite: mk(9), good: mk(7.5), average: mk(6), poor: mk(4) }
const UCL = S.UCL_CLUBS
const POT = new Map(UCL.map(c => [c.short, c.pot]))
const RANK = new Map(UCL.map(c => [c.short, c.rank]))
console.log(`entrants: ${UCL.length} (${UCL.filter(c => c.inData).length} rated from the data, ${UCL.filter(c => !c.inData).length} at the fallback ratings)`)
// his clubs: entrants in the data across the pots, and a club that isn't in the Champions League (a wildcard)
const inData = UCL.filter(c => c.inData)
const notIn = C.SOCCER_CLUBS.filter(c => !UCL.some(u => u.short === c.short))
const CLUBS = [...[1, 2, 3, 4].flatMap(p => inData.filter(c => c.pot === p).slice(0, 2)), ...notIn.slice(0, 2)].map(c => C.SOCCER_CLUBS.find(x => x.short === c.short) ?? c)
console.log('his clubs:', CLUBS.map(c => c.short).join(' '))

const errs = []
const err = (tag, msg) => { if (errs.length < 400) errs.push(`${tag}: ${msg}`) }
const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
const pctl = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }

function checkLeaguePhase(r, tag) {
  const M = r.leaguePhase
  if (!Array.isArray(M) || M.length !== 144) { err(tag, `${M?.length} league phase matches`); return { same: 0, three: 0 } }
  const by = new Map(r.standings.map(x => [x.short, { opp: [], home: 0, away: 0, pot: [0, 0, 0, 0, 0], potH: [0, 0, 0, 0, 0] }]))
  const pairs = new Set()
  const pot = new Map(r.standings.map(x => [x.short, x.pot]))
  for (const [h, a] of M) {
    const k = [h, a].sort().join('|')
    if (pairs.has(k)) err(tag, `${k} drawn twice`)
    pairs.add(k)
    if (h === a) err(tag, `${h} plays itself`)
    const H = by.get(h), A = by.get(a)
    if (!H || !A) { err(tag, `unknown club ${h} or ${a}`); continue }
    H.opp.push(a); A.opp.push(h); H.home++; A.away++
    H.pot[pot.get(a)]++; A.pot[pot.get(h)]++; H.potH[pot.get(a)]++
  }
  // countries: same-country meetings, a third opponent from one country (UEFA avoids both)
  const ctry = new Map(UCL.map(c => [c.short, c.country]))
  for (const row of r.standings) if (!ctry.has(row.short)) ctry.set(row.short, ctry.get(r.team.inPlaceOf) ?? '?')
  let same = 0, three = 0
  for (const [s, x] of by) {
    if (x.opp.length !== 8) err(tag, `${s} has ${x.opp.length} matches`)
    if (new Set(x.opp).size !== x.opp.length) err(tag, `${s} meets a club twice`)
    if (x.home !== 4 || x.away !== 4) err(tag, `${s} ${x.home} home ${x.away} away`)
    for (let p = 1; p <= 4; p++) {
      if (x.pot[p] !== 2) err(tag, `${s}: ${x.pot[p]} from pot ${p}`)
      if (x.potH[p] !== 1) err(tag, `${s}: ${x.potH[p]} at home to pot ${p}`)
    }
    const cs = {}
    for (const o of x.opp) { if (ctry.get(o) === ctry.get(s)) same++; cs[ctry.get(o)] = (cs[ctry.get(o)] ?? 0) + 1 }
    if (Object.values(cs).some(n => n > 2)) three++
  }
  // the table against the matches
  const t = new Map(r.standings.map(x => [x.short, { w: 0, d: 0, l: 0, gf: 0, ga: 0 }]))
  for (const [h, a, hs, as] of M) {
    const H = t.get(h), A = t.get(a)
    H.gf += hs; H.ga += as; A.gf += as; A.ga += hs
    if (hs > as) { H.w++; A.l++ } else if (hs < as) { A.w++; H.l++ } else { H.d++; A.d++ }
  }
  r.standings.forEach((row, i) => {
    const x = t.get(row.short)
    if (row.pos !== i + 1) err(tag, `pos ${row.pos} at ${i + 1}`)
    if (row.wins !== x.w || row.draws !== x.d || row.losses !== x.l || row.gf !== x.gf || row.ga !== x.ga || row.points !== 3 * x.w + x.d || row.gd !== x.gf - x.ga) err(tag, `${row.short} row doesn't match its matches`)
    const nx = r.standings[i + 1]
    if (nx && (nx.points > row.points || (nx.points === row.points && (nx.gd > row.gd || (nx.gd === row.gd && nx.gf > row.gf))))) err(tag, `table order at ${i + 1}`)
  })
  return { same, three }
}
const POG = [[9, 10, 23, 24], [11, 12, 21, 22], [13, 14, 19, 20], [15, 16, 17, 18]]
const R16G = { 7: 0, 8: 0, 5: 1, 6: 1, 3: 2, 4: 2, 1: 3, 2: 3 }
function checkTie(t, seedOf, tag, single = false) {
  const sa = single ? t.legs[0][0] : t.legs[0][0] + t.legs[1][1], sb = single ? t.legs[0][1] : t.legs[0][1] + t.legs[1][0]
  if (sa !== t.sa || sb !== t.sb) err(tag, `aggregate ${t.sa}-${t.sb} vs legs ${sa}-${sb}`)
  const w = sa > sb ? t.a : sb > sa ? t.b : t.pens ? (t.pens[0] > t.pens[1] ? t.a : t.b) : null
  if (!w) err(tag, 'level with no shootout')
  if (w !== t.winner) err(tag, `winner ${t.winner}, should be ${w}`)
  if (sa === sb && !t.et) err(tag, 'level on aggregate without extra time')
  if (t.pens && sa !== sb) err(tag, 'a shootout in a tie that was decided')
  if (!single && seedOf(t.a) < seedOf(t.b)) err(tag, `${t.a} (${seedOf(t.a)}) hosts the first leg against ${t.b} (${seedOf(t.b)})`)
}
function checkBracket(r, tag) {
  const B = r.bracket
  const seed = new Map(r.standings.map(x => [x.short, x.pos]))
  const so = s => seed.get(s)
  if (B.po.length !== 8 || B.r16.length !== 8 || B.qf.length !== 4 || B.sf.length !== 2 || B.final.length !== 1) { err(tag, 'bracket size'); return }
  const poIn = new Set(B.po.flatMap(t => [t.a, t.b]))
  for (let s = 9; s <= 24; s++) if (!poIn.has(r.standings[s - 1].short)) err(tag, `${s}th not in the play-offs`)
  B.po.forEach((t, i) => {
    checkTie(t, so, `${tag} po${i}`)
    const g = POG.findIndex(x => x.includes(so(t.b)))
    if (g < 0 || !POG[g].slice(0, 2).includes(so(t.b)) || !POG[g].slice(2).includes(so(t.a))) err(tag, `play-off ${so(t.a)} v ${so(t.b)} isn't a seeded pairing`)
  })
  const poW = new Map(B.po.map(t => [t.winner, POG.findIndex(x => x.includes(so(t.b)))]))
  B.r16.forEach((t, i) => {
    checkTie(t, so, `${tag} r16-${i}`)
    if (so(t.b) > 8) err(tag, `R16 host ${so(t.b)}`)
    if (!poW.has(t.a) || poW.get(t.a) !== R16G[so(t.b)]) err(tag, `R16 ${so(t.b)} meets a play-off winner from the wrong pairing`)
    if (B.po[i].winner !== t.a) err(tag, 'bracket order (po → r16)')
  })
  const top8 = new Set(r.standings.slice(0, 8).map(x => x.short))
  if (!B.r16.every(t => top8.has(t.b)) || new Set(B.r16.map(t => t.b)).size !== 8) err(tag, 'R16 seeds')
  // halves: 1/2, 3/4, 5/6, 7/8 apart
  const halfOf = s => Math.floor(B.r16.findIndex(t => so(t.b) === s) / 4)
  for (const [x, y] of [[1, 2], [3, 4], [5, 6], [7, 8]]) if (halfOf(x) === halfOf(y)) err(tag, `${x} and ${y} in the same half`)
  B.qf.forEach((t, i) => {
    checkTie(t, so, `${tag} qf${i}`)
    const feed = [B.r16[2 * i].winner, B.r16[2 * i + 1].winner]
    if (![t.a, t.b].every(s => feed.includes(s))) err(tag, `QF ${i} isn't the winners of R16 ${2 * i} and ${2 * i + 1}`)
    const seeds = [so(B.r16[2 * i].b), so(B.r16[2 * i + 1].b)].sort((a, b) => a - b)
    const ok = (seeds[0] <= 2 && seeds[1] >= 7) || (seeds[0] >= 3 && seeds[0] <= 4 && seeds[1] >= 5 && seeds[1] <= 6)
    if (!ok) err(tag, `QF ${i} paths ${seeds.join('/')}`)
  })
  B.sf.forEach((t, i) => {
    checkTie(t, so, `${tag} sf${i}`)
    if (![t.a, t.b].every(s => [B.qf[2 * i].winner, B.qf[2 * i + 1].winner].includes(s))) err(tag, `SF ${i} feed`)
  })
  const f = B.final[0]
  checkTie(f, so, `${tag} final`, true)
  if (![f.a, f.b].every(s => [B.sf[0].winner, B.sf[1].winner].includes(s))) err(tag, 'final feed')
  if (r.uclWinner !== f.winner) err(tag, 'winner')
  // his own run against the bracket
  const mine = [...B.po, ...B.r16, ...B.qf, ...B.sf, ...B.final].filter(t => t.a === r.team.short || t.b === r.team.short)
  if (mine.length !== r.playoffRounds.length) err(tag, `his ties ${r.playoffRounds.length} vs bracket ${mine.length}`)
  r.playoffRounds.forEach((t, i) => {
    const b = mine[i]
    if (!b) return
    const us = b.a === r.team.short
    const agg = t.agg ?? [t.legs[0].mySc, t.legs[0].oppSc]
    if (agg[0] !== (us ? b.sa : b.sb) || agg[1] !== (us ? b.sb : b.sa)) err(tag, `his ${t.name} ${agg.join('-')} vs bracket ${b.sa}-${b.sb}`)
    if (t.won !== (b.winner === r.team.short)) err(tag, `his ${t.name} result`)
  })
  const exp = r.champion ? 'Winners' : r.finish
  const pos = r.seed
  if (pos > 24 && (r.playoffRounds.length || r.finish !== 'League phase')) err(tag, 'out in the league phase but played on')
  if (pos <= 8 && r.playoffRounds[0]?.name !== 'Round of 16') err(tag, 'top eight but played a play-off')
  if (pos > 8 && pos <= 24 && r.playoffRounds[0]?.name !== 'Knockout play-off') err(tag, `${pos}th skipped the play-off`)
  if (r.champion !== (f.winner === r.team.short) || !exp) err(tag, 'champion flag')
}
function checkLine(r, tag) {
  for (const g of r.fixtures) {
    const bad = []
    if (g.goals > g.mySc) bad.push('goals>score')
    if (g.sot > g.shots) bad.push('sot>shots')
    if (g.goals - g.pens > g.sot) bad.push('npg>sot')
    if (g.assists > g.mySc - g.goals) bad.push('assists')
    if (g.mins < 0 || g.mins > 120) bad.push('mins')
    if (g.mins === 0 && (g.goals || g.shots || g.rating != null)) bad.push('ghost line')
    if (bad.length) err(tag, `${g.round}: ${bad.join(',')}`)
  }
  if (r.games.length !== 8) err(tag, `${r.games.length} league phase games`)
  const w = r.games.filter(g => g.won).length, d = r.games.filter(g => g.drawn).length
  if (w !== r.wins || d !== r.draws || r.points !== 3 * w + d) err(tag, 'his record vs his games')
  const row = r.standings.find(x => x.isUs)
  if (!row || row.short !== r.team.short || row.pos !== r.seed) err(tag, 'his row')
  if (r.goals !== r.fixtures.reduce((s, g) => s + g.goals, 0)) err(tag, 'his goals vs his matches')
}

const t0 = Date.now()
const R = []
const winners = {}, topScorer = [], same = [], three = []
const keys = Object.keys(BUILDS)
for (let i = 0; i < N; i++) {
  const bk = keys[i % keys.length], club = CLUBS[Math.floor(i / keys.length) % CLUBS.length]
  const tag = `${bk}/${club.short}/${i}`
  const r = S.runSoccerSimulation(BUILDS[bk], T, club, 'current', `ucl-${i}`)
  if (r.comp !== 'ucl') { err(tag, 'not a Champions League season'); continue }
  const lp = checkLeaguePhase(r, tag); same.push(lp.same); three.push(lp.three)
  checkBracket(r, tag)
  checkLine(r, tag)
  winners[r.uclWinner] = (winners[r.uclWinner] ?? 0) + 1
  topScorer.push(Math.max(r.goals, ...r.book.boot.map(x => x.goals)))
  R.push({ bk, club: club.short, wild: !!r.team.inPlaceOf, r: { seed: r.seed, finish: r.finish, goals: r.goals, assists: r.assists, apps: r.apps, boot: r.goldenBoot.won, poty: r.playerOfSeason.won, tots: r.teamOfSeason, gpg: r.leaguePhase.reduce((s, m) => s + m[2] + m[3], 0) / 144, koGpg: [...r.bracket.po, ...r.bracket.r16, ...r.bracket.qf, ...r.bracket.sf].reduce((s, t) => s + t.sa + t.sb, 0) / 46 } })
}
const ms = (Date.now() - t0) / N
console.log(`\n${N} campaigns, ${ms.toFixed(1)} ms each`)

// determinism
const club0 = CLUBS[0]
const a = JSON.stringify(S.runSoccerSimulation(BUILDS.good, T, club0, 'current', 4242))
const b = JSON.stringify(S.runSoccerSimulation(BUILDS.good, T, club0, 'current', 4242))
const c = JSON.stringify(S.runSoccerSimulation(BUILDS.good, T, club0, 'current', 4243))
const sa2 = JSON.stringify(S.runSoccerSimulation(BUILDS.good, T, club0, 'current', 'str-seed'))
const sb2 = JSON.stringify(S.runSoccerSimulation(BUILDS.good, T, club0, 'current', 'str-seed'))
const det = a === b && sa2 === sb2 && a !== c
console.log(`same seed, same campaign: ${a === b && sa2 === sb2}; another seed differs: ${a !== c}`)
if (!det) errs.push('determinism')

// the award recount (the season director's path) leaves the run's awards as they were
const base = S.runSoccerSimulation(BUILDS.elite, T, club0, 'current', 'rebook')
const re = S.soccerUclRebook(base, base.games)
const sameBook = re.goals === base.goals && re.goldenBoot.rank === base.goldenBoot.rank && re.seed === base.seed && re.playerOfSeason.rank === base.playerOfSeason.rank
console.log(`rebook from the same games: unchanged ${sameBook}`)
if (!sameBook) errs.push('rebook changed an unchanged season')
const aw = S.soccerAwards(base, { goals: base.goals + 6, assists: base.assists })
console.log(`soccerAwards: top scorer rank ${base.goldenBoot.rank} → ${aw.goldenBoot.rank} with 6 more goals`)

// the domestic season is still there for Career / Squad Builder
const dom = S.runSoccerSimulation(BUILDS.good, T, { ...club0, domestic: true }, 'current', 9)
const car = S.runSoccerSimulation(BUILDS.good, T, { short: club0.short, name: club0.name, career: true, off: 7, def: 7 }, 'current', 9)
console.log(`domestic: ${dom.league?.name} ${dom.games.length} games, career ${car.league?.name} ${car.games.length} games`)
if (dom.comp === 'ucl' || car.comp === 'ucl') errs.push('domestic routes to the Champions League')

// numbers
const N9 = new Set(UCL.filter(x => x.rank <= 9).map(x => x.short))
const tot = Object.values(winners).reduce((s, v) => s + v, 0)
const top9 = Object.entries(winners).filter(([k]) => N9.has(k) || RANK.get(k) <= 9).reduce((s, [, v]) => s + v, 0)
console.log(`\nwinners: top-9 coefficient clubs (pot 1) ${(top9 / tot * 100).toFixed(1)}% · pot 2 ${(Object.entries(winners).filter(([k]) => POT.get(k) === 2).reduce((s, [, v]) => s + v, 0) / tot * 100).toFixed(1)}% · pot 3 ${(Object.entries(winners).filter(([k]) => POT.get(k) === 3).reduce((s, [, v]) => s + v, 0) / tot * 100).toFixed(1)}% · pot 4 ${(Object.entries(winners).filter(([k]) => POT.get(k) === 4).reduce((s, [, v]) => s + v, 0) / tot * 100).toFixed(1)}%`)
console.log('most often:', Object.entries(winners).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([k, v]) => `${k} ${(v / tot * 100).toFixed(1)}%`).join(', '))
console.log(`top scorer (every campaign's, him included): mean ${mean(topScorer).toFixed(1)}, median ${pctl(topScorer, 0.5)}, 10th-90th ${pctl(topScorer, 0.1)}-${pctl(topScorer, 0.9)}, in 8-15 ${(mean(topScorer.map(x => (x >= 8 && x <= 15 ? 1 : 0))) * 100).toFixed(0)}%`)
console.log(`goals a game: league phase ${mean(R.map(x => x.r.gpg)).toFixed(2)}, knockouts ${mean(R.map(x => x.r.koGpg)).toFixed(2)}`)
console.log(`draw: same-country meetings ${mean(same).toFixed(2)} a draw, clubs with a third opponent from one country ${mean(three).toFixed(2)} a draw`)
console.log('\nbuild    | club | n  | pos  | KO%  | R16% | QF%  | SF%  | win% | goals | ast | apps | top scorer | POTS | TOTS')
const stagesFrom = { 'League phase': 0, 'Knockout play-offs': 1, 'Round of 16': 2, 'Quarter-finals': 3, 'Semi-finals': 4, 'Runners-up': 5, Winners: 6 }
for (const club of CLUBS) for (const bk of keys) {
  const xs = R.filter(x => x.club === club.short && x.bk === bk).map(x => x.r)
  if (!xs.length) continue
  const p = f => `${(mean(xs.map(x => (f(x) ? 1 : 0))) * 100).toFixed(0).padStart(3)}%`
  console.log(`${bk.padEnd(8)} | ${club.short.padEnd(4)} | ${String(xs.length).padEnd(2)} | ${mean(xs.map(x => x.seed)).toFixed(1).padStart(4)} | ${p(x => x.seed <= 24)} | ${p(x => stagesFrom[x.finish] >= 2)} | ${p(x => stagesFrom[x.finish] >= 3)} | ${p(x => stagesFrom[x.finish] >= 4)} | ${p(x => x.finish === 'Winners')} | ${mean(xs.map(x => x.goals)).toFixed(1).padStart(5)} | ${mean(xs.map(x => x.assists)).toFixed(1).padStart(3)} | ${mean(xs.map(x => x.apps)).toFixed(1).padStart(4)} | ${p(x => x.boot).padStart(10)} | ${p(x => x.poty)} | ${p(x => x.tots)}`)
}
const ex = S.runSoccerSimulation(BUILDS.elite, T, CLUBS[0], 'current', 'show')
console.log(`\nsample (elite at ${ex.team.short}): ${ex.seed}th, ${ex.wins}-${ex.draws}-${ex.losses}; ${ex.finish}; ${ex.goals} G ${ex.assists} A in ${ex.apps}; ties: ${ex.playoffRounds.map(t => `${t.name} v ${t.opponent.short} ${t.agg ? t.agg.join('-') : `${t.legs[0].mySc}-${t.legs[0].oppSc}`}${t.won ? ' W' : ' L'}`).join(', ') || '-'}`)
console.log(`  top scorer ${ex.goldenBoot.winner?.name ?? 'build'} ${ex.goldenBoot.winner?.goals}; POTS ${ex.playerOfSeason.winner?.name ?? 'build'}; winner ${ex.uclWinner}`)
console.log(errs.length ? `\nERRORS (${errs.length}):\n${errs.slice(0, 30).join('\n')}` : '\nevery league phase, table, bracket and line checks out: OK')
process.exitCode = errs.length ? 1 : 0
