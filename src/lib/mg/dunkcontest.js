// The Slam Dunk Contest: one run is one dunk attempt. Shot from the side, like the broadcast: the judges' table along
// the far sideline, the building behind it, the rim on the left and the run-up coming in from the right.
//   0. The call (g.phase 'pick'): he stands at the top of his run-up, bouncing it, and calls the dunk off the board on
//      the court: every dunk, by tier, with what the judges give it landed on the first try. Tap a dunk, then GO; or the
//      arrows and SPACE. Career's second and third tries at a dunk (def.lock) skip it: it's the same dunk.
//   0b. The try (g.phase 'card'): before every attempt, the broadcast's card over the court: ATTEMPT 2 OF 3, the dunk,
//      what the judges give it on this try and what it needs. It goes on its own, or on a tap.
//   1. The takeoff. He runs at the gold mark on the floor; a ring closes on it. Tap as his plant foot hits it.
//      Early and he's left from too far out: short, off the front of the rim. Late and he's under it: off the back iron.
//   2. The move in the air (medium and hard dunks): a ring closes on the ball. A hold (the windmill, the rock, the spin,
//      the split) is let go as it meets the ball (a plain tap on it counts too); a tap (the leg swap, the pump, the cock)
//      is tapped as it does. Off on it and he can't hang on to it: the ball comes loose.
//   3. The finish. A ring closes on the rim: tap as it meets the iron. Early, he jams it into the front rim; late, he's
//      on the way down and it comes off the back iron.
// Every ring is up for most of a second before it closes: the next one shows, dim, while he's still on this one, and
// the medium and hard dunks go to slow motion through the move (the windows are in real time, so slow motion buys
// reading time, not a softer window). Harder dunks have more steps and tighter windows, and score more with the
// judges (career's screens judge them from raw: tier, landed, quality, attempt). The window comes from the player's
// grade: v is the mean of his Finishing and Bounce on 0-11; invitees are 9 to 11.
// Def: dunk (the one the board opens on; with lock, the one he's on), lock, used (dunks landed tonight, off the board),
// attempt, label (his name), need (what the dunk needs to move him up, Career), onPick(id) (the call, as he makes it),
// tries (the contest's three: a miss before the last is called, he walks back to the top of the run-up and the next
// try's card comes up, all in the one game; onTry(raw) hears each of those misses as it happens. Without tries, one).
import { clamp, lerp, prog, easeOut, easeIn, easeInOut, rngOf, outcome, layer, text, basketball, nudge, keyCap, rr, GOOD, BAD, GOLD, DISPLAY, LABEL, BODY } from './kit.js'
import { pose, mixPose, copyPose, newPose, easedState, easedPose, smoothT, CLK, athlete, athleteFront, paintBowl, crowdUp, camFlashes, boardFlash, lightFx, warmCrowd, FIG_FT, BALL_R, SKINS, R_UP, R_FLEX, R_HEAD, R_HIPS } from './meter.js'
import { standAt, SCOUT, FOLK_SKIN } from './dash.js'
import { nameTag } from './art.js'
import { castMen } from './read.js'

