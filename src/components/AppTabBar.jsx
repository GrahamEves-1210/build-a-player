import { useEffect, useState, lazy, Suspense } from 'react'
import { IS_APP, APP_LOOK } from '../lib/platform'
import AppMenu from './app/AppMenu'
import AuthModal from './AuthModal'
import AppToasts, { LevelUp } from './app/AppToasts'
import { useProgress, STREAK_REWARDS, missionDef } from '../lib/progress'
import { IconHome, IconPlay, IconProfile, IconCalendar, IconCards } from './app/icons'

const AppDaily = lazy(() => import('./app/AppDaily'))
const AppCards = lazy(() => import('./app/AppCards'))
const AppShop = lazy(() => import('./app/AppShop'))
const AppAchievements = lazy(() => import('./app/AppAchievements'))
const AppLocker = lazy(() => import('./app/AppLocker'))
const AppSoundLab = lazy(() => import('./app/AppSoundLab'))

// iOS/Android app only: floating game dock (Home · Daily · PLAY · Cards ·
// Profile) that replaces the website's menu, plus the app-only screens and
// layers that sit on top of whichever game page is open (Daily hub, card
// binder, toasts, level-up). Rendered once from main.jsx; talks to App /
// BucketApp through window events so neither game needs to know about it
// beyond a small listener:
//   game  → dock:  'bap:page'  { page, sport }   (which tab is lit)
//   dock  → game:  'bap:nav'   'home' | 'play' | 'leaderboard' | 'profile' | 'about' | 'daily-challenge'
//   anyone → dock: 'bap:nav' 'daily' | 'cards' | 'shop' | 'achievements', 'bap:menu', 'bap:auth'

const TAB_FOR_PAGE = { splash: 'home', profile: 'profile', leaderboard: null, 'pvp-leaderboard': null, about: null }
// Full-screen pages that hide the dock (a head-to-head match in progress)
const HIDE_ON = new Set(['versus-game', 'versus-result', 'shared'])
// Website: the game screens keep the site's navbar, so the dock is only on the
// app-look pages (home, profile, the Takeover road, the Blacktop lobby + game)
const WEB_DOCK_ON = new Set(['splash', 'profile', 'takeover', 'blacktop', 'blacktop-game'])

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

function Tab({ label, Icon, active, onClick, badge }) {
  return (
    <button className={`ag-tab${active ? ' ag-tab--on' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick}>
      <span className="ag-tab-icon"><Icon size={23} /></span>
      <span className="ag-tab-label">{label}</span>
      {badge ? <span className="ag-tab-badge">{badge}</span> : null}
    </button>
  )
}

// Rewards waiting on the Daily screen
function useDailyBadge() {
  const p = useProgress()
  const missions = (p.day?.missions ?? []).filter(m => !m.claimed && m.n >= (missionDef(m.id)?.goal ?? Infinity)).length
  const streak = STREAK_REWARDS.filter(r => p.streak.count >= r.days && !p.streak.claimed?.[r.days]).length
  return missions + streak
}

export default function AppTabBar() {
  const [state, setState]       = useState(() => window.__bapPage ?? { page: 'splash', sport: 'nfl' })
  const [menuOpen, setMenuOpen] = useState(false)
  const [shopTab, setShopTab]   = useState('featured')
  const [authOpen, setAuthOpen] = useState(false)
  const [screen, setScreen]     = useState(null)   // 'daily' | 'cards' | 'shop' | 'achievements' | null
  const badge = useDailyBadge()
  const claimable = useProgress().claimable || 0

  useEffect(() => {
    const onPage = e => { setState(e.detail); setScreen(null) }
    const onAuth = () => { setMenuOpen(false); setAuthOpen(true) }
    const onMenu = () => setMenuOpen(true)
    const onNav = e => {
      const [to, arg] = String(e.detail).split(':')
      if (['daily', 'cards', 'shop', 'achievements', 'locker', 'soundlab'].includes(to)) { setMenuOpen(false); if (to === 'shop') setShopTab(arg || 'featured'); setScreen(to) }
      else setScreen(null)
    }
    window.addEventListener('bap:page', onPage)
    window.addEventListener('bap:auth', onAuth)
    window.addEventListener('bap:menu', onMenu)
    window.addEventListener('bap:nav', onNav)
    return () => {
      window.removeEventListener('bap:page', onPage)
      window.removeEventListener('bap:auth', onAuth)
      window.removeEventListener('bap:menu', onMenu)
      window.removeEventListener('bap:nav', onNav)
    }
  }, [])

  // The game's fixed SPIN/BUILD switch would float over an open Daily/Cards screen
  useEffect(() => { document.documentElement.classList.toggle('ag-screen-open', !!screen) }, [screen])
  // Website: the app-look pages (home, profile) take the app's page styling
  useEffect(() => { if (!IS_APP) document.documentElement.classList.toggle('ag-page', WEB_DOCK_ON.has(state.page)) }, [state.page])

  if (!IS_APP && !APP_LOOK) return null
  const hidden = HIDE_ON.has(state.page) || (!IS_APP && !screen && !WEB_DOCK_ON.has(state.page))
  const active = screen ?? (state.page in TAB_FOR_PAGE ? TAB_FOR_PAGE[state.page] : 'play')
  const go = to => () => { setMenuOpen(false); setScreen(null); nav(to) }
  const open = which => () => { setMenuOpen(false); setScreen(s => (s === which ? null : which)) }

  return (
    <>
      {screen && (
        <Suspense fallback={<div className="ag-screen" />}>
          {screen === 'daily' ? <AppDaily sport={state.sport} onClose={() => setScreen(null)} />
            : screen === 'shop' ? <AppShop key={shopTab} tab={shopTab} onClose={() => setScreen(null)} />
            : screen === 'locker' ? <AppLocker onClose={() => setScreen(null)} />
            : screen === 'soundlab' ? <AppSoundLab onClose={() => setScreen(null)} />
            : screen === 'achievements' ? <AppAchievements onClose={() => setScreen(null)} />
            : <AppCards sport={state.sport} onClose={() => setScreen(null)} />}
        </Suspense>
      )}
      {!hidden && (
        <nav className={`ag-dock ag-dock--${state.sport}`} aria-label="Main">
          <Tab label="HOME" Icon={IconHome} active={active === 'home'} onClick={go('home')} />
          <Tab label="DAILY" Icon={IconCalendar} active={active === 'daily'} onClick={open('daily')} badge={badge} />
          <button className={`ag-play${active === 'play' ? ' ag-play--on' : ''}`} onClick={go('play')} aria-label="Play">
            <span className="ag-play-ring" />
            <span className="ag-play-core"><IconPlay size={28} /></span>
            <span className="ag-play-label">PLAY</span>
          </button>
          <Tab label="CARDS" Icon={IconCards} active={active === 'cards'} onClick={open('cards')} />
          <Tab label="PROFILE" Icon={IconProfile} active={active === 'profile' || active === 'shop' || active === 'achievements' || active === 'locker'} onClick={go('profile')} badge={claimable} />
        </nav>
      )}
      {menuOpen && <AppMenu sport={state.sport} onClose={() => setMenuOpen(false)} />}
      {/* The games pick up the new session from Supabase's auth listener; then open the profile */}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuth={() => setTimeout(() => nav('profile'), 400)} />}
      <AppToasts />
      {/* The season's rewards panel shows its own level-up, so hold this during a sim */}
      <LevelUp hold={state.page === 'sim'} />
    </>
  )
}
