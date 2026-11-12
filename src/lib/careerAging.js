// How a player's body ages in Career, football and basketball (2026-11-11). Pure: nothing here imports career.js.
//
// Before this, every offseason past a position's age took one to three grades off its two or three physical traits
// at random, so the same trait fell year after year: an A+ in a linebacker's range or power was a C or a D by his
// twelfth season, every time. Real careers don't go like that. The legs go first and a little at a time; strength
// holds into the mid-thirties; technique holds longer than that; the reads never go. And the men who last (a
// 36-year-old All-Pro linebacker, a 40-year-old point guard) put the work in to keep what they have.
//
//   - Every trait that ages has a class and the age it starts to go at (FADE). quick: speed, burst, a get-off,
//     bounce, range. power: strength, an arm, an anchor, a leg. skill: technique. Anything not listed never fades
//     (the reads, leadership, the shot, the frame).
//   - A trait wears a little each offseason (its class's rate, slow at first), a little more or less by the man
//     (some age well), by the trait, by the year, and by his body: durability slows all of it, so body work does.
//     When the wear adds up to a grade, the trait slips one grade. So the losses are spread over the traits that
//     age, a trait does not slip two years running until he is six years past his position's age, and some
//     offseasons cost nothing.
//   - At most two traits slip in an offseason (three from three years past his position's age), and age alone never takes a trait further below his
//     best than its class's floor.
//   - The player has a say (career.js vetWork): two development points of offseason work hold a trait that is
//     about to slip (it takes no wear that year), or win back a grade that has. How far back is capped by his age
//     (keepCap: his best, less a grade for every few years past the trait's turn), and each trait takes one piece
//     of work an offseason. The week off's drill can win a slipped grade back too.
//   - The numbers were set against 1,300 headless careers a pass (2026-11-11): the old rule's legacy, awards and
//     all-time rank are the bar, so the late years still cost production; they just stop costing one trait all of it.
//
// On the trait chip (all optional: a save from before has none, and reads as a fresh start):
//   wear   0-1.6, how far along the next slip is (unset: a seeded head start, so traits don't all slip together)
//   slipY  the season number it last slipped before
//   workY  the season number it was last held or won back before
//   faded  (from before) the grades lost and not won back: val + faded is his best at the trait
import { seeded } from './rng'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const r100 = v => Math.round(v * 100) / 100

// rate: grades a year, by how long it has been going (a step every `step` years); keep: the years past its turn
// that cost a grade of what work can still hold; floor: the most age alone takes off his best
const CLASS = {
  quick: { rate: [0.6, 0.9, 1.1, 1.2], step: 2, keep: 2, floor: 5 },
  power: { rate: [0.45, 0.75, 1.0, 1.1], step: 2, keep: 3, floor: 4 },
  skill: { rate: [0.3, 0.6, 0.9, 1.0], step: 2, keep: 3, floor: 4 },
}
// trait: [class, the age it starts to go]. Backs first, then corners and linebackers, receivers and rushers,
// quarterbacks and linemen, a kicker last.
export const FADE = {
  nfl: {
    qb: { legs: ['quick', 30], playmaking: ['skill', 32], arm: ['power', 33], accuracy: ['skill', 34] },
    rb: { speed: ['quick', 26], burst: ['quick', 26], elusiveness: ['quick', 26], strength: ['power', 28], balance: ['skill', 28], hands: ['skill', 30], carrying: ['skill', 30] },
    wr: { speed: ['quick', 29], vertical: ['quick', 29], afterCatch: ['quick', 29], release: ['skill', 31], bodyControl: ['skill', 32], routeRunning: ['skill', 33], hands: ['skill', 33] },
    te: { speed: ['quick', 29], vertical: ['quick', 29], afterCatch: ['power', 30], strength: ['power', 31], blocking: ['skill', 32], routeRunning: ['skill', 33], hands: ['skill', 33] },
    db: { speed: ['quick', 27], fluidity: ['quick', 27], manCoverage: ['skill', 29], press: ['skill', 30], runSupport: ['skill', 31], hands: ['skill', 31] },
    dl: { getOff: ['quick', 29], bend: ['quick', 29], speed: ['quick', 29], strength: ['power', 32], finesseMoves: ['skill', 32], powerMoves: ['skill', 33], blockShed: ['skill', 33] },
    lb: { range: ['quick', 27], power: ['power', 30], passRush: ['skill', 30], blockShed: ['skill', 30], tackling: ['skill', 31] },
    ol: { mobility: ['quick', 31], pancake: ['power', 33], anchor: ['power', 34], runBlock: ['skill', 34], passPro: ['skill', 35] },
    k: { power: ['power', 37], accuracy: ['skill', 39] },
  },
  bucket: {
    guard: { bounce: ['quick', 29], speed: ['quick', 30], perimeterDefense: ['skill', 31], finishing: ['skill', 32], handles: ['skill', 34] },
    big: { bounce: ['quick', 29], speed: ['quick', 30], interiorDefense: ['skill', 31], finishing: ['skill', 32], rebounding: ['skill', 33] },
  },
}
// a position's own pace on top of its ages: linemen hold what they have longer than anyone but a kicker (their
// game is strength and technique), and a kicker has only his leg to lose
const PACE = { ol: 0.8, k: 1.4, qb: 1.8 }
// this position ages by these rules (soccer and baseball keep their own)
export const hasFade = (sport, pos) => !!FADE[sport]?.[pos]
export const fadeOf = (sport, pos, t) => { const f = FADE[sport]?.[pos]?.[t]; return f ? { cls: f[0], from: f[1], ...CLASS[f[0]] } : null }
// his best at a trait: where it stands, plus the grades age and injuries have taken and work hasn't won back
export const primeOf = ch => Math.min(11, Math.round(ch?.val ?? 0) + (ch?.faded ?? 0))
// the best grade offseason work can still hold at an age: his best, less a grade for every `keep` years past the trait's turn
export const keepCap = (f, ch, age) => primeOf(ch) - Math.max(0, Math.floor((age - f.from) / f.keep))
const rateAt = (f, age) => f.rate[Math.min(f.rate.length - 1, Math.floor((age - f.from) / f.step))]
// how the man ages (0.85-1.2, his for the whole career), and each trait of his (0.85-1.15)
const geneOf = seed => 0.85 + seeded(`${seed}-agegene`)() * 0.35
const ownOf = (seed, t) => 0.85 + seeded(`${seed}-agegene-${t}`)() * 0.3
// the body: durability C+ (5) is the even mark; an A+ body wears a quarter slower, a D body a fifth faster
export const bodyFade = dur => (dur == null ? 1 : clamp(1.25 - 0.05 * dur, 0.75, 1.2))
const wearOf = (seed, t, ch) => ch.wear ?? r100(seeded(`${seed}-wear-${t}`)() * 0.7)

