// Leverage: two fights won in the trenches, through the broadcast camera (art.js).
//   seal    the TE on the edge rusher, a hand fight for as long as it takes the back to get outside. The rusher dips a
//           shoulder and pushes that way: press the side he's on to stay in front of him. In the green the back flies;
//           out of it he slows, and the rusher gets a step. A rip is a hard shove: press twice, fast. One comes last.
//   sneak   fourth and inches at the goal line: wait out the cadence, then drive the pile.
import { byV, clamp, lerp, outcome, rngOf, prog, easeOut, easeIn, layer, football, themOf, text, DISPLAY, LABEL, GOOD, BAD, GOLD, manOf, paceOf, particles, nudge } from './kit.js'
import { nameTag, tilt, untilt, ground, stands, floodlight, vignette, athlete, skinOf, crowdPop } from './art.js'
import { fxSeed, hitFx, plantFx, landFx, pushIn, afterStop } from './contact.js'
import { placeStamp } from './read.js'
import { paintFieldFlat, SL, SR, tag, drawTags, SPIKE_MS, looseBall } from './throw.js'
import { curve } from './dash.js'

export const how = {
  seal: 'He dips a shoulder and pushes that way: press the side he is on and keep the bar in the green until the back is by. RIP: press twice, fast.',
  sneak: 'Wait for the snap. Then tap hard behind your centre and drive it over the line.',
}
const gaussOf = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())

export function make(args) { return args.game === 'sneak' ? makeSneak(args) : makeSeal(args) }
export function draw(ctx, g, view) { return g.game === 'sneak' ? drawSneak(ctx, g, view) : drawSeal(ctx, g, view) }

// ── SEAL ────────────────────────────────────────────────────────────────────
const FIRST_AT = 1000                 // the first push, after a look at the set
const POP_MS = 170
const BACK_MS = 5200                  // how long the back takes to get outside, with you in the green the whole way
const SLOW_BACK = 0.4                 // and how much of that speed he has with you out of it
const IMPULSE = 0.27                  // what a press takes back
const SPAM_MS = 90                    // two presses closer than this: the second's half a press
const SWITCH_MS = 170                 // changing sides takes a beat: flailing both ways does nothing
const OVERSHOOT = 0.12                // a good press can set you a little the other side of him, no further
const RIP_AT = 0.82                   // the back's nearly there: the rusher's last one is always a rip
function makeSeal({ v, seed, pos, cast }) {
  const r = rngOf(seed)
  // (an offensive lineman plays it too: the same fight, drawn as the tackle on the end of the line. The rules don't change)
  const lineman = pos === 'ol' || !!cast?.us?.ol?.[0]?.me
  const green = byV(v, 0.36, 0.5)    // the middle of the bar. Blocking widens it...
  const force = byV(v, 0.92, 0.6)     // ...slows his push (bar a second)...
  const tellMs = byV(v, 360, 480)     // ...gives more warning...
  const loseMs = byV(v, 1150, 1600)   // ...and more time out of the green before he's by
  let run = 0
  const g = {
    t: 0, game: 'seal', lineman, zones: 'lr', pads: ['LEFT', 'RIGHT'], padLit: null, fx: [], done: null, outro: 1900, stamp: null, dirt: particles(40, fxSeed(seed)), nudge: nudge(),
    green, bar: 0, shown: 0, back: 0, strain: 0, past: 0, inGreen: 0, played: 0, cur: null, lastPress: -999, popAt: -999, popDir: 0, litAt: -999,
    lastRip: false, held: false, yards: 0, doneAt: null,
    hud: { prompt: 'STAY IN FRONT OF HIM', dots: [] },
    tick(dt) {
      g.t += dt
      if (g.t - g.litAt > 110) g.padLit = null
      const k = 1 - Math.exp(-dt / 70)
      g.shown += (g.bar - g.shown) * k
      const out = clamp((Math.abs(g.bar) - green) / (1 - green), 0, 1)
      g.past += (out - g.past) * k
      if (g.done) return
      if (g.t < FIRST_AT) { if (g.t > FIRST_AT - 120) g.hud.prompt = null; return }
      let m = g.cur
      if (!m || g.t >= m.until) m = nextMove()
      // he's set before he goes: the push only starts when the tell's had its time
      if (g.t >= m.pushAt) {
        const mult = m.rip ? 1.2 : 1
        g.bar += m.dir * force * mult * dt / 1000
        // a rip's shove, all at once at the start
        if (m.rip && !m.jolted) { m.jolted = true; g.bar += m.dir * 0.26; g.fx.push('h:heavy') }
      }
      g.hud.prompt = m.rip && g.t < m.until ? 'RIP! PRESS TWICE' : null
      g.hud.hot = !!m.rip
      g.bar = clamp(g.bar, -1, 1)
      const inG = Math.abs(g.bar) <= green
      g.played += dt
      if (inG) { g.inGreen += dt; g.strain = Math.max(0, g.strain - dt * 0.6) } else g.strain += dt
      g.back += (dt / BACK_MS) * (inG ? 1 : SLOW_BACK)
      if (Math.abs(g.bar) >= 1 || g.strain >= loseMs) return finish(false)
      if (g.back >= 1) return finish(true)
    },
    input(a) {
      if (a.kind !== 'down' || g.done) return
      const side = a.zone === 'L' ? -1 : a.zone === 'R' ? 1 : 0
      if (!side) return
      g.padLit = side > 0 ? 1 : 0; g.litAt = g.t
      if (g.t < FIRST_AT - 120) return
      const m = g.cur
      if (side !== g.lastSide && g.t - g.lastPress < SWITCH_MS) return
      g.lastSide = side
      // the side he's on, or the side his shoulder's going: anything else is a little step the wrong way
      const right = g.bar * side > 0.02 || (m && m.dir === side)
      const spam = g.t - g.lastPress < SPAM_MS
      g.lastPress = g.t
      const amt = IMPULSE * (spam ? 0.5 : 1) * (right ? 1 : 0.8)
      g.bar -= side * amt
      if (right) {
        // you can set yourself just past him. You can't throw him back across
        g.bar = side > 0 ? Math.max(g.bar, -OVERSHOOT) : Math.min(g.bar, OVERSHOOT)
        g.popAt = g.t; g.popDir = side
        g.fx.push('pop', 'h:light')
      } else g.fx.push('h:light')
      g.bar = clamp(g.bar, -1, 1)
    },
  }
  function nextMove() {
    const was = g.cur?.dir ?? 0
    let dir = was === 0 ? (r() < 0.5 ? -1 : 1) : r() < 0.68 ? -was : was
    if (dir === was) { run++; if (run >= 2) { dir = -dir; run = 0 } } else run = 0
    // he's no fool: with a step on one side, he mostly stays on it
    if (Math.abs(g.bar) > 0.12 && r() < 0.75) dir = Math.sign(g.bar)
    const last = g.back >= RIP_AT && !g.lastRip
    if (last) g.lastRip = true
    const rip = last || (g.back > 0.15 && g.back < RIP_AT && r() < 0.2)
    const tell = tellMs * (rip ? 1.1 : 1)
    g.cur = { dir, rip, at: g.t, pushAt: g.t + tell, until: g.t + tell + (rip ? 560 : 620 + r() * 480), jolted: false }
    if (rip) g.fx.push('h:medium')
    return g.cur
  }
  function finish(held) {
    const share = g.played ? g.inGreen / g.played : 0
    const score = held ? clamp(0.5 + 0.5 * share, 0.5, 1) : clamp(g.back * 0.46, 0, 0.46)
    g.held = held; g.doneAt = g.t
    g.yards = held ? Math.round(9 + share * 24) : 0
    g.done = outcome(score, held, held ? `Held the edge · +${g.yards} yds` : 'Shed · tackled', { made: held ? 1 : 0, of: 1 })
    g.hud.prompt = null; g.hud.hot = false
    g.stamp = held ? { text: 'HELD THE EDGE', good: true, at: g.t + 120, size: 40 } : { text: 'SHED', good: false, at: g.t + 120, size: 50 }
    if (held) { g.fx.push('stamp', 'h:heavy'); g.popAt = g.t }
    else g.fx.push('deny', 'h:heavy')
  }
  return g
}

