// The kicker's three, through the broadcast camera (art.js), on the numbers in lib/kicks.js.
//
// (the picture: from behind the kicker, in yards, through this file's own camera: see THE CAMERA below)
//   deep-kick     four field goals from 50 to 65, each one longer, in more wind, through a narrower window
//   game-winner   one kick from 25 to 65 with the game on it (Career's last play for a kicker)
//   onside        the onside kick: behind late, they need the ball back
//
// A FIELD GOAL is two presses. The first stops the needle on the aim bar: the green is the uprights, pushed off
// centre by the wind, narrower the longer the kick. The second stops the power bar: short of the mark and it dies
// in front of the crossbar; over the top of the bar is an overswing, and an overswung ball hooks.
//   Power     how far 100% carries (kickReach: F 54 yards, B 61, S 68). Past his reach there is no green on the power bar.
//   Accuracy  the width of the green, and how slowly the needle moves.
//   Clutch    with the game on it the needle shakes and the power bar runs fast. Clutch takes that away. A cold-blooded
//             kicker doesn't care that they called timeout to ice him; anybody else comes back to a quicker needle.
//
// THE ONSIDE KICK, and the rules it is built on (sources below):
//   - It has to be declared. Since the 2024 dynamic kickoff there are no surprise onside kicks: the kicking team tells the
//     officials, and both teams line up in the traditional kickoff formation, the receiving team's hands team up front.
//     2024: only in the fourth quarter, only when trailing. 2025: any time when trailing, and the ball moved up a yard,
//     kicked from the 34. 2026: it may be declared at any point in the game. This game only deals it the way it is
//     really used: behind late, needing the ball back.
//   - The kicking team may not touch the ball until it has gone 10 yards, unless the receiving team touches it first
//     (NFL Rulebook, Rule 6, Section 1: the kickoff). Short of 10 and touched by the kicking team, it's the other
//     team's ball. Since 2018 the kicking team has no running start and must have five men on each side of the ball.
//   - The kick: drive the top of the ball into the turf, so it skips once or twice and then takes one high hop about
//     ten yards out, hanging long enough for the coverage to arrive under it as it comes down.
//   - It almost never works. Recovered: 3 of 50 in 2024 (6%), 5 of 52 in 2025 (9.6%); about 16% in the decade before
//     the kickoff changes, when a team could still surprise the other.
//   Sources: CBS Sports, "NFL's next act in reinvigorating special teams? Double the onside kick success rate"
//   (cbssports.com/nfl/news/nfl-plans-to-boost-onside-kick-success-rate-after-all-time-low-excitement); AOL / USA Today,
//   "NFL kickoff rules 2026: League makes changes to onside kick, more" (aol.com/articles/nfl-kickoff-rules-2026-league-213518217.html,
//   numbers from The Football Database); NBC Sports ProFootballTalk, "Owners pass rule change allowing onside kicks at any
//   point when trailing" and "NFL will allow onside kicks any time, any score"; CBS Sports, "Five new NFL rules to know
//   heading into Week 1" (2025: the 34-yard line); NFL Football Operations, the dynamic kickoff explainer
//   (operations.nfl.com/updates/football-ops/new-nfl-kickoff-rule) and the NFL Rulebook, Rule 6.
//   Here: three presses (how far, the strike on the top of the ball, the leap under the hop), and then the bounce of a
//   football. Played perfectly an average kicker gets it back about one time in ten; played badly, one in thirty.
import { byV, clamp, lerp, outcome, rngOf, prog, easeOut, layer, text, rr, DISPLAY, LABEL, GOOD, BAD, GOLD, themOf, nudge } from './kit.js'
import { stands, floodlight, vignette, athleteAt, MAN_UNITS, horizonOf, skinOf, airBall, crowdPop } from './art.js'
import { hop } from './throw.js'
import { kickReach, onsideP } from '../kicks.js'

export const how = {
  'deep-kick': 'Four kicks, each one longer. Press once to stop the needle in the green: that is the uprights, and the wind moves it. Press again to stop the power past the mark. Over the top of the bar is an overswing, and it hooks.',
  'game-winner': 'One kick for the game. Press to stop the needle in the green, then press to stop the power past the mark. If they call timeout to ice him, do it again.',
  onside: 'They need the ball back. Press to set the distance: it has to go 10 yards. Press as the ring closes to drive the top of the ball into the turf. Press again as it comes down to go up for it. It rarely works.',
}

const POST_HALF = 3.083                // half the width of the uprights, yards (18 feet 6 inches)
const AIM_SPAN = 0.30                  // the aim bar from end to end, as an angle: at 50 yards the ends are 15 yards wide
const OVER = 1.15                      // the power bar runs to 115%: the last of it is the overswing
const LINE_GAP = 1.12                  // the line, man to man, in yards: foot to foot, as a field goal team lines up
const SET_MS = 950, RUN_MS = 430, RES_MS = 1500, ICE_MS = 1500, SWAY_MS = 200
const gaussOf = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
// a needle that sweeps end to end and back: -1..1
const sweep = (t, per) => { const f = ((t / per) % 2 + 2) % 2; return f < 1 ? -1 + 2 * f : 3 - 2 * f }
// the green on the aim bar for a kick from d yards (half its width, in bar units), before his accuracy
export const windowOf = d => POST_HALF / (d * AIM_SPAN)

export function make(args) { return args.game === 'onside' ? makeOnside(args) : makeFG(args) }
export function draw(ctx, g, view) { return g.game === 'onside' ? drawOnside(ctx, g, view) : drawFG(ctx, g, view) }

