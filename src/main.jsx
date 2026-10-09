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
import { IS_APP, APP_LOOK } from './lib/platform'
// App shell (dock, Daily, Cards, shop, toasts). The website loads it too for
// the app-look home and profile screens (APP_LOOK in lib/platform.js).
const AppTabBar = (IS_APP || APP_LOOK) ? lazy(() => import('./components/AppTabBar.jsx')) : null

if (IS_APP) {
  document.documentElement.classList.add('is-app')
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        {isBucket ? <BucketApp /> : <App />}
        {AppTabBar && <Suspense fallback={null}><AppTabBar /></Suspense>}
      </HelmetProvider>
      {!IS_APP && <Analytics />}
    </ErrorBoundary>
  </StrictMode>,
)
