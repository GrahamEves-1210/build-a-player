import { useEffect, useRef, useState } from 'react'

// A film from the trophy scene turning, slowly, over its still (lib/franchiseLive.js FRANCHISE_ART/TURN): the whole
// trophy on the mode's save slots (one turn, 12 s), the trophy's football spinning like a slow spiral on Home's
// FRANCHISE card (one turn, 5 s). Only the trophy or the ball turns (the light and the camera hold), and the first
// frame is the still: the still underneath is its poster (the film shows only once it's playing), so the swap can't
// be seen. Its CSS puts it over the still.
// Light on the machine, like every loop on the site (lib/fxPause.js): nothing is asked for until it's on screen
// (preload none, no src), it plays only while on screen and the tab is showing, never while a skill game covers
// the page (html.mg-live), and after `turns` turns (about a minute) it rests on the still's pose; scrolling it back into view (or a
// tap, where there's one to give) turns it again. Reduce Motion and weak machines (html.low-power): the still only.
// If the film can't play, it never shows and the still stays.
const TURNS = 5   // the trophy's 12 s turn: a minute (the card's 5 s football passes 12)
const quiet = () => {
  try {
    const c = document.documentElement.classList
    return c.contains('bap-reduce-motion') || c.contains('low-power') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  } catch { return true }
}
// H.264 wherever it plays (every phone); the WebM for a browser built without it
let kind
const pick = base => {
  if (kind === undefined) {
    kind = null
    try {
      const v = document.createElement('video')
      if (v.canPlayType('video/mp4; codecs="avc1.64001F"')) kind = 'mp4'
      else if (v.canPlayType('video/webm; codecs="vp9"')) kind = 'webm'
    } catch { /* the still stays */ }
  }
  return kind && `${base}.${kind}`
}

// the film is asked for once the page has loaded and the browser is idle: it never competes with the first paint
const whenIdle = fn => {
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200))
  if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true })
}

export default function TrophyTurn({ base, className, replay = null, turns: runs = TURNS }) {
  const [src, setSrc] = useState(null)
  const [shown, setShown] = useState(false)
  const [off] = useState(() => !base || quiet() || typeof IntersectionObserver === 'undefined')
  const ref = useRef(null)

  useEffect(() => {
    const v = ref.current
    if (off || !v) return undefined
    const root = document.documentElement
    let inView = false, rested = false, turns = 0, last = 0, dead = false, asked = false
    const may = () => inView && !rested && !dead && !document.hidden && !root.classList.contains('mg-live')
    const go = () => {
      if (quiet()) { v.pause(); setShown(false); return }   // (Reduce Motion switched on: back to the still)
      if (!may()) { if (!v.paused) v.pause(); return }
      if (!v.getAttribute('src')) { if (!asked) { asked = true; whenIdle(() => { const s = pick(base); if (s) setSrc(s); else dead = true }) } return }   // (plays once the src is in)
      if (!v.paused) return
      v.muted = true
      const p = v.play()
      if (p?.catch) p.catch(() => {})
    }
    // a fresh run of turns: the film turns `runs` times, then stops on its last frame (a hair short of the still's pose)
    const again = () => { rested = false; turns = 0; last = 0; v.loop = true; go() }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting === inView) return
      inView = e.isIntersecting
      if (inView) again(); else go()
    }, { rootMargin: '60px 0px' })
    io.observe(v)
    // (a wrap of the loop: the time goes back to the start)
    const wrapped = () => { const t = v.currentTime; if (t < last - 1 && ++turns >= runs - 1) v.loop = false; last = t }
    const ended = () => { rested = true }
    const playing = () => setShown(true)
    const failed = () => { dead = true; setShown(false) }
    const vis = () => go()
    const mo = new MutationObserver(go)
    mo.observe(root, { attributes: true, attributeFilter: ['class'] })
    v.addEventListener('timeupdate', wrapped); v.addEventListener('ended', ended); v.addEventListener('playing', playing); v.addEventListener('error', failed)
    v.addEventListener('loadeddata', go)
    document.addEventListener('visibilitychange', vis)
    const tap = replay?.current
    const poke = () => { if (rested) again() }
    tap?.addEventListener('pointerdown', poke, { passive: true })
    return () => {
      io.disconnect(); mo.disconnect()
      v.removeEventListener('timeupdate', wrapped); v.removeEventListener('ended', ended); v.removeEventListener('playing', playing); v.removeEventListener('error', failed)
      v.removeEventListener('loadeddata', go)
      document.removeEventListener('visibilitychange', vis)
      tap?.removeEventListener('pointerdown', poke)
      v.pause()
    }
  }, [off, base, replay, runs])

  if (off) return null
  return (
    <video ref={ref} className={className} src={src || undefined} preload={src ? 'auto' : 'none'} muted loop playsInline
      disablePictureInPicture disableRemotePlayback aria-hidden="true" tabIndex={-1} style={shown ? undefined : { opacity: 0 }} />
  )
}