export const how = {
  'dunk-contest': 'Call the dunk. Tap as the ring closes on the takeoff mark. In the air, tap (or let go) as each ring meets the ball. Then tap as the ring meets the rim to throw it down.',
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
// what five judges give a dunk landed on the first try, placed in the range by how clean it was (lib/allStar.js judges
// it; the board on the court shows it)
export const JUDGE_RANGE = { easy: [37, 42], medium: [41, 46], hard: [45, 50] }
export const TIERS = ['easy', 'medium', 'hard']

// ── Timing ──────────────────────────────────────────────────────────────────
const RUN0 = 1000          // the walk-up's over: he goes
const T1 = 2600            // his plant foot on the mark, if he's on time
const RUN_V = 0.0165       // feet a ms at full speed (16.5 ft/s)
const ACCEL = 420          // ms to full speed
const STRIDE = 640         // ms for two steps
const LEAD_TAKE = 820      // how long the takeoff ring takes to close
const LEAD_AIR = 680       // and a ring in the air, real ms (it shows from takeoff at the soonest)
const DROP = 320           // off the rim to the floor
const HOLD_MIN = 130       // a touch this short is a tap, not a hold
const CARD_MS = 2000       // the try's card is up this long, unless he taps it away
const CARD_MIN = 350       // (a tap left over from the last thing he pressed doesn't take it away)
const MISS_BEAT = 1700     // a miss: the call stands this long before he goes back for the next try
const BACK_MS = 1500       // the walk back (a few steps of it: the picture cuts to the top of the run-up)
const BACK_V = 0.0045      // feet a ms, walking
export const TRIES = 3
// the half-window in real ms at grade 9, and what each grade either side is worth (11-24: was 111 / 84 / 79, and the
// medium dunks' finish ring was up for a fifth of a second; an average thumb landed a medium one try in three.
// 11-25, the owner: easier. Was 138 / 108 / 86, an average thumb at an A landing 95 / 78 / 50% a try; now about
// 97 / 88 / 71, and 96 / 81 / 62 at a C+ (7), 97 / 93 / 83 at an S: scripts/mg/dunks.mjs)
const WIN = { easy: [170, 0.08], medium: [127, 0.08], hard: [106, 0.08] }
const winOf = (tier, v) => WIN[tier][0] * Math.max(0.4, 1 + WIN[tier][1] * (clamp(v, 0, 11) - 9) * (v < 9 ? 0.6 : 1))
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
// the floor taking him: knees and hips give all the way, then he comes back up to LANDP
const LANDD = pose({ hy: 26, lean: 0.38, fFx: 16, fBx: -13, hFx: 27, hFy: 44, hBx: 21, hBy: 42 })
// the gather: the last long step sat down into, the ball brought down by the hip, ready to throw everything up.
// Off one foot (LOAD1): the plant leg out in front, the other one behind about to drive. Off two (LOAD2): feet together,
// hips back, the ball low between his hands
const LOAD1 = pose({ hy: 33, lean: -0.05, fFx: 19, fBx: -15, fBy: 7, hFx: 6, hFy: 46, hBx: 3, hBy: 47 })
const LOAD2 = pose({ hy: 30, lean: 0.14, fFx: 9, fBx: -6, hFx: 8, hFy: 38, hBx: 5, hBy: 40 })
// in the air off one foot: the free knee driven up, the takeoff leg trailing long under him
const AIR_LEGS = { fFx: 16, fFy: 35, fBx: -9, fBy: 6 }
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
  reverse: { stamp: 'REVERSE JAM', take: 3.3, F: 900, H: 3.3, fin: 520, hang: 0, xFin: 0.95, spin: [80, 340, 0.5], two: true, moves: [],
    keys: [k(0, TAKE2), k(200, UP2), k(380, AWAY2), k(520, REVSLAM)] },
  windmill: { stamp: 'WINDMILL', take: 5.2, F: 980, H: 3.45, fin: 560, hang: 200, one: true, slow: [220, 560], slowRate: 0.55,
    moves: [{ kind: 'hold', at: 360, hold: 'HOLD TO WIND IT UP', noun: 'WINDMILL' }],
    keys: [k(0, TAKE1), k(120, WMILL, 'n', -40), k(240, WMILL, 'n', -150), k(360, WMILL, 'n', -250), k(470, WMILL, 'n', -292), k(560, SLAM1, 'n')] },
  cradle: { stamp: 'CRADLE ROCK', take: 5.2, F: 980, H: 3.45, fin: 560, hang: 0, one: true, slow: [200, 560], slowRate: 0.55,
    moves: [{ kind: 'hold', at: 330, hold: 'HOLD TO ROCK IT', noun: 'ROCK' }],
    keys: [k(0, TAKE1), k(130, ROCK, 'n', 55), k(330, ROCK, 'n', -112), k(450, ROCK, 'n', 96), k(560, SLAM1, 'n')] },
  'bounce-legs': { stamp: 'THROUGH THE LEGS', take: 5, F: 1000, H: 3.45, fin: 580, hang: 0, bounce: true, two: true, slow: [230, 580], slowRate: 0.55,
    moves: [{ kind: 'tap', at: 370, verb: 'UNDER THE LEG', noun: 'LEG SWAP' }],
    keys: [k(0, CATCH, 'x'), k(150, RISE1, 'n'), k(280, KNEE_N, 'n'), k(345, KNEE_N, 'n'), k(395, UNDER_F, 'f'), k(490, FARUP, 'f'), k(580, SLAMF, 'f')] },
  'double-clutch': { stamp: 'DOUBLE CLUTCH', take: 5, F: 1020, H: 3.5, fin: 600, hang: 300, slow: [240, 600], slowRate: 0.55, two: true,
    moves: [{ kind: 'tap', at: 380, verb: 'PUMP IT BACK UP', noun: 'PUMP' }],
    keys: [k(0, TAKE2), k(150, UP2), k(280, CLUTCH), k(380, CLUTCH_LO), k(500, UP2), k(600, SLAM2)] },
  '360-windmill': { stamp: '360 WINDMILL', take: 5.6, F: 1150, H: 3.7, fin: 640, hang: 240, one: true, spin: [60, 330, 1], slow: [200, 640], two: true,
    moves: [{ kind: 'hold', at: 330, hold: 'HOLD THE SPIN', noun: 'SPIN' }, { kind: 'tap', at: 470, verb: 'WINDMILL IT', noun: 'WINDMILL' }],
    keys: [k(0, TAKE2), k(150, CHEST), k(330, CHEST), k(360, WMILL, 'n', -45), k(410, WMILL, 'n', -150), k(470, WMILL, 'n', -250), k(560, WMILL, 'n', -292), k(640, SLAM1, 'n')] },
  'ft-line': { stamp: 'FROM THE LINE', take: 14.15, F: 1300, H: 3.65, fin: 800, hang: 0, one: true, slow: [220, 800], takeW: 0.96,
    moves: [{ kind: 'hold', at: 420, hold: 'HOLD THE SPLIT', noun: 'GLIDE' }, { kind: 'tap', at: 620, verb: 'COCK IT BACK', noun: 'COCK' }],
    keys: [k(0, TAKE1), k(180, SPLIT, 'n'), k(420, SPLIT2, 'n'), k(520, RISE1, 'n'), k(620, TCOCK, 'n'), k(800, SLAM1, 'n')] },
  'legs-360': { stamp: '360 THROUGH THE LEGS', take: 5.6, F: 1150, H: 3.7, fin: 640, hang: 200, spin: [60, 330, 1], slow: [200, 640], two: true,
    moves: [{ kind: 'hold', at: 330, hold: 'HOLD THE SPIN', noun: 'SPIN' }, { kind: 'tap', at: 470, verb: 'UNDER THE LEG', noun: 'LEG SWAP' }],
    keys: [k(0, TAKE2), k(150, CHEST), k(330, CHEST), k(400, KNEE_N, 'n'), k(445, KNEE_N, 'n'), k(495, UNDER_F, 'f'), k(560, FARUP, 'f'), k(640, SLAMF, 'f')] },
}
const X_FIN = 1.35          // his hips at the finish of a dunk going forward, feet from the rim
const RIM_IN = { x: 0, y: 10.45 }, FRONT_IRON = { x: 0.72, y: 10.12 }, BACK_IRON = { x: -0.66, y: 10.12 }
const RIM_FT = 10, RIM_HALF = 0.75, BOARD_X = -1.25

// slow motion: the rate the rules run at, ms after takeoff
function rateAt(S, tau) {
  if (!S.slow || tau == null) return 1
  const [a, b] = S.slow
  const f = tau < a - SLOW_RAMP || tau > b + SLOW_RAMP ? 0 : tau < a ? (tau - a + SLOW_RAMP) / SLOW_RAMP : tau > b ? 1 - (tau - b) / SLOW_RAMP : 1
  return 1 - (1 - (S.slowRate ?? SLOW_RATE)) * easeInOut(clamp(f, 0, 1))
}
// where he is on the run-up (feet from the rim), at game time t
function runD(s) { return s <= 0 ? 0 : s < ACCEL ? (RUN_V * s * s) / (2 * ACCEL) : RUN_V * (s - ACCEL / 2) }
const runX = (S, t) => S.take + runD(T1 - RUN0) - runD(t - RUN0)

