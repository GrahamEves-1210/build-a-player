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
// (owner 11-18) each build replaces the best starter at his spot, a second one the next best: they leave the team
// and go to the street; the setup's preview names the same men
const T = 'KC'
const B = [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Reed', num: 15 }, { pos: 'wr', build: asBuild(wr), name: 'Tre Holloway', num: 3 }, { pos: 'wr', build: asBuild(wr), name: 'Jalen Brooks', num: 4 }]
const P0 = { seed: 'preview', nid: 1 }; FR.buildTeams(P0); FR.calibrate(P0)
const said = FR.replacedBy(P0.teams[T], B).map(p => p && `${p.n} ${p.o}`)
console.log('setup says:', said.join(' | '))
const F = FR.createFranchise({ seed: 'chk-rep', team: T, owner: 'G', builds: B, coach: { name: 'C', style: 'players', r: Object.fromEntries(FR.CTYPES.map(t => [t, 5])), ovr: 50 } })
const r = F.teams[T].r
for (const s of said) { const n = s.replace(/ \d+$/, ''); if (r.some(p => p.n === n)) bad(`${n} still on the team`); if (!(F.fa ?? []).some(p => p.n === n)) bad(`${n} not on the street`) }
const L = FR.startersOf(F, T)
console.log('starters now:', Object.entries(L).filter(([, p]) => ['qb', 'wr'].includes(p.p)).map(([k, p]) => `${k} ${p.n} ${p.o}${p.b != null ? ' (build)' : ''}`).join(' | '))
console.log(problems.length ? `${problems.length} PROBLEM(S)` : 'replace: all good')
