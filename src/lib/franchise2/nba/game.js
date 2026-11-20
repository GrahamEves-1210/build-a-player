// NBA FRANCHISE: one game, possession by possession (part C: the court). Fast (a full game is about 200 possessions,
// well under a millisecond each) and seeded: the same seed and the same two rosters play the same game.
//
// Each possession: the clock runs about 14 seconds (a modern NBA pace of ~99-100 a team), the ball goes to a man by
// his usage (how much of the offense runs through him), and he turns it over, draws a foul or shoots: a three, a shot
// at the rim or a mid-range jumper, by his game. The make is his skill against the five guarding him. A miss is
// blocked now and then and rebounded by the men on the floor (about a quarter of misses go back to the offense). A
// make is assisted about six times in ten, by whoever on the floor passes best. Every point moves the +/- of the ten
// men on the floor. Home court is worth about 2.5 points.
//
// The rotation (rotation.js) is the plan; the game moves off it like a real one: two fouls in the first quarter
// (three in the second, four in the third, five early in the fourth) sit a man, six put him out, a blowout empties
// the bench, a close fourth quarter and overtime go to the closers.
//
// The seam (nba/STATE.md):
//   simGame(F, home, away, { seed, playoff, b2b }) -> Res   the whole game, tonight's men (hurt and resting men sit)
//   startGame(F, home, away, opts) -> G · playTo(G, secondsLeft) · possession(G, short, outcome) · finishGame(G) -> Res
//       the same game in steps, for key moments: playTo sims until that much is left in the fourth (or an overtime),
//       possession() plays one possession with the moment's result, finishGame sims the rest. The outcome:
//       { pts: 0..4, by: manId, ast?: manId, kind?: 'three'|'rim'|'mid'|'pnr'|'iso'|'read'|'ft', tov?: bool, t?: seconds }
//       (pts 3 or 4 is a three, 4 an and-one; 1 or 2 with kind 'ft' free throws; 0 a miss, the board left to the sim)
//       clutchTime(G) (the last five minutes of the fourth or overtime, within five) and G.sc / G.clock / G.per help
//       pick the spots.
//   Res = { hs, as, ot, box: { [short]: [Line] }, q: [[h1, a1], ...], lc (lead changes), big: { h, a } (largest leads) }
//   Line = { i, min, pts, reb, oreb, ast, stl, blk, tov, pf, fgm, fga, tpm, tpa, ftm, fta, pm, st, cp } (cp: clutch points)
// Lower level (the checks use these): newGame(G) · run(S, { stop }) · play(S, forced) · finish(S) · playGame(G)
//   G = { seed, po, home: { short, men, set }, away } (set: rotation.js planRotation's { st, order, min })
import { rngOf } from '../rng'
import { prof } from './skills'
import { planRotation, dressed, setOf } from './rotation'

// ── The league's dials (calibrated against the 2024-25 season, scripts/franchise2/nba/calib.mjs) ─────────────────
export const TUNE = {
  pace: 13.6,            // seconds a possession (before offensive rebounds)
  tov: 0.136,             // turnovers a possession, an average handler against an average defense
  stealShare: 0.56,       // turnovers that are steals (8.2 of 14.4)
  foulNS: 0.09,          // a non-shooting foul on the defense, a possession (two shots in the bonus)
  usage: 0.108,            // how hard the ball finds the creators (the weight is exp(usage * (off - 6)))
  three: 0.5, rimBase: 0.6,   // the shot mix, an average player
  p3: 0.335, pRim: 0.595, pMid: 0.39,   // makes, an average shooter against an average defense
  skill3: 0.017, skillRim: 0.021, skillMid: 0.017,
  def3: 0.014, defRim: 0.025, defMid: 0.012,
  foulRim: 0.22, foulMid: 0.05, foul3: 0.014, andOne: 0.055,
  oreb: 0.228, blkRim: 0.34, blkMid: 0.07, blk3: 0.015,
  ast: { three: 0.82, rim: 0.56, mid: 0.4 },
  home: 0.012,            // the home team's make, every shot (about 2.5 points a game)
}
const Q = 720, OT = 300, STINT = 120

const line = () => ({ sec: 0, pts: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, pm: 0, gs: 0, cp: 0 })
const other = s => (s === 'h' ? 'a' : 'h')
const mean = (a, f) => a.reduce((s, x) => s + f(x), 0) / (a.length || 1)