export function make({ v, seed, def }) {
  const used = new Set(Array.isArray(def?.used) ? def.used : [])
  const open = id => !!SPEC[id] && !used.has(id)
  const lock = !!def?.lock && !!SPEC[def?.dunk]
  // (the board opens on the dunk he called last, or the Windmill; never one he's already landed tonight)
  const first = lock ? def.dunk : open(def?.dunk) ? def.dunk : open('windmill') ? 'windmill' : (DUNKS.find(d => open(d.id)) ?? DUNKS[0]).id
  const look = rngOf(`${seed}|look`)   // (what things look like, never what happens)
  let id, S, D, W, steps
  const g = {
    t: 0, game: 'dunk-contest', zones: 'none', fx: [], done: null, outro: 2200, stamp: null, nudge: nudge(),
    id: null, dunk: null, S: null, steps: null, k: 0, W: 0, v, rate: 1, p1: null, held: false, downAt: null, downK: -1,
    fail: null, landed: false, tf: null, clank: null, lost: null, doneAt: null, landAt: null,
    attempt: def?.attempt ?? 1, label: def?.label ?? null, need: def?.need ?? null, used,
    tries: Math.max(1, def?.tries ?? TRIES), loop: (def?.tries ?? 1) > 1, missed: null, backAt: null, backT: 0, backFrom: null,
    // the call: the board on the court until he takes one (g.stick: the arrows reach the game as they are); then the
    // try's card
    phase: lock ? 'card' : 'pick', pickT: 0, cardT: 0, cursor: DUNKS.findIndex(d => d.id === first), menu: null, stick: !lock,
    flair: look(), popDir: look() < 0.5 ? 1 : -1,
    hud: { prompt: null, dots: null, hot: false },
    ev: [],
    tauNow: () => (g.p1 == null ? null : g.t - g.p1),
    tick(dt) {
      if (g.phase === 'pick') { g.pickT += dt; return }
      if (g.phase === 'card') { g.cardT += dt; if (g.cardT >= CARD_MS) startRun(); return }
      if (g.phase === 'back') { g.t += dt; g.backT += dt; if (g.backT >= BACK_MS) nextTry(); return }
      g.rate = rateAt(S, g.tauNow())
      g.t += dt * g.rate
      for (const e of g.ev) if (!e.done && g.t >= e.at) { e.done = true; e.fn() }
      // (a miss with tries left: once the call's had its beat and he's down, he goes back for the next one)
      if (g.missed && g.t >= g.backAt) { g.phase = 'back'; g.backT = 0; g.backFrom = g.bxNow ?? null; g.stamp = null; g.rate = 1; return }
      const s = steps[g.k]
      if (s && !g.fail && s.T != null && g.t > s.T + s.W) {
        if (s.kind === 'take') { takeoff(g.t) } else fail(s, 'late', s.T + s.W)
      }
      prompt()
    },
    input(a) {
      if (g.phase === 'pick') return pickInput(a)
      if (g.phase === 'card') { if ((a.kind === 'down' || (a.kind === 'key' && a.zone === 'S')) && g.cardT >= CARD_MIN) startRun(); return }
      if (g.phase === 'back') return
      if (a.kind === 'up') { const was = g.held; g.held = false; if (was) release(); return }
      if (a.kind !== 'down') return
      const was = g.held
      g.held = true; g.downAt = g.t; g.downK = g.k
      const s = steps[g.k]
      if (!s || g.fail || g.done || g.missed || s.T == null) return
      if (g.t < s.cueAt) return               // (nothing to time yet)
      // a hold: it's the letting go that's timed, and this is the grip; a fresh tap right on the ring counts too
      if (s.kind === 'hold') { if (!was && Math.abs(g.t - s.T) <= s.W) judge(s, g.t); return }
      if (s.kind === 'take') takeoff(g.t); else judge(s, g.t)
    },
  }
  // the dunk on the board's cursor, or the one he's taken: its rules, its steps
  function load(nid) {
    id = nid; S = SPEC[id]; D = DUNK_OF[id]; W = winOf(D.tier, v)
    steps = [
      { kind: 'take', T: T1, W: W * (S.takeW ?? 1), cueAt: T1 - LEAD_TAKE, showAt: T1 - LEAD_TAKE, lead: LEAD_TAKE, rate: 1, liveAt: 0, noun: 'TAKEOFF' },
      ...S.moves.map(m => ({ ...m, T: null, W: null, cueAt: null, showAt: null, lead: null, rate: 1, liveAt: null })),
      { kind: 'fin', at: S.fin, T: null, W: null, cueAt: null, showAt: null, lead: null, rate: 1, liveAt: null, noun: 'FINISH' },
    ]
    for (const s of steps) { s.res = null; s.e = null; s.q = 0 }
    g.id = id; g.dunk = D; g.S = S; g.steps = steps; g.W = W
  }
  load(DUNKS[g.cursor].id)
  g.hud.dots = steps.map(() => null)
  // ── the call ──
  const openAt = i => open(DUNKS[i]?.id)
  function moveCursor(dir, tierJump = false) {
    let i = g.cursor
    if (tierJump) {
      // (left / right: the first open dunk of the tier either side)
      let ti = TIERS.indexOf(DUNKS[i].tier) + dir
      for (; ti >= 0 && ti < TIERS.length; ti += dir) { const j = DUNKS.findIndex((d, k) => d.tier === TIERS[ti] && openAt(k)); if (j >= 0) { i = j; break } }
    } else {
      for (let j = i + dir; j >= 0 && j < DUNKS.length; j += dir) if (openAt(j)) { i = j; break }
    }
    if (i !== g.cursor) { g.cursor = i; load(DUNKS[i].id); g.fx.push('tick', 'h:light') }
  }
  function takeIt() {
    if (!openAt(g.cursor)) return
    g.phase = 'card'; g.cardT = 0; g.stick = false; g.menu = null
    load(DUNKS[g.cursor].id)
    g.hud.dots = steps.map(() => null)
    g.fx.push('tap', 'h:light')
    try { def?.onPick?.(id) } catch {}
  }
  // the card's down: he goes
  function startRun() {
    g.phase = 'run'; g.cardT = 0
    g.fx.push('whistle', 'h:medium')
  }
  // the next try at the same dunk: everything about the last one gone, back at the top of the run-up
  function nextTry() {
    g.attempt++
    load(id)
    g.hud.dots = steps.map(() => null); g.hud.prompt = null; g.hud.hot = false
    Object.assign(g, { t: 0, p1: null, k: 0, fail: null, landed: false, tf: null, clank: null, lost: null, doneAt: null, landAt: null, missed: null,
      stamp: null, quality: undefined, rate: 1, nudgedLand: false, lostFrom: null, backAt: null, backT: 0, backFrom: null, nudge: nudge(), cam: null })
    g.ev.length = 0
    if (g.trail) g.trail.length = 0
    g.phase = 'card'; g.cardT = 0
  }
  function pickInput(a) {
    if (a.kind === 'key') {
      if (a.zone === 'U') moveCursor(-1); else if (a.zone === 'D') moveCursor(1)
      else if (a.zone === 'L') moveCursor(-1, true); else if (a.zone === 'R') moveCursor(1, true)
      else if (a.zone === 'S') takeIt()
      return
    }
    if (a.kind !== 'down') return
    const M = g.menu
    if (!M) return
    const { x, y } = a
    if (x >= M.go.x && x <= M.go.x + M.go.w && y >= M.go.y && y <= M.go.y + M.go.h) return takeIt()
    const row = M.rows.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
    if (!row || !openAt(row.i)) return
    if (row.i === g.cursor) return takeIt()   // (a second tap on the dunk he's on takes it)
    g.cursor = row.i; load(DUNKS[row.i].id); g.fx.push('tap', 'h:light')
  }
  function release() {
    const s = steps[g.k]
    if (!s || g.fail || g.done || g.missed || s.kind !== 'hold' || s.T == null) return
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
      // the steps in the air, from the moment he left the floor (so a takeoff a touch off doesn't carry into them).
      // Each ring shows LEAD_AIR real ms before it closes (from takeoff at the soonest): dim while the one before it is
      // still on, live once that one's done
      for (let i = 1; i < steps.length; i++) {
        const st = steps[i]
        st.T = t + st.at; st.rate = rateAt(S, st.at); st.W = W * st.rate
        st.showAt = Math.max(t, st.T - LEAD_AIR * st.rate); st.cueAt = st.showAt; st.lead = st.T - st.showAt
      }
      advance(t)
    } else fail(s, e < 0 ? 'early' : 'late', t)
  }
  function judge(s, t) {
    const e = t - s.T
    if (Math.abs(e) > s.W) return fail(s, e < 0 ? 'early' : 'late', t)
    s.res = true; s.e = e; s.q = qOf(e, s.W); g.hud.dots[g.k] = true
    if (s.kind === 'fin') return land(t)
    g.fx.push('h:light', 'tick')
    advance(t)
  }
  function advance(t) { g.k++; const n = steps[g.k]; if (n) n.liveAt = t }
  const after = (at, fn) => g.ev.push({ at, fn, done: false })
  function land(t0) {
    // (the slam lands when the ball meets the rim: on the ring's close, which is the moment the ball reaches the iron;
    // a tap a touch early waits for the ball to get there, a touch late slams the ball he's holding on the rim)
    const t = Math.max(t0, steps[steps.length - 1].T ?? t0)
    g.landed = true; g.tf = t; g.k = steps.length
    after(t, () => { g.fx.push('h:medium'); g.nudge.kick(g.t, D.tier === 'hard' ? 3.4 : D.tier === 'medium' ? 2.8 : 2.3, 0, 1, 110) })   // (the hit itself; the roar's comes after)
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
    const res = outcome(landed ? 0.5 + 0.5 * quality : 0, landed, note, { dunk: id, tier: D.tier, landed, quality, attempt: g.attempt, steps: steps.map(s => s.res === true) })
    g.doneAt = g.t
    g.hud.prompt = null; g.hud.hot = false
    if (!landed && g.loop && g.attempt < g.tries) {
      // a try missed with tries left: the call, a beat, and back for the next one (the host books the miss now)
      g.missed = res
      g.backAt = Math.max(g.t + MISS_BEAT, (g.p1 ?? g.t) + S.F + 900)
      g.fx.push('h:heavy')
      try { def?.onTry?.(res) } catch {}
      return
    }
    g.done = res
    g.outro = landed ? 2200 + S.hang : 2000
  }
  function prompt() {
    const s = steps[g.k]
    if (g.phase !== 'run' || !s || g.fail || g.done || g.missed || s.T == null || g.t < Math.max(s.cueAt, s.liveAt ?? 0)) { g.hud.prompt = null; g.hud.hot = false; return }
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
    // (the call: the dunk the board opens on)
    if (g.phase === 'pick') return g.pickT >= 500 ? [{ kind: 'key', zone: 'S' }] : undefined
    if (g.phase === 'card') return g.cardT >= 600 ? [{ kind: 'key', zone: 'S' }] : undefined
    if (g.phase !== 'run') return undefined
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
      lift = Math.exp(-netAge / 300) * (0.6 + Math.sin(netAge / 40) * 0.35) * Math.min(1, netAge / 90)
      swing = Math.exp(-netAge / 420) * Math.sin(netAge / 78) * 0.3
      bulge = netAge < 200 ? Math.sin((netAge / 200) * Math.PI) * 0.5 : 0
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
// (dim: the next one, already closing while he's on this one; it lights up once it's his)
function ringAt(ctx, x, y, r0, s, t, U, flat = 1, dim = false) {
  const left = s.T - t, f = clamp(left / s.lead, 0, 1), on = !dim && Math.abs(left) <= s.W
  ctx.globalAlpha = dim ? 0.45 : 1
  ctx.lineWidth = 2 * U; ctx.strokeStyle = 'rgba(255,255,255,.55)'
  ctx.beginPath(); ctx.ellipse(x, y, r0, r0 * flat, 0, 0, Math.PI * 2); ctx.stroke()
  if (left >= -s.W) {
    const r = r0 + f * 48 * U
    ctx.lineWidth = (on ? 4 : dim ? 2.4 : 3.2) * U; ctx.strokeStyle = on ? GOOD : GOLD
    ctx.beginPath(); ctx.ellipse(x, y, r, r * flat, 0, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.globalAlpha = 1
}

const PB = newPose(), PE = easedState(), PF = newPose(), FE = easedState()
const BW = { x: 0, y: 0 }
const TIER_INK = { easy: GOOD, medium: GOLD, hard: BAD }
const TIER_WORD = { easy: 'EASY', medium: 'MEDIUM', hard: 'HARD' }
// what he has to time on a dunk, in order: TAKEOFF · WINDMILL · FINISH
const stepsLine = S => ['TAKEOFF', ...S.moves.map(m => m.noun), 'FINISH'].join('  ·  ')
// a line of words cut to fit, the broadcast's line under the board (at most n lines)
function wrapLines(ctx, str, w, n) {
  const words = String(str).split(' '), out = []
  let cur = ''
  for (const wd of words) {
    const nx = cur ? `${cur} ${wd}` : wd
    if (ctx.measureText(nx).width <= w || !cur) cur = nx
    else { out.push(cur); cur = wd; if (out.length === n) break }
  }
  if (out.length < n && cur) out.push(cur)
  else if (out.length === n && cur && !out[n - 1].endsWith(cur)) out[n - 1] = `${out[n - 1].replace(/[.,;:]?$/, '')}…`
  return out
}
// The call: the board on the court. Every dunk by tier, what the judges give each tier landed on the first try, the
// one on the cursor lit; under it what he'll have to time and how the broadcast would call it, and GO. The rows and
// the button are kept on g.menu, where a tap is read (in the picture's own 360-wide units).
function board(ctx, g, view, G) {
  const { floorY } = G, D = g.dunk, keys = !!view.keys
  // the strip, top left: the call, and the try (and what it needs, in Career)
  ctx.fillStyle = 'rgba(6,10,12,.74)'; ctx.fillRect(0, 48, 186, 48)
  ctx.fillStyle = view.accent; ctx.fillRect(0, 48, 3, 48)
  text(ctx, 'CALL THE DUNK', 12, 62, { font: DISPLAY, size: 20, align: 'left', color: '#fff' })
  text(ctx, `ATTEMPT ${g.attempt} OF ${g.tries}${g.need ? `  ·  NEEDS ${g.need}` : ''}`, 12, 84, { font: LABEL, size: 16, align: 'left', color: g.need ? GOLD : 'rgba(255,255,255,.72)', track: 1 })
  // (on a computer: the keys, top right)
  if (keys) { keyCap(ctx, view.w - 96, 66, 'ARROWS'); text(ctx, 'CHOOSE', view.w - 68, 72, { font: LABEL, size: 15, align: 'left', color: 'rgba(255,255,255,.8)', track: 1 }) }
  // the board, down to the floor (a short picture packs it tighter)
  const top = 102, x = 8, w = 240
  const tight = floorY - top < 340, hh = tight ? 19 : 22, gap = tight ? 2 : 5
  const room = floorY - 6 - top - 8 - TIERS.length * hh - (TIERS.length - 1) * gap
  const rh = clamp(Math.floor(room / DUNKS.length), 22, 34)
  const H = 8 + TIERS.length * hh + (TIERS.length - 1) * gap + rh * DUNKS.length
  ctx.fillStyle = 'rgba(6,10,12,.86)'; ctx.fillRect(x, top, w, H)
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, top, w, 1)
  const rows = []
  let y = top + 4
  const size = rh >= 30 ? 18 : rh >= 26 ? 16 : 15
  for (const tier of TIERS) {
    if (tier !== TIERS[0]) y += gap
    const [lo, hi] = JUDGE_RANGE[tier]
    text(ctx, TIER_WORD[tier], x + 10, y + hh / 2 + 1, { font: LABEL, size: 15, align: 'left', color: TIER_INK[tier], track: 1.5 })
    text(ctx, `JUDGES ${lo}-${hi}`, x + w - 10, y + hh / 2 + 1, { font: LABEL, size: 15, align: 'right', color: 'rgba(255,255,255,.72)', track: 1 })
    y += hh
    DUNKS.forEach((d, i) => {
      if (d.tier !== tier) return
      const on = i === g.cursor, gone = g.used.has(d.id)
      if (on) { ctx.fillStyle = view.accent; ctx.fillRect(x + 4, y + 1, w - 8, rh - 2) }
      else { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(x + 4, y + 1, w - 8, rh - 2) }
      ctx.fillStyle = gone ? 'rgba(255,255,255,.2)' : TIER_INK[tier]; ctx.fillRect(x + 4, y + 1, 4, rh - 2)
      text(ctx, d.name.toUpperCase(), x + 16, y + rh / 2 + 1, { font: DISPLAY, size, align: 'left', color: on ? '#10161a' : gone ? 'rgba(255,255,255,.38)' : '#fff' })
      if (gone) text(ctx, 'LANDED TONIGHT', x + w - 10, y + rh / 2 + 1, { font: LABEL, size: 13, align: 'right', color: 'rgba(255,255,255,.5)', track: 0.5 })
      rows.push({ i, x: x + 4, y, w: w - 8, h: rh })
      y += rh
    })
  }
  // under it: what he'll time, the call, and GO
  const go = { x: 16, w: view.w - 32, h: tight ? 40 : 46, y: view.h - (tight ? 50 : 60) }
  ctx.fillStyle = 'rgba(6,10,12,.78)'; ctx.fillRect(0, floorY + 2, view.w, go.y - 8 - floorY - 2)
  let ly = floorY + 12
  text(ctx, stepsLine(g.S), view.w / 2, ly, { font: LABEL, size: 16, color: GOLD, track: 1.5 })
  ly += 17
  ctx.font = `14px ${BODY}`
  const n = Math.max(0, Math.min(2, Math.floor((go.y - 4 - ly + 8) / 16)))
  for (const ln of wrapLines(ctx, D.line, view.w - 30, n)) { text(ctx, ln, view.w / 2, ly, { font: BODY, size: 14, color: 'rgba(255,255,255,.86)' }); ly += 16 }
  ctx.fillStyle = view.accent; rr(ctx, go.x, go.y, go.w, go.h, 6); ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(go.x + 6, go.y + go.h - 3, go.w - 12, 3)
  const label = `GO  ·  ${D.name.toUpperCase()}`
  text(ctx, label, keys ? go.x + 16 : go.x + go.w / 2, go.y + go.h / 2 + 1, { font: DISPLAY, size: label.length > 22 ? 18 : 21, align: keys ? 'left' : 'center', color: '#10161a' })
  if (keys) keyCap(ctx, go.x + go.w - 46, go.y + go.h / 2, 'SPACE')
  g.menu = { rows, go }
}
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
  if (g.phase === 'back') {
    // the walk back after a miss, the ball under his arm, his back to the rim, a few steps at a walk; then the picture
    // cuts to him at the top of the run-up, with the next try's card (nextTry)
    bx = (g.backFrom ?? xFin - 1.25) + BACK_V * easeIn(clamp(g.backT / 300, 0, 1)) * g.backT
    walkPose(2 * Math.PI * g.backT / 1050, P)
    theta = Math.PI
    ballOf(P, 'n', BW); ball = { rx: BW.x, ry: BW.y }
  } else if (g.p1 == null) {
    bx = t < RUN0 ? x0 : runX(S, t)
    if (t < RUN0 - 160) {
      // the walk-up: on the spot, bouncing it, the building waiting on him
      copyPose(STANDB, P)
      const f = ((g.phase === 'pick' ? g.pickT : g.phase === 'card' ? g.cardT : t) % 560) / 560, by = BALL_RIG + (52 - BALL_RIG) * Math.abs(Math.cos(Math.PI * f))
      P.hFx = 19; P.hFy = Math.max(46, by + 6); P.hBx = -4; P.hBy = 50
      ball = { rx: 22, ry: by }
    } else if (t < RUN0) { mixPose(STANDB, PLANT, 0.4, P); ballOf(P, '2', BW); ball = { rx: BW.x, ry: BW.y } }
    else {
      runPose(2 * Math.PI * (t - T1) / STRIDE, P)
      // the gather: the last long step, sitting down into it
      const pl = easeIn(prog(t, T1 - 240, T1))
      if (pl > 0) mixPose(P, S.two ? LOAD2 : LOAD1, pl, P)
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
    // up like a shot, floating as he gets to the top at the finish, then dropping (was a plain parabola)
    void u
    const apex = S.fin
    j = tau <= apex ? Hrig * (1 - (1 - tauC / apex) ** 2.4) : Hrig * (1 - clamp((tauC - apex) / (S.F - apex), 0, 1) ** 2)
    const K = keyed(S, Math.min(tau, S.keys[S.keys.length - 1].t), P)
    // off one foot: the free knee driven up and the takeoff leg trailing, until he brings his legs up for the finish
    if (!S.two && g.id !== 'ft-line') {
      const w = clamp((tau - 30) / 70, 0, 1) * clamp((S.fin - 40 - tau) / 120, 0, 1)
      if (w > 0) { P.fFx = lerp(P.fFx, AIR_LEGS.fFx, w); P.fFy = lerp(P.fFy, AIR_LEGS.fFy, w); P.fBx = lerp(P.fBx, AIR_LEGS.fBx, w); P.fBy = lerp(P.fBy, AIR_LEGS.fBy, w) }
    }
    theta = spinOf(S, tau)
    if (K.b !== 'x') { ball = { rx: KEY.bx, ry: KEY.by }; ballFar = K.far }
    // the plant into the takeoff
    // out of the gather: everything goes up at once
    if (tau < 90) {
      mixPose(S.two ? LOAD2 : LOAD1, P, easeOut(tau / 90), P)
      // (the ball goes up in his hands with them)
      if (ball && K.b !== 'x') { ballOf(P, K.b, BW); ball = { rx: BW.x, ry: BW.y } }
    }
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
      if (a < 80) mixPose(FALLP, LANDD, easeOut(a / 80), P)
      else if (a < 300) mixPose(LANDD, LANDP, easeInOut((a - 80) / 220), P)
      else copyPose(LANDP, P)
      if (a < 90) g.nudgedLand || (g.nudgedLand = true, g.nudge.kick(t, 1.4, 0, 1, 150))
      // he turns to the building: the flex, or his hands on his head
      const thL = spinEnd(S)
      if (a > 220) { const dl = ((Math.PI / 2 - thL + 3 * Math.PI) % (2 * Math.PI)) - Math.PI; theta = thL + dl * easeInOut(clamp((a - 220) / 170, 0, 1)) }
      else theta = thL
    } else if (tau > (S.spin?.[1] ?? 0)) theta = spinEnd(S)
    // the ball: through the rim, off the iron, or out of his hands
    const finT = g.steps?.[g.steps.length - 1]?.T ?? null
    // the throw down: the hand takes the ball the last of the way to the rim on the finish ring's clock, so it meets
    // the iron as the ring closes (that's the moment to tap); after a late tap it's still held there
    const toRim = finT != null && !g.clank && !g.lost && (landed || g.k === g.steps.length - 1)
      ? easeIn(clamp((t - (finT - 150)) / 150, 0, 1)) : 0
    if (landed && t >= g.tf - 150) {
      if (t < g.tf && ball) {
        ball.blend = Math.max(toRim, easeIn(clamp((t - (g.tf - 110)) / 110, 0, 1)) * (g.tf > finT ? 1 : 0))
      } else if (t >= g.tf) {
        const a = t - g.tf
        // (thrown down through it: out the bottom of the net in a blink, still going)
        if (a < 70) ballLoose = { x: 0, y: lerp(RIM_IN.y, 8.8, easeIn(a / 70)) }
        else ballLoose = { ...freeAt({ x: 0, y: 8.8, vx: 0.0016 * g.popDir * 0.6, vy: -0.0115, t0: g.tf + 70 }, t) }
        ball = null
      }
    } else if (g.clank && t >= g.clank.from) {
      const iron = g.clank.front ? FRONT_IRON : BACK_IRON
      if (t < g.clank.at) ball = { ...(ball ?? { rx: 20, ry: 110 }), to: iron, f: easeIn(clamp((t - g.clank.from) / Math.max(1, g.clank.at - g.clank.from), 0, 1)) }
      else { ballLoose = { ...freeAt({ x: iron.x, y: iron.y + 0.2, vx: g.clank.front ? 0.0062 : 0.0048, vy: g.clank.front ? 0.0035 : 0.0105, t0: g.clank.at }, t) }; ball = null }
    } else if (g.lost && t >= g.lost.at) ball = { ...(ball ?? { rx: 20, ry: 100 }), lostAt: g.lost.at }
    else if (toRim > 0 && ball) ball.blend = toRim
  }
  g.bxNow = bx   // (where he is, for the walk back)
  // (the ball off the bounce, before it's in his hands)
  if (g.phase !== 'back' && S.bounce && (g.p1 == null ? t >= T1 - 470 : tau < 150)) {
    const xT = S.take, xb = xT - 1.4, xc = xT - (xT - X_FIN) * (150 / S.fin) - 0.9
    const yc = (Hrig * 4 * (150 / S.F) * (1 - 150 / S.F) + 104) / FIG_FT
    let wx, wy
    if (t < T1 - 290) { const f = prog(t, T1 - 470, T1 - 290); wx = lerp(xT + 1.6, xb, f); wy = lerp(4.1, BALL_R, f * f) }
    else { const f = prog(t, T1 - 290, T1 + 150); wx = lerp(xb, xc, f); wy = lerp(BALL_R, yc, easeOut(f)) }
    ballLoose = { x: wx, y: wy, toHand: g.p1 != null && tau >= 40 ? (tau - 40) / 110 : null }
    ball = null
  }

  // ── the camera ──
  const want = aim(g, G, mode === 'run' ? bx : Math.max(bx, 1.5), g.phase === 'back' ? null : tau)
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
  const sr = S.slowRate ?? SLOW_RATE, slowAmt = 1 - (g.rate - sr) / (1 - sr)
  if (slowAmt > 0.01) { ctx.fillStyle = `rgba(3,6,10,${(0.38 * slowAmt).toFixed(3)})`; ctx.fillRect(0, 0, view.w, G.wallY) }
  courtLines(ctx, V, c)
  judges(ctx, V, view, g)

  // the takeoff mark: gold tape on the floor (the free-throw dunk's is the line itself)
  const mark = S.take - 0.25
  const over = g.done || g.missed
  if (g.phase === 'back' || !over || t - g.doneAt < 400) {
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
    // the iron yanked down by the slam (further while he hangs on it), then snapping back up and ringing
    if (hangMs && a < 80 + hangMs) rot = (a < 45 ? -0.14 * easeOut(a / 45) : -0.14 + 0.05 * easeOut(clamp((a - 45) / 120, 0, 1))) + Math.sin(a / 70) * 0.012
    else if (!hangMs && a < 45) rot = -0.13 * easeOut(a / 45)
    else { const r0 = hangMs ? a - 80 - hangMs : a - 45; rot = -Math.cos(r0 / 30) * (hangMs ? 0.1 : 0.13) * Math.exp(-r0 / 190) }
  } else if (g.clank && t >= g.clank.at) { jolt = t - g.clank.at; rot = Math.sin(jolt / 26) * 0.05 * Math.exp(-jolt / 150) }
  // the whole basket shudders on the slam, the stanchion and all: hardest on the hard ones
  const shA = landed && t >= g.tf ? t - g.tf : -1
  const shud = shA >= 0 && shA < 900 ? Math.sin(shA / 22) * Math.exp(-shA / 240) * (D.tier === 'hard' ? 0.1 : D.tier === 'medium' ? 0.055 : 0.03) * kk : 0
  const hoopAt = part => { if (shud) { ctx.save(); ctx.translate(shud, 0) } hoop(ctx, V, c, part, rot, netAge, jolt); if (shud) ctx.restore() }
  hoopAt('back')

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
  hoopAt('net')
  hoopAt('front')

  // him
  // (the body's usual soft lag, but next to none out of the gather and on the slam: those are meant to snap)
  const snap = (tau != null && tau < 140) || (landed && t >= g.tf - 60 && t < g.tf + 140)
  const hipX = SX(bx), PEz = easedPose(PE, P, g, dtG, snap ? 7 : 22)
  g.fig = { x: hipX, y: floorY - j * s, s }   // (where he is on the screen: the frame-by-frame checks crop to him)
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
  if (g.phase !== 'pick') nameTag(ctx, view, clamp(hipX, 34, view.w - 34), floorY + 5 * U, name, 1)

  // the hit: a white flash off the iron and a burst of strokes out from the rim, gone in a blink (not with Reduce
  // Motion or low power)
  if (shA >= 0 && shA < 160 && !lightFx() && !view.empty) {
    const f = shA / 160, rx = SX(0) + shud, ry = SY(RIM_FT)
    if (shA < 90) { ctx.fillStyle = `rgba(255,255,255,${(0.26 * (1 - shA / 90)).toFixed(3)})`; ctx.fillRect(0, 0, view.w, view.h) }
    ctx.strokeStyle = `rgba(255,248,225,${(0.9 * (1 - f)).toFixed(3)})`; ctx.lineWidth = 2.4 * U; ctx.lineCap = 'round'; ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a0 = -Math.PI * 0.95 + (i / 7) * Math.PI * 0.9 + (i % 2) * 0.12, r0 = (1.1 + f * 1.6) * kk * 0.5, r1 = r0 + (0.9 + (i % 3) * 0.3) * kk * 0.5 * (1 - f * 0.5)
      ctx.moveTo(rx + Math.cos(a0) * r0, ry + Math.sin(a0) * r0 * 0.8); ctx.lineTo(rx + Math.cos(a0) * r1, ry + Math.sin(a0) * r1 * 0.8)
    }
    ctx.stroke(); ctx.lineCap = 'butt'
  }
  // the rings in the air: on the ball for the move, on the rim for the finish
  // (the next one shows too, dim, while he's still on this one: he sees the beat coming)
  const ringOf = (st, dim) => {
    if (st.kind === 'fin') ringAt(ctx, SX(0), SY(RIM_FT), RIM_HALF * kk + 5 * U, st, t, U, 0.3, dim)
    else if (bwx != null) ringAt(ctx, SX(bwx), SY(bwy), BALL_R * kk + 5 * U + (dim ? 7 * U : 0), st, t, U, 1, dim)
  }
  const cur = g.steps[g.k], nxt = g.steps[g.k + 1]
  if (cur && !g.fail && !g.done && cur.T != null && g.k > 0 && t >= Math.max(cur.cueAt, cur.liveAt ?? 0)) ringOf(cur, false)
  if (cur && nxt && !g.fail && !g.done && cur.T != null && nxt.T != null && t >= nxt.showAt) ringOf(nxt, true)

  // ── the words: the dunk and the try (top left); how it went (under the stamp) ──
  // (on a strip of its own, like the broadcast's: the banners in the rafters are behind it)
  if (g.phase === 'pick') { board(ctx, g, view, G); return }
  // the strip, top left: the dunk, its tier, the try
  ctx.font = `20px ${DISPLAY}`
  const nw = ctx.measureText(D.name.toUpperCase()).width
  ctx.fillStyle = 'rgba(6,10,12,.74)'; ctx.fillRect(0, 48, Math.max(nw, 150) + 24, 48)
  ctx.fillStyle = TIER_INK[D.tier]; ctx.fillRect(0, 48, 3, 48)
  text(ctx, D.name.toUpperCase(), 12, 62, { font: DISPLAY, size: 20, align: 'left', color: '#fff' })
  text(ctx, D.tier.toUpperCase(), 12, 84, { font: LABEL, size: 16, align: 'left', color: TIER_INK[D.tier], track: 1 })
  ctx.font = `16px ${LABEL}`
  const tw = ctx.measureText(D.tier.toUpperCase()).width + 2 * D.tier.length
  text(ctx, `ATTEMPT ${g.attempt} OF ${g.tries}`, 20 + tw, 84, { font: LABEL, size: 16, align: 'left', color: 'rgba(255,255,255,.86)', track: 1 })
  if (g.need) text(ctx, `NEEDS ${g.need}`, view.w - 12, 62, { font: LABEL, size: 16, align: 'right', color: GOLD, track: 1 })
  if (g.phase === 'card') { tryCard(ctx, g, view, G); return }
  if (g.stamp && !g.stamp.y) { g.stamp.y = view.h - 132; g.stamp.size = g.stamp.text.length > 13 ? 30 : g.stamp.text.length > 10 ? 34 : 40 }
  if (over && g.phase !== 'back' && t - g.doneAt > 160) {
    const f = g.fail
    const word = landed ? (g.quality >= 0.9 ? 'PERFECT TIMING' : g.quality >= 0.7 ? 'CLEAN' : 'GOT IT DOWN') : f ? `${f.why === 'early' ? 'EARLY' : 'LATE'} ON THE ${f.noun}` : ''
    text(ctx, word, 180, view.h - 92, { font: LABEL, size: 18, color: landed ? GOLD : 'rgba(255,255,255,.85)', track: 1.5 })
    // (a miss: how many he has left at it)
    if (!landed && g.loop) {
      const left = g.tries - g.attempt
      const line = left > 0 ? `MISS  ·  ${left === 1 ? 'ONE TRY' : left === 2 ? 'TWO TRIES' : `${left} TRIES`} LEFT` : 'MISS  ·  NO TRIES LEFT'
      if (t - g.doneAt > 420) text(ctx, line, 180, view.h - 66, { font: LABEL, size: 17, color: left > 0 ? '#fff' : BAD, track: 1.5 })
    }
  }
}

