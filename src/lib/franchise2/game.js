// FRANCHISE: one game, played a possession at a time.
//
// Every game in the league is played the same way: the two teams trade drives until the clock runs out (two
// halves, a kickoff to each side, overtime if it's level: both teams get the ball, then the next score wins; a
// regular-season overtime can end in a tie, a playoff game can't). A drive's chances come from the offense with
// the ball against the defense facing it (the football sim's 1–12 ratings), where it starts, and the game
// state late (a team ahead burns clock, a team behind hurries and can't settle for three).
//
// MOMENTS (the owner's rule, 2026-11-14; snaps, 2026-11-16): a moment is a real play inside this game, never a
// boost to the odds.
//   1. The game is simulated a drive at a time; a moment is one snap of a real drive (snapOf, below): the down,
//      distance, spot and clock the game put there (third and 6 at the 42, fourth and goal, their last drive).
//   2. The snap moves the game by exactly what it was: the yards, a first down the drive goes on from, a
//      touchdown (6 and the try), a stop and the fourth-down call, a pick, a fumble, a sack, the clock.
//   3. The rest of the game plays out from the new state (margin, clock, who has the ball); a last play is the end.
//   4. The sim's own version of the snap (simSnap: the league's results on that down and distance) is what a
//      skipped or SIMPLE moment gets, so a game with moments the player doesn't play wins as often as one without.
//   5. The final score includes the play; so does the box score (season.js).
// Pure, seeded, JSON-serializable: a game paused on its moment is kept in the save and finished later.
import { rngOf, clamp } from './rng'

const REG = 3600, Q = 900, HALF = 1800
const OT_REG = 600, OT_PO = 900

// ── A drive ──────────────────────────────────────────────────────────────────
// A drive starts at y (yards from its own goal line) with an edge e (offense minus defense on the sim's 1-12 scale)
// and ends one of six ways: a touchdown, a turnover, or a stall that becomes a 4th down: the field goal try, the punt,
// or going for it (converted, the drive goes on from there; stopped, it's over on downs). Where it stalls is a real
// spot, and so is every kick: a field goal is 17 yards longer than the spot is from the goal line.
// Tuned (scripts/franchise2/game-stats.mjs) to the NFL's team game, 2023-25: about 22 points, 2.5 touchdowns, 1.9
// field goal tries made 85% of the time, 3.9 punts, 1.2 turnovers, a 4th-down try or so (about half made), drives
// starting near the 30, and very few kicks of 60 yards.
const c01 = v => clamp(0, 1, v)
const TD_K = 0.76, TD_E = 0.017    // a drive's touchdown chance: its scale and how much the edge moves it (0.69 before
                                   // the knees and the last half minutes, 2026-11-17: they took about a point a team game)
