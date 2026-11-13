// PLAY THE MOMENTS check. Plays the user's games with the stops on, under four ways of playing them:
//   sim    every moment handed back (SIM THIS ONE)        win    every mini game won
//   lose   every mini game lost                           skill  a decent player: wins about 70%
// and checks every stop: 4 to 6 moments a game, never the same mini game twice in a game, at most two coach's
// calls, the game offered is one the situation calls for and the man taking it plays that position. Then the
// win rate under each way of playing: winning moments should lift it by a believable amount, not guarantee it.
//   bash scripts/franchise/run.sh scripts/franchise/moments-check.mjs [seasons=2]
import * as FR from '../../src/lib/franchise/index'
import { GAMES } from '../../src/lib/minigames'

const SEASONS = Number(process.argv[2] ?? 2)
const TEAMS = ['KC', 'CHI', 'NYJ', 'DEN', 'ATL', 'SEA']
const PLAYS = {
  qb: ['third-long', 'hot-read', 'audible', 'escape', 'bomb', 'sneak', 'two-minute', 'goal-line'], rb: ['gap', 'juke', 'goal-line', 'kick-return'], wr: ['catch', 'juke-wr', 'release', 'goal-line', 'kick-return'],
  te: ['catch', 'seal', 'juke-te', 'goal-line', 'release'], ol: ['pass-pro', 'seal'], dl: ['pass-rush', 'run-stuff', 'tackle-angle'], lb: ['zone-drop', 'hit-stick', 'run-stuff', 'pass-rush', 'tackle-angle'],
  db: ['jump-route', 'tackle-angle', 'kick-return'], k: ['game-winner', 'onside'],
}
// does the situation really call for this game
function fits(stop) {
  const s = stop.situation, g = stop.game, dn = s.down, d = s.dist, toGoal = s.spot == null ? null : 100 - s.spot, lead = s.us - s.them
  const off = stop.side === 'off', def = stop.side === 'def'
  switch (g) {
    case 'third-long': case 'pass-pro': case 'escape': return off && dn >= 3 && d >= 7
    case 'release': return off && dn >= 3 && d >= 3
    case 'hot-read': return off && dn >= 3 && d >= 3 && d <= 6
    case 'audible': return off && ((dn >= 3 && d >= 3 && d <= 6) || (dn <= 2 && d >= 5))
    case 'catch': return off && ((dn >= 3 && d >= 3) || (toGoal <= 20 && dn >= 2 && d >= 3))
    case 'bomb': return off && dn <= 2 && s.spot >= 30 && s.spot <= 62
    case 'sneak': return off && dn >= 3 && d <= 1
    case 'gap': case 'seal': return off && dn >= 3 && d <= 2
    case 'goal-line': return off && dn === 4 && toGoal <= 8 && d === toGoal
    case 'juke': case 'juke-wr': case 'juke-te': return off && dn <= 2
    case 'two-minute': return off && s.q === 4 && s.clock <= 135 && lead < 0 && lead >= -8
    case 'pass-rush': case 'jump-route': case 'zone-drop': return def && ((dn >= 3 && d >= 3) || (g === 'jump-route' && toGoal <= 20 && dn >= 2))
    case 'run-stuff': case 'hit-stick': return def && ((dn >= 3 && d <= 2) || (toGoal <= 3 && dn >= 2))
    case 'tackle-angle': return def && dn <= 2
    case 'kick-return': return stop.side === 'st' && s.down === 0
    case 'game-winner': return stop.side === 'st' && s.q >= 4 && lead <= 0 && lead >= -3
    case 'onside': return stop.side === 'st' && s.q === 4 && lead < 0
    default: return false
  }
}
const problems = []
const stats = {}
const used = {}
function playSeason(policy, team, seed, seasons) {
  let F = FR.createFranchise({ team, gmName: 'Moments', seed })
  const R = (() => { let k = 12345; return () => { k = (k * 16807) % 2147483647; return k / 2147483647 } })()
  const S = (stats[policy] ??= { games: 0, w: 0, l: 0, t: 0, stops: [], calls: [], won: 0, lost: 0, dur: 0 })
  for (let y = 0; y < seasons; y++) {
    let guard = 0
    while (F.phase !== 'offseason' && guard++ < 40) {
      F = FR.delegateWeek(F)
      F = FR.startGame(F, { mode: 'moments' })
      if (F.flash && F.flash.ok === false) { F = FR.advanceWeek(F); continue }
      let n = 0
      const seen = new Set()
      for (let k = 0; k < 40; k++) {
        F = FR.nextStop(F)
        const v = FR.gameView(F), stop = v.stop
        if (!stop) { problems.push('no stop after nextStop'); break }
        if (stop.kind === 'final') break
        if (stop.kind === 'call') { if (stop.options.length < 2 || !stop.options.some(o => o.staff)) problems.push(`a call with bad options: ${JSON.stringify(stop.options).slice(0, 120)}`); F = FR.resolveStop(F, 'sim'); continue }
        n++
        if (!GAMES[stop.game]) problems.push(`unknown game ${stop.game}`)
        if (seen.has(stop.game)) problems.push(`${stop.game} twice in a game`)
        seen.add(stop.game)
        used[stop.game] = (used[stop.game] ?? 0) + 1
        if (!fits(stop)) problems.push(`${stop.game} does not fit: ${stop.situation.short} (${stop.side}) ${stop.situation.us}-${stop.situation.them}`)
        if (!(PLAYS[stop.player.pos] ?? []).includes(stop.game)) problems.push(`${stop.game} taken by a ${stop.player.pos}`)
        if (!(stop.player.v >= 0 && stop.player.v <= 11) || !(stop.odds > 0 && stop.odds < 1) || !stop.win || !stop.loss || !stop.situation.text || !stop.mg?.game) problems.push(`a stop is missing something: ${stop.game}`)
        const win = policy === 'win' ? true : policy === 'lose' ? false : policy === 'skill' ? R() < 0.7 : null
        if (win === true) S.won++; else if (win === false) S.lost++
        F = FR.resolveStop(F, win == null ? 'sim' : { win, score: win ? 0.6 + R() * 0.4 : R() * 0.4 })
      }
      const v = FR.gameView(F)
      if (!v || v.status !== 'final') { problems.push('the game did not reach its final'); F = FR.skipGame(F) }
      const fin = FR.gameView(F)
      S.games++; S.stops.push(n); S.calls.push(fin.calls.length)
      if (fin.calls.length > 2) problems.push(`${fin.calls.length} coach's calls in a game`)
      if (n < 4 || n > 6) problems.push(`${n} moments in a game (${fin.score.us}-${fin.score.them}, ${fin.label})`)
      if (fin.stop.result.won) S.w++; else if (fin.stop.result.tied) S.t++; else S.l++
      F = FR.finishGame(F)
      if (FR.gameView(F) !== null) problems.push('gameView is not null after finishGame')
    }
    while (F.phase === 'offseason') F = FR.advanceStage(F, { auto: true })
  }
  return F
}
for (const policy of ['sim', 'win', 'lose', 'skill']) TEAMS.forEach((team, i) => playSeason(policy, team, `moments-${i}`, SEASONS))
// the same choices play the same games
const a = playSeason('skill', 'KC', 'moments-replay', 1), b = playSeason('skill', 'KC', 'moments-replay', 1)
if (JSON.stringify({ ...a, rev: 0, flash: null }) !== JSON.stringify({ ...b, rev: 0, flash: null })) problems.push('the same choices played two different seasons')

