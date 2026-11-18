// The key moments' play art against the engines (owner, 2026-11-17: "the key moments play picker should use play art
// not just the concept"). The art is drawn from the engines' own line-ups (throw.js passLook, goalline.js fadeLook,
// kickret.js runLook, hitstick.js stopLook); this plays each engine's make() on the same seed the moment uses and
// checks the art lines the men up where the engine does, routes and all.
//   bash scripts/franchise2/run.sh scripts/franchise2/play-art-check.mjs [seeds=60]
import * as THROW from '../../src/lib/mg/throw.js'
import * as GOAL from '../../src/lib/mg/goalline.js'
import * as KR from '../../src/lib/mg/kickret.js'
import { PLAYS } from '../../src/lib/franchise2/moments.js'
import { playArt } from '../../src/lib/franchise2/playArt.js'

const N = Number(process.argv[2] ?? 60)
const bad = []
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e
const samePts = (a, b) => a.length === b.length && a.every((p, i) => near(p[0], b[i][0]) && near(p[1], b[i][1]))
let n = 0
const sit = (extra = {}) => ({ us: 'DEN', them: 'KC', mine: 14, opp: 17, clockText: '2:00', period: '4th', down: 3, togo: 6, toGoal: 40, goal: false, los: 60, dist: 6, ...extra })
for (let i = 0; i < N; i++) {
  const v = { seed: `art-${i}`, ball: 'us', down: 3, d: 6, y: 60, goal: false, kind: 'late', opp: 'KC', mine: 14, theirs: 17 }
  // the pass plays: every man's spot and route as makePlay has it
  for (const id of Object.keys(PLAYS).filter(k => PLAYS[k].game === 'fr-pass')) {
    const seed = `${v.seed}-${id}`
    const g = THROW.make({ v: 6, arm: 6, seed, game: 'fr-pass', situation: sit({ call: PLAYS[id].call }) })
    const L = THROW.passLook(seed, PLAYS[id].call)
    for (const k of ['X', 'H', 'Z', 'TE', 'RB', 'QB']) {
      const p = g[k], [x, y, pts] = L.men[k]
      n++
      if (!near(p.x0, x) || !near(p.y0, y)) bad.push(`${seed} ${k}: art at ${x},${y}, engine at ${p.x0},${p.y0}`)
      if ((p.path?.pts ?? null) === null ? pts != null : !samePts(p.path.pts, pts ?? [])) bad.push(`${seed} ${k}: route differs`)
    }
    g.OL.forEach((o, j) => { n++; if (!near(o.x0, L.men.OL[j][0])) bad.push(`${seed} OL${j}: art ${L.men.OL[j][0]}, engine ${o.x0}`) })
    if (!playArt(v, id)?.paths?.length) bad.push(`${seed}: no art`)
  }
  // the goal-line pass: the four routes
  {
    const seed = `${v.seed}-fade`
    const g = GOAL.make({ v: 6, arm: 6, seed, game: 'fr-fade', pos: 'qb' })
    const L = GOAL.fadeLook(seed)
    for (const p of g.recs) {
      const a = L.men[p.id]
      n++
      if (!a || a.name !== p.name || !samePts(a.pts, [[p.ax, p.ay], [p.bx, p.by], [p.cx, p.cy]])) bad.push(`${seed} ${p.id}: art ${a?.name}, engine ${p.name}`)
    }
  }
  // the runs: the line-up, the back and the hole
  for (const id of Object.keys(PLAYS).filter(k => PLAYS[k].game === 'fr-run')) {
    const art = playArt(v, id)
    const g = KR.make({ v: 6, seed: `${v.seed}-${id}`, game: 'fr-run', pos: 'rb', situation: sit({ hole: PLAYS[id].hole, side: art.side }) })
    const L = KR.runLook(PLAYS[id].hole, art.side)
    const mid = 80 / 3, los = g.scrim.los
    const ours = [...L.o.ol, L.o.te, L.o.wr[0], L.o.wr[1], L.o.qb, L.o.slot]
    g.ours.forEach((o, j) => { n++; if (!near(o.x - mid, ours[j][0], 1e-9) || !near(o.d - los, ours[j][1], 1e-9)) bad.push(`${id} ours ${j}: art ${ours[j]}, engine ${[o.x - mid, o.d - los]}`) })
    n++
    if (!near(g.scrim.hx - mid, L.hole, 1e-9)) bad.push(`${id}: hole art ${L.hole}, engine ${g.scrim.hx - mid}`)
    g.cover.slice(0, 4).forEach((c, j) => { n++; if (!near(c.x - mid, L.d.front[j][0], 1e-9)) bad.push(`${id} front ${j}`) })
  }
}
console.log(`play art: ${n} spots and routes checked against the engines over ${N} seeds: ${bad.length ? `${bad.length} DIFFERENT` : 'all the same'}`)
for (const b of bad.slice(0, 20)) console.log('  !! ' + b)
// what the picker draws, one of each
for (const id of Object.keys(PLAYS)) { const a = playArt({ seed: 'show', ball: id === 'stop' ? 'them' : 'us', down: 3, d: 4, y: id === 'fade' ? 95 : 60, goal: id === 'fade' }, id); console.log(`   ${id}: ${a.men.length} men, ${a.paths.length} paths (${[...new Set(a.paths.map(p => p.k))].join(', ')})`) }
console.log(bad.length ? 'PROBLEMS' : 'OK')
