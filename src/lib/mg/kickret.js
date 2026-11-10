// Kick Return: the back or the receiver deep on a kickoff, from behind him in the broadcast camera. The
// 2024 kickoff: the kicker alone at their 35, his ten coverage men set on our 40, our nine in the setup zone
// (the 30 to the 35), two deep. Nobody moves till the ball comes down in the landing zone.
// Three kicks. Each one:
//   the catch    the ball comes down to him: CATCH as the ring closes. Off it and it's a muff: he has to
//                pick it up, and the coverage gets five yards further down before he's going
//   the read     the wall sets up for a return LEFT, MIDDLE or RIGHT: the lane is where his blockers seal
//                their men out of it. Hold LEFT or RIGHT to slide; he runs upfield on his own, faster with
//                his Speed. From the second kick a man can beat his block and close the lane he showed,
//                and the crease opens somewhere else. Miss the crease and he goes down in the wall
//   the moves    one or two men left once he's through it, each with a ring closing on him: a man who
//                squares him up (JUKE him) and a man coming off a block from the side (STIFF ARM him).
//                Early or late and he's down
//   the break    beat them all and he's broken it: a long return, or all the way
// Passed: the three kicks average out to the 30 or better, or one of them gets to midfield (or scores).
//
// The rules are here with no screen: x across in field units (the sidelines at 8 and 352), d in yards up
// the field from our goal line. What a player sees is in g.tell: all a bot gets.
import { byV, clamp, lerp, outcome, rngOf, xiOf, manOf, paceOf, easeOut, easeInOut, particles, nudge, text, DISPLAY, GOLD } from './kit.js'
import { tilt, untilt, stands, floodlight, vignette, skinOf, goalPosts, rollingField, athlete, warmAthlete, crowdPop, beatenPose } from './art.js'
import { afterStop, fxSeed, hitFx, plantFx, landFx } from './contact.js'
import { paintFieldFlat, looseBall, SL, SR } from './throw.js'
import { put, action, tagsAll, teamOf, walk, ballInAir } from './read.js'

export const how = {
  'kick-return': 'CATCH it as the ring closes. Read the wall and hold LEFT or RIGHT to get to the crease; you run upfield on your own. Then JUKE the man who squares you up and STIFF ARM the man coming from the side, each as his ring closes.',
}

const CX = 180
const PYD = 11                // flat units a yard, up the field
const LANE_DX = 96            // the three returns: the middle, and a lane either side of it
const laneX = l => CX + l * LANE_DX
const WALL_D = 23             // where the blocks are set: about our 23
const COVER_D = 40, KICK_D = 65, SETUP_D = [35, 31]
// the kick
const KICK_AT = 700           // ms from the set to the boot
const HANG = 1350             // ms in the air
const RING_C = 700            // the catch's ring starts closing this long before it's on him
const C_GOOD = v => byV(v, 85, 150)      // ms either side of it coming down: a catch
const C_PERFECT = v => byV(v, 30, 65)     // and caught in stride
const MUFF_MS = 650           // picking it up
const MUFF_WALL = 3           // yards further down the coverage gets before he's going
// the run
const V = v => byV(v, 0.0097, 0.0113)     // yards a ms at full speed: about 10 to 11 yards a second
const ACCEL = 260             // ms: up to speed
const READ_AT = 300           // ms after it comes down: the wall shows the return
const LANE_W = v => byV(v, 17, 24)        // units either side of the lane's middle: through clean
const SQUEEZE = 1.75          // times that: through, but he's had to squeeze it and he's slowed
const SHIFT_P = 0.5          // from the second kick: the lane he showed closes and another opens
// the moves
const RING_MS = 560
const M_GOOD = v => byV(v, 46, 76)
const M_PERFECT = v => byV(v, 16, 30)
const THREAT_D = [5, 12]      // yards past the wall: the first man, the last man
const TD_P = v => byV(v, 0.16, 0.36)
const FREE_K = 2.4            // the open field: the camera goes with him, quicker
// holding LEFT or RIGHT: Hit Stick's slide. Up to speed quickly, and he eases to a stop when you let go.
const LAT_V = v => byV(v, 0.2, 0.3)
const HELD_K = 1.15
const EASE_IN = 70, EASE_OUT = 80, MIN_HOLD = 110
const X_MAX = 150
// the pass mark
const AVG_OK = 35, BIG_SPOT = 50     // (the 35: where a touchback comes out since 2025)

const spotWord = d => (d >= 100 ? 'THE END ZONE' : d > 50 ? `THEIR ${100 - d}` : `THE ${d}`)
const bare = m => m && { number: m.number, skin: m.skin }
const quiet = m => (m?.last ? { ...m, quiet: true } : bare(m))

// the real men: him and his return unit; their coverage and the kicker
function castOf(cast, pos) {
  const pace = 1 + (cast?.me?.speed ?? 0) * 0.06
  if (cast?.us?.xi && cast?.them?.xi) {
    const x = (side, spot, i) => xiOf(cast, side, spot, i)
    const pick = (side, list) => list.map(([s, i]) => x(side, s, i)).filter(p => p && !p.me)
    const us = pick('us', [['lb', 0], ['lb', 1], ['te', 0], ['s', 0], ['lb', 2], ['s', 1], ['te', 1], ['edge', 0], ['wr', 2], ['db', 4], ['rb', 1]])
    const them = pick('them', [['lb', 0], ['s', 0], ['lb', 1], ['cb', 0], ['lb', 2], ['s', 1], ['te', 0], ['cb', 1], ['wr', 2], ['db', 4], ['rb', 1]])
    const mate = pos === 'wr' ? x('us', 'rb', 0) : x('us', 'wr', 0)
    return { me: cast.me ?? null, pace, us: us.slice(0, 9).map(quiet), them: them.slice(0, 10).map(quiet), mate: mate && !mate.me ? mate : null, kicker: null }
  }
  return { me: cast?.me ?? null, pace, us: [], them: [], mate: null, kicker: null }
}

