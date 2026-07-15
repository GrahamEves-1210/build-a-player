// Legendary / retired RBs — 3–5 per franchise
// Attrs: speed, burst, strength, size, balance, elusiveness, vision, hands, carrying (scale 1–11)
// Calibrated: Jim Brown (strength=11), Barry Sanders (elusiveness=11, vision=11), LaDainian Tomlinson (hands=9)
// Skin tones: #f0c4a0 white Â· #b07848 medium mixed Â· #7a5030 medium brown Â· #5e3c22 dark brown Â· #3a2010 very dark

import { TEAMS } from './qbs'

const TEAM_COLOR = Object.fromEntries(TEAMS.map(t => [t.short, { color: t.color, color2: t.color2 }]))

const _raw = [

  // ─── ARIZONA CARDINALS ───────────────────────────────────────────────────
  {
    name: 'David Johnson',   short: 'D. Johnson',  team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#7a5030', number: 31, starter: true, captain: true, years: '2015–20',
    attrs: { speed: 9, burst: 9, strength: 8, size: 8, balance: 8, elusiveness: 8, vision: 8, hands: 10, carrying: 8 }
  },
  {
    name: 'Larry Centers',  short: 'Centers',     team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#5e3c22', number: 33, starter: true, captain: true, years: '1990–98',
    attrs: { speed: 7, burst: 7, strength: 6, size: 6, balance: 8, elusiveness: 7, vision: 8, hands: 10, carrying: 7 }
  },
  {
    name: 'Ottis Anderson', short: 'O. Anderson', team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#5e3c22', number: 24, starter: true, captain: true, years: '1979–86',
    attrs: { speed: 7, burst: 7, strength: 9, size: 8, balance: 8, elusiveness: 6, vision: 8, hands: 7, carrying: 8 }
  },

  // ─── ATLANTA FALCONS ─────────────────────────────────────────────────────
  {
    name: 'Michael Turner',  short: 'M. Turner',   team: 'ATL', teamName: 'Atlanta Falcons',
    skin: '#5e3c22', number: 33, starter: true, captain: true, years: '2008–12',
    attrs: { speed: 7, burst: 7, strength: 10, size: 8, balance: 8, elusiveness: 5, vision: 7, hands: 6, carrying: 8 }
  },
  {
    name: 'Devonta Freeman',  short: 'Freeman',    team: 'ATL', teamName: 'Atlanta Falcons',
    skin: '#5e3c22', number: 24, starter: true, captain: true, years: '2014–19',
    attrs: { speed: 8, burst: 9, strength: 7, size: 4, balance: 8, elusiveness: 8, vision: 8, hands: 8, carrying: 8 }
  },
  {
    name: 'Gerald Riggs',    short: 'Riggs',       team: 'ATL', teamName: 'Atlanta Falcons',
    skin: '#5e3c22', number: 42, starter: true, captain: true, years: '1982–88',
    attrs: { speed: 7, burst: 7, strength: 9, size: 8, balance: 8, elusiveness: 5, vision: 7, hands: 6, carrying: 8 }
  },

  // ─── BALTIMORE RAVENS ────────────────────────────────────────────────────
  {
    name: 'Jamal Lewis',     short: 'J. Lewis',    team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#5e3c22', number: 31, starter: true, captain: true, years: '2000–06',
    attrs: { speed: 7, burst: 8, strength: 10, size: 10, balance: 8, elusiveness: 5, vision: 7, hands: 5, carrying: 8 }
  },
  {
    name: 'Ray Rice',        short: 'R. Rice',     team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#5e3c22', number: 27, starter: true, captain: true, years: '2008–13',
    attrs: { speed: 8, burst: 9, strength: 7, size: 4, balance: 9, elusiveness: 9, vision: 8, hands: 9, carrying: 7 }
  },
  {
    name: 'Willis McGahee',  short: 'McGahee',     team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#5e3c22', number: 23, starter: true, captain: true, years: '2007–11',
    attrs: { speed: 7, burst: 7, strength: 9, size: 7, balance: 7, elusiveness: 5, vision: 7, hands: 5, carrying: 7 }
  },
  {
    name: 'Derrick Henry',   short: 'D. Henry',    team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#3a2010', number: 22, starter: true, captain: true, years: '2024–',
    attrs: { speed: 8, burst: 6, strength: 11, size: 11, balance: 9, elusiveness: 3, vision: 8, hands: 4, carrying: 9 }
  },

  // ─── BUFFALO BILLS ───────────────────────────────────────────────────────
  {
    name: 'O.J. Simpson',    short: 'Simpson',     team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#7a5030', number: 32, starter: true, captain: true, years: '1969–77',
    attrs: { speed: 10, burst: 9, strength: 7, size: 6, balance: 8, elusiveness: 9, vision: 9, hands: 7, carrying: 8 }
  },
  {
    name: 'Thurman Thomas',  short: 'T. Thomas',   team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#7a5030', number: 34, starter: true, captain: true, years: '1988–99',
    attrs: { speed: 8, burst: 8, strength: 6, size: 3, balance: 8, elusiveness: 8, vision: 10, hands: 9, carrying: 9 }
  },
  {
    name: 'Fred Jackson',    short: 'F. Jackson',  team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#5e3c22', number: 22, starter: true, captain: true, years: '2007–14',
    attrs: { speed: 7, burst: 7, strength: 8, size: 6, balance: 8, elusiveness: 6, vision: 8, hands: 7, carrying: 8 }
  },

  // ─── CAROLINA PANTHERS ───────────────────────────────────────────────────
  {
    name: 'DeAngelo Williams', short: 'D. Williams', team: 'CAR', teamName: 'Carolina Panthers',
    skin: '#7a5030', number: 34, starter: true, captain: true, years: '2006–14',
    attrs: { speed: 9, burst: 9, strength: 6, size: 4, balance: 7, elusiveness: 8, vision: 8, hands: 7, carrying: 7 }
  },
  {
    name: 'Jonathan Stewart', short: 'J. Stewart',  team: 'CAR', teamName: 'Carolina Panthers',
    skin: '#5e3c22', number: 28, starter: true, captain: true, years: '2008–17',
    attrs: { speed: 8, burst: 8, strength: 9, size: 8, balance: 8, elusiveness: 6, vision: 7, hands: 6, carrying: 8 }
  },
  {
    name: 'Christian McCaffrey', short: 'McCaffrey', team: 'CAR', teamName: 'Carolina Panthers',
    skin: '#f0c4a0', number: 23, starter: true, captain: true, years: '2017–22',
    attrs: { speed: 9, burst: 9, strength: 7, size: 5, balance: 9, elusiveness: 10, vision: 9, hands: 11, carrying: 8 }
  },

  // ─── CHICAGO BEARS ───────────────────────────────────────────────────────
  {
    name: 'Walter Payton',   short: 'Payton',      team: 'CHI', teamName: 'Chicago Bears',
    skin: '#5e3c22', number: 34, starter: true, captain: true, years: '1975–87',
    attrs: { speed: 9, burst: 9, strength: 9, size: 4, balance: 11, elusiveness: 9, vision: 10, hands: 9, carrying: 9 }
  },
  {
    name: 'Gale Sayers',     short: 'Sayers',      team: 'CHI', teamName: 'Chicago Bears',
    skin: '#5e3c22', number: 40, starter: true, captain: true, years: '1965–71',
    attrs: { speed: 10, burst: 11, strength: 6, size: 4, balance: 8, elusiveness: 11, vision: 9, hands: 8, carrying: 6 }
  },
  {
    name: 'Neal Anderson',   short: 'N. Anderson', team: 'CHI', teamName: 'Chicago Bears',
    skin: '#5e3c22', number: 35, starter: true, captain: true, years: '1986–93',
    attrs: { speed: 8, burst: 8, strength: 5, size: 5, balance: 7, elusiveness: 8, vision: 7, hands: 8, carrying: 7 }
  },
  {
    name: 'Matt Forte',      short: 'Forte',       team: 'CHI', teamName: 'Chicago Bears',
    skin: '#5e3c22', number: 22, starter: true, captain: true, years: '2008–15',
    attrs: { speed: 8, burst: 8, strength: 7, size: 7, balance: 8, elusiveness: 7, vision: 8, hands: 9, carrying: 8 }
  },

  // ─── CINCINNATI BENGALS ──────────────────────────────────────────────────
  {
    name: 'James Brooks',    short: 'J. Brooks',   team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#5e3c22', number: 21, starter: true, captain: true, years: '1984–91',
    attrs: { speed: 9, burst: 9, strength: 5, size: 1, balance: 8, elusiveness: 9, vision: 8, hands: 9, carrying: 7 }
  },
  {
    name: 'Corey Dillon',    short: 'C. Dillon',   team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#5e3c22', number: 28, starter: true, captain: true, years: '1997–03',
    attrs: { speed: 8, burst: 8, strength: 9, size: 7, balance: 8, elusiveness: 6, vision: 8, hands: 6, carrying: 8 }
  },
  {
    name: 'Joe Mixon',       short: 'Mixon',       team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#5e3c22', number: 28, starter: true, captain: true, years: '2017–23',
    attrs: { speed: 8, burst: 8, strength: 9, size: 7, balance: 9, elusiveness: 7, vision: 9, hands: 7, carrying: 8 }
  },
  {
    name: 'Pete Johnson',    short: 'P. Johnson',  team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#5e3c22', number: 46, starter: true, captain: true, years: '1977–83',
    attrs: { speed: 5, burst: 5, strength: 10, size: 10, balance: 8, elusiveness: 3, vision: 6, hands: 5, carrying: 8 }
  },

  // ─── CLEVELAND BROWNS ────────────────────────────────────────────────────
  {
    name: 'Jim Brown',       short: 'J. Brown',    team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#5e3c22', number: 32, starter: true, captain: true, years: '1957–65',
    attrs: { speed: 9, burst: 9, strength: 11, size: 9, balance: 9, elusiveness: 8, vision: 9, hands: 8, carrying: 9 }
  },
  {
    name: 'Nick Chubb',      short: 'Chubb',       team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#5e3c22', number: 24, starter: true, captain: true, years: '2018–23',
    attrs: { speed: 8, burst: 9, strength: 10, size: 7, balance: 9, elusiveness: 7, vision: 8, hands: 6, carrying: 9 }
  },
  {
    name: 'Leroy Kelly',     short: 'Kelly',       team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#5e3c22', number: 44, starter: true, captain: true, years: '1964–73',
    attrs: { speed: 8, burst: 8, strength: 7, size: 4, balance: 7, elusiveness: 8, vision: 8, hands: 7, carrying: 8 }
  },
  {
    name: 'Peyton Hillis',   short: 'Hillis',      team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#f0c4a0', number: 40, starter: true, captain: true, years: '2010–11',
    attrs: { speed: 6, burst: 6, strength: 10, size: 10, balance: 8, elusiveness: 4, vision: 7, hands: 6, carrying: 9 }
  },

  // ─── DALLAS COWBOYS ──────────────────────────────────────────────────────
  {
    name: 'Tony Dorsett',    short: 'Dorsett',     team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#5e3c22', number: 33, starter: true, captain: true, years: '1977–87',
    attrs: { speed: 10, burst: 9, strength: 5, size: 3, balance: 7, elusiveness: 9, vision: 9, hands: 7, carrying: 7 }
  },
  {
    name: 'Emmitt Smith',    short: 'E. Smith',    team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#7a5030', number: 22, starter: true, captain: true, years: '1990–02',
    attrs: { speed: 7, burst: 7, strength: 8, size: 5, balance: 9, elusiveness: 7, vision: 11, hands: 8, carrying: 10 }
  },
  {
    name: 'Herschel Walker', short: 'H. Walker',   team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#5e3c22', number: 34, starter: true, captain: true, years: '1986–89',
    attrs: { speed: 10, burst: 9, strength: 9, size: 8, balance: 7, elusiveness: 7, vision: 7, hands: 7, carrying: 8 }
  },
  {
    name: 'Ezekiel Elliott', short: 'Elliott',     team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#5e3c22', number: 21, starter: true, captain: true, years: '2016–22',
    attrs: { speed: 8, burst: 8, strength: 9, size: 7, balance: 9, elusiveness: 7, vision: 9, hands: 7, carrying: 9 }
  },
  {
    name: 'DeMarco Murray',  short: 'Murray',      team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#7a5030', number: 29, starter: true, captain: true, years: '2011–14',
    attrs: { speed: 9, burst: 8, strength: 7, size: 6, balance: 7, elusiveness: 7, vision: 8, hands: 7, carrying: 7 }
  },

  // ─── DENVER BRONCOS ──────────────────────────────────────────────────────
  {
    name: 'Terrell Davis',   short: 'T. Davis',    team: 'DEN', teamName: 'Denver Broncos',
    skin: '#7a5030', number: 30, starter: true, captain: true, years: '1995–01',
    attrs: { speed: 8, burst: 9, strength: 9, size: 5, balance: 9, elusiveness: 7, vision: 10, hands: 7, carrying: 9 }
  },
  {
    name: 'Mike Anderson',   short: 'M. Anderson', team: 'DEN', teamName: 'Denver Broncos',
    skin: '#5e3c22', number: 30, starter: true, captain: true, years: '2000–06',
    attrs: { speed: 8, burst: 8, strength: 9, size: 9, balance: 8, elusiveness: 6, vision: 8, hands: 7, carrying: 8 }
  },
  {
    name: 'C.J. Anderson',   short: 'C.J.',        team: 'DEN', teamName: 'Denver Broncos',
    skin: '#5e3c22', number: 22, starter: true, captain: true, years: '2013–17',
    attrs: { speed: 7, burst: 7, strength: 9, size: 6, balance: 8, elusiveness: 6, vision: 7, hands: 6, carrying: 8 }
  },

  // ─── DETROIT LIONS ───────────────────────────────────────────────────────
  {
    name: 'Barry Sanders',   short: 'B. Sanders',  team: 'DET', teamName: 'Detroit Lions',
    skin: '#5e3c22', number: 20, starter: true, captain: true, years: '1989–98',
    attrs: { speed: 10, burst: 11, strength: 5, size: 3, balance: 11, elusiveness: 11, vision: 11, hands: 7, carrying: 10 }
  },
  {
    name: 'Billy Sims',      short: 'Sims',        team: 'DET', teamName: 'Detroit Lions',
    skin: '#5e3c22', number: 20, starter: true, captain: true, years: '1980–84',
    attrs: { speed: 9, burst: 9, strength: 7, size: 5, balance: 7, elusiveness: 8, vision: 8, hands: 7, carrying: 7 }
  },
  {
    name: 'Reggie Bush',     short: 'R. Bush',     team: 'DET', teamName: 'Detroit Lions',
    skin: '#7a5030', number: 21, starter: true, captain: true, years: '2013–14',
    attrs: { speed: 10, burst: 9, strength: 4, size: 5, balance: 6, elusiveness: 9, vision: 7, hands: 8, carrying: 5 }
  },

  // ─── GREEN BAY PACKERS ───────────────────────────────────────────────────
  {
    name: 'Ahman Green',     short: 'A. Green',    team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#5e3c22', number: 30, starter: true, captain: true, years: '2000–06',
    attrs: { speed: 9, burst: 9, strength: 8, size: 6, balance: 7, elusiveness: 6, vision: 7, hands: 6, carrying: 7 }
  },
  {
    name: 'Eddie Lacy',      short: 'Lacy',        team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#5e3c22', number: 27, starter: true, captain: true, years: '2013–16',
    attrs: { speed: 7, burst: 7, strength: 9, size: 11, balance: 8, elusiveness: 5, vision: 7, hands: 6, carrying: 8 }
  },
  {
    name: 'Aaron Jones',     short: 'A. Jones',    team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#5e3c22', number: 33, starter: true, captain: true, years: '2017–23',
    attrs: { speed: 8, burst: 8, strength: 5, size: 4, balance: 7, elusiveness: 7, vision: 8, hands: 8, carrying: 7 }
  },

  // ─── HOUSTON TEXANS ──────────────────────────────────────────────────────
  {
    name: 'Arian Foster',    short: 'Foster',      team: 'HOU', teamName: 'Houston Texans',
    skin: '#7a5030', number: 23, starter: true, captain: true, years: '2009–15',
    attrs: { speed: 7, burst: 7, strength: 9, size: 8, balance: 8, elusiveness: 6, vision: 10, hands: 8, carrying: 8 }
  },
  {
    name: 'Domanick Davis',  short: 'D. Davis',    team: 'HOU', teamName: 'Houston Texans',
    skin: '#5e3c22', number: 29, starter: true, captain: true, years: '2003–05',
    attrs: { speed: 8, burst: 8, strength: 6, size: 5, balance: 7, elusiveness: 7, vision: 7, hands: 7, carrying: 7 }
  },
  {
    name: 'Steve Slaton',    short: 'Slaton',      team: 'HOU', teamName: 'Houston Texans',
    skin: '#5e3c22', number: 20, starter: true, captain: true, years: '2008–10',
    attrs: { speed: 9, burst: 9, strength: 5, size: 2, balance: 6, elusiveness: 8, vision: 7, hands: 7, carrying: 7 }
  },

  // ─── INDIANAPOLIS COLTS ──────────────────────────────────────────────────
  {
    name: 'Marshall Faulk',  short: 'M. Faulk',   team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#7a5030', number: 28, starter: true, captain: true, years: '1994–98',
    attrs: { speed: 9, burst: 10, strength: 6, size: 5, balance: 9, elusiveness: 10, vision: 9, hands: 11, carrying: 8 }
  },
  {
    name: 'Edgerrin James',  short: 'E. James',    team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#5e3c22', number: 32, starter: true, captain: true, years: '1999–05',
    attrs: { speed: 9, burst: 9, strength: 6, size: 6, balance: 8, elusiveness: 8, vision: 9, hands: 8, carrying: 10 }
  },
  {
    name: 'Jonathan Taylor', short: 'Taylor',      team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#5e3c22', number: 28, starter: true, captain: true, years: '2020–',
    attrs: { speed: 10, burst: 8, strength: 8, size: 8, balance: 9, elusiveness: 7, vision: 9, hands: 7, carrying: 9 }
  },

  // ─── JACKSONVILLE JAGUARS ────────────────────────────────────────────────
  {
    name: 'Fred Taylor',     short: 'F. Taylor',   team: 'JAX', teamName: 'Jacksonville Jaguars',
    skin: '#5e3c22', number: 28, starter: true, captain: true, years: '1998–08',
    attrs: { speed: 9, burst: 8, strength: 9, size: 9, balance: 7, elusiveness: 6, vision: 7, hands: 6, carrying: 8 }
  },
  {
    name: 'Maurice Jones-Drew', short: 'MJD',      team: 'JAX', teamName: 'Jacksonville Jaguars',
    skin: '#7a5030', number: 32, starter: true, captain: true, years: '2006–13',
    attrs: { speed: 8, burst: 9, strength: 7, size: 4, balance: 10, elusiveness: 9, vision: 8, hands: 8, carrying: 8 }
  },
  {
    name: 'Leonard Fournette', short: 'Fournette', team: 'JAX', teamName: 'Jacksonville Jaguars',
    skin: '#3a2010', number: 27, starter: true, captain: true, years: '2017–19',
    attrs: { speed: 8, burst: 8, strength: 9, size: 8, balance: 8, elusiveness: 5, vision: 7, hands: 6, carrying: 7 }
  },

  // ─── KANSAS CITY CHIEFS ──────────────────────────────────────────────────
  {
    name: 'Jamaal Charles',  short: 'J. Charles',   team: 'KC',  teamName: 'Kansas City Chiefs',
    skin: '#5e3c22', number: 25, starter: true, captain: true, years: '2008–16',
    attrs: { speed: 10, burst: 11, strength: 5, size: 5, balance: 8, elusiveness: 10, vision: 10, hands: 8, carrying: 7 }
  },
  {
    name: 'Priest Holmes',   short: 'P. Holmes',   team: 'KC',  teamName: 'Kansas City Chiefs',
    skin: '#5e3c22', number: 31, starter: true, captain: true, years: '2001–07',
    attrs: { speed: 10, burst: 9, strength: 5, size: 5, balance: 8, elusiveness: 9, vision: 9, hands: 9, carrying: 7 }
  },
  {
    name: 'Larry Johnson',   short: 'L. Johnson',  team: 'KC',  teamName: 'Kansas City Chiefs',
    skin: '#5e3c22', number: 27, starter: true, captain: true, years: '2003–08',
    attrs: { speed: 8, burst: 8, strength: 9, size: 8, balance: 8, elusiveness: 6, vision: 7, hands: 6, carrying: 7 }
  },

  // ─── LAS VEGAS RAIDERS ───────────────────────────────────────────────────
  {
    name: 'Bo Jackson',      short: 'B. Jackson',  team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#5e3c22', number: 34, starter: true, captain: true, years: '1987–90',
    attrs: { speed: 11, burst: 10, strength: 11, size: 8, balance: 7, elusiveness: 7, vision: 6, hands: 6, carrying: 7 }
  },
  {
    name: 'Marcus Allen',    short: 'M. Allen',    team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#7a5030', number: 32, starter: true, captain: true, years: '1982–92',
    attrs: { speed: 8, burst: 8, strength: 7, size: 5, balance: 8, elusiveness: 8, vision: 10, hands: 9, carrying: 9 }
  },
  {
    name: 'Napoleon Kaufman', short: 'Kaufman',    team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#5e3c22', number: 26, starter: true, captain: true, years: '1995–00',
    attrs: { speed: 10, burst: 9, strength: 5, size: 2, balance: 6, elusiveness: 8, vision: 7, hands: 6, carrying: 6 }
  },

  // ─── LOS ANGELES CHARGERS ────────────────────────────────────────────────
  {
    name: 'Paul Lowe',       short: 'Lowe',        team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#5e3c22', number: 23, starter: true, captain: true, years: '1960–67',
    attrs: { speed: 9, burst: 9, strength: 6, size: 3, balance: 7, elusiveness: 8, vision: 7, hands: 7, carrying: 7 }
  },
  {
    name: 'LaDainian Tomlinson', short: 'LT',      team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#7a5030', number: 21, starter: true, captain: true, years: '2001–09',
    attrs: { speed: 9, burst: 11, strength: 7, size: 6, balance: 8, elusiveness: 11, vision: 9, hands: 10, carrying: 11 }
  },
  {
    name: 'Natrone Means',   short: 'Means',       team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#5e3c22', number: 41, starter: true, captain: true, years: '1993–98',
    attrs: { speed: 8, burst: 8, strength: 9, size: 10, balance: 8, elusiveness: 5, vision: 7, hands: 5, carrying: 8 }
  },
  {
    name: 'Darren Sproles',  short: 'Sproles',     team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#5e3c22', number: 43, starter: true, captain: true, years: '2005–10',
    attrs: { speed: 10, burst: 10, strength: 4, size: 1, balance: 7, elusiveness: 10, vision: 8, hands: 9, carrying: 7 }
  },

  // ─── LOS ANGELES RAMS ────────────────────────────────────────────────────
  {
    name: 'Eric Dickerson',  short: 'Dickerson',   team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#5e3c22', number: 29, starter: true, captain: true, years: '1983–87',
    attrs: { speed: 11, burst: 10, strength: 9, size: 9, balance: 8, elusiveness: 7, vision: 8, hands: 6, carrying: 8 }
  },
  {
    name: 'Marshall Faulk',  short: 'Faulk',       team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#7a5030', number: 28, starter: true, captain: true, years: '1999–05',
    attrs: { speed: 9, burst: 10, strength: 6, size: 6, balance: 9, elusiveness: 10, vision: 9, hands: 11, carrying: 8 }
  },
  {
    name: 'Steven Jackson',  short: 'S. Jackson',  team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#5e3c22', number: 39, starter: true, captain: true, years: '2004–12',
    attrs: { speed: 8, burst: 8, strength: 9, size: 9, balance: 9, elusiveness: 6, vision: 8, hands: 7, carrying: 8 }
  },
  {
    name: 'Todd Gurley',     short: 'Gurley',      team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#5e3c22', number: 30, starter: true, captain: true, years: '2015–19',
    attrs: { speed: 9, burst: 10, strength: 8, size: 8, balance: 8, elusiveness: 7, vision: 8, hands: 7, carrying: 8 }
  },

  // ─── MIAMI DOLPHINS ──────────────────────────────────────────────────────
  {
    name: 'Ricky Williams',  short: 'R. Williams', team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#7a5030', number: 34, starter: true, captain: true, years: '2002–10',
    attrs: { speed: 8, burst: 8, strength: 9, size: 7, balance: 8, elusiveness: 7, vision: 7, hands: 7, carrying: 7 }
  },
  {
    name: 'Ronnie Brown',    short: 'R. Brown',    team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#5e3c22', number: 23, starter: true, captain: true, years: '2005–10',
    attrs: { speed: 8, burst: 8, strength: 9, size: 8, balance: 7, elusiveness: 6, vision: 7, hands: 7, carrying: 7 }
  },
  {
    name: 'Larry Csonka',    short: 'Csonka',      team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#f0c4a0', number: 39, starter: true, captain: true, years: '1968–74',
    attrs: { speed: 5, burst: 5, strength: 11, size: 9, balance: 8, elusiveness: 3, vision: 7, hands: 6, carrying: 10 }
  },

  // ─── MINNESOTA VIKINGS ───────────────────────────────────────────────────
  {
    name: 'Adrian Peterson', short: 'A. Peterson', team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#5e3c22', number: 28, starter: true, captain: true, years: '2007–16',
    attrs: { speed: 10, burst: 9, strength: 11, size: 9, balance: 10, elusiveness: 8, vision: 8, hands: 6, carrying: 9 }
  },
  {
    name: 'Robert Smith',    short: 'R. Smith',    team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#5e3c22', number: 26, starter: true, captain: true, years: '1993–00',
    attrs: { speed: 9, burst: 8, strength: 6, size: 6, balance: 7, elusiveness: 8, vision: 9, hands: 7, carrying: 8 }
  },
  {
    name: 'Dalvin Cook',     short: 'D. Cook',     team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#5e3c22', number: 33, starter: true, captain: true, years: '2017–22',
    attrs: { speed: 9, burst: 10, strength: 7, size: 5, balance: 8, elusiveness: 9, vision: 8, hands: 8, carrying: 8 }
  },

  // ─── NEW ENGLAND PATRIOTS ────────────────────────────────────────────────
  {
    name: 'Curtis Martin',   short: 'C. Martin',   team: 'NE',  teamName: 'New England Patriots',
    skin: '#7a5030', number: 28, starter: true, captain: true, years: '1995–97',
    attrs: { speed: 7, burst: 7, strength: 8, size: 5, balance: 9, elusiveness: 7, vision: 10, hands: 7, carrying: 8 }
  },
  {
    name: 'Corey Dillon',    short: 'C. Dillon',   team: 'NE',  teamName: 'New England Patriots',
    skin: '#5e3c22', number: 28, starter: true, captain: true, years: '2004–06',
    attrs: { speed: 8, burst: 8, strength: 9, size: 7, balance: 8, elusiveness: 6, vision: 8, hands: 6, carrying: 8 }
  },
  {
    name: 'Kevin Faulk',     short: 'K. Faulk',    team: 'NE',  teamName: 'New England Patriots',
    skin: '#5e3c22', number: 33, starter: true, captain: true, years: '1999–10',
    attrs: { speed: 8, burst: 8, strength: 5, size: 3, balance: 7, elusiveness: 8, vision: 7, hands: 9, carrying: 7 }
  },

  // ─── NEW ORLEANS SAINTS ──────────────────────────────────────────────────
  {
    name: 'George Rogers',   short: 'G. Rogers',   team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#5e3c22', number: 38, starter: true, captain: true, years: '1981–84',
    attrs: { speed: 8, burst: 8, strength: 9, size: 7, balance: 8, elusiveness: 6, vision: 8, hands: 6, carrying: 8 }
  },
  {
    name: 'Deuce McAllister', short: 'McAllister', team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#5e3c22', number: 26, starter: true, captain: true, years: '2001–08',
    attrs: { speed: 8, burst: 8, strength: 9, size: 8, balance: 8, elusiveness: 7, vision: 8, hands: 7, carrying: 8 }
  },
  {
    name: 'Mark Ingram',     short: 'M. Ingram',   team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#5e3c22', number: 22, starter: true, captain: true, years: '2011–18',
    attrs: { speed: 7, burst: 7, strength: 9, size: 5, balance: 8, elusiveness: 6, vision: 7, hands: 7, carrying: 9 }
  },
  {
    name: 'Alvin Kamara',    short: 'Kamara',      team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#7a5030', number: 41, starter: true, captain: true, years: '2017–24',
    attrs: { speed: 9, burst: 9, strength: 7, size: 6, balance: 8, elusiveness: 9, vision: 8, hands: 11, carrying: 7 }
  },

  // ─── NEW YORK GIANTS ─────────────────────────────────────────────────────
  {
    name: 'Joe Morris',      short: 'J. Morris',   team: 'NYG', teamName: 'New York Giants',
    skin: '#5e3c22', number: 20, starter: true, captain: true, years: '1982–88',
    attrs: { speed: 8, burst: 9, strength: 7, size: 2, balance: 9, elusiveness: 8, vision: 8, hands: 7, carrying: 8 }
  },
  {
    name: 'Rodney Hampton',  short: 'Hampton',     team: 'NYG', teamName: 'New York Giants',
    skin: '#5e3c22', number: 27, starter: true, captain: true, years: '1990–97',
    attrs: { speed: 8, burst: 8, strength: 8, size: 7, balance: 7, elusiveness: 6, vision: 7, hands: 6, carrying: 8 }
  },
  {
    name: 'Tiki Barber',     short: 'T. Barber',   team: 'NYG', teamName: 'New York Giants',
    skin: '#7a5030', number: 21, starter: true, captain: true, years: '1997–06',
    attrs: { speed: 8, burst: 8, strength: 5, size: 4, balance: 7, elusiveness: 9, vision: 10, hands: 9, carrying: 7 }
  },
  {
    name: 'Saquon Barkley',  short: 'Barkley',     team: 'NYG', teamName: 'New York Giants',
    skin: '#7a5030', number: 26, starter: true, captain: true, years: '2018–23',
    attrs: { speed: 10, burst: 10, strength: 8, size: 8, balance: 8, elusiveness: 9, vision: 8, hands: 8, carrying: 8 }
  },

  // ─── NEW YORK JETS ───────────────────────────────────────────────────────
  {
    name: 'Freeman McNeil',  short: 'McNeil',      team: 'NYJ', teamName: 'New York Jets',
    skin: '#5e3c22', number: 24, starter: true, captain: true, years: '1981–92',
    attrs: { speed: 8, burst: 7, strength: 5, size: 6, balance: 8, elusiveness: 9, vision: 8, hands: 6, carrying: 7 }
  },
  {
    name: 'Curtis Martin',   short: 'C. Martin',   team: 'NYJ', teamName: 'New York Jets',
    skin: '#7a5030', number: 28, starter: true, captain: true, years: '1998–05',
    attrs: { speed: 7, burst: 7, strength: 8, size: 5, balance: 9, elusiveness: 7, vision: 10, hands: 7, carrying: 8 }
  },
  {
    name: 'Thomas Jones',    short: 'T. Jones',    team: 'NYJ', teamName: 'New York Jets',
    skin: '#5e3c22', number: 20, starter: true, captain: true, years: '2007–09',
    attrs: { speed: 7, burst: 7, strength: 8, size: 6, balance: 7, elusiveness: 6, vision: 7, hands: 5, carrying: 7 }
  },

  // ─── PHILADELPHIA EAGLES ─────────────────────────────────────────────────
  {
    name: 'Brian Westbrook',  short: 'Westbrook',  team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#5e3c22', number: 36, starter: true, captain: true, years: '2002–09',
    attrs: { speed: 9, burst: 9, strength: 5, size: 3, balance: 8, elusiveness: 9, vision: 9, hands: 10, carrying: 7 }
  },
  {
    name: 'LeSean McCoy',    short: 'McCoy',       team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#5e3c22', number: 25, starter: true, captain: true, years: '2009–14',
    attrs: { speed: 9, burst: 10, strength: 5, size: 5, balance: 8, elusiveness: 11, vision: 8, hands: 8, carrying: 6 }
  },
  {
    name: 'Saquon Barkley',  short: 'Barkley',     team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#7a5030', number: 26, starter: true, captain: true, years: '2024–',
    attrs: { speed: 10, burst: 11, strength: 9, size: 8, balance: 9, elusiveness: 10, vision: 8, hands: 9, carrying: 10 }
  },

  // ─── PITTSBURGH STEELERS ─────────────────────────────────────────────────
  {
    name: 'Franco Harris',   short: 'F. Harris',   team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#7a5030', number: 32, starter: true, captain: true, years: '1972–83',
    attrs: { speed: 7, burst: 7, strength: 9, size: 8, balance: 8, elusiveness: 6, vision: 9, hands: 8, carrying: 9 }
  },
  {
    name: 'Jerome Bettis',   short: 'Bettis',      team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#3a2010', number: 36, starter: true, captain: true, years: '1996–05',
    attrs: { speed: 6, burst: 6, strength: 11, size: 11, balance: 9, elusiveness: 5, vision: 7, hands: 6, carrying: 10 }
  },
  {
    name: 'Willie Parker',   short: 'W. Parker',   team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#5e3c22', number: 39, starter: true, captain: true, years: '2004–09',
    attrs: { speed: 10, burst: 9, strength: 6, size: 5, balance: 7, elusiveness: 7, vision: 7, hands: 6, carrying: 7 }
  },
  {
    name: "Le'Veon Bell",    short: "L. Bell",     team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#5e3c22', number: 26, starter: true, captain: true, years: '2013–18',
    attrs: { speed: 8, burst: 6, strength: 8, size: 8, balance: 9, elusiveness: 7, vision: 11, hands: 9, carrying: 8 }
  },

  // ─── SAN FRANCISCO 49ERS ─────────────────────────────────────────────────
  {
    name: 'Roger Craig',     short: 'R. Craig',    team: 'SF',  teamName: 'San Francisco 49ers',
    skin: '#7a5030', number: 33, starter: true, captain: true, years: '1983–90',
    attrs: { speed: 8, burst: 7, strength: 7, size: 7, balance: 8, elusiveness: 7, vision: 8, hands: 11, carrying: 8 }
  },
  {
    name: 'Frank Gore',      short: 'Gore',        team: 'SF',  teamName: 'San Francisco 49ers',
    skin: '#7a5030', number: 21, starter: true, captain: true, years: '2005–14',
    attrs: { speed: 7, burst: 7, strength: 8, size: 5, balance: 9, elusiveness: 6, vision: 10, hands: 7, carrying: 10 }
  },
  {
    name: 'Christian McCaffrey', short: 'McCaffrey', team: 'SF',  teamName: 'San Francisco 49ers',
    skin: '#f0c4a0', number: 23, starter: true, captain: true, years: '2023–',
    attrs: { speed: 8, burst: 9, strength: 6, size: 6, balance: 6, hands: 11, vision: 9, elusiveness: 9, carrying: 10 }
  },

  // ─── SEATTLE SEAHAWKS ────────────────────────────────────────────────────
  {
    name: 'Curt Warner',     short: 'C. Warner',   team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#5e3c22', number: 28, starter: true, captain: true, years: '1983–89',
    attrs: { speed: 9, burst: 9, strength: 7, size: 4, balance: 7, elusiveness: 7, vision: 8, hands: 6, carrying: 8 }
  },
  {
    name: 'Shaun Alexander', short: 'Alexander',   team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#5e3c22', number: 37, starter: true, captain: true, years: '2000–07',
    attrs: { speed: 7, burst: 9, strength: 8, size: 7, balance: 7, elusiveness: 6, vision: 10, hands: 6, carrying: 9 }
  },
  {
    name: 'Marshawn Lynch',  short: 'Lynch',       team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#5e3c22', number: 24, starter: true, captain: true, years: '2010–15',
    attrs: { speed: 8, burst: 9, strength: 11, size: 8, balance: 11, elusiveness: 7, vision: 9, hands: 6, carrying: 9 }
  },

  // ─── TAMPA BAY BUCCANEERS ────────────────────────────────────────────────
  {
    name: 'James Wilder',    short: 'Wilder',      team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#5e3c22', number: 32, starter: true, captain: true, years: '1981–89',
    attrs: { speed: 7, burst: 7, strength: 8, size: 7, balance: 7, elusiveness: 6, vision: 7, hands: 8, carrying: 8 }
  },
  {
    name: 'Warrick Dunn',    short: 'W. Dunn',     team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#5e3c22', number: 28, starter: true, captain: true, years: '1997–01',
    attrs: { speed: 9, burst: 9, strength: 5, size: 1, balance: 7, elusiveness: 8, vision: 8, hands: 8, carrying: 7 }
  },
  {
    name: 'Mike Alstott',    short: 'Alstott',     team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#f0c4a0', number: 40, starter: true, captain: true, years: '1996–06',
    attrs: { speed: 6, burst: 6, strength: 9, size: 10, balance: 9, elusiveness: 4, vision: 7, hands: 7, carrying: 8 }
  },
  {
    name: 'Doug Martin',     short: 'D. Martin',   team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#5e3c22', number: 22, starter: true, captain: true, years: '2012–18',
    attrs: { speed: 8, burst: 9, strength: 9, size: 5, balance: 9, elusiveness: 8, vision: 8, hands: 7, carrying: 8 }
  },

  // ─── TENNESSEE TITANS ────────────────────────────────────────────────────
  {
    name: 'Earl Campbell',   short: 'Campbell',    team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#5e3c22', number: 34, starter: true, captain: true, years: '1978–84',
    attrs: { speed: 8, burst: 8, strength: 11, size: 8, balance: 9, elusiveness: 4, vision: 7, hands: 4, carrying: 9 }
  },
  {
    name: 'Eddie George',    short: 'E. George',   team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#5e3c22', number: 27, starter: true, captain: true, years: '1996–03',
    attrs: { speed: 7, burst: 7, strength: 9, size: 9, balance: 8, elusiveness: 5, vision: 8, hands: 7, carrying: 8 }
  },
  {
    name: 'Chris Johnson',   short: 'CJ2K',        team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#3a2010', number: 28, starter: true, captain: true, years: '2008–13',
    attrs: { speed: 11, burst: 11, strength: 5, size: 4, balance: 7, elusiveness: 9, vision: 8, hands: 7, carrying: 7 }
  },
  {
    name: 'Derrick Henry',   short: 'D. Henry',    team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#3a2010', number: 22, starter: true, captain: true, years: '2016–21',
    attrs: { speed: 9, burst: 6, strength: 11, size: 11, balance: 9, elusiveness: 4, vision: 8, hands: 4, carrying: 9 }
  },

  // ─── WASHINGTON COMMANDERS ───────────────────────────────────────────────
  {
    name: 'John Riggins',    short: 'Riggins',     team: 'WAS', teamName: 'Washington Commanders',
    skin: '#f0c4a0', number: 44, starter: true, captain: true, years: '1976–85',
    attrs: { speed: 6, burst: 6, strength: 11, size: 8, balance: 9, elusiveness: 4, vision: 7, hands: 6, carrying: 9 }
  },
  {
    name: 'Clinton Portis',  short: 'C. Portis',   team: 'WAS', teamName: 'Washington Commanders',
    skin: '#5e3c22', number: 26, starter: true, captain: true, years: '2004–10',
    attrs: { speed: 9, burst: 9, strength: 6, size: 6, balance: 7, elusiveness: 9, vision: 8, hands: 8, carrying: 7 }
  },
  {
    name: 'Alfred Morris',   short: 'A. Morris',   team: 'WAS', teamName: 'Washington Commanders',
    skin: '#5e3c22', number: 46, starter: true, captain: true, years: '2012–15',
    attrs: { speed: 7, burst: 7, strength: 8, size: 6, balance: 8, elusiveness: 6, vision: 9, hands: 6, carrying: 8 }
  },

]

