// NBA FRANCHISE: the 82-game schedule, the NBA's formula.
//   4 games against each of the 4 division rivals (16)
//   4 games against 6 of the other 10 conference teams, 3 against the other 4 (36)
//   2 games against each of the 15 teams in the other conference (30)
// 41 home, 41 away. The 3-game opponents rotate by seed (the league rotates them by year): two from each of the
// other two divisions, one with two home games and one with two road games.
// The days: opening night the third Tuesday of October, the last night the second Sunday of April, about 165 nights
// with games and a week off for the All-Star break in mid-February; the trade deadline the first Thursday of
// February. Each team plays at most one game a night, never three nights in a row, and about 14 back-to-backs.
import { SHORTS, DIVS, CONF_DIVS, DIV_OF, CONF_OF } from './league'
import { rngOf } from '../rng'

export function opponents(seed) {
  const R = rngOf(`${seed}-opp`)
  const games = []   // [home, away, kind]
  const add = (h, a, k, n = 1) => { for (let i = 0; i < n; i++) games.push([h, a, k]) }
  // division: 2 home, 2 away
  for (const d of Object.values(DIVS)) for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length; j++) { add(d[i], d[j], 'div', 2); add(d[j], d[i], 'div', 2) }
  // conference, outside the division
  for (const ds of Object.values(CONF_DIVS)) {
    const three = new Map()   // 'A|B' -> home team of the extra game (2 home, 1 away for it)
    for (let x = 0; x < 3; x++) for (let y = x + 1; y < 3; y++) {
      const A = R.shuffle(DIVS[ds[x]]), B = R.shuffle(DIVS[ds[y]])
      for (let i = 0; i < 5; i++) {
        three.set(`${A[i]}|${B[i]}`, A[i])              // A[i] home twice
        three.set(`${A[i]}|${B[(i + 1) % 5]}`, B[(i + 1) % 5])   // B[i+1] home twice
      }
    }
    const conf = ds.flatMap(d => DIVS[d])
    for (let i = 0; i < conf.length; i++) for (let j = i + 1; j < conf.length; j++) {
      const a = conf[i], b = conf[j]
      if (DIV_OF[a] === DIV_OF[b]) continue
      const h3 = three.get(`${a}|${b}`) ?? three.get(`${b}|${a}`)
      if (h3) { const o = h3 === a ? b : a; add(h3, o, 'conf', 2); add(o, h3, 'conf', 1) }
      else { add(a, b, 'conf', 2); add(b, a, 'conf', 2) }
    }
  }
  // the other conference: one home, one away
  const E = SHORTS.filter(s => CONF_OF[s] === 'E'), W = SHORTS.filter(s => CONF_OF[s] === 'W')
  for (const a of E) for (const b of W) { add(a, b, 'other'); add(b, a, 'other') }
  return games
}

// ── Dates ────────────────────────────────────────────────────────────────────
const nthDow = (y, m, dow, n) => { const d = new Date(Date.UTC(y, m, 1)); const off = (dow - d.getUTCDay() + 7) % 7; return new Date(Date.UTC(y, m, 1 + off + 7 * (n - 1))) }
const DAY = 86400000
export function calendar(year) {
  const open = nthDow(year, 9, 2, 3)                 // third Tuesday of October
  const end = nthDow(year + 1, 3, 0, 2)              // second Sunday of April
  const ddl = nthDow(year + 1, 1, 4, 1)              // first Thursday of February
  const asg = nthDow(year + 1, 1, 0, 3)              // All-Star Sunday, third Sunday of February
  const asbFrom = new Date(asg.getTime() - 3 * DAY), asbTo = new Date(asg.getTime() + 3 * DAY)   // Thu..Wed, no games
  return { open, end, ddl, asg, asbFrom, asbTo }
}
export const dateOf = (F, d) => new Date(F.cal0 + d * DAY)
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
export const dateText = (F, d) => { const x = dateOf(F, d); return `${MON[x.getUTCMonth()]} ${x.getUTCDate()}` }

