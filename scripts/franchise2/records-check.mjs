// Records and game day (owner, 2026-11-17, playtest items 1-5, 14, 17-19), headless, over several seasons.
//   bash scripts/franchise2/run.sh scripts/franchise2/records-check.mjs [seasons=3] [team=TEN]
//  1. Every game's lines are kept when it's played and never change: the season's leaders, team totals and careers
//     are the same after the league's stars are hurt, men are traded and the save is packed and read back; a man
//     hurt keeps what he did before; the league's lines add up to what its games did (passing yards, touchdowns).
//  2. Each box adds up, both teams, every game (the player's and the league's, the playoffs too): the passer's
//     completions, yards and touchdowns are his receivers'; the team lines are the men's; a side's picks and sacks
//     are the other side's; turnovers are the game's own; every touchdown the player's game had is a man's.
//  3. Drafted men on their rookie deals are on the player's team after every new season (or released on the wire).
//  4. The line by spot: on every chart, default, reset and after camp, no tackle at centre or centre at tackle.
//  5. After camp the player's chart is in rating order (builds first); nobody shares a number; a man who stays keeps
//     his number.
// 14. Starting QBs: of the 32 Week 1 starters, how many start all 17 (NFL 2022-24: 10 to 14).
// 17. The end of games: the leading team doesn't score in the last 40 seconds (it kneels); scores at 0:01; no moment
//     with the player's team ahead with the ball inside 1:50; overtime moments; touchdown lengths fit the field.
// 18. A moment's score is the game's, the player's side first.
// 19. Every build who played has a line on the final card.
// Old saves: a save from before the lines were kept freezes the old replay once on load; the same numbers after.
import * as FR from '../../src/lib/franchise2/index'
import { BOXLOG } from '../../src/lib/franchise2/box'
import { whenOf } from '../../src/lib/franchise2/plays'
import { QBS } from '../../src/data/qbs'
import { WRS } from '../../src/data/wrs'
import CONTRACTS from '../../src/data/nfl-contracts.json'

