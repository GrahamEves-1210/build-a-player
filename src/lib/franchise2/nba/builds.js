// NBA FRANCHISE: the GM's own builds. A build is made on the game's build page (a guard or a big, its ten ratings),
// named and numbered in the setup, and joins the team as a rookie: 20 years old, a first-round rookie-scale deal at
// the slot his OVR would have gone (a pick of his own: seatBuilds), his spot read off his ratings. He takes an open roster spot; a full roster makes
// room at the end of its bench (waiveFor: its camp body first).
// Builds grow by the game's own rule, not the sim's dice: each summer a young build's grades go up a step at a time.
// From 28 he ages the way every man does (aging.js ageBuild: the league's curve, the legs first), and he retires the
// way they do, a little later (from 35, the same odds x0.6, as football's builds), at 40 at the latest. His
// retirement is on the wire and his card keeps the year (F.builds[b].done).
import { TEAM, TYPES, ovrOfAttrs, SPOTS, groupOfSpot } from './league'
import { rngOf, clamp } from '../rng'
import { addNews, POS_FULL, signText } from './news'
import * as X from './seams'
import { coachDev } from './coach'

export const BUILD_MAX = 3
// his spot: a guard who runs the offence is a point guard, a big wing a small forward; a big with size a center
export function buildSpot(pos, a) {
  if (pos === 'big') return (a.size ?? 5) + (a.interiorDefense ?? 5) >= (a.jumpShot ?? 5) + (a.speed ?? 5) + 2 ? 'C' : 'PF'
  const pg = (a.passing ?? 5) + (a.handles ?? 5), wing = (a.size ?? 5) * 2
  return pg >= 15 && pg >= wing ? 'PG' : wing >= 13 && (a.size ?? 5) >= 7 ? 'SF' : 'SG'
}
const HT = { PG: 75, SG: 77, SF: 79, PF: 81, C: 83 }, WT = { PG: 190, SG: 205, SF: 220, PF: 235, C: 255 }
// the draft slot his OVR goes at: a 90 or better is the first pick, an 85 goes ninth, an 80 in the middle of the
// round, a 75 late in it, a 72 or less last (No. 30)
export const buildSlot = o => clamp(1, 30, Math.round(1 + (90 - o) * 1.6))
// the builds' slots together (their OVRs in the setup's order): no two share one. The better build keeps his OVR's
// slot and the next takes the pick after it (two 90s go first and second); past No. 30 the slot before.
export const buildSlots = os => spread(os.map(buildSlot))
// picks wanted -> picks held, no two the same: the earlier pick keeps his, the next man takes the one after
function spread(want) {
  const out = want.map(() => 0), used = new Set()
  for (const k of want.map((n, k) => k).sort((a, b) => want[a] - want[b] || a - b)) {
    let n = clamp(1, 30, want[k])
    while (used.has(n) && n < 30) n++
    while (used.has(n) && n > 1) n--
    used.add(n); out[k] = n
  }
  return out
}
// The 2026 first round with the builds in it, a man a pick: each build at his slot (buildSlots), and the real 2026
// first-rounders from there on one pick later, as far as the first pick whose man the game doesn't carry (a 95 build
// goes first, the real first pick reads as the second, and so on down; the real men stay in their order). With no
// such pick left before No. 30 the men ahead move one earlier instead. Only the pick number moves: a real man's
// team, deal and money stay his own.
export function seatBuilds(F, men, { year = F.year, want = null } = {}) {
  const slots = want ? spread(want) : buildSlots(men.map(p => p.o))
  const B = new Set(slots)
  const all = [...Object.values(F.teams).flatMap(t => t.r), ...(F.fa ?? [])]
  const seen = new Set()
  const real = all.filter(p => p.b == null && p.dr?.[0] === year && p.dr[1] === 1 && p.dr[2] >= 1 && p.dr[2] <= 30 && !seen.has(p.dr[2]) && seen.add(p.dr[2])).sort((x, y) => x.dr[2] - y.dr[2])
  // (down the round: a man keeps his pick unless a build or the man ahead of him has it; then back up it, should the
  // round have run out)
  const pos = []
  let prev = 0
  for (const p of real) { let n = Math.max(p.dr[2], prev + 1); while (B.has(n)) n++; pos.push(n); prev = n }
  let next = 31
  for (let k = real.length - 1; k >= 0; k--) { let n = Math.min(pos[k], next - 1); while (n >= 1 && B.has(n)) n--; pos[k] = n; next = n }
  real.forEach((p, k) => { if (pos[k] >= 1 && pos[k] !== p.dr[2]) p.dr = [p.dr[0], p.dr[1], pos[k], p.dr[3]] })
  men.forEach((p, k) => { p.dr = [p.dr[0], p.dr[1], slots[k], p.dr[3]] })
  return slots
}
// A save from before every build had his own pick (two builds on one pick, or a build on a real rookie's): seated
// again when it loads (index.js upgradeNba), each build at the pick he has, the next one when a build already holds
// it. A save with nothing shared is left alone. Returns whether anything moved.
export function reseatBuilds(F) {
  const all = [...Object.values(F.teams ?? {}).flatMap(t => t.r), ...(F.fa ?? [])]
  const men = all.filter(p => p.b != null && p.dr?.[1] === 1).sort((a, b) => a.b - b.b)
  if (!men.length) return false
  const year = men[0].dr[0], held = {}
  for (const p of all) if (p.dr?.[0] === year && p.dr[1] === 1) held[p.dr[2]] = (held[p.dr[2]] ?? 0) + 1
  if (!men.some(p => p.dr[0] === year && held[p.dr[2]] > 1)) return false
  const mine = men.filter(p => p.dr[0] === year)
  seatBuilds(F, mine, { year, want: mine.map(p => p.dr[2]) })
  return true
}
export const attrsOfBuild = (pos, build) => Object.fromEntries((TYPES[pos] ?? []).map(t => [t, clamp(0, 11, Math.round(build?.[t]?.val ?? 0))]))

