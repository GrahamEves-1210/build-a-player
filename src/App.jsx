import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo, lazy, Suspense } from 'react' // v2
import { Helmet } from 'react-helmet-async'
import Navbar from './components/Navbar'
import SpinScreen from './components/SpinScreen'
import Silhouette from './components/Silhouette'
import ReportCard from './components/ReportCard'
import TeamPickerModal from './components/TeamPickerModal'
import AuthModal from './components/AuthModal'
import SplashScreen, { POS_OPTIONS } from './components/SplashScreen'
import { decodeBuild } from './utils/shareUrl'

// Lazy-loaded pages — only downloaded when the user actually navigates there
const SimPage        = lazy(() => import('./components/SimPage'))
const QBSalaryCap    = lazy(() => import('./components/QBSalaryCap'))
const AboutPage      = lazy(() => import('./components/AboutPage'))
const PrivacyPage    = lazy(() => import('./components/PrivacyPage'))
const TermsPage      = lazy(() => import('./components/TermsPage'))
const SharedBuildPage= lazy(() => import('./components/SharedBuildPage'))
const DepthChart     = lazy(() => import('./components/DepthChart'))
const ProfilePage    = lazy(() => import('./components/ProfilePage'))
const LeaderboardPage= lazy(() => import('./components/LeaderboardPage'))
const VersusLobby    = lazy(() => import('./components/VersusLobby'))
const VersusResult   = lazy(() => import('./components/VersusResult'))
const AppTakeover    = lazy(() => import('./components/app/AppTakeover'))
const AppCareer      = lazy(() => import('./components/app/AppCareer'))
const CareerIntro    = lazy(() => import('./components/app/AppCareer').then(m => ({ default: m.CareerIntro })))
const TakeoverIntro = lazy(() => import('./components/app/AppTakeover').then(m => ({ default: m.TakeoverIntro })))
import CompeteHud from './components/app/CompeteHud'
const AppCompete = lazy(() => import('./components/app/AppCompete'))
const Wiki           = lazy(() => import('./components/wiki/Wiki'))
import { TYPES, LITE_TYPES, QBS, ATTR } from './data/qbs'
import { RBS, RB_TYPES, RB_LITE_TYPES, RB_ATTR } from './data/rbs'
import { WRS, WR_TYPES, WR_LITE_TYPES, WR_CATEGORIES, WR_ATTR } from './data/wrs'
import { WR_LEGENDS } from './data/wr-legends'
import { TES, TE_TYPES, TE_LITE_TYPES, TE_CATEGORIES, TE_ATTR } from './data/tes'
import { TE_LEGENDS } from './data/te-legends'
import { DBS, DB_TYPES, DB_LITE_TYPES, DB_CATEGORIES, DB_ATTR } from './data/dbs'
import { DB_LEGENDS } from './data/db-legends'
import { OLS, OL_TYPES, OL_LITE_TYPES, OL_CATEGORIES, OL_ATTR } from './data/ols'
import { ALLTIME_RATINGS, NFL_TEAMS, TEAMS } from './data/nfl-teams'
import { useCompete, botBuild } from './lib/compete'
import { LEGENDS, LEGEND_TYPES } from './data/qb-legends'
import { RB_LEGENDS } from './data/rb-legends'
import HEADSHOTS from './data/headshots.json'
import { runSimulation, getArchetype, calcOVR, runRBSimulation, calcOVRRB, getArchetypeRB, runWRSimulation, calcOVRWR, getArchetypeWR, runTESimulation, calcOVRTE, getArchetypeTE, runDBSimulation, calcOVRDB, getArchetypeDB, runOLSimulation, calcOVROL, getArchetypeOL, HEADSHOT_BASE, nflHeadshot, calcMVPResult, calcOPOYResult, calcWROPOYResult, calcTEOPOYResult, calcDBDpoyResult, calcOLAllProResult } from './utils/simulation'
import { supabase, rtSupabase } from './lib/supabase'
import { track } from './lib/track'
import { loadCareer, saveCareer, newCareer, OFFENSE_POS } from './lib/career'
import { blockReason, buildSig, markPlayed } from './lib/saveGuard'
import CustomRatingsModal from './components/CustomRatingsModal'
import SiteFooter from './components/SiteFooter'
import SiteFeatures from './components/SiteFeatures'
import { IS_APP, APP_LOOK } from './lib/platform'
import AppHome from './components/app/AppHome'
import { finishDiscordSignIn, getUsername } from './lib/discord'
import { dailyState, setDailySpins } from './lib/progress'
import { FlipEdge, BuildComplete, useFlip } from './components/app/AppBuildTray'
import { loadRun, newRun, cityList, ratedPool } from './lib/takeover'
import { rampPage, HOME_UNITS, RAIL_UNITS, RAIL_UNITS_WITH_LEFT } from './lib/ads'

const _dd = arr => { const s = new Set(); return arr.filter(p => { const k = `${p.name}|${p.team}`; if (s.has(k)) return false; s.add(k); return true }) }
const _bt = (a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name)
// Custom Ratings pools: current players and legends kept apart so the modal's
// Current / All-Time toggle can show one or the other (OL has no legends)
const CUSTOM_POOLS = {
  qb: { current: _dd(QBS).sort(_bt), legends: _dd(LEGENDS).sort(_bt) },
  rb: { current: _dd(RBS).sort(_bt), legends: _dd(RB_LEGENDS).sort(_bt) },
  wr: { current: _dd(WRS).sort(_bt), legends: _dd(WR_LEGENDS).sort(_bt) },
  te: { current: _dd(TES).sort(_bt), legends: _dd(TE_LEGENDS).sort(_bt) },
  db: { current: _dd(DBS).sort(_bt), legends: _dd(DB_LEGENDS).sort(_bt) },
  ol: { current: _dd(OLS).sort(_bt), legends: null },
}

// Detect shared build at module load time — before any React rendering
let _sharedData = null
try {
  const _enc = new URLSearchParams(window.location.search).get('b')
  if (_enc) _sharedData = decodeBuild(_enc)
} catch {}

const _isPrivacy = window.location.pathname === '/privacy'
const _isTerms   = window.location.pathname === '/terms'
const _isProfile = !_sharedData && !_isPrivacy && !_isTerms && window.location.pathname === '/profile'
const _isAbout   = !_sharedData && !_isPrivacy && !_isTerms && !_isProfile && new URLSearchParams(window.location.search).has('about')
const _isDepthChart = !_sharedData && !_isPrivacy && !_isTerms && !_isProfile && !_isAbout && window.location.pathname === '/depth-chart'
const _isWiki     = !_sharedData && window.location.pathname.startsWith('/wiki')   // /wiki and /wiki/<page>; the wiki routes its own pages

// App: switching sport from Home lands on Home (the build in progress waits for PLAY)
const _goHome = (() => { try { const v = sessionStorage.getItem('bap_go_home') === '1'; sessionStorage.removeItem('bap_go_home'); return v } catch { return false } })()

const _saved = (() => {
  if (_sharedData || _isPrivacy || _isAbout || _isProfile || _isDepthChart || _isWiki) return null
  try {
    const p = JSON.parse(localStorage.getItem('bap_progress'))
    // OL is Coming Soon — don't drop anyone back into an in-progress OL build
    return p?.position === 'ol' || p?.tk === 'compete' ? null : p
  } catch { return null }
})()

function hideVideoAds() {
  const sel = '[id*="corner_video"],[id*="floating_video"],[id*="corner-video"],[class*="corner_video"],[class*="floating_video"],[id^="pw-oop-video"],[id^="pw-oop-corner"],[id^="pw-oop-interstitial"],[id*="interstitial"],[class*="interstitial"],[id*="video_corner"],[id*="vid_corner"],[class*="video_corner"]'
  document.querySelectorAll(sel).forEach(el => el.style.setProperty('display', 'none', 'important'))
  document.querySelectorAll('div[id^="pw-"]').forEach(el => {
    const id = el.id.toLowerCase()
    if (id.includes('video') || id.includes('corner') || id.includes('interstitial')) el.style.setProperty('display', 'none', 'important')
  })
}

const RAMP_AD_UNITS = ['bottom_rail', 'corner_ad_video', 'left_rail', 'standard_iab', 'standard_iab_cntr1', 'video_bottom_rail']
const RAMP_FORCE_OFF = RAMP_AD_UNITS.map(unit => ({ unit, force: 'off' }))

function enableAdFreeMode() {
  document.documentElement.classList.add('ads-hidden')
  window.ramp = window.ramp || {}
  window.ramp.forceUnits = RAMP_FORCE_OFF
  window.ramp.que = window.ramp.que || []
  window.ramp.que.push(() => {
    window.ramp.forceUnits = RAMP_FORCE_OFF
    try { window.ramp.destroyUnits('all') } catch {}
  })
  const hide = () => {
    document.querySelectorAll('[id^="pw-"],[id^="ramp-"],[class^="pw-"],[id^="adBanner"],[id*="bottom_rail"],[class*="bottom_rail"],[id*="video-bottom"],[class*="video-bottom"]').forEach(el => {
      el.style.setProperty('display', 'none', 'important')
    })
  }
  hide()
  const obs = new MutationObserver(hide)
  obs.observe(document.body, { childList: true, subtree: true })
}

// Early call — fires before Ramp initializes so forceUnits takes effect
// The app has no web ads (Ramp does not serve in-app), so it always runs ad-free here.
try { if (IS_APP || localStorage.getItem('bap_subscribed') === '1' || localStorage.getItem('bap_ads_off') === '1') enableAdFreeMode() } catch {}

