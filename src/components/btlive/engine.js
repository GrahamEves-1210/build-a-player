// BLACKTOP LIVE, the screen's engine: runs the simulation (lib/btlive) at its ticks (tune.js HZ: 36 a second), draws it at the
// display's rate with the positions eased between ticks, reads the stick and the buttons, times the shot meter on
// this device, and turns what happened into sound, haptics and the rare animations. No React in here and no
// React state per frame: it draws on a canvas and writes the few bits of the HUD that change straight to the DOM.
import { createGame, step, cpuInput, passTarget, meterQuality, meterGrade, meterSpec, moveLocal, moveInput, moveQueued, shotKindAt, referee as ref, HZ, COURT, T, MOVES, MOVE_KEYS, gticks } from '../../lib/btlive/index.js'
import { applySnap, lerpAt, relMsg, SEND_EVERY, SNAP_ACT, MOVE_KEEP } from '../../lib/btlive/proto.js'
import { drawFigure, drawShadow, pointAt, lookOf } from './figure.js'
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
  const levels = setup.levels.slice()
  const N = s.players.length
  const prev = new Float32Array(N * 2), prevBall = [0, 0, 0]
  const inputs = []
  const fx = []                                   // { text, x, y, t0, dur, color, big } and { rim, t0, dur }
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
  const MOVE_WORD = { cross: 'CROSSOVER', hesi: 'HESITATION', back: 'STEP-BACK', btb: 'BEHIND THE BACK', spin: 'SPIN MOVE' }

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
      } else if (e.e === 'miss') { sfx('rimmiss'); fx.push({ rim: 'miss', t0: clockNow, dur: 260 }) }
      else if (e.e === 'block') { sfx('btblock'); haptic('heavy'); say(e.chase ? 'CHASE-DOWN' : 'BLOCKED', p.x, wordY(p.y), colOf(e.pid), true); kick(1) }
      else if (e.e === 'steal') { sfx('btsteal'); haptic('medium'); say('STEAL', p.x, wordY(p.y), colOf(e.pid)) }
      else if (e.e === 'pick') { sfx('btsteal'); haptic('medium'); say('PICKED OFF', p.x, wordY(p.y), colOf(e.pid)) }
      else if (e.e === 'catch') sfx('catchball')
      else if (e.e === 'board') { sfx('catchball'); if (e.pid === me) haptic('light') }
      else if (e.e === 'move') {
        if (e.ankles) { haptic('heavy'); say('ANKLES', P[e.def].x, wordY(P[e.def].y), FLOOD, true, 1400) } else if (e.pid === me) haptic('light')
        // his own move, named as he makes it (how the small stick is learned)
        if (e.pid === me && !levels[me] && !e.ankles && MOVE_WORD[e.kind]) { for (const f of fx) if (f.mv) f.dur = 0; fx.push({ text: MOVE_WORD[e.kind], x: p.x, y: p.y < 9 ? p.y + 4.6 : p.y - 4.6, t0: clockNow, dur: 750, color: 'rgba(255,255,255,.92)', big: false, small: true, mv: true }) }
      }
      else if (e.e === 'swipe') { if (e.pid === me) { haptic('light'); if (e.reach) say('REACH', p.x, wordY(p.y), 'rgba(255,255,255,.8)') } }
      else if (e.e === 'oob') { sfx('whistle'); say('OUT OF BOUNDS', COURT.rim.x, 22, '#fff') }
      else if (e.e === 'clock') { sfx('whistle'); say('SHOT CLOCK', COURT.rim.x, 22, '#fff') }
      else if (e.e === 'check') { say('CHECK BALL', COURT.rim.x, 37.6, 'rgba(255,255,255,.75)', false, 900); H.na = H.a; H.nb = H.b; H.dq.length = 0; NB.aUsed = NB.n[0] }
      else if (e.e === 'release') { if (e.pid !== me || levels[me]) sfx('btrelease', 0.6) }        // his own sounds as he lets go (letGo)
      // a teammate calling for the ball: his man shows it on every screen (draw), and the man with it hears it
      else if (e.e === 'call') { if (p.team === P[me].team && e.pid !== me) { sfx('tap'); if (s.ball.holder === me) haptic('medium') } }
      // King of the Hill: a stop, and he has to take it past the arc (CLEAR IT shows over his man until he has: draw)
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
      meter.base = meterSpec(p.shot.spec.kind ?? p.shot.kind, p.R, false)   // the window without game point (the clutch rating moves it)
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
    prev[me * 2] = p.x; prev[me * 2 + 1] = p.y
    H.ta = H.tb = H.ts = H.tj = false
    const live = s.phase === 'live'
    mvLoad(p)
    const has = live && b.st === 'held' && b.holder === me
    // a shot and a move start here, now; the referee's word follows. A shot goes from a SHOOT press made with his side
    // on the ball in the last half second that hasn't started one yet, held or not (the step's rule: T.shootBuffer)
    const aBuf = NB.aOff && NB.aUsed !== NB.n[0] && clockNow - H.aT0 <= T.shootBuffer * 1000
    if (has && aBuf && p.act === 'free' && p.noAct <= 0 && !NB.local && s.mustClear !== me) {
      NB.aUsed = NB.n[0]
      const kind = shotKindAt(s, me), d = ref.rimDist(p)
      const c0 = ref.contestOf(p, s.players.filter(o => o.team !== p.team), kind).c
      p.act = 'gather'; p.actT = 0
      p.shot = { kind, spec: meterSpec(kind, p.R, s.gamePoint), d, three: kind === 'jumper' && ref.isThree(p.x, p.y), read: c0 < 0.2 ? 0 : c0 < 0.5 ? 1 : 2 }
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
  const MVF = ['burst', 'mv', 'bn', 'hand', 'moveCd', 'mqT', 'mqx', 'mqy', 'fkx', 'fky', 'bdx', 'bdy', 'bs']
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
  const clearer = () => {                                       // King of the Hill: the man who must take it back past the arc
    const c = s.mustClear
    if (c == null || c === false || c === -1) return -1
    if (typeof c === 'number') return c
    if (typeof c === 'object') return c.pid ?? c.i ?? -1
    return s.ball.st === 'held' ? s.ball.holder : -1
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
    const cl = K ? clearer() : -1
    shown.sc.forEach((c, i) => {
      const v = sideScore(i)
      if (v !== c.v) { c.v = v; c.sc.textContent = String(v) }
      const lit = i === on, king = K && s.king === i
      if (lit !== c.on || king !== c.king) { c.on = lit; c.king = king; c.el.classList.toggle('is-on', lit); c.el.classList.toggle('is-king', king) }
      // King of the Hill: the king marked, and the man who has to take it back past the arc first
      const t = !K ? '' : i === cl ? 'CLEAR IT' : king ? 'KING' : ''
      if (t !== c.t) { c.t = t; c.tag.textContent = t; c.tag.classList.toggle('is-clear', t === 'CLEAR IT') }
    })
    let note = ''
    if (s.phase !== 'over') {
      if (K) {
        note = cl >= 0 ? `${nameOf(cl)} MUST CLEAR IT` : s.king != null && s.king >= 0 ? `${nameOf(s.king)} IS KING` : on >= 0 ? `${nameOf(on)}'S BALL` : ''
      } else if (team != null && team >= 0) note = `${nameOf(team)}'S BALL`
    }
    const nc = K ? (cl >= 0 ? cl : s.king ?? on) : team
    if (note !== shown.note || nc !== shown.nc) {
      shown.note = note; shown.nc = nc
      if (els.note) { els.note.textContent = note.toUpperCase(); els.note.style.color = nc != null && nc >= 0 ? setup.colors?.[nc] ?? SIDE_COL[nc] ?? '' : '' }
    }
    const has = b.st === 'held' && b.holder === me, up = b.st === 'shot' || b.st === 'loose'
    // (between plays nothing is live: the buttons rest)
    const mode = s.phase === 'dead' || s.phase === 'over' ? 'none' : has ? (s.mustClear === me ? 'clear' : 'ball') : p.team === s.poss ? (up ? 'board' : 'off') : (up ? 'dboard' : 'def')
    if (mode !== shown.mode) {
      shown.mode = mode
      const team = s.size > 1 && !koth()
      // SHOOT is always there (dimmed when it does nothing: on defense, a shot in the air); PASS in a team game
      els.btn.a.classList.toggle('is-dim', !(mode === 'ball' || mode === 'off' || mode === 'board' || mode === 'check'))
      els.lab.a.textContent = 'SHOOT'
      const bl = mode === 'ball' ? 'PASS' : mode === 'off' ? 'CALL' : ''
      els.lab.b.textContent = bl || 'PASS'
      els.btn.b.classList.toggle('is-off', !team)
      els.btn.b.classList.toggle('is-dim', !bl)
      // the right stick: dribble moves with the ball; without it, up a jump and (on defense) down a swipe at the ball
      if (els.rs) {
        els.rs.up.textContent = mode === 'ball' || mode === 'clear' ? '' : mode === 'none' ? '' : 'JUMP'
        els.rs.dn.textContent = mode === 'def' ? 'STEAL' : ''
        els.rs.mid.textContent = mode === 'ball' || mode === 'clear' ? 'MOVES' : ''
      }
      els.ds?.classList.toggle('is-ball', mode === 'ball' || mode === 'clear')
      if (els.root) els.root.dataset.mode = mode === 'ball' || mode === 'clear' ? 'ball' : mode === 'def' || mode === 'dboard' ? 'def' : mode === 'none' ? 'none' : 'off'
    }
    const cdS = mode === 'def' && p.stealCd > 0
    if (els.rs && els.rs.dn.classList.contains('is-cd') !== cdS) els.rs.dn.classList.toggle('is-cd', cdS)
  }

  // ── drawing ─────────────────────────────────────────────────────────────────────────────────────
  // The court picture is drawn from above with the rim at floor level, so height can't be drawn as a plain lift
  // up the screen (a ball 10 ft up at the rim would sit on the backboard). A ball's height shows as a little lift,
  // its size and its shadow; near the rim the lift is measured from the rim's height, so a shot meets the rim where
  // the rim is drawn, a make drops through the net and a miss leaves the rim and comes down on the floor.
  const RIM = COURT.rim
  const LIFT = 0.2                                                   // feet up the screen per foot of height
  const TOPY = 3.4                                                   // the backboard's front: a ball is never drawn above it
  const colOf = i => TEAM[s.players[i].team] ?? '#fff'           // (King of the Hill: each man is his own side)
  const idxOf = v => (v == null || v === false ? -1 : typeof v === 'number' ? (v >= 0 && v < N ? v : -1) : s.players.findIndex(p => p.id === v))
  // King of the Hill (state.king, state.mustClear, read with care until the mode is in): the king, and the man who has to clear it
  const kingOf = () => (koth() && idxOf(s.mustClear) < 0 ? idxOf(s.king) : -1)   // (not while he still has to clear it)
  function clearerOf() {
    const m = s.mustClear, b = s.ball
    let i = -1
    if (m === true) i = b.st === 'held' ? b.holder : -1
    else if (Array.isArray(m)) i = m.findIndex(Boolean)
    else if (m && typeof m === 'object') i = idxOf(m.pid ?? m.i ?? m.id)
    else if (m != null) i = idxOf(m)
    if (i < 0) i = s.players.findIndex(p => p.mustClear)
    return i >= 0 && s.phase === 'live' && b.st === 'held' && b.holder === i ? i : -1
  }
  const ovl = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))
  const rr = (x, y, ww, hh, r) => { ctx.beginPath(); ctx.roundRect(x, y, ww, hh, r) }
  // where a ball at (x, y, z) feet is drawn: [x px, y px, size]
  const BP = [0, 0, 1, 0]
  function ballAt(x, y, z) {
    const d = Math.hypot(x - RIM.x, y - RIM.y)
    if (s.ball.st === 'dead' && d < 0.05) {
      // a make: down through the net, and it stays under it
      const f = clamp(1 - z / 9, 0, 1)
      BP[0] = x * k; BP[1] = (y + f * 1.6) * k; BP[2] = 1 - f * 0.22; BP[3] = 1
      return BP
    }
    let wr = clamp(1 - (d - 0.6) / 5, 0, 1); wr = wr * wr * (3 - 2 * wr)
    const ze = z * (1 - wr) + Math.max(0, z - 10) * wr               // height over what's under it (the floor, or the rim)
    const lift = Math.min(LIFT * ze, Math.max(0, y - TOPY))
    BP[0] = x * k; BP[1] = (y - lift) * k; BP[2] = 1 + ze * 0.028; BP[3] = 0
    return BP
  }
  function drawBall(x, y, sc, gx, gy, z) {
    const r = Math.max(4.5, k * 0.7) * sc
    ctx.fillStyle = `rgba(0,0,0,${clamp(0.5 - z * 0.025, 0.14, 0.5)})`
    ctx.beginPath(); ctx.ellipse(gx, gy + r * 0.35, r * (0.9 + z * 0.02), r * 0.4, 0, 0, 6.283); ctx.fill()
    if (import.meta.env.DEV) LAY.ball = [x, y, r]
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = '#e9772c'; ctx.fill()
    ctx.lineWidth = Math.max(1, r * 0.14); ctx.strokeStyle = '#4a1e08'
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke()
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.strokeStyle = '#2a1004'; ctx.stroke()
  }
  // ── the men ──
  // Each man is a figure seen from above (figure.js) in the pose the game has him in (pose.js): his side's colour on
  // his back with his number, his skin tone, his arms and legs doing what he's doing. A figure is about as wide across
  // the shoulders as the body the game collides, so two men in contact stand shoulder to shoulder.
  const LOOKS = setup.looks.map((l, i) => lookOf({ name: l.who || l.label || `p${i}`, skin: l.skin, num: l.num, col: colOf(i) }))
  const FIG = LOOKS.map(look => ({ x: 0, y: 0, s: 30, ang: 0, scale: 1, air: 0, lean: 0, down: 0, lh: null, rh: null, lf: null, rf: null, toeL: 0, toeR: 0, look, hs: 20, cy: 0, ball: false, bounce: false, bl: null }))
  const ENV = { x: 0, y: 0, a: 0, dt: 0, held: 0, sFt: 3 }, BQ = [0, 0, 0]
  function figures(now, dt, a, tk) {
    const sF = tk + 6
    for (let i = 0; i < N; i++) {
      const p = s.players[i], f = FIG[i]
      ENV.x = DX[i]; ENV.y = DY[i]; ENV.a = a; ENV.dt = dt; ENV.sFt = sF / k
      // (how long his shot has been going up: his own meter's clock for this device's man, the game's ticks for the rest)
      ENV.held = i === me && !levels[me] && meter.on ? (meter.grade ? meter.gradeAt : now) - meter.t0 : (p.actT + a) * STEP
      const z = poser.pose(s, i, now, ENV)
      f.x = (DX[i] + z.ox) * k; f.y = (DY[i] + z.oy) * k; f.s = sF; f.ang = z.ang; f.scale = z.scale; f.air = z.air; f.lean = z.lean; f.down = z.down
      f.lh = z.lh; f.rh = z.rh; f.lf = z.lf; f.rf = z.rf; f.toeL = z.toeL; f.toeR = z.toeR; f.ball = z.ball; f.bounce = z.bounce; f.bl = z.bl
      // the ball off the floor: heard on each bounce
      if (z.thud && s.phase === 'live') sfx('dribble', i === me ? 1 : 0.7)
      // (the square the names, the meters and the words keep off: where he's drawn, a man in the air a touch up the screen)
      f.hs = sF * 0.56 * (1 + 0.2 * z.air); f.cy = f.y - z.air * sF * 0.2
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
    const nm = setup.looks[i].label.toUpperCase().slice(0, 9), nw = ctx.measureText(nm).width
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
    const keep = mine ? meter.side : 0, keepDy = mine ? meter.dy ?? 0 : 0
    let side = keep || 1, dy = keepDy, bc = keep ? costOf(keep, keepDy) - 60 : Infinity
    for (const sd of [1, -1]) for (const d of [0, -0.25, 0.25, -0.5]) { const c = costOf(sd, d); if (c < bc) { bc = c; side = sd; dy = d } }
    if (mine) { meter.side = side; meter.dy = dy }
    const bx = at(side), by = yOf(dy)
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
    ctx.fillStyle = col; ctx.fillRect(bx, fy, bw, by + bh - fy)
    // the green window, inside the bar, with a white tick each side of it (never thinner than 5px)
    const wy0 = yAt(hi), wy1 = yAt(lo), wc = (wy0 + wy1) / 2, wh = Math.max(5, wy1 - wy0)
    ctx.fillStyle = inWin && !rel ? 'rgba(255,255,255,.35)' : GREEN; ctx.fillRect(bx, wc - wh / 2, bw, wh)
    ctx.fillStyle = '#f3f6f8'; ctx.fillRect(bx - 5, wc - wh / 2 - 1, 4, wh + 2); ctx.fillRect(bx + bw + 1, wc - wh / 2 - 1, 4, wh + 2)
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
      const read = ['OPEN', 'CONTESTED', 'SMOTHERED'][meter.read] ?? ''
      if (read) chip(read, bx + bw / 2, overY, [GREEN, AMBER, RED][meter.read])
    }
    if (clutch && spec.win > base.win) chip('CLUTCH', bx + bw / 2, by + bh + fs * 0.95, GREEN)
    ctx.globalAlpha = 1
  }
  // two men in contact never stand on each other on the screen: this device's man is drawn a touch ahead of the game
  // (and online the others a beat behind), so figures closer than shoulder to shoulder are eased apart, a few px at most
  function relax(tk) {
    const need = (tk + 6) * 0.9
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const dx = (DX[j] - DX[i]) * k, dy = (DY[j] - DY[i]) * k, d = Math.hypot(dx, dy)
        if (d < 0.5 || d >= need) continue
        const push = Math.min(need - d, 8) / 2 / k, ux = dx / d * push, uy = dy / d * push
        DX[i] -= ux; DY[i] -= uy; DX[j] += ux; DY[j] += uy
      }
    }
  }
  let tk0 = 30
  const BARS = [], BAR_OF = [], DOTS = [], CHOICE = new Int8Array(N), TABY = new Int8Array(N)
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
    // the rim taking a make or a miss (a dunk: over the men, further down)
    for (const f of fx) {
      if (!f.rim || f.rim === 'dunk') continue
      const t = (now - f.t0) / f.dur
      if (t < 0 || t > 1) continue
      const rx = RIM.x * k, ry = RIM.y * k, r0 = k * 0.95
      const wob = f.rim === 'make' || reduced() ? 0 : Math.sin(t * 22) * (1 - t) * k * 0.22
      ctx.lineWidth = Math.max(2, k * 0.26); ctx.strokeStyle = f.rim === 'make' ? `rgba(255,255,255,${0.9 * (1 - t)})` : `rgba(240,120,50,${1 - t * 0.5})`
      ctx.beginPath(); ctx.arc(rx + wob, ry + wob * 0.4, r0 * (f.rim === 'make' ? 1 - t * 0.45 : 1), 0, 6.283); ctx.stroke()
    }
    // who is cut by the edge of the screen (a tab at the edge instead of half a man)
    const half = (tk + 6) * 0.5
    const cut = i => (worldW <= w + 1 ? 0 : X(i) - half < L ? -1 : X(i) + half > Rr ? 1 : 0)
    // every man's shadow first (no shadow lies on a man)
    for (let i = 0; i < N; i++) if (!cut(i)) drawShadow(ctx, FIG[i])
    // under the player this device controls: a white ring on the floor (his jersey is his side's colour, so the ring
    // isn't), a faint fill of his colour inside it; under the teammate the stick points at, a dashed one
    const ringR = (tk + 6) * 0.72
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
    // a teammate calling for the ball: a ring on his man, on every screen, for as long as the call is fresh
    if (s.call && s.phase === 'live' && s.tick - s.call.tick < 45 && P[s.call.pid] && !cut(s.call.pid)) {
      const ci = s.call.pid, f = clamp((s.tick - s.call.tick) / 45, 0, 1)
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,255,255,${0.95 - 0.5 * f})`
      ctx.beginPath(); ctx.arc(FIG[ci].x, FIG[ci].y, (tk + 6) * (0.74 + 0.2 * ((s.tick - s.call.tick) % 15) / 15), 0, 6.283); ctx.stroke()
    }
    // players, the far ones first (a man in the air over the rest)
    const order = P.map((_, i) => i).sort((i, j) => (P[i].y + (P[i].act === 'jump' ? 99 : 0)) - (P[j].y + (P[j].act === 'jump' ? 99 : 0)))
    DOTS.length = 0
    for (const i of order) {
      if (cut(i)) continue
      const f = FIG[i]
      DOTS.push([f.x - f.hs, f.cy - f.hs, f.x + f.hs, f.cy + f.hs, i])
      if (import.meta.env.DEV) LAY.dots[i] = [f.x, f.cy, f.hs]
      drawFigure(ctx, f)
    }
    // the ball: in a hand it goes where the hand is (a dribble: up and down off the floor beside him); in the air it's
    // where the game says. A dunk stays in the dunker's hand until it's through the rim
    let bx, by, bsc, gx, gy, bz, key
    const carry = holder >= 0 ? holder : b.st === 'shot' && b.kind === 'dunk' && b.from >= 0 && FIG[b.from].ball ? b.from : -1
    if (carry >= 0) {
      const f = FIG[carry]
      if (f.ball) {
        const q = pointAt(f, f.bl[0], f.bl[1], BQ)
        bz = f.bl[2]; gx = q[0]; gy = q[2]; bx = q[0]; by = f.bounce ? q[1] - LIFT * bz * k * 0.7 : q[1]
        bsc = f.bounce ? 0.84 + bz * 0.05 : 0.9 + Math.min(bz, 9) * 0.022
      } else { bx = gx = f.x; by = f.cy; gy = f.y; bz = 3; bsc = 1 }
      key = 'h' + carry
    } else {
      const q = ballAt(DB[0], DB[1], DB[2])
      bx = q[0]; by = q[1]; bsc = q[2]; gx = DB[0] * k; gy = q[3] ? by : DB[1] * k; bz = DB[2]
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
    const ballCut = carry >= 0 && cut(carry)
    if (!ballCut) drawBall(bx + BL.ox * ef, by + BL.oy * ef, bsc, gx + BL.ox * ef, gy + BL.oy * ef, bz)
    BL.x = bx + BL.ox * ef; BL.y = by + BL.oy * ef
    // a dunk on the rim: the rim dragged his way and springing back, a ring thrown off it, the hit marked round it
    for (const f of fx) {
      if (f.rim !== 'dunk') continue
      const t = (now - f.t0) / f.dur
      if (t < 0 || t > 1) continue
      const rx = RIM.x * k, ry = RIM.y * k, r0 = k * 0.95, still = reduced()
      const sp = still ? 0 : Math.exp(-5.2 * t) * Math.cos(t * 30) * k * 0.62
      ctx.lineWidth = Math.max(2.5, k * 0.3); ctx.strokeStyle = `rgba(245,128,52,${1 - t * 0.5})`
      ctx.beginPath(); ctx.arc(rx + f.ux * sp, ry + f.uy * sp, r0, 0, 6.283); ctx.stroke()
      if (t < 0.5) { const u = t / 0.5; ctx.lineWidth = Math.max(1.5, k * 0.22) * (1 - u) + 0.5; ctx.strokeStyle = `rgba(255,255,255,${0.85 * (1 - u)})`; ctx.beginPath(); ctx.arc(rx, ry, r0 * (1 + 1.6 * u * (2 - u)), 0, 6.283); ctx.stroke() }
      if (t < 0.32 && !still) {
        const u = t / 0.32, n = f.big ? 10 : 8
        ctx.lineWidth = Math.max(2, k * 0.2); ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(255,240,207,${1 - u})`
        ctx.beginPath()
        for (let j = 0; j < n; j++) { const an = j / n * 6.283 + 0.3, r1 = r0 * (1.6 + 1.2 * u), r2 = r1 + r0 * (f.big ? 1.2 : 0.8) * (1 - u * 0.5); ctx.moveTo(rx + Math.cos(an) * r1, ry + Math.sin(an) * r1); ctx.lineTo(rx + Math.cos(an) * r2, ry + Math.sin(an) * r2) }
        ctx.stroke(); ctx.lineCap = 'butt'
      }
    }
    // the king's crown, and CLEAR IT over the man who has to take it out past the arc
    const marks = []
    const fsN = Math.max(13, Math.round(tk * 0.4))
    if (king >= 0 && !cut(king)) {
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
      const nm = setup.looks[i].label.toUpperCase(), bw = ctx.measureText(nm).width + 10 + (face >= 0 ? bh : 0)
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
        if (clearTag && i === clearer && (c === 1 || c > 5)) cost += 1e5    // CLEAR IT goes over him
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
      const tw = ctx.measureText('CLEAR IT').width + 10, th = Math.round(fs * 1.24)
      const x0 = clamp(cx - tw / 2, L + 2, Rr - 2 - tw), y0 = Math.max(1, cy - th)
      const rc = [x0, y0, x0 + tw, y0 + th]
      drawTag(rc, 'CLEAR IT', fs, AMBER, true, false)
      marks.push(rc)
    }
    // the men cut by the edge of the screen
    // (at his height, or the nearest height that isn't on a man near the edge, another name or another tab)
    const tfs = Math.max(13, Math.round(tk * 0.36))
    for (const i of order) {
      const off = cut(i)
      if (!off) continue
      ctx.font = `${tfs}px ${FONT}`
      const tw = 30 + ctx.measureText(setup.looks[i].label.toUpperCase().slice(0, 9)).width + (i === holder ? 20 : 0)
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
    setKnob(stick.ox, stick.oy, 0, 0, true)
  }
  const padMove = e => {
    if (e.pointerId !== stick.id) return
    let dx = e.clientX - stick.rect.left - stick.ox, dy = e.clientY - stick.rect.top - stick.oy
    const d = Math.hypot(dx, dy)
    if (d > R) { dx *= R / d; dy *= R / d }
    H.mx = dx / R; H.my = dy / R
    setKnob(stick.ox, stick.oy, dx, dy, true)
  }
  // where the stick rests: the layout's marker for it (btlive.css .btlv-stick-home), else a quarter across
  const rest = () => {
    const r = els.pad.getBoundingClientRect(), m = els.home?.getBoundingClientRect()
    if (m && m.width + m.height > 0) setKnob(m.left + m.width / 2 - r.left, m.top + m.height / 2 - r.top, 0, 0, false)
    else setKnob(r.width * 0.25, r.height - 150, 0, 0, false)
  }
  const padUp = e => {
    if (e.pointerId !== stick.id) return
    stick.id = null; H.mx = H.my = 0
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
    if (s.phase !== 'live') return
    if (uy >= 0.6) { if (p.team !== s.poss && b.st === 'held') tap(true) }
    else if (uy <= -0.6) tap(false)
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
  }
  const dsUp = e => {
    if (e.pointerId !== DS.id) return
    DS.id = null; els.dk.style.transform = ''; els.ds.classList.remove('is-on'); dribbleAt(0, 0)
  }
  // the keyboard: WASD the left stick, the arrows the right one, SPACE shoots, E passes (calls for it off the ball)
  const KEY = { ' ': 'a', e: 'b' }
  const DIR = { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }
  const ARROW = { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] }
  const arrows = new Set(), tapped = new Set()
  const readKeys = () => {
    let x = 0, y = 0
    for (const kk of keys) { const d = DIR[kk]; if (d) { x += d[0]; y += d[1] } }
    const m = Math.hypot(x, y)
    if (stick.id == null) { H.mx = m ? x / m : 0; H.my = m ? y / m : 0 }
  }
  const arrowVec = set => { let x = 0, y = 0; for (const kk of set) { x += ARROW[kk][0]; y += ARROW[kk][1] } const m = Math.hypot(x, y); dribbleAt(m ? x / m : 0, m ? y / m : 0) }
  const keyDown = e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const kk = e.key.toLowerCase()
    if (DIR[kk]) { e.preventDefault(); keys.add(kk); readKeys() }
    else if (ARROW[kk]) {
      e.preventDefault()
      if (e.repeat) return
      arrows.add(kk); tapped.add(kk)
      // two arrows pressed together are one diagonal flick: the first waits a moment for the second. With a flick
      // already out, the next arrow is the roll round to it at once
      if (DS.on) arrowVec(arrows)
      else if (!DS.kt) DS.kt = setTimeout(() => { DS.kt = 0; arrowVec(tapped); tapped.clear(); if (!arrows.size) dribbleAt(0, 0) }, 35)
    } else if (KEY[kk]) { e.preventDefault(); if (!e.repeat) press(KEY[kk], true) }
  }
  const keyUp = e => {
    const kk = e.key.toLowerCase()
    if (DIR[kk]) { keys.delete(kk); readKeys() }
    else if (ARROW[kk]) { arrows.delete(kk); if (!DS.kt) { tapped.clear(); arrowVec(arrows) } }
    else if (KEY[kk]) press(KEY[kk], false)
  }
  const blur = () => { keys.clear(); readKeys(); arrows.clear(); tapped.clear(); dribbleAt(0, 0); for (const key of ['a', 'b']) press(key, false) }
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
    flick, dstick: dribbleAt, tap, right: rightFlick,
    // DEV: each man's pose on the last frame (figure.js), and his animation's notes (pose.js)
    get figs() { return FIG }, get anim() { return poser.anim },
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
      clearTimeout(DS.kt)
      window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', vis)
      for (const [el, d, u] of btnHandlers) { el.removeEventListener('pointerdown', d); el.removeEventListener('pointerup', u); el.removeEventListener('pointercancel', u) }
    },
  }
  return api
}
