// ALL-TIME pitchers for baseball, Build-A-Player's fourth sport (pool key 'alltime', label ALL-TIME).
// Same row shape as data/mlb-batters.js / mlb-pitchers.js (and data/nba-guard-legends.js), attrs on the 0-11 scale
// (F=0, D=1, C-=2, C=3, C+=4, B-=5, B=6, B+=7, A-=8, A=9, A+=10, S=11), integer attrs with exactly the keys in mlb-attrs.js.
//
// WHO IS IN   Franchise greats, about five per club, listed under the club they are most identified with, so each
//   player appears once in this file (his ESPN id never repeats here). team = the current franchise's ESPN abbreviation;
//   club = the name he played under when it was a different city or name (Brooklyn Dodgers, Montreal Expos, New York
//   Giants, Philadelphia Athletics, Washington Senators, St. Louis Browns, Cleveland Naps/Indians, Florida Marlins,
//   California Angels, Boston Americans, Oakland Athletics); no club key = the same name as today. A few active players
//   are already franchise greats and are in (their years end open, '2011–'). starter: true = the franchise's greatest,
//   one per club, the player a build replaces.
// BIO   number = his number with that club (the retired one where it was retired; null before numbers, about 1929-32).
//   height (in) / weight (lb): ESPN's athlete record where ESPN lists them, else the Baseball-Reference listing.
//   bats ('R'|'L'|'S' switch) / throws: Baseball-Reference. age: null (a career pool). years = his seasons with the club. role = his real primary
//   spot with that club. skin: where there is an ESPN photo, sampled from it (the face sampler of
//   scripts/extract-nba-skin-colors.mjs) and snapped to the nearest swatch used in data/nba-*.js; otherwise hand-set from
//   those swatches (also where a bright photo sampled far too light: David Price, Giancarlo Stanton, Ubaldo Jiménez).
// espn  ESPN MLB athlete id from ESPN's search API (site.web.api.espn.com/apis/search/v2), each checked against ESPN's
//   athlete record (birth date, debut, position) where two players share a name. null where ESPN has no MLB record we
//   can be sure is him. Most pre-1990 players have an id but no ESPN photo (initials).
// SOURCES  Baseball-Reference career and franchise pages (rate stats, counting stats, black ink, WAR with the club,
//   postseason records), the Hall of Fame plaques and records, Gold Glove / Cy Young / MVP / World Series MVP lists,
//   Statcast for the players who reached the tracking era (2015 on), ESPN for ids and bios.
// ERA   Every grade is in era context: dead-ball (to 1919) power and strikeouts are read against their own league, the
//   pre-integration and expansion eras against theirs, the 1994-2007 offense boom is discounted, today's velocity and
//   strikeout rates against today's. A grade says how far above his own time he stood.
//
// RUBRIC (pitchers)
//   velocity    fastball speed against his era (radar readings from the 1970s on, the record and contemporaries before)
//   movement    fastball / sinker / cutter life (ride, run, sink), the knuckleball counts here too
//   breaking    slider / curve / sweeper: reputation as a put-away pitch, whiffs, how hitters described it
//   changeup    changeup, splitter, forkball, screwball (one of them is enough); a pitcher without one grades low
//   control     walk rate (BB/9) against his league, K/BB
//   command     where in the zone he could put it: the corners, the edges, few mistakes over the plate, HR/9
//   stamina     innings, complete games, starts per season, durability (relievers are low; long relievers higher)
//   groundball  ground-ball rate or the known tendency (sinkerballers high, high-fastball and fly-ball types low)
//   composure   postseason and high-leverage record, World Series moments, how he pitched with the season on the line
//   pitchIQ     craft, sequencing and pitch mix, changing speeds, how long he stayed good
// Most legends sit B to A-. S is a handful per trait in this file.
//
// EVIDENCE NOTES (the S grades)
//   velocity S  Nolan Ryan (100.9 mph in 1974, still 95+ at 44), Aroldis Chapman (105.8, the fastest pitch ever tracked),
//               Walter Johnson and Bob Feller (the fastest of their eras by every account, Feller timed at 98.6 in 1946),
//               Jacob deGrom (the fastest average fastball of any starter, 99 in 2021-22).
//   movement S  Mariano Rivera (the cutter), Greg Maddux (the two-seamer that started at a lefty's hip), Brandon Webb (the
//               sinker: a 64% ground-ball rate as a starter).
//   breaking S  Sandy Koufax (the curve), Bert Blyleven (the curve, 3,701 K), Randy Johnson (the slider), Steve Carlton
//               (the slider), Clayton Kershaw (the curve and the slider).
//   changeup S  Pedro Martínez (the changeup), Trevor Hoffman (the changeup, 601 saves), Johan Santana (the changeup),
//               Bruce Sutter (the split-finger he brought to the game), Carl Hubbell (the screwball: Ruth, Gehrig, Foxx,
//               Simmons, Cronin in a row, 1934 All-Star Game), Devin Williams (the Airbender).
//   control S   Cy Young (1.5 BB/9 over 7,356 innings), Christy Mathewson (1.6), Addie Joss (1.4), Greg Maddux (1.8, under
//               1.0 at his peak), Dennis Eckersley (3 walks in 57.2 innings, 1989).
//   command S   Maddux, Mathewson, Rivera, Roy Halladay (the 2010 perfect game and postseason no-hitter).
//   stamina S   Cy Young (7,356 IP, 749 CG), Walter Johnson (5,914 IP), Warren Spahn (5,243 IP, 382 CG), Phil Niekro (5,404
//               IP, to 48), Nolan Ryan (5,386 IP over 27 seasons).
//   groundball S  Brandon Webb, Zack Britton (80% ground balls in 2016), Kent Tekulve (the submarine sinker).
//   composure S Mariano Rivera (0.70 postseason ERA, 42 saves), Madison Bumgarner (0.25 World Series ERA, Game 7 2014),
//               Bob Gibson (7-2, 7 straight World Series complete-game wins), Sandy Koufax (0.95 World Series ERA, Game 7
//               1965 on two days' rest), Christy Mathewson (three shutouts in the 1905 World Series), Curt Schilling
//               (11-2 in October, the bloody sock).
//   pitchIQ S   Greg Maddux, Christy Mathewson, Tom Seaver, Zack Greinke (the game's most cerebral starters).
//   Also: Ohtani is here as an Angel (2018-23); his stamina is low on purpose (a two-way player's innings). Knuckleballers
//   (Niekro, Wilhelm, Hough) grade F/D on velocity and high on movement. Closers' stamina is D/C-.

