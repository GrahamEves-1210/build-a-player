// App-only "juice": synthesized sound effects, haptics and confetti.
// Started from main.jsx when IS_APP. It reacts to what's on screen (taps on
// game buttons, a reel locking, an award / title reveal) instead of being
// wired into game code, so removing this file removes the whole layer.
// Sounds are generated with Web Audio — no audio files. Mute: More → Sound.

import { myVictory } from './progress'

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
    loadSamples(ctx)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}
// Recorded sounds (public/sfx, Kenney CC0, converted to WAV): loaded once on
// the first touch. Every effect below layers these; the synth versions stay as
// the fallback until they've loaded.
const SAMPLE_NAMES = ['tap', 'tap2', 'tick', 'back', 'open', 'close', 'swoosh', 'deny', 'pluck', 'pluck2', 'drop', 'confirm', 'toggle',
  'wood', 'woodl', 'punch', 'punchm', 'thud', 'plank', 'chip', 'chips', 'stack', 'stack2', 'handful', 'slide', 'slide2', 'cardout',
  'hitS', 'hitS2', 'hitM', 'hitM2', 'hitL', 'hitL2', 'hitXL', 'hitXXL', 'sax', 'saxS', 'pizzi']
const buffers = new Map()
let loading = null
function loadSamples(ac) {
  if (loading) return loading
  loading = Promise.all(SAMPLE_NAMES.map(n => fetch(`/sfx/${n}.wav`).then(r => r.arrayBuffer()).then(b => new Promise((res, rej) => ac.decodeAudioData(b, res, rej))).then(buf => buffers.set(n, buf)).catch(() => {})))
  return loading
}
// play a sample inside a scene; false when it isn't loaded (callers fall back)
function smp(S, name, { at = 0, gain = 1, rate = 1, jitter = 0, out = S.out } = {}) {
  const buf = S.ac === ctx ? buffers.get(name) : null
  if (!buf) return false
  const src = S.ac.createBufferSource(), g = S.ac.createGain()
  src.buffer = buf
  src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * jitter)
  g.gain.value = gain
  src.connect(g).connect(out)
  src.start(S.t + at)
  return true
}
const ready = n => buffers.has(n) && !!ctx

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

