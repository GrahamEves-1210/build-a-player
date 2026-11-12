import { StrictMode, lazy, Suspense } from 'react'

// Adds touch class on first touch — CSS uses this to kill sticky :hover states
document.addEventListener('touchstart', function() {
  document.documentElement.classList.add('is-touch')
}, { passive: true, once: true })

if (/Twitter|XInApp/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('is-x-browser')
}

if (/Android/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('is-android')
}

if (/Mac/.test(navigator.platform) && !/iPhone|iPad/.test(navigator.userAgent)) {
  document.documentElement.classList.add('is-mac')
}

if (/iPad/.test(navigator.userAgent) || (/Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1)) {
  document.documentElement.classList.add('is-tablet')
}
import { createRoot } from 'react-dom/client'
import { AppMotion } from './lib/motion'
import UsernamePrompt from './components/UsernamePrompt'
import PasswordReset from './components/PasswordReset'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import './app-game.css'
// Football and basketball are two games: a visit loads only the one it's on
const App = lazy(() => import('./App.jsx'))
const BucketApp = lazy(() => import('./components/BucketApp.jsx'))
// Soccer, the third game (/soccer): only while it's switched on (lib/soccerLive.js)
const SoccerApp = lazy(() => import('./components/SoccerApp.jsx'))
import { SOCCER_LIVE, SOCCER_SOON } from './lib/soccerLive'
// Baseball, the fourth game (/baseball): only while it's switched on (lib/baseballLive.js)
const BaseballApp = lazy(() => import('./components/BaseballApp.jsx'))
import { BASEBALL_LIVE } from './lib/baseballLive'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initAppInfra, AppInfra } from './lib/appInfra'; initAppInfra()   // error log, deep links, notifications, rating, version (lib/appInfra.js)
import { IS_APP, APP_LOOK, APP_PLATFORM } from './lib/platform'
// App shell (dock, Daily, Cards, shop, toasts). The website loads it too for
// the app-look home and profile screens (APP_LOOK in lib/platform.js).
const AppTabBar = (IS_APP || APP_LOOK) ? lazy(() => import('./components/AppTabBar.jsx')) : null

if (IS_APP) {
  document.documentElement.classList.add('is-app')
  // Android's WebView is far slower at live blur and big animated layers than iOS (app-game.css)
  if (APP_PLATFORM === 'android') document.documentElement.classList.add('is-android')
  // No pinch/auto zoom in the app: iOS zooms into any focused field under 16px
  // (chat, search); a fixed scale keeps the screen still while you type.
  document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
}
// Website with the app look: the app's colours and type (app-game.css)
if (!IS_APP && APP_LOOK) document.documentElement.classList.add('app-look')
// Sound effects, haptics and confetti (lib/juice.js); sound starts off on the website
if (IS_APP || APP_LOOK) import('./lib/juice').then(m => m.initJuice()).catch(() => {})
// XP, coins, streak, missions, cards (lib/progress.js)
if (IS_APP || APP_LOOK) import('./lib/progress').then(m => m.initProgress()).catch(() => {})
// Cosmetic effects pause while they're off screen (lib/fxPause.js)
if (IS_APP || APP_LOOK) import('./lib/fxPause').then(m => m.initFxPause()).catch(() => {})
// App: Discord sign-in comes back through the app's own link
if (IS_APP) import('./lib/appAuth').then(m => m.initAppAuth()).catch(() => {})
// which App Store the phone shops in (buying is offered only on the US one: lib/storefront.js)
if (IS_APP) import('./lib/storefront').then(m => m.loadStorefront()).catch(() => {})

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    if (regs.length > 0) {
      Promise.all(regs.map(r => r.unregister())).then(() => window.location.reload())
    }
  })
}

// A deploy replaced the files an open tab still asks for: reload onto the new ones (at most once a minute, never a loop)
window.addEventListener('vite:preloadError', e => {
  try {
    if (Date.now() - Number(sessionStorage.getItem('bap_chunk_reload') || 0) < 60000) return
    sessionStorage.setItem('bap_chunk_reload', String(Date.now()))
  } catch { return }
  e.preventDefault()
  window.location.reload()
})

