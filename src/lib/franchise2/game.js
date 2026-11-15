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

// a drive's chances from where it starts (y: yards from its own goal line) and the edge (offense minus defense)
const c01 = v => clamp(0, 1, v)
export function tdChance(y, e) {
  const base = y >= 25 ? 0.25 + 0.65 * Math.pow(c01((y - 25) / 73), 1.3) : 0.25 - 0.006 * (25 - y)
  return clamp(0.03, 0.93, base + 0.021 * e)
}
export function fgChance(y, e) {
  const base = 0.165 + 0.2 * c01((y - 25) / 40) - 0.17 * c01((y - 65) / 33)
  return clamp(0.02, 0.5, base + 0.004 * e)
}
// a field goal from the line of scrimmage at y (the kick is from 7 back, the posts 10 deep)
export const fgMake = y => clamp(0.2, 0.98, 1.12 - (117 - y) * 0.0125)

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
  return { G, t: 0, poss: first, recv2: first === 'h' ? 'a' : 'h', y: 25, hs: 0, as: 0, plays: [], di: 0, ot: null, keyAt: null, key: null, done: false, half: 1 }
}
const other = s => (s === 'h' ? 'a' : 'h')
const edgeOf = (S, side) => {
  const G = S.G, mine = side === 'h' ? G.sh : G.sa, them = side === 'h' ? G.sa : G.sh
  return (mine.off - them.def) + (side === 'h' ? (G.homeEdge ?? 0) : 0) + (G.mod?.[side] ?? 0)
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
  if (late && (m === -2 || m === 1 || m === -5 || m === -10)) { if (R.u() < 0.48) return 2; return 0 }
  return R.u() < 0.945 ? 1 : 0
}
function touchdown(S, side, R, extra = {}) {
  const pts = 6
  if (side === 'h') S.hs += pts; else S.as += pts
  const x = tryAfter(S, side, R)
  if (side === 'h') S.hs += x; else S.as += x
  S.plays.push({ t: Math.round(S.t), s: side, p: pts + x, k: 'td', hs: S.hs, as: S.as, ...extra })
}

// ── A drive from its start to its end, ordinary (not the key play) ──────────
// returns how it ended and how long it took
function drive(S, R, fromY = S.y) {
  const side = S.poss, e = edgeOf(S, side), m = margin(S, side)
  const left = (S.ot ? S.ot.end : REG) - S.t
  const late = !S.ot && S.t >= REG - 300
  let pTD = tdChance(fromY, e), pFG = fgChance(fromY, e)
  // behind by more than a field goal, late: three does nothing; they go for it (more touchdowns, more turnovers)
  if (late && m <= -4 && m >= -8) { pTD += pFG * 0.25; pFG = 0 }
  // down 9 or more late: a field goal first, then the onside kick (rarely), so take what's there
  // overtime: the next score ends it, a team kicks as soon as it's in range
  if (S.ot && S.ot.sudden) { pFG = Math.min(0.6, pFG * 1.5) }
  const u = R.u()
  const res = u < pTD ? 'td' : u < pTD + pFG ? 'fg' : R.u() < 0.27 ? 'to' : 'punt'
  // time: a scoring drive is longer; a team ahead late burns clock, one behind hurries
  let dur = res === 'td' ? 150 + R.u() * 190 : res === 'fg' ? 140 + R.u() * 170 : res === 'to' ? 50 + R.u() * 160 : 95 + R.u() * 150
  if (late && m > 0) dur *= 1.45
  if (late && m < 0) dur *= 0.5
  dur *= 0.86
  if (S.ot) dur *= 0.85
  return { res, dur: Math.round(dur), left }
}

