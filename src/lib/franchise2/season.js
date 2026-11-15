// FRANCHISE: the season, a week at a time.
//   playWeek(F, opts)  every game of the week; the player's team's game can stop on its moment (F.pend)
//   finishMoment(F, hit, kind)  the moment's play is in: the game plays out from there and the week ends
//   chooseEvent(F, i)  one of the two answers to the week's event card
// The player's team's games keep a result row (F.log) the hub reads: the score, the quarters, a headline,
// the builds' lines. Hype, chemistry, injuries, events and scout points move with the weeks.
import { TEAM, SHORTS, OFFENSE, lineup, rotation, strength, realOf, POS_LABEL } from './league'
import { newGame, run, resolveKey, boxOf, normalRate, clockText, periodOf, spotText } from './game'
import { DIV_OF } from './schedule'
import { standings, startPlayoffs, endRound, finishOf, ROUNDS, records } from './standings'
import { rngOf, clamp, r1 } from './rng'
import { KEYS, playFootballSeason } from '../teamSeason'
import { fbLine } from '../squadSeason'
import { momentsOf } from '../minigames'

export const REG_WEEKS = 18
const H_CLAMP = v => clamp(0, 100, Math.round(v))

// ── Strength on game day ─────────────────────────────────────────────────────
// the football sim's ratings, and the player's team's own lift: chemistry every game, the crowd at home (hype),
// this week's call from an event, a Motivator in January
function sideOf(F, short, home, po) {
  const s = strength(F, short)
  let mod = 0
  if (short === F.team) {
    mod += (F.chem - 50) * 0.012
    if (home) mod += (F.hype - 50) * 0.01
    mod += F.nx ?? 0
    if (po && F.coach?.style === 'motivator') mod += 0.5
  }
  return { off: s.off, def: s.def, mod }
}
function gameOf(F, g, seed, po) {
  const H = sideOf(F, g.h, !g.n, po), A = sideOf(F, g.a, false, po)
  return { h: g.h, a: g.a, sh: { off: H.off, def: H.def }, sa: { off: A.off, def: A.def }, seed, po: !!po, homeEdge: g.n ? 0 : 0.9, mod: { h: H.mod, a: A.mod } }
}

// ── Ratings for the box score (lib/teamSeason.js reads every man's traits) ──
const valOfOvr = o => clamp(0, 11, (-2.2 + Math.sqrt(Math.max(0, 4.84 + 0.96 * (o - 58)))) / 0.48)
function ratingsOf(F, p) {
  if (p.b != null) {
    const b = F.builds[p.b]?.build ?? {}
    const vals = Object.values(b).map(c => c?.val).filter(v => typeof v === 'number')
    const avg = vals.length ? vals.reduce((a, x) => a + x, 0) / vals.length : 5
    return KEYS[p.p].map(k => (typeof b[k]?.val === 'number' ? b[k].val : avg))
  }
  const real = realOf(p.p, p.n), shift = real ? valOfOvr(p.o) - valOfOvr(real.o) : 0
  const base = valOfOvr(p.o)
  return KEYS[p.p].map(k => r1(clamp(0, 11, real ? (real.attrs[k] ?? base) + shift : base)))
}
// the men in the box score: the 22 starters and the rotation behind them
function snapOf(F) {
  const t = F.teams[F.team], L = lineup(t), rot = rotation(t, L)
  const out = [], dAt = {}
  const add = (p, st) => { const d = dAt[p.p] = (dAt[p.p] ?? -1) + 1; out.push({ k: `p${p.i}`, n: p.n, pos: p.p, o: p.o, a: ratingsOf(F, p), st, d, ...(p.s && (p.p === 'dl' || p.p === 'db') && { sub: p.s }), ...(p.p === 'ol' && { sub: ['LT', 'LG', 'C', 'RG', 'RT'][d] ?? 'OL' }), ...(p.b != null && { s: String(p.b) }) }) }
  Object.values(L).forEach(p => add(p, 1))
  rot.forEach(p => add(p, 0))
  return out
}
const STAT_KEYS = ['pc', 'pa', 'py', 'ptd', 'int', 'ra', 'ry', 'rtd', 'rc', 'ryd', 'rctd', 'tg', 'tk', 'sck', 'tfl', 'dint', 'pbu', 'ff', 'qbh', 'sa', 'prs', 'pnk', 'sn']
function addStats(into, from) { for (const k of STAT_KEYS) if (from?.[k]) into[k] = (into[k] ?? 0) + from[k] }

