// TEST FIXTURE ONLY (never imported by src/): a tiny stand-in for the baseball data and sim, so the app shell's
// pages can be rendered in Node before the real files land (scripts/baseball/render-check.mjs points the
// src/data/mlb-* and utils/baseballSimulation imports here). Made-up players and numbers: not game data.
export const MLB_TEAMS = [
  { short: 'NYY', name: 'New York Yankees', league: 'AL', division: 'East', color: '#0c2340', color2: '#c4ced3', espn: 10, off: 8, def: 7, ovr: 8 },
  { short: 'BOS', name: 'Boston Red Sox', league: 'AL', division: 'East', color: '#bd3039', color2: '#0c2340', espn: 2, off: 7, def: 6, ovr: 6 },
  { short: 'TOR', name: 'Toronto Blue Jays', league: 'AL', division: 'East', color: '#134a8e', color2: '#e8291c', espn: 14, off: 7, def: 7, ovr: 7 },
  { short: 'TB', name: 'Tampa Bay Rays', league: 'AL', division: 'East', color: '#092c5c', color2: '#8fbce6', espn: 30, off: 5, def: 7, ovr: 6 },
  { short: 'BAL', name: 'Baltimore Orioles', league: 'AL', division: 'East', color: '#df4601', color2: '#000000', espn: 1, off: 6, def: 5, ovr: 5 },
]
const A = (o) => ({ contact: 6, power: 6, eye: 6, avoidK: 6, gap: 6, speed: 6, baserunning: 6, fielding: 6, arm: 6, clutch: 6, ...o })
const P = (o) => ({ velocity: 6, movement: 6, breaking: 6, changeup: 6, control: 6, command: 6, stamina: 6, groundball: 6, composure: 6, pitchIQ: 6, ...o })
export const MLB_BATTERS = MLB_TEAMS.flatMap((t, k) => ['C', 'SS', 'CF'].map((role, i) => ({ name: `Test Hitter ${t.short}${i}`, short: `Hitter${i}`, team: t.short, number: 10 + i, height: 72 + i, weight: 200 + i * 10, age: 27, bats: i ? 'L' : 'R', throws: 'R', skin: '#c58c63', espn: null, starter: i === 0, role, attrs: A({ power: 4 + i + k % 3, contact: 5 + i }) })))
export const MLB_PITCHERS = MLB_TEAMS.flatMap((t, k) => ['SP', 'SP', 'CL'].map((role, i) => ({ name: `Test Arm ${t.short}${i}`, short: `Arm${i}`, team: t.short, number: 40 + i, height: 75, weight: 215, age: 29, bats: 'R', throws: i === 1 ? 'L' : 'R', skin: '#e0b088', espn: null, starter: i === 0, role, attrs: P({ velocity: 5 + i + k % 3 }) })))
export const MLB_LEGEND_BATTERS = MLB_BATTERS.slice(0, 6).map(p => ({ ...p, name: p.name.replace('Test', 'Old'), years: '1990-2005' }))
export const MLB_LEGEND_PITCHERS = MLB_PITCHERS.slice(0, 6).map(p => ({ ...p, name: p.name.replace('Test', 'Old'), years: '1990-2005' }))
export default {}

// ── the sim stand-in: the shape BaseballSimPage's view() reads ──
export const calcBaseballOVR = (b, types) => { const v = types.map(t => b[t]?.val ?? 0); return v.length ? Math.round(55 + (v.reduce((s, x) => s + x, 0) / v.length) * 4) : 0 }
export function runBaseballSimulation(build, types, team, position) {
  let seed = 7
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const opps = MLB_TEAMS.filter(t => t.short !== team.short).map(t => t.short)
  const games = Array.from({ length: 162 }, (_, i) => {
    const rs = Math.floor(r() * 9), ra = Math.floor(r() * 8)
    const ab = 4, h = Math.floor(r() * 3), hr = r() < 0.08 ? 1 : 0
    const sp = position === 'pit' && i % 5 === 0
    return { opp: opps[i % opps.length], home: i % 2 === 0, rs, ra: ra === rs ? ra + 1 : ra, line: position === 'pit' ? (sp ? { ip: 6.1, h: 5, er: 2, bb: 1, so: 7, dec: rs > ra ? 'W' : 'L', gs: true } : {}) : { ab, h, hr, rbi: hr + (r() < 0.3 ? 1 : 0), bb: r() < 0.1 ? 1 : 0, so: 1, d: r() < 0.06 ? 1 : 0 } }
  })
  const wins = games.filter(g => g.rs > g.ra).length
  return {
    ovr: calcBaseballOVR(build, types), team, league: 'AL', division: 'East', season: 2026, wins, losses: 162 - wins, games,
    standings: MLB_TEAMS.map((t, i) => ({ short: t.short, wins: t.short === team.short ? wins : 90 - i * 4, losses: t.short === team.short ? 162 - wins : 72 + i * 4 })),
    leagueField: [{ short: team.short, wins, losses: 162 - wins, divWinner: true }, { short: 'HOU', wins: 92, losses: 70, divWinner: true }],
    madePlayoffs: true, seed: 1, champion: false,
    playoffRounds: [
      { round: 'Division Series', opponent: { short: 'BOS' }, wins: 3, losses: 1, won: true, games: [{ opp: 'BOS', rs: 5, ra: 2, home: true }, { opp: 'BOS', rs: 1, ra: 3, home: true }, { opp: 'BOS', rs: 4, ra: 3 }, { opp: 'BOS', rs: 6, ra: 0 }] },
      { round: 'ALCS', opponent: { short: 'TOR' }, wins: 2, losses: 4, won: false, games: [] },
    ],
    bracket: { AL: { wc: [{ a: 'TOR', b: 'TB', score: [2, 1] }], ds: [{ a: team.short, b: 'BOS', score: [3, 1] }], lcs: { a: team.short, b: 'TOR', score: [2, 4] } }, NL: { wc: [], ds: [], lcs: null }, ws: { a: 'TOR', b: 'LAD', score: [4, 2] } },
    wsWinner: 'TOR',
    mvp: { won: false, rank: 3, winner: { name: 'Test Hitter BOS0' }, race: [{ name: 'Test Hitter BOS0', team: 'BOS', war: 8.1 }, { name: 'X', team: 'TOR', war: 7.2 }, { isPlayer: true, team: team.short, war: 6.9 }] },
    allStar: { won: true, starter: true, spot: 'DH' },
    silverSlugger: true,
  }
}
