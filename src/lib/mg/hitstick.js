// Hit Stick: the linebacker against the run, from behind him in the same broadcast camera as Stuff the Run.
// Four handoffs. The line blocks, the back reads it and picks a hole: the A, B or C gap, either side. Get over
// to it (hold LEFT or RIGHT and you slide across), and once the ball's handed off you come
// downhill on your own. A ring closes on the back as he gets to you: TACKLE as it closes.
//   dead on     HIT STICK: he goes backwards, and sometimes the ball comes out (more often for a better tackler)
//   in time     TACKLE: at the line, a short gain (late getting there and it's a gain of a few)
//   off         BROKEN TACKLE: early and he runs through it, late and he's already through you
//   not there   WRONG GAP: he bounced it outside or cut it back, and there's nobody home
// From the second carry he can show one hole and take another: a jump cut, a bounce outside. Better backers
// see more of it, and later, the way a real back saves it for a defense that's quick to fill.
//
// The rules are here with no screen, in field units: x across, d up the field from the line of scrimmage
// (the offense is at a big d, you're behind your line at a negative one). The read is in the back's feet and
// shoulders and in which of our men is getting washed out of his gap. Nothing is painted on the field.
import { byV, clamp, lerp, outcome, rngOf, layer, manOf, xiOf, paceOf, easeOut, particles, nudge, text, DISPLAY, GOLD } from './kit.js'
import { tilt, untilt, ground, stands, floodlight, vignette, skinOf, airBall, warmAthlete, crowdPop, beatenPose } from './art.js'
import { afterStop, fxSeed, hitFx, plantFx, landFx, pushIn } from './contact.js'
import { paintFieldFlat, looseBall } from './throw.js'
import { put, action, tagsAll, teamOf, walk, ballInAir } from './read.js'

export const how = {
  'hit-stick': 'Read the back and get to his hole: hold LEFT or RIGHT to slide. You come downhill on the handoff. TACKLE as the ring closes on him: dead on is a HIT STICK.',
}

const YD = 20                 // field units a yard (Stuff the Run's camera)
const CX = 180
const SP = 44                 // between linemen
const SIZE = 1.62
const TURF_X = (53.33 * YD) / 344
const OL_NUM = [74, 63, 52, 65, 78]
const DL_NUM = [91, 97, 93, 99]
const STAMP_Y = 0.25
// the holes, by number: 1 the A gap, 2 the B, 3 the C (outside the tackle, inside the tight end); a side is -1 or 1
const GAP = [0, 22, 66, 110]
const holeX = (side, n) => CX + side * GAP[n]
const GAP_WORD = ['', 'A', 'B', 'C']
// the play
const LB_D = -104             // the backer's depth at the snap: five yards off the ball
const FILL_D = -26            // as far downhill as he comes: right behind his own line
const OL_D = 26, QB_D = 40, RB_D0 = 150, MESH_D = 84, PRESS_D = 30
const MESH_MS = 420           // the snap to the handoff
const READ_AT = 120           // his first steps: where he's going shows from here
const RB_V = 0.17             // the back's speed, units a ms (about nine yards a second)
const CONTACT = 24            // this close, up and down the field, and they meet
const SQUARE = 17             // this far off him across and he's square to you
const REACH = 30              // past this he's by you
const LATE_D = -52            // met this far past the line: you were late, it's a gain and there's no big hit in it
const RING_MS = 640           // the ring starts closing this long before you meet
const LAT_V = v => byV(v, 0.17, 0.31)     // across the field
const DOWN_V = v => byV(v, 0.12, 0.15)    // downhill
const PERFECT = v => byV(v, 20, 44)       // ms either side of meeting him for a hit stick
const GOOD = v => byV(v, 70, 175)         // and for a tackle
const FUMBLE = v => byV(v, 0.15, 0.3)     // a hit stick that knocks it loose
const CUT_P = (v, k) => (k === 0 ? 0 : v >= 9 ? 0.34 : v >= 6 ? 0.3 : 0.24)
// Holding LEFT or RIGHT slides him across, smoothly: up to speed quickly, and he eases to a stop when you let go.
// (A tap is a short slide.) The gaps are places on the line, not stops.
const HELD_K = 1.18                       // across the field while held, on top of LAT_V
const EASE_IN = 70, EASE_OUT = 80         // ms: how quickly he gets going, and how quickly he stops
const MIN_HOLD = 110                      // a tap still slides him this long
const X_MAX = 128                         // as far across as he goes either way

const seek = (m, x, d, v, dt) => {
  const dx = x - m.x, dd = d - m.d, e = Math.hypot(dx, dd)
  if (e < 0.01) return true
  const mv = Math.min(e, v * dt)
  m.x += (dx / e) * mv; m.d += (dd / e) * mv
  return mv >= e
}
const bare = m => m && { number: m.number, skin: m.skin }
const quiet = m => (m?.last ? { ...m, quiet: true } : bare(m))

