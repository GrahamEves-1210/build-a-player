// NBA FRANCHISE: the season. A day at a time: every game on the night is played (the sim is C's: seams.js), the
// GM's own game can stop for a clutch moment (moments.js), injuries and rest go through the sim's seams. Then the
// play-in (7 v 8, 9 v 10, the loser of the first against the winner of the second) and four best-of-seven rounds,
// 2-2-1-1-1, the better record at home in games 1, 2, 5 and 7.
import { SHORTS, TEAM, DIV_OF, CONF_OF, DIVS, nick, manOf, teamOfMan, depthOrder, makeFiller, thinSpot } from './league'
import { b2bOf, dateText } from './schedule'
import { addNews, injuryText, signText, roundSetText, champText } from './news'
import { scoutTick } from './draft'
import * as X from './seams'
import { rngOf } from '../rng'

// ── Records ──────────────────────────────────────────────────────────────────
const blank = () => ({ w: 0, l: 0, hw: 0, hl: 0, aw: 0, al: 0, cw: 0, cl: 0, dw: 0, dl: 0, pf: 0, pa: 0, g: 0, l10: [], st: 0 })
export function records(F) {
  const R = Object.fromEntries(SHORTS.map(s => [s, blank()]))
  for (const g of F.sched ?? []) {
    if (g.hs == null) continue
    const hw = g.hs > g.as
    const H = R[g.h], A = R[g.a]
    const conf = CONF_OF[g.h] === CONF_OF[g.a], div = DIV_OF[g.h] === DIV_OF[g.a]
    for (const [T, won, home, f, a] of [[H, hw, true, g.hs, g.as], [A, !hw, false, g.as, g.hs]]) {
      T.g++; T.pf += f; T.pa += a
      if (won) { T.w++; home ? T.hw++ : T.aw++; if (conf) T.cw++; if (div) T.dw++ } else { T.l++; home ? T.hl++ : T.al++; if (conf) T.cl++; if (div) T.dl++ }
      T.l10.push(won ? 1 : 0); if (T.l10.length > 10) T.l10.shift()
      T.st = won ? (T.st > 0 ? T.st + 1 : 1) : (T.st < 0 ? T.st - 1 : -1)
    }
  }
  return R
}
// (a team that hasn't played is .500, so a 1-0 team is ahead of it and an 0-1 team behind it, as games back has them)
export const pct = r => (r.w + r.l ? r.w / (r.w + r.l) : 0.5)
export const recText = r => `${r?.w ?? 0}-${r?.l ?? 0}`
export const streakText = r => (r.st ? `${r.st > 0 ? 'W' : 'L'}${Math.abs(r.st)}` : '')
const h2h = (F, a, b) => {
  let w = 0, l = 0
  for (const g of F.sched) if (g.hs != null && ((g.h === a && g.a === b) || (g.h === b && g.a === a))) { const aw = (g.h === a) === (g.hs > g.as); aw ? w++ : l++ }
  return [w, l]
}
// the conference's order, by record, then the NBA's tiebreakers (the league's standings procedure):
//   two teams tied:   head to head, division winner, division record (same division), conference record, record
//                     against the conference's playoff-eligible teams, against the other conference's, point differential
//   three or more:    division winner, the record in the games among all of them, division record (all in one
//                     division), conference record, the two playoff-eligible records, point differential
// When a step separates some of the teams, each group still tied starts again from the top (two-team or multi-team).
// A division winner is the team alone on top of its division (once the season's over, its tiebreakers decide it).
export function confOrder(F, conf, R = records(F)) {
  const T = tieTable(F, R)
  const teams = SHORTS.filter(s => CONF_OF[s] === conf)
  const done = !F.sched?.some(g => g.hs == null)
  const divWin = new Set()
  for (const [d, ts] of Object.entries(DIVS)) {
    if (CONF_OF[ts[0]] !== conf) continue
    const o = rankTied(T, ts, { divWin: new Set() })
    if (done || pct(R[o[0]]) > pct(R[o[1]])) divWin.add(o[0])
  }
  return rankTied(T, teams, { divWin })
}
// every pair's games, once: h2h[a][b] = [wins, losses]; and each conference's playoff-eligible teams (the top ten
// by record, everyone level with the tenth included)
function tieTable(F, R) {
  const h = Object.fromEntries(SHORTS.map(s => [s, {}]))
  for (const g of F.sched ?? []) {
    if (g.hs == null) continue
    const w = g.hs > g.as ? g.h : g.a, l = w === g.h ? g.a : g.h
    ;(h[w][l] ??= [0, 0])[0]++; (h[l][w] ??= [0, 0])[1]++
  }
  const elig = {}
  for (const c of ['E', 'W']) {
    const ts = SHORTS.filter(s => CONF_OF[s] === c).sort((a, b) => pct(R[b]) - pct(R[a]))
    const line = pct(R[ts[9]])
    elig[c] = new Set(ts.filter(s => pct(R[s]) >= line))
  }
  return { F, R, h, elig }
}
const share = (w, l) => (w + l ? w / (w + l) : 0.5)
function vsSet(T, a, set) { let w = 0, l = 0; for (const b of set) { if (b === a) continue; const x = T.h[a][b]; if (x) { w += x[0]; l += x[1] } } return share(w, l) }
// sort by record, then break each tie
function rankTied(T, teams, ctx) {
  const by = new Map()
  for (const s of teams) { const k = pct(T.R[s]); if (!by.has(k)) by.set(k, []); by.get(k).push(s) }
  return [...by.keys()].sort((a, b) => b - a).flatMap(k => breakTie(T, by.get(k), ctx))
}
function breakTie(T, ts, ctx) {
  if (ts.length < 2) return ts
  const R = T.R, two = ts.length === 2
  const sameDiv = ts.every(s => DIV_OF[s] === DIV_OF[ts[0]])
  const conf = s => share(R[s].cw, R[s].cl)
  const mine = s => T.elig[CONF_OF[s]], other = s => T.elig[CONF_OF[s] === 'E' ? 'W' : 'E']
  const steps = [
    ...(two ? [s => vsSet(T, s, ts)] : []),
    s => (ctx.divWin.has(s) ? 1 : 0),
    ...(two ? [] : [s => vsSet(T, s, ts)]),
    ...(sameDiv ? [s => share(R[s].dw, R[s].dl)] : []),
    conf,
    s => vsSet(T, s, mine(s)),
    s => vsSet(T, s, other(s)),
    s => R[s].pf - R[s].pa,
  ]
  for (const f of steps) {
    const v = new Map(ts.map(s => [s, f(s)]))
    const keys = [...new Set(v.values())].sort((a, b) => b - a)
    if (keys.length < 2) continue
    // separated: each group still level starts the procedure over
    return keys.flatMap(k => breakTie(T, ts.filter(s => v.get(s) === k), ctx))
  }
  // (still level after all of it: the league draws lots; here, the team's short name)
  return ts.slice().sort()
}
const h2hCmp = (F, a, b) => { const [w, l] = h2h(F, a, b); return l - w }
export function divOrder(F, div, R = records(F)) {
  return rankTied(tieTable(F, R), DIVS[div].slice(), { divWin: new Set() })
}
export function gamesBack(R, lead, s) { return ((R[lead].w - R[s].w) + (R[s].l - R[lead].l)) / 2 }
export function leagueOrder(F, R = records(F)) {
  return SHORTS.slice().sort((a, b) => pct(R[b]) - pct(R[a]) || (R[b].pf - R[b].pa) - (R[a].pf - R[a].pa))
}

