// Rush: a defensive lineman's two jobs, from behind him, the way a video game plays the line. He's at
// the bottom of the screen with his back to the camera, the man blocking him right in front of him and
// the backfield beyond that.
//   pass-rush   Three reps. Get off on the ball, read how the man sets, win with the move that beats that
//               set, and get to the QB before it comes out. He kicks wide: inside. He steps up and leans:
//               round the edge, or walk him back. He backs off tall: through him. A wrong move, or no move
//               in time, and he has his hands on you: read him again and counter, if the ball's still there.
//   run-stuff   Four plays. Read the run off the line's flow and the back's first steps (from the second play
//               it can be a counter: it flows one way, then a guard pulls and the back comes back). Step to
//               that gap, hold it, and shed when the back gets to you. Too soon and he cuts away from you.
//
// The rules are all here with no screen, in field units: x across, d up the field from the line of
// scrimmage (the QB is at a big d). Nothing is painted on the field: the read is in the men's feet.
import { byV, clamp, lerp, outcome, rngOf, layer, manOf, paceOf, easeOut, particles, nudge } from './kit.js'
import { tilt, untilt, ground, stands, floodlight, vignette, skinOf, airBall, warmAthlete, crowdPop } from './art.js'
import { afterStop, fxSeed, hitFx, plantFx, landFx, pushIn } from './contact.js'
import { paintFieldFlat, qbPose } from './throw.js'
import { put, action, teamOf, walk, ballInAir } from './read.js'

export const how = {
  'pass-rush': 'GET OFF when the ball moves. Then read him. He oversets wide: go INSIDE. He leans on you: take the EDGE. He sits back high: BULL him.',
  // (a tackle goes outside the guard: there's no edge in there, and the pad says so)
  'pass-rush:dt': 'GET OFF when the ball moves. Then read him. He kicks wide: INSIDE. He steps up and leans: OUTSIDE. He backs off tall: BULL.',
  'run-stuff': 'Read the line and the back. Tap the side the run is going, then SHED as the back gets to you. Too soon and he cuts away.',
}

const YD = 20            // field units a yard: a close camera, the width of the field off the screen
const SP = 44            // between linemen
const SIZE = 1.7
const TURF_X = (53.33 * YD) / 344   // how much wider than it's painted the field is, at this camera
const OL_NUM = [71, 64, 55, 66, 77]
const MATE_NUM = [97, 91, 99]
const STAMP_Y = 0.27
const bare = m => m && { number: m.number, skin: m.skin }
const seek = (m, x, d, v, dt) => {
  const dx = x - m.x, dd = d - m.d, e = Math.hypot(dx, dd)
  if (e < 0.01) return true
  const mv = Math.min(e, v * dt)
  m.x += (dx / e) * mv; m.d += (dd / e) * mv
  return mv >= e
}
const far = (a, b) => Math.hypot(a.x - b.x, a.d - b.d)
const pick = (r, list) => list[Math.floor(r() * list.length)]
// the real men: the player, the five in front of him, the QB and the back, and who's beside him
function castOf(cast) {
  const mates = (cast?.us?.dl ?? []).filter(p => !p.me).slice(0, 3).map(bare)
  return {
    me: cast?.me ?? null,
    ol: [0, 1, 2, 3, 4].map(i => manOf(cast, 'them', 'ol', i)),
    qb: manOf(cast, 'them', 'qb', 0), rb: manOf(cast, 'them', 'rb', 0), rbPace: paceOf(cast, 'them', 'rb', 0),
    pace: 1 + (cast?.me?.speed ?? 0) * 0.06,
    mates,
  }
}

// ── The pass rush ───────────────────────────────────────────────────────────
// How he sets: where he goes from his spot, and what beats it.
const SETS = {
  over: { dx: 56, dd: 36, v: 0.27, beat: ['inside'] },     // a big kick to the outside: the inside's wide open
  short: { dx: 8, dd: -10, v: 0.27, beat: ['edge', 'bull'] }, // he jumps at you and leans: he can't get back to the edge
  soft: { dx: 10, dd: 62, v: 0.23, beat: ['bull'] },       // he bails, tall, weight on his heels: put him on his back
}
const NOT = { over: ['soft', 'short'], short: ['over'], soft: ['over', 'short'] }
const WRONG_FOR = { bull: ['over'], inside: ['short', 'soft'], edge: ['over', 'soft'] }
const ME_D = -26, OT_D = 26, QB_D = 140, QB_DROP = 166
const SNAP_MS = 170, LATE_GO = 900
const SHOW = 170, SETTLE = 170    // the snap to his first step; his first step to where he's committed
const FAKE_MS = 300               // how long a set he doesn't mean lasts
const RUSH_V = 0.23, BULL_V = 0.19, BULL_V_SHORT = 0.13, CLOSE_V = 0.24
const REACH = 28                  // on the QB
const PRESS_D = 115                // this close when it comes out and he's throwing under pressure
const RAMP = [1, 0.97, 0.93]
const GET_OFF = v => byV(v, 310, 500)    // off the ball this soon after the snap, you beat him to the spot
const WIN_MS = v => byV(v, 635, 715)     // how long he's out of position once he's committed
const LOCK_MS = v => byV(v, 480, 360)    // his hands are on you: this long before you can do anything

