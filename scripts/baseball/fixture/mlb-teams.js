// TEST FIXTURE ONLY (scripts/baseball/sim-test.mjs uses it when src/data/mlb-teams.js isn't there yet).
// Same shape as the data agent's file. off/def on the 1-10 scale; rough 2026 strength, for testing the engine.
const T = (league, division, rows) => rows.map(([short, name, off, def]) => ({ short, name, league, division, color: '#c8102e', color2: '#0c2340', espn: null, off, def, ovr: Math.round(70 + (off + def) * 1.5) }))
export const MLB_TEAMS = [
  ...T('AL', 'East', [['NYY', 'New York Yankees', 8.0, 6.6], ['TB', 'Tampa Bay Rays', 6.4, 7.6], ['BOS', 'Boston Red Sox', 6.6, 6.2], ['TOR', 'Toronto Blue Jays', 6.4, 5.2], ['BAL', 'Baltimore Orioles', 5.8, 4.8]]),
  ...T('AL', 'Central', [['CLE', 'Cleveland Guardians', 4.8, 7.0], ['CWS', 'Chicago White Sox', 5.4, 5.6], ['DET', 'Detroit Tigers', 5.2, 6.2], ['MIN', 'Minnesota Twins', 5.2, 4.8], ['KC', 'Kansas City Royals', 4.6, 4.8]]),
  ...T('AL', 'West', [['HOU', 'Houston Astros', 5.8, 5.6], ['SEA', 'Seattle Mariners', 5.6, 6.0], ['TEX', 'Texas Rangers', 5.0, 5.8], ['ATH', 'Athletics', 5.0, 3.4], ['LAA', 'Los Angeles Angels', 4.4, 3.4]]),
  ...T('NL', 'East', [['ATL', 'Atlanta Braves', 6.8, 6.6], ['PHI', 'Philadelphia Phillies', 6.4, 6.8], ['NYM', 'New York Mets', 6.0, 4.6], ['MIA', 'Miami Marlins', 5.0, 5.2], ['WSH', 'Washington Nationals', 5.0, 4.2]]),
  ...T('NL', 'Central', [['MIL', 'Milwaukee Brewers', 7.0, 7.8], ['CHC', 'Chicago Cubs', 6.8, 6.0], ['PIT', 'Pittsburgh Pirates', 4.4, 6.8], ['STL', 'St. Louis Cardinals', 5.0, 4.8], ['CIN', 'Cincinnati Reds', 5.2, 5.0]]),
  ...T('NL', 'West', [['LAD', 'Los Angeles Dodgers', 8.4, 7.0], ['SD', 'San Diego Padres', 6.0, 7.0], ['ARI', 'Arizona Diamondbacks', 6.6, 5.0], ['SF', 'San Francisco Giants', 4.4, 4.4], ['COL', 'Colorado Rockies', 3.6, 2.4]]),
]