// ── The GM's schedule ────────────────────────────────────────────────────────
export const myGames = F => F.sched.filter(g => g.h === F.team || g.a === F.team)
export const nextMine = F => F.sched.find(g => g.hs == null && (g.h === F.team || g.a === F.team) && g.d >= F.day) ?? null
export const gameNo = (F, g) => myGames(F).indexOf(g) + 1

// ── The roster floor ─────────────────────────────────────────────────────────
// NBA teams carry 14 standard contracts; one can drop to 13 for up to two weeks, never below. Before each night: a
// team under 13 signs men off the street to non-guaranteed minimum deals (the best who'll take one; a made-up man if
// the street is empty), and one that has been at 13 for two weeks (or is short on opening night) signs back to 14.
// The league's other teams fill to 14 straight away. (F.thin: { team: the day it fell under 14 }, while it is.)
export const FLOOR = 13, FLOOR_FULL = 14, FLOOR_DAYS = 14
const stdOf = T => T.r.filter(p => !p.tw).length
export function rosterFloor(F) {
  const thin = (F.thin ??= {})
  for (const s of SHORTS) {
    const T = F.teams[s]
    let n = stdOf(T)
    if (n >= FLOOR_FULL) { delete thin[s]; continue }
    thin[s] ??= F.day
    const to = s !== F.team || F.day === 0 || F.day - thin[s] >= FLOOR_DAYS ? FLOOR_FULL : FLOOR
    let guard = 0
    while (n < to && guard++ < 15) {
      const p = floorSign(F, s)
      if (!p) break
      n++
      if (s === F.team) addNews(F, { k: 'sign', tag: 'SIGNED', s, text: signText('signs with', p, s, { note: `, non-guaranteed (the ${nick(s)} were under the league's roster minimum)` }) })
    }
    if (n >= FLOOR_FULL) delete thin[s]
  }
  if (!Object.keys(thin).length) delete F.thin
}
function floorSign(F, s) {
  const year = X.capYear(F), deal = x => ({ $: X.minOf(x.ys ?? 0, year), y: 1, r: 0, ng: 1 })
  const p = (F.fa ?? []).filter(x => !(x.inj?.g > 0) && X.rankOf(F, x) > 60 && (x.o ?? 0) < 85).sort((a, b) => X.rankOf(F, a) - X.rankOf(F, b)).find(x => X.canSign(F, s, x, deal(x)).ok)
  if (p && X.signMan(F, s, p, deal(p))?.ok !== false) return p
  const m = makeFiller(F, thinSpot(F.teams[s].r), rngOf(`${F.seed}-floor-${F.year}-${F.day}-${s}-${F.teams[s].r.length}`))
  return X.signMan(F, s, m, deal(m), { check: false })?.ok !== false ? m : null
}
// the Waive button's check (the GM's team): null when he can, else why not
export function cutBlock(F, id) {
  const T = F.teams[F.team], p = T?.r.find(x => x.i === id)
  if (!p || p.tw || F.phase === 'off') return null
  if (stdOf(T) <= FLOOR) return `NBA teams must carry at least ${FLOOR} players. Sign someone before waiving him.`
  return null
}