const TO_BASE = 0.115              // turnovers a drive
const THREE_OUT = 0.36             // of the drives that stall: three and out
const RZ_STALL = 0.08              // ...in the red zone (the 19 and in)
const MID_B = 0.35                 // ...and the rest: the share of the field they got through
export function tdChance(y, e) {
  const base = y >= 25 ? 0.25 + 0.65 * Math.pow(c01((y - 25) / 73), 1.3) : 0.25 - 0.006 * (25 - y)
  return clamp(0.03, 0.93, base * TD_K + TD_E * e)
}
// field goals by distance (the kick: the spot + 17): the league's make rates
const MAKE = [[18, 0.995], [25, 0.985], [30, 0.965], [35, 0.935], [40, 0.89], [45, 0.835], [50, 0.765], [55, 0.67], [60, 0.52], [65, 0.32], [70, 0.12]]
export function fgMakeAt(d) {
  if (d <= MAKE[0][0]) return MAKE[0][1]
  for (let i = 1; i < MAKE.length; i++) if (d <= MAKE[i][0]) { const [a, pa] = MAKE[i - 1], [b, pb] = MAKE[i]; return pa + (pb - pa) * (d - a) / (b - a) }
  return 0.05
}
// THE KICKER (kick.js reads his three ratings, 0-11): the table above is the league's kicker; each side's own moves
// it. ACCURACY moves every kick, POWER the long ones (and how far out his coach sends him: kickRange), CLUTCH the
// kicks late in a close game (the 4th quarter or overtime, within one score). Centred on the 32 starting kickers of
// 2026 (ks.js), so the league kicks what the NFL kicks: about 85% of field goals, 95% of extra points, 70% from 50+.
export const K_MID = [6.3, 5.9, 6.5]   // [power, accuracy, clutch]: the league's kicker
const logit = p => Math.log(p / (1 - p)), sig = x => 1 / (1 + Math.exp(-x))
export function fgChance(d, k, clutch = false) {
  const base = fgMakeAt(d)
  if (!k) return base
  const long = clamp(0, 1, (d - 38) / 17)
  return sig(logit(base) + 0.13 * (k[1] - K_MID[1]) + 0.16 * (k[0] - K_MID[0]) * long + (clutch ? 0.1 * (k[2] - K_MID[2]) : 0))
}
const XP = 0.956
export const xpChance = (k, clutch = false) => (k ? sig(logit(XP) + 0.11 * (k[1] - K_MID[1]) + (clutch ? 0.08 * (k[2] - K_MID[2]) : 0)) : XP)
// yards past the usual range his coach will send him out from: a big leg 3 to 5, a short one 2 to 4 fewer
export const kickRange = k => (k ? Math.round(clamp(-4, 5, (k[0] - K_MID[0]) * 1.1)) : 0)
// a 4th down at `togo`, the spot `toGoal` yards out: the call a coach makes. ctx: the game around it
//   { m (the offense's margin), late (the last 5:00), late2 (the last 2:00), needTD, end (the half's last drive), sudden (overtime, next score wins) }
export function fourthDown(toGoal, togo, e, ctx, R) {
  const d = toGoal + 17
  // the longest kick he's sent out for: 55 on an ordinary 4th down (a strong leg, a couple more); 60 and past only
  // with the half or the game on it
  // (the kicker's leg moves it: kickRange, ctx.kr)
  // (60 at most on an ordinary 4th down even for the biggest leg; never past 66, the longest the league has seen made)
  const range = Math.min(ctx.end ? 66 : 60, (ctx.end ? 63 : ctx.sudden ? 58 : 54 + (R.u() < 0.35 ? 3 : 0)) + (ctx.kr ?? 0))
  if (ctx.needTD) return toGoal <= 70 || ctx.late2 ? 'go' : 'punt'
  if (ctx.late2 && ctx.m < 0) return ctx.m >= -3 && d <= 60 + (ctx.kr ?? 0) ? 'fg' : 'go'
  if (ctx.end) return d <= range ? 'fg' : 'punt'
  let go = 0
  if (toGoal <= 2) go = 0.6
  else if (togo <= 1) go = toGoal <= 50 ? 0.8 : 0.42
  else if (togo <= 2) go = toGoal <= 45 ? 0.55 : 0.12
  else if (togo <= 5 && toGoal >= 35 && toGoal <= 45) go = 0.42   // (no man's land: too far to kick, too close to punt)
  if (ctx.late && ctx.m > 0) go *= 0.35                           // (ahead late: the points or the field position)
  if (R.u() < go) return 'go'
  return d <= range ? 'fg' : 'punt'
}
// going for it: the chance to make it at `togo`
export const goRate = (togo, e) => clamp(0.2, 0.8, 0.66 - 0.065 * (togo - 1) + 0.01 * e)
// how long the drive took (the clock), from what it was and how far it went
function durOf(kind, gained, R) {
  if (kind === 'td') return 120 + Math.max(0, gained) * 2 + R.u() * 100
  if (kind === 'to') return 45 + Math.max(0, gained) * 2.2 + R.u() * 70
  return 95 + Math.max(0, gained) * 2.4 + R.u() * 65   // (a stall: three and out about a minute and a half)
}
// One drive, from y: { res: 'td' | 'to' | 'fg' | 'punt' | 'downs', at (where it ended, from its own goal line), dist (a kick), dur }
export function driveOutcome(y0, e, R, ctx = {}) {
  let y = y0, dur = 0, go = 0
  for (let leg = 0; leg < 3; leg++) {
    const room = 100 - y
    const pTD = tdChance(y, e) * (ctx.needTD ? 1.12 : 1)
    const pTO = clamp(0.05, 0.2, TO_BASE - 0.005 * e + (ctx.late && ctx.m < 0 ? 0.035 : 0))
    const u = R.u()
    // (from: where the scoring play's series started, so the touchdown is never longer than the field it had)
    if (u < pTD) return { res: 'td', at: 100, dur: dur + durOf('td', room, R), go, from: y }
    if (u < pTD + pTO) { const at = clamp(y, 99, y + Math.round(R.u() * room * 0.6)); return { res: 'to', at, dur: dur + durOf('to', at - y, R), go } }
    // it stalls: three and out, in the red zone, or somewhere between
    const v = R.u()
    let gain
    if (v < THREE_OUT) gain = R.int(-3, 8)
    else if (v < THREE_OUT + RZ_STALL && room > 24) gain = room - R.int(3, 19)
    else gain = Math.round(room * clamp(0.06, 0.94, MID_B + 0.21 * R.n() + 0.012 * e))
    const at = clamp(1, 99, y + gain), toGoal = 100 - at
    const togo = Math.min(toGoal, toGoal <= 8 && R.u() < 0.5 ? toGoal : R.u() < 0.3 ? R.int(1, 2) : R.int(3, 13))
    dur += durOf('stall', at - y, R)
    const call = fourthDown(toGoal, togo, e, ctx, R)
    // (togo: the 4th down's distance, where the drive stalled: a moment on this drive comes up there)
    if (call === 'fg') return { res: 'fg', at, dist: toGoal + 17, dur, go, togo }
    if (call === 'punt') return { res: 'punt', at, dur, go, togo }
    go++
    if (R.u() < goRate(togo, e)) {
      const gain2 = togo + R.int(0, 8)
      if (at + gain2 >= 100) return { res: 'td', at: 100, dur: dur + 6, go, from: at }
      y = at + gain2
      continue
    }
    return { res: 'downs', at, dur, go, togo }
  }
  return { res: 'punt', at: y, dur, go }
}
// the kickoff after a score (2025 rules: a touchback to the 35; the return the rest of the time)
const kickoff = R => (R.u() < 0.55 ? 35 : clamp(8, 55, Math.round(27 + 8 * R.n())))
// the punt: about 46 yards in the air, a fair catch or a short return; a touchback to the 20
function puntStart(at, R) {
  const land = at + Math.round(46 + 6 * R.n())
  if (land >= 100) return 20
  const ret = R.u() < 0.45 ? 0 : R.int(2, 14)
  return clamp(1, 70, 100 - land + ret)
}
// where the other team starts after a drive ends
function nextStart(d, R) {
  if (d.res === 'td' || d.res === 'fg') return kickoff(R)
  if (d.res === 'miss') return Math.max(20, 100 - d.at + 7)   // (a miss: the spot of the kick, the 20 at worst)
  if (d.res === 'to') return clamp(1, 95, 100 - d.at + R.int(-4, 14))
  if (d.res === 'downs') return clamp(1, 99, 100 - d.at)
  if (d.res === 'end') return kickoff(R)
  return puntStart(d.at ?? 40, R)
}

