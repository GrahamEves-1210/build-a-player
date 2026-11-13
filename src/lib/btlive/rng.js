// BLACKTOP LIVE: seeded rolls without hidden state. A roll is a function of (seed, how many rolls came before),
// and the count lives in the game's state, so the same state and inputs give the same game on any machine
// (a phone, the live server, Node). Pure.
export function hashSeed(str) {
  const s = String(str)
  let h = 1779033703 ^ s.length
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  return h >>> 0
}
// the nth roll of a seed, 0..1
export function rollAt(seed, n) {
  let a = (seed + Math.imul(n + 1, 0x6D2B79F5)) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
// a bell-curve number (mean 0, sd 1) from two rolls
export const gauss = (u1, u2) => Math.sqrt(-2 * Math.log(Math.max(1e-9, u1))) * Math.cos(2 * Math.PI * u2)
