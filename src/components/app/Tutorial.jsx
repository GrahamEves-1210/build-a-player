import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { IS_APP, APP_LOOK } from '../../lib/platform'
import { IconArrow } from './icons'
import './tutorial.css'

// First-run tutorial for the new UI (app + APP_LOOK website).
//   1. Tour: Home itself, one section at a time. The rest of the screen dims,
//      the section is cut out of the dim, and a prompt explains it.
//   2. Guided game: a Current QB build (Guard on basketball) with coach marks
//      that read the page (spin button, attribute chips, sim button, the season)
//      instead of hooking into the game components.
// It renders into its own React root on <body>, so it keeps running when Home
// unmounts for the game. Home mounts <Tutorial> (first-run check + how to start
// the guided game); anything can replay it with startTutorial() or the
// 'bap:tutorial' window event. Tests skip it with localStorage bap_tutorial_done=1.

export const TUTORIAL_KEY = 'bap_tutorial_done'
export const TUTORIAL_EVENT = 'bap:tutorial'
const NEW_UI = IS_APP || APP_LOOK

const isDone = () => { try { return localStorage.getItem(TUTORIAL_KEY) === '1' } catch { return true } }
const markDone = () => { try { localStorage.setItem(TUTORIAL_KEY, '1') } catch {} }
const sportNow = () => (document.documentElement.classList.contains('is-bucket') || window.location.pathname.startsWith('/bucket') ? 'bucket' : 'nfl')
const reduced = () => document.documentElement.classList.contains('bap-reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── tiny store: { phase: 'idle' | 'tour' | 'coach', sport, run } ───────────────
let state = { phase: 'idle', sport: 'nfl', run: 0 }
const subs = new Set()
const setState = patch => { state = { ...state, ...patch }; subs.forEach(f => f()) }
const subscribe = f => { subs.add(f); return () => subs.delete(f) }
const getState = () => state

let host = null          // the tutorial's own React root
let homeLink = null      // set while Home is mounted: () => starts the guided build
let autoShown = false    // the first-run tour shows once per page load at most

function ensureHost() {
  if (host || typeof document === 'undefined') return
  const el = document.createElement('div')
  el.id = 'bap-tutorial'
  document.body.appendChild(el)
  host = createRoot(el)
  host.render(<TutorialHost />)
}

function openTour() {
  if (!NEW_UI) return
  ensureHost()
  // replayed away from Home: go Home first, the tour waits for it
  if (!document.querySelector('.ag-home')) window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'home' }))
  setState({ phase: 'tour', sport: sportNow(), run: state.run + 1 })
}

/** Replay the tutorial from anywhere (e.g. the "Replay the tutorial" row in Settings). */
export function startTutorial() {
  window.dispatchEvent(new CustomEvent(TUTORIAL_EVENT))
}

if (typeof window !== 'undefined') window.addEventListener(TUTORIAL_EVENT, openTour)

function finish() {
  markDone()
  setState({ phase: 'idle' })
}

function launchGuided() {
  setState({ phase: 'coach' })
  if (homeLink) { homeLink(); return }
  window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'home' }))
  let n = 0
  const t = setInterval(() => {
    if (homeLink) { clearInterval(t); homeLink() }
    else if (++n > 40) { clearInterval(t); finish() }
  }, 100)
}

// ── Mounted by Home ───────────────────────────────────────────────────────────
export default function Tutorial({ onGuided }) {
  const start = useRef(onGuided)
  start.current = onGuided
  useEffect(() => {
    const link = () => start.current?.()
    homeLink = link
    return () => { if (homeLink === link) homeLink = null }
  }, [])
  useEffect(() => {
    if (!NEW_UI || autoShown || isDone() || state.phase !== 'idle') return
    const t = setTimeout(() => {
      if (autoShown || isDone() || state.phase !== 'idle') return
      autoShown = true
      openTour()
    }, 900)
    return () => clearTimeout(t)
  }, [])
  return null
}

function TutorialHost() {
  const s = useSyncExternalStore(subscribe, getState)
  if (s.phase === 'tour') return <Tour key={s.run} sport={s.sport} />
  if (s.phase === 'coach') return <Coach key={s.run} sport={s.sport} />
  return null
}

