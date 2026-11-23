// NBA FRANCHISE: the number on his back. Every man on a team wears one nobody else there wears. A build's number is
// his (the setup's). A man already wearing his on this team (p.nt === the team) keeps it; a man who joins (a pick, a
// signing, a trade) keeps the one he wore before when nobody here has it, and otherwise takes a free one (a draftee or
// a camp body with none takes a free one too), the way a rookie or a newcomer picks from what's left.
// (No imports: contracts.js, trades.js, draft.js and offseason.js all call it.)
const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
// (most men wear 0-35; the rest of the low numbers next, the high ones last)
const POOLS = [[0, 35], [36, 55], [56, 99]]
function freeNum(p, taken) {
  for (const [lo, hi] of POOLS) {
    const span = hi - lo + 1, start = hash(`${p.n}-${p.i}`) % span
    for (let k = 0; k < span; k++) { const x = lo + ((start + k) % span); if (!taken.has(x)) return x }
  }
  return 0
}
export function fixNumbers(F, short) {
  const t = F?.teams?.[short]
  if (!t?.r) return
  const taken = new Set()
  const mine = p => (p.b != null ? 2 : p.nt === short ? 1 : 0)
  const men = [...t.r].sort((a, b) => mine(b) - mine(a) || (b.num != null) - (a.num != null) || (b.ys ?? 0) - (a.ys ?? 0) || (b.o ?? 0) - (a.o ?? 0) || a.i - b.i)
  for (const p of men) {
    let n = p.b != null ? F.builds?.[p.b]?.num ?? p.num : p.num
    if (n == null || taken.has(n)) n = freeNum(p, taken)
    taken.add(n)
    p.num = n
    p.nt = short
  }
}
// every team (setup, a new season, a save that has men without one)
export function numberAll(F) { for (const s of Object.keys(F?.teams ?? {})) fixNumbers(F, s) }
export const needsNumbers = F => Object.entries(F?.teams ?? {}).some(([s, t]) => t.r.some(p => p.num == null || p.nt !== s))
