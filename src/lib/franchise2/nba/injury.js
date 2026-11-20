// NBA FRANCHISE: injuries and rest (part C).
//
// The rate: about 0.001 an injury a minute played (a rotation man's ~2,000 minutes a season is two or three
// injuries that cost games), a bit more for a man past 30. That is about 20-25 injuries a team-season, ~5-7 a night
// league-wide on the injury report, and with the long ones 150-220 games lost a team (the NBA's recent seasons:
// about 5,000-6,500 player-games lost league-wide).
// The kinds, by how often they cost games and how long (games), from the NBA's injury reports:
// ankle sprains the most common (1-12 games, three on average), then knee soreness, illness, hamstrings (2-15),
// back spasms, calves (3-20), groins, the concussion protocol (1-6), hand and wrist; the long ones a broken hand,
// an MCL sprain (8-25), a torn meniscus (15-45), a stress fracture in the foot, and the season-enders: a torn ACL
// (about a year) and a ruptured Achilles (more), each about 3 a season league-wide.
// Rest: a star on the second night of a back-to-back sits now and then (the Player Participation Policy keeps it rare
// for the young ones; a 33-year-old sits a third of them), never in the playoffs.
//
// The seam (nba/STATE.md):
//   rollInjuries(F, game, res) -> [{ i, s, k, g }]   after a game: who got hurt in it (sets man.inj { g, k }); the two
//                                                    teams' men already out are marked as having missed it (inj.m).
//                                                    Honours F.noInj (nobody is hurt, and nobody stays hurt).
//   tickInjuries(F, short)      after the night (core calls it for every team): a man who missed a game tonight is a
//                               game closer. Games out are games, so a team's idle night heals nobody.
//   tickInjuries(F, days)       with a number: time off with no games (the summer): days of healing, ~2.1 a game
//   restFor(F, short, game, b2b) -> [ids]           tonight's load management (sets man.rest = 1; cleared after the game)
//   outText(p, gamesLeft)       'OUT 3 GAMES' · 'OUT FOR SEASON' · 'DAY-TO-DAY'
//   TALLY                       the checks count every injury here (scripts/franchise2/nba)
import { rngOf } from '../rng'

export const TALLY = { on: false, rows: [] }
export const RATE = 0.00109          // injuries a minute played
const DAYS_PER_GAME = 2.1
// [what the report says, share of injuries %, games out: [min, max] (skewed short) ]
export const KINDS = [
  ['sprained ankle', 18, [1, 12]], ['knee soreness', 9, [1, 8]], ['illness', 9, [1, 3]], ['strained hamstring', 8, [2, 15]],
  ['back spasms', 6, [1, 6]], ['strained calf', 5, [3, 20]], ['strained groin', 5, [2, 10]], ['concussion protocol', 4, [1, 6]],
  ['plantar fasciitis', 3.5, [3, 18]], ['hip soreness', 4, [1, 6]], ['sprained wrist', 4, [1, 8]], ['sore shoulder', 3, [2, 10]],
  ['quad contusion', 4, [1, 5]], ['broken hand', 2.5, [10, 25]], ['sprained MCL', 2.5, [8, 25]], ['torn meniscus', 1.2, [15, 45]],
  ['stress fracture in his foot', 1, [25, 55]], ['torn ACL', 0.4, [100, 130]], ['ruptured Achilles', 0.35, [110, 140]],
]
const SEASON_ENDERS = new Set(['torn ACL', 'ruptured Achilles'])
const TOTAL = KINDS.reduce((s, k) => s + k[1], 0)
const kindsBy = R => { let x = R.u() * TOTAL; for (const k of KINDS) { x -= k[1]; if (x < 0) return k } return KINDS[0] }
// skewed short: most sprains are a few games, a few are two weeks
const lengthOf = (R, [lo, hi]) => Math.round(lo + (hi - lo) * Math.pow(R.u(), 1.8))
const SIDED = /(ankle|hamstring|calf|groin|wrist|shoulder|quad|hand|MCL|meniscus|ACL|Achilles|foot|hip|knee)/

