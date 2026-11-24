// The Slam Dunk Contest: one run is one dunk attempt, picked before it starts (DUNKS). Shot from the side, like the
// broadcast: the judges' table along the far sideline, the building behind it, the rim on the left and the run-up
// coming in from the right.
//   1. The takeoff. He runs at the gold mark on the floor; a ring closes on it. Tap as his plant foot hits it.
//      Early and he's left from too far out: short, off the front of the rim. Late and he's under it: off the back iron.
//   2. The move in the air (medium and hard dunks): a ring closes on the ball. A hold (the windmill, the rock, the spin,
//      the split) is let go as it meets the ball; a tap (the leg swap, the pump, the cock) is tapped as it does. Off on
//      it and he can't hang on to it: the ball comes loose.
//   3. The finish. A ring closes on the rim: tap as it meets the iron. Early, he jams it into the front rim; late, he's
//      on the way down and it comes off the back iron.
// Harder dunks have more steps and tighter windows, and score more with the judges (career's screens judge them from
// raw: tier, landed, quality, attempt). The window comes from the player's grade: v is the mean of his Finishing and
// Bounce on 0-11; invitees are 9 to 11. The hard ones go to slow motion at the top of the jump (the rules run on in
// slow time, and the windows are the same in real time, so it's the look, not a softer window).
import { clamp, lerp, prog, easeOut, easeIn, easeInOut, rngOf, outcome, layer, text, basketball, nudge, GOOD, BAD, GOLD, DISPLAY, LABEL } from './kit.js'
import { pose, mixPose, copyPose, newPose, easedState, easedPose, smoothT, CLK, athlete, athleteFront, paintBowl, crowdUp, camFlashes, boardFlash, lightFx, warmCrowd, FIG_FT, BALL_R, SKINS, R_UP, R_FLEX, R_HEAD, R_HIPS } from './meter.js'
import { standAt, SCOUT, FOLK_SKIN } from './dash.js'
import { nameTag } from './art.js'
import { castMen } from './read.js'

export const how = {
  'dunk-contest': 'Tap as the ring closes on the takeoff mark. In the air, hold and let go, or tap, as each ring meets the ball. Then tap as the ring meets the rim to throw it down.',
}

// ── The dunks ───────────────────────────────────────────────────────────────
// id, name, tier, and a line the way the broadcast would call it
export const DUNKS = [
  { id: 'two-hand', name: 'Two-Hand Power Jam', tier: 'easy', line: 'Up off two feet and hammers it home with both hands.' },
  { id: 'tomahawk', name: 'Tomahawk', tier: 'easy', line: 'Cocks it way back behind his head and brings the hammer down.' },
  { id: 'reverse', name: 'Reverse', tier: 'easy', line: 'Turns his back to the rim and throws it down over his head.' },
  { id: 'windmill', name: 'Windmill', tier: 'medium', line: 'Takes it all the way around and finishes it at the top.' },
  { id: 'cradle', name: 'Cradle Rock', tier: 'medium', line: 'Rocks it down by his hip and swings it up through the rim, the Dr. J special.' },
  { id: 'bounce-legs', name: 'Between the Legs', tier: 'medium', line: 'Off his own bounce, catches it at the top and takes it under the leg.' },
  { id: 'double-clutch', name: 'Double Clutch', tier: 'medium', line: 'Brings it all the way down, hangs, and pumps it back up to flush it.' },
  { id: '360-windmill', name: '360 Windmill', tier: 'hard', line: 'A full turn in the air, then the windmill on the way to the rim.' },
  { id: 'ft-line', name: 'Free-Throw Line', tier: 'hard', line: 'Takes off from the stripe, fifteen feet out, and glides the whole way in.' },
  { id: 'legs-360', name: 'Between the Legs 360', tier: 'hard', line: 'Spins all the way around and takes it through the legs before he finishes.' },
]
const DUNK_OF = Object.fromEntries(DUNKS.map(d => [d.id, d]))

// ── Timing ──────────────────────────────────────────────────────────────────
const RUN0 = 1000          // the walk-up's over: he goes
const T1 = 2600            // his plant foot on the mark, if he's on time
const RUN_V = 0.0165       // feet a ms at full speed (16.5 ft/s)
const ACCEL = 420          // ms to full speed
const STRIDE = 640         // ms for two steps
const LEAD_TAKE = 820, LEAD_AIR = 480    // how long a ring takes to close (game ms; the air's in slow time on the hard ones)
const DROP = 320           // off the rim to the floor
const HOLD_MIN = 130       // a touch this short is a tap, not a hold
// the half-window in real ms at grade 9, and what each grade either side is worth
const WIN = { easy: [111, 0.19], medium: [84, 0.1], hard: [79, 0.065] }
const winOf = (tier, v) => WIN[tier][0] * Math.max(0.32, 1 + WIN[tier][1] * (clamp(v, 0, 11) - 9) * (v < 9 ? 0.55 : 1))
const SLOW_RATE = 0.42, SLOW_RAMP = 100

