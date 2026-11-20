// NBA FRANCHISE: the season. A day at a time: every game on the night is played (the sim is C's: seams.js), the
// GM's own game can stop for a clutch moment (moments.js), injuries and rest go through the sim's seams. Then the
// play-in (7 v 8, 9 v 10, the loser of the first against the winner of the second) and four best-of-seven rounds,
// 2-2-1-1-1, the better record at home in games 1, 2, 5 and 7.
import { SHORTS, TEAM, DIV_OF, CONF_OF, DIVS, nick, manOf, teamOfMan, depthOrder } from './league'
import { b2bOf, dateText } from './schedule'
import { addNews } from './news'
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
export const pct = r => (r.w + r.l ? r.w / (r.w + r.l) : 0)
export const recText = r => `${r?.w ?? 0}-${r?.l ?? 0}`
export const streakText = r => (r.st ? `${r.st > 0 ? 'W' : 'L'}${Math.abs(r.st)}` : '')
const h2h = (F, a, b) => {
  let w = 0, l = 0
  for (const g of F.sched) if (g.hs != null && ((g.h === a && g.a === b) || (g.h === b && g.a === a))) { const aw = (g.h === a) === (g.hs > g.as); aw ? w++ : l++ }
  return [w, l]
}
// the conference's order, the NBA's tiebreakers kept to what decides most ties: the record, head to head, a
// division winner over a team that didn't win its division, the division record (same division), the conference
// record, then point differential
export function confOrder(F, conf, R = records(F)) {
  const teams = SHORTS.filter(s => CONF_OF[s] === conf)
  const divWin = new Set(Object.entries(DIVS).filter(([d]) => CONF_OF[DIVS[d][0]] === conf).map(([, ts]) => ts.slice().sort((a, b) => pct(R[b]) - pct(R[a]) || h2hCmp(F, a, b))[0]))
  return teams.sort((a, b) => cmp(F, R, divWin, a, b))
}
const h2hCmp = (F, a, b) => { const [w, l] = h2h(F, a, b); return l - w }
function cmp(F, R, divWin, a, b) {
  const A = R[a], B = R[b]
  if (pct(A) !== pct(B)) return pct(B) - pct(A)
  const [w, l] = h2h(F, a, b)
  if (w !== l) return l - w
  if (divWin.has(a) !== divWin.has(b)) return divWin.has(a) ? -1 : 1
  if (DIV_OF[a] === DIV_OF[b]) { const d = (B.dw / Math.max(1, B.dw + B.dl)) - (A.dw / Math.max(1, A.dw + A.dl)); if (d) return d }
  const c = (B.cw / Math.max(1, B.cw + B.cl)) - (A.cw / Math.max(1, A.cw + A.cl))
  if (c) return c
  return (B.pf - B.pa) - (A.pf - A.pa) || (a < b ? -1 : 1)
}
export function divOrder(F, div, R = records(F)) {
  return DIVS[div].slice().sort((a, b) => pct(R[b]) - pct(R[a]) || h2hCmp(F, a, b) || (R[b].pf - R[b].pa) - (R[a].pf - R[a].pa))
}
export function gamesBack(R, lead, s) { return ((R[lead].w - R[s].w) + (R[s].l - R[lead].l)) / 2 }
export function leagueOrder(F, R = records(F)) {
  return SHORTS.slice().sort((a, b) => pct(R[b]) - pct(R[a]) || (R[b].pf - R[b].pa) - (R[a].pf - R[a].pa))
}

// ── The GM's schedule ────────────────────────────────────────────────────────
export const myGames = F => F.sched.filter(g => g.h === F.team || g.a === F.team)
export const nextMine = F => F.sched.find(g => g.hs == null && (g.h === F.team || g.a === F.team) && g.d >= F.day) ?? null
export const gameNo = (F, g) => myGames(F).indexOf(g) + 1

