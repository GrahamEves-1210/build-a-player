// Calls: read the defense. A real pre-snap look (eleven men where the words say they are), a play
// clock, three plays under the thumbs; then the play runs, all twenty-two of them, and it ends the
// way football ends: somebody brings him down, at the spot the yardage says. The word comes after,
// and it's the thing you just watched. The skill is reading quickly; a sharper mind gets more clock.
//   audible      one look, one call
//   two-minute   an actual drive: down, distance and clock are real and move with every play.
//                It runs until the touchdown, the clock, fourth down or a turnover
import { keyCap, THREE_KEYS, clamp, lerp, outcome, football, rngOf, prog, easeOut, easeInOut, themOf, GOOD, BAD, text, DISPLAY, rr, manOf, xiOf, paceOf, particles, nudge } from './kit.js'
import { nameTag,  goalPosts, breakupPose, tilt, untilt, athlete, warmQb, qbStance, skinOf, dirOf, airBall, ballShadow, rollingField, turfLine, stands, floodlight, vignette, crowdPop, warmAthlete } from './art.js'
import { callMs } from '../minigames.js'
import { momentSituation } from '../situations.js'
import { SPIKE_MS, snapBall, SNAP_MS, paintFieldFlat, flightAt, looseBall, qbPose, handsFor, SL, SR, startTags, tag, drawTags, flairOf, lightFx, popCrowd, hop, kickUp, puffAt, scorerDance, stopperDance, official, coach, endZonePylons, chainStick, leanIn } from './throw.js'

export const how = {
  audible: 'Read the defense. Pick the play before the clock runs out.',
  'two-minute': 'Read the down and the clock. Get in the end zone before time runs out.',
}
export const audibleMs = v => Math.max(3700, (callMs(v) + 620) * 1.4)
export const driveMs = v => (1750 + callMs(v) * 0.39) * 1.75

// ── The offense: shotgun, 11 personnel, wide to the numbers and the sideline ─────────────────────
const WR = [{ x: 30, yd: -1 }, { x: 98, yd: -2.4 }, { x: 330, yd: -2.4 }]
const TE = 252
const RB = { x: 150, yd: -6 }, QB = { x: 180, yd: -6 }
const OL = [134, 157, 180, 203, 226]
const SK = 0.8, SK_LINE = 0.84
// what the cards draw: a route's shape from where he starts, x toward the middle, y upfield in yards
const SHAPES = {
  slant: [[0, 0], [0, 3], [96, 11]],
  hitch: [[0, 0], [0, 7], [6, 6]],
  out: [[0, 0], [0, 10], [-26, 10]],
  dig: [[0, 0], [0, 14], [170, 14]],
  post: [[0, 0], [0, 10], [96, 23]],
  go: [[0, 0], [0, 26]],
  seam: [[0, 0], [0, 24]],
  corner: [[0, 0], [0, 10], [-26, 19]],
  fade: [[0, 0], [-8, 9], [-14, 24]],
  cross: [[0, 0], [0, 2], [200, 6]],
  stick: [[0, 0], [0, 6], [16, 6]],
  flat: [[0, 0], [-40, 2], [-90, 4]],
  screen: [[0, 0], [12, -2], [24, -2]],
  inside: [[0, 0], [32, 5], [32, 20]],
  power: [[0, 0], [78, 4], [84, 20]],
  draw: [[0, 0], [0, 1.5], [32, 6], [32, 22]],
  sweep: [[0, 0], [-60, 2], [-92, 7], [-92, 20]],
}
// the same routes when they're run: to the depth this play gets
const inwardOf = x => (x < 180 ? 1 : -1)
function routeFor(name, x0, d) {
  const toSide = x0 < 180 ? -(x0 - 14) : -(346 - x0)
  switch (name) {
    case 'slant': return [[0, 0], [0, 2.5], [Math.min(110, d * 10), d]]
    case 'hitch': return [[0, 0], [0, d + 1], [6, d]]
    case 'stick': return [[0, 0], [0, d], [14, d]]
    case 'out': return [[0, 0], [0, d], [toSide, d]]
    case 'dig': return [[0, 0], [0, d], [130, d]]
    case 'post': return [[0, 0], [0, d * 0.45], [90, d]]
    case 'corner': return [[0, 0], [0, d * 0.5], [Math.max(toSide, -44), d]]
    case 'fade': return [[0, 0], [Math.max(toSide, -8), d * 0.4], [Math.max(toSide, -14), d]]
    case 'cross': return [[0, 0], [0, 2], [170, d]]
    case 'flat': return [[0, 0], [-40, 2], [-90, d]]
    case 'screen': return [[0, 0], [12, -1], [22, -1]]
    case 'inside': return [[0, 0], [32, 5], [32, d]]
    case 'power': return [[0, 0], [78, 4], [84, d]]
    case 'draw': return [[0, 0], [0, 1.5], [32, 6], [32, d]]
    case 'sweep': return [[0, 0], [-60, 2], [-92, Math.max(3, d * 0.5)], [-92, d]]
    default: return [[0, 0], [0, d]]
  }
}
// where the defense stands: x, yards off the ball. t: d line, l backer, n nickel, c corner, s safety.
// b: he's coming. Eleven in every one (a test checks), and what's drawn is what the words say.
const line4 = [[122, 0.9, 'd'], [162, 0.9, 'd'], [198, 0.9, 'd'], [238, 0.9, 'd']]
const FORM = {
  zero: [...line4, [104, 1.6, 'l', 1], [180, 2.4, 'l', 1], [258, 1.6, 'l', 1], [98, 1.4, 'n', 1], [30, 1.4, 'c'], [330, 1.4, 'c'], [292, 4, 's']],
  light: [...line4, [150, 4.8, 'l'], [210, 4.8, 'l'], [98, 7, 'n'], [30, 8, 'c'], [330, 8, 'c'], [96, 15, 's'], [264, 15, 's']],
  eight: [...line4, [130, 4.2, 'l'], [180, 4.2, 'l'], [230, 4.2, 'l'], [282, 3.6, 's'], [30, 1.4, 'c'], [330, 1.4, 'c'], [180, 16, 's']],
  cover2: [...line4, [150, 5, 'l'], [210, 5, 'l'], [98, 5, 'n'], [40, 3.2, 'c'], [320, 3.2, 'c'], [90, 15, 's'], [270, 15, 's']],
  cover3: [...line4, [130, 4.6, 'l'], [180, 4.6, 'l'], [230, 4.6, 'l'], [30, 9.5, 'c'], [330, 9.5, 'c'], [180, 17, 's'], [98, 6, 's']],
  cover1: [...line4, [150, 4.2, 'l'], [210, 4.2, 'l'], [98, 1.4, 'n'], [30, 1.4, 'c'], [330, 1.4, 'c'], [180, 17, 's'], [180, 9, 's']],
  cover4: [...line4, [150, 5, 'l'], [210, 5, 'l'], [98, 9, 'n'], [30, 11, 'c'], [330, 11, 'c'], [116, 12, 's'], [244, 12, 's']],
  overload: [...line4, [34, 1.6, 'l', 1], [66, 1.6, 'n', 1], [96, 1.6, 'l', 1], [205, 4.8, 'l'], [30, 8.5, 'c'], [330, 8.5, 'c'], [240, 15, 's']],
  prevent: [[140, 0.9, 'd'], [180, 0.9, 'd'], [220, 0.9, 'd'], [110, 9, 'l'], [180, 9, 'l'], [250, 9, 'l'], [66, 13.5, 'n'], [30, 13.5, 'c'], [330, 13.5, 'c'], [108, 21, 's'], [252, 21, 's']],
}
const P = (n, ok, kind, res, w, r, extra = {}) => ({ n, ok, kind, res, w, r, ...extra })
const VERTS = [[0, 'go'], [1, 'seam'], [2, 'go']]
const MESH = [[0, 'cross'], [2, 'cross']]
// w: who gets the ball: 0 1 2 receivers, 3 the back. kind: catch, swat, pick, run, stuff, sack, spike, kick.
// gain: where he's brought down. Short plays look short.
export const LOOKS = [
  { id: 'zero', form: 'zero', s: 'COVER 0', sub: 'NO SAFETY · SEVEN COMING', why: 'No safety and seven coming.|Get it out now. The slant beats press.',
    a: [P('QUICK SLANT', true, 'catch', 'BIG GAIN', 1, 'slant', { gain: 18 }), P('FOUR VERTS', false, 'sack', 'SACKED', 0, 'go', { sk: VERTS }), P('INSIDE ZONE', false, 'stuff', 'STUFFED', 3, 'inside')] },
  { id: 'light', form: 'light', s: 'LIGHT BOX', sub: 'SIX IN THE BOX · TWO DEEP', why: 'Six in the box and two deep.|The numbers are there. Run it.',
    a: [P('INSIDE ZONE', true, 'run', 'BIG GAIN', 3, 'inside', { gain: 13 }), P('FOUR VERTS', false, 'pick', 'PICKED OFF', 1, 'seam', { sk: VERTS }), P('FADE', false, 'swat', 'INCOMPLETE', 0, 'fade')] },
  { id: 'eight', form: 'eight', s: 'EIGHT IN THE BOX', sub: 'ONE HIGH · PRESS CORNERS', why: 'Eight up and one deep.|Fake the run and throw over the top.',
    a: [P('PLAY ACTION', true, 'catch', 'BIG GAIN', 1, 'post', { gain: 27 }), P('POWER', false, 'stuff', 'STUFFED', 3, 'power'), P('DRAW', false, 'stuff', 'STUFFED', 3, 'draw')] },
  { id: 'cover2', form: 'cover2', s: 'COVER 2', sub: 'CORNERS SQUAT · TWO DEEP', why: 'Corners sit in the flat, safeties split deep.|Smash drops it in the hole between them.',
    a: [P('SMASH', true, 'catch', 'BIG GAIN', 1, 'corner', { gain: 19, sk: [[1, 'corner'], [0, 'hitch']] }), P('QUICK OUT', false, 'pick', 'PICKED OFF', 0, 'out'), P('HITCH', false, 'swat', 'INCOMPLETE', 0, 'hitch')] },
  { id: 'cover3', form: 'cover3', s: 'COVER 3', sub: 'SOFT CORNERS · ONE HIGH', why: 'Corners bail and give up eight yards.|Take the hitch every time.',
    a: [P('HITCH', true, 'catch', 'GOOD GAIN', 0, 'hitch', { gain: 9 }), P('GO ROUTE', false, 'swat', 'INCOMPLETE', 2, 'go'), P('POWER', false, 'stuff', 'STUFFED', 3, 'power')] },
  { id: 'cover1', form: 'cover1', s: 'COVER 1', sub: 'MAN UP · PRESS CORNERS', why: 'Man across the board.|Crossers run them into each other.',
    a: [P('MESH', true, 'catch', 'BIG GAIN', 0, 'cross', { gain: 14, sk: MESH }), P('HITCH', false, 'swat', 'INCOMPLETE', 2, 'hitch'), P('BUBBLE', false, 'stuff', 'STUFFED', 1, 'screen')] },
  { id: 'cover4', form: 'cover4', s: 'COVER 4', sub: 'FOUR DEEP · NOTHING SHORT', why: 'Four deep, and they want the deep throw.|Take the stick underneath.',
    a: [P('STICK', true, 'catch', 'GOOD GAIN', 1, 'stick', { gain: 8 }), P('GO ROUTE', false, 'pick', 'PICKED OFF', 2, 'go'), P('POST', false, 'pick', 'PICKED OFF', 1, 'post')] },
  { id: 'overload', form: 'overload', s: 'OVERLOAD', sub: 'THREE OFF THE {NEAR} EDGE', why: 'Three off the {NEAR} edge, nobody {FAR}.|Throw it away from the heat.',
    a: [P('SCREEN {FAR}', true, 'catch', 'BIG GAIN', 2, 'screen', { gain: 16 }), P('SWEEP {NEAR}', false, 'stuff', 'STUFFED', 3, 'sweep'), P('DEEP POST', false, 'sack', 'SACKED', 1, 'post')] },
  { id: 'prevent', form: 'prevent', s: 'PREVENT', sub: 'THREE RUSHING · EIGHT DROPPING', why: 'Eight dropping and three up front.|The draw walks right through.',
    a: [P('DRAW', true, 'run', 'BIG GAIN', 3, 'draw', { gain: 15 }), P('GO ROUTE', false, 'pick', 'PICKED OFF', 2, 'go'), P('POST', false, 'swat', 'INCOMPLETE', 1, 'post')] },
]
// A drive. The state is real: down, distance, ball, clock, timeouts. Every read is one a coach would
// call in that state; it's picked from what fits. Down four to seven, so only a touchdown does it.
const OUT = (n = 'SIDELINE OUT') => P(n, true, 'catch', 'OUT OF BOUNDS', 0, 'out', { oob: 1, g: [8, 13] })
const SLANT = () => P('SLANT', true, 'catch', 'FIRST DOWN', 1, 'slant', { g: [7, 12] })
const DIG = () => P('MIDDLE DIG', false, 'catch', 'CLOCK RUNS', 1, 'dig', { short: 1 })
const DRAWP = res => P('DRAW', false, 'stuff', res, 3, 'draw')
const SPIKEW = () => P('SPIKE IT', false, 'spike', 'LOST A DOWN', 0, null)
const SHOT = () => P('DEEP SHOT', false, 'swat', 'INCOMPLETE', 2, 'go')
const HAIL = () => P('HAIL MARY', false, 'swat', 'INCOMPLETE', 2, 'go', { sk: VERTS })
const CHECK = () => P('CHECKDOWN', false, 'catch', 'SHORT OF THE STICKS', 3, 'flat', { short: 1 })
export const DRIVE_READS = [
  { id: 'quick', can: s => s.down <= 2 && s.dist >= 6 && s.to >= 1 && s.clock >= 60, form: 'cover3', why: 'Plenty of clock and soft corners.|Take the easy yards underneath.', a: () => [P('QUICK HITCH', true, 'catch', 'GOOD GAIN', 0, 'hitch', { g: [5, 9] }), SHOT(), SPIKEW()] },
  { id: 'soft', can: s => s.down === 1 && s.to >= 2 && s.clock >= 55, form: 'prevent', why: 'They are playing way back, with timeouts left.|The draw walks through it.', a: () => [P('DRAW', true, 'run', 'GOOD GAIN', 3, 'draw', { g: [6, 11] }), HAIL(), SPIKEW()] },
  { id: 'medium', can: s => s.down >= 2 && s.dist >= 6 && s.dist <= 10 && s.to >= 1, form: 'cover2', why: 'Second chance, plenty of road.|Hit the slant behind the backers.', a: () => [P('SLANT', true, 'catch', 'GOOD GAIN', 1, 'slant', { g: [7, 11] }), HAIL(), SPIKEW()] },
  { id: 'nots', can: s => s.to === 0 && s.clock > 30, form: 'cover4', why: 'No timeouts.|Only the sideline stops this clock.', a: () => [OUT(), DIG(), DRAWP('CLOCK RUNS')] },
  { id: 'short', can: s => s.dist <= 5 && s.to >= 1, form: 'cover1', why: 'Short yardage, timeouts in the pocket.|Just move the chains.', a: () => [SLANT(), SPIKEW(), SHOT()] },
  { id: 'long', can: s => s.dist >= 11 && s.down >= 2, form: 'light', why: 'Long yardage. Throw past the sticks.|A checkdown only sets up the next down.', a: () => [P('DEEP DIG', true, 'catch', 'FIRST DOWN', 1, 'dig', { g: [13, 17] }), CHECK(), DRAWP('SHORT OF THE STICKS')] },
  { id: 'spike', can: s => s.running && s.to === 0 && s.clock <= 50 && s.down === 1, form: 'prevent', why: 'Clock running, no timeouts.|Spike it. Three downs left.', a: () => [P('SPIKE IT', true, 'spike', 'CLOCK STOPPED', 0, null), DRAWP('CLOCK RUNS'), DIG()] },
  { id: 'chunk', can: s => s.running && s.to === 1 && s.clock <= 75 && s.dist >= 5, form: 'cover2', why: 'Get the chunk and the sideline.|It saves the last timeout.', a: () => [OUT(), DRAWP('CLOCK RUNS'), HAIL()] },
  { id: 'power', can: s => s.dist <= 3 && s.down >= 2 && s.to >= 1, form: 'light', why: 'Six in the box, a timeout in the pocket.|There is room for the run.', a: () => [P('POWER', true, 'run', 'FIRST DOWN', 3, 'power', { g: [3, 7] }), HAIL(), SPIKEW()] },
  { id: 'chains', fallback: 1, can: () => true, form: 'cover3', why: 'A hurry-up down. Get past the sticks,|get out of bounds, keep it moving.', a: () => [OUT(), DRAWP('CLOCK RUNS'), HAIL()] },
]
// the last call: it has to reach the end zone
const FADE = n => P(n, true, 'catch', 'TOUCHDOWN', 0, 'fade')
export const LAST_READS = [
  { id: 'end4', can: s => s.down === 4, form: 'cover3', why: 'Down {TRAIL}. Three points does nothing.|Go win it.', a: s => [P('CORNER ROUTE', true, 'catch', 'TOUCHDOWN', 1, 'corner'), P('FIELD GOAL', false, 'kick', `STILL DOWN ${s.trail - 3}`, 0, null), P('SPIKE IT', false, 'spike', 'TURNOVER ON DOWNS', 0, null)] },
  { id: 'endto', can: s => s.to === 0 && s.dist <= 6, form: 'eight', why: 'No timeouts. A run short of the line ends it.|An incomplete fade stops the clock.', a: () => [FADE('FADE'), P('QB SNEAK', false, 'stuff', 'STUFFED', 3, 'inside'), SPIKEW()] },
  { id: 'endlow', can: s => s.clock <= 25, form: 'prevent', why: 'Clock is nearly gone. No more underneath.|It has to reach the end zone.', a: () => [P('END ZONE SHOT', true, 'catch', 'TOUCHDOWN', 2, 'go'), DRAWP('STUFFED'), SPIKEW()] },
  { id: 'endany', can: () => true, form: 'cover1', why: 'Down {TRAIL}, and it takes all of it.|Take the shot at the end zone.', a: () => [FADE('END ZONE FADE'), DRAWP('STUFFED'), SPIKEW()] },
]
const START_G = 68
// how long the score, the clock and the down sit there before the first play clock starts
export const READ_BEAT = 2500
const WORD = { 4: 'four', 5: 'five', 6: 'six', 7: 'seven' }

