import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { IS_APP, APP_LOOK } from '../../lib/platform'
import { W as MAP_W, H as MAP_H, OUTLINE_PATH } from '../../lib/usMap'
import { IconArrow, IconBolt, IconCrown, IconCoin, IconClipboard, IconCalendar, IconBag, IconFlame } from './icons'
import './tutorial.css'

// First-run tutorial for the new UI (app + APP_LOOK website).
//   1. Intro: a tap-through popup over Home — the basics, then one card per mode.
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

// ── tiny store: { phase: 'idle' | 'intro' | 'coach', sport, run } ──────────────
let state = { phase: 'idle', sport: 'nfl', run: 0 }
const subs = new Set()
const setState = patch => { state = { ...state, ...patch }; subs.forEach(f => f()) }
const subscribe = f => { subs.add(f); return () => subs.delete(f) }
const getState = () => state

let host = null          // the tutorial's own React root
let homeLink = null      // set while Home is mounted: () => starts the guided build
let autoShown = false    // the first-run popup shows once per page load at most

function ensureHost() {
  if (host || typeof document === 'undefined') return
  const el = document.createElement('div')
  el.id = 'bap-tutorial'
  document.body.appendChild(el)
  host = createRoot(el)
  host.render(<TutorialHost />)
}

function openIntro() {
  if (!NEW_UI) return
  ensureHost()
  setState({ phase: 'intro', sport: sportNow(), run: state.run + 1 })
}

/** Replay the tutorial from anywhere (e.g. a "Replay tutorial" row in settings). */
export function startTutorial() {
  window.dispatchEvent(new CustomEvent(TUTORIAL_EVENT))
}

if (typeof window !== 'undefined') window.addEventListener(TUTORIAL_EVENT, openIntro)

function finish() {
  markDone()
  setState({ phase: 'idle' })
}

function launchGuided() {
  setState({ phase: 'coach' })
  if (homeLink) { homeLink(); return }
  // replayed away from Home: go Home, then start once it has mounted
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
      openIntro()
    }, 700)
    return () => clearTimeout(t)
  }, [])
  return null
}

function TutorialHost() {
  const s = useSyncExternalStore(subscribe, getState)
  if (s.phase === 'intro') return <Intro key={s.run} sport={s.sport} />
  if (s.phase === 'coach') return <Coach key={s.run} sport={s.sport} />
  return null
}

