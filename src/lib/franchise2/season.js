// FRANCHISE: the season, a week at a time.
//   playWeek(F, opts)  every game of the week; the player's team's game can stop on its moment (F.pend)
//   finishMoment(F, out)  a moment's snap is in: the game plays on to its next moment, or to the final and the week's end
//   chooseEvent(F, i)  one of the two answers to the week's event card
// The player's team's games keep a result row (F.log) the hub reads: the score, the quarters, the scoring summary
// with real names (plays.js), a headline written the way a beat writer files it, the builds' lines.
// Chemistry, injuries, events and scout points move with the weeks. (Hype is gone, owner 2026-11-14: nothing on
// the season side reads or moves it.)
import { TEAM, SHORTS, strength, makeGen, fillLeague, freshName } from './league'
import { newGame, run, resolveSnap, simSnap, boxOf, clockText, periodOf } from './game'
import { nameSnap } from './moments'
import { DIV_OF } from './schedule'
import { standings, startPlayoffs, endRound, finishOf, ROUNDS, records } from './standings'
import { rngOf, clamp, r1 } from './rng'
import { fbLine } from '../squadSeason'
import { playBox, addMoments, finishBox, recordBox, oppOf } from './box'
import { startersOf, depthChart, moveInChart, groupOf, GROUPS } from './roster'
import { coachLate, coachDay, chemWeek } from './coach'
import { askOf, signDeal, canSign, cutMan, minimumFor } from './contracts'
import { kickTraits, kickerOf, addKickStats, kickLine } from './kick'
import { scoringSummary, whenOf } from './plays'
import { injuryOf, addNews } from './news'
import { rollInjuries } from './injury'
import { syncScouts } from './draft'

export const REG_WEEKS = 18
export const TRADE_DEADLINE = 9   // (the NFL's: after Week 9; no event offers a deal past it)
const H_CLAMP = v => clamp(0, 100, Math.round(v))

// ── Strength on game day ─────────────────────────────────────────────────────
// the football sim's ratings, and the player's team's own lift: chemistry every game, the week's game plan from an
// event (F.nx: { off, def } on the sim's scale), a Motivator in January. Each coach's late-game calls (coach.js).
function gameOf(F, g, seed, po) {
  const H = strength(F, g.h), A = strength(F, g.a)
  const mod = { h: coachDay(F, g.h, { po }), a: coachDay(F, g.a, { po }) }
  const mine = g.h === F.team ? 'h' : g.a === F.team ? 'a' : null
  if (mine) {
    const nx = typeof F.nx === 'object' && F.nx ? F.nx : { off: F.nx ?? 0, def: 0 }
    mod[mine] += (F.chem - 50) * 0.012 + (nx.off ?? 0)
    mod[mine === 'h' ? 'a' : 'h'] -= nx.def ?? 0
  }
  // (each side's kicker: his three ratings make his kicks, game.js fgChance)
  const kh = kickerOf(F, g.h), ka = kickerOf(F, g.a)
  return { h: g.h, a: g.a, sh: { off: H.off, def: H.def }, sa: { off: A.off, def: A.def }, seed, po: !!po, homeEdge: g.n ? 0 : 0.9, mod, late: { h: coachLate(F, g.h), a: coachLate(F, g.a) },
    k: { h: kickTraits(F, kh), a: kickTraits(F, ka) }, kid: { h: kh?.i ?? null, a: ka?.i ?? null } }
}


// ── Moments ──────────────────────────────────────────────────────────────────
// (owner, 2026-11-16) A moment is a snap of the player's own game: the game puts it where it falls (game.js snapOf:
// the two-minute drill, third and long late, the red zone with the game on it, fourth down; on defense their last
// drive or a goal-line stand), he calls the play and runs it (moments.js names it), and the game goes on from what
// the snap did. A game can stop on more than one: F.pend holds the game between them.
// opts: { moments: bool (the player's moments switch) }

