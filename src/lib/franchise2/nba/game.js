// NBA FRANCHISE: one game, possession by possession (part C: the court). Fast (a full game is about 200 possessions,
// well under a millisecond each) and seeded: the same seed and the same two rosters play the same game.
//
// Each possession: the clock runs about 14 seconds (a modern NBA pace of ~99-100 a team), the ball goes to a man by
// his usage (how much of the offense runs through him), and he turns it over, draws a foul or shoots: a three, a shot
// at the rim or a mid-range jumper, by his game. The make is his skill against the five guarding him. A miss is
// blocked now and then and rebounded by the men on the floor (about a quarter of misses go back to the offense). A
// make is assisted about six times in ten, by whoever on the floor passes best. Every point moves the +/- of the ten
// men on the floor. Home court is worth about 2.5 points. The score pulls a little (TUNE.lead: a team well ahead eases
// off, more so in a close fourth quarter's last minutes; past 20 points more again, TUNE.leadBig, and the team ahead
// sits its starters, TUNE.restAt), and the last two minutes of a close game run on the score and the clock (endgame:
// the fouls to stop it, the clock run down or out, the last shot held, the three to tie: early when there's time), so
// games end 12 apart on average, three in ten within five, one in twenty in overtime, 60-70 a season by 30 or more.
// The playoffs (TUNE.po): nobody eases off, the ball goes to the stars more, the crowd counts a bit more.
// Who gets the assists and the boards goes by role (role(): TUNE.ast*, TUNE.reb*), who gets the shots by TUNE.usage*:
// about 140 triple-doubles a season, 40 men at 20 points a game, a dozen or so at 25.
//
// The rotation (rotation.js) is the plan; the game moves off it like a real one: two fouls in the first quarter
// (three in the second, four in the third, five early in the fourth) sit a man, six put him out (the last man to foul
// out stays in when there's nobody left), a blowout empties the bench, a close fourth quarter and overtime go to the
// closers, and every five on the floor is shaped like a lineup (rotation.js reshape: no five guards, no 3 PGs and a big).
//
// The seam (nba/STATE.md):
//   simGame(F, home, away, { seed, playoff, b2b }) -> Res   the whole game, tonight's men (hurt and resting men sit)
//   startGame(F, home, away, opts) -> G · playTo(G, secondsLeft) · possession(G, short, outcome) · finishGame(G) -> Res
//       the same game in steps, for key moments: playTo sims until that much is left in the fourth (or an overtime),
//       possession() plays one possession with the moment's result, finishGame sims the rest. The outcome:
//       { pts: 0..4, by: manId, ast?: manId, kind?: 'three'|'rim'|'mid'|'pnr'|'iso'|'read'|'ft', tov?: bool, t?: seconds }
//       (pts 3 or 4 is a three, 4 an and-one; 1 or 2 with kind 'ft' free throws; 0 a miss, the board left to the sim)
//       G is plain JSON (no F inside, ~10 KB: the men's grades, the box so far, the dice's state), so core can keep it
//       in F.pend and pick it up after a reload; G.hs / G.as are the score so far, G.per / G.clock the time.
//       clutchTime(G) (the last five minutes of the fourth or overtime, within five) and G.sc / G.clock / G.per help
//       pick the spots.
//   Res = { hs, as, ot, box: { [short]: [Line] }, q: [[h1, a1], ...], lc (lead changes), big: { h, a } (largest leads) }
//   Line = { i, min, pts, reb, oreb, ast, stl, blk, tov, pf, fgm, fga, tpm, tpa, ftm, fta, pm, st, cp } (cp: clutch points)
//       every man on the roster has a line; the box's minutes add up to 240 (265 an overtime, toRes boxMinutes). One
//       who didn't play: min 0, the stats 0, dnp: 'cd' (dressed, coach's decision) | 'inj' (k: the injury) | 'rest' |
//       'tw' (a two-way man not with the team; k: 'G League' | '50-game limit' | 'not eligible for the playoffs')
//   Res.ff: the team that forfeited (nobody to play: 2-0; season.js keeps rosters at 13+, so it doesn't happen)
// Lower level (the checks use these): newGame(G) · run(S, { stop }) · play(S, forced) · finish(S) · playGame(G)
//   G = { seed, po, home: { short, men, set }, away } (set: rotation.js planRotation's { st, order, min })

