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
import './index.css'
import App from './App.jsx'
import BucketApp from './components/BucketApp.jsx'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    if (regs.length > 0) {
      Promise.all(regs.map(r => r.unregister())).then(() => {
        if ('caches' in window) {
          caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
        }
        window.location.reload()
      })
    }
  })
}

// When Vite chunk hashes change after a deploy, cached users get 404s on old
// chunk filenames → blank screen. Auto-reload once to pick up the new files.
window.addEventListener('vite:preloadError', () => {
  const key = 'bap_chunk_reload'
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1')
    window.location.reload()
  }
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