const SYNTH = {
  // soft "thock"
  tap: S => { osc(S, { f: 210, to: 110, dur: 0.06, gain: 0.1 }); noise(S, { hp: 3200, dur: 0.012, gain: 0.05 }) },
  // reel ratchet
  tick: S => { noise(S, { bp: 2300 + Math.random() * 700, q: 7, dur: 0.02, gain: 0.3 }); osc(S, { type: 'square', f: 3000, dur: 0.008, gain: 0.035 }) },
  // reel lock: ka-chunk — a wood knock with a short, soft ring (no bell)
  lock: S => { hit(S, { gain: 0.3 }); osc(S, { type: 'triangle', f: 540, to: 470, dur: 0.12, gain: 0.11, at: 0.012, lp: 1600, q: 0.9, env: { a: 0.002, d: 0.12 } }); osc(S, { type: 'sine', f: 1080, dur: 0.07, gain: 0.04, at: 0.014, env: { a: 0.002, d: 0.07 } }); noise(S, { bp: 2400, q: 2.5, dur: 0.03, gain: 0.06, at: 0.01 }) },
  // sheet / screen opens: whoosh
  pop: S => noise(S, { bp: 480, to: 2600, q: 1.1, dur: 0.24, gain: 0.26, env: { a: 0.04, d: 0.2 } }),
  // the last trait drops in: a filtered riser that lands on an impact; the
  // tier (0 project … 4 legendary) decides how big the landing is
  complete: (S, tier = 2) => {
    const v = verb(S, 0.38)
    noise(S, { bp: 220, to: 4200, q: 1.1, dur: 0.95, gain: 0.13, env: { a: 0.85, d: 0.1 } })
    osc(S, { f: 46, to: 74, dur: 0.95, gain: 0.16, env: { a: 0.8, d: 0.15 } })
    for (const [f, d] of [[146.8, -6], [220, 0], [293.7, 6]]) osc(S, { type: 'sawtooth', f, to: f * 1.5, detune: d, dur: 0.95, gain: 0.03, lp: 1400, q: 1.4, out: v, env: { a: 0.85, d: 0.1 } })
    const at = 1.0
    hit(S, { at, gain: 0.42 })
    osc(S, { f: 110, to: 34, dur: 0.6, gain: 0.32, at })
    noise(S, { bp: 1800, q: 0.9, dur: 0.14, gain: 0.16, at })
    const chords = [[220, 261.6, 329.6], [261.6, 329.6, 392], [293.7, 370, 440], [329.6, 415.3, 493.9], [392, 493.9, 587.3]]
    for (const f of chords[Math.max(0, Math.min(4, tier))]) brass(S, { f, dur: 0.5 + tier * 0.12, gain: 0.08 + tier * 0.01, at, hold: 0.1 + tier * 0.05, out: v })
    if (tier >= 2) crowd(S, { dur: 1.4 + tier * 0.3, gain: 0.08 + tier * 0.04, at })
    if (tier >= 4) noise(S, { hp: 5200, dur: 1, gain: 0.08, at, out: v, env: { a: 0.004, d: 1 } })
  },
  // season kicks off
  whistle: S => whistle(S, { gain: 0.11 }),
  // award reveal: short brass fanfare, crowd behind it
  award: S => {
    const v = verb(S, 0.4)
    crowd(S, { dur: 1.8, gain: 0.16, at: 0.1 })
    for (const [f, at] of [[523.3, 0], [659.3, 0.13], [784, 0.26]]) brass(S, { f, dur: 0.18, gain: 0.14, at, out: v })
    brass(S, { f: 1046.5, dur: 0.75, gain: 0.17, at: 0.4, hold: 0.3, out: v })
    hit(S, { gain: 0.2, at: 0.4 })
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
    noise(S, { hp: 6000, dur: 0.7, gain: 0.07, at: 0.4, out: v, env: { a: 0.01, d: 0.7 } })
  },
  // reward claimed: ka-ching
  claim: S => {
    const v = verb(S, 0.25)
    hit(S, { gain: 0.16 })
    for (let i = 0; i < 5; i++) osc(S, { type: 'triangle', f: 2000 - i * 120, to: 1600 - i * 120, dur: 0.045, gain: 0.07, at: 0.03 + i * 0.05, env: { a: 0.001, d: 0.045 } })
    for (const f of [523.3, 659.3, 784]) osc(S, { type: 'sawtooth', f, dur: 0.3, gain: 0.03, at: 0.12, lp: 2600, out: v, env: { a: 0.02, d: 0.28 } })
  },
  // small good news (streak, mission done)
  chime: S => { const v = verb(S, 0.25); osc(S, { f: 1318.5, dur: 0.2, gain: 0.08, lp: 2800, out: v, env: { a: 0.003, d: 0.2 } }); osc(S, { f: 1760, dur: 0.26, gain: 0.08, at: 0.09, lp: 3200, out: v, env: { a: 0.003, d: 0.26 } }) },
  // card reveal — more sparkle the rarer it is (0 common … 3 legend)
  card: (S, rank = 0) => {
    noise(S, { bp: 1100, to: 3200, q: 1.4, dur: 0.13, gain: 0.09 })          // the flip
    osc(S, { f: 240, to: 130, dur: 0.05, gain: 0.07 })
    if (rank < 1) return
    const v = verb(S, 0.28 + rank * 0.07)
    const tones = [1568, 1976, 2637, 3136].slice(0, rank + 1)
    tones.forEach((f, i) => osc(S, { type: 'triangle', f: f / 2, dur: 0.12, gain: 0.07, at: 0.1 + i * 0.07, lp: 3200, out: v, env: { a: 0.002, d: 0.12 } }))
    if (rank >= 2) for (const f of [392, 493.9]) osc(S, { type: 'sawtooth', f, dur: 0.7, gain: 0.035, at: 0.08, lp: 1300, q: 0.8, out: v, env: { a: 0.12, d: 0.6 } })
    if (rank >= 3) {
      for (const f of [261.6, 329.6, 392]) osc(S, { type: 'sawtooth', f, dur: 1.1, gain: 0.04, at: 0.1, lp: 2600, q: 0.8, out: v, env: { a: 0.2, d: 0.9 } })
      crowd(S, { dur: 1.3, gain: 0.08, at: 0.2 })
    }
  },

  // ── UI ───────────────────────────────────────────────────────────────────
  // sport switch: a quick swoosh that lands
  swap: S => { noise(S, { bp: 500, to: 2600, q: 1.2, dur: 0.2, gain: 0.2, env: { a: 0.03, d: 0.17 } }); osc(S, { f: 190, to: 95, dur: 0.12, gain: 0.12, at: 0.15 }) },
  // the card turns over
  flip: S => { noise(S, { bp: 900, to: 3200, q: 1.4, dur: 0.16, gain: 0.16, env: { a: 0.02, d: 0.14 } }); osc(S, { f: 260, to: 150, dur: 0.05, gain: 0.06, at: 0.13 }) },
  // something drops into place (a lobby spot, a build slot)
  slot: S => { osc(S, { type: 'triangle', f: 330, to: 190, dur: 0.08, gain: 0.16 }); noise(S, { hp: 4200, dur: 0.012, gain: 0.07 }); osc(S, { f: 95, to: 60, dur: 0.1, gain: 0.12, at: 0.01 }) },
  // no: two short muffled buzzes
  deny: S => { for (const at of [0, 0.09]) osc(S, { type: 'square', f: 150, dur: 0.06, gain: 0.07, at, lp: 900, env: { a: 0.002, d: 0.06 } }) },
  // chat sent: a soft upward blip
  send: S => { osc(S, { f: 520, to: 900, dur: 0.07, gain: 0.08, env: { a: 0.004, d: 0.07 } }); noise(S, { hp: 5000, dur: 0.01, gain: 0.03 }) },
  // coins land: short dull clinks, no ring
  coin: S => { [0, 0.05, 0.11].forEach((at, i) => { osc(S, { type: 'triangle', f: 1900 - i * 160, to: 1500 - i * 160, dur: 0.045, gain: 0.07, at, env: { a: 0.001, d: 0.045 } }); noise(S, { hp: 6500, dur: 0.012, gain: 0.04, at }) }) },
  // bought: the register's ka-chunk, a spill of coins, a small swell
  purchase: S => {
    const v = verb(S, 0.28)
    hit(S, { gain: 0.24 })
    noise(S, { bp: 2400, q: 3, dur: 0.05, gain: 0.08, at: 0.02 })
    for (let i = 0; i < 7; i++) osc(S, { type: 'triangle', f: 2100 - Math.random() * 600, dur: 0.04, gain: 0.05, at: 0.08 + i * 0.045 + Math.random() * 0.02, env: { a: 0.001, d: 0.04 } })
    for (const f of [392, 493.9, 587.3]) osc(S, { type: 'sawtooth', f, dur: 0.42, gain: 0.035, at: 0.18, lp: 2400, q: 0.8, out: v, env: { a: 0.04, d: 0.38 } })
  },
  // put it on: zip + snap
  equip: S => { noise(S, { bp: 2800, to: 5200, q: 2, dur: 0.09, gain: 0.1 }); hit(S, { gain: 0.14, at: 0.09 }); noise(S, { hp: 4500, dur: 0.015, gain: 0.06, at: 0.09 }) },
  // achievement: three rising brass stabs and a small crowd
  achievement: S => {
    const v = verb(S, 0.36)
    crowd(S, { dur: 1.2, gain: 0.08, at: 0.12 })
    ;[[523.3, 0], [659.3, 0.11], [880, 0.22]].forEach(([f, at]) => brass(S, { f, dur: 0.12, gain: 0.11, at, out: v }))
    brass(S, { f: 1046.5, dur: 0.45, gain: 0.13, at: 0.34, hold: 0.12, out: v })
    hit(S, { gain: 0.18, at: 0.34 })
  },
  // a grade pops into the build-complete card; higher grade, higher pitch
  gradepop: (S, val = 5) => { osc(S, { type: 'triangle', f: 380 + val * 42, to: 300 + val * 42, dur: 0.06, gain: 0.08, env: { a: 0.002, d: 0.06 } }); noise(S, { hp: 3800, dur: 0.01, gain: 0.03 }) },
  // the tier stamps down on the build-complete card
  stamp: S => { hit(S, { gain: 0.3 }); noise(S, { bp: 1600, q: 1.4, dur: 0.12, gain: 0.12 }); osc(S, { type: 'triangle', f: 220, to: 180, dur: 0.2, gain: 0.07, at: 0.01 }) },

  // ── Victory sounds (the shop's "Victory Sound" slot) ─────────────────────
  'snd-horn': S => { const v = verb(S, 0.4); hit(S, { gain: 0.34 }); horn(S, { f: 233, dur: 0.8, gain: 0.19, at: 0.04, out: v }); horn(S, { f: 233, dur: 0.48, gain: 0.16, at: 0.98, out: v }); crowd(S, { dur: 2.4, gain: 0.22, at: 0.04 }) },
  'snd-roar': S => { hit(S, { gain: 0.36 }); noise(S, { hp: 5000, dur: 0.8, gain: 0.08, env: { a: 0.005, d: 0.8 } }); crowd(S, { dur: 3.2, gain: 0.34 }); crowd(S, { dur: 2.2, gain: 0.18, at: 0.4 }) },
  'snd-fanfare': S => {
    const v = verb(S, 0.42)
    crowd(S, { dur: 2, gain: 0.14, at: 0.1 })
    ;[[392, 0], [523.3, 0.14], [659.3, 0.28], [784, 0.42]].forEach(([f, at]) => brass(S, { f, dur: 0.16, gain: 0.13, at, out: v }))
    brass(S, { f: 1046.5, dur: 0.9, gain: 0.17, at: 0.56, hold: 0.35, out: v })
    brass(S, { f: 523.3, dur: 0.9, gain: 0.1, at: 0.56, hold: 0.35, out: v })
    hit(S, { gain: 0.22, at: 0.56 })
  },
  'snd-drumline': S => {
    const v = verb(S, 0.25)
    const snare = at => { noise(S, { bp: 1900, q: 0.8, dur: 0.09, gain: 0.2, at, out: v }); osc(S, { type: 'triangle', f: 220, to: 160, dur: 0.05, gain: 0.08, at, out: v }) }
    const tom = (at, f) => osc(S, { f, to: f * 0.6, dur: 0.18, gain: 0.22, at, out: v })
    const beat = 0.11
    ;[0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 12].forEach(i => snare(i * beat))
    ;[[5, 140], [11, 110], [13, 90], [14, 140], [15, 110]].forEach(([i, f]) => tom(i * beat, f))
    hit(S, { gain: 0.3, at: 16 * beat })
    noise(S, { hp: 5500, dur: 1.1, gain: 0.12, at: 16 * beat, out: v, env: { a: 0.004, d: 1.1 } })
    crowd(S, { dur: 2, gain: 0.16, at: 16 * beat })
  },
  'snd-organ': S => {
    const v = verb(S, 0.45)
    const organ = (f, at, dur) => [1, 2, 4].forEach((m, i) => osc(S, { f: f * m, dur, gain: [0.08, 0.04, 0.02][i], at, out: v, vib: 3, vibHz: 6, env: { a: 0.012, h: dur * 0.7, d: dur * 0.3, sus: 0.6, r: 0.08 } }))
    ;[[392, 0, 0.13], [523.3, 0.16, 0.13], [659.3, 0.32, 0.13], [784, 0.48, 0.4], [659.3, 0.95, 0.13], [784, 1.11, 0.6]].forEach(([f, at, d]) => organ(f, at, d))
    crowd(S, { dur: 1.6, gain: 0.2, at: 1.15 })
  },
  'snd-riser': S => {
    const v = verb(S, 0.3)
    for (const d of [-8, 0, 7]) osc(S, { type: 'sawtooth', f: 110, to: 440, detune: d, dur: 1.15, gain: 0.04, out: v, lp: 3000, env: { a: 0.9, d: 0.25 } })
    noise(S, { bp: 300, to: 6000, q: 1.2, dur: 1.15, gain: 0.12, env: { a: 1.0, d: 0.15 } })
    hit(S, { gain: 0.4, at: 1.15 })
    for (const f of [220, 277.2, 329.6]) osc(S, { type: 'sawtooth', f, dur: 0.9, gain: 0.05, at: 1.15, lp: 2200, out: v, env: { a: 0.01, d: 0.9 } })
    crowd(S, { dur: 1.8, gain: 0.18, at: 1.15 })
  },
  'snd-cannon': S => {
    const v = verb(S, 0.5)
    osc(S, { f: 90, to: 28, dur: 0.9, gain: 0.5, out: v, env: { a: 0.002, d: 0.9 } })
    noise(S, { lp: 500, dur: 0.7, gain: 0.4, out: v, env: { a: 0.002, d: 0.7 } })
    noise(S, { hp: 2000, dur: 0.12, gain: 0.12 })
    osc(S, { f: 70, to: 30, dur: 0.6, gain: 0.18, at: 0.32, out: v })
    crowd(S, { dur: 2.6, gain: 0.24, at: 0.15 })
  },
  'snd-train': S => {
    const v = verb(S, 0.4)
    for (const f of [311.1, 370, 466.2]) osc(S, { type: 'sawtooth', f, to: f * 0.97, dur: 1.4, gain: 0.05, out: v, lp: 1800, q: 1.1, env: { a: 0.05, h: 1.0, d: 0.35, sus: 0.6, r: 0.2 } })
    for (const f of [311.1, 370, 466.2]) osc(S, { type: 'sawtooth', f, to: f * 0.97, dur: 0.5, gain: 0.04, at: 1.55, out: v, lp: 1800, q: 1.1, env: { a: 0.03, h: 0.3, d: 0.2, sus: 0.6, r: 0.15 } })
    crowd(S, { dur: 2.2, gain: 0.16, at: 0.3 })
  },
  'snd-bassdrop': S => {
    const v = verb(S, 0.25)
    noise(S, { bp: 400, to: 5000, q: 1.4, dur: 0.8, gain: 0.12, env: { a: 0.7, d: 0.1 } })
    osc(S, { type: 'sawtooth', f: 220, to: 880, dur: 0.8, gain: 0.04, lp: 2600, env: { a: 0.7, d: 0.1 } })
    hit(S, { gain: 0.45, at: 0.82 })
    const t = S.t + 0.82, ac = S.ac
    const o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain()
    o.type = 'sine'; o.frequency.setValueAtTime(62, t); o.frequency.exponentialRampToValueAtTime(42, t + 1.3)
    lfo.frequency.value = 6; lg.gain.value = 0.18
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
    lfo.connect(lg).connect(g.gain); o.connect(g).connect(S.out)
    o.start(t); lfo.start(t); o.stop(t + 1.5); lfo.stop(t + 1.5)
    crowd(S, { dur: 1.8, gain: 0.16, at: 0.85, out: v })
  },
  'snd-sax': S => { const v = verb(S, 0.4); for (const [f, at] of [[392, 0], [440, 0.12], [523.3, 0.24]]) brass(S, { f, dur: 0.18, gain: 0.12, at, out: v }); brass(S, { f: 659.3, dur: 0.7, gain: 0.14, at: 0.36, hold: 0.25, out: v }) },
  'snd-pizzi': S => { [523.3, 659.3, 784, 1046.5].forEach((f, i) => osc(S, { type: 'triangle', f, dur: 0.12, gain: 0.1, at: i * 0.11, env: { a: 0.002, d: 0.12 } })) },
  'snd-pro-anthem': S => {
    const v = verb(S, 0.5)
    for (let i = 0; i < 10; i++) osc(S, { f: 98, to: 70, dur: 0.12, gain: 0.12 + i * 0.012, at: i * 0.05, out: v })
    ;[[392, 0.5], [523.3, 0.64], [659.3, 0.78]].forEach(([f, at]) => brass(S, { f, dur: 0.14, gain: 0.13, at, out: v }))
    brass(S, { f: 784, dur: 1.1, gain: 0.17, at: 0.92, hold: 0.5, out: v })
    brass(S, { f: 392, dur: 1.1, gain: 0.12, at: 0.92, hold: 0.5, out: v })
    hit(S, { gain: 0.36, at: 0.92 })
    crowd(S, { dur: 2.6, gain: 0.24, at: 0.9 })
  },
}
// The sampled layer: each entry plays recorded sounds and returns true, or
// returns false (samples still loading) so the synth version plays instead.
const pick = (...names) => names[Math.floor(Math.random() * names.length)]
const SAMPLED = {
  tap: S => smp(S, pick('tap', 'tap2'), { gain: 0.55, jitter: 0.04 }),
  tick: S => smp(S, 'tick', { gain: 0.42, jitter: 0.07 }),
  back: S => smp(S, 'back', { gain: 0.6, jitter: 0.03 }),
  close: S => smp(S, 'close', { gain: 0.5 }),
  lock: S => smp(S, 'wood', { gain: 0.95, jitter: 0.03 }) && smp(S, 'stack2', { gain: 0.6, at: 0.012, jitter: 0.04 }),
  pop: S => smp(S, 'open', { gain: 0.55 }),
  swap: S => smp(S, 'swoosh', { gain: 0.7 }) && smp(S, 'woodl', { gain: 0.6, at: 0.14 }),
  flip: S => smp(S, pick('slide', 'slide2'), { gain: 0.8, jitter: 0.04 }),
  slot: S => smp(S, 'chip', { gain: 0.95, jitter: 0.05 }) && smp(S, 'drop', { gain: 0.35, jitter: 0.04 }),
  deny: S => smp(S, 'deny', { gain: 0.7 }),
  send: S => smp(S, 'pluck', { gain: 0.6, jitter: 0.05 }),
  coin: S => smp(S, 'chips', { gain: 0.9, jitter: 0.05 }) && smp(S, 'stack2', { gain: 0.55, at: 0.07, jitter: 0.05 }),
  purchase: S => smp(S, 'handful', { gain: 0.9 }) && smp(S, 'stack', { gain: 0.8, at: 0.14 }) && smp(S, 'hitS', { gain: 0.75, at: 0.06 }),
  equip: S => smp(S, 'toggle', { gain: 0.8 }) && smp(S, 'slide2', { gain: 0.55, at: 0.03 }),
  claim: S => smp(S, 'stack', { gain: 0.9 }) && smp(S, 'confirm', { gain: 0.45, at: 0.04 }),
  chime: S => smp(S, 'pluck2', { gain: 0.6 }) && smp(S, 'confirm', { gain: 0.4, at: 0.05 }),
  gradepop: (S, val = 5) => smp(S, 'stack2', { gain: 0.5, rate: 0.85 + val * 0.03 }),
  stamp: S => smp(S, 'punchm', { gain: 1 }) && smp(S, 'plank', { gain: 0.6, at: 0.01 }),
  card: (S, rank = 0) => {
    if (!smp(S, 'cardout', { gain: 0.8, jitter: 0.03 })) return false
    if (rank >= 1) smp(S, 'stack2', { gain: 0.5, at: 0.12 })
    if (rank === 2) smp(S, 'hitS2', { gain: 0.6, at: 0.1 })
    if (rank >= 3) { smp(S, 'hitM', { gain: 0.85, at: 0.1 }); crowd(S, { dur: 1.3, gain: 0.08, at: 0.2 }) }
    return true
  },
  achievement: S => smp(S, 'hitM', { gain: 0.85 }) && smp(S, 'stack', { gain: 0.6, at: 0.1 }) && (crowd(S, { dur: 1.2, gain: 0.07, at: 0.15 }), true),
  levelup: S => smp(S, 'hitXL', { gain: 0.9 }) && smp(S, 'handful', { gain: 0.6, at: 0.25 }) && (crowd(S, { dur: 1.6, gain: 0.11, at: 0.1 }), true),
  award: S => smp(S, 'hitL', { gain: 0.95 }) && (crowd(S, { dur: 1.8, gain: 0.15, at: 0.08 }), true),
  champion: S => { if (!smp(S, 'hitXXL', { gain: 1 })) return false; const v = verb(S, 0.4); horn(S, { f: 233, dur: 0.6, gain: 0.12, at: 0.9, out: v }); crowd(S, { dur: 2.8, gain: 0.24, at: 0.04 }); return true },
  // the last trait in: the riser, then a real impact and a stinger sized to the tier
  complete: (S, tier = 2) => {
    if (!ready('punch')) return false
    noise(S, { bp: 260, to: 4200, q: 1.1, dur: 0.95, gain: 0.1, env: { a: 0.85, d: 0.1 } })
    osc(S, { f: 46, to: 74, dur: 0.95, gain: 0.13, env: { a: 0.8, d: 0.15 } })
    smp(S, 'punch', { gain: 1, at: 1.0 })
    smp(S, ['hitS', 'hitS2', 'hitM', 'hitL', 'hitXXL'][Math.max(0, Math.min(4, tier))], { gain: 0.9, at: 1.0 })
    if (tier >= 2) crowd(S, { dur: 1.4 + tier * 0.3, gain: 0.07 + tier * 0.04, at: 1.0 })
    return true
  },
  // victory sounds that lead with recorded music
  'snd-horn': S => { if (!smp(S, 'hitL2', { gain: 0.8 })) return false; const v = verb(S, 0.4); horn(S, { f: 233, dur: 0.8, gain: 0.17, at: 0.15, out: v }); horn(S, { f: 233, dur: 0.48, gain: 0.14, at: 1.08, out: v }); crowd(S, { dur: 2.4, gain: 0.22, at: 0.04 }); return true },
  'snd-roar': S => smp(S, 'thud', { gain: 1 }) && (crowd(S, { dur: 3.2, gain: 0.34 }), crowd(S, { dur: 2.2, gain: 0.18, at: 0.4 }), true),
  'snd-fanfare': S => smp(S, 'hitXXL', { gain: 1 }) && (crowd(S, { dur: 2, gain: 0.14, at: 0.2 }), true),
  'snd-riser': S => { if (!ready('hitXL')) return false; noise(S, { bp: 300, to: 6000, q: 1.2, dur: 1.15, gain: 0.12, env: { a: 1.0, d: 0.15 } }); smp(S, 'punch', { gain: 1, at: 1.15 }); smp(S, 'hitXL', { gain: 0.9, at: 1.15 }); crowd(S, { dur: 1.8, gain: 0.16, at: 1.15 }); return true },
  'snd-cannon': S => smp(S, 'thud', { gain: 1 }) && smp(S, 'punch', { gain: 0.9, rate: 0.7 }) && (osc(S, { f: 90, to: 28, dur: 0.9, gain: 0.35 }), crowd(S, { dur: 2.6, gain: 0.24, at: 0.15 }), true),
  'snd-pro-anthem': S => { if (!smp(S, 'hitXXL', { gain: 1, at: 0.45 })) return false; for (let i = 0; i < 9; i++) smp(S, 'punchm', { gain: 0.25 + i * 0.06, at: i * 0.05, rate: 0.8 }); crowd(S, { dur: 2.6, gain: 0.24, at: 0.5 }); return true },
  'snd-sax': S => smp(S, 'sax', { gain: 0.95 }) && (crowd(S, { dur: 2.2, gain: 0.12, at: 0.3 }), true),
  'snd-pizzi': S => smp(S, 'pizzi', { gain: 0.95 }) && (crowd(S, { dur: 1.8, gain: 0.1, at: 0.4 }), true),
}
SYNTH.back = SYNTH.tap
SYNTH.close = SYNTH.tap
// ── Sound Lab picks: per moment, a candidate file, 'none' (silent) or nothing
// (the built-in sound). Set from the Sound Lab screen; read on every play.
const PICKS_KEY = 'bap_sfx_picks'
// The sounds picked by ear in the Sound Lab (2026-10-08), built in. A moment
// not listed keeps its built-in sound; 'none' is silent. Lab picks still
// override these on the phone they're made on.
export const BAKED = {
  tap: 's-plastic', spin: 's-spinwhir', tick: 'none', slot: 's-plastic', complete: 's-boom',
  back: 's-click33', swap: 'none', claim: 's-feedback', chime: 's-feedback', purchase: 's-feedback',
  deny: 's-retrobtn', send: 's-plastic', levelup: 's-feedback', achievement: 's-feedback',
  award: 's-feedback', champion: 's-crowd-arena', 'snd-cannon': 's-explosion',
}
// Picks saved before the sounds were built in would shadow them; start fresh once
try { if (localStorage.getItem('bap_sfx_baked') !== '1') { localStorage.removeItem(PICKS_KEY); localStorage.setItem('bap_sfx_baked', '1') } } catch {}
export const getPicks = () => { try { return JSON.parse(localStorage.getItem(PICKS_KEY) || '{}') } catch { return {} } }
export const setPick = (event, id) => { const p = getPicks(); if (id) p[event] = id; else delete p[event]; try { localStorage.setItem(PICKS_KEY, JSON.stringify(p)) } catch {} }
const labBufs = new Map()
function labBuffer(ac, id) {
  if (labBufs.has(id)) return labBufs.get(id)
  const pr = fetch(`/sfx-lab/${id}.wav`).then(r => r.arrayBuffer()).then(b => new Promise((res, rej) => ac.decodeAudioData(b, res, rej))).catch(() => null)
  labBufs.set(id, pr)
  return pr
}
export function playLab(id, gain = 0.9) {
  if (isMuted()) return
  const ac = audio(); if (!ac) return
  labBuffer(ac, id).then(buf => {
    if (!buf) return
    const src = ac.createBufferSource(), g = ac.createGain()
    src.buffer = buf; g.gain.value = gain
    src.connect(g).connect(bus); src.start()
  })
}
export const LAB_GAIN = { tap: 0.5, tick: 0.4, gradepop: 0.45, back: 0.55, send: 0.6, deny: 0.6, spin: 0.55, slot: 0.6, champion: 0.8 }
export const sfx = (name, arg) => {
  if (isMuted()) return
  const pick = getPicks()[name] ?? BAKED[name]
  if (pick === 'none') return
  if (pick) { playLab(pick, LAB_GAIN[name] ?? 0.9); return }
  const ac = audio(); if (!ac || !(SYNTH[name] || SAMPLED[name])) return
  const S = scene(ac, bus, ac.currentTime)
  try { if (SAMPLED[name]?.(S, arg)) return } catch {}
  try { SYNTH[name]?.(S, arg) } catch {}
}

