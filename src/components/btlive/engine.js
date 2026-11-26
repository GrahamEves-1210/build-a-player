// BLACKTOP LIVE, the screen's engine: runs the simulation (lib/btlive) at its ticks (tune.js HZ: 36 a second), draws it at the
// display's rate with the positions eased between ticks, reads the stick and the buttons, times the shot meter on
// this device, and turns what happened into sound, haptics and the rare animations. No React in here and no
// React state per frame: it draws on a canvas and writes the few bits of the HUD that change straight to the DOM.
import { paintCourt, drawHoop, drawHoopShadow, VIEW_LIFT, HOOP_LIFT, RIM_DRAW } from './court.js'
import { createGame, step, cpuInput, passTarget, meterQuality, meterGrade, meterSpec, moveLocal, moveInput, moveQueued, shotKindAt, shotWindow, referee as ref, HZ, COURT, T, MOVES, MOVE_KEYS, gticks, createGesture, createTaps } from '../../lib/btlive/index.js'
import { applySnap, lerpAt, relMsg, SEND_EVERY, SNAP_ACT, MOVE_KEEP } from '../../lib/btlive/proto.js'
import { drawFigure, drawShadow, pointAt, lookOf, ballHz } from './figure.js'
import { createPoser } from './pose.js'
import { sfx, haptic } from '../../lib/juice'