// ── A night of games ─────────────────────────────────────────────────────────
// play every game on day F.day; the GM's game (if he has one tonight and moments are on, and it's close late)
// stops for a moment: returns { pending } and the night is finished by finishMoment
export function playDay(F, { moments = false, wantMoment = null } = {}) {
  if (F.phase !== 'season') return null
  rosterFloor(F)
  const d = F.day
  const tonight = F.sched.filter(g => g.d === d && g.hs == null)
  // (last night's teams: tonight's back-to-backs, without a pass over the schedule for every game)
  const yday = new Set(); for (const g of F.sched) if (g.d === d - 1) { yday.add(g.h); yday.add(g.a) }
  const news = []
  let mine = null, pending = null
  for (const g of tonight) {
    const own = g.h === F.team || g.a === F.team
    if (own && moments) {
      const P = momentStart(F, g, { wantMoment })
      if (P) { pending = P; continue }
      const res = settle(F, g, g.__res); delete g.__res
      mine = logMine(F, g, res); continue
    }
    const res = playOne(F, g, { yday })
    if (own) mine = logMine(F, g, res)
  }
  if (pending) { F.pend = pending; return { pending } }
  return endDay(F, { mine, news })
}
function seedOf(F, g, po = false) { return `${F.seed}-${F.year}-${po ? 'po' : 'rs'}-${g.d}-${g.h}-${g.a}${po ? `-${g.n}` : ''}` }
function prep(F, g, playoff, yday = null) {
  const b = playoff ? { h: false, a: false } : yday ? { h: yday.has(g.h), a: yday.has(g.a) } : b2bOf(F, g)
  for (const s of [g.h, g.a]) for (const p of F.teams[s].r) delete p.rest
  if (!playoff) for (const s of [g.h, g.a]) for (const i of X.restFor(F, s, g, b[s === g.h ? 'h' : 'a']) ?? []) { const p = F.teams[s].r.find(x => x.i === i); if (p) p.rest = 1 }
  return b
}
export function playOne(F, g, { playoff = false, yday = null } = {}) {
  const b2b = prep(F, g, playoff, yday)
  const res = X.simGame(F, g.h, g.a, { seed: seedOf(F, g, playoff), playoff, b2b })
  return settle(F, g, res, { playoff })
}
function settle(F, g, res, { playoff = false } = {}) {
  g.hs = res.hs; g.as = res.as; if (res.ot) g.ot = res.ot
  X.recordGame(F, g, res, { playoff, ...(g.ser && { series: g.ser }) })
  for (const x of X.rollInjuries(F, g, res) ?? []) {
    const p = manOf(F, x.i)
    // (the wire picks what's news: news.js newsWorthy; the words: injuryText)
    if (p && x.g >= 3) addNews(F, { k: 'inj', tag: 'INJURY', s: x.s, i: x.i, g: x.g, text: injuryText(F, p, x) })
  }
  for (const s of [g.h, g.a]) for (const p of F.teams[s].r) delete p.rest
  return res
}
// (a LIGHT save keeps a stretch's boxes: its recap opens every game's; FULL keeps the last 12)
export const BOX_LIGHT = 36
function logMine(F, g, res, po = null) {
  const home = g.h === F.team
  const us = home ? res.hs : res.as, them = home ? res.as : res.hs
  const row = { d: g.d, opp: home ? g.a : g.h, home, us, them, w: us > them, ot: res.ot || 0, q: res.q, ...(po && { po }) }
  F.box = [...(F.box ?? []), { d: g.d, h: g.h, a: g.a, hs: res.hs, as: res.as, ot: res.ot, q: res.q, box: res.box, ...(po && { po }) }].slice(-(F.pace === 'light' ? BOX_LIGHT : 12))
  row.bx = F.box.length - 1
  F.log = [...(F.log ?? []), row]
  return row
}
function endDay(F, { mine = null, news = [] } = {}) {
  for (const s of SHORTS) X.tickInjuries(F, s)
  const was = F.day
  // (the league's deals that night, before the day turns over: on deadline day the window is still open)
  const dl = X.cpuDeadline(F, was) ?? []
  F.day++
  scoutTick(F, was, F.day)
  for (const x of dl) addNews(F, x)
  // the trade deadline, the All-Star break: the wire says so the night they come
  if (was <= F.ddl && F.day > F.ddl) addNews(F, { k: 'ddl', tag: 'DEADLINE', text: `The trade deadline has passed. Rosters are set for the stretch run` })
  allStarTick(F)
  if (dl.length) X.cpuFill(F, { make: (F2, s, o) => makeFiller(F2, thinSpot(F2.teams[s].r), rngOf(`${F2.seed}-fill-${F2.year}-${F2.day}-${s}`), { tw: !!o?.tw }) })
  if (!F.sched.some(g => g.hs == null)) {
    F.phase = 'post'
    addNews(F, { k: 'end', tag: 'FINAL', text: `The regular season is over` })
    // the luxury tax: every team over the line pays its bill now (cap.js assessTax); the repeaters pay more
    const T = X.assessTax(F) ?? []
    if (T.length) addNews(F, { k: 'tax', tag: 'LUXURY TAX', text: `${T.length} ${T.length === 1 ? 'team pays' : 'teams pay'} the luxury tax: ${T.slice().sort((a, b) => b.bill - a.bill).slice(0, 3).map(x => `the ${nick(x.s)} $${x.bill.toFixed(1)} million${x.repeater ? ' (repeater)' : ''}`).join(', ')}` })
  }
  return { mine, news }
}
// sim nights to a day (not playing it), no moments
export function simTo(F, day) {
  let n = 0
  while (F.phase === 'season' && F.day < day && n < 400) { playDay(F); n++ }
  return n
}
// sim to the night before the GM's next game, then play that night
export function playNext(F, opts = {}) {
  const g = nextMine(F)
  if (!g) { simTo(F, F.days); return null }
  simTo(F, g.d)
  return playDay(F, opts)
}

