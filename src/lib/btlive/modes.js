// BLACKTOP LIVE: the games there are. Every man in a game is a person (online); a CPU only fills an empty seat in
// practice. 3v3 is gone (nobody played it): an old link or a saved choice of size 3 opens 1v1.
//   1v1    two people, one each side
//   2v2    four people, two a side: each one moves his own man, always (no switching)
//   koth   KING OF THE HILL, three people, every man for himself: the park's King of the Court with three. Two
//          play one on one while the third sits out at the side; they rotate. A make: the scorer (the king) keeps
//          the ball (make it, take it), the man he scored on sits and the one sitting comes in to guard him. A stop
//          (a defensive board, a steal, a block he comes up with, the king stepping out of bounds, the shot clock):
//          the defender takes the crown and the ball, the old king sits and the one sitting comes in. Every change
//          is checked at the top. Out of bounds off the defender: the king keeps it. An offensive board: play on.
//          Each man keeps his own score, ones and twos; no point for taking the crown. First to 11, win by 2 over
//          the next man, capped at 15. No passing (sim.js)
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
