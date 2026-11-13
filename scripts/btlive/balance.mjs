// BLACKTOP LIVE: is it balanced? Bots play whole games through the same step and referee the browser runs
// (src/lib/btlive), and the numbers are printed against the brief's targets (F:/bap-agents/btlive/DESIGN.md).
// Run from the repo root:
//   node scripts/btlive/balance.mjs [--runs=300] [--only=formula,equal,gap,pos,skill,tactics,builds]
// A bot is the CPU brain (cpu.js) with a level: how late it sees things, how far off its release is. The "human"
// levels are people's reaction time and timing error (the same table scripts/mg/balance.mjs uses); the tactic
// bots are that brain with one habit forced on it (swipe at everything, stand in the paint, shoot from one spot).
import { createGame, step, cpuInput, LEVELS, flatBuild, ovrOf, derive, referee, meterSpec, HZ, T, COURT } from '../../src/lib/btlive/index.js'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

// react: ms to see something and start moving; timing: sd in ms of a press aimed at a moment you can see coming
// (a hold-and-release on a meter you have learned is a little looser than a tap: x1.3)
const person = (react, timing, more) => ({ meterSd: timing * 1.3, react: Math.round(react / (1000 / HZ)), contest: 0.8, steal: 0.16, help: 0.45, ev: 0.08, move: 0.75, gap: 0.3, ...more })
export const HUMANS = {
  poor: person(440, 62, { contest: 0.55, ev: 0.16, move: 0.4, gap: 0.9 }),
  avg:  person(345, 42),
  good: person(285, 26, { contest: 0.9, ev: 0.05, move: 0.9, gap: 0.1 }),
  pro:  person(215, 12, { contest: 0.96, ev: 0.03, move: 0.95, gap: 0 }),
}

const gradeFor = ovr => 1 + (ovr - 57) / 44 * 9          // the flat grade that shows as this overall
export const flat = (pos, ovr, over) => flatBuild(pos, gradeFor(ovr), over)
const side = (builds, tag) => builds.map((b, i) => ({ id: `${tag}${i}`, name: `${tag}${i}`, pos: b.pos, build: b.build }))
const G = (ovr, over) => ({ pos: 'guard', build: flat('guard', ovr, over) })
const B = (ovr, over) => ({ pos: 'big', build: flat('big', ovr, over) })

// One game. bots[i]: (state, i) => input, for each player. Returns the tally.
export function playGame(teams, bots, seed) {
  const s = createGame({ teams: [side(teams[0], 'a'), side(teams[1], 'b')], seed })
  const inp = []
  const t = { poss: [0, 0], scored: [0, 0], pts: [0, 0], stl: [0, 0], blk: [0, 0], tov: [0, 0], oreb: [0, 0], dreb: [0, 0], ank: 0, fz: 0, poster: 0, deep: 0, chase: 0,
    shots: { jumper2: [[0, 0], [0, 0]], jumper1: [[0, 0], [0, 0]], layup: [[0, 0], [0, 0]], dunk: [[0, 0], [0, 0]] }, green: [0, 0], rel: [0, 0], cSum: [0, 0], why: {} }
  const cap = 30 * 60 * HZ
  while (s.phase !== 'over' && s.tick < cap) {
    for (let i = 0; i < s.players.length; i++) inp[i] = bots[i](s, i)
    step(s, inp)
    for (const e of s.events) {
      const tm = e.pid != null ? s.players[e.pid].team : e.team
      if (e.e === 'poss') { if (e.why !== 'oob-keep') { t.poss[e.team]++; if (e.pts) t.scored[e.team]++ } t.why[e.why] = (t.why[e.why] || 0) + 1 }
      else if (e.e === 'release') { const k = e.kind === 'jumper' ? (e.three ? 'jumper2' : 'jumper1') : e.kind; t.shots[k][tm][0]++; t.rel[tm]++; if (e.q >= 1) t.green[tm]++; t.cSum[tm] += e.c }
      else if (e.e === 'make') { const k = e.kind === 'jumper' ? (e.three ? 'jumper2' : 'jumper1') : e.kind; t.shots[k][tm][1]++; t.pts[tm] += e.pts; if (e.poster) t.poster++; if (e.deep) t.deep++ }
      else if (e.e === 'steal' || e.e === 'pick') t.stl[tm]++
      else if (e.e === 'block') { t.blk[tm]++; if (e.chase) t.chase++ }
      else if (e.e === 'oob' || e.e === 'clock') t.tov[tm]++
      else if (e.e === 'board' && e.reb) t[e.off ? 'oreb' : 'dreb'][tm]++
      else if (e.e === 'move') { if (e.ankles) t.ank++; else if (e.freeze) t.fz++ }
    }
  }
  return { ...t, winner: s.winner, score: s.score, secs: s.tick / HZ, stuck: s.phase !== 'over' }
}

