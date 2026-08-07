import { useState, useCallback, useRef, useEffect, useLayoutEffect, lazy, Suspense } from 'react' // v2
import Navbar from './components/Navbar'
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
const SharedBuildPage= lazy(() => import('./components/SharedBuildPage'))
const DepthChart     = lazy(() => import('./components/DepthChart'))
const ProfilePage    = lazy(() => import('./components/ProfilePage'))
const LeaderboardPage= lazy(() => import('./components/LeaderboardPage'))
const VersusLobby    = lazy(() => import('./components/VersusLobby'))
const VersusResult   = lazy(() => import('./components/VersusResult'))
import { TYPES, LITE_TYPES, QBS } from './data/qbs'
import { RBS, RB_TYPES, RB_LITE_TYPES } from './data/rbs'
import { WRS, WR_TYPES, WR_LITE_TYPES, WR_CATEGORIES, WR_ATTR } from './data/wrs'
import { ALLTIME_RATINGS } from './data/nfl-teams'
import { LEGENDS, LEGEND_TYPES } from './data/legends'
import { RB_LEGENDS } from './data/rb-legends'
import HEADSHOTS from './data/headshots.json'
import { runSimulation, getArchetype, runRBSimulation, calcOVRRB, getArchetypeRB, runWRSimulation, calcOVRWR, getArchetypeWR, HEADSHOT_BASE } from './utils/simulation'
import { supabase } from './lib/supabase'
import CustomRatingsModal from './components/CustomRatingsModal'

const _dd = arr => { const s = new Set(); return arr.filter(p => { const k = `${p.name}|${p.team}`; if (s.has(k)) return false; s.add(k); return true }) }
const _bt = (a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name)
const CUSTOM_QB_POOL = _dd([...QBS, ...LEGENDS]).sort(_bt)
const CUSTOM_RB_POOL = _dd([...RBS, ...RB_LEGENDS]).sort(_bt)
const CUSTOM_WR_POOL = [...WRS].sort(_bt)

// Detect shared build at module load time — before any React rendering
let _sharedData = null
try {
  const _enc = new URLSearchParams(window.location.search).get('b')
  if (_enc) _sharedData = decodeBuild(_enc)
} catch {}

