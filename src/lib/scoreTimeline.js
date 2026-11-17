// A football final played back as its scoring plays (components/LiveGame.jsx: the playoff and bowl scoreboard, the
// NFL's and College Football's). Every play is worth what it is: a touchdown 6, 7 or 8 (the try missed, kicked, or
// two), a field goal 3, a safety 2, and the plays add up to the final exactly. Overtime: the regulation score is tied,
// then each side's overtime plays, the winner's last (a final like 15-13 in a third overtime reads TD, TD + 2PT;
// 7-3 in the first is their field goal, then the touchdown). Only a final no football game can have (1) has no plays.
// (2026-11-16: an overtime's whole margin was one play called a field goal, 2 or 4 points in College's overtimes,
// and a final of 2, 4 or 5 was played as 6 and put right at the horn.)
const TD = [{ pts: 7, w: 63 }, { pts: 3, w: 30 }, { pts: 8, w: 4 }, { pts: 6, w: 3 }]
// totals the plays without a safety can make: everything but 1, 2, 4 and 5
const plain = n => n === 0 || (n >= 3 && n !== 4 && n !== 5)
// with as few safeties as it takes (a 2-0 game, a 5 is a field goal and a safety)
export const reachable = n => n === 0 || n >= 2
export const playLabel = pts => (pts === 8 ? 'TD + 2PT' : pts >= 6 ? 'TD' : pts === 3 ? 'FG' : pts === 2 ? 'SAFETY' : '')

export function toPlays(total, rand = Math.random) {
  if (!(total > 0) || !reachable(total)) return []
  let safeties = 0
  while (!plain(total - 2 * safeties)) safeties++
  const plays = Array(safeties).fill(2)
  let rem = total - 2 * safeties
  while (rem > 0) {
    const opts = TD.filter(o => o.pts <= rem && plain(rem - o.pts))
    if (!opts.length) break
    let r = rand() * opts.reduce((s, o) => s + o.w, 0)
    const pick = opts.find(o => (r -= o.w) < 0) ?? opts[0]
    plays.push(pick.pts)
    rem -= pick.pts
  }
  return plays
}
// overtime: { tie (the score at the end of regulation), win (the winner's overtime points), lose (the loser's) }, the
// fewest points the loser can have scored in it. A margin of 3 is a field goal; 6, 7 or 8 a touchdown; anything else
// had both sides scoring. null: a final no overtime can end on.
export function overtimeSplit(myFinal, oppFinal) {
  const W = Math.max(myFinal, oppFinal), L = Math.min(myFinal, oppFinal), d = W - L
  for (const lose of [0, 3, 6, 7, 8, 10, 13, 14, 15, 16]) {
    const win = d + lose, tie = L - lose
    if (tie < 0) break
    if (plain(tie) && plain(win) && win > 0 && (lose === 0 || plain(lose))) return { tie, win, lose }
  }
  return null   // (no overtime makes this final: it is played as a regulation game)
}

// [{ team: 'me' | 'opp', pts, label, gameSec }] in the order they land (gameSec past 3600: overtime)
export function buildScoreTimeline(myFinal, oppFinal, overtime = false, rand = Math.random) {
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]] } return arr }
  const winner = myFinal > oppFinal ? 'me' : 'opp'
  const ot = overtime && myFinal !== oppFinal ? overtimeSplit(myFinal, oppFinal) : null
  const regMy = ot ? ot.tie : myFinal, regOpp = ot ? ot.tie : oppFinal
  const all = shuffle([...toPlays(regMy, rand).map(pts => ({ team: 'me', pts })), ...toPlays(regOpp, rand).map(pts => ({ team: 'opp', pts }))])
  const spacing = all.length ? Math.floor(3400 / all.length) : 900
  const events = all.map((evt, i) => ({ ...evt, gameSec: Math.min(3400, Math.round(spacing * i + rand() * spacing * 0.7 + 25)) }))
  if (ot) {
    // the loser's overtime points first, the winner's last (the play that ends it)
    const loser = winner === 'me' ? 'opp' : 'me'
    const lp = toPlays(ot.lose, rand), wp = toPlays(ot.win, rand)
    const seq = []
    for (let i = 0; i < Math.max(lp.length, wp.length); i++) { if (lp[i]) seq.push({ team: loser, pts: lp[i] }); if (wp[i]) seq.push({ team: winner, pts: wp[i] }) }
    // (the winner's last play is the last event)
    const last = seq.map(e => e.team).lastIndexOf(winner)
    if (last >= 0 && last !== seq.length - 1) seq.push(...seq.splice(last, 1))
    seq.forEach((e, i) => events.push({ ...e, gameSec: 3700 + Math.round(((i + 0.5) / seq.length) * 600) }))
  } else {
    // a close game: sometimes the winning score comes in the final minute
    const margin = Math.abs(myFinal - oppFinal)
    if (events.length >= 1 && margin <= 7 && rand() < 0.5) {
      for (let i = events.length - 1; i >= 0; i--) if (events[i].team === winner) { events[i].gameSec = 3530 + Math.floor(rand() * 65); break }
    }
  }
  events.sort((a, b) => a.gameSec - b.gameSec)
  return events.map(e => ({ ...e, label: playLabel(e.pts) }))
}
