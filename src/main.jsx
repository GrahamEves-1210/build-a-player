import { StrictMode } from 'react'

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
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import BucketApp from './components/BucketApp.jsx'

let reloading = false
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (reloading) return
  reloading = true
  window.location.reload()
})

registerSW({
  immediate: true,
  onRegisteredSW(swUrl, r) {
    r && setInterval(() => r.update(), 60 * 1000)
  },
})

const isBucket = window.location.pathname.startsWith('/bucket')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      {isBucket ? <BucketApp /> : <App />}
    </HelmetProvider>
    <Analytics />
  </StrictMode>,
)
