// BLACKTOP LIVE: the shot meter. It runs on the shooter's own device: the screen times the hold with its own
// clock and sends only the quality (0-1) with the release, so there is no lag on the timing. The same two
// functions run in the simulation (a CPU's release, a release that arrives without a quality) and can run on
// the referee to check a quality against the press and release stamps. Pure.
import { T } from './tune.js'

const clampN = v => Math.min(1, Math.max(0, v))

// kind: 'jumper' | 'layup' | 'dunk'. R: the shooter's ratings (ratings.js). gamePoint: either side a basket from winning.
export function meterSpec(kind, R, gamePoint = false, bnc = 1) {
  // at game point the green window shrinks for a man who isn't clutch and grows for one who is
  const clutch = gamePoint ? T.clutchLo + (T.clutchHi - T.clutchLo) * (R.clutchRaw ?? clampN((R.clutch - (1 - T.spread)) / T.spread)) : 1
  // (on the plain grades: a green always goes in, so a great shooter's window is earned, a poor one's is a sliver)
  const js = R.jsRaw ?? clampN((R.js - (1 - T.spread)) / T.spread), fin = clampN((R.fin - (1 - T.spread)) / T.spread)
  // (the hook and the fadeaway: the jumper's meter)
  if (kind === 'jumper' || kind === 'hook' || kind === 'fade') return { kind, total: T.jTotalMs, ideal: T.jIdealMs, win: (T.jWinMs + T.jWinJs * js * js) * clutch, fall: T.jFallMs, clutch }
  const w = (T.lWinMs + T.lWinFin * fin * fin) * (kind === 'dunk' ? T.dunkWin : 1) * clutch
  // (a dunk by a man who can only just get up there gathers slower: bnc, how far up the Bounce scale he is, 0-1)
  const slow = kind === 'dunk' ? 1 + T.dunkSlow * (1 - bnc) : 1
  return { kind, total: Math.round(T.lTotalMs * slow), ideal: Math.round(T.lIdealMs * slow), win: w, fall: T.lFallMs, clutch }
}

// How good a release was: 1 inside the green window, then down to 0
export function meterQuality(spec, heldMs) {
  const err = Math.abs(Math.max(T.minHoldMs, Math.min(spec.total, heldMs)) - spec.ideal)
  if (err <= spec.win) return 1
  return Math.max(0, 1 - (err - spec.win) / spec.fall) * 0.98
}

// What the meter says about it: green, or early, or late (a miss either way: there are no near misses that go in)
export function meterGrade(spec, heldMs) {
  const d = Math.max(T.minHoldMs, Math.min(spec.total, heldMs)) - spec.ideal
  if (Math.abs(d) <= spec.win) return 'PERFECT'
  return d < 0 ? 'EARLY' : 'LATE'
}

// The green window for a shot that goes in this often for an average kid (T.kidSd): his release error is about
// normal, so a window of w ms either side catches it erf(w / (sd √2)) of the time
const erfinv = x => {
  const a = 0.147, ln = Math.log(1 - x * x), t = 2 / (Math.PI * a) + ln / 2
  return Math.sign(x) * Math.sqrt(Math.sqrt(t * t - ln / a) - t)
}
const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y }
// (kind: a layup or a dunk can have a wider one than a jumper: T.winMaxL)
export function windowFor(p, kind = 'jumper') { return Math.min(kind === 'jumper' || kind === 'hook' || kind === 'fade' ? T.winMax : T.winMaxL, Math.max(T.winMin, T.kidSd * Math.SQRT2 * erfinv(Math.min(0.995, Math.max(0.001, p))))) }
// ...and how often a release with sd ms of error lands in a window of w
export const greenOdds = (w, sd) => erf(w / (sd * Math.SQRT2))

// The share of the shot's chance a release keeps
export function releaseMult(kind, q) {
  if (q >= 1) return 1
  const min = kind === 'jumper' ? T.relMinJ : T.relMinL
  return min + (T.slightJ - min) * Math.max(0, q)
}
