// Kick Return: the man deep on a kickoff, from behind him in the broadcast camera. One kick, one return, and
// it's a mess, the way a real one is. The 2025 kickoff: the kicker alone at their 35, his ten coverage men set on
// our 40, our nine in the setup zone (the 30 to the 35), two deep. Nobody moves till the ball hits the ground
// or one of ours touches it.
//   the kick     a real kick: off the tee with its speed and angle, end over end, drifting on the wind, four
//                seconds in the air and down in the landing zone (the goal line to the 20). Its shadow on the
//                turf leads him to it. Get under it and it's caught; get there late or at full tilt and it can
//                come off him, and a muff is a live ball. One he doesn't get to bounces, and a football
//                bounces any way it likes. Let it roll into the end zone and it's a touchback at the 20
//   the return   the stick (the arrows or WASD on a keyboard; on a phone, a thumbstick wherever the left thumb
//                lands) and he runs where it points, up the field or across it, at his speed, turning the
//                way a man with the ball turns. His blockers pick up the nearest cover men and fight them;
//                some hold, some get shed, and the creases open and close as it plays out. Run up the back of
//                his own blocker and he's stopped dead. JUKE (space, or the button) is a hard cut: on a man
//                closing in front of him it can make him miss
//   the tackle   a cover man who gets to him tackles him, but a man reaching from the side or behind, or a
//                man still stuck on a block, can be run through, and the faster he's going the more he breaks
// Down past the 30, it's a good return. All the way, it's a touchdown.
//
// The rules are here with no screen, in yards: x across from the left sideline (0 to 53.3), d up the field
// from our goal line, z up off the turf. What a bot (or the demo) gets is what's on the screen: where everyone
// is and where they're going, the ball and its shadow. It steers through steer(), below.
import { byV, clamp, lerp, outcome, rngOf, xiOf, paceOf, easeOut, particles, nudge, text, rr, circle, keyCap, DISPLAY, LABEL, GOLD, GOOD, BAD } from './kit.js'
import { tilt, untilt, stands, floodlight, vignette, skinOf, goalPosts, rollingField, athlete, warmAthlete, crowdPop, beatenPose, airBall } from './art.js'
import { afterStop, fxSeed, hitFx, plantFx, landFx } from './contact.js'
import { paintFieldFlat, SL, SR } from './throw.js'
import { put, action, tagsAll, teamOf, walk } from './read.js'

export const how = {
  'kick-return': 'Get under the kick: its shadow shows where it comes down. Then run it back: the arrows or WASD (a thumbstick on a phone) and he goes where you point. Follow your blockers, find the crease, and JUKE (space) a man closing in front of you. Past the 30 is a good return.',
}

const W_YD = 160 / 3                  // the field's width, in yards
const UX = (SR - SL) / W_YD           // field units a yard across
const PYD = 11                        // and up the field
const MID = W_YD / 2
const G = 10.7                        // gravity, yards a second a second
const HANDS = 1.45                    // how high he catches it
// the kick
const KICK_D = 65, COVER_D = 40, SETUP_D = [35, 31]
const KICK_AT = 900                   // ms: the set, the kicker's run-up
const REST = 0.42                     // a bounce gives back this much of the drop
// him
const TOP = v => byV(v, 9.3, 10.4)            // yards a second, flat out (Speed)
const ACC = v => byV(v, 8.8, 12.4)            // how quickly he gets up to it, and turns (Burst)
const REACH = v => byV(v, 0.75, 1.05)         // how far from his hands a ball is still his (Hands)
const BRK = v => byV(v, 0.31, 0.5)           // breaking a tackle (Balance, Elusiveness, After Catch)
const JUKE_P = v => byV(v, 0.3, 0.42)          // a juke on a man closing in front of him
const JUKE_V = 5.5, JUKE_MS = 300, JUKE_CD = 900
const TACKLE_R = 0.95                 // yards: a cover man this close gets his hands on him
const BODY_R = 0.8                    // and one of ours this close is in his way
// them and us
const COVER_V = 9.55, KICKER_V = 8.6, BLOCK_V = 8.3, DEF_ACC = 8
const SHED = [0.75, 2.6]               // seconds a block holds
const PASS_AT = 30                    // down past this and it's a good return

const yardWord = d => (d >= 100 ? 'THE END ZONE' : d > 50 ? `THEIR ${100 - d}` : `THE ${d}`)
const hyp = Math.hypot
const bare = m => m && { number: m.number, skin: m.skin }
const quiet = m => (m?.last ? { ...m, quiet: true } : bare(m))

function castOf(cast, pos) {
  const pace = 1 + (cast?.me?.speed ?? 0) * 0.06
  if (cast?.us?.xi && cast?.them?.xi) {
    const x = (side, spot, i) => xiOf(cast, side, spot, i)
    const pick = (side, list) => list.map(([s, i]) => x(side, s, i)).filter(p => p && !p.me)
    const us = pick('us', [['lb', 0], ['lb', 1], ['te', 0], ['s', 0], ['lb', 2], ['s', 1], ['te', 1], ['edge', 0], ['wr', 2], ['db', 4], ['rb', 1]])
    const them = pick('them', [['lb', 0], ['s', 0], ['lb', 1], ['cb', 0], ['lb', 2], ['s', 1], ['te', 0], ['cb', 1], ['wr', 2], ['db', 4], ['rb', 1]])
    const mate = pos === 'wr' ? x('us', 'rb', 0) : x('us', 'wr', 0)
    return { me: cast.me ?? null, pace, us: us.slice(0, 9).map(quiet), them: them.slice(0, 10).map(quiet), themPace: them.slice(0, 10).map((_, i) => paceOf(cast, 'them', 'db', i)), mate: mate && !mate.me ? mate : null }
  }
  return { me: cast?.me ?? null, pace, us: [], them: [], themPace: [], mate: null }
}

