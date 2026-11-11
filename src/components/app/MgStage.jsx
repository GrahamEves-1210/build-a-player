import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { STEP, hud, pads, stamp, keyCap, THREE_KEYS, fieldFor } from '../../lib/mg/kit'
import { engineFor } from '../../lib/mg'
import { spriteFrame, bakeSome, spritePx } from '../../lib/mg/art'
import { sfx, haptic } from '../../lib/juice'
import { COMBINE_GAMES } from '../../lib/minigames'

// PIXEL LOOK (a trial): every game drawn into a low-resolution picture, PIXEL_PT screen points to a game pixel, and
// shown blown up with no smoothing: crisp chunky pixels, a 32-bit handheld's resolution. The HUD (title, prompt, pads,
// the verdict stamp, key caps) goes on its own full-resolution layer on top, so it stays sharp. One switch for every
// game: localStorage bap_mg_pixel '1' on / '0' off; on by default on the dev server only, to judge it
const readPt = () => { try { const v = Number(localStorage.getItem('bap_mg_pixel_pt')); return v >= 1 && v <= 4 ? v : 1.125 } catch { return 1.125 } }
let PIXEL_PT = readPt()   // (the look everywhere: 1.125 with scanlines)   // (bap_mg_pixel_pt: 1.125 the default, finest; 1.25; 1.5 hi-bit; 2; 3 chunkier)
// TEXTURES (a dev tool, to compare looks): each one a layer over the game, from CSS and a few tiny generated tiles.
// None touches a game. The dev panel in the stage switches them (localStorage bap_mg_tex, a comma list), live
const TEX_KINDS = [['grain', 'GRAIN'], ['dither', 'DITHER'], ['halftone', 'HALFTONE'], ['scan', 'SCANLINES'], ['riso', 'RISO'], ['paper', 'PAPER']]
const PIXEL_SIZES = ['off', 1.125, 1.25, 1.5, 2, 3]
// (scanlines are the default look; a saved choice, even none, wins)
const readTex = () => { try { const v = localStorage.getItem('bap_mg_tex'); return new Set((v == null ? 'scan' : v).split(',').filter(Boolean)) } catch { return new Set(['scan']) } }
const TILES = {}
const tile = (key, w, h, paint) => {
  if (TILES[key]) return TILES[key]
  const c = document.createElement('canvas'); c.width = w; c.height = h
  paint(c.getContext('2d'), w, h)
  return (TILES[key] = c.toDataURL())
}
const noiseTile = (key, n, a, blur = 0) => tile(key, n, n, (x, w, h) => {
  const d = x.createImageData(w, h)
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = a }
  x.putImageData(d, 0, 0)
  if (blur) { const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const y = c2.getContext('2d'); y.filter = `blur(${blur}px)`; y.drawImage(x.canvas, 0, 0); x.clearRect(0, 0, w, h); x.drawImage(c2, 0, 0) }
})
// a 4x4 ordered (Bayer) dither: the classic print / early-console dot order
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const ditherTile = () => tile('dither', 4, 4, x => { for (let i = 0; i < 16; i++) { const v = BAYER[i] / 15; x.fillStyle = `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${Math.abs(v - 0.5) * 0.9})`; x.fillRect(i % 4, Math.floor(i / 4), 1, 1) } })
function texLayers(on, pt) {
  const L = [], base = { position: 'absolute', inset: 0, pointerEvents: 'none' }
  if (on.has('grain')) L.push({ key: 'grain', style: { ...base, backgroundImage: `url(${noiseTile('grain', 160, 255)})`, backgroundSize: '160px 160px', mixBlendMode: 'overlay', opacity: 0.14, animation: 'mgGrain 0.5s steps(4) infinite' } })
  if (on.has('dither')) L.push({ key: 'dither', style: { ...base, backgroundImage: `url(${ditherTile()})`, backgroundSize: `${4 * (pt || 1.25)}px ${4 * (pt || 1.25)}px`, imageRendering: 'pixelated', mixBlendMode: 'soft-light', opacity: 0.55 } })
  if (on.has('halftone')) L.push({ key: 'halftone', style: { ...base, backgroundImage: 'radial-gradient(circle, rgba(0,0,0,.55) 0.9px, transparent 1.3px)', backgroundSize: '4px 4px', mixBlendMode: 'multiply', opacity: 0.45 } })
  if (on.has('scan')) L.push({ key: 'scan', style: { ...base, backgroundImage: 'repeating-linear-gradient(rgba(0,0,0,.22) 0 1px, transparent 1px 3px)', mixBlendMode: 'multiply', opacity: 0.6 } })
  if (on.has('riso')) L.push({ key: 'riso', style: { ...base, backgroundImage: `url(${noiseTile('riso', 120, 255)})`, backgroundSize: '120px 120px', mixBlendMode: 'soft-light', opacity: 0.22 } })
  if (on.has('paper')) L.push({ key: 'paper', style: { ...base, backgroundImage: `url(${noiseTile('paper', 256, 255, 1.2)})`, backgroundSize: '256px 256px', mixBlendMode: 'overlay', opacity: 0.16 } })
  return L
}
// ERA (a dev look): the picture graded like the TV of a decade. 70s: NFL Films-style warm, faded film with heavy grain
// and dark corners. 90s: soft VHS broadcast colour with scanlines
const ERA_FILTER = { '70s': 'sepia(.38) saturate(.72) contrast(.94) brightness(1.03)', '90s': 'saturate(1.18) contrast(.9) blur(.35px)' }
function eraLayers(era) {
  const base = { position: 'absolute', inset: 0, pointerEvents: 'none' }
  if (era === '70s') return [
    { key: 'era-grain', style: { ...base, backgroundImage: `url(${noiseTile('grain', 160, 255)})`, backgroundSize: '160px 160px', mixBlendMode: 'overlay', opacity: 0.24, animation: 'mgGrain 0.35s steps(3) infinite' } },
    { key: 'era-vig', style: { ...base, background: 'radial-gradient(ellipse at center, transparent 52%, rgba(20,10,0,.5) 100%)' } },
  ]
  if (era === '90s') return [
    { key: 'era-scan', style: { ...base, backgroundImage: 'repeating-linear-gradient(rgba(0,0,0,.2) 0 1px, transparent 1px 3px)', mixBlendMode: 'multiply', opacity: 0.55 } },
    { key: 'era-noise', style: { ...base, backgroundImage: `url(${noiseTile('riso', 120, 255)})`, backgroundSize: '120px 120px', mixBlendMode: 'overlay', opacity: 0.08 } },
  ]
  return []
}
// SLOW-MO (a dev look): the game's own clock, slowed. (In this trial it slows the whole game, timing included)
let TIME_SCALE = (() => { try { return localStorage.getItem('bap_mg_slow') === '1' ? 0.55 : 1 } catch { return 1 } })()
// WEATHER (a dev look): its own small canvas over the picture, running only while it's on
function Weather({ kind }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c || kind === 'fog') return
    const x = c.getContext('2d')
    let raf = 0, last = performance.now()
    const size = () => { const r = c.parentElement.getBoundingClientRect(); c.width = Math.round(r.width); c.height = Math.round(r.height) }
    size()
    const N = kind === 'snow' ? 110 : 150
    const P = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), z: 0.4 + Math.random() * 0.6, ph: Math.random() * 6.28 }))
    const tick = now => {
      const dt = Math.min(50, now - last) / 1000; last = now
      const w = c.width, h = c.height
      x.clearRect(0, 0, w, h)
      if (kind === 'snow') {
        x.fillStyle = 'rgba(255,255,255,.85)'
        for (const q of P) {
          q.y += dt * 0.06 * q.z; q.ph += dt * 1.4; if (q.y > 1.02) { q.y = -0.02; q.x = Math.random() }
          const px = (q.x + Math.sin(q.ph) * 0.006) * w, py = q.y * h, r = 0.8 + q.z * 1.7
          x.beginPath(); x.arc(px, py, r, 0, 6.29); x.fill()
        }
      } else {
        x.strokeStyle = 'rgba(200,215,230,.42)'; x.lineWidth = 1
        x.beginPath()
        for (const q of P) {
          q.y += dt * 1.1 * q.z; q.x -= dt * 0.12 * q.z; if (q.y > 1.05) { q.y = -0.05; q.x = Math.random() * 1.1 }
          const px = q.x * w, py = q.y * h, L = 9 + q.z * 9
          x.moveTo(px, py); x.lineTo(px - L * 0.18, py + L)
        }
        x.stroke()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [kind])
  if (kind === 'fog') return <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(205,212,220,.42) 0%, rgba(205,212,220,.18) 45%, rgba(205,212,220,0) 75%)' }} />
  return <canvas ref={ref} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
}
// (riso: the picture itself, a touch of print: less saturated, a little more contrast and warmth)
const RISO_FILTER = 'saturate(.82) contrast(1.08) sepia(.1)'
if (typeof document !== 'undefined' && !document.getElementById('mg-tex-css')) {
  const st = document.createElement('style'); st.id = 'mg-tex-css'
  st.textContent = '@keyframes mgGrain{0%{background-position:0 0}25%{background-position:-37px 21px}50%{background-position:19px -43px}75%{background-position:-11px 33px}}.mg-devtex{position:fixed;right:6px;top:50%;transform:translateY(-50%);flex-direction:column;align-items:stretch;z-index:2147483000;display:flex;flex-wrap:wrap;gap:4px;justify-content:center;max-width:96vw;padding:5px;border-radius:6px;background:rgba(6,9,12,.86);border:1px solid rgba(255,255,255,.14);font:600 10px/1 system-ui,sans-serif;letter-spacing:.6px}.mg-devtex button{padding:5px 7px;border-radius:4px;border:1px solid rgba(255,255,255,.18);background:transparent;color:#cfd6da;cursor:pointer}.mg-devtex button.is-on{background:#3ddcb0;color:#06120d;border-color:#3ddcb0}.mg-devtex b{align-self:center;color:#7d8a90;padding:0 3px}'
  document.head.appendChild(st)
}
const readPixel = () => { try { return localStorage.getItem('bap_mg_pixel') !== '0' } catch { return true } }
let PIXEL = readPixel()   // (on for everyone: '0' turns it off)

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
  const us = team?.color ?? (sport === 'bucket' ? '#c2571c' : sport === 'soccer' ? '#1f4fa8' : sport === 'baseball' ? '#c8102e' : '#14745a')
  const trim = team?.color2 ?? (sport === 'baseball' && !team ? '#14213d' : '#f4efe6')
  if (!opp) {
    const them = far(us, '#c9423a') < 110 ? AWAY : '#c9423a'
    return { us, trim, them, themTrim: them === AWAY ? '#20262c' : '#f4efe6' }
  }
  if (far(us, opp.color) >= 110) return { us, trim, them: opp.color, themTrim: opp.color2 ?? '#f4efe6' }
  if (opp.color2 && far(us, opp.color2) >= 110) return { us, trim, them: opp.color2, themTrim: opp.color }
  return { us, trim, them: AWAY, themTrim: opp.color }
}
// the combine's drills aren't on anyone's home field
export const NO_HOME_FIELD = new Set(['forty', 'cone', 'bench', 'velo', 'acc', 'gauntlet'])
// An empty house: every combine drill, every sport (football, soccer and baseball from COMBINE_GAMES, basketball's
// from SPORT.bucket.combine in lib/career.js), and anything played with the empty prop (training camp).
// The seats are there, nobody's in them: no crowd getting up, no flashes, no crowd sound
export const EMPTY_GAMES = new Set([...Object.values(COMBINE_GAMES).flat(), 'sprint', 'lane', 'spot', 'vert', 'nbench'])
const CROWD_SFX = new Set(['snd-roar'])
export default function MgStage({ game, def, v, arm, kick = null, seed, sport = 'nfl', team = null, opp = null, home = 'team', superBowl = null, pos: playerPos = null, cast = null, situation = null, weather = null, empty = false, onDone, children = null }) {
  const canvas = useRef(null)
  const box = useRef(null)
  const hudCanvas = useRef(null)
  // (a game opening reads the look fresh: the Settings switch, or the dev panel, may have changed it since)
  useState(() => { PIXEL = readPixel(); PIXEL_PT = readPt() })
  const [tex, setTex] = useState(readTex)
  const [devOpen, setDevOpen] = useState(false)
  const keep = (k, v) => { try { localStorage.setItem(k, v) } catch {} }
  const got = (k, d) => { try { return localStorage.getItem(k) ?? d } catch { return d } }
  const [era, setEra] = useState(() => got('bap_mg_era', 'off'))
  const [wx, setWx] = useState(() => got('bap_mg_wx', 'off'))
  const [bars, setBars] = useState(() => got('bap_mg_bars', '1') === '1')   // (the big-moment bars: on for everyone; the dev panel can switch them off)
  const [slow, setSlow] = useState(() => TIME_SCALE < 1)
  const pickEra = v => { setEra(v); keep('bap_mg_era', v) }
  const pickWx = v => { setWx(v); keep('bap_mg_wx', v) }
  const flipBars = () => setBars(b => { keep('bap_mg_bars', b ? '0' : '1'); return !b })
  // (the bars are a letterbox: their own space above and below the picture, never over it, so nothing a game draws,
  // its text or its buttons, is ever under one)
  const barTop = useRef(null), barBot = useRef(null), barsOn = useRef(bars)
  barsOn.current = bars
  useEffect(() => { window.dispatchEvent(new Event('mg-pixel')) }, [bars])
  const flipSlow = () => setSlow(v => { TIME_SCALE = v ? 1 : 0.55; keep('bap_mg_slow', v ? '0' : '1'); return !v })   // (the dev look panel: a small button until it's wanted)
  const [pix, setPix] = useState(() => (PIXEL ? PIXEL_PT : 'off'))   // (the dev panel changes it live)
  const pixPt = pix === 'off' ? null : pix
  const toggleTex = k => setTex(t => { const n = new Set(t); n.has(k) ? n.delete(k) : n.add(k); try { localStorage.setItem('bap_mg_tex', [...n].join(',')) } catch {}; return n })
  const setPixel = v => {
    try { if (v === 'off') localStorage.setItem('bap_mg_pixel', '0'); else { localStorage.setItem('bap_mg_pixel', '1'); localStorage.setItem('bap_mg_pixel_pt', String(v)) } } catch {}
    PIXEL = v !== 'off'; if (PIXEL) PIXEL_PT = v
    setPix(v)
    window.dispatchEvent(new Event('mg-pixel'))   // (the stage remakes its picture at the new size: no reload)
  }
  const done = useRef(onDone); done.current = onDone

  useEffect(() => {
    const engine = engineFor(game)
    if (!engine) return
    document.documentElement.classList.add('mg-live')
    const el = canvas.current
    // opaque: the browser needn't blend it with the page
    const ctx = el.getContext('2d', { alpha: false })
    // (the pixel look: the HUD's own sharp layer over the game's pixels)
    const ov = hudCanvas.current, octx = ov ? ov.getContext('2d') : null
    let ovPx = 1
    // (the HUD on its own sharp layer, over the picture and every look laid on it, the bars included: the title, the
    // prompts, the pads and the stamps are never under a bar or a texture)
    const split = () => !!octx
    const hudCtx = () => (split() ? octx : ctx)
    const g = engine.make({ v, arm, kick, seed, def, game, sport, pos: playerPos, cast, situation })   // (kick: a kicker's three ratings, each its own: lib/mg/kick.js)
    g.sit ??= situation
    if (import.meta.env.DEV) window.__bapGame = g   // (for scripts/mg's browser tests)
    const c = colorsFor(sport, team, opp)
    const accent = sport === 'bucket' ? '#ff8a3c' : sport === 'soccer' ? '#f2f4f5' : sport === 'baseball' ? '#f1e9d8' : '#3ddcb0'
    // (keys: a computer with a mouse and a keyboard, where the buttons show their keys)
    const keys = !document.documentElement.classList.contains('is-app') && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
    const field = sport === 'nfl' && !NO_HOME_FIELD.has(game) ? fieldFor(home === 'opp' ? opp : team, superBowl) : null
    const view = { w: 360, h: 640, px: 2, scale: 1, sport, accent, colors: c, cast, keys, field, empty: !!empty || EMPTY_GAMES.has(game) || (import.meta.env.DEV && /[?&]empty=1/.test(location.search)) }   // (?empty=1 on the dev server: any game as camp plays it)
    let dirty = true   // (something other than the rules changed the picture)
    const fit = () => {
      if (!box.current) return   // (a last resize can land as the stage closes)
      const r0 = box.current.getBoundingClientRect()
      // (the bars take their share of the height first; the picture fits in what's left)
      const barH = barsOn.current ? Math.round(Math.min(60, Math.max(28, r0.height * 0.065))) : 0
      const r = { width: r0.width, height: r0.height - barH * 2 }
      // (never wider than the height allows: the game's shortest layout, 520, has to fit above the ad rail)
      const roomW = Math.min(r.width, MAX_W, r.height * (360 / 520))
      // (2x is as sharp as a phone shows, and a quarter of the pixels of 4x on some Androids)
      // (Reduce motion: 1x, a quarter of the pixels of a 2x screen to fill every frame)
      const dens = document.documentElement.classList.contains('bap-reduce-motion') ? 1 : Math.min(2, window.devicePixelRatio || 1)
      // whole canvas pixels, and the element sized to exactly that many: the browser never has to resample the
      // picture to fit, which softens every line and costs the compositor a scale
      // (the pixel look: the game's picture is a pixel every PIXEL_PT points, stretched to the same size on screen)
      const gd = PIXEL ? 1 / PIXEL_PT : dens
      const W = Math.max(1, Math.round(roomW * gd)), px = W / 360, scale = roomW / 360
      const logicalH = Math.round(Math.max(520, Math.min(r.height, roomW * (780 / 360)) / scale))
      const H = Math.round(logicalH * px)
      view.scale = scale
      for (const b of [barTop.current, barBot.current]) if (b) { b.style.width = `${roomW}px`; b.style.height = `${barH}px` }
      if (W === el.width && H === el.height && view.px === px && view.h === logicalH) return   // (setting a canvas's size wipes it, even to the same size)
      view.h = logicalH; view.px = px
      spritePx(px)
      const cssW = roomW, cssH = logicalH * scale
      for (const b of [barTop.current, barBot.current]) if (b) { b.style.width = `${cssW}px`; b.style.height = `${barH}px` }
      el.style.width = `${cssW}px`; el.style.height = `${cssH}px`
      el.width = W; el.height = H
      el.style.imageRendering = PIXEL ? 'pixelated' : ''
      ctx.imageSmoothingEnabled = !PIXEL
      if (ov) ov.style.display = split() ? '' : 'none'
      if (ov && split()) {
        ovPx = (Math.round(cssW * dens)) / 360
        ov.style.width = `${cssW}px`; ov.style.height = `${cssH}px`
        ov.width = Math.round(cssW * dens); ov.height = Math.round(cssH * dens)
      }
      dirty = true
    }
    fit()
    // A size change remakes every baked picture at the new size: wait until the window stops moving
    let fitWait = 0
    const refit = () => { clearTimeout(fitWait); fitWait = setTimeout(fit, 120) }
    window.addEventListener('resize', refit)
    // (the dev panel's pixel switch: the picture remade at the new size straight away)
    const repixel = () => { fit(); dirty = true }
    window.addEventListener('mg-pixel', repixel)
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
      for (const f of g.fx) { if (f.startsWith('h:')) haptic(f.slice(2)); else if (!(view.empty && CROWD_SFX.has(f))) sfx(f) }
      g.fx.length = 0
    }
    // run the rules up to a moment in time (a press's timestamp, or this frame)
    const advance = to => {
      const dt = Math.min(250, to - last)    // (a background tab must not fast-forward the game)
      if (dt <= 0) return
      last = to; acc += dt * TIME_SCALE
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
      spriteFrame(startAt === Infinity ? Infinity : 4, ctx, g.t)
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
        const hctx = hudCtx()
        if (hctx !== ctx) { hctx.setTransform(1, 0, 0, 1, 0, 0); hctx.clearRect(0, 0, ov.width, ov.height); hctx.setTransform(ovPx, 0, 0, ovPx, 0, 0) }
        if (keyed && view.keys) keyed.forEach((p, i) => keyCap(hctx, p.x, Math.max(14, p.y - 42), p.label ?? keyLabel(i, keyed.length)))
        hud(hctx, view, g, def.title)
        pads(hctx, view, g)
        stamp(hctx, view, g)
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
      g.input({ kind, zone, x, y, id: e?.pointerId ?? 0 })
      flush()
    }
    const pos = e => { const r = el.getBoundingClientRect(); return [(e.clientX - r.left) / view.scale, (e.clientY - r.top) / view.scale] }
    const down = e => { e.preventDefault(); const [x, y] = pos(e); el.setPointerCapture?.(e.pointerId); send('down', e, zoneOf(x), x, y) }
    const up = e => { const [x, y] = pos(e); send('up', e, zoneOf(x), x, y) }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    // (g.stick: a game played with a thumbstick, Get a Bucket: it needs the finger as it moves, too)
    const move = e => { if (!g.stick) return; const [x, y] = pos(e); send('move', e, null, x, y) }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointercancel', up)
    // keys: left/right and A/D/F/J; 1 2 3; space and enter hold or tap
    const keyZone = k => {
      if (g.zones === 'lr') return { 1: 'L', 3: 'R', ArrowLeft: 'L', a: 'L', f: 'L', A: 'L', F: 'L', ArrowRight: 'R', d: 'R', j: 'R', D: 'R', J: 'R' }[k]
      if (g.zones === 'three') return { 1: 0, 2: 1, 3: 2, ArrowLeft: 0, ArrowUp: 1, ArrowDown: 1, ArrowRight: 2, ...(g.anyKey ? { ' ': 1, Enter: 1 } : null) }[k]
      return k === ' ' || k === 'Enter' ? null : undefined
    }
    // (g.aim: the game is played by pointing at the field; a key has no spot to send)
    // g.stick: the arrows and WASD steer, SPACE (or Enter) holds the shot, E (or Q, Shift) passes; the game reads double taps
    const STICK_KEYS = { ArrowLeft: 'L', a: 'L', A: 'L', ArrowRight: 'R', d: 'R', D: 'R', ArrowUp: 'U', w: 'U', W: 'U', ArrowDown: 'D', s: 'D', S: 'D', ' ': 'S', Enter: 'S', e: 'P', E: 'P', q: 'P', Q: 'P', Shift: 'P' }
    const kd = e => {
      if (g.stick) { const k = STICK_KEYS[e.key]; if (!k) return; e.preventDefault(); if (!e.repeat) send('key', e, k); return }
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
      if (g.stick) { const k = STICK_KEYS[e.key]; if (k) send('keyup', e, k); return }
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
      el.removeEventListener('pointermove', move)
      document.documentElement.classList.remove('mg-live')
      window.removeEventListener('resize', refit); window.removeEventListener('mg-pixel', repixel)
      boxWatch?.disconnect()
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku)
      if (import.meta.env.DEV && window.__bapGame === g) delete window.__bapGame
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div className="mg-stage">
      {children}
      <div className="mg-box" ref={box}>
        <div className="mg-letter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {bars && <div ref={barTop} aria-hidden="true" style={{ background: '#000', flex: 'none' }} />}
        <div className="mg-frame" style={{ position: 'relative', lineHeight: 0, display: 'inline-block' }}>
          <canvas ref={canvas} className="mg-canvas" aria-label={def.title} style={tex.has('riso') || ERA_FILTER[era] ? { filter: [tex.has('riso') && RISO_FILTER, ERA_FILTER[era]].filter(Boolean).join(' ') } : undefined} />
          {tex.size > 0 && texLayers(tex, pixPt).map(l => <div key={l.key} aria-hidden="true" style={l.style} />)}
          {eraLayers(era).map(l => <div key={l.key} aria-hidden="true" style={l.style} />)}
          {(() => { const k = wx !== 'off' ? wx : (sport === 'nfl' || sport === 'soccer') && (weather === 'snow' || weather === 'rain') ? weather : null; return k ? <Weather key={k} kind={k} /> : null })()}
          <canvas ref={hudCanvas} className="mg-canvas mg-canvas--hud" aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} />
        </div>
        {bars && <div ref={barBot} aria-hidden="true" style={{ background: '#000', flex: 'none' }} />}
        </div>
        {import.meta.env.DEV && (
          <div className="mg-devtex" onPointerDown={e => e.stopPropagation()}>
            <button type="button" className={devOpen ? 'is-on' : ''} onClick={() => setDevOpen(o => !o)}>LOOK{devOpen ? ' ×' : ''}</button>
            {devOpen && <>
            <b>PIXEL</b>
            {PIXEL_SIZES.map(v => <button key={v} type="button" className={pix === v ? 'is-on' : ''} onClick={() => setPixel(v)}>{v === 'off' ? 'OFF' : v}</button>)}
            <b>TEXTURE</b>
            {TEX_KINDS.map(([k, label]) => <button key={k} type="button" className={tex.has(k) ? 'is-on' : ''} onClick={() => toggleTex(k)}>{label}</button>)}
            <b>ERA</b>
            {[['off', 'OFF'], ['70s', '70S FILM'], ['90s', '90S VHS']].map(([v, l]) => <button key={v} type="button" className={era === v ? 'is-on' : ''} onClick={() => pickEra(v)}>{l}</button>)}
            <b>WEATHER</b>
            {[['off', 'OFF'], ['snow', 'SNOW'], ['rain', 'RAIN'], ['fog', 'FOG']].map(([v, l]) => <button key={v} type="button" className={wx === v ? 'is-on' : ''} onClick={() => pickWx(v)}>{l}</button>)}
            <b>BIG MOMENT</b>
            <button type="button" className={bars ? 'is-on' : ''} onClick={flipBars}>BARS</button>
            <button type="button" className={slow ? 'is-on' : ''} onClick={flipSlow}>SLOW-MO</button>
            </>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
