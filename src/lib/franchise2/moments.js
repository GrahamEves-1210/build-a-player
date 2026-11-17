// FRANCHISE: the moments' plays (owner, 2026-11-16: "you pick a play like 2min drill but you pass just like 3rd down
// game or if you choose a run you control rb. and on defense ... you jump in and control the LB").
// A moment (game.js snapOf) is a snap of the player's own game. This is what he can call on it, the engine that plays
// it (lib/mg), the men in it (cast.js, from both depth charts), and what the play did, named the way the broadcast
// says it, with the men's lines for the box score.
import { TEAM } from './league'
import { startersOf } from './roster'
import { boxTraits } from './stats'
import { momentCast } from './cast'
import { rngOf, clamp } from './rng'

const DOWN = ['', '1st', '2nd', '3rd', '4th']
// The calls: real names, run or pass, and the engine (fr-pass: Third & Long with the called concept; fr-fade: Fourth &
// Goal's throw; fr-run: the back from scrimmage on the kick return's stick; fr-stop: Hit Stick's backer, one handoff)
export const PLAYS = {
  'curl-flat': { name: 'Curl-Flat', kind: 'pass', game: 'fr-pass', call: 0, tag: 'Curl and the flat' },
  smash: { name: 'Smash', kind: 'pass', game: 'fr-pass', call: 1, tag: 'Corner over the hitch' },
  dagger: { name: 'Dagger', kind: 'pass', game: 'fr-pass', call: 2, tag: 'Seam clears the dig' },
  sail: { name: 'Sail', kind: 'pass', game: 'fr-pass', call: 3, tag: 'Go, out, comeback' },
  'y-cross': { name: 'Y-Cross', kind: 'pass', game: 'fr-pass', call: 4, tag: 'Tight end across' },
  slants: { name: 'Slants', kind: 'pass', game: 'fr-pass', call: 5, tag: 'Quick, inside' },
  fade: { name: 'Goal-line pass', kind: 'pass', game: 'fr-fade', tag: 'One read, into the end zone' },
  'inside-zone': { name: 'Inside Zone', kind: 'run', game: 'fr-run', hole: 'inside', tag: 'Between the tackles' },
  power: { name: 'Power', kind: 'run', game: 'fr-run', hole: 'power', tag: 'Off tackle' },
  'outside-zone': { name: 'Outside Zone', kind: 'run', game: 'fr-run', hole: 'outside', tag: 'Stretch to the edge' },
  draw: { name: 'Draw', kind: 'run', game: 'fr-run', hole: 'draw', tag: 'Show pass, hand it off' },
  stop: { name: 'Run fit', kind: 'stop', game: 'fr-stop', tag: 'Fill the hole' },
}
// What the offense has on that down and distance: three calls, the run game first in short yardage, the passing game
// long, the quick game and the sideline in a two-minute drill
export function playsFor(v) {
  if (v.ball !== 'us') return ['stop']
  const toGoal = 100 - v.y
  if (v.goal && toGoal <= 7) return ['fade', 'power', 'inside-zone']
  if (v.kind === 'half' || v.kind === 'two') return v.d <= 3 ? ['slants', 'smash', 'inside-zone'] : ['sail', 'dagger', 'draw']
  if (v.d <= 2) return ['power', 'inside-zone', 'slants']
  if (v.d <= 6) return ['smash', 'curl-flat', 'outside-zone']
  return ['dagger', 'y-cross', 'draw']
}

// the man the player runs on the call: the quarterback on a pass, the back on a run, the backer on defense
const manOf = (F, id) => (id == null ? null : F.teams[F.team].r.find(p => p.i === id) ?? null)
export function ctlFor(F, v, playId) {
  const P = PLAYS[playId], L = startersOf(F, F.team)
  if (P.kind === 'stop') return manOf(F, v.ctl?.stop) ?? L.lb1 ?? L.lb2 ?? L.s1
  return P.kind === 'run' ? L.rb1 ?? L.qb1 : L.qb1
}
// his grade on the play (the engines' 1-11): the traits that make it
const avgOf = (t, keys) => { const v = keys.map(k => t[k]).filter(x => typeof x === 'number'); return v.length ? v.reduce((a, x) => a + x, 0) / v.length : 5 }
const TRAITS = { pass: ['accuracy', 'arm', 'processing', 'vision'], run: ['speed', 'burst', 'elusiveness', 'balance', 'vision'], stop: ['tackling', 'playRecognition', 'range', 'power', 'runSupport'] }
export function ratingFor(F, p, kind) {
  if (!p) return 5
  try { return clamp(1, 11, avgOf(boxTraits(F, p), TRAITS[kind])) } catch { return 5 }
}