// ── The game state is plain JSON (core saves it in F.pend while a moment is up): the dice keep their state in S.rs,
// and the lookups (by id, the men's skills, the five on the floor) are rebuilt from it whenever a call comes in (hot)
function hashSeed(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  return h >>> 0
}
const hidden = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true })
function hot(S) {
  if (!S.R) hidden(S, 'R', { u: () => { const a = S.rs = (S.rs + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } })
  for (const k of ['h', 'a']) {
    const T = S[k]; if (!T || T.by) continue
    hidden(T, 'by', new Map(T.men.map(p => [p.i, p])))
    hidden(T, 'pr', new Map(T.men.map(p => [p.i, role(prof(p), p)])))
    T.on = T.floor.map(id => T.pr.get(id))
  }
  return S
}
import { prof } from './skills'
// a man's share of his team's assists and boards, from his skills and the spot he plays (TUNE.ast*, TUNE.reb*): the
// ball is in the point guard's hands, the glass belongs to the bigs; a wing who passes or rebounds well still gets
// his, but not a point guard's assists and a center's boards at once
function role(s, p) {
  const sp = p.sp ?? (s.big ? 4 : 1)
  s.aw = Math.max(0.3, s.pas) ** TUNE.astExp * Math.max(0.3, 1 + TUNE.astIq * (s.iq - 6)) * (TUNE.astSpot[sp] ?? 1) * Math.max(0.3, 1 + TUNE.astHnd * (s.hnd - 6)) * Math.max(0.3, 1 + TUNE.astOff * (s.off - 6))
  const r = Math.max(0.2, s.reb)
  s.dw = r ** TUNE.rebExpD * (s.big ? 1 : TUNE.rebWing)
  s.ow = r ** TUNE.rebExpO * (s.big ? 1 : TUNE.rebWing)
  s.r3 = s.big ? 1 : TUNE.reb3
  return s
}

// ── The scoring log (game day's play-by-play, NbaGame.jsx): every basket and trip to the line, and every foul (the
// team fouls and the bonus), with the clock. It never rolls the dice (the game plays the same with it or without it)
// and it's kept off the saved state: a hidden field on the game, so F.pend doesn't carry it and a game picked up after
// a reload simply has none. A finished game's log stays in memory for the screens, the last few games (eventsOf).
//   { p: period, c: seconds left in it, k: 'h'|'a', w: man, y: 'three'|'rim'|'mid'|'ft'|'f', a?: assist, pb?: putback,
//     n/of: free throws made/taken, hs/as: the score after it, tf: the fouling team's fouls in the period }
const LOGS = new Map()
const logKey = (h, a, qh, qa) => `${h}|${a}|${qh.join('.')}|${qa.join('.')}`
function ev(S, x) { if (S.EV) S.EV.push({ p: S.per, ...x, hs: S.sc.h, as: S.sc.a }) }
function stamp(S, from, clock) { if (S.EV) for (let j = from; j < S.EV.length; j++) if (S.EV[j].c == null) S.EV[j].c = Math.max(0, Math.round(clock * 10) / 10) }
let PB = false   // (the shot being played is a putback)
// a finished game's log, by its box (F.box[i]: { h, a, q: [[h, a], ...] }); the log of a game still going (F.pend.G)
export const eventsOf = b => (b?.q ? LOGS.get(logKey(b.h, b.a, b.q.map(x => x[0]), b.q.map(x => x[1]))) ?? null : null)
export const logOf = G => G?.EV ?? null
import { planRotation, dressed, setOf, reshape, spotOf, twGames, TW_GAMES } from './rotation'
import { coachSide } from './coach'

// ── The league's dials (calibrated against the 2024-25 season, scripts/franchise2/nba/calib.mjs) ─────────────────
export const TUNE = {
  pace: 13.6,            // seconds a possession (before offensive rebounds)
  tov: 0.136,             // turnovers a possession, an average handler against an average defense
  stealShare: 0.56,       // turnovers that are steals (8.2 of 14.4)
  foulNS: 0.09,          // a non-shooting foul on the defense, a possession (two shots in the bonus)
  // how hard the ball finds the creators: the weight is exp(usage * (off - 6)) up to the knee, where a first or
  // second option sits; past it the slope is usage * usageTop (a star's share of the shots has a ceiling), and under
  // 6 it is usage * usageLo. About 40 men average 20, a dozen or so 25, two or three 30.
  usage: 0.24, usageKnee: 7.3, usageTop: 0.1, usageLo: 0.75, usageBig: 0.9,
  // the assist's man: his passing (to a power), his head, how much of the offense runs through him, and his spot
  // (PG..C: the ball is in the guards' hands). A point guard leads the league near 11; a forward or a center who
  // passes gets 5 to 8, and only the very best passer among them 9 or 10.
  astExp: 1.4, astSpot: [1.15, 1, 0.8, 0.68, 0.68], astIq: 0.12, astHnd: 0, astOff: 0.12,
  // the board's man: his rebounding (to a power), a wing's share against a big's, a long carom off a three
  rebExpD: 1.02, rebExpO: 1.2, rebWing: 0.87, reb3: 1.15,
  three: 0.5, rimBase: 0.6,   // the shot mix, an average player
  p3: 0.332, pRim: 0.59, pMid: 0.385,   // makes, an average shooter against an average defense
  skill3: 0.017, skillRim: 0.021, skillMid: 0.017,
  def3: 0.014, defRim: 0.025, defMid: 0.012,
  foulRim: 0.22, foulMid: 0.05, foul3: 0.014, andOne: 0.055,
  oreb: 0.228, blkRim: 0.34, blkMid: 0.07, blk3: 0.015,
  ast: { three: 0.82, rim: 0.56, mid: 0.4 },
  home: 0.012,            // the home team's make, every shot (about 2.5 points a game)
  lead: 0.0012, leadCap: 20,   // the score's pull: each point of lead off the leader's make (to 20 points)
  // past 20 the game is decided and both teams play like it: each point more of lead, this much more off the leader's
  // make (to 60 points); restAt: the lead that sits the leader's starters (lineup()); slack: a decided fourth quarter
  // (22 apart), nobody guards anybody, every shot this much likelier. A season has 60-70 games decided by 30 or more
  // and 10-15 by 40 or more; a team's worst night is in the 60s.
  leadBig: 0.001, leadBigCap: 60, restAt: 27, slack: 0.03,
  lead4: 0.009, lateT: 360,    // and more in a close fourth quarter's last minutes (the leader slows it down, the other team pushes)
  // the playoffs: nobody eases off, the ball goes to the stars more, the crowd counts a bit more
  po: { lead: 0.0006, lead4: 0.006, leadBig: 0.0006, usage: 0.25, usageTop: 0.4, home: 0.016 },
}
const tn = (S, k) => (S.po && TUNE.po?.[k] != null ? TUNE.po[k] : TUNE[k])
const Q = 720, OT = 300, STINT = 120

const line = () => ({ sec: 0, pts: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, pm: 0, gs: 0, cp: 0 })
const other = s => (s === 'h' ? 'a' : 'h')
const mean = (a, f) => a.reduce((s, x) => s + f(x), 0) / (a.length || 1)

function side(T, home, po = false) {
  const men = (T.men ?? []).filter(p => !(p.inj?.g > 0) || T.hurtOk).map(p => ({ i: p.i, p: p.p, g: p.g, a: { ...p.a }, ht: p.ht, o: p.o, sp: spotOf(p) }))
  const rot = planRotation(men, { ...(T.set ?? {}), po })
  return { short: T.short, men, rot, floor: [], home, fouls: 0, out: [], ...(T.dnp?.length && { dnp: T.dnp }), ...(T.co && { co: T.co, ...(T.co.pace && { pace: T.co.pace }) }) }
}

export function newGame(G) {
  const S = { rs: hashSeed(`nba-game-${G.seed}`), hs: 0, as: 0, po: !!G.po, per: 1, clock: Q, el: 0, sc: { h: 0, a: 0 }, q: { h: [0], a: [0] }, box: {}, lc: 0, big: { h: 0, a: 0 }, last: null, done: false, stop: null, next: STINT }
  S.h = side(G.home, true, !!G.po); S.a = side(G.away, false, !!G.po)
  // (a team with nobody to play forfeits: the league's 2-0; season.js keeps every roster at 13 or more, so it doesn't)
  const none = ['h', 'a'].filter(k => !S[k].men.length)
  if (none.length) { S.done = true; S.ff = none.length === 2 ? 'a' : none[0]; S.sc[other(S.ff)] = 2; S.hs = S.sc.h; S.as = S.sc.a; S.q[other(S.ff)][0] = 2 }
  hidden(S, 'EV', [])
  hot(S)
  const R = S.R
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
  const avail = T.men.filter(p => S.box[p.i].pf < 6 && !T.out.includes(p.i))
  // (the NBA's rule: with nobody left on the bench, the last man to foul out stays in)
  for (let j = T.out.length - 1; j >= 0 && avail.length < 5; j--) { const p = T.by.get(T.out[j]); if (p && !avail.includes(p)) avail.push(p) }
  const margin = lead(S, k), left = S.per >= 4 ? S.clock : 99999
  const absM = Math.abs(margin)
  // a game that's decided: both benches empty in the fourth (30 apart, 22 with nine minutes left, 17 with five); the
  // team ahead sits its starters sooner (TUNE.restAt: that far up late in the third, or any time in the fourth), and
  // they come back if the lead goes
  const garbage = !S.po && S.per >= 4 && ((absM >= 30) || (absM >= 22 && left <= 540) || (absM >= 17 && left <= 300)) || S.po && S.per >= 4 && absM >= 25 && left <= 360
    || !S.po && TUNE.restAt > 0 && margin >= TUNE.restAt && (S.per >= 4 || (S.per === 3 && S.clock <= 300))
  const close = (S.per >= 4 && left <= 330 && absM <= 12) || S.per > 4
  const ok = p => !trouble(S, S.box[p.i]) || (S.per >= 4 && left <= 360)
  const total = 2880, upTo = Math.min(total, S.el + STINT)
  // the coach's plan: who is furthest behind his minutes by the next whistle (a man on the floor gets a minute's
  // grace, so stints run six to ten minutes, not two)
  const nd = new Map()
  for (const p of avail) nd.set(p, (L.min[p.i] ?? 0) * 60 * upTo / total - S.box[p.i].sec + (T.floor.includes(p.i) ? 50 : 0))
  const need = p => nd.get(p) ?? 0
  let pick, val
  if (garbage) {
    // the end of the bench: the men who don't play much go in, the starters sit
    val = p => -(L.min[p.i] ?? 0) / 6
    pick = [...avail].sort((a, b) => (L.min[a.i] ?? 0) - (L.min[b.i] ?? 0)).filter(p => (L.min[p.i] ?? 0) < 26).slice(0, 5)
  } else if (close) {
    val = p => (p.o ?? 70) / 3
    pick = L.closers.map(id => T.by.get(id)).filter(p => p && avail.includes(p) && ok(p))
  } else if (start && (S.per === 1 || S.per === 3)) {
    val = p => (L.st.includes(p.i) ? 10 : 0) + (L.min[p.i] ?? 0) / 6
    pick = L.st.map(id => T.by.get(id)).filter(p => p && avail.includes(p) && ok(p))
  } else {
    val = p => need(p) / 300
    pick = avail.filter(p => ok(p) && (L.min[p.i] ?? 0) > 0).map(p => [p, nd.get(p)]).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0])
  }
  // short (fouls, injuries): the next men in the plan, then anyone
  for (const id of L.order) { const p = T.by.get(id); if (pick.length < 5 && p && avail.includes(p) && !pick.includes(p) && ok(p)) pick.push(p) }
  for (const p of avail) if (pick.length < 5 && !pick.includes(p)) pick.push(p)
  // the shape: two guards, a wing or two, one or two bigs (small ball and a big lineup are fine; five guards aren't)
  pick = reshape(pick.slice(0, 5), avail.filter(p => ok(p) && ((L.min[p.i] ?? 0) > 0 || garbage)), val)
  T.floor = pick.slice(0, 5).map(p => p.i)
  T.on = T.floor.map(id => T.pr.get(id))
}

