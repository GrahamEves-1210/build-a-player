// FRANCHISE: the schedule. The NFL's real 17-game shape:
//   6  the division, home and away
//   4  one division in the conference (rotating, three years)
//   4  one division in the other conference (rotating, four years)
//   2  the teams that finished in the same place in the conference's other two divisions
//   1  the 17th game: a same-place team from another division of the other conference
// played over 18 weeks with one bye each (Weeks 6 to 13, a division at a time).
//
// Built, not searched: the 17 games are 17 rounds in which every team plays once. A team with its bye in week b
// plays round r in week r before the bye and week r + 1 after it, which works as long as, in the rounds that fall
// inside the bye window, both teams of a game sit on the same side of the bye. The byes go division by division
// with the two divisions that play each other back to back, so division rounds and that pairing's rounds always
// fit. The last two weeks are division games, as the real schedule's are.
import { NFL_TEAMS } from '../../data/nfl-teams'
import { rngOf } from './rng'
import { FIRST_YEAR } from './consts'

const DIV_NAMES = ['East', 'North', 'South', 'West']
export const CONFS = ['AFC', 'NFC']
// DIVISIONS[c * 4 + d] = { name, conf, teams: [short x4] }
export const DIVISIONS = CONFS.flatMap(conf => DIV_NAMES.map(d => ({ name: `${conf} ${d}`, conf, teams: NFL_TEAMS.filter(t => t.div === `${conf} ${d}`).map(t => t.short) })))
export const DIV_OF = Object.fromEntries(DIVISIONS.flatMap(d => d.teams.map(s => [s, d.name])))
export const CONF_OF = Object.fromEntries(NFL_TEAMS.map(t => [t.short, t.conf]))
const PAIRS3 = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]]

// order: { 'AFC East': [short x4 in last season's finish, first to last] } (year one: any order)
// returns { weeks: [[{ h, a }]] (18), bye: { short: week } }
export function makeSchedule(seed, year, order) {
  const R = rngOf(`${seed}-sched-${year}`)
  const y = year - FIRST_YEAR
  const place = d => order?.[DIVISIONS[d].name]?.length === 4 ? order[DIVISIONS[d].name] : DIVISIONS[d].teams
  // each division in a shuffled order for the round robins, so the same pairings don't land in the same weeks every year
  const mix = DIVISIONS.map((d, i) => R.shuffle(place(i)))
  const G = (h, a) => ({ h, a })
  const latin = (A, B, k, flip) => A.map((t, i) => { const o = B[(i + k) % 4]; return (k + flip) % 2 === 0 ? G(t, o) : G(o, t) })

  // division rounds: three pairings, then the return games
  const divRounds = [[], [], [], [], [], []]
  for (let d = 0; d < 8; d++) {
    const t = mix[d]
    const first = [[G(t[0], t[1]), G(t[2], t[3])], [G(t[2], t[0]), G(t[1], t[3])], [G(t[3], t[0]), G(t[1], t[2])]]
    first.forEach((games, k) => { divRounds[k].push(...games); divRounds[k + 3].push(...games.map(g => G(g.a, g.h))) })
  }
  // in the conference: this year's pairing of divisions, four rounds; and the two same-place rounds against the other two
  const pairs = PAIRS3[((y % 3) + 3) % 3]
  const confRounds = [[], [], [], []], placeRounds = [[], []]
  const byeUnits = []   // [divA, divB]: two divisions that play each other, byes back to back
  for (let c = 0; c < 2; c++) {
    const [p1, p2] = pairs.map(p => p.map(d => c * 4 + d))
    for (const [a, b] of [p1, p2]) { byeUnits.push([a, b]); for (let k = 0; k < 4; k++) confRounds[k].push(...latin(mix[a], mix[b], k, y)) }
    const [A, B] = p1, [C, D] = p2
    for (let i = 0; i < 4; i++) {
      placeRounds[0].push(G(place(A)[i], place(C)[i]), G(place(B)[i], place(D)[i]))
      placeRounds[1].push(G(place(D)[i], place(A)[i]), G(place(C)[i], place(B)[i]))
    }
  }
  // the other conference: a division a year, four rounds; and the 17th game against another of its divisions, by place
  const interRounds = [[], [], [], []], extra = []
  const y4 = ((y % 4) + 4) % 4
  for (let d = 0; d < 4; d++) {
    const n = 4 + ((d + y4) % 4), n17 = 4 + ((d + y4 + 2) % 4)
    for (let k = 0; k < 4; k++) interRounds[k].push(...latin(mix[d], mix[n], k, y + 1))
    for (let i = 0; i < 4; i++) extra.push(year % 2 === 0 ? G(place(d)[i], place(n17)[i]) : G(place(n17)[i], place(d)[i]))
  }

  // the 17 rounds in order (index 0 is round 1). Rounds 6, 8, 10, 12 and the last two are division rounds;
  // 7, 9, 11 are the conference pairing's; the rest fill the open weeks in a shuffled order.
  const dv = R.shuffle(divRounds), cf = R.shuffle(confRounds)
  const open = R.shuffle([...interRounds, ...placeRounds, extra, cf[3]])
  const rounds = []
  const fixed = { 6: dv[0], 8: dv[1], 10: dv[2], 12: dv[3], 16: dv[4], 17: dv[5], 7: cf[0], 9: cf[1], 11: cf[2] }
  for (let r = 1; r <= 17; r++) rounds.push(fixed[r] ?? open.shift())

  // byes: the pairs in a shuffled order, the two divisions of a pair back to back, Weeks 6 to 13
  const bye = {}
  R.shuffle(byeUnits).flatMap(u => R.shuffle(u)).forEach((d, j) => { for (const s of DIVISIONS[d].teams) bye[s] = 6 + j })

  const weeks = Array.from({ length: 18 }, () => [])
  rounds.forEach((games, i) => {
    const r = i + 1
    for (const g of games) weeks[(r < bye[g.h] ? r : r + 1) - 1].push({ h: g.h, a: g.a })
  })
  return { weeks, bye }
}

// A schedule's own check: 272 games, 17 a team, one game a week at most, 8 or 9 at home. Returns a list of problems.
export function scheduleProblems(weeks, bye) {
  const out = [], n = {}, home = {}
  let total = 0
  weeks.forEach((games, w) => {
    const seen = new Set()
    for (const g of games) {
      total++
      for (const s of [g.h, g.a]) { if (seen.has(s)) out.push(`week ${w + 1}: ${s} plays twice`); seen.add(s); n[s] = (n[s] ?? 0) + 1 }
      home[g.h] = (home[g.h] ?? 0) + 1
      if (g.h === g.a) out.push(`week ${w + 1}: ${g.h} plays itself`)
      if (bye[g.h] === w + 1 || bye[g.a] === w + 1) out.push(`week ${w + 1}: a team plays on its bye`)
    }
  })
  if (total !== 272) out.push(`games ${total}`)
  for (const t of NFL_TEAMS) {
    if (n[t.short] !== 17) out.push(`${t.short} plays ${n[t.short]}`)
    if (home[t.short] !== 8 && home[t.short] !== 9) out.push(`${t.short} home ${home[t.short]}`)
  }
  return out
}
