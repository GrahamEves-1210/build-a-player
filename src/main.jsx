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
import { HelmetProvider } from 'react-helmet-async'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import './app-game.css'
import App from './App.jsx'
import BucketApp from './components/BucketApp.jsx'
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
// App: Discord sign-in comes back through the app's own link
if (IS_APP) import('./lib/appAuth').then(m => m.initAppAuth()).catch(() => {})
// Ad rail preview (More → Ad rail preview, or ?rail on the website)
import('./lib/fakeRail').then(m => m.initRailPreview()).catch(() => {})

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    if (regs.length > 0) {
      Promise.all(regs.map(r => r.unregister())).then(() => window.location.reload())
    }
  })
}

const isBucket = window.location.pathname.startsWith('/bucket')
if ((IS_APP || APP_LOOK) && isBucket) document.documentElement.classList.add('is-bucket')   // app theme: orange accent

// the boot guard in index.html: the app's code is running
window.__bapStarted = true

// The loading screen (index.html) fills with real progress: the code is running
// now, then the fonts, then the first real screen drawn finishes it
window.__bapLoad?.(0.6)
try { document.fonts?.ready?.then(() => window.__bapLoad?.(0.8)) } catch {}
function dropLoader() {
  if (!document.getElementById('bap-loader')) return
  const root = document.getElementById('root')
  const t0 = performance.now()
  const ready = () => root && root.children.length > 0 && root.querySelector('.ag-screen, .ag-home, main, .game-layout, .ag-shell, section, header')
  const tick = () => {
    if (ready() || performance.now() - t0 > 12000) { requestAnimationFrame(() => window.__bapLoaded?.()); return }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        {isBucket ? <BucketApp /> : <App />}
        {AppTabBar && <Suspense fallback={null}><AppTabBar /></Suspense>}
      </HelmetProvider>
      {!IS_APP && <Analytics />}
      <AppInfra />
    </ErrorBoundary>
  </StrictMode>,
)
// the native splash waits for the loading screen (capacitor.config.json); index.html
// lets it go as soon as it paints, and this is the backup once the app's code runs
if (IS_APP) import('@capacitor/splash-screen').then(m => m.SplashScreen.hide({ fadeOutDuration: 150 })).catch(() => {})
dropLoader()