// What MgStage needs to play the call: the engine, its title, the grade, the men, and the snap (the down and distance
// the engine sets up, and the score in its corner)
export function playSetup(F, v, playId) {
  const P = PLAYS[playId], me = ctlFor(F, v, playId)
  const us = TEAM[F.team], opp = TEAM[v.opp]
  const R = rngOf(`${v.seed}-${playId}`)
  let cast = null
  try { cast = momentCast(F, v.opp, me?.i) } catch { cast = null }
  const t = boxTraitsSafe(F, me)
  const situation = {
    us: us.short, them: opp.short, mine: v.mine, opp: v.theirs, clockText: v.clock, period: v.period,
    down: v.down, togo: v.d, toGoal: 100 - v.y, goal: v.goal, los: v.y, call: P.call ?? null, hole: P.hole ?? null, side: R.u() < 0.5 ? -1 : 1, dist: v.d,
    ...(P.kind === 'stop' && { stop: true }),
  }
  return {
    game: P.game, def: { title: P.kind === 'stop' ? `${DOWN[v.down].toUpperCase()} & ${v.goal ? 'GOAL' : v.d}` : P.name.toUpperCase(), rounds: P.kind === 'stop' ? 1 : undefined },
    v: ratingFor(F, me, P.kind), arm: t?.arm ?? ratingFor(F, me, P.kind), pos: P.kind === 'pass' ? 'qb' : P.kind === 'run' ? 'rb' : 'lb',
    me, cast, situation, team: us, opp, home: v.home ? 'team' : 'opp', seed: `${v.seed}-${playId}`,
  }
}
const boxTraitsSafe = (F, p) => { try { return p ? boxTraits(F, p) : null } catch { return null } }

// the receiver a throw went to, from the engine's spot for him (throw.js: X, Z and H the receivers, TE, RB)
const TARGET = { X: 'wr1', Z: 'wr2', H: 'wr3', TE: 'te1', RB: 'rb1' }
// The engine's result → what the snap did: { yards, td, to, inc, sack, oob, call, play, rec | rb | lb (who), played }
export function playResult(F, v, playId, done) {
  const P = PLAYS[playId], raw = done?.raw ?? {}, L = startersOf(F, F.team)
  const R = rngOf(`${v.seed}-${playId}-res`)
  const toGoal = 100 - v.y
  const base = { call: P.kind === 'stop' ? 'run' : P.kind, play: playId, played: true }
  if (P.game === 'fr-pass') {
    const rec = L[TARGET[raw.to]] ?? L.wr1
    if (done.out) return { ...base, yards: -R.int(5, 9), sack: true }
    if (raw.ints) return { ...base, to: 'int', yards: clamp(0, toGoal - 1, raw.at ?? 10), rec: rec?.i }
    if (raw.made || raw.pts) { const y = Math.min(toGoal, raw.gain ?? v.d); return { ...base, yards: y, td: !!raw.pts || y >= toGoal, rec: rec?.i } }
    if (raw.gain != null) return { ...base, yards: Math.min(toGoal - 1, raw.gain), rec: rec?.i }
    return { ...base, yards: 0, inc: true, rec: rec?.i }
  }
  if (P.game === 'fr-fade') {
    const rec = R.u() < 0.6 ? L.wr1 ?? L.te1 : L.te1 ?? L.wr1
    if (done.out) return { ...base, yards: -R.int(5, 8), sack: true }
    return done.hit ? { ...base, yards: toGoal, td: true, rec: rec?.i } : { ...base, yards: 0, inc: true, rec: rec?.i }
  }
  if (P.game === 'fr-run') {
    const y = raw.td ? toGoal : Math.min(toGoal - 1, Math.round(raw.yards ?? 0))
    return { ...base, yards: y, td: !!raw.td, oob: !!raw.oob, rb: ctlFor(F, v, playId)?.i }
  }
  // the stop: their back's run against our backer (a hit stick that jars it loose: the ball's on the ground, and we
  // come up with it about half the time)
  const y = Math.min(toGoal, Math.round(raw.yards ?? 0))
  const lb = ctlFor(F, v, playId)?.i
  if (raw.fumbles && R.u() < 0.55) return { ...base, yards: 0, to: 'fum', lb, stick: 1 }
  return { ...base, yards: y, td: y >= toGoal, lb, stick: raw.hitSticks ? 1 : 0 }
}

