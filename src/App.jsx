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
import { RBS, RB_TYPES, RB_LITE_TYPES } from './data/rbs'
import { ALLTIME_RATINGS } from './data/nfl-teams'
import { LEGENDS, LEGEND_TYPES } from './data/legends'
import { RB_LEGENDS } from './data/rb-legends'
import HEADSHOTS from './data/headshots.json'
import { runSimulation, getArchetype, runRBSimulation, calcOVRRB, getArchetypeRB } from './utils/simulation'
import { supabase } from './lib/supabase'
import CustomRatingsModal from './components/CustomRatingsModal'

// Detect shared build at module load time — before any React rendering
let _sharedData = null
try {
  const _enc = new URLSearchParams(window.location.search).get('b')
  if (_enc) _sharedData = decodeBuild(_enc)
} catch {}

const _isPrivacy = window.location.pathname === '/privacy'

const _saved = (() => {
  if (_sharedData || _isPrivacy) return null
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
  const [page, setPage]               = useState(_sharedData ? 'shared' : _isPrivacy ? 'privacy' : (_saved?.gameMode ? 'game' : 'splash'))
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
  const [savedSpinResult, setSavedSpinResult] = useState(null)
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
  const [saveToast, setSaveToast] = useState(null)
  const saveToastTimer = useRef(null)

  useEffect(() => {
    hideVideoAds()
    const obs = new MutationObserver(hideVideoAds)
    obs.observe(document.body, { childList: true, subtree: true })
    const interval = setInterval(hideVideoAds, 1000)
    setTimeout(() => clearInterval(interval), 15000)
    return () => { obs.disconnect(); clearInterval(interval) }
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
    if (!gameMode) return
    try { localStorage.setItem('bap_progress', JSON.stringify({ gameMode, position, build })) } catch {}
  }, [build, gameMode, position])

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
    if (!supabase) return
    const uid = Math.random().toString(36).slice(2)
    const ch = supabase.channel('online', { config: { presence: { key: uid } } })
    let lastUpdate = 0
    ch.on('presence', { event: 'sync' }, () => {
      const now = Date.now()
      if (now - lastUpdate < 3000) return
      lastUpdate = now
      setOnlineCount(Object.keys(ch.presenceState()).length + 5)
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ t: Date.now() })
    })
    return () => supabase.removeChannel(ch)
  }, [])

  const isRB        = position === 'rb'
  const activeTypes = gameMode === 'lite' ? (isRB ? RB_LITE_TYPES : LITE_TYPES) : (gameMode === 'all-time' && !isRB) ? LEGEND_TYPES : (isRB ? RB_TYPES : TYPES)
  const activePool  = gameMode === 'all-time' ? (isRB ? RB_LEGENDS : LEGENDS) : (isRB ? RBS : QBS)
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

  const displayPool = (isCustomMode && isPlus && customRatings[isRB ? 'rb' : 'qb'])
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
    const types = mode === 'lite' ? (isRBMode ? RB_LITE_TYPES : LITE_TYPES) : (isRBMode ? RB_TYPES : TYPES)
    setGameMode(mode)
    setBuild(Object.fromEntries(types.map(t => [t, null])))
    setActiveCategory('physical')
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
    const result = isRB
      ? runRBSimulation(build, activeTypes, effectiveTeam, gameMode === 'all-time')
      : runSimulation(build, activeTypes, effectiveTeam, gameMode === 'all-time')
    setSimResult(result)
    if (!user) {
      showSaveToast('no-auth', 'Sign in to save your stats')
    } else if (isCustomMode) {
      showSaveToast('custom', 'Custom mode — results not saved')
    } else if (!supabase) {
      console.warn('[build-a-player] sim result not saved — supabase not configured')
    } else {
      const arch = isRB
        ? getArchetypeRB(result.ovr, build, activeTypes)
        : getArchetype(result.ovr, build, activeTypes)
      supabase.from('simulations').insert({
        user_id: user.id,
        username: user.user_metadata?.username || user.email?.split('@')[0] || 'Player',
        ovr: result.ovr,
        archetype: arch,
        game_mode: isRB ? `rb-${gameMode || 'classic'}` : gameMode,
        wins: result.wins,
        losses: result.losses,
        season_pass_yds: isRB ? result.seasonRushYds : result.seasonPassYds,
        season_tds: isRB ? (result.seasonRushTDs + result.seasonRecTDs) : result.seasonTDs,
        season_ints: isRB ? null : result.seasonINTs,
        season_comp_pct: isRB ? null : result.seasonCompPct,
        season_rating: isRB ? null : result.seasonRating,
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
    onOpenCustomRatings: () => { if (isPlus) setShowCustomModal(true) },
    user,
    gameMode,
    isRB,
    isPlus,
  }

  if (page === 'leaderboard') {
    return (
      <>
        <Navbar {...navbarProps} />
        <LeaderboardPage onBack={() => { setPage('game'); window.scrollTo({ top: 0, behavior: 'instant' }) }} currentUser={user} adsDisabled={adsDisabled} isRB={isRB} />
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
          isRB={isRB}
          isPlus={isPlus}
          currentPool={activePool}
          isCustomMode={isCustomMode && isPlus}
          onCustomModeChange={(val) => {
            const next = val && isPlus
            setIsCustomMode(next)
            try { localStorage.setItem('bap_custom_mode', next ? '1' : '0') } catch {}
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
          onBack={() => { setPage('game'); window.scrollTo({ top: 0, behavior: 'instant' }) }}
          onSignOut={() => { setPage('game'); setUser(null); window.scrollTo({ top: 0, behavior: 'instant' }) }}
          onAdsDisabled={() => { setAdsDisabled(true); setIsSubscribed(true); enableAdFreeMode() }}
          onOpenCustomModal={() => setShowCustomModal(true)}
        />
        {showCustomModal && isPlus && (
          <CustomRatingsModal
            isRB={isRB}
            gameMode={gameMode}
            pool={activePool}
            onClose={() => setShowCustomModal(false)}
            onSave={(ratings) => {
              setCustomRatings(ratings)
              try { localStorage.setItem('bap_custom_ratings', JSON.stringify(ratings)) } catch {}
            }}
            build={build}
            buildTypes={activeTypes}
            onAddToBuild={(p, playerOverrides, attrType) => {
              const photo = HEADSHOTS[p.name] ? `/headshots/${HEADSHOTS[p.name]}.jpg` : null
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
              const photo = HEADSHOTS[p.name] ? `/headshots/${HEADSHOTS[p.name]}.jpg` : null
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
          isRB={isRB}
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
      </>
    )
  }

  const filledCount = activeTypes.filter(t => build[t]).length

  return (
    <>
      <Navbar {...navbarProps} />

      <main className={`game-layout mobile-${mobileView}${gameMode === 'all-time' ? ' alltime-mode' : ''}`}>
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
          isPlus={isPlus}
          isCustomMode={isCustomMode}
          onOpenCustomModal={() => setShowCustomModal(true)}
        />

        <div className="right-panel-wrap">
          <ReportCard
            build={build}
            onSimulate={handleSimulate}
            onReset={handleReset}
            types={activeTypes}
            hasResult={!!simResult}
            isRB={isRB}
            isPlus={isPlus}
            isCustomMode={isCustomMode}
            onOpenCustomModal={() => setShowCustomModal(true)}
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
        <TeamPickerModal onSelect={handleTeamPicked} isPlus={isCustomMode && isPlus} />
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

      {showCustomModal && isPlus && (
        <CustomRatingsModal
          isRB={isRB}
          gameMode={gameMode}
          pool={activePool}
          onClose={() => setShowCustomModal(false)}
          onSave={(ratings) => {
            setCustomRatings(ratings)
            try { localStorage.setItem('bap_custom_ratings', JSON.stringify(ratings)) } catch {}
          }}
          build={build}
          buildTypes={activeTypes}
          onAddToBuild={(p, playerOverrides, attrType) => {
            const photo = HEADSHOTS[p.name] ? `/headshots/${HEADSHOTS[p.name]}.jpg` : null
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
            const photo = HEADSHOTS[p.name] ? `/headshots/${HEADSHOTS[p.name]}.jpg` : null
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