// The try's card: before every attempt, over the court, the way the broadcast puts it up. Which try it is (and how the
// ones before it went), the dunk, its tier and what he times, what the judges give it landed on this try (a miss before
// it costs about a point a judge), and what it needs. It goes on its own; a tap takes it away sooner.
function tryCard(ctx, g, view, G) {
  const D = g.dunk, keys = !!view.keys, x = 12, w = view.w - 24
  const a = easeOut(clamp(g.cardT / 200, 0, 1))
  const [lo0, hi0] = JUDGE_RANGE[D.tier], miss = g.attempt - 1
  const lo = Math.max(30, lo0 - 5 * miss), hi = Math.max(30, hi0 - 5 * miss)
  const y = Math.round(clamp(G.wallY - 236, 112, 150)), h = g.need ? 214 : 184
  ctx.globalAlpha = a
  ctx.fillStyle = 'rgba(6,10,12,.9)'; ctx.fillRect(x, y, w, h)
  ctx.fillStyle = TIER_INK[D.tier]; ctx.fillRect(x, y, 4, h)
  // the try, and the tries: MISS for each one gone, this one lit
  text(ctx, `ATTEMPT ${g.attempt} OF ${g.tries}`, x + 18, y + 24, { font: LABEL, size: 20, align: 'left', color: GOLD, track: 2 })
  for (let i = g.tries - 1, px = x + w - 14; i >= 0; i--) {
    const bw = 44, bx = px - bw
    px = bx - 5
    if (i < miss) { ctx.fillStyle = BAD; ctx.fillRect(bx, y + 13, bw, 20); text(ctx, 'MISS', bx + bw / 2, y + 24, { font: LABEL, size: 13, color: '#fff', track: 1 }) }
    else if (i === miss) { ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, y + 14, bw - 2, 18); text(ctx, 'NOW', bx + bw / 2, y + 24, { font: LABEL, size: 13, color: GOLD, track: 1 }) }
    else { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(bx, y + 13, bw, 20) }
  }
  // the dunk
  const name = D.name.toUpperCase()
  ctx.font = `34px ${DISPLAY}`
  const ns = ctx.measureText(name).width > w - 36 ? 28 : 34
  text(ctx, name, x + 18, y + 62, { font: DISPLAY, size: ns, align: 'left', color: '#fff' })
  text(ctx, `${TIER_WORD[D.tier]}  ·  ${stepsLine(g.S)}`, x + 18, y + 94, { font: LABEL, size: 15, align: 'left', color: TIER_INK[D.tier], track: 1 })
  ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x + 18, y + 112, w - 36, 1)
  // what it's worth on this try, and what it needs
  text(ctx, `JUDGES ${lo}-${hi}`, x + 18, y + 132, { font: DISPLAY, size: 22, align: 'left', color: '#fff' })
  text(ctx, miss ? `LANDED ON THIS TRY  ·  ${miss === 1 ? 'ONE MISS' : 'TWO MISSES'} COST ${5 * miss}` : 'LANDED ON THE FIRST TRY', x + 18, y + 154, { font: LABEL, size: 13, align: 'left', color: 'rgba(255,255,255,.7)', track: 0.5 })
  if (g.need) {
    const can = g.need <= hi
    text(ctx, `NEEDS ${g.need}`, x + 18, y + 186, { font: DISPLAY, size: 22, align: 'left', color: can ? GOLD : BAD })
    text(ctx, can ? 'TO MOVE UP' : 'OUT OF REACH ON THIS TRY', x + 18 + 92, y + 187, { font: LABEL, size: 13, align: 'left', color: 'rgba(255,255,255,.7)', track: 0.5 })
  }
  // going: the bar runs down as the card's time goes; a tap goes now
  const f = clamp(g.cardT / CARD_MS, 0, 1)
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, y + h - 3, w, 3)
  ctx.fillStyle = view.accent; ctx.fillRect(x, y + h - 3, w * (1 - f), 3)
  const hy = y + h + 22
  ctx.fillStyle = 'rgba(6,10,12,.78)'; ctx.fillRect(x + w / 2 - 80, hy - 14, 160, 28)
  if (keys) { text(ctx, 'GO', x + w / 2 - 26, hy + 1, { font: LABEL, size: 16, color: '#fff', track: 2 }); keyCap(ctx, x + w / 2 + 22, hy, 'SPACE') }
  else text(ctx, 'TAP TO GO', x + w / 2, hy + 1, { font: LABEL, size: 16, color: '#fff', track: 2 })
  ctx.globalAlpha = 1
}