// what happens after a drive ends (the other team's start)
function nextStart(res, y, R) {
  if (res === 'td' || res === 'fg') return 25 + (R.u() < 0.2 ? R.int(-8, 10) : 0)
  if (res === 'to') return clamp(5, 80, 100 - clamp(10, 95, y + R.int(0, 35)))
  if (res === 'downs') return clamp(1, 95, 100 - y)
  return clamp(5, 45, 100 - clamp(40, 99, y + 40 + R.int(-6, 12)))   // a punt
}

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
  S.t = REG; S.poss = first; S.y = 25
}
function step(S) {
  const R = rngOf(`${S.G.seed}-d${S.di}`)
  S.di++
  // halftime: the team that didn't get the opening kick gets the ball
  if (!S.ot && S.half === 1 && S.t >= HALF) { S.half = 2; S.t = HALF; S.poss = S.recv2; S.y = 25 }
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
  if (!fits && (d.res === 'punt' || d.res === 'to')) { S.t = end; afterDrive(S, side, 'end', R); return }
  S.t = Math.min(end - 1, S.t + d.dur)
  if (d.res === 'td') touchdown(S, side, R)
  else if (d.res === 'fg') { if (R.u() < fgMake(clamp(55, 97, S.y + 45))) score(S, side, 3, 'fg'); else d.res = 'miss' }
  afterDrive(S, side, d.res, R)
  if (!fits) S.t = end
}
function afterDrive(S, side, res, R) {
  if (S.ot) {
    S.ot.had.push(side)
    const both = S.ot.had.includes('h') && S.ot.had.includes('a')
    if (both) S.ot.sudden = true
    if ((S.ot.sudden || both) && S.hs !== S.as) { S.done = true; return }
  }
  const y = S.y
  S.poss = other(side)
  S.y = res === 'end' ? 25 : nextStart(res === 'miss' ? 'to' : res, clamp(30, 90, y + 35), R)
}

// what a possession is worth on average (points), from a start or a spot
export const KEY_TUNE = 0.85
const driveValue = (y, e, needTD) => 7 * tdChance(y, e) + (needTD ? 0 : 3 * fgChance(y, e) * fgMake(clamp(55, 97, y + 45)))
const winValue = (ny, e, needTD) => (ny >= 100 ? 7 : 7 * tdChance(ny, e) + (needTD ? 0 : 3 * fgChance(ny, e) * 1.3 * fgMake(ny + 5)))
const stopValue = (y, down, needTD) => (down === 3 && y >= 55 && !needTD ? 3 * fgMake(y) : 0)

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
      // the drive goes on from the new spot: its own chances from there, the clock it takes
      const pTD = tdChance(ny, e), pFG = margin(S, ball) <= -4 && S.t > REG - 300 ? 0 : fgChance(ny, e) * 1.3
      const u = R.u()
      const dur = Math.round((100 - ny) * (S.t > REG - 150 ? 0.9 : 2.2) + R.int(10, 50))
      S.t = Math.min(REG - 1, S.t + dur)
      if (u < pTD) { touchdown(S, ball, R); line = 'conv-td' }
      else if (u < pTD + pFG && R.u() < fgMake(ny + 5)) { score(S, ball, 3, 'fg'); line = 'conv-fg' }
      else { line = 'conv-stall'; S.stallY = ny }
    }
  } else {
    // stopped: a pick (the defense has it there), a sack and the kick or the punt, fourth down turned over
    if (kind === 'pick' && k.ball === 'them') { line = 'pick'; S.poss = k.us; S.y = clamp(5, 95, 100 - k.y - R.int(-5, 25)) }
    else if (k.down === 3 && k.y >= 55 && !(margin(S, ball) <= -4)) {
      const y = kind === 'sack' ? k.y - 7 : k.y
      if (R.u() < fgMake(y)) { score(S, ball, 3, 'fg'); line = 'held-fg' } else line = 'held-miss'
      S.poss = other(ball); S.y = 25
    } else if (k.down === 3) { line = 'punt'; S.poss = other(ball); S.y = nextStart('punt', k.y, R) }
    else { line = 'downs'; S.poss = other(ball); S.y = clamp(1, 95, 100 - k.y) }
  }
  if (line === 'td' || line === 'conv-td' || line === 'conv-fg') { S.poss = other(ball); S.y = 25 }
  if (line === 'conv-stall') { S.poss = other(ball); S.y = nextStart('punt', S.stallY, R); delete S.stallY }
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