function side(T, home) {
  const men = (T.men ?? []).filter(p => !(p.inj?.g > 0))
  const pr = new Map(men.map(p => [p.i, prof(p)]))
  const rot = planRotation(men, T.set ?? {})
  const by = new Map(men.map(p => [p.i, p]))
  return { short: T.short, men, by, pr, rot, floor: [], home, fouls: 0, out: new Set() }
}

export function newGame(G) {
  const R = rngOf(`nba-game-${G.seed}`)
  const S = { R, po: !!G.po, per: 1, clock: Q, el: 0, sc: { h: 0, a: 0 }, q: { h: [0], a: [0] }, box: {}, lc: 0, big: { h: 0, a: 0 }, last: null, done: false, stop: null, next: STINT }
  S.h = side(G.home, true); S.a = side(G.away, false)
  for (const k of ['h', 'a']) for (const p of S[k].men) S.box[p.i] = line()
  S.poss = R.u() < 0.5 ? 'h' : 'a'     // the tip
  S.tip = S.poss
  lineup(S, 'h', true); lineup(S, 'a', true)
  for (const k of ['h', 'a']) { for (const id of S[k].floor) S.box[id].gs = 1; S[k].st = [...S[k].floor] }
  return S
}

// ── Who's on the floor ─────────────────────────────────────────────────────────
export const clutchTime = S => (S.per >= 4 && S.clock <= 300 && Math.abs(S.sc.h - S.sc.a) <= 5)
export const lead = (S, k) => S.sc[k] - S.sc[other(k)]
const trouble = (S, b) => (S.per <= 3 ? b.pf >= S.per + 1 : S.per === 4 ? b.pf >= 5 && S.clock > 240 : false)
function lineup(S, k, start = false) {
  const T = S[k], L = T.rot
  const avail = T.men.filter(p => S.box[p.i].pf < 6 && !T.out.has(p.i))
  const margin = lead(S, k), left = S.per >= 4 ? S.clock : 99999
  const absM = Math.abs(margin)
  const garbage = !S.po && S.per >= 4 && ((absM >= 30) || (absM >= 22 && left <= 540) || (absM >= 17 && left <= 300)) || S.po && S.per >= 4 && absM >= 25 && left <= 360
  const close = (S.per >= 4 && left <= 330 && absM <= 12) || S.per > 4
  const ok = p => !trouble(S, S.box[p.i]) || (S.per >= 4 && left <= 360)
  let pick
  if (garbage) {
    // the end of the bench: the men who don't play much go in, the starters sit
    pick = [...avail].sort((a, b) => (L.min[a.i] ?? 0) - (L.min[b.i] ?? 0)).filter(p => (L.min[p.i] ?? 0) < 26).slice(0, 5)
  } else if (close) {
    pick = L.closers.map(id => T.by.get(id)).filter(p => p && avail.includes(p) && ok(p))
  } else if (start && (S.per === 1 || S.per === 3)) {
    pick = L.st.map(id => T.by.get(id)).filter(p => p && avail.includes(p) && ok(p))
  } else {
    // the coach's plan: who is furthest behind his minutes by the next whistle (a man on the floor gets a minute's
    // grace, so stints run six to ten minutes, not two)
    const total = S.po ? 2880 : 2880, upTo = Math.min(total, S.el + STINT)
    const need = p => (L.min[p.i] ?? 0) * 60 * (S.po ? 1.04 : 1) * upTo / total - S.box[p.i].sec + (T.floor.includes(p.i) ? 50 : 0)
    pick = avail.filter(p => ok(p) && (L.min[p.i] ?? 0) > 0).sort((a, b) => need(b) - need(a)).slice(0, 5)
  }
  // short (fouls, injuries): the next men in the plan, then anyone
  for (const id of L.order) { const p = T.by.get(id); if (pick.length < 5 && p && avail.includes(p) && !pick.includes(p) && ok(p)) pick.push(p) }
  for (const p of avail) if (pick.length < 5 && !pick.includes(p)) pick.push(p)
  // the shape: no more than three bigs (small ball is fine: a team with one real big doesn't play him 48)
  const bigs = () => pick.filter(p => T.pr.get(p.i).big)
  const bench = avail.filter(p => !pick.includes(p))
  while (bigs().length > 3) {
    const g = bench.filter(p => !T.pr.get(p.i).big).sort((a, b) => (L.min[b.i] ?? 0) - (L.min[a.i] ?? 0))[0]; if (!g) break
    const b = bigs().sort((x, y) => (L.min[x.i] ?? 0) - (L.min[y.i] ?? 0))[0]
    pick.splice(pick.indexOf(b), 1, g); bench.splice(bench.indexOf(g), 1, b)
  }
  T.floor = pick.slice(0, 5).map(p => p.i)
  T.on = T.floor.map(id => T.pr.get(id))
}