// ── Moments ──────────────────────────────────────────────────────────────────
// which build plays it: one of the player's builds who starts (a quarterback first on offense)
function momentBuild(F, R, allow) {
  const L = lineup(F.teams[F.team])
  const mine = Object.values(L).filter(p => p.b != null && momentsOf(p.p).some(g => !allow || allow(g)))
  if (!mine.length) return null
  const qb = mine.find(p => p.p === 'qb')
  return qb && R.u() < 0.5 ? qb : R.pick(mine)
}
// a big game: the division, the stretch run, the playoffs, or now and then any week (most seasons: five to eight)
function bigGame(F, g, R, po) {
  if (po) return true
  if ((F.moments ?? 0) >= 8) return false
  if (DIV_OF[g.h] === DIV_OF[g.a]) return R.u() < 0.9
  if (F.wk >= 12) return R.u() < 0.75
  return R.u() < 0.45
}
// The play that fits the moment: what the build does on that down, distance and spot
const OFF_PICK = {
  qb: k => (k.goal ? (k.d <= 1 ? ['sneak', 'goal-line'] : ['goal-line']) : k.down === 4 && k.margin < 0 && k.d >= 5 ? ['two-minute', 'third-long'] : k.d >= 9 ? (k.y < 55 ? ['bomb', 'third-long'] : ['third-long']) : k.d <= 3 ? ['audible', 'hot-read', 'sneak'] : ['hot-read', 'escape', 'third-long']),
  rb: k => (k.goal ? ['goal-line', 'gap'] : k.d <= 3 ? ['gap'] : ['juke', 'gap']),
  wr: k => (k.goal ? ['goal-line', 'catch'] : k.d >= 8 ? ['catch', 'release'] : ['juke-wr', 'catch', 'release']),
  te: k => (k.goal ? ['goal-line', 'catch'] : k.d <= 3 ? ['seal', 'catch'] : ['catch', 'juke-te', 'release']),
  ol: k => (k.d <= 3 || k.goal ? ['seal', 'pass-pro'] : ['pass-pro']),
}
const DEF_PICK = {
  db: k => (k.d >= 5 ? ['jump-route', 'tackle-angle'] : ['tackle-angle', 'jump-route']),
  dl: k => (k.d >= 5 ? ['pass-rush', 'run-stuff'] : ['run-stuff', 'pass-rush', 'tackle-angle']),
  lb: k => (k.d >= 6 ? ['zone-drop', 'pass-rush', 'hit-stick'] : ['run-stuff', 'tackle-angle', 'hit-stick']),
}
export function gameForMoment(pos, key, R, allow) {
  const list = (OFFENSE.includes(pos) ? OFF_PICK[pos] : DEF_PICK[pos])?.(key) ?? []
  const ok = list.filter(g => momentsOf(pos).includes(g) && (!allow || allow(g)))
  return ok.length ? (R.u() < 0.7 ? ok[0] : R.pick(ok)) : null
}
// what a hit means on the play (how the result reads; the scoreboard follows what it was)
const KIND = { 'jump-route': 'pick', 'pass-rush': 'sack', bomb: 'big', 'third-long': 'big' }

