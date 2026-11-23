// NBA Franchise: the players over a long save. Awards (the 65-game rule, MVP streaks, DPOY and All-Defense by spot,
// Clutch on a winner), the draft (busts and pops, the undrafted, two-way second-rounders, positional need), the age
// curve, retirements (ages, under contract, the wire), the history kept, the save's size, the standings after the
// first night, the 3-2-1 lottery from 2027, the GM's builds aging and retiring, the All-Star calendar.
//   FR_TMP=<tmp> bash scripts/franchise2/run.sh scripts/franchise2/nba-players.mjs [seasons=15] [seed=a] [team=BOS] [builds=1] [out.json]
import * as N from '../../src/lib/franchise2/nba/index'
import { TYPES } from '../../src/lib/franchise2/nba/league'
import fs from 'fs'
const X = N.CAP_SIM
const SEASONS = +(process.argv[2] ?? 15), SEED = process.argv[3] ?? 'a', TEAMX = process.argv[4] ?? 'BOS', BUILDS = (process.argv[5] ?? '1') === '1', OUT = process.argv[6] ?? null
const setup = { seed: 'pl-' + SEED, team: TEAMX, owner: 'QA' }
if (BUILDS) {
  const mk = (pos, lvl) => Object.fromEntries(TYPES[pos].map(t => [t, { val: lvl }]))
  setup.builds = [{ pos: 'guard', build: mk('guard', 7), name: 'Build Guard', num: 1 }, { pos: 'big', build: mk('big', 6), name: 'Build Big', num: 50 }]
}
const F = N.createNbaFranchise(setup)
const st = p => !p.tw
const allMen = () => [...N.SHORTS.flatMap(s => F.teams[s].r.map(p => [s, p])), ...(F.fa ?? []).map(p => [null, p])]
const mean = a => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : null)
const pctl = (a, k) => { const v = a.slice().sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(k * v.length))] : null }
const out = { seasons: [], awards: [], draft: [], dev: {}, ret: [], flags: [] }
const flag = (y, m) => { out.flags.push(`${y} ${m}`) }
// (the wire is newest first, capped: what came in since a mark)
const since = top => { const k = F.news.indexOf(top); return k < 0 ? F.news.slice() : F.news.slice(0, k) }
const track = new Map()   // drafted men: id -> { y, n, r, tw, os: [o by season start] }
let prev = null
for (let yr = 0; yr < SEASONS; yr++) {
  const Y = F.year, S = { y: Y }
  S.save = N.nbaSaveSize(F)
  S.retiredN = (F.retired ?? []).length
  S.parts = (() => { const P = JSON.parse(N.packNba(F)); return Object.fromEntries(Object.entries(P).map(([k, v]) => [k, Math.round(JSON.stringify(v ?? '').length / 1024)]).filter(([, v]) => v >= 4).sort((a, b) => b[1] - a[1])) })()
  S.carRows = allMen().reduce((a, [, p]) => a + (p.car ?? []).length, 0)
  S.draftsKept = Object.keys(F.drafts ?? {}).length
  // the age curve: last season start to this one, the same man
  const snap = new Map(allMen().filter(([s]) => s).map(([s, p]) => [p.i, { o: p.o, ag: p.ag, b: p.b }]))
  if (prev) for (const [i, a] of prev) { const b = snap.get(i); if (!b || a.b != null) continue; (out.dev[a.ag] ??= []).push(b.o - a.o) }
  prev = snap
  { const here = new Map(allMen().map(([, p]) => [p.i, p.o])); for (const [i, t] of track) t.os.push(here.get(i) ?? null) }   // (null: out of the league)
  // rosters: bigs and guards a team
  S.bigs = N.SHORTS.map(s => F.teams[s].r.filter(p => st(p) && p.g === 'big').length)
  S.builds = N.SHORTS.flatMap(s => F.teams[s].r.filter(p => p.b != null).map(p => `${p.n} ${p.o}/${p.ag} $${p.$}`))
  const startTeam = new Map(N.SHORTS.flatMap(s => F.teams[s].r.map(p => [p.i, s])))
  // the first nights: a team with a loss ahead of a team that hasn't played
  for (let d = 0; d < 3 && F.phase === 'season'; d++) {
    N.playDay(F)
    const R = N.records(F)
    for (const c of ['E', 'W']) {
      const o = N.confOrder(F, c, R)
      for (let k = 1; k < o.length; k++) if (N.pct(R[o[k]]) > N.pct(R[o[k - 1]]) || (R[o[k - 1]].l > 0 && R[o[k - 1]].w === 0 && R[o[k]].w + R[o[k]].l === 0)) { flag(Y, `day ${d} ${c}: ${o[k - 1]} ${N.recText(R[o[k - 1]])} ahead of ${o[k]} ${N.recText(R[o[k]])}`); break }
    }
  }
  let asNewsDay = null
  let asResDay = null
  while (F.phase === 'season') { const n0 = F.news[0]; N.playDay(F); const fr = since(n0); if (asNewsDay == null && fr.some(x => x.k === 'as')) asNewsDay = F.day - 1; else if (asResDay == null && asNewsDay != null && fr.some(x => x.k === 'as')) asResDay = F.day - 1; if (fr.some(x => x.k === 'asg')) S.asGame = fr.find(x => x.k === 'asg').text }
  S.asb = F.asb[0]; S.asNews = asNewsDay; S.asRes = asResDay
  N.startPostseason(F); N.simPostseason(F)
  // the awards, from the season's lines
  const ss = JSON.parse(JSON.stringify(F.ss)), W = N.records(F)
  N.closeSeason(F)
  const A = F.hist.at(-1).aw
  const line = x => { if (!x) return null; const r = ss[x.i] ?? {}, p = N.manOf(F, x.i); const g = r.gp || 1; return { i: x.i, n: x.n, s: x.s, p: p?.p, w: W[x.s]?.w, mpg: +((r.min ?? 0) / g).toFixed(1), ppg: +((r.pts ?? 0) / g).toFixed(1), gp: r.gp, g20: (r.g20 ?? 0) + Math.min(2, r.g15 ?? 0), spg: +((r.stl ?? 0) / g).toFixed(1), bpg: +((r.blk ?? 0) / g).toFixed(1) } }
  const aw = { y: Y }
  for (const k of ['MVP', 'DPOY', 'ROY', '6MOY', 'MIP', 'CLUTCH', 'FMVP', 'ECF', 'WCF']) aw[k] = line(A[k])
  aw.ALL = (A.ALL ?? []).map(t => t.map(line)); aw.ALLDEF = (A.ALLDEF ?? []).map(t => t.map(line)); aw.ROOKIE = (A.ROOKIE ?? []).map(t => t.map(x => x?.n))
  for (const k of ['MVP', 'DPOY', '6MOY', 'MIP', 'CLUTCH']) if (aw[k] && aw[k].g20 < 62) flag(Y, `65-game rule: ${k} ${aw[k].n} ${aw[k].g20} games of 20+ (${aw[k].mpg} mpg)`)
  for (const x of [...aw.ALL.flat(), ...aw.ALLDEF.flat()]) if (x && x.g20 < 62) flag(Y, `65-game rule: All-team ${x.n} ${x.g20} (${x.mpg} mpg)`)
  out.awards.push(aw)
  // mid-season moves: his rows this year
  S.splits = []
  for (const [s, p] of allMen()) { const a = startTeam.get(p.i); if (a && s && a !== s && ss[p.i]?.gp) S.splits.push(`${p.n} ${a}->${s}: ${(p.car ?? []).filter(c => c.y === Y).map(c => `${c.s || '?'} ${c.gp}`).join(', ')}`) }
  // the summer
  let before = null
  while (F.phase === 'off') {
    const step = F.off.step
    if (step === 'lottery') S.lot = F.lot.lottery.map(x => `${x.s} ${x.from}->${x.to}`).join(' ')
    if (step === 'lottery' && F.lot.y === 2027) S.lot2027 = F.lot
    if (step === 'lottery') S.lotMoves = F.lot.lottery.map(x => [x.from, x.to])
    if (step === 'resign') {
      for (const i of [...(F.off.mine ?? [])]) { const p = (F.fa ?? []).find(x => x.i === i); if (p) N.resignMine(F, i, p.o >= 74) }
    }
    if (step === 'camp') {
      const T = F.teams[F.team]
      while (T.r.filter(st).length > 15) { const p = T.r.filter(x => st(x) && x.b == null).sort((a, b) => a.o - b.o)[0]; if (!p) break; X.cutMan(F, F.team, p.i) }
      for (const p of N.minPool(F)) { if (T.r.filter(st).length >= 14) break; N.signMin(F, p.i) }
    }
    if (step === 'draft') before = new Map(allMen().map(([s, p]) => [p.i, { s, ag: p.ag, o: p.o, y: p.y, n: p.n, b: p.b }]))
    const dc = step === 'draft' ? F.dc.slice() : null
    const n0 = F.news[0]
    N.nextStep(F)
    if (step === 'draft') {
      const made = F.drafts?.[Y + 1] ?? []
      const D = { y: Y + 1, n: made.length, r2: 0, r2tw: 0, flagTw: 0, need: [] }
      for (const m of made) {
        const p = N.manOf(F, m.i)
        if (!p) continue
        track.set(p.i, { y: Y + 1, n: m.n, r: m.r, os: [] })
        if (m.r === 2) { D.r2++; if (p.tw) D.r2tw++; if (m.tw) D.flagTw++ }
      }
      const madeIds = new Set(made.map(m => m.i))
      const und = dc.filter(p => !madeIds.has(p.i))
      D.undrafted = und.length
      D.undraftedFA = und.filter(p => (F.fa ?? []).some(x => x.i === p.i)).length
      D.undraftedSigned = und.filter(p => N.SHORTS.some(s => F.teams[s].r.some(x => x.i === p.i))).length
      out.draft.push(D)
    }
    if (step === 'resign' || (step === 'draft' && F.off?.step === 'resign')) {
      // (the retirements ran on entering resign: after the draft step)
    }
    if (step === 'draft') {
      const now = new Map(allMen().map(([s, p]) => [p.i, s]))
      const news = since(n0)
      for (const [i, v] of before) {
        if (now.has(i)) continue
        const told = news.some(x => x.k === 'retire' && (x.i === i || x.text?.includes(v.n)))
        out.ret.push({ y: Y, n: v.n, ag: v.ag, o: v.o, under: v.s && v.y >= 2 ? 1 : 0, gm: v.s === TEAMX ? 1 : 0, b: v.b ?? null, told: told ? 1 : 0, s: v.s })
      }
      S.oldest = Math.max(...allMen().map(([, p]) => p.ag))
    }
  }
  S.retiredStars = ['LeBron James', 'Stephen Curry', 'Kevin Durant', 'Chris Paul', 'James Harden', 'Russell Westbrook'].filter(n => (F.retired ?? []).some(r => r.n === n))
  out.seasons.push(S)
  console.log(`${Y} save ${(S.save / 1024).toFixed(0)}K retired ${S.retiredN} MVP ${aw.MVP?.n} (${aw.MVP?.p}) DPOY ${aw.DPOY?.n} (${aw.DPOY?.p}) ALLDEF guards ${aw.ALLDEF.flat().filter(x => x && (x.p === 'PG' || x.p === 'SG')).length} CLUTCH ${aw.CLUTCH?.n} w${aw.CLUTCH?.w} MIP ${aw.MIP?.n} ${aw.MIP?.mpg}mpg 6MOY ${aw['6MOY']?.n} ${aw['6MOY']?.mpg}mpg | builds ${S.builds.join(', ')}`)
}
// ── the summary ──
const sum = {}
// MVP streaks and counts
const mvps = out.awards.map(a => a.MVP?.n)
let best = 0, run = 0
for (let k = 0; k < mvps.length; k++) { run = k && mvps[k] === mvps[k - 1] ? run + 1 : 1; best = Math.max(best, run) }
const cnt = {}; for (const n of mvps) cnt[n] = (cnt[n] ?? 0) + 1
sum.mvp = { longestStreak: best, most: Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3), winners: new Set(mvps).size }
sum.dpoyPos = out.awards.map(a => a.DPOY?.p).join('')
sum.allDefGuards = out.awards.map(a => a.ALLDEF.flat().filter(x => x && (x.p === 'PG' || x.p === 'SG')).length)
sum.allDefWings = out.awards.map(a => a.ALLDEF.flat().filter(x => x && x.p === 'SF').length)
sum.clutchW = out.awards.map(a => a.CLUTCH?.w)
sum.awardMpgMin = Object.fromEntries(['MVP', 'DPOY', '6MOY', 'MIP', 'CLUTCH'].map(k => [k, Math.min(...out.awards.map(a => a[k]?.mpg ?? 99))]))
sum.mip = out.awards.map(a => a.MIP && `${a.MIP.n} ${a.MIP.ppg}/${a.MIP.mpg}`).slice(0, 6)
sum.sixth = out.awards.map(a => a['6MOY'] && `${a['6MOY'].n} ${a['6MOY'].ppg}/${a['6MOY'].mpg}`).slice(0, 6)
sum.allNbaMpgMin = Math.min(...out.awards.flatMap(a => a.ALL.flat().map(x => x?.mpg ?? 99)))
sum.cfMvp = out.awards.filter(a => a.ECF && a.WCF).length
// the draft: OVR in his fifth season, by where he went
const t5 = [...track.values()].filter(t => t.os.length >= 5)
const yr5 = (lo, hi) => t5.filter(t => t.n >= lo && t.n <= hi).map(t => t.os[4] ?? 0)   // (out of the league by then: 0)
const peak = t => Math.max(...t.os.map(o => o ?? 0))
const top3 = yr5(1, 3), r1 = yr5(4, 30), r2 = yr5(31, 60)
sum.draft = {
  top3: { n: top3.length, under75: top3.filter(o => o < 75).length, out: top3.filter(o => !o).length, list: top3.slice().sort((a, b) => a - b).slice(0, 12).join(','), at90: top3.filter(o => o >= 90).length, med: pctl(top3, 0.5) },
  r1: { n: r1.length, med: pctl(r1, 0.5), p90: pctl(r1, 0.9) },
  r2: { n: r2.length, out: r2.filter(o => !o).length, med: pctl(r2, 0.5), p90: pctl(r2, 0.9), max: Math.max(...r2), peak80: t5.filter(t => t.n > 30 && peak(t) >= 80).length, peak85: t5.filter(t => t.n > 30 && peak(t) >= 85).length, peak90: t5.filter(t => t.n > 30 && peak(t) >= 90).length },
  r2tw: out.draft.map(d => `${d.r2tw}/${d.r2}`).join(' '), r2flag: out.draft.map(d => d.flagTw).join(' '),
  undrafted: out.draft.map(d => `${d.undrafted}:${d.undraftedFA}fa`).join(' '),
}
sum.bigs = { first: out.seasons[0].bigs.join(','), last: out.seasons.at(-1).bigs.join(','), lastMax: Math.max(...out.seasons.at(-1).bigs), lastMin: Math.min(...out.seasons.at(-1).bigs) }
sum.dev = Object.fromEntries(Object.entries(out.dev).filter(([a]) => a >= 20 && a <= 37).map(([a, L]) => [a, `${mean(L)} (${L.length})`]))
const R = out.ret.filter(r => r.b == null)
sum.ret = {
  n: R.length, perYear: +(R.length / Math.max(1, SEASONS - 1)).toFixed(1), ages: { p10: pctl(R.map(r => r.ag), 0.1), med: pctl(R.map(r => r.ag), 0.5), p90: pctl(R.map(r => r.ag), 0.9) },
  underContractUnder33: R.filter(r => r.under && r.ag < 33).map(r => `${r.n} ${r.ag} ${r.o}`).slice(0, 8), underContractUnder33N: R.filter(r => r.under && r.ag < 33).length,
  under30: R.filter(r => r.ag < 30).length, gm: R.filter(r => r.gm).length, gmUntold: R.filter(r => r.gm && !r.told).map(r => `${r.n} ${r.ag}`),
  rosteredUnder30: R.filter(r => r.s && r.ag < 30).map(r => `${r.n} ${r.ag} ${r.o}`).slice(0, 8),
  builds: out.ret.filter(r => r.b != null).map(r => `${r.n} ${r.ag} ${r.o} told ${r.told}`),
}
sum.history = { retired: out.seasons.map(s => s.retiredN).join(' '), stars: out.seasons.at(-1).retiredStars, draftsKept: out.seasons.at(-1).draftsKept }
sum.save = out.seasons.map(s => Math.round(s.save / 1024)).join(' ')
sum.parts = [out.seasons[5]?.parts, out.seasons.at(-1).parts]; sum.carRows = out.seasons.map(s => s.carRows).join(' ')
sum.splits = out.seasons.flatMap(s => s.splits).slice(0, 6)
sum.lot2027 = out.seasons.find(s => s.lot2027)?.lot2027?.lottery?.map(x => `${x.s} ${x.from}->${x.to}${x.odds != null ? ` (${x.odds})` : ''}`).join(' ')
const mv = out.seasons.filter(s => s.y >= 2026 && s.lotMoves).flatMap(s => s.lotMoves)
sum.lottery = { maxDrop: Math.max(...mv.map(([a, b]) => b - a)), worstLanding: [1, 2, 3].map(f => mv.filter(([a]) => a === f).map(([, b]) => b).join(',')), n: out.seasons.find(s => s.lotMoves)?.lotMoves.length }
sum.allStar = out.seasons.map(s => `${s.asNews}/${s.asRes}/${s.asb}`).slice(0, 3).join(' '), sum.asGame = out.seasons[0].asGame
sum.builds = out.seasons.map(s => s.builds.join(' + ')).filter(Boolean).slice(-6)
sum.oldest = out.seasons.map(s => s.oldest).join(' ')
sum.flags = out.flags.length; sum.flagEx = out.flags.slice(0, 12)
console.log(JSON.stringify(sum, null, 1))
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ sum, ...out }))
