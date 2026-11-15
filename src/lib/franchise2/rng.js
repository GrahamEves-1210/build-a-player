// FRANCHISE: seeded randomness. Every roll in the mode comes from a string seed (lib/rng.js), never Math.random,
// so a save plays back the same and the headless checks can repeat any season.
import { seeded } from '../rng'

export function rngOf(str) {
  const u = seeded(String(str))
  const R = {
    u,
    int: (a, b) => a + Math.floor(u() * (b - a + 1)),
    pick: arr => arr[Math.floor(u() * arr.length)],
    chance: p => u() < p,
    n: () => { let a = u(); if (a < 1e-12) a = 1e-12; return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u()) },
    shuffle: arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(u() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a },
    wpick: w => { let t = 0; for (const x of w) t += Math.max(0, x); let r = u() * t; for (let i = 0; i < w.length; i++) { r -= Math.max(0, w[i]); if (r < 0) return i } return w.length - 1 },
  }
  return R
}
export const roll = str => seeded(String(str))()
export const clamp = (lo, hi, v) => Math.min(hi, Math.max(lo, v))
export const r1 = v => Math.round(v * 10) / 10
