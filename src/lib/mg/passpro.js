// Pass Pro: the offensive tackle's half of the pass rush (rush.js is the other half), from behind him: the
// QB at the bottom of the screen, our man in front of him at the edge of the line, and the man rushing him
// across from him. Three snaps. On each one the rusher makes one move, and you make one call:
//   WIDE    he takes his first step to the outside (a speed rush): OUTSIDE
//   UNDER   he cuts back under you, inside: INSIDE
//   BULL    he drops his pads and comes straight at you: ANCHOR
// His first step shows it, plain, and a ring closes on him: tap the pad for his move as it closes.
// The right pad in time stones him and the ball's out clean. The wrong pad and he's by you: a sack. The right
// pad too early (before his first step, or before the ring's in) or too late: he gets a hand on the QB, hurried.
// At A and S grades one snap is a counter: he shows wide, then comes back under. The second step is the real one.
// Two clean snaps of the three hold the pocket (the score: a clean snap 2, hurried 1, of 6).
//
// The rules are all here with no screen, in field units: x across, d up the field from the line of
// scrimmage (the QB is at a small negative d, behind our man). The camera is pass-rush's (lib/mg/index.js).
import { byV, clamp, lerp, outcome, rngOf, layer, manOf, xiOf, paceOf, easeOut, particles, nudge, text, DISPLAY, LABEL, GOLD, GOOD, BAD } from './kit.js'
import { tilt, untilt, ground, stands, floodlight, vignette, skinOf, airBall, warmAthlete, crowdPop } from './art.js'
import { afterStop, fxSeed, hitFx, plantFx, landFx, pushIn } from './contact.js'
import { paintFieldFlat, qbPose, lightFx } from './throw.js'
import { put, action, tagsAll, teamOf, walk, ballInAir } from './read.js'

export const how = {
  'pass-pro': 'Three snaps: he goes wide, tap OUTSIDE; he cuts under, INSIDE; he bull-rushes straight at you, ANCHOR. Tap it as the ring closes on him.',
}

const YD = 20
const SP = 44                // between linemen
const SIZE = 1.7
const TURF_X = (53.33 * YD) / 344
const OL_NUM = [74, 66, 52, 63, 78]
const DL_NUM = [97, 93, 99, 95]
const STAMP_Y = 0.25
const ME_D = -16, SET_D = -34, RU_D = 26
const QB_GUN = -76, QB_SET = -94, SNAP_MS = 170
const GET_OFF = 330          // the snap to his first step (and a beat of his own on top)
const STEP_MS = 240          // his first step: the move, big and plain
const CROSS_MS = 320         // a counter: the show wide, this long, then the real step back under
const BALL_OUT = 650         // he's stopped: the ball's out this long after
const HURRY_MS = 480         // he's got a hand on him: the ball's out this long after, under pressure
const PANCAKE_MS = 40        // dead on the ring: he's on his back
const COUNTER_AT = 10        // A and S: one snap's a counter
// what the ratings buy (the game's one value: the average of Pass Pro, Mobility, Anchor, Blitz Pickup, Length)
// (the time to read him comes slowly through the middle grades, and quickly at the top)
const bent = v => 1 + 10 * clamp((v - 1) / 10, 0, 1) ** 1.6
const LEAD = v => byV(bent(v), 530, 595)   // his first step to the ring closing on him
const OPEN = v => byV(v, 270, 380)         // the window opens this long before the ring closes
const LATE = v => byV(bent(v), 110, 160)   // and stays open this long after
const SLIDE_V = v => byV(v, 0.24, 0.3) // his feet, sliding with him

// where he goes. side: 1 the outside, -1 the inside, 0 straight on (times s on the screen)
const MOVE = {
  wide: { side: 1, word: 'WIDE!', first: [62, RU_D - 10], arrive: [26, SET_D + 18] },
  under: { side: -1, word: 'UNDER!', first: [-14, RU_D - 12], arrive: [-20, SET_D + 24] },
  bull: { side: 0, word: 'BULL!', first: [14, RU_D - 22], arrive: [3, SET_D + 20] },
}
const PAD = { wide: 'OUTSIDE', under: 'INSIDE', bull: 'ANCHOR' }

const bare = m => m && { number: m.number, skin: m.skin }
// (from the full eleven: the man on him by name, a man off the play named once the snap's over)
const named = m => (m?.last ? m : bare(m))
const quiet = m => (m?.last ? { ...m, quiet: true } : bare(m))
const seek = (m, x, d, v, dt) => {
  const dx = x - m.x, dd = d - m.d, e = Math.hypot(dx, dd)
  if (e < 0.01) return true
  const mv = Math.min(e, v * dt)
  m.x += (dx / e) * mv; m.d += (dd / e) * mv
  return mv >= e
}
const far = (a, b) => Math.hypot(a.x - b.x, a.d - b.d)
// (on time: the speed that gets him there as the clock runs out)
const onTime = (m, x, d, left) => Math.min(0.6, Math.hypot(x - m.x, d - m.d) / Math.max(16, left))

