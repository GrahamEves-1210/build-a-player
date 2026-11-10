// Pass Pro: the offensive tackle's half of the pass rush (rush.js is the other half), from behind him: the
// QB at the bottom of the screen, our man in front of him at the edge of the line, and the man rushing him
// across from him. Three snaps, and every one is a fight for leverage.
//
// The bar over the pair is where he stands against the rusher: the marker in the middle, our man's square on him;
// out to one side, the rusher has his edge on that side. From his first step to the ball coming out (2 to 3 s), the
// rusher's work pushes the marker. You hold SLIDE OUTSIDE or SLIDE INSIDE and our man's feet go that way, which
// pushes it back. His feet take a beat to get going and a beat to stop, so a long hold carries past the middle:
// overset him and he's gone the other way.
//   SPEED RUSH    a steady hard push to the outside: keep sliding with him
//   INSIDE MOVE   the speed rush, then he plants and comes back under, hard: the overset trap. The plant shows
//                 (his inside shoulder dips) a beat before he goes
//   BULL RUSH     he drives straight into him, and shoves him side to side; the zone in the middle gets tighter the
//                 longer he drives. Small, steady corrections
//   SPIN MOVE     grade 8 and up, the speed rush spins back inside late: a sudden jolt (and from 10, a bull rips
//                 through at the end)
// The marker to the end of the bar: he's beaten on that side (a sack if it's early in the down or he's blown by,
// otherwise a pressure). Still in the middle zone when the ball's out: a clean pocket. Out of it, but not beaten:
// he's got a hand on the QB as he throws, a pressure. A clean snap held dead centre most of the way: a pancake.
// Two clean snaps of the three hold the pocket (the score: a clean snap 2, a pressure 1, of 6).
//
// The rules are all here with no screen, in field units: x across, d up the field from the line of
// scrimmage (the QB is at a small negative d, behind our man). The camera is pass-rush's (lib/mg/index.js).
import { byV, clamp, lerp, outcome, rngOf, layer, manOf, xiOf, paceOf, easeOut, particles, nudge, text, rr, DISPLAY, LABEL, GOLD, GOOD, BAD } from './kit.js'
import { tilt, untilt, ground, stands, floodlight, vignette, skinOf, airBall, warmAthlete, crowdPop } from './art.js'
import { afterStop, fxSeed, hitFx, plantFx, landFx, pushIn } from './contact.js'
import { paintFieldFlat, lightFx } from './throw.js'
import { put, action, tagsAll, teamOf, walk, ballInAir } from './read.js'

