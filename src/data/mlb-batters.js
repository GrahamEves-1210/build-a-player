// CURRENT batters for baseball, Build-A-Player's fourth sport (pool key 'current', label CURRENT = 2026 MLB rosters).
// Same row shape as data/nba-guards.js / soccer-strikers.js, attrs on the 0-11 grade scale (F=0, D=1, C-=2, C=3, C+=4,
// B-=5, B=6, B+=7, A-=8, A=9, A+=10, S=11), integer attrs with exactly BAT_TYPES from data/mlb-attrs.js.
//
// WHO IS IN   About six per club, the lineup core: the club's six most valuable 2026 hitters (2026 WAR + 0.35 x 2025
//   WAR + playing time, MLB Stats API sabermetrics), 90+ plate appearances. A star who lost most of 2026 to injury and
//   is still the club's rides along as a seventh (2025 WAR 4+: Will Smith). team = the club he finished the 2026 season
//   with (free agents included at their 2026 club; a mid-season trade counts for his last club, from his game log).
//   position 'bat' (the build position); role = his real 2026 position: the spot where he played the most innings,
//   DH when he fielded in under 40% of his games. starter: true = the club's best hitter, one per club, the player a
//   build replaces: the highest wRC+ (2026 + half-weight 2025, regressed on playing time).
// BIO   name, height (in), weight (lb), birth date (age as of 2026-11-07), bats ('R'|'L'|'S' switch) / throws: MLB Stats
//   API people. number: the ESPN roster (else MLB). espn = ESPN athlete id (ESPN rosters, matched on name and birth
//   date; free agents through ESPN's search, checked against ESPN's athlete record). mlb = MLBAM id (Statcast).
//   skin: the face sampler of scripts/extract-nba-skin-colors.mjs run on the ESPN headshot, snapped to the nearest
//   swatch used in data/nba-*.js (null with no ESPN photo).
//
// SOURCES (2025 and 2026 regular seasons and postseasons, pulled 2026-11-07)
//   Baseball Savant / Statcast: custom batter leaderboard (AVG, xBA, ISO, barrel rate, K%, BB%, whiff rate, chase rate,
//     zone contact, 2B/3B/HR), sprint speed, arm strength, Outs Above Average / Fielding Run Value (catchers: framing,
//     blocking, throwing), catcher pop time, baserunning run value.
//   MLB Stats API: season lines, sabermetrics (wRC+, WAR, BsR baserunning runs, Spd), RISP and late-and-close splits,
//     postseason lines, fielding innings by position, rosters and bios.
//   Baseball-Reference team pages: Win Probability Added (WPA, WPA/LI, Clutch) for the regular season and postseason.
//   FanGraphs (team wRC+, used for the clubs). ESPN MLB rosters and athlete records for ids and numbers.
//
// RUBRIC  2026 counts double 2025; every rate is a z-score over the pool (370 hitters with 150+ PA in 2026 and 250+
//   weighted PA), blended per trait, pulled toward the pool by sample (PA / (PA + 150)), then cut on percentiles.
//   contact     35% AVG, 20% xBA, 30% whiff rate (lower is better), 15% zone contact rate
//   power       35% ISO, 35% barrel rate, 30% HR per PA
//   eye         55% walk rate, 45% chase rate (lower is better)
//   avoidK      strikeout rate (lower is better)
//   gap         60% doubles + triples per PA, 40% extra-base hits per PA
//   speed       Statcast sprint speed (ft/s; Spd score when he has too few competitive runs)
//   baserunning 30% BsR per 650 PA, 30% Statcast baserunning run value, 25% net steals (SB - 1.5 CS), 15% SB%
//               (regressed), plus 15% of his speed
//   fielding    Fielding Run Value per 3,600 outs on the field (65%) and in total (35%), regressed on outs played, plus
//               the spot's difficulty (SS +0.45, CF +0.4, C +0.35, 2B/3B +0.2, RF +0.05, LF -0.15, 1B -0.45 z); a DH
//               keeps half his fielding and sits at the bottom (-1.9 z)
//   arm         Statcast arm strength (70% his average, 30% max), as a z-score inside the infield or outfield, plus arm
//               runs; catchers: pop time to second and arm strength on steal attempts, plus throwing runs; plus the
//               spot (SS/RF +0.25, 3B +0.2, CF +0.1, LF -0.2, 2B -0.35, 1B -1.0, DH -1.2 z)
//   clutch      40% WPA per 650 PA, 15% Baseball-Reference Clutch, 20% OPS with runners in scoring position, 10% OPS
//               late and close (both regressed to his own OPS), 15% postseason WPA, small credit for postseason PA
//   Grade cut (percentile of the pool): S top 1.5%, A+ next 3%, A next 5%, A- next 8%, B+ 11%, B 14%, B- 15%,
//   C+ 14%, C 12%, C- 9%, D 5%, F the rest. A regular sits around C+ to B; the lineup cores here sit a little above.
//   S is a handful per trait: power Judge, Ohtani, Schwarber, Murakami, Kurtz, Buxton; speed Witt, Turner, McCarthy,
//   Bolte; fielding Witt, Crow-Armstrong, Rafaela, Winn, Bailey and Kirk (framing).
// HAND CORRECTIONS (the only grades not straight from the data)
//   Ohtani arm A: a DH with no throws on the arm board, graded from his arm as a pitcher (100+ mph fastball).