function castOf(cast) {
  // the full eleven a side (career's xi): his own line by name, their four down and both backers
  if (cast?.us?.xi && cast?.them?.xi) {
    const x = (side, spot, i) => xiOf(cast, side, spot, i)
    return {
      me: cast.me ?? null,
      ol: [0, 1, 2, 3, 4].map(i => { const m = x('us', 'ol', i); return m && !m.me ? m : null }),
      dl: [0, 1, 2, 3].map(i => x('them', 'dl', i)),
      lb: x('them', 'lb', 0), lb2: x('them', 'lb', 1),
      // (he's the lineman: a cast made for a QB, practice while OL is hidden, puts the real starter behind him)
      qb: x('us', 'qb', 0)?.me ? x('us', 'qb', 1) : x('us', 'qb', 0), rb: x('us', 'rb', 0),
      pace: paceOf(cast, 'them', 'dl', 0),
    }
  }
  return {
    me: cast?.me ?? null,
    ol: [0, 1, 2, 3, 4].map(i => (cast?.us?.ol?.length > i + 1 ? bare(cast.us.ol[i + 1]) : null)),
    dl: [0, 1, 2, 3].map(i => manOf(cast, 'them', 'dl', i)),
    lb: manOf(cast, 'them', 'lb', 0),
    qb: manOf(cast, 'us', 'qb', 0), rb: manOf(cast, 'us', 'rb', 0),
    pace: paceOf(cast, 'them', 'dl', 0),
  }
}

