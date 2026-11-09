// CURRENT pitchers for baseball, Build-A-Player's fourth sport (pool key 'current', label CURRENT = 2026 MLB rosters).
// Same row shape as data/mlb-batters.js, attrs on the 0-11 grade scale (F=0, D=1, C-=2, C=3, C+=4, B-=5, B=6, B+=7,
// A-=8, A=9, A+=10, S=11), integer attrs with exactly PIT_TYPES from data/mlb-attrs.js.
//
// WHO IS IN   About six per club: the rotation's top four (8+ starts; 2026 WAR + 0.3 x 2025 WAR + innings, MLB Stats
//   API sabermetrics), the closer (most 2026 saves) and the top other reliever (WAR, holds, shutdowns minus meltdowns).
//   An ace who lost most of 2026 to injury and is still the club's rides along as a seventh (2025 WAR 4.5+: Garrett
//   Crochet). team = the club he finished the 2026 season with (free agents included at their 2026 club; a mid-season
//   trade counts for his last club). position 'pit'; role = 'SP' | 'CL' | 'RP' as above. Shohei Ohtani is in both files
//   (LAD DH and LAD SP, the same id and bio). starter: true = the ace, one per club, the pitcher a build replaces: the
//   best starter by 2026 WAR + half his 2025 WAR.
// BIO   as in mlb-batters.js (MLB Stats API people, ESPN roster numbers and ids, skin sampled from the ESPN headshot).
//
// SOURCES (2025 and 2026 regular seasons and postseasons, pulled 2026-11-07)
//   Baseball Savant / Statcast: custom pitcher leaderboard (BB%, zone rate, edge rate, meatball rate, first-pitch
//     strikes, barrels allowed, ground-ball rate, chase rate induced, called strikes), pitch arsenals (average speed and
//     usage by pitch), pitch arsenal stats (run value per 100 pitches and whiff rate by pitch), pitch movement (vertical
//     and horizontal break against pitches of the same speed and release).
//   MLB Stats API: season lines (IP, G, GS, saves, blown saves, holds), sabermetrics (WAR, FIP, shutdowns and
//     meltdowns), RISP and late-and-close splits against, postseason lines.
//   Baseball-Reference team pages: Win Probability Added (WPA/LI, Clutch) for the regular season and postseason.
//
// RUBRIC  2026 counts double 2025; every input is a z-score over the pool (463 pitchers with 20+ IP in 2026 and 40+
//   weighted IP), blended per trait, pulled toward the pool by sample (batters faced / (BF + 150)), cut on percentiles.
//   velocity    average speed of his hardest fastball (four-seam, sinker or cutter) thrown 12%+ of the time
//   movement    45% fastball shape against average for its speed and release (ride on a four-seamer, sink and run on
//               a sinker, cut on a cutter, run on any of them), 55% fastball run value per 100 pitches
//   breaking    his best slider / sweeper / slurve / curveball / knuckle curve (thrown 4%+): 50% run value per 100,
//               50% whiff rate, regressed on pitches thrown, a small usage credit, plus 20% of his second one; a
//               cutter can stand in, marked down. No breaking ball at all: D
//   changeup    the same for his changeup or splitter. No changeup or splitter thrown 4%+ of the time: D
//   control     75% walk rate (lower is better), 25% zone rate
//   command     35% edge rate, 30% meatball rate (lower is better), 20% first-pitch strike rate, 15% barrels allowed
//   stamina     55% innings per appearance, 45% innings per season (so a starter outranks a reliever, a 200-inning
//               starter a five-and-done one)
//   groundball  ground-ball rate
//   composure   25% WPA/LI per 200 IP, 10% Baseball-Reference Clutch, 20% OPS against with runners in scoring position,
//               15% OPS against late and close (both regressed to his own), 10% shutdowns minus meltdowns, 8% save
//               conversion (5+ chances), 15% postseason WPA, small credit for postseason innings
//   pitchIQ     35% pitch mix (entropy of his usage over every pitch thrown 3%+), 35% chase rate induced, 30% called
//               strikes per pitch
//   Grade cut (percentile of the pool): S top 1.5%, A+ next 3%, A next 5%, A- next 8%, B+ 11%, B 14%, B- 15%,
//   C+ 14%, C 12%, C- 9%, D 5%, F the rest. A rotation regular sits around C+ to B.

