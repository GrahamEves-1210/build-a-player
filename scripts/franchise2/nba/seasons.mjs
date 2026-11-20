// NBA Franchise, part C: whole seasons headless with the real rosters (games, rest, injuries, the play-in and four
// best-of-seven rounds, awards, aging, retirements, a two-round draft, a little player movement), then real vs sim.
//   bash scripts/franchise2/run.sh scripts/franchise2/nba/seasons.mjs [seasons=8] [seed=a] [noInj=0]
// (Free agency and trades are core's and B's: here ~12% of veterans change teams each summer at random, enough to
// keep rosters from freezing; the real parity comes from the cap and the market.)
import { makeLeague, schedule, SHORTS, EAST, filler } from './league.mjs'
import * as C from '../../../src/lib/franchise2/nba/sim'
import { TALLY } from '../../../src/lib/franchise2/nba/injury'
import { rngOf } from '../../../src/lib/franchise2/rng'

const N = +(process.argv[2] ?? 8), SEED = process.argv[3] ?? 'a', NOINJ = process.argv[4] === '1'
const F = makeLeague(SEED)
if (NOINJ) F.noInj = 1
TALLY.on = true
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const name = id => { for (const T of Object.values(F.teams)) { const p = T.r.find(x => x.i === id); if (p) return `${p.n} (${T.s})` } return `#${id}` }
const manById = id => { for (const T of Object.values(F.teams)) { const p = T.r.find(x => x.i === id); if (p) return p } return null }
const S = { seasons: [], ageDelta: {}, retire: [], champs: {}, draft: [] }
const t0 = performance.now()

function series(hi, lo, R, y, tag) {
  const se = { hi, lo, g: [], wh: 0, wl: 0, done: null }
  const HOME = [hi, hi, lo, lo, hi, lo, hi]
  for (let k = 0; se.wh < 4 && se.wl < 4; k++) {
    const h = HOME[k], a = h === hi ? lo : hi
    const g = { d: 1000 + k, h, a, po: true }
    const r = C.simGame(F, h, a, { seed: `${SEED}-${y}-${tag}-${k}`, playoff: true })
    C.recordGame(F, g, r, { playoff: true, series: se })
    C.rollInjuries(F, g, r); C.tickInjuries(F, h); C.tickInjuries(F, a)
    const hw = r.hs > r.as
    se.g.push({ h, hs: r.hs, as: r.as, ot: r.ot })
    if ((hw && h === hi) || (!hw && a === hi)) se.wh++; else se.wl++
  }
  se.done = se.wh === 4 ? hi : lo
  return se
}
function single(h, a, y, tag) {
  const g = { d: 999, h, a, po: true }
  const r = C.simGame(F, h, a, { seed: `${SEED}-${y}-${tag}`, playoff: true })
  C.rollInjuries(F, g, r); C.tickInjuries(F, h); C.tickInjuries(F, a)
  return r.hs > r.as ? h : a
}