const side = m => (m ? ['RIGHT', 'LEFT'] : ['LEFT', 'RIGHT'])
const fill = (s, m) => s.replaceAll('{NEAR}', side(m)[0]).replaceAll('{FAR}', side(m)[1])
const fx = (x, m) => (m ? 360 - x : x)
const ORD = ['', '1ST', '2ND', '3RD', '4TH']
const clockText = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
let callSerial = 0
// one call, ready to play: mirrored, the plays in a seeded order, the right one anywhere
function mkCall(src, opts0, r, st) {
  const mirror = r() < 0.5
  const order = [0, 1, 2]
  for (let i = 2; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
  const opts = order.map(i => ({ ...opts0[i], n: fill(opts0[i].n, mirror) }))
  const form = FORM[src.form].map(([x, yd, t, b]) => ({ x: fx(x, mirror), yd, t, b: !!b }))
  return {
    id: src.id, mirror, opts, form, c: opts.findIndex(o => o.ok),
    s: src.s ? fill(src.s, mirror) : null, sub: src.sub ? fill(src.sub, mirror) : null,
    why: fill(src.why, mirror).replaceAll('{TRAIL}', WORD[st?.trail] ?? st?.trail).split('|'),
    st: st ? { ...st } : null,
    key: `${src.id}|${mirror ? 1 : 0}|${order.join('')}|${callSerial++ % 64}`,
    at: 0, pick: -1, shown: -1, ok: false, late: false, G0: st ? st.G : 50, G1: st ? st.G : 50, play: null,
  }
}

// ── A play, worked out when it's called: who goes where, and when he goes down ────────────────────
const RV = 0.0105                  // yards a ms, on his feet
const WRAP_MS = 460                // from the moment a man has him to both of them on the turf
function pathLen(pts) { let t = 0; for (let i = 1; i < pts.length; i++) t += Math.hypot((pts[i][0] - pts[i - 1][0]) / 7, pts[i][1] - pts[i - 1][1]); return t }
function nearestTo(form, x, yd, n, pred) {
  return form.filter(pred).map(d => ({ d, e: Math.hypot((d.x - x) / 7, d.yd - yd) })).sort((a, b) => a.e - b.e).slice(0, n).map(a => a.d)
}
const BODY_YD = 1.8   // brought down, he falls forward: the spot is at his head, so his feet stop this far short of it
// a runner's cuts: a new angle every so often, the odd sharp one. Fades out by f = 1, so he still ends on his spot
const weave = (pt, f, seed) => {
  // one or two cuts on a run, not a wiggle
  return Math.sin(pt / 520 + seed) * 11 * Math.sin(clamp(f, 0, 1) * Math.PI)
}
function buildPlay(c, opt, gain, { td = false, res = null } = {}) {
  const m = c.mirror
  // Tc: the moment the tackler has him. T: they're down, the whistle. slide: what momentum adds, in yards
  const pl = { kind: opt.kind, opt, gain, td, res: res ?? opt.res, T: 900, Tc: 900, slide: 0, tRel: 200, tLand: 0, pts: null, ex: 0, cx: 0, tacklers: [], w: opt.w }
  const k = opt.kind
  if (k === 'spike') { pl.T = pl.Tc = 520; pl.gain = 0; return pl }
  if (k === 'kick') { pl.T = pl.Tc = 1100; pl.gain = 0; return pl }
  if (k === 'sack') {
    pl.Tc = 860; pl.T = pl.Tc + WRAP_MS
    pl.ex = fx(QB.x, m)
    pl.tacklers = nearestTo(c.form, fx(QB.x, m), 0, 2, d => d.b || d.t === 'd')
    return pl
  }
  const start = opt.w === 3 ? RB : WR[opt.w]
  const x0 = start.x, inward = inwardOf(x0)
  if (k === 'run' || k === 'stuff') {
    pl.slide = gain > 1 ? 1.2 : 0.4
    const shape = routeFor(opt.r, x0, Math.max(0.2, gain - pl.slide - (td ? 0 : BODY_YD)) - start.yd)
    pl.pts = shape.map(([dx, dy]) => [fx(clamp(x0 + dx * inward, 16, 344), m), start.yd + dy])
    pl.Tc = Math.max(k === 'stuff' ? 620 : 760, pathLen(pl.pts) / RV)
    pl.T = pl.Tc + WRAP_MS
    const end = pl.pts[pl.pts.length - 1]
    pl.ex = end[0]
    pl.tacklers = nearestTo(c.form, end[0], Math.max(2, gain), 2, d => d.t !== 'd' || k === 'stuff')
    return pl
  }
  // a pass: the route to where it's caught, then whatever he gets after it
  const swat = k === 'swat' || k === 'pick'
  const deepish = opt.r === 'go' || opt.r === 'seam' || opt.r === 'post' || opt.r === 'fade'
  const depth = swat ? (deepish ? 19 : opt.r === 'hitch' ? 7 : opt.r === 'out' ? 8 : 12) : opt.oob ? gain : td ? gain - 1 : opt.r === 'dig' ? 8 : Math.max(1, gain - clamp(gain * 0.3, 1.5, 6))
  const shape = routeFor(opt.r, x0, depth)
  pl.pts = shape.map(([dx, dy]) => [fx(clamp(x0 + dx * inward, 14, 346), m), (opt.w === 3 ? start.yd : 0) + dy])
  const end = pl.pts[pl.pts.length - 1]
  const vr = td && depth > 20 ? RV * 1.35 : RV
  const landAt = Math.max(760, pathLen(pl.pts) / vr)
  const dist = Math.hypot(end[0] - fx(QB.x, m), (end[1] - QB.yd) * 9)
  const flight = 130 + dist / 0.42
  pl.flight = flight
  pl.tRel = Math.max(240, landAt - flight)
  pl.tLand = pl.tRel + flight
  if (swat) {
    pl.gain = 0
    pl.tacklers = nearestTo(c.form, end[0], end[1], 2, d => d.t !== 'd')
    pl.T = pl.Tc = k === 'pick' ? pl.tLand + 900 : pl.tLand + 520
    pl.ex = end[0]
    return pl
  }
  pl.cx = end[0]
  pl.ex = opt.oob ? (end[0] < 180 ? 2 : 358) : clamp(end[0] + (end[0] < 180 ? 5 : -5), 16, 344)
  const after = Math.max(0, gain - end[1])
  // a man who steps out, or scores, isn't tackled
  pl.slide = opt.oob || td ? 0 : Math.min(1.2, Math.max(0.3, after * 0.4))
  pl.Tc = pl.tLand + (opt.oob ? 420 : Math.max(240, Math.max(0, after - pl.slide) / RV))
  pl.T = opt.oob || td ? pl.Tc : pl.Tc + WRAP_MS
  // who gets there: the closest man to where he goes down, and another just behind
  pl.tacklers = nearestTo(c.form, pl.ex, gain, 2, d => d.t !== 'd')
  return pl
}

export function make({ v, seed, game, situation = null }) {
  const r = rngOf(seed)
  const drive = game === 'two-minute'
  const T = drive ? driveMs(v) : audibleMs(v)
  const pick = list => list[Math.floor(r() * list.length)]
  // the drive's real state
  const sit = drive ? situation ?? momentSituation(game, seed) : situation
  const st = drive ? { down: 1, dist: 10, G: START_G, clock: sit.clock, running: false, to: pick([0, 1, 2, 3]), trail: sit.opp - sit.mine, period: sit.period } : null
  const newCall = () => {
    if (!drive) { const L = pick(LOOKS); return mkCall(L, L.a, r, null) }
    const goal = st.down === 4 || st.clock <= 25 || st.G <= 15
    const fits = (goal ? LAST_READS : DRIVE_READS).filter(q => q.can(st))
    const R = pick(fits.length > 1 ? fits.filter(q => !q.fallback && q.id !== 'endany') : fits)
    const call = mkCall(R, R.a(st), r, st)
    call.endzone = goal
    return call
  }
  const g = {
    t: 0, delays: 0, game, zones: 'three', fx: [], done: null, outro: drive ? 1900 : 2200, stamp: null,
    flair: flairOf(seed), nudge: nudge(), dirt: particles(40, flairOf(seed) + 5),
    sit, beat: drive, drive, call: null, i: 0, end: null, phase: 'read', T, made: 0, outs: 0, ball: drive ? START_G : 40, nextAt: Infinity, st,
    hud: { prompt: null, dots: null },
    tick(dt) {
      g.t += dt
      const c = g.call
      if (g.beat && g.t >= c.at) { g.beat = false; g.fx.push('tap') }
      if (g.phase === 'read') {
        // the last three on the play clock, out loud
        const left = Math.ceil((c.at + T - g.t) / 1000)
        if (left !== c.lastSec) { c.lastSec = left; if (left <= 3 && left > 0 && !g.beat) g.fx.push('tick') }
        if (g.t >= c.at + T) answer(-1)
        return
      }
      if (g.phase === 'play') {
        const p = c.play
        if (!c.blown && g.t >= c.pickAt + p.T) {
          c.blown = true
          if (p.kind !== 'spike' && p.kind !== 'kick' && !p.td && !p.opt?.oob) g.fx.push('whistle')
          g.fx.push(c.ok || p.td ? 'h:medium' : 'h:light')
          if (!drive || c.final) finish()
        }
        if (g.t >= g.nextAt && !g.done) next()
      }
    },
    input(a) {
      if (a.kind !== 'down' || g.phase !== 'read' || g.beat) return
      const z = a.zone ?? (a.x < 120 ? 0 : a.x < 240 ? 1 : 2)
      if (z === 0 || z === 1 || z === 2) answer(z)
    },
  }
  function finish() {
    const c = g.call
    if (!drive) {
      const elapsed = c.pickAt - c.at
      const opt = c.pick >= 0 ? c.opts[c.pick] : null
      g.done = outcome(c.ok ? clamp(1 - (elapsed / T) * 0.5, 0.5, 1) : 0, c.ok, c.why.join(' '), { made: c.ok ? 1 : 0, of: 1 }, c.late)
      const word = c.late ? 'DELAY OF GAME' : c.ok ? `${c.play.gain} YARD GAIN` : opt.res
      g.stamp = { text: word, good: c.ok, at: g.t + 40, size: word.length > 10 ? 38 : 46 }
      return
    }
    const hit = g.end === 'td'
    const word = { td: 'TOUCHDOWN', downs: 'TURNOVER ON DOWNS', time: 'OUT OF TIME', pick: 'INTERCEPTED', kick: `STILL DOWN ${st?.trail - 3}`, delay: 'DELAY OF GAME' }[g.end] ?? 'OUT OF TIME'
    const note = { td: 'Touchdown drive.', downs: 'Turnover on downs.', time: 'Out of time.', pick: 'Intercepted.', kick: `A field goal does nothing down ${WORD[st?.trail] ?? st?.trail}.`, delay: 'Too many delays.' }[g.end] ?? 'Out of time.'
    // a touchdown with time to spare is better; short of it, how far you got
    const score = hit ? clamp(0.62 + 0.38 * (st.clock / 60), 0.62, 1) : clamp((START_G - st.G) / START_G, 0, 1) * 0.46
    g.done = outcome(score, hit, note, { made: g.made, of: g.i + 1 }, g.end === 'delay' || (g.end === 'time' && g.outs > 0))
    g.stamp = { text: word, good: hit, at: g.t + 60, size: word.length > 12 ? 34 : 44 }
    // (a touchdown drive gets its moment; a pick, the man showing off the ball)
    if (hit) g.outro = 3500
    else if (g.end === 'pick') g.outro = 2800
    g.fx.push(hit ? 'h:heavy' : 'h:medium')
  }
  function next() {
    const c = g.call
    g.i++
    g.call = newCall()
    g.call.at = g.t
    g.nextAt = Infinity
    g.phase = 'read'
    g.fx.push('tap')
  }
  function answer(z) {
    const c = g.call
    c.pick = z
    c.shown = z
    c.pickAt = g.t
    c.late = z < 0
    c.ok = z === c.c
    if (c.late) g.outs++
    if (c.ok) g.made++
    if (g.hud.dots) g.hud.dots[g.i] = c.ok
    g.fx.push(c.ok ? 'tap' : c.late ? 'whistle' : 'pop', 'h:medium')
    g.phase = 'play'
    const opt = z >= 0 ? c.opts[z] : null
    if (!drive) {
      if (c.late) { c.play = { kind: 'delay', opt: null, gain: 0, T: 300, res: 'DELAY OF GAME', tacklers: [] }; return }
      c.play = buildPlay(c, opt, opt.gain ?? (opt.kind === 'sack' ? -7 : opt.kind === 'stuff' ? 1 : 0))
      return
    }
    // the drive: what this call really gets
    const s = st
    const roll = ([a, b]) => Math.round(lerp(a, b, r()))
    const wasDown = s.down, wasDist = s.dist
    let gain, res = null, td = false, gone = null, ran = opt
    if (c.late) gain = -5
    else if (c.ok) {
      const asked = opt.g ? roll(opt.g) : opt.kind === 'spike' ? 0 : s.dist + 1
      // a shot at the end zone: from close it gets there, from far out it's a big gain past the sticks
      if (opt.kind === 'spike') gain = 0
      else if (c.endzone) gain = s.G <= 30 ? s.G + 3 : Math.max(s.dist + roll([0, 2]), roll([14, 24]))
      else gain = s.down >= 3 ? Math.max(asked, s.dist + roll([0, 2])) : asked
      td = opt.kind !== 'spike' && gain >= s.G
      if (td) gain = s.G + 3
      res = td ? 'TOUCHDOWN' : opt.kind === 'spike' ? 'CLOCK STOPPED' : opt.oob ? 'OUT OF BOUNDS' : gain >= s.dist ? 'FIRST DOWN' : 'GOOD GAIN'
    } else if (opt.kind === 'sack') gain = -7
    else if (opt.kind === 'stuff') gain = roll([0, 2])
    else if (opt.r === 'dig') gain = roll([8, 12])
    else if (opt.short) gain = clamp(Math.min(s.dist - 2, roll([3, 8])), 1, 9)
    else gain = 0
    // the wrong call can lose it: a deep ball into coverage gets picked, and a field goal doesn't win it
    if (!c.ok && !c.late) {
      if (opt.kind === 'kick') gone = 'kick'
      else if (opt.kind === 'swat' && r() < 0.3) { gone = 'pick'; ran = { ...opt, kind: 'pick' }; res = 'INTERCEPTED' }
    }
    if (c.late && ++g.delays >= 3) gone = 'delay'
    c.play = c.late ? { kind: 'delay', opt: null, gain: -5, T: 300, res: 'DELAY OF GAME', tacklers: [] } : buildPlay(c, ran, gain, { td, res })
    const moved = c.play.gain
    c.G0 = s.G
    c.G1 = td ? 0 : clamp(s.G - moved, 1, 75)
    c.td = td
    // and what that does to the down, the distance and the clock.
    // A spike costs a down and a second. Incomplete or out of bounds stops it. Only a man tackled in bounds lets it run.
    const inPlay = !c.late && opt.kind !== 'spike' && opt.kind !== 'kick' && opt.kind !== 'swat' && !opt.oob
    s.G = c.G1
    let burn = c.late ? 0 : opt.kind === 'spike' ? 1 : inPlay ? 20 : 6
    let stopped = !inPlay
    // late, with one in your pocket, you take the timeout
    if (inPlay && !td && s.to > 0 && s.clock - burn <= 40) { burn = 6; s.to--; stopped = true; c.play.sub = 'TIMEOUT' }
    // past the sticks is a first down, however he got there, and the board says so
    if (!c.late && opt.kind !== 'spike' && !td && !gone && moved >= wasDist) { c.play.sub = opt.oob ? 'OUT OF BOUNDS' : c.play.sub ?? null; c.play.res = 'FIRST DOWN' }
    if (c.late) s.dist = Math.min(s.dist + 5, 20)
    else if (moved >= wasDist) { s.down = 1; s.dist = Math.min(10, s.G) }
    else { s.down = Math.min(4, s.down + 1); s.dist = Math.max(1, s.dist - moved) }
    s.clock = Math.max(0, s.clock - burn)
    s.running = !stopped
    g.ball = s.G
    // what ends it: the score, a turnover, fourth down, or the clock
    const failed4 = !td && !c.late && wasDown === 4 && moved < wasDist
    g.end = td ? 'td' : gone ?? (failed4 ? 'downs' : s.clock <= 0 ? 'time' : null)
    if (g.end) { c.final = true; return }
    g.nextAt = g.t + c.play.T + (c.ok ? 850 : 1050)
  }
  g.call = newCall(false)
  g.call.at = drive ? READ_BEAT : 420       // a beat to see the field before the clock starts
  return g
}

// ── Drawing ─────────────────────────────────────────────────────────────────────────────────────
const sprites = new Map()
function sprite(view, key, paint) {
  const id = `${key}|${view.h}|${view.px}`
  let c = sprites.get(id)
  if (!c) {
    if (sprites.size > 14) { sprites.clear(); PRE_TAGS.clear() }
    c = document.createElement('canvas')
    c.width = Math.ceil(view.w * view.px); c.height = Math.ceil(view.h * view.px)
    const x = c.getContext('2d')
    x.scale(view.px, view.px)
    paint(x)
    sprites.set(id, c)
  }
  return c
}
const CARD_H = 122
// the line of scrimmage stays above the cards, wherever that is in the flat field the camera looks at
const losOf = h => Math.round(untilt({ w: 360, h }, 180, h - CARD_H - 118).y)
const pydOf = los => clamp((los - 58) / 60, 5.5, 10)
// a defender's or blocker's spot on the screen: nobody's on top of the line
const yOf = (yd, los, pyd) => (yd >= 0 ? los - Math.max(14, yd * pyd) : yd > -2 ? los + 14 : los - yd * pyd)

// the small drawing on a card: blue-board style
function arrowTo(x, pts) {
  x.beginPath()
  x.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1])
  x.stroke()
  const a = pts[pts.length - 2], b = pts[pts.length - 1]
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
  x.fillStyle = x.strokeStyle
  x.beginPath()
  x.moveTo(b[0] + Math.cos(ang) * 7, b[1] + Math.sin(ang) * 7)
  x.lineTo(b[0] + Math.cos(ang + 2.3) * 6, b[1] + Math.sin(ang + 2.3) * 6)
  x.lineTo(b[0] + Math.cos(ang - 2.3) * 6, b[1] + Math.sin(ang - 2.3) * 6)
  x.closePath(); x.fill()
}
function absRoute(w, shape, mirror) {
  const start = w === 3 ? RB : WR[w]
  const inward = inwardOf(start.x)
  return SHAPES[shape].map(([dx, dy]) => [fx(clamp(start.x + dx * inward, 14, 346), mirror), (w === 3 ? start.yd : 0) + dy])
}
function paintSketch(x, opt, cx, top, H, mirror) {
  const base = top + H - 10
  const X = px => cx + (px - 180) * 0.29
  const list = opt.sk ?? (opt.r ? [[opt.w, opt.r]] : [])
  let most = 8
  for (const [w, shape] of list) for (const [, yd] of absRoute(w, shape, mirror)) most = Math.max(most, yd)
  const sc = (H - 22) / most
  const Y = yd => base - yd * sc
  x.strokeStyle = 'rgba(255,255,255,.4)'; x.lineWidth = 2
  x.beginPath(); x.moveTo(cx - 50, base); x.lineTo(cx + 50, base); x.stroke()
  x.fillStyle = 'rgba(255,255,255,.75)'
  for (const r of WR) { x.beginPath(); x.arc(X(fx(r.x, mirror)), base + 3, 3, 0, Math.PI * 2); x.fill() }
  x.beginPath(); x.arc(X(fx(RB.x, mirror)), base + 7, 3, 0, Math.PI * 2); x.fill()
  x.lineCap = 'round'; x.lineJoin = 'round'
  if (opt.kind === 'spike') {
    football(x, cx, base - 22, { ang: 0.4, scale: 1.1 })
    x.strokeStyle = '#fff'; x.lineWidth = 2.5
    arrowTo(x, [[cx, base - 12], [cx, base - 3]])
    return
  }
  if (opt.kind === 'kick') {
    x.strokeStyle = '#ffd24a'; x.lineWidth = 3
    x.beginPath(); x.moveTo(cx - 14, base - 34); x.lineTo(cx - 14, base - 18); x.lineTo(cx + 14, base - 18); x.lineTo(cx + 14, base - 34); x.moveTo(cx, base - 18); x.lineTo(cx, base - 2); x.stroke()
    return
  }
  x.lineWidth = 3
  for (const [w, shape] of list) {
    const pts = absRoute(w, shape, mirror).map(([px, yd]) => [X(px), Y(yd)])
    x.strokeStyle = w === 3 ? '#ffd24a' : '#fff'
    arrowTo(x, pts)
  }
}
function paintCards(x, view, call) {
  const { w, h } = view
  const top = h - CARD_H, pw = (w - 6 * 4) / 3
  x.fillStyle = 'rgba(6,10,12,.94)'; x.fillRect(0, top - 6, w, CARD_H + 6)
  call.opts.forEach((o, i) => {
    const px = 6 + i * (pw + 6)
    x.fillStyle = 'rgba(255,255,255,.1)'; rr(x, px, top, pw, CARD_H - 8, 5); x.fill()
    paintSketch(x, o, px + pw / 2, top + 2, 62, call.mirror)
    const n = o.n.length
    text(x, o.n, px + pw / 2, top + 84, { font: DISPLAY, size: n <= 8 ? 25 : n <= 11 ? 20 : 17, color: '#fff' })
  })
}
function paintLookWords(x, view, call) {
  const hy = tilt(view, 0, 0).y
  x.fillStyle = 'rgba(6,10,12,.92)'; x.fillRect(0, 44, view.w, Math.max(62, hy < 122 ? hy - 44 : 62))
  x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(0, 44, view.w, 1)
  text(x, call.s, 12, 66, { font: DISPLAY, size: 27, align: 'left', color: '#fff' })
  text(x, call.sub, 12, 92, { size: 16, track: 0.6, align: 'left', color: '#ffd24a' })
}
const ballOn = G => (G > 50 ? `OWN ${100 - G}` : G === 50 ? 'MIDFIELD' : G <= 0 ? 'GOAL LINE' : `OPP ${G}`)
function paintBoard(x, view, call) {
  const { w } = view
  const s = call.st
  // (down to the wall under the crowd on a short screen, so the wall's boards aren't cut in half)
  const hy = tilt(view, 0, 0).y
  x.fillStyle = 'rgba(6,10,12,.92)'; x.fillRect(0, 44, w, Math.max(62, hy < 122 ? hy - 44 : 62))
  x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(0, 44, w, 1)
  const dd = `${ORD[s.down]} & ${s.G <= s.dist ? 'GOAL' : s.dist}`
  text(x, dd, 12, 66, { font: DISPLAY, size: 27, align: 'left' })
  text(x, `${s.period} ${clockText(s.clock)}`, w / 2 + 22, 66, { font: DISPLAY, size: 27, color: '#ffd24a' })
  text(x, `DOWN ${s.trail}`, w - 12, 66, { font: DISPLAY, size: 27, align: 'right' })
  text(x, `BALL ON ${ballOn(s.G)}`, 12, 92, { size: 16, track: 0.6, align: 'left', color: 'rgba(255,255,255,.8)' })
  text(x, s.running ? 'RUNNING' : 'STOPPED', w / 2 + 22, 92, { size: 16, track: 0.6, color: s.running ? '#ffb0a6' : 'rgba(255,255,255,.8)' })
  text(x, s.to === 0 ? 'NO TIMEOUTS' : s.to === 1 ? '1 TIMEOUT' : `${s.to} TIMEOUTS`, w - 12, 92, { size: 16, track: 0.6, align: 'right', color: s.to === 0 ? '#ffb0a6' : 'rgba(255,255,255,.8)' })
}
// before the first play clock: where the cards will be, the situation
function paintSituation(x, view, g, s) {
  const { w, h } = view, top = h - CARD_H, sit = g.sit
  x.fillStyle = 'rgba(6,10,12,.94)'; x.fillRect(0, top - 6, w, CARD_H + 6)
  text(x, `${sit.us} ${sit.mine}   ${sit.them} ${sit.opp}`, w / 2, top + 26, { font: DISPLAY, size: 38 })
  text(x, `${clockText(s.clock)} LEFT IN THE ${s.period} · ${s.to === 0 ? 'NO TIMEOUTS' : s.to === 1 ? '1 TIMEOUT' : `${s.to} TIMEOUTS`}`, w / 2, top + 60, { size: 18, track: 0.8, color: '#ffd24a' })
  text(x, `${ORD[s.down]} & ${s.dist} · BALL ON ${ballOn(s.G)}`, w / 2, top + 86, { size: 18, track: 0.8 })
}
// a point along a polyline (x units, y yards), f 0-1 by distance, plus the way it's going
const O = { x: 0, y: 0, ux: 0, uy: 1 }
function along(pts, f) {
  let total = 0
  for (let i = 1; i < pts.length; i++) total += Math.hypot((pts[i][0] - pts[i - 1][0]) / 7, pts[i][1] - pts[i - 1][1])
  let d = clamp(f, 0, 1) * total
  for (let i = 1; i < pts.length; i++) {
    const dx = (pts[i][0] - pts[i - 1][0]) / 7, dy = pts[i][1] - pts[i - 1][1]
    const len = Math.hypot(dx, dy)
    if (d <= len || i === pts.length - 1) {
      const k = len ? d / len : 0
      O.x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k; O.y = pts[i - 1][1] + dy * k
      O.ux = len ? dx / len : 0; O.uy = len ? dy / len : 1
      return O
    }
    d -= len
  }
  return O
}