// ── Card art ──────────────────────────────────────────────────────────────────
function BasicsArt({ sport }) {
  const nba = sport === 'bucket'
  const chips = nba
    ? [['3PT', 'A'], ['HANDLES', 'A-'], ['DUNK', 'B+']]
    : [['ARM', 'A'], ['SPEED', 'A-'], ['IQ', 'B+']]
  return (
    <div className="tut-basics-art" aria-hidden="true">
      <img src={nba ? '/basketballsilhouette.png' : '/qb-silhouette.webp'} alt="" draggable={false} className={`tut-fig${nba ? ' tut-fig--nba' : ''}`} />
      {chips.map(([k, g], i) => (
        <span key={k} className={`tut-chip tut-chip--${i}`}><b>{k}</b><i>{g}</i></span>
      ))}
    </div>
  )
}
function PairArt({ sport }) {
  return (
    <div className="tut-pair" aria-hidden="true">
      <span className="tut-pair-card"><IconBolt size={34} /><b>CURRENT</b><small>{sport === 'bucket' ? 'Today’s NBA' : 'Today’s NFL'}</small></span>
      <span className="tut-pair-card tut-pair-card--gold"><IconCrown size={34} /><b>ALL-TIME</b><small>The legends</small></span>
    </div>
  )
}
function CareerArt() {
  return (
    <svg className="tut-svg" viewBox="0 0 220 110" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="tut-crg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#f5dc8a" stopOpacity=".15" /><stop offset="1" stopColor="#f5dc8a" stopOpacity=".9" /></linearGradient></defs>
      <ellipse cx="110" cy="122" rx="120" ry="42" fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="2" />
      <ellipse cx="110" cy="122" rx="92" ry="30" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="2" />
      <polyline points="20,94 60,82 95,86 130,58 165,46 200,16" fill="none" stroke="url(#tut-crg)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="200" cy="16" r="6" fill="#f5dc8a" />
      <circle cx="130" cy="58" r="3.5" fill="rgba(245,220,138,.75)" /><circle cx="60" cy="82" r="3.5" fill="rgba(245,220,138,.55)" />
    </svg>
  )
}
function CompeteArt() {
  const bars = [[0, 42], [1, 64], [2, 34], [3, 26], [4, 18]]
  return (
    <svg className="tut-svg" viewBox="0 0 150 80" aria-hidden="true" preserveAspectRatio="xMidYMax meet">
      {bars.map(([i, h]) => <rect key={i} x={8 + i * 28} y={76 - h} width={22} height={h} rx={5} className={`ag-pool-bar${i === 1 ? ' is-first' : ''}`} />)}
      <path d="M47 6 l2.6 5.3 5.9.9-4.3 4.1 1 5.8L47 19.4 41.8 22l1-5.8-4.3-4.1 5.9-.9z" className="ag-pool-star" />
    </svg>
  )
}
function TakeoverArt() {
  return (
    <svg className="tut-svg" viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <path d={OUTLINE_PATH} className="ag-map-land" clipRule="evenodd" />
      <path d="M190 220 L330 260 L470 190 L620 300 L760 240" className="ag-map-route" />
      {[[190, 220], [470, 190], [760, 240]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 2 ? 16 : 11} className={`ag-map-pin${i === 2 ? ' is-next' : ''}`} />)}
    </svg>
  )
}
function CourtArt() {
  return (
    <svg className="tut-svg tut-svg--court" viewBox="0 0 220 110" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <rect x="20" y="8" width="180" height="94" rx="3" opacity=".5" />
        <line x1="110" y1="8" x2="110" y2="102" opacity=".5" />
        <circle cx="110" cy="55" r="16" opacity=".6" />
        <rect x="20" y="33" width="38" height="44" opacity=".7" /><rect x="162" y="33" width="38" height="44" opacity=".7" />
        <circle cx="30" cy="55" r="4.5" /><circle cx="190" cy="55" r="4.5" />
      </g>
      <text x="74" y="60" className="tut-court-txt">3v3</text><text x="124" y="60" className="tut-court-txt">1v1</text>
    </svg>
  )
}
function IconsArt({ items }) {
  return (
    <div className="tut-icons" aria-hidden="true">
      {items.map(([Icon, label, tone], i) => (
        <span key={i} className={`tut-icon-tile${tone ? ` tut-icon-tile--${tone}` : ''}`}><Icon size={30} /><b>{label}</b></span>
      ))}
    </div>
  )
}

