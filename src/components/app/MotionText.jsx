import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { EASE_OUT, useReducedMotionApp } from '../../lib/motion'

// Moving text and numbers, shared by the app's screens (styles: app-game.css "MOTION TEXT").
//   RollingNumber  an odometer: each digit rolls to its new value
//   RollText       a label that rolls out letter by letter as the new one rolls in
//   Scramble       letters flicker and settle left to right, once, as it appears
//   RiseText       letters rise into place, one after another, as it appears
// Reduce Motion: the numbers and labels change in place, Scramble and RiseText just show.

const DIGITS = [...'0123456789']

// from: a number to roll from when it first appears (a score rolling in from 0); without
// it the number appears as it is and rolls only when it changes
export function RollingNumber({ value, from = null, format = n => Math.round(Number(n) || 0).toLocaleString(), className = '' }) {
  const [armed, setArmed] = useState(from == null)
  useEffect(() => {
    if (armed) return
    let r2
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setArmed(true)) })
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
  }, [armed])
  // a digit that turns up after the first render (999 → 1,000) slides in; the rest roll
  const seen = useRef(null)
  const str = format(armed ? value : from)
  const chars = [...str]
  const keys = chars.map((c, i) => `${/\d/.test(c) ? 'd' : 's'}${chars.length - i}`)   // from the right: the ones digit stays the ones digit
  const fresh = k => seen.current != null && !seen.current.has(k)
  useEffect(() => { seen.current = new Set(keys) })
  return (
    <span className={`rn${className ? ` ${className}` : ''}`} role="text" aria-label={format(value)}>
      {chars.map((c, i) => (/\d/.test(c)
        ? <span key={keys[i]} className={`rn-d${fresh(keys[i]) ? ' is-new' : ''}`} aria-hidden="true">
            <span className="rn-ph">0</span>
            <span className="rn-col" style={{ '--n': c }}>{DIGITS.map(d => <span key={d}>{d}</span>)}</span>
          </span>
        : <span key={keys[i]} className="rn-s" aria-hidden="true">{c}</span>))}
    </span>
  )
}

const CHAR = {
  in: { y: '105%', opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.34, ease: EASE_OUT } },
  out: { y: '-105%', opacity: 0, transition: { duration: 0.2, ease: EASE_OUT } },
}
const WORD = { show: { transition: { staggerChildren: 0.028 } }, out: { transition: { staggerChildren: 0.018 } } }
export function RollText({ text, className = '' }) {
  const t = String(text ?? '')
  return (
    <span className={`rt${className ? ` ${className}` : ''}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={t} className="rt-w" variants={WORD} initial="in" animate="show" exit="out" aria-label={t}>
          {[...t].map((c, i) => <motion.span key={i} className="rt-c" variants={CHAR} aria-hidden="true">{c === ' ' ? ' ' : c}</motion.span>)}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

const POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const randomLike = c => {
  const r = POOL[Math.floor(Math.random() * POOL.length)]
  return c === c.toLowerCase() && c !== c.toUpperCase() ? r.toLowerCase() : r
}
// The final text holds the space, so nothing around it shifts while the letters flicker
export function Scramble({ text, ms = 750, delay = 0, className = '' }) {
  const t = String(text ?? '')
  const reduce = useReducedMotionApp()
  const [shown, setShown] = useState(reduce ? t : '')
  useEffect(() => {
    if (reduce) { setShown(t); return }
    let raf, t0, last = 0
    const tick = now => {
      t0 ??= now
      const p = Math.max(0, Math.min(1, (now - t0 - delay) / ms))
      if (now - last > 40 || p >= 1) {   // ~25 changes a second: a flicker you can read, not a blur
        last = now
        const settled = Math.floor(p * t.length)
        setShown([...t].map((c, i) => (i < settled || /\s|[^\w]/.test(c) ? c : randomLike(c))).join(''))
      }
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [t, ms, delay, reduce])
  return (
    <span className={`scr${className ? ` ${className}` : ''}`} role="text" aria-label={t}>
      <span className="scr-ghost" aria-hidden="true">{t}</span>
      <span className="scr-live" aria-hidden="true">{shown}</span>
    </span>
  )
}

// Words stay whole (they wrap as words); each letter rises on its own beat
export function RiseText({ text, delay = 0, step = 32, className = '' }) {
  const t = String(text ?? '')
  let i = 0
  return (
    <span className={`rise${className ? ` ${className}` : ''}`} role="text" aria-label={t} style={{ '--rise-d': `${delay}ms`, '--rise-step': `${step}ms` }}>
      {t.split(/(\s+)/).map((w, k) => (/^\s+$/.test(w)
        ? <span key={k}> </span>
        : <span key={k} className="rise-w" aria-hidden="true">{[...w].map((c, j) => <span key={j} className="rise-c" style={{ '--i': i++ }}>{c}</span>)}</span>))}
    </span>
  )
}
