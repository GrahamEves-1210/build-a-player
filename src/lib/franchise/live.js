// FRANCHISE: the user's game day. One live game at a time in F.game (saved with the league, so a reload picks
// it up where it stopped): start it, run it to the next stop (a moment, a coach's call, the final), resolve
// the stop, finish. The same game.js that plays every other game plays this one; moments.js is what stops it.
import { weekLabel, REG_WEEKS, PLAYOFF_ROUNDS } from './consts'
import { touch, fail } from './core'
import { step, profilesOf, spotText, clockText } from './game'
import { makeHooks, resolveMoment, resolveCall, settleCall, winProb } from './moments'
import { prepWeek, makeGame, gameProfiles, gameScore, lineText, dressed } from './week'
import { advanceWeek as runWeek, userGame } from './season'
import { rngOf } from './rng'
import { teamRef, playerRow } from './rows'
import { boxView } from './views'

const hooksFor = (F, G) => (G.mode === 'moments' && F.settings.moments ? makeHooks(F, { moments: true, calls: !!F.settings.calls }) : null)
// the profiles of a game picked up from a save are rebuilt (plans and fits included)
function ready(F, G) { if (!G._T) gameProfiles(F, G) }

export function startGame(F, { mode = 'moments' } = {}) {
  if (F.phase === 'offseason') return fail(F, 'offseason', 'The season is over.')
  if (F.game && !F.game.booked) return touch(F)
  const ug = userGame(F)
  if (!ug) return fail(F, 'bye', F.phase === 'playoffs' ? 'The season is over for this team. Advance the week to follow the playoffs.' : 'It is the bye week. Advance the week to play the rest of the league.')
  const P = prepWeek(F)
  const G = makeGame(F, F.week, ug.i, true, P)
  G.mode = ['moments', 'watch', 'sim'].includes(mode) ? mode : 'moments'
  // how many moments this game is paced for (4 to 6)
  G.momTarget = [4, 5, 5, 5][rngOf(`${F.seed}-${F.year}-${G.id}-target`).int(0, 3)]
  F.game = G
  if (G.mode === 'sim') run(F, G, true)
  return touch(F)
}
function finalStop(F, G) {
  const u = G.user, us = G.sc[u], them = G.sc[1 - u]
  const T = profilesOf(F, G)
  let best = null
  for (let side = 0; side < 2; side++) for (const { p } of dressed(T[side])) {
    const line = G.box[side][p.id]
    if (!line) continue
    const sc = gameScore(p.pos, line) * (G.sc[side] >= G.sc[1 - side] ? 1.15 : 1)
    if (!best || sc > best.sc) best = { p, line, sc }
  }
  const usN = teamRef(u === 0 ? G.h : G.a).nick, themN = teamRef(u === 0 ? G.a : G.h).nick
  return { kind: 'final', result: { won: us > them, tied: us === them, us, them, ot: !!G.ot, text: us > them ? `${usN} win, ${us}-${them}${G.ot ? ' in overtime' : ''}.` : us < them ? `${themN} win, ${them}-${us}${G.ot ? ' in overtime' : ''}.` : `${usN} and ${themN} tie, ${us}-${them}.` },
    potg: best ? { player: playerRow(F, best.p), line: lineText(best.p.pos, best.line) } : null }
}
// one play (or up to a stop). all: keep going until the game is over, rolling every stop.
function run(F, G, all = false, one = false) {
  ready(F, G)
  const hooks = hooksFor(F, G)
  let guard = 0
  while (!G.over && guard++ < 1500) {
    if (G.pend) {
      if (!all) break
      if (G.pend.kind === 'moment') resolveMoment(F, G, profilesOf(F, G), 'sim'); else resolveCall(F, G, 'sim')
      continue
    }
    step(F, G, all ? null : hooks)
    if (!G.pend) settleCall(G)
    if (one) break
  }
  if (G.over && !G.final) G.final = finalStop(F, G)
}
const live = F => (F.game && !F.game.booked ? F.game : null)
export function stepGame(F) {
  const G = live(F)
  if (!G) return fail(F, 'nogame', 'No game is being played.')
  if (!G.over && !G.pend) run(F, G, false, true)
  return touch(F)
}
export function nextStop(F) {
  const G = live(F)
  if (!G) return fail(F, 'nogame', 'No game is being played.')
  if (!G.pend) run(F, G)
  return touch(F)
}
export function resolveStop(F, result) {
  const G = live(F)
  if (!G || !G.pend) return fail(F, 'nostop', 'There is nothing to resolve.')
  ready(F, G)
  if (G.pend.kind === 'moment') resolveMoment(F, G, profilesOf(F, G), result === 'sim' || result == null ? 'sim' : result)
  else resolveCall(F, G, typeof result === 'string' ? result : result?.choice ?? 'sim')
  if (G.over && !G.final) G.final = finalStop(F, G)
  return touch(F)
}
export function skipGame(F) {
  const G = live(F)
  if (!G) return fail(F, 'nogame', 'No game is being played.')
  run(F, G, true)
  return touch(F)
}
export function finishGame(F) {
  const G = live(F)
  if (!G) return fail(F, 'nogame', 'No game is being played.')
  if (!G.over) return fail(F, 'live', 'The game is not over.')
  G.booked = true
  runWeek(F, G)
  return touch(F)
}
// the whole week with the user's game simmed from ratings (also a bye, or a playoff week the team is out of)
export function advanceWeek(F) {
  if (F.phase === 'offseason') return fail(F, 'offseason', 'The season is over. The offseason has its own stages.')
  const G = live(F)
  if (G) { run(F, G, true); G.booked = true; runWeek(F, G) } else runWeek(F, null)
  return touch(F)
}
export function simTo(F, target) {
  let guard = 0
  const done = () => F.phase === 'offseason' || (target === 'playoffs' ? F.phase === 'playoffs' : target === 'offseason' ? false : typeof target?.week === 'number' ? F.week >= target.week || F.phase !== 'regular' : true)
  if (F.phase === 'offseason') return fail(F, 'offseason', 'The season is over.')
  do { const G = live(F); if (G) { run(F, G, true); G.booked = true; runWeek(F, G) } else runWeek(F, null) } while (!done() && guard++ < 30)
  return touch(F)
}

