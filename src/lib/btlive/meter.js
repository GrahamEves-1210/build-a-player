// BLACKTOP LIVE: the shot meter. It runs on the shooter's own device: the screen times the hold with its own
// clock and sends only the quality (0-1) with the release, so there is no lag on the timing. The same two
// functions run in the simulation (a CPU's release, a release that arrives without a quality) and can run on
// the referee to check a quality against the press and release stamps. Pure.
import { T } from './tune.js'

// kind: 'jumper' | 'layup' | 'dunk'. R: the shooter's ratings (ratings.js). gamePoint: either side a basket from winning.
export function meterSpec(kind, R, gamePoint = false) {
  const clutch = gamePoint ? 1 - T.clutchShrink * (1 - R.clutch) : 1
  if (kind === 'jumper') return { kind, total: T.jTotalMs, ideal: T.jIdealMs, win: (T.jWinMs + T.jWinJs * R.js) * clutch, fall: T.jFallMs }
  const w = (T.lWinMs + T.lWinFin * R.fin) * (kind === 'dunk' ? T.dunkWin : 1) * clutch
  return { kind, total: T.lTotalMs, ideal: T.lIdealMs, win: w, fall: T.lFallMs }
}

// How good a release was: 1 inside the green window, then down to 0
export function meterQuality(spec, heldMs) {
  const err = Math.abs(Math.max(T.minHoldMs, Math.min(spec.total, heldMs)) - spec.ideal)
  if (err <= spec.win) return 1
  return Math.max(0, 1 - (err - spec.win) / spec.fall) * 0.98
}

// What the meter says about it
export function meterGrade(spec, heldMs) {
  const d = Math.max(T.minHoldMs, Math.min(spec.total, heldMs)) - spec.ideal
  if (Math.abs(d) <= spec.win) return 'PERFECT'
  const far = Math.abs(d) > spec.win + spec.fall * 0.45
  return d < 0 ? (far ? 'EARLY' : 'SLIGHTLY EARLY') : (far ? 'LATE' : 'SLIGHTLY LATE')
}

// The share of the shot's chance a release keeps
export function releaseMult(kind, q) {
  if (q >= 1) return 1
  const min = kind === 'jumper' ? T.relMinJ : T.relMinL
  return min + (T.slightJ - min) * Math.max(0, q)
}
