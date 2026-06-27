import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import Navbar from './components/Navbar'
import SpinScreen from './components/SpinScreen'
import Silhouette from './components/Silhouette'
import ReportCard from './components/ReportCard'
import SimPage from './components/SimPage'
import TeamPickerModal from './components/TeamPickerModal'
import AboutPage from './components/AboutPage'
import PrivacyPage from './components/PrivacyPage'
import SharedBuildPage from './components/SharedBuildPage'
import { decodeBuild } from './utils/shareUrl'
import SplashScreen from './components/SplashScreen'
import AuthModal from './components/AuthModal'
import ProfilePage from './components/ProfilePage'
import LeaderboardPage from './components/LeaderboardPage'
import { TYPES, LITE_TYPES, QBS } from './data/qbs'
import { LEGENDS, LEGEND_TYPES } from './data/legends'
import HEADSHOTS from './data/headshots.json'
import { runSimulation, getArchetype } from './utils/simulation'
import { supabase } from './lib/supabase'

// Detect shared build at module load time — before any React rendering
let _sharedData = null
try {
  const _enc = new URLSearchParams(window.location.search).get('b')
  if (_enc) _sharedData = decodeBuild(_enc)
} catch {}

const _isPrivacy = window.location.pathname === '/privacy'

function hideVideoAds() {
  const sel = '[id*="corner_video"],[id*="floating_video"],[id*="corner-video"],[class*="corner_video"],[class*="floating_video"],[id^="pw-oop-video"],[id^="pw-oop-corner"]'
  document.querySelectorAll(sel).forEach(el => el.style.setProperty('display', 'none', 'important'))
}

function enableAdFreeMode() {
  document.documentElement.classList.add('ads-hidden')
  // Force-hide via JS since Playwire sets inline display with !important
  const hide = () => {
    document.querySelectorAll('[id^="pw-"],[id^="ramp-"],[class^="pw-"],[id^="adBanner"]').forEach(el => {
      el.style.setProperty('display', 'none', 'important')
    })
  }
  hide()
  // Watch for any late-injected Playwire elements
  const obs = new MutationObserver(hide)
  obs.observe(document.body, { childList: true, subtree: true })
}

