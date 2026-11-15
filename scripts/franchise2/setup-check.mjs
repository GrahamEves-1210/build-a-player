// Agent A's checks: the coach spin, the coach's effect on the games and on growth, the builds' names and numbers.
//   bash scripts/franchise2/run.sh scripts/franchise2/setup-check.mjs
import * as FR from '../../src/lib/franchise2/index'
import { QBS } from '../../src/data/qbs'
import { WRS } from '../../src/data/wrs'
import { seeded } from '../../src/lib/rng'

const problems = []
const bad = m => { problems.push(m); console.log('  !! ' + m) }
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const qb = QBS.find(p => p.name === 'Josh Allen'), wr = WRS.find(p => p.attrs && p.name === 'Puka Nacua') ?? WRS.find(p => p.attrs)

// ── the spin: head coaches only, never the player's own team's, nobody twice, the respin never where it started
for (const team of ['DEN', 'KC', 'CHI']) {
  let cb = FR.newCoachBuild('chk-' + team, team)
  const seen = new Set()
  for (let k = 0; k < 5; k++) {
    cb = { ...cb, cur: FR.dealSpin(cb), n: cb.n + 1 }
    const c = FR.coachByName(cb.cur.t, cb.cur.c)
    if (!c || c.role !== 'HC') bad(`spin landed on a non head coach ${cb.cur.c}`)
    if (cb.cur.t === team) bad(`spin landed on ${team}'s own coach`)
    if (seen.has(cb.cur.c)) bad(`spin dealt ${cb.cur.c} twice`)
    seen.add(cb.cur.c)
    if (k === 2) { const r = FR.dealRespin(cb); if (r.c === cb.cur.c || r.t === team) bad('respin landed where it started'); cb = { ...cb, cur: r, rs: 1 } }
    const open = FR.CTYPES.filter(t => !cb.lines[t])
    cb = FR.takeLine(cb, open[0])
  }
  if (!FR.linesDone(cb)) bad('five spins did not fill five lines')
  const coach = FR.finishCoach(cb, { name: 'Chk Coach', face: null, style: 'developer' })
  if (coach.ovr < 40 || coach.ovr > 99) bad(`coach ovr ${coach.ovr}`)
  if (team === 'DEN') console.log('spin', [...seen].join(', '), '→ OVR', coach.ovr, JSON.stringify(coach.r))
}
// every team's head coach on file
for (const s of FR.SHORTS) if (!FR.realHC(s)) bad(`${s} has no head coach`)

// ── names and numbers
const T = 'KC'
const setupBuilds = [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Reed', num: 15 }, { pos: 'wr', build: asBuild(wr), name: 'Tre  Hollo$way', num: 3 }, { pos: 'wr', build: asBuild(wr), name: 'Jalen Brooks', num: 3 }]
const coachOf = r => ({ name: 'Chk', style: 'players', r: Object.fromEntries(FR.CTYPES.map(t => [t, r])), ovr: FR.coachOvr(Object.fromEntries(FR.CTYPES.map(t => [t, r]))) })
let F = FR.createFranchise({ seed: 'chk-names', team: T, owner: 'Graham', builds: setupBuilds, coach: coachOf(6) })
const taken = FR.realNumbers(T)
console.log('names', F.builds.map(b => `${b.name} #${b.num} (${b.pos})`).join(' · '))
if (F.builds[0].num === 15 && taken.has(15)) bad('#15 given though a real Chief wears it')
if (F.builds[1].name !== 'Tre Holloway') bad(`name not cleaned: ${F.builds[1].name}`)
if (F.builds[1].num === F.builds[2].num) bad('two builds wear the same number')
for (const b of F.builds) { if (!FR.legalFor(b.pos, b.num)) bad(`${b.name} wears an illegal ${b.num}`); const p = F.teams[T].r.find(x => x.i === b.pid); if (p?.n !== b.name) bad(`roster name ${p?.n} is not ${b.name}`); if (b.age !== 22) bad('a build is not a rookie') }

// ── the coach in the games: a 10 coach against a 1 coach on the same team, same seeds
function season(r, team = 'NYJ') {
  let w = 0, g = 0, pf = 0, pa = 0
  const X = FR.createFranchise({ seed: 'chk-coach', team, owner: 'Graham', builds: [], coach: coachOf(r) })
  while (X.phase === 'season') { FR.playWeek(X, { moments: false }); if (X.ev) FR.chooseEvent(X, 0) }
  const rec = FR.records(X)[team]; w += rec.w; g += rec.w + rec.l + rec.t
  for (const row of X.log) { pf += row.us; pa += row.them }
  return { w, g, pf, pa, F: X }
}
const hi = season(10), lo = season(1), mid = season(5)
const st = s => `${s.w}-${s.g - s.w} pts ${s.pf}-${s.pa}`
console.log('NYJ year one, coach 10:', st(hi), '· coach 5:', st(mid), '· coach 1:', st(lo))
console.log('strength 10/5/1', JSON.stringify(FR.strength(hi.F, 'NYJ')), JSON.stringify(FR.strength(mid.F, 'NYJ')), JSON.stringify(FR.strength(lo.F, 'NYJ')))
if (FR.strength(hi.F, 'NYJ').off <= FR.strength(lo.F, 'NYJ').off) bad('offensive play-calling does not lift the offense')
// over many seeded seasons the better coach wins more
let wHi = 0, wLo = 0
for (let k = 0; k < 10; k++) {
  for (const [r, add] of [[9, v => (wHi += v)], [2, v => (wLo += v)]]) {
    const X = FR.createFranchise({ seed: 'chk-many-' + k, team: 'CIN', owner: 'G', builds: [], coach: coachOf(r) })
    while (X.phase === 'season') { FR.playWeek(X, { moments: false }); if (X.ev) FR.chooseEvent(X, 0) }
    add(FR.records(X).CIN.w)
  }
}
console.log(`CIN over 10 seasons: coach 9 ${wHi} wins, coach 2 ${wLo} wins`)
if (wHi <= wLo) bad('a better coach does not win more')
// the team ratings (ratings.js): the OVR is its two sides, and the sim plays the numbers on screen
// (scripts/franchise2/team-ratings.mjs checks the spread and the odds)
const P = FR.createFranchise({ seed: 'chk-cal', team: 'DEN', owner: 'G', builds: [], coach: coachOf(5) })
let off = 0
for (const t of FR.TEAMS) { const x = FR.strength(P, t.short); off = Math.max(off, Math.abs(x.ovr - Math.round((x.offR + x.defR) / 2)), Math.abs(FR.sideGrade(x.off) === FR.gradeOf(x.offR) ? 0 : 1)) }
console.log('largest year-one gap between a team OVR and its two sides:', off)
if (off > 0) bad(`a team's OVR or letter does not follow its two sides`)
// growth: the coach's talent development
const young = { ag: 22 }
if (!(FR.coachDev({ team: 'X', coach: coachOf(10) }, 'X', young) > FR.coachDev({ team: 'X', coach: coachOf(1) }, 'X', young))) bad('talent development does not change growth')
console.log('coachDev 10 / 5 / 1:', [10, 5, 1].map(r => FR.coachDev({ team: 'X', coach: coachOf(r) }, 'X', young)).join(' / '), '· chemWeek', [10, 5, 1].map(r => FR.chemWeek({ coach: coachOf(r) })).join(' / '))
void seeded

console.log(problems.length ? `\n${problems.length} PROBLEM(S)` : '\nclean')
process.exit(problems.length ? 1 : 0)