// ── Scoring ─────────────────────────────────────────────────────────────────────
function score(S, k, pts, who) {
  const before = S.sc.h - S.sc.a
  S.sc[k] += pts
  S.q[k][S.q[k].length - 1] += pts
  for (const id of S[k].floor) S.box[id].pm += pts
  for (const id of S[other(k)].floor) S.box[id].pm -= pts
  const after = S.sc.h - S.sc.a
  if (before !== 0 && Math.sign(after) !== 0 && Math.sign(after) !== Math.sign(before)) S.lc++
  S.big.h = Math.max(S.big.h, after); S.big.a = Math.max(S.big.a, -after)
  if (who != null && S.per >= 4 && S.clock <= 300 && Math.abs(before) <= 5) S.box[who].cp += pts
}
function wpick(R, list, w) { let t = 0; for (const x of w) t += x; let r = R.u() * t; for (let i = 0; i < list.length; i++) { r -= w[i]; if (r < 0) return list[i] } return list[list.length - 1] }

function freeThrows(S, k, who, n, force = null) {
  const b = S.box[who], ft = S[k].pr.get(who).ft + (S[k].home ? 0.006 : 0)
  let made = 0, lastIn = false
  for (let j = 0; j < n; j++) { b.fta++; lastIn = force != null ? j < force : S.R.u() < ft; if (lastIn) { b.ftm++; made++ } }
  if (made) { b.pts += made; score(S, k, made, who) }
  return lastIn   // (did the last one go: a miss is a live rebound)
}
function foulOn(S, d, kind = 'shoot') {
  const T = S[d]
  // who fouls: the bigs at the rim, anyone on the perimeter; a careless defender more than a smart one
  // (a man in foul trouble plays it safe: he stops reaching and doesn't contest the drive the same way)
  const w = T.on.map((s, j) => { const pf = S.box[T.floor[j]].pf; return (kind === 'rim' ? (s.big ? 1.15 : 0.95) : 1) * (1.1 - s.iq * 0.015) * (pf >= 5 ? 0.35 : pf >= 4 ? 0.55 : pf >= 3 ? 0.8 : 1) })
  const id = wpick(S.R, T.floor, w)
  S.box[id].pf++
  T.fouls++
  if (S.box[id].pf >= 6) { T.out.add(id); lineup(S, d) }   // fouled out
  else if (trouble(S, S.box[id])) S.subDue = true
  return id
}

// a miss: blocked or not, then the board
function miss(S, k, shooterId, shot) {
  const d = other(k), D = S[d], O = S[k]
  const pBlk = shot === 'rim' ? TUNE.blkRim : shot === 'mid' ? TUNE.blkMid : TUNE.blk3
  const blkW = D.on.map(s => Math.max(0.05, s.blk) ** 2.2)
  if (shot !== 'ft' && S.R.u() < pBlk * mean(D.on, s => Math.max(0.3, s.blk)) / 4) S.box[wpick(S.R, D.floor, blkW)].blk++
  // the board: the offense's men on the glass against the defense's (a long three caroms long: the guards get more)
  const oR = mean(O.on, s => s.reb), dR = mean(D.on, s => s.reb)
  const pO = Math.min(0.4, Math.max(0.06, (shot === 'ft' ? 0.13 : TUNE.oreb) + (oR - dR) * 0.025))
  if (S.R.u() < pO) {
    const w = O.on.map((s, j) => (O.floor[j] === shooterId ? 0.55 : 1) * Math.max(0.2, s.reb) ** 1.3 * (shot === 'three' && !s.big ? 1.3 : 1))
    const id = wpick(S.R, O.floor, w)
    S.box[id].orb++
    return id
  }
  // (about one miss in eight is a team rebound: out of bounds, a quarter's last shot; nobody's credited)
  if (S.R.u() < 0.12) return null
  const w = D.on.map(s => Math.max(0.2, s.reb) ** 1.2 * (shot === 'three' && !s.big ? 1.25 : 1))
  S.box[wpick(S.R, D.floor, w)].drb++
  return null
}