// (the old key play's numbers, kept for the scripts that measured it: scripts/franchise2/game-calib.mjs)
export const convChance = (d, e) => clamp(0.08, 0.92, 0.8 - 0.036 * d + 0.016 * e)
export const normalRate = ovr => clamp(0.4, 0.75, 0.55 + (ovr - 80) * 0.008)

// ── State ────────────────────────────────────────────────────────────────────
// G (the game): { h, a, sh: {off, def}, sa: {off, def}, seed, po, ot (minutes), key: null | { us, off, def } (moments: snapOf),
//   k: { h, a } each side's kicker [power, accuracy, clutch] (none: the league's kicker), kid: { h, a } who kicked }
// S.kk: the kicking, a side's [FGA, FGM, XPA, XPM, long, 50+ tries, 50+ made] (kick.js addKickStats keeps the season's)
export function newGame(G) {
  const R = rngOf(`${G.seed}-coin`)
  const first = R.u() < 0.5 ? 'h' : 'a'
  // dr: the drives, in order ({ s, t0, t1, y0, res, at }); top: each side's time with the ball (seconds)
  return { G, t: 0, poss: first, recv2: first === 'h' ? 'a' : 'h', y: 30, hs: 0, as: 0, plays: [], di: 0, ot: null, keyAt: null, key: null, done: false, half: 1, ct: { h: {}, a: {} }, dr: [], top: { h: 0, a: 0 } }
}
// a drive as the game keeps it: who had it, the clock it took, where it started and how it ended
function logDrive(S, side, t0, y0, res, at) {
  const t1 = Math.max(t0, Math.round(S.t))
  S.dr ??= []; S.top ??= { h: 0, a: 0 }
  S.dr.push({ s: side, t0: Math.round(t0), t1, y0: Math.round(y0), res, at: Math.round(at ?? y0) })
  S.top[side] += t1 - Math.round(t0)
}
const other = s => (s === 'h' ? 'a' : 'h')
const edgeOf = (S, side) => {
  const G = S.G, mine = side === 'h' ? G.sh : G.sa, them = side === 'h' ? G.sa : G.sh
  // (late in a close game, the 4th quarter or overtime within one score, each coach's calls: coach.js coachLate)
  const late = G.late && S.t >= REG - Q && Math.abs(S.hs - S.as) <= 8 ? (G.late[side] ?? 0) : 0
  return (mine.off - them.def) + (side === 'h' ? (G.homeEdge ?? 0) : 0) + (G.mod?.[side] ?? 0) + late
}
const margin = (S, side) => (side === 'h' ? S.hs - S.as : S.as - S.hs)
const score = (S, side, pts, kind, extra = {}) => {
  if (side === 'h') S.hs += pts; else S.as += pts
  S.plays.push({ t: Math.round(S.t), s: side, p: pts, k: kind, hs: S.hs, as: S.as, ...extra })
}
// a kick that matters late: the 4th quarter or overtime, within one score
const clutchOn = (S, side) => (!!S.ot || S.t >= REG - Q) && Math.abs(margin(S, side)) <= 8
const kickTally = (S, side) => { const kk = S.kk ?? (S.kk = { h: [0, 0, 0, 0, 0, 0, 0], a: [0, 0, 0, 0, 0, 0, 0] }); return kk[side] }
// a field goal try from d yards: made or not, and on the kicker's line
function kickFG(S, side, d, R) {
  const ok = R.u() < fgChance(d, S.G.k?.[side], clutchOn(S, side))
  const t = kickTally(S, side)
  t[0]++; if (ok) { t[1]++; t[4] = Math.max(t[4], d) }
  if (d >= 50) { t[5]++; if (ok) t[6]++ }
  return ok
}
// the try after a touchdown: two (late, when the chart says so) or the kick
function tryAfter(S, side, R) {
  const m = margin(S, side)
  const late = S.t >= REG - Q
  if (late && (m === -2 || m === 1 || m === -5 || m === -10)) { S.tr = R.u() < 0.48 ? '2' : '2x'; return S.tr === '2' ? 2 : 0 }
  S.tr = R.u() < xpChance(S.G.k?.[side], clutchOn(S, side)) ? 'xp' : 'xpx'
  const t = kickTally(S, side)
  t[2]++; if (S.tr === 'xp') t[3]++
  return S.tr === 'xp' ? 1 : 0
}
function touchdown(S, side, R, extra = {}) {
  const pts = 6
  if (side === 'h') S.hs += pts; else S.as += pts
  const x = tryAfter(S, side, R)
  if (side === 'h') S.hs += x; else S.as += x
  S.plays.push({ t: Math.round(S.t), s: side, p: pts + x, k: 'td', hs: S.hs, as: S.as, tr: S.tr, ...extra })
}