// ── The rules ───────────────────────────────────────────────────────────────
export function make({ v, seed, cast, pos }) {
  const r = rngOf(seed)
  const W = { top: TOP(v), acc: ACC(v), reach: REACH(v), brk: BRK(v), juke: JUKE_P(v), hands: byV(v, 0, 0.05) }
  const who = castOf(cast, pos)
  W.top *= who.pace
  // the kick: where it comes down, how long it hangs, the wind on it
  const land = { x: MID + (r() - 0.5) * 26, d: 2 + r() * 15 }
  const hang = 3.7 + r() * 0.5, wind = (r() - 0.5) * 1.6
  const x0 = MID + (r() - 0.5) * 4
  const ball = {
    x: x0, d: KICK_D, z: 0.2, vx: (land.x - x0 - 0.5 * wind * hang * hang) / hang, vd: (land.d - KICK_D) / hang, vz: (G * hang) / 2 - 0.2 / hang,
    wind, state: 'tee', touched: false, spin: 0, spinV: 2.1 + r() * 0.6, bounces: 0, noCatch: 0, tried: false, hop: false, landed: false,
  }
  // where everyone stands: ten across on our 40, the kicker on their 35; our nine in the setup zone, two deep
  const cover = Array.from({ length: 11 }, (_, i) => {
    const k = i === 10
    return { i, k, safe: i === 6 || i === 3, x: k ? x0 : 2.5 + i * ((W_YD - 5) / 9), d: k ? KICK_D + 6 : COVER_D, vx: 0, vd: 0, lane: k ? MID : 2.5 + i * ((W_YD - 5) / 9), eng: null, down: 0, tried: -1e9, v: (k ? KICKER_V : COVER_V) * (who.themPace[i] ?? 1) * (0.95 + r() * 0.1) }
  })
  const ours = Array.from({ length: 10 }, (_, i) => {
    const mate = i === 9
    return { i, mate, x: mate ? clamp(land.x + (land.x > MID ? -11 : 11), 4, W_YD - 4) : 4 + (i % 9) * ((W_YD - 8) / 8) + (i % 2 ? 1.5 : -1.5), d: mate ? Math.max(3, land.d - 1) : SETUP_D[i % 2], vx: 0, vd: 0, tgt: null, eng: null, re: 0, beaten: 0, shedAt: 0 }
  })
  const me = { x: clamp(land.x + (r() - 0.5) * 12, 6, W_YD - 6), d: clamp(land.d + 4 + r() * 5, 6, 20), vx: 0, vd: 0, carry: false, juke: -1e9, jukeSide: 0, slow: 0, bump: -1e9, caughtAt: null, catchD: null }
  const g = {
    t: 0, game: 'kick-return', zones: 'none', stick: true, fx: [], done: null, outro: 1700, stamp: null, later: null,
    dirt: particles(64, fxSeed(seed)), nudge: nudge(), W, who, v,
    me, ball, cover, ours, land, hang, phase: 'set', rel: null, res: null, broken: 0, word: null, prompt: 'WATCH THE KICK',
    ctl: { tid: null, ox: 0, oy: 0, tx: 0, ty: 0, ax: 0, ay: 0, ext: false, keys: { L: 0, R: 0, U: 0, D: 0 }, jid: null, jukeLit: -999 },
    stick: { x: 0, y: 0 },
    hud: { prompt: null, dots: [null] },
    tick(dt) {
      g.t += dt
      if (g.later && g.t >= g.later.at) { g.stamp = g.later; g.later = null }
      const s = dt / 1000
      if (g.phase === 'set') { const k = cover[10], f = clamp(g.t / KICK_AT, 0, 1); k.d = lerp(KICK_D + 6, KICK_D + 0.7, f); k.vd = f < 1 ? -7 : 0; if (g.t >= KICK_AT) { g.phase = 'live'; ball.state = 'air'; g.fx.push('tap', 'h:light') } return }
      if (g.res) return after(s)
      // (a line on the play stays up a moment, then it's off the screen)
      if (g.prompt !== g.saidW) { g.saidW = g.prompt; g.saidAt = g.t }
      if (g.prompt && me.carry && g.t - g.saidAt > 1500) g.prompt = null
      if (ball.state === 'air' && g.prompt === 'WATCH THE KICK' && ball.z > 6) g.prompt = 'GET UNDER IT'
      stickNow()
      moveMe(s)
      moveBall(s)
      if (g.res) return
      if (g.rel != null) { moveOurs(s); moveCover(s) }
      contacts()
    },
    input(a) {
      const c = g.ctl
      if (a.kind === 'stick') { c.ax = clamp(a.x, -1, 1); c.ay = clamp(a.y, -1, 1); c.ext = true; return }
      if (a.kind === 'juke') return juke()
      if (a.kind === 'key') { if (a.zone === 'S' || a.zone === 'P') juke(); else if (a.zone in c.keys) c.keys[a.zone] = 1; return }
      if (a.kind === 'keyup') { if (a.zone in c.keys) c.keys[a.zone] = 0; return }
      const id = a.id ?? 0
      if (a.kind === 'down') {
        if (a.x < 180) { c.tid = id; c.ox = a.x; c.oy = a.y; c.tx = 0; c.ty = 0 }
        else { c.jid = id; juke() }
      } else if (a.kind === 'move') {
        if (id === c.tid) { const R = 44; c.tx = clamp((a.x - c.ox) / R, -1.4, 1.4); c.ty = clamp(-(a.y - c.oy) / R, -1.4, 1.4); const m = hyp(c.tx, c.ty); if (m > 1) { c.tx /= m; c.ty /= m } }
      } else if (a.kind === 'up') {
        if (id === c.tid) { c.tid = null; c.tx = 0; c.ty = 0 }
        if (id === c.jid) c.jid = null
      }
    },
  }
  const rb = rngOf(`${seed}|ball`)
  function stickNow() {
    const c = g.ctl, o = g.stick
    if (c.tid != null) { o.x = c.tx; o.y = c.ty }
    else if (c.ext) { o.x = c.ax; o.y = c.ay }
    else { o.x = c.keys.R - c.keys.L; o.y = c.keys.U - c.keys.D }
    const m = hyp(o.x, o.y); if (m > 1) { o.x /= m; o.y /= m }
  }
  function juke() {
    g.ctl.jukeLit = g.t
    if (!me.carry || g.res || g.t - me.juke < JUKE_CD) return
    // a hard cut: the way the stick says, or away from the nearest man
    let side = Math.abs(g.stick.x) > 0.2 ? Math.sign(g.stick.x) : 0
    if (!side) { const n = nearestFree(); side = n ? (n.x > me.x ? -1 : 1) : (me.x > MID ? -1 : 1) }
    me.juke = g.t; me.jukeSide = side
    me.vx = side * Math.max(JUKE_V, Math.abs(me.vx)); me.vd *= 0.78
    g.fx.push('swoosh', 'h:light')
  }
  const nearestFree = () => { let best = null, bd = 1e9; for (const c of cover) { if (c.eng != null || g.t < c.down) continue; const dd = hyp(c.x - me.x, c.d - me.d); if (dd < bd) { bd = dd; best = c } } return best }
  function moveMe(s) {
    const o = g.stick
    let top = W.top * (me.carry ? 1 : 0.92)
    if (g.t < me.slow) top *= 0.5
    // (a long way at full tilt: by the other team's side of the field the legs are going)
    if (me.carry) top *= 1 - clamp((me.d - (me.catchD ?? 0) - 35) / 120, 0, 0.09)
    const want = { x: o.x * top, d: o.y * top }
    const ax = want.x - me.vx, ad = want.d - me.vd, am = hyp(ax, ad)
    // (slowing down comes quicker than speeding up, and a cut is the two at once)
    const cap = (hyp(want.x, want.d) < hyp(me.vx, me.vd) ? W.acc * 1.5 : W.acc) * s
    const k = am > cap ? cap / am : 1
    me.vx += ax * k; me.vd += ad * k
    const sp = hyp(me.vx, me.vd)
    if (sp > top && g.t - me.juke > JUKE_MS) { me.vx *= top / sp; me.vd *= top / sp }
    me.x += me.vx * s; me.d += me.vd * s
    if (!me.carry) me.x = clamp(me.x, 0.5, W_YD - 0.5)
  }
  function moveBall(s) {
    const b = ball
    if (b.state === 'held') { b.x = me.x; b.d = me.d; b.z = 1.1; return }
    if (b.state !== 'air' && b.state !== 'loose') return
    const was = b.z
    b.vz -= G * s
    if (b.state === 'air') b.vx += b.wind * s
    b.x += b.vx * s; b.d += b.vd * s; b.z += b.vz * s
    b.spin += b.spinV * s
    // into his hands
    if (b.vz < 0 && b.z <= HANDS + 0.2 && b.z > 0.25 && !b.tried && g.t >= b.noCatch) {
      const dd = hyp(b.x - me.x, b.d - me.d)
      if (dd <= W.reach) { b.tried = true; return catchIt(dd) }
    }
    // off the turf
    if (b.z <= 0 && was > 0) {
      b.z = 0
      if (!b.landed) { b.landed = true; release('the ground') }
      if (Math.abs(b.vz) > 1.6) {
        // a football bounces any way it likes: off a point it can skip on, stand up, or come back
        b.bounces++
        const k = Math.abs(b.vz)
        b.vz = k * REST * (0.6 + rb() * 0.6)
        b.vd = b.vd * (0.45 + rb() * 0.35) + (rb() - 0.5) * k * 0.55
        b.vx = b.vx * (0.5 + rb() * 0.3) + (rb() - 0.5) * k * 0.5
        b.spinV = (rb() - 0.5) * 6
        b.state = 'loose'; b.tried = false
        g.fx.push('tap')
      } else { b.vz = 0; b.state = 'loose' }
    }
    if (b.z <= 0 && b.vz <= 0) {
      b.z = 0; b.vz = 0
      const sp = hyp(b.vx, b.vd), f = Math.min(sp, 3.4 * s)
      if (sp > 0) { b.vx -= (b.vx / sp) * f; b.vd -= (b.vd / sp) * f }
      b.spinV *= Math.exp(-s * 2)
    }
    if (b.state === 'loose') {
      // he picks it up
      const dd = hyp(b.x - me.x, b.d - me.d)
      if (b.z < 0.8 && dd <= W.reach * 0.9 && g.t >= b.noCatch) return scoop()
      // the rules for a ball nobody's touched: into the end zone, a touchback at the 20; out of bounds, the 40
      if (!b.touched && b.d < -0.2) return settle('touchback', null, 20)
      if (b.x < 0 || b.x > W_YD) return b.touched ? settle('out', 'IT ROLLED OUT OF BOUNDS', Math.max(1, Math.round(b.d))) : settle('oob', null, 40)
      if (b.d < -10) return settle('touchback', null, 20)
    }
  }
  function release() {
    if (g.rel != null) return
    g.rel = g.t
    for (const c of cover) c.relAt = g.t
  }
  function catchIt(dd) {
    const b = ball, sp = hyp(me.vx, me.vd)
    const muff = 0.02 + 0.32 * Math.pow(dd / W.reach, 3) + 0.14 * Math.max(0, sp / W.top - 0.45) + (b.landed ? 0.06 : 0) - W.hands
    release()
    if (r() < clamp(muff, 0.01, 0.6)) {
      // off his hands: a live ball, bouncing loose
      b.touched = true; b.state = 'loose'; b.z = 1.0
      b.vz = 1.5 + r() * 2; b.vd = me.vd * 0.4 + (r() - 0.5) * 6; b.vx = me.vx * 0.4 + (r() - 0.5) * 6; b.spinV = (r() - 0.5) * 8
      b.noCatch = g.t + 280; g.muffed = g.t
      g.prompt = 'MUFFED IT: GET THE BALL'
      g.fx.push('deny', 'h:medium')
      return
    }
    have(b.landed ? 'FIELDED IT ON A HOP' : sp > W.top * 0.55 ? 'CAUGHT IT ON THE RUN' : 'FIELDED CLEANLY')
  }
  function scoop() {
    me.slow = g.t + 380
    have(g.muffed ? 'PICKED IT BACK UP' : 'SCOOPED IT UP')
  }
  function have(word) {
    ball.state = 'held'; ball.touched = true
    me.carry = true; me.caughtAt = g.t; me.catchD = me.d
    release()
    g.prompt = word
    g.fx.push('tap', 'h:light')
  }
  // ── our blockers: pick up the nearest cover man nobody has, get between him and the ball, and fight him
  function moveOurs(s) {
    const live = g.t - g.rel > 150
    for (const b of ours) {
      if (!live) continue
      if (b.eng != null) {
        const c = cover[b.eng], ux = me.x - c.x, ud = me.d - c.d, m = hyp(ux, ud) || 1
        b.x = c.x + (ux / m) * 0.85; b.d = c.d + (ud / m) * 0.85; b.vx = c.vx; b.vd = c.vd
        continue
      }
      if (g.t < b.beaten) { b.vx *= 0.9; b.vd *= 0.9; b.x += b.vx * s; b.d += b.vd * s; continue }
      // (first they turn and drop to set the wall, the way a return team does, then go and find a man)
      if (!b.mate && g.t - g.rel < 380) { seek(b, b.x0 ?? (b.x0 = b.x), (b.d0 ?? (b.d0 = b.d)) - 3, 6.5, s); continue }
      if (b.tgt == null || g.t >= b.re || cover[b.tgt].eng != null) {
        b.re = g.t + 400
        let best = null, bd = 1e9
        for (const c of cover) {
          if (c.eng != null || g.t < c.down) continue
          const taken = ours.some(o => o !== b && o.tgt === c.i && o.eng == null)
          const dd = hyp(c.x - b.x, c.d - b.d) + (taken ? 6 : 0) + (c.d < me.d - 2 ? 20 : 0)
          if (dd < bd) { bd = dd; best = c }
        }
        b.tgt = best ? best.i : null
      }
      let tx, td
      if (b.tgt != null) {
        const c = cover[b.tgt], ux = me.x - c.x, ud = me.d - c.d, m = hyp(ux, ud) || 1
        // (he steps into the man's path: where he'll be in a moment, on the side of the ball)
        const gap = hyp(c.x - b.x, c.d - b.d), lead = clamp(gap / 14, 0, 0.45)
        tx = c.x + c.vx * lead + (ux / m) * 0.9; td = c.d + c.vd * lead + (ud / m) * 0.9
        if (gap < 1.45 && c.eng == null && g.t >= c.down) {
          c.eng = b.i; b.eng = c.i
          c.shedAt = g.t + 1000 * lerp(SHED[0], SHED[1], r()) * (c.k ? 0.6 : 1)
          continue
        }
      } else { tx = me.x + (b.i % 2 ? 3 : -3); td = me.d + 4 }
      seek(b, tx, td, b.mate ? 9 : BLOCK_V, s)
    }
  }
  // ── the coverage: down their lanes, then at him with an angle; the kicker hangs back, the last man
  function moveCover(s) {
    const live = g.t - g.rel > 120
    const ballFree = ball.state !== 'held'
    for (const c of cover) {
      if (!live) continue
      if (g.t < c.down) { c.vx *= 0.8; c.vd *= 0.8; continue }
      if (c.eng != null) {
        const b = ours[c.eng]
        // he's past the pair, or the man sheds him: free again
        if (g.t >= c.shedAt || c.d < me.d - 1.8) { c.eng = null; b.eng = null; b.tgt = null; b.beaten = g.t + 550; c.burst = g.t + 300; continue }
        const ux = me.x - c.x, ud = me.d - c.d, m = hyp(ux, ud) || 1
        c.vx = (ux / m) * 1.1 + Math.sin(g.t / 230 + c.i) * 0.5; c.vd = (ud / m) * 1.1
        c.x += c.vx * s; c.d += c.vd * s
        continue
      }
      const tx0 = ballFree ? ball.x : me.x, td0 = ballFree ? ball.d : me.d
      const dist = hyp(tx0 - c.x, td0 - c.d)
      // (the angle: where he'll be when a man at full speed can get there)
      const lead = ballFree ? 0.15 : intercept(c, dist)
      let tx = tx0 + (ballFree ? ball.vx : me.vx) * lead, td = td0 + (ballFree ? ball.vd : me.vd) * lead
      // (still a way off: he keeps his lane, so there's no seam to run through)
      if (dist > 12 && !c.k && !c.safe) tx = lerp(tx, c.lane, 0.45)
      // (the kicker and one safety stay home, the last line: up the field from him till he's close, then an angle)
      if ((c.k || c.safe) && dist > (c.k ? 10 : 12) && !ballFree) { tx = lerp(me.x, MID, 0.15) + (c.k ? 0 : c.lane > MID ? 4 : -4); td = me.d + (c.k ? 11 : 8) }
      seek(c, tx, td, c.v * (g.t < (c.burst ?? 0) ? 1.05 : 1), s)
    }
  }
  function intercept(c, dist) {
    const dx = me.x - c.x, dd = me.d - c.d, A = me.vx * me.vx + me.vd * me.vd - c.v * c.v, B = 2 * (dx * me.vx + dd * me.vd), C = dx * dx + dd * dd
    let T = null
    if (Math.abs(A) < 1e-6) T = B < 0 ? -C / B : null
    else { const D = B * B - 4 * A * C; if (D >= 0) { const q = Math.sqrt(D), t1 = (-B - q) / (2 * A), t2 = (-B + q) / (2 * A); T = [t1, t2].filter(t => t > 0).sort((a, b) => a - b)[0] ?? null } }
    return T == null ? clamp((dist / c.v) * 0.6, 0, 1.2) : Math.min(T, 2.5)
  }
  function seek(m, tx, td, vmax, s) {
    const dx = tx - m.x, dd = td - m.d, dm = hyp(dx, dd) || 1
    const wx = (dx / dm) * vmax * Math.min(1, dm / 0.6), wd = (dd / dm) * vmax * Math.min(1, dm / 0.6)
    const ax = wx - m.vx, ad = wd - m.vd, am = hyp(ax, ad), cap = DEF_ACC * s
    const k = am > cap ? cap / am : 1
    m.vx += ax * k; m.vd += ad * k
    m.x += m.vx * s; m.d += m.vd * s
  }
  function contacts() {
    // his own men: he runs up their backs and stops
    for (const b of ours) {
      const dx = me.x - b.x, dd = me.d - b.d, m = hyp(dx, dd)
      if (m < BODY_R && m > 0.001) {
        const push = BODY_R - m
        me.x += (dx / m) * push; me.d += (dd / m) * push
        const into = -(me.vx * dx + me.vd * dd) / m
        if (into > 0) { me.vx += (dx / m) * into * 0.85; me.vd += (dd / m) * into * 0.85 }
        me.vx *= 0.975; me.vd *= 0.975
        if (me.carry && into > 2) { me.bump = g.t; if (g.t - (g.bumpWord ?? -1e9) > 900) { g.bumpWord = g.t; g.prompt = 'RAN INTO HIS OWN BLOCKER' } }
      }
    }
    // a loose ball: a man of theirs who gets to it after we've touched it takes it; one nobody's touched, he downs
    if (ball.state === 'loose') {
      for (const c of cover) {
        if (g.t < c.down || c.eng != null) continue
        if (ball.z < 0.6 && hyp(ball.x - c.x, ball.d - c.d) < 0.75) return settle(ball.touched ? 'lost' : 'downed', null, Math.max(1, Math.round(ball.d)))
      }
      return
    }
    if (!me.carry) return
    if (me.d >= 100) return settle('td', null, 100)
    if (me.x < 0 || me.x > W_YD) return settle('out', 'PUSHED OUT OF BOUNDS', Math.round(me.d))
    for (const c of cover) {
      if (g.t < c.down || g.t - c.tried < 1200) continue
      const dx = c.x - me.x, dd = c.d - me.d, m = hyp(dx, dd)
      if (m > TACKLE_R) continue
      c.tried = g.t
      const sp = hyp(me.vx, me.vd), ux = sp > 0.5 ? me.vx / sp : 0, ud = sp > 0.5 ? me.vd / sp : 1
      const front = (dx * ux + dd * ud) / (m || 1)
      const arm = front < 0.25
      const jk = g.t - me.juke < JUKE_MS && front > -0.2
      let p = W.brk * (arm ? 1.8 : 0.8) * (0.3 + 0.7 * clamp(sp / W.top, 0, 1))
      if (jk) p += W.juke
      if (c.eng != null) p = 0.55 + p * 0.45     // (reaching out of a block)
      if (c.k) p += 0.08
      if (r() < clamp(p, 0.02, 0.88)) {
        // through it: he's down, and he's lost a step
        c.down = g.t + 1100; c.fellAt = g.t; c.fellX = Math.sign(dx || 1)
        if (c.eng != null) { ours[c.eng].eng = null; ours[c.eng].tgt = null; c.eng = null }
        me.vx *= 0.75; me.vd *= 0.75
        g.broken++
        g.word = { text: jk ? 'JUKED HIM' : arm ? 'RAN THROUGH THE ARM TACKLE' : 'BROKE A TACKLE', at: g.t }
        g.prompt = null
        g.fx.push(jk ? 'swoosh' : 'pop', 'h:medium')
        continue
      }
      const why = g.t - me.bump < 900 ? 'RAN INTO HIS OWN BLOCKER' : c.k ? 'THE KICKER GOT HIM' : front > 0.3 ? 'SQUARED UP' : front < -0.3 ? 'CAUGHT FROM BEHIND' : 'TAKEN DOWN FROM THE SIDE'
      g.tackler = c.i; g.hitFrom = Math.sign(-dx || 1)
      // (he falls forward with what he had going: a man going full tilt gets another yard or two)
      return settle('tackle', why, me.d + clamp(me.vd * (front > 0.3 ? 0.1 : 0.2), -0.5, 2.2))
    }
  }
  function settle(kind, why, spotD) {
    const spot = clamp(Math.round(spotD), kind === 'tackle' || kind === 'out' ? 0 : 1, 100)
    const catchD = me.catchD != null ? Math.round(me.catchD) : Math.round(land.d)
    const td = kind === 'td'
    const yards = td ? 100 - catchD : kind === 'tackle' || kind === 'out' ? spot - catchD : 0
    const good = td || ((kind === 'tackle' || kind === 'out' || kind === 'oob') && spot > PASS_AT)
    g.res = { kind, why, at: g.t, spot, yards, catchD, td, good }
    g.hud.dots[0] = good
    const word = td ? 'TOUCHDOWN' : kind === 'touchback' ? 'TOUCHBACK' : kind === 'oob' ? 'OUT OF BOUNDS' : kind === 'lost' ? 'FUMBLE' : kind === 'downed' ? `DOWNED AT ${yardWord(spot)}`
      : kind === 'out' ? `OUT AT ${yardWord(spot)}` : spot > PASS_AT ? `TO ${yardWord(spot)}` : `TACKLED AT ${yardWord(spot)}`
    g.prompt = td ? 'ALL THE WAY' : kind === 'touchback' ? 'LET IT ROLL IN: BALL AT THE 20' : kind === 'oob' ? 'KICKED OUT OF BOUNDS: BALL AT THE 40' : kind === 'lost' ? 'THEY RECOVERED THE MUFF'
      : kind === 'downed' ? 'NEVER GOT TO IT: THEY DOWNED IT' : spot <= 0 ? 'TACKLED IN THE END ZONE: SAFETY' : why
    g.stamp = { text: word, good: good ? true : spot >= 25 && (kind === 'tackle' || kind === 'out') ? null : false, at: g.t + (td ? 150 : 0), size: word.length > 12 ? 36 : 50 }
    g.fx.push('stamp', td ? 'h:success' : kind === 'tackle' ? 'h:heavy' : 'h:medium')
    if (td || good) g.popAt = g.t
    if (td) g.fx.push('claim')
    if (kind === 'tackle') g.nudge.kick(g.t, 4, 0, 1)
    const score = td ? 1 : kind === 'lost' ? 0 : clamp((spot - 10) / 50, 0, 0.95)
    const note = td ? `kick return touchdown, ${yards} yards` : kind === 'touchback' ? 'touchback at the 20' : kind === 'lost' ? 'muffed it, and they recovered' : `${yards > 0 ? `${yards}-yard return` : 'return'} to ${yardWord(spot).toLowerCase()}`
    g.done = outcome(good ? Math.max(score, 0.5) : Math.min(score, 0.45), good, note, { made: good ? 1 : 0, of: 1, yards, spot, td, tds: td ? 1 : 0, long: yards, broken: g.broken, pts: td ? 7 : null, kind }, false)
    g.outro = td ? 3600 : 2200
  }
  // after it's decided: a touchdown pulls up in the end zone, a tackle drives him down, the others come to the ball
  function after(s) {
    const k = Math.exp(-s / (g.res.td ? 0.35 : 0.12))
    me.vx *= k; me.vd *= k
    me.x += me.vx * s; me.d = Math.min(g.res.td ? 106 : 1e9, me.d + me.vd * s)
    for (const m of [...cover, ...ours]) { m.vx *= 0.9; m.vd *= 0.9; m.x += m.vx * s; m.d += m.vd * s }
  }
  return g
}