// the real men: the player, our front four and the other backers; their line, tight end, QB and back
function castOf(cast) {
  if (cast?.us?.xi && cast?.them?.xi) {
    const x = (side, spot, i) => xiOf(cast, side, spot, i)
    return {
      me: cast.me ?? null,
      ol: [0, 1, 2, 3, 4].map(i => x('them', 'ol', i)),
      te: quiet(x('them', 'te', 0)), qb: x('them', 'qb', 0), rb: x('them', 'rb', 0), rbPace: paceOf(cast, 'them', 'rb', 0),
      dl: [0, 1, 2, 3].map(i => quiet(x('us', 'dl', i))),
      lbs: (cast.us.xi.lb ?? []).filter(p => p && !p.me).slice(0, 2).map(quiet),
      pace: 1 + (cast.me?.speed ?? 0) * 0.06,
    }
  }
  return {
    me: cast?.me ?? null,
    ol: [0, 1, 2, 3, 4].map(i => manOf(cast, 'them', 'ol', i)),
    te: bare(manOf(cast, 'them', 'te', 0)), qb: manOf(cast, 'them', 'qb', 0), rb: manOf(cast, 'them', 'rb', 0), rbPace: paceOf(cast, 'them', 'rb', 0),
    dl: [0, 1, 2, 3].map(i => bare(manOf(cast, 'us', 'dl', i))),
    lbs: (cast?.us?.lb ?? []).filter(p => !p.me).slice(0, 2).map(bare),
    pace: 1 + (cast?.me?.speed ?? 0) * 0.06,
  }
}