// ── A week ───────────────────────────────────────────────────────────────────
// opts: { moments: bool (the mini games aren't on NONE), allow: game id → bool (SIMPLE's games) }
export function playWeek(F, opts = {}) {
  if (F.pend) return { pending: true }
  if (F.ev) return { event: true }
  const po = F.phase === 'playoffs'
  const games = po ? F.po.rounds[F.po.rd] : F.sched.weeks[F.wk]
  const tag = po ? `po${F.po.rd}` : `w${F.wk}`
  let mine = null
  games.forEach((g, i) => {
    if (g.hs != null) return
    const seed = `${F.seed}-${F.year}-${tag}-${i}`
    if (g.h === F.team || g.a === F.team) { mine = { g, i, seed }; return }
    const S = run(newGame(gameOf(F, g, seed, po)))
    Object.assign(g, { hs: S.hs, as: S.as, ...(S.ot && { ot: 1 }) })
  })
  if (!mine) return endWeek(F, null)
  const { g, seed } = mine
  const G = gameOf(F, g, seed, po)
  const R = rngOf(`${seed}-moment`)
  if (opts.moments && bigGame(F, g, R, po)) {
    const p = momentBuild(F, R, opts.allow)
    if (p) {
      const us = g.h === F.team ? 'h' : 'a'
      G.key = { us, side: OFFENSE.includes(p.p) ? 'off' : 'def', h: normalRate(p.o), window: 180 + Math.floor(R.u() * 360), pid: p.i }
    }
  }
  const S = run(newGame(G))
  if (S.key) {
    const p = F.teams[F.team].r.find(x => x.i === G.key.pid)
    const game = gameForMoment(p.p, S.key, R, opts.allow)
    if (game) {
      F.pend = { S, pid: p.i, b: p.b, game, po: !!po }
      return { pending: true }
    }
    // (no play of his fits the spot: the game goes on without a moment)
    resolveKey(S, R.u() < S.key.chance, null, 'auto')
  }
  return finishUserGame(F, mine, S, null)
}
// the moment as the screen shows it: the game's own state
export function momentView(F) {
  const P = F.pend
  if (!P) return null
  const k = P.S.key, opp = P.S.G[k.us === 'h' ? 'a' : 'h']
  return {
    game: P.game, pid: P.pid, b: P.b, po: P.po, opp, us: F.team, home: k.us === 'h',
    mine: k.mine, theirs: k.opp, clock: clockText(k.t), period: periodOf(k.t), down: k.down, d: k.d, y: k.y, goal: k.goal,
    ball: k.ball, spot: k.goal ? 'goal' : spotText(k.y), seed: `${P.S.G.seed}-mg`,
    // the spot the broadcast way: "DEN 35" on the offense's own side, "ARI 47" across midfield
    spotTxt: (() => { const off = k.ball === 'us' ? F.team : opp, def = k.ball === 'us' ? opp : F.team; return k.y === 50 ? '50' : k.y < 50 ? `${off} ${k.y}` : `${def} ${100 - k.y}` })(),
  }
}
export function finishMoment(F, hit) {
  const P = F.pend
  const S = P.S
  resolveKey(S, hit, hit ? KIND[P.game] ?? null : null, 'play')
  const games = P.po ? F.po.rounds[F.po.rd] : F.sched.weeks[F.wk]
  const i = games.findIndex(g => g.h === F.team || g.a === F.team)
  F.pend = null
  F.moments = (F.moments ?? 0) + 1
  return finishUserGame(F, { g: games[i], i }, S, { pid: P.pid, b: P.b, game: P.game, hit: !!hit })
}

// ── The player's game is over ────────────────────────────────────────────────
function finishUserGame(F, { g }, S, mo) {
  Object.assign(g, { hs: S.hs, as: S.as, ...(S.ot && { ot: 1 }) })
  const home = g.h === F.team, opp = home ? g.a : g.h
  const us = home ? S.hs : S.as, them = home ? S.as : S.hs
  const won = us > them, tie = us === them
  const po = F.phase === 'playoffs'
  // the box score from the final (the moment's play is in the final, and its points go to the man who made it)
  const roster = snapOf(F)
  const played = playFootballSeason({ roster, games: [{ wk: F.wk + 1, opponent: TEAM[opp].name, home, won, mySc: us, oppSc: them }], seed: `${F.seed}-${F.year}-box-${po ? `p${F.po.rd}` : F.wk}` })
  const box = played.reg[0]?.s ?? {}
  if (mo?.hit) creditMoment(box, mo, S, roster)
  const ss = F.ss ?? (F.ss = {})
  for (const p of roster) { const id = p.k.slice(1); ss[id] ??= { gp: 0 }; ss[id].gp++; addStats(ss[id], box[p.k]) }
  // the builds' lines (one line each)
  const lines = roster.filter(p => p.s != null).map(p => ({ b: +p.s, pid: +p.k.slice(1), line: fbLine(p.pos, box[p.k] ?? {}).slice(0, 3).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(' · ') }))
  const bx = boxOf(S)
  const row = { wk: po ? null : F.wk + 1, rd: po ? F.po.rd : null, opp, home, us, them, w: won ? 1 : 0, t: tie ? 1 : 0, ot: S.ot ? 1 : 0, q: home ? [bx.q.h, bx.q.a] : [bx.q.a, bx.q.h], pl: bx.pl.map(([t, s, p, k]) => [t, (s === 0) === home ? 1 : 0, p, k]), lines, ...(mo && { mo: { b: mo.b, game: mo.game, hit: mo.hit, line: S.keyOut?.line } }) }
  row.hl = headline(F, row, S)
  F.log.push(row)
  // hype and the streak
  F.streak = won ? Math.max(0, F.streak) + 1 : tie ? 0 : Math.min(0, F.streak) - 1
  const div = DIV_OF[opp] === DIV_OF[F.team]
  if (po) F.hype = H_CLAMP(F.hype + (won ? 4 : -2))
  else F.hype = H_CLAMP(F.hype + (won ? 2 + (div ? 1 : 0) + (F.streak >= 4 ? 1 : 0) : tie ? 0 : -2 - (F.streak <= -3 ? 2 : 0)))
  F.chem = clamp(0, 100, F.chem + (won ? 0.3 : -0.3))
  F.nx = 0
  return endWeek(F, row)
}
// the moment's play goes to the man who made it in the box score (a touchdown, a pick, a sack)
function creditMoment(box, mo, S, roster) {
  const k = `p${mo.pid}`, x = box[k] ?? (box[k] = {})
  const line = S.keyOut?.line, me = roster.find(p => p.k === k)
  if (!me) return
  if (line === 'td') {
    const key = me.pos === 'qb' ? 'ptd' : me.pos === 'rb' && mo.game !== 'goal-line' ? 'rtd' : me.pos === 'wr' || me.pos === 'te' || me.pos === 'rb' ? 'rctd' : null
    if (key && !x[key]) x[key] = 1
  }
  if (line === 'pick' && !x.dint) x.dint = 1
  if (mo.game === 'pass-rush' && mo.hit && !x.sck) x.sck = 1
}

