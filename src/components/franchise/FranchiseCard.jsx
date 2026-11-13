import { useState } from 'react'
import { franchiseCard, FRANCHISE_ART } from '../../lib/franchiseLive'
import './franchise-card.css'

// FRANCHISE on football's Home: the card that takes SQUAD BUILDER's place while the switch is on
// (lib/franchiseLive.js). This file, its stylesheet and one small picture are all of Franchise that Home loads:
// the mode and its engine come when the card is tapped (App.jsx: lazy).
// The card is the mode's look in small: near-black and flat under a bar in the team's colour, the championship
// trophy the GM is after (public/franchise/art), and one line: the job, or, once there's a franchise on this
// device, where it stands (the note the mode leaves when it saves: franchiseCard).

const OPEN = 'Be the GM'

// the mode's own picture (FRANCHISE_ART.card); its box goes if the file isn't there
const Art = () => (FRANCHISE_ART.card
  ? <span className="ag-fr-art" aria-hidden="true"><img src={FRANCHISE_ART.card} alt="" width="640" height="640" loading="lazy" decoding="async" draggable={false} onError={e => { e.currentTarget.parentNode.style.display = 'none' }} /></span>
  : null)

export default function FranchiseCard({ onClick }) {
  const [c] = useState(franchiseCard)
  return (
    <button className="ag-way ag-mc ag-mc--fr is-small" style={c?.color ? { '--fr-team': c.color } : undefined} onClick={onClick}>
      <span className="ag-mc-head"><b>FRANCHISE<i className="ag-mc-tag">NEW</i></b><small>{c?.line ?? OPEN}</small></span>
      <Art />
    </button>
  )
}

// The classic Home's row (Settings → Classic Home): Squad Builder's row, with the mode's words
export function FranchiseCardClassic({ onClick }) {
  const [c] = useState(franchiseCard)
  return (
    <button className="ag-squad ag-squad--fr ag-pop" style={{ '--d': '350ms', ...(c?.color ? { '--fr-team': c.color } : null) }} onClick={onClick}>
      <Art />
      <span className="ag-card-txt">
        <span className="ag-eyebrow">{c?.line ? c.line.toUpperCase() : 'BE THE GM · EVERY SEASON'}</span>
        <span className="ag-card-title">FRANCHISE</span>
        <span className="ag-card-sub">{c ? 'The front office is as it was left.' : 'Take over a team as its GM. Build the players you want; its real roster fills every other spot.'}</span>
      </span>
    </button>
  )
}