// ── The poses (the side rig, lib/mg/meter.js: x forward, y up from the floor, 110 to a man) ─────
const STANDB = pose({ hy: 46, fFx: 10, fBx: -9, hFx: 16, hFy: 62, hBx: 14, hBy: 64 })
const PLANT = pose({ hy: 40, lean: 0.08, fFx: 16, fBx: -16, fBy: 8, hFx: 10, hFy: 56, hBx: 8, hBy: 58 })
const TAKE1 = pose({ hy: 48, lean: 0.04, fFx: -6, toeF: 0.9, fBx: 14, fBy: 30, hFx: 18, hFy: 100, hBx: 16, hBy: 100 })
const TAKE2 = pose({ hy: 48, lean: 0.02, fFx: 3, toeF: 0.9, fBx: -3, toeB: 0.9, hFx: 14, hFy: 104, hBx: 12, hBy: 104 })
const UP2 = pose({ hy: 47, fFx: 10, fFy: 26, fBx: 2, fBy: 22, hFx: 10, hFy: 122, hBx: 8, hBy: 122 })
const COCK2 = pose({ hy: 47, lean: -0.12, fFx: -10, fFy: 30, fBx: -16, fBy: 26, hFx: -4, hFy: 122, hBx: -6, hBy: 122 })
const SLAM2 = pose({ hy: 47, lean: 0.1, fFx: 6, fFy: 18, fBx: -4, fBy: 26, hFx: 24, hFy: 112, hBx: 22, hBy: 112 })
const RISE1 = pose({ hy: 47, fFx: 10, fFy: 26, fBx: 2, fBy: 22, hFx: 12, hFy: 120, hBx: 16, hBy: 104 })
const TCOCK = pose({ hy: 47, lean: -0.15, fFx: -10, fFy: 32, fBx: -16, fBy: 28, hFx: -20, hFy: 112, hBx: 26, hBy: 98 })
const SLAM1 = pose({ hy: 47, lean: 0.1, fFx: 6, fFy: 18, fBx: -6, fBy: 28, hFx: 24, hFy: 112, hBx: -10, hBy: 76 })
const AWAY2 = pose({ hy: 47, lean: 0.06, fFx: 10, fFy: 24, fBx: 4, fBy: 22, hFx: 12, hFy: 118, hBx: 10, hBy: 118 })
const REVSLAM = pose({ hy: 47, lean: -0.28, fFx: 14, fFy: 22, fBx: 8, fBy: 26, hFx: -24, hFy: 110, hBx: -22, hBy: 110 })
const CHEST = pose({ hy: 47, fFx: 12, fFy: 28, fBx: 4, fBy: 24, hFx: 16, hFy: 84, hBx: 14, hBy: 84 })
const WMILL = pose({ hy: 47, lean: 0.02, fFx: 10, fFy: 26, fBx: -2, fBy: 24, hFx: 20, hFy: 80, hBx: 18, hBy: 96 })
const ROCK = pose({ hy: 47, lean: 0.12, fFx: 10, fFy: 28, fBx: -4, fBy: 30, hFx: 20, hFy: 80, hBx: 20, hBy: 96 })
const CATCH = pose({ hy: 48, lean: 0.04, fFx: -4, fFy: 2, toeF: 0.8, fBx: 14, fBy: 30, hFx: 22, hFy: 96, hBx: 18, hBy: 94 })
const KNEE_N = pose({ hy: 47, lean: 0.08, fFx: 16, fFy: 36, fBx: -8, fBy: 20, hFx: 14, hFy: 52, hBx: 4, hBy: 56 })
const UNDER_F = pose({ hy: 47, lean: 0.08, fFx: 16, fFy: 36, fBx: -8, fBy: 20, hFx: 12, hFy: 58, hBx: 0, hBy: 44 })
const FARUP = pose({ hy: 47, fFx: 10, fFy: 26, fBx: 2, fBy: 22, hFx: 18, hFy: 100, hBx: 6, hBy: 122 })
const SLAMF = pose({ hy: 47, lean: 0.1, fFx: 6, fFy: 18, fBx: -6, fBy: 28, hFx: -8, hFy: 82, hBx: 24, hBy: 112 })
const CLUTCH = pose({ hy: 47, lean: 0.06, fFx: 14, fFy: 34, fBx: 6, fBy: 30, hFx: 16, hFy: 70, hBx: 14, hBy: 72 })
const CLUTCH_LO = pose({ hy: 47, lean: 0.08, fFx: 15, fFy: 36, fBx: 7, fBy: 32, hFx: 15, hFy: 62, hBx: 13, hBy: 64 })
const SPLIT = pose({ hy: 48, lean: 0.04, fFx: 34, fFy: 22, fBx: -34, fBy: 26, hFx: 26, hFy: 96, hBx: -22, hBy: 92 })
const SPLIT2 = pose({ hy: 48, lean: 0.02, fFx: 33, fFy: 24, fBx: -33, fBy: 28, hFx: 28, hFy: 100, hBx: -24, hBy: 96 })
const HANGP = pose({ hy: 46, fFx: 6, fFy: 4, fBx: -2, fBy: 6, hFx: 6, hFy: 121, hBx: 4, hBy: 121 })
const HANG1 = pose({ hy: 46, fFx: 6, fFy: 4, fBx: -2, fBy: 6, hFx: 6, hFy: 121, hBx: -16, hBy: 88 })
const FALLP = pose({ hy: 46, lean: 0.06, fFx: 10, fFy: 2, fBx: -6, fBy: 4, hFx: 22, hFy: 92, hBx: -14, hBy: 90 })
const LANDP = pose({ hy: 33, lean: 0.28, fFx: 14, fBx: -12, hFx: 24, hFy: 52, hBx: 18, hBy: 50 })
const FLAIL = pose({ hy: 47, lean: 0.12, fFx: 12, fFy: 16, fBx: -10, fBy: 22, hFx: 30, hFy: 98, hBx: -14, hBy: 100 })
// the front rig (meter.js athleteFront): mid-turn, the ball tucked or up over his head
const F_TUCK = pose({ hy: 46, fFx: 11, fFy: 24, fBx: -11, fBy: 22, hFx: 8, hFy: 84, hBx: -8, hBy: 84 })
const F_UP = pose({ hy: 47, fFx: 9, fFy: 14, fBx: -9, fBy: 12, hFx: 7, hFy: 122, hBx: -7, hBy: 122 })

// A dunk: where he leaves from (feet from the rim), how long he's up (F, ms) and how high (H, feet of hip), the finish
// (ms after takeoff), his time on the rim, and the move in between. keys: the body through the air, ms after takeoff;
// b: the ball in the near hand, the far hand or both ('n' 'f' '2'), 'x' loose; phi: the near arm round its shoulder
// (degrees, 0 straight ahead, 90 straight up). spin: a turn in the air [from, to, turns]. slow: slow motion [from, to].
// moves: what's timed in the air (noun: what a miss is called on).
const k = (t, p, b = '2', phi = null) => ({ t, p, b, phi })
const SPEC = {
  'two-hand': { stamp: 'POWER JAM', take: 4.6, two: true, F: 880, H: 3.3, fin: 500, hang: 380, moves: [],
    keys: [k(0, TAKE2), k(150, UP2), k(360, COCK2), k(500, SLAM2)] },
  tomahawk: { stamp: 'TOMAHAWK', take: 5, F: 900, H: 3.35, fin: 520, hang: 260, one: true, moves: [],
    keys: [k(0, TAKE1), k(170, RISE1, 'n'), k(390, TCOCK, 'n'), k(520, SLAM1, 'n')] },
  reverse: { stamp: 'REVERSE JAM', take: 3.3, F: 900, H: 3.3, fin: 520, hang: 0, xFin: 0.95, spin: [80, 340, 0.5], moves: [],
    keys: [k(0, TAKE1), k(200, UP2), k(380, AWAY2), k(520, REVSLAM)] },
  windmill: { stamp: 'WINDMILL', take: 5.2, F: 980, H: 3.45, fin: 560, hang: 200, one: true,
    moves: [{ kind: 'hold', at: 360, hold: 'HOLD TO WIND IT UP', noun: 'WINDMILL' }],
    keys: [k(0, TAKE1), k(120, WMILL, 'n', -40), k(240, WMILL, 'n', -150), k(360, WMILL, 'n', -250), k(470, WMILL, 'n', -292), k(560, SLAM1, 'n')] },
  cradle: { stamp: 'CRADLE ROCK', take: 5.2, F: 980, H: 3.45, fin: 560, hang: 0, one: true,
    moves: [{ kind: 'hold', at: 330, hold: 'HOLD TO ROCK IT', noun: 'ROCK' }],
    keys: [k(0, TAKE1), k(130, ROCK, 'n', 55), k(330, ROCK, 'n', -112), k(450, ROCK, 'n', 96), k(560, SLAM1, 'n')] },
  'bounce-legs': { stamp: 'THROUGH THE LEGS', take: 5, F: 1000, H: 3.45, fin: 580, hang: 0, bounce: true,
    moves: [{ kind: 'tap', at: 370, verb: 'UNDER THE LEG', noun: 'LEG SWAP' }],
    keys: [k(0, CATCH, 'x'), k(150, RISE1, 'n'), k(280, KNEE_N, 'n'), k(345, KNEE_N, 'n'), k(395, UNDER_F, 'f'), k(490, FARUP, 'f'), k(580, SLAMF, 'f')] },
  'double-clutch': { stamp: 'DOUBLE CLUTCH', take: 5, F: 1020, H: 3.5, fin: 600, hang: 300,
    moves: [{ kind: 'tap', at: 380, verb: 'PUMP IT BACK UP', noun: 'PUMP' }],
    keys: [k(0, TAKE1), k(150, UP2), k(280, CLUTCH), k(380, CLUTCH_LO), k(500, UP2), k(600, SLAM2)] },
  '360-windmill': { stamp: '360 WINDMILL', take: 5.6, F: 1150, H: 3.7, fin: 640, hang: 240, one: true, spin: [60, 330, 1], slow: [380, 600],
    moves: [{ kind: 'hold', at: 330, hold: 'HOLD THE SPIN', noun: 'SPIN' }, { kind: 'tap', at: 470, verb: 'WINDMILL IT', noun: 'WINDMILL' }],
    keys: [k(0, TAKE1), k(150, CHEST), k(330, CHEST), k(360, WMILL, 'n', -45), k(410, WMILL, 'n', -150), k(470, WMILL, 'n', -250), k(560, WMILL, 'n', -292), k(640, SLAM1, 'n')] },
  'ft-line': { stamp: 'FROM THE LINE', take: 14.15, F: 1300, H: 3.65, fin: 800, hang: 0, one: true, slow: [420, 780], takeW: 0.96,
    moves: [{ kind: 'hold', at: 420, hold: 'HOLD THE SPLIT', noun: 'GLIDE' }, { kind: 'tap', at: 620, verb: 'COCK IT BACK', noun: 'COCK' }],
    keys: [k(0, TAKE1), k(180, SPLIT, 'n'), k(420, SPLIT2, 'n'), k(520, RISE1, 'n'), k(620, TCOCK, 'n'), k(800, SLAM1, 'n')] },
  'legs-360': { stamp: '360 THROUGH THE LEGS', take: 5.6, F: 1150, H: 3.7, fin: 640, hang: 200, spin: [60, 330, 1], slow: [380, 600],
    moves: [{ kind: 'hold', at: 330, hold: 'HOLD THE SPIN', noun: 'SPIN' }, { kind: 'tap', at: 470, verb: 'UNDER THE LEG', noun: 'LEG SWAP' }],
    keys: [k(0, TAKE1), k(150, CHEST), k(330, CHEST), k(400, KNEE_N, 'n'), k(445, KNEE_N, 'n'), k(495, UNDER_F, 'f'), k(560, FARUP, 'f'), k(640, SLAMF, 'f')] },
}
const X_FIN = 1.35          // his hips at the finish of a dunk going forward, feet from the rim
const RIM_IN = { x: 0, y: 10.45 }, FRONT_IRON = { x: 0.72, y: 10.12 }, BACK_IRON = { x: -0.66, y: 10.12 }
const RIM_FT = 10, RIM_HALF = 0.75, BOARD_X = -1.25

