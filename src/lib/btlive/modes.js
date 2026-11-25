// BLACKTOP LIVE: the games there are. Every man in a game is a person (online); a CPU only fills an empty seat in
// practice. 3v3 is gone (nobody played it): an old link or a saved choice of size 3 opens 1v1.
//   1v1    two people, one each side
//   2v2    four people, two a side: each one moves his own man, always (no switching)
//   koth   KING OF THE HILL, three people, every man for himself (cutthroat). The man with the ball (the king) plays
//          against the other two, who both defend. Ones and twos, make it take it. A stop is a live ball, as in every
//          mode (sim.js s.mustClear): whoever secures it takes it back past the arc, and then he's the king (a make
//          before that is waved off). Out of bounds or the shot clock: the ball goes to whichever
//          of the other two men is closer to it, and he checks it at the top (behind the arc, so no clear). First to
//          11, win by 2 over the next man, capped at 15. No passing.
export const MODES = {
  '1v1': { key: '1v1', label: '1V1', teams: 2, perTeam: 1, seats: 2 },
  '2v2': { key: '2v2', label: '2V2', teams: 2, perTeam: 2, seats: 4 },
  koth: { key: 'koth', label: 'KING OF THE HILL', short: 'KOTH', teams: 3, perTeam: 1, seats: 3, ffa: true },
}
export const MODE_KEYS = Object.keys(MODES)

// a mode from what a link, a saved choice or a device says: a key, or an old size (1, 2; 3 was 3v3 and opens 1v1)
export function modeKey(v, fallback = '1v1') {
  if (typeof v === 'string' && MODES[v.toLowerCase()]) return v.toLowerCase()
  const n = Number(v)
  if (n === 2) return '2v2'
  if (n === 1 || n === 3) return '1v1'
  return fallback
}

// the mode of a game from its teams: three sides of one is King of the Hill
export const modeOfTeams = teams => (teams.length === 3 ? 'koth' : teams[0].length >= 2 ? '2v2' : '1v1')
