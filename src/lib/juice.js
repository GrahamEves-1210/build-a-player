// App-only "juice": synthesized sound effects, haptics and confetti.
// Started from main.jsx when IS_APP. It reacts to what's on screen (taps on
// game buttons, a reel locking, an award / title reveal) instead of being
// wired into game code, so removing this file removes the whole layer.
// Sounds are generated with Web Audio — no audio files. Mute: More → Sound.

const MUTE_KEY = 'bap_sound_off'
export const isMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false } }
export const setMuted = on => { try { on ? localStorage.setItem(MUTE_KEY, '1') : localStorage.removeItem(MUTE_KEY) } catch {} }

// ── Sound ────────────────────────────────────────────────────────────────────
// Everything is layered from oscillators, filtered noise and FM "bells", with a
// short convolution reverb, into one compressor. The palette is a stadium's:
// ratchet reels, a metal clank when a reel locks, the referee's whistle when
// the season starts, brass fanfares with the crowd behind them, an air horn
// and the roar for a title, coin chimes for rewards.
let ctx = null, bus = null
const audio = () => {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { return null }
    bus = makeBus(ctx)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}
function makeBus(ac) {
  const comp = ac.createDynamicsCompressor()
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2
  const master = ac.createGain(); master.gain.value = 0.9
  comp.connect(master).connect(ac.destination)
  return comp
}

// Per-context cached buffers: 2s of white noise, and a 1.6s reverb impulse
const noiseBufs = new WeakMap(), impulses = new WeakMap()
function noiseBuffer(ac) {
  let b = noiseBufs.get(ac)
  if (b) return b
  b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  noiseBufs.set(ac, b)
  return b
}
function impulse(ac) {
  let b = impulses.get(ac)
  if (b) return b
  const len = Math.floor(ac.sampleRate * 1.6)
  b = ac.createBuffer(2, len, ac.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6)
  }
  impulses.set(ac, b)
  return b
}

// A "scene": the context, where to connect, and when to start
const scene = (ac, out, t) => ({ ac, out, t })
const MIN = 0.0001
// Attack → peak, then exponential decay to the release point, then out
function envelope(g, t, peak, { a = 0.005, h = 0, d = 0.1, sus = 0, r = 0.05 } = {}) {
  g.gain.setValueAtTime(MIN, t)
  g.gain.exponentialRampToValueAtTime(Math.max(MIN, peak), t + a)
  if (h) g.gain.setValueAtTime(Math.max(MIN, peak), t + a + h)
  g.gain.exponentialRampToValueAtTime(Math.max(MIN, sus ? peak * sus : MIN), t + a + h + d)
  if (sus) g.gain.exponentialRampToValueAtTime(MIN, t + a + h + d + r)
  return t + a + h + d + (sus ? r : 0)
}
function filt(ac, type, f, q = 1) { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n }
function chain(nodes, out) { nodes.reduce((a, b) => (a.connect(b), b)).connect(out); return nodes[nodes.length - 1] }

// Reverb send: anything connected to the returned node plays dry and also
// gets a wet tail
function verb(S, wet = 0.3) {
  const send = S.ac.createGain()
  const cv = S.ac.createConvolver(); cv.buffer = impulse(S.ac)
  const g = S.ac.createGain(); g.gain.value = wet
  send.connect(S.out)
  send.connect(cv); cv.connect(g).connect(S.out)
  return send
}

