// Game day's moments, headless (owner, 2026-11-16): how often they come and whether what they did reaches the game.
//   bash scripts/franchise2/run.sh scripts/franchise2/moments-check.mjs [games=200] [team=DET]
// 1. Frequency: every one of the player's games over full seasons (the playoffs too), moments on, each snap played by
//    the sim (simSnap, the league's results): offense and defense moments a game, by how close the game was.
// 2. Never in a blowout: no moment comes with the player's team more than 8 down or up in the 4th quarter (14 at the
//    half); never in a game the player's team isn't in.
// 3. The result reaches the game: the scoring summary adds up to the final; a moment's touchdown is in the summary, named
//    as the play was; its men's lines are in the box score (the passer's attempts, the catch, the carry, the tackle);
//    a moment's turnover is a turnover in the box.
// 4. Moments that aren't played (the sim's snap) don't change how often the team wins: win rate with moments against
//    the same seasons without them.
import * as FR from '../../src/lib/franchise2/index'
import { QBS } from '../../src/data/qbs'
import { WRS } from '../../src/data/wrs'

const N = Number(process.argv[2] ?? 200), team = process.argv[3] ?? 'DET'
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const qb = QBS.find(p => p.name === 'Josh Allen'), wr = WRS.find(p => p.attrs)
const problems = []
const bad = m => { problems.push(m); if (problems.length < 30) console.log('  !! ' + m) }
const make = (seed, moments) => {
  const F = FR.createFranchise({ seed, team, owner: 'Graham', builds: [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Hale', num: 7 }, { pos: 'wr', build: asBuild(wr), name: 'Dre Collins', num: 11 }], coach: { name: 'Coach', style: 'developer', r: { talentDev: 6, offPlaycalling: 6, defPlaycalling: 6, culture: 6, situational: 6 }, ovr: 72 } })
  F.games = moments ? 'advanced' : 'off'
  return F
}
const hist = { off: [0, 0, 0, 0], def: [0, 0] }
const kinds = {}
let games = 0, offN = 0, defN = 0, close = 0, closeM = 0, blow = 0, blowM = 0, wins = { on: 0, off: 0 }, played = { on: 0, off: 0 }
let tdChecked = 0, statChecked = 0, toChecked = 0
function oneWeek(F, on) {
  const r = FR.playWeek(F, { moments: on })
  let n = { off: 0, def: 0 }, ms = []
  if (r.pending) {
    let out = { pending: true }
    while (out?.pending) {
      const v = FR.momentView(F)
      if (!v) { bad('pending with no moment'); break }
      if (v.us !== F.team) bad('a moment in a game the player is not in')
      const m = v.mine - v.theirs
      if (!v.ot && v.period === '4TH' && Math.abs(m) > 8) bad(`moment in a blowout: ${v.mine}-${v.theirs} ${v.period} ${v.clock}`)
      if (!v.ot && v.period !== '4TH' && Math.abs(m) > 14) bad(`moment at ${v.mine}-${v.theirs} ${v.period}`)
      if (v.down < 1 || v.down > 4 || v.d < 1 || v.y < 1 || v.y > 99 || v.y + v.d > 100 && !v.goal) bad(`snap ${JSON.stringify({ down: v.down, d: v.d, y: v.y, goal: v.goal })}`)
      n[v.side]++; kinds[v.kind] = (kinds[v.kind] ?? 0) + 1
      // the play, as the sim plays it, named
      const call = v.ball === 'us' ? (FR.playsFor(v).length > 1 ? FR.PLAYS[FR.playsFor(v)[(games + n.off) % 3]].kind : 'run') : 'run'
      const res = FR.nameSnap(F, v, { ...FR.simSnap(F.pend.S, call, `chk${n.off + n.def}`), call })
      ms.push({ v, res })
      out = FR.finishMoment(F, res)
    }
  }
  return { n, ms }
}
function season(F, on, rows) {
  while (F.phase === 'season') {
    if (F.ev) FR.chooseEvent(F, 0)
    const before = F.log.length
    const { n, ms } = oneWeek(F, on)
    if (F.log.length > before) rows.push({ row: F.log[F.log.length - 1], n, ms })
  }
  FR.intoPlayoffs(F)
  while (F.phase === 'playoffs') {
    if (!FR.userAlive(F)) { FR.simPlayoffs(F); break }
    const before = F.log.length
    const { n, ms } = oneWeek(F, on)
    if (F.log.length > before) rows.push({ row: F.log[F.log.length - 1], n, ms })
  }
}
function check(F, row, ms) {
  const kp = row.kp ?? []
  const us = kp.filter(x => x[1]).reduce((a, x) => a + x[2], 0), them = kp.filter(x => !x[1]).reduce((a, x) => a + x[2], 0)
  if (us !== row.us || them !== row.them) bad(`summary ${us}-${them} vs final ${row.us}-${row.them}`)
  if (!row.bx || !row.dr?.length) bad('a game with no box score or drives kept')
  const sum = (row.dr ?? []).reduce((a, d) => a + (d[1] - d[0]), 0)
  const top = (row.bx?.top ?? [0, 0])[0] + (row.bx?.top ?? [0, 0])[1]
  if (Math.abs(sum - top) > 1) bad(`time of possession ${top} vs drives ${sum}`)
  if (!row.ot && (top < 3200 || top > 3600)) bad(`time of possession adds to ${top}`)
  for (const { v, res } of ms) {
    if (!res.txt || /undefined|null|NaN/.test(res.txt)) bad(`moment text "${res.txt}"`)
    const td = !res.to && (res.td || v.y + (res.yards ?? 0) >= 100)
    if (td && v.ball === 'us') {
      tdChecked++
      if (!kp.some(x => x[1] && x[2] >= 6 && x[3].startsWith(res.txt))) bad(`moment touchdown "${res.txt}" not in the summary: ${kp.map(x => x[3]).join(' | ')}`)
    } else if (!td && !kp.some(x => x[3] === res.txt)) bad(`moment "${res.txt}" not in the summary`)
    // its men's lines are in the box score
    for (const [id, line] of Object.entries(res.st ?? {})) {
      statChecked++
      const box = row.bx?.s?.[id] ?? {}
      for (const [k, n] of Object.entries(line)) if ((box[k] ?? 0) < n && n > 0) bad(`${F.teams[F.team].r.find(p => String(p.i) === id)?.n} ${k} ${box[k] ?? 0} in the box, the moment had ${n}`)
    }
    if (res.to && v.ball === 'us') { toChecked++; if ((row.bx?.u?.to ?? 0) < 1) bad('a moment turnover not in the team box') }
  }
}
const rowsOn = [], rowsOff = []
for (let s = 0; rowsOn.length < N; s++) {
  const F = make(`mc-${s}`, true), G = make(`mc-${s}`, false)
  const a = [], b = []
  season(F, true, a); season(G, false, b)
  for (const x of a) check(F, x.row, x.ms)
  rowsOn.push(...a); rowsOff.push(...b)
  console.log(`season ${s + 1}: ${a.length} games, ${a.reduce((t, x) => t + x.n.off, 0)} offense and ${a.reduce((t, x) => t + x.n.def, 0)} defense moments; ${FR.recText(FR.records(F)[team])} with, ${FR.recText(FR.records(G)[team])} without`)
}
for (const { row, n } of rowsOn.slice(0, N)) {
  games++; offN += n.off; defN += n.def
  hist.off[Math.min(3, n.off)]++; hist.def[Math.min(1, n.def)]++
  const m = Math.abs(row.us - row.them)
  if (m <= 8) { close++; closeM += n.off + n.def } else if (m >= 17) { blow++; blowM += n.off + n.def }
  played.on++; if (row.w) wins.on++
}
for (const { row } of rowsOff.slice(0, N)) { played.off++; if (row.w) wins.off++ }
const pct = (a, b) => `${(100 * a / Math.max(1, b)).toFixed(0)}%`
console.log(`\n${games} games (${team}), moments on, every snap played by the sim:`)
console.log(`  offense moments a game: ${(offN / games).toFixed(2)}  (0: ${hist.off[0]}, 1: ${hist.off[1]}, 2: ${hist.off[2]}, 3: ${hist.off[3]} games)`)
console.log(`  defense moments a game: ${(defN / games).toFixed(2)}  (0: ${hist.def[0]}, 1: ${hist.def[1]} games)`)
console.log(`  games with none: ${pct(rowsOn.slice(0, N).filter(x => x.n.off + x.n.def === 0).length, games)} · in one-score finals: ${(closeM / Math.max(1, close)).toFixed(2)} a game (${close} games) · in 17+ point finals: ${(blowM / Math.max(1, blow)).toFixed(2)} a game (${blow} games)`)
console.log(`  where: ${Object.entries(kinds).map(([k, v]) => `${FR.SNAP_KIND[k]} (${k}) ${v}`).join(' · ')}`)
console.log(`  checked: ${tdChecked} moment touchdowns in the summary, ${statChecked} men's lines in the box, ${toChecked} moment turnovers in the team box`)
console.log(`  wins: ${pct(wins.on, played.on)} with the sim playing the moments, ${pct(wins.off, played.off)} without moments (same seasons; ${played.on} and ${played.off} games)`)
const maxOff = Math.max(...rowsOn.map(x => x.n.off)), maxDef = Math.max(...rowsOn.map(x => x.n.def))
if (maxOff > 3 || maxDef > 1) bad(`a game with ${maxOff} offense / ${maxDef} defense moments`)
console.log(problems.length ? `${problems.length} PROBLEMS` : 'OK: no problems')
