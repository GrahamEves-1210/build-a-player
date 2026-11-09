// The 30 MLB clubs for baseball, Build-A-Player's fourth sport. Same role as data/nba-teams.js and data/nfl-teams.js.
//
//   short     ESPN's abbreviation (ESPN MLB teams API, site.api.espn.com .../baseball/mlb/teams); logos are
//             public/logos/mlb/{short}.png (ESPN team logo). espn = ESPN team id, mlb = MLB Stats API team id.
//   league / division   'AL' | 'NL', 'East' | 'Central' | 'West' (MLB Stats API, 2026 season).
//   color / color2      the club's official primary and secondary colours.
//   nick      the name on the jersey and the scoreboard (Yankees, Athletics...).
//
// STRENGTH (1-10, like nfl-teams.js; 5-6 is an average club), as of 2026-11-07 (the 2026 season and postseason over):
//   off = run scoring:    45% FanGraphs 2026 team wRC+, 30% 2026 runs scored, 25% FanGraphs Depth Charts 2027 projected RS/G
//   def = run prevention: 30% 2026 runs allowed, 20% 2026 team ERA+ (Baseball-Reference), 25% 2026 team FIP
//                         (Baseball-Reference), 25% FanGraphs Depth Charts 2027 projected RA/G
//   ovr = club strength:  45% 2026 run differential, 30% 2026 winning percentage, 25% 2027 projected wins
//   Each input is a z-score over the 30 clubs; each blend is re-standardised and mapped to round(5.5 + 1.9 z), 1 to 10.
//   y2026 holds the inputs (W-L, RS, RA from Baseball-Reference 2026 standings and team pages; wRC+ from FanGraphs);
//   p2027 the FanGraphs Depth Charts 2027 projected record. The 2027 projections were made before free agency (early
//   November rosters), so they only carry a quarter of each grade.
// SOURCES  Baseball-Reference 2026 MLB standings, team batting and team pitching (baseball-reference.com/leagues/majors/2026.shtml);
//   FanGraphs 2026 team batting leaderboard (wRC+); FanGraphs Depth Charts 2027 projected standings; MLB Stats API teams;
//   ESPN MLB teams API.

export const MLB_LEAGUES = [
  { id: 'AL', name: 'American League' },
  { id: 'NL', name: 'National League' },
]
export const MLB_DIVISIONS = ['East', 'Central', 'West']

