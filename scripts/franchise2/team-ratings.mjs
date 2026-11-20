// The team ratings (league.js teamRating / strength): OVR, OFFENSE and DEFENSE across the 32 real teams in year one,
// against the real 2025 season, and their spread over a long sim (the league's rosters turning over).
//   bash scripts/franchise2/run.sh scripts/franchise2/team-ratings.mjs [seasons=15] [detail=0] [seed=ratings]
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { SEASON_2025, teamRating, rawRating, rosterSide } from '../../src/lib/franchise2/ratings'
import { coachEdge } from '../../src/lib/franchise2/coach'
import * as RT from '../../src/lib/franchise2/ratings'

const N = Number(process.argv[2] ?? 15), detail = process.argv[3] === '1'
FR.useContracts(CONTRACTS)
// The real 2025 regular season (W-L-T, points for and against): the sanity check for year one's order.
const REAL = SEASON_2025
const problems = [], bad = m => { problems.push(m); console.log('  !! ' + m) }
const pct = ([w, l, t]) => (w + t / 2) / (w + l + t)
const corr = (x, y) => { const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0; for (let i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2 } return a / Math.sqrt(b * c) }
const mean = a => a.reduce((x, y) => x + y, 0) / a.length
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))) }
const q = (a, k) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(k * (s.length - 1) + 0.5))] }
const pad = (s, n) => String(s).padEnd(n), lp = (s, n) => String(s).padStart(n)
const spreadOf = v => `${q(v, 0)}-${q(v, 1)} (p10 ${q(v, 0.1)}, median ${q(v, 0.5)}, p90 ${q(v, 0.9)}, sd ${sd(v).toFixed(1)})`

