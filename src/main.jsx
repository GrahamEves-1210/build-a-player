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
import { IS_APP } from './lib/platform'
// App-only shell (dock, Daily, Cards, toasts) — never downloaded on the website
const AppTabBar = IS_APP ? lazy(() => import('./components/AppTabBar.jsx')) : null

if (IS_APP) {
  document.documentElement.classList.add('is-app')
  // No pinch/auto zoom in the app: iOS zooms into any focused field under 16px
  // (chat, search); a fixed scale keeps the screen still while you type.
  document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
}
// App: sound effects, haptics and confetti (lib/juice.js)
if (IS_APP) import('./lib/juice').then(m => m.initJuice()).catch(() => {})
// App: XP, streak, missions, cards (lib/progress.js)
if (IS_APP) import('./lib/progress').then(m => m.initProgress()).catch(() => {})

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    if (regs.length > 0) {
      Promise.all(regs.map(r => r.unregister())).then(() => window.location.reload())
    }
  })
}

const isBucket = window.location.pathname.startsWith('/bucket')
if (IS_APP && isBucket) document.documentElement.classList.add('is-bucket')   // app theme: orange accent

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