// slow motion: the rate the rules run at, ms after takeoff
function rateAt(S, tau) {
  if (!S.slow || tau == null) return 1
  const [a, b] = S.slow
  const f = tau < a - SLOW_RAMP || tau > b + SLOW_RAMP ? 0 : tau < a ? (tau - a + SLOW_RAMP) / SLOW_RAMP : tau > b ? 1 - (tau - b) / SLOW_RAMP : 1
  return 1 - (1 - SLOW_RATE) * easeInOut(clamp(f, 0, 1))
}
// where he is on the run-up (feet from the rim), at game time t
function runD(s) { return s <= 0 ? 0 : s < ACCEL ? (RUN_V * s * s) / (2 * ACCEL) : RUN_V * (s - ACCEL / 2) }
const runX = (S, t) => S.take + runD(T1 - RUN0) - runD(t - RUN0)

export function make({ v, seed, def }) {
  const id = SPEC[def?.dunk] ? def.dunk : 'windmill'
  const S = SPEC[id], D = DUNK_OF[id]
  const look = rngOf(`${seed}|look`)   // (what things look like, never what happens)
  const W = winOf(D.tier, v)
  const steps = [
    { kind: 'take', T: T1, W: W * (S.takeW ?? 1), cueAt: T1 - LEAD_TAKE, lead: LEAD_TAKE, rate: 1, liveAt: 0, noun: 'TAKEOFF' },
    ...S.moves.map(m => ({ ...m, T: null, W: null, cueAt: null, lead: null, rate: 1, liveAt: null })),
    { kind: 'fin', at: S.fin, T: null, W: null, cueAt: null, lead: null, rate: 1, liveAt: null, noun: 'FINISH' },
  ]
  for (const s of steps) { s.res = null; s.e = null; s.q = 0 }
  const g = {
    t: 0, game: 'dunk-contest', zones: 'none', fx: [], done: null, outro: 2200, stamp: null, nudge: nudge(),
    id, dunk: D, S, steps, k: 0, W, v, rate: 1, p1: null, held: false, downAt: null, downK: -1,
    fail: null, landed: false, tf: null, clank: null, lost: null, doneAt: null, landAt: null,
    attempt: def?.attempt ?? 1, label: def?.label ?? null,
    flair: look(), popDir: look() < 0.5 ? 1 : -1,
    hud: { prompt: null, dots: steps.map(() => null), hot: false },
    ev: [],
    tauNow: () => (g.p1 == null ? null : g.t - g.p1),
    tick(dt) {
      g.rate = rateAt(S, g.tauNow())
      g.t += dt * g.rate
      for (const e of g.ev) if (!e.done && g.t >= e.at) { e.done = true; e.fn() }
      const s = steps[g.k]
      if (s && !g.fail && s.T != null && g.t > s.T + s.W) {
        if (s.kind === 'take') { takeoff(g.t) } else fail(s, 'late', s.T + s.W)
      }
      prompt()
    },
    input(a) {
      if (a.kind === 'up') { const was = g.held; g.held = false; if (was) release(); return }
      if (a.kind !== 'down') return
      g.held = true; g.downAt = g.t; g.downK = g.k
      const s = steps[g.k]
      if (!s || g.fail || g.done || s.T == null) return
      if (s.kind === 'hold') return            // (the grip: it's the letting go that's timed)
      if (g.t < s.cueAt) return               // (nothing to time yet)
      if (s.kind === 'take') takeoff(g.t); else judge(s, g.t)
    },
  }
  function release() {
    const s = steps[g.k]
    if (!s || g.fail || g.done || s.kind !== 'hold' || s.T == null) return
    // (the last step's tap lifting off isn't letting go of this one; a finger kept down through it is a hold)
    if (g.downK !== g.k && g.t - g.downAt < HOLD_MIN) return
    if (g.t < s.T - 3 * s.W) return          // let go long before it: he wasn't into it yet
    judge(s, g.t)
  }
  const qOf = (e, w) => 1 - 0.75 * Math.min(1, Math.abs(e) / w) ** 1.4
  function takeoff(t) {
    const s = steps[0]
    g.p1 = t
    const e = t - s.T
    if (Math.abs(e) <= s.W) {
      s.res = true; s.e = e; s.q = qOf(e, s.W); g.hud.dots[0] = true
      g.fx.push('h:light')
      // the steps in the air, from the moment he left the floor (so a takeoff a touch off doesn't carry into them)
      for (let i = 1; i < steps.length; i++) {
        const st = steps[i]
        st.T = t + st.at; st.rate = rateAt(S, st.at); st.W = W * st.rate; st.lead = LEAD_AIR * st.rate; st.cueAt = st.T - st.lead
      }
      advance(t)
    } else fail(s, e < 0 ? 'early' : 'late', t)
  }
  function judge(s, t) {
    const e = t - s.T
    if (Math.abs(e) > s.W) return fail(s, e < 0 ? 'early' : 'late', t)
    s.res = true; s.e = e; s.q = qOf(e, s.W); g.hud.dots[g.k] = true
    if (s.kind === 'fin') return land(t)
    g.fx.push('h:light')
    advance(t)
  }
  function advance(t) { g.k++; const n = steps[g.k]; if (n) n.liveAt = t }
  const after = (at, fn) => g.ev.push({ at, fn, done: false })
  function land(t) {
    g.landed = true; g.tf = t; g.k = steps.length
    g.fx.push('h:medium')
    after(t + 90, () => {
      const quality = steps.reduce((a, s) => a + s.q, 0) / steps.length
      g.quality = quality
      finish(true, `${D.name}: landed it`)
      g.fx.push('make', 'snd-roar', 'stamp', 'h:heavy')
      g.nudge.kick(g.t, D.tier === 'hard' ? 6.5 : D.tier === 'medium' ? 5.5 : 4.6, 0, 1, 240)
      g.stamp = { text: S.stamp, good: true, at: g.t, size: 40 }
    })
  }
  function fail(s, why, t) {
    s.res = false; s.e = t - (s.T ?? t); g.hud.dots[g.k] = false
    g.fail = { k: g.k, why, at: t, kind: s.kind, noun: s.noun }
    g.k = steps.length
    if (s.kind === 'take') {
      // he goes anyway, from where he is: the dunk plays out, and the ball's short or he's under it
      g.p1 = t
      g.fx.push('h:light')
      g.clank = { at: t + S.fin, front: why === 'early', from: t + S.fin - 80 }
      after(g.clank.at, () => clankNow(why === 'early' ? 'OFF THE FRONT RIM' : 'OFF THE BACK IRON'))
    } else if (s.kind === 'fin') {
      const at = why === 'early' ? t + 90 : t + 110
      g.clank = { at, front: why === 'early', from: t }
      after(at, () => clankNow(why === 'early' ? 'OFF THE FRONT RIM' : 'OFF THE BACK IRON'))
    } else {
      // the move went wrong: it's out of his hands
      g.lost = { at: t }
      g.fx.push('deny', 'h:light')
      finish(false, `${D.name}: lost the ball`)
      g.stamp = { text: 'LOST THE BALL', good: false, at: g.t, size: 40 }
    }
  }
  function clankNow(word) {
    g.fx.push('rimmiss', 'h:medium')
    g.nudge.kick(g.t, 2.4, 0, 1, 170)
    finish(false, `${D.name}: ${word.toLowerCase()}`)
    g.stamp = { text: word, good: false, at: g.t, size: 40 }
  }
  function finish(landed, note) {
    const quality = landed ? Math.round(g.quality * 1000) / 1000 : 0
    g.done = outcome(landed ? 0.5 + 0.5 * quality : 0, landed, note, { dunk: id, tier: D.tier, landed, quality, steps: steps.map(s => s.res === true) })
    g.doneAt = g.t
    g.outro = landed ? 2200 + S.hang : 2000
    g.hud.prompt = null; g.hud.hot = false
  }
  function prompt() {
    const s = steps[g.k]
    if (!s || g.fail || g.done || s.T == null || g.t < Math.max(s.cueAt, s.liveAt ?? 0)) { g.hud.prompt = null; g.hud.hot = false; return }
    g.hud.hot = true
    g.hud.prompt = s.kind === 'take' ? 'TAKE OFF ON THE MARK' : s.kind === 'fin' ? 'THROW IT DOWN' : s.kind === 'hold' ? (g.held && (g.downK === g.k || g.t - g.downAt >= HOLD_MIN) ? 'LET GO ON THE RING' : s.hold) : s.verb
  }
  g.rateAt = tau => rateAt(S, tau)
  return g
}

