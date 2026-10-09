import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo, lazy, Suspense } from 'react'
import { Helmet } from 'react-helmet-async'
import Navbar from './Navbar'
import SpinScreen from './SpinScreen'
import Silhouette from './Silhouette'
import ReportCard from './ReportCard'
import AuthModal from './AuthModal'
import BucketSimPage, { TeamSpinModal } from './BucketSimPage'
import { runBucketSimulation, getBucketGuardArchetype, getBucketBigArchetype, calcBucketOVR, TEAM_RATINGS } from '../utils/bucketSimulation'
import BucketLeaderboardPage from './BucketLeaderboardPage'
import BucketSalaryCap from './BucketSalaryCap'
import PrivacyPage from './PrivacyPage'
import {
  NBA_GUARD_PLAYERS,
  GUARD_TYPES, GUARD_CATEGORIES,
  VERSUS_GUARD_TYPES, VERSUS_GUARD_CATEGORIES,
} from '../data/nba-guards'
import {
  NBA_BIG_PLAYERS,
  BIG_TYPES, BIG_CATEGORIES,
  VERSUS_BIG_TYPES, VERSUS_BIG_CATEGORIES,
} from '../data/nba-bigs'
import { NBA_ALLTIME_GUARD_PLAYERS } from '../data/nba-guard-legends'
import { NBA_ALLTIME_BIG_PLAYERS } from '../data/nba-big-legends'
import { NBA_TEAMS } from '../data/nba-teams'
import { BUCKET_ATTR } from '../data/nba-attrs'
import NBA_HEADSHOTS     from '../data/nba-headshots.json'
import { supabase, rtSupabase } from '../lib/supabase'
import { track } from '../lib/track'
import { HEADSHOT_BASE } from '../utils/simulation'
import ProfilePage from './ProfilePage'
import CustomRatingsModal from './CustomRatingsModal'
import SiteFooter from './SiteFooter'
import SiteFeatures from './SiteFeatures'
import { IS_APP, APP_LOOK } from '../lib/platform'
import AppHome from './app/AppHome'
import { FlipEdge, BuildComplete, useFlip } from './app/AppBuildTray'
import { useCompete, botBuild } from '../lib/compete'
import { useBlacktop } from '../lib/blacktop'
import { BlacktopQueue, BlacktopHud, BlacktopChat, BlacktopGame } from './app/AppBlacktop'
import { loadRun, newRun, cityList, ratedPool } from '../lib/takeover'
const AppTakeover = lazy(() => import('./app/AppTakeover'))
import CompeteHud from './app/CompeteHud'
const AppCompete = lazy(() => import('./app/AppCompete'))
// which page a live Blacktop run is on, so Home → Play (or the card) resumes it
const btPageFor = phase => (phase === 'build' ? 'blacktop-build' : phase === 'game' || phase === 'result' ? 'blacktop-game' : 'blacktop')
import { finishDiscordSignIn, getUsername } from '../lib/discord'
import { rampPage, HOME_UNITS, RAIL_UNITS, RAIL_UNITS_WITH_LEFT } from '../lib/ads'
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

const RAMP_AD_UNITS = ['bottom_rail', 'corner_ad_video', 'left_rail', 'standard_iab', 'video_bottom_rail']
const RAMP_FORCE_OFF = RAMP_AD_UNITS.map(unit => ({ unit, force: 'off' }))

function enableAdFreeMode() {
  document.documentElement.classList.add('ads-hidden')
  // Tell Ramp not to load these units at all (must be set before Ramp initializes)
  window.ramp = window.ramp || {}
  window.ramp.forceUnits = RAMP_FORCE_OFF
  window.ramp.que = window.ramp.que || []
  window.ramp.que.push(() => {
    window.ramp.forceUnits = RAMP_FORCE_OFF
    try { window.ramp.destroyUnits('all') } catch {}
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
const START_ON_SALARY = window.location.pathname === '/bucket/salary'
// The app has no web ads (Ramp does not serve in-app), so it always runs ad-free here.
try { if (IS_APP || localStorage.getItem('bap_subscribed') === '1' || localStorage.getItem('bap_ads_off') === '1') enableAdFreeMode() } catch {}

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
    position:   p.position ?? '',
    skin:       p.skin ?? null,
    faceCenter: p.faceCenter ?? null,
  }
}

const ENRICHED_GUARDS         = NBA_GUARD_PLAYERS.map(enrichPlayer)
const ENRICHED_BIGS           = NBA_BIG_PLAYERS.map(enrichPlayer)
const ENRICHED_ALLTIME_GUARDS = NBA_ALLTIME_GUARD_PLAYERS.map(enrichPlayer)
const ENRICHED_ALLTIME_BIGS   = NBA_ALLTIME_BIG_PLAYERS.map(enrichPlayer)

const withPhoto = p => ({ ...p, photo: NBA_HEADSHOTS[p.name] ? `${HEADSHOT_BASE}/nba/${NBA_HEADSHOTS[p.name]}.webp` : genericHeadshot(p.skin) })
const LIVE_POOLS = { guard: ENRICHED_GUARDS.map(withPhoto), big: ENRICHED_BIGS.map(withPhoto) }
const LIVE_TYPES = { guard: VERSUS_GUARD_TYPES, big: VERSUS_BIG_TYPES }
const livePhoto = p => p?.photo ?? (NBA_HEADSHOTS[p?.name] ? `${HEADSHOT_BASE}/nba/${NBA_HEADSHOTS[p.name]}.webp` : null)

const _dedup = arr => { const s = new Set(); return arr.filter(p => { const k = `${p.name}|${p.team}`; if (s.has(k)) return false; s.add(k); return true }) }
const _byTeam = (a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name)
const CUSTOM_MODAL_GUARDS = _dedup([...ENRICHED_GUARDS, ...ENRICHED_ALLTIME_GUARDS]).sort(_byTeam)
const CUSTOM_MODAL_BIGS   = _dedup([...ENRICHED_BIGS,   ...ENRICHED_ALLTIME_BIGS]).sort(_byTeam)
// the modal's Current / All-Time toggle shows one pool at a time
const CUSTOM_POOLS = {
  guard: { current: _dedup(ENRICHED_GUARDS).sort(_byTeam), legends: _dedup(ENRICHED_ALLTIME_GUARDS).sort(_byTeam) },
  big:   { current: _dedup(ENRICHED_BIGS).sort(_byTeam),   legends: _dedup(ENRICHED_ALLTIME_BIGS).sort(_byTeam) },
}

// ─── Bucket Splash ────────────────────────────────────────────────────────────
const BUCKET_SPLASH_ATTRS = {
  guard: [
    { label: 'Handles',     col: '#a78bfa', angle:  -35, dist: 1.32, mx: 58, my: 14, tall: true },
    { label: 'Jump Shot',   col: '#34d399', angle:   15, dist: 1.28, mx: 62, my: 52, grow: 1.6 },
    { label: 'Finishing',   col: '#f87171', angle:   55, dist: 1.30, mx: 3,  my: 30 },
    { label: 'Speed',       col: '#fb923c', angle:  210, dist: 1.31, mx: 4,  my: 62 },
    { label: 'Bounce',      col: '#fcd34d', angle: -130, dist: 1.30, mx: 55, my: 72 },
    { label: 'Passing',     col: '#60a5fa', angle:  -70, dist: 1.29, mx: 5,  my: 18, doy: -30, dox: 140 },
    { label: 'Perimeter D', col: '#4ade80', angle:  100, dist: 1.32, mx: 60, my: 34, dox: -240, doy: -20 },
    { label: 'Strength',    col: '#fdba74', angle: -160, dist: 1.28, mx: 3,  my: 48, doy: 200 },
    { label: 'H/L',         col: '#e879f9', angle:   80, dist: 1.31, mx: 58, my: 44, dox: 170, doy: 10 },
  ],
  big: [
    { label: 'Finishing',    col: '#f87171', angle:  -35, dist: 1.32, mx: 58, my: 14, tall: true },
    { label: 'Jump Shot',    col: '#34d399', angle:   55, dist: 1.30, mx: 3,  my: 30, grow: 1.6 },
    { label: 'Playmaking',   col: '#38bdf8', angle:   15, dist: 1.28, mx: 62, my: 52 },
    { label: 'Interior D',   col: '#4ade80', angle:  210, dist: 1.31, mx: 4,  my: 62 },
    { label: 'Rebounding',   col: '#a3e635', angle: -130, dist: 1.30, mx: 55, my: 72 },
    { label: 'Speed',        col: '#fb923c', angle:  -70, dist: 1.29, mx: 5,  my: 18, doy: -30, dox: 140 },
    { label: 'Bounce',       col: '#fcd34d', angle:  100, dist: 1.32, mx: 60, my: 34, dox: -210 },
    { label: 'Basketball IQ',col: '#38bdf8', angle: -160, dist: 1.28, mx: 3,  my: 48, doy: 200 },
    { label: 'Leadership',   col: '#818cf8', angle:   80, dist: 1.31, mx: 58, my: 44, dox: 90 },
  ],
}

// Basketball play-diagram sketch scattered faintly across the background in
// place of the old attribute pills.
function PlayBackground({ visible }) {
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
    const t = setTimeout(() => setVisible(true), 360)
    return () => clearTimeout(t)
  }, [ready])
  return visible
}


