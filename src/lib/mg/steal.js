// STEAL SECOND: on first, the pitcher in the stretch, the catcher's arm waiting. From behind the runner at first:
//   the lead  the stick (left/right, the arrows) walks his lead out or back in. A bigger lead is a shorter run, but the
//             pitcher throws over more and the way back's longer.
//   the read  the pitcher's first move. A right-hander: the front knee comes up and he's going home: GO (SPACE). His
//             back foot comes off and he spins: he's throwing over: BACK (E), and dive. A lefty looks at you the whole
//             time and his leg comes up either way: watch where his foot comes down. Going before he moves is a guess,
//             and a guess on a pickoff is an out.
//   the race  his speed and his read against the pitcher's time to the plate (a slide step is quicker) and the
//             catcher's pop time: the throw, the slide, the tag, the call at second.
// He has three pitches to go; stay put and the chance is gone.
import { clamp, lerp, prog, outcome, rngOf, easeOut, nudge, manOf, lightMode, text, DISPLAY, LABEL, rr, GOOD, BAD, GOLD } from './kit.js'
import { placeStamp } from './read.js'
import { momentSituation } from '../situations.js'
import {
  camOf, P, staticPark, baller, ballB, uniforms, dressB, BP, mixB, runB, pitchPose, throwPose, flipB,
  scorebug, crowdRise, flashesB, celebMsB, skipOutroB, padCtl, padInput, padStick, drawPads,
  FIRST, SECOND, RUBBER, MOUND_H, gauss, lineB,
  hudB, promptB,
} from './baseball.js'

export const how = {
  'steal-second': 'On first with three pitches to go. Walk the lead out with the stick, then read the pitcher’s first move: the knee comes up toward home, GO; he spins or his foot comes down toward first, BACK. Get a jump and beat the catcher’s throw to second.',
}

const BASE = 27.43
// the line from first to second: where a man is at d metres off first toward second
const U = { x: (SECOND.x - FIRST.x) / BASE, z: (SECOND.z - FIRST.z) / BASE }
const onPath = d => ({ x: FIRST.x + U.x * d, z: FIRST.z + U.z * d })
const LEAD0 = 3.2, LEAD_MIN = 1.8, LEAD_MAX = 4.9