// ── Cards: the basics, then the modes that are on Home ────────────────────────
function cardsFor(sport) {
  const nba = sport === 'bucket'
  const league = nba ? 'NBA' : 'NFL'
  const cards = [
    {
      id: 'basics', eyebrow: 'HOW IT WORKS', title: nba ? 'BUILD-A-BUCKET' : 'BUILD-A-PLAYER', art: <BasicsArt sport={sport} />,
      steps: [
        ['SPIN', `Land a random team, then a real ${league} player.`],
        ['DRAFT', 'Drag his best trait onto your player. One slot per player.'],
        ['SIM', 'Fill every slot, then play a full season.'],
        ['EARN', 'Better build, better season: wins, rings, awards.'],
      ],
      foot: 'Every game earns XP and coins. Spend coins in the Shop on name colours, effects, plates and avatars that everyone sees next to your name.',
    },
    {
      id: 'classic', eyebrow: nba ? 'GUARD · BIG' : 'QB · RB · WR · TE · DB', title: 'CURRENT & ALL-TIME', art: <PairArt sport={sport} />,
      body: nba
        ? 'The main game. Pick Guard (PG · SG · SF) or Big (PF · C), then draft from today’s rosters in Current, or from the greats in All-Time.'
        : 'The main game. Pick a position, then draft from this season’s rosters in Current, or from the legends in All-Time.',
    },
  ]
  if (!nba) cards.push({
    id: 'career', eyebrow: 'MULTI-SEASON · SAVES AS YOU GO', title: 'CAREER', art: <CareerArt />, tone: 'gold',
    body: 'One player, a whole career. Run the combine, get drafted, play season after season and sort out contracts. Your legacy is on the line.',
  })
  cards.push({
    id: 'compete', eyebrow: 'ONLINE · 5-PLAYER POOLS', title: 'COMPETE', art: <CompeteArt />,
    body: 'You and four other players get the exact same spins. Highest OVR takes the pool. Win pools to climb the ranks.',
  })
  if (nba) cards.push({
    id: 'blacktop', eyebrow: 'ONLINE · 3V3 · 1V1', title: 'BLACKTOP', art: <CourtArt />,
    body: 'Live games against real players. Join a 3v3 lobby and build with your squad, or go one on one.',
  })
  cards.push({
    id: 'takeover', eyebrow: 'ROAD MODE · 12 CITIES', title: 'TAKEOVER', art: <TakeoverArt />, tone: 'gold',
    body: 'Cross the map solo or with a friend. Every city has a better player waiting. Beat him and steal his game.',
  })
  cards.push({
    id: 'quick', eyebrow: 'QUICK GAMES', title: nba ? 'SALARY CAP' : 'SALARY CAP & DEPTH CHART', tone: 'purple',
    art: <IconsArt items={nba ? [[IconCoin, 'SALARY CAP', 'purple']] : [[IconCoin, 'SALARY CAP', 'purple'], [IconClipboard, 'DEPTH CHART', 'gold']]} />,
    body: nba
      ? 'A new puzzle every day: build the best player you can without going over the budget.'
      : 'Salary Cap is a daily puzzle: build a QB without going over the budget. The Depth Chart: sort the stars by one stat.',
  })
  cards.push({
    id: 'daily', eyebrow: 'EVERY DAY', title: 'DAILY & SHOP',
    art: <IconsArt items={[[IconCalendar, 'DAILY'], [IconFlame, 'STREAK', 'gold'], [IconBag, 'SHOP']]} />,
    body: 'The Daily tab has a challenge, missions and a streak to keep alive. They pay coins, and the Shop is where you spend them.',
  })
  return cards
}

// ── Intro popup ───────────────────────────────────────────────────────────────
const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