export function draw(ctx, g, view) {
  const { w, h } = view
  const los = losOf(h), pyd = pydOf(los)
  const c = g.call, col = view.colors, them = themOf(view)
  const baseKey = `${c.key}|${col.us}|${col.trim}|${them.color}|${them.trim}`
  const playing = c.pick !== -1
  const pt = playing ? g.t - c.pickAt : 0
  const p = c.play
  const showWhy = playing && (!g.drive || !c.ok)
  const bandY = g.drive ? 106 : 44

  // the camera holds on the play, then walks up to the new line of scrimmage
  let G = c.G0
  if (playing && p && g.drive) {
    const camFrom = c.td ? Math.max(200, p.T * 0.25) : p.T + 150
    const camEnd = c.td ? p.T : p.T + 900
    G = lerp(c.G0, Math.max(c.G1, 6), easeInOut(prog(pt, camFrom, camEnd)))
  }
  const dy = (c.G0 - G) * pyd
  // the camera leans in on the end of the drive (or a man going down hard), and back out for the next snap
  ctx.save()
  if (playing && p?.focus && (c.final || pt < p.T + 120)) { leanIn(ctx, g, view, p.focus.x, p.focus.y, p.focus.size, 1.9, 0.5); g.lastFx = p.focus.x; g.lastFy = p.focus.y }
  else if ((g.cz ?? 1) > 1.002) leanIn(ctx, g, view, g.lastFx ?? 180, g.lastFy ?? los, 0)
  // the whole field, painted once; the goal line sits this far down the painting
  const goalAt = los + 24, gMax = 78
  rollingField(ctx, view, {
    key: `calls|${col.us}|${col.trim}|${view.field?.id ?? ''}`,
    len: h + goalAt - los + gMax * pyd,
    at: Math.round((goalAt - los + G * pyd) * 2) / 2,
    paint: x => paintFieldFlat(x, { w, h: h + goalAt - los + gMax * pyd, px: view.px, field: view.field }, goalAt, pyd, col.us),
    under: x => stands(x, view, 'field', [col.us, col.trim]),
    // (the benches go by with the field, and are only redrawn when it moves)
    over: x => { floodlight(x, view); if (view.field) goalPosts(x, view, los - G * pyd - 10 * pyd); endZonePylons(x, view, los - G * pyd, pyd); drawBenches(x, view, los - G * pyd, pyd, col, them) },
    strips: 96,
  })
  const lite = lightFx()
  if (!lite) crowdPop(ctx, view, g.popTeam ?? (g.popTeam = [col.us, col.trim]), g.t - (g.popAt ?? -1e9), { ms: g.popMs ?? 1500, power: g.popP ?? 1 })
  turfLine(ctx, view, SL, SR, los + dy, '#3f86ff', 3)
  if (g.drive && c.st && !c.td && c.G0 > c.st.dist) turfLine(ctx, view, SL, SR, los + dy - c.st.dist * pyd, '#f7d64a', 4)
  else if (!g.drive) turfLine(ctx, view, SL, SR, los - 10 * pyd, '#f7d64a', 4)
  // the chain crew, on the sideline
  if (g.drive && c.st) {
    chainStick(ctx, view, SR + 5, los + dy, String(c.st.down))
    if (!c.td && c.G0 > c.st.dist) chainStick(ctx, view, SR + 5, los + dy - c.st.dist * pyd)
  }
  if (!playing) {
    // (the names stay off the baked picture: drawn over it each frame, sharp on the stage's name layer)
    const preId = `pre|${baseKey}|${view.h}|${view.px}`
    ctx.drawImage(sprite(view, `pre|${baseKey}`, x => { TAG_SINK = []; drawSet(x, view, c, los, pyd, col, them, 0); PRE_TAGS.set(preId, TAG_SINK); TAG_SINK = null }), 0, 0, w, h)
    for (const t of PRE_TAGS.get(preId) ?? []) nameTag(ctx, view, t.x, t.y, t.name, t.k)
    const qbLook = castOf(c, view.cast).qb
    warmQb({ color: col.us, trim: col.trim, pants: col.trim, skin: qbLook?.skin ?? skinOf(QB_NUM * 7), number: qbLook?.number ?? QB_NUM, kit: 'pads' })
    // what comes after, a few a frame, so the payoff doesn't cost a frame: his reactions, both sidelines
    if (!g.warmList) {
      const us = { color: col.us, trim: col.trim, pants: col.trim, step: null, kit: 'pads', carry: false }, th = { color: them.color, trim: them.trim, pants: them.trim, step: null, kit: 'pads', carry: false }
      g.warmList = []
      for (const pose of ['arms-up', 'reach-r', 'hands-head', 'hips']) g.warmList.push({ ...us, skin: qbLook?.skin ?? skinOf(QB_NUM * 7), number: qbLook?.number ?? QB_NUM, dir: 'up', pose })
      for (let n = 0; n <= 6; n++) {
        const pose = n % 3 === 2 ? 'reach-r' : 'arms-up'
        g.warmList.push({ ...us, skin: skinOf(n), number: null, dir: 'side', pose }, { ...th, skin: skinOf(n + 3), number: null, dir: 'side', pose })
      }
    }
    for (let n = 0; n < 3 && g.warmList.length; n++) warmAthlete(g.warmList.pop())
  } else if (p?.kind === 'delay') drawSet(ctx, view, c, los, pyd, col, them, dy)
  else drawPlay(ctx, g, view, c, p, pt, los, pyd, col, them, dy)
  if (!lite) g.dirt.draw(ctx, g.t)
  ctx.restore()
  vignette(ctx, view)

  // the words at the top
  if (g.drive) {
    ctx.drawImage(sprite(view, `board|${c.key}|${c.st.trail}`, x => paintBoard(x, view, c)), 0, 0, w, h)
    // the clock on the board runs while the play does
    if (playing && p && p.kind !== 'delay' && g.st.clock !== c.st.clock) {
      const secs = Math.round(lerp(c.st.clock, g.st.clock, prog(pt, 0, p.T)))
      ctx.fillStyle = '#080c0f'; ctx.fillRect(w / 2 + 22 - 62, 50, 124, 30)
      text(ctx, `${c.st.period} ${clockText(secs)}`, w / 2 + 22, 66, { font: DISPLAY, size: 27, color: '#ffd24a' })
    }
  }
  else if (!playing) ctx.drawImage(sprite(view, `words|${c.key}`, x => paintLookWords(x, view, c)), 0, 0, w, h)
  if (showWhy) {
    ctx.fillStyle = 'rgba(6,10,12,.82)'; ctx.fillRect(0, bandY, w, 58)
    text(ctx, c.why[0], w / 2, bandY + (c.why[1] ? 18 : 29), { size: 19, track: 0.5, color: '#fff' })
    if (c.why[1]) text(ctx, c.why[1], w / 2, bandY + 41, { size: 19, track: 0.5, color: '#fff' })
  }
  // what came of it, once it's over, and not before
  if (g.drive && playing && p && pt >= p.T && !c.final) {
    const yards = p.kind === 'spike' || p.kind === 'kick' || p.kind === 'swat' ? '' : p.kind === 'delay' ? '5 YARD PENALTY' : p.gain > 0 ? `${p.gain} YARD GAIN` : p.gain < 0 ? `LOSS OF ${-p.gain}` : 'NO GAIN'
    // (a good gain that isn't a first down just says the yards)
    const word = p.res === 'GOOD GAIN' ? yards : p.res
    const sub = [p.sub, word === yards ? '' : yards].filter(Boolean).join(' · ')
    const size = word.length > 12 ? 32 : 46, th = size + 16 + (sub ? 22 : 0)
    ctx.font = `${size}px ${DISPLAY}`
    const tw = ctx.measureText(word).width + 26, land = 1 + 0.5 * (1 - easeOut(clamp((pt - p.T) / 110, 0, 1)))
    ctx.save(); ctx.translate(w / 2, Math.max(bandY + 96, h * 0.3)); ctx.scale(land, land); ctx.rotate(-0.03)
    ctx.fillStyle = c.ok ? GOOD : BAD; ctx.fillRect(-tw / 2, -th / 2, tw, th)
    text(ctx, word, 0, sub ? -9 : 2, { font: DISPLAY, size, color: '#07100b' })
    if (sub) text(ctx, sub, 0, th / 2 - 13, { size: 18, track: 0.8, color: '#07100b' })
    ctx.restore()
  }
  // the play clock
  if (!playing && !g.beat) {
    const rem = Math.max(0, c.at + g.T - g.t)
    const secs = Math.ceil(rem / 1000)
    const hot = rem <= 1000
    const cy = 114, cx = w - 76
    ctx.fillStyle = hot ? BAD : '#06090c'; rr(ctx, cx, cy, 66, 66, 6); ctx.fill()
    text(ctx, String(secs), cx + 33, cy + 31, { font: DISPLAY, size: 46, color: hot ? '#07100b' : '#fff' })
    ctx.fillStyle = hot ? '#07100b' : '#ffd24a'
    ctx.fillRect(cx + 7, cy + 57, 52 * clamp(rem / g.T, 0, 1), 4)
  }
  // the three plays
  if (g.beat) paintSituation(ctx, view, g, c.st)
  else ctx.drawImage(sprite(view, `cards|${c.key}`, x => paintCards(x, view, c)), 0, 0, w, h)
  if (view.keys && !playing && !g.beat) {
    const pw = (w - 24) / 3
    for (let i = 0; i < 3; i++) keyCap(ctx, 6 + i * (pw + 6) + pw - 15, h - CARD_H + 13, THREE_KEYS[i])
  }
  if (playing) {
    const top = h - CARD_H, pw = (w - 24) / 3
    const mark = (i, color) => { ctx.strokeStyle = color; ctx.lineWidth = 4; rr(ctx, 6 + i * (pw + 6), top, pw, CARD_H - 8, 5); ctx.stroke() }
    if (c.shown >= 0 && c.shown !== c.c) mark(c.shown, BAD)
    mark(c.c, GOOD)
  }
  // the host draws the stamp: over the field, clear of the cards and the pile
  if (g.stamp && !g.stamp.y) g.stamp.y = Math.max(bandY + 96, h * 0.3)
}