function osc(S, { type = 'sine', f = 440, to = null, dur = 0.1, gain = 0.1, at = 0, detune = 0, lp = null, q = 1, env = {}, out = S.out, vib = 0, vibHz = 5.5 }) {
  const { ac } = S, t = S.t + at
  const o = ac.createOscillator(), g = ac.createGain()
  o.type = type; o.detune.value = detune
  o.frequency.setValueAtTime(f, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
  if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = vibHz; lg.gain.value = vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.3) }
  const end = envelope(g, t, gain, { d: dur, ...env })
  chain(lp ? [o, filt(ac, 'lowpass', lp, q), g] : [o, g], out)
  o.start(t); o.stop(end + 0.05)
}
function noise(S, { dur = 0.1, gain = 0.1, at = 0, bp = null, hp = null, lp = null, q = 1, to = null, env = {}, out = S.out }) {
  const { ac } = S, t = S.t + at
  const src = ac.createBufferSource(); src.buffer = noiseBuffer(ac); src.loop = true
  src.playbackRate.value = 0.7 + Math.random() * 0.6
  const nodes = [src]
  if (hp) nodes.push(filt(ac, 'highpass', hp, q))
  if (lp) nodes.push(filt(ac, 'lowpass', lp, q))
  if (bp) { const b = filt(ac, 'bandpass', bp, q); if (to) b.frequency.exponentialRampToValueAtTime(to, t + dur); nodes.push(b) }
  const g = ac.createGain(); nodes.push(g)
  const end = envelope(g, t, gain, { d: dur, ...env })
  chain(nodes, out)
  src.start(t); src.stop(end + 0.05)
}
// FM bell: a sine carrier whose pitch is shaken by a fading modulator
function bell(S, { f = 880, dur = 0.4, gain = 0.15, at = 0, ratio = 2.01, index = 3, out = S.out }) {
  const { ac } = S, t = S.t + at
  const car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain()
  car.frequency.value = f; mod.frequency.value = f * ratio
  mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(1, t + dur)
  mod.connect(mg).connect(car.frequency)
  const end = envelope(g, t, gain, { a: 0.003, d: dur })
  car.connect(g).connect(out)
  car.start(t); mod.start(t); car.stop(end + 0.05); mod.stop(end + 0.05)
}
// Impact: a low thump plus a short burst of noise
function hit(S, { at = 0, gain = 0.3, out = S.out } = {}) {
  osc(S, { type: 'sine', f: 150, to: 48, dur: 0.18, gain, at, out })
  noise(S, { lp: 2600, dur: 0.05, gain: gain * 0.45, at, out })
}
// Brass-ish note: detuned saws through a lowpass that sits above the note
function brass(S, { f, dur = 0.3, gain = 0.1, at = 0, out = S.out, hold = 0 }) {
  for (const d of [-7, 0, 6]) osc(S, { type: 'sawtooth', f, detune: d, dur, gain: gain / 3, at, lp: f * 4.5, q: 0.8, out, env: { a: 0.03, h: hold, d: dur, sus: 0.6, r: 0.12 } })
}
// Air horn: two notes a fourth apart, a touch of vibrato, long release
function horn(S, { f = 233, dur = 0.8, gain = 0.18, at = 0, out = S.out }) {
  for (const [ff, dt] of [[f, -6], [f, 5], [f * 1.335, 0]]) {
    osc(S, { type: 'sawtooth', f: ff, detune: dt, dur, gain: gain / 3, at, lp: 1500, q: 1.2, out, vib: 5, vibHz: 5.2, env: { a: 0.06, h: dur * 0.65, d: dur * 0.35, sus: 0.5, r: 0.18 } })
  }
}
// Crowd: band-limited noise that swells and settles
function crowd(S, { dur = 1.6, gain = 0.2, at = 0, out = S.out }) {
  noise(S, { bp: 520, q: 0.5, dur, gain, at, out, env: { a: dur * 0.35, d: dur * 0.65 } })
  noise(S, { bp: 1800, q: 0.7, dur, gain: gain * 0.35, at: at + 0.05, out, env: { a: dur * 0.3, d: dur * 0.7 } })
}
// Referee's whistle: two close sines with the pea rattling the pitch
function whistle(S, { at = 0, dur = 0.42, gain = 0.2, out = S.out } = {}) {
  osc(S, { type: 'sine', f: 3150, dur, gain, at, out, vib: 110, vibHz: 38, env: { a: 0.015, h: dur * 0.6, d: dur * 0.4, sus: 0.7, r: 0.06 } })
  osc(S, { type: 'sine', f: 3440, dur, gain: gain * 0.4, at, out, vib: 90, vibHz: 41, env: { a: 0.015, h: dur * 0.6, d: dur * 0.4, sus: 0.7, r: 0.06 } })
  noise(S, { bp: 3300, q: 2, dur, gain: gain * 0.25, at, out, env: { a: 0.01, h: dur * 0.6, d: dur * 0.4, sus: 0.5, r: 0.06 } })
}

