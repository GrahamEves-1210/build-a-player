// App-only "juice": synthesized sound effects, haptics and confetti.
// Started from main.jsx when IS_APP. It reacts to what's on screen (taps on
// game buttons, a reel locking, an award / title reveal) instead of being
// wired into game code, so removing this file removes the whole layer.
// Sounds are generated with Web Audio — no audio files. Mute: Menu → Sound.

const MUTE_KEY = 'bap_sound_off'
export const isMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false } }
export const setMuted = on => { try { on ? localStorage.setItem(MUTE_KEY, '1') : localStorage.removeItem(MUTE_KEY) } catch {} }

// ── Sound ────────────────────────────────────────────────────────────────────
let ctx = null
const audio = () => {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { return null } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}
function tone(freq, { at = 0, dur = 0.08, type = 'triangle', gain = 0.08, to = null, detune = 0 } = {}) {
  const a = audio(); if (!a) return
  const t = a.currentTime + at
  const o = a.createOscillator(), g = a.createGain()
  o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t); o.stop(t + dur + 0.02)
}
const SFX = {
  tap:  () => tone(620, { dur: 0.07, to: 920, gain: 0.07 }),
  tick: () => tone(1500, { dur: 0.018, type: 'square', gain: 0.022 }),
  lock: () => { tone(880, { dur: 0.12, gain: 0.08 }); tone(1320, { at: 0.07, dur: 0.18, gain: 0.07 }) },
  win:  () => {
    const notes = [523, 659, 784, 1047]
    notes.forEach((f, i) => tone(f, { at: i * 0.1, dur: 0.16, gain: 0.08 }))
    tone(1047, { at: 0.42, dur: 0.6, gain: 0.07 }); tone(1047, { at: 0.42, dur: 0.6, gain: 0.05, detune: 8 })
    tone(1319, { at: 0.42, dur: 0.6, gain: 0.04 })
  },
  pop:  () => tone(300, { dur: 0.12, to: 120, type: 'sine', gain: 0.1 }),
}
export const sfx = name => { if (!isMuted()) try { SFX[name]?.() } catch {} }

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
  const COLORS = ['#ffd43b', '#20c997', '#4dabf7', '#ff6b6b', '#b197fc', '#ff922b', '#ffffff']
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
const TAP = '.dc-submit-btn, .dc-back-btn, .dc-lb-btn, .ag-btn, .ag-tab, .ag-play, .ag-pos, .ag-sport, .ag-player-chip, .ag-round-btn, .spin-btn, .spin-respin-half, .spin-reset-circle, .attr-chip, .mtab, .cat-pill, .sim-btn, .simp-cta, .simp-ghost, .mvp-continue, .tpm-tab, .auth-submit, .lb-main-seg-btn, .lb-tab'

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
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest?.(TAP)
    if (!el || el.disabled) return
    audio()                                   // unlock audio on the first gesture (iOS)
    if (el.matches('.spin-btn, .spin-respin-half')) { sfx('tap'); haptic('medium'); startTicks(); return }
    sfx('tap'); haptic('light')
  }, { capture: true, passive: true })

  const seen = new WeakSet()
  const celebrate = big => { stopTicks(); sfx('win'); haptic('success'); confetti(big ? 200 : 140) }
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
        if (n.matches?.('.ag-menu-overlay, .auth-overlay, .tpm-overlay')) sfx('pop')
      }
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true })
}
