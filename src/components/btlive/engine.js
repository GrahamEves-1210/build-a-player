// BLACKTOP LIVE, the screen's engine: runs the simulation (lib/btlive) at 30 ticks a second, draws it at the
// display's rate with the positions eased between ticks, reads the stick and the buttons, times the shot meter on
// this device, and turns what happened into sound, haptics and the rare animations. No React in here and no
// React state per frame: it draws on a canvas and writes the few bits of the HUD that change straight to the DOM.
import { createGame, step, cpuInput, passTarget, meterQuality, meterGrade, HZ, COURT, T } from '../../lib/btlive/index.js'
import { sfx, haptic } from '../../lib/juice'

const STEP = 1000 / HZ
const FONT = '"BAP Bebas", "Bebas Neue", "BAP Anton", Impact, sans-serif'
const TEAM = ['#4da3ff', '#ff4d5e']          // Blacktop's two sides (AppBlacktop TEAM_COLORS)
const GREEN = '#3ddc84', AMBER = '#f2b33d', RED = '#ff5a5a', FLOOD = '#fff0cf'
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const reduced = () => document.documentElement.classList.contains('bap-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// setup: { teams, levels (per player: a CPU level, null for the person), me (index), looks (per player:
//          { label, photo, faceCenter }), seed }
// els:   { canvas, court, clock, score: [el, el], poss: [el, el], pad, base, knob, btn: { a, b, c }, lab: { a, b, c } }
// on:    { final(result) }
export function createEngine({ setup, els, on }) {
  const ctx = els.canvas.getContext('2d')
  let s = createGame({ teams: setup.teams, seed: setup.seed })
  const me = setup.me
  const levels = setup.levels.slice()
  const N = s.players.length
  const prev = new Float32Array(N * 2), prevBall = [0, 0, 0]
  const inputs = []
  const fx = []                                   // { text, x, y, t0, dur, color, big } and { rim, t0, dur }
  const imgs = setup.looks.map(l => { if (!l.photo) return null; const im = new Image(); im.src = l.photo; return im })
  let w = 0, h = 0, k = 1, dpr = 1
  let raf = 0, last = 0, acc = 0, paused = false, dead = false, clockNow = 0
  let lastDribble = 0, shown = { clock: null, s0: null, s1: null, poss: null, mode: null, gp: false }
  // the person's hands: the stick, the three buttons (down now / tapped since the last tick / must be let go first)
  const H = { mx: 0, my: 0, a: false, b: false, c: false, ta: false, tb: false, tc: false, na: false, nb: false, nc: false, aT0: 0, aUp: 0 }
  // the shot meter, timed on this device
  const meter = { on: false, t0: 0, spec: null, read: 0, q: null, grade: null, gradeAt: 0, gradeGood: false }
  const keys = new Set()

  function resize() {
    const r = els.court.getBoundingClientRect()
    dpr = Math.min(3, window.devicePixelRatio || 1)
    w = r.width; h = r.height; k = w / COURT.W
    els.canvas.width = Math.round(w * dpr); els.canvas.height = Math.round(h * dpr)
  }

  // ── what happened this tick: sound, haptics, the words and the rare animations ──────────────────
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
        say(word, COURT.rim.x, COURT.rim.y + 5, e.poster || e.deep ? FLOOD : TEAM[p.team], e.kind === 'dunk' || e.pts === 2, 1300)
        fx.push({ rim: e.kind === 'dunk' ? 'dunk' : 'make', t0: clockNow, dur: e.kind === 'dunk' ? 520 : 300 })
        if (e.kind === 'dunk') kick(e.poster ? 1.6 : 1)
      } else if (e.e === 'miss') { sfx('rimmiss'); fx.push({ rim: 'miss', t0: clockNow, dur: 260 }) }
      else if (e.e === 'block') { sfx('lock'); haptic('heavy'); say(e.chase ? 'CHASE-DOWN' : 'BLOCKED', p.x, p.y - 3, TEAM[p.team], true); kick(1) }
      else if (e.e === 'steal') { sfx('catchball'); haptic('medium'); say('STEAL', p.x, p.y - 3, TEAM[p.team]) }
      else if (e.e === 'pick') { sfx('catchball'); haptic('medium'); say('PICKED OFF', p.x, p.y - 3, TEAM[p.team]) }
      else if (e.e === 'catch') sfx('catchball')
      else if (e.e === 'board') { sfx('catchball'); if (e.pid === me) haptic('light') }
      else if (e.e === 'move') { if (e.ankles) { haptic('heavy'); say('ANKLES', P[e.def].x, P[e.def].y - 3, FLOOD, true, 1400) } else if (e.pid === me) haptic('light') }
      else if (e.e === 'swipe') { if (e.pid === me) { haptic('light'); if (e.reach) say('REACH', p.x, p.y - 3, 'rgba(255,255,255,.8)') } }
      else if (e.e === 'oob') { sfx('whistle'); say('OUT OF BOUNDS', COURT.rim.x, 22, '#fff') }
      else if (e.e === 'clock') { sfx('whistle'); say('SHOT CLOCK', COURT.rim.x, 22, '#fff') }
      else if (e.e === 'check') { say('CHECK BALL', COURT.rim.x, 37.6, 'rgba(255,255,255,.75)', false, 900); H.na = H.a; H.nb = H.b; H.nc = H.c }
      else if (e.e === 'release') { if (e.pid === me) haptic('light') }
      else if (e.e === 'final') {
        const won = e.winner === s.players[me].team
        sfx(won ? 'award' : 'deny'); if (won) haptic('success')
        on.final?.({ winner: e.winner, score: e.score, stats: s.stats.map(x => ({ ...x })), won })
      }
    }
    if (s.gamePoint && !shown.gp && s.phase !== 'over') { shown.gp = true; say('GAME POINT', COURT.rim.x, 26, FLOOD, true, 1500) }
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
    // my meter: it starts when the simulation says the shot has started, on the clock of the press
    const p = P[me]
    if (p.act === 'gather' && !meter.on && !levels[me]) {
      meter.on = true; meter.spec = p.shot.spec; meter.read = p.shot.read; meter.q = null; meter.grade = null
      meter.t0 = clockNow - H.aT0 < 220 ? H.aT0 : clockNow - STEP
      if (!H.a && H.aUp >= H.aT0) letGo(H.aUp)                    // pressed and let go inside one tick
    } else if (p.act !== 'gather' && meter.on) {
      meter.on = false
      if (!meter.grade) { meter.grade = 'LATE'; meter.gradeGood = false; meter.gradeAt = clockNow }   // held past the end
    }
    const b = s.ball
    if (s.phase === 'live' && b.st === 'held' && clockNow - lastDribble > 330) {
      const hp = P[b.holder]
      if (hp.act === 'free' && Math.hypot(hp.vx, hp.vy) > 2.5) { sfx('dribble'); lastDribble = clockNow }
    }
    hud()
  }
  function letGo(at) {
    if (!meter.on || meter.grade) return
    const held = at - meter.t0
    meter.q = meterQuality(meter.spec, held); meter.grade = meterGrade(meter.spec, held); meter.gradeGood = meter.q >= 1; meter.gradeAt = at
  }

  // ── the HUD: only what changed, straight to the DOM ─────────────────────────────────────────────
  function hud() {
    const p = s.players[me], b = s.ball
    const sec = s.phase === 'live' ? Math.ceil(s.clock / HZ) : null
    if (sec !== shown.clock) { shown.clock = sec; els.clock.textContent = sec == null ? '' : String(sec); els.clock.classList.toggle('is-low', sec != null && sec <= 3) }
    if (s.score[0] !== shown.s0) { shown.s0 = s.score[0]; els.score[0].textContent = String(s.score[0]) }
    if (s.score[1] !== shown.s1) { shown.s1 = s.score[1]; els.score[1].textContent = String(s.score[1]) }
    if (s.poss !== shown.poss) { shown.poss = s.poss; els.poss[0].classList.toggle('is-on', s.poss === 0); els.poss[1].classList.toggle('is-on', s.poss === 1) }
    const has = b.st === 'held' && b.holder === me, up = b.st === 'shot' || b.st === 'loose'
    const mode = has ? 'ball' : p.team === s.poss ? (up ? 'board' : 'off') : (up ? 'dboard' : 'def')
    if (mode !== shown.mode) {
      shown.mode = mode
      const set = (key, text) => { els.lab[key].textContent = text || ''; els.btn[key].classList.toggle('is-off', !text) }
      set('a', mode === 'ball' ? 'SHOOT' : mode === 'def' ? 'STEAL' : '')
      set('b', mode === 'ball' ? (s.size > 1 ? 'PASS' : '') : mode === 'off' ? (s.size > 1 ? 'CALL' : '') : 'JUMP')
      set('c', mode === 'ball' ? 'MOVE' : '')
    }
    // cooldowns dim their button
    const cdA = mode === 'def' ? p.stealCd > 0 : false, cdC = mode === 'ball' ? p.moveCd > 0 : false
    if (els.btn.a.classList.contains('is-cd') !== cdA) els.btn.a.classList.toggle('is-cd', cdA)
    if (els.btn.c.classList.contains('is-cd') !== cdC) els.btn.c.classList.toggle('is-cd', cdC)
  }

  // ── drawing ─────────────────────────────────────────────────────────────────────────────────────
  const rr = (x, y, ww, hh, r) => { ctx.beginPath(); ctx.roundRect(x, y, ww, hh, r) }
  function drawPlayer(i, x, y, tk, now) {
    const p = s.players[i], look = setup.looks[i], col = TEAM[p.team]
    const has = s.ball.st === 'held' && s.ball.holder === i
    let lift = 0, rot = 0, sc = 1, dx = 0
    if (p.act === 'jump') lift = Math.sin(Math.PI * clamp(p.actT / (T.jumpTime * HZ), 0, 1)) * tk * 0.42
    else if (p.act === 'gather' && p.shot.kind === 'jumper') lift = clamp(p.actT / 15, 0, 1) * tk * 0.22
    else if (p.act === 'down') { rot = (p.team === 0 ? 1 : -1) * 1.35 * clamp(p.actT / 5, 0, 1); sc = 0.86 }           // sat down: on his back
    else if (p.act === 'frozen' && p.actT < 6 && !reduced()) dx = Math.sin(p.actT * 2.4) * tk * 0.07
    // contact shadow
    ctx.fillStyle = 'rgba(0,0,0,.42)'
    ctx.beginPath(); ctx.ellipse(x, y + tk * 0.5, tk * 0.56 * (1 - lift / tk * 0.5), tk * 0.2, 0, 0, 6.283); ctx.fill()
    ctx.save()
    ctx.translate(x + dx, y - lift)
    if (rot) { ctx.translate(0, tk * 0.2); ctx.rotate(rot) }
    if (sc !== 1) ctx.scale(sc, sc)
    const r = tk * 0.3, o = -tk / 2
    // the rings: dark edge, the side's colour (white inside it with the ball)
    rr(o - 3.5, o - 3.5, tk + 7, tk + 7, r + 3.5); ctx.fillStyle = 'rgba(5,7,10,.9)'; ctx.fill()
    rr(o - 2.2, o - 2.2, tk + 4.4, tk + 4.4, r + 2.2); ctx.fillStyle = col; ctx.fill()
    if (has) { rr(o - 0.6, o - 0.6, tk + 1.2, tk + 1.2, r + 0.6); ctx.fillStyle = '#fff'; ctx.fill() }
    // the portrait on its base
    rr(o + (has ? 1.2 : 0), o + (has ? 1.2 : 0), tk - (has ? 2.4 : 0), tk - (has ? 2.4 : 0), r); ctx.save(); ctx.clip()
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
    void now
  }
  // the name bars go on after every portrait, so a name is never under another player
  function drawName(i, x, y, tk) {
    const p = s.players[i], look = setup.looks[i], col = TEAM[p.team]
    const fs = Math.max(9, Math.round(tk * 0.4))
    ctx.font = `${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const name = look.label.toUpperCase(), tw = ctx.measureText(name).width
    const py = y + tk * 0.5 + 4 + fs * 0.62
    rr(x - tw / 2 - 4, py - fs * 0.62, tw + 8, fs * 1.24, 2); ctx.fillStyle = 'rgba(5,7,10,.82)'; ctx.fill()
    ctx.fillStyle = col; ctx.fillRect(x - tw / 2 - 4, py - fs * 0.62, 2, fs * 1.24)
    ctx.fillStyle = i === me ? '#fff' : 'rgba(243,246,248,.86)'; ctx.fillText(name, x + 1, py + 0.5)
  }
  function drawBall(x, y, z, now) {
    const r = Math.max(4.5, k * 0.78) * (1 + z * 0.025)
    const gy = y                                                     // where it is over the floor
    ctx.fillStyle = `rgba(0,0,0,${clamp(0.5 - z * 0.025, 0.14, 0.5)})`
    ctx.beginPath(); ctx.ellipse(x, gy + r * 0.5, r * (1 + z * 0.02), r * 0.42, 0, 0, 6.283); ctx.fill()
    const by = gy - z * k * 0.42
    ctx.beginPath(); ctx.arc(x, by, r, 0, 6.283); ctx.fillStyle = '#e9772c'; ctx.fill()
    ctx.lineWidth = Math.max(1, r * 0.14); ctx.strokeStyle = '#4a1e08'
    ctx.beginPath(); ctx.moveTo(x - r, by); ctx.lineTo(x + r, by); ctx.moveTo(x, by - r); ctx.lineTo(x, by + r); ctx.stroke()
    ctx.beginPath(); ctx.arc(x, by, r, 0, 6.283); ctx.strokeStyle = '#2a1004'; ctx.stroke()
    void now
  }
  function drawMeter(i, x, y, tk, now) {
    const p = s.players[i], mine = i === me && !levels[me]
    const spec = p.shot.spec
    const held = mine && meter.on ? (meter.grade ? meter.gradeAt : now) - meter.t0 : (p.actT + acc / STEP) * STEP
    const f = clamp(held / spec.total, 0, 1)
    const bw = mine ? Math.max(12, tk * 0.34) : Math.max(6, tk * 0.2), bh = mine ? Math.max(66, tk * 2.6) : Math.max(34, tk * 1.5)
    // on the side away from the man guarding him, so it's never under a defender
    let side = p.x > 44 ? -1 : 1
    if (p.x > 12 && p.x <= 44) { let nd = 99; for (const o of s.players) if (o.team !== p.team) { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < nd) { nd = d; side = o.x > p.x ? -1 : 1 } } }
    const bx = x + side * (tk * 0.5 + 10) - (side < 0 ? bw : 0), by = y - bh * 0.62
    if (mine) { meter.gx = side > 0 ? bx + bw + 6 : bx - 6; meter.gy = by + bh * 0.3; meter.gside = side }
    rr(bx - 2, by - 2, bw + 4, bh + 4, 3); ctx.fillStyle = 'rgba(5,7,10,.9)'; ctx.fill()
    ctx.fillStyle = '#1c242e'; ctx.fillRect(bx, by, bw, bh)
    if (mine) {
      // the green window
      const lo = clamp((spec.ideal - spec.win) / spec.total, 0, 1), hi = clamp((spec.ideal + spec.win) / spec.total, 0, 1)
      ctx.fillStyle = GREEN; ctx.globalAlpha = 0.9; ctx.fillRect(bx, by + bh * (1 - hi), bw, Math.max(3, bh * (hi - lo))); ctx.globalAlpha = 1
    }
    const inWin = mine && Math.abs(held - spec.ideal) <= spec.win
    ctx.fillStyle = mine ? (inWin ? '#eafff2' : '#fff') : 'rgba(255,255,255,.8)'
    ctx.fillRect(bx + (mine ? bw * 0.28 : 0), by + bh * (1 - f), mine ? bw * 0.44 : bw, bh * f)
    if (mine) {
      // the line it has to reach, and how open he is (as well as his IQ reads it)
      ctx.fillStyle = '#fff'; ctx.fillRect(bx - 3, by + bh * (1 - spec.ideal / spec.total) - 0.75, bw + 6, 1.5)
      const read = ['OPEN', 'CONTESTED', 'SMOTHERED'][meter.read], fs = Math.max(9, Math.round(tk * 0.36))
      ctx.font = `${fs}px ${FONT}`; ctx.textAlign = side > 0 ? 'left' : 'right'; ctx.textBaseline = 'middle'
      const tx = side > 0 ? bx + bw + 6 : bx - 6
      ctx.fillStyle = 'rgba(5,7,10,.82)'; const tw = ctx.measureText(read).width
      ctx.fillRect(side > 0 ? tx - 3 : tx - tw - 3, by + bh - fs * 1.15, tw + 6, fs * 1.2)
      ctx.fillStyle = [GREEN, AMBER, RED][meter.read]; ctx.fillText(read, tx, by + bh - fs * 0.5)
    }
  }
  function draw(now) {
    const a = clamp(acc / STEP, 0, 1), P = s.players
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const tk = clamp(k * T.radius * 2, 18, 52)                       // a dot is as big as the body the game collides
    const X = i => (prev[i * 2] + (P[i].x - prev[i * 2]) * a) * k, Y = i => (prev[i * 2 + 1] + (P[i].y - prev[i * 2 + 1]) * a) * k
    const b = s.ball
    // the rim taking a make, a miss, a dunk
    for (const f of fx) {
      if (!f.rim) continue
      const t = (now - f.t0) / f.dur
      if (t < 0 || t > 1) continue
      const rx = COURT.rim.x * k, ry = COURT.rim.y * k, r0 = k * 0.95
      const wob = f.rim === 'make' || reduced() ? 0 : Math.sin(t * 22) * (1 - t) * (f.rim === 'dunk' ? k * 0.5 : k * 0.22)
      ctx.lineWidth = Math.max(2, k * 0.26); ctx.strokeStyle = f.rim === 'make' ? `rgba(255,255,255,${0.9 * (1 - t)})` : `rgba(240,120,50,${1 - t * 0.5})`
      ctx.beginPath(); ctx.arc(rx + wob, ry + wob * 0.4, r0 * (f.rim === 'make' ? 1 - t * 0.45 : 1), 0, 6.283); ctx.stroke()
    }
    // under the player you control, and under the teammate the stick points at
    if (s.phase !== 'over') {
      const mx = X(me), my = Y(me)
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.85)'
      ctx.beginPath(); ctx.ellipse(mx, my + tk * 0.42, tk * 0.86, tk * 0.4, 0, 0, 6.283); ctx.stroke()
      if (s.size > 1 && b.st === 'held' && b.holder === me && s.phase === 'live' && !levels[me]) {
        const to = passTarget(s, me, H.mx, H.my)
        if (to >= 0) {
          const tx = X(to), ty = Y(to)
          ctx.setLineDash([5, 4]); ctx.strokeStyle = TEAM[P[me].team]; ctx.lineWidth = 2
          ctx.beginPath(); ctx.ellipse(tx, ty + tk * 0.42, tk * 0.86, tk * 0.4, 0, 0, 6.283); ctx.stroke(); ctx.setLineDash([])
        }
      }
    }
    // players, the far ones first
    const order = P.map((_, i) => i).sort((i, j) => P[i].y - P[j].y)
    for (const i of order) drawPlayer(i, X(i), Y(i), tk, now)
    for (const i of order) drawName(i, X(i), Y(i), tk)
    // the ball: in a hand it bounces as he goes and rises with the shot; in the air it's where the game says
    if (b.st === 'held') {
      const hp = P[b.holder], hx = X(b.holder), hy = Y(b.holder)
      let z = 0
      if (hp.act === 'gather') z = 2 + clamp(hp.actT / 12, 0, 1) * 5
      else if (s.phase === 'live' && Math.hypot(hp.vx, hp.vy) > 1) z = Math.abs(Math.sin(now / 165)) * 2.6
      else z = 1.2
      drawBall(hx + hp.fx * tk * 0.52, hy + hp.fy * tk * 0.52 + tk * 0.1, z, now)
    } else drawBall((prevBall[0] + (b.x - prevBall[0]) * a) * k, (prevBall[1] + (b.y - prevBall[1]) * a) * k, prevBall[2] + (b.z - prevBall[2]) * a, now)
    // meters
    for (let i = 0; i < N; i++) if (P[i].act === 'gather' && P[i].shot && s.phase === 'live') drawMeter(i, X(i), Y(i), tk, now)
    // how the release was
    if (meter.grade && now - meter.gradeAt < 1000) {
      const fs = Math.max(13, Math.round(tk * 0.56)), t = (now - meter.gradeAt) / 1000
      ctx.font = `${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1
      // where the meter was (that's where he's looking)
      const tw = ctx.measureText(meter.grade).width
      const gx = clamp((meter.gx ?? X(me)) + (meter.gside ?? 0) * tw / 2, tw / 2 + 8, w - tw / 2 - 8), gy = clamp(meter.gy ?? Y(me) - tk, fs, h - fs)
      ctx.fillStyle = 'rgba(5,7,10,.86)'; ctx.fillRect(gx - tw / 2 - 5, gy - fs * 0.62, tw + 10, fs * 1.24)
      ctx.fillStyle = meter.gradeGood ? GREEN : '#fff'; ctx.fillText(meter.grade, gx, gy + 0.5)
      ctx.globalAlpha = 1
    }
    // the words
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]
      if (now - f.t0 > f.dur) { fx.splice(i, 1); continue }
      if (!f.text) continue
      const t = (now - f.t0) / f.dur
      const fs = Math.round(clamp(k * (f.big ? 4.6 : 2.9), f.big ? 26 : 15, f.big ? 64 : 40))
      ctx.font = `${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const tw = ctx.measureText(f.text).width
      const x = clamp(f.x * k, tw / 2 + 8, w - tw / 2 - 8), y = clamp(f.y * k - (reduced() ? 0 : t * 8), fs, h - fs)
      ctx.globalAlpha = t < 0.08 ? t / 0.08 : t > 0.75 ? (1 - t) / 0.25 : 1
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, fs * 0.16); ctx.strokeStyle = 'rgba(5,7,10,.92)'; ctx.strokeText(f.text, x, y)
      ctx.fillStyle = f.color; ctx.fillText(f.text, x, y)
      ctx.globalAlpha = 1
    }
  }

  function frame(t) {
    if (dead) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min(120, t - last); last = t
    if (!paused) {
      clockNow += dt; acc += dt
      let n = 0
      while (acc >= STEP && n++ < 5) { tick(); acc -= STEP }
      if (acc >= STEP) acc = 0
    }
    draw(clockNow)
  }

  // ── the stick (it appears where the thumb lands) and the buttons ────────────────────────────────
  const stick = { id: null, ox: 0, oy: 0, rect: null }
  const R = 46
  const setKnob = (ox, oy, dx, dy, on) => {
    els.base.style.transform = `translate(${ox}px, ${oy}px)`; els.knob.style.transform = `translate(${ox + dx}px, ${oy + dy}px)`
    els.base.classList.toggle('is-on', on); els.knob.classList.toggle('is-on', on)
  }
  const padDown = e => {
    if (stick.id != null || e.target.closest?.('.btl-btn')) return
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
  const padUp = e => {
    if (e.pointerId !== stick.id) return
    stick.id = null; H.mx = H.my = 0
    const r = els.pad.getBoundingClientRect()
    setKnob(r.width * 0.25, r.height - 150, 0, 0, false)             // back to its resting place
  }
  // the moment of a press, on the game's clock but to the millisecond (not to the frame): the meter is timed with it
  const stamp = () => clockNow + (paused ? 0 : clamp(performance.now() - last, 0, 60))
  const press = (key, down) => {
    if (down) {
      if (H[key]) return
      H[key] = true; H['t' + key] = true; H['n' + key] = false
      if (key === 'a') H.aT0 = stamp()
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
  const vis = () => { paused = document.hidden || pausedBy; last = performance.now() }
  let pausedBy = false

  els.pad.addEventListener('pointerdown', padDown); els.pad.addEventListener('pointermove', padMove)
  els.pad.addEventListener('pointerup', padUp); els.pad.addEventListener('pointercancel', padUp)
  window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('blur', blur)
  document.addEventListener('visibilitychange', vis)
  const ro = new ResizeObserver(resize); ro.observe(els.court)
  resize()
  { const r = els.pad.getBoundingClientRect(); setKnob(r.width * 0.25, r.height - 150, 0, 0, false) }
  document.fonts?.load?.(`16px ${FONT}`).catch(() => {})
  for (let i = 0; i < N; i++) { prev[i * 2] = s.players[i].x; prev[i * 2 + 1] = s.players[i].y }
  hud()
  for (const e of s.events) if (e.e === 'check') say('CHECK BALL', COURT.rim.x, 37.6, 'rgba(255,255,255,.75)', false, 900)
  last = performance.now()
  raf = requestAnimationFrame(frame)

  const api = {
    get state() { return s },
    me,
    pause(on = true) { pausedBy = on; paused = on || document.hidden; last = performance.now() },
    // DEV: the CPU plays the person's player (a level name), or hands him back (null)
    auto(level) { levels[me] = level || null },
    // DEV: run n ticks right now (no waiting), or until fn(state) is true
    run(n = 1, until = null) { let i = 0; for (; i < n; i++) { clockNow += STEP; tick(); if (until && until(s)) break } acc = 0; draw(clockNow); return i },
    press, stick(x, y) { H.mx = x; H.my = y },
    // DEV: let time pass with the game stopped (the meter runs on this device's clock)
    wait(ms) { clockNow += ms; draw(clockNow) },
    draw() { draw(clockNow) },
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