// ── A week ───────────────────────────────────────────────────────────────────
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
    addKickStats(F, S)
    // (both teams' box score, made now and kept: box.js)
    recordBox(F, finishBox(playBox(F, S, `${seed}-box`)), po)
  })
  if (!mine) return endWeek(F, null)
  const { g, seed } = mine
  const G = gameOf(F, g, seed, po)
  if (opts.moments) G.key = { us: g.h === F.team ? 'h' : 'a', off: true, def: true }
  const S = run(newGame(G))
  if (S.key) {
    // (the plays before it, named now: the live feed shows them, and the final summary keeps them as they were)
    const kp0 = scoringSummary(F, S, S.key.us, null, null, null, { credits: true })
    F.pend = { S, po: !!po, kp0, ms: [] }
    return { pending: true }
  }
  return finishUserGame(F, mine, S, [], null)
}
// the drives as the screens read them: [t0, t1, mine (1 the player's team), y0 (from that offense's own goal), res, at]
const RES = { td: 'T', fg: 'F', miss: 'M', punt: 'P', to: 'X', downs: 'D', end: 'E', kneel: 'K', sf: 'S' }
export const driveRows = (S, us) => (S.dr ?? []).map(d => [d.t0, d.t1, d.s === us ? 1 : 0, d.y0, RES[d.res] ?? 'E', d.at])
// the moment as the screen shows it: the game's own state
export function momentView(F) {
  const P = F.pend
  const S = P?.S, k = S?.key
  if (!k) return null
  const us = k.us, opp = S.G[us === 'h' ? 'a' : 'h']
  const off = k.ball === 'us'
  const offT = off ? F.team : opp, defT = off ? opp : F.team
  const L = startersOf(F, F.team)
  // the man the player runs: the quarterback on a pass, the back on a run, the middle linebacker on defense
  const ctl = off ? { pass: L.qb1?.i ?? null, run: L.rb1?.i ?? null } : { stop: (L.lb1 ?? L.lb2 ?? L.s1 ?? L.edge1)?.i ?? null }
  return {
    kind: k.kind, side: k.side, ball: k.ball, down: k.down, d: k.d, y: k.y, goal: k.goal, t: k.t, clock: clockText(k.t, P.po), period: periodOf(k.t), left: k.left,
    mine: k.mine, theirs: k.opp, opp, us: F.team, home: us === 'h', po: P.po, i: k.i, half: k.half, ot: k.ot,
    // the spot the broadcast way: "DEN 35" on the offense's own side, "ARI 47" across midfield
    spotTxt: k.y === 50 ? '50' : k.y < 50 ? `${offT} ${k.y}` : `${defT} ${100 - k.y}`,
    seed: `${S.G.seed}-mg-${S.di}`, ctl, pid: off ? ctl.pass ?? ctl.run : ctl.stop,
    feed: (P.kp0 ?? []).map(x => x.slice(0, 4)), dr: driveRows(S, us), ms: P.ms ?? [],
    // (the drive it's on: when and where it started)
    from: S.keyFrom ? { t0: S.keyFrom.t0, y0: S.keyFrom.y0 } : null,
  }
}
// The moment's snap is in (out: what the play did, moments.js playResult; nothing, or true/false from a script: the
// sim plays it). The game goes on to its next moment ({ pending: true }) or to the final (the week's end).
export function finishMoment(F, out = null) {
  const P = F.pend, S = P.S
  const v = momentView(F)
  if (!out || typeof out !== 'object') out = simSnap(S, v.ball === 'us' ? (rngOf(`${S.G.seed}-call-${S.di}`).u() < 0.62 ? 'pass' : 'run') : 'run', 'auto')
  out = nameSnap(F, v, out)
  const ok = out.to ? (v.ball === 'us' ? 0 : 1) : (out.td || (out.yards ?? 0) >= v.d) === (v.ball === 'us') ? 1 : 0
  P.ms = [...(P.ms ?? []), { t: v.t, side: v.side, kind: v.kind, down: v.down, d: v.d, y: v.y, call: out.call ?? null, play: out.play ?? null, yards: Math.round(out.yards ?? 0), td: out.td || v.y + (out.yards ?? 0) >= 100 ? 1 : 0, to: out.to ?? null, ok, txt: out.txt, st: out.st ?? null, ...(out.ot && { ot: out.ot }), by: out.played ? 1 : 0, ...(out.sack && { sack: 1 }), ...(out.inc && { inc: 1 }) }]
  resolveSnap(S, out)
  F.moments = (F.moments ?? 0) + 1
  if (S.key) {
    P.kp0 = scoringSummary(F, S, S.key.us, null, null, null, { pre: P.kp0, credits: true })
    return { pending: true }
  }
  const games = P.po ? F.po.rounds[F.po.rd] : F.sched.weeks[F.wk]
  const i = games.findIndex(g => g.h === F.team || g.a === F.team)
  F.pend = null
  return finishUserGame(F, { g: games[i], i }, S, P.ms, P.kp0)
}