for (let y = 0; y < N; y++) {
  const year = F.year, R = rngOf(`seasons-${SEED}-${year}`)
  F.ss = {}; F.ps = {}; F.phase = 'season'
  F.sched = schedule(SEED, year)
  const res = []
  let asDone = false, lastDay = 0
  const ovrStart = new Map(Object.values(F.teams).flatMap(T => T.r.map(p => [p.i, { o: p.o, ag: p.ag }])))
  for (const g of F.sched) {
    if (!asDone && g.d > 85) { asDone = true; S.as = C.allStars(F); C.tickInjuries(F, 6) }
    if (g.d !== lastDay) { for (const s of SHORTS) C.tickInjuries(F, s); F.day = g.d; lastDay = g.d }
    C.restFor(F, g.h, g, g.b2b.h); C.restFor(F, g.a, g, g.b2b.a)
    const r = C.simGame(F, g.h, g.a, { seed: `${SEED}-${year}-${g.d}-${g.h}` })
    g.hs = r.hs; g.as = r.as; g.ot = r.ot
    C.recordGame(F, g, r)
    C.rollInjuries(F, g, r)
    res.push({ ...r, h: g.h, a: g.a })
    for (const [s, lines] of Object.entries(r.box)) {
      const n = lines.filter(l => l.min > 0).length, sum = lines.reduce((x, l) => x + l.min, 0)
      if (n < 7 || sum < 236 || sum > 270 + 25 * r.ot) bad(`${year} ${s} box: ${n} played, ${sum} minutes`)
      if (lines.reduce((x, l) => x + l.pts, 0) !== (s === g.h ? r.hs : r.as)) bad(`${year} ${s} box points don't add up`)
    }
  }
  // standings, play-in, bracket
  const W = C.winsOf(F)
  const conf = c => SHORTS.filter(s => (EAST.has(s) ? 'E' : 'W') === c).sort((a, b) => (W.w[b] ?? 0) - (W.w[a] ?? 0) || (a < b ? -1 : 1))
  const seeds = {}
  for (const c of ['E', 'W']) {
    const t = conf(c)
    const w78 = single(t[6], t[7], year, `pi78${c}`), l78 = w78 === t[6] ? t[7] : t[6]
    const w910 = single(t[8], t[9], year, `pi910${c}`)
    const eighth = single(l78, w910, year, `pi8${c}`)
    seeds[c] = [...t.slice(0, 6), w78, eighth]
  }
  F.phase = 'playoffs'
  const rounds = []
  let alive = { E: seeds.E, W: seeds.W }
  const sMvp = {}
  for (let rd = 0; rd < 3; rd++) {
    const nx = {}
    for (const c of ['E', 'W']) {
      const L = alive[c], out = []
      const pairs = rd === 0 ? [[0, 7], [3, 4], [2, 5], [1, 6]] : Array.from({ length: L.length / 2 }, (_, j) => [2 * j, 2 * j + 1])
      for (const [x, z] of pairs) {
        const [hi, lo] = (W.w[L[x]] ?? 0) >= (W.w[L[z]] ?? 0) ? [L[x], L[z]] : [L[z], L[x]]
        const se = series(hi, lo, R, year, `r${rd}${c}${x}`)
        rounds.push(se); out.push(se.done)
        S.ser = [...(S.ser ?? []), { fav: se.done === hi, gap: (W.w[hi] ?? 0) - (W.w[lo] ?? 0) }]
        if (rd === 2) sMvp[c] = C.seriesMvp(F, se)
      }
      nx[c] = out
    }
    alive = nx
  }
  const [e, w] = [alive.E[0], alive.W[0]]
  const [hi, lo] = (W.w[e] ?? 0) >= (W.w[w] ?? 0) ? [e, w] : [w, e]
  const fin = series(hi, lo, R, year, 'finals')
  const champ = fin.done, fmvp = C.finalsMvp(F, fin)
  S.champs[champ] = (S.champs[champ] ?? 0) + 1
  // the season's numbers
  const T = C.teamSeason(res), L = Object.values(T)
  const avg = k => L.reduce((s, t) => s + t[k] / t.g, 0) / L.length
  const pct = (m, a) => L.reduce((s, t) => s + t[m], 0) / L.reduce((s, t) => s + t[a], 0) * 100
  const lead = k => C.leadersIn(F.ss, k, { n: 40 })
  const wins = SHORTS.map(s => W.w[s] ?? 0).sort((a, b) => b - a)
  const aw = C.seasonAwards(F)
  // (core's closeSeason: the lines onto car, the awards onto aw)
  const men = new Map(Object.values(F.teams).flatMap(T => T.r.map(p => [p.i, p])))
  for (const [id, l] of Object.entries(F.ss)) { const p = men.get(+id); if (p) (p.car ??= []).push(C.careerRow(year, l.s, l)) }
  const give = (id, k) => { const p = men.get(id); if (p) (p.aw ??= []).push({ y: year, k }) }
  for (const k of ['MVP', 'DPOY', 'ROY', '6MOY', 'MIP', 'CLUTCH']) if (aw[k] != null) give(aw[k], k)
  aw.ALL.forEach((t, j) => t.forEach(id => give(id, `ALL${j + 1}`)))
  const recNews = C.updateRecords(F)
  const inj = TALLY.rows.filter(r => r.y === year)
  const lost = inj.reduce((s, r) => s + Math.min(r.g, 90), 0)
  // the 65-game rule: how many of the season's top 20 scorers by average qualified
  const top20 = Object.entries(F.ss).map(([id, r]) => ({ id: +id, r, v: C.perGame(r).ppg })).filter(x => x.r.gp >= 20).sort((a, b) => b.v - a.v).slice(0, 20)
  const row = {
    year, ppg: avg('pts'), pace: L.reduce((s, t) => s + t.pace, 0) / 30, tpa: avg('tpa'), fgp: pct('fgm', 'fga'), tpp: pct('tpm', 'tpa'), ftp: pct('ftm', 'fta'),
    reb: avg('reb'), ast: avg('ast'), stl: avg('stl'), blk: avg('blk'), tov: avg('tov'), fta: avg('fta'),
    home: res.filter(r => r.hs > r.as).length / res.length * 100, margin: res.reduce((s, r) => s + r.hs - r.as, 0) / res.length,
    lppg: lead('ppg')[0], lrpg: lead('rpg')[0], lapg: lead('apg')[0], n30: lead('ppg').filter(x => x.v >= 30).length,
    best: wins[0], worst: wins[29], champ, fmvp, aw, injN: inj.filter(r => !r.po).length, lost, acl: inj.filter(r => r.k === 'torn ACL').length, ach: inj.filter(r => r.k === 'ruptured Achilles').length,
    ankle: inj.filter(r => r.k === 'sprained ankle').length, q65: top20.filter(x => C.eligible(x.r)).length,
    top150: Object.values(F.teams).flatMap(T => T.r).map(p => p.o).sort((a, b) => b - a).slice(0, 150).reduce((x, y) => x + y, 0) / 150, starsDr: Object.values(F.teams).flatMap(T => T.r).filter(p => p.o >= 88 && p.dr).length, stars: Object.values(F.teams).flatMap(T => T.r).filter(p => p.o >= 88).length, s90: Object.values(F.teams).flatMap(T => T.r).filter(p => p.o >= 90).length,
  }
  S.seasons.push(row)
  console.log(`\n${year}-${(year + 1) % 100}: PPG ${row.ppg.toFixed(1)} pace ${row.pace.toFixed(1)} 3PA ${row.tpa.toFixed(1)} FG% ${row.fgp.toFixed(1)} 3P% ${row.tpp.toFixed(1)} FT% ${row.ftp.toFixed(1)} | home ${row.home.toFixed(1)}% +${row.margin.toFixed(2)}`)
  console.log(`  wins ${wins.join(' ')}`)
  console.log(`  leaders: ${name(row.lppg.i)} ${row.lppg.v} ppg · ${name(row.lrpg.i)} ${row.lrpg.v} rpg · ${name(row.lapg.i)} ${row.lapg.v} apg · ${row.n30} at 30+`)
  const champRank = SHORTS.filter(x => (W.w[x] ?? 0) > (W.w[champ] ?? 0)).length + 1
  S.champRank = [...(S.champRank ?? []), champRank]
  console.log(`  champion ${champ} (${W.w[champ]} wins, #${champRank} in the league) over ${champ === hi ? lo : hi} (${fin.wh}-${fin.wl}), Finals MVP ${name(fmvp)} · ECF ${name(sMvp.E)} · WCF ${name(sMvp.W)}`)
  console.log(`  MVP ${name(aw.MVP)} · DPOY ${name(aw.DPOY)} · ROY ${name(aw.ROY)} · 6MOY ${name(aw['6MOY'])} · MIP ${name(aw.MIP)} · Clutch ${name(aw.CLUTCH)}`)
  console.log(`  All-NBA 1st: ${aw.ALL[0].map(name).join(', ')}`)
  console.log(`  All-Stars East: ${S.as.E.slice(0, 5).map(name).join(', ')} …`)
  console.log(`  injuries ${row.injN} (${(row.injN / 30).toFixed(1)} a team), ~${Math.round(lost / 30)} games lost a team, ${row.ankle} ankle sprains, ACL ${row.acl}, Achilles ${row.ach} · top-20 scorers eligible for awards: ${row.q65}/20 · men 88+: ${row.stars} (${row.starsDr} drafted here), 90+: ${row.s90} · mean OVR of the top 150: ${row.top150.toFixed(1)}`)
  for (const n of recNews.slice(0, 2)) console.log('  record: ' + n.text)
  // checks
  for (const s of SHORTS) if ((W.g[s] ?? 0) !== 82) bad(`${year} ${s} played ${W.g[s]}`)
  if (!aw.MVP || aw.ALL.flat().length !== 15 || new Set(aw.ALL.flat()).size !== 15) bad(`${year} All-NBA ${aw.ALL.flat().length}`)
  for (const k of ['MVP', 'DPOY', '6MOY', 'MIP', 'CLUTCH']) { const r = F.ss[aw[k]]; if (r && !C.eligible(r)) bad(`${year} ${k} under 65 games`) }
  const roy = manById(aw.ROY); if (roy && roy.rk !== year && year !== 2026) bad(`${year} ROY ${roy.n} not a rookie`)

  // ── the offseason ──
  F.phase = 'off'
  const { retired } = C.ageLeague(F)
  for (const p of retired) S.retire.push({ ag: p.ag, o: p.o, peak: Math.max(p.o, ...(p.pkSeen ?? [p.o])), real: !p.n.startsWith('Filler') && !p.n.startsWith('Pick') })
  for (const T of Object.values(F.teams)) for (const p of T.r) {
    const was = ovrStart.get(p.i); if (!was) continue
    ;(S.ageDelta[was.ag] ??= []).push(p.o - was.o)
    p.pkSeen = [...(p.pkSeen ?? []), p.o]
  }
  C.tickInjuries(F, 130)
  // the draft: worst record first (no lottery here: core's), two rounds of 30
  const order = SHORTS.slice().sort((a, b) => (W.w[a] ?? 0) - (W.w[b] ?? 0))
  let rank = 1
  for (let rd = 1; rd <= 2; rd++) for (const s of order) {
    const x = C.prospect(R, { rank })
    const p = { ...x, i: F.nid++, n: `Pick ${year + 1}-${rank}`, rk: year + 1, dr: [year + 1, rd, rank, s], ys: 0, draftO: x.o, draftPk: x.pk }
    F.teams[s].r.push(p); S.draft.push(p); rank++
  }
  // movement: veterans change teams now and then (the market's stand-in), then each roster to 15
  // (the cap's stand-in: the deepest team can't keep everyone. With the tax and the aprons a contender loses a
  // good man most summers; here the top team by its best eight loses one of its best four, 25 or older, half the time)
  const depth = s => F.teams[s].r.map(p => p.o).sort((a, b) => b - a).slice(0, 8).reduce((x, y) => x + y, 0)
  const rich = SHORTS.slice().sort((a, b) => depth(b) - depth(a))[0]
  const moving = []
  if (R.u() < 0.5) { const T = F.teams[rich], best = T.r.filter(p => p.ag >= 25).sort((a, b) => b.o - a.o).slice(0, 4); const p = best[R.int(0, best.length - 1)]; if (p) { T.r.splice(T.r.indexOf(p), 1); moving.push(p) } }
  for (const s of SHORTS) {
    const T = F.teams[s]
    T.r = T.r.filter(p => { if (p.ag >= 24 && !p.rk && R.u() < 0.12) { moving.push(p); return false } if (p.rk && p.ag >= 24 && R.u() < 0.12) { moving.push(p); return false } return true })
  }
  for (const p of R.shuffle(moving)) {
    const fewest = Math.min(...SHORTS.map(x => F.teams[x].r.length)), open = SHORTS.filter(x => F.teams[x].r.length <= fewest + 1), s = open[R.int(0, open.length - 1)]
    F.teams[s].r.push(p)
  }
  for (const s of SHORTS) {
    const T = F.teams[s]
    T.r.sort((a, b) => b.o + (b.pk - b.o) * 0.4 - (a.o + (a.pk - a.o) * 0.4))
    F.fa.push(...T.r.splice(15))
    while (T.r.length < 14) T.r.push(filler(F, R))
  }
  F.fa = F.fa.filter(p => p.ag < 34).slice(-120)
  F.year++
}

