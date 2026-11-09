// Baseball sim check: node scripts/baseball/sim-test.mjs [seasons=500] [only=bat|pit|rp|all]
// Bundles src/utils/baseballSimulation.js with esbuild (scripts/baseball/bundle.mjs: src/data/mlb-*.js when the data
// agent's files are there, scripts/baseball/fixture/ when they aren't; BASEBALL_FIXTURE=1 always the fixture).
// Plays N seasons for an elite, good, average and poor batter and starter (and an elite and an average closer) at the
// best and the worst club, prints the averages next to the real numbers they're tuned to, then checks the league
// (standings, the playoff line, runs), determinism by seed, the fast path, script mode and that every line adds up.
import { load } from './bundle.mjs'

const N = Number(process.argv[2] ?? 500)
const ONLY = process.argv[3] ?? 'all'
const { S, used, teams } = await load()
console.log('data:', JSON.stringify(used))
const BT = S.BAT_TRAITS, PT = S.PIT_TRAITS
const mk = (keys, vals) => Object.fromEntries(keys.map((k, i) => [k, { type: k, val: vals[i] }]))
//                     con pow eye avK gap spd br fld arm clu
const BAT = {
  elite: mk(BT, [9, 10, 9, 7, 9, 7, 7, 7, 7, 8]),
  good: mk(BT, [8, 8, 7, 6, 7, 6, 6, 6, 6, 6]),
  average: mk(BT, [6, 6, 6, 6, 6, 6, 6, 6, 6, 6]),
  poor: mk(BT, [4, 3, 4, 4, 3, 4, 4, 4, 4, 3]),
}
//                     vel mov brk chg ctl cmd sta gb cmp iq
const PIT = {
  elite: mk(PT, [10, 9, 9, 8, 9, 9, 9, 7, 9, 9]),
  good: mk(PT, [8, 8, 8, 7, 8, 7, 8, 6, 7, 7]),
  average: mk(PT, [6, 6, 6, 6, 6, 6, 6, 6, 6, 6]),
  poor: mk(PT, [4, 4, 4, 4, 4, 4, 5, 4, 4, 4]),
}
const RP = { 'elite CL': mk(PT, [10, 10, 10, 6, 9, 9, 2, 8, 10, 9]), 'average RP': mk(PT, [6, 6, 6, 5, 6, 6, 2, 6, 6, 6]) }
const byStr = teams.slice().sort((a, b) => (b.off + b.def) - (a.off + a.def))
const TOP = byStr[0], WEAK = byStr[byStr.length - 1]
console.log(`clubs: top ${TOP.short} (off ${TOP.off}, def ${TOP.def}), weak ${WEAK.short} (off ${WEAK.off}, def ${WEAK.def})`)
for (const [k, b] of Object.entries(BAT)) console.log(`bat ${k.padEnd(8)} OVR ${S.calcBaseballOVR(b, BT, 'bat')}  ${S.getBaseballArchetype(S.calcBaseballOVR(b, BT, 'bat'), b, BT, 'bat')}`)
for (const [k, b] of Object.entries({ ...PIT, ...RP })) console.log(`pit ${k.padEnd(10)} OVR ${S.calcBaseballOVR(b, PT, 'pit')}  ${S.baseballPitchRole(b)}  ${S.getBaseballArchetype(S.calcBaseballOVR(b, PT, 'pit'), b, PT, 'pit')}`)

const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
const pct = a => `${(mean(a.map(x => (x ? 1 : 0))) * 100).toFixed(0)}%`
const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '-')
const rate = x => x.toFixed(3).replace(/^0/, '')
const errs = []
const league = { best: [], worst: [], wc3: [], divW: [], sd: [], rg: [], usRG: [], usTarget: [], usRA: [], extra: [], psGames: [], wsLen: [] }
let ms = 0, runs = 0

