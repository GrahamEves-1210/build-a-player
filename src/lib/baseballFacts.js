// Baseball's record book and milestones, registered into lib/seasonFacts.js (RECORDS.baseball, MILESTONES.baseball)
// when baseball loads (lib/careerBaseball.js imports this). Its own file, so the football, basketball and soccer
// chunks never carry it.
import { RECORDS, MILESTONES } from './seasonFacts'

const sumOf = (games, k) => games.reduce((s, g) => s + (g[k] ?? 0), 0)
const steps = (id, label, k, marks) => marks.map(m => ({ id: `${id}-${m}`, label: label.replace('{n}', m.toLocaleString()), test: c => sumOf(c.games, k) >= m, big: m >= marks[marks.length - 2] }))
const cycle = g => !!g && (g.d ?? 0) >= 1 && (g.t ?? 0) >= 1 && (g.hr ?? 0) >= 1 && (g.h ?? 0) - (g.d ?? 0) - (g.t ?? 0) - (g.hr ?? 0) >= 1
// (qualified for a rate title: 3.1 plate appearances or 1 inning a team game, 502 PA or 162 IP over 162)
const qPA = st => (st.pa ?? 0) >= 502, qIP = st => (st.outs ?? 0) >= 486

// The records. Sources: Baseball-Reference's single-season and career leaders and MLB.com's record book (2025).
//   A season: 73 home runs, Barry Bonds (2001). 262 hits, Ichiro Suzuki (2004). 191 RBI, Hack Wilson (1930).
//     130 stolen bases, Rickey Henderson (1982, the record since 1900). A 56-game hitting streak, Joe DiMaggio (1941).
//     .406, Ted Williams (1941), the last .400 season; the live-ball era's best, .424, Rogers Hornsby (1924).
//     383 strikeouts, Nolan Ryan (1973, the record since 1900). 62 saves, Francisco Rodríguez (2008).
//     A 1.12 ERA, Bob Gibson (1968, the live-ball era's lowest over a qualified season).
//   A game (nine innings): 4 home runs (18 players, the last J.D. Martinez in 2017), 12 RBI (Jim Bottomley 1924 and
//     Mark Whiten 1993), 20 strikeouts (Roger Clemens 1986 and 1996, Kerry Wood 1998, Max Scherzer 2016).
//   A career: 762 home runs (Barry Bonds), 4,256 hits (Pete Rose), 1,406 stolen bases (Rickey Henderson), 182.6 WAR
//     (Babe Ruth, Baseball-Reference, hitting and pitching), 511 wins (Cy Young), 5,714 strikeouts (Nolan Ryan),
//     652 saves (Mariano Rivera).
RECORDS.baseball = {
  bat: [
    { id: 'hr', label: 'Home runs in a season', stat: 'seasonHR', value: 73, holder: 'Barry Bonds, 2001' },
    { id: 'hits', label: 'Hits in a season', stat: 'seasonH', value: 262, holder: 'Ichiro Suzuki, 2004' },
    { id: 'rbi', label: 'RBI in a season', stat: 'seasonRBI', value: 191, holder: 'Hack Wilson, 1930' },
    { id: 'sb', label: 'Stolen bases in a season (since 1900)', stat: 'seasonSB', value: 130, holder: 'Rickey Henderson, 1982' },
    { id: 'streak', label: 'Hitting streak', stat: 'hitStreak', value: 56, holder: 'Joe DiMaggio, 1941' },
    { id: 'hr-game', label: 'Home runs in a game', game: 'hr', value: 4, holder: '18 players (the last: J.D. Martinez, 2017)' },
    { id: 'rbi-game', label: 'RBI in a game', game: 'rbi', value: 12, holder: 'Jim Bottomley (1924) & Mark Whiten (1993)' },
    // (booked: lib/careerBaseball.js checks these when the season is booked, with the qualifier)
    { id: 'avg-400', label: 'A .400 season, the first since Ted Williams (.406, 1941)', booked: true, value: 0.406, holder: 'Ted Williams, 1941', better: st => (st.avg ?? 0) > 0.406, qualifies: qPA, end: true },
    { id: 'avg-live', label: 'Batting average in a season, live-ball era', booked: true, value: 0.424, holder: 'Rogers Hornsby, 1924', better: st => (st.avg ?? 0) > 0.424, qualifies: qPA, end: true },
    // (career: the season he passes the mark; career.js careerTotals has them)
    { id: 'c-hr', label: 'Career home runs', career: t => t.stats.hr, value: 762, holder: 'Barry Bonds', end: true },
    { id: 'c-hits', label: 'Career hits', career: t => t.stats.h, value: 4256, holder: 'Pete Rose', end: true },
    { id: 'c-sb', label: 'Career stolen bases', career: t => t.stats.sb, value: 1406, holder: 'Rickey Henderson', end: true },
    { id: 'c-war', label: 'Career WAR (Baseball-Reference)', career: t => t.stats.war, value: 182.6, holder: 'Babe Ruth', end: true },
  ],
  pit: [
    { id: 'k', label: 'Strikeouts in a season (since 1900)', stat: 'seasonK', value: 383, holder: 'Nolan Ryan, 1973' },
    { id: 'sv', label: 'Saves in a season', stat: 'seasonSV', value: 62, holder: 'Francisco Rodríguez, 2008' },
    { id: 'w', label: 'Wins in a season (since 1900)', stat: 'seasonW', value: 41, holder: 'Jack Chesbro, 1904' },
    { id: 'k-game', label: 'Strikeouts in a nine-inning game', game: 'k', value: 20, holder: 'Roger Clemens (1986, 1996), Kerry Wood (1998) & Max Scherzer (2016)' },
    { id: 'era', label: 'ERA in a season, live-ball era', booked: true, value: 1.12, holder: 'Bob Gibson, 1968', better: st => (st.era ?? 99) < 1.12, qualifies: qIP, end: true },
    { id: 'c-w', label: 'Career wins', career: t => t.stats.w, value: 511, holder: 'Cy Young', end: true },
    { id: 'c-k', label: 'Career strikeouts', career: t => t.stats.k, value: 5714, holder: 'Nolan Ryan', end: true },
    { id: 'c-sv', label: 'Career saves', career: t => t.stats.sv, value: 652, holder: 'Mariano Rivera', end: true },
  ],
  team: [
    { id: 'wins116', label: 'Team wins in a season', statFn: r => (r.wins ?? 0) > 116, holder: '1906 Cubs & 2001 Mariners (116)' },
  ],
}