function makeRush({ v, seed, pos, cast }) {
  const r = rngOf(seed), n = 3, dt0 = pos === 'dt'
  const lastAns = { move: null }
  const plan = Array.from({ length: n }, (_, k) => {
    const s = r() < 0.5 ? -1 : 1
    const b = dt0 ? s : s * 2               // the man on him, on the line: a guard or a tackle
    const ox = 180 + s * (dt0 ? 14 : 40)    // he's a little off centre, with the room on his side
    return {
      k, s, b, ox, cx: ox - b * SP, set: null, wait: 850 + r() * 1050,
      hard: k > 0 && r() < 0.6 ? 0.35 + r() * 0.3 : null,
      rel: byV(v, 1750, 2050) + r() * 200 - k * 40,
      fakeP: [0, 0.55, 0.8][k], u: r(),
      snapAt: 0, go: null, clean: false, ex: null, exN: 0, lockUntil: 0, won: null, res: null, thrown: null, dead: false, bull: 0, stones: 0,
      me: { x: 0, d: ME_D }, ot: { x: 0, d: OT_D }, qb: { x: 0, d: QB_D },
    }
  })
  const g = {
    t: 0, game: 'pass-rush', zones: 'three', anyKey: true, pads: ['GET OFF'], padLit: null, litAt: -999, fx: [], done: null, outro: 1500, stamp: null, later: null, dirt: particles(44, fxSeed(seed)), nudge: nudge(),
    plan, i: 0, rep: plan[0], phase: 'set', nextAt: 0, who: castOf(cast), spot: dt0 ? 'dt' : 'edge',
    sacks: 0, pressures: 0,
    // what a player can see of him: all a bot gets
    tell: { hard: false, snapped: false, set: null, commit: false, ex: 0 },
    hud: { prompt: 'WATCH THE BALL', dots: plan.map(() => null) },
    zoneFor(mv) { return (g.rep.s > 0 ? { inside: 0, bull: 1, edge: 2 } : { edge: 0, bull: 1, inside: 2 })[mv] },
    answers(set) { return SETS[set].beat },
    tick(dt) {
      g.t += dt
      if (g.t - g.litAt > 110) g.padLit = null
      if (g.later && g.t >= g.later.at) { g.stamp = g.later; g.later = null }
      const rep = g.rep
      if (g.phase === 'set') {
        if (rep.hardAt != null && g.t >= rep.hardAt && g.t < rep.hardAt + 240) g.tell.hard = true
        else g.tell.hard = false
        if (g.t >= rep.snapAt) snap(rep)
        return
      }
      play(rep, dt)
      if (g.phase === 'beat' && !g.done && g.t >= g.nextAt) next()
    },
    input(a) {
      if (a.kind !== 'down' || a.zone == null) return
      g.padLit = g.pads.length === 1 ? 0 : a.zone; g.litAt = g.t
      const rep = g.rep
      if (g.done || rep.res) return
      if (g.phase === 'set') return offside(rep)
      if (!rep.go) return goNow(rep)
      if (rep.won || g.t < rep.lockUntil) { g.fx.push('h:light'); return }
      const names = rep.s > 0 ? ['inside', 'bull', 'edge'] : ['edge', 'bull', 'inside']
      const mv = names[a.zone]
      lastAns.move = mv
      const ex = rep.ex
      if (g.t < ex.commitAt) stoned(rep, true)
      else if (SETS[ex.set].beat.includes(mv)) beaten(rep, mv)
      else stoned(rep, true)
    },
  }
  // he has seen what you just did: most of the time he won't set to give you that again
  function choose(list0, not = null) {
    const list = list0.filter(x => x !== not)
    const w = lastAns.move ? WRONG_FOR[lastAns.move].filter(x => list.includes(x)) : []
    return pick(r, w.length && r() < 0.7 ? w : list.length ? list : list0)
  }
  function setUp(rep) {
    rep.me.x = rep.ox + rep.s * 38; rep.me.d = ME_D
    rep.ot.x = rep.ox; rep.ot.d = OT_D
    rep.qb.x = rep.cx; rep.qb.d = QB_D
    rep.snapAt = g.t + rep.wait
    if (rep.hard != null) rep.hardAt = g.t + rep.wait * rep.hard
    rep.set = choose(Object.keys(SETS))
    g.tell.snapped = false; g.tell.set = null; g.tell.commit = false; g.tell.ex = 0; g.tell.hard = false
    g.pads = ['GET OFF']
    g.hud.prompt = 'WATCH THE BALL'
    g.phase = 'set'
  }
  function exchange(rep, set, from, fake) {
    const a = from
    rep.exN++
    rep.ex = { set, fake, showAt: a, commitAt: a + (fake ? FAKE_MS : 0) + SETTLE, closeAt: 0, ad: OT_D + (rep.exN - 1) * 16 }
    const win = WIN_MS(v) * RAMP[rep.k] * (rep.exN > 1 ? 0.92 : 1)
    rep.ex.closeAt = rep.ex.commitAt + win
    g.tell.ex = rep.exN
  }
  function snap(rep) {
    g.phase = 'play'
    g.tell.snapped = true; g.tell.hard = false
    const fake = r() < rep.fakeP ? pick(r, NOT[rep.set]) : null
    exchange(rep, rep.set, g.t + SHOW, fake)
    g.fx.push('tap', 'h:light')
    g.hud.prompt = 'GET OFF'
  }
  function offside(rep) {
    rep.dead = true
    settle(rep, 'offside')
  }
  function goNow(rep, late = false) {
    rep.go = g.t
    rep.clean = !late && g.t - rep.snapAt <= GET_OFF(v)
    if (rep.clean) rep.ex.closeAt += 60
    g.pads = rep.s > 0 ? ['INSIDE', 'BULL', dt0 ? 'OUTSIDE' : 'EDGE'] : [dt0 ? 'OUTSIDE' : 'EDGE', 'BULL', 'INSIDE']
    g.hud.prompt = 'READ HIS SET'
    if (!late) g.fx.push('h:light')
  }
  function stoned(rep, pressed) {
    rep.stones++
    rep.lockUntil = g.t + LOCK_MS(v)
    const set = choose(Object.keys(SETS), rep.ex.set)
    exchange(rep, set, rep.lockUntil + 40, null)
    g.hud.prompt = 'COUNTER'
    g.fx.push(pressed ? 'pop' : 'tap', pressed ? 'h:medium' : 'h:light')
    if (pressed) g.stamp = { text: 'STONEWALLED', good: false, at: g.t, ms: 420, size: 34 }
  }
  function beaten(rep, mv) {
    rep.won = mv; rep.wonAt = g.t
    rep.wonSet = rep.ex.set
    rep.route = mv === 'inside' ? { x: rep.ot.x - rep.s * 38, d: rep.ot.d + 10 } : mv === 'edge' ? { x: rep.ot.x + rep.s * 54, d: rep.ot.d + 14 } : null
    if (mv === 'bull') rep.bull = 1
    g.tell.set = null
    g.hud.prompt = null
    g.stamp = null
    g.fx.push('swoosh', 'h:medium')
  }
  function settle(rep, kind) {
    rep.res = { kind, at: g.t }
    const good = kind === 'sack' || kind === 'pressure'
    if (kind === 'sack') g.sacks++
    if (kind === 'pressure') g.pressures++
    g.hud.dots[g.i] = good
    g.hud.prompt = null
    g.tell.set = null
    const words = { sack: 'SACK', pressure: 'PRESSURE', whiff: "BALL'S OUT", offside: 'OFFSIDE' }
    const beat = { sack: 1250, pressure: 1150, whiff: 1000, offside: 1000 }[kind]
    g.stamp = { text: words[kind], good, at: g.t, ms: beat - 120, size: 46 }
    g.fx.push(kind === 'sack' ? 'stamp' : 'tap', kind === 'sack' ? 'h:heavy' : 'h:medium')
    if (kind === 'sack') g.popAt = g.t
    if (kind === 'offside') g.fx.push('whistle')
    g.phase = 'beat'
    g.nextAt = g.t + beat
    if (plan.every(p => p.res)) {
      const pts = g.sacks * 2 + g.pressures
      const hit = pts >= 3
      const score = clamp(pts / 6, 0, 1)
      const made = g.sacks + g.pressures
      const note = `${g.sacks} sack${g.sacks === 1 ? '' : 's'}, ${g.pressures} pressure${g.pressures === 1 ? '' : 's'}`
      g.done = outcome(hit ? Math.max(score, 0.5) : Math.min(score, 0.45), hit, note, { made, of: n, sacks: g.sacks, pressures: g.pressures }, false)
      g.later = { text: hit ? (g.sacks >= 2 ? 'UNBLOCKABLE' : 'IN THE BACKFIELD') : 'NO PRESSURE', good: hit, at: g.t + beat - 100, size: hit && g.sacks < 2 ? 34 : 42 }
      g.outro = beat + 900
    }
  }
  function next() {
    g.i++
    g.rep = plan[g.i]
    g.stamp = null
    setUp(g.rep)
  }
  function play(rep, dt) {
    const age = g.t - rep.snapAt, res = rep.res, s = rep.s, me = rep.me, ot = rep.ot, qb = rep.qb
    if (rep.dead) { seek(me, me.x, ME_D + 16, 0.16, dt); return }
    if (!rep.go && !res && age >= LATE_GO) goNow(rep, true)
    const locked = g.t < rep.lockUntil, ex = rep.ex
    if (!res && !rep.won && !locked && g.t >= ex.closeAt) stoned(rep, false)
    // what he's showing
    const shown = g.t < ex.showAt ? null : ex.fake && g.t < ex.showAt + FAKE_MS ? ex.fake : ex.set
    if (!res && !rep.won) { g.tell.set = g.t < rep.lockUntil ? null : shown; g.tell.commit = g.t >= ex.commitAt && g.t >= rep.lockUntil }
    rep.shown = shown
    // the QB: the ball comes back, he drops, it comes out at the end of his clock
    if (age < SNAP_MS + 500) seek(qb, qb.x, QB_DROP, 0.05, dt)
    if (!res && rep.won && far(me, qb) <= REACH) settle(rep, 'sack')
    if (!rep.res && age >= rep.rel) {
      rep.thrown = g.t
      settle(rep, rep.won && far(me, qb) <= PRESS_D ? 'pressure' : 'whiff')
    }
    const done = rep.res
    // the man on him
    if (rep.won) {
      const since = g.t - rep.wonAt
      if (rep.won === 'bull' && rep.bull === 1) {
        // walking him back: he's driven into his own QB's lap, then thrown aside
        const speed = rep.wonSet === 'short' ? BULL_V_SHORT : BULL_V
        seek(ot, lerp(rep.bullX ??= ot.x, qb.x, 0.3), qb.d - 56, speed, dt)
        seek(me, ot.x + s * 12, ot.d - 34, speed + 0.08, dt)
        if (ot.d >= qb.d - 62 || since > 900) { rep.bull = 2; rep.shedAt = g.t }
      } else if (rep.won !== 'bull') {
        // he's out of it: his feet go on the way they were going, then he turns and chases
        const f = clamp(since / 220, 0, 1)
        if (f < 1) seek(ot, ot.x + (rep.won === 'inside' ? s : s * 0.3) * 24, ot.d + (rep.won === 'edge' ? -8 : 5), 0.13, dt)
        else if (!done) seek(ot, me.x, me.d + 40, 0.12, dt)
      }
      if (rep.bull !== 1) {
        if (rep.route && far(me, rep.route) > 6 && !rep.turned) { if (seek(me, rep.route.x, rep.route.d, RUSH_V * g.who.pace, dt)) rep.turned = true }
        else {
          rep.turned = true
          const stay = done?.kind === 'sack'
          if (!stay) { if (!(done && far(me, qb) < REACH * 0.8)) seek(me, qb.x + (me.x < qb.x ? -8 : 8), qb.d - 10, (done ? 0.18 : RUSH_V) * g.who.pace, dt) }
        }
      }
      return
    }
    if (locked || done) {
      // hands on: the two of them, chest to chest, the pocket giving a little
      seek(ot, me.x - s * 30, me.d + 32, 0.27, dt)
      if (!done) seek(me, me.x, Math.min(me.d + dt * 0.016, ex.ad + 10), 0.27, dt)
      return
    }
    if (shown) {
      const S = SETS[shown], F = shown === ex.set ? 1 : 0.62
      seek(ot, rep.ox + s * S.dx * F, ex.ad + S.dd * F, S.v * (shown === ex.set ? 1 : 0.8), dt)
    }
    if (rep.go) seek(me, ot.x + s * 34, ot.d - 34, CLOSE_V * g.who.pace, dt)
  }
  setUp(plan[0])
  return g
}

