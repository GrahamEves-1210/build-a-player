import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import Navbar from './components/Navbar'
import SpinScreen from './components/SpinScreen'
import Silhouette from './components/Silhouette'
import ReportCard from './components/ReportCard'
import SimModal from './components/SimModal'
import AboutPage from './components/AboutPage'
import SplashScreen from './components/SplashScreen'
import { TYPES, LITE_TYPES } from './data/qbs'
import { runSimulation } from './utils/simulation'

export default function App() {
  const [page, setPage]                 = useState('splash')
  const [gameMode, setGameMode]         = useState(null)
  const [build, setBuild]               = useState({})
  const [activeDrag, setActiveDrag]     = useState(null)
  const [activeCategory, setActiveCategory] = useState('physical')
  const [showSim, setShowSim]           = useState(false)
  const [simResult, setSimResult]       = useState(null)
  const [spinResetKey, setSpinResetKey] = useState(0)
  const [mobileView, setMobileView]     = useState('spin')

  const activeTypes = gameMode === 'lite' ? LITE_TYPES : TYPES

  const activeDragRef = useRef(activeDrag)
  useLayoutEffect(() => { activeDragRef.current = activeDrag }, [activeDrag])

  const handleStart = useCallback((mode) => {
    const types = mode === 'lite' ? LITE_TYPES : TYPES
    setGameMode(mode)
    setBuild(Object.fromEntries(types.map(t => [t, null])))
    setPage('game')
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
    setActiveDrag(null)
    setSpinResetKey(0)
  }, [activeTypes])

  const handleChipTap = useCallback((chipData) => {
    setBuild(prev => {
      if (prev[chipData.type] !== undefined && prev[chipData.type]) return prev
      const next = { ...prev, [chipData.type]: chipData }
      if (activeTypes.every(t => next[t])) setMobileView('build')
      return next
    })
    setSpinResetKey(k => k + 1)
  }, [activeTypes])

  const handleSimulate = useCallback(() => {
    setSimResult(runSimulation(build, activeTypes))
    setShowSim(true)
  }, [build, activeTypes])

  if (page === 'splash') {
    return <SplashScreen onStart={handleStart} />
  }

  if (page === 'about') {
    return (
      <>
        <Navbar onReset={handleReset} onAbout={() => setPage('about')} />
        <AboutPage onBack={() => setPage('game')} />
      </>
    )
  }

  const filledCount = activeTypes.filter(t => build[t]).length

  return (
    <>
      <Navbar onReset={handleReset} onAbout={() => setPage('about')} />

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
        />
        <Silhouette
          build={build}
          activeDrag={activeDrag}
          onDrop={handleDrop}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          types={activeTypes}
        />

        <div className="right-panel-wrap">
          <ReportCard
            build={build}
            onSimulate={handleSimulate}
            onReset={handleReset}
            types={activeTypes}
          />
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="mobile-tab-bar">
        <button
          className={`mtab ${mobileView === 'spin' ? 'active' : ''}`}
          onClick={() => setMobileView('spin')}
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
          onClick={() => setMobileView('build')}
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

      <SimModal
        open={showSim}
        result={simResult}
        build={build}
        onClose={() => setShowSim(false)}
        onReset={() => { handleReset(); setShowSim(false) }}
      />
    </>
  )
}