export default function App() {
  const [page, setPage]               = useState(_sharedData ? 'shared' : _isPrivacy ? 'privacy' : 'splash')
  const [sharedBuild]                 = useState(_sharedData?.build ?? null)
  const [sharedTypes]                 = useState(_sharedData?.types ?? null)
  const [gameMode, setGameMode]         = useState(null)
  const [build, setBuild]               = useState({})
  const [activeDrag, setActiveDrag]     = useState(null)
  const [activeCategory, setActiveCategory] = useState('physical')
  const [simResult, setSimResult]       = useState(null)
  const [simReplaying, setSimReplaying] = useState(false)
  const [spinResetKey, setSpinResetKey] = useState(0)
  const [gameKey, setGameKey]           = useState(0)
  const [mobileView, setMobileView]     = useState('spin')
  const [user, setUser]                 = useState(null)
  const [showAuth, setShowAuth]         = useState(false)
  const [showTeamPicker, setShowTeamPicker] = useState(false)
  const [savedSpinResult, setSavedSpinResult] = useState(null)
  const [spinPhase, setSpinPhase] = useState('idle')
  const [adsDisabled, setAdsDisabled] = useState(false)

  useEffect(() => {
    hideVideoAds()
    const obs = new MutationObserver(hideVideoAds)
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', page === 'splash' ? '#080b09' : '#090a0d')
  }, [page])

  useEffect(() => {
    window.ramp?.que?.push(() => {
      window.ramp.spaNewPage()
    })
  }, [page])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (u) supabase.from('profiles').select('ads_disabled').eq('id', u.id).single()
        .then(({ data: p }) => { console.log('[ads]', p); if (p?.ads_disabled) { setAdsDisabled(true); enableAdFreeMode() } })
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const activeTypes = gameMode === 'lite' ? LITE_TYPES : gameMode === 'legends' ? LEGEND_TYPES : TYPES
  const activePool  = gameMode === 'legends' ? LEGENDS : QBS



  const activeDragRef = useRef(activeDrag)
  useLayoutEffect(() => { activeDragRef.current = activeDrag }, [activeDrag])

  const handleStart = useCallback((mode) => {
    const types = mode === 'lite' ? LITE_TYPES : TYPES
    setGameMode(mode)
    setBuild(Object.fromEntries(types.map(t => [t, null])))
    setPage('game')
    window.scrollTo(0, 0)
  }, [])

  const handleDrop = useCallback((type) => {
    const drag = activeDragRef.current
    if (!drag) return
    setBuild(prev => ({ ...prev, [drag.type]: drag }))
    setActiveDrag(null)
    setSpinResetKey(k => k + 1)
  }, [])

  const fillTestBuild = useCallback(() => {
    const newBuild = {}
    activeTypes.forEach(type => {
      const best = activePool.reduce((a, b) => ((b.attrs[type] ?? 0) > (a.attrs[type] ?? 0) ? b : a), activePool[0])
      const photo = HEADSHOTS[best.name] ? `/headshots/${HEADSHOTS[best.name]}.jpg` : null
      newBuild[type] = {
        type, val: best.attrs[type],
        qb: best.short, qbFull: best.name,
        teamColor: best.color, teamColor2: best.color2,
        skinColor: best.skin, number: best.number,
        team: best.team, captain: best.captain ?? false, photo,
      }
    })
    setBuild(newBuild)
    setMobileView('build')
  }, [activeTypes, activePool])

  const handleReset = useCallback(() => {
    setBuild(Object.fromEntries(activeTypes.map(t => [t, null])))
    setSimResult(null)
    setSimReplaying(false)
    setActiveDrag(null)
    setSpinResetKey(k => k + 1)
    setGameKey(k => k + 1)
    setSavedSpinResult(null)
    setMobileView('spin')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [activeTypes])

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

  const handleTeamPicked = useCallback((team) => {
    setShowTeamPicker(false)
    const result = runSimulation(build, activeTypes, team)
    setSimResult(result)
    if (!user) console.warn('[build-a-player] sim result not saved — user not logged in')
    else if (!supabase) console.warn('[build-a-player] sim result not saved — supabase not configured')
    if (user && supabase && result.wins <= 17 && result.ovr <= 99) {
      const arch = getArchetype(result.ovr, build, activeTypes)
      supabase.from('simulations').insert({
        user_id: user.id,
        username: user.user_metadata?.username || user.email?.split('@')[0] || 'Player',
        ovr: result.ovr,
        archetype: arch,
        game_mode: gameMode,
        wins: result.wins,
        losses: result.losses,
        season_pass_yds: result.seasonPassYds,
        season_tds: result.seasonTDs,
        season_ints: result.seasonINTs,
        season_comp_pct: result.seasonCompPct,
        season_rating: result.seasonRating,
        playoffs: result.playoffs,
        champion: result.sbResult?.won ?? false,
        build: Object.fromEntries(
          activeTypes.filter(t => build[t]).map(t => [t, {
            qb: build[t].qbFull, team: build[t].team, val: build[t].val,
          }])
        ),
      }).then(({ error }) => {
        if (error) console.error('[build-a-player] simulation save failed:', error)
      })
    }
    setSimReplaying(false)
    setPage('sim')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [build, activeTypes, user, gameMode])

  const handleHome = useCallback(() => {
    setPage('splash')
    setGameMode(null)
    setBuild({})
    setSimResult(null)
    setActiveDrag(null)
    setSpinResetKey(0)
    setMobileView('spin')
  }, [])

  if (page === 'splash') {
    return <SplashScreen onStart={handleStart} />
  }

  const navbarProps = {
    onReset: handleReset,
    onAbout: () => setPage('about'),
    onHome: handleHome,
    onSignIn: () => setShowAuth(true),
    onProfile: () => setPage('profile'),
    onLeaderboard: () => setPage('leaderboard'),
    user,
    gameMode,
  }

  if (page === 'leaderboard') {
    return (
      <>
        <Navbar {...navbarProps} />
        <LeaderboardPage onBack={() => { setPage('game'); window.scrollTo({ top: 0, behavior: 'instant' }) }} currentUser={user} adsDisabled={adsDisabled} />
      </>
    )
  }

  if (page === 'shared' && sharedBuild) {
    return (
      <>
        <Navbar {...navbarProps} />
        <SharedBuildPage
          build={sharedBuild}
          types={sharedTypes}
          onPlay={() => {
            window.history.replaceState({}, '', window.location.pathname)
            setPage('splash')
          }}
        />
      </>
    )
  }

  if (page === 'about') {
    return (
      <>
        <Navbar {...navbarProps} />
        <AboutPage onBack={() => { setPage('game'); window.scrollTo({ top: 0, behavior: 'instant' }) }} onPrivacy={() => setPage('privacy')} />
      </>
    )
  }

  if (page === 'privacy') {
    return (
      <>
        <Navbar {...navbarProps} />
        <PrivacyPage onBack={() => setPage('about')} />
      </>
    )
  }

  if (page === 'profile' && user) {
    return (
      <>
        <Navbar {...navbarProps} />
        <ProfilePage
          user={user}
          build={build}
          simResult={simResult}
          types={activeTypes}
          onBack={() => { setPage('game'); window.scrollTo({ top: 0, behavior: 'instant' }) }}
          onSignOut={() => { setPage('game'); setUser(null); window.scrollTo({ top: 0, behavior: 'instant' }) }}
          onAdsDisabled={() => { setAdsDisabled(true); enableAdFreeMode() }}
        />
      </>
    )
  }

  if (page === 'sim' && simResult) {
    return (
      <>
        <Navbar {...navbarProps} />
        <SimPage
          result={simResult}
          build={build}
          types={activeTypes}
          replay={simReplaying}
          adsDisabled={adsDisabled}
          onBack={() => { setPage('game'); window.scrollTo({ top: 0, behavior: 'instant' }) }}
          onReset={() => { handleReset(); setPage('game'); window.scrollTo({ top: 0, behavior: 'instant' }) }}
        />
      </>
    )
  }

  const filledCount = activeTypes.filter(t => build[t]).length

  return (
    <>
      <Navbar {...navbarProps} />

      <main className={`game-layout mobile-${mobileView}${gameMode === 'legends' ? ' legends-mode' : ''}`}>
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
          qbPool={activePool}
          savedResult={savedSpinResult}
          onSaveResult={setSavedSpinResult}
          onPhaseChange={setSpinPhase}
          gameKey={gameKey}
          onReset={handleReset}
          adsDisabled={adsDisabled}
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
        />

        <div className="right-panel-wrap">
          <ReportCard
            build={build}
            onSimulate={handleSimulate}
            onReset={handleReset}
            types={activeTypes}
            hasResult={!!simResult}
          />
        </div>
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
        <TeamPickerModal onSelect={handleTeamPicked} />
      )}

    </>
  )
}