// one shot by `who`; returns the offensive rebounder's id on a live miss, or null when the possession is over
function shoot(S, k, who, forced = null) {
  const O = S[k], D = S[other(k)], s = O.pr.get(who), b = S.box[who]
  const R = S.R
  let shot = forced?.shot
  if (!shot) {
    const f3 = Math.min(0.6, Math.max(0.02, TUNE.three + 0.03 * (s.sh - 6) - (s.big ? 0.15 : 0) - 0.02 * (s.fin - 6) - (s.sh < 3.5 ? 0.15 : 0)))
    const fRim = Math.min(0.85, Math.max(0.25, TUNE.rimBase + 0.045 * (s.fin - 6) + (s.big ? 0.14 : 0) - 0.025 * (s.sh - 6)))
    const x = R.u()
    shot = x < f3 ? 'three' : x < f3 + (1 - f3) * fRim ? 'rim' : 'mid'
  }
  const dPer = mean(D.on, t => t.perD) - 6
  const dInt = Math.max(...D.on.map(t => t.intD)) * 0.55 + mean(D.on, t => t.intD) * 0.45 - 6.2
  const cl = S.per >= 4 && S.clock <= 300 && Math.abs(S.sc.h - S.sc.a) <= 5 ? 0.008 * (s.clu - 6) : 0
  const home = O.home ? TUNE.home : 0
  let p, pFoul
  // (the very top of the scale pays less: an 11 shooter is great, not automatic; it keeps a star near 30 a night, not 37)
  const sh = s.sh <= 8 ? s.sh : 8 + (s.sh - 8) * 0.6, fin = s.fin <= 8 ? s.fin : 8 + (s.fin - 8) * 0.6
  if (shot === 'three') { p = TUNE.p3 + TUNE.skill3 * (sh - 6) - TUNE.def3 * dPer; pFoul = TUNE.foul3 }
  else if (shot === 'rim') { p = TUNE.pRim + TUNE.skillRim * (fin - 6) + 0.006 * (s.size - 6) - TUNE.defRim * dInt; pFoul = TUNE.foulRim * (1 + 0.04 * (s.fin - 6)) }
  else { p = TUNE.pMid + TUNE.skillMid * (sh - 6) - TUNE.defMid * dPer; pFoul = TUNE.foulMid }
  p = Math.min(0.85, Math.max(0.1, p + home + cl + 0.004 * (s.iq - 6)))
  const pts = shot === 'three' ? 3 : 2
  // fouled on the shot: a miss is two (three) free throws, a make an and-one now and then
  const fouled = forced ? !!forced.foul : R.u() < pFoul
  const made = forced ? !!forced.made : R.u() < (fouled ? p * 0.55 : p)
  if (fouled && !made) {
    foulOn(S, other(k), shot)
    const last = freeThrows(S, k, who, pts)
    return last ? null : miss(S, k, who, 'ft')
  }
  b.fga++; if (shot === 'three') b.tpa++
  if (made) {
    b.fgm++; b.pts += pts; if (shot === 'three') b.tpm++
    // the pass that set it up: whoever on the floor passes best, most often
    if (forced?.ast != null && O.floor.includes(forced.ast) && forced.ast !== who) S.box[forced.ast].ast++
    else if (forced?.ast === undefined && R.u() < TUNE.ast[shot]) {
      const mates = O.floor.filter(id => id !== who)
      const w = mates.map(id => { const t = O.pr.get(id); return Math.max(0.3, t.pas) ** 2.2 * (0.6 + t.iq * 0.06) })
      S.box[wpick(R, mates, w)].ast++
    }
    score(S, k, pts, who)
    if (fouled || (!forced && shot === 'rim' && R.u() < TUNE.andOne)) {
      foulOn(S, other(k), shot)
      if (!freeThrows(S, k, who, 1, forced?.ft1 != null ? (forced.ft1 ? 1 : 0) : null)) return miss(S, k, who, 'ft')
    }
    return null
  }
  return miss(S, k, who, shot)
}

// the possession's man: the usage weights of the five on the floor
function actor(S, k) {
  const O = S[k]
  const w = O.on.map(s => Math.exp(TUNE.usage * (s.off - 6)) * (s.big ? 0.9 : 1))
  return wpick(S.R, O.floor, w)
}

