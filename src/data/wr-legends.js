// All-Time WR Legends — 4–5 per franchise, post-2000 weighted higher
// Attrs (1–11): speed, bodyControl, vertical, routeRunning, release, hands, awareness, size, afterCatch
// Calibration: Jerry Rice hands/routeRunning/awareness=11 · Randy Moss speed/vertical=11
//   Calvin Johnson vertical/size=11 · Tyreek Hill speed=11 · Antonio Brown routeRunning/release=11
// Size: 75% height + 25% weight, 0–11. Anchor: 66"/155lb≈0 · Mike Evans 77"/231lb≈11
// Skin: #f0c4a0 white · #b07848 mixed · #7a5030 medium brown · #5e3c22 Black · #3a2010 very dark

import { TEAMS } from './qbs'

const TEAM_COLOR = Object.fromEntries(TEAMS.map(t => [t.short, { color: t.color, color2: t.color2 }]))

const _WR_W = { hands:0.14, routeRunning:0.14, speed:0.14, size:0.14, awareness:0.10, afterCatch:0.10, bodyControl:0.08, vertical:0.08, release:0.08 }
const _WR_T = ['speed','bodyControl','vertical','routeRunning','release','hands','awareness','size','afterCatch']
function _wrOVR(a) {
  const vals   = _WR_T.map(t => a[t] ?? 0)
  const avg    = _WR_T.reduce((s, t) => s + (a[t] ?? 0) * _WR_W[t], 0)
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
    name: 'Larry Fitzgerald',  short: 'Fitzgerald',    team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#5e3c22', height: 75, weight: 218, number: 11, starter: true, captain: true, years: '2004–20',
    attrs: { speed: 7, bodyControl: 11, vertical: 8, routeRunning: 10, release: 9, hands: 11, awareness: 11, size: 9, afterCatch: 9 },
  },
  {
    name: 'Anquan Boldin',     short: 'Boldin',        team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#5e3c22', height: 73, weight: 220, number: 81, starter: true, captain: true, years: '2003–09',
    attrs: { speed: 7, bodyControl: 9, vertical: 8, routeRunning: 8, release: 7, hands: 9, awareness: 9, size: 8, afterCatch: 10 },
  },
  {
    name: 'DeAndre Hopkins',   short: 'D. Hopkins',    team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#5e3c22', height: 73, weight: 212, number: 10, starter: true, captain: true, years: '2020–22',
    attrs: { speed: 8, bodyControl: 11, vertical: 10, routeRunning: 8, release: 9, hands: 11, awareness: 10, size: 8, afterCatch: 9 },
  },
  {
    name: 'Roy Green',         short: 'R. Green',      team: 'ARI', teamName: 'Arizona Cardinals',
    skin: '#5e3c22', height: 72, weight: 195, number: 81, starter: true, captain: true, years: '1979–90',
    attrs: { speed: 9, bodyControl: 8, vertical: 9, routeRunning: 7, release: 7, hands: 8, awareness: 8, size: 6, afterCatch: 8 },
  },

  // ─── ATLANTA FALCONS ─────────────────────────────────────────────────────
  {
    name: 'Julio Jones',       short: 'J. Jones',      team: 'ATL', teamName: 'Atlanta Falcons',
    skin: '#5e3c22', height: 75, weight: 220, number: 11, starter: true, captain: true, years: '2011–20',
    attrs: { speed: 9, bodyControl: 11, vertical: 10, routeRunning: 9, release: 10, hands: 10, awareness: 9, size: 10, afterCatch: 8 },
  },
  {
    name: 'Roddy White',       short: 'R. White',      team: 'ATL', teamName: 'Atlanta Falcons',
    skin: '#5e3c22', height: 72, weight: 211, number: 84, starter: true, captain: true, years: '2005–15',
    attrs: { speed: 8, bodyControl: 8, vertical: 8, routeRunning: 8, release: 7, hands: 9, awareness: 8, size: 7, afterCatch: 8 },
  },
  {
    name: 'Andre Rison',       short: 'A. Rison',      team: 'ATL', teamName: 'Atlanta Falcons',
    skin: '#5e3c22', height: 72, weight: 188, number: 80, starter: true, captain: true, years: '1990–94',
    attrs: { speed: 9, bodyControl: 8, vertical: 8, routeRunning: 7, release: 8, hands: 8, awareness: 8, size: 6, afterCatch: 8 },
  },

  // ─── BALTIMORE RAVENS ────────────────────────────────────────────────────
  {
    name: 'Anquan Boldin',     short: 'Boldin',        team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#5e3c22', height: 73, weight: 220, number: 81, starter: true, captain: true, years: '2010–12',
    attrs: { speed: 7, bodyControl: 9, vertical: 8, routeRunning: 8, release: 7, hands: 9, awareness: 9, size: 8, afterCatch: 10 },
  },
  {
    name: 'Derrick Mason',     short: 'D. Mason',      team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#5e3c22', height: 70, weight: 191, number: 85, starter: true, captain: true, years: '2005–10',
    attrs: { speed: 8, bodyControl: 8, vertical: 7, routeRunning: 8, release: 8, hands: 8, awareness: 8, size: 5, afterCatch: 8 },
  },
  {
    name: 'Torrey Smith',      short: 'T. Smith',      team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#3a2010', height: 71, weight: 205, number: 82, starter: true, captain: true, years: '2011–14',
    attrs: { speed: 10, bodyControl: 6, vertical: 9, routeRunning: 6, release: 7, hands: 7, awareness: 7, size: 7, afterCatch: 7 },
  },
  {
    name: 'Steve Smith Sr.',   short: 'S. Smith',      team: 'BAL', teamName: 'Baltimore Ravens',
    skin: '#7a5030', height: 69, weight: 185, number: 89, starter: true, captain: true, years: '2014–16',
    attrs: { speed: 9, bodyControl: 10, vertical: 7, routeRunning: 9, release: 11, hands: 9, awareness: 9, size: 3, afterCatch: 9 },
  },

  // ─── BUFFALO BILLS ───────────────────────────────────────────────────────
  {
    name: 'Andre Reed',        short: 'A. Reed',       team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#5e3c22', height: 72, weight: 190, number: 83, starter: true, captain: true, years: '1985–00',
    attrs: { speed: 7, bodyControl: 9, vertical: 8, routeRunning: 9, release: 8, hands: 10, awareness: 9, size: 6, afterCatch: 9 },
  },
  {
    name: 'Stefon Diggs',      short: 'S. Diggs',      team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#5e3c22', height: 72, weight: 191, number: 14, starter: true, captain: true, years: '2020–23',
    attrs: { speed: 8, bodyControl: 9, vertical: 8, routeRunning: 9, release: 9, hands: 8, awareness: 9, size: 6, afterCatch: 9 },
  },
  {
    name: 'Eric Moulds',       short: 'Moulds',        team: 'BUF', teamName: 'Buffalo Bills',
    skin: '#5e3c22', height: 72, weight: 210, number: 80, starter: true, captain: true, years: '1996–05',
    attrs: { speed: 8, bodyControl: 7, vertical: 8, routeRunning: 7, release: 7, hands: 8, awareness: 7, size: 7, afterCatch: 8 },
  },


  // ─── CAROLINA PANTHERS ───────────────────────────────────────────────────
  {
    name: 'Steve Smith Sr.',   short: 'S. Smith',      team: 'CAR', teamName: 'Carolina Panthers',
    skin: '#7a5030', height: 69, weight: 185, number: 89, starter: true, captain: true, years: '1999–13',
    attrs: { speed: 9, bodyControl: 10, vertical: 9, routeRunning: 10, release: 11, hands: 9, awareness: 9, size: 3, afterCatch: 10 },
  },
  {
    name: 'Muhsin Muhammad',   short: 'Muhammad',      team: 'CAR', teamName: 'Carolina Panthers',
    skin: '#5e3c22', height: 74, weight: 215, number: 87, starter: true, captain: true, years: '1996–04',
    attrs: { speed: 8, bodyControl: 8, vertical: 8, routeRunning: 8, release: 7, hands: 8, awareness: 8, size: 9, afterCatch: 7 },
  },
  {
    name: 'DJ Moore',          short: 'DJ Moore',      team: 'CAR', teamName: 'Carolina Panthers',
    skin: '#3a2010', height: 72, weight: 210, number: 2, starter: true, captain: true, years: '2018–22',
    attrs: { speed: 8, bodyControl: 9, vertical: 8, routeRunning: 7, release: 6, hands: 7, awareness: 8, size: 6, afterCatch: 9 },
  },

  // ─── CHICAGO BEARS ───────────────────────────────────────────────────────
  {
    name: 'Brandon Marshall', short: 'Marshall',       team: 'CHI', teamName: 'Chicago Bears',
    skin: '#5e3c22', height: 76, weight: 230, number: 15, starter: true, captain: true, years: '2012–14',
    attrs: { speed: 7, bodyControl: 9, vertical: 9, routeRunning: 7, release: 8, hands: 9, awareness: 9, size: 11, afterCatch: 9 },
  },
  {
    name: 'Alshon Jeffery',    short: 'A. Jeffery',    team: 'CHI', teamName: 'Chicago Bears',
    skin: '#5e3c22', height: 75, weight: 218, number: 17, starter: true, captain: true, years: '2012–16',
    attrs: { speed: 7, bodyControl: 9, vertical: 9, routeRunning: 6, release: 7, hands: 9, awareness: 8, size: 9, afterCatch: 6 },
  },
  {
    name: 'Willie Gault',      short: 'Gault',         team: 'CHI', teamName: 'Chicago Bears',
    skin: '#5e3c22', height: 72, weight: 176, number: 83, starter: true, captain: true, years: '1983–87',
    attrs: { speed: 10, bodyControl: 6, vertical: 7, routeRunning: 5, release: 6, hands: 6, awareness: 6, size: 5, afterCatch: 7 },
  },
  {
    name: 'Allen Robinson',    short: 'A. Robinson',   team: 'CHI', teamName: 'Chicago Bears',
    skin: '#5e3c22', height: 74, weight: 220, number: 12, starter: true, captain: true, years: '2018–21',
    attrs: { speed: 8, bodyControl: 9, vertical: 8, routeRunning: 7, release: 7, hands: 9, awareness: 9, size: 9, afterCatch: 5 },
  },

  // ─── CINCINNATI BENGALS ──────────────────────────────────────────────────
  {
    name: 'Chad Ochocinco',    short: 'Ochocinco',     team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#5e3c22', height: 73, weight: 192, number: 85, starter: true, captain: true, years: '2001–10',
    attrs: { speed: 9, bodyControl: 10, vertical: 9, routeRunning: 10, release: 10, hands: 8, awareness: 9, size: 7, afterCatch: 9 },
  },
  {
    name: 'A.J. Green',        short: 'A.J. Green',    team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#3a2010', height: 76, weight: 207, number: 18, starter: true, captain: true, years: '2011–18',
    attrs: { speed: 9, bodyControl: 9, vertical: 10, routeRunning: 8, release: 9, hands: 9, awareness: 9, size: 9, afterCatch: 9 },
  },
  {
    name: 'Chris Collinsworth', short: 'Collinsworth', team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#f0c4a0', height: 74, weight: 192, number: 80, starter: true, captain: true, years: '1981–88',
    attrs: { speed: 8, bodyControl: 8, vertical: 7, routeRunning: 9, release: 8, hands: 8, awareness: 9, size: 6, afterCatch: 8 },
  },
  {
    name: "Ja'Marr Chase",     short: 'Chase',         team: 'CIN', teamName: 'Cincinnati Bengals',
    skin: '#5e3c22', height: 72, weight: 201, number: 1, starter: true, captain: true, years: '2021–',
    attrs: { speed: 10, bodyControl: 9, vertical: 10, routeRunning: 9, release: 10, hands: 10, awareness: 8, size: 6, afterCatch: 10 },
  },

  // ─── CLEVELAND BROWNS ────────────────────────────────────────────────────
  {
    name: 'Josh Gordon',       short: 'J. Gordon',     team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#5e3c22', height: 75, weight: 225, number: 12, starter: true, captain: true, years: '2012–18',
    attrs: { speed: 9, bodyControl: 8, vertical: 9, routeRunning: 6, release: 7, hands: 8, awareness: 5, size: 10, afterCatch: 8 },
  },
  {
    name: 'Paul Warfield',     short: 'P. Warfield',   team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#5e3c22', height: 72, weight: 185, number: 42, starter: true, captain: true, years: '1964–69',
    attrs: { speed: 10, bodyControl: 8, vertical: 7, routeRunning: 7, release: 6, hands: 9, awareness: 8, size: 6, afterCatch: 7 },
  },
  {
    name: 'Jarvis Landry',     short: 'J. Landry',     team: 'CLE', teamName: 'Cleveland Browns',
    skin: '#5e3c22', height: 71, weight: 205, number: 80, starter: true, captain: true, years: '2018–21',
    attrs: { speed: 4, bodyControl: 9, vertical: 5, routeRunning: 9, release: 6, hands: 10, awareness: 9, size: 7, afterCatch: 9 },
  },

  // ─── DALLAS COWBOYS ──────────────────────────────────────────────────────
  {
    name: 'Michael Irvin',     short: 'M. Irvin',      team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#5e3c22', height: 75, weight: 207, number: 88, starter: true, captain: true, years: '1988–99',
    attrs: { speed: 8, bodyControl: 9, vertical: 8, routeRunning: 8, release: 9, hands: 9, awareness: 9, size: 9, afterCatch: 9 },
  },
  {
    name: 'Dez Bryant',        short: 'D. Bryant',     team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#3a2010', height: 74, weight: 220, number: 88, starter: true, captain: true, years: '2010–17',
    attrs: { speed: 8, bodyControl: 10, vertical: 10, routeRunning: 8, release: 7, hands: 9, awareness: 8, size: 9, afterCatch: 8 },
  },
  {
    name: 'CeeDee Lamb',       short: 'CeeDee Lamb',   team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#5e3c22', height: 74, weight: 198, number: 88, starter: true, captain: true, years: '2020–',
    attrs: { speed: 7, bodyControl: 11, vertical: 9, routeRunning: 8, release: 10, hands: 8, awareness: 9, size: 8, afterCatch: 9 },
  },
  {
    name: 'Bob Hayes',         short: 'B. Hayes',      team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#5e3c22', height: 71, weight: 185, number: 22, starter: true, captain: true, years: '1965–74',
    attrs: { speed: 10, bodyControl: 6, vertical: 9, routeRunning: 6, release: 6, hands: 7, awareness: 7, size: 5, afterCatch: 8 },
  },
  {
    name: 'Terrell Owens',     short: 'T.O. Dallas',   team: 'DAL', teamName: 'Dallas Cowboys',
    skin: '#5e3c22', height: 75, weight: 226, number: 81, starter: true, captain: true, years: '2006–08',
    attrs: { speed: 9, bodyControl: 9, vertical: 10, routeRunning: 8, release: 7, hands: 9, awareness: 8, size: 10, afterCatch: 10 },
  },

  // ─── DENVER BRONCOS ──────────────────────────────────────────────────────
  {
    name: 'Demaryius Thomas',  short: 'D. Thomas',     team: 'DEN', teamName: 'Denver Broncos',
    skin: '#5e3c22', height: 75, weight: 229, number: 88, starter: true, captain: true, years: '2010–18',
    attrs: { speed: 9, bodyControl: 9, vertical: 8, routeRunning: 8, release: 7, hands: 9, awareness: 8, size: 10, afterCatch: 9 },
  },
  {
    name: 'Rod Smith',         short: 'Rod Smith',     team: 'DEN', teamName: 'Denver Broncos',
    skin: '#5e3c22', height: 73, weight: 200, number: 80, starter: true, captain: true, years: '1995–06',
    attrs: { speed: 8, bodyControl: 8, vertical: 7, routeRunning: 8, release: 7, hands: 8, awareness: 9, size: 7, afterCatch: 7 },
  },
  {
    name: 'Emmanuel Sanders',  short: 'E. Sanders',    team: 'DEN', teamName: 'Denver Broncos',
    skin: '#5e3c22', height: 71, weight: 180, number: 10, starter: true, captain: true, years: '2014–18',
    attrs: { speed: 8, bodyControl: 8, vertical: 7, routeRunning: 8, release: 8, hands: 8, awareness: 8, size: 4, afterCatch: 8 },
  },
  {
    name: 'Ed McCaffrey',      short: 'McCaffrey',     team: 'DEN', teamName: 'Denver Broncos',
    skin: '#f0c4a0', height: 76, weight: 215, number: 87, starter: true, captain: true, years: '1995–03',
    attrs: { speed: 5, bodyControl: 7, vertical: 6, routeRunning: 7, release: 7, hands: 8, awareness: 8, size: 10, afterCatch: 6 },
  },

  // ─── DETROIT LIONS ───────────────────────────────────────────────────────
  {
    name: 'Calvin Johnson',    short: 'C. Johnson',    team: 'DET', teamName: 'Detroit Lions',
    skin: '#5e3c22', height: 77, weight: 236, number: 81, starter: true, captain: true, years: '2007–15',
    attrs: { speed: 9, bodyControl: 10, vertical: 11, routeRunning: 7, release: 10, hands: 11, awareness: 9, size: 11, afterCatch: 9 },
  },
  {
    name: 'Herman Moore',      short: 'H. Moore',      team: 'DET', teamName: 'Detroit Lions',
    skin: '#5e3c22', height: 74, weight: 210, number: 84, starter: true, captain: true, years: '1991–01',
    attrs: { speed: 8, bodyControl: 8, vertical: 9, routeRunning: 8, release: 7, hands: 9, awareness: 8, size: 9, afterCatch: 8 },
  },
  {
    name: 'Amon-Ra St. Brown', short: 'ARSB',          team: 'DET', teamName: 'Detroit Lions',
    skin: '#b07848', height: 72, weight: 200, number: 14, starter: true, captain: true, years: '2021–',
    attrs: { speed: 8, bodyControl: 10, vertical: 7, routeRunning: 9, release: 9, hands: 8, awareness: 10, size: 6, afterCatch: 7 },
  },
  {
    name: 'Roy Williams',      short: 'R. Williams',   team: 'DET', teamName: 'Detroit Lions',
    skin: '#5e3c22', height: 74, weight: 220, number: 11, starter: true, captain: true, years: '2004–08',
    attrs: { speed: 7, bodyControl: 8, vertical: 8, routeRunning: 7, release: 6, hands: 7, awareness: 7, size: 9, afterCatch: 7 },
  },

  // ─── GREEN BAY PACKERS ───────────────────────────────────────────────────
  {
    name: 'Davante Adams',     short: 'D. Adams',      team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#5e3c22', height: 73, weight: 215, number: 17, starter: true, captain: true, years: '2014–21',
    attrs: { speed: 8, bodyControl: 10, vertical: 7, routeRunning: 11, release: 10, hands: 9, awareness: 10, size: 7, afterCatch: 9 },
  },
  {
    name: 'Sterling Sharpe',   short: 'S. Sharpe',     team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#5e3c22', height: 72, weight: 202, number: 84, starter: true, captain: true, years: '1988–94',
    attrs: { speed: 9, bodyControl: 9, vertical: 8, routeRunning: 9, release: 9, hands: 10, awareness: 9, size: 7, afterCatch: 9 },
  },
  {
    name: 'Jordy Nelson',      short: 'J. Nelson',     team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#f0c4a0', height: 74, weight: 217, number: 87, starter: true, captain: true, years: '2008–17',
    attrs: { speed: 9, bodyControl: 8, vertical: 7, routeRunning: 8, release: 8, hands: 9, awareness: 8, size: 9, afterCatch: 8 },
  },
  {
    name: 'James Lofton',      short: 'J. Lofton',     team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#5e3c22', height: 74, weight: 192, number: 80, starter: true, captain: true, years: '1978–86',
    attrs: { speed: 10, bodyControl: 8, vertical: 9, routeRunning: 7, release: 8, hands: 8, awareness: 8, size: 6, afterCatch: 8 },
  },
  {
    name: 'Donald Driver',     short: 'D. Driver',     team: 'GB',  teamName: 'Green Bay Packers',
    skin: '#5e3c22', height: 71, weight: 188, number: 80, starter: true, captain: true, years: '1999–12',
    attrs: { speed: 9, bodyControl: 8, vertical: 8, routeRunning: 8, release: 8, hands: 9, awareness: 8, size: 5, afterCatch: 8 },
  },

  // ─── HOUSTON TEXANS ──────────────────────────────────────────────────────
  {
    name: 'Andre Johnson',     short: 'A. Johnson',    team: 'HOU', teamName: 'Houston Texans',
    skin: '#5e3c22', height: 75, weight: 230, number: 80, starter: true, captain: true, years: '2003–14',
    attrs: { speed: 8, bodyControl: 7, vertical: 9, routeRunning: 6, release: 10, hands: 10, awareness: 9, size: 11, afterCatch: 8 },
  },
  {
    name: 'DeAndre Hopkins',   short: 'D. Hopkins',    team: 'HOU', teamName: 'Houston Texans',
    skin: '#5e3c22', height: 73, weight: 212, number: 10, starter: true, captain: true, years: '2013–19',
    attrs: { speed: 7, bodyControl: 11, vertical: 11, routeRunning: 8, release: 9, hands: 11, awareness: 10, size: 8, afterCatch: 9 },
  },
  {
    name: 'Brandin Cooks',     short: 'Cooks HOU',     team: 'HOU', teamName: 'Houston Texans',
    skin: '#5e3c22', height: 70, weight: 183, number: 13, starter: true, captain: true, years: '2020–22',
    attrs: { speed: 10, bodyControl: 7, vertical: 8, routeRunning: 8, release: 9, hands: 8, awareness: 8, size: 4, afterCatch: 8 },
  },

  // ─── INDIANAPOLIS COLTS ──────────────────────────────────────────────────
  {
    name: 'Marvin Harrison',   short: 'M. Harrison',   team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#5e3c22', height: 72, weight: 175, number: 88, starter: true, captain: true, years: '1996–08',
    attrs: { speed: 9, bodyControl: 9, vertical: 8, routeRunning: 10, release: 11, hands: 10, awareness: 10, size: 5, afterCatch: 8 },
  },
  {
    name: 'Reggie Wayne',      short: 'R. Wayne',      team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#5e3c22', height: 71, weight: 198, number: 87, starter: true, captain: true, years: '2001–14',
    attrs: { speed: 8, bodyControl: 9, vertical: 8, routeRunning: 9, release: 9, hands: 9, awareness: 9, size: 5, afterCatch: 8 },
  },
  {
    name: 'Raymond Berry',     short: 'R. Berry',      team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#f0c4a0', height: 73, weight: 187, number: 82, starter: true, captain: true, years: '1955–67',
    attrs: { speed: 5, bodyControl: 9, vertical: 7, routeRunning: 7, release: 8, hands: 9, awareness: 10, size: 5, afterCatch: 6 },
  },
  {
    name: 'T.Y. Hilton',       short: 'T.Y. Hilton',   team: 'IND', teamName: 'Indianapolis Colts',
    skin: '#5e3c22', height: 70, weight: 178, number: 13, starter: true, captain: true, years: '2012–21',
    attrs: { speed: 9, bodyControl: 9, vertical: 6, routeRunning: 8, release: 6, hands: 7, awareness: 8, size: 4, afterCatch: 8 },
  },

  // ─── JACKSONVILLE JAGUARS ────────────────────────────────────────────────
  {
    name: 'Jimmy Smith',       short: 'Jimmy Smith',   team: 'JAX', teamName: 'Jacksonville Jaguars',
    skin: '#5e3c22', height: 73, weight: 208, number: 82, starter: true, captain: true, years: '1995–05',
    attrs: { speed: 8, bodyControl: 9, vertical: 8, routeRunning: 9, release: 8, hands: 9, awareness: 9, size: 8, afterCatch: 8 },
  },
  {
    name: 'Keenan McCardell',  short: 'McCardell',     team: 'JAX', teamName: 'Jacksonville Jaguars',
    skin: '#5e3c22', height: 72, weight: 191, number: 87, starter: true, captain: true, years: '1996–01',
    attrs: { speed: 7, bodyControl: 8, vertical: 7, routeRunning: 7, release: 7, hands: 9, awareness: 8, size: 6, afterCatch: 7 },
  },
  {
    name: 'Allen Robinson',    short: 'A. Rob JAX',    team: 'JAX', teamName: 'Jacksonville Jaguars',
    skin: '#5e3c22', height: 74, weight: 220, number: 15, starter: true, captain: true, years: '2013–16',
    attrs: { speed: 7, bodyControl: 9, vertical: 9, routeRunning: 7, release: 8, hands: 9, awareness: 9, size: 8, afterCatch: 5 },
  },

  // ─── KANSAS CITY CHIEFS ──────────────────────────────────────────────────
  {
    name: 'Tyreek Hill',       short: 'T. Hill',       team: 'KC',  teamName: 'Kansas City Chiefs',
    skin: '#5e3c22', height: 70, weight: 185, number: 10, starter: true, captain: true, years: '2016–21',
    attrs: { speed: 11, bodyControl: 10, vertical: 6, routeRunning: 10, release: 9, hands: 7, awareness: 8, size: 4, afterCatch: 11 },
  },
  {
    name: 'Otis Taylor',       short: 'O. Taylor',     team: 'KC',  teamName: 'Kansas City Chiefs',
    skin: '#5e3c22', height: 74, weight: 215, number: 89, starter: true, captain: true, years: '1965–75',
    attrs: { speed: 9, bodyControl: 8, vertical: 9, routeRunning: 7, release: 7, hands: 8, awareness: 8, size: 9, afterCatch: 8 },
  },
  {
    name: 'Dwayne Bowe',       short: 'D. Bowe',       team: 'KC',  teamName: 'Kansas City Chiefs',
    skin: '#5e3c22', height: 74, weight: 221, number: 82, starter: true, captain: true, years: '2007–15',
    attrs: { speed: 7, bodyControl: 8, vertical: 8, routeRunning: 7, release: 6, hands: 8, awareness: 7, size: 9, afterCatch: 7 },
  },


  // ─── LAS VEGAS RAIDERS ───────────────────────────────────────────────────
  {
    name: 'Tim Brown',         short: 'T. Brown',      team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#5e3c22', height: 71, weight: 195, number: 81, starter: true, captain: true, years: '1988–03',
    attrs: { speed: 9, bodyControl: 9, vertical: 8, routeRunning: 8, release: 9, hands: 9, awareness: 9, size: 5, afterCatch: 8 },
  },
  {
    name: 'Cliff Branch',      short: 'C. Branch',     team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#5e3c22', height: 71, weight: 170, number: 21, starter: true, captain: true, years: '1972–85',
    attrs: { speed: 10, bodyControl: 7, vertical: 9, routeRunning: 7, release: 8, hands: 8, awareness: 8, size: 3, afterCatch: 8 },
  },
  {
    name: 'Fred Biletnikoff',  short: 'Biletnikoff',   team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#f0c4a0', height: 72, weight: 190, number: 25, starter: true, captain: true, years: '1965–78',
    attrs: { speed: 6, bodyControl: 8, vertical: 7, routeRunning: 9, release: 8, hands: 10, awareness: 10, size: 6, afterCatch: 6 },
  },
  {
    name: 'Amari Cooper',      short: 'A. Cooper',     team: 'LV',  teamName: 'Las Vegas Raiders',
    skin: '#5e3c22', height: 73, weight: 210, number: 89, starter: true, captain: true, years: '2015–19',
    attrs: { speed: 8, bodyControl: 9, vertical: 8, routeRunning: 10, release: 9, hands: 8, awareness: 9, size: 8, afterCatch: 8 },
  },

  // ─── LOS ANGELES CHARGERS ────────────────────────────────────────────────
  {
    name: 'Lance Alworth',     short: 'Alworth',       team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#f0c4a0', height: 72, weight: 184, number: 19, starter: true, captain: true, years: '1962–70',
    attrs: { speed: 9, bodyControl: 9, vertical: 9, routeRunning: 8, release: 8, hands: 10, awareness: 9, size: 6, afterCatch: 7 },
  },
  {
    name: 'Keenan Allen',      short: 'K. Allen',      team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#5e3c22', height: 74, weight: 211, number: 13, starter: true, captain: true, years: '2013–23',
    attrs: { speed: 6, bodyControl: 9, vertical: 7, routeRunning: 11, release: 9, hands: 10, awareness: 10, size: 8, afterCatch: 8 },
  },
  {
    name: 'Charlie Joiner',    short: 'C. Joiner',     team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#5e3c22', height: 71, weight: 185, number: 18, starter: true, captain: true, years: '1976–86',
    attrs: { speed: 8, bodyControl: 8, vertical: 7, routeRunning: 7, release: 8, hands: 9, awareness: 9, size: 5, afterCatch: 6 },
  },
  {
    name: 'Vincent Jackson',   short: 'V. Jackson',    team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#5e3c22', height: 76, weight: 230, number: 83, starter: true, captain: true, years: '2005–11',
    attrs: { speed: 8, bodyControl: 8, vertical: 9, routeRunning: 8, release: 7, hands: 8, awareness: 8, size: 11, afterCatch: 8 },
  },
  {
    name: 'Wes Chandler',      short: 'W. Chandler',   team: 'LAC', teamName: 'Los Angeles Chargers',
    skin: '#f0c4a0', height: 71, weight: 183, number: 85, starter: true, captain: true, years: '1981–87',
    attrs: { speed: 9, bodyControl: 8, vertical: 7, routeRunning: 8, release: 8, hands: 8, awareness: 8, size: 5, afterCatch: 8 },
  },

  // ─── LOS ANGELES RAMS ────────────────────────────────────────────────────
  {
    name: 'Isaac Bruce',       short: 'I. Bruce',      team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#5e3c22', height: 72, weight: 188, number: 80, starter: true, captain: true, years: '1994–07',
    attrs: { speed: 9, bodyControl: 9, vertical: 8, routeRunning: 9, release: 9, hands: 9, awareness: 9, size: 5, afterCatch: 8 },
  },
  {
    name: 'Torry Holt',        short: 'T. Holt',       team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#5e3c22', height: 72, weight: 190, number: 88, starter: true, captain: true, years: '1999–08',
    attrs: { speed: 9, bodyControl: 9, vertical: 8, routeRunning: 10, release: 9, hands: 9, awareness: 9, size: 6, afterCatch: 8 },
  },
  {
    name: 'Cooper Kupp',       short: 'C. Kupp',       team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#f0c4a0', height: 74, weight: 208, number: 10, starter: true, captain: true, years: '2017–',
    attrs: { speed: 8, bodyControl: 9, vertical: 6, routeRunning: 11, release: 9, hands: 9, awareness: 10, size: 8, afterCatch: 10 },
  },
  {
    name: 'Robert Woods',      short: 'R. Woods',      team: 'LAR', teamName: 'Los Angeles Rams',
    skin: '#5e3c22', height: 72, weight: 191, number: 17, starter: true, captain: true, years: '2017–21',
    attrs: { speed: 7, bodyControl: 8, vertical: 7, routeRunning: 7, release: 6, hands: 8, awareness: 8, size: 5, afterCatch: 8 },
  },

  // ─── MIAMI DOLPHINS ──────────────────────────────────────────────────────
  {
    name: 'Mark Duper',        short: 'M. Duper',      team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#5e3c22', height: 69, weight: 185, number: 85, starter: true, captain: true, years: '1982–92',
    attrs: { speed: 10, bodyControl: 7, vertical: 9, routeRunning: 8, release: 8, hands: 8, awareness: 8, size: 4, afterCatch: 8 },
  },
  {
    name: 'Mark Clayton',      short: 'M. Clayton',    team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#3a2010', height: 69, weight: 175, number: 83, starter: true, captain: true, years: '1983–92',
    attrs: { speed: 6, bodyControl: 8, vertical: 8, routeRunning: 8, release: 8, hands: 8, awareness: 8, size: 4, afterCatch: 8 },
  },
  {
    name: 'Jarvis Landry',     short: 'J. Landry',     team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#5e3c22', height: 71, weight: 205, number: 14, starter: true, captain: true, years: '2014–18',
    attrs: { speed: 4, bodyControl: 9, vertical: 5, routeRunning: 9, release: 6, hands: 10, awareness: 9, size: 5, afterCatch: 9 },
  },
  {
    name: 'Tyreek Hill',       short: 'T. Hill',       team: 'MIA', teamName: 'Miami Dolphins',
    skin: '#5e3c22', height: 70, weight: 185, number: 10, starter: true, captain: true, years: '2022–',
    attrs: { speed: 11, bodyControl: 10, vertical: 6, routeRunning: 10, release: 9, hands: 7, awareness: 8, size: 4, afterCatch: 11 },
  },

  // ─── MINNESOTA VIKINGS ───────────────────────────────────────────────────
  {
    name: 'Randy Moss',        short: 'R. Moss',       team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#5e3c22', height: 76, weight: 210, number: 84, starter: true, captain: true, years: '1998–04',
    attrs: { speed: 10, bodyControl: 11, vertical: 11, routeRunning: 8, release: 10, hands: 11, awareness: 9, size: 10, afterCatch: 7 },
  },
  {
    name: 'Cris Carter',       short: 'C. Carter',     team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#5e3c22', height: 75, weight: 200, number: 80, starter: true, captain: true, years: '1990–01',
    attrs: { speed: 7, bodyControl: 10, vertical: 9, routeRunning: 9, release: 9, hands: 11, awareness: 10, size: 8, afterCatch: 7 },
  },
  {
    name: 'Stefon Diggs',      short: 'S. Diggs',      team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#5e3c22', height: 72, weight: 191, number: 14, starter: true, captain: true, years: '2015–19',
    attrs: { speed: 8, bodyControl: 9, vertical: 8, routeRunning: 9, release: 9, hands: 8, awareness: 9, size: 6, afterCatch: 9 },
  },
  {
    name: 'Adam Thielen',      short: 'A. Thielen',    team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#f0c4a0', height: 74, weight: 200, number: 19, starter: true, captain: true, years: '2014–22',
    attrs: { speed: 8, bodyControl: 9, vertical: 6, routeRunning: 9, release: 8, hands: 9, awareness: 9, size: 8, afterCatch: 8 },
  },
  {
    name: 'Justin Jefferson',  short: 'J. Jefferson',  team: 'MIN', teamName: 'Minnesota Vikings',
    skin: '#5e3c22', height: 73, weight: 195, number: 18, starter: true, captain: true, years: '2020–',
    attrs: { speed: 9, bodyControl: 10, vertical: 9, routeRunning: 11, release: 11, hands: 11, awareness: 10, size: 7, afterCatch: 8 },
  },

  // ─── NEW ENGLAND PATRIOTS ────────────────────────────────────────────────
  {
    name: 'Randy Moss',        short: 'R. Moss',       team: 'NE',  teamName: 'New England Patriots',
    skin: '#5e3c22', height: 76, weight: 210, number: 81, starter: true, captain: true, years: '2007–10',
    attrs: { speed: 10, bodyControl: 11, vertical: 11, routeRunning: 8, release: 10, hands: 11, awareness: 8, size: 10, afterCatch: 7 },
  },
  {
    name: 'Wes Welker',        short: 'W. Welker',     team: 'NE',  teamName: 'New England Patriots',
    skin: '#f0c4a0', height: 69, weight: 185, number: 83, starter: true, captain: true, years: '2007–12',
    attrs: { speed: 6, bodyControl: 10, vertical: 6, routeRunning: 10, release: 9, hands: 9, awareness: 10, size: 3, afterCatch: 10 },
  },
  {
    name: 'Julian Edelman',    short: 'Edelman',       team: 'NE',  teamName: 'New England Patriots',
    skin: '#f0c4a0', height: 70, weight: 200, number: 11, starter: true, captain: true, years: '2009–21',
    attrs: { speed: 7, bodyControl: 10, vertical: 5, routeRunning: 9, release: 8, hands: 9, awareness: 9, size: 6, afterCatch: 9 },
  },
  {
    name: 'Stanley Morgan',    short: 'S. Morgan',     team: 'NE',  teamName: 'New England Patriots',
    skin: '#5e3c22', height: 71, weight: 181, number: 86, starter: true, captain: true, years: '1977–89',
    attrs: { speed: 9, bodyControl: 7, vertical: 8, routeRunning: 7, release: 7, hands: 8, awareness: 8, size: 5, afterCatch: 7 },
  },

  // ─── NEW ORLEANS SAINTS ──────────────────────────────────────────────────
  {
    name: 'Michael Thomas',    short: 'M. Thomas',     team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#5e3c22', height: 75, weight: 212, number: 13, starter: true, captain: true, years: '2016–22',
    attrs: { speed: 7, bodyControl: 7, vertical: 7, routeRunning: 9, release: 8, hands: 10, awareness: 10, size: 8, afterCatch: 6 },
  },
  {
    name: 'Marques Colston',   short: 'Colston',       team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#5e3c22', height: 76, weight: 225, number: 12, starter: true, captain: true, years: '2006–15',
    attrs: { speed: 7, bodyControl: 9, vertical: 8, routeRunning: 8, release: 7, hands: 9, awareness: 9, size: 11, afterCatch: 8 },
  },
  {
    name: 'Joe Horn',          short: 'J. Horn',       team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#5e3c22', height: 72, weight: 220, number: 87, starter: true, captain: true, years: '2000–06',
    attrs: { speed: 9, bodyControl: 8, vertical: 8, routeRunning: 8, release: 8, hands: 8, awareness: 8, size: 7, afterCatch: 8 },
  },
  {
    name: 'Brandin Cooks',     short: 'Cooks',         team: 'NO',  teamName: 'New Orleans Saints',
    skin: '#5e3c22', height: 70, weight: 183, number: 10, starter: true, captain: true, years: '2014–16',
    attrs: { speed: 9, bodyControl: 8, vertical: 7, routeRunning: 7, release: 9, hands: 8, awareness: 8, size: 4, afterCatch: 8 },
  },

  // ─── NEW YORK GIANTS ─────────────────────────────────────────────────────
  {
    name: 'Odell Beckham Jr.', short: 'OBJ',           team: 'NYG', teamName: 'New York Giants',
    skin: '#5e3c22', height: 71, weight: 198, number: 13, starter: true, captain: true, years: '2014–18',
    attrs: { speed: 8, bodyControl: 10, vertical: 8, routeRunning: 8, release: 9, hands: 11, awareness: 9, size: 6, afterCatch: 10 },
  },
  {
    name: 'Plaxico Burress',   short: 'Burress',       team: 'NYG', teamName: 'New York Giants',
    skin: '#5e3c22', height: 76, weight: 226, number: 17, starter: true, captain: true, years: '2005–08',
    attrs: { speed: 7, bodyControl: 8, vertical: 9, routeRunning: 7, release: 7, hands: 8, awareness: 8, size: 11, afterCatch: 7 },
  },
  {
    name: 'Victor Cruz',       short: 'V. Cruz',       team: 'NYG', teamName: 'New York Giants',
    skin: '#b07848', height: 72, weight: 204, number: 80, starter: true, captain: true, years: '2010–16',
    attrs: { speed: 7, bodyControl: 9, vertical: 7, routeRunning: 9, release: 9, hands: 8, awareness: 9, size: 6, afterCatch: 9 },
  },
  {
    name: 'Amani Toomer',      short: 'A. Toomer',     team: 'NYG', teamName: 'New York Giants',
    skin: '#5e3c22', height: 75, weight: 205, number: 89, starter: true, captain: true, years: '1996–07',
    attrs: { speed: 6, bodyControl: 8, vertical: 8, routeRunning: 7, release: 7, hands: 8, awareness: 8, size: 8, afterCatch: 7 },
  },

  // ─── NEW YORK JETS ───────────────────────────────────────────────────────
  {
    name: 'Don Maynard',       short: 'D. Maynard',    team: 'NYJ', teamName: 'New York Jets',
    skin: '#f0c4a0', height: 72, weight: 180, number: 13, starter: true, captain: true, years: '1960–72',
    attrs: { speed: 9, bodyControl: 7, vertical: 9, routeRunning: 8, release: 8, hands: 8, awareness: 8, size: 4, afterCatch: 7 },
  },
  {
    name: 'Al Toon',           short: 'A. Toon',       team: 'NYJ', teamName: 'New York Jets',
    skin: '#5e3c22', height: 76, weight: 205, number: 82, starter: true, captain: true, years: '1985–92',
    attrs: { speed: 5, bodyControl: 9, vertical: 9, routeRunning: 7, release: 8, hands: 9, awareness: 8, size: 9, afterCatch: 8 },
  },
  {
    name: 'Keyshawn Johnson',  short: 'K. Johnson',    team: 'NYJ', teamName: 'New York Jets',
    skin: '#5e3c22', height: 74, weight: 215, number: 19, starter: true, captain: true, years: '1996–00',
    attrs: { speed: 7, bodyControl: 8, vertical: 8, routeRunning: 7, release: 7, hands: 8, awareness: 8, size: 9, afterCatch: 7 },
  },

  // ─── PHILADELPHIA EAGLES ─────────────────────────────────────────────────
  {
    name: 'Harold Carmichael', short: 'Carmichael',    team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#5e3c22', height: 78, weight: 225, number: 17, starter: true, captain: true, years: '1971–83',
    attrs: { speed: 7, bodyControl: 6, vertical: 6, routeRunning: 5, release: 7, hands: 9, awareness: 8, size: 11, afterCatch: 7 },
  },
  {
    name: 'DeSean Jackson',    short: 'D. Jackson',    team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#5e3c22', height: 69, weight: 169, number: 10, starter: true, captain: true, years: '2008–13',
    attrs: { speed: 11, bodyControl: 9, vertical: 6, routeRunning: 8, release: 9, hands: 6, awareness: 8, size: 3, afterCatch: 9 },
  },
  {
    name: 'Mike Quick',        short: 'M. Quick',      team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#5e3c22', height: 74, weight: 190, number: 82, starter: true, captain: true, years: '1982–90',
    attrs: { speed: 7, bodyControl: 7, vertical: 9, routeRunning: 8, release: 8, hands: 8, awareness: 8, size: 6, afterCatch: 8 },
  },
  {
    name: 'A.J. Brown',        short: 'A.J. Brown',    team: 'PHI', teamName: 'Philadelphia Eagles',
    skin: '#5e3c22', height: 73, weight: 226, number: 11, starter: true, captain: true, years: '2022–',
    attrs: { speed: 8, bodyControl: 9, vertical: 9, routeRunning: 7, release: 8, hands: 9, awareness: 9, size: 9, afterCatch: 10 },
  },

  // ─── PITTSBURGH STEELERS ─────────────────────────────────────────────────
  {
    name: 'Antonio Brown',     short: 'A. Brown',      team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#5e3c22', height: 70, weight: 185, number: 84, starter: true, captain: true, years: '2010–18',
    attrs: { speed: 10, bodyControl: 10, vertical: 7, routeRunning: 11, release: 10, hands: 9, awareness: 7, size: 4, afterCatch: 10 },
  },
  {
    name: 'John Stallworth',   short: 'Stallworth',    team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#5e3c22', height: 74, weight: 191, number: 82, starter: true, captain: true, years: '1974–87',
    attrs: { speed: 3, bodyControl: 9, vertical: 9, routeRunning: 9, release: 7, hands: 9, awareness: 9, size: 6, afterCatch: 9 },
  },
  {
    name: 'Lynn Swann',        short: 'L. Swann',      team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#5e3c22', height: 72, weight: 180, number: 88, starter: true, captain: true, years: '1974–82',
    attrs: { speed: 8, bodyControl: 9, vertical: 7, routeRunning: 8, release: 8, hands: 9, awareness: 8, size: 4, afterCatch: 8 },
  },
  {
    name: 'Hines Ward',        short: 'H. Ward',       team: 'PIT', teamName: 'Pittsburgh Steelers',
    skin: '#b07848', height: 72, weight: 205, number: 86, starter: true, captain: true, years: '1998–11',
    attrs: { speed: 7, bodyControl: 10, vertical: 7, routeRunning: 8, release: 7, hands: 9, awareness: 9, size: 7, afterCatch: 10 },
  },

  // ─── SAN FRANCISCO 49ERS ─────────────────────────────────────────────────
  {
    name: 'Jerry Rice',        short: 'J. Rice',       team: 'SF',  teamName: 'San Francisco 49ers',
    skin: '#5e3c22', height: 74, weight: 200, number: 80, starter: true, captain: true, years: '1985–00',
    attrs: { speed: 5, bodyControl: 10, vertical: 8, routeRunning: 11, release: 11, hands: 11, awareness: 11, size: 8, afterCatch: 10 },
  },
  {
    name: 'Terrell Owens',     short: 'T.O. SF',       team: 'SF',  teamName: 'San Francisco 49ers',
    skin: '#5e3c22', height: 75, weight: 226, number: 81, starter: true, captain: true, years: '1996–03',
    attrs: { speed: 8, bodyControl: 9, vertical: 9, routeRunning: 8, release: 7, hands: 9, awareness: 8, size: 10, afterCatch: 9 },
  },
  {
    name: 'John Taylor',       short: 'J. Taylor',     team: 'SF',  teamName: 'San Francisco 49ers',
    skin: '#5e3c22', height: 73, weight: 185, number: 82, starter: true, captain: true, years: '1987–95',
    attrs: { speed: 7, bodyControl: 8, vertical: 8, routeRunning: 8, release: 8, hands: 8, awareness: 8, size: 5, afterCatch: 8 },
  },

  // ─── SEATTLE SEAHAWKS ────────────────────────────────────────────────────
  {
    name: 'Steve Largent',     short: 'S. Largent',    team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#f0c4a0', height: 71, weight: 191, number: 80, starter: true, captain: true, years: '1976–89',
    attrs: { speed: 6, bodyControl: 8, vertical: 8, routeRunning: 9, release: 9, hands: 10, awareness: 10, size: 5, afterCatch: 7 },
  },
  {
    name: 'DK Metcalf',        short: 'DK Metcalf',    team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#5e3c22', height: 76, weight: 229, number: 14, starter: true, captain: true, years: '2019–',
    attrs: { speed: 9, bodyControl: 5, vertical: 10, routeRunning: 6, release: 7, hands: 6, awareness: 7, size: 10, afterCatch: 8 },
  },
  {
    name: 'Tyler Lockett',     short: 'T. Lockett',    team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#5e3c22', height: 70, weight: 182, number: 16, starter: true, captain: true, years: '2015–',
    attrs: { speed: 8, bodyControl: 11, vertical: 5, routeRunning: 9, release: 8, hands: 9, awareness: 10, size: 4, afterCatch: 4 },
  },
  {
    name: 'Doug Baldwin',      short: 'D. Baldwin',    team: 'SEA', teamName: 'Seattle Seahawks',
    skin: '#5e3c22', height: 70, weight: 189, number: 89, starter: true, captain: true, years: '2011–18',
    attrs: { speed: 8, bodyControl: 10, vertical: 8, routeRunning: 8, release: 8, hands: 9, awareness: 10, size: 4, afterCatch: 7 },
  },

  // ─── TAMPA BAY BUCCANEERS ────────────────────────────────────────────────
  {
    name: 'Mike Evans',        short: 'M. Evans',      team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#5e3c22', height: 77, weight: 231, number: 13, starter: true, captain: true, years: '2014–',
    attrs: { speed: 8, bodyControl: 8, vertical: 10, routeRunning: 7, release: 8, hands: 10, awareness: 9, size: 11, afterCatch: 5 },
  },
  {
    name: 'Vincent Jackson',   short: 'V. Jackson',    team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#5e3c22', height: 76, weight: 230, number: 83, starter: true, captain: true, years: '2012–16',
    attrs: { speed: 8, bodyControl: 8, vertical: 9, routeRunning: 8, release: 7, hands: 8, awareness: 8, size: 11, afterCatch: 8 },
  },
  {
    name: 'Chris Godwin',      short: 'C. Godwin',     team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#5e3c22', height: 73, weight: 212, number: 14, starter: true, captain: true, years: '2017–',
    attrs: { speed: 7, bodyControl: 7, vertical: 6, routeRunning: 7, release: 7, hands: 8, awareness: 8, size: 7, afterCatch: 8 },
  },
  {
    name: 'Keyshawn Johnson',  short: 'K. Johnson TB', team: 'TB',  teamName: 'Tampa Bay Buccaneers',
    skin: '#5e3c22', height: 74, weight: 215, number: 19, starter: true, captain: true, years: '2001–03',
    attrs: { speed: 7, bodyControl: 8, vertical: 8, routeRunning: 7, release: 7, hands: 8, awareness: 8, size: 9, afterCatch: 7 },
  },

  // ─── TENNESSEE TITANS ────────────────────────────────────────────────────
  {
    name: 'Haywood Jeffires',  short: 'Jeffires',      team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#5e3c22', height: 74, weight: 201, number: 84, starter: true, captain: true, years: '1987–95',
    attrs: { speed: 8, bodyControl: 9, vertical: 8, routeRunning: 8, release: 8, hands: 9, awareness: 9, size: 8, afterCatch: 8 },
  },
  {
    name: 'Ernest Givins',     short: 'E. Givins',     team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#3a2010', height: 69, weight: 172, number: 81, starter: true, captain: true, years: '1986–94',
    attrs: { speed: 9, bodyControl: 8, vertical: 7, routeRunning: 8, release: 8, hands: 8, awareness: 8, size: 3, afterCatch: 7 },
  },
  {
    name: 'A.J. Brown',        short: 'AJ Brown TEN',  team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#3a2010', height: 73, weight: 226, number: 11, starter: true, captain: true, years: '2019–21',
    attrs: { speed: 8, bodyControl: 9, vertical: 9, routeRunning: 6, release: 8, hands: 9, awareness: 9, size: 10, afterCatch: 9 },
  },
  {
    name: 'Derrick Mason',     short: 'D. Mason',      team: 'TEN', teamName: 'Tennessee Titans',
    skin: '#5e3c22', height: 70, weight: 191, number: 85, starter: true, captain: true, years: '1997–04',
    attrs: { speed: 7, bodyControl: 8, vertical: 7, routeRunning: 8, release: 8, hands: 8, awareness: 8, size: 5, afterCatch: 7 },
  },

  // ─── WASHINGTON COMMANDERS ───────────────────────────────────────────────
  {
    name: 'Art Monk',          short: 'A. Monk',       team: 'WAS', teamName: 'Washington Commanders',
    skin: '#5e3c22', height: 75, weight: 210, number: 81, starter: true, captain: true, years: '1980–93',
    attrs: { speed: 7, bodyControl: 8, vertical: 6, routeRunning: 8, release: 7, hands: 10, awareness: 10, size: 9, afterCatch: 6 },
  },
  {
    name: 'Charley Taylor',    short: 'C. Taylor',     team: 'WAS', teamName: 'Washington Commanders',
    skin: '#5e3c22', height: 75, weight: 210, number: 42, starter: true, captain: true, years: '1964–77',
    attrs: { speed: 9, bodyControl: 7, vertical: 8, routeRunning: 6, release: 8, hands: 8, awareness: 9, size: 9, afterCatch: 8 },
  },
  {
    name: 'Gary Clark',        short: 'G. Clark',      team: 'WAS', teamName: 'Washington Commanders',
    skin: '#5e3c22', height: 69, weight: 175, number: 84, starter: true, captain: true, years: '1985–92',
    attrs: { speed: 9, bodyControl: 8, vertical: 8, routeRunning: 8, release: 8, hands: 8, awareness: 8, size: 4, afterCatch: 7 },
  },
  {
    name: 'Santana Moss',      short: 'S. Moss',       team: 'WAS', teamName: 'Washington Commanders',
    skin: '#5e3c22', height: 68, weight: 185, number: 89, starter: true, captain: true, years: '2005–14',
    attrs: { speed: 10, bodyControl: 8, vertical: 7, routeRunning: 8, release: 8, hands: 8, awareness: 8, size: 4, afterCatch: 8 },
  },
  {
    name: 'Terry McLaurin',    short: 'McLaurin',      team: 'WAS', teamName: 'Washington Commanders',
    skin: '#3a2010', height: 72, weight: 210, number: 17, starter: true, captain: true, years: '2019–',
    attrs: { speed: 8, bodyControl: 10, vertical: 7, routeRunning: 7, release: 6, hands: 9, awareness: 8, size: 6, afterCatch: 6 },
  },

]