// ── The rules ───────────────────────────────────────────────────────────────
export function make({ v, seed, def, cast, pos }) {
  const r = rngOf(seed), n = def?.rounds ?? 3
  const plan = Array.from({ length: n }, (_, k) => {
    const lane = Math.floor(r() * 3) - 1
    let shift = null
    if (k > 0 && r() < SHIFT_P) shift = lane === 0 ? (r() < 0.5 ? -1 : 1) : r() < 0.7 ? 0 : -lane
    // the first kick: one man to beat. After that, two, either way round
    const kinds = k === 0 ? [r() < 0.5 ? 'juke' : 'stiff'] : r() < 0.5 ? ['stiff', 'juke'] : ['juke', 'stiff']
    const threats = kinds.map((kind, j) => ({ kind, side: r() < 0.5 ? -1 : 1, at: kinds.length === 1 ? 8 : THREAT_D[j], kicker: kind === 'juke' && r() < 0.55 }))
    const land = { x: CX + (r() - 0.5) * 90, d: 3 + r() * 8 }
    return {
      k, lane, shift, shiftAt: 8.5 + r() * 2.5, threats, land, tdR: r(), downR: r(), drift: r() < 0.5 ? -1 : 1, party: Math.floor(r() * 4),
      t0: 0, kickAt: 0, landAt: 0, stage: 'set', tapAt: null, caught: null, runAt: 0, wallD: WALL_D, wallDone: false, squeeze: false,
      j: 0, lunge: false, meet: null, moves: [], free: null, res: null, shifted: false, passAt: null,
      me: { x: CX, d: 5 }, vx: 0, vy: 0, dir: 0, slowUntil: 0,
    }
  })
  const W = { cGood: C_GOOD(v), cPerfect: C_PERFECT(v), good: M_GOOD(v), perfect: M_PERFECT(v), laneW: LANE_W(v), lat: LAT_V(v), v: V(v), td: TD_P(v) }
  const g = {
    t: 0, game: 'kick-return', zones: 'three', anyKey: true, pads: ['LEFT', 'CATCH', 'RIGHT'], padLit: null, litAt: -999, padCue: null,
    fx: [], done: null, outro: 1500, stamp: null, later: null, dirt: particles(56, fxSeed(seed)), nudge: nudge(),
    plan, i: 0, rep: plan[0], phase: 'set', nextAt: 0, who: castOf(cast, pos), W, held: null,
    // what a player can see. what: 'catch' | 'juke' | 'stiff' (the next thing to press for), rem: ms till it's on him,
    // ring: its ring is up. lane: the return the wall's set for (-1, 0, 1; null till it shows), laneN: how many times it's shown
    tell: { kicked: false, what: 'catch', rem: Infinity, ring: false, lane: null, laneN: 0, shift: false, running: false },
    hud: { prompt: 'WATCH THE KICK', dots: plan.map(() => null) },
    laneX,
    // (for the bots: how far he'll still slide if the thumb comes off now)
    coast: () => Math.abs(g.rep.vx) * EASE_OUT,
    tick(dt) {
      g.t += dt
      if (g.t - g.litAt > 110 && !g.held) g.padLit = null
      if (g.later && g.t >= g.later.at) { g.stamp = g.later; g.later = null }
      if (g.held?.up && g.t >= g.held.at + MIN_HOLD) g.held = null
      const rep = g.rep
      if (g.phase === 'set') {
        if (g.t >= rep.kickAt) { g.phase = 'play'; rep.stage = 'kick'; g.tell.kicked = true; g.fx.push('tap', 'h:light') }
        return
      }
      play(rep, dt)
      if (g.phase === 'beat' && !g.done && g.t >= g.nextAt) next()
    },
    input(a) {
      if (a.kind === 'up') { if (g.held) { if (g.t >= g.held.at + MIN_HOLD) g.held = null; else g.held.up = true; g.padLit = null } return }
      if (a.kind !== 'down' || a.zone == null) return
      g.padLit = a.zone; g.litAt = g.t
      const rep = g.rep
      if (g.done || rep.res || g.phase === 'beat') return
      if (a.zone === 1) return press(rep)
      g.held = { dir: a.zone === 0 ? -1 : 1, at: g.t, up: false }
      g.fx.push('h:light')
    },
  }
  // the middle pad: CATCH, then the move the next man calls for
  function press(rep) {
    if (rep.tapAt != null) return
    if (rep.stage === 'kick' || rep.stage === 'field') {
      if (g.tell.rem > RING_C + 120) { g.fx.push('h:light'); return }
      rep.tapAt = g.t
      if (rep.stage === 'field') catchIt(rep, g.t - rep.landAt)
      return
    }
    if (rep.stage !== 'run' || !rep.wallDone || rep.j >= rep.threats.length) { g.fx.push('h:light'); return }
    if (!g.tell.ring) { g.fx.push('h:light'); return }
    rep.tapAt = g.t
    g.held = null
    if (rep.meet == null && g.tell.rem > W.good) rep.lunge = true
    g.fx.push('swoosh', 'h:medium')
    if (rep.meet) move(rep, g.t - rep.meet.at)
  }
  function setUp(rep) {
    rep.t0 = g.t; rep.kickAt = g.t + 450; rep.landAt = rep.kickAt + HANG
    rep.me.x = rep.land.x + rep.drift * 34; rep.me.d = rep.land.d + 1.5
    g.tell.kicked = false; g.tell.what = 'catch'; g.tell.rem = Infinity; g.tell.ring = false; g.tell.lane = null; g.tell.shift = false; g.tell.running = false
    g.held = null; g.padCue = null; g.pads[1] = 'CATCH'
    g.hud.prompt = 'WATCH THE KICK'; g.hud.hot = false
    g.phase = 'set'
  }
  function catchIt(rep, err) {
    const a = Math.abs(err)
    const kind = rep.tapAt != null && a <= W.cPerfect ? 'clean' : rep.tapAt != null && a <= W.cGood ? 'catch' : 'muff'
    rep.caught = { kind, at: g.t, early: rep.tapAt != null && err < 0 }
    rep.runAt = g.t + (kind === 'clean' ? 0 : kind === 'catch' ? 140 : MUFF_MS)
    rep.vy = kind === 'clean' ? W.v * 0.5 : 0
    if (kind === 'muff') rep.wallD = WALL_D - MUFF_WALL
    rep.stage = 'run'; rep.tapAt = null
    g.tell.ring = false; g.tell.rem = Infinity; g.padCue = null; g.hud.hot = false
    g.hud.prompt = kind === 'muff' ? (rep.caught.early ? 'MUFFED IT: REACHED FOR IT' : 'MUFFED IT: OFF HIS PADS') : kind === 'clean' ? 'CAUGHT IT IN STRIDE' : 'READ THE WALL'
    g.fx.push(kind === 'muff' ? 'deny' : 'tap', kind === 'muff' ? 'h:medium' : 'h:light')
    g.pads[1] = rep.threats[0].kind === 'juke' ? 'JUKE' : 'STIFF ARM'
    g.tell.what = rep.threats[0].kind
  }
  function play(rep, dt) {
    const me = rep.me
    if (rep.res) return after(rep, dt)
    if (rep.stage === 'kick' || rep.stage === 'field') {
      // he settles under it
      const f = clamp((g.t - rep.kickAt) / (HANG * 0.75), 0, 1)
      me.x = rep.land.x + rep.drift * 34 * (1 - easeInOut(f)); me.d = rep.land.d + 1.5 * (1 - easeInOut(f))
      const rem = rep.landAt - g.t
      g.tell.what = 'catch'; g.tell.rem = rem; g.tell.ring = rem <= RING_C
      g.padCue = g.tell.ring && rep.tapAt == null ? 1 : null
      if (g.tell.ring && !g.hud.hot) { g.hud.prompt = 'CATCH'; g.hud.hot = true }
      if (rep.stage === 'kick' && rem <= 0) {
        rep.stage = 'field'
        if (rep.tapAt != null) return catchIt(rep, rep.tapAt - rep.landAt)
      }
      if (rep.stage === 'field' && -rem > W.cGood) catchIt(rep, Infinity)
      return
    }
    // ── the run
    const going = g.t >= rep.runAt
    g.tell.running = going
    if (g.t >= rep.landAt + READ_AT && g.tell.lane == null) { g.tell.lane = rep.lane; g.tell.laneN = 1; if (!rep.caught || rep.caught.kind !== 'muff' || going) g.hud.prompt = 'READ THE WALL' }
    // the slide: going, or picking it up and about to go
    rep.dir = g.held && !rep.free ? g.held.dir : 0
    const top = W.lat * HELD_K * g.who.pace, want = going || g.t >= rep.runAt - 200 ? rep.dir * top : 0
    rep.vx += (want - rep.vx) * (1 - Math.exp(-dt / (want ? EASE_IN : EASE_OUT)))
    if (Math.abs(rep.vx) < 0.002 && !want) rep.vx = 0
    me.x = clamp(me.x + rep.vx * dt, CX - X_MAX, CX + X_MAX)
    if (me.x === CX - X_MAX || me.x === CX + X_MAX) rep.vx = 0
    if (going) {
      const sliding = Math.abs(rep.vx) > top * 0.5
      let vt = W.v * g.who.pace * (sliding ? 0.86 : 1) * (g.t < rep.slowUntil ? 0.6 : 1) * (rep.meet ? 0.25 : 1) * (rep.free ? FREE_K : 1)
      rep.vy += (vt - rep.vy) * (1 - Math.exp(-dt / ACCEL))
      me.d += rep.vy * dt
      if (rep.free) me.x += (clamp(me.x, CX - 80, CX + 80) - me.x) * Math.min(1, dt / 700)
    }
    // a man beats his block: the lane he showed closes, and the crease is somewhere else
    if (rep.shift != null && !rep.shifted && me.d >= rep.wallD - rep.shiftAt) {
      rep.shifted = true; rep.shiftT = g.t
      g.tell.lane = rep.shift; g.tell.laneN = 2; g.tell.shift = true
      g.hud.prompt = 'THE LANE CLOSED: FIND THE CREASE'
      g.fx.push('swoosh')
    }
    // the wall
    if (!rep.wallDone && me.d >= rep.wallD) {
      const lane = rep.shifted ? rep.shift : rep.lane, off = Math.abs(me.x - laneX(lane))
      const w = W.laneW * (rep.caught.kind === 'muff' ? 0.8 : 1)
      if (off > w * SQUEEZE) {
        const blocker = Math.abs(me.x - CX - Math.round((me.x - CX) / 48) * 48) < 15
        const wrong = Math.sign(me.x - CX) !== Math.sign(laneX(lane) - CX) && off > 70
        return settle(rep, 'traffic', blocker ? 'own' : wrong ? 'wrong' : 'crease', rep.wallD + 0.6)
      }
      rep.wallDone = true; rep.passAt = g.t
      if (off > w) { rep.squeeze = true; rep.slowUntil = g.t + 380 }
      g.hud.prompt = off > w ? 'SQUEEZED THROUGH' : 'THROUGH THE WALL'
      g.fx.push(off > w ? 'tap' : 'swoosh')
    }
    // the men left: a ring closes on each
    if (rep.wallDone && rep.j < rep.threats.length) {
      const th = rep.threats[rep.j], at = rep.wallD + th.at
      const rem = rep.meet ? -(g.t - rep.meet.at) : (at - me.d) / Math.max(0.004, rep.vy)
      g.tell.what = th.kind; g.tell.rem = rem; g.tell.ring = rem <= RING_MS
      g.padCue = g.tell.ring && rep.tapAt == null ? 1 : null
      if (g.tell.ring && !g.hud.hot) { g.hud.prompt = th.kind === 'juke' ? 'JUKE HIM' : 'STIFF ARM'; g.hud.hot = true }
      if (!rep.meet && me.d >= at) {
        rep.meet = { at: g.t, d: me.d }
        if (rep.tapAt != null) return move(rep, rep.tapAt - g.t)
      }
      const good = W.good * (rep.squeeze ? 0.8 : 1)
      if (rep.meet && g.t - rep.meet.at > good) return moveFail(rep, th, 'late')
      return
    }
    // broken: all the way, or run down from behind
    if (rep.free) {
      if (me.d >= 100) return settle(rep, 'td', null, 100)
      if (!rep.free.td && me.d >= rep.free.down) return settle(rep, 'long', 'chased', me.d + 0.5)
    }
  }
  // the move against the moment he's on you: err < 0 early, > 0 late
  function move(rep, err) {
    const th = rep.threats[rep.j], a = Math.abs(err), good = W.good * (rep.squeeze ? 0.8 : 1), perfect = W.perfect * (rep.squeeze ? 0.8 : 1)
    if (rep.lunge || a > good) return moveFail(rep, th, err < 0 ? 'early' : 'late')
    const clean = a <= perfect
    rep.moves.push({ kind: th.kind, clean, at: g.t, side: th.side, d: rep.me.d })
    if (!clean) rep.slowUntil = g.t + 260
    // (the juke: a quick step away from him, the way a back gets by a man)
    if (th.kind === 'juke') { rep.jukeTo = rep.me.x < CX ? 1 : rep.me.x > CX ? -1 : -th.side; rep.jukeAt = g.t }
    g.fx.push(clean ? 'pop' : 'tap', clean ? 'h:heavy' : 'h:medium')
    g.hud.prompt = th.kind === 'juke' ? (th.kicker ? 'JUKED THE KICKER' : 'MADE THE LAST MAN MISS') : clean ? 'STIFF-ARMED HIM TO THE TURF' : 'STIFF ARM: SHRUGGED HIM OFF'
    g.hud.hot = false; g.tell.ring = false; g.padCue = null
    rep.j++; rep.tapAt = null; rep.lunge = false; rep.meet = null
    if (rep.j < rep.threats.length) { g.pads[1] = rep.threats[rep.j].kind === 'juke' ? 'JUKE' : 'STIFF ARM'; return }
    // nobody left in front of him
    const cleans = rep.moves.filter(m => m.clean).length
    // (all the way takes a clean break: a man he only just got by is still on his heels)
    const p = clamp(W.td * (0.3 + 0.7 * cleans / rep.moves.length) - (rep.squeeze ? 0.08 : 0) - (rep.caught.kind === 'muff' ? 0.1 : 0) + (rep.caught.kind === 'clean' ? 0.04 : 0), 0.04, 0.6)
    const td = rep.tdR < p
    rep.free = { at: g.t, d: rep.me.d, td, down: Math.min(96, rep.me.d + 5 + rep.downR * 24 * (0.4 + 0.6 * cleans / rep.moves.length)) }
    g.tell.what = null
    g.stamp = { text: 'BROKE IT', good: true, at: g.t, ms: 900, size: 44, y: g.stampY }
    g.popAt = g.t
  }
  function moveFail(rep, th, why) {
    rep.failed = { kind: th.kind, side: th.side, why }
    const w = th.kind === 'juke'
      ? (why === 'early' ? 'JUKED TOO SOON: HE STAYED HOME' : th.kicker ? 'THE KICKER SQUARED HIM UP' : 'SQUARED UP BY THE LAST MAN')
      : (why === 'early' ? 'STIFF ARM TOO SOON: HE GOT UNDER IT' : 'NO STIFF ARM: TAKEN DOWN FROM THE SIDE')
    settle(rep, 'tackle', w, rep.me.d + 0.8)
  }
  function settle(rep, kind, why, spotD) {
    const catchD = Math.round(rep.land.d), spot = clamp(Math.round(spotD), 1, 100)
    const yards = spot - catchD
    rep.res = { kind, why, at: g.t, spot, yards, catchD }
    rep.stage = 'done'
    g.tell.ring = false; g.tell.what = null; g.padCue = null; g.held = null; g.hud.hot = false
    g.hud.dots[g.i] = kind === 'td' || spot >= AVG_OK
    const big = kind === 'td' || kind === 'long'
    g.hud.prompt = kind === 'td' ? 'NOBODY LAID A HAND ON HIM'
      : kind === 'long' ? 'RUN DOWN FROM BEHIND'
      : kind === 'traffic' ? (why === 'own' ? 'RAN INTO HIS OWN BLOCKER' : why === 'wrong' ? `WRONG LANE: THE RETURN WENT ${(rep.shifted ? rep.shift : rep.lane) < 0 ? 'LEFT' : (rep.shifted ? rep.shift : rep.lane) > 0 ? 'RIGHT' : 'UP THE MIDDLE'}` : 'MISSED THE CREASE: DOWN IN THE WALL')
      : why
    const word = kind === 'td' ? 'TOUCHDOWN' : kind === 'long' ? `BROKE IT: ${yards} YARDS` : `TACKLED AT ${spotWord(spot)}`
    const good = big ? true : spot >= AVG_OK ? true : spot >= 22 ? null : false
    const beat = kind === 'td' ? 2400 : big ? 1400 : 1150
    g.stamp = { text: word, good, at: g.t + (kind === 'td' ? 120 : 0), ms: beat - 140, size: word.length > 12 ? 34 : 50 }
    g.fx.push(big ? 'stamp' : 'stamp', kind === 'td' ? 'h:success' : kind === 'traffic' || kind === 'tackle' ? 'h:heavy' : 'h:medium')
    if (kind === 'td') { g.popAt = g.t; g.fx.push('claim') }
    g.phase = 'beat'
    g.nextAt = g.t + beat
    if (plan.every(p => p.res)) finish(beat)
  }
  function finish(beat) {
    const spots = plan.map(p => p.res.spot), yards = plan.map(p => p.res.yards)
    const tds = plan.filter(p => p.res.kind === 'td').length
    const long = Math.max(...yards)
    const avg = spots.reduce((s, x) => s + x, 0) / n
    const big = plan.some(p => p.res.kind === 'td' || p.res.spot >= BIG_SPOT)
    const hit = avg >= AVG_OK
    const score = plan.reduce((s, p) => s + (p.res.kind === 'td' ? 1 : clamp((p.res.spot - 15) / 40, 0, 1)), 0) / n
    const avgR = Math.round(avg)
    const note = `${n} returns, average start at ${spotWord(avgR).replace('THE ', 'the ').replace('THEIR ', 'their ')}, long of ${long}${tds ? `, ${tds} TD` : ''}`
    g.done = outcome(hit ? Math.max(score, 0.5) : Math.min(score, 0.45), hit, note, { made: plan.filter(p => p.res.kind === 'td' || p.res.spot >= AVG_OK).length, of: n, yards, spots, avg: Math.round(avg * 10) / 10, long, tds }, false)
    const tw = hit ? (tds ? 'HOUSE CALL' : 'FLIPPED THE FIELD') : 'PINNED DEEP'
    g.later = { text: tw, good: hit, at: g.t + beat - 100, size: 44 }
    g.outro = beat + 900
  }
  // after it's decided: a TD runs on into the end zone and pulls up
  function after(rep, dt) {
    const me = rep.me, res = rep.res, since = g.t - res.at
    if (res.kind === 'td') { rep.vy *= Math.exp(-dt / 160); me.d = Math.min(105, me.d + rep.vy * dt) }
    else if (since < 200) me.d += 0.004 * dt * (1 - since / 200)
    rep.vx *= Math.exp(-dt / 90); me.x = clamp(me.x + rep.vx * dt, CX - X_MAX, CX + X_MAX)
  }
  function next() {
    g.i++
    g.rep = plan[g.i]
    g.stamp = null
    g.vis = null
    setUp(g.rep)
  }
  setUp(plan[0])
  return g
}