export const MLB_TEAMS = [
  { short: 'ARI', name: 'Arizona Diamondbacks', nick: 'Diamondbacks', league: 'NL', division: 'West', color: '#A71930', color2: '#E3D4AD', espn: 29, mlb: 109, off: 6, def: 5, ovr: 6,
    y2026: { w: 86, l: 76, rs: 739, ra: 730, wrcPlus: 98.1, era: 4.18, fip: 4.34 }, p2027: { w: 79, l: 83 } },
  { short: 'ATH', name: 'Athletics', nick: 'Athletics', league: 'AL', division: 'West', color: '#003831', color2: '#EFB21E', espn: 11, mlb: 133, off: 5, def: 1, ovr: 2,
    y2026: { w: 64, l: 98, rs: 699, ra: 937, wrcPlus: 93.6, era: 5.51, fip: 4.94 }, p2027: { w: 80, l: 82 } },
  { short: 'ATL', name: 'Atlanta Braves', nick: 'Braves', league: 'NL', division: 'East', color: '#CE1141', color2: '#13274F', espn: 15, mlb: 144, off: 6, def: 7, ovr: 8,
    y2026: { w: 94, l: 68, rs: 742, ra: 626, wrcPlus: 97.3, era: 3.63, fip: 4.13 }, p2027: { w: 84, l: 78 } },
  { short: 'BAL', name: 'Baltimore Orioles', nick: 'Orioles', league: 'AL', division: 'East', color: '#DF4601', color2: '#000000', espn: 1, mlb: 110, off: 6, def: 5, ovr: 5,
    y2026: { w: 79, l: 82, rs: 718, ra: 739, wrcPlus: 101.6, era: 4.07, fip: 4.03 }, p2027: { w: 80, l: 82 } },
  { short: 'BOS', name: 'Boston Red Sox', nick: 'Red Sox', league: 'AL', division: 'East', color: '#BD3039', color2: '#0C2340', espn: 2, mlb: 111, off: 5, def: 8, ovr: 7,
    y2026: { w: 87, l: 75, rs: 689, ra: 611, wrcPlus: 98.7, era: 3.54, fip: 3.65 }, p2027: { w: 86, l: 76 } },
  { short: 'CHC', name: 'Chicago Cubs', nick: 'Cubs', league: 'NL', division: 'Central', color: '#0E3386', color2: '#CC3433', espn: 16, mlb: 112, off: 10, def: 5, ovr: 7,
    y2026: { w: 89, l: 73, rs: 850, ra: 703, wrcPlus: 114.3, era: 4.12, fip: 4.60 }, p2027: { w: 81, l: 81 } },
  { short: 'CHW', name: 'Chicago White Sox', nick: 'White Sox', league: 'AL', division: 'Central', color: '#27251F', color2: '#C4CED4', espn: 4, mlb: 145, off: 7, def: 5, ovr: 6,
    y2026: { w: 84, l: 78, rs: 776, ra: 720, wrcPlus: 104.4, era: 4.12, fip: 4.25 }, p2027: { w: 78, l: 84 } },
  { short: 'CIN', name: 'Cincinnati Reds', nick: 'Reds', league: 'NL', division: 'Central', color: '#C6011F', color2: '#000000', espn: 17, mlb: 113, off: 2, def: 3, ovr: 3,
    y2026: { w: 75, l: 87, rs: 666, ra: 826, wrcPlus: 91, era: 4.83, fip: 4.82 }, p2027: { w: 73, l: 89 } },
  { short: 'CLE', name: 'Cleveland Guardians', nick: 'Guardians', league: 'AL', division: 'Central', color: '#00385D', color2: '#E50022', espn: 5, mlb: 114, off: 4, def: 7, ovr: 6,
    y2026: { w: 85, l: 77, rs: 678, ra: 667, wrcPlus: 96.6, era: 3.77, fip: 3.81 }, p2027: { w: 83, l: 79 } },
  { short: 'COL', name: 'Colorado Rockies', nick: 'Rockies', league: 'NL', division: 'West', color: '#33006F', color2: '#C4CED4', espn: 27, mlb: 115, off: 5, def: 1, ovr: 1,
    y2026: { w: 58, l: 104, rs: 752, ra: 944, wrcPlus: 91.1, era: 5.59, fip: 4.86 }, p2027: { w: 66, l: 96 } },
  { short: 'DET', name: 'Detroit Tigers', nick: 'Tigers', league: 'AL', division: 'Central', color: '#0C2340', color2: '#FA4616', espn: 6, mlb: 116, off: 6, def: 7, ovr: 6,
    y2026: { w: 76, l: 86, rs: 723, ra: 652, wrcPlus: 101.8, era: 3.67, fip: 4.01 }, p2027: { w: 82, l: 80 } },
  { short: 'HOU', name: 'Houston Astros', nick: 'Astros', league: 'AL', division: 'West', color: '#002D62', color2: '#EB6E1F', espn: 18, mlb: 117, off: 7, def: 4, ovr: 5,
    y2026: { w: 81, l: 81, rs: 734, ra: 766, wrcPlus: 105.3, era: 4.45, fip: 4.52 }, p2027: { w: 79, l: 83 } },
  { short: 'KC', name: 'Kansas City Royals', nick: 'Royals', league: 'AL', division: 'Central', color: '#004687', color2: '#BD9B60', espn: 7, mlb: 118, off: 5, def: 3, ovr: 3,
    y2026: { w: 69, l: 93, rs: 690, ra: 810, wrcPlus: 97.8, era: 4.77, fip: 4.74 }, p2027: { w: 74, l: 88 } },
  { short: 'LAA', name: 'Los Angeles Angels', nick: 'Angels', league: 'AL', division: 'West', color: '#BA0021', color2: '#003263', espn: 3, mlb: 108, off: 2, def: 5, ovr: 3,
    y2026: { w: 62, l: 100, rs: 655, ra: 752, wrcPlus: 92.2, era: 4.29, fip: 4.09 }, p2027: { w: 74, l: 88 } },
  { short: 'LAD', name: 'Los Angeles Dodgers', nick: 'Dodgers', league: 'NL', division: 'West', color: '#005A9C', color2: '#EF3E42', espn: 19, mlb: 119, off: 10, def: 8, ovr: 10,
    y2026: { w: 100, l: 62, rs: 801, ra: 600, wrcPlus: 110.7, era: 3.55, fip: 3.68 }, p2027: { w: 94, l: 68 } },
  { short: 'MIA', name: 'Miami Marlins', nick: 'Marlins', league: 'NL', division: 'East', color: '#00A3E0', color2: '#EF3340', espn: 28, mlb: 146, off: 5, def: 5, ovr: 5,
    y2026: { w: 80, l: 82, rs: 715, ra: 712, wrcPlus: 100.3, era: 4.09, fip: 4.15 }, p2027: { w: 79, l: 83 } },
  { short: 'MIL', name: 'Milwaukee Brewers', nick: 'Brewers', league: 'NL', division: 'Central', color: '#12284B', color2: '#FFC52F', espn: 8, mlb: 158, off: 9, def: 8, ovr: 9,
    y2026: { w: 103, l: 59, rs: 832, ra: 618, wrcPlus: 107.3, era: 3.51, fip: 3.72 }, p2027: { w: 87, l: 75 } },
  { short: 'MIN', name: 'Minnesota Twins', nick: 'Twins', league: 'AL', division: 'Central', color: '#002B5C', color2: '#D31145', espn: 9, mlb: 142, off: 6, def: 5, ovr: 5,
    y2026: { w: 77, l: 85, rs: 739, ra: 797, wrcPlus: 101.7, era: 4.56, fip: 4.23 }, p2027: { w: 81, l: 81 } },
  { short: 'NYM', name: 'New York Mets', nick: 'Mets', league: 'NL', division: 'East', color: '#002D72', color2: '#FF5910', espn: 21, mlb: 121, off: 5, def: 6, ovr: 5,
    y2026: { w: 74, l: 88, rs: 699, ra: 731, wrcPlus: 96.7, era: 4.15, fip: 4.06 }, p2027: { w: 87, l: 75 } },
  { short: 'NYY', name: 'New York Yankees', nick: 'Yankees', league: 'AL', division: 'East', color: '#0C2340', color2: '#C4CED3', espn: 10, mlb: 147, off: 7, def: 8, ovr: 8,
    y2026: { w: 93, l: 68, rs: 739, ra: 601, wrcPlus: 101.2, era: 3.23, fip: 3.71 }, p2027: { w: 88, l: 74 } },
  { short: 'PHI', name: 'Philadelphia Phillies', nick: 'Phillies', league: 'NL', division: 'East', color: '#E81828', color2: '#002D72', espn: 22, mlb: 143, off: 3, def: 7, ovr: 6,
    y2026: { w: 88, l: 74, rs: 713, ra: 698, wrcPlus: 91.7, era: 4.04, fip: 3.79 }, p2027: { w: 85, l: 77 } },
  { short: 'PIT', name: 'Pittsburgh Pirates', nick: 'Pirates', league: 'NL', division: 'Central', color: '#27251F', color2: '#FDB827', espn: 23, mlb: 134, off: 6, def: 6, ovr: 6,
    y2026: { w: 82, l: 80, rs: 767, ra: 739, wrcPlus: 101.1, era: 4.14, fip: 3.82 }, p2027: { w: 85, l: 77 } },
  { short: 'SD', name: 'San Diego Padres', nick: 'Padres', league: 'NL', division: 'West', color: '#2F241D', color2: '#FFC425', espn: 25, mlb: 135, off: 5, def: 6, ovr: 6,
    y2026: { w: 91, l: 71, rs: 722, ra: 681, wrcPlus: 102.3, era: 3.99, fip: 4.20 }, p2027: { w: 75, l: 87 } },
  { short: 'SEA', name: 'Seattle Mariners', nick: 'Mariners', league: 'AL', division: 'West', color: '#0C2C56', color2: '#005C5C', espn: 12, mlb: 136, off: 5, def: 6, ovr: 5,
    y2026: { w: 76, l: 86, rs: 664, ra: 722, wrcPlus: 102.1, era: 4.20, fip: 3.99 }, p2027: { w: 88, l: 74 } },
  { short: 'SF', name: 'San Francisco Giants', nick: 'Giants', league: 'NL', division: 'West', color: '#FD5A1E', color2: '#27251F', espn: 26, mlb: 137, off: 4, def: 5, ovr: 4,
    y2026: { w: 65, l: 97, rs: 669, ra: 760, wrcPlus: 96.5, era: 4.33, fip: 4.26 }, p2027: { w: 79, l: 83 } },
  { short: 'STL', name: 'St. Louis Cardinals', nick: 'Cardinals', league: 'NL', division: 'Central', color: '#C41E3A', color2: '#0C2340', espn: 24, mlb: 138, off: 4, def: 5, ovr: 5,
    y2026: { w: 77, l: 85, rs: 720, ra: 749, wrcPlus: 93.3, era: 4.26, fip: 4.08 }, p2027: { w: 79, l: 83 } },
  { short: 'TB', name: 'Tampa Bay Rays', nick: 'Rays', league: 'AL', division: 'East', color: '#092C5C', color2: '#8FBCE6', espn: 30, mlb: 139, off: 6, def: 7, ovr: 8,
    y2026: { w: 98, l: 64, rs: 736, ra: 650, wrcPlus: 103.6, era: 3.70, fip: 4.04 }, p2027: { w: 84, l: 78 } },
  { short: 'TEX', name: 'Texas Rangers', nick: 'Rangers', league: 'AL', division: 'West', color: '#003278', color2: '#C0111F', espn: 13, mlb: 140, off: 5, def: 5, ovr: 5,
    y2026: { w: 80, l: 82, rs: 673, ra: 719, wrcPlus: 102.3, era: 4.32, fip: 4.15 }, p2027: { w: 80, l: 82 } },
  { short: 'TOR', name: 'Toronto Blue Jays', nick: 'Blue Jays', league: 'AL', division: 'East', color: '#134A8E', color2: '#E8291C', espn: 14, mlb: 141, off: 3, def: 7, ovr: 5,
    y2026: { w: 79, l: 83, rs: 648, ra: 694, wrcPlus: 94.2, era: 3.90, fip: 3.98 }, p2027: { w: 81, l: 81 } },
  { short: 'WSH', name: 'Washington Nationals', nick: 'Nationals', league: 'NL', division: 'East', color: '#AB0003', color2: '#14225A', espn: 20, mlb: 120, off: 7, def: 4, ovr: 5,
    y2026: { w: 77, l: 85, rs: 821, ra: 815, wrcPlus: 102.6, era: 4.67, fip: 4.72 }, p2027: { w: 80, l: 82 } },
]