// ── SNEAK ───────────────────────────────────────────────────────────────────
const DRIVE_MS = 3000
const SNEAK_C = 3, SNEAK_F = 4.1
// a slower, fuller shove lifts nearly what two quick ones do; past 10 a second more taps add nothing:
// a pile doesn't care how fast your thumbs are, past what your legs can use
const fuller = ms => (ms < 98 ? Math.max(ms, 40) / 98 : ms < 105 ? 1 : Math.pow(Math.min(ms, 190) / 105, 1.05))
function makeSneak({ v, seed }) {
  const r = rngOf(seed)
  const J = curve(v, [[1, 0.572], [3, 0.59], [5, 0.612], [8, 0.635], [11, 0.655]])
  const stack = 1 + clamp(gaussOf(r), -1.6, 1.6) * 0.1    // how heavy their front is this snap
  const cadence = () => {
    const n = 1 + Math.floor(r() * 3)
    let at = 650 + r() * 350
    const huts = []
    for (let i = 0; i < n; i++) { huts.push(at); at += 620 + r() * 420 }
    return huts
  }
  const g = {
    t: 0, game: 'sneak', zones: 'none', fx: [], done: null, outro: 2100, stamp: null, dirt: particles(44, fxSeed(seed)), nudge: nudge(),
    phase: 'cadence', huts: [], hutN: 0, base: 0, snapAt: null, hutAt: -999, falses: 0, fsAt: -9999,
    need: 1, b: 0, vel: 0, vb: 0, heave: 0, lastTap: -300, firstTap: null, tapAt: -999, tapN: 0, doneAt: null, won: false, hud: { prompt: 'WAIT FOR THE SNAP' },
    tick(dt) {
      g.t += dt
      const s = dt / 1000
      // what's on the screen follows the fight slowly: a pile has weight
      g.vb += (g.b - g.vb) * (1 - Math.exp(-dt / 190))
      g.heave *= Math.exp(-dt / 260)
      if (g.done) {
        g.b += g.vel * s; g.vel *= Math.exp(-3 * s)
        return
      }
      if (g.phase === 'cadence') {
        if (g.t < g.fsAt + 800) return
        const next = g.base + g.huts[g.hutN]
        if (g.t >= next) {
          g.hutAt = g.t; g.hutN++
          if (g.hutN >= g.huts.length) {
            g.phase = 'drive'; g.snapAt = g.t; g.lastTap = g.t
            g.hud.prompt = 'TAP TAP TAP'; g.hud.hot = true
            g.fx.push('stamp', 'h:heavy')
          } else g.fx.push('h:light')
        }
        return
      }
      // they fire out a beat after the snap, and it's all gravity from there
      const since = g.t - g.snapAt
      const F = SNEAK_F * stack * clamp(since / 220, 0, 1)
      g.vel += -F * s
      g.vel *= Math.exp(-SNEAK_C * s)
      g.b += g.vel * s
      if (g.b >= g.need) win()
      else if (since >= DRIVE_MS || g.b <= -0.85) lose()
    },
    input(a) {
      if (a.kind !== 'down' || g.done) return
      if (g.phase === 'cadence') {
        if (g.t < g.fsAt + 800) return
        g.falses++; g.fsAt = g.t
        g.need += 0.22
        g.fx.push('deny', 'h:heavy')
        if (g.falses >= 3) {
          g.phase = 'drive'; g.snapAt = g.t; g.doneAt = g.t
          g.done = outcome(0, false, 'False start · turned over', { margin: -1 })
          g.hud.prompt = null
          g.stamp = { text: 'FALSE START', good: false, at: g.t, size: 44, y: 200 }
          return
        }
        g.stamp = { text: 'FALSE START', good: false, at: g.t, ms: 780, size: 44, y: 200 }
        g.huts = cadence(); g.hutN = 0; g.base = g.t + 800 - 400
        return
      }
      const gap = g.t - g.lastTap
      if (gap < 30) return
      if (g.firstTap == null) g.firstTap = g.t
      g.lastTap = g.t; g.tapAt = g.t; g.tapN++
      g.vel += J * fuller(gap)
      g.heave = Math.min(1, g.heave + 0.3)
      if (g.tapN % 2) g.fx.push('tap')
      g.fx.push('h:light')
    },
  }
  g.huts = cadence()
  function win() {
    const spare = (DRIVE_MS - (g.t - g.snapAt)) / 1000
    const score = clamp(0.5 + (spare / 1.6) * 0.5, 0, 1)
    g.won = true; g.doneAt = g.t
    g.done = outcome(score, true, `Punched it in · ${spare.toFixed(1)} s to spare${g.falses ? ' · false start' : ''}`, { margin: spare })
    g.hud.prompt = null; g.hud.hot = false
    g.stamp = { text: 'TOUCHDOWN', good: true, at: g.t + 100, size: 56, y: 420 }
    g.popAt = g.t; g.fx.push('stamp', 'h:heavy')
  }
  function lose() {
    const score = clamp(g.b / g.need, 0, 1) * 0.46
    g.doneAt = g.t
    g.vel = -0.45
    g.done = outcome(score, false, `Stuffed${g.falses ? ' · false start' : ''}`, { margin: g.b - g.need })
    g.hud.prompt = null; g.hud.hot = false
    g.stamp = { text: 'STUFFED', good: false, at: g.t + 100, size: 60, y: 420 }
  }
  return g
}
// ── The field: Third & Long's, the same paint, stands, benches and player scale ───
const PYD = h => (h >= 700 ? 10.6 : 9)     // units a yard: a shade closer than Third & Long, the fight's in inches
const SIZE = h => (h >= 700 ? 1.12 : 1)    // a lineman
const SPREAD = h => 27 * SIZE(h)           // shoulder to shoulder
function bake(ctx, view, key, ez, withPosts = false) {
  const c = view.colors, them = themOf(view), h = view.h
  layer(ctx, view, key, x => {
    stands(x, view, 'field', [c.us, c.trim])
    const hy = tilt(view, 0, 0).y
    const pyd = PYD(h)
    ground(x, view, f => paintFieldFlat(f, view, ez, pyd, c.us), `flat|${key}`, 0, Math.round((h - hy) * view.px * 0.7))
    // at the goal line (the sneak): the stands right up to the back of the end zone, the way Fourth & Goal has them,
    // the same picture nearer, its foot on the end line (no green field going on past it)
    if (withPosts) {
      const at = tilt(view, 180, ez - pyd * 10 - pyd * 1.4).y, k = at / hy   // (a step behind the end line, scaled to this closer camera)
      if (at > 0) { x.save(); x.beginPath(); x.rect(0, 0, view.w, at); x.clip(); x.translate(view.w / 2, 0); x.scale(k, k); x.translate(-view.w / 2, 0); stands(x, view, 'field-close', [c.us, c.trim]); x.restore() }
    }
    floodlight(x, view)
    // the benches, in knots down each sideline
    const knots = [0.2, 0.235, 0.27, 0.4, 0.44, 0.47, 0.62, 0.655, 0.8]
    knots.forEach((f, n) => {
      man(x, view, -14 - ((n * 7) % 3) * 8, h * f, 0, c, them, n * 3, 0.72, 'right', 'ready')
      man(x, view, view.w + 14 + ((n * 5) % 3) * 8, h * (1.02 - f) - 40, 1, c, them, n * 5 + 1, 0.72, 'left', 'ready')
    })
    if (withPosts) goalPosts(x, view, ez - pyd * 10)
  })
}
// the goal posts, on the end line: a gooseneck, the crossbar, two uprights
function goalPosts(x, view, endY) {
  const p = tilt(view, 180, endY), s = p.s
  const cross = 72 * s, half = 56 * s, tall = 122 * s
  const stroke = (col, w) => {
    x.strokeStyle = col; x.lineWidth = w * s; x.lineCap = 'round'; x.lineJoin = 'round'
    x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x, p.y - cross * 0.62); x.quadraticCurveTo(p.x, p.y - cross, p.x + 2 * s, p.y - cross)
    x.moveTo(p.x - half, p.y - cross - tall); x.lineTo(p.x - half, p.y - cross); x.lineTo(p.x + half, p.y - cross); x.lineTo(p.x + half, p.y - cross - tall)
    x.stroke()
  }
  stroke('rgba(8,12,16,.7)', 5.4)
  stroke('#f2d33b', 3.2)
  x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(p.x + 3 * s, p.y + 1, 7 * s, 2.2 * s, 0, 0, Math.PI * 2); x.fill()
}
// a patch of paint on the turf, seen through the camera
function turf(ctx, view, x0, y0, x1, y1) {
  const a = tilt(view, x0, y0), b = tilt(view, x1, y0), p = tilt(view, x1, y1), q = tilt(view, x0, y1)
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.closePath(); ctx.fill()
}
const O = {}
function man(ctx, view, x, y, side, c, them, n, size, dir, pose, opts) {
  O.color = side ? them.color : c.us; O.trim = side ? them.trim : c.trim; O.pants = O.trim
  const L = opts?.look
  O.skin = L?.skin ?? skinOf(n); O.number = L?.number ?? opts?.number ?? null; O.size = size; O.dir = dir; O.pose = pose
  O.step = opts?.step ?? null; O.carry = opts?.carry ?? false; O.fall = opts?.fall ?? 0; O.fallX = opts?.fallX ?? 0; O.kit = 'pads'
  athlete(ctx, view, x, y, O)
  // his name waits for the end of the frame, so the next man's helmet doesn't cover it
  if (L?.name && !O.fall && !opts.quiet) {
    const q = tilt(view, x, y)
    nameTag(ctx, view, q.x, q.y + (opts.lo ? 7.5 * q.s : 0), L.name, opts.ol ? 0.72 : Math.max(0.8, q.s * size * 0.8))
  }
}
// the real men: only a man the roster really has (no wrapping round to the same man twice)
const realMan = (cast, group, i) => (cast?.us?.[group]?.length > i ? manOf(cast, 'us', group, i) : null)
// their front, when the roster has it: a number and a face, no name in the pile
const frontMan = (cast, i) => (cast?.them?.dl?.length > i ? { number: cast.them.dl[i].number, skin: cast.them.dl[i].skin } : null)
// a small slab for the clock, up against the corner: the stands stay in view (the host's title bar
// is drawn over the top 44, so it sits just under that)
function barClock(ctx, w, y, secs, col, tag, tagCol) {
  ctx.fillStyle = 'rgba(5,8,11,.86)'; ctx.fillRect(w - 148, y, 148, 30)
  text(ctx, secs, w - 10, y + 16, { font: DISPLAY, size: 24, align: 'right', color: col })
  text(ctx, tag, w - 52, y + 16, { font: LABEL, size: 16, align: 'right', color: tagCol, track: 0.5 })
}