export const MLB_PITCHERS = [
  // ─── ARI ────────────────────────────────────────────────────────────
  { name: 'Eduardo Rodriguez', short: 'Rodriguez', team: 'ARI', number: 57, height: 74, weight: 231, age: 33, bats: 'L', throws: 'L', skin: '#aa7258', espn: 32675, mlb: 593958, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 2, movement: 5, breaking: 3, changeup: 5, control: 5, command: 11, stamina: 10, groundball: 4, composure: 6, pitchIQ: 5 } },
  { name: 'Brandon Pfaadt', short: 'Pfaadt', team: 'ARI', number: 32, height: 76, weight: 220, age: 28, bats: 'R', throws: 'R', skin: '#bc7e69', espn: 4721302, mlb: 694297, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 6, breaking: 5, changeup: 3, control: 9, command: 7, stamina: 8, groundball: 6, composure: 3, pitchIQ: 10 } },
  { name: 'Merrill Kelly', short: 'Kelly', team: 'ARI', number: 29, height: 74, weight: 210, age: 38, bats: 'R', throws: 'R', skin: '#b37963', espn: 32968, mlb: 518876, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 2, movement: 3, breaking: 5, changeup: 6, control: 4, command: 10, stamina: 10, groundball: 5, composure: 3, pitchIQ: 10 } },
  { name: 'Michael Soroka', short: 'Soroka', team: 'ARI', number: 34, height: 77, weight: 250, age: 29, bats: 'R', throws: 'R', skin: '#b87d69', espn: 34984, mlb: 647336, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 5, breaking: 8, changeup: 2, control: 7, command: 5, stamina: 7, groundball: 3, composure: 6, pitchIQ: 7 } },
  { name: 'Brandyn Garcia', short: 'Garcia', team: 'ARI', number: 55, height: 76, weight: 235, age: 26, bats: 'L', throws: 'L', skin: '#b77a60', espn: 5202600, mlb: 805299, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 8, movement: 9, breaking: 10, changeup: 1, control: 7, command: 2, stamina: 1, groundball: 9, composure: 9, pitchIQ: 4 } },
  { name: 'Juan Morillo', short: 'Morillo', team: 'ARI', number: 62, height: 73, weight: 215, age: 27, bats: 'R', throws: 'R', skin: '#ae7359', espn: 4722925, mlb: 666661, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 10, movement: 9, breaking: 2, changeup: 7, control: 4, command: 5, stamina: 3, groundball: 8, composure: 7, pitchIQ: 5 } },

  // ─── ATH ────────────────────────────────────────────────────────────
  { name: 'J.T. Ginn', short: 'Ginn', team: 'ATH', number: 35, height: 74, weight: 200, age: 27, bats: 'R', throws: 'R', skin: '#c69476', espn: 4414002, mlb: 669372, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 9, breaking: 4, changeup: 9, control: 3, command: 6, stamina: 7, groundball: 7, composure: 5, pitchIQ: 4 } },
  { name: 'Gage Jump', short: 'Jump', team: 'ATH', number: 61, height: 72, weight: 200, age: 23, bats: 'L', throws: 'L', skin: '#c4856a', espn: 5023852, mlb: 695611, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 7, movement: 1, breaking: 6, changeup: 3, control: 3, command: 2, stamina: 7, groundball: 4, composure: 3, pitchIQ: 6 } },
  { name: 'Jack Perkins', short: 'Perkins', team: 'ATH', number: 50, height: 73, weight: 220, age: 26, bats: 'R', throws: 'R', skin: '#ca8f75', espn: 4418686, mlb: 678022, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 6, movement: 1, breaking: 7, changeup: 8, control: 4, command: 5, stamina: 6, groundball: 3, composure: 3, pitchIQ: 8 } },
  { name: 'Jacob Lopez', short: 'Lopez', team: 'ATH', number: 57, height: 76, weight: 220, age: 28, bats: 'L', throws: 'L', skin: '#cc9272', espn: 42239, mlb: 682052, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 1, movement: 6, breaking: 5, changeup: 0, control: 3, command: 6, stamina: 7, groundball: 0, composure: 3, pitchIQ: 3 } },
  { name: 'Hogan Harris', short: 'Harris', team: 'ATH', number: 36, height: 75, weight: 230, age: 29, bats: 'R', throws: 'L', skin: '#c48a6f', espn: 41364, mlb: 663687, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 5, movement: 6, breaking: 4, changeup: 4, control: 2, command: 0, stamina: 5, groundball: 6, composure: 7, pitchIQ: 1 } },
  { name: 'Luis Medina', short: 'Medina', team: 'ATH', number: 46, height: 73, weight: 175, age: 27, bats: 'R', throws: 'R', skin: '#ae7454', espn: 40949, mlb: 665622, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 8, movement: 3, breaking: 11, changeup: 9, control: 2, command: 1, stamina: 5, groundball: 4, composure: 5, pitchIQ: 5 } },

  // ─── ATL ────────────────────────────────────────────────────────────
  { name: 'Chris Sale', short: 'Sale', team: 'ATL', number: 51, height: 78, weight: 180, age: 37, bats: 'L', throws: 'L', skin: '#be7f5d', espn: 30948, mlb: 519242, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 6, movement: 6, breaking: 8, changeup: 5, control: 10, command: 9, stamina: 9, groundball: 5, composure: 10, pitchIQ: 9 } },
  { name: 'Bryce Elder', short: 'Elder', team: 'ATL', number: 55, height: 74, weight: 220, age: 27, bats: 'R', throws: 'R', skin: '#c4856a', espn: 4301067, mlb: 693821, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 3, movement: 5, breaking: 3, changeup: 3, control: 6, command: 7, stamina: 9, groundball: 7, composure: 4, pitchIQ: 5 } },
  { name: 'Martín Pérez', short: 'Pérez', team: 'ATL', number: 33, height: 72, weight: 210, age: 35, bats: 'L', throws: 'L', skin: '#bb7d5a', espn: 31098, mlb: 527048, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 0, movement: 6, breaking: 2, changeup: 7, control: 3, command: 11, stamina: 7, groundball: 7, composure: 7, pitchIQ: 5 } },
  { name: 'Tyler Mahle', short: 'Mahle', team: 'ATL', number: 54, height: 75, weight: 212, age: 32, bats: 'R', throws: 'R', skin: '#ae8071', espn: 34973, mlb: 641816, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 3, movement: 6, breaking: 0, changeup: 4, control: 6, command: 11, stamina: 8, groundball: 5, composure: 8, pitchIQ: 4 } },
  { name: 'Raisel Iglesias', short: 'Iglesias', team: 'ATL', number: 26, height: 74, weight: 190, age: 36, bats: 'R', throws: 'R', skin: '#9b5f39', espn: 33618, mlb: 628452, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 5, movement: 8, breaking: 2, changeup: 8, control: 7, command: 10, stamina: 4, groundball: 2, composure: 9, pitchIQ: 10 } },
  { name: 'Dylan Lee', short: 'Lee', team: 'ATL', number: 52, height: 75, weight: 214, age: 32, bats: 'L', throws: 'L', skin: '#cd906b', espn: 41455, mlb: 669276, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 4, movement: 5, breaking: 9, changeup: 7, control: 8, command: 5, stamina: 4, groundball: 2, composure: 6, pitchIQ: 4 } },

  // ─── BAL ────────────────────────────────────────────────────────────
  { name: 'Trevor Rogers', short: 'Rogers', team: 'BAL', number: 28, height: 77, weight: 230, age: 28, bats: 'L', throws: 'L', skin: '#c8907a', espn: 39640, mlb: 669432, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 8, breaking: 6, changeup: 2, control: 10, command: 10, stamina: 9, groundball: 4, composure: 6, pitchIQ: 9 } },
  { name: 'Brandon Young', short: 'Young', team: 'BAL', number: 63, height: 78, weight: 230, age: 28, bats: 'R', throws: 'R', skin: '#bf8671', espn: 4414339, mlb: 687064, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 5, breaking: 6, changeup: 2, control: 4, command: 7, stamina: 8, groundball: 5, composure: 4, pitchIQ: 8 } },
  { name: 'Kyle Bradish', short: 'Bradish', team: 'BAL', number: 38, height: 75, weight: 215, age: 30, bats: 'R', throws: 'R', skin: '#cc9680', espn: 4311625, mlb: 680694, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 9, breaking: 5, changeup: 1, control: 3, command: 0, stamina: 7, groundball: 6, composure: 3, pitchIQ: 6 } },
  { name: 'Shane Baz', short: 'Baz', team: 'BAL', number: 34, height: 75, weight: 200, age: 27, bats: 'R', throws: 'R', skin: '#ca8f75', espn: 39639, mlb: 669358, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 7, movement: 5, breaking: 3, changeup: 1, control: 6, command: 5, stamina: 10, groundball: 5, composure: 4, pitchIQ: 5 } },
  { name: 'Andrew Kittredge', short: 'Kittredge', team: 'BAL', number: 39, height: 73, weight: 235, age: 36, bats: 'R', throws: 'R', skin: '#c18e76', espn: 35872, mlb: 552640, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 5, movement: 5, breaking: 6, changeup: 1, control: 8, command: 7, stamina: 3, groundball: 6, composure: 5, pitchIQ: 9 } },
  { name: 'Rico Garcia', short: 'Garcia', team: 'BAL', number: 50, height: 69, weight: 215, age: 32, bats: 'R', throws: 'R', skin: '#bc8364', espn: 41382, mlb: 670329, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 6, movement: 5, breaking: 6, changeup: 10, control: 6, command: 8, stamina: 3, groundball: 5, composure: 8, pitchIQ: 4 } },

  // ─── BOS ────────────────────────────────────────────────────────────
  { name: 'Ranger Suarez', short: 'Suarez', team: 'BOS', number: 55, height: 73, weight: 217, age: 31, bats: 'L', throws: 'L', skin: '#bf7850', espn: 39817, mlb: 624133, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 1, movement: 6, breaking: 8, changeup: 5, control: 6, command: 11, stamina: 9, groundball: 6, composure: 8, pitchIQ: 11 } },
  { name: 'Garrett Crochet', short: 'Crochet', team: 'BOS', number: 35, height: 78, weight: 245, age: 27, bats: 'L', throws: 'L', skin: '#cc907a', espn: 4297835, mlb: 676979, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 7, movement: 5, breaking: 7, changeup: 7, control: 8, command: 6, stamina: 7, groundball: 7, composure: 7, pitchIQ: 6 } },
  { name: 'Jake Bennett', short: 'Bennett', team: 'BOS', number: 64, height: 78, weight: 234, age: 25, bats: 'L', throws: 'L', skin: '#ca8d75', espn: 4654024, mlb: 687562, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 3, movement: 8, breaking: 4, changeup: 7, control: 9, command: 8, stamina: 7, groundball: 6, composure: 5, pitchIQ: 8 } },
  { name: 'Payton Tolle', short: 'Tolle', team: 'BOS', number: 70, height: 78, weight: 250, age: 24, bats: 'L', throws: 'L', skin: '#c0805e', espn: 4966140, mlb: 801139, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 7, movement: 5, breaking: 7, changeup: 1, control: 9, command: 7, stamina: 7, groundball: 3, composure: 7, pitchIQ: 6 } },
  { name: 'Sonny Gray', short: 'Gray', team: 'BOS', number: 54, height: 70, weight: 190, age: 37, bats: 'R', throws: 'R', skin: '#d59472', espn: 32082, mlb: 543243, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 2, movement: 9, breaking: 9, changeup: 3, control: 8, command: 7, stamina: 10, groundball: 7, composure: 7, pitchIQ: 11 } },
  { name: 'Aroldis Chapman', short: 'Chapman', team: 'BOS', number: 44, height: 76, weight: 235, age: 38, bats: 'L', throws: 'L', skin: '#8a5038', espn: 30442, mlb: 547973, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 9, movement: 10, breaking: 8, changeup: 8, control: 5, command: 7, stamina: 3, groundball: 6, composure: 10, pitchIQ: 5 } },
  { name: 'Garrett Whitlock', short: 'Whitlock', team: 'BOS', number: 22, height: 77, weight: 222, age: 30, bats: 'R', throws: 'R', skin: '#c78a68', espn: 39674, mlb: 676477, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 6, movement: 11, breaking: 8, changeup: 6, control: 8, command: 9, stamina: 4, groundball: 5, composure: 9, pitchIQ: 7 } },

  // ─── CHC ────────────────────────────────────────────────────────────
  { name: 'Kevin Gausman', short: 'Gausman', team: 'CHC', number: 12, height: 74, weight: 205, age: 35, bats: 'L', throws: 'R', skin: '#ab7b63', espn: 32667, mlb: 592332, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 8, breaking: 1, changeup: 9, control: 7, command: 8, stamina: 10, groundball: 4, composure: 7, pitchIQ: 4 } },
  { name: 'David Peterson', short: 'Peterson', team: 'CHC', number: 19, height: 78, weight: 240, age: 31, bats: 'L', throws: 'L', skin: '#ba7f76', espn: 40921, mlb: 656849, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 2, movement: 3, breaking: 6, changeup: 2, control: 4, command: 9, stamina: 8, groundball: 9, composure: 3, pitchIQ: 7 } },
  { name: 'Matthew Boyd', short: 'Boyd', team: 'CHC', number: 16, height: 75, weight: 223, age: 35, bats: 'L', throws: 'L', skin: '#c08c76', espn: 34401, mlb: 571510, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 3, movement: 5, breaking: 6, changeup: 7, control: 8, command: 7, stamina: 9, groundball: 5, composure: 4, pitchIQ: 5 } },
  { name: 'Shota Imanaga', short: 'Imanaga', team: 'CHC', number: 18, height: 70, weight: 175, age: 33, bats: 'L', throws: 'L', skin: '#b47b5c', espn: 5134630, mlb: 684007, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 1, movement: 4, breaking: 3, changeup: 10, control: 9, command: 7, stamina: 9, groundball: 2, composure: 4, pitchIQ: 4 } },
  { name: 'Jacob Webb', short: 'Webb', team: 'CHC', number: 71, height: 74, weight: 210, age: 33, bats: 'R', throws: 'R', skin: '#b68976', espn: 40384, mlb: 657097, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 4, movement: 3, breaking: 3, changeup: 9, control: 6, command: 8, stamina: 4, groundball: 3, composure: 6, pitchIQ: 4 } },
  { name: 'Ryan Zeferjahn', short: 'Zeferjahn', team: 'CHC', number: 56, height: 77, weight: 209, age: 28, bats: 'R', throws: 'R', skin: '#ce9881', espn: 4722057, mlb: 666171, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 8, movement: 5, breaking: 8, changeup: 1, control: 1, command: 2, stamina: 4, groundball: 5, composure: 5, pitchIQ: 3 } },

  // ─── CHW ────────────────────────────────────────────────────────────
  { name: 'Sean Burke', short: 'Burke', team: 'CHW', number: 59, height: 78, weight: 240, age: 26, bats: 'R', throws: 'R', skin: '#c29a86', espn: 4867679, mlb: 680732, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 6, breaking: 4, changeup: 2, control: 5, command: 5, stamina: 9, groundball: 2, composure: 8, pitchIQ: 7 } },
  { name: 'Anthony Kay', short: 'Kay', team: 'CHW', number: 18, height: 72, weight: 225, age: 31, bats: 'L', throws: 'L', skin: '#c48f79', espn: 40947, mlb: 641743, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 6, movement: 3, breaking: 4, changeup: 5, control: 5, command: 5, stamina: 8, groundball: 6, composure: 3, pitchIQ: 10 } },
  { name: 'Davis Martin', short: 'Martin', team: 'CHW', number: 65, height: 74, weight: 215, age: 29, bats: 'L', throws: 'R', skin: '#bb866f', espn: 42823, mlb: 663436, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 4, breaking: 6, changeup: 2, control: 6, command: 2, stamina: 8, groundball: 6, composure: 5, pitchIQ: 7 } },
  { name: 'Luis Castillo', short: 'Castillo', team: 'CHW', number: 58, height: 74, weight: 200, age: 33, bats: 'R', throws: 'R', skin: '#bc866e', espn: 35124, mlb: 622491, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 6, movement: 3, breaking: 2, changeup: 1, control: 7, command: 8, stamina: 8, groundball: 3, composure: 4, pitchIQ: 2 } },
  { name: 'Grant Taylor', short: 'Taylor', team: 'CHW', number: 31, height: 75, weight: 230, age: 24, bats: 'R', throws: 'R', skin: '#c38f80', espn: 4927630, mlb: 691799, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 10, movement: 10, breaking: 8, changeup: 1, control: 5, command: 5, stamina: 5, groundball: 7, composure: 9, pitchIQ: 9 } },
  { name: 'Jordan Hicks', short: 'Hicks', team: 'CHW', number: 44, height: 74, weight: 217, age: 30, bats: 'R', throws: 'R', skin: '#b47b5c', espn: 37909, mlb: 663855, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 10, movement: 4, breaking: 7, changeup: 5, control: 1, command: 7, stamina: 4, groundball: 8, composure: 2, pitchIQ: 4 } },

  // ─── CIN ────────────────────────────────────────────────────────────
  { name: 'Chase Burns', short: 'Burns', team: 'CIN', number: 26, height: 75, weight: 210, age: 23, bats: 'R', throws: 'R', skin: '#b88565', espn: 4927516, mlb: 695505, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 9, movement: 4, breaking: 11, changeup: 2, control: 4, command: 3, stamina: 7, groundball: 3, composure: 7, pitchIQ: 2 } },
  { name: 'Andrew Abbott', short: 'Abbott', team: 'CIN', number: 41, height: 72, weight: 192, age: 27, bats: 'L', throws: 'L', skin: '#c29278', espn: 4414528, mlb: 671096, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 3, movement: 3, breaking: 4, changeup: 6, control: 5, command: 7, stamina: 9, groundball: 3, composure: 4, pitchIQ: 5 } },
  { name: 'Brady Singer', short: 'Singer', team: 'CIN', number: 51, height: 77, weight: 215, age: 30, bats: 'R', throws: 'R', skin: '#c29278', espn: 41172, mlb: 663903, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 1, movement: 3, breaking: 4, changeup: 1, control: 5, command: 5, stamina: 9, groundball: 4, composure: 1, pitchIQ: 3 } },
  { name: 'Rhett Lowder', short: 'Lowder', team: 'CIN', number: 25, height: 73, weight: 200, age: 24, bats: 'R', throws: 'R', skin: '#b4856b', espn: 4758873, mlb: 695076, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 5, breaking: 1, changeup: 2, control: 5, command: 3, stamina: 7, groundball: 5, composure: 2, pitchIQ: 5 } },
  { name: 'Emilio Pagán', short: 'Pagán', team: 'CIN', number: 15, height: 74, weight: 208, age: 35, bats: 'L', throws: 'R', skin: '#bb866f', espn: 33403, mlb: 641941, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 6, movement: 5, breaking: 3, changeup: 6, control: 6, command: 5, stamina: 3, groundball: 0, composure: 8, pitchIQ: 1 } },
  { name: 'Brock Burke', short: 'Burke', team: 'CIN', number: 49, height: 76, weight: 210, age: 30, bats: 'L', throws: 'L', skin: '#bd8c72', espn: 39945, mlb: 656271, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 7, movement: 5, breaking: 6, changeup: 4, control: 3, command: 3, stamina: 4, groundball: 6, composure: 7, pitchIQ: 3 } },

  // ─── CLE ────────────────────────────────────────────────────────────
  { name: 'Parker Messick', short: 'Messick', team: 'CLE', number: 77, height: 72, weight: 225, age: 26, bats: 'L', throws: 'L', skin: '#c59681', espn: 4619898, mlb: 800048, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 10, breaking: 2, changeup: 7, control: 7, command: 7, stamina: 8, groundball: 6, composure: 7, pitchIQ: 7 } },
  { name: 'Foster Griffin', short: 'Griffin', team: 'CLE', number: 22, height: 75, weight: 225, age: 31, bats: 'R', throws: 'L', skin: '#93685d', espn: 33773, mlb: 656492, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 1, movement: 7, breaking: 4, changeup: 7, control: 8, command: 4, stamina: 10, groundball: 6, composure: 6, pitchIQ: 11 } },
  { name: 'Gavin Williams', short: 'Williams', team: 'CLE', number: 32, height: 78, weight: 250, age: 27, bats: 'L', throws: 'R', skin: '#b98c7c', espn: 4345076, mlb: 668909, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 8, movement: 4, breaking: 10, changeup: 1, control: 4, command: 1, stamina: 10, groundball: 6, composure: 8, pitchIQ: 8 } },
  { name: 'Tanner Bibee', short: 'Bibee', team: 'CLE', number: 28, height: 74, weight: 205, age: 27, bats: 'R', throws: 'R', skin: '#b68976', espn: 4345278, mlb: 676440, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 6, breaking: 3, changeup: 6, control: 7, command: 6, stamina: 11, groundball: 4, composure: 4, pitchIQ: 7 } },
  { name: 'Cade Smith', short: 'Smith', team: 'CLE', number: 36, height: 77, weight: 230, age: 27, bats: 'R', throws: 'R', skin: '#ce9c87', espn: 4987924, mlb: 671922, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 8, movement: 6, breaking: 3, changeup: 10, control: 7, command: 7, stamina: 5, groundball: 4, composure: 11, pitchIQ: 4 } },
  { name: 'Erik Sabrowski', short: 'Sabrowski', team: 'CLE', number: 62, height: 76, weight: 230, age: 29, bats: 'R', throws: 'L', skin: '#c9a394', espn: 5194333, mlb: 681870, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 4, movement: 5, breaking: 9, changeup: 1, control: 0, command: 1, stamina: 2, groundball: 0, composure: 9, pitchIQ: 2 } },

  // ─── COL ────────────────────────────────────────────────────────────
  { name: 'Kyle Freeland', short: 'Freeland', team: 'COL', number: 21, height: 76, weight: 202, age: 33, bats: 'L', throws: 'L', skin: '#bf8671', espn: 33839, mlb: 607536, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 1, movement: 1, breaking: 5, changeup: 2, control: 10, command: 5, stamina: 8, groundball: 4, composure: 1, pitchIQ: 10 } },
  { name: 'Ryan Feltner', short: 'Feltner', team: 'COL', number: 18, height: 76, weight: 200, age: 30, bats: 'R', throws: 'R', skin: '#bd8c75', espn: 4019484, mlb: 663372, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 4, breaking: 4, changeup: 9, control: 5, command: 4, stamina: 6, groundball: 5, composure: 3, pitchIQ: 4 } },
  { name: 'Tanner Gordon', short: 'Gordon', team: 'COL', number: 29, height: 77, weight: 220, age: 29, bats: 'L', throws: 'R', skin: '#c38f80', espn: 4415658, mlb: 685299, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 3, movement: 1, breaking: 0, changeup: 4, control: 11, command: 6, stamina: 6, groundball: 1, composure: 0, pitchIQ: 3 } },
  { name: 'Tomoyuki Sugano', short: 'Sugano', team: 'COL', number: 11, height: 73, weight: 227, age: 37, bats: 'R', throws: 'R', skin: '#d09378', espn: 4142423, mlb: 608372, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 3, movement: 4, breaking: 1, changeup: 6, control: 9, command: 2, stamina: 8, groundball: 3, composure: 2, pitchIQ: 7 } },
  { name: 'Jordan Romano', short: 'Romano', team: 'COL', number: 68, height: 77, weight: 210, age: 33, bats: 'R', throws: 'R', skin: '#bd866b', espn: 36380, mlb: 605447, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 5, movement: 4, breaking: 4, changeup: 1, control: 3, command: 3, stamina: 1, groundball: 2, composure: 3, pitchIQ: 3 } },
  { name: 'Brennan Bernardino', short: 'Bernardino', team: 'COL', number: 83, height: 76, weight: 216, age: 34, bats: 'L', throws: 'L', skin: '#a57157', espn: 35876, mlb: 657514, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 1, movement: 9, breaking: 6, changeup: 5, control: 6, command: 4, stamina: 4, groundball: 7, composure: 6, pitchIQ: 3 } },

  // ─── DET ────────────────────────────────────────────────────────────
  { name: 'Framber Valdez', short: 'Valdez', team: 'DET', number: 59, height: 71, weight: 230, age: 32, bats: 'R', throws: 'L', skin: '#9e6747', espn: 36581, mlb: 664285, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 7, breaking: 7, changeup: 3, control: 5, command: 8, stamina: 10, groundball: 11, composure: 6, pitchIQ: 6 } },
  { name: 'Jack Flaherty', short: 'Flaherty', team: 'DET', number: 9, height: 76, weight: 225, age: 31, bats: 'R', throws: 'R', skin: '#cd987c', espn: 33837, mlb: 656427, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 3, movement: 5, breaking: 6, changeup: 1, control: 3, command: 7, stamina: 7, groundball: 1, composure: 5, pitchIQ: 3 } },
  { name: 'Keider Montero', short: 'Montero', team: 'DET', number: 54, height: 73, weight: 145, age: 26, bats: 'R', throws: 'R', skin: '#b77b5a', espn: 5182933, mlb: 672456, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 8, breaking: 4, changeup: 5, control: 9, command: 6, stamina: 7, groundball: 4, composure: 8, pitchIQ: 7 } },
  { name: 'Troy Melton', short: 'Melton', team: 'DET', number: 52, height: 76, weight: 210, age: 25, bats: 'R', throws: 'R', skin: '#dead92', espn: 5294127, mlb: 675512, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 7, movement: 7, breaking: 5, changeup: 4, control: 6, command: 5, stamina: 6, groundball: 5, composure: 8, pitchIQ: 6 } },
  { name: 'Kenley Jansen', short: 'Jansen', team: 'DET', number: 74, height: 77, weight: 265, age: 39, bats: 'S', throws: 'R', skin: '#9b664b', espn: 29630, mlb: 445276, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 3, movement: 11, breaking: 7, changeup: 1, control: 4, command: 5, stamina: 3, groundball: 0, composure: 8, pitchIQ: 0 } },
  { name: 'Tyler Holton', short: 'Holton', team: 'DET', number: 87, height: 74, weight: 200, age: 30, bats: 'L', throws: 'L', skin: '#ce9881', espn: 3983833, mlb: 663947, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 2, movement: 7, breaking: 7, changeup: 4, control: 8, command: 4, stamina: 5, groundball: 8, composure: 5, pitchIQ: 8 } },

  // ─── HOU ────────────────────────────────────────────────────────────
  { name: 'Hunter Brown', short: 'Brown', team: 'HOU', number: 58, height: 74, weight: 220, age: 28, bats: 'R', throws: 'R', skin: '#bc7e69', espn: 4717803, mlb: 686613, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 7, movement: 7, breaking: 6, changeup: 5, control: 3, command: 6, stamina: 8, groundball: 9, composure: 7, pitchIQ: 7 } },
  { name: 'Hayden Wesneski', short: 'Wesneski', team: 'HOU', number: 39, height: 75, weight: 210, age: 28, bats: 'R', throws: 'R', skin: '#c28871', espn: 42996, mlb: 669713, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 3, breaking: 7, changeup: 7, control: 6, command: 2, stamina: 6, groundball: 6, composure: 6, pitchIQ: 8 } },
  { name: 'Peter Lambert', short: 'Lambert', team: 'HOU', number: 38, height: 74, weight: 208, age: 29, bats: 'R', throws: 'R', skin: '#c48067', espn: 39898, mlb: 663567, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 4, breaking: 5, changeup: 5, control: 4, command: 7, stamina: 9, groundball: 3, composure: 5, pitchIQ: 8 } },
  { name: 'Tatsuya Imai', short: 'Imai', team: 'HOU', number: 45, height: 71, weight: 176, age: 28, bats: 'R', throws: 'R', skin: '#b27355', espn: 5330833, mlb: 837227, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 4, breaking: 7, changeup: 1, control: 0, command: 2, stamina: 5, groundball: 5, composure: 5, pitchIQ: 1 } },
  { name: 'Josh Hader', short: 'Hader', team: 'HOU', number: 71, height: 75, weight: 188, age: 32, bats: 'L', throws: 'L', skin: '#bc8364', espn: 32760, mlb: 623352, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 6, movement: 11, breaking: 10, changeup: 1, control: 5, command: 9, stamina: 3, groundball: 1, composure: 11, pitchIQ: 5 } },
  { name: 'Steven Okert', short: 'Okert', team: 'HOU', number: 48, height: 74, weight: 202, age: 35, bats: 'L', throws: 'L', skin: '#c1835f', espn: 33716, mlb: 595345, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 2, movement: 3, breaking: 8, changeup: 1, control: 9, command: 6, stamina: 5, groundball: 0, composure: 9, pitchIQ: 1 } },

  // ─── KC ────────────────────────────────────────────────────────────
  { name: 'Michael Wacha', short: 'Wacha', team: 'KC', number: 52, height: 78, weight: 215, age: 35, bats: 'R', throws: 'R', skin: '#c29278', espn: 32640, mlb: 608379, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 3, movement: 6, breaking: 3, changeup: 7, control: 9, command: 5, stamina: 11, groundball: 2, composure: 6, pitchIQ: 7 } },
  { name: 'Noah Cameron', short: 'Cameron', team: 'KC', number: 65, height: 75, weight: 220, age: 27, bats: 'L', throws: 'L', skin: '#c38f80', espn: 4417208, mlb: 702070, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 3, movement: 4, breaking: 6, changeup: 7, control: 6, command: 4, stamina: 9, groundball: 4, composure: 6, pitchIQ: 6 } },
  { name: 'Seth Lugo', short: 'Lugo', team: 'KC', number: 67, height: 76, weight: 225, age: 36, bats: 'R', throws: 'R', skin: '#d09c8f', espn: 34873, mlb: 607625, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 2, movement: 2, breaking: 2, changeup: 1, control: 7, command: 4, stamina: 9, groundball: 4, composure: 2, pitchIQ: 8 } },
  { name: 'Stephen Kolek', short: 'Kolek', team: 'KC', number: 32, height: 75, weight: 210, age: 29, bats: 'R', throws: 'R', skin: '#ce9c87', espn: 5190073, mlb: 663568, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 5, breaking: 5, changeup: 5, control: 9, command: 8, stamina: 6, groundball: 8, composure: 5, pitchIQ: 6 } },
  { name: 'Lucas Erceg', short: 'Erceg', team: 'KC', number: 60, height: 74, weight: 214, age: 31, bats: 'L', throws: 'R', skin: '#c58f83', espn: 36618, mlb: 668674, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 8, movement: 5, breaking: 3, changeup: 1, control: 2, command: 3, stamina: 3, groundball: 8, composure: 4, pitchIQ: 3 } },
  { name: 'Steven Cruz', short: 'Cruz', team: 'KC', number: 64, height: 79, weight: 225, age: 27, bats: 'R', throws: 'R', skin: '#c18973', espn: 5002931, mlb: 674444, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 9, movement: 5, breaking: 4, changeup: 1, control: 6, command: 2, stamina: 4, groundball: 6, composure: 5, pitchIQ: 0 } },

  // ─── LAA ────────────────────────────────────────────────────────────
  { name: 'Reid Detmers', short: 'Detmers', team: 'LAA', number: 48, height: 74, weight: 210, age: 27, bats: 'L', throws: 'L', skin: '#d69f84', espn: 4326697, mlb: 672282, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 4, breaking: 9, changeup: 6, control: 8, command: 6, stamina: 7, groundball: 4, composure: 8, pitchIQ: 6 } },
  { name: 'Grayson Rodriguez', short: 'Rodriguez', team: 'LAA', number: 21, height: 77, weight: 230, age: 26, bats: 'L', throws: 'R', skin: '#cc907a', espn: 41196, mlb: 680570, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 7, movement: 1, breaking: 2, changeup: 6, control: 5, command: 4, stamina: 7, groundball: 4, composure: 1, pitchIQ: 3 } },
  { name: 'Walbert Ureña', short: 'Ureña', team: 'LAA', number: 57, height: 72, weight: 210, age: 22, bats: 'R', throws: 'R', skin: '#b26f47', espn: 5197476, mlb: 700712, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 9, movement: 3, breaking: 5, changeup: 10, control: 2, command: 7, stamina: 8, groundball: 10, composure: 6, pitchIQ: 6 } },
  { name: 'Yusei Kikuchi', short: 'Kikuchi', team: 'LAA', number: 16, height: 72, weight: 210, age: 35, bats: 'L', throws: 'L', skin: '#cc9272', espn: 41415, mlb: 579328, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 1, breaking: 4, changeup: 6, control: 5, command: 5, stamina: 7, groundball: 5, composure: 3, pitchIQ: 2 } },
  { name: 'Ben Joyce', short: 'Joyce', team: 'LAA', number: 44, height: 77, weight: 225, age: 26, bats: 'R', throws: 'R', skin: '#d59d84', espn: 4867388, mlb: 690829, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 11, movement: 4, breaking: 1, changeup: 1, control: 3, command: 3, stamina: 0, groundball: 3, composure: 6, pitchIQ: 1 } },
  { name: 'Ryan Watson', short: 'Watson', team: 'LAA', number: 56, height: 77, weight: 225, age: 28, bats: 'R', throws: 'R', skin: '#c48a6f', espn: 5125911, mlb: 670245, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 5, movement: 2, breaking: 8, changeup: 1, control: 6, command: 4, stamina: 5, groundball: 4, composure: 6, pitchIQ: 9 } },

  // ─── LAD ────────────────────────────────────────────────────────────
  { name: 'Tarik Skubal', short: 'Skubal', team: 'LAD', number: 29, height: 75, weight: 240, age: 29, bats: 'R', throws: 'L', skin: '#c59681', espn: 42409, mlb: 669373, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 8, movement: 10, breaking: 6, changeup: 11, control: 11, command: 9, stamina: 10, groundball: 6, composure: 10, pitchIQ: 9 } },
  { name: 'Justin Wrobleski', short: 'Wrobleski', team: 'LAD', number: 70, height: 73, weight: 194, age: 26, bats: 'L', throws: 'L', skin: '#c58a7a', espn: 4417203, mlb: 680736, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 7, breaking: 2, changeup: 4, control: 10, command: 3, stamina: 7, groundball: 6, composure: 6, pitchIQ: 8 } },
  { name: 'Shohei Ohtani', short: 'Ohtani', team: 'LAD', number: 17, height: 76, weight: 210, age: 32, bats: 'L', throws: 'R', skin: '#c58e72', espn: 39832, mlb: 660271, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 9, movement: 9, breaking: 10, changeup: 4, control: 7, command: 6, stamina: 6, groundball: 8, composure: 9, pitchIQ: 6 } },
  { name: 'Yoshinobu Yamamoto', short: 'Yamamoto', team: 'LAD', number: 18, height: 70, weight: 176, age: 28, bats: 'R', throws: 'R', skin: '#c4856a', espn: 4872587, mlb: 808967, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 6, movement: 9, breaking: 7, changeup: 9, control: 7, command: 10, stamina: 11, groundball: 8, composure: 10, pitchIQ: 10 } },
  { name: 'Tanner Scott', short: 'Scott', team: 'LAD', number: 66, height: 72, weight: 235, age: 32, bats: 'R', throws: 'L', skin: '#bb866f', espn: 35135, mlb: 656945, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 7, movement: 3, breaking: 9, changeup: 1, control: 8, command: 9, stamina: 4, groundball: 4, composure: 8, pitchIQ: 4 } },
  { name: 'Alex Vesia', short: 'Vesia', team: 'LAD', number: 51, height: 73, weight: 209, age: 30, bats: 'L', throws: 'L', skin: '#b68470', espn: 42622, mlb: 681911, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 3, movement: 4, breaking: 8, changeup: 7, control: 2, command: 3, stamina: 3, groundball: 1, composure: 10, pitchIQ: 3 } },

  // ─── MIA ────────────────────────────────────────────────────────────
  { name: 'Sandy Alcantara', short: 'Alcantara', team: 'MIA', number: 22, height: 77, weight: 200, age: 31, bats: 'R', throws: 'R', skin: '#9f674d', espn: 35241, mlb: 645261, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 9, movement: 7, breaking: 4, changeup: 4, control: 8, command: 8, stamina: 11, groundball: 6, composure: 5, pitchIQ: 9 } },
  { name: 'Eury Pérez', short: 'Pérez', team: 'MIA', number: 39, height: 80, weight: 220, age: 23, bats: 'R', throws: 'R', skin: '#9f694e', espn: 4917854, mlb: 691587, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 9, movement: 6, breaking: 9, changeup: 6, control: 3, command: 1, stamina: 8, groundball: 3, composure: 5, pitchIQ: 4 } },
  { name: 'Janson Junk', short: 'Junk', team: 'MIA', number: 26, height: 74, weight: 197, age: 30, bats: 'R', throws: 'R', skin: '#b0887e', espn: 4881980, mlb: 676083, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 5, breaking: 2, changeup: 3, control: 11, command: 6, stamina: 7, groundball: 5, composure: 4, pitchIQ: 7 } },
  { name: 'Max Meyer', short: 'Meyer', team: 'MIA', number: 23, height: 72, weight: 196, age: 27, bats: 'L', throws: 'R', skin: '#c58a7a', espn: 4345164, mlb: 676974, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 1, breaking: 9, changeup: 5, control: 5, command: 3, stamina: 7, groundball: 6, composure: 6, pitchIQ: 8 } },
  { name: 'Pete Fairbanks', short: 'Fairbanks', team: 'MIA', number: 29, height: 78, weight: 235, age: 32, bats: 'R', throws: 'R', skin: '#bf8c78', espn: 42180, mlb: 664126, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 8, movement: 5, breaking: 7, changeup: 1, control: 4, command: 5, stamina: 3, groundball: 1, composure: 6, pitchIQ: 5 } },
  { name: 'Michael Petersen', short: 'Petersen', team: 'MIA', number: 49, height: 79, weight: 195, age: 32, bats: 'R', throws: 'R', skin: '#a06a54', espn: 41824, mlb: 656848, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 9, movement: 6, breaking: 5, changeup: 4, control: 3, command: 2, stamina: 3, groundball: 2, composure: 8, pitchIQ: 2 } },

  // ─── MIL ────────────────────────────────────────────────────────────
  { name: 'Jacob Misiorowski', short: 'Misiorowski', team: 'MIL', number: 32, height: 79, weight: 201, age: 24, bats: 'R', throws: 'R', skin: '#b28376', espn: 5080761, mlb: 694819, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 11, movement: 8, breaking: 9, changeup: 1, control: 7, command: 8, stamina: 8, groundball: 5, composure: 11, pitchIQ: 6 } },
  { name: 'Dustin May', short: 'May', team: 'MIL', number: 21, height: 78, weight: 180, age: 29, bats: 'R', throws: 'R', skin: '#c0886e', espn: 40937, mlb: 669160, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 7, movement: 4, breaking: 4, changeup: 1, control: 5, command: 5, stamina: 8, groundball: 5, composure: 2, pitchIQ: 8 } },
  { name: 'Logan Henderson', short: 'Henderson', team: 'MIL', number: 43, height: 72, weight: 209, age: 24, bats: 'R', throws: 'R', skin: '#b98c7c', espn: 4917878, mlb: 701656, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 3, movement: 8, breaking: 0, changeup: 8, control: 10, command: 4, stamina: 6, groundball: 1, composure: 7, pitchIQ: 4 } },
  { name: 'Shane Drohan', short: 'Drohan', team: 'MIL', number: 55, height: 74, weight: 202, age: 27, bats: 'L', throws: 'L', skin: '#bd7e71', espn: 4315203, mlb: 675660, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 5, breaking: 8, changeup: 4, control: 5, command: 4, stamina: 6, groundball: 5, composure: 1, pitchIQ: 10 } },
  { name: 'Trevor Megill', short: 'Megill', team: 'MIL', number: 29, height: 80, weight: 253, age: 32, bats: 'L', throws: 'R', skin: '#b28376', espn: 40080, mlb: 656730, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 9, movement: 7, breaking: 10, changeup: 1, control: 7, command: 3, stamina: 4, groundball: 3, composure: 11, pitchIQ: 5 } },
  { name: 'Abner Uribe', short: 'Uribe', team: 'MIL', number: 45, height: 75, weight: 205, age: 26, bats: 'R', throws: 'R', skin: '#815341', espn: 4917865, mlb: 682842, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 10, movement: 9, breaking: 9, changeup: 1, control: 6, command: 4, stamina: 4, groundball: 9, composure: 11, pitchIQ: 3 } },

  // ─── MIN ────────────────────────────────────────────────────────────
  { name: 'Joe Ryan', short: 'Ryan', team: 'MIN', number: 41, height: 74, weight: 205, age: 30, bats: 'R', throws: 'R', skin: '#c27f5c', espn: 42450, mlb: 657746, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 6, breaking: 7, changeup: 3, control: 10, command: 6, stamina: 8, groundball: 2, composure: 6, pitchIQ: 7 } },
  { name: 'Bailey Ober', short: 'Ober', team: 'MIN', number: 17, height: 81, weight: 260, age: 31, bats: 'R', throws: 'R', skin: '#be7f5d', espn: 3107919, mlb: 641927, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 0, movement: 3, breaking: 8, changeup: 2, control: 9, command: 3, stamina: 8, groundball: 1, composure: 2, pitchIQ: 6 } },
  { name: 'Connor Prielipp', short: 'Prielipp', team: 'MIN', number: 61, height: 74, weight: 210, age: 25, bats: 'L', throws: 'L', skin: '#cc907a', espn: 4620001, mlb: 687570, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 6, movement: 2, breaking: 7, changeup: 3, control: 6, command: 4, stamina: 7, groundball: 5, composure: 4, pitchIQ: 8 } },
  { name: 'Taj Bradley', short: 'Bradley', team: 'MIN', number: 26, height: 74, weight: 220, age: 25, bats: 'R', throws: 'R', skin: '#b26f47', espn: 42480, mlb: 671737, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 8, movement: 6, breaking: 5, changeup: 5, control: 4, command: 2, stamina: 9, groundball: 3, composure: 5, pitchIQ: 3 } },
  { name: 'Yoendrys Gómez', short: 'Gómez', team: 'MIN', number: 94, height: 75, weight: 212, age: 27, bats: 'R', throws: 'R', skin: '#b57852', espn: 42898, mlb: 672782, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 6, movement: 4, breaking: 6, changeup: 2, control: 2, command: 3, stamina: 5, groundball: 1, composure: 6, pitchIQ: 3 } },
  { name: 'Jeff Hoffman', short: 'Hoffman', team: 'MIN', number: 24, height: 77, weight: 235, age: 33, bats: 'R', throws: 'R', skin: '#be8968', espn: 33841, mlb: 656546, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 7, movement: 6, breaking: 10, changeup: 5, control: 3, command: 3, stamina: 4, groundball: 5, composure: 7, pitchIQ: 8 } },

  // ─── NYM ────────────────────────────────────────────────────────────
  { name: 'Nolan McLean', short: 'McLean', team: 'NYM', number: 26, height: 74, weight: 214, age: 25, bats: 'R', throws: 'R', skin: '#ce9b86', espn: 4433874, mlb: 690997, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 7, movement: 9, breaking: 7, changeup: 4, control: 4, command: 7, stamina: 8, groundball: 7, composure: 6, pitchIQ: 10 } },
  { name: 'Christian Scott', short: 'Scott', team: 'NYM', number: 45, height: 76, weight: 215, age: 27, bats: 'R', throws: 'R', skin: '#bd847f', espn: 4414215, mlb: 681035, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 6, movement: 5, breaking: 5, changeup: 3, control: 4, command: 7, stamina: 7, groundball: 1, composure: 5, pitchIQ: 4 } },
  { name: 'Sean Manaea', short: 'Manaea', team: 'NYM', number: 59, height: 77, weight: 245, age: 34, bats: 'R', throws: 'L', skin: '#a06a54', espn: 33244, mlb: 640455, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 1, movement: 4, breaking: 2, changeup: 0, control: 9, command: 2, stamina: 7, groundball: 4, composure: 2, pitchIQ: 5 } },
  { name: 'Zac Thornton', short: 'Thornton', team: 'NYM', number: 49, height: 75, weight: 170, age: 24, bats: 'L', throws: 'L', skin: null, espn: 5129576, mlb: 804267, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 3, movement: 6, breaking: 3, changeup: 1, control: 9, command: 3, stamina: 7, groundball: 4, composure: 6, pitchIQ: 8 } },
  { name: 'Devin Williams', short: 'Williams', team: 'NYM', number: 38, height: 74, weight: 193, age: 32, bats: 'R', throws: 'R', skin: '#a96d5a', espn: 33224, mlb: 642207, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 4, movement: 7, breaking: 1, changeup: 8, control: 2, command: 10, stamina: 3, groundball: 5, composure: 6, pitchIQ: 3 } },
  { name: 'Nate Lavender', short: 'Lavender', team: 'NYM', number: 94, height: 74, weight: 215, age: 26, bats: 'L', throws: 'L', skin: '#c58a7a', espn: 4424442, mlb: 681320, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 3, movement: 7, breaking: 1, changeup: 1, control: 7, command: 4, stamina: 0, groundball: 3, composure: 8, pitchIQ: 5 } },

  // ─── NYY ────────────────────────────────────────────────────────────
  { name: 'Cam Schlittler', short: 'Schlittler', team: 'NYY', number: 31, height: 78, weight: 215, age: 25, bats: 'R', throws: 'R', skin: '#c59681', espn: 5134581, mlb: 693645, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 9, movement: 9, breaking: 5, changeup: 1, control: 7, command: 3, stamina: 9, groundball: 5, composure: 10, pitchIQ: 5 } },
  { name: 'Max Fried', short: 'Fried', team: 'NYY', number: 54, height: 76, weight: 190, age: 32, bats: 'L', throws: 'L', skin: '#c7927c', espn: 32685, mlb: 608331, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 6, movement: 10, breaking: 7, changeup: 6, control: 7, command: 6, stamina: 8, groundball: 9, composure: 8, pitchIQ: 9 } },
  { name: 'Ryan Weathers', short: 'Weathers', team: 'NYY', number: 40, height: 73, weight: 230, age: 26, bats: 'R', throws: 'L', skin: '#c7927c', espn: 41178, mlb: 677960, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 7, movement: 4, breaking: 7, changeup: 7, control: 7, command: 6, stamina: 7, groundball: 8, composure: 6, pitchIQ: 8 } },
  { name: 'Will Warren', short: 'Warren', team: 'NYY', number: 29, height: 74, weight: 200, age: 27, bats: 'R', throws: 'R', skin: '#cd987c', espn: 5132011, mlb: 701542, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 4, breaking: 2, changeup: 5, control: 5, command: 5, stamina: 8, groundball: 6, composure: 5, pitchIQ: 8 } },
  { name: 'David Bednar', short: 'Bednar', team: 'NYY', number: 53, height: 73, weight: 250, age: 32, bats: 'L', throws: 'R', skin: '#c7927c', espn: 38303, mlb: 670280, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 7, movement: 3, breaking: 6, changeup: 10, control: 6, command: 8, stamina: 4, groundball: 8, composure: 10, pitchIQ: 6 } },
  { name: 'Brent Headrick', short: 'Headrick', team: 'NYY', number: 47, height: 78, weight: 235, age: 28, bats: 'L', throws: 'L', skin: '#ce9b86', espn: 5116839, mlb: 687396, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 4, movement: 6, breaking: 9, changeup: 8, control: 5, command: 6, stamina: 4, groundball: 2, composure: 8, pitchIQ: 5 } },

  // ─── PHI ────────────────────────────────────────────────────────────
  { name: 'Cristopher Sánchez', short: 'Sánchez', team: 'PHI', number: 61, height: 78, weight: 200, age: 29, bats: 'L', throws: 'L', skin: '#b37252', espn: 42359, mlb: 650911, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 6, movement: 11, breaking: 7, changeup: 11, control: 9, command: 7, stamina: 11, groundball: 11, composure: 9, pitchIQ: 6 } },
  { name: 'Aaron Nola', short: 'Nola', team: 'PHI', number: 27, height: 74, weight: 200, age: 33, bats: 'R', throws: 'R', skin: '#c4856a', espn: 33709, mlb: 605400, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 2, movement: 0, breaking: 8, changeup: 5, control: 5, command: 10, stamina: 8, groundball: 5, composure: 1, pitchIQ: 10 } },
  { name: 'Jesús Luzardo', short: 'Luzardo', team: 'PHI', number: 44, height: 72, weight: 218, age: 29, bats: 'L', throws: 'L', skin: '#cd906b', espn: 39667, mlb: 666200, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 7, movement: 6, breaking: 11, changeup: 8, control: 6, command: 8, stamina: 11, groundball: 7, composure: 9, pitchIQ: 9 } },
  { name: 'Zack Wheeler', short: 'Wheeler', team: 'PHI', number: 45, height: 76, weight: 195, age: 36, bats: 'L', throws: 'R', skin: '#ce987c', espn: 31267, mlb: 554430, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 6, movement: 7, breaking: 10, changeup: 10, control: 6, command: 10, stamina: 9, groundball: 5, composure: 8, pitchIQ: 9 } },
  { name: 'Jhoan Duran', short: 'Duran', team: 'PHI', number: 59, height: 77, weight: 230, age: 28, bats: 'R', throws: 'R', skin: '#c1835f', espn: 41109, mlb: 661395, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 11, movement: 10, breaking: 9, changeup: 7, control: 9, command: 5, stamina: 4, groundball: 11, composure: 8, pitchIQ: 4 } },
  { name: 'José Alvarado', short: 'Alvarado', team: 'PHI', number: 46, height: 74, weight: 245, age: 31, bats: 'L', throws: 'L', skin: '#ac6b45', espn: 36063, mlb: 621237, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 9, movement: 5, breaking: 4, changeup: 1, control: 2, command: 3, stamina: 2, groundball: 3, composure: 4, pitchIQ: 0 } },

  // ─── PIT ────────────────────────────────────────────────────────────
  { name: 'Paul Skenes', short: 'Skenes', team: 'PIT', number: 30, height: 78, weight: 260, age: 24, bats: 'R', throws: 'R', skin: '#ca8d75', espn: 4719507, mlb: 694973, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 8, movement: 7, breaking: 7, changeup: 8, control: 7, command: 9, stamina: 10, groundball: 5, composure: 7, pitchIQ: 7 } },
  { name: 'Braxton Ashcraft', short: 'Ashcraft', team: 'PIT', number: 35, height: 77, weight: 218, age: 27, bats: 'L', throws: 'R', skin: '#c48067', espn: 41282, mlb: 677952, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 8, movement: 6, breaking: 10, changeup: 2, control: 10, command: 8, stamina: 7, groundball: 7, composure: 7, pitchIQ: 11 } },
  { name: 'Bubba Chandler', short: 'Chandler', team: 'PIT', number: 36, height: 75, weight: 206, age: 24, bats: 'S', throws: 'R', skin: '#cc907a', espn: 4683325, mlb: 696149, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 10, movement: 2, breaking: 4, changeup: 5, control: 3, command: 7, stamina: 7, groundball: 4, composure: 4, pitchIQ: 4 } },
  { name: 'Jared Jones', short: 'Jones', team: 'PIT', number: 17, height: 72, weight: 211, age: 25, bats: 'L', throws: 'R', skin: '#c0805e', espn: 4918156, mlb: 683003, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 9, movement: 6, breaking: 10, changeup: 5, control: 6, command: 4, stamina: 7, groundball: 3, composure: 6, pitchIQ: 4 } },
  { name: 'Mason Montgomery', short: 'Montgomery', team: 'PIT', number: 46, height: 74, weight: 205, age: 26, bats: 'L', throws: 'L', skin: '#c8907a', espn: 4424112, mlb: 682254, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 10, movement: 8, breaking: 8, changeup: 1, control: 4, command: 2, stamina: 4, groundball: 8, composure: 8, pitchIQ: 4 } },
  { name: 'Luke Weaver', short: 'Weaver', team: 'PIT', number: 18, height: 74, weight: 180, age: 33, bats: 'R', throws: 'R', skin: '#bf8671', espn: 33770, mlb: 596133, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 6, movement: 5, breaking: 2, changeup: 9, control: 7, command: 7, stamina: 4, groundball: 2, composure: 7, pitchIQ: 3 } },

  // ─── SD ────────────────────────────────────────────────────────────
  { name: 'Casey Mize', short: 'Mize', team: 'SD', number: 12, height: 75, weight: 212, age: 29, bats: 'R', throws: 'R', skin: '#ac8673', espn: 41167, mlb: 663554, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 4, breaking: 3, changeup: 4, control: 8, command: 6, stamina: 8, groundball: 2, composure: 5, pitchIQ: 6 } },
  { name: 'Michael King', short: 'King', team: 'SD', number: 34, height: 75, weight: 210, age: 31, bats: 'R', throws: 'R', skin: '#ba816a', espn: 40429, mlb: 650633, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 4, breaking: 5, changeup: 7, control: 4, command: 8, stamina: 8, groundball: 6, composure: 9, pitchIQ: 7 } },
  { name: 'Randy Vásquez', short: 'Vásquez', team: 'SD', number: 98, height: 72, weight: 165, age: 28, bats: 'R', throws: 'R', skin: '#a36948', espn: 4722847, mlb: 681190, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 6, breaking: 1, changeup: 2, control: 8, command: 2, stamina: 7, groundball: 4, composure: 5, pitchIQ: 6 } },
  { name: 'Robbie Ray', short: 'Ray', team: 'SD', number: 38, height: 74, weight: 220, age: 35, bats: 'L', throws: 'L', skin: '#b4856b', espn: 32175, mlb: 592662, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 3, movement: 4, breaking: 6, changeup: 6, control: 2, command: 3, stamina: 9, groundball: 2, composure: 6, pitchIQ: 2 } },
  { name: 'Mason Miller', short: 'Miller', team: 'SD', number: 22, height: 77, weight: 200, age: 28, bats: 'R', throws: 'R', skin: '#c08c76', espn: 4730225, mlb: 695243, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 11, movement: 7, breaking: 11, changeup: 1, control: 3, command: 3, stamina: 5, groundball: 6, composure: 10, pitchIQ: 5 } },
  { name: 'Adrian Morejon', short: 'Morejon', team: 'SD', number: 50, height: 71, weight: 224, age: 27, bats: 'L', throws: 'L', skin: '#c18973', espn: 40917, mlb: 670970, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 10, movement: 9, breaking: 4, changeup: 11, control: 7, command: 5, stamina: 5, groundball: 10, composure: 10, pitchIQ: 9 } },

  // ─── SEA ────────────────────────────────────────────────────────────
  { name: 'Bryan Woo', short: 'Woo', team: 'SEA', number: 22, height: 74, weight: 205, age: 26, bats: 'R', throws: 'R', skin: '#ce9b86', espn: 4629089, mlb: 693433, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 7, movement: 5, breaking: 6, changeup: 5, control: 11, command: 9, stamina: 10, groundball: 4, composure: 5, pitchIQ: 5 } },
  { name: 'Emerson Hancock', short: 'Hancock', team: 'SEA', number: 26, height: 76, weight: 213, age: 27, bats: 'R', throws: 'R', skin: '#d0a38d', espn: 4297897, mlb: 676106, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 6, movement: 7, breaking: 4, changeup: 0, control: 9, command: 5, stamina: 7, groundball: 6, composure: 6, pitchIQ: 3 } },
  { name: 'George Kirby', short: 'Kirby', team: 'SEA', number: 68, height: 76, weight: 215, age: 28, bats: 'R', throws: 'R', skin: '#d0a38d', espn: 42406, mlb: 669923, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 8, movement: 4, breaking: 4, changeup: 2, control: 9, command: 8, stamina: 9, groundball: 6, composure: 3, pitchIQ: 8 } },
  { name: 'Logan Gilbert', short: 'Gilbert', team: 'SEA', number: 36, height: 78, weight: 215, age: 29, bats: 'R', throws: 'R', skin: '#ce9c87', espn: 41221, mlb: 669302, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 7, movement: 4, breaking: 7, changeup: 10, control: 8, command: 5, stamina: 10, groundball: 4, composure: 5, pitchIQ: 6 } },
  { name: 'Andrés Muñoz', short: 'Muñoz', team: 'SEA', number: 75, height: 74, weight: 222, age: 27, bats: 'R', throws: 'R', skin: '#c08b74', espn: 40939, mlb: 662253, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 11, movement: 3, breaking: 10, changeup: 8, control: 3, command: 5, stamina: 4, groundball: 8, composure: 10, pitchIQ: 7 } },
  { name: 'Gabe Speier', short: 'Speier', team: 'SEA', number: 55, height: 71, weight: 200, age: 31, bats: 'L', throws: 'L', skin: '#d8a68a', espn: 40327, mlb: 642100, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 6, movement: 7, breaking: 4, changeup: 1, control: 8, command: 2, stamina: 3, groundball: 5, composure: 6, pitchIQ: 6 } },

  // ─── SF ────────────────────────────────────────────────────────────
  { name: 'Logan Webb', short: 'Webb', team: 'SF', number: 62, height: 74, weight: 221, age: 29, bats: 'R', throws: 'R', skin: '#c58a7a', espn: 41216, mlb: 657277, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 2, movement: 9, breaking: 3, changeup: 6, control: 8, command: 10, stamina: 11, groundball: 9, composure: 6, pitchIQ: 10 } },
  { name: 'Adrian Houser', short: 'Houser', team: 'SF', number: 12, height: 76, weight: 227, age: 33, bats: 'R', throws: 'R', skin: '#c38f80', espn: 32157, mlb: 605288, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 6, movement: 7, breaking: 1, changeup: 6, control: 7, command: 7, stamina: 7, groundball: 7, composure: 5, pitchIQ: 4 } },
  { name: 'Landen Roupp', short: 'Roupp', team: 'SF', number: 65, height: 74, weight: 220, age: 28, bats: 'R', throws: 'R', skin: '#c08c76', espn: 4345404, mlb: 694738, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 3, movement: 7, breaking: 6, changeup: 6, control: 1, command: 11, stamina: 8, groundball: 8, composure: 6, pitchIQ: 7 } },
  { name: 'Trevor McDonald', short: 'McDonald', team: 'SF', number: 72, height: 72, weight: 205, age: 25, bats: 'R', throws: 'R', skin: '#b87d69', espn: 5185136, mlb: 686790, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 10, breaking: 6, changeup: 3, control: 6, command: 8, stamina: 6, groundball: 9, composure: 4, pitchIQ: 5 } },
  { name: 'Joel Kuhnel', short: 'Kuhnel', team: 'SF', number: 54, height: 77, weight: 290, age: 31, bats: 'R', throws: 'R', skin: '#bb866f', espn: 40855, mlb: 669270, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 5, movement: 7, breaking: 2, changeup: 1, control: 4, command: 3, stamina: 3, groundball: 8, composure: 6, pitchIQ: 3 } },
  { name: 'Keaton Winn', short: 'Winn', team: 'SF', number: 67, height: 76, weight: 230, age: 28, bats: 'R', throws: 'R', skin: '#bf8c78', espn: 5116843, mlb: 676775, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 6, movement: 7, breaking: 1, changeup: 6, control: 5, command: 9, stamina: 1, groundball: 7, composure: 5, pitchIQ: 4 } },

  // ─── STL ────────────────────────────────────────────────────────────
  { name: 'Kyle Leahy', short: 'Leahy', team: 'STL', number: 62, height: 77, weight: 225, age: 29, bats: 'S', throws: 'R', skin: '#c1866b', espn: 5006093, mlb: 681517, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 6, breaking: 5, changeup: 4, control: 7, command: 2, stamina: 6, groundball: 6, composure: 7, pitchIQ: 7 } },
  { name: 'Andre Pallante', short: 'Pallante', team: 'STL', number: 53, height: 72, weight: 215, age: 28, bats: 'R', throws: 'R', skin: '#b97961', espn: 4109034, mlb: 669467, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 6, movement: 7, breaking: 6, changeup: 1, control: 6, command: 3, stamina: 9, groundball: 10, composure: 5, pitchIQ: 3 } },
  { name: 'Matthew Liberatore', short: 'Liberatore', team: 'STL', number: 32, height: 76, weight: 215, age: 27, bats: 'L', throws: 'L', skin: '#b97961', espn: 41173, mlb: 669461, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 1, breaking: 6, changeup: 2, control: 6, command: 2, stamina: 8, groundball: 3, composure: 2, pitchIQ: 8 } },
  { name: 'Michael McGreevy', short: 'McGreevy', team: 'STL', number: 36, height: 76, weight: 220, age: 26, bats: 'L', throws: 'R', skin: '#c4856a', espn: 4424141, mlb: 700241, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 2, movement: 6, breaking: 2, changeup: 5, control: 7, command: 4, stamina: 8, groundball: 6, composure: 5, pitchIQ: 8 } },
  { name: 'Riley O\'Brien', short: 'O\'Brien', team: 'STL', number: 61, height: 76, weight: 180, age: 31, bats: 'R', throws: 'R', skin: '#c8907a', espn: 41509, mlb: 676617, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 9, movement: 8, breaking: 9, changeup: 1, control: 3, command: 6, stamina: 4, groundball: 8, composure: 6, pitchIQ: 3 } },
  { name: 'Ryne Stanek', short: 'Stanek', team: 'STL', number: 55, height: 76, weight: 226, age: 35, bats: 'R', throws: 'R', skin: '#bc7e69', espn: 33301, mlb: 592773, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 9, movement: 5, breaking: 6, changeup: 3, control: 2, command: 5, stamina: 4, groundball: 3, composure: 4, pitchIQ: 1 } },

  // ─── TB ────────────────────────────────────────────────────────────
  { name: 'Drew Rasmussen', short: 'Rasmussen', team: 'TB', number: 57, height: 73, weight: 240, age: 31, bats: 'R', throws: 'R', skin: '#cd906b', espn: 42584, mlb: 656876, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 6, movement: 10, breaking: 2, changeup: 8, control: 10, command: 7, stamina: 9, groundball: 7, composure: 11, pitchIQ: 8 } },
  { name: 'Freddy Peralta', short: 'Peralta', team: 'TB', number: 51, height: 72, weight: 198, age: 30, bats: 'R', throws: 'R', skin: '#9a5c42', espn: 39825, mlb: 642547, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 4, breaking: 8, changeup: 6, control: 3, command: 4, stamina: 9, groundball: 4, composure: 8, pitchIQ: 2 } },
  { name: 'Nick Martinez', short: 'Martinez', team: 'TB', number: 28, height: 73, weight: 200, age: 36, bats: 'L', throws: 'R', skin: '#cd906b', espn: 33372, mlb: 607259, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 3, movement: 8, breaking: 2, changeup: 6, control: 11, command: 9, stamina: 9, groundball: 2, composure: 7, pitchIQ: 9 } },
  { name: 'Shane McClanahan', short: 'McClanahan', team: 'TB', number: 18, height: 75, weight: 210, age: 29, bats: 'L', throws: 'L', skin: '#c78a68', espn: 41199, mlb: 663556, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 6, movement: 7, breaking: 5, changeup: 8, control: 6, command: 2, stamina: 7, groundball: 7, composure: 7, pitchIQ: 6 } },
  { name: 'Bryan Baker', short: 'Baker', team: 'TB', number: 47, height: 78, weight: 235, age: 31, bats: 'R', throws: 'R', skin: '#cf997b', espn: 40884, mlb: 641329, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 7, movement: 7, breaking: 1, changeup: 7, control: 6, command: 6, stamina: 4, groundball: 4, composure: 11, pitchIQ: 4 } },
  { name: 'Kevin Kelly', short: 'Kelly', team: 'TB', number: 49, height: 74, weight: 195, age: 28, bats: 'R', throws: 'R', skin: '#dba47f', espn: 5001153, mlb: 687330, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 1, movement: 7, breaking: 0, changeup: 8, control: 10, command: 4, stamina: 4, groundball: 9, composure: 7, pitchIQ: 7 } },

  // ─── TEX ────────────────────────────────────────────────────────────
  { name: 'Jacob deGrom', short: 'deGrom', team: 'TEX', number: 48, height: 76, weight: 180, age: 38, bats: 'L', throws: 'R', skin: '#ce987c', espn: 32796, mlb: 594798, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 8, movement: 4, breaking: 9, changeup: 8, control: 7, command: 9, stamina: 9, groundball: 2, composure: 6, pitchIQ: 5 } },
  { name: 'Kumar Rocker', short: 'Rocker', team: 'TEX', number: 80, height: 77, weight: 245, age: 26, bats: 'R', throws: 'R', skin: '#9b6040', espn: 4414525, mlb: 677958, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 3, breaking: 8, changeup: 4, control: 4, command: 2, stamina: 7, groundball: 6, composure: 3, pitchIQ: 4 } },
  { name: 'MacKenzie Gore', short: 'Gore', team: 'TEX', number: 1, height: 74, weight: 193, age: 27, bats: 'L', throws: 'L', skin: '#cc9070', espn: 39636, mlb: 669022, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 6, movement: 4, breaking: 5, changeup: 7, control: 4, command: 3, stamina: 9, groundball: 4, composure: 3, pitchIQ: 3 } },
  { name: 'Nathan Eovaldi', short: 'Eovaldi', team: 'TEX', number: 17, height: 74, weight: 217, age: 36, bats: 'R', throws: 'R', skin: '#c48067', espn: 31174, mlb: 543135, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 4, breaking: 8, changeup: 8, control: 9, command: 8, stamina: 8, groundball: 8, composure: 6, pitchIQ: 9 } },
  { name: 'Jacob Latz', short: 'Latz', team: 'TEX', number: 67, height: 74, weight: 185, age: 30, bats: 'R', throws: 'L', skin: '#d09378', espn: 3210625, mlb: 656641, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 5, movement: 7, breaking: 6, changeup: 10, control: 5, command: 7, stamina: 5, groundball: 3, composure: 9, pitchIQ: 4 } },
  { name: 'Tyler Alexander', short: 'Alexander', team: 'TEX', number: 13, height: 73, weight: 214, age: 32, bats: 'R', throws: 'L', skin: '#c68c74', espn: 40360, mlb: 641302, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 2, movement: 6, breaking: 3, changeup: 4, control: 7, command: 10, stamina: 5, groundball: 6, composure: 4, pitchIQ: 8 } },

  // ─── TOR ────────────────────────────────────────────────────────────
  { name: 'Dylan Cease', short: 'Cease', team: 'TOR', number: 84, height: 74, weight: 200, age: 30, bats: 'R', throws: 'R', skin: '#b4856b', espn: 34943, mlb: 656302, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 8, movement: 6, breaking: 10, changeup: 9, control: 1, command: 6, stamina: 10, groundball: 4, composure: 8, pitchIQ: 6 } },
  { name: 'José Soriano', short: 'Soriano', team: 'TOR', number: 40, height: 75, weight: 220, age: 28, bats: 'R', throws: 'R', skin: '#986448', espn: 40973, mlb: 667755, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 8, movement: 7, breaking: 9, changeup: 8, control: 3, command: 7, stamina: 10, groundball: 11, composure: 6, pitchIQ: 7 } },
  { name: 'Spencer Miles', short: 'Miles', team: 'TOR', number: 62, height: 75, weight: 180, age: 26, bats: 'L', throws: 'R', skin: '#cd987c', espn: 4833671, mlb: 693686, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 7, movement: 9, breaking: 4, changeup: 1, control: 9, command: 6, stamina: 5, groundball: 8, composure: 9, pitchIQ: 5 } },
  { name: 'Trey Yesavage', short: 'Yesavage', team: 'TOR', number: 39, height: 76, weight: 225, age: 23, bats: 'R', throws: 'R', skin: '#c58e72', espn: 4949041, mlb: 702056, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 5, movement: 4, breaking: 5, changeup: 8, control: 1, command: 4, stamina: 6, groundball: 2, composure: 8, pitchIQ: 2 } },
  { name: 'Louis Varland', short: 'Varland', team: 'TOR', number: 77, height: 73, weight: 205, age: 28, bats: 'L', throws: 'R', skin: '#cd987c', espn: 4917888, mlb: 686973, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 10, movement: 7, breaking: 6, changeup: 8, control: 6, command: 6, stamina: 5, groundball: 10, composure: 10, pitchIQ: 6 } },
  { name: 'Tyler Rogers', short: 'Rogers', team: 'TOR', number: 71, height: 75, weight: 180, age: 35, bats: 'R', throws: 'R', skin: '#c58e72', espn: 34026, mlb: 643511, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 0, movement: 7, breaking: 4, changeup: 1, control: 11, command: 10, stamina: 5, groundball: 11, composure: 9, pitchIQ: 2 } },

  // ─── WSH ────────────────────────────────────────────────────────────
  { name: 'Cade Cavalli', short: 'Cavalli', team: 'WSH', number: 24, height: 76, weight: 223, age: 28, bats: 'R', throws: 'R', skin: '#ba7f76', espn: 4308037, mlb: 676917, starter: true, position: 'pit', role: 'SP',
    attrs: { velocity: 8, movement: 4, breaking: 9, changeup: 4, control: 7, command: 3, stamina: 8, groundball: 9, composure: 6, pitchIQ: 11 } },
  { name: 'Andrew Alvarez', short: 'Alvarez', team: 'WSH', number: 54, height: 75, weight: 215, age: 27, bats: 'L', throws: 'L', skin: '#b17767', espn: 4300668, mlb: 674841, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 2, movement: 5, breaking: 7, changeup: 6, control: 2, command: 0, stamina: 6, groundball: 8, composure: 7, pitchIQ: 7 } },
  { name: 'Connelly Early', short: 'Early', team: 'WSH', number: 19, height: 75, weight: 195, age: 24, bats: 'L', throws: 'L', skin: '#d18f6d', espn: 4863321, mlb: 813349, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 4, movement: 6, breaking: 8, changeup: 4, control: 5, command: 2, stamina: 6, groundball: 6, composure: 6, pitchIQ: 9 } },
  { name: 'Jake Irvin', short: 'Irvin', team: 'WSH', number: 27, height: 78, weight: 234, age: 29, bats: 'R', throws: 'R', skin: '#a67f6b', espn: 41290, mlb: 663623, starter: false, position: 'pit', role: 'SP',
    attrs: { velocity: 3, movement: 2, breaking: 5, changeup: 1, control: 6, command: 3, stamina: 8, groundball: 4, composure: 0, pitchIQ: 5 } },
  { name: 'Clayton Beeter', short: 'Beeter', team: 'WSH', number: 39, height: 74, weight: 220, age: 28, bats: 'R', throws: 'R', skin: '#ba7f76', espn: 4313143, mlb: 690925, starter: false, position: 'pit', role: 'CL',
    attrs: { velocity: 6, movement: 4, breaking: 8, changeup: 1, control: 0, command: 1, stamina: 2, groundball: 7, composure: 4, pitchIQ: 0 } },
  { name: 'Orlando Ribalta', short: 'Ribalta', team: 'WSH', number: 64, height: 79, weight: 245, age: 28, bats: 'R', throws: 'R', skin: '#a16d5a', espn: 5132036, mlb: 687377, starter: false, position: 'pit', role: 'RP',
    attrs: { velocity: 7, movement: 5, breaking: 4, changeup: 7, control: 2, command: 7, stamina: 1, groundball: 4, composure: 6, pitchIQ: 5 } },
]
