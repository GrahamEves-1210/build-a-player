import { useState } from 'react'
import { watchFor } from '../../lib/rewardedAd'
import { sfx, haptic } from '../../lib/juice'
import { IconPlay } from './icons'

// "Watch a video for X": one rewarded video, then onReward(). App only (callers
// decide when it's offered). Shows its own loading state and the reason it
// didn't pay (skipped, or no video to show).
export default function WatchVideo({ label, sub, onReward, className = '' }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const go = async () => {
    if (busy) return
    setBusy(true); setNote('')
    const r = await watchFor()
    setBusy(false)
    if (r.ok) { sfx('claim'); haptic('success'); onReward() }
    else { setNote(r.note); sfx('deny') }
  }
  return (
    <div className={`wv ${className}`}>
      <button className="wv-btn" onClick={go} disabled={busy}>
        <span className="wv-ico"><IconPlay size={18} /></span>
        <span className="wv-txt"><b>{busy ? 'LOADING VIDEO…' : label}</b>{sub && <small>{sub}</small>}</span>
      </button>
      {note && <p className="wv-note" role="status">{note}</p>}
    </div>
  )
}