// ── A drive in the game: the clock and the score around it ──────────────────
function ctxOf(S, side) {
  const m = margin(S, side)
  const late = !S.ot && S.t >= REG - 300, late2 = !S.ot && S.t >= REG - 120
  const end = S.ot ? S.t >= S.ot.end - 100 : (S.half === 1 && S.t >= HALF - 110) || (S.half === 2 && S.t >= REG - 40)
  // (behind by more than a field goal late, three does nothing: a touchdown or nothing)
  const needTD = (late && m <= -4 && m >= -8) || (late2 && m <= -4) || (!!S.ot && m <= -4)
  // (overtime: once both have had it, or the other side has already scored, the next score wins)
  const sudden = !!S.ot && (S.ot.sudden || margin(S, side) < 0)
  return { m, late, late2, end, needTD, sudden, kr: kickRange(S.G.k?.[side]) }
}
function drive(S, R, fromY = S.y) {
  const side = S.poss, e = edgeOf(S, side), ctx = ctxOf(S, side)
  const d = driveOutcome(fromY, e, R, ctx)
  let dur = d.dur
  if (ctx.late && ctx.m > 0) dur *= 1.45      // (ahead late: running the clock)
  if (ctx.late && ctx.m < 0) dur *= 0.5       // (behind late: hurrying)
  dur *= 0.86
  if (S.ot) dur *= 0.72   // (overtime: both sides move fast, timeouts and the clock in play)
  const c = S.ct[side]
  c.dr = (c.dr ?? 0) + 1
  return { ...d, dur: Math.round(dur) }
}
const count = (S, side, k) => { const c = S.ct?.[side]; if (c) c[k] = (c[k] ?? 0) + 1 }

