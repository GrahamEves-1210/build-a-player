// ALL-TIME batters for baseball, Build-A-Player's fourth sport (pool key 'alltime', label ALL-TIME).
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
// RUBRIC (batters)
//   contact      career AVG and batting titles, hit totals, how hard he was to beat on contact
//   power        HR, ISO / SLG against his league, HR titles (Statcast barrels for the recent ones)
//   eye          walk rate and OBP over AVG, walk titles
//   avoidK       strikeout rate against his league (the few-K hitters of every era at the top)
//   gap          doubles and triples, extra-base hits that weren't home runs
//   speed        reputation and record of his legs (triples, steals, range), Statcast sprint speed when there is one
//   baserunning  stolen bases and SB%, extra bases taken, baserunning runs (BsR / Rbaser) where it exists
//   fielding     Gold Gloves, Total Zone / DRS / OAA defensive runs, reputation at his spot (DH or 1B-only bats low)
//   arm          outfield assists and runner kills, catchers' caught-stealing rate, reputation (DH low)
//   clutch       postseason line and World Series moments, high-leverage record, WPA where it exists
// Most legends sit B to A-. S is a handful per trait in this file; the real weaknesses stay in.
//
// EVIDENCE NOTES (the S grades)
//   contact S   Ty Cobb (.366, 11 or 12 batting titles), Rogers Hornsby (.358, .424 in 1924), Ted Williams (.344, .406 in
//               1941), Tony Gwynn (.338, 8 titles), Ichiro (262 hits in 2004, 10 straight 200-hit years).
//   power S     Babe Ruth (714, slugged .690, out-homered whole teams), Barry Bonds (762, 73 in 2001), Mark McGwire (583,
//               HR every 10.6 AB, 70 in 1998), Giancarlo Stanton (the hardest-hit balls of the Statcast era), Aaron Judge
//               (62 in 2022, the top barrel rates of the era).
//   eye S       Ruth (2,062 BB), Ted Williams (.482 OBP, all-time best), Rickey Henderson (2,190 BB, the leadoff walk),
//               Barry Bonds (2,558 BB, 232 in 2004), Frank Thomas (.419 OBP, 100+ BB ten times).
//   avoidK S    Joe DiMaggio (369 K against 361 HR), Tony Gwynn (434 K in 10,232 PA), Nellie Fox (216 K in 10,351 PA),
//               Yogi Berra (414 K, never more than 38), Stan Musial (696 K in 12,721 PA), Tris Speaker.
//   gap S       Tris Speaker (792 doubles, the record), Stan Musial (725 2B, 177 3B), Ty Cobb (724 2B, 295 3B), Honus
//               Wagner (643 2B, 252 3B).
//   speed S     Rickey Henderson, Tim Raines, Willie Wilson (the fastest players of their eras: 1,406 / 808 / 668 SB,
//               Wilson's 13 inside-the-park HR and 5 triples titles).
//   baserunning S  Rickey (1,406 SB, the record), Tim Raines (84.7%, best of anyone with 400+ tries), Ty Cobb (897 SB, 54
//               steals of home), Jackie Robinson (19 steals of home, the most feared runner of his day).
//   fielding S  Ozzie Smith (13 Gold Gloves, the most defensive runs at SS), Brooks Robinson (16 GG at 3B), Andruw Jones
//               (10 GG, the most defensive runs of any CF), Willie Mays (12 GG, The Catch), Keith Hernandez (11 straight GG
//               at 1B), Yadier Molina (9 GG, the catcher every runner stopped running on).
//   arm S       Roberto Clemente (266 OF assists, 12 GG), Ichiro ("The Throw", 2001), Vladimir Guerrero, Johnny Bench and
//               Iván Rodríguez (caught-stealing rates near 45-50%, 10 and 13 Gold Gloves).
//   clutch S    Reggie Jackson (Mr. October: 3 HR on 3 pitches, 1977), David Ortiz (2004 ALCS walk-offs, 2013 WS .688),
//               Derek Jeter (Mr. November, 200 postseason hits), Kirby Puckett (Game 6, 1991), Mickey Mantle (18 World
//               Series HR, the record).
//   Also: Ohtani is here as an Angel (2018-23, the two-way MVP years); as a DH his fielding is low and his arm high (he
//   throws 100). Judge's avoidK is low on purpose (27% K). Catchers' speed and DHs' fielding are real weaknesses.