let F = FR.createFranchise({ seed: process.argv[4] ?? 'ratings', team: 'DEN', owner: 'Graham', builds: [] })
// (ROSTER: the men alone, no play-callers, no carry-over from 2025)
const rosterOnly = s => { const r = rawRating(F.teams[s]); return Math.round((rosterSide(r.off, 'off') + rosterSide(r.def, 'def')) / 2) }
const rows = FR.SHORTS.map(s => ({ s, ...FR.strength(F, s), r: REAL[s], ro: rosterOnly(s), res: F.teams[s].res, ce: coachEdge(F, s) }))
rows.sort((a, b) => b.ovr - a.ovr || b.offR + b.defR - a.offR - a.defR)
console.log('YEAR ONE (2026 rosters) vs the real 2025 season')
console.log(`${pad('', 4)}${lp('OVR', 4)}  ${pad('OFFENSE', 9)}${pad('DEFENSE', 9)}${pad('SIM', 11)}${pad('ROSTER', 7)}${pad('2025 CARRY', 12)}${pad('CALLS', 11)} ${pad('2025', 7)} ${lp('PD', 5)}`)
for (const t of rows) {
  console.log(`${pad(t.s, 4)}${lp(t.ovr, 4)}  ${pad(`${t.offR} ${FR.gradeOf(t.offR)}`, 9)}${pad(`${t.defR} ${FR.gradeOf(t.defR)}`, 9)}${pad(`${t.off.toFixed(1)}/${t.def.toFixed(1)}`, 11)}${pad(t.ro, 7)}${pad(t.res.map(v => (v > 0 ? '+' : '') + v).join(' '), 12)}${pad(`${t.ce.off}/${t.ce.def}`, 11)} ${pad(`${t.r[0]}-${t.r[1]}${t.r[2] ? `-${t.r[2]}` : ''}`, 7)} ${lp((t.r[3] - t.r[4] > 0 ? '+' : '') + (t.r[3] - t.r[4]), 5)}`)
}
const ov = rows.map(t => t.ovr)
console.log(`OVR ${spreadOf(ov)} · roster alone ${spreadOf(rows.map(t => t.ro))}`)
console.log(`OFFENSE ${spreadOf(rows.map(t => t.offR))} · DEFENSE ${spreadOf(rows.map(t => t.defR))}`)
console.log(`OVR vs 2025: win% r ${corr(ov, rows.map(t => pct(t.r))).toFixed(2)}, point diff r ${corr(ov, rows.map(t => t.r[3] - t.r[4])).toFixed(2)} · roster alone vs PD r ${corr(rows.map(t => t.ro), rows.map(t => t.r[3] - t.r[4])).toFixed(2)}`)
console.log(`OFFENSE vs points scored r ${corr(rows.map(t => t.offR), rows.map(t => t.r[3])).toFixed(2)} · DEFENSE vs points allowed r ${corr(rows.map(t => t.defR), rows.map(t => -t.r[4])).toFixed(2)}`)
const byReal = [...rows].sort((a, b) => pct(b.r) - pct(a.r) || (b.r[3] - b.r[4]) - (a.r[3] - a.r[4]))
const rankOf = s => rows.findIndex(t => t.s === s) + 1
console.log(`2025's best 5 by OVR rank: ${byReal.slice(0, 5).map(t => `${t.s} #${rankOf(t.s)}`).join(', ')} · worst 5: ${byReal.slice(-5).map(t => `${t.s} #${rankOf(t.s)}`).join(', ')}`)
if (detail) {
  for (const t of rows) {
    const L = FR.lineup(F.teams[t.s])
    console.log(`  ${pad(t.s, 4)} ${Object.entries(L).map(([k, p]) => `${k}:${p.o}`).join(' ')}`)
  }
}

// ── The long run ─────────────────────────────────────────────────────────────
// every team run by the computer (the player's team too: re-sign the good ones, a bid a day, the draft on auto)
const yearOf = () => {
  const v = FR.SHORTS.map(s => FR.strength(F, s))
  // each slot's spread across the 32 (does the league's talent even out?)
  const sl = {}; for (const s of FR.SHORTS) for (const [k, p] of Object.entries(FR.lineup(F.teams[s]))) (sl[k] ??= []).push(p.o)
  const raw = FR.SHORTS.map(s => rawRating(F.teams[s]))
  const qbs = FR.SHORTS.flatMap(s => F.teams[s].r.filter(p => p.p === 'qb')).map(p => p.o).sort((a, b) => b - a)
  if (detail) {
    // how much of the side's spread is the men being good together (a well-run club) vs one slot at a time
    const W = { ...RT.W_OFF }, D = { ...RT.W_DEF }, sw = o => Object.values(o).reduce((a, b) => a + b, 0)
    const indep = (Wt) => { let v = 0; for (const [k, w] of Object.entries(Wt)) { const xs = FR.SHORTS.map(s => RT.slotsOf(F.teams[s])[k]?.o ?? 60); v += (w / sw(Wt)) ** 2 * sd(xs) ** 2 } return Math.sqrt(v) }
    const fo = FR.SHORTS.map(s => F.teams[s].fo ?? 0.5)
    console.log(`  ${F.year} spread: off ${sd(raw.map(r => r.off)).toFixed(2)} (one slot at a time ${indep(W).toFixed(2)}) def ${sd(raw.map(r => r.def)).toFixed(2)} (${indep(D).toFixed(2)}) · front office vs OVR r ${corr(fo, v.map(x => x.ovr)).toFixed(2)} · fo ${q(fo, 0)}-${q(fo, 1)}`)
  }
  if (detail) console.log(`  ${F.year} QB1s: ${FR.SHORTS.map(s => { const p = FR.lineup(F.teams[s]).qb1; return `${s} ${p.o}/${p.pk ?? '-'} ${p.ag}y ${p.dr ? 'R' + p.dr[0] + (p.rk ? "'" + String(p.rk).slice(2) : '') : p.rk ? 'udfa' : FR.realOf('qb', p.n) ? 'real' : 'gen'}` }).join(', ')}`)
  if (detail) console.log(`  ${F.year} QBs: top 40 ${qbs.slice(0, 40).join(' ')} · QB1s ${sl.qb1.sort((a, b) => b - a).join(' ')} · QB2 best ${FR.SHORTS.map(s => FR.depthChart(F, s).qb[1]?.o ?? 0).sort((a, b) => b - a).slice(0, 6).join(' ')}`)
  if (detail || F.year === FR.FIRST_YEAR || F.year === FR.FIRST_YEAR + N - 1) console.log(`  ${F.year} slots (mean±sd): ${['qb1', 'wr1', 'ol1', 'edge1', 'cb1', 'dt1', 'lb1', 's1'].map(k => `${k} ${mean(sl[k]).toFixed(0)}±${sd(sl[k]).toFixed(1)}`).join(' ')} · raw off ${mean(raw.map(r => r.off)).toFixed(1)}±${sd(raw.map(r => r.off)).toFixed(2)} def ${mean(raw.map(r => r.def)).toFixed(1)}±${sd(raw.map(r => r.def)).toFixed(2)} · carry left ${mean(FR.SHORTS.map(s => Math.abs(F.teams[s].res?.[0] ?? 0) + Math.abs(F.teams[s].res?.[1] ?? 0))).toFixed(2)}`)
  // (old: the number the screens showed before 11-15, the plain average of the 22 starters)
  const old = FR.SHORTS.map(s => Math.round(mean(Object.values(FR.lineup(F.teams[s])).map(p => p.o))))
  const n90 = FR.SHORTS.reduce((a, s) => a + F.teams[s].r.filter(p => p.o >= 90).length, 0)
  return { ovr: v.map(x => x.ovr), off: v.map(x => x.offR), def: v.map(x => x.defR), old, qb: sl.qb1, n90 }
}
const seasons = [], games = []
for (let y = 0; y < N; y++) {
  const at = yearOf()
  while (F.phase === 'season') { FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0) }
  const recs = FR.records(F)
  const wp = FR.SHORTS.map(s => pct([recs[s].w, recs[s].l, recs[s].t])), pd = FR.SHORTS.map(s => recs[s].pf - recs[s].pa)
  FR.intoPlayoffs(F)
  while (F.phase === 'playoffs') FR.playWeek(F, { moments: false })
  const wins = FR.SHORTS.map(s => recs[s].w + recs[s].t / 2)
  // every regular-season game: the OVR gap (home minus away, season-start numbers) and the margin
  for (const wk of F.sched.weeks) for (const g of wk) if (g.hs != null) games.push([at.ovr[FR.SHORTS.indexOf(g.h)] - at.ovr[FR.SHORTS.indexOf(g.a)], g.hs - g.as, g.n ? 1 : 0])
  const champ = F.po.champ, champOvr = at.ovr[FR.SHORTS.indexOf(champ)], best = Math.max(...at.ovr)
  seasons.push({ y: F.year, ...at, wins, r: corr(at.ovr, wp), rpd: corr(at.ovr, pd), champ, champOvr, champRank: [...at.ovr].sort((a, b) => b - a).indexOf(champOvr) + 1, best })
  FR.closeSeason(F)
  FR.ageLeague(F)
  FR.openResign(F)
  for (const id of [...F.rs]) {
    const p = F.teams[F.team].r.find(x => x.i === id)
    if (FR.optionDue(p)) { FR.resignOne(F, id, p.o >= 80 ? 'option' : 'decline'); continue }
    FR.resignOne(F, id, p.o >= 76 && FR.canSign(F, FR.resignAsk(p, F).$))
  }
  FR.openFA(F)
  while (F.fad) { const p = FR.faBoard(F, 8).find(x => FR.canSign(F, x.$) && x.o >= 78); if (p) FR.placeBid(F, p.i, p.$); FR.nextFADay(F) }
  FR.openDraft(F); FR.startNight(F)
  while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  FR.closeDraft(F)
  FR.autoCamp(F); FR.newSeason(F)
}
console.log(`\nOVER ${N} SEASONS (the OVR at the start of each season; r = its correlation with that season's win% / point diff)`)
for (const S of seasons) console.log(`${S.y}: OVR ${spreadOf(S.ovr)} · before ${q(S.old, 0)}-${q(S.old, 1)} sd ${sd(S.old).toFixed(1)} · QB1 ${q(S.qb, 0)}-${q(S.qb, 1)} sd ${sd(S.qb).toFixed(1)} (under 76: ${S.qb.filter(o => o < 76).length}) · 90+ men ${S.n90} · wins sd ${sd(S.wins).toFixed(1)}, 13+ ${S.wins.filter(w => w >= 13).length}, 4- ${S.wins.filter(w => w <= 4).length} · OFF ${q(S.off, 0)}-${q(S.off, 1)} DEF ${q(S.def, 0)}-${q(S.def, 1)} · r ${S.r.toFixed(2)}/${S.rpd.toFixed(2)} · champ ${S.champ} (${S.champOvr}, #${S.champRank})`)
const all = seasons.flatMap(S => S.ovr)
console.log(`all ${N} seasons: OVR ${spreadOf(all)} · 90+ teams a year ${(all.filter(v => v >= 90).length / N).toFixed(1)} · under 75 a year ${(all.filter(v => v < 75).length / N).toFixed(1)} · mean r ${mean(seasons.map(S => S.r)).toFixed(2)} · champ's OVR rank median ${q(seasons.map(S => S.champRank), 0.5)}`)
const allOld = seasons.flatMap(S => S.old), allW = seasons.flatMap(S => S.wins)
console.log(`before (the starters' average): OVR ${spreadOf(allOld)}`)
console.log(`wins: sd ${sd(allW).toFixed(2)} (NFL 2021-25 about 3.1) · 13+ win teams a year ${(allW.filter(w => w >= 13).length / N).toFixed(1)} (NFL about 3.4) · 4 or fewer ${(allW.filter(w => w <= 4).length / N).toFixed(1)} (NFL about 3.2)`)
// the games: margin by the OVR gap (home field taken out by the neutral-site and the mean), against the NFL's spreads
{
  const bins = [[-99, -12], [-12, -8], [-8, -4], [-4, 0], [0, 4], [4, 8], [8, 12], [12, 99]]
  const hm = mean(games.filter(g => g[0] === 0 && !g[2]).map(g => g[1]))
  console.log(`games by home-minus-away OVR gap (${games.length} games; home edge at an even gap ${hm.toFixed(1)} pts):`)
  for (const [a, b] of bins) { const G = games.filter(g => g[0] >= a && g[0] < b); if (G.length > 20) console.log(`  gap ${a}..${b}: ${G.length} games, mean gap ${mean(G.map(g => g[0])).toFixed(1)}, margin ${mean(G.map(g => g[1])).toFixed(1)}, home wins ${(100 * G.filter(g => g[1] > 0).length / G.length).toFixed(0)}%`) }
  const x = games.map(g => g[0]), y = games.map(g => g[1]), mx = mean(x), my = mean(y)
  const slope = x.reduce((a, v, i) => a + (v - mx) * (y[i] - my), 0) / x.reduce((a, v) => a + (v - mx) ** 2, 0)
  console.log(`  points a point of OVR: ${slope.toFixed(2)} (a 10-point gap = a ${(slope * 10).toFixed(1)}-point favourite; the NFL's 7-10)`)
  if (slope < 0.6 || slope > 1.05) bad(`a point of OVR is ${slope.toFixed(2)} points`)
}
// year one's shape
{
  const y1 = seasons[0] ?? { ovr: ov }
  if (q(ov, 1) < 87 || q(ov, 1) > 94) bad(`year one's best OVR ${q(ov, 1)}`)
  if (q(ov, 0) < 68 || q(ov, 0) > 76) bad(`year one's worst OVR ${q(ov, 0)}`)
  if (sd(ov) < 4) bad(`year one's OVR sd ${sd(ov).toFixed(1)}`)
  for (const t of rows) { const o = Math.round((t.offR + t.defR) / 2); if (o !== t.ovr) bad(`${t.s} OVR ${t.ovr} is not its two sides ${t.offR}/${t.defR}`) }
  for (const t of byReal.slice(0, 5)) if (rankOf(t.s) > 16) bad(`2025's ${t.s} (${t.r[0]}-${t.r[1]}) ranks #${rankOf(t.s)} in year one`)
  for (const t of byReal.slice(-5)) if (rankOf(t.s) < 17) bad(`2025's ${t.s} (${t.r[0]}-${t.r[1]}) ranks #${rankOf(t.s)} in year one`)
  void y1
}
console.log(problems.length ? `${problems.length} PROBLEMS` : 'OK: no problems')