function Intro({ sport }) {
  const cards = cardsFor(sport)
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const modal = useRef(null)
  const nextBtn = useRef(null)
  const last = i === cards.length - 1
  const card = cards[i]

  const go = to => { if (to < 0 || to >= cards.length) return; setDir(to > i ? 1 : -1); setI(to) }
  const skip = () => finish()
  const next = () => (last ? launchGuided() : go(i + 1))

  useEffect(() => {
    const prev = document.activeElement
    nextBtn.current?.focus({ preventScroll: true })
    return () => { if (prev && prev.focus && document.contains(prev)) prev.focus({ preventScroll: true }) }
  }, [])

  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); skip(); return }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); return }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); return }
    if (e.key !== 'Tab') return
    const els = [...(modal.current?.querySelectorAll(FOCUSABLE) ?? [])]
    if (!els.length) return
    const first = els[0], end = els[els.length - 1]
    if (e.shiftKey && (document.activeElement === first || !modal.current.contains(document.activeElement))) { e.preventDefault(); end.focus() }
    else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus() }
  }

  // swipe between cards
  const touch = useRef(null)
  const onDown = e => { touch.current = { x: e.clientX, y: e.clientY } }
  const onUp = e => {
    const t = touch.current; touch.current = null
    if (!t) return
    const dx = e.clientX - t.x, dy = e.clientY - t.y
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) go(i + (dx < 0 ? 1 : -1))
  }

  return (
    <div className="tut-overlay" onKeyDown={onKey}>
      <div className={`tut-modal tut-modal--${sport}`} ref={modal} role="dialog" aria-modal="true" aria-labelledby="tut-title" aria-describedby="tut-desc">
        <div className="tut-top">
          <span className="tut-count" aria-live="polite">{i + 1} / {cards.length}</span>
          <button type="button" className="tut-skip" onClick={skip} aria-label="Skip tutorial">Skip tutorial</button>
        </div>

        <div className={`tut-card tut-card--${card.tone ?? 'mint'}`} key={card.id} style={{ '--dir': dir }} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { touch.current = null }}>
          <div className={`tut-art tut-art--${card.id}`}>{card.art}</div>
          <div className="tut-copy">
          <span className="tut-eyebrow">{card.eyebrow}</span>
          <h2 className="tut-title" id="tut-title">{card.title}</h2>
          <div id="tut-desc">
            {card.steps ? (
              <ol className="tut-steps">
                {card.steps.map(([k, txt], n) => (
                  <li key={k}><span className="tut-step-n">{n + 1}</span><span className="tut-step-txt"><b>{k}</b> {txt}</span></li>
                ))}
              </ol>
            ) : <p className="tut-body">{card.body}</p>}
            {card.foot && <p className="tut-foot"><IconCoin size={15} /> <span>{card.foot}</span></p>}
          </div>
          </div>
        </div>

        <div className="tut-dots" role="tablist" aria-label="Tutorial cards">
          {cards.map((c, n) => (
            <button key={c.id} type="button" role="tab" aria-selected={n === i} aria-label={`Card ${n + 1}: ${c.title}`}
              className={`tut-dot${n === i ? ' is-on' : ''}`} onClick={() => go(n)} tabIndex={n === i ? 0 : -1} />
          ))}
        </div>

        <div className="tut-nav">
          <button type="button" className="tut-back" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous card">BACK</button>
          <button type="button" ref={nextBtn} className={`ag-btn tut-next${last ? ' tut-next--go' : ''}`} onClick={next}
            aria-label={last ? 'Play a guided game' : 'Next card'}>
            {last ? 'PLAY A GUIDED GAME' : 'NEXT'} <IconArrow size={17} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Coach marks for the guided game ───────────────────────────────────────────
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
// The usable bottom of the screen: above the website's ad rail, the phone tab
// bar (SPIN / BUILD) and the app's dock
function floorY() {
  const vh = window.innerHeight
  let y = vh - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--web-rail')) || 0)
  for (const sel of ['.mobile-tab-bar', '.ag-dock']) {
    const r = shown(document.querySelector(sel))
    if (r && r.top > vh * 0.5) y = Math.min(y, r.top)
  }
  return y
}

const COPY = sport => {
  const who = sport === 'bucket' ? 'NBA' : 'NFL'
  return {
    spin: { n: 1, title: 'SPIN', text: `Spin for a random team, then a random ${who} player from it.`, dim: true },
    pick: { n: 2, title: 'DRAFT A TRAIT', text: 'Tap the trait you want, or drag it onto your player. Each player fills one slot, so take his best.' },
    more: { n: 2, title: 'KEEP GOING', text: 'Spin again for the next slot. Spin, pick, repeat until every slot is filled.' },
    sim: { n: 3, title: 'SIM YOUR SEASON', text: 'Build complete. Hit this to play a full season.', dim: true },
    team: { n: 3, title: 'PICK YOUR TEAM', text: 'Spin for a team or pick your own. That’s who you play the season for.', above: true },
    season: { n: 4, title: 'THE SEASON', text: 'Your grades make your OVR, and your OVR runs the season. Tap through for the record, playoffs and awards, then build again and beat it.', end: true },
  }
}