export const MLB_BATTERS = [
  // ─── ARI ────────────────────────────────────────────────────────────
  { name: 'Gabriel Moreno', short: 'Moreno', team: 'ARI', number: 14, height: 69, weight: 200, age: 26, bats: 'R', throws: 'R', skin: '#9b6042', espn: 42464, mlb: 672515, starter: true, position: 'bat', role: 'C',
    attrs: { contact: 11, power: 5, eye: 7, avoidK: 8, gap: 8, speed: 3, baserunning: 2, fielding: 9, arm: 7, clutch: 10 } },
  { name: 'Ketel Marte', short: 'Marte', team: 'ARI', number: 4, height: 72, weight: 210, age: 33, bats: 'S', throws: 'R', skin: '#9d6448', espn: 32512, mlb: 606466, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 8, power: 7, eye: 5, avoidK: 9, gap: 8, speed: 4, baserunning: 5, fielding: 7, arm: 6, clutch: 7 } },
  { name: 'Nolan Arenado', short: 'Arenado', team: 'ARI', number: 28, height: 74, weight: 215, age: 35, bats: 'R', throws: 'R', skin: '#aa715a', espn: 31261, mlb: 571448, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 5, power: 6, eye: 4, avoidK: 7, gap: 6, speed: 1, baserunning: 2, fielding: 6, arm: 6, clutch: 3 } },
  { name: 'Geraldo Perdomo', short: 'Perdomo', team: 'ARI', number: 2, height: 74, weight: 210, age: 27, bats: 'S', throws: 'R', skin: '#724635', espn: 41355, mlb: 672695, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 10, power: 3, eye: 10, avoidK: 10, gap: 4, speed: 4, baserunning: 6, fielding: 9, arm: 8, clutch: 7 } },
  { name: 'Lars Nootbaar', short: 'Nootbaar', team: 'ARI', number: 21, height: 73, weight: 205, age: 29, bats: 'L', throws: 'R', skin: '#c28871', espn: 4448736, mlb: 663457, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 6, power: 5, eye: 9, avoidK: 5, gap: 4, speed: 5, baserunning: 3, fielding: 4, arm: 5, clutch: 5 } },
  { name: 'Corbin Carroll', short: 'Carroll', team: 'ARI', number: 7, height: 70, weight: 180, age: 26, bats: 'L', throws: 'L', skin: '#bd7e71', espn: 42404, mlb: 682998, starter: false, position: 'bat', role: 'RF',
    attrs: { contact: 4, power: 9, eye: 6, avoidK: 5, gap: 11, speed: 10, baserunning: 11, fielding: 6, arm: 2, clutch: 9 } },

  // ─── ATH ────────────────────────────────────────────────────────────
  { name: 'Nick Kurtz', short: 'Kurtz', team: 'ATH', number: 16, height: 77, weight: 240, age: 23, bats: 'L', throws: 'L', skin: '#ce987c', espn: 4966637, mlb: 701762, starter: true, position: 'bat', role: '1B',
    attrs: { contact: 3, power: 11, eye: 11, avoidK: 1, gap: 7, speed: 4, baserunning: 5, fielding: 3, arm: 1, clutch: 11 } },
  { name: 'Shea Langeliers', short: 'Langeliers', team: 'ATH', number: 23, height: 71, weight: 205, age: 28, bats: 'R', throws: 'R', skin: '#bb8a6c', espn: 42598, mlb: 669127, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 6, power: 9, eye: 4, avoidK: 5, gap: 8, speed: 7, baserunning: 5, fielding: 4, arm: 9, clutch: 8 } },
  { name: 'Zack Gelof', short: 'Gelof', team: 'ATH', number: 20, height: 74, weight: 205, age: 27, bats: 'R', throws: 'R', skin: '#d19b7a', espn: 4414531, mlb: 680869, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 3, power: 8, eye: 5, avoidK: 3, gap: 5, speed: 8, baserunning: 9, fielding: 6, arm: 6, clutch: 5 } },
  { name: 'Jacob Wilson', short: 'Wilson', team: 'ATH', number: 5, height: 74, weight: 190, age: 24, bats: 'R', throws: 'R', skin: '#cd987c', espn: 4719300, mlb: 805779, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 10, power: 2, eye: 1, avoidK: 10, gap: 6, speed: 4, baserunning: 5, fielding: 8, arm: 9, clutch: 6 } },
  { name: 'Tyler Soderstrom', short: 'Soderstrom', team: 'ATH', number: 21, height: 74, weight: 200, age: 24, bats: 'L', throws: 'R', skin: '#cc9472', espn: 4686066, mlb: 691016, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 6, power: 7, eye: 7, avoidK: 5, gap: 10, speed: 4, baserunning: 4, fielding: 3, arm: 6, clutch: 6 } },
  { name: 'Henry Bolte', short: 'Bolte', team: 'ATH', number: 33, height: 75, weight: 195, age: 23, bats: 'R', throws: 'R', skin: '#cc907a', espn: 5080756, mlb: 703607, starter: false, position: 'bat', role: 'CF',
    attrs: { contact: 5, power: 4, eye: 5, avoidK: 2, gap: 3, speed: 11, baserunning: 8, fielding: 7, arm: 8, clutch: 4 } },

  // ─── ATL ────────────────────────────────────────────────────────────
  { name: 'Ronald Acuña Jr.', short: 'Acuña Jr.', team: 'ATL', number: 13, height: 72, weight: 205, age: 28, bats: 'R', throws: 'R', skin: '#9b5f39', espn: 36185, mlb: 660670, starter: true, position: 'bat', role: 'RF',
    attrs: { contact: 5, power: 8, eye: 8, avoidK: 5, gap: 4, speed: 5, baserunning: 6, fielding: 3, arm: 10, clutch: 5 } },
  { name: 'Drake Baldwin', short: 'Baldwin', team: 'ATL', number: 30, height: 72, weight: 225, age: 25, bats: 'L', throws: 'R', skin: '#bf7850', espn: 4810190, mlb: 686948, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 8, power: 7, eye: 4, avoidK: 6, gap: 3, speed: 3, baserunning: 3, fielding: 5, arm: 4, clutch: 6 } },
  { name: 'Matt Olson', short: 'Olson', team: 'ATL', number: 28, height: 76, weight: 225, age: 32, bats: 'L', throws: 'R', skin: '#c1835f', espn: 32767, mlb: 621566, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 5, power: 9, eye: 7, avoidK: 4, gap: 9, speed: 1, baserunning: 4, fielding: 8, arm: 3, clutch: 7 } },
  { name: 'Ozzie Albies', short: 'Albies', team: 'ATL', number: 1, height: 67, weight: 165, age: 29, bats: 'S', throws: 'R', skin: '#9b5f39', espn: 33783, mlb: 645277, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 5, power: 4, eye: 2, avoidK: 8, gap: 3, speed: 4, baserunning: 4, fielding: 4, arm: 2, clutch: 6 } },
  { name: 'Mauricio Dubón', short: 'Dubón', team: 'ATL', number: 14, height: 71, weight: 173, age: 32, bats: 'R', throws: 'R', skin: '#c37f56', espn: 35304, mlb: 643289, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 9, power: 2, eye: 2, avoidK: 10, gap: 6, speed: 4, baserunning: 5, fielding: 8, arm: 6, clutch: 5 } },
  { name: 'Michael Harris II', short: 'Harris II', team: 'ATL', number: 23, height: 71, weight: 195, age: 25, bats: 'L', throws: 'L', skin: '#814f30', espn: 42470, mlb: 671739, starter: false, position: 'bat', role: 'CF',
    attrs: { contact: 8, power: 7, eye: 0, avoidK: 6, gap: 9, speed: 6, baserunning: 6, fielding: 9, arm: 6, clutch: 8 } },

  // ─── BAL ────────────────────────────────────────────────────────────
  { name: 'Pete Alonso', short: 'Alonso', team: 'BAL', number: 25, height: 75, weight: 245, age: 31, bats: 'R', throws: 'R', skin: '#cc907a', espn: 37498, mlb: 624413, starter: true, position: 'bat', role: '1B',
    attrs: { contact: 7, power: 10, eye: 7, avoidK: 4, gap: 7, speed: 1, baserunning: 1, fielding: 2, arm: 1, clutch: 11 } },
  { name: 'Jackson Holliday', short: 'Holliday', team: 'BAL', number: 7, height: 71, weight: 200, age: 22, bats: 'L', throws: 'R', skin: '#d19781', espn: 5080633, mlb: 702616, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 4, power: 3, eye: 6, avoidK: 5, gap: 2, speed: 8, baserunning: 4, fielding: 4, arm: 4, clutch: 4 } },
  { name: 'Blaze Alexander', short: 'Alexander', team: 'BAL', number: 23, height: 71, weight: 200, age: 27, bats: 'R', throws: 'R', skin: '#bb856a', espn: 41345, mlb: 677942, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 6, power: 4, eye: 4, avoidK: 4, gap: 5, speed: 7, baserunning: 6, fielding: 4, arm: 10, clutch: 5 } },
  { name: 'Coby Mayo', short: 'Mayo', team: 'BAL', number: 16, height: 77, weight: 225, age: 24, bats: 'R', throws: 'R', skin: '#c18c71', espn: 4683371, mlb: 691723, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 3, power: 9, eye: 5, avoidK: 1, gap: 6, speed: 6, baserunning: 7, fielding: 5, arm: 7, clutch: 5 } },
  { name: 'Gunnar Henderson', short: 'Henderson', team: 'BAL', number: 2, height: 75, weight: 230, age: 25, bats: 'L', throws: 'R', skin: '#ce9881', espn: 42507, mlb: 683002, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 5, power: 6, eye: 5, avoidK: 5, gap: 7, speed: 7, baserunning: 8, fielding: 6, arm: 9, clutch: 5 } },
  { name: 'Colton Cowser', short: 'Cowser', team: 'BAL', number: 17, height: 75, weight: 220, age: 26, bats: 'L', throws: 'R', skin: '#bd836d', espn: 4416990, mlb: 681297, starter: false, position: 'bat', role: 'CF',
    attrs: { contact: 1, power: 6, eye: 6, avoidK: 0, gap: 2, speed: 6, baserunning: 7, fielding: 9, arm: 8, clutch: 5 } },

  // ─── BOS ────────────────────────────────────────────────────────────
  { name: 'Willson Contreras', short: 'Contreras', team: 'BOS', number: 40, height: 72, weight: 240, age: 34, bats: 'R', throws: 'R', skin: '#c17857', espn: 32532, mlb: 575929, starter: true, position: 'bat', role: '1B',
    attrs: { contact: 5, power: 9, eye: 5, avoidK: 3, gap: 7, speed: 5, baserunning: 1, fielding: 4, arm: 4, clutch: 9 } },
  { name: 'Adley Rutschman', short: 'Rutschman', team: 'BOS', number: 31, height: 73, weight: 230, age: 28, bats: 'S', throws: 'R', skin: '#ce9b86', espn: 42178, mlb: 668939, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 7, power: 5, eye: 7, avoidK: 8, gap: 9, speed: 3, baserunning: 2, fielding: 9, arm: 7, clutch: 3 } },
  { name: 'Caleb Durbin', short: 'Durbin', team: 'BOS', number: 5, height: 66, weight: 183, age: 26, bats: 'R', throws: 'R', skin: '#d6957b', espn: 5007615, mlb: 702332, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 7, power: 2, eye: 5, avoidK: 9, gap: 5, speed: 6, baserunning: 7, fielding: 7, arm: 6, clutch: 5 } },
  { name: 'Jarren Duran', short: 'Duran', team: 'BOS', number: 16, height: 72, weight: 205, age: 30, bats: 'L', throws: 'R', skin: '#d18f6d', espn: 41610, mlb: 680776, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 2, power: 6, eye: 3, avoidK: 3, gap: 6, speed: 8, baserunning: 9, fielding: 6, arm: 5, clutch: 4 } },
  { name: 'Ceddanne Rafaela', short: 'Rafaela', team: 'BOS', number: 3, height: 70, weight: 165, age: 26, bats: 'R', throws: 'R', skin: '#9e5b3e', espn: 4987382, mlb: 678882, starter: false, position: 'bat', role: 'CF',
    attrs: { contact: 6, power: 5, eye: 0, avoidK: 6, gap: 9, speed: 8, baserunning: 6, fielding: 11, arm: 9, clutch: 5 } },
  { name: 'Wilyer Abreu', short: 'Abreu', team: 'BOS', number: 52, height: 70, weight: 215, age: 27, bats: 'L', throws: 'L', skin: '#c78a68', espn: 4990055, mlb: 677800, starter: false, position: 'bat', role: 'RF',
    attrs: { contact: 5, power: 8, eye: 6, avoidK: 5, gap: 9, speed: 6, baserunning: 4, fielding: 7, arm: 11, clutch: 5 } },

  // ─── CHC ────────────────────────────────────────────────────────────
  { name: 'Pete Crow-Armstrong', short: 'Crow-Armstrong', team: 'CHC', number: 4, height: 72, weight: 184, age: 24, bats: 'L', throws: 'L', skin: '#ce9c87', espn: 4717833, mlb: 691718, starter: true, position: 'bat', role: 'CF',
    attrs: { contact: 6, power: 10, eye: 4, avoidK: 3, gap: 10, speed: 9, baserunning: 10, fielding: 11, arm: 9, clutch: 11 } },
  { name: 'Michael Busch', short: 'Busch', team: 'CHC', number: 29, height: 71, weight: 210, age: 28, bats: 'L', throws: 'R', skin: '#bd8a78', espn: 42415, mlb: 683737, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 5, power: 7, eye: 8, avoidK: 4, gap: 5, speed: 3, baserunning: 1, fielding: 4, arm: 1, clutch: 7 } },
  { name: 'Nico Hoerner', short: 'Hoerner', team: 'CHC', number: 2, height: 71, weight: 200, age: 29, bats: 'R', throws: 'R', skin: '#c38f80', espn: 41219, mlb: 663538, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 11, power: 0, eye: 3, avoidK: 11, gap: 4, speed: 7, baserunning: 9, fielding: 9, arm: 4, clutch: 5 } },
  { name: 'Alex Bregman', short: 'Bregman', team: 'CHC', number: 3, height: 70, weight: 190, age: 32, bats: 'R', throws: 'R', skin: '#c38f80', espn: 34886, mlb: 608324, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 9, power: 6, eye: 8, avoidK: 9, gap: 7, speed: 3, baserunning: 3, fielding: 7, arm: 5, clutch: 7 } },
  { name: 'Dansby Swanson', short: 'Swanson', team: 'CHC', number: 7, height: 72, weight: 190, age: 32, bats: 'R', throws: 'R', skin: '#b08073', espn: 34895, mlb: 621020, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 2, power: 6, eye: 6, avoidK: 4, gap: 4, speed: 7, baserunning: 9, fielding: 9, arm: 6, clutch: 2 } },
  { name: 'Seiya Suzuki', short: 'Suzuki', team: 'CHC', number: 27, height: 71, weight: 182, age: 32, bats: 'R', throws: 'R', skin: '#c49378', espn: 4142424, mlb: 673548, starter: false, position: 'bat', role: 'RF',
    attrs: { contact: 6, power: 8, eye: 9, avoidK: 4, gap: 8, speed: 6, baserunning: 4, fielding: 7, arm: 8, clutch: 6 } },

  // ─── CHW ────────────────────────────────────────────────────────────
  { name: 'Munetaka Murakami', short: 'Murakami', team: 'CHW', number: 5, height: 74, weight: 213, age: 26, bats: 'L', throws: 'R', skin: '#c98f78', espn: 4872595, mlb: 808959, starter: true, position: 'bat', role: '1B',
    attrs: { contact: 0, power: 11, eye: 11, avoidK: 0, gap: 4, speed: 4, baserunning: 1, fielding: 3, arm: 1, clutch: 9 } },
  { name: 'Chase Meidroth', short: 'Meidroth', team: 'CHW', number: 10, height: 69, weight: 190, age: 25, bats: 'R', throws: 'R', skin: '#c7927c', espn: 5136929, mlb: 805367, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 8, power: 2, eye: 6, avoidK: 6, gap: 3, speed: 5, baserunning: 5, fielding: 9, arm: 3, clutch: 4 } },
  { name: 'Miguel Vargas', short: 'Vargas', team: 'CHW', number: 20, height: 74, weight: 225, age: 26, bats: 'R', throws: 'R', skin: '#c18c71', espn: 42453, mlb: 678246, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 6, power: 8, eye: 10, avoidK: 7, gap: 7, speed: 7, baserunning: 8, fielding: 4, arm: 7, clutch: 8 } },
  { name: 'Colson Montgomery', short: 'Montgomery', team: 'CHW', number: 12, height: 75, weight: 230, age: 24, bats: 'L', throws: 'R', skin: '#ce9c87', espn: 4872685, mlb: 695657, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 0, power: 9, eye: 4, avoidK: 0, gap: 5, speed: 4, baserunning: 2, fielding: 10, arm: 6, clutch: 5 } },
  { name: 'Sam Antonacci', short: 'Antonacci', team: 'CHW', number: 17, height: 71, weight: 193, age: 23, bats: 'L', throws: 'R', skin: '#cb9581', espn: 5207167, mlb: 803011, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 10, power: 2, eye: 6, avoidK: 8, gap: 6, speed: 6, baserunning: 7, fielding: 2, arm: 4, clutch: 8 } },
  { name: 'Tristan Peters', short: 'Peters', team: 'CHW', number: 29, height: 72, weight: 180, age: 26, bats: 'L', throws: 'R', skin: '#b87d69', espn: 5085893, mlb: 671976, starter: false, position: 'bat', role: 'CF',
    attrs: { contact: 6, power: 4, eye: 4, avoidK: 6, gap: 10, speed: 8, baserunning: 6, fielding: 8, arm: 4, clutch: 8 } },

  // ─── CIN ────────────────────────────────────────────────────────────
  { name: 'Elly De La Cruz', short: 'De La Cruz', team: 'CIN', number: 44, height: 78, weight: 200, age: 24, bats: 'S', throws: 'R', skin: '#6d4639', espn: 4917694, mlb: 682829, starter: true, position: 'bat', role: 'SS',
    attrs: { contact: 6, power: 9, eye: 7, avoidK: 3, gap: 9, speed: 8, baserunning: 9, fielding: 7, arm: 11, clutch: 8 } },
  { name: 'Tyler Stephenson', short: 'Stephenson', team: 'CIN', number: 37, height: 75, weight: 225, age: 30, bats: 'R', throws: 'R', skin: '#b4856b', espn: 34975, mlb: 663886, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 4, power: 7, eye: 8, avoidK: 2, gap: 6, speed: 4, baserunning: 2, fielding: 3, arm: 3, clutch: 5 } },
  { name: 'Sal Stewart', short: 'Stewart', team: 'CIN', number: 27, height: 73, weight: 224, age: 22, bats: 'R', throws: 'R', skin: '#ac8067', espn: 5080771, mlb: 701398, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 5, power: 8, eye: 5, avoidK: 5, gap: 3, speed: 3, baserunning: 1, fielding: 3, arm: 2, clutch: 9 } },
  { name: 'Spencer Steer', short: 'Steer', team: 'CIN', number: 7, height: 69, weight: 185, age: 28, bats: 'R', throws: 'R', skin: '#c29278', espn: 4722857, mlb: 668715, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 4, power: 7, eye: 6, avoidK: 5, gap: 4, speed: 7, baserunning: 6, fielding: 3, arm: 3, clutch: 6 } },
  { name: 'JJ Bleday', short: 'Bleday', team: 'CIN', number: 22, height: 74, weight: 205, age: 28, bats: 'L', throws: 'L', skin: '#c29278', espn: 42410, mlb: 668709, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 2, power: 7, eye: 9, avoidK: 4, gap: 4, speed: 5, baserunning: 3, fielding: 3, arm: 6, clutch: 1 } },
  { name: 'Eugenio Suárez', short: 'Suárez', team: 'CIN', number: 28, height: 71, weight: 213, age: 35, bats: 'R', throws: 'R', skin: '#ae8362', espn: 32367, mlb: 553993, starter: false, position: 'bat', role: 'DH',
    attrs: { contact: 1, power: 10, eye: 5, avoidK: 0, gap: 6, speed: 3, baserunning: 3, fielding: 0, arm: 3, clutch: 7 } },

  // ─── CLE ────────────────────────────────────────────────────────────
  { name: 'Chase DeLauter', short: 'DeLauter', team: 'CLE', number: 24, height: 75, weight: 235, age: 25, bats: 'L', throws: 'L', skin: '#c29289', espn: 4619649, mlb: 800050, starter: true, position: 'bat', role: 'RF',
    attrs: { contact: 10, power: 5, eye: 8, avoidK: 8, gap: 8, speed: 4, baserunning: 6, fielding: 6, arm: 5, clutch: 8 } },
  { name: 'Patrick Bailey', short: 'Bailey', team: 'CLE', number: 16, height: 72, weight: 223, age: 27, bats: 'S', throws: 'R', skin: '#d0a38d', espn: 4345843, mlb: 672275, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 2, power: 3, eye: 4, avoidK: 2, gap: 2, speed: 2, baserunning: 3, fielding: 11, arm: 10, clutch: 3 } },
  { name: 'Travis Bazzana', short: 'Bazzana', team: 'CLE', number: 37, height: 71, weight: 199, age: 24, bats: 'L', throws: 'R', skin: '#c79287', espn: 5007707, mlb: 683953, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 5, power: 4, eye: 7, avoidK: 5, gap: 6, speed: 7, baserunning: 8, fielding: 5, arm: 4, clutch: 6 } },
  { name: 'José Ramírez', short: 'Ramírez', team: 'CLE', number: 11, height: 68, weight: 190, age: 34, bats: 'S', throws: 'R', skin: '#a2735e', espn: 32801, mlb: 608070, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 9, power: 5, eye: 6, avoidK: 10, gap: 7, speed: 6, baserunning: 11, fielding: 7, arm: 6, clutch: 9 } },
  { name: 'Brayan Rocchio', short: 'Rocchio', team: 'CLE', number: 4, height: 69, weight: 170, age: 25, bats: 'S', throws: 'R', skin: '#b68470', espn: 41217, mlb: 677587, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 6, power: 3, eye: 3, avoidK: 8, gap: 5, speed: 5, baserunning: 4, fielding: 8, arm: 7, clutch: 5 } },
  { name: 'Steven Kwan', short: 'Kwan', team: 'CLE', number: 38, height: 68, weight: 170, age: 29, bats: 'L', throws: 'L', skin: '#bc8f79', espn: 41996, mlb: 680757, starter: false, position: 'bat', role: 'CF',
    attrs: { contact: 11, power: 0, eye: 9, avoidK: 11, gap: 2, speed: 5, baserunning: 6, fielding: 9, arm: 6, clutch: 5 } },

  // ─── COL ────────────────────────────────────────────────────────────
  { name: 'TJ Rumfield', short: 'Rumfield', team: 'COL', number: 7, height: 77, weight: 238, age: 26, bats: 'L', throws: 'R', skin: '#bd8a78', espn: 5014349, mlb: 681198, starter: true, position: 'bat', role: '1B',
    attrs: { contact: 10, power: 4, eye: 6, avoidK: 9, gap: 6, speed: 1, baserunning: 0, fielding: 5, arm: 0, clutch: 8 } },
  { name: 'Hunter Goodman', short: 'Goodman', team: 'COL', number: 15, height: 71, weight: 220, age: 27, bats: 'R', throws: 'R', skin: '#bf8c78', espn: 4416591, mlb: 696100, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 3, power: 10, eye: 2, avoidK: 2, gap: 8, speed: 5, baserunning: 0, fielding: 6, arm: 5, clutch: 6 } },
  { name: 'Willi Castro', short: 'Castro', team: 'COL', number: 3, height: 72, weight: 209, age: 29, bats: 'S', throws: 'R', skin: '#98664b', espn: 34230, mlb: 650489, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 4, power: 5, eye: 4, avoidK: 3, gap: 5, speed: 6, baserunning: 5, fielding: 3, arm: 8, clutch: 3 } },
  { name: 'Kyle Karros', short: 'Karros', team: 'COL', number: 12, height: 77, weight: 225, age: 24, bats: 'R', throws: 'R', skin: '#b98169', espn: 5203102, mlb: 691720, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 5, power: 4, eye: 8, avoidK: 5, gap: 5, speed: 4, baserunning: 6, fielding: 6, arm: 6, clutch: 5 } },
  { name: 'Jake McCarthy', short: 'McCarthy', team: 'COL', number: 31, height: 72, weight: 213, age: 29, bats: 'L', throws: 'L', skin: '#dfac9c', espn: 41197, mlb: 664983, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 8, power: 4, eye: 1, avoidK: 8, gap: 11, speed: 11, baserunning: 10, fielding: 4, arm: 0, clutch: 8 } },
  { name: 'Cole Carrigg', short: 'Carrigg', team: 'COL', number: 16, height: 74, weight: 204, age: 24, bats: 'S', throws: 'R', skin: '#b68470', espn: 5149102, mlb: 694249, starter: false, position: 'bat', role: 'CF',
    attrs: { contact: 7, power: 6, eye: 3, avoidK: 4, gap: 11, speed: 7, baserunning: 7, fielding: 6, arm: 10, clutch: 8 } },

  // ─── DET ────────────────────────────────────────────────────────────
  { name: 'Riley Greene', short: 'Greene', team: 'DET', number: 31, height: 74, weight: 200, age: 26, bats: 'L', throws: 'L', skin: '#b47b5c', espn: 42179, mlb: 682985, starter: true, position: 'bat', role: 'LF',
    attrs: { contact: 5, power: 9, eye: 6, avoidK: 2, gap: 8, speed: 3, baserunning: 3, fielding: 2, arm: 1, clutch: 5 } },
  { name: 'Dillon Dingler', short: 'Dingler', team: 'DET', number: 13, height: 73, weight: 210, age: 28, bats: 'R', throws: 'R', skin: '#d0a38d', espn: 4345620, mlb: 693307, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 7, power: 7, eye: 2, avoidK: 5, gap: 6, speed: 5, baserunning: 5, fielding: 10, arm: 10, clutch: 6 } },
  { name: 'Spencer Torkelson', short: 'Torkelson', team: 'DET', number: 20, height: 73, weight: 220, age: 27, bats: 'R', throws: 'R', skin: '#d59d84', espn: 4424286, mlb: 679529, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 2, power: 8, eye: 9, avoidK: 1, gap: 6, speed: 3, baserunning: 3, fielding: 2, arm: 0, clutch: 8 } },
  { name: 'Colt Keith', short: 'Keith', team: 'DET', number: 33, height: 74, weight: 211, age: 25, bats: 'L', throws: 'R', skin: '#ce9c87', espn: 4683384, mlb: 690993, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 7, power: 5, eye: 6, avoidK: 6, gap: 7, speed: 6, baserunning: 8, fielding: 4, arm: 6, clutch: 3 } },
  { name: 'Kevin McGonigle', short: 'McGonigle', team: 'DET', number: 7, height: 69, weight: 187, age: 22, bats: 'L', throws: 'R', skin: '#d3a58f', espn: 5149072, mlb: 805808, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 9, power: 4, eye: 10, avoidK: 9, gap: 5, speed: 6, baserunning: 7, fielding: 6, arm: 6, clutch: 8 } },
  { name: 'Zach McKinstry', short: 'McKinstry', team: 'DET', number: 39, height: 71, weight: 180, age: 31, bats: 'L', throws: 'R', skin: '#ce9c87', espn: 38420, mlb: 656716, starter: false, position: 'bat', role: 'RF',
    attrs: { contact: 5, power: 2, eye: 6, avoidK: 7, gap: 6, speed: 6, baserunning: 5, fielding: 8, arm: 9, clutch: 5 } },

  // ─── HOU ────────────────────────────────────────────────────────────
  { name: 'Yordan Alvarez', short: 'Alvarez', team: 'HOU', number: 44, height: 76, weight: 237, age: 29, bats: 'L', throws: 'R', skin: '#724635', espn: 36018, mlb: 670541, starter: true, position: 'bat', role: 'DH',
    attrs: { contact: 11, power: 10, eye: 9, avoidK: 7, gap: 8, speed: 2, baserunning: 1, fielding: 1, arm: 3, clutch: 11 } },
  { name: 'Christian Walker', short: 'Walker', team: 'HOU', number: 8, height: 71, weight: 208, age: 35, bats: 'R', throws: 'R', skin: '#b97f61', espn: 32758, mlb: 572233, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 3, power: 7, eye: 4, avoidK: 4, gap: 5, speed: 2, baserunning: 3, fielding: 6, arm: 1, clutch: 4 } },
  { name: 'Jose Altuve', short: 'Altuve', team: 'HOU', number: 27, height: 66, weight: 167, age: 36, bats: 'R', throws: 'R', skin: '#b5765c', espn: 31662, mlb: 514888, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 6, power: 4, eye: 2, avoidK: 6, gap: 4, speed: 5, baserunning: 2, fielding: 2, arm: 2, clutch: 3 } },
  { name: 'Isaac Paredes', short: 'Paredes', team: 'HOU', number: 15, height: 71, weight: 213, age: 27, bats: 'R', throws: 'R', skin: '#b67452', espn: 39706, mlb: 670623, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 8, power: 6, eye: 7, avoidK: 8, gap: 5, speed: 1, baserunning: 1, fielding: 5, arm: 5, clutch: 6 } },
  { name: 'Jeremy Peña', short: 'Peña', team: 'HOU', number: 3, height: 72, weight: 202, age: 29, bats: 'R', throws: 'R', skin: '#ab6b47', espn: 41273, mlb: 665161, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 7, power: 6, eye: 1, avoidK: 5, gap: 7, speed: 9, baserunning: 9, fielding: 6, arm: 7, clutch: 7 } },
  { name: 'Cam Smith', short: 'Smith', team: 'HOU', number: 11, height: 75, weight: 224, age: 23, bats: 'R', throws: 'R', skin: '#b07050', espn: 5080766, mlb: 701358, starter: false, position: 'bat', role: 'RF',
    attrs: { contact: 2, power: 6, eye: 5, avoidK: 3, gap: 4, speed: 9, baserunning: 8, fielding: 6, arm: 6, clutch: 5 } },

  // ─── KC ────────────────────────────────────────────────────────────
  { name: 'Bobby Witt Jr.', short: 'Witt Jr.', team: 'KC', number: 7, height: 73, weight: 200, age: 26, bats: 'R', throws: 'R', skin: '#d8a68a', espn: 42403, mlb: 677951, starter: true, position: 'bat', role: 'SS',
    attrs: { contact: 9, power: 6, eye: 5, avoidK: 7, gap: 10, speed: 11, baserunning: 11, fielding: 11, arm: 9, clutch: 10 } },
  { name: 'Carter Jensen', short: 'Jensen', team: 'KC', number: 22, height: 72, weight: 210, age: 23, bats: 'L', throws: 'R', skin: '#b98c7c', espn: 4917812, mlb: 695600, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 3, power: 9, eye: 8, avoidK: 2, gap: 10, speed: 5, baserunning: 4, fielding: 6, arm: 7, clutch: 7 } },
  { name: 'Vinnie Pasquantino', short: 'Pasquantino', team: 'KC', number: 9, height: 75, weight: 245, age: 29, bats: 'L', throws: 'L', skin: '#c29289', espn: 4109109, mlb: 686469, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 8, power: 7, eye: 5, avoidK: 8, gap: 6, speed: 2, baserunning: 2, fielding: 3, arm: 0, clutch: 5 } },
  { name: 'Michael Massey', short: 'Massey', team: 'KC', number: 19, height: 72, weight: 195, age: 28, bats: 'L', throws: 'R', skin: '#c7927c', espn: 4109223, mlb: 686681, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 7, power: 4, eye: 1, avoidK: 8, gap: 6, speed: 3, baserunning: 4, fielding: 8, arm: 4, clutch: 3 } },
  { name: 'Maikel Garcia', short: 'Garcia', team: 'KC', number: 11, height: 73, weight: 180, age: 26, bats: 'R', throws: 'R', skin: '#98664b', espn: 4905884, mlb: 672580, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 10, power: 3, eye: 7, avoidK: 9, gap: 10, speed: 5, baserunning: 5, fielding: 8, arm: 8, clutch: 4 } },
  { name: 'Jac Caglianone', short: 'Caglianone', team: 'KC', number: 14, height: 76, weight: 250, age: 23, bats: 'L', throws: 'L', skin: '#c59681', espn: 4926296, mlb: 695506, starter: false, position: 'bat', role: 'RF',
    attrs: { contact: 6, power: 8, eye: 2, avoidK: 3, gap: 9, speed: 4, baserunning: 6, fielding: 2, arm: 11, clutch: 6 } },

  // ─── LAA ────────────────────────────────────────────────────────────
  { name: 'Mike Trout', short: 'Trout', team: 'LAA', number: 27, height: 73, weight: 235, age: 35, bats: 'R', throws: 'R', skin: '#d59d84', espn: 30836, mlb: 545361, starter: true, position: 'bat', role: 'CF',
    attrs: { contact: 4, power: 8, eye: 11, avoidK: 2, gap: 3, speed: 7, baserunning: 5, fielding: 5, arm: 5, clutch: 6 } },
  { name: 'Nolan Schanuel', short: 'Schanuel', team: 'LAA', number: 18, height: 74, weight: 220, age: 24, bats: 'L', throws: 'R', skin: '#ce987c', espn: 4739755, mlb: 694384, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 9, power: 2, eye: 7, avoidK: 9, gap: 4, speed: 2, baserunning: 3, fielding: 5, arm: 2, clutch: 6 } },
  { name: 'Vaughn Grissom', short: 'Grissom', team: 'LAA', number: 5, height: 74, weight: 210, age: 25, bats: 'R', throws: 'R', skin: '#c78a68', espn: 42503, mlb: 687093, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 6, power: 4, eye: 3, avoidK: 6, gap: 5, speed: 4, baserunning: 5, fielding: 2, arm: 5, clutch: 6 } },
  { name: 'Zach Neto', short: 'Neto', team: 'LAA', number: 9, height: 71, weight: 185, age: 25, bats: 'R', throws: 'R', skin: '#ce987c', espn: 4666100, mlb: 687263, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 3, power: 8, eye: 4, avoidK: 1, gap: 8, speed: 6, baserunning: 6, fielding: 5, arm: 9, clutch: 5 } },
  { name: 'Josh Lowe', short: 'Lowe', team: 'LAA', number: 3, height: 75, weight: 220, age: 28, bats: 'L', throws: 'R', skin: '#d09378', espn: 40557, mlb: 666139, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 1, power: 5, eye: 3, avoidK: 2, gap: 4, speed: 6, baserunning: 7, fielding: 5, arm: 5, clutch: 1 } },
  { name: 'Wade Meckler', short: 'Meckler', team: 'LAA', number: 53, height: 69, weight: 190, age: 26, bats: 'L', throws: 'R', skin: '#d09378', espn: 4424090, mlb: 685133, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 9, power: 1, eye: 7, avoidK: 6, gap: 4, speed: 8, baserunning: 8, fielding: 5, arm: 4, clutch: 4 } },

  // ─── LAD ────────────────────────────────────────────────────────────
  { name: 'Shohei Ohtani', short: 'Ohtani', team: 'LAD', number: 17, height: 76, weight: 210, age: 32, bats: 'L', throws: 'R', skin: '#c58e72', espn: 39832, mlb: 660271, starter: true, position: 'bat', role: 'DH',
    attrs: { contact: 6, power: 11, eye: 8, avoidK: 3, gap: 8, speed: 6, baserunning: 7, fielding: 1, arm: 9, clutch: 11 } },
  { name: 'Will Smith', short: 'Smith', team: 'LAD', number: 16, height: 70, weight: 195, age: 31, bats: 'R', throws: 'R', skin: '#cc9680', espn: 38309, mlb: 669257, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 8, power: 7, eye: 10, avoidK: 7, gap: 4, speed: 5, baserunning: 2, fielding: 4, arm: 5, clutch: 8 } },
  { name: 'Freddie Freeman', short: 'Freeman', team: 'LAD', number: 5, height: 76, weight: 220, age: 37, bats: 'L', throws: 'R', skin: '#bd836d', espn: 30193, mlb: 518692, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 8, power: 5, eye: 6, avoidK: 7, gap: 8, speed: 2, baserunning: 4, fielding: 5, arm: 2, clutch: 6 } },
  { name: 'Max Muncy', short: 'Muncy', team: 'LAD', number: 13, height: 70, weight: 215, age: 36, bats: 'L', throws: 'R', skin: '#bd8a78', espn: 33303, mlb: 571970, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 4, power: 9, eye: 9, avoidK: 4, gap: 7, speed: 4, baserunning: 6, fielding: 5, arm: 6, clutch: 5 } },
  { name: 'Mookie Betts', short: 'Betts', team: 'LAD', number: 50, height: 69, weight: 180, age: 34, bats: 'R', throws: 'R', skin: '#b07050', espn: 33039, mlb: 605141, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 9, power: 6, eye: 7, avoidK: 10, gap: 5, speed: 4, baserunning: 4, fielding: 8, arm: 6, clutch: 3 } },
  { name: 'Andy Pages', short: 'Pages', team: 'LAD', number: 44, height: 73, weight: 212, age: 25, bats: 'R', throws: 'R', skin: '#c48f79', espn: 42468, mlb: 681624, starter: false, position: 'bat', role: 'CF',
    attrs: { contact: 8, power: 6, eye: 3, avoidK: 6, gap: 6, speed: 7, baserunning: 5, fielding: 10, arm: 11, clutch: 6 } },
  { name: 'Kyle Tucker', short: 'Tucker', team: 'LAD', number: 23, height: 75, weight: 212, age: 29, bats: 'L', throws: 'R', skin: '#c38f80', espn: 34967, mlb: 663656, starter: false, position: 'bat', role: 'RF',
    attrs: { contact: 6, power: 5, eye: 10, avoidK: 8, gap: 5, speed: 3, baserunning: 7, fielding: 3, arm: 5, clutch: 7 } },

  // ─── MIA ────────────────────────────────────────────────────────────
  { name: 'Kyle Stowers', short: 'Stowers', team: 'MIA', number: 28, height: 74, weight: 215, age: 28, bats: 'L', throws: 'L', skin: '#c48f79', espn: 42796, mlb: 669065, starter: true, position: 'bat', role: '1B',
    attrs: { contact: 3, power: 9, eye: 5, avoidK: 1, gap: 10, speed: 3, baserunning: 5, fielding: 3, arm: 6, clutch: 5 } },
  { name: 'Xavier Edwards', short: 'Edwards', team: 'MIA', number: 9, height: 69, weight: 175, age: 27, bats: 'S', throws: 'R', skin: '#8f5840', espn: 41326, mlb: 669364, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 9, power: 0, eye: 7, avoidK: 9, gap: 2, speed: 7, baserunning: 8, fielding: 5, arm: 2, clutch: 7 } },
  { name: 'Javier Sanoja', short: 'Sanoja', team: 'MIA', number: 8, height: 67, weight: 150, age: 24, bats: 'R', throws: 'R', skin: '#ae7a5d', espn: 5073992, mlb: 691594, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 10, power: 3, eye: 2, avoidK: 11, gap: 11, speed: 7, baserunning: 5, fielding: 6, arm: 7, clutch: 7 } },
  { name: 'Otto Lopez', short: 'Lopez', team: 'MIA', number: 6, height: 70, weight: 185, age: 28, bats: 'R', throws: 'R', skin: '#8e5d48', espn: 41917, mlb: 672640, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 10, power: 3, eye: 3, avoidK: 9, gap: 6, speed: 7, baserunning: 9, fielding: 10, arm: 7, clutch: 7 } },
  { name: 'Heriberto Hernández', short: 'Hernandez', team: 'MIA', number: 13, height: 71, weight: 195, age: 26, bats: 'R', throws: 'R', skin: '#b67b5e', espn: 42455, mlb: 681715, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 2, power: 8, eye: 7, avoidK: 3, gap: 5, speed: 7, baserunning: 4, fielding: 5, arm: 5, clutch: 6 } },
  { name: 'Jakob Marsee', short: 'Marsee', team: 'MIA', number: 87, height: 72, weight: 180, age: 25, bats: 'L', throws: 'L', skin: '#af7d67', espn: 4866735, mlb: 805300, starter: false, position: 'bat', role: 'CF',
    attrs: { contact: 6, power: 3, eye: 9, avoidK: 6, gap: 5, speed: 6, baserunning: 6, fielding: 8, arm: 5, clutch: 5 } },

  // ─── MIL ────────────────────────────────────────────────────────────
  { name: 'Jake Bauers', short: 'Bauers', team: 'MIL', number: 9, height: 72, weight: 216, age: 31, bats: 'L', throws: 'L', skin: '#b17767', espn: 35013, mlb: 641343, starter: true, position: 'bat', role: '1B',
    attrs: { contact: 5, power: 8, eye: 11, avoidK: 3, gap: 5, speed: 4, baserunning: 6, fielding: 2, arm: 5, clutch: 10 } },
  { name: 'William Contreras', short: 'Contreras', team: 'MIL', number: 24, height: 70, weight: 217, age: 28, bats: 'R', throws: 'R', skin: '#a7725e', espn: 39895, mlb: 661388, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 7, power: 4, eye: 7, avoidK: 8, gap: 4, speed: 3, baserunning: 0, fielding: 5, arm: 6, clutch: 10 } },
  { name: 'Brice Turang', short: 'Turang', team: 'MIL', number: 2, height: 72, weight: 190, age: 26, bats: 'L', throws: 'R', skin: '#b28376', espn: 41179, mlb: 668930, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 7, power: 5, eye: 8, avoidK: 4, gap: 7, speed: 8, baserunning: 7, fielding: 9, arm: 4, clutch: 9 } },
  { name: 'Joey Ortiz', short: 'Ortiz', team: 'MIL', number: 3, height: 70, weight: 192, age: 28, bats: 'R', throws: 'R', skin: '#a96d5a', espn: 42958, mlb: 687401, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 7, power: 2, eye: 3, avoidK: 7, gap: 3, speed: 8, baserunning: 5, fielding: 10, arm: 7, clutch: 2 } },
  { name: 'Jackson Chourio', short: 'Chourio', team: 'MIL', number: 11, height: 73, weight: 199, age: 22, bats: 'R', throws: 'R', skin: '#94604e', espn: 4917869, mlb: 694192, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 7, power: 7, eye: 3, avoidK: 5, gap: 8, speed: 9, baserunning: 8, fielding: 7, arm: 6, clutch: 9 } },
  { name: 'Garrett Mitchell', short: 'Mitchell', team: 'MIL', number: 5, height: 74, weight: 229, age: 28, bats: 'L', throws: 'R', skin: '#a67f6b', espn: 4313442, mlb: 669003, starter: false, position: 'bat', role: 'CF',
    attrs: { contact: 4, power: 5, eye: 8, avoidK: 1, gap: 9, speed: 10, baserunning: 6, fielding: 8, arm: 6, clutch: 8 } },

  // ─── MIN ────────────────────────────────────────────────────────────
  { name: 'Byron Buxton', short: 'Buxton', team: 'MIN', number: 25, height: 73, weight: 190, age: 32, bats: 'R', throws: 'R', skin: '#9d613d', espn: 32655, mlb: 621439, starter: true, position: 'bat', role: 'CF',
    attrs: { contact: 4, power: 11, eye: 4, avoidK: 3, gap: 8, speed: 10, baserunning: 9, fielding: 6, arm: 5, clutch: 7 } },
  { name: 'Ryan Jeffers', short: 'Jeffers', team: 'MIN', number: 27, height: 74, weight: 235, age: 29, bats: 'R', throws: 'R', skin: '#d19475', espn: 41587, mlb: 680777, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 7, power: 6, eye: 8, avoidK: 6, gap: 8, speed: 3, baserunning: 3, fielding: 5, arm: 4, clutch: 6 } },
  { name: 'Kody Clemens', short: 'Clemens', team: 'MIN', number: 2, height: 72, weight: 200, age: 30, bats: 'L', throws: 'R', skin: '#cd906b', espn: 41311, mlb: 665019, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 5, power: 8, eye: 4, avoidK: 5, gap: 7, speed: 6, baserunning: 7, fielding: 5, arm: 5, clutch: 8 } },
  { name: 'Luke Keaschall', short: 'Keaschall', team: 'MIN', number: 15, height: 72, weight: 190, age: 24, bats: 'R', throws: 'R', skin: '#d18f6d', espn: 4977664, mlb: 807712, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 9, power: 2, eye: 7, avoidK: 9, gap: 6, speed: 8, baserunning: 8, fielding: 3, arm: 4, clutch: 7 } },
  { name: 'Brooks Lee', short: 'Lee', team: 'MIN', number: 22, height: 72, weight: 205, age: 25, bats: 'S', throws: 'R', skin: '#c78a68', espn: 4629081, mlb: 686797, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 6, power: 5, eye: 2, avoidK: 8, gap: 4, speed: 3, baserunning: 3, fielding: 5, arm: 6, clutch: 7 } },
  { name: 'Trevor Larnach', short: 'Larnach', team: 'MIN', number: 9, height: 75, weight: 223, age: 29, bats: 'L', throws: 'R', skin: '#c1835f', espn: 41205, mlb: 663616, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 6, power: 5, eye: 6, avoidK: 6, gap: 6, speed: 3, baserunning: 3, fielding: 3, arm: 4, clutch: 6 } },

  // ─── NYM ────────────────────────────────────────────────────────────
  { name: 'Juan Soto', short: 'Soto', team: 'NYM', number: 22, height: 73, weight: 224, age: 28, bats: 'L', throws: 'L', skin: '#a76b52', espn: 36969, mlb: 665742, starter: true, position: 'bat', role: 'LF',
    attrs: { contact: 8, power: 10, eye: 11, avoidK: 8, gap: 3, speed: 2, baserunning: 6, fielding: 2, arm: 3, clutch: 9 } },
  { name: 'Bo Bichette', short: 'Bichette', team: 'NYM', number: 19, height: 71, weight: 190, age: 28, bats: 'R', throws: 'R', skin: '#b87d69', espn: 38904, mlb: 666182, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 9, power: 4, eye: 2, avoidK: 8, gap: 6, speed: 3, baserunning: 1, fielding: 4, arm: 6, clutch: 7 } },
  { name: 'Brett Baty', short: 'Baty', team: 'NYM', number: 7, height: 75, weight: 210, age: 26, bats: 'L', throws: 'R', skin: '#bd847f', espn: 42414, mlb: 683146, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 4, power: 6, eye: 5, avoidK: 3, gap: 5, speed: 4, baserunning: 6, fielding: 5, arm: 7, clutch: 3 } },
  { name: 'Francisco Lindor', short: 'Lindor', team: 'NYM', number: 12, height: 70, weight: 190, age: 32, bats: 'S', throws: 'R', skin: '#a7654a', espn: 32129, mlb: 596019, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 5, power: 7, eye: 6, avoidK: 6, gap: 5, speed: 4, baserunning: 6, fielding: 6, arm: 6, clutch: 5 } },
  { name: 'A.J. Ewing', short: 'Ewing', team: 'NYM', number: 9, height: 70, weight: 160, age: 22, bats: 'L', throws: 'R', skin: '#cb9581', espn: 5208019, mlb: 805999, starter: false, position: 'bat', role: 'CF',
    attrs: { contact: 6, power: 4, eye: 6, avoidK: 4, gap: 3, speed: 9, baserunning: 8, fielding: 8, arm: 8, clutch: 5 } },
  { name: 'Carson Benge', short: 'Benge', team: 'NYM', number: 3, height: 73, weight: 184, age: 23, bats: 'L', throws: 'R', skin: '#d19781', espn: 4925604, mlb: 701807, starter: false, position: 'bat', role: 'RF',
    attrs: { contact: 8, power: 5, eye: 5, avoidK: 5, gap: 3, speed: 7, baserunning: 8, fielding: 7, arm: 11, clutch: 5 } },

  // ─── NYY ────────────────────────────────────────────────────────────
  { name: 'Aaron Judge', short: 'Judge', team: 'NYY', number: 99, height: 79, weight: 282, age: 34, bats: 'R', throws: 'R', skin: '#c89070', espn: 33192, mlb: 592450, starter: true, position: 'bat', role: 'RF',
    attrs: { contact: 6, power: 11, eye: 10, avoidK: 3, gap: 7, speed: 4, baserunning: 3, fielding: 5, arm: 7, clutch: 11 } },
  { name: 'Austin Wells', short: 'Wells', team: 'NYY', number: 28, height: 73, weight: 220, age: 27, bats: 'L', throws: 'R', skin: '#bd8c72', espn: 4683349, mlb: 669224, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 1, power: 6, eye: 6, avoidK: 3, gap: 2, speed: 3, baserunning: 5, fielding: 10, arm: 3, clutch: 3 } },
  { name: 'Luis García Jr.', short: 'García Jr.', team: 'NYY', number: 26, height: 73, weight: 216, age: 26, bats: 'L', throws: 'R', skin: '#976152', espn: 40459, mlb: 671277, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 8, power: 8, eye: 1, avoidK: 7, gap: 9, speed: 3, baserunning: 2, fielding: 4, arm: 2, clutch: 8 } },
  { name: 'Jazz Chisholm Jr.', short: 'Chisholm Jr.', team: 'NYY', number: 13, height: 71, weight: 184, age: 28, bats: 'L', throws: 'R', skin: '#724635', espn: 41433, mlb: 665862, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 2, power: 7, eye: 7, avoidK: 2, gap: 3, speed: 6, baserunning: 10, fielding: 8, arm: 4, clutch: 5 } },
  { name: 'Cody Bellinger', short: 'Bellinger', team: 'NYY', number: 35, height: 75, weight: 204, age: 31, bats: 'L', throws: 'L', skin: '#c1866b', espn: 33912, mlb: 641355, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 8, power: 6, eye: 5, avoidK: 8, gap: 6, speed: 5, baserunning: 5, fielding: 8, arm: 8, clutch: 7 } },
  { name: 'Ben Rice', short: 'Rice', team: 'NYY', number: 22, height: 74, weight: 228, age: 27, bats: 'L', throws: 'R', skin: '#ce9881', espn: 5016968, mlb: 700250, starter: false, position: 'bat', role: 'DH',
    attrs: { contact: 7, power: 10, eye: 8, avoidK: 5, gap: 8, speed: 4, baserunning: 3, fielding: 0, arm: 0, clutch: 10 } },

  // ─── PHI ────────────────────────────────────────────────────────────
  { name: 'Kyle Schwarber', short: 'Schwarber', team: 'PHI', number: 12, height: 71, weight: 229, age: 33, bats: 'L', throws: 'R', skin: '#bc7e69', espn: 33712, mlb: 656941, starter: true, position: 'bat', role: 'DH',
    attrs: { contact: 2, power: 11, eye: 10, avoidK: 1, gap: 4, speed: 2, baserunning: 3, fielding: 1, arm: 3, clutch: 10 } },
  { name: 'Bryce Harper', short: 'Harper', team: 'PHI', number: 3, height: 73, weight: 210, age: 34, bats: 'L', throws: 'R', skin: '#c48a6f', espn: 30951, mlb: 547180, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 5, power: 8, eye: 8, avoidK: 5, gap: 8, speed: 4, baserunning: 2, fielding: 2, arm: 5, clutch: 9 } },
  { name: 'Bryson Stott', short: 'Stott', team: 'PHI', number: 5, height: 72, weight: 200, age: 29, bats: 'L', throws: 'R', skin: '#c28871', espn: 42417, mlb: 681082, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 8, power: 3, eye: 6, avoidK: 8, gap: 8, speed: 7, baserunning: 11, fielding: 7, arm: 5, clutch: 6 } },
  { name: 'Luis Arraez', short: 'Arraez', team: 'PHI', number: 4, height: 70, weight: 186, age: 29, bats: 'L', throws: 'R', skin: '#b87b60', espn: 39572, mlb: 650333, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 11, power: 1, eye: 2, avoidK: 11, gap: 7, speed: 3, baserunning: 6, fielding: 6, arm: 5, clutch: 4 } },
  { name: 'Trea Turner', short: 'Turner', team: 'PHI', number: 7, height: 73, weight: 185, age: 33, bats: 'R', throws: 'R', skin: '#c58e72', espn: 33710, mlb: 607208, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 6, power: 4, eye: 3, avoidK: 6, gap: 5, speed: 11, baserunning: 9, fielding: 5, arm: 6, clutch: 2 } },
  { name: 'Brandon Marsh', short: 'Marsh', team: 'PHI', number: 16, height: 74, weight: 215, age: 28, bats: 'L', throws: 'R', skin: '#c68c74', espn: 40803, mlb: 669016, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 7, power: 5, eye: 3, avoidK: 3, gap: 5, speed: 6, baserunning: 7, fielding: 3, arm: 5, clutch: 4 } },

  // ─── PIT ────────────────────────────────────────────────────────────
  { name: 'Brandon Lowe', short: 'Lowe', team: 'PIT', number: 5, height: 69, weight: 181, age: 32, bats: 'L', throws: 'R', skin: '#ca8d75', espn: 39961, mlb: 664040, starter: true, position: 'bat', role: '2B',
    attrs: { contact: 3, power: 9, eye: 4, avoidK: 2, gap: 6, speed: 4, baserunning: 4, fielding: 7, arm: 3, clutch: 7 } },
  { name: 'Ryan O\'Hearn', short: 'O\'Hearn', team: 'PIT', number: 29, height: 74, weight: 220, age: 33, bats: 'L', throws: 'L', skin: '#d39b82', espn: 35183, mlb: 656811, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 7, power: 5, eye: 5, avoidK: 5, gap: 4, speed: 4, baserunning: 4, fielding: 4, arm: 2, clutch: 6 } },
  { name: 'Nick Gonzales', short: 'Gonzales', team: 'PIT', number: 3, height: 68, weight: 193, age: 27, bats: 'R', throws: 'R', skin: '#c4856a', espn: 4311634, mlb: 693304, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 8, power: 1, eye: 3, avoidK: 8, gap: 4, speed: 8, baserunning: 5, fielding: 3, arm: 6, clutch: 2 } },
  { name: 'Bryan Reynolds', short: 'Reynolds', team: 'PIT', number: 10, height: 74, weight: 210, age: 31, bats: 'S', throws: 'R', skin: '#ca8f75', espn: 38980, mlb: 668804, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 5, power: 5, eye: 8, avoidK: 4, gap: 9, speed: 6, baserunning: 7, fielding: 3, arm: 5, clutch: 6 } },
  { name: 'Jake Mangum', short: 'Mangum', team: 'PIT', number: 28, height: 71, weight: 191, age: 30, bats: 'S', throws: 'L', skin: '#d6957b', espn: 42664, mlb: 663968, starter: false, position: 'bat', role: 'CF',
    attrs: { contact: 7, power: 1, eye: 0, avoidK: 7, gap: 3, speed: 9, baserunning: 8, fielding: 6, arm: 5, clutch: 3 } },
  { name: 'Oneil Cruz', short: 'Cruz', team: 'PIT', number: 15, height: 79, weight: 248, age: 28, bats: 'L', throws: 'R', skin: '#7a4a32', espn: 39712, mlb: 665833, starter: false, position: 'bat', role: 'CF',
    attrs: { contact: 2, power: 9, eye: 7, avoidK: 0, gap: 4, speed: 8, baserunning: 10, fielding: 7, arm: 11, clutch: 6 } },

  // ─── SD ────────────────────────────────────────────────────────────
  { name: 'Fernando Tatis Jr.', short: 'Tatis Jr.', team: 'SD', number: 23, height: 75, weight: 217, age: 27, bats: 'R', throws: 'R', skin: '#ac6e50', espn: 35983, mlb: 665487, starter: true, position: 'bat', role: 'RF',
    attrs: { contact: 8, power: 7, eye: 7, avoidK: 7, gap: 6, speed: 8, baserunning: 8, fielding: 7, arm: 10, clutch: 10 } },
  { name: 'Ty France', short: 'France', team: 'SD', number: 25, height: 70, weight: 215, age: 32, bats: 'R', throws: 'R', skin: '#b07962', espn: 35591, mlb: 664034, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 7, power: 6, eye: 3, avoidK: 6, gap: 7, speed: 1, baserunning: 0, fielding: 7, arm: 1, clutch: 7 } },
  { name: 'Jake Cronenworth', short: 'Cronenworth', team: 'SD', number: 9, height: 71, weight: 187, age: 32, bats: 'L', throws: 'R', skin: '#bc8f79', espn: 36364, mlb: 630105, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 5, power: 2, eye: 7, avoidK: 5, gap: 2, speed: 6, baserunning: 5, fielding: 5, arm: 3, clutch: 4 } },
  { name: 'Manny Machado', short: 'Machado', team: 'SD', number: 13, height: 74, weight: 218, age: 34, bats: 'R', throws: 'R', skin: '#b88565', espn: 31097, mlb: 592518, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 4, power: 7, eye: 6, avoidK: 6, gap: 4, speed: 2, baserunning: 1, fielding: 7, arm: 7, clutch: 7 } },
  { name: 'Xander Bogaerts', short: 'Bogaerts', team: 'SD', number: 2, height: 74, weight: 218, age: 34, bats: 'R', throws: 'R', skin: '#9a6142', espn: 31606, mlb: 593428, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 6, power: 3, eye: 8, avoidK: 7, gap: 3, speed: 5, baserunning: 8, fielding: 8, arm: 6, clutch: 5 } },
  { name: 'Jackson Merrill', short: 'Merrill', team: 'SD', number: 3, height: 74, weight: 195, age: 23, bats: 'L', throws: 'R', skin: '#bd7e71', espn: 4872691, mlb: 701538, starter: false, position: 'bat', role: 'CF',
    attrs: { contact: 6, power: 7, eye: 2, avoidK: 4, gap: 7, speed: 8, baserunning: 9, fielding: 9, arm: 10, clutch: 7 } },

  // ─── SEA ────────────────────────────────────────────────────────────
  { name: 'Randy Arozarena', short: 'Arozarena', team: 'SEA', number: 56, height: 70, weight: 185, age: 31, bats: 'R', throws: 'R', skin: '#8d6249', espn: 36488, mlb: 668227, starter: true, position: 'bat', role: 'LF',
    attrs: { contact: 5, power: 7, eye: 6, avoidK: 4, gap: 7, speed: 5, baserunning: 7, fielding: 2, arm: 1, clutch: 9 } },
  { name: 'Cal Raleigh', short: 'Raleigh', team: 'SEA', number: 29, height: 74, weight: 235, age: 29, bats: 'S', throws: 'R', skin: '#d59d84', espn: 41292, mlb: 663728, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 1, power: 10, eye: 7, avoidK: 2, gap: 3, speed: 2, baserunning: 3, fielding: 5, arm: 3, clutch: 8 } },
  { name: 'J.P. Crawford', short: 'Crawford', team: 'SEA', number: 3, height: 72, weight: 202, age: 31, bats: 'L', throws: 'R', skin: '#c18c71', espn: 33210, mlb: 641487, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 6, power: 3, eye: 9, avoidK: 6, gap: 1, speed: 3, baserunning: 2, fielding: 3, arm: 5, clutch: 4 } },
  { name: 'Taylor Ward', short: 'Ward', team: 'SEA', number: 27, height: 72, weight: 205, age: 32, bats: 'R', throws: 'R', skin: '#bc8f79', espn: 34923, mlb: 621493, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 5, power: 4, eye: 11, avoidK: 5, gap: 3, speed: 5, baserunning: 1, fielding: 4, arm: 3, clutch: 4 } },
  { name: 'Julio Rodríguez', short: 'Rodríguez', team: 'SEA', number: 44, height: 76, weight: 228, age: 25, bats: 'R', throws: 'R', skin: '#ae7a5d', espn: 41044, mlb: 677594, starter: false, position: 'bat', role: 'CF',
    attrs: { contact: 6, power: 6, eye: 2, avoidK: 5, gap: 5, speed: 8, baserunning: 9, fielding: 7, arm: 8, clutch: 8 } },
  { name: 'Dominic Canzone', short: 'Canzone', team: 'SEA', number: 8, height: 72, weight: 190, age: 29, bats: 'L', throws: 'R', skin: '#ce9c87', espn: 4345621, mlb: 686527, starter: false, position: 'bat', role: 'DH',
    attrs: { contact: 7, power: 8, eye: 4, avoidK: 5, gap: 9, speed: 3, baserunning: 3, fielding: 1, arm: 5, clutch: 6 } },

  // ─── SF ────────────────────────────────────────────────────────────
  { name: 'Rafael Devers', short: 'Devers', team: 'SF', number: 16, height: 72, weight: 235, age: 30, bats: 'L', throws: 'R', skin: '#9d6448', espn: 33859, mlb: 646240, starter: true, position: 'bat', role: '1B',
    attrs: { contact: 3, power: 9, eye: 8, avoidK: 3, gap: 9, speed: 2, baserunning: 2, fielding: 2, arm: 2, clutch: 9 } },
  { name: 'Matt Chapman', short: 'Chapman', team: 'SF', number: 26, height: 73, weight: 220, age: 33, bats: 'R', throws: 'R', skin: '#c0886e', espn: 33857, mlb: 656305, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 4, power: 5, eye: 8, avoidK: 4, gap: 6, speed: 6, baserunning: 4, fielding: 7, arm: 8, clutch: 6 } },
  { name: 'Willy Adames', short: 'Adames', team: 'SF', number: 2, height: 72, weight: 216, age: 31, bats: 'R', throws: 'R', skin: '#b67d64', espn: 33675, mlb: 642715, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 3, power: 7, eye: 5, avoidK: 3, gap: 6, speed: 6, baserunning: 4, fielding: 3, arm: 8, clutch: 3 } },
  { name: 'Casey Schmitt', short: 'Schmitt', team: 'SF', number: 10, height: 72, weight: 215, age: 27, bats: 'R', throws: 'R', skin: '#b68470', espn: 4301949, mlb: 669477, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 7, power: 8, eye: 1, avoidK: 5, gap: 6, speed: 6, baserunning: 6, fielding: 4, arm: 4, clutch: 5 } },
  { name: 'Jung Hoo Lee', short: 'Lee', team: 'SF', number: 51, height: 72, weight: 196, age: 28, bats: 'L', throws: 'R', skin: '#c18c71', espn: 5134621, mlb: 808982, starter: false, position: 'bat', role: 'RF',
    attrs: { contact: 10, power: 2, eye: 4, avoidK: 10, gap: 9, speed: 5, baserunning: 7, fielding: 3, arm: 7, clutch: 6 } },
  { name: 'Bryce Eldridge', short: 'Eldridge', team: 'SF', number: 8, height: 79, weight: 251, age: 22, bats: 'L', throws: 'R', skin: '#b68470', espn: 5149064, mlb: 805811, starter: false, position: 'bat', role: 'DH',
    attrs: { contact: 5, power: 7, eye: 9, avoidK: 3, gap: 7, speed: 2, baserunning: 0, fielding: 1, arm: 1, clutch: 7 } },

  // ─── STL ────────────────────────────────────────────────────────────
  { name: 'Alec Burleson', short: 'Burleson', team: 'STL', number: 41, height: 72, weight: 225, age: 27, bats: 'L', throws: 'L', skin: '#ba816a', espn: 4345070, mlb: 676475, starter: true, position: 'bat', role: '1B',
    attrs: { contact: 9, power: 7, eye: 3, avoidK: 7, gap: 8, speed: 2, baserunning: 4, fielding: 5, arm: 2, clutch: 7 } },
  { name: 'Pedro Pagés', short: 'Pagés', team: 'STL', number: 43, height: 71, weight: 245, age: 28, bats: 'R', throws: 'R', skin: '#b67856', espn: 42608, mlb: 686780, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 3, power: 3, eye: 2, avoidK: 3, gap: 2, speed: 2, baserunning: 4, fielding: 8, arm: 7, clutch: 3 } },
  { name: 'JJ Wetherholt', short: 'Wetherholt', team: 'STL', number: 26, height: 69, weight: 190, age: 24, bats: 'L', throws: 'R', skin: '#c1835f', espn: 4941056, mlb: 802139, starter: false, position: 'bat', role: '2B',
    attrs: { contact: 6, power: 4, eye: 8, avoidK: 7, gap: 0, speed: 5, baserunning: 8, fielding: 10, arm: 5, clutch: 8 } },
  { name: 'Masyn Winn', short: 'Winn', team: 'STL', number: 0, height: 69, weight: 185, age: 24, bats: 'R', throws: 'R', skin: '#bb7d5a', espn: 4683365, mlb: 691026, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 5, power: 1, eye: 6, avoidK: 5, gap: 4, speed: 7, baserunning: 6, fielding: 11, arm: 10, clutch: 5 } },
  { name: 'Jordan Walker', short: 'Walker', team: 'STL', number: 18, height: 78, weight: 250, age: 24, bats: 'R', throws: 'R', skin: '#7c4b33', espn: 4684778, mlb: 691023, starter: false, position: 'bat', role: 'RF',
    attrs: { contact: 4, power: 7, eye: 3, avoidK: 2, gap: 6, speed: 8, baserunning: 8, fielding: 2, arm: 9, clutch: 4 } },
  { name: 'Iván Herrera', short: 'Herrera', team: 'STL', number: 48, height: 71, weight: 220, age: 26, bats: 'R', throws: 'R', skin: '#a66748', espn: 41889, mlb: 671056, starter: false, position: 'bat', role: 'DH',
    attrs: { contact: 7, power: 5, eye: 7, avoidK: 6, gap: 2, speed: 3, baserunning: 5, fielding: 0, arm: 2, clutch: 9 } },

  // ─── TB ────────────────────────────────────────────────────────────
  { name: 'Junior Caminero', short: 'Caminero', team: 'TB', number: 13, height: 73, weight: 220, age: 23, bats: 'R', throws: 'R', skin: '#a36948', espn: 4905921, mlb: 691406, starter: true, position: 'bat', role: '3B',
    attrs: { contact: 7, power: 10, eye: 5, avoidK: 7, gap: 6, speed: 4, baserunning: 2, fielding: 4, arm: 7, clutch: 10 } },
  { name: 'Liam Hicks', short: 'Hicks', team: 'TB', number: 34, height: 69, weight: 185, age: 27, bats: 'L', throws: 'R', skin: '#b07a65', espn: 4725251, mlb: 689414, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 10, power: 3, eye: 7, avoidK: 10, gap: 2, speed: 2, baserunning: 1, fielding: 7, arm: 4, clutch: 8 } },
  { name: 'Jonathan Aranda', short: 'Aranda', team: 'TB', number: 8, height: 72, weight: 215, age: 28, bats: 'L', throws: 'R', skin: '#cc9472', espn: 40810, mlb: 666018, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 7, power: 6, eye: 6, avoidK: 4, gap: 5, speed: 2, baserunning: 0, fielding: 4, arm: 2, clutch: 9 } },
  { name: 'Chandler Simpson', short: 'Simpson', team: 'TB', number: 14, height: 71, weight: 170, age: 25, bats: 'L', throws: 'R', skin: '#ab6b47', espn: 4679983, mlb: 802415, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 11, power: 0, eye: 2, avoidK: 11, gap: 1, speed: 9, baserunning: 11, fielding: 4, arm: 2, clutch: 6 } },
  { name: 'Jonny DeLuca', short: 'DeLuca', team: 'TB', number: 21, height: 70, weight: 195, age: 28, bats: 'R', throws: 'R', skin: '#d19b7a', espn: 5005912, mlb: 676356, starter: false, position: 'bat', role: 'RF',
    attrs: { contact: 6, power: 4, eye: 2, avoidK: 5, gap: 10, speed: 9, baserunning: 8, fielding: 8, arm: 6, clutch: 6 } },
  { name: 'Yandy Díaz', short: 'Díaz', team: 'TB', number: 2, height: 72, weight: 235, age: 35, bats: 'R', throws: 'R', skin: '#a36948', espn: 33481, mlb: 650490, starter: false, position: 'bat', role: 'DH',
    attrs: { contact: 10, power: 5, eye: 5, avoidK: 9, gap: 4, speed: 3, baserunning: 2, fielding: 1, arm: 1, clutch: 8 } },

  // ─── TEX ────────────────────────────────────────────────────────────
  { name: 'Josh Jung', short: 'Jung', team: 'TEX', number: 6, height: 73, weight: 214, age: 28, bats: 'R', throws: 'R', skin: '#d19781', espn: 42437, mlb: 673962, starter: true, position: 'bat', role: '3B',
    attrs: { contact: 8, power: 5, eye: 4, avoidK: 6, gap: 8, speed: 2, baserunning: 1, fielding: 5, arm: 6, clutch: 6 } },
  { name: 'Jake Burger', short: 'Burger', team: 'TEX', number: 21, height: 72, weight: 230, age: 30, bats: 'R', throws: 'R', skin: '#cb9581', espn: 39882, mlb: 669394, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 2, power: 8, eye: 3, avoidK: 3, gap: 4, speed: 5, baserunning: 4, fielding: 5, arm: 3, clutch: 8 } },
  { name: 'Corey Seager', short: 'Seager', team: 'TEX', number: 5, height: 76, weight: 215, age: 32, bats: 'L', throws: 'R', skin: '#da977b', espn: 32691, mlb: 608369, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 4, power: 9, eye: 7, avoidK: 5, gap: 5, speed: 1, baserunning: 4, fielding: 6, arm: 5, clutch: 4 } },
  { name: 'Ezequiel Duran', short: 'Duran', team: 'TEX', number: 20, height: 70, weight: 185, age: 27, bats: 'R', throws: 'R', skin: '#b37252', espn: 42457, mlb: 677649, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 5, power: 4, eye: 3, avoidK: 4, gap: 7, speed: 8, baserunning: 7, fielding: 10, arm: 10, clutch: 5 } },
  { name: 'Wyatt Langford', short: 'Langford', team: 'TEX', number: 36, height: 72, weight: 225, age: 24, bats: 'R', throws: 'R', skin: '#d69f84', espn: 4719324, mlb: 694671, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 4, power: 6, eye: 8, avoidK: 4, gap: 6, speed: 7, baserunning: 7, fielding: 7, arm: 3, clutch: 8 } },
  { name: 'Brandon Nimmo', short: 'Nimmo', team: 'TEX', number: 24, height: 73, weight: 206, age: 33, bats: 'L', throws: 'R', skin: '#cc9278', espn: 32159, mlb: 607043, starter: false, position: 'bat', role: 'RF',
    attrs: { contact: 6, power: 5, eye: 5, avoidK: 5, gap: 7, speed: 5, baserunning: 7, fielding: 3, arm: 4, clutch: 5 } },

  // ─── TOR ────────────────────────────────────────────────────────────
  { name: 'George Springer', short: 'Springer', team: 'TOR', number: 4, height: 73, weight: 220, age: 37, bats: 'R', throws: 'R', skin: '#bf8660', espn: 32078, mlb: 543807, starter: true, position: 'bat', role: 'DH',
    attrs: { contact: 7, power: 7, eye: 7, avoidK: 7, gap: 6, speed: 5, baserunning: 7, fielding: 1, arm: 3, clutch: 7 } },
  { name: 'Alejandro Kirk', short: 'Kirk', team: 'TOR', number: 30, height: 68, weight: 245, age: 28, bats: 'R', throws: 'R', skin: '#c89070', espn: 42081, mlb: 672386, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 9, power: 4, eye: 6, avoidK: 9, gap: 2, speed: 0, baserunning: 1, fielding: 11, arm: 4, clutch: 8 } },
  { name: 'Vladimir Guerrero Jr.', short: 'Guerrero Jr.', team: 'TOR', number: 27, height: 72, weight: 245, age: 27, bats: 'R', throws: 'R', skin: '#87563b', espn: 35002, mlb: 665489, starter: false, position: 'bat', role: '1B',
    attrs: { contact: 8, power: 4, eye: 7, avoidK: 9, gap: 4, speed: 3, baserunning: 2, fielding: 5, arm: 3, clutch: 9 } },
  { name: 'Kazuma Okamoto', short: 'Okamoto', team: 'TOR', number: 7, height: 73, weight: 220, age: 30, bats: 'R', throws: 'R', skin: '#c78a68', espn: 5134636, mlb: 672960, starter: false, position: 'bat', role: '3B',
    attrs: { contact: 2, power: 9, eye: 6, avoidK: 2, gap: 5, speed: 3, baserunning: 2, fielding: 5, arm: 5, clutch: 6 } },
  { name: 'Andrés Giménez', short: 'Giménez', team: 'TOR', number: 0, height: 71, weight: 161, age: 28, bats: 'L', throws: 'R', skin: '#ae7656', espn: 37729, mlb: 665926, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 4, power: 2, eye: 1, avoidK: 7, gap: 4, speed: 5, baserunning: 7, fielding: 10, arm: 8, clutch: 4 } },
  { name: 'Nathan Lukes', short: 'Lukes', team: 'TOR', number: 38, height: 71, weight: 180, age: 32, bats: 'L', throws: 'R', skin: '#bc8364', espn: 35682, mlb: 664770, starter: false, position: 'bat', role: 'RF',
    attrs: { contact: 8, power: 3, eye: 3, avoidK: 9, gap: 3, speed: 4, baserunning: 2, fielding: 8, arm: 9, clutch: 4 } },

  // ─── WSH ────────────────────────────────────────────────────────────
  { name: 'James Wood', short: 'Wood', team: 'WSH', number: 29, height: 78, weight: 234, age: 24, bats: 'L', throws: 'R', skin: '#9a6455', espn: 4918256, mlb: 695578, starter: true, position: 'bat', role: 'RF',
    attrs: { contact: 5, power: 10, eye: 10, avoidK: 1, gap: 8, speed: 5, baserunning: 6, fielding: 2, arm: 5, clutch: 10 } },
  { name: 'Keibert Ruiz', short: 'Ruiz', team: 'WSH', number: 20, height: 71, weight: 238, age: 28, bats: 'S', throws: 'R', skin: '#976152', espn: 38827, mlb: 660688, starter: false, position: 'bat', role: 'C',
    attrs: { contact: 9, power: 3, eye: 1, avoidK: 10, gap: 8, speed: 1, baserunning: 1, fielding: 5, arm: 2, clutch: 4 } },
  { name: 'CJ Abrams', short: 'Abrams', team: 'WSH', number: 5, height: 72, weight: 191, age: 26, bats: 'L', throws: 'R', skin: '#875340', espn: 42402, mlb: 682928, starter: false, position: 'bat', role: 'SS',
    attrs: { contact: 5, power: 8, eye: 3, avoidK: 5, gap: 9, speed: 7, baserunning: 10, fielding: 2, arm: 7, clutch: 9 } },
  { name: 'Daylen Lile', short: 'Lile', team: 'WSH', number: 4, height: 71, weight: 195, age: 23, bats: 'L', throws: 'R', skin: '#a67f6b', espn: 4917889, mlb: 695734, starter: false, position: 'bat', role: 'LF',
    attrs: { contact: 7, power: 6, eye: 2, avoidK: 7, gap: 9, speed: 9, baserunning: 6, fielding: 4, arm: 3, clutch: 8 } },
  { name: 'Jacob Young', short: 'Young', team: 'WSH', number: 30, height: 71, weight: 192, age: 27, bats: 'R', throws: 'R', skin: '#b17767', espn: 4414210, mlb: 696285, starter: false, position: 'bat', role: 'CF',
    attrs: { contact: 7, power: 2, eye: 5, avoidK: 7, gap: 4, speed: 9, baserunning: 8, fielding: 10, arm: 5, clutch: 4 } },
  { name: 'Dylan Crews', short: 'Crews', team: 'WSH', number: 3, height: 71, weight: 203, age: 24, bats: 'R', throws: 'R', skin: '#b08073', espn: 4719511, mlb: 686611, starter: false, position: 'bat', role: 'RF',
    attrs: { contact: 3, power: 5, eye: 4, avoidK: 4, gap: 4, speed: 9, baserunning: 9, fielding: 6, arm: 5, clutch: 4 } },
]
