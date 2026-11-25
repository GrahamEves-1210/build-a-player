// Real NBA head coaches for basketball Franchise (Franchise-only data: nothing else in the game reads it).
//
// WHO HOLDS EACH JOB: ESPN's 2026-27 coach records (sports.core.api.espn.com, season 2027, every team's coaches),
// fetched 2026-11-24, checked against NBA.com's "closer look at the new coaches for 2026-27" (six new: Splitter
// CHI, Taylor Jenkins MIL, Sean Sweeney ORL, Jamahl Mosley NOP, Dusty May DAL, Micah Nori POR).
//   `since` = the first season (its start year) he ran this team, interim stretches included (Adelman, Christie,
//   Keefe, Iisalo took over mid-season). `age` this season, from his birth year where ESPN or his public biography
//   has one (approximate by a year for a few). `espn` = his ESPN coach id; `shot` = ESPN's studio headshot exists
//   for him (public/headshots/nba-coaches/<espn>.jpg, ESPN's own 65px coach file; shot: 'png' = ESPN's full-size
//   600x436 headshot, <espn>.png, from its player headshots: a coach who played, or one ESPN filed there); the rest
//   show their initials.
//
// RATINGS, 0-11 (shown as letters: 11 S, 10 A, 9 A-, 8 B+, 7 B, 6 B-, 5 C+, 4 C, 3 C-, 2 D, 1 D-, 0 F). Opinion, the
// way the league talks about each man going into 2026-27: titles and deep runs, the units his teams have put up
// (offensive and defensive ratings), the young players who grew under him, how his locker rooms hold together and his
// late-game management is rated. A first-time head coach sits near the middle (C+ to B-) until he has a record.
//   dev   PLAYER DEVELOPMENT   young players' growth (aging.js)
//   off   OFFENSIVE SCHEME     the team's shot-making and ball security (game.js)
//   def   DEFENSIVE SCHEME     the shots it gives up (game.js)
//   cul   CULTURE BUILDING     the standard his teams keep: the men he has re-sign, the market wants in, the young
//                              buy in (market.js, aging.js). Graded 2026-11-25 by reputation for building a culture:
//                              Spoelstra (Heat Culture) S; Daigneault (OKC) A; Kerr, Carlisle, Bickerstaff A-; Mazzulla,
//                              Atkinson, Udoka, Lue, Mitch Johnson B+; Splitter, Sweeney, Nori, Iisalo, Keefe C+; Christie, Thibodeau C
//   late  GAME MANAGEMENT      the last five minutes of a close game: timeouts, plays out of them, matchups (game.js)
export const NBA_COACHES = [
  { team: 'ATL', name: 'Quin Snyder', age: 60, since: 2023, espn: 52120, attrs: { dev: 7, off: 8, def: 6, cul: 6, late: 6 } },
  { team: 'BOS', name: 'Joe Mazzulla', age: 38, since: 2022, espn: 2232684, shot: 1, attrs: { dev: 7, off: 9, def: 8, cul: 8, late: 7 } },
  { team: 'BKN', name: 'Jordi Fernández', age: 44, since: 2024, espn: 4058088, attrs: { dev: 8, off: 5, def: 6, cul: 7, late: 5 } },
  { team: 'CHA', name: 'Charles Lee', age: 42, since: 2024, espn: 3062, attrs: { dev: 7, off: 6, def: 6, cul: 7, late: 5 } },
  { team: 'CHI', name: 'Tiago Splitter', age: 41, since: 2026, espn: 3233, shot: 'png', attrs: { dev: 6, off: 6, def: 6, cul: 5, late: 5 } },
  { team: 'CLE', name: 'Kenny Atkinson', age: 59, since: 2024, espn: 6809, shot: 1, attrs: { dev: 8, off: 9, def: 7, cul: 8, late: 6 } },
  { team: 'DAL', name: 'Dusty May', age: 50, since: 2026, espn: 4391222, attrs: { dev: 7, off: 7, def: 6, cul: 6, late: 5 } },
  { team: 'DEN', name: 'David Adelman', age: 45, since: 2025, espn: 3067059, attrs: { dev: 6, off: 8, def: 5, cul: 6, late: 6 } },
  { team: 'DET', name: 'J.B. Bickerstaff', age: 47, since: 2024, espn: 2613478, shot: 1, attrs: { dev: 8, off: 6, def: 9, cul: 9, late: 6 } },
  { team: 'GSW', name: 'Steve Kerr', age: 61, since: 2014, espn: 425, shot: 1, attrs: { dev: 6, off: 9, def: 7, cul: 9, late: 7 } },
  { team: 'HOU', name: 'Ime Udoka', age: 49, since: 2023, espn: 866, attrs: { dev: 7, off: 5, def: 10, cul: 8, late: 6 } },
  { team: 'IND', name: 'Rick Carlisle', age: 67, since: 2021, espn: 4661, shot: 1, attrs: { dev: 6, off: 9, def: 6, cul: 9, late: 9 } },
  { team: 'LAC', name: 'Tyronn Lue', age: 49, since: 2020, espn: 489, shot: 1, attrs: { dev: 5, off: 7, def: 8, cul: 8, late: 10 } },
  { team: 'LAL', name: 'JJ Redick', age: 42, since: 2024, espn: 3024, shot: 'png', attrs: { dev: 5, off: 7, def: 5, cul: 6, late: 6 } },
  { team: 'MEM', name: 'Tuomas Iisalo', age: 43, since: 2024, espn: 5277133, attrs: { dev: 6, off: 7, def: 5, cul: 5, late: 5 } },
  { team: 'MIA', name: 'Erik Spoelstra', age: 56, since: 2008, espn: 6749, shot: 'png', attrs: { dev: 11, off: 8, def: 10, cul: 11, late: 9 } },
  { team: 'MIL', name: 'Taylor Jenkins', age: 42, since: 2026, espn: 3044495, attrs: { dev: 8, off: 6, def: 7, cul: 7, late: 5 } },
  { team: 'MIN', name: 'Chris Finch', age: 57, since: 2020, espn: 2613479, attrs: { dev: 6, off: 8, def: 8, cul: 7, late: 7 } },
  { team: 'NOP', name: 'Jamahl Mosley', age: 48, since: 2026, espn: 2529241, attrs: { dev: 7, off: 4, def: 8, cul: 7, late: 5 } },
  { team: 'NYK', name: 'Mike Brown', age: 56, since: 2025, espn: 3612, shot: 1, attrs: { dev: 6, off: 7, def: 8, cul: 7, late: 6 } },
  { team: 'OKC', name: 'Mark Daigneault', age: 41, since: 2020, espn: 4356384, attrs: { dev: 10, off: 7, def: 10, cul: 10, late: 7 } },
  { team: 'ORL', name: 'Sean Sweeney', age: 41, since: 2026, espn: 2142798, shot: 'png', attrs: { dev: 6, off: 5, def: 7, cul: 5, late: 5 } },
  { team: 'PHI', name: 'Nick Nurse', age: 59, since: 2023, espn: 52085, shot: 1, attrs: { dev: 7, off: 7, def: 8, cul: 6, late: 8 } },
  { team: 'PHX', name: 'Jordan Ott', age: 41, since: 2025, espn: 4061667, attrs: { dev: 6, off: 7, def: 6, cul: 6, late: 5 } },
  { team: 'POR', name: 'Micah Nori', age: 52, since: 2026, espn: 2487822, shot: 'png', attrs: { dev: 6, off: 6, def: 5, cul: 5, late: 5 } },
  { team: 'SAC', name: 'Doug Christie', age: 56, since: 2024, espn: 147, attrs: { dev: 5, off: 4, def: 5, cul: 4, late: 4 } },
  { team: 'SAS', name: 'Mitch Johnson', age: 40, since: 2024, espn: 4401170, attrs: { dev: 9, off: 7, def: 8, cul: 8, late: 6 } },
  { team: 'TOR', name: 'Darko Rajaković', age: 47, since: 2023, espn: 3116516, attrs: { dev: 7, off: 6, def: 6, cul: 6, late: 5 } },
  { team: 'UTA', name: 'Will Hardy', age: 38, since: 2022, espn: 4059065, attrs: { dev: 7, off: 6, def: 4, cul: 6, late: 5 } },
  { team: 'WAS', name: 'Brian Keefe', age: 50, since: 2023, espn: 2487819, attrs: { dev: 6, off: 4, def: 4, cul: 5, late: 4 } },
]