// running side-on, ph 0 the near foot coming down out in front
function foot(ph, A, lift) {
  const p = ((ph % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), SF = 0.34 * 2 * Math.PI
  if (p < SF) return [A - (2 * A * p) / SF, 0]
  const s = (p - SF) / (2 * Math.PI - SF)
  return [-A + 2 * A * easeInOut(s), lift * Math.sin(Math.PI * s)]
}
// walking, side-on: the same legs, shorter and lower, upright
function walkPose(ph, P) {
  P.hx = 0; P.lean = 0.03; P.hy = 46 + 1.2 * Math.abs(Math.sin(ph)); P.j = 0; P.toeF = 0; P.toeB = 0
  const [nx, ny] = foot(ph, 10, 8), [fx, fy] = foot(ph + Math.PI, 10, 8)
  P.fFx = nx; P.fFy = ny; P.fBx = fx; P.fBy = fy
  P.hFx = 14; P.hFy = 66; P.hBx = 2 - Math.sin(ph) * 6; P.hBy = 54
  return P
}
function runPose(ph, P) {
  P.hx = 0; P.lean = 0.14; P.hy = 44 + 2.5 * Math.abs(Math.sin(ph)); P.j = 0; P.toeF = 0; P.toeB = 0
  const [nx, ny] = foot(ph, 17, 22), [fx, fy] = foot(ph + Math.PI, 17, 22)
  P.fFx = nx; P.fFy = ny; P.fBx = fx; P.fBy = fy
  P.hFx = 18; P.hFy = 70 + Math.sin(2 * ph) * 2; P.hBx = 16; P.hBy = 72
  return P
}
