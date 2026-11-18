// FRANCHISE: each team's real history before the franchise starts (the History tab's FRANCHISE HISTORY).
//   SUPER_BOWLS             every Super Bowl, I (the 1966 season) to LX (2025): [season, winner, loser, score]
//   OLD_TITLES              league titles before the Super Bowl era: NFL champions 1920-65, AFL champions 1960-65
//   realSeasons(short)      the team's last ten real seasons, newest first: { y, w, l, t, fin, div } (fin as the
//                           franchise's own seasons: champ | sb | conf | div | wc | out)
//   realTitles(short)       { sb: [years won], lost: [years it lost the Super Bowl], old: [older league titles] }
// A franchise keeps its history when it moves (the Colts' Baltimore years are Indianapolis's, the Oilers' are
// Tennessee's, the Raiders', Rams' and Chargers' theirs). Records and playoff results: the NFL's final standings and
// playoff brackets, 2016-2025 (pro-football-reference.com season pages; 2025 as lastSeason.js has it).
export const REAL_FROM = 2016, REAL_TO = 2025

export const SUPER_BOWLS = [
  [1966, 'GB', 'KC', '35-10'], [1967, 'GB', 'LV', '33-14'], [1968, 'NYJ', 'IND', '16-7'], [1969, 'KC', 'MIN', '23-7'],
  [1970, 'IND', 'DAL', '16-13'], [1971, 'DAL', 'MIA', '24-3'], [1972, 'MIA', 'WAS', '14-7'], [1973, 'MIA', 'MIN', '24-7'],
  [1974, 'PIT', 'MIN', '16-6'], [1975, 'PIT', 'DAL', '21-17'], [1976, 'LV', 'MIN', '32-14'], [1977, 'DAL', 'DEN', '27-10'],
  [1978, 'PIT', 'DAL', '35-31'], [1979, 'PIT', 'LAR', '31-19'], [1980, 'LV', 'PHI', '27-10'], [1981, 'SF', 'CIN', '26-21'],
  [1982, 'WAS', 'MIA', '27-17'], [1983, 'LV', 'WAS', '38-9'], [1984, 'SF', 'MIA', '38-16'], [1985, 'CHI', 'NE', '46-10'],
  [1986, 'NYG', 'DEN', '39-20'], [1987, 'WAS', 'DEN', '42-10'], [1988, 'SF', 'CIN', '20-16'], [1989, 'SF', 'DEN', '55-10'],
  [1990, 'NYG', 'BUF', '20-19'], [1991, 'WAS', 'BUF', '37-24'], [1992, 'DAL', 'BUF', '52-17'], [1993, 'DAL', 'BUF', '30-13'],
  [1994, 'SF', 'LAC', '49-26'], [1995, 'DAL', 'PIT', '27-17'], [1996, 'GB', 'NE', '35-21'], [1997, 'DEN', 'GB', '31-24'],
  [1998, 'DEN', 'ATL', '34-19'], [1999, 'LAR', 'TEN', '23-16'], [2000, 'BAL', 'NYG', '34-7'], [2001, 'NE', 'LAR', '20-17'],
  [2002, 'TB', 'LV', '48-21'], [2003, 'NE', 'CAR', '32-29'], [2004, 'NE', 'PHI', '24-21'], [2005, 'PIT', 'SEA', '21-10'],
  [2006, 'IND', 'CHI', '29-17'], [2007, 'NYG', 'NE', '17-14'], [2008, 'PIT', 'ARI', '27-23'], [2009, 'NO', 'IND', '31-17'],
  [2010, 'GB', 'PIT', '31-25'], [2011, 'NYG', 'NE', '21-17'], [2012, 'BAL', 'SF', '34-31'], [2013, 'SEA', 'DEN', '43-8'],
  [2014, 'NE', 'SEA', '28-24'], [2015, 'DEN', 'CAR', '24-10'], [2016, 'NE', 'ATL', '34-28'], [2017, 'PHI', 'NE', '41-33'],
  [2018, 'NE', 'LAR', '13-3'], [2019, 'KC', 'SF', '31-20'], [2020, 'TB', 'KC', '31-9'], [2021, 'LAR', 'CIN', '23-20'],
  [2022, 'KC', 'PHI', '38-35'], [2023, 'KC', 'SF', '25-22'], [2024, 'PHI', 'KC', '40-22'], [2025, 'SEA', 'NE', '29-13'],
]
// (the NFL's champions before the Super Bowl, and the AFL's before the merger game; the AFL champions of 1966-69 and
// the NFL's are the Super Bowl's two teams above)
export const OLD_TITLES = {
  GB: [1929, 1930, 1931, 1936, 1939, 1944, 1961, 1962, 1965], CHI: [1921, 1932, 1933, 1940, 1941, 1943, 1946, 1963],
  NYG: [1927, 1934, 1938, 1956], DET: [1935, 1952, 1953, 1957], CLE: [1950, 1954, 1955, 1964], PHI: [1948, 1949, 1960],
  WAS: [1937, 1942], ARI: [1925, 1947], LAR: [1945, 1951], IND: [1958, 1959],
  TEN: [1960, 1961], KC: [1962], LAC: [1963], BUF: [1964, 1965],
}