// one man on the field, in the broadcast's look
const M = { color: '', trim: '', pants: null, skin: '', number: null, dir: 'up', step: null, kit: 'pads', carry: false, size: 1, pose: null, fall: 0, fallX: 0, lift: 0 }
// a picture being baked keeps its names here instead (they're drawn live over it), by the picture
let TAG_SINK = null
const PRE_TAGS = new Map()
function drawCast(ctx, view, list, col, them) {
  // back to front; a man with his arms round another is drawn on top of him
  list.sort((a, b) => a.y + (a.top ? 2 : 0) - (b.y + (b.top ? 2 : 0)))
  for (const m of list) {
    M.color = m.d ? them.color : col.us
    M.trim = m.d ? them.trim : col.trim
    M.pants = M.trim
    M.skin = m.look?.skin ?? skinOf(m.n * 7)
    M.number = m.look?.number ?? m.n
    M.dir = m.dir ?? (m.d ? 'down' : 'up')
    M.step = m.step ?? null
    M.size = m.size ?? 0.86
    M.pose = m.pose ?? null
    M.fall = m.fall ?? 0
    M.fallX = m.fallX ?? 0
    M.carry = !!m.carry
    M.lift = m.lift ?? 0
    athlete(ctx, view, m.x, m.y, M)
    // his name goes down with him: a man nearer the camera stands in front of it
    if (m.look && !m.fall) {
      const q = tilt(view, m.x, m.y)
      const ty = q.y + (m.lo ? 7.5 * q.s : 0), tk = m.ol ? 0.72 : Math.max(0.8, q.s * (m.size ?? 0.86))
      if (TAG_SINK) TAG_SINK.push({ x: q.x, y: ty, name: m.look.name, k: tk })
      else nameTag(ctx, view, q.x, ty, m.look.name, tk)
    }
  }
}
// who they really are: X, slot, Z on the screen are his first, third and second receivers
const WR_CAST = [0, 2, 1]
function castOf(c, cast) {
  if (c.men || !cast) return c.men ?? NOBODY
  // the corners, then the safeties, then a nickel if the roster has one more
  const seen = { c: 0, s: 0, d: 0 }, dbs = cast.them?.db?.length ?? 0, dls = cast.them?.dl?.length ?? 0
  const spots = c.form.map(d => { const at = d.t === 'c' ? seen.c++ : d.t === 's' ? 2 + seen.s++ : d.t === 'n' ? 4 : -1; return at >= 0 && at < dbs ? at : -1 })
  c.men = {
    ol: OL.map((_, i) => manOf(cast, 'us', 'ol', i)), wr: WR_CAST.map(i => manOf(cast, 'us', 'wr', i)), wrPace: WR_CAST.map(i => paceOf(cast, 'us', 'wr', i)),
    te: manOf(cast, 'us', 'te', 0), rb: manOf(cast, 'us', 'rb', 0), qb: manOf(cast, 'us', 'qb', 0),
    // (and the front four, when the roster has them)
    def: spots.map((at, i) => (at >= 0 ? manOf(cast, 'them', 'db', at) : c.form[i].t === 'd' && seen.d < dls ? manOf(cast, 'them', 'dl', seen.d++) : null)),
    defPace: spots.map(at => (at >= 0 ? paceOf(cast, 'them', 'db', at) : 1)),
  }
  // the full eleven a side (career's xi): every man real, the backers too. Speeds as before
  if (cast.us?.xi && cast.them?.xi) {
    const x = (side, spot, i) => xiOf(cast, side, spot, i), used = new Set(), n = { d: 0, l: 0, c: 0, s: 0, n: 0 }
    const SPOT = { d: ['dl'], l: ['lb'], c: ['cb'], s: ['s'], n: ['cb', 's'] }
    const START = { d: 0, l: 0, c: 0, s: 0, n: 2 }   // (the nickel: the third corner, else a third safety)
    const pick = t => {
      for (const sp of SPOT[t]) for (let k = (t === 'n' ? START.n : 0) + (t === 'n' ? 0 : n[t]); k < 6; k++) { const m = x('them', sp, k); if (m && !used.has(m)) { used.add(m); n[t]++; return m } }
      return null
    }
    Object.assign(c.men, {
      ol: OL.map((_, i) => x('us', 'ol', i)), wr: WR_CAST.map(i => x('us', 'wr', i)),
      te: x('us', 'te', 0), rb: x('us', 'rb', 0), qb: x('us', 'qb', 0),
      def: c.form.map(d => pick(d.t)),
    })
  }
  return c.men
}
const NOBODY = { ol: [], wr: [], wrPace: [1, 1, 1], te: null, rb: null, qb: null, def: [], defPace: [] }
const DNUM = { d: [94, 97, 91, 99], l: [52, 45, 58, 54], n: [32, 33], c: [24, 21, 29], s: [38, 26, 31] }
function numbersFor(form) {
  const used = { d: 0, l: 0, n: 0, c: 0, s: 0 }
  return form.map(d => DNUM[d.t][used[d.t]++ % DNUM[d.t].length])
}
const OL_NUM = [71, 64, 55, 66, 77], WR_NUM = [11, 84, 15], TE_NUM = 87, RB_NUM = 28, QB_NUM = 7
const stride = (g, slow = 76) => Math.floor(g.t / slow) % 4
const PICK_RUN = 1050   // a pick: how long he runs it back before he stops to show it off
// before the snap: everyone in his stance
function drawSet(ctx, view, c, los, pyd, col, them, dy) {
  const m = c.mirror, list = [], men = castOf(c, view.cast)
  for (let i = 0; i < OL.length; i++) list.push({ x: OL[i], y: los + 14 + dy, n: OL_NUM[i], pose: 'stance', size: 0.94, look: men.ol[i], ol: 1, lo: i % 2 })
  list.push({ x: fx(TE, m), y: los + 14 + dy, n: TE_NUM, pose: 'stance', size: 0.94, look: men.te })
  for (let i = 0; i < 3; i++) list.push({ x: fx(WR[i].x, m), y: yOf(WR[i].yd, los, pyd) + dy, n: WR_NUM[i], pose: 'ready', look: men.wr[i] })
  list.push({ x: fx(RB.x, m), y: yOf(RB.yd, los, pyd) + dy, n: RB_NUM, pose: 'ready', look: men.rb })
  list.push({ x: fx(QB.x, m), y: yOf(QB.yd, los, pyd) + dy, n: QB_NUM, size: 0.9, carry: false, look: men.qb })
  const nums = numbersFor(c.form)
  c.form.forEach((d, i) => list.push({ x: d.x, y: yOf(d.yd, los, pyd) + dy, n: nums[i], d: 1, pose: d.t === 'd' ? 'stance' : 'ready', size: d.t === 'd' ? 0.94 : 0.86, look: men.def[i], ol: d.t === 'd' ? 1 : 0, lo: d.t === 'd' ? i % 2 : 0 }))
  drawCast(ctx, view, list, col, them)
  // the man in stripes and the head coach, in their places
  official(ctx, view, SR + 3, los - 9 * pyd + dy, null, null)
  coach(ctx, view, SL - 7, los - 3.5 * pyd + dy, col.us, col.trim, null)
  snapBall(ctx, view, 180, los + 6 + dy, fx(QB.x, m), yOf(QB.yd, los, pyd) + dy, -1)
  // he's coming: a chevron at his feet
  for (const d of c.form) {
    if (!d.b) continue
    const q = tilt(view, d.x, yOf(d.yd, los, pyd) + dy)
    ctx.fillStyle = '#ffd24a'
    const s = q.s
    ctx.beginPath(); ctx.moveTo(q.x - 7 * s, q.y + 5 * s); ctx.lineTo(q.x, q.y + 12 * s); ctx.lineTo(q.x + 7 * s, q.y + 5 * s); ctx.lineTo(q.x + 7 * s, q.y + 2 * s); ctx.lineTo(q.x, q.y + 8 * s); ctx.lineTo(q.x - 7 * s, q.y + 2 * s); ctx.closePath(); ctx.fill()
  }
}
// the benches: painted at their yard lines, so they go by as the camera comes up the field
function drawBenches(ctx, view, goalY, pyd, col, them) {
  M.pose = 'ready'; M.step = null; M.carry = false; M.fall = 0; M.fallX = 0; M.lift = 0; M.size = 0.72; M.number = null; M.kit = 'pads'
  for (let yd = -5; yd < 90; yd += 6) {
    const n = Math.abs(yd * 7) % 11
    if (n > 6) continue
    const y = goalY + yd * pyd
    if (y < 60 || y > view.h - CARD_H + 30) continue
    M.dir = 'right'   // (each sideline watches the field)
    M.color = col.us; M.trim = col.trim; M.pants = col.trim; M.skin = skinOf(n)
    athlete(ctx, view, -14 - (n % 3) * 8, y, M)
    M.color = them.color; M.trim = them.trim; M.pants = them.trim; M.skin = skinOf(n + 3); M.dir = 'left'
    athlete(ctx, view, view.w + 14 + (n % 3) * 8, y + 12, M)
  }
}