// ── Scoring ─────────────────────────────────────────────────────────────────────
function score(S, k, pts, who) {
  const before = S.sc.h - S.sc.a
  S.sc[k] += pts
  S.hs = S.sc.h; S.as = S.sc.a
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
  ev(S, { k, w: who, y: 'ft', n: made, of: n })
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
  ev(S, { k: d, w: id, y: 'f', tf: T.fouls, ...(kind !== 'off' && { sh: 1 }) })
  if (S.box[id].pf >= 6) { T.out.push(id); lineup(S, d) }   // fouled out
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
    const w = O.on.map((s, j) => (O.floor[j] === shooterId ? 0.55 : 1) * s.ow * (shot === 'three' ? s.r3 : 1))
    const id = wpick(S.R, O.floor, w)
    S.box[id].orb++
    return id
  }
  // (about one miss in eight is a team rebound: out of bounds, a quarter's last shot; nobody's credited)
  if (S.R.u() < 0.12) return null
  const w = D.on.map(s => s.dw * (shot === 'three' ? s.r3 : 1))
  S.box[wpick(S.R, D.floor, w)].drb++
  return null
}

// one shot by `who`; returns the offensive rebounder's id on a live miss, or null when the possession is over
function shoot(S, k, who, forced = null, want = null) {
  const O = S[k], D = S[other(k)], s = O.pr.get(who), b = S.box[who]
  const R = S.R
  let shot = forced?.shot ?? want?.shot
  if (!shot) {
    const f3 = Math.min(0.6, Math.max(0.02, TUNE.three + 0.03 * (s.sh - 6) - (s.big ? 0.15 : 0) - 0.02 * (s.fin - 6) - (s.sh < 3.5 ? 0.15 : 0) + (O.co?.three ?? 0)))
    const fRim = Math.min(0.85, Math.max(0.25, TUNE.rimBase + 0.045 * (s.fin - 6) + (s.big ? 0.14 : 0) - 0.025 * (s.sh - 6)))
    const x = R.u()
    shot = x < f3 ? 'three' : x < f3 + (1 - f3) * fRim ? 'rim' : 'mid'
  }
  const dPer = mean(D.on, t => t.perD) - 6
  const dInt = Math.max(...D.on.map(t => t.intD)) * 0.55 + mean(D.on, t => t.intD) * 0.45 - 6.2
  const cl = S.per >= 4 && S.clock <= 300 && Math.abs(S.sc.h - S.sc.a) <= 5 ? 0.008 * (s.clu - 6) : 0
  const home = O.home ? tn(S, 'home') : 0
  let p, pFoul
  // (the very top of the scale pays less: an 11 shooter is great, not automatic; it keeps a star near 30 a night, not 37)
  const sh = s.sh <= 8 ? s.sh : 8 + (s.sh - 8) * 0.6, fin = s.fin <= 8 ? s.fin : 8 + (s.fin - 8) * 0.6
  if (shot === 'three') { p = TUNE.p3 + TUNE.skill3 * (sh - 6) - TUNE.def3 * dPer; pFoul = TUNE.foul3 }
  else if (shot === 'rim') { p = TUNE.pRim + TUNE.skillRim * (fin - 6) + 0.006 * (s.size - 6) - TUNE.defRim * dInt; pFoul = TUNE.foulRim * (1 + 0.04 * (s.fin - 6)) }
  else { p = TUNE.pMid + TUNE.skillMid * (sh - 6) - TUNE.defMid * dPer; pFoul = TUNE.foulMid }
  // the score: a team well ahead eases off (its bench, a slower pace, the stops it doesn't need), the one behind presses;
  // NBA leads shrink like this, a blowout comes back toward 20 and a close game stays close (forced: a moment's own make)
  const gap = forced ? 0 : S.sc[k] - S.sc[other(k)]
  const up = Math.max(-TUNE.leadCap, Math.min(TUNE.leadCap, gap))
  const far = Math.sign(gap) * Math.max(0, Math.min(TUNE.leadBigCap, Math.abs(gap)) - TUNE.leadCap)
  const pull = tn(S, 'lead') + (S.per >= 4 && S.clock <= TUNE.lateT && Math.abs(up) <= 12 ? tn(S, 'lead4') : 0)
  const slack = !S.po && !forced && S.per === 4 && Math.abs(gap) >= 22 ? TUNE.slack : 0
  p = Math.min(0.85, Math.max(0.1, p + home + cl + 0.004 * (s.iq - 6) - pull * up - tn(S, 'leadBig') * far + slack + staffEdge(S, O, D)))
  if (want?.heave) p *= S.clock <= 1.5 ? 0.35 : 0.6
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
    let by = null
    if (forced?.ast != null && O.floor.includes(forced.ast) && forced.ast !== who) { S.box[forced.ast].ast++; by = forced.ast }
    else if (forced?.ast === undefined && R.u() < TUNE.ast[shot]) {
      const mates = O.floor.filter(id => id !== who)
      const w = mates.map(id => O.pr.get(id).aw)
      if (mates.length) { by = wpick(R, mates, w); S.box[by].ast++ }
    }
    score(S, k, pts, who)
    ev(S, { k, w: who, y: shot, ...(by != null && { a: by }), ...(PB && { pb: 1 }) })
    if (fouled || (!forced && shot === 'rim' && R.u() < TUNE.andOne)) {
      foulOn(S, other(k), shot)
      if (!freeThrows(S, k, who, 1, forced?.ft1 != null ? (forced.ft1 ? 1 : 0) : null)) return miss(S, k, who, 'ft')
    }
    return null
  }
  return miss(S, k, who, shot)
}