// ── Steering: what a player does with the stick, from what's on the screen ──
// The bot plays it through this with a human's reaction and error; the demo plays it straight.
// seen(m): where he saw the man (a reaction ago). err: the stick's own wobble, radians. Returns { x, y, juke }
export function steer(g, { delay = 0, err = 0, rnd = Math.random, landErr = { x: 0, d: 0 } } = {}) {
  const me = g.me, b = g.ball, W = g.W
  const seen = m => ({ x: m.x - m.vx * delay, d: m.d - m.vd * delay })
  // ── before he has it: get under it (where the shadow's going), or go get it
  if (!me.carry) {
    let tx, td
    if (b.state === 'air' || b.state === 'tee') {
      // where it comes down to his hands, the way a returner reads it: off its flight, a little off at first
      const disc = b.vz * b.vz + 2 * G * Math.max(0, b.z - HANDS), t = b.state === 'tee' ? g.hang : (b.vz + Math.sqrt(disc)) / G
      tx = b.x + b.vx * t + 0.5 * (b.state === 'air' ? b.wind : 0) * t * t + landErr.x; td = b.d + b.vd * t + landErr.d
      // (he sets up a half step behind where it'll be, so he's coming forward through it)
      td -= 0.3
    } else { tx = b.x + b.vx * 0.25; td = b.d + b.vd * 0.25 }
    const dx = tx - me.x, dd = td - me.d, m = hyp(dx, dd)
    if (m < 0.25) return { x: 0, y: 0, juke: false }
    // (coming in under it he eases off, so he gets there and stops instead of running through it)
    const k = Math.min(1, Math.sqrt(2 * W.acc * 1.2 * m) / W.top, m / 0.5) / m
    return { x: dx * k, y: dd * k, juke: false }
  }
  // ── with it: try a fan of headings, and take the one with room and ground in it
  const threats = g.cover.filter(c => g.t >= c.down).map(c => ({ ...seen(c), v: c.eng != null ? 1.4 : c.v, eng: c.eng != null, k: c.k }))
  const mates = g.ours.map(seen)
  let best = null
  for (let a = -1.35; a <= 1.351; a += 0.225) {
    const ux = Math.sin(a), ud = Math.cos(a)
    // how long he's free going this way: till a man can get there, or he runs up a blocker's back or out of bounds
    let free = 1.6
    for (let t = 0.1; t <= 1.6 && free === 1.6; t += 0.1) {
      const px = me.x + ux * W.top * t, pd = me.d + ud * W.top * t
      if (px < 0.8 || px > W_YD - 0.8) { free = t; break }
      for (const c of threats) if ((hyp(px - c.x, pd - c.d) - TACKLE_R) / c.v <= t * (c.eng ? 2.2 : 1)) { free = t; break }
      if (free < 1.6) break
      if (t <= 0.8) for (const o of mates) if (hyp(px - o.x, pd - o.d) < BODY_R + 0.3) { free = t + 0.25; break }
    }
    const sc = (ud + 0.35) * free + 0.08 * Math.cos(a - (g.lastA ?? 0))
    if (!best || sc > best.sc) best = { a, sc }
  }
  g.lastA = best.a
  const a = best.a + err * (rnd() * 2 - 1)
  // the juke: a man closing in front of him, about to get there
  let juke = false
  for (const c of threats) {
    if (c.eng) continue
    const dx = c.x - me.x, dd = c.d - me.d, m = hyp(dx, dd)
    if (m < 1.9 && m > TACKLE_R && dd > -0.3) juke = true
  }
  return { x: Math.sin(a), y: Math.cos(a), juke, a: best.a }
}