export const WR_LEGENDS = _raw.map(p => ({
  ...p,
  ovr:    _wrOVR(p.attrs),
  color:  TEAM_COLOR[p.team]?.color  ?? '#888888',
  color2: TEAM_COLOR[p.team]?.color2 ?? '#ffffff',
}))

export const WR_LEGEND_TYPES = ['speed', 'bodyControl', 'vertical', 'routeRunning', 'release', 'hands', 'awareness', 'size', 'afterCatch']

export const WR_LEGEND_PHYSICALS = {
  'Larry Fitzgerald':  { height: 75, weight: 218 },
  'Anquan Boldin':     { height: 73, weight: 220 },
  'DeAndre Hopkins':   { height: 73, weight: 212 },
  'Roy Green':         { height: 72, weight: 195 },
  'Julio Jones':       { height: 75, weight: 220 },
  'Roddy White':       { height: 72, weight: 211 },
  'Andre Rison':       { height: 72, weight: 188 },
  'Derrick Mason':     { height: 70, weight: 191 },
  'Torrey Smith':      { height: 71, weight: 205 },
  'Steve Smith Sr.':   { height: 69, weight: 185 },
  'Andre Reed':        { height: 72, weight: 190 },
  'Stefon Diggs':      { height: 72, weight: 191 },
  'Eric Moulds':       { height: 72, weight: 210 },
  'Lee Evans':         { height: 72, weight: 198 },
  'Muhsin Muhammad':   { height: 74, weight: 215 },
  'DJ Moore':          { height: 72, weight: 210 },
  'Brandon Marshall':  { height: 76, weight: 230 },
  'Alshon Jeffery':    { height: 75, weight: 218 },
  'Willie Gault':      { height: 72, weight: 176 },
  'Allen Robinson':    { height: 74, weight: 220 },
  'Chad Ochocinco':    { height: 73, weight: 192 },
  'A.J. Green':        { height: 75, weight: 210 },
  'Chris Collinsworth':{ height: 74, weight: 192 },
  "Ja'Marr Chase":     { height: 72, weight: 201 },
  'Josh Gordon':       { height: 75, weight: 225 },
  'Paul Warfield':     { height: 72, weight: 185 },
  'Jarvis Landry':     { height: 71, weight: 205 },
  'Michael Irvin':     { height: 75, weight: 207 },
  'Dez Bryant':        { height: 74, weight: 220 },
  'CeeDee Lamb':       { height: 74, weight: 198 },
  'Bob Hayes':         { height: 71, weight: 185 },
  'Terrell Owens':     { height: 75, weight: 226 },
  'Demaryius Thomas':  { height: 74, weight: 229 },
  'Rod Smith':         { height: 73, weight: 200 },
  'Emmanuel Sanders':  { height: 70, weight: 180 },
  'Ed McCaffrey':      { height: 76, weight: 215 },
  'Calvin Johnson':    { height: 77, weight: 236 },
  'Herman Moore':      { height: 74, weight: 210 },
  'Amon-Ra St. Brown': { height: 72, weight: 200 },
  'Roy Williams':      { height: 74, weight: 220 },
  'Davante Adams':     { height: 72, weight: 215 },
  'Sterling Sharpe':   { height: 72, weight: 202 },
  'Jordy Nelson':      { height: 74, weight: 217 },
  'James Lofton':      { height: 74, weight: 192 },
  'Donald Driver':     { height: 71, weight: 188 },
  'Andre Johnson':     { height: 75, weight: 230 },
  'Marvin Harrison':   { height: 72, weight: 175 },
  'Reggie Wayne':      { height: 71, weight: 198 },
  'Raymond Berry':     { height: 73, weight: 187 },
  'T.Y. Hilton':       { height: 70, weight: 178 },
  'Jimmy Smith':       { height: 73, weight: 208 },
  'Keenan McCardell':  { height: 72, weight: 191 },
  'Tyreek Hill':       { height: 70, weight: 185 },
  'Otis Taylor':       { height: 74, weight: 215 },
  'Dwayne Bowe':       { height: 74, weight: 221 },
  'Tim Brown':         { height: 71, weight: 195 },
  'Cliff Branch':      { height: 71, weight: 170 },
  'Fred Biletnikoff':  { height: 72, weight: 190 },
  'Amari Cooper':      { height: 73, weight: 210 },
  'Lance Alworth':     { height: 72, weight: 184 },
  'Keenan Allen':      { height: 74, weight: 211 },
  'Charlie Joiner':    { height: 71, weight: 185 },
  'Vincent Jackson':   { height: 76, weight: 230 },
  'Wes Chandler':      { height: 71, weight: 183 },
  'Isaac Bruce':       { height: 72, weight: 188 },
  'Torry Holt':        { height: 72, weight: 190 },
  'Cooper Kupp':       { height: 74, weight: 208 },
  'Robert Woods':      { height: 72, weight: 191 },
  'Mark Duper':        { height: 69, weight: 185 },
  'Mark Clayton':      { height: 69, weight: 175 },
  'Randy Moss':        { height: 76, weight: 210 },
  'Cris Carter':       { height: 74, weight: 196 },
  'Adam Thielen':      { height: 74, weight: 200 },
  'Justin Jefferson':  { height: 73, weight: 195 },
  'Wes Welker':        { height: 69, weight: 185 },
  'Julian Edelman':    { height: 70, weight: 200 },
  'Stanley Morgan':    { height: 71, weight: 181 },
  'Michael Thomas':    { height: 75, weight: 212 },
  'Marques Colston':   { height: 76, weight: 225 },
  'Joe Horn':          { height: 72, weight: 220 },
  'Brandin Cooks':     { height: 70, weight: 183 },  // skin fixed to #5e3c22
  'Odell Beckham Jr.': { height: 71, weight: 198 },
  'Plaxico Burress':   { height: 76, weight: 226 },
  'Victor Cruz':       { height: 72, weight: 204 },
  'Amani Toomer':      { height: 75, weight: 205 },
  'Don Maynard':       { height: 72, weight: 180 },
  'Al Toon':           { height: 76, weight: 205 },
  'Keyshawn Johnson':  { height: 74, weight: 215 },
  'Harold Carmichael': { height: 78, weight: 225 },
  'DeSean Jackson':    { height: 69, weight: 169 },
  'Mike Quick':        { height: 74, weight: 190 },
  'A.J. Brown':        { height: 73, weight: 226 },
  'Antonio Brown':     { height: 70, weight: 185 },
  'John Stallworth':   { height: 74, weight: 191 },
  'Lynn Swann':        { height: 72, weight: 180 },
  'Hines Ward':        { height: 72, weight: 205 },
  'Jerry Rice':        { height: 74, weight: 200 },
  'Dwight Clark':      { height: 75, weight: 215 },
  'John Taylor':       { height: 73, weight: 185 },
  'Brandon Aiyuk':     { height: 73, weight: 205 },
  'Steve Largent':     { height: 71, weight: 191 },
  'DK Metcalf':        { height: 76, weight: 229 },
  'Tyler Lockett':     { height: 70, weight: 182 },
  'Doug Baldwin':      { height: 70, weight: 189 },
  'Mike Evans':        { height: 77, weight: 231 },
  'Chris Godwin':      { height: 73, weight: 212 },
  'Haywood Jeffires':  { height: 74, weight: 201 },
  'Ernest Givins':     { height: 69, weight: 172 },
  'Art Monk':          { height: 75, weight: 210 },
  'Charley Taylor':    { height: 75, weight: 210 },
  'Gary Clark':        { height: 69, weight: 175 },
  'Santana Moss':      { height: 68, weight: 185 },
  'Terry McLaurin':    { height: 72, weight: 210 },
}