// ── The picture ─────────────────────────────────────────────────────────────
const SIZE = 1.0
const STAMP_Y = 0.24
const COVER_NUM = [44, 31, 52, 23, 55, 37, 85, 26, 18, 41]
const OUR_NUM = [54, 42, 86, 30, 58, 39, 48, 91, 17]
// where a yard line sits on the flat view, from the camera's yard line
const anchorOf = view => untilt(view, 180, view.h - 178).y
// the coverage: ten across on our 40. 0 and 9 stay wide (contain), 8 is the safety who hangs back; 1 to 7
// go to the seven spots across the wall, 48 units apart. The lanes are the spots at -96, 0 and 96.
const COVER_X = i => SL + 26 + i * ((SR - SL - 52) / 9)
const spotX = s => CX + (s - 3) * 48
const LANE_SPOT = { '-1': 1, 0: 3, 1: 5 }
function sidelines(x, view, fy, c, them) {
  const O = { pose: 'ready', step: null, carry: false, fall: 0, fallX: 0, size: 0.72, number: null, kit: 'pads' }
  for (let yd = 25; yd <= 75; yd += 5) {
    const n = (yd * 7) % 11, y = fy(yd)
    if (n > 7 || y < view.h * 0.2 || y > view.h - 40) continue
    athlete(x, view, -14 - (n % 3) * 8, y, { ...O, dir: 'right', color: c.us, trim: c.trim, pants: c.trim, skin: skinOf(n) })
    athlete(x, view, view.w + 14 + (n % 3) * 8, y + 12, { ...O, dir: 'left', color: them.color, trim: them.trim, pants: them.trim, skin: skinOf(n + 3) })
  }
}
// a man on the field: where he is, eased toward where he's going at a footballer's speed
function seekMan(m, x, d, vX, vD, dt) {
  const dx = x - m.x, dd = d - m.d
  m.x += clamp(dx, -vX * dt, vX * dt); m.d += clamp(dd, -vD * dt, vD * dt)
}
const dirOfStep = (w, still) => (w.step == null ? still : Math.abs(w.dx) > Math.abs(w.dy) * 1.3 ? (w.dx > 0 ? 'right' : 'left') : w.dy > 0 ? 'down' : 'up')
const bump = (t, i) => Math.sin(t / (180 + i * 19) + i * 1.7) * 2.2
function visOf(g) {
  if (g.vis) return g.vis
  const rep = g.rep
  const cover = Array.from({ length: 10 }, (_, i) => ({ x: COVER_X(i), d: COVER_D }))
  const ours = Array.from({ length: 9 }, (_, i) => ({ x: i < 7 ? spotX(i) + (i % 2 ? 6 : -6) : CX + (i === 7 ? -158 : 158), d: SETUP_D[i % 2] }))
  const mate = { x: rep.land.x + (rep.land.x > CX ? -64 : 64), d: rep.land.d + 3 }
  const kicker = { x: CX, d: KICK_D + 7 }
  g.vis = { cover, ours, mate, kicker, last: g.t, open: [0, 0, 0, 0, 0, 0, 0] }
  return g.vis
}

