// The league's realism over many seasons (G3, 2026-11-17): stat leaders against the NFL's typical ones, the awards
// (MVP / OPOY winners, Pro Bowl and All-Pro by spot and by team), the coaching carousel (who gets fired and why),
// development (one-year moves by age, after a big injury, the builds) and the league's age mix and stars.
//   bash scripts/franchise2/run.sh scripts/franchise2/realism.mjs [franchises=2] [seasons=10] [out.json]
// Every franchise is a CPU-run league with the player's team on autopilot (no moments; the quick offseason).
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { QBS } from '../../src/data/qbs'
import { WRS } from '../../src/data/wrs'
import { ovrOf } from '../../src/lib/squadSeason'
import { writeFileSync } from 'fs'

const NF = Number(process.argv[2] ?? 2), NS = Number(process.argv[3] ?? 10), OUT = process.argv[4] ?? null
FR.useContracts(CONTRACTS)
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const TEAMS = ['DEN', 'DET', 'CIN', 'TEN', 'KC', 'NYJ']
const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const rows = []   // a row a season
const t0 = Date.now()
const pct = (a, b) => (b ? +((100 * a) / b).toFixed(1) : 0)
const r1 = v => Math.round(v * 10) / 10

function leadersOf(F) {
  const tot = FR.leagueStats(F)
  const man = {}
  for (const s of FR.SHORTS) {
    const L = new Set(Object.values(FR.startersOf(F, s)).map(p => p.i))
    for (const p of F.teams[s].r) man[p.i] = { p, s, st: L.has(p.i) }
  }
  const top = (k, f = () => true) => Object.entries(tot).filter(([id, t]) => t[k] && man[id] && f(man[id].p)).sort((a, b) => b[1][k] - a[1][k]).slice(0, 5)
    .map(([id, t]) => ({ v: t[k], n: man[id].p.n, s: man[id].s, o: man[id].p.o, ag: man[id].p.ag, st: man[id].st, b: man[id].p.b != null }))
  return {
    sck: top('sck'), dint: top('dint'), int: top('int', p => p.p === 'qb'), ry: top('ry'), ryd: top('ryd'), ptd: top('ptd', p => p.p === 'qb'), fgm: top('fgm'), py: top('py', p => p.p === 'qb'),
  }
}
function leagueAvg(F) {
  const tot = FR.leagueStats(F)
  let pts = 0, games = 0
  for (const wk of F.sched.weeks) for (const g of wk) if (g.hs != null) { pts += g.hs + g.as; games += 2 }
  const sum = k => Object.values(tot).reduce((a, t) => a + (t[k] ?? 0), 0)
  // the production split: each team's top back's share of the backs' yards, the top receiver's share of the
  // receiving yards
  const rb1 = [], wr1 = []
  for (const s of FR.SHORTS) {
    const r = F.teams[s].r
    const ry = r.filter(p => p.p === 'rb').map(p => tot[p.i]?.ry ?? 0).sort((a, b) => b - a), all = ry.reduce((a, b) => a + b, 0)
    if (all) rb1.push(ry[0] / all)
    const rc = r.filter(p => ['wr', 'te', 'rb'].includes(p.p)).map(p => tot[p.i]?.ryd ?? 0).sort((a, b) => b - a), ra = rc.reduce((a, b) => a + b, 0)
    if (ra) wr1.push(rc[0] / ra)
  }
  const m = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
  const r2 = v => Math.round(v * 100) / 100
  return { ppg: r1(pts / games), fga: r2(sum('fga') / games), fgm: r2(sum('fgm') / games), sck: r2(sum('sck') / games), int: r2(sum('dint') / games), ry: r1(sum('ry') / games), py: r1(sum('py') / games), rb1: r1(m(rb1) * 100), wr1: r1(m(wr1) * 100) }
}
function ageMix(F) {
  const all = FR.SHORTS.flatMap(s => F.teams[s].r)
  const st = FR.SHORTS.flatMap(s => Object.values(FR.startersOf(F, s)))
  const b = { '<=24': 0, '25-29': 0, '30+': 0 }
  for (const p of all) b[p.ag <= 24 ? '<=24' : p.ag <= 29 ? '25-29' : '30+']++
  return { n: all.length, u24: pct(b['<=24'], all.length), mid: pct(b['25-29'], all.length), o30: pct(b['30+'], all.length), st30: pct(st.filter(p => p.ag >= 30).length, st.length), age: r1(all.reduce((a, p) => a + p.ag, 0) / all.length), n90: all.filter(p => p.o >= 90).length, star: [[0, 24], [25, 27], [28, 29], [30, 99]].map(([a, b]) => all.filter(p => p.o >= 90 && p.ag >= a && p.ag <= b).length).join('/'), gap: [[0, 23], [24, 25], [26, 28]].map(([a, b]) => { const m = all.filter(p => p.ag >= a && p.ag <= b && !p.fl); return r1(m.reduce((x, p) => x + Math.max(0, (p.pk ?? p.o) - p.o), 0) / Math.max(1, m.length)) }).join('/'), n85: all.filter(p => p.o >= 85).length, mean: r1(st.reduce((a, p) => a + p.o, 0) / st.length) }
}