// Silhouette body re-rendered as stacked, color-coded bands — one per build
// attribute, using each attribute's real in-game color — clipped to the
// silhouette's outline via a CSS mask.
function BucketStackedSilhouette({ attrs, ready }) {
  const visible = useRevealOnMount(ready)
  return (
    <div
      className="splash-stack-figure"
      style={{
        WebkitMaskImage: 'url(/basketballsilhouette.png)',
        maskImage: 'url(/basketballsilhouette.png)',
      }}
    >
      {attrs.map((a, i) => (
        <div
          key={a.label}
          className="splash-stack-band"
          style={{
            background: a.col,
            flex: a.grow ?? (a.tall ? 1.4 : 1),
            opacity: visible ? 1 : 0,
            // Starts stacked at the very top (i band-heights up) and falls
            // down to its own row — lower bands fall further.
            transform: visible ? 'translateY(0)' : `translateY(-${i * 100}%)`,
            // Fully sequential — each band only starts once the previous one
            // has completely finished falling (delay = full fall duration).
            transitionDelay: visible ? `${(attrs.length - 1 - i) * 170}ms` : '0ms',
          }}
        >
          <span className="splash-stack-band-label">{a.label}</span>
        </div>
      ))}
    </div>
  )
}

const POS_LABELS = { guard: 'Guard', big: 'Big' }

function BucketSplash({ onStart, onVersus }) {
  const [phase, setPhase]       = useState(0)
  const [position, setPosition] = useState(() => { try { const p = localStorage.getItem('bucketPosition'); return (p === 'guard' || p === 'big') ? p : 'guard' } catch { return 'guard' } })
  const isMobile = useMemo(() => window.innerWidth <= 768, [])

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 80)
    const t2 = setTimeout(() => setPhase(2), 420)
    const t3 = setTimeout(() => setPhase(3), 800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const splashAttrs = BUCKET_SPLASH_ATTRS[position]

  const handlePosChange = pos => setPosition(pos)

  return (
    <div className={`splash-screen bucket-splash ${phase >= 1 ? 'splash-in' : ''}`}>
    <PlayBackground visible={phase >= 3} />
    <div className="splash-hero">
      {/* The visible logo is styled art (its "U" is a hoop graphic), so give
          search engines and screen readers the page's real heading in text. */}
      <h1 className="sr-only">Build-A-Bucket: Build a Basketball Player</h1>

      <div className="splash-glow" style={{ opacity: phase >= 2 ? 1 : 0 }} />

      <div className="splash-header" style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'none' : 'translateY(-28px)' }}>
        <img src="/logo-v3.png" alt="Build-A-Bucket" className="splash-logo-mark" draggable={false} />
        <div className="splash-title splash-title--small">
          BUIL<span className="logo-d">D</span><em>-<span className="logo-a">A</span>-</em>B<HoopU />CKET
        </div>
        <div className="splash-pos-toggle" style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? 'none' : 'translateY(8px)' }}>
          {['guard', 'big'].map(pos => (
            <button
              key={pos}
              className={`splash-pos-btn${position === pos ? ' splash-pos-btn--active' : ''}`}
              onClick={() => handlePosChange(pos)}
            >
              {POS_LABELS[pos]}
              <span className="splash-pos-sub">{pos === 'guard' ? 'PG · SG · SF' : 'PF · C'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="splash-figure-wrap bucket-figure-wrap" style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? 'none' : 'translateY(40px) scale(0.92)' }}>
        <div className="splash-figure-parallax">
          <img src="/basketballsilhouette.png" className="splash-figure" alt="" draggable={false} style={{ position: 'absolute', inset: 0 }} />
          <BucketStackedSilhouette key={position} attrs={splashAttrs} ready={phase >= 3} />
          <div className="splash-figure-glow" />
        </div>
      </div>

      <div className="splash-footer" style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? 'none' : 'translateY(16px)' }}>

        <div className="splash-tagline"><span className="splash-tagline-dot" />1M+ Players. Build the Perfect Player.</div>

        <div className="splash-modes">
          <button className="splash-mode-classic" onClick={() => { try { localStorage.setItem('bucketPosition', position) } catch {}; onStart('classic', position) }}>
            <div className="smode-title">Current</div>
            <div className="smode-badge">Current NBA</div>
            <div className="smode-cta">
              START DRAFTING
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </button>

          <div className="splash-modes-secondary">
            <button className="splash-mode-alltime" onClick={() => { try { localStorage.setItem('bucketPosition', position) } catch {}; onStart('all-time', position) }}>
              <div className="smode-daily-banner" style={{ background: 'linear-gradient(135deg, #ca8a04, #eab308)' }}>NEW</div>
              <div className="smode-title">All-Time</div>
              <div className="smode-badge">NBA Legends</div>
            </button>

            <button className="splash-mode-salarycap" style={{ position: 'relative' }} onClick={() => { try { localStorage.setItem('bucketPosition', position) } catch {}; onStart('salarycap', position) }}>
              <div className="smode-daily-banner">DAILY</div>
              <div className="smode-title">Salary Cap</div>
              <div className="smode-badge">Build on a budget</div>
            </button>
          </div>
        </div>

        <button className="splash-minigame-btn splash-minigame-btn--h2h" style={{ position: 'relative' }} onClick={() => onVersus?.(position)}>
          <span className="splash-h2h-new">NEW</span>
          <div className="splash-h2h-logo">HEAD<span className="h2h-to">-TO-</span>HEAD</div>
          <div className="splash-mg-sub splash-mg-sub--h2h">1v1</div>
        </button>

        <button className="splash-minigame-btn splash-minigame-btn--player" onClick={() => { try { localStorage.removeItem('bap_progress') } catch {}; window.location.href = '/'; }}>
          <div className="splash-xlink-logo">
            BUIL<span className="splash-xlink-d">D</span><em className="splash-xlink-em splash-xlink-em--player">-<span className="splash-xlink-a">A</span>-</em>PLAYER
          </div>
          <div className="splash-mg-sub">FOOTBALL BUILDER</div>
        </button>
      </div>
    </div>

    <SiteFeatures sport="bucket" />

    <SiteFooter sport="bucket" />
    </div>
  )
}

// /bucket's search/preview tags. Rendered on the splash (the page crawlers
// actually land on) as well as the game screen — they used to live only on
// the game screen, so search engines indexed /bucket with the homepage's
// generic title and no canonical. scripts/prerender-bucket.mjs bakes the same
// title/description into the static bucket.html — keep the two in sync.
const BUCKET_TITLE = 'Build-A-Bucket: Build a Basketball Player (NBA) — Player Creator & Simulator'
const BUCKET_DESC  = 'Build a basketball player — spin the wheel to create your ultimate NBA player, simulate a full season, and compete on the all-time GOAT leaderboard. Free basketball player creator.'
const bucketHead = (
  <Helmet>
    <title>{BUCKET_TITLE}</title>
    <meta name="description" content={BUCKET_DESC} />
    <meta name="keywords" content="build a basketball player, create a basketball player, build a bucket, build-a-bucket, buildabucket, NBA player creator, NBA player builder, basketball player builder, basketball simulator, NBA game" />
    <link rel="canonical" href="https://build-a-player.com/bucket" />
    <meta property="og:title" content={BUCKET_TITLE} />
    <meta property="og:description" content={BUCKET_DESC} />
    <meta property="og:url" content="https://build-a-player.com/bucket" />
  </Helmet>
)

