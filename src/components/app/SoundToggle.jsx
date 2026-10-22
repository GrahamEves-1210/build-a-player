import { useEffect, useState } from 'react'
import { sfx, isMuted, setMuted } from '../../lib/juice'
import { IconSound } from './icons'

// Sound on / off (the speaker): on the desktop website's Home and nav bar
export default function SoundToggle({ className = '' }) {
  const [muted, set] = useState(() => isMuted())
  useEffect(() => { const on = () => set(isMuted()); window.addEventListener('bap:sound', on); return () => window.removeEventListener('bap:sound', on) }, [])
  const flip = () => { setMuted(!muted); set(!muted); window.dispatchEvent(new CustomEvent('bap:sound')); if (muted) setTimeout(() => sfx('tap'), 30) }
  return (
    <button className={`ag-icon-btn ag-sound-btn${className ? ` ${className}` : ''}`} onClick={flip} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted}>
      <IconSound muted={muted} size={20} />
    </button>
  )
}