for (let f = 0; f < NF; f++) {
  const team = TEAMS[f % TEAMS.length]
  // (the builds: about an 80 each, a typical spin, so there's room to grow)
  const near = (list, pos, o) => list.filter(p => p.attrs).sort((a, b) => Math.abs(ovrOf(pos, asBuild(a)) - o) - Math.abs(ovrOf(pos, asBuild(b)) - o))[0]
  const qb = near(QBS, 'qb', 79), wr = near(WRS, 'wr', 80)
  const F = FR.createFranchise({ seed: `real-${f}`, team, owner: 'Graham', builds: f % 2 ? [] : [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Hale', num: 7 }, { pos: 'wr', build: asBuild(wr), name: 'Dre Collins', num: 11 }], coach: { name: 'Coach Reyes', style: 'developer', r: { talentDev: 7, offPlaycalling: 7, defPlaycalling: 5, culture: 6, situational: 6 } } })
  const row0 = { f, y: F.year - 1, ages: ageMix(F) }
  rows.push(row0)
  for (let y = 0; y < NS; y++) {
    const row = { f, y: F.year }
    while (F.phase === 'season') { FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0) }
    // the season's injuries, the big ones (for development): before the playoffs clear nothing; season-enders stay on p.ij
    FR.intoPlayoffs(F)
    while (F.phase === 'playoffs') FR.playWeek(F, { moments: false })
    row.lead = leadersOf(F)
    row.avg = leagueAvg(F)
    const rec = FR.records(F)
    FR.closeSeason(F)
    const aw = F.aw
    const qbLine = id => { const t = FR.leagueStats(F)[id]; return t ? { py: t.py ?? 0, ptd: t.ptd ?? 0, int: t.int ?? 0 } : null }
    row.mvp = aw.mvp && { n: aw.mvp.n, t: aw.mvp.t, p: aw.mvp.p, w: rec[aw.mvp.t].w, ...(aw.mvp.p === 'qb' && qbLine(aw.mvp.i)), line: aw.mvp.line }
    row.opoy = aw.opoy && { n: aw.opoy.n, t: aw.opoy.t, p: aw.opoy.p, line: aw.opoy.line }
    row.dpoy = aw.dpoy && { n: aw.dpoy.n, t: aw.dpoy.t, p: aw.dpoy.p, line: aw.dpoy.line }
    // the honors: by spot and by team, the champion's, the best men's
    const spotOf = p => (p.p === 'ol' ? (p.s === 'C' ? 'c' : p.s === 'LG' || p.s === 'RG' ? 'og' : 'ot') : FR.groupOf(p))
    const byId = {}
    for (const s of FR.SHORTS) for (const p of F.teams[s].r) byId[p.i] = { p, s }
    const hon = { ap: {}, pb: {}, team: {}, apTeam: {} }
    for (const [id, h] of Object.entries(aw.hon)) {
      const x = byId[id]; if (!x) continue
      const k = spotOf(x.p)
      hon.pb[k] = (hon.pb[k] ?? 0) + 1
      if (h === 'AP') { hon.ap[k] = (hon.ap[k] ?? 0) + 1; hon.apTeam[x.s] = (hon.apTeam[x.s] ?? 0) + 1 }
      hon.team[x.s] = (hon.team[x.s] ?? 0) + 1
    }
    const champ = F.po.champ
    const stars = s => F.teams[s].r.filter(p => p.o >= 94).length
    hon.champ = { s: champ, w: rec[champ].w, n94: stars(champ), pb: hon.team[champ] ?? 0, ap: hon.apTeam[champ] ?? 0 }
    // the best men in the league by rating: how many of the top 30 got in
    const top30 = Object.values(byId).filter(x => x.p.p !== 'k').sort((a, b) => b.p.o - a.p.o).slice(0, 30)
    hon.top30 = top30.filter(x => aw.hon[x.p.i]).length
    const ol = Object.values(byId).filter(x => x.p.p === 'ol' && aw.hon[x.p.i])
    hon.olAvgO = ol.length ? r1(ol.reduce((a, x) => a + x.p.o, 0) / ol.length) : 0
    hon.n = Object.keys(aw.hon).length
    row.hon = hon
    // the coaching carousel: the head coaches fired, with their tenure and their records
    row.fire = F.car.ev.filter(e => e.k === 'fire' && e.role === 'hc').map(e => { const T = FR.staffOf(F, e.s); return { s: e.s, n: e.n, yrs: e.yrs, rec: e.rec, hist: (T.rec ?? []).map(r => r[0]).join(',') } })
    row.fireC = F.car.ev.filter(e => e.k === 'fire' && e.role !== 'hc' && !e.newHC).length
    FR.closeCarousel(F)
    // development: every man's OVR before and after the year
    const before = new Map()
    for (const s of FR.SHORTS) for (const p of F.teams[s].r) before.set(p.i, { o: p.o, ag: p.ag, p: p.p, s: p.s, se: (p.yi ?? (p.ij?.se ? 2 : 0)) >= 2, ij: p.ij?.l ?? (p.yi ? `inj ${p.yi}` : null), yi: p.yi ?? 0, b: p.b != null, pk: p.pk })
    FR.ageLeague(F)
    const dev = []
    for (const s of FR.SHORTS) for (const p of F.teams[s].r) { const x = before.get(p.i); if (x) dev.push({ ...x, d: p.o - x.o, ag1: p.ag }) }
    const ds = a => { const v = a.map(x => x.d).sort((m, n) => m - n); return v.length ? { n: v.length, mean: r1(v.reduce((m, n) => m + n, 0) / v.length), p5: v[Math.floor(v.length * 0.05)], p95: v[Math.floor(v.length * 0.95)], max: v[v.length - 1], min: v[0], gt4: pct(v.filter(d => d > 4).length, v.length), ge7: v.filter(d => d >= 7).length } : null }
    row.dev = {
      all: ds(dev), young: ds(dev.filter(x => x.ag <= 24)), mid: ds(dev.filter(x => x.ag >= 25 && x.ag <= 28)), old: ds(dev.filter(x => x.ag >= 29)),
      oldUp: pct(dev.filter(x => x.ag >= 29 && x.d > 0).length, dev.filter(x => x.ag >= 29).length), oldUp3: dev.filter(x => x.ag >= 29 && x.d >= 3).length, ol30: dev.filter(x => x.ag >= 30 && x.p === 'ol' && x.d >= 3).map(x => `${x.ag} +${x.d}`),
      se: ds(dev.filter(x => x.se)), seList: dev.filter(x => x.se).slice(0, 6).map(x => `${x.p} ${x.ag} ${x.ij} ${x.d >= 0 ? '+' : ''}${x.d}`),
      builds: dev.filter(x => x.b).map(x => `${x.p} ${x.ag}:${x.o}${x.d >= 0 ? '+' : ''}${x.d}`),
    }
    FR.openResign(F)
    for (const id of [...F.rs]) { const p = F.teams[team].r.find(x => x.i === id); FR.resignOne(F, id, FR.optionDue(p) ? (p.o >= 80 ? 'option' : 'decline') : p.b != null || p.o >= 76) }
    FR.openFA(F); while (F.fad) FR.nextFADay(F)
    FR.openDraft(F); FR.startNight(F)
    while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
    FR.closeDraft(F); FR.newSeason(F)
    row.ages = ageMix(F)
    // the flow: who left the league this offseason (retired, or nobody signed him) and who came in, by age
    {
      const now = new Map(); for (const s of FR.SHORTS) for (const p of F.teams[s].r) now.set(p.i, p)
      const out = [...before.entries()].filter(([i]) => !now.has(i)), inn = [...now.values()].filter(p => !before.has(p.i))
      const bk = a => (a <= 24 ? 'u25' : a <= 29 ? 'mid' : 'o30')
      const cnt = (list, f) => { const c = { u25: 0, mid: 0, o30: 0 }; for (const x of list) c[bk(f(x))]++; return c }
      row.flow = { out: cnt(out, ([, x]) => x.ag + 1), in: cnt(inn, p => p.ag), outN: out.length, inN: inn.length }
    }
    rows.push(row)
    const L = row.lead, A = row.ages
    console.log(`${row.y} f${f} · ppg ${row.avg.ppg} fga ${row.avg.fga} · SCK ${L.sck[0]?.v} INT ${L.dint[0]?.v} INTt ${L.int[0]?.v} RY ${L.ry[0]?.v}(${L.ry[0]?.o}) RCY ${L.ryd[0]?.v} PTD ${L.ptd[0]?.v} FGM ${L.fgm[0]?.v} · MVP ${row.mvp?.n} ${row.mvp?.t} ${row.mvp?.w}w ${row.mvp?.int ?? ''}i · OPOY ${row.opoy?.n} · champ ${hon.champ.s} ${hon.champ.w}w 94+:${hon.champ.n94} PB ${hon.champ.pb} AP ${hon.champ.ap} · OL PB ${(hon.pb.ot ?? 0) + (hon.pb.og ?? 0) + (hon.pb.c ?? 0)} · fired ${row.fire.map(x => `${x.s}(${x.yrs}y ${x.rec} [${x.hist}])`).join(' ')} · dev ±4+ ${row.dev.all.gt4}% max ${row.dev.all.max} 29+up ${row.dev.oldUp}% se ${row.dev.se?.mean ?? '-'} · 30+ ${A.o30}% 90+ ${A.n90} age ${A.age} · ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  }
}

// ── The summary ──────────────────────────────────────────────────────────────
const S = rows.filter(r => r.lead)
const dist = k => S.map(r => r.lead[k][0]?.v ?? 0).sort((a, b) => a - b)
const q = (a, f) => a[Math.min(a.length - 1, Math.floor(a.length * f))]
const line = (k, lab) => { const a = dist(k); return `${lab.padEnd(10)} min ${a[0]} · median ${q(a, 0.5)} · max ${a[a.length - 1]} · [${a.join(' ')}]` }
console.log(`\n${S.length} seasons (${NF} franchises x ${NS}) in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
console.log('LEADERS')
for (const [k, lab] of [['sck', 'sacks'], ['dint', 'INT'], ['int', 'INT thrown'], ['ry', 'rushing'], ['ryd', 'receiving'], ['ptd', 'pass TD'], ['fgm', 'FG made'], ['py', 'pass yds']]) console.log('  ' + line(k, lab))
console.log(`  rushing leaders' OVR: ${S.map(r => `${r.lead.ry[0]?.o}${r.lead.ry[0]?.st ? '' : '(bk)'}`).join(' ')}`)
console.log(`  2,000-yd rushers: ${S.filter(r => r.lead.ry[0]?.v >= 2000).length} · 20+ sacks: ${S.filter(r => r.lead.sck[0]?.v >= 20).length} · 40+ pass TD: ${S.filter(r => r.lead.ptd[0]?.v >= 40).length} of ${S.length}`)
const avgK = k => (S.reduce((a, r) => a + r.avg[k], 0) / S.length).toFixed(2)
console.log(`AVERAGES a team game: points ${avgK('ppg')} · FG tries ${avgK('fga')} made ${avgK('fgm')} · sacks ${avgK('sck')} · INT ${avgK('int')} · rush yds ${avgK('ry')} · pass yds ${avgK('py')} · RB1 share of RB yds ${avgK('rb1')}% · top receiver share ${avgK('wr1')}%`)
console.log('MVP: ' + S.map(r => `${r.y} ${r.mvp?.n} (${r.mvp?.t} ${r.mvp?.w}w${r.mvp?.p === 'qb' ? ` ${r.mvp.ptd}td ${r.mvp.int}i` : ` ${r.mvp?.p}`})`).join(' · '))
console.log('OPOY: ' + S.map(r => `${r.y} ${r.opoy?.n} (${r.opoy?.p})`).join(' · '))
console.log('DPOY: ' + S.map(r => `${r.y} ${r.dpoy?.n} (${r.dpoy?.p})`).join(' · '))
{
  const count = k => { const c = {}; for (const r of S) if (r[k]) c[r[k].n] = (c[r[k].n] ?? 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1]) }
  const streak = k => { let best = 0; for (let f = 0; f < NF; f++) { let run = 0, last = null; for (const r of S.filter(x => x.f === f)) { run = r[k]?.n === last ? run + 1 : 1; last = r[k]?.n; best = Math.max(best, run) } } return best }
  console.log(`  MVP winners: ${count('mvp').map(([n, c]) => `${n} ${c}`).join(', ')} · longest run ${streak('mvp')} · MVP with 15+ INT: ${S.filter(r => r.mvp?.int >= 15).length} · on a 12+ win team: ${S.filter(r => r.mvp?.w >= 12).length}/${S.length}`)
  console.log(`  OPOY winners: ${count('opoy').map(([n, c]) => `${n} ${c}`).join(', ')} · longest run ${streak('opoy')}`)
}
{
  const spots = ['qb', 'rb', 'wr', 'te', 'ot', 'og', 'c', 'edge', 'dt', 'lb', 'cb', 's', 'k']
  const avgOf = (k, sp) => r1(S.reduce((a, r) => a + (r.hon[k][sp] ?? 0), 0) / S.length)
  console.log('HONORS a season: Pro Bowl (both confs, All-Pros in) ' + spots.map(sp => `${sp} ${avgOf('pb', sp)}`).join(' · '))
  console.log('                 All-Pro first team ' + spots.map(sp => `${sp} ${avgOf('ap', sp)}`).join(' · '))
  console.log(`  champions: ${S.map(r => `${r.hon.champ.s} ${r.hon.champ.w}w 94+:${r.hon.champ.n94} PB${r.hon.champ.pb} AP${r.hon.champ.ap}`).join(' · ')}`)
  console.log(`  the top 30 men by rating honored: ${S.map(r => r.hon.top30).join(' ')} · OL honorees' mean OVR ${S.map(r => r.hon.olAvgO).join(' ')}`)
  const maxTeam = S.map(r => Math.max(...Object.values(r.hon.team))); console.log(`  most honorees on one team: ${maxTeam.join(' ')} · teams with none: ${S.map(r => 32 - Object.keys(r.hon.team).length).join(' ')}`)
}
{
  const fires = S.flatMap(r => r.fire)
  const byYrs = {}; for (const x of fires) byYrs[x.yrs >= 5 ? '5+' : x.yrs] = (byYrs[x.yrs >= 5 ? '5+' : x.yrs] ?? 0) + 1
  console.log(`COACHES: ${r1(fires.length / S.length)} head coaches fired a season (NFL ~5-7) · by tenure ${Object.entries(byYrs).map(([k, v]) => `${k}y ${v}`).join(' · ')} · coordinators fired ${r1(S.reduce((a, r) => a + r.fireC, 0) / S.length)} a season`)
  console.log('  first-year firings: ' + fires.filter(x => x.yrs <= 1).map(x => `${x.s} ${x.rec}`).join(', '))
  console.log('  fired after a winning record the year before: ' + fires.filter(x => { const h = x.hist.split(',').map(Number); return h.length >= 2 && h[h.length - 2] >= 10 }).map(x => `${x.s} ${x.yrs}y [${x.hist}]`).join(', '))
}
{
  const all = S.map(r => r.dev)
  const agg = k => { const xs = all.map(d => d[k]).filter(Boolean); return xs.length ? `mean ${r1(xs.reduce((a, x) => a + x.mean, 0) / xs.length)} · p5 ${r1(xs.reduce((a, x) => a + x.p5, 0) / xs.length)} · p95 ${r1(xs.reduce((a, x) => a + x.p95, 0) / xs.length)} · >+4 ${r1(xs.reduce((a, x) => a + x.gt4, 0) / xs.length)}% · +7 or more ${xs.reduce((a, x) => a + x.ge7, 0)} · max ${Math.max(...xs.map(x => x.max))}` : '-' }
  console.log('DEVELOPMENT (one year, OVR):')
  for (const [k, lab] of [['all', 'everyone'], ['young', '24 and under'], ['mid', '25-28'], ['old', '29 and up'], ['se', 'season-ending injury']]) console.log(`  ${lab.padEnd(22)} ${agg(k)}`)
  console.log(`  29+ who improved: ${all.map(d => d.oldUp).join(' ')}% · 29+ up 3 or more: ${all.map(d => d.oldUp3).join(' ')} · 30+ OL +3 or more: ${all.flatMap(d => d.ol30).join(', ') || 'none'}`)
  console.log(`  big injuries: ${all.flatMap(d => d.seList).slice(0, 16).join(' · ')}`)
  console.log(`  builds: ${all.map((d, i) => `${S[i].y}: ${d.builds.join(' ')}`).filter(x => !x.endsWith(': ')).join(' | ')}`)
}
{
  console.log('AGE MIX at the start of each season (all rostered men):')
  for (let f = 0; f < NF; f++) console.log(`  f${f}: ` + rows.filter(r => r.f === f).map(r => `${r.y + 1} 30+ ${r.ages.o30}% (starters ${r.ages.st30}%) ≤24 ${r.ages.u24}% age ${r.ages.age} 90+ ${r.ages.n90} (by age ${r.ages.star}) gap ${r.ages.gap} 85+ ${r.ages.n85} st ${r.ages.mean} n ${r.ages.n}${r.flow ? ` · out ${r.flow.outN} (30+ ${r.flow.out.o30}, 25-29 ${r.flow.out.mid}, -24 ${r.flow.out.u25}) in ${r.flow.inN} (30+ ${r.flow.in.o30})` : ''}`).join('\n       '))
  const last = Math.max(...rows.map(x => x.y)), first = rows.filter(r => !r.flow), ends = rows.filter(r => r.y === last)
  const av = (list, f) => r1(list.reduce((a, r) => a + f(r), 0) / list.length)
  console.log(`  30+ share: start ${av(first, r => r.ages.o30)}% → end ${av(ends, r => r.ages.o30)}% (range ${Math.min(...rows.map(r => r.ages.o30))}-${Math.max(...rows.map(r => r.ages.o30))}%) · 90+ men: ${av(first, r => r.ages.n90)} → ${av(ends, r => r.ages.n90)} (range ${Math.min(...rows.map(r => r.ages.n90))}-${Math.max(...rows.map(r => r.ages.n90))}) · starters' OVR ${av(first, r => r.ages.mean)} → ${av(ends, r => r.ages.mean)}`)
  // (the owner: the league must not get older as a whole)
  if (av(ends, r => r.ages.o30) > 20) bad(`the league ages: 30+ at ${av(ends, r => r.ages.o30)}% after ${NS} seasons`)
}
if (OUT) writeFileSync(OUT, JSON.stringify(rows))
console.log(problems.length ? `${problems.length} PROBLEMS` : 'done')
