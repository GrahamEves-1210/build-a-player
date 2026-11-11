// The kicker's three, through the broadcast camera (art.js), on the numbers in lib/kicks.js.
//
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
import { tilt, untilt, ground, stands, floodlight, vignette, athlete, skinOf, goalPosts, airBall, ballShadow, crowdPop } from './art.js'
import { paintFieldFlat, SL, SR, flightAt, official, hop } from './throw.js'
import { kickReach, onsideP } from '../kicks.js'

export const how = {
  'deep-kick': 'Four kicks, each one longer. Press once to stop the needle in the green: that is the uprights, and the wind moves it. Press again to stop the power past the mark. Over the top of the bar is an overswing, and it hooks.',
  'game-winner': 'One kick for the game. Press to stop the needle in the green, then press to stop the power past the mark. If they call timeout to ice him, do it again.',
  onside: 'They need the ball back. Press to set the distance: it has to go 10 yards. Press as the ring closes to drive the top of the ball into the turf. Press again as it comes down to go up for it. It rarely works.',
}

const XYD = (SR - SL) / 53.33          // flat units a yard, across the field
const POST_HALF = 3.083                // half the width of the uprights, yards (18 feet 6 inches)
const AIM_SPAN = 0.30                  // the aim bar from end to end, as an angle: at 50 yards the ends are 15 yards wide
const OVER = 1.15                      // the power bar runs to 115%: the last of it is the overswing
const SET_MS = 950, RUN_MS = 430, RES_MS = 1500, ICE_MS = 1500
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
    aim: null, pow: null, res: null, ball: null, k: kicks[0], noise: 0, noiseAt: 0,
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
      // (the shake: a new lean every 90 ms, seeded, so the same game shakes the same way)
      if (shake && g.phase === 'aim' && g.t - g.noiseAt >= 90) { g.noiseAt = g.t; g.noise = gaussOf(r) * shake * 0.5 }
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
        g.aim = g.needle(); g.phase = 'power'; g.at = g.t; g.hud.prompt = 'PRESS TO SET THE POWER'; g.fx.push('tap'); return
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
    const off = (g.aim - g.centre()) * accF + over * 3.2 * (r() < 0.5 ? -1 : 1)
    const yards = off * k.d * AIM_SPAN / (k.tight ?? 1)                   // wide of the middle of the uprights, at the uprights
    const carry = Math.min(g.pow, 1.06) * reach + (Math.abs(off) < windowOf(k.d) * 0.2 ? 1.5 : 0)   // (a pure strike carries a little more)
    const long = carry >= k.d
    const edge = Math.abs(yards) - POST_HALF
    // off the upright: half of them carom through
    const doink = long && Math.abs(edge) < 0.22
    const good = long && (edge < -0.22 || (doink && r() < 0.5))
    const why = good ? (doink ? 'doink-in' : 'good') : !long ? 'short' : doink ? 'doink' : yards < 0 ? 'left' : 'right'
    const T = 1250 + k.d * 16
    g.ball = { at: g.t, land: g.t + (long ? T : T * clamp(carry / k.d, 0.45, 1) * 0.92), yards, carry, long }
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
    g.i++; g.k = kicks[g.i]; g.aim = null; g.pow = null; g.res = null; g.ball = null; g.stamp = null; g.phase = 'set'; g.at = g.t; g.hud.prompt = null
  }
  function finish() {
    if (winner) { g.done = outcome(g.made ? 1 : g.near ? 0.3 : 0, g.made === 1, g.made ? `Good from ${kicks[0].d}` : `No good from ${kicks[0].d}`, kicks[0].d); return }
    // two of four from 50 and out is a kicker's day; the near misses count a little toward the score, never the result
    const score = clamp((g.made + g.near * 0.25) / 4 + (g.made >= 2 ? 0.25 : 0), 0, 1)
    g.done = outcome(score, g.made >= 2, `${g.made} of 4 from 50+`, g.made)
  }
  g.at = 0
  return g
}

// the flat field for a kick: where the ball is spotted, where the uprights stand, how long a yard is
function fgLay(view, d) {
  const spot = Math.round(untilt(view, 180, view.h - 266).y), back = 26
  const pyd = Math.min(14, (spot - back) / d)
  return { spot, pyd, back: spot - d * pyd, goal: spot - (d - 10) * pyd }
}
const O = { color: '', trim: '', pants: null, skin: '', number: null, dir: 'up', step: null, kit: 'pads', carry: false, size: 1, pose: null, fall: 0, fallX: 0, squat: 0, lift: 0 }
const man = (ctx, view, x, y, look) => athlete(ctx, view, x, y, Object.assign(O, { number: null, dir: 'up', step: null, carry: false, size: 0.86, pose: null, fall: 0, fallX: 0, squat: 0, lift: 0 }, look))