const _isPrivacy = window.location.pathname === '/privacy'
const _isProfile = !_sharedData && !_isPrivacy && window.location.pathname === '/profile'
const _isAbout   = !_sharedData && !_isPrivacy && !_isProfile && new URLSearchParams(window.location.search).has('about')

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
  const [page, setPage]               = useState(_sharedData ? 'shared' : _isPrivacy ? 'privacy' : _isProfile ? 'profile' : _isAbout ? 'about' : (_saved?.gameMode ? 'game' : 'splash'))
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
    const bodyObs = new MutationObserver(() => { attachElObs(); measure() })
    bodyObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-pw-status', 'style'] })
    return () => { bodyObs.disconnect(); if (elObs) elObs.disconnect() }
  }, [])

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
      if (window.location.pathname !== '/profile') {
        setPage(prev => prev === 'profile' ? 'game' : prev)
        window.scrollTo({ top: 0, behavior: 'instant' })
      }
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

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
  const activeTypes = isWR ? (gameMode === 'lite' ? WR_LITE_TYPES : WR_TYPES) : gameMode === 'lite' ? (isRB ? RB_LITE_TYPES : LITE_TYPES) : (gameMode === 'all-time' && !isRB) ? LEGEND_TYPES : (isRB ? RB_TYPES : TYPES)
  const activePool  = isWR ? WRS : gameMode === 'all-time' ? (isRB ? RB_LEGENDS : LEGENDS) : (isRB ? RBS : QBS)
  const isPlus      = isSubscribed

  // Theme must be declared after isPlus
  useEffect(() => {
    try {
      if (!isPlus) { document.documentElement.removeAttribute('data-theme'); return }
      const t = localStorage.getItem('bap_theme')
      if (t && t !== 'default') document.documentElement.setAttribute('data-theme', t)
      else document.documentElement.removeAttribute('data-theme')
    } catch {}
  }, [isPlus])

  const displayPool = (isCustomMode && customRatings[isRB ? 'rb' : 'qb'])
    ? activePool.map(p => {
        const override = customRatings[isRB ? 'rb' : 'qb'][`${p.name}|${p.team}`]
        return override ? { ...p, attrs: { ...p.attrs, ...override } } : p
      })
    : activePool



  const activeDragRef = useRef(activeDrag)
  useLayoutEffect(() => { activeDragRef.current = activeDrag }, [activeDrag])

  const handleStart = useCallback((mode, pos = 'qb') => {
    setPosition(pos)
    const isRBMode = pos === 'rb'
    const isWRMode = pos === 'wr'
    const types = isWRMode ? (mode === 'lite' ? WR_LITE_TYPES : WR_TYPES) : mode === 'lite' ? (isRBMode ? RB_LITE_TYPES : LITE_TYPES) : (isRBMode ? RB_TYPES : TYPES)
    setGameMode(mode)
    setBuild(Object.fromEntries(types.map(t => [t, null])))
    setActiveCategory('physical')
    setSavedSpinResult(null)
    sandboxTainted.current = isCustomMode
    setPage('game')
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
    const result = isWR
      ? runWRSimulation(build, activeTypes, effectiveTeam, gameMode === 'all-time')
      : isRB
        ? runRBSimulation(build, activeTypes, effectiveTeam, gameMode === 'all-time')
        : runSimulation(build, activeTypes, effectiveTeam, gameMode === 'all-time')
    setSimResult(result)
    if (!user) {
      showSaveToast('no-auth', 'Sign in to save your stats')
    } else if (isCustomMode || sandboxTainted.current) {
      showSaveToast('custom', 'Custom mode — results not saved')
    } else if (!supabase) {
      console.warn('[build-a-player] sim result not saved — supabase not configured')
    } else {
      const arch = isWR
        ? getArchetypeWR(result.ovr, build, activeTypes)
        : isRB
          ? getArchetypeRB(result.ovr, build, activeTypes)
          : getArchetype(result.ovr, build, activeTypes)
      supabase.from('simulations').insert({
        user_id: user.id,
        username: user.user_metadata?.username || user.email?.split('@')[0] || 'Player',
        ovr: result.ovr,
        archetype: arch,
        game_mode: isWR ? `wr-${gameMode || 'classic'}` : isRB ? `rb-${gameMode || 'classic'}` : gameMode,
        wins: result.wins,
        losses: result.losses,
        season_pass_yds: isWR ? result.seasonRecYds : isRB ? result.seasonRushYds : result.seasonPassYds,
        season_tds: isWR ? result.seasonRecTDs : isRB ? (result.seasonRushTDs + result.seasonRecTDs) : result.seasonTDs,
        season_ints: isWR ? result.seasonRecs : isRB ? null : result.seasonINTs,
        season_comp_pct: isWR ? result.seasonTargets : isRB ? null : result.seasonCompPct,
        season_rating: (isRB || isWR) ? null : result.seasonRating,
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
  }, [build, activeTypes, user, gameMode, showSaveToast])

  const handleHome = useCallback(() => {
    setPage('splash')
    setGameMode(null)
    setBuild({})
    setSimResult(null)
    setActiveDrag(null)
    setSpinResetKey(0)
    setMobileView('spin')
    sandboxTainted.current = isCustomMode
  }, [isCustomMode])

  const handleVersusJoin = useCallback(({ code, role, oppId, oppName, channel }) => {
    // Subscribe to opponent build broadcasts before setting state
    channel.on('broadcast', { event: 'vs_build' }, ({ payload }) => {
      setOppBuild(payload.build || {})
      setOppQB(payload.qb || null)
    })
    setVersusRoom({ code, role, oppId, oppName, channel })
    setOppBuild({})
    setOppQB(null)
    setBuild(Object.fromEntries(activeTypes.map(t => [t, null])))
    setActiveCategory('physical')
    setSavedSpinResult(null)
    setSimResult(null)
    setMobileView('spin')
    setSpinResetKey(k => k + 1)
    setIsCustomMode(false)
    setPage('versus-game')
    window.scrollTo(0, 0)
  }, [activeTypes])

  // Broadcast my build + qb to the versus channel whenever they change
  useEffect(() => {
    if (!versusRoom?.channel || page !== 'versus-game') return
    versusRoom.channel.send({
      type: 'broadcast', event: 'vs_build',
      payload: { build, qb: savedSpinResult },
    }).catch(() => {})
  }, [build, savedSpinResult, versusRoom, page])

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
          onRematch={() => {
            setBuild(Object.fromEntries(activeTypes.map(t => [t, null])))
            setOppBuild({})
            setOppQB(null)
            setSavedSpinResult(null)
            setMobileView('spin')
            setSpinResetKey(k => k + 1)
            setPage('versus-game')
            window.scrollTo(0, 0)
          }}
          onExit={() => {
            if (versusRoom?.channel) supabase.removeChannel(versusRoom.channel)
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
    isPlus,
  }

  if (page === 'leaderboard') {
    return (
      <Suspense fallback={null}>
        <Navbar {...navbarProps} />
        <LeaderboardPage onBack={() => { setPage(simResult ? 'sim' : 'game'); window.scrollTo({ top: 0, behavior: 'instant' }) }} currentUser={user} adsDisabled={adsDisabled} isRB={isRB} isWR={isWR} />
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
            gameMode={gameMode}
            pool={isRB ? CUSTOM_RB_POOL : CUSTOM_QB_POOL}
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
          playerLabel={isWR ? 'WR' : undefined}
          attrMap={isWR ? WR_ATTR : undefined}
          categoriesData={isWR ? WR_CATEGORIES : undefined}
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
          categoriesData={isWR ? WR_CATEGORIES : undefined}
          attrMap={isWR ? WR_ATTR : undefined}
          isPlus={isPlus}
          isCustomMode={isCustomMode}
          onOpenCustomModal={() => setShowCustomModal(true)}
          onSandboxToggle={handleSandboxToggle}
        />

        <div className="right-panel-wrap">
          <ReportCard
            build={build}
            onSimulate={page === 'versus-game'
              ? () => setPage('versus-result')
              : handleSimulate}
            onReset={handleReset}
            types={activeTypes}
            hasResult={page === 'versus-game' ? false : !!simResult}
            isRB={isRB}
            isWR={isWR}
            attrMap={isWR ? WR_ATTR : undefined}
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
                <button className="vhud-faceoff-btn" onClick={() => setPage('versus-result')}>
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
          gameMode={gameMode}
          pool={isWR ? CUSTOM_WR_POOL : isRB ? CUSTOM_RB_POOL : CUSTOM_QB_POOL}
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