export function make({ v, seed, cast = null, situation = null, game = 'steal-second' }) {
  const r = rngOf(seed), tv = clamp((v - 1) / 10, 0, 1)
  const sit = situation && (situation.baseball || situation.on) ? situation : momentSituation(game, seed, { us: situation?.us ?? 'HOME', them: situation?.them ?? 'AWAY' })
  const me = cast?.me ?? manOf(cast, 'us', 'bat', 0)
  const pm = cast?.them?.pit?.[0] ?? null
  const throws = pm?.throws ?? (r() < 0.32 ? 'L' : 'R')
  // the battery: how quick he is to the plate, how fast the catcher gets it down there (real: 1.3-1.6 s to the
  // plate, 1.85-2.1 s pop to pop)
  const catcherArm = cast?.them?.bat?.find(m => m.role === 'C')?.attrs?.arm ?? 6 + (r() - 0.5) * 3
  const pop = lerp(2.12, 1.86, clamp(catcherArm / 11, 0, 1))
  const quick = r()
  const g = {
    t: 0, game, zones: 'none', stick: true, pads: null, fx: [], done: null, outro: 2400, stamp: null,
    sit, tv, throws, lefty: throws === 'L', pop, quick,
    vmax: lerp(8.25, 9.15, tv), tau: lerp(0.39, 0.34, tv), jumpBonus: lerp(0, 0.07, tv),
    lead: LEAD0, pitchN: 0, pitches: 3,
    phase: 'lead', at: 0, setAt: null, moveAt: null, move: null, slide: false,
    goAt: null, backAt: null, runner: { d: LEAD0, v: 0 }, dive: null,
    ball: null, popAt: null, arriveAt: null, safe: null, res: null, doneAt: null, endAt: null, pickoffs: 0,
    ctl: padCtl(), vh: 640, nudge: nudge(),
    who: { me, pit: pm, c: manOf(cast, 'them', 'bat', 1), ss: manOf(cast, 'them', 'bat', 2), fb: manOf(cast, 'them', 'bat', 3) },
    hud: hudB('TAKE YOUR LEAD'),
    tick(dt) {
      g.t += dt
      const s = dt / 1000, o = padStick(g.ctl)
      // the lead: shuffled out or in, only while he's set (once the pitcher moves he's committed)
      if ((g.phase === 'lead' || g.phase === 'set') && g.goAt == null && g.backAt == null) g.lead = clamp(g.lead + o.x * 1.6 * s, LEAD_MIN, LEAD_MAX)
      if (g.goAt == null && g.dive == null && !g.res) g.runner.d = g.lead
      if (g.phase === 'lead' && g.t - g.at >= 1400) { g.phase = 'set'; g.setAt = g.t; g.hold = 700 + r() * 1800 + (g.pitchN === 0 ? 500 : 0); g.hud.prompt = 'READ HIS FIRST MOVE' }
      if (g.phase === 'set' && g.t - g.setAt >= g.hold) firstMove()
      if (g.phase === 'move' && !g.res) moving()
      // the runner, flat out: up to his top speed off his first step, then the slide
      if (g.goAt != null && !g.res) {
        const R = g.runner, run = g.t - g.goAt
        if (run > 0) { R.v += (g.vmax - R.v) * (1 - Math.exp(-s / g.tau)); R.d = Math.min(BASE + 0.4, R.d + R.v * s) }
        if (R.d >= BASE - 2.6 && !g.slideAt) g.slideAt = g.t
        // (the slide: his foot's on the bag before the rest of him gets there)
        if (R.d >= BASE - 0.9 && g.inAt == null) g.inAt = g.t
      }
      // the dive back: a crossover and a dive, his hand to the bag (his reach takes the last metre and a bit)
      if (g.dive && !g.res) { const D = g.dive; D.d = Math.max(0, D.d - (g.t > D.at ? 9 * s : 0)); g.runner.d = Math.max(0, D.d); if (D.d <= 1.2 && D.safeAt == null) D.safeAt = g.t }
      if (g.phase === 'race') race()
      if (g.phase === 'pickoff' && !g.res) pickoff()
      if (g.res && !g.done && g.t >= g.endAt) finish()
    },
    input(a) {
      if (skipOutroB(g, a)) return
      padInput(g.ctl, a, g.vh, { down: id => (id === 'S' ? go() : back()) })
    },
  }
  // the pitcher's first move: home (a leg kick, or the quick slide step), or over to first. More throws over the bigger
  // the lead, the fewer the more he's thrown over already
  function firstMove() {
    const pk = clamp((g.lead - 2.6) * 0.19 + 0.08, 0.05, 0.55) * (g.pickoffs ? 0.55 : 1)
    g.move = r() < pk ? 'pickoff' : 'home'
    g.slide = g.move === 'home' && r() < 0.42
    g.moveAt = g.t; g.phase = 'move'; g.hud.prompt = null
    // time to the plate (first move to the catcher's glove), and a throw over's time to the bag
    g.toPlate = (g.slide ? lerp(1.18, 1.32, g.quick) : lerp(1.36, 1.6, g.quick)) * 1000
    g.toFirst = (g.lefty ? lerp(0.6, 0.78, r()) : lerp(0.66, 0.84, r())) * 1000 + (g.lefty ? 260 : 0)
    // he caught the runner going early: if he broke well before the move, the pitcher steps off and has him
    if (g.goAt != null && g.moveAt - g.goAt > 130) { g.move = 'stepoff'; g.toFirst = 650 }
  }
  function go() {
    if (g.res || g.goAt != null || g.dive) return
    if (g.phase !== 'set' && g.phase !== 'move') return
    g.goAt = g.t; g.fx.push('h:medium')
    g.runner.v = 0.6
    // a good baserunner's first step: the crossover, a touch quicker
    g.goAt -= g.jumpBonus * 1000
  }
  function back() {
    if (g.res || g.dive || g.goAt != null) return
    if (g.phase !== 'set' && g.phase !== 'move') return
    // diving back on nothing: a wasted lead, back to the bag; the pitcher's still set
    g.backAt = g.t
    g.dive = { d: g.runner.d, at: g.t + 70, safeAt: null }
    g.fx.push('h:light')
  }
  function moving() {
    const t = g.t - g.moveAt
    if (g.move === 'home') {
      // he's gone home: in the glove at toPlate. If the runner broke, the catcher comes up throwing
      if (t >= g.toPlate && g.popAt == null) {
        if (g.goAt != null) { g.popAt = g.t; g.arriveAt = g.t + g.pop * 1000 + (r() < 0.1 ? 250 : 0); g.phase = 'race'; g.offline = r() < 0.08; g.fx.push('catchball') }
        else if (g.dive) { g.dive = null; nextPitch('He dove back on a pitch to the plate') }
        else nextPitch(null)
      }
    } else {
      // over to first: the throw's there at toFirst; he needs to be back on the bag
      if (t >= g.toFirst - 120 && g.phase === 'move') { g.phase = 'pickoff' }
    }
  }
  function pickoff() {
    const t = g.t - g.moveAt
    if (t < g.toFirst) return
    const back = g.dive?.safeAt != null && g.dive.safeAt <= g.moveAt + g.toFirst + 40
    if (g.goAt != null) return end({ kind: g.move === 'stepoff' ? 'CS' : 'PO', safe: false, word: g.move === 'stepoff' ? 'CAUGHT LEANING' : 'PICKED OFF', call: g.move === 'stepoff' ? 'Broke too early: the pitcher stepped off and ran him down' : 'Went on the move to first: picked off' })
    if (back || g.lead <= 2.5) {
      g.pickoffs++
      g.call = { word: back ? 'BACK IN TIME' : 'HE STAYED CLOSE', good: true }; g.callAt = g.t; g.fx.push('catchball')
      g.dive = null; g.backAt = null
      g.phase = 'lead'; g.at = g.t - 400; g.move = null; g.moveAt = null
      return
    }
    end({ kind: 'PO', safe: false, word: 'PICKED OFF', call: g.dive ? 'Dove back, but the tag beat him' : 'Caught off the bag: picked off' })
  }
  function nextPitch(note) {
    g.pitchN++
    g.call = { word: g.pitchN >= g.pitches ? 'NO JUMP' : ['BALL ONE', 'STRIKE ONE', 'FOUL BALL', 'BALL TWO'][Math.floor(r() * 4)], good: null }
    g.callAt = g.t
    if (g.pitchN >= g.pitches) return end({ kind: 'STAY', safe: false, word: 'STAYED PUT', call: note ?? 'Never got the jump he wanted' })
    g.phase = 'lead'; g.at = g.t; g.move = null; g.moveAt = null; g.goAt = null; g.backAt = null; g.dive = null; g.popAt = null
  }
  function race() {
    // the throw's in: safe if he's in under the tag (the throw off line gives him the bag)
    if (g.safe != null) return
    const tagAt = g.arriveAt + 120
    if (g.inAt != null || g.t >= tagAt) {
      const safe = g.offline || (g.inAt != null && g.inAt <= tagAt + gauss(r) * 30)
      g.safe = safe
      const runT = ((g.inAt ?? tagAt) - g.moveAt) / 1000, jump = (g.goAt + g.jumpBonus * 1000 - g.moveAt) / 1000
      end({ kind: safe ? 'SB' : 'CS', safe, word: safe ? 'SAFE' : 'OUT', call: safe ? (g.offline ? 'The throw was off line: in easily' : jump < 0.25 ? 'Great jump, in ahead of the tag' : 'Beat the throw') : jump > 0.42 ? 'Late jump: the throw beat him' : 'Gunned down at second', runT, jump })
    }
  }
  function end(res) {
    g.res = res; g.endAt = g.t + (res.kind === 'SB' || res.kind === 'CS' ? 200 : 500)
    g.fx.push(res.safe ? 'stamp' : 'deny')
  }
  function finish() {
    const R = g.res, hit = !!R.safe
    const score = hit ? clamp(0.7 + clamp(0.35 - (R.jump ?? 0.35), 0, 0.3), 0, 1) : R.kind === 'STAY' ? 0.3 : 0.1
    g.done = outcome(score, hit, R.call ?? null, { result: R.kind, safe: hit, jump: R.jump != null ? Math.round(R.jump * 100) / 100 : null, time: R.runT != null ? Math.round(R.runT * 100) / 100 : null, pop: Math.round(g.pop * 100) / 100, toPlate: g.toPlate ? Math.round(g.toPlate / 10) / 100 : null, lead: Math.round(g.lead / 0.3048), pts: 0 })
    g.doneAt = g.t
    g.outro = hit ? celebMsB() - 400 : 2000
    g.stamp = { text: R.kind === 'SB' ? 'STOLEN BASE' : R.word, good: hit, at: g.t, size: 42 }
    g.popAt2 = hit && g.sit?.half === 'B' ? g.t : null
    g.fx.push(hit ? 'h:success' : 'h:heavy')
  }
  return g
}