// ── The rules ───────────────────────────────────────────────────────────────
export function make({ v, seed, def, cast }) {
  const r = rngOf(seed), n = def?.rounds ?? 4
  const plan = Array.from({ length: n }, (_, k) => {
    const side = r() < 0.5 ? -1 : 1
    let show = { side, n: 1 + Math.floor(r() * 3) }
    let real = show, cut = null
    if (r() < CUT_P(v, k)) {
      // he shows one and takes another: bounced outside, or a jump cut a gap over (from the A gap, back across)
      if (show.n < 3 && r() < 0.5) { real = { side, n: 3 }; cut = 'bounce' }
      else if (show.n === 1) { real = r() < 0.5 ? { side, n: 2 } : { side: -side, n: 1 }; cut = real.side === side ? 'jump' : 'back' }
      else { real = { side, n: show.n - 1 }; cut = 'jump' }
    }
    if (!cut && show.n === 3 && r() < 0.5) show = { side, n: 3 }
    return {
      k, show, real, cut, cutD: v >= 9 ? 74 : 78, te: r() < 0.5 ? -1 : 1,
      wait: 700 + r() * 500, fumble: r(), gainR: r(), meshX: CX + (r() < 0.5 ? -1 : 1) * 12,
      snapAt: 0, handed: false, cutAt: null, curX: 0, tapAt: null, lunge: false, meet: null, res: null, vx: 0, dir: 0,
      me: { x: CX, d: LB_D }, rb: { x: CX, d: RB_D0 }, qb: { x: CX, d: QB_D }, vd: 0, slow: 0,
    }
  })
  const W = { perfect: PERFECT(v), good: GOOD(v), lat: LAT_V(v), down: DOWN_V(v) }
  const g = {
    t: 0, game: 'hit-stick', zones: 'three', anyKey: true, pads: ['LEFT', 'TACKLE', 'RIGHT'], padLit: null, litAt: -999, padCue: null,
    fx: [], done: null, outro: 1500, stamp: null, later: null, dirt: particles(48, fxSeed(seed)), nudge: nudge(),
    plan, i: 0, rep: plan[0], phase: 'set', nextAt: 0, who: castOf(cast), W,
    tackles: 0, hitSticks: 0, fumbles: 0, broken: 0, yards: 0, held: null,
    // what a player can see: all a bot gets. hole: the gap he's showing (side * 1..3), rem: ms till you meet (the ring)
    tell: { snapped: false, hole: 0, cut: false, rem: Infinity, ring: false },
    hud: { prompt: 'READ THE BACK', dots: plan.map(() => null) },
    holeX: hole => CX + Math.sign(hole) * GAP[Math.abs(hole)],
    // (for the bots: how far he'll still go if the thumb comes off now)
    coast: () => Math.abs(g.rep.vx) * EASE_OUT,
    tick(dt) {
      g.t += dt
      if (g.t - g.litAt > 110 && !g.held) g.padLit = null
      if (g.later && g.t >= g.later.at) { g.stamp = g.later; g.later = null }
      if (g.stamp2 && g.t >= g.stamp2.at) { g.stamp = g.stamp2; g.stamp2 = null }
      const rep = g.rep
      if (g.phase === 'set') {
        if (g.t >= rep.snapAt) { g.phase = 'play'; g.tell.snapped = true; g.hud.prompt = 'READ THE BACK'; g.fx.push('tap', 'h:light') }
        return
      }
      // a tap that's let go: it still slides him a little
      if (g.held?.up && g.t >= g.held.at + MIN_HOLD) g.held = null
      play(rep, dt)
      if (g.phase === 'beat' && !g.done && g.t >= g.nextAt) next()
    },
    input(a) {
      if (a.kind === 'up') { if (g.held) { if (g.t >= g.held.at + MIN_HOLD) g.held = null; else g.held.up = true; g.padLit = null } return }
      if (a.kind !== 'down' || a.zone == null) return
      g.padLit = a.zone; g.litAt = g.t
      const rep = g.rep
      if (g.done || rep.res || g.phase !== 'play') return
      if (a.zone === 1) return tackle(rep)
      if (rep.tapAt != null) return
      const dir = a.zone === 0 ? -1 : 1
      g.held = { dir, at: g.t, up: false }
      g.fx.push('h:light')
    },
  }
  function tackle(rep) {
    if (rep.tapAt != null) return
    // (nothing to hit yet: the ring isn't up)
    if (!rep.handed || g.tell.rem > RING_MS + 160) { g.fx.push('h:light'); return }
    rep.tapAt = g.t
    g.held = null
    // he's left his feet before he got there
    if (rep.meet == null && g.tell.rem > W.good) rep.lunge = true
    g.fx.push('swoosh', 'h:medium')
    if (rep.meet) resolve(rep, g.t - rep.meet.at)
  }
  function setUp(rep) {
    rep.me.x = CX; rep.me.d = LB_D; rep.vx = 0; rep.dir = 0
    rep.rb.x = CX; rep.rb.d = RB_D0
    rep.qb.x = CX; rep.qb.d = QB_D
    rep.curX = holeX(rep.show.side, rep.show.n)
    rep.snapAt = g.t + rep.wait
    g.tell.snapped = false; g.tell.hole = 0; g.tell.cut = false; g.tell.rem = Infinity; g.tell.ring = false
    g.held = null; g.padCue = null
    g.hud.prompt = 'READ THE BACK'
    g.phase = 'set'
  }
  // One frame of the play's movement. Pure in its state, so it can also look ahead: where the two of you meet if
  // nothing changes is the ring. (ahead: a copy being run forward, no events)
  function move(rep, s, dt, age, ahead) {
    const rb = s.rb, me = s.me
    // the back: to the mesh, then aimed at his hole, then through it and on
    if (age > 60) {
      const v0 = RB_V * g.who.rbPace * (age < s.slowUntil ? 0.35 : 1) * (s.meet ? 0.3 : 1)
      if (!s.meshed) { if (seek(rb, rep.meshX, MESH_D, v0, dt) || rb.d <= MESH_D + 1) s.meshed = true }
      else if (rb.d > 0) {
        // the jump cut: plant at the line and go
        if (rep.cut && !s.cutDone && rb.d <= rep.cutD) { s.cutDone = true; s.curX = holeX(rep.real.side, rep.real.n); s.slowUntil = age + 320; if (!ahead) cutNow(rep) }
        const toward = s.curX, dd = rb.d > PRESS_D ? PRESS_D - 2 : -10
        seek(rb, toward, dd, v0, dt)
      } else rb.d -= v0 * dt
    }
    // you: sliding across while it's held, then downhill once it's handed off. Sliding hard, you only drift down.
    const top = W.lat * HELD_K * g.who.pace, want = s.locked ? 0 : s.dir * top
    s.vx += (want - s.vx) * (1 - Math.exp(-dt / (want ? EASE_IN : EASE_OUT)))
    if (Math.abs(s.vx) < 0.002 && !want) s.vx = 0
    me.x = clamp(me.x + s.vx * dt, CX - X_MAX, CX + X_MAX)
    if (me.x === CX - X_MAX || me.x === CX + X_MAX) s.vx = 0
    const sliding = Math.abs(s.vx) > top * 0.4
    if (s.handed && me.d < FILL_D) me.d = Math.min(FILL_D, me.d + W.down * g.who.pace * dt * (sliding ? 0.35 : 1))
  }
  // where you meet him if nothing changes: ms from now (Infinity: he's by you before that)
  function ahead(rep, age) {
    const s = { rb: { ...rep.rb }, me: { ...rep.me }, meshed: rep.meshed, cutDone: rep.cutDone, curX: rep.curX, slowUntil: rep.slowUntil ?? 0, vx: rep.vx, dir: 0, locked: rep.tapAt != null, handed: rep.handed }
    const D = 8
    for (let t = 0; t <= 1600; t += D) {
      if (s.rb.d - s.me.d <= CONTACT) return t
      if (!s.handed && age + t >= MESH_MS) s.handed = true
      move(rep, s, D, age + t, true)
    }
    return Infinity
  }
  function cutNow(rep) {
    rep.cutAt = g.t
    g.tell.hole = rep.real.side * rep.real.n; g.tell.cut = true
    g.fx.push('swoosh')
  }
  function play(rep, dt) {
    const age = g.t - rep.snapAt, rb = rep.rb, me = rep.me
    if (!rep.res) {
      if (age >= READ_AT && !g.tell.hole) g.tell.hole = rep.show.side * rep.show.n
      if (!rep.handed && age >= MESH_MS) { rep.handed = true; g.hud.prompt = 'GET DOWNHILL' }
      rep.locked = rep.tapAt != null
      rep.dir = g.held ? g.held.dir : 0
      move(rep, rep, dt, age, false)
      // the QB: he opens to the back, hands it off and carries out his fake
      if (age > 120 && age < MESH_MS + 40) seek(rep.qb, rep.meshX + (rep.meshX > CX ? -10 : 10), MESH_D - 4, 0.12, dt)
      else if (age >= MESH_MS + 40) seek(rep.qb, CX - (rep.real.side) * 60, MESH_D + 30, 0.1, dt)
      const rem = rep.meet ? -(g.t - rep.meet.at) : ahead(rep, age)
      g.tell.rem = rem
      g.tell.ring = rep.handed && rem <= RING_MS
      g.padCue = g.tell.ring && rep.tapAt == null ? 1 : null
      if (g.tell.ring && g.hud.prompt !== 'TACKLE') { g.hud.prompt = 'TACKLE'; g.hud.hot = true }
      // you meet him
      if (!rep.meet && rb.d - me.d <= CONTACT) {
        rep.meet = { at: g.t, dx: rb.x - me.x, d: rb.d }
        if (Math.abs(rep.meet.dx) > REACH) return settle(rep, 'miss')
        if (rep.tapAt != null) return resolve(rep, rep.tapAt - g.t)
      }
      if (rep.meet && !rep.res && g.t - rep.meet.at > W.good) return settle(rep, 'broken', 'late')
      return
    }
    after(rep, dt, age)
  }
  // the tap against the moment you meet: err < 0 early, > 0 late
  function resolve(rep, err) {
    const m = rep.meet, a = Math.abs(err), arm = Math.abs(m.dx) > SQUARE, late = m.d < LATE_D
    if (rep.lunge || a > W.good) return settle(rep, 'broken', err < 0 ? 'early' : 'late')
    let kind = a <= W.perfect ? 'stick' : 'tackle'
    if (arm) kind = kind === 'stick' ? 'tackle' : 'broken'
    if (late && kind === 'stick') kind = 'tackle'
    settle(rep, kind, arm ? 'arm' : late ? 'deep' : null)
  }
  function settle(rep, kind, why = null) {
    const m = rep.meet, past = -m.d / YD
    let yards
    if (kind === 'stick') yards = Math.round(past) - 1
    else if (kind === 'tackle') yards = Math.max(0, Math.round(past + 1))
    else if (kind === 'broken') yards = Math.max(4, Math.round(past)) + 4 + Math.floor(rep.gainR * 9)
    else yards = 7 + Math.floor(rep.gainR * 12)
    const fumble = kind === 'stick' && rep.fumble < FUMBLE(v)
    const stop = kind === 'stick' || (kind === 'tackle' && yards <= 3)
    rep.res = { kind, why, at: g.t, yards, fumble, stop, side: Math.sign(m.dx) || rep.real.side }
    g.tell.ring = false; g.padCue = null; g.held = null; g.hud.hot = false
    if (kind === 'stick') g.hitSticks++
    if (kind === 'stick' || kind === 'tackle') g.tackles++
    if (kind === 'broken' || kind === 'miss') g.broken++
    if (fumble) g.fumbles++
    g.yards += fumble ? 0 : yards
    g.hud.dots[g.i] = stop
    // the line: what happened, in two halves
    const outside = Math.abs(rep.rb.x - CX) > Math.abs(rep.me.x - CX), across = Math.sign(rep.rb.x - CX) * Math.sign(rep.me.x - CX) < 0 && Math.abs(rep.me.x - CX) > 12
    const gain = y => (y <= 0 ? (y < 0 ? `LOSS OF ${-y}` : 'NO GAIN') : `${y}-YARD GAIN`)
    g.hud.prompt = kind === 'stick' ? (fumble ? 'HIT STICK: FORCED FUMBLE' : `HIT STICK: ${gain(yards)}`)
      : kind === 'tackle' ? (why === 'arm' ? `ARM TACKLE: ${gain(yards)}` : why === 'deep' || yards > 3 ? 'LATE: HE GOT INTO THE HOLE' : `FILLED IT: ${gain(yards)}`)
      : kind === 'miss' ? (across ? 'WRONG SIDE: HE WENT AWAY FROM YOU' : outside ? 'WRONG GAP: HE BOUNCED OUTSIDE' : 'WRONG GAP: HE CUT IT BACK')
      : why === 'early' ? 'EARLY: HE RAN THROUGH THE DIVE'
      : why === 'arm' ? 'OUT OF POSITION: ARM TACKLE'
      : m.d < LATE_D ? 'LATE: HE WAS THROUGH THE HOLE' : 'LATE: HE RAN THROUGH YOU'
    const word = { stick: 'HIT STICK', tackle: 'TACKLE', broken: 'BROKEN TACKLE', miss: 'NOBODY HOME' }[kind]
    const beat = kind === 'stick' ? (fumble ? 1900 : 1450) : 1250
    g.stamp = { text: word, good: stop ? true : kind === 'tackle' ? null : false, at: g.t, ms: fumble ? 820 : beat - 120, size: word.length > 10 ? 36 : 46 }
    if (fumble) g.stamp2 = { text: 'FUMBLE', good: true, at: g.t + 840, ms: beat - 960, size: 46 }
    g.fx.push(kind === 'stick' ? 'stamp' : stop ? 'stamp' : 'tap', kind === 'stick' ? 'h:heavy' : stop ? 'h:medium' : 'h:light')
    if (stop) g.popAt = g.t
    if (fumble) g.fx.push('claim')
    g.phase = 'beat'
    g.nextAt = g.t + beat
    if (plan.every(p => p.res)) {
      const pts = plan.reduce((s, p) => s + (p.res.kind === 'stick' ? 3 + (p.res.fumble ? 1 : 0) : p.res.kind === 'tackle' ? (p.res.stop ? 2 : 1) : 0), 0)
            // (three stops of four: a hit stick or a tackle at the line. The hits only make it a better score)
      const stops = plan.filter(p => p.res.stop).length
      const hit = stops >= n - 1
      const score = clamp(pts / (n * 3), 0, 1)
      const note = `${g.tackles} tackle${g.tackles === 1 ? '' : 's'}, ${g.hitSticks} hit stick${g.hitSticks === 1 ? '' : 's'}${g.fumbles ? `, ${g.fumbles} forced fumble${g.fumbles === 1 ? '' : 's'}` : ''}`
      g.done = outcome(hit ? Math.max(score, 0.5) : Math.min(score, 0.45), hit, note, { made: stops, of: n, tackles: g.tackles, hitSticks: g.hitSticks, fumbles: g.fumbles, broken: g.broken, yards: g.yards }, false)
      const tw = hit ? (g.hitSticks >= 2 ? 'LIGHTS OUT' : 'NOTHING INSIDE') : 'GASHED'
      g.later = { text: tw, good: hit, at: g.t + beat - 100, size: 44 }
      g.outro = beat + 900
    }
  }
  // the play after it's decided: the back goes down, or on; the other backers come to the ball
  function after(rep, dt) {
    const rb = rep.rb, res = rep.res, since = g.t - res.at
    if (res.kind === 'broken' || res.kind === 'miss') {
      const sd = res.side
      if (since > 60) { rb.d -= RB_V * 1.08 * dt; rb.x += sd * 0.035 * dt * (since < 300 ? 1 : 0.3) }
      if (res.kind === 'miss' && since < 260) rep.me.d += 0.05 * dt
    } else if (res.kind === 'tackle') {
      if (since < 220) rb.d -= 0.06 * dt
    }
  }
  function next() {
    g.i++
    g.rep = plan[g.i]
    g.stamp = null; g.stamp2 = null
    setUp(g.rep)
  }
  setUp(plan[0])
  return g
}