// ── What the game screen reads ───────────────────────────────────────────────
export function gameView(F) {
  const G = F.game
  if (!G) return null
  const u = G.user, round = PLAYOFF_ROUNDS.find(r => r.id === G.playoff)
  const stop = G.over ? (G.final ?? null) : G.pend
  return {
    id: G.id, week: G.week, label: weekLabel(G.week), kind: G.playoff ?? 'regular', superBowl: G.playoff === 'sb', roundName: round?.name ?? null, mode: G.mode, status: G.over ? 'final' : G.pend ? 'stop' : 'live', booked: !!G.booked,
    home: teamRef(G.h), away: teamRef(G.a), userHome: u === 0, us: u === 0 ? G.h : G.a, them: u === 0 ? G.a : G.h,
    score: { us: G.sc[u], them: G.sc[1 - u], home: G.sc[0], away: G.sc[1] }, quarters: { home: G.qs[0], away: G.qs[1] },
    q: G.q, clock: G.clock, clockText: clockText(G.clock), poss: G.kick ? null : (G.poss === 0 ? G.h : G.a), down: G.kick ? 0 : G.down, dist: G.kick ? 0 : G.dist, spot: G.kick ? null : G.yl, spotText: G.kick ? null : spotText(G, G.poss, G.yl),
    timeouts: { home: G.to[0], away: G.to[1] }, weather: { tag: G.env?.tag ?? 'clear', word: WEATHER[G.env?.tag] ?? 'a clear day' },
    log: G.log, drives: G.drives, stop, stops: G.stops, calls: G.calls,
    box: boxView(F, { id: G.id, week: G.week, h: G.h, a: G.a, sc: G.sc, qs: G.qs, ot: G.ot ? 1 : 0, tot: G.tot, box: G.box, scoring: G.scoring }),
    winProb: G.over ? (G.sc[u] > G.sc[1 - u] ? 1 : G.sc[u] < G.sc[1 - u] ? 0 : 0.5) : Math.round(winProb(G, u) * 100) / 100,
  }
}
export const WEATHER = { dome: 'indoors', altitude: 'a mile high', wind: 'swirling wind', rain: 'rain', snow: 'snow', cold: 'bitter cold', clear: 'a clear day' }
export { REG_WEEKS }