const POS_TYPES = { guard: GUARD_TYPES, big: BIG_TYPES }
const POS_CATS  = { guard: GUARD_CATEGORIES, big: BIG_CATEGORIES }
const VERSUS_POS_TYPES = { guard: VERSUS_GUARD_TYPES, big: VERSUS_BIG_TYPES }
const VERSUS_POS_CATS  = { guard: VERSUS_GUARD_CATEGORIES, big: VERSUS_BIG_CATEGORIES }

// ─── BucketApp ────────────────────────────────────────────────────────────────
export default function BucketApp() {
  const [page, setPage]               = useState('splash')
  const [gameMode, setGameMode]       = useState(null)
  const [position, setPosition]       = useState(() => { try { return localStorage.getItem('bucketPosition') || 'guard' } catch { return 'guard' } })
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
  const [adsDisabled, setAdsDisabled] = useState(IS_APP)
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
  // App live modes: BLACKTOP (3v3) and TAKEOVER (the road)
  const [btChatOpen, setBtChatOpen] = useState(false)
  const [btSeen, setBtSeen] = useState(0)
  const [takeoverRun, setTakeoverRun] = useState(null)
  const openTakeoverRef = useRef(null)
  const takeoverRunRef = useRef(null); takeoverRunRef.current = takeoverRun
  const btPhaseRef = useRef('idle')          // the live hook is declared further down; the dock handler reads it through this
  const lastPlayRef = useRef(null)           // the last mode page, so PLAY goes back to what you were doing
  const [vsCountdown,    setVsCountdown]    = useState(null)
  const vsResultRef      = useRef({ build: {}, user: null, position: 'guard' })
  const faceoffFiredRef  = useRef(false)
  const lastOppPingRef   = useRef(0)
  const oppLeaveTimerRef = useRef(null)
  const savedSpinRef     = useRef(null)
  const vsChannelReady   = useRef(false)
  useEffect(() => { vsResultRef.current = { build, user, position, matchType: versusRoom?.matchType ?? null } }, [build, user, position, versusRoom?.matchType])
  useEffect(() => { savedSpinRef.current = savedSpinResult }, [savedSpinResult])

  const activeDragRef = useRef(activeDrag)
  useLayoutEffect(() => { activeDragRef.current = activeDrag }, [activeDrag])

  // Once sandbox is ever turned on during a build session, taint it permanently
  // until reset — prevents toggle-on → edit → toggle-off → simulate exploit
  const sandboxTainted = useRef(isBucketCustomMode)
  useEffect(() => {
    if (isBucketCustomMode) sandboxTainted.current = true
  }, [isBucketCustomMode])

  // Blocks the rubber-band bounce only at the bottom of .game-page-scroll,
  // leaving the top bounce untouched — overscroll-behavior has no directional
  // (top vs bottom) variant, so this does it by hand: preventDefault only
  // fires once already scrolled to the very bottom and still dragging up.
  useEffect(() => {
    let startY = 0
    const onTouchStart = (e) => { startY = e.touches[0].clientY }
    const onTouchMove = (e) => {
      const el = e.target.closest?.('.game-page-scroll')
      if (!el) return
      const draggingUp = e.touches[0].clientY - startY < 0
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 1
      if (draggingUp && atBottom) e.preventDefault()
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

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
    // Only watch data-pw-status at the body+subtree level — 'style' was here
    // too, which meant every inline-style animation frame anywhere in the app
    // (spin reels, chip drag/drop) re-triggered a layout-forcing measure().
    // The ad element's own style changes are already covered by elObs below.
    const bodyObs = new MutationObserver(() => { attachElObs(); measure() })
    bodyObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-pw-status'] })
    return () => { bodyObs.disconnect(); if (elObs) elObs.disconnect() }
  }, [])

  useEffect(() => {
    const handlePop = () => {
      const path = window.location.pathname
      let changed = false
      if (path !== '/profile') {
        setPage(prev => prev === 'profile' ? 'game' : prev)
        changed = true
      }
      if (path !== '/bucket/simulate') {
        setPage(prev => prev === 'sim' ? 'game' : prev)
        changed = true
      }
      if (path !== '/bucket/leaderboard') {
        setPage(prev => prev === 'leaderboard' ? 'game' : prev)
        changed = true
      }
      if (path === '/bucket/salary') {
        // back from the leaderboard / profile / a sim opened from Salary Cap
        setPage(prev => prev === 'splash' ? prev : 'salarycap')
      } else {
        setPage(prev => prev === 'salarycap' ? 'splash' : prev)
      }
      if (changed) window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  // Dedicated URLs for the simulate/season/playoffs/final flow and the
  // leaderboard — lets Playwire apply ad rules by path. Kept under /bucket
  // so a refresh still resolves to BucketApp (main.jsx picks the app by
  // whether the path starts with /bucket). Purely a URL sync layer; doesn't
  // touch page state, the existing ramp queue calls, or any nav logic.
  useEffect(() => {
    const targetPath = page === 'sim' ? '/bucket/simulate' : page === 'leaderboard' ? '/bucket/leaderboard' : page === 'salarycap' ? '/bucket/salary' : null
    if (targetPath) {
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath)
      }
    } else if (window.location.pathname === '/bucket/simulate' || window.location.pathname === '/bucket/leaderboard' || window.location.pathname === '/bucket/salary') {
      window.history.replaceState({}, '', '/bucket')
    }
  }, [page])

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', page === 'splash' ? '#1b140c' : '#090a0d')
  }, [page])

  // iOS/Android app: report the page to the bottom tab bar (AppTabBar) and
  // follow its taps. No-ops on the website.
  useEffect(() => {
    if (!IS_APP && !APP_LOOK) return
    window.__bapPage = { page, sport: 'bucket' }
    window.dispatchEvent(new CustomEvent('bap:page', { detail: window.__bapPage }))
    if (['game', 'sim', 'salarycap', 'takeover', 'takeover-build', 'blacktop', 'blacktop-build', 'blacktop-game'].includes(page)) lastPlayRef.current = page
  }, [page])
  useEffect(() => {
    if (!IS_APP && !APP_LOOK) return
    const onNav = e => {
      const to = e.detail
      if (to === 'home') setPage('splash')   // keeps the build in progress — PLAY resumes it
      else if (to === 'play') {
        if (page === 'game' || page === 'sim' || page === 'salarycap' || page.startsWith('blacktop') || page === 'takeover' || page === 'takeover-build') return
        const live = btPhaseRef.current, last = lastPlayRef.current, run = takeoverRunRef.current
        if (live !== 'idle') setPage(btPageFor(live))                                   // a live run always comes first
        else if (last === 'takeover' && run && !run.over) setPage('takeover')
        else if (last === 'takeover-build' && gameMode) setPage('takeover-build')
        else if (gameMode) setPage(gameMode === 'salarycap' ? 'salarycap' : 'game')
        else { let p = 'guard'; try { p = localStorage.getItem('bucketPosition') || 'guard' } catch {}; handleStart('classic', p) }   // quick play
      } else if (to === 'leaderboard') setPage('leaderboard')
      else if (to === 'salarycap') handleStart('salarycap', position)
      else if (to === 'blacktop') setPage(btPageFor(btPhaseRef.current))
      else if (to === 'takeover') openTakeoverRef.current?.()
      // signed out: the dock shows sign-in itself, since only some pages render AuthModal
      else if (to === 'profile') { if (user) { window.history.pushState({}, '', '/profile'); setPage('profile') } else window.dispatchEvent(new CustomEvent('bap:auth')) }
      else if (to === 'about') { window.location.href = '/?about' }
      else if (to === 'wiki') { window.location.href = '/wiki' }
      else if (to === 'compete') setPage('compete')
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('bap:nav', onNav)
    return () => window.removeEventListener('bap:nav', onNav)
  }, [page, gameMode, user, position])

  // Ads on every page change (lib/ads.js): destroy all units, then add this
  // page's off-page units with the path set explicitly (the URL sync effect
  // runs after this). A layout effect, so it's queued before the new page's
  // own in-page units. Home runs the bottom rail only; the left rail only runs on
  // the sim page and Salary Cap. Ad-free players keep forceUnits 'off'.
  useLayoutEffect(() => {
    if (page === 'splash') { rampPage({ ads: HOME_UNITS, path: '/bucket' }); return }
    const here = window.location.pathname
    const path = page === 'sim' ? '/bucket/simulate'
      : page === 'salarycap' ? '/bucket/salary'
      : page === 'leaderboard' ? '/bucket/leaderboard'
      : ['/bucket/simulate', '/bucket/leaderboard', '/bucket/salary'].includes(here) ? '/bucket' : here
    rampPage({ ads: page === 'sim' || page === 'salarycap' ? RAIL_UNITS_WITH_LEFT : RAIL_UNITS, path })
  }, [page])

  // Fetch my W-L record when entering the lobby or game
  useEffect(() => {
    if ((page !== 'versus-game' && page !== 'versus-lobby') || !user || !supabase) return
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
      // Back from Discord sign-in: join the server, and pick up a Discord account's new username
      finishDiscordSignIn(session).then(u => { if (u) setUser(u) })
    })
    return () => subscription.unsubscribe()
  }, [])


  useEffect(() => {
    try {
      if (savedSpinResult) localStorage.setItem('bab_spin_result', JSON.stringify(savedSpinResult))
      else localStorage.removeItem('bab_spin_result')
    } catch {}
  }, [savedSpinResult])

  const liveBuild = page === 'blacktop-build'
  const isVersusMode = page === 'versus-lobby' || page === 'versus-game' || page === 'versus-result' || liveBuild
  const activeTypes = (isVersusMode ? VERSUS_POS_TYPES : POS_TYPES)[position] ?? (isVersusMode ? VERSUS_GUARD_TYPES : GUARD_TYPES)
  const activeCategories = (isVersusMode ? VERSUS_POS_CATS : POS_CATS)[position] ?? (isVersusMode ? VERSUS_GUARD_CATEGORIES : GUARD_CATEGORIES)

  // Tracks once per completed build (resets when the build becomes incomplete again)
  const buildCompleteTracked = useRef(false)
  useEffect(() => {
    if (isVersusMode) return
    const complete = activeTypes.length > 0 && activeTypes.every(t => build[t])
    if (complete && !buildCompleteTracked.current) {
      buildCompleteTracked.current = true
      track('build_complete', { app: 'bucket', position, gameMode })
    } else if (!complete) {
      buildCompleteTracked.current = false
    }
  }, [build, activeTypes, isVersusMode, position, gameMode])

  // App: Spin and Build are two sides of one card — swipe to flip, and the
  // last pick flips it to Build (drag-and-drop included)
  const flip = useFlip(IS_APP && (page === 'game' || page === 'versus-game' || page === 'blacktop-build' || page === 'takeover-build'), mobileView, setMobileView)
  const buildComplete = activeTypes.length > 0 && activeTypes.every(t => build[t])
  useEffect(() => { if (IS_APP && buildComplete && (page === 'game' || page === 'takeover-build')) flip('build') }, [buildComplete]) // eslint-disable-line react-hooks/exhaustive-deps
  // Website: the build-complete hit (the app's BuildComplete screen plays its own)
  useEffect(() => { if (!IS_APP && buildComplete && (page === 'game' || page === 'takeover-build')) window.__bapJuice?.sfx('complete', 2) }, [buildComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSandboxToggle = useCallback((on) => {
    try { localStorage.setItem('bab_custom_mode', on ? '1' : '0') } catch {}
    setIsBucketCustomMode(on)
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
    if (IS_APP || APP_LOOK) {   // a finished game is kept around (Home → resume), so clear it
      setSimResult(null); setSavedSpinResult(null); setMobileView('spin'); setSpinResetKey(k => k + 1); setGameKey(k => k + 1)
    }
    setGameMode(mode)
    setPosition(pos)
    const types = POS_TYPES[pos] ?? GUARD_TYPES
    setBuild(Object.fromEntries(types.map(t => [t, null])))
    setActiveCategory((POS_CATS[pos] ?? GUARD_CATEGORIES)[0].id)
    sandboxTainted.current = isBucketCustomMode
    setPage(mode === 'salarycap' ? 'salarycap' : 'game')
    window.scrollTo(0, 0)
  }, [isBucketCustomMode])

  // ── COMPETE: five-player pools on the same spins (lib/compete.js) ──────────
  const [competePos, setCompetePos] = useState(() => { let p = 'guard'; try { p = localStorage.getItem('bucketPosition') || 'guard' } catch {}; return p === 'big' ? 'big' : 'guard' })
  const cp = useCompete({
    enabled: IS_APP || APP_LOOK, user, sport: 'bucket', pos: competePos,
    botFor: (seed, idx, skill, pos) => {
      const types = POS_TYPES[pos] ?? GUARD_TYPES
      return botBuild({ seed, idx, skill, teams: NBA_TEAMS, pool: pos === 'big' ? ENRICHED_BIGS : ENRICHED_GUARDS, types, calcOvr: b => calcBucketOVR(b, types, pos) })
    },
  })
  const competeOn = cp.phase === 'build' && !cp.results[cp.me.vid]
  const competeKey = useRef(null)
  useEffect(() => {
    if (cp.phase !== 'build' || !cp.match || cp.results[cp.me.vid] || competeKey.current === cp.match.code) return
    competeKey.current = cp.match.code
    try { localStorage.setItem('bab_custom_mode', '0') } catch {}
    setIsBucketCustomMode(false)
    handleStart('classic', cp.match.pos)
    sandboxTainted.current = false
  }, [cp.phase, cp.match?.code]) // eslint-disable-line react-hooks/exhaustive-deps
  const lockInCompete = useCallback(() => {
    cp.submit(Math.round(calcBucketOVR(build, activeTypes, position) ?? 0), build)
    setGameMode(null); setBuild({}); setSavedSpinResult(null)
    setPage('compete')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [build, activeTypes, position, cp])
  const competePlan = useMemo(() => (competeOn && cp.match ? { seed: cp.match.seed, getStart: () => 0, onSpin: () => {}, separateRespins: true } : null), [competeOn, cp.match?.code]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── BLACKTOP (app): the match lives in the hook; pages follow its phase ──
  // App: the shop reads Pro from storage; tell it when that changes
  useEffect(() => { if (IS_APP || APP_LOOK) window.dispatchEvent(new CustomEvent('bap:pro')) }, [isSubscribed])

  const btPage = page === 'blacktop' || page === 'blacktop-build' || page === 'blacktop-game'
  // The hook stays on across every page: Home never drops you out of a run.
  const bt = useBlacktop({
    enabled: IS_APP || APP_LOOK, user, position, pools: LIVE_POOLS, types: LIVE_TYPES,
    build, player: savedSpinResult, onExit: () => { setPage('splash'); setBtChatOpen(false) },
    // the spot you took in the lobby decides what you build
    onSeatPos: pos => { setPosition(pos); try { localStorage.setItem('bucketPosition', pos) } catch {} },
  })
  btPhaseRef.current = bt.phase
  const btJoined = useRef(false)
  useEffect(() => {
    if (page === 'blacktop' && bt.phase === 'idle' && !btJoined.current) { btJoined.current = true; bt.join() }
    if (!btPage) btJoined.current = false
  }, [page, bt.phase]) // eslint-disable-line
  const resetLiveBuild = useCallback(() => {
    const types = VERSUS_POS_TYPES[position] ?? VERSUS_GUARD_TYPES
    setBuild(Object.fromEntries(types.map(t => [t, null])))
    setActiveCategory((VERSUS_POS_CATS[position] ?? VERSUS_GUARD_CATEGORIES)[0].id)
    setSavedSpinResult(null); setSimResult(null); setActiveDrag(null)
    setMobileView('spin'); setSpinResetKey(k => k + 1); setGameKey(k => k + 1)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [position])
  useEffect(() => {
    // the run moves on wherever you are — you queued for it
    if (bt.phase === 'build') { resetLiveBuild(); setPage('blacktop-build'); setBtChatOpen(false) }
    else if (bt.phase === 'game') { setPage('blacktop-game'); setBtChatOpen(false) }
  }, [bt.phase]) // eslint-disable-line
  useEffect(() => {
    const on = () => resetLiveBuild()
    window.addEventListener('bap:blacktop-rebuild', on)
    return () => window.removeEventListener('bap:blacktop-rebuild', on)
  }, [resetLiveBuild])
  const btUnread = Math.max(0, bt.chat.length - btSeen)
  const openBtChat = () => { setBtChatOpen(true); setBtSeen(bt.chat.length) }

  // ── TAKEOVER (app): a saved run per account, or a fresh build first ──
  useEffect(() => { if (IS_APP || APP_LOOK) setTakeoverRun(loadRun('bucket', user?.id)) }, [user?.id])
  const startTakeoverBuild = useCallback(() => { handleStart('classic', position); setPage('takeover-build') }, [handleStart, position])
  const openTakeover = useCallback(() => {
    const run = loadRun('bucket', user?.id)
    if (run && !run.over) { setTakeoverRun(run); setPage('takeover') } else startTakeoverBuild()
  }, [user?.id, startTakeoverBuild])
  openTakeoverRef.current = openTakeover
  const hitTheRoad = useCallback(() => {
    const cities = cityList('bucket', NBA_TEAMS)
    const rated = ratedPool(LIVE_POOLS[position] ?? LIVE_POOLS.guard, activeTypes, b => calcBucketOVR(b, activeTypes, position), cities)
    const run = newRun({ sport: 'bucket', uid: user?.id ?? null, pos: position, build, types: activeTypes, rated, cities })
    setTakeoverRun(run); setPage('takeover')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [user?.id, position, build, activeTypes])

  // Opened (or refreshed) straight on /bucket/salary → go to Salary Cap. Read
  // at load: the URL-sync effect resets the path to /bucket on the first render.
  useEffect(() => {
    if (START_ON_SALARY) handleStart('salarycap')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSalaryCapConfirm = useCallback((capBuild, skipToEnd = false, dateStr = null, saveData = null, capPosition = null) => {
    if (dateStr) setSalaryReturnDate(dateStr)
    // Salary cap covers 10 specific types; fill gaps so sim can fire
    const fullBuild = { ...capBuild }
    const fallback = capBuild['passing'] ?? capBuild['playmaking'] ?? Object.values(capBuild).find(Boolean)
    activeTypes.forEach(t => {
      if (!fullBuild[t] && fallback) fullBuild[t] = { ...fallback, type: t }
    })
    // basketballIQ/clutch/rebounding now arrive already filled on capBuild
    // (real averaged player stats, not a flat default or an unrelated proxy —
    // see buildFromSel in BucketSalaryCap.jsx), anchored on the Size pick for
    // the model figure's photo/jersey number.
    // When effective position is big, add big attr keys alongside the guard ones
    // so getBucketBigArchetype can read interiorDefense and playmaking.
    // Build always uses guard-key names, so this remap is needed for any big sim.
    if (capPosition === 'big') {
      if (fullBuild.perimeterDefense)
        fullBuild.interiorDefense = { ...fullBuild.perimeterDefense, type: 'interiorDefense' }
      if (!fullBuild.playmaking)
        fullBuild.playmaking = { ...(fullBuild.passing ?? fallback), type: 'playmaking' }
    }
    setBuild(fullBuild)
    // Auto-sim: skip the build screen and go straight to results
    // Team is seeded from the date so "View Results" always returns the same team
    const dateSeed = dateStr ? parseInt(dateStr.replace(/-/g, ''), 10) : Date.now()
    let h = dateSeed | 0; h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) | 0; h ^= h >>> 16
    const randomTeam = NBA_TEAMS[Math.floor(((h >>> 0) / 0x100000000) * NBA_TEAMS.length)]
    const result = runBucketSimulation(fullBuild, activeTypes, randomTeam, capPosition ?? position, dateSeed)
    setSimResult(result)
    // App: a fresh Salary Cap play earns season XP (kept on the device — it isn't a saved season)
    if ((IS_APP || APP_LOOK) && !skipToEnd) {
      window.dispatchEvent(new CustomEvent('bap:season', { detail: {
        sport: 'bucket', pos: capPosition ?? position, mode: 'salarycap', localOnly: true,
        wins: result.wins, losses: result.losses, playoffs: !!result.madePlayoffs,
        champion: !!result.champion, award: !!(result.mvp || result.dpoy), awardName: result.mvp ? 'MVP' : 'DPOY',
        ovr: result.ovr, ref: result,
      } }))
    }
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
    try { localStorage.setItem('bucketPosition', pos) } catch {}
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
    document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' })
  }, [activeTypes])

  const commitBucketRef = useRef(null)
  const handleTeamPicked = useCallback((team) => {
    const result = runBucketSimulation(build, activeTypes, team, position, null, gameMode)
    setSimResult(result)
    setShowTeamSpin(false)
    // The season is steered on the sim page; it's booked when it ends
    if (IS_APP || APP_LOOK) { setPage('sim'); window.scrollTo({ top: 0, behavior: 'instant' }); return }
    commitBucketRef.current?.(result)
  }, [build, activeTypes, position, gameMode])

  const commitBucketSeason = useCallback((result) => {
    setSimResult(result)
    // Season XP, coins + missions (lib/progress.js)
    if (IS_APP || APP_LOOK) {
      window.dispatchEvent(new CustomEvent('bap:season', { detail: {
        sport: 'bucket', pos: position, mode: gameMode,
        wins: result.wins, losses: result.losses, playoffs: !!result.madePlayoffs,
        champion: !!result.champion, award: !!(result.mvp || result.dpoy), awardName: result.mvp ? 'MVP' : 'DPOY',
        ovr: result.ovr, sandbox: isBucketCustomMode || sandboxTainted.current, ref: result,
      } }))
    }
    setShowTeamSpin(false)
    setPage('sim')
    track('simulate', { app: 'bucket', position, gameMode, userId: user?.id ?? null })
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
      username:    getUsername(user),
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
      team_short:  result.team?.short ?? null,     // the result carries the team: this runs when the season ends, not when it's picked
      build:       buildJson,
    }).then(({ error }) => { if (error) console.error('[bucket save]', error.code, error.message, error.details, error.hint) })
  }, [build, activeTypes, position, user, gameMode, isBucketCustomMode])
  commitBucketRef.current = commitBucketSeason
  const bucketSimFor = useCallback((b, t) => runBucketSimulation(b, activeTypes, t, position, null, gameMode), [activeTypes, position, gameMode])

  const handleDevFill = useCallback(() => {
    const pool = currentPool.filter(p => p.attrs)
    if (!pool.length) return
    const filled = Object.fromEntries(activeTypes.map(type => {
      const sorted = [...pool].sort((a, b) => (b.attrs[type] ?? 0) - (a.attrs[type] ?? 0))
      const topN = sorted.slice(0, 8)
      const p = topN[Math.floor(Math.random() * topN.length)]
      const photo = NBA_HEADSHOTS[p.name] ? `${HEADSHOT_BASE}/nba/${NBA_HEADSHOTS[p.name]}.webp` : genericHeadshot(p.skin)
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
      if (!IS_APP && activeTypes.every(t => next[t])) setMobileView('build')   // the app turns the card itself
      return next
    })
    setSpinResetKey(k => k + 1)
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' })
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
    try { localStorage.setItem('bucketPosition', pos) } catch {}
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

  const handleVersusJoin = useCallback(({ code, role, oppId, oppName, channel, matchType }) => {
    channel.on('broadcast', { event: 'bab_build' }, ({ payload }) => {
      setOppBuild(payload.build || {})
      setOppPlayer(payload.player || null)
      if (payload.position) setOppPosition(payload.position)
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

    // Heartbeat: track last ping from opponent for fallback disconnect detection
    lastOppPingRef.current = Date.now()
    channel.on('broadcast', { event: 'bab_ping' }, () => {
      lastOppPingRef.current = Date.now()
    })

    // Detect opponent disconnect via Supabase presence (not available on BroadcastChannel mock).
    // A leave doesn't immediately end the match — a brief WiFi drop/reconnect (common
    // when both players share one router) looks identical to a real departure at
    // first, so we wait a few seconds for a rejoin before giving up.
    if (!channel._bc) {
      channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const theyLeft = leftPresences.some(p => p.vid === oppId)
        if (!theyLeft) return
        clearTimeout(oppLeaveTimerRef.current)
        oppLeaveTimerRef.current = setTimeout(() => {
          const { build: b, user: u, position: pos, matchType: mt } = vsResultRef.current
          if (u && supabase) {
            setVsRecord(prev => ({ wins: (prev?.wins ?? 0) + 1, losses: prev?.losses ?? 0 }))
            const winOvr = calcBucketOVR(b, VERSUS_POS_TYPES[pos] ?? VERSUS_GUARD_TYPES, pos)
            if (winOvr > 0) supabase.from('vs_results').insert({
              user_id:    u.id,
              username:   getUsername(u),
              result:     'win',
              ovr:        winOvr,
              position:   pos,
              match_type: mt,
            }).then(null, () => {})
          }
          setOppDisconnected(true)
          setVersusRoom(null)
          cleanupVersusChannel(channel)
        }, 4000)
      })
      channel.on('presence', { event: 'join' }, ({ newPresences }) => {
        if (!newPresences.some(p => p.vid === oppId)) return
        clearTimeout(oppLeaveTimerRef.current)
      })
    }

    setVersusRoom({ code, role, oppId, oppName, channel, matchType })
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
    setIsBucketCustomMode(false)
    setShowVsPrompt(true)
    setPage('versus-game')
    window.scrollTo(0, 0)

    // Subscribe the game channel now that all .on() handlers are registered.
    // For BC-wrapped channels, subscribe() is a no-op (BC is always ready).
    // For already-subscribed friend-room channels, this is also safe (idempotent).
    vsChannelReady.current = false
    let chRetries = 0
    channel.subscribe(s => {
      if (s === 'SUBSCRIBED') {
        chRetries = 0
        vsChannelReady.current = true
        channel.send({ type: 'broadcast', event: 'bab_position', payload: { position } }).catch?.(() => {})
        // Send current build state now that WebSocket is established.
        // This is the authoritative initial send — the useEffect is gated behind vsChannelReady.
        const { build: curBuild, position: curPos } = vsResultRef.current
        channel.send({ type: 'broadcast', event: 'bab_build', payload: { build: curBuild, player: savedSpinRef.current, position: curPos } }).catch?.(() => {})
        // Track presence so the opponent's 'presence leave' handler fires on disconnect.
        // vid must match the format used in VersusLobby's myId so oppId check works.
        if (!channel._bc) {
          const vsId = sessionStorage.getItem('bap_vs_id')
          const uid  = user?.id
          const vid  = uid ? `${uid}-${vsId}` : vsId
          const name = getUsername(user) || 'Your Build'
          if (vid) channel.track({ vid, name }).catch?.(() => {})
        }
      } else if ((s === 'TIMED_OUT' || s === 'CHANNEL_ERROR') && !channel._bc && chRetries < 5) {
        // WebSocket dropped — retry resubscription with backoff.
        vsChannelReady.current = false
        chRetries++
        setTimeout(() => { try { channel.subscribe() } catch {} }, 1500 * chRetries)
      }
    })
  }, [activeTypes, position])

  useEffect(() => {
    if (!versusRoom?.channel || page !== 'versus-game' || !vsChannelReady.current) return
    versusRoom.channel.send({
      type: 'broadcast', event: 'bab_build',
      payload: { build, player: savedSpinResult, position },
    }).catch?.(() => {})
  }, [build, savedSpinResult, versusRoom, page])

  // Auto-start: both sides independently detect when both builds are done.
  // Host also broadcasts bab_faceoff as a backup for the guest.
  useEffect(() => {
    if (page !== 'versus-game' || !versusRoom) {
      if (!versusRoom || page !== 'versus-game') faceoffFiredRef.current = false
      return
    }
    const oppTypes = VERSUS_POS_TYPES[oppPosition] ?? VERSUS_GUARD_TYPES
    const myF  = activeTypes.filter(t => build[t]).length
    const oppF = oppTypes.filter(t => oppBuild[t]).length
    if (myF === activeTypes.length && oppF === oppTypes.length && !faceoffFiredRef.current) {
      faceoffFiredRef.current = true
      if (versusRoom.role === 'host') {
        versusRoom.channel?.send({ type: 'broadcast', event: 'bab_faceoff', payload: {} }).catch?.(() => {})
      }
      setTimeout(() => setPage('versus-result'), 300)
    }
  }, [build, oppBuild, page, versusRoom, activeTypes, oppPosition])

  // Heartbeat: send pings every 8s while in-game so opponent can detect disconnect
  useEffect(() => {
    if (page !== 'versus-game' || !versusRoom?.channel) return
    const id = setInterval(() => {
      versusRoom.channel.send({ type: 'broadcast', event: 'bab_ping', payload: {} }).catch?.(() => {})
    }, 8000)
    return () => clearInterval(id)
  }, [page, versusRoom])

  // Heartbeat: if no ping received in 45s, opponent is gone — award win.
  // Skips while tab is hidden (Chrome throttles background timers, causing false positives).
  // Resets the ping clock when tab becomes visible so returning players get a fresh window.
  useEffect(() => {
    if (page !== 'versus-game' || !versusRoom?.channel) return
    lastOppPingRef.current = Date.now()
    const onVisible = () => { if (!document.hidden) lastOppPingRef.current = Date.now() }
    document.addEventListener('visibilitychange', onVisible)
    const id = setInterval(() => {
      if (document.hidden) return
      if (Date.now() - lastOppPingRef.current > 30000) {
        lastOppPingRef.current = Date.now() // prevent double-fire
        const { build: b, user: u, position: pos, matchType: mt } = vsResultRef.current
        if (u && supabase) {
          setVsRecord(prev => ({ wins: (prev?.wins ?? 0) + 1, losses: prev?.losses ?? 0 }))
          const winOvr = calcBucketOVR(b, VERSUS_POS_TYPES[pos] ?? VERSUS_GUARD_TYPES, pos)
          if (winOvr > 0) supabase.from('vs_results').insert({
            user_id:    u.id,
            username:   getUsername(u),
            result:     'win',
            ovr:        winOvr,
            position:   pos,
            match_type: mt,
          }).then(null, () => {})
        }
        setOppDisconnected(true)
        cleanupVersusChannel(versusRoom.channel)
        setVersusRoom(null)
      }
    }, 5000)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [page, versusRoom]) // eslint-disable-line

  // 3-minute build timer: start on entering versus-game, resolve at 0
  useEffect(() => {
    if (page !== 'versus-game' || !versusRoom) {
      setVsCountdown(null)
      return
    }
    setVsCountdown(180)
    const id = setInterval(() => {
      setVsCountdown(prev => {
        if (prev === null || prev <= 1) { clearInterval(id); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [page, versusRoom]) // eslint-disable-line

  // When countdown hits 0, resolve outcome
  useEffect(() => {
    if (vsCountdown !== 0 || page !== 'versus-game' || !versusRoom) return
    setVsCountdown(null)
    const oppTypes = VERSUS_POS_TYPES[oppPosition] ?? VERSUS_GUARD_TYPES
    const myDone  = activeTypes.every(t => build[t])
    const oppDone = oppTypes.every(t => oppBuild[t])

    if (myDone && !oppDone) {
      // I win — record it, show disconnect overlay (reuses existing win UX)
      const { build: b, user: u, position: pos } = vsResultRef.current
      if (u && supabase) {
        setVsRecord(prev => ({ wins: (prev?.wins ?? 0) + 1, losses: prev?.losses ?? 0}))
        const winOvr = calcBucketOVR(b, VERSUS_POS_TYPES[pos] ?? VERSUS_GUARD_TYPES, pos)
        if (winOvr > 0) supabase.from('vs_results').insert({
          user_id:  u.id,
          username: getUsername(u),
          result:   'win',
          ovr:      winOvr,
          position: pos,
        }).then(null, () => {})
      }
      setOppDisconnected(true)
      cleanupVersusChannel(versusRoom?.channel)
      setVersusRoom(null)
    } else {
      // Opp won, or neither finished — just return both to menu
      cleanupVersusChannel(versusRoom?.channel)
      setVersusRoom(null)
      setVersusGame(null)
      setOppBuild({})
      setOppPlayer(null)
      setPage('splash')
    }
  }, [vsCountdown, page, versusRoom, oppPosition, activeTypes, build, oppBuild]) // eslint-disable-line

  function cleanupVersusChannel(ch) {
    vsChannelReady.current = false
    clearTimeout(oppLeaveTimerRef.current)
    if (!ch) return
    if (ch._bc) { ch.close() }
    else { try { (rtSupabase || supabase).removeChannel(ch) } catch {} }
  }

  function vsResultPayload(result) {
    return {
      user_id:    user.id,
      username:   getUsername(user),
      result,
      ovr:        calcBucketOVR(build, activeTypes, position),
      position,
      match_type: versusRoom?.matchType ?? null,
    }
  }

  async function recordVsForfeiture() {
    if (!supabase || !user) return
    setVsRecord(prev => ({ wins: prev?.wins ?? 0, losses: (prev?.losses ?? 0) + 1 }))
    try { await supabase.from('vs_results').insert(vsResultPayload('forfeit')) } catch {}
  }

  async function recordVsResult(result) {
    if (!supabase || !user) return
    setVsRecord(prev => result === 'win'
      ? { wins: (prev?.wins ?? 0) + 1, losses: prev?.losses ?? 0 }
      : { wins: prev?.wins ?? 0, losses: (prev?.losses ?? 0) + 1 }
    )
    const payload = vsResultPayload(result)
    if (payload.ovr > 0 || result !== 'win') try { await supabase.from('vs_results').insert(payload) } catch {}
  }

  // App: the game screen stays mounted while another tab is open (parked,
  // display:none) so a spin in flight keeps spinning, keeps its sound and
  // nothing resets (same shell on both sides of the switch, see App.jsx).
  const KEEP_GAME_ON = new Set(['splash', 'profile', 'leaderboard', 'pvp-leaderboard', 'privacy', 'compete'])
  const gameIsPlay = page === 'game' || (KEEP_GAME_ON.has(page) && lastPlayRef.current === 'game')
  const filledCount = activeTypes.filter(t => build[t]).length

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
      const oppTypes = VERSUS_POS_TYPES[oppPosition] ?? VERSUS_GUARD_TYPES
      const myF  = activeTypes.filter(t => build[t]).length
      const oppF = oppTypes.filter(t => oppBuild[t]).length
      return {
        myFilled: myF, oppFilled: oppF, myTotal: activeTypes.length, oppTotal: oppTypes.length,
        oppName: versusRoom.oppName,
        myPosition: position,
        oppPosition,
        bothReady: myF === activeTypes.length && oppF === oppTypes.length,
        countdownSec: vsCountdown,
        onFaceOff: () => {
          versusRoom.channel?.send({ type: 'broadcast', event: 'bab_faceoff', payload: {} }).catch?.(() => {})
          setPage('versus-result')
        },
      }
    })() : null,
  }
  const renderGame = parked => (
    <>
      {!parked && bucketHead}
      {!parked && <Navbar {...navbarProps} />}

      <div className="game-page-scroll">
      {competeOn && <CompeteHud cp={cp} />}
      {liveBuild && bt.match && <BlacktopHud bt={bt} onOpenChat={openBtChat} unread={btUnread} />}
      {IS_APP && (
        <FlipEdge side={mobileView} build={build} types={activeTypes} attrMap={BUCKET_ATTR} onFlip={flip}
          waiting={savedSpinResult?.selectedQB?.name ?? null} complete={buildComplete} />
      )}
      <main className={`game-layout mobile-${mobileView}${gameMode === 'all-time' ? ' alltime-mode' : ''}${page === 'versus-game' || liveBuild ? ' versus-active' : ''}`}>
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
          cardMeta={(IS_APP || APP_LOOK) && gameIsPlay && gameMode !== 'salarycap' ? { sport: 'bucket', pos: position, mode: gameMode } : null}
          seedPlan={competePlan}
          key={competePlan ? `cp-${cp.match.code}` : 'spin'}
          paused={parked}
          isRB={false}
          isBucket={true}
          isVersusMode={page === 'versus-game' || liveBuild}
          attrMap={BUCKET_ATTR}
          categoriesData={activeCategories}
          teamsPool={NBA_TEAMS}
          logoDir="/logos/nba/"
          playerLabel="PLAYER"
          headshotsMap={NBA_HEADSHOTS}
          headshotsDir={`${HEADSHOT_BASE}/nba/`}
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
          onSandboxToggle={!isVersusMode && !competeOn && page === 'game' && (gameMode === 'classic' || gameMode === 'all-time') ? handleSandboxToggle : undefined}
          attrMap={BUCKET_ATTR}
          categoriesData={activeCategories}
          figureRef={figureRef}
        />

        <div className="right-panel-wrap">
          <ReportCard
            build={build}
            onSimulate={page === 'takeover-build' ? hitTheRoad : competeOn ? lockInCompete : () => setShowTeamSpin(true)}
            simLabel={page === 'takeover-build' ? 'HIT THE ROAD' : competeOn ? 'LOCK IN' : undefined}
            onReset={handleReset}
            types={activeTypes}
            hasResult={false}
            isRB={false}
            isBucket={true}
            bucketPosition={position}
            isPlus={isSubscribed}
            isCustomMode={isBucketCustomMode}
            onOpenCustomModal={() => setShowBucketCustomModal(true)}
            onSandboxToggle={!isVersusMode && !competeOn && page === 'game' && (gameMode === 'classic' || gameMode === 'all-time') ? handleSandboxToggle : undefined}
            attrMap={BUCKET_ATTR}
            logoDir="/logos/nba/"
            captureFigure={captureFigure}
            isSalaryMode={gameMode === 'salarycap'}
            isVersusMode={page === 'versus-game' || liveBuild}
            oppPosition={oppPosition}
            oppFilledCount={(POS_TYPES[oppPosition] ?? GUARD_TYPES).filter(t => oppBuild[t]).length}
            oppTotal={(POS_TYPES[oppPosition] ?? GUARD_TYPES).length}
          />
        </div>
      </main>
      <div className="build-footer-section">
        <SiteFeatures sport="bucket" className="build-site-features" />
        <SiteFooter sport="bucket" />
      </div>
      </div>

      {!parked && IS_APP && (page === 'game' || page === 'takeover-build') && <BuildComplete complete={buildComplete} ovr={buildComplete ? calcBucketOVR(build, activeTypes, position) : 0} build={build} types={activeTypes} attrMap={BUCKET_ATTR} />}
      {liveBuild && btChatOpen && <BlacktopChat bt={bt} user={user} onClose={() => setBtChatOpen(false)} />}

      {!parked && leaveConfirm && (
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
                <div className="vs-prompt-name">{getUsername(user) || 'You'}</div>
                <div className="vs-prompt-record">
                  {vsRecord.wins}W – {vsRecord.losses}L
                </div>
              </div>
              <div className="vs-prompt-vs">VS</div>
              <div className="vs-prompt-side">
                <div className="vs-prompt-name">{versusRoom?.oppName || 'Opponent'}</div>
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
                    try { localStorage.setItem('bucketPosition', pos) } catch {}
                    setPosition(pos)
                    const types = VERSUS_POS_TYPES[pos] ?? VERSUS_GUARD_TYPES
                    setBuild(Object.fromEntries(types.map(t => [t, null])))
                    setActiveCategory((VERSUS_POS_CATS[pos] ?? VERSUS_GUARD_CATEGORIES)[0].id)
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
            <div className="odm-title">Your opponent has left</div>
            <div className="odm-body">You've been given the win.</div>
            <button className="odm-ok" onClick={() => { setOppDisconnected(false); handleHome(); }}>OK</button>
          </div>
        </div>
      )}


      {!parked && showTeamSpin && (
        <TeamSpinModal
          isCustomMode={isBucketCustomMode}
          onTeamSelected={handleTeamPicked}
          build={build}
        />
      )}

      {!parked && showBucketCustomModal && (
        <CustomRatingsModal
          isBucket={true}
          bucketPosition={position}
          gameMode={gameMode}
          pool={position === 'guard' ? CUSTOM_MODAL_GUARDS : CUSTOM_MODAL_BIGS}
          poolCurrent={CUSTOM_POOLS[position === 'big' ? 'big' : 'guard'].current}
          poolLegends={CUSTOM_POOLS[position === 'big' ? 'big' : 'guard'].legends}
          build={build}
          buildTypes={activeTypes}
          onClose={() => setShowBucketCustomModal(false)}
          onSave={(ratings) => {
            setBucketCustomRatings(ratings)
            try { localStorage.setItem('bab_bucket_custom_ratings', JSON.stringify(ratings)) } catch {}
          }}
          onAddToBuild={(p, playerOverrides, slot) => {
            sandboxTainted.current = true
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
              photo: NBA_HEADSHOTS[p.name] ? `${HEADSHOT_BASE}/nba/${NBA_HEADSHOTS[p.name]}.webp` : genericHeadshot(p.skin),
              captain: p.captain ?? false,
              height: p.height ?? parseHtToIn(p.ht) ?? null,
              weight: p.weight ?? p.wt ?? null,
            }}))
            setShowBucketCustomModal(false)
          }}
          onAddAllToBuild={(p, playerOverrides) => {
            sandboxTainted.current = true
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
                    photo: NBA_HEADSHOTS[p.name] ? `${HEADSHOT_BASE}/nba/${NBA_HEADSHOTS[p.name]}.webp` : genericHeadshot(p.skin),
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
          onClick={() => { setMobileView('spin'); window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' }) }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Spin
        </button>
        <div className="mtab-sep" />
        <button
          className={`mtab ${mobileView === 'build' ? 'active' : ''}`}
          onClick={() => { setMobileView('build'); window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' }) }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          Build
          {filledCount > 0 && (
            <span className="mtab-badge">{filledCount}/{activeTypes.length}</span>
          )}
        </button>
      </nav>}

      {!parked && showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onAuth={setUser}
        />
      )}

    </>
  )
  const shell = overlay => (
    <>
      <div className={`ag-game-host${overlay ? ' is-parked' : ''}`}>{renderGame(!!overlay)}</div>
      {overlay}
    </>
  )
  const withGame = el => (IS_APP && gameMode && gameMode !== 'salarycap' && KEEP_GAME_ON.has(page) ? shell(el) : el)

  if (page === 'splash') {
    return withGame(
      <>
        {bucketHead}
        {(() => {
          const onVersus = (pos) => {
            const p = pos || 'guard'
            try { localStorage.setItem('bucketPosition', p) } catch {}
            setPosition(p)
            setGameMode('classic')
            setBuild(Object.fromEntries((VERSUS_POS_TYPES[p] ?? VERSUS_GUARD_TYPES).map(t => [t, null])))
            setPage('versus-lobby')
          }
          return (IS_APP || APP_LOOK) ? (
            <AppHome
              sport="bucket"
              user={user}
              onStart={handleStart}
              onVersus={onVersus}
              onBlacktop={() => setPage(btPageFor(bt.phase))}
              blacktop={{ phase: bt.phase, queue: bt.seated }}
              onTakeover={openTakeover}
              takeoverRun={takeoverRun}
              onCompete={() => setPage('compete')}
              resume={competeOn ? { label: `Compete · pool ${cp.match.code}`, onClick: () => setPage('game') } : (gameMode && gameMode !== 'salarycap' && (simResult || Object.values(build).some(Boolean))) ? { label: `${position === 'big' ? 'BIG' : 'GUARD'} · ${gameMode === 'all-time' ? 'All-Time' : 'Current'}`, onClick: () => window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'play' })) } : null}
              footer={IS_APP ? null : <><SiteFeatures sport="bucket" /><SiteFooter sport="bucket" /></>}
              renderBucketFigure={(pos, ready) => (
                <>
                  <img src="/basketballsilhouette.png" className="splash-figure" alt="" draggable={false} style={{ position: 'absolute', inset: 0 }} />
                  <BucketStackedSilhouette attrs={BUCKET_SPLASH_ATTRS[pos]} ready={ready} />
                </>
              )}
            />
          ) : (
            <BucketSplash onStart={handleStart} onVersus={onVersus} />
          )
        })()}
      </>
    )
  }


  if (page === 'compete') {
    return withGame(
      <Suspense fallback={null}>
        <AppCompete cp={cp} sport="bucket" position={competePos} positions={[{ pos: 'guard', label: 'GUARD' }, { pos: 'big', label: 'BIG' }]}
          onPosition={setCompetePos} onHome={() => setPage('splash')} onResumeBuild={() => setPage('game')}
          onPlayAgain={() => cp.join()} />
      </Suspense>
    )
  }

  if (page === 'blacktop') {
    return <BlacktopQueue bt={bt} user={user} onBack={() => setPage('splash')} />
  }
  if (page === 'blacktop-game') {
    return (
      <>
        <BlacktopGame bt={bt} user={user} photoFor={p => livePhoto(p.build?.basketballIQ ? { name: p.build.basketballIQ.qbFull, photo: p.build.basketballIQ.photo } : null)} onOpenChat={openBtChat} unread={btUnread} />
        {btChatOpen && <BlacktopChat bt={bt} user={user} onClose={() => setBtChatOpen(false)} />}
      </>
    )
  }
  if (page === 'takeover' && takeoverRun) {
    return (
      <Suspense fallback={null}>
        <AppTakeover sport="bucket" run={takeoverRun} setRun={setTakeoverRun} user={user}
          pools={LIVE_POOLS} types={LIVE_TYPES} attrMap={BUCKET_ATTR} photoFor={livePhoto}
          calcOvr={b => calcBucketOVR(b, takeoverRun.types, takeoverRun.pos)} teams={NBA_TEAMS} ratings={TEAM_RATINGS}
          onNewBuild={startTakeoverBuild} onExit={() => setPage('splash')} />
      </Suspense>
    )
  }

  if (page === 'versus-lobby') {
    return (
      <>
        <Suspense fallback={null}>
          <VersusLobby
            on3v3={(IS_APP || APP_LOOK) ? () => setPage('blacktop') : null}
            onJoin={handleVersusJoin}
            position={position}
            gameMode="classic"
            onBack={() => setPage('splash')}
            onLeaderboard={() => setPage('pvp-leaderboard')}
            onSignIn={() => setShowAuth(true)}
            onProfile={() => user ? (window.history.pushState({}, '', '/profile'), setPage('profile')) : setShowAuth(true)}
            onAbout={() => { window.location.href = '/?about' }}
            onSwitchBucketPosition={(pos) => guardedLeave(() => handleNavPositionSwitch(pos))}
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
          myData={{ build, player: savedSpinResult, name: getUsername(user) || 'Your Build' }}
          oppData={{ build: oppBuild, player: oppPlayer, name: versusRoom?.oppName || 'Opponent' }}
          position={position}
          oppPosition={oppPosition}
          role={versusRoom?.role}
          channel={versusRoom?.channel}
          versusGame={versusGame}
          user={user}
          adsDisabled={adsDisabled}
          onResult={recordVsResult}
          onRematch={() => {
            faceoffFiredRef.current = false
            lastOppPingRef.current  = Date.now()
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
          oppDisconnected={oppDisconnected}
          onExit={() => {
            setOppDisconnected(false)
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
    return withGame(
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


  if (page === 'sim') {
    return (
      <>
        <Navbar {...navbarProps} />
        <BucketSimPage
          result={simResult}
          build={build}
          types={activeTypes}
          position={position}
          onBack={() => { setPage(gameMode === 'salarycap' ? 'salarycap' : 'game'); window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' }) }}
          onReset={handleReset}
          adsDisabled={adsDisabled}
          isSalaryMode={gameMode === 'salarycap'}
          gameMode={gameMode}
          initialScreen={simInitialScreen}
          simFn={(IS_APP || APP_LOOK) && gameMode !== 'salarycap' ? bucketSimFor : null}
          onFinal={(IS_APP || APP_LOOK) && gameMode !== 'salarycap' ? commitBucketSeason : null}
          pool={currentPool}
          userName={getUsername(user) || 'You'}
        />
      </>
    )
  }

  if (page === 'leaderboard') {
    return withGame(
      <>
        <Navbar {...navbarProps} />
        <BucketLeaderboardPage
          onBack={() => { setPage(simResult ? 'sim' : 'game'); window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' }) }}
          currentUser={user}
          adsDisabled={adsDisabled}
        />
      </>
    )
  }

  if (page === 'privacy') {
    return withGame(
      <>
        <Navbar {...navbarProps} />
        <PrivacyPage onBack={() => { setPage('game'); window.scrollTo({ top: 0, behavior: 'instant' }) }} />
      </>
    )
  }


  if (page === 'profile' && user) {
    return withGame(
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
            gameMode={gameMode}
            pool={position === 'guard' ? CUSTOM_MODAL_GUARDS : CUSTOM_MODAL_BIGS}
            poolCurrent={CUSTOM_POOLS[position === 'big' ? 'big' : 'guard'].current}
            poolLegends={CUSTOM_POOLS[position === 'big' ? 'big' : 'guard'].legends}
            build={build}
            buildTypes={activeTypes}
            onClose={() => setShowBucketCustomModal(false)}
            onSave={(ratings) => {
              setBucketCustomRatings(ratings)
              try { localStorage.setItem('bab_bucket_custom_ratings', JSON.stringify(ratings)) } catch {}
            }}
            onAddToBuild={(p, playerOverrides, slot) => {
              sandboxTainted.current = true
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
                photo: NBA_HEADSHOTS[p.name] ? `${HEADSHOT_BASE}/nba/${NBA_HEADSHOTS[p.name]}.webp` : genericHeadshot(p.skin),
                captain: p.captain ?? false,
                height: p.height ?? parseHtToIn(p.ht) ?? null,
                weight: p.weight ?? p.wt ?? null,
              }}))
              setShowBucketCustomModal(false)
            }}
            onAddAllToBuild={(p, playerOverrides) => {
              sandboxTainted.current = true
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
                      photo: NBA_HEADSHOTS[p.name] ? `${HEADSHOT_BASE}/nba/${NBA_HEADSHOTS[p.name]}.webp` : genericHeadshot(p.skin),
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

  return IS_APP ? shell(null) : renderGame(false)
}
