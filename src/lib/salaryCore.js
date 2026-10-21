// Salary Cap boards, shared by the game (QBSalaryCap.jsx, BucketSalaryCap.jsx) and the
// live server's check (lib/verifyCore.js checkSalaryCap). Pure: no React, no storage.
// A day's board is 5 columns × 5 price tiers, dealt from the date's seed; yesterday's
// players are marked down a little so the board changes day to day, and two legends
// sit at the tier their ratings earn.

// Seeded RNG (mulberry32 variant)
export function seededRandom(seed) {
  let h = seed | 0
  return () => {
    h ^= h >>> 16
    h = Math.imul(h, 0x45d9f3b) | 0
    h ^= h >>> 16
    h = Math.imul(h, 0x119de1f3) | 0
    h ^= h >>> 16
    return (h >>> 0) / 0x100000000
  }
}

export const TIERS = [50, 40, 30, 20, 10]
// Non-overlapping quantile slices: tier N's whole pool always outranks tier N+1's whole
// pool, so price strictly tracks rating
export const TIER_BANDS = [[0.00, 0.20], [0.20, 0.40], [0.40, 0.60], [0.60, 0.80], [0.80, 1.00]]
export const BUDGET_OPTIONS = [130, 140, 150, 160, 170]
export const RECENT_PENALTY = 3.5

export const dateSeedOf = dateStr => { const [y, m, d] = dateStr.split('-').map(Number); return y * 10000 + m * 100 + d }
export function budgetForDateStr(dateStr) {
  const r = seededRandom(dateSeedOf(dateStr) ^ 0xB0B0B0)
  return BUDGET_OPTIONS[Math.floor(r() * BUDGET_OPTIONS.length)]
}
// the day before, as the board's seed (yyyymmdd)
export function yesterdaySeedOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const t = new Date(y, m - 1, d - 1)
  return t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate()
}