// ── SEAL ────────────────────────────────────────────────────────────────────
// The rusher stands far enough off him to be seen over his shoulders. His move is all in his body: he
// tips over from the feet, one shoulder dropped, his arm jabbing out, and steps out from behind our man.
const SEAL_ZOOM = 1.26   // pushed in on the fight, with the line still all in the picture
function drawSeal(ctx, g, view0) {
  const { h } = view0
  // (the word goes up over the far field: the fight and the back are below it)
  if (g.stamp && !g.stamp.placed) { g.stamp.placed = true; g.stamp.y = h * 0.3 }
  const c = view0.colors, them = themOf(view0)
  // the two of them are the picture: our man's feet above the thumbs, the line going off to the side
  const los = Math.round(untilt(view0, 180, h - 186).y) - 9, P = PYD(h), S = SIZE(h) * 0.86, SP = 38, BIG = S * 1.08
  const at = tilt(view0, 268, los)
  const view = pushIn(ctx, g, view0, SEAL_ZOOM, at.x, at.y, SEAL_ZOOM, at.x, h - 192)
  bake(ctx, view, `seal|${c.us}|${them.color}|${los}`, los - 32 * P)
  crowdPop(ctx, view, [c.us, c.trim], g.t - (g.popAt ?? -1e9))
  ctx.fillStyle = '#3f86ff'; turf(ctx, view, SL, los - 1.6, SR, los + 1.6)
  ctx.fillStyle = '#f7d64a'; turf(ctx, view, SL, los - 10 * P - 2, SR, los - 10 * P + 2)

  const cx0 = 268, m = g.done ? null : g.cur
  // our man: the tight end, or (a lineman's game) the tackle himself, with the four inside him
  const OL = g.lineman
  const men = g.men ?? (g.men = { te: realMan(view.cast, OL ? 'ol' : 'te', 0), rb: realMan(view.cast, 'rb', 0), pace: paceOf(view.cast, 'us', 'rb', 0), ol: OL ? [null, 4, 3, 2, 1].map(i => (i == null ? null : realMan(view.cast, 'ol', i))) : [0, 1, 2, 3, 4].map(i => realMan(view.cast, 'ol', i)) })
  const myNum = OL ? 76 : 88, lineN = OL ? 4 : 5
  const age = g.doneAt != null ? g.t - g.doneAt : 0
  const shed = g.done && !g.held, heldOut = g.done && g.held
  // his shoulder: most of it in the first 150 ms, so the eye has it, and it stays dropped while he pushes
  const tell = m ? easeOut(prog(g.t, m.at, m.at + 150)) * (m.rip ? 1.25 : 1) : 0
  const jab = m ? m.dir : 0
  const popK = clamp(1 - (g.t - g.popAt) / POP_MS, 0, 1)
  const recoil = popK * g.popDir
  // the fight moves with the bar: he slides out from behind our man as he wins it, and gets a step when it's gone.
  // Held all the way, our man's driven him back by the end
  let rx = cx0 + g.shown * 34 + jab * tell * 14
  // (chest to chest: they're always in each other's hands)
  let ry = los - 27 - popK * 8 + g.past * 38 - clamp(g.back, 0, 1) * 8
  let tx = cx0 + g.shown * 16, ty = los + 9 - clamp(g.back, 0, 1) * 5 * (1 - g.past)
  // each good shove: the feet dig in. A rip: he's got the jump, and you feel it
  if (g.popAt > (g.popSeen ?? -1)) { g.popSeen = g.popAt; plantFx(g, view, tx, ty, g.popDir, 4, 0.9) }
  if (m?.rip && m.jolted && !m.joltFx) { m.joltFx = true; g.nudge.kick(g.t, 3.2, m.dir, 0, 170); plantFx(g, view, rx, ry, m.dir, 6) }
  // held all the way: he finishes him. Drives him back and puts him on his back
  const pancake = heldOut ? clamp(age / 260, 0, 1) : 0
  if (heldOut) {
    const drive = easeOut(pancake)
    ry -= drive * 20; ty -= drive * 18; tx += (rx - tx) * drive * 0.4
    if (!g.hitFx) { g.hitFx = true; hitFx(g, view, rx, ry, { power: 5.5, s: 0.9, up: 20 }) }
    if (age > 260 && !g.landFx) { g.landFx = true; landFx(g, view, rx, ry, { s: 0.9, side: 0.5 }) }
  }
  // the back: round behind the fight to the outside, as fast as you're holding
  const f = clamp(g.back, 0, 1)
  g.bf = g.bf == null ? f : g.bf + (f - g.bf) * 0.2
  let bx = lerp(80, 322, g.bf), by = los + 46 - g.bf * 8
  let bdir = 'right', bfall = 0
  if (heldOut) { const a = prog(age * men.pace, 0, 1500); bx = lerp(bx, 326, Math.min(1, a * 3)); by -= easeOut(a) * (los - 60); bdir = a > 0.05 ? 'up' : 'right' }
  const shedF = shed ? easeOut(prog(age, 0, 420)) : 0
  if (shed) {
    rx = lerp(rx, bx - 8, shedF); ry = lerp(ry, by - 6, shedF)
    const s2 = afterStop(age - 380); bfall = age >= 380 ? clamp((s2 - 15) / 235, 0, 1) : 0
    // he's got the back: the moment it lands
    if (age >= 380 && !g.hitFx) { g.hitFx = true; hitFx(g, view, bx, by, { power: 6.5, s: 0.9, up: 22 }); g.fx.push('stamp') }
    if (s2 > 250 && !g.landFx) { g.landFx = true; landFx(g, view, bx, by, { s: 0.9, side: 0.5 }) }
  }
  const stepB = Math.floor(g.t / (Math.abs(g.bar) <= g.green ? 90 : 150)) % 4
  const up = shed ? clamp((age - 1120) / 180, 0, 1) : 0   // (and he's up over him)

  // their front and our line, inside the fight: the rest of the play
  const wig = Math.sin(g.t / 210) * 1.2
  for (let i = 1; i <= 5; i++) man(ctx, view, cx0 - 12 - i * SP + wig, los - 26, 1, c, them, 10 + i, S, 'down', 'block', { look: frontMan(view.cast, i) })
  const rushLook = frontMan(view.cast, 0)
  const rusher = () => {
    if (shed) { man(ctx, view, rx + up * 10, ry - up * 14, 1, c, them, 3, BIG, 'down', up >= 1 ? 'flex' : shedF >= 1 ? 'wrap' : null, shedF < 1 ? { step: stepB, look: rushLook } : { fall: bfall * (1 - up), fallX: 1, look: rushLook }); return }
    if (heldOut) { man(ctx, view, rx, ry, 1, c, them, 3, BIG, 'down', 'wrap', { fall: pancake, fallX: -1, look: rushLook, quiet: true }); return }
    // tipped over from his feet: the shoulder drops the way he's going
    const q = tilt(view, rx, ry)
    const tip = jab * tell * 0.3 + recoil * -0.1
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(tip); ctx.translate(-q.x, -q.y)
    man(ctx, view, rx, ry, 1, c, them, 3, BIG, 'down', jab ? (jab < 0 ? 'swipe-l' : 'swipe-r') : 'block', { number: 91, look: rushLook, quiet: true })
    ctx.restore()
  }
  const back = () => man(ctx, view, bx, by, 0, c, them, 5, S * 0.92, bdir, null, bfall ? { fall: bfall, carry: true, look: men.rb } : { step: stepB, carry: true, look: men.rb })
  // our man: braced, and turned half away for a moment when he's been beaten
  const te = () => {
    const beat = g.past
    // (the man he put down, and he stands over him)
    if (heldOut && age > 780) { man(ctx, view, tx, ty, 0, c, them, 7, BIG, 'down', 'flex', { number: myNum, look: men.te }); return }
    const q = tilt(view, tx, ty)
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(-Math.sign(g.shown) * beat * 0.16 + recoil * 0.06); ctx.translate(-q.x, -q.y)
    man(ctx, view, tx, ty, 0, c, them, 7, BIG, 'up', 'block', { number: myNum, look: men.te })
    ctx.restore()
  }
  const backFirst = heldOut && by < ry
  if (backFirst) back()
  // (once he's level with our man he's the nearer of the two only when he's lower on the screen)
  const rushFirst = ry <= ty
  if (rushFirst) rusher()
  for (let i = 1; i <= lineN; i++) man(ctx, view, cx0 - 12 - i * SP - wig, los + 2, 0, c, them, 20 + i, S, 'up', 'block', { number: 64 + i, look: men.ol[5 - i], ol: 1, lo: i % 2 })
  te()
  if (!rushFirst) rusher()
  // the pop: pads meeting, a crack of three short lines where they hit
  if (popK > 0) {
    const a = tilt(view, (rx + tx) / 2, (ry + ty) / 2), sp = a.s * BIG, o = (1 - popK) * 7
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4 * sp; ctx.lineCap = 'round'
    ctx.beginPath()
    for (const d of [-0.9, 0, 0.9]) {
      const dx = Math.sin(d), dy = -Math.cos(d), yy = a.y - 34 * sp
      ctx.moveTo(a.x + dx * (9 + o) * sp, yy + dy * (9 + o) * sp); ctx.lineTo(a.x + dx * (16 + o) * sp, yy + dy * (16 + o) * sp)
    }
    ctx.stroke()
  }
  if (!backFirst) back()
  drawTags(ctx, view)
  g.dirt.draw(ctx, g.t)
  ctx.restore()
  vignette(ctx, view0)
  // the yards, under the word
  if (heldOut && age > 320) text(ctx, `+${g.yards} YDS`, 180, h * 0.3 + 48, { font: DISPLAY, size: 30, color: '#fff' })
  if (!g.done) {
    // which way his shoulder's going, over his helmet
    if (m && g.t < m.pushAt + 120) {
      const q0 = tilt(view, rx, ry), q = { x: at.x + (q0.x - at.x) * SEAL_ZOOM, y: h - 192 + (q0.y - at.y) * SEAL_ZOOM, s: q0.s * SEAL_ZOOM }, hy = q.y - 62 * q.s * BIG, hx = q.x + m.dir * 6
      ctx.fillStyle = m.rip ? GOLD : '#fff'; ctx.strokeStyle = 'rgba(8,12,16,.82)'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'
      ctx.beginPath(); ctx.moveTo(hx + m.dir * 13, hy); ctx.lineTo(hx - m.dir * 3, hy - 10); ctx.lineTo(hx - m.dir * 3, hy + 10); ctx.closePath(); ctx.fill(); ctx.stroke()
    }
    sealBar(ctx, view0, g)
  }
}
// The leverage bar, just above the thumbs: the green is in front of him, the marker's where the fight is
function sealBar(ctx, view, g) {
  const W = 248, H = 11, x0 = (view.w - W) / 2, y = view.h - 112
  ctx.fillStyle = 'rgba(6,10,12,.82)'; ctx.fillRect(x0 - 2, y - 2, W + 4, H + 4)
  ctx.fillStyle = '#3b2024'; ctx.fillRect(x0, y, W, H)
  const gw = g.green * W
  ctx.fillStyle = Math.abs(g.bar) <= g.green ? GOOD : '#2c8f57'; ctx.fillRect(view.w / 2 - gw / 2, y, gw, H)
  const mx = view.w / 2 + clamp(g.shown, -1, 1) * (W / 2)
  ctx.fillStyle = '#fff'; ctx.fillRect(mx - 2, y - 4, 4, H + 8)
}

