import { useState, useCallback, useRef, useEffect, useLayoutEffect, lazy, Suspense } from 'react' // v2
import Navbar from './components/Navbar'
import { watchAdRail } from './utils/adRail'
import SpinScreen from './components/SpinScreen'
import Silhouette from './components/Silhouette'
import ReportCard from './components/ReportCard'
import TeamPickerModal from './components/TeamPickerModal'
import AuthModal from './components/AuthModal'
import SplashScreen from './components/SplashScreen'
import { decodeBuild } from './utils/shareUrl'

// Lazy-loaded pages — only downloaded when the user actually navigates there
const SimPage        = lazy(() => import('./components/SimPage'))
const AboutPage      = lazy(() => import('./components/AboutPage'))
const PrivacyPage    = lazy(() => import('./components/PrivacyPage'))
const TermsPage      = lazy(() => import('./components/TermsPage'))
const SharedBuildPage= lazy(() => import('./components/SharedBuildPage'))
const DepthChart     = lazy(() => import('./components/DepthChart'))
const ProfilePage    = lazy(() => import('./components/ProfilePage'))
const LeaderboardPage= lazy(() => import('./components/LeaderboardPage'))
const VersusLobby    = lazy(() => import('./components/VersusLobby'))
const VersusResult   = lazy(() => import('./components/VersusResult'))
import { TYPES, LITE_TYPES, QBS } from './data/qbs'
import { RBS, RB_TYPES, RB_LITE_TYPES } from './data/rbs'
import { WRS, WR_TYPES, WR_LITE_TYPES, WR_CATEGORIES, WR_ATTR } from './data/wrs'
import { WR_LEGENDS } from './data/wr-legends'
import { TES, TE_TYPES, TE_LITE_TYPES, TE_CATEGORIES, TE_ATTR } from './data/tes'
import { DBS, DB_TYPES, DB_LITE_TYPES, DB_CATEGORIES, DB_ATTR } from './data/dbs'
import { ALLTIME_RATINGS } from './data/nfl-teams'
import { LEGENDS, LEGEND_TYPES } from './data/legends'
import { RB_LEGENDS } from './data/rb-legends'
import HEADSHOTS from './data/headshots.json'
import { runSimulation, getArchetype, calcOVR, runRBSimulation, calcOVRRB, getArchetypeRB, runWRSimulation, calcOVRWR, getArchetypeWR, runTESimulation, calcOVRTE, getArchetypeTE, runDBSimulation, calcOVRDB, getArchetypeDB, HEADSHOT_BASE } from './utils/simulation'
import { supabase, rtSupabase } from './lib/supabase'
import { track } from './lib/track'
import CustomRatingsModal from './components/CustomRatingsModal'

const _dd = arr => { const s = new Set(); return arr.filter(p => { const k = `${p.name}|${p.team}`; if (s.has(k)) return false; s.add(k); return true }) }
const _bt = (a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name)
const CUSTOM_QB_POOL = _dd([...QBS, ...LEGENDS]).sort(_bt)
const CUSTOM_RB_POOL = _dd([...RBS, ...RB_LEGENDS]).sort(_bt)
const CUSTOM_WR_POOL = _dd([...WRS, ...WR_LEGENDS]).sort(_bt)
const CUSTOM_TE_POOL = [...TES].sort(_bt)
const CUSTOM_DB_POOL = [...DBS].sort(_bt)

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

const _saved = (() => {
  if (_sharedData || _isPrivacy || _isAbout || _isProfile) return null
  try { return JSON.parse(localStorage.getItem('bap_progress')) } catch { return null }
})()

function hideVideoAds() {
  const sel = '[id*="corner_video"],[id*="floating_video"],[id*="corner-video"],[class*="corner_video"],[class*="floating_video"],[id^="pw-oop-video"],[id^="pw-oop-corner"],[id^="pw-oop-interstitial"],[id*="interstitial"],[class*="interstitial"],[id*="video_corner"],[id*="vid_corner"],[class*="video_corner"]'
  document.querySelectorAll(sel).forEach(el => el.style.setProperty('display', 'none', 'important'))
  document.querySelectorAll('div[id^="pw-"]').forEach(el => {
    const id = el.id.toLowerCase()
    if (id.includes('video') || id.includes('corner') || id.includes('interstitial')) el.style.setProperty('display', 'none', 'important')
  })
}