// ── Finding things on the page ────────────────────────────────────────────────
const shown = el => {
  if (!el || !el.getClientRects().length) return null
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return null
  const cs = getComputedStyle(el)
  if (cs.visibility === 'hidden' || cs.opacity === '0') return null
  return r
}
const firstShown = sel => {
  for (const el of document.querySelectorAll(sel)) { const r = shown(el); if (r) return { el, r } }
  return null
}
// every match, as one rectangle (the quick-game tiles side by side)
const unionShown = sel => {
  const hits = [...document.querySelectorAll(sel)].map(el => ({ el, r: shown(el) })).filter(x => x.r)
  if (!hits.length) return null
  const top = Math.min(...hits.map(h => h.r.top)), left = Math.min(...hits.map(h => h.r.left))
  const right = Math.max(...hits.map(h => h.r.right)), bottom = Math.max(...hits.map(h => h.r.bottom))
  return { el: hits[0].el, r: { top, left, right, bottom, width: right - left, height: bottom - top } }
}
const findTarget = step => {
  for (const sel of step.sel) { const hit = step.all ? unionShown(sel) : firstShown(sel); if (hit) return hit }
  return null
}
// The usable bottom of the screen: above the website's ad rail and the phone tab bar
function floorY() {
  const vh = window.innerHeight
  let y = vh - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--web-rail')) || 0)
  const bar = shown(document.querySelector('.mobile-tab-bar'))
  if (bar && bar.top > vh * 0.5) y = Math.min(y, bar.top)
  return y
}
const toRect = r => (r ? { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right } : null)
function sameRect(a, b) {
  if (!a || !b) return a === b
  return Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1
}
// a prompt next to a target: its preferred side when it fits, else the side with
// more room, kept on screen above the usable bottom
function place(r, floor, h, preferAbove = false) {
  const vw = window.innerWidth
  const w = Math.min(340, vw - 24)
  const left = Math.max(12, Math.min(vw - w - 12, r.left + r.width / 2 - w / 2))
  const fitsBelow = r.bottom + 18 + h <= floor - 8
  const fitsAbove = r.top - 18 - h >= 8
  const below = preferAbove ? !fitsAbove && (fitsBelow || floor - r.bottom > r.top) : fitsBelow || (!fitsAbove && floor - r.bottom > r.top)
  const top = below ? r.bottom + 18 : r.top - 18 - h
  return { pos: { left, top: Math.max(8, Math.min(floor - h - 8, top)), width: w }, arrow: Math.max(22, Math.min(w - 22, r.left + r.width / 2 - left)), below }
}
// follows a target as the page scrolls or resizes (polls lightly; no per-frame work)
function useTracked(read, deps) {
  const [view, setView] = useState({ hit: null, r: null, floor: window.innerHeight })
  const readRef = useRef(read); readRef.current = read
  useEffect(() => {
    let raf = 0, alive = true
    const tick = () => {
      if (!alive) return
      const out = readRef.current()
      const r = toRect(out?.hit?.r)   // measured fresh on every read
      const floor = floorY()
      setView(v => (v.key === out?.key && v.floor === floor && sameRect(v.r, r) ? v : { ...out, r, floor }))
    }
    const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick) }
    const iv = setInterval(tick, 220)
    window.addEventListener('scroll', soon, true)
    window.addEventListener('resize', soon)
    tick()
    return () => { alive = false; clearInterval(iv); cancelAnimationFrame(raf); window.removeEventListener('scroll', soon, true); window.removeEventListener('resize', soon) }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return view
}

// ── The tour: Home, a section at a time ───────────────────────────────────────
function tourSteps(sport) {
  const nba = sport === 'bucket'
  const league = nba ? 'NBA' : 'NFL'
  return [
    { id: 'sport', sel: ['.ag-sport'], title: 'Two games in one', text: 'Football and basketball. Switch here any time: each has its own modes, leaderboards and records.' },
    { id: 'pos', sel: ['.ag-positions'], title: 'Pick a position', text: nba ? 'Guard (PG · SG · SF) or Big (PF · C). Each one has its own traits.' : 'QB, RB, WR, TE or DB. Each position has its own traits and its own leaderboard.' },
    { id: 'modes', sel: ['.ag-modes'], title: 'The main game', text: `Spin a team, then a real ${league} player, and tap the trait you want from him. Fill every slot, then play a season. Current uses today's rosters, All-Time the legends.` },
    { id: 'career', sel: ['.ag-crmode'], title: 'Career', text: 'One player, a whole career: the combine, the draft, season after season, contracts and a legacy.' },
    { id: 'compete', sel: ['.ag-compete'], title: 'Compete', text: 'Online pools of five. Everyone gets the same spins, and the best build takes the pool.' },
    { id: 'blacktop', sel: ['.ag-blacktop'], title: 'Blacktop', text: 'Live games against real players: 3v3 squads, or one on one.' },
    { id: 'takeover', sel: ['.ag-takeover'], title: 'Takeover', text: 'Cross the map, solo or with a friend. Every city has a better player to beat.' },
    { id: 'quick', sel: ['.ag-mini'], all: true, title: 'Quick games', text: nba ? 'Salary Cap: a new puzzle every day. The best player you can build on a budget.' : 'Salary Cap is a daily puzzle: the best QB you can build on a budget. The Depth Chart: sort the stars by one stat.' },
    { id: 'coins', sel: ['.ag-dock', '.ag-hud-coins'], title: 'Coins and looks', text: 'Every game pays XP and coins, and Daily missions pay more. The Shop turns coins into name colors, effects and avatars everyone sees.' },
    { id: 'go', sel: ['.ag-mode'], title: 'Let\'s play one', text: 'A guided Current game: spin, draft, play the season. About two minutes.', last: true },
  ]
}