const SFX = {
  // soft "thock"
  tap: S => { osc(S, { f: 210, to: 110, dur: 0.06, gain: 0.1 }); noise(S, { hp: 3200, dur: 0.012, gain: 0.05 }) },
  // reel ratchet
  tick: S => { noise(S, { bp: 2300 + Math.random() * 700, q: 7, dur: 0.02, gain: 0.3 }); osc(S, { type: 'square', f: 3000, dur: 0.008, gain: 0.035 }) },
  // reel lock: ka-chunk + a metal ring
  lock: S => { const v = verb(S, 0.35); hit(S, { gain: 0.32 }); bell(S, { f: 760, ratio: 3.52, index: 7, dur: 0.38, gain: 0.16, at: 0.015, out: v }); bell(S, { f: 760, ratio: 3.52, index: 7, dur: 0.3, gain: 0.1, at: 0.015 }); noise(S, { bp: 5200, q: 4, dur: 0.03, gain: 0.07, at: 0.012 }) },
  // sheet / screen opens: whoosh
  pop: S => noise(S, { bp: 480, to: 2600, q: 1.1, dur: 0.24, gain: 0.26, env: { a: 0.04, d: 0.2 } }),
  // the last trait drops in: rising power-up into a hit
  complete: S => {
    const v = verb(S, 0.35)
    for (const [f, d] of [[196, -5], [246.9, 0], [293.7, 5]]) {
      osc(S, { type: 'sawtooth', f, detune: d, dur: 0.58, gain: 0.05, lp: 320, q: 2, out: v, env: { a: 0.05, d: 0.58 } })
    }
    // the rise: a brighter layer fading in over the dark one
    for (const f of [392, 493.9, 587.3]) osc(S, { type: 'sawtooth', f, dur: 0.5, gain: 0.045, at: 0.12, lp: 4200, q: 0.9, out: v, env: { a: 0.3, d: 0.25 } })
    hit(S, { at: 0.56, gain: 0.26 })
    bell(S, { f: 1568, ratio: 2.0, index: 2.5, dur: 0.6, gain: 0.14, at: 0.56, out: v })
  },
  // season kicks off
  whistle: S => whistle(S, { gain: 0.11 }),
  // award reveal: short brass fanfare, crowd behind it
  award: S => {
    const v = verb(S, 0.4)
    crowd(S, { dur: 1.8, gain: 0.16, at: 0.1 })
    for (const [f, at] of [[523.3, 0], [659.3, 0.13], [784, 0.26]]) brass(S, { f, dur: 0.18, gain: 0.14, at, out: v })
    brass(S, { f: 1046.5, dur: 0.75, gain: 0.17, at: 0.4, hold: 0.3, out: v })
    bell(S, { f: 2093, ratio: 2.0, index: 2, dur: 0.7, gain: 0.07, at: 0.42, out: v })
  },
  // a title: air horn, cymbal, the roar
  champion: S => {
    const v = verb(S, 0.45)
    hit(S, { gain: 0.4 })
    noise(S, { hp: 5000, dur: 0.9, gain: 0.11, at: 0.02, out: v, env: { a: 0.005, d: 0.9 } })
    horn(S, { f: 233, dur: 0.85, gain: 0.2, at: 0.05, out: v })
    horn(S, { f: 233, dur: 0.5, gain: 0.17, at: 1.05, out: v })
    crowd(S, { dur: 2.8, gain: 0.26, at: 0.04 })
  },
  // level up: fanfare a fourth higher, with a shimmer on top
  levelup: S => {
    const v = verb(S, 0.42)
    crowd(S, { dur: 1.5, gain: 0.11, at: 0.15 })
    for (const [f, at] of [[698.5, 0], [880, 0.12], [1046.5, 0.24]]) brass(S, { f, dur: 0.16, gain: 0.13, at, out: v })
    brass(S, { f: 1396.9, dur: 0.7, gain: 0.16, at: 0.38, hold: 0.25, out: v })
    for (const [f, at] of [[2093, 0.5], [2637, 0.58], [3136, 0.66], [4186, 0.74]]) bell(S, { f, ratio: 2.0, index: 1.8, dur: 0.5, gain: 0.06, at, out: v })
  },
  // reward claimed: ka-ching
  claim: S => {
    const v = verb(S, 0.25)
    noise(S, { bp: 6200, q: 5, dur: 0.03, gain: 0.07 })
    bell(S, { f: 1318.5, ratio: 3.0, index: 2.2, dur: 0.28, gain: 0.15, at: 0.01, out: v })
    bell(S, { f: 1760, ratio: 3.0, index: 2.2, dur: 0.42, gain: 0.17, at: 0.1, out: v })
    bell(S, { f: 1760, dur: 0.3, gain: 0.08, at: 0.1 })
  },
  // small good news (streak, mission done)
  chime: S => { const v = verb(S, 0.3); bell(S, { f: 1760, ratio: 2.0, index: 2, dur: 0.35, gain: 0.12, out: v }); bell(S, { f: 2217, ratio: 2.0, index: 2, dur: 0.45, gain: 0.12, at: 0.09, out: v }) },
  // card reveal — more sparkle the rarer it is (0 common … 3 legend)
  card: (S, rank = 0) => {
    noise(S, { bp: 1100, to: 3200, q: 1.4, dur: 0.13, gain: 0.09 })          // the flip
    osc(S, { f: 240, to: 130, dur: 0.05, gain: 0.07 })
    if (rank < 1) return
    const v = verb(S, 0.28 + rank * 0.07)
    const tones = [1568, 1976, 2637, 3136].slice(0, rank + 1)
    tones.forEach((f, i) => bell(S, { f, ratio: 2.0, index: 2, dur: 0.35 + rank * 0.08, gain: 0.1, at: 0.1 + i * 0.075, out: v }))
    if (rank >= 2) for (const f of [392, 493.9]) osc(S, { type: 'sawtooth', f, dur: 0.7, gain: 0.035, at: 0.08, lp: 1300, q: 0.8, out: v, env: { a: 0.12, d: 0.6 } })
    if (rank >= 3) {
      for (const f of [261.6, 329.6, 392]) osc(S, { type: 'sawtooth', f, dur: 1.1, gain: 0.04, at: 0.1, lp: 2600, q: 0.8, out: v, env: { a: 0.2, d: 0.9 } })
      crowd(S, { dur: 1.3, gain: 0.08, at: 0.2 })
    }
  },
}
export const sfx = (name, arg) => {
  if (isMuted()) return
  const ac = audio(); if (!ac || !SFX[name]) return
  try { SFX[name](scene(ac, bus, ac.currentTime), arg) } catch {}
}