const cpu = level => (s, i) => cpuInput(s, i, level)

// n games between two sides, the ball tipping to each side half the time (the seed decides)
export function series(a, b, botsA, botsB, n, tag) {
  const sum = { n: 0, winA: 0, poss: [0, 0], scored: [0, 0], pts: [0, 0], stl: 0, blk: 0, tov: 0, oreb: 0, dreb: 0, secs: 0, ank: 0, fz: 0, poster: 0, deep: 0, chase: 0, stuck: 0,
    shots: { jumper2: [[0, 0], [0, 0]], jumper1: [[0, 0], [0, 0]], layup: [[0, 0], [0, 0]], dunk: [[0, 0], [0, 0]] }, green: [0, 0], rel: [0, 0], c: [0, 0], close: 0, why: {} }
  const bots = [...a.map((_, i) => (typeof botsA === 'function' ? botsA : botsA[i])), ...b.map((_, i) => (typeof botsB === 'function' ? botsB : botsB[i]))]
  for (let g = 0; g < n; g++) {
    const r = playGame([a, b], bots, `${tag}-${g}`)
    sum.n++; if (r.stuck) { sum.stuck++; continue }
    if (r.winner === 0) sum.winA++
    if (Math.abs(r.score[0] - r.score[1]) <= 3) sum.close++
    for (const t of [0, 1]) { sum.poss[t] += r.poss[t]; sum.scored[t] += r.scored[t]; sum.pts[t] += r.pts[t]; sum.green[t] += r.green[t]; sum.rel[t] += r.rel[t]; sum.c[t] += r.cSum[t]
      for (const k in sum.shots) { sum.shots[k][t][0] += r.shots[k][t][0]; sum.shots[k][t][1] += r.shots[k][t][1] } }
    sum.stl += r.stl[0] + r.stl[1]; sum.blk += r.blk[0] + r.blk[1]; sum.tov += r.tov[0] + r.tov[1]; sum.oreb += r.oreb[0] + r.oreb[1]; sum.dreb += r.dreb[0] + r.dreb[1]
    sum.secs += r.secs; sum.ank += r.ank; sum.fz += r.fz; sum.poster += r.poster; sum.deep += r.deep; sum.chase += r.chase
    for (const k in r.why) sum.why[k] = (sum.why[k] || 0) + r.why[k]
  }
  return sum
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(0) + '%' : '-')
const f1 = x => x.toFixed(1)
const shotLine = (S, t) => ['jumper2', 'jumper1', 'layup', 'dunk'].map(k => `${k === 'jumper2' ? '3s' : k === 'jumper1' ? 'mid' : k} ${f1(S.shots[k][t][0] / S.n)}/g ${pct(S.shots[k][t][1], S.shots[k][t][0])}`).join('  ')
const possPct = (S, t) => pct(S.scored[t], S.poss[t])
const both = S => pct(S.scored[0] + S.scored[1], S.poss[0] + S.poss[1])
const verdict = (v, lo, hi) => (v >= lo && v <= hi ? 'ok' : v < lo ? 'LOW' : 'HIGH')
const head = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(4, 96 - t.length))}`)

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const runs = Number(args.find(a => a.startsWith('--runs='))?.slice(7)) || 300
  const only = args.find(a => a.startsWith('--only='))?.slice(7).split(',')
  const on = k => !only || only.includes(k)
  const AS = cpu('allstar'), AVG = cpu(HUMANS.avg)
  const t0 = Date.now()

  if (on('formula')) {
    head('The shot itself: open, perfect release (target: great shooter 55-60% on threes, about 90% on layups)')
    const mc = (kind, d, n, q = 1, c = 0) => referee.makeChance({ R: derive(flatBuild('guard', 1 + n * 10), 'guard'), kind, d, q, c, run: 0, cs: null, rushed: false })
    const row = (label, f) => console.log(label.padEnd(34), [1, 3, 5, 6, 7, 9, 11].map(g => `${g}: ${(100 * f((g - 1) / 10)).toFixed(0)}%`.padEnd(9)).join(' '))
    console.log('grade'.padEnd(34))
    row('three, top of the arc (26 ft)', n => mc('jumper', 26, n))
    row('three, corner (21.5 ft)', n => mc('jumper', 21.5, n))
    row('deep three (30 ft)', n => mc('jumper', 30, n))
    row('mid-range (15 ft)', n => mc('jumper', 15, n))
    row('layup (3 ft)', n => mc('layup', 3, n))
    row('dunk', n => mc('dunk', 2, n))
    row('three, contested hard (c 0.7)', n => mc('jumper', 24, n, 1, 0.7))
    row('three, slightly late (q 0.6)', n => mc('jumper', 24, n, 0.6))
    row('three, worst release (q 0)', n => mc('jumper', 24, n, 0))
    row('layup, contested hard (c 0.7)', n => mc('layup', 3, n, 1, 0.7))
    const w = (kind, n, gp) => meterSpec(kind, derive(flatBuild('guard', 1 + n * 10, gp != null ? { clutch: gp } : {}), 'guard'), gp != null).win
    console.log('green window, jumper (+/- ms)'.padEnd(34), [1, 3, 5, 6, 7, 9, 11].map(g => `${g}: ${w('jumper', (g - 1) / 10).toFixed(0)}`.padEnd(9)).join(' '))
    console.log('green window, layup (+/- ms)'.padEnd(34), [1, 3, 5, 6, 7, 9, 11].map(g => `${g}: ${w('layup', (g - 1) / 10).toFixed(0)}`.padEnd(9)).join(' '))
    console.log('...at game point, Clutch 1 / 11:'.padEnd(34), `${w('jumper', 0.5, 1).toFixed(0)} / ${w('jumper', 0.5, 11).toFixed(0)} ms (Jump Shot 6)`)
    const a = derive(flatBuild('guard', 1), 'guard'), z = derive(flatBuild('guard', 11, { size: 1 }), 'guard')
    console.log('top speed, slowest / fastest'.padEnd(34), `${a.top.toFixed(1)} / ${z.top.toFixed(1)} ft/s (${((z.top / a.top - 1) * 100).toFixed(0)}% quicker)`)
  }

  if (on('equal')) {
    head('Equal builds (target: score on 45-50% of possessions; steals and blocks a few a game)')
    console.log('game          bots     poss%   pts/poss  len    stl/g blk/g oreb% to/g  green  ankles/100g posters deep  close')
    for (const [name, mkTeam] of [['1v1 guards', o => [G(o)]], ['1v1 bigs', o => [B(o)]], ['2v2 g+b', o => [G(o), B(o)]], ['3v3 g+g+b', o => [G(o), G(o), B(o)]]]) {
      for (const [bn, bot, ovr] of [['allstar', AS, 80], ['allstar', AS, 92], ['avg human', AVG, 80], ['pro', cpu('pro'), 80]]) {
        const S = series(mkTeam(ovr), mkTeam(ovr), bot, bot, runs, `eq-${name}-${bn}-${ovr}`)
        const pp = (S.scored[0] + S.scored[1]) / (S.poss[0] + S.poss[1]) * 100
        console.log(`${name.padEnd(11)} ${String(ovr).padEnd(3)} ${bn.padEnd(11)} ${both(S).padEnd(4)} ${verdict(pp, 45, 50).padEnd(5)} ${((S.pts[0] + S.pts[1]) / (S.poss[0] + S.poss[1])).toFixed(2).padEnd(7)} ${(S.secs / S.n / 60).toFixed(1)}m  ${f1(S.stl / S.n).padEnd(5)} ${f1(S.blk / S.n).padEnd(5)} ${pct(S.oreb, S.oreb + S.dreb).padEnd(5)} ${f1(S.tov / S.n).padEnd(5)} ${pct(S.green[0] + S.green[1], S.rel[0] + S.rel[1]).padEnd(6)} ${String(Math.round(S.ank / S.n * 100)).padEnd(11)} ${String(Math.round(S.poster / S.n * 100)).padEnd(7)} ${String(Math.round(S.deep / S.n * 100)).padEnd(5)} ${pct(S.close, S.n)}${S.stuck ? '  STUCK ' + S.stuck : ''}`)
        if (bn === 'allstar') console.log(`              shots: ${shotLine(S, 0)}   ends: ${Object.entries(S.why).map(([k, v]) => `${k} ${f1(v / S.n)}`).join(' ')}`)
      }
    }
  }

  if (on('gap')) {
    head('A much better build: 95 OVR against 80 (target: wins 75-80% of games, never close to 100%)')
    for (const [name, mk] of [['1v1 guards', o => [G(o)]], ['1v1 bigs', o => [B(o)]], ['2v2 g+b', o => [G(o), B(o)]], ['3v3 g+g+b', o => [G(o), G(o), B(o)]]]) {
      for (const [bn, bot] of [['allstar', AS], ['avg human', AVG]]) {
        const S = series(mk(95), mk(80), bot, bot, runs, `gap-${name}-${bn}`)
        const w = 100 * S.winA / S.n
        console.log(`${name.padEnd(11)} ${bn.padEnd(11)} 95 wins ${w.toFixed(0)}% ${verdict(w, 75, 80).padEnd(5)} poss% ${possPct(S, 0)} v ${possPct(S, 1)}`)
      }
    }
    for (const [hi, lo] of [[88, 80], [85, 80], [99, 80]]) {
      const S = series([G(hi)], [G(lo)], AS, AS, runs, `gap2-${hi}`)
      console.log(`1v1 guards  allstar     ${hi} v ${lo}: wins ${pct(S.winA, S.n)}`)
    }
  }

  if (on('skill')) {
    head('Skill counts too: same build (80), different hands; and a person against each CPU level')
    for (const [a, b] of [['good', 'avg'], ['avg', 'poor'], ['pro', 'avg'], ['pro', 'poor']]) {
      const S = series([G(80)], [G(80)], cpu(HUMANS[a]), cpu(HUMANS[b]), runs, `sk-${a}-${b}`)
      console.log(`1v1  ${a.padEnd(5)} v ${b.padEnd(5)}  ${a} wins ${pct(S.winA, S.n).padEnd(5)} green ${pct(S.green[0], S.rel[0])} v ${pct(S.green[1], S.rel[1])}`)
    }
    for (const h of ['poor', 'avg', 'good', 'pro']) {
      console.log(`1v1  ${h.padEnd(5)} human wins against  ` + Object.keys(LEVELS).map(l => { const S = series([G(80)], [G(80)], cpu(HUMANS[h]), cpu(l), runs, `hl-${h}-${l}`); return `${l} ${pct(S.winA, S.n)}` }).join('   '))
    }
    const S = series([G(80)], [G(92)], cpu(HUMANS.pro), cpu(HUMANS.poor), runs, 'sk-vs-build')
    console.log(`1v1  pro hands on an 80 against poor hands on a 92: the 80 wins ${pct(S.winA, S.n)}`)
  }

  if (on('pos')) {
    head('Guards and bigs are both worth playing (same overall, target: neither side far from 50%)')
    for (const ovr of [80, 90]) {
      const S = series([G(ovr)], [B(ovr)], AS, AS, runs, `pos-${ovr}`)
      console.log(`1v1 guard v big ${ovr}:       guard wins ${pct(S.winA, S.n).padEnd(5)} poss% ${possPct(S, 0)} v ${possPct(S, 1)}   guard: ${shotLine(S, 0)}`)
      console.log(`${' '.repeat(62)} big:   ${shotLine(S, 1)}`)
    }
    for (const [an, a, bn, b] of [['g+g+g', [G(82), G(82), G(82)], 'g+g+b', [G(82), G(82), B(82)]], ['g+b+b', [G(82), B(82), B(82)], 'g+g+b', [G(82), G(82), B(82)]], ['b+b+b', [B(82), B(82), B(82)], 'g+g+g', [G(82), G(82), G(82)]], ['g+g', [G(82), G(82)], 'g+b', [G(82), B(82)]]]) {
      const S = series(a, b, AS, AS, runs, `comp-${an}-${bn}`)
      console.log(`${an} v ${bn}:  ${an} wins ${pct(S.winA, S.n).padEnd(5)} oreb ${f1(S.oreb / S.n)}/g`)
    }
  }

  if (on('builds')) {
    head('A build plays like what it is (all 84 overall; 1v1 against each other, all-star bots)')
    const mkG = over => { const keys = Object.keys(over); const rest = (gradeFor(84) * 10 - keys.reduce((s, k) => s + over[k], 0)) / (10 - keys.length); return { pos: 'guard', build: flatBuild('guard', rest, over) } }
    const mkB = over => { const keys = Object.keys(over); const rest = (gradeFor(84) * 10 - keys.reduce((s, k) => s + over[k], 0)) / (10 - keys.length); return { pos: 'big', build: flatBuild('big', rest, over) } }
    const A = {
      shooter: mkG({ jumpShot: 11, clutch: 9, finishing: 4, bounce: 3 }),
      slasher: mkG({ finishing: 10.5, handles: 10, speed: 10, bounce: 9, jumpShot: 3 }),
      lockdown: mkG({ perimeterDefense: 11, speed: 9.5, size: 8, jumpShot: 4 }),
      balanced: G(84),
      'rim big': mkB({ interiorDefense: 11, rebounding: 10.5, size: 11, bounce: 9, jumpShot: 2, speed: 3 }),
      'stretch big': mkB({ jumpShot: 10, size: 9, finishing: 6, interiorDefense: 6 }),
    }
    const names = Object.keys(A)
    console.log(''.padEnd(13) + names.map(n => n.padEnd(12)).join('') + 'avg   ovr')
    const lines = {}
    for (const a of names) {
      let row = a.padEnd(13), tot = 0
      for (const b of names) {
        if (a === b) { row += '-'.padEnd(12); continue }
        const S = series([A[a]], [A[b]], AS, AS, Math.round(runs * 0.6), `arch-${a}-${b}`)
        row += pct(S.winA, S.n).padEnd(12); tot += S.winA / S.n
        if (b === 'balanced') lines[a] = `${shotLine(S, 0)}   stl ${f1(S.stl / S.n)} blk ${f1(S.blk / S.n)} oreb ${f1(S.oreb / S.n)}`
      }
      console.log(row + (100 * tot / (names.length - 1)).toFixed(0) + '%   ' + ovrOf(A[a].build))
    }
    console.log('what each takes against the balanced guard:')
    for (const a of names) if (lines[a]) console.log(`  ${a.padEnd(12)} ${lines[a]}`)
  }

  if (on('ratings')) {
    head('Every rating does something: an 80 build with one rating at 11 (or at 1), against the plain 80 (all-star bots)')
    const keysG = ['jumpShot', 'finishing', 'passing', 'handles', 'perimeterDefense', 'speed', 'bounce', 'size', 'basketballIQ', 'clutch']
    const keysB = ['jumpShot', 'finishing', 'rebounding', 'playmaking', 'interiorDefense', 'speed', 'bounce', 'size', 'basketballIQ', 'clutch']
    for (const [pos, keys, mk] of [['guard', keysG, G], ['big', keysB, B]]) {
      console.log(`1v1 ${pos}s`.padEnd(22) + 'at 11: wins   poss% for / against      at 1: wins   poss% for / against')
      for (const k of keys) {
        const hi = series([mk(80, { [k]: 11 })], [mk(80)], AS, AS, runs, `rt-${pos}-${k}-hi`), lo = series([mk(80, { [k]: 1 })], [mk(80)], AS, AS, runs, `rt-${pos}-${k}-lo`)
        console.log(`  ${k.padEnd(20)} ${pct(hi.winA, hi.n).padEnd(13)} ${possPct(hi, 0)} / ${possPct(hi, 1)}`.padEnd(62) + `${pct(lo.winA, lo.n).padEnd(12)} ${possPct(lo, 0)} / ${possPct(lo, 1)}`)
      }
    }
    console.log('2v2 (guard + big), the one rating on both teammates')
    for (const k of ['passing', 'playmaking', 'basketballIQ', 'rebounding']) {
      const t = v => [G(80, k === 'passing' || k === 'basketballIQ' ? { [k]: v } : {}), B(80, k !== 'passing' ? { [k]: v } : {})]
      const hi = series(t(11), [G(80), B(80)], AS, AS, runs, `rt2-${k}-hi`), lo = series(t(1), [G(80), B(80)], AS, AS, runs, `rt2-${k}-lo`)
      console.log(`  ${k.padEnd(20)} ${pct(hi.winA, hi.n).padEnd(13)} ${possPct(hi, 0)} / ${possPct(hi, 1)}`.padEnd(62) + `${pct(lo.winA, lo.n).padEnd(12)} ${possPct(lo, 0)} / ${possPct(lo, 1)}`)
    }
  }

  if (on('tactics')) {
    head('No one tactic wins (same 82 build, the tactic against a competent all-star bot; target: under 50%)')
    const base = cpu('allstar')
    // swipes every time the cooldown is up, on defense
    const stealSpam = (s, i) => { const o = base(s, i); if (s.players[i].team !== s.poss && s.ball.st === 'held') { o.steal = s.tick % 2 === 0 } return o }
    // stands under the rim on defense and jumps at anything near
    const paintCamp = (s, i) => {
      const o = base(s, i), p = s.players[i]
      if (p.team !== s.poss && s.ball.st === 'held') {
        const dx = COURT.rim.x - p.x, dy = COURT.rim.y + 3 - p.y, d = Math.hypot(dx, dy)
        o.mx = d > 0.6 ? dx / d : 0; o.my = d > 0.6 ? dy / d : 0; o.steal = false
        const h = s.players[s.ball.holder]
        o.jump = h.act === 'gather' && Math.hypot(h.x - p.x, h.y - p.y) < 5 && h.actT >= 3
      }
      return o
    }
    // walks to one spot and shoots, every time
    const spot = (x, y) => (s, i) => {
      const o = base(s, i), p = s.players[i]
      if (s.ball.st === 'held' && s.ball.holder === i && p.act !== 'gather') {
        const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy)
        o.move = false; o.pass = false; o.q = null
        if (d > 0.8) { o.mx = dx / d; o.my = dy / d; o.shoot = false } else { o.mx = 0; o.my = 0; o.shoot = true }
      }
      return o
    }
    // shoots the moment the ball is live
    const chuck = (s, i) => { const o = base(s, i), p = s.players[i]; if (s.ball.st === 'held' && s.ball.holder === i && p.act !== 'gather') { o.shoot = true; o.move = false; o.pass = false } return o }
    // jumps at everything on defense
    const jumpSpam = (s, i) => { const o = base(s, i); if (s.players[i].team !== s.poss && s.ball.st === 'held') o.jump = s.tick % 2 === 0; return o }
    // never uses a button on defense, just stays in front
    const tests = [['swipe at everything', stealSpam], ['camp in the paint', paintCamp], ['jump at everything', jumpSpam], ['same spot: right wing three', spot(47.8, 23.5)], ['same spot: corner three', spot(50.4, 7)],
      ['same spot: elbow', spot(36.5, 18)], ['shoot on the check', chuck]]
    for (const [pos, mk] of [['guard', G], ['big', B]]) for (const [name, bot] of tests) {
      const S = series([mk(82)], [mk(82)], bot, base, runs, `tac-${name}`)
      const w = 100 * S.winA / S.n
      console.log(`1v1 ${pos.padEnd(6)} ${name.padEnd(30)} wins ${w.toFixed(0)}% ${(w <= 50 ? 'ok' : 'HIGH').padEnd(5)} poss% ${possPct(S, 0)} v ${possPct(S, 1)}  stl ${f1(S.stl / S.n)} blk ${f1(S.blk / S.n)}`)
    }
    for (const [name, bot] of [['shooter: same spot three', spot(47.8, 23.5)], ['shooter: shoot on the check', chuck]]) {
      const sh = { pos: 'guard', build: flatBuild('guard', (gradeFor(84) * 10 - 11) / 9, { jumpShot: 11 }) }
      const S = series([sh], [sh], bot, base, runs, `tac-${name}`)
      const w = 100 * S.winA / S.n
      console.log(`1v1 guard  ${name.padEnd(30)} wins ${w.toFixed(0)}% ${(w <= 50 ? 'ok' : 'HIGH').padEnd(5)} poss% ${possPct(S, 0)} v ${possPct(S, 1)}`)
    }
    for (const [name, bot] of [['swipe at everything', stealSpam], ['camp in the paint', paintCamp]]) {
      const S = series([G(82), G(82), B(82)], [G(82), G(82), B(82)], [bot, base, base], base, runs, `tac3-${name}`)
      console.log(`3v3 one player: ${name.padEnd(25)} his team wins ${pct(S.winA, S.n)}`)
    }
  }
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)} s, ${runs} games a line`)
}