MILESTONES.baseball = {
  common: [
    { id: 'win-8', label: 'Eight straight wins', test: c => c.streak >= 8 },
    { id: 'win-12', label: 'Twelve straight wins', test: c => c.streak >= 12, big: true },
  ],
  bat: [...steps('hr', '{n} home runs', 'hr', [20, 30, 40, 50]), ...steps('h', '{n} hits', 'h', [100, 150, 200]), ...steps('sb', '{n} stolen bases', 'sb', [30, 50]),
    { id: 'hr2', label: 'A two-homer game', test: c => c.last?.hr === 2 }, { id: 'hr3', label: 'Three home runs in a game', test: c => (c.last?.hr ?? 0) >= 3, big: true },
    { id: 'cycle', label: 'Hit for the cycle', test: c => cycle(c.last), big: true }, { id: 'h5', label: 'A five-hit game', test: c => (c.last?.h ?? 0) >= 5, big: true }],
  pit: [...steps('k', '{n} strikeouts', 'k', [100, 200, 250, 300]), ...steps('w', '{n} wins', 'w', [10, 15, 20]), ...steps('sv', '{n} saves', 'sv', [20, 30, 40]),
    { id: 'k10', label: 'Double-digit strikeouts', test: c => !!c.last?.gs && (c.last?.k ?? 0) >= 10 },
    { id: 'sho', label: 'A complete-game shutout', test: c => !!c.last?.gs && (c.last?.outs ?? 0) >= 27 && (c.last?.er ?? 0) === 0, big: true },
    { id: 'nono', label: 'A no-hitter', test: c => !!c.last?.gs && (c.last?.outs ?? 0) >= 27 && (c.last?.ha ?? 0) === 0, big: true }],
}
