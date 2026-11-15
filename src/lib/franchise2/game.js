// FRANCHISE: one game, played a possession at a time.
//
// Every game in the league is played the same way: the two teams trade drives until the clock runs out (two
// halves, a kickoff to each side, overtime if it's level: both teams get the ball, then the next score wins; a
// regular-season overtime can end in a tie, a playoff game can't). A drive's chances come from the offense with
// the ball against the defense facing it (the football sim's 1–12 ratings), where it starts, and the game
// state late (a team ahead burns clock, a team behind hurries and can't settle for three).
//
// MOMENTS (the owner's rule, 2026-11-14): a moment is a real play inside this game, never a boost to the odds.
//   1. The game is simulated first; the moment is dealt on a real possession late in the 4th quarter of a close
//      game, from that game's own score, clock and possession, and the play fits it (third and 6 at the 42,
//      fourth and goal, a stop on their side of the ball).
//   2. The play moves the scoreboard by exactly what it was: a touchdown (6 and the try), a first down that the
//      drive goes on from, a stop, a pick, a sack.
//   3. The rest of the game plays out from the new state (margin, clock, who has the ball); a last play is the end.
//   4. Where it lands is calibrated, not the result: the distance to go is set so the play's own chance (what it
//      would be if the game were simulated without the player) matches the build's normal success rate. So with
//      moments on and the player playing at his usual level, the team wins as often as with moments off.
//   5. The final score includes the play (the box score is made from the final).
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
const TD_K = 0.69, TD_E = 0.017    // a drive's touchdown chance: its scale and how much the edge moves it
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
// a 4th down at `togo`, the spot `toGoal` yards out: the call a coach makes. ctx: the game around it
//   { m (the offense's margin), late (the last 5:00), late2 (the last 2:00), needTD, end (the half's last drive), sudden (overtime, next score wins) }
export function fourthDown(toGoal, togo, e, ctx, R) {
  const d = toGoal + 17
  // the longest kick he's sent out for: 55 on an ordinary 4th down (a strong leg, a couple more); 60 and past only
  // with the half or the game on it
  const range = ctx.end ? 63 : ctx.sudden ? 58 : 54 + (R.u() < 0.35 ? 3 : 0)
  if (ctx.needTD) return toGoal <= 70 || ctx.late2 ? 'go' : 'punt'
  if (ctx.late2 && ctx.m < 0) return ctx.m >= -3 && d <= 60 ? 'fg' : 'go'
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
    if (u < pTD) return { res: 'td', at: 100, dur: dur + durOf('td', room, R), go }
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
    if (call === 'fg') return { res: 'fg', at, dist: toGoal + 17, dur, go }
    if (call === 'punt') return { res: 'punt', at, dur, go }
    go++
    if (R.u() < goRate(togo, e)) {
      const gain2 = togo + R.int(0, 8)
      if (at + gain2 >= 100) return { res: 'td', at: 100, dur: dur + 6, go }
      y = at + gain2
      continue
    }
    return { res: 'downs', at, dur, go }
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

// The key play's chance for the offense: a third or fourth down at d to go
export const convChance = (d, e) => clamp(0.08, 0.92, 0.8 - 0.036 * d + 0.016 * e)
// the distance that puts that chance at p for the offense
export const distFor = (p, e) => clamp(1, 15, Math.round((0.8 + 0.016 * e - p) / 0.036))
// a build's normal success rate on a moment (its mini game at his usual level), from his OVR
export const normalRate = ovr => clamp(0.4, 0.75, 0.55 + (ovr - 80) * 0.008)

// ── State ────────────────────────────────────────────────────────────────────
// G (the game): { h, a, sh: {off, def}, sa: {off, def}, seed, po, ot (minutes), key: null | { team, side, h, bonus } }
//   key.team: the player's team; side 'off' (his build is on offense: the play is on his team's drive) or 'def'
export function newGame(G) {
  const R = rngOf(`${G.seed}-coin`)
  const first = R.u() < 0.5 ? 'h' : 'a'
  return { G, t: 0, poss: first, recv2: first === 'h' ? 'a' : 'h', y: 30, hs: 0, as: 0, plays: [], di: 0, ot: null, keyAt: null, key: null, done: false, half: 1, ct: { h: {}, a: {} } }
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
// the try after a touchdown: two (late, when the chart says so) or the kick
function tryAfter(S, side, R) {
  const m = margin(S, side)
  const late = S.t >= REG - Q
  if (late && (m === -2 || m === 1 || m === -5 || m === -10)) { S.tr = R.u() < 0.48 ? '2' : '2x'; return S.tr === '2' ? 2 : 0 }
  S.tr = R.u() < 0.956 ? 'xp' : 'xpx'
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
  return { m, late, late2, end, needTD, sudden }
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
  // the key play: the player's team's possession (or the other team's, for a defender) late in a close 4th
  const K = S.G.key
  if (K && !S.keyDone && !S.ot && S.t >= REG - (K.window ?? 300) && S.t <= REG - 25) {
    const team = K.side === 'off' ? K.us : other(K.us)
    // (a team ahead with the ball under two minutes kneels: no moment there)
    if (S.poss === team && Math.abs(margin(S, K.us)) <= 8 && !(REG - S.t <= 130 && margin(S, team) > 0)) { S.key = dealKey(S, R); return }
  }
  // ahead with the ball and under two minutes left: the victory formation
  if (!S.ot && S.half === 2 && REG - S.t <= 110 && margin(S, S.poss) > 0) { S.t = REG; S.kneel = 1; return }
  const side = S.poss
  const d = drive(S, R)
  const end = S.ot ? S.ot.end : S.half === 1 ? HALF : REG
  const fits = S.t + d.dur < end
  // a drive that runs into the half or the end: it scores only if it got there in time (a last-second kick)
  if (!fits && (d.res === 'punt' || d.res === 'to' || d.res === 'downs')) { S.t = end; afterDrive(S, side, { res: 'end' }, R); return }
  S.t = Math.min(end - 1, S.t + d.dur)
  count(S, side, d.res === 'downs' ? 'downs' : d.res)
  for (let i = 0; i < (d.go ?? 0); i++) count(S, side, 'go')
  if (d.res === 'td') touchdown(S, side, R)
  else if (d.res === 'fg') { count(S, side, 'fga'); count(S, side, `k${Math.min(6, Math.floor(d.dist / 10))}`); if (R.u() < fgMakeAt(d.dist)) score(S, side, 3, 'fg', { y: 117 - d.dist, d: d.dist }); else d.res = 'miss' }
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

// what a possession is worth on average (points), from where it starts: the drives themselves, played out (a table
// for each whole edge, made once when it's first needed; a touchdown is worth its try too)
export const KEY_TUNE = 0.85
const EV = new Map()
function evRow(e, needTD) {
  const k = `${e}|${needTD ? 1 : 0}`
  let row = EV.get(k)
  if (row) return row
  row = new Float32Array(101)
  const R = rngOf(`ev-${k}`), N = 300
  for (let y = 1; y <= 100; y++) {
    let v = 0
    for (let i = 0; i < N; i++) {
      const d = driveOutcome(y, e, R, { needTD, m: needTD ? -5 : 0 })
      v += d.res === 'td' ? 6.95 : d.res === 'fg' && !needTD ? 3 * fgMakeAt(d.dist) : 0
    }
    row[y] = v / N
  }
  row[0] = row[1]
  EV.set(k, row)
  return row
}
function evAt(y, e, needTD) {
  const yy = clamp(0, 100, Math.round(y)), lo = Math.floor(clamp(-8, 8, e)), hi = Math.min(8, lo + 1), f = clamp(-8, 8, e) - lo
  return evRow(lo, needTD)[yy] * (1 - f) + evRow(hi, needTD)[yy] * f
}
const driveValue = (y, e, needTD) => evAt(y, e, needTD)
const winValue = (ny, e, needTD) => (ny >= 100 ? 7 : evAt(ny, e, needTD))
// stopped on 3rd down at y: the 4th-down kick if it's in range (it isn't worth anything when they need a touchdown)
const stopValue = (y, down, needTD) => (down === 3 && !needTD && 117 - y <= 55 ? 3 * fgMakeAt(117 - y) : 0)

// ── The key play ─────────────────────────────────────────────────────────────
// The game stops on a third or fourth down on this possession: where it lands is set so the offense's chance on
// the play matches the build's normal rate (for a defender, the offense's chance is one minus it).
function dealKey(S, R) {
  const K = S.G.key, ball = S.poss, e = edgeOf(S, ball), mUs = margin(S, K.us)
  const late = S.t >= REG - 150
  const p = clamp(0.1, 0.9, (K.side === 'off' ? K.h : 1 - K.h) + (K.bonus ?? 0) * (K.side === 'off' ? 1 : -1))
  const d = distFor(p, e)
  const mBall = margin(S, ball)
  const needTD = mBall <= -4 && late
  const down = late && mBall < 0 ? 4 : 3
  // where on the field: the spot where the play is worth what this possession was worth before it (the points
  // the drive would have scored on average), at the offense's chance on it. Fourth and goal when that's at the goal.
  const want = driveValue(S.y, e, needTD) + KEY_TUNE   // (KEY_TUNE: the gap the late clock leaves, measured by scripts/franchise2/game-calib.mjs)
  let y = 30, best = 1e9
  for (let yy = 20; yy <= 100 - d; yy++) {
    const v = p * winValue(yy + d + 6, e, needTD) + (1 - p) * stopValue(yy, down, needTD)
    const gap = Math.abs(v - want) + R.u() * 0.05
    if (gap < best) { best = gap; y = yy }
  }
  const goal = y + d >= 100
  const clock = REG - S.t - R.int(5, 40)
  S.t = REG - Math.max(15, clock)
  return { ball: ball === K.us ? 'us' : 'them', y, d, down, goal, t: S.t, us: K.us, mine: S[K.us === 'h' ? 'hs' : 'as'], opp: S[K.us === 'h' ? 'as' : 'hs'], margin: mUs, chance: K.side === 'off' ? convChance(d, e) : 1 - convChance(d, e) }
}
// The key play's result: success for the player's side (a hit), the play's own outcome, and the game from there.
// kind: what the play was ('pick' a defender's interception, 'sack', 'big' a deep shot): only how it reads.
export function resolveKey(S, hit, kind = null, seed = 'k') {
  const k = S.key, R = rngOf(`${S.G.seed}-key-${seed}`)
  const ball = k.ball === 'us' ? k.us : other(k.us)
  const e = edgeOf(S, ball)
  const converted = k.ball === 'us' ? hit : !hit
  S.keyDone = true
  const playT = S.t
  S.plays.push({ t: Math.round(playT), s: ball, p: 0, k: 'key', ok: hit ? 1 : 0, hs: S.hs, as: S.as })
  S.t = Math.min(REG - 1, S.t + R.int(4, 9))
  let line
  if (converted) {
    const gain = k.goal ? k.d : k.d + R.int(0, kind === 'big' ? 30 : 14)
    const ny = k.y + gain
    if (ny >= 100) { touchdown(S, ball, R, { key: 1 }); line = 'td' }
    else {
      // the drive goes on from the new spot, the way every drive goes (its kick from where it stalls), on the clock left
      const ctx = ctxOf(S, ball)
      const d = driveOutcome(ny, e, R, ctx)
      S.t = Math.min(REG - 1, S.t + Math.round(d.dur * (ctx.late && ctx.m < 0 ? 0.45 : ctx.late && ctx.m > 0 ? 1.2 : 0.8)))
      if (d.res === 'td') { touchdown(S, ball, R); line = 'conv-td' }
      else if (d.res === 'fg' && R.u() < fgMakeAt(d.dist)) { score(S, ball, 3, 'fg', { y: 117 - d.dist, d: d.dist }); line = 'conv-fg' }
      else { line = 'conv-stall'; S.stall = d.res === 'fg' ? { ...d, res: 'miss' } : d }
    }
  } else {
    // stopped: a pick (the defense has it there), a sack and the kick or the punt, fourth down turned over
    if (kind === 'pick' && k.ball === 'them') { line = 'pick'; S.poss = k.us; S.y = clamp(5, 95, 100 - k.y - R.int(-5, 25)) }
    // (held on 3rd down: the 4th-down kick from that spot if it's in range, the punt if it isn't)
    else if (k.down === 3 && 117 - (kind === 'sack' ? k.y - 7 : k.y) <= (margin(S, ball) < 0 && S.t >= REG - 120 ? 60 : 55) && !(margin(S, ball) <= -4)) {
      const y = kind === 'sack' ? k.y - 7 : k.y, dist = 117 - y
      if (R.u() < fgMakeAt(dist)) { score(S, ball, 3, 'fg', { y, d: dist }); line = 'held-fg'; S.poss = other(ball); S.y = kickoff(R) }
      else { line = 'held-miss'; S.poss = other(ball); S.y = Math.max(20, 100 - y + 7) }
    } else if (k.down === 3) { line = 'punt'; S.poss = other(ball); S.y = puntStart(k.y, R) }
    else { line = 'downs'; S.poss = other(ball); S.y = clamp(1, 95, 100 - k.y) }
  }
  if (line === 'td' || line === 'conv-td' || line === 'conv-fg') { S.poss = other(ball); S.y = kickoff(R) }
  if (line === 'conv-stall') { S.poss = other(ball); S.y = nextStart(S.stall, R); delete S.stall }
  S.keyOut = { hit: !!hit, line, kind }
  S.key = null
  return run(S)
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
  return { h: S.G.h, a: S.G.a, hs: S.hs, as: S.as, ot: S.ot ? 1 : 0, tie: S.tie ? 1 : 0, q: quarters(S), pl: S.plays.map(p => [p.t, p.s === 'h' ? 0 : 1, p.p, p.k === 'key' ? (p.ok ? 'K' : 'k') : p.k === 'td' ? 'T' : 'F']), ...(S.keyOut && { ko: S.keyOut }) }
}
// the clock at a moment, as the broadcast reads it
export function clockText(t) {
  const inQ = t >= REG ? (t - REG) % OT_PO : t % Q
  const left = Q - inQ
  const m = Math.floor(left / 60), s = Math.floor(left % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
export const periodOf = t => (t >= REG ? 'OT' : ['1ST', '2ND', '3RD', '4TH'][Math.min(3, Math.floor(t / Q))])
// the spot: "the 42", "own 30", "midfield"
export const spotText = y => (y === 50 ? 'midfield' : y < 50 ? `own ${y}` : `the ${100 - y}`)
// one whole game, no key play (every game that isn't the player's moment)
export function playGame(G) { return run(newGame(G)) }