// ── The moment's seam: the GM's game stops late if it's close ───────────────
// (moments.js reads F.pend and calls finishMoment with what the possession did)
// The sim plays the game; at each whistle in the last 24 seconds of the fourth (or of an overtime) the ball, the
// score and the clock say whether it's a moment, the way the game really is at that point:
//   his team's ball, level or down one to three: the last possession ('off')
//   his team's ball, up one or two: the other team has to foul ('ft', two free throws)
//   their ball, level or his team up one to three: a stop ('def')
// Anything else plays on (their ball with his team behind: his team has to foul; more than a possession apart).
// Under two seconds there's no moment left to play.
export function momentSpot(G, short) {
  if (G.done || G.per < 4 || G.clock > 24.01 || G.clock < 2) return null
  const k = G.h.short === short ? 'h' : 'a'
  const m = G.sc[k] - G.sc[k === 'h' ? 'a' : 'h']
  if (G.poss === k) return m >= -3 && m <= 0 ? 'off' : m >= 1 && m <= 2 && G.clock >= 3 ? 'ft' : null
  return m >= 0 && m <= 3 ? 'def' : null
}
export function momentStart(F, g, { wantMoment = null } = {}) {
  prep(F, g, !!F.po?.live)
  const playoff = !!F.po?.live
  const G = X.startGame(F, g.h, g.a, { seed: seedOf(F, g, playoff), playoff })
  const k = g.h === F.team ? 'h' : 'a'
  // (wantMoment: a check's own filter on the margin, on top of the spot)
  X.playTo(G, 24, S => momentSpot(S, F.team) && (!wantMoment || wantMoment(S.sc[k] - S.sc[k === 'h' ? 'a' : 'h'])))
  if (G.done || !G.stop) { const res = X.finishGame(G); G.res = res; return finishInto(F, g, G, res) }
  const us = g.h === F.team ? G.hs : G.as, them = g.h === F.team ? G.as : G.hs
  return { d: g.d, h: g.h, a: g.a, n: g.n ?? null, po: playoff ? F.po.rd : null, us, them, left: Math.round(G.clock * 10) / 10, per: G.per, ...(G.per > 4 && { ot: G.per - 4 }), spot: momentSpot(G, F.team), G }
}
function finishInto(F, g, G, res) {
  // (not close: the game is simply played out; the caller plays it as a normal game)
  g.__res = res
  return null
}
// out (moments.js momentDone): { side: 'off'|'def'|'ft', hit, by, vs, pts (his team's), them (theirs), kind, tov, t }
// (null: the old way, a moment skipped; the sim plays it out). The play goes on the board, then the seconds after it
// (game.js momentEnd: a landed moment that leaves his team ahead is the game), then the sim plays whatever is left.
// The log row keeps what happened (row.mo) for the final's line.
export function finishMoment(F, out) {
  const P = F.pend
  if (!P) return null
  const g = P.po != null ? F.po.cur.find(x => x.h === P.h && x.a === P.a && x.n === P.n) : F.sched.find(x => x.d === P.d && x.h === P.h && x.a === P.a)
  const G = P.G
  const opp = F.team === P.h ? P.a : P.h
  const k = G.h.short === F.team ? 'h' : 'a'
  let mo = null
  if (out) {
    const at = G.clock, per = G.per
    if (out.side === 'def' || (out.side == null && out.them != null)) X.possession(G, opp, { pts: out.them ?? 0, kind: out.kind ?? 'iso', ...(out.vs != null && { by: out.vs }), ...(out.t != null && { t: out.t }) })
    else X.possession(G, F.team, { pts: out.pts ?? 0, by: out.by, kind: out.side === 'ft' ? 'ft' : out.kind, ...(out.tov && { tov: true }), ...(out.t != null && { t: out.t }) })
    const left = G.done ? 0 : G.per > per ? 0 : G.clock
    const lead = G.sc[k] - G.sc[k === 'h' ? 'a' : 'h']
    const sealed = !!out.hit && lead > 0
    const trip = X.momentEnd(G, F.team, { sealed })
    mo = { side: out.side ?? (out.them != null ? 'def' : 'off'), hit: !!out.hit, by: out.by ?? null, vs: out.vs ?? null, kind: out.kind ?? null, pts: out.pts ?? 0, them: out.them ?? 0, tov: out.tov || false, at: Math.round(at * 10) / 10, left: Math.round(left * 10) / 10, per, lead, sealed, ...(trip && { trip: { us: trip.k === k, by: trip.by, made: trip.made, t: Math.round(trip.t * 10) / 10, shot: trip.shot } }) }
  }
  const res = X.finishGame(G)
  F.pend = null
  const tag = row => { if (mo) row.mo = mo; return row }
  if (P.po != null) { const r = settle(F, g, res, { playoff: true }); const row = tag(logMine(F, g, r, poTag(F))); seriesAdd(F, g, r); return poEnd(F, row) }
  settle(F, g, res)
  const mine = tag(logMine(F, g, res))
  return endDay(F, { mine })
}