// A perfect thumb, for the how-to-play card (MgDemo): on every ring, every time
export function pilot(g) {
  let pressed = -1, gripped = -1, upAt = Infinity
  return () => {
    const out = []
    if (g.t >= upAt) { upAt = Infinity; out.push({ kind: 'up', zone: null, x: 180, y: 400 }) }
    const s = g.steps[g.k]
    if (s && !g.fail && s.T != null) {
      if (s.kind === 'hold') {
        if (gripped !== g.k && g.t >= Math.max(s.cueAt, s.liveAt ?? 0) + 40) { gripped = g.k; if (!g.held) out.push({ kind: 'down', zone: null, x: 180, y: 400 }); upAt = Infinity }
        if (gripped === g.k && g.held && g.t >= s.T) out.push({ kind: 'up', zone: null, x: 180, y: 400 })
      } else if (pressed !== g.k && g.t >= s.T) {
        pressed = g.k
        out.push({ kind: 'down', zone: null, x: 180, y: 400 }); upAt = g.t + 80
      }
    }
    return out.length ? out : undefined
  }
}
// (the demo's one rep is the whole dunk, and it plays out a little before it starts again)
export const demoRep = g => (g.done ? g.done.hit : null)
export const demoAfter = 1700

// ── The picture ─────────────────────────────────────────────────────────────
const DEG = Math.PI / 180
const BALL_RIG = BALL_R * FIG_FT
// the shoulder the arm hangs from (the side rig's, in its own units, y up, before the jump)
const SH = { x: 0, y: 0 }
function shoulder(P, far) { SH.x = P.hx + Math.sin(P.lean) * 37 + (far ? 2 : -1); SH.y = P.hy + Math.cos(P.lean) * 37 - 3; return SH }
// where a hand really gets to (the arm's 39 long) and the ball in it, a little past the palm
const HB = { x: 0, y: 0 }
function ballInHand(P, far) {
  const s = shoulder(P, far), hx = far ? P.hBx : P.hFx, hy = far ? P.hBy : P.hFy
  let dx = hx - s.x, dy = hy - s.y, d = Math.hypot(dx, dy) || 1
  if (d > 38.5) { dx *= 38.5 / d; dy *= 38.5 / d; d = 38.5 }
  HB.x = s.x + dx + (dx / d) * 5.5; HB.y = s.y + dy + (dy / d) * 5.5
  return HB
}
function ballOf(P, b, out) {
  if (b === '2') { ballInHand(P, false); const x = HB.x, y = HB.y; ballInHand(P, true); out.x = (x + HB.x) / 2; out.y = (y + HB.y) / 2 + 2 }
  else { ballInHand(P, b === 'f'); out.x = HB.x; out.y = HB.y }
  return out
}
// the body through the air, ms after takeoff: the pose, and the ball in his hands (rig units) and which hand
const KP = newPose(), KA = { x: 0, y: 0 }, KB = { x: 0, y: 0 }
const KEY = { b: '2', far: false, bx: 0, by: 0 }
function keyed(S, tau, out) {
  const ks = S.keys
  let i = 0
  while (i < ks.length - 1 && tau >= ks[i + 1].t) i++
  const a = ks[i], b = ks[Math.min(i + 1, ks.length - 1)]
  const f = b === a ? 0 : easeInOut(clamp((tau - a.t) / (b.t - a.t), 0, 1))
  mixPose(a.p, b.p, f, out)
  // the near arm round its shoulder, when the keys say so
  if (a.phi != null || b.phi != null) {
    const sh = shoulder(out, false)
    const handAt = (phi, P) => (phi == null ? { x: P.hFx, y: P.hFy } : { x: sh.x + 38 * Math.cos(phi * DEG), y: sh.y + 38 * Math.sin(phi * DEG) })
    if (a.phi != null && b.phi != null) { const phi = lerp(a.phi, b.phi, f); out.hFx = sh.x + 38 * Math.cos(phi * DEG); out.hFy = sh.y + 38 * Math.sin(phi * DEG) }
    else { const ha = handAt(a.phi, a.p), hb = handAt(b.phi, b.p); out.hFx = lerp(ha.x, hb.x, f); out.hFy = lerp(ha.y, hb.y, f) }
  }
  // the ball: in whichever hand has it, passing between them
  KEY.b = f < 0.5 ? a.b : b.b
  if (a.b === 'x' || b.b === 'x') { KEY.b = 'x'; if (b.b !== 'x' && f > 0.5) KEY.b = b.b }
  if (KEY.b !== 'x') {
    const ba = a.b === 'x' ? b.b : a.b, bb = b.b === 'x' ? a.b : b.b
    ballOf(out, ba, KA); ballOf(out, bb, KB)
    KEY.bx = lerp(KA.x, KB.x, f); KEY.by = lerp(KA.y, KB.y, f)
  }
  KEY.far = KEY.b === 'f'
  return KEY
}
const spinOf = (S, tau) => (S.spin ? 2 * Math.PI * S.spin[2] * easeInOut(prog(tau, S.spin[0], S.spin[1])) : 0)
const spinEnd = S => (S.spin ? 2 * Math.PI * S.spin[2] : 0)

// a ball loose: from (x, y) at t0 with (vx, vy) in feet a ms, bouncing on the floor
const GRAV = 32e-6
const FB = { x: 0, y: 0 }
function freeAt(f, t) {
  let x = f.x, y = f.y, vx = f.vx, vy = f.vy, a = Math.max(0, t - f.t0)
  for (let n = 0; n < 7; n++) {
    const s = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * GRAV * (y - BALL_R)))) / GRAV
    if (a <= s) { FB.x = x + vx * a; FB.y = y + vy * a - 0.5 * GRAV * a * a; return FB }
    a -= s; x += vx * s; y = BALL_R; vy = -(vy - GRAV * s) * 0.56; vx *= 0.78
    if (vy < 0.003) break
  }
  FB.x = x + vx * Math.min(a, 900) * (1 - Math.min(a, 900) / 1800); FB.y = BALL_R
  return FB
}

// The view: a side-on camera that pans and pushes in. Feet across from the rim (x), feet up (y), feet into the
// picture (z, the far sideline at -25). The floor's depth is drawn flat under a slight lean in, so the court reads.
function geoOf(view) {
  const U = view.h / 640, floorY = Math.round(view.h * 0.79)
  return { U, floorY, wallY: floorY - Math.round(118 * U), dz: (118 * U) / 25, kMax: Math.min(27 * U + 1, (floorY - 74) / 13.3), kMin: 13.5 }
}
const PK = z => 1 + 0.0105 * z

