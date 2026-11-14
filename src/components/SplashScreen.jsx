import { useEffect, useState, useMemo, useRef } from 'react'
import { nflHeadshot, HEADSHOT_BASE } from '../utils/simulation'
import SiteFooter from './SiteFooter'
import SiteFeatures from './SiteFeatures'

export function hsUrl(id) {
  if (!id) return null
  if (id.startsWith('http')) return id
  return id.includes('.') ? `${HEADSHOT_BASE}/${id}` : `${HEADSHOT_BASE}/${id}.webp`
}

import { IS_APP, APP_LOOK, setClassicLook } from '../lib/platform'
import { LB_LIVE } from '../lib/lbLive'
import { OL_LIVE } from '../lib/olLive'
import { K_LIVE } from '../lib/kLive'
import { SOCCER_LIVE } from '../lib/soccerLive'
import { BASEBALL_LIVE } from '../lib/baseballLive'

export const POS_OPTIONS = [
  {
    pos: 'qb', label: 'QB', classic: true, alltime: true,
    players: [
      { id: '6770', color: '#fb4f14' },       // Joe Burrow - CIN
      { id: '4984', color: '#00338d' },       // Josh Allen - BUF
      { id: '4881', color: '#241773' },       // Lamar Jackson - BAL
    ],
  },
  {
    pos: 'rb', label: 'RB', classic: true, alltime: true,
    players: [
      { id: '3198', color: '#241773' },       // Derrick Henry - BAL
      { id: '9509', color: '#a71930' },       // Bijan Robinson - ATL
      { id: '9221', color: '#0076b6' },       // Jahmyr Gibbs - DET
    ],
  },
  {
    pos: 'wr', label: 'WR', classic: true, alltime: true,
    players: [
      { id: 'espn_4262921',   color: '#4f2683' },  // Justin Jefferson - MIN
      { id: 'espn_4241389',   color: '#003594' },  // CeeDee Lamb - DAL
      { id: 'espn_4430878',   color: '#69be28' },  // Jaxon Smith-Njigba - SEA
    ],
  },
  {
    pos: 'te', label: 'TE', classic: true, alltime: true,
    players: [
      { id: '11604', color: '#a5acaf' },      // Brock Bowers - LV
      { id: '4217',  color: '#aa0000' },      // George Kittle - SF
      { id: '8130',  color: '#97233f' },      // Trey McBride - ARI
    ],
  },
  {
    pos: 'db', label: 'DB', classic: true, alltime: true, disabled: false,
    players: [
      { id: 'espn_4372012', color: '#fb4f14' },  // Pat Surtain II - DEN
      { id: 'espn_4686772', color: '#0C2340' },  // Christian Gonzalez - NE
      { id: 'espn_4575517', color: '#241773' },  // Kyle Hamilton - BAL
    ],
  },
  {
    pos: 'ol', label: 'OL', classic: OL_LIVE, alltime: OL_LIVE, disabled: !OL_LIVE,   // OL_LIVE: lib/olLive.js
    players: [
      { id: 'espn_4373825', color: '#0076b6' },  // Penei Sewell - DET
      { id: 'espn_4241385', color: '#e31837' },  // Creed Humphrey - KC
      { id: 'espn_4334215', color: '#004c54' },  // Jordan Mailata - PHI
    ],
  },
  {
    pos: 'lb', label: 'LB', classic: LB_LIVE, alltime: LB_LIVE, disabled: !LB_LIVE,   // LB_LIVE: data/lbs.js
    players: [
      { id: 'espn_3138826', color: '#aa0000' },  // Fred Warner - SF
      { id: 'espn_3915189', color: '#241773' },  // Roquan Smith - BAL
      { id: 'espn_4569465', color: '#0076b6' },  // Jack Campbell - DET
    ],
  },
  {
    pos: 'dl', label: 'DL', classic: true, alltime: true, disabled: false,
    players: [
      { id: 'espn_3122132', color: '#003594' },  // Myles Garrett - LAR
      { id: 'espn_3916655', color: '#000000' },  // Maxx Crosby - LV
      { id: 'espn_4685724',  color: '#002244' },  // Will Anderson Jr - HOU
    ],
  },
  {
    pos: 'k', label: 'K', classic: K_LIVE, alltime: K_LIVE, disabled: !K_LIVE,   // K_LIVE: lib/kLive.js
    players: [
      { id: 'espn_3953687', color: '#003594' },  // Brandon Aubrey - DAL
      { id: 'espn_4686361', color: '#006778' },  // Cam Little - JAX
      { id: 'espn_4567104', color: '#4f2683' },  // Will Reichard - MIN
    ],
  },
]