// ── Stuffing the run ────────────────────────────────────────────────────────
const RUN_ME = -26, RUN_BLOCK = 28
const GAP_X = 42
const RB_D0 = 150, RUN_QB = 88
const CONTACT = 30, FLOW_AT = 120, FLOW_X = 18
const TFL_D = YD * 0.7, STUFF_D = -YD * 1.4, SHORT_D = -YD * 4.5, BIG_D = -YD * 8
const RB_V = v => byV(v, 0.17, 0.146)
const CUT_D = v => byV(v, 80, 115)         // shed with him further off than this and he sees you and cuts away
const SHED_MS = v => byV(v, 200, 100)
const SQUARE_MS = 400   // no gap, or the wrong one: he has you square, and it takes a beat longer
const SLIDE = v => byV(v, 0.11, 0.17)
const FREE_V = 0.36, CHASE_V = 0.29
const RB_SIDE = 0.5   // on top of his run, what he gains side to side: backs get to the edge quickly

function makeRun({ v, seed, def, pos, cast }) {
  const r = rngOf(seed), n = def?.rounds ?? 4, dt0 = pos === 'dt'
  const plan = Array.from({ length: n }, (_, k) => {
    const s = r() < 0.5 ? -1 : 1
    const b = dt0 ? s : s * 2
    const x0 = 180 + s * (dt0 ? 40 : 56), bx = x0 - s * 30
    const fake = r() < [0, 0.5, 0.7, 0.8][k]
    return {
      k, s, b, x0, bx, cx: bx - b * SP, dir: r() < 0.5 ? -1 : 1, fake,
      wait: 650 + r() * 600, flipAt: fake ? 520 + r() * 130 : FLOW_AT,
      snapAt: 0, res: null, gap: 0, gapAt: 0, shedAt: null, free: 0, cut: false, tackled: null, handed: false,
      me: { x: 0, d: RUN_ME }, ol: { x: 0, d: RUN_BLOCK }, rb: { x: 0, d: RB_D0 }, qb: { x: 0, d: RUN_QB }, pull: { x: 0, d: 40 },
    }
  })
  const g = {
    t: 0, game: 'run-stuff', zones: 'three', anyKey: false, pads: ['LEFT', 'SHED', 'RIGHT'], padLit: null, litAt: -999, fx: [], done: null, outro: 1500, stamp: null, later: null, dirt: particles(44, fxSeed(seed)), nudge: nudge(),
    plan, i: 0, rep: plan[0], phase: 'set', nextAt: 0, who: castOf(cast), spot: dt0 ? 'dt' : 'edge', tfl: 0, stuffs: 0, shorts: 0, yards: 0,
    tell: { flow: 0, commit: false, D: Infinity, snapped: false },
    hud: { prompt: 'READ THE RUN', dots: plan.map(() => null) },
    tick(dt) {
      g.t += dt
      if (g.t - g.litAt > 110) g.padLit = null
      if (g.later && g.t >= g.later.at) { g.stamp = g.later; g.later = null }
      const rep = g.rep
      if (g.phase === 'set') {
        if (g.t >= rep.snapAt) { g.phase = 'play'; g.tell.snapped = true; g.fx.push('tap', 'h:light') }
        return
      }
      play(rep, dt)
      if (g.phase === 'beat' && !g.done && g.t >= g.nextAt) next()
    },
    input(a) {
      if (a.kind !== 'down' || a.zone == null) return
      g.padLit = a.zone; g.litAt = g.t
      const rep = g.rep
      if (g.done || rep.res || g.phase !== 'play' || rep.shedAt != null) return
      if (a.zone === 1) return shed(rep)
      const want = a.zone === 0 ? -1 : 1
      if (want !== rep.gap) { rep.gap = want; rep.gapAt = g.t; g.fx.push('tap', 'h:light') }
    },
  }
  function setUp(rep) {
    rep.me.x = rep.x0; rep.me.d = RUN_ME
    rep.ol.x = rep.bx; rep.ol.d = RUN_BLOCK
    rep.rb.x = rep.cx; rep.rb.d = RB_D0
    rep.qb.x = rep.cx; rep.qb.d = RUN_QB
    rep.pull.x = rep.cx - rep.dir * SP; rep.pull.d = 20
    rep.snapAt = g.t + rep.wait
    g.tell.flow = 0; g.tell.commit = false; g.tell.snapped = false; g.tell.D = Infinity
    g.hud.prompt = 'READ THE RUN'
    g.phase = 'set'
  }
  function shed(rep) {
    rep.shedAt = g.t
    // no side to come off on, and he has you square: it takes a beat longer
    const square = rep.gap === 0 || (rep.gap !== rep.dir)
    // too soon: he's still got room, sees you come off and cuts it back, and the lineman rides you
    // past the play. You only get off him once the back's already through the line.
    if (far(rep.me, rep.rb) > CUT_D(v)) { rep.cut = true; rep.free = Infinity; rep.early = true }
    else rep.free = g.t + SHED_MS(v) + (square ? SQUARE_MS : 0)
    g.fx.push('swoosh', 'h:medium')
  }
  function settle(rep, kind, yards) {
    rep.res = { kind, at: g.t, yards }
    const stop = kind === 'tfl' || kind === 'stuff'
    if (kind === 'tfl') g.tfl++
    if (kind === 'stuff') g.stuffs++
    if (kind === 'short') g.shorts++
    g.yards += yards
    g.hud.dots[g.i] = stop
    // (why it got away, in two words: too soon off the block, the wrong gap, or the shed never came in time)
    g.hud.prompt = stop ? null : rep.cut ? 'TOO SOON' : rep.gap !== rep.dir ? 'WRONG GAP' : 'TOO LATE'
    if (stop) g.popAt = g.t
    const word = { tfl: 'TACKLE FOR LOSS', stuff: 'STUFFED', short: 'SHORT GAIN', big: 'BIG RUN' }[kind]
    const beat = kind === 'big' ? 1050 : 1200
    g.stamp = { text: word, good: stop ? true : kind === 'big' ? false : null, at: g.t, ms: beat - 120, size: word.length > 11 ? 34 : 46 }
    g.fx.push(stop ? 'stamp' : 'tap', stop ? 'h:heavy' : 'h:light')
    g.phase = 'beat'
    g.nextAt = g.t + beat
    if (plan.every(p => p.res)) {
      const pts = (g.tfl + g.stuffs) * 2 + g.shorts
      const hit = pts >= 6
      const score = clamp(pts / (n * 2), 0, 1)
      const made = g.tfl + g.stuffs
      g.done = outcome(hit ? Math.max(score, 0.5) : Math.min(score, 0.45), hit, `${g.yards} yard${Math.abs(g.yards) === 1 ? '' : 's'} on ${n} carries`, { made, of: n, tfl: g.tfl, yards: g.yards }, false)
      const tw = hit ? 'SHUT IT DOWN' : 'GASHED'
      g.later = { text: tw, good: hit, at: g.t + beat - 100, size: tw.length > 11 ? 38 : 46 }
      g.outro = beat + 900
    }
  }
  function next() {
    g.i++
    g.rep = plan[g.i]
    g.stamp = null
    setUp(g.rep)
  }
  function play(rep, dt) {
    const age = g.t - rep.snapAt, res = rep.res, me = rep.me, ol = rep.ol, rb = rep.rb, qb = rep.qb, dir = rep.dir
    const committed = age >= rep.flipAt
    const shownDir = committed ? dir : -dir
    if (!res) { g.tell.flow = age >= FLOW_AT ? shownDir : 0; g.tell.commit = committed && age >= FLOW_AT; g.tell.D = far(me, rb) }
    rep.shownDir = age >= FLOW_AT ? shownDir : 0
    // the back: the mesh, then up to the hole. Past the line he just runs.
    const v0 = RB_V(v) * g.who.rbPace
    if (!res || res.kind === 'big' || res.kind === 'none') {
      const goal = rep.cut ? rep.x0 - dir * GAP_X * 1.5 : rep.x0 + (committed ? dir : -dir) * GAP_X
      if (age > 60) {
        if (rb.d > 34) seek(rb, goal, 26, v0, dt)
        else seek(rb, goal, rb.d - 80, v0 * 1.05, dt)
        rb.x += clamp(goal - rb.x, -1, 1) * Math.min(Math.abs(goal - rb.x), v0 * RB_SIDE * dt)
      }
    }
    if (!rep.handed && rb.d <= qb.d + 4) rep.handed = true
    // the QB hands it off and carries out his fake the other way
    if (age > SNAP_MS) seek(qb, rep.cx - (committed ? dir : -dir) * 36, RUN_QB + 16, 0.09, dt)
    // the pulling guard, on a counter: behind the line to the hole, then up through it
    if (rep.fake && committed) {
      if (rep.pull.x * dir < (rep.x0 + dir * GAP_X) * dir - 4 && rep.pull.d > 30) seek(rep.pull, rep.x0 + dir * GAP_X, 56, 0.23, dt)
      else seek(rep.pull, rep.x0 + dir * GAP_X, -10, 0.2, dt)
    }
    if (res) {
      if (rep.tackled) { seek(me, rb.x - rep.tackled.side * 14, rb.d - 8, 0.27, dt) }
      return
    }
    if (rep.early && rb.d <= STUFF_D) { rep.early = false; rep.free = g.t + SHED_MS(v) }
    // you, on the block: to the gap you've taken. Nothing taken, or the wrong one, and he washes you off it.
    const onBlock = !rep.free || g.t < rep.free
    if (onBlock) {
      const takeX = rep.gap ? rep.x0 + rep.gap * GAP_X * 0.88 : rep.x0 - dir * 18
      seek(me, age > FLOW_AT ? takeX : me.x, -2, rep.gap ? SLIDE(v) : 0.045, dt)
      seek(ol, me.x - rep.s * 28, me.d + 30, 0.32, dt)
    } else {
      const fast = g.t < rep.free + 240
      seek(me, rb.x, rb.d, (fast ? FREE_V : CHASE_V) * g.who.pace, dt)
      // the man who had you goes down the way you threw him
      if (ol.d > me.d) seek(ol, ol.x - rep.s * 4, ol.d - 0.3, 0.01, dt)
    }
    const free = !onBlock
    if (free && far(me, rb) <= CONTACT) {
      rep.tackled = { side: Math.sign(rb.x - me.x) || rep.s }
      const yards = Math.round(-rb.d / YD)
      const kind = rb.d >= TFL_D ? 'tfl' : rb.d > STUFF_D ? 'stuff' : rb.d > SHORT_D ? 'short' : 'big'
      settle(rep, kind, kind === 'tfl' ? Math.min(-1, yards) : kind === 'stuff' ? clamp(yards, 0, 1) : kind === 'short' ? clamp(yards, 2, 4) : Math.max(5, yards))
      return
    }
    if (rb.d <= BIG_D) settle(rep, 'big', Math.round(-rb.d / YD) + 3 + Math.floor(age % 7))
  }
  setUp(plan[0])
  return g
}