// ── Running the game ─────────────────────────────────────────────────────────
// Plays possessions until the game ends or its key play comes up (S.key set: the game waits for it)
export function run(S) {
  while (!S.done && !S.key) step(S)
  return S
}
function endOfRegulation(S) {
  if (S.hs !== S.as) { S.done = true; return }
  // overtime: a coin flip, both teams get the ball, then the next score wins
  const R = rngOf(`${S.G.seed}-ot`)
  const first = R.u() < 0.5 ? 'h' : 'a'
  const len = S.G.po ? OT_PO : OT_REG
  S.ot = { n: 1, first, had: [], sudden: false, end: REG + len }
  S.t = REG; S.poss = first; S.y = 30
}
function step(S) {
  const R = rngOf(`${S.G.seed}-d${S.di}`)
  S.di++
  // halftime: the team that didn't get the opening kick gets the ball
  if (!S.ot && S.half === 1 && S.t >= HALF) { S.half = 2; S.t = HALF; S.poss = S.recv2; S.y = 30 }
  if (!S.ot && S.t >= REG) { endOfRegulation(S); return }
  if (S.ot && S.t >= S.ot.end) {
    if (S.G.po) { S.ot.n++; S.ot.end += OT_PO; S.ot.sudden = true }
    else { S.done = true; S.tie = S.hs === S.as; return }
  }
  // ahead with the ball and under two minutes left: the victory formation
  if (!S.ot && S.half === 2 && REG - S.t <= 110 && margin(S, S.poss) > 0) { const t0 = S.t; S.t = REG; logDrive(S, S.poss, t0, S.y, 'kneel', S.y); S.kneel = 1; return }
  const side = S.poss
  // under half a minute left in a half: a drive is a play or two, not a march (lastPlays)
  if (!S.ot && (S.half === 1 ? HALF : REG) - S.t < 30) { lastPlays(S, side, R); return }
  const d = drive(S, R)
  // ahead in the fourth quarter on a drive that's still going at the two-minute mark: the clock is theirs, and they
  // take a knee instead of scoring (most of the time with the ball under 1:50; always when it's under 0:40)
  if (!S.ot && S.half === 2 && margin(S, side) > 0 && (d.res === 'td' || d.res === 'fg') && S.t + d.dur >= REG - 110 && (S.t + d.dur >= REG - 40 || R.u() < 0.75)) {
    const t0 = S.t, y0 = S.y
    count(S, side, 'kneel'); S.t = REG; logDrive(S, side, t0, y0, 'kneel', Math.min(99, d.at ?? y0)); S.kneel = 1
    return
  }
  // a moment: this drive's deciding snap, played by the player (the game waits on it: S.key)
  if (S.G.key) {
    const k = snapOf(S, side, d)
    if (k) { S.key = k; S.keyFrom = { side, t0: Math.round(S.t), y0: S.y }; return }
  }
  applyDrive(S, side, d, R, S.t, S.y)
}
// A drive's end on the scoreboard and the clock (from S.t, where the drive, or what's left of it, starts)
function applyDrive(S, side, d, R, t0, y0) {
  const end = S.ot ? S.ot.end : S.half === 1 ? HALF : REG
  const fits = S.t + d.dur < end
  // a drive that runs into the half or the end: it scores only if it got there in time (a last-second kick)
  if (!fits && (d.res === 'punt' || d.res === 'to' || d.res === 'downs')) { S.t = end; logDrive(S, side, t0, y0, 'end', d.at); afterDrive(S, side, { res: 'end' }, R); return }
  // (a score on a drive that runs into the end of the half: the hurry-up gets it in with a few seconds to spare, a
  // field goal as the clock runs down, a touchdown a little before; never every one at 0:01)
  S.t = fits ? S.t + d.dur : Math.max(S.t + 1, end - (d.res === 'fg' ? R.int(1, 6) : R.int(3, 40)))
  count(S, side, d.res === 'downs' ? 'downs' : d.res)
  for (let i = 0; i < (d.go ?? 0); i++) count(S, side, 'go')
  if (d.res === 'td') touchdown(S, side, R, d.from != null ? { fy: d.from } : {})
  else if (d.res === 'fg') { count(S, side, 'fga'); count(S, side, `k${Math.min(6, Math.floor(d.dist / 10))}`); if (kickFG(S, side, d.dist, R)) score(S, side, 3, 'fg', { y: 117 - d.dist, d: d.dist }); else d.res = 'miss' }
  logDrive(S, side, t0, y0, d.res, d.res === 'td' ? 100 : d.at)
  afterDrive(S, side, d, R)
  if (!fits) S.t = end
}
function afterDrive(S, side, d, R) {
  if (S.ot) {
    S.ot.had.push(side)
    const both = S.ot.had.includes('h') && S.ot.had.includes('a')
    if (both) S.ot.sudden = true
    if ((S.ot.sudden || both) && S.hs !== S.as) { S.done = true; return }
  }
  S.poss = other(side)
  S.y = nextStart(d, R)
}

// The last half minute of a half (or of the game): one quick series from where the kickoff or the punt left the ball.
// A team that's ahead after halftime kneels it out; in range, the kick; behind by more than a score, the heave (it
// works about one time in twenty-five, more from close); otherwise the half runs out.
function lastPlays(S, side, R) {
  const end = S.half === 1 ? HALF : REG, t0 = S.t, y0 = S.y, m = margin(S, side), left = end - S.t
  if (S.half === 2 && m > 0) { S.t = end; logDrive(S, side, t0, y0, 'kneel', y0); S.kneel = 1; return }
  // (two or three quick throws to the sideline: how far they get)
  const y = clamp(y0, 92, y0 + R.int(0, 14) + (left >= 15 ? R.int(0, 16) : 0)), dist = 117 - y
  const needTD = S.half === 2 && m <= -4
  if (!needTD && (S.half === 1 || m >= -3) && dist <= 58 + kickRange(S.G.k?.[side])) {
    S.t = Math.min(end - 1, Math.max(t0, end - R.int(1, 3)))
    count(S, side, 'fg'); count(S, side, 'fga'); count(S, side, `k${Math.min(6, Math.floor(dist / 10))}`)
    if (kickFG(S, side, dist, R)) { score(S, side, 3, 'fg', { y: 117 - dist, d: dist }); logDrive(S, side, t0, y0, 'fg', y) }
    else logDrive(S, side, t0, y0, 'miss', y)
    S.t = end
    return
  }
  if (needTD && R.u() < (y >= 70 ? 0.15 : y >= 45 ? 0.04 : 0.01)) {
    S.t = Math.min(end - 1, Math.max(t0, end - 1))
    count(S, side, 'td'); touchdown(S, side, R, { fy: y }); logDrive(S, side, t0, y0, 'td', 100)
    S.t = end
    return
  }
  S.t = end; logDrive(S, side, t0, y0, 'end', y)
}