// whoever this is good for, going mad on their sideline: over the men painted there. side: -1 ours, 1 theirs
function benchUp(ctx, view, goalY, pyd, look, side, t) {
  M.step = null; M.carry = false; M.fall = 0; M.fallX = 0; M.size = 0.72; M.number = null; M.kit = 'pads'
  M.color = look.color; M.trim = look.trim; M.pants = look.trim
  for (let yd = -5; yd < 90; yd += 6) {
    const n = Math.abs(yd * 7) % 11
    if (n > 6) continue
    const y = goalY + yd * pyd
    if (y < 60 || y > view.h - CARD_H + 30) continue
    M.pose = n % 3 === 2 ? 'reach-r' : 'arms-up'; M.lift = hop(t + n * 83, 370 + (n % 3) * 60, 7)
    if (side < 0) { M.dir = 'right'; M.skin = skinOf(n); athlete(ctx, view, -14 - (n % 3) * 8, y, M) }
    else { M.dir = 'left'; M.skin = skinOf(n + 3); athlete(ctx, view, view.w + 14 + (n % 3) * 8, y + 12, M) }
  }
  M.lift = 0
}
// What each of the seven behind the line does, read off how the look lines up. Press corners and a
// nickel on the line are man; soft corners bail deep; squatting corners take the flat; a high safety
// plays over the top; the rest drop underneath. who: 0-2 receivers, 3 the tight end, 4 the back.
const W = { x: 0, y: 0 }, W2 = { x: 0, y: 0 }
function jobsOf(form, m) {
  const free = [0, 1, 2]
  const pressed = form.some(d => d.t === 'c' && d.yd <= 1.6)
  const nearestWr = x => {
    let best = free[0] ?? 0, bd = Infinity
    for (const w of free) { const e = Math.abs(fx(WR[w].x, m) - x); if (e < bd) { bd = e; best = w } }
    free.splice(free.indexOf(best), 1)
    return best
  }
  return form.map(d => {
    if (d.t === 'd') return { kind: 'line' }
    if (d.b) return { kind: 'rush' }
    if ((d.t === 'c' || d.t === 'n') && d.yd <= 1.6) return { kind: 'man', who: nearestWr(d.x) }
    if (d.t === 's' && d.yd <= 4 && pressed) return { kind: 'man', who: 3 }
    if (d.t === 'c') return d.yd >= 8 ? { kind: 'deep' } : { kind: 'under', drop: 1.5 }
    if (d.t === 's' && d.yd >= 11) return { kind: 'deep' }
    if (d.t === 'n' && d.yd >= 12) return { kind: 'deep' }
    return { kind: 'under', drop: d.t === 'l' ? 5.5 : 4 }
  })
}
// on a pass, who goes for it: his man, if he's got one, and whoever's nearest. Nobody who's rushing.
function huntersFor(c, jobs, p) {
  const who = p.w === 3 ? 4 : p.w
  const mine = c.form.find((d, i) => jobs[i].kind === 'man' && jobs[i].who === who)
  const end = p.pts[p.pts.length - 1]
  const near = nearestTo(c.form, p.ex || end[0], end[1], 3, d => d.t !== 'd' && !d.b && d !== mine)
  return mine ? [mine, near[0]] : near
}
// the receivers the ball isn't going to: the route on the card, or straight up
function otherRoutes(p, m) {
  return [0, 1, 2].map(i => {
    const x0 = WR[i].x, inward = inwardOf(x0), sk = p.opt?.sk?.find(e => e[0] === i)
    const shape = sk ? routeFor(sk[1], x0, 14) : [[0, 0], [0, 15]]
    return shape.map(([dx, dy]) => [fx(clamp(x0 + dx * inward, 14, 346), m), dy])
  })
}
function drawPlay(ctx, g, view, c, p, pt, los, pyd, col, them, dy) {
  const m = c.mirror
  const Y = yd => los - yd * pyd + dy
  const Yo = yd => yOf(yd, los, pyd) + dy
  const qbx = fx(QB.x, m), qby0 = Yo(QB.yd)
  const k = p.kind
  const run = k === 'run' || k === 'stuff'
  const pass = k === 'catch' || k === 'swat' || k === 'pick'
  const sack = k === 'sack'
  const qby = qby0 + (run ? 0 : easeOut(prog(pt, 0, 260)) * 1.6 * pyd)
  const blow = pt >= p.T
  const flow = prog(pt, 0, 420)
  const oob = !!p.opt?.oob
  const list = []

  // where the ball-carrier is
  let tx = 0, ty = 0, tdir = 'up'
  const start = p.w === 3 ? RB : WR[p.w ?? 0]
  if (run) {
    const a = along(p.pts, pt / p.Tc)
    tx = a.x + weave(pt, prog(pt, 240, p.Tc), p.gain + 1)
    ty = Math.min(Yo(RB.yd), Y(a.y)) - easeOut(prog(pt, p.Tc, p.T)) * p.slide * pyd
    tdir = dirOf(a.ux, -a.uy)
  } else if (pass) {
    const sy0 = Yo(start.yd)
    const a = along(p.pts, pt / p.tLand)
    tx = a.x; ty = p.w === 3 ? Y(a.y) : sy0 - a.y * pyd
    tdir = dirOf(a.ux, -a.uy)
    if (pt > p.tLand && k === 'catch') {
      // the catch, and on to where he goes down (or steps out)
      const f = prog(pt, p.tLand, p.Tc)
      tx = lerp(p.cx, p.ex, f) + (oob ? 0 : weave(pt, f, p.gain + 1)); ty = lerp(ty, oob ? ty : Math.min(ty, Y(p.gain - p.slide - (p.td ? 0 : BODY_YD))), f)
      if (pt > p.Tc) ty -= easeOut(prog(pt, p.Tc, p.T)) * p.slide * pyd
      tdir = oob ? (p.ex < 180 ? 'left' : 'right') : 'up'
    } else if (pt > p.tLand) ty -= easeOut(prog(pt, p.tLand, p.tLand + 400)) * 10
  }
  // a man goes down only with someone on him: from the wrap until they're flat
  const tackled = (run || (k === 'catch' && !p.td && !oob)) && p.tacklers.length > 0
  const fall0 = tackled || sack ? clamp((pt - p.Tc - 100) / 320, 0, 1) : 0
  // once they're down: the man who made the stop is up first. With a first down, the ball carrier's up right after him
  const firstDown = tackled && p.res === 'FIRST DOWN'
  const risen = clamp((pt - p.T - 170) / 240, 0, 1)
  const fall = fall0 * (1 - risen)
  const manRisen = firstDown ? clamp((pt - p.T - 300) / 240, 0, 1) : 0
  const fallMan = sack ? fall0 : fall0 * (1 - manRisen)
  const qside = qbx < (p.tacklers[0]?.x ?? 0) ? -1 : 1
  const olUp = p.td && pt >= p.T + 100

  // the rest of the offense: the line holds, everyone else goes
  const men = castOf(c, view.cast)
  for (let i = 0; i < OL.length; i++) list.push({ x: OL[i], y: los + 14 + dy + flow * 4, n: OL_NUM[i], pose: olUp ? 'arms-up' : 'block', lift: olUp ? hop(pt + i * 90, 470, 7) : 0, size: 0.94, look: men.ol[i], ol: 1, lo: i % 2 })
  const teGoAt = t => (!(run || sack) ? easeOut(prog(t, 0, 900)) * 7 * pyd : 0)
  const teGo = teGoAt(pt)
  list.push({ x: fx(TE, m), y: los + 14 + dy - teGo, n: TE_NUM, size: 0.94, step: teGo && pt < 900 ? stride(g, 90) : null, pose: run || sack ? 'block' : null, look: men.te })
  // everyone runs his real route: what the card drew, or straight up the field
  const routes = p.others ?? (p.others = otherRoutes(p, m))
  const rec = (i, t, o) => {
    if (i === 3) { o.x = fx(TE, m); o.y = los + 14 + dy - teGoAt(t); return o }
    if (i === 4) {
      if (pass && p.w === 3) { const a = along(p.pts, Math.min(t, p.tLand) / p.tLand); o.x = a.x; o.y = Y(a.y); return o }
      o.x = fx(RB.x, m); o.y = Yo(RB.yd); return o
    }
    const wy = Yo(WR[i].yd)
    if (pass && p.w === i) { const a = along(p.pts, Math.min(t, p.tLand) / p.tLand); o.x = a.x; o.y = wy - a.y * pyd; return o }
    const R = routes[i], a = along(R, (t * RV * (men.wrPace[i] ?? 1)) / pathLen(R))
    o.x = a.x; o.y = wy - a.y * pyd
    return o
  }
  for (let i = 0; i < 3; i++) {
    if (pass && p.w === i) continue
    rec(i, pt, W)
    list.push({ x: W.x, y: W.y, n: WR_NUM[i], step: (pt * RV * (men.wrPace[i] ?? 1)) < pathLen(routes[i]) ? stride(g) : null, look: men.wr[i] })
  }
  if (!(p.w === 3 && (run || pass))) {
    const rx = fx(RB.x, m)
    list.push({ x: lerp(rx, lerp(rx, qbx, 0.3), flow), y: Yo(RB.yd) - flow * 0.4 * pyd, n: RB_NUM, pose: flow >= 1 ? 'block' : null, look: men.rb })
  }
  if (run || pass) {
    const num = p.w === 3 ? RB_NUM : WR_NUM[p.w]
    const look = p.w === 3 ? men.rb : men.wr[p.w]
    const hasBall = run ? pt > 180 : k === 'catch' && pt >= p.tLand
    // the hands go up as it gets there
    const going = pass && pt >= p.tLand - 190 && pt < p.tLand + (k === 'catch' ? 0 : 100)
    const man = { x: tx, y: ty, n: num, dir: going ? 'up' : fallMan > 0 ? 'up' : tdir, pose: going ? handsFor(qbx, tx, k === 'catch') : p.td && pt > p.T + 160 && pt < p.T + 160 + SPIKE_MS ? 'spike-up' : null, fall: fallMan, step: fallMan > 0 || (blow && oob) || (pt > p.T && k !== 'catch') ? null : stride(g), carry: hasBall && !(p.td && pt >= p.T + 160 + SPIKE_MS), look }
    // his own, once it's spiked. The first down: up, and which way it's going. Beaten: he can't believe it
    if (p.td && pt >= p.T + 160 + SPIKE_MS + 220) { man.dir = 'down'; scorerDance(man, g.flair, pt - p.T - 160 - SPIKE_MS - 220) }
    else if (firstDown && manRisen >= 1) { man.dir = 'down'; man.step = null; man.pose = man.x < 180 ? 'point-r' : 'point-l' }
    else if (k === 'pick' && pt >= p.tLand + 380) { man.dir = 'up'; man.step = null; man.pose = 'hands-head' }
    else if (k === 'swat' && pt >= p.tLand + 420) { man.dir = 'up'; man.step = null; man.pose = 'hips' }
    list.push(man)
  }
  // what the play's done to the grass and the camera, the frame it happens
  if (k !== 'spike' && k !== 'kick' && !p.fxSnap) {
    p.fxSnap = true
    for (const d of c.form) if (d.t === 'd') kickUp(g, view, d.x, Yo(d.yd), 3, 0.6)
  }
  if (k === 'catch' && pt >= p.tLand && !p.fxC) { p.fxC = true; g.fx.push('catchball'); puffAt(g, view, tx, ty, 2); g.nudge.kick(g.t, 1.3, 0, 1, 120) }
  if ((run || (k === 'catch' && pt >= p.tLand)) && pt < p.Tc && g.t >= (p.fxClod ?? 0)) { p.fxClod = g.t + 190; kickUp(g, view, tx, ty, 1, 0.5, 0.8) }
  if ((tackled || sack) && pt >= p.Tc && !p.fxT) {
    p.fxT = true; g.fx.push('lock')
    const hx = sack ? qbx : tx, hy = sack ? qby : ty
    kickUp(g, view, hx, hy, sack ? 14 : 12, 1.15, 1.45); puffAt(g, view, hx, hy, 3)
    g.nudge.kick(g.t, sack ? 6 : 4, hx > 180 ? 0.7 : -0.7, 1, sack ? 260 : 210)
  }
  if ((tackled || sack) && pt >= p.Tc + 340 && !p.fxT2) { p.fxT2 = true; const hx = sack ? qbx + qside * 1.2 * pyd : tx, hy = sack ? qby : ty; kickUp(g, view, hx, hy, 6, 0.7, 1.4); puffAt(g, view, hx, hy, 2) }
  if (k === 'swat' && pt >= p.tLand + 170 && !p.fxB) {
    p.fxB = true
    const e0 = p.pts[p.pts.length - 1]
    kickUp(g, view, e0[0], p.w === 3 ? Y(e0[1]) : Yo(start.yd) - e0[1] * pyd, 4, 0.6)
  }
  if (p.td && pt >= p.T + 160 + SPIKE_MS && !p.fxS) { p.fxS = true; g.fx.push('pop', 'h:medium'); kickUp(g, view, tx + 6, ty, 8, 1); g.nudge.kick(g.t, 2.4, 0, 1, 160) }
  // the bowl
  if (!p.fxP && (p.td ? (run || pt >= p.tLand) : (sack || tackled) ? pt >= p.Tc : k === 'pick' || k === 'swat' ? pt >= p.tLand : false)) {
    p.fxP = true
    if (p.td) popCrowd(g, 4000)
    else if (sack) popCrowd(g, 1500)
    else if (k === 'pick') popCrowd(g, 2100)
    else if (k === 'swat') popCrowd(g, 900, 0.5)
    else if (firstDown) popCrowd(g, 1500, 0.7)
  }
  // where the camera wants to be, if it wants to be anywhere
  if (p.td ? (run || pt >= p.tLand) : sack ? pt >= p.Tc - 120 : k === 'pick' ? pt >= p.tLand : tackled && c.final && pt >= p.Tc - 200) {
    p.focus ??= { x: 0, y: 0, size: p.td ? 1.3 : sack ? 1.45 : 1.3 }
    p.focus.x = sack ? qbx : tx; p.focus.y = sack ? qby : ty
  }

  // the defense: every man has a job until the ball tells him otherwise. Then the two who get there go
  // and get there, and everyone else flows to it.
  const tsx = sack ? qbx : p.ex
  const tsy = sack ? qby : (pass && k !== 'catch') ? (p.pts ? Y(p.pts[p.pts.length - 1][1]) : los) : Y((p.gain ?? 0) - p.slide)
  const jobs = c.jobs ?? (c.jobs = jobsOf(c.form, m))
  const hunters = pass ? (p.hunt ?? (p.hunt = huntersFor(c, jobs, p))) : p.tacklers
  const t1 = hunters[0], t2 = hunters[1]
  // a touchdown or a man stepping out: they get close, and don't get him
  const miss = p.td || oob
  const nums = numbersFor(c.form)
  // when the ball leaves, those watching the QB break; a pass only starts to matter then
  const brk = pass ? p.tRel + 170 : 120
  const still = k === 'spike' || k === 'kick'
  const defs = c.form.map((d, i) => {
    const sx = d.x, sy = Yo(d.yd), job = jobs[i]
    let cx = sx, cy = sy, up = false
    if (still || job.kind === 'line') { /* in his stance */ }
    else if (job.kind === 'rush') {
      // he's coming, until the back picks him up
      const f = prog(pt, 0, 780)
      cx = lerp(sx, qbx + (sx < qbx ? -18 : 18), f); cy = lerp(sy, qby - 16, f)
    } else if (job.kind === 'man') {
      // up to him, hips turned, and on his hip: a half-beat behind him, on the side the throw comes from.
      // The call that beats this look has beaten him, and it shows: he loses a step at the break.
      const beat = k === 'catch' && (p.w === 3 ? job.who === 4 : job.who === p.w)
      const lag = 90 + (beat ? 280 * prog(pt, p.tLand * 0.42, p.tLand) : 0)
      rec(job.who, Math.max(0, pt - lag), W)
      const e = easeOut(prog(pt, 40, 460)), lev = W.x < 180 ? 1 : -1
      const quick = job.who < 3 ? ((men.wrPace[job.who] ?? 1) - (men.defPace[i] ?? 1)) : 0
      cx = lerp(sx, W.x + lev * 17, e)
      cy = lerp(sy, W.y + 4 + clamp(quick * RV * pyd * pt, -4, 16), e)
      up = pt > 260
    } else if (job.kind === 'deep') {
      // he bails, and stays over the top of the deepest man on his side (not the one the call has sold him on)
      cy = sy - (pt / 1000) * 5.2 * pyd
      let top = -1, ty0 = Infinity
      for (let w = 0; w < 4; w++) {
        if (k === 'catch' && p.w === w && pt < p.tRel) continue
        rec(w, pt, W)
        if (Math.abs(W.x - sx) < 118 && W.y < ty0) { ty0 = W.y; top = w }
      }
      if (top >= 0) {
        rec(top, pt, W)
        const over = W.y - 4.5 * pyd
        if (over < cy) { cy = over; up = true }
        cx = lerp(sx, W.x, 0.6 * prog(pt, 200, 1100))
      }
    } else {
      // underneath: drop to his spot, wall off whoever comes through it, on the QB's side of him
      const sdy = sy - Math.min(job.drop, (pt / 1000) * 5.5) * pyd
      let best = 0, bx = 0, by = 0
      // (a corner in the flat sits on the wideout; the inside men take what comes inside)
      for (let w = 0; w < (d.t === 'c' ? 3 : 5); w++) {
        rec(w, pt, W)
        const near = clamp(1 - Math.hypot(W.x - sx, (W.y - sdy) * 1.4) / 120, 0, 1)
        if (near > best) { best = near; bx = W.x; by = W.y }
      }
      cx = sx; cy = sdy
      if (best) { const f = 0.72 * Math.min(1, best * 2); cx = lerp(sx, bx, f); cy = lerp(sdy, by + 4, f) }
    }
    return { d, i, sx, sy, cx, cy, up }
  })
  const skill = list.filter(o => !o.ol), out = []
  const PICK_SHOW = k === 'pick' && pt >= p.tLand + PICK_RUN
  for (let i = 0; i < c.form.length; i++) {
    const { d, cx, cy, up } = defs[i]
    let x, y
    if (d === t1) {
      // he takes his angle at a steady run and gets to him when the play says; then he has him
      const end = k === 'swat' || k === 'pick' ? p.tLand : p.Tc
      const f = pass ? easeInOut(prog(pt, brk, end)) : prog(pt, sack ? 60 : brk, end)
      const inX = pass && k !== 'catch' ? (cx < tsx ? -11 : 11) : -3    // (at the catch he's beside him with a hand in, not in him)
      x = lerp(cx, tsx + inX, f * (miss ? 0.82 : 1)); y = lerp(cy, tsy - 3, f * (miss ? 0.82 : 1))
      if (k === 'pick' && pt > p.tLand) y += Math.min(pt - p.tLand, PICK_RUN) * 0.05
      if ((tackled || sack) && pt > p.Tc) {
        const hold = prog(pt, p.Tc, p.Tc + 120)
        const hx = sack ? qbx + qside * fall * 1.2 * pyd - qside * 4 : tx - 4
        const hy = sack ? qby + 3 : ty + 3
        x = lerp(x, hx, hold); y = lerp(y, hy, hold)
      }
    } else if (d === t2) {
      // the second man arrives as they go down and pulls up over them
      const f = prog(pt, pass ? brk + 60 : 100, p.T)
      x = lerp(cx, tsx + (defs[i].sx > tsx ? 22 : -22), f * (miss ? 0.72 : 1)); y = lerp(cy, tsy - 10, f * (miss ? 0.72 : 1))
    } else if (d.t === 'd') {
      x = defs[i].sx; y = defs[i].sy + flow * 7
    } else {
      const f = still ? 0 : prog(pt, pass ? brk + 90 : 240, p.T + 1100) * (pass ? 0.42 : 0.52)
      x = lerp(cx, tsx, f); y = lerp(cy, tsy, f)
    }
    const hunter = d === t1 || d === t2
    const onHim = d === t1 && (tackled || sack) && pt > p.Tc
    const settled = pt > p.T + 900 || k === 'spike' || k === 'kick'
    const going = hunter && pt > (pass ? brk : 120)
    const wrote = jobs[i].kind === 'man' && up ? dirOf(rec(jobs[i].who, pt, W).x - rec(jobs[i].who, Math.max(0, pt - 60), W2).x, W.y - W2.y) : up ? 'up' : 'down'
    out[i] = {
      x, y, n: nums[i], d: 1, look: men.def[i], ol: d.t === 'd' ? 1 : 0, lo: d.t === 'd' ? i % 2 : 0, dl: d.t === 'd', sx: defs[i].sx, pin: onHim || (pass && d === t1 && pt >= p.tLand - 240),
      dir: going ? dirOf(tsx - x, tsy - y) : wrote,
      size: d.t === 'd' ? 0.94 : 0.86,
      pose: onHim ? 'wrap' : d === t1 && k === 'swat' && pt >= p.tLand + 420 ? breakupPose(pt - p.tLand - 420, Math.floor(p.tLand)) : d === t1 && (k === 'swat' || k === 'pick') && pt >= p.tLand - 160 && pt < p.tLand + 160 ? (k === 'pick' ? handsFor(tsx, x, true) : tsx < x ? 'swipe-l' : 'swipe-r') : d.t === 'd' && !hunter ? 'block' : settled || (d === t2 && pt > p.T) ? 'ready' : null,
      step: onHim || d.t === 'd' && !hunter || settled || (d === t2 && pt > p.T) ? null : stride(g, hunter ? 76 : 110),
      fall: onHim ? fall : 0, fallX: onHim && sack ? qside : 0, top: onHim, carry: k === 'pick' && d === t1 && pt > p.tLand,
    }
    // and after: the man who made the stop lets everyone know; if he gave up the first, he's blowing.
    // A pick: he shows them the ball, the rest of them get to him. A touchdown: they've seen this before.
    const o2 = out[i]
    if (onHim && risen >= 1) {
      o2.dir = 'down'; o2.fall = 0; o2.fallX = 0; o2.top = false; o2.pose = 'hips'; o2.step = null
      if (!firstDown && !p.td) stopperDance(o2, g.flair, pt - p.T - 410)
    } else if (PICK_SHOW && d === t1) { o2.dir = 'down'; o2.step = null; o2.pose = 'spike-up'; o2.carry = true; o2.lift = hop(pt - p.tLand - PICK_RUN, 430, 11) }
    else if (k === 'pick' && !o2.dl && pt >= p.tLand + 620) { o2.dir = 'down'; o2.step = null; o2.pose = 'arms-up'; o2.lift = hop(pt + i * 110, 450, 9) }
    else if (sack && d.t === 'd' && pt >= p.Tc + 260 && d !== t1) { o2.dir = 'down'; o2.step = null; o2.pose = 'arms-up'; o2.lift = hop(pt + i * 110, 430, 9) }
    else if (p.td && !o2.dl && pt >= p.T + 80) { o2.dir = 'up'; o2.step = null; o2.pose = 'hips' }
  }
  // Nobody stands in anybody: standing men are tall on the screen, so off a man means beside him. A
  // shove grows as he gets level, and no man's feet move faster than feet do, so it never shows as a jump.
  const lastX = p.defX ?? (p.defX = out.map(e => e.x)), most = Math.max(1, g.t - (p.defT ?? g.t)) * 0.2
  p.defT = g.t
  for (let i = 0; i < out.length; i++) {
    const e = out[i]
    if (!e.dl && !e.pin) {
      for (const o of skill) {
        const ax = Math.abs(e.x - o.x), ay = Math.abs(e.y - o.y)
        if (ax < 17 && ay < 26) e.x += (e.sx < o.x ? -1 : 1) * (17 - ax) * clamp((26 - ay) / 8, 0, 1)
      }
      for (let j = 0; j < out.length; j++) {
        const o = out[j]
        if (j === i || o.dl || o.pin) continue
        const ax = Math.abs(e.x - o.x), ay = Math.abs(e.y - o.y)
        if (ax < 20 && ay < 22) e.x += (e.x === o.x ? (i < j ? -1 : 1) : e.x < o.x ? -1 : 1) * (20 - ax) * 0.5 * clamp((22 - ay) / 8, 0, 1)
      }
      e.x = clamp(e.x, lastX[i] - most, lastX[i] + most)
    }
    lastX[i] = e.x
    list.push(e)
  }
  // the QB
  // (he winds up over the last of the route, and it's gone at the release)
  const armUp = pass ? qbPose(pt >= p.tRel - 300 && pt < p.tRel ? (pt - (p.tRel - 300)) / 300 : pt < p.tRel ? 0 : null, pt - p.tRel) : k === 'spike' ? qbPose(pt < 120 ? 0.5 : null, pt - 120) : null
  const armDir = armUp ? ((pass ? p.pts[p.pts.length - 1][0] : qbx + 1) < qbx ? 'left' : 'right') : 'up'
  // a pass or a sack: the short drop first, then the stance. Going to throw he's side on, front shoulder at his man.
  const qset = pt >= SNAP_MS && ((pass && armUp === 'qb-hold') || (sack && !fall)) ? qbStance(pt - SNAP_MS) : null
  const qdrop = qset?.pose === 'qb-drop' || (sack && qset)
  const qbm = { x: sack ? qbx + qside * fall0 * 1.2 * pyd : qbx, y: qby, n: QB_NUM, size: 0.9, dir: qdrop ? 'up' : armDir, pose: qdrop ? qset.pose : armUp, step: qdrop ? qset.step : null, fall: sack ? fall0 : 0, fallX: sack ? qside : 0, carry: !qdrop && pt >= SNAP_MS && (armUp === 'qb-hold' || (!armUp && (sack || (run && pt < 180)))), look: men.qb }
  // and how he takes it
  if (!sack && k !== 'spike' && k !== 'kick') {
    const mood = p.td && pt >= p.T + 60 ? 'arms-up' : firstDown && pt >= p.T + 100 ? 'reach-r' : k === 'pick' && pt >= p.tLand + 420 ? 'hands-head' : (k === 'swat' && pt >= p.tLand + 520) || (k === 'stuff' && pt >= p.T + 120) ? 'hips' : null
    if (mood) { qbm.dir = 'up'; qbm.step = null; qbm.carry = false; qbm.pose = mood; qbm.lift = mood === 'arms-up' ? hop(pt - p.T, 450, 13) : 0 }
  }
  list.push(qbm)
  snapBall(ctx, view, 180, Y(0) + 6, qbx, qby, pt)
  if (p.td && (run || pass) && pt >= p.T + 160 + SPIKE_MS) looseBall(ctx, view, tx + 6, ty, pt - p.T - 160 - SPIKE_MS, true)
  drawCast(ctx, view, list, col, them)
  // the man in stripes comes down to the spot and calls it. The head coach beside his bench.
  const yard = sack ? qby : (run || pass) ? ty : Y(0)
  const go = easeOut(prog(pt, 200, p.T))
  const sig = p.td && pt >= p.T + 40 ? 'arms-up' : firstDown && pt >= p.T + 120 ? 'point-l' : k === 'swat' && pt >= p.tLand + 520 ? (Math.floor(pt / 150) % 2 ? 'wave-a' : 'wave-b') : null
  official(ctx, view, SR + 3, lerp(Y(9), yard, go), sig, !sig && go > 0 && go < 0.98 ? stride(g, 95) : null)
  const badEnd = k === 'pick' || sack || (c.final && !p.td)
  const up = p.td ? 'arms-up' : firstDown ? 'reach-r' : badEnd ? 'hands-head' : k === 'swat' || k === 'stuff' ? 'hips' : null
  const said = pt >= p.T + 80 || (k === 'pick' && pt >= p.tLand + 200)
  coach(ctx, view, SL - 7, Y(3.5), col.us, col.trim, said ? up : null, said && p.td ? hop(pt - p.T, 470, 11) : 0)
  // the sidelines: whoever this is good for
  const goalY = los - c.G0 * pyd + dy
  const lite = lightFx()
  if (!lite && (p.td || firstDown) && pt >= p.T + 100) benchUp(ctx, view, goalY, pyd, { color: col.us, trim: col.trim }, -1, pt - p.T)
  else if (!lite && (k === 'pick' || sack) && pt >= (sack ? p.Tc + 240 : p.tLand + 240)) benchUp(ctx, view, goalY, pyd, them, 1, pt)

  // the ball
  if (k === 'spike' && pt >= 120) looseBall(ctx, view, qbx + 6, qby - 6, pt - 120, false)
  else if (k === 'kick') {
    const f = clamp((pt - 120) / 780, 0, 1)
    const a = flightAt(view, qbx, qby, 180, Y(32), f, 70)
    ballShadow(ctx, view, a.gx, a.gy, a.lift)
    airBall(ctx, a.x, a.y, { ang: pt / 60, len: a.len })
  } else if (pass && pt >= p.tRel) {
    const end = p.pts[p.pts.length - 1]
    const sy0 = Yo(start.yd)
    const ex = end[0], ey = p.w === 3 ? Y(end[1]) : sy0 - end[1] * pyd
    if (pt < p.tLand) {
      const f = prog(pt, p.tRel, p.tLand)
      const a = flightAt(view, qbx, qby, ex, ey, f, clamp(p.flight * 0.05, 8, 60))
      ballShadow(ctx, view, a.gx, a.gy, a.lift)
      airBall(ctx, a.x, a.y, { axis: a.axis, len: a.len, spin: ((pt - p.tRel) / 1000) * 5.5 })
    } else if (k === 'swat') looseBall(ctx, view, ex, ey, pt - p.tLand, true)
  }
}
