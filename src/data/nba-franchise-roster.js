// NBA FRANCHISE ONLY: how the league opens where it differs from the shared pools (data/nba-guards.js, nba-bigs.js),
// which feed every live mode and stay as they are. Read by lib/franchise2/nba/league.js realPool().
// Source: ESPN's rosters, 2026-11-23.

// Real men added so a team opens with at least 10 real players (owner, 11-23: a team with 10 or more real men in the
// shared pool gets nobody). Cleveland had 9; Craig Porter Jr. is the best of its real rotation men the pool lacks.
// Ratings ESTIMATED from his NBA numbers and like players, for the ratings editor to review. born: the year that
// gives his age when the season starts.
export const NBA_FRANCHISE_ADDS = [
  { name: 'Craig Porter Jr.', team: 'CLE', number: 9, height: 73, weight: 180, position: 'PG', born: 2000, group: 'guard',
    attrs: { jumpShot: 5, finishing: 4, passing: 6, handles: 4, perimeterDefense: 5, speed: 5, bounce: 5, size: 2, basketballIQ: 4, clutch: 3 } },
]

// Real men on another team now (the shared pool still has them where they were): their Franchise team and number
export const NBA_FRANCHISE_MOVES = {
  'Dalton Knecht': { team: 'NYK', number: 1 },   // a Knicks two-way man
  'Johni Broome': { team: 'MIN', number: 22 },   // a Timberwolves two-way man
}

// Waived in October and on no NBA roster: in Franchise they open in free agency
export const NBA_FRANCHISE_STREET = ['Dwight Powell', 'Bruce Brown', 'Haywood Highsmith', 'Jeremy Sochan', 'Andre Jackson Jr.']

// Years of NBA service before 2026-27 for the real men with no contract in data/nba-contracts.js (the men on the
// street): every season on an NBA roster. Without a row here a man's service is guessed from his age.
// (Powell: drafted 2014; Brown: 2018; Highsmith: a two-way deal in 2018-19, then 2021-22 on; Sochan: 2022; Jackson: 2023)
export const NBA_FRANCHISE_SERVICE = { 'Dwight Powell': 12, 'Bruce Brown': 8, 'Haywood Highsmith': 6, 'Jeremy Sochan': 4, 'Andre Jackson Jr.': 3 }

// The floor (owner, 11-23): a team opens every season with at least this many real or drafted men
export const REAL_FLOOR = 10