function check(r, tag) {
  const isBat = r.position === 'bat'
  const pl = r.games.filter(g => !g.sat)
  const sum = k => pl.reduce((s, g) => s + (g[k] ?? 0), 0)
  if (r.games.length !== 162) errs.push(`${tag}: ${r.games.length} games`)
  if (r.wins + r.losses !== 162 || r.games.filter(g => g.won).length !== r.wins) errs.push(`${tag}: record`)
  for (const g of r.games) {
    const bad = []
    if (g.won !== g.mySc > g.oppSc) bad.push('won')
    if (isBat && !g.sat) {
      if (g.rbi > g.mySc || g.r > g.mySc) bad.push('runs>score')
      if (g.h > g.ab || g.hr > g.h || g.doubles + g.triples + g.hr > g.h) bad.push('hits')
      if (g.pa !== g.ab + g.bb + g.hbp + g.sf) bad.push('pa')
    }
    if (!isBat && !g.sat) {
      if (g.r > g.oppSc || g.er > g.r) bad.push('runs allowed')
      if (g.w && !g.won) bad.push('W in a loss'); if (g.l && g.won) bad.push('L in a win'); if (g.sv && !g.won) bad.push('SV in a loss')
      if (g.w + g.l + g.sv > 1 || (g.sv && g.hld)) bad.push('decisions')
    }
    if (bad.length) errs.push(`${tag} g${g.g}: ${bad.join(',')}`)
  }
  if (isBat) { if (sum('hr') !== r.hr || sum('h') !== r.h || sum('rbi') !== r.rbi || sum('pa') !== r.pa) errs.push(`${tag}: totals`) }
  else if (sum('k') !== r.k || sum('outs') !== r.ipOuts && sum('outs') !== r.outs || sum('w') !== r.w) errs.push(`${tag}: totals`)
  // the league
  const all = Object.values(r.divisions).flatMap(l => Object.values(l).flat())
  if (all.length !== 30) errs.push(`${tag}: ${all.length} clubs in the standings`)
  if (all.reduce((s, x) => s + x.wins, 0) !== all.reduce((s, x) => s + x.losses, 0) || all.some(x => x.wins + x.losses !== 162)) errs.push(`${tag}: league W/L`)
  if (all.reduce((s, x) => s + x.rs, 0) !== all.reduce((s, x) => s + x.ra, 0)) errs.push(`${tag}: league RS/RA`)
  const ws = all.map(x => x.wins)
  league.best.push(Math.max(...ws)); league.worst.push(Math.min(...ws))
  for (const lg of ['AL', 'NL']) {
    const rows = Object.values(r.divisions[lg]).flat()
    const s6 = rows.find(x => x.seed === 6); if (s6) league.wc3.push(s6.wins)
    for (const d of Object.values(r.divisions[lg])) league.divW.push(d[0].wins)
  }
  league.sd.push(Math.sqrt(mean(ws.map(w => (w - 81) ** 2))))
  league.rg.push(all.reduce((s, x) => s + x.rs, 0) / (30 * 162))
  league.usRG.push(r.rs / 162); league.usRA.push(r.ra / 162)
  league.extra.push(r.games.filter(g => g.innings > 9).length / 162)
  league.psGames.push(r.postseason.games.length)
  const wsr = r.bracket?.ws; if (wsr) league.wsLen.push(wsr.wins[0] + wsr.wins[1])
  if (r.madePlayoffs !== (r.playoffSeed != null)) errs.push(`${tag}: playoff flag`)
}
const rows = []
function runSet(kind, name, build, club, mode = 'current') {
  const pos = kind === 'bat' ? 'bat' : 'pit'
  const types = pos === 'bat' ? BT : PT
  const out = []
  for (let i = 0; i < N; i++) {
    const t0 = performance.now()
    const r = S.runBaseballSimulation(build, types, { short: club.short }, pos, mode, `${kind}-${name}-${club.short}-${mode}-${i}`)
    ms += performance.now() - t0; runs++
    if (i < 40) check(r, `${kind} ${name} ${club.short}`)
    out.push(r)
  }
  const m = k => mean(out.map(r => r[k] ?? 0))
  const aw = k => pct(out.map(r => r.awards?.[k]?.won || r.awards?.[k]?.selected))
  const row = {
    who: `${kind} ${name} @${club.short}`, ovr: out[0].ovr, role: out[0].role, W: m('wins'), po: pct(out.map(r => r.madePlayoffs)), ws: pct(out.map(r => r.champion)),
  }
  if (pos === 'bat') {
    Object.assign(row, { pos: out[0].pos, G: m('g'), PA: m('pa'), AVG: m('avg'), OBP: m('obp'), SLG: m('slg'), HR: m('hr'), RBI: m('rbi'), R: m('runs'), SB: m('sb'), BB: m('bb'), K: m('k'), 'OPS+': m('opsPlus'), WAR: m('war'),
      MVP: aw('mvp'), SS: aw('silverSlugger'), GG: aw('goldGlove'), AS: aw('allStar'), BT: aw('battingTitle'), HRL: aw('hrLeader'), Aaron: aw('hankAaron'), TC: aw('tripleCrown') })
  } else {
    Object.assign(row, { 'W-L': `${f(m('w'))}-${f(m('l'))}`, ERA: m('era'), G: m('g'), GS: m('gs'), IP: m('ipDec'), K: m('k'), BB: m('bb'), WHIP: m('whip'), SV: m('sv'), HLD: m('hld'), FIP: m('fip'), WAR: m('war'),
      CY: aw('cyYoung'), AS: aw('allStar'), KL: aw('kLeader'), ERAt: aw('eraTitle'), ROTY: aw('reliever'), TC: aw('tripleCrown') })
  }
  rows.push(row)
  return out
}
const t0 = Date.now()
if (ONLY === 'all' || ONLY === 'bat') for (const club of [TOP, WEAK]) for (const [k, b] of Object.entries(BAT)) runSet('bat', k, b, club)
if (ONLY === 'all' || ONLY === 'pit') for (const club of [TOP, WEAK]) for (const [k, b] of Object.entries(PIT)) runSet('pit', k, b, club)
if (ONLY === 'all' || ONLY === 'rp') for (const club of [TOP, WEAK]) for (const [k, b] of Object.entries(RP)) runSet('rp', k, b, club)
// All-Time: the elite bat and arm at the best and the worst franchise (fewer seasons)
const AT = Math.max(20, Math.round(N / 5))
if (ONLY === 'all') {
  const n0 = N
  for (const club of [TOP, WEAK]) {
    const keep = rows.length
    void keep
    for (let i = 0; i < 1; i++) {
      const out = []
      for (let j = 0; j < AT; j++) out.push(S.runBaseballSimulation(BAT.elite, BT, { short: club.short }, 'bat', 'alltime', `at-${club.short}-${j}`))
      const m = k => mean(out.map(r => r[k] ?? 0))
      rows.push({ who: `ALL-TIME bat elite @${club.short}`, ovr: out[0].ovr, role: out[0].role, W: m('wins'), po: pct(out.map(r => r.madePlayoffs)), ws: pct(out.map(r => r.champion)), pos: out[0].pos, G: m('g'), PA: m('pa'), AVG: m('avg'), OBP: m('obp'), SLG: m('slg'), HR: m('hr'), RBI: m('rbi'), R: m('runs'), SB: m('sb'), BB: m('bb'), K: m('k'), 'OPS+': m('opsPlus'), WAR: m('war'), MVP: pct(out.map(r => r.awards.mvp.won)), team: `${out[0].team.off}/${out[0].team.def}` })
      const p = []
      for (let j = 0; j < AT; j++) p.push(S.runBaseballSimulation(PIT.elite, PT, { short: club.short }, 'pit', 'alltime', `atp-${club.short}-${j}`))
      const q = k => mean(p.map(r => r[k] ?? 0))
      rows.push({ who: `ALL-TIME pit elite @${club.short}`, ovr: p[0].ovr, role: p[0].role, W: q('wins'), po: pct(p.map(r => r.madePlayoffs)), ws: pct(p.map(r => r.champion)), 'W-L': `${f(q('w'))}-${f(q('l'))}`, ERA: q('era'), GS: q('gs'), IP: q('ipDec'), K: q('k'), WHIP: q('whip'), FIP: q('fip'), WAR: q('war'), CY: pct(p.map(r => r.awards.cyYoung.won)) })
    }
  }
  void n0
}
const secs = ((Date.now() - t0) / 1000).toFixed(0)