// ── The end of a week ────────────────────────────────────────────────────────
function endWeek(F, row) {
  const R = rngOf(`${F.seed}-${F.year}-wk-${F.phase}-${F.phase === 'playoffs' ? F.po.rd : F.wk}`)
  const out = { row, news: [] }
  // injuries: short ones, a starter now and then (the backup plays)
  for (const s of SHORTS) {
    const t = F.teams[s]
    for (const p of t.r) if (p.in) { p.in--; if (!p.in) delete p.in }
    const L = Object.values(lineup(t))
    for (const p of L) if (R.u() < 0.011) {
      p.in = R.u() < 0.8 ? R.int(1, 2) : R.int(3, 5)
      if (s === F.team) out.news.push({ k: 'inj', pid: p.i, n: p.n, wk: p.in })
    }
  }
  F.chem = clamp(0, 100, r1(F.chem + (F.coach?.style === 'players' ? 0.55 : 0.3)))
  if (F.phase === 'playoffs') {
    endRound(F)
    if (F.po.champ) { F.phase = 'done'; out.champ = F.po.champ }
    return out
  }
  F.wk++
  // scout points: a few a month
  if (F.wk % 4 === 0) F.sp += F.coach?.style === 'recruiter' ? 3 : 2
  // an event card about every three or four weeks
  if (F.wk < REG_WEEKS && F.wk >= (F.nextEv ?? 3)) { F.ev = makeEvent(F, R); F.nextEv = F.wk + R.int(3, 4); if (F.ev) out.event = true }
  if (F.wk >= REG_WEEKS) { F.phase = 'post'; out.over = true }
  return out
}
// the regular season is over: the bracket
export function intoPlayoffs(F) {
  startPlayoffs(F)
  const inIt = F.po.seeds.AFC.includes(F.team) || F.po.seeds.NFC.includes(F.team)
  F.phase = 'playoffs'
  return inIt
}
export const userAlive = F => F.phase === 'playoffs' && (F.po.alive.AFC.includes(F.team) || F.po.alive.NFC.includes(F.team))
export const userBye = F => F.phase === 'playoffs' && F.po.rd === 0 && [F.po.seeds.AFC[0], F.po.seeds.NFC[0]].includes(F.team)
// the rest of the playoffs without the player's team (it's out): straight to the champion
export function simPlayoffs(F) { while (F.phase === 'playoffs') playWeek(F, { moments: false }) }
// SIM TO END (of the regular season): every week, no moments, no event cards (the front office lets them pass)
export function simWeeks(F, opts = {}) {
  const out = []
  if (F.ev) F.ev = null
  while (F.phase === 'season' && !F.pend) {
    const r = playWeek(F, { ...opts, moments: false })
    F.ev = null
    out.push(r)
    if (opts.until && F.wk >= opts.until) break
  }
  return out
}

