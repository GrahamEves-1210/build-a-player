import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import LiveLeave from './app/LiveLeave'
import { guardLeave } from '../lib/liveLock'
import { IS_APP, APP_LOOK } from '../lib/platform'
import AppMenu from './app/AppMenu'
import AuthModal from './AuthModal'
import AppToasts, { LevelUp } from './app/AppToasts'
import { useProgress, STREAK_REWARDS, missionDef, cardsOpen } from '../lib/progress'
import { whatsNewSeen, markWhatsNewSeen } from '../lib/whatsNew'
import { IconBag, IconProfile, IconCalendar, IconPodium, IconBagLine, IconProfileLine, IconCalendarLine, IconPodiumLine } from './app/icons'
import { slideIn } from '../lib/juice'
import PlayButton from './app/PlayButton'
import { startPresence } from '../lib/presence'
import { AvatarBadge } from './app/NameTag'
import { getUsername } from '../lib/discord'
import { AnimatePresence, motion } from 'motion/react'
import { SPRING_LAYOUT } from '../lib/motion'
import { takeRewardedOpen } from '../lib/rewardedAd'

const AppDaily = lazy(() => import('./app/AppDaily'))
const AppCards = lazy(() => import('./app/AppCards'))
const MiniGameLab = lazy(() => import('./app/MiniGameLab'))
const AppWhatsNew = lazy(() => import('./app/AppWhatsNew'))
const AppAchievements = lazy(() => import('./app/AppAchievements'))
const AppShop = lazy(() => import('./app/AppShop'))
const AppLocker = lazy(() => import('./app/AppLocker'))
const AppSoundLab = lazy(() => import('./app/AppSoundLab'))
const AppOnline = lazy(() => import('./app/AppOnline'))
const AppPass = lazy(() => import('./app/AppPass'))
const PlayerSheet = lazy(() => import('./app/PlayerSheet'))

// iOS/Android app only: floating game dock (Shop · Daily · Home · Ranks ·
// Profile) that replaces the website's menu, plus the app-only screens and
// layers that sit on top of whichever game page is open (Daily hub, card
// binder, toasts, level-up). Rendered once from main.jsx; talks to App /
// BucketApp through window events so neither game needs to know about it
// beyond a small listener:
//   game  → dock:  'bap:page'  { page, sport }   (which tab is lit)
//   dock  → game:  'bap:nav'   'home' | 'play' | 'leaderboard' | 'profile' | 'about' | 'daily-challenge'
//   anyone → dock: 'bap:nav' 'daily' | 'cards' | 'shop' | 'achievements' | 'pass' | 'pro', 'bap:menu', 'bap:auth'
//   anyone → dock: 'bap:player' { id, username }  (a player's profile, from a name anywhere)

// PLAY is Home: it's lit on Home and on the game screens
const TAB_FOR_PAGE = { splash: 'play', profile: 'profile', leaderboard: 'leaderboard', 'pvp-leaderboard': null, about: null }
// Full-screen pages that hide the dock (a head-to-head match in progress)
const HIDE_ON = new Set(['versus-game', 'versus-result', 'shared'])
// Website: the game screens keep the site's navbar, so the dock is only on the
// app-look pages (home, profile, Squad Builder, the Blacktop lobby + game)
const WEB_DOCK_ON = new Set(['splash', 'profile', 'career', 'career-intro', 'squad', 'blacktop', 'blacktop-game', 'compete', 'leaderboard', 'pvp-leaderboard'])

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

// the dock's order, for which way a screen slides in (Home is PLAY, in the middle)
const TAB_ORDER = { shop: 0, daily: 1, play: 2, leaderboard: 3, profile: 4, locker: 4, cards: 4, achievements: 4 }
const DOCK_TABS = new Set(['shop', 'daily', 'leaderboard'])

