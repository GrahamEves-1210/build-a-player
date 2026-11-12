// College Basketball: recruiting and the transfer portal, shared by Career's Start in College
// (CareerCollegeHoops.jsx) and the one-off mode (CBBMode.jsx). College Football's (components/cfb/cfbRecruit.js),
// on basketball's numbers: stars, a national ranking, a program's level, the man he'd have to beat at a school,
// the schools offering him, and (the one-off mode) how a season moves his stock.
import { seeded } from '../../lib/rng'

const clamp = (a, b, x) => Math.max(a, Math.min(b, x))
export const LEAVES = new Set(['SR', 'GR'])   // a starter in his last year is gone next season

// ── Career's scale: the NBA build plus the college boost (CareerCollegeHoops collegeBuild) ──
// (two steps on every trait but Size put a build about 8 over its NBA rating until it runs into 99. The lines
// follow recruiting's own shares: an NBA-builder 84 or better is a five-star, 79 a four-star, 74 a three-star.)
export const starsFor = ovr => (ovr >= 93 ? 5 : ovr >= 88 ? 4 : ovr >= 83 ? 3 : 2)
const BANDS = [[93, 99, 1, 25], [88, 92.99, 26, 110], [83, 87.99, 111, 400], [0, 82.99, 401, 900]]
export function rankFor(ovr, pos, seed, nbaOvr = null) {
  const [lo, hi] = BANDS.find(b => ovr >= b[0])
  const t = lo >= BANDS[0][0] && nbaOvr != null ? clamp(0, 1, (95 - nbaOvr) / 11) : clamp(0, 1, (hi - ovr) / Math.max(1, hi - lo))
  return rankIn(starsFor(ovr), t, pos, seed)
}
function rankIn(stars, t, pos, seed) {
  const r = seeded(`cbb-rank-${seed}`)
  const [, , best, worst] = BANDS[5 - stars]
  const overall = Math.max(1, Math.round(best + t * (worst - best) + (r() - 0.5) * (worst - best) * 0.08))
  const posRank = Math.max(1, Math.round(overall / ({ guard: 1.7, big: 2.6 })[pos] + r() * 1.2))
  return { overall, posRank }
}

// a program's level: blue bloods and the top 12 · the rest of the top 45 in a power league · power leagues and the
// best of the rest · everyone else
export const BLUE = new Set(['DUKE', 'KAN', 'UKY', 'UNC', 'CONN', 'UCLA', 'IND', 'MSU', 'ARIZ', 'GONZ', 'VILL', 'HOU', 'FLA', 'PUR', 'LOU'])
export function tierOf(t, confTier) {
  if (BLUE.has(t.short) || t.bpiRank <= 12) return 5
  if (confTier === 'HIGH' && t.bpiRank <= 45) return 4
  if (confTier === 'HIGH' || t.bpiRank <= 75) return 3
  return 2
}
// who he'd have to beat at a school: the last starter in his pool (the fifth starter's spot is the one a new man takes)
export function barAt(data, short, pos) {
  const room = data.pools[pos].filter(p => p.team === short && p.starter)
  return room.length ? room.reduce((a, b) => ((b.ovr ?? 0) < (a.ovr ?? 0) ? b : a)) : null
}
export const startsOver = (bar, ovr, year = 0) => !bar || ovr > (bar.ovr ?? 0) || (year > 0 && LEAVES.has(String(bar.year).toUpperCase()))

// The schools offering him: his stars' level (and the one below when it's thin), the ones with a job he can win
// first, a little luck. lift (the transfer, -1 to 1): a big year pulls the higher-rated programs up the list
export function offersFor(data, { stars, ovr, pos, seed, skip = [], n = 5, lift = 0 }) {
  const r = seeded(`cbb-offers-${seed}`)
  const tierOfConf = Object.fromEntries(data.conferences.map(c => [c.id, c.tier]))
  const all = data.teams.filter(t => !skip.includes(t.short)).map(t => ({ t, tier: tierOf(t, tierOfConf[t.conf]), bar: barAt(data, t.short, pos) }))
  let pool = all.filter(x => x.tier === stars)
  if (pool.length < n + 2) pool = pool.concat(all.filter(x => x.tier === stars - 1 || (stars === 2 && x.tier === 3)))
  const scored = pool.map(x => ({ ...x, need: ovr - (x.bar?.ovr ?? 70), score: r() * 2 + clamp(-8, 8, ovr - (x.bar?.ovr ?? 70)) * 0.16 + (x.tier === stars ? 0.8 : 0) + (lift ? lift * 1.4 * (75 - clamp(1, 150, x.t.bpiRank ?? 75)) / 75 : 0) }))
    .sort((a, b) => b.score - a.score)
  const pick = scored.slice(0, n)
  if (!pick.some(x => x.need > 0)) { const s = scored.find(x => x.need > 0); if (s) pick[pick.length - 1] = s }
  return pick.map(x => ({ short: x.t.short, tier: x.tier, starts: x.need > 0, bar: x.bar ? { name: x.bar.name, ovr: x.bar.ovr, year: x.bar.year } : null }))
}

