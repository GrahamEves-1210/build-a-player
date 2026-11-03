import { useEffect, useRef, useState } from 'react'
import { IS_APP } from '../../lib/platform'

// A slim strip under the status bar while the device is offline; "Back online"
// for a moment when the connection returns. navigator.onLine + its events on
// the website; @capacitor/network in the app (more reliable inside a WebView).
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  const [back, setBack] = useState(false)
  const wasOffline = useRef(!online)
  const timer = useRef(null)

  useEffect(() => {
    const apply = on => {
      setOnline(on)
      clearTimeout(timer.current)
      if (on && wasOffline.current) { setBack(true); timer.current = setTimeout(() => setBack(false), 2200) }
      if (!on) setBack(false)
      wasOffline.current = !on
    }
    const onUp = () => apply(true)
    const onDown = () => apply(false)
    window.addEventListener('online', onUp)
    window.addEventListener('offline', onDown)
    let handle = null, dead = false
    if (IS_APP) {
      import('@capacitor/network').then(async ({ Network }) => {
        if (dead) return
        try { apply((await Network.getStatus()).connected) } catch {}
        handle = await Network.addListener('networkStatusChange', st => apply(!!st.connected))
        if (dead) handle?.remove()
      }).catch(() => {})
    }
    return () => {
      dead = true
      window.removeEventListener('online', onUp)
      window.removeEventListener('offline', onDown)
      handle?.remove()
      clearTimeout(timer.current)
    }
  }, [])

  if (online && !back) return null
  return (
    <div className={`inf-offline${online ? ' inf-offline--back' : ''}`} role="status" aria-live="polite">
      <span className="inf-offline-dot" />
      {online ? 'Back online' : 'You’re offline. Your games still save on this device.'}
    </div>
  )
}