// ── The moments: snaps the player plays (owner, 2026-11-16) ─────────────────
// The game is played a drive at a time; a moment is one snap inside one of those drives, the one that decides it,
// at the down, distance, spot and clock this game put there. The player calls the play and runs it on his offense,
// or plays the backer on his defense; what the snap does is what the game gets: the yards, the first down, the
// touchdown, the turnover, the clock. The rest of the drive and the game go on from there.
//   G.key: { us: 'h' | 'a', off: bool, def: bool }   (the player's team, and which side's moments are on)
//   S.key: the snap waiting on the player: { side, kind, ball: 'us' | 'them', us, down, d (to go), y (the spot,
//          from the offense's own goal line), goal, t, mine, opp (the score, the player's side first), left }
// Where they come up (never in a blowout; more the closer it is):
//   offense: the two-minute drill before the half, a drive in a one-score 4th quarter (more in the last seven
//            minutes, nearly always behind or tied in the last two), overtime
//   defense: their last drive with the player's team ahead or level by a score in the last five minutes, a stand
//            in the red zone in a one-score 4th quarter
export const SNAP_MAX = { off: 3, def: 1 }
const SNAP_P = { half: 0.75, q4: 0.55, late: 0.85, two: 1, ot: 1, final: 0.85, stand: 0.45, otd: 0.6 }
// (kind → what the broadcast calls it)
export const SNAP_KIND = { half: 'TWO-MINUTE DRILL', two: 'TWO-MINUTE DRILL', late: '4TH QUARTER', q4: '4TH QUARTER', ot: 'OVERTIME', final: 'FINAL DRIVE', stand: 'RED ZONE', otd: 'OVERTIME' }
function snapOf(S, side, d) {
  const K = S.G.key, us = K.us, off = side === us
  if (off ? !K.off : !K.def) return null
  const n = S.mo ?? (S.mo = { off: 0, def: 0 })
  const which = off ? 'off' : 'def'
  // (overtime has its own: a team that's used its moments in regulation still gets one in overtime)
  if (n[which] >= SNAP_MAX[which] + (S.ot ? 1 : 0)) return null
  const R = rngOf(`${S.G.seed}-snap-${S.di}`)
  const m = margin(S, us), t = S.t
  const end = S.ot ? S.ot.end : S.half === 1 ? HALF : REG
  const q4 = !S.ot && t >= REG - Q, left = REG - t
  const red = d.res === 'td' || ((d.res === 'fg' || d.res === 'downs') && d.at >= 80)
  let kind = null
  if (off) {
    if (S.ot) kind = 'ot'
    else if (S.half === 1 && end - t <= 125 && end - t >= 30 && Math.abs(m) <= 14) kind = 'half'
    else if (q4 && Math.abs(m) <= 8) kind = left <= 135 && m <= 0 ? 'two' : left <= 420 ? 'late' : 'q4'
  } else {
    if (S.ot) kind = 'otd'
    else if (q4 && left <= 300 && m >= 0 && m <= 8) kind = 'final'
    else if (q4 && Math.abs(m) <= 8 && red) kind = 'stand'
  }
  if (!kind || end - t < 30 || R.u() >= SNAP_P[kind]) return null
  // the snap: where this drive's deciding down comes up
  let y, down, togo
  if (red) {
    // in close: third down inside the 20, or at the goal line
    const lo = Math.min(97, Math.max(S.y + 1, 80))
    y = R.int(lo, 97)
    down = d.res === 'downs' || ((kind === 'two' || kind === 'ot') && R.u() < 0.35) ? 4 : 3
    togo = 100 - y <= 9 && R.u() < 0.55 ? 100 - y : Math.min(100 - y, R.int(2, 8))
  } else if (d.res === 'to' || d.res === 'td') {
    // a third down on the way (a turnover's drive: the snap it came on)
    const lo = Math.min(S.y + 4, 72)
    y = d.res === 'to' ? clamp(S.y + 1, 97, d.at) : R.int(lo, Math.max(lo, 76))
    down = 3; togo = Math.min(100 - y, R.int(3, 10))
  } else {
    // where it stalled: third down there (fourth when they went for it, or have to)
    y = clamp(1, 97, d.at)
    togo = clamp(1, 100 - y, d.togo ?? 5)
    down = d.res === 'downs' || ((kind === 'two' || kind === 'ot') && m < 0 && togo <= 6 && R.u() < 0.5) ? 4 : 3
  }
  // (on defense, the backer's play: they're running it, short yardage)
  if (!off) togo = Math.min(togo, 100 - y, R.int(1, 4))
  // the clock: most of the way through the drive, and never on the half's last tick
  let ts = t + Math.round(d.dur * (red ? 0.85 : d.res === 'to' ? 0.6 : 0.8))
  ts = Math.max(t + Math.min(20, end - t - 6), Math.min(ts, end - R.int(4, 16)))
  // (no moment once the game is decided: ahead with the ball inside the two-minute mark, a team kneels)
  if (off && m > 0 && !S.ot && S.half === 2 && REG - ts <= 110) return null
  n[which]++
  return {
    side: which, kind, ball: off ? 'us' : 'them', us, down, d: togo, y, goal: y + togo >= 100, t: Math.round(ts),
    mine: S[us === 'h' ? 'hs' : 'as'], opp: S[us === 'h' ? 'as' : 'hs'], half: S.half, ot: S.ot ? 1 : 0, left: Math.round(end - ts), i: n.off + n.def,
  }
}