const isBucket = window.location.pathname.startsWith('/bucket')
if ((IS_APP || APP_LOOK) && isBucket) document.documentElement.classList.add('is-bucket')   // app theme: orange accent
// /soccer while soccer is off: its Home under the COMING SOON board (SOCCER_SOON), or football's Home without it
const isSoccer = window.location.pathname.startsWith('/soccer') && (SOCCER_LIVE || SOCCER_SOON)
if (!isSoccer && window.location.pathname.startsWith('/soccer')) window.history.replaceState({}, '', '/')
if ((IS_APP || APP_LOOK) && isSoccer) document.documentElement.classList.add('is-soccer')   // app theme: black and white
// /baseball while baseball is off is football's Home (nothing about baseball shows until BASEBALL_LIVE)
const isBaseball = window.location.pathname.startsWith('/baseball') && BASEBALL_LIVE
if (!BASEBALL_LIVE && window.location.pathname.startsWith('/baseball')) window.history.replaceState({}, '', '/')
if ((IS_APP || APP_LOOK) && isBaseball) document.documentElement.classList.add('is-baseball')   // app theme: cream, red and navy

// the boot guard in index.html: the app's code is running
window.__bapStarted = true

// The loading screen (index.html) fills with real progress: the code is running
// now, then the fonts, the account (who's signed in, their coins, level and
// seasons, so home doesn't open as a guest and then change), the first real
// screen drawn and its pictures. A cold start holds it at least BOOT_MIN so the
// animation gets to play; nothing it waits on can hold it past its cap.
const BOOT_MIN = 1600
window.__bapLoad?.(0.6)
try { document.fonts?.ready?.then(() => window.__bapLoad?.(0.7)) } catch {}
function dropLoader() {
  if (!document.getElementById('bap-loader')) return
  const root = document.getElementById('root')
  const t0 = performance.now()
  const cap = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))])
  const ready = () => root && root.children.length > 0 && root.querySelector('.ag-screen, .ag-home, main, .game-layout, .ag-shell, section, header')
  const account = (IS_APP || APP_LOOK)
    ? cap(import('./lib/progress').then(m => { m.prefetchPlayersOfDay(); return Promise.all([m.progressSettled, m.cachedPlayersOfDay()]) }), 3000).catch(() => {})
    : Promise.resolve()
  account.then(() => window.__bapLoad?.(0.85))
  const drawn = new Promise(r => {
    const tick = () => (ready() || performance.now() - t0 > 12000 ? r() : requestAnimationFrame(tick))
    requestAnimationFrame(tick)
  })
  Promise.all([account, drawn])
    .then(() => cap(Promise.all([...root.querySelectorAll('img')].filter(img => img.getBoundingClientRect().top < innerHeight).map(img => (img.complete ? 0 : img.decode().catch(() => 0)))), 2000))
    .then(() => {
      window.__bapLoad?.(0.95)
      setTimeout(() => requestAnimationFrame(() => window.__bapLoaded?.()), Math.max(0, BOOT_MIN - performance.now()))
      // the app's own files are on the phone: warm the screens people open next
      if (IS_APP) (window.requestIdleCallback ?? (f => setTimeout(f, 1500)))(() => {
        for (const f of [() => import('./components/SimPage'), () => import('./components/app/AppCareer'), () => import('./components/app/AppCompete'), () => import('./components/app/AppSquad')]) f().catch(() => {})
      })
    })
}

// the website's bottom rail: under the nav, its close button on top (lib/railLayer.js)
if (!IS_APP) import('./lib/railLayer').then(m => m.startRailLayer()).catch(() => {})
// and measured into --web-rail, which every layout keeps clear of (lib/railWatch.js)
if (!IS_APP) import('./lib/railWatch').then(m => m.startRailWatch()).catch(() => {})
// dev server only: ?rail puts a simulated rail on the page and outlines anything left under it (lib/railGuard.js)
if (import.meta.env.DEV && !IS_APP) import('./lib/railGuard').then(m => m.startRailGuard()).catch(() => {})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <AppMotion>
          {/* (one boundary: the game mounts before the dock, as it did when it wasn't lazy) */}
          <Suspense fallback={null}>
            {isBaseball ? <BaseballApp /> : isSoccer ? <SoccerApp /> : isBucket ? <BucketApp /> : <App />}
            <UsernamePrompt />
            <PasswordReset />
            {AppTabBar && <Suspense fallback={null}><AppTabBar /></Suspense>}
          </Suspense>
        </AppMotion>
      </HelmetProvider>
      <AppInfra />
    </ErrorBoundary>
  </StrictMode>,
)
// the native splash waits for the loading screen (capacitor.config.json); index.html
// lets it go as soon as it paints, and this is the backup once the app's code runs
if (IS_APP) import('@capacitor/splash-screen').then(m => m.SplashScreen.hide({ fadeOutDuration: 150 })).catch(() => {})
dropLoader()