// ── The picture ─────────────────────────────────────────────────────────────
const SIZE = 1.0
const STAMP_Y = 0.22
const COVER_NUM = [44, 31, 52, 23, 55, 37, 85, 26, 18, 41, 3]
const OUR_NUM = [54, 42, 86, 30, 58, 39, 48, 91, 17, 21]
const X = x => SL + x * UX
const anchorOf = view => untilt(view, 180, view.h - 268).y
const ZOOM = 1.14                     // (the picture a touch bigger than the screen, so the camera can pan across with him)
const ZU = 26                         // sprite units a yard up off the turf
const zShow = z => (z * ZU) / (1 + z / 14)   // (a kick's height, eased: the top of it would be off the screen)
function sidelines(x, view, fy, c, them) {
  const O = { pose: 'ready', step: null, carry: false, fall: 0, fallX: 0, size: 0.72, number: null, kit: 'pads' }
  for (let yd = 25; yd <= 75; yd += 5) {
    const n = (yd * 7) % 11, y = fy(yd)
    if (n > 7 || y < view.h * 0.2 || y > view.h - 40) continue
    athlete(x, view, -14 - (n % 3) * 8, y, { ...O, dir: 'right', color: c.us, trim: c.trim, pants: c.trim, skin: skinOf(n) })
    athlete(x, view, view.w + 14 + (n % 3) * 8, y + 12, { ...O, dir: 'left', color: them.color, trim: them.trim, pants: them.trim, skin: skinOf(n + 3) })
  }
}
const dirOfStep = (w, still) => (w.step == null ? still : Math.abs(w.dx) > Math.abs(w.dy) * 1.3 ? (w.dx > 0 ? 'right' : 'left') : w.dy > 0 ? 'down' : 'up')
const ctlOf = h => ({ stick: { x: 82, y: h - 96, R: 44 }, juke: { x: 360 - 70, y: h - 92, r: 42 } })

