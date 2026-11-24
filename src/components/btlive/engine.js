// BLACKTOP LIVE, the screen's engine: runs the simulation (lib/btlive) at 30 ticks a second, draws it at the
// display's rate with the positions eased between ticks, reads the stick and the buttons, times the shot meter on
// this device, and turns what happened into sound, haptics and the rare animations. No React in here and no
// React state per frame: it draws on a canvas and writes the few bits of the HUD that change straight to the DOM.
import { createGame, step, cpuInput, passTarget, meterQuality, meterGrade, meterSpec, moveLocal, shotKindAt, referee as ref, HZ, COURT, T } from '../../lib/btlive/index.js'
import { applySnap, lerpAt, relMsg, SEND_EVERY } from '../../lib/btlive/proto.js'
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
//          home (where the stick rests), btn: { a, b, c }, lab: { a, b, c } }
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
  let lastDribble = 0, shown = { clock: null, idle: null, poss: null, note: null, mode: null, gp: false, bug: null, sc: [] }
  // the person's hands: the stick, the three buttons (down now / tapped since the last tick / must be let go first)
  const H = { mx: 0, my: 0, a: false, b: false, c: false, ta: false, tb: false, tc: false, na: false, nb: false, nc: false, aT0: 0, aUp: 0 }
  // the shot meter, timed on this device
  // (rel: where he stopped it, kept on the screen for a moment after the release; side: which side of him it's drawn)
  const meter = { on: false, t0: 0, spec: null, read: 0, q: null, grade: null, gradeAt: 0, gradeGood: false, rel: null, side: 0 }
  const keys = new Set()
  // online: what this device has sent and heard, and what it is doing before the referee knows (local)
  const online = !!net
  const NB = { k: 0, n: [0, 0, 0], rel: null, lastK: -1, lastQ: 0, buf: [], off: null, sendT: 0, edge: false, local: null, burst: 0, lt: 0, wasLive: false, aUsed: 0, aOff: false }
  const DELAY = 6                                  // others are drawn this many ticks behind the latest word (200 ms)
  const DX = new Float32Array(N), DY = new Float32Array(N), DB = [0, 0, 0], LP = new Float32Array(N * 2)
  const LAY = { dots: [], bars: [], ball: null, words: [], tabs: [] }   // DEV: what was drawn where on the last frame (px, world)
  const EVLOG = [], PFN = 14                       // (PFN: where a snapshot row keeps the act: proto.js snapOf)

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
  function onEvents() {
    const P = s.players
    for (const e of s.events) {
      const p = e.pid != null ? P[e.pid] : null
      if (e.e === 'make') {
        sfx('make'); haptic(e.kind === 'dunk' ? 'heavy' : 'medium')
        const word = e.poster ? 'POSTER' : e.kind === 'dunk' ? 'DUNK' : e.deep ? 'FROM DEEP' : e.pts === 2 ? 'TWO' : 'ONE'
        say(word, COURT.rim.x, 1.6, e.poster || e.deep ? FLOOD : colOf(e.pid), e.kind === 'dunk' || e.pts === 2, 1300)
        fx.push({ rim: e.kind === 'dunk' ? 'dunk' : 'make', t0: clockNow, dur: e.kind === 'dunk' ? 520 : 300 })
        if (e.kind === 'dunk') kick(e.poster ? 1.6 : 1)
      } else if (e.e === 'miss') { sfx('rimmiss'); fx.push({ rim: 'miss', t0: clockNow, dur: 260 }) }
      else if (e.e === 'block') { sfx('btblock'); haptic('heavy'); say(e.chase ? 'CHASE-DOWN' : 'BLOCKED', p.x, wordY(p.y), colOf(e.pid), true); kick(1) }
      else if (e.e === 'steal') { sfx('btsteal'); haptic('medium'); say('STEAL', p.x, wordY(p.y), colOf(e.pid)) }
      else if (e.e === 'pick') { sfx('btsteal'); haptic('medium'); say('PICKED OFF', p.x, wordY(p.y), colOf(e.pid)) }
      else if (e.e === 'catch') sfx('catchball')
      else if (e.e === 'board') { sfx('catchball'); if (e.pid === me) haptic('light') }
      else if (e.e === 'move') { if (e.ankles) { haptic('heavy'); say('ANKLES', P[e.def].x, wordY(P[e.def].y), FLOOD, true, 1400) } else if (e.pid === me) haptic('light') }
      else if (e.e === 'swipe') { if (e.pid === me) { haptic('light'); if (e.reach) say('REACH', p.x, wordY(p.y), 'rgba(255,255,255,.8)') } }
      else if (e.e === 'oob') { sfx('whistle'); say('OUT OF BOUNDS', COURT.rim.x, 22, '#fff') }
      else if (e.e === 'clock') { sfx('whistle'); say('SHOT CLOCK', COURT.rim.x, 22, '#fff') }
      else if (e.e === 'check') { say('CHECK BALL', COURT.rim.x, 37.6, 'rgba(255,255,255,.75)', false, 900); H.na = H.a; H.nb = H.b; H.nc = H.c; NB.aUsed = NB.n[0] }
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
    const A = (H.a && !H.na) || H.ta, B = (H.b && !H.nb) || H.tb, C = (H.c && !H.nc) || H.tc
    H.ta = H.tb = H.tc = false
    const inp = { mx: H.mx, my: H.my, shoot: A, steal: A, pass: B, jump: B, move: C, q: null, t: s.tick }
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
    const b = s.ball
    if (s.phase === 'live' && b.st === 'held' && clockNow - lastDribble > 330) {
      const hp = P[b.holder]
      if (hp.act === 'free' && Math.hypot(hp.vx, hp.vy) > 2.5) { sfx('dribble'); lastDribble = clockNow }
    }
    hud()
  }
  // my meter: it starts when the shot has started (the simulation's word, or online this device's), on the clock of the press
  function meterWatch() {
    const p = s.players[me]
    if (p.act === 'gather' && !meter.on && !levels[me]) {
      meter.on = true; meter.spec = p.shot.spec; meter.read = p.shot.read; meter.q = null; meter.grade = null; meter.rel = null; meter.side = 0
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
      NB.local = { act: 'follow', until: NB.lt + Math.round(T.follow * HZ) }
      const p = s.players[me]; p.act = 'follow'; p.actT = 0; p.shot = null; meter.q = null
    }
  }

  // ── online: one tick on this device, and a snapshot from the referee ────────────────────────────
  const r2 = v => Math.round(v * 100) / 100
  function onlineTick() {
    const p = s.players[me], b = s.ball
    NB.lt++
    prev[me * 2] = p.x; prev[me * 2 + 1] = p.y
    const C = (H.c && !H.nc) || H.tc
    H.ta = H.tb = H.tc = false
    const live = s.phase === 'live'
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
    if (has && C && p.act === 'free' && p.moveCd <= 0 && NB.burst <= 0) {
      const m = Math.hypot(H.mx, H.my)
      NB.burst = Math.round(T.moveTime * HZ); p.bdx = m >= T.walk ? H.mx / m : p.fx; p.bdy = m >= T.walk ? H.my / m : p.fy
    }
    if (NB.local?.act === 'gather') p.actT++
    if (NB.local?.act === 'follow' && NB.lt >= NB.local.until) { NB.local = null; if (p.act === 'follow') p.act = 'free' }
    if (live && NB.wasLive) { p.burst = NB.burst; moveLocal(s, me, { mx: H.mx, my: H.my }); NB.burst = p.burst }
    // held past the end of the meter: it goes, late
    if (meter.on && !meter.grade && clockNow - meter.t0 >= meter.spec.total) letGo(meter.t0 + meter.spec.total)
    if (++NB.sendT >= SEND_EVERY || NB.edge) {
      NB.sendT = 0; NB.edge = false
      net.send({ t: 'in', k: ++NB.k, mx: r2(H.mx), my: r2(H.my), x: r2(p.x), y: r2(p.y), vx: r2(p.vx), vy: r2(p.vy), h: (H.a ? 1 : 0) | (H.b ? 2 : 0) | (H.c ? 4 : 0), n: NB.n, rel: NB.rel })
    }
    meterWatch()
    hud()
  }
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
    if (!mine) { prev[me * 2] = p.x; prev[me * 2 + 1] = p.y; NB.burst = 0; if (L) NB.local = null }
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
    // (between plays nothing is live: no buttons)
    const mode = s.phase === 'dead' || s.phase === 'over' ? 'none' : has ? (s.mustClear === me ? 'clear' : 'ball') : p.team === s.poss ? (up ? 'board' : 'off') : (up ? 'dboard' : 'def')
    if (mode !== shown.mode) {
      shown.mode = mode
      const set = (key, text) => { els.lab[key].textContent = text || ''; els.btn[key].classList.toggle('is-off', !text) }
      set('a', mode === 'ball' ? 'SHOOT' : mode === 'def' ? 'STEAL' : '')
      set('b', mode === 'none' || mode === 'clear' ? '' : mode === 'ball' ? (s.size > 1 ? 'PASS' : '') : mode === 'off' ? (s.size > 1 ? 'CALL' : '') : 'JUMP')
      set('c', mode === 'ball' || mode === 'clear' ? 'MOVE' : '')
    }
    // cooldowns dim their button
    const cdA = mode === 'def' ? p.stealCd > 0 : false, cdC = mode === 'ball' || mode === 'clear' ? p.moveCd > 0 : false
    if (els.btn.a.classList.contains('is-cd') !== cdA) els.btn.a.classList.toggle('is-cd', cdA)
    if (els.btn.c.classList.contains('is-cd') !== cdC) els.btn.c.classList.toggle('is-cd', cdC)
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
  // a man in the air: a touch bigger and a touch up (straight up the screen would put him on the man guarding him)
  const PO = { lift: 0, rot: 0, sc: 1, dx: 0, air: 0 }
  function pose(p, tk) {
    PO.lift = 0; PO.rot = 0; PO.sc = 1; PO.dx = 0; PO.air = 0
    if (p.act === 'jump') PO.air = Math.sin(Math.PI * clamp(p.actT / (T.jumpTime * HZ), 0, 1))
    else if (p.act === 'gather' && p.shot?.kind === 'jumper') PO.air = clamp(p.actT / 15, 0, 1) * 0.6
    else if (p.act === 'down') { PO.rot = (p.team === 0 ? 1 : -1) * 1.35 * clamp(p.actT / 5, 0, 1); PO.sc = 0.86 }   // sat down: on his back
    else if (p.act === 'frozen' && p.actT < 6 && !reduced()) PO.dx = Math.sin(p.actT * 2.4) * tk * 0.07
    if (PO.air) { PO.lift = tk * 0.1 * PO.air; PO.sc = 1 + 0.14 * PO.air }
    return PO
  }
  function drawPlayer(i, x, y, tk, has) {
    const look = setup.looks[i], col = colOf(i), po = pose(s.players[i], tk)
    // contact shadow
    ctx.fillStyle = 'rgba(0,0,0,.42)'
    ctx.beginPath(); ctx.ellipse(x, y + tk * 0.5, tk * 0.56 * (1 - po.air * 0.25), tk * 0.2, 0, 0, 6.283); ctx.fill()
    ctx.save()
    ctx.translate(x + po.dx, y - po.lift)
    if (po.rot) { ctx.translate(0, tk * 0.2); ctx.rotate(po.rot) }
    if (po.sc !== 1) ctx.scale(po.sc, po.sc)
    const r = tk * 0.3, o = -tk / 2
    // the rings: dark edge, the colour; the man with the ball wears a white one outside it
    if (has) { rr(o - 5, o - 5, tk + 10, tk + 10, r + 5); ctx.fillStyle = 'rgba(5,7,10,.92)'; ctx.fill(); rr(o - 3.8, o - 3.8, tk + 7.6, tk + 7.6, r + 3.8); ctx.fillStyle = '#fff'; ctx.fill() }
    else { rr(o - 3.5, o - 3.5, tk + 7, tk + 7, r + 3.5); ctx.fillStyle = 'rgba(5,7,10,.9)'; ctx.fill() }
    rr(o - 2.2, o - 2.2, tk + 4.4, tk + 4.4, r + 2.2); ctx.fillStyle = col; ctx.fill()
    // the portrait on its base
    rr(o, o, tk, tk, r); ctx.save(); ctx.clip()
    ctx.fillStyle = '#141a22'; ctx.fillRect(o, o, tk, tk)
    ctx.fillStyle = col; ctx.globalAlpha = 0.28; ctx.fillRect(o, o, tk, tk); ctx.globalAlpha = 1
    const im = imgs[i]
    if (im && im.complete && im.naturalWidth) {
      // a square of the photo around the face (object-fit: cover; object-position: the face)
      const side = Math.min(im.naturalWidth, im.naturalHeight)
      const fc = look.faceCenter || [50, 30]
      const sx = clamp(im.naturalWidth * fc[0] / 100 - side / 2, 0, im.naturalWidth - side), sy = clamp(im.naturalHeight * fc[1] / 100 - side * 0.42, 0, im.naturalHeight - side)
      ctx.drawImage(im, sx, sy, side, side, o, o, tk, tk)
    } else {
      ctx.fillStyle = '#f3f6f8'; ctx.font = `${Math.round(tk * 0.46)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText((look.label || '?').slice(0, 2).toUpperCase(), 0, 1)
    }
    ctx.restore()
    ctx.restore()
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
  function drawTag(rc, text, fs, col, fill, mine) {
    rr(rc[0], rc[1], rc[2] - rc[0], rc[3] - rc[1], 2)
    ctx.fillStyle = fill ? col : 'rgba(5,7,10,.84)'; ctx.fill()
    if (!fill) { ctx.fillStyle = col; ctx.fillRect(rc[0], rc[1], 2, rc[3] - rc[1]) }
    ctx.font = `${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = fill ? '#05070a' : mine ? '#fff' : 'rgba(243,246,248,.9)'
    ctx.fillText(text, (rc[0] + rc[2]) / 2 + (fill ? 0 : 1), (rc[1] + rc[3]) / 2 + 0.5)
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
  // the ball in a hand: the side away from the men near him (a crossover goes round the back), so it is never on a face
  const HAND = new Float32Array(N).fill(1)
  let lastDraw = 0
  function handTo(i, dt) {
    const P = s.players, p = P[i], px = -p.fy, py = p.fx                // his right hand, facing (fx, fy)
    let sum = 0, tgt = HAND[i] >= 0 ? 1 : -1
    for (const o of P) {
      if (o === p) continue
      const ox = o.x - p.x, oy = o.y - p.y, d2 = ox * ox + oy * oy
      if (d2 < 64) sum += (ox * px + oy * py) / Math.max(4, d2)          // which side the men near him are on, the nearest counting most
    }
    if (Math.abs(sum) > 0.06) tgt = sum > 0 ? -1 : 1
    HAND[i] += (tgt - HAND[i]) * (1 - Math.exp(-dt / 70))
    return HAND[i]
  }
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
    const f = clamp(held / spec.total, 0, 1)
    const bw = mine ? Math.round(clamp(tk * 0.6, 20, 30)) : Math.round(clamp(tk * 0.24, 7, 12))
    const bh = mine ? Math.round(clamp(tk * 3.4, 118, 176)) : Math.round(clamp(tk * 1.7, 46, 80))
    const L = camPx + 6, Rr = camPx + w - 6
    const fs = Math.round(clamp(tk * 0.42, 13, 20))
    ctx.font = `${fs}px ${FONT}`
    // the room it needs beside him: the bar and the window's overhang; (his own) and the widest word that goes next to it
    const word = mine ? 9 + ctx.measureText('SLIGHTLY EARLY').width + 12 : 0
    const at = sd => x + sd * (tk * 0.5 + 14) - (sd < 0 ? bw : 0)
    const fits = (sd, extra = 0) => (sd > 0 ? at(1) - 8 >= L && at(1) + bw + 8 + extra <= Rr : at(-1) + bw + 8 <= Rr && at(-1) - 8 - extra >= L)
    // on the side away from the nearest defender (so it's never under him), kept for the whole shot; the other side
    // when that one hasn't the room on the screen
    let side = mine ? meter.side : 0
    if (!side) {
      let nd = 99; side = 1
      for (const o of s.players) if (o.team !== p.team) { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < nd) { nd = d; side = o.x > p.x ? -1 : 1 } }
      if (!fits(side) && fits(-side)) side = -side
      if (mine) meter.side = side
    }
    if (!fits(side) && fits(-side)) side = -side
    const wordBeside = fits(side, word)                               // else the words go over (or under) the bar
    const bx = at(side), by = clamp(y - bh * 0.6, 4, h - bh - 4)
    const yAt = v => by + bh * (1 - clamp(v / spec.total, 0, 1))     // a time on the meter -> its height on the screen
    ctx.globalAlpha = a
    // the track
    rr(bx - 2, by - 2, bw + 4, bh + 4, 4); ctx.fillStyle = 'rgba(5,7,10,.92)'; ctx.fill()
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(243,246,248,.5)'; ctx.stroke()
    if (!mine) {
      ctx.fillStyle = 'rgba(243,246,248,.85)'; ctx.fillRect(bx + 1, by + bh * (1 - f), bw - 2, bh * f)
      ctx.globalAlpha = 1
      return
    }
    const lo = spec.ideal - spec.win, hi = spec.ideal + spec.win
    // game point: the window it would be on any other play, as an outline, when the pressure (or his Clutch rating)
    // has moved it by a few ms or more; CLUTCH under the bar when his rating has made it wider
    const base = meter.base, clutch = base && Math.abs(base.win - spec.win) >= 3
    // the green window: across the bar and past both its edges, never thinner than 8px
    const wy0 = yAt(hi), wy1 = yAt(lo), wc = (wy0 + wy1) / 2, wh = Math.max(8, wy1 - wy0)
    ctx.fillStyle = 'rgba(5,7,10,.95)'; ctx.fillRect(bx - 7, wc - wh / 2 - 1.5, bw + 14, wh + 3)
    ctx.fillStyle = GREEN; ctx.fillRect(bx - 6, wc - wh / 2, bw + 12, wh)
    if (clutch) {                                                     // (dark dashes inside a wider window, light ones round a narrower)
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5; ctx.strokeStyle = spec.win > base.win ? 'rgba(5,7,10,.9)' : 'rgba(243,246,248,.8)'
      ctx.strokeRect(bx - 6.5, yAt(base.ideal + base.win), bw + 13, Math.max(4, yAt(base.ideal - base.win) - yAt(base.ideal + base.win))); ctx.setLineDash([])
    }
    // the fill, inside the bar's edges: white on the way up, green in the window, red past it
    const inWin = Math.abs(held - spec.ideal) <= spec.win, past = held > hi
    const col = rel ? GRADE_COL[meter.grade] ?? '#fff' : inWin ? GREEN : past ? RED : '#f3f6f8'
    const fy = by + bh * (1 - f)
    ctx.fillStyle = col; ctx.fillRect(bx + 4, fy, bw - 8, by + bh - fy)
    // the window's edges stay readable over a green fill
    ctx.fillStyle = 'rgba(5,7,10,.9)'; ctx.fillRect(bx + 4, wc - wh / 2 - 1, bw - 8, 1.5); ctx.fillRect(bx + 4, wc + wh / 2 - 0.5, bw - 8, 1.5)
    ctx.font = `${fs}px ${FONT}`; ctx.textBaseline = 'middle'
    const chip = (text, cx, cy, color, align) => {
      const tw = ctx.measureText(text).width, pw = tw + 12, ph = Math.round(fs * 1.3)
      const x0 = clamp(align === 'left' ? cx : align === 'right' ? cx - pw : cx - pw / 2, L, Rr - pw)
      const y0 = clamp(cy - ph / 2, 2, h - ph - 2)
      ctx.fillStyle = 'rgba(5,7,10,.9)'; ctx.fillRect(x0, y0, pw, ph)
      ctx.fillStyle = color; ctx.fillRect(x0, y0, 3, ph)
      ctx.textAlign = 'left'; ctx.fillText(text, x0 + 7, y0 + ph / 2 + 0.5)
    }
    const out = side > 0 ? bx + bw + 9 : bx - 9, align = side > 0 ? 'left' : 'right'
    const overY = by > fs * 1.8 ? by - fs * 0.95 : by + bh + fs * 0.95
    const put = (text, y, color) => (wordBeside ? chip(text, out, y, color, align) : chip(text, bx + bw / 2, overY, color, 'center'))
    if (rel) {
      // where he stopped it: a marker across, in the grade's colour, and the grade beside it
      ctx.fillStyle = 'rgba(5,7,10,.95)'; ctx.fillRect(bx - 9, fy - 3.5, bw + 18, 7)
      ctx.fillStyle = col; ctx.fillRect(bx - 8, fy - 2.5, bw + 16, 5)
      ctx.fillStyle = '#fff'; ctx.fillRect(bx - 8, fy - 0.75, bw + 16, 1.5)
      put(meter.grade, fy, col)
    } else {
      // how open he is (as well as his IQ reads it), beside the foot of the meter
      const read = ['OPEN', 'CONTESTED', 'SMOTHERED'][meter.read] ?? ''
      if (read) put(read, by + bh - fs * 0.65, [GREEN, AMBER, RED][meter.read])
    }
    if (clutch && spec.win > base.win) chip('CLUTCH', bx + bw / 2, wordBeside || overY < by ? by + bh + fs * 0.95 : by - fs * 0.95, GREEN, 'center')
    ctx.globalAlpha = 1
  }
  // two men in contact never overlap on the screen: the bodies are circles but the dots are rounded squares (wider
  // across the corners), and this device's man is drawn a touch ahead; overlapping dots are eased apart, a few px at most
  function relax(tk) {
    const hh = tk / 2 + 3.5, rc = tk * 0.3 + 3.5, flat = hh - rc
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const dx = (DX[j] - DX[i]) * k, dy = (DY[j] - DY[i]) * k, d = Math.hypot(dx, dy)
        if (d < 0.5) continue
        const need = 2 * (flat * (Math.abs(dx) + Math.abs(dy)) / d + rc) + 1
        if (d >= need) continue
        const push = Math.min(need - d, 8) / 2 / k, ux = dx / d * push, uy = dy / d * push
        DX[i] -= ux; DY[i] -= uy; DX[j] += ux; DY[j] += uy
      }
    }
  }
  let tk0 = 30
  const BARS = [], DOTS = [], CHOICE = new Int8Array(N), TABY = new Int8Array(N)
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
    if (import.meta.env.DEV) { LAY.dots.length = LAY.bars.length = LAY.words.length = LAY.tabs.length = 0; LAY.ball = null; LAY.k = k; LAY.tk = tk; LAY.L = L; LAY.R = Rr; LAY.h = h }
    const X = i => DX[i] * k, Y = i => DY[i] * k
    const b = s.ball, live = s.phase === 'live'
    const holder = b.st === 'held' ? b.holder : -1
    const king = kingOf(), clearer = clearerOf()
    // the rim taking a make, a miss, a dunk
    for (const f of fx) {
      if (!f.rim) continue
      const t = (now - f.t0) / f.dur
      if (t < 0 || t > 1) continue
      const rx = RIM.x * k, ry = RIM.y * k, r0 = k * 0.95
      const wob = f.rim === 'make' || reduced() ? 0 : Math.sin(t * 22) * (1 - t) * (f.rim === 'dunk' ? k * 0.5 : k * 0.22)
      ctx.lineWidth = Math.max(2, k * 0.26); ctx.strokeStyle = f.rim === 'make' ? `rgba(255,255,255,${0.9 * (1 - t)})` : `rgba(240,120,50,${1 - t * 0.5})`
      ctx.beginPath(); ctx.arc(rx + wob, ry + wob * 0.4, r0 * (f.rim === 'make' ? 1 - t * 0.45 : 1), 0, 6.283); ctx.stroke()
    }
    // who is cut by the edge of the screen (a tab at the edge instead of half a man)
    const half = tk / 2 + 5
    const cut = i => (worldW <= w + 1 ? 0 : X(i) - half < L ? -1 : X(i) + half > Rr ? 1 : 0)
    // under the player this device controls: a ring in his colour; under the teammate the stick points at, a dashed one
    if (s.phase !== 'over' && !cut(me)) {
      const mx = X(me), my = Y(me), col = colOf(me)
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(5,7,10,.75)'
      ctx.beginPath(); ctx.ellipse(mx, my + tk * 0.42, tk * 0.86, tk * 0.4, 0, 0, 6.283); ctx.stroke()
      ctx.lineWidth = 3; ctx.strokeStyle = col
      ctx.beginPath(); ctx.ellipse(mx, my + tk * 0.42, tk * 0.86, tk * 0.4, 0, 0, 6.283); ctx.stroke()
      if (s.size > 1 && !koth() && holder === me && live && !levels[me]) {
        const to = passTarget(s, me, H.mx, H.my)
        if (to >= 0 && !cut(to)) {
          const tx = X(to), ty = Y(to)
          ctx.setLineDash([5, 4]); ctx.strokeStyle = col; ctx.lineWidth = 2
          ctx.beginPath(); ctx.ellipse(tx, ty + tk * 0.42, tk * 0.86, tk * 0.4, 0, 0, 6.283); ctx.stroke(); ctx.setLineDash([])
        }
      }
    }
    // a teammate calling for the ball: a ring on his man, on every screen, for as long as the call is fresh
    if (s.call && s.phase === 'live' && s.tick - s.call.tick < 45 && P[s.call.pid] && !cut(s.call.pid)) {
      const ci = s.call.pid, f = clamp((s.tick - s.call.tick) / 45, 0, 1)
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,255,255,${0.95 - 0.5 * f})`
      ctx.beginPath(); ctx.arc(X(ci), Y(ci), tk * (0.82 + 0.25 * ((s.tick - s.call.tick) % 15) / 15), 0, 6.283); ctx.stroke()
    }
    // players, the far ones first (a man in the air over the rest)
    const order = P.map((_, i) => i).sort((i, j) => (P[i].y + (P[i].act === 'jump' ? 99 : 0)) - (P[j].y + (P[j].act === 'jump' ? 99 : 0)))
    DOTS.length = 0
    for (const i of order) {
      if (cut(i)) continue
      const po = pose(P[i], tk), cx = X(i) + po.dx, cy = Y(i) - po.lift, hs = (tk / 2 + 5) * po.sc
      DOTS.push([cx - hs, cy - hs, cx + hs, cy + hs, i])
      if (import.meta.env.DEV) LAY.dots[i] = [cx, cy, (tk / 2 + (i === holder ? 5 : 3.5)) * po.sc]
      drawPlayer(i, X(i), Y(i), tk, i === holder)
    }
    // the ball: in a hand it goes with him (its height shown by its size); in the air it's where the game says
    let bx, by, bsc, gx, gy, bz, key
    if (holder >= 0) {
      const hp = P[holder], po = pose(hp, tk)
      let z = 1.2
      if (hp.act === 'gather') z = 2 + clamp(hp.actT / 12, 0, 1) * 5
      else if (live && Math.hypot(hp.vx, hp.vy) > 1) z = Math.abs(Math.sin(now / 165)) * 2.6
      const sd = handTo(holder, dt), u = (sd + 1) / 2, ang = 4.53 + (1.75 - 4.53) * u
      const fx0 = hp.fx || 0, fy0 = hp.fy || -1, ca = Math.cos(ang), sa = Math.sin(ang)
      const ux = ca * fx0 + sa * -fy0, uy = ca * fy0 + sa * fx0          // that hand's way from his middle
      const hr = (tk / 2 + Math.max(4.5, k * 0.7) * 0.55) * po.sc
      gx = X(holder) + po.dx + ux * hr; gy = Y(holder) + uy * hr
      bx = gx; by = gy - po.lift; bsc = 0.92 + z * 0.035; bz = z
      key = 'h' + holder
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
    const ballCut = holder >= 0 && cut(holder)
    if (!ballCut) drawBall(bx + BL.ox * ef, by + BL.oy * ef, bsc, gx + BL.ox * ef, gy + BL.oy * ef, bz)
    BL.x = bx + BL.ox * ef; BL.y = by + BL.oy * ef
    // the king's crown, and CLEAR IT over the man who has to take it out past the arc
    const marks = []
    const fsN = Math.max(13, Math.round(tk * 0.4))
    if (king >= 0 && !cut(king)) {
      const po = pose(P[king], tk), cw = tk * 0.5, cy = Y(king) - po.lift - (tk / 2 + 5) * po.sc - 2
      drawCrown(X(king), cy, cw)
      marks.push([X(king) - cw / 2 - 2, cy - cw * 0.66 - 2, X(king) + cw / 2 + 2, cy + 2])
    }
    // a shooter's meter goes up beside him (either side): names and words keep off it
    if (live) for (let i = 0; i < N; i++) {
      if (P[i].act !== 'gather' || cut(i)) continue
      const mh = i === me ? Math.max(66, tk * 2.6) : Math.max(34, tk * 1.5), mw = i === me ? Math.max(12, tk * 0.34) + 70 : Math.max(6, tk * 0.2) + 4
      const x = X(i), y = Y(i), y0 = y - mh * 0.62 - 3, y1 = y + mh * 0.38 + 3
      marks.push([x + tk / 2 + 12, y0, x + tk / 2 + 16 + mw, y1], [x - tk / 2 - 16 - mw, y0, x - tk / 2 - 12, y1])
    }
    // the names: under each man, or over him, or beside him: wherever they don't sit on another man or name
    BARS.length = 0
    const names = [me, ...order.filter(i => i !== me)]
    ctx.font = `${fsN}px ${FONT}`
    const bh = Math.round(fsN * 1.24)
    const clearTag = clearer >= 0 && !cut(clearer)
    for (const i of names) {
      if (cut(i)) continue
      const po = pose(P[i], tk), cx = X(i) + po.dx, cy = Y(i) - po.lift, hs = (tk / 2 + 5) * po.sc
      const nm = setup.looks[i].label.toUpperCase(), bw = ctx.measureText(nm).width + 10
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
      BARS.push(rc)
      drawTag(rc, nm, fsN, colOf(i), i === me, i === me)
      if (import.meta.env.DEV) LAY.bars[i] = rc
    }
    if (clearTag) {
      const po = pose(P[clearer], tk), cx = X(clearer) + po.dx, cy = Y(clearer) - po.lift - (tk / 2 + 5) * po.sc - 2
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
      const fs = Math.round(clamp(k * (f.big ? 3.4 : 2.3), f.big ? 24 : 14, f.big ? 52 : 34))
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
    if (stick.id != null || e.target.closest?.('.btlv-btn')) return
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
  for (const key of ['a', 'b', 'c']) {
    const el = els.btn[key]
    const d = e => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); press(key, true) }
    const u = e => { e.preventDefault(); press(key, false) }
    el.addEventListener('pointerdown', d); el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u)
    btnHandlers.push([el, d, u])
  }
  const KEY = { j: 'a', ' ': 'a', k: 'b', e: 'b', l: 'c', q: 'c', shift: 'c' }
  const DIR = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] }
  const readKeys = () => {
    let x = 0, y = 0
    for (const kk of keys) { const d = DIR[kk]; if (d) { x += d[0]; y += d[1] } }
    const m = Math.hypot(x, y)
    if (stick.id == null) { H.mx = m ? x / m : 0; H.my = m ? y / m : 0 }
  }
  const keyDown = e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const kk = e.key.toLowerCase()
    if (DIR[kk]) { e.preventDefault(); keys.add(kk); readKeys() }
    else if (KEY[kk]) { e.preventDefault(); if (!e.repeat) press(KEY[kk], true) }
  }
  const keyUp = e => {
    const kk = e.key.toLowerCase()
    if (DIR[kk]) { keys.delete(kk); readKeys() } else if (KEY[kk]) press(KEY[kk], false)
  }
  const blur = () => { keys.clear(); readKeys(); for (const key of ['a', 'b', 'c']) press(key, false) }
  const vis = () => { paused = !online && (document.hidden || pausedBy); last = performance.now() }
  let pausedBy = false

  els.pad.addEventListener('pointerdown', padDown); els.pad.addEventListener('pointermove', padMove)
  els.pad.addEventListener('pointerup', padUp); els.pad.addEventListener('pointercancel', padUp)
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
    resync() { NB.wasLive = false; NB.local = null; NB.burst = 0 },
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
    // DEV: let time pass with the game stopped (the meter runs on this device's clock)
    wait(ms) { clockNow += ms; draw(clockNow) },
    draw() { camera(1e6); draw(clockNow) },
    // DEV: frame work (ms) and the gap between frames over the last 240 frames
    perf() { const n = Math.min(pn, 240), a = [...PERF.slice(0, n)].sort((x, y) => x - y), g = [...GAP.slice(0, n)].sort((x, y) => x - y); const q = (v, f) => +v[Math.min(v.length - 1, Math.floor(v.length * f))].toFixed(2); return { frames: n, workAvg: +(a.reduce((x, y) => x + y, 0) / n).toFixed(2), work95: q(a, 0.95), workMax: q(a, 1), gap50: q(g, 0.5), gap95: q(g, 0.95) } },
    destroy() {
      dead = true; cancelAnimationFrame(raf); ro.disconnect()
      els.pad.removeEventListener('pointerdown', padDown); els.pad.removeEventListener('pointermove', padMove)
      els.pad.removeEventListener('pointerup', padUp); els.pad.removeEventListener('pointercancel', padUp)
      window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', vis)
      for (const [el, d, u] of btnHandlers) { el.removeEventListener('pointerdown', d); el.removeEventListener('pointerup', u); el.removeEventListener('pointercancel', u) }
    },
  }
  return api
}
