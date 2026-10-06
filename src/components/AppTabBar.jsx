import { useEffect, useState } from 'react'
import { IS_APP } from '../lib/platform'
import AppMenu from './app/AppMenu'
import AuthModal from './AuthModal'
import { IconHome, IconTrophy, IconPlay, IconProfile, IconMenu } from './app/icons'

// iOS/Android app only: floating game dock (Home · Leaders · PLAY · Profile ·
// Menu) that replaces the website's menu. Rendered once from main.jsx and
// talks to App / BucketApp through window events, so neither game needs to
// know about it beyond a small listener:
//   game  → dock:  'bap:page'  { page, sport }   (which tab is lit)
//   dock  → game:  'bap:nav'   'home' | 'play' | 'leaderboard' | 'profile' | 'about'

const TAB_FOR_PAGE = { splash: 'home', leaderboard: 'leaderboard', 'pvp-leaderboard': 'leaderboard', profile: 'profile', about: 'menu' }
// Full-screen pages that hide the dock (head-to-head games)
const HIDE_ON = new Set(['versus-game', 'versus-lobby', 'versus-result', 'shared'])

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

function Tab({ label, Icon, active, onClick }) {
  return (
    <button className={`ag-tab${active ? ' ag-tab--on' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick}>
      <span className="ag-tab-icon"><Icon size={24} /></span>
      <span className="ag-tab-label">{label}</span>
    </button>
  )
}

export default function AppTabBar() {
  const [state, setState]       = useState(() => window.__bapPage ?? { page: 'splash', sport: 'nfl' })
  const [menuOpen, setMenuOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    const onPage = e => setState(e.detail)
    const onAuth = () => { setMenuOpen(false); setAuthOpen(true) }
    window.addEventListener('bap:page', onPage)
    window.addEventListener('bap:auth', onAuth)
    return () => { window.removeEventListener('bap:page', onPage); window.removeEventListener('bap:auth', onAuth) }
  }, [])

  if (!IS_APP || HIDE_ON.has(state.page)) return null
  const active = menuOpen ? 'menu' : (TAB_FOR_PAGE[state.page] ?? 'play')
  const go = to => () => { setMenuOpen(false); nav(to) }

  return (
    <>
      <nav className={`ag-dock ag-dock--${state.sport}`} aria-label="Main">
        <Tab label="Home" Icon={IconHome} active={active === 'home'} onClick={go('home')} />
        <Tab label="Leaders" Icon={IconTrophy} active={active === 'leaderboard'} onClick={go('leaderboard')} />
        <button className={`ag-play${active === 'play' ? ' ag-play--on' : ''}`} onClick={go('play')} aria-label="Play">
          <span className="ag-play-ring" />
          <span className="ag-play-core"><IconPlay size={30} /></span>
          <span className="ag-play-label">PLAY</span>
        </button>
        <Tab label="Profile" Icon={IconProfile} active={active === 'profile'} onClick={go('profile')} />
        <Tab label="Menu" Icon={IconMenu} active={active === 'menu'} onClick={() => setMenuOpen(o => !o)} />
      </nav>
      {menuOpen && <AppMenu sport={state.sport} onClose={() => setMenuOpen(false)} />}
      {/* The games pick up the new session from Supabase's auth listener; then open the profile */}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuth={() => setTimeout(() => nav('profile'), 400)} />}
    </>
  )
}