// Renders one effect offline and reports its level — for checking the mix
// (window.__bapJuice.renderSfx('champion') in the app's web inspector).
export async function renderSfx(name, arg, seconds = 3.5) {
  const ac = new OfflineAudioContext(1, Math.ceil(44100 * seconds), 44100)
  ;(SYNTH[name] ?? (() => {}))(scene(ac, makeBus(ac), 0.02), arg)
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

// ── Victory: your equipped effect + sound (the shop's Victory slots) ────────
const VFX_MS = 2900
function canvasLayer() {
  const c = document.createElement('canvas')
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1300'
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  c.width = innerWidth * dpr; c.height = innerHeight * dpr
  document.body.appendChild(c)
  const g = c.getContext('2d'); g.scale(dpr, dpr)
  return { c, g, W: innerWidth, H: innerHeight }
}
function runFx(draw, ms = VFX_MS) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const L = canvasLayer()
  const start = performance.now()
  const state = {}
  const frame = now => {
    const t = now - start
    L.g.clearRect(0, 0, L.W, L.H)
    draw(L, t, t / ms, state)
    if (t < ms) requestAnimationFrame(frame); else L.c.remove()
  }
  requestAnimationFrame(frame)
}
const rnd = (a, b) => a + Math.random() * (b - a)
const accent = () => { const css = getComputedStyle(document.documentElement); return [css.getPropertyValue('--btn-start').trim() || '#5EDBD8', css.getPropertyValue('--btn-end').trim() || '#1fc98a'] }
const FX = {
  'fx-confetti': () => confetti(180),
  'fx-streamers': () => runFx(({ g, W, H }, t, k, st) => {
    st.s ??= Array.from({ length: 26 }, (_, i) => ({ x: rnd(0, W), y: rnd(-H * 0.6, -20), w: rnd(5, 9), len: rnd(60, 140), sp: rnd(2.4, 4.5), ph: rnd(0, 6), col: ['#f472b6', '#60a5fa', '#fde047', '#4ade80', '#f2c94c', ...accent()][i % 7] }))
    g.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.75) * 4)
    for (const s of st.s) {
      s.y += s.sp
      g.strokeStyle = s.col; g.lineWidth = s.w; g.lineCap = 'round'
      g.beginPath()
      for (let i = 0; i <= 12; i++) { const yy = s.y - (i / 12) * s.len; const xx = s.x + Math.sin(s.ph + t / 260 + i * 0.6) * 10; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy) }
      g.stroke()
    }
  }),
  'fx-snow': () => runFx(({ g, W, H }, t, k, st) => {
    st.f ??= Array.from({ length: 140 }, () => ({ x: rnd(0, W), y: rnd(-H, 0), r: rnd(1.2, 3.6), sp: rnd(0.8, 2.2), ph: rnd(0, 6) }))
    g.fillStyle = '#fff'; g.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.7) * 3.3)
    for (const f of st.f) { f.y += f.sp; f.x += Math.sin(f.ph + t / 500) * 0.5; g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.fill() }
  }, 3400),
  'fx-goldrain': () => runFx(({ g, W, H }, t, k, st) => {
    st.c ??= Array.from({ length: 70 }, () => ({ x: rnd(0, W), y: rnd(-H, -10), v: rnd(3, 7), r: rnd(7, 12), sp: rnd(0.05, 0.16), a: rnd(0, 6) }))
    g.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.8) * 5)
    for (const c of st.c) {
      c.y += c.v; c.v += 0.12; c.a += c.sp
      const sx = Math.abs(Math.cos(c.a))
      g.save(); g.translate(c.x, c.y); g.scale(Math.max(0.12, sx), 1)
      const grd = g.createRadialGradient(-c.r * 0.3, -c.r * 0.3, 1, 0, 0, c.r); grd.addColorStop(0, '#fff3c4'); grd.addColorStop(0.5, '#f2c94c'); grd.addColorStop(1, '#a16207')
      g.fillStyle = grd; g.beginPath(); g.arc(0, 0, c.r, 0, 7); g.fill(); g.restore()
    }
  }),
  'fx-shockwave': () => runFx(({ g, W, H }, t) => {
    const [a1] = accent()
    for (let i = 0; i < 4; i++) {
      const tt = t - i * 260; if (tt < 0) continue
      const p = tt / 1500; if (p > 1) continue
      g.strokeStyle = i % 2 ? '#f2c94c' : a1; g.globalAlpha = (1 - p) * 0.9; g.lineWidth = 10 * (1 - p) + 1
      g.beginPath(); g.arc(W / 2, H * 0.42, p * Math.max(W, H) * 0.8, 0, 7); g.stroke()
    }
    if (t < 180) { g.globalAlpha = (1 - t / 180) * 0.35; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H) }
  }, 2400),
  'fx-fireworks': () => runFx(({ g, W, H }, t, k, st) => {
    st.b ??= []; st.n ??= 0
    if (st.n < 6 && t > st.n * 330) {
      const x = rnd(W * 0.2, W * 0.8), y = rnd(H * 0.15, H * 0.45), col = ['#f472b6', '#fde047', '#60a5fa', '#4ade80', '#f2c94c', '#c084fc'][st.n % 6]
      for (let i = 0; i < 46; i++) { const a = (i / 46) * Math.PI * 2, v = rnd(2.2, 4.6); st.b.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, col }) }
      st.n++
    }
    g.globalCompositeOperation = 'lighter'
    for (const p of st.b) { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.vx *= 0.985; p.life -= 0.012; if (p.life <= 0) continue; g.globalAlpha = p.life; g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, 2.2, 0, 7); g.fill() }
    g.globalCompositeOperation = 'source-over'
  }, 3200),
  'fx-lightning': () => runFx(({ g, W, H }, t, k, st) => {
    st.bolts ??= [0, 380, 800, 1300].map(at => ({ at, x: rnd(W * 0.15, W * 0.85) }))
    for (const b of st.bolts) {
      const d = t - b.at; if (d < 0 || d > 260) continue
      if (d < 70) { g.globalAlpha = 0.25; g.fillStyle = '#e0f2fe'; g.fillRect(0, 0, W, H) }
      g.globalAlpha = 1 - d / 260; g.strokeStyle = '#e0f2fe'; g.lineWidth = 3; g.shadowColor = '#67e8f9'; g.shadowBlur = 18
      g.beginPath(); let x = b.x, y = 0; g.moveTo(x, y)
      while (y < H * 0.75) { x += rnd(-28, 28); y += rnd(24, 52); g.lineTo(x, y) }
      g.stroke(); g.shadowBlur = 0
    }
  }, 1800),
  'fx-spotlights': () => runFx(({ g, W, H }, t, k) => {
    g.globalAlpha = Math.sin(Math.min(1, k * 1.4) * Math.PI) * 0.75
    for (const [ox, ph] of [[0, 0], [W, 1.6], [W * 0.5, 3]]) {
      const a = -Math.PI / 2 + Math.sin(t / 420 + ph) * 0.55
      const len = H * 1.2, spread = 0.13
      const grd = g.createLinearGradient(ox, H, ox + Math.cos(a) * len, H + Math.sin(a) * len); grd.addColorStop(0, 'rgba(255,255,255,.65)'); grd.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grd; g.beginPath(); g.moveTo(ox, H)
      g.lineTo(ox + Math.cos(a - spread) * len, H + Math.sin(a - spread) * len); g.lineTo(ox + Math.cos(a + spread) * len, H + Math.sin(a + spread) * len); g.closePath(); g.fill()
    }
  }, 2800),
  'fx-flames': () => runFx(({ g, W, H }, t, k, st) => {
    st.p ??= []
    if (k < 0.75) for (let i = 0; i < 9; i++) st.p.push({ x: rnd(0, W), y: H + 10, vx: rnd(-0.6, 0.6), vy: rnd(-7, -3.5), r: rnd(10, 26), life: 1 })
    g.globalCompositeOperation = 'lighter'
    for (const p of st.p) {
      p.x += p.vx; p.y += p.vy; p.life -= 0.018; p.r *= 0.985; if (p.life <= 0) continue
      const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
      grd.addColorStop(0, `rgba(253,224,71,${p.life})`); grd.addColorStop(0.45, `rgba(249,115,22,${p.life * 0.7})`); grd.addColorStop(1, 'rgba(185,28,28,0)')
      g.fillStyle = grd; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill()
    }
    g.globalCompositeOperation = 'source-over'
  }, 2800),
  'fx-lasers': () => runFx(({ g, W, H }, t, k) => {
    g.globalAlpha = Math.sin(Math.min(1, k * 1.3) * Math.PI)
    g.globalCompositeOperation = 'lighter'
    const cols = ['#22d3ee', '#e879f9', '#4ade80', '#f2c94c']
    cols.forEach((col, i) => {
      for (const side of [0, 1]) {
        const ox = side ? W : 0, oy = H * (0.3 + i * 0.15)
        const a = (side ? Math.PI : 0) + Math.sin(t / (300 + i * 60) + i) * 0.7
        g.strokeStyle = col; g.lineWidth = 2.5; g.shadowColor = col; g.shadowBlur = 14
        g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.cos(a) * W * 1.4, oy + Math.sin(a) * W * 1.4); g.stroke()
      }
    })
    g.shadowBlur = 0; g.globalCompositeOperation = 'source-over'
  }, 3000),
  'fx-pro-supernova': () => runFx(({ g, W, H }, t, k, st) => {
    const cx = W / 2, cy = H * 0.42
    if (t < 220) { g.globalAlpha = 1 - t / 220; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H) }
    st.p ??= Array.from({ length: 160 }, () => { const a = rnd(0, 7), v = rnd(2, 9); return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, col: ['#fff', '#fde68a', '#f97316', '#a78bfa', '#67e8f9'][Math.floor(rnd(0, 5))] } })
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.max(0, 1 - k)
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, 60 + k * 260); grd.addColorStop(0, 'rgba(253,230,138,.7)'); grd.addColorStop(1, 'rgba(124,58,237,0)')
    g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, 60 + k * 260, 0, 7); g.fill()
    for (const p of st.p) { p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.vy *= 0.985; g.fillStyle = p.col; g.fillRect(p.x, p.y, 2.5, 2.5) }
    g.globalCompositeOperation = 'source-over'
  }, 3000),
}
export function previewVictory(fx, sound) {
  if (fx) (FX[fx] ?? FX['fx-confetti'])()
  if (sound) sfx(sound)
}
// A win: play what the player has equipped. big = a title (a little longer)
export function victory({ big = false } = {}) {
  stopTicks()
  const v = myVictory()
  ;(FX[v.fx] ?? FX['fx-confetti'])()
  if (big && v.fx !== 'fx-confetti') setTimeout(() => confetti(90), 600)
  // a title gets the crowd, an award its sting; the equipped victory sound on top
  sfx(big ? 'champion' : 'award')
  const own = SYNTH[v.sound] || SAMPLED[v.sound] ? v.sound : 'snd-horn'
  setTimeout(() => sfx(own), 250)
  haptic('success')
}