// One possession (forced: a key moment's result, in the engine's terms: { who, shot, made, foul } · { who, tov } · { who, ft, made })
export function play(S, forced = null) {
  if (S.done) return S
  const k = S.poss, d = other(k), O = S[k], D = S[d], R = S.R
  if (S.subDue) { S.subDue = false; lineup(S, k); lineup(S, d) }
  let t = forced?.t ?? Math.max(4, TUNE.pace + (R.u() - 0.5) * 12 + (O.pace ?? 0))
  // the end of a quarter: a last shot as it runs out (a heave from deep with under three seconds)
  const last = t >= S.clock
  if (last) t = S.clock
  let who = forced?.who ?? actor(S, k)
  if (!O.floor.includes(who)) who = actor(S, k)
  const s = O.pr.get(who)
  let reb = null
  if (forced?.tov || (!forced && !last && R.u() < TUNE.tov * (1 + 0.06 * (6 - s.hnd) + 0.05 * (6 - s.iq)) * (1 + 0.04 * (mean(D.on, x => x.stl) - 5.5)))) {
    S.box[who].tov++
    if (R.u() < TUNE.stealShare) S.box[wpick(R, D.floor, D.on.map(x => Math.max(0.2, x.stl) ** 1.5))].stl++
  } else if (forced?.ft) {
    foulOn(S, d)
    let made = 0
    for (let j = 0; j < forced.ft; j++) { S.box[who].fta++; if (j < (forced.made ?? 0)) { S.box[who].ftm++; made++ } }
    if (made) { S.box[who].pts += made; score(S, k, made, who) }
  } else if (!forced && !last && R.u() < TUNE.foulNS) {
    // a foul away from the ball: the bonus (five team fouls in the quarter) is two shots, otherwise the ball inbounded
    foulOn(S, d, 'off')
    if (D.fouls >= 5) { const l = freeThrows(S, k, who, 2); if (!l) reb = miss(S, k, who, 'ft') }
    else { tick(S, t * 0.4); return play(S) }
  } else {
    reb = shoot(S, k, who, forced && (forced.shot || forced.made != null) ? forced : null)
    // offensive boards: a putback or a reset, five or six seconds more
    let n = 0
    while (reb != null && n++ < 4) {
      const extra = 3 + R.u() * 6
      if (S.clock - t - extra <= 0) break
      t += extra
      const putback = O.pr.get(reb).big && R.u() < 0.45
      const next = putback ? reb : actor(S, k)
      reb = shoot(S, k, next, putback ? { shot: 'rim', made: R.u() < Math.min(0.8, 0.6 + 0.02 * (O.pr.get(reb).fin - 6)), foul: R.u() < 0.1 } : null)
    }
  }
  tick(S, t)
  S.poss = d
  return S
}

// the clock: minutes for the ten men, the whistle for subs, the end of a period
function tick(S, t) {
  S.clock -= t; S.el += t
  for (const k of ['h', 'a']) for (const id of S[k].floor) S.box[id].sec += t
  if (S.clock <= 0.01) endPeriod(S)
  else if (S.el >= S.next) { S.next += STINT; lineup(S, 'h'); lineup(S, 'a') }
}
function endPeriod(S) {
  if (S.per >= 4 && S.sc.h !== S.sc.a) { S.done = true; return }
  S.per++
  S.clock = S.per > 4 ? OT : Q
  S.q.h.push(0); S.q.a.push(0)
  S.h.fouls = 0; S.a.fouls = 0
  // the second and fourth quarters: the team that lost the tip; the third: the one that won it
  // (the tip's loser has the ball to start the second and third, its winner the fourth; overtime is a new jump ball)
  S.poss = S.per <= 3 ? other(S.tip) : S.per === 4 ? S.tip : S.R.u() < 0.5 ? 'h' : 'a'
  S.next = S.el + STINT
  lineup(S, 'h', true); lineup(S, 'a', true)
}

export function run(S, { stop = null } = {}) {
  S.stop = null
  let guard = 0
  while (!S.done && guard++ < 2000) {
    if (stop) { const why = stop(S); if (why) { S.stop = why; return S } }
    play(S)
  }
  return S
}