// ── Age curve, retirements, the draft ──
console.log('\nOVR change by age (mean over every man and season):')
console.log(Object.keys(S.ageDelta).map(Number).sort((a, b) => a - b).filter(a => a >= 19 && a <= 39).map(a => `${a}:${(S.ageDelta[a].reduce((x, y) => x + y, 0) / S.ageDelta[a].length).toFixed(1)}`).join(' '))
const ret = S.retire.filter(r => r.real || true)
const median = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0 }
const starRet = ret.filter(r => r.peak >= 88), roleRet = ret.filter(r => r.peak < 80 && r.peak >= 72)
console.log(`retirements ${ret.length} (${(ret.length / N).toFixed(0)} a season): stars (peak 88+) median age ${median(starRet.map(r => r.ag))} (n ${starRet.length}), role players (peak 72-79) ${median(roleRet.map(r => r.ag))} (n ${roleRet.length})`)
const dr = S.draft.filter(p => p.rk <= F.year - 4)
const best = p => { const m = manById(p.i); return Math.max(m?.o ?? 0, ...(m?.pkSeen ?? [p.o])) }
const bucket = (lo, hi) => { const g = dr.filter(p => p.dr[2] >= lo && p.dr[2] <= hi); return g.length ? `${(g.filter(p => best(p) >= 88).length / g.length * 100).toFixed(0)}% stars (88+), ${(g.filter(p => best(p) >= 80).length / g.length * 100).toFixed(0)}% starters (80+), ${(g.filter(p => best(p) < 74).length / g.length * 100).toFixed(0)}% busts (<74) of ${g.length}` : '—' }
console.log(`drafted 4+ seasons ago: picks 1-5 ${bucket(1, 5)} | 6-14 ${bucket(6, 14)} | 15-30 ${bucket(15, 30)} | 31-60 ${bucket(31, 60)}`)
const pops = dr.filter(p => p.dr[2] > 20 && best(p) >= 85).length
console.log(`late picks (21+) who became 85+: ${pops}`)
console.log('champions:', Object.entries(S.champs).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(', '))