// ── Headlines ────────────────────────────────────────────────────────────────
function headline(F, row, S) {
  const opp = TEAM[row.opp].nick.toUpperCase(), me = TEAM[F.team].nick.toUpperCase()
  const m = row.us - row.them
  // the biggest hole they climbed out of, and when the winning points came
  let worst = 0, a = 0, b = 0
  for (const [, mine, p] of row.pl) { if (mine) a += p; else b += p; worst = Math.min(worst, a - b) }
  const last = [...row.pl].reverse().find(x => x[2] > 0)
  const late = last && last[0] >= 3540 && last[1] === (m > 0 ? 1 : 0)
  if (row.mo?.hit && m > 0) return row.mo.line === 'pick' ? 'PICKED OFF TO SEAL IT' : row.mo.line === 'td' || row.mo.line === 'conv-td' ? 'THE DRIVE OF THE YEAR' : 'CLUTCH WHEN IT MATTERED'
  if (row.t) return `TIED WITH THE ${opp}`
  if (m > 0) {
    if (row.ot) return 'WON IT IN OVERTIME'
    if (late) return 'WON IT AT THE GUN'
    if (worst <= -10) return `CAME BACK FROM ${-worst} DOWN`
    if (row.them === 0) return 'A SHUTOUT'
    if (m >= 21) return `ROLLED THE ${opp}`
    if (row.rd === 3) return 'WORLD CHAMPIONS'
    return m <= 3 ? `HELD OFF THE ${opp}` : `BEAT THE ${opp}`
  }
  if (row.ot) return 'LOST IT IN OVERTIME'
  if (late) return 'BEATEN AT THE GUN'
  if (row.us === 0) return `SHUT OUT BY THE ${opp}`
  if (-m >= 21) return `${opp} ROLL THE ${me}`
  return -m <= 3 ? `JUST SHORT AGAINST THE ${opp}` : `FELL TO THE ${opp}`
}