export function draw(ctx, g, view) {
  for (const s of [g.stamp, g.later]) if (s && s.y == null) s.y = view.h * STAMP_Y
  const c = view.colors, us = teamOf(c, 0), them = teamOf(c, 1), res = g.res, who = g.who, me = g.me, b = g.ball, t = g.t
  const since = res ? t - res.at : -1
  const dt = clamp(t - (g.lastDraw ?? t), 0, 60); g.lastDraw = t
  // ── the camera: with him, a little up the field from him
  const want = Math.min(93, me.d + (me.carry ? 2 : 4))
  g.camD ??= want
  g.camD += (want - g.camD) * (1 - Math.exp(-dt / (me.carry ? 90 : 160)))
  const A = anchorOf(view), fy = d => A - (d - g.camD) * PYD
  // (across: the lens leans the way he goes, as far as the picture's edge allows)
  const room = ((ZOOM - 1) * view.w) / 2, panWant = clamp((180 - X(me.x)) * 0.55, -room, room)
  g.pan = (g.pan ?? panWant) + (panWant - (g.pan ?? panWant)) * (1 - Math.exp(-dt / 220))
  ctx.save(); ctx.translate(view.w / 2 + g.pan, view.h / 2); ctx.scale(ZOOM, ZOOM); ctx.translate(-view.w / 2, -view.h / 2)
  const EZ = view.h + 12 * PYD, len = EZ + 104 * PYD + view.h
  const paintView = { w: view.w, h: len, px: view.px, field: view.field }
  const P = d => EZ + (100 - d) * PYD
  rollingField(ctx, view, {
    key: `kr|${c.us}|${c.trim}|${them.color}|${view.field?.id ?? ''}`, len, strips: 84, res: 0.62,
    at: Math.round((P(g.camD) - A) * 2) / 2,
    paint: x => paintFieldFlat(x, paintView, EZ, PYD, c.us),
    under: x => stands(x, view, 'field', [c.us, c.trim]),
    over: x => {
      floodlight(x, view)
      const back = fy(110)
      if (view.field && back > 4) goalPosts(x, view, back)
      sidelines(x, view, fy, c, them)
    },
  })
  crowdPop(ctx, view, [c.us, c.trim], t - (g.popAt ?? -1e9), { ms: res?.td ? 2800 : 1300, power: res?.td ? 1 : 0.55 })
  const party = res?.td ? since - 900 : -1
  // ── theirs
  g.cover.forEach((m, i) => {
    const w = walk(g, `c${i}`, X(m.x), fy(m.d), 8)
    let pose = null, dir = 'down', fall = 0, fallX = 0, z = null
    if (g.rel == null) pose = 'ready'
    else if (t < m.down) { const age = t - m.fellAt; pose = 'dive'; fall = clamp(age / 240, 0, 0.94); fallX = m.fellX; if (age > 700) { fall = clamp(1 - (age - 700) / 300, 0, 0.94) } if (!m.landFx && age > 240) { m.landFx = true; landFx(g, view, X(m.x), fy(m.d), { side: m.fellX, power: 1.2 }) } }
    else if (m.eng != null) pose = 'block'
    else if (hyp(m.x - me.x, m.d - me.d) < 1.8 && me.carry && !res) pose = 'wrap'
    if (t >= m.down) m.landFx = false
    if (res?.kind === 'tackle' && g.tackler === i) {
      const s2 = afterStop(since)
      pose = since > 1300 ? (i % 2 ? 'point-up' : 'flex') : 'wrap'; fall = since > 1300 ? 0 : clamp((s2 - 20) / 240, 0, 1); fallX = g.hitFrom; z = fy(me.d) + 1
    } else if (res && (res.td || res.good) && since > 300) { const bp = beatenPose(i, since - 300); if (bp) { pose = bp.pose; dir = bp.turn ? 'up' : 'down' } }
    put(X(m.x), fy(m.d), them, { dir: pose ? dir : dirOfStep(w, 'down'), step: pose || fall ? null : w.step, pose: pose ?? (w.step == null ? 'ready' : null), fall, fallX, z, skin: skinOf(i * 3 + 2), number: COVER_NUM[i], size: SIZE, ...(m.k ? null : who.them[i]) })
  })
  // ── ours
  g.ours.forEach((m, i) => {
    const w = walk(g, `o${i}`, X(m.x), fy(m.d), 8)
    let pose = null
    if (g.rel == null) pose = 'ready'
    else if (m.eng != null) pose = 'block'
    if (party > 0 && hyp(m.x - me.x, m.d - me.d) < 4) pose = ['arms-up', 'point-up', 'flex', 'griddy-a'][i % 4]
    if (pose === 'griddy-a' && Math.floor(t / 170) % 2) pose = 'griddy-b'
    put(X(m.x), fy(m.d), us, { dir: pose ? 'up' : dirOfStep(w, 'up'), step: pose ? null : w.step, pose: pose ?? (w.step == null ? 'ready' : null), skin: skinOf(i * 5 + 4), number: OUR_NUM[i], size: SIZE, ...(m.mate ? bare(who.mate) : who.us[i]) })
  })
  if (party > 0) {
    // (the rest of them get down there to him)
    for (const m of g.ours) if (hyp(m.x - me.x, m.d - me.d) < 30) { m.vx = 0; m.vd = 0; m.x += (me.x + (m.i - 4.5) * 0.9 - m.x) * Math.min(1, dt / 500); m.d += (me.d - 2.5 - (m.i % 3) - m.d) * Math.min(1, dt / 500) }
  }
  // ── him
  const wm = walk(g, 'me', X(me.x), fy(me.d), 9)
  const M = { size: SIZE, number: 22, skin: skinOf(6), ...who.me, dir: 'up', step: wm.step, pose: null, carry: me.carry, lead: true }
  const sp = hyp(me.vx, me.vd)
  if (!me.carry) {
    M.pose = wm.step == null ? 'ready' : null
    if (b.state === 'air' && b.z < 9 && b.vz < 0 && hyp(b.x - me.x, b.d - me.d) < 3) { M.pose = 'catch-l'; M.step = null }
    if (b.state === 'loose' && hyp(b.x - me.x, b.d - me.d) < 1.6) { M.pose = 'touch'; M.step = null }
  } else if (!res) {
    if (t - me.juke < 200) { M.pose = me.jukeSide > 0 ? 'plant-l' : 'plant-r'; M.step = null }
    else if (t < me.slow) { M.pose = 'touch'; M.step = null }
    else if (sp > 2) { M.pose = 'sprint'; M.step = (Math.floor((me.d * PYD + me.x * UX) / 16) % 8) / 2; M.dir = Math.abs(me.vx) > Math.abs(me.vd) * 1.6 ? (me.vx > 0 ? 'right' : 'left') : me.vd < -1 ? 'down' : 'up'; M.lean = clamp(me.vx * 0.012, -0.12, 0.12) }
    if (t - me.juke < 30 && !g.jukeFx) { g.jukeFx = true; plantFx(g, view, X(me.x), fy(me.d), me.jukeSide, 9, 1) }
    if (t - me.juke > 200) g.jukeFx = false
  } else if (res.td) {
    M.carry = since < 900
    M.pose = since < 450 ? 'sprint' : since < 900 ? 'spike-up' : ['flex', 'point-up', 'griddy', 'arms-up'][Math.floor(res.at) % 4]
    if (M.pose === 'griddy') M.pose = Math.floor(t / 170) % 2 ? 'griddy-a' : 'griddy-b'
    M.step = since < 450 ? (Math.floor(t / 70) % 8) / 2 : null
    if (since >= 900) M.dir = 'down'
  } else if (res.kind === 'tackle' || res.kind === 'out') {
    const s2 = afterStop(since)
    if (!g.hitFx && res.kind === 'tackle') { g.hitFx = true; hitFx(g, view, X(me.x), fy(me.d), { power: 5, n: 12, side: g.hitFrom ?? 1, up: 22 }) }
    if (res.kind === 'tackle') { M.fall = clamp((s2 - 15) / 235, 0, 1); M.fallX = -(g.hitFrom ?? 1); M.pose = null; M.step = null }
    else { M.pose = 'ready'; M.step = null }
    if (s2 > 250 && !g.landFx && res.kind === 'tackle') { g.landFx = true; landFx(g, view, X(me.x), fy(me.d), { side: -(g.hitFrom ?? 1) }) }
  } else { M.pose = 'ready'; M.step = null; M.carry = false }
  put(X(me.x), fy(me.d), us, M)
  tagsAll(!!res && since > 800)
  action(ctx, view)
  // ── the ball: on the tee; in the air end over end, its shadow on the turf under it; bouncing loose
  if (b.state !== 'held') {
    // (its shadow: a dark spot right under it on the turf, the thing a returner runs to)
    const q = tilt(view, X(b.x), fy(b.d)), sh = 1 + Math.min(1.6, b.z / 14)
    ctx.fillStyle = `rgba(0,0,0,${(0.5 - Math.min(0.22, b.z / 90)).toFixed(2)})`
    ctx.beginPath(); ctx.ellipse(q.x, q.y, 6 * sh * q.s, 2.4 * sh * q.s, 0, 0, Math.PI * 2); ctx.fill()
    if (b.state === 'tee') {
      ctx.fillStyle = '#f08a1c'; ctx.fillRect(q.x - 2.5 * q.s, q.y - 2 * q.s, 5 * q.s, 2 * q.s)
      airBall(ctx, q.x, q.y - 6 * q.s, { axis: [0, 0.25, 1], len: 13 * q.s })
    } else {
      const ph = b.spin * Math.PI * 2
      airBall(ctx, q.x, q.y - zShow(b.z) * q.s - 4 * q.s, { axis: [0.12, Math.cos(ph), Math.sin(ph)], len: 14 * q.s, spin: b.spin })
    }
  }
  // the word on the play: a broken tackle, a juke
  if (g.word && t - g.word.at < 900 && !res) {
    const p = tilt(view, X(me.x), fy(me.d)), k = 1 + 0.3 * (1 - easeOut(clamp((t - g.word.at) / 140, 0, 1)))
    ctx.save(); ctx.translate(clamp(p.x, 90, view.w - 90), p.y - 80 * p.s); ctx.scale(k, k)
    text(ctx, g.word.text, 0, 0, { font: DISPLAY, size: 20, color: GOOD })
    ctx.restore()
  }
  g.dirt.draw(ctx, t)
  ctx.restore()
  if (g.phase === 'set') warm(g, us, them)
  vignette(ctx, view)
  drawControls(ctx, view, g)
}
function prompt(ctx, view, str, y, size = 17) {
  ctx.font = `${size}px ${LABEL}`
  const tw = ctx.measureText(str).width + 24 + str.length * 1.5
  ctx.fillStyle = 'rgba(6,10,12,.72)'; rr(ctx, view.w / 2 - tw / 2, y - 15, tw, 30, 4); ctx.fill()
  text(ctx, str, view.w / 2, y + 1, { size, track: 1.5, color: '#fff' })
}
// the stick and the JUKE button on a phone; the keys on a computer
function drawControls(ctx, view, g) {
  const C = ctlOf(view.h), c = g.ctl, s = g.stick, live = !g.done
  const line = g.prompt
  if (view.keys) {
    const y = view.h - 22
    ctx.fillStyle = 'rgba(6,10,12,.72)'; rr(ctx, 8, y - 15, view.w - 16, 30, 5); ctx.fill()
    keyCap(ctx, 34, y, 'ARROWS'); text(ctx, 'RUN', 60, y + 1, { size: 13, align: 'left', track: 1 })
    keyCap(ctx, 160, y, 'SPACE'); text(ctx, 'JUKE', 198, y + 1, { size: 13, align: 'left', track: 1 })
    if (line) prompt(ctx, view, line, view.h - 62)
    return
  }
  const ax = c.tid != null ? c.ox : C.stick.x, ay = c.tid != null ? c.oy : C.stick.y, R = C.stick.R
  ctx.globalAlpha = live ? 1 : 0.4
  ctx.fillStyle = 'rgba(6,10,12,.42)'; circle(ctx, ax, ay, R + 6); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2; circle(ctx, ax, ay, R + 6); ctx.stroke()
  ctx.fillStyle = c.tid != null || hyp(s.x, s.y) > 0.1 ? '#e9eef0' : 'rgba(233,238,240,.7)'
  circle(ctx, ax + s.x * R, ay - s.y * R, 19); ctx.fill()
  ctx.strokeStyle = 'rgba(6,10,12,.5)'; ctx.lineWidth = 1.5; ctx.stroke()
  const lit = g.t - c.jukeLit < 140 && live
  ctx.fillStyle = lit ? view.accent : 'rgba(28,38,43,.9)'; circle(ctx, C.juke.x, C.juke.y, C.juke.r); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.stroke()
  text(ctx, 'JUKE', C.juke.x, C.juke.y + 1, { font: DISPLAY, size: 19, color: lit ? '#06100c' : '#fff' })
  ctx.globalAlpha = 1
  if (line) prompt(ctx, view, line, view.h - 166)
}
function warm(g, us, them) {
  if (g.warmL == null) {
    g.warmed = 0
    const who = g.who, list = []
    const me = { color: us.color, trim: us.trim, pants: us.trim, skin: who.me?.skin ?? skinOf(6), number: who.me?.number ?? 22, kit: 'pads', carry: true, pose: null }
    for (let s = 0; s < 8; s++) list.push({ ...me, dir: 'up', step: s / 2, pose: 'sprint' })
    for (const pose of ['plant-l', 'plant-r', 'catch-l', 'touch', 'spike-up', 'flex', 'point-up', 'griddy-a', 'griddy-b', 'arms-up']) list.push({ ...me, dir: 'up', pose })
    const T = { color: them.color, trim: them.trim, pants: them.trim, skin: skinOf(2), number: 44, kit: 'pads', carry: false }
    for (const step of [0, 1, 2, 3]) list.push({ ...T, dir: 'down', step, pose: null })
    for (const pose of ['wrap', 'dive', 'block', 'ready']) list.push({ ...T, dir: 'down', pose })
    g.warmL = list
  }
  for (let n = 0; n < 4 && g.warmed < g.warmL.length; n++, g.warmed++) warmAthlete(g.warmL[g.warmed])
}
void BAD; void GOLD