export function make(o) { return o.game === 'run-stuff' ? makeRun(o) : makeRush(o) }

// ── The picture ─────────────────────────────────────────────────────────────
// The ground: the approved field, closer in. Wider than it's painted, so at this many units a yard it's
// the real width, the sidelines and numbers out of shot and the hashes where they really are.
const losOf = (view, meD) => Math.round(untilt(view, 180, view.h - 172).y + meD)
function stage(ctx, view, los) {
  const c = view.colors, hy = tilt(view, 0, 0).y
  layer(ctx, view, `rush|${c.us}|${c.trim}|${los}`, x => {
    stands(x, view, 'field', [c.us, c.trim])
    ground(x, view, f => {
      f.save(); f.translate(180, 0); f.scale(TURF_X, 1); f.translate(-180, 0)
      paintFieldFlat(f, view, los - 50 * YD, YD, c.us, false)
      f.restore()
      f.fillStyle = '#3f86ff'; f.fillRect(-120, los - 1.6, 600, 3.2)
    }, `rush-flat|${c.us}|${los}`, 0, Math.round((view.h - hy) * view.px * 0.7))
    floodlight(x, view)
  })
}
const dirFrom = (w, still) => (w.step == null ? still : Math.abs(w.dx) > Math.abs(w.dy) * 1.2 ? (w.dx > 0 ? 'right' : 'left') : w.dy > 0 ? 'down' : 'up')
const sideName = s => (s < 0 ? 'left' : 'right')

