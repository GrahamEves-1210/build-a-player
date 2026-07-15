import { StrictMode } from 'react'

// Adds class on first touch — CSS uses this to kill sticky :hover states
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
import { Analytics } from '@vercel/analytics/react'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import BucketApp from './components/BucketApp.jsx'

function showUpdateBanner() {
  const banner = document.createElement('div')
  banner.id = 'sw-update-banner'
  banner.style.cssText = [
    'position:fixed',
    'bottom:72px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:99999',
    'background:#1a1d27',
    'border:1px solid rgba(255,255,255,0.12)',
    'border-radius:12px',
    'padding:10px 14px',
    'display:flex',
    'align-items:center',
    'gap:10px',
    'font-family:Outfit,sans-serif',
    'font-size:13px',
    'font-weight:600',
    'color:#e2e8f0',
    'box-shadow:0 4px 24px rgba(0,0,0,0.6)',
    'width:calc(100% - 32px)',
    'max-width:340px',
    'box-sizing:border-box',
  ].join(';')
  banner.innerHTML = `
    <span style="flex:1;line-height:1.3">New version available</span>
    <button id="sw-update-btn" style="background:#3b82f6;color:#fff;border:none;border-radius:7px;padding:6px 13px;font-size:12px;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;white-space:nowrap">Update</button>
    <button id="sw-dismiss-btn" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:20px;line-height:1;padding:0 2px;flex-shrink:0">×</button>
  `
  document.body.appendChild(banner)
  document.getElementById('sw-update-btn').addEventListener('click', () => updateSW(true))
  document.getElementById('sw-dismiss-btn').addEventListener('click', () => banner.remove())
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { showUpdateBanner() },
})

const isBucket = window.location.pathname.startsWith('/bucket')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isBucket ? <BucketApp /> : <App />}
    <Analytics />
  </StrictMode>,
)
