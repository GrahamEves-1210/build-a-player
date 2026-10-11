// What a season can say about itself: the
// milestones and real records a stat line can hit, league leaders to measure
// against, and the headlines a season writes. Pure data + small helpers; the
// director (seasonDirector.js) wires them to a running season.

import { seeded } from './rng'

// ── Records (real single-season marks) ───────────────────────────────────────
export const RECORDS = {
  nfl: {
    qb: [
      { id: 'passyds', label: 'Passing yards', stat: 'seasonPassYds', value: 5477, holder: 'Peyton Manning, 2013' },
      { id: 'passtd',  label: 'Passing TDs',   stat: 'seasonTDs',     value: 55,   holder: 'Peyton Manning, 2013' },
      { id: 'g-passyds', label: 'Passing yards in a game', game: 'passYds', value: 554, holder: 'Norm Van Brocklin, 1951' },
      { id: 'g-passtd',  label: 'TD passes in a game',     game: 'tds',     value: 7,   holder: 'eight players' },
    ],
    rb: [
      { id: 'rushyds', label: 'Rushing yards', stat: 'seasonRushYds', value: 2105, holder: 'Eric Dickerson, 1984' },
      { id: 'rushtd',  label: 'Rushing TDs',   stat: 'seasonRushTDs', value: 28,   holder: 'LaDainian Tomlinson, 2006' },
      { id: 'g-rush',  label: 'Rushing yards in a game', game: 'rushYds', value: 296, holder: 'Adrian Peterson, 2007' },
    ],
    wr: [
      { id: 'recyds', label: 'Receiving yards', stat: 'seasonRecYds', value: 1964, holder: 'Calvin Johnson, 2012' },
      { id: 'rectd',  label: 'Receiving TDs',   stat: 'seasonRecTDs', value: 23,   holder: 'Randy Moss, 2007' },
      { id: 'g-rec',  label: 'Receiving yards in a game', game: 'recYds', value: 336, holder: 'Flipper Anderson, 1989' },
    ],
    te: [
      { id: 'recyds', label: 'Receiving yards by a TE', stat: 'seasonRecYds', value: 1416, holder: 'Travis Kelce, 2020' },
      { id: 'rectd',  label: 'Receiving TDs by a TE',   stat: 'seasonRecTDs', value: 18,   holder: 'Rob Gronkowski, 2011' },
    ],
    db: [
      { id: 'ints', label: 'Interceptions', stat: 'seasonINTs', value: 14, holder: 'Dick "Night Train" Lane, 1952' },
      { id: 'g-ints', label: 'INTs in a game', game: 'ints', value: 4, holder: 'many' },
    ],
    ol: [],
    team: [{ id: 'wins', label: 'Perfect regular season', statFn: r => r.losses === 0 && r.wins >= 17, holder: '2007 Patriots (16-0)' }],
  },
  bucket: {
    guard: [
      { id: 'ppg', label: 'Points per game', stat: 'ppg', value: 50.4, holder: 'Wilt Chamberlain, 1962' },
      { id: 'apg', label: 'Assists per game', stat: 'apg', value: 14.5, holder: 'John Stockton, 1990' },
      { id: 'g-pts', label: 'Points in a game', game: 'pts', value: 100, holder: 'Wilt Chamberlain, 1962' },
    ],
    big: [
      { id: 'ppg', label: 'Points per game', stat: 'ppg', value: 50.4, holder: 'Wilt Chamberlain, 1962' },
      { id: 'rpg', label: 'Rebounds per game', stat: 'rpg', value: 27.2, holder: 'Wilt Chamberlain, 1961' },
      { id: 'g-pts', label: 'Points in a game', game: 'pts', value: 100, holder: 'Wilt Chamberlain, 1962' },
    ],
    team: [{ id: 'wins', label: 'Most wins in a season', statFn: r => r.wins >= 74, holder: '2016 Warriors (73-9)' }],
  },
}