export function draw(ctx, g, view) {
  if (g.stamp && g.stamp.y == null) g.stamp.y = view.h * STAMP_Y
  if (g.later && g.later.y == null) g.later.y = view.h * STAMP_Y
  if (g.game === 'run-stuff') drawRun(ctx, g, view)
  else drawRush(ctx, g, view)
  vignette(ctx, view)
}
// the rest of the line, on each other
// (over a guard: the tackle beside him takes his man wide, so the fight stays readable)
const wide = (g, rep, i, snapped, age) => (g.spot === 'dt' && i === rep.s * 2 && snapped ? rep.s * 50 * clamp(age / 300, 0, 1) : 0)
const bump = (g, i) => Math.sin(g.t / (190 + i * 17) + i * 1.9) * 2.5
function matesOf(rep, spot) {
  const s = rep.s
  return spot === 'dt' ? [rep.cx + s * 3.6 * SP, rep.cx - s * 0.55 * SP, rep.cx - s * 2.5 * SP] : [rep.cx + s * 0.55 * SP, rep.cx - s * 0.55 * SP, rep.cx - s * 2.5 * SP]
}
function warm(g, list) {
  g.warmed = g.warmed ?? 0
  for (let n = 0; n < 5 && g.warmed < list.length; n++, g.warmed++) warmAthlete(list[g.warmed])
}
function warmList(g, us, them) {
  const who = g.who, list = []
  const me = { color: us.color, trim: us.trim, pants: us.trim, skin: who.me?.skin ?? skinOf(3), number: who.me?.number ?? 94, kit: 'pads', carry: false, step: null, dir: 'up' }
  const him = i => ({ color: them.color, trim: them.trim, pants: them.trim, skin: who.ol[i]?.skin ?? skinOf(i + 11), number: who.ol[i]?.number ?? OL_NUM[i], kit: 'pads', carry: false, step: null, dir: 'down' })
  for (const step of [0, 1, 2, 3, null]) {
    list.push({ ...me, step, pose: null })
    list.push({ ...me, dir: 'side', number: null, step, pose: null })
  }
  list.push({ ...me, pose: 'block' })
  for (const step of [0, 1, 2, 3, null]) for (const pose of ['slide', 'back']) list.push({ ...him(2 - g.rep.b), step, pose })
  const qb = { color: them.color, trim: them.trim, pants: them.trim, skin: who.qb?.skin ?? skinOf(9), number: null, kit: 'pads', carry: false, step: null, dir: 'side' }
  for (const pose of ['qb-rel', 'qb-follow']) list.push({ ...qb, pose })
  return list
}