// ── A night of games ─────────────────────────────────────────────────────────
// play every game on day F.day; the GM's game (if he has one tonight and moments are on, and it's close late)
// stops for a moment: returns { pending } and the night is finished by finishMoment
export function playDay(F, { moments = false, wantMoment = null } = {}) {
  if (F.phase !== 'season') return null
  const d = F.day
  const tonight = F.sched.filter(g => g.d === d && g.hs == null)
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
    const res = playOne(F, g)
    if (own) mine = logMine(F, g, res)
  }
  if (pending) { F.pend = pending; return { pending } }
  return endDay(F, { mine, news })
}
function seedOf(F, g, po = false) { return `${F.seed}-${F.year}-${po ? 'po' : 'rs'}-${g.d}-${g.h}-${g.a}${po ? `-${g.n}` : ''}` }
function prep(F, g, playoff) {
  const b = playoff ? { h: false, a: false } : b2bOf(F, g)
  for (const s of [g.h, g.a]) for (const p of F.teams[s].r) delete p.rest
  if (!playoff) for (const s of [g.h, g.a]) for (const i of X.restFor(F, s, g, b[s === g.h ? 'h' : 'a']) ?? []) { const p = F.teams[s].r.find(x => x.i === i); if (p) p.rest = 1 }
  return b
}
export function playOne(F, g, { playoff = false } = {}) {
  const b2b = prep(F, g, playoff)
  const res = X.simGame(F, g.h, g.a, { seed: seedOf(F, g, playoff), playoff, b2b })
  return settle(F, g, res, { playoff })
}
function settle(F, g, res, { playoff = false } = {}) {
  g.hs = res.hs; g.as = res.as; if (res.ot) g.ot = res.ot
  X.recordGame(F, g, res, { playoff })
  for (const x of X.rollInjuries(F, g, res) ?? []) {
    const p = manOf(F, x.i)
    if (p && x.g >= 3) addNews(F, { k: 'inj', tag: 'INJURY', s: x.s, text: `${p.n} (${x.k}) is expected to miss ${x.g >= 14 ? `${Math.round(x.g / 3.5)} weeks` : `${x.g} games`}` })
  }
  for (const s of [g.h, g.a]) for (const p of F.teams[s].r) delete p.rest
  return res
}
function logMine(F, g, res, po = null) {
  const home = g.h === F.team
  const us = home ? res.hs : res.as, them = home ? res.as : res.hs
  const row = { d: g.d, opp: home ? g.a : g.h, home, us, them, w: us > them, ot: res.ot || 0, q: res.q, ...(po && { po }) }
  F.box = [...(F.box ?? []), { d: g.d, h: g.h, a: g.a, hs: res.hs, as: res.as, ot: res.ot, q: res.q, box: res.box, ...(po && { po }) }].slice(-12)
  row.bx = F.box.length - 1
  F.log = [...(F.log ?? []), row]
  return row
}
function endDay(F, { mine = null, news = [] } = {}) {
  for (const s of SHORTS) X.tickInjuries(F, s)
  const was = F.day
  F.day++
  scoutTick(F, was, F.day)
  // the trade deadline, the All-Star break: the wire says so the night they come
  if (was <= F.ddl && F.day > F.ddl) addNews(F, { k: 'ddl', tag: 'DEADLINE', text: `The trade deadline has passed. Rosters are set for the stretch run` })
  if (F.day >= F.asb[0] && !F.asDone) allStars(F)
  for (const x of X.cpuDeadline(F, was) ?? []) addNews(F, x)
  if (!F.sched.some(g => g.hs == null)) { F.phase = 'post'; addNews(F, { k: 'end', tag: 'FINAL', text: `The regular season is over` }) }
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
export function momentStart(F, g, { wantMoment = null } = {}) {
  prep(F, g, !!F.po?.live)
  const playoff = !!F.po?.live
  const G = X.startGame(F, g.h, g.a, { seed: seedOf(F, g, playoff), playoff })
  X.playTo(G, 24)
  const us = g.h === F.team ? G.hs : G.as, them = g.h === F.team ? G.as : G.hs
  const m = us - them
  const want = wantMoment ?? (x => x >= -3 && x <= 2)
  if (!want(m)) { const res = X.finishGame(G); G.res = res; return finishInto(F, g, G, res) }
  return { d: g.d, h: g.h, a: g.a, n: g.n ?? null, po: playoff ? F.po.rd : null, us, them, left: 24, G }
}
function finishInto(F, g, G, res) {
  // (not close: the game is simply played out; the caller plays it as a normal game)
  g.__res = res
  return null
}
export function finishMoment(F, out) {
  const P = F.pend
  if (!P) return null
  const g = P.po != null ? F.po.cur.find(x => x.h === P.h && x.a === P.a && x.n === P.n) : F.sched.find(x => x.d === P.d && x.h === P.h && x.a === P.a)
  const G = P.G
  if (out?.pts != null) X.possession(G, F.team, out)
  if (out?.them != null) X.possession(G, F.team === P.h ? P.a : P.h, { pts: out.them })
  const res = X.finishGame(G)
  F.pend = null
  if (P.po != null) { const r = settle(F, g, res, { playoff: true }); const row = logMine(F, g, r, poTag(F)); seriesAdd(F, g, r); return poEnd(F, row) }
  settle(F, g, res)
  const mine = logMine(F, g, res)
  return endDay(F, { mine })
}

// ── The All-Star break ───────────────────────────────────────────────────────
// 12 a conference, the starters by the fans' and players' vote (the best two guards and three frontcourt men by
// their season so far), the reserves by the coaches
export function allStars(F) {
  F.asDone = 1
  const val = x => (x.pts + 1.1 * x.reb + 1.4 * x.ast + 2 * (x.stl + x.blk)) / Math.max(1, x.gp) * Math.min(1, x.gp / 35)
  const R = records(F)
  const out = {}
  for (const c of ['E', 'W']) {
    const men = Object.entries(F.ss ?? {}).map(([i, x]) => ({ i: +i, x, s: teamOfMan(F, +i) })).filter(m => m.s && CONF_OF[m.s] === c)
    men.forEach(m => { m.v = val(m.x) + pct(R[m.s]) * 4; m.p = manOf(F, m.i) })
    men.sort((a, b) => b.v - a.v)
    const st = [...men.filter(m => m.p.g === 'guard').slice(0, 2), ...men.filter(m => m.p.g === 'big' || m.p.p === 'SF').filter(m => !men.filter(z => z.p.g === 'guard').slice(0, 2).includes(m)).slice(0, 3)]
    const rest = men.filter(m => !st.includes(m)).slice(0, 7)
    out[c] = { st: st.map(m => m.i), res: rest.map(m => m.i) }
    for (const m of [...st, ...rest]) (m.p.aw ??= []).push({ y: F.year, k: 'AS' })
  }
  F.as = out
  const mine = [...out.E.st, ...out.E.res, ...out.W.st, ...out.W.res].map(i => manOf(F, i)).filter(p => teamOfMan(F, p.i) === F.team)
  addNews(F, { k: 'as', tag: 'ALL-STAR', text: `All-Star rosters are out${mine.length ? `: ${mine.map(p => p.n).join(' and ')} ${mine.length > 1 ? 'make it' : 'makes it'} for the ${nick(F.team)}` : ''}` })
  return out
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
  for (const c of ['E', 'W']) addNews(F, { k: 'po', tag: 'PLAY-IN', text: `${CONF_NAME_SHORT[c]}: ${nick(seeds[c][6])} host ${nick(seeds[c][7])}, ${nick(seeds[c][8])} host ${nick(seeds[c][9])}` })
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
  if (S.wh === 4 || S.wl === 4) S.done = S.wh === 4 ? S.hi : S.lo
}
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
      for (const c of ['E', 'W']) addNews(F, { k: 'po', tag: 'PLAY-IN', text: `${nick(P.pi[c].w78)} clinch the No. 7 seed in the ${CONF_NAME_SHORT[c]}; ${nick(P.pi[c].l910)} are eliminated` })
      P.stage = 'pi2'; piNight(F)
    } else {
      for (const c of ['E', 'W']) {
        const x = P.pi[c], S = P.seeds[c]
        P.final = P.final ?? {}
        P.final[c] = [...S.slice(0, 6), x.w78, x.wl]
        addNews(F, { k: 'po', tag: 'PLAY-IN', text: `${nick(x.wl)} take the No. 8 seed in the ${CONF_NAME_SHORT[c]}` })
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
      const fm = manOf(F, P.fmvp)
      if (fm) (fm.aw ??= []).push({ y: F.year, k: 'FMVP' })
      for (const p of F.teams[S.done].r) (p.aw ??= []).push({ y: F.year, k: 'CHAMP' })
      if (S.done === F.team) F.rings = (F.rings ?? 0) + 1
      addNews(F, { k: 'champ', tag: 'NBA FINALS', s: S.done, text: `The ${TEAM[S.done].name} win the NBA championship, beating the ${nick(S.done === S.hi ? S.lo : S.hi)} in ${S.g.length}${fm ? `. ${fm.n} is Finals MVP` : ''}` })
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
  addNews(F, { k: 'po', tag: ROUND_NAME[rd], text: P.S.map(S => `${nick(S.hi)}-${nick(S.lo)}`).join(', ') })
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