function Tour({ sport }) {
  const [steps, setSteps] = useState(null)
  const [i, setI] = useState(0)
  const bubble = useRef(null)
  const [bh, setBh] = useState(170)
  const scrolledFor = useRef(-1)
  const lastRect = useRef(null)     // the outline holds here until the next section is measured
  // wait for Home, then keep the steps whose section is on it
  useEffect(() => {
    let n = 0
    const t = setInterval(() => {
      if (document.querySelector('.ag-home')) {
        clearInterval(t)
        const all = tourSteps(sport)
        setSteps(all.filter(s => findTarget(s)))
      } else if (++n > 40) { clearInterval(t); finish() }
    }, 100)
    return () => clearInterval(t)
  }, [sport])
  const step = steps?.[i]
  const view = useTracked(() => (step ? { key: step.id, hit: findTarget(step) } : null), [step?.id])
  useLayoutEffect(() => { const h = bubble.current?.offsetHeight; if (h && Math.abs(h - bh) > 1) setBh(h) })
  // bring each section to the middle of the screen
  useEffect(() => {
    if (!step || scrolledFor.current === i) return
    scrolledFor.current = i
    const hit = findTarget(step)
    hit?.el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' })
  }, [i, step])
  const next = () => (step?.last ? launchGuided() : setI(k => Math.min((steps?.length ?? 1) - 1, k + 1)))
  const back = () => setI(k => Math.max(0, k - 1))
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); finish() }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  if (!steps?.length || !step) return <div className="tut-tour"><div className="tut-dim" /></div>
  const fresh = view.key === step.id ? view.r : null
  if (fresh) lastRect.current = fresh
  // one outline for the whole tour: it slides from section to section, never from the corner
  const r = fresh ?? lastRect.current
  const p = fresh ? place(fresh, view.floor, bh) : null
  const pad = 8
  return (
    <div className="tut-tour" role="dialog" aria-modal="true" aria-label={`Tutorial: ${step.title}`}>
      {/* the page underneath stays put: a tap anywhere outside the prompt does nothing */}
      <div className="tut-catch" />
      {r
        ? <div className="tut-hole" aria-hidden="true" style={{ transform: `translate(${r.left - pad}px, ${r.top - pad}px)`, width: r.width + pad * 2, height: r.height + pad * 2 }} />
        : <div className="tut-dim" />}
      <div ref={bubble} key={step.id} className={`tut-bubble tut-bubble--tour${p ? (p.below ? ' tut-bubble--below' : ' tut-bubble--above') : ' tut-bubble--dock'}`} style={p ? p.pos : r ? { visibility: 'hidden' } : undefined}>
        {p && <span className="tut-bubble-arrow" style={{ left: p.arrow }} aria-hidden="true" />}
        <div className="tut-bubble-head">
          <span className="tut-bubble-step" aria-live="polite">{i + 1} / {steps.length}</span>
          <button type="button" className="tut-skip tut-skip--sm" onClick={finish}>Skip tutorial</button>
        </div>
        <div className="tut-bubble-title">{step.title}</div>
        <p className="tut-bubble-text">{step.text}</p>
        <div className="tut-bubble-actions">
          {i > 0 && <button type="button" className="tut-bubble-ok tut-bubble-back" onClick={back}>BACK</button>}
          <button type="button" className="ag-btn tut-bubble-btn" onClick={next} autoFocus>{step.last ? 'PLAY A GUIDED GAME' : 'NEXT'} <IconArrow size={15} /></button>
        </div>
      </div>
    </div>
  )
}

// ── Coach marks for the guided game ───────────────────────────────────────────
const COPY = sport => {
  const who = sport === 'bucket' ? 'NBA' : 'NFL'
  return {
    spin: { n: 1, title: 'Spin', text: `Spin for a random team, then a random ${who} player from it.`, dim: true },
    pick: { n: 2, title: 'Take a trait', text: 'Tap the trait you want from this player. Each player fills one slot, so take his best.', dim: true },
    more: { n: 2, title: 'Keep going', text: 'Spin again for the next slot. Spin, pick, repeat until every slot is filled.' },
    sim: { n: 3, title: 'Play the season', text: 'Build complete. Tap this to play a full season.', dim: true },
    team: { n: 3, title: 'Pick your team', text: 'Spin for a team or choose your own. That\'s who you play the season for.', above: true },
    season: { n: 4, title: 'The season', text: 'Your grades make your OVR, and your OVR runs the season. Tap through for the record, playoffs and awards, then build again and beat it.', end: true },
  }
}

