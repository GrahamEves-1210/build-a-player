import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo, lazy, Suspense } from 'react'
import { Helmet } from 'react-helmet-async'
import Navbar from './Navbar'
import SpinScreen from './SpinScreen'
import Silhouette from './Silhouette'
import ReportCard from './ReportCard'
import AuthModal from './AuthModal'
import BucketSimPage, { TeamSpinModal } from './BucketSimPage'
import { runBucketSimulation, getBucketGuardArchetype, getBucketBigArchetype, calcBucketOVR } from '../utils/bucketSimulation'
import BucketLeaderboardPage from './BucketLeaderboardPage'
import BucketSalaryCap from './BucketSalaryCap'
import PrivacyPage from './PrivacyPage'
import {
  NBA_GUARD_PLAYERS, NBA_BIG_PLAYERS,
  NBA_ALLTIME_GUARD_PLAYERS, NBA_ALLTIME_BIG_PLAYERS,
  NBA_TEAMS, BUCKET_ATTR,
  GUARD_TYPES, GUARD_CATEGORIES,
  BIG_TYPES, BIG_CATEGORIES,
} from '../data/nba-players'
import NBA_HEADSHOTS     from '../data/nba-headshots.json'
import NBA_POSITIONS     from '../data/nba-positions.json'
import { NBA_JERSEY_NUMBERS } from '../data/nba-jersey-numbers'
import { NBA_SKIN_COLORS }   from '../data/nba-skin-colors'
import { NBA_FACE_CENTERS }  from '../data/nba-face-centers'
import { supabase, rtSupabase } from '../lib/supabase'
import ProfilePage from './ProfilePage'
import CustomRatingsModal from './CustomRatingsModal'
const VersusLobby        = lazy(() => import('./VersusLobby'))
const BucketVersusResult = lazy(() => import('./BucketVersusResult'))
const VsPvPLeaderboard   = lazy(() => import('./VsPvPLeaderboard'))

function parseHtToIn(ht) {
  if (!ht) return null
  const m = ht.match(/^(\d+)'(\d+)/)
  return m ? +m[1] * 12 + +m[2] : null
}

function genericHeadshot(skinHex) {
  if (!skinHex) return '/genericdark.webp'
  const r = parseInt(skinHex.slice(1, 3), 16)
  const g = parseInt(skinHex.slice(3, 5), 16)
  const b = parseInt(skinHex.slice(5, 7), 16)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  return luminance > 155 ? '/genericlight.webp' : '/genericdark.webp'
}

const RAMP_AD_UNITS = ['bottom_rail', 'corner_ad_video', 'standard_iab', 'video_bottom_rail']
const RAMP_FORCE_OFF = RAMP_AD_UNITS.map(unit => ({ unit, force: 'off' }))

function enableAdFreeMode() {
  document.documentElement.classList.add('ads-hidden')
  // Tell Ramp not to load these units at all (must be set before Ramp initializes)
  window.ramp = window.ramp || {}
  window.ramp.forceUnits = RAMP_FORCE_OFF
  window.ramp.que = window.ramp.que || []
  window.ramp.que.push(() => {
    window.ramp.forceUnits = RAMP_FORCE_OFF
    try { window.ramp.destroyUnits(RAMP_AD_UNITS) } catch {}
  })
  // DOM fallback: hide any elements that already loaded or slip through
  const hide = () => {
    document.querySelectorAll('[id^="pw-"],[id^="ramp-"],[class^="pw-"],[id^="adBanner"],[id*="bottom_rail"],[class*="bottom_rail"],[id*="video-bottom"],[class*="video-bottom"],[data-pw-desk-top],[data-pw-moat],.square-ad').forEach(el => {
      el.style.setProperty('display', 'none', 'important')
    })
  }
  hide()
  const obs = new MutationObserver(hide)
  obs.observe(document.body, { childList: true, subtree: true })
}

// Early call — fires before Ramp initializes so forceUnits takes effect
try { if (localStorage.getItem('bap_subscribed') === '1' || localStorage.getItem('bap_ads_off') === '1') enableAdFreeMode() } catch {}

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

const TEAM_META = Object.fromEntries(
  NBA_TEAMS.map(t => [t.short, { color: t.color, color2: t.color2, teamName: t.name }])
)

function enrichPlayer(p) {
  return {
    ...p,
    color:      TEAM_META[p.team]?.color    ?? '#888888',
    color2:     TEAM_META[p.team]?.color2   ?? '#555555',
    teamName:   TEAM_META[p.team]?.teamName ?? p.team,
    position:   NBA_POSITIONS[p.name]?.pos  ?? '',
    number:     NBA_JERSEY_NUMBERS[p.name]  ?? p.number ?? null,
    skin:       NBA_SKIN_COLORS[p.name]     ?? null,
    faceCenter: NBA_FACE_CENTERS[p.name]    ?? null,
  }
}

const ENRICHED_GUARDS         = NBA_GUARD_PLAYERS.map(enrichPlayer)
const ENRICHED_BIGS           = NBA_BIG_PLAYERS.map(enrichPlayer)
const ENRICHED_ALLTIME_GUARDS = NBA_ALLTIME_GUARD_PLAYERS.map(enrichPlayer)
const ENRICHED_ALLTIME_BIGS   = NBA_ALLTIME_BIG_PLAYERS.map(enrichPlayer)

// ─── Bucket Splash ────────────────────────────────────────────────────────────
const BUCKET_SPLASH_ATTRS = {
  guard: [
    { label: 'Jump Shot',   col: '#34d399', angle:  -35, dist: 1.32, mx: 58, my: 14 },
    { label: 'Finishing',   col: '#fb923c', angle:   55, dist: 1.30, mx: 3,  my: 30 },
    { label: 'Handles',     col: '#a78bfa', angle:   15, dist: 1.28, mx: 62, my: 52 },
    { label: 'Speed',       col: '#f87171', angle:  210, dist: 1.31, mx: 4,  my: 62 },
    { label: 'Bounce',      col: '#fdba74', angle: -130, dist: 1.30, mx: 55, my: 72 },
    { label: 'Passing',     col: '#60a5fa', angle:  -70, dist: 1.29, mx: 5,  my: 18, doy: -30, dox: 140 },
    { label: 'Perimeter D', col: '#38bdf8', angle:  100, dist: 1.32, mx: 60, my: 34, dox: -240, doy: -20 },
    { label: 'Strength',    col: '#fbbf24', angle: -160, dist: 1.28, mx: 3,  my: 48, doy: 200 },
    { label: 'H/L',         col: '#e879f9', angle:   80, dist: 1.31, mx: 58, my: 44, dox: 110, doy: 10 },
  ],
  big: [
    { label: 'Jump Shot',    col: '#34d399', angle:  -35, dist: 1.32, mx: 58, my: 14 },
    { label: 'Finishing',    col: '#fb923c', angle:   55, dist: 1.30, mx: 3,  my: 30 },
    { label: 'Playmaking',   col: '#38bdf8', angle:   15, dist: 1.28, mx: 62, my: 52 },
    { label: 'Interior D',   col: '#4ade80', angle:  210, dist: 1.31, mx: 4,  my: 62 },
    { label: 'Rebounding',   col: '#a3e635', angle: -130, dist: 1.30, mx: 55, my: 72 },
    { label: 'Speed',        col: '#f87171', angle:  -70, dist: 1.29, mx: 5,  my: 18, doy: -30, dox: 140 },
    { label: 'Bounce',       col: '#fcd34d', angle:  100, dist: 1.32, mx: 60, my: 34, dox: -210 },
    { label: 'Basketball IQ',col: '#818cf8', angle: -160, dist: 1.28, mx: 3,  my: 48, doy: 200 },
    { label: 'Leadership',   col: '#818cf8', angle:   80, dist: 1.31, mx: 58, my: 44, dox: 90 },
  ],
}

function BucketChip({ label, col, angle, dist, visible, mx, my, isMobile, dox = 0, doy = 0 }) {
  const x = isMobile ? mx : 50 + dist * 34 * Math.cos((angle * Math.PI) / 180)
  const y = isMobile ? my : 48 + dist * 30 * Math.sin((angle * Math.PI) / 180)
  const ox = isMobile ? 0 : dox
  const oy = isMobile ? 0 : doy
  return (
    <div
      className="splash-chip"
      style={{
        left: ox ? `calc(${x}% + ${ox}px)` : `${x}%`,
        top:  oy ? `calc(${y}% + ${oy}px)` : `${y}%`,
        borderColor: col, color: col,
        opacity: visible ? 1 : 0,
        transform: visible
          ? (isMobile ? 'translate(0,-50%) scale(1)' : 'translate(-50%,-50%) scale(1)')
          : (isMobile ? 'translate(0,-50%) scale(0.6)' : 'translate(-50%,-50%) scale(0.6)'),
        transitionDelay: visible ? `${300 + Math.abs(angle) % 400}ms` : '0ms',
      }}
    >
      <span className="splash-chip-dot" style={{ background: col }} />
      {label}
    </div>
  )
}

const POS_LABELS = { guard: 'Guard', big: 'Big' }

function BucketSplash({ onStart, onVersus }) {
  const [phase, setPhase]       = useState(0)
  const [position, setPosition] = useState(() => { const p = localStorage.getItem('bucketPosition'); return (p === 'guard' || p === 'big') ? p : 'guard' })
  const isMobile = useMemo(() => window.innerWidth <= 768, [])

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 80)
    const t2 = setTimeout(() => setPhase(2), 420)
    const t3 = setTimeout(() => setPhase(3), 800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const splashAttrs = BUCKET_SPLASH_ATTRS[position]

  return (
    <div className={`splash-screen bucket-splash ${phase >= 1 ? 'splash-in' : ''}`}>

      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: '-20px', backgroundImage: "url('/bucketbackground.webp')", backgroundSize: 'cover', backgroundPosition: 'center 65%', filter: 'blur(3px) brightness(0.55)' }} />
      </div>

      <div className="splash-mob-disclaimer">Fan-made · Not affiliated with the NBA</div>
      <div className="splash-glow" style={{ opacity: phase >= 2 ? 1 : 0 }} />

      {splashAttrs.map(a => (
        <BucketChip key={a.label} {...a} visible={phase >= 3} isMobile={isMobile} />
      ))}

      <div className="splash-header" style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'none' : 'translateY(-28px)' }}>
        <div className="splash-title">
          BUIL<span className="logo-d">D</span><em>-<span className="logo-a">A</span>-</em>B<HoopU />CKET
        </div>
        <div className="splash-pos-toggle" style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? 'none' : 'translateY(8px)' }}>
          {['guard', 'big'].map(pos => (
            <button
              key={pos}
              className={`splash-pos-btn${position === pos ? ' splash-pos-btn--active' : ''}`}
              onClick={() => setPosition(pos)}
            >
              {POS_LABELS[pos]}
              <span className="splash-pos-sub">{pos === 'guard' ? 'PG · SG · SF' : 'PF · C'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="splash-figure-wrap bucket-figure-wrap" style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? 'none' : 'translateY(40px) scale(0.92)' }}>
        <img src="/basketballsilhouette.png" className="splash-figure" alt="" draggable={false} style={{ position: 'absolute', inset: 0 }} />
        <div className="splash-figure-glow" />
      </div>

      <div className="splash-footer" style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? 'none' : 'translateY(16px)' }}>

        <div className="splash-tagline">Spin the wheel · Build-A-{POS_LABELS[position]}</div>

        <div className="splash-modes">
          <button className="splash-mode-classic" onClick={() => { localStorage.setItem('bucketPosition', position); onStart('classic', position) }}>
            <div className="smode-title">Classic</div>
            <div className="smode-badge">Current NBA</div>
            <div className="smode-cta">
              START DRAFTING
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </button>

          <div className="splash-modes-secondary">
            <button className="splash-mode-alltime" onClick={() => { localStorage.setItem('bucketPosition', position); onStart('all-time', position) }}>
              <div className="smode-daily-banner" style={{ background: 'linear-gradient(135deg, #ca8a04, #eab308)' }}>NEW</div>
              <div className="smode-title">All-Time</div>
              <div className="smode-badge">NBA Legends</div>
            </button>

            <button className="splash-mode-salarycap" style={{ position: 'relative' }} onClick={() => { localStorage.setItem('bucketPosition', position); onStart('salarycap', position) }}>
              <div className="smode-daily-banner">DAILY</div>
              <div className="smode-title">Salary Cap</div>
              <div className="smode-badge">Build on a budget</div>
            </button>
          </div>
        </div>

