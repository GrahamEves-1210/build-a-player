import { useEffect, useRef, useState } from 'react'
import { engineFor } from '../../lib/mg'
import { STEP, hud, pads, stamp, fieldFor, text } from '../../lib/mg/kit'
import { spriteFrame, bakeSome, spritePx } from '../../lib/mg/art'
import { pilotFor, firstRep, AFTER, CAPTION, CAPTION_GAME } from '../../lib/mg/demo'
import { colorsFor, NO_HOME_FIELD, EMPTY_GAMES } from './MgStage'

// How to play, on the game's card: the real game (its own engine, make and draw) played by a perfect pilot
// (lib/mg/demo.js), one good rep, then it starts again. A ring shows each press where a thumb would go (a cursor
// on a computer). It's only a picture: its own copy of the game, no sounds, no haptics, nothing reported.
// It runs only while it's on screen; Reduce Motion and low power get one still frame and a button that plays it once.
const LW = 360, LH = 520          // the game's shortest layout
const TOP = 18                    // most of the game's title bar is cropped off (the card has the title): what's left is the caption's band
const BAR = 44                    // (where the game's title bar ends)
const VIS = LH - TOP              // what shows: 360 x 502
const V = 9                       // a strong player: the rep goes in
const STILL = 600, REST = 700     // ms on the opening picture, and on the last one before it starts again
const CAP = 16000                 // a demo that hasn't decided by now starts again
const pixelPt = () => { try { if (localStorage.getItem('bap_mg_pixel') === '0') return null; const v = Number(localStorage.getItem('bap_mg_pixel_pt')); return v >= 1 && v <= 4 ? v : 1.125 } catch { return 1.125 } }
const scanOn = () => { try { const v = localStorage.getItem('bap_mg_tex'); return (v == null ? 'scan' : v).split(',').includes('scan') } catch { return true } }
const quiet = () => { const c = document.documentElement.classList; return c.contains('bap-reduce-motion') || c.contains('low-power') }
// a seed that's been seen to miss (a real roster, a rare layout) is skipped for the rest of the visit
const bad = new Map()
const SEEDS = ['demo-0', 'demo-1', 'demo-2', 'demo-3', 'demo-4']
const SCAN_STYLE = { position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(rgba(0,0,0,.22) 0 1px, transparent 1px 3px)', mixBlendMode: 'multiply', opacity: 0.6 }

export default function MgDemo({ game, def, pos = null, sport = 'nfl', team = null, opp = null, home = 'team', superBowl = null, empty = false }) {
  const box = useRef(null), cv = useRef(null), ov = useRef(null)
  const [still, setStill] = useState(() => quiet())
  const [playing, setPlaying] = useState(false)   // (the still version: one run on a tap)
  const playOnce = useRef(null)
  const mouse = typeof window !== 'undefined' && !document.documentElement.classList.contains('is-app') && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
  const T = mouse ? 'CLICK' : 'TAP'

  useEffect(() => {
    const engine = engineFor(game)
    const el = cv.current, oel = ov.current
    if (!engine || !el || !oel) return
    const ctx = el.getContext('2d', { alpha: false }), octx = oel.getContext('2d')
    const key = `${game}|${pos ?? ''}`
    const cap = { ...CAPTION[engine.botName], ...CAPTION_GAME[game], ...CAPTION_GAME[`${game}:${pos}`] }
    const pressLine = () => (Array.isArray(cap.press) ? cap.press[Math.min(marks.length, cap.press.length) - 1] : cap.press)
    const field = sport === 'nfl' && !NO_HOME_FIELD.has(game) ? fieldFor(home === 'opp' ? opp : team, superBowl) : null
    const view = { w: LW, h: LH, px: 1, scale: 1, sport, accent: sport === 'bucket' ? '#ff8a3c' : sport === 'soccer' ? '#f2f4f5' : sport === 'baseball' ? '#f1e9d8' : '#3ddcb0', colors: colorsFor(sport, team, opp), cast: null, keys: mouse, field, empty: !!empty || EMPTY_GAMES.has(game) }
    let ovPx = 1, cssW = 0
    const PT = pixelPt()
    const fit = () => {
      const w = box.current?.getBoundingClientRect().width
      if (!w || Math.abs(w - cssW) < 0.5) return false
      cssW = w
      const dens = Math.min(2, window.devicePixelRatio || 1)
      const W = Math.max(1, Math.round(PT ? w / PT : w * dens))
      view.px = W / LW; view.scale = w / LW
      el.width = W; el.height = Math.round(VIS * view.px)
      el.style.imageRendering = PT ? 'pixelated' : ''
      ctx.imageSmoothingEnabled = !PT
      oel.width = Math.round(w * dens); ovPx = oel.width / LW; oel.height = Math.round(VIS * ovPx)
      return true
    }
    // ── a run: a fresh game, its pilot, the presses it made ──
    let g = null, step = null, marks = [], res = null, resAt = 0, endAt = Infinity, restUntil = 0, firstIn = null, seedI = 0, phase = 'still', clock = 0
    let plan = [], lastPlan = [], cur = null   // (the cursor: where each press of the last run was, so it can get there first)
    const seedNow = () => { const b = bad.get(key) ?? 0; seedI = Math.min(b, SEEDS.length - 1); return SEEDS[seedI] }
    const start = () => {
      g = engine.make({ v: V, arm: V, seed: seedNow(), def, game, sport, pos, cast: null, situation: null })
      step = pilotFor(engine.botName, g, game)
      marks = []; res = null; resAt = 0; endAt = Infinity; firstIn = null; phase = 'still'; clock = 0
      lastPlan = plan.length ? plan : lastPlan; plan = []; cur = null
    }
    const spotOf = a => {
      const n = g.pads?.length
      if (n) {
        const i = n === 1 ? 0 : a.zone === 'L' ? 0 : a.zone === 'R' ? 1 : typeof a.zone === 'number' ? a.zone : 0
        const pw = (LW - 8 * (n + 1)) / n
        return { x: 8 + i * (pw + 8) + pw / 2, y: LH - 48 }
      }
      if (a.zone === 'L' || a.zone === 'R') return { x: a.zone === 'L' ? 90 : 270, y: a.y || LH * 0.62 }
      if (typeof a.zone === 'number') return { x: 60 + a.zone * 120, y: Math.min(a.y || 360, LH - 40) }
      if (a.x || a.y) return { x: a.x, y: a.y }
      return { x: LW / 2, y: TOP + VIS / 2 }
    }
    const tick = () => {
      const ins = step()
      if (ins) for (const a of ins) {
        // (where it lands is read first: a press can change the pads under it)
        const p = a.kind === 'down' ? spotOf(a) : null
        g.input(a)
        if (p) {
          marks.push({ ...p, at: g.t, up: null, hold: !!a.hold })
          plan.push({ t: g.t, x: p.x, y: p.y })
          if (firstIn == null) firstIn = g.t
          if (marks.length > 24) marks.splice(0, marks.length - 24)
        } else {
          const m = [...marks].reverse().find(k => k.hold && k.up == null)
          if (m) m.up = g.t
        }
      }
      g.tick(STEP)
      g.fx.length = 0
      if (res == null) {
        const r = firstRep(game, g)
        if (r != null) {
          res = r; resAt = g.t; endAt = g.t + (AFTER[game] ?? AFTER.default)
          if (!r) bad.set(key, seedI + 1)
          if (import.meta.env.DEV) (window.__mgDemo ??= { runs: [] }).runs.push({ game, pos, seed: SEEDS[seedI], hit: r, t: Math.round(g.t) })
        } else if (g.t > CAP) { res = false; endAt = g.t }
      }
    }
    // ── the picture ──
    const caption = () => {
      const last = marks[marks.length - 1]
      if (last) {
        if (last.hold && last.up == null) return pressLine()
        if (last.hold && g.t - last.up < 700) return cap.up ?? pressLine()
        if (!last.hold && g.t - last.at < 900) return pressLine()
        return null
      }
      return res == null ? cap.wait ?? null : null
    }
    const drawMarks = x => {
      x.lineWidth = 2.5
      for (const m of marks) {
        const held = m.hold && m.up == null
        const age = m.hold ? g.t - m.up : g.t - m.at
        if (held) {
          // a thumb held down: the ring stays, tight, until it lets go
          x.lineWidth = 3
          x.strokeStyle = 'rgba(255,255,255,.95)'; x.beginPath(); x.arc(m.x, m.y, 19, 0, Math.PI * 2); x.stroke()
          x.fillStyle = 'rgba(255,255,255,.2)'; x.fill()
          continue
        }
        // a tap (or a let-go): the ring opens out and goes
        if (age < 0 || age > 460) continue
        const f = age / 460
        x.lineWidth = 3 - f
        x.strokeStyle = `rgba(255,255,255,${(0.95 * (1 - f * f)).toFixed(3)})`
        x.beginPath(); x.arc(m.x, m.y, 14 + 22 * f, 0, Math.PI * 2); x.stroke()
        if (f < 0.3) { x.fillStyle = `rgba(255,255,255,${(0.28 * (1 - f / 0.3)).toFixed(3)})`; x.beginPath(); x.arc(m.x, m.y, 14, 0, Math.PI * 2); x.fill() }
      }
    }
    // the cursor: it rests off to the side, and heads for the next press it knows of (the last run's) in time to
    // make it. The first run doesn't know: it goes as the press lands. Two hands at once (left, right, flat out) has no cursor
    const REST_AT = { x: LW * 0.7, y: TOP + VIS * 0.58 }
    const cursorAt = () => {
      const n = marks.length, last = marks[n - 1]
      if (n > 1 && last.at - marks[n - 2].at < 220 && (last.x !== marks[n - 2].x || last.y !== marks[n - 2].y)) return null
      const next = lastPlan.find(p => p.t > g.t - 30)
      let want = REST_AT, k = 0.12
      if (next && next.t - g.t < 520) { want = next; k = 0.1 + 0.4 * (1 - Math.max(0, next.t - g.t) / 520) }
      else if (last && g.t - last.at < 1400) { want = last; k = 0.35 }
      cur ??= { ...REST_AT }
      cur.x += (want.x - cur.x) * k; cur.y += (want.y - cur.y) * k
      return cur
    }
    const drawCursor = (x, p) => {
      x.save(); x.translate(p.x, p.y); x.scale(1.3, 1.3)
      x.beginPath(); x.moveTo(0, 0); x.lineTo(0, 17); x.lineTo(4.2, 13.2); x.lineTo(7.4, 20); x.lineTo(10, 18.8); x.lineTo(6.9, 12.2); x.lineTo(12.2, 12.2); x.closePath()
      x.fillStyle = '#fff'; x.fill(); x.lineWidth = 1.3; x.strokeStyle = '#06100c'; x.stroke()
      x.restore()
    }
    const draw = (first = false) => {
      spriteFrame(first ? Infinity : 4, ctx)
      ctx.setTransform(view.px, 0, 0, view.px, 0, -TOP * view.px)
      try {
        if (g.nudge) g.nudge.apply(ctx, g.t, view)
        engine.draw(ctx, g, view)
        octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, oel.width, oel.height)
        octx.setTransform(ovPx, 0, 0, ovPx, 0, -TOP * ovPx)
        hud(octx, view, g, def.title)
        pads(octx, view, g)
        stamp(octx, view, g)
        drawMarks(octx)
        if (mouse) { const p = cursorAt(); if (p) drawCursor(octx, p) }
        // the band at the top: what to do, when it needs saying
        octx.fillStyle = '#0a1013'; octx.fillRect(0, TOP, LW, BAR - TOP)
        const line = caption()
        if (line) text(octx, line.replace('{T}', T), LW / 2, (TOP + BAR) / 2 + 1, { size: 16, track: 1.4, color: '#fff' })
      } catch (e) {
        if (import.meta.env.DEV) setTimeout(() => { throw e })
      }
      bakeSome(first ? 8 : 2)
    }

    // ── the loop: only while it's on screen ──
    let raf = 0, last = 0, acc = 0, seen = true, alive = true, spent = 0, frames = 0
    const frame = now => {
      raf = 0
      if (!alive) return
      const t0 = performance.now()
      const dt = Math.min(50, now - (last || now)); last = now
      if (fit()) spritePx(view.px)
      if (phase === 'still') {
        clock += dt
        draw(clock === dt)
        if (clock >= STILL) phase = 'run'
      } else if (phase === 'run') {
        acc += dt
        let n = 0
        while (acc >= STEP) { acc -= STEP; tick(); n++; if (g.t >= endAt) break }
        if (n) draw()
        if (g.t >= endAt) { phase = 'rest'; restUntil = now + REST }
      } else if (phase === 'rest' && now >= restUntil) {
        if (playOnce.current) { playOnce.current = null; setPlaying(false); toStill(); return }
        start(); draw(true)
      }
      if (import.meta.env.DEV) { spent += performance.now() - t0; frames++; if (frames % 60 === 0) { (window.__mgDemo ??= { runs: [] }).cost = +(spent / frames).toFixed(2) } }
      if (seen) raf = requestAnimationFrame(frame)
    }
    const run = () => { if (!raf && alive && seen) { last = 0; raf = requestAnimationFrame(frame) } }
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0 }

    // ── the still version: run it on without showing it to just after the first press, and draw that ──
    let ffRaf = 0
    const toStill = () => {
      stop(); start(); phase = 'ff'
      fit(); spritePx(view.px)
      // (into a canvas nobody sees: Reduce Motion never gets the fast-forward)
      const sc = document.createElement('canvas'); sc.width = el.width; sc.height = el.height
      const sctx = sc.getContext('2d')
      const ff = () => {
        ffRaf = 0
        if (!alive) return
        const end = performance.now() + 8
        // (drawn as it goes, a frame a 30th of a second: some games keep their camera in the picture)
        while (performance.now() < end) {
          for (let i = 0; i < 4; i++) tick()
          sctx.setTransform(view.px, 0, 0, view.px, 0, -TOP * view.px)
          try { engine.draw(sctx, g, view) } catch {}
          if ((firstIn != null && g.t >= firstIn + 150) || res != null || g.t > CAP) { draw(true); return }
        }
        ffRaf = requestAnimationFrame(ff)
      }
      ffRaf = requestAnimationFrame(ff)
    }
    playOnce.current = null
    const playStill = () => { if (ffRaf) cancelAnimationFrame(ffRaf); ffRaf = 0; playOnce.current = true; start(); draw(true); run() }

    fit(); spritePx(view.px)
    start()
    let io = null
    if (still) toStill()
    else {
      draw(true)
      io = window.IntersectionObserver ? new IntersectionObserver(es => { seen = es[es.length - 1].isIntersecting; if (seen) run(); else stop() }) : null
      io?.observe(box.current)
      run()
    }
    const ro = window.ResizeObserver ? new ResizeObserver(() => { if (fit()) { spritePx(view.px); if (!raf) draw() } }) : null
    ro?.observe(box.current)
    box.current.__play = playStill
    return () => { alive = false; stop(); if (ffRaf) cancelAnimationFrame(ffRaf); io?.disconnect(); ro?.disconnect() }
  }, [game, pos, still]) // eslint-disable-line react-hooks/exhaustive-deps

  // (Reduce Motion switched on or off while the card's up)
  useEffect(() => {
    const mo = new MutationObserver(() => setStill(quiet()))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])

  return (
    <div className="mg-demo" ref={box} aria-label={`How to play ${def.title}`} role="img">
      <canvas ref={cv} className="mg-demo-cv" aria-hidden="true" />
      {pixelPt() && scanOn() && <div aria-hidden="true" style={SCAN_STYLE} />}
      <canvas ref={ov} className="mg-demo-cv" aria-hidden="true" />
      {still && !playing && <button type="button" className="mg-demo-play" onClick={() => { setPlaying(true); box.current?.__play?.() }}>{T} TO PLAY DEMO</button>}
    </div>
  )
}
