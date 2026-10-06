import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { IS_APP } from '../lib/platform'
import FeedbackModal from './FeedbackModal'

// iOS/Android app only: bottom tab bar (Play · Leaderboard · Profile · More)
// that replaces the website's menu. Rendered once from main.jsx and talks to
// App / BucketApp through window events, so neither game needs to know about
// it beyond a small listener:
//   game  → tab bar:  'bap:page'  { page, sport }     (which tab is active)
//   tab bar → game:   'bap:nav'   'play' | 'leaderboard' | 'profile' | 'about'

const TABS = [
  { id: 'play',        label: 'Play' },
  { id: 'leaderboard', label: 'Leaders' },
  { id: 'profile',     label: 'Profile' },
  { id: 'more',        label: 'More' },
]

// Pages each tab "owns" — everything not listed counts as Play
const TAB_FOR_PAGE = { leaderboard: 'leaderboard', 'pvp-leaderboard': 'leaderboard', profile: 'profile', about: 'more' }
// Full-screen pages that hide the bar (head-to-head games)
const HIDE_ON = new Set(['versus-game', 'versus-lobby', 'versus-result', 'shared'])

const Icon = ({ id }) => {
  const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  if (id === 'play') return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5.5 3.5-5.5 3.5z" fill="currentColor" stroke="none" /></svg>
  if (id === 'leaderboard') return <svg {...p}><path d="M5 20V11M12 20V5M19 20v-6" /></svg>
  if (id === 'profile') return <svg {...p}><circle cx="12" cy="8" r="3.6" /><path d="M5 20c1.2-3.6 3.8-5.2 7-5.2s5.8 1.6 7 5.2" /></svg>
  return <svg {...p}><circle cx="5.5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="18.5" cy="12" r="1.3" fill="currentColor" /></svg>
}

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

function MoreSheet({ sport, onClose }) {
  const [feedbackUser, setFeedbackUser] = useState(null)   // null = closed
  const openFeedback = async () => {
    const { data } = supabase ? await supabase.auth.getSession() : { data: null }
    setFeedbackUser(data?.session?.user ?? false)
  }
  const go = fn => () => { onClose(); fn() }
  const rows = [
    { label: 'About', action: go(() => nav('about')) },
    { label: 'Send Feedback', action: openFeedback },
    { label: 'Join the Discord', action: go(() => window.open('https://discord.gg/zdZBu2VjUD', '_blank')) },
    { label: 'Follow on X', action: go(() => window.open('https://x.com/Build_A_Player', '_blank')) },
    { label: sport === 'bucket' ? 'Play Build-A-Player' : 'Play Build-A-Bucket', action: go(() => { window.location.href = sport === 'bucket' ? '/' : '/bucket' }) },
    { label: 'Privacy Policy', action: go(() => { window.location.href = '/privacy' }) },
    { label: 'Terms of Service', action: go(() => { window.location.href = '/terms' }) },
  ]
  // Feedback takes over from the sheet (the form has its own overlay)
  if (feedbackUser !== null) {
    return <FeedbackModal user={feedbackUser || null} isBucket={sport === 'bucket'} onClose={() => { setFeedbackUser(null); onClose() }} />
  }
  return createPortal(
    <div className="app-sheet-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="app-sheet" role="dialog" aria-label="More">
        <div className="app-sheet-grip" />
        {rows.map(r => <button key={r.label} className="app-sheet-row" onClick={r.action}>{r.label}</button>)}
      </div>
    </div>,
    document.body,
  )
}

export default function AppTabBar() {
  const [state, setState]       = useState(() => window.__bapPage ?? { page: 'splash', sport: 'nfl' })
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    const onPage = e => setState(e.detail)
    window.addEventListener('bap:page', onPage)
    return () => window.removeEventListener('bap:page', onPage)
  }, [])

  if (!IS_APP || HIDE_ON.has(state.page)) return null
  const active = moreOpen ? 'more' : (TAB_FOR_PAGE[state.page] ?? 'play')

  return (
    <>
      <nav className="app-tabbar" aria-label="Main">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`app-tab${active === t.id ? ' app-tab--on' : ''}`}
            aria-current={active === t.id ? 'page' : undefined}
            onClick={() => t.id === 'more' ? setMoreOpen(o => !o) : (setMoreOpen(false), nav(t.id))}
          >
            <Icon id={t.id} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      {moreOpen && <MoreSheet sport={state.sport} onClose={() => setMoreOpen(false)} />}
    </>
  )
}