<button className="splash-minigame-btn splash-minigame-btn--h2h" style={{ position: 'relative' }} onClick={() => onVersus?.(position)}>
          <span className="splash-h2h-new">NEW</span>
          <div className="splash-h2h-logo">HEAD<span className="h2h-to">-TO-</span>HEAD</div>
          <div className="splash-mg-sub splash-mg-sub--h2h">1v1 · 5v5</div>
        </button>

        <button className="splash-minigame-btn splash-minigame-btn--player" onClick={() => { localStorage.removeItem('bap_progress'); window.location.href = '/'; }}>
          <div className="splash-xlink-logo">
            BUIL<span className="splash-xlink-d">D</span><em className="splash-xlink-em splash-xlink-em--player">-<span className="splash-xlink-a">A</span>-</em>PLAYER
          </div>
          <div className="splash-mg-sub">FOOTBALL BUILDER</div>
        </button>

        <div className="splash-disclaimer">Fan-made · Not affiliated with the NBA</div>
      </div>

      <div className="splash-field-lines">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="splash-yard-line" style={{ opacity: phase >= 2 ? 1 : 0, transitionDelay: `${600 + i * 60}ms` }} />
        ))}
      </div>
    </div>
  )
}

const POS_TYPES = { guard: GUARD_TYPES, big: BIG_TYPES }
const POS_CATS  = { guard: GUARD_CATEGORIES, big: BIG_CATEGORIES }