// the coaches (coach.js coachSide): the offense's scheme against the defense's, a bench unit's minutes (three or more
// of the starters sitting), the last five minutes of a game within five
function staffEdge(S, O, D) {
  const a = O.co, b = D.co
  if (!a && !b) return 0
  let e = (a?.off ?? 0) - (b?.def ?? 0)
  const bench = T => T.st && T.floor.filter(id => !T.st.includes(id)).length >= 3
  if (a?.rot && bench(O)) e += a.rot
  if (b?.rot && bench(D)) e -= b.rot
  if (S.per >= 4 && S.clock <= 300 && Math.abs(S.sc.h - S.sc.a) <= 5) e += (a?.late ?? 0) - (b?.late ?? 0)
  return e
}
// the possession's man: the usage weights of the five on the floor
function actor(S, k) {
  const O = S[k]
  const u = tn(S, 'usage')
  const kn = TUNE.usageKnee, top = tn(S, 'usageTop'), lo = TUNE.usageLo
  const w = O.on.map(s => Math.exp(u * (s.off < 6 ? lo * (s.off - 6) : Math.min(s.off, kn) - 6 + top * Math.max(0, s.off - kn))) * (s.big ? TUNE.usageBig : 1))
  return wpick(S.R, O.floor, w)
}

// One possession (forced: a key moment's result, in the engine's terms: { who, shot, made, foul } · { who, tov } · { who, ft, made })
export function play(S, forced = null) {
  if (S.done) return S
  hot(S)
  const k = S.poss, d = other(k), O = S[k], D = S[d], R = S.R
  const m0 = S.EV ? S.EV.length : 0
  if (S.subDue) { S.subDue = false; lineup(S, k); lineup(S, d) }
  let t = forced?.t ?? Math.max(4, TUNE.pace + (R.u() - 0.5) * 12 + (O.pace ?? 0))
  // the last two minutes of a close game: the score and the clock run the possession
  let want = null
  if (!forced && S.per >= 4 && S.clock <= 120) {
    const e = endgame(S, k)
    if (e === true) return S
    if (e) { t = e.t ?? t; want = e.want ?? null }
  }
  // the end of a quarter: a last shot as it runs out (a heave from deep with under three seconds)
  const last = t >= S.clock
  if (last) { t = S.clock; if (!forced && t <= 3 && !want) want = { shot: 'three', heave: true } }
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
    ev(S, { k, w: who, y: 'ft', n: made, of: forced.ft })
  } else if (!forced && !last && R.u() < TUNE.foulNS) {
    // a foul away from the ball: the bonus (five team fouls in the quarter) is two shots, otherwise the ball inbounded
    foulOn(S, d, 'off')
    if (D.fouls >= 5) { const l = freeThrows(S, k, who, 2); if (!l) reb = miss(S, k, who, 'ft') }
    else { stamp(S, m0, S.clock - t * 0.4); tick(S, t * 0.4); return play(S) }
  } else {
    reb = shoot(S, k, who, forced && (forced.shot || forced.made != null) ? forced : null, want)
    // offensive boards: a putback or a reset, five or six seconds more
    let n = 0
    while (reb != null && n++ < 4) {
      const extra = 3 + R.u() * 6
      if (S.clock - t - extra <= 0) break
      stamp(S, m0, S.clock - t)
      t += extra
      const putback = O.pr.get(reb).big && R.u() < 0.45
      const next = putback ? reb : actor(S, k)
      PB = putback
      reb = shoot(S, k, next, putback ? { shot: 'rim', made: R.u() < Math.min(0.8, 0.6 + 0.02 * (O.pr.get(reb).fin - 6)), foul: R.u() < 0.1 } : null)
      PB = false
    }
  }
  stamp(S, m0, S.clock - t)
  tick(S, t)
  S.poss = d
  return S
}

