// College Football: recruiting and the transfer portal, shared by Career's Start in College (CareerCollege.jsx)
// and the one-off mode (CFBMode.jsx). Stars, a national ranking, a program's level, the man he'd have to beat
// at a school, the schools offering him, and (the one-off mode) how a season moves his stock.
// The screens' pieces (the offer board, the commit bar) are in CFBOffers.jsx.
import { seeded } from '../../lib/rng'

const clamp = (a, b, x) => Math.max(a, Math.min(b, x))
export const LEAVES = new Set(['SR', 'RS-SR', 'GR', 'RS-GR', '5TH', 'RS-5TH'])   // a starter in his last year is gone next season

// ── Career's scale: the NFL build plus the college boost (CareerCollege collegeBuild) ──
// (on the college scale, the build plus the college gap. With a full letter on every trait the boosted OVR sits
// about 12 over his NFL rating until it runs into 99 (an NFL 85 or better is a 99 in college), so the lines are
// 99 / 95 / 89: the same recruits get the same stars the old gap gave them (scratch check, 2026-11-10: an NFL
// 70-74 is a 2-star, 75-79 a 3-star, 80-84 mostly a 4-star, 85+ a 5-star, a touch lower for backs and receivers))
export const starsFor = ovr => (ovr >= 99 ? 5 : ovr >= 95 ? 4 : ovr >= 89 ? 3 : 2)
// a composite-style national ranking from the boosted OVR, inside his stars' band. (Every 5-star is a 99 in
// college, so inside that band it's his NFL-builder OVR that orders them: a 97 is the No. 1 recruit, an 85 the
// last of the five-stars)
const BANDS = [[99, 99, 1, 32], [95, 98.99, 33, 330], [89, 94.99, 331, 1400], [0, 88.99, 1401, 3200]]
export function rankFor(ovr, pos, seed, nflOvr = null) {
  const [lo, hi] = BANDS.find(b => ovr >= b[0])
  const t = lo >= 99 ? (nflOvr == null ? 0.5 : clamp(0, 1, (97 - nflOvr) / 12)) : clamp(0, 1, (hi - ovr) / Math.max(1, hi - lo))
  return rankIn(starsFor(ovr), t, pos, seed)
}
// the ranking inside a stars band: t 0 = the top of the band, 1 = its last name
function rankIn(stars, t, pos, seed) {
  const r = seeded(`cfb-rank-${seed}`)
  const [, , best, worst] = BANDS[5 - stars]
  const overall = Math.max(1, Math.round(best + t * (worst - best) + (r() - 0.5) * (worst - best) * 0.08))
  const posRank = Math.max(1, Math.round(overall / ({ qb: 11, wr: 6, rb: 10 })[pos] + r() * 1.2))
  return { overall, posRank }
}

// a program's level: blue bloods and the top 10 · the Power 4 · lower P4 and the best of the G6 · the G6
export const BLUE = new Set(['ALA', 'OSU', 'UGA', 'TEX', 'MICH', 'NDAM', 'USC', 'OKLA', 'LSU', 'ORE', 'PSU', 'CLEM', 'FLA', 'MIA', 'TENN'])
export function tierOf(t, confTier) {
  if (BLUE.has(t.short) || t.fpiRank <= 10) return 5
  if ((confTier === 'P4' || t.short === 'NDAM') && t.fpiRank <= 45) return 4
  if (confTier === 'P4' || t.fpiRank <= 70) return 3
  return 2
}
// who he'd have to beat at a school: the starter (a receiver: the third starter, the last spot in the three)
export function barAt(data, short, pos) {
  const room = data.pools[pos].filter(p => p.team === short).sort((a, b) => (a.depth ?? 9) - (b.depth ?? 9))
  return (pos === 'wr' ? room[2] ?? room[room.length - 1] : room[0]) ?? null
}
export const startsOver = (bar, ovr, year = 0) => !bar || ovr > (bar.ovr ?? 0) || (year > 0 && LEAVES.has(String(bar.year).toUpperCase()))

// The schools offering him: his stars' level (and the one below when it's thin), the ones with a job he can win
// first, a little luck. lift (the one-off mode's transfer, -1 to 1): a big year pulls the higher-rated programs
// in his level up the list, a bad one the lower ones (0: Career's offers, unchanged)
export function offersFor(data, { stars, ovr, pos, seed, skip = [], n = 5, lift = 0 }) {
  const r = seeded(`cfb-offers-${seed}`)
  const tierOfConf = Object.fromEntries(data.conferences.map(c => [c.id, c.tier]))
  const all = data.teams.filter(t => !skip.includes(t.short)).map(t => ({ t, tier: tierOf(t, tierOfConf[t.conf]), bar: barAt(data, t.short, pos) }))
  let pool = all.filter(x => x.tier === stars)
  if (pool.length < n + 2) pool = pool.concat(all.filter(x => x.tier === stars - 1 || (stars === 2 && x.tier === 3)))
  const scored = pool.map(x => ({ ...x, need: ovr - (x.bar?.ovr ?? 70), score: r() * 2 + clamp(-8, 8, ovr - (x.bar?.ovr ?? 70)) * 0.16 + (x.tier === stars ? 0.8 : 0) + (lift ? lift * 1.4 * (70 - clamp(1, 138, x.t.fpiRank ?? 70)) / 70 : 0) }))
    .sort((a, b) => b.score - a.score)
  const pick = scored.slice(0, n)
  // at least one school where he'd start, when there is one
  if (!pick.some(x => x.need > 0)) { const s = scored.find(x => x.need > 0); if (s) pick[pick.length - 1] = s }
  return pick.map(x => ({ short: x.t.short, tier: x.tier, starts: x.need > 0, bar: x.bar ? { name: x.bar.name, ovr: x.bar.ovr, year: x.bar.year } : null }))
}