export function make({ v, seed, cast }) {
  const r = rngOf(seed), n = 3
  const s = r() < 0.5 ? -1 : 1               // his side: -1 the left tackle, 1 the right. Outside is s on the screen.
  const MX = 180 + s * 30, CX = MX - s * 2 * SP
  // one of each, in any order (and at A or S, the one coming under sells it wide first)
  const order = ['wide', 'under', 'bull']
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
  const plan = order.map((move, k) => ({
    k, move, counter: move === 'under' && v >= COUNTER_AT, wait: 750 + r() * 550, jit: r() * 120,
    snapAt: 0, tellAt: 0, crossAt: 0, contactAt: 0, open: 0, close: 0,
    res: null, pressed: null, won: null, doom: null, hurry: null, pancake: false, thrown: null, throwAt: 0, why: null,
    me: { x: MX, d: ME_D }, ru: { x: MX + s * 28, d: RU_D }, qb: { x: CX, d: QB_GUN },
    punchAt: -999, stoneAt: -999,
  }))
  const zoneOf = move => (MOVE[move].side === 0 ? 1 : MOVE[move].side * s < 0 ? 0 : 2)
  const g = {
    t: 0, game: 'pass-pro', zones: 'three', anyKey: true, padLit: null, litAt: -999, fx: [], done: null, outro: 1500, stamp: null, later: null,
    dirt: particles(44, fxSeed(seed)), paper: particles(40, fxSeed(`${seed}|paper`)), nudge: nudge(),
    pads: s < 0 ? ['OUTSIDE', 'ANCHOR', 'INSIDE'] : ['INSIDE', 'ANCHOR', 'OUTSIDE'],
    plan, i: 0, rep: plan[0], phase: 'set', nextAt: 0, who: castOf(cast), s, MX, CX,
    clean: 0, pressures: 0, sacks: 0, pancakes: 0, popAt: -1e9,
    // what a player can see: all a bot gets. type: the move his body's showing ('wide', 'under', 'bull'), zone: its pad,
    // contactAt / open / close: the ring (it closes at contactAt; the window is open to close)
    tell: { snapped: false, type: null, zone: null, contactAt: null, open: null, close: null },
    // (padCue: the pad for the move he's showing, outlined)
    padCue: null,
    hud: { prompt: 'WAIT FOR THE SNAP', dots: plan.map(() => null) },
    zoneFor(side) { return side < 0 ? 0 : 2 },
    zoneOf,
    tick(dt) {
      g.t += dt
      if (g.t - g.litAt > 110) g.padLit = null
      if (g.later && g.t >= g.later.at) { g.stamp = g.later; g.later = null }
      const rep = g.rep
      if (g.phase === 'set') {
        if (g.t >= rep.snapAt) snap(rep)
        return
      }
      if (g.phase === 'play') rules(rep)
      move(rep, dt)
      if (g.phase === 'beat' && !g.done && g.t >= g.nextAt) next()
    },
    input(a) {
      if (a.kind !== 'down' || a.zone == null) return
      g.padLit = a.zone; g.litAt = g.t
      const rep = g.rep
      // (before the snap a tap does nothing: you're set, waiting on the ball)
      if (g.done || g.phase !== 'play' || rep.res || rep.pressed) return
      call(rep, a.zone)
    },
  }
  // what his body's showing right now
  const real = rep => (rep.counter ? 'under' : rep.move)
  function shown(rep, t) {
    if (t < rep.tellAt) return null
    if (rep.counter && t < rep.crossAt) return 'wide'
    return real(rep)
  }
  const dirOf = rep => (MOVE[real(rep)].side || 1) * s   // (the way he goes by you, on the screen: a bull goes round the outside)
  function setUp(rep) {
    rep.me.x = MX; rep.me.d = ME_D
    rep.qb.x = CX; rep.qb.d = QB_GUN
    rep.ru = { x: MX + s * 28, d: RU_D }
    rep.snapAt = g.t + rep.wait
    Object.assign(g.tell, { snapped: false, type: null, zone: null, contactAt: null, open: null, close: null })
    g.hud.prompt = 'WAIT FOR THE SNAP'; g.hud.hot = false; g.padCue = null
    g.phase = 'set'
  }
  function snap(rep) {
    g.phase = 'play'
    g.tell.snapped = true
    g.fx.push('tap', 'h:light')
    const t = g.t
    rep.tellAt = t + GET_OFF + rep.jit
    rep.crossAt = rep.counter ? rep.tellAt + CROSS_MS : rep.tellAt
    rep.contactAt = rep.crossAt + LEAD(v)
    rep.open = rep.contactAt - OPEN(v)
    rep.close = rep.contactAt + LATE(v)
    g.hud.prompt = 'WATCH HIS FIRST STEP'
  }
  // your call
  function call(rep, zone) {
    const t = g.t, mv = real(rep)
    rep.pressed = { at: t, zone }
    if (t < rep.tellAt) return hurried(rep, 'TOO EARLY', 'TOO EARLY: WAIT FOR HIS FIRST STEP')
    if (zone !== zoneOf(mv)) {
      if (rep.counter && zone === zoneOf('wide')) return beaten(rep, 'BIT ON THE FAKE', 'COUNTER: HE SOLD WIDE, THEN CAME BACK UNDER')
      const why = { wide: 'HE WENT WIDE: SLIDE OUTSIDE WITH HIM', under: 'HE CUT UNDER: SLIDE INSIDE WITH HIM', bull: 'BULL RUSH: SIT DOWN AND ANCHOR' }[mv]
      return beaten(rep, mv === 'bull' ? 'RUN OVER' : 'BEAT', why)
    }
    if (t < rep.open) return hurried(rep, 'TOO EARLY', 'TOO EARLY: LET THE RING CLOSE ON HIM')
    stoned(rep, t)
  }
  function stoned(rep, t) {
    const hit = Math.max(t, rep.contactAt - 50)   // (the hands land as he gets to you)
    rep.won = { at: t }
    rep.punchAt = hit; rep.stoneAt = hit
    rep.throwAt = Math.max(t, rep.contactAt) + BALL_OUT
    g.fx.push('pop', 'h:medium')
    if (rep.move !== 'bull' && Math.abs(t - rep.contactAt) <= PANCAKE_MS) {
      // dead on the ring: he's on his back
      rep.pancake = { at: hit }   // (where he lands: wherever the hands meet him, set as they do)
      g.pancakes++
      g.stamp = { text: 'PANCAKE', good: true, at: hit, ms: 760, size: 44 }
      g.fx.push('stamp', 'h:heavy')
      return
    }
    g.stamp = { text: rep.move === 'bull' ? 'ANCHORED' : 'STONED', good: true, at: hit, ms: 560, size: 34 }
  }
  // the right call, the wrong moment: he gets a hand on the QB
  function hurried(rep, word, why) {
    rep.why = why
    rep.hurry = { at: g.t + HURRY_MS }
    g.stamp = { text: word, good: false, at: g.t, ms: 480, size: 32 }
    g.fx.push('tap', 'h:medium')
  }
  // the wrong call: he's by you
  function beaten(rep, word, why) {
    rep.why = why
    rep.doom = { at: g.t, dir: dirOf(rep), zone: rep.pressed?.zone ?? null }
    g.stamp = { text: word, good: false, at: g.t, ms: 460, size: 32 }
    g.fx.push('swoosh', 'h:medium')
  }
  function settle(rep, kind) {
    rep.res = { kind, at: g.t }
    const good = kind === 'clean' ? true : kind === 'pressure' ? null : false
    if (kind === 'clean') g.clean++
    if (kind === 'pressure') g.pressures++
    if (kind === 'sack') g.sacks++
    g.hud.dots[g.i] = kind === 'clean'   // (two clean ones hold it: a hurried one doesn't count)
    // what happened, in a line: why he got there
    g.hud.prompt = kind === 'clean' ? (rep.pancake ? 'PANCAKE: HE NEVER GOT UP' : 'BALL OUT: NOBODY GOT HOME') : rep.why ?? null
    g.hud.hot = false; g.padCue = null
    Object.assign(g.tell, { type: null, zone: null, contactAt: null, open: null, close: null })
    const words = { clean: 'CLEAN POCKET', pressure: 'HURRIED', sack: 'SACK' }
    const beat = { clean: 1300, pressure: 1250, sack: 1400 }[kind]
    g.stamp = { text: words[kind], good, at: g.t + (kind === 'clean' ? 140 : 0), ms: beat - 140, size: kind === 'clean' ? 40 : 46 }
    g.fx.push(kind === 'clean' ? 'stamp' : 'tap', kind === 'sack' ? 'h:heavy' : 'h:medium')
    if (kind === 'clean') g.popAt = g.t
    g.phase = 'beat'
    g.nextAt = g.t + beat
    if (plan.every(p => p.res)) {
      const pts = g.clean * 2 + g.pressures
      const hit = g.clean >= 2
      const score = clamp(pts / 6 + g.pancakes * 0.04, 0, 1)
      const note = [`${g.clean} clean`, g.pressures && `${g.pressures} hurried`, g.sacks && `${g.sacks} sack${g.sacks === 1 ? '' : 's'}`, g.pancakes && `${g.pancakes} pancake${g.pancakes === 1 ? '' : 's'}`].filter(Boolean).join(' · ')
      g.done = outcome(hit ? Math.max(score, 0.5) : Math.min(score, 0.45), hit, note, { made: g.clean, of: n, clean: g.clean, pressures: g.pressures, sacks: g.sacks, pancakes: g.pancakes }, false)
      const word = hit ? (g.clean === n ? 'BRICK WALL' : 'POCKET HELD') : 'POCKET COLLAPSED'
      g.later = { text: word, good: hit, at: g.t + beat - 100, size: word.length > 12 ? 36 : 44 }
      g.outro = beat + 1000
      if (hit) g.perfect = g.clean === n
    }
  }
  function next() {
    g.i++
    g.rep = plan[g.i]
    g.stamp = null
    setUp(g.rep)
  }
  // ── the rules, each frame of a live snap ──
  function rules(rep) {
    const t = g.t, tl = g.tell
    if (rep.res) return
    if (rep.doom) {
      if (far(rep.ru, rep.qb) < 24 || t - rep.doom.at > 760) settle(rep, 'sack')
      return
    }
    if (rep.hurry) { if (t >= rep.hurry.at) { rep.thrown = t; settle(rep, 'pressure') } return }
    if (rep.won) { if (t >= rep.throwAt) { rep.thrown = t; settle(rep, 'clean') } return }
    // what's on the screen
    const mv = shown(rep, t)
    tl.type = mv; tl.zone = mv ? zoneOf(mv) : null
    tl.contactAt = mv ? rep.contactAt : null; tl.open = mv ? rep.open : null; tl.close = mv ? rep.close : null
    g.hud.prompt = !mv ? 'WATCH HIS FIRST STEP' : rep.counter && t >= rep.crossAt ? 'BACK UNDER!' : MOVE[mv].word
    g.hud.hot = !!mv && t >= rep.open
    g.padCue = tl.zone
    if (t > rep.close) hurried(rep, 'LATE', 'LATE: TAP AS THE RING CLOSES')
  }
  // ── where everybody is (the same with no screen: the bot doesn't look at it) ──
  function move(rep, dt) {
    const t = g.t, me = rep.me, ru = rep.ru, qb = rep.qb, age = t - rep.snapAt, res = rep.res
    if (g.phase === 'set') return
    if (age > SNAP_MS) seek(qb, qb.x, QB_SET, 0.07, dt)
    if (res?.kind === 'sack') return
    if (rep.doom) {
      // he's by: our man went the wrong way (or sat down on a man going round him)
      const dir = rep.doom.dir || (ru.x < qb.x ? -1 : 1), z = rep.doom.zone
      seek(ru, qb.x + dir * 6, qb.d + 10, 0.3 * g.who.pace, dt)
      if (z === 0 || z === 2) seek(me, MX + (z === 0 ? -1 : 1) * 30, SET_D, SLIDE_V(v), dt)
      else seek(me, me.x + dir * 4, me.d - 4, 0.06, dt)
      return
    }
    if (rep.hurry || res?.kind === 'pressure') {
      // he's got a hand on him: a bull walks our man back into the QB's lap; wide, round the edge and behind
      // the QB; under, up in his face
      const mv = real(rep)
      if (mv === 'bull') { seek(me, lerp(MX, qb.x, 0.35), qb.d + 30, 0.16, dt); seek(ru, me.x + s * 3, me.d + 20, 0.3, dt); return }
      const under = mv === 'under'
      seek(ru, qb.x + s * (under ? 24 : 52), qb.d + (under ? 20 : 4), 0.25, dt)
      seek(me, ru.x - s * 14 * (under ? -1 : 1), ru.d + 8, 0.25, dt)
      return
    }
    // a pancake: he goes over on his back, off to the side he was on, and our man steps up over him
    if (rep.pancake && t >= rep.pancake.at && rep.pancake.x == null) { const side = ru.x >= me.x ? 1 : -1; Object.assign(rep.pancake, { x: ru.x + side * 10, d: me.d + 52, md: me.d + 6, side }) }
    if (rep.pancake && t >= rep.pancake.at) { seek(ru, rep.pancake.x, rep.pancake.d, 0.16, dt); seek(me, me.x, rep.pancake.md, 0.05, dt); return }
    const mv = shown(rep, t)
    if (rep.won) {
      // with him: our man slides to meet him, he arrives on the beat, chest to chest, and that's where he stays
      const M = MOVE[real(rep)]
      seek(me, MX + s * M.arrive[0] * 0.6, SET_D - 2, SLIDE_V(v), dt)
      const cx = me.x + s * (M.side * 8 || 3), cd = me.d + 20
      if (t < rep.punchAt) seek(ru, cx, cd, onTime(ru, cx, cd, rep.punchAt - t), dt)
      else if (res?.kind !== 'clean' || t - res.at < 600) {
        seek(ru, me.x + s * 3, me.d + 20, 0.22, dt)
        if (t - rep.stoneAt < 150) seek(ru, ru.x, me.d + 30, 0.2, dt)
      }
      return
    }
    // our man sets: kicks back to his spot, and gives a little ground the way he's going (mirroring him: the
    // feet only, the hands are the call)
    seek(me, MX + (mv ? s * MOVE[mv].arrive[0] * 0.6 : 0), SET_D, 0.14, dt)
    if (!mv) { seek(ru, MX + s * 26, RU_D - 4, 0.1, dt); return }
    // his first step: big and plain. Then he comes on to get to you as the ring closes
    const from = rep.counter && t >= rep.crossAt ? rep.crossAt : rep.tellAt
    const M = MOVE[mv]
    if (t < from + STEP_MS) { const fx = MX + s * M.first[0]; seek(ru, fx, M.first[1], onTime(ru, fx, M.first[1], from + STEP_MS - t) * 1.1, dt); return }
    if (rep.counter && mv === 'wide') return   // (sold: he sits on the outside step a beat)
    const ax = MX + s * M.arrive[0]
    if (t < rep.contactAt) seek(ru, ax, M.arrive[1], onTime(ru, ax, M.arrive[1], rep.contactAt - t), dt)
    else seek(ru, ax + dirOf(rep) * 14, SET_D, 0.1, dt)   // nobody on him: he's into the pocket
  }
  setUp(plan[0])
  return g
}