// ── FIELD GOALS ─────────────────────────────────────────────────────────────
function makeFG({ v, seed, game, kick = null, situation = null }) {
  const r = rngOf(seed)
  const pw = kick?.power ?? v, acc = kick?.accuracy ?? v, clu = kick?.clutch ?? v
  const winner = game === 'game-winner'
  const reach = kickReach(pw)
  // the kicks: four, longer each time (Deep Kick), or the one (Game Winner: never from past what a coach would ask)
  const kicks = winner
    ? [{ d: situation?.dist ?? 25 + Math.floor(r() * (Math.min(65, Math.round(reach) + 1) - 24)), wind: Math.round((r() - 0.5) * 2 * 9), hard: 1 }]
    : [[50, 53], [54, 57], [58, 61], [62, 65]].map(([lo, hi], i) => ({ d: lo + Math.floor(r() * (hi - lo + 1)), wind: Math.round((r() < 0.5 ? -1 : 1) * (2 + i * 4 + r() * 4)), hard: 1.12 + i * 0.17, tight: 1 - i * 0.1 }))
  const pressure = winner ? 1 : 0.25
  const accF = byV(acc, 1.25, 0.72)                    // what his accuracy does to a miss: an S pulls it 28% back to the middle
  const shake = byV(clu, 0.34, 0.03) * pressure            // the needle's shake with the game on it
  const hurry = lerp(1, byV(clu, 1.4, 0.95), pressure) // and the power bar's hurry
  const iced = winner && r() < 0.4                      // they call timeout as he lines it up
  const aimPer = byV(acc, 520, 900), powMs = byV((pw + acc) / 2, 640, 880)
  const g = {
    t: 0, game, zones: 'none', pads: ['KICK'], padLit: null, fx: [], done: null, outro: 1700, stamp: null, nudge: nudge(),
    kicks, i: 0, made: 0, near: 0, phase: 'set', at: 0, reach, accF, winner, iced, icedDone: false,
    // (aimAt, not aim: MgStage reads g.aim as "this game is played by pointing at the field" and stops sending keys, which
    // is why the space bar set the aim and then did nothing for the power)
    aimAt: null, pow: null, res: null, ball: null, k: kicks[0], noise: 0, noiseAt: 0, noiseFrom: 0, noiseTo: 0,
    hud: { prompt: null, dots: winner ? [] : kicks.map(() => null) },
    // what's on the bars right now (the bot reads these, as a player does)
    needle() { return clamp(sweep(g.t - g.at, aimPer / g.k.hard) + g.noise, -1, 1) },
    centre() { return clamp(g.k.wind * 0.035, -0.55, 0.55) },
    half() { return windowOf(g.k.d) / accF * (g.k.tight ?? 1) },   // (Deep Kick: each kick's green a tenth narrower than the last)
    power() { const f = (((g.t - g.at) / (powMs / hurry / g.k.hard)) % 2 + 2) % 2; return (f < 1 ? f : 2 - f) * OVER },
    need() { return g.k.d / reach },
    tick(dt) {
      g.t += dt
      if (g.padLit != null && g.t - g.litAt > 120) g.padLit = null
      // (the shake: a sway, not a jump. A new lean every SWAY_MS, seeded, so the same game shakes the same way, and the needle
      // eases from the last lean to the next: it used to snap to a new spot every 90 ms, which read as a needle that stuttered)
      if (shake && g.phase === 'aim') {
        if (g.t - g.noiseAt >= SWAY_MS) { g.noiseAt = g.t; g.noiseFrom = g.noiseTo; g.noiseTo = gaussOf(r) * shake * 0.5 }
        const f = clamp((g.t - g.noiseAt) / SWAY_MS, 0, 1)
        g.noise = g.noiseFrom + (g.noiseTo - g.noiseFrom) * (f * f * (3 - 2 * f))
      }
      if (g.done && g.phase === 'over') return
      if (g.phase === 'set') { if (g.t - g.at >= SET_MS) { g.phase = 'aim'; g.at = g.t; g.hud.prompt = 'PRESS TO SET THE AIM' } return }
      if (g.phase === 'iced') { if (g.t - g.at >= ICE_MS) { g.phase = 'aim'; g.at = g.t; g.stamp = null; g.hud.prompt = 'PRESS TO SET THE AIM' } return }
      if (g.phase === 'run') { if (g.t - g.at >= RUN_MS) strike(); return }
      if (g.phase === 'air') { if (g.t >= g.ball.land) settle(); return }
      if (g.phase === 'res' && g.t - g.at >= RES_MS) next()
    },
    input(a) {
      if (a.kind !== 'down' || g.done) return
      if (g.phase === 'aim') {
        g.padLit = 0; g.litAt = g.t
        // iced: the whistle goes as he lines it up. He does it again, and unless he's ice himself the needle is quicker
        if (iced && !g.icedDone) {
          g.icedDone = true; g.phase = 'iced'; g.at = g.t; g.hud.prompt = null
          g.stamp = { text: 'TIMEOUT', good: null, at: g.t, ms: ICE_MS - 100, size: 40 }
          g.k = { ...g.k, hard: g.k.hard * byV(clu, 1.22, 1) }
          g.fx.push('whistle'); return
        }
        g.aimAt = g.needle(); g.phase = 'power'; g.at = g.t; g.hud.prompt = 'PRESS TO SET THE POWER'; g.fx.push('tap'); return
      }
      if (g.phase === 'power') {
        g.padLit = 0; g.litAt = g.t
        g.pow = g.power(); g.phase = 'run'; g.at = g.t; g.hud.prompt = null; g.fx.push('h:light')
      }
    },
  }
  function strike() {
    const k = g.k, over = Math.max(0, g.pow - 1)
    // where it goes: off the middle of the green by his aim, plus the hook of an overswing (always the same way: a pull)
    const off = (g.aimAt - g.centre()) * accF + over * 3.2 * (r() < 0.5 ? -1 : 1)
    const yards = off * k.d * AIM_SPAN / (k.tight ?? 1)                   // wide of the middle of the uprights, at the uprights
    const carry = Math.min(g.pow, 1.06) * reach + (Math.abs(off) < windowOf(k.d) * 0.2 ? 1.5 : 0)   // (a pure strike carries a little more)
    const long = carry >= k.d
    const edge = Math.abs(yards) - POST_HALF
    // off the upright: half of them carom through
    const doink = long && Math.abs(edge) < 0.22
    const good = long && (edge < -0.22 || (doink && r() < 0.5))
    const why = good ? (doink ? 'doink-in' : 'good') : !long ? 'short' : doink ? 'doink' : yards < 0 ? 'left' : 'right'
    const T = 1250 + k.d * 16
    g.ball = { at: g.t, T, land: g.t + (long ? T : T * clamp(carry / k.d, 0.45, 1) * 0.92), yards, carry, long }
    g.res = { good, why, doink, at: g.ball.land, close: !good && (doink || (long && edge < 0.9) || (!long && k.d - carry < 2.5)) }
    g.phase = 'air'; g.fx.push('swoosh'); g.nudge.kick(g.t, 1.6, 0, -1, 150)
  }
  function settle() {
    const res = g.res
    if (res.good) g.made++
    else if (res.close) g.near++
    if (!winner) g.hud.dots[g.i] = res.good
    g.stamp = { text: res.good ? (res.doink ? 'OFF THE UPRIGHT AND IN' : g.k.d >= 60 ? `GOOD FROM ${g.k.d}` : 'IT’S GOOD') : res.why === 'short' ? 'SHORT' : res.why === 'doink' ? 'OFF THE UPRIGHT' : res.why === 'left' ? 'WIDE LEFT' : 'WIDE RIGHT', good: res.good, at: g.t, size: res.doink ? 30 : 42 }
    g.fx.push(res.good ? 'claim' : 'deny', res.good ? 'h:success' : 'h:medium')
    g.phase = 'res'; g.at = g.t
    if (g.i === kicks.length - 1) finish()
  }
  function next() {
    if (g.done) { g.phase = 'over'; return }
    g.i++; g.k = kicks[g.i]; g.aimAt = null; g.pow = null; g.res = null; g.ball = null; g.stamp = null; g.phase = 'set'; g.at = g.t; g.hud.prompt = null
  }
  function finish() {
    if (winner) { g.done = outcome(g.made ? 1 : g.near ? 0.3 : 0, g.made === 1, g.made ? `Good from ${kicks[0].d}` : `No good from ${kicks[0].d}`, { made: g.made, of: 1, dist: kicks[0].d }); return }
    // two of four from 50 and out is a kicker's day; the near misses count a little toward the score, never the result
    const score = clamp((g.made + g.near * 0.25) / 4 + (g.made >= 2 ? 0.25 : 0), 0, 1)
    g.done = outcome(score, g.made >= 2, `${g.made} of 4 from 50+`, { made: g.made, of: 4 })
  }
  g.at = 0
  return g
}

