// Every jersey the app draws carries a number (owner, 2026-11-19: "everyone needs a number"). A row of the jersey
// index without one gets a believable number for his position, picked from a hash of his key so it never changes
// between screens or sessions: a quarterback wears 1-19, a lineman 50-79, a defensive tackle 90-99.
const R = {
  QB: [[1, 19]], RB: [[20, 39]], FB: [[30, 49]], WR: [[0, 19], [80, 89]], TE: [[80, 89]],
  OL: [[50, 79]], LT: [[60, 79]], LG: [[60, 79]], RG: [[60, 79]], RT: [[60, 79]], T: [[60, 79]],
  DL: [[90, 99]], DT: [[90, 99]], DE: [[90, 99]], EDGE: [[90, 99]], NT: [[90, 99]],
  LB: [[40, 59]], ILB: [[40, 59]], OLB: [[40, 59]], DB: [[20, 39]], CB: [[20, 39]], S: [[20, 39]], FS: [[20, 39]],
  K: [[1, 19]], P: [[1, 19]],
  // basketball: guards and wings low, bigs anywhere from 0 to 55
  PG: [[0, 15]], SG: [[0, 25]], SF: [[0, 35]], PF: [[0, 55]], C: [[0, 55]], G: [[0, 25]], F: [[0, 55]],
  // baseball
  SP: [[30, 59]], RP: [[40, 69]], CL: [[40, 69]], CF: [[1, 39]], LF: [[1, 39]], RF: [[1, 39]], DH: [[1, 39]], SS: [[1, 19]],
  // soccer
  ST: [[7, 11]], GK: [[1, 1]],
}
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }

// the number he wears: his own when the index has it, otherwise his position's, steady for his key
export function numberFor(key, pos = '', num = '', league = 'nfl') {
  // (a roster that says false or 'TBD' for a number has none)
  if (/^\d{1,2}$/.test(String(num ?? '').trim())) return String(num).trim()
  const P = String(pos || '').toUpperCase()
  // (a lineman's 'C' is a center in football; in basketball it's a center too, but 0-55)
  const ranges = league === 'nfl' || league === 'cfb' ? (P === 'C' ? [[50, 79]] : R[P]) : R[P]
  const list = (ranges ?? [[1, 99]]).flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i))
  return String(list[hash(key + '|' + P) % list.length])
}