// ─── BucketApp ────────────────────────────────────────────────────────────────
export default function BucketApp() {
  const [page, setPage]               = useState('splash')
  const [gameMode, setGameMode]       = useState(null)
  const [position, setPosition]       = useState(() => localStorage.getItem('bucketPosition') || 'guard')
  const [build, setBuild]             = useState({})
  const figureRef = useRef(null)
  const captureFigure = useCallback(async () => {
    const el = figureRef.current
    if (!el) return null
    try {
      const html2canvas = (await import('html2canvas')).default
      const c = await html2canvas(el, { backgroundColor: null, scale: 2, useCORS: true, allowTaint: true, logging: false })
      return c.toDataURL('image/png')
    } catch { return null }
  }, [])
  const [activeDrag, setActiveDrag]   = useState(null)
  const [activeCategory, setActiveCategory] = useState('skills')
  const [spinResetKey, setSpinResetKey] = useState(0)
  const [gameKey, setGameKey]         = useState(0)
  const [mobileView, setMobileView]   = useState('spin')
  const [user, setUser]               = useState(null)
  const [adsDisabled, setAdsDisabled] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(() => { try { return localStorage.getItem('bap_subscribed') === '1' } catch { return false } })
  const [showAuth, setShowAuth]       = useState(false)
  const [spinPhase, setSpinPhase]     = useState('idle')
  const [showTeamSpin, setShowTeamSpin] = useState(false)
  const [simResult, setSimResult]     = useState(null)
  const [simInitialScreen, setSimInitialScreen] = useState(0)
  const [salaryReturnDate, setSalaryReturnDate] = useState(null)
  const [savedSpinResult, setSavedSpinResult] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bab_spin_result')) } catch { return null }
  })
  const [isBucketCustomMode, setIsBucketCustomMode] = useState(() => {
    try { return localStorage.getItem('bab_custom_mode') === '1' } catch { return false }
  })
  const [bucketCustomRatings, setBucketCustomRatings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bab_bucket_custom_ratings') || '{}') } catch { return {} }
  })
  const [showBucketCustomModal, setShowBucketCustomModal] = useState(false)
  const [showSandboxWarning, setShowSandboxWarning] = useState(false)

  // Versus mode
  const [versusRoom,     setVersusRoom]     = useState(null)
  const [oppBuild,       setOppBuild]       = useState({})
  const [oppPlayer,      setOppPlayer]      = useState(null)
  const [leaveConfirm,   setLeaveConfirm]   = useState(null)
  const [vsRecord,       setVsRecord]       = useState({ wins: 0, losses: 0 })
  const [oppRecord,      setOppRecord]      = useState(null)
  const [oppPosition,    setOppPosition]    = useState(null)
  const [showVsPrompt,   setShowVsPrompt]   = useState(false)
  const [oppDisconnected, setOppDisconnected] = useState(false)
  const [versusGame,     setVersusGame]     = useState(null)
  const vsResultRef      = useRef({ build: {}, user: null, position: 'guard' })
  const faceoffFiredRef  = useRef(false)
  useEffect(() => { vsResultRef.current = { build, user, position } }, [build, user, position])

  const activeDragRef = useRef(activeDrag)
  useLayoutEffect(() => { activeDragRef.current = activeDrag }, [activeDrag])

  // Once sandbox is ever turned on during a build session, taint it permanently
  // until reset — prevents toggle-on → edit → toggle-off → simulate exploit
  const sandboxTainted = useRef(isBucketCustomMode)
  useEffect(() => {
    if (isBucketCustomMode) sandboxTainted.current = true
  }, [isBucketCustomMode])

  // Set basketball sport attribute on root
  useEffect(() => {
    document.documentElement.setAttribute('data-sport', 'bucket')
    return () => document.documentElement.removeAttribute('data-sport')
  }, [])

  // Measure bottom-rail ad height and set --ad-h so buttons move up correctly
  useEffect(() => {
    const root = document.documentElement
    let elObs = null

    function measure() {
      const el = document.querySelector('[id^="pw-oop"][data-pw-status="loaded"]')
      if (!el) { root.style.removeProperty('--ad-h'); return }
      const cs = window.getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') {
        root.style.setProperty('--ad-h', '0px')
        return
      }
      let h = el.getBoundingClientRect().height
      if (h < 4) {
        for (const child of el.querySelectorAll('iframe, div')) {
          h = Math.max(h, child.getBoundingClientRect().height)
        }
      }
      if (h > 4) {
        const extra = Math.max(0, Math.ceil(h) - 50)
        if (extra > 0) {
          root.style.setProperty('--ad-h', `${extra}px`)
        } else {
          root.style.removeProperty('--ad-h')
        }
      } else {
        root.style.removeProperty('--ad-h')
      }
    }

    function attachElObs() {
      if (elObs) { elObs.disconnect(); elObs = null }
      const el = document.querySelector('[id^="pw-oop"][data-pw-status="loaded"]')
      if (el) {
        elObs = new MutationObserver(measure)
        elObs.observe(el, { attributes: true, attributeFilter: ['style', 'class'] })
      }
    }

    measure()
    const bodyObs = new MutationObserver(() => { attachElObs(); measure() })
    bodyObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-pw-status', 'style'] })
    return () => { bodyObs.disconnect(); if (elObs) elObs.disconnect() }
  }, [])

  useEffect(() => {
    const handlePop = () => {
      if (window.location.pathname !== '/profile') {
        setPage(prev => prev === 'profile' ? 'game' : prev)
        window.scrollTo({ top: 0, behavior: 'instant' })
      }
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  // Initialize Playwire ads on mount and page change
  useEffect(() => {
    window.ramp?.que?.push(() => {
      if (page === 'splash') {
        try { window.ramp.destroyUnits(RAMP_AD_UNITS) } catch {}
      } else {
        window.ramp.spaNewPage()
      }
    })
  }, [page])

  // Fetch my W-L record when entering versus-game
  useEffect(() => {
    if (page !== 'versus-game' || !user || !supabase) return
    supabase
      .from('vs_results')
      .select('result')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (!data) return
        const wins   = data.filter(r => r.result === 'win').length
        const losses = data.filter(r => r.result === 'loss' || r.result === 'forfeit').length
        setVsRecord({ wins, losses })
      })
  }, [page, user])

  // Fetch opponent W-L record when versusRoom is set
  useEffect(() => {
    if (!versusRoom?.oppId || !supabase) return
    setOppRecord(null)
    supabase
      .from('vs_results')
      .select('result')
      .eq('user_id', versusRoom.oppId)
      .then(({ data }) => {
        if (!data) return
        const wins   = data.filter(r => r.result === 'win').length
        const losses = data.filter(r => r.result === 'loss' || r.result === 'forfeit').length
        setOppRecord({ wins, losses })
      })
  }, [versusRoom?.oppId])

  useEffect(() => {
    if (!supabase) return
    const adFreeReturn = new URLSearchParams(window.location.search).get('ad_free') === '1'
    if (adFreeReturn) {
      enableAdFreeMode()
      setIsSubscribed(true)
      try { localStorage.setItem('bap_subscribed', '1') } catch {}
      window.history.replaceState({}, '', window.location.pathname)
    }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (!u) { try { localStorage.removeItem('bap_subscribed') } catch {}; try { localStorage.removeItem('bap_ads_off') } catch {}; return }
      supabase.from('accounts').select('ads_disabled,subscription_status').eq('id', u.id).single()
        .then(({ data: p }) => {
          if (p?.ads_disabled || p?.subscription_status === 'active') { setAdsDisabled(true); enableAdFreeMode() }
          if (p?.ads_disabled) { try { localStorage.setItem('bap_ads_off', '1') } catch {} }
          else { try { localStorage.removeItem('bap_ads_off') } catch {} }
          if (p?.subscription_status === 'active') { setIsSubscribed(true); try { localStorage.setItem('bap_subscribed', '1') } catch {} }
          else { try { localStorage.removeItem('bap_subscribed') } catch {} }
        })
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])


  useEffect(() => {
    try {
      if (savedSpinResult) localStorage.setItem('bab_spin_result', JSON.stringify(savedSpinResult))
      else localStorage.removeItem('bab_spin_result')
    } catch {}
  }, [savedSpinResult])

  const activeTypes = POS_TYPES[position] ?? GUARD_TYPES
  const activeCategories = POS_CATS[position] ?? GUARD_CATEGORIES

  const handleSandboxToggle = useCallback((on) => {
    if (on) {
      setShowSandboxWarning(true)
    } else {
      setIsBucketCustomMode(false)
      try { localStorage.setItem('bab_custom_mode', '0') } catch {}
    }
  }, [])

  const confirmSandbox = useCallback(() => {
    setIsBucketCustomMode(true)
    try { localStorage.setItem('bab_custom_mode', '1') } catch {}
    setShowSandboxWarning(false)
  }, [])

  const currentPool = useMemo(() => {
    if (gameMode === 'all-time') {
      return position === 'guard' ? ENRICHED_ALLTIME_GUARDS : ENRICHED_ALLTIME_BIGS
    }
    const base = position === 'guard' ? ENRICHED_GUARDS : ENRICHED_BIGS
    if (!isBucketCustomMode) return base
    const overrides = bucketCustomRatings[`bucket_${position}`] || {}
    if (Object.keys(overrides).length === 0) return base
    return base.map(p => {
      const override = overrides[`${p.name}|${p.team}`]
      return override ? { ...p, attrs: { ...p.attrs, ...override } } : p
    })
  }, [position, gameMode, isBucketCustomMode, bucketCustomRatings])

  const handleStart = useCallback((mode, pos = 'guard') => {
    setGameMode(mode)
    setPosition(pos)
    const types = POS_TYPES[pos] ?? GUARD_TYPES
    setBuild(Object.fromEntries(types.map(t => [t, null])))
    setActiveCategory((POS_CATS[pos] ?? GUARD_CATEGORIES)[0].id)
    sandboxTainted.current = isBucketCustomMode
    setPage(mode === 'salarycap' ? 'salarycap' : 'game')
    window.scrollTo(0, 0)
  }, [isBucketCustomMode])

  const handleSalaryCapConfirm = useCallback((capBuild, skipToEnd = false, dateStr = null, saveData = null, capPosition = null) => {
    if (dateStr) setSalaryReturnDate(dateStr)
    // Salary cap covers 10 specific types; fill gaps so sim can fire
    const fullBuild = { ...capBuild }
    const fallback = capBuild['passing'] ?? capBuild['playmaking'] ?? Object.values(capBuild).find(Boolean)
    activeTypes.forEach(t => {
      if (!fullBuild[t] && fallback) fullBuild[t] = { ...fallback, type: t }
    })
    // Use size player for model figure (jersey number + headshot come from 'clutch' slot)
    if (capBuild['size']) {
      fullBuild['clutch']       = { ...capBuild['size'], type: 'clutch' }
      fullBuild['basketballIQ'] = { ...capBuild['size'], type: 'basketballIQ' }
    }
    // When a big was picked for size/athl, remap guard attrs → big attr keys
    // so getBucketBigArchetype can read interiorDefense, playmaking, rebounding
    if (capPosition === 'big' && position === 'guard') {
      if (fullBuild.perimeterDefense)
        fullBuild.interiorDefense = { ...fullBuild.perimeterDefense, type: 'interiorDefense' }
      if (!fullBuild.playmaking)
        fullBuild.playmaking = { ...(fullBuild.passing ?? fallback), type: 'playmaking' }
      if (!fullBuild.rebounding)
        fullBuild.rebounding = { ...(fallback), type: 'rebounding', val: 6 }
    }
    setBuild(fullBuild)
    // Auto-sim: skip the build screen and go straight to results
    // Team is seeded from the date so "View Results" always returns the same team
    const dateSeed = dateStr ? parseInt(dateStr.replace(/-/g, ''), 10) : Date.now()
    let h = dateSeed | 0; h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) | 0; h ^= h >>> 16
    const randomTeam = NBA_TEAMS[Math.floor(((h >>> 0) / 0x100000000) * NBA_TEAMS.length)]
    const result = runBucketSimulation(fullBuild, activeTypes, randomTeam, capPosition ?? position, dateSeed)
    setSimResult(result)
    setSimInitialScreen(skipToEnd ? 4 : 0)
    setPage('sim')
    window.scrollTo(0, 0)
    // Save to leaderboard with the real sim OVR (only on fresh plays, not View Results)
    if (saveData && supabase && !skipToEnd) {
      if (saveData.infinite) {
        supabase.from('salary_infinite_plays').insert({
          user_id:       saveData.userId,
          username:      saveData.username,
          picks:         saveData.picks,
          overall_score: result.ovr,
          ppg:           saveData.ppg,
          apg:           saveData.apg,
          rpg:           saveData.rpg,
          budget_used:   saveData.totalCost,
        }).then(({ error }) => { if (error) console.error('[salary-infinite] save failed:', error) })
      } else {
        supabase.from('salary_cap_plays').insert({
          date_str:      dateStr,
          user_id:       saveData.userId,
          username:      saveData.username,
          picks:         saveData.picks,
          overall_score: result.ovr,
          ppg:           saveData.ppg,
          apg:           saveData.apg,
          rpg:           saveData.rpg,
          budget_used:   saveData.totalCost,
        }).then(({ error }) => { if (error) console.error('[salary-cap] save failed:', error) })
      }
    }
  }, [activeTypes, position])

  const handleSwitchPosition = useCallback((pos) => {
    localStorage.setItem('bucketPosition', pos)
    setPosition(pos)
    const types = POS_TYPES[pos] ?? GUARD_TYPES
    setBuild(Object.fromEntries(types.map(t => [t, null])))
    setActiveCategory((POS_CATS[pos] ?? GUARD_CATEGORIES)[0].id)
    setActiveDrag(null)
    setSpinResetKey(k => k + 1)
    setGameKey(k => k + 1)
    setMobileView('spin')
  }, [])

  const handleDrop = useCallback(() => {
    const drag = activeDragRef.current
    if (!drag) return
    setBuild(prev => ({ ...prev, [drag.type]: drag }))
    setActiveDrag(null)
    setSpinResetKey(k => k + 1)
  }, [])

  const handleReset = useCallback(() => {
    faceoffFiredRef.current = false
    setVersusGame(null)
    setVersusRoom(prev => {
      if (prev) { recordVsForfeiture(); cleanupVersusChannel(prev.channel) }
      return null
    })
    setOppBuild({})
    setOppPlayer(null)
    setBuild(Object.fromEntries(activeTypes.map(t => [t, null])))
    setActiveDrag(null)
    setSpinResetKey(k => k + 1)
    setGameKey(k => k + 1)
    setMobileView('spin')
    setActiveCategory((POS_CATS[position] ?? GUARD_CATEGORIES)[0].id)
    setSimResult(null)
    setSavedSpinResult(null)
    setShowTeamSpin(false)
    sandboxTainted.current = isBucketCustomMode
    setPage('game')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [activeTypes])

  const handleTeamPicked = useCallback((team) => {
    const result = runBucketSimulation(build, activeTypes, team, position, null, gameMode)
    setSimResult(result)
    setShowTeamSpin(false)
    setPage('sim')
    window.scrollTo({ top: 0, behavior: 'instant' })

    if (!supabase || !user || isBucketCustomMode || sandboxTainted.current) return
    const archetype = position === 'big'
      ? getBucketBigArchetype(result.ovr, build, activeTypes)
      : getBucketGuardArchetype(result.ovr, build, activeTypes)
    const buildJson = Object.fromEntries(
      activeTypes
        .filter(t => build[t])
        .map(t => [t, { qb: build[t].qbFull, team: build[t].team, val: build[t].val, number: build[t].number ?? null }])
    )
    supabase.from('simulations').insert({
      user_id:     user.id,
      username:    user.user_metadata?.username || user.email?.split('@')[0],
      ovr:         result.ovr,
      archetype,
      game_mode:   gameMode === 'all-time' ? 'bucket-all-time' : 'bucket-classic',
      position,
      wins:        result.wins,
      losses:      result.losses,
      champion:    result.champion,
      finals_opp:  result.finalsOpp ?? null,
      finals_series: result.finalsSeries ?? null,
      mvp:         result.mvp,
      dpoy:        result.dpoy,
      ppg:         result.ppg,
      rpg:         result.rpg,
      apg:         result.apg,
      spg:         result.spg,
      bpg:         result.bpg,
      per:         result.per,
      fg_pct:      result.fgPct,
      three_pct:   result.threePct,
      best_pts:    result.bestGame?.pts ?? 0,
      team_short:  team.short,
      build:       buildJson,
    }).then(({ error }) => { if (error) console.error('[bucket save]', error.code, error.message, error.details, error.hint) })
  }, [build, activeTypes, position, user, gameMode])

  const handleDevFill = useCallback(() => {
    const pool = currentPool.filter(p => p.attrs)
    if (!pool.length) return
    const filled = Object.fromEntries(activeTypes.map(type => {
      const sorted = [...pool].sort((a, b) => (b.attrs[type] ?? 0) - (a.attrs[type] ?? 0))
      const topN = sorted.slice(0, 8)
      const p = topN[Math.floor(Math.random() * topN.length)]
      const photo = NBA_HEADSHOTS[p.name] ? `/headshots/nba/${NBA_HEADSHOTS[p.name]}.webp` : genericHeadshot(p.skin)
      return [type, {
        type, val: p.attrs[type] ?? 5,
        qb: p.short, qbFull: p.name,
        teamColor: p.color, teamColor2: p.color2,
        skinColor: p.skin, number: p.number,
        team: p.team, captain: p.captain ?? false, photo,
        height: p.height ?? null, weight: p.weight ?? null,
      }]
    }))
    setBuild(filled)
    setMobileView('build')
  }, [currentPool, activeTypes])

  const handleChipTap = useCallback((chipData) => {
    setBuild(prev => {
      if (prev[chipData.type] !== undefined && prev[chipData.type]) return prev
      const next = { ...prev, [chipData.type]: chipData }
      if (activeTypes.every(t => next[t])) setMobileView('build')
      return next
    })
    setSpinResetKey(k => k + 1)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [activeTypes])

  const handleHome = useCallback(() => {
    faceoffFiredRef.current = false
    setVersusGame(null)
    setVersusRoom(prev => {
      if (prev) { recordVsForfeiture(); cleanupVersusChannel(prev.channel) }
      return null
    })
    setOppBuild({})
    setOppPlayer(null)
    setPage('splash')
    setGameMode(null)
    setBuild({})
    setActiveDrag(null)
    setSpinResetKey(0)
    setMobileView('spin')
    sandboxTainted.current = isBucketCustomMode
  }, [isBucketCustomMode])

  const handleNavPositionSwitch = useCallback((pos) => {
    localStorage.setItem('bucketPosition', pos)
    handleHome()
  }, [handleHome])

  // Guard: show leave-confirmation modal before any action that exits an active versus game
  const guardedLeave = useCallback((fn) => {
    if (versusRoom) { setLeaveConfirm({ fn }); return }
    fn()
  }, [versusRoom])

  // Intercept browser back while in an active versus game
  useEffect(() => {
    if (!versusRoom) return
    window.history.pushState(null, '', window.location.href)
    const handler = () => {
      window.history.pushState(null, '', window.location.href)
      setLeaveConfirm({ fn: handleReset })
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [versusRoom, handleReset])

  const handleVersusJoin = useCallback(({ code, role, oppId, oppName, channel }) => {
    channel.on('broadcast', { event: 'bab_build' }, ({ payload }) => {
      setOppBuild(payload.build || {})
      setOppPlayer(payload.player || null)
    })
    channel.on('broadcast', { event: 'bab_faceoff' }, () => {
      setPage('versus-result')
    })
    channel.on('broadcast', { event: 'bab_position' }, ({ payload }) => {
      setOppPosition(payload.position || null)
    })
    // Guest stores game data broadcast by host (with perspective flipped)
    channel.on('broadcast', { event: 'bab_game' }, ({ payload }) => {
      if (role !== 'guest' || !payload?.plays) return
      const flipped = payload.plays.map(p => ({
        ...p,
        who: p.who === 'me' ? 'opp' : p.who === 'opp' ? 'me' : p.who,
        milestoneFor: p.milestoneFor === 'me' ? 'opp' : p.milestoneFor === 'opp' ? 'me' : p.milestoneFor,
        myPts: p.oppPts,
        oppPts: p.myPts,
      }))
      setVersusGame({ plays: flipped, finalMy: payload.finalOpp, finalOpp: payload.finalMy })
    })

    // Detect opponent disconnect via Supabase presence (not available on BroadcastChannel mock)
    if (!channel._bc) {
      channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const theyLeft = leftPresences.some(p => p.vid === oppId)
        if (!theyLeft) return
        const { build: b, user: u, position: pos } = vsResultRef.current
        if (u && supabase) {
          supabase.from('vs_results').insert({
            user_id:  u.id,
            username: u.user_metadata?.username || u.email?.split('@')[0],
            result:   'win',
            ovr:      calcBucketOVR(b, POS_TYPES[pos] ?? GUARD_TYPES, pos),
            position: pos,
          }).catch(() => {})
        }
        setOppDisconnected(true)
        setVersusRoom(null)
        cleanupVersusChannel(channel)
      })
    }

    setVersusRoom({ code, role, oppId, oppName, channel })
    setOppBuild({})
    setOppPlayer(null)
    setOppPosition(null)
    setOppRecord(null)
    setBuild(Object.fromEntries(activeTypes.map(t => [t, null])))
    setActiveCategory((POS_CATS[position] ?? GUARD_CATEGORIES)[0].id)
    setSavedSpinResult(null)
    setSimResult(null)
    setMobileView('spin')
    setSpinResetKey(k => k + 1)
    setShowVsPrompt(true)
    setPage('versus-game')
    window.scrollTo(0, 0)

    // Subscribe the game channel now that all .on() handlers are registered.
    // For BC-wrapped channels, subscribe() is a no-op (BC is always ready).
    // For already-subscribed friend-room channels, this is also safe (idempotent).
    channel.subscribe(s => {
      if (s === 'SUBSCRIBED') {
        channel.send({ type: 'broadcast', event: 'bab_position', payload: { position } }).catch?.(() => {})
      }
    })
  }, [activeTypes, position])

  useEffect(() => {
    if (!versusRoom?.channel || page !== 'versus-game') return
    versusRoom.channel.send({
      type: 'broadcast', event: 'bab_build',
      payload: { build, player: savedSpinResult },
    }).catch?.(() => {})
  }, [build, savedSpinResult, versusRoom, page])

  // Auto-start: when both players have all attributes, host fires faceoff automatically
  useEffect(() => {
    if (page !== 'versus-game' || !versusRoom || versusRoom.role !== 'host') {
      if (!versusRoom || page !== 'versus-game') faceoffFiredRef.current = false
      return
    }
    const myF  = activeTypes.filter(t => build[t]).length
    const oppF = activeTypes.filter(t => oppBuild[t]).length
    if (myF === activeTypes.length && oppF === activeTypes.length && !faceoffFiredRef.current) {
      faceoffFiredRef.current = true
      versusRoom.channel?.send({ type: 'broadcast', event: 'bab_faceoff', payload: {} }).catch?.(() => {})
      setTimeout(() => setPage('versus-result'), 300)
    }
  }, [build, oppBuild, page, versusRoom, activeTypes])

  function cleanupVersusChannel(ch) {
    if (!ch) return
    if (ch._bc) { ch.close() }
    else { try { (rtSupabase || supabase).removeChannel(ch) } catch {} }
  }

  function vsResultPayload(result) {
    return {
      user_id:  user.id,
      username: user.user_metadata?.username || user.email?.split('@')[0],
      result,
      ovr:      calcBucketOVR(build, activeTypes, position),
      position,
    }
  }

  function recordVsForfeiture() {
    if (!supabase || !user) return
    supabase.from('vs_results').insert(vsResultPayload('forfeit')).catch(() => {})
  }

  function recordVsResult(result) {
    if (!supabase || !user) return
    supabase.from('vs_results').insert(vsResultPayload(result)).catch(() => {})
  }

  if (page === 'splash') {
    return (
      <BucketSplash
        onStart={handleStart}
        onVersus={(pos) => {
          const p = pos || 'guard'
          localStorage.setItem('bucketPosition', p)
          setPosition(p)
          setGameMode('classic')
          setBuild(Object.fromEntries((POS_TYPES[p] ?? GUARD_TYPES).map(t => [t, null])))
          setPage('versus-lobby')
        }}
      />
    )
  }


  if (page === 'versus-lobby') {
    return (
      <>
        <Suspense fallback={null}>
          <VersusLobby
            onJoin={handleVersusJoin}
            position={position}
            gameMode="classic"
            onBack={() => setPage('splash')}
            onLeaderboard={() => setPage('pvp-leaderboard')}
            onSignIn={() => setShowAuth(true)}
            onProfile={() => user ? (window.history.pushState({}, '', '/profile'), setPage('profile')) : setShowAuth(true)}
            onAbout={() => { window.location.href = '/?about' }}
            user={user}
            vsRecord={vsRecord}
            channelPrefix="bab"
          />
        </Suspense>
        {showAuth && (
          <AuthModal
            onClose={() => setShowAuth(false)}
            onAuth={setUser}
          />
        )}
      </>
    )
  }

  if (page === 'versus-result') {
    return (
      <Suspense fallback={null}>
        <BucketVersusResult
          myData={{ build, player: savedSpinResult, name: user?.user_metadata?.username || user?.email?.split('@')[0] || 'You' }}
          oppData={{ build: oppBuild, player: oppPlayer, name: versusRoom?.oppName || 'Opponent' }}
          position={position}
          role={versusRoom?.role}
          channel={versusRoom?.channel}
          versusGame={versusGame}
          user={user}
          onResult={recordVsResult}
          onRematch={() => {
            faceoffFiredRef.current = false
            setVersusGame(null)
            setBuild(Object.fromEntries(activeTypes.map(t => [t, null])))
            setOppBuild({})
            setOppPlayer(null)
            setSavedSpinResult(null)
            setMobileView('spin')
            setSpinResetKey(k => k + 1)
            setPage('versus-game')
            window.scrollTo(0, 0)
          }}
          onExit={() => {
            cleanupVersusChannel(versusRoom?.channel)
            setVersusRoom(null)
            setVersusGame(null)
            setOppBuild({})
            setOppPlayer(null)
            setPage('splash')
          }}
        />
      </Suspense>
    )
  }

  if (page === 'pvp-leaderboard') {
    return (
      <Suspense fallback={null}>
        <VsPvPLeaderboard
          onBack={() => setPage('versus-game')}
          position={position}
        />
      </Suspense>
    )
  }

  if (page === 'salarycap') {
    return (
      <BucketSalaryCap
        onConfirm={handleSalaryCapConfirm}
        onBack={() => setPage('splash')}
        user={user}
        initialDateStr={salaryReturnDate}
        position={position}
      />
    )
  }

  const navbarProps = {
    onReset: () => guardedLeave(handleReset),
    onHome: () => guardedLeave(handleHome),
    onSignIn: () => setShowAuth(true),
    onProfile: () => guardedLeave(() => user ? (window.history.pushState({}, '', '/profile'), setPage('profile')) : setShowAuth(true)),
    onAbout: () => guardedLeave(() => { window.location.href = '/?about' }),
    onLeaderboard: () => guardedLeave(() => setPage('leaderboard')),
    onSubscribe: async () => {
      if (!user) { setShowAuth(true); return }
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/create-checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, email: user.email }),
        })
        const { url } = await res.json()
        if (url) window.location.href = url
      } catch {}
    },
    onSwitchBucketPosition: (pos) => guardedLeave(() => handleNavPositionSwitch(pos)),
    user,
    gameMode,
    isRB: false,
    isPlus: isSubscribed,
    isBucket: true,
    bucketPosition: position,
    versusState: page === 'versus-game' && versusRoom ? (() => {
      const myF  = activeTypes.filter(t => build[t]).length
      const oppF = activeTypes.filter(t => oppBuild[t]).length
      return {
        myFilled: myF, oppFilled: oppF, total: activeTypes.length,
        oppName: versusRoom.oppName,
        myPosition: position,
        oppPosition,
        bothReady: myF === activeTypes.length && oppF === activeTypes.length,
        onFaceOff: () => {
          versusRoom.channel?.send({ type: 'broadcast', event: 'bab_faceoff', payload: {} }).catch?.(() => {})
          setPage('versus-result')
        },
      }
    })() : null,
  }

  if (page === 'sim') {
    return (
      <>
        <Navbar {...navbarProps} />
        <BucketSimPage
          result={simResult}
          build={build}
          types={activeTypes}
          position={position}
          onBack={() => { setPage(gameMode === 'salarycap' ? 'salarycap' : 'game'); window.scrollTo({ top: 0, behavior: 'instant' }) }}
          onReset={handleReset}
          adsDisabled={adsDisabled}
          isSalaryMode={gameMode === 'salarycap'}
          gameMode={gameMode}
          initialScreen={simInitialScreen}
        />
      </>
    )
  }

  if (page === 'leaderboard') {
    return (
      <>
        <Navbar {...navbarProps} />
        <BucketLeaderboardPage
          onBack={() => { setPage(simResult ? 'sim' : 'game'); window.scrollTo({ top: 0, behavior: 'instant' }) }}
          currentUser={user}
          adsDisabled={adsDisabled}
        />
      </>
    )
  }

  if (page === 'privacy') {
    return (
      <>
        <Navbar {...navbarProps} />
        <PrivacyPage onBack={() => { setPage('game'); window.scrollTo({ top: 0, behavior: 'instant' }) }} />
      </>
    )
  }


  if (page === 'profile' && user) {
    return (
      <>
        <ProfilePage
          user={user}
          build={build}
          types={activeTypes}
          isPlus={isSubscribed}
          isBucket={true}
          onBack={() => { window.history.back() }}
          onSignOut={() => { setUser(null); window.location.href = '/bucket' }}
          onAdsDisabled={() => { setAdsDisabled(true); setIsSubscribed(true); enableAdFreeMode() }}
          onThemeChange={(themeId) => {
            try { localStorage.setItem('bap_theme', themeId) } catch {}
            if (themeId === 'default') document.documentElement.removeAttribute('data-theme')
            else document.documentElement.setAttribute('data-theme', themeId)
          }}
          isBucketCustomMode={isBucketCustomMode && isSubscribed}
          onBucketCustomModeChange={(val) => {
            const next = val && isSubscribed
            setIsBucketCustomMode(next)
            try { localStorage.setItem('bab_custom_mode', next ? '1' : '0') } catch {}
          }}
          onOpenBucketCustomModal={() => setShowBucketCustomModal(true)}
        />
        {showBucketCustomModal && (
          <CustomRatingsModal
            isBucket={true}
            bucketPosition={position}
            pool={currentPool}
            build={build}
            buildTypes={activeTypes}
            onClose={() => setShowBucketCustomModal(false)}
            onSave={(ratings) => {
              setBucketCustomRatings(ratings)
              try { localStorage.setItem('bab_bucket_custom_ratings', JSON.stringify(ratings)) } catch {}
            }}
            onAddToBuild={(p, playerOverrides, slot) => {
              const val = playerOverrides?.[slot] ?? p.attrs?.[slot] ?? 5
              setBuild(prev => ({ ...prev, [slot]: {
                type: slot, val,
                qb: p.short || p.name,
                qbFull: p.name,
                team: p.team,
                teamColor: p.color,
                teamColor2: p.color2,
                skinColor: p.skin,
                number: p.number,
                faceCenter: p.faceCenter,
                photo: NBA_HEADSHOTS[p.name] ? `/headshots/nba/${NBA_HEADSHOTS[p.name]}.webp` : genericHeadshot(p.skin),
                captain: p.captain ?? false,
                height: p.height ?? parseHtToIn(p.ht) ?? null,
                weight: p.weight ?? p.wt ?? null,
              }}))
              setShowBucketCustomModal(false)
            }}
            onAddAllToBuild={(p, playerOverrides) => {
              setBuild(prev => {
                const next = { ...prev }
                activeTypes.forEach(slot => {
                  if (!prev[slot]) {
                    const val = playerOverrides?.[slot] ?? p.attrs?.[slot] ?? 5
                    next[slot] = {
                      type: slot, val,
                      qb: p.short || p.name,
                      qbFull: p.name,
                      team: p.team,
                      teamColor: p.color,
                      teamColor2: p.color2,
                      skinColor: p.skin,
                      number: p.number,
                      faceCenter: p.faceCenter,
                      photo: NBA_HEADSHOTS[p.name] ? `/headshots/nba/${NBA_HEADSHOTS[p.name]}.webp` : genericHeadshot(p.skin),
                      captain: p.captain ?? false,
                      height: p.height ?? parseHtToIn(p.ht) ?? null,
                      weight: p.weight ?? p.wt ?? null,
                    }
                  }
                })
                return next
              })
              setShowBucketCustomModal(false)
            }}
          />
        )}
      </>
    )
  }

  const filledCount = activeTypes.filter(t => build[t]).length

  return (
    <>
      <Helmet>
        <title>Build-A-Bucket: Build a Bucket NBA Game — Player Creator & Simulator</title>
        <meta name="description" content="Build a bucket — spin the wheel to create your ultimate NBA player, simulate a full season, and compete on the all-time GOAT leaderboard. Play Build-A-Bucket free." />
        <meta name="keywords" content="build a bucket, build-a-bucket, buildabucket, NBA player creator, basketball simulator, NBA game" />
        <link rel="canonical" href="https://www.build-a-player.com/bucket" />
        <meta property="og:title" content="Build-A-Bucket: Build a Bucket NBA Game — Player Creator & Simulator" />
        <meta property="og:description" content="Build a bucket — spin the wheel to create your ultimate NBA player, simulate a full season, and compete on the all-time GOAT leaderboard. Play Build-A-Bucket free." />
        <meta property="og:url" content="https://www.build-a-player.com/bucket" />
      </Helmet>
      <Navbar {...navbarProps} />

      <main className={`game-layout mobile-${mobileView}${gameMode === 'all-time' ? ' alltime-mode' : ''}${page === 'versus-game' ? ' versus-active' : ''}`}>
        <SpinScreen
          build={build}
          activeDrag={activeDrag}
          onDragStart={setActiveDrag}
          onDragEnd={() => setActiveDrag(null)}
          activeCategory={activeCategory}
          resetKey={spinResetKey}
          onChipTap={handleChipTap}
          types={activeTypes}
          isLite={gameMode === 'lite'}
          qbPool={currentPool}
          savedResult={savedSpinResult}
          onSaveResult={setSavedSpinResult}
          onPhaseChange={setSpinPhase}
          gameKey={gameKey}
          onReset={handleReset}
          adsDisabled={adsDisabled}
          isRB={false}
          isBucket={true}
          isVersusMode={page === 'versus-game'}
          attrMap={BUCKET_ATTR}
          categoriesData={activeCategories}
          teamsPool={NBA_TEAMS}
          logoDir="/logos/nba/"
          playerLabel="PLAYER"
          headshotsMap={NBA_HEADSHOTS}
          headshotsDir="/headshots/nba/"
          headshotFallback={genericHeadshot}
        />
        <Silhouette
          build={build}
          activeDrag={activeDrag}
          onDrop={handleDrop}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          types={activeTypes}
          isLite={gameMode === 'lite'}
          onReset={handleReset}
          isRB={false}
          isBucket={true}
          isPlus={isSubscribed}
          isCustomMode={isBucketCustomMode}
          onOpenCustomModal={() => setShowBucketCustomModal(true)}
          onSandboxToggle={handleSandboxToggle}
          attrMap={BUCKET_ATTR}
          categoriesData={activeCategories}
          figureRef={figureRef}
        />

        <div className="right-panel-wrap">
          <ReportCard
            build={build}
            onSimulate={() => setShowTeamSpin(true)}
            onReset={handleReset}
            types={activeTypes}
            hasResult={false}
            isRB={false}
            isBucket={true}
            bucketPosition={position}
            isPlus={isSubscribed}
            isCustomMode={isBucketCustomMode}
            onOpenCustomModal={() => setShowBucketCustomModal(true)}
            onSandboxToggle={handleSandboxToggle}
            attrMap={BUCKET_ATTR}
            logoDir="/logos/nba/"
            captureFigure={captureFigure}
            isSalaryMode={gameMode === 'salarycap'}
            isVersusMode={page === 'versus-game'}
          />
        </div>
      </main>

      {leaveConfirm && (
        <div className="leave-confirm-overlay" onClick={() => setLeaveConfirm(null)}>
          <div className="leave-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="lcm-title">Leave game?</div>
            <div className="lcm-body">Leaving an active game counts as a loss on your record.</div>
            <div className="lcm-actions">
              <button className="lcm-stay" onClick={() => setLeaveConfirm(null)}>Stay in game</button>
              <button className="lcm-leave" onClick={() => { leaveConfirm.fn(); setLeaveConfirm(null) }}>Leave &amp; take the L</button>
            </div>
          </div>
        </div>
      )}

      {showVsPrompt && page === 'versus-game' && (
        <div className="vs-prompt-overlay">
          <div className="vs-prompt-modal">
            <div className="vs-prompt-eyebrow">HEAD TO HEAD</div>
            <div className="vs-prompt-matchup">
              <div className="vs-prompt-side">
                <div className="vs-prompt-pos">{position === 'big' ? 'BIG' : 'GUARD'}</div>
                <div className="vs-prompt-name">{user?.user_metadata?.username || user?.email?.split('@')[0] || 'You'}</div>
                <div className="vs-prompt-record">
                  {vsRecord.wins}W – {vsRecord.losses}L
                </div>
              </div>
              <div className="vs-prompt-vs">VS</div>
              <div className="vs-prompt-side">
                <div className="vs-prompt-pos">{oppPosition === 'big' ? 'BIG' : oppPosition === 'guard' ? 'GUARD' : '—'}</div>
                <div className="vs-prompt-name">{versusRoom?.oppName || 'Player'}</div>
                <div className="vs-prompt-record">
                  {oppRecord ? `${oppRecord.wins}W – ${oppRecord.losses}L` : '— W – — L'}
                </div>
              </div>
            </div>
            <div className="vs-prompt-pos-btns">
              {['guard', 'big'].map(pos => (
                <button
                  key={pos}
                  className={`vs-prompt-pos-btn${position === pos ? ' vs-prompt-pos-btn--active' : ''}`}
                  onClick={() => {
                    localStorage.setItem('bucketPosition', pos)
                    setPosition(pos)
                    const types = POS_TYPES[pos] ?? GUARD_TYPES
                    setBuild(Object.fromEntries(types.map(t => [t, null])))
                    setActiveCategory((POS_CATS[pos] ?? GUARD_CATEGORIES)[0].id)
                    versusRoom?.channel?.send({ type: 'broadcast', event: 'bab_position', payload: { position: pos } }).catch?.(() => {})
                    setShowVsPrompt(false)
                  }}
                >
                  {pos === 'guard' ? 'GUARD' : 'BIG'}
                  <span className="vs-ppb-sub">{pos === 'guard' ? 'PG · SG · SF' : 'PF · C'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {oppDisconnected && (
        <div className="opp-disconnect-overlay" onClick={() => setOppDisconnected(false)}>
          <div className="opp-disconnect-modal" onClick={e => e.stopPropagation()}>
            <div className="odm-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
              </svg>
            </div>
            <div className="odm-title">Opponent disconnected</div>
            <div className="odm-body">You've been given the win.</div>
            <button className="odm-ok" onClick={() => setOppDisconnected(false)}>OK</button>
          </div>
        </div>
      )}


      {showTeamSpin && (
        <TeamSpinModal
          isCustomMode={gameMode === 'custom'}
          onTeamSelected={handleTeamPicked}
          build={build}
        />
      )}

      {showSandboxWarning && (
        <div className="sandbox-warning-overlay" onClick={() => setShowSandboxWarning(false)}>
          <div className="sandbox-warning-modal" onClick={e => e.stopPropagation()}>
            <div className="sandbox-warning-title">⚠ Sandbox Mode</div>
            <div className="sandbox-warning-body">Sandbox mode builds will not be saved to your profile or leaderboard. Are you sure you want to continue?</div>
            <div className="sandbox-warning-btns">
              <button className="sandbox-warning-cancel" onClick={() => setShowSandboxWarning(false)}>Cancel</button>
              <button className="sandbox-warning-confirm" onClick={confirmSandbox}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {showBucketCustomModal && (
        <CustomRatingsModal
          isBucket={true}
          bucketPosition={position}
          pool={currentPool}
          build={build}
          buildTypes={activeTypes}
          onClose={() => setShowBucketCustomModal(false)}
          onSave={(ratings) => {
            setBucketCustomRatings(ratings)
            try { localStorage.setItem('bab_bucket_custom_ratings', JSON.stringify(ratings)) } catch {}
          }}
          onAddToBuild={(p, playerOverrides, slot) => {
            const val = playerOverrides?.[slot] ?? p.attrs?.[slot] ?? 5
            setBuild(prev => ({ ...prev, [slot]: {
              type: slot, val,
              qb: p.short || p.name,
              qbFull: p.name,
              team: p.team,
              teamColor: p.color,
              teamColor2: p.color2,
              skinColor: p.skin,
              number: p.number,
              faceCenter: p.faceCenter,
              photo: NBA_HEADSHOTS[p.name] ? `/headshots/nba/${NBA_HEADSHOTS[p.name]}.webp` : genericHeadshot(p.skin),
              captain: p.captain ?? false,
              height: p.height ?? parseHtToIn(p.ht) ?? null,
              weight: p.weight ?? p.wt ?? null,
            }}))
            setShowBucketCustomModal(false)
          }}
          onAddAllToBuild={(p, playerOverrides) => {
            setBuild(prev => {
              const next = { ...prev }
              activeTypes.forEach(slot => {
                if (!prev[slot]) {
                  const val = playerOverrides?.[slot] ?? p.attrs?.[slot] ?? 5
                  next[slot] = {
                    type: slot, val,
                    qb: p.short || p.name,
                    qbFull: p.name,
                    team: p.team,
                    teamColor: p.color,
                    teamColor2: p.color2,
                    skinColor: p.skin,
                    number: p.number,
                    faceCenter: p.faceCenter,
                    photo: NBA_HEADSHOTS[p.name] ? `/headshots/nba/${NBA_HEADSHOTS[p.name]}.webp` : genericHeadshot(p.skin),
                    captain: p.captain ?? false,
                    height: p.height ?? parseHtToIn(p.ht) ?? null,
                    weight: p.weight ?? p.wt ?? null,
                  }
                }
              })
              return next
            })
            setShowBucketCustomModal(false)
          }}
        />
      )}

      {gameMode !== 'salarycap' && <nav className="mobile-tab-bar">
        <button
          className={`mtab ${mobileView === 'spin' ? 'active' : ''}`}
          onClick={() => { setMobileView('spin'); window.scrollTo({ top: 0, behavior: 'instant' }) }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4l3 3"/>
          </svg>
          Spin
        </button>
        <div className="mtab-sep" />
        <button
          className={`mtab ${mobileView === 'build' ? 'active' : ''}`}
          onClick={() => { setMobileView('build'); window.scrollTo({ top: 0, behavior: 'instant' }) }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          Build
          {filledCount > 0 && (
            <span className="mtab-badge">{filledCount}/{activeTypes.length}</span>
          )}
        </button>
      </nav>}

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onAuth={setUser}
        />
      )}

    </>
  )
}