const STEP = 1000 / HZ
const FONT = '"BAP Bebas", "Bebas Neue", "BAP Anton", Impact, sans-serif'
const TEAM = ['#4da3ff', '#ff4d5e', '#c792ff']   // Blacktop's two sides (AppBlacktop TEAM_COLORS); King of the Hill's third man
const GREEN = '#3ddc84', AMBER = '#f2b33d', RED = '#ff5a5a', FLOOD = '#fff0cf'
// the release, by how far off it was: green on time, amber a touch off, red well off (EARLY sits under the window,
// LATE over it, so the marker's place says which); a shot that never went up is grey
const GRADE_COL = { PERFECT: GREEN, 'SLIGHTLY EARLY': AMBER, 'SLIGHTLY LATE': AMBER, EARLY: RED, LATE: RED, 'NO SHOT': '#aab4be' }
const SIDE_COL = ['#4da3ff', '#ff4d5e', '#c792ff']   // the scorebug's colours by side (the third man in King of the Hill: --t2)
const METER_HOLD = 600, METER_FADE = 250       // after the release the meter stays this long where he stopped it, then fades
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const reduced = () => document.documentElement.classList.contains('bap-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// setup: { teams, levels (per player: a CPU level, null for the person), me (index), looks (per player:
//          { label, photo, faceCenter }), seed }
// els:   { canvas, court, world, sides (the scorebug's row of sides: the engine fills it), clock, note, pad, base, knob,
//          home (where the stick rests), ds, dk (the small stick for dribble moves and its knob), btn: { a, b }, lab: { a, b } }
// on:    { final(result) }
// net:   online only (net.js openNet): the line to the referee. The engine then runs no game of its own: it moves
//        this device's player at once, times his meter here, sends both, and draws everyone else a beat behind the
//        referee's snapshots, eased between them (setup.levels all null)
export function createEngine({ setup, els, on, net = null }) {
  const ctx = els.canvas.getContext('2d')
  let s = createGame({ teams: setup.teams, seed: setup.seed, mode: setup.mode })
  const me = setup.me
  // the dribble moves: on the move stick (the default: any quick flick of it, gesture.js; on a keyboard a direction
  // tapped or a hard change of direction, SHIFT the spin), or on a second stick (the right pad, the arrow keys) as before (setup.stick 'two')
  const ONE = setup.stick !== 'two'
  const G = createGesture(), TP = createTaps()
  const levels = setup.levels.slice()
  const N = s.players.length
  const prev = new Float32Array(N * 2), prevBall = [0, 0, 0]
  const inputs = []
  const fx = []                                   // { text, x, y, t0, dur, color, big } and { rim, t0, dur }
  const CLR = { team: -1, t0: 0 }                 // the side taking it back after a stop (the arc lit), since when
  const imgs = setup.looks.map(l => { if (!l.photo) return null; const im = new Image(); im.src = l.photo; return im })
  let w = 0, h = 0, k = 1, dpr = 1
  let raf = 0, last = 0, acc = 0, paused = false, dead = false, clockNow = 0
  let shown = { clock: null, idle: null, poss: null, note: null, mode: null, gp: false, bug: null, sc: [] }
  // the person's hands: the stick, the two buttons (down now / tapped since the last tick / must be let go first), and
  // the flicks of the small stick that haven't gone into a tick yet (dq: [x, y] each, a dribble move)
  // (ts, tj: the right stick flicked down (a swipe at the ball) or up (a jump) without the ball, since the last tick)
  const H = { mx: 0, my: 0, a: false, b: false, ta: false, tb: false, na: false, nb: false, aT0: 0, aUp: 0, dq: [], ts: false, tj: false }
  // the shot meter, timed on this device
  // (rel: where he stopped it, kept on the screen for a moment after the release; side: which side of him it's drawn)
  const meter = { on: false, t0: 0, spec: null, read: 0, q: null, grade: null, gradeAt: 0, gradeGood: false, rel: null, side: 0 }
  const keys = new Set()
  // online: what this device has sent and heard, and what it is doing before the referee knows (local)
  const online = !!net
  // (mv: this device's own dribble move, as its own man is doing it now: the referee's word on it comes a beat later)
  const NB = { k: 0, n: [0, 0, 0, 0, 0], d: [], rel: null, lastK: -1, lastQ: 0, buf: [], off: null, sendT: 0, edge: false, local: null, mv: { burst: 0, mv: 0, bn: 0 }, lt: 0, wasLive: false, aUsed: 0, aOff: false }
  const DELAY = Math.round(0.2 * HZ)               // others are drawn this many ticks behind the latest word (200 ms)
  const DX = new Float32Array(N), DY = new Float32Array(N), DB = [0, 0, 0], LP = new Float32Array(N * 2)
  const LAY = { dots: [], bars: [], ball: null, words: [], tabs: [] }   // DEV: what was drawn where on the last frame (px, world)
  const EVLOG = [], PFN = SNAP_ACT                 // (PFN: where a snapshot row keeps the act: proto.js snapOf)
  // the men as they're drawn: each one's look (his side's colour, his skin and number) and his pose (pose.js)
  const poser = createPoser(N)
  const MOVE_WORD = { cross: 'CROSSOVER', hesi: 'HESITATION', back: 'STEP-BACK', btb: 'BEHIND THE BACK', spin: 'SPIN MOVE', inout: 'IN AND OUT', btl: 'BETWEEN THE LEGS' }

  // The court is a window onto the half court: its height always shows the whole depth (baseline to half court);
  // on a narrow screen (a phone held upright) it shows about 34 of the 56 feet across and pans with the play.
  let cam = null, camPx = 0, worldW = 0
  function resize() {
    const r = els.court.getBoundingClientRect()
    dpr = Math.min(3, window.devicePixelRatio || 1)
    w = r.width; h = r.height; k = h / COURT.H; worldW = COURT.W * k
    els.canvas.width = Math.round(w * dpr); els.canvas.height = Math.round(h * dpr)
    if (els.world) { els.world.style.width = `${worldW}px`; els.world.style.height = `${h}px` }
    cam = null
  }
  // where the camera looks: mostly the ball, some of the player being controlled; eased, never past the court's edges
  function camera(dt) {
    if (worldW <= w + 1) { camPx = (worldW - w) / 2 }
    else {
      const b = s.ball, P = s.players
      const bx = b.st === 'held' ? P[b.holder].x : b.x
      // in a team game, the whole floor's middle counts too (so a teammate to pass to is more often on the screen)
      let mid = 0; for (const o of P) mid += o.x; mid /= P.length
      const tx = (s.phase === 'live' ? (s.size > 1 ? bx * 0.45 + P[me].x * 0.2 + mid * 0.35 : bx * 0.6 + P[me].x * 0.4) : COURT.check.x) * k - w / 2
      cam = cam == null ? tx : cam + (tx - cam) * (1 - Math.exp(-dt / 260))
      camPx = clamp(cam, 0, worldW - w)
    }
    if (els.world && Math.abs((els.world._x ?? 1e9) - camPx) > 0.2) { els.world._x = camPx; els.world.style.transform = `translate3d(${-camPx}px,0,0)` }
  }

  // ── what happened this tick: sound, haptics, the words and the rare animations ──────────────────
  // a word about a player goes where it won't sit on him or the men around him: well below him near the rim, above him out top
  const wordY = y => (y < 20 ? y + 8.5 : y - 7)
  const say = (text, x, y, color = '#fff', big = false, dur = 1100) => fx.push({ text, x, y, t0: clockNow, dur, color, big })
  const kick = (amt = 1) => {
    if (reduced() || !els.court.animate) return
    els.court.animate([{ transform: 'none' }, { transform: `scale(${1 + 0.018 * amt}) translateY(${1.5 * amt}px)`, offset: 0.2 }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' })
  }
  // a dunk lands on the whole picture: down hard with the rim, back up past where it was, and still
  const slam = (amt = 1) => {
    if (reduced() || !els.court.animate) return
    const y = v => `translate3d(0, ${(v * amt).toFixed(1)}px, 0)`
    els.court.animate([{ transform: 'none' }, { transform: `${y(6)} scale(${1 + 0.012 * amt})`, offset: 0.12 }, { transform: y(-3.5), offset: 0.3 }, { transform: y(2), offset: 0.5 }, { transform: y(-1), offset: 0.72 }, { transform: 'none' }], { duration: 380, easing: 'linear' })
  }
  // the few people watching by the fence: they get up for a big play (arms up; the biggest, a hop too)
  const cheer = (amt = 1) => { CROWD.t0 = clockNow; CROWD.amt = amt }
  function onEvents() {
    const P = s.players
    for (const e of s.events) {
      const p = e.pid != null ? P[e.pid] : null
      poser.on(e, s, clockNow)
      if (e.e === 'make') {
        sfx('make'); haptic(e.kind === 'dunk' ? 'heavy' : 'medium')
        const word = e.poster ? 'POSTER' : e.kind === 'dunk' ? 'DUNK' : e.deep ? 'FROM DEEP' : e.pts === 2 ? 'TWO' : 'ONE'
        say(word, COURT.rim.x, 1.6, e.poster || e.deep ? FLOOD : colOf(e.pid), e.kind === 'dunk' || e.pts === 2, 1300)
        if (e.kind === 'dunk') {
          // the rim goes with him: pulled his way, and it springs back
          let ux = DX[e.pid] - COURT.rim.x, uy = DY[e.pid] - COURT.rim.y; const ul = Math.hypot(ux, uy)
          if (ul < 0.3) { ux = 0; uy = 1 } else { ux /= ul; uy /= ul }
          fx.push({ rim: 'dunk', t0: clockNow, dur: 640, ux, uy, big: e.poster })
          slam(e.poster ? 1.5 : 1)
        } else fx.push({ rim: 'make', t0: clockNow, dur: 300 })
        if (e.kind === 'dunk' || e.poster || e.deep || e.three) cheer(e.poster || e.kind === 'dunk' ? 2 : 1)
      } else if (e.e === 'miss') {
        sfx('rimmiss'); fx.push({ rim: 'miss', t0: clockNow, dur: 260 })
        // how it comes off: round the rim and out (in and out), or up off the back iron; then where the game sends it
        ROLL.t0 = clockNow; ROLL.a0 = Math.atan2(p.y - COURT.rim.y, p.x - COURT.rim.x); ROLL.how = s.tick % 3 === 0 ? 'back' : 'round'; ROLL.dir = s.tick % 2 ? 1 : -1
      }
      else if (e.e === 'block') { sfx('btblock'); haptic('heavy'); say(e.chase ? 'CHASE-DOWN' : 'BLOCKED', p.x, wordY(p.y), colOf(e.pid), true); kick(1); cheer(e.chase ? 2 : 1) }
      else if (e.e === 'steal') { sfx('btsteal'); haptic('medium'); say('STEAL', p.x, wordY(p.y), colOf(e.pid)) }
      else if (e.e === 'pick') { sfx('btsteal'); haptic('medium'); say('PICKED OFF', p.x, wordY(p.y), colOf(e.pid)) }
      else if (e.e === 'catch') sfx('catchball')
      else if (e.e === 'board') { sfx('catchball'); if (e.pid === me) haptic('light') }
      else if (e.e === 'move') {
        if (e.ankles) { haptic('heavy'); say('ANKLES', P[e.def].x, wordY(P[e.def].y), FLOOD, true, 1400); cheer(2) } else if (e.pid === me) haptic('light')
        // his own move, named as he makes it (how the small stick is learned)
        if (e.pid === me && !levels[me] && !e.ankles && MOVE_WORD[e.kind]) { for (const f of fx) if (f.mv) f.dur = 0; fx.push({ text: MOVE_WORD[e.kind], x: p.x, y: p.y < 9 ? p.y + 4.6 : p.y - 4.6, t0: clockNow, dur: 750, color: 'rgba(255,255,255,.92)', big: false, small: true, mv: true }) }
      }
      else if (e.e === 'swipe') { if (e.pid === me) { haptic('light'); if (e.reach) say('REACH', p.x, wordY(p.y), 'rgba(255,255,255,.8)') } }
      else if (e.e === 'oob') { sfx('whistle'); say('OUT OF BOUNDS', COURT.rim.x, 22, '#fff') }
      else if (e.e === 'clock') { sfx('whistle'); say('SHOT CLOCK', COURT.rim.x, 22, '#fff') }
      // King of the Hill's check-up: CHECK under the king as the man guarding him bounces it over; the bounce heard
      else if (e.e === 'checkup') { const q = s.players[e.to]; say('CHECK', q.x, q.y + 5.5, '#fff', false, 700) }
      else if (e.e === 'checkbounce') sfx('dribble', 0.8)
      else if (e.e === 'check') { say('CHECK BALL', COURT.rim.x, 37.6, 'rgba(255,255,255,.75)', false, 900); H.na = H.a; H.nb = H.b; H.dq.length = 0; NB.aUsed = NB.n[0] }
      // a stop: no check, his side takes it back past the arc (the arc pulses for a few seconds, then stays lit till
      // it's done; not if he secured it behind the arc already, the same tick)
      else if (e.e === 'clear') { if (s.mustClear === e.team) { say('TAKE IT BACK', COURT.rim.x, 37.6, '#fff', false, 1300); fx[fx.length - 1].clr = true } }
      else if (e.e === 'cleared') { for (const f of fx) if (f.clr) f.dur = Math.min(f.dur, clockNow - f.t0 + 250) }
      // in before his side took it back: waved off
      else if (e.e === 'waved') { sfx('whistle'); fx.push({ rim: 'make', t0: clockNow, dur: 300 }); say('NO BASKET', COURT.rim.x, 1.6, '#fff', true, 1500); say('DIDN\'T TAKE IT BACK', COURT.rim.x, 22, 'rgba(255,255,255,.85)', false, 1600) }
      else if (e.e === 'release') { if (e.pid !== me || levels[me]) sfx('btrelease', 0.6) }        // his own sounds as he lets go (letGo)
      // a teammate calling for the ball: his man shows it on every screen (draw), and the man with it hears it
      else if (e.e === 'call') { if (p.team === P[me].team && e.pid !== me) { sfx('tap'); if (s.ball.holder === me) haptic('medium') } }
      // King of the Hill: the rotation. The one sitting out checks in; a stop crowns the defender
      else if (e.e === 'rotate') {
        if (e.why !== 'make') say('NEW KING', P[e.king].x, wordY(P[e.king].y), colOf(e.king), true, 1200)
        say(`${nameOf(e.in).toUpperCase()} CHECKS IN`, COURT.rim.x, 22, 'rgba(255,255,255,.9)', false, 1400)
        if (e.in === me || e.sit === me) haptic('light')
      }
      else if (e.e === 'final') {
        const won = e.winner === s.players[me].team
        sfx(won ? 'award' : 'deny'); if (won) haptic('success')
        on.final?.({ winner: e.winner, score: e.score, stats: s.stats.map(x => ({ ...x })), won })
      }
    }
    if (s.gamePoint && !shown.gp && s.phase !== 'over') { shown.gp = true; say('GAME POINT', COURT.rim.x, 1.6, FLOOD, true, 1500) }
  }

  // ── one tick ────────────────────────────────────────────────────────────────────────────────────
  function myInput() {
    const p = s.players[me]
    const A = (H.a && !H.na) || H.ta, B = (H.b && !H.nb) || H.tb
    const st = H.ts, jp = H.tj
    H.ta = H.tb = H.ts = H.tj = false
    const fl = H.dq.shift()                                     // a flick of the right stick with the ball: a dribble move, this tick
    const inp = { mx: H.mx, my: H.my, shoot: A, steal: st, pass: B, jump: jp, dx: fl ? fl[0] : 0, dy: fl ? fl[1] : 0, q: null, t: s.tick }
    if (p.act === 'gather' && meter.on) {
      // the release goes out with the quality this device judged; until then the button counts as held
      if (meter.q != null) { inp.shoot = false; inp.q = meter.q; meter.q = null } else inp.shoot = true
    }
    return inp
  }
  function tick() {
    const P = s.players
    for (let i = 0; i < N; i++) { prev[i * 2] = P[i].x; prev[i * 2 + 1] = P[i].y }
    prevBall[0] = s.ball.x; prevBall[1] = s.ball.y; prevBall[2] = s.ball.z
    gesture()
    for (let i = 0; i < N; i++) inputs[i] = levels[i] ? cpuInput(s, i, levels[i]) : myInput()
    step(s, inputs)
    onEvents()
    meterWatch()
    hud()
  }
  // my meter: it starts when the shot has started (the simulation's word, or online this device's), on the clock of the press
  function meterWatch() {
    const p = s.players[me]
    if (p.act === 'gather' && !meter.on && !levels[me]) {
      meter.on = true; meter.spec = p.shot.spec; meter.read = p.shot.read; meter.q = null; meter.grade = null; meter.rel = null; meter.side = 0; meter.dy = 0
      meter.base = null                                          // (the window moves with the shot now: sim.js shotWindow)
      meter.t0 = clockNow - H.aT0 < 220 ? H.aT0 : clockNow - STEP
      if (!H.a && H.aUp >= H.aT0) letGo(H.aUp)                    // pressed and let go inside one tick
    } else if (p.act !== 'gather' && meter.on) {
      meter.on = false
      // did the shot go up? (practice: the step's word this tick. A gather ended by the shot clock, a steal or a
      // turnover is no shot at all, whatever the button did; the physics may say so itself: a 'noshot' event)
      const ev = s.events
      const none = ev.some(e => e.pid === me && (/^no-?shot$/i.test(e.e) || (e.e === 'release' && (e.noShot || e.none))))
      const went = online || ev.some(e => (e.e === 'release' && e.pid === me) || (e.e === 'block' && e.on === me))
      if (none || !went) { meter.grade = 'NO SHOT'; meter.gradeGood = false; meter.gradeAt = clockNow; meter.rel = null }
      else if (!meter.grade) {                                     // held past the end: it went up late
        const held = meter.spec.total
        meter.grade = meterGrade(meter.spec, held); meter.gradeGood = false; meter.gradeAt = clockNow
        meter.rel = { held, at: clockNow }
        sfx('btrelease'); haptic('light')
      }
    }
  }
  function letGo(at) {
    if (!meter.on || meter.grade) return
    const held = clamp(at - meter.t0, 0, meter.spec.total)
    meter.q = meterQuality(meter.spec, held); meter.grade = meterGrade(meter.spec, held); meter.gradeGood = meter.q >= 1; meter.gradeAt = at
    meter.rel = { held, at }
    // the ball leaving his hand, and a cue of its own for a green release
    if (meter.gradeGood) { sfx('btgreen'); haptic('medium') } else { sfx('btrelease'); haptic('light') }
    if (online && NB.local?.act === 'gather') {
      // only the quality goes to the referee; he comes down here and now
      NB.rel = relMsg(NB.local.sn, meter.q); NB.edge = true
      NB.local = { act: 'follow', until: NB.lt + gticks(T.follow) }
      const p = s.players[me]; p.act = 'follow'; p.actT = 0; p.shot = null; meter.q = null
    }
  }

  // ── online: one tick on this device, and a snapshot from the referee ────────────────────────────
  const r2 = v => Math.round(v * 100) / 100
  function onlineTick() {
    const p = s.players[me], b = s.ball
    NB.lt++
    gesture()
    prev[me * 2] = p.x; prev[me * 2 + 1] = p.y
    H.ta = H.tb = H.ts = H.tj = false
    const live = s.phase === 'live'
    mvLoad(p)
    const has = live && b.st === 'held' && b.holder === me
    // a shot and a move start here, now; the referee's word follows. A shot goes from a SHOOT press made with his side
    // on the ball in the last half second that hasn't started one yet, held or not (the step's rule: T.shootBuffer)
    const aBuf = NB.aOff && NB.aUsed !== NB.n[0] && clockNow - H.aT0 <= T.shootBuffer * 1000
    if (has && aBuf && p.act === 'free' && p.noAct <= 0 && !NB.local) {
      NB.aUsed = NB.n[0]
      const kind = shotKindAt(s, me), d = ref.rimDist(p)
      const c0 = ref.contestOf(p, s.players.filter(o => o.team !== p.team && !o.out), kind).c
      p.act = 'gather'; p.actT = 0
      const sp = Math.hypot(p.vx, p.vy), run = clamp(sp / p.R.topBall, 0, 1)
      p.shot = { kind, spec: meterSpec(kind, p.R, s.gamePoint, ref.dunkLift(p.R)), d, three: kind === 'jumper' && ref.isThree(p.x, p.y), read: c0 < 0.2 ? 0 : c0 < 0.5 ? 1 : 2, run, mx: run > 0.3 ? p.vx / sp : 0, my: run > 0.3 ? p.vy / sp : 0 }
      shotWindow(s, p)
      NB.local = { act: 'gather', shot: p.shot, sn: NB.n[0] }
    }
    // a dribble move starts here too (the step's rules: sim.js doMove); the flick itself went to the referee as it was made
    const fl = H.dq.shift()
    if (p.moveCd > 0) p.moveCd--
    if (has && p.act === 'free' && p.noAct <= 0) {
      if (fl) { moveInput(p, { x: fl[0], y: fl[1] }, NB.lt); NB.lastMv = NB.lt }
      else moveQueued(p, NB.lt)
    }
    if (NB.local?.act === 'gather') p.actT++
    if (NB.local?.act === 'follow' && NB.lt >= NB.local.until) { NB.local = null; if (p.act === 'follow') p.act = 'free' }
    if (live && NB.wasLive) moveLocal(s, me, { mx: H.mx, my: H.my })
    mvSave(p)
    // held past the end of the meter: it goes, late
    if (meter.on && !meter.grade && clockNow - meter.t0 >= meter.spec.total) letGo(meter.t0 + meter.spec.total)
    if (++NB.sendT >= SEND_EVERY || NB.edge) {
      NB.sendT = 0; NB.edge = false
      net.send({ t: 'in', k: ++NB.k, mx: r2(H.mx), my: r2(H.my), x: r2(p.x), y: r2(p.y), vx: r2(p.vx), vy: r2(p.vy), h: (H.a ? 1 : 0) | (H.b ? 2 : 0), n: NB.n, d: NB.d, rel: NB.rel })
    }
    meterWatch()
    hud()
  }
  // this device's own move: kept through the referee's snapshots (they carry his word on it, a beat old)
  // (and the hand the ball is in, the chain's clock and the flick waiting in it: all his device's own a beat early)
  const MVF = ['burst', 'mv', 'bn', 'hand', 'moveCd', 'mqT', 'mqx', 'mqy', 'fkx', 'fky', 'bdx', 'bdy', 'bs', 'bk', 'chn']
  function mvSave(p) { for (const f of MVF) NB.mv[f] = p[f] }
  function mvLoad(p) { if (NB.mv.hand == null) return; for (const f of MVF) p[f] = NB.mv[f]; if (!NB.mv.burst) p.bs = 0 }
  function onSnap(m) {
    if (m.k <= NB.lastK) return
    NB.lastK = m.k
    const now = performance.now(), o = now - m.k * STEP
    NB.off = NB.off == null || o < NB.off ? o : NB.off + (o - NB.off) * 0.02
    const p = s.players[me]
    // my own position is mine while the ball is live; between plays (and as one starts) it's the referee's
    const mine = m.ph === 'live' && NB.wasLive
    applySnap(s, m, mine ? me : -1)
    NB.wasLive = m.ph === 'live'
    const L = NB.local
    if (L?.act === 'gather') { p.act = 'gather'; p.shot = L.shot }
    else if (L?.act === 'follow' && p.act !== 'frozen' && p.act !== 'down') p.act = 'follow'
    if (!mine) { prev[me * 2] = p.x; prev[me * 2 + 1] = p.y; NB.mv.hand = null; if (L) NB.local = null }
    // (the hand the ball is in: his device's while he's working moves; once he's been still with it a beat, the referee's)
    else if (NB.mv.hand != null && !NB.mv.burst && NB.mv.mqT < 0 && NB.lt - (NB.lastMv ?? -99) > HZ * 0.6) NB.mv.hand = p.hand
    mvLoad(p)
    if (NB.rel && m.a?.[me] >= NB.rel.sn) NB.rel = null
    const pos = new Float32Array(N * 2)
    m.p.forEach((a, i) => { pos[i * 2] = a[0]; pos[i * 2 + 1] = a[1] })
    NB.buf.push({ k: m.k, p: pos, b: [m.b.x, m.b.y, m.b.z] })
    if (NB.buf.length > 40) NB.buf.shift()
    const fresh = (m.e || []).filter(e => e.sq > NB.lastQ)
    if (fresh.length) NB.lastQ = fresh[fresh.length - 1].sq
    if (import.meta.env.DEV) for (const e of fresh) { EVLOG.push(e); if (EVLOG.length > 400) EVLOG.shift() }
    // a shot this device started that the referee never saw (the ball was already gone when the press got there):
    // the ball isn't his any more, so the meter goes away
    if (NB.local?.act === 'gather' && !(m.b.st === 'held' && m.b.holder === me) && m.p[me][PFN] !== 'gather') { NB.local = null; p.act = 'free'; p.shot = null; meter.on = false; meter.grade = 'NO SHOT'; meter.gradeGood = false; meter.gradeAt = clockNow; meter.rel = null; meter.q = null }
    s.events = fresh
    onEvents()
    hud()
  }
  // where everything is drawn this frame (feet): practice eases between the last two ticks; online, everyone else is
  // a beat behind the referee and this device's own player is where this device has him
  // this device's own man is drawn a part of a tick ahead (as far again as he went in the last one), not a part of
  // a tick behind: what the thumb does shows at once, and the others still glide between their ticks
  function ahead(i, a) {
    const p = s.players[i], dx = p.x - prev[i * 2], dy = p.y - prev[i * 2 + 1]
    if (dx * dx + dy * dy < 1.44) { DX[i] = p.x + dx * a; DY[i] = p.y + dy * a } else { DX[i] = p.x; DY[i] = p.y }
  }
  function places(a) {
    const P = s.players, b = s.ball
    if (online && NB.buf.length) {
      lerpAt(NB.buf, (performance.now() - NB.off) / STEP - DELAY, LP, DB)
      for (let i = 0; i < N; i++) { DX[i] = LP[i * 2]; DY[i] = LP[i * 2 + 1] }
      if (s.phase === 'live' && NB.wasLive) ahead(me, a)
      return
    }
    for (let i = 0; i < N; i++) { DX[i] = prev[i * 2] + (P[i].x - prev[i * 2]) * a; DY[i] = prev[i * 2 + 1] + (P[i].y - prev[i * 2 + 1]) * a }
    if (!levels[me]) ahead(me, a)
    DB[0] = prevBall[0] + (b.x - prevBall[0]) * a; DB[1] = prevBall[1] + (b.y - prevBall[1]) * a; DB[2] = prevBall[2] + (b.z - prevBall[2]) * a
  }

  // ── the HUD: only what changed, straight to the DOM ─────────────────────────────────────────────
  // The scorebug's sides: the two teams, or in King of the Hill each man (s.mode 'koth'; s.score[i] per man, his
  // team is his index; s.king: the man attacking; s.mustClear: the man who must still take it past the arc, or null)
  const koth = () => s.mode === 'koth' || setup.mode === 'koth'
  const sideScore = i => {
    if (!koth()) return s.score?.[i] ?? 0
    const by = s.scores ?? s.pscore ?? s.pts ?? (s.score?.length === N ? s.score : null)
    return by?.[i] ?? s.players[i]?.score ?? s.stats?.[i]?.pts ?? 0
  }
  const nameOf = i => (koth() ? setup.looks[i]?.label : setup.names?.[i]) || '?'
  // the man with the ball whose side still has to take it back past the arc (s.mustClear: a side), or -1
  const clearer = () => {
    const c = s.mustClear, b = s.ball
    if (c == null || c < 0 || s.phase !== 'live' || b.st !== 'held') return -1
    return s.players[b.holder]?.team === c ? b.holder : -1
  }
  function buildBug() {
    const box = els.sides
    if (!box) return
    const n = koth() ? N : 2
    box.textContent = ''
    box.className = `btlv-bug-sides is-${n === 2 ? 'two' : 'many'}`
    shown.sc = []
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div'), ball = document.createElement('i'), nm = document.createElement('span'), sc = document.createElement('b'), tag = document.createElement('em')
      el.className = 'btlv-bug-side'; el.style.setProperty('--tc', setup.colors?.[i] ?? SIDE_COL[i] ?? '#fff')
      ball.className = 'btlv-bug-ball'; nm.className = 'btlv-bug-name'; sc.className = 'btlv-bug-score'; tag.className = 'btlv-bug-tag'
      nm.textContent = nameOf(i); sc.textContent = '0'
      el.append(ball, nm, tag, sc); box.append(el)
      shown.sc.push({ el, sc, tag, v: null, on: null, t: '' })
    }
    shown.bug = koth()
  }
  function hud() {
    const p = s.players[me], b = s.ball
    if (shown.bug !== koth()) buildBug()
    // the shot clock: counting while the ball is live; between plays the next one's full clock, dimmed
    const live = s.phase === 'live', sc = s.rules?.shotClock
    const full = Array.isArray(sc) ? sc[clamp((s.size || 1) - 1, 0, sc.length - 1)] : sc
    const sec = live ? Math.ceil(s.clock / HZ) : s.phase === 'over' ? null : (full ?? null)
    if (sec !== shown.clock || live !== shown.idle) {
      shown.clock = sec; shown.idle = live
      els.clock.textContent = sec == null ? '' : String(sec)
      els.clock.classList.toggle('is-low', live && sec != null && sec <= 3); els.clock.classList.toggle('is-idle', !live)
    }
    // who has it: the side with the ball lit, and said in words under the scores
    const K = koth(), hold = b.st === 'held' || b.st === 'dead' ? b.holder : -1
    const team = s.phase === 'dead' && s.next ? s.next.team : s.poss
    const on = K ? (s.phase === 'dead' && s.next?.carrier != null ? s.next.carrier : hold >= 0 ? hold : s.king ?? -1) : team
    const cl = clearer()
    shown.sc.forEach((c, i) => {
      const v = sideScore(i)
      if (v !== c.v) { c.v = v; c.sc.textContent = String(v) }
      const lit = i === on, king = K && s.king === i, sit = K && s.sit === i
      if (lit !== c.on || king !== c.king || sit !== c.sit) { c.on = lit; c.king = king; c.sit = sit; c.el.classList.toggle('is-on', lit); c.el.classList.toggle('is-king', king); c.el.classList.toggle('is-out', sit) }
      // King of the Hill: the king marked, and the man sitting out (he's up next)
      const t = !K ? '' : sit ? 'UP NEXT' : king ? 'KING' : ''
      if (t !== c.t) { c.t = t; c.tag.textContent = t; c.tag.classList.toggle('is-clear', t === 'TAKE IT BACK'); c.tag.classList.toggle('is-next', t === 'UP NEXT') }
    })
    let note = ''
    if (s.phase !== 'over') {
      if (K) {
        const kg = s.phase === 'dead' && s.next?.carrier != null ? s.next.carrier : s.king
        note = kg != null && kg >= 0 ? `${nameOf(kg)} IS KING${s.sit >= 0 ? ` · ${nameOf(s.sit)} SITS` : ''}` : ''
      } else if (team != null && team >= 0) note = s.mustClear === team && s.phase === 'live' ? `${nameOf(team)}'S BALL · TAKE IT BACK` : `${nameOf(team)}'S BALL`
    }
    const nc = K ? (cl >= 0 ? cl : s.king ?? on) : team
    if (!K && note && shown.ncl !== (s.mustClear === team)) { shown.ncl = s.mustClear === team; shown.note = null }
    if (note !== shown.note || nc !== shown.nc) {
      shown.note = note; shown.nc = nc
      if (els.note) { els.note.textContent = note.toUpperCase(); els.note.style.color = nc != null && nc >= 0 ? setup.colors?.[nc] ?? SIDE_COL[nc] ?? '' : '' }
    }
    const has = b.st === 'held' && b.holder === me, up = b.st === 'shot' || b.st === 'loose'
    // what his hands do right now: with the ball ('clear': his side still has to take it back), off it on offense, on
    // defense (the 'board' / 'dboard' ones: a shot or a loose ball up), sitting out (King of the Hill), or nothing
    // between plays. Every control says what it does for the side of the ball he's on, and changes the moment that does
    const mode = s.phase === 'dead' || s.phase === 'over' ? 'none' : p.out ? 'sit' : has ? (s.mustClear === p.team ? 'clear' : 'ball') : p.team === s.poss ? (up ? 'board' : 'off') : (up ? 'dboard' : 'def')
    const ball = mode === 'ball' || mode === 'clear'
    if (mode !== shown.mode) {
      shown.mode = mode
      const team = s.size > 1 && !koth()
      // A: SHOOT with the ball; BLOCK on defense (a hand up at the shot: the only way he jumps there); REBOUND with a
      // shot or a loose ball up; off the ball on offense a SHOOT that goes on the catch
      const A = { ball: ['SHOOT', 'HOLD, LET GO'], clear: ['SHOOT', 'TAKE IT BACK'], def: ['BLOCK', 'HAND UP'], dboard: ['REBOUND', 'GO UP'], board: ['REBOUND', 'GO UP'], off: ['SHOOT', 'ON THE CATCH'], sit: ['SHOOT', ''], none: ['SHOOT', ''] }[mode]
      els.btn.a.classList.toggle('is-dim', mode === 'none' || mode === 'sit' || mode === 'off')
      els.btn.a.classList.toggle('is-warn', mode === 'clear')
      els.btn.a.classList.toggle('is-def', mode === 'def' || mode === 'dboard' || mode === 'board')
      els.lab.a.textContent = A[0]
      if (els.lab.sa) els.lab.sa.textContent = A[1]
      // PASS (a team game): to a teammate with the ball, a call for it without
      const bl = ball ? 'PASS' : mode === 'off' || mode === 'board' ? 'CALL\nFOR IT' : 'PASS'
      els.lab.b.textContent = bl
      els.btn.b.classList.toggle('is-off', !team)
      els.btn.b.classList.toggle('is-dim', !(ball || mode === 'off' || mode === 'board'))
      els.btn.b.classList.toggle('is-two', bl !== 'PASS')
      // the right pad: a plain stick for the dribble moves with the ball; on defense it's the STEAL button; else idle
      // (the dribble moves on the move stick: no pad with the ball, SHOOT and PASS take the right side)
      const k = ball ? (ONE ? 'hide' : 'ball') : mode === 'def' || mode === 'dboard' ? 'steal' : 'none'
      if (els.base) els.base.dataset.l = ball && ONE ? 'MOVE\nSNAP FOR A MOVE' : 'MOVE'
      if (els.ds) { els.ds.dataset.k = k; els.ds.classList.toggle('is-dim', mode === 'dboard') }
      if (els.steal) els.steal.textContent = k === 'steal' ? 'STEAL' : ''
      if (els.root) { els.root.dataset.mode = ball ? 'ball' : mode === 'def' || mode === 'dboard' ? 'def' : mode === 'none' || mode === 'sit' ? 'none' : 'off'; els.root.dataset.clear = mode === 'clear' ? '1' : '' }
      // the keys beside the court
      const K2 = els.keys?.title ? els.keys : null
      if (K2) {
        if (K2.shoot) K2.shoot.textContent = A[0]
        if (K2.shootSub) { K2.shootSub.textContent = A[1]; K2.shootSub.classList.toggle('is-warn', mode === 'clear') }
        if (K2.shootRow) K2.shootRow.classList.toggle('is-dim', mode === 'none' || mode === 'sit' || mode === 'off')
        if (K2.pass) K2.pass.textContent = ball ? 'PASS' : 'CALL FOR IT'
        if (K2.passRow) K2.passRow.classList.toggle('is-off', !(ball || mode === 'off' || mode === 'board'))
        // the dribble moves with the ball (moveNames: W A S D tapped twice, or the arrows), STEAL (E) on defense
        const st = mode === 'def' || mode === 'dboard'
        if (K2.stealRow) { K2.stealRow.classList.toggle('is-off', !st); K2.stealRow.classList.toggle('is-dim', mode === 'dboard') }
        if (!ball) {
          K2.title.textContent = st ? 'ON DEFENSE' : mode === 'sit' ? 'SITTING OUT' : ''
          K2.rows.forEach(r => r.classList.add('is-off'))
          K2.spinRow?.classList.add('is-off')
          K2.box?.classList.toggle('is-empty', !st && mode !== 'sit')
          MV.keys = ''
        } else K2.box?.classList.remove('is-empty')
      }
    }
    if (ball) moveNames(p)
    // STEAL waits out its cooldown
    const cdS = mode === 'def' && p.stealCd > 0
    if (els.ds && els.ds.classList.contains('is-cd') !== cdS) els.ds.classList.toggle('is-cd', cdS)
    if (els.keys?.stealRow && els.keys.stealRow.classList.contains('is-cd') !== cdS) els.keys.stealRow.classList.toggle('is-cd', cdS)
    // his dribble legs (the stamina: a move costs some, simple dribbling gives it back): drawn by his ring (draw)
  }
  // The moves, named where they are: what a flick each way does from where he stands now (the basket is forward and
  // the hand the ball is in decides the side: referee.moveOf), on the right pad's eight ways and the four arrow keys.
  // A new set waits a few ticks before it shows (so a name doesn't flicker on a line between two moves)
  const MV = { cand: '', n: 0, pad: '', keys: '' }
  const NAME = { hesi: 'HESI', cross: 'CROSS', btl: 'BETWEEN\nLEGS', btb: 'BEHIND\nBACK', back: 'STEP-BACK', inout: 'IN & OUT', spin: 'SPIN' }
  const NAME_SIDE = { back: 'STEP\nBACK', inout: 'IN &\nOUT' }
  const NAME_KEY = { hesi: 'HESITATION', cross: 'CROSSOVER', btl: 'BETWEEN THE LEGS', btb: 'BEHIND THE BACK', back: 'STEP-BACK', inout: 'IN AND OUT', spin: 'SPIN' }
  const WAY = Array.from({ length: 8 }, (_, i) => ({ x: Math.sin(i * Math.PI / 4), y: -Math.cos(i * Math.PI / 4) }))
  const KEYWAY = [WAY[0], WAY[6], WAY[2], WAY[4]]
  // the keyboard's ways (WASD), in the panel's order (up, left, right, down); a key with the others held with it
  const DIR = { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }, OPP = { w: 's', s: 'w', a: 'd', d: 'a' }, KEYS1 = ['w', 'a', 'd', 's']
  const heldWay = k => {
    let x = DIR[k][0], y = DIR[k][1]
    for (const o of keys) if (o !== k && o !== OPP[k] && DIR[o]) { x += DIR[o][0]; y += DIR[o][1] }
    const m = Math.hypot(x, y) || 1
    return { x: x / m, y: y / m }
  }
  function moveNames(p) {
    const kinds = WAY.map(d => ref.moveKind(p, d))
    const key = kinds.join()
    if (key !== MV.cand) { MV.cand = key; MV.n = 0 }
    if (++MV.n < 4 && MV.pad) return
    // (the phone's pad is a plain stick now: the names round it are gone, the CONTROLS page teaches them)
    if (key !== MV.pad && els.slots?.[0] && els.padNames) {
      MV.pad = key
      // one name for each run of ways that make the same move: at its middle, or the straight way in it
      const out = Array(8).fill('')
      for (let i = 0; i < 8; i++) {
        if (kinds[i] === kinds[(i + 7) % 8]) continue
        let n = 1; while (n < 8 && kinds[(i + n) % 8] === kinds[i]) n++
        let at = (i + Math.floor((n - 1) / 2)) % 8
        if (n === 2 && i % 2) at = (i + 1) % 8
        out[at] = kinds[i]
      }
      if (kinds.every(k => k === kinds[0])) out[0] = kinds[0]
      out.forEach((kd, i) => { els.slots[i].textContent = kd ? (i === 0 ? NAME[kd] : NAME_SIDE[kd] ?? NAME[kd]) : '' })
    }
    // (on the move stick: each key tapped twice with the other keys he's holding: W held and A tapped twice is up and left)
    const kk = (ONE ? KEYS1.map(heldWay) : KEYWAY).map(d => ref.moveKind(p, d)).join()
    if (els.keys?.title && kk !== MV.keys) {
      MV.keys = kk
      els.keys.title.textContent = ONE ? 'TAP A KEY' : 'DRIBBLE MOVES'
      els.keys.spinRow?.classList.toggle('is-off', !ONE)
      kk.split(',').forEach((kd, i) => { els.keys.arrows[i].textContent = NAME_KEY[kd]; els.keys.subs[i].textContent = ''; els.keys.rows[i].classList.remove('is-off') })
      if (els.keys.stealRow) els.keys.stealRow.classList.add('is-off')
    }
  }

  // ── drawing ─────────────────────────────────────────────────────────────────────────────────────
  // The court picture is drawn from above with the rim at floor level, so height can't be drawn as a plain lift
  // up the screen (a ball 10 ft up at the rim would sit on the backboard). A ball's height shows as a little lift,
  // its size and its shadow; near the rim the lift is measured from the rim's height, so a shot meets the rim where
  // the rim is drawn, a make drops through the net and a miss leaves the rim and comes down on the floor.
  const RIM = COURT.rim
  const LIFT = VIEW_LIFT                                             // feet up the screen per foot of height (court.js)
  const TOPY = COURT.board.y                                          // the backboard's face: a ball is never drawn above it
  const HUP = HOOP_LIFT                                              // (the hoop is drawn this far up the screen: court.js)
  const UP_AIR = 0.6                                                  // how far off the floor (pose.js air) a man is up at the rim's height
  const colOf = i => TEAM[s.players[i].team] ?? '#fff'           // (King of the Hill: each man is his own side)
  const idxOf = v => (v == null || v === false ? -1 : typeof v === 'number' ? (v >= 0 && v < N ? v : -1) : s.players.findIndex(p => p.id === v))
  // King of the Hill: the king (not while he still has to take it back); every mode: the man taking it back
  const kingOf = () => (koth() && s.mustClear == null ? idxOf(s.king) : -1)
  const clearerOf = clearer
  const ovl = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))
  const rr = (x, y, ww, hh, r) => { ctx.beginPath(); ctx.roundRect(x, y, ww, hh, r) }
  // where a ball at (x, y, z) feet is drawn: [x px, y px, size]
  const BP = [0, 0, 1, 0]
  function ballAt(x, y, z) {
    const d = Math.hypot(x - RIM.x, y - RIM.y)
    if (s.ball.st === 'dead' && d < 0.05) {
      // a make: down through the net (from the rim, drawn HUP up the screen) to the floor just under it, and it stays
      const f = clamp(1 - z / 9, 0, 1)
      BP[0] = x * k; BP[1] = (y - HUP * (1 - f) + f * 1.6) * k; BP[2] = 1 - f * 0.22; BP[3] = 1
      return BP
    }
    let wr = clamp(1 - (d - 0.6) / 5, 0, 1); wr = wr * wr * (3 - 2 * wr)
    const ze = z * (1 - wr) + Math.max(0, z - 10) * wr               // height over what's under it (the floor, or the rim)
    // (drawn up the screen by its height: the rim is too, by its own 10 ft, so a ball at the rim is drawn on it)
    const lift = Math.min(LIFT * z, Math.max(0, y - TOPY + HUP))
    BP[0] = x * k; BP[1] = (y - lift) * k; BP[2] = 1 + ze * 0.028; BP[3] = 0
    return BP
  }
  // The ball: a real basketball, seen from above. Its seams are drawn from how it's turned (ROT, a 3x3 rotation): the
  // two great circles that cross at right angles (the cross: a '+' on the side where they meet) and the two curved side
  // seams, one each side of the cross, each a loop round the ball that dips in toward the cross where it passes it
  // and swings out wide between (a ')(' beside the '+', seen straight at the cross: the sport bar's ball, AppHome.jsx).
  // It turns the way the ball really does: it rolls forward on the dribble and on the floor, backspin on a jumper and
  // a pass. A shadow on the floor under it, apart from it by its height (shadow: false, the ball and nothing else)
  const SEAM = (() => {
    const n = 48, c = []
    const ring = f => { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n * 6.2832; pts.push(f(Math.cos(t), Math.sin(t), t)) } return pts }
    // the cross: the great circles through the poles (+-z) in the x-z and y-z planes
    c.push(ring((a, b) => [a, 0, b]), ring((a, b) => [0, a, b]))
    // the side seams: round the +-x axis, x 0.27 in where they pass the poles (t = 90, 270 deg), 0.67 out at y = +-1
    for (const sd of [1, -1]) c.push(ring((a, b, t) => { const x = 0.47 + 0.2 * Math.cos(2 * t), q = Math.sqrt(1 - x * x); return [sd * x, q * a, q * b] }))
    return c
  })()
  // the leather's pebble grain: a faint speckle, the same every frame (in the ball's place on the screen: at its size
  // a grain that turned with it would only shimmer)
  const PEBBLE = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 48
    const g = c.getContext('2d'), r = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(7)
    for (let i = 0; i < 380; i++) { g.fillStyle = r() < 0.5 ? 'rgba(60,20,4,.55)' : 'rgba(255,200,150,.35)'; g.fillRect(r() * 48, r() * 48, 1, 1) }
    return c
  })()
  const ROT = [1, 0, 0, 0, 1, 0, 0, 0, 1], SPIN = { x: 0, y: 0, ax: 0, ay: 1, w: 0, t: 0 }
  // turn the ball: about the axis (ax, ay, 0) by th radians
  function turnBall(ax, ay, th) {
    const l = Math.hypot(ax, ay); if (l < 1e-6 || !th) return
    ax /= l; ay /= l
    const c = Math.cos(th), sn = Math.sin(th), t = 1 - c
    const M = [t * ax * ax + c, t * ax * ay, sn * ay, t * ax * ay, t * ay * ay + c, -sn * ax, -sn * ay, sn * ax, c]
    const o = ROT.slice()
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) ROT[i * 3 + j] = M[i * 3] * o[j] + M[i * 3 + 1] * o[3 + j] + M[i * 3 + 2] * o[6 + j]
  }
  // how the ball turns this frame. vx, vy: how it's moving over the floor (ft/s); mode: 'roll' (forward, as fast as it
  // goes: the dribble, the floor), 'back' (backspin: a shot, a pass; w: turns a second), 'free' (what it had, dying off)
  function spinBall(vx, vy, mode, dt, w = 0) {
    const sp = Math.hypot(vx, vy), d = dt / 1000
    if (mode === 'roll' && sp > 0.2) { SPIN.ax = -vy / sp; SPIN.ay = vx / sp; SPIN.w = sp / 0.7 }
    else if (mode === 'back' && sp > 0.2) { SPIN.ax = vy / sp; SPIN.ay = -vx / sp; SPIN.w = w * 6.2832 }
    else SPIN.w *= Math.exp(-d / (mode === 'hold' ? 0.08 : 0.9))
    turnBall(SPIN.ax, SPIN.ay, SPIN.w * d)
  }
  function drawBall(x, y, sc, gx, gy, z, shadow = true) {
    const r = Math.max(4.5, k * 0.7) * sc
    if (shadow) {
      // the shadow: on the floor under it, smaller and fainter the higher it is
      const f = clamp(1 - z * 0.035, 0.45, 1)
      ctx.fillStyle = `rgba(0,0,0,${clamp(0.5 - z * 0.03, 0.12, 0.5)})`
      ctx.beginPath(); ctx.ellipse(gx + r * 0.12, gy + r * 0.3, r * 0.92 * f, r * 0.42 * f, 0, 0, 6.283); ctx.fill()
    }
    if (import.meta.env.DEV) LAY.ball = [x, y, r]
    // leather, lit from the top left
    const g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.1, x, y, r)
    g.addColorStop(0, '#f39552'); g.addColorStop(0.55, '#de6f2a'); g.addColorStop(1, '#a9491a')
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = g; ctx.fill()
    // the grain, then the seams: the parts of each one on the side facing up
    if (r >= 3.5) {
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r * 0.98, 0, 6.283); ctx.clip()
      if (r >= 6) { ctx.globalAlpha = 0.35; ctx.drawImage(PEBBLE, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1 }
      ctx.lineWidth = Math.max(0.8, r * 0.085); ctx.strokeStyle = '#2b1206'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath()
      for (const c of SEAM) {
        let pen = false
        for (const P of c) {
          const px = ROT[0] * P[0] + ROT[1] * P[1] + ROT[2] * P[2], py = ROT[3] * P[0] + ROT[4] * P[1] + ROT[5] * P[2], pz = ROT[6] * P[0] + ROT[7] * P[1] + ROT[8] * P[2]
          if (pz < -0.05) { pen = false; continue }
          if (pen) ctx.lineTo(x + px * r, y + py * r); else { ctx.moveTo(x + px * r, y + py * r); pen = true }
        }
      }
      ctx.stroke()
      // the light on it, up and to the left
      const hl = ctx.createRadialGradient(x - r * 0.42, y - r * 0.46, 0, x - r * 0.42, y - r * 0.46, r * 0.62)
      hl.addColorStop(0, 'rgba(255,235,210,.55)'); hl.addColorStop(1, 'rgba(255,235,210,0)')
      ctx.fillStyle = hl; ctx.fillRect(x - r, y - r, r * 2, r * 2)
      ctx.restore()
    }
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.lineWidth = Math.max(1, r * 0.09); ctx.strokeStyle = '#2a1004'; ctx.stroke()
  }
  // ── the men ──
  // Each man is a figure seen from above (figure.js) in the pose the game has him in (pose.js): his side's colour on
  // his jersey, his skin tone, his build (a guard leaner than a big, broader the bigger his Size), his arms and legs
  // doing what he's doing. No number on the court. A figure is about as wide across the shoulders as the body the
  // game collides, so two men in contact stand shoulder to shoulder.
  const LOOKS = setup.looks.map((l, i) => lookOf({ name: l.who || l.label || `p${i}`, skin: l.skin, col: colOf(i), size: s.players[i]?.R?.sizeRaw ?? 0.5, big: !!s.players[i]?.R?.big }))
  const FIG = LOOKS.map(look => ({ x: 0, y: 0, s: 30, ang: 0, scale: 1, air: 0, lean: 0, down: 0, lh: null, rh: null, lf: null, rf: null, toeL: 0, toeR: 0, look, hs: 20, cy: 0, ball: false, bounce: false, bl: null }))
  // (a man is drawn a little bigger than the body the game collides: from above, his arms reach past it)
  const FIGK = T.radius * 2 * 1.16
  const ENV = { x: 0, y: 0, a: 0, dt: 0, held: 0, sFt: 3 }, BQ = [0, 0, 0], BQ2 = [0, 0, 0]
  // ── the court around them ──
  // scuffs: a hard cut or a hard stop leaves a scrape under his feet that fades (and a puff of grit, not with Reduce Motion)
  const SCUFF = []
  // a missed shot off the rim, as drawn: round the rim and out, or up off the back iron, for its first moments
  const ROLL = { t0: -1e9, a0: 0, how: 'round', dir: 1 }, ROLL_MS = 300
  // the people watching: a few by the fence just off each sideline (feet), facing the court, in street clothes. They
  // follow the ball with their heads and get up for a big play (cheer)
  const CROWD = { t0: -1e9, amt: 1 }
  const FANS = [[1.55, 13.2, 0], [1.6, 15.4, 1], [54.45, 17.6, 2], [54.5, 19.9, 3]].map(([x, y, j]) => ({
    x, y, base: x < 28 ? 0 : Math.PI,
    f: { x: 0, y: 0, s: 30, ang: 0, scale: 0.92, air: 0, lean: 0, down: 0, lh: [0.12, -0.3, 0.3], rh: [0.12, 0.3, 0.3], lf: [0.03, -0.14], rf: [0.03, 0.14], toeL: 0, toeR: 0,
      look: lookOf({ name: `fan${j}${setup.seed || ''}`, col: ['#5d6673', '#7a5f47', '#3f5b4c', '#6c6f72'][j], size: 0.4 }) },
  }))
  function figures(now, dt, a, tk) {
    const sF = FIGK * k
    for (let i = 0; i < N; i++) {
      const p = s.players[i], f = FIG[i]
      ENV.x = DX[i]; ENV.y = DY[i]; ENV.a = a; ENV.dt = dt; ENV.sFt = sF / k
      // (how long his shot has been going up: his own meter's clock for this device's man, the game's ticks for the rest)
      ENV.held = i === me && !levels[me] && meter.on ? (meter.grade ? meter.gradeAt : now) - meter.t0 : (p.actT + a) * STEP
      const z = poser.pose(s, i, now, ENV)
      f.x = (DX[i] + z.ox) * k; f.y = (DY[i] + z.oy) * k; f.s = sF; f.ang = z.ang; f.scale = z.scale; f.air = z.air; f.lean = z.lean; f.down = z.down
      f.lh = z.lh; f.rh = z.rh; f.lf = z.lf; f.rf = z.rf; f.toeL = z.toeL; f.toeR = z.toeR; f.ball = z.ball; f.bounce = z.bounce; f.bl = z.bl; f.under = z.under; f.bside = z.bside
      // the ball off the floor: heard on each bounce
      if (z.thud && s.phase === 'live') sfx('dribble', i === me ? 1 : 0.7)
      if (z.cut && s.phase === 'live' && !z.air) { if (SCUFF.length > 10) SCUFF.shift(); SCUFF.push({ x: f.x, y: f.y, a: z.ang, t0: now, sd: (i + s.tick) % 2 ? 1 : -1 }) }
      // (the square the names, the meters and the words keep off: where he's drawn, a man in the air a touch up the screen)
      f.hs = sF * 0.5 * (1 + 0.16 * z.air); f.cy = f.y - z.air * sF * 0.2
    }
  }
  // the scrapes of hard cuts and stops, fading over a second and a half; a little grit kicked up for the first moment
  function drawScuffs(now) {
    for (let j = SCUFF.length - 1; j >= 0; j--) {
      const m = SCUFF[j], u = (now - m.t0) / 1500
      if (u > 1 || u < 0) { SCUFF.splice(j, 1); continue }
      const ca = Math.cos(m.a), sa = Math.sin(m.a), r = k * 0.75
      // (on worn asphalt a sole's scrape shows pale: the grit rubbed off the top)
      ctx.strokeStyle = `rgba(205,200,190,${(0.3 * (1 - u)).toFixed(3)})`; ctx.lineWidth = Math.max(1, k * 0.13); ctx.lineCap = 'round'
      for (const o of [-0.35, 0.35]) {
        const cx = m.x - sa * o * k, cy = m.y + ca * o * k
        ctx.beginPath(); ctx.arc(cx, cy, r, m.a + m.sd * 0.6, m.a + m.sd * 1.5, m.sd < 0); ctx.stroke()
      }
      if (u < 0.2 && !reduced()) {
        const g = u / 0.2
        ctx.fillStyle = `rgba(200,196,186,${(0.35 * (1 - g)).toFixed(3)})`
        for (let q = 0; q < 4; q++) { const an = m.a + Math.PI + (q - 1.5) * 0.5, d = k * (0.4 + 0.9 * g); ctx.beginPath(); ctx.arc(m.x + Math.cos(an) * d, m.y + Math.sin(an) * d, Math.max(0.8, k * 0.07), 0, 6.283); ctx.fill() }
      }
    }
  }
  // the people by the fence: heads on the ball, up on their feet for a big play (each a beat after the last)
  function drawFans(now) {
    const b = s.ball, bx = b.st === 'held' && b.holder >= 0 ? s.players[b.holder].x : b.x, by = b.st === 'held' && b.holder >= 0 ? s.players[b.holder].y : b.y
    const still = reduced()
    for (let j = 0; j < FANS.length; j++) {
      const F = FANS[j], f = F.f
      f.x = F.x * k; f.y = F.y * k; f.s = FIGK * k
      if (f.x < camPx - f.s || f.x > camPx + w + f.s) continue
      let da = Math.atan2(by - F.y, bx - F.x) - F.base
      while (da > Math.PI) da -= 2 * Math.PI
      while (da < -Math.PI) da += 2 * Math.PI
      const want = F.base + clamp(da, -0.75, 0.75)
      f.ang += (want - f.ang) * 0.06
      if (!F.seen) { f.ang = want; F.seen = true }
      const t = now - CROWD.t0 - j * 90, up = t > 0 && t < 1100 ? Math.sin(Math.PI * clamp(t / 1100, 0, 1)) : 0
      const hz = 0.3 + 0.75 * Math.min(1, up * 1.6)
      f.lh[0] = 0.12; f.lh[1] = -0.3; f.lh[2] = hz; f.rh[0] = 0.12; f.rh[1] = 0.3; f.rh[2] = CROWD.amt > 1 || j % 2 ? hz : 0.3 + 0.2 * up
      f.air = !still && CROWD.amt > 1 && up > 0 ? 0.12 * Math.abs(Math.sin(t / 150)) * up : 0
      drawShadow(ctx, f); drawFigure(ctx, f)
    }
  }
  // a crown over the king (King of the Hill)
  function drawCrown(x, y, wd) {
    const hh = wd * 0.62
    ctx.beginPath()
    ctx.moveTo(x - wd / 2, y); ctx.lineTo(x - wd / 2, y - hh); ctx.lineTo(x - wd / 4, y - hh * 0.45); ctx.lineTo(x, y - hh * 1.05)
    ctx.lineTo(x + wd / 4, y - hh * 0.45); ctx.lineTo(x + wd / 2, y - hh); ctx.lineTo(x + wd / 2, y); ctx.closePath()
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,7,10,.92)'; ctx.stroke()
    ctx.fillStyle = '#ffd34d'; ctx.fill()
  }
  // a small word in a bar: the name under a man, CLEAR IT over one ([x0, y0, x1, y1] given)
  // (face: his headshot at the front of his name, i: whose)
  function drawTag(rc, text, fs, col, fill, mine, face = -1) {
    rr(rc[0], rc[1], rc[2] - rc[0], rc[3] - rc[1], 2)
    ctx.fillStyle = fill ? col : 'rgba(5,7,10,.84)'; ctx.fill()
    let x0 = rc[0]
    if (face >= 0) {
      // a square of the photo around the face (object-fit: cover; object-position: the face)
      const im = imgs[face], hh = rc[3] - rc[1], side = Math.min(im.naturalWidth, im.naturalHeight), fc = setup.looks[face].faceCenter || [50, 30]
      const sx = clamp(im.naturalWidth * fc[0] / 100 - side * 0.3, 0, im.naturalWidth - side * 0.6), sy = clamp(im.naturalHeight * fc[1] / 100 - side * 0.28, 0, im.naturalHeight - side * 0.6)
      ctx.save(); rr(rc[0] + 1, rc[1] + 1, hh - 2, hh - 2, 2); ctx.clip()
      ctx.fillStyle = '#1c242e'; ctx.fillRect(rc[0], rc[1], hh, hh)
      ctx.drawImage(im, sx, sy, side * 0.6, side * 0.6, rc[0] + 1, rc[1] + 1, hh - 2, hh - 2)
      ctx.restore()
      x0 += hh
    } else if (!fill) { ctx.fillStyle = col; ctx.fillRect(rc[0], rc[1], 2, rc[3] - rc[1]) }
    ctx.font = `${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = fill ? '#05070a' : mine ? '#fff' : 'rgba(243,246,248,.9)'
    ctx.fillText(text, (x0 + rc[2]) / 2 + (fill || face >= 0 ? 0 : 1), (rc[1] + rc[3]) / 2 + 0.5)
  }
  // the edge of the screen: a tab in his colour, at his height, for a man cut by it
  function drawTab(i, off, y, tk, has) {
    const L = camPx, Rr = camPx + w, ex = off < 0 ? L : Rr, fs = Math.max(13, Math.round(tk * 0.36))
    ctx.fillStyle = 'rgba(5,7,10,.9)'; ctx.beginPath(); ctx.moveTo(ex, y - 13); ctx.lineTo(ex - off * 10, y - 13); ctx.lineTo(ex - off * 17, y); ctx.lineTo(ex - off * 10, y + 13); ctx.lineTo(ex, y + 13); ctx.fill()
    ctx.fillStyle = colOf(i); ctx.fillRect(off < 0 ? ex : ex - 4, y - 13, 4, 26)
    ctx.font = `${fs}px ${FONT}`
    const nm = setup.looks[i].label.toUpperCase().slice(0, 9) + (s.players[i].out ? ' · NEXT' : ''), nw = ctx.measureText(nm).width
    const x0 = off < 0 ? ex + 20 : ex - 20 - nw - 8
    drawTag([x0, y - fs * 0.62, x0 + nw + 8, y + fs * 0.62], nm, fs, colOf(i), i === me, i === me)
    if (has) drawBall(off < 0 ? x0 + nw + 8 + 9 : x0 - 9, y, 0.85, off < 0 ? x0 + nw + 17 : x0 - 9, y, 3)
    if (import.meta.env.DEV) LAY.tabs[i] = [off < 0 ? ex : x0 - 18, y - 13, off < 0 ? x0 + nw + 26 : ex, y + 13]
  }
  let lastDraw = 0
  // when the ball changes hands or leaves one, it starts from where it was drawn and eases to where it is
  const BL = { x: 0, y: 0, key: '', ox: 0, oy: 0, t0: 0, dur: 160 }
  // a word goes where no man is: tried at its spot, then a step up or down, then to the side
  function placeWord(f, fs, tw, obs) {
    const L = camPx, Rr = camPx + w
    const ax = f.x * k, ay = f.y * k, step = fs * 1.05
    let best = null, bc = Infinity
    for (const dy of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5]) {
      for (const dx of [0, -1, 1]) {
        const x = clamp(ax + dx * (tw * 0.5 + tk0 * 0.9), L + tw / 2 + 8, Rr - tw / 2 - 8), y = clamp(ay + dy * step, fs, h - fs)
        const rc = [x - tw / 2 - 3, y - fs * 0.55 - 8, x + tw / 2 + 3, y + fs * 0.55]
        let c = 0
        for (const o of obs) c += ovl(rc, o)
        c = c * 4 + Math.abs(dy) * 6 + Math.abs(dx) * 9
        if (c < bc) { bc = c; best = [x, y] }
      }
    }
    f.px = best[0]; f.py = best[1]
  }
  // A meter by the shooter. His own: a tall bar with the green window across it (wider than the bar, so the fill
  // never hides it); the fill turns green inside the window and red past it; after the release it stays a moment
  // where he stopped it, with a marker and the grade in its colour. Another player's: a thin bar, no window.
  function drawMeter(i, x, y, tk, now, a = 1) {
    const p = s.players[i], mine = i === me && !levels[me]
    const rel = mine ? meter.rel : null
    const spec = mine ? meter.spec : p.shot.spec
    if (!spec) return
    const held = rel ? rel.held : mine && meter.on ? (meter.grade ? meter.gradeAt : now) - meter.t0 : (p.actT + acc / STEP) * STEP
    // the bar's top is a little past the green: it fills toward the window near its top (a late release runs it full)
    const top = spec.ideal / 0.8
    const f = clamp(held / top, 0, 1)
    const bw = mine ? Math.round(clamp(tk * 0.34, 12, 16)) : Math.round(clamp(tk * 0.22, 7, 10))
    const bh = mine ? Math.round(clamp(tk * 2.7, 96, 136)) : Math.round(clamp(tk * 1.6, 44, 72))
    const L = camPx + 6, Rr = camPx + w - 6
    const fs = Math.round(clamp(tk * 0.42, 13, 18))
    const at = sd => x + sd * (tk * 0.5 + 16) - (sd < 0 ? bw : 0)
    const fits = sd => (sd > 0 ? at(1) + bw + 4 <= Rr : at(-1) - 4 >= L)
    // the side (and a nudge up or down) where it covers nobody: no other man, no name tag (BARS, DOTS: this frame's);
    // his own is kept while it stays as clear as the other (so it doesn't hop about), the other side when that one
    // hasn't the room on the screen
    const yOf = dy => clamp(y - bh * 0.7 + dy * bh, fs * 1.6 + 4, h - bh - 4)
    const mineBar = BAR_OF[i]
    const costOf = (sd, dy) => {
      if (!fits(sd)) return 1e6
      const x0 = at(sd), y0 = yOf(dy), rc = [x0 - 6, y0 - fs * 1.6, x0 + bw + 6, y0 + bh + 2]
      let c = Math.abs(dy) * 400
      for (const o of BARS) c += ovl(rc, o) * (o === mineBar ? 0.5 : 3)   // (his own name under it matters least)
      for (const d of DOTS) if (d[4] !== i) c += ovl(rc, d) * 3
      return c
    }
    // the side is picked once, as the shot starts (the side where it covers least and fits on the screen), and it
    // stays there till the meter is gone: it never hops across him mid-shot, whatever he or the camera does
    const shotKey = mine ? meter.t0 : s.tick - p.actT
    const lock = MSIDE[i]
    let side, dy
    if (lock && lock.key === shotKey) { side = lock.side; dy = lock.dy }
    else {
      let bc = Infinity; side = 1; dy = 0
      for (const sd of [1, -1]) for (const d of [0, -0.25, 0.25, -0.5]) { const c = costOf(sd, d); if (c < bc) { bc = c; side = sd; dy = d } }
      MSIDE[i] = { key: shotKey, side, dy }
    }
    if (mine) { meter.side = side; meter.dy = dy }
    const bx = clamp(at(side), L, Rr - bw), by = yOf(dy)
    const yAt = v => by + bh * (1 - clamp(v / top, 0, 1))           // a time on the meter -> its height on the screen
    ctx.globalAlpha = a
    // the track
    rr(bx - 2, by - 2, bw + 4, bh + 4, 3); ctx.fillStyle = 'rgba(5,7,10,.9)'; ctx.fill()
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(243,246,248,.55)'; ctx.stroke()
    if (!mine) {
      ctx.fillStyle = 'rgba(243,246,248,.85)'; ctx.fillRect(bx, by + bh * (1 - f), bw, bh * f)
      ctx.globalAlpha = 1
      return
    }
    const lo = spec.ideal - spec.win, hi = spec.ideal + spec.win
    // game point: the window it would be on any other play, as an outline, when the pressure (or his Clutch rating)
    // has moved it by a few ms or more; CLUTCH over the bar when his rating has made it wider
    const base = meter.base, clutch = base && Math.abs(base.win - spec.win) >= 3
    // the fill: white on the way up, green in the window, red past it (the grade's colour once he let go)
    const inWin = Math.abs(held - spec.ideal) <= spec.win, past = held > hi
    const col = rel ? GRADE_COL[meter.grade] ?? '#fff' : inWin ? GREEN : past ? RED : '#f3f6f8'
    const fy = by + bh * (1 - f)
    // the green window first, inside the bar (never thinner than 5px), so the fill rising through it is drawn over
    // it and seen passing through the green (the owner, 11-26: on a layup the white was behind the green)
    const wy0 = yAt(hi), wy1 = yAt(lo), wc = (wy0 + wy1) / 2, wh = Math.max(5, wy1 - wy0), wt = wc - wh / 2
    ctx.fillStyle = GREEN; ctx.fillRect(bx, wt, bw, wh)
    // the fill over it: white on the way up, a pale green where it is inside the window (the window still reads under
    // it), red past it; the grade's colour once he let go
    ctx.fillStyle = col === GREEN ? '#c8f7dc' : col; ctx.fillRect(bx, fy, bw, by + bh - fy)
    if (!rel && !past && fy < wt + wh) { ctx.fillStyle = '#c8f7dc'; ctx.fillRect(bx, Math.max(fy, wt), bw, wt + wh - Math.max(fy, wt)) }
    // the window's edges over everything (a dark line across the bar each end) and a white tick each side of it
    ctx.fillStyle = 'rgba(5,7,10,.85)'; ctx.fillRect(bx, wt - 1, bw, 1.5); ctx.fillRect(bx, wt + wh - 0.5, bw, 1.5)
    ctx.fillStyle = '#f3f6f8'; ctx.fillRect(bx - 5, wt - 1, 4, wh + 2); ctx.fillRect(bx + bw + 1, wt - 1, 4, wh + 2)
    // the needle: the head of the fill, a bright line just past the bar's edges, on top of the window
    if (!rel) { ctx.fillStyle = 'rgba(5,7,10,.95)'; ctx.fillRect(bx - 2, fy - 2, bw + 4, 4); ctx.fillStyle = inWin ? GREEN : '#fff'; ctx.fillRect(bx - 1, fy - 1, bw + 2, 2) }
    if (clutch) {                                                     // (dark dashes inside a wider window, light ones round a narrower)
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5; ctx.strokeStyle = spec.win > base.win ? 'rgba(5,7,10,.9)' : 'rgba(243,246,248,.8)'
      ctx.strokeRect(bx + 0.5, yAt(base.ideal + base.win), bw - 1, Math.max(4, yAt(base.ideal - base.win) - yAt(base.ideal + base.win))); ctx.setLineDash([])
    }
    ctx.font = `${fs}px ${FONT}`; ctx.textBaseline = 'middle'
    const chip = (text, cx, cy, color) => {
      const tw = ctx.measureText(text).width, pw = tw + 12, ph = Math.round(fs * 1.3)
      const x0 = clamp(cx - pw / 2, L, Rr - pw), y0 = clamp(cy - ph / 2, 2, h - ph - 2)
      ctx.fillStyle = 'rgba(5,7,10,.9)'; ctx.fillRect(x0, y0, pw, ph)
      ctx.fillStyle = color; ctx.fillRect(x0, y0, 3, ph)
      ctx.textAlign = 'left'; ctx.fillText(text, x0 + 7, y0 + ph / 2 + 0.5)
    }
    // the words go over the bar (never beside it, over a man's name)
    const overY = by - fs * 0.95
    if (rel) {
      // where he stopped it: a white line across, just past the bar's edges
      ctx.fillStyle = 'rgba(5,7,10,.95)'; ctx.fillRect(bx - 4, fy - 2.5, bw + 8, 5)
      ctx.fillStyle = '#fff'; ctx.fillRect(bx - 3, fy - 1, bw + 6, 2)
      chip(meter.grade, bx + bw / 2, overY, col)
    } else {
      // how open he is (as well as his IQ reads it)
      const read = ['OPEN', 'CONTESTED', 'SMOTHERED'][p.shot?.read ?? meter.read] ?? ''
      if (read) chip(read, bx + bw / 2, overY, [GREEN, AMBER, RED][meter.read])
      // pulled up on the move: it costs him a little (referee: setFeet)
      if ((p.shot?.kind === 'jumper') && (p.shot.run ?? 0) > 0.45) chip('ON THE MOVE', bx + bw / 2, overY - fs * 1.45, AMBER)
    }
    if (clutch && spec.win > base.win) chip('CLUTCH', bx + bw / 2, by + bh + fs * 0.95, GREEN)
    ctx.globalAlpha = 1
  }
  // two men in contact never stand on each other on the screen: this device's man is drawn a touch ahead of the game
  // (and online the others a beat behind), so figures closer than shoulder to shoulder are eased apart, a few px at most
  function relax(tk) {
    const need = FIGK * k * 0.86
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const dx = (DX[j] - DX[i]) * k, dy = (DY[j] - DY[i]) * k, d = Math.hypot(dx, dy)
        if (d < 0.5 || d >= need) continue
        const push = Math.min(need - d, 8) / 2 / k, ux = dx / d * push, uy = dy / d * push
        DX[i] -= ux; DY[i] -= uy; DX[j] += ux; DY[j] += uy
      }
    }
  }
  // the three-point line (tune.js COURT): straight up each side from the baseline, the curve over the top
  const ARC_PULSE = 3200
  function drawArc(col, t) {
    const C = COURT, a0 = Math.atan2(C.arcSideY - C.arcC.y, -C.arcSideX), a1 = Math.atan2(C.arcSideY - C.arcC.y, C.arcSideX)
    const path = () => {
      ctx.beginPath()
      ctx.moveTo((RIM.x - C.arcSideX) * k, C.minY * k); ctx.lineTo((RIM.x - C.arcSideX) * k, C.arcSideY * k)
      ctx.arc(C.arcC.x * k, C.arcC.y * k, C.arcR * k, a0, a1, true)
      ctx.lineTo((RIM.x + C.arcSideX) * k, C.minY * k)
    }
    const still = reduced() || t > ARC_PULSE
    const pulse = still ? 1 : 0.5 + 0.5 * Math.cos(t / ARC_PULSE * 4 * Math.PI)
    ctx.lineJoin = 'round'; ctx.lineCap = 'butt'
    path(); ctx.lineWidth = Math.max(3, k * 0.42); ctx.strokeStyle = 'rgba(5,7,10,.55)'; ctx.stroke()
    path(); ctx.lineWidth = Math.max(2, k * 0.26); ctx.strokeStyle = col; ctx.globalAlpha = still ? 0.85 : 0.35 + 0.6 * pulse; ctx.stroke()
    ctx.globalAlpha = 1
  }
  // the rim taking a make or a miss, a dunk on it: drawn with the hoop (draw)
  const C_RIMR = COURT.rimR
  function rimFx(now) {
    for (const f of fx) {
      if (f.rim !== 'make') continue
      const t = (now - f.t0) / f.dur
      if (t < 0 || t > 1) continue
      const r0 = k * C_RIMR * RIM_DRAW
      ctx.lineWidth = Math.max(2, k * 0.26); ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - t)})`
      ctx.beginPath(); ctx.arc(RIM.x * k, (RIM.y - HUP) * k, r0 * (1 - t * 0.45), 0, 6.283); ctx.stroke()
    }
    // a dunk on the rim: the rim dragged his way and springing back, a ring thrown off it, the hit marked round it
    for (const f of fx) {
      if (f.rim !== 'dunk') continue
      const t = (now - f.t0) / f.dur
      if (t < 0 || t > 1) continue
      const rx = RIM.x * k, ry = (RIM.y - HUP) * k, r0 = k * C_RIMR * RIM_DRAW, still = reduced()
      if (t < 0.5) { const u = t / 0.5; ctx.lineWidth = Math.max(1.5, k * 0.22) * (1 - u) + 0.5; ctx.strokeStyle = `rgba(255,255,255,${0.85 * (1 - u)})`; ctx.beginPath(); ctx.arc(rx, ry, r0 * (1 + 1.6 * u * (2 - u)), 0, 6.283); ctx.stroke() }
      if (t < 0.32 && !still) {
        const u = t / 0.32, n = f.big ? 10 : 8
        ctx.lineWidth = Math.max(2, k * 0.2); ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(255,240,207,${1 - u})`
        ctx.beginPath()
        for (let j = 0; j < n; j++) { const an = j / n * 6.283 + 0.3, r1 = r0 * (1.6 + 1.2 * u), r2 = r1 + r0 * (f.big ? 1.2 : 0.8) * (1 - u * 0.5); ctx.moveTo(rx + Math.cos(an) * r1, ry + Math.sin(an) * r1); ctx.lineTo(rx + Math.cos(an) * r2, ry + Math.sin(an) * r2) }
        ctx.stroke(); ctx.lineCap = 'butt'
      }
    }
  }
  // the rim pulled by a dunk, springing back: [x, y] px (or null)
  function rimSway(now) {
    for (const f of fx) {
      if (f.rim === 'miss') { const t = (now - f.t0) / f.dur; if (t < 0 || t > 1 || reduced()) continue; const wob = Math.sin(t * 22) * (1 - t) * k * 0.22; return [wob, wob * 0.4] }
      if (f.rim !== 'dunk') continue
      const t = (now - f.t0) / f.dur
      if (t < 0 || t > 1 || reduced()) continue
      const sp = Math.exp(-5.2 * t) * Math.cos(t * 30) * k * 0.62
      return [f.ux * sp, f.uy * sp]
    }
    return null
  }
  let tk0 = 30
  const BARS = [], BAR_OF = [], DOTS = [], CHOICE = new Int8Array(N), TABY = new Int8Array(N), MSIDE = []
  function draw(now) {
    const a = clamp(acc / STEP, 0, 1), P = s.players
    const dt = clamp(now - lastDraw, 0, 100); lastDraw = now
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.translate(-camPx, 0)                                         // world coordinates from here (the camera)
    const L = camPx, Rr = camPx + w                                  // the screen's edges, in them
    // a dot fits inside the body the game collides (its rings too), so two men touching don't overlap on the screen
    const tk = clamp(k * T.radius * 2 - 7, 18, 50); tk0 = tk
    places(a)
    if (s.phase !== 'over') relax(tk)
    figures(now, dt, a, tk)
    if (import.meta.env.DEV) { LAY.dots.length = LAY.bars.length = LAY.words.length = LAY.tabs.length = 0; LAY.ball = null; LAY.k = k; LAY.tk = tk; LAY.L = L; LAY.R = Rr; LAY.h = h }
    const X = i => FIG[i].x, Y = i => FIG[i].cy
    const b = s.ball, live = s.phase === 'live'
    const holder = b.st === 'held' ? b.holder : -1
    const king = kingOf(), clearer = clearerOf()
    // who is cut by the edge of the screen (a tab at the edge instead of half a man)
    const half = FIGK * k * 0.5
    const cut = i => (worldW <= w + 1 ? 0 : X(i) - half < L ? -1 : X(i) + half > Rr ? 1 : 0)
    // after a stop: the three-point line his side has to take it back behind, lit in their colour. A calm pulse for
    // the first few seconds (none with Reduce Motion), then it stays lit, still, till it's done
    if (s.mustClear != null && s.phase === 'live') { if (CLR.team !== s.mustClear) { CLR.team = s.mustClear; CLR.t0 = now } } else CLR.team = -1
    if (CLR.team >= 0) drawArc(TEAM[CLR.team] ?? '#fff', now - CLR.t0)
    // the hoop's shadow on the floor, always there (it moves with the rim on a dunk)
    drawHoopShadow(ctx, k, rimSway(now))
    drawScuffs(now)
    // every man's shadow first (no shadow lies on a man)
    for (let i = 0; i < N; i++) if (!cut(i)) drawShadow(ctx, FIG[i])
    drawFans(now)
    // under the player this device controls: a white ring on the floor (his jersey is his side's colour, so the ring
    // isn't), a faint fill of his colour inside it; under the teammate the stick points at, a dashed one
    const ringR = FIGK * k * 0.62
    if (s.phase !== 'over' && !cut(me)) {
      const mx = FIG[me].x, my = FIG[me].y, col = colOf(me)
      ctx.beginPath(); ctx.arc(mx, my, ringR, 0, 6.283); ctx.globalAlpha = 0.16; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(5,7,10,.7)'; ctx.stroke()
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#f3f6f8'
      ctx.beginPath(); ctx.arc(mx, my, ringR, 0, 6.283); ctx.stroke()
      if (s.size > 1 && !koth() && holder === me && live && !levels[me]) {
        const to = passTarget(s, me, H.mx, H.my)
        if (to >= 0 && !cut(to)) {
          ctx.setLineDash([5, 4]); ctx.strokeStyle = '#f3f6f8'; ctx.lineWidth = 2
          ctx.beginPath(); ctx.arc(FIG[to].x, FIG[to].y, ringR, 0, 6.283); ctx.stroke(); ctx.setLineDash([])
        }
      }
    }
    // the dribble legs (stamina) of the man with the ball, while they aren't full: a thin arc up the left of his spot on
    // the floor (clear of his name under him and the tags over him), white, amber when they're low
    if (holder >= 0 && live && !cut(holder) && (P[holder].sta ?? 1) < 0.985) {
      const f = FIG[holder], st = clamp(P[holder].sta ?? 1, 0, 1), rr0 = ringR + 4, a0 = Math.PI + 0.95, span = 1.9
      ctx.lineCap = 'butt'
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(5,7,10,.7)'; ctx.beginPath(); ctx.arc(f.x, f.y, rr0, a0 - span, a0); ctx.stroke()
      ctx.lineWidth = 2.5; ctx.strokeStyle = st < 0.35 ? AMBER : 'rgba(243,246,248,.9)'; ctx.beginPath(); ctx.arc(f.x, f.y, rr0, a0 - span * st, a0); ctx.stroke()
    }
    // a teammate calling for the ball: a ring on his man, on every screen, for as long as the call is fresh
    if (s.call && s.phase === 'live' && s.tick - s.call.tick < 45 && P[s.call.pid] && !cut(s.call.pid)) {
      const ci = s.call.pid, f = clamp((s.tick - s.call.tick) / 45, 0, 1)
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,255,255,${0.95 - 0.5 * f})`
      ctx.beginPath(); ctx.arc(FIG[ci].x, FIG[ci].y, FIGK * k * (0.64 + 0.2 * ((s.tick - s.call.tick) % 15) / 15), 0, 6.283); ctx.stroke()
    }
    // players, the far ones first, by where their feet are (and a man in the air over the men on the floor)
    const depth = i => DY[i] + FIG[i].air * 30
    const order = P.map((_, i) => i).sort((i, j) => depth(i) - depth(j))
    // the ball first (where it is, how it turns), then everyone and it in the order things stand off the floor (below)
    let bx, by, bsc, gx, gy, bz, key
    const carry = holder >= 0 ? holder : b.st === 'shot' && b.kind === 'dunk' && b.from >= 0 && FIG[b.from].ball ? b.from : -1
    if (carry >= 0) {
      const f = FIG[carry]
      if (f.ball) {
        const q = pointAt(f, f.bl[0], f.bl[1], BQ, f.bounce ? null : ballHz(f.bl[2]))
        bz = f.bl[2]; gx = q[0]; gy = q[2]; bx = q[0]; by = q[1]
        bsc = f.bounce ? 0.84 + bz * 0.05 : 0.9 + Math.min(bz, 9) * 0.022
        if (f.bounce) {
          // a dribble, seen from above: straight down under the dribbling hand and back up into it (the hand on top
          // of it at the top of the bounce), never off to the side of him
          const hd = f.bside > 0 ? f.rh : f.lh, hq = pointAt(f, hd[0], hd[1], BQ2, hd[2]), u = clamp((bz - 0.35) / 2.0, 0, 1)
          bx = q[0] + (hq[0] - q[0]) * u; by = q[1] + (hq[1] - q[1]) * u; gx = bx; gy = q[2] + (hq[2] - q[2]) * u
        }
      } else { bx = gx = f.x; by = f.cy; gy = f.y; bz = 3; bsc = 1 }
      key = 'h' + carry
    } else {
      let qx = DB[0], qy = DB[1], qz = DB[2]
      const ru = (now - ROLL.t0) / ROLL_MS
      if (b.st === 'loose' && b.reb && ru >= 0 && ru < 1) {
        // off the rim: round it and out, or up off the back iron, easing into where the game has it
        const R = COURT.rimR * 0.9, wgt = 1 - ru * ru * (3 - 2 * ru)
        let rx, ry, rz
        if (ROLL.how === 'round') { const an = ROLL.a0 + ROLL.dir * 2.4 * ru; rx = RIM.x + Math.cos(an) * R; ry = RIM.y + Math.sin(an) * R; rz = 10.2 }
        else { const back = Math.sin(Math.PI * Math.min(1, ru * 1.4)); rx = RIM.x; ry = RIM.y - R * back; rz = 10.2 + 1.6 * Math.sin(Math.PI * ru) }
        qx += (rx - qx) * wgt; qy += (ry - qy) * wgt; qz += (rz - qz) * wgt
      }
      const q = ballAt(qx, qy, qz)
      bx = q[0]; by = q[1]; bsc = q[2]; gx = qx * k; gy = q[3] ? by : qy * k; bz = qz
      key = b.st
    }
    if (key !== BL.key) {
      // a new holder or the ball let go: ease from where it was drawn (not across the floor after a whistle)
      const jx = BL.x - bx, jy = BL.y - by
      if (BL.key && Math.hypot(jx, jy) < k * 6) { BL.ox = jx; BL.oy = jy; BL.t0 = now } else BL.ox = BL.oy = 0
      // a shot keeps to the shooting hand's side for the first half of its flight (up past the man contesting it, not through his face)
      BL.dur = key === 'shot' && b.n ? Math.max(160, b.n * STEP * 0.5) : 160
      BL.key = key
    }
    const e = clamp((now - BL.t0) / BL.dur, 0, 1), ef = BL.dur > 160 ? 1 - e * (2 - e) * 0.5 - e * 0.5 : (1 - e) * (1 - e)
    const ballCut = carry >= 0 && (cut(carry) || FIG[carry].under)
    // how it turns: over the floor it rolls with the dribble and when it's loose on the floor; backspin on a shot and
    // a pass; held, it settles
    {
      const wx = gx / k, wy = gy / k, d = Math.max(1, dt) / 1000
      const vx = (wx - SPIN.x) / d, vy = (wy - SPIN.y) / d, jump = Math.hypot(wx - SPIN.x, wy - SPIN.y) > 6
      SPIN.x = wx; SPIN.y = wy
      if (!jump && dt > 0) {
        if (carry >= 0 && FIG[carry].bounce) { const p = P[carry]; spinBall(p.vx * 1.2, p.vy * 1.2, Math.hypot(p.vx, p.vy) > 1 ? 'roll' : 'free', dt) }
        else if (carry >= 0) spinBall(0, 0, 'hold', dt)
        else if (b.st === 'shot') spinBall(vx, vy, 'back', dt, b.kind === 'jumper' ? 2.2 : 1.2)
        else if (b.st === 'pass') spinBall(vx, vy, 'back', dt, 1.6)
        else if (bz < 0.4) spinBall(vx, vy, 'roll', dt)
        else spinBall(0, 0, 'free', dt)
      }
    }
    const BX = bx + BL.ox * ef, BY = by + BL.oy * ef, GX = gx + BL.ox * ef, GY = gy + BL.oy * ef
    BL.x = BX; BL.y = BY
    // In the order things stand off the floor, seen from above: a man's shoulders and head are about 6 ft up (more in
    // the air), so a ball lower than that goes under any man it's under on the screen, and over him once it's higher
    // (a jumper over the man contesting it, a pass at the chest under the shoulders of the man it goes by). In a man's
    // own hand it's drawn with him, over him. Its shadow is always on the floor
    const ballZ = carry >= 0 ? (FIG[carry].ball ? FIG[carry].bl[2] : 3) : DB[2]
    const ballR = Math.max(4.5, k * 0.7) * bsc
    if (!ballCut) { const f = clamp(1 - bz * 0.035, 0.45, 1); ctx.fillStyle = `rgba(0,0,0,${clamp(0.5 - bz * 0.03, 0.12, 0.5)})`; ctx.beginPath(); ctx.ellipse(GX + ballR * 0.12, GY + ballR * 0.3, ballR * 0.92 * f, ballR * 0.42 * f, 0, 0, 6.283); ctx.fill() }
    // Everything off the floor in order of depth (feet nearer the top of the screen first; a man in the air over the
    // men on the floor), then the hoop, then whoever is up at the rim. The hoop is always there and always at its
    // height: the arm, the board, the rim and the net are 10 ft and more up, over every man on the floor wherever he
    // stands (under it, behind the board, in front of it, posting up under the rim), so he walks under it and it
    // never goes under him. Only a man up at the rim (a dunk, a layup at the rim, a block or a board at its height),
    // in front of the board, is drawn over it while he's up there. The ball: in a man's hands with him; a dribble
    // under him (his hand on top of it); loose or in the air by where it is, over the men once it's over their
    // heads, over the hoop once it's over the rim; going through the net between the backboard and net behind and
    // the rim in front
    const HOOPK = RIM.y + 0.8
    const nearRim = Math.hypot(DB[0] - RIM.x, DB[1] - RIM.y) < C_RIMR + 0.5
    let ballK
    if (carry >= 0) ballK = -1
    else if (nearRim && DB[2] > 3 && DB[2] < 10.3) ballK = 'net'
    else if (nearRim && b.st === 'dead' && DB[2] <= 3) ballK = HOOPK + 0.01
    else ballK = DB[1] + (DB[2] > 7 ? 30 : 0)
    // (a loose ball or a shot up over the rim's height near the hoop goes over it, with the men up there)
    const ballUp = typeof ballK === 'number' && carry < 0 && DB[2] > 10.3 && Math.hypot(DB[0] - RIM.x, DB[1] - TOPY) < 9
    let ballDone = ballCut
    const sway = rimSway(now)
    const hoop = () => {
      drawHoop(ctx, k, sway, 'back')
      if (ballK === 'net' && !ballDone) {
        drawBall(BX, BY, bsc, GX, GY, bz, false); ballDone = true
        // in the net: the front strings over it
        const rx = RIM.x * k + (sway?.[0] || 0), ry = (RIM.y - HUP) * k + (sway?.[1] || 0), r0 = k * C_RIMR * RIM_DRAW * 0.95, nh = k * 0.95
        ctx.strokeStyle = 'rgba(245,245,240,.85)'; ctx.lineWidth = Math.max(1, k * 0.07)
        ctx.beginPath()
        for (let j = -3; j <= 3; j++) { const t = j / 3; ctx.moveTo(rx + t * r0, ry + r0 * 0.5); ctx.lineTo(rx + t * r0 * 0.55, ry + nh) }
        ctx.stroke()
      }
      drawHoop(ctx, k, sway, 'front')
      rimFx(now)
    }
    // up at the rim: off the floor about as high as a dunk or a layup takes him, in front of the board's face
    const upAt = i => FIG[i].air >= UP_AIR && DY[i] > TOPY && Math.abs(DX[i] - RIM.x) < 8 && DY[i] < RIM.y + 9
    DOTS.length = 0
    const man = i => {
      if (!ballDone && typeof ballK === 'number' && ballK >= 0 && ballK <= depth(i) && (upAt(i) || !ballUp)) { drawBall(BX, BY, bsc, GX, GY, bz, false); ballDone = true }
      if (cut(i)) return
      const f = FIG[i]
      // (his own ball: under him on the dribble and held low, over him once it's up at his head)
      const mine = !ballDone && i === carry, high = mine && ballZ >= 6
      if (mine && !high) { drawBall(BX, BY, bsc, GX, GY, bz, false); ballDone = true }
      DOTS.push([f.x - f.hs, f.cy - f.hs, f.x + f.hs, f.cy + f.hs, i])
      if (import.meta.env.DEV) LAY.dots[i] = [f.x, f.cy, f.hs]
      // the man sitting out (King of the Hill): at the side, a touch faded
      if (P[i].out) ctx.globalAlpha = 0.72
      drawFigure(ctx, f)
      ctx.globalAlpha = 1
      if (mine && high) { drawBall(BX, BY, bsc, GX, GY, bz, false); ballDone = true }
    }
    for (const i of order) if (!upAt(i)) man(i)
    // a ball still to draw that isn't up over the rim goes under the hoop too
    if (!ballDone && typeof ballK === 'number' && !ballUp) { drawBall(BX, BY, bsc, GX, GY, bz, false); ballDone = true }
    hoop()
    for (const i of order) if (upAt(i)) man(i)
    if (!ballDone) drawBall(BX, BY, bsc, GX, GY, bz, false)
    // the king's crown, and CLEAR IT over the man who has to take it out past the arc
    const marks = []
    const fsN = Math.max(13, Math.round(tk * 0.4))
    if (king >= 0 && !cut(king) && s.ck !== 2) {
      const cw = tk * 0.5, cy = FIG[king].cy - FIG[king].hs - 2
      drawCrown(X(king), cy, cw)
      marks.push([X(king) - cw / 2 - 2, cy - cw * 0.66 - 2, X(king) + cw / 2 + 2, cy + 2])
    }
    // a shooter's meter goes up beside him (either side): names and words keep off it
    if (live) for (let i = 0; i < N; i++) {
      if (P[i].act !== 'gather' || cut(i)) continue
      const mh = i === me ? Math.max(66, tk * 2.6) : Math.max(34, tk * 1.5), mw = i === me ? Math.max(12, tk * 0.34) + 70 : Math.max(6, tk * 0.2) + 4
      const x = X(i), y = Y(i), y0 = y - mh * 0.62 - 3, y1 = y + mh * 0.38 + 3, hw = FIG[i].hs
      marks.push([x + hw + 6, y0, x + hw + 10 + mw, y1], [x - hw - 10 - mw, y0, x - hw - 6, y1])
    }
    // the names: under each man, or over him, or beside him: wherever they don't sit on another man or name
    BARS.length = 0; BAR_OF.length = 0
    const names = [me, ...order.filter(i => i !== me)]
    ctx.font = `${fsN}px ${FONT}`
    const bh = Math.round(fsN * 1.24)
    const clearTag = clearer >= 0 && !cut(clearer)
    for (const i of names) {
      if (cut(i)) continue
      const cx = FIG[i].x, cy = FIG[i].cy, hs = FIG[i].hs
      const im = imgs[i], face = im && im.complete && im.naturalWidth ? i : -1
      // (the man sitting out: UP NEXT with his name)
      const nm = setup.looks[i].label.toUpperCase() + (P[i].out && s.phase !== 'over' ? ' · UP NEXT' : ''), bw = ctx.measureText(nm).width + 10 + (face >= 0 ? bh : 0)
      const crown = i === king ? tk * 0.36 : 0
      const C = [
        [cx - bw / 2, cy + hs + 1],                                   // under him
        [cx - bw / 2, cy - hs - 1 - bh - crown],                      // over him
        [cx + hs + 3, cy - bh / 2],                                   // to his right
        [cx - hs - 3 - bw, cy - bh / 2],                              // to his left
        [cx - hs, cy + hs + 1], [cx + hs - bw, cy + hs + 1],          // under him, leaning right or left
        [cx - hs, cy - hs - 1 - bh - crown], [cx + hs - bw, cy - hs - 1 - bh - crown],
      ]
      let pick = 0, bc = Infinity
      for (let c = 0; c < C.length; c++) {
        const x0 = clamp(C[c][0], L + 2, Rr - 2 - bw), y0 = clamp(C[c][1], 1, h - bh - 1)
        const rc = [x0, y0, x0 + bw, y0 + bh]
        let cost = (c === 0 ? 0 : c === 1 ? 30 : c < 4 ? 90 : 60) - (CHOICE[i] === c ? 70 : 0)
        for (const d of DOTS) if (d[4] !== i) cost += ovl(rc, d) * 2
        for (const o of BARS) cost += ovl(rc, [o[0] - 2, o[1] - 2, o[2] + 2, o[3] + 2]) * 3
        for (const o of marks) cost += ovl(rc, o) * 2
        if (!ballCut) cost += ovl(rc, [bx - 9, by - 9, bx + 9, by + 9]) * 2
        if (clearTag && i === clearer && (c === 1 || c > 5)) cost += 1e5    // TAKE IT BACK goes over him
        cost += (Math.abs(x0 - C[c][0]) + Math.abs(y0 - C[c][1])) * 4
        if (cost < bc) { bc = cost; pick = c }
      }
      CHOICE[i] = pick
      const x0 = clamp(C[pick][0], L + 2, Rr - 2 - bw), y0 = clamp(C[pick][1], 1, h - bh - 1)
      const rc = [x0, y0, x0 + bw, y0 + bh]
      BARS.push(rc); BAR_OF[i] = rc
      drawTag(rc, nm, fsN, colOf(i), i === me, i === me, face)
      if (import.meta.env.DEV) LAY.bars[i] = rc
    }
    if (clearTag) {
      const cx = FIG[clearer].x, cy = FIG[clearer].cy - FIG[clearer].hs - 2
      const fs = Math.max(13, Math.round(tk * 0.38)); ctx.font = `${fs}px ${FONT}`
      const tw = ctx.measureText('TAKE IT BACK').width + 10, th = Math.round(fs * 1.24)
      const x0 = clamp(cx - tw / 2, L + 2, Rr - 2 - tw), y0 = Math.max(1, cy - th)
      const rc = [x0, y0, x0 + tw, y0 + th]
      drawTag(rc, 'TAKE IT BACK', fs, AMBER, true, false)
      marks.push(rc)
    }
    // the men cut by the edge of the screen
    // (at his height, or the nearest height that isn't on a man near the edge, another name or another tab)
    const tfs = Math.max(13, Math.round(tk * 0.36))
    for (const i of order) {
      const off = cut(i)
      if (!off) continue
      ctx.font = `${tfs}px ${FONT}`
      const tw = 30 + ctx.measureText(setup.looks[i].label.toUpperCase().slice(0, 9) + (P[i].out ? ' · NEXT' : '')).width + (i === holder ? 20 : 0)
      const ex = off < 0 ? L : Rr, y0 = clamp(Y(i), 14, h - 14)
      let best = y0, bc = Infinity
      for (const st of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
        const y = clamp(y0 + st * 30, 14, h - 14), rc = off < 0 ? [ex, y - 14, ex + tw, y + 14] : [ex - tw, y - 14, ex, y + 14]
        let c = Math.abs(st) * 40 + (TABY[i] === st ? -30 : 0)
        for (const d of DOTS) c += ovl(rc, d) * 2
        for (const o of BARS) c += ovl(rc, o) * 2
        if (c < bc) { bc = c; best = y; TABY[i] = st }
      }
      drawTab(i, off, best, tk, i === holder)
      BARS.push(off < 0 ? [ex, best - 14, ex + tw, best + 14] : [ex - tw, best - 14, ex, best + 14])
    }
    // meters: everyone rising for a shot; his own also for a moment after he lets go (where he stopped it)
    for (let i = 0; i < N; i++) {
      if (i === me && !levels[me] && meter.rel) continue
      if (P[i].act === 'gather' && P[i].shot && s.phase === 'live' && (i !== me || levels[me] || meter.on)) drawMeter(i, X(i), Y(i), tk, now)
    }
    if (meter.rel && !levels[me]) {
      const t = now - meter.rel.at
      if (t < METER_HOLD + METER_FADE) drawMeter(me, X(me), Y(me), tk, now, t < METER_HOLD ? 1 : 1 - (t - METER_HOLD) / METER_FADE)
      else meter.rel = null
    }
    // a shot that never went up (the clock ran out on the gather, the ball was taken)
    if (meter.grade === 'NO SHOT' && now - meter.gradeAt < 900) {
      const fs = Math.round(clamp(tk * 0.42, 13, 20)), t = (now - meter.gradeAt) / 900
      ctx.font = `${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1
      // beside him, where his meter was (not on the man guarding him)
      const tw = ctx.measureText('NO SHOT').width, sd = meter.side || 1
      const gx = clamp(X(me) + sd * (tk * 0.5 + 14 + tw / 2), L + tw / 2 + 10, Rr - tw / 2 - 10), gy = clamp(Y(me), fs, h - fs)
      ctx.fillStyle = 'rgba(5,7,10,.9)'; ctx.fillRect(gx - tw / 2 - 6, gy - fs * 0.65, tw + 12, fs * 1.3)
      ctx.fillStyle = GRADE_COL['NO SHOT']; ctx.fillText('NO SHOT', gx, gy + 0.5)
      ctx.globalAlpha = 1
    }
    // the words, where no man is (placed when they first show, then they stay put)
    let obs = null
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]
      if (now - f.t0 > f.dur) { fx.splice(i, 1); continue }
      if (!f.text) continue
      const t = (now - f.t0) / f.dur
      const fs = f.small ? Math.round(clamp(k * 1.3, 14, 20)) : Math.round(clamp(k * (f.big ? 3.4 : 2.3), f.big ? 24 : 14, f.big ? 52 : 34))
      ctx.font = `${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const tw = ctx.measureText(f.text).width
      if (f.px == null) {
        if (!obs) {
          obs = [...DOTS, ...BARS, ...marks]
          // between plays the men are on their way to their spots: keep off those too
          if (!live) for (const p of P) obs.push([p.sx * k - tk / 2 - 5, p.sy * k - tk / 2 - 5, p.sx * k + tk / 2 + 5, p.sy * k + tk / 2 + 5 + bh])
          if (!ballCut) obs.push([bx - 10, by - 10, bx + 10, by + 10])
          for (const o of fx) if (o.px != null && o.text) obs.push(o.rc)
        }
        placeWord(f, fs, tw, obs)
        f.rc = [f.px - tw / 2, f.py - fs / 2, f.px + tw / 2, f.py + fs / 2]
        obs.push(f.rc)
      }
      const x = clamp(f.px, L + tw / 2 + 8, Rr - tw / 2 - 8), y = f.py - (reduced() ? 0 : t * 6)
      ctx.globalAlpha = t < 0.08 ? t / 0.08 : t > 0.75 ? (1 - t) / 0.25 : 1
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, fs * 0.16); ctx.strokeStyle = 'rgba(5,7,10,.92)'; ctx.strokeText(f.text, x, y)
      if (import.meta.env.DEV) LAY.words.push([x - tw / 2, y - fs / 2, x + tw / 2, y + fs / 2, f.text])
      ctx.fillStyle = f.color; ctx.fillText(f.text, x, y)
      ctx.globalAlpha = 1
    }
  }

  // DEV: how long each frame's work takes and how far apart frames come (a ring, no garbage)
  const PERF = new Float32Array(240), GAP = new Float32Array(240); let pn = 0
  function frame(t) {
    if (dead) return
    raf = requestAnimationFrame(frame)
    const w0 = performance.now(); GAP[pn % 240] = t - last
    const dt = Math.min(120, t - last); last = t
    if (!paused) {
      clockNow += dt; acc += dt
      let n = 0
      while (acc >= STEP && n++ < 5) { if (online) onlineTick(); else tick(); acc -= STEP }
      if (acc >= STEP) acc = 0
      camera(dt)
    }
    draw(clockNow)
    PERF[pn++ % 240] = performance.now() - w0
  }

  // ── the stick (it appears where the thumb lands) and the buttons ────────────────────────────────
  const stick = { id: null, ox: 0, oy: 0, rect: null }
  const R = 46
  const setKnob = (ox, oy, dx, dy, on) => {
    els.base.style.transform = `translate(${ox}px, ${oy}px)`; els.knob.style.transform = `translate(${ox + dx}px, ${oy + dy}px)`
    els.base.classList.toggle('is-on', on); els.knob.classList.toggle('is-on', on)
  }
  const padDown = e => {
    if (stick.id != null || e.target.closest?.('.btlv-btn, .btlv-ds')) return
    const r = els.pad.getBoundingClientRect()                       // read once a touch, not on every move
    if (e.clientX - r.left > r.width * 0.56) return
    e.preventDefault()
    stick.id = e.pointerId; stick.rect = r; stick.ox = e.clientX - r.left; stick.oy = e.clientY - r.top
    els.pad.setPointerCapture?.(e.pointerId)
    G.reset()
    if (ONE) feedG(performance.now(), 0, 0)                          // (where the thumb landed: the stick's middle)
    setKnob(stick.ox, stick.oy, 0, 0, true)
  }
  const padMove = e => {
    if (e.pointerId !== stick.id) return
    // (the thumb's in-between places this frame too: a quick pump or snap can fall between two frames)
    if (ONE) {
      const co = e.getCoalescedEvents?.()
      if (co && co.length > 1) for (let i = 0; i < co.length - 1; i++) {
        let cx = co[i].clientX - stick.rect.left - stick.ox, cy = co[i].clientY - stick.rect.top - stick.oy
        const cd = Math.hypot(cx, cy); if (cd > R) { cx *= R / cd; cy *= R / cd }
        feedG(co[i].timeStamp, cx / R, cy / R)
      }
    }
    let dx = e.clientX - stick.rect.left - stick.ox, dy = e.clientY - stick.rect.top - stick.oy
    const d = Math.hypot(dx, dy)
    if (d > R) { dx *= R / d; dy *= R / d }
    H.mx = dx / R; H.my = dy / R
    setKnob(stick.ox, stick.oy, dx, dy, true)
    gesture()
  }
  // the dribble moves on the move stick: what the thumb has done, read as it goes (on every move of it and every tick)
  const GLOG = []                                   // DEV: the move stick as the gesture reader saw it
  const hasBall = () => s.phase === 'live' && s.ball.st === 'held' && s.ball.holder === me
  let gT = 0
  function gesture() { if (ONE && stick.id != null) feedG(performance.now(), H.mx, H.my) }
  function feedG(t, x, y) {
    gT = Math.max(gT, t)
    const g = G.feed(gT, x, y)
    if (import.meta.env.DEV) { GLOG.push([Math.round(gT), +x.toFixed(2), +y.toFixed(2), g ? g.kind + (hasBall() ? '' : ' (no ball)') : '']); if (GLOG.length > 600) GLOG.shift() }
    if (!g || !hasBall()) return
    flick(g.dir[0], g.dir[1])
  }
  // where the stick rests: the layout's marker for it (btlive.css .btlv-stick-home), else a quarter across
  const rest = () => {
    const r = els.pad.getBoundingClientRect(), m = els.home?.getBoundingClientRect()
    if (m && m.width + m.height > 0) setKnob(m.left + m.width / 2 - r.left, m.top + m.height / 2 - r.top, 0, 0, false)
    else setKnob(r.width * 0.25, r.height - 150, 0, 0, false)
  }
  const padUp = e => {
    if (e.pointerId !== stick.id) return
    stick.id = null; H.mx = H.my = 0; G.reset()
    rest()                                                           // back to its resting place
  }
  // the moment of a press, on the game's clock but to the millisecond (not to the frame): the meter is timed with it
  const stamp = () => clockNow + (paused ? 0 : clamp(performance.now() - last, 0, 60))
  const press = (key, down) => {
    if (down) {
      if (H[key]) return
      H[key] = true; H['t' + key] = true; H['n' + key] = false
      if (key === 'a') H.aT0 = stamp()
      if (online) { NB.n['abc'.indexOf(key)]++; NB.edge = true; if (key === 'a') NB.aOff = s.players[me].team === s.poss }
    } else {
      if (!H[key]) return
      H[key] = false; H['n' + key] = false
      if (key === 'a') { H.aUp = stamp(); letGo(H.aUp) }
    }
    els.btn[key].classList.toggle('is-down', down)
  }
  const btnHandlers = []
  for (const key of ['a', 'b']) {
    const el = els.btn[key]
    const d = e => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); press(key, true) }
    const u = e => { e.preventDefault(); press(key, false) }
    el.addEventListener('pointerdown', d); el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u)
    btnHandlers.push([el, d, u])
  }
  // ── the right stick (the arrow keys are the same stick) ─────────────────────────────────────────
  // With the ball a flick is a dribble move: the stick pushed past half way from where the thumb landed; still out and
  // rolled a quarter turn or so round from there is another one (early in a move, the game makes it a spin). Which
  // move a flick is, the game says (where it points, the basket being forward, and the hand the ball is in): the
  // screen only sends the way it pointed. Without the ball: down is a swipe at it (on defense), up a jump.
  const DS = { id: null, ox: 0, oy: 0, r: 26, sc: 1, on: false, fx: 0, fy: 0, kt: 0 }
  const SPIN_COS = Math.cos(T.spinTurn * Math.PI / 180)
  const flick = (x, y) => {
    H.dq.push([x, y]); if (H.dq.length > MOVE_KEEP) H.dq.shift()
    if (online) { NB.n[2]++; NB.d.push([r2(x), r2(y)]); if (NB.d.length > MOVE_KEEP) NB.d.shift(); NB.edge = true }
  }
  const tap = steal => {
    if (steal) H.ts = true; else H.tj = true
    if (online) { NB.n[steal ? 3 : 4]++; NB.edge = true }
  }
  function rightFlick(ux, uy) {
    const p = s.players[me], b = s.ball
    if (b.st === 'held' && b.holder === me) { flick(ux, uy); return }
    if (s.phase !== 'live' || p.out) return
    // without the ball the pad (E on a keyboard) is STEAL on defense; there's no jump on it (BLOCK is the jump)
    if (p.team !== s.poss && b.st === 'held') tap(true)
  }
  function dribbleAt(x, y) {
    const m = Math.hypot(x, y)
    if (m < 0.28) { DS.on = false; return }
    if (m < T.moveAt + 0.08) return
    const ux = x / m, uy = y / m
    if (DS.on && ux * DS.fx + uy * DS.fy > SPIN_COS) return
    DS.on = true; DS.fx = ux; DS.fy = uy
    rightFlick(ux, uy)
  }
  const dsMove = e => {
    if (e.pointerId !== DS.id) return
    let dx = e.clientX - DS.ox, dy = e.clientY - DS.oy
    const d = Math.hypot(dx, dy)
    if (d > DS.r) { dx *= DS.r / d; dy *= DS.r / d }
    els.dk.style.transform = `translate(${(dx / DS.sc).toFixed(1)}px, ${(dy / DS.sc).toFixed(1)}px)`
    dribbleAt(dx / DS.r, dy / DS.r)
  }
  const dsDown = e => {
    if (DS.id != null) return
    e.preventDefault(); e.stopPropagation()
    const r = els.ds.getBoundingClientRect()                        // (it's scaled with the buttons on a phone on its side)
    DS.id = e.pointerId; DS.ox = e.clientX; DS.oy = e.clientY; DS.sc = r.width / (els.ds.offsetWidth || r.width); DS.r = r.width * 0.3
    els.ds.setPointerCapture?.(e.pointerId); els.ds.classList.add('is-on')
    // without the ball the pad is one button: STEAL on defense (a touch anywhere on it)
    const b = s.ball
    if (s.phase === 'live' && !(b.st === 'held' && b.holder === me)) {
      DS.on = true; DS.fx = 0; DS.fy = 1
      rightFlick(0, 1)
      if (els.ds.dataset.k === 'steal') { els.ds.classList.add('is-hit'); clearTimeout(DS.ht); DS.ht = setTimeout(() => els.ds.classList.remove('is-hit'), 140) }
    }
  }
  const dsUp = e => {
    if (e.pointerId !== DS.id) return
    DS.id = null; els.dk.style.transform = ''; els.ds.classList.remove('is-on'); dribbleAt(0, 0)
  }
  // the keyboard: WASD moves, SPACE shoots, E passes (calls for it off the ball) and is STEAL on defense. The dribble
  // moves: a WASD key tapped twice (with the other keys held: the way he goes) and SHIFT the spin; or, on a second
  // stick (setup.stick 'two'), the arrows as the right stick
  const KEY = { ' ': 'a', e: 'b' }
  const ARROW = { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] }
  const arrows = new Set(), tapped = new Set()
  const KW = { x: 0, y: 0, t: -1e9 }                  // the last way the keys had him going, and when
  const readKeys = () => {
    let x = 0, y = 0
    for (const kk of keys) { const d = DIR[kk]; if (d) { x += d[0]; y += d[1] } }
    const m = Math.hypot(x, y)
    if (m) { KW.x = x / m; KW.y = y / m; KW.t = performance.now() } else if (H.mx || H.my) KW.t = performance.now()
    if (stick.id == null) { H.mx = m ? x / m : 0; H.my = m ? y / m : 0 }
  }
  const arrowVec = set => { let x = 0, y = 0; for (const kk of set) { x += ARROW[kk][0]; y += ARROW[kk][1] } const m = Math.hypot(x, y); dribbleAt(m ? x / m : 0, m ? y / m : 0) }
  // SHIFT: a spin, round to the way WASD points (or at the basket), rolled out of a flick toward the ball hand
  function keySpin() {
    const p = s.players[me]
    let ex = H.mx, ey = H.my, m = Math.hypot(ex, ey)
    if (m < 0.3) { ex = COURT.rim.x - p.x; ey = COURT.rim.y - p.y; m = Math.hypot(ex, ey) || 1 }
    ex /= m; ey /= m
    const d = ref.rimDist(p), fx = d > 0.5 ? (COURT.rim.x - p.x) / d : 0, fy = d > 0.5 ? (COURT.rim.y - p.y) / d : -1
    const hs = p.hand || 1, side = v => (v[0] * -fy + v[1] * fx) * hs
    const a = [-ey, ex], b = [ey, -ex], via = side(a) >= side(b) ? a : b
    flick(via[0], via[1]); flick(ex, ey)
  }
  // E on defense: STEAL (the STEAL row beside the court lights as it goes)
  const onDef = () => shown.mode === 'def' || shown.mode === 'dboard'
  function stealKey() {
    rightFlick(0, 1)
    const row = els.keys?.stealRow
    if (row) { row.classList.add('is-hit'); clearTimeout(DS.kh); DS.kh = setTimeout(() => row.classList.remove('is-hit'), 140) }
  }
  const keyDown = e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const kk = e.key.toLowerCase()
    if (DIR[kk]) {
      e.preventDefault()
      if (e.repeat) return
      const before = [H.mx, H.my]
      keys.add(kk); readKeys()
      // a hard change of direction with it: the move the new way, now (a quick tap is one too, as it comes up: keyUp)
      if (ONE && TP.down(kk, performance.now(), before, [H.mx, H.my]) && hasBall()) flick(H.mx, H.my)
    } else if (kk === 'shift') { if (ONE && !e.repeat && hasBall()) keySpin() }
    else if (kk === 'e') { e.preventDefault(); if (e.repeat) return; if (onDef()) stealKey(); else press('b', true) }
    else if (ARROW[kk]) {
      e.preventDefault()
      // (the arrows are the dribble stick only on a second stick, and only with the ball)
      if (e.repeat || ONE || !hasBall()) return
      arrows.add(kk); tapped.add(kk)
      // two arrows pressed together are one diagonal flick: the first waits a moment for the second. With a flick
      // already out, the next arrow is the roll round to it at once
      if (DS.on) arrowVec(arrows)
      else if (!DS.kt) DS.kt = setTimeout(() => { DS.kt = 0; arrowVec(tapped); tapped.clear(); if (!arrows.size) dribbleAt(0, 0) }, 35)
    } else if (KEY[kk]) { e.preventDefault(); if (!e.repeat) press(KEY[kk], true) }
  }
  const keyUp = e => {
    const kk = e.key.toLowerCase()
    if (DIR[kk]) {
      // (the way he was going: D and A both down cancel out, so it's the way before that)
      const v = heldWay(kk), before = H.mx || H.my ? [H.mx, H.my] : performance.now() - KW.t < 400 ? [KW.x, KW.y] : [0, 0]
      keys.delete(kk); readKeys()
      const up = ONE ? TP.up(kk, performance.now(), before, [H.mx, H.my]) : null
      if (up && hasBall()) { if (up === 'turn') flick(H.mx, H.my); else flick(v.x, v.y) }
    }
    else if (ARROW[kk]) { if (!arrows.delete(kk)) return; if (!DS.kt) { tapped.clear(); arrowVec(arrows) } }
    else if (KEY[kk]) press(KEY[kk], false)
  }
  const blur = () => { keys.clear(); readKeys(); arrows.clear(); tapped.clear(); TP.reset(); dribbleAt(0, 0); for (const key of ['a', 'b']) press(key, false) }
  const vis = () => { paused = !online && (document.hidden || pausedBy); last = performance.now() }
  let pausedBy = false

  els.pad.addEventListener('pointerdown', padDown); els.pad.addEventListener('pointermove', padMove)
  els.pad.addEventListener('pointerup', padUp); els.pad.addEventListener('pointercancel', padUp)
  if (els.ds) { els.ds.addEventListener('pointerdown', dsDown); els.ds.addEventListener('pointermove', dsMove); els.ds.addEventListener('pointerup', dsUp); els.ds.addEventListener('pointercancel', dsUp) }
  window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('blur', blur)
  document.addEventListener('visibilitychange', vis)
  const ro = new ResizeObserver(() => { resize(); camera(1e6); if (stick.id == null) rest() }); ro.observe(els.court)
  resize(); camera(1e6)
  rest()
  // the floor: the court picture with its own lines painted out and a real half court painted on (court.js)
  const floorImg = els.world?.querySelector('img')
  if (floorImg) {
    const paint = () => { if (dead) return; try { const cv = paintCourt(floorImg); cv.className = 'btlv-floor'; els.world.appendChild(cv); floorImg.style.display = 'none' } catch (e) { console.warn('court', e) } }
    if (floorImg.complete && floorImg.naturalWidth) paint(); else floorImg.addEventListener('load', paint, { once: true })
  }
  if (els.root) els.root.dataset.stick = ONE ? 'one' : 'two'
  document.fonts?.load?.(`16px ${FONT}`).catch(() => {})
  for (let i = 0; i < N; i++) { prev[i * 2] = s.players[i].x; prev[i * 2 + 1] = s.players[i].y }
  hud()
  for (const e of s.events) if (e.e === 'check') say('CHECK BALL', COURT.rim.x, 37.6, 'rgba(255,255,255,.75)', false, 900)
  last = performance.now()
  raf = requestAnimationFrame(frame)

  const api = {
    get state() { return s },
    me, online,
    // online: a message from the referee (BtLive routes them here)
    onNet(m) { if (m.t === 's') onSnap(m) },
    // online: the line came back; take the referee's word for this player's spot (the CPU had him while he was gone)
    resync() { NB.wasLive = false; NB.local = null; NB.mv.hand = null },
    // DEV: where each player was drawn on the last frame (feet)
    get evlog() { return EVLOG },
    // DEV: the last frame's drawing (px in the world: dots [x, y, half], name bars, ball [x, y, r], words)
    get layout() { return LAY },
    get drawn() { return Array.from(DX, (x, i) => [x, DY[i]]) },
    get netInfo() { return { k: NB.lastK, buf: NB.buf.length, off: NB.off, rel: NB.rel, local: NB.local?.act ?? null, lt: NB.lt, n: NB.n } },
    pause(on = true) { pausedBy = on; paused = on || document.hidden; last = performance.now() },
    // DEV: the CPU plays the person's player (a level name), or hands him back (null)
    auto(level) { levels[me] = level || null },
    // DEV: run n ticks right now (no waiting), or until fn(state) is true
    run(n = 1, until = null) { let i = 0; for (; i < n; i++) { clockNow += STEP; tick(); if (until && until(s)) break } acc = 0; camera(1e6); draw(clockNow); return i },
    press, stick(x, y) { H.mx = x; H.my = y },
    // DEV: the small stick: a flick that way (a dribble move), or where it points now (dstick: 0, 0 lets it go)
    flick, dstick: dribbleAt, tap, right: rightFlick, get stickMode() { return ONE ? 'one' : 'two' }, get glog() { return GLOG },
    // DEV: each man's pose on the last frame (figure.js), and his animation's notes (pose.js)
    get figs() { return FIG }, get anim() { return poser.anim },
    // DEV: the game's clock (ms) as the poses read it, and the people watching
    get clock() { return clockNow }, get fans() { return FANS },
    // DEV: where a man is on the page (px)
    screenOf(i) { const r = els.court.getBoundingClientRect(); return [r.left + FIG[i].x - camPx, r.top + FIG[i].y] },
    // DEV: let time pass with the game stopped (the meter runs on this device's clock)
    wait(ms) { clockNow += ms; draw(clockNow) },
    draw() { camera(1e6); draw(clockNow) },
    // DEV: frame work (ms) and the gap between frames over the last 240 frames
    perf() { const n = Math.min(pn, 240), a = [...PERF.slice(0, n)].sort((x, y) => x - y), g = [...GAP.slice(0, n)].sort((x, y) => x - y); const q = (v, f) => +v[Math.min(v.length - 1, Math.floor(v.length * f))].toFixed(2); return { frames: n, workAvg: +(a.reduce((x, y) => x + y, 0) / n).toFixed(2), work95: q(a, 0.95), workMax: q(a, 1), gap50: q(g, 0.5), gap95: q(g, 0.95) } },
    destroy() {
      dead = true; cancelAnimationFrame(raf); ro.disconnect()
      els.pad.removeEventListener('pointerdown', padDown); els.pad.removeEventListener('pointermove', padMove)
      els.pad.removeEventListener('pointerup', padUp); els.pad.removeEventListener('pointercancel', padUp)
      if (els.ds) { els.ds.removeEventListener('pointerdown', dsDown); els.ds.removeEventListener('pointermove', dsMove); els.ds.removeEventListener('pointerup', dsUp); els.ds.removeEventListener('pointercancel', dsUp) }
      clearTimeout(DS.kt); clearTimeout(DS.ht); clearTimeout(DS.kh)
      window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', vis)
      for (const [el, d, u] of btnHandlers) { el.removeEventListener('pointerdown', d); el.removeEventListener('pointerup', u); el.removeEventListener('pointercancel', u) }
    },
  }
  return api
}
