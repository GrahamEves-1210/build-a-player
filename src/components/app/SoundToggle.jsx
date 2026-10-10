import { useEffect, useState } from 'react'
import { sfx, isMuted, setMuted } from '../../lib/juice'

// Sound on / off (the speaker): on the desktop website's Home and nav bar
export default function SoundToggle({ className = '' }) {
  const [muted, set] = useState(() => isMuted())
  useEffect(() => { const on = () => set(isMuted()); window.addEventListener('bap:sound', on); return () => window.removeEventListener('bap:sound', on) }, [])
  const flip = () => { setMuted(!muted); set(!muted); window.dispatchEvent(new CustomEvent('bap:sound')); if (muted) setTimeout(() => sfx('tap'), 30) }
  return (
    <button className={`ag-icon-btn ag-sound-btn${className ? ` ${className}` : ''}`} onClick={flip} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 10v4h4l5 4V6L8 10H4z" fill="currentColor" stroke="none" />
        {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a9 9 0 0 1 0 12" /></>}
      </svg>
    </button>
  )
}