// ── Milestones (fire once as the season reveals) ─────────────────────────────
// ctx: { games (revealed so far), totals, wins, losses, streak, last }
const sumOf = (games, k) => games.reduce((s, g) => s + (g[k] ?? 0), 0)
const steps = (id, label, k, marks, unit) => marks.map(m => ({ id: `${id}-${m}`, label: label.replace('{n}', m.toLocaleString()), test: c => sumOf(c.games, k) >= m, big: m >= marks[marks.length - 2], unit }))
export const MILESTONES = {
  nfl: {
    common: [
      { id: 'streak-4', label: '4 straight wins', test: c => c.streak >= 4 },
      { id: 'streak-7', label: 'Seven straight', test: c => c.streak >= 7, big: true },
      { id: 'start-5-0', label: '5-0 start', test: c => c.games.length === 5 && c.wins === 5, big: true },
      { id: 'wins-10', label: '10 wins', test: c => c.wins >= 10 },
      { id: 'wins-13', label: '13 wins', test: c => c.wins >= 13, big: true },
      { id: 'unbeaten-8', label: 'Unbeaten at the halfway mark', test: c => c.games.length >= 8 && c.losses === 0, big: true },
    ],
    qb: [...steps('yds', '{n} passing yards', 'passYds', [1000, 2000, 3000, 4000, 5000]), ...steps('td', '{n} TD passes', 'tds', [10, 20, 30, 40, 50]),
      { id: 'g-300', label: '300-yard game', test: c => c.last?.passYds >= 300 }, { id: 'g-400', label: '400-yard game', test: c => c.last?.passYds >= 400, big: true }, { id: 'g-5td', label: 'Five TD passes in a game', test: c => c.last?.tds >= 5, big: true }],
    rb: [...steps('rush', '{n} rushing yards', 'rushYds', [500, 1000, 1500, 2000]), ...steps('td', '{n} rushing TDs', 'rushTDs', [5, 10, 15, 20]),
      { id: 'g-100', label: '100-yard game', test: c => c.last?.rushYds >= 100 }, { id: 'g-200', label: '200-yard game', test: c => c.last?.rushYds >= 200, big: true }],
    wr: [...steps('rec', '{n} receiving yards', 'recYds', [500, 1000, 1500]), ...steps('td', '{n} receiving TDs', 'recTDs', [5, 10, 15]),
      { id: 'g-150', label: '150-yard game', test: c => c.last?.recYds >= 150 }, { id: 'g-200', label: '200-yard game', test: c => c.last?.recYds >= 200, big: true }],
    te: [...steps('rec', '{n} receiving yards', 'recYds', [500, 1000, 1250]), ...steps('td', '{n} receiving TDs', 'recTDs', [5, 10, 15]),
      { id: 'g-120', label: '120-yard game', test: c => c.last?.recYds >= 120 }],
    db: [...steps('int', '{n} interceptions', 'ints', [3, 6, 9, 12]), ...steps('pbu', '{n} passes defended', 'pbus', [10, 15, 20]),
      { id: 'pick6', label: 'Pick-six', test: c => c.last?.pickSixes >= 1, big: true }, { id: 'g-2int', label: 'Two-INT game', test: c => c.last?.ints >= 2 }],
    ol: [...steps('pnk', '{n} pancakes', 'pancakes', [20, 40, 60]),
      { id: 'clean-3', label: 'Three straight clean sheets', test: c => c.games.length >= 3 && c.games.slice(-3).every(g => g.sacks === 0) }],
  },
  bucket: {
    common: [
      { id: 'streak-6', label: 'Six straight wins', test: c => c.streak >= 6 },
      { id: 'streak-12', label: 'Twelve straight', test: c => c.streak >= 12, big: true },
      { id: 'wins-50', label: '50 wins', test: c => c.wins >= 50 }, { id: 'wins-60', label: '60 wins', test: c => c.wins >= 60, big: true }, { id: 'wins-70', label: '70 wins', test: c => c.wins >= 70, big: true },
      { id: 'g-40', label: '40-point game', test: c => c.last?.pts >= 40 }, { id: 'g-50', label: '50-point game', test: c => c.last?.pts >= 50, big: true }, { id: 'g-60', label: '60-POINT GAME', test: c => c.last?.pts >= 60, big: true },
      { id: 'trip-dbl', label: 'Triple-double', test: c => c.last && c.last.pts >= 10 && c.last.reb >= 10 && c.last.ast >= 10, big: true },
      { id: 'pts-1000', label: '1,000 points', test: c => sumOf(c.games, 'pts') >= 1000 }, { id: 'pts-2000', label: '2,000 points', test: c => sumOf(c.games, 'pts') >= 2000, big: true },
    ],
    guard: [], big: [],
  },
}

