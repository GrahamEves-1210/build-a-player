import { useState } from 'react'
import { franchiseCard, FRANCHISE_ART } from '../../lib/franchiseLive'
import './franchise-card.css'

// FRANCHISE on football's Home: the card that takes SQUAD BUILDER's place while the switch is on
// (lib/franchiseLive.js). This file and its stylesheet are all of Franchise that Home loads: the mode, its
// engine and its art come when the card is tapped (App.jsx: lazy).
// The card is a line off the front office's own sheet: three ruled rows (the job, the league, the season; once
// there's a franchise on this device, its team's record, the week and the next game: the note the mode leaves
// when it saves, franchiseCard), under a bar in the team's colour.

// before there's a franchise on this device
const OPEN = [['JOB', 'GM'], ['LEAGUE', '32 TEAMS'], ['SEASON', '2026']]

// the mode's own picture, once the file exists (FRANCHISE_ART.card); until then the box isn't there
const Art = () => (FRANCHISE_ART.card
  ? <span className="ag-fr-art" aria-hidden="true"><img src={FRANCHISE_ART.card} alt="" loading="lazy" decoding="async" draggable={false} onError={e => { e.currentTarget.parentNode.style.display = 'none' }} /></span>
  : null)

export default function FranchiseCard({ onClick }) {
  const [c] = useState(franchiseCard)
  const rows = c?.rows?.length ? c.rows.slice(0, 3) : OPEN
  return (
    <button className="ag-way ag-mc ag-mc--fr is-small" style={c?.color ? { '--fr-team': c.color } : undefined} onClick={onClick} aria-label={`Franchise. ${rows.map(r => r.join(' ')).join(', ')}`}>
      <span className="ag-mc-head"><b>FRANCHISE<i className="ag-mc-tag">NEW</i></b></span>
      <Art />
      <span className="ag-fr-sheet" aria-hidden="true">{rows.map(([k, v]) => <span key={k}><i>{k}</i><b>{v}</b></span>)}</span>
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
        <span className="ag-eyebrow">{c?.rows?.length ? c.rows.map(r => r.join(' ')).join(' · ') : 'GENERAL MANAGER · EVERY SEASON'}</span>
        <span className="ag-card-title">FRANCHISE</span>
        <span className="ag-card-sub">{c ? 'The front office is as it was left.' : 'Take over a team as its GM. Build the players you want; its real roster fills every other spot.'}</span>
      </span>
    </button>
  )
}