// ── The All-Star break ───────────────────────────────────────────────────────
// The league's calendar: the starters (the fans', players' and media's vote: two guards and three frontcourt men a
// conference) about three and a half weeks before the game (late January), the reserves (the coaches' pick) ten days later, the game
// itself the Sunday of the break (East against West). F.asDone: 1 starters out, 2 reserves out, 3 the game played.
// F.as = { E: { st: [5 ids], res: [7 ids] }, W: {...}, g?: { E: pts, W: pts, mvp: id, s: winner 'E'|'W' } }
export const AS_STARTERS = 22, AS_RESERVES = 12   // days before the break begins
export function allStarTick(F) {
  if (!F.asb) return
  const to = F.asb[0] - F.day
  // (a save from before the calendar, its rosters named at the break: no game to play after the fact)
  if (F.asDone === 1 && F.as?.E?.res?.length && to < 0) { F.asDone = 3; return }
  if ((F.asDone ?? 0) < 1 && to <= AS_STARTERS) allStarStarters(F)
  if ((F.asDone ?? 0) < 2 && to <= AS_RESERVES) allStars(F)
  if ((F.asDone ?? 0) < 3 && to <= 0) allStarGame(F)
}
function allStarStarters(F) {
  F.asDone = 1
  const A = X.pickAllStars(F)
  F.as = { E: { st: A.st.E, res: [] }, W: { st: A.st.W, res: [] } }
  const mine = [...A.st.E, ...A.st.W].map(i => manOf(F, i)).filter(p => p && teamOfMan(F, p.i) === F.team)
  const names = c => A.st[c].map(i => manOf(F, i)?.n).filter(Boolean).join(', ')
  addNews(F, { k: 'as', tag: 'ALL-STAR', text: `All-Star starters are in. East: ${names('E')}. West: ${names('W')}${mine.length ? `. ${mine.map(p => p.n).join(' and ')} ${mine.length > 1 ? 'start' : 'starts'} for the ${nick(F.team)}` : ''}` })
}
// the reserves (and, the first time in a save from before the calendar, the whole roster at once)
export function allStars(F) {
  if (F.as?.E?.res?.length) { F.asDone = Math.max(F.asDone ?? 0, 2); return F.as }
  const A = X.pickAllStars(F)
  const st = { E: F.as?.E?.st ?? A.st.E, W: F.as?.W?.st ?? A.st.W }
  const out = {}
  for (const c of ['E', 'W']) out[c] = { st: st[c], res: A[c].filter(i => !st[c].includes(i)).slice(0, 7) }
  for (const i of ['E', 'W'].flatMap(c => [...out[c].st, ...out[c].res])) { const p = manOf(F, i); if (p && !(p.aw ?? []).some(a => a.y === F.year && a.k === 'AS')) (p.aw ??= []).push({ y: F.year, k: 'AS' }) }
  F.as = out
  F.asDone = 2
  const mine = ['E', 'W'].flatMap(c => out[c].res).map(i => manOf(F, i)).filter(p => p && teamOfMan(F, p.i) === F.team)
  const names = c => out[c].res.map(i => manOf(F, i)?.n).filter(Boolean).join(', ')
  addNews(F, { k: 'as', tag: 'ALL-STAR', text: `The coaches have picked the All-Star reserves. East: ${names('E')}. West: ${names('W')}${mine.length ? `. ${mine.map(p => p.n).join(' and ')} ${mine.length > 1 ? 'make it' : 'makes it'} for the ${nick(F.team)}` : ''}` })
  return out
}
// the game: East against West, the way it's played (little defense until the fourth quarter), the MVP off the winners
function allStarGame(F) {
  if ((F.asDone ?? 0) < 2) allStars(F)
  F.asDone = 3
  const R = rngOf(`${F.seed}-asg-${F.year}`)
  const side = c => [...F.as[c].st, ...F.as[c].res].map(i => manOf(F, i)).filter(Boolean)
  const str = c => side(c).reduce((a, p) => a + (p.o ?? 80), 0) / Math.max(1, side(c).length)
  let e = Math.round(172 + R.n() * 12 + (str('E') - str('W')) * 1.2), w = Math.round(172 + R.n() * 12 + (str('W') - str('E')) * 1.2)
  if (e === w) R.u() < 0.5 ? e++ : w++
  const win = e > w ? 'E' : 'W'
  const cand = side(win).map(p => ({ p, v: (p.o ?? 80) + (F.as[win].st.includes(p.i) ? 3 : 0) + R.n() * 4 })).sort((a, b) => b.v - a.v)
  const mvp = cand[0]?.p
  const pts = mvp ? Math.round(24 + R.u() * 14) : 0
  F.as.g = { E: e, W: w, s: win, mvp: mvp?.i ?? null, pts }
  if (mvp) (mvp.aw ??= []).push({ y: F.year, k: 'ASMVP' })
  const t = mvp ? teamOfMan(F, mvp.i) : null
  addNews(F, { k: 'asg', tag: 'ALL-STAR GAME', ...(t === F.team && { s: F.team }), text: `The ${win === 'E' ? 'East' : 'West'} beat the ${win === 'E' ? 'West' : 'East'} ${Math.max(e, w)}-${Math.min(e, w)} in the All-Star Game${mvp ? `. ${mvp.n}${t ? ` (${nick(t)})` : ''} is MVP with ${pts} points` : ''}` })
}

