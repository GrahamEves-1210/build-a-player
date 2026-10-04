// All-Time TE Legends — 3–4 per franchise, blocking/receiving hybrids weighted by era
// Attrs (1–11): speed, blocking, vertical, routeRunning, strength, hands, awareness, size, afterCatch
// Calibration: Rob Gronkowski afterCatch=11 · George Kittle/Jason Witten blocking=11
//   Antonio Gates/Tony Gonzalez hands=11 · Travis Kelce/Tony Gonzalez/Antonio Gates routeRunning=11(+)
//   Shannon Sharpe strength=11 · Vernon Davis speed/vertical=11
// Size: 70% height + 30% weight, 0–11 (TE-specific anchors — bigger baseline than WR).
//   Anchor: 74"/235lb≈0 · 79"/264lb≈11 (matches tes.js roster calibration)
// Skin: #f0c4a0 white · #b07848 mixed/Polynesian · #7a5030 medium brown · #5e3c22 Black · #3a2010 very dark
// Grade→value: F=0 D=1 D+=2 C-=2 C=3 C+=4 B-=5 B=6 B+=7 A-=8 A=9 A+=10 S/S+=11
// Note: no All-Time New York Jets entries — the source scouting dataset this file was built
//   from did not include the Jets; every other franchise (31) is represented.

import { TEAMS } from './nfl-teams'

const TEAM_COLOR = Object.fromEntries(TEAMS.map(t => [t.short, { color: t.color, color2: t.color2 }]))

const _TE_W = { hands: 0.16, routeRunning: 0.15, size: 0.12, awareness: 0.11, afterCatch: 0.11, blocking: 0.09, strength: 0.09, vertical: 0.09, speed: 0.08 }
const _TE_T = ['speed', 'blocking', 'vertical', 'routeRunning', 'strength', 'hands', 'awareness', 'size', 'afterCatch']
function _teOVR(a) {
  const vals   = _TE_T.map(t => a[t] ?? 0)
  const avg    = _TE_T.reduce((s, t) => s + (a[t] ?? 0) * _TE_W[t], 0)
  const base   = 60 + 2.1 * avg + 0.21 * avg * avg
  const spread = Math.max(...vals) - Math.min(...vals)
  const minVal = Math.min(...vals)
  const bonus    = spread <= 1 ? 2.5 : spread <= 2 ? 1.0 : spread <= 3 ? 0.3 : 0
  const minBonus = minVal >= 9 ? 2.0 : minVal >= 8 ? 0.5 : 0
  return Math.min(99, Math.max(0, Math.round(base + bonus + minBonus)))
}

