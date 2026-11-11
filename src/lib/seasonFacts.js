// What a season can say about itself: the
// milestones and real records a stat line can hit, league leaders to measure
// against, and the headlines a season writes. Pure data + small helpers; the
// director (seasonDirector.js) wires them to a running season.

import { seeded } from './rng'

// ── Records (real single-season marks) ───────────────────────────────────────
export const RECORDS = {
  nfl: {
    // NFL single-season records. Counting stats are checked as the season plays
    // (the moment you pass one, it's called); rates (completion %, rating) at the end.
    // `get` reads a stat the season doesn't keep on its own (yards from scrimmage…).
    qb: [
      { id: 'passyds', label: 'Passing yards', stat: 'seasonPassYds', value: 5477, holder: 'Peyton Manning, 2013' },
      { id: 'passtd',  label: 'Passing TDs',   stat: 'seasonTDs',     value: 55,   holder: 'Peyton Manning, 2013' },
      { id: 'qbrush',  label: 'Rushing yards by a QB', stat: 'seasonRushYds', value: 1206, holder: 'Lamar Jackson, 2019' },
      { id: 'qbrushtd', label: 'Rushing TDs by a QB',  stat: 'seasonRushTDs', value: 15, holder: 'Jalen Hurts & Josh Allen, 2023', end: true },
      { id: 'comppct', label: 'Completion percentage', stat: 'seasonCompPct', value: 74.4, holder: 'Drew Brees, 2018', end: true, pct: true },
      { id: 'rating',  label: 'Passer rating',         stat: 'seasonRating',  value: 122.5, holder: 'Aaron Rodgers, 2011', end: true },
      { id: 'g-passyds', label: 'Passing yards in a game', game: 'passYds', value: 554, holder: 'Norm Van Brocklin, 1951' },
      { id: 'g-passtd',  label: 'TD passes in a game',     game: 'tds',     value: 7,   holder: 'eight players' },
    ],
    rb: [
      { id: 'rushyds', label: 'Rushing yards', stat: 'seasonRushYds', value: 2105, holder: 'Eric Dickerson, 1984' },
      { id: 'rushtd',  label: 'Rushing TDs',   stat: 'seasonRushTDs', value: 28,   holder: 'LaDainian Tomlinson, 2006' },
      { id: 'scrim',   label: 'Yards from scrimmage', get: t => (t.seasonRushYds ?? 0) + (t.seasonRecYds ?? 0), value: 2509, holder: 'Chris Johnson, 2009' },
      { id: 'tottd',   label: 'Total touchdowns',     get: t => (t.seasonRushTDs ?? 0) + (t.seasonRecTDs ?? 0), value: 31, holder: 'LaDainian Tomlinson, 2006' },
      { id: 'rbrec',   label: 'Receptions by a RB',   stat: 'seasonRecs', value: 116, holder: 'Christian McCaffrey, 2019' },
      { id: 'g-rush',  label: 'Rushing yards in a game', game: 'rushYds', value: 296, holder: 'Adrian Peterson, 2007' },
    ],
    wr: [
      { id: 'recyds', label: 'Receiving yards', stat: 'seasonRecYds', value: 1964, holder: 'Calvin Johnson, 2012' },
      { id: 'rectd',  label: 'Receiving TDs',   stat: 'seasonRecTDs', value: 23,   holder: 'Randy Moss, 2007' },
      { id: 'recs',   label: 'Receptions',      stat: 'seasonRecs',   value: 149,  holder: 'Michael Thomas, 2019' },
      { id: 'g-rec',  label: 'Receiving yards in a game', game: 'recYds', value: 336, holder: 'Flipper Anderson, 1989' },
    ],
    te: [
      { id: 'recyds', label: 'Receiving yards by a TE', stat: 'seasonRecYds', value: 1416, holder: 'Travis Kelce, 2020' },
      { id: 'rectd',  label: 'Receiving TDs by a TE',   stat: 'seasonRecTDs', value: 18,   holder: 'Rob Gronkowski, 2011' },
      { id: 'terec',  label: 'Receptions by a TE',      stat: 'seasonRecs',   value: 116,  holder: 'Zach Ertz, 2018' },
    ],
    db: [
      { id: 'ints', label: 'Interceptions', stat: 'seasonINTs', value: 14, holder: 'Dick "Night Train" Lane, 1952' },
      { id: 'pick6', label: 'Pick-sixes',   stat: 'seasonPickSixes', value: 4, holder: 'Ken Houston, Jim Kearney & Eric Allen' },
      // (the game's PD is the breakups, picks apart: Revis's 31 is the mark it chases)
      { id: 'pd', label: 'Passes defended', stat: 'seasonPBUs', value: 31, holder: 'Darrelle Revis, 2009' },
      { id: 'g-ints', label: 'INTs in a game', game: 'ints', value: 4, holder: 'many' },
    ],
    // Sacks official since 1982 (Al Baker's 23 in 1978 is unofficial). TFL since 1999,
    // forced fumbles unofficial but tracked since 1978.
    dl: [
      { id: 'sacks', label: 'Sacks', stat: 'seasonSacks', value: 23, holder: 'Myles Garrett, 2025' },
      { id: 'tfl',   label: 'Tackles for loss', stat: 'seasonTFL', value: 39, holder: 'J.J. Watt, 2012' },
      { id: 'ff',    label: 'Forced fumbles',   stat: 'seasonFF',  value: 10, holder: 'Osi Umenyiora, 2010 & Charles Tillman, 2012' },
      { id: 'dtsacks', label: 'Sacks by a DT', get: t => (t.spot === 'DT' ? t.seasonSacks : null), value: 20.5, holder: 'Aaron Donald, 2018', end: true },
      { id: 'g-sacks', label: 'Sacks in a game', game: 'sacks', value: 7, holder: 'Derrick Thomas, 1990' },
    ],
    lb: [],
    // A lineman's marks are a career's: nobody keeps an official count of a season's sacks allowed or
    // pancakes (and a sackless year can be matched, never beaten). `career` reads the career totals
    // (lib/career.js bookSeason: the season he passes it); the season director skips these.
    ol: [
      { id: 'olpb', label: 'Pro Bowls by an offensive lineman', career: t => t.proBowls, value: 14, holder: 'Bruce Matthews, 1983-2001', end: true },
      { id: 'olap', label: 'First-team All-Pros by an offensive lineman', career: t => t.allPros, value: 10, holder: 'Jim Otto, 1960-69', end: true },
      { id: 'olgs', label: 'Starts by an offensive lineman', career: t => t.stats?.starts, value: 293, holder: 'Bruce Matthews, 1983-2001', end: true },
    ],
    // A kicker's single-season marks (the percentage can be matched at 100, never beaten, so it isn't one), and the
    // two a single game can break. The 2025 holders are from ESPN's season tables.
    k: [
      { id: 'kfg',  label: 'Field goals', stat: 'seasonFGM', value: 44, holder: "David Akers, 2011 & Ka'imi Fairbairn, 2025" },
      { id: 'kpts', label: 'Points by a kicker', stat: 'seasonPoints', value: 166, holder: 'David Akers, 2011' },
      { id: 'k50',  label: 'Field goals from 50 or longer', stat: 'season50M', value: 14, holder: 'Brandon Aubrey, 2024', end: true },
      { id: 'g-kfg',  label: 'Field goals in a game', game: 'fgm', value: 8, holder: 'Rob Bironas, 2007' },
      { id: 'g-klong', label: 'Longest field goal', game: 'long', value: 68, holder: 'Cam Little, 2025' },
    ],
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
    dl: [...steps('sck', '{n} sacks', 'sacks', [5, 10, 15, 20]), ...steps('tfl', '{n} tackles for loss', 'tfl', [10, 20, 30]),
      { id: 'g-2sck', label: 'Two-sack game', test: c => c.last?.sacks >= 2 }, { id: 'g-3sck', label: 'Three-sack game', test: c => c.last?.sacks >= 3, big: true },
      { id: 'safety', label: 'Safety', test: c => c.last?.safeties >= 1, big: true }],
    lb: [...steps('tkl', '{n} tackles', 'tackles', [50, 100, 150]), ...steps('lbsck', '{n} sacks', 'sacks', [3, 6]), ...steps('lbint', '{n} interceptions', 'ints', [2, 4]),
      { id: 'g-12tkl', label: 'Twelve-tackle game', test: c => c.last?.tackles >= 12 }, { id: 'g-int', label: 'Interception', test: c => c.last?.ints >= 1 },
      { id: 'pick6', label: 'Pick-six', test: c => c.last?.pickSixes >= 1, big: true }],
    k: [...steps('kpts', '{n} points', 'pts', [50, 100, 150]), ...steps('kfg', '{n} field goals', 'fgm', [10, 20, 30, 40]),
      { id: 'g-55', label: 'A 55-yarder', test: c => c.last?.long >= 55 && c.last?.long < 60, quiet: true }, { id: 'g-60', label: 'A 60-yard field goal', test: c => c.last?.long >= 60, big: true, quiet: true },
      { id: 'gw', label: 'Game-winning kick', test: c => c.last?.gw >= 1, big: true, quiet: true },   // (quiet: the game's own headline says it)
      { id: 'perfect-8', label: 'Perfect through eight games', test: c => c.games.length === 8 && sumOf(c.games, 'fga') >= 10 && sumOf(c.games, 'fga') === sumOf(c.games, 'fgm'), big: true }],
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
// College Football (CFBSimPage, the director as 'cfb'): a 12-game season, six wins for a bowl, the same stat marks
MILESTONES.cfb = {
  common: [
    { id: 'streak-4', label: '4 straight wins', test: c => c.streak >= 4 },
    { id: 'streak-7', label: 'Seven straight', test: c => c.streak >= 7, big: true },
    { id: 'start-5-0', label: '5-0 start', test: c => c.games.length === 5 && c.wins === 5, big: true },
    { id: 'bowl-6', label: 'bowl eligibility', test: c => c.wins >= 6 },
    { id: 'wins-10', label: '10 wins', test: c => c.wins >= 10 },
    { id: 'unbeaten-6', label: 'Unbeaten at the halfway mark', test: c => c.games.length === 6 && c.losses === 0, big: true },
    { id: 'perfect', label: 'A perfect 12-0', test: c => c.games.length === 12 && c.losses === 0, big: true },
  ],
  qb: MILESTONES.nfl.qb, rb: MILESTONES.nfl.rb, wr: MILESTONES.nfl.wr,
}

// ── League leaders (synthesised from the real pool around real-world scale) ─
const LEADER_STAT = {
  nfl: {
    qb: { key: 'seasonPassYds', label: 'PASS YDS', base: 3350, per: 330, noise: 240 },
    rb: { key: 'seasonRushYds', label: 'RUSH YDS', base: 880, per: 220, noise: 160 },
    wr: { key: 'seasonRecYds', label: 'REC YDS', base: 930, per: 210, noise: 150 },
    te: { key: 'seasonRecYds', label: 'REC YDS', base: 620, per: 160, noise: 120 },
    // Interceptions are played out as a season, not a rating plus a little noise (that put the same
    // two or three top-rated corners on top at 7-8 every year). Real leaders, 2015-2025: 8, 7, 8, 7, 6,
    // 10, 11, 6, 9, 9, 7 (Nelson, Hayward, Byard & Slay, Fuller/Howard/Kazee, Gilmore/White/Harris,
    // Xavien Howard, Trevon Diggs, four tied, DaRon Bland, Kerby Joseph, Kevin Byard: pro-football-reference
    // and Wikipedia's annual leaders list): only Howard and Byard led twice, and leaders often drop to
    // 3-5 the next year (Diggs 11 then 3). So every DB in the pool gets an expected total from his
    // ratings (`mu`: ~4-4.5 for the very best ball hawks, ~1.6 for an average starter), one season-long
    // luck factor (lognormal, mean 1, `sigma`, held under `luck`) and a Poisson draw; the most picks lead.
    // No one has had more than 11 since Lester Hayes' 13 in 1980, so the board stops at `max`.
    db: { key: 'seasonINTs', label: 'INT', season: true, mu: rt => Math.max(0.5, 1.6 + (rt - 6) * 0.7), sigma: 0.3, luck: 1.7, max: 12, int: true },
    // a good year leads the league at 15-19 and the sixth man has about 12. Rated on the pass rush
    // alone, and from inside it comes harder (a DT in the top ten is rare)
    dl: { key: 'seasonSacks', label: 'SACKS', base: 5.5, per: 2, noise: 3.5, int: true, unique: true, rate: p => { const a = p.attrs; const r = ((a.getOff ?? 5) * 1.2 + (a.bend ?? 5) + (a.finesseMoves ?? 5) + (a.powerMoves ?? 5) * 0.8 + (a.speed ?? 5) * 0.8) / 4.8; return p.subpos === 'dt' ? r - 1.5 : r } },
    // the tackle race: the leader has about 150-170; rated on the range, the tackling and the read
    lb: { key: 'seasonTackles', label: 'TACKLES', base: 105, per: 13, noise: 9, int: true, unique: true, rate: p => { const a = p.attrs; return ((a.range ?? 5) + (a.tackling ?? 5) + (a.playRecognition ?? 5) * 0.6) / 2.6 } },
    ol: { key: 'seasonPancakes', label: 'PANCAKES', base: 34, per: 7, noise: 6, int: true },
    // the scoring race among kickers: the leader has about 150-165 points, a middling starter about 115
    k: { key: 'seasonPoints', label: 'POINTS', base: 116, per: 8.5, noise: 11, int: true, unique: true },
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
// (his place is among the whole field, not the top seven: the board shows the top five and, when he isn't in it, his
// own row under them with his real rank. Before, he was ranked against the top seven only, so he read No. 8 every time)
function boardOf(def, field, you) {
  const mine = { name: you.name, team: you.team, value: you.value, me: true }
  const all = [...field, mine].sort((a, b) => b.value - a.value).map((x, i) => ({ ...x, rank: i + 1 }))
  const me = all.find(x => x.me)
  const top = all.slice(0, 5)
  return { label: def.label, key: def.key, rows: me.rank <= 5 ? top : [...top, me], rank: me.rank, of: all.length }
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
    const field = real.filter(p => !seen.has(p.name) && seen.add(p.name)).map(p => ({ name: p.name, team: p.team, value: +(REAL_PPG[p.name] + (r() - 0.5) * 2).toFixed(1) }))
    return boardOf(def, field, you)
  }
  const rate = def.rate ?? avgAttr
  const named = new Set()   // (an all-time pool can list a player twice, once per team)
  if (def.season) {
    // the whole pool plays the year: expected total x a season's luck, then a Poisson count
    const normal = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
    const poisson = lam => { const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= r() } while (p > L); return k - 1 }
    const rows = (pool || []).filter(p => p.attrs && !named.has(p.name) && named.add(p.name))
      .map(p => ({ name: p.name, team: p.team, value: Math.min(def.max, poisson(def.mu(rate(p)) * Math.min(def.luck, Math.exp(normal() * def.sigma - def.sigma * def.sigma / 2)))) }))
    return boardOf(def, rows, you)
  }
  const rows = [...(pool || [])].filter(p => p.attrs && (!def.unique || (!named.has(p.name) && named.add(p.name)))).sort((a, b) => rate(b) - rate(a)).map(p => {
    let v = def.base + (rate(p) - 5.2) * def.per + (r() - 0.5) * 2 * def.noise
    v = def.int ? Math.max(0, Math.round(v)) : def.dec ? +Math.max(0, v).toFixed(def.dec) : Math.max(0, Math.round(v))
    return { name: p.name, team: p.team, value: v }
  })
  return boardOf(def, rows, you)
}
export const leaderStatKey = (sport, pos) => LEADER_STAT[sport]?.[pos]?.key ?? null

// ── Headlines ────────────────────────────────────────────────────────────────
const pick = (r, a) => a[Math.floor(r() * a.length)]
export function headlineFor(ev, r = Math.random) {
  const { name, team, opp, n, label } = ev
  switch (ev.type) {
    case 'streak': if (ev.soccer) return pick(r, [`${team} make it ${n} wins in a row`, `${n} straight wins for ${team}`, `${name} has ${team} flying: ${n} on the bounce`])
      return pick(r, [`${team} make it ${n} straight`, `${n} in a row — ${team} are rolling`, `${name} has ${team} on a ${n}-game heater`])
    case 'skid': if (ev.soccer) return pick(r, [`${team} without a win in ${n}`, `Pressure on the manager: ${n} without a win for ${team}`, `${team} searching for answers after ${n} winless`])
      return pick(r, [`${team} drop ${n} straight`, `Pressure mounts: ${n}-game skid in ${team.split(' ').slice(-1)[0]} land`, `${team} searching for answers after ${n} losses`])
    case 'big': if (ev.pos === 'k') return ev.gw ? pick(r, [`${name} beats ${opp} at the gun: ${label}`, `Walk-off: ${name} wins it for ${team}`, `${team} survive ${opp} on ${name}'s leg (${label})`]) : pick(r, [`${name} perfect against ${opp}: ${label}`, `${label} for ${name} as ${team} handle ${opp}`])
      return pick(r, [`${name} torches ${opp}: ${label}`, `${label} — ${name} takes over vs ${opp}`, `${opp} had no answer for ${name} (${label})`])
    case 'bust': if (ev.pos === 'k') return pick(r, [`A missed kick costs ${team} at ${opp}`, `${name} misses late, ${team} fall to ${opp}`, `Rough day for ${name} in ${opp} loss`])
      return pick(r, [`Rough night for ${name} in ${opp} loss`, `${opp} bottle up ${name}`, `${name}, ${team} stumble at ${opp}`])
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