// ── Postseason ───────────────────────────────────────────────────────────────
// F.po: { live, stage: 'pi1'|'pi2'|'r'|'done', seeds: { E: [s1..s10] }, pi: { E: { g78, g910, last } }, rd: 0..3,
//         S: [Series] the current round, all: [[Series] by round], champ, cur: the night's games }
export function startPostseason(F) {
  const R = records(F)
  const seeds = { E: confOrder(F, 'E', R).slice(0, 10), W: confOrder(F, 'W', R).slice(0, 10) }
  F.po = { live: 1, stage: 'pi1', seeds, pi: {}, rd: -1, all: [], champ: null, cur: [], night: 0 }
  F.phase = 'playin'
  F.ps = {}
  for (const c of ['E', 'W']) addNews(F, { k: 'po', tag: 'PLAY-IN', text: `The ${CONF_NAME_SHORT[c]}'s play-in is set: the ${nick(seeds[c][6])} host the ${nick(seeds[c][7])} for the No. 7 seed, and the ${nick(seeds[c][8])} host the ${nick(seeds[c][9])}` })
  piNight(F)
  return F.po
}
const CONF_NAME_SHORT = { E: 'East', W: 'West' }
function piNight(F) {
  const P = F.po
  P.cur = []
  for (const c of ['E', 'W']) {
    const S = P.seeds[c]
    if (P.stage === 'pi1') { P.cur.push({ h: S[6], a: S[7], c, k: '78', n: 0, d: 1000 + P.night }); P.cur.push({ h: S[8], a: S[9], c, k: '910', n: 0, d: 1000 + P.night }) }
    else if (P.stage === 'pi2') { const x = P.pi[c]; P.cur.push({ h: x.l78, a: x.w910, c, k: 'last', n: 0, d: 1000 + P.night }) }
  }
}
export const poTag = F => (F.phase === 'playin' ? 'PLAY-IN' : ROUND_NAME[F.po.rd])
export const ROUND_NAME = ['FIRST ROUND', 'CONFERENCE SEMIFINALS', 'CONFERENCE FINALS', 'NBA FINALS']
// a night of the postseason: every game on it; the GM's can stop for a moment
export function playPoNight(F, { moments = false, wantMoment = null } = {}) {
  const P = F.po
  if (!P || P.stage === 'done') return null
  let mine = null, pending = null
  for (const g of P.cur) {
    if (g.hs != null) continue
    const own = g.h === F.team || g.a === F.team
    if (own && moments) {
      const M = momentStart(F, g, { wantMoment })
      if (M) { pending = M; continue }
      const res = settle(F, g, g.__res, { playoff: true }); delete g.__res
      mine = logMine(F, g, res, poTag(F)); seriesAdd(F, g, res); continue
    }
    const res = playOne(F, g, { playoff: true })
    if (own) mine = logMine(F, g, res, poTag(F))
    seriesAdd(F, g, res)
  }
  if (pending) { F.pend = pending; return { pending } }
  return poEnd(F, mine)
}
function seriesAdd(F, g, res) {
  if (!g.ser) return
  const S = g.ser
  S.g.push({ h: g.h, hs: res.hs, as: res.as, ot: res.ot || 0 })
  const hiWon = (g.h === S.hi) === (res.hs > res.as)
  hiWon ? S.wh++ : S.wl++
  if (S.wh === 4 || S.wl === 4) {
    S.done = S.wh === 4 ? S.hi : S.lo
    // (the wire posts the series' result; the Finals' is the champions' item)
    const rd = F.po?.rd ?? 0, w = S.done, l = w === S.hi ? S.lo : S.hi, lw = Math.min(S.wh, S.wl)
    const where = rd === 2 ? ` in the ${CONF_NAME_LONG[S.c] ?? ''} Conference finals and advance to the NBA Finals` : rd === 1 ? ` in the ${CONF_NAME_LONG[S.c] ?? ''} Conference semifinals` : ' in the first round'
    if (rd < 3) addNews(F, { k: 'po', tag: ROUND_NAME[rd], ...((w === F.team || l === F.team) && { s: F.team }), text: lw === 0 ? `The ${nick(w)} sweep the ${nick(l)}${where}` : `The ${nick(w)} beat the ${nick(l)} 4-${lw}${where}` })
  }
}
const CONF_NAME_LONG = { E: 'Eastern', W: 'Western' }
function poEnd(F, mine) {
  const P = F.po
  P.night++
  for (const s of SHORTS) X.tickInjuries(F, s)
  if (P.stage === 'pi1' || P.stage === 'pi2') {
    for (const g of P.cur) {
      const w = g.hs > g.as ? g.h : g.a, l = w === g.h ? g.a : g.h
      const x = (P.pi[g.c] ??= {})
      if (g.k === '78') { x.w78 = w; x.l78 = l; x.g78 = g }
      if (g.k === '910') { x.w910 = w; x.l910 = l; x.g910 = g }
      if (g.k === 'last') { x.wl = w; x.ll = l; x.gl = g }
    }
    if (P.stage === 'pi1') {
      for (const c of ['E', 'W']) addNews(F, { k: 'po', tag: 'PLAY-IN', text: `The ${nick(P.pi[c].w78)} clinch the No. 7 seed in the ${CONF_NAME_SHORT[c]}; the ${nick(P.pi[c].l910)} are eliminated` })
      P.stage = 'pi2'; piNight(F)
    } else {
      for (const c of ['E', 'W']) {
        const x = P.pi[c], S = P.seeds[c]
        P.final = P.final ?? {}
        P.final[c] = [...S.slice(0, 6), x.w78, x.wl]
        addNews(F, { k: 'po', tag: 'PLAY-IN', text: `The ${nick(x.wl)} take the No. 8 seed in the ${CONF_NAME_SHORT[c]}` })
      }
      startRound(F, 0)
    }
    return { mine, po: true }
  }
  // a round's night done: the next night of every series still going, or the next round
  if (P.S.every(S => S.done)) {
    P.all.push(P.S)
    if (P.rd === 3) {
      const S = P.S[0]
      P.champ = S.done; P.stage = 'done'; F.phase = 'done'
      P.fmvp = X.finalsMvp(F, S)
      for (const C of P.all[2] ?? []) { const m = X.seriesMvp(F, C); const p = m != null && manOf(F, m); if (p) (p.aw ??= []).push({ y: F.year, k: C.c === 'E' ? 'ECF' : 'WCF' }) }
      const fm = manOf(F, P.fmvp)
      if (fm) (fm.aw ??= []).push({ y: F.year, k: 'FMVP' })
      for (const p of F.teams[S.done].r) (p.aw ??= []).push({ y: F.year, k: 'CHAMP' })
      if (S.done === F.team) F.rings = (F.rings ?? 0) + 1
      addNews(F, { k: 'champ', tag: 'NBA FINALS', s: S.done, text: champText(S, fm?.n) })
    } else startRound(F, P.rd + 1)
  } else nextNight(F)
  return { mine, po: true }
}
// home court: 2-2-1-1-1, the higher seed (in the Finals, the better record) at home in 1, 2, 5, 7
const HOME = [1, 1, 0, 0, 1, 0, 1]
function nextNight(F) {
  const P = F.po
  P.cur = P.S.filter(S => !S.done).map(S => { const k = S.g.length; const hiHome = HOME[k] === 1; return { h: hiHome ? S.hi : S.lo, a: hiHome ? S.lo : S.hi, ser: S, n: k + 1, d: 2000 + P.rd * 10 + k } })
}
function startRound(F, rd) {
  const P = F.po, R = records(F)
  P.rd = rd; P.stage = 'r'
  F.phase = 'playoffs'
  const mk = (hi, lo, c) => ({ hi, lo, c, g: [], wh: 0, wl: 0, done: null })
  if (rd === 0) {
    P.S = []
    for (const c of ['E', 'W']) { const S = P.final[c]; P.S.push(mk(S[0], S[7], c), mk(S[3], S[4], c), mk(S[2], S[5], c), mk(S[1], S[6], c)) }
  } else {
    const prev = P.all[rd - 1]
    const seedOf = (s, c) => P.final[c].indexOf(s)
    const by = (a, b, c) => (c === 'F' ? (pct(R[a]) > pct(R[b]) || (pct(R[a]) === pct(R[b]) && h2hCmp(F, a, b) <= 0) ? [a, b] : [b, a]) : seedOf(a, c) < seedOf(b, c) ? [a, b] : [b, a])
    P.S = []
    if (rd < 3) {
      for (const c of ['E', 'W']) {
        const w = prev.filter(S => S.c === c).map(S => S.done)
        for (let k = 0; k < w.length; k += 2) { const [hi, lo] = by(w[k], w[k + 1], c); P.S.push(mk(hi, lo, c)) }
      }
    } else {
      const [hi, lo] = by(prev[0].done, prev[1].done, 'F')
      P.S.push(mk(hi, lo, 'F'))
    }
  }
  for (const S of P.S) S.c === 'F' ? null : null
  addNews(F, { k: 'po', tag: ROUND_NAME[rd], text: roundSetText(rd, P.S, s => P.final[CONF_OF[s]].indexOf(s) + 1) })
  nextNight(F)
}
// the GM's series this round, or null
export const mySeries = F => F.po?.S?.find(S => S.hi === F.team || S.lo === F.team) ?? null
export const myPoGame = F => F.po?.cur?.find(g => g.hs == null && (g.h === F.team || g.a === F.team)) ?? null
export const alive = F => {
  const P = F.po
  if (!P) return false
  if (F.phase === 'playin') return [...P.cur].some(g => g.h === F.team || g.a === F.team) || (P.stage === 'pi2' ? false : P.seeds[CONF_OF[F.team]].slice(0, 6).includes(F.team))
  if (F.phase === 'playoffs') return !!mySeries(F) && !mySeries(F).done || P.S.some(S => S.done === F.team && !P.S.every(x => x.done))
  return P.champ === F.team
}
// sim the rest of the postseason (no moments)
export function simPostseason(F) {
  let n = 0
  while (F.po && F.po.stage !== 'done' && n < 200) { playPoNight(F); n++ }
}
export const seriesText = (S, s) => {
  const me = s ?? S.hi, w = me === S.hi ? S.wh : S.wl, l = me === S.hi ? S.wl : S.wh
  if (S.done) return `${nick(S.done)} win ${Math.max(S.wh, S.wl)}-${Math.min(S.wh, S.wl)}`
  if (w === l) return `Series tied ${w}-${l}`
  return `${nick(w > l ? me : me === S.hi ? S.lo : S.hi)} lead ${Math.max(w, l)}-${Math.min(w, l)}`
}
export { dateText, depthOrder }