// ── Wiring ───────────────────────────────────────────────────────────────────
const TAP = '.dc-submit-btn, .dc-back-btn, .dc-lb-btn, .ag-btn, .ag-tab, .ag-play, .ag-pos, .ag-mode, .ag-mini, .ag-tile, .ag-chip, .ag-seg button, .ag-set, .ag-edge, .ag-icon-btn, .ag-row-btn, .ag-daily-banner, .ag-milestone, .ag-player-chip, .ag-round-btn, .spin-btn, .spin-respin-half, .spin-reset-circle, .attr-chip, .mtab, .cat-pill, .sim-btn, .simp-cta, .simp-ghost, .mvp-continue, .tpm-tab, .auth-submit, .lb-main-seg-btn, .lb-tab, .lb-view-tab, .lb-metric-tab, .lb-pos-btn'

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
  window.__bapJuice = { sfx, renderSfx, playLab }
  // The last trait in: the power-up stinger (confetti is for rings and awards)
  window.addEventListener('bap:purchase', () => { sfx('purchase'); haptic('success') })
  window.addEventListener('bap:achievement', () => { sfx('achievement'); haptic('success') })
  window.addEventListener('bap:victory', e => victory(e.detail || {}))

  document.addEventListener('pointerdown', e => {
    const el = e.target.closest?.(TAP)
    if (!el || el.disabled) return
    audio()                                   // unlock audio on the first gesture (iOS); loads the samples
    if (el.matches('.spin-btn, .spin-respin-half')) {
      sfx('tap'); haptic('medium'); startTicks()
      // the build's reels play the spin sound as each one starts (below); other spinners here
      if (!el.closest('.spin-panel')) sfx('spin')
      return
    }
    if (el.matches('.attr-chip')) { sfx('slot'); haptic('medium'); return }
    if (el.matches('.ag-round-btn, .cr-close, .prf-top-back, .dc-back-btn')) { sfx('back'); haptic('light'); return }
    if (el.matches('.ag-edge')) { sfx('flip'); haptic('light'); return }
    // "Simulate Season" — the referee starts the game
    if (el.matches('.simp-cta') && /simulate season/i.test(el.textContent)) { sfx('whistle'); haptic('medium'); return }
    sfx('tap'); haptic('light')
  }, { capture: true, passive: true })

  const seen = new WeakSet()
  const celebrate = big => victory({ big })
  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'attributes') {
        const el = m.target
        if (el.classList?.contains('reel-spinning') && !(m.oldValue || '').includes('reel-spinning')) { sfx('spin'); continue }
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
        if (n.matches?.('.ag-menu-overlay, .auth-overlay, .tpm-overlay, .ag-screen, .sh-sheet-overlay, .bt-sheet-overlay, .cr-overlay')) sfx('pop')
      }
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true })
}