// The snap, named the way the broadcast says it, the touchdown's men credited, and the men's lines from it (the
// player's team's men: the box score adds them)
//   "Jared Goff 14-yd pass to Sam LaPorta on 3rd & 9" · "Jahmyr Gibbs 3-yd run" · "Jack Campbell stops Kyren
//   Williams for no gain on 4th & 1" · "Aidan Hutchinson sacks Caleb Williams on 3rd & 7"
export function nameSnap(F, v, out) {
  if (out.txt) return out
  const L = startersOf(F, F.team), O = startersOf(F, v.opp)
  const R = rngOf(`${v.seed}-name`)
  const dd = `on ${DOWN[v.down]} & ${v.goal ? 'goal' : v.d}`
  const y = Math.round(out.yards ?? 0)
  // (st: the player's men's lines from the play; ot: the other team's men's, so both boxes have it)
  const st = {}, ot = {}
  const add = (p, k, n = 1) => { if (p && n) { const x = st[p.i] ??= {}; x[k] = (x[k] ?? 0) + n } }
  const addO = (p, k, n = 1) => { if (p && n) { const x = ot[p.i] ??= {}; x[k] = (x[k] ?? 0) + n } }
  const nm = p => p?.n ?? null
  const themNick = TEAM[v.opp].nick, usNick = TEAM[F.team].nick
  let txt, cr = null
  if (v.ball === 'us') {
    const qb = L.qb1
    if (out.call === 'run') {
      const rb = manOf(F, out.rb) ?? L.rb1 ?? qb
      add(rb, 'ra'); add(rb, 'ry', out.to ? 0 : y)
      if (out.to === 'fum') { const by = O.lb1 ?? O.edge1; txt = `${nm(rb)} fumbles ${dd}, ${themNick} recover`; addO(by, 'tk'); addO(by, 'ff'); addO(by, 'fr') }
      else if (out.td) { txt = `${nm(rb)} ${Math.max(1, y)}-yd run`; cr = [[rb.i, 'rtd']] }
      else txt = y > 0 ? `${nm(rb)} ${y}-yd run ${dd}` : y === 0 ? `${nm(rb)} no gain ${dd}` : `${nm(rb)} ${-y}-yd loss ${dd}`
    } else {
      const pool = ['wr1', 'wr2', 'te1', 'wr3', 'rb1'].map(k => L[k]).filter(Boolean)
      const to = manOf(F, out.rec) ?? pool[Math.floor(R.u() * Math.min(3, pool.length))] ?? qb
      if (out.sack) { const by = O.edge1 ?? O.dt1 ?? O.lb1; txt = `${nm(by) ?? themNick} sacks ${nm(qb)} ${dd}`; add(qb, 'sk'); for (const k of ['sck', 'tk', 'tfl', 'qbh']) addO(by, k) }
      else if (out.to === 'int') { const by = R.u() < 0.6 ? O.cb1 ?? O.s1 : O.s1 ?? O.cb1; txt = `${nm(qb)} pass intercepted by ${nm(by) ?? themNick}`; add(qb, 'pa'); add(qb, 'int'); add(to, 'tg'); addO(by, 'dint') }
      else if (out.inc) { txt = `${nm(qb)} pass incomplete to ${nm(to)} ${dd}`; add(qb, 'pa'); add(to, 'tg') }
      else {
        txt = out.td ? `${nm(qb)} ${Math.max(1, y)}-yd pass to ${nm(to)}` : `${nm(qb)} ${y}-yd pass to ${nm(to)} ${dd}`
        add(qb, 'pa'); add(qb, 'pc'); add(qb, 'py', y); add(to, 'tg'); add(to, 'rc'); add(to, 'ryd', y)
        if (out.td && to !== qb) cr = [[qb.i, 'ptd'], [to.i, 'rctd']]
        else if (out.td) cr = [[qb.i, 'rtd']]
      }
    }
  } else {
    // their run at our backer
    const lb = manOf(F, out.lb) ?? L.lb1 ?? L.lb2 ?? L.s1, rb = O.rb1 ?? O.qb1
    // (their back's carry is on their line; his touchdown is credited to him)
    addO(rb, 'ra'); addO(rb, 'ry', out.to ? 0 : y)
    if (out.to === 'fum') { txt = `${nm(lb)} forces a fumble by ${nm(rb)} ${dd}, ${usNick} recover`; add(lb, 'tk'); add(lb, 'ff'); add(lb, 'fr') }
    else if (out.td) { txt = `${nm(rb)} ${Math.max(1, y)}-yd run`; if (rb) cr = [[rb.i, 'rtd']] }
    else if (y < v.d) { txt = y < 0 ? `${nm(lb)} stops ${nm(rb)} for a ${-y}-yd loss ${dd}` : y === 0 ? `${nm(lb)} stops ${nm(rb)} for no gain ${dd}` : `${nm(lb)} stops ${nm(rb)} after ${y} ${y === 1 ? 'yard' : 'yards'} ${dd}`; add(lb, 'tk'); if (y < 0) add(lb, 'tfl') }
    else txt = `${nm(rb)} ${y}-yd run ${dd}`
  }
  return { ...out, txt, ...(cr && { cr }), st, ot }
}
// the stamp on a snap, the player's side of it
export function snapWord(v, m) {
  const off = v.ball === 'us'
  if (m.to) return off ? (m.to === 'int' ? 'INTERCEPTED' : 'FUMBLE') : 'TURNOVER'
  if (m.td) return 'TOUCHDOWN'
  const first = (m.yards ?? 0) >= v.d
  if (off) return first ? 'FIRST DOWN' : m.sack ? 'SACKED' : m.inc ? 'INCOMPLETE' : v.down === 4 ? 'TURNOVER ON DOWNS' : 'SHORT'
  return first ? 'FIRST DOWN' : v.down === 4 ? 'TURNOVER ON DOWNS' : 'STOPPED'
}
