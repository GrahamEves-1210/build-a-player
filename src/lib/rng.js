// Seeded randomness (Daily Challenge spins, daily missions, live games every
// client must play back identically).
export function seeded(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  let a = h >>> 0
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function seededShuffle(arr, seed) {
  const r = seeded(seed), a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
// A wheel's team order. Teams that carry a spin weight (w, soccer's clubs: data/soccer-clubs.js) come up early more often:
// each gets the key u^(1/w) and the highest key goes first (weighted sampling without replacement). A list with no
// weights is the plain seededShuffle, so every other sport's order, and the server's check of it, is exactly as it was.
export function seededTeamOrder(arr, seed) {
  if (!arr.some(t => t?.w > 0 && t.w !== 1)) return seededShuffle(arr, seed)
  const r = seeded(seed)
  return arr.map(t => ({ t, k: Math.pow(r(), 1 / (t.w > 0 ? t.w : 1)) })).sort((a, b) => b.k - a.k).map(x => x.t)
}
