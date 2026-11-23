// The real injury report on opening night of 2026-27 (ESPN's NBA injuries page, read 2026-11-23: the men who were
// already out before the season tipped off on Oct 20). NBA Franchise starts its league with them out (league.js
// buildTeams), unless the GM turns injuries off.
//   g   games he misses from opening night (his expected return date, about two days a game)
//   k   what the injury report says (the same words the season's own injuries use, nba/injury.js)
//   se  1 = out for the season
export const NBA_DAY_ONE_INJURIES = {
  'Ben Simmons':         { g: 82, k: 'ruptured right Achilles', se: 1 },   // SAC, surgery Oct 20
  'Ariel Hukporti':      { g: 82, k: 'ruptured right Achilles', se: 1 },   // PHI, season-ending
  'Henri Veesaar':       { g: 82, k: 'torn right ACL', se: 1 },            // ATL, out for 2026-27
  'Donte DiVincenzo':    { g: 76, k: 'ruptured right Achilles' },          // MIN, back about April
  'Jamir Watkins':       { g: 76, k: 'torn left ACL' },                    // WAS, back about April
  'Shaedon Sharpe':      { g: 66, k: 'torn right meniscus' },              // POR, back about March
  'Jordan Miller':       { g: 66, k: 'torn left rotator cuff' },           // LAC, back about March
  'Mark Williams':       { g: 53, k: 'torn left labrum' },                 // PHX, back about February
  'Jimmy Butler III':    { g: 37, k: 'torn right ACL' },                   // GSW, back January-February
  'Kristaps Porzingis':  { g: 37, k: 'away from the team' },               // GSW, stepped away
  'Jayden Quaintance':   { g: 22, k: 'right knee surgery' },               // SAS, not yet cleared
  'Moses Moody':         { g: 21, k: 'ruptured left patellar tendon' },    // GSW, back December-January
  'Bradley Beal':        { g: 20, k: 'right knee inflammation' },          // LAC, not ready for opening night
  'Julian Strawther':    { g: 20, k: 'sprained left knee' },               // DEN, six weeks
}
