import { createPortal } from 'react-dom'
import OfflineBanner from './OfflineBanner'
import UpdateGate from './UpdateGate'
import './infra.css'

// App plumbing that draws something: the offline strip and the update gate.
// Portalled to <body>: #root is its own stacking context (z-index 1), so
// anything inside it sits under body-level overlays like the tutorial.
// The rest (error log, deep links, notifications, rating prompt, version
// check) starts from lib/appInfra.js.
export default function AppInfra() {
  if (typeof document === 'undefined') return null
  return createPortal(
    <>
      <OfflineBanner />
      <UpdateGate />
    </>,
    document.body,
  )
}