function readStep(m) {
  // the app's BUILD COMPLETE splash and the award reveal play out untouched
  if (firstShown('.ag-bc, .mvp-overlay')) return { step: 'quiet' }
  if (document.querySelector('.simp-page')) {
    m.seen = true
    return { step: 'season', a: firstShown('.simp-page .simp-cta') }
  }
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
  const [view, setView] = useState({ step: 'wait', r: null })
  const [hidden, setHidden] = useState({})
  const bubble = useRef(null)
  const [bh, setBh] = useState(160)
  useLayoutEffect(() => { const h = bubble.current?.offsetHeight; if (h && Math.abs(h - bh) > 1) setBh(h) })
  const mem = useRef({ t0: Date.now(), seen: false, chips: false, picks: 0, scrolled: {}, last: null })

  useEffect(() => {
    let raf = 0, alive = true
    const tick = () => {
      if (!alive) return
      const m = mem.current
      const { step, a } = readStep(m)
      if (step === 'gone') { finish(); return }
      const floor = floorY()
      if (a && step !== m.last && !m.scrolled[step]) {   // bring the target into view once per step
        m.scrolled[step] = true
        if (a.r.top < 70 || a.r.bottom > floor - 30) {
          a.el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
        }
      }
      m.last = step
      const r = a ? a.el.getBoundingClientRect() : null
      setView(v => (v.step === step && v.floor === floor && sameRect(v.r, r) ? v
        : { step, floor, r: r && { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right } }))
    }
    const iv = setInterval(tick, 200)
    const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick) }
    window.addEventListener('scroll', soon, true)
    window.addEventListener('resize', soon)
    tick()
    return () => { alive = false; clearInterval(iv); cancelAnimationFrame(raf); window.removeEventListener('scroll', soon, true); window.removeEventListener('resize', soon) }
  }, [])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') finish() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const c = copy[view.step]
  const showBubble = c && !hidden[view.step]
  const r = view.r

  // place the bubble next to the target, on its preferred side when it fits,
  // else the side with more room, kept between the top and the usable bottom
  let pos = null, arrow = null, below = true
  if (showBubble && r) {
    const vw = window.innerWidth
    const floor = view.floor ?? window.innerHeight
    const w = Math.min(330, vw - 24)
    const h = bh
    const left = Math.max(12, Math.min(vw - w - 12, r.left + r.width / 2 - w / 2))
    const fitsBelow = r.bottom + 16 + h <= floor - 8
    const fitsAbove = r.top - 16 - h >= 8
    below = c.above ? !fitsAbove && (fitsBelow || floor - r.bottom > r.top) : fitsBelow || (!fitsAbove && floor - r.bottom > r.top)
    const top = below ? r.bottom + 16 : r.top - 16 - h
    pos = { left, top: Math.max(8, Math.min(floor - h - 8, top)), width: w }
    arrow = Math.max(20, Math.min(w - 20, r.left + r.width / 2 - left))
  } else if (showBubble) {
    pos = { bottom: window.innerHeight - (view.floor ?? window.innerHeight) + 12 }
  }

  return (
    <div className="tut-coach" aria-live="polite">
      {showBubble && r && (
        <div className={`tut-ring${c.dim ? ' tut-ring--dim' : ''}`} aria-hidden="true"
          style={{ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 }} />
      )}
      {showBubble ? (
        <div ref={bubble} className={`tut-bubble${r ? (below ? ' tut-bubble--below' : ' tut-bubble--above') : ' tut-bubble--dock'}`}
          style={pos ?? undefined} role="dialog" aria-label={`Tutorial step ${c.n} of 4: ${c.title}`}>
          {r && <span className="tut-bubble-arrow" style={{ left: arrow }} aria-hidden="true" />}
          <div className="tut-bubble-head">
            <span className="tut-bubble-step">STEP {c.n} OF 4</span>
            <button type="button" className="tut-skip tut-skip--sm" onClick={finish} aria-label="Skip tutorial">Skip tutorial</button>
          </div>
          <div className="tut-bubble-title">{c.title}</div>
          <p className="tut-bubble-text">{c.text}</p>
          <div className="tut-bubble-actions">
            {c.end
              ? <button type="button" className="ag-btn tut-bubble-btn" onClick={finish} aria-label="Finish tutorial">FINISH</button>
              : <button type="button" className="tut-bubble-ok" onClick={() => setHidden(h => ({ ...h, [view.step]: true }))} aria-label="Got it, hide this tip">Got it</button>}
          </div>
        </div>
      ) : view.step !== 'gone' && (
        <button type="button" className="tut-skip tut-skip--pill" onClick={finish} aria-label="Skip tutorial">Guided game · Skip tutorial</button>
      )}
    </div>
  )
}

function sameRect(a, b) {
  if (!a || !b) return a === b
  return Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1
}