// ── League leaders (synthesised from the real pool around real-world scale) ─
const LEADER_STAT = {
  nfl: {
    qb: { key: 'seasonPassYds', label: 'PASS YDS', base: 3350, per: 330, noise: 240 },
    rb: { key: 'seasonRushYds', label: 'RUSH YDS', base: 880, per: 220, noise: 160 },
    wr: { key: 'seasonRecYds', label: 'REC YDS', base: 930, per: 210, noise: 150 },
    te: { key: 'seasonRecYds', label: 'REC YDS', base: 620, per: 160, noise: 120 },
    db: { key: 'seasonINTs', label: 'INT', base: 2.4, per: 1.1, noise: 1.2, int: true },
    ol: { key: 'seasonPancakes', label: 'PANCAKES', base: 34, per: 7, noise: 6, int: true },
  },
  bucket: {
    guard: { key: 'ppg', label: 'PPG', base: 21.5, per: 2.6, noise: 1.8, dec: 1 },
    big: { key: 'ppg', label: 'PPG', base: 20.5, per: 2.4, noise: 1.8, dec: 1 },
  },
}
const avgAttr = p => { const v = Object.values(p.attrs || {}); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0 }
// Real scoring for the league's actual scorers (a current season, give or take):
// the board leans on these, so a 41-year-old LeBron doesn't lead the league at 29
const REAL_PPG = {
  'Luka Doncic': 32, 'Shai Gilgeous-Alexander': 31.5, 'Giannis Antetokounmpo': 29.5, 'Tyrese Maxey': 28.5, 'Nikola Jokic': 28,
  'Anthony Edwards': 28, 'Jaylen Brown': 28, 'Donovan Mitchell': 27.5, 'Jalen Brunson': 27, 'Kawhi Leonard': 27,
  'Cade Cunningham': 26.5, 'Stephen Curry': 26.5, 'Lauri Markkanen': 26, 'Austin Reaves': 26, 'Kevin Durant': 25.5,
  'Jamal Murray': 25.5, 'Devin Booker': 25, 'James Harden': 25, 'Victor Wembanyama': 24.5, 'Joel Embiid': 24.5,
  'Jayson Tatum': 24, 'Karl-Anthony Towns': 23.5, 'Pascal Siakam': 23.5, 'Trae Young': 23, 'Zion Williamson': 22.5,
  'Paolo Banchero': 22.5, 'Jalen Johnson': 22.5, 'Alperen Sengun': 22, 'Jalen Williams': 22, 'Franz Wagner': 22,
  'Kyrie Irving': 22, 'Trey Murphy III': 22, 'Anthony Davis': 21.5, 'LaMelo Ball': 21.5, 'LeBron James': 21,
  'Ja Morant': 21, 'Tyler Herro': 21, 'Damian Lillard': 21, 'Cooper Flagg': 20.5, 'Scottie Barnes': 20.5,
  'Jaren Jackson Jr.': 20.5, 'Zach LaVine': 20, 'Evan Mobley': 20, 'Brandon Miller': 20, 'Desmond Bane': 19.5,
  'Jalen Green': 19, 'Darius Garland': 19, 'Bam Adebayo': 18.5, 'Derrick White': 18.5, 'Chet Holmgren': 18,
  'Josh Giddey': 18, 'Amen Thompson': 18, 'Mikal Bridges': 17.5, 'Domantas Sabonis': 17,
}
export function leaderBoard({ sport, pos, pool, seed, you }) {
  const def = LEADER_STAT[sport]?.[pos]
  if (!def) return null
  const r = seeded(`leaders-${seed}`)
  // basketball: the real scorers in the pool, at their real averages give or take
  // a point (an all-time pool has none of them, and falls through to the ratings)
  const real = sport === 'bucket' ? (pool || []).filter(p => REAL_PPG[p.name] != null) : []
  if (real.length >= 4) {
    const seen = new Set()
    const top = real.filter(p => !seen.has(p.name) && seen.add(p.name)).map(p => ({ name: p.name, team: p.team, value: +(REAL_PPG[p.name] + (r() - 0.5) * 2).toFixed(1) }))
      .sort((a, b) => b.value - a.value).slice(0, 7)
    const mine = { name: you.name, team: you.team, value: you.value, me: true }
    const all = [...top, mine].sort((a, b) => b.value - a.value)
    return { label: def.label, key: def.key, rows: all.slice(0, 6), rank: all.indexOf(mine) + 1, of: all.length }
  }
  const rows = [...(pool || [])].filter(p => p.attrs).sort((a, b) => avgAttr(b) - avgAttr(a)).slice(0, 7).map(p => {
    let v = def.base + (avgAttr(p) - 5.2) * def.per + (r() - 0.5) * 2 * def.noise
    v = def.int ? Math.max(0, Math.round(v)) : def.dec ? +Math.max(0, v).toFixed(def.dec) : Math.max(0, Math.round(v))
    return { name: p.name, team: p.team, value: v }
  })
  const mine = { name: you.name, team: you.team, value: you.value, me: true }
  const all = [...rows, mine].sort((a, b) => b.value - a.value)
  return { label: def.label, key: def.key, rows: all.slice(0, 6), rank: all.indexOf(mine) + 1, of: all.length }
}
export const leaderStatKey = (sport, pos) => LEADER_STAT[sport]?.[pos]?.key ?? null