export function injuryChance(p, min) {
  const ag = p.ag ?? 26
  const age = ag > 29 ? 1 + 0.045 * (ag - 29) : ag < 23 ? 0.9 : 1
  return RATE * min * age * (p.fr ?? 1)
}

function teamsOf(F, res) { return Object.keys(res.box) }
const manIn = (F, s, i) => F.teams[s]?.r.find(p => p.i === i)

export function rollInjuries(F, game, res) {
  const R = rngOf(`nba-inj-${F.seed}-${F.year}-${game.d ?? F.day}-${game.h}-${game.a}`)
  const hurt = []
  for (const s of teamsOf(F, res)) {
    const T = F.teams[s]; if (!T) continue
    for (const p of T.r) {
      if (p.inj) { if (F.noInj) delete p.inj; else p.inj.m = 1 }
    }
    if (F.noInj) continue
    for (const l of res.box[s]) {
      if (!(l.min > 0)) continue
      const p = manIn(F, s, l.i); if (!p) continue
      if (R.u() >= injuryChance(p, l.min)) continue
      const [k0, , len] = kindsBy(R)
      const k = k0.replace(SIDED, w => `${R.u() < 0.5 ? 'left' : 'right'} ${w}`)
      const g = lengthOf(R, len)
      p.inj = { g, k }
      if (SEASON_ENDERS.has(k0)) p.inj.se = 1
      hurt.push({ i: p.i, s, k, g })
      if (TALLY.on) TALLY.rows.push({ y: F.year, i: p.i, ag: p.ag, o: p.o, k: k0, g, po: !!game.po })
    }
  }
  return hurt
}

export function tickInjuries(F, x) {
  if (typeof x === 'string') {
    for (const p of F.teams[x]?.r ?? []) if (p.inj) {
      if (F.noInj) { delete p.inj; continue }
      if (!p.inj.m) continue
      delete p.inj.m
      p.inj.g -= 1
      if (p.inj.g <= 0) delete p.inj
    }
    return
  }
  const n = x / DAYS_PER_GAME
  for (const T of Object.values(F.teams)) for (const p of T.r) if (p.inj) { delete p.inj.m; p.inj.g -= n; if (p.inj.g <= 0 || F.noInj) delete p.inj; else p.inj.g = Math.ceil(p.inj.g) }
  for (const p of F.fa ?? []) if (p.inj) { p.inj.g -= n; if (p.inj.g <= 0) delete p.inj; else p.inj.g = Math.ceil(p.inj.g) }
}

// Load management: the second night of a back-to-back, the stars; a team rests one man a night at most
export function restFor(F, short, game, b2b) {
  const T = F.teams[short]; if (!T) return []
  for (const p of T.r) delete p.rest
  if (game?.po || F.phase === 'playoffs' || F.phase === 'playin') return []
  const R = rngOf(`nba-rest-${F.seed}-${F.year}-${game?.d ?? F.day}-${short}`)
  const stars = T.r.filter(p => !(p.inj?.g > 0) && (p.o ?? 0) >= 85 && p.b == null).sort((a, b) => b.ag - a.ag)
  for (const p of stars) {
    let c = b2b ? 0.04 + Math.max(0, p.ag - 30) * 0.03 : p.ag >= 34 ? 0.02 : 0
    if (p.ag >= 36) c += 0.05
    if (R.u() < Math.min(0.4, c)) { p.rest = 1; return [p.i] }
  }
  return []
}

export function outText(p, gamesLeft = 82) {
  if (p.rest) return 'REST'
  if (!p.inj) return ''
  if (p.inj.g >= gamesLeft) return 'OUT FOR SEASON'
  if (p.inj.g <= 1) return 'DAY-TO-DAY'
  if (p.inj.g >= 12) return `OUT ${Math.round(p.inj.g / 3.5)} WEEKS`
  return `OUT ${p.inj.g} GAMES`
}