// ── The player's game is over ────────────────────────────────────────────────
// (ms: the moments he played in it; pre: the plays named while the game waited on them)
const TEAM_KEYS = ['yds', 'py', 'ry', 'pa', 'pc', 'ra', 'sk', 'int', 'fum', 'to']
function finishUserGame(F, { g }, S, ms = [], pre = null) {
  Object.assign(g, { hs: S.hs, as: S.as, ...(S.ot && { ot: 1 }) })
  const home = g.h === F.team, opp = home ? g.a : g.h
  const us = home ? S.hs : S.as, them = home ? S.as : S.hs
  const won = us > them, tie = us === them
  const po = F.phase === 'playoffs'
  // the box score, both teams, from the game as it was played (box.js): the moments' snaps on the men who made them,
  // then every touchdown on the man the scoring summary names (plays.js), then each team's line from its men's
  const side = home ? 'h' : 'a', oside = home ? 'a' : 'h'
  const B = playBox(F, S, `${F.seed}-${F.year}-box-${po ? `p${F.po.rd}` : F.wk}`)
  addMoments(B, side, ms)
  const box = B[side].s, roster = B[side].roster
  const kp = scoringSummary(F, S, side, box, null, null, { pre, obox: B[oside].s })
  finishBox(B)
  const tu = B.team[side], tt = B.team[oside]
  // (the season's lines: the player's men in F.ss, theirs in the league's, box.js)
  recordBox(F, B, po)
  // the builds' lines (one line each), and the day's best line on the team (the broadcast's player of the game)
  const lineOf = p => fbLine(p.pos, box[p.k] ?? {}).slice(0, 3).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(' · ')
  // (a build who played always has his line, a quiet day's zeros included: a lineman's sacks allowed always show)
  const buildLine = p => { const L = fbLine(p.pos, box[p.k] ?? {}).slice(0, 3), nz = L.filter(([, v]) => v); return (p.pos === 'ol' ? L : nz.length ? nz : L.slice(0, 2)).map(([k, v]) => `${v} ${k}`).join(' · ') }
  const lines = roster.filter(p => p.s != null).map(p => ({ b: +p.s, pid: +p.k.slice(1), line: buildLine(p) }))
  // (the kicking: the season's lines, and a build at K gets his line from the game: "2/3 FG · 4/4 XP · LONG 51")
  addKickStats(F, S)
  { const kid = S.G.kid?.[side], kp = kid != null ? F.teams[F.team].r.find(p => p.i === kid) : null
    if (kp?.b != null) lines.push({ b: kp.b, pid: kp.i, line: kickLine(S.kk?.[side]) || '0 FG · 0 XP' }) }
  const star = topLine(roster, box)
  const bx = boxOf(S)
  const row = {
    wk: po ? null : F.wk + 1, rd: po ? F.po.rd : null, opp, home, us, them, w: won ? 1 : 0, t: tie ? 1 : 0, ot: S.ot ? 1 : 0,
    q: home ? [bx.q.h, bx.q.a] : [bx.q.a, bx.q.h], pl: bx.pl.map(([t, s, p, k]) => [t, (s === 0) === home ? 1 : 0, p, k]), kp, lines,
    ...(star && { st: { pid: star.pid, line: lineOf(star.p) } }),
    // the drives (the live screen's play-by-play), the moments, and the box score (gameBox in stats.js reads it)
    dr: driveRows(S, side),
    ...(ms?.length && { ms: ms.map(m => ({ t: m.t, side: m.side, kind: m.kind, down: m.down, d: m.d, y: m.y, yards: m.yards, ok: m.ok, txt: m.txt, ...(m.td && { td: 1 }), ...(m.to && { to: m.to }), ...(m.by && { by: 1 }) })) }),
    bx: { ...packBox(box, tu, tt, S, side, roster), ox: oppOf(B[oside]) },
  }
  const h = headline(F, row)
  row.hl = h.hl; row.sub = h.sub
  F.log.push(row)
  F.streak = won ? Math.max(0, F.streak) + 1 : tie ? 0 : Math.min(0, F.streak) - 1
  F.chem = clamp(0, 100, F.chem + (won ? 0.3 : -0.3))
  F.nx = 0
  return endWeek(F, row)
}
// the game's box score, small: the men's lines (only what they did), the two teams' lines, the time of possession and
// the kicking ([FGA, FGM, XPA, XPM, long] a side)
function packBox(box, tu, tt, S, side, roster = []) {
  const s = {}, ro = {}
  for (const [k, x] of Object.entries(box)) {
    const o = {}
    for (const [key, v] of Object.entries(x ?? {})) if (v) o[key] = v
    if (Object.keys(o).length) s[k.slice(1)] = o
  }
  // (each man's place that day: his position, his place in the room, the spot he played, a build's number)
  for (const p of roster) { const id = p.k.slice(1); if (s[id]) ro[id] = [p.pos, p.d ?? 0, p.sub ?? null, p.s ?? null] }
  const pick = T => Object.fromEntries(TEAM_KEYS.map(k => [k, T[k] ?? 0]))
  const other = side === 'h' ? 'a' : 'h'
  return { s, u: pick(tu), o: pick(tt), top: [S.top?.[side] ?? 0, S.top?.[other] ?? 0], kk: [S.kk?.[side] ?? null, S.kk?.[other] ?? null], kid: [S.G.kid?.[side] ?? null, S.G.kid?.[other] ?? null], ro }
}
// the team's best line of the day (what the broadcast puts up after the game)
function topLine(roster, box) {
  let best = null
  for (const p of roster) {
    const x = box[p.k]
    if (!x) continue
    const v = p.pos === 'qb' ? (x.py ?? 0) / 25 + (x.ptd ?? 0) * 4 - (x.int ?? 0) * 2 + (x.ry ?? 0) / 10 + (x.rtd ?? 0) * 6
      : p.pos === 'rb' ? ((x.ry ?? 0) + (x.ryd ?? 0)) / 10 + ((x.rtd ?? 0) + (x.rctd ?? 0)) * 6
        : p.pos === 'wr' || p.pos === 'te' ? (x.ryd ?? 0) / 10 + (x.rctd ?? 0) * 6 + (x.rc ?? 0) * 0.5
          : (x.sck ?? 0) * 5 + (x.dint ?? 0) * 6 + (x.tk ?? 0) * 0.4 + (x.ff ?? 0) * 3
    if (!best || v > best.v) best = { v, p, pid: +p.k.slice(1) }
  }
  return best
}