// ── the tables
const BAT_COLS = ['who', 'ovr', 'pos', 'W', 'po', 'ws', 'G', 'PA', 'AVG', 'OBP', 'SLG', 'HR', 'RBI', 'R', 'SB', 'BB', 'K', 'OPS+', 'WAR', 'MVP', 'SS', 'GG', 'AS', 'BT', 'HRL', 'Aaron', 'TC']
const PIT_COLS = ['who', 'ovr', 'role', 'W', 'po', 'ws', 'W-L', 'ERA', 'G', 'GS', 'IP', 'K', 'BB', 'WHIP', 'SV', 'HLD', 'FIP', 'WAR', 'CY', 'AS', 'KL', 'ERAt', 'ROTY', 'TC']
const cell = (k, v) => (typeof v === 'number' ? (['AVG', 'OBP', 'SLG'].includes(k) ? rate(v) : ['ERA', 'WHIP', 'FIP'].includes(k) ? f(v, 2) : ['ovr', 'OPS+', 'G', 'PA', 'GS', 'K', 'BB', 'RBI', 'R', 'SB', 'IP'].includes(k) ? f(v, 0) : f(v, 1)) : v ?? '')
const table = (cols, list) => { console.log('| ' + cols.join(' | ') + ' |'); console.log('|' + cols.map(() => '---').join('|') + '|'); for (const r of list) console.log('| ' + cols.map(c => cell(c, r[c])).join(' | ') + ' |') }
console.log(`\n${runs} seasons (+ All-Time) in ${secs}s, ${f(ms / Math.max(1, runs), 1)} ms a season\n`)
console.log('BATTERS'); table(BAT_COLS, rows.filter(r => r.pos))
console.log('\nPITCHERS'); table(PIT_COLS, rows.filter(r => !r.pos))
console.log('\nLEAGUE (every season above)')
console.log(`  runs a team game ${f(mean(league.rg), 2)} (B-R 2024-26: 4.39-4.48) · his club ${f(mean(league.usRG), 2)} scored, ${f(mean(league.usRA), 2)} allowed`)
console.log(`  best record ${f(mean(league.best))} wins, worst ${f(mean(league.worst))} · division winners ${f(mean(league.divW))} · the 6th seed ${f(mean(league.wc3))} wins (real 2022-26: 83-89, ~86.7)`)
console.log(`  spread of wins (sd) ${f(mean(league.sd))} (real ~12-14) · extra innings ${f(mean(league.extra) * 100)}% of games · his postseason games ${f(mean(league.psGames))} · World Series length ${f(mean(league.wsLen))}`)