export const MLB_LEGEND_PITCHERS = [

  // ─── ARI ─────────────────────────────────────────────────────────────
  { name: "Randy Johnson", short: "Big Unit", team: 'ARI', number: 51, height: 82, weight: 225, age: null, bats: 'R', throws: 'L', skin: '#d4a882', espn: 2131, starter: true, position: 'pit', role: 'SP', years: '1999–2004, 2007–08',
    attrs: { velocity: 10, movement: 7, breaking: 11, changeup: 4, control: 7, command: 7, stamina: 10, groundball: 5, composure: 9, pitchIQ: 8 } },
  { name: "Curt Schilling", short: "Schilling", team: 'ARI', number: 38, height: 77, weight: 225, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 2112, starter: false, position: 'pit', role: 'SP', years: '2000–03',
    attrs: { velocity: 8, movement: 6, breaking: 6, changeup: 9, control: 10, command: 9, stamina: 9, groundball: 4, composure: 11, pitchIQ: 9 } },
  { name: "Brandon Webb", short: "Webb", team: 'ARI', number: 17, height: 75, weight: 230, age: null, bats: 'R', throws: 'R', skin: '#a87761', espn: 5455, starter: false, position: 'pit', role: 'SP', years: '2003–09',
    attrs: { velocity: 5, movement: 11, breaking: 6, changeup: 7, control: 7, command: 8, stamina: 8, groundball: 11, composure: 6, pitchIQ: 8 } },
  { name: "Byung-Hyun Kim", short: "Kim", team: 'ARI', number: 49, height: 69, weight: 175, age: null, bats: 'R', throws: 'R', skin: '#cc9272', espn: 4076, starter: false, position: 'pit', role: 'CL', years: '1999–2003, 2007',
    attrs: { velocity: 7, movement: 9, breaking: 8, changeup: 4, control: 4, command: 4, stamina: 2, groundball: 5, composure: 2, pitchIQ: 5 } },
  { name: "Zac Gallen", short: "Gallen", team: 'ARI', number: 23, height: 74, weight: 189, age: null, bats: 'R', throws: 'R', skin: '#b87d69', espn: 39910, starter: false, position: 'pit', role: 'SP', years: '2019–',
    attrs: { velocity: 7, movement: 6, breaking: 8, changeup: 7, control: 7, command: 7, stamina: 7, groundball: 5, composure: 6, pitchIQ: 8 } },

  // ─── ATH ─────────────────────────────────────────────────────────────
  { name: "Lefty Grove", short: "Grove", team: 'ATH', club: "Philadelphia Athletics", number: 10, height: 75, weight: 190, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 22364, starter: true, position: 'pit', role: 'SP', years: '1925–33',
    attrs: { velocity: 10, movement: 7, breaking: 6, changeup: 4, control: 8, command: 8, stamina: 9, groundball: 5, composure: 7, pitchIQ: 8 } },
  { name: "Eddie Plank", short: "Plank", team: 'ATH', club: "Philadelphia Athletics", number: null, height: 71, weight: 175, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 26362, starter: false, position: 'pit', role: 'SP', years: '1901–14',
    attrs: { velocity: 6, movement: 7, breaking: 8, changeup: 5, control: 8, command: 8, stamina: 10, groundball: 6, composure: 7, pitchIQ: 9 } },
  { name: "Dennis Eckersley", short: "Eck", team: 'ATH', club: "Oakland Athletics", number: 43, height: 74, weight: 195, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 923, starter: false, position: 'pit', role: 'CL', years: '1987–95',
    attrs: { velocity: 7, movement: 8, breaking: 8, changeup: 3, control: 11, command: 10, stamina: 6, groundball: 5, composure: 7, pitchIQ: 9 } },
  { name: "Catfish Hunter", short: "Catfish", team: 'ATH', club: "Oakland Athletics", number: 27, height: 72, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 23207, starter: false, position: 'pit', role: 'SP', years: '1965–74',
    attrs: { velocity: 6, movement: 6, breaking: 6, changeup: 6, control: 9, command: 9, stamina: 9, groundball: 3, composure: 9, pitchIQ: 8 } },
  { name: "Rollie Fingers", short: "Fingers", team: 'ATH', club: "Oakland Athletics", number: 34, height: 76, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 540, starter: false, position: 'pit', role: 'CL', years: '1968–76',
    attrs: { velocity: 7, movement: 7, breaking: 8, changeup: 6, control: 8, command: 8, stamina: 4, groundball: 6, composure: 9, pitchIQ: 8 } },

  // ─── ATL ─────────────────────────────────────────────────────────────
  { name: "Greg Maddux", short: "Maddux", team: 'ATL', number: 31, height: 72, weight: 180, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 1800, starter: true, position: 'pit', role: 'SP', years: '1993–2003',
    attrs: { velocity: 4, movement: 11, breaking: 7, changeup: 10, control: 11, command: 11, stamina: 9, groundball: 10, composure: 7, pitchIQ: 11 } },
  { name: "Warren Spahn", short: "Spahn", team: 'ATL', number: 21, height: 72, weight: 172, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 17912, starter: false, position: 'pit', role: 'SP', years: '1942–64',
    attrs: { velocity: 6, movement: 8, breaking: 8, changeup: 8, control: 8, command: 9, stamina: 11, groundball: 6, composure: 7, pitchIQ: 10 } },
  { name: "Tom Glavine", short: "Glavine", team: 'ATL', number: 47, height: 72, weight: 205, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 1975, starter: false, position: 'pit', role: 'SP', years: '1987–2002, 2008',
    attrs: { velocity: 4, movement: 7, breaking: 5, changeup: 10, control: 7, command: 10, stamina: 9, groundball: 7, composure: 9, pitchIQ: 10 } },
  { name: "John Smoltz", short: "Smoltz", team: 'ATL', number: 29, height: 75, weight: 220, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: null, starter: false, position: 'pit', role: 'SP', years: '1988–2008',
    attrs: { velocity: 8, movement: 7, breaking: 10, changeup: 7, control: 8, command: 8, stamina: 7, groundball: 6, composure: 10, pitchIQ: 9 } },
  { name: "Phil Niekro", short: "Knucksie", team: 'ATL', number: 35, height: 73, weight: 180, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 611, starter: false, position: 'pit', role: 'SP', years: '1964–83, 1987',
    attrs: { velocity: 1, movement: 10, breaking: 4, changeup: 6, control: 5, command: 4, stamina: 11, groundball: 6, composure: 5, pitchIQ: 8 } },

  // ─── BAL ─────────────────────────────────────────────────────────────
  { name: "Jim Palmer", short: "Palmer", team: 'BAL', number: 22, height: 75, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 980, starter: true, position: 'pit', role: 'SP', years: '1965–84',
    attrs: { velocity: 8, movement: 7, breaking: 8, changeup: 6, control: 7, command: 8, stamina: 9, groundball: 3, composure: 9, pitchIQ: 9 } },
  { name: "Mike Mussina", short: "Moose", team: 'BAL', number: 35, height: 74, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 2557, starter: false, position: 'pit', role: 'SP', years: '1991–2000',
    attrs: { velocity: 6, movement: 7, breaking: 9, changeup: 7, control: 9, command: 9, stamina: 8, groundball: 5, composure: 7, pitchIQ: 10 } },
  { name: "Dave McNally", short: "McNally", team: 'BAL', number: 19, height: 71, weight: 190, age: null, bats: 'R', throws: 'L', skin: '#d4a882', espn: 25077, starter: false, position: 'pit', role: 'SP', years: '1962–74',
    attrs: { velocity: 5, movement: 6, breaking: 8, changeup: 5, control: 7, command: 7, stamina: 8, groundball: 4, composure: 8, pitchIQ: 7 } },
  { name: "Mike Cuellar", short: "Cuellar", team: 'BAL', number: 35, height: 72, weight: 165, age: null, bats: 'L', throws: 'L', skin: '#b87b60', espn: 20628, starter: false, position: 'pit', role: 'SP', years: '1969–76',
    attrs: { velocity: 4, movement: 7, breaking: 7, changeup: 9, control: 7, command: 8, stamina: 8, groundball: 5, composure: 7, pitchIQ: 8 } },
  { name: "Zack Britton", short: "Britton", team: 'BAL', number: 53, height: 75, weight: 195, age: null, bats: 'L', throws: 'L', skin: '#d39b82', espn: 31054, starter: false, position: 'pit', role: 'CL', years: '2011–18',
    attrs: { velocity: 9, movement: 10, breaking: 6, changeup: 2, control: 6, command: 6, stamina: 2, groundball: 11, composure: 7, pitchIQ: 6 } },

  // ─── BOS ─────────────────────────────────────────────────────────────
  { name: "Pedro Martínez", short: "Pedro", team: 'BOS', number: 45, height: 71, weight: 193, age: null, bats: 'R', throws: 'R', skin: '#8a5038', espn: 2717, starter: true, position: 'pit', role: 'SP', years: '1998–2004',
    attrs: { velocity: 9, movement: 9, breaking: 9, changeup: 11, control: 10, command: 10, stamina: 7, groundball: 5, composure: 8, pitchIQ: 10 } },
  { name: "Roger Clemens", short: "Rocket", team: 'BOS', number: 21, height: 76, weight: 238, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 1427, starter: false, position: 'pit', role: 'SP', years: '1984–96',
    attrs: { velocity: 10, movement: 7, breaking: 8, changeup: 9, control: 8, command: 8, stamina: 10, groundball: 5, composure: 6, pitchIQ: 9 } },
  { name: "Cy Young", short: "Cy Young", team: 'BOS', club: "Boston Americans", number: null, height: 74, weight: 210, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 28364, starter: false, position: 'pit', role: 'SP', years: '1901–08',
    attrs: { velocity: 7, movement: 7, breaking: 7, changeup: 6, control: 11, command: 10, stamina: 11, groundball: 6, composure: 8, pitchIQ: 9 } },
  { name: "Luis Tiant", short: "El Tiante", team: 'BOS', number: 23, height: 72, weight: 180, age: null, bats: 'R', throws: 'R', skin: '#8a5038', espn: 1071, starter: false, position: 'pit', role: 'SP', years: '1971–78',
    attrs: { velocity: 6, movement: 9, breaking: 7, changeup: 6, control: 7, command: 8, stamina: 8, groundball: 5, composure: 9, pitchIQ: 9 } },
  { name: "Jonathan Papelbon", short: "Papelbon", team: 'BOS', number: 58, height: 77, weight: 230, age: null, bats: 'R', throws: 'R', skin: '#b17767', espn: 6373, starter: false, position: 'pit', role: 'CL', years: '2005–11',
    attrs: { velocity: 8, movement: 7, breaking: 5, changeup: 8, control: 7, command: 7, stamina: 2, groundball: 3, composure: 8, pitchIQ: 6 } },

  // ─── CHC ─────────────────────────────────────────────────────────────
  { name: "Fergie Jenkins", short: "Fergie", team: 'CHC', number: 31, height: 77, weight: 205, age: null, bats: 'R', throws: 'R', skin: '#7a4030', espn: 946, starter: true, position: 'pit', role: 'SP', years: '1966–73, 1982–83',
    attrs: { velocity: 6, movement: 7, breaking: 7, changeup: 6, control: 10, command: 9, stamina: 10, groundball: 4, composure: 5, pitchIQ: 8 } },
  { name: "Mordecai Brown", short: "Three Finger", team: 'CHC', number: null, height: 70, weight: 175, age: null, bats: 'S', throws: 'R', skin: '#d4a882', espn: 19626, starter: false, position: 'pit', role: 'SP', years: '1904–12, 1916',
    attrs: { velocity: 5, movement: 10, breaking: 9, changeup: 5, control: 9, command: 9, stamina: 9, groundball: 9, composure: 9, pitchIQ: 8 } },
  { name: "Bruce Sutter", short: "Sutter", team: 'CHC', number: 40, height: 74, weight: 195, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 653, starter: false, position: 'pit', role: 'CL', years: '1976–80',
    attrs: { velocity: 5, movement: 8, breaking: 3, changeup: 11, control: 8, command: 8, stamina: 4, groundball: 9, composure: 8, pitchIQ: 8 } },
  { name: "Lee Smith", short: "L. Smith", team: 'CHC', number: 46, height: 78, weight: 269, age: null, bats: 'R', throws: 'R', skin: '#7a4030', espn: 746, starter: false, position: 'pit', role: 'CL', years: '1980–87',
    attrs: { velocity: 9, movement: 6, breaking: 7, changeup: 4, control: 6, command: 6, stamina: 3, groundball: 6, composure: 4, pitchIQ: 6 } },
  { name: "Kyle Hendricks", short: "Hendricks", team: 'CHC', number: 28, height: 75, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#b17864', espn: 33173, starter: false, position: 'pit', role: 'SP', years: '2014–24',
    attrs: { velocity: 1, movement: 7, breaking: 4, changeup: 10, control: 8, command: 10, stamina: 6, groundball: 7, composure: 9, pitchIQ: 10 } },

  // ─── CHW ─────────────────────────────────────────────────────────────
  { name: "Ed Walsh", short: "Walsh", team: 'CHW', number: null, height: 73, weight: 193, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 27747, starter: true, position: 'pit', role: 'SP', years: '1904–16',
    attrs: { velocity: 6, movement: 9, breaking: 7, changeup: 8, control: 9, command: 8, stamina: 10, groundball: 7, composure: 8, pitchIQ: 8 } },
  { name: "Ted Lyons", short: "Lyons", team: 'CHW', number: 16, height: 71, weight: 200, age: null, bats: 'S', throws: 'R', skin: '#d4a882', espn: 24471, starter: false, position: 'pit', role: 'SP', years: '1923–46',
    attrs: { velocity: 5, movement: 7, breaking: 6, changeup: 6, control: 8, command: 8, stamina: 10, groundball: 6, composure: 5, pitchIQ: 9 } },
  { name: "Mark Buehrle", short: "Buehrle", team: 'CHW', number: 56, height: 74, weight: 240, age: null, bats: 'L', throws: 'L', skin: '#b37252', espn: 4454, starter: false, position: 'pit', role: 'SP', years: '2000–11',
    attrs: { velocity: 2, movement: 7, breaking: 5, changeup: 9, control: 9, command: 9, stamina: 9, groundball: 7, composure: 7, pitchIQ: 9 } },
  { name: "Chris Sale", short: "Sale", team: 'CHW', number: 49, height: 78, weight: 180, age: null, bats: 'L', throws: 'L', skin: '#be7f5d', espn: 30948, starter: false, position: 'pit', role: 'SP', years: '2010–16',
    attrs: { velocity: 9, movement: 8, breaking: 10, changeup: 8, control: 9, command: 8, stamina: 6, groundball: 4, composure: 6, pitchIQ: 8 } },
  { name: "Hoyt Wilhelm", short: "Wilhelm", team: 'CHW', number: 31, height: 72, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 28037, starter: false, position: 'pit', role: 'RP', years: '1963–68',
    attrs: { velocity: 1, movement: 10, breaking: 3, changeup: 6, control: 6, command: 5, stamina: 5, groundball: 6, composure: 6, pitchIQ: 8 } },

  // ─── CIN ─────────────────────────────────────────────────────────────
  { name: "Bucky Walters", short: "Walters", team: 'CIN', number: 31, height: 73, weight: 180, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 27760, starter: true, position: 'pit', role: 'SP', years: '1938–48',
    attrs: { velocity: 6, movement: 8, breaking: 7, changeup: 5, control: 7, command: 7, stamina: 9, groundball: 7, composure: 8, pitchIQ: 7 } },
  { name: "Johnny Cueto", short: "Cueto", team: 'CIN', number: 47, height: 71, weight: 229, age: null, bats: 'R', throws: 'R', skin: '#905e4a', espn: 28955, starter: false, position: 'pit', role: 'SP', years: '2008–15',
    attrs: { velocity: 6, movement: 8, breaking: 7, changeup: 8, control: 8, command: 8, stamina: 7, groundball: 6, composure: 7, pitchIQ: 9 } },
  { name: "José Rijo", short: "Rijo", team: 'CIN', number: 27, height: 74, weight: 215, age: null, bats: 'R', throws: 'R', skin: '#8a5038', espn: 1402, starter: false, position: 'pit', role: 'SP', years: '1988–95, 2001–02',
    attrs: { velocity: 8, movement: 7, breaking: 9, changeup: 6, control: 7, command: 7, stamina: 6, groundball: 6, composure: 10, pitchIQ: 7 } },
  { name: "Mario Soto", short: "Soto", team: 'CIN', number: 36, height: 72, weight: 174, age: null, bats: 'R', throws: 'R', skin: '#9b6649', espn: 649, starter: false, position: 'pit', role: 'SP', years: '1977–88',
    attrs: { velocity: 8, movement: 6, breaking: 5, changeup: 10, control: 6, command: 6, stamina: 7, groundball: 3, composure: 5, pitchIQ: 7 } },
  { name: "Aroldis Chapman", short: "Chapman", team: 'CIN', number: 54, height: 76, weight: 235, age: null, bats: 'L', throws: 'L', skin: '#8a5038', espn: 30442, starter: false, position: 'pit', role: 'CL', years: '2010–15',
    attrs: { velocity: 11, movement: 6, breaking: 8, changeup: 3, control: 4, command: 3, stamina: 1, groundball: 6, composure: 5, pitchIQ: 4 } },

  // ─── CLE ─────────────────────────────────────────────────────────────
  { name: "Bob Feller", short: "Rapid Robert", team: 'CLE', club: "Cleveland Indians", number: 19, height: 72, weight: 185, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 21488, starter: true, position: 'pit', role: 'SP', years: '1936–56',
    attrs: { velocity: 11, movement: 6, breaking: 9, changeup: 4, control: 4, command: 5, stamina: 9, groundball: 4, composure: 5, pitchIQ: 7 } },
  { name: "Bob Lemon", short: "Lemon", team: 'CLE', club: "Cleveland Indians", number: 21, height: 72, weight: 185, age: null, bats: 'L', throws: 'R', skin: '#d4a882', espn: 24199, starter: false, position: 'pit', role: 'SP', years: '1946–58',
    attrs: { velocity: 5, movement: 9, breaking: 7, changeup: 5, control: 5, command: 7, stamina: 9, groundball: 9, composure: 8, pitchIQ: 7 } },
  { name: "Addie Joss", short: "Joss", team: 'CLE', club: "Cleveland Naps", number: null, height: 75, weight: 185, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 23501, starter: false, position: 'pit', role: 'SP', years: '1902–10',
    attrs: { velocity: 7, movement: 7, breaking: 7, changeup: 6, control: 11, command: 9, stamina: 8, groundball: 6, composure: 7, pitchIQ: 8 } },
  { name: "Corey Kluber", short: "Kluber", team: 'CLE', club: "Cleveland Indians", number: 28, height: 76, weight: 210, age: null, bats: 'R', throws: 'R', skin: '#b17767', espn: 30981, starter: false, position: 'pit', role: 'SP', years: '2011–19',
    attrs: { velocity: 6, movement: 9, breaking: 10, changeup: 5, control: 9, command: 9, stamina: 8, groundball: 6, composure: 6, pitchIQ: 8 } },
  { name: "CC Sabathia", short: "CC", team: 'CLE', club: "Cleveland Indians", number: 52, height: 78, weight: 300, age: null, bats: 'L', throws: 'L', skin: '#a56142', espn: 4553, starter: false, position: 'pit', role: 'SP', years: '2001–08',
    attrs: { velocity: 8, movement: 6, breaking: 9, changeup: 7, control: 7, command: 7, stamina: 9, groundball: 6, composure: 6, pitchIQ: 8 } },

  // ─── COL ─────────────────────────────────────────────────────────────
  { name: "Ubaldo Jiménez", short: "Ubaldo", team: 'COL', number: 38, height: 77, weight: 210, age: null, bats: 'R', throws: 'R', skin: '#8a5038', espn: 28625, starter: true, position: 'pit', role: 'SP', years: '2006–11',
    attrs: { velocity: 9, movement: 7, breaking: 7, changeup: 7, control: 3, command: 3, stamina: 7, groundball: 7, composure: 5, pitchIQ: 4 } },
  { name: "Germán Márquez", short: "Márquez", team: 'COL', number: 48, height: 73, weight: 230, age: null, bats: 'R', throws: 'R', skin: '#9c664e', espn: 34874, starter: false, position: 'pit', role: 'SP', years: '2016–25',
    attrs: { velocity: 7, movement: 6, breaking: 9, changeup: 4, control: 6, command: 6, stamina: 7, groundball: 6, composure: 5, pitchIQ: 6 } },
  { name: "Jorge De La Rosa", short: "De La Rosa", team: 'COL', number: 29, height: 73, weight: 215, age: null, bats: 'L', throws: 'L', skin: '#b87d69', espn: 5906, starter: false, position: 'pit', role: 'SP', years: '2008–16',
    attrs: { velocity: 5, movement: 6, breaking: 5, changeup: 9, control: 4, command: 5, stamina: 6, groundball: 7, composure: 5, pitchIQ: 7 } },
  { name: "Aaron Cook", short: "Cook", team: 'COL', number: 28, height: 75, weight: 215, age: null, bats: 'R', throws: 'R', skin: '#ba7f76', espn: 4762, starter: false, position: 'pit', role: 'SP', years: '2002–11',
    attrs: { velocity: 3, movement: 9, breaking: 4, changeup: 4, control: 6, command: 6, stamina: 6, groundball: 10, composure: 5, pitchIQ: 6 } },
  { name: "Brian Fuentes", short: "Fuentes", team: 'COL', number: 40, height: 76, weight: 230, age: null, bats: 'L', throws: 'L', skin: '#aa715a', espn: 4731, starter: false, position: 'pit', role: 'CL', years: '2002–08',
    attrs: { velocity: 5, movement: 8, breaking: 7, changeup: 5, control: 5, command: 5, stamina: 2, groundball: 4, composure: 6, pitchIQ: 6 } },

  // ─── DET ─────────────────────────────────────────────────────────────
  { name: "Justin Verlander", short: "Verlander", team: 'DET', number: 35, height: 77, weight: 240, age: null, bats: 'R', throws: 'R', skin: '#b88a7a', espn: 6341, starter: true, position: 'pit', role: 'SP', years: '2005–17, 2026',
    attrs: { velocity: 9, movement: 8, breaking: 9, changeup: 7, control: 8, command: 8, stamina: 10, groundball: 3, composure: 6, pitchIQ: 10 } },
  { name: "Hal Newhouser", short: "Prince Hal", team: 'DET', number: 16, height: 74, weight: 180, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 25745, starter: false, position: 'pit', role: 'SP', years: '1939–53',
    attrs: { velocity: 7, movement: 7, breaking: 8, changeup: 7, control: 6, command: 7, stamina: 9, groundball: 5, composure: 7, pitchIQ: 8 } },
  { name: "Jack Morris", short: "Morris", team: 'DET', number: 47, height: 75, weight: 195, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 976, starter: false, position: 'pit', role: 'SP', years: '1977–90',
    attrs: { velocity: 7, movement: 7, breaking: 6, changeup: 9, control: 6, command: 6, stamina: 10, groundball: 5, composure: 10, pitchIQ: 7 } },
  { name: "Mickey Lolich", short: "Lolich", team: 'DET', number: 29, height: 73, weight: 170, age: null, bats: 'R', throws: 'L', skin: '#d4a882', espn: 24344, starter: false, position: 'pit', role: 'SP', years: '1963–75',
    attrs: { velocity: 6, movement: 6, breaking: 7, changeup: 5, control: 7, command: 7, stamina: 10, groundball: 4, composure: 10, pitchIQ: 7 } },
  { name: "Willie Hernández", short: "Hernández", team: 'DET', number: 21, height: 74, weight: 185, age: null, bats: 'L', throws: 'L', skin: '#a7725e', espn: 560, starter: false, position: 'pit', role: 'CL', years: '1984–89',
    attrs: { velocity: 6, movement: 7, breaking: 6, changeup: 9, control: 7, command: 7, stamina: 4, groundball: 5, composure: 8, pitchIQ: 6 } },

  // ─── HOU ─────────────────────────────────────────────────────────────
  { name: "Roy Oswalt", short: "Oswalt", team: 'HOU', number: 44, height: 72, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#b07a65', espn: 4575, starter: true, position: 'pit', role: 'SP', years: '2001–10',
    attrs: { velocity: 8, movement: 7, breaking: 9, changeup: 6, control: 8, command: 8, stamina: 8, groundball: 7, composure: 8, pitchIQ: 8 } },
  { name: "J.R. Richard", short: "J.R.", team: 'HOU', number: 50, height: 80, weight: 222, age: null, bats: 'R', throws: 'R', skin: '#7a4030', espn: 630, starter: false, position: 'pit', role: 'SP', years: '1971–80',
    attrs: { velocity: 10, movement: 6, breaking: 10, changeup: 3, control: 4, command: 4, stamina: 8, groundball: 6, composure: 5, pitchIQ: 5 } },
  { name: "Mike Scott", short: "Scott", team: 'HOU', number: 33, height: 75, weight: 215, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 643, starter: false, position: 'pit', role: 'SP', years: '1983–91',
    attrs: { velocity: 7, movement: 8, breaking: 6, changeup: 10, control: 7, command: 8, stamina: 7, groundball: 7, composure: 9, pitchIQ: 7 } },
  { name: "Billy Wagner", short: "Wagner", team: 'HOU', number: 13, height: 71, weight: 203, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 3375, starter: false, position: 'pit', role: 'CL', years: '1995–2003',
    attrs: { velocity: 10, movement: 7, breaking: 7, changeup: 2, control: 6, command: 6, stamina: 1, groundball: 4, composure: 4, pitchIQ: 5 } },
  { name: "Dallas Keuchel", short: "Keuchel", team: 'HOU', number: 60, height: 74, weight: 205, age: null, bats: 'L', throws: 'L', skin: '#b7927f', espn: 31815, starter: false, position: 'pit', role: 'SP', years: '2012–18',
    attrs: { velocity: 1, movement: 9, breaking: 7, changeup: 7, control: 7, command: 9, stamina: 7, groundball: 10, composure: 7, pitchIQ: 9 } },

  // ─── KC ──────────────────────────────────────────────────────────────
  { name: "Bret Saberhagen", short: "Saberhagen", team: 'KC', number: 31, height: 73, weight: 200, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 1405, starter: true, position: 'pit', role: 'SP', years: '1984–91',
    attrs: { velocity: 7, movement: 7, breaking: 7, changeup: 7, control: 10, command: 9, stamina: 7, groundball: 5, composure: 9, pitchIQ: 8 } },
  { name: "Kevin Appier", short: "Appier", team: 'KC', number: 55, height: 74, weight: 215, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 2177, starter: false, position: 'pit', role: 'SP', years: '1989–99, 2003–04',
    attrs: { velocity: 7, movement: 8, breaking: 8, changeup: 8, control: 7, command: 7, stamina: 7, groundball: 5, composure: 6, pitchIQ: 7 } },
  { name: "Zack Greinke", short: "Greinke", team: 'KC', number: 23, height: 74, weight: 200, age: null, bats: 'R', throws: 'R', skin: '#cc907a', espn: 5883, starter: false, position: 'pit', role: 'SP', years: '2004–10, 2022–23',
    attrs: { velocity: 6, movement: 7, breaking: 9, changeup: 9, control: 10, command: 10, stamina: 8, groundball: 6, composure: 5, pitchIQ: 11 } },
  { name: "Dan Quisenberry", short: "Quiz", team: 'KC', number: 29, height: 74, weight: 185, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 985, starter: false, position: 'pit', role: 'CL', years: '1979–88',
    attrs: { velocity: 1, movement: 10, breaking: 4, changeup: 4, control: 10, command: 8, stamina: 4, groundball: 10, composure: 6, pitchIQ: 8 } },
  { name: "Wade Davis", short: "W. Davis", team: 'KC', number: 17, height: 77, weight: 227, age: null, bats: 'R', throws: 'R', skin: '#c48067', espn: 28957, starter: false, position: 'pit', role: 'CL', years: '2013–16',
    attrs: { velocity: 8, movement: 8, breaking: 9, changeup: 3, control: 6, command: 7, stamina: 2, groundball: 5, composure: 10, pitchIQ: 7 } },

  // ─── LAA ─────────────────────────────────────────────────────────────
  { name: "Shohei Ohtani", short: "Ohtani", team: 'LAA', number: 17, height: 76, weight: 210, age: null, bats: 'L', throws: 'R', skin: '#c58e72', espn: 39832, starter: true, position: 'pit', role: 'SP', years: '2018–23',
    attrs: { velocity: 10, movement: 7, breaking: 9, changeup: 10, control: 6, command: 6, stamina: 5, groundball: 5, composure: 9, pitchIQ: 8 } },
  { name: "Chuck Finley", short: "Finley", team: 'LAA', number: 31, height: 78, weight: 226, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 1725, starter: false, position: 'pit', role: 'SP', years: '1986–99',
    attrs: { velocity: 6, movement: 7, breaking: 6, changeup: 9, control: 5, command: 6, stamina: 8, groundball: 7, composure: 5, pitchIQ: 7 } },
  { name: "Jered Weaver", short: "Weaver", team: 'LAA', number: 36, height: 79, weight: 210, age: null, bats: 'R', throws: 'R', skin: '#b17767', espn: 6479, starter: false, position: 'pit', role: 'SP', years: '2006–16',
    attrs: { velocity: 2, movement: 7, breaking: 7, changeup: 8, control: 8, command: 8, stamina: 7, groundball: 2, composure: 5, pitchIQ: 8 } },
  { name: "Frank Tanana", short: "Tanana", team: 'LAA', club: "California Angels", number: 36, height: 74, weight: 180, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 1009, starter: false, position: 'pit', role: 'SP', years: '1973–80',
    attrs: { velocity: 8, movement: 6, breaking: 8, changeup: 6, control: 7, command: 7, stamina: 9, groundball: 4, composure: 5, pitchIQ: 8 } },
  { name: "Francisco Rodríguez", short: "K-Rod", team: 'LAA', number: 57, height: 72, weight: 195, age: null, bats: 'R', throws: 'R', skin: '#95705f', espn: 5357, starter: false, position: 'pit', role: 'CL', years: '2002–08',
    attrs: { velocity: 8, movement: 7, breaking: 9, changeup: 7, control: 5, command: 6, stamina: 2, groundball: 5, composure: 7, pitchIQ: 6 } },

  // ─── LAD ─────────────────────────────────────────────────────────────
  { name: "Sandy Koufax", short: "Koufax", team: 'LAD', number: 32, height: 74, weight: 210, age: null, bats: 'R', throws: 'L', skin: '#d4a882', espn: 23910, starter: true, position: 'pit', role: 'SP', years: '1955–66',
    attrs: { velocity: 10, movement: 8, breaking: 11, changeup: 5, control: 8, command: 8, stamina: 9, groundball: 5, composure: 11, pitchIQ: 9 } },
  { name: "Clayton Kershaw", short: "Kershaw", team: 'LAD', number: 22, height: 76, weight: 225, age: null, bats: 'L', throws: 'L', skin: '#c89275', espn: 28963, starter: false, position: 'pit', role: 'SP', years: '2008–25',
    attrs: { velocity: 7, movement: 8, breaking: 11, changeup: 5, control: 9, command: 10, stamina: 8, groundball: 7, composure: 5, pitchIQ: 10 } },
  { name: "Don Drysdale", short: "Drysdale", team: 'LAD', number: 53, height: 77, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 21134, starter: false, position: 'pit', role: 'SP', years: '1956–69',
    attrs: { velocity: 9, movement: 9, breaking: 7, changeup: 5, control: 7, command: 7, stamina: 10, groundball: 8, composure: 7, pitchIQ: 8 } },
  { name: "Fernando Valenzuela", short: "Fernando", team: 'LAD', number: 34, height: 71, weight: 202, age: null, bats: 'L', throws: 'L', skin: '#b87b60', espn: 753, starter: false, position: 'pit', role: 'SP', years: '1980–90',
    attrs: { velocity: 4, movement: 7, breaking: 6, changeup: 10, control: 6, command: 7, stamina: 9, groundball: 6, composure: 9, pitchIQ: 8 } },
  { name: "Orel Hershiser", short: "Bulldog", team: 'LAD', number: 55, height: 75, weight: 195, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 1388, starter: false, position: 'pit', role: 'SP', years: '1983–94, 2000',
    attrs: { velocity: 6, movement: 9, breaking: 8, changeup: 6, control: 7, command: 8, stamina: 9, groundball: 9, composure: 10, pitchIQ: 9 } },

  // ─── MIA ─────────────────────────────────────────────────────────────
  { name: "Sandy Alcántara", short: "Alcántara", team: 'MIA', number: 22, height: 77, weight: 200, age: null, bats: 'R', throws: 'R', skin: '#9f674d', espn: 35241, starter: true, position: 'pit', role: 'SP', years: '2018–',
    attrs: { velocity: 9, movement: 8, breaking: 7, changeup: 9, control: 7, command: 7, stamina: 9, groundball: 8, composure: 5, pitchIQ: 7 } },
  { name: "José Fernández", short: "Fernández", team: 'MIA', number: 16, height: 75, weight: 244, age: null, bats: 'R', throws: 'R', skin: '#a87159', espn: 32567, starter: false, position: 'pit', role: 'SP', years: '2013–16',
    attrs: { velocity: 9, movement: 8, breaking: 10, changeup: 7, control: 7, command: 7, stamina: 5, groundball: 5, composure: 6, pitchIQ: 7 } },
  { name: "Josh Johnson", short: "J. Johnson", team: 'MIA', club: "Florida Marlins", number: 55, height: 79, weight: 245, age: null, bats: 'L', throws: 'R', skin: '#ab7b63', espn: 6435, starter: false, position: 'pit', role: 'SP', years: '2005–12',
    attrs: { velocity: 8, movement: 7, breaking: 8, changeup: 6, control: 7, command: 7, stamina: 5, groundball: 7, composure: 5, pitchIQ: 7 } },
  { name: "Dontrelle Willis", short: "D-Train", team: 'MIA', club: "Florida Marlins", number: 35, height: 74, weight: 232, age: null, bats: 'L', throws: 'L', skin: '#6d4639', espn: 5470, starter: false, position: 'pit', role: 'SP', years: '2003–07',
    attrs: { velocity: 6, movement: 8, breaking: 7, changeup: 6, control: 5, command: 5, stamina: 7, groundball: 7, composure: 6, pitchIQ: 6 } },
  { name: "Josh Beckett", short: "Beckett", team: 'MIA', club: "Florida Marlins", number: 21, height: 77, weight: 230, age: null, bats: 'R', throws: 'R', skin: '#a56f56', espn: 4242, starter: false, position: 'pit', role: 'SP', years: '2001–05',
    attrs: { velocity: 8, movement: 7, breaking: 9, changeup: 7, control: 7, command: 7, stamina: 6, groundball: 5, composure: 10, pitchIQ: 7 } },

  // ─── MIL ─────────────────────────────────────────────────────────────
  { name: "Corbin Burnes", short: "Burnes", team: 'MIL', number: 39, height: 75, weight: 245, age: null, bats: 'R', throws: 'R', skin: '#b57c66', espn: 39878, starter: true, position: 'pit', role: 'SP', years: '2018–23',
    attrs: { velocity: 8, movement: 10, breaking: 9, changeup: 7, control: 8, command: 8, stamina: 7, groundball: 7, composure: 6, pitchIQ: 8 } },
  { name: "Ben Sheets", short: "Sheets", team: 'MIL', number: 15, height: 73, weight: 226, age: null, bats: 'R', throws: 'R', skin: '#9a6455', espn: 4571, starter: false, position: 'pit', role: 'SP', years: '2001–08',
    attrs: { velocity: 7, movement: 6, breaking: 10, changeup: 5, control: 9, command: 8, stamina: 6, groundball: 5, composure: 5, pitchIQ: 7 } },
  { name: "Teddy Higuera", short: "Higuera", team: 'MIL', number: 49, height: 70, weight: 180, age: null, bats: 'S', throws: 'L', skin: '#b87b60', espn: 1570, starter: false, position: 'pit', role: 'SP', years: '1985–94',
    attrs: { velocity: 7, movement: 7, breaking: 7, changeup: 9, control: 7, command: 7, stamina: 7, groundball: 5, composure: 5, pitchIQ: 7 } },
  { name: "Josh Hader", short: "Hader", team: 'MIL', number: 71, height: 75, weight: 188, age: null, bats: 'L', throws: 'L', skin: '#bc8364', espn: 32760, starter: false, position: 'pit', role: 'CL', years: '2017–22',
    attrs: { velocity: 8, movement: 9, breaking: 9, changeup: 4, control: 5, command: 5, stamina: 2, groundball: 2, composure: 6, pitchIQ: 6 } },
  { name: "Devin Williams", short: "D. Williams", team: 'MIL', number: 38, height: 74, weight: 193, age: null, bats: 'R', throws: 'R', skin: '#a96d5a', espn: 33224, starter: false, position: 'pit', role: 'CL', years: '2019–24',
    attrs: { velocity: 6, movement: 8, breaking: 3, changeup: 11, control: 5, command: 5, stamina: 1, groundball: 6, composure: 6, pitchIQ: 7 } },

  // ─── MIN ─────────────────────────────────────────────────────────────
  { name: "Walter Johnson", short: "Big Train", team: 'MIN', club: "Washington Senators", number: null, height: 73, weight: 200, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 23414, starter: true, position: 'pit', role: 'SP', years: '1907–27',
    attrs: { velocity: 11, movement: 7, breaking: 5, changeup: 4, control: 9, command: 8, stamina: 11, groundball: 6, composure: 9, pitchIQ: 9 } },
  { name: "Johan Santana", short: "Johan", team: 'MIN', number: 57, height: 72, weight: 210, age: null, bats: 'L', throws: 'L', skin: '#98644a', espn: 4280, starter: false, position: 'pit', role: 'SP', years: '2000–07',
    attrs: { velocity: 7, movement: 8, breaking: 8, changeup: 11, control: 9, command: 9, stamina: 7, groundball: 5, composure: 6, pitchIQ: 9 } },
  { name: "Bert Blyleven", short: "Blyleven", team: 'MIN', number: 28, height: 75, weight: 220, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 519, starter: false, position: 'pit', role: 'SP', years: '1970–76, 1985–88',
    attrs: { velocity: 7, movement: 7, breaking: 11, changeup: 5, control: 8, command: 8, stamina: 10, groundball: 6, composure: 8, pitchIQ: 9 } },
  { name: "Jim Kaat", short: "Kitty", team: 'MIN', number: 36, height: 76, weight: 205, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 570, starter: false, position: 'pit', role: 'SP', years: '1959–73',
    attrs: { velocity: 6, movement: 7, breaking: 7, changeup: 5, control: 8, command: 8, stamina: 10, groundball: 7, composure: 6, pitchIQ: 8 } },
  { name: "Joe Nathan", short: "Nathan", team: 'MIN', number: 36, height: 76, weight: 230, age: null, bats: 'R', throws: 'R', skin: '#93685d', espn: 4044, starter: false, position: 'pit', role: 'CL', years: '2004–11',
    attrs: { velocity: 8, movement: 7, breaking: 9, changeup: 4, control: 7, command: 7, stamina: 2, groundball: 5, composure: 4, pitchIQ: 6 } },

  // ─── NYM ─────────────────────────────────────────────────────────────
  { name: "Tom Seaver", short: "Tom Terrific", team: 'NYM', number: 41, height: 73, weight: 195, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 645, starter: true, position: 'pit', role: 'SP', years: '1967–77, 1983',
    attrs: { velocity: 9, movement: 8, breaking: 8, changeup: 7, control: 9, command: 9, stamina: 10, groundball: 5, composure: 8, pitchIQ: 11 } },
  { name: "Dwight Gooden", short: "Doc", team: 'NYM', number: 16, height: 75, weight: 210, age: null, bats: 'R', throws: 'R', skin: '#7a4830', espn: 1424, starter: false, position: 'pit', role: 'SP', years: '1984–94',
    attrs: { velocity: 9, movement: 7, breaking: 10, changeup: 4, control: 7, command: 7, stamina: 8, groundball: 5, composure: 5, pitchIQ: 6 } },
  { name: "Jacob deGrom", short: "deGrom", team: 'NYM', number: 48, height: 76, weight: 180, age: null, bats: 'L', throws: 'R', skin: '#ce987c', espn: 32796, starter: false, position: 'pit', role: 'SP', years: '2014–22',
    attrs: { velocity: 11, movement: 8, breaking: 10, changeup: 9, control: 10, command: 9, stamina: 5, groundball: 5, composure: 7, pitchIQ: 9 } },
  { name: "Jerry Koosman", short: "Koosman", team: 'NYM', number: 36, height: 74, weight: 205, age: null, bats: 'R', throws: 'L', skin: '#d4a882', espn: 1028, starter: false, position: 'pit', role: 'SP', years: '1967–78',
    attrs: { velocity: 7, movement: 6, breaking: 8, changeup: 5, control: 7, command: 7, stamina: 9, groundball: 5, composure: 9, pitchIQ: 7 } },
  { name: "John Franco", short: "Franco", team: 'NYM', number: 45, height: 70, weight: 185, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 1414, starter: false, position: 'pit', role: 'CL', years: '1990–2004',
    attrs: { velocity: 4, movement: 6, breaking: 5, changeup: 10, control: 6, command: 6, stamina: 2, groundball: 8, composure: 6, pitchIQ: 8 } },

  // ─── NYY ─────────────────────────────────────────────────────────────
  { name: "Mariano Rivera", short: "Mo", team: 'NYY', number: 42, height: 74, weight: 195, age: null, bats: 'R', throws: 'R', skin: '#985d3c', espn: 3240, starter: true, position: 'pit', role: 'CL', years: '1995–2013',
    attrs: { velocity: 8, movement: 11, breaking: 2, changeup: 2, control: 10, command: 11, stamina: 3, groundball: 7, composure: 11, pitchIQ: 9 } },
  { name: "Whitey Ford", short: "Whitey", team: 'NYY', number: 16, height: 70, weight: 178, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 21678, starter: false, position: 'pit', role: 'SP', years: '1950–67',
    attrs: { velocity: 5, movement: 7, breaking: 8, changeup: 7, control: 7, command: 9, stamina: 7, groundball: 6, composure: 10, pitchIQ: 10 } },
  { name: "Ron Guidry", short: "Guidry", team: 'NYY', number: 49, height: 71, weight: 160, age: null, bats: 'L', throws: 'L', skin: '#cc9070', espn: 936, starter: false, position: 'pit', role: 'SP', years: '1975–88',
    attrs: { velocity: 8, movement: 7, breaking: 10, changeup: 3, control: 7, command: 7, stamina: 8, groundball: 4, composure: 8, pitchIQ: 7 } },
  { name: "Andy Pettitte", short: "Pettitte", team: 'NYY', number: 46, height: 77, weight: 225, age: null, bats: 'L', throws: 'L', skin: '#a06a54', espn: 3171, starter: false, position: 'pit', role: 'SP', years: '1995–2003, 2007–13',
    attrs: { velocity: 5, movement: 8, breaking: 7, changeup: 6, control: 7, command: 8, stamina: 8, groundball: 8, composure: 9, pitchIQ: 9 } },
  { name: "Lefty Gomez", short: "Gomez", team: 'NYY', number: 11, height: 74, weight: 173, age: null, bats: 'L', throws: 'L', skin: '#cc9070', espn: 22152, starter: false, position: 'pit', role: 'SP', years: '1930–42',
    attrs: { velocity: 8, movement: 6, breaking: 7, changeup: 5, control: 5, command: 6, stamina: 8, groundball: 4, composure: 10, pitchIQ: 7 } },

  // ─── PHI ─────────────────────────────────────────────────────────────
  { name: "Steve Carlton", short: "Lefty", team: 'PHI', number: 32, height: 76, weight: 210, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 526, starter: true, position: 'pit', role: 'SP', years: '1972–86',
    attrs: { velocity: 7, movement: 8, breaking: 11, changeup: 4, control: 6, command: 7, stamina: 10, groundball: 6, composure: 8, pitchIQ: 9 } },
  { name: "Robin Roberts", short: "Roberts", team: 'PHI', number: 36, height: 72, weight: 190, age: null, bats: 'S', throws: 'R', skin: '#d4a882', espn: 26835, starter: false, position: 'pit', role: 'SP', years: '1948–61',
    attrs: { velocity: 7, movement: 6, breaking: 5, changeup: 5, control: 10, command: 9, stamina: 10, groundball: 3, composure: 6, pitchIQ: 8 } },
  { name: "Grover Cleveland Alexander", short: "Alexander", team: 'PHI', number: null, height: 73, weight: 185, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 17591, starter: false, position: 'pit', role: 'SP', years: '1911–17, 1930',
    attrs: { velocity: 6, movement: 7, breaking: 8, changeup: 5, control: 10, command: 10, stamina: 10, groundball: 6, composure: 9, pitchIQ: 9 } },
  { name: "Cole Hamels", short: "Hamels", team: 'PHI', number: 35, height: 76, weight: 205, age: null, bats: 'L', throws: 'L', skin: '#ce9b86', espn: 6216, starter: false, position: 'pit', role: 'SP', years: '2006–15',
    attrs: { velocity: 6, movement: 7, breaking: 6, changeup: 10, control: 8, command: 8, stamina: 8, groundball: 6, composure: 9, pitchIQ: 8 } },
  { name: "Brad Lidge", short: "Lidge", team: 'PHI', number: 54, height: 77, weight: 215, age: null, bats: 'R', throws: 'R', skin: '#a07465', espn: 5102, starter: false, position: 'pit', role: 'CL', years: '2008–11',
    attrs: { velocity: 8, movement: 7, breaking: 10, changeup: 2, control: 4, command: 4, stamina: 1, groundball: 5, composure: 7, pitchIQ: 5 } },

  // ─── PIT ─────────────────────────────────────────────────────────────
  { name: "Babe Adams", short: "Adams", team: 'PIT', number: null, height: 71, weight: 185, age: null, bats: 'L', throws: 'R', skin: '#d4a882', espn: 17528, starter: true, position: 'pit', role: 'SP', years: '1907–26',
    attrs: { velocity: 5, movement: 7, breaking: 7, changeup: 5, control: 10, command: 9, stamina: 8, groundball: 6, composure: 10, pitchIQ: 8 } },
  { name: "Wilbur Cooper", short: "Cooper", team: 'PIT', number: null, height: 71, weight: 175, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 20433, starter: false, position: 'pit', role: 'SP', years: '1912–24',
    attrs: { velocity: 6, movement: 6, breaking: 6, changeup: 5, control: 7, command: 7, stamina: 9, groundball: 6, composure: 5, pitchIQ: 7 } },
  { name: "Vern Law", short: "Deacon", team: 'PIT', number: 32, height: 74, weight: 195, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 24115, starter: false, position: 'pit', role: 'SP', years: '1950–67',
    attrs: { velocity: 5, movement: 7, breaking: 6, changeup: 6, control: 9, command: 8, stamina: 8, groundball: 7, composure: 8, pitchIQ: 8 } },
  { name: "Roy Face", short: "Face", team: 'PIT', number: 26, height: 68, weight: 155, age: null, bats: 'S', throws: 'R', skin: '#d4a882', espn: 21423, starter: false, position: 'pit', role: 'RP', years: '1953–68',
    attrs: { velocity: 4, movement: 7, breaking: 4, changeup: 10, control: 7, command: 7, stamina: 4, groundball: 7, composure: 7, pitchIQ: 7 } },
  { name: "Kent Tekulve", short: "Teke", team: 'PIT', number: 27, height: 76, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#dfac9c', espn: 657, starter: false, position: 'pit', role: 'CL', years: '1974–85',
    attrs: { velocity: 2, movement: 10, breaking: 5, changeup: 4, control: 6, command: 7, stamina: 5, groundball: 11, composure: 8, pitchIQ: 7 } },

  // ─── SD ──────────────────────────────────────────────────────────────
  { name: "Trevor Hoffman", short: "Hoffman", team: 'SD', number: 51, height: 72, weight: 221, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 2817, starter: true, position: 'pit', role: 'CL', years: '1993–2008',
    attrs: { velocity: 4, movement: 6, breaking: 4, changeup: 11, control: 9, command: 9, stamina: 2, groundball: 5, composure: 5, pitchIQ: 8 } },
  { name: "Jake Peavy", short: "Peavy", team: 'SD', number: 44, height: 73, weight: 180, age: null, bats: 'R', throws: 'R', skin: '#b17864', espn: 5019, starter: false, position: 'pit', role: 'SP', years: '2002–09',
    attrs: { velocity: 7, movement: 7, breaking: 9, changeup: 6, control: 7, command: 7, stamina: 7, groundball: 4, composure: 4, pitchIQ: 8 } },
  { name: "Randy Jones", short: "R. Jones", team: 'SD', number: 35, height: 72, weight: 178, age: null, bats: 'R', throws: 'L', skin: '#d4a882', espn: 569, starter: false, position: 'pit', role: 'SP', years: '1973–80',
    attrs: { velocity: 1, movement: 9, breaking: 5, changeup: 6, control: 9, command: 9, stamina: 9, groundball: 10, composure: 5, pitchIQ: 8 } },
  { name: "Andy Benes", short: "Benes", team: 'SD', number: 40, height: 78, weight: 245, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 2222, starter: false, position: 'pit', role: 'SP', years: '1989–95',
    attrs: { velocity: 7, movement: 6, breaking: 8, changeup: 4, control: 6, command: 6, stamina: 8, groundball: 4, composure: 5, pitchIQ: 6 } },
  { name: "Eric Show", short: "Show", team: 'SD', number: 30, height: 73, weight: 185, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 867, starter: false, position: 'pit', role: 'SP', years: '1981–90',
    attrs: { velocity: 6, movement: 7, breaking: 7, changeup: 5, control: 6, command: 6, stamina: 7, groundball: 6, composure: 4, pitchIQ: 6 } },

  // ─── SEA ─────────────────────────────────────────────────────────────
  { name: "Félix Hernández", short: "King Félix", team: 'SEA', number: 34, height: 75, weight: 225, age: null, bats: 'R', throws: 'R', skin: '#ab6b52', espn: 6194, starter: true, position: 'pit', role: 'SP', years: '2005–19',
    attrs: { velocity: 8, movement: 9, breaking: 8, changeup: 10, control: 8, command: 8, stamina: 9, groundball: 8, composure: 6, pitchIQ: 8 } },
  { name: "Jamie Moyer", short: "Moyer", team: 'SEA', number: 50, height: 72, weight: 185, age: null, bats: 'L', throws: 'L', skin: '#a67f6b', espn: 1799, starter: false, position: 'pit', role: 'SP', years: '1996–2006',
    attrs: { velocity: 0, movement: 6, breaking: 6, changeup: 10, control: 8, command: 9, stamina: 9, groundball: 4, composure: 6, pitchIQ: 10 } },
  { name: "Mark Langston", short: "Langston", team: 'SEA', number: 12, height: 74, weight: 184, age: null, bats: 'R', throws: 'L', skin: '#d4a882', espn: 1428, starter: false, position: 'pit', role: 'SP', years: '1984–89',
    attrs: { velocity: 8, movement: 6, breaking: 8, changeup: 5, control: 5, command: 6, stamina: 8, groundball: 5, composure: 5, pitchIQ: 7 } },
  { name: "Kazuhiro Sasaki", short: "Sasaki", team: 'SEA', number: 22, height: 76, weight: 220, age: null, bats: 'R', throws: 'R', skin: '#cc9272', espn: 4218, starter: false, position: 'pit', role: 'CL', years: '2000–03',
    attrs: { velocity: 6, movement: 6, breaking: 5, changeup: 10, control: 7, command: 7, stamina: 2, groundball: 6, composure: 7, pitchIQ: 7 } },
  { name: "Freddy García", short: "García", team: 'SEA', number: 34, height: 76, weight: 250, age: null, bats: 'R', throws: 'R', skin: '#815341', espn: 4007, starter: false, position: 'pit', role: 'SP', years: '1999–2004',
    attrs: { velocity: 7, movement: 6, breaking: 7, changeup: 6, control: 6, command: 7, stamina: 8, groundball: 6, composure: 8, pitchIQ: 7 } },

  // ─── SF ──────────────────────────────────────────────────────────────
  { name: "Christy Mathewson", short: "Matty", team: 'SF', club: "New York Giants", number: null, height: 73, weight: 195, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 24735, starter: true, position: 'pit', role: 'SP', years: '1900–16',
    attrs: { velocity: 7, movement: 8, breaking: 8, changeup: 10, control: 11, command: 11, stamina: 10, groundball: 6, composure: 11, pitchIQ: 11 } },
  { name: "Juan Marichal", short: "Marichal", team: 'SF', number: 27, height: 72, weight: 185, age: null, bats: 'R', throws: 'R', skin: '#8a5038', espn: 24640, starter: false, position: 'pit', role: 'SP', years: '1960–73',
    attrs: { velocity: 7, movement: 8, breaking: 8, changeup: 8, control: 10, command: 10, stamina: 10, groundball: 5, composure: 5, pitchIQ: 9 } },
  { name: "Carl Hubbell", short: "King Carl", team: 'SF', club: "New York Giants", number: 11, height: 72, weight: 170, age: null, bats: 'R', throws: 'L', skin: '#d4a882', espn: 23143, starter: false, position: 'pit', role: 'SP', years: '1928–43',
    attrs: { velocity: 5, movement: 8, breaking: 7, changeup: 11, control: 9, command: 9, stamina: 9, groundball: 7, composure: 9, pitchIQ: 9 } },
  { name: "Madison Bumgarner", short: "MadBum", team: 'SF', number: 40, height: 76, weight: 240, age: null, bats: 'R', throws: 'L', skin: '#b2795f', espn: 29949, starter: false, position: 'pit', role: 'SP', years: '2009–19',
    attrs: { velocity: 6, movement: 8, breaking: 8, changeup: 5, control: 9, command: 8, stamina: 9, groundball: 5, composure: 11, pitchIQ: 8 } },
  { name: "Tim Lincecum", short: "The Freak", team: 'SF', number: 55, height: 71, weight: 170, age: null, bats: 'L', throws: 'R', skin: '#bd8a78', espn: 28705, starter: false, position: 'pit', role: 'SP', years: '2007–15',
    attrs: { velocity: 8, movement: 8, breaking: 8, changeup: 9, control: 5, command: 6, stamina: 7, groundball: 6, composure: 8, pitchIQ: 7 } },

  // ─── STL ─────────────────────────────────────────────────────────────
  { name: "Bob Gibson", short: "Gibby", team: 'STL', number: 45, height: 73, weight: 195, age: null, bats: 'R', throws: 'R', skin: '#7a4030', espn: 22014, starter: true, position: 'pit', role: 'SP', years: '1959–75',
    attrs: { velocity: 9, movement: 8, breaking: 10, changeup: 4, control: 7, command: 8, stamina: 10, groundball: 6, composure: 11, pitchIQ: 8 } },
  { name: "Dizzy Dean", short: "Dizzy", team: 'STL', number: 17, height: 74, weight: 182, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 20820, starter: false, position: 'pit', role: 'SP', years: '1930–37',
    attrs: { velocity: 9, movement: 6, breaking: 8, changeup: 7, control: 8, command: 8, stamina: 9, groundball: 5, composure: 9, pitchIQ: 6 } },
  { name: "Adam Wainwright", short: "Waino", team: 'STL', number: 50, height: 79, weight: 230, age: null, bats: 'R', throws: 'R', skin: '#a16d5a', espn: 5403, starter: false, position: 'pit', role: 'SP', years: '2005–23',
    attrs: { velocity: 4, movement: 8, breaking: 10, changeup: 6, control: 8, command: 8, stamina: 9, groundball: 7, composure: 10, pitchIQ: 9 } },
  { name: "Chris Carpenter", short: "Carpenter", team: 'STL', number: 29, height: 78, weight: 230, age: null, bats: 'R', throws: 'R', skin: '#b07962', espn: 3610, starter: false, position: 'pit', role: 'SP', years: '2004–12',
    attrs: { velocity: 7, movement: 9, breaking: 9, changeup: 5, control: 8, command: 8, stamina: 8, groundball: 8, composure: 10, pitchIQ: 8 } },
  { name: "Jason Isringhausen", short: "Izzy", team: 'STL', number: 44, height: 75, weight: 230, age: null, bats: 'R', throws: 'R', skin: '#a96d5a', espn: 3289, starter: false, position: 'pit', role: 'CL', years: '2002–08',
    attrs: { velocity: 7, movement: 6, breaking: 8, changeup: 4, control: 5, command: 5, stamina: 2, groundball: 6, composure: 5, pitchIQ: 6 } },

  // ─── TB ──────────────────────────────────────────────────────────────
  { name: "David Price", short: "Price", team: 'TB', number: 14, height: 77, weight: 215, age: null, bats: 'L', throws: 'L', skin: '#7a4830', espn: 28958, starter: true, position: 'pit', role: 'SP', years: '2008–14',
    attrs: { velocity: 8, movement: 7, breaking: 7, changeup: 8, control: 8, command: 8, stamina: 8, groundball: 6, composure: 4, pitchIQ: 8 } },
  { name: "James Shields", short: "Big Game", team: 'TB', number: 33, height: 75, weight: 215, age: null, bats: 'R', throws: 'R', skin: '#a87761', espn: 28474, starter: false, position: 'pit', role: 'SP', years: '2006–12',
    attrs: { velocity: 5, movement: 6, breaking: 7, changeup: 9, control: 7, command: 8, stamina: 9, groundball: 6, composure: 5, pitchIQ: 8 } },
  { name: "Blake Snell", short: "Snell", team: 'TB', number: 4, height: 76, weight: 225, age: null, bats: 'L', throws: 'L', skin: '#cb9581', espn: 33748, starter: false, position: 'pit', role: 'SP', years: '2016–20',
    attrs: { velocity: 8, movement: 7, breaking: 10, changeup: 7, control: 3, command: 4, stamina: 4, groundball: 5, composure: 7, pitchIQ: 7 } },
  { name: "Scott Kazmir", short: "Kazmir", team: 'TB', number: 19, height: 72, weight: 195, age: null, bats: 'L', throws: 'L', skin: '#b28376', espn: 5917, starter: false, position: 'pit', role: 'SP', years: '2004–09',
    attrs: { velocity: 8, movement: 7, breaking: 9, changeup: 6, control: 4, command: 4, stamina: 5, groundball: 4, composure: 5, pitchIQ: 6 } },
  { name: "Fernando Rodney", short: "Rodney", team: 'TB', number: 56, height: 71, weight: 240, age: null, bats: 'R', throws: 'R', skin: '#875247', espn: 5111, starter: false, position: 'pit', role: 'CL', years: '2012–13',
    attrs: { velocity: 8, movement: 6, breaking: 3, changeup: 10, control: 4, command: 4, stamina: 2, groundball: 7, composure: 5, pitchIQ: 5 } },

  // ─── TEX ─────────────────────────────────────────────────────────────
  { name: "Nolan Ryan", short: "Ryan Express", team: 'TEX', number: 34, height: 74, weight: 170, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 741, starter: true, position: 'pit', role: 'SP', years: '1989–93',
    attrs: { velocity: 11, movement: 7, breaking: 10, changeup: 7, control: 3, command: 5, stamina: 11, groundball: 5, composure: 6, pitchIQ: 9 } },
  { name: "Kenny Rogers", short: "Rogers", team: 'TEX', number: 37, height: 73, weight: 190, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 1834, starter: false, position: 'pit', role: 'SP', years: '1989–95, 2000–02, 2004–05',
    attrs: { velocity: 3, movement: 6, breaking: 7, changeup: 8, control: 7, command: 8, stamina: 8, groundball: 7, composure: 6, pitchIQ: 9 } },
  { name: "Charlie Hough", short: "Hough", team: 'TEX', number: 49, height: 74, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 43065, starter: false, position: 'pit', role: 'SP', years: '1980–90',
    attrs: { velocity: 0, movement: 10, breaking: 3, changeup: 6, control: 4, command: 4, stamina: 9, groundball: 5, composure: 6, pitchIQ: 8 } },
  { name: "Yu Darvish", short: "Darvish", team: 'TEX', number: 11, height: 77, weight: 220, age: null, bats: 'R', throws: 'R', skin: '#b67856', espn: 32055, starter: false, position: 'pit', role: 'SP', years: '2012–17',
    attrs: { velocity: 8, movement: 8, breaking: 10, changeup: 8, control: 6, command: 7, stamina: 6, groundball: 5, composure: 4, pitchIQ: 10 } },
  { name: "Neftalí Feliz", short: "Feliz", team: 'TEX', number: 30, height: 75, weight: 235, age: null, bats: 'R', throws: 'R', skin: '#9a5838', espn: 30149, starter: false, position: 'pit', role: 'CL', years: '2009–15',
    attrs: { velocity: 10, movement: 6, breaking: 6, changeup: 5, control: 5, command: 5, stamina: 2, groundball: 4, composure: 5, pitchIQ: 4 } },

  // ─── TOR ─────────────────────────────────────────────────────────────
  { name: "Roy Halladay", short: "Doc", team: 'TOR', number: 32, height: 78, weight: 225, age: null, bats: 'R', throws: 'R', skin: '#b17767', espn: 3973, starter: true, position: 'pit', role: 'SP', years: '1998–2009',
    attrs: { velocity: 7, movement: 9, breaking: 9, changeup: 8, control: 10, command: 11, stamina: 10, groundball: 8, composure: 9, pitchIQ: 9 } },
  { name: "Dave Stieb", short: "Stieb", team: 'TOR', number: 37, height: 72, weight: 185, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 1005, starter: false, position: 'pit', role: 'SP', years: '1979–92, 1998',
    attrs: { velocity: 8, movement: 8, breaking: 10, changeup: 4, control: 6, command: 7, stamina: 9, groundball: 6, composure: 5, pitchIQ: 8 } },
  { name: "Jimmy Key", short: "Key", team: 'TOR', number: 22, height: 73, weight: 185, age: null, bats: 'R', throws: 'L', skin: '#d4a882', espn: 1477, starter: false, position: 'pit', role: 'SP', years: '1984–92',
    attrs: { velocity: 4, movement: 7, breaking: 7, changeup: 8, control: 9, command: 9, stamina: 7, groundball: 6, composure: 8, pitchIQ: 9 } },
  { name: "Tom Henke", short: "Henke", team: 'TOR', number: 50, height: 77, weight: 225, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 1224, starter: false, position: 'pit', role: 'CL', years: '1985–92',
    attrs: { velocity: 8, movement: 6, breaking: 5, changeup: 9, control: 7, command: 7, stamina: 2, groundball: 3, composure: 7, pitchIQ: 6 } },
  { name: "Pat Hentgen", short: "Hentgen", team: 'TOR', number: 41, height: 74, weight: 202, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 2586, starter: false, position: 'pit', role: 'SP', years: '1991–99, 2004',
    attrs: { velocity: 6, movement: 6, breaking: 8, changeup: 5, control: 6, command: 6, stamina: 9, groundball: 5, composure: 6, pitchIQ: 7 } },

  // ─── WSH ─────────────────────────────────────────────────────────────
  { name: "Max Scherzer", short: "Mad Max", team: 'WSH', number: 31, height: 75, weight: 208, age: null, bats: 'R', throws: 'R', skin: '#c29278', espn: 28976, starter: true, position: 'pit', role: 'SP', years: '2015–21',
    attrs: { velocity: 8, movement: 8, breaking: 10, changeup: 8, control: 9, command: 9, stamina: 8, groundball: 3, composure: 8, pitchIQ: 10 } },
  { name: "Stephen Strasburg", short: "Strasburg", team: 'WSH', number: 37, height: 77, weight: 239, age: null, bats: 'R', throws: 'R', skin: '#ae8071', espn: 30373, starter: false, position: 'pit', role: 'SP', years: '2010–22',
    attrs: { velocity: 9, movement: 7, breaking: 10, changeup: 10, control: 8, command: 8, stamina: 5, groundball: 6, composure: 10, pitchIQ: 8 } },
  { name: "Steve Rogers", short: "S. Rogers", team: 'WSH', club: "Montreal Expos", number: 45, height: 74, weight: 175, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 633, starter: false, position: 'pit', role: 'SP', years: '1973–85',
    attrs: { velocity: 6, movement: 8, breaking: 7, changeup: 6, control: 7, command: 7, stamina: 9, groundball: 8, composure: 4, pitchIQ: 7 } },
  { name: "Dennis Martínez", short: "El Presidente", team: 'WSH', club: "Montreal Expos", number: 32, height: 73, weight: 180, age: null, bats: 'R', throws: 'R', skin: '#a7725e', espn: 963, starter: false, position: 'pit', role: 'SP', years: '1986–93',
    attrs: { velocity: 5, movement: 7, breaking: 9, changeup: 6, control: 8, command: 8, stamina: 9, groundball: 6, composure: 6, pitchIQ: 9 } },
  { name: "Jeff Reardon", short: "Reardon", team: 'WSH', club: "Montreal Expos", number: 41, height: 72, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 625, starter: false, position: 'pit', role: 'CL', years: '1981–86',
    attrs: { velocity: 7, movement: 6, breaking: 7, changeup: 3, control: 7, command: 7, stamina: 3, groundball: 4, composure: 8, pitchIQ: 6 } },
]