// One sport's board: typesFor(player, column) → the traits a column reads; look(player) →
// what the screen draws a card with ({ teamColor, teamColor2, photo }; nothing on the server)
export function salaryKit({ typesFor, look = () => ({}) }) {
  const catScore = (p, col) => { const ts = typesFor(p, col); return ts.reduce((s, t) => s + (p.attrs?.[t] ?? 5), 0) / ts.length }

  // A legend's tier in a column: their rank against the regular pool (no rand)
  function legendTierFor(legend, col, regulars) {
    const legScore = catScore(legend, col)
    const sorted = regulars.map(p => catScore(p, col)).sort((a, b) => b - a)
    const rank = sorted.findIndex(s => s <= legScore)
    // rank === -1: nobody scored as low as the legend → the legend is the worst
    const pct = rank === -1 ? 1.0 : rank / sorted.length
    if (pct < 0.20) return 0
    if (pct < 0.40) return 1
    if (pct < 0.60) return 2
    if (pct < 0.80) return 3
    return 4
  }

  // 2 legend slots a day: the pair cycles through every legend before repeating; rand()
  // places them in a column, their rank sets the tier
  function pickLegendSlots(rand, cols, legends, regulars, seed) {
    const y = Math.floor(seed / 10000), m = Math.floor((seed % 10000) / 100), day = seed % 100
    const epochMs = new Date(2026, 0, 1).getTime()
    const dayIdx = Math.round((new Date(y, m - 1, day).getTime() - epochMs) / 86400000)
    // a fixed shuffle of the legends, so the pairs aren't biased toward list order
    const fixedR = seededRandom(0xBADC0FFE)
    const shuffled = [...legends]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(fixedR() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const n = shuffled.length
    const leg0 = shuffled[((dayIdx * 2) % n + n) % n]
    const leg1 = shuffled[((dayIdx * 2 + 1) % n + n) % n]
    const usedLegends = new Set()
    if (leg0) usedLegends.add(leg0.name)
    if (leg1) usedLegends.add(leg1.name)
    const li0c = Math.floor(rand() * cols.length)
    const li1c = Math.floor(rand() * cols.length)
    let li0t = leg0 ? legendTierFor(leg0, cols[li0c], regulars) : 0
    let li1t = leg1 ? legendTierFor(leg1, cols[li1c], regulars) : 1
    // both in the same slot: the weaker one moves a tier cheaper (or, at the cheapest, one up)
    if (leg0 && leg1 && li1c === li0c && li1t === li0t) {
      const shift = t => t < TIERS.length - 1 ? t + 1 : t - 1
      if (catScore(leg0, cols[li0c]) <= catScore(leg1, cols[li0c])) li0t = shift(li0t)
      else li1t = shift(li1t)
    }
    const map = new Map()
    if (leg0) map.set(`${li0c}-${li0t}`, leg0)
    if (leg1) map.set(`${li1c}-${li1t}`, leg1)
    return { map, usedLegends }
  }

  // The names a seed's board deals (yesterday's board: who gets marked down today)
  function getPickedNamesForSeed(seed, cols, players) {
    const rand = seededRandom(seed)
    const legends = players.filter(p => p.legend)
    const regulars = players.filter(p => !p.legend)
    const { map: legendMap, usedLegends } = pickLegendSlots(rand, cols, legends, regulars, seed)
    const used = new Set([...usedLegends])
    for (const [key] of legendMap) used.add(legendMap.get(key).name)
    cols.forEach((col, ci) => {
      const scored = regulars.map(p => ({ name: p.name, catScore: catScore(p, col) })).sort((a, b) => b.catScore - a.catScore)
      const n = scored.length
      for (let ti = 0; ti < TIERS.length; ti++) {
        if (legendMap.has(`${ci}-${ti}`)) continue
        const [lo, hi] = TIER_BANDS[ti]
        let pool = scored.slice(Math.floor(lo * n), Math.max(Math.floor(lo * n) + 1, Math.floor(hi * n))).filter(p => !used.has(p.name))
        if (!pool.length) pool = scored.filter(p => !used.has(p.name))
        if (!pool.length) pool = scored
        used.add(pool[Math.floor(rand() * pool.length)].name)
      }
    })
    return used
  }

  // The board: [column][tier] → a card
  function generateGrid(cols, players, rand, recentlyUsed = new Set(), seed = 0) {
    const legends = players.filter(p => p.legend)
    const regulars = players.filter(p => !p.legend)
    // 2 rand() calls place the 2 legends: the same for everyone on the same day
    const { map: legendMap, usedLegends } = pickLegendSlots(rand, cols, legends, regulars, seed)
    const used = new Set([...usedLegends])
    return cols.map((col, ci) => {
      const scored = regulars
        .map(p => { const l = look(p); return { ...p, teamColor: l.teamColor, teamColor2: l.teamColor2, catScore: catScore(p, col) - (recentlyUsed.has(p.name) ? RECENT_PENALTY : 0) } })
        .sort((a, b) => b.catScore - a.catScore)
      const n = scored.length
      return TIERS.map((price, ti) => {
        const leg = legendMap.get(`${ci}-${ti}`)
        if (leg) {
          const attrs = {}
          typesFor(leg, col).forEach(t => { attrs[t] = leg.attrs?.[t] ?? 5 })
          return { ...leg, price, attrs, fullAttrs: leg.attrs, catScore: catScore(leg, col), ...look(leg), number: leg.number ?? null, id: `${col.key}-${price}-${leg.name}` }
        }
        const [lo, hi] = TIER_BANDS[ti]
        let pool = scored.slice(Math.floor(lo * n), Math.max(Math.floor(lo * n) + 1, Math.floor(hi * n))).filter(p => !used.has(p.name))
        if (!pool.length) pool = scored.filter(p => !used.has(p.name))
        if (!pool.length) pool = scored
        const player = pool[Math.floor(rand() * pool.length)]
        used.add(player.name)
        const attrs = {}
        typesFor(player, col).forEach(t => { attrs[t] = player.attrs?.[t] ?? 5 })
        return { ...player, price, attrs, fullAttrs: player.attrs, catScore: player.catScore, photo: look(player).photo, number: player.number ?? null, id: `${col.key}-${price}-${player.name}` }
      })
    })
  }

  // The day's board as the game deals it (yesterday's players marked down)
  function dailyGrid(cols, players, dateStr) {
    const recent = getPickedNamesForSeed(yesterdaySeedOf(dateStr), cols, players)
    return generateGrid(cols, players, seededRandom(dateSeedOf(dateStr)), recent, dateSeedOf(dateStr))
  }

  return { catScore, legendTierFor, pickLegendSlots, getPickedNamesForSeed, generateGrid, dailyGrid }
}