// The season: F.sched (games in day order, each { d, h, a, k }), F.cal0 (opening night, ms), F.days (the last day
// + 1), F.asb [from, to] (the break's days), F.ddl (the deadline's day: the last day trades go through)
export function makeSchedule(F) {
  const R = rngOf(`${F.seed}-sched-${F.year}`)
  const C = calendar(F.year)
  const dayN = x => Math.round((x.getTime() - C.open.getTime()) / DAY)
  const last = dayN(C.end), asb = [dayN(C.asbFrom), dayN(C.asbTo)], ddl = dayN(C.ddl)
  const nights = []
  for (let d = 0; d <= last; d++) if (d < asb[0] || d > asb[1]) nights.push(d)
  let pool = R.shuffle(opponents(F.seed + F.year)).map(([h, a, k]) => ({ h, a, k }))
  let out = null
  for (let tries = 0; tries < 12 && !out; tries++) out = place(R.shuffle(pool), nights, R, last)
  if (!out) throw new Error('NBA schedule: no fit')
  F.sched = out.sort((x, y) => x.d - y.d)
  F.cal0 = C.open.getTime(); F.days = last + 1; F.asb = asb; F.ddl = ddl
  F.day = 0
  return F.sched
}
// game nights greedily: each night the teams furthest behind their share take the games they can play, the ones
// who rested last night first (a back-to-back only when a team is falling behind)
// (a night's size by the day of the week, opening night a Tuesday: the league's busy Wednesdays and Fridays, its
// light Thursdays)
const DOW = [0.8, 1.45, 0.55, 1.35, 1.0, 0.95, 0.9].map(x => x * 7 / 7.0)
function place(pool, nights, R, last) {
  const left = pool.slice()
  const played = Object.fromEntries(SHORTS.map(s => [s, []]))
  const out = []
  const lastOf = s => played[s][played[s].length - 1]
  for (let k = 0; k < nights.length; k++) {
    const d = nights[k]
    const share = (k + 1) / nights.length
    const behind = s => 82 * share - played[s].length
    const want = Math.max(2, Math.min(15, Math.round(left.length / (nights.length - k) * DOW[d % 7] + (R.u() - 0.5) * 3)))
    const yest = s => (lastOf(s) === d - 1 ? 1 : 0)
    const can = s => !(lastOf(s) === d - 1 && played[s][played[s].length - 2] === d - 2)
    const score = g => behind(g.h) + behind(g.a) - 0.05 * (yest(g.h) + yest(g.a)) + R.u() * 0.5
    const cand = left.filter(g => can(g.h) && can(g.a)).map(g => [score(g), g]).sort((x, y) => y[0] - x[0])
    const used = new Set()
    let n = 0
    for (const [sc, g] of cand) {
      if (n >= want) break
      if (used.has(g.h) || used.has(g.a)) continue
      used.add(g.h); used.add(g.a)
      played[g.h].push(d); played[g.a].push(d)
      out.push({ d, h: g.h, a: g.a, k: g.k })
      left.splice(left.indexOf(g), 1); n++
    }
  }
  // what's left goes on any night both teams are free that keeps them off three nights in a row
  for (const g of left.splice(0)) {
    const free = (s, d) => { const P = played[s]; return !P.includes(d) && !(P.includes(d - 1) && P.includes(d - 2)) && !(P.includes(d + 1) && P.includes(d + 2)) && !(P.includes(d - 1) && P.includes(d + 1)) }
    const d = nights.find(d => free(g.h, d) && free(g.a, d) && !played[g.h].includes(d - 1) && !played[g.h].includes(d + 1) && !played[g.a].includes(d - 1) && !played[g.a].includes(d + 1))
      ?? nights.find(d => free(g.h, d) && free(g.a, d))
    if (d == null) { left.push(g); continue }
    for (const s of [g.h, g.a]) { played[s].push(d); played[s].sort((x, y) => x - y) }
    out.push({ d, h: g.h, a: g.a, k: g.k })
  }
  return left.length ? null : out
}
export const b2bOf = (F, g) => {
  const was = s => F.sched.some(x => x.d === g.d - 1 && (x.h === s || x.a === s))
  return { h: was(g.h), a: was(g.a) }
}
export function scheduleProblems(F) {
  const bad = []
  const n = Object.fromEntries(SHORTS.map(s => [s, { g: 0, h: 0, b2b: 0, days: [] }]))
  for (const g of F.sched) { n[g.h].g++; n[g.h].h++; n[g.a].g++; n[g.h].days.push(g.d); n[g.a].days.push(g.d) }
  for (const s of SHORTS) {
    const x = n[s]
    if (x.g !== 82) bad.push(`${s} plays ${x.g}`)
    if (x.h !== 41) bad.push(`${s} has ${x.h} home games`)
    const D = x.days.sort((a, b) => a - b)
    for (let i = 1; i < D.length; i++) { if (D[i] === D[i - 1]) bad.push(`${s} twice on day ${D[i]}`); if (D[i] === D[i - 1] + 1) x.b2b++ }
    for (let i = 2; i < D.length; i++) if (D[i] === D[i - 2] + 2 && D[i - 1] === D[i] - 1) bad.push(`${s} three nights in a row at ${D[i]}`)
    if (x.b2b > 20 || x.b2b < 7) bad.push(`${s} has ${x.b2b} back-to-backs`)
  }
  for (const g of F.sched) if (g.d >= F.asb[0] && g.d <= F.asb[1]) bad.push(`game in the All-Star break ${g.h}-${g.a}`)
  return { bad, b2b: Object.fromEntries(SHORTS.map(s => [s, n[s].b2b])) }
}
