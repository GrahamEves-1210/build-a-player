import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import Navbar from './components/Navbar'
import SpinScreen from './components/SpinScreen'
import Silhouette from './components/Silhouette'
import ReportCard from './components/ReportCard'
import SimModal from './components/SimModal'
import AboutPage from './components/AboutPage'
import { TYPES } from './data/qbs'
import { runSimulation } from './utils/simulation'

const EMPTY_BUILD = Object.fromEntries(TYPES.map(t => [t, null]))


export default function App() {
  const [page, setPage]                 = useState('game')
  const [build, setBuild]               = useState({ ...EMPTY_BUILD })
  const [activeDrag, setActiveDrag]     = useState(null)
  const [activeCategory, setActiveCategory] = useState('physical')
  const [showSim, setShowSim]           = useState(false)
  const [simResult, setSimResult]       = useState(null)
  const [spinResetKey, setSpinResetKey] = useState(0)

  const activeDragRef = useRef(activeDrag)
  useLayoutEffect(() => { activeDragRef.current = activeDrag }, [activeDrag])

  const handleDrop = useCallback((type) => {
    const drag = activeDragRef.current
    if (!drag) return
    setBuild(prev => ({ ...prev, [drag.type]: drag }))
    setActiveDrag(null)
    setSpinResetKey(k => k + 1)
  }, [])

  const handleReset = useCallback(() => {
    setBuild({ ...EMPTY_BUILD })
    setSimResult(null)
    setActiveDrag(null)
    setSpinResetKey(0)
  }, [])

  const handleChipTap = useCallback((chipData) => {
    setBuild(prev => {
      if (prev[chipData.type]) return prev
      return { ...prev, [chipData.type]: chipData }
    })
    setSpinResetKey(k => k + 1)
  }, [])

  const handleSimulate = useCallback(() => {
    setSimResult(runSimulation(build))
    setShowSim(true)
  }, [build])

  if (page === 'about') {
    return (
      <>
        <Navbar onReset={handleReset} onAbout={() => setPage('about')} />
        <AboutPage onBack={() => setPage('game')} />
      </>
    )
  }

  return (
    <>
      <Navbar onReset={handleReset} onAbout={() => setPage('about')} />

      <main className="game-layout">
        <SpinScreen
          build={build}
          activeDrag={activeDrag}
          onDragStart={setActiveDrag}
          onDragEnd={() => setActiveDrag(null)}
          activeCategory={activeCategory}
          resetKey={spinResetKey}
          onChipTap={handleChipTap}
        />
        <Silhouette
          build={build}
          activeDrag={activeDrag}
          onDrop={handleDrop}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />

        <div className="right-panel-wrap">
          <ReportCard
            build={build}
            onSimulate={handleSimulate}
            onReset={handleReset}
          />
        </div>
      </main>

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