// The house: a full building, the courtside board, the floor (painted once)
function paintHouse(x, view, G, c) {
  paintBowl(x, view, { horizon: G.wallY, us: c.us, trim: c.trim, dim: 0, seed: 'dunk-contest'.length, board: 'SLAM DUNK CONTEST', cheer: 0 })
  const fl = x.createLinearGradient(0, G.wallY, 0, view.h)
  fl.addColorStop(0, '#a87543'); fl.addColorStop(0.45, '#c8935a'); fl.addColorStop(1, '#dbaa72')
  x.fillStyle = fl; x.fillRect(0, G.wallY, view.w, view.h - G.wallY)
  for (const lx of [62, 180, 298]) {
    x.save(); x.translate(lx, G.wallY + (view.h - G.wallY) * 0.22); x.scale(1, 0.24)
    const r = x.createRadialGradient(0, 0, 4, 0, 0, 80)
    r.addColorStop(0, 'rgba(255,244,220,.2)'); r.addColorStop(1, 'rgba(255,244,220,0)')
    x.fillStyle = r; x.beginPath(); x.arc(0, 0, 80, 0, 6.3); x.fill(); x.restore()
  }
  x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, G.wallY, view.w, 2)
}

// the dunker's frame: the rim (and a bit of the stanchion) and him, as close as both fit
function aim(g, G, bx, tau) {
  const left = -3.4, right = bx + 3.2, span = right - left
  let kk = clamp(342 / span, G.kMin, G.kMax)
  let cx = span * kk <= 350 ? (left + right) / 2 : right - 172 / kk
  // the push in on the finish
  if (tau != null && !g.lost) {
    const near = Math.exp(-(((tau - g.S.fin) / 420) ** 2))
    kk = Math.min(G.kMax * 1.08, kk * (1 + 0.1 * near)); cx = lerp(cx, 1.1, 0.25 * near)
  }
  return { x: cx, k: kk }
}

// The hoop: the stanchion's padded base behind the baseline, the arm out to the board, the glass edge-on, the rim and
// the net. rot: the rim's tilt on its bracket (pulled down while he hangs, ringing after); netAge: ms since the ball
// went through; jolt: ms since the iron took a hit.
function hoop(ctx, V, c, part, rot, netAge, jolt) {
  const { SX, SY, k } = V
  const rimPt = (x, y) => { const dx = x - BOARD_X, dy = y - RIM_FT; return [SX(BOARD_X + dx * Math.cos(rot) - dy * Math.sin(rot)), SY(RIM_FT + dx * Math.sin(rot) + dy * Math.cos(rot))] }
  const ry = Math.max(1.6, 0.09 * k)
  if (part === 'back') {
    // the stanchion and its arm
    const px = SX(-9.4), base = SY(0)
    ctx.fillStyle = '#1b2127'; ctx.fillRect(SX(-11.6), base - 1.1 * k, SX(-7.4) - SX(-11.6), 1.1 * k + 4)
    ctx.fillStyle = c.us; ctx.fillRect(px - 0.55 * k, SY(6.4), 1.1 * k, SY(0.9) - SY(6.4))
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(px + 0.15 * k, SY(6.4), 0.4 * k, SY(0.9) - SY(6.4))
    ctx.strokeStyle = '#3a424b'; ctx.lineCap = 'butt'
    ctx.lineWidth = Math.max(2, 0.32 * k); ctx.beginPath(); ctx.moveTo(px, SY(6.2)); ctx.lineTo(px, SY(12.2)); ctx.lineTo(SX(-1.7), SY(11.7)); ctx.stroke()
    ctx.lineWidth = Math.max(1.5, 0.22 * k); ctx.beginPath(); ctx.moveTo(px, SY(8.6)); ctx.lineTo(SX(-1.7), SY(10.3)); ctx.stroke()
    // the glass, nearly edge-on: a sliver of its face and the white frame
    const bx0 = SX(BOARD_X - 0.42), bx1 = SX(BOARD_X), top = SY(13), bot = SY(9.5)
    ctx.fillStyle = 'rgba(205,225,235,.32)'; ctx.fillRect(bx0, top, bx1 - bx0, bot - top)
    ctx.strokeStyle = '#f4f6f8'; ctx.lineWidth = Math.max(1.4, 0.1 * k); ctx.strokeRect(bx0, top, bx1 - bx0, bot - top)
    ctx.fillStyle = '#f4f6f8'; ctx.fillRect(bx1 - 1, top, Math.max(2, 0.08 * k), bot - top)
    // the bracket and the back of the rim
    const [ax, ay] = rimPt(BOARD_X, RIM_FT), [bx, by] = rimPt(-RIM_HALF, RIM_FT)
    ctx.strokeStyle = '#b94c14'; ctx.lineWidth = Math.max(2, 0.16 * k); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
    ctx.strokeStyle = '#a8400f'; ctx.lineWidth = Math.max(1.8, 0.12 * k); ctx.beginPath()
    for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI, [x, y] = rimPt(Math.cos(a) * RIM_HALF, RIM_FT); if (i) ctx.lineTo(x, y + Math.sin(a) * ry); else ctx.moveTo(x, y + Math.sin(a) * ry) }
    ctx.stroke()
    return
  }
  if (part === 'net') {
    // the strands from the iron to a tighter ring a foot and a half down; through, it swells, whips up and swings
    let lift = 0, swing = 0, bulge = 0
    if (netAge != null && netAge >= 0 && netAge < 1300) {
      lift = Math.exp(-netAge / 300) * (0.45 + Math.sin(netAge / 46) * 0.3) * Math.min(1, netAge / 110)
      swing = Math.exp(-netAge / 420) * Math.sin(netAge / 78) * 0.3
      bulge = netAge < 260 ? Math.sin((netAge / 260) * Math.PI) * 0.35 : 0
    } else if (jolt != null && jolt >= 0 && jolt < 700) { swing = Math.exp(-jolt / 220) * Math.sin(jolt / 32) * 0.16; lift = Math.exp(-jolt / 180) * 0.12 }
    const N = 7, rows = 3, H = 1.5
    const P = []
    for (let r = 0; r <= rows; r++) {
      const f = r / rows, y = RIM_FT - H * f * (1 - lift * f), w = RIM_HALF * lerp(1, 0.56, f) * (1 + bulge * Math.sin(f * Math.PI)), sw = swing * f * f
      const row = []
      for (let i = 0; i < N; i++) { const u = lerp(-1, 1, (i + (r % 2) * 0.5) / (N - 0.5)); row.push(rimPt(u * w + sw, y)) }
      P.push(row)
    }
    ctx.strokeStyle = 'rgba(246,248,250,.92)'; ctx.lineWidth = Math.max(0.9, 0.05 * k); ctx.beginPath()
    for (let r = 0; r < rows; r++) for (let i = 0; i < N; i++) {
      const a = P[r][i], b = P[r + 1][i], b2 = P[r + 1][Math.min(N - 1, i + 1)]
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(a[0], a[1]); ctx.lineTo(b2[0], b2[1])
    }
    ctx.stroke()
    return
  }
  // the front of the rim, over the ball and the net
  ctx.strokeStyle = '#f26a1b'; ctx.lineWidth = Math.max(2.2, 0.15 * k); ctx.lineCap = 'round'; ctx.beginPath()
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI, [x, y] = rimPt(-Math.cos(a) * RIM_HALF, RIM_FT); if (i) ctx.lineTo(x, y + Math.sin(a) * ry); else ctx.moveTo(x, y + Math.sin(a) * ry) }
  ctx.stroke(); ctx.lineCap = 'butt'
}