// ── The picture ─────────────────────────────────────────────────────────────
// Two cameras. The read: behind the runner at first, a little up, the pitcher in front of us in his stretch (a
// right-hander's back to us, a lefty looking right at us). The race: the camera behind first base, looking down the
// line to second as he goes: the shortstop coming over, the throw in from the left, the slide, the call.
const camRead = view => camOf(view, { x: 24.4, y: 2.7, z: 22.6, yaw: -1.7, pitch: 0.045, F: 700, cy: 0.4 })
const camRace = view => camOf(view, { x: 3, y: 6.5, z: 56, yaw: Math.PI + 0.1, pitch: 0.2, F: 560, cy: 0.42 })
function runnerPose(g, cam) {
  const t = g.t, R = g.runner
  if (g.res && g.done) {
    const a = t - g.doneAt
    if (g.res.kind === 'SB') return a < 500 ? { pose: { ...BP.knees, hy: 30, face: 1, tilt: 0.3 }, lift: 0 } : { pose: mixB(BP.knees, { ...BP.fist, face: 1 }, prog(a, 500, 800)), lift: 0 }
    if (g.res.kind === 'CS' || g.res.kind === 'PO') return a < 900 ? { pose: { ...BP.stand, rot: 1.45, hlx: -10, hly: -118, hrx: 10, hry: -118, tilt: -1, face: 2 }, lift: 0, low: true } : { pose: mixB({ ...BP.knees }, BP.walkOff, prog(a, 900, 1300)), lift: 0 }
    return { pose: BP.hipsDown, lift: 0 }
  }
  if (g.goAt != null && t >= g.goAt) {
    // the slide: feet first, the last two and a half metres
    if (g.slideAt != null) { const k = prog(t, g.slideAt, g.slideAt + 240); return { pose: mixB(runB(t / 220, 1), { ...BP.stand, hy: 14, rot: 1.25, lx: 16, ly: -6, rx: 24, ry: -4, hlx: -26, hly: -86, hrx: -6, hry: -90 }, k), lift: 0, low: k > 0.5 } }
    return { pose: runB((t - g.goAt) / 210, clamp(R.v / 8, 0.4, 1), { lean: 0 }), lift: 0 }
  }
  if (g.dive) { const k = prog(t, g.dive.at, g.dive.at + 260); return { pose: mixB(BP.lead, { ...BP.stand, hy: 12, rot: -1.3, hlx: 40, hly: -70, hrx: 44, hry: -66 }, k), lift: 0 } }
  // the lead: low, his weight on the balls of his feet; a little bounce while the pitcher's set
  return { pose: { ...BP.lead, hy: 42 + Math.sin(t / 260) * 0.8 }, lift: 0 }
}
function pitcherPose(g) {
  const t = g.t, lefty = g.lefty
  // from first base: a right-hander faces third (his back to us), a lefty faces us
  let pose = BP.set, turn = 0
  if (g.phase === 'lead') pose = mixB(BP.stand, BP.set, prog(t - g.at, 500, 1200))
  if (g.move && g.moveAt != null) {
    const a = t - g.moveAt
    if (g.move === 'home') {
      const f = clamp(a / g.toPlate, 0, 1) * 0.68 + (a > g.toPlate ? prog(a, g.toPlate, g.toPlate + 500) * 0.32 : 0)
      pose = lefty ? flipB(pitchPose(f, 1, { slide: g.slide })) : pitchPose(f, 1, { slide: g.slide })
    } else {
      // over to first: a right-hander's jump turn toward us; a lefty's leg up the same as ever, then the foot down
      // toward first and the throw
      const f = clamp(a / g.toFirst, 0, 1)
      if (!lefty) { turn = easeOut(prog(a, 0, 220)); pose = throwPose(lerp(0.3, 1, f), 1) }
      else { pose = f < 0.45 ? flipB(pitchPose(f / 0.45 * 0.3, 1)) : { ...throwPose(lerp(0.45, 1, (f - 0.45) / 0.55), -1), lean: 0.05 } }
    }
  }
  if (g.res && g.done && g.res.kind !== 'SB') pose = mixB(pose, BP.stand, prog(t - g.doneAt, 0, 400))
  // (a right-hander between pitches: a look over his shoulder at the runner)
  const look = !lefty && (g.phase === 'set') && Math.sin((t - g.setAt) / 500) > 0.4
  return { pose: { ...pose, head: look ? 0.8 : pose.head ?? 0 }, turn, front: lefty }
}
function ballNow(g) {
  const t = g.t
  // over to first
  if (g.move && g.move !== 'home' && g.moveAt != null) {
    const rel = g.moveAt + g.toFirst - 240, a = t - rel
    if (a < 0) return null
    const f = clamp(a / 240, 0, 1), to = { x: FIRST.x + 0.3, z: FIRST.z + 0.4 }
    if (f >= 1) return { x: to.x, y: 0.9, z: to.z, held: true }
    return { x: lerp(-0.4, to.x, f), y: lerp(1.8, 1.0, f) + Math.sin(f * Math.PI) * 0.6, z: lerp(RUBBER, to.z, f) }
  }
  // the catcher's throw down to second
  if (g.popAt != null) {
    const a = t - g.popAt - 380, T = g.arriveAt - g.popAt - 380
    if (a < 0) return null
    const f = clamp(a / T, 0, 1), to = { x: (g.offline ? 1.6 : 0.35), z: SECOND.z - 0.5 }
    if (f >= 1) return { ...to, y: g.offline ? 0.4 : 0.6, held: !g.offline }
    return { x: lerp(0, to.x, f), y: lerp(1.6, 0.7, f) + Math.sin(f * Math.PI) * 1.4, z: lerp(-0.6, to.z, f) }
  }
  return null
}
export function draw(ctx, g, view) {
  g.vh = view.h
  const usHome = g.sit ? g.sit.half === 'B' : true
  const K = uniforms(view, usHome)
  const team = usHome ? [view.colors.us, view.colors.trim] : [view.colors.them, view.colors.themTrim ?? '#f4efe6']
  const race = g.goAt != null && g.move === 'home' && g.moveAt != null && g.t - Math.max(g.goAt, g.moveAt) > 220
  const C = race ? camRace(view) : camRead(view)
  staticPark(ctx, view, C, race ? 'stealB' : 'stealA', { team })
  if (g.popAt2 != null) { crowdRise(ctx, C, team, g.t - g.popAt2, 2600); flashesB(ctx, C, g.t - g.popAt2) }
  // the lead, chalked in the dirt
  if (!race) { const a = onPath(g.lead), b = onPath(0); ctx.fillStyle = 'rgba(246,244,236,.32)'; ctx.beginPath(); lineB(ctx, C, a.x - U.z * 0.25, a.z + U.x * 0.25, a.x + U.z * 0.25, a.z - U.x * 0.25, 0.08); ctx.fill(); void b }
  const list = []
  const meLook = dressB(K.us, g.who.me ?? { number: 2, skin: '#8d5a3b' }, { front: false, helmet: true, flap: 1, batGloves: [view.colors.trim, '#1a1d22'], name: g.who.me?.name, noBat: true })
  // the runner
  const rp = runnerPose(g), at = onPath(g.runner.d)
  list.push({ x: at.x, z: at.z, fn: () => baller(ctx, C, at.x, at.z, rp.pose, meLook, { name: race ? null : g.who.me?.name }) })
  // the first baseman, holding him on
  const fbAt = g.goAt != null ? { x: 21.5, z: 22.5 } : { x: FIRST.x + 0.6, z: FIRST.z - 0.9 }
  const fbPose = g.move && g.move !== 'home' && g.moveAt != null && g.t - g.moveAt > g.toFirst - 300 ? { ...BP.ready, hlx: -22, hly: -70, mitt: 1 } : BP.ready
  list.push({ x: fbAt.x, z: fbAt.z, fn: () => baller(ctx, C, fbAt.x, fbAt.z, fbPose, dressB(K.them, g.who.fb ?? { number: 25, skin: '#f0c4a0' }, { front: false, glove: 'L' })) })
  // the pitcher
  const pp = pitcherPose(g)
  const pLook = dressB(K.them, g.who.pit ?? { number: 47, skin: '#c09060' }, { front: pp.front, glove: g.lefty ? (pp.front ? 'L' : 'R') : (pp.front ? 'R' : 'L'), name: g.who.pit?.name })
  list.push({ x: 0, z: RUBBER + 0.25, fn: () => baller(ctx, C, 0, RUBBER + 0.25, pp.pose, pLook, { y: MOUND_H, turn: pp.turn }) })
  // the shortstop and second baseman: the shortstop takes the throw at the bag on a steal
  const ss = g.goAt != null && g.popAt != null ? (() => { const k = prog(g.t, g.popAt - 400, g.popAt + 600); return { x: lerp(-9.5, -0.6, k), z: lerp(37, 38.4, k) } })() : { x: -9.5, z: 37 }
  const ssPose = g.res && g.done ? (g.res.kind === 'CS' ? { ...BP.fist, face: 1 } : BP.stand) : g.popAt != null && g.t > g.arriveAt - 200 ? { ...BP.ready, hy: 36, hlx: 18, hly: -36, mitt: 1 } : g.popAt != null ? runB(g.t / 220, 0.9) : BP.ready
  list.push({ x: ss.x, z: ss.z, fn: () => baller(ctx, C, ss.x, ss.z, ssPose, dressB(K.them, g.who.ss ?? { number: 6, skin: '#5e3c22' }, { front: true, glove: 'R' })) })
  list.push({ x: 9, z: 37, fn: () => baller(ctx, C, 9, 37, BP.ready, dressB(K.them, { number: 13, skin: '#a87548' }, { front: true, glove: 'R' })) })
  // the umpire at second, and his call
  if (race) {
    const call = g.res && (g.res.kind === 'SB' || g.res.kind === 'CS')
    const up = call ? (g.res.safe ? mixB(BP.ready, BP.safe, prog(g.t - (g.doneAt ?? g.t), 0, 160)) : mixB(BP.ready, BP.outCall, prog(g.t - (g.doneAt ?? g.t), 0, 160))) : { ...BP.ready, hy: 44 }
    list.push({ x: -2.2, z: 41.5, fn: () => baller(ctx, C, -2.2, 41.5, up, dressB(K.ump, { skin: '#c09060' }, { front: true, mask: false })) })
  } else {
    // the hitter and the catcher, way down at the plate
    list.push({ x: -0.9, z: 0.25, fn: () => baller(ctx, C, -0.9, 0.25, { ...BP.stand, bat: 1, hlx: 9, hly: -93, hrx: 13, hry: -96, ba: -1.95 }, dressB(K.us, { number: 31, skin: '#c09060' }, { front: true, helmet: true })) })
  }
  const b = ballNow(g)
  // far to near, through this camera
  for (const it of list) it.d = P(C, it.x, 0, it.z).d
  list.sort((p, q) => q.d - p.d)
  for (const it of list) it.fn()
  if (b && !b.held) ballB(ctx, C, b.x, b.y, b.z, g.t / 40)
  // the dust off the slide
  if (g.slideAt != null && race && !lightMode()) {
    const a = g.t - g.slideAt, p2 = P(C, SECOND.x + 0.6, 0.2, SECOND.z - 1)
    if (p2.ok && a < 900) { ctx.fillStyle = `rgba(170,120,80,${(0.5 * (1 - a / 900)).toFixed(3)})`; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(p2.x + Math.sin(i * 2.1) * 0.6 * p2.s * (a / 600), p2.y - Math.abs(Math.cos(i * 1.7)) * 0.4 * p2.s * (a / 700), 0.25 * p2.s * (0.6 + a / 900), 0.15 * p2.s, 0, 0, 6.2832); ctx.fill() } }
  }
  drawHud(ctx, g, view)
}
function drawHud(ctx, g, view) {
  const { w, h } = view
  if (g.sit) scorebug(ctx, view, { ...g.sit, balls: g.sit.balls, strikes: g.sit.strikes, on: [true, false, false], outs: g.sit.outs, usCol: view.colors.us, themCol: view.colors.them, usHome: g.sit.half === 'B' })
  // the lead, and the battery's numbers the coach gave him
  ctx.fillStyle = 'rgba(6,9,13,.82)'; rr(ctx, w - 134, 50, 126, 46, 4); ctx.fill()
  text(ctx, `LEAD ${Math.round(g.lead / 0.3048)} FT`, w - 14, 61, { font: DISPLAY, size: 13, align: 'right', color: g.lead > 4.2 ? GOLD : '#f2f2ee' })
  text(ctx, `${g.lefty ? 'LEFTY' : 'RIGHTY'} · POP ${g.pop.toFixed(2)}`, w - 14, 77, { font: LABEL, size: 11, align: 'right', track: 0.8, color: 'rgba(242,242,238,.7)' })
  text(ctx, `PITCH ${Math.min(g.pitchN + 1, g.pitches)} OF ${g.pitches}`, w - 14, 89, { font: LABEL, size: 10, align: 'right', track: 0.8, color: 'rgba(242,242,238,.55)' })
  if (g.call && g.t - g.callAt < 1100 && !g.res) {
    const y = h - 200
    ctx.font = `18px ${DISPLAY}`
    const tw = Math.max(110, ctx.measureText(g.call.word).width + 24)
    ctx.fillStyle = 'rgba(6,9,13,.86)'; rr(ctx, w / 2 - tw / 2, y - 15, tw, 30, 4); ctx.fill()
    text(ctx, g.call.word, w / 2, y + 1, { font: DISPLAY, size: 18, color: g.call.good ? GOOD : '#f2f2ee' })
  }
  if (g.done && g.res?.jump != null) text(ctx, `JUMP ${g.res.jump.toFixed(2)} · TO SECOND ${g.res.runT?.toFixed(2) ?? '--'} · POP ${g.pop.toFixed(2)}`, w / 2, h - 196, { font: LABEL, size: 13, track: 1, color: 'rgba(242,242,238,.8)' })
  placeStamp(g.stamp, view)
  promptB(ctx, view, g)
  drawPads(ctx, view, g.ctl, { move: 'LEAD', S: 'GO', P: 'BACK' }, !g.done && !g.res)
}