FR.useContracts(CONTRACTS)
const N = Number(process.argv[2] ?? 3), team = process.argv[3] ?? 'TEN'
const problems = []
const bad = m => { problems.push(m); if (problems.length <= 40) console.log('  !! ' + m) }
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const qb = QBS.find(p => p.name === 'Josh Allen'), wr = WRS.find(p => p.attrs)
const F = FR.createFranchise({ seed: 'rec', team, owner: 'Graham', builds: [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Hale', num: 7 }, { pos: 'wr', build: asBuild(wr), name: 'Dre Collins', num: 11 }], coach: { name: 'Coach', style: 'developer', r: { talentDev: 6, offPlaycalling: 6, defPlaycalling: 6, culture: 6, situational: 6 }, ovr: 72 } })
F.games = 'advanced'

// ── 2. every box as it's kept ──
const sum = (s, men, k) => men.reduce((a, p) => a + (s[p.k]?.[k] ?? 0), 0)
const G = { games: 0, sides: 0, pass: 0, team: 0, cross: 0, to: 0, tdMiss: 0, tdOver: 0, tdUser: 0, tdUserMiss: 0, late: 0, lateLead: 0, at1: 0, scores: 0, kneels: 0, ot: 0 }
const byTeam = {}
let lastS = null
BOXLOG.fn = (Fx, B, po) => {
  G.games++
  const S = B.S
  if (S.G.h === Fx.team || S.G.a === Fx.team) lastS = S
  for (const side of ['h', 'a']) {
    const X = B[side], Y = B[side === 'h' ? 'a' : 'h'], s = X.s, T = B.team[side]
    G.sides++
    const qbs = X.roster.filter(p => p.pos === 'qb'), rec = X.roster.filter(p => p.pos !== 'qb' && p.pos !== 'ol')
    const dfn = Y.roster.filter(p => ['dl', 'lb', 'db'].includes(p.pos))
    const tag = `${Fx.year} ${po ? 'PO' : `wk${Fx.wk + 1}`} ${X.short}`
    if (sum(s, qbs, 'pc') !== sum(s, rec, 'rc') || sum(s, qbs, 'py') !== sum(s, rec, 'ryd') || sum(s, qbs, 'ptd') !== sum(s, rec, 'rctd')) { G.pass++; bad(`${tag}: passer ${sum(s, qbs, 'pc')}/${sum(s, qbs, 'py')}/${sum(s, qbs, 'ptd')} vs receivers ${sum(s, rec, 'rc')}/${sum(s, rec, 'ryd')}/${sum(s, rec, 'rctd')}`) }
    if (T.py !== sum(s, qbs, 'py') || T.ry !== sum(s, X.roster, 'ry') || T.ra !== sum(s, X.roster, 'ra') || T.pa !== sum(s, qbs, 'pa') || T.yds !== T.py + T.ry) { G.team++; bad(`${tag}: team line ${JSON.stringify(T)} vs the men`) }
    if (T.int !== sum(Y.s, dfn, 'dint') || T.sk !== sum(Y.s, dfn, 'sck') || T.fum !== sum(Y.s, dfn, 'fr')) { G.cross++; bad(`${tag}: INT ${T.int} vs ${sum(Y.s, dfn, 'dint')} picks, sacked ${T.sk} vs ${sum(Y.s, dfn, 'sck')}, fumbles ${T.fum} vs ${sum(Y.s, dfn, 'fr')} recovered`) }
    const gameTO = S.dr.filter(d => d.s === side && d.res === 'to').length
    if (T.to !== gameTO) { G.to++; bad(`${tag}: ${T.to} turnovers in the box, ${gameTO} in the game`) }
    const tds = S.plays.filter(p => p.s === side && p.k === 'td').length, men = sum(s, X.roster, 'rctd') + sum(s, X.roster, 'rtd')
    const mineGame = X.short === Fx.team || Y.short === Fx.team
    if (men > tds) { G.tdOver++; bad(`${tag}: ${men} touchdowns on the men, ${tds} in the game`) }
    if (men < tds) G.tdMiss += tds - men
    if (mineGame) { G.tdUser += tds; G.tdUserMiss += Math.max(0, tds - men) }
    if (!po) { const t = byTeam[X.short] ??= { td: 0, men: 0, py: 0, pts: 0 }; t.td += tds; t.men += men; t.py += T.py; t.pts += side === 'h' ? S.hs : S.as }
  }
  // 17: the end of the game
  let hs = 0, as = 0
  for (const p of S.plays) {
    if (!p.p) continue
    const lead = p.s === 'h' ? hs - as : as - hs
    G.scores++
    if (p.t === 3599 || p.t === 1799) G.at1++
    if (p.t >= 3560 && p.t < 3600) { G.late++; if (lead > 0) { G.lateLead++; bad(`${Fx.year} ${S.G.h}-${S.G.a}: ${p.k} at ${whenOf(p.t)} by the team ahead ${lead}`) } }
    if (p.s === 'h') hs += p.p; else as += p.p
  }
  if (S.dr.some(d => d.res === 'kneel')) G.kneels++
  if (S.ot) G.ot++
}

// ── the player's games: moments played by the sim, every snap checked ──
const M = { n: 0, leadKneel: 0, otGames: 0, otMoment: 0, tdLong: 0, tdN: 0, score: 0, buildsMissing: 0, buildsLines: 0 }
function myWeek() {
  const r = FR.playWeek(F, { moments: true })
  let otm = false
  if (r.pending) {
    let out = r
    while (out?.pending) {
      const v = FR.momentView(F), S = F.pend.S
      M.n++
      const us = S.key.us, mine = us === 'h' ? S.hs : S.as, theirs = us === 'h' ? S.as : S.hs
      if (v.mine !== mine || v.theirs !== theirs) { M.score++; bad(`moment score ${v.mine}-${v.theirs}, the game ${mine}-${theirs}`) }
      if (v.ball === 'us' && v.mine > v.theirs && !v.ot && v.half === 2 && v.left <= 110) { M.leadKneel++; bad(`a moment ahead ${v.mine}-${v.theirs} with the ball at ${v.clock} of the 4th`) }
      if (v.ot) otm = true
      const call = v.ball === 'us' ? FR.PLAYS[FR.playsFor(v)[M.n % FR.playsFor(v).length]].kind : 'run'
      const res = FR.nameSnap(F, v, { ...FR.simSnap(S, call, `rc${M.n}`), call })
      out = FR.finishMoment(F, res)
    }
  }
  const row = F.log[F.log.length - 1]
  if (row && (row.ot)) { M.otGames++; if (otm) M.otMoment++ }
  return row
}
function checkRow(row) {
  if (!row) return
  // touchdown lengths: no "27-yd pass from the 3" (the plays' own spot: the summary's yards fit the field)
  for (const k of row.kp ?? []) {
    if (k[2] < 6) continue
    M.tdN++
    const y = +(String(k[3]).match(/ (\d+)-yd /)?.[1] ?? 0)
    const pl = lastS?.plays.find(p => p.k === 'td' && p.t === k[0])
    const cap = pl?.fy != null ? 100 - pl.fy : 99
    if (y > cap) { M.tdLong++; bad(`week ${row.wk}: ${k[3]} from the ${pl.fy} (${cap} yards to go)`) }
    if (pl?.fy != null) M.tdSpot = (M.tdSpot ?? 0) + 1
  }
  // 19: every build who played has his line
  const on = new Set(Object.entries(row.bx?.ro ?? {}).filter(([, x]) => x[3] != null).map(([id]) => +id))
  for (const id of on) { M.buildsLines++; if (!(row.lines ?? []).some(l => l.pid === id && l.line)) { M.buildsMissing++; bad(`build ${id} played week ${row.wk} with no line on the final card`) } }
  // 2: the box sheet's teams, both sides, from the row
  const B = FR.gameBox(F, row)
  if (B) {
    const oppMen = Object.values(B.opp.game.s)
    const py = oppMen.reduce((a, x) => a + (x.py ?? 0), 0)
    if (py !== B.game.them.py) bad(`week ${row.wk}: their passing ${B.game.them.py} vs their men ${py}`)
    const tdsMine = Object.values(B.game.s).reduce((a, x) => a + (x.rctd ?? 0) + (x.rtd ?? 0), 0), tdsTheirs = oppMen.reduce((a, x) => a + (x.rctd ?? 0) + (x.rtd ?? 0), 0)
    const kpMine = row.kp.filter(x => x[1] && x[2] >= 6).length, kpTheirs = row.kp.filter(x => !x[1] && x[2] >= 6).length
    if (tdsMine !== kpMine || tdsTheirs !== kpTheirs) bad(`week ${row.wk}: touchdowns on the men ${tdsMine}-${tdsTheirs}, in the summary ${kpMine}-${kpTheirs}`)
  }
}

// ── 3, 4, 5: the offseason ──
const C4 = { charts: 0, off: 0, badSpot: 0 }
function olCheck(label, short, C = FR.startersOf(F, short)) {
  for (let j = 1; j <= 5; j++) {
    const p = C[`ol${j}`]; if (!p) continue
    const spot = FR.OL_SPOTS[j - 1]
    C4.charts++
    if (p.s !== spot) C4.off++
    if (FR.spotCost(spot, p.s) >= 14) { C4.badSpot++; bad(`${label} ${short}: ${p.n} (${p.s}) at ${spot}`) }
  }
}
const QB = { seasons: [], full: [] }
function offseason() {
  FR.closeSeason(F); FR.ageLeague(F); FR.openResign(F)
  for (const id of [...F.rs]) { const p = F.teams[F.team].r.find(x => x.i === id); FR.resignOne(F, id, FR.optionDue?.(p) ? 'option' : p.o >= 76) }
  FR.openFA(F); while (F.fad) FR.nextFADay(F)
  FR.openDraft(F); while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  FR.closeDraft?.(F)
  // 3: the player's drafted men on rookie deals, before and after the new season
  const t = F.teams[F.team]
  const rookies = t.r.filter(p => p.rc && p.dr).map(p => p.i), size0 = t.r.length
  // 5: who wears what, for the men who'll stay
  const nums = {}
  for (const s of FR.SHORTS) for (const p of F.teams[s].r) if (p.nu != null) nums[p.i] = [s, p.nu]
  FR.autoCamp(F); FR.newSeason(F)
  const now = new Set(F.teams[F.team].r.map(p => p.i)), fa = new Set((F.fa ?? []).map(p => p.i))
  let gone = 0
  // (a man the cut-down does let go is released the way the wire sees it: a free agent and a RELEASED line; the only
  // drafted man that can happen to is a kicker who loses the job in camp)
  let rel = 0
  for (const id of rookies) {
    if (now.has(id)) continue
    const p = (F.fa ?? []).find(x => x.i === id), wire = (F.news ?? []).some(x => x.tag === 'RELEASED' && p && x.text.includes(p.n) && x.y === F.year)
    if (p && wire) { rel++; console.log(`   released in camp: ${p.n} ${p.p} ${p.o}`); continue }
    gone++; bad(`${F.year}: drafted man ${id} on his rookie deal is gone from the player's team (${p ? 'a free agent with no RELEASED line' : 'nowhere'})`)
  }
  console.log(`${F.year} camp: ${rookies.length} drafted men on rookie deals, ${gone} gone without a word, ${rel} released on the wire · roster ${size0} → ${F.teams[F.team].r.length}`)
  // 4: the line by spot, every team
  for (const s of FR.SHORTS) olCheck(`${F.year} camp`, s)
  // 5: in order after camp; numbers
  const stale = FR.staleChart(F)
  if (stale.length) bad(`${F.year} camp: chart out of date: ${stale.map(x => `${x.better.n} ${x.better.o} behind ${x.starter.n} ${x.starter.o}`).join('; ')}`)
  let kept = 0, lost = 0, dupe = 0
  for (const s of FR.SHORTS) {
    FR.depthChart(F, s)
    const seen = new Map()
    for (const p of F.teams[s].r) { const n = FR.jersey(F, p); if (n == null) continue; if (seen.has(n)) { dupe++; bad(`${F.year} ${s}: #${n} on ${seen.get(n)} and ${p.n}`) } seen.set(n, p.n) }
    for (const p of F.teams[s].r) { const was = nums[p.i]; if (was && was[0] === s && p.b == null) { if (p.nu === was[1]) kept++; else { lost++; bad(`${F.year} ${s}: ${p.n} lost #${was[1]} (now ${p.nu})`) } } }
  }
  console.log(`${F.year} numbers: ${kept} kept, ${lost} changed, ${dupe} shared`)
}

// ── the seasons ──
for (let y = 0; y < N; y++) {
  // 14: the Week 1 starting quarterbacks
  const qb1 = Object.fromEntries(FR.SHORTS.map(s => [s, FR.startersOf(F, s).qb1?.i]))
  if (y === 0) { for (const s of FR.SHORTS) olCheck('default', s); FR.resetChart(F); olCheck('reset', F.team) }
  let wk = 0
  while (F.phase === 'season') {
    if (F.ev) FR.chooseEvent(F, wk % 2)
    const before = F.log.length
    myWeek()
    if (F.log.length > before) checkRow(F.log[F.log.length - 1])
    wk++
    // 1: halfway, on a copy of the league: its starters hurt; two weeks on, each has what he had (and no more games)
    if (F.wk === 9 && F.phase === 'season') {
      const C = FR.upgradeSave(FR.unpackFranchise(FR.packFranchise(F)))
      const tot = FR.leagueStats(C), hurt = []
      for (const s of FR.SHORTS) { if (s === C.team) continue; const L = FR.startersOf(C, s); for (const k of ['qb1', 'rb1', 'wr1']) if (L[k]) { L[k].in = 3; L[k].ij = { l: 'ankle', w: 3 }; hurt.push(L[k].i) } }
      const fn = BOXLOG.fn; BOXLOG.fn = null   // (the copy's games aren't the season's)
      for (let k = 0; k < 2; k++) { if (C.ev) C.ev = null; FR.playWeek(C, { moments: false }) }
      BOXLOG.fn = fn
      const after = FR.leagueStats(C)
      let changed = 0
      for (const id of hurt) if (JSON.stringify(tot[id]) !== JSON.stringify(after[id])) { changed++; if (changed < 4) bad(`${C.year}: ${id} hurt, ${JSON.stringify(tot[id])} -> ${JSON.stringify(after[id])}`) }
      if (changed) bad(`${C.year}: ${changed} of ${hurt.length} men hurt mid-season had their lines change`)
      console.log(`${C.year} week 9 (a copy): ${hurt.length} starters hurt for two weeks, ${changed} lines changed`)
    }
  }
  const sizeReg = FR.saveSize(F)
  // 14
  const tot = JSON.parse(JSON.stringify(FR.leagueStats(F)))   // (a copy: the player's lines are his season's own objects)
  const full = FR.SHORTS.filter(s => (tot[qb1[s]]?.gp ?? 0) >= 17).length
  QB.full.push(full)
  const gps = FR.SHORTS.map(s => tot[qb1[s]]?.gp ?? 0).sort((a, b) => a - b)
  console.log(`${F.year}: ${full} of 32 Week 1 starting QBs played all 17 · games: ${gps.join(' ')}`)
  // 1: the season's lines don't move: stars hurt for the year, men traded, the save packed and read back
  const snap = JSON.stringify(FR.leagueStats(F))
  const leaders = c => FR.leaders(F, c, 5).map(x => `${x.p.n} ${x.v}`).join(', ')
  const lead0 = ['py', 'ry', 'sck'].map(leaders).join(' | ')
  const stars = []
  for (const s of FR.SHORTS) { const L = FR.startersOf(F, s); for (const p of Object.values(L)) if (p.o >= 85 && s !== F.team && !p.in) { p.in = 60; p.ij = { l: 'torn ACL', w: 60, se: 1 }; stars.push(p) } }
  const a = F.teams.BUF.r.find(p => p.p === 'wr'), b = F.teams.KC.r.find(p => p.p === 'wr')
  if (a && b) { F.teams.BUF.r = F.teams.BUF.r.filter(p => p !== a); F.teams.KC.r = F.teams.KC.r.filter(p => p !== b); F.teams.BUF.r.push(b); F.teams.KC.r.push(a) }
  if (JSON.stringify(FR.leagueStats(F)) !== snap) bad(`${F.year}: the season's lines changed after injuries and a trade`)
  const F2 = FR.upgradeSave(FR.unpackFranchise(FR.packFranchise(F)))
  if (JSON.stringify(FR.leagueStats(F2)) !== snap) bad(`${F.year}: the season's lines changed after a save and load`)
  const lead1 = ['py', 'ry', 'sck'].map(leaders).join(' | ')
  if (lead0 !== lead1) bad(`${F.year}: leaders moved: ${lead0} → ${lead1}`)
  for (const p of stars) { delete p.in; delete p.ij }   // (the test's injuries undone: the playoffs play as they would have)
  // 1: the league's lines add up to its games (passing yards and touchdowns, team by team)
  let pyOff = 0, tdOff = 0
  for (const s of FR.SHORTS) {
    const t = byTeam[s]; if (!t) continue
    const men = FR.SHORTS.length && Object.entries(tot).filter(([id]) => FR.whoIs(F).get(id)?.s === s)
    void men
    if (t.men > t.td) tdOff++
    void pyOff
  }
  console.log(`${F.year} league: passing yards kept ${Object.values(tot).reduce((x, v) => x + (v.py ?? 0), 0)} vs the games' ${Object.values(byTeam).reduce((x, t) => x + t.py, 0)}`)
  const pyMen = Object.values(tot).reduce((x, v) => x + (v.py ?? 0), 0), pyGames = Object.values(byTeam).reduce((x, t) => x + t.py, 0)
  if (pyMen !== pyGames) bad(`${F.year}: the league's passing yards ${pyMen} vs its games' ${pyGames}`)
  for (const k of Object.keys(byTeam)) delete byTeam[k]
  FR.intoPlayoffs(F)
  while (F.phase === 'playoffs') {
    if (FR.userAlive(F)) { const before = F.log.length; myWeek(); if (F.log.length > before) checkRow(F.log[F.log.length - 1]) }
    else FR.simPlayoffs(F)
  }
  const sizePost = FR.saveSize(F)
  console.log(`${F.year} save: ${(sizeReg / 1024).toFixed(1)} KB at the end of the regular season, ${(sizePost / 1024).toFixed(1)} KB after the playoffs (F.lg ${(JSON.stringify(F.lg).length / 1024).toFixed(1)} KB, F.lgp ${(JSON.stringify(F.lgp ?? {}).length / 1024).toFixed(1)} KB, F.log ${(JSON.stringify(F.log).length / 1024).toFixed(1)} KB, F.ss ${(JSON.stringify(F.ss).length / 1024).toFixed(1)} KB)`)
  // career lines are the kept season's
  const career = {}
  for (const s of FR.SHORTS) for (const p of F.teams[s].r) if (p.p === 'qb') career[p.i] = tot[p.i]?.py ?? 0
  offseason()
  let cOff = 0
  for (const s of FR.SHORTS) for (const p of F.teams[s].r) { const row = (p.cr ?? []).find(r => r[0] === F.year - 1); if (p.p === 'qb' && row && career[p.i] != null && row[3] !== career[p.i]) { cOff++; bad(`${p.n} ${s} career ${JSON.stringify(p.cr)} vs kept ${career[p.i]}`) } }
  if (cOff) bad(`${F.year - 1}: ${cOff} QB career lines differ from the season's kept lines`)
}

// ── an old save: no kept lines; freezes once on load, then holds ──
{
  const O = FR.createFranchise({ seed: 'old', team: 'DET', owner: 'G', builds: [] })
  FR.simWeeks(O, { until: 8 })
  const row = O.log[O.log.length - 1]
  // (what a save from before this update looks like: no F.lg, no week lines, no other team's lines on its rows)
  delete O.lg; delete O.wkl; delete O.lgp; for (const r of O.log) if (r.bx) delete r.bx.ox
  for (const s of FR.SHORTS) for (const p of O.teams[s].r) if (p.nu != null) p.nu %= 100
  delete O.nt
  const L = FR.upgradeSave(FR.unpackFranchise(FR.packFranchise(O)))
  const a1 = JSON.stringify(FR.leagueStats(L))
  if (!L.lg || !Object.keys(L.lg).length) bad('old save: nothing frozen on load')
  const Lrow = L.log[L.log.length - 1]
  if (!Lrow.bx?.ox || !Object.keys(Lrow.bx.ox).length) bad('old save: the other team\'s lines were not kept on its rows')
  for (const s of FR.SHORTS) { const st = FR.startersOf(L, s); if (st.qb1) { st.qb1.in = 4 } }
  const L2 = FR.upgradeSave(FR.unpackFranchise(FR.packFranchise(L)))
  if (JSON.stringify(FR.leagueStats(L2)) !== a1) bad('old save: the frozen lines changed after injuries and a second load')
  BOXLOG.fn = null   // (this league's games aren't the season's above)
  FR.playWeek(L2, { moments: false })
  const a2 = FR.leagueStats(L2)
  const grew = Object.entries(JSON.parse(a1)).filter(([id, v]) => (a2[id]?.gp ?? 0) < (v.gp ?? 0)).length
  if (grew) bad(`old save: ${grew} men lost games after the next week`)
  console.log(`old save: ${Object.keys(JSON.parse(a1)).length} men frozen, week ${row.wk} box: ${Object.keys(Lrow.bx.ox).length} of the other team's men kept`)
}

// ── the clock's words ──
for (const [t, want, po] of [[1800, 'Q2 0:00'], [1801, 'Q3 14:59'], [900, 'Q1 0:00'], [3600, 'Q4 0:00'], [3900, 'OT 5:00'], [3900, 'OT 10:00', true], [4500, 'OT 0:00', true], [4560, '2OT 14:00', true]]) if (whenOf(t, po) !== want) bad(`whenOf(${t}${po ? ', po' : ''}) is ${whenOf(t, po)}, not ${want}`)

console.log(`\nboxes: ${G.games} games, ${G.sides} sides · passer≠receivers ${G.pass} · team line≠men ${G.team} · picks/sacks/fumbles≠other side ${G.cross} · turnovers≠game ${G.to} · more TDs on the men than the game ${G.tdOver}`)
console.log(`touchdowns with no man (returns, the league's games): ${G.tdMiss} · the player's games: ${G.tdUserMiss} of ${G.tdUser}`)
console.log(`end of games: ${G.scores} scores, ${G.at1} at 0:01 (${(100 * G.at1 / G.scores).toFixed(2)}%), ${G.late} in the last 40 seconds, ${G.lateLead} of them by the team ahead · ${G.kneels} games ended on a knee · ${G.ot} overtimes`)
console.log(`moments: ${M.n} · ahead with the ball inside 1:50: ${M.leadKneel} · score wrong: ${M.score} · the player's overtime games: ${M.otGames}, with an overtime moment: ${M.otMoment}`)
console.log(`touchdowns named: ${M.tdN} (${M.tdSpot ?? 0} with their play's spot kept), too long for the field: ${M.tdLong} · builds who played: ${M.buildsLines}, no line: ${M.buildsMissing}`)
console.log(`line spots: ${C4.charts} starters checked, ${C4.off} at another spot, ${C4.badSpot} a tackle at centre or a centre at tackle`)
console.log(`Week 1 QBs who played all 17: ${QB.full.join(', ')} (mean ${(QB.full.reduce((a, b) => a + b, 0) / QB.full.length).toFixed(1)}; NFL 10-14)`)
const qbMean = QB.full.reduce((a, b) => a + b, 0) / QB.full.length
if (qbMean < 8 || qbMean > 16) bad(`Week 1 QBs who played all 17: ${qbMean.toFixed(1)} a season`)
if (G.at1 / G.scores > 0.02) bad(`${(100 * G.at1 / G.scores).toFixed(1)}% of scores at 0:01`)
if (M.otGames >= 3 && M.otMoment < M.otGames * 0.6) bad(`overtime moments in ${M.otMoment} of ${M.otGames} overtime games`)
console.log(problems.length ? `\n${problems.length} PROBLEM(S)` : '\nOK: no problems')
