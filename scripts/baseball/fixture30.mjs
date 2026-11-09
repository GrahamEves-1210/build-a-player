// TEST FIXTURE ONLY (never imported by src/): the 30 clubs and made-up rosters, so the real season engine
// (utils/baseballSimulation.js) can be run against the season page before data/mlb-teams.js, mlb-batters.js and
// mlb-pitchers.js land. Codes as the legends file spells them. Strength, colours and players are placeholders.
const CLUBS = [
  ['NYY', 'New York Yankees', 'AL', 'East', '#0c2340'], ['BOS', 'Boston Red Sox', 'AL', 'East', '#bd3039'], ['TOR', 'Toronto Blue Jays', 'AL', 'East', '#134a8e'],
  ['TB', 'Tampa Bay Rays', 'AL', 'East', '#092c5c'], ['BAL', 'Baltimore Orioles', 'AL', 'East', '#df4601'], ['CLE', 'Cleveland Guardians', 'AL', 'Central', '#00385d'],
  ['CHW', 'Chicago White Sox', 'AL', 'Central', '#27251f'], ['DET', 'Detroit Tigers', 'AL', 'Central', '#0c2340'], ['KC', 'Kansas City Royals', 'AL', 'Central', '#004687'],
  ['MIN', 'Minnesota Twins', 'AL', 'Central', '#002b5c'], ['ATH', 'Athletics', 'AL', 'West', '#003831'], ['HOU', 'Houston Astros', 'AL', 'West', '#002d62'],
  ['LAA', 'Los Angeles Angels', 'AL', 'West', '#ba0021'], ['SEA', 'Seattle Mariners', 'AL', 'West', '#0c2c56'], ['TEX', 'Texas Rangers', 'AL', 'West', '#003278'],
  ['ATL', 'Atlanta Braves', 'NL', 'East', '#13274f'], ['MIA', 'Miami Marlins', 'NL', 'East', '#00a3e0'], ['NYM', 'New York Mets', 'NL', 'East', '#002d72'],
  ['PHI', 'Philadelphia Phillies', 'NL', 'East', '#e81828'], ['WSH', 'Washington Nationals', 'NL', 'East', '#ab0003'], ['CHC', 'Chicago Cubs', 'NL', 'Central', '#0e3386'],
  ['CIN', 'Cincinnati Reds', 'NL', 'Central', '#c6011f'], ['MIL', 'Milwaukee Brewers', 'NL', 'Central', '#12284b'], ['PIT', 'Pittsburgh Pirates', 'NL', 'Central', '#27251f'],
  ['STL', 'St. Louis Cardinals', 'NL', 'Central', '#c41e3a'], ['ARI', 'Arizona Diamondbacks', 'NL', 'West', '#a71930'], ['COL', 'Colorado Rockies', 'NL', 'West', '#33006f'],
  ['LAD', 'Los Angeles Dodgers', 'NL', 'West', '#005a9c'], ['SD', 'San Diego Padres', 'NL', 'West', '#2f241d'], ['SF', 'San Francisco Giants', 'NL', 'West', '#fd5a1e'],
]
export const MLB_TEAMS = CLUBS.map(([short, name, league, division, color], i) => ({ short, name, league, division, color, color2: '#ffffff', espn: null, off: 4 + (i * 7) % 6, def: 4 + (i * 5) % 6, ovr: 5 }))
const BAT = ['contact', 'power', 'eye', 'avoidK', 'gap', 'speed', 'baserunning', 'fielding', 'arm', 'clutch']
const PIT = ['velocity', 'movement', 'breaking', 'changeup', 'control', 'command', 'stamina', 'groundball', 'composure', 'pitchIQ']
const grades = (keys, k) => Object.fromEntries(keys.map((t, j) => [t, 3 + ((k * 7 + j * 3) % 7)]))
export const MLB_BATTERS = MLB_TEAMS.flatMap((t, k) => ['C', '1B', 'SS', '3B', 'CF', 'RF'].map((role, i) => ({ name: `${t.short} Hitter ${i + 1}`, short: `Hitter ${i + 1}`, team: t.short, number: 10 + i, height: 70 + i, weight: 190 + i * 8, age: 24 + i, bats: i % 3 === 1 ? 'L' : 'R', throws: 'R', skin: '#c58c63', espn: null, starter: i === 1, position: 'bat', role, attrs: grades(BAT, k + i) })))
export const MLB_PITCHERS = MLB_TEAMS.flatMap((t, k) => ['SP', 'SP', 'SP', 'SP', 'RP', 'CL'].map((role, i) => ({ name: `${t.short} Arm ${i + 1}`, short: `Arm ${i + 1}`, team: t.short, number: 30 + i, height: 74 + (i % 3), weight: 205 + i * 5, age: 25 + i, bats: 'R', throws: i % 2 ? 'L' : 'R', skin: '#e0b088', espn: null, starter: i === 0, position: 'pit', role, attrs: grades(PIT, k + i * 2) })))
export default {}