// ── The picture ─────────────────────────────────────────────────────────────
// Behind the pocket: the QB's feet just over the thumbs, our man up and to the side of him, the rush beyond.
const losOf = view => Math.round(untilt(view, 180, view.h - 150).y + QB_SET)
function stage(ctx, view, los) {
  const c = view.colors, hy = tilt(view, 0, 0).y
  layer(ctx, view, `passpro|${c.us}|${c.trim}|${los}`, x => {
    stands(x, view, 'field', [c.us, c.trim])
    ground(x, view, f => {
      f.save(); f.translate(180, 0); f.scale(TURF_X, 1); f.translate(-180, 0)
      paintFieldFlat(f, view, los - 35 * YD, YD, c.us, false)   // (their 35: the logo at midfield stays behind the camera)
      f.restore()
      f.fillStyle = '#3f86ff'; f.fillRect(-120, los - 1.6, 600, 3.2)
      // the line to gain, ten yards on
      f.fillStyle = '#f7d64a'; f.fillRect(-120, los - 10 * YD - 1.6, 600, 3.2)
    }, `passpro-flat|${c.us}|${los}`, 0, Math.round((view.h - hy) * view.px * 0.7))
    floodlight(x, view)
  })
}
const dirFrom = (w, still) => (w.step == null ? still : Math.abs(w.dx) > Math.abs(w.dy) * 1.2 ? (w.dx > 0 ? 'right' : 'left') : w.dy > 0 ? 'down' : 'up')
const sideName = x => (x < 0 ? 'left' : 'right')
const bump = (g, i) => Math.sin(g.t / (190 + i * 17) + i * 1.9) * 2.5
function warmList(g, us, them) {
  const who = g.who, list = []
  const me = { color: us.color, trim: us.trim, pants: us.trim, skin: who.me?.skin ?? skinOf(4), number: who.me?.number ?? 76, kit: 'pads', carry: false, step: null, dir: 'up' }
  const ru = { color: them.color, trim: them.trim, pants: them.trim, skin: who.dl[0]?.skin ?? skinOf(11), number: who.dl[0]?.number ?? DL_NUM[0], kit: 'pads', carry: false, step: null, dir: 'down' }
  for (const step of [0, 1, 2, 3, null]) {
    for (const pose of ['slide', 'back', null]) list.push({ ...me, step, pose })
    list.push({ ...ru, step, pose: null })
    list.push({ ...ru, dir: 'side', number: null, step, pose: null })
  }
  for (const pose of ['block', 'stance', 'flex', 'point-up', 'arms-up']) list.push({ ...me, pose })
  for (const pose of ['block', 'stance', 'wrap', 'back']) list.push({ ...ru, pose })
  return list
}
function warm(g, list) {
  g.warmed = g.warmed ?? 0
  for (let n = 0; n < 5 && g.warmed < list.length; n++, g.warmed++) warmAthlete(list[g.warmed])
}