// Renders one effect offline and reports its level — for checking the mix
// (window.__bapJuice.renderSfx('champion') in the app's web inspector).
export async function renderSfx(name, arg, seconds = 3.5) {
  const ac = new OfflineAudioContext(1, Math.ceil(44100 * seconds), 44100)
  SFX[name](scene(ac, makeBus(ac), 0.02), arg)
  const buf = await ac.startRendering()
  const d = buf.getChannelData(0)
  let peak = 0, sum = 0, last = 0
  for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; if (v > 0.002) last = i }
  return { name, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), seconds: +(last / 44100).toFixed(2) }
}

// ── Haptics ──────────────────────────────────────────────────────────────────
let H = null
import('@capacitor/haptics').then(m => { H = m }).catch(() => {})
export const haptic = kind => {
  if (!H) return
  try {
    if (kind === 'success') H.Haptics.notification({ type: H.NotificationType.Success })
    else H.Haptics.impact({ style: kind === 'heavy' ? H.ImpactStyle.Heavy : kind === 'medium' ? H.ImpactStyle.Medium : H.ImpactStyle.Light })
  } catch {}
}

// ── Confetti ─────────────────────────────────────────────────────────────────
export function confetti(amount = 140) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const c = document.createElement('canvas')
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1300'
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  c.width = innerWidth * dpr; c.height = innerHeight * dpr
  document.body.appendChild(c)
  const g = c.getContext('2d'); g.scale(dpr, dpr)
  // Build-A-Player's own colours: the button gradient, the accent, gold and white
  const css = getComputedStyle(document.documentElement)
  const a1 = css.getPropertyValue('--btn-start').trim() || '#5EDBD8'
  const a2 = css.getPropertyValue('--btn-end').trim() || '#1fc98a'
  const COLORS = [a1, a2, '#D4AF37', '#f2d675', '#ffffff', a1, '#95D5B2']
  const parts = Array.from({ length: amount }, (_, i) => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 60, y: innerHeight * 0.38,
    vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 15 - 5,
    w: 6 + Math.random() * 6, h: 9 + Math.random() * 8,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
    col: COLORS[i % COLORS.length],
  }))
  const start = performance.now()
  const frame = now => {
    const t = now - start
    g.clearRect(0, 0, innerWidth, innerHeight)
    for (const p of parts) {
      p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr
      g.save(); g.translate(p.x, p.y); g.rotate(p.r)
      g.globalAlpha = Math.max(0, 1 - t / 2600)
      g.fillStyle = p.col; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 2)
      g.restore()
    }
    if (t < 2600) requestAnimationFrame(frame); else c.remove()
  }
  requestAnimationFrame(frame)
}

