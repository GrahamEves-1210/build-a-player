// FRANCHISE: seeded randomness. Every roll in the engine comes from here (never Math.random), so the same
// save and the same choices always play back the same way. A generator's whole state is one integer (R.s),
// so a game that stops for a moment can be saved and picked up again mid-drive.

// the same string hash lib/rng.js starts from
export function hashStr(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  return h >>> 0
}

// mulberry32 on a state that can be read back and set
export function rngAt(state) {
  const R = {
    s: state >>> 0,
    u() {
      R.s = (R.s + 0x6D2B79F5) | 0
      let t = Math.imul(R.s ^ (R.s >>> 15), 1 | R.s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    // a whole number lo..hi inclusive
    int(lo, hi) { return lo + Math.floor(R.u() * (hi - lo + 1)) },
    // a number in [lo, hi)
    range(lo, hi) { return lo + R.u() * (hi - lo) },
    chance(p) { return R.u() < p },
    // standard normal
    n() { let a = R.u(); if (a < 1e-12) a = 1e-12; return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * R.u()) },
    pick(arr) { return arr[Math.floor(R.u() * arr.length)] },
    // an index by weight (-1 when nothing has weight)
    wpick(w) {
      let tot = 0
      for (let i = 0; i < w.length; i++) if (w[i] > 0) tot += w[i]
      if (!(tot > 0)) return -1
      let r = R.u() * tot
      for (let i = 0; i < w.length; i++) { const x = w[i] > 0 ? w[i] : 0; if (r < x) return i; r -= x }
      for (let i = w.length - 1; i >= 0; i--) if (w[i] > 0) return i
      return -1
    },
    shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R.u() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x } return a },
  }
  return R
}
export const rngOf = str => rngAt(hashStr(String(str)))
// one roll that never changes for a key (a man's durability, how he ages)
export const roll = str => rngOf(str).u()
