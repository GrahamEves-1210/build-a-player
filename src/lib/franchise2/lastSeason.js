// FRANCHISE: each team's real 2025 season (the year before the franchise starts), for the team pick.
// Final regular-season records and how each team's season ended (en.wikipedia.org "2025 NFL season" and
// "2025-26 NFL playoffs", read 2026-11-14). Seattle beat New England 29-13 in Super Bowl LX.
//   [wins, losses, ties, how it ended]  (a division title is its own word: the team won its division)
export const LAST_YEAR = 2025
const R = {
  NE: [14, 3, 0, 'LOST SUPER BOWL LX', 1], BUF: [12, 5, 0, 'LOST DIVISIONAL'], MIA: [7, 10, 0], NYJ: [3, 14, 0],
  PIT: [10, 7, 0, 'LOST WILD CARD', 1], BAL: [8, 9, 0], CIN: [6, 11, 0], CLE: [5, 12, 0],
  JAX: [13, 4, 0, 'LOST WILD CARD', 1], HOU: [12, 5, 0, 'LOST DIVISIONAL'], IND: [8, 9, 0], TEN: [3, 14, 0],
  DEN: [14, 3, 0, 'LOST AFC CHAMPIONSHIP', 1], LAC: [11, 6, 0, 'LOST WILD CARD'], KC: [6, 11, 0], LV: [3, 14, 0],
  PHI: [11, 6, 0, 'LOST WILD CARD', 1], DAL: [7, 9, 1], WAS: [5, 12, 0], NYG: [4, 13, 0],
  CHI: [11, 6, 0, 'LOST DIVISIONAL', 1], GB: [9, 7, 1, 'LOST WILD CARD'], MIN: [9, 8, 0], DET: [9, 8, 0],
  CAR: [8, 9, 0, 'LOST WILD CARD', 1], TB: [8, 9, 0], ATL: [8, 9, 0], NO: [6, 11, 0],
  SEA: [14, 3, 0, 'WON SUPER BOWL LX', 1], LAR: [12, 5, 0, 'LOST NFC CHAMPIONSHIP'], SF: [12, 5, 0, 'LOST DIVISIONAL'], ARI: [3, 14, 0],
}
// { w, l, t, rec: '14-3', end: 'WON SUPER BOWL LX' | 'MISSED PLAYOFFS' | …, div: true (division champions), champ }
export function lastSeason(short) {
  const x = R[short]
  if (!x) return null
  const [w, l, t, end, div] = x
  return { year: LAST_YEAR, w, l, t, rec: `${w}-${l}${t ? `-${t}` : ''}`, end: end ?? 'MISSED PLAYOFFS', div: !!div, champ: end === 'WON SUPER BOWL LX' }
}