// ── Events: a headline and two answers ───────────────────────────────────────
// Each answer moves hype, chemistry, a player's rating or next week's game (F.nx, on the sim's scale)
const bestAt = (t, pos, test = () => true) => t.r.filter(p => pos.includes(p.p) && !p.in && test(p)).sort((a, b) => b.o - a.o)[0]
const EVENTS = [
  { id: 'ball', make: (F, t) => { const p = bestAt(t, ['wr', 'te', 'rb'], x => x.b == null); return p && { title: `${last(p)} WANTS THE BALL`, pid: p.i, a: ['FEED HIM', { nx: 0.4, chem: -4 }], b: ['STICK TO THE PLAN', { chem: 3, hype: -2 }] } } },
  { id: 'spat', make: () => ({ title: 'LOCKER ROOM SPAT', a: ['TEAM MEETING', { chem: 5, hype: -1 }], b: ['LET THEM SORT IT OUT', { chem: -3, nx: 0.2 }] }) },
  { id: 'hurt', make: (F, t) => { const p = bestAt(t, ['qb', 'rb', 'wr', 'te', 'dl', 'lb', 'db']); return p && { title: `${last(p)} IS BANGED UP`, pid: p.i, a: ['PLAY THROUGH IT', { risk: p.i }], b: ['SIT HIM A WEEK', { sit: p.i, chem: 1 }] } } },
  { id: 'film', make: () => ({ title: 'FILM ROOM OR A DAY OFF', a: ['EXTRA FILM', { nx: 0.5, chem: -2 }], b: ['DAY OFF', { chem: 4 }] }) },
  { id: 'young', make: (F, t) => { const p = bestAt(t, ['qb', 'rb', 'wr', 'te', 'ol', 'dl', 'lb', 'db'], x => x.ag <= 24 && x.b == null); return p && { title: `${last(p)} IS READY FOR MORE`, pid: p.i, a: ['MORE SNAPS', { grow: p.i, nx: -0.2 }], b: ['BRING HIM ALONG', { chem: 2 }] } } },
  { id: 'deal', make: (F, t) => { const p = bestAt(t, ['qb', 'wr', 'dl', 'db'], x => x.b == null && x.y <= 1 && x.o >= 80); return p && { title: `${last(p)} WANTS A NEW DEAL`, pid: p.i, a: ['PAY HIM', { pay: p.i, chem: 3 }], b: ['AFTER THE SEASON', { chem: -3, hype: -1 }] } } },
  { id: 'trash', make: (F) => { const o = nextOpp(F); return o && { title: `THE ${TEAM[o].nick.toUpperCase()} ARE TALKING`, opp: o, a: ['FIRE BACK', { hype: 4, nx: 0.2 }], b: ['NO COMMENT', { chem: 2 }] } } },
  { id: 'crowd', make: () => ({ title: 'PRIMETIME NEXT WEEK', a: ['OPEN PRACTICE', { hype: 5 }], b: ['CLOSED DOORS', { nx: 0.3 }] }) },
  { id: 'trade', make: (F, t, R) => tradeEvent(F, t, R) },
]
const last = p => { const w = p.n.split(' '); const k = w.length > 2 && /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(w[w.length - 1]) ? w.length - 2 : w.length - 1; return w[k].toUpperCase() }
function nextOpp(F) {
  const g = F.sched.weeks[F.wk]?.find(x => x.h === F.team || x.a === F.team)
  return g ? (g.h === F.team ? g.a : g.h) : null
}
// A trade call: a starter of theirs, a little better and older, for one of yours at his spot
function tradeEvent(F, t, R) {
  const L = Object.values(lineup(t)).filter(p => p.b == null && p.ag <= 29 && p.p !== 'qb')
  if (!L.length) return null
  const mine = R.pick(L)
  const others = SHORTS.filter(s => s !== F.team)
  for (let k = 0; k < 8; k++) {
    const s = R.pick(others)
    const theirs = F.teams[s].r.filter(p => p.p === mine.p && p.o >= mine.o + 3 && p.o <= mine.o + 8 && p.ag >= mine.ag + 2 && p.b == null)[0]
    if (theirs) return { title: `THE ${TEAM[s].nick.toUpperCase()} CALL ABOUT ${last(mine)}`, team: s, give: mine.i, get: theirs.i, a: ['MAKE THE DEAL', { trade: 1, chem: -4 }], b: ['HANG UP', { chem: 2 }] }
  }
  return null
}
function makeEvent(F, R) {
  const t = F.teams[F.team]
  const seen = F.evSeen ?? []
  const order = R.shuffle(EVENTS.filter(e => !seen.includes(e.id)))
  for (const e of order) {
    const x = e.make(F, t, R)
    if (x) { F.evSeen = [...seen, e.id].slice(-5); return { id: e.id, ...x } }
  }
  return null
}
// the player's answer: 0 the first button, 1 the second. Returns what it did (for the result line)
export function chooseEvent(F, i) {
  const ev = F.ev
  if (!ev) return null
  const fx = (i === 0 ? ev.a : ev.b)[1]
  const t = F.teams[F.team], R = rngOf(`${F.seed}-${F.year}-ev-${F.wk}`)
  const out = { hype: 0, chem: 0, nx: 0 }
  if (fx.hype) { F.hype = H_CLAMP(F.hype + fx.hype); out.hype = fx.hype }
  if (fx.chem) { F.chem = H_CLAMP(F.chem + fx.chem); out.chem = fx.chem }
  if (fx.nx) { F.nx = (F.nx ?? 0) + fx.nx; out.nx = fx.nx }
  const P = id => t.r.find(p => p.i === id)
  if (fx.risk) { const p = P(fx.risk); if (p && R.u() < 0.35) { p.in = 3; out.hurt = p.n } }
  if (fx.sit) { const p = P(fx.sit); if (p) p.in = 1 }
  if (fx.grow) { const p = P(fx.grow); if (p) { p.pk = Math.min(99, p.pk + 2); p.o = Math.min(99, p.o + 1); out.grow = 1 } }
  if (fx.pay) { const p = P(fx.pay); if (p) { p.$ = r1(p.$ * 1.2); p.y += 2 } }
  if (fx.trade) {
    const mine = P(ev.give), ot = F.teams[ev.team], theirs = ot?.r.find(p => p.i === ev.get)
    if (mine && theirs) {
      t.r = t.r.filter(p => p !== mine); ot.r = ot.r.filter(p => p !== theirs)
      t.r.push(theirs); ot.r.push(mine)
      out.traded = theirs.n
    }
  }
  F.ev = null
  return out
}

// ── Reading the season ───────────────────────────────────────────────────────
export function record(F, short = F.team) {
  const R = records(F)[short]
  return { w: R.w, l: R.l, t: R.t, pf: R.pf, pa: R.pa }
}
// the player's schedule: 18 weeks, each a game (with its result once played) or the bye
export function mySchedule(F) {
  return F.sched.weeks.map((games, w) => {
    const g = games.find(x => x.h === F.team || x.a === F.team)
    if (!g) return { wk: w + 1, bye: true }
    const home = g.h === F.team
    return { wk: w + 1, opp: home ? g.a : g.h, home, ...(g.hs != null && { us: home ? g.hs : g.as, them: home ? g.as : g.hs }) }
  })
}
export { standings, finishOf, ROUNDS }