function drawFG(ctx, g, view) {
  const c = view.colors, them = themOf(view), k = g.k
  const L = fgLay(view, k.d)
  ctx.save()
  layer(ctx, view, `kick|fg|${k.d}|${c.us}|${them.color}`, x => {
    stands(x, view, 'field', [c.us, c.trim])
    const hy = tilt(view, 0, 0).y
    ground(x, view, f => {
      paintFieldFlat(f, view, L.goal, L.pyd, c.us)
      // the line of scrimmage, seven and a half yards in front of the spot
      f.fillStyle = '#3f86ff'; f.fillRect(SL, L.spot - 7.5 * L.pyd - 1.4, SR - SL, 2.8)
    }, `flat|kick|${k.d}|${c.us}`, 0, Math.round((view.h - hy) * view.px * 0.7))
    goalPosts(x, view, L.back)
    floodlight(x, view)
  })
  const res = g.res, shown = res && g.t >= res.at ? res : null
  const snapped = g.phase !== 'set' && g.phase !== 'iced'
  const struck = !!g.ball
  // the crowd behind the uprights gets up for a make
  if (shown?.good) crowdPop(ctx, view, [c.us, c.trim], g.t - shown.at, { power: g.winner ? 1.4 : 1 })
  // the officials under the uprights: both arms up, or nothing
  for (const s of [-1, 1]) official(ctx, view, 180 + s * 34, L.back + 4, shown?.good ? 'arms-up' : null, null)
  // their rush and our line, on the ball
  const los = L.spot - 7.5 * L.pyd, rushIn = struck ? Math.min(1, (g.t - g.ball.at) / 700) : 0
  for (let i = 0; i < 7; i++) {
    const x = 180 + (i - 3) * 15
    man(ctx, view, x + (i - 3) * rushIn * 2, los - 1.3 * L.pyd + rushIn * 1.6 * L.pyd, { color: them.color, trim: them.trim, skin: skinOf(i * 5 + 2), dir: 'down', size: 0.8, pose: shown ? (shown.good ? 'hips' : 'ready') : snapped ? 'block' : 'stance' })
  }
  for (let i = 0; i < 7; i++) man(ctx, view, 180 + (i - 3) * 15, los + 0.5 * L.pyd, { color: c.us, trim: c.trim, skin: skinOf(i * 3 + 1), size: 0.8, pose: shown ? (shown.good ? 'ready' : 'hips') : 'block' })
  for (const s of [-1, 1]) man(ctx, view, 180 + s * 62, los + 1.4 * L.pyd, { color: c.us, trim: c.trim, skin: skinOf(8 + s), size: 0.8, pose: shown && !shown.good ? 'hips' : 'block' })
  // the ball in the air, behind the line and over it
  let air = null
  if (struck) {
    const b = g.ball, f = prog(g.t, b.at, b.land)
    const tx = 180 + b.yards * XYD * (b.long ? 1.12 : clamp(b.carry / k.d, 0.4, 1))
    const ty = b.long ? L.back - 6 * L.pyd : L.spot - b.carry * L.pyd
    if (f < 1) {
      air = flightAt(view, 180, L.spot, tx, ty, f, (b.long ? 0.3 : 0.2) * k.d * L.pyd)
      ballShadow(ctx, view, air.gx, air.gy, air.lift)
    } else if (!b.long) { const q = tilt(view, tx, ty); airBall(ctx, q.x, q.y - 3 * q.s, { len: 9 * q.s }) }
  }
  // the holder and the kicker
  const run = g.phase === 'run' ? prog(g.t, g.at, g.at + RUN_MS) : struck ? 1 : 0
  man(ctx, view, 180 + 9, L.spot + 3, { color: c.us, trim: c.trim, skin: skinOf(4), dir: 'left', squat: 0.62, size: 0.84, pose: shown ? (shown.good ? 'arms-up' : 'hips') : 'ready' })
  if (!struck) { const q = tilt(view, 180 + 2, L.spot + 1); airBall(ctx, q.x, q.y - 5.5 * q.s, { ang: Math.PI / 2, len: 9 * q.s }) }
  const kx = lerp(180 - 22, 180 - 6, easeOut(run)), ky = lerp(L.spot + 30, L.spot + 5, easeOut(run))
  const after = struck ? g.t - g.ball.at : -1
  man(ctx, view, kx, ky, {
    color: c.us, trim: c.trim, skin: view.cast?.me?.skin ?? skinOf(1), number: view.cast?.me?.number ?? 4, size: 0.92, still: true,
    step: g.phase === 'run' ? Math.floor(run * 4) % 4 : null,
    pose: shown ? (shown.good ? 'arms-up' : 'hips') : after >= 0 && after < 420 ? 'plant-l' : g.phase === 'run' ? 'sprint' : 'ready',
  })
  if (air) airBall(ctx, air.x, air.y, { axis: air.axis, len: air.len, spin: ((g.t - g.ball.at) / 1000) * 5.5 })
  ctx.restore()
  // ── what he's looking at: the distance, the wind, the two bars ──
  const top = 58
  text(ctx, `${k.d}`, 14, top + 14, { font: DISPLAY, size: 40, align: 'left' })
  text(ctx, 'YARDS', 16 + (k.d >= 60 ? 46 : 44), top + 22, { size: 14, align: 'left', track: 1.2, color: 'rgba(255,255,255,.8)' })
  const w = k.wind
  text(ctx, w === 0 ? 'NO WIND' : `WIND ${Math.abs(w)} MPH`, view.w - 14, top + 6, { size: 14, align: 'right', track: 1.2, color: 'rgba(255,255,255,.85)' })
  if (w) { const ax = view.w - 40, ay = top + 26, s = Math.sign(w); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax - s * 16, ay); ctx.lineTo(ax + s * 16, ay); ctx.moveTo(ax + s * 9, ay - 6); ctx.lineTo(ax + s * 16, ay); ctx.lineTo(ax + s * 9, ay + 6); ctx.stroke(); ctx.lineCap = 'butt' }
  if (g.phase === 'set' || g.phase === 'iced' || g.done) { vignette(ctx, view); return }
  const bx = 34, bw = view.w - 68, mid = bx + bw / 2
  // the aim bar
  const ay = view.h - 96 - 124
  ctx.fillStyle = 'rgba(6,10,12,.78)'; rr(ctx, bx - 8, ay - 22, bw + 16, 92, 6); ctx.fill()
  text(ctx, 'AIM', bx, ay - 10, { size: 12, align: 'left', track: 1.4, color: 'rgba(255,255,255,.7)' })
  ctx.fillStyle = '#243038'; rr(ctx, bx, ay, bw, 14, 3); ctx.fill()
  const cx = mid + g.centre() * bw / 2, hw = g.half() * bw / 2
  ctx.fillStyle = GOOD; ctx.fillRect(Math.max(bx, cx - hw), ay, Math.min(bx + bw, cx + hw) - Math.max(bx, cx - hw), 14)
  // the uprights, standing on the green
  ctx.strokeStyle = '#f2d21f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - hw, ay - 9); ctx.lineTo(cx - hw, ay - 1); ctx.lineTo(cx + hw, ay - 1); ctx.lineTo(cx + hw, ay - 9); ctx.stroke()
  const nx = mid + (g.aim ?? g.needle()) * bw / 2
  ctx.fillStyle = '#fff'; ctx.fillRect(nx - 2, ay - 5, 4, 24)
  // the power bar
  const py = ay + 38
  text(ctx, 'POWER', bx, py - 10, { size: 12, align: 'left', track: 1.4, color: 'rgba(255,255,255,.7)' })
  ctx.fillStyle = '#243038'; rr(ctx, bx, py, bw, 14, 3); ctx.fill()
  const need = g.need(), x100 = bx + bw / OVER
  if (need < 1) { ctx.fillStyle = 'rgba(53,224,122,.38)'; ctx.fillRect(bx + (need / OVER) * bw, py, x100 - (bx + (need / OVER) * bw), 14) }
  ctx.fillStyle = 'rgba(255,90,72,.5)'; ctx.fillRect(x100, py, bx + bw - x100, 14)
  if (g.phase === 'power' || g.pow != null) { const p = g.pow ?? g.power(); ctx.fillStyle = p > 1 ? BAD : p >= need ? GOOD : '#e8eef0'; ctx.fillRect(bx, py + 3, (p / OVER) * bw, 8) }
  // the mark: what this kick needs
  const mx = bx + Math.min(1, need / OVER) * bw
  ctx.fillStyle = GOLD; ctx.fillRect(mx - 1.5, py - 4, 3, 22)
  text(ctx, need > 1 ? 'PAST HIS RANGE' : `${k.d}`, clamp(mx, bx + 16, bx + bw - 44), py + 27, { size: 12, color: GOLD, track: 1 })
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
  const c = view.colors, them = themOf(view)
  // the flat field: the ball on the 34, the far end of the picture about 24 yards up the field
  const tee = Math.round(untilt(view, 180, view.h - 258).y), pyd = (tee - 20) / 24
  ctx.save()
  layer(ctx, view, `kick|onside|${c.us}|${them.color}`, x => {
    stands(x, view, 'field', [c.us, c.trim])
    const hy = tilt(view, 0, 0).y
    ground(x, view, f => {
      paintFieldFlat(f, view, tee - 66 * pyd, pyd, c.us)
      // ten yards from the tee: the line the ball has to cross before the kicking team can touch it
      f.fillStyle = '#f7d64a'; f.fillRect(SL, tee - 10 * pyd - 1.5, SR - SL, 3)
    }, `flat|kick|onside|${c.us}`, 0, Math.round((view.h - hy) * view.px * 0.7))
    floodlight(x, view)
  })
  const res = g.res, kicked = g.strike != null, since = kicked ? g.t - (g.phase === 'roll' ? g.at : g.rollAt ?? g.at) : 0
  if (kicked && g.rollAt == null) g.rollAt = g.t
  const side = g.side, dist = g.dist ?? 12
  // where the ball is headed: up the field and toward the sideline
  const bx1 = 180 + side * (58 + dist * 3.2), by1 = tee - dist * pyd
  const roll = kicked ? prog(g.t, g.rollAt, g.rollAt + ON_ROLL) : 0
  const inHop = g.phase === 'hop' || (g.phase === 'res' && g.legal)
  const hopF = g.phase === 'hop' ? prog(g.t, g.at, g.at + ON_HOP) : inHop ? 1 : 0
  const ballX = lerp(180, bx1, roll) + (inHop ? side * 6 * hopF : 0), ballY = lerp(tee, by1, roll) - (inHop ? 1.2 * pyd * hopF : 0)
  // two skips along the ground, then the hop: higher the nearer the strike was to the top of the ball
  const sq = clamp(1 - Math.abs(g.strike ?? 0) / 0.3, 0, 1)
  const lift = !kicked ? 0 : g.phase === 'roll' ? hop(roll * ON_ROLL, ON_ROLL / 2.2, 9) * (1 - roll * 0.3) : g.phase === 'hop' ? Math.sin(hopF * Math.PI) * lerp(34, 92, sq) : 0
  if (res?.got) crowdPop(ctx, view, [c.us, c.trim], g.t - res.at, { power: 1.4 })
  // their hands team: a front row on the yellow line and a second row behind it
  const gather = g.phase === 'hop' ? easeOut(hopF) : g.phase === 'res' ? 1 : roll * 0.35
  const their = i => { const fx = 180 + (i - 2.5) * 44, fy = tee - 11.5 * pyd; return [lerp(fx, bx1 + (i - 2.5) * 7, gather * 0.85), lerp(fy, by1 - 0.8 * pyd + Math.abs(i - 2.5) * 2, gather * 0.85)] }
  for (let i = 0; i < 4; i++) man(ctx, view, 180 + (i - 1.5) * 70, tee - 17 * pyd, { color: them.color, trim: them.trim, skin: skinOf(i * 7 + 3), dir: 'down', size: 0.78, pose: res ? (res.got ? 'hips' : 'ready') : 'ready' })
  for (let i = 0; i < 6; i++) { const [x, y] = their(i); man(ctx, view, x, y, { color: them.color, trim: them.trim, skin: skinOf(i * 5 + 2), dir: 'down', size: 0.82, step: g.phase === 'hop' ? Math.floor(g.t / 90 + i) % 4 : null, pose: res ? (res.got ? 'hips' : i === 3 ? 'wrap' : 'ready') : g.phase === 'hop' ? 'sprint' : 'ready' }) }
  // the ball
  const q = tilt(view, ballX, ballY)
  ballShadow(ctx, view, ballX, ballY, lift)
  if (!res || res.why === 'short') airBall(ctx, q.x, q.y - (lift + 4) * q.s, { ang: kicked ? g.t / 70 : Math.PI / 2, len: 10 * q.s })
  // the kicking team: five on each side of the ball, on the line, no running start; they go when it's kicked
  const cover = kicked ? easeOut(prog(g.t, g.rollAt, g.rollAt + ON_ROLL + ON_HOP * 0.7)) : 0
  for (let i = 0; i < 10; i++) {
    const slot = i < 5 ? i - 5.4 : i - 3.6, x0 = 180 + slot * 30, y0 = tee + 4
    const near = (side > 0 ? i >= 5 : i < 5)
    const x = lerp(x0, near ? bx1 - side * (6 + (i % 5) * 9) : x0 + side * 30, cover), y = lerp(y0, near ? by1 + 1.2 * pyd + (i % 5) * 2 : tee - 6 * pyd, cover)
    const up = near && (i % 5) === (side > 0 ? 0 : 4)   // the man who goes up for it
    man(ctx, view, x, y, { color: c.us, trim: c.trim, skin: skinOf(i * 3 + 1), size: 0.84, step: kicked && !res ? Math.floor(g.t / 85 + i) % 4 : null, lift: up && g.phase === 'hop' && g.leap != null ? Math.sin(clamp((g.t - (g.hopAt() + g.leap * 1000)) / 420, 0, 1) * Math.PI) * 16 : 0, carry: !!res?.got && up, pose: res ? (res.got ? (up ? null : 'arms-up') : 'hips') : kicked ? 'sprint' : 'stance' })
  }
  // the kicker
  man(ctx, view, kicked ? 180 - side * 4 : 180 - side * 12, kicked ? tee + 2 : tee + 14, { color: c.us, trim: c.trim, skin: view.cast?.me?.skin ?? skinOf(1), number: view.cast?.me?.number ?? 4, size: 0.92, still: true, dir: side > 0 ? 'right' : 'left', pose: res ? (res.got ? 'arms-up' : 'hips') : kicked && since < 420 ? 'plant-l' : 'ready' })
  ctx.restore()
  // ── the bars ──
  const bx = 34, bw = view.w - 68, y0 = view.h - 96 - 104
  if (g.phase === 'dist' || (g.phase === 'strike' && g.dist != null)) {
    ctx.fillStyle = 'rgba(6,10,12,.78)'; rr(ctx, bx - 8, y0 - 22, bw + 16, 58, 6); ctx.fill()
    text(ctx, 'DISTANCE', bx, y0 - 10, { size: 12, align: 'left', track: 1.4, color: 'rgba(255,255,255,.7)' })
    ctx.fillStyle = '#243038'; rr(ctx, bx, y0, bw, 14, 3); ctx.fill()
    const xo = yd => bx + ((yd - 4) / 18) * bw
    ctx.fillStyle = 'rgba(255,90,72,.5)'; ctx.fillRect(bx, y0, xo(10) - bx, 14)                 // short of 10: no good
    ctx.fillStyle = GOOD; ctx.fillRect(xo(10), y0, xo(13) - xo(10), 14)                          // the kick
    ctx.fillStyle = 'rgba(53,224,122,.3)'; ctx.fillRect(xo(13), y0, xo(18) - xo(13), 14)         // carries to the second row
    ctx.fillStyle = '#fff'; ctx.fillRect(xo(g.dist ?? g.yards()) - 2, y0 - 5, 4, 24)
    text(ctx, '10 YARDS', xo(10), y0 + 27, { size: 12, color: GOLD, track: 1 })
  }
  if (g.phase === 'strike') {
    // the ring closing on the top of the ball
    const p = tilt(view, 180, tee), ring = Math.max(0, g.ring())
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y - 9 * p.s, 9 + ring * 40, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = GOOD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y - 9 * p.s, 9, 0, Math.PI * 2); ctx.stroke()
  }
  if (g.phase === 'hop' && g.leap == null) {
    const until = (g.hopAt() - g.t) / (ON_HOP * 0.78), ring = clamp(until, 0, 1)
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q.x, q.y - 16 * q.s, 12 + ring * 44, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = GOOD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y - 16 * q.s, 12, 0, Math.PI * 2); ctx.stroke()
  }
  text(ctx, 'DECLARED · BALL ON THE 34', 14, 64, { size: 13, align: 'left', track: 1.2, color: 'rgba(255,255,255,.8)' })
  vignette(ctx, view)
}