// One offseason. age: the age he turns; year: the season number coming up; durability: null for a man with no
// body to wear (a kicker); declineAt: his position's age (the late years are counted from it).
// Returns { build, slipped: [trait], worked: [trait] (held by this offseason's work), spared: [trait] (would have
// slipped on an average body: his durability held it), due: how many of his traits are aging at all }
export function fadeYear({ sport, pos, types, build, seed, year, age, durability = null, declineAt }) {
  const out = { build: { ...build }, slipped: [], worked: [], spared: [], due: 0 }
  if (!hasFade(sport, pos)) return out
  const gene = geneOf(seed) * (PACE[pos] ?? 1), body = bodyFade(durability), late = age >= declineAt + 6
  const cand = []
  for (const t of types) {
    const f = fadeOf(sport, pos, t), ch = build[t]
    if (!f || !ch || age < f.from) continue
    out.due++
    if (ch.workY === year) { out.worked.push(t); continue }
    const step = rateAt(f, age) * gene * ownOf(seed, t) * (0.6 + seeded(`${seed}-fade-${year}-${t}`)() * 0.8)
    const had = wearOf(seed, t, ch), wear = had + step * body
    out.build[t] = { ...ch, wear: r100(Math.min(1.6, wear)) }
    const room = Math.round(ch.val) - 1 >= Math.max(1, primeOf(ch) - f.floor), rested = late || ch.slipY !== year - 1
    if (wear >= 1 && room && rested) cand.push([t, wear])
    else if (body < 1 && had + step >= 1 && wear < 1 && room && rested) out.spared.push(t)
  }
  cand.sort((a, b) => b[1] - a[1])
  for (const [t] of cand.slice(0, age >= declineAt + 3 ? 3 : 2)) {
    const ch = out.build[t]
    out.build[t] = { ...ch, val: Math.round(ch.val) - 1, faded: (ch.faded ?? 0) + 1, wear: r100(ch.wear - 1), slipY: year }
    out.slipped.push(t)
  }
  return out
}
// a grade up on a chip: won back if age or an injury had taken it (faded comes down), else a new best (counted
// as an upgrade when it was trained)
export const gradeUp = (ch, to, trained = true) => ((ch.faded ?? 0) > 0 ? { ...ch, val: to, faded: ch.faded - 1 } : { ...ch, val: to, ...(trained ? { upgraded: (ch.upgraded ?? 0) + 1 } : {}) })