// ── The one-off mode's scale: the build is made of college players, so his OVR is already a college OVR ──
// His stars are where he'd rank among the country's real starters in his pool, cut at the size of each level: as
// good as the starters at the top 18 programs is a five-star, the next 26 a four-star, the next 34 a three-star.
const LEVEL_SIZES = [18, 26, 34]
const linesCache = new WeakMap()
function starLines(data, pos) {
  const memo = linesCache.get(data) ?? {}
  if (memo[pos]) return memo[pos]
  const per = pos === 'guard' ? 3 : 2   // a school starts about three guards and wings and two bigs
  const s = data.pools[pos].filter(p => p.starter).map(p => p.ovr ?? 0).sort((a, b) => b - a)
  const at = k => s[Math.min(s.length - 1, k * per - 1)] ?? 70
  let n = 0
  const lines = LEVEL_SIZES.map(k => at(n += k))
  memo[pos] = { lines, top: s[0] ?? 99 }
  linesCache.set(data, memo)
  return memo[pos]
}
export function collegeStars(data, pos, ovr) {
  const { lines, top } = starLines(data, pos)
  const k = lines.findIndex(l => ovr >= l)
  const stars = k < 0 ? 2 : 5 - k
  const hi = k <= 0 ? (k === 0 ? top : lines[2]) : lines[k - 1]
  const lo = k < 0 ? lines[2] - 10 : lines[k]
  return { stars, t: clamp(0, 1, (hi - ovr) / Math.max(1, hi - lo)) }
}
export const nationalRank = (data, pos, ovr) => 1 + data.pools[pos].filter(p => (p.ovr ?? 0) > ovr).length
export function cardFor(baseData, data, pos, ovr, stock = null) {
  const { stars: base, t } = collegeStars(baseData, pos, ovr)
  const stars = clamp(2, 5, base + (stock?.move ?? 0))
  return { stars, base, t, posRank: nationalRank(data, pos, ovr), of: data.pools[pos].length }
}

// ── A season's pull on his stock (the transfer portal) ──
// The record, the titles, the Tournament, the Wooden and All-America, in points. A point and a half of good news
// lifts him a level, a point of bad news drops him one; never more than one either way.
export function stockOf(r, confName = null, baseStars = null) {
  const c = r?.cbb ?? {}
  const rec = String(c.record?.final ?? `${r?.wins ?? 0}-${r?.losses ?? 0}`)
  const [w, l] = rec.split('-').map(Number)
  const a = c.awards ?? {}
  const x = c.ncaa?.exit
  let pts = 0
  const good = []
  if (w >= 27) pts += 1; else if (w >= 22) pts += 0.5
  if (l >= 18) pts -= 1.25; else if (l >= 15) pts -= 0.75; else if (w <= 15) pts -= 0.25
  if (r?.champion) { pts += 1; good.push('a national title') }
  else if (x === 'Final Four' || x === 'National Championship') { pts += 0.75; good.push('a Final Four') }
  else if (x === 'Sweet 16' || x === 'Elite Eight') { pts += 0.5; good.push(`a run to the ${x}`) }
  else if (c.ncaa?.seed) pts += 0.25
  if (c.confChamp) { pts += 0.5; good.unshift(`the ${confName ?? 'conference'} tournament title`) }
  else if (c.confRegChamp) { pts += 0.25; good.unshift(`the ${confName ?? 'conference'} regular-season title`) }
  if (a.wooden?.userWon) { pts += 1; good.push('the Wooden Award') }
  else if (a.wooden?.userFinalist) { pts += 0.5; good.push('a place among the Wooden finalists') }
  if (a.allAmerica?.user === 'first') { pts += 0.5; good.push('first-team All-America') }
  else if (a.allAmerica?.user) { pts += 0.25; good.push(`${a.allAmerica.user}-team All-America`) }
  if (r?.role === 'bench') pts -= 0.5
  pts = clamp(-1.5, 3, pts)
  const move = pts >= 1.5 ? 1 : pts <= -1 ? -1 : 0
  const lift = clamp(-1, 1, pts / 2)
  const what = [rec, ...good.slice(0, 3)]
  const head = what.length > 2 ? `${what.slice(0, -1).join(', ')} and ${what[what.length - 1]}` : what.join(' and ')
  const top = baseStars >= 5, floor = baseStars != null && baseStars <= 2
  const verdict = move > 0 && top ? 'every top program wants him'
    : move > 0 ? 'the bigger programs are calling now'
    : pts >= 0.75 ? 'more programs want him'
    : move < 0 && !floor ? 'the bigger programs have cooled on him'
    : move < 0 || pts <= -0.5 ? 'fewer programs are calling'
    : 'his stock holds where it was'
  return { pts, move, lift, record: rec, line: `${head}: ${verdict}.`, dir: move > 0 || pts >= 0.75 ? 'up' : move < 0 || pts <= -0.5 ? 'down' : 'even' }
}
