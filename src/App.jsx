import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import Navbar from './components/Navbar'
import SpinScreen from './components/SpinScreen'
import Silhouette from './components/Silhouette'
import ReportCard from './components/ReportCard'
import SimPage from './components/SimPage'
import AboutPage from './components/AboutPage'
import SplashScreen from './components/SplashScreen'
import AuthModal from './components/AuthModal'
import ProfilePage from './components/ProfilePage'
import { TYPES, LITE_TYPES, QBS } from './data/qbs'
import HEADSHOTS from './data/headshots.json'
import { runSimulation } from './utils/simulation'
import { supabase } from './lib/supabase'

export default function App() {
  const [page, setPage]                 = useState('splash')
  const [gameMode, setGameMode]         = useState(null)
  const [build, setBuild]               = useState({})
  const [activeDrag, setActiveDrag]     = useState(null)
  const [activeCategory, setActiveCategory] = useState('physical')
  const [simResult, setSimResult]       = useState(null)
  const [simReplaying, setSimReplaying] = useState(false)
  const [spinResetKey, setSpinResetKey] = useState(0)
  const [mobileView, setMobileView]     = useState('spin')
  const [user, setUser]                 = useState(null)
  const [showAuth, setShowAuth]         = useState(false)

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', page === 'splash' ? '#080b09' : '#090a0d')
  }, [page])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const activeTypes = gameMode === 'lite' ? LITE_TYPES : TYPES



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

  const handleReset = useCallback(() => {
    setBuild(Object.fromEntries(activeTypes.map(t => [t, null])))
    setSimResult(null)
    setSimReplaying(false)
    setActiveDrag(null)
    setSpinResetKey(0)
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
    if (!isReplay) setSimResult(runSimulation(build, activeTypes))
    setSimReplaying(isReplay)
    setPage('sim')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [build, activeTypes, simResult])

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
    user,
  }

  if (page === 'about') {
    return (
      <>
        <Navbar {...navbarProps} />
        <AboutPage onBack={() => setPage('game')} />
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
          onBack={() => setPage('game')}
          onSignOut={() => { setPage('game'); setUser(null) }}
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
          onBack={() => setPage('game')}
          onReset={() => { handleReset(); setPage('game') }}
        />
      </>
    )
  }

  const filledCount = activeTypes.filter(t => build[t]).length

  return (
    <>
      <Navbar {...navbarProps} />

      <main className={`game-layout mobile-${mobileView}`}>
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
        />
        <Silhouette
          build={build}
          activeDrag={activeDrag}
          onDrop={handleDrop}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          types={activeTypes}
          isLite={gameMode === 'lite'}
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
    </>
  )
}