// ── Real vs sim ──
const A = k => S.seasons.reduce((s, r) => s + (typeof r[k] === 'object' ? r[k].v : r[k]), 0) / S.seasons.length
const rng = k => { const v = S.seasons.map(r => (typeof r[k] === 'object' ? r[k].v : r[k])); return `${Math.min(...v).toFixed(1)}-${Math.max(...v).toFixed(1)}` }
const most = Math.max(...Object.values(S.champs))
const rows = [
  ['Team PPG', '110-120 (113.8 in 2024-25)', A('ppg').toFixed(1), rng('ppg')],
  ['Pace (possessions a team)', '~99-100', A('pace').toFixed(1), rng('pace')],
  ['3PA a game', '35-40 (37.6)', A('tpa').toFixed(1), rng('tpa')],
  ['FG% / 3P% / FT%', '47.1 / 36.0 / 78.1', `${A('fgp').toFixed(1)} / ${A('tpp').toFixed(1)} / ${A('ftp').toFixed(1)}`, ''],
  ['REB / AST / STL / BLK / TOV', '43.8 / 26.5 / 8.2 / 4.9 / 14.4', `${A('reb').toFixed(1)} / ${A('ast').toFixed(1)} / ${A('stl').toFixed(1)} / ${A('blk').toFixed(1)} / ${A('tov').toFixed(1)}`, ''],
  ['FTA a game', '~22', A('fta').toFixed(1), rng('fta')],
  ['Home win % / margin', '~54-56% / +2 to +3', `${A('home').toFixed(1)}% / +${A('margin').toFixed(2)}`, ''],
  ['Scoring leader (ppg)', '30-34', A('lppg').toFixed(1), rng('lppg')],
  ['Rebound leader (rpg)', '12-14', A('lrpg').toFixed(1), rng('lrpg')],
  ['Assist leader (apg)', '9-11', A('lapg').toFixed(1), rng('lapg')],
  ['Players at 30+ ppg', '1-3', A('n30').toFixed(1), rng('n30')],
  ['Best record (wins)', '60-68', A('best').toFixed(1), rng('best')],
  ['Worst record (wins)', '15-25', A('worst').toFixed(1), rng('worst')],
  ['Injuries costing games, a team', '~20-25', (A('injN') / 30).toFixed(1), ''],
  ['Games lost to injury, a team', '~150-220', (A('lost') / 30).toFixed(0), ''],
  ['Torn ACLs / Achilles a season', '~2-4 / ~2-5', `${A('acl').toFixed(1)} / ${A('ach').toFixed(1)}`, ''],
  ['Top-20 scorers meeting the 65-game rule', '~12-15 of 20', A('q65').toFixed(1), rng('q65')],
  ['Players 88+ OVR (league talent)', `${S.seasons[0].stars} at the start`, A('stars').toFixed(1), rng('stars')],
  ['Mean OVR, the top 150 men', `${S.seasons[0].top150.toFixed(1)} at the start`, A('top150').toFixed(1), rng('top150')],
  ['Retirement age, stars / role players', '36-40 / 32-35', `${median(starRet.map(r => r.ag))} / ${median(roleRet.map(r => r.ag))}`, ''],
  ['Champion: regular-season rank', 'the best record wins it ~35-45%', `#1 in ${S.champRank.filter(x => x === 1).length} of ${N}`, `ranks ${S.champRank.join(' ')}`],
  ['Series won by the better record', '~75% (first round ~80%)', `${(S.ser.filter(x => x.fav).length / S.ser.length * 100).toFixed(0)}%`, `gap 10+ wins: ${(S.ser.filter(x => x.gap >= 10 && x.fav).length / Math.max(1, S.ser.filter(x => x.gap >= 10).length) * 100).toFixed(0)}%`],
  ['Most titles by one team', `${N} seasons: rarely 3+`, String(most), `${Object.keys(S.champs).length} different champions`],
]
console.log('\n' + 'REAL vs SIM'.padEnd(44) + 'REAL'.padEnd(32) + 'SIM (mean)'.padEnd(26) + 'SIM range')
for (const r of rows) console.log(r[0].padEnd(44) + r[1].padEnd(32) + r[2].padEnd(26) + r[3])
console.log(`\n${problems.length} problems · ${((performance.now() - t0) / 1000).toFixed(0)}s`)
if (problems.length) process.exitCode = 1