const RAMP_AD_UNITS = ['bottom_rail', 'corner_ad_video', 'standard_iab', 'standard_iab_cntr1', 'video_bottom_rail']
const RAMP_FORCE_OFF = RAMP_AD_UNITS.map(unit => ({ unit, force: 'off' }))

function enableAdFreeMode() {
  document.documentElement.classList.add('ads-hidden')
  window.ramp = window.ramp || {}
  window.ramp.forceUnits = RAMP_FORCE_OFF
  window.ramp.que = window.ramp.que || []
  window.ramp.que.push(() => {
    window.ramp.forceUnits = RAMP_FORCE_OFF
    try { window.ramp.destroyUnits(RAMP_AD_UNITS) } catch {}
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
try { if (localStorage.getItem('bap_subscribed') === '1' || localStorage.getItem('bap_ads_off') === '1') enableAdFreeMode() } catch {}

export default function App() {
  const [page, setPage]               = useState(_sharedData ? 'shared' : _isPrivacy ? 'privacy' : _isTerms ? 'terms' : _isProfile ? 'profile' : _isAbout ? 'about' : (_saved?.gameMode ? 'game' : 'splash'))
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
  const [savedSpinResult, setSavedSpinResult] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bap_spin_result')) } catch { return null }
  })
  const [spinPhase, setSpinPhase] = useState('idle')
  const [adsDisabled, setAdsDisabled] = useState(false)
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
  const [showSandboxWarning, setShowSandboxWarning] = useState(false)
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
  const faceoffFiredRef = useRef(false)
  // Latest build/user/position for handlers set up once (heartbeat timers, etc.)
  // that would otherwise close over stale values.
  const vsResultRef = useRef({ build: {}, user: null, position: 'qb' })
  useEffect(() => {
    vsResultRef.current = { build, user, position }
  })

  // Once sandbox is ever turned on during a build session, taint it permanently
  // until reset — prevents toggle-on → edit → toggle-off → simulate exploit
  const sandboxTainted = useRef(isCustomMode)
  useEffect(() => {
    if (isCustomMode) sandboxTainted.current = true
  }, [isCustomMode])

  useEffect(() => {
    hideVideoAds()
    const obs = new MutationObserver(hideVideoAds)
    obs.observe(document.body, { childList: true, subtree: true })
    const interval = setInterval(hideVideoAds, 1000)
    setTimeout(() => clearInterval(interval), 15000)
    return () => { obs.disconnect(); clearInterval(interval) }
  }, [])

  // Keep --ad-h in sync with the bottom-rail ad (rises with it, drops when closed)
  useEffect(() => watchAdRail(), [])

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', page === 'splash' ? '#080b09' : page === 'depth-chart' ? '#111318' : '#090a0d')
  }, [page])

  useEffect(() => {
    window.ramp?.que?.push(() => {
      window.ramp.spaNewPage()
      if (page === 'splash') try { window.ramp.destroyUnits(RAMP_AD_UNITS) } catch {}
    })
  }, [page])

  useEffect(() => {
    if (!gameMode) return
    try { localStorage.setItem('bap_progress', JSON.stringify({ gameMode, position, build })) } catch {}
  }, [build, gameMode, position])

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
      if (changed) window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  // Dedicated URLs for the simulate/season/playoffs/final flow and the
  // leaderboard — lets Playwire apply ad rules by path. Purely a URL sync
  // layer; doesn't touch page state, the existing ramp.spaNewPage() calls,
  // or any in-app navigation logic.
  useEffect(() => {
    const targetPath = (page === 'sim' && simResult) ? '/simulate' : page === 'leaderboard' ? '/leaderboard' : null
    if (targetPath) {
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath)
      }
    } else if (window.location.pathname === '/simulate' || window.location.pathname === '/leaderboard') {
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
  const activeTypes = isDB ? (gameMode === 'lite' ? DB_LITE_TYPES : DB_TYPES) : isTE ? (gameMode === 'lite' ? TE_LITE_TYPES : TE_TYPES) : isWR ? (gameMode === 'lite' ? WR_LITE_TYPES : WR_TYPES) : gameMode === 'lite' ? (isRB ? RB_LITE_TYPES : LITE_TYPES) : (gameMode === 'all-time' && !isRB) ? LEGEND_TYPES : (isRB ? RB_TYPES : TYPES)
  const activePool  = isDB ? DBS : isTE ? TES : isWR ? (gameMode === 'all-time' ? WR_LEGENDS : WRS) : gameMode === 'all-time' ? (isRB ? RB_LEGENDS : LEGENDS) : (isRB ? RBS : QBS)
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
      if (!isPlus) { document.documentElement.removeAttribute('data-theme'); return }
      const t = localStorage.getItem('bap_theme')
      if (t && t !== 'default') document.documentElement.setAttribute('data-theme', t)
      else document.documentElement.removeAttribute('data-theme')
    } catch {}
  }, [isPlus])

  const customModeKey = isDB ? 'db' : isTE ? 'te' : isWR ? 'wr' : `${isRB ? 'rb' : 'qb'}${gameMode === 'all-time' ? '_legends' : ''}`
  const displayPool = (isCustomMode && customRatings[customModeKey])
    ? activePool.map(p => {
        const override = customRatings[customModeKey][`${p.name}|${p.team}`]
        return override ? { ...p, attrs: { ...p.attrs, ...override } } : p
      })
    : activePool



  const activeDragRef = useRef(activeDrag)
  useLayoutEffect(() => { activeDragRef.current = activeDrag }, [activeDrag])

  const handleStart = useCallback((mode, pos = 'qb') => {
    setPosition(pos)
    const isRBMode = pos === 'rb'
    const isWRMode = pos === 'wr'
    const isTEMode = pos === 'te'
    const isDBMode = pos === 'db'
    const types = isDBMode ? (mode === 'lite' ? DB_LITE_TYPES : DB_TYPES) : isTEMode ? (mode === 'lite' ? TE_LITE_TYPES : TE_TYPES) : isWRMode ? (mode === 'lite' ? WR_LITE_TYPES : WR_TYPES) : mode === 'lite' ? (isRBMode ? RB_LITE_TYPES : LITE_TYPES) : (isRBMode ? RB_TYPES : TYPES)
    setGameMode(mode)
    setBuild(Object.fromEntries(types.map(t => [t, null])))
    setActiveCategory('physical')
    setSavedSpinResult(null)
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


  const handleMVPWon = useCallback(async (isAllTime, isRBMode = false) => {
    if (!user || !supabase) return
    const col = isRBMode
      ? (isAllTime ? 'alltime_opoys' : 'classic_opoys')
      : (isAllTime ? 'alltime_mvps'  : 'classic_mvps')
    const { data } = await supabase.from('accounts')
      .select('classic_mvps,alltime_mvps,classic_opoys,alltime_opoys').eq('id', user.id).single()
    const current = data?.[col] ?? 0
    const q = data
      ? supabase.from('accounts').update({ [col]: current + 1 }).eq('id', user.id)
      : supabase.from('accounts').insert({ id: user.id, [col]: 1 })
    q.then(({ error }) => { if (error) console.error('[award] failed to save award:', error) })
  }, [user])

  const handleReset = useCallback(() => {
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
  }, [activeTypes, isCustomMode])

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
    if (on) {
      setShowSandboxWarning(true)
    } else {
      try { localStorage.setItem('bap_custom_mode', '0') } catch {}
      setIsCustomMode(false)
    }
  }, [])

  const confirmSandbox = useCallback(() => {
    setIsCustomMode(true)
    try { localStorage.setItem('bap_custom_mode', '1') } catch {}
    setShowSandboxWarning(false)
  }, [])

  const showSaveToast = useCallback((type, msg) => {
    setSaveToast({ type, msg })
    clearTimeout(saveToastTimer.current)
    saveToastTimer.current = setTimeout(() => setSaveToast(null), 4500)
  }, [])

  const handleTeamPicked = useCallback((team) => {
    setShowTeamPicker(false)
    const atRatings = ALLTIME_RATINGS[team.short]
    const effectiveTeam = gameMode === 'all-time' && atRatings
      ? { ...team, off: atRatings.off, def: atRatings.def, isAllTime: true }
      : team
    const result = isDB
      ? runDBSimulation(build, effectiveTeam)
      : isTE
        ? runTESimulation(build, activeTypes, effectiveTeam, gameMode === 'all-time')
        : isWR
          ? runWRSimulation(build, activeTypes, effectiveTeam, gameMode === 'all-time')
          : isRB
            ? runRBSimulation(build, activeTypes, effectiveTeam, gameMode === 'all-time')
            : runSimulation(build, activeTypes, effectiveTeam, gameMode === 'all-time')
    setSimResult(result)
    track('simulate', { position, gameMode, userId: user?.id ?? null })
    if (!user) {
      showSaveToast('no-auth', 'Sign in to save your stats')
    } else if (isCustomMode || sandboxTainted.current) {
      showSaveToast('custom', 'Custom mode — results not saved')
    } else if (!supabase) {
      console.warn('[build-a-player] sim result not saved — supabase not configured')
    } else {
      const arch = isDB
        ? getArchetypeDB(result.ovr, build, DB_TYPES)
        : isTE
          ? getArchetypeTE(result.ovr, build, activeTypes)
          : isWR
            ? getArchetypeWR(result.ovr, build, activeTypes)
            : isRB
              ? getArchetypeRB(result.ovr, build, activeTypes)
              : getArchetype(result.ovr, build, activeTypes)
      supabase.from('simulations').insert({
        user_id: user.id,
        username: user.user_metadata?.username || user.email?.split('@')[0] || 'Player',
        ovr: result.ovr,
        archetype: arch,
        game_mode: isDB ? `db-${gameMode || 'classic'}` : isTE ? `te-${gameMode || 'classic'}` : isWR ? `wr-${gameMode || 'classic'}` : isRB ? `rb-${gameMode || 'classic'}` : gameMode,
        wins: result.wins ?? null,
        losses: result.losses ?? null,
        season_pass_yds: isDB ? result.seasonTackles : (isWR || isTE) ? result.seasonRecYds : isRB ? result.seasonRushYds : result.seasonPassYds,
        season_tds: isDB ? result.seasonINTs : (isWR || isTE) ? result.seasonRecTDs : isRB ? (result.seasonRushTDs + result.seasonRecTDs) : result.seasonTDs,
        season_ints: isDB ? result.seasonPBUs : (isWR || isTE) ? result.seasonRecs : isRB ? null : result.seasonINTs,
        season_comp_pct: isDB ? null : (isWR || isTE) ? result.seasonTargets : isRB ? null : result.seasonCompPct,
        season_rating: (isDB || isRB || isWR || isTE) ? null : result.seasonRating,
        playoffs: result.playoffs,
        champion: result.sbResult?.won ?? false,
        build: Object.fromEntries(
          activeTypes.filter(t => build[t]).map(t => [t, {
            qb: build[t].qbFull || build[t].name, team: build[t].team, val: build[t].val,
          }])
        ),
      }).then(({ error }) => {
        if (error) {
          console.error('[build-a-player] simulation save failed:', error)
          showSaveToast('error', `Save failed: ${error.message}`)
        } else {
          showSaveToast('saved', 'Saved to profile!')
        }
      })
    }
    setSimReplaying(false)
    setPage('sim')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [build, activeTypes, user, gameMode, position, showSaveToast])

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
    if (!ch) return
    if (ch._bc) { ch.close() }
    else { try { (rtSupabase || supabase).removeChannel(ch) } catch {} }
  }

  async function recordVsResult(result) {
    setVsRecord(prev => result === 'win'
      ? { wins: (prev?.wins ?? 0) + 1, losses: prev?.losses ?? 0 }
      : { wins: prev?.wins ?? 0, losses: (prev?.losses ?? 0) + 1 })
    if (!supabase || !user) return
    const { build: b, position: pos } = vsResultRef.current
    const ovr = isDB ? calcOVRDB(b) : isTE ? calcOVRTE(b) : isWR ? calcOVRWR(b) : isRB ? calcOVRRB(b) : calcOVR(b)
    try {
      await supabase.from('vs_results').insert({
        user_id: user.id,
        username: user.user_metadata?.username || user.email?.split('@')[0],
        result, ovr: ovr || null, position: pos,
        match_type: versusRoom?.matchType ?? null,
      })
    } catch {}
  }

  async function recordVsForfeiture() {
    setVsRecord(prev => ({ wins: prev?.wins ?? 0, losses: (prev?.losses ?? 0) + 1 }))
    if (!supabase || !user) return
    const { build: b, position: pos } = vsResultRef.current
    const ovr = isDB ? calcOVRDB(b) : isTE ? calcOVRTE(b) : isWR ? calcOVRWR(b) : isRB ? calcOVRRB(b) : calcOVR(b)
    try {
      await supabase.from('vs_results').insert({
        user_id: user.id,
        username: user.user_metadata?.username || user.email?.split('@')[0],
        result: 'forfeit', ovr: ovr || null, position: pos,
        match_type: versusRoom?.matchType ?? null,
      })
    } catch {}
  }

  // Opponent presumed gone — award the local player a win and bail to the lobby.
  function handleOppGone(ch) {
    setVsRecord(prev => ({ wins: (prev?.wins ?? 0) + 1, losses: prev?.losses ?? 0 }))
    if (supabase && user) {
      const { build: b, position: pos } = vsResultRef.current
      const ovr = isDB ? calcOVRDB(b) : isTE ? calcOVRTE(b) : isWR ? calcOVRWR(b) : isRB ? calcOVRRB(b) : calcOVR(b)
      if (ovr > 0) {
        supabase.from('vs_results').insert({
          user_id: user.id,
          username: user.user_metadata?.username || user.email?.split('@')[0],
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
    // BroadcastChannel fallback has no presence equivalent).
    if (!channel._bc) {
      channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (!leftPresences.some(p => p.vid === oppId)) return
        handleOppGone(channel)
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
          const name = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Your Build'
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

  if (page === 'splash') {
    return (
      <SplashScreen
        onStart={handleStart}
        onDepthChart={() => setPage('depth-chart')}
        onVersus={(pos) => {
          const p = pos || 'qb'
          localStorage.setItem('lastPosition', p)
          setPosition(p)
          setGameMode('classic')
          setBuild(Object.fromEntries(
            (p === 'rb' ? RB_TYPES : TYPES).map(t => [t, null])
          ))
          setPage('versus-lobby')
        }}
      />
    )
  }

  if (page === 'depth-chart') {
    return (
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

  const navbarProps = {
    onReset: handleReset,
    onAbout: () => setPage('about'),
    onHome: handleHome,
    onSignIn: () => setShowAuth(true),
    onProfile: () => { window.history.pushState({}, '', '/profile'); setPage('profile') },
    onLeaderboard: () => setPage('leaderboard'),
    onSwitchPosition: (pos) => { localStorage.setItem('lastPosition', pos); handleHome() },
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
    isPlus,
  }

  if (page === 'leaderboard') {
    return (
      <Suspense fallback={null}>
        <Navbar {...navbarProps} />
        <LeaderboardPage onBack={() => { setPage(simResult ? 'sim' : 'game'); window.scrollTo({ top: 0, behavior: 'instant' }) }} currentUser={user} adsDisabled={adsDisabled} isRB={isRB} isWR={isWR} isTE={isTE} isDB={isDB} />
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
    return (
      <Suspense fallback={null}>
        <Navbar {...navbarProps} />
        <AboutPage onBack={() => { setPage(simResult ? 'sim' : 'game'); window.scrollTo({ top: 0, behavior: 'instant' }) }} onPrivacy={() => setPage('privacy')} />
      </Suspense>
    )
  }

  if (page === 'privacy') {
    return (
      <Suspense fallback={null}>
        <Navbar {...navbarProps} />
        <PrivacyPage onBack={() => setPage('about')} />
      </Suspense>
    )
  }

  if (page === 'terms') {
    return (
      <Suspense fallback={null}>
        <Navbar {...navbarProps} />
        <TermsPage onBack={() => setPage('about')} />
      </Suspense>
    )
  }

  if (page === 'profile' && user) {
    return (
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
            gameMode={gameMode}
            pool={isDB ? CUSTOM_DB_POOL : isTE ? CUSTOM_TE_POOL : isWR ? CUSTOM_WR_POOL : isRB ? CUSTOM_RB_POOL : CUSTOM_QB_POOL}
            onClose={() => setShowCustomModal(false)}
            onSave={(ratings) => {
              setCustomRatings(ratings)
              try { localStorage.setItem('bap_custom_ratings', JSON.stringify(ratings)) } catch {}
            }}
            build={build}
            buildTypes={activeTypes}
            onAddToBuild={(p, playerOverrides, attrType) => {
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
                photo,
              }
              setBuild(prev => ({ ...prev, [attrType]: chipData }))
              setShowCustomModal(false)
            }}
            onAddAllToBuild={(p, playerOverrides) => {
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

  if (page === 'sim' && simResult) {
    return (
      <Suspense fallback={null}>
        <Navbar {...navbarProps} />
        <SimPage
          result={simResult}
          build={build}
          types={activeTypes}
          replay={simReplaying}
          adsDisabled={adsDisabled}
          isRB={isRB}
          isWR={isWR}
          isTE={isTE}
          isDB={isDB}
          onMVPWon={handleMVPWon}
          onBack={() => { setPage('game'); window.scrollTo({ top: 0, behavior: 'instant' }) }}
          onReset={() => { handleReset(); setPage('game'); window.scrollTo({ top: 0, behavior: 'instant' }) }}
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

  const filledCount = activeTypes.filter(t => build[t]).length

  return (
    <>
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
          qbPool={displayPool}
          savedResult={savedSpinResult}
          onSaveResult={setSavedSpinResult}
          onPhaseChange={setSpinPhase}
          gameKey={gameKey}
          onReset={handleReset}
          adsDisabled={adsDisabled}
          isRB={isRB}
          isWR={isWR}
          isTE={isTE}
          isDB={isDB}
          playerLabel={isDB ? 'DB' : isTE ? 'TE' : isWR ? 'WR' : undefined}
          attrMap={isDB ? DB_ATTR : isTE ? TE_ATTR : isWR ? WR_ATTR : undefined}
          categoriesData={isDB ? DB_CATEGORIES : isTE ? TE_CATEGORIES : isWR ? WR_CATEGORIES : undefined}
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
          categoriesData={isDB ? DB_CATEGORIES : isTE ? TE_CATEGORIES : isWR ? WR_CATEGORIES : undefined}
          attrMap={isDB ? DB_ATTR : isTE ? TE_ATTR : isWR ? WR_ATTR : undefined}
          isPlus={isPlus}
          isCustomMode={isCustomMode}
          onOpenCustomModal={() => setShowCustomModal(true)}
          onSandboxToggle={handleSandboxToggle}
        />

        <div className="right-panel-wrap">
          <ReportCard
            build={build}
            onSimulate={page === 'versus-game'
              ? handleFaceoff
              : handleSimulate}
            onReset={handleReset}
            types={activeTypes}
            hasResult={page === 'versus-game' ? false : !!simResult}
            isRB={isRB}
            isWR={isWR}
            isTE={isTE}
            isDB={isDB}
            attrMap={isDB ? DB_ATTR : isTE ? TE_ATTR : isWR ? WR_ATTR : undefined}
            isPlus={isPlus}
            isCustomMode={isCustomMode}
            onOpenCustomModal={() => setShowCustomModal(true)}
            onSandboxToggle={handleSandboxToggle}
            versusMode={page === 'versus-game'}
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


      {/* Mobile bottom tab bar */}
      <nav className="mobile-tab-bar">
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
      </nav>

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onAuth={setUser}
        />
      )}

      {showTeamPicker && (
        <TeamPickerModal onSelect={handleTeamPicked} isPlus={isCustomMode} build={build} />
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

      {saveToast && (
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

      {showCustomModal && (isPlus || isCustomMode) && (
        <CustomRatingsModal
          isRB={isRB}
          isWR={isWR}
          isTE={isTE}
          isDB={isDB}
          gameMode={gameMode}
          pool={isDB ? CUSTOM_DB_POOL : isTE ? CUSTOM_TE_POOL : isWR ? CUSTOM_WR_POOL : isRB ? CUSTOM_RB_POOL : CUSTOM_QB_POOL}
          onClose={() => setShowCustomModal(false)}
          onSave={(ratings) => {
            setCustomRatings(ratings)
            try { localStorage.setItem('bap_custom_ratings', JSON.stringify(ratings)) } catch {}
          }}
          build={build}
          buildTypes={activeTypes}
          onAddToBuild={(p, playerOverrides, attrType) => {
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
              photo,
            }
            setBuild(prev => ({ ...prev, [attrType]: chipData }))
            setMobileView('build')
            setShowCustomModal(false)
          }}
          onAddAllToBuild={(p, playerOverrides) => {
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
}