// ── THE CAMERA ──────────────────────────────────────────────────────────────
// Both kicks are seen from behind the kicker, through a real camera: a point a few yards behind him and just over his
// helmet, looking straight down the field. Everything is placed in yards (X across the field from the ball, Y down the
// field from it, Z up) and comes out the size it is: the kicker the biggest man in the picture because he is the nearest,
// the line less than half of him, the officials under the uprights shorter than the crossbar is high.
// (2026-11-12, the owner: "completely change the POV to the kicker, why is the kicker and refs massive". Before this the
// field went through the passing games' tilted camera with the men drawn several yards tall on it.)
const FIELD_HALF = 26.67, BAR_Z = 3.33, POST_TOP = 15, MAN_YD = 2.08, BALL_YD = 0.31
const TURF_A = '#22703e', TURF_B = '#1d6337', APRON = '#123f23', CHALK = '#eef1ec', POST = '#f2d21f'
const camFG = (view, d) => ({ cx: view.w / 2, hy: horizonOf(view), f: 330 + clamp((d - 30) / 35, 0, 1) * 80, B: 11, H: 2.9 })
// (the onside kick from higher up behind him: the ten yards in front of the tee are the whole play, so they get the picture)
const camOnside = view => ({ cx: view.w / 2, hy: horizonOf(view), f: 420, B: 11, H: 5.5 })
const P = (C, X, Y, Z = 0) => { const s = C.f / Math.max(0.8, Y + C.B); return { x: C.cx + X * s, y: C.hy + (C.H - Z) * s, s } }
// a patch of the field, and a line across it (w yards wide, never thinner than most of a pixel)
function patch(x, C, X0, Y0, X1, Y1) {
  const a = P(C, X0, Y0), b = P(C, X1, Y0), c = P(C, X1, Y1), d = P(C, X0, Y1)
  x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.lineTo(c.x, c.y); x.lineTo(d.x, d.y); x.closePath(); x.fill()
}
function across(x, C, X0, X1, Y, w) {
  const a = P(C, X0, Y), b = P(C, X1, Y), t = Math.max(0.8, (w * C.f * C.H) / ((Y + C.B) * (Y + C.B)))
  x.fillRect(a.x, a.y - t / 2, b.x - a.x, t)
}
// The field from the near edge of the picture to the end line. goalY: the goal line, in yards from the ball.
function paintGround(x, view, C, goalY) {
  const near = 1.3 - C.B, end = goalY + 10, W = FIELD_HALF, f = view.field
  x.fillStyle = APRON; x.fillRect(0, C.hy, view.w, view.h - C.hy)
  // mown in five-yard bands
  for (let k = Math.floor((near - goalY) / 5); k < 0; k++) { x.fillStyle = k & 1 ? TURF_A : TURF_B; patch(x, C, -W, Math.max(near, goalY + k * 5), W, goalY + (k + 1) * 5) }
  // the end zone, in the home colour, the name across it
  x.fillStyle = f?.end ?? '#14324f'; patch(x, C, -W, goalY, W, end)
  if (f?.word) {
    const m = P(C, 0, goalY + 5), u = P(C, 0, goalY + 4)
    x.save(); x.translate(m.x, m.y); x.scale(m.s, u.y - m.y)
    x.font = `6px ${DISPLAY}`; x.textAlign = 'center'; x.textBaseline = 'middle'
    const tw = x.measureText(f.word).width
    x.scale(Math.min(1.7, 40 / tw), 1); x.globalAlpha = 0.9; x.fillStyle = f.endText ?? '#fff'; x.fillText(f.word, 0, 0.4)
    x.restore()
  }
  // the chalk: the sidelines and the end line (the wide white border), the goal line, a line every five yards
  x.fillStyle = CHALK
  patch(x, C, -W - 0.7, near, -W, end + 0.7); patch(x, C, W, near, W + 0.7, end + 0.7); patch(x, C, -W - 0.7, end, W + 0.7, end + 0.7)
  across(x, C, -W, W, goalY, 0.24)
  for (let n = 5; goalY - n > near; n += 5) across(x, C, -W, W, goalY - n, 0.12)
  // the hash marks, a yard apart: the two rows inside (as wide apart as the uprights) and the two on the sidelines
  x.fillStyle = 'rgba(238,241,236,.86)'
  for (let n = 1; goalY - n > near; n++) {
    if (n % 5 === 0) continue
    const Y = goalY - n
    for (const s of [-1, 1]) { across(x, C, s * POST_HALF - 0.33, s * POST_HALF + 0.33, Y, 0.1); across(x, C, s * W - (s > 0 ? 0.7 : 0), s * W + (s > 0 ? 0 : 0.7), Y, 0.1) }
  }
  // the numbers: every ten yards, lying on the turf with their feet to the nearer sideline
  for (let n = 10; goalY - n > near + 1; n += 10) {
    const Y = goalY - n, label = String(n <= 50 ? n : 100 - n)
    for (const s of [-1, 1]) {
      const X = s * 15.6, o = P(C, X, Y), a = P(C, X, Y + s), b = P(C, X + s, Y)
      x.save(); x.transform(a.x - o.x, a.y - o.y, b.x - o.x, b.y - o.y, o.x, o.y)
      x.font = `2.6px ${DISPLAY}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(238,241,236,.8)'
      x.fillText(label[0], -1.05, 0); x.fillText(label[1], 1.05, 0)
      x.restore()
    }
  }
}
// The goalposts on the end line: the post behind it, curving forward to the middle of the bar, the bar ten feet up, the
// uprights 18 feet 6 apart and 35 feet above it
function posts(x, C, Y) {
  const foot = P(C, 0, Y + 2), bar = P(C, 0, Y, BAR_Z), l = P(C, -POST_HALF, Y, BAR_Z), r = P(C, POST_HALF, Y, BAR_Z), top = P(C, 0, Y, POST_TOP)
  const lw = Math.max(1.5, 0.16 * bar.s)
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round'
  x.fillStyle = '#20262c'; x.fillRect(foot.x - lw * 1.3, foot.y - 1.9 * foot.s, lw * 2.6, 1.9 * foot.s)
  x.strokeStyle = 'rgba(8,12,16,.55)'; x.lineWidth = lw + 1.4
  x.beginPath(); x.moveTo(l.x, top.y); x.lineTo(l.x, l.y); x.lineTo(r.x, r.y); x.lineTo(r.x, top.y); x.stroke()
  x.strokeStyle = POST; x.lineWidth = lw * 1.25
  x.beginPath(); x.moveTo(foot.x, foot.y - 1.9 * foot.s); x.quadraticCurveTo(foot.x, bar.y, bar.x, bar.y); x.stroke()
  x.lineWidth = lw
  x.beginPath(); x.moveTo(l.x, top.y); x.lineTo(l.x, l.y); x.lineTo(r.x, r.y); x.lineTo(r.x, top.y); x.stroke()
  x.restore()
}
// the ribbons on top of the uprights: which way the wind is blowing, and how hard
function ribbons(ctx, C, Y, blow, t) {
  for (const s of [-1, 1]) {
    const p = P(C, s * POST_HALF, Y, POST_TOP), len = (3 + Math.abs(blow) * 0.9) * Math.max(0.6, p.s / 7), dir = Math.sign(blow)
    const flap = Math.sin(t / 130 + s) * (blow ? 1.3 : 0.4)
    ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = Math.max(1.4, 0.22 * p.s); ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(p.x, p.y)
    if (dir) ctx.quadraticCurveTo(p.x + dir * len * 0.5, p.y + flap, p.x + dir * len, p.y + 1 - flap)
    else ctx.lineTo(p.x + flap * 0.6, p.y + len * 0.8)
    ctx.stroke(); ctx.lineCap = 'butt'
  }
}
const kOf = s => (MAN_YD * s) / MAN_UNITS
const LOOKS = { color: '', trim: '', pants: null, skin: '', number: null, dir: 'up', step: null, pose: null, carry: false, lift: 0, shadow: true }
// a man standing on the field at (X, Y) yards. lift: off the ground, in yards
function manAt(ctx, view, C, X, Y, look) {
  const p = P(C, X, Y), k = kOf(p.s)
  const L = Object.assign(LOOKS, { pants: null, number: null, dir: 'up', step: null, pose: null, carry: false, shadow: true }, look)
  L.lift = ((look.lift ?? 0) * p.s) / (k * 0.92)
  athleteAt(ctx, view, p.x, p.y, k, L)
  return p
}
// an official: the stripes and the cap over a plain white man
function refAt(ctx, view, C, X, Y, pose) {
  const p = manAt(ctx, view, C, X, Y, { color: '#eceae4', trim: '#eceae4', pants: '#1c1f22', skin: '#a87548', dir: 'down', pose }), k = kOf(p.s)
  ctx.fillStyle = '#16191c'
  for (let i = -1; i <= 1; i++) ctx.fillRect(p.x + i * 3.6 * k - 0.65 * k, p.y - 36.5 * k, 1.3 * k, 14 * k)
  ctx.fillRect(p.x - 4 * k, p.y - 47.2 * k, 8 * k, 2.8 * k)
}
// the ball somewhere over the field: its shadow on the turf under it, then the ball
function ballAt(ctx, C, X, Y, Z, opt) {
  const g0 = P(C, X, Y), p = P(C, X, Y, Z), len = Math.max(8, BALL_YD * 1.6 * p.s)
  ctx.fillStyle = `rgba(0,0,0,${(0.36 - Math.min(0.2, Z / 60)).toFixed(2)})`
  ctx.beginPath(); ctx.ellipse(g0.x, g0.y, Math.max(1.6, 0.26 * g0.s), Math.max(0.7, 0.07 * g0.s), 0, 0, Math.PI * 2); ctx.fill()
  airBall(ctx, p.x, p.y, { ...opt, len })
  return p
}
// ── THE METER ───────────────────────────────────────────────────────────────
// One bar for every kick: a dark track, the part to hit in green, the part to stay out of in red, the fill, and a gold mark
// with its number over it. zones: [from, to, colour] in 0-1 of the bar. value: where the fill or the needle is, 0-1.
function meter(ctx, view, y, { label, zones, value = null, needle = false, tone = '#e8eef0', mark = null, markText = null, dim = false }) {
  const bx = 46, bw = view.w - 92, bh = 10
  ctx.save(); if (dim) ctx.globalAlpha = 0.4
  ctx.fillStyle = 'rgba(6,10,13,.74)'; rr(ctx, bx - 10, y - 21, bw + 20, 44, 9); ctx.fill()
  text(ctx, label, bx, y - 10, { size: 11, align: 'left', track: 1.6, color: 'rgba(255,255,255,.72)' })
  ctx.fillStyle = '#1b242b'; rr(ctx, bx, y, bw, bh, bh / 2); ctx.fill()
  ctx.save(); rr(ctx, bx, y, bw, bh, bh / 2); ctx.clip()
  for (const [a, b, col] of zones) { ctx.fillStyle = col; ctx.fillRect(bx + a * bw, y, (b - a) * bw, bh) }
  if (value != null && !needle) { ctx.fillStyle = tone; ctx.fillRect(bx, y + 2.5, clamp(value, 0, 1) * bw, bh - 5) }
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1; rr(ctx, bx + 0.5, y + 0.5, bw - 1, bh - 1, bh / 2); ctx.stroke()
  if (mark != null) {
    const mx = bx + clamp(mark, 0, 1) * bw
    ctx.fillStyle = GOLD; ctx.fillRect(mx - 1, y - 3, 2, bh + 6)
    ctx.beginPath(); ctx.moveTo(mx - 4, y - 8); ctx.lineTo(mx + 4, y - 8); ctx.lineTo(mx, y - 3); ctx.closePath(); ctx.fill()
    if (markText) text(ctx, markText, clamp(mx, bx + 70, bx + bw - 22), y - 10, { size: 11, color: GOLD, track: 1.2 })
  }
  if (value != null && needle) { const nx = bx + clamp(value, 0, 1) * bw; ctx.fillStyle = 'rgba(8,12,16,.7)'; ctx.fillRect(nx - 3, y - 4, 6, bh + 8); ctx.fillStyle = '#fff'; ctx.fillRect(nx - 1.5, y - 3, 3, bh + 6) }
  ctx.restore()
}
// the dark strip the kick's own numbers sit on, at the top of the picture
function topStrip(ctx, view) {
  const g = ctx.createLinearGradient(0, 40, 0, 104)
  g.addColorStop(0, 'rgba(4,7,10,.62)'); g.addColorStop(1, 'rgba(4,7,10,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 40, view.w, 64)
}

const METER_UP = 172   // (the bar sits over the prompt, which sits over the pads)
function drawFG(ctx, g, view) {
  const c = view.colors, them = themOf(view), k = g.k, d = k.d
  const C = camFG(view, d), LOS = 7.5
  ctx.save()
  layer(ctx, view, `kick|fg|${d}|${c.us}|${them.color}`, x => {
    stands(x, view, 'field', [c.us, c.trim])
    paintGround(x, view, C, d - 10)
    x.fillStyle = '#3f86ff'; across(x, C, -FIELD_HALF, FIELD_HALF, LOS, 0.16)   // the line of scrimmage
    floodlight(x, view)
    posts(x, C, d)
  })
  const res = g.res, shown = res && g.t >= res.at ? res : null
  const snapped = g.phase !== 'set' && g.phase !== 'iced'
  const struck = !!g.ball, after = struck ? g.t - g.ball.at : -1
  // (the wind: the ball goes where he aimed less what the wind took, so a kick with k.wind above nothing is carried left)
  const blow = -k.wind
  if (shown?.good) crowdPop(ctx, view, [c.us, c.trim], g.t - shown.at, { power: g.winner ? 1.4 : 1 })
  ribbons(ctx, C, d, blow, g.t)
  // the officials under the uprights: both arms up, or the no-good wave
  const sig = !shown ? null : shown.good ? 'arms-up' : g.t - shown.at < 1100 ? ['wave-a', 'wave-m', 'wave-b', 'wave-m'][Math.floor((g.t - shown.at) / 130) % 4] : null
  for (const s of [-1, 1]) refAt(ctx, view, C, s * (POST_HALF + 1.1), d + 1.5, sig)
  // their rush, then our line and the two wings: a yard and a bit a man, on the ball
  const push = struck ? Math.min(1, after / 600) : 0
  for (let i = 0; i < 9; i++) {
    const wide = i === 0 || i === 8, jump = !wide && struck && !shown && Math.abs(i - 4) < 3
    manAt(ctx, view, C, (i - 4) * LINE_GAP + (wide ? Math.sign(i - 4) * 0.5 - Math.sign(i - 4) * push * 1.2 : 0), LOS + 0.95 - push * (wide ? 2.6 : 0.5), {
      color: them.color, trim: them.trim, skin: skinOf(i * 5 + 2), dir: 'down',
      lift: jump ? Math.sin(clamp(after / 520, 0, 1) * Math.PI) * 0.55 : 0,
      pose: shown ? (shown.good ? 'hips' : 'ready') : jump ? 'arms-up' : snapped ? 'block' : 'stance',
    })
  }
  for (let i = 0; i < 7; i++) manAt(ctx, view, C, (i - 3) * LINE_GAP, LOS - 0.55, { color: c.us, trim: c.trim, skin: skinOf(i * 3 + 1), pose: shown ? (shown.good ? 'arms-up' : 'hips') : 'block' })
  for (const s of [-1, 1]) manAt(ctx, view, C, s * (LINE_GAP * 3 + 1.25), LOS - 1.5, { color: c.us, trim: c.trim, skin: skinOf(8 + s), pose: shown ? (shown.good ? 'arms-up' : 'hips') : 'block' })
  // ── where he's aiming: a line on the grass from the ball, and a sight standing where it ends. The green between the
  // marks is where to put it: the uprights, moved over by what the wind will take back ──
  if (!struck && (g.phase === 'aim' || g.phase === 'power' || g.phase === 'run')) {
    const K = d * AIM_SPAN * g.accF / (k.tight ?? 1)          // yards at the uprights for the whole of the needle's swing one way
    const n = g.aimAt ?? g.needle(), ax = n * K, wx = g.centre() * K, inside = Math.abs(n - g.centre()) <= g.half()
    const wl = P(C, wx - POST_HALF, d, BAR_Z), wr = P(C, wx + POST_HALF, d, BAR_Z), wt = P(C, wx, d, POST_TOP)
    ctx.fillStyle = 'rgba(53,224,122,.24)'; ctx.fillRect(wl.x, wt.y, wr.x - wl.x, wl.y - wt.y)
    ctx.fillStyle = 'rgba(53,224,122,.55)'; ctx.fillRect(wl.x, wl.y - 1, wr.x - wl.x, 2)
    const a = P(C, 0, 0), b = P(C, ax, d), bt = P(C, ax, d, POST_TOP + 1.5), col = inside ? GOOD : '#fff'
    ctx.strokeStyle = 'rgba(8,12,16,.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle = 'rgba(8,12,16,.55)'; ctx.fillRect(b.x - 2, bt.y, 4, b.y - bt.y)
    ctx.fillStyle = col; ctx.fillRect(b.x - 1, bt.y, 2, b.y - bt.y)
    ctx.beginPath(); ctx.moveTo(b.x - 5, bt.y - 7); ctx.lineTo(b.x + 5, bt.y - 7); ctx.lineTo(b.x, bt.y); ctx.closePath(); ctx.fill()
  }
  // the holder, on a knee beside the spot with a finger on the ball, and the ball stood up under it
  if (shown) manAt(ctx, view, C, 0.95, 0.1, { color: c.us, trim: c.trim, skin: skinOf(4), pose: shown.good ? 'arms-up' : 'hips' })
  else manAt(ctx, view, C, 0.78, 0.05, { color: c.us, trim: c.trim, skin: skinOf(4), dir: 'left', pose: struck ? 'held' : 'hold' })
  if (!struck) ballAt(ctx, C, 0, 0, 0.19, { ang: Math.PI / 2 })
  // the kicker: three steps back and two over, the run, the leg through the ball
  const run = g.phase === 'run' ? prog(g.t, g.at, g.at + RUN_MS) : struck ? 1 : 0, e = easeOut(run)
  manAt(ctx, view, C, lerp(-1.9, -0.42, e), lerp(-3.1, -0.3, e), {
    color: c.us, trim: c.trim, skin: view.cast?.me?.skin ?? skinOf(1), number: view.cast?.me?.number ?? 4,
    step: g.phase === 'run' && run < 0.72 ? Math.floor(run * 5) % 4 : null,
    pose: shown ? (shown.good ? 'arms-up' : 'hips') : after >= 0 && after < 380 ? 'kick-thru' : g.phase === 'run' ? (run < 0.72 ? 'sprint' : 'kick-load') : null,
  })
  // the ball in the air: end over end, up over the line and on to the uprights (or short of them)
  if (struck) {
    const b = g.ball, T = b.T, u = (g.t - b.at) / T, sgn = Math.sign(b.yards) || 1
    const xd = res?.doink ? sgn * POST_HALF : b.yards             // where it is as it reaches the uprights
    let X, Y, Z
    if (b.long) {
      const h = Math.max(12, d * 0.24), z = v => 4 * h * v * (1 - v), w = Math.max(0, u - 1)
      if (u <= 1 || !res?.doink) { Y = d * Math.min(u, 1.14); X = xd * Math.pow(Y / d, 1.3); Z = Math.max(0, z(Math.min(u, 1.14) / 1.14)) }
      // off the upright: half of them fall through, half come back out
      else if (res.good) { Y = d + 5 * w; X = xd - sgn * 3.4 * w; Z = Math.max(0, z(1 / 1.14) - 9 * w * w) }
      else { Y = d - 6 * w; X = xd + sgn * 2.4 * w; Z = Math.max(0, z(1 / 1.14) + 3 * w - 14 * w * w) }
    } else {
      const land = (b.land - b.at) / T, v = Math.min(1, u / land), w = clamp((u - land) * T / 700, 0, 1), h = Math.max(3.5, b.carry * 0.17)
      Y = b.carry * v + 2.6 * w; X = b.yards * Math.pow(Y / d, 1.3); Z = v < 1 ? 4 * h * v * (1 - v) : hop(w * 700, 290, 0.9) * (1 - w)
    }
    const th = ((g.t - b.at) / 1000) * Math.PI * 2 * 3.6, lat = clamp(b.yards / d, -0.3, 0.3)
    ballAt(ctx, C, X, Y, Z, { axis: [lat * Math.cos(th), Math.cos(th), Math.sin(th)] })
  }
  ctx.restore()
  // ── what he's looking at: the distance, the wind ──
  topStrip(ctx, view)
  const top = 58
  text(ctx, `${d}`, 14, top + 12, { font: DISPLAY, size: 34, align: 'left' })
  text(ctx, 'YARDS', 14 + (d >= 60 ? 40 : 38), top + 19, { size: 13, align: 'left', track: 1.4, color: 'rgba(255,255,255,.82)' })
  text(ctx, blow === 0 ? 'NO WIND' : `WIND ${Math.abs(blow)} MPH`, view.w - 14, top + 5, { size: 13, align: 'right', track: 1.4, color: 'rgba(255,255,255,.86)' })
  if (blow) { const ax = view.w - 36, ay = top + 22, s = Math.sign(blow); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax - s * 15, ay); ctx.lineTo(ax + s * 15, ay); ctx.moveTo(ax + s * 8, ay - 6); ctx.lineTo(ax + s * 15, ay); ctx.lineTo(ax + s * 8, ay + 6); ctx.stroke(); ctx.lineCap = 'butt' }
  // the power: up to the mark and no further than the top of the bar
  if (!struck && !g.done && (g.phase === 'aim' || g.phase === 'power' || g.phase === 'run')) {
    const need = g.need(), p = g.pow ?? (g.phase === 'power' ? g.power() : null)
    meter(ctx, view, view.h - METER_UP, {
      label: 'POWER', dim: g.phase === 'aim',
      zones: [...(need < 1 ? [[need / OVER, 1 / OVER, 'rgba(53,224,122,.34)']] : []), [1 / OVER, 1, 'rgba(255,90,72,.5)']],
      value: p == null ? null : p / OVER, tone: p == null ? '#e8eef0' : p > 1 ? BAD : p >= need ? GOOD : '#e8eef0',
      mark: Math.min(1, need / OVER), markText: need > 1 ? 'PAST HIS RANGE' : `${d} YD`,
    })
  }
  vignette(ctx, view)
}

// ── THE ONSIDE KICK ─────────────────────────────────────────────────────────
const ON_SET = 1100, ON_RING = 760, ON_ROLL = 1500, ON_HOP = 1250, ON_RES = 1700
function makeOnside({ v, seed, kick = null, situation = null }) {
  const r = rngOf(seed)
  const acc = kick?.accuracy ?? v, clu = kick?.clutch ?? v
  const base = onsideP({ accuracy: acc, clutch: clu })
  const side = r() < 0.5 ? -1 : 1                       // which side the kick goes to
  const distMs = byV(acc, 760, 980)                     // the distance bar: once up and back
  const g = {
    t: 0, game: 'onside', zones: 'none', pads: ['KICK'], padLit: null, fx: [], done: null, outro: 1900, stamp: null, nudge: nudge(),
    phase: 'set', at: 0, side, base, dist: null, strike: null, leap: null, q: 0, res: null, sit: situation ?? null,
    hud: { prompt: null, dots: [] },
    // the distance bar: 4 to 22 yards. The kick has to go 10; past 15 it carries to the second row, who catch it
    yards() { const f = (((g.t - g.at) / distMs) % 2 + 2) % 2; return 4 + (f < 1 ? f : 2 - f) * 18 },
    // the strike ring and the leap ring: 1 wide open, 0 closed. Press at 0
    ring() { return clamp(1 - (g.t - g.at) / ON_RING, -0.4, 1) },
    hopAt() { return g.at + ON_HOP * 0.78 },             // when the ball is back down to a man's reach
    tick(dt) {
      g.t += dt
      if (g.padLit != null && g.t - g.litAt > 120) g.padLit = null
      if (g.done && g.phase === 'over') return
      if (g.phase === 'set') { if (g.t - g.at >= ON_SET) { g.phase = 'dist'; g.at = g.t; g.hud.prompt = 'PRESS TO SET THE DISTANCE' } return }
      // (a ring nobody pressed closes on its own: a late strike, a man who never went up)
      if (g.phase === 'strike' && g.ring() <= -0.4) setStrike(-0.4)
      if (g.phase === 'roll' && g.t - g.at >= ON_ROLL) { if (g.legal) { g.phase = 'hop'; g.at = g.t; g.hud.prompt = 'PRESS TO GO UP FOR IT' } else settle() }
      if (g.phase === 'hop' && g.t - g.at >= ON_HOP) settle()
      if (g.phase === 'res' && g.t - g.at >= ON_RES) g.phase = 'over'
    },
    input(a) {
      if (a.kind !== 'down' || g.done) return
      g.padLit = 0; g.litAt = g.t
      if (g.phase === 'dist') { g.dist = g.yards(); g.phase = 'strike'; g.at = g.t; g.hud.prompt = 'PRESS AS THE RING CLOSES'; g.fx.push('tap'); return }
      if (g.phase === 'strike') { setStrike(g.ring()); return }
      if (g.phase === 'hop' && g.leap == null) { g.leap = (g.t - g.hopAt()) / 1000; g.hud.prompt = null; g.fx.push('h:light') }
    },
  }
  function setStrike(ring) {
    g.strike = ring; g.phase = 'roll'; g.at = g.t; g.hud.prompt = null
    // legal: it went its 10 yards (short, and the kicking team can't touch it first)
    g.legal = g.dist >= 10
    g.fx.push('swoosh'); g.nudge.kick(g.t, 1.3, 0, -1, 140)
  }
  function settle() {
    // how well it was kicked, 0-1: the distance (10 to 13 is the kick; every yard past it is a yard closer to their
    // second row), the strike (on the top of the ball: the hop is high and hangs), the leap (up as it comes down)
    const dq = !g.legal ? 0 : g.dist <= 13 ? 1 : clamp(1 - (g.dist - 13) / 5, 0, 1)
    const sq = clamp(1 - Math.abs(g.strike ?? -0.4) / 0.3, 0, 1)
    const lq = g.leap == null ? 0 : clamp(1 - Math.abs(g.leap) / 0.22, 0, 1)
    const q = g.legal ? dq * (0.45 * sq + 0.3 * lq + 0.25) : 0
    g.q = q
    // and then it's a football bouncing off the turf into ten men
    const p = g.legal ? base * (0.3 + 1.05 * q) : 0
    const got = r() < p
    g.res = { got, at: g.t, p, why: !g.legal ? 'short' : got ? 'got' : g.dist > 15.5 ? 'deep' : 'theirs' }
    g.stamp = { text: got ? 'RECOVERED' : !g.legal ? 'SHORT OF 10 YARDS' : 'THEY HAVE IT', good: got, at: g.t, size: got ? 46 : 34 }
    g.fx.push(got ? 'claim' : 'deny', got ? 'h:success' : 'h:medium')
    g.phase = 'res'; g.at = g.t; g.hud.prompt = null
    g.done = outcome(got ? 1 : q * 0.3, got, got ? 'Recovered the onside kick' : !g.legal ? 'The kick didn’t go 10 yards' : 'The hands team fell on it', Math.round(p * 1000) / 10)
  }
  return g
}

function drawOnside(ctx, g, view) {
  const c = view.colors, them = themOf(view), C = camOnside(view)
  ctx.save()
  // the ball on the 34: their goal line is 66 yards up the field
  layer(ctx, view, `kick|onside|${c.us}|${them.color}`, x => {
    stands(x, view, 'field', [c.us, c.trim])
    paintGround(x, view, C, 66)
    // ten yards from the tee: the line the ball has to cross before the kicking team can touch it
    x.fillStyle = '#f7d64a'; across(x, C, -FIELD_HALF, FIELD_HALF, 10, 0.2)
    floodlight(x, view)
  })
  const res = g.res, kicked = g.strike != null
  if (kicked && g.rollAt == null) g.rollAt = g.t
  const since = kicked ? g.t - g.rollAt : 0
  const side = g.side, dist = g.dist ?? 12
  // where the ball is headed: up the field and toward the sideline
  const tx = side * (3.5 + dist * 0.25), ty = dist
  const roll = kicked ? prog(g.t, g.rollAt, g.rollAt + ON_ROLL) : 0
  const inHop = g.phase === 'hop' || (g.phase === 'res' && g.legal)
  const hopF = g.phase === 'hop' ? prog(g.t, g.at, g.at + ON_HOP) : inHop ? 1 : 0
  const bX = lerp(0, tx, roll) + (inHop ? side * 0.9 * hopF : 0), bY = lerp(0, ty, roll) + (inHop ? 1.2 * hopF : 0)
  // two skips along the ground, then the hop: higher the nearer the strike was to the top of the ball
  const sq = clamp(1 - Math.abs(g.strike ?? 0) / 0.3, 0, 1)
  const bZ = !kicked ? 0.2 : g.phase === 'roll' ? 0.16 + hop(roll * ON_ROLL, ON_ROLL / 2.2, 0.5) * (1 - roll * 0.3) : g.phase === 'hop' ? 0.16 + Math.sin(hopF * Math.PI) * lerp(1.7, 3.8, sq) : 0.16
  if (res?.got) crowdPop(ctx, view, [c.us, c.trim], g.t - res.at, { power: 1.4 })
  // the way it's going and how far, on the grass, while he sets it
  if (g.phase === 'dist' || g.phase === 'strike') {
    const y = g.dist ?? g.yards(), a = P(C, 0, 0), b = P(C, side * (3.5 + y * 0.25), y), ok = y >= 10 && y <= 13
    ctx.strokeStyle = 'rgba(8,12,16,.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    ctx.strokeStyle = ok ? GOOD : y < 10 ? BAD : '#fff'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.ellipse(b.x, b.y, Math.max(3, 0.5 * b.s), Math.max(1.2, 0.16 * b.s), 0, 0, Math.PI * 2); ctx.fill()
  }
  // their hands team: a second row back, a front row just past the yellow line. They close on the ball
  const gather = g.phase === 'hop' ? easeOut(hopF) : g.phase === 'res' ? 1 : roll * 0.35
  for (let i = 0; i < 4; i++) manAt(ctx, view, C, (i - 1.5) * 6, 18, { color: them.color, trim: them.trim, skin: skinOf(i * 7 + 3), dir: 'down', pose: res ? (res.got ? 'hips' : 'ready') : 'ready' })
  for (let i = 0; i < 6; i++) {
    const X = lerp((i - 2.5) * 3.2, tx + side * 0.9 + (i - 2.5) * 0.75, gather * 0.85), Y = lerp(11.6, ty + 2 + Math.abs(i - 2.5) * 0.25, gather * 0.85)
    manAt(ctx, view, C, X, Y, { color: them.color, trim: them.trim, skin: skinOf(i * 5 + 2), dir: 'down', step: g.phase === 'hop' ? Math.floor(g.t / 90 + i) % 4 : null, pose: res ? (res.got ? 'hips' : i === 3 ? 'wrap' : 'ready') : g.phase === 'hop' ? 'sprint' : 'ready' })
  }
  // the ball (their man has it under him once it's theirs)
  let q = null
  if (!res || res.why === 'short') q = ballAt(ctx, C, bX, bY, bZ, kicked ? { ang: g.t / 70 } : { ang: Math.PI / 2 })
  else q = P(C, bX, bY, bZ)
  // the kicking team: five on each side of the ball, on the line, no running start; they go when it's kicked
  const cover = kicked ? easeOut(prog(g.t, g.rollAt, g.rollAt + ON_ROLL + ON_HOP * 0.7)) : 0
  for (let i = 0; i < 10; i++) {
    const right = i >= 5, j = right ? i - 5 : 4 - i, s = right ? 1 : -1, near = s === side
    const x0 = s * (2.7 + j * 2.2), up = near && j === 0   // (up: the man who goes for it)
    const X = lerp(x0, near ? tx - side * (0.8 + j * 1.2) : x0 + side * 4.5, cover), Y = lerp(-0.7, near ? ty - 1.1 - j * 0.35 : 6, cover)
    manAt(ctx, view, C, X, Y, {
      color: c.us, trim: c.trim, skin: skinOf(i * 3 + 1), step: kicked && !res ? Math.floor(g.t / 85 + i) % 4 : null,
      lift: up && g.phase === 'hop' && g.leap != null ? Math.sin(clamp((g.t - (g.hopAt() + g.leap * 1000)) / 420, 0, 1) * Math.PI) * 0.75 : 0,
      carry: !!res?.got && up, pose: res ? (res.got ? (up ? null : 'arms-up') : 'hips') : kicked ? 'sprint' : 'stance',
    })
  }
  // the kicker, coming at it from the side away from the kick
  manAt(ctx, view, C, kicked ? -side * 0.45 : -side * 1.1, kicked ? -0.3 : -2.6, { color: c.us, trim: c.trim, skin: view.cast?.me?.skin ?? skinOf(1), number: view.cast?.me?.number ?? 4, pose: res ? (res.got ? 'arms-up' : 'hips') : kicked && since < 380 ? 'kick-thru' : null })
  ctx.restore()
  // ── the bar and the rings ──
  if (g.phase === 'dist' || (g.phase === 'strike' && g.dist != null)) {
    const at = yd => (yd - 4) / 18
    meter(ctx, view, view.h - METER_UP, {
      label: 'DISTANCE', needle: true, value: at(g.dist ?? g.yards()),
      zones: [[0, at(10), 'rgba(255,90,72,.5)'], [at(10), at(13), GOOD], [at(13), at(18), 'rgba(53,224,122,.3)']],   // short of 10: no good. 10 to 13: the kick. Past it: carries to their second row
      mark: at(10), markText: '10 YD',
    })
  }
  const ring = (x, y, r0, open) => {
    ctx.strokeStyle = 'rgba(8,12,16,.55)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, r0 + open, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r0 + open, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = GOOD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r0, 0, Math.PI * 2); ctx.stroke()
  }
  // the ring closing on the top of the ball, and the one on it as it comes down
  if (g.phase === 'strike') { const p = P(C, 0, 0, 0.3); ring(p.x, p.y, 8, Math.max(0, g.ring()) * 34) }
  if (g.phase === 'hop' && g.leap == null) ring(q.x, q.y, 10, clamp((g.hopAt() - g.t) / (ON_HOP * 0.78), 0, 1) * 38)
  topStrip(ctx, view)
  text(ctx, 'DECLARED · BALL ON THE 34', 14, 64, { size: 13, align: 'left', track: 1.4, color: 'rgba(255,255,255,.86)' })
  vignette(ctx, view)
}