// ── Headlines ────────────────────────────────────────────────────────────────
const pick = (r, a) => a[Math.floor(r() * a.length)]
export function headlineFor(ev, r = Math.random) {
  const { name, team, opp, n, label } = ev
  switch (ev.type) {
    case 'streak': return pick(r, [`${team} make it ${n} straight`, `${n} in a row — ${team} are rolling`, `${name} has ${team} on a ${n}-game heater`])
    case 'skid': return pick(r, [`${team} drop ${n} straight`, `Pressure mounts: ${n}-game skid in ${team.split(' ').slice(-1)[0]} land`, `${team} searching for answers after ${n} losses`])
    case 'big': return pick(r, [`${name} torches ${opp}: ${label}`, `${label} — ${name} takes over vs ${opp}`, `${opp} had no answer for ${name} (${label})`])
    case 'bust': return pick(r, [`Rough night for ${name} in ${opp} loss`, `${opp} bottle up ${name}`, `${name}, ${team} stumble at ${opp}`])
    case 'milestone': return pick(r, [`${name} reaches ${label}`, `Milestone: ${label} for ${name}`, `${name} hits ${label} as ${team} keep pace`])
    case 'record': return `RECORD: ${name} sets the all-time mark — ${label}`
    case 'clinch': return pick(r, [`${team} clinch a playoff berth`, `Playoffs: ${team} are in`, `${name} leads ${team} to the postseason`])
    case 'out': return pick(r, [`${team} eliminated from playoff contention`, `Season slips away for ${team}`])
    case 'moment': return label
    case 'race': return pick(r, [`${name} in the ${label} conversation`, `${label} watch: ${name} climbing`, `Voters noticing ${name}'s season`])
    default: return label || ''
  }
}

// The decisions themselves live in scenarios.js.
