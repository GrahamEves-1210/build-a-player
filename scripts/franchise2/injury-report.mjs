// The injury check (sim.mjs, gameday.mjs): what injury.js did over the seasons played, against the NFL's numbers.
//   injuryReport(rows, { seasons, opening, builds })
//     rows: injury.js TALLY.rows · opening: { [year]: Map(id -> group) } the starters on opening day
//     builds: { [year]: [{ id, g }] } the player's builds on a roster that season
// The NFL (the source notes are at the top of src/lib/franchise2/injury.js): ~29 missed-game injuries a team-season,
// 3.1 games each, 64% two games or fewer; ~65-80 adjusted games lost a team; 40-50 torn ACLs a year. Ours should be
// the counts times QOL (injury.js: 0.8) with about the NFL's lengths.
const REG = 18, GAMES = 17
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0') + '%'
export function injuryReport(rows, { seasons, opening = {}, builds = {}, qol = 0.8 }) {
  const x = v => Math.round(v * qol)
  const reg = rows.filter(r => r.wk < REG)
  const ts = 32 * seasons
  const left = r => Math.max(0, GAMES - 0.5 - r.wk)          // (about: the games his team has left after this one, a bye counted half)
  const lost = r => Math.min(r.se ? 99 : r.w, left(r))
  const st = reg.filter(r => r.st)
  const out = []
  out.push(`injuries a team-season: ${(reg.length / ts).toFixed(1)} (starters ${(st.length / ts).toFixed(1)}) · NFL ~29 (x${qol} = ~${x(29)})`)
  out.push(`starter games lost a team-season: ${(st.reduce((a, r) => a + lost(r), 0) / ts).toFixed(1)} · all men ${(reg.reduce((a, r) => a + lost(r), 0) / ts).toFixed(1)} · NFL adjusted games lost ~65-80 (x${qol} = ~${x(65)}-${x(80)})`)
  out.push(`IR (4+ weeks) a team-season: ${(reg.filter(r => r.se || r.w >= 4).length / ts).toFixed(1)} · season-enders ${(reg.filter(r => r.se).length / ts).toFixed(1)} (starters ${(st.filter(r => r.se).length / ts).toFixed(1)}) · torn ACLs a year ${(reg.filter(r => r.l === 'torn ACL').length / seasons).toFixed(0)} (NFL 40-50 with camp and practice; x${qol})`)
  const byLen = [[1, 1], [2, 2], [3, 3], [4, 8], [9, 59]].map(([a, b]) => [a === b ? `${a} wk` : `${a}-${b > 20 ? '+' : b}`, reg.filter(r => !r.se && r.w >= a && r.w <= b).length])
  out.push(`length: ${byLen.map(([k, n]) => `${k} ${pct(n, reg.length)}`).join(' · ')} · season ${pct(reg.filter(r => r.se).length, reg.length)} · two weeks or fewer ${pct(reg.filter(r => !r.se && r.w <= 2).length, reg.length)} (NFL 64%)`)
  out.push(`games missed an injury (in the season): ${(reg.reduce((a, r) => a + lost(r), 0) / Math.max(1, reg.length)).toFixed(2)} (NFL 3.1) · a non-season-ending one's full length ${(reg.filter(r => !r.se).reduce((a, r) => a + r.w, 0) / Math.max(1, reg.filter(r => !r.se).length)).toFixed(2)} weeks`)
  const G = ['qb', 'rb', 'wr', 'te', 'ol', 'edge', 'dt', 'lb', 'cb', 's'], N = { qb: 1, rb: 1, wr: 3, te: 1, ol: 5, edge: 2, dt: 2, lb: 3, cb: 2, s: 2 }
  out.push(`a starter's injuries a game, by room (NFL's room rate x1.4 for a starter, x${qol}): ${G.map(g => `${g} ${pct(st.filter(r => r.g === g).length, N[g] * GAMES * ts)}`).join(' ')}`)
  // the men who started opening day: how often each misses games, and how often his season ends
  let n = 0, miss = 0, ended = 0, missG = {}, endG = {}, nG = {}
  for (const [y, m] of Object.entries(opening)) for (const [id, g] of m) {
    const mine = reg.filter(r => r.y === +y && r.i === id)
    n++; nG[g] = (nG[g] ?? 0) + 1
    if (mine.length) { miss++; missG[g] = (missG[g] ?? 0) + 1 }
    if (mine.some(r => r.se)) { ended++; endG[g] = (endG[g] ?? 0) + 1 }
  }
  if (n) out.push(`an opening-day starter (a build who starts is the same): misses a game or more ${pct(miss, n)}, season over ${pct(ended, n)} · by room ${G.map(g => `${g} ${pct(missG[g] ?? 0, nG[g])}/${pct(endG[g] ?? 0, nG[g])}`).join(' ')}`)
  // the player's builds themselves
  let bn = 0, bm = 0, be = 0, bg = 0
  for (const [y, list] of Object.entries(builds)) for (const b of list) {
    const mine = reg.filter(r => r.y === +y && r.i === b.id)
    bn++; if (mine.length) bm++; if (mine.some(r => r.se)) be++
    bg += mine.reduce((a, r) => a + lost(r), 0)
  }
  if (bn) out.push(`the builds: ${bn} build-seasons, missed games in ${bm} (${pct(bm, bn)}), season over in ${be} (${pct(be, bn)}), ${(bg / bn).toFixed(1)} games missed a season`)
  const carry = rows.filter(r => r.nx > 0)
  out.push(`into next season (ACL/Achilles late in the year): ${(carry.length / seasons).toFixed(1)} a year, ${(carry.reduce((a, r) => a + r.nx, 0) / Math.max(1, carry.length)).toFixed(1)} weeks on average`)
  return out
}