const _raw = [

  // ─── ARIZONA CARDINALS ───────────────────────────────────────────────────
  {
    name: 'Jackie Smith',      short: 'Jackie Smith', team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#f0c4a0', height: 76, weight: 235, number: 81, starter: true, captain: true, years: '1963–77',
    attrs: { speed: 7, blocking: 8, vertical: 7, routeRunning: 6, strength: 9, hands: 9, awareness: 10, size: 1, afterCatch: 8 },
  },
  {
    name: 'Trey McBride',      short: 'McBride',      team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#f0c4a0', height: 76, weight: 258, number: 85, starter: true, captain: true, years: '2022–',
    attrs: { speed: 8, blocking: 5, vertical: 9, routeRunning: 11, strength: 7, hands: 11, awareness: 11, size: 7, afterCatch: 10 },
  },
  {
    name: 'Doug Marsh',        short: 'Marsh',        team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#f0c4a0', height: 75, weight: 240, number: 84, starter: true, captain: true, years: '1980–86',
    attrs: { speed: 3, blocking: 10, vertical: 4, routeRunning: 3, strength: 10, hands: 7, awareness: 7, size: 2, afterCatch: 5 },
  },

  // ─── ATLANTA FALCONS ─────────────────────────────────────────────────────
  {
    name: 'Tony Gonzalez',     short: 'T. Gonzalez',  team: 'ATL', teamName: 'Atlanta Falcons',
    skin: '#b07848', height: 77, weight: 247, number: 88, starter: true, captain: true, years: '2009–13',
    attrs: { speed: 6, blocking: 6, vertical: 9, routeRunning: 9, strength: 8, hands: 11, awareness: 10, size: 5, afterCatch: 9 },
  },
  {
    name: 'Alge Crumpler',     short: 'Crumpler',     team: 'ATL', teamName: 'Atlanta Falcons',
    skin: '#5e3c22', height: 74, weight: 270, number: 83, starter: true, captain: true, years: '2001–07',
    attrs: { speed: 6, blocking: 7, vertical: 7, routeRunning: 6, strength: 10, hands: 8, awareness: 7, size: 9, afterCatch: 6 },
  },
  {
    name: 'Kyle Pitts',        short: 'Pitts',        team: 'ATL', teamName: 'Atlanta Falcons',
    skin: '#5e3c22', height: 78, weight: 246, number: 8, starter: true, captain: true, years: '2021–',
    attrs: { speed: 10, blocking: 2, vertical: 9, routeRunning: 8, strength: 4, hands: 9, awareness: 7, size: 6, afterCatch: 7 },
  },

  // ─── BALTIMORE RAVENS ────────────────────────────────────────────────────
  {
    name: 'Mark Andrews',      short: 'Andrews',      team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#f0c4a0', height: 77, weight: 256, number: 89, starter: true, captain: true, years: '2018–',
    attrs: { speed: 8, blocking: 6, vertical: 8, routeRunning: 9, strength: 7, hands: 10, awareness: 8, size: 8, afterCatch: 8 },
  },
  {
    name: 'Todd Heap',         short: 'Heap',         team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#f0c4a0', height: 77, weight: 252, number: 86, starter: true, captain: true, years: '2001–10',
    attrs: { speed: 7, blocking: 8, vertical: 7, routeRunning: 7, strength: 9, hands: 9, awareness: 8, size: 6, afterCatch: 6 },
  },
  {
    name: 'Dennis Pitta',      short: 'Pitta',        team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#f0c4a0', height: 76, weight: 245, number: 88, starter: true, captain: true, years: '2010–16',
    attrs: { speed: 7, blocking: 6, vertical: 7, routeRunning: 6, strength: 9, hands: 9, awareness: 7, size: 4, afterCatch: 5 },
  },

  // ─── BUFFALO BILLS ───────────────────────────────────────────────────────
  {
    name: 'Pete Metzelaars',   short: 'Metzelaars',   team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#f0c4a0', height: 79, weight: 254, number: 88, starter: true, captain: true, years: '1985–94',
    attrs: { speed: 7, blocking: 8, vertical: 6, routeRunning: 5, strength: 10, hands: 10, awareness: 9, size: 8, afterCatch: 6 },
  },
  {
    name: 'Dawson Knox',       short: 'Knox',         team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#f0c4a0', height: 76, weight: 254, number: 88, starter: true, captain: true, years: '2019–',
    attrs: { speed: 9, blocking: 6, vertical: 7, routeRunning: 8, strength: 6, hands: 9, awareness: 6, size: 6, afterCatch: 8 },
  },
  {
    name: 'Jay Riemersma',     short: 'Riemersma',    team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#f0c4a0', height: 76, weight: 252, number: 87, starter: true, captain: true, years: '1997–02',
    attrs: { speed: 4, blocking: 7, vertical: 6, routeRunning: 7, strength: 8, hands: 8, awareness: 8, size: 6, afterCatch: 6 },
  },
  {
    name: 'Scott Chandler',    short: 'Chandler',     team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#f0c4a0', height: 79, weight: 263, number: 84, starter: true, captain: true, years: '2010–14',
    attrs: { speed: 6, blocking: 5, vertical: 6, routeRunning: 8, strength: 4, hands: 9, awareness: 8, size: 11, afterCatch: 7 },
  },

  // ─── CAROLINA PANTHERS ───────────────────────────────────────────────────
  {
    name: 'Greg Olsen',        short: 'Olsen',        team: 'CAR', teamName: 'Carolina Panthers',
    skin: '#f0c4a0', height: 77, weight: 255, number: 88, starter: true, captain: true, years: '2011–19',
    attrs: { speed: 9, blocking: 7, vertical: 8, routeRunning: 9, strength: 9, hands: 10, awareness: 11, size: 7, afterCatch: 9 },
  },
  {
    name: 'Wesley Walls',      short: 'Walls',        team: 'CAR', teamName: 'Carolina Panthers',
    skin: '#5e3c22', height: 77, weight: 255, number: 82, starter: true, captain: true, years: '1996–02',
    attrs: { speed: 7, blocking: 6, vertical: 7, routeRunning: 6, strength: 10, hands: 9, awareness: 9, size: 7, afterCatch: 7 },
  },
  {
    name: 'Gary Barnidge',     short: 'Barnidge',     team: 'CAR', teamName: 'Carolina Panthers',
    skin: '#5e3c22', height: 78, weight: 253, number: 82, starter: true, captain: true, years: '2008–12',
    attrs: { speed: 8, blocking: 6, vertical: 7, routeRunning: 7, strength: 9, hands: 8, awareness: 8, size: 7, afterCatch: 6 },
  },

  // ─── CHICAGO BEARS ───────────────────────────────────────────────────────
  {
    name: 'Mike Ditka',        short: 'Ditka',        team: 'CHI', teamName: 'Chicago Bears',
    skin: '#f0c4a0', height: 75, weight: 225, number: 89, starter: true, captain: true, years: '1961–66',
    attrs: { speed: 6, blocking: 8, vertical: 7, routeRunning: 8, strength: 9, hands: 11, awareness: 11, size: 0, afterCatch: 8 },
  },
  {
    name: 'Martellus Bennett', short: 'Bennett',      team: 'CHI', teamName: 'Chicago Bears',
    skin: '#5e3c22', height: 78, weight: 265, number: 83, starter: true, captain: true, years: '2013–15',
    attrs: { speed: 7, blocking: 8, vertical: 7, routeRunning: 6, strength: 7, hands: 8, awareness: 8, size: 11, afterCatch: 6 },
  },
  {
    name: 'Desmond Clark',     short: 'Desmond Clark', team: 'CHI', teamName: 'Chicago Bears',
    skin: '#5e3c22', height: 75, weight: 255, number: 88, starter: true, captain: true, years: '2003–10',
    attrs: { speed: 4, blocking: 6, vertical: 5, routeRunning: 5, strength: 4, hands: 8, awareness: 9, size: 6, afterCatch: 5 },
  },
  {
    name: 'Cole Kmet',         short: 'Kmet',         team: 'CHI', teamName: 'Chicago Bears',
    skin: '#f0c4a0', height: 78, weight: 251, number: 85, starter: true, captain: true, years: '2020–',
    attrs: { speed: 7, blocking: 7, vertical: 10, routeRunning: 6, strength: 7, hands: 8, awareness: 8, size: 7, afterCatch: 7 },
  },

  // ─── CINCINNATI BENGALS ──────────────────────────────────────────────────
  {
    name: 'Bob Trumpy',        short: 'Trumpy',       team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#f0c4a0', height: 78, weight: 230, number: 84, starter: true, captain: true, years: '1968–77',
    attrs: { speed: 6, blocking: 8, vertical: 7, routeRunning: 7, strength: 9, hands: 9, awareness: 10, size: 1, afterCatch: 7 },
  },
  {
    name: 'Rodney Holman',     short: 'Holman',       team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#5e3c22', height: 75, weight: 232, number: 82, starter: true, captain: true, years: '1982–92',
    attrs: { speed: 7, blocking: 8, vertical: 6, routeRunning: 6, strength: 8, hands: 10, awareness: 9, size: 0, afterCatch: 8 },
  },
  {
    name: 'Tyler Eifert',      short: 'Eifert',       team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#f0c4a0', height: 78, weight: 250, number: 85, starter: true, captain: true, years: '2013–19',
    attrs: { speed: 7, blocking: 10, vertical: 8, routeRunning: 7, strength: 9, hands: 9, awareness: 5, size: 7, afterCatch: 6 },
  },

  // ─── CLEVELAND BROWNS ────────────────────────────────────────────────────
  {
    name: 'Ozzie Newsome',     short: 'Newsome',      team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#5e3c22', height: 74, weight: 232, number: 82, starter: true, captain: true, years: '1978–90',
    attrs: { speed: 7, blocking: 9, vertical: 8, routeRunning: 7, strength: 9, hands: 11, awareness: 10, size: 0, afterCatch: 8 },
  },
  {
    name: 'David Njoku',       short: 'Njoku',        team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#3a2010', height: 76, weight: 246, number: 85, starter: true, captain: true, years: '2017–25',
    attrs: { speed: 8, blocking: 6, vertical: 9, routeRunning: 9, strength: 9, hands: 9, awareness: 8, size: 4, afterCatch: 7 },
  },
  {
    name: 'Milt Morin',        short: 'Morin',        team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#5e3c22', height: 76, weight: 235, number: 80, starter: true, captain: true, years: '1966–75',
    attrs: { speed: 6, blocking: 10, vertical: 6, routeRunning: 5, strength: 10, hands: 8, awareness: 10, size: 1, afterCatch: 5 },
  },
  {
    name: 'Kellen Winslow Jr.', short: 'Winslow Jr.', team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#5e3c22', height: 76, weight: 252, number: 80, starter: true, captain: true, years: '2004–07',
    attrs: { speed: 9, blocking: 5, vertical: 8, routeRunning: 9, strength: 9, hands: 8, awareness: 7, size: 6, afterCatch: 7 },
  },

  // ─── DALLAS COWBOYS ──────────────────────────────────────────────────────
  {
    name: 'Jason Witten',      short: 'Witten',       team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#f0c4a0', height: 78, weight: 265, number: 82, starter: true, captain: true, years: '2003–17, 2019',
    attrs: { speed: 8, blocking: 11, vertical: 7, routeRunning: 8, strength: 10, hands: 10, awareness: 11, size: 11, afterCatch: 8 },
  },
  {
    name: 'Jay Novacek',       short: 'Novacek',      team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#f0c4a0', height: 76, weight: 230, number: 84, starter: true, captain: true, years: '1990–96',
    attrs: { speed: 8, blocking: 7, vertical: 8, routeRunning: 8, strength: 7, hands: 9, awareness: 10, size: 0, afterCatch: 6 },
  },
  {
    name: 'Billy Joe DuPree',  short: 'DuPree',       team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#5e3c22', height: 76, weight: 230, number: 89, starter: true, captain: true, years: '1973–83',
    attrs: { speed: 7, blocking: 9, vertical: 7, routeRunning: 7, strength: 9, hands: 8, awareness: 9, size: 0, afterCatch: 7 },
  },

  // ─── DENVER BRONCOS ──────────────────────────────────────────────────────
  {
    name: 'Shannon Sharpe',    short: 'Sharpe',       team: 'DEN', teamName: 'Denver Broncos',
    skin: '#5e3c22', height: 74, weight: 230, number: 81, starter: true, captain: true, years: '1990–99, 2002–03',
    attrs: { speed: 7, blocking: 8, vertical: 8, routeRunning: 9, strength: 11, hands: 10, awareness: 10, size: 0, afterCatch: 8 },
  },
  {
    name: 'Riley Odoms',       short: 'Odoms',        team: 'DEN', teamName: 'Denver Broncos',
    skin: '#5e3c22', height: 76, weight: 230, number: 88, starter: true, captain: true, years: '1972–83',
    attrs: { speed: 7, blocking: 9, vertical: 6, routeRunning: 7, strength: 9, hands: 8, awareness: 10, size: 0, afterCatch: 6 },
  },
  {
    name: 'Julius Thomas',     short: 'J. Thomas',    team: 'DEN', teamName: 'Denver Broncos',
    skin: '#5e3c22', height: 77, weight: 250, number: 80, starter: true, captain: true, years: '2011–14',
    attrs: { speed: 7, blocking: 6, vertical: 8, routeRunning: 7, strength: 6, hands: 9, awareness: 6, size: 7, afterCatch: 5 },
  },

  // ─── DETROIT LIONS ───────────────────────────────────────────────────────
  {
    name: 'Charlie Sanders',   short: 'C. Sanders',   team: 'DET', teamName: 'Detroit Lions',
    skin: '#5e3c22', height: 76, weight: 230, number: 88, starter: true, captain: true, years: '1968–77',
    attrs: { speed: 6, blocking: 9, vertical: 7, routeRunning: 6, strength: 9, hands: 8, awareness: 10, size: 0, afterCatch: 7 },
  },
  {
    name: 'Brandon Pettigrew', short: 'Pettigrew',    team: 'DET', teamName: 'Detroit Lions',
    skin: '#f0c4a0', height: 77, weight: 260, number: 87, starter: true, captain: true, years: '2009–15',
    attrs: { speed: 5, blocking: 11, vertical: 8, routeRunning: 4, strength: 9, hands: 8, awareness: 8, size: 9, afterCatch: 5 },
  },
  {
    name: 'TJ Hockenson',      short: 'Hockenson',    team: 'DET', teamName: 'Detroit Lions',
    skin: '#f0c4a0', height: 76, weight: 251, number: 88, starter: true, captain: true, years: '2019–22',
    attrs: { speed: 6, blocking: 9, vertical: 9, routeRunning: 8, strength: 7, hands: 9, awareness: 7, size: 6, afterCatch: 8 },
  },

  // ─── GREEN BAY PACKERS ───────────────────────────────────────────────────
  {
    name: 'Ron Kramer',        short: 'Kramer',       team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#f0c4a0', height: 75, weight: 234, number: 88, starter: true, captain: true, years: '1957–64',
    attrs: { speed: 7, blocking: 9, vertical: 6, routeRunning: 6, strength: 9, hands: 9, awareness: 10, size: 0, afterCatch: 5 },
  },
  {
    name: 'Jermichael Finley', short: 'Finley',       team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#5e3c22', height: 77, weight: 247, number: 88, starter: true, captain: true, years: '2008–13',
    attrs: { speed: 7, blocking: 6, vertical: 2, routeRunning: 7, strength: 9, hands: 9, awareness: 8, size: 5, afterCatch: 6 },
  },
  {
    name: 'Paul Coffman',      short: 'Coffman',      team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#f0c4a0', height: 75, weight: 222, number: 82, starter: true, captain: true, years: '1978–85',
    attrs: { speed: 7, blocking: 9, vertical: 6, routeRunning: 7, strength: 9, hands: 10, awareness: 9, size: 0, afterCatch: 7 },
  },
  {
    name: 'Bubba Franks',      short: 'Franks',       team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#5e3c22', height: 78, weight: 265, number: 89, starter: true, captain: true, years: '2000–07',
    attrs: { speed: 5, blocking: 11, vertical: 5, routeRunning: 4, strength: 10, hands: 8, awareness: 7, size: 11, afterCatch: 5 },
  },

  // ─── HOUSTON TEXANS ──────────────────────────────────────────────────────
  {
    name: 'Owen Daniels',      short: 'O. Daniels',   team: 'HOU', teamName: 'Houston Texans',
    skin: '#f0c4a0', height: 75, weight: 243, number: 81, starter: true, captain: true, years: '2006–13',
    attrs: { speed: 8, blocking: 8, vertical: 8, routeRunning: 7, strength: 9, hands: 9, awareness: 7, size: 3, afterCatch: 7 },
  },
  {
    name: 'Dalton Schultz',    short: 'Schultz',      team: 'HOU', teamName: 'Houston Texans',
    skin: '#f0c4a0', height: 77, weight: 242, number: 86, starter: true, captain: true, years: '2023–',
    attrs: { speed: 5, blocking: 7, vertical: 5, routeRunning: 7, strength: 2, hands: 8, awareness: 7, size: 4, afterCatch: 6 },
  },
  {
    name: 'Joel Dreessen',     short: 'Dreessen',     team: 'HOU', teamName: 'Houston Texans',
    skin: '#f0c4a0', height: 76, weight: 253, number: 85, starter: true, captain: true, years: '2007–11',
    attrs: { speed: 6, blocking: 8, vertical: 8, routeRunning: 7, strength: 9, hands: 7, awareness: 6, size: 6, afterCatch: 6 },
  },

  // ─── INDIANAPOLIS COLTS ──────────────────────────────────────────────────
  {
    name: 'John Mackey',       short: 'Mackey',       team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#5e3c22', height: 74, weight: 224, number: 88, starter: true, captain: true, years: '1963–71',
    attrs: { speed: 6, blocking: 9, vertical: 7, routeRunning: 6, strength: 9, hands: 11, awareness: 10, size: 0, afterCatch: 6 },
  },
  {
    name: 'Dallas Clark',      short: 'Dallas Clark', team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#f0c4a0', height: 74, weight: 252, number: 44, starter: true, captain: true, years: '2003–11',
    attrs: { speed: 8, blocking: 8, vertical: 9, routeRunning: 8, strength: 9, hands: 10, awareness: 9, size: 5, afterCatch: 8 },
  },
  {
    name: 'Marcus Pollard',    short: 'Pollard',      team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#5e3c22', height: 76, weight: 251, number: 83, starter: true, captain: true, years: '1995–04',
    attrs: { speed: 7, blocking: 8, vertical: 8, routeRunning: 7, strength: 9, hands: 8, awareness: 9, size: 6, afterCatch: 6 },
  },
  {
    name: 'Jack Doyle',        short: 'Doyle',        team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#f0c4a0', height: 78, weight: 259, number: 84, starter: true, captain: true, years: '2013–21',
    attrs: { speed: 5, blocking: 11, vertical: 4, routeRunning: 6, strength: 8, hands: 8, awareness: 9, size: 9, afterCatch: 4 },
  },

  // ─── JACKSONVILLE JAGUARS ────────────────────────────────────────────────
  {
    name: 'Marcedes Lewis',    short: 'M. Lewis',     team: 'JAX', teamName: 'Jacksonville Jaguars',
    skin: '#5e3c22', height: 78, weight: 267, number: 89, starter: true, captain: true, years: '2006–17',
    attrs: { speed: 4, blocking: 9, vertical: 9, routeRunning: 5, strength: 9, hands: 9, awareness: 7, size: 11, afterCatch: 5 },
  },
  {
    name: 'Kyle Brady',        short: 'Brady',        team: 'JAX', teamName: 'Jacksonville Jaguars',
    skin: '#f0c4a0', height: 78, weight: 262, number: 88, starter: true, captain: true, years: '2000–06',
    attrs: { speed: 5, blocking: 11, vertical: 7, routeRunning: 4, strength: 8, hands: 7, awareness: 8, size: 10, afterCatch: 4 },
  },
  {
    name: 'Pete Mitchell',     short: 'Mitchell',     team: 'JAX', teamName: 'Jacksonville Jaguars',
    skin: '#f0c4a0', height: 76, weight: 245, number: 85, starter: true, captain: true, years: '1995–98, 2002',
    attrs: { speed: 7, blocking: 8, vertical: 6, routeRunning: 3, strength: 8, hands: 6, awareness: 9, size: 4, afterCatch: 5 },
  },

  // ─── KANSAS CITY CHIEFS ──────────────────────────────────────────────────
  {
    name: 'Tony Gonzalez',     short: 'T. Gonzalez',  team: 'KC',  teamName: 'Kansas City Chiefs',
    skin: '#b07848', height: 77, weight: 247, number: 88, starter: true, captain: true, years: '1997–08',
    attrs: { speed: 7, blocking: 6, vertical: 8, routeRunning: 11, strength: 8, hands: 11, awareness: 11, size: 5, afterCatch: 9 },
  },
  {
    name: 'Travis Kelce',      short: 'Kelce',        team: 'KC',  teamName: 'Kansas City Chiefs',
    skin: '#f0c4a0', height: 77, weight: 256, number: 87, starter: true, captain: true, years: '2013–',
    attrs: { speed: 8, blocking: 7, vertical: 8, routeRunning: 11, strength: 8, hands: 10, awareness: 11, size: 8, afterCatch: 10 },
  },
  {
    name: 'Fred Arbanas',      short: 'Arbanas',      team: 'KC',  teamName: 'Kansas City Chiefs',
    skin: '#f0c4a0', height: 75, weight: 240, number: 84, starter: true, captain: true, years: '1963–70',
    attrs: { speed: 6, blocking: 10, vertical: 5, routeRunning: 3, strength: 10, hands: 8, awareness: 10, size: 2, afterCatch: 4 },
  },

  // ─── LAS VEGAS RAIDERS ───────────────────────────────────────────────────
  {
    name: 'Todd Christensen',  short: 'Christensen',  team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#f0c4a0', height: 75, weight: 230, number: 46, starter: true, captain: true, years: '1979–88',
    attrs: { speed: 7, blocking: 9, vertical: 7, routeRunning: 7, strength: 9, hands: 10, awareness: 10, size: 0, afterCatch: 8 },
  },
  {
    name: 'Dave Casper',       short: 'Casper',       team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#f0c4a0', height: 76, weight: 240, number: 87, starter: true, captain: true, years: '1974–80, 1984',
    attrs: { speed: 6, blocking: 10, vertical: 6, routeRunning: 5, strength: 10, hands: 9, awareness: 9, size: 3, afterCatch: 5 },
  },
  {
    name: 'Darren Waller',     short: 'Waller',       team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#5e3c22', height: 78, weight: 255, number: 83, starter: true, captain: true, years: '2018–22',
    attrs: { speed: 10, blocking: 5, vertical: 9, routeRunning: 9, strength: 2, hands: 9, awareness: 7, size: 8, afterCatch: 8 },
  },

  // ─── LOS ANGELES CHARGERS ────────────────────────────────────────────────
  {
    name: 'Antonio Gates',     short: 'Gates',        team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#5e3c22', height: 76, weight: 260, number: 85, starter: true, captain: true, years: '2003–18',
    attrs: { speed: 6, blocking: 6, vertical: 9, routeRunning: 10, strength: 10, hands: 11, awareness: 11, size: 8, afterCatch: 9 },
  },
  {
    name: 'Kellen Winslow',    short: 'Winslow',      team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#5e3c22', height: 77, weight: 240, number: 80, starter: true, captain: true, years: '1979–87',
    attrs: { speed: 6, blocking: 9, vertical: 8, routeRunning: 7, strength: 10, hands: 11, awareness: 9, size: 3, afterCatch: 9 },
  },
  {
    name: 'Hunter Henry',      short: 'Henry',        team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#f0c4a0', height: 77, weight: 250, number: 86, starter: true, captain: true, years: '2016–20',
    attrs: { speed: 6, blocking: 6, vertical: 7, routeRunning: 7, strength: 5, hands: 9, awareness: 8, size: 7, afterCatch: 6 },
  },

  // ─── LOS ANGELES RAMS ────────────────────────────────────────────────────
  {
    name: 'Tyler Higbee',      short: 'Higbee',       team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#f0c4a0', height: 77, weight: 243, number: 89, starter: true, captain: true, years: '2016–',
    attrs: { speed: 5, blocking: 8, vertical: 6, routeRunning: 7, strength: 7, hands: 7, awareness: 6, size: 4, afterCatch: 6 },
  },
  {
    name: 'Lance Kendricks',   short: 'Kendricks',    team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#5e3c22', height: 75, weight: 243, number: 88, starter: true, captain: true, years: '2011–16',
    attrs: { speed: 7, blocking: 8, vertical: 6, routeRunning: 5, strength: 9, hands: 7, awareness: 8, size: 3, afterCatch: 5 },
  },
  {
    name: 'Bob Klein',         short: 'B. Klein',     team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#f0c4a0', height: 76, weight: 235, number: 84, starter: true, captain: true, years: '1969–76',
    attrs: { speed: 5, blocking: 9, vertical: 6, routeRunning: 5, strength: 10, hands: 8, awareness: 9, size: 1, afterCatch: 5 },
  },

  // ─── MIAMI DOLPHINS ──────────────────────────────────────────────────────
  {
    name: 'Randy McMichael',   short: 'McMichael',    team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#5e3c22', height: 75, weight: 258, number: 81, starter: true, captain: true, years: '2002–06',
    attrs: { speed: 5, blocking: 8, vertical: 4, routeRunning: 6, strength: 7, hands: 8, awareness: 7, size: 7, afterCatch: 6 },
  },
  {
    name: 'Mike Gesicki',      short: 'Gesicki',      team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#f0c4a0', height: 78, weight: 247, number: 88, starter: true, captain: true, years: '2018–22',
    attrs: { speed: 9, blocking: 3, vertical: 10, routeRunning: 7, strength: 9, hands: 9, awareness: 9, size: 6, afterCatch: 9 },
  },
  {
    name: 'Bruce Hardy',       short: 'Hardy',        team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#f0c4a0', height: 77, weight: 231, number: 84, starter: true, captain: true, years: '1978–89',
    attrs: { speed: 6, blocking: 9, vertical: 6, routeRunning: 5, strength: 9, hands: 9, awareness: 8, size: 1, afterCatch: 5 },
  },

  // ─── MINNESOTA VIKINGS ───────────────────────────────────────────────────
  {
    name: 'Kyle Rudolph',      short: 'Rudolph',      team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#f0c4a0', height: 78, weight: 265, number: 82, starter: true, captain: true, years: '2011–20',
    attrs: { speed: 6, blocking: 7, vertical: 8, routeRunning: 8, strength: 7, hands: 9, awareness: 9, size: 11, afterCatch: 8 },
  },
  {
    name: 'Steve Jordan',      short: 'S. Jordan',    team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#5e3c22', height: 75, weight: 230, number: 84, starter: true, captain: true, years: '1982–94',
    attrs: { speed: 6, blocking: 9, vertical: 7, routeRunning: 6, strength: 9, hands: 9, awareness: 10, size: 0, afterCatch: 6 },
  },
  {
    name: 'Jim Kleinsasser',   short: 'Kleinsasser',  team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#f0c4a0', height: 75, weight: 265, number: 40, starter: true, captain: true, years: '1999–10',
    attrs: { speed: 5, blocking: 10, vertical: 4, routeRunning: 4, strength: 10, hands: 8, awareness: 9, size: 9, afterCatch: 4 },
  },

  // ─── NEW ENGLAND PATRIOTS ────────────────────────────────────────────────
  {
    name: 'Rob Gronkowski',    short: 'Gronkowski',   team: 'NE',  teamName: 'New England Patriots',
    skin: '#f0c4a0', height: 78, weight: 265, number: 87, starter: true, captain: true, years: '2010–18',
    attrs: { speed: 7, blocking: 10, vertical: 8, routeRunning: 9, strength: 9, hands: 11, awareness: 10, size: 11, afterCatch: 11 },
  },
  {
    name: 'Ben Coates',        short: 'Coates',       team: 'NE',  teamName: 'New England Patriots',
    skin: '#5e3c22', height: 77, weight: 245, number: 87, starter: true, captain: true, years: '1991–99',
    attrs: { speed: 7, blocking: 10, vertical: 7, routeRunning: 7, strength: 10, hands: 9, awareness: 9, size: 5, afterCatch: 8 },
  },
  {
    name: 'Hunter Henry',      short: 'Henry',        team: 'NE',  teamName: 'New England Patriots',
    skin: '#f0c4a0', height: 77, weight: 250, number: 85, starter: true, captain: true, years: '2021–',
    attrs: { speed: 5, blocking: 6, vertical: 6, routeRunning: 7, strength: 6, hands: 9, awareness: 8, size: 7, afterCatch: 6 },
  },

  // ─── NEW ORLEANS SAINTS ──────────────────────────────────────────────────
  {
    name: 'Jimmy Graham',      short: 'Graham',       team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#5e3c22', height: 79, weight: 265, number: 80, starter: true, captain: true, years: '2010–14',
    attrs: { speed: 10, blocking: 6, vertical: 9, routeRunning: 10, strength: 7, hands: 10, awareness: 8, size: 11, afterCatch: 10 },
  },
  {
    name: 'Hoby Brenner',      short: 'Brenner',      team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#f0c4a0', height: 76, weight: 240, number: 89, starter: true, captain: true, years: '1981–93',
    attrs: { speed: 6, blocking: 9, vertical: 5, routeRunning: 6, strength: 9, hands: 8, awareness: 9, size: 3, afterCatch: 6 },
  },
  {
    name: 'Jeremy Shockey',    short: 'Shockey',      team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#f0c4a0', height: 77, weight: 251, number: 88, starter: true, captain: true, years: '2008–09',
    attrs: { speed: 8, blocking: 7, vertical: 7, routeRunning: 7, strength: 8, hands: 9, awareness: 6, size: 6, afterCatch: 8 },
  },

  // ─── NEW YORK GIANTS ─────────────────────────────────────────────────────
  {
    name: 'Jeremy Shockey',    short: 'Shockey',      team: 'NYG', teamName: 'New York Giants',
    skin: '#f0c4a0', height: 77, weight: 251, number: 88, starter: true, captain: true, years: '2002–2007',
    attrs: { speed: 8, blocking: 7, vertical: 8, routeRunning: 8, strength: 9, hands: 10, awareness: 8, size: 6, afterCatch: 9 },
  },
  {
    name: 'Mark Bavaro',       short: 'Bavaro',       team: 'NYG', teamName: 'New York Giants',
    skin: '#f0c4a0', height: 76, weight: 245, number: 89, starter: true, captain: true, years: '1985–90',
    attrs: { speed: 6, blocking: 11, vertical: 5, routeRunning: 5, strength: 10, hands: 9, awareness: 9, size: 4, afterCatch: 4 },
  },
  {
    name: 'Bob Tucker',        short: 'B. Tucker',    team: 'NYG', teamName: 'New York Giants',
    skin: '#f0c4a0', height: 75, weight: 230, number: 44, starter: true, captain: true, years: '1968–76',
    attrs: { speed: 4, blocking: 9, vertical: 6, routeRunning: 6, strength: 10, hands: 9, awareness: 10, size: 0, afterCatch: 7 },
  },

  // ─── PHILADELPHIA EAGLES ─────────────────────────────────────────────────
  {
    name: 'Zach Ertz',         short: 'Ertz',         team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#f0c4a0', height: 77, weight: 250, number: 86, starter: true, captain: true, years: '2013–19',
    attrs: { speed: 7, blocking: 4, vertical: 5, routeRunning: 9, strength: 9, hands: 9, awareness: 7, size: 7, afterCatch: 9 },
  },
  {
    name: 'Dallas Goedert',    short: 'Goedert',      team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#f0c4a0', height: 77, weight: 256, number: 88, starter: true, captain: true, years: '2018–',
    attrs: { speed: 7, blocking: 7, vertical: 7, routeRunning: 8, strength: 8, hands: 9, awareness: 8, size: 8, afterCatch: 7 },
  },
  {
    name: 'Keith Jackson',     short: 'K. Jackson',   team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#5e3c22', height: 74, weight: 242, number: 88, starter: true, captain: true, years: '1988–91',
    attrs: { speed: 1, blocking: 7, vertical: 6, routeRunning: 5, strength: 11, hands: 8, awareness: 9, size: 2, afterCatch: 6 },
  },

  // ─── PITTSBURGH STEELERS ─────────────────────────────────────────────────
  {
    name: 'Heath Miller',      short: 'H. Miller',    team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#f0c4a0', height: 77, weight: 256, number: 83, starter: true, captain: true, years: '2005–15',
    attrs: { speed: 6, blocking: 11, vertical: 6, routeRunning: 6, strength: 10, hands: 9, awareness: 10, size: 8, afterCatch: 7 },
  },
  {
    name: 'Eric Green',        short: 'E. Green',     team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#5e3c22', height: 76, weight: 275, number: 83, starter: true, captain: true, years: '1990–94',
    attrs: { speed: 5, blocking: 11, vertical: 7, routeRunning: 6, strength: 9, hands: 9, awareness: 9, size: 11, afterCatch: 5 },
  },
  {
    name: 'Pat Freiermuth',    short: 'Freiermuth',   team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#f0c4a0', height: 77, weight: 258, number: 88, starter: true, captain: true, years: '2021–',
    attrs: { speed: 6, blocking: 9, vertical: 7, routeRunning: 8, strength: 7, hands: 7, awareness: 8, size: 8, afterCatch: 6 },
  },

  // ─── SAN FRANCISCO 49ERS ─────────────────────────────────────────────────
  {
    name: 'George Kittle',     short: 'Kittle',       team: 'SF',  teamName: 'San Francisco 49ers',
    skin: '#f0c4a0', height: 76, weight: 250, number: 85, starter: true, captain: true, years: '2017–',
    attrs: { speed: 8, blocking: 11, vertical: 7, routeRunning: 9, strength: 9, hands: 10, awareness: 11, size: 5, afterCatch: 11 },
  },
  {
    name: 'Vernon Davis',      short: 'V. Davis',     team: 'SF',  teamName: 'San Francisco 49ers',
    skin: '#5e3c22', height: 75, weight: 250, number: 85, starter: true, captain: true, years: '2006–15',
    attrs: { speed: 11, blocking: 9, vertical: 11, routeRunning: 9, strength: 9, hands: 10, awareness: 11, size: 5, afterCatch: 11 },
  },
  {
    name: 'Brent Jones',       short: 'B. Jones',     team: 'SF',  teamName: 'San Francisco 49ers',
    skin: '#f0c4a0', height: 76, weight: 230, number: 86, starter: true, captain: true, years: '1987–97',
    attrs: { speed: 6, blocking: 11, vertical: 7, routeRunning: 6, strength: 7, hands: 9, awareness: 10, size: 0, afterCatch: 6 },
  },

  // ─── SEATTLE SEAHAWKS ────────────────────────────────────────────────────
  {
    name: 'Jimmy Graham',      short: 'Graham',       team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#5e3c22', height: 79, weight: 265, number: 80, starter: true, captain: true, years: '2015–17',
    attrs: { speed: 9, blocking: 6, vertical: 9, routeRunning: 10, strength: 7, hands: 9, awareness: 7, size: 11, afterCatch: 9 },
  },
  {
    name: 'Itula Mili',        short: 'Mili',         team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#b07848', height: 76, weight: 260, number: 85, starter: true, captain: true, years: '1998–06',
    attrs: { speed: 9, blocking: 10, vertical: 8, routeRunning: 6, strength: 6, hands: 8, awareness: 6, size: 8, afterCatch: 7 },
  },
  {
    name: 'Will Dissly',       short: 'Dissly',       team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#f0c4a0', height: 76, weight: 267, number: 88, starter: true, captain: true, years: '2018–23',
    attrs: { speed: 5, blocking: 9, vertical: 4, routeRunning: 5, strength: 4, hands: 9, awareness: 5, size: 10, afterCatch: 6 },
  },

  // ─── TAMPA BAY BUCCANEERS ────────────────────────────────────────────────
  {
    name: 'Jimmie Giles',      short: 'Giles',        team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#5e3c22', height: 75, weight: 233, number: 88, starter: true, captain: true, years: '1978–86',
    attrs: { speed: 8, blocking: 11, vertical: 8, routeRunning: 8, strength: 9, hands: 9, awareness: 10, size: 0, afterCatch: 7 },
  },
  {
    name: 'Cameron Brate',     short: 'Brate',        team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#f0c4a0', height: 77, weight: 247, number: 84, starter: true, captain: true, years: '2014–22',
    attrs: { speed: 6, blocking: 4, vertical: 6, routeRunning: 7, strength: 8, hands: 8, awareness: 8, size: 5, afterCatch: 6 },
  },
  {
    name: 'Kellen Winslow Jr.', short: 'Winslow Jr.', team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#5e3c22', height: 76, weight: 252, number: 82, starter: true, captain: true, years: '2009–11',
    attrs: { speed: 9, blocking: 5, vertical: 8, routeRunning: 9, strength: 9, hands: 9, awareness: 7, size: 6, afterCatch: 7 },
  },

  // ─── TENNESSEE TITANS ────────────────────────────────────────────────────
  {
    name: 'Delanie Walker',    short: 'D. Walker',    team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#5e3c22', height: 75, weight: 248, number: 82, starter: true, captain: true, years: '2013–19',
    attrs: { speed: 10, blocking: 10, vertical: 8, routeRunning: 9, strength: 7, hands: 9, awareness: 8, size: 4, afterCatch: 8 },
  },
  {
    name: 'Frank Wycheck',     short: 'Wycheck',      team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#f0c4a0', height: 75, weight: 248, number: 82, starter: true, captain: true, years: '1995–03',
    attrs: { speed: 4, blocking: 10, vertical: 5, routeRunning: 6, strength: 7, hands: 9, awareness: 9, size: 4, afterCatch: 4 },
  },
  {
    name: 'Bo Scaife',         short: 'Scaife',       team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#5e3c22', height: 76, weight: 253, number: 80, starter: true, captain: true, years: '2005–10',
    attrs: { speed: 6, blocking: 8, vertical: 5, routeRunning: 6, strength: 9, hands: 7, awareness: 7, size: 6, afterCatch: 3 },
  },

  // ─── WASHINGTON COMMANDERS ───────────────────────────────────────────────
  {
    name: 'Chris Cooley',      short: 'Cooley',       team: 'WAS', teamName: 'Washington Commanders',
    skin: '#f0c4a0', height: 75, weight: 245, number: 47, starter: true, captain: true, years: '2004–12',
    attrs: { speed: 5, blocking: 4, vertical: 6, routeRunning: 7, strength: 9, hands: 9, awareness: 8, size: 3, afterCatch: 5 },
  },
  {
    name: 'Jordan Reed',       short: 'J. Reed',      team: 'WAS', teamName: 'Washington Commanders',
    skin: '#5e3c22', height: 74, weight: 236, number: 86, starter: true, captain: true, years: '2013–2018',
    attrs: { speed: 6, blocking: 4, vertical: 4, routeRunning: 8, strength: 5, hands: 9, awareness: 6, size: 0, afterCatch: 9 },
  },
  {
    name: 'Jerry Smith',       short: 'Jerry Smith',  team: 'WAS', teamName: 'Washington Commanders',
    skin: '#f0c4a0', height: 76, weight: 215, number: 87, starter: true, captain: true, years: '1965–77',
    attrs: { speed: 7, blocking: 9, vertical: 6, routeRunning: 7, strength: 9, hands: 10, awareness: 8, size: 0, afterCatch: 6 },
  },

]

export const TE_LEGENDS = _raw.map(p => ({
  ...p,
  ovr:    _teOVR(p.attrs),
  color:  TEAM_COLOR[p.team]?.color  ?? '#888888',
  color2: TEAM_COLOR[p.team]?.color2 ?? '#ffffff',
}))

export const TE_LEGEND_TYPES = ['speed', 'blocking', 'vertical', 'routeRunning', 'strength', 'hands', 'awareness', 'size', 'afterCatch']