// ── SNEAK ───────────────────────────────────────────────────────────────────
// a goal-line front, seven across, shoulder to shoulder. Centre is 3, right guard is 4
const WEDGE = [0.3, 0.46, 0.84, 1, 1, 0.56, 0.3]   // how much of his push reaches each man
const SNEAK_ZOOM = 1.62   // right in on the pile: it's a game of inches
function drawSneak(ctx, g, view0) {
  const { w, h } = view0
  const c = view0.colors, them = themOf(view0)
  const P = PYD(h), SZ = SIZE(h), SP = SPREAD(h)
  const goalY = Math.round(h * 0.82)
  // (he leans in as the fight goes on, and each shove moves the picture a touch)
  const leanIn = 1.5 + 0.1 * (g.snapAt != null ? prog(g.t, g.snapAt, g.snapAt + 1400) : 0) + 0.02 * g.heave
  const pile = tilt(view0, 180, goalY + 10)
  const view = pushIn(ctx, g, view0, leanIn, 180, pile.y, SNEAK_ZOOM, 180, h * 0.56)
  // seven across: the tight ends on the ends of the line, the five in between
  const men = g.men ?? (g.men = { qb: realMan(view.cast, 'qb', 0), line: [realMan(view.cast, 'te', 0), ...[0, 1, 2, 3, 4].map(i => realMan(view.cast, 'ol', i)), realMan(view.cast, 'te', 1)], b0: realMan(view.cast, 'rb', 0), b1: realMan(view.cast, 'rb', 1) })
  bake(ctx, view, `sneak|${c.us}|${them.color}|${goalY}`, goalY, true)
  crowdPop(ctx, view, [c.us, c.trim], g.t - (g.popAt ?? -1e9))
  const los = goalY + P * 1.6 * g.need         // fourth and goal, inches from the line
  const fire = g.snapAt != null ? easeOut(prog(g.t, g.snapAt, g.snapAt + 340)) : 0
  const gap = lerp(10, 7, fire)
  const olY0 = los + gap, qbY0 = olY0 + 15
  // the push, turned into ground: his feet reach the goal line as the ball does
  const span = qbY0 - goalY
  const f = clamp(g.vb / g.need, -0.45, 1.1)
  const moved = f * span
  const qy = qbY0 - moved
  const heave = g.heave * 2
  const hitAge = g.doneAt != null ? g.t - g.doneAt : 0
  const won = g.done && g.won, lost = g.done && !g.won
  const slot = g.snapAt != null ? easeOut(prog(g.t, g.snapAt + 60, g.snapAt + 380)) : 0
  const qx = lerp(180, 180 + SP / 2, slot)     // from under the centre into the gap by his guard
  const crash = lost ? easeIn(prog(hitAge, 0, 460)) : 0
  const downD = won ? clamp((hitAge - 60) / 340, 0, 1) : 0
  const downQ = lost ? clamp((hitAge - 330) / 340, 0, 1) : 0
  // the snap: two walls meet. Then every shove is cleats going in
  if (g.snapAt != null && !g.snapFx && g.t >= g.snapAt + 90) {
    g.snapFx = true
    for (const i of [-2, 0, 2]) hitFx(g, view, 180 + i * SP, olY0 - gap, { power: i ? 0 : 4.5, n: 7, dust: 2, s: 0.8, up: 12 })
  }
  if (g.tapN !== (g.tapSeen ?? 0)) {
    g.tapSeen = g.tapN
    const i = (g.tapN * 3) % 7
    plantFx(g, view, 180 + (i - 3) * SP, olY0 - moved * WEDGE[i], 0, 2, 0.8)
    if (g.tapN % 4 === 0) g.nudge.kick(g.t, 1.3, 0, -1, 120)
  }
  // it's decided
  if (won && !g.hitFx) { g.hitFx = true; hitFx(g, view, qx, goalY, { power: 6, n: 16, dust: 4, s: 0.9, up: 14 }) }
  if (lost && crash >= 0.98 && !g.hitFx) { g.hitFx = true; hitFx(g, view, qx, qy, { power: 6.5, n: 14, s: 0.9, up: 18 }); g.fx.push('stamp', 'h:heavy') }
  if (lost && downQ >= 1 && !g.landFx) { g.landFx = true; landFx(g, view, qx, qy, { s: 0.9, side: -0.4 }) }

  ctx.fillStyle = '#3f86ff'; turf(ctx, view, SL, los - 1.6, SR, los + 1.6)
  // where the ball is, marked on both sidelines
  ctx.fillStyle = GOLD; turf(ctx, view, SL, qy - 1.6, SL + 20, qy + 1.6); turf(ctx, view, SR - 20, qy - 1.6, SR, qy + 1.6)

  // far to near: their backers, their front, our front, him, the backs behind him
  for (let i = 0; i < 3; i++) {
    const x0 = 180 + (i - 1) * SP * 1.6
    const y0 = olY0 - gap * 2 - moved * (i === 1 ? 1 : 0.7) - 22
    const rise = lost && i === 1 ? clamp((hitAge - 1180) / 170, 0, 1) : 0   // (the man who made the stop, back on his feet)
    man(ctx, view, lerp(x0, qx + (i - 1) * 16, crash), lerp(y0, qy - 6, crash) - rise * 18, 1, c, them, 20 + i, SZ, 'down', rise >= 1 ? 'flex' : crash > 0.9 ? 'wrap' : fire ? 'block' : 'ready', crash > 0.9 ? { fall: downQ * (1 - rise), number: 50 + i } : { number: 50 + i })
  }
  for (let i = 0; i < 7; i++) {
    const m = moved * WEDGE[i], lean = heave * WEDGE[i]
    man(ctx, view, 180 + (i - 3) * SP, olY0 - m - lean - gap * 2, 1, c, them, 30 + i, SZ, 'down', fire ? 'block' : 'stance', downD && WEDGE[i] > 0.8 ? { fall: downD, look: frontMan(view.cast, i) } : { number: 90 + i, look: frontMan(view.cast, i) })
  }
  for (let i = 0; i < 7; i++) {
    const m = moved * WEDGE[i], lean = heave * WEDGE[i]
    const cheer = won && hitAge > 340 + ((i * 5) % 7) * 70
    man(ctx, view, 180 + (i - 3) * SP, olY0 - m - lean, 0, c, them, 40 + i, SZ, 'up', cheer ? 'arms-up' : fire ? 'block' : 'stance', { number: 70 + i, look: men.line[i], ol: 1, lo: i % 2, quiet: !!g.done })   // (once it's decided it's a pile: the names leave the line to the men with the ball)
  }
  // the ball, on the turf under the centre until it's snapped
  const sf = g.snapAt != null ? prog(g.t, g.snapAt, g.snapAt + 110) : 0
  if (sf < 1) {
    const p = tilt(view, lerp(180, qx, sf), lerp(olY0 + 2, qy, sf))
    football(ctx, p.x, p.y - lerp(1, 18, sf) * p.s, { ang: Math.PI / 2, scale: 0.7 * p.s })
  }
  // him: the same size as everyone, hands under the centre, then the ball tucked into his body
  // over the line: up with it, and he spikes it
  const sp = won ? hitAge - 300 : -1
  if (sp >= SPIKE_MS) man(ctx, view, qx, qy, 0, c, them, 2, SZ, 'down', sp < SPIKE_MS + 140 ? 'reach-r' : sp < SPIKE_MS + 620 ? 'hips' : 'flex', { number: 12, look: men.qb })
  else man(ctx, view, qx, qy - heave * 0.4, 0, c, them, 2, SZ, 'up', sp >= 0 ? 'spike-up' : sf >= 1 ? null : 'ready', { number: 12, carry: sf >= 1, fall: downQ, fallX: downQ ? -0.4 : 0, look: men.qb })
  man(ctx, view, qx - SP * 1.05, qy + 13 - heave * 0.3, 0, c, them, 4, SZ, 'up', 'block', { number: 34, look: men.b0 })
  man(ctx, view, qx + SP * 1.05, qy + 13 - heave * 0.3, 0, c, them, 6, SZ, 'up', 'block', { number: 44, look: men.b1 })
  drawTags(ctx, view)
  if (sp >= SPIKE_MS) looseBall(ctx, view, qx + 6, qy, sp - SPIKE_MS, true)
  g.dirt.draw(ctx, g.t)
  ctx.restore()
  vignette(ctx, view0)
  // the stamp sits below the pile
  if (g.stamp) g.stamp.y = h * 0.84

  // HUT, at the cadence
  if (g.phase === 'cadence' && g.t >= g.fsAt + 800) {
    const a = g.t - g.hutAt
    if (a < 340) {
      const q = 1 + 0.3 * (1 - easeOut(clamp(a / 90, 0, 1)))
      ctx.save(); ctx.translate(w / 2, h * 0.78); ctx.scale(q, q)
      text(ctx, 'HUT', 0, 0, { font: DISPLAY, size: 54, color: '#fff' })
      ctx.restore()
    } else if (g.hutN === 0) text(ctx, 'SET', w / 2, h * 0.78, { font: DISPLAY, size: 44, color: 'rgba(255,255,255,.86)' })
  }
  // the clock, in the title bar
  const left = g.snapAt != null ? clamp((DRIVE_MS - (Math.min(g.t, g.doneAt ?? g.t) - g.snapAt)) / 1000, 0, DRIVE_MS / 1000) : DRIVE_MS / 1000
  barClock(ctx, w, 46, left.toFixed(1), g.done ? (g.won ? GOOD : BAD) : left < 0.8 ? BAD : '#fff', g.falses ? `BACK ${g.falses * 5}` : '4TH & GOAL', g.falses ? BAD : GOLD)
}