// the floor's lines: the baseline, the lane, the free-throw circle, the restricted arc and the three, through the camera
function courtLines(ctx, V, c) {
  const { SX, SY } = V
  const P = (x, z) => [SX(x, z), SY(0, z)]
  const poly = (pts, close = false) => { ctx.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = P(x, z); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b) }); if (close) ctx.closePath() }
  // the paint
  poly([[-5.25, -8], [13.75, -8], [13.75, 8], [-5.25, 8]], true)
  ctx.fillStyle = c.us; ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1
  ctx.strokeStyle = 'rgba(247,245,239,.92)'; ctx.lineWidth = 2; ctx.stroke()
  poly([[-5.25, -25], [-5.25, 22]]); ctx.stroke()
  const arc = (cx, R, a0, a1, n) => { const pts = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push([cx + R * Math.cos(a), R * Math.sin(a)]) } return pts }
  poly(arc(13.75, 6, -Math.PI / 2, Math.PI / 2, 18)); ctx.stroke()
  poly(arc(0, 4, -Math.PI / 2, Math.PI / 2, 14)); ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 2
  const a = Math.asin(22 / 23.75)
  poly([[-5.25, -22], [23.75 * Math.cos(a), -22], ...arc(0, 23.75, -a, a, 30), [-5.25, 22]]); ctx.stroke()
}

// the judges' table on the far sideline: five of them, on their feet for a big one
const SUITS = ['#1e2329', '#2c3440', '#20262c', '#3b2f2a', '#1c2a3a']
function judges(ctx, V, view, g) {
  const { SX, SY, k } = V, z = -24, pz = PK(z), ft = k * pz
  const x0 = 3.6, x1 = 13.6, top = SY(2.3, z), bot = SY(0, z)
  if (SX(x1, z) < -40 || SX(x0, z) > view.w + 40) return
  const up = g.done?.hit ? g.t - g.doneAt : -1
  // (a man the size he'd be over there, a touch under it, so the far side doesn't crowd the dunk)
  const size = clamp((6 * ft) / 52 * 0.86, 0.8, 2.3)
  // (sitting: the same men a foot and a half lower, behind the table; nothing of them shows under it)
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, view.w, bot); ctx.clip()
  for (let i = 0; i < 5; i++) {
    const at = up - 90 - i * 70, stand = at > 0 && at < 2600 ? easeOut(clamp(at / 160, 0, 1)) * (at > 2300 ? 1 - (at - 2300) / 300 : 1) : 0
    const jx = SX(lerp(x0 + 1.1, x1 - 1.1, i / 4), z), drop = (1 - stand) * 0.95 * ft
    const hop = stand > 0.9 && g.dunk.tier !== 'easy' ? Math.abs(Math.sin((at + i * 90) / 140)) * 0.25 * ft : 0
    standAt(ctx, jx, bot + drop - hop, { ...SCOUT, color: SUITS[i], pants: '#2a2f36', skin: FOLK_SKIN[(i * 2) % FOLK_SKIN.length], size, pose: stand > 0.5 ? 'arms-up' : null })
  }
  ctx.restore()
  // the table: a white top, the skirt in the house's colour, the cards out in front of each of them
  const L = SX(x0, z), R = SX(x1, z)
  ctx.fillStyle = '#10161c'; ctx.fillRect(L, top, R - L, bot - top)
  ctx.globalAlpha = 0.55; ctx.fillStyle = V.c.us; ctx.fillRect(L, top, R - L, bot - top); ctx.globalAlpha = 1
  ctx.fillStyle = '#e9edf0'; ctx.fillRect(L - 2, top - 2, R - L + 4, Math.max(2, 0.12 * ft))
  for (let i = 0; i < 5; i++) { const cx = SX(lerp(x0 + 1.1, x1 - 1.1, i / 4) + 0.75, z); ctx.fillRect(cx - 0.25 * ft, top - 0.22 * ft, 0.5 * ft, 0.2 * ft) }
  text(ctx, 'JUDGES', (L + R) / 2, (top + bot) / 2 + 1, { font: LABEL, size: clamp((bot - top) * 0.42, 13, 16), color: 'rgba(255,255,255,.8)', track: 3 })
}

// a ring that closes on a mark: gold as it closes, green while it's on
function ringAt(ctx, x, y, r0, s, t, U, flat = 1) {
  const left = s.T - t, f = clamp(left / s.lead, 0, 1), on = Math.abs(left) <= s.W
  ctx.lineWidth = 2 * U; ctx.strokeStyle = 'rgba(255,255,255,.55)'
  ctx.beginPath(); ctx.ellipse(x, y, r0, r0 * flat, 0, 0, Math.PI * 2); ctx.stroke()
  if (left < -s.W) return
  const r = r0 + f * 48 * U
  ctx.lineWidth = (on ? 4 : 3.2) * U; ctx.strokeStyle = on ? GOOD : GOLD
  ctx.beginPath(); ctx.ellipse(x, y, r, r * flat, 0, 0, Math.PI * 2); ctx.stroke()
}