function drawRush(ctx, g, view0) {
  const c = view0.colors, us = teamOf(c, 0), them = teamOf(c, 1), rep = g.rep, res = rep.res, who = g.who
  const los = losOf(view0, ME_D)
  const s = rep.s, snapped = g.phase !== 'set' && !rep.dead, age = g.t - rep.snapAt, since = res ? g.t - res.at : -1
  const sack = res?.kind === 'sack', me = rep.me, ot = rep.ot, qb = rep.qb
  // the camera leans in on a sack, and eases back for the next rep
  const fy = d => los - d
  const qAt = tilt(view0, qb.x, fy(qb.d))
  const lean = sack ? easeOut(clamp(since / 240, 0, 1)) : 0
  const view = pushIn(ctx, g, view0, 1 + 0.34 * lean, qAt.x, qAt.y - 30, 1.34, lerp(qAt.x, 180, lean), lerp(qAt.y - 30, view0.h * 0.5, lean))
  stage(ctx, view, los)
  crowdPop(ctx, view, [c.us, c.trim], g.t - (g.popAt ?? -1e9))
  const pc = snapped ? clamp(age / rep.rel, 0, 1) : 0
  const s2 = sack ? afterStop(since) : since
  const qFall = sack ? clamp((s2 - 10) / 240, 0, 1) : res?.kind === 'pressure' ? clamp((far(me, qb) < 30 ? since - 120 : -1) / 340, 0, 1) : 0
  const fallX = Math.sign(qb.x - me.x) || s
  // the snap: the line comes off. Each exchange: pads and hands, and turf under them
  if (snapped && !rep.snapFx) { rep.snapFx = true; plantFx(g, view, me.x, fy(me.d), 0, 3); plantFx(g, view, ot.x, fy(ot.d), 0, 3) }
  if (snapped && rep.go && !rep.goFx) { rep.goFx = true; plantFx(g, view, me.x, fy(me.d), 0, rep.clean ? 8 : 4, 1.1) }
  if (rep.stones !== (rep.stoneSeen ?? 0)) { rep.stoneSeen = rep.stones; hitFx(g, view, (me.x + ot.x) / 2, (fy(me.d) + fy(ot.d)) / 2, { power: 2.8, n: 6, dust: 0, s: 0.9, up: 40 }) }
  // a move that wins: turf goes up where he rips by, and a bull drives on through it
  if (rep.won && !rep.winFx) { rep.winFx = true; hitFx(g, view, ot.x, fy(ot.d), { power: rep.won === 'bull' ? 4 : 2.4, n: 9, dust: 2, side: rep.won === 'inside' ? -s : s, s: 0.9, up: 30 }) }
  if (rep.won === 'bull' && rep.bull === 1 && Math.floor(g.t / 110) !== rep.dig) { rep.dig = Math.floor(g.t / 110); plantFx(g, view, me.x, fy(me.d), s, 2, 0.9) }
  if (rep.won === 'bull' && rep.bull === 2 && g.t - rep.shedAt > 250 && !rep.flatFx) { rep.flatFx = true; landFx(g, view, ot.x, fy(ot.d), { side: s, power: 3.2 }) }
  if (sack && !rep.hitFx) { rep.hitFx = true; hitFx(g, view, qb.x, fy(qb.d), { power: 7.5, n: 16, dust: 4, side: fallX, up: 26 }) }
  if (sack && s2 > 260 && !rep.landFx) { rep.landFx = true; landFx(g, view, qb.x, fy(qb.d), { side: fallX, power: 3 }) }
  if (res?.kind === 'pressure' && qFall > 0 && !rep.hitFx) { rep.hitFx = true; hitFx(g, view, qb.x, fy(qb.d), { power: 4, n: 8, dust: 2, side: fallX, up: 24 }); g.fx.push('stamp') }
  // the other four, and the men beside him
  for (let i = -2; i <= 2; i++) {
    if (i === rep.b) continue
    const b = snapped ? bump(g, i + 3) : 0
    put(rep.cx + i * SP + wide(g, rep, i, snapped, age) + b * 0.7, fy(OT_D + pc * 16 + Math.abs(b) * 0.4), them, { dir: 'down', pose: snapped ? 'block' : 'stance', skin: skinOf(i + 11), number: OL_NUM[2 - i], size: SIZE, ...bare(who.ol[2 - i]) })
  }
  matesOf(rep, g.spot).forEach((x, i) => {
    const b = snapped ? bump(g, i + 7) : 0
    put(x + b, fy(ME_D + 6 + pc * 22 - Math.abs(b)), us, { dir: 'up', pose: snapped ? 'block' : 'stance', skin: skinOf(i * 2 + 1), number: MATE_NUM[i], size: SIZE, ...who.mates[i] })
  })
  // the back stays in, on the far side
  const rx = qb.x - s * 40, rd = snapped ? lerp(QB_D - 4, QB_D - 34, clamp(age / 700, 0, 1)) : QB_D - 4
  put(rx, fy(rd), them, { dir: 'down', pose: snapped && age > 600 ? 'block' : 'ready', skin: skinOf(5), number: 28, size: SIZE, ...who.rb })
  // the man on him: how he's setting is the whole read
  const wo = walk(g, `ot${g.i}`, ot.x, ot.d, 6)
  const olI = 2 - rep.b, olLook = who.ol[olI]
  const shown = rep.shown
  const O = { dir: 'down', skin: skinOf(rep.b + 11), number: OL_NUM[olI], size: SIZE, name: null, ...olLook, step: null, pose: 'stance', squat: 0 }
  if (snapped) {
    const locked = g.t < rep.lockUntil
    if (rep.won) {
      const off = g.t - rep.wonAt
      if (rep.won === 'bull') {
        O.pose = 'back'; O.step = wo.step
        if (rep.bull === 2) { O.fall = clamp((g.t - rep.shedAt) / 260, 0, 1); O.fallX = s; O.pose = null }
      } else if (off < 240) { O.pose = 'wrap'; O.dir = sideName(rep.won === 'inside' ? -s : s) }
      else { O.pose = null; O.step = wo.step; O.dir = dirFrom(wo, 'down') }
    } else if (locked || res) O.pose = 'block'
    else if (shown === 'over') { O.pose = 'slide'; O.step = wo.step ?? 1 }
    else if (shown === 'short') { O.pose = 'block'; O.squat = 0.14; O.step = null }
    else if (shown === 'soft') { O.pose = 'back'; O.step = wo.step }
    else O.pose = 'block'
  }
  put(ot.x, fy(ot.d), them, O)
  // the QB
  const hard = g.phase === 'set' && g.tell.hard
  const thrown = rep.thrown != null ? g.t - rep.thrown : -1
  const arm = thrown >= 0 && !qFall ? qbPose(null, thrown) : null
  const caught = snapped && age >= SNAP_MS
  const qThrowTo = qb.x - s * 110
  put(qb.x, fy(qb.d), them, {
    dir: arm ? sideName(qThrowTo - qb.x) : 'down', pose: arm ?? (qFall ? null : hard ? 'reach-r' : 'ready'), carry: caught && thrown < 0, fall: qFall, fallX,
    skin: skinOf(9), number: 7, size: SIZE, ...who.qb,
  })
  // him
  const wm = walk(g, `me${g.i}`, me.x, me.d, 8)
  const M = { size: SIZE, number: 94, skin: skinOf(3), ...who.me, dir: 'up', pose: 'touch', step: null }
  // he's put him down: back on his feet, turned round to the camera, and everyone knows about it. A different one each time.
  const party = sack ? clamp((s2 - 560) / 170, 0, 1) : 0
  if (party >= 1) {
    M.dir = 'down'; M.fall = 0
    M.pose = rep.k === 0 ? 'flex' : rep.k === 1 ? (Math.floor(g.t / 170) % 2 ? 'griddy-a' : 'griddy-b') : 'point-up'
    M.z = fy(qb.d) + 1
  } else if (sack || (qFall > 0 && res?.kind === 'pressure')) {
    M.dir = sideName(fallX); M.pose = 'wrap'; M.fall = qFall * (1 - party); M.fallX = fallX; M.z = fy(qb.d) + 1
  } else if (rep.dead) { M.pose = 'hands-head' }
  else if (res?.kind === 'whiff' && since > 280) { M.pose = 'hips'; M.step = null }
  else if (rep.won && rep.won !== 'bull' && g.t - rep.wonAt < 200) {
    // the arm over, or under, and through
    const side = rep.won === 'inside' ? -s : s
    M.pose = side < 0 ? 'swipe-l' : 'swipe-r'; M.step = null; M.dir = 'up'
  }
  else if (snapped && rep.go) {
    M.step = wm.step
    M.pose = wm.step == null ? 'block' : null
    M.dir = dirFrom(wm, 'up')
    if (g.t < rep.lockUntil || (rep.won === 'bull' && rep.bull === 1)) { M.pose = 'block'; M.step = null; M.dir = 'up' }
  }
  const close = clamp(since / 55, 0, 1)
  put(sack ? lerp(me.x, qb.x - fallX * 14, close) + party * fallX * -16 : me.x, sack ? lerp(fy(me.d), fy(qb.d) + 6, close) + party * 10 : fy(me.d), us, M)
  action(ctx, view)
  // the ball: on the ground under the center, back to the QB on the snap, away when he throws
  const bx = rep.cx
  if (g.phase === 'set' || rep.dead) {
    const q = tilt(view, bx, fy(7))
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + 1.5, 8.5 * q.s, 2.8 * q.s, 0, 0, Math.PI * 2); ctx.fill()
    airBall(ctx, q.x, q.y - 4 * q.s, { axis: [0.18, 1, 0.3], len: 18 * q.s, spin: 0 })
  } else if (age < SNAP_MS) {
    const f = age / SNAP_MS
    ballInAir(ctx, view, lerp(bx, qb.x, f), lerp(fy(7), fy(qb.d), f), 14 + f * 18, 0, 1.1)
  }
  if (thrown >= 0 && thrown < 460) {
    const f = thrown / 460
    ballInAir(ctx, view, lerp(qb.x, qThrowTo, f), lerp(fy(qb.d), fy(-70), f), 34 + Math.sin(f * Math.PI) * 26, Math.atan2(qThrowTo - qb.x, fy(-70) - fy(qb.d)), 1.1)
  }
  g.dirt.draw(ctx, g.t)
  ctx.restore()
  // the first look at a rep bakes its men
  if (g.phase === 'set') { if (g.warmFor !== g.i) { g.warmFor = g.i; g.warmed = 0; g.warmL = warmList(g, us, them) } warm(g, g.warmL) }
}