// ── Wiring ───────────────────────────────────────────────────────────────────
const TAP = '.dc-submit-btn, .dc-back-btn, .dc-lb-btn, .ag-btn, .ag-tab, .ag-play, .ag-pos, .ag-mode, .ag-mini, .ag-tile, .ag-chip, .ag-seg button, .ag-set, .ag-tray, .ag-icon-btn, .ag-row-btn, .ag-daily-banner, .ag-milestone, .ag-player-chip, .ag-round-btn, .spin-btn, .spin-respin-half, .spin-reset-circle, .attr-chip, .mtab, .cat-pill, .sim-btn, .simp-cta, .simp-ghost, .mvp-continue, .tpm-tab, .auth-submit, .lb-main-seg-btn, .lb-tab, .lb-view-tab, .lb-metric-tab, .lb-pos-btn'

let ticking = null
function startTicks() {
  stopTicks()
  let gap = 55, elapsed = 0
  const step = () => {
    sfx('tick'); haptic('light')
    elapsed += gap; gap = Math.min(170, gap * 1.07)
    ticking = elapsed < 2600 ? setTimeout(step, gap) : null
  }
  step()
}
function stopTicks() { if (ticking) { clearTimeout(ticking); ticking = null } }

export function initJuice() {
  window.__bapJuice = { sfx, renderSfx }
  // The last trait in: the power-up stinger (confetti is for rings and awards)
  window.addEventListener('bap:build-complete', () => { sfx('complete'); haptic('success') })

  document.addEventListener('pointerdown', e => {
    const el = e.target.closest?.(TAP)
    if (!el || el.disabled) return
    audio()                                   // unlock audio on the first gesture (iOS)
    if (el.matches('.spin-btn, .spin-respin-half')) { sfx('tap'); haptic('medium'); startTicks(); return }
    // "Simulate Season" — the referee starts the game
    if (el.matches('.simp-cta') && /simulate season/i.test(el.textContent)) { sfx('whistle'); haptic('medium'); return }
    sfx('tap'); haptic('light')
  }, { capture: true, passive: true })

  const seen = new WeakSet()
  const celebrate = big => { stopTicks(); sfx(big ? 'champion' : 'award'); haptic('success'); confetti(big ? 200 : 140) }
  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'attributes') {
        const el = m.target
        if (el.classList?.contains('reel-locked') && !(m.oldValue || '').includes('reel-locked')) {
          // the last reel to lock ends the spin
          const reels = document.querySelectorAll('.reel-outer')
          const allLocked = [...reels].every(r => r.classList.contains('reel-locked'))
          if (allLocked) stopTicks()
          sfx('lock'); haptic('heavy')
        }
        continue
      }
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue
        const you = n.matches?.('.mvp-winner-tag--you') ? n : n.querySelector?.('.mvp-winner-tag--you')
        if (you && !seen.has(you)) { seen.add(you); setTimeout(() => celebrate(false), 150) }
        const champ = n.matches?.('.plf-champ-label') ? n : n.querySelector?.('.plf-champ-label')
        if (champ && !seen.has(champ)) { seen.add(champ); setTimeout(() => celebrate(true), 250) }
        if (n.matches?.('.ag-menu-overlay, .auth-overlay, .tpm-overlay, .ag-screen')) sfx('pop')
      }
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true })
}