export function draw(ctx, g, view) {
  for (const s of [g.stamp, g.later]) if (s && s.y == null) s.y = view.h * STAMP_Y
  g.stampY = view.h * STAMP_Y
  const c = view.colors, us = teamOf(c, 0), them = teamOf(c, 1), rep = g.rep, res = rep.res, who = g.who
  const V0 = visOf(g), dt = clamp(g.t - V0.last, 0, 50)
  V0.last = g.t
  const me = rep.me, t = g.t
  const kicked = t >= rep.kickAt, landed = t >= rep.landAt, rel = landed ? t - rep.landAt : -1
  const since = res ? t - res.at : -1
  // ── the camera: up the field on the kicker, then down with the ball to him, then with him
  const fBall = clamp((t - rep.kickAt) / HANG, 0, 1)
  const ballD = lerp(KICK_D, rep.land.d, fBall)
  const want = !kicked ? 36 : !landed ? lerp(36, me.d, easeInOut(clamp((fBall - 0.1) / 0.55, 0, 1))) : Math.min(93, me.d + (rep.free && !res ? 1.5 : 0))
  const cam = g.cam ?? (g.cam = { d: want, i: g.i })
  if (cam.i !== g.i) { cam.i = g.i; cam.d = want }
  cam.d += (want - cam.d) * (1 - Math.exp(-dt / (rep.free ? 45 : landed ? 100 : 90)))
  const A = anchorOf(view)
  const fy = d => A - (d - cam.d) * PYD
  // the field: painted once, their goal line at the top, ours at the bottom; the camera rolls along it
  const EZ = view.h + 12 * PYD, len = EZ + 104 * PYD + view.h
  const paintView = { w: view.w, h: len, px: view.px, field: view.field }
  const P = d => EZ + (100 - d) * PYD
  rollingField(ctx, view, {
    key: `kr|${c.us}|${c.trim}|${them.color}|${view.field?.id ?? ''}`, len, strips: 84, res: 0.62,
    at: Math.round((P(cam.d) - A) * 2) / 2,
    paint: x => paintFieldFlat(x, paintView, EZ, PYD, c.us),
    under: x => stands(x, view, 'field', [c.us, c.trim]),
    over: x => {
      floodlight(x, view)
      const back = fy(110)
      if (view.field && back > 4) goalPosts(x, view, back)
      sidelines(x, view, fy, c, them)
    },
  })
  crowdPop(ctx, view, [c.us, c.trim], t - (g.popAt ?? -1e9), { ms: res?.kind === 'td' ? 2600 : 1300, power: res?.kind === 'td' ? 1 : 0.6 })
  // ── the wall: which spots are open (sealed apart), eased
  const laneNow = rep.shifted ? rep.shift : rep.lane
  const setUpF = landed ? clamp((rel - 250) / 500, 0, 1) : 0
  for (let s = 0; s < 7; s++) {
    const open = landed && s === LANE_SPOT[laneNow] ? setUpF : 0
    V0.open[s] += (open - V0.open[s]) * (1 - Math.exp(-dt / 160))
  }
  const passed = rep.wallDone && rep.passAt != null ? t - rep.passAt : -1
  const wallD = rep.wallD
  // where each block is: the spot, and the pair sealed out of the lane when it's open
  const sealOf = s => {
    let dx = 0
    for (const l of [-1, 0, 1]) {
      const ls = LANE_SPOT[l], o = V0.open[ls]
      if (!o) continue
      if (s === ls) dx += (l === 1 ? 1 : l === -1 ? -1 : (s % 4 === 3 ? 1 : 1)) * 40 * o
      else if (Math.abs(s - ls) === 1) dx += Math.sign(s - ls) * 10 * o
    }
    return dx
  }
  // the threats: who they are
  const thIdx = th => (th.kind === 'juke' ? (th.kicker ? 'k' : 8) : th.side < 0 ? 0 : 9)
  const threatOf = new Map(rep.threats.map((th, j) => [thIdx(th), { th, j }]))
  const rem = j => {
    // ms till he's on him, for the man still to come
    const th = rep.threats[j]
    if (!rep.wallDone) return (wallD + th.at - me.d) / Math.max(0.004, rep.vy || g.W.v) + 120
    if (j < rep.j) return -1
    if (j === rep.j && rep.meet) return -(t - rep.meet.at)
    return (wallD + th.at - me.d) / Math.max(0.004, rep.vy)
  }
  const chaseOf = rep.free && !rep.free.td ? (rep.threats.some(th => th.kind === 'stiff' && th.side < 0) ? 9 : 0) : null
  // ── the coverage
  const VD = 0.0088, VX = 0.09
  V0.cover.forEach((m, i) => {
    const tq = threatOf.get(i)
    let tx = m.x, td = m.d, pose = null, dir = 'down', fall = 0, fallX = 0, z = null, lean = 0
    if (!landed) { pose = kicked ? 'ready' : 'ready' }
    else if (tq) {
      // a man coming for him: off the edge (contain) or the safety, square
      const { th, j } = tq, rr = rem(j)
      const beaten = j < rep.j || (j === rep.j && res && rep.failed == null && false)
      const moveRes = rep.moves[j]
      if (moveRes) {
        // he's been beaten: stiff-armed to the turf, or he's grabbed at air
        const age = t - moveRes.at
        const fx = moveRes.kind === 'stiff' ? th.side : -(rep.jukeTo ?? 1)
        if (m.hitAt == null) { m.hitAt = moveRes.at; m.bx = m.x; m.bd = m.d }
        const k = easeOut(clamp(age / 260, 0, 1))
        tx = m.bx + fx * 18 * k; td = m.bd + (moveRes.kind === 'stiff' ? 1.2 : 0.4) * k
        m.x = tx; m.d = td
        pose = 'dive'; fall = clamp((age - 30) / 240, 0, 0.94); fallX = fx
        if (age > 1100) { const bp = beatenPose(i + 2, age - 1100); if (bp) { pose = bp.pose; fall = 0; dir = bp.turn ? 'up' : 'down' } }
        if (!m.landed && age > 250) { m.landed = true; landFx(g, view, m.x, fy(m.d), { side: fx, power: 1.4 }) }
      } else if (res && rep.failed && j === rep.j) {
        // he made the tackle
        const s2 = afterStop(since), fx = rep.failed.kind === 'stiff' ? -th.side : (me.x > m.x ? 1 : -1)
        tx = me.x - fx * 10; td = me.d + 0.35
        m.x += (tx - m.x) * 0.3; m.d += (td - m.d) * 0.3
        pose = 'wrap'; fall = clamp((s2 - 20) / 240, 0, 1); fallX = fx; z = fy(me.d) + 1
        if (since > 1000) { pose = 'point-up'; fall = 0 }
      } else {
        // coming: from his spot to the place he meets him, arriving just as he does
        const close = 1 - clamp((rr - 0) / (th.kind === 'juke' ? 1500 : 1000), 0, 1)
        const meetX = me.x + (th.kind === 'stiff' ? th.side * 15 : 0), meetD = wallD + th.at + 0.5
        const home = th.kind === 'juke' ? { x: CX + (i === 8 ? 40 : 0), d: Math.max(meetD + 6, COVER_D + 4 - rel * 0.002) } : { x: CX + th.side * 152, d: wallD + 2 }
        if (!rep.wallDone && th.kind === 'stiff') { tx = home.x; td = Math.max(home.d, COVER_D - rel * VD) ; pose = rel > 1300 ? 'block' : null }
        else { tx = lerp(home.x, meetX, easeOut(close)); td = lerp(home.d, meetD, close); pose = close > 0.82 ? 'wrap' : null }
        if (rr > 0 && rr < RING_MS) lean = clamp((meetX - m.x) / 200, -0.15, 0.15)
        { const k = Math.min(1, dt / 60); m.x += (tx - m.x) * k; m.d += (td - m.d) * k }
      }
    } else if (i === chaseOf) {
      // running him down from behind
      const f = clamp((me.d - rep.free.d) / Math.max(1, rep.free.down - rep.free.d), 0, 1)
      tx = lerp(m.x, me.x + (i ? 14 : -14), f * 0.5 + 0.2); td = me.d - lerp(5, 0.4, f); dir = 'up'
      if (res) { pose = 'wrap'; tx = me.x + (i ? 9 : -9); td = me.d - 0.4; fall = clamp((afterStop(since) - 20) / 240, 0, 1); fallX = i ? -1 : 1; z = fy(me.d) - 1; if (since > 1000) { pose = 'point-up'; fall = 0 } }
      m.x += (tx - m.x) * 0.25; m.d = Math.max(m.d, td - 0.2); if (res) m.d += (td - m.d) * 0.3
    } else {
      // to his spot on the wall, blocked; once he's by, after him
      const s = i >= 1 && i <= 7 ? i - 1 : null
      const homeX = s != null ? spotX(s) + sealOf(s) + bump(t, i) : COVER_X(i) + (i ? 6 : -6)
      tx = homeX; td = s != null ? wallD + 1.3 : wallD + 2.5
      const ran = COVER_D - rel * VD
      if (ran > td) { td = ran; tx = lerp(COVER_X(i), homeX, clamp(rel / 1300, 0, 1)) }
      else pose = 'block'
      if (passed > 250 && !res) { pose = null; dir = 'up'; td = me.d - 2 - (i % 3); tx = lerp(m.x, me.x, 0.4) }
      if (res && since > 500) { dir = 'up'; pose = res.kind === 'td' ? null : 'ready' }
      if (res?.kind === 'td' && since > 300) { const bp = beatenPose(i, since - 300); if (bp) { pose = bp.pose; dir = bp.turn ? 'down' : 'up' } }
      seekMan(m, tx, td, VX, passed > 0 ? 0.007 : 0.011, dt)
    }
    const w = walk(g, `c${i}${g.i}`, m.x, fy(m.d), 8)
    const step = pose || fall ? null : w.step
    put(m.x, fy(m.d), them, { dir: pose ? dir : dirOfStep(w, dir), step, pose: pose ?? (w.step == null ? 'ready' : null), fall, fallX, z, lean, skin: skinOf(i * 3 + 2), number: COVER_NUM[i], size: SIZE, ...who.them[i] })
  })
  // the kicker: the boot, then he trails the play down (the last man, if it's him)
  {
    const m = V0.kicker, i = 'k', tq = threatOf.get('k')
    if (!kicked) { const f = clamp((t - rep.t0) / (rep.kickAt - rep.t0), 0, 1); m.d = lerp(KICK_D + 7, KICK_D + 0.5, f); m.x = CX - 6 * (1 - f) }
    let pose = null, fall = 0, fallX = 0, dir = 'down', z = null
    if (tq && landed) {
      const { th, j } = tq, rr = rem(j), moveRes = rep.moves[j]
      if (moveRes) {
        const age = t - moveRes.at, fx = -(rep.jukeTo ?? 1)
        if (m.hitAt == null) { m.hitAt = moveRes.at; m.bx = m.x; m.bd = m.d }
        m.x = m.bx + fx * 16 * easeOut(clamp(age / 260, 0, 1))
        pose = 'dive'; fall = clamp((age - 30) / 240, 0, 0.94); fallX = fx
        if (age > 1100) { const bp = beatenPose(5, age - 1100); if (bp) { pose = bp.pose; fall = 0 } }
        if (!m.landed && age > 250) { m.landed = true; landFx(g, view, m.x, fy(m.d), { side: fx, power: 1.4 }) }
      } else if (res && rep.failed && j === rep.j) {
        const s2 = afterStop(since), fx = me.x > m.x ? 1 : -1
        m.x += (me.x - fx * 10 - m.x) * 0.3; m.d += (me.d + 0.35 - m.d) * 0.3
        pose = 'wrap'; fall = clamp((s2 - 20) / 240, 0, 1); fallX = fx; z = fy(me.d) + 1
        if (since > 1000) { pose = 'flex'; fall = 0 }
      } else {
        const close = 1 - clamp(rr / 1500, 0, 1), meetD = wallD + th.at + 0.5
        const home = { x: CX, d: Math.max(meetD + 7, KICK_D - (t - rep.kickAt) * 0.006) }
        { const k = Math.min(1, dt / 60); m.x += (lerp(home.x, me.x, easeOut(close)) - m.x) * k; m.d += (lerp(home.d, meetD, close) - m.d) * k }
        if (close > 0.82) pose = 'wrap'
      }
    } else if (kicked) {
      // (not the last man: he gets caught up in the wash at the wall, and trails the play from there)
      if (rep.wallDone) seekMan(m, CX + (me.x < CX ? 70 : -70), Math.min(m.d, wallD + 4), 0.06, 0.006, dt)
      else seekMan(m, CX + (me.x - CX) * 0.4, Math.max(me.d + 9, KICK_D - (t - rep.kickAt) * 0.006), 0.08, 0.008, dt)
      if (res?.kind === 'td' && since > 400) { const bp = beatenPose(4, since - 400); if (bp) pose = bp.pose }
    }
    const w = walk(g, `k${g.i}`, m.x, fy(m.d), 8)
    put(m.x, fy(m.d), them, { dir: pose ? dir : dirOfStep(w, 'down'), step: pose || fall ? null : w.step, pose: pose ?? (w.step == null ? 'ready' : null), fall, fallX, z, skin: skinOf(1), number: 3, size: SIZE, ...who.kicker })
  }
  // ── ours: set in the setup zone, back to the wall, a block each; out to him once it's over
  const party = res?.kind === 'td' ? since - 700 : -1
  V0.ours.forEach((m, i) => {
    let tx, td, pose = null, dir = 'up'
    const s = i < 7 ? i : null
    if (!landed) { tx = m.x; td = m.d; pose = 'ready' }
    else {
      tx = s != null ? spotX(s) + sealOf(s) - bump(t, i) * 0.6 : CX + (i === 7 ? -150 : 150)
      td = wallD - 0.5
      if (Math.abs(m.d - td) < 0.6) pose = 'block'
      if (passed > 400 && !res) { pose = null; td = me.d - 3 - (i % 3) * 1.5; tx = lerp(tx, me.x, 0.3) }
    }
    if (res && since > 400 && res.kind !== 'td') { pose = 'ready'; td = m.d }
    if (party > 0 && i < 3) { tx = me.x + (i - 1) * 22; td = me.d - 1.5; pose = Math.hypot(tx - m.x, (td - m.d) * PYD) < 18 ? ['arms-up', 'point-up', 'flex'][i] : null }
    // (in the open field three of them chase it down behind him, to be there when he gets in)
    if (rep.free && !res && i < 3) { tx = me.x + (i - 1) * 40; td = me.d - 9 - i * 2 }
    seekMan(m, tx, td, 0.1, party > 0 ? 0.012 : rep.free && i < 3 ? 0.03 : 0.008, dt)
    const w = walk(g, `o${i}${g.i}`, m.x, fy(m.d), 8)
    put(m.x, fy(m.d), us, { dir: pose ? dir : dirOfStep(w, 'up'), step: pose ? null : w.step, pose: pose ?? (w.step == null ? 'ready' : null), skin: skinOf(i * 5 + 4), number: OUR_NUM[i], size: SIZE, ...who.us[i] })
  })
  // the other man deep: he leads him up into the lane, and peels off on the man coming from the side
  {
    const m = V0.mate
    let tx = m.x, td = m.d, pose = null
    if (landed) {
      const lx = laneX(laneNow)
      if (rep.free && !res) { tx = me.x - 30; td = me.d - 7; pose = null }
      else if (!rep.wallDone) { tx = lerp(me.x, lx, 0.7) + (lx >= me.x ? -8 : 8); td = Math.min(me.d + 4, wallD - 1.5) }
      else { tx = m.x; td = m.d; pose = 'block' }
      if (party > 0) { tx = me.x + 26; td = me.d + 0.5; pose = Math.hypot(tx - m.x, (td - m.d) * PYD) < 18 ? 'griddy-' + (Math.floor(t / 170) % 2 ? 'a' : 'b') : null }
      seekMan(m, tx, td, 0.15, rep.free ? 0.03 : 0.0115, dt)
    } else pose = 'ready'
    const w = walk(g, `m${g.i}`, m.x, fy(m.d), 8)
    put(m.x, fy(m.d), us, { dir: pose ? 'up' : dirOfStep(w, 'up'), step: pose ? null : w.step, pose: pose ?? (w.step == null ? 'ready' : null), skin: skinOf(8), number: 21, size: SIZE, ...bare(who.mate) })
  }
  // ── him
  const wm = walk(g, `me${g.i}`, me.x, fy(me.d), 9)
  const M = { size: SIZE, number: 22, skin: skinOf(6), ...who.me, dir: 'up', step: null, pose: 'ready', carry: false, lead: true }
  let jx = 0
  if (!landed) {
    // under it: hands come up as it comes down
    M.pose = t > rep.landAt - 420 ? 'catch-l' : 'ready'
    if (wm.step != null) { M.pose = null; M.step = wm.step }
  } else if (rep.caught?.kind === 'muff' && t < rep.runAt) {
    M.pose = 'touch'; M.carry = t > rep.runAt - 220
  } else if (!res) {
    M.carry = true; M.pose = 'sprint'; M.step = (Math.floor(me.d * PYD / 16) % 8) / 2
    if (Math.abs(rep.vx) > 0.08) M.lean = clamp(rep.vx * 0.5, -0.14, 0.14)
    const lastMove = rep.moves[rep.moves.length - 1], mAge = lastMove ? t - lastMove.at : 1e9
    if (lastMove?.kind === 'juke' && mAge < 170) { M.pose = (rep.jukeTo ?? 1) > 0 ? 'plant-l' : 'plant-r'; M.step = null }
    else if (lastMove?.kind === 'stiff' && mAge < 360) { M.pose = lastMove.side < 0 ? 'stiff-l' : 'stiff-r' }
    else if (rep.tapAt != null && rep.threats[rep.j]?.kind === 'stiff') { M.pose = rep.threats[rep.j].side < 0 ? 'stiff-l' : 'stiff-r' }
    if (lastMove?.kind === 'juke') jx = (rep.jukeTo ?? 1) * 18 * easeOut(clamp(mAge / 160, 0, 1)) * (1 - clamp((mAge - 500) / 700, 0, 1))
    if (g.held && Math.sign(rep.vx) !== Math.sign(rep.lastVx ?? 0) && Math.abs(rep.vx) > 0.05) { plantFx(g, view, me.x, fy(me.d), Math.sign(rep.vx), 6, 0.9) }
    rep.lastVx = rep.vx
  } else if (res.kind === 'td') {
    // into the end zone: he pulls up, the ball goes up, and then his own way of saying it
    const inZ = since
    M.carry = inZ < 900
    M.pose = inZ < 520 ? 'sprint' : inZ < 900 ? 'spike-up' : ['flex', 'point-up', 'griddy', 'arms-up'][rep.party]
    if (M.pose === 'griddy') M.pose = Math.floor(t / 170) % 2 ? 'griddy-a' : 'griddy-b'
    M.step = inZ < 520 ? (Math.floor(t / 70) % 8) / 2 : null
    if (inZ >= 900) M.dir = 'down'
  } else {
    // down: the man who got him drives him over, and they land together
    const s2 = afterStop(since)
    if (!rep.hitFx) { rep.hitFx = true; hitFx(g, view, me.x, fy(me.d), { power: res.kind === 'traffic' ? 4 : 5.5, n: 12, side: me.x < CX ? 1 : -1, up: 22 }) }
    const fx = res.kind === 'traffic' ? (me.x < CX ? 1 : -1) : rep.failed?.kind === 'stiff' ? rep.failed.side * -1 : rep.free ? 1 : (me.x < CX ? 1 : -1)
    M.carry = true; M.fall = clamp((s2 - 15) / 235, 0, 1); M.fallX = fx; M.pose = null
    if (s2 > 250 && !rep.landFx) { rep.landFx = true; landFx(g, view, me.x, fy(me.d), { side: fx, s: 1 }) }
  }
  // (in the wall: two of theirs on him)
  if (res?.kind === 'traffic') {
    const s2 = afterStop(since)
    ;[-1, 1].forEach((sd, n) => {
      put(me.x + sd * 12, fy(me.d + 0.5 + n * 0.3), them, { dir: 'down', pose: 'wrap', fall: clamp((s2 - 40) / 260, 0, 0.9), fallX: -sd, skin: skinOf(n * 4 + 1), number: COVER_NUM[(Math.round((me.x - SL) / 34) + n) % 10] })
    })
  }
  put(me.x + jx, fy(me.d), us, M)
  tagsAll(!!res && since > 700)
  action(ctx, view)
  // the ball: off the tee, end over end, down to him (its shadow on the turf under it); on the turf in a muff
  if (kicked && !landed) {
    // (from behind him a kick comes at the lens: most of its ground is covered early, and it drops on to him)
    const f = fBall, e = 1 - Math.pow(1 - f, 2.2), bx = lerp(CX, rep.land.x, e), z = 4 + Math.sin(f * Math.PI) * 190 + (1 - f) * 6
    const bd = lerp(KICK_D, rep.land.d + 0.3, e)
    ballInAir(ctx, view, bx, fy(bd), z, 0, 1.15)
  } else if (!kicked) {
    const q = tilt(view, CX, fy(KICK_D))
    ctx.fillStyle = '#f08a1c'; ctx.fillRect(q.x - 2.5 * q.s, q.y - 2 * q.s, 5 * q.s, 2 * q.s)
    ballInAir(ctx, view, CX, fy(KICK_D), 4, 0, 1)
  } else if (rep.caught?.kind === 'muff' && t < rep.runAt - 200) {
    looseBall(ctx, view, me.x + 10, fy(me.d + 0.4), t - rep.landAt, false)
  }
  // the ring: on the ball coming down, then on each man as he closes
  if (g.tell.ring && !res) {
    let p, y
    if (g.tell.what === 'catch') { p = tilt(view, me.x, fy(me.d)); y = p.y - 64 * p.s * SIZE }
    else {
      const th = rep.threats[rep.j], m = th && (thIdx(th) === 'k' ? V0.kicker : V0.cover[thIdx(th)])
      if (m) { p = tilt(view, m.x, fy(m.d)); y = p.y - 34 * p.s * SIZE }
    }
    if (p) {
      const r = g.tell.rem, k = clamp(1 - r / (g.tell.what === 'catch' ? RING_C : RING_MS), 0, 1.3)
      const win = g.tell.what === 'catch' ? g.W.cGood : g.W.good, on = Math.abs(r) <= win
      const R0 = 10 * p.s, rad = lerp(42 * p.s, R0, Math.min(1, k)) - Math.max(0, k - 1) * 12 * p.s
      ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(245,220,138,.9)'
      ctx.beginPath(); ctx.arc(p.x, y, R0, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeStyle = on ? '#fff' : 'rgba(255,255,255,.55)'; ctx.lineWidth = on ? 3.4 : 2.4
      ctx.beginPath(); ctx.arc(p.x, y, Math.max(2, rad), 0, Math.PI * 2); ctx.stroke()
    }
  }
  // the return, called over the wall the way the booth would, once it's set (gold: the lane's moved)
  if (landed && !res && !rep.wallDone && g.tell.lane != null) {
    const q = tilt(view, laneX(g.tell.lane), fy(wallD + 4.5))
    const word = g.tell.lane === 0 ? 'MIDDLE RETURN' : g.tell.lane < 0 ? 'RETURN LEFT' : 'RETURN RIGHT'
    text(ctx, word, q.x, q.y, { font: DISPLAY, size: 17, color: g.tell.shift ? GOLD : 'rgba(255,255,255,.88)' })
  }
  g.dirt.draw(ctx, t)
  if (g.phase === 'set') warm(g, us, them)
  vignette(ctx, view)
}
// everyone's looks ahead of time, a few a frame while the kicker's lining up
function warm(g, us, them) {
  if (g.warmFor !== g.i) {
    g.warmFor = g.i; g.warmed = 0
    const who = g.who, list = []
    const me = { color: us.color, trim: us.trim, pants: us.trim, skin: who.me?.skin ?? skinOf(6), number: who.me?.number ?? 22, kit: 'pads', carry: true, pose: null }
    for (let s = 0; s < 8; s++) list.push({ ...me, dir: 'up', step: s / 2, pose: 'sprint' })
    for (const pose of ['plant-l', 'plant-r', 'stiff-l', 'stiff-r', 'catch-l', 'touch', 'spike-up', 'flex', 'point-up', 'griddy-a', 'griddy-b', 'arms-up']) list.push({ ...me, dir: 'up', pose })
    const T = { color: them.color, trim: them.trim, pants: them.trim, skin: skinOf(2), number: 44, kit: 'pads', carry: false }
    for (const step of [0, 1, 2, 3]) list.push({ ...T, dir: 'down', step, pose: null })
    for (const pose of ['wrap', 'dive', 'block', 'ready']) list.push({ ...T, dir: 'down', pose })
    g.warmL = list
  }
  for (let n = 0; n < 4 && g.warmed < g.warmL.length; n++, g.warmed++) warmAthlete(g.warmL[g.warmed])
}
void manOf; void paceOf
