// Legendary / retired QBs — 4 per franchise
// Grades calibrated against: Dan Marino (arm=11), Tom Brady NE (processing=11, leadership=11), Randall Cunningham PHI (legs=11)
// Current active QBs mirror qbs.js grades. Multi-team players graded per their tenure (peak team listed first).

import { TEAMS } from './qbs'

const _raw = [

  // ─── ARIZONA CARDINALS ───────────────────────────────────────────────────
  {
    name: 'Kurt Warner',     short: 'Warner',     team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#f2c8a4', number: 13, starter: true, captain: true, years: '2004–09',
    attrs: { arm: 8, legs: 2, size: 6, processing: 10, vision: 9, leadership: 10, accuracy: 9, playmaking: 8, 'pocket-presence': 10 }
  },
  {
    name: 'Carson Palmer',   short: 'Palmer',     team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#f2c8a4', number: 3,  starter: true, captain: true, years: '2013–17',
    attrs: { arm: 8, legs: 2, size: 7, processing: 8, vision: 7, leadership: 6, accuracy: 8, playmaking: 5, 'pocket-presence': 7 }
  },
  {
    name: 'Jim Hart',        short: 'Hart',       team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#f0c4a0', number: 17, starter: true, captain: true, years: '1966–83',
    attrs: { arm: 7, legs: 2, size: 7, processing: 6, vision: 8, leadership: 7, accuracy: 6, playmaking: 5, 'pocket-presence': 8 }
  },

  // ─── ATLANTA FALCONS ─────────────────────────────────────────────────────
  {
    name: 'Matt Ryan',       short: 'M. Ryan',    team: 'ATL', teamName: 'Atlanta Falcons',
    skin: '#f2c8a4', number: 2,  starter: true, captain: true, years: '2008–21',
    attrs: { arm: 8, legs: 2, size: 8, processing: 9, vision: 8, leadership: 8, accuracy: 9, playmaking: 5, 'pocket-presence': 9 }
  },
  {
    name: 'Michael Vick',    short: 'M. Vick',    team: 'ATL', teamName: 'Atlanta Falcons',
    skin: '#5e3c22', number: 7,  starter: true, captain: true, years: '2001–06',
    attrs: { arm: 9, legs: 11, size: 6, processing: 5, vision: 6, leadership: 3, accuracy: 6, playmaking: 11, 'pocket-presence': 7 }
  },
  {
    name: 'Steve Bartkowski', short: 'Bartkowski', team: 'ATL', teamName: 'Atlanta Falcons',
    skin: '#f0c4a0', number: 10, starter: true, captain: true, years: '1975–85',
    attrs: { arm: 9, legs: 3, size: 7, processing: 6, vision: 6, leadership: 7, accuracy: 6, playmaking: 5, 'pocket-presence': 6 }
  },

  // ─── BALTIMORE RAVENS ────────────────────────────────────────────────────
  {
    name: 'Joe Flacco',      short: 'Flacco',     team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#eebc98', number: 5,  starter: true, captain: true, years: '2008–18',
    attrs: { arm: 10, legs: 1, size: 9, processing: 7, vision: 6, leadership: 8, accuracy: 7, playmaking: 6, 'pocket-presence': 7 }
  },
  {
    // Synced to qbs.js (current grades)
    name: 'Lamar Jackson',   short: 'L. Jackson', team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#5e3c22', number: 8,  starter: true, captain: true, years: '2018–',
    attrs: { arm: 8, legs: 11, size: 6, processing: 6, leadership: 7, vision: 9, playmaking: 9, accuracy: 8, 'pocket-presence': 9 }
  },
  {
    name: 'Trent Dilfer',    short: 'Dilfer',     team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#f0c4a0', number: 12, starter: true, captain: true, years: '2000',
    attrs: { arm: 6, legs: 2, size: 7, processing: 7, vision: 6, leadership: 7, accuracy: 6, playmaking: 4, 'pocket-presence': 7 }
  },
  {
    // Late-career BAL stint (2006-07) — peak was Tennessee
    name: 'Steve McNair',    short: 'McNair',     team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#7a5030', number: 9,  starter: true, captain: true, years: '2006–07',
    attrs: { arm: 8, legs: 7, size: 8, processing: 7, vision: 7, leadership: 8, accuracy: 6, playmaking: 8, 'pocket-presence': 6 }
  },

  // ─── BUFFALO BILLS ───────────────────────────────────────────────────────
  {
    name: 'Jim Kelly',       short: 'Kelly',      team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#f0c4a0', number: 12, starter: true, captain: true, years: '1986–96',
    attrs: { arm: 9, legs: 3, size: 8, processing: 7, vision: 8, leadership: 10, accuracy: 8, playmaking: 7, 'pocket-presence': 9 }
  },
  {
    // Declining BUF tenure — prime was New England
    name: 'Drew Bledsoe',    short: 'Bledsoe',    team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#f0c4a0', number: 11, starter: true, captain: true, years: '2002–04',
    attrs: { arm: 8, legs: 2, size: 7, processing: 6, vision: 5, leadership: 6, accuracy: 5, playmaking: 4, 'pocket-presence': 4 }
  },
  {
    // Synced to qbs.js (current grades)
    name: 'Josh Allen',      short: 'J. Allen',   team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#f0c4a0', number: 17, starter: true, captain: true, years: '2018–',
    attrs: { arm: 11, legs: 9, size: 10, processing: 8, vision: 9, leadership: 9, accuracy: 8, playmaking: 9, 'pocket-presence': 9 }
  },

  // ─── CAROLINA PANTHERS ───────────────────────────────────────────────────
  {
    name: 'Cam Newton',      short: 'C. Newton',  team: 'CAR', teamName: 'Carolina Panthers',
    skin: '#5e3c22', number: 1,  starter: true, captain: true, years: '2011–19',
    attrs: { arm: 10, legs: 10, size: 11, processing: 7, vision: 8, leadership: 5, accuracy: 6, playmaking: 10, 'pocket-presence': 10 }
  },
  {
    name: 'Jake Delhomme',   short: 'Delhomme',   team: 'CAR', teamName: 'Carolina Panthers',
    skin: '#f0c4a0', number: 17, starter: true, captain: true, years: '2003–09',
    attrs: { arm: 7, legs: 3, size: 5, processing: 7, vision: 6, leadership: 8, accuracy: 8, playmaking: 5, 'pocket-presence': 7 }
  },
  {
    name: 'Kerry Collins',   short: 'K. Collins', team: 'CAR', teamName: 'Carolina Panthers',
    skin: '#f2c8a4', number: 5,  starter: true, captain: true, years: '1995–98',
    attrs: { arm: 8, legs: 2, size: 9, processing: 6, vision: 5, leadership: 6, accuracy: 6, playmaking: 5, 'pocket-presence': 5 }
  },

  // ─── CHICAGO BEARS ───────────────────────────────────────────────────────
  {
    name: 'Sid Luckman',     short: 'Luckman',    team: 'CHI', teamName: 'Chicago Bears',
    skin: '#f2c8a4', number: 42, starter: true, captain: true, years: '1939–50',
    attrs: { arm: 5, legs: 2, size: 6, processing: 9, vision: 9, leadership: 9, accuracy: 8, playmaking: 7, 'pocket-presence': 8 }
  },
  {
    name: 'Jim McMahon',     short: 'McMahon',    team: 'CHI', teamName: 'Chicago Bears',
    skin: '#f0c4a0', number: 9,  starter: true, captain: true, years: '1982–88',
    attrs: { arm: 7, legs: 5, size: 5, processing: 8, vision: 8, leadership: 9, accuracy: 6, playmaking: 8, 'pocket-presence': 6 }
  },
  {
    name: 'Jay Cutler',      short: 'Cutler',     team: 'CHI', teamName: 'Chicago Bears',
    skin: '#f2c8a4', number: 6,  starter: true, captain: true, years: '2009–16',
    attrs: { arm: 10, legs: 4, size: 8, processing: 5, vision: 6, leadership: 1, accuracy: 6, playmaking: 7, 'pocket-presence': 5 }
  },

  // ─── CINCINNATI BENGALS ──────────────────────────────────────────────────
  {
    name: 'Ken Anderson',    short: 'Anderson',   team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#f0c4a0', number: 14, starter: true, captain: true, years: '1971–86',
    attrs: { arm: 7, legs: 2, size: 6, processing: 9, vision: 9, leadership: 8, accuracy: 8, playmaking: 7, 'pocket-presence': 8 }
  },
  {
    name: 'Andy Dalton',     short: 'Dalton',     team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#f0c4a0', number: 14, starter: true, captain: true, years: '2011–19',
    attrs: { arm: 8, legs: 4, size: 7, processing: 8, vision: 6, leadership: 7, accuracy: 8, playmaking: 5, 'pocket-presence': 7 }
  },
  {
    name: 'Boomer Esiason',  short: 'Esiason',    team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#f0c4a0', number: 7,  starter: true, captain: true, years: '1984–92',
    attrs: { arm: 8, legs: 4, size: 8, processing: 7, vision: 9, leadership: 7, accuracy: 7, playmaking: 7, 'pocket-presence': 9 }
  },
  {
    // CIN Palmer was his prime — ARI was post-injuries, lower grades
    name: 'Carson Palmer',   short: 'C. Palmer',  team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#f2c8a4', number: 9,  starter: true, captain: true, years: '2003–10',
    attrs: { arm: 8, legs: 2, size: 8, processing: 8, vision: 7, leadership: 7, accuracy: 8, playmaking: 6, 'pocket-presence': 7 }
  },
  {
    // Synced to qbs.js — elite pocket passer (processing=11, accuracy=11)
    name: 'Joe Burrow',      short: 'Burrow',     team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#f2c8a4', number: 9,  starter: true, captain: true, years: '2020–',
    attrs: { arm: 7, legs: 6, size: 6, processing: 11, vision: 9, leadership: 7, accuracy: 11, playmaking: 9, 'pocket-presence': 9 }
  },

  // ─── CLEVELAND BROWNS ────────────────────────────────────────────────────
  {
    name: 'Otto Graham',     short: 'Graham',     team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#f0c4a0', number: 60, starter: true, captain: true, years: '1946–55',
    attrs: { arm: 5, legs: 7, size: 6, processing: 7, vision: 9, leadership: 10, accuracy: 8, playmaking: 9, 'pocket-presence': 7 }
  },
  {
    name: 'Bernie Kosar',    short: 'Kosar',      team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#f0c4a0', number: 19, starter: true, captain: true, years: '1985–93',
    attrs: { arm: 7, legs: 1, size: 7, processing: 9, vision: 9, leadership: 8, accuracy: 8, playmaking: 6, 'pocket-presence': 8 }
  },
  {
    name: 'Baker Mayfield',  short: 'Mayfield',   team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#f2c8a4', number: 6,  starter: true, captain: true, years: '2018–21',
    attrs: { arm: 9, legs: 5, size: 5, processing: 6, vision: 5, leadership: 5, accuracy: 7, playmaking: 7, 'pocket-presence': 6 }
  },

  // ─── DALLAS COWBOYS ──────────────────────────────────────────────────────
  {
    name: 'Roger Staubach',  short: 'Staubach',   team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#f0c4a0', number: 12, starter: true, captain: true, years: '1969–79',
    attrs: { arm: 6, legs: 5, size: 7, processing: 9, vision: 9, leadership: 10, accuracy: 8, playmaking: 7, 'pocket-presence': 8 }
  },
  {
    name: 'Troy Aikman',     short: 'Aikman',     team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#f0c4a0', number: 8,  starter: true, captain: true, years: '1989–2000',
    attrs: { arm: 7, legs: 3, size: 8, processing: 8, vision: 9, leadership: 10, accuracy: 9, playmaking: 6, 'pocket-presence': 9 }
  },
  {
    name: 'Tony Romo',       short: 'Romo',       team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#f0c4a0', number: 9,  starter: true, captain: true, years: '2003–16',
    attrs: { arm: 8, legs: 5, size: 7, processing: 8, vision: 7, leadership: 6, accuracy: 8, playmaking: 5, 'pocket-presence': 8 }
  },

  // ─── DENVER BRONCOS ──────────────────────────────────────────────────────
  {
    name: 'John Elway',      short: 'Elway',      team: 'DEN', teamName: 'Denver Broncos',
    skin: '#f0c4a0', number: 7,  starter: true, captain: true, years: '1983–98',
    attrs: { arm: 10, legs: 7, size: 7, processing: 9, vision: 9, leadership: 10, accuracy: 9, playmaking: 9, 'pocket-presence': 9 }
  },
  {
    // DEN Manning — mind still elite but arm significantly diminished vs IND prime
    name: 'Peyton Manning',  short: 'P. Manning', team: 'DEN', teamName: 'Denver Broncos',
    skin: '#f0c4a0', number: 18, starter: true, captain: true, years: '2012–15',
    attrs: { arm: 5, legs: 1, size: 7, processing: 11, vision: 10, leadership: 10, accuracy: 9, playmaking: 6, 'pocket-presence': 10 }
  },
  {
    name: 'Jake Plummer',    short: 'Plummer',    team: 'DEN', teamName: 'Denver Broncos',
    skin: '#f0c4a0', number: 16, starter: true, captain: true, years: '2003–06',
    attrs: { arm: 8, legs: 6, size: 6, processing: 5, vision: 8, leadership: 6, accuracy: 6, playmaking: 8, 'pocket-presence': 5 }
  },

  // ─── DETROIT LIONS ───────────────────────────────────────────────────────
  {
    // Early-career peak; arm was legendary but leadership on losing team
    name: 'Bobby Layne',     short: 'Layne',      team: 'DET', teamName: 'Detroit Lions',
    skin: '#f0c4a0', number: 22, starter: true, captain: true, years: '1950–58',
    attrs: { arm: 7, legs: 3, size: 7, processing: 8, vision: 8, leadership: 10, accuracy: 7, playmaking: 7, 'pocket-presence': 8 }
  },
  {
    name: 'Matthew Stafford', short: 'Stafford',  team: 'DET', teamName: 'Detroit Lions',
    skin: '#f0c4a0', number: 9,  starter: true, captain: true, years: '2009–20',
    attrs: { arm: 10, legs: 3, size: 8, processing: 9, vision: 7, leadership: 8, accuracy: 9, playmaking: 6, 'pocket-presence': 7 }
  },
  {
    // Synced to qbs.js — elite accuracy, limited arm and athleticism
    name: 'Jared Goff',      short: 'Goff',       team: 'DET', teamName: 'Detroit Lions',
    skin: '#f2c8a4', number: 16, starter: true, captain: true, years: '2021–',
    attrs: { arm: 6, legs: 1, size: 3, processing: 8, vision: 7, leadership: 7, accuracy: 9, playmaking: 1, 'pocket-presence': 7 }
  },

  // ─── GREEN BAY PACKERS ───────────────────────────────────────────────────
  {
    name: 'Brett Favre',     short: 'Favre',      team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#f0c4a0', number: 4,  starter: true, captain: true, years: '1992–2007',
    attrs: { arm: 11, legs: 6, size: 7, processing: 7, vision: 6, leadership: 6, accuracy: 9, playmaking: 9, 'pocket-presence': 7 }
  },
  {
    name: 'Aaron Rodgers',   short: 'A. Rodgers', team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#f0c4a0', number: 12, starter: true, captain: true, years: '2005–22',
    attrs: { arm: 11, legs: 6, size: 5, processing: 10, vision: 11, leadership: 7, accuracy: 11, playmaking: 10, 'pocket-presence': 11 }
  },
  {
    name: 'Bart Starr',      short: 'Starr',      team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#f0c4a0', number: 15, starter: true, captain: true, years: '1956–71',
    attrs: { arm: 6, legs: 3, size: 6, processing: 8, vision: 9, leadership: 10, accuracy: 9, playmaking: 7, 'pocket-presence': 9 }
  },

  // ─── HOUSTON TEXANS ──────────────────────────────────────────────────────
  {
    name: 'Matt Schaub',     short: 'Schaub',     team: 'HOU', teamName: 'Houston Texans',
    skin: '#f0c4a0', number: 8,  starter: true, captain: true, years: '2007–13',
    attrs: { arm: 8, legs: 2, size: 7, processing: 8, vision: 8, leadership: 7, accuracy: 8, playmaking: 5, 'pocket-presence': 7 }
  },
  {
    // HOU Watson = prime pre-injury years, not CLE's diminished version
    name: 'Deshaun Watson',  short: 'D. Watson',  team: 'HOU', teamName: 'Houston Texans',
    skin: '#7a5030', number: 4,  starter: true, captain: true, years: '2017–20',
    attrs: { arm: 7, legs: 8, size: 6, processing: 6, vision: 8, leadership: 6, accuracy: 7, playmaking: 9, 'pocket-presence': 8 }
  },
  {
    // Synced to qbs.js
    name: 'C.J. Stroud',     short: 'Stroud',     team: 'HOU', teamName: 'Houston Texans',
    skin: '#7a5030', number: 7,  starter: true, captain: true, years: '2023–',
    attrs: { arm: 7, legs: 5, size: 6, processing: 6, vision: 5, leadership: 7, accuracy: 9, playmaking: 6, 'pocket-presence': 4 }
  },

  // ─── INDIANAPOLIS COLTS ──────────────────────────────────────────────────
  {
    // IND Manning = peak (arm still functional, mind at maximum)
    name: 'Peyton Manning',  short: 'P. Manning', team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#f0c4a0', number: 18, starter: true, captain: true, years: '1998–2011',
    attrs: { arm: 7, legs: 2, size: 8, processing: 11, vision: 11, leadership: 10, accuracy: 11, playmaking: 6, 'pocket-presence': 11 }
  },
  {
    name: 'Johnny Unitas',   short: 'Unitas',     team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#f0c4a0', number: 19, starter: true, captain: true, years: '1956–72',
    attrs: { arm: 7, legs: 2, size: 7, processing: 8, vision: 10, leadership: 10, accuracy: 9, playmaking: 7, 'pocket-presence': 7 }
  },
  {
    name: 'Andrew Luck',     short: 'Luck',       team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#f2c8a4', number: 12, starter: true, captain: true, years: '2012–18',
    attrs: { arm: 9, legs: 6, size: 9, processing: 9, vision: 8, leadership: 8, accuracy: 9, playmaking: 8, 'pocket-presence': 6 }
  },

  // ─── JACKSONVILLE JAGUARS ────────────────────────────────────────────────
  {
    name: 'Mark Brunell',    short: 'Brunell',    team: 'JAX', teamName: 'Jacksonville Jaguars',
    skin: '#f0c4a0', number: 8,  starter: true, captain: true, years: '1995–2003',
    attrs: { arm: 7, legs: 7, size: 6, processing: 7, vision: 8, leadership: 8, accuracy: 8, playmaking: 9, 'pocket-presence': 6 }
  },
  {
    name: 'David Garrard',   short: 'Garrard',    team: 'JAX', teamName: 'Jacksonville Jaguars',
    skin: '#7a5030', number: 9,  starter: true, captain: true, years: '2002–10',
    attrs: { arm: 7, legs: 8, size: 6, processing: 7, vision: 7, leadership: 8, accuracy: 7, playmaking: 8, 'pocket-presence': 6 }
  },
  {
    name: 'Blake Bortles',   short: 'Bortles',    team: 'JAX', teamName: 'Jacksonville Jaguars',
    skin: '#f0c4a0', number: 5,  starter: true, captain: true, years: '2014–18',
    attrs: { arm: 7, legs: 6, size: 8, processing: 5, vision: 4, leadership: 7, accuracy: 4, playmaking: 6, 'pocket-presence': 5 }
  },

  // ─── KANSAS CITY CHIEFS ──────────────────────────────────────────────────
  {
    // Synced to qbs.js — vision=11 is Mahomes' signature
    name: 'Patrick Mahomes', short: 'Mahomes',    team: 'KC',  teamName: 'Kansas City Chiefs',
    skin: '#d4a070', number: 15, starter: true, captain: true, years: '2017–',
    attrs: { arm: 11, legs: 8, size: 8, processing: 9, vision: 11, leadership: 9, accuracy: 9, playmaking: 11, 'pocket-presence': 10 }
  },
  {
    // KC Montana = late career (age 37) — notably less than SF prime
    name: 'Joe Montana',     short: 'Montana',    team: 'KC',  teamName: 'Kansas City Chiefs',
    skin: '#f0c4a0', number: 19, starter: true, captain: true, years: '1993–94',
    attrs: { arm: 6, legs: 3, size: 6, processing: 9, vision: 8, leadership: 10, accuracy: 9, playmaking: 7, 'pocket-presence': 9 }
  },
  {
    name: 'Alex Smith',      short: 'A. Smith',   team: 'KC',  teamName: 'Kansas City Chiefs',
    skin: '#f0c4a0', number: 11, starter: true, captain: true, years: '2013–17',
    attrs: { arm: 6, legs: 5, size: 7, processing: 8, vision: 7, leadership: 7, accuracy: 8, playmaking: 4, 'pocket-presence': 8 }
  },

  // ─── LAS VEGAS RAIDERS ───────────────────────────────────────────────────
  {
    name: 'Ken Stabler',     short: 'Stabler',    team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#f0c4a0', number: 12, starter: true, captain: true, years: '1970–79',
    attrs: { arm: 7, legs: 3, size: 6, processing: 8, vision: 8, leadership: 9, accuracy: 9, playmaking: 8, 'pocket-presence': 9 }
  },
  {
    name: 'Jim Plunkett',    short: 'Plunkett',   team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#d4a070', number: 16, starter: true, captain: true, years: '1978–86',
    attrs: { arm: 8, legs: 4, size: 7, processing: 6, vision: 8, leadership: 9, accuracy: 7, playmaking: 6, 'pocket-presence': 8 }
  },
  {
    name: 'Rich Gannon',     short: 'Gannon',     team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#f0c4a0', number: 12, starter: true, captain: true, years: '1999–2003',
    attrs: { arm: 8, legs: 6, size: 6, processing: 8, vision: 9, leadership: 6, accuracy: 8, playmaking: 7, 'pocket-presence': 7 }
  },

  // ─── LOS ANGELES CHARGERS ────────────────────────────────────────────────
  {
    name: 'Dan Fouts',       short: 'Fouts',      team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#f0c4a0', number: 14, starter: true, captain: true, years: '1973–87',
    attrs: { arm: 8, legs: 2, size: 7, processing: 9, vision: 9, leadership: 8, accuracy: 9, playmaking: 7, 'pocket-presence': 8 }
  },
  {
    name: 'Philip Rivers',   short: 'Rivers',     team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#f2c8a4', number: 17, starter: true, captain: true, years: '2004–19',
    attrs: { arm: 8, legs: 1, size: 9, processing: 9, vision: 8, leadership: 9, accuracy: 8, playmaking: 4, 'pocket-presence': 9 }
  },
  {
    // Synced to qbs.js
    name: 'Justin Herbert',  short: 'Herbert',    team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#f2c8a4', number: 10, starter: true, captain: true, years: '2020–',
    attrs: { arm: 10, legs: 7, size: 9, processing: 8, vision: 8, leadership: 6, accuracy: 9, playmaking: 8, 'pocket-presence': 7 }
  },

  // ─── LOS ANGELES RAMS ────────────────────────────────────────────────────
  {
    name: 'Kurt Warner',     short: 'Warner',     team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#f2c8a4', number: 13, starter: true, captain: true, years: '1998–2003',
    attrs: { arm: 8, legs: 2, size: 6, processing: 10, vision: 9, leadership: 10, accuracy: 9, playmaking: 8, 'pocket-presence': 9 }
  },
  {
    // LAR Stafford — McVay system, Super Bowl winner; slightly elevated vs DET
    name: 'Matthew Stafford', short: 'Stafford',  team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#f0c4a0', number: 9,  starter: true, captain: true, years: '2021–',
    attrs: { arm: 9, legs: 2, size: 5, processing: 9, vision: 10, leadership: 8, accuracy: 9, playmaking: 7, 'pocket-presence': 8 }
  },
  {
    name: 'Roman Gabriel',   short: 'Gabriel',    team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#d4a070', number: 18, starter: true, captain: true, years: '1962–72',
    attrs: { arm: 7, legs: 3, size: 7, processing: 8, vision: 7, leadership: 8, accuracy: 6, playmaking: 6, 'pocket-presence': 7 }
  },

  // ─── MIAMI DOLPHINS ──────────────────────────────────────────────────────
  {
    name: 'Dan Marino',      short: 'Marino',     team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#f0c4a0', number: 13, starter: true, captain: true, years: '1983–99',
    attrs: { arm: 11, legs: 3, size: 8, processing: 9, vision: 9, leadership: 8, accuracy: 10, playmaking: 8, 'pocket-presence': 10 }
  },
  {
    name: 'Bob Griese',      short: 'B. Griese',  team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#f0c4a0', number: 12, starter: true, captain: true, years: '1967–80',
    attrs: { arm: 6, legs: 2, size: 6, processing: 8, vision: 8, leadership: 9, accuracy: 8, playmaking: 7, 'pocket-presence': 8 }
  },
  {
    name: 'Ryan Tannehill',  short: 'Tannehill',  team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#f2c8a4', number: 17, starter: true, captain: true, years: '2012–18',
    attrs: { arm: 7, legs: 7, size: 8, processing: 6, vision: 7, leadership: 7, accuracy: 6, playmaking: 6, 'pocket-presence': 5 }
  },

  // ─── MINNESOTA VIKINGS ───────────────────────────────────────────────────
  {
    // PHI Tarkenton = young, mobile, scrambly
    name: 'Fran Tarkenton',  short: 'Tarkenton',  team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#f0c4a0', number: 10, starter: true, captain: true, years: "1961–66, '72–78",
    attrs: { arm: 4, legs: 8, size: 5, processing: 8, vision: 7, leadership: 8, accuracy: 8, playmaking: 10, 'pocket-presence': 7 }
  },
  {
    name: 'Daunte Culpepper', short: 'Culpepper',  team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#5e3c22', number: 11, starter: true, captain: true, years: '1999–2005',
    attrs: { arm: 9, legs: 8, size: 11, processing: 7, vision: 8, leadership: 7, accuracy: 7, playmaking: 9, 'pocket-presence': 8 }
  },
  {
    // MIN Favre 2009 (age 40) — arm held, legs and leadership slightly down
    name: 'Brett Favre',     short: 'Favre',      team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#f0c4a0', number: 4,  starter: true, captain: true, years: '2009–10',
    attrs: { arm: 9, legs: 4, size: 6, processing: 7, vision: 6, leadership: 6, accuracy: 8, playmaking: 9, 'pocket-presence': 8 }
  },
  {
    // MIN Cunningham 1998 (age 35) — still electric but less mobile than PHI peak
    name: 'Randall Cunningham', short: 'Cunningham', team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#7a5030', number: 7,  starter: true, captain: true, years: '1997–99',
    attrs: { arm: 9, legs: 9, size: 7, processing: 7, vision: 8, leadership: 7, accuracy: 7, playmaking: 9, 'pocket-presence': 7 }
  },

  // ─── NEW ENGLAND PATRIOTS ────────────────────────────────────────────────
  {
    // NE Brady = dynasty peak
    name: 'Tom Brady',       short: 'Brady',      team: 'NE',  teamName: 'New England Patriots',
    skin: '#f2c8a4', number: 12, starter: true, captain: true, years: '2000–19',
    attrs: { arm: 9, legs: 2, size: 8, processing: 11, vision: 11, leadership: 11, accuracy: 11, playmaking: 7, 'pocket-presence': 11 }
  },
  {
    // NE Bledsoe = prime years, better than his BUF decline
    name: 'Drew Bledsoe',    short: 'Bledsoe',    team: 'NE',  teamName: 'New England Patriots',
    skin: '#f0c4a0', number: 11, starter: true, captain: true, years: '1993–2001',
    attrs: { arm: 9, legs: 1, size: 9, processing: 6, vision: 8, leadership: 7, accuracy: 7, playmaking: 5, 'pocket-presence': 6 }
  },
  {
    name: 'Steve Grogan',    short: 'Grogan',     team: 'NE',  teamName: 'New England Patriots',
    skin: '#f0c4a0', number: 14, starter: true, captain: true, years: '1975–90',
    attrs: { arm: 8, legs: 7, size: 7, processing: 5, vision: 6, leadership: 8, accuracy: 6, playmaking: 8, 'pocket-presence': 5 }
  },

  // ─── NEW ORLEANS SAINTS ──────────────────────────────────────────────────
  {
    name: 'Drew Brees',      short: 'Brees',      team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#f2c8a4', number: 9,  starter: true, captain: true, years: '2006–20',
    attrs: { arm: 7, legs: 4, size: 3, processing: 11, vision: 9, leadership: 10, accuracy: 11, playmaking: 7, 'pocket-presence': 10 }
  },
  {
    name: 'Archie Manning',  short: 'A. Manning', team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#f0c4a0', number: 8,  starter: true, captain: true, years: '1971–82',
    attrs: { arm: 8, legs: 7, size: 7, processing: 6, vision: 7, leadership: 6, accuracy: 6, playmaking: 7, 'pocket-presence': 4 }
  },
  {
    name: 'Bobby Hebert',    short: 'Hebert',     team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#f0c4a0', number: 1,  starter: true, captain: true, years: '1985–92',
    attrs: { arm: 6, legs: 3, size: 7, processing: 8, vision: 6, leadership: 8, accuracy: 7, playmaking: 4, 'pocket-presence': 8 }
  },

  // ─── NEW YORK GIANTS ─────────────────────────────────────────────────────
  {
    name: 'Eli Manning',     short: 'E. Manning', team: 'NYG', teamName: 'New York Giants',
    skin: '#f2c8a4', number: 10, starter: true, captain: true, years: '2004–19',
    attrs: { arm: 7, legs: 1, size: 7, processing: 8, vision: 7, leadership: 10, accuracy: 8, playmaking: 4, 'pocket-presence': 6 }
  },
  {
    name: 'Phil Simms',      short: 'Simms',      team: 'NYG', teamName: 'New York Giants',
    skin: '#f0c4a0', number: 11, starter: true, captain: true, years: '1979–93',
    attrs: { arm: 7, legs: 3, size: 6, processing: 8, vision: 7, leadership: 8, accuracy: 9, playmaking: 5, 'pocket-presence': 8 }
  },
  {
    // NYG Collins = peak years; led team to Super Bowl XXXV — notably better than his CAR entry
    name: 'Kerry Collins',   short: 'K. Collins', team: 'NYG', teamName: 'New York Giants',
    skin: '#f2c8a4', number: 5,  starter: true, captain: true, years: '1999–2003',
    attrs: { arm: 8, legs: 2, size: 9, processing: 7, vision: 6, leadership: 7, accuracy: 8, playmaking: 5, 'pocket-presence': 7 }
  },

  // ─── NEW YORK JETS ───────────────────────────────────────────────────────
  {
    name: 'Joe Namath',      short: 'Namath',     team: 'NYJ', teamName: 'New York Jets',
    skin: '#f0c4a0', number: 12, starter: true, captain: true, years: '1965–76',
    attrs: { arm: 7, legs: 2, size: 7, processing: 8, vision: 9, leadership: 9, accuracy: 8, playmaking: 6, 'pocket-presence': 8 }
  },
  {
    name: 'Vinny Testaverde', short: 'Testaverde', team: 'NYJ', teamName: 'New York Jets',
    skin: '#f0c4a0', number: 16, starter: true, captain: true, years: '1998–2003',
    attrs: { arm: 10, legs: 2, size: 7, processing: 5, vision: 6, leadership: 6, accuracy: 5, playmaking: 5, 'pocket-presence': 6 }
  },
  {
    name: 'Mark Sanchez',    short: 'Sanchez',    team: 'NYJ', teamName: 'New York Jets',
    skin: '#d4a070', number: 6,  starter: true, captain: true, years: '2009–13',
    attrs: { arm: 7, legs: 5, size: 6, processing: 5, vision: 5, leadership: 6, accuracy: 5, playmaking: 5, 'pocket-presence': 5 }
  },
  {
    name: 'Chad Pennington', short: 'Pennington', team: 'NYJ', teamName: 'New York Jets',
    skin: '#f0c4a0', number: 10, starter: true, captain: true, years: '2000–07',
    attrs: { arm: 5, legs: 3, size: 5, processing: 7, vision: 8, leadership: 8, accuracy: 10, playmaking: 5, 'pocket-presence': 8 }
  },

  // ─── PHILADELPHIA EAGLES ─────────────────────────────────────────────────
  {
    // PHI Cunningham = peak (young, legs=11, explosive)
    name: 'Randall Cunningham', short: 'Cunningham', team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#7a5030', number: 12, starter: true, captain: true, years: '1985–95',
    attrs: { arm: 9, legs: 11, size: 7, processing: 6, vision: 7, leadership: 7, accuracy: 7, playmaking: 10, 'pocket-presence': 6 }
  },
  {
    name: 'Donovan McNabb',  short: 'McNabb',     team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#7a5030', number: 5,  starter: true, captain: true, years: '1999–2009',
    attrs: { arm: 8, legs: 8, size: 9, processing: 8, vision: 9, leadership: 8, accuracy: 6, playmaking: 9, 'pocket-presence': 6 }
  },
  {
    // PHI Vick = peak statistical years (2010 MVP runner-up) — more developed than ATL but less raw athleticism
    name: 'Michael Vick',    short: 'M. Vick',    team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#5e3c22', number: 7,  starter: true, captain: true, years: '2009–12',
    attrs: { arm: 10, legs: 10, size: 6, processing: 6, vision: 7, leadership: 5, accuracy: 7, playmaking: 10, 'pocket-presence': 7 }
  },
  {
    name: 'Nick Foles',      short: 'Foles',      team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#f2c8a4', number: 9,  starter: true, captain: true, years: "2012–14, '17–18",
    attrs: { arm: 8, legs: 2, size: 9, processing: 6, vision: 5, leadership: 9, accuracy: 6, playmaking: 4, 'pocket-presence': 7 }
  },

  // ─── PITTSBURGH STEELERS ─────────────────────────────────────────────────
  {
    name: 'Terry Bradshaw',  short: 'Bradshaw',   team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#f0c4a0', number: 12, starter: true, captain: true, years: '1970–83',
    attrs: { arm: 9, legs: 4, size: 7, processing: 5, vision: 7, leadership: 10, accuracy: 7, playmaking: 8, 'pocket-presence': 8 }
  },
  {
    name: 'Ben Roethlisberger', short: 'Big Ben',  team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#f0c4a0', number: 7,  starter: true, captain: true, years: '2004–21',
    attrs: { arm: 9, legs: 4, size: 11, processing: 8, vision: 9, leadership: 8, accuracy: 8, playmaking: 8, 'pocket-presence': 10 }
  },
  {
    name: 'Kordell Stewart',  short: 'K. Stewart', team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#7a5030', number: 10, starter: true, captain: true, years: '1995–2002',
    attrs: { arm: 8, legs: 9, size: 7, processing: 5, vision: 5, leadership: 6, accuracy: 5, playmaking: 8, 'pocket-presence': 5 }
  },

  // ─── SAN FRANCISCO 49ERS ─────────────────────────────────────────────────
  {
    // SF Montana = peak (significantly better than KC late-career)
    name: 'Joe Montana',     short: 'Montana',    team: 'SF',  teamName: 'San Francisco 49ers',
    skin: '#f0c4a0', number: 16, starter: true, captain: true, years: '1979–92',
    attrs: { arm: 8, legs: 5, size: 6, processing: 10, vision: 11, leadership: 11, accuracy: 9, playmaking: 9, 'pocket-presence': 9 }
  },
  {
    name: 'Steve Young',     short: 'S. Young',   team: 'SF',  teamName: 'San Francisco 49ers',
    skin: '#f0c4a0', number: 8,  starter: true, captain: true, years: '1987–99',
    attrs: { arm: 8, legs: 9, size: 7, processing: 9, vision: 9, leadership: 9, accuracy: 9, playmaking: 10, 'pocket-presence': 8 }
  },
  {
    name: 'Colin Kaepernick', short: 'Kaepernick', team: 'SF',  teamName: 'San Francisco 49ers',
    skin: '#7a5030', number: 7,  starter: true, captain: true, years: '2011–16',
    attrs: { arm: 8, legs: 8, size: 8, processing: 5, vision: 6, leadership: 7, accuracy: 5, playmaking: 8, 'pocket-presence': 6 }
  },

  // ─── SEATTLE SEAHAWKS ────────────────────────────────────────────────────
  {
    name: 'Russell Wilson',  short: 'R. Wilson',  team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#7a5030', number: 3,  starter: true, captain: true, years: '2012–21',
    attrs: { arm: 8, legs: 8, size: 4, processing: 8, vision: 9, leadership: 6, accuracy: 9, playmaking: 10, 'pocket-presence': 8 }
  },
  {
    name: 'Matt Hasselbeck',  short: 'Hasselbeck', team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#f0c4a0', number: 8,  starter: true, captain: true, years: '2001–10',
    attrs: { arm: 6, legs: 4, size: 6, processing: 8, vision: 7, leadership: 8, accuracy: 8, playmaking: 5, 'pocket-presence': 8 }
  },
  {
    name: 'Jim Zorn',        short: 'Zorn',       team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#f0c4a0', number: 10, starter: true, captain: true, years: '1976–84',
    attrs: { arm: 6, legs: 8, size: 5, processing: 6, vision: 7, leadership: 7, accuracy: 6, playmaking: 7, 'pocket-presence': 5 }
  },

  // ─── TAMPA BAY BUCCANEERS ────────────────────────────────────────────────
  {
    // TB Brady = age 43-44, still elite but visibly a step behind NE peak
    name: 'Tom Brady',       short: 'Brady',      team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#f2c8a4', number: 12, starter: true, captain: true, years: '2020–22',
    attrs: { arm: 8, legs: 2, size: 8, processing: 11, vision: 9, leadership: 10, accuracy: 10, playmaking: 6, 'pocket-presence': 10 }
  },
  {
    name: 'Brad Johnson',    short: 'B. Johnson', team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#f0c4a0', number: 14, starter: true, captain: true, years: '2001–03',
    attrs: { arm: 6, legs: 3, size: 6, processing: 8, vision: 7, leadership: 8, accuracy: 7, playmaking: 5, 'pocket-presence': 7 }
  },
  {
    name: 'Jameis Winston',  short: 'Winston',    team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#7a5030', number: 3,  starter: true, captain: true, years: '2015–19',
    attrs: { arm: 8, legs: 5, size: 8, processing: 4, vision: 0, leadership: 10, accuracy: 6, playmaking: 6, 'pocket-presence': 4 }
  },

  // ─── TENNESSEE TITANS ────────────────────────────────────────────────────
  {
    // TEN McNair = peak (2003 MVP) — better than his BAL entry
    name: 'Steve McNair',    short: 'McNair',     team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#7a5030', number: 9,  starter: true, captain: true, years: '1995–2005',
    attrs: { arm: 8, legs: 8, size: 8, processing: 7, vision: 7, leadership: 8, accuracy: 7, playmaking: 9, 'pocket-presence': 7 }
  },
  {
    name: 'Warren Moon',     short: 'Moon',       team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#7a5030', number: 1,  starter: true, captain: true, years: '1984–93',
    attrs: { arm: 8, legs: 4, size: 7, processing: 8, vision: 9, leadership: 8, accuracy: 8, playmaking: 7, 'pocket-presence': 8 }
  },
  {
    name: 'Vince Young',     short: 'V. Young',   team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#5e3c22', number: 10, starter: true, captain: true, years: '2006–10',
    attrs: { arm: 7, legs: 8, size: 9, processing: 4, vision: 3, leadership: 6, accuracy: 4, playmaking: 8, 'pocket-presence': 4 }
  },

  // ─── WASHINGTON COMMANDERS ───────────────────────────────────────────────
  {
    name: 'Sammy Baugh',     short: 'Baugh',      team: 'WAS', teamName: 'Washington Commanders',
    skin: '#f0c4a0', number: 33, starter: true, captain: true, years: '1937–52',
    attrs: { arm: 4, legs: 2, size: 6, processing: 7, vision: 7, leadership: 8, accuracy: 9, playmaking: 7, 'pocket-presence': 7 }
  },
  {
    name: 'Joe Theismann',   short: 'Theismann',  team: 'WAS', teamName: 'Washington Commanders',
    skin: '#f0c4a0', number: 7,  starter: true, captain: true, years: '1974–85',
    attrs: { arm: 7, legs: 5, size: 5, processing: 9, vision: 7, leadership: 8, accuracy: 7, playmaking: 6, 'pocket-presence': 8 }
  },
  {
    name: 'Sonny Jurgensen', short: 'Jurgensen',  team: 'WAS', teamName: 'Washington Commanders',
    skin: '#f2c8a4', number: 9,  starter: true, captain: true, years: '1964–74',
    attrs: { arm: 8, legs: 2, size: 3, processing: 5, vision: 7, leadership: 7, accuracy: 8, playmaking: 5, 'pocket-presence': 6 }
  },
]

const _colorMap = Object.fromEntries(TEAMS.map(t => [t.short, { color: t.color, color2: t.color2 }]))

export const LEGENDS = _raw.map(qb => ({
  ...qb,
  ..._colorMap[qb.team],
  attrs: Object.fromEntries(
    Object.entries(qb.attrs).map(([k, v]) => [k, Math.min(11, v)])
  ),
}))

export const LEGEND_TYPES = ['arm', 'legs', 'size', 'processing', 'leadership', 'vision', 'playmaking', 'accuracy', 'pocket-presence']