export function draw(ctx, g, view0) {
  if (g.stamp && g.stamp.y == null) g.stamp.y = view0.h * STAMP_Y
  if (g.later && g.later.y == null) g.later.y = view0.h * STAMP_Y
  const c = view0.colors, us = teamOf(c, 0), them = teamOf(c, 1), rep = g.rep, res = rep.res, who = g.who, s = g.s
  const los = losOf(view0)
  const fy = d => los - d
  const snapped = g.phase !== 'set', age = g.t - rep.snapAt, since = res ? g.t - res.at : -1
  const sack = res?.kind === 'sack', me = rep.me, ru = rep.ru, qb = rep.qb
  // the camera leans in on a sack or a pancake, and eases back for the next snap
  const focus = sack ? qb : ru
  const fAt = tilt(view0, focus.x, fy(focus.d))
  const lean = sack ? easeOut(clamp(since / 240, 0, 1)) : rep.pancake ? 0.3 * easeOut(clamp((g.t - rep.stoneAt) / 260, 0, 1)) : 0
  // (always a little in on the pocket: the fight is the picture, the far field and the stands over it)
  const pk = tilt(view0, (g.MX + g.CX) / 2, fy(-28))
  const Z = 1.2 + 0.3 * lean, ax = lerp(pk.x, fAt.x, lean), ay = lerp(pk.y, fAt.y - 30, lean), toX = 180, toY = lerp(view0.h * 0.6, view0.h * 0.5, lean)
  const view = pushIn(ctx, g, view0, Z, ax, ay, 1.5, toX, toY)
  // a field point to where it is on the screen, through that push
  const scr = (x, d) => { const p = tilt(view0, x, fy(d)); return { x: toX + (p.x - ax) * Z, y: toY + (p.y - ay) * Z, s: p.s * Z } }
  stage(ctx, view, los)
  crowdPop(ctx, view, [c.us, c.trim], g.t - g.popAt)
  const s2 = sack ? afterStop(since) : since
  const qFall = sack ? clamp((s2 - 10) / 240, 0, 1) : 0
  const fallX = Math.sign(qb.x - ru.x) || s
  // turf and contact: the snap, a punch landing, a pancake, a sack
  if (snapped && !rep.snapFx) { rep.snapFx = true; plantFx(g, view, me.x, fy(me.d), 0, 3); plantFx(g, view, ru.x, fy(ru.d), 0, 3) }
  const live = snapped && !res && !rep.won && !rep.doom && !rep.hurry
  const showing = live && g.t >= rep.tellAt ? (rep.counter && g.t < rep.crossAt ? 'wide' : rep.counter ? 'under' : rep.move) : null
  // his first step hits the turf hard (and again on a counter, coming back under)
  const stepAt = rep.counter && g.t >= rep.crossAt ? rep.crossAt : rep.tellAt
  if (showing && rep.stepFx !== stepAt) { rep.stepFx = stepAt; plantFx(g, view, ru.x, fy(ru.d), MOVE[showing].side * s, 5) }
  if (rep.won && g.t >= rep.punchAt && !rep.punchSeen) {
    rep.punchSeen = true
    hitFx(g, view, (me.x + ru.x) / 2, (fy(me.d) + fy(ru.d)) / 2, { power: rep.pancake ? 4.5 : rep.move === 'bull' ? 3 : 2.6, n: rep.pancake ? 10 : 6, dust: 1, s: 0.9, up: 40 })
  }
  if (rep.pancake && g.t - rep.stoneAt > 300 && !rep.flatFx) { rep.flatFx = true; landFx(g, view, ru.x, fy(ru.d), { side: 0, power: 3 }) }
  // an anchor: he sits down, and his cleats dig in as the bull hits him
  if (rep.won && rep.move === 'bull' && g.t >= rep.punchAt && g.t - rep.punchAt < 480 && Math.floor(g.t / 120) !== rep.dig) { rep.dig = Math.floor(g.t / 120); plantFx(g, view, me.x, fy(me.d), 0, 2, 0.9) }
  if (sack && !rep.hitFx) { rep.hitFx = true; hitFx(g, view, qb.x, fy(qb.d), { power: 7.5, n: 16, dust: 4, side: fallX, up: 26 }); g.fx.push('stamp') }
  if (sack && s2 > 260 && !rep.landFx) { rep.landFx = true; landFx(g, view, qb.x, fy(qb.d), { side: fallX, power: 3 }) }
  // the rest of the line, on each other
  const pc = snapped ? clamp(age / 600, 0, 1) : 0
  for (let i = -2; i <= 2; i++) {
    if (i === 2 * s) continue
    const b = snapped ? bump(g, i + 3) : 0
    const x = g.CX + i * SP
    put(x + b * 0.6, fy(ME_D - 10 * pc + Math.abs(b) * 0.3), us, { dir: 'up', pose: snapped ? 'block' : 'stance', skin: skinOf(i + 4), number: OL_NUM[i + 2], size: SIZE, ...quiet(who.ol[i + 2]) })
  }
  // their front: the three not on him
  const front = [g.CX + s * 0.55 * SP, g.CX - s * 0.55 * SP, g.CX - s * 2.4 * SP]
  front.forEach((x, i) => {
    const b = snapped ? bump(g, i + 7) : 0
    put(x + b, fy(RU_D - 6 - 12 * pc - Math.abs(b) * 0.4), them, { dir: 'down', pose: snapped ? 'block' : 'stance', skin: skinOf(i * 2 + 9), number: DL_NUM[i + 1], size: SIZE, ...quiet(who.dl[i + 1]) })
  })
  // the linebackers, off the ball
  const lbs = [[g.CX - s * 0.2 * SP, 57, quiet(who.lb2)], [g.MX - s * 0.4 * SP, 54, quiet(who.lb)]]
  lbs.forEach(([x, number, look], i) => put(x, fy(80 + i * 4), them, { dir: 'down', pose: 'ready', skin: skinOf(i + 2), number, size: SIZE, ...look }))
  // the back stays in, on the far side of the QB, and steps up into a gap
  const rbx = qb.x - s * 34, rbd = snapped ? lerp(QB_GUN + 2, QB_GUN + 26, clamp(age / 600, 0, 1)) : QB_GUN + 2
  put(rbx, fy(rbd), us, { dir: 'up', pose: snapped && age > 500 ? 'block' : 'ready', skin: skinOf(6), number: 28, size: SIZE, ...who.rb })
  // the QB: the ball comes back, he sets, it comes out at the end of his clock
  const thrown = rep.thrown != null ? g.t - rep.thrown : -1
  const arm = thrown >= 0 && !qFall ? qbPose(null, thrown) : null
  const caught = snapped && age >= SNAP_MS
  const throwX = qb.x + s * 30
  const qw = walk(g, `qb${g.i}`, qb.x, qb.d, 8)
  const qCheer = res?.kind === 'clean' && thrown > 650
  put(qb.x, fy(qb.d), us, {
    dir: arm ? 'up' : 'up', pose: arm ?? (qFall ? null : qCheer ? 'point-up' : caught ? (qw.step != null ? null : 'qb-set') : 'ready'), step: arm || qFall ? null : qw.step,
    carry: caught && thrown < 0 && !sack, fall: qFall, fallX, z: sack ? fy(qb.d) - 1 : undefined, skin: skinOf(9), number: 9, size: SIZE, ...who.qb,
  })
  // the man on him
  const wr = walk(g, `ru${g.i}`, ru.x, ru.d, 7)
  const R = { dir: 'down', skin: skinOf(11), number: DL_NUM[0], size: SIZE, ...named(who.dl[0]), step: null, pose: 'stance', squat: 0, lead: true }
  const party = sack ? clamp((s2 - 560) / 170, 0, 1) : 0
  if (snapped) {
    if (party >= 1) { R.pose = rep.k % 2 ? 'point-up' : 'flex'; R.dir = 'down'; R.z = fy(qb.d) + 1 }
    else if (sack) { R.dir = sideName(fallX); R.pose = 'wrap'; R.fall = qFall; R.fallX = fallX; R.z = fy(qb.d) + 1 }
    else if (rep.pancake && g.t >= rep.pancake.at) { R.fall = clamp((g.t - rep.stoneAt - 60) / 300, 0, 1); R.fallX = rep.pancake.side; R.pose = R.fall > 0 ? null : 'back'; R.dir = R.fall > 0 ? sideName(rep.pancake.side) : 'down' }
    else if (rep.doom || rep.hurry || res?.kind === 'pressure') { R.step = wr.step; R.pose = wr.step == null ? 'block' : null; R.dir = dirFrom(wr, 'down') }
    else if (rep.won && g.t >= rep.punchAt) { R.pose = g.t - rep.stoneAt < 160 ? 'back' : 'block'; if (rep.move === 'bull') R.squat = 0.1 }
    else {
      // the move, in his body: a bull drops his pads and comes straight; wide or under, a long first step and his
      // whole frame leaning the way he's going
      const mv = showing ?? (rep.won ? (rep.counter ? 'under' : rep.move) : null)
      if (mv === 'bull') { R.pose = 'block'; R.squat = 0.2; R.dir = 'down' }
      else if (mv) {
        const into = clamp((g.t - stepAt) / 120, 0, 1), side = MOVE[mv].side * s
        R.step = wr.step ?? 1; R.pose = null; R.dir = sideName(side); R.lean = side * lerp(0.1, 0.32, into)
      } else { R.step = wr.step; R.pose = wr.step == null ? 'block' : null; R.dir = dirFrom(wr, 'down') }
    }
  }
  put(ru.x, fy(ru.d), them, R)
  // him: back to the camera, kick-sliding, punching, sitting down in his anchor
  const wm = walk(g, `me${g.i}`, me.x, me.d, 7)
  const M = { size: SIZE, number: 76, skin: skinOf(4), ...who.me, dir: 'up', pose: 'stance', step: null, squat: 0, lead: true }
  let mdy = 0
  if (snapped) {
    const punch = g.t >= rep.punchAt ? clamp(1 - (g.t - rep.punchAt) / 160, 0, 1) : 0
    if (res?.kind === 'clean' && thrown > 700) { M.pose = g.i === g.plan.length - 1 && g.done?.hit ? 'flex' : 'arms-up'; M.dir = g.i === g.plan.length - 1 && g.done?.hit ? 'down' : 'up' }
    else if (rep.pancake && g.t - rep.stoneAt > 520) { M.pose = 'point-up'; M.dir = 'up' }
    else if (rep.won && rep.move === 'bull') { M.pose = 'block'; M.squat = 0.12; mdy = punch * 3 }   // (sat down in his anchor)
    else if (punch > 0) { M.pose = 'block'; mdy = punch * 6 }
    else if (rep.doom?.zone === 1) { M.pose = 'block'; M.squat = 0.1 }
    else if (wm.step != null) { M.step = wm.step; M.pose = Math.abs(wm.dx) > Math.abs(wm.dy) ? 'slide' : 'back' }
    else M.pose = 'block'
  }
  put(me.x, fy(me.d + mdy), us, M)
  tagsAll(res && since > 700)   // (the snap's over: every man's name)
  action(ctx, view)
  // the ball: on the ground under the centre, back to the QB on the snap, away down the field when he throws
  if (!snapped) {
    const q = tilt(view, g.CX, fy(3))
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + 1.5, 8.5 * q.s, 2.8 * q.s, 0, 0, Math.PI * 2); ctx.fill()
    airBall(ctx, q.x, q.y - 4 * q.s, { axis: [0.18, 1, 0.3], len: 18 * q.s, spin: 0 })
  } else if (age < SNAP_MS) {
    const f = age / SNAP_MS
    ballInAir(ctx, view, g.CX, lerp(fy(3), fy(QB_GUN), f), 14 + f * 14, 0, 1.1)
  }
  if (thrown >= 0 && thrown < 700 && !sack) {
    const f = thrown / 700, to = fy(QB_SET + 520)
    ballInAir(ctx, view, lerp(qb.x, throwX, f), lerp(fy(qb.d), to, f), 34 + Math.sin(f * Math.PI) * 60, Math.atan2(throwX - qb.x, to - fy(qb.d)), 1.1)
  }
  // the ring: from his first step it closes on him; tap as it gets there (it goes white once you're in time)
  if (showing) {
    const k = clamp((g.t - stepAt) / Math.max(1, rep.contactAt - stepAt), 0, 1.3)
    const p = tilt(view, ru.x, fy(ru.d)), y = p.y - 46 * p.s * SIZE * 0.6, on = g.t >= rep.open
    const R0 = 10 * p.s, rad = lerp(40 * p.s, R0, Math.min(1, k)) - Math.max(0, k - 1) * 12 * p.s
    ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(245,220,138,.9)'
    ctx.beginPath(); ctx.arc(p.x, y, R0, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = on ? '#fff' : 'rgba(255,255,255,.55)'; ctx.lineWidth = on ? 3.4 : 2.4
    ctx.beginPath(); ctx.arc(p.x, y, Math.max(2, rad), 0, Math.PI * 2); ctx.stroke()
    // and what he's doing, called over him
    const word = rep.counter && g.t >= rep.crossAt ? 'BACK UNDER!' : MOVE[showing].word, kk = 1 + 0.25 * (1 - easeOut(clamp((g.t - stepAt) / 110, 0, 1)))
    ctx.save(); ctx.translate(p.x, p.y - 96 * p.s * SIZE * 0.6); ctx.scale(kk, kk)
    text(ctx, word, 0, 0, { font: DISPLAY, size: 26, color: on ? GOLD : '#fff' }); ctx.restore()
  }
  // the pop of a punch: three short lines where the pads meet
  const popK = g.t >= rep.punchAt ? clamp(1 - (g.t - rep.punchAt) / 170, 0, 1) : 0
  if (popK > 0) {
    const a = tilt(view, (me.x + ru.x) / 2, fy((me.d + ru.d) / 2)), sp = a.s * SIZE * 0.6, o = (1 - popK) * 7
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4 * sp; ctx.lineCap = 'round'
    ctx.beginPath()
    for (const d of [-0.9, 0, 0.9]) {
      const dx = Math.sin(d), dy = -Math.cos(d), yy = a.y - 40 * sp
      ctx.moveTo(a.x + dx * (9 + o) * sp, yy + dy * (9 + o) * sp); ctx.lineTo(a.x + dx * (16 + o) * sp, yy + dy * (16 + o) * sp)
    }
    ctx.stroke()
  }
  g.dirt.draw(ctx, g.t)
  ctx.restore()
  vignette(ctx, view0)
  // the clean ones: the building's up, and on a perfect day the paper comes down
  if (g.done?.hit && g.perfect && g.i === g.plan.length - 1 && since > 900 && !g.rain && !lightFx()) {
    g.rain = true
    for (let i = 0; i < 3; i++) g.paper.burst('confetti', 60 + i * 120, 40, g.t, { n: 12, ang: Math.PI / 2, spread: 1.1, speed: 1.1, colors: [us.color, us.trim, '#ffffff'], life: 2600, s: 1.3 })
  }
  g.paper.draw(ctx, g.t)
  // the cadence, over the QB
  if (g.phase === 'set') {
    const q = scr(qb.x, qb.d)
    text(ctx, 'SET', q.x, q.y - 80 * q.s, { font: DISPLAY, size: 22, color: 'rgba(255,255,255,.82)' })
  } else if (snapped && age < 300) {
    const q = scr(qb.x, qb.d), k = 1 + 0.3 * (1 - easeOut(clamp(age / 90, 0, 1)))
    ctx.save(); ctx.translate(q.x, q.y - 80 * q.s); ctx.scale(k, k); text(ctx, "HUT!", 0, 0, { font: DISPLAY, size: 28, color: '#fff' }); ctx.restore()
  }
  // the pocket clock: how long the QB has had it, in the corner under the title bar
  if (snapped) {
    const held = (res ? res.at : g.t) - rep.snapAt
    const col = sack ? BAD : res?.kind === 'clean' ? GOOD : '#fff'
    ctx.fillStyle = 'rgba(5,8,11,.86)'; ctx.fillRect(view0.w - 132, 48, 132, 28)
    text(ctx, 'POCKET', view0.w - 70, 63, { font: LABEL, size: 15, align: 'right', color: GOLD, track: 0.5 })
    text(ctx, (Math.max(0, held) / 1000).toFixed(1), view0.w - 10, 63, { font: DISPLAY, size: 22, align: 'right', color: col })
  }
  if (g.phase === 'set') { if (g.warmFor !== 1) { g.warmFor = 1; g.warmed = 0; g.warmL = warmList(g, us, them) } warm(g, g.warmL) }
}
