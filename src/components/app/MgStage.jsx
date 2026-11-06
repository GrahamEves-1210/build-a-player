import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { STEP, hud, pads, stamp, keyCap, THREE_KEYS, fieldFor } from '../../lib/mg/kit'
import { engineFor } from '../../lib/mg'
import { spriteFrame, bakeSome, spritePx } from '../../lib/mg/art'
import { sfx, haptic } from '../../lib/juice'

// The stage a skill game plays on: the whole screen, one canvas, one requestAnimationFrame loop.
// React renders this once and never again while a game runs, so nothing can cost a frame. The
// page under it stops painting (html.mg-live). A press is judged at the moment it happened
// (the event's own timestamp): the rules are stepped up to that moment first, so a slow frame
// can't turn a good tap into a late one.
export const MAX_W = 460
const rgb = h => { const n = parseInt(String(h).replace('#', '').slice(0, 6), 16); return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [128, 128, 128] }
const far = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) }
// The player's team and who they're facing, in the colours their player models wear: the team's
// colour on the jersey, its second colour on the helmet, pants and trim. When the two teams would
// be hard to tell apart the other side changes the way an away team does: its second colour with the
// first as trim, or white if that's close too. No team (practice): the stock look.
const AWAY = '#e8edf2'
export function colorsFor(sport, team, opp) {
  const us = team?.color ?? (sport === 'bucket' ? '#c2571c' : '#14745a')
  const trim = team?.color2 ?? '#f4efe6'
  if (!opp) {
    const them = far(us, '#c9423a') < 110 ? AWAY : '#c9423a'
    return { us, trim, them, themTrim: them === AWAY ? '#20262c' : '#f4efe6' }
  }
  if (far(us, opp.color) >= 110) return { us, trim, them: opp.color, themTrim: opp.color2 ?? '#f4efe6' }
  if (opp.color2 && far(us, opp.color2) >= 110) return { us, trim, them: opp.color2, themTrim: opp.color }
  return { us, trim, them: AWAY, themTrim: opp.color }
}
// the combine's drills aren't on anyone's home field
const NO_HOME_FIELD = new Set(['forty', 'cone', 'bench', 'velo', 'acc', 'gauntlet'])
export default function MgStage({ game, def, v, arm, seed, sport = 'nfl', team = null, opp = null, home = 'team', superBowl = null, pos: playerPos = null, cast = null, situation = null, onDone, children = null }) {
  const canvas = useRef(null)
  const box = useRef(null)
  const done = useRef(onDone); done.current = onDone

  useEffect(() => {
    const engine = engineFor(game)
    if (!engine) return
    document.documentElement.classList.add('mg-live')
    const el = canvas.current
    // opaque: the browser needn't blend it with the page
    const ctx = el.getContext('2d', { alpha: false })
    const g = engine.make({ v, arm, seed, def, game, sport, pos: playerPos, cast, situation })
    g.sit ??= situation
    if (import.meta.env.DEV) window.__bapGame = g   // (for scripts/mg's browser tests)
    const c = colorsFor(sport, team, opp)
    const accent = sport === 'bucket' ? '#ff8a3c' : '#3ddcb0'
    // (keys: a computer with a mouse and a keyboard, where the buttons show their keys)
    const keys = !document.documentElement.classList.contains('is-app') && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
    const field = sport === 'nfl' && !NO_HOME_FIELD.has(game) ? fieldFor(home === 'opp' ? opp : team, superBowl) : null
    const view = { w: 360, h: 640, px: 2, scale: 1, sport, accent, colors: c, cast, keys, field }
    let dirty = true   // (something other than the rules changed the picture)
    const fit = () => {
      if (!box.current) return   // (a last resize can land as the stage closes)
      const r = box.current.getBoundingClientRect()
      // (never wider than the height allows: the game's shortest layout, 520, has to fit above the ad rail)
      const roomW = Math.min(r.width, MAX_W, r.height * (360 / 520))
      // (2x is as sharp as a phone shows, and a quarter of the pixels of 4x on some Androids)
      // (Reduce motion: 1x, a quarter of the pixels of a 2x screen to fill every frame)
      const dens = document.documentElement.classList.contains('bap-reduce-motion') ? 1 : Math.min(2, window.devicePixelRatio || 1)
      // whole canvas pixels, and the element sized to exactly that many: the browser never has to resample the
      // picture to fit, which softens every line and costs the compositor a scale
      const W = Math.max(1, Math.round(roomW * dens)), px = W / 360, scale = W / dens / 360
      const logicalH = Math.round(Math.max(520, Math.min(r.height, roomW * (780 / 360)) / scale))
      const H = Math.round(logicalH * px)
      view.scale = scale
      if (W === el.width && H === el.height && view.px === px && view.h === logicalH) return   // (setting a canvas's size wipes it, even to the same size)
      view.h = logicalH; view.px = px
      spritePx(px)
      el.style.width = `${W / dens}px`; el.style.height = `${H / dens}px`
      el.width = W; el.height = H
      dirty = true
    }
    fit()
    // A size change remakes every baked picture at the new size: wait until the window stops moving
    let fitWait = 0
    const refit = () => { clearTimeout(fitWait); fitWait = setTimeout(fit, 120) }
    window.addEventListener('resize', refit)
    // (the room changes without the window changing: an ad rail loading or closing under the stage)
    const boxWatch = window.ResizeObserver ? new ResizeObserver(refit) : null
    boxWatch?.observe(box.current)

    // a brief still moment on the opening picture before the clock starts, so a game never starts with a jolt.
    // It starts once the picture is up: a slow machine's first frame can take longer than the moment itself.
    let startAt = Infinity
    let raf = 0, last = 0, acc = STEP / 2, ended = 0, gone = false, keyed = null, keyOrder = null
    let lastFrame = 0, cadence = 0, stepped = 0
    const keyLabel = (i, n) => (n === 1 ? 'SPACE' : n === 3 ? THREE_KEYS[i] : String(i + 1))
    const keyIndex = (k, n) => {
      if (n === 1) return k === ' ' || k === 'Enter' ? 0 : -1
      if (n === 3) { const a = { ArrowLeft: 0, ArrowUp: 1, ArrowDown: 1, ArrowRight: 2 }[k]; if (a != null) return a }
      const d = Number(k)
      return k !== ' ' && d >= 1 && d <= n ? d - 1 : -1
    }
    const heldKeys = new Map()
    const flush = () => {
      if (!g.fx.length) return
      for (const f of g.fx) { if (f.startsWith('h:')) haptic(f.slice(2)); else sfx(f) }
      g.fx.length = 0
    }
    // run the rules up to a moment in time (a press's timestamp, or this frame)
    const advance = to => {
      const dt = Math.min(250, to - last)    // (a background tab must not fast-forward the game)
      if (dt <= 0) return
      last = to; acc += dt
      while (acc >= STEP) { g.tick(STEP); acc -= STEP; stepped++ }
    }
    const frame = t => {
      const began = performance.now()
      if (t >= startAt) {
        advance(t)
        // Pacing. The rules run in steps of 1/120 s and a frame shows however many fit. On a 60 Hz or 120 Hz screen a frame is a
        // whole number of steps, so whether it shows 2 steps every time or a stutter of 1, 3, 2, 1, 3 comes down to where the
        // remainder sits and a tenth of a millisecond of jitter in the timestamps. It starts in the middle of a step, and on those
        // screens it's held there, which takes up a screen that's really 59.94 Hz too. Never more than a fraction of a millisecond.
        const d = t - lastFrame
        if (d > 0 && d < 50 && (!cadence || d < cadence * 1.5)) cadence = cadence ? cadence * 0.9 + d * 0.1 : d
        const ratio = cadence / STEP, whole = Math.round(ratio)
        if (whole >= 1 && Math.abs(ratio - whole) < 0.04) acc += (STEP / 2 - acc) * 0.04
      }
      lastFrame = t
      flush()
      // (a screen faster than the rules: nothing has moved since the last frame, so there's nothing to draw)
      if (!stepped && !dirty && t >= startAt) { raf = requestAnimationFrame(frame); return }
      stepped = 0; dirty = false
      spriteFrame(startAt === Infinity ? Infinity : 4, ctx)
      ctx.setTransform(view.px, 0, 0, view.px, 0, 0)
      try {
        // (a game can carry a nudge, kit.js: the picture takes the hit, the HUD holds still)
        if (g.nudge) { g.nudge.apply(ctx, g.t, view); engine.draw(ctx, g, view); ctx.setTransform(view.px, 0, 0, view.px, 0, 0) }
        else engine.draw(ctx, g, view)
        // the games you play by pointing at a man: each man has a key too, left to right across the screen
        keyed = g.keyTargets?.() ?? null
        // (numbered left to right when the play starts, and each man keeps his number however the routes cross)
        if (!keyed) keyOrder = null
        else if (!keyed[0]?.keys) {
          if (!keyOrder || keyOrder.length !== keyed.length) keyOrder = keyed.map((p, i) => [p.x, i]).sort((a, b) => a[0] - b[0]).map(e => e[1])
          keyed = keyOrder.map(i => keyed[i])
        }
        if (keyed && view.keys) keyed.forEach((p, i) => keyCap(ctx, p.x, Math.max(14, p.y - 42), p.label ?? keyLabel(i, keyed.length)))
        hud(ctx, view, g, def.title)
        pads(ctx, view, g)
        stamp(ctx, view, g)
      } catch (e) {
        if (import.meta.env.DEV) setTimeout(() => { throw e })   // (loud on the dev server)
      }
      // the first picture's up: the still moment starts now
      if (startAt === Infinity) { startAt = performance.now() + 700; last = startAt }
      // sprites waiting to be painted, in what's left of the frame (the still moment has plenty)
      bakeSome(t < startAt ? 8 : Math.max(0, 6 - (performance.now() - began)))
      if (g.done) {
        if (!ended) { ended = t; sfx(g.done.hit ? 'claim' : 'deny'); haptic(g.done.hit ? 'success' : 'heavy') }
        if (t - ended >= (g.outro ?? 1100)) { gone = true; done.current?.(g.done); return }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const zoneOf = x => (g.zones === 'lr' ? (x < 180 ? 'L' : 'R') : g.zones === 'three' ? (x < 120 ? 0 : x < 240 ? 1 : 2) : null)
    const send = (kind, e, zone, x = 0, y = 0) => {
      if (gone) return
      const at = e?.timeStamp > 0 ? Math.min(e.timeStamp, performance.now()) : performance.now()
      if (performance.now() < startAt) return
      advance(at)
      g.input({ kind, zone, x, y })
      flush()
    }
    const pos = e => { const r = el.getBoundingClientRect(); return [(e.clientX - r.left) / view.scale, (e.clientY - r.top) / view.scale] }
    const down = e => { e.preventDefault(); const [x, y] = pos(e); el.setPointerCapture?.(e.pointerId); send('down', e, zoneOf(x), x, y) }
    const up = e => { const [x, y] = pos(e); send('up', e, zoneOf(x), x, y) }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    // keys: left/right and A/D/F/J; 1 2 3; space and enter hold or tap
    const keyZone = k => {
      if (g.zones === 'lr') return { ArrowLeft: 'L', a: 'L', f: 'L', A: 'L', F: 'L', ArrowRight: 'R', d: 'R', j: 'R', D: 'R', J: 'R' }[k]
      if (g.zones === 'three') return { 1: 0, 2: 1, 3: 2, ArrowLeft: 0, ArrowUp: 1, ArrowDown: 1, ArrowRight: 2, ...(g.anyKey ? { ' ': 1, Enter: 1 } : null) }[k]
      return k === ' ' || k === 'Enter' ? null : undefined
    }
    // (g.aim: the game is played by pointing at the field; a key has no spot to send)
    const kd = e => {
      if (g.keyTargets) {
        if (e.repeat || !keyed?.length) return
        // (a game can set a man's keys itself; otherwise they go by where he is, left to right)
        const i = keyed[0]?.keys ? keyed.findIndex(p => p.keys?.includes(e.key)) : keyIndex(e.key, keyed.length)
        if (i < 0) return
        e.preventDefault()
        const p = keyed[i]
        heldKeys.set(e.key, { x: p.x, y: p.y })
        send('down', e, null, p.x, p.y)
        return
      }
      if (g.aim) return
      const z = keyZone(e.key)
      if (z === undefined || e.repeat) return
      e.preventDefault(); send('down', e, z, 180, 0)
    }
    const ku = e => {
      if (g.keyTargets) { const p = heldKeys.get(e.key); if (p) { heldKeys.delete(e.key); send('up', e, null, p.x, p.y) } return }
      if (g.aim) return
      const z = keyZone(e.key); if (z !== undefined) send('up', e, z, 180, 0) }
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(fitWait)
      gone = true
      // (a game left listening would take presses meant for the next one)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      document.documentElement.classList.remove('mg-live')
      window.removeEventListener('resize', refit)
      boxWatch?.disconnect()
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku)
      if (import.meta.env.DEV && window.__bapGame === g) delete window.__bapGame
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div className="mg-stage">
      {children}
      <div className="mg-box" ref={box}><canvas ref={canvas} className="mg-canvas" aria-label={def.title} /></div>
    </div>,
    document.body,
  )
}