// The snap's play is in. out: { yards (from the line of scrimmage), td, to ('int' | 'fum'), inc (incomplete: the
// clock stops), sack, txt (the play, named: "Jared Goff 14-yd pass to Sam LaPorta"), cr ([[id, 'ptd' | 'rctd' | 'rtd']]
// for a touchdown), st (the men's lines from the play, for the box score) }
export function resolveSnap(S, out = {}) {
  const k = S.key, from = S.keyFrom ?? { side: k.ball === 'us' ? k.us : other(k.us), t0: k.t, y0: k.y }
  const R = rngOf(`${S.G.seed}-snap-${S.di}-play`)
  const ball = from.side, def = other(ball)
  const e = edgeOf(S, ball)
  S.key = null; S.keyFrom = null
  const end = S.ot ? S.ot.end : S.half === 1 ? HALF : REG
  const yards = Math.round(out.yards ?? 0), ny = k.y + yards
  const td = !out.to && (!!out.td || ny >= 100)
  const ok = out.to ? 0 : td || yards >= k.d ? 1 : 0
  // (success for the player's side: his offense moving the chains, his defense holding)
  const good = k.ball === 'us' ? ok : 1 - ok
  const rec = { t: Math.round(k.t), s: ball, p: 0, k: 'snap', ok: good, y: yards, down: k.down, d: k.d, at: k.y, ...(out.txt && { txt: out.txt }), ...(out.to && { to: out.to }) }
  S.t = Math.min(end - 1, k.t + (out.inc ? R.int(4, 6) : R.int(5, 8)))
  if (out.to) {
    // the ball's theirs where the play ended (a pick: where it was caught)
    const spot = clamp(1, 99, out.to === 'int' ? k.y + Math.max(0, yards) : ny)
    S.plays.push(rec)
    count(S, ball, 'to'); logDrive(S, ball, from.t0, from.y0, 'to', spot)
    afterDrive(S, ball, { res: 'to', at: spot }, R)
    return run(S)
  }
  if (td) {
    count(S, ball, 'td')
    touchdown(S, ball, R, { snap: 1, ok: good, ...(out.txt && { txt: out.txt }), ...(out.cr && { cr: out.cr }) })
    logDrive(S, ball, from.t0, from.y0, 'td', 100)
    afterDrive(S, ball, { res: 'td' }, R)
    return run(S)
  }
  S.plays.push(rec)
  if (ny <= 0) {
    // tackled in his own end zone: a safety, and the free kick
    score(S, def, 2, 'sf')
    logDrive(S, ball, from.t0, from.y0, 'sf', 0)
    if (S.ot) { S.done = true; return S }
    S.poss = def; S.y = R.int(30, 45)
    return run(S)
  }
  // the drive from here, the way every drive goes (the clock as it runs late: hurrying behind, bleeding it ahead)
  const goOn = y => {
    const ctx = ctxOf(S, ball)
    const d = driveOutcome(y, e, R, ctx)
    d.dur = Math.round(d.dur * (ctx.late && ctx.m < 0 ? 0.45 : ctx.late && ctx.m > 0 ? 1.2 : 0.8) * (S.ot ? 0.72 : 1))
    // (ahead and still going at the two-minute mark: the knee, as on any drive)
    if (!S.ot && S.half === 2 && ctx.m > 0 && (d.res === 'td' || d.res === 'fg') && S.t + d.dur >= REG - 110) { S.t = REG; logDrive(S, ball, from.t0, from.y0, 'kneel', Math.min(99, y)); S.kneel = 1; return }
    applyDrive(S, ball, d, R, from.t0, from.y0)
  }
  if (yards >= k.d || k.down < 3) goOn(ny)
  else if (k.down === 3) {
    // held on third down: the coach's call on fourth, from the spot
    const togo = k.d - yards, call = fourthDown(100 - ny, togo, e, ctxOf(S, ball), R)
    if (call === 'fg') applyDrive(S, ball, { res: 'fg', at: ny, dist: 117 - ny, dur: 5 }, R, from.t0, from.y0)
    else if (call === 'punt') applyDrive(S, ball, { res: 'punt', at: ny, dur: 7 }, R, from.t0, from.y0)
    else if (R.u() < goRate(togo, e)) goOn(Math.min(99, ny + togo + R.int(0, 5)))
    else applyDrive(S, ball, { res: 'downs', at: ny, dur: 6 }, R, from.t0, from.y0)
  } else applyDrive(S, ball, { res: 'downs', at: ny, dur: 0 }, R, from.t0, from.y0)
  return run(S)
}
// A snap's chance for the offense, the league's by down and distance (third down: about two in three on 3rd & 1,
// one in two at 4 or 5, one in four at 10)
export const snapChance = (d, e) => clamp(0.12, 0.78, 0.69 - 0.046 * (d - 1) + 0.015 * e)
// The snap played by the sim (the player's SIMPLE setting calls the play and lets the sim run it; a skip): a pass or a
// run (call), the league's results for it on that down and distance
export function simSnap(S, call = 'pass', tag = 'sim') {
  const k = S.key, R = rngOf(`${S.G.seed}-snap-${S.di}-${tag}`)
  const ball = k.ball === 'us' ? k.us : other(k.us)
  const e = edgeOf(S, ball)
  const toGoal = 100 - k.y
  const run = call === 'run' || k.ball === 'them'
  let p = snapChance(k.d, e) + (run ? (k.d <= 2 ? 0.06 : k.d >= 7 ? -0.2 : -0.06) : 0) - (k.goal ? 0.05 : 0)
  if (R.u() < p) {
    const y = k.goal ? toGoal : Math.min(toGoal, k.d + Math.floor(-Math.log(1 - R.u() * 0.99) * (run ? 4 : 9)))
    return { yards: y, td: y >= toGoal, call }
  }
  const v = R.u()
  if (run) return v < 0.02 ? { yards: R.int(-1, 2), to: 'fum', call } : { yards: Math.min(k.d - 1, R.int(-2, Math.max(-1, k.d - 1))), call }
  if (v < 0.05) return { yards: Math.min(toGoal - 1, R.int(4, 22)), to: 'int', call }
  if (v < 0.16) return { yards: -R.int(4, 9), sack: true, call }
  if (v < 0.36) return { yards: R.int(0, Math.max(0, k.d - 1)), call }
  return { yards: 0, inc: true, call }
}