export const MLB_LEGEND_BATTERS = [

  // ─── ARI ─────────────────────────────────────────────────────────────
  { name: "Paul Goldschmidt", short: "Goldschmidt", team: 'ARI', number: 44, height: 74, weight: 225, age: null, bats: 'R', throws: 'R', skin: '#c49378', espn: 31027, starter: true, position: 'bat', role: '1B', years: '2011–18',
    attrs: { contact: 8, power: 8, eye: 8, avoidK: 5, gap: 8, speed: 5, baserunning: 7, fielding: 7, arm: 4, clutch: 6 } },
  { name: "Luis González", short: "Gonzo", team: 'ARI', number: 20, height: 74, weight: 180, age: null, bats: 'L', throws: 'R', skin: '#b87b60', espn: 2419, starter: false, position: 'bat', role: 'LF', years: '1999–2006',
    attrs: { contact: 7, power: 8, eye: 7, avoidK: 7, gap: 8, speed: 4, baserunning: 5, fielding: 4, arm: 3, clutch: 10 } },
  { name: "Ketel Marte", short: "Marte", team: 'ARI', number: 4, height: 72, weight: 210, age: null, bats: 'S', throws: 'R', skin: '#9d6448', espn: 32512, starter: false, position: 'bat', role: '2B', years: '2017–',
    attrs: { contact: 8, power: 7, eye: 6, avoidK: 7, gap: 8, speed: 6, baserunning: 5, fielding: 5, arm: 5, clutch: 8 } },
  { name: "Steve Finley", short: "Finley", team: 'ARI', number: 12, height: 74, weight: 195, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 2150, starter: false, position: 'bat', role: 'CF', years: '1999–2004',
    attrs: { contact: 5, power: 6, eye: 5, avoidK: 6, gap: 7, speed: 7, baserunning: 7, fielding: 8, arm: 6, clutch: 6 } },
  { name: "Matt Williams", short: "M. Williams", team: 'ARI', number: 9, height: 74, weight: 210, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 1881, starter: false, position: 'bat', role: '3B', years: '1998–2003',
    attrs: { contact: 5, power: 8, eye: 2, avoidK: 4, gap: 5, speed: 4, baserunning: 4, fielding: 8, arm: 8, clutch: 7 } },

  // ─── ATH ─────────────────────────────────────────────────────────────
  { name: "Rickey Henderson", short: "Rickey", team: 'ATH', club: "Oakland Athletics", number: 24, height: 70, weight: 190, age: null, bats: 'R', throws: 'L', skin: '#7a4830', espn: 449, starter: true, position: 'bat', role: 'LF', years: '1979–98',
    attrs: { contact: 7, power: 6, eye: 11, avoidK: 7, gap: 6, speed: 11, baserunning: 11, fielding: 6, arm: 3, clutch: 8 } },
  { name: "Jimmie Foxx", short: "Foxx", team: 'ATH', club: "Philadelphia Athletics", number: 3, height: 72, weight: 195, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 21723, starter: false, position: 'bat', role: '1B', years: '1925–35',
    attrs: { contact: 9, power: 10, eye: 9, avoidK: 5, gap: 8, speed: 4, baserunning: 4, fielding: 5, arm: 5, clutch: 8 } },
  { name: "Reggie Jackson", short: "Reggie", team: 'ATH', club: "Oakland Athletics", number: 9, height: 72, weight: 195, age: null, bats: 'L', throws: 'L', skin: '#8a5038', espn: 128, starter: false, position: 'bat', role: 'RF', years: '1967–75',
    attrs: { contact: 4, power: 10, eye: 7, avoidK: 1, gap: 6, speed: 6, baserunning: 6, fielding: 4, arm: 7, clutch: 11 } },
  { name: "Mark McGwire", short: "McGwire", team: 'ATH', club: "Oakland Athletics", number: 25, height: 77, weight: 225, age: null, bats: 'R', throws: 'R', skin: '#dfac9c', espn: 43201, starter: false, position: 'bat', role: '1B', years: '1986–97',
    attrs: { contact: 4, power: 11, eye: 9, avoidK: 3, gap: 3, speed: 1, baserunning: 2, fielding: 5, arm: 3, clutch: 5 } },
  { name: "Al Simmons", short: "Simmons", team: 'ATH', club: "Philadelphia Athletics", number: 7, height: 71, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 27533, starter: false, position: 'bat', role: 'LF', years: '1924–32',
    attrs: { contact: 10, power: 8, eye: 5, avoidK: 7, gap: 9, speed: 5, baserunning: 5, fielding: 6, arm: 6, clutch: 8 } },

  // ─── ATL ─────────────────────────────────────────────────────────────
  { name: "Hank Aaron", short: "Aaron", team: 'ATL', number: 44, height: 72, weight: 180, age: null, bats: 'R', throws: 'R', skin: '#7a4030', espn: 17499, starter: true, position: 'bat', role: 'RF', years: '1954–74',
    attrs: { contact: 9, power: 10, eye: 7, avoidK: 8, gap: 9, speed: 6, baserunning: 7, fielding: 7, arm: 8, clutch: 8 } },
  { name: "Chipper Jones", short: "Chipper", team: 'ATL', number: 10, height: 76, weight: 210, age: null, bats: 'S', throws: 'R', skin: '#bc7e69', espn: 3006, starter: false, position: 'bat', role: '3B', years: '1993–2012',
    attrs: { contact: 9, power: 8, eye: 9, avoidK: 7, gap: 8, speed: 4, baserunning: 5, fielding: 5, arm: 6, clutch: 7 } },
  { name: "Eddie Mathews", short: "Mathews", team: 'ATL', number: 41, height: 73, weight: 190, age: null, bats: 'L', throws: 'R', skin: '#d4a882', espn: 24733, starter: false, position: 'bat', role: '3B', years: '1952–66',
    attrs: { contact: 6, power: 9, eye: 9, avoidK: 5, gap: 6, speed: 4, baserunning: 4, fielding: 6, arm: 6, clutch: 6 } },
  { name: "Dale Murphy", short: "Murphy", team: 'ATL', number: 3, height: 76, weight: 210, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 413, starter: false, position: 'bat', role: 'CF', years: '1976–90',
    attrs: { contact: 6, power: 8, eye: 6, avoidK: 3, gap: 6, speed: 6, baserunning: 6, fielding: 7, arm: 6, clutch: 5 } },
  { name: "Andruw Jones", short: "Andruw", team: 'ATL', number: 25, height: 73, weight: 210, age: null, bats: 'R', throws: 'R', skin: '#87523a', espn: 3520, starter: false, position: 'bat', role: 'CF', years: '1996–2007',
    attrs: { contact: 5, power: 8, eye: 6, avoidK: 4, gap: 5, speed: 6, baserunning: 5, fielding: 11, arm: 8, clutch: 6 } },

  // ─── BAL ─────────────────────────────────────────────────────────────
  { name: "Cal Ripken Jr.", short: "Ripken", team: 'BAL', number: 8, height: 76, weight: 220, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 789, starter: true, position: 'bat', role: 'SS', years: '1981–2001',
    attrs: { contact: 6, power: 7, eye: 6, avoidK: 7, gap: 8, speed: 3, baserunning: 4, fielding: 9, arm: 8, clutch: 7 } },
  { name: "Brooks Robinson", short: "B. Robinson", team: 'BAL', number: 5, height: 73, weight: 180, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 26850, starter: false, position: 'bat', role: '3B', years: '1955–77',
    attrs: { contact: 5, power: 5, eye: 5, avoidK: 8, gap: 6, speed: 2, baserunning: 3, fielding: 11, arm: 8, clutch: 9 } },
  { name: "Frank Robinson", short: "F. Robinson", team: 'BAL', number: 20, height: 73, weight: 183, age: null, bats: 'R', throws: 'R', skin: '#7a4030', espn: 26857, starter: false, position: 'bat', role: 'RF', years: '1966–71',
    attrs: { contact: 8, power: 10, eye: 8, avoidK: 6, gap: 8, speed: 6, baserunning: 7, fielding: 6, arm: 6, clutch: 9 } },
  { name: "Eddie Murray", short: "Murray", team: 'BAL', number: 33, height: 74, weight: 222, age: null, bats: 'S', throws: 'R', skin: '#7a4830', espn: 415, starter: false, position: 'bat', role: '1B', years: '1977–88',
    attrs: { contact: 8, power: 8, eye: 7, avoidK: 8, gap: 7, speed: 3, baserunning: 4, fielding: 7, arm: 4, clutch: 8 } },
  { name: "George Sisler", short: "Sisler", team: 'BAL', club: "St. Louis Browns", number: null, height: 71, weight: 170, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 27563, starter: false, position: 'bat', role: '1B', years: '1915–27',
    attrs: { contact: 10, power: 4, eye: 5, avoidK: 10, gap: 8, speed: 8, baserunning: 8, fielding: 7, arm: 6, clutch: 5 } },

  // ─── BOS ─────────────────────────────────────────────────────────────
  { name: "Ted Williams", short: "T. Williams", team: 'BOS', number: 9, height: 75, weight: 205, age: null, bats: 'L', throws: 'R', skin: '#d4a882', espn: 28096, starter: true, position: 'bat', role: 'LF', years: '1939–60',
    attrs: { contact: 11, power: 10, eye: 11, avoidK: 9, gap: 8, speed: 3, baserunning: 3, fielding: 3, arm: 4, clutch: 6 } },
  { name: "Carl Yastrzemski", short: "Yaz", team: 'BOS', number: 8, height: 71, weight: 175, age: null, bats: 'L', throws: 'R', skin: '#d4a882', espn: 336, starter: false, position: 'bat', role: 'LF', years: '1961–83',
    attrs: { contact: 8, power: 7, eye: 8, avoidK: 7, gap: 8, speed: 4, baserunning: 4, fielding: 8, arm: 7, clutch: 9 } },
  { name: "David Ortiz", short: "Big Papi", team: 'BOS', number: 34, height: 75, weight: 230, age: null, bats: 'L', throws: 'L', skin: '#644536', espn: 3748, starter: false, position: 'bat', role: 'DH', years: '2003–16',
    attrs: { contact: 7, power: 9, eye: 8, avoidK: 4, gap: 9, speed: 1, baserunning: 2, fielding: 1, arm: 2, clutch: 11 } },
  { name: "Wade Boggs", short: "Boggs", team: 'BOS', number: 26, height: 74, weight: 197, age: null, bats: 'L', throws: 'R', skin: '#d4a882', espn: 1098, starter: false, position: 'bat', role: '3B', years: '1982–92',
    attrs: { contact: 10, power: 3, eye: 10, avoidK: 10, gap: 8, speed: 3, baserunning: 3, fielding: 6, arm: 5, clutch: 5 } },
  { name: "Carlton Fisk", short: "Fisk", team: 'BOS', number: 27, height: 75, weight: 200, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 106, starter: false, position: 'bat', role: 'C', years: '1969–80',
    attrs: { contact: 5, power: 7, eye: 5, avoidK: 5, gap: 6, speed: 3, baserunning: 4, fielding: 7, arm: 7, clutch: 9 } },

  // ─── CHC ─────────────────────────────────────────────────────────────
  { name: "Ernie Banks", short: "Banks", team: 'CHC', number: 14, height: 73, weight: 180, age: null, bats: 'R', throws: 'R', skin: '#7a4830', espn: 18870, starter: true, position: 'bat', role: 'SS', years: '1953–71',
    attrs: { contact: 6, power: 9, eye: 4, avoidK: 6, gap: 6, speed: 4, baserunning: 3, fielding: 6, arm: 6, clutch: 5 } },
  { name: "Ron Santo", short: "Santo", team: 'CHC', number: 10, height: 72, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 27110, starter: false, position: 'bat', role: '3B', years: '1960–73',
    attrs: { contact: 6, power: 7, eye: 8, avoidK: 5, gap: 6, speed: 3, baserunning: 3, fielding: 8, arm: 7, clutch: 5 } },
  { name: "Ryne Sandberg", short: "Sandberg", team: 'CHC', number: 23, height: 74, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 864, starter: false, position: 'bat', role: '2B', years: '1982–97',
    attrs: { contact: 7, power: 7, eye: 6, avoidK: 6, gap: 7, speed: 7, baserunning: 7, fielding: 10, arm: 6, clutch: 7 } },
  { name: "Billy Williams", short: "B. Williams", team: 'CHC', number: 26, height: 73, weight: 175, age: null, bats: 'L', throws: 'R', skin: '#7a4830', espn: 28058, starter: false, position: 'bat', role: 'LF', years: '1959–74',
    attrs: { contact: 7, power: 8, eye: 6, avoidK: 7, gap: 7, speed: 4, baserunning: 4, fielding: 5, arm: 5, clutch: 5 } },
  { name: "Sammy Sosa", short: "Sosa", team: 'CHC', number: 21, height: 72, weight: 225, age: null, bats: 'R', throws: 'R', skin: '#8a5038', espn: 2187, starter: false, position: 'bat', role: 'RF', years: '1992–2004',
    attrs: { contact: 5, power: 10, eye: 4, avoidK: 2, gap: 5, speed: 6, baserunning: 4, fielding: 5, arm: 8, clutch: 4 } },

  // ─── CHW ─────────────────────────────────────────────────────────────
  { name: "Frank Thomas", short: "Big Hurt", team: 'CHW', number: 35, height: 77, weight: 275, age: null, bats: 'R', throws: 'R', skin: '#7a4830', espn: 2370, starter: true, position: 'bat', role: '1B', years: '1990–2005',
    attrs: { contact: 9, power: 10, eye: 11, avoidK: 7, gap: 8, speed: 2, baserunning: 2, fielding: 2, arm: 2, clutch: 7 } },
  { name: "Eddie Collins", short: "Collins", team: 'CHW', number: null, height: 69, weight: 175, age: null, bats: 'L', throws: 'R', skin: '#d4a882', espn: 20307, starter: false, position: 'bat', role: '2B', years: '1915–26',
    attrs: { contact: 10, power: 2, eye: 9, avoidK: 10, gap: 7, speed: 9, baserunning: 10, fielding: 8, arm: 6, clutch: 8 } },
  { name: "Luke Appling", short: "Appling", team: 'CHW', number: 4, height: 70, weight: 183, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 17710, starter: false, position: 'bat', role: 'SS', years: '1930–50',
    attrs: { contact: 9, power: 2, eye: 9, avoidK: 9, gap: 6, speed: 5, baserunning: 5, fielding: 6, arm: 7, clutch: 5 } },
  { name: "Nellie Fox", short: "Fox", team: 'CHW', number: 2, height: 70, weight: 160, age: null, bats: 'L', throws: 'R', skin: '#d4a882', espn: 21718, starter: false, position: 'bat', role: '2B', years: '1950–63',
    attrs: { contact: 8, power: 1, eye: 6, avoidK: 11, gap: 6, speed: 6, baserunning: 5, fielding: 9, arm: 5, clutch: 7 } },
  { name: "Minnie Miñoso", short: "Miñoso", team: 'CHW', number: 9, height: 70, weight: 175, age: null, bats: 'R', throws: 'R', skin: '#8a5038', espn: 350, starter: false, position: 'bat', role: 'LF', years: '1951–64',
    attrs: { contact: 8, power: 6, eye: 7, avoidK: 8, gap: 8, speed: 8, baserunning: 8, fielding: 6, arm: 6, clutch: 6 } },

  // ─── CIN ─────────────────────────────────────────────────────────────
  { name: "Johnny Bench", short: "Bench", team: 'CIN', number: 5, height: 73, weight: 197, age: null, bats: 'R', throws: 'R', skin: '#cc9070', espn: 420, starter: true, position: 'bat', role: 'C', years: '1967–83',
    attrs: { contact: 6, power: 9, eye: 6, avoidK: 5, gap: 6, speed: 2, baserunning: 3, fielding: 10, arm: 11, clutch: 9 } },
  { name: "Pete Rose", short: "Rose", team: 'CIN', number: 14, height: 71, weight: 192, age: null, bats: 'S', throws: 'R', skin: '#d4a882', espn: 397, starter: false, position: 'bat', role: 'LF', years: '1963–86',
    attrs: { contact: 10, power: 4, eye: 7, avoidK: 9, gap: 9, speed: 5, baserunning: 7, fielding: 5, arm: 5, clutch: 8 } },
  { name: "Joe Morgan", short: "Morgan", team: 'CIN', number: 8, height: 67, weight: 160, age: null, bats: 'L', throws: 'R', skin: '#7a4830', espn: 407, starter: false, position: 'bat', role: '2B', years: '1972–79',
    attrs: { contact: 7, power: 6, eye: 10, avoidK: 8, gap: 7, speed: 8, baserunning: 10, fielding: 8, arm: 5, clutch: 8 } },
  { name: "Barry Larkin", short: "Larkin", team: 'CIN', number: 11, height: 72, weight: 185, age: null, bats: 'R', throws: 'R', skin: '#8a5038', espn: 1768, starter: false, position: 'bat', role: 'SS', years: '1986–2004',
    attrs: { contact: 8, power: 5, eye: 7, avoidK: 9, gap: 7, speed: 7, baserunning: 9, fielding: 8, arm: 7, clutch: 7 } },
  { name: "Joey Votto", short: "Votto", team: 'CIN', number: 19, height: 74, weight: 220, age: null, bats: 'L', throws: 'R', skin: '#b17767', espn: 28670, starter: false, position: 'bat', role: '1B', years: '2007–23',
    attrs: { contact: 8, power: 7, eye: 10, avoidK: 6, gap: 8, speed: 3, baserunning: 3, fielding: 6, arm: 3, clutch: 5 } },

  // ─── CLE ─────────────────────────────────────────────────────────────
  { name: "Nap Lajoie", short: "Lajoie", team: 'CLE', club: "Cleveland Naps", number: null, height: 73, weight: 195, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 24009, starter: true, position: 'bat', role: '2B', years: '1902–14',
    attrs: { contact: 10, power: 5, eye: 4, avoidK: 10, gap: 9, speed: 6, baserunning: 6, fielding: 8, arm: 6, clutch: 5 } },
  { name: "Tris Speaker", short: "Speaker", team: 'CLE', club: "Cleveland Indians", number: null, height: 71, weight: 193, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 17920, starter: false, position: 'bat', role: 'CF', years: '1916–26',
    attrs: { contact: 10, power: 4, eye: 8, avoidK: 11, gap: 11, speed: 8, baserunning: 7, fielding: 10, arm: 8, clutch: 7 } },
  { name: "Jim Thome", short: "Thome", team: 'CLE', club: "Cleveland Indians", number: 25, height: 76, weight: 248, age: null, bats: 'L', throws: 'R', skin: '#9a6455', espn: 2604, starter: false, position: 'bat', role: '1B', years: '1991–2002',
    attrs: { contact: 6, power: 10, eye: 10, avoidK: 2, gap: 5, speed: 2, baserunning: 2, fielding: 3, arm: 3, clutch: 7 } },
  { name: "Larry Doby", short: "Doby", team: 'CLE', club: "Cleveland Indians", number: 14, height: 73, weight: 180, age: null, bats: 'L', throws: 'R', skin: '#7a4830', espn: 20999, starter: false, position: 'bat', role: 'CF', years: '1947–55',
    attrs: { contact: 6, power: 7, eye: 8, avoidK: 5, gap: 6, speed: 6, baserunning: 5, fielding: 7, arm: 6, clutch: 6 } },
  { name: "José Ramírez", short: "J. Ramírez", team: 'CLE', number: 11, height: 68, weight: 190, age: null, bats: 'S', throws: 'R', skin: '#a2735e', espn: 32801, starter: false, position: 'bat', role: '3B', years: '2013–',
    attrs: { contact: 8, power: 8, eye: 8, avoidK: 9, gap: 9, speed: 7, baserunning: 9, fielding: 7, arm: 6, clutch: 5 } },

  // ─── COL ─────────────────────────────────────────────────────────────
  { name: "Todd Helton", short: "Helton", team: 'COL', number: 17, height: 74, weight: 220, age: null, bats: 'L', throws: 'L', skin: '#a16d5a', espn: 3709, starter: true, position: 'bat', role: '1B', years: '1997–2013',
    attrs: { contact: 9, power: 8, eye: 9, avoidK: 8, gap: 10, speed: 3, baserunning: 3, fielding: 8, arm: 4, clutch: 6 } },
  { name: "Larry Walker", short: "Walker", team: 'COL', number: 33, height: 75, weight: 235, age: null, bats: 'L', throws: 'R', skin: '#d4a882', espn: 2026, starter: false, position: 'bat', role: 'RF', years: '1995–2004',
    attrs: { contact: 9, power: 9, eye: 8, avoidK: 6, gap: 9, speed: 6, baserunning: 7, fielding: 8, arm: 9, clutch: 5 } },
  { name: "Nolan Arenado", short: "Arenado", team: 'COL', number: 28, height: 74, weight: 215, age: null, bats: 'R', throws: 'R', skin: '#aa715a', espn: 31261, starter: false, position: 'bat', role: '3B', years: '2013–20',
    attrs: { contact: 7, power: 8, eye: 5, avoidK: 8, gap: 8, speed: 3, baserunning: 3, fielding: 10, arm: 9, clutch: 5 } },
  { name: "Troy Tulowitzki", short: "Tulo", team: 'COL', number: 2, height: 75, weight: 205, age: null, bats: 'R', throws: 'R', skin: '#c78a68', espn: 28567, starter: false, position: 'bat', role: 'SS', years: '2006–15',
    attrs: { contact: 7, power: 7, eye: 6, avoidK: 6, gap: 7, speed: 4, baserunning: 4, fielding: 9, arm: 9, clutch: 5 } },
  { name: "Charlie Blackmon", short: "Blackmon", team: 'COL', number: 19, height: 75, weight: 221, age: null, bats: 'L', throws: 'L', skin: '#a17662', espn: 31084, starter: false, position: 'bat', role: 'CF', years: '2011–24',
    attrs: { contact: 8, power: 6, eye: 5, avoidK: 7, gap: 8, speed: 6, baserunning: 5, fielding: 4, arm: 3, clutch: 4 } },

  // ─── DET ─────────────────────────────────────────────────────────────
  { name: "Ty Cobb", short: "Cobb", team: 'DET', number: null, height: 73, weight: 175, age: null, bats: 'L', throws: 'R', skin: '#d4a882', espn: 20249, starter: true, position: 'bat', role: 'CF', years: '1905–26',
    attrs: { contact: 11, power: 6, eye: 7, avoidK: 10, gap: 11, speed: 10, baserunning: 11, fielding: 6, arm: 6, clutch: 5 } },
  { name: "Al Kaline", short: "Kaline", team: 'DET', number: 6, height: 74, weight: 175, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 23542, starter: false, position: 'bat', role: 'RF', years: '1953–74',
    attrs: { contact: 8, power: 7, eye: 7, avoidK: 8, gap: 7, speed: 5, baserunning: 5, fielding: 9, arm: 9, clutch: 8 } },
  { name: "Miguel Cabrera", short: "Miggy", team: 'DET', number: 24, height: 76, weight: 267, age: null, bats: 'R', throws: 'R', skin: '#b68065', espn: 5544, starter: false, position: 'bat', role: '1B', years: '2008–23',
    attrs: { contact: 10, power: 9, eye: 7, avoidK: 6, gap: 9, speed: 2, baserunning: 2, fielding: 3, arm: 5, clutch: 7 } },
  { name: "Hank Greenberg", short: "Greenberg", team: 'DET', number: 5, height: 75, weight: 210, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 22287, starter: false, position: 'bat', role: '1B', years: '1930–46',
    attrs: { contact: 8, power: 10, eye: 8, avoidK: 5, gap: 9, speed: 4, baserunning: 4, fielding: 5, arm: 4, clutch: 9 } },
  { name: "Charlie Gehringer", short: "Gehringer", team: 'DET', number: 2, height: 71, weight: 180, age: null, bats: 'L', throws: 'R', skin: '#d4a882', espn: 21960, starter: false, position: 'bat', role: '2B', years: '1924–42',
    attrs: { contact: 9, power: 5, eye: 8, avoidK: 10, gap: 9, speed: 6, baserunning: 6, fielding: 8, arm: 6, clutch: 7 } },

  // ─── HOU ─────────────────────────────────────────────────────────────
  { name: "Jeff Bagwell", short: "Bagwell", team: 'HOU', number: 5, height: 72, weight: 215, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 43259, starter: true, position: 'bat', role: '1B', years: '1991–2005',
    attrs: { contact: 8, power: 9, eye: 10, avoidK: 6, gap: 8, speed: 5, baserunning: 8, fielding: 7, arm: 4, clutch: 4 } },
  { name: "Craig Biggio", short: "Biggio", team: 'HOU', number: 7, height: 71, weight: 185, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 2062, starter: false, position: 'bat', role: '2B', years: '1988–2007',
    attrs: { contact: 7, power: 5, eye: 7, avoidK: 6, gap: 9, speed: 6, baserunning: 7, fielding: 7, arm: 5, clutch: 4 } },
  { name: "José Altuve", short: "Altuve", team: 'HOU', number: 27, height: 66, weight: 167, age: null, bats: 'R', throws: 'R', skin: '#b5765c', espn: 31662, starter: false, position: 'bat', role: '2B', years: '2011–',
    attrs: { contact: 10, power: 6, eye: 5, avoidK: 9, gap: 7, speed: 6, baserunning: 7, fielding: 5, arm: 4, clutch: 9 } },
  { name: "Lance Berkman", short: "Berkman", team: 'HOU', number: 17, height: 73, weight: 220, age: null, bats: 'S', throws: 'L', skin: '#a06a54', espn: 4118, starter: false, position: 'bat', role: 'LF', years: '1999–2010',
    attrs: { contact: 8, power: 8, eye: 9, avoidK: 6, gap: 8, speed: 4, baserunning: 4, fielding: 4, arm: 4, clutch: 8 } },
  { name: "Alex Bregman", short: "Bregman", team: 'HOU', number: 2, height: 70, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#c38f80', espn: 34886, starter: false, position: 'bat', role: '3B', years: '2016–24',
    attrs: { contact: 7, power: 7, eye: 9, avoidK: 9, gap: 8, speed: 3, baserunning: 5, fielding: 7, arm: 6, clutch: 7 } },

  // ─── KC ──────────────────────────────────────────────────────────────
  { name: "George Brett", short: "Brett", team: 'KC', number: 5, height: 72, weight: 205, age: null, bats: 'L', throws: 'R', skin: '#d4a882', espn: 41, starter: true, position: 'bat', role: '3B', years: '1973–93',
    attrs: { contact: 10, power: 7, eye: 7, avoidK: 9, gap: 10, speed: 5, baserunning: 6, fielding: 6, arm: 6, clutch: 10 } },
  { name: "Frank White", short: "White", team: 'KC', number: 20, height: 71, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#7a4830', espn: 323, starter: false, position: 'bat', role: '2B', years: '1973–90',
    attrs: { contact: 5, power: 4, eye: 2, avoidK: 6, gap: 5, speed: 5, baserunning: 6, fielding: 10, arm: 6, clutch: 6 } },
  { name: "Willie Wilson", short: "Wilson", team: 'KC', number: 6, height: 75, weight: 190, age: null, bats: 'S', throws: 'R', skin: '#7a4830', espn: 328, starter: false, position: 'bat', role: 'CF', years: '1976–90',
    attrs: { contact: 7, power: 2, eye: 3, avoidK: 6, gap: 8, speed: 11, baserunning: 10, fielding: 7, arm: 4, clutch: 4 } },
  { name: "Salvador Pérez", short: "Salvy", team: 'KC', number: 13, height: 74, weight: 255, age: null, bats: 'R', throws: 'R', skin: '#ab754e', espn: 31127, starter: false, position: 'bat', role: 'C', years: '2011–',
    attrs: { contact: 5, power: 7, eye: 1, avoidK: 5, gap: 6, speed: 1, baserunning: 2, fielding: 7, arm: 8, clutch: 8 } },
  { name: "Alex Gordon", short: "Gordon", team: 'KC', number: 4, height: 73, weight: 225, age: null, bats: 'L', throws: 'R', skin: '#d18f6d', espn: 28636, starter: false, position: 'bat', role: 'LF', years: '2007–20',
    attrs: { contact: 5, power: 5, eye: 7, avoidK: 4, gap: 7, speed: 5, baserunning: 6, fielding: 9, arm: 8, clutch: 7 } },

  // ─── LAA ─────────────────────────────────────────────────────────────
  { name: "Mike Trout", short: "Trout", team: 'LAA', number: 27, height: 73, weight: 235, age: null, bats: 'R', throws: 'R', skin: '#d59d84', espn: 30836, starter: true, position: 'bat', role: 'CF', years: '2011–',
    attrs: { contact: 8, power: 10, eye: 10, avoidK: 5, gap: 8, speed: 7, baserunning: 8, fielding: 6, arm: 4, clutch: 5 } },
  { name: "Shohei Ohtani", short: "Ohtani", team: 'LAA', number: 17, height: 76, weight: 210, age: null, bats: 'L', throws: 'R', skin: '#c58e72', espn: 39832, starter: false, position: 'bat', role: 'DH', years: '2018–23',
    attrs: { contact: 8, power: 10, eye: 8, avoidK: 5, gap: 8, speed: 9, baserunning: 8, fielding: 1, arm: 9, clutch: 9 } },
  { name: "Vladimir Guerrero", short: "Vlad", team: 'LAA', number: 27, height: 75, weight: 235, age: null, bats: 'R', throws: 'R', skin: '#6d4936', espn: 3576, starter: false, position: 'bat', role: 'RF', years: '2004–09',
    attrs: { contact: 10, power: 9, eye: 3, avoidK: 9, gap: 8, speed: 6, baserunning: 5, fielding: 5, arm: 11, clutch: 6 } },
  { name: "Tim Salmon", short: "Salmon", team: 'LAA', number: 15, height: 75, weight: 235, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 2760, starter: false, position: 'bat', role: 'RF', years: '1992–2006',
    attrs: { contact: 6, power: 7, eye: 8, avoidK: 4, gap: 7, speed: 4, baserunning: 4, fielding: 5, arm: 6, clutch: 7 } },
  { name: "Garret Anderson", short: "G. Anderson", team: 'LAA', number: 16, height: 75, weight: 225, age: null, bats: 'L', throws: 'L', skin: '#8a5038', espn: 3129, starter: false, position: 'bat', role: 'LF', years: '1994–2008',
    attrs: { contact: 7, power: 6, eye: 2, avoidK: 7, gap: 9, speed: 5, baserunning: 4, fielding: 6, arm: 4, clutch: 8 } },

  // ─── LAD ─────────────────────────────────────────────────────────────
  { name: "Jackie Robinson", short: "Jackie", team: 'LAD', club: "Brooklyn Dodgers", number: 42, height: 71, weight: 204, age: null, bats: 'R', throws: 'R', skin: '#7a4830', espn: 26863, starter: true, position: 'bat', role: '2B', years: '1947–56',
    attrs: { contact: 9, power: 5, eye: 9, avoidK: 10, gap: 7, speed: 9, baserunning: 11, fielding: 8, arm: 6, clutch: 8 } },
  { name: "Duke Snider", short: "Snider", team: 'LAD', club: "Brooklyn Dodgers", number: 4, height: 72, weight: 190, age: null, bats: 'L', throws: 'R', skin: '#d4a882', espn: 17862, starter: false, position: 'bat', role: 'CF', years: '1947–62',
    attrs: { contact: 7, power: 9, eye: 7, avoidK: 5, gap: 7, speed: 6, baserunning: 5, fielding: 7, arm: 8, clutch: 9 } },
  { name: "Roy Campanella", short: "Campy", team: 'LAD', club: "Brooklyn Dodgers", number: 39, height: 69, weight: 200, age: null, bats: 'R', throws: 'R', skin: '#8a5038', espn: 19876, starter: false, position: 'bat', role: 'C', years: '1948–57',
    attrs: { contact: 6, power: 8, eye: 6, avoidK: 7, gap: 5, speed: 1, baserunning: 2, fielding: 9, arm: 9, clutch: 6 } },
  { name: "Pee Wee Reese", short: "Reese", team: 'LAD', club: "Brooklyn Dodgers", number: 1, height: 70, weight: 175, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 26641, starter: false, position: 'bat', role: 'SS', years: '1940–58',
    attrs: { contact: 6, power: 3, eye: 8, avoidK: 7, gap: 5, speed: 7, baserunning: 7, fielding: 8, arm: 6, clutch: 6 } },
  { name: "Steve Garvey", short: "Garvey", team: 'LAD', number: 6, height: 70, weight: 192, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 144, starter: false, position: 'bat', role: '1B', years: '1969–82',
    attrs: { contact: 8, power: 6, eye: 2, avoidK: 7, gap: 6, speed: 3, baserunning: 3, fielding: 7, arm: 3, clutch: 9 } },

  // ─── MIA ─────────────────────────────────────────────────────────────
  { name: "Giancarlo Stanton", short: "Stanton", team: 'MIA', number: 27, height: 77, weight: 245, age: null, bats: 'R', throws: 'R', skin: '#9b6649', espn: 30583, starter: true, position: 'bat', role: 'RF', years: '2010–17',
    attrs: { contact: 5, power: 11, eye: 7, avoidK: 2, gap: 5, speed: 4, baserunning: 3, fielding: 5, arm: 8, clutch: 6 } },
  { name: "Hanley Ramírez", short: "Hanley", team: 'MIA', club: "Florida Marlins", number: 2, height: 74, weight: 235, age: null, bats: 'R', throws: 'R', skin: '#88533c', espn: 6195, starter: false, position: 'bat', role: 'SS', years: '2006–12',
    attrs: { contact: 9, power: 7, eye: 6, avoidK: 6, gap: 8, speed: 8, baserunning: 7, fielding: 3, arm: 6, clutch: 5 } },
  { name: "Luis Castillo", short: "Castillo", team: 'MIA', club: "Florida Marlins", number: 1, height: 71, weight: 197, age: null, bats: 'S', throws: 'R', skin: '#7d4d39', espn: 3515, starter: false, position: 'bat', role: '2B', years: '1996–2005',
    attrs: { contact: 8, power: 1, eye: 7, avoidK: 8, gap: 4, speed: 9, baserunning: 8, fielding: 7, arm: 4, clutch: 6 } },
  { name: "Mike Lowell", short: "Lowell", team: 'MIA', club: "Florida Marlins", number: 19, height: 75, weight: 210, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 3972, starter: false, position: 'bat', role: '3B', years: '1999–2005',
    attrs: { contact: 6, power: 6, eye: 5, avoidK: 7, gap: 8, speed: 2, baserunning: 3, fielding: 8, arm: 6, clutch: 9 } },
  { name: "Jeff Conine", short: "Conine", team: 'MIA', club: "Florida Marlins", number: 18, height: 73, weight: 225, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 2443, starter: false, position: 'bat', role: '1B', years: '1993–2005',
    attrs: { contact: 6, power: 5, eye: 5, avoidK: 6, gap: 6, speed: 3, baserunning: 4, fielding: 5, arm: 5, clutch: 8 } },

  // ─── MIL ─────────────────────────────────────────────────────────────
  { name: "Robin Yount", short: "Yount", team: 'MIL', number: 19, height: 72, weight: 165, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 339, starter: true, position: 'bat', role: 'SS', years: '1974–93',
    attrs: { contact: 8, power: 6, eye: 5, avoidK: 7, gap: 9, speed: 6, baserunning: 7, fielding: 7, arm: 7, clutch: 8 } },
  { name: "Paul Molitor", short: "Molitor", team: 'MIL', number: 4, height: 72, weight: 185, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 352, starter: false, position: 'bat', role: '3B', years: '1978–92',
    attrs: { contact: 9, power: 5, eye: 7, avoidK: 8, gap: 9, speed: 7, baserunning: 9, fielding: 5, arm: 5, clutch: 10 } },
  { name: "Ryan Braun", short: "Braun", team: 'MIL', number: 8, height: 74, weight: 205, age: null, bats: 'R', throws: 'R', skin: '#ca8f75', espn: 28721, starter: false, position: 'bat', role: 'LF', years: '2007–20',
    attrs: { contact: 8, power: 8, eye: 6, avoidK: 6, gap: 8, speed: 6, baserunning: 7, fielding: 4, arm: 5, clutch: 6 } },
  { name: "Prince Fielder", short: "Fielder", team: 'MIL', number: 28, height: 71, weight: 275, age: null, bats: 'L', throws: 'R', skin: '#80503a', espn: 5915, starter: false, position: 'bat', role: '1B', years: '2005–11',
    attrs: { contact: 6, power: 9, eye: 8, avoidK: 5, gap: 6, speed: 1, baserunning: 1, fielding: 2, arm: 3, clutch: 4 } },
  { name: "Christian Yelich", short: "Yelich", team: 'MIL', number: 22, height: 76, weight: 220, age: null, bats: 'L', throws: 'R', skin: '#b4856b', espn: 31283, starter: false, position: 'bat', role: 'LF', years: '2018–',
    attrs: { contact: 8, power: 7, eye: 8, avoidK: 5, gap: 7, speed: 7, baserunning: 8, fielding: 5, arm: 4, clutch: 6 } },

  // ─── MIN ─────────────────────────────────────────────────────────────
  { name: "Rod Carew", short: "Carew", team: 'MIN', number: 29, height: 72, weight: 170, age: null, bats: 'L', throws: 'R', skin: '#8a5038', espn: 55, starter: true, position: 'bat', role: '2B', years: '1967–78',
    attrs: { contact: 10, power: 3, eye: 7, avoidK: 9, gap: 8, speed: 8, baserunning: 8, fielding: 5, arm: 5, clutch: 4 } },
  { name: "Harmon Killebrew", short: "Killebrew", team: 'MIN', number: 3, height: 71, weight: 213, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 23727, starter: false, position: 'bat', role: '1B', years: '1954–74',
    attrs: { contact: 5, power: 10, eye: 9, avoidK: 4, gap: 4, speed: 2, baserunning: 2, fielding: 4, arm: 4, clutch: 6 } },
  { name: "Kirby Puckett", short: "Puckett", team: 'MIN', number: 34, height: 69, weight: 215, age: null, bats: 'R', throws: 'R', skin: '#7a4830', espn: 1496, starter: false, position: 'bat', role: 'CF', years: '1984–95',
    attrs: { contact: 9, power: 6, eye: 4, avoidK: 8, gap: 8, speed: 6, baserunning: 5, fielding: 9, arm: 7, clutch: 11 } },
  { name: "Joe Mauer", short: "Mauer", team: 'MIN', number: 7, height: 77, weight: 225, age: null, bats: 'L', throws: 'R', skin: '#ac8673', espn: 5378, starter: false, position: 'bat', role: 'C', years: '2004–18',
    attrs: { contact: 9, power: 4, eye: 9, avoidK: 9, gap: 7, speed: 3, baserunning: 4, fielding: 7, arm: 6, clutch: 4 } },
  { name: "Tony Oliva", short: "Oliva", team: 'MIN', number: 6, height: 74, weight: 190, age: null, bats: 'L', throws: 'R', skin: '#8a5038', espn: 25946, starter: false, position: 'bat', role: 'RF', years: '1962–76',
    attrs: { contact: 9, power: 6, eye: 4, avoidK: 7, gap: 9, speed: 5, baserunning: 4, fielding: 6, arm: 7, clutch: 5 } },

  // ─── NYM ─────────────────────────────────────────────────────────────
  { name: "Mike Piazza", short: "Piazza", team: 'NYM', number: 31, height: 75, weight: 200, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 2770, starter: true, position: 'bat', role: 'C', years: '1998–2005',
    attrs: { contact: 9, power: 9, eye: 7, avoidK: 7, gap: 6, speed: 1, baserunning: 2, fielding: 3, arm: 2, clutch: 9 } },
  { name: "David Wright", short: "Wright", team: 'NYM', number: 5, height: 72, weight: 205, age: null, bats: 'R', throws: 'R', skin: '#936654', espn: 6035, starter: false, position: 'bat', role: '3B', years: '2004–18',
    attrs: { contact: 8, power: 7, eye: 8, avoidK: 6, gap: 8, speed: 6, baserunning: 7, fielding: 7, arm: 6, clutch: 5 } },
  { name: "Darryl Strawberry", short: "Strawberry", team: 'NYM', number: 18, height: 78, weight: 215, age: null, bats: 'L', throws: 'L', skin: '#7a4830', espn: 1350, starter: false, position: 'bat', role: 'RF', years: '1983–90',
    attrs: { contact: 5, power: 9, eye: 7, avoidK: 3, gap: 6, speed: 8, baserunning: 6, fielding: 5, arm: 8, clutch: 6 } },
  { name: "Keith Hernandez", short: "Hernandez", team: 'NYM', number: 17, height: 72, weight: 205, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 172, starter: false, position: 'bat', role: '1B', years: '1983–89',
    attrs: { contact: 8, power: 4, eye: 9, avoidK: 7, gap: 7, speed: 4, baserunning: 4, fielding: 11, arm: 6, clutch: 8 } },
  { name: "José Reyes", short: "Reyes", team: 'NYM', number: 7, height: 72, weight: 195, age: null, bats: 'S', throws: 'R', skin: '#764738', espn: 5411, starter: false, position: 'bat', role: 'SS', years: '2003–11',
    attrs: { contact: 7, power: 4, eye: 5, avoidK: 8, gap: 9, speed: 10, baserunning: 9, fielding: 6, arm: 8, clutch: 4 } },

  // ─── NYY ─────────────────────────────────────────────────────────────
  { name: "Babe Ruth", short: "Ruth", team: 'NYY', number: 3, height: 74, weight: 215, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 27035, starter: true, position: 'bat', role: 'RF', years: '1920–34',
    attrs: { contact: 10, power: 11, eye: 11, avoidK: 5, gap: 9, speed: 3, baserunning: 3, fielding: 5, arm: 8, clutch: 10 } },
  { name: "Lou Gehrig", short: "Gehrig", team: 'NYY', number: 4, height: 72, weight: 200, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 21958, starter: false, position: 'bat', role: '1B', years: '1923–39',
    attrs: { contact: 10, power: 10, eye: 10, avoidK: 8, gap: 10, speed: 5, baserunning: 5, fielding: 5, arm: 3, clutch: 10 } },
  { name: "Joe DiMaggio", short: "DiMaggio", team: 'NYY', number: 5, height: 74, weight: 193, age: null, bats: 'R', throws: 'R', skin: '#cc9070', espn: 20972, starter: false, position: 'bat', role: 'CF', years: '1936–51',
    attrs: { contact: 10, power: 9, eye: 7, avoidK: 11, gap: 9, speed: 7, baserunning: 8, fielding: 9, arm: 8, clutch: 7 } },
  { name: "Mickey Mantle", short: "Mantle", team: 'NYY', number: 7, height: 71, weight: 195, age: null, bats: 'S', throws: 'R', skin: '#d4a882', espn: 24622, starter: false, position: 'bat', role: 'CF', years: '1951–68',
    attrs: { contact: 8, power: 10, eye: 10, avoidK: 4, gap: 7, speed: 10, baserunning: 8, fielding: 7, arm: 7, clutch: 11 } },
  { name: "Derek Jeter", short: "Jeter", team: 'NYY', number: 2, height: 75, weight: 195, age: null, bats: 'R', throws: 'R', skin: '#855746', espn: 3246, starter: false, position: 'bat', role: 'SS', years: '1995–2014',
    attrs: { contact: 9, power: 5, eye: 6, avoidK: 6, gap: 7, speed: 7, baserunning: 8, fielding: 5, arm: 6, clutch: 11 } },
  { name: "Yogi Berra", short: "Yogi", team: 'NYY', number: 8, height: 67, weight: 185, age: null, bats: 'L', throws: 'R', skin: '#cc9070', espn: 19152, starter: false, position: 'bat', role: 'C', years: '1946–63',
    attrs: { contact: 8, power: 8, eye: 6, avoidK: 11, gap: 6, speed: 3, baserunning: 3, fielding: 8, arm: 7, clutch: 9 } },
  { name: "Aaron Judge", short: "Judge", team: 'NYY', number: 99, height: 79, weight: 282, age: null, bats: 'R', throws: 'R', skin: '#c89070', espn: 33192, starter: false, position: 'bat', role: 'RF', years: '2016–',
    attrs: { contact: 8, power: 11, eye: 10, avoidK: 3, gap: 7, speed: 5, baserunning: 5, fielding: 7, arm: 8, clutch: 6 } },

  // ─── PHI ─────────────────────────────────────────────────────────────
  { name: "Mike Schmidt", short: "Schmidt", team: 'PHI', number: 20, height: 74, weight: 203, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 256, starter: true, position: 'bat', role: '3B', years: '1972–89',
    attrs: { contact: 6, power: 10, eye: 9, avoidK: 4, gap: 6, speed: 5, baserunning: 6, fielding: 10, arm: 8, clutch: 7 } },
  { name: "Chase Utley", short: "Utley", team: 'PHI', number: 26, height: 73, weight: 195, age: null, bats: 'L', throws: 'R', skin: '#b28376', espn: 5383, starter: false, position: 'bat', role: '2B', years: '2003–15',
    attrs: { contact: 7, power: 7, eye: 7, avoidK: 7, gap: 7, speed: 6, baserunning: 10, fielding: 9, arm: 5, clutch: 8 } },
  { name: "Ryan Howard", short: "Howard", team: 'PHI', number: 6, height: 76, weight: 250, age: null, bats: 'L', throws: 'L', skin: '#8a5038', espn: 6097, starter: false, position: 'bat', role: '1B', years: '2004–16',
    attrs: { contact: 5, power: 10, eye: 6, avoidK: 1, gap: 5, speed: 2, baserunning: 2, fielding: 2, arm: 3, clutch: 7 } },
  { name: "Richie Ashburn", short: "Ashburn", team: 'PHI', number: 1, height: 70, weight: 170, age: null, bats: 'L', throws: 'R', skin: '#d4a882', espn: 17748, starter: false, position: 'bat', role: 'CF', years: '1948–59',
    attrs: { contact: 9, power: 1, eye: 9, avoidK: 10, gap: 6, speed: 9, baserunning: 7, fielding: 9, arm: 6, clutch: 6 } },
  { name: "Jimmy Rollins", short: "J-Roll", team: 'PHI', number: 11, height: 68, weight: 180, age: null, bats: 'S', throws: 'R', skin: '#724635', espn: 4258, starter: false, position: 'bat', role: 'SS', years: '2000–14',
    attrs: { contact: 6, power: 6, eye: 5, avoidK: 8, gap: 8, speed: 9, baserunning: 9, fielding: 8, arm: 7, clutch: 7 } },

  // ─── PIT ─────────────────────────────────────────────────────────────
  { name: "Honus Wagner", short: "Wagner", team: 'PIT', number: null, height: 71, weight: 200, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 27684, starter: true, position: 'bat', role: 'SS', years: '1900–17',
    attrs: { contact: 10, power: 7, eye: 7, avoidK: 9, gap: 11, speed: 9, baserunning: 9, fielding: 9, arm: 9, clutch: 7 } },
  { name: "Roberto Clemente", short: "Clemente", team: 'PIT', number: 21, height: 71, weight: 175, age: null, bats: 'R', throws: 'R', skin: '#8a5038', espn: 20219, starter: false, position: 'bat', role: 'RF', years: '1955–72',
    attrs: { contact: 10, power: 6, eye: 3, avoidK: 7, gap: 9, speed: 7, baserunning: 6, fielding: 10, arm: 11, clutch: 9 } },
  { name: "Willie Stargell", short: "Pops", team: 'PIT', number: 8, height: 74, weight: 188, age: null, bats: 'L', throws: 'L', skin: '#7a4830', espn: 279, starter: false, position: 'bat', role: 'LF', years: '1962–82',
    attrs: { contact: 6, power: 10, eye: 7, avoidK: 3, gap: 7, speed: 3, baserunning: 3, fielding: 4, arm: 6, clutch: 10 } },
  { name: "Paul Waner", short: "Waner", team: 'PIT', number: 11, height: 68, weight: 153, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 27767, starter: false, position: 'bat', role: 'RF', years: '1926–40',
    attrs: { contact: 10, power: 4, eye: 8, avoidK: 10, gap: 10, speed: 7, baserunning: 6, fielding: 6, arm: 7, clutch: 6 } },
  { name: "Andrew McCutchen", short: "Cutch", team: 'PIT', number: 22, height: 70, weight: 190, age: null, bats: 'R', throws: 'R', skin: '#825c4d', espn: 28701, starter: false, position: 'bat', role: 'CF', years: '2009–17, 2023–25',
    attrs: { contact: 7, power: 7, eye: 8, avoidK: 6, gap: 7, speed: 7, baserunning: 7, fielding: 5, arm: 4, clutch: 5 } },

  // ─── SD ──────────────────────────────────────────────────────────────
  { name: "Tony Gwynn", short: "Gwynn", team: 'SD', number: 19, height: 71, weight: 220, age: null, bats: 'L', throws: 'L', skin: '#7a4830', espn: 1150, starter: true, position: 'bat', role: 'RF', years: '1982–2001',
    attrs: { contact: 11, power: 4, eye: 7, avoidK: 11, gap: 8, speed: 6, baserunning: 7, fielding: 6, arm: 6, clutch: 8 } },
  { name: "Dave Winfield", short: "Winfield", team: 'SD', number: 31, height: 78, weight: 245, age: null, bats: 'R', throws: 'R', skin: '#7a4830', espn: 329, starter: false, position: 'bat', role: 'RF', years: '1973–80',
    attrs: { contact: 7, power: 8, eye: 6, avoidK: 6, gap: 7, speed: 7, baserunning: 6, fielding: 7, arm: 9, clutch: 5 } },
  { name: "Ken Caminiti", short: "Caminiti", team: 'SD', number: 21, height: 72, weight: 200, age: null, bats: 'S', throws: 'R', skin: '#d4a882', espn: 1924, starter: false, position: 'bat', role: '3B', years: '1995–98',
    attrs: { contact: 6, power: 7, eye: 6, avoidK: 5, gap: 6, speed: 4, baserunning: 4, fielding: 8, arm: 9, clutch: 6 } },
  { name: "Adrián González", short: "A. González", team: 'SD', number: 23, height: 74, weight: 215, age: null, bats: 'L', throws: 'L', skin: '#a96850', espn: 5405, starter: false, position: 'bat', role: '1B', years: '2006–10',
    attrs: { contact: 7, power: 8, eye: 7, avoidK: 6, gap: 7, speed: 2, baserunning: 2, fielding: 8, arm: 4, clutch: 5 } },
  { name: "Manny Machado", short: "Machado", team: 'SD', number: 13, height: 74, weight: 218, age: null, bats: 'R', throws: 'R', skin: '#b88565', espn: 31097, starter: false, position: 'bat', role: '3B', years: '2019–',
    attrs: { contact: 7, power: 8, eye: 6, avoidK: 7, gap: 8, speed: 4, baserunning: 5, fielding: 9, arm: 9, clutch: 6 } },

  // ─── SEA ─────────────────────────────────────────────────────────────
  { name: "Ken Griffey Jr.", short: "Griffey", team: 'SEA', number: 24, height: 75, weight: 228, age: null, bats: 'L', throws: 'L', skin: '#8a5038', espn: 2148, starter: true, position: 'bat', role: 'CF', years: '1989–99, 2009–10',
    attrs: { contact: 8, power: 10, eye: 8, avoidK: 6, gap: 8, speed: 8, baserunning: 7, fielding: 10, arm: 8, clutch: 8 } },
  { name: "Edgar Martínez", short: "Edgar", team: 'SEA', number: 11, height: 71, weight: 210, age: null, bats: 'R', throws: 'R', skin: '#b87b60', espn: 1988, starter: false, position: 'bat', role: 'DH', years: '1987–2004',
    attrs: { contact: 10, power: 8, eye: 10, avoidK: 8, gap: 10, speed: 2, baserunning: 2, fielding: 2, arm: 3, clutch: 9 } },
  { name: "Ichiro Suzuki", short: "Ichiro", team: 'SEA', number: 51, height: 71, weight: 175, age: null, bats: 'L', throws: 'R', skin: '#bc8f79', espn: 4570, starter: false, position: 'bat', role: 'RF', years: '2001–12, 2018–19',
    attrs: { contact: 11, power: 3, eye: 4, avoidK: 10, gap: 6, speed: 10, baserunning: 9, fielding: 9, arm: 11, clutch: 6 } },
  { name: "Alex Rodríguez", short: "A-Rod", team: 'SEA', number: 3, height: 75, weight: 230, age: null, bats: 'R', throws: 'R', skin: '#a56142', espn: 3115, starter: false, position: 'bat', role: 'SS', years: '1994–2000',
    attrs: { contact: 9, power: 10, eye: 8, avoidK: 6, gap: 8, speed: 7, baserunning: 8, fielding: 8, arm: 8, clutch: 5 } },
  { name: "Kyle Seager", short: "Seager", team: 'SEA', number: 15, height: 72, weight: 216, age: null, bats: 'L', throws: 'R', skin: '#b08371', espn: 30819, starter: false, position: 'bat', role: '3B', years: '2011–21',
    attrs: { contact: 5, power: 6, eye: 6, avoidK: 6, gap: 6, speed: 3, baserunning: 4, fielding: 7, arm: 7, clutch: 4 } },

  // ─── SF ──────────────────────────────────────────────────────────────
  { name: "Willie Mays", short: "Mays", team: 'SF', number: 24, height: 70, weight: 170, age: null, bats: 'R', throws: 'R', skin: '#7a4830', espn: 24790, starter: true, position: 'bat', role: 'CF', years: '1951–72',
    attrs: { contact: 9, power: 10, eye: 8, avoidK: 7, gap: 9, speed: 10, baserunning: 10, fielding: 11, arm: 10, clutch: 7 } },
  { name: "Barry Bonds", short: "Bonds", team: 'SF', number: 25, height: 74, weight: 236, age: null, bats: 'L', throws: 'L', skin: '#8a5038', espn: 1785, starter: false, position: 'bat', role: 'LF', years: '1993–2007',
    attrs: { contact: 9, power: 11, eye: 11, avoidK: 8, gap: 8, speed: 8, baserunning: 8, fielding: 7, arm: 4, clutch: 7 } },
  { name: "Willie McCovey", short: "McCovey", team: 'SF', number: 44, height: 76, weight: 198, age: null, bats: 'L', throws: 'L', skin: '#7a4030', espn: 210, starter: false, position: 'bat', role: '1B', years: '1959–80',
    attrs: { contact: 6, power: 10, eye: 9, avoidK: 5, gap: 6, speed: 2, baserunning: 2, fielding: 4, arm: 3, clutch: 6 } },
  { name: "Mel Ott", short: "Ott", team: 'SF', club: "New York Giants", number: 4, height: 69, weight: 170, age: null, bats: 'L', throws: 'R', skin: '#d4a882', espn: 26013, starter: false, position: 'bat', role: 'RF', years: '1926–47',
    attrs: { contact: 8, power: 9, eye: 10, avoidK: 9, gap: 7, speed: 5, baserunning: 5, fielding: 6, arm: 8, clutch: 8 } },
  { name: "Buster Posey", short: "Posey", team: 'SF', number: 28, height: 73, weight: 210, age: null, bats: 'R', throws: 'R', skin: '#bd8a78', espn: 30112, starter: false, position: 'bat', role: 'C', years: '2009–21',
    attrs: { contact: 8, power: 6, eye: 7, avoidK: 8, gap: 7, speed: 2, baserunning: 2, fielding: 9, arm: 6, clutch: 9 } },

  // ─── STL ─────────────────────────────────────────────────────────────
  { name: "Stan Musial", short: "Musial", team: 'STL', number: 6, height: 72, weight: 175, age: null, bats: 'L', throws: 'L', skin: '#d4a882', espn: 25643, starter: true, position: 'bat', role: 'LF', years: '1941–63',
    attrs: { contact: 10, power: 9, eye: 9, avoidK: 11, gap: 11, speed: 6, baserunning: 6, fielding: 5, arm: 5, clutch: 7 } },
  { name: "Rogers Hornsby", short: "Hornsby", team: 'STL', number: null, height: 71, weight: 175, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 23082, starter: false, position: 'bat', role: '2B', years: '1915–26',
    attrs: { contact: 11, power: 8, eye: 8, avoidK: 9, gap: 9, speed: 6, baserunning: 5, fielding: 5, arm: 6, clutch: 6 } },
  { name: "Albert Pujols", short: "Pujols", team: 'STL', number: 5, height: 75, weight: 235, age: null, bats: 'R', throws: 'R', skin: '#ae7359', espn: 4574, starter: false, position: 'bat', role: '1B', years: '2001–11, 2022',
    attrs: { contact: 10, power: 10, eye: 9, avoidK: 9, gap: 9, speed: 4, baserunning: 7, fielding: 8, arm: 5, clutch: 9 } },
  { name: "Ozzie Smith", short: "Ozzie", team: 'STL', number: 1, height: 70, weight: 168, age: null, bats: 'S', throws: 'R', skin: '#7a4830', espn: 270, starter: false, position: 'bat', role: 'SS', years: '1982–96',
    attrs: { contact: 6, power: 1, eye: 8, avoidK: 9, gap: 5, speed: 8, baserunning: 9, fielding: 11, arm: 8, clutch: 8 } },
  { name: "Lou Brock", short: "Brock", team: 'STL', number: 20, height: 71, weight: 170, age: null, bats: 'L', throws: 'L', skin: '#7a4030', espn: 19568, starter: false, position: 'bat', role: 'LF', years: '1964–79',
    attrs: { contact: 8, power: 4, eye: 4, avoidK: 5, gap: 7, speed: 10, baserunning: 10, fielding: 4, arm: 3, clutch: 10 } },
  { name: "Yadier Molina", short: "Yadi", team: 'STL', number: 4, height: 71, weight: 225, age: null, bats: 'R', throws: 'R', skin: '#bc7e69', espn: 5986, starter: false, position: 'bat', role: 'C', years: '2004–22',
    attrs: { contact: 6, power: 5, eye: 5, avoidK: 8, gap: 6, speed: 1, baserunning: 3, fielding: 11, arm: 10, clutch: 8 } },

  // ─── TB ──────────────────────────────────────────────────────────────
  { name: "Evan Longoria", short: "Longoria", team: 'TB', number: 3, height: 73, weight: 213, age: null, bats: 'R', throws: 'R', skin: '#bd8c72', espn: 28639, starter: true, position: 'bat', role: '3B', years: '2008–17',
    attrs: { contact: 6, power: 8, eye: 7, avoidK: 5, gap: 8, speed: 4, baserunning: 4, fielding: 9, arm: 7, clutch: 8 } },
  { name: "Carl Crawford", short: "Crawford", team: 'TB', number: 13, height: 74, weight: 225, age: null, bats: 'L', throws: 'L', skin: '#996550', espn: 5035, starter: false, position: 'bat', role: 'LF', years: '2002–10',
    attrs: { contact: 8, power: 5, eye: 3, avoidK: 6, gap: 9, speed: 10, baserunning: 9, fielding: 8, arm: 2, clutch: 5 } },
  { name: "Ben Zobrist", short: "Zobrist", team: 'TB', number: 18, height: 75, weight: 210, age: null, bats: 'S', throws: 'R', skin: '#b28376', espn: 28536, starter: false, position: 'bat', role: '2B', years: '2006–14',
    attrs: { contact: 7, power: 5, eye: 9, avoidK: 7, gap: 7, speed: 5, baserunning: 6, fielding: 8, arm: 6, clutch: 9 } },
  { name: "Kevin Kiermaier", short: "Kiermaier", team: 'TB', number: 39, height: 73, weight: 210, age: null, bats: 'L', throws: 'R', skin: '#ae7a5d', espn: 31446, starter: false, position: 'bat', role: 'CF', years: '2013–22',
    attrs: { contact: 4, power: 4, eye: 4, avoidK: 4, gap: 6, speed: 8, baserunning: 7, fielding: 10, arm: 8, clutch: 4 } },
  { name: "Randy Arozarena", short: "Arozarena", team: 'TB', number: 56, height: 70, weight: 185, age: null, bats: 'R', throws: 'R', skin: '#8d6249', espn: 36488, starter: false, position: 'bat', role: 'LF', years: '2020–24',
    attrs: { contact: 6, power: 6, eye: 6, avoidK: 4, gap: 6, speed: 8, baserunning: 7, fielding: 5, arm: 6, clutch: 10 } },

  // ─── TEX ─────────────────────────────────────────────────────────────
  { name: "Iván Rodríguez", short: "Pudge", team: 'TEX', number: 7, height: 69, weight: 205, age: null, bats: 'R', throws: 'R', skin: '#a16044', espn: 2523, starter: true, position: 'bat', role: 'C', years: '1991–2002, 2009',
    attrs: { contact: 8, power: 7, eye: 2, avoidK: 7, gap: 8, speed: 4, baserunning: 4, fielding: 10, arm: 11, clutch: 7 } },
  { name: "Adrián Beltré", short: "Beltré", team: 'TEX', number: 29, height: 71, weight: 220, age: null, bats: 'R', throws: 'R', skin: '#80503a', espn: 3878, starter: false, position: 'bat', role: '3B', years: '2011–18',
    attrs: { contact: 8, power: 8, eye: 5, avoidK: 8, gap: 8, speed: 3, baserunning: 3, fielding: 10, arm: 10, clutch: 7 } },
  { name: "Michael Young", short: "M. Young", team: 'TEX', number: 10, height: 73, weight: 200, age: null, bats: 'R', throws: 'R', skin: '#c78a68', espn: 4566, starter: false, position: 'bat', role: 'SS', years: '2000–12',
    attrs: { contact: 9, power: 5, eye: 5, avoidK: 7, gap: 8, speed: 4, baserunning: 5, fielding: 5, arm: 6, clutch: 5 } },
  { name: "Juan González", short: "Juan Gone", team: 'TEX', number: 19, height: 75, weight: 220, age: null, bats: 'R', throws: 'R', skin: '#a7725e', espn: null, starter: false, position: 'bat', role: 'RF', years: '1989–99, 2002–03',
    attrs: { contact: 7, power: 10, eye: 3, avoidK: 4, gap: 8, speed: 3, baserunning: 3, fielding: 4, arm: 6, clutch: 7 } },
  { name: "Josh Hamilton", short: "Hamilton", team: 'TEX', number: 32, height: 76, weight: 240, age: null, bats: 'L', throws: 'L', skin: '#a17662', espn: 4652, starter: false, position: 'bat', role: 'CF', years: '2008–12',
    attrs: { contact: 8, power: 9, eye: 5, avoidK: 3, gap: 7, speed: 6, baserunning: 6, fielding: 6, arm: 9, clutch: 7 } },

  // ─── TOR ─────────────────────────────────────────────────────────────
  { name: "Carlos Delgado", short: "Delgado", team: 'TOR', number: 25, height: 75, weight: 246, age: null, bats: 'L', throws: 'R', skin: '#b87b60', espn: 3020, starter: true, position: 'bat', role: '1B', years: '1993–2004',
    attrs: { contact: 7, power: 9, eye: 9, avoidK: 4, gap: 8, speed: 2, baserunning: 2, fielding: 3, arm: 3, clutch: 5 } },
  { name: "Roberto Alomar", short: "Alomar", team: 'TOR', number: 12, height: 72, weight: 190, age: null, bats: 'S', throws: 'R', skin: '#a7725e', espn: 2034, starter: false, position: 'bat', role: '2B', years: '1991–95',
    attrs: { contact: 9, power: 5, eye: 7, avoidK: 8, gap: 7, speed: 8, baserunning: 9, fielding: 10, arm: 6, clutch: 9 } },
  { name: "José Bautista", short: "Joey Bats", team: 'TOR', number: 19, height: 72, weight: 205, age: null, bats: 'R', throws: 'R', skin: '#9e5e45', espn: 5890, starter: false, position: 'bat', role: 'RF', years: '2008–17',
    attrs: { contact: 5, power: 9, eye: 10, avoidK: 6, gap: 5, speed: 4, baserunning: 5, fielding: 5, arm: 9, clutch: 10 } },
  { name: "Joe Carter", short: "Carter", team: 'TOR', number: 29, height: 75, weight: 225, age: null, bats: 'R', throws: 'R', skin: '#7a4830', espn: 1316, starter: false, position: 'bat', role: 'RF', years: '1991–97',
    attrs: { contact: 5, power: 8, eye: 3, avoidK: 5, gap: 6, speed: 6, baserunning: 6, fielding: 5, arm: 5, clutch: 10 } },
  { name: "Tony Fernández", short: "Fernández", team: 'TOR', number: 1, height: 74, weight: 175, age: null, bats: 'S', throws: 'R', skin: '#8a5038', espn: 1248, starter: false, position: 'bat', role: 'SS', years: '1983–90, 1993, 1998–99, 2001',
    attrs: { contact: 8, power: 2, eye: 6, avoidK: 9, gap: 7, speed: 6, baserunning: 6, fielding: 9, arm: 7, clutch: 8 } },

  // ─── WSH ─────────────────────────────────────────────────────────────
  { name: "Gary Carter", short: "The Kid", team: 'WSH', club: "Montreal Expos", number: 8, height: 74, weight: 214, age: null, bats: 'R', throws: 'R', skin: '#d4a882', espn: 56, starter: true, position: 'bat', role: 'C', years: '1974–84, 1992',
    attrs: { contact: 6, power: 7, eye: 6, avoidK: 7, gap: 6, speed: 2, baserunning: 3, fielding: 9, arm: 8, clutch: 9 } },
  { name: "Andre Dawson", short: "Hawk", team: 'WSH', club: "Montreal Expos", number: 10, height: 75, weight: 195, age: null, bats: 'R', throws: 'R', skin: '#7a4030', espn: 83, starter: false, position: 'bat', role: 'CF', years: '1976–86',
    attrs: { contact: 7, power: 8, eye: 2, avoidK: 6, gap: 7, speed: 8, baserunning: 7, fielding: 9, arm: 10, clutch: 5 } },
  { name: "Tim Raines", short: "Rock", team: 'WSH', club: "Montreal Expos", number: 30, height: 68, weight: 186, age: null, bats: 'S', throws: 'R', skin: '#7a4830', espn: 622, starter: false, position: 'bat', role: 'LF', years: '1979–90, 2001',
    attrs: { contact: 8, power: 4, eye: 9, avoidK: 8, gap: 7, speed: 11, baserunning: 11, fielding: 6, arm: 4, clutch: 6 } },
  { name: "Ryan Zimmerman", short: "Zimmerman", team: 'WSH', number: 11, height: 75, weight: 215, age: null, bats: 'R', throws: 'R', skin: '#c7927c', espn: 6389, starter: false, position: 'bat', role: '3B', years: '2005–21',
    attrs: { contact: 7, power: 7, eye: 6, avoidK: 6, gap: 7, speed: 3, baserunning: 4, fielding: 7, arm: 5, clutch: 8 } },
  { name: "Anthony Rendon", short: "Rendon", team: 'WSH', number: 6, height: 73, weight: 200, age: null, bats: 'R', throws: 'R', skin: '#95705f', espn: 32098, starter: false, position: 'bat', role: '3B', years: '2013–19',
    attrs: { contact: 8, power: 7, eye: 9, avoidK: 9, gap: 8, speed: 3, baserunning: 4, fielding: 7, arm: 7, clutch: 9 } },
]