console.log(`PLAY THE MOMENTS: ${TEAMS.length} teams x ${SEASONS} seasons under each way of playing`)
for (const [k, S] of Object.entries(stats)) {
  const dist = [4, 5, 6].map(n => `${n}: ${S.stops.filter(x => x === n).length}`).join('  '), other = S.stops.filter(x => x < 4 || x > 6).length
  console.log(`  ${k.padEnd(6)} ${S.games} games  ${S.w}-${S.l}${S.t ? '-' + S.t : ''}  win ${(S.w / S.games * 100).toFixed(1)}%   moments a game ${(S.stops.reduce((x, y) => x + y, 0) / S.games).toFixed(2)} (${dist}${other ? `  outside 4-6: ${other}` : ''})   calls a game ${(S.calls.reduce((x, y) => x + y, 0) / S.games).toFixed(2)}`)
}
console.log('  games used:', Object.entries(used).sort((x, y) => y[1] - x[1]).map(([g, n]) => `${g} ${n}`).join(', '))
console.log(`PROBLEMS: ${problems.length}`)
const byMsg = {}
for (const p of problems) byMsg[p.replace(/\d+/g, '#')] = (byMsg[p.replace(/\d+/g, '#')] ?? 0) + 1
for (const [m, n] of Object.entries(byMsg).sort((x, y) => y[1] - x[1]).slice(0, 12)) console.log(`  ${n}x ${m}`)
for (const p of problems.slice(0, 12)) console.log('  ' + p)
process.exitCode = problems.length ? 1 : 0