function readStep(m) {
  // the app's BUILD COMPLETE splash and the award reveal play out untouched
  if (firstShown('.ag-bc, .mvp-overlay')) return { step: 'quiet' }
  if (document.querySelector('.simp-page')) { m.seen = true; return { step: 'season', a: firstShown('.simp-page .simp-cta') } }
  const tpm = firstShown('.tpm-card')
  if (tpm) { m.seen = true; return { step: 'team', a: firstShown('.tpm-mode-tabs') ?? tpm } }
  // Home (the app keeps a parked game mounted under it) or some other page
  if (firstShown('.ag-home') || !document.querySelector('.game-layout')) {
    if (m.seen || Date.now() - m.t0 > 9000) return { step: 'gone' }
    return { step: 'wait' }
  }
  m.seen = true
  const sim = firstShown('.sim-btn:not(.sim-btn-locked):not([disabled])')
  if (sim) return { step: 'sim', a: sim }
  const chip = firstShown('.attr-chip')
  if (chip) { m.chips = true; return { step: m.picks === 0 ? 'pick' : 'quiet', a: chip } }
  const spin = firstShown('.spin-btn')
  if (spin && !spin.el.disabled) {
    if (m.chips) { m.picks++; m.chips = false }   // the chips went away and SPIN is back: a slot was filled
    return { step: m.picks === 0 ? 'spin' : m.picks === 1 ? 'more' : 'quiet', a: spin }
  }
  return { step: 'quiet' }   // spinning
}

function Coach({ sport }) {
  const copy = COPY(sport)
  const [hidden, setHidden] = useState({})
  const bubble = useRef(null)
  const [bh, setBh] = useState(160)
  useLayoutEffect(() => { const h = bubble.current?.offsetHeight; if (h && Math.abs(h - bh) > 1) setBh(h) })
  const mem = useRef({ t0: Date.now(), seen: false, chips: false, picks: 0, scrolled: {} })
  const view = useTracked(() => {
    const m = mem.current
    const { step, a } = readStep(m)
    if (step === 'gone') { setTimeout(finish, 0); return { key: 'gone' } }
    if (a && !m.scrolled[step]) {   // bring the target into view once per step
      m.scrolled[step] = true
      const floor = floorY()
      if (a.r.top < 70 || a.r.bottom > floor - 30) a.el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' })
    }
    return { key: step, hit: a }
  }, [])
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') finish() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const step = view.key
  const c = copy[step]
  const showBubble = c && !hidden[step]
  const r = view.r
  const p = showBubble && r ? place(r, view.floor ?? window.innerHeight, bh, c.above) : null
  const pad = 6
  return (
    <div className="tut-coach" aria-live="polite">
      {showBubble && r && (
        <div className={`tut-hole tut-hole--coach${c.dim ? '' : ' tut-hole--clear'}`} aria-hidden="true"
          style={{ transform: `translate(${r.left - pad}px, ${r.top - pad}px)`, width: r.width + pad * 2, height: r.height + pad * 2 }} />
      )}
      {showBubble ? (
        <div ref={bubble} className={`tut-bubble${p ? (p.below ? ' tut-bubble--below' : ' tut-bubble--above') : ' tut-bubble--dock'}`}
          style={p?.pos} role="dialog" aria-label={`Tutorial step ${c.n} of 4: ${c.title}`}>
          {p && <span className="tut-bubble-arrow" style={{ left: p.arrow }} aria-hidden="true" />}
          <div className="tut-bubble-head">
            <span className="tut-bubble-step">STEP {c.n} OF 4</span>
            <button type="button" className="tut-skip tut-skip--sm" onClick={finish}>Skip tutorial</button>
          </div>
          <div className="tut-bubble-title">{c.title}</div>
          <p className="tut-bubble-text">{c.text}</p>
          <div className="tut-bubble-actions">
            {c.end
              ? <button type="button" className="ag-btn tut-bubble-btn" onClick={finish}>FINISH</button>
              : <button type="button" className="tut-bubble-ok" onClick={() => setHidden(h => ({ ...h, [step]: true }))} aria-label="Got it, hide this tip">Got it</button>}
          </div>
        </div>
      ) : step !== 'gone' && (
        <button type="button" className="tut-skip tut-skip--pill" onClick={finish}>Guided game · Skip tutorial</button>
      )}
    </div>
  )
}