// ── The picture ─────────────────────────────────────────────────────────────
const losOf = view => Math.round(untilt(view, 180, view.h - 168).y + LB_D)
function stage(ctx, view, los) {
  const c = view.colors, hy = tilt(view, 0, 0).y
  layer(ctx, view, `fill|${c.us}|${c.trim}|${los}`, x => {
    stands(x, view, 'field', [c.us, c.trim])
    ground(x, view, f => {
      f.save(); f.translate(180, 0); f.scale(TURF_X, 1); f.translate(-180, 0)
      paintFieldFlat(f, view, los - 50 * YD, YD, c.us, false)
      f.restore()
      f.fillStyle = '#3f86ff'; f.fillRect(-120, los - 1.6, 600, 3.2)
    }, `fill-flat|${c.us}|${los}`, 0, Math.round((view.h - hy) * view.px * 0.7))
    floodlight(x, view)
  })
}
const sideName = s => (s < 0 ? 'left' : 'right')
const dirFrom = (w, still) => (w.step == null ? still : Math.abs(w.dx) > Math.abs(w.dy) * 1.2 ? (w.dx > 0 ? 'right' : 'left') : w.dy > 0 ? 'down' : 'up')
const bump = (g, i) => Math.sin(g.t / (190 + i * 17) + i * 1.9) * 2.5
// our front four: two ends out on the tackles, two tackles on the guards
const DL_X = [-98, -30, 30, 98]
function warmList(g, us, them) {
  const who = g.who, list = []
  const me = { color: us.color, trim: us.trim, pants: us.trim, skin: who.me?.skin ?? skinOf(3), number: who.me?.number ?? 54, kit: 'pads', carry: false, pose: null }
  const R = { color: them.color, trim: them.trim, pants: them.trim, skin: who.rb?.skin ?? skinOf(6), number: who.rb?.number ?? 28, kit: 'pads', pose: null }
  for (const step of [0, 1, 2, 3, null]) {
    list.push({ ...me, dir: 'up', step }); list.push({ ...me, dir: 'side', number: null, step })
    list.push({ ...R, dir: 'down', step, carry: true }); list.push({ ...R, dir: 'side', number: null, step, carry: true })
  }
  list.push({ ...me, dir: 'up', pose: 'wrap' }, { ...me, dir: 'up', pose: 'ready' }, { ...me, dir: 'up', pose: 'slide', step: 1 })
  return list
}
function warm(g, list) {
  g.warmed = g.warmed ?? 0
  for (let n = 0; n < 5 && g.warmed < list.length; n++, g.warmed++) warmAthlete(list[g.warmed])
}