const KEYS = ['pts', 'orb', 'drb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta']
export function teamTotals(S, k) {
  const t = Object.fromEntries(KEYS.map(x => [x, 0]))
  for (const p of S[k].men) { const b = S.box[p.i]; for (const x of KEYS) t[x] += b[x] }
  return t
}
export function finish(S) {
  const box = {}
  for (const k of ['h', 'a']) for (const p of S[k].men) { const b = S.box[p.i]; b.sec = Math.round(b.sec); box[p.i] = b }
  return {
    h: S.h.short, a: S.a.short, hs: S.sc.h, as: S.sc.a, ot: Math.max(0, S.per - 4), q: S.q, box,
    team: { h: teamTotals(S, 'h'), a: teamTotals(S, 'a') }, st: { h: S.h.st, a: S.a.st }, ids: { h: S.h.men.map(p => p.i), a: S.a.men.map(p => p.i) },
    lc: S.lc, big: S.big, w: S.sc.h > S.sc.a ? 'h' : 'a', po: S.po,
  }
}
export function playGame(G) { return finish(run(newGame(G))) }

// ── The seam (STATE.md) ────────────────────────────────────────────────────────
const sideOf = (F, s) => ({ short: s, men: dressed(F.teams[s]), set: setOf(F.teams[s]) })
export function startGame(F, home, away, { seed = null, playoff = false } = {}) {
  return newGame({ seed: seed ?? `${F.seed}-${F.year}-${F.day}-${home}-${away}`, po: playoff, home: sideOf(F, home), away: sideOf(F, away) })
}
export const playTo = (G, left = 0) => run(G, { stop: S => S.per >= 4 && S.clock <= left + 0.01 })
// a moment's possession, in the moment's terms (the header)
export function possession(G, short, o = {}) {
  if (G.done) return G
  const k = G.h.short === short ? 'h' : 'a', T = G[k]
  G.poss = k
  let who = o.by != null && T.by.has(o.by) ? o.by : null
  // the moment's man is on the floor: in for the man playing the fewest minutes tonight
  if (who != null && !T.floor.includes(who)) {
    const out = [...T.floor].sort((x, y) => (T.rot.min[x] ?? 0) - (T.rot.min[y] ?? 0))[0]
    T.floor[T.floor.indexOf(out)] = who; T.on = T.floor.map(id => T.pr.get(id))
  }
  // (and the man who set it up)
  if (o.ast != null && o.ast !== who && T.by.has(o.ast) && !T.floor.includes(o.ast)) {
    const out = [...T.floor].filter(id => id !== who).sort((x, y) => (T.rot.min[x] ?? 0) - (T.rot.min[y] ?? 0))[0]
    T.floor[T.floor.indexOf(out)] = o.ast; T.on = T.floor.map(id => T.pr.get(id))
  }
  const t = o.t ?? (o.kind === 'ft' ? 4 : 12)
  const pts = o.pts ?? 0
  const shot = o.kind === 'three' || pts >= 3 ? 'three' : o.kind === 'mid' ? 'mid' : 'rim'
  const ast = o.ast === undefined ? undefined : o.ast
  let forced
  if (o.tov) forced = { who, tov: true, t }
  else if (o.kind === 'ft') forced = { who, ft: Math.max(2, pts), made: pts, t }
  else if (pts === 1) forced = { who, ft: 2, made: 1, t }
  else forced = { who, shot, made: pts > 0, foul: pts === 4 || (pts === 3 && shot !== 'three'), ft1: pts === 4 || (pts === 3 && shot !== 'three') ? true : null, ast, t }
  if (who == null) delete forced.who
  return play(G, forced)
}
export function toRes(r) {
  const out = {}
  for (const k of ['h', 'a']) out[r[k]] = r.ids[k].map(i => {
    const b = r.box[i]
    return { i, min: Math.round(b.sec / 60), pts: b.pts, reb: b.orb + b.drb, oreb: b.orb, ast: b.ast, stl: b.stl, blk: b.blk, tov: b.tov, pf: b.pf, fgm: b.fgm, fga: b.fga, tpm: b.tpm, tpa: b.tpa, ftm: b.ftm, fta: b.fta, pm: b.pm, st: !!b.gs, cp: b.cp }
  })
  return { hs: r.hs, as: r.as, ot: r.ot, box: out, q: r.q.h.map((x, j) => [x, r.q.a[j]]), lc: r.lc, big: r.big }
}
export const finishGame = G => toRes(finish(run(G)))
export const simGame = (F, home, away, opts = {}) => finishGame(startGame(F, home, away, opts))