// Head coaches out of work going into 2026-27 (the market a team that fires its coach hires from, with the league's
// up-and-coming assistants). `cv`: his last jobs.
export const NBA_COACH_FREE_AGENTS = [
  { name: 'Jason Kidd', age: 53, cv: 'MAVERICKS HC 2021-26 · BUCKS 2014-18', attrs: { dev: 6, off: 7, def: 7, cul: 6, late: 6 } },
  { name: 'Doc Rivers', age: 65, cv: 'BUCKS HC 2023-26 · CELTICS 2004-13', attrs: { dev: 4, off: 6, def: 6, cul: 6, late: 5 } },
  { name: 'Tom Thibodeau', age: 68, cv: 'KNICKS HC 2020-25 · BULLS 2010-15', attrs: { dev: 5, off: 6, def: 9, cul: 4, late: 6 } },
  { name: 'Michael Malone', age: 55, cv: 'NUGGETS HC 2015-25', attrs: { dev: 7, off: 8, def: 6, cul: 7, late: 6 } },
  { name: 'Mike Budenholzer', age: 57, cv: 'SUNS HC 2024-25 · BUCKS 2018-23', attrs: { dev: 6, off: 7, def: 8, cul: 5, late: 5 } },
  { name: 'Willie Green', age: 45, cv: 'PELICANS HC 2021-25', attrs: { dev: 6, off: 5, def: 6, cul: 6, late: 5 } },
  { name: 'Darvin Ham', age: 53, cv: 'LAKERS HC 2022-24', attrs: { dev: 5, off: 5, def: 6, cul: 5, late: 4 } },
  { name: 'Frank Vogel', age: 53, cv: 'SUNS HC 2023-24 · LAKERS 2019-22', attrs: { dev: 5, off: 5, def: 8, cul: 6, late: 5 } },
]