// The regular season's final records (W-L or W-L-T), D for a division title, then how it ended (no word: missed the
// playoffs). 12 playoff teams through 2019, 14 from 2020; 16 games through 2020, 17 from 2021.
const SEASONS = {
  2016: `NE 14-2 D champ, MIA 10-6 wc, BUF 7-9, NYJ 5-11, PIT 11-5 D conf, BAL 8-8, CIN 6-9-1, CLE 1-15,
    HOU 9-7 D div, TEN 9-7, IND 8-8, JAX 3-13, KC 12-4 D div, LV 12-4 wc, DEN 9-7, LAC 5-11,
    DAL 13-3 D div, NYG 11-5 wc, WAS 8-7-1, PHI 7-9, GB 10-6 D conf, DET 9-7 wc, MIN 8-8, CHI 3-13,
    ATL 11-5 D sb, TB 9-7, NO 7-9, CAR 6-10, SEA 10-5-1 D div, ARI 7-8-1, LAR 4-12, SF 2-14`,
  2017: `NE 13-3 D sb, BUF 9-7 wc, MIA 6-10, NYJ 5-11, PIT 13-3 D div, BAL 9-7, CIN 7-9, CLE 0-16,
    JAX 10-6 D conf, TEN 9-7 div, HOU 4-12, IND 4-12, KC 10-6 D wc, LAC 9-7, LV 6-10, DEN 5-11,
    PHI 13-3 D champ, DAL 9-7, WAS 7-9, NYG 3-13, MIN 13-3 D conf, DET 9-7, GB 7-9, CHI 5-11,
    NO 11-5 D div, CAR 11-5 wc, ATL 10-6 div, TB 5-11, LAR 11-5 D wc, SEA 9-7, ARI 8-8, SF 6-10`,
  2018: `NE 11-5 D champ, MIA 7-9, BUF 6-10, NYJ 4-12, BAL 10-6 D wc, PIT 9-6-1, CLE 7-8-1, CIN 6-10,
    HOU 11-5 D wc, IND 10-6 div, TEN 9-7, JAX 5-11, KC 12-4 D conf, LAC 12-4 div, DEN 6-10, LV 4-12,
    DAL 10-6 D div, PHI 9-7 div, WAS 7-9, NYG 5-11, CHI 12-4 D wc, MIN 8-7-1, GB 6-9-1, DET 6-10,
    NO 13-3 D conf, ATL 7-9, CAR 7-9, TB 5-11, LAR 13-3 D sb, SEA 10-6 wc, SF 4-12, ARI 3-13`,
  2019: `NE 12-4 D wc, BUF 10-6 wc, NYJ 7-9, MIA 5-11, BAL 14-2 D div, PIT 8-8, CLE 6-10, CIN 2-14,
    HOU 10-6 D div, TEN 9-7 conf, IND 7-9, JAX 6-10, KC 12-4 D champ, DEN 7-9, LV 7-9, LAC 5-11,
    PHI 9-7 D wc, DAL 8-8, NYG 4-12, WAS 3-13, GB 13-3 D conf, MIN 10-6 div, CHI 8-8, DET 3-12-1,
    NO 13-3 D wc, ATL 7-9, TB 7-9, CAR 5-11, SF 13-3 D sb, SEA 11-5 div, LAR 9-7, ARI 5-10-1`,
  2020: `BUF 13-3 D conf, MIA 10-6, NE 7-9, NYJ 2-14, PIT 12-4 D wc, BAL 11-5 div, CLE 11-5 div, CIN 4-11-1,
    TEN 11-5 D wc, IND 11-5 wc, HOU 4-12, JAX 1-15, KC 14-2 D sb, LV 8-8, LAC 7-9, DEN 5-11,
    WAS 7-9 D wc, NYG 6-10, DAL 6-10, PHI 4-11-1, GB 13-3 D conf, CHI 8-8 wc, MIN 7-9, DET 5-11,
    NO 12-4 D div, TB 11-5 champ, CAR 5-11, ATL 4-12, SEA 12-4 D wc, LAR 10-6 div, ARI 8-8, SF 6-10`,
  2021: `BUF 11-6 D div, NE 10-7 wc, MIA 9-8, NYJ 4-13, CIN 10-7 D sb, PIT 9-7-1 wc, CLE 8-9, BAL 8-9,
    TEN 12-5 D div, IND 9-8, HOU 4-13, JAX 3-14, KC 12-5 D conf, LV 10-7 wc, LAC 9-8, DEN 7-10,
    DAL 12-5 D wc, PHI 9-8 wc, WAS 7-10, NYG 4-13, GB 13-4 D div, MIN 8-9, CHI 6-11, DET 3-13-1,
    TB 13-4 D div, NO 9-8, ATL 7-10, CAR 5-12, LAR 12-5 D champ, ARI 11-6 wc, SF 10-7 conf, SEA 7-10`,
  2022: `BUF 13-3 D div, MIA 9-8 wc, NE 8-9, NYJ 7-10, CIN 12-4 D conf, BAL 10-7 wc, PIT 9-8, CLE 7-10,
    JAX 9-8 D div, TEN 7-10, IND 4-12-1, HOU 3-13-1, KC 14-3 D champ, LAC 10-7 wc, LV 6-11, DEN 5-12,
    PHI 14-3 D sb, DAL 12-5 div, NYG 9-7-1 div, WAS 8-8-1, MIN 13-4 D wc, DET 9-8, GB 8-9, CHI 3-14,
    TB 8-9 D wc, CAR 7-10, NO 7-10, ATL 7-10, SF 13-4 D conf, SEA 9-8 wc, LAR 5-12, ARI 4-13`,
  2023: `BUF 11-6 D div, MIA 11-6 wc, NYJ 7-10, NE 4-13, BAL 13-4 D conf, CLE 11-6 wc, PIT 10-7 wc, CIN 9-8,
    HOU 10-7 D div, JAX 9-8, IND 9-8, TEN 6-11, KC 11-6 D champ, LV 8-9, DEN 8-9, LAC 5-12,
    DAL 12-5 D wc, PHI 11-6 wc, NYG 6-11, WAS 4-13, DET 12-5 D conf, GB 9-8 div, MIN 7-10, CHI 7-10,
    TB 9-8 D div, NO 9-8, ATL 7-10, CAR 2-15, SF 12-5 D sb, LAR 10-7 wc, SEA 9-8, ARI 4-13`,
  2024: `BUF 13-4 D conf, MIA 8-9, NYJ 5-12, NE 4-13, BAL 12-5 D div, PIT 10-7 wc, CIN 9-8, CLE 3-14,
    HOU 10-7 D div, IND 8-9, JAX 4-13, TEN 3-14, KC 15-2 D sb, LAC 11-6 wc, DEN 10-7 wc, LV 4-13,
    PHI 14-3 D champ, WAS 12-5 conf, DAL 7-10, NYG 3-14, DET 15-2 D div, MIN 14-3 wc, GB 11-6 wc, CHI 5-12,
    TB 10-7 D wc, ATL 8-9, CAR 5-12, NO 5-12, LAR 10-7 D div, SEA 10-7, ARI 8-9, SF 6-11`,
  2025: `NE 14-3 D sb, BUF 12-5 div, MIA 7-10, NYJ 3-14, PIT 10-7 D wc, BAL 8-9, CIN 6-11, CLE 5-12,
    JAX 13-4 D wc, HOU 12-5 div, IND 8-9, TEN 3-14, DEN 14-3 D conf, LAC 11-6 wc, KC 6-11, LV 3-14,
    PHI 11-6 D wc, DAL 7-9-1, WAS 5-12, NYG 4-13, CHI 11-6 D div, GB 9-7-1 wc, MIN 9-8, DET 9-8,
    CAR 8-9 D wc, TB 8-9, ATL 8-9, NO 6-11, SEA 14-3 D champ, LAR 12-5 conf, SF 12-5 div, ARI 3-14`,
}
const parse = txt => Object.fromEntries(txt.split(',').map(e => e.trim().split(/\s+/)).map(([s, rec, ...f]) => {
  const [w, l, t = 0] = rec.split('-').map(Number)
  return [s, { w, l, t, div: f.includes('D'), fin: f.find(x => x !== 'D') ?? 'out' }]
}))
export const REAL = Object.fromEntries(Object.entries(SEASONS).map(([y, txt]) => [+y, parse(txt)]))

export const realSeasons = short => Object.keys(REAL).map(Number).sort((a, b) => b - a).map(y => REAL[y][short] && { y, ...REAL[y][short] }).filter(Boolean)
export function realTitles(short) {
  return {
    sb: SUPER_BOWLS.filter(x => x[1] === short).map(x => x[0]),
    lost: SUPER_BOWLS.filter(x => x[2] === short).map(x => x[0]),
    old: OLD_TITLES[short] ?? [],
  }
}