// ── The one-off mode's scale: the build is made of college players, so his OVR is already a college OVR ──
// His stars are where he'd rank among the country's real starters at his spot (QB1 and RB1, a receiver among the
// three starting receivers), cut at the size of each level: as good as the starters at the 18 top-level programs
// is a 5-star, the next 26 (the rest of the upper Power 4) a 4-star, the next 34 a 3-star, the rest a 2-star.
// (2026 data: a QB 91+ is a 5-star, 85+ a 4-star, 80+ a 3-star; a Chambliss-level 95 is a 5-star, a median QB1, 81, a 3-star)
const LEVEL_SIZES = [18, 26, 34]
const linesCache = new WeakMap()
function starLines(data, pos) {
  const memo = linesCache.get(data) ?? {}
  if (memo[pos]) return memo[pos]
  const per = pos === 'wr' ? 3 : 1
  const s = data.pools[pos].filter(p => (p.depth ?? 9) <= per).map(p => p.ovr ?? 0).sort((a, b) => b - a)
  const at = k => s[Math.min(s.length - 1, k * per - 1)] ?? 70
  let n = 0
  const lines = LEVEL_SIZES.map(k => at(n += k))   // [5-star line, 4-star line, 3-star line]
  memo[pos] = { lines, top: s[0] ?? 99 }
  linesCache.set(data, memo)
  return memo[pos]
}
// { stars, t }: t is where he sits inside his band (0 = its top)
export function collegeStars(data, pos, ovr) {
  const { lines, top } = starLines(data, pos)
  const k = lines.findIndex(l => ovr >= l)
  const stars = k < 0 ? 2 : 5 - k
  const hi = k <= 0 ? (k === 0 ? top : lines[2]) : lines[k - 1]
  const lo = k < 0 ? lines[2] - 10 : lines[k]
  return { stars, t: clamp(0, 1, (hi - ovr) / Math.max(1, hi - lo)) }
}
// his place among the players at his position still in college (every one on the rosters, starters and backups)
export function nationalRank(data, pos, ovr) {
  return 1 + data.pools[pos].filter(p => (p.ovr ?? 0) > ovr).length
}
// a recruiting card for the one-off mode: stars (moved by a season, stock), the position rank, the OVR
export function cardFor(baseData, data, pos, ovr, stock = null) {
  const { stars: base, t } = collegeStars(baseData, pos, ovr)
  const stars = clamp(2, 5, base + (stock?.move ?? 0))
  return { stars, base, t, posRank: nationalRank(data, pos, ovr), of: data.pools[pos].length }
}

// ── A season's pull on his stock (the one-off mode's transfer portal) ──
// The record, the titles, the Playoff, the Heisman and All-America, in points. A point and a half of good news lifts him a
// level (better programs call), a point of bad news drops him one; never more than one either way. Inside the
// level, the same points push the offers toward the higher- or lower-rated programs (offersFor lift).
export function stockOf(r, confName = null, baseStars = null) {
  const c = r?.cfb ?? {}
  const rec = String(c.record?.final ?? `${r?.wins ?? 0}-${r?.losses ?? 0}`)
  const [w, l] = rec.split('-').map(Number)
  const a = c.awards ?? {}
  let pts = 0
  const good = []
  if (w >= 11) pts += 1; else if (w >= 9) pts += 0.5
  if (l >= 7) pts -= 1.25; else if (l >= 6) pts -= 0.75; else if (w <= 7) pts -= 0.25
  if (r?.champion) { pts += 1; good.push('a national title') }
  else if (c.cfpSeed) { pts += 0.5; good.push('a CFP run') }
  if (c.confChamp) { pts += 0.5; good.unshift(`the ${confName ?? 'conference'} title`) }
  if (a.heisman?.userWon) { pts += 1; good.push('the Heisman') }
  else if (a.heisman?.userFinalist) { pts += 0.5; good.push('a trip to New York as a Heisman finalist') }
  if (a.allAmerica?.user === 'first') { pts += 0.5; good.push('first-team All-America') }
  else if (a.allAmerica?.user === 'second') { pts += 0.25; good.push('second-team All-America') }
  pts = clamp(-1.5, 3, pts)
  const move = pts >= 1.5 ? 1 : pts <= -1 ? -1 : 0
  const lift = clamp(-1, 1, pts / 2)
  const what = [rec, ...good.slice(0, 3)]
  const head = what.length > 2 ? `${what.slice(0, -1).join(', ')} and ${what[what.length - 1]}` : what.join(' and ')
  // (a 5-star can't go up a level, a 2-star can't go down one: the line says what happens to him)
  const top = baseStars >= 5, floor = baseStars != null && baseStars <= 2
  const verdict = move > 0 && top ? 'every top program wants him'
    : move > 0 ? 'the bigger programs are calling now'
    : pts >= 0.75 ? 'more programs want him'
    : move < 0 && !floor ? 'the bigger programs have cooled on him'
    : move < 0 ? 'fewer programs are calling'
    : pts <= -0.5 ? 'fewer programs are calling'
    : 'his stock holds where it was'
  return { pts, move, lift, record: rec, line: `${head}: ${verdict}.`, dir: move > 0 || pts >= 0.75 ? 'up' : move < 0 || pts <= -0.5 ? 'down' : 'even' }
}