function drawRun(ctx, g, view0) {
  const c = view0.colors, us = teamOf(c, 0), them = teamOf(c, 1), rep = g.rep, res = rep.res, who = g.who
  const los = losOf(view0, RUN_ME)
  const snapped = g.phase !== 'set', age = g.t - rep.snapAt, since = res ? g.t - res.at : -1
  const me = rep.me, ol = rep.ol, rb = rep.rb, qb = rep.qb, s = rep.s
  const fy = d => los - d
  const rAt = tilt(view0, rb.x, fy(rb.d)), big = res && rep.tackled && (res.kind === 'tfl' || res.kind === 'stuff')
  const lean = big ? easeOut(clamp(since / 240, 0, 1)) : 0
  const view = pushIn(ctx, g, view0, 1 + 0.26 * lean, rAt.x, rAt.y - 30, 1.26, lerp(rAt.x, 180, lean * 0.7), lerp(rAt.y - 30, view0.h * 0.5, lean * 0.7))
  stage(ctx, view, los)
  crowdPop(ctx, view, [c.us, c.trim], g.t - (g.popAt ?? -1e9))
  const s2 = rep.tackled ? afterStop(since) : since
  // the snap, a gap taken, a man thrown off, and the hit
  if (snapped && !rep.snapFx) { rep.snapFx = true; plantFx(g, view, me.x, fy(me.d), 0, 3); plantFx(g, view, ol.x, fy(ol.d), 0, 3) }
  if (rep.gap !== (rep.gapSeen ?? 0)) { rep.gapSeen = rep.gap; if (rep.gap) plantFx(g, view, me.x, fy(me.d), rep.gap, 6) }
  if (rep.free && rep.free !== Infinity && g.t >= rep.free && !rep.shedFx) { rep.shedFx = true; hitFx(g, view, ol.x, fy(ol.d), { power: 2.6, n: 8, dust: 1, side: -s, s: 0.9, up: 30 }) }
  if (rep.free && g.t >= rep.free + 300 && !rep.flatFx) { rep.flatFx = true; if (rep.free !== Infinity) landFx(g, view, ol.x, fy(ol.d), { side: -s, power: 1.6, s: 0.9 }) }
  if (rep.tackled && !rep.hitFx) {
    rep.hitFx = true
    const hard = res.kind === 'tfl' ? 7.5 : res.kind === 'stuff' ? 6 : 3.5
    hitFx(g, view, rb.x, fy(rb.d), { power: hard, n: hard > 4 ? 16 : 8, dust: hard > 4 ? 4 : 2, side: rep.tackled.side, up: 26 })
  }
  if (rep.tackled && s2 > 260 && !rep.landFx) { rep.landFx = true; landFx(g, view, rb.x, fy(rb.d), { side: rep.tackled.side, power: big ? 3 : 1.6 }) }
  // the flow: everybody's first step says where it's going
  const flow = rep.shownDir ?? 0
  const flowX = rep.fx0 = (rep.fx0 ?? 0) + clamp(flow * FLOW_X - (rep.fx0 ?? 0), -2, 2)
  const pullI = rep.b === 1 || rep.b === 2 ? -1 : 1   // the guard on the far side of him from the man on him
  for (let i = -2; i <= 2; i++) {
    if (i === rep.b) continue
    if (rep.fake && i === pullI && age >= rep.flipAt) continue
    const b = snapped ? bump(g, i + 3) : 0
    put(rep.cx + i * SP + wide(g, rep, i, snapped, age) + flowX + b * 0.6, fy(RUN_BLOCK - (snapped ? 4 : 0) + b * 0.3), them, { dir: 'down', pose: snapped ? 'block' : 'stance', skin: skinOf(i + 11), number: OL_NUM[2 - i], size: SIZE, ...bare(who.ol[2 - i]) })
  }
  if (rep.fake && age >= rep.flipAt) {
    if (rep.pullFrom !== g.i) { rep.pullFrom = g.i; rep.pull.x = rep.cx + pullI * SP + flowX; rep.pull.d = RUN_BLOCK }
    const w = walk(g, `pull${g.i}`, rep.pull.x, rep.pull.d, 8)
    put(rep.pull.x, fy(rep.pull.d), them, { dir: dirFrom(w, 'down'), step: w.step, pose: w.step == null ? 'block' : null, skin: skinOf(pullI + 11), number: OL_NUM[2 - pullI], size: SIZE, ...bare(who.ol[2 - pullI]) })
  }
  matesOf(rep, g.spot).forEach((x, i) => {
    const b = snapped ? bump(g, i + 7) : 0
    put(x + flowX * 0.5 + b, fy(RUN_ME + 6 - Math.abs(b)), us, { dir: 'up', pose: snapped ? 'block' : 'stance', skin: skinOf(i * 2 + 1), number: MATE_NUM[i], size: SIZE, ...who.mates[i] })
  })
  // the man on him
  const olI = 2 - rep.b, thrown = rep.free && g.t >= rep.free
  const OLS = { dir: 'down', pose: snapped ? 'block' : 'stance', skin: skinOf(rep.b + 11), number: OL_NUM[olI], size: SIZE, ...who.ol[olI] }
  if (thrown) { OLS.fall = clamp((g.t - rep.free) / 300, 0, 0.8); OLS.fallX = -s }
  put(ol.x, fy(ol.d), them, OLS)
  // the back
  const rw = walk(g, `rb${g.i}`, rb.x, rb.d, 9), tk = rep.tackled, fall = tk ? clamp((s2 - 10) / 240, 0, 1) : 0
  // (a real stop drives him back the way he came)
  const drive = big ? easeOut(clamp(s2 / 300, 0, 1)) * 24 : 0
  put(rb.x, fy(rb.d) - drive, them, { dir: tk ? 'down' : dirFrom(rw, 'down'), step: tk ? null : rw.step, pose: !snapped ? 'ready' : null, carry: rep.handed, fall, fallX: tk ? tk.side : 0, skin: skinOf(6), number: 28, size: SIZE, ...who.rb })
  // the QB
  const qw = walk(g, `qb${g.i}`, qb.x, qb.d, 9)
  put(qb.x, fy(qb.d), them, { dir: dirFrom(qw, 'down'), step: qw.step, pose: qw.step == null ? 'ready' : null, carry: snapped && age >= SNAP_MS && !rep.handed, skin: skinOf(9), number: 7, size: SIZE, ...who.qb })
  // him
  const wm = walk(g, `me${g.i}`, me.x, me.d, 8)
  const M = { size: SIZE, number: 94, skin: skinOf(3), ...who.me, dir: 'up', pose: 'touch', step: null }
  const off = rep.free && g.t >= rep.free
  // a stop: up off him, facing the camera, and nobody needs telling. A different one each play.
  const party = big ? clamp((s2 - 600) / 170, 0, 1) : 0
  if (party >= 1) { M.dir = 'down'; M.fall = 0; M.pose = ['flex', 'point-up', 'griddy', 'hands-head'][rep.k % 4]; if (M.pose === 'griddy') M.pose = Math.floor(g.t / 170) % 2 ? 'griddy-a' : 'griddy-b'; M.z = fy(rb.d) + 1 }
  else if (tk) { M.dir = sideName(tk.side); M.pose = 'wrap'; M.fall = fall; M.fallX = tk.side; M.z = fy(rb.d) - drive + 1 }
  else if (res?.kind === 'big' && off) {
    // gone: he lays out after him and gets nothing but turf
    const dive = clamp((since - 20) / 220, 0, 0.94), sd = Math.sign(rb.x - me.x) || s
    M.dir = sideName(sd); M.pose = 'dive'; M.fall = dive; M.fallX = sd; M.step = null
    if (since > 240 && !rep.whiffFx) { rep.whiffFx = true; landFx(g, view, me.x, fy(me.d), { side: sd, power: 1.5 }) }
  }
  else if (off) { M.step = wm.step; M.pose = wm.step == null ? 'wrap' : null; M.dir = dirFrom(wm, 'up') }
  else if (snapped) { M.pose = 'block'; M.step = null }
  put(me.x, fy(me.d) - drive, us, M)
  action(ctx, view)
  // the ball: on the ground under the center, then back to the QB
  const bx = rep.cx
  if (!snapped) {
    const q = tilt(view, bx, fy(7))
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + 1.5, 8.5 * q.s, 2.8 * q.s, 0, 0, Math.PI * 2); ctx.fill()
    airBall(ctx, q.x, q.y - 4 * q.s, { axis: [0.18, 1, 0.3], len: 18 * q.s, spin: 0 })
  } else if (age < SNAP_MS) {
    const f = age / SNAP_MS
    ballInAir(ctx, view, lerp(bx, qb.x, f), lerp(fy(7), fy(qb.d), f), 14 + f * 18, 0, 1.1)
  }
  if (g.phase === 'set') {
    if (g.warmFor !== g.i) {
      g.warmFor = g.i; g.warmed = 0
      const R = { color: them.color, trim: them.trim, pants: them.trim, skin: who.rb?.skin ?? skinOf(6), number: who.rb?.number ?? 28, kit: 'pads', pose: null }
      g.warmL = []
      for (const step of [0, 1, 2, 3]) { g.warmL.push({ ...R, dir: 'down', step, carry: true }); g.warmL.push({ ...R, dir: 'down', step, carry: false }); g.warmL.push({ ...R, dir: 'side', number: null, step, carry: true }); g.warmL.push({ ...R, dir: 'side', number: null, step, carry: false }) }
    }
    warm(g, g.warmL)
  }
  g.dirt.draw(ctx, g.t)
  ctx.restore()
}