export default function App() {
  const [page, setPage]               = useState(_sharedData ? 'shared' : _isPrivacy ? 'privacy' : _isTerms ? 'terms' : _isProfile ? 'profile' : _isAbout ? 'about' : _isDepthChart ? 'depth-chart' : _isWiki ? 'wiki' : (_saved?.gameMode && !_goHome ? (_saved.tk === 'build' ? 'takeover-build' : _saved.tk === 'career' ? 'career-build' : _saved.tk === 'road' ? 'splash' : 'game') : 'splash'))
  const [sharedBuild]                 = useState(_sharedData?.build ?? null)
  const [sharedTypes]                 = useState(_sharedData?.types ?? null)
  const [gameMode, setGameMode]         = useState(_saved?.gameMode ?? null)
  const [position, setPosition]         = useState(_saved?.position ?? 'qb')
  const [build, setBuild]               = useState(_saved?.build ?? {})
  const [activeDrag, setActiveDrag]     = useState(null)
  const [activeCategory, setActiveCategory] = useState('physical')
  const [simResult, setSimResult]       = useState(null)
  const [simReplaying, setSimReplaying] = useState(false)
  const [spinResetKey, setSpinResetKey] = useState(0)
  const [gameKey, setGameKey]           = useState(0)
  const [mobileView, setMobileView]     = useState('spin')
  const [onlineCount, setOnlineCount]   = useState(0)
  const [user, setUser]                 = useState(null)
  const [showAuth, setShowAuth]         = useState(false)
  const [showTeamPicker, setShowTeamPicker] = useState(false)
  // App: today's Daily Challenge run ({ key, pos, mode, seed }) — same seeded spins for everyone
  const [takeoverRun, setTakeoverRun] = useState(null)   // App: TAKEOVER run (the road)
  const [dailyRun, setDailyRun] = useState(() => ((IS_APP || APP_LOOK) && _saved?.daily?.key === dailyState().key ? _saved.daily : null))
  const [savedSpinResult, setSavedSpinResult] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bap_spin_result')) } catch { return null }
  })
  const [spinPhase, setSpinPhase] = useState('idle')
  const [adsDisabled, setAdsDisabled] = useState(IS_APP)
  const [isSubscribed, setIsSubscribed] = useState(() => {
    try { return localStorage.getItem('bap_subscribed') === '1' } catch { return false }
  })
  const [isCustomMode, setIsCustomMode] = useState(() => {
    try { return localStorage.getItem('bap_custom_mode') === '1' } catch { return false }
  })
  const [customRatings, setCustomRatings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bap_custom_ratings') || '{}') } catch { return {} }
  })
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [saveToast, setSaveToast] = useState(null)
  const saveToastTimer = useRef(null)

  // Versus mode state
  const [versusRoom, setVersusRoom]     = useState(null)  // { code, role, oppId, oppName, channel }
  const [oppBuild, setOppBuild]         = useState({})
  const [oppQB, setOppQB]               = useState(null)
  const [vsRecord, setVsRecord]         = useState({ wins: 0, losses: 0 })
  const [oppDisconnected, setOppDisconnected] = useState(false)
  const [vsFinalResult, setVsFinalResult] = useState(null) // host-computed, broadcast to guest
  const vsChannelReady = useRef(false)
  const lastOppPingRef = useRef(Date.now())
  const oppLeaveTimerRef = useRef(null)
  const faceoffFiredRef = useRef(false)
  // Latest build/user/position for handlers set up once (heartbeat timers, etc.)
  // that would otherwise close over stale values.
  const vsResultRef = useRef({ build: {}, user: null, position: 'qb' })
  useEffect(() => {
    vsResultRef.current = { build, user, position }
  })

  // Once sandbox is ever turned on during a build session, taint it permanently
  // until reset — prevents toggle-on → edit → toggle-off → simulate exploit.
  // The mark is saved with the build (bap_progress), so a refresh can't clear it.
  const sandboxTainted = useRef(isCustomMode || !!_saved?.sandbox || Object.values(_saved?.build ?? {}).some(c => c?.sandbox))
  useEffect(() => {
    if (isCustomMode) sandboxTainted.current = true
  }, [isCustomMode])

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

  useEffect(() => {
    hideVideoAds()
    const obs = new MutationObserver(hideVideoAds)
    obs.observe(document.body, { childList: true, subtree: true })
    const interval = setInterval(hideVideoAds, 1000)
    // Ads only need hiding briefly right after load — leaving this observer
    // running for the whole session means every DOM mutation anywhere in the
    // app (chip animations, spin reels, drag state) re-triggers two full-page
    // querySelectorAll scans. Cap it to match the interval's own 15s window.
    const stopTimer = setTimeout(() => { clearInterval(interval); obs.disconnect() }, 15000)
    return () => { obs.disconnect(); clearInterval(interval); clearTimeout(stopTimer) }
  }, [])

  // Fine-tune --ad-h to exact rail height; CSS :has() provides 48px fallback
  useEffect(() => {
    const root = document.documentElement
    let elObs = null

    function measure() {
      const el = document.querySelector('[id^="pw-oop"][data-pw-status="loaded"]')
      if (!el) { root.style.removeProperty('--ad-h'); return }

      // Check if Playwire hid it via display:none (e.g. user clicked X or ad-free mode)
      // Use setProperty('0px') here specifically to suppress the CSS :has() fallback,
      // since a hidden element still matches :has() but shouldn't trigger padding.
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
          // Ad fits within tab bar's base clearance — remove inline override so
          // the CSS :has() fallback (48px) can apply for the spin button.
          root.style.removeProperty('--ad-h')
        }
      } else {
        // Not yet sized — remove so CSS :has() fallback can handle it
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
    // NOTE: this used to also watch 'style' at the body+subtree level, which
    // means ANY inline style change ANYWHERE in the app (every spin-reel/chip
    // animation frame) re-triggered a querySelector + layout-forcing
    // getBoundingClientRect() here — that's what was making the build screen
    // laggy. Style changes on the ad element itself are already covered by
    // elObs below, scoped to just that one element, so the body-wide watch
    // only needs data-pw-status (rare) plus childList (to catch the ad
    // element first appearing).
    const bodyObs = new MutationObserver(() => { attachElObs(); measure() })
    bodyObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-pw-status'] })
    return () => { bodyObs.disconnect(); if (elObs) elObs.disconnect() }
  }, [])

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', page === 'splash' ? '#0f1612' : page === 'depth-chart' ? '#111318' : page === 'wiki' ? '#ffffff' : '#090a0d')
  }, [page])

  // iOS/Android app: report the page to the bottom tab bar (AppTabBar) and
  // follow its taps. No-ops on the website.
  useEffect(() => {
    if (!IS_APP && !APP_LOOK) return
    window.__bapPage = { page, sport: 'nfl' }
    window.dispatchEvent(new CustomEvent('bap:page', { detail: window.__bapPage }))
    if (['game', 'sim', 'takeover', 'takeover-build', 'career', 'career-build'].includes(page)) lastPlayRef.current = page
  }, [page])
  const startDailyRef = useRef(null)
  const openTakeoverRef = useRef(null)
  const takeoverRunRef = useRef(null); takeoverRunRef.current = takeoverRun
  const openCareerRef = useRef(null)
  const careerRef = useRef(null)
  const lastPlayRef = useRef(null)           // the last mode page, so PLAY goes back to what you were doing
  useEffect(() => {
    if (!IS_APP && !APP_LOOK) return
    const onNav = e => {
      const to = e.detail
      if (to === 'home') setPage('splash')   // keeps the build in progress — PLAY resumes it
      else if (to === 'play') {
        if (page === 'game' || page === 'sim' || page === 'takeover' || page === 'takeover-build' || page === 'career' || page === 'career-build') return
        const last = lastPlayRef.current, run = takeoverRunRef.current
        if (last === 'takeover' && run && !run.over) setPage('takeover')
        else if (last === 'takeover-build' && gameMode) setPage('takeover-build')
        else if (last === 'career' && careerRef.current) setPage('career')
        else if (last === 'career-build' && gameMode) setPage('career-build')
        else if (gameMode) setPage(simResult ? 'sim' : 'game')
        else { let p = 'qb'; try { p = localStorage.getItem('lastPosition') || 'qb' } catch {}; handleStart('classic', p) }   // quick play
      } else if (to === 'leaderboard') setPage('leaderboard')
      else if (to === 'daily-challenge') startDailyRef.current?.()
      else if (to === 'takeover') openTakeoverRef.current?.()
      else if (to === 'career') openCareerRef.current?.()
      else if (to === 'depth-chart') setPage('depth-chart')
      else if (to === 'salarycap') handleStart('salarycap', 'qb')
      // signed out: the dock shows sign-in itself, since only some pages render AuthModal
      else if (to === 'profile') { if (user) { window.history.pushState({}, '', '/profile'); setPage('profile') } else window.dispatchEvent(new CustomEvent('bap:auth')) }
      else if (to === 'about') setPage('about')
      else if (to === 'wiki') setPage('wiki')
      else if (to === 'compete') setPage('compete')
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('bap:nav', onNav)
    return () => window.removeEventListener('bap:nav', onNav)
  }, [page, gameMode, simResult, user])

  // Ads on every page change (lib/ads.js): destroy all units, then add this
  // page's off-page units with the path set explicitly (the URL sync effect
  // below runs after this). A layout effect, so it's queued before the new
  // page's own in-page units. Home runs the bottom rail only; the left rail only
  // runs on /simulate and /depth-chart. Ad-free players keep forceUnits 'off'.
  useLayoutEffect(() => {
    const onSimulate = page === 'sim' && !!simResult
    if (page === 'splash') { rampPage({ ads: HOME_UNITS, path: '/' }); return }
    const here = window.location.pathname
    const path = onSimulate ? '/simulate'
      : page === 'depth-chart' ? '/depth-chart'
      : page === 'leaderboard' ? '/leaderboard'
      : page === 'wiki' ? (here.startsWith('/wiki') ? here : '/wiki')
      : (['/simulate', '/leaderboard', '/depth-chart'].includes(here) || here.startsWith('/wiki')) ? '/' : here
    rampPage({ ads: onSimulate || page === 'depth-chart' ? RAIL_UNITS_WITH_LEFT : RAIL_UNITS, path })
  }, [page, simResult])

  // Whether the build belongs to a Takeover run: a reload goes back to the
  // Takeover build, or to Home once the road has started (its card resumes it)
  const tkRef = useRef(_saved?.tk ?? null)
  const competeRef = useRef(false)   // set once Compete is set up below
  if (page === 'takeover-build') tkRef.current = 'build'
  else if (page === 'career-build') tkRef.current = 'career'
  else if (page === 'takeover') tkRef.current = 'road'
  else if (page === 'game') tkRef.current = competeRef.current ? 'compete' : null
  useEffect(() => {
    if (!gameMode || gameMode === 'salarycap') return
    try { localStorage.setItem('bap_progress', JSON.stringify({ gameMode, position, build, daily: dailyRun, tk: tkRef.current, sandbox: sandboxTainted.current || isCustomMode })) } catch {}
  }, [build, gameMode, position, dailyRun, page, isCustomMode])

  useEffect(() => {
    try {
      if (savedSpinResult) localStorage.setItem('bap_spin_result', JSON.stringify(savedSpinResult))
      else localStorage.removeItem('bap_spin_result')
    } catch {}
  }, [savedSpinResult])

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
      if (!u) {
        try { localStorage.removeItem('bap_subscribed') } catch {}
        try { localStorage.removeItem('bap_ads_off') } catch {}
        return
      }
      if (adFreeReturn) {
        // Poll DB until webhook confirms ads_disabled, up to 10 attempts
        let attempts = 0
        const poll = () => {
          supabase.from('accounts').select('ads_disabled,subscription_status').eq('id', u.id).single()
            .then(({ data: p }) => {
              if (p?.ads_disabled || p?.subscription_status === 'active') { setAdsDisabled(true); enableAdFreeMode() }
              if (p?.subscription_status === 'active') { setIsSubscribed(true); try { localStorage.setItem('bap_subscribed', '1') } catch {} }
              else if (++attempts < 10) setTimeout(poll, 2000)
            })
        }
        poll()
      } else {
        supabase.from('accounts').select('ads_disabled,subscription_status').eq('id', u.id).single()
          .then(({ data: p }) => {
            if (p?.ads_disabled || p?.subscription_status === 'active') { setAdsDisabled(true); enableAdFreeMode() }
            if (p?.ads_disabled) { try { localStorage.setItem('bap_ads_off', '1') } catch {} }
            else { try { localStorage.removeItem('bap_ads_off') } catch {} }
            if (p?.subscription_status === 'active') {
              setIsSubscribed(true)
              try { localStorage.setItem('bap_subscribed', '1') } catch {}
            } else {
              try { localStorage.removeItem('bap_subscribed') } catch {}
            }
          })
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      // Back from Discord sign-in: join the server, and pick up a Discord account's new username
      finishDiscordSignIn(session).then(u => { if (u) setUser(u) })
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handlePop = () => {
      const path = window.location.pathname
      let changed = false
      if (path !== '/profile') {
        setPage(prev => prev === 'profile' ? 'game' : prev)
        changed = true
      }
      if (path !== '/simulate') {
        setPage(prev => prev === 'sim' ? 'game' : prev)
        changed = true
      }
      if (path !== '/leaderboard') {
        setPage(prev => prev === 'leaderboard' ? 'game' : prev)
        changed = true
      }
      if (path !== '/depth-chart') {
        setPage(prev => prev === 'depth-chart' ? 'splash' : prev)
        changed = true
      }
      // The wiki owns /wiki/*: Back into it reopens it, Back out of it lands on the splash
      if (path.startsWith('/wiki')) { setPage(prev => (prev === 'wiki' ? prev : 'wiki')); changed = true }
      else { setPage(prev => (prev === 'wiki' ? 'splash' : prev)); changed = true }
      if (changed) window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  // Dedicated URLs for the simulate/season/playoffs/final flow, the
  // leaderboard, and the depth chart mini-game — lets Playwire apply ad
  // rules by path. Purely a URL sync layer; doesn't touch page state, the
  // ad calls (lib/ads.js), or any in-app navigation logic.
  useEffect(() => {
    const onWikiPath = window.location.pathname.startsWith('/wiki')
    const targetPath = (page === 'sim' && simResult) ? '/simulate' : page === 'leaderboard' ? '/leaderboard' : page === 'depth-chart' ? '/depth-chart' : page === 'wiki' ? (onWikiPath ? window.location.pathname : '/wiki') : null
    if (targetPath) {
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath)
      }
    } else if (['/simulate', '/leaderboard', '/depth-chart'].includes(window.location.pathname) || onWikiPath) {
      window.history.replaceState({}, '', '/')
    }
  }, [page, simResult])

  useEffect(() => {
    if (!supabase) return
    const uid = Math.random().toString(36).slice(2)
    const ch = supabase.channel('online', { config: { presence: { key: uid } } })
    let lastUpdate = 0
    ch.on('presence', { event: 'sync' }, () => {
      const now = Date.now()
      if (now - lastUpdate < 3000) return
      lastUpdate = now
      setOnlineCount(Math.round(Object.keys(ch.presenceState()).length * 3))
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ t: Date.now() })
    })
    return () => supabase.removeChannel(ch)
  }, [])

  const isRB        = position === 'rb'
  const isWR        = position === 'wr'
  const isTE        = position === 'te'
  const isDB        = position === 'db'
  const isOL        = position === 'ol'
  const activeTypes = isOL ? (gameMode === 'lite' ? OL_LITE_TYPES : OL_TYPES) : isDB ? (gameMode === 'lite' ? DB_LITE_TYPES : DB_TYPES) : isTE ? (gameMode === 'lite' ? TE_LITE_TYPES : TE_TYPES) : isWR ? (gameMode === 'lite' ? WR_LITE_TYPES : WR_TYPES) : gameMode === 'lite' ? (isRB ? RB_LITE_TYPES : LITE_TYPES) : (gameMode === 'all-time' && !isRB) ? LEGEND_TYPES : (isRB ? RB_TYPES : TYPES)
  const activePool  = isOL ? OLS : isDB ? (gameMode === 'all-time' ? DB_LEGENDS : DBS) : isTE ? (gameMode === 'all-time' ? TE_LEGENDS : TES) : isWR ? (gameMode === 'all-time' ? WR_LEGENDS : WRS) : gameMode === 'all-time' ? (isRB ? RB_LEGENDS : LEGENDS) : (isRB ? RBS : QBS)
  const isPlus      = isSubscribed

  // Tracks once per completed build (resets when the build becomes incomplete
  // again, e.g. after a reset), independent of the drag vs. tap-to-place path.
  const buildCompleteTracked = useRef(false)
  useEffect(() => {
    const complete = activeTypes.length > 0 && activeTypes.every(t => build[t])
    if (complete && !buildCompleteTracked.current) {
      buildCompleteTracked.current = true
      track('build_complete', { position, gameMode })
    } else if (!complete) {
      buildCompleteTracked.current = false
    }
  }, [build, activeTypes, position, gameMode])

  // Theme must be declared after isPlus
  useEffect(() => {
    try {
      // the app has no color themes (Pro opens the shop's Pro Vault instead)
      if (!isPlus || IS_APP) { document.documentElement.removeAttribute('data-theme'); return }
      const t = localStorage.getItem('bap_theme')
      if (t && t !== 'default') document.documentElement.setAttribute('data-theme', t)
      else document.documentElement.removeAttribute('data-theme')
    } catch {}
  }, [isPlus])
  // App: the shop reads Pro from storage; tell it when that changes
  useEffect(() => { if (IS_APP || APP_LOOK) window.dispatchEvent(new CustomEvent('bap:pro')) }, [isPlus])

  const customModeKey = isOL ? 'ol' : isDB ? 'db' : isTE ? 'te' : isWR ? 'wr' : `${isRB ? 'rb' : 'qb'}${gameMode === 'all-time' ? '_legends' : ''}`
  const customPoolKey = isOL ? 'ol' : isDB ? 'db' : isTE ? 'te' : isWR ? 'wr' : isRB ? 'rb' : 'qb'
  const displayPool = (isCustomMode && customRatings[customModeKey])
    ? activePool.map(p => {
        const override = customRatings[customModeKey][`${p.name}|${p.team}`]
        return override ? { ...p, attrs: { ...p.attrs, ...override } } : p
      })
    : activePool



  const activeDragRef = useRef(activeDrag)
  useLayoutEffect(() => { activeDragRef.current = activeDrag }, [activeDrag])

  // ── COMPETE: five-player pools on the same spins (lib/compete.js) ──────────
  const [competePos, setCompetePos] = useState(() => { let p = 'qb'; try { p = localStorage.getItem('lastPosition') || 'qb' } catch {}; return ['qb', 'rb', 'wr', 'te', 'db'].includes(p) ? p : 'qb' })
  const cp = useCompete({
    enabled: IS_APP || APP_LOOK, user, sport: 'nfl', pos: competePos,
    botFor: (seed, idx, skill, pos) => botBuild({
      seed, idx, skill, teams: TEAMS,
      pool: { qb: QBS, rb: RBS, wr: WRS, te: TES, db: DBS }[pos] ?? QBS,
      types: pos === 'db' ? DB_TYPES : pos === 'te' ? TE_TYPES : pos === 'wr' ? WR_TYPES : pos === 'rb' ? RB_TYPES : TYPES,
      calcOvr: b => pos === 'db' ? calcOVRDB(b) : pos === 'te' ? calcOVRTE(b) : pos === 'wr' ? calcOVRWR(b) : pos === 'rb' ? calcOVRRB(b) : calcOVR(b),
    }),
  })
  const competeOn = cp.phase === 'build' && !cp.results[cp.me.vid]
  competeRef.current = competeOn
  const competeKey = useRef(null)

  const handleStart = useCallback((mode, pos = 'qb') => {
    // Salary Cap (QB): its own page picks the build from the day's grid
    if (mode === 'salarycap') {
      setPosition('qb'); setGameMode('salarycap'); setBuild({}); setSimResult(null); setDailyRun(null)
      setPage('salarycap'); window.scrollTo(0, 0)
      track('mode_selected', { position: 'qb', gameMode: 'salarycap' })
      return
    }
    setPosition(pos)
    const isRBMode = pos === 'rb'
    const isWRMode = pos === 'wr'
    const isTEMode = pos === 'te'
    const isDBMode = pos === 'db'
    const isOLMode = pos === 'ol'
    const types = isOLMode ? (mode === 'lite' ? OL_LITE_TYPES : OL_TYPES) : isDBMode ? (mode === 'lite' ? DB_LITE_TYPES : DB_TYPES) : isTEMode ? (mode === 'lite' ? TE_LITE_TYPES : TE_TYPES) : isWRMode ? (mode === 'lite' ? WR_LITE_TYPES : WR_TYPES) : mode === 'lite' ? (isRBMode ? RB_LITE_TYPES : LITE_TYPES) : (isRBMode ? RB_TYPES : TYPES)
    setGameMode(mode)
    setBuild(Object.fromEntries(types.map(t => [t, null])))
    setActiveCategory('physical')
    setSavedSpinResult(null)
    setDailyRun(null)
    if (IS_APP || APP_LOOK) {   // a finished game is kept around (Home → resume), so clear it
      setSimResult(null)
      setMobileView('spin')
      setSpinResetKey(k => k + 1)
      setGameKey(k => k + 1)
    }
    sandboxTainted.current = isCustomMode
    setPage('game')
    track('mode_selected', { position: pos, gameMode: mode })
    window.scrollTo(0, 0)
  }, [isCustomMode])

  const handleDrop = useCallback((type) => {
    const drag = activeDragRef.current
    if (!drag) return
    setBuild(prev => ({ ...prev, [drag.type]: drag }))
    setActiveDrag(null)
    setSpinResetKey(k => k + 1)
  }, [])


  // Bumps the lifetime award counter on `accounts`. Called once the season it
  // was won in has saved. (All-Pro has no counter — it's counted from the
  // season_award tag, like Daily's per-day award counts.)
  const recordAward = useCallback(async (isAllTime, awardType) => {
    if (!user || !supabase || awardType === 'allpro') return
    const col = awardType === 'opoy'
      ? (isAllTime ? 'alltime_opoys' : 'classic_opoys')
      : awardType === 'dpoy'
        ? (isAllTime ? 'alltime_dpoys' : 'classic_dpoys')
        : (isAllTime ? 'alltime_mvps'  : 'classic_mvps')
    // Read only this award's column, so one missing column can't take every
    // other award's counter down with it.
    const { data, error: readError } = await supabase.from('accounts').select(col).eq('id', user.id).maybeSingle()
    if (readError) { console.error('[award] failed to read award count:', readError); return }
    const current = data?.[col] ?? 0
    const q = data
      ? supabase.from('accounts').update({ [col]: current + 1 }).eq('id', user.id)
      : supabase.from('accounts').insert({ id: user.id, [col]: 1 })
    q.then(({ error }) => { if (error) console.error('[award] failed to save award:', error) })
  }, [user])

  // Daily Challenge: no resets until the run has been simulated
  const dailyLocked = !!dailyRun && !dailyState().done
  const dailyLockedRef = useRef(dailyLocked)
  dailyLockedRef.current = dailyLocked

  // App: Spin and Build are two sides of one card — swipe to flip, and the
  // last pick flips it to Build (drag-and-drop included)
  const flip = useFlip(IS_APP && (page === 'game' || page === 'versus-game' || page === 'takeover-build' || page === 'career-build'), mobileView, setMobileView)
  const buildComplete = activeTypes.length > 0 && activeTypes.every(t => build[t])
  useEffect(() => { if (IS_APP && buildComplete && (page === 'game' || page === 'takeover-build' || page === 'career-build')) flip('build') }, [buildComplete]) // eslint-disable-line react-hooks/exhaustive-deps
  // Website: the build-complete hit (the app's BuildComplete screen plays its own)
  useEffect(() => { if (!IS_APP && buildComplete && (page === 'game' || page === 'takeover-build' || page === 'career-build')) window.__bapJuice?.sfx('complete', 2) }, [buildComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── TAKEOVER (app): a saved run per account, or a fresh build first ──
  useEffect(() => { if (IS_APP || APP_LOOK) setTakeoverRun(loadRun('nfl', user?.id)) }, [user?.id])
  const startTakeoverBuild = useCallback(() => {
    let p = 'qb'; try { p = localStorage.getItem('lastPosition') || 'qb' } catch {}
    if (!['qb', 'rb', 'wr', 'te', 'db'].includes(p)) p = 'qb'
    handleStart('classic', p); setPage('takeover-build')
  }, [handleStart])
  const openTakeover = useCallback(() => {
    const run = loadRun('nfl', user?.id)
    if (run && !run.over) { setTakeoverRun(run); setPage('takeover') } else { setPage('takeover-intro'); window.scrollTo({ top: 0, behavior: 'instant' }) }
  }, [user?.id, startTakeoverBuild])
  // ── CAREER (app): one saved career per account; a fresh build starts one ──
  const [career, setCareer] = useState(null)
  careerRef.current = career
  useEffect(() => { if (IS_APP || APP_LOOK) setCareer(loadCareer('nfl', user?.id)) }, [user?.id])
  const startCareerBuild = useCallback(() => {
    let p = 'qb'; try { p = localStorage.getItem('lastPosition') || 'qb' } catch {}
    if (!OFFENSE_POS.includes(p)) p = 'qb'
    handleStart('classic', p); setPage('career-build')
  }, [handleStart])
  const openCareer = useCallback(() => {
    const c = loadCareer('nfl', user?.id)
    if (c) { setCareer(c); setPage('career') } else setPage('career-intro')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [user?.id])
  openCareerRef.current = openCareer
  const enterDraft = useCallback(() => {
    const c = newCareer({ sport: 'nfl', uid: user?.id ?? null, pos: position, build, name: getUsername(user) || 'You' })
    saveCareer(c); setCareer(c); setGameMode(null); setBuild({}); setPage('career')
    try { localStorage.removeItem('bap_progress') } catch {}   // the build is the career's now: a reload lands on Home, not the build page
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [user, position, build])

  const hitTheRoad = useCallback(() => {
    const pools = { qb: QBS, rb: RBS, wr: WRS, te: TES, db: DBS }
    const ovrOf = b => position === 'db' ? calcOVRDB(b) : position === 'te' ? calcOVRTE(b) : position === 'wr' ? calcOVRWR(b) : position === 'rb' ? calcOVRRB(b) : calcOVR(b)
    const cities = cityList('nfl', NFL_TEAMS)
    const rated = ratedPool(pools[position] ?? QBS, activeTypes, ovrOf, cities)
    const run = newRun({ sport: 'nfl', uid: user?.id ?? null, pos: position, build, types: activeTypes, rated, cities })
    setTakeoverRun(run); setPage('takeover')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [user?.id, position, build, activeTypes])

  useEffect(() => {
    if (cp.phase !== 'build' || !cp.match || cp.results[cp.me.vid] || competeKey.current === cp.match.code) return
    competeKey.current = cp.match.code
    // same spins for the whole pool: no custom ratings, a fresh spin screen
    try { localStorage.setItem('bap_custom_mode', '0') } catch {}
    setIsCustomMode(false)
    handleStart('classic', cp.match.pos)
    setSimResult(null); setMobileView('spin'); setSpinResetKey(k => k + 1); setGameKey(k => k + 1)
    sandboxTainted.current = false
  }, [cp.phase, cp.match?.code]) // eslint-disable-line react-hooks/exhaustive-deps
  // LOCK IN: the build's OVR goes to the pool; the game is done with
  const lockInCompete = useCallback(() => {
    const ovr = Math.round((isOL ? calcOVROL(build) : isDB ? calcOVRDB(build) : isTE ? calcOVRTE(build) : isWR ? calcOVRWR(build) : isRB ? calcOVRRB(build) : calcOVR(build)) ?? 0)
    cp.submit(ovr, build)
    try { localStorage.removeItem('bap_progress') } catch {}
    setGameMode(null); setBuild({}); setSavedSpinResult(null)
    setPage('compete')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [build, cp, isOL, isDB, isTE, isWR, isRB])

  const startDaily = useCallback(() => {
    const dc = dailyState()
    if (dc.done) { window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'daily' })); return }
    if (dailyRun?.key === dc.key && gameMode) { setPage(simResult ? 'sim' : 'game'); return }
    try { localStorage.setItem('lastPosition', dc.pos) } catch {}
    // Same spins for everyone, so custom ratings are off for the run (on, they'd also stop it counting)
    try { localStorage.setItem('bap_custom_mode', '0') } catch {}
    setIsCustomMode(false)
    handleStart(dc.mode, dc.pos)
    sandboxTainted.current = false
    setDailyRun({ key: dc.key, pos: dc.pos, mode: dc.mode, seed: dc.seed })
  }, [dailyRun, gameMode, simResult, handleStart])
  startDailyRef.current = startDaily
  openTakeoverRef.current = openTakeover

  // Opened from Build-A-Bucket's Daily screen (/?daily=1)
  useEffect(() => {
    if ((!IS_APP && !APP_LOOK) || !new URLSearchParams(window.location.search).has('daily')) return
    window.history.replaceState({}, '', '/')
    startDaily()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleReset = useCallback(() => {
    if (dailyLockedRef.current) return
    setDailyRun(null)
    setVersusRoom(prev => {
      if (prev) { recordVsForfeiture(); cleanupVersusChannel(prev.channel) }
      return null
    })
    setBuild(Object.fromEntries(activeTypes.map(t => [t, null])))
    setSimResult(null)
    setSimReplaying(false)
    setActiveDrag(null)
    setSpinResetKey(k => k + 1)
    setGameKey(k => k + 1)
    setSavedSpinResult(null)
    sandboxTainted.current = isCustomMode
    setMobileView('spin')
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' })
  }, [activeTypes, isCustomMode])

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

  const handleSimulate = useCallback(() => {
    const isReplay = !!simResult
    if (isReplay) {
      setSimReplaying(true)
      setPage('sim')
      window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    setShowTeamPicker(true)
  }, [simResult])

  const handleSandboxToggle = useCallback((on) => {
    try { localStorage.setItem('bap_custom_mode', on ? '1' : '0') } catch {}
    setIsCustomMode(on)
  }, [])

  const showSaveToast = useCallback((type, msg) => {
    setSaveToast({ type, msg })
    clearTimeout(saveToastTimer.current)
    saveToastTimer.current = setTimeout(() => setSaveToast(null), 4500)
  }, [])

  const commitRef = useRef(null)
  const handleTeamPicked = useCallback((team) => {
    setShowTeamPicker(false)
    const atRatings = ALLTIME_RATINGS[team.short]
    const effectiveTeam = gameMode === 'all-time' && atRatings
      ? { ...team, off: atRatings.off, def: atRatings.def, isAllTime: true }
      : team
    const result = isOL
      ? runOLSimulation(build, effectiveTeam, gameMode === 'all-time')
      : isDB
      ? runDBSimulation(build, effectiveTeam, gameMode === 'all-time')
      : isTE
        ? runTESimulation(build, activeTypes, effectiveTeam, gameMode === 'all-time')
        : isWR
          ? runWRSimulation(build, activeTypes, effectiveTeam, gameMode === 'all-time')
          : isRB
            ? runRBSimulation(build, activeTypes, effectiveTeam, gameMode === 'all-time')
            : runSimulation(build, activeTypes, effectiveTeam, gameMode === 'all-time')
    // The season is steered on the sim page (moments re-simulate the rest of
    // the year), so it's booked when it ends — SimPage calls commitSeason.
    if (IS_APP || APP_LOOK) {
      setSimResult(result); setSimReplaying(false); setPage('sim')
      window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    commitRef.current?.(result)
  }, [build, activeTypes, gameMode, isOL, isDB, isTE, isWR, isRB]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── SALARY CAP (QB): picks from the day's grid → a season on a date-seeded team ──
  const [salaryReturnDate, setSalaryReturnDate] = useState(null)
  const [salaryResults, setSalaryResults] = useState(false)   // View Results: straight to the final screen
  const handleQBSalaryConfirm = useCallback((fullBuild, skipToEnd, dateStr, saveData) => {
    setSalaryReturnDate(dateStr ?? null)
    setPosition('qb'); setGameMode('salarycap')
    setBuild(fullBuild)
    // the team is seeded from the date, so "View Results" always returns the same season
    const dateSeed = dateStr ? parseInt(dateStr.replace(/-/g, ''), 10) : Date.now()
    let h = dateSeed | 0; h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) | 0; h ^= h >>> 16
    const team = NFL_TEAMS[Math.floor(((h >>> 0) / 0x100000000) * NFL_TEAMS.length)]
    const result = runSimulation(fullBuild, TYPES, team, false)
    result.award = calcMVPResult(result, false, team.short)
    setSimResult(result); setSimReplaying(false); setSalaryResults(!!skipToEnd)
    // a fresh play earns season XP (kept on the device: it isn't a saved season)
    if ((IS_APP || APP_LOOK) && !skipToEnd) {
      window.dispatchEvent(new CustomEvent('bap:season', { detail: {
        sport: 'nfl', pos: 'qb', mode: 'salarycap', localOnly: true,
        wins: result.wins, losses: result.losses, playoffs: !!result.playoffs,
        champion: !!result.sbResult?.won, award: !!result.award?.userWins, awardName: 'MVP',
        ovr: result.ovr, ref: result,
      } }))
    }
    setPage('sim')
    window.scrollTo(0, 0)
    // the day's board (or the infinite one) — real sim OVR, fresh plays only
    if (saveData?.userId && supabase && !skipToEnd) {
      const row = {
        user_id: saveData.userId, username: saveData.username, picks: saveData.picks, overall_score: result.ovr,
        pass_yds: result.seasonPassYds ?? saveData.passYds ?? null, pass_tds: result.seasonTDs ?? saveData.passTds ?? null,
        ints: result.seasonINTs ?? saveData.ints ?? null, budget_used: saveData.totalCost,
      }
      const q = saveData.infinite
        ? supabase.from('qb_salary_infinite_plays').insert(row)
        : supabase.from('qb_salary_cap_plays').insert({ ...row, date_str: dateStr })
      q.then(({ error }) => { if (error) console.error('[qb salary save]', error.code, error.message) })
    }
  }, [])

  // Books a finished season: award, save, lifetime counters, XP
  const commitSeason = useCallback((result) => {
    // Decide the season's award (MVP / OPOY / DPOY / All-Pro) now and save it
    // on the season's own row. Players can't edit a saved season afterwards —
    // the database ignores client updates to `simulations` — so tagging the row
    // after the reveal never landed. SimPage reveals this same result.
    const isAllTimeSeason = !!result.team?.isAllTime
    const awardType = isOL ? 'allpro' : isDB ? 'dpoy' : (isRB || isWR || isTE) ? 'opoy' : 'mvp'
    const calcAward = isOL ? calcOLAllProResult : isDB ? calcDBDpoyResult : isTE ? calcTEOPOYResult
      : isWR ? calcWROPOYResult : isRB ? calcOPOYResult : calcMVPResult
    result.award = result.award ?? calcAward(result, isAllTimeSeason, result.team?.short)
    setSimResult(result)
    // Leaderboard guard (lib/saveGuard.js): sandbox in any form, or a build that
    // already saved a season. Either way: no save, and no XP or coins either.
    const saveBlock = blockReason({ mode: gameMode, build, types: activeTypes, pool: activePool, sandboxOn: isCustomMode, tainted: sandboxTainted.current })
    // Season XP, coins, missions and the Daily Challenge score (lib/progress.js)
    if (IS_APP || APP_LOOK) {
      window.dispatchEvent(new CustomEvent('bap:season', { detail: {
        sport: 'nfl', pos: position, mode: gameMode,
        wins: result.wins, losses: result.losses, playoffs: !!result.playoffs,
        champion: !!result.sbResult?.won, award: !!result.award?.userWins,
        awardName: { mvp: 'MVP', opoy: 'OPOY', dpoy: 'DPOY', allpro: 'All-Pro' }[awardType],
        ovr: result.ovr, sandbox: !!saveBlock, daily: !!dailyRun, ref: result,
        build: dailyRun ? Object.fromEntries(activeTypes.filter(t => build[t]).map(t => [t, { qb: build[t].qbFull, team: build[t].team, val: build[t].val }])) : undefined,
      } }))
    }
    track('simulate', { position, gameMode, userId: user?.id ?? null })
    if (!user) {
      showSaveToast('no-auth', 'Sign in to save your stats')
    } else if (saveBlock === 'sandbox') {
      showSaveToast('custom', 'Custom mode — results not saved')
    } else if (saveBlock === 'played') {
      showSaveToast('custom', 'This build already has a saved season — start a new build to save another')
    } else if (!supabase) {
      console.warn('[build-a-player] sim result not saved — supabase not configured')
    } else {
      const arch = isOL
        ? getArchetypeOL(result.ovr, build, activeTypes)
        : isDB
        ? getArchetypeDB(result.ovr, build, DB_TYPES)
        : isTE
          ? getArchetypeTE(result.ovr, build, activeTypes)
          : isWR
            ? getArchetypeWR(result.ovr, build, activeTypes)
            : isRB
              ? getArchetypeRB(result.ovr, build, activeTypes)
              : getArchetype(result.ovr, build, activeTypes)
      markPlayed(buildSig(gameMode, build, activeTypes))
      supabase.from('simulations').insert({
        user_id: user.id,
        username: getUsername(user) || 'Player',
        ovr: result.ovr,
        archetype: arch,
        // OL reuses the generic stat columns: pancakes / sacks allowed /
        // pressures allowed / pass-block win rate / penalties
        game_mode: isOL ? `ol-${gameMode || 'classic'}` : isDB ? `db-${gameMode || 'classic'}` : isTE ? `te-${gameMode || 'classic'}` : isWR ? `wr-${gameMode || 'classic'}` : isRB ? `rb-${gameMode || 'classic'}` : gameMode,
        wins: result.wins ?? null,
        losses: result.losses ?? null,
        season_pass_yds: isOL ? result.seasonPancakes : isDB ? result.seasonTackles : (isWR || isTE) ? result.seasonRecYds : isRB ? result.seasonRushYds : result.seasonPassYds,
        season_tds: isOL ? result.seasonSacksAllowed : isDB ? result.seasonINTs : (isWR || isTE) ? result.seasonRecTDs : isRB ? (result.seasonRushTDs + result.seasonRecTDs) : result.seasonTDs,
        season_ints: isOL ? result.seasonPressures : isDB ? result.seasonPBUs : (isWR || isTE) ? result.seasonRecs : isRB ? null : result.seasonINTs,
        season_comp_pct: isOL ? result.seasonPBWR : isDB ? null : (isWR || isTE) ? result.seasonTargets : isRB ? null : result.seasonCompPct,
        season_rating: isOL ? result.seasonPenalties : (isDB || isRB || isWR || isTE) ? null : result.seasonRating,
        playoffs: result.playoffs,
        champion: result.sbResult?.won ?? false,
        // Daily's per-day award counts and OL All-Pros read this (current-mode seasons only)
        season_award: !isAllTimeSeason && result.award.userWins ? awardType : null,
        build: Object.fromEntries(
          activeTypes.filter(t => build[t]).map(t => [t, {
            qb: build[t].qbFull || build[t].name, team: build[t].team, val: build[t].val,
          }])
        ),
      }).then(({ error }) => {
        if (error?.code === '23505') {
          showSaveToast('custom', 'This build already has a saved season — start a new build to save another')
        } else if (error) {
          console.error('[build-a-player] simulation save failed:', error)
          showSaveToast('error', `Save failed: ${error.message}`)
        } else {
          showSaveToast('saved', 'Saved to profile!')
          // Only seasons that actually saved count toward lifetime awards (not sandbox / signed-out)
          if (result.award.userWins) recordAward(isAllTimeSeason, awardType)
        }
      })
    }
    setSimReplaying(false)
    setPage('sim')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [build, activeTypes, user, gameMode, position, showSaveToast, recordAward, dailyRun, isCustomMode, isOL, isDB, isTE, isWR, isRB, activePool])

  commitRef.current = commitSeason

  // The director re-simulates the rest of a season with tweaked inputs
  const simFor = useCallback((b, t) => {
    const at = gameMode === 'all-time'
    return isOL ? runOLSimulation(b, t, at) : isDB ? runDBSimulation(b, t, at) : isTE ? runTESimulation(b, activeTypes, t, at)
      : isWR ? runWRSimulation(b, activeTypes, t, at) : isRB ? runRBSimulation(b, activeTypes, t, at) : runSimulation(b, activeTypes, t, at)
  }, [gameMode, isOL, isDB, isTE, isWR, isRB, activeTypes])

  const handleHome = useCallback(() => {
    setVersusRoom(prev => {
      if (prev) { recordVsForfeiture(); cleanupVersusChannel(prev.channel) }
      return null
    })
    setPage('splash')
    setGameMode(null)
    setBuild({})
    setSimResult(null)
    setActiveDrag(null)
    setSpinResetKey(0)
    setMobileView('spin')
    sandboxTainted.current = isCustomMode
  }, [isCustomMode])

  function cleanupVersusChannel(ch) {
    vsChannelReady.current = false
    clearTimeout(oppLeaveTimerRef.current)
    if (!ch) return
    if (ch._bc) { ch.close() }
    else { try { (rtSupabase || supabase).removeChannel(ch) } catch {} }
  }

  async function recordVsResult(result) {
    window.dispatchEvent(new CustomEvent('bap:h2h', { detail: { result: result, sport: 'nfl' } }))
    setVsRecord(prev => result === 'win'
      ? { wins: (prev?.wins ?? 0) + 1, losses: prev?.losses ?? 0 }
      : { wins: prev?.wins ?? 0, losses: (prev?.losses ?? 0) + 1 })
    if (!supabase || !user) return
    const { build: b, position: pos } = vsResultRef.current
    const ovr = isOL ? calcOVROL(b) : isDB ? calcOVRDB(b) : isTE ? calcOVRTE(b) : isWR ? calcOVRWR(b) : isRB ? calcOVRRB(b) : calcOVR(b)
    try {
      await supabase.from('vs_results').insert({
        user_id: user.id,
        username: getUsername(user),
        result, ovr: ovr || null, position: pos,
        match_type: versusRoom?.matchType ?? null,
      })
    } catch {}
  }

  async function recordVsForfeiture() {
    window.dispatchEvent(new CustomEvent('bap:h2h', { detail: { result: 'forfeit', sport: 'nfl' } }))
    setVsRecord(prev => ({ wins: prev?.wins ?? 0, losses: (prev?.losses ?? 0) + 1 }))
    if (!supabase || !user) return
    const { build: b, position: pos } = vsResultRef.current
    const ovr = isOL ? calcOVROL(b) : isDB ? calcOVRDB(b) : isTE ? calcOVRTE(b) : isWR ? calcOVRWR(b) : isRB ? calcOVRRB(b) : calcOVR(b)
    try {
      await supabase.from('vs_results').insert({
        user_id: user.id,
        username: getUsername(user),
        result: 'forfeit', ovr: ovr || null, position: pos,
        match_type: versusRoom?.matchType ?? null,
      })
    } catch {}
  }

  // Opponent presumed gone — award the local player a win and bail to the lobby.
  function handleOppGone(ch) {
    window.dispatchEvent(new CustomEvent('bap:h2h', { detail: { result: 'walkover', sport: 'nfl' } }))
    setVsRecord(prev => ({ wins: (prev?.wins ?? 0) + 1, losses: prev?.losses ?? 0 }))
    if (supabase && user) {
      const { build: b, position: pos } = vsResultRef.current
      const ovr = isOL ? calcOVROL(b) : isDB ? calcOVRDB(b) : isTE ? calcOVRTE(b) : isWR ? calcOVRWR(b) : isRB ? calcOVRRB(b) : calcOVR(b)
      if (ovr > 0) {
        supabase.from('vs_results').insert({
          user_id: user.id,
          username: getUsername(user),
          result: 'win', ovr, position: pos,
          match_type: versusRoom?.matchType ?? null,
        }).then(null, () => {})
      }
    }
    cleanupVersusChannel(ch)
    setVersusRoom(null)
    setOppDisconnected(true)
    setPage('versus-lobby')
  }

  const handleVersusJoin = useCallback(({ code, role, oppId, oppName, channel, matchType }) => {
    faceoffFiredRef.current = false
    setOppDisconnected(false)

    channel.on('broadcast', { event: 'vs_build' }, ({ payload }) => {
      lastOppPingRef.current = Date.now()
      setOppBuild(payload.build || {})
      setOppQB(payload.qb || null)
    })
    channel.on('broadcast', { event: 'vs_ping' }, () => { lastOppPingRef.current = Date.now() })
    channel.on('broadcast', { event: 'vs_faceoff' }, () => setPage('versus-result'))
    channel.on('broadcast', { event: 'vs_result_final' }, ({ payload }) => setVsFinalResult(payload))

    // Presence-based disconnect detection (real Realtime channels only — the
    // BroadcastChannel fallback has no presence equivalent). A leave doesn't
    // immediately end the match — a brief WiFi drop/reconnect (common when
    // both players share one router) looks identical to a real departure at
    // first, so we wait a few seconds for a rejoin before giving up.
    if (!channel._bc) {
      channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (!leftPresences.some(p => p.vid === oppId)) return
        clearTimeout(oppLeaveTimerRef.current)
        oppLeaveTimerRef.current = setTimeout(() => handleOppGone(channel), 4000)
      })
      channel.on('presence', { event: 'join' }, ({ newPresences }) => {
        if (!newPresences.some(p => p.vid === oppId)) return
        clearTimeout(oppLeaveTimerRef.current)
      })
    }

    // Opponent never showed up at all — give up after 20s of total silence.
    const ghostTimer = setTimeout(() => {
      if (Date.now() - lastOppPingRef.current > 19000) {
        cleanupVersusChannel(channel)
        setVersusRoom(null)
        setPage('versus-lobby')
        alert('Opponent didn\'t show up. Returning to matchmaking.')
      }
    }, 20000)
    channel.on('broadcast', { event: 'vs_build' }, () => clearTimeout(ghostTimer))
    channel.on('broadcast', { event: 'vs_ping' }, () => clearTimeout(ghostTimer))

    setVersusRoom({ code, role, oppId, oppName, channel, matchType })
    setOppBuild({})
    setOppQB(null)
    setVsFinalResult(null)
    setBuild(Object.fromEntries(activeTypes.map(t => [t, null])))
    setActiveCategory('physical')
    setSavedSpinResult(null)
    setSimResult(null)
    setMobileView('spin')
    setSpinResetKey(k => k + 1)
    setIsCustomMode(false)
    setPage('versus-game')
    window.scrollTo(0, 0)

    // Subscribe now that every .on() handler above is registered. Nothing is
    // sent until Realtime confirms SUBSCRIBED — sending immediately after
    // calling subscribe() races the WebSocket handshake and gets silently
    // dropped, which is what made matches "connect" but never actually sync.
    vsChannelReady.current = false
    lastOppPingRef.current = Date.now()
    let retries = 0
    channel.subscribe(async s => {
      if (s === 'SUBSCRIBED') {
        retries = 0
        vsChannelReady.current = true
        const { build: curBuild } = vsResultRef.current
        channel.send({ type: 'broadcast', event: 'vs_ping', payload: {} }).catch(() => {})
        channel.send({ type: 'broadcast', event: 'vs_build', payload: { build: curBuild, qb: savedSpinResult } }).catch(() => {})
        if (!channel._bc) {
          const vsId = sessionStorage.getItem('bap_vs_id')
          const vid  = user?.id ? `${user.id}-${vsId}` : vsId
          const name = getUsername(user) || 'Your Build'
          if (vid) channel.track({ vid, name }).catch(() => {})
        }
      } else if ((s === 'TIMED_OUT' || s === 'CHANNEL_ERROR') && !channel._bc && retries < 5) {
        vsChannelReady.current = false
        retries++
        setTimeout(() => { try { channel.subscribe() } catch {} }, 1500 * retries)
      }
    })
  }, [activeTypes])

  // Broadcast my build + qb to the versus channel whenever they change —
  // gated on vsChannelReady so nothing is lost to the subscribe race above.
  useEffect(() => {
    if (!versusRoom?.channel || page !== 'versus-game' || !vsChannelReady.current) return
    versusRoom.channel.send({
      type: 'broadcast', event: 'vs_build',
      payload: { build, qb: savedSpinResult },
    }).catch(() => {})
  }, [build, savedSpinResult, versusRoom, page])

  // Heartbeat — lets the opponent detect a dropped connection mid-game even
  // when Supabase presence doesn't fire a clean 'leave' (e.g. tab killed, wifi drop).
  useEffect(() => {
    if (page !== 'versus-game' || !versusRoom?.channel) return
    const id = setInterval(() => {
      versusRoom.channel.send({ type: 'broadcast', event: 'vs_ping', payload: {} }).catch(() => {})
    }, 8000)
    return () => clearInterval(id)
  }, [page, versusRoom])

  useEffect(() => {
    if (page !== 'versus-game' || !versusRoom?.channel) return
    lastOppPingRef.current = Date.now()
    const onVisible = () => { if (!document.hidden) lastOppPingRef.current = Date.now() }
    document.addEventListener('visibilitychange', onVisible)
    const id = setInterval(() => {
      if (document.hidden) return
      if (Date.now() - lastOppPingRef.current > 30000) {
        lastOppPingRef.current = Date.now()
        handleOppGone(versusRoom.channel)
      }
    }, 5000)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [page, versusRoom]) // eslint-disable-line

  // Auto-faceoff once both builds are complete — host broadcasts as the
  // authoritative trigger so both sides transition together instead of each
  // player having to separately notice and click Face Off.
  useEffect(() => {
    if (page !== 'versus-game' || !versusRoom) { faceoffFiredRef.current = false; return }
    const myFilled  = activeTypes.filter(t => build[t]).length
    const oppFilled = activeTypes.filter(t => oppBuild[t]).length
    if (myFilled === activeTypes.length && oppFilled === activeTypes.length && !faceoffFiredRef.current) {
      faceoffFiredRef.current = true
      if (versusRoom.role === 'host') {
        versusRoom.channel?.send({ type: 'broadcast', event: 'vs_faceoff', payload: {} }).catch(() => {})
      }
      setTimeout(() => setPage('versus-result'), 300)
    }
  }, [build, oppBuild, page, versusRoom, activeTypes])

  const handleFaceoff = useCallback(() => {
    if (faceoffFiredRef.current) return
    faceoffFiredRef.current = true
    versusRoom?.channel?.send({ type: 'broadcast', event: 'vs_faceoff', payload: {} }).catch(() => {})
    setPage('versus-result')
  }, [versusRoom])

  // Fetch my H2H W-L record when entering the lobby or a game
  useEffect(() => {
    if ((page !== 'versus-game' && page !== 'versus-lobby') || !user || !supabase) return
    supabase.from('vs_results').select('result').eq('user_id', user.id).then(({ data }) => {
      if (!data) return
      const wins   = data.filter(r => r.result === 'win').length
      const losses = data.filter(r => r.result === 'loss' || r.result === 'forfeit').length
      setVsRecord({ wins, losses })
    })
  }, [page, user])

  // App: the game screen stays mounted while another tab is open (parked,
  // display:none) so a spin in flight keeps spinning, keeps its sound and
  // nothing resets. Both the game page and the parked pages render the same
  // shell, so React keeps the spin's state across the switch.
  const KEEP_GAME_ON = new Set(['splash', 'profile', 'leaderboard', 'about', 'privacy', 'terms', 'depth-chart', 'compete'])
  const gameIsPlay = page === 'game' || (KEEP_GAME_ON.has(page) && lastPlayRef.current === 'game')
  const filledCount = activeTypes.filter(t => build[t]).length
  const currentAttrMap = isOL ? OL_ATTR : isDB ? DB_ATTR : isTE ? TE_ATTR : isWR ? WR_ATTR : isRB ? RB_ATTR : ATTR
  const completeOvr = IS_APP && buildComplete && (page === 'game' || page === 'takeover-build' || page === 'career-build')
    ? (isOL ? calcOVROL(build) : isDB ? calcOVRDB(build) : isTE ? calcOVRTE(build) : isWR ? calcOVRWR(build) : isRB ? calcOVRRB(build) : calcOVR(build))
    : 0
  const dailyPlan = dailyRun && dailyLocked && gameIsPlay
    ? { seed: dailyRun.seed, getStart: () => dailyState().spins, onSpin: setDailySpins }
    : null
  const competePlan = useMemo(() => (competeOn && cp.match ? { seed: cp.match.seed, getStart: () => 0, onSpin: () => {}, separateRespins: true } : null), [competeOn, cp.match?.code]) // eslint-disable-line react-hooks/exhaustive-deps
  // Sandbox is only for the plain Current and All-Time modes
  const sandboxOk = (gameMode === 'classic' || gameMode === 'all-time') && !dailyRun && !competeOn && page !== 'takeover-build' && page !== 'career-build' && page !== 'versus-game'

  const navbarProps = {
    onReset: handleReset,
    onAbout: () => setPage('about'),
    onHome: handleHome,
    onSignIn: () => setShowAuth(true),
    onProfile: () => { window.history.pushState({}, '', '/profile'); setPage('profile') },
    onLeaderboard: () => setPage('leaderboard'),
    onSwitchPosition: (pos) => { try { localStorage.setItem('lastPosition', pos) } catch {}; handleHome() },
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
    onOpenCustomRatings: () => setShowCustomModal(true),
    user,
    gameMode,
    isRB,
    isWR,
    isTE,
    isDB,
    isOL,
    isPlus,
  }

  const renderGame = parked => (
    <>
      {!parked && <Navbar {...navbarProps} />}

      <div className="game-page-scroll">
      {competeOn && <CompeteHud cp={cp} />}
      {IS_APP && (
        <FlipEdge side={mobileView} build={build} types={activeTypes} attrMap={currentAttrMap} onFlip={flip}
          waiting={savedSpinResult?.selectedQB?.name ?? null} complete={buildComplete} />
      )}
      <main className={`game-layout mobile-${mobileView}${gameMode === 'all-time' ? ' alltime-mode' : ''}${page === 'versus-game' ? ' versus-active' : ''}${page === 'takeover-build' || page === 'career-build' ? ' takeover-build' : ''}`}>
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
          qbPool={displayPool}
          savedResult={savedSpinResult}
          onSaveResult={setSavedSpinResult}
          onPhaseChange={setSpinPhase}
          gameKey={gameKey}
          onReset={dailyLocked ? undefined : handleReset}
          adsDisabled={adsDisabled}
          seedPlan={competePlan ?? dailyPlan}
          key={competePlan ? `cp-${cp.match.code}` : 'spin'}
          cardMeta={(IS_APP || APP_LOOK) && gameIsPlay ? { sport: 'nfl', pos: position, mode: gameMode } : null}
          paused={parked}
          isRB={isRB}
          isWR={isWR}
          isTE={isTE}
          isDB={isDB}
          isOL={isOL}
          isAllTime={gameMode === 'all-time'}
          playerLabel={isOL ? 'OL' : isDB ? 'DB' : isTE ? 'TE' : isWR ? 'WR' : undefined}
          attrMap={isOL ? OL_ATTR : isDB ? DB_ATTR : isTE ? TE_ATTR : isWR ? WR_ATTR : isRB ? RB_ATTR : undefined}
          categoriesData={isOL ? OL_CATEGORIES : isDB ? DB_CATEGORIES : isTE ? TE_CATEGORIES : isWR ? WR_CATEGORIES : undefined}
          onlineCount={onlineCount}
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
          isRB={isRB}
          isWR={isWR}
          isTE={isTE}
          isDB={isDB}
          isOL={isOL}
          categoriesData={isOL ? OL_CATEGORIES : isDB ? DB_CATEGORIES : isTE ? TE_CATEGORIES : isWR ? WR_CATEGORIES : undefined}
          attrMap={isOL ? OL_ATTR : isDB ? DB_ATTR : isTE ? TE_ATTR : isWR ? WR_ATTR : isRB ? RB_ATTR : undefined}
          isPlus={isPlus}
          isCustomMode={isCustomMode}
          onOpenCustomModal={() => setShowCustomModal(true)}
          onSandboxToggle={sandboxOk ? handleSandboxToggle : undefined}
        />

        <div className="right-panel-wrap">
          <ReportCard
            build={build}
            onSimulate={page === 'versus-game' ? handleFaceoff : page === 'takeover-build' ? hitTheRoad : page === 'career-build' ? enterDraft : competeOn ? lockInCompete : handleSimulate}
            simLabel={page === 'takeover-build' ? 'HIT THE ROAD' : page === 'career-build' ? 'ENTER THE DRAFT' : competeOn ? 'LOCK IN' : undefined}
            onReset={handleReset}
            types={activeTypes}
            hasResult={page === 'versus-game' ? false : !!simResult}
            isRB={isRB}
            isWR={isWR}
            isTE={isTE}
            isDB={isDB}
            isOL={isOL}
            attrMap={isOL ? OL_ATTR : isDB ? DB_ATTR : isTE ? TE_ATTR : isWR ? WR_ATTR : isRB ? RB_ATTR : undefined}
            isPlus={isPlus}
            isCustomMode={isCustomMode}
            onOpenCustomModal={() => setShowCustomModal(true)}
            onSandboxToggle={sandboxOk ? handleSandboxToggle : undefined}
            isVersusMode={page === 'versus-game'}
          />
        </div>

        {/* Versus opponent status overlay */}
        {page === 'versus-game' && versusRoom && (() => {
          const oppFilled = activeTypes.filter(t => oppBuild[t]).length
          const myFilled  = activeTypes.filter(t => build[t]).length
          return (
            <div className="versus-hud">
              <div className="versus-hud-inner">
                <div className="vhud-side vhud-side--me">
                  <span className="vhud-label">YOU</span>
                  <span className="vhud-count">{myFilled}/{activeTypes.length}</span>
                </div>
                <div className="vhud-vs">VS</div>
                <div className="vhud-side vhud-side--opp">
                  <span className="vhud-label">{versusRoom.oppName}</span>
                  <span className="vhud-count">{oppFilled}/{activeTypes.length}</span>
                </div>
              </div>
              {myFilled === activeTypes.length && (
                <button className="vhud-faceoff-btn" onClick={handleFaceoff}>
                  FACE OFF
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              )}
            </div>
          )
        })()}
      </main>
      <div className="build-footer-section">
        <SiteFeatures sport="nfl" className="build-site-features" />
        <SiteFooter sport="nfl" onDepthChart={() => setPage('depth-chart')} />
      </div>
      </div>


      {/* Mobile bottom tab bar */}
      <nav className="mobile-tab-bar">
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
      </nav>

      {!parked && showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onAuth={setUser}
        />
      )}

      {!parked && IS_APP && (page === 'game' || page === 'takeover-build' || page === 'career-build') && <BuildComplete complete={buildComplete} ovr={completeOvr} build={build} types={activeTypes} attrMap={currentAttrMap} />}

      {!parked && showTeamPicker && (
        <TeamPickerModal onSelect={handleTeamPicked} isPlus={isCustomMode} build={build} />
      )}

      {!parked && saveToast && (
        <div
          className={`save-toast save-toast--${saveToast.type}`}
          onClick={() => setSaveToast(null)}
        >
          {saveToast.type === 'saved' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
          {saveToast.msg}
        </div>
      )}

      {!parked && showCustomModal && (isPlus || isCustomMode) && (
        <CustomRatingsModal
          isRB={isRB}
          isWR={isWR}
          isTE={isTE}
          isDB={isDB}
          isOL={isOL}
          gameMode={gameMode}
          pool={CUSTOM_POOLS[customPoolKey].current}
          poolCurrent={CUSTOM_POOLS[customPoolKey].current}
          poolLegends={CUSTOM_POOLS[customPoolKey].legends}
          onClose={() => setShowCustomModal(false)}
          onSave={(ratings) => {
            setCustomRatings(ratings)
            try { localStorage.setItem('bap_custom_ratings', JSON.stringify(ratings)) } catch {}
          }}
          build={build}
          buildTypes={activeTypes}
          onAddToBuild={(p, playerOverrides, attrType) => {
            sandboxTainted.current = true
            const photo = HEADSHOTS[p.name] ? `${HEADSHOT_BASE}/${HEADSHOTS[p.name]}.webp` : null
            const chipData = {
              type: attrType,
              val: playerOverrides?.[attrType] ?? p.attrs?.[attrType] ?? 5,
              qb: p.short || p.name,
              qbFull: p.name,
              teamColor: p.color,
              teamColor2: p.color2,
              skinColor: p.skin,
              number: p.number,
              team: p.team,
              captain: p.captain ?? false,
              sandbox: true,
              photo,
            }
            setBuild(prev => ({ ...prev, [attrType]: chipData }))
            setMobileView('build')
            setShowCustomModal(false)
          }}
          onAddAllToBuild={(p, playerOverrides) => {
            sandboxTainted.current = true
            const photo = HEADSHOTS[p.name] ? `${HEADSHOT_BASE}/${HEADSHOTS[p.name]}.webp` : null
            setBuild(prev => {
              const next = { ...prev }
              activeTypes.forEach(attrType => {
                if (!prev[attrType]) {
                  next[attrType] = {
                    type: attrType,
                    val: playerOverrides?.[attrType] ?? p.attrs?.[attrType] ?? 5,
                    qb: p.short || p.name,
                    qbFull: p.name,
                    teamColor: p.color,
                    teamColor2: p.color2,
                    skinColor: p.skin,
                    number: p.number,
                    team: p.team,
                    captain: p.captain ?? false,
                    sandbox: true,
                    photo,
                  }
                }
              })
              return next
            })
            setMobileView('build')
            setShowCustomModal(false)
          }}
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
  const withGame = el => (IS_APP && gameMode && KEEP_GAME_ON.has(page) ? shell(el) : el)

  const openWiki = () => { setPage('wiki'); window.scrollTo({ top: 0, behavior: 'instant' }) }
  const startVersus = (pos) => {
    const p = pos || 'qb'
    try { localStorage.setItem('lastPosition', p) } catch {}
    setPosition(p)
    setGameMode('classic')
    setBuild(Object.fromEntries(
      (p === 'rb' ? RB_TYPES : TYPES).map(t => [t, null])
    ))
    setPage('versus-lobby')
  }

  if (page === 'splash') {
    return withGame(
      <>
      <Helmet>
        <link rel="canonical" href="https://build-a-player.com/" />
      </Helmet>
      {IS_APP ? (
        <AppHome sport="nfl" user={user} onStart={handleStart} onDepthChart={() => setPage('depth-chart')} onTakeover={openTakeover} takeoverRun={takeoverRun} onCareer={openCareer} career={career}
          onCompete={() => setPage('compete')} resume={competeOn ? { label: `Compete · pool ${cp.match.code}`, onClick: () => setPage('game') } : (gameMode && gameMode !== 'salarycap' && (simResult || Object.values(build).some(Boolean))) ? { label: `${position.toUpperCase()} · ${gameMode === 'all-time' ? 'All-Time' : gameMode === 'classic' ? 'Current' : gameMode}`, onClick: () => window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'play' })) } : null} />
      ) : APP_LOOK ? (
        <AppHome sport="nfl" user={user} onStart={handleStart} onDepthChart={() => setPage('depth-chart')}
          onTakeover={openTakeover} takeoverRun={takeoverRun} onCareer={openCareer} career={career}
          onCompete={() => setPage('compete')} resume={competeOn ? { label: `Compete · pool ${cp.match.code}`, onClick: () => setPage('game') } : (gameMode && gameMode !== 'salarycap' && (simResult || Object.values(build).some(Boolean))) ? { label: `${position.toUpperCase()} · ${gameMode === 'all-time' ? 'All-Time' : gameMode === 'classic' ? 'Current' : gameMode}`, onClick: () => window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'play' })) } : null}
          footer={<><SiteFeatures sport="nfl" /><SiteFooter sport="nfl" onDepthChart={() => setPage('depth-chart')} onWiki={openWiki} /></>} />
      ) : (
      <SplashScreen
        onStart={handleStart}
        onDepthChart={() => setPage('depth-chart')}
        onWiki={openWiki}
        onVersus={startVersus}
      />
      )}
      </>
    )
  }

  if (page === 'compete') {
    return withGame(
      <Suspense fallback={null}>
        <AppCompete cp={cp} sport="nfl" position={competePos} positions={POS_OPTIONS.filter(o => ['qb', 'rb', 'wr', 'te', 'db'].includes(o.pos))}
          onPosition={setCompetePos} onHome={() => setPage('splash')} onResumeBuild={() => setPage('game')}
          onPlayAgain={() => cp.join()} />
      </Suspense>
    )
  }

  if (page === 'career-intro') {
    return (
      <Suspense fallback={null}>
        <CareerIntro onStart={startCareerBuild} onClose={() => setPage('splash')} />
      </Suspense>
    )
  }
  if (page === 'career' && career) {
    return (
      <Suspense fallback={null}>
        <AppCareer career={career} setCareer={setCareer} user={user} onNewBuild={startCareerBuild} onExit={() => setPage('splash')} />
      </Suspense>
    )
  }

  // No run on the road: what Takeover is + your past runs, then a build
  if (page === 'takeover-intro') {
    return (
      <Suspense fallback={null}>
        <TakeoverIntro sport="nfl" teams={NFL_TEAMS} onStart={startTakeoverBuild} onClose={() => setPage('splash')} />
      </Suspense>
    )
  }
  if (page === 'takeover' && takeoverRun) {
    const pos = takeoverRun.pos
    const pools = { qb: QBS, rb: RBS, wr: WRS, te: TES, db: DBS }
    const attr = pos === 'db' ? DB_ATTR : pos === 'te' ? TE_ATTR : pos === 'wr' ? WR_ATTR : pos === 'rb' ? RB_ATTR : ATTR
    const ovrOf = b => pos === 'db' ? calcOVRDB(b) : pos === 'te' ? calcOVRTE(b) : pos === 'wr' ? calcOVRWR(b) : pos === 'rb' ? calcOVRRB(b) : calcOVR(b)
    return (
      <Suspense fallback={null}>
        <AppTakeover sport="nfl" run={takeoverRun} setRun={setTakeoverRun} user={user}
          pools={pools} types={{}} attrMap={attr} photoFor={p => nflHeadshot(HEADSHOTS[p.name])}
          calcOvr={ovrOf} teams={NFL_TEAMS} ratings={null}
          onNewBuild={startTakeoverBuild} onExit={() => setPage('splash')} />
      </Suspense>
    )
  }

  if (page === 'depth-chart') {
    return withGame(
      <Suspense fallback={null}>
        <DepthChart onBack={() => setPage('splash')} user={user} onlineCount={onlineCount} />
      </Suspense>
    )
  }

  if (page === 'versus-lobby') {
    return (
      <Suspense fallback={null}>
        <VersusLobby
          onJoin={handleVersusJoin}
          position={position}
          gameMode={gameMode || 'classic'}
          onBack={() => setPage('splash')}
          user={user}
          vsRecord={vsRecord}
          onSignIn={() => setShowAuth(true)}
          onProfile={() => { window.history.pushState({}, '', '/profile'); setPage('profile') }}
          onAbout={() => setPage('about')}
          onLeaderboard={() => setPage('leaderboard')}
        />
      </Suspense>
    )
  }

  if (page === 'versus-result') {
    return (
      <Suspense fallback={null}>
        <VersusResult
          myData={{ build, qb: savedSpinResult }}
          oppData={{ build: oppBuild, qb: oppQB, name: versusRoom?.oppName || 'Opponent' }}
          position={position}
          gameMode={gameMode || 'classic'}
          role={versusRoom?.role}
          channel={versusRoom?.channel}
          vsFinalResult={vsFinalResult}
          onResult={recordVsResult}
          onRematch={() => {
            faceoffFiredRef.current = false
            setBuild(Object.fromEntries(activeTypes.map(t => [t, null])))
            setOppBuild({})
            setOppQB(null)
            setVsFinalResult(null)
            setSavedSpinResult(null)
            setMobileView('spin')
            setSpinResetKey(k => k + 1)
            setPage('versus-game')
            window.scrollTo(0, 0)
          }}
          onExit={() => {
            cleanupVersusChannel(versusRoom?.channel)
            setVersusRoom(null)
            setPage('splash')
          }}
        />
      </Suspense>
    )
  }

  if (page === 'leaderboard') {
    return withGame(
      <Suspense fallback={null}>
        <Navbar {...navbarProps} />
        <LeaderboardPage key={position} onBack={() => { setPage(simResult ? 'sim' : 'game'); window.scrollTo({ top: 0, behavior: 'instant' }) }} currentUser={user} adsDisabled={adsDisabled} isRB={isRB} isWR={isWR} isTE={isTE} isDB={isDB} isOL={isOL} onPositionChange={setPosition} />
      </Suspense>
    )
  }

  if (page === 'shared' && sharedBuild) {
    return (
      <Suspense fallback={null}>
        <Navbar {...navbarProps} />
        <SharedBuildPage
          build={sharedBuild}
          types={sharedTypes}
          onPlay={() => {
            window.history.replaceState({}, '', window.location.pathname)
            setPage('splash')
          }}
        />
      </Suspense>
    )
  }

  if (page === 'about') {
    return withGame(
      <Suspense fallback={null}>
        <Navbar {...navbarProps} />
        <AboutPage onBack={() => { setPage(simResult ? 'sim' : 'game'); window.scrollTo({ top: 0, behavior: 'instant' }) }} onPrivacy={() => setPage('privacy')} />
      </Suspense>
    )
  }

  // The wiki is its own page: no game chrome, its own header and navigation
  if (page === 'wiki') {
    return (
      <Suspense fallback={null}>
        <Wiki onExit={() => { setPage('splash'); window.scrollTo({ top: 0, behavior: 'instant' }) }} />
      </Suspense>
    )
  }

  if (page === 'privacy') {
    return withGame(
      <Suspense fallback={null}>
        <Navbar {...navbarProps} />
        <PrivacyPage onBack={() => setPage('about')} />
      </Suspense>
    )
  }

  if (page === 'terms') {
    return withGame(
      <Suspense fallback={null}>
        <Navbar {...navbarProps} />
        <TermsPage onBack={() => setPage('about')} />
      </Suspense>
    )
  }

  if (page === 'profile' && user) {
    return withGame(
      <Suspense fallback={null}>
        <ProfilePage
          user={user}
          build={build}
          simResult={simResult}
          types={activeTypes}
          isRB={isRB}
          isWR={isWR}
          isTE={isTE}
          isDB={isDB}
          isOL={isOL}
          isPlus={isPlus}
          currentPool={activePool}
          isCustomMode={isCustomMode}
          onCustomModeChange={(val) => {
            setIsCustomMode(val)
            try { localStorage.setItem('bap_custom_mode', val ? '1' : '0') } catch {}
          }}
          onCustomRatingsChange={(ratings) => {
            setCustomRatings(ratings)
            try { localStorage.setItem('bap_custom_ratings', JSON.stringify(ratings)) } catch {}
          }}
          onThemeChange={(themeId) => {
            try { localStorage.setItem('bap_theme', themeId) } catch {}
            if (themeId === 'default') document.documentElement.removeAttribute('data-theme')
            else document.documentElement.setAttribute('data-theme', themeId)
          }}
          onBack={() => { window.history.back() }}
          onSignOut={() => { setUser(null); window.location.href = '/' }}
          onAdsDisabled={() => { setAdsDisabled(true); setIsSubscribed(true); enableAdFreeMode() }}
          onOpenCustomModal={() => setShowCustomModal(true)}
        />
        {showCustomModal && (
          <CustomRatingsModal
            isRB={isRB}
            isWR={isWR}
            isTE={isTE}
            isDB={isDB}
            isOL={isOL}
            gameMode={gameMode}
            pool={CUSTOM_POOLS[customPoolKey].current}
            poolCurrent={CUSTOM_POOLS[customPoolKey].current}
            poolLegends={CUSTOM_POOLS[customPoolKey].legends}
            onClose={() => setShowCustomModal(false)}
            onSave={(ratings) => {
              setCustomRatings(ratings)
              try { localStorage.setItem('bap_custom_ratings', JSON.stringify(ratings)) } catch {}
            }}
            build={build}
            buildTypes={activeTypes}
            onAddToBuild={(p, playerOverrides, attrType) => {
              sandboxTainted.current = true
              const photo = HEADSHOTS[p.name] ? `${HEADSHOT_BASE}/${HEADSHOTS[p.name]}.webp` : null
              const chipData = {
                type: attrType,
                val: playerOverrides?.[attrType] ?? p.attrs?.[attrType] ?? 5,
                qb: p.short || p.name,
                qbFull: p.name,
                teamColor: p.color,
                teamColor2: p.color2,
                skinColor: p.skin,
                number: p.number,
                team: p.team,
                captain: p.captain ?? false,
                sandbox: true,
                photo,
              }
              setBuild(prev => ({ ...prev, [attrType]: chipData }))
              setShowCustomModal(false)
            }}
            onAddAllToBuild={(p, playerOverrides) => {
              sandboxTainted.current = true
              const photo = HEADSHOTS[p.name] ? `${HEADSHOT_BASE}/${HEADSHOTS[p.name]}.webp` : null
              setBuild(prev => {
                const next = { ...prev }
                activeTypes.forEach(attrType => {
                  if (!prev[attrType]) {
                    next[attrType] = {
                      type: attrType,
                      val: playerOverrides?.[attrType] ?? p.attrs?.[attrType] ?? 5,
                      qb: p.short || p.name,
                      qbFull: p.name,
                      teamColor: p.color,
                      teamColor2: p.color2,
                      skinColor: p.skin,
                      number: p.number,
                      team: p.team,
                      captain: p.captain ?? false,
                      sandbox: true,
                      photo,
                    }
                  }
                })
                return next
              })
              setShowCustomModal(false)
            }}
          />
        )}
      </Suspense>
    )
  }

  // Salary Cap (QB): the day's grid; confirm plays the season
  if (page === 'salarycap') {
    return (
      <Suspense fallback={null}>
        <Navbar {...navbarProps} />
        <QBSalaryCap user={user} initialDateStr={salaryReturnDate} onConfirm={handleQBSalaryConfirm}
          onBack={() => { setGameMode(null); setPage('splash') }} />
      </Suspense>
    )
  }

  if (page === 'sim' && simResult) {
    return (
      <Suspense fallback={null}>
        <Navbar {...navbarProps} />
        <SimPage
          result={simResult}
          build={build}
          types={activeTypes}
          replay={simReplaying || (gameMode === 'salarycap' && salaryResults)}
          adsDisabled={adsDisabled}
          isRB={isRB}
          isWR={isWR}
          isTE={isTE}
          isDB={isDB}
          isOL={isOL}
          onBack={() => { setPage(gameMode === 'salarycap' ? 'salarycap' : 'game'); window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' }) }}
          onReset={() => { if (gameMode === 'salarycap') { setPage('salarycap'); window.scrollTo({ top: 0, behavior: 'instant' }); return } handleReset(); setPage('game'); window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' }) }}
          simFn={(IS_APP || APP_LOOK) && gameMode !== 'salarycap' ? simFor : null}
          onFinal={(IS_APP || APP_LOOK) && gameMode !== 'salarycap' ? commitSeason : null}
          pool={displayPool}
          userName={getUsername(user) || 'Guest'}
        />
        {saveToast && (
          <div className={`save-toast save-toast--${saveToast.type}`} onClick={() => setSaveToast(null)}>
            {saveToast.type === 'saved' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
            {saveToast.msg}
          </div>
        )}
      </Suspense>
    )
  }

  return IS_APP ? shell(null) : renderGame(false)
}