export const how = {
  'pass-pro': 'Three snaps. HOLD SLIDE OUTSIDE or SLIDE INSIDE to keep the marker in the middle of the bar. A speed rush drives you wide; an inside move comes back under if you overset; a bull rush shoves you around, so keep it small and steady. Reach the end of the bar and he is past you.',
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
const GO = 300               // the snap to his first step (and a beat of his own on top)
const BALL_MS = 2250         // the snap to the ball coming out (and up to BALL_SPAN more)
const BALL_SPAN = 450
const SMAX = 1.75            // his slide, flat out: the bar a second (the bar is -1 to 1)
const TAU_ON = 105           // ms: his feet getting going
const TAU_OFF = 210          // and coming to a stop: the overshoot
const SACK_EARLY = 0.6       // beaten before this much of the down: a sack
const DEEP = 1.9             // or blown by this fast
const HURRY_MS = 420         // beaten late: the ball's out this long after, under pressure
const CENTRE = 0.5           // dead centre: this much of the middle zone
const PANCAKE_FRAC = 0.5     // of the down, dead centre: he's on his back
const HITCH_MS = 220         // the clock's up but he's on the edge: the QB hitches this long, waiting on it
const SPIN_AT = 8            // the speed rush spins back late
const RIP_AT = 10            // the bull rips through at the end
// what the ratings buy (the game's one value: the average of Pass Pro, Mobility, Anchor, Blitz Pickup, Length)
const PUSH = v => byV(v, 1.12, 1.0)       // his push, the bar a second
const ZONE = v => byV(v, 0.265, 0.33)     // the middle zone, either side of centre
const SHOW = v => byV(v, 110, 300)       // ms: the plant shows this long before a counter or a spin hits
const SHARP = v => byV(v, 1.0, 0.75)     // how hard a counter or a spin comes back
// what he's doing, called over him
const CALL = { speed: 'SPEED RUSH', counter: 'SPEED RUSH', bull: 'BULL RUSH' }
const SWING_MS = 340, SPIN_MS = 170, SHOVE_MS = 150

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
  // one of each, in any order
  const order = ['speed', 'counter', 'bull']
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
  const P = PUSH(v), Z0 = ZONE(v), SH = SHARP(v), LEAD = SHOW(v)
  const plan = order.map((move, k) => {
    const go = GO + r() * 120, ballIn = BALL_MS + r() * BALL_SPAN, end = ballIn - go
    const bd = r() < 0.5 ? -1 : 1
    // (a bull: his shoves, from his first step: [when, which way], mostly the way he's driving)
    const shoves = []
    if (move === 'bull') for (let t0 = 260 + r() * 120; t0 < end - 200; t0 += 360 + r() * 220) shoves.push([t0, r() < 0.65 ? bd : -bd])
    return {
      k, move, wait: 750 + r() * 550, go, ballIn, bd, shoves, ph1: r() * 6.28, ph2: r() * 6.28,
      // (from his first step: the counter's plant, the late spin, the rip at the end of a bull)
      swing: move === 'counter' ? 520 + r() * 380 : null,
      spin: move === 'speed' && v >= SPIN_AT ? end - 620 - r() * 220 : null,
      rip: move === 'bull' && v >= RIP_AT ? end - 560 - r() * 200 : null,
      snapAt: 0, ballAt: 0, m: 0, dm: 0, pv: 0, sv: 0, px: 0, live: 0, centre: 0, inZone: true, zoneNow: Z0,
      res: null, beat: null, hurry: null, pancake: false, thrown: null, why: null, call: null, callAt: -999, lostSide: 0,
      me: { x: MX, d: ME_D }, ru: { x: MX + s * 28, d: RU_D }, qb: { x: CX, d: QB_GUN },
      punchAt: -999, stoneAt: -999,
    }
  })
  // the pads: the screen's left and right halves; outside is s on the screen
  const OUT = s < 0 ? 'L' : 'R', IN = s < 0 ? 'R' : 'L'
  const g = {
    t: 0, game: 'pass-pro', zones: 'lr', padLit: null, fx: [], done: null, outro: 1500, stamp: null, later: null,
    dirt: particles(44, fxSeed(seed)), paper: particles(40, fxSeed(`${seed}|paper`)), nudge: nudge(),
    pads: s < 0 ? ['SLIDE OUTSIDE', 'SLIDE INSIDE'] : ['SLIDE INSIDE', 'SLIDE OUTSIDE'],
    plan, i: 0, rep: plan[0], phase: 'set', nextAt: 0, who: castOf(cast), s, MX, CX, OUT, IN,
    clean: 0, pressures: 0, sacks: 0, pancakes: 0, popAt: -1e9,
    // the fingers (and keys) down right now: { id, zone }
    held: [],
    // what a player can see: all a bot gets. call: what he's doing, called over him (and callAt, when it changed);
    // m: the marker (-1 beaten inside, 1 beaten outside), zone: the middle zone either side of centre; ballAt: the
    // QB's clock (the pocket clock in the corner)
    tell: { snapped: false, call: null, callAt: null, m: 0, zone: Z0, ballAt: null },
    padCue: null,
    hud: { prompt: 'WAIT FOR THE SNAP', dots: plan.map(() => null) },
    tick(dt) {
      g.t += dt
      if (g.later && g.t >= g.later.at) { g.stamp = g.later; g.later = null }
      const last = g.held[g.held.length - 1]
      g.padLit = last ? (last.zone === 'L' ? 0 : 1) : null
      const rep = g.rep
      if (g.phase === 'set') {
        if (g.t >= rep.snapAt) snap(rep)
        return
      }
      if (g.phase === 'play') rules(rep, dt)
      move(rep, dt)
      if (g.phase === 'beat' && !g.done && g.t >= g.nextAt) next()
    },
    input(a) {
      if (a.zone !== 'L' && a.zone !== 'R') return
      const id = a.id ?? 0, H = g.held
      if (a.kind === 'down') {
        const i = H.findIndex(h => h.id === id && h.zone === a.zone)
        if (i >= 0) H.splice(i, 1)
        H.push({ id, zone: a.zone })
      } else if (a.kind === 'up') {
        // (a finger that slid across lets go over the other pad: it's still the one it went down on)
        const mine = H.filter(h => h.id === id)
        const h = mine.length === 1 ? mine[0] : H.find(k => k.id === id && k.zone === a.zone) ?? H.find(k => k.zone === a.zone)
        if (h) H.splice(H.indexOf(h), 1)
      }
    },
  }
  const has = z => g.held.some(h => h.zone === z)
  const heldDir = () => (has(OUT) ? 1 : 0) - (has(IN) ? 1 : 0)   // 1: sliding outside
  // his push on the bar right now, x ms from his first step (+ the outside)
  function push(rep, x) {
    if (x < 0) return 0
    const f = 0.12 * P * Math.sin(x / 97 + rep.ph2)
    if (rep.move === 'bull') {
      let b = f + rep.bd * 0.3 * P
      for (const [t0, d] of rep.shoves) if (x >= t0 && x < t0 + SHOVE_MS) b += d * 2 * P
      if (rep.rip != null && x >= rep.rip) b += x < rep.rip + SPIN_MS ? rep.bd * 1.4 * P * SH : rep.bd * 0.3 * P
      return b
    }
    if (rep.swing != null && x >= rep.swing) return f + (x < rep.swing + SWING_MS ? -2.5 * P * SH : -0.6 * P)
    if (rep.spin != null && x >= rep.spin) return f + (x < rep.spin + SPIN_MS ? -3.3 * P * SH : -0.6 * P)
    return f + P * (0.82 + 0.22 * Math.sin(x / 260 + rep.ph1)) + (x < 160 ? 0.7 * P : 0)
  }
  // a bull walks him back, and the longer he drives the less room there is in the middle
  const driveOf = (rep, x) => (rep.move === 'bull' ? clamp((x - 150) / 600, 0, 1) : 0)
  const zoneAt = (rep, x) => Z0 * (1 - 0.35 * driveOf(rep, x))
  function callOf(rep, x) {
    if (x < 0) return null
    if (rep.swing != null && x >= rep.swing - LEAD) return 'INSIDE MOVE'
    if (rep.spin != null && x >= rep.spin - LEAD) return 'SPIN MOVE'
    if (rep.rip != null && x >= rep.rip - LEAD) return 'RIP'
    return CALL[rep.move]
  }
  function setUp(rep) {
    rep.me.x = MX; rep.me.d = ME_D
    rep.qb.x = CX; rep.qb.d = QB_GUN
    rep.ru = { x: MX + s * 28, d: RU_D }
    rep.snapAt = g.t + rep.wait
    Object.assign(g.tell, { snapped: false, call: null, callAt: null, m: 0, zone: Z0, ballAt: null })
    g.hud.prompt = 'WAIT FOR THE SNAP'; g.hud.hot = false
    g.phase = 'set'
  }
  function snap(rep) {
    g.phase = 'play'
    g.tell.snapped = true
    g.fx.push('tap', 'h:light')
    rep.ballAt = g.t + rep.ballIn
    rep.sv = 0
    g.tell.ballAt = rep.ballAt
    g.hud.prompt = 'KEEP HIM IN FRONT OF YOU'
  }
  // he's at the end of the bar: by you on that side
  function beaten(rep, side, age) {
    const x = age - rep.go
    rep.m = side; rep.lostSide = side
    const late = rep.swing != null ? x >= rep.swing : rep.spin != null ? x >= rep.spin : false
    let word = 'BEAT'
    if (side < 0 && late) { word = 'OVERSET'; rep.why = rep.spin != null ? 'SPUN BACK INSIDE: YOU OVERSET HIM' : 'OVERSET: HE CAME BACK UNDER YOU' }
    else if (rep.move === 'bull') { word = 'RUN OVER'; rep.why = side > 0 ? 'WALKED BACK AND BEAT: STAY SMALL' : 'SHOVED ASIDE: STAY SQUARE ON A BULL' }
    else rep.why = side > 0 ? 'BEAT OFF THE EDGE: KICK OUTSIDE WITH HIM' : 'BEAT INSIDE: YOU GAVE HIM THE GAP'
    const deep = age < SACK_EARLY * (rep.ballAt - rep.snapAt) || Math.abs(rep.dm) > DEEP
    if (deep) {
      rep.beat = { at: g.t, dir: side * s }
      g.fx.push('swoosh', 'h:medium')
    } else {
      rep.hurry = { at: g.t + HURRY_MS }
      g.fx.push('tap', 'h:medium')
    }
    g.stamp = { text: word, good: false, at: g.t, ms: 460, size: 32 }
    g.hud.hot = false
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
    g.hud.hot = false
    Object.assign(g.tell, { call: null, callAt: null })
    const words = { clean: 'CLEAN POCKET', pressure: 'HURRIED', sack: 'SACK' }
    const beat = { clean: 1300, pressure: 1250, sack: 1400 }[kind]
    if (!rep.pancake) g.stamp = { text: words[kind], good, at: g.t + (kind === 'clean' ? 140 : 0), ms: beat - 140, size: kind === 'clean' ? 40 : 46 }
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
      g.later = { text: word, good: hit, at: g.t + beat - 100, size: word.length > 12 ? 32 : 44 }
      g.outro = beat + 1000
      if (hit) g.perfect = g.clean === n
    }
  }
  // the ball's out and he's still in the middle: a clean pocket (and dead centre most of the way, a pancake)
  function clean(rep) {
    const t = g.t
    rep.punchAt = t; rep.stoneAt = t
    g.fx.push('pop', 'h:medium')
    if (rep.live > 0 && rep.centre >= PANCAKE_FRAC * rep.live) {
      rep.pancake = { at: t }
      g.pancakes++
      g.stamp = { text: 'PANCAKE', good: true, at: t, ms: 900, size: 44 }
      g.fx.push('stamp', 'h:heavy')
    }
    settle(rep, 'clean')
  }
  function next() {
    g.i++
    g.rep = plan[g.i]
    g.stamp = null
    setUp(g.rep)
  }
  // ── the rules, each frame of a live snap ──
  function rules(rep, dt) {
    const t = g.t, age = t - rep.snapAt, x = age - rep.go
    if (rep.res) return
    if (rep.beat) {
      if (far(rep.ru, rep.qb) < 24 || t - rep.beat.at > 760) settle(rep, 'sack')
      return
    }
    if (rep.hurry) { if (t >= rep.hurry.at) { rep.thrown = t; settle(rep, 'pressure') } return }
    // his feet: they take a beat to get going, and a beat to stop
    const u = heldDir()
    rep.sv += (u * SMAX - rep.sv) * Math.min(1, dt / (u ? TAU_ON : TAU_OFF))
    rep.pv = push(rep, x)
    rep.dm = rep.pv - rep.sv
    rep.m += (rep.dm * dt) / 1000
    rep.px = clamp(rep.px + (rep.sv * dt) / 1000, -0.8, 1.4)   // (where his feet have taken him)
    const Z = zoneAt(rep, x)
    rep.zoneNow = Z
    if (x >= 0) { rep.live += dt; if (Math.abs(rep.m) < CENTRE * Z) rep.centre += dt }
    rep.inZone = Math.abs(rep.m) <= Z
    const call = callOf(rep, x)
    if (call !== rep.call) { rep.call = call; rep.callAt = t }
    Object.assign(g.tell, { call, callAt: call ? rep.callAt : null, m: rep.m, zone: Z })
    g.hud.hot = x >= 0 && !rep.inZone
    if (Math.abs(rep.m) >= 1) return beaten(rep, Math.sign(rep.m), age)
    // the clock's up: the ball's out if the pocket's clean. If he's working the edge the QB hitches, up to HITCH_MS,
    // waiting for it to clear: get him back to the middle and it's out clean
    if (t >= rep.ballAt && (rep.inZone || t >= rep.ballAt + HITCH_MS)) {
      rep.thrown = t
      if (rep.inZone) return clean(rep)
      rep.lostSide = Math.sign(rep.m)
      rep.why = rep.m > 0 ? 'HE GOT HOME AROUND THE EDGE' : 'HE GOT HOME UNDER YOU'
      settle(rep, 'pressure')
    }
  }
  // ── where everybody is (the same with no screen: the bot doesn't look at it) ──
  function move(rep, dt) {
    const t = g.t, me = rep.me, ru = rep.ru, qb = rep.qb, age = t - rep.snapAt, res = rep.res
    if (g.phase === 'set') return
    if (res?.kind === 'sack') return
    if (rep.beat) {
      // he's by: round the edge or under, straight at the QB, and our man lunging after him
      const dir = rep.beat.dir
      if (age > SNAP_MS) seek(qb, qb.x, QB_SET, 0.07, dt)
      seek(ru, qb.x + dir * 6, qb.d + 10, 0.3 * g.who.pace, dt)
      seek(me, me.x + dir * 4, me.d - 4, 0.06, dt)
      return
    }
    if (rep.hurry || res?.kind === 'pressure') {
      // he's got a hand on him: a bull walks our man back into the QB's lap; outside, round the edge and behind the
      // QB; inside, up in his face
      if (rep.move === 'bull' && rep.lostSide >= 0) { seek(me, lerp(MX, qb.x, 0.35), qb.d + 30, 0.16, dt); seek(ru, me.x + s * 3, me.d + 20, 0.3, dt); return }
      const under = rep.lostSide < 0
      seek(ru, qb.x + s * (under ? 24 : 52), qb.d + (under ? 20 : 4), 0.25, dt)
      seek(me, ru.x - s * 14 * (under ? -1 : 1), ru.d + 8, 0.25, dt)
      return
    }
    // a pancake: he goes over on his back, off to the side he was on, and our man steps up over him
    if (rep.pancake && t >= rep.pancake.at && rep.pancake.x == null) { const side = ru.x >= me.x ? 1 : -1; Object.assign(rep.pancake, { x: ru.x + side * 10, d: me.d + 52, md: me.d + 6, side }) }
    if (rep.pancake && t >= rep.pancake.at) { seek(ru, rep.pancake.x, rep.pancake.d, 0.16, dt); seek(me, me.x, rep.pancake.md, 0.05, dt); return }
    // the fight: our man's feet go where the slide takes him, and he gives a little ground (a bull walks him back);
    // the man on him sits where the bar says, square in front of him or turning the corner on him
    const x = age - rep.go, m = clamp(rep.m, -1, 1), drive = driveOf(rep, x)
    if (x < 0) {
      seek(me, MX, SET_D, 0.14, dt)
      seek(ru, MX + s * 26, RU_D - 4, 0.1, dt)
    } else {
      seek(me, MX + s * rep.px * 16, SET_D + 4 - clamp(x / 1800, 0, 1) * 8 - drive * 18, 0.3, dt)
      seek(ru, me.x + s * (4 + m * 30), me.d + 22 - Math.abs(m) * 14, x < 220 ? 0.22 : 0.5, dt)
    }
    // the pocket: the QB climbs away from the side he's losing
    if (age > SNAP_MS) {
      const lose = Math.max(0, Math.abs(m) - rep.zoneNow * 0.5)
      seek(qb, CX - s * Math.sign(m) * lose * 18, QB_SET + lose * 14, 0.07, dt)
    }
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

// The bar, fixed over where the two of them meet: where our man stands against him. The light band in the middle is
// square on him; past it he's working the edge; the ends, he's by. The outside end is on the outside of the screen.
// What he's doing is called over it.
function balanceBar(ctx, view, g, rep, at, res) {
  const s = g.s, W = 156, H = 8, sz = at.s * SIZE * 0.6
  const bx = clamp(at.x, 16 + W / 2, view.w - 16 - W / 2), by = at.y - 76 * sz
  const X = f => bx + s * f * (W / 2)
  const Z = rep.zoneNow, mk = clamp(rep.m, -1, 1), x0 = g.t - rep.snapAt - rep.go
  const lost = Math.abs(rep.m) >= 1 || res?.kind === 'sack'
  const out = !lost && x0 >= 0 && Math.abs(mk) > Z
  ctx.fillStyle = 'rgba(6,10,12,.78)'; rr(ctx, bx - W / 2 - 5, by - H / 2 - 5, W + 10, H + 10, 4); ctx.fill()
  ctx.fillStyle = '#26323a'; ctx.fillRect(bx - W / 2, by - H / 2, W, H)
  // the ends: beaten
  ctx.fillStyle = BAD
  ctx.fillRect(bx - W / 2, by - H / 2, 7, H); ctx.fillRect(bx + W / 2 - 7, by - H / 2, 7, H)
  // the middle
  ctx.fillStyle = 'rgba(255,255,255,.3)'
  ctx.fillRect(bx - Z * (W / 2), by - H / 2, Z * W, H)
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(bx - 0.5, by - H / 2, 1, H)
  // which end is which
  text(ctx, 'OUT', X(1), by + 15, { font: LABEL, size: 12, color: 'rgba(255,255,255,.6)', track: 0.5 })
  text(ctx, 'IN', X(-1), by + 15, { font: LABEL, size: 12, color: 'rgba(255,255,255,.6)', track: 0.5 })
  // our man
  const mx = X(mk)
  ctx.fillStyle = lost ? BAD : out ? GOLD : '#fff'
  rr(ctx, mx - 2.5, by - H / 2 - 5, 5, H + 10, 1.5); ctx.fill()
  // the call
  const call = rep.call
  if (call && !res && !rep.beat && !rep.hurry) {
    const k = 1 + 0.25 * (1 - easeOut(clamp((g.t - rep.callAt) / 110, 0, 1)))
    ctx.save(); ctx.translate(bx, by - 24); ctx.scale(k, k)
    text(ctx, call, 0, 0, { font: DISPLAY, size: 24, color: call === CALL[rep.move] ? '#fff' : GOLD })
    ctx.restore()
  }
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
  const fight = snapped && !res && !rep.beat && !rep.hurry, x0 = age - rep.go
  const won = res?.kind === 'clean'
  // his first step hits the turf hard (and again when he plants for a counter, a spin, a rip)
  if (fight && rep.call && rep.stepFx !== rep.callAt) { rep.stepFx = rep.callAt; plantFx(g, view, ru.x, fy(ru.d), Math.sign(rep.pv) * s, 5) }
  if (won && g.t >= rep.punchAt && !rep.punchSeen) {
    rep.punchSeen = true
    hitFx(g, view, (me.x + ru.x) / 2, (fy(me.d) + fy(ru.d)) / 2, { power: rep.pancake ? 4.5 : rep.move === 'bull' ? 3 : 2.6, n: rep.pancake ? 10 : 6, dust: 1, s: 0.9, up: 40 })
  }
  if (rep.pancake && g.t - rep.stoneAt > 300 && !rep.flatFx) { rep.flatFx = true; landFx(g, view, ru.x, fy(ru.d), { side: 0, power: 3 }) }
  // a bull: our man's cleats dig in as he's walked back
  if (fight && rep.move === 'bull' && x0 > 150 && Math.floor(g.t / 140) !== rep.dig) { rep.dig = Math.floor(g.t / 140); plantFx(g, view, me.x, fy(me.d), 0, 2, 0.9) }
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
  // (one throw: he throws down the field, away from the camera, so he stays square to it: the ball up at his
  // shoulder, then the arm through. The side-on throwing poses had him turn sideways, and back to the camera they
  // read as a second throw)
  const relAt = rep.hurry ? rep.hurry.at : rep.ballAt
  const cocked = snapped && thrown < 0 && !sack && !rep.beat && relAt > g.t && relAt - g.t < 220
  const arm = qFall ? null : thrown >= 0 && thrown < 280 && !sack ? 'reach-r' : cocked ? 'shoulder-r' : null
  const caught = snapped && age >= SNAP_MS
  const throwX = qb.x + s * 30
  const qw = walk(g, `qb${g.i}`, qb.x, qb.d, 8)
  put(qb.x, fy(qb.d), us, {
    dir: 'up', pose: arm ?? (qFall ? null : !caught ? 'ready' : thrown >= 0 ? 'ready' : qw.step != null ? null : 'qb-set'), step: arm || qFall ? null : qw.step,
    carry: caught && thrown < 0 && !cocked && !sack, fall: qFall, fallX, z: sack ? fy(qb.d) - 1 : undefined, skin: skinOf(9), number: 9, size: SIZE, ...who.qb,
  })
  // the man on him
  const wr = walk(g, `ru${g.i}`, ru.x, ru.d, 7)
  const R = { dir: 'down', skin: skinOf(11), number: DL_NUM[0], size: SIZE, ...named(who.dl[0]), step: null, pose: 'stance', squat: 0, lead: true }
  const party = sack ? clamp((s2 - 560) / 170, 0, 1) : 0
  if (snapped) {
    if (party >= 1) { R.pose = rep.k % 2 ? 'point-up' : 'flex'; R.dir = 'down'; R.z = fy(qb.d) + 1 }
    else if (sack) { R.dir = sideName(fallX); R.pose = 'wrap'; R.fall = qFall; R.fallX = fallX; R.z = fy(qb.d) + 1 }
    else if (rep.pancake && g.t >= rep.pancake.at) { R.fall = clamp((g.t - rep.stoneAt - 60) / 300, 0, 1); R.fallX = rep.pancake.side; R.pose = R.fall > 0 ? null : 'back'; R.dir = R.fall > 0 ? sideName(rep.pancake.side) : 'down' }
    else if (rep.beat || rep.hurry || res?.kind === 'pressure') { R.step = wr.step; R.pose = wr.step == null ? 'block' : null; R.dir = dirFrom(wr, 'down') }
    else if (won && g.t >= rep.punchAt) { R.pose = g.t - rep.stoneAt < 160 ? 'back' : 'block'; if (rep.move === 'bull') R.squat = 0.1 }
    else if (x0 < 0) { R.step = wr.step; R.pose = wr.step == null ? 'stance' : null; R.dir = dirFrom(wr, 'down') }
    else if (rep.spin != null && x0 >= rep.spin && x0 < rep.spin + SPIN_MS + 90) {
      // the spin: all the way round, back inside
      const k = (x0 - rep.spin) / (SPIN_MS + 90)
      R.pose = 'block'; R.dir = ['down', sideName(-s), 'up', sideName(s), 'down'][Math.min(4, Math.floor(k * 5))]
    } else {
      // leaning into him, his weight the way he's pushing. The plant for a counter (or a rip) shows in it first: his
      // inside shoulder dips before he comes back under
      const plant = (rep.swing != null && rep.call === 'INSIDE MOVE' && x0 < rep.swing) || (rep.spin != null && rep.call === 'SPIN MOVE' && x0 < rep.spin)
      const rip = rep.rip != null && rep.call === 'RIP' && x0 < rep.rip
      const into = plant ? -0.3 : rip ? rep.bd * 0.3 : clamp(rep.pv * 0.16, -0.34, 0.34)
      if (rep.move !== 'bull' && x0 < 200 && !plant) { R.step = wr.step ?? 1; R.pose = null; R.dir = sideName(s) }   // (his first step: long, to the outside)
      else { R.pose = 'block'; R.dir = 'down' }
      R.lean = into * s
      R.squat = rep.move === 'bull' ? 0.2 : plant || rip ? 0.08 : 0
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
    else if (won && rep.move === 'bull') { M.pose = 'block'; M.squat = 0.12; mdy = punch * 3 }   // (sat down in his anchor)
    else if (punch > 0) { M.pose = 'block'; mdy = punch * 6 }
    else if (rep.beat || rep.hurry || res) { if (wm.step != null) { M.step = wm.step; M.pose = 'back' } else M.pose = 'block' }
    else if (wm.step != null) {
      // the kick-slide: feet going the way he's sliding (back as he gives ground)
      M.step = wm.step; M.pose = Math.abs(wm.dx) > Math.abs(wm.dy) * 0.6 ? 'slide' : 'back'
    } else { M.pose = 'block'; if (rep.move === 'bull' && x0 > 150) M.squat = 0.1 }
    // (leaning into him, against the side he's working)
    if (fight && x0 >= 0) M.lean = clamp(rep.m * 0.2, -0.2, 0.2) * s
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
  if (snapped && (!res || (res.kind === 'clean' && since < 600))) balanceBar(ctx, view0, g, rep, scr(g.MX, SET_D + 22), res)
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