// ── The end of a week ────────────────────────────────────────────────────────
// (the week's injury wire, every team's starters and the player's whole team, is kept for the hub's ticker:
// F.wire [[short, name, weeks, what]]; the injury is the man's own (p.ij), so the wire, the ticker and the final card
// all name the same one)
// The injuries themselves: injury.js (the NFL's rates by position and lengths, a fifth gentler; builds the same).
function endWeek(F, row) {
  const R = rngOf(`${F.seed}-${F.year}-wk-${F.phase}-${F.phase === 'playoffs' ? F.po.rd : F.wk}`)
  const out = { row, news: [] }
  const wire = []
  // injuries: the week's games' (a team on its bye plays nobody and loses nobody), then the week passes for the hurt
  const played = new Set((F.phase === 'playoffs' ? F.po.rounds[F.po.rd] : F.sched.weeks[F.wk] ?? []).flatMap(g => [g.h, g.a]))
  for (const s of SHORTS) {
    const t = F.teams[s]
    for (const p of t.r) if (p.in) { p.in--; if (!p.in) { delete p.in; delete p.ij } }
    if (!played.has(s)) continue
    for (const [p, ij, starter] of rollInjuries(F, s, R)) {
      if (s === F.team) out.news.push({ k: 'inj', pid: p.i, n: p.n, wk: p.in, what: ij.l, ...(ij.se && { se: 1 }) })
      if (starter || s === F.team) wire.push([s, p.n, p.in, ij.l])
    }
  }
  F.wire = wire.sort((a, b) => (b[0] === F.team) - (a[0] === F.team)).slice(0, 8)
  // every room two deep again after the week's cuts and trades (league.js fillUp: a filler where nobody's behind)
  fillLeague(F)
  // a room without enough healthy men to start: the team signs one off its practice squad, as every team does (a
  // league team with its kicker hurt calls the best kicker on the street first, the way they do)
  for (const s of SHORTS) {
    const C = depthChart(F, s, { healthy: true })
    for (const [k, , pos, spot, n] of GROUPS) {
      for (let have = C[k].length; have < n; have++) {
        const street = k === 'k' && s !== F.team ? (F.fa ?? []).filter(x => x.p === 'k' && !x.fl && !x.in).sort((a, b) => b.o - a.o)[0] : null
        if (street) {
          F.fa = F.fa.filter(x => x !== street)
          signDeal(street, { $: minimumFor(street.ag, F.year), y: 1, g: 0 })
          F.teams[s].r.push(street)
          addNews(F, { k: 'sign', tag: 'SIGNED', s, text: `${TEAM[s].nick} sign K ${street.n}` })
          continue
        }
        const p = makeGen(F, pos, R, { o: pos === 'k' ? R.int(70, 76) : R.int(63, 68), ag: R.int(23, 28) })
        p.n = freshName(R, F.teams[s].r, spot ?? pos)
        if (spot) p.s = spot
        p.y = 1
        F.teams[s].r.push(p)
        if (s === F.team) { out.news.push({ k: 'sign', pid: p.i, n: p.n }); addNews(F, { k: 'sign', tag: 'SIGNED', s, text: `${TEAM[s].nick} sign ${k.toUpperCase()} ${p.n} off the practice squad` }) }
      }
    }
  }
  F.chem = clamp(0, 100, r1(F.chem + chemWeek(F)))
  if (F.phase === 'playoffs') {
    endRound(F)
    if (F.po.champ) { F.phase = 'done'; out.champ = F.po.champ }
    return out
  }
  F.wk++
  // (the scouts' days: draft.js scoutsLeft, by the week)
  // an event card about every three or four weeks
  if (F.wk < REG_WEEKS && F.wk >= (F.nextEv ?? 3)) { F.ev = makeEvent(F, R); F.nextEv = F.wk + R.int(3, 4); if (F.ev) out.event = true }
  if (F.wk >= REG_WEEKS) { F.phase = 'post'; out.over = true }
  return out
}
// the regular season is over: the bracket
export function intoPlayoffs(F) {
  // (the regular season's totals, kept: the playoffs' games don't count toward season lines, awards or records)
  F.ssr = JSON.parse(JSON.stringify(F.ss ?? {}))
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
// The way a beat writer files it: the score, winner first ("Broncos 24, Chiefs 17"), and one fact under it: the
// winning play late, the overtime score, the comeback, the shutout, or the day's best line. No adjectives.
const nickOf = s => TEAM[s].nick
export function headline(F, row) {
  const me = F.team, opp = row.opp
  const [W, L, ws, ls] = row.us >= row.them ? [me, opp, row.us, row.them] : [opp, me, row.them, row.us]
  const hl = row.t ? `${nickOf(me)} ${row.us}, ${nickOf(opp)} ${row.them} (OT)` : `${nickOf(W)} ${ws}, ${nickOf(L)} ${ls}${row.ot ? ' (OT)' : ''}`
  const kp = row.kp ?? []
  const scores = kp.filter(x => x[2] > 0), last = scores[scores.length - 1]
  const winMine = row.us > row.them ? 1 : 0
  // the deciding score: the last points, by the winner, that took the lead, in the last two minutes
  let a = 0, b = 0, lead = null
  for (const x of scores) { const before = winMine ? a - b : b - a; if (x[1]) a += x[2]; else b += x[2]; const after = winMine ? a - b : b - a; if (x[1] === winMine && before <= 0 && after > 0) lead = x }
  let worst = 0, c = 0, d = 0
  for (const x of scores) { if (x[1] === winMine) c += x[2]; else d += x[2]; worst = Math.min(worst, c - d) }
  let sub = null
  if (row.t) sub = 'Tied after overtime'
  else if (row.ot && last) sub = `${last[3]} in overtime`
  else if (lead && lead === last && lead[0] >= 3480) sub = `${lead[3]} with ${clockLeft(lead[0])} left`
  if (!sub && worst <= -10) sub = `${nickOf(W)} come back from ${-worst} down`
  if (!sub && ls === 0) sub = `${nickOf(W)} shut out the ${nickOf(L)}`
  if (!sub && row.w && row.st) { const p = F.teams[F.team].r.find(x => x.i === row.st.pid); if (p && row.st.line) sub = `${p.n}: ${row.st.line}` }
  if (!sub) sub = topScorer(kp.filter(x => x[1] === winMine && x[2] > 0))
  return { hl, sub: sub ?? '' }
}
const clockLeft = t => { const left = 3600 - t; return `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` }
// the man in the most touchdowns on a side's summary: "Patrick Mahomes 3 TD passes", "Derrick Henry 2 rushing TDs"
function topScorer(list) {
  const pass = {}, run = {}
  for (const [, , , t] of list) {
    let m = t.match(/^(.+?) \d+-yd pass to /)
    if (m) { pass[m[1]] = (pass[m[1]] ?? 0) + 1; continue }
    m = t.match(/^(.+?) \d+-yd run/)
    if (m) run[m[1]] = (run[m[1]] ?? 0) + 1
  }
  const bp = Object.entries(pass).sort((x, y) => y[1] - x[1])[0], br = Object.entries(run).sort((x, y) => y[1] - x[1])[0]
  if (bp && bp[1] >= 2 && (!br || bp[1] >= br[1])) return `${bp[0]}: ${bp[1]} TD passes`
  if (br && br[1] >= 2) return `${br[0]}: ${br[1]} rushing TDs`
  return list.length ? list[list.length - 1][3] : null
}

// ── Events: a headline and two answers ───────────────────────────────────────
// Real football weeks: a receiver asking for the ball, a starter limited in practice, a young player pushing for the
// job, a contract year, a trade call before the deadline, the game plan for next week's best player, a college
// scouting trip, a veteran still on the street. Each answer does something the player can see: a man's OVR, a man
// out, the depth chart, the roster, the cap, the next game's plan (OFFENSE ▲ / DEFENSE ▲ on the matchup),
// chemistry, scout points. Every answer's effects show on its button (fxList).
const nm = p => p.n
const posTxt = p => (p.p === 'dl' || p.p === 'db' ? groupOf(p).toUpperCase() : p.p === 'ol' ? (p.s ?? 'OL') : p.p.toUpperCase())
const startersMine = F => Object.values(startersOf(F, F.team))
// (a filler backup is never the man an event is about: league.js fillUp)
const bestStarter = (F, test) => startersMine(F).filter(p => !p.in && !p.fl && test(p)).sort((a, b) => b.o - a.o)[0]
function nextOpp(F) {
  const g = F.sched.weeks[F.wk]?.find(x => x.h === F.team || x.a === F.team)
  return g ? (g.h === F.team ? g.a : g.h) : null
}
const EVENTS = [
  // a receiver wants the ball
  { id: 'targets', make: F => {
    const p = bestStarter(F, x => (x.p === 'wr' || x.p === 'te') && x.b == null), o = nextOpp(F)
    return p && o && { title: `${nm(p)} asks for more targets`, pid: p.i, opp: o, a: ['Feature him this week', { nx: { off: 0.35 }, chem: -3 }], b: ['Stick to the game plan', { chem: 3 }] }
  } },
  // a starter limited in practice
  { id: 'limited', make: F => {
    const p = bestStarter(F, x => x.p !== 'ol' && x.b == null)
    if (!p) return null
    const what = injuryOf(F, p)
    return { title: `${nm(p)} limited in practice (${what})`, pid: p.i, a: ['Play him Sunday', { risk: p.i }], b: ['Rest him this week', { sit: p.i }] }
  } },
  // a young man behind a starter, close to him
  { id: 'young', make: F => {
    const C = depthChart(F, F.team, { healthy: true }), L = startersOf(F, F.team), on = new Set(Object.values(L).map(p => p.i))
    for (const k of ['wr', 'rb', 'cb', 'edge', 'lb', 's', 'te', 'dt']) {
      const young = C[k].find(p => !on.has(p.i) && p.ag <= 24 && p.b == null && !p.fl)
      const starter = C[k].find(p => on.has(p.i) && p.b == null && !p.fl)
      if (young && starter && starter.o - young.o <= 4) return { title: `${nm(young)} pushing ${nm(starter)} for the starting job`, pid: young.i, sid: starter.i, a: [`Start ${nm(young)}`, { start: young.i, ovr: [young.i, 2] }], b: [`Keep ${nm(starter)} the starter`, { chem: 2 }] }
    }
    return null
  } },
  // a starter in the last year of his deal
  { id: 'extend', make: F => {
    const p = bestStarter(F, x => x.b == null && (x.y ?? 0) <= 1 && x.o >= 80 && x.ag <= 30)
    if (!p) return null
    const ask = askOf(p, F.year + 1)
    if (!canSign(F, Math.max(0, ask.$ - (p.$ ?? 0)))) return null
    return { title: `${nm(p)} wants an extension`, pid: p.i, ask, a: ['Extend him now', { pay: p.i, chem: 2 }], b: ['Wait until the offseason', { chem: -2 }] }
  } },
  // a trade call (before the deadline): a starter of theirs, better and older, for one of yours at his spot
  { id: 'trade', make: (F, R) => tradeEvent(F, R) },
  // next week's best player: the game plan
  { id: 'plan', make: F => {
    const o = nextOpp(F)
    if (!o) return null
    const L = startersOf(F, o), star = Object.values(L).filter(p => !p.in && p.p !== 'k').sort((a, b) => b.o - a.o)[0]
    if (!star) return null
    const off = ['qb', 'rb', 'wr', 'te', 'ol'].includes(star.p)
    return { title: `Game plan for ${nm(star)} and the ${TEAM[o].nick}`, pid: star.i, team: o, opp: o,
      a: [off ? `Build it around stopping ${nm(star)}` : `Build it around blocking ${nm(star)}`, off ? { nx: { def: 0.4, off: -0.15 } } : { nx: { off: 0.4, def: -0.15 } }],
      b: ['Play our normal game', { chem: 1 }] }
  } },
  // a college scouting trip on Saturday
  { id: 'scout', make: () => ({ title: 'Scouts want the GM at a college game Saturday', a: ['Make the trip', { sp: 2, chem: -1 }], b: ['Stay with the team', { chem: 2 }] }) },
  // a veteran free agent still on the street
  { id: 'street', make: F => {
    const L = startersOf(F, F.team)
    for (const p of [...(F.fa ?? [])].sort((a, b) => b.o - a.o)) {
      if (p.b != null || p.ag > 34) continue
      const k = groupOf(p), worst = Object.entries(L).filter(([s]) => s.replace(/\d$/, '') === k).map(([, x]) => x).sort((a, b) => a.o - b.o)[0]
      if (!worst || worst.b != null || p.o < worst.o + 3) continue
      const cost = r1(Math.min(p.$ ?? 1.2, 4))
      // (a kicker in: the one there now is released, a team carries one)
      const cut = k === 'k' ? worst : F.teams[F.team].r.filter(x => groupOf(x) === k && x.b == null && !x.fl && x !== worst).sort((a, b) => a.o - b.o)[0] ?? null
      if (!canSign(F, cost)) continue
      return { title: `Free agent ${nm(p)} still unsigned`, pid: p.i, cost, cut: cut?.i ?? null, a: [`Sign ${nm(p)}`, { sign: p.i }], b: ['Keep the roster', { chem: 1 }] }
    }
    return null
  } },
]
function tradeEvent(F, R) {
  if (F.wk >= TRADE_DEADLINE) return null   // (F.wk: weeks played; after Week 9 the deadline has passed)
  const L = startersMine(F).filter(p => p.b == null && !p.fl && p.ag <= 29 && p.p !== 'qb' && p.p !== 'ol' && p.p !== 'k')
  if (!L.length) return null
  const mine = R.pick(L)
  const others = SHORTS.filter(s => s !== F.team)
  for (let k = 0; k < 8; k++) {
    const s = R.pick(others)
    const theirs = F.teams[s].r.filter(p => groupOf(p) === groupOf(mine) && p.o >= mine.o + 3 && p.o <= mine.o + 8 && p.ag >= mine.ag + 2 && p.b == null && !p.fl)[0]
    if (theirs) return { title: `${TEAM[s].nick} offer ${nm(theirs)} for ${nm(mine)}`, team: s, give: mine.i, get: theirs.i, pid: theirs.i, a: ['Make the trade', { trade: 1, chem: -3 }], b: ['Turn it down', { chem: 1 }] }
  }
  return null
}
function makeEvent(F, R) {
  const seen = F.evSeen ?? []
  const order = R.shuffle(EVENTS.filter(e => !seen.includes(e.id)))
  for (const e of order) {
    const x = e.make(F, R)
    if (x) { F.evSeen = [...seen, e.id].slice(-5); return { id: e.id, ...x } }
  }
  return null
}
// what an answer does, the way its button shows it: [[text, 'up' | 'down' | 'out' | 'flat']]
export function fxList(F, ev, i) {
  const fx = (i === 0 ? ev.a : ev.b)[1], out = []
  const P = id => F.teams[F.team].r.find(p => p.i === id) ?? (F.fa ?? []).find(p => p.i === id) ?? (ev.team ? F.teams[ev.team]?.r.find(p => p.i === id) : null)
  const last = p => (p ? String(p.n).split(' ').filter(w => !/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(w)).slice(-1)[0].toUpperCase() : '')
  const opp = ev.opp ?? nextOpp(F), vs = opp ? `VS ${TEAM[opp].short}` : 'NEXT GAME'
  if (fx.nx?.off) out.push([`${vs}: OFFENSE ${fx.nx.off > 0 ? '▲' : '▼'}`, fx.nx.off > 0 ? 'up' : 'down'])
  if (fx.nx?.def) out.push([`${vs}: DEFENSE ${fx.nx.def > 0 ? '▲' : '▼'}`, fx.nx.def > 0 ? 'up' : 'down'])
  if (fx.risk) out.push([`1 IN 3: ${last(P(fx.risk))} OUT 3 WKS`, 'down'])
  if (fx.sit) out.push([`${last(P(fx.sit))} OUT 1 WEEK`, 'out'])
  if (fx.start) out.push([`${last(P(fx.start))} STARTS`, 'up'])
  if (fx.ovr) out.push([`${last(P(fx.ovr[0]))} +${fx.ovr[1]} OVR`, 'up'])
  if (fx.pay) out.push([`${ev.ask.y + 1} YRS · $${ev.ask.$}M A YEAR`, 'up'])
  if (fx.trade) { const g = P(ev.get), m = P(ev.give); out.push([`GET ${last(g)} · ${g?.o} OVR · AGE ${g?.ag}`, 'up'], [`GIVE ${last(m)} · ${m?.o} OVR · AGE ${m?.ag}`, 'down']) }
  if (fx.sign) { const p = P(fx.sign); out.push([`${last(p)} · ${p?.o} OVR · $${ev.cost}M`, 'up']); if (ev.cut != null) out.push([`RELEASE ${last(P(ev.cut))}`, 'down']) }
  if (fx.sp) out.push([`+${fx.sp} SCOUTING DAYS`, 'up'])
  if (fx.chem) out.push([`CHEMISTRY ${fx.chem > 0 ? '+' : ''}${fx.chem}`, fx.chem > 0 ? 'up' : 'down'])
  if (!out.length) out.push(['NO CHANGE', 'flat'])
  return out
}
// the player's answer: 0 the first button, 1 the second. Returns what it did (for the result line)
export function chooseEvent(F, i) {
  const ev = F.ev
  if (!ev) return null
  const fx = (i === 0 ? ev.a : ev.b)[1]
  const t = F.teams[F.team], R = rngOf(`${F.seed}-${F.year}-ev-${F.wk}`)
  const out = { chem: 0 }
  if (fx.chem) { F.chem = H_CLAMP(F.chem + fx.chem); out.chem = fx.chem }
  if (fx.nx) { const n = typeof F.nx === 'object' && F.nx ? F.nx : { off: 0, def: 0 }; F.nx = { off: (n.off ?? 0) + (fx.nx.off ?? 0), def: (n.def ?? 0) + (fx.nx.def ?? 0) } }
  if (fx.sp && F.sc) { syncScouts(F); F.sc.b = (F.sc.b ?? 0) + fx.sp }
  const P = id => t.r.find(p => p.i === id)
  if (fx.risk) { const p = P(fx.risk); if (p && R.u() < 0.33) { p.in = 3; p.ij = { l: injuryOf(F, p), w: 3 }; out.hurt = p.n } }
  if (fx.sit) { const p = P(fx.sit); if (p) p.in = 1 }
  if (fx.ovr) { const p = P(fx.ovr[0]); if (p) { p.o = Math.min(99, p.o + fx.ovr[1]); p.pk = Math.max(p.pk ?? p.o, p.o) } }
  if (fx.start) { try { moveInChart(F, fx.start, 0) } catch { /* (the chart's own rules) */ } }
  if (fx.pay) { const p = P(fx.pay); if (p && ev.ask) { signDeal(p, { $: ev.ask.$, y: ev.ask.y + 1 }); out.paid = p.n; addNews(F, { k: 'sign', tag: 'EXTENSION', s: F.team, text: `${TEAM[F.team].nick} extend ${posTxt(p)} ${p.n}: ${ev.ask.y + 1} years, $${r1(ev.ask.$ * (ev.ask.y + 1))}M` }) } }
  if (fx.trade) {
    const mine = P(ev.give), ot = F.teams[ev.team], theirs = ot?.r.find(p => p.i === ev.get)
    if (mine && theirs) {
      t.r = t.r.filter(p => p !== mine); ot.r = ot.r.filter(p => p !== theirs)
      t.r.push(theirs); ot.r.push(mine)
      delete theirs.nu; delete mine.nu
      out.traded = theirs.n
      addNews(F, { k: 'trade', tag: 'TRADE', s: F.team, text: `${TEAM[F.team].nick} acquire ${posTxt(theirs)} ${theirs.n} from the ${TEAM[ev.team].nick} for ${posTxt(mine)} ${mine.n}` })
    }
  }
  if (fx.sign) {
    const p = (F.fa ?? []).find(x => x.i === fx.sign)
    if (p) {
      if (ev.cut != null) { try { cutMan(F, ev.cut) } catch { t.r = t.r.filter(x => x.i !== ev.cut) } }
      F.fa = F.fa.filter(x => x !== p)
      signDeal(p, { $: ev.cost, y: 1 })
      t.r.push(p)
      out.signed = p.n
      addNews(F, { k: 'sign', tag: 'SIGNED', s: F.team, text: `${TEAM[F.team].nick} sign ${posTxt(p)} ${p.n}` })
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
// The league for the hub's ticker: the other finals from the last week (or round) played and the injury wire.
// [{ k: 'score', a, as, h, hs, tag } | { k: 'news', tag, s, text }]
export function leagueWire(F) {
  const out = []
  let games = []
  if (F.phase === 'season' || F.phase === 'post') games = F.wk > 0 ? F.sched.weeks[F.wk - 1] : []
  else if (F.phase === 'playoffs' && F.po) games = F.po.rd > 0 ? F.po.rounds[F.po.rd - 1] : F.sched.weeks[F.sched.weeks.length - 1]
  else if (F.phase === 'done' && F.po) games = F.po.rounds[F.po.rounds.length - 1] ?? []
  for (const g of games ?? []) if (g.hs != null && g.h !== F.team && g.a !== F.team) out.push({ k: 'score', a: g.a, as: g.as, h: g.h, hs: g.hs, tag: g.ot ? 'F/OT' : 'FINAL' })
  ;(F.wire ?? []).forEach(([s, n, w, what], i) => out.splice(Math.min(out.length, 1 + i * 3), 0, { k: 'news', tag: 'INJURY', s, text: `${n}${what ? ` (${what})` : ''} ${w >= 60 ? 'out for the season' : `out ${w} ${w === 1 ? 'week' : 'weeks'}`}` }))
  return out
}
// the line on a game: the favorite by how many (from the two teams' strength, home field 1.5) and the total
export function lineOf(F, a, h, neutral = false) {
  const A = strength(F, a), H = strength(F, h)
  // (the sim's margin: about 1.5 points a point of edge, scripts/franchise2/team-ratings.mjs; 10 points of OVR is about a 10-point line)
  const pts = ((H.off - A.def) - (A.off - H.def)) * 1.5 + (neutral ? 0 : 1.5)
  const r = Math.round(Math.abs(pts) * 2) / 2
  const total = clamp(36, 56, Math.round((44 + ((A.off - H.def) + (H.off - A.def)) * 1.3) * 2) / 2)   // (the market's totals: high 30s to the mid 50s)
  if (r < 0.5) return { fav: null, pts: 0, text: 'PICK', total }
  return { fav: pts > 0 ? h : a, pts: r, text: `${pts > 0 ? h : a} -${r}`, total }
}
export { standings, finishOf, ROUNDS, whenOf }
