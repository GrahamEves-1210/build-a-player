import { useEffect, useState } from 'react'

// A number counting up to its value: fast at first, then a long settle (the app's
// ease-out, lib/motion.jsx EASE_OUT). With Reduce Motion on it shows the value
// straight away. Every count-up in the app goes through here.
//   run    start counting (until then it shows 0)
//   ms     how long the count takes
//   reset  back to 0 whenever run goes false (so it counts again next time)

const reduced = () => typeof document !== 'undefined' && document.documentElement.classList.contains('bap-reduce-motion')
export const easeOut = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

export function useCountUp(target, { run = true, ms = 900, reset = false } = {}) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!run) { if (reset) setV(0); return }
    const to = Number(target) || 0
    if (reduced()) { setV(Math.round(to)); return }
    let raf, t0
    const step = now => {
      t0 ??= now
      const t = Math.min(1, (now - t0) / ms)
      setV(Math.round(to * easeOut(t)))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, run, ms, reset])
  return v
}