// ── Reading a finished game ──────────────────────────────────────────────────
// points by quarter (overtime as a fifth)
export function quarters(S) {
  const q = { h: [0, 0, 0, 0], a: [0, 0, 0, 0] }
  for (const p of S.plays) {
    if (!p.p) continue
    const i = p.t >= REG ? 4 : Math.min(3, Math.floor(p.t / Q))
    if (i === 4 && q.h.length < 5) { q.h.push(0); q.a.push(0) }
    q[p.s][i] += p.p
  }
  return q
}
// a finished game, small: what the season keeps
export function boxOf(S) {
  return { h: S.G.h, a: S.G.a, hs: S.hs, as: S.as, ot: S.ot ? 1 : 0, tie: S.tie ? 1 : 0, q: quarters(S), pl: S.plays.map(p => [p.t, p.s === 'h' ? 0 : 1, p.p, p.k === 'key' || p.k === 'snap' ? (p.ok ? 'K' : 'k') : p.k === 'td' ? 'T' : 'F']), ...(S.keyOut && { ko: S.keyOut }) }
}
// the clock at a moment, as the broadcast reads it
// (po: a playoff game, whose overtime periods are 15 minutes; the regular season's is 10)
export function clockText(t, po = false) {
  const len = t >= REG ? (po ? OT_PO : OT_REG) : Q
  const left = len - (t >= REG ? (t - REG) % len : t % Q)
  const m = Math.floor(left / 60), s = Math.floor(left % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
export const periodOf = t => (t >= REG ? 'OT' : ['1ST', '2ND', '3RD', '4TH'][Math.min(3, Math.floor(t / Q))])
// the spot: "the 42", "own 30", "midfield"
export const spotText = y => (y === 50 ? 'midfield' : y < 50 ? `own ${y}` : `the ${100 - y}`)
// one whole game, no key play (every game that isn't the player's moment)
export function playGame(G) { return run(newGame(G)) }