// outline when it's not lit, filled when it is. art: something in the icon's place (the player's own avatar on PROFILE).
// badge: what's waiting there (red); tag: what the tab knows when nothing is waiting (the streak's day, a free reward)
function Tab({ label, Icon, Line, active, onClick, badge, tag = null, tagKind = '', art = null }) {
  const Glyph = active ? Icon : Line
  return (
    <button className={`ag-tab${active ? ' ag-tab--on' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick}>
      {active && <motion.span layoutId="dock-lit" className="ag-tab-lit" transition={SPRING_LAYOUT} />}
      <span className={`ag-tab-icon${art ? ' has-art' : ''}`}>{art ?? <Glyph size={23} />}</span>
      <span className="ag-tab-label">{label}</span>
      {badge ? <span className="ag-tab-badge">{badge}</span> : tag != null ? <span className={`ag-tab-tag${tagKind ? ` is-${tagKind}` : ''}`}>{tag}</span> : null}
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

startPresence()   // players online (lib/presence.js): once, for the app and the new website

export default function AppTabBar() {
  const [state, setState]       = useState(() => window.__bapPage ?? { page: 'splash', sport: 'nfl' })
  const [menuOpen, setMenuOpen] = useState(false)   // false | true (More) | 'pro' (More → BAP Pro)
  const [player, setPlayer]     = useState(null)    // { id, username }: their profile sheet
  const [shopTab, setShopTab]   = useState('featured')
  const [authOpen, setAuthOpen] = useState(false)
  const [screen, setScreen]     = useState(null)   // 'daily' | 'cards' | 'shop' | 'achievements' | null
  const badge = useDailyBadge()
  const progress = useProgress()
  const claimable = (progress.claimable || 0) + (progress.setsReady || 0)
  // What's New opens once after an update, on Home, for someone who has played before
  const playedBefore = (progress.stats?.seasons ?? 0) > 0
  useEffect(() => {
    if (state.page !== 'splash' || !playedBefore || whatsNewSeen() || new URLSearchParams(window.location.search).has('mg')) return
    const t = setTimeout(() => { markWhatsNewSeen(); setScreen(s => s ?? 'whatsnew') }, 1200)
    return () => clearTimeout(t)
  }, [state.page, playedBefore])
  const activeRef = useRef('play')   // the lit tab, for the nav listener (set every render)
  const slideTo = to => slideIn(DOCK_TABS.has(to) || to === 'profile' || to === 'play' || to === 'home'
    ? Math.sign((TAB_ORDER[to === 'home' ? 'play' : to] ?? 2) - (TAB_ORDER[activeRef.current] ?? 2))
    : 1)

  useEffect(() => {
    const onPage = e => { setState(e.detail); setScreen(null) }
    const onAuth = () => { setMenuOpen(false); setAuthOpen(true) }
    const onMenu = () => setMenuOpen(true)
    const onNav = e => {
      const [to, arg] = String(e.detail).split(':')
      // web: cards live on an account, so a guest gets the sign-in sheet
      if (to === 'cards' && !cardsOpen()) { setMenuOpen(false); setAuthOpen(true); return }
      if (to === 'pro') { setMenuOpen('pro'); return }
      slideTo(to)
      if (['daily', 'shop', 'locker', 'soundlab', 'online', 'pass', 'cards', 'achievements', 'mglab', 'whatsnew'].includes(to)) { setMenuOpen(false); if (to === 'shop') setShopTab(arg || 'featured'); setScreen(to) }
      else setScreen(null)
    }
    window.addEventListener('bap:page', onPage)
    // (a page set before this listened, e.g. opening /wiki directly, would leave the dock on the old page)
    if (window.__bapPage && window.__bapPage.page !== undefined) setState(s => (s.page === window.__bapPage.page && s.sport === window.__bapPage.sport ? s : window.__bapPage))
    window.addEventListener('bap:auth', onAuth)
    window.addEventListener('bap:menu', onMenu)
    window.addEventListener('bap:nav', onNav)
    const onPlayer = e => { if (e.detail?.id) setPlayer(e.detail) }
    if (new URLSearchParams(window.location.search).has('mg')) setScreen('mglab')
    // (Playwire's review of the rewarded video, lib/rewardedAd.js: straight to the Shop's coins)
    if (takeRewardedOpen()) { setShopTab('coins'); setScreen('shop') }
    window.addEventListener('bap:player', onPlayer)
    return () => {
      window.removeEventListener('bap:player', onPlayer)
      window.removeEventListener('bap:page', onPage)
      window.removeEventListener('bap:auth', onAuth)
      window.removeEventListener('bap:menu', onMenu)
      window.removeEventListener('bap:nav', onNav)
    }
  }, [])

  // The game's fixed SPIN/BUILD switch would float over an open Daily/Cards screen
  // (the sign-in sheet and a player's profile sheet count too: they are the game's own, over whatever mode is open,
  // and College Football's blue stays off them: cfb.css)
  useEffect(() => { document.documentElement.classList.toggle('ag-screen-open', !!screen || authOpen || !!player) }, [screen, authOpen, player])
  // (Website: the bottom ad rail is measured into --web-rail by lib/railWatch.js, started in main.jsx: the dock,
  // screens and sheets sit above it)
  // Website: the app-look pages (home, profile) take the app's page styling
  useEffect(() => { if (!IS_APP) document.documentElement.classList.toggle('ag-page', WEB_DOCK_ON.has(state.page)) }, [state.page])

  if (!IS_APP && !APP_LOOK) return null
  const hidden = HIDE_ON.has(state.page) || (!IS_APP && !screen && !WEB_DOCK_ON.has(state.page))
  const active = screen ?? (state.page in TAB_FOR_PAGE ? TAB_FOR_PAGE[state.page] : 'play')
  // Home itself, with nothing over it: only then does the Home button sit dimmed
  const atHome = state.page === 'splash' && !screen && !menuOpen && !authOpen && !player
  activeRef.current = active
  // in a live game every tab is a way out: it asks first (lib/liveLock.js)
  const go = to => () => guardLeave(() => { setMenuOpen(false); setScreen(null); slideTo(to); nav(to) })
  // a tab for the screen that's already open does nothing (it used to close it and
  // drop you on whatever page was underneath, often the profile)
  const open = which => () => { if (screen === which) return; guardLeave(() => { setMenuOpen(false); slideTo(which); setScreen(which) }) }
  // Daily, Shop and Cards: the X always goes Home (not back to whatever page was under
  // it); the profile's own screens (achievements, locker…) close back to the profile
  const closeHome = () => { setScreen(null); nav('home') }

  return (
    <>
      {screen && (
        <Suspense fallback={<div className="ag-screen ag-screen--wait" />}>
          {screen === 'daily' ? <AppDaily sport={state.sport} onClose={closeHome} />
            : screen === 'shop' ? <AppShop key={shopTab} tab={shopTab} onClose={closeHome} />
            : screen === 'locker' ? <AppLocker onClose={() => setScreen(null)} />
            : screen === 'soundlab' ? <AppSoundLab onClose={() => setScreen(null)} />
            : screen === 'online' ? <AppOnline sport={state.sport} onClose={() => setScreen(null)} />
            : screen === 'mglab' ? <MiniGameLab onClose={() => setScreen(null)} />
            : screen === 'whatsnew' ? <AppWhatsNew onClose={() => setScreen(null)} />
            : screen === 'cards' ? <AppCards sport={state.sport} onClose={() => setScreen(null)} />
            : screen === 'achievements' ? <AppAchievements onClose={() => setScreen(null)} />
            : screen === 'pass' ? <AppPass onClose={() => setScreen(null)} />
            : null}
        </Suspense>
      )}
      {/* the floor under the dock: the strip between it and the screen's bottom edge is the page's dark, not whatever
          scrolls behind it (the College Football card's blue showed there, and iPhone's Safari tints its bar from it) */}
      {!hidden && <div className="ag-dock-floor" aria-hidden="true" />}
      {!hidden && (
        <nav className={`ag-dock ag-dock--${state.sport}`} aria-label="Main">
          {/* the day's free reward waiting in the Shop; the login streak's day on Daily (a reward to claim outranks it) */}
          <Tab label="SHOP" Icon={IconBag} Line={IconBagLine} active={active === 'shop'} onClick={open('shop')} tag={progress.freeReady ? 'FREE' : null} tagKind="free" />
          <Tab label="DAILY" Icon={IconCalendar} Line={IconCalendarLine} active={active === 'daily'} onClick={open('daily')} badge={badge} tag={progress.streak?.count > 1 ? progress.streak.count : null} tagKind="streak" />
          {/* a tap goes Home (PLAY, or HOME inside a game mode); hold for the modes anywhere */}
          <PlayButton page={state.page} sport={state.sport} lit={active === 'play'} here={atHome}
            onTap={() => { if (!atHome) go('home')() }} />
          <Tab label="RANKS" Icon={IconPodium} Line={IconPodiumLine} active={active === 'leaderboard'} onClick={state.page === 'leaderboard' && !screen ? undefined : go('leaderboard')} />
          {/* unclaimed achievements and completed sets show here and on the profile's own buttons */}
          {/* the player's own avatar and level in the icon's place (a guest keeps the outline) */}
          <Tab label="PROFILE" Icon={IconProfile} Line={IconProfileLine} active={['profile', 'locker', 'cards', 'achievements'].includes(active)} badge={claimable}
            art={getUsername(progress.user) ? <AvatarBadge self name={getUsername(progress.user)} size={26} level={progress.lvl?.level} /> : null}
            onClick={state.page === 'profile' && !screen ? undefined : go('profile')} />
        </nav>
      )}
      {/* the More sheet slides back out when it closes */}
      <AnimatePresence>{menuOpen && <AppMenu key="menu" sport={state.sport} initialView={menuOpen === 'pro' ? 'pro' : 'menu'} onClose={() => setMenuOpen(false)} />}</AnimatePresence>
      {player && <Suspense fallback={null}><PlayerSheet player={player} isBucket={state.sport === 'bucket'} onClose={() => setPlayer(null)} /></Suspense>}
      {/* The games pick up the new session from Supabase's auth listener; then open the profile */}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuth={() => setTimeout(() => nav('profile'), 400)} />}
      <AppToasts />
      <LiveLeave />
      {/* The season's rewards panel shows its own level-up, so hold this during a sim */}
      <LevelUp hold={state.page === 'sim'} />
    </>
  )
}