function MiniAv({ id, color, size = 28 }) {
  const src = hsUrl(id)
  return (
    <div className="mini-av" style={{ width: size, height: size, background: color, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
      {src && <img src={src} alt="" draggable={false} style={{ width: '130%', height: '130%', objectFit: 'cover', objectPosition: 'top center', marginTop: '-3px', marginLeft: '-15%' }} onError={e => { e.currentTarget.style.display = 'none' }} />}
    </div>
  )
}

export function AvatarTrio({ players, size = 26 }) {
  return (
    <div className="splash-av-trio">
      {players.map((p, i) => (
        <div key={i} className="splash-av-trio-item" style={{ marginLeft: i === 0 ? 0 : -size * 0.32 }}>
          <MiniAv id={p.id} color={p.color} size={size} />
        </div>
      ))}
    </div>
  )
}

function PositionPicker({ position, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const current = POS_OPTIONS.find(o => o.pos === position) || POS_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [open])

  const select = pos => { onChange(pos); setOpen(false) }

  return (
    <div className="splash-pos-picker" ref={ref}>
      <button className="splash-pos-trigger" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <div className="splash-pos-trigger-trios">
          {POS_OPTIONS.map(opt => (
            <div key={opt.pos} className={`splash-pos-trigger-trio-slot${opt.pos === position ? ' splash-pos-trigger-trio-slot--active' : ''}`}>
              <AvatarTrio players={opt.players} size={40} />
            </div>
          ))}
        </div>
        <span className="splash-pos-trigger-label">{current.label}</span>
        <svg className={`splash-pos-caret${open ? ' open' : ''}`} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      <div className={`splash-pos-popup${open ? ' splash-pos-popup--open' : ''}`} aria-hidden={!open}>
        <div className="splash-pos-popup-grid">
          {POS_OPTIONS.filter(o => !o.disabled).map(opt => (
            <button
              key={opt.pos}
              className={`splash-pos-option${opt.pos === position ? ' splash-pos-option--active' : ''}`}
              onClick={() => select(opt.pos)}
              tabIndex={!open ? -1 : 0}
            >
              {(opt.pos === 'db' || (opt.pos === 'lb' && LB_LIVE) || (opt.pos === 'ol' && OL_LIVE) || (opt.pos === 'k' && K_LIVE)) && <span className="splash-pos-new-tag">NEW</span>}
              <div className="splash-pos-option-top">
                <AvatarTrio players={opt.players} size={40} />
                <span className="splash-pos-option-name">{opt.label}</span>
              </div>
              <div className="splash-pos-option-modes">
                <span className={`splash-mode-pill ${opt.alltime ? 'splash-mode-pill--alltime' : 'splash-mode-pill--alltime-soon'}`}>All‑Time</span>
                <span className={`splash-mode-pill ${opt.classic ? 'splash-mode-pill--avail' : 'splash-mode-pill--na'}`}>Current</span>
              </div>
            </button>
          ))}
        </div>

        <div className="splash-pos-vote-section-header">
          <div className="splash-pos-vote-section-rule" />
          <span className="splash-pos-vote-section-label">COMING SOON</span>
          <div className="splash-pos-vote-section-rule" />
        </div>

        <div className="splash-pos-popup-grid splash-pos-popup-grid--soon">
          {POS_OPTIONS.filter(o => o.disabled).map(opt => (
            <button
              key={opt.pos}
              className="splash-pos-option splash-pos-option--disabled"
              onClick={e => e.preventDefault()}
              tabIndex={!open ? -1 : 0}
            >
              <div className="splash-pos-soon-banner">COMING SOON</div>
              <div className="splash-pos-option-top">
                <AvatarTrio players={opt.players} size={30} />
                <span className="splash-pos-option-name">{opt.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const HoopU = () => (
  <svg className="hoop-u-svg" viewBox="0 0 68 90" fill="none" aria-hidden="true">
    <circle cx="34" cy="14" r="14.4" fill="#f97316"/>
    <path d="M8 24 L18 88 L50 88 L60 24" stroke="white" strokeWidth="6" strokeLinejoin="round" fill="none"/>
    <line x1="17" y1="25" x2="38" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="27" y1="25" x2="48" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="41" y1="25" x2="20" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="51" y1="25" x2="30" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="5" y1="26" x2="63" y2="26" stroke="white" strokeWidth="5" strokeLinecap="round"/>
  </svg>
)

const QB_ATTRS = [
  { label: 'Arm',                   col: '#f87171', angle:  -35, dist: 1.32, mx: 58, my: 14 },
  { label: 'Legs',                  col: '#60a5fa', angle:   55, dist: 1.30, mx: 3,  my: 30, dox: 80 },
  { label: 'Size',                  col: '#fb923c', angle:   15, dist: 1.28, mx: 62, my: 52 },
  { label: 'Pre-Snap',              col: '#e879f9', angle:  210, dist: 1.31, mx: 4,  my: 62 },
  { label: 'Accuracy',              col: '#34d399', angle: -130, dist: 1.30, mx: 55, my: 72 },
  { label: 'Leadership',            col: '#a78bfa', angle:  -70, dist: 1.29, mx: 5,  my: 18, doy: -30, dox: 140 },
  { label: 'Playmaking', col: '#fbbf24', angle:  100, dist: 1.32, mx: 68, my: 34, dox: -290 },
  { label: 'Pocket Presence',       col: '#2dd4bf', angle: -160, dist: 1.28, mx: 3,  my: 48, doy: 200 },
  { label: 'Post-Snap',             col: '#38bdf8', angle:   80, dist: 1.31, mx: 74, my: 44, dox: 270 },
]

const RB_ATTRS = [
  { label: 'Speed',           col: '#f87171', angle:  -35, dist: 1.32, mx: 58, my: 14 },
  { label: 'Burst',           col: '#60a5fa', angle:   55, dist: 1.30, mx: 3,  my: 30 },
  { label: 'Strength',        col: '#fbbf24', angle:   15, dist: 1.28, mx: 62, my: 52 },
  { label: 'Size',            col: '#fb923c', angle:  210, dist: 1.31, mx: 4,  my: 62 },
  { label: 'Contact Balance', col: '#2dd4bf', angle: -130, dist: 1.30, mx: 55, my: 72 },
  { label: 'Hands',           col: '#34d399', angle:  -70, dist: 1.29, mx: 5,  my: 18, doy: -30, dox: 140 },
  { label: 'Vision',          col: '#38bdf8', angle:  100, dist: 1.32, mx: 60, my: 34, dox: -210 },
  { label: 'Elusiveness',     col: '#a78bfa', angle: -160, dist: 1.28, mx: 3,  my: 48, doy: 200 },
]

const WR_ATTRS = [
  { label: 'Speed',        col: '#f87171', angle:  -35, dist: 1.32, mx: 58, my: 14 },
  { label: 'Size',         col: '#fb923c', angle:  210, dist: 1.31, mx: 4,  my: 62 },
  { label: 'Vertical',     col: '#a78bfa', angle:   15, dist: 1.28, mx: 62, my: 52 },
  { label: 'Release',      col: '#60a5fa', angle:   55, dist: 1.30, mx: 3,  my: 30 },
  { label: 'Route Running',col: '#34d399', angle: -130, dist: 1.30, mx: 55, my: 72 },
  { label: 'Body Control', col: '#2dd4bf', angle:  -70, dist: 1.29, mx: 5,  my: 18, doy: -30, dox: 140 },
  { label: 'Hands',        col: '#34d399', angle:  100, dist: 1.32, mx: 60, my: 34, dox: -210 },
  { label: 'Awareness',    col: '#e879f9', angle: -160, dist: 1.28, mx: 3,  my: 48, doy: 200 },
  { label: 'After Catch',  col: '#fbbf24', angle:   80, dist: 1.31, mx: 74, my: 44, dox: 270 },
]

const TE_ATTRS = [
  { label: 'Speed',        col: '#f87171', angle:  -35, dist: 1.32, mx: 58, my: 14 },
  { label: 'Blocking',     col: '#60a5fa', angle:   55, dist: 1.30, mx: 3,  my: 30 },
  { label: 'Vertical',     col: '#a78bfa', angle:   15, dist: 1.28, mx: 62, my: 52 },
  { label: 'Size',         col: '#fb923c', angle:  210, dist: 1.31, mx: 4,  my: 62 },
  { label: 'Route Running',col: '#34d399', angle: -130, dist: 1.30, mx: 55, my: 72 },
  { label: 'Strength',     col: '#fbbf24', angle:  -70, dist: 1.29, mx: 5,  my: 18, doy: -30, dox: 140 },
  { label: 'Hands',        col: '#34d399', angle:  100, dist: 1.32, mx: 60, my: 34, dox: -210 },
  { label: 'Awareness',    col: '#e879f9', angle: -160, dist: 1.28, mx: 3,  my: 48, doy: 200 },
  { label: 'After Catch',  col: '#fbbf24', angle:   80, dist: 1.31, mx: 74, my: 44, dox: 270 },
]

const DB_ATTRS = [
  { label: 'Speed',            col: '#f87171', angle:  -35, dist: 1.32, mx: 58, my: 14 },
  { label: 'Size',             col: '#fb923c', angle:   55, dist: 1.30, mx: 3,  my: 30 },
  { label: 'Fluidity',         col: '#60a5fa', angle:   15, dist: 1.28, mx: 62, my: 52 },
  { label: 'Press',            col: '#2dd4bf', angle:  210, dist: 1.31, mx: 4,  my: 62 },
  { label: 'Ball Skills',      col: '#34d399', angle: -130, dist: 1.30, mx: 55, my: 72 },
  { label: 'Zone IQ',          col: '#e879f9', angle:  -70, dist: 1.29, mx: 5,  my: 18, doy: -30, dox: 140 },
  { label: 'Man Coverage',     col: '#a78bfa', angle:  100, dist: 1.32, mx: 60, my: 34, dox: -210 },
  { label: 'Play Recognition', col: '#38bdf8', angle: -160, dist: 1.28, mx: 3,  my: 48, doy: 200 },
  { label: 'Run Support',      col: '#fbbf24', angle:   80, dist: 1.31, mx: 74, my: 44, dox: 270 },
]

// (the DL figure stands with its legs apart: the long words go on the head and body, the short ones down the right
//  leg a size smaller, the calf's word upright. x: % of the figure's width right of centre. Same nine colors.)
const DL_ATTRS = [
  { label: 'Power',    col: '#fb923c' },
  { label: 'Get Off',  col: '#f87171' },
  { label: 'Strength', col: '#fbbf24' },
  { label: 'Finesse',  col: '#34d399' },
  { label: 'Play Rec', col: '#e879f9' },
  { label: 'Speed',    col: '#60a5fa' },
  { label: 'Bend',     col: '#a78bfa' },
  { label: 'Size',     col: '#38bdf8' },
  { label: 'Shed',     col: '#2dd4bf' },
]

// (in LB_ATTR's colors, data/lbs.js; on the DL figure for now, laid out the same way)
// (on public/lb-silhouette.webp, measured off the art's outline: each word on the widest solid stretch of its band,
// from the thighs down on one leg, a size down; x is the % of the figure's box to move the word off centre)
const LB_ATTRS = [
  { label: 'Power',      col: '#fb923c' },
  { label: 'Leadership', col: '#a78bfa' },
  { label: 'Tackling',   col: '#f87171' },
  { label: 'Pass Rush',  col: '#fbbf24' },
  { label: 'Play Rec',   col: '#e879f9' },
  { label: 'Range',      col: '#60a5fa' },
  { label: 'Zone',       col: '#34d399' },
  { label: 'Size',       col: '#38bdf8' },
  { label: 'Shed',       col: '#2dd4bf' },
]

// (in OL_ATTR's colors, data/ols.js; on public/ol-silhouette.webp, measured off the art's outline the same way:
// each word on the widest solid stretch of its band. His legs are set wide apart, so from the thighs down a word
// sits on one leg, the short words a size down and the knee's word upright (the leg there is narrower than any
// word is long); x is the % of the figure's box to move the word off centre. "Blitz" is Blitz Pickup: the shoe
// only holds a short word.)
const OL_ATTRS = [
  { label: 'Anchor',     col: '#38bdf8' },
  { label: 'Pancake',    col: '#fbbf24' },
  { label: 'Discipline', col: '#a78bfa' },
  { label: 'Pass Pro',   col: '#2dd4bf' },
  { label: 'Run Block',  col: '#f87171' },
  { label: 'Mobility',   col: '#60a5fa' },
  { label: 'Length',     col: '#34d399' },
  { label: 'Size',       col: '#fb923c' },
  { label: 'Blitz',      col: '#e879f9' },
]

// The kicker's three, head to toe (on public/k-silhouette.webp): the nerve, the aim, the leg
const K_ATTRS = [
  // (the owner, 2026-11-12: head and face Clutch; torso, arms and legs Power; shins and shoes Accuracy. flex: each band's share of his height)
  { label: 'Clutch',   col: '#a78bfa', flex: 1.1 },
  { label: 'Power',    col: '#fb923c', flex: 1.75 },
  { label: 'Accuracy', col: '#34d399', flex: 1.15 },   // (his shins and shoes; the word like every other band's: centred, same size, nothing special)
]

// Football route-tree playbook sketch scattered faintly across the background
// in place of the old attribute pills.
function RouteBackground({ visible }) {
  return <div className={`splash-route-field${visible ? ' splash-route-field--visible' : ''}`} aria-hidden="true" />
}

// Manages its own "reveal shortly after mount" timer rather than reacting to
// an externally-toggled boolean. Combined with `key={position}` at the call
// site, a position switch fully unmounts the previous instance (killing any
// in-flight CSS transitions/timers outright) and mounts a clean one, so a
// fast switch can never leave a stale, half-finished animation behind.
function useRevealOnMount(ready) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(t)
  }, [ready])
  return visible
}

const STACK_MASK = {
  qb: { src: '/qb-silhouette.webp', scale: 1 },
  rb: { src: '/rb-silhouette.webp', scale: 1 },
  wr: { src: '/wr-silhouette.png',  scale: 1.18 },
  te: { src: '/wr-silhouette.png',  scale: 1.18 },
  db: { src: '/db-silhouette.png',  scale: 1.05 },
  dl: { src: '/dl-silhouette.webp',  scale: 1 },
  lb: { src: '/lb-silhouette.webp',  scale: 1 },
  ol: { src: '/ol-silhouette.webp',  scale: 1 },
  k:  { src: '/k-silhouette.webp',   scale: 1 },
}

// Silhouette body re-rendered as stacked, color-coded bands — one per build
// attribute, using each attribute's real in-game color — clipped to the
// exact outline of the position's silhouette image via a CSS mask, so it
// reads as the attributes "stacking up" into the body.
export function StackedSilhouette({ position, attrs, ready, fast = false }) {
  const visible = useRevealOnMount(ready)
  const mask = STACK_MASK[position] ?? STACK_MASK.qb
  return (
    <div
      className="splash-stack-figure"
      style={{
        WebkitMaskImage: `url(${mask.src})`,
        maskImage: `url(${mask.src})`,
        transform: mask.scale !== 1 ? `scale(${mask.scale})` : undefined,
      }}
    >
      {attrs.map((a, i) => (
        <div
          key={a.label}
          className="splash-stack-band"
          style={{
            background: a.col,
            ...(a.flex ? { flex: a.flex } : null),
            opacity: visible ? 1 : 0,
            // Starts stacked at the very top (i band-heights up) and falls
            // down to its own row — lower bands fall further.
            transform: visible ? 'translateY(0)' : `translateY(-${i * 100}%)`,
            // Fully sequential — each band only starts once the previous one
            // has completely finished falling (delay = full fall duration).
            transitionDelay: visible ? `${(attrs.length - 1 - i) * (fast ? 24 : 170)}ms` : '0ms',
          }}
        >
          <span className={`splash-stack-band-label${a.sm ? ' is-sm' : a.xs ? ' is-xs' : ''}${a.v ? ' is-v' : ''}`} style={a.x || a.y ? { position: 'relative', ...(a.x ? { left: `${a.x}%` } : null), ...(a.y ? { top: a.y } : null), ...(a.fs ? { fontSize: a.fs } : null) } : undefined}>{a.label}</span>
        </div>
      ))}
    </div>
  )
}

// Attribute bands per position — shared with the app home screen (components/app/AppHome)
export const SPLASH_ATTRS = { qb: QB_ATTRS, rb: RB_ATTRS, wr: WR_ATTRS, te: TE_ATTRS, db: DB_ATTRS, dl: DL_ATTRS, lb: LB_ATTRS, ol: OL_ATTRS, k: K_ATTRS }

export default function SplashScreen({ onStart, onDepthChart, onWiki }) {
  const [phase, setPhase] = useState(0)
  // A saved position that's since gone to Coming Soon (OL) falls back to QB
  const [position, setPosition] = useState(() => {
    let saved = null
    try { saved = localStorage.getItem('lastPosition') } catch {}
    return POS_OPTIONS.some(o => o.pos === saved && !o.disabled) ? saved : 'qb'
  })
  const isMobile  = useMemo(() => window.innerWidth <= 768, [])
  const isDesktop = useMemo(() => window.innerWidth > 768, [])
  const orbitScale = isDesktop ? 0.8 : 1

  const handlePosChange = pos => { setPosition(pos); try { localStorage.setItem('lastPosition', pos) } catch {} }

  useEffect(() => {
    POS_OPTIONS.forEach(opt => opt.players.forEach(p => {
      const src = hsUrl(p.id)
      if (src) { const img = new Image(); img.src = src }
    }))
  }, [])

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 80)
    const t2 = setTimeout(() => setPhase(2), 420)
    const t3 = setTimeout(() => setPhase(3), 800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const attrs = position === 'k' ? K_ATTRS : position === 'ol' ? OL_ATTRS : position === 'dl' ? DL_ATTRS : position === 'lb' ? LB_ATTRS : position === 'db' ? DB_ATTRS : position === 'te' ? TE_ATTRS : position === 'wr' ? WR_ATTRS : position === 'rb' ? RB_ATTRS : QB_ATTRS

  return (
    <div className={`splash-screen ${phase >= 1 ? 'splash-in' : ''}`}>
    <RouteBackground visible={phase >= 3} />
    <div className="splash-hero">

      <div className="splash-glow" style={{ opacity: phase >= 2 ? 1 : 0 }} />

      <div className="splash-header" style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'none' : 'translateY(-28px)' }}>
        <img src="/logo-v3.png" alt="Build-A-Player" className="splash-logo-mark" draggable={false} />
        <div className="splash-title splash-title--small">
          BUIL<span className="logo-d">D</span><em>-<span className="logo-a">A</span>-</em>PLAYER
        </div>
        <div className="splash-pos-toggle splash-pos-toggle--picker" style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? (isMobile ? 'translateY(-8px)' : 'none') : 'translateY(8px)' }}>
          <PositionPicker position={position} onChange={handlePosChange} />
        </div>
      </div>

      <div className="splash-figure-wrap" style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? 'none' : 'translateY(40px) scale(0.92)' }}>
        <div className="splash-figure-parallax">
          <img src="/qb-silhouette.webp" className="splash-figure" alt="" draggable={false}
            style={{ position: 'absolute', inset: 0, opacity: position === 'qb' ? 1 : 0 }} />
          <img src="/rb-silhouette.webp" className="splash-figure" alt="" draggable={false}
            style={{ position: 'absolute', inset: 0, opacity: position === 'rb' ? 1 : 0 }} />
          <img src="/wr-silhouette.png" className="splash-figure" alt="" draggable={false}
            style={{ position: 'absolute', inset: 0, opacity: (position === 'wr' || position === 'te') ? 1 : 0, transform: 'scale(1.18)', transformOrigin: 'center center' }} />
          <img src="/db-silhouette.png" className="splash-figure" alt="" draggable={false}
            style={{ position: 'absolute', inset: 0, opacity: position === 'db' ? 1 : 0, transform: 'scale(1.05)', transformOrigin: 'center center' }} />
          {/* (a large file: only fetched once DL is picked) */}
          {(position === 'dl' || position === 'lb' || position === 'ol' || position === 'k') && <img src={position === 'k' ? '/k-silhouette.webp' : position === 'ol' ? '/ol-silhouette.webp' : position === 'lb' ? '/lb-silhouette.webp' : '/dl-silhouette.webp'} className="splash-figure" alt="" draggable={false} style={{ position: 'absolute', inset: 0, filter: 'none' }} />}
          <StackedSilhouette key={position} position={position} attrs={attrs} ready={phase >= 3} />
          <div className="splash-figure-glow" />
        </div>
      </div>

      <div className="splash-footer" style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? (isMobile ? 'translateY(6px)' : 'none') : 'translateY(16px)' }}>

        <div className="splash-tagline"><span className="splash-tagline-dot" />1M+ Players. Build the Perfect Player.</div>

        <div className="splash-modes">
          <button className="splash-mode-classic" onClick={() => { try { localStorage.setItem('lastPosition', position) } catch {}; onStart('classic', position) }}>
            <div className="smode-title">Current</div>
            <div className="smode-badge">Current {position === 'rb' ? 'RBs' : position === 'wr' ? 'WRs' : position === 'te' ? 'TEs' : position === 'db' ? 'DBs' : position === 'dl' ? 'DLs' : position === 'lb' ? 'LBs' : position === 'ol' ? 'OLs' : 'QBs'}</div>
            <div className="smode-cta">
              START DRAFTING
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </button>

          {!POS_OPTIONS.find(o => o.pos === position)?.alltime ? (
            <button className="splash-mode-alltime splash-mode-alltime--soon" disabled>
              <div className="splash-mode-alltime--soon-banner">COMING SOON</div>
              <div className="smode-title smode-title--alltime">All-Time</div>
              <div className="smode-badge smode-badge--alltime">Draft the Greats</div>
              <div className="smode-cta smode-cta--alltime">
                START DRAFTING
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </button>
          ) : (
            <button
              className="splash-mode-alltime"
              onClick={() => { try { localStorage.setItem('lastPosition', position) } catch {}; onStart('all-time', position) }}
            >
              <div className="smode-title smode-title--alltime">
                All-Time
                {(position === 'wr' || position === 'db' || position === 'te' || position === 'lb') && <span className="splash-alltime-new-tag">NEW</span>}
              </div>
              <div className="smode-badge smode-badge--alltime">Draft the Greats</div>
              <div className="smode-cta smode-cta--alltime">
                START DRAFTING
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </button>
          )}
        </div>

        <button className="splash-minigame-btn splash-minigame-btn--depthchart" onClick={onDepthChart}>
          <div className="splash-dc-float-main">THE DEPTH CHART</div>
          <div className="splash-mg-sub">MINI GAME</div>
        </button>

        <button className="splash-minigame-btn splash-minigame-btn--bucket" onClick={() => window.location.href = '/bucket'}>
          <div className="splash-xlink-logo">
            BUIL<span className="splash-xlink-d">D</span><em className="splash-xlink-em splash-xlink-em--bucket">-<span className="splash-xlink-a">A</span>-</em>B<HoopU />CKET
          </div>
          <div className="splash-mg-sub">BASKETBALL BUILDER</div>
        </button>

        {SOCCER_LIVE && (
          <button className="splash-minigame-btn splash-minigame-btn--soccer" onClick={() => { window.location.href = '/soccer' + (import.meta.env.DEV && /[?&]soccer=1\b/.test(window.location.search) ? '?soccer=1' : '') }}>
            <div className="splash-xlink-logo">
              BUIL<span className="splash-xlink-d">D</span><em className="splash-xlink-em splash-xlink-em--soccer">-<span className="splash-xlink-a">A</span>-</em>PLAYER
            </div>
            <div className="splash-mg-sub">SOCCER BUILDER</div>
          </button>
        )}

        {BASEBALL_LIVE && (
          <button className="splash-minigame-btn splash-minigame-btn--baseball" onClick={() => { window.location.href = '/baseball' + (import.meta.env.DEV && /[?&]baseball=1\b/.test(window.location.search) ? '?baseball=1' : '') }}>
            <div className="splash-xlink-logo">
              BUIL<span className="splash-xlink-d">D</span><em className="splash-xlink-em splash-xlink-em--baseball">-<span className="splash-xlink-a">A</span>-</em>PLAYER
            </div>
            <div className="splash-mg-sub">BASEBALL BUILDER</div>
          </button>
        )}

        {/* the classic look's way back (Settings → Classic look brought them here) */}
        {!IS_APP && !APP_LOOK && <button className="splash-newlook" onClick={() => setClassicLook(false)}>Switch to the new look</button>}
      </div>

      <div className="splash-field-lines">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="splash-yard-line" style={{ opacity: phase >= 2 ? 1 : 0, transitionDelay: `${600 + i * 60}ms` }} />
        ))}
      </div>
    </div>

    <SiteFeatures sport="nfl" />

    <SiteFooter sport="nfl" onWiki={onWiki} />
    </div>
  )
}