// The end of a close game (the fourth's last two minutes, an overtime's): returns true when it played the possession
// itself (a foul to stop the clock, the clock run out), or { t, want } for the trip down.
//   ahead: the defense fouls to stop the clock when it's within reach (a possession behind once the shot clock is off,
//          four to six under 35 seconds, seven or eight now and then), else the offense runs the shot clock down, and
//          with under 24 left and the other team not fouling, the clock runs out
//   tied or a possession behind under 24: hold for the last shot (down two: mostly the two to tie); down three with
//          more than eight seconds: the three goes up early, with time left to foul and get the ball back
//   behind with time: push the pace; four or more down (or three late) look for a three
function endgame(S, k) {
  const R = S.R, O = S[k], dk = other(k), up = lead(S, k), m0 = S.EV ? S.EV.length : 0
  if (up > 0) {
    const foul = up <= 3 ? S.clock <= 24 && R.u() < 0.92 : up <= 6 ? S.clock <= 35 && R.u() < 0.8 : up <= 8 && S.clock <= 24 && R.u() < 0.4
    if (foul) {
      // the foul: whoever catches the inbound (the ball-handlers most), two shots
      const who = wpick(R, O.floor, O.on.map(s => 0.5 + Math.max(0, s.hnd) * 0.12))
      const t = Math.min(S.clock, 1.5 + R.u() * 4)
      foulOn(S, dk, 'off')
      const inn = freeThrows(S, k, who, 2)
      const reb = inn ? null : miss(S, k, who, 'ft')
      const per = S.per
      stamp(S, m0, S.clock - t)   // (the play-by-play's clock for the foul and the shots: it never draws the dice)
      tick(S, t)
      if (reb == null && !S.done && S.per === per) S.poss = dk
      return true
    }
    if (S.clock <= 24) { tick(S, S.clock); S.poss = dk; return true }
    return { t: Math.min(S.clock - 0.5, 18 + R.u() * 5) }
  }
  if (S.clock <= 24) {
    // (a few seconds left: a catch and a quick shot, a three if it takes one)
    if (S.clock <= 4.5) return { t: S.clock, want: { shot: up === -3 || R.u() < 0.5 ? 'three' : 'mid', heave: true } }
    // (down three with time: the three goes up early, four to ten seconds in, so a miss still leaves time to foul and
    // get the ball back; level or down one or two, the last shot is held)
    if (up === -3 && S.clock > 8) return { t: Math.min(S.clock - 3, 4 + R.u() * 6), want: { shot: 'three' } }
    if (up >= -3) return { t: Math.max(0.5, S.clock - 1 - R.u() * 3), want: up === -3 ? { shot: 'three' } : up === -2 && R.u() < 0.7 ? { shot: R.u() < 0.6 ? 'rim' : 'mid' } : null }
    return { t: Math.min(S.clock, 4 + R.u() * 4), want: R.u() < 0.8 ? { shot: 'three' } : null }
  }
  if (up < 0) return { t: 6 + R.u() * 6, want: (up <= -4 || (up === -3 && S.clock <= 45)) && R.u() < 0.65 ? { shot: 'three' } : null }
  return null
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
  hot(S)
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
  hot(S)
  const box = {}
  for (const k of ['h', 'a']) for (const p of S[k].men) { const b = S.box[p.i]; b.sec = Math.round(b.sec); box[p.i] = b }
  if (S.EV && S.done) { LOGS.set(logKey(S.h.short, S.a.short, S.q.h, S.q.a), S.EV); if (LOGS.size > 24) LOGS.delete(LOGS.keys().next().value) }
  return {
    h: S.h.short, a: S.a.short, hs: S.sc.h, as: S.sc.a, ot: Math.max(0, S.per - 4), q: S.q, box,
    team: { h: teamTotals(S, 'h'), a: teamTotals(S, 'a') }, st: { h: S.h.st, a: S.a.st }, ids: { h: S.h.men.map(p => p.i), a: S.a.men.map(p => p.i) }, dnp: { h: S.h.dnp ?? [], a: S.a.dnp ?? [] },
    lc: S.lc, big: S.big, w: S.sc.h > S.sc.a ? 'h' : 'a', po: S.po, ...(S.ff && { ff: S.ff }),
  }
}
export function playGame(G) { return finish(run(newGame(G))) }

