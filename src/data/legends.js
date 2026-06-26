// Legendary / retired QBs — 4 per franchise
// Grades calibrated against: Dan Marino (arm=11), Tom Brady (processing=11, leadership=11, accuracy=10), Randall Cunningham (legs=11)

import { TEAMS } from './qbs'

const _raw = [

  // ─── ARIZONA CARDINALS ───────────────────────────────────────────────────
  {
    name: 'Kurt Warner',     short: 'Warner',     team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#f2c8a4', number: 13, starter: true, captain: true,
    attrs: { arm: 8, legs: 2, size: 6, processing: 10, vision: 10, leadership: 9, accuracy: 9, playmaking: 8, 'pocket-presence': 9 }
  },
  {
    name: 'Neil Lomax',      short: 'Lomax',      team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#f2c8a4', number: 16, starter: true, captain: false,
    attrs: { arm: 8, legs: 2, size: 6, processing: 7, vision: 8, leadership: 7, accuracy: 8, playmaking: 6, 'pocket-presence': 7 }
  },
  {
    name: 'Jim Hart',        short: 'Hart',       team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#f0c4a0', number: 17, starter: true, captain: false,
    attrs: { arm: 7, legs: 2, size: 5, processing: 6, vision: 7, leadership: 6, accuracy: 6, playmaking: 5, 'pocket-presence': 6 }
  },
  {
    name: 'Carson Palmer',   short: 'Palmer',     team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#f2c8a4', number: 3,  starter: true, captain: false,
    attrs: { arm: 9, legs: 2, size: 7, processing: 8, vision: 8, leadership: 7, accuracy: 8, playmaking: 6, 'pocket-presence': 7 }
  },

  // ─── ATLANTA FALCONS ─────────────────────────────────────────────────────
  {
    name: 'Matt Ryan',       short: 'M. Ryan',    team: 'ATL', teamName: 'Atlanta Falcons',
    skin: '#f2c8a4', number: 2,  starter: true, captain: true,
    attrs: { arm: 8, legs: 2, size: 6, processing: 9, vision: 9, leadership: 8, accuracy: 9, playmaking: 7, 'pocket-presence': 9 }
  },
  {
    name: 'Michael Vick',    short: 'M. Vick',    team: 'ATL', teamName: 'Atlanta Falcons',
    skin: '#5e3c22', number: 7,  starter: true, captain: false,
    attrs: { arm: 9, legs: 11, size: 6, processing: 5, vision: 6, leadership: 6, accuracy: 6, playmaking: 11, 'pocket-presence': 6 }
  },
  {
    name: 'Steve Bartkowski', short: 'Bartkowski', team: 'ATL', teamName: 'Atlanta Falcons',
    skin: '#f0c4a0', number: 10, starter: true, captain: false,
    attrs: { arm: 9, legs: 3, size: 7, processing: 6, vision: 7, leadership: 7, accuracy: 7, playmaking: 6, 'pocket-presence': 7 }
  },
  {
    name: 'Chris Chandler',  short: 'Chandler',   team: 'ATL', teamName: 'Atlanta Falcons',
    skin: '#f0c4a0', number: 12, starter: true, captain: false,
    attrs: { arm: 7, legs: 3, size: 6, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 5, 'pocket-presence': 7 }
  },

  // ─── BALTIMORE RAVENS ────────────────────────────────────────────────────
  {
    name: 'Joe Flacco',      short: 'Flacco',     team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#eebc98', number: 5,  starter: true, captain: true,
    attrs: { arm: 9, legs: 1, size: 8, processing: 7, vision: 7, leadership: 8, accuracy: 7, playmaking: 6, 'pocket-presence': 7 }
  },
  {
    name: 'Vinny Testaverde', short: 'Testaverde', team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#f0c4a0', number: 14, starter: true, captain: false,
    attrs: { arm: 9, legs: 2, size: 7, processing: 6, vision: 6, leadership: 6, accuracy: 6, playmaking: 5, 'pocket-presence': 6 }
  },
  {
    name: 'Lamar Jackson',   short: 'L. Jackson', team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#5e3c22', number: 8,  starter: true, captain: false,
    attrs: { arm: 9, legs: 11, size: 7, processing: 8, vision: 9, leadership: 9, accuracy: 7, playmaking: 10, 'pocket-presence': 8 }
  },
  {
    name: 'Steve McNair',    short: 'McNair',     team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#7a5030', number: 9,  starter: true, captain: false,
    attrs: { arm: 8, legs: 8, size: 8, processing: 8, vision: 7, leadership: 9, accuracy: 7, playmaking: 9, 'pocket-presence': 7 }
  },

  // ─── BUFFALO BILLS ───────────────────────────────────────────────────────
  {
    name: 'Jim Kelly',       short: 'Kelly',      team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#f0c4a0', number: 12, starter: true, captain: true,
    attrs: { arm: 9, legs: 3, size: 8, processing: 8, vision: 8, leadership: 10, accuracy: 8, playmaking: 8, 'pocket-presence': 9 }
  },
  {
    name: 'Jack Kemp',       short: 'Kemp',       team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#f2c8a4', number: 15, starter: true, captain: false,
    attrs: { arm: 7, legs: 4, size: 6, processing: 7, vision: 7, leadership: 8, accuracy: 6, playmaking: 6, 'pocket-presence': 7 }
  },
  {
    name: 'Drew Bledsoe',    short: 'Bledsoe',    team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#f0c4a0', number: 11, starter: true, captain: false,
    attrs: { arm: 9, legs: 1, size: 8, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 5, 'pocket-presence': 6 }
  },
  {
    name: 'Josh Allen',      short: 'J. Allen',   team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#f0c4a0', number: 17, starter: true, captain: false,
    attrs: { arm: 11, legs: 9, size: 10, processing: 8, vision: 9, leadership: 9, accuracy: 8, playmaking: 10, 'pocket-presence': 9 }
  },

  // ─── CAROLINA PANTHERS ───────────────────────────────────────────────────
  {
    name: 'Cam Newton',      short: 'C. Newton',  team: 'CAR', teamName: 'Carolina Panthers',
    skin: '#5e3c22', number: 1,  starter: true, captain: true,
    attrs: { arm: 9, legs: 9, size: 11, processing: 6, vision: 6, leadership: 8, accuracy: 6, playmaking: 10, 'pocket-presence': 7 }
  },
  {
    name: 'Jake Delhomme',   short: 'Delhomme',   team: 'CAR', teamName: 'Carolina Panthers',
    skin: '#f0c4a0', number: 17, starter: true, captain: false,
    attrs: { arm: 7, legs: 3, size: 5, processing: 7, vision: 7, leadership: 8, accuracy: 7, playmaking: 7, 'pocket-presence': 7 }
  },
  {
    name: 'Kerry Collins',   short: 'K. Collins', team: 'CAR', teamName: 'Carolina Panthers',
    skin: '#f2c8a4', number: 5,  starter: true, captain: false,
    attrs: { arm: 8, legs: 2, size: 7, processing: 6, vision: 6, leadership: 6, accuracy: 6, playmaking: 5, 'pocket-presence': 6 }
  },
  {
    name: 'Steve Beuerlein', short: 'Beuerlein',  team: 'CAR', teamName: 'Carolina Panthers',
    skin: '#f0c4a0', number: 12, starter: true, captain: false,
    attrs: { arm: 7, legs: 2, size: 6, processing: 6, vision: 6, leadership: 6, accuracy: 6, playmaking: 5, 'pocket-presence': 6 }
  },

  // ─── CHICAGO BEARS ───────────────────────────────────────────────────────
  {
    name: 'Sid Luckman',     short: 'Luckman',    team: 'CHI', teamName: 'Chicago Bears',
    skin: '#f2c8a4', number: 42, starter: true, captain: true,
    attrs: { arm: 8, legs: 4, size: 6, processing: 9, vision: 9, leadership: 9, accuracy: 8, playmaking: 8, 'pocket-presence': 8 }
  },
  {
    name: 'Jim McMahon',     short: 'McMahon',    team: 'CHI', teamName: 'Chicago Bears',
    skin: '#f0c4a0', number: 9,  starter: true, captain: false,
    attrs: { arm: 7, legs: 5, size: 5, processing: 8, vision: 8, leadership: 9, accuracy: 7, playmaking: 7, 'pocket-presence': 7 }
  },
  {
    name: 'Jay Cutler',      short: 'Cutler',     team: 'CHI', teamName: 'Chicago Bears',
    skin: '#f2c8a4', number: 6,  starter: true, captain: false,
    attrs: { arm: 9, legs: 4, size: 7, processing: 6, vision: 7, leadership: 5, accuracy: 6, playmaking: 6, 'pocket-presence': 6 }
  },
  {
    name: 'Erik Kramer',     short: 'Kramer',     team: 'CHI', teamName: 'Chicago Bears',
    skin: '#f0c4a0', number: 12, starter: true, captain: false,
    attrs: { arm: 7, legs: 2, size: 6, processing: 7, vision: 7, leadership: 6, accuracy: 7, playmaking: 5, 'pocket-presence': 7 }
  },

  // ─── CINCINNATI BENGALS ──────────────────────────────────────────────────
  {
    name: 'Ken Anderson',    short: 'Anderson',   team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#f0c4a0', number: 14, starter: true, captain: true,
    attrs: { arm: 8, legs: 2, size: 6, processing: 9, vision: 9, leadership: 8, accuracy: 9, playmaking: 7, 'pocket-presence': 8 }
  },
  {
    name: 'Boomer Esiason',  short: 'Esiason',    team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#f0c4a0', number: 7,  starter: true, captain: false,
    attrs: { arm: 9, legs: 4, size: 7, processing: 8, vision: 8, leadership: 8, accuracy: 8, playmaking: 7, 'pocket-presence': 8 }
  },
  {
    name: 'Carson Palmer',   short: 'C. Palmer',  team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#f2c8a4', number: 9,  starter: true, captain: false,
    attrs: { arm: 9, legs: 2, size: 7, processing: 8, vision: 8, leadership: 7, accuracy: 8, playmaking: 6, 'pocket-presence': 7 }
  },
  {
    name: 'Andy Dalton',     short: 'Dalton',     team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#f0c4a0', number: 14, starter: true, captain: false,
    attrs: { arm: 7, legs: 3, size: 5, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 6, 'pocket-presence': 7 }
  },

  // ─── CLEVELAND BROWNS ────────────────────────────────────────────────────
  {
    name: 'Otto Graham',     short: 'Graham',     team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#f0c4a0', number: 60, starter: true, captain: true,
    attrs: { arm: 9, legs: 7, size: 7, processing: 10, vision: 9, leadership: 10, accuracy: 9, playmaking: 9, 'pocket-presence': 9 }
  },
  {
    name: 'Brian Sipe',      short: 'Sipe',       team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#f0c4a0', number: 17, starter: true, captain: false,
    attrs: { arm: 7, legs: 3, size: 5, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 6, 'pocket-presence': 7 }
  },
  {
    name: 'Bernie Kosar',    short: 'Kosar',      team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#f0c4a0', number: 19, starter: true, captain: false,
    attrs: { arm: 7, legs: 1, size: 7, processing: 9, vision: 9, leadership: 8, accuracy: 8, playmaking: 6, 'pocket-presence': 8 }
  },
  {
    name: 'Frank Ryan',      short: 'F. Ryan',    team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#f0c4a0', number: 13, starter: true, captain: false,
    attrs: { arm: 8, legs: 3, size: 6, processing: 7, vision: 8, leadership: 7, accuracy: 8, playmaking: 6, 'pocket-presence': 7 }
  },

  // ─── DALLAS COWBOYS ──────────────────────────────────────────────────────
  {
    name: 'Roger Staubach',  short: 'Staubach',   team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#f0c4a0', number: 12, starter: true, captain: true,
    attrs: { arm: 8, legs: 7, size: 7, processing: 9, vision: 9, leadership: 10, accuracy: 9, playmaking: 9, 'pocket-presence': 9 }
  },
  {
    name: 'Troy Aikman',     short: 'Aikman',     team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#f0c4a0', number: 8,  starter: true, captain: false,
    attrs: { arm: 8, legs: 3, size: 7, processing: 9, vision: 9, leadership: 9, accuracy: 9, playmaking: 7, 'pocket-presence': 9 }
  },
  {
    name: 'Tony Romo',       short: 'Romo',       team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#f0c4a0', number: 9,  starter: true, captain: false,
    attrs: { arm: 8, legs: 5, size: 5, processing: 9, vision: 9, leadership: 7, accuracy: 9, playmaking: 8, 'pocket-presence': 9 }
  },
  {
    name: 'Don Meredith',    short: 'Meredith',   team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#f0c4a0', number: 17, starter: true, captain: false,
    attrs: { arm: 8, legs: 5, size: 7, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 7, 'pocket-presence': 7 }
  },

  // ─── DENVER BRONCOS ──────────────────────────────────────────────────────
  {
    name: 'John Elway',      short: 'Elway',      team: 'DEN', teamName: 'Denver Broncos',
    skin: '#f0c4a0', number: 7,  starter: true, captain: true,
    attrs: { arm: 10, legs: 8, size: 8, processing: 9, vision: 9, leadership: 10, accuracy: 8, playmaking: 10, 'pocket-presence': 9 }
  },
  {
    name: 'Peyton Manning',  short: 'P. Manning', team: 'DEN', teamName: 'Denver Broncos',
    skin: '#f0c4a0', number: 18, starter: true, captain: false,
    attrs: { arm: 8, legs: 1, size: 8, processing: 11, vision: 10, leadership: 10, accuracy: 10, playmaking: 8, 'pocket-presence': 10 }
  },
  {
    name: 'Craig Morton',    short: 'Morton',     team: 'DEN', teamName: 'Denver Broncos',
    skin: '#f0c4a0', number: 7,  starter: true, captain: false,
    attrs: { arm: 8, legs: 2, size: 6, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 5, 'pocket-presence': 7 }
  },
  {
    name: 'Jake Plummer',    short: 'Plummer',    team: 'DEN', teamName: 'Denver Broncos',
    skin: '#f0c4a0', number: 16, starter: true, captain: false,
    attrs: { arm: 7, legs: 6, size: 5, processing: 6, vision: 6, leadership: 6, accuracy: 6, playmaking: 7, 'pocket-presence': 6 }
  },

  // ─── DETROIT LIONS ───────────────────────────────────────────────────────
  {
    name: 'Bobby Layne',     short: 'Layne',      team: 'DET', teamName: 'Detroit Lions',
    skin: '#f0c4a0', number: 22, starter: true, captain: true,
    attrs: { arm: 8, legs: 5, size: 7, processing: 8, vision: 8, leadership: 10, accuracy: 7, playmaking: 8, 'pocket-presence': 8 }
  },
  {
    name: 'Matthew Stafford', short: 'Stafford',  team: 'DET', teamName: 'Detroit Lions',
    skin: '#f0c4a0', number: 9,  starter: true, captain: false,
    attrs: { arm: 9, legs: 2, size: 5, processing: 9, vision: 10, leadership: 8, accuracy: 9, playmaking: 7, 'pocket-presence': 8 }
  },
  {
    name: 'Scott Mitchell',  short: 'S. Mitchell', team: 'DET', teamName: 'Detroit Lions',
    skin: '#f0c4a0', number: 7,  starter: true, captain: false,
    attrs: { arm: 8, legs: 2, size: 7, processing: 5, vision: 5, leadership: 5, accuracy: 6, playmaking: 4, 'pocket-presence': 5 }
  },
  {
    name: 'Eric Hipple',     short: 'Hipple',     team: 'DET', teamName: 'Detroit Lions',
    skin: '#f0c4a0', number: 17, starter: true, captain: false,
    attrs: { arm: 7, legs: 5, size: 6, processing: 6, vision: 6, leadership: 6, accuracy: 6, playmaking: 6, 'pocket-presence': 6 }
  },

  // ─── GREEN BAY PACKERS ───────────────────────────────────────────────────
  {
    name: 'Brett Favre',     short: 'Favre',      team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#f0c4a0', number: 4,  starter: true, captain: true,
    attrs: { arm: 10, legs: 5, size: 7, processing: 7, vision: 8, leadership: 9, accuracy: 8, playmaking: 9, 'pocket-presence': 8 }
  },
  {
    name: 'Aaron Rodgers',   short: 'A. Rodgers', team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#f0c4a0', number: 12, starter: true, captain: false,
    attrs: { arm: 9, legs: 6, size: 6, processing: 10, vision: 10, leadership: 8, accuracy: 10, playmaking: 9, 'pocket-presence': 10 }
  },
  {
    name: 'Bart Starr',      short: 'Starr',      team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#f0c4a0', number: 15, starter: true, captain: false,
    attrs: { arm: 7, legs: 3, size: 6, processing: 10, vision: 9, leadership: 10, accuracy: 9, playmaking: 7, 'pocket-presence': 9 }
  },
  {
    name: 'Don Majkowski',   short: 'Majkowski',  team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#f0c4a0', number: 7,  starter: true, captain: false,
    attrs: { arm: 8, legs: 5, size: 6, processing: 6, vision: 6, leadership: 6, accuracy: 6, playmaking: 7, 'pocket-presence': 6 }
  },

  // ─── HOUSTON TEXANS ──────────────────────────────────────────────────────
  {
    name: 'Matt Schaub',     short: 'Schaub',     team: 'HOU', teamName: 'Houston Texans',
    skin: '#f0c4a0', number: 8,  starter: true, captain: true,
    attrs: { arm: 8, legs: 2, size: 7, processing: 8, vision: 8, leadership: 7, accuracy: 8, playmaking: 5, 'pocket-presence': 8 }
  },
  {
    name: 'Deshaun Watson',  short: 'D. Watson',  team: 'HOU', teamName: 'Houston Texans',
    skin: '#7a5030', number: 4,  starter: true, captain: false,
    attrs: { arm: 8, legs: 9, size: 6, processing: 8, vision: 8, leadership: 8, accuracy: 7, playmaking: 9, 'pocket-presence': 7 }
  },
  {
    name: 'David Carr',      short: 'D. Carr',    team: 'HOU', teamName: 'Houston Texans',
    skin: '#f0c4a0', number: 8,  starter: true, captain: false,
    attrs: { arm: 7, legs: 4, size: 7, processing: 6, vision: 5, leadership: 5, accuracy: 6, playmaking: 5, 'pocket-presence': 4 }
  },
  {
    name: 'Ryan Fitzpatrick', short: 'Fitzpatrick', team: 'HOU', teamName: 'Houston Texans',
    skin: '#f0c4a0', number: 14, starter: true, captain: false,
    attrs: { arm: 7, legs: 5, size: 6, processing: 7, vision: 6, leadership: 7, accuracy: 6, playmaking: 7, 'pocket-presence': 6 }
  },

  // ─── INDIANAPOLIS COLTS ──────────────────────────────────────────────────
  {
    name: 'Peyton Manning',  short: 'P. Manning', team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#f0c4a0', number: 18, starter: true, captain: true,
    attrs: { arm: 8, legs: 1, size: 8, processing: 11, vision: 10, leadership: 10, accuracy: 10, playmaking: 8, 'pocket-presence': 10 }
  },
  {
    name: 'Johnny Unitas',   short: 'Unitas',     team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#f0c4a0', number: 19, starter: true, captain: false,
    attrs: { arm: 9, legs: 2, size: 7, processing: 10, vision: 10, leadership: 10, accuracy: 9, playmaking: 8, 'pocket-presence': 9 }
  },
  {
    name: 'Andrew Luck',     short: 'Luck',       team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#f2c8a4', number: 12, starter: true, captain: false,
    attrs: { arm: 9, legs: 6, size: 9, processing: 9, vision: 9, leadership: 9, accuracy: 8, playmaking: 8, 'pocket-presence': 8 }
  },
  {
    name: 'Bert Jones',      short: 'B. Jones',   team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#f0c4a0', number: 7,  starter: true, captain: false,
    attrs: { arm: 9, legs: 5, size: 7, processing: 8, vision: 8, leadership: 8, accuracy: 8, playmaking: 7, 'pocket-presence': 8 }
  },

  // ─── JACKSONVILLE JAGUARS ────────────────────────────────────────────────
  {
    name: 'Mark Brunell',    short: 'Brunell',    team: 'JAX', teamName: 'Jacksonville Jaguars',
    skin: '#f0c4a0', number: 8,  starter: true, captain: true,
    attrs: { arm: 8, legs: 8, size: 6, processing: 8, vision: 8, leadership: 8, accuracy: 8, playmaking: 8, 'pocket-presence': 7 }
  },
  {
    name: 'Byron Leftwich',  short: 'Leftwich',   team: 'JAX', teamName: 'Jacksonville Jaguars',
    skin: '#7a5030', number: 7,  starter: true, captain: false,
    attrs: { arm: 8, legs: 1, size: 8, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 5, 'pocket-presence': 6 }
  },
  {
    name: 'David Garrard',   short: 'Garrard',    team: 'JAX', teamName: 'Jacksonville Jaguars',
    skin: '#7a5030', number: 9,  starter: true, captain: false,
    attrs: { arm: 7, legs: 6, size: 6, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 7, 'pocket-presence': 6 }
  },
  {
    name: 'Blake Bortles',   short: 'Bortles',    team: 'JAX', teamName: 'Jacksonville Jaguars',
    skin: '#f0c4a0', number: 5,  starter: true, captain: false,
    attrs: { arm: 8, legs: 6, size: 8, processing: 5, vision: 5, leadership: 5, accuracy: 5, playmaking: 6, 'pocket-presence': 5 }
  },

  // ─── KANSAS CITY CHIEFS ──────────────────────────────────────────────────
  {
    name: 'Patrick Mahomes', short: 'Mahomes',    team: 'KC',  teamName: 'Kansas City Chiefs',
    skin: '#d4a070', number: 15, starter: true, captain: true,
    attrs: { arm: 10, legs: 8, size: 7, processing: 10, vision: 10, leadership: 10, accuracy: 9, playmaking: 11, 'pocket-presence': 9 }
  },
  {
    name: 'Len Dawson',      short: 'Dawson',     team: 'KC',  teamName: 'Kansas City Chiefs',
    skin: '#f0c4a0', number: 16, starter: true, captain: false,
    attrs: { arm: 8, legs: 3, size: 6, processing: 9, vision: 9, leadership: 9, accuracy: 9, playmaking: 7, 'pocket-presence': 9 }
  },
  {
    name: 'Joe Montana',     short: 'Montana',    team: 'KC',  teamName: 'Kansas City Chiefs',
    skin: '#f0c4a0', number: 19, starter: true, captain: false,
    attrs: { arm: 7, legs: 4, size: 6, processing: 11, vision: 10, leadership: 11, accuracy: 10, playmaking: 8, 'pocket-presence': 10 }
  },
  {
    name: 'Trent Green',     short: 'T. Green',   team: 'KC',  teamName: 'Kansas City Chiefs',
    skin: '#f0c4a0', number: 10, starter: true, captain: false,
    attrs: { arm: 7, legs: 2, size: 6, processing: 8, vision: 8, leadership: 7, accuracy: 7, playmaking: 5, 'pocket-presence': 7 }
  },

  // ─── LAS VEGAS RAIDERS ───────────────────────────────────────────────────
  {
    name: 'Ken Stabler',     short: 'Stabler',    team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#f0c4a0', number: 12, starter: true, captain: true,
    attrs: { arm: 8, legs: 3, size: 6, processing: 9, vision: 9, leadership: 9, accuracy: 9, playmaking: 8, 'pocket-presence': 9 }
  },
  {
    name: 'Jim Plunkett',    short: 'Plunkett',   team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#d4a070', number: 16, starter: true, captain: false,
    attrs: { arm: 8, legs: 4, size: 7, processing: 7, vision: 7, leadership: 8, accuracy: 7, playmaking: 6, 'pocket-presence': 7 }
  },
  {
    name: 'Daryle Lamonica', short: 'Lamonica',   team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#f0c4a0', number: 3,  starter: true, captain: false,
    attrs: { arm: 9, legs: 3, size: 7, processing: 6, vision: 7, leadership: 7, accuracy: 7, playmaking: 7, 'pocket-presence': 7 }
  },
  {
    name: 'Rich Gannon',     short: 'Gannon',     team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#f0c4a0', number: 12, starter: true, captain: false,
    attrs: { arm: 7, legs: 6, size: 6, processing: 9, vision: 8, leadership: 8, accuracy: 8, playmaking: 7, 'pocket-presence': 8 }
  },

  // ─── LOS ANGELES CHARGERS ────────────────────────────────────────────────
  {
    name: 'Dan Fouts',       short: 'Fouts',      team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#f0c4a0', number: 14, starter: true, captain: true,
    attrs: { arm: 9, legs: 2, size: 7, processing: 9, vision: 9, leadership: 8, accuracy: 9, playmaking: 7, 'pocket-presence': 8 }
  },
  {
    name: 'Philip Rivers',   short: 'Rivers',     team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#f2c8a4', number: 17, starter: true, captain: false,
    attrs: { arm: 8, legs: 2, size: 7, processing: 9, vision: 9, leadership: 9, accuracy: 9, playmaking: 7, 'pocket-presence': 9 }
  },
  {
    name: 'John Hadl',       short: 'Hadl',       team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#f0c4a0', number: 21, starter: true, captain: false,
    attrs: { arm: 8, legs: 4, size: 6, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 7, 'pocket-presence': 7 }
  },
  {
    name: 'Stan Humphries',  short: 'Humphries',  team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#f0c4a0', number: 12, starter: true, captain: false,
    attrs: { arm: 7, legs: 4, size: 6, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 6, 'pocket-presence': 6 }
  },

  // ─── LOS ANGELES RAMS ────────────────────────────────────────────────────
  {
    name: 'Kurt Warner',     short: 'Warner',     team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#f2c8a4', number: 13, starter: true, captain: true,
    attrs: { arm: 8, legs: 2, size: 6, processing: 10, vision: 10, leadership: 9, accuracy: 9, playmaking: 8, 'pocket-presence': 9 }
  },
  {
    name: 'Roman Gabriel',   short: 'Gabriel',    team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#d4a070', number: 18, starter: true, captain: false,
    attrs: { arm: 8, legs: 4, size: 8, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 6, 'pocket-presence': 7 }
  },
  {
    name: 'Vince Ferragamo', short: 'Ferragamo',  team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#f0c4a0', number: 15, starter: true, captain: false,
    attrs: { arm: 8, legs: 3, size: 6, processing: 6, vision: 6, leadership: 6, accuracy: 6, playmaking: 5, 'pocket-presence': 6 }
  },
  {
    name: 'Marc Bulger',     short: 'Bulger',     team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#f0c4a0', number: 10, starter: true, captain: false,
    attrs: { arm: 8, legs: 1, size: 6, processing: 8, vision: 8, leadership: 7, accuracy: 9, playmaking: 6, 'pocket-presence': 8 }
  },

  // ─── MIAMI DOLPHINS ──────────────────────────────────────────────────────
  {
    name: 'Dan Marino',      short: 'Marino',     team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#f0c4a0', number: 13, starter: true, captain: true,
    attrs: { arm: 11, legs: 2, size: 8, processing: 9, vision: 9, leadership: 8, accuracy: 9, playmaking: 8, 'pocket-presence': 9 }
  },
  {
    name: 'Bob Griese',      short: 'B. Griese',  team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#f0c4a0', number: 12, starter: true, captain: false,
    attrs: { arm: 7, legs: 3, size: 6, processing: 9, vision: 9, leadership: 9, accuracy: 8, playmaking: 7, 'pocket-presence': 8 }
  },
  {
    name: 'Jay Fiedler',     short: 'Fiedler',    team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#f0c4a0', number: 11, starter: true, captain: false,
    attrs: { arm: 6, legs: 5, size: 5, processing: 6, vision: 5, leadership: 6, accuracy: 6, playmaking: 5, 'pocket-presence': 5 }
  },
  {
    name: 'Chad Pennington', short: 'Pennington', team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#f0c4a0', number: 10, starter: true, captain: false,
    attrs: { arm: 5, legs: 3, size: 5, processing: 9, vision: 8, leadership: 8, accuracy: 9, playmaking: 5, 'pocket-presence': 8 }
  },

  // ─── MINNESOTA VIKINGS ───────────────────────────────────────────────────
  {
    name: 'Fran Tarkenton',  short: 'Tarkenton',  team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#f0c4a0', number: 10, starter: true, captain: true,
    attrs: { arm: 7, legs: 9, size: 5, processing: 9, vision: 9, leadership: 9, accuracy: 8, playmaking: 10, 'pocket-presence': 7 }
  },
  {
    name: 'Daunte Culpepper', short: 'Culpepper',  team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#5e3c22', number: 11, starter: true, captain: false,
    attrs: { arm: 9, legs: 8, size: 8, processing: 7, vision: 8, leadership: 7, accuracy: 7, playmaking: 9, 'pocket-presence': 7 }
  },
  {
    name: 'Tommy Kramer',    short: 'Kramer',     team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#f0c4a0', number: 9,  starter: true, captain: false,
    attrs: { arm: 8, legs: 3, size: 6, processing: 7, vision: 7, leadership: 6, accuracy: 7, playmaking: 6, 'pocket-presence': 7 }
  },
  {
    name: 'Randall Cunningham', short: 'Cunningham', team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#7a5030', number: 7,  starter: true, captain: false,
    attrs: { arm: 9, legs: 11, size: 7, processing: 6, vision: 7, leadership: 7, accuracy: 7, playmaking: 10, 'pocket-presence': 6 }
  },

  // ─── NEW ENGLAND PATRIOTS ────────────────────────────────────────────────
  {
    name: 'Tom Brady',       short: 'Brady',      team: 'NE',  teamName: 'New England Patriots',
    skin: '#f2c8a4', number: 12, starter: true, captain: true,
    attrs: { arm: 7, legs: 2, size: 7, processing: 11, vision: 10, leadership: 11, accuracy: 10, playmaking: 8, 'pocket-presence': 10 }
  },
  {
    name: 'Drew Bledsoe',    short: 'Bledsoe',    team: 'NE',  teamName: 'New England Patriots',
    skin: '#f0c4a0', number: 11, starter: true, captain: false,
    attrs: { arm: 9, legs: 1, size: 8, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 5, 'pocket-presence': 6 }
  },
  {
    name: 'Steve Grogan',    short: 'Grogan',     team: 'NE',  teamName: 'New England Patriots',
    skin: '#f0c4a0', number: 14, starter: true, captain: false,
    attrs: { arm: 8, legs: 6, size: 7, processing: 7, vision: 7, leadership: 7, accuracy: 6, playmaking: 7, 'pocket-presence': 7 }
  },
  {
    name: 'Vito "Babe" Parilli', short: 'Parilli', team: 'NE', teamName: 'New England Patriots',
    skin: '#f0c4a0', number: 15, starter: true, captain: false,
    attrs: { arm: 8, legs: 4, size: 6, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 6, 'pocket-presence': 7 }
  },

  // ─── NEW ORLEANS SAINTS ──────────────────────────────────────────────────
  {
    name: 'Drew Brees',      short: 'Brees',      team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#f2c8a4', number: 9,  starter: true, captain: true,
    attrs: { arm: 7, legs: 2, size: 4, processing: 10, vision: 10, leadership: 10, accuracy: 10, playmaking: 8, 'pocket-presence': 10 }
  },
  {
    name: 'Archie Manning',  short: 'A. Manning', team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#f0c4a0', number: 8,  starter: true, captain: false,
    attrs: { arm: 8, legs: 7, size: 7, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 8, 'pocket-presence': 6 }
  },
  {
    name: 'Bobby Hebert',    short: 'Hebert',     team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#f0c4a0', number: 11, starter: true, captain: false,
    attrs: { arm: 7, legs: 2, size: 6, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 5, 'pocket-presence': 7 }
  },
  {
    name: 'Aaron Brooks',    short: 'Brooks',     team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#7a5030', number: 2,  starter: true, captain: false,
    attrs: { arm: 8, legs: 7, size: 6, processing: 5, vision: 6, leadership: 5, accuracy: 6, playmaking: 7, 'pocket-presence': 5 }
  },

  // ─── NEW YORK GIANTS ─────────────────────────────────────────────────────
  {
    name: 'Eli Manning',     short: 'E. Manning', team: 'NYG', teamName: 'New York Giants',
    skin: '#f2c8a4', number: 10, starter: true, captain: true,
    attrs: { arm: 8, legs: 2, size: 7, processing: 8, vision: 8, leadership: 8, accuracy: 8, playmaking: 8, 'pocket-presence': 8 }
  },
  {
    name: 'Phil Simms',      short: 'Simms',      team: 'NYG', teamName: 'New York Giants',
    skin: '#f0c4a0', number: 11, starter: true, captain: false,
    attrs: { arm: 8, legs: 3, size: 6, processing: 8, vision: 8, leadership: 8, accuracy: 8, playmaking: 6, 'pocket-presence': 8 }
  },
  {
    name: 'Y.A. Tittle',     short: 'Tittle',     team: 'NYG', teamName: 'New York Giants',
    skin: '#f0c4a0', number: 14, starter: true, captain: false,
    attrs: { arm: 8, legs: 2, size: 6, processing: 9, vision: 9, leadership: 9, accuracy: 9, playmaking: 7, 'pocket-presence': 8 }
  },
  {
    name: 'Charlie Conerly', short: 'Conerly',    team: 'NYG', teamName: 'New York Giants',
    skin: '#f0c4a0', number: 42, starter: true, captain: false,
    attrs: { arm: 7, legs: 2, size: 6, processing: 8, vision: 8, leadership: 8, accuracy: 7, playmaking: 6, 'pocket-presence': 7 }
  },

  // ─── NEW YORK JETS ───────────────────────────────────────────────────────
  {
    name: 'Joe Namath',      short: 'Namath',     team: 'NYJ', teamName: 'New York Jets',
    skin: '#f0c4a0', number: 12, starter: true, captain: true,
    attrs: { arm: 9, legs: 2, size: 7, processing: 8, vision: 9, leadership: 9, accuracy: 8, playmaking: 7, 'pocket-presence': 8 }
  },
  {
    name: 'Ken O\'Brien',    short: "O'Brien",    team: 'NYJ', teamName: 'New York Jets',
    skin: '#f0c4a0', number: 7,  starter: true, captain: false,
    attrs: { arm: 7, legs: 2, size: 6, processing: 7, vision: 7, leadership: 6, accuracy: 8, playmaking: 5, 'pocket-presence': 7 }
  },
  {
    name: 'Vinny Testaverde', short: 'Testaverde', team: 'NYJ', teamName: 'New York Jets',
    skin: '#f0c4a0', number: 16, starter: true, captain: false,
    attrs: { arm: 8, legs: 2, size: 7, processing: 6, vision: 6, leadership: 6, accuracy: 6, playmaking: 5, 'pocket-presence': 6 }
  },
  {
    name: 'Chad Pennington', short: 'Pennington', team: 'NYJ', teamName: 'New York Jets',
    skin: '#f0c4a0', number: 10, starter: true, captain: false,
    attrs: { arm: 5, legs: 3, size: 5, processing: 9, vision: 8, leadership: 8, accuracy: 9, playmaking: 5, 'pocket-presence': 8 }
  },

  // ─── PHILADELPHIA EAGLES ─────────────────────────────────────────────────
  {
    name: 'Randall Cunningham', short: 'Cunningham', team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#7a5030', number: 12, starter: true, captain: true,
    attrs: { arm: 9, legs: 11, size: 7, processing: 6, vision: 7, leadership: 7, accuracy: 7, playmaking: 10, 'pocket-presence': 6 }
  },
  {
    name: 'Donovan McNabb',  short: 'McNabb',     team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#7a5030', number: 5,  starter: true, captain: false,
    attrs: { arm: 8, legs: 8, size: 7, processing: 8, vision: 8, leadership: 8, accuracy: 7, playmaking: 9, 'pocket-presence': 7 }
  },
  {
    name: 'Ron Jaworski',    short: 'Jaworski',   team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#f0c4a0', number: 7,  starter: true, captain: false,
    attrs: { arm: 8, legs: 3, size: 6, processing: 7, vision: 7, leadership: 8, accuracy: 7, playmaking: 6, 'pocket-presence': 7 }
  },
  {
    name: 'Norm Van Brocklin', short: 'Van Brocklin', team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#f0c4a0', number: 11, starter: true, captain: false,
    attrs: { arm: 9, legs: 2, size: 6, processing: 8, vision: 8, leadership: 8, accuracy: 8, playmaking: 6, 'pocket-presence': 8 }
  },

  // ─── PITTSBURGH STEELERS ─────────────────────────────────────────────────
  {
    name: 'Terry Bradshaw',  short: 'Bradshaw',   team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#f0c4a0', number: 12, starter: true, captain: true,
    attrs: { arm: 10, legs: 6, size: 8, processing: 7, vision: 7, leadership: 10, accuracy: 7, playmaking: 8, 'pocket-presence': 7 }
  },
  {
    name: 'Ben Roethlisberger', short: 'Big Ben',  team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#f0c4a0', number: 7,  starter: true, captain: false,
    attrs: { arm: 9, legs: 5, size: 10, processing: 8, vision: 8, leadership: 8, accuracy: 8, playmaking: 9, 'pocket-presence': 9 }
  },
  {
    name: 'Kordell Stewart',  short: 'K. Stewart', team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#7a5030', number: 10, starter: true, captain: false,
    attrs: { arm: 8, legs: 9, size: 7, processing: 5, vision: 5, leadership: 6, accuracy: 5, playmaking: 8, 'pocket-presence': 5 }
  },
  {
    name: 'Neil O\'Donnell', short: "O'Donnell",  team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#f0c4a0', number: 14, starter: true, captain: false,
    attrs: { arm: 7, legs: 2, size: 6, processing: 7, vision: 7, leadership: 6, accuracy: 7, playmaking: 5, 'pocket-presence': 7 }
  },

  // ─── SAN FRANCISCO 49ERS ─────────────────────────────────────────────────
  {
    name: 'Joe Montana',     short: 'Montana',    team: 'SF',  teamName: 'San Francisco 49ers',
    skin: '#f0c4a0', number: 16, starter: true, captain: true,
    attrs: { arm: 7, legs: 4, size: 6, processing: 11, vision: 10, leadership: 11, accuracy: 10, playmaking: 8, 'pocket-presence': 10 }
  },
  {
    name: 'Steve Young',     short: 'S. Young',   team: 'SF',  teamName: 'San Francisco 49ers',
    skin: '#f0c4a0', number: 8,  starter: true, captain: false,
    attrs: { arm: 8, legs: 10, size: 7, processing: 9, vision: 9, leadership: 9, accuracy: 9, playmaking: 10, 'pocket-presence': 8 }
  },
  {
    name: 'John Brodie',     short: 'Brodie',     team: 'SF',  teamName: 'San Francisco 49ers',
    skin: '#f0c4a0', number: 12, starter: true, captain: false,
    attrs: { arm: 8, legs: 3, size: 6, processing: 8, vision: 8, leadership: 7, accuracy: 8, playmaking: 6, 'pocket-presence': 8 }
  },
  {
    name: 'Jeff Garcia',     short: 'Garcia',     team: 'SF',  teamName: 'San Francisco 49ers',
    skin: '#f0c4a0', number: 5,  starter: true, captain: false,
    attrs: { arm: 7, legs: 7, size: 4, processing: 8, vision: 8, leadership: 7, accuracy: 8, playmaking: 7, 'pocket-presence': 7 }
  },

  // ─── SEATTLE SEAHAWKS ────────────────────────────────────────────────────
  {
    name: 'Russell Wilson',  short: 'R. Wilson',  team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#7a5030', number: 3,  starter: true, captain: true,
    attrs: { arm: 8, legs: 9, size: 4, processing: 9, vision: 9, leadership: 9, accuracy: 8, playmaking: 10, 'pocket-presence': 8 }
  },
  {
    name: 'Matt Hasselbeck',  short: 'Hasselbeck', team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#f0c4a0', number: 8,  starter: true, captain: false,
    attrs: { arm: 7, legs: 4, size: 6, processing: 8, vision: 8, leadership: 8, accuracy: 8, playmaking: 6, 'pocket-presence': 8 }
  },
  {
    name: 'Dave Krieg',      short: 'Krieg',      team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#f0c4a0', number: 17, starter: true, captain: false,
    attrs: { arm: 8, legs: 4, size: 5, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 7, 'pocket-presence': 7 }
  },
  {
    name: 'Jim Zorn',        short: 'Zorn',       team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#f0c4a0', number: 10, starter: true, captain: false,
    attrs: { arm: 7, legs: 7, size: 5, processing: 6, vision: 6, leadership: 6, accuracy: 6, playmaking: 7, 'pocket-presence': 6 }
  },

  // ─── TAMPA BAY BUCCANEERS ────────────────────────────────────────────────
  {
    name: 'Tom Brady',       short: 'Brady',      team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#f2c8a4', number: 12, starter: true, captain: true,
    attrs: { arm: 7, legs: 2, size: 7, processing: 11, vision: 10, leadership: 11, accuracy: 10, playmaking: 8, 'pocket-presence': 10 }
  },
  {
    name: 'Doug Williams',   short: 'D. Williams', team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#7a5030', number: 17, starter: true, captain: false,
    attrs: { arm: 9, legs: 5, size: 7, processing: 7, vision: 7, leadership: 8, accuracy: 7, playmaking: 7, 'pocket-presence': 7 }
  },
  {
    name: 'Brad Johnson',    short: 'B. Johnson', team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#f0c4a0', number: 14, starter: true, captain: false,
    attrs: { arm: 6, legs: 3, size: 6, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 5, 'pocket-presence': 7 }
  },
  {
    name: 'Jameis Winston',  short: 'Winston',    team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#7a5030', number: 3,  starter: true, captain: false,
    attrs: { arm: 9, legs: 5, size: 7, processing: 6, vision: 6, leadership: 7, accuracy: 6, playmaking: 7, 'pocket-presence': 6 }
  },

  // ─── TENNESSEE TITANS ────────────────────────────────────────────────────
  {
    name: 'Steve McNair',    short: 'McNair',     team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#7a5030', number: 9,  starter: true, captain: true,
    attrs: { arm: 8, legs: 8, size: 8, processing: 8, vision: 7, leadership: 9, accuracy: 7, playmaking: 9, 'pocket-presence': 7 }
  },
  {
    name: 'Warren Moon',     short: 'Moon',       team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#7a5030', number: 1,  starter: true, captain: false,
    attrs: { arm: 9, legs: 5, size: 7, processing: 8, vision: 9, leadership: 8, accuracy: 8, playmaking: 8, 'pocket-presence': 8 }
  },
  {
    name: 'George Blanda',   short: 'Blanda',     team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#f0c4a0', number: 16, starter: true, captain: false,
    attrs: { arm: 7, legs: 3, size: 6, processing: 7, vision: 7, leadership: 8, accuracy: 6, playmaking: 5, 'pocket-presence': 6 }
  },
  {
    name: 'Vince Young',     short: 'V. Young',   team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#5e3c22', number: 10, starter: true, captain: false,
    attrs: { arm: 8, legs: 9, size: 8, processing: 5, vision: 5, leadership: 7, accuracy: 5, playmaking: 8, 'pocket-presence': 5 }
  },

  // ─── WASHINGTON COMMANDERS ───────────────────────────────────────────────
  {
    name: 'Sammy Baugh',     short: 'Baugh',      team: 'WAS', teamName: 'Washington Commanders',
    skin: '#f0c4a0', number: 33, starter: true, captain: true,
    attrs: { arm: 9, legs: 4, size: 6, processing: 9, vision: 9, leadership: 9, accuracy: 9, playmaking: 8, 'pocket-presence': 9 }
  },
  {
    name: 'Sonny Jurgensen', short: 'Jurgensen',  team: 'WAS', teamName: 'Washington Commanders',
    skin: '#f0c4a0', number: 9,  starter: true, captain: false,
    attrs: { arm: 10, legs: 2, size: 5, processing: 8, vision: 9, leadership: 7, accuracy: 9, playmaking: 7, 'pocket-presence': 8 }
  },
  {
    name: 'Joe Theismann',   short: 'Theismann',  team: 'WAS', teamName: 'Washington Commanders',
    skin: '#f0c4a0', number: 7,  starter: true, captain: false,
    attrs: { arm: 7, legs: 5, size: 5, processing: 8, vision: 7, leadership: 8, accuracy: 7, playmaking: 7, 'pocket-presence': 7 }
  },
  {
    name: 'Mark Rypien',     short: 'Rypien',     team: 'WAS', teamName: 'Washington Commanders',
    skin: '#f0c4a0', number: 11, starter: true, captain: false,
    attrs: { arm: 8, legs: 2, size: 7, processing: 7, vision: 7, leadership: 7, accuracy: 7, playmaking: 5, 'pocket-presence': 7 }
  },
]

const _colorMap = Object.fromEntries(TEAMS.map(t => [t.short, { color: t.color, color2: t.color2 }]))

export const LEGENDS = _raw.map(qb => ({
  ...qb,
  ..._colorMap[qb.team],
  attrs: Object.fromEntries(
    Object.entries(qb.attrs).map(([k, v]) => [k, Math.min(11, v + 1)])
  ),
}))

export const LEGEND_TYPES = ['arm', 'legs', 'size', 'processing', 'leadership', 'vision', 'playmaking', 'accuracy', 'pocket-presence']