// ── determinism, the fast path, rebook, script
const a = S.runBaseballSimulation(BAT.elite, BT, { short: TOP.short }, 'bat', 'current', 'det-1')
const b = S.runBaseballSimulation(BAT.elite, BT, { short: TOP.short }, 'bat', 'current', 'det-1')
const c = S.runBaseballSimulation(BAT.elite, BT, { short: TOP.short }, 'bat', 'current', 'det-2')
const same = JSON.stringify(a) === JSON.stringify(b), differs = JSON.stringify(a.games) !== JSON.stringify(c.games)
const pa = S.runBaseballSimulation(PIT.elite, PT, { short: WEAK.short }, 'pit', 'alltime', 7), pb = S.runBaseballSimulation(PIT.elite, PT, { short: WEAK.short }, 'pit', 'alltime', 7)
console.log(`\ndeterminism: same seed same season ${same && JSON.stringify(pa) === JSON.stringify(pb) ? 'OK' : 'FAILED'}; another seed another season ${differs ? 'OK' : 'FAILED'}`)
const fast = S.runBaseballSimulation(BAT.elite, BT, { short: TOP.short, fast: true }, 'bat', 'current', 'det-1')
const fastSame = JSON.stringify(fast.games) === JSON.stringify(a.games) && fast.awards === null
const rb = S.rebookBaseball(fast, fast.games)
const rbFull = S.rebookBaseball(a, a.games)
const awardsSame = JSON.stringify(rb.awards) === JSON.stringify(a.awards) && JSON.stringify(rbFull.awards) === JSON.stringify(a.awards)
console.log(`fast path (team.fast): same games ${fastSame ? 'OK' : 'FAILED'}; rebookBaseball on it gives the full run's awards ${awardsSame ? 'OK' : 'FAILED'}`)
if (!awardsSame) for (const k of Object.keys(a.awards)) if (JSON.stringify(rb.awards[k]) !== JSON.stringify(a.awards[k])) console.log('  differs:', k, JSON.stringify(rb.awards[k]).slice(0, 200), '|', JSON.stringify(a.awards[k]).slice(0, 200))
// a spliced season: ten more homers in his games, booked again
const spl = a.games.map((g, i) => (i < 10 && !g.sat ? { ...g, hr: g.hr + 1, h: g.h + 1, ab: g.ab + 1, pa: g.pa + 1, rbi: Math.min(g.mySc, g.rbi + 1) } : g))
const rs = S.rebookBaseball(a, spl)
console.log(`rebook a spliced season: HR ${a.hr} -> ${rs.hr}, WAR ${a.war} -> ${rs.war}, MVP rank ${a.awards.mvp.rank} -> ${rs.awards.mvp.rank}`)
// script mode: a squad's season, two builds inside it
const sc = S.scriptBaseballSeason({ short: TOP.short }, { off: TOP.off + 0.5, def: TOP.def }, 'squad-1')
const s1 = S.runBaseballSimulation(BAT.elite, BT, { short: TOP.short }, 'bat', 'current', 'sq-a', 'squad', sc)
const spent = s1.games.map(g => ({ r: g.r ?? 0, rbi: g.rbi ?? 0 }))
const s2 = S.runBaseballSimulation(BAT.good, BT, { short: TOP.short, spent }, 'bat', 'current', 'sq-b', 'squad', sc)
const s3 = S.runBaseballSimulation(PIT.elite, PT, { short: TOP.short }, 'pit', 'current', 'sq-c', 'squad', sc)
const inside = s1.games.every((g, i) => g.mySc === sc.games[i].mySc && (g.rbi ?? 0) + (s2.games[i].rbi ?? 0) <= g.mySc && (g.r ?? 0) <= g.mySc) && s3.games.every((g, i) => (g.r ?? 0) <= sc.games[i].oppSc)
console.log(`script: ${sc.wins}-${sc.losses}, ${sc.madePlayoffs ? 'in' : 'out'}; elite bat ${s1.hr} HR ${s1.rbi} RBI, good bat ${s2.hr} HR ${s2.rbi} RBI, ace ${s3.w}-${s3.l} ${s3.era} ERA; lines inside the scores ${inside ? 'OK' : 'FAILED'}; record the script's ${s1.wins === sc.wins && s3.wins === sc.wins ? 'OK' : 'FAILED'}`)
const lift = S.baseballBuildLift(BAT.elite, { short: WEAK.short }, 'bat'), liftP = S.baseballBuildLift(PIT.elite, { short: WEAK.short }, 'pit')
console.log(`lift at ${WEAK.short} (off ${WEAK.off}, def ${WEAK.def}): elite bat -> off ${lift.off} def ${lift.def} (replaces ${lift.replaced}, plays ${lift.role}); ace -> def ${liftP.def} (replaces ${liftP.replaced})`)
console.log(errs.length ? `\n${errs.length} line errors, first: ${errs.slice(0, 8).join(' · ')}` : '\nevery line adds up: OK')