const PB = newPose(), PE = easedState(), PF = newPose(), FE = easedState()
const BW = { x: 0, y: 0 }
const TIER_INK = { easy: GOOD, medium: GOLD, hard: BAD }
export function draw(ctx, g, view) {
  const G = geoOf(view), { U, floorY } = G, c = view.colors, S = g.S, D = g.dunk, t = g.t
  smoothT(g)   // (only for the frame's length: the picture runs on the rules' own clock, slow motion and all)
  const M = castMen(g, view)
  const me = M?.us[0] ?? null
  const name = String(g.label ?? me?.name ?? 'GUEST').toUpperCase()
  const look = { jersey: c.us, trim: c.trim, skin: me?.skin ?? SKINS[0], num: me?.number ?? 1 }
  const tau = g.p1 == null ? null : t - g.p1
  const dtG = CLK.dt * g.rate

  // ── where he is: on the run-up, in the air, on the rim, down ──
  const landed = g.landed, hangMs = landed ? S.hang : 0
  const xFin = (S.xFin ?? X_FIN) + (g.fail?.k === 0 ? (g.fail.why === 'early' ? 1.9 : -1.45) : 0)
  const Hrig = S.H * FIG_FT
  let bx, j = 0, theta = 0, mode = 'run', P = PB, ball = null, ballFar = false, ballLoose = null
  const x0 = runX(S, 0)
  // the end of his time in the air
  const jHang = RIM_FT * FIG_FT + 1 - 118.4
  const landAt = g.p1 == null ? Infinity : landed && hangMs ? g.tf + 80 + hangMs + DROP : g.p1 + S.F
  if (g.p1 == null) {
    bx = t < RUN0 ? x0 : runX(S, t)
    if (t < RUN0 - 160) {
      // the walk-up: on the spot, bouncing it, the building waiting on him
      copyPose(STANDB, P)
      const f = (t % 560) / 560, by = BALL_RIG + (52 - BALL_RIG) * Math.abs(Math.cos(Math.PI * f))
      P.hFx = 19; P.hFy = Math.max(46, by + 6); P.hBx = -4; P.hBy = 50
      ball = { rx: 22, ry: by }
    } else if (t < RUN0) { mixPose(STANDB, PLANT, 0.4, P); ballOf(P, '2', BW); ball = { rx: BW.x, ry: BW.y } }
    else {
      runPose(2 * Math.PI * (t - T1) / STRIDE, P)
      const pl = prog(t, T1 - 150, T1) * 0.75
      if (pl > 0) mixPose(P, PLANT, pl, P)
      ballOf(P, '2', BW); ball = { rx: BW.x, ry: BW.y }
      // off the bounce: he throws it down ahead of the mark and goes up to meet it
      if (S.bounce && t >= T1 - 470) ball = null
    }
  } else {
    mode = 'air'
    const tauC = Math.min(tau, S.F)
    const u = tauC / S.F
    const xAt = tt => lerp(runX(S, g.p1), xFin, clamp(tt / S.fin, 0, 1))
    bx = xAt(tau)
    if (tau > S.fin) bx = lerp(xFin, xFin - 1.25, easeOut(prog(tau, S.fin, S.F)))
    j = Hrig * 4 * u * (1 - u)
    const K = keyed(S, Math.min(tau, S.keys[S.keys.length - 1].t), P)
    theta = spinOf(S, tau)
    if (K.b !== 'x') { ball = { rx: KEY.bx, ry: KEY.by }; ballFar = K.far }
    // the plant into the takeoff
    if (tau < 70) mixPose(PLANT, P, tau / 70, P)
    // on the rim: hanging on it, then down
    if (landed && hangMs && t >= g.tf) {
      const a = t - g.tf
      const H = S.one ? HANG1 : HANGP
      if (a < 80) { mixPose(P, H, a / 80, P); j = lerp(j, jHang, easeOut(a / 80)); bx = lerp(bx, 1.03, a / 80) }
      else if (a < 80 + hangMs) { copyPose(H, P); j = jHang; bx = 1.03; const w = Math.sin((a - 80) / 120); P.lean = w * 0.05; P.fFx += w * 4; P.fBx += w * 4 }
      else if (t < landAt) { const d = (a - 80 - hangMs) / DROP; mixPose(H, FALLP, clamp(d * 1.6, 0, 1), P); j = jHang * (1 - d * d); bx = 1.03 + d * 0.3 }
    } else if (tau > S.keys[S.keys.length - 1].t && t < landAt) {
      mixPose(P, FALLP, clamp((tau - S.keys[S.keys.length - 1].t) / 260, 0, 1), P)
    }
    if (g.lost && t >= g.lost.at && t < landAt) mixPose(P, FLAIL, clamp((t - g.lost.at) / 140, 0, 1), P)
    if (t >= landAt) {
      mode = 'down'
      const a = t - landAt
      j = 0
      bx = landed && hangMs ? 1.33 : xFin - 1.25
      copyPose(LANDP, P)
      if (a < 90) g.nudgedLand || (g.nudgedLand = true, g.nudge.kick(t, 1.4, 0, 1, 150))
      // he turns to the building: the flex, or his hands on his head
      const thL = spinEnd(S)
      if (a > 220) { const dl = ((Math.PI / 2 - thL + 3 * Math.PI) % (2 * Math.PI)) - Math.PI; theta = thL + dl * easeInOut(clamp((a - 220) / 170, 0, 1)) }
      else theta = thL
    } else if (tau > (S.spin?.[1] ?? 0)) theta = spinEnd(S)
    // the ball: through the rim, off the iron, or out of his hands
    if (landed && t >= g.tf - 120) {
      const w = easeIn(clamp((t - (g.tf - 110)) / 110, 0, 1))
      if (t < g.tf && ball) {
        // (the hand takes it the last of the way to the rim, wherever it was)
        ball.blend = w
      } else if (t >= g.tf) {
        const a = t - g.tf
        if (a < 120) ballLoose = { x: 0, y: lerp(RIM_IN.y, 9.0, a / 120) }
        else ballLoose = { ...freeAt({ x: 0, y: 9.0, vx: 0.0016 * g.popDir * 0.6, vy: -0.008, t0: g.tf + 120 }, t) }
        ball = null
      }
    } else if (g.clank && t >= g.clank.from) {
      const iron = g.clank.front ? FRONT_IRON : BACK_IRON
      if (t < g.clank.at) ball = { ...(ball ?? { rx: 20, ry: 110 }), to: iron, f: easeIn(clamp((t - g.clank.from) / Math.max(1, g.clank.at - g.clank.from), 0, 1)) }
      else { ballLoose = { ...freeAt({ x: iron.x, y: iron.y + 0.2, vx: g.clank.front ? 0.0062 : 0.0048, vy: g.clank.front ? 0.0035 : 0.0105, t0: g.clank.at }, t) }; ball = null }
    } else if (g.lost && t >= g.lost.at) ball = { ...(ball ?? { rx: 20, ry: 100 }), lostAt: g.lost.at }
  }
  // (the ball off the bounce, before it's in his hands)
  if (S.bounce && (g.p1 == null ? t >= T1 - 470 : tau < 150)) {
    const xT = S.take, xb = xT - 1.4, xc = xT - (xT - X_FIN) * (150 / S.fin) - 0.9
    const yc = (Hrig * 4 * (150 / S.F) * (1 - 150 / S.F) + 104) / FIG_FT
    let wx, wy
    if (t < T1 - 290) { const f = prog(t, T1 - 470, T1 - 290); wx = lerp(xT + 1.6, xb, f); wy = lerp(4.1, BALL_R, f * f) }
    else { const f = prog(t, T1 - 290, T1 + 150); wx = lerp(xb, xc, f); wy = lerp(BALL_R, yc, easeOut(f)) }
    ballLoose = { x: wx, y: wy, toHand: g.p1 != null && tau >= 40 ? (tau - 40) / 110 : null }
    ball = null
  }

  // ── the camera ──
  const want = aim(g, G, mode === 'run' ? bx : Math.max(bx, 1.5), tau)
  if (!g.cam || g.cam.view !== view.h) g.cam = { x: want.x, k: want.k, view: view.h }
  else { const f = 1 - Math.exp(-dtG / 230); g.cam.x += (want.x - g.cam.x) * f; g.cam.k += (want.k - g.cam.k) * f }
  const cam = g.cam, kk = cam.k
  const SX = (x, z = 0) => 180 + (x - cam.x) * kk * PK(z)
  const SY = (y, z = 0) => floorY + z * G.dz - y * kk * PK(z)
  const V = { SX, SY, k: kk, U, c }
  const s = kk / FIG_FT

  // ── the house ──
  layer(ctx, view, `dunk-house-${c.us}-${c.trim}`, x => paintHouse(x, view, G, c))
  if (!g.warm) { g.warm = true; warmCrowd(view, { wallY: G.wallY }, c, 'dunk-contest') }
  const pop = g.done?.hit ? t - g.doneAt : -1
  if (pop >= 0 && pop < 2400 && !lightFx() && !view.empty) {
    crowdUp(ctx, view, { wallY: G.wallY }, c, 'dunk-contest', t, pop < 900 ? 90 : 130)
    if (pop < 1500) camFlashes(ctx, view, { wallY: G.wallY }, t, D.tier === 'hard' ? 22 : 14)
  }
  if (pop >= 0 && pop < 1100) boardFlash(ctx, view, { wallY: G.wallY }, c.trim, (1 - pop / 1100) * (Math.floor(pop / 90) % 2 ? 0.34 : 0.62))
  // slow motion: the building goes quiet and dark behind him
  const slowAmt = 1 - (g.rate - SLOW_RATE) / (1 - SLOW_RATE)
  if (slowAmt > 0.01) { ctx.fillStyle = `rgba(3,6,10,${(0.38 * slowAmt).toFixed(3)})`; ctx.fillRect(0, 0, view.w, G.wallY) }
  courtLines(ctx, V, c)
  judges(ctx, V, view, g)

  // the takeoff mark: gold tape on the floor (the free-throw dunk's is the line itself)
  const mark = S.take - 0.25
  if (!g.done || t - g.doneAt < 400) {
    ctx.fillStyle = GOLD
    if (g.id === 'ft-line') { ctx.beginPath(); ctx.moveTo(SX(13.75, -8), SY(0, -8)); ctx.lineTo(SX(13.75, 8), SY(0, 8)); ctx.lineWidth = 3.4 * U; ctx.strokeStyle = GOLD; ctx.stroke() }
    else { const mx = SX(mark), my = SY(0); ctx.fillRect(mx - 1.6 * U, my - 7 * U, 3.2 * U, 14 * U); ctx.fillRect(mx - 0.5 * kk, my - 1.2 * U, kk, 2.4 * U) }
  }
  const s0 = g.steps[0]
  if (g.k === 0 && !g.fail && t >= s0.cueAt) ringAt(ctx, SX(mark), SY(0), 16 * U, s0, t, U, 0.32)

  // ── the hoop, back to front, with the ball and the man in among it ──
  let rot = 0, netAge = null, jolt = null
  if (landed && t >= g.tf) {
    const a = t - g.tf
    netAge = a - 40
    if (hangMs && a < 80 + hangMs) rot = -0.075 * Math.min(1, a / 60) + Math.sin(a / 70) * 0.01
    else { const r0 = hangMs ? a - 80 - hangMs : a; rot = Math.sin(r0 / 32) * 0.085 * Math.exp(-r0 / 210) * (hangMs ? 1 : 0.7) }
  } else if (g.clank && t >= g.clank.at) { jolt = t - g.clank.at; rot = Math.sin(jolt / 26) * 0.05 * Math.exp(-jolt / 150) }
  hoop(ctx, V, c, 'back', rot, netAge, jolt)

  // the ball in the world: in a hand, on its way to the iron, or loose
  let bwx = null, bwy = null
  const spin = ballLoose || g.lost || (g.clank && t >= g.clank.at) || (landed && t >= g.tf) ? t / 70 : 0
  const front = Math.abs(Math.cos(theta)) < 0.42, flip = Math.cos(theta) > 0, q = front ? 1 : 0.55 + 0.45 * Math.abs(Math.cos(theta)), dirS = flip ? -1 : 1
  if (ball) {
    let rx = ball.rx, ry = ball.ry
    if (front) { rx = 0; ry = mode === 'air' && P.hFy > 105 ? 128 : 86 }
    bwx = bx + dirS * q * rx / FIG_FT; bwy = (ry + j) / FIG_FT
    if (ball.blend != null) { bwx = lerp(bwx, RIM_IN.x, ball.blend); bwy = lerp(bwy, RIM_IN.y, ball.blend) }
    if (ball.to) { bwx = lerp(bwx, ball.to.x, ball.f); bwy = lerp(bwy, ball.to.y, ball.f) }
    if (ball.lostAt != null) {
      // (it squirts out of his hands where they were and drops)
      if (!g.lostFrom) g.lostFrom = { x: bwx, y: bwy, vx: 0.0058 * (bwx > 0.5 ? 1 : -1), vy: 0.004, t0: ball.lostAt }
      const f = freeAt(g.lostFrom, t); bwx = f.x; bwy = f.y
    }
  } else if (ballLoose) {
    bwx = ballLoose.x; bwy = ballLoose.y
    if (ballLoose.toHand != null) {
      // (into his hands off the bounce)
      const K = keyed(S, 150, KP)
      const hx = bx + dirS * q * KEY.bx / FIG_FT, hy = (KEY.by + j) / FIG_FT
      void K
      bwx = lerp(bwx, hx, easeIn(ballLoose.toHand)); bwy = lerp(bwy, hy, easeIn(ballLoose.toHand))
    }
  }
  const inRim = bwy != null && Math.abs(bwx) < 1.05 && bwy > 8.4 && bwy < 10.9
  const drawBall = () => { if (bwx != null) basketball(ctx, SX(bwx), SY(bwy), { r: BALL_R * kk, spin }) }
  // (a trail behind the ball while time's slowed)
  if (slowAmt > 0.05 && bwx != null) {
    const tr = g.trail ?? (g.trail = [])
    tr.push(SX(bwx), SY(bwy)); if (tr.length > 10) tr.splice(0, 2)
    for (let i = 0; i < tr.length - 2; i += 2) { ctx.globalAlpha = 0.12 + (i / tr.length) * 0.22 * slowAmt; ctx.fillStyle = '#e8772e'; ctx.beginPath(); ctx.arc(tr[i], tr[i + 1], BALL_R * kk * 0.9, 0, 6.3); ctx.fill() }
    ctx.globalAlpha = 1
  } else if (g.trail) g.trail.length = 0

  const behind = bwx != null && !inRim && ((ballFar && !front) || (front && Math.sin(theta) < 0))
  if (behind) drawBall()
  if (inRim) drawBall()
  hoop(ctx, V, c, 'net', rot, netAge, jolt)
  hoop(ctx, V, c, 'front', rot, netAge, jolt)

  // him
  const hipX = SX(bx), PEz = easedPose(PE, P, g, dtG, 22)
  PEz.j = j
  if (front) {
    // turned to us (mid-spin, or after: the flex, the hands on his head)
    let F = PF
    if (mode === 'down') copyPose(t - landAt < 300 ? LANDP : landed ? (g.flair < 0.5 ? R_FLEX : R_UP) : (g.flair < 0.5 ? R_HEAD : R_HIPS), F)
    else copyPose(P.hFy > 105 ? F_UP : F_TUCK, F)
    if (mode === 'down' && landed && t - landAt > 520) { const w = Math.sin((t - landAt - 520) / 90); F.hy += w * 2; F.hFy += w * 5; F.hBy += w * 5 }
    const FEz = easedPose(FE, F, g, dtG, 30)
    FEz.j = j
    athleteFront(ctx, hipX, floorY, FEz, { jersey: look.jersey, trim: look.trim, s, back: Math.sin(theta) < 0, num: look.num, skin: look.skin })
  } else {
    ctx.save(); ctx.translate(hipX, 0); ctx.scale(q, 1); ctx.translate(-hipX, 0)
    athlete(ctx, hipX, floorY, PEz, { jersey: look.jersey, trim: look.trim, skin: look.skin, s, flip, num: look.num })
    ctx.restore()
  }
  if (!behind && !inRim) drawBall()
  nameTag(ctx, view, clamp(hipX, 34, view.w - 34), floorY + 5 * U, name, 1)

  // the rings in the air: on the ball for the move, on the rim for the finish
  const cur = g.steps[g.k]
  if (cur && !g.fail && cur.T != null && g.k > 0 && t >= Math.max(cur.cueAt, cur.liveAt ?? 0)) {
    if (cur.kind === 'fin') ringAt(ctx, SX(0), SY(RIM_FT), RIM_HALF * kk + 5 * U, cur, t, U, 0.3)
    else if (bwx != null) ringAt(ctx, SX(bwx), SY(bwy), BALL_R * kk + 5 * U, cur, t, U, 1)
  }

  // ── the words: the dunk and the try (top left); how it went (under the stamp) ──
  // (on a strip of its own, like the broadcast's: the banners in the rafters are behind it)
  ctx.font = `20px ${DISPLAY}`
  const nw = ctx.measureText(D.name.toUpperCase()).width
  ctx.fillStyle = 'rgba(6,10,12,.74)'; ctx.fillRect(0, 48, Math.max(nw, 150) + 24, 48)
  ctx.fillStyle = TIER_INK[D.tier]; ctx.fillRect(0, 48, 3, 48)
  text(ctx, D.name.toUpperCase(), 12, 62, { font: DISPLAY, size: 20, align: 'left', color: '#fff' })
  text(ctx, D.tier.toUpperCase(), 12, 84, { font: LABEL, size: 16, align: 'left', color: TIER_INK[D.tier], track: 1 })
  ctx.font = `16px ${LABEL}`
  const tw = ctx.measureText(D.tier.toUpperCase()).width + 2 * D.tier.length
  text(ctx, `ATTEMPT ${g.attempt}`, 20 + tw, 84, { font: LABEL, size: 16, align: 'left', color: 'rgba(255,255,255,.72)', track: 1 })
  if (g.stamp && !g.stamp.y) { g.stamp.y = view.h - 132; g.stamp.size = g.stamp.text.length > 13 ? 30 : g.stamp.text.length > 10 ? 34 : 40 }
  if (g.done && t - g.doneAt > 160) {
    const f = g.fail
    const word = landed ? (g.quality >= 0.9 ? 'PERFECT TIMING' : g.quality >= 0.7 ? 'CLEAN' : 'GOT IT DOWN') : f ? `${f.why === 'early' ? 'EARLY' : 'LATE'} ON THE ${f.noun}` : ''
    text(ctx, word, 180, view.h - 92, { font: LABEL, size: 18, color: landed ? GOLD : 'rgba(255,255,255,.85)', track: 1.5 })
  }
}

// running side-on, ph 0 the near foot coming down out in front
function foot(ph, A, lift) {
  const p = ((ph % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), SF = 0.34 * 2 * Math.PI
  if (p < SF) return [A - (2 * A * p) / SF, 0]
  const s = (p - SF) / (2 * Math.PI - SF)
  return [-A + 2 * A * easeInOut(s), lift * Math.sin(Math.PI * s)]
}
function runPose(ph, P) {
  P.hx = 0; P.lean = 0.14; P.hy = 44 + 2.5 * Math.abs(Math.sin(ph)); P.j = 0; P.toeF = 0; P.toeB = 0
  const [nx, ny] = foot(ph, 17, 22), [fx, fy] = foot(ph + Math.PI, 17, 22)
  P.fFx = nx; P.fFy = ny; P.fBx = fx; P.fBy = fy
  P.hFx = 18; P.hFy = 70 + Math.sin(2 * ph) * 2; P.hBx = 16; P.hBy = 72
  return P
}