export function makeBuild(F, idx, B) {
  const a = attrsOfBuild(B.pos, B.build)
  const spot = buildSpot(B.pos, a)
  const o = ovrOfAttrs(B.pos, a)
  const p = { i: F.nid++, n: B.name, p: spot, g: groupOfSpot(spot) === B.pos ? B.pos : B.pos, o, ag: B.age ?? 20, a, ht: HT[spot], wt: WT[spot], num: B.num, ys: 0, b: idx, rk: F.year, pk: Math.min(99, o + 4) }
  p.dr = [F.year, 1, buildSlot(o), F.team]   // (placeBuilds seats him: seatBuilds gives every build his own pick)
  return p
}
// the builds onto the GM's roster at the start of the franchise (F.builds already filled in)
export function placeBuilds(F) {
  const t = F.teams[F.team]
  // (every build made first, so each gets his own pick in the 2026 first round and the real rookies move around them)
  const made = F.builds.map((B, idx) => makeBuild(F, idx, B))
  seatBuilds(F, made)
  for (let idx = 0; idx < F.builds.length; idx++) {
    const B = F.builds[idx]
    const p = made[idx]
    // his roster spot: an open one; with the 15 standard spots full, the end of the bench makes room: the team's
    // camp body (a filler on a minimum deal) first, else of the last few men in his group (the two-way men aside) the
    // one whose release costs least, waived (his guaranteed money stays on the books, as it would)
    const full = t.r.filter(x => !x.tw).length >= 15
    const same = !full ? null : waiveFor(F, t, p.g)
    const before = X.capSheet(F, F.team)
    if (same) { X.cutMan(F, F.team, same.i); same.was = F.team }
    t.r.push(p)
    X.rookieDeal(F, p, { n: p.dr[2], r: 1 })
    B.i = p.i
    addNews(F, { k: 'sign', tag: 'SIGNED', s: F.team, text: `${signText('signs with', { ...p, n: `${p.n}, a ${POS_FULL[p.p] ?? p.p},` }, F.team, { note: ' (rookie scale)' })}${same ? `; ${same.n} is waived` : ''}` })
    if (!F.noCap) addNews(F, { k: 'cap', tag: 'PAYROLL', s: F.team, text: buildCapText(F, before, X.capSheet(F, F.team)) })
  }
}
// the man a full roster waives to make room for a build of group g (setup's preview and placeBuilds agree)
export function waiveFor(F, t, g) {
  const cost = x => X.cutCost(F, x).total
  const fill = t.r.filter(x => !x.tw && x.b == null && x.fl).sort((x, y) => cost(x) - cost(y) || x.o - y.o)[0]
  if (fill) return fill
  return t.r.filter(x => !x.tw && x.b == null && x.g === g).sort((x, y) => x.o - y.o).slice(0, 3).sort((x, y) => (cost(x) - cost(y)) || x.o - y.o)[0] ?? null
}
// what a build's deal does to the books: the payroll before and after, and the line it now sits past
const LINE = { under: 'under the cap', cap: 'over the cap', tax: 'in the luxury tax', a1: 'over the first apron', a2: 'over the second apron' }
export function buildCapText(F, before, after) {
  const m = v => `$${v.toFixed(1)} million`
  const moved = after.over !== before.over
  const apron = after.over === 'a1' || after.over === 'a2'
  return `The ${TEAM[F.team].nick} payroll goes from ${m(before.pay)} (${LINE[before.over]}) to ${m(after.pay)}${moved ? `, now ${LINE[after.over]}` : ` (${LINE[after.over]})`}${apron ? `: past the ${after.over === 'a1' ? 'first' : 'second'} apron a team can't use the ${after.over === 'a1' ? 'non-taxpayer' : 'taxpayer or non-taxpayer'} mid-level, and its trades are limited` : ''}`
}
// the books with a build of this OVR added, for the setup's preview of the GM's team: { before, after, add, text }.
// prev: the $M of the builds already added ahead of him (the setup adds them in order), so the second and third
// build's line is read off the payroll the first left. (The man a build replaces is waived: his money stays.)
// slot: his pick when the builds are seated together (buildSlots); his OVR's own slot without it.
export function buildCapNote(F, o, prev = 0, slot = buildSlot(o)) {
  const sh = X.capSheet(F, F.team)
  const r1 = v => Math.round(v * 10) / 10
  const add = X.rookieScale(slot, F.year)[0]
  const p0 = r1(sh.pay + prev), pay = r1(p0 + add)
  const free = !!sh.free
  const before = { ...sh, pay: p0, over: free ? 'under' : X.overOf(p0, sh.year) }
  const after = { ...sh, pay, over: free ? 'under' : X.overOf(pay, sh.year) }
  return { before, after, add, text: buildCapText(F, before, after) }
}
// a summer older (after ageLeague has aged him): a young build's grades go up a step at a time (two or three steps
// at 20-23, one or two to 27, maybe one at 28); his OVR follows his grades, his card follows him (F.builds)
export function growBuilds(F) {
  const out = []
  for (const s of Object.keys(F.teams)) for (const p of F.teams[s].r) {
    if (p.b == null) continue
    const B = F.builds[p.b]
    const R = rngOf(`${F.seed}-grow-${F.year}-${p.i}`)
    const T = TYPES[p.g] ?? []
    const was = p.o
    let up = p.ag <= 23 ? R.int(2, 3) : p.ag <= 27 ? R.int(1, 2) : p.ag <= 28 ? R.int(0, 1) : 0
    // (his coaches: a staff that develops players well is a step more now and then, a poor one a step less; coach.js)
    const dv = coachDev(F, s, { ...p, ag: p.ag - 1 })
    if (dv > 0 && R.u() < Math.min(0.6, dv * 0.5)) up++
    else if (dv < 0 && up > 0 && R.u() < Math.min(0.4, -dv * 0.5)) up--
    for (let k = 0; k < up; k++) {
      // (the lower grades first, the way a player works on what he can't do)
      const open = T.filter(t => p.a[t] < 11).sort((x, y) => p.a[x] - p.a[y] + (R.u() - 0.5) * 3)
      if (open.length) p.a[open[0]]++
    }
    p.o = ovrOfAttrs(p.g, p.a)
    p.pk = Math.max(p.pk ?? p.o, p.o)
    if (B) { B.age = p.ag; for (const t of T) if (B.build?.[t]) B.build[t] = { ...B.build[t], val: p.a[t] } }
    if (p.o !== was) out.push({ i: p.i, n: p.n, from: was, to: p.o })
  }
  return out
}
export { SPOTS }