// ── The seam (STATE.md) ────────────────────────────────────────────────────────
// tonight's men (rotation.js dressed); a team down to fewer than five suits up its day-to-day men, the shortest
// injuries first (a two-way man can't in the playoffs). The rest are the box score's DNPs: { i, r: 'inj' | 'rest' |
// 'tw', k: the injury, or why a two-way man isn't with the team }
function sideOf(F, s, po = false) {
  const T = F.teams[s]
  const men = dressed(T, { po, year: F.year })
  let hurtOk = 0
  if (men.length < 5) for (const p of T.r.filter(x => !men.includes(x) && !(po && x.tw)).sort((a, b) => (a.inj?.g ?? 0) - (b.inj?.g ?? 0))) {
    if (men.length >= 5) break
    men.push(p)
  }
  if (men.some(p => p.inj?.g > 0)) hurtOk = 1
  const dnp = T.r.filter(p => !men.includes(p)).map(p => (p.inj?.g > 0 ? { i: p.i, r: 'inj', k: p.inj.k } : p.rest ? { i: p.i, r: 'rest' } : { i: p.i, r: 'tw', k: po ? 'not eligible for the playoffs' : twGames(p, F.year) >= TW_GAMES ? '50-game limit' : 'G League' }))
  const co = coachSide(F, s)
  return { short: s, men, set: setOf(T), dnp, ...(hurtOk && { hurtOk }), ...(co && { co }) }
}
export function startGame(F, home, away, { seed = null, playoff = false } = {}) {
  return newGame({ seed: seed ?? `${F.seed}-${F.year}-${F.day}-${home}-${away}`, po: playoff, home: sideOf(F, home, playoff), away: sideOf(F, away, playoff) })
}
// (when: a key moment's test at each whistle from there on, season.js momentStart: the ball, the score and the clock
// decide it; the game plays on, into overtime too, until one fits or it's over)
export const playTo = (G, left = 0, when = null) => run(G, { stop: S => S.per >= 4 && S.clock <= left + 0.01 && (!when || when(S)) })
// a moment's possession, in the moment's terms (the header)
const MID_KINDS = new Set(['mid', 'iso', 'clutch-shot', 'half-court', 'read'])
export function possession(G, short, o = {}) {
  if (G.done) return G
  hot(G)
  const k = G.h.short === short ? 'h' : 'a', T = G[k]
  G.poss = k
  // (a man with six fouls is done for the night: the play goes to whoever the sim gives it to)
  let who = o.by != null && T.by.has(o.by) && G.box[o.by].pf < 6 && !T.out.includes(o.by) ? o.by : null
  // the moment's man is on the floor: in for the man playing the fewest minutes tonight
  if (who != null && !T.floor.includes(who)) {
    const out = [...T.floor].sort((x, y) => (T.rot.min[x] ?? 0) - (T.rot.min[y] ?? 0))[0]
    T.floor[T.floor.indexOf(out)] = who; T.on = T.floor.map(id => T.pr.get(id))
  }
  // (and the man who set it up)
  if (o.ast != null && o.ast !== who && T.by.has(o.ast) && !T.floor.includes(o.ast) && G.box[o.ast].pf < 6 && !T.out.includes(o.ast)) {
    const out = [...T.floor].filter(id => id !== who).sort((x, y) => (T.rot.min[x] ?? 0) - (T.rot.min[y] ?? 0))[0]
    T.floor[T.floor.indexOf(out)] = o.ast; T.on = T.floor.map(id => T.pr.get(id))
  }
  const t = o.t ?? (o.kind === 'ft' ? 4 : 12)
  const pts = o.pts ?? 0
  // (the play's kind: a pull-up or a step-back is a jumper; a roll, a post-up, a drive is at the rim)
  const shot = o.kind === 'three' || pts >= 3 ? 'three' : MID_KINDS.has(o.kind) ? 'mid' : 'rim'
  const ast = o.ast === undefined ? undefined : o.ast
  let forced
  if (o.tov) forced = { who, tov: true, t }
  else if (o.kind === 'ft') forced = { who, ft: Math.max(2, pts), made: pts, t }
  else if (pts === 1) forced = { who, ft: 2, made: 1, t }
  else forced = { who, shot, made: pts > 0, foul: pts === 4 || (pts === 3 && shot !== 'three'), ft1: pts === 4 || (pts === 3 && shot !== 'three') ? true : null, ast, t }
  if (who == null) delete forced.who
  return play(G, forced)
}
// After a key moment's possession, the seconds left in it (season.js finishMoment). sealed (his team landed the moment
// and is ahead: the owner's rule, a landed game-winner wins; lib/inGame.js bkSealed is the Career's): the other side's
// last look comes up empty and the clock runs out. Otherwise a trip with five seconds or less is a desperation shot
// (a heave from past half court with a second or so, a hurried look from deep with two or three, a quick one with
// four or five); the team ahead with the ball runs the clock out. More time than that, the sim plays it as it would.
// Returns the last trip ({ k, by, made, t, shot }), or null.
export function momentEnd(G, short, { sealed = false } = {}) {
  if (G.done) return null
  hot(G)
  const us = G.h.short === short ? 'h' : 'a', left = G.clock
  let trip = null
  if (sealed) {
    if (G.poss !== us && left > 0) { const by = actor(G, G.poss); trip = { k: G.poss, by, made: false, t: left, shot: 'three' }; play(G, { who: by, shot: 'three', made: false, foul: false, ast: null, t: left }) }
    if (!G.done) { G.poss = us; tick(G, G.clock) }
    return trip
  }
  if (left > 5) return null
  const k = G.poss
  if (lead(G, k) > 0) { tick(G, left); return null }
  const by = actor(G, k)
  const shot = left < 3 || lead(G, k) <= -3 ? 'three' : 'mid'
  const made = G.R.u() < (left < 1.5 ? 0.03 : left < 3.5 ? 0.1 : 0.3)
  trip = { k, by, made, t: left, shot }
  play(G, { who: by, shot, made, foul: false, t: left })
  return trip
}
// the box's minutes: whole minutes that add up to the game's (240, 265 with an overtime): each man's seconds, the
// largest remainders rounded up; a man who got in for a few seconds is a minute, so every man who played counts
export function boxMinutes(secs) {
  const total = Math.round(secs.reduce((a, b) => a + b, 0) / 60)
  const m = secs.map(s => (s > 0 ? Math.max(1, Math.floor(s / 60)) : 0))
  let diff = total - m.reduce((a, b) => a + b, 0)
  const rem = secs.map((s, j) => ({ j, r: s / 60 - Math.floor(s / 60) })).filter(x => secs[x.j] > 0)
  if (diff > 0) for (const x of rem.sort((a, b) => b.r - a.r)) { if (diff <= 0) break; m[x.j]++; diff-- }
  if (diff < 0) for (const x of rem.sort((a, b) => a.r - b.r)) { if (diff >= 0) break; if (m[x.j] >= 2) { m[x.j]--; diff++ } }
  return m
}
const ZERO = { pts: 0, reb: 0, oreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, pm: 0, cp: 0 }
// Res.box lines: every man on the roster. One who didn't play has min 0 and dnp: 'cd' (dressed, the coach's
// decision), 'inj' (k: the injury), 'rest', 'tw' (a two-way man not with the team; k: 'G League' | '50-game limit' |
// 'not eligible for the playoffs')
export function toRes(r) {
  const out = {}
  for (const k of ['h', 'a']) {
    const mins = boxMinutes(r.ids[k].map(i => r.box[i].sec))
    out[r[k]] = r.ids[k].map((i, j) => {
      const b = r.box[i]
      return { i, min: mins[j], pts: b.pts, reb: b.orb + b.drb, oreb: b.orb, ast: b.ast, stl: b.stl, blk: b.blk, tov: b.tov, pf: b.pf, fgm: b.fgm, fga: b.fga, tpm: b.tpm, tpa: b.tpa, ftm: b.ftm, fta: b.fta, pm: b.pm, st: !!b.gs, cp: b.cp, ...(!mins[j] && { dnp: 'cd' }) }
    })
    for (const x of r.dnp?.[k] ?? []) out[r[k]].push({ i: x.i, min: 0, ...ZERO, st: false, dnp: x.r, ...(x.k && { k: x.k }) })
  }
  return { hs: r.hs, as: r.as, ot: r.ot, box: out, q: r.q.h.map((x, j) => [x, r.q.a[j]]), lc: r.lc, big: r.big, ...(r.ff && { ff: r[r.ff] }) }
}
export const finishGame = G => toRes(finish(run(G)))
export const simGame = (F, home, away, opts = {}) => finishGame(startGame(F, home, away, opts))