export function draw(ctx, g, view0) {
  if (g.stamp && g.stamp.y == null) g.stamp.y = view0.h * STAMP_Y
  if (g.later && g.later.y == null) g.later.y = view0.h * STAMP_Y
  if (g.stamp2 && g.stamp2.y == null) g.stamp2.y = view0.h * STAMP_Y
  const c = view0.colors, us = teamOf(c, 0), them = teamOf(c, 1), rep = g.rep, res = rep.res, who = g.who
  const los = losOf(view0)
  const snapped = g.phase !== 'set', age = g.t - rep.snapAt, since = res ? g.t - res.at : -1
  const me = rep.me, rb = rep.rb, qb = rep.qb
  const fy = d => los - d
  const stick = res?.kind === 'stick', stop = res && (res.kind === 'stick' || res.kind === 'tackle'), fum = res?.fumble
  // the camera leans in on the hit
  const rAt = tilt(view0, rb.x, fy(rb.d))
  const lean = stick ? easeOut(clamp(since / 220, 0, 1)) : res?.kind === 'tackle' ? 0.45 * easeOut(clamp(since / 260, 0, 1)) : 0
  const view = pushIn(ctx, g, view0, 1 + 0.3 * lean, rAt.x, rAt.y - 30, 1.3, lerp(rAt.x, 180, lean * 0.7), lerp(rAt.y - 30, view0.h * 0.52, lean * 0.7))
  stage(ctx, view, los)
  crowdPop(ctx, view, [c.us, c.trim], g.t - (g.popAt ?? -1e9), { power: stick ? 1 : 0.7 })
  const s2 = stop ? afterStop(since) : since
  // the snap, a step to a gap, the hit
  if (snapped && !rep.snapFx) { rep.snapFx = true; for (const i of [-1, 1]) plantFx(g, view, CX + i * SP, fy(OL_D), 0, 3) }
  if (rep.dir !== (rep.dirSeen ?? 0)) { if (rep.dir) plantFx(g, view, me.x, fy(me.d), rep.dir, 5, 0.9); rep.dirSeen = rep.dir }
  if (rep.cutAt != null && !rep.cutFx) { rep.cutFx = true; plantFx(g, view, rb.x, fy(rb.d), Math.sign(holeX(rep.real.side, rep.real.n) - rb.x), 9, 1.1) }
  if (res && !rep.hitFx && (stop || res.kind === 'broken')) {
    rep.hitFx = true
    const p = stick ? 8 : res.kind === 'tackle' ? 4.5 : 2.6
    hitFx(g, view, rb.x, fy(rb.d), { power: p, n: stick ? 20 : stop ? 11 : 7, dust: stick ? 5 : 2, side: stick ? 0 : res.side, up: 26 })
  }
  if (stop && s2 > (stick ? 330 : 260) && !rep.landFx) { rep.landFx = true; landFx(g, view, rb.x, fy(rb.d) - (stick ? 26 : 0), { side: stick ? 0 : res.side, power: stick ? 3.5 : 1.8 }) }
  // the hole: whoever's in it gets washed out of it by the men on him (a bounce: the gap he showed fills back up)
  const holeNow = rep.cutAt != null ? holeX(rep.real.side, rep.real.n) : holeX(rep.show.side, rep.show.n)
  const washF = snapped ? clamp((age - 120) / 380, 0, 1) : 0
  const washOf = x => {
    const d = x - holeNow
    return Math.abs(d) < 60 ? Math.sign(d || 1) * 34 * washF : 0
  }
  // their line, the tight end on one side
  const olX = i => CX + i * SP
  for (let i = -2; i <= 2; i++) {
    const b = snapped ? bump(g, i + 3) : 0
    const x0 = olX(i), w = snapped ? washOf(x0) * 0.8 : 0
    put(x0 + w + b * 0.6, fy(OL_D - (snapped ? 6 : 0) + b * 0.3), them, { dir: 'down', pose: snapped ? 'block' : 'stance', skin: skinOf(i + 11), number: OL_NUM[i + 2], size: SIZE, ...quiet(who.ol[i + 2]) })
  }
  const teX = CX + rep.te * 134
  put(teX + (snapped ? washOf(teX) * 0.6 : 0), fy(OL_D - 2), them, { dir: 'down', pose: snapped ? 'block' : 'stance', skin: skinOf(14), number: 87, size: SIZE, ...who.te })
  // our four on them
  DL_X.forEach((dx, i) => {
    const x0 = CX + dx, b = snapped ? bump(g, i + 7) : 0
    const w = snapped ? washOf(x0) : 0
    put(x0 + w + b, fy(-14 - (snapped ? 4 : 0) - Math.abs(b) * 0.4 - Math.abs(w) * 0.3), us, { dir: 'up', pose: snapped ? 'block' : 'stance', skin: skinOf(i * 2 + 1), number: DL_NUM[i], size: SIZE, ...who.dl[i] })
  })
  // (a fumble: where the ball squirts to, the way looseBall rolls it)
  const ball = fum ? { x: rb.x + (rb.x < 180 ? 1 : -1) * 40, y: fy(rb.d) - 26 + 30 } : null
  // the other two backers: they flow to the ball once it's handed off
  ;[-1, 1].forEach((sd, i) => {
    const hx = rep.handed ? clamp(lerp(CX + sd * 128, rb.x + sd * 40, clamp((age - MESH_MS) / 900, 0, 0.7)), 20, 340) : CX + sd * 128
    const hd = rep.handed ? lerp(LB_D + 6, LB_D + 46, clamp((age - MESH_MS) / 900, 0, 1)) : LB_D + 6
    const w = walk(g, `lb${i}${g.i}`, hx, fy(hd), 8)
    let pose = snapped ? (w.step == null ? 'ready' : null) : 'ready', dir = dirFrom(w, 'up')
    const late = res && !stop ? beatenPose(i * 3 + 1, since - 400) : undefined
    if (late) { pose = late.pose; dir = late.turn ? 'down' : 'up' }
    else if (res?.stop && since > 700) pose = i ? 'point-up' : 'arms-up'
    const L = { dir, step: late || (res?.stop && since > 700) ? null : w.step, pose, skin: skinOf(4 + i * 5), number: [52, 58][i], size: SIZE * 0.98, ...who.lbs[i] }
    // the loose ball: the backer on that side goes and gets on it, then comes up with it
    if (fum && since > 120 && sd === (Math.sign(ball.x - CX) || 1)) {
      const f = clamp((since - 300) / 380, 0, 1), x0 = rep.fumFrom ??= { x: hx, y: fy(hd) }
      const px = lerp(x0.x, ball.x, f), py = lerp(x0.y, ball.y, f), toX = Math.sign(ball.x - x0.x) || 1
      put(px, py, us, { ...L, step: f < 1 ? Math.floor(since / 60) % 4 : null, dir: since > 1350 ? 'down' : sideName(toX), pose: f < 0.6 ? null : since > 1350 ? 'arms-up' : 'dive', fall: f >= 0.6 && since <= 1350 ? 0.85 : 0, fallX: f >= 0.6 && since <= 1350 ? toX : 0, z: ball.y + 2 })
      return
    }
    put(hx, fy(hd), us, L)
  })
  // the QB
  const qw = walk(g, `qb${g.i}`, qb.x, fy(qb.d), 9)   // (screen y: the field's d runs the other way, so he faced backwards)
  put(qb.x, fy(qb.d), them, { dir: dirFrom(qw, 'down'), step: qw.step, pose: snapped ? (qw.step == null ? 'ready' : null) : 'stance', carry: snapped && age >= 170 && !rep.handed, skin: skinOf(9), number: 9, size: SIZE, ...who.qb })
  // the back: his shoulders square to the hole he's going to hit
  const rw = walk(g, `rb${g.i}`, rb.x, fy(rb.d), 9)
  const R = { dir: dirFrom(rw, 'down'), step: rw.step, pose: snapped ? null : 'ready', carry: rep.handed && !(fum && since > 120), skin: skinOf(6), number: 28, size: SIZE, ...who.rb, lead: true }
  if (snapped && !res && rep.handed) R.lean = clamp((holeNow - rb.x) / 120, -0.22, 0.22)
  let drive = 0
  if (res) {
    const sd = res.side
    if (stick) {
      // backwards, off his feet, the way he came
      drive = easeOut(clamp(s2 / 320, 0, 1)) * 26
      R.dir = 'down'; R.step = null; R.fall = clamp((s2 - 10) / 260, 0, 1); R.fallX = sd; R.z = fy(me.d) + 2
    } else if (res.kind === 'tackle') {
      R.dir = 'down'; R.step = null; R.fall = clamp((s2 - 40) / 300, 0, 1); R.fallX = sd
    } else if (res.kind === 'broken' && since < 240) { R.lean = -sd * 0.18 * (1 - since / 240); R.step = rw.step ?? 1 }
  }
  put(rb.x, fy(rb.d) - drive, them, R)
  // him
  const wm = walk(g, `me${g.i}`, me.x, me.d, 8)
  const M = { size: SIZE, number: 54, skin: skinOf(3), ...who.me, dir: 'up', pose: 'ready', step: null, still: true }
  const party = stop && res.stop ? clamp((s2 - 640) / 170, 0, 1) : 0
  if (party >= 1) {
    M.dir = 'down'; M.fall = 0
    M.pose = fum ? 'point-r' : ['flex', 'point-up', 'griddy', 'arms-up'][rep.k % 4]
    if (M.pose === 'griddy') M.pose = Math.floor(g.t / 170) % 2 ? 'griddy-a' : 'griddy-b'
    if (fum && since < 1300) M.pose = 'point-up'
  } else if (stop) {
    M.dir = 'up'; M.pose = 'wrap'; M.fall = stick ? clamp((s2 - 120) / 300, 0, 0.5) * (1 - party) : clamp((s2 - 40) / 300, 0, 1) * (1 - party); M.fallX = stick ? 0 : res.side; M.z = fy(rb.d) - drive + 1
  } else if (res?.kind === 'broken') {
    // he bounces off and goes down
    const f = clamp((since - 40) / 280, 0, 1), sd = res.side
    M.dir = sideName(-sd); M.pose = since < 140 ? 'wrap' : 'dive'; M.fall = f * 0.95; M.fallX = -sd
    if (since > 260 && !rep.whiffFx) { rep.whiffFx = true; landFx(g, view, me.x, fy(me.d), { side: -sd, power: 1.5 }) }
    if (since > 1050) { const bp = beatenPose(7, since - 1050); if (bp) { M.fall = 0; M.pose = bp.pose; M.squat = bp.squat; M.dir = 'up' } }
  } else if (res?.kind === 'miss') {
    const dive = clamp((since - 20) / 220, 0, 0.94), sd = Math.sign(rb.x - me.x) || 1
    M.dir = sideName(sd); M.pose = 'dive'; M.fall = dive; M.fallX = sd
    if (since > 240 && !rep.whiffFx) { rep.whiffFx = true; landFx(g, view, me.x, fy(me.d), { side: sd, power: 1.5 }) }
  } else if (rep.lunge) {
    const f = clamp((g.t - rep.tapAt) / 220, 0, 0.6)
    M.pose = 'dive'; M.fall = f; M.fallX = 0
  } else if (snapped) {
    const lat = Math.abs(wm.dx) > Math.abs(wm.dy)
    M.step = wm.step
    M.pose = wm.step == null ? 'ready' : lat ? 'slide' : null
    M.dir = wm.step != null && lat ? 'up' : 'up'
    if (rep.tapAt != null) { M.pose = 'wrap'; M.step = null }
  }
  put(me.x, fy(me.d) - (stop ? drive : 0), us, M)
  tagsAll(res && since > 700)
  action(ctx, view)
  // the ball: under the center, back to the QB, into the back's belly; loose on a fumble
  if (!snapped) {
    const q = tilt(view, CX, fy(OL_D - 16))
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + 1.5, 8.5 * q.s, 2.8 * q.s, 0, 0, Math.PI * 2); ctx.fill()
    airBall(ctx, q.x, q.y - 4 * q.s, { axis: [0.18, 1, 0.3], len: 18 * q.s, spin: 0 })
  } else if (age < 170) {
    const f = age / 170
    ballInAir(ctx, view, CX, lerp(fy(OL_D - 16), fy(QB_D), f), 14 + f * 18, 0, 1.1)
  }
  if (fum && since > 120) {
    const age2 = since - 120
    if (since < 580) looseBall(ctx, view, rb.x, fy(rb.d) - 26, age2, true)
    else if (since < 1350) { const q = tilt(view, ball.x, ball.y); airBall(ctx, q.x, q.y - 3 * q.s, { ang: 1.2, len: 12 * q.s }) }
  }
  // the ring: from the handoff it closes on him; TACKLE as it gets there (it goes white inside the window)
  if (g.tell.ring && !res) {
    const rem = g.tell.rem, k = clamp(1 - rem / RING_MS, 0, 1.3)
    const p = tilt(view, rb.x, fy(rb.d)), y = p.y - 46 * p.s * SIZE * 0.6, on = Math.abs(rem) <= g.W.good
    const R0 = 10 * p.s, rad = lerp(40 * p.s, R0, Math.min(1, k)) - Math.max(0, k - 1) * 12 * p.s
    ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(245,220,138,.9)'
    ctx.beginPath(); ctx.arc(p.x, y, R0, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = on ? '#fff' : 'rgba(255,255,255,.55)'; ctx.lineWidth = on ? 3.4 : 2.4
    ctx.beginPath(); ctx.arc(p.x, y, Math.max(2, rad), 0, Math.PI * 2); ctx.stroke()
  }
  // the gap he's hitting, called over him the way the booth would (only once he's past the mesh, never before)
  if (snapped && !res && rep.handed && !g.tell.ring) {
    const p = tilt(view, rb.x, fy(rb.d))
    const hole = rep.cutAt != null ? rep.real : rep.show
    text(ctx, `${GAP_WORD[hole.n]} GAP`, p.x, p.y - 96 * p.s * SIZE * 0.6, { font: DISPLAY, size: 20, color: rep.cutAt != null ? GOLD : 'rgba(255,255,255,.85)' })
  }
  g.dirt.draw(ctx, g.t)
  ctx.restore()
  if (g.phase === 'set') { if (g.warmFor !== g.i) { g.warmFor = g.i; g.warmed = 0; g.warmL = warmList(g, us, them) } warm(g, g.warmL) }
  vignette(ctx, view0)
}
