// TEST FIXTURE (career agent): a stand-in for src/data/mlb-teams.js until the data agent's file lands, so the career
// can be run in node (scripts/baseball/alias.mjs points the import here only while the real file is missing).
// Rough 2025 strength on the 1-10 scale; nothing here ships.
const T = (short, name, league, division, color, color2, off, def) => ({ short, name, league, division, color, color2, espn: null, off, def, ovr: Math.round(60 + (off + def) * 2) })
export const MLB_TEAMS = [
  T('BAL', 'Baltimore Orioles', 'AL', 'East', '#df4601', '#000000', 5.6, 4.8), T('BOS', 'Boston Red Sox', 'AL', 'East', '#bd3039', '#0c2340', 6.4, 6.2),
  T('NYY', 'New York Yankees', 'AL', 'East', '#0c2340', '#c4ced3', 7.6, 6.6), T('TB', 'Tampa Bay Rays', 'AL', 'East', '#092c5c', '#8fbce6', 5.6, 6.2),
  T('TOR', 'Toronto Blue Jays', 'AL', 'East', '#134a8e', '#e8291c', 7.2, 6.4),
  T('CWS', 'Chicago White Sox', 'AL', 'Central', '#27251f', '#c4ced4', 3.4, 4.0), T('CLE', 'Cleveland Guardians', 'AL', 'Central', '#0c2340', '#e31937', 4.8, 6.6),
  T('DET', 'Detroit Tigers', 'AL', 'Central', '#0c2340', '#fa4616', 6.0, 6.8), T('KC', 'Kansas City Royals', 'AL', 'Central', '#004687', '#bd9b60', 5.2, 6.4),
  T('MIN', 'Minnesota Twins', 'AL', 'Central', '#002b5c', '#d31145', 5.2, 4.8),
  T('ATH', 'Athletics', 'AL', 'West', '#003831', '#efb21e', 6.2, 4.4), T('HOU', 'Houston Astros', 'AL', 'West', '#002d62', '#eb6e1f', 5.8, 6.4),
  T('LAA', 'Los Angeles Angels', 'AL', 'West', '#ba0021', '#003263', 5.0, 4.4), T('SEA', 'Seattle Mariners', 'AL', 'West', '#0c2c56', '#005c5c', 6.6, 6.8),
  T('TEX', 'Texas Rangers', 'AL', 'West', '#003278', '#c0111f', 4.8, 7.0),
  T('ATL', 'Atlanta Braves', 'NL', 'East', '#13274f', '#ce1141', 6.0, 5.6), T('MIA', 'Miami Marlins', 'NL', 'East', '#00a3e0', '#ef3340', 5.0, 4.8),
  T('NYM', 'New York Mets', 'NL', 'East', '#002d72', '#ff5910', 7.0, 5.8), T('PHI', 'Philadelphia Phillies', 'NL', 'East', '#e81828', '#002d72', 6.8, 7.0),
  T('WSH', 'Washington Nationals', 'NL', 'East', '#ab0003', '#14225a', 4.6, 3.8),
  T('CHC', 'Chicago Cubs', 'NL', 'Central', '#0e3386', '#cc3433', 7.0, 6.6), T('CIN', 'Cincinnati Reds', 'NL', 'Central', '#c6011f', '#000000', 5.4, 6.4),
  T('MIL', 'Milwaukee Brewers', 'NL', 'Central', '#12284b', '#ffc52f', 6.8, 7.4), T('PIT', 'Pittsburgh Pirates', 'NL', 'Central', '#27251f', '#fdb827', 3.4, 6.8),
  T('STL', 'St. Louis Cardinals', 'NL', 'Central', '#c41e3a', '#0c2340', 5.4, 5.2),
  T('ARI', 'Arizona Diamondbacks', 'NL', 'West', '#a71930', '#e3d4ad', 6.8, 5.0), T('COL', 'Colorado Rockies', 'NL', 'West', '#33006f', '#c4ced4', 3.6, 2.4),
  T('LAD', 'Los Angeles Dodgers', 'NL', 'West', '#005a9c', '#ef3e42', 7.8, 6.8), T('SD', 'San Diego Padres', 'NL', 'West', '#2f241d', '#ffc425', 6.0, 7.0),
  T('SF', 'San Francisco Giants', 'NL', 'West', '#fd5a1e', '#27251f', 5.4, 6.2),
]