export const RB_LEGENDS = _raw.map(p => ({
  ...p,
  color:  TEAM_COLOR[p.team]?.color  ?? '#888888',
  color2: TEAM_COLOR[p.team]?.color2 ?? '#ffffff',
}))

export const RB_LEGEND_TYPES = ['speed', 'burst', 'strength', 'size', 'balance', 'elusiveness', 'vision', 'hands', 'carrying']

export const RB_LEGEND_PHYSICALS = {
  'Aaron Jones':        { height: 69, weight: 208 },
  'Adrian Peterson':    { height: 73, weight: 220 },
  'Ahman Green':        { height: 72, weight: 218 },
  'Alfred Morris':      { height: 70, weight: 218 },
  'Alvin Kamara':       { height: 71, weight: 215 },
  'Arian Foster':       { height: 73, weight: 229 },
  'Barry Sanders':      { height: 68, weight: 203 },
  'Billy Sims':         { height: 71, weight: 212 },
  'Bo Jackson':         { height: 73, weight: 230 },
  'Brian Westbrook':    { height: 69, weight: 200 },
  'C.J. Anderson':      { height: 68, weight: 224 },
  'Christian McCaffrey':{ height: 71, weight: 205 },
  'Christian Okoye':    { height: 74, weight: 253 },
  'Clinton Portis':     { height: 70, weight: 216 },
  'Corey Dillon':       { height: 72, weight: 225 },
  'Curt Warner':        { height: 69, weight: 205 },
  'Curtis Martin':      { height: 71, weight: 210 },
  'Dalvin Cook':        { height: 70, weight: 210 },
  'Darren Sproles':     { height: 66, weight: 190 },
  'David Johnson':      { height: 73, weight: 224 },
  'DeAngelo Williams':  { height: 68, weight: 210 },
  'DeMarco Murray':     { height: 73, weight: 213 },
  'Derrick Henry':      { height: 75, weight: 247 },
  'Deuce McAllister':   { height: 72, weight: 232 },
  'Devonta Freeman':    { height: 68, weight: 207 },
  'Domanick Davis':     { height: 70, weight: 214 },
  'Doug Martin':        { height: 68, weight: 215 },
  'Earl Campbell':      { height: 71, weight: 232 },
  'Eddie George':       { height: 74, weight: 235 },
  'Eddie Lacy':         { height: 71, weight: 250 },
  'Edgerrin James':     { height: 72, weight: 214 },
  'Emmitt Smith':       { height: 69, weight: 216 },
  'Eric Dickerson':     { height: 74, weight: 220 },
  'Ezekiel Elliott':    { height: 72, weight: 225 },
  'Franco Harris':      { height: 74, weight: 225 },
  'Frank Gore':         { height: 69, weight: 212 },
  'Fred Jackson':       { height: 72, weight: 218 },
  'Fred Taylor':        { height: 73, weight: 234 },
  'Freeman McNeil':     { height: 71, weight: 215 },
  'Gale Sayers':        { height: 72, weight: 198 },
  'George Rogers':      { height: 72, weight: 224 },
  'Gerald Riggs':       { height: 72, weight: 232 },
  'Herschel Walker':    { height: 74, weight: 225 },
  'Jamal Lewis':        { height: 72, weight: 242 },
  'James Brooks':       { height: 69, weight: 182 },
  'James Wilder':       { height: 73, weight: 222 },
  'Jerome Bettis':      { height: 71, weight: 255 },
  'Jim Brown':          { height: 74, weight: 232 },
  'Joe Mixon':          { height: 72, weight: 220 },
  'Joe Morris':         { height: 67, weight: 195 },
  'John Riggins':       { height: 73, weight: 230 },
  'Jonathan Stewart':   { height: 70, weight: 235 },
  'Jonathan Taylor':    { height: 71, weight: 216 },
  'Kevin Faulk':        { height: 67, weight: 202 },
  'LaDainian Tomlinson':{ height: 70, weight: 215 },
  'Larry Centers':      { height: 72, weight: 214 },
  'Larry Csonka':       { height: 72, weight: 237 },
  'Larry Johnson':      { height: 73, weight: 230 },
  "Le'Veon Bell":       { height: 73, weight: 225 },
  'LeSean McCoy':       { height: 71, weight: 210 },
  'Leonard Fournette':  { height: 73, weight: 228 },
  'Leroy Kelly':        { height: 71, weight: 202 },
  'Marcus Allen':       { height: 72, weight: 210 },
  'Mark Ingram':        { height: 69, weight: 215 },
  'Marshall Faulk':     { height: 71, weight: 212 },
  'Marshawn Lynch':     { height: 71, weight: 215 },
  'Matt Forte':         { height: 73, weight: 218 },
  'Maurice Jones-Drew': { height: 66, weight: 208 },
  'Michael Turner':     { height: 70, weight: 237 },
  'Mike Alstott':       { height: 72, weight: 248 },
  'Mike Anderson':      { height: 72, weight: 234 },
  'Napoleon Kaufman':   { height: 70, weight: 185 },
  'Natrone Means':      { height: 71, weight: 245 },
  'Neal Anderson':      { height: 71, weight: 210 },
  'Nick Chubb':         { height: 71, weight: 227 },
  'O.J. Simpson':       { height: 72, weight: 212 },
  'Ottis Anderson':     { height: 73, weight: 224 },
  'Paul Lowe':          { height: 70, weight: 196 },
  'Pete Johnson':       { height: 72, weight: 259 },
  'Peyton Hillis':      { height: 73, weight: 240 },
  'Priest Holmes':      { height: 69, weight: 213 },
  'Ray Rice':           { height: 67, weight: 212 },
  'Reggie Bush':        { height: 73, weight: 201 },
  'Ricky Williams':     { height: 71, weight: 226 },
  'Robert Smith':       { height: 73, weight: 212 },
  'Rodney Hampton':     { height: 70, weight: 230 },
  'Roger Craig':        { height: 72, weight: 224 },
  'Ronnie Brown':       { height: 72, weight: 232 },
  'Saquon Barkley':     { height: 72, weight: 232 },
  'Shaun Alexander':    { height: 72, weight: 225 },
  'Steve Slaton':       { height: 68, weight: 192 },
  'Steven Jackson':     { height: 74, weight: 236 },
  'Terrell Davis':      { height: 72, weight: 210 },
  'Thomas Jones':       { height: 71, weight: 220 },
  'Thurman Thomas':     { height: 70, weight: 198 },
  'Tiki Barber':        { height: 70, weight: 200 },
  'Todd Gurley':        { height: 73, weight: 224 },
  'Tony Dorsett':       { height: 70, weight: 192 },
  'Walter Payton':      { height: 71, weight: 202 },
  'Warrick Dunn':       { height: 68, weight: 180 },
  'Willie Parker':      { height: 70, weight: 209 },
  'Willis McGahee':     { height: 71, weight: 228 },
}
