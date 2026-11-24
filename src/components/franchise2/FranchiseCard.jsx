import { useState } from 'react'
import { franchiseCard, nbaFranchiseCard, FRANCHISE_ART, FRANCHISE_TURN, NBA_FRANCHISE_ART, NBA_FRANCHISE_TURN } from '../../lib/franchiseLive'
import TrophyTurn from './TrophyTurn'
import './franchise-card.css'

// FRANCHISE on football's Home: the card that takes SQUAD BUILDER's place while the switch is on
// (lib/franchiseLive.js). This file, its stylesheet and one small picture are all of Franchise that Home loads:
// the mode and its engine come when the card is tapped (App.jsx: lazy).
// The card is the mode's look in small: near-black and flat under a bar in the team's colour, the football off the
// championship trophy the GM is after, spinning (public/franchise/art), and one line: the job, or, once there's a franchise on this
// device, where it stands (the note the mode leaves when it saves: franchiseCard).

const OPEN = 'Be the GM'

// a finger or a pointer on the card: the mode and its engine start loading before the tap lands
let warmed = false
const warm = () => { if (warmed) return; warmed = true; import('./FranchiseMode').catch(() => { warmed = false }); import('../../lib/franchise2').catch(() => {}) }
const WARM = { onPointerEnter: warm, onPointerDown: warm, onFocus: warm }

// While the mode's file is on its way (App.jsx Suspense, and the season's screens inside the mode): the screen that's
// coming, drawn flat in its own shapes (owner 11-15: the site's generic card skeletons looked wrong here). kind 'slots':
// the save slots (the trophy still, FRANCHISE, three slots); 'hub': a team's header, the four tabs, this week's game and
// its rows. Nothing moves, and it fades in only after a beat, so a quick load shows nothing at all.
export function FranchiseWait({ kind = 'slots' }) {
  if (kind === 'hub') {
    return (
      <div className="fr-wait fr-wait--hub" role="status" aria-label="Opening the front office">
        <div className="fr-wait-in">
          <div className="fr-wait-team"><i /><span><i /><i /></span></div>
          <div className="fr-wait-tabs"><i /><i /><i /><i /></div>
          <div className="fr-wait-game" />
          <div className="fr-wait-rows"><i /><i /><i /><i /></div>
        </div>
      </div>
    )
  }
  return (
    <div className="fr-wait" role="status" aria-label="Opening the front office">
      <div className="fr-wait-in">
        <div className="fr-wait-top"><i /><span /></div>
        <div className="fr-wait-hero">{FRANCHISE_ART.hero && <img src={FRANCHISE_ART.hero} alt="" width="1280" height="720" decoding="async" draggable={false} onError={e => { e.currentTarget.style.display = 'none' }} />}</div>
        <div className="fr-wait-chy"><b>FRANCHISE</b></div>
        <div className="fr-wait-slots"><i /><i /><i /></div>
      </div>
    </div>
  )
}

// the mode's own picture (FRANCHISE_ART.card: the trophy's football, 3:2); its box goes if the file isn't there. Over
// it, the ball spinning like a slow spiral, 5 s a turn, a minute at a time (TrophyTurn: asked for only once the card
// is on screen; if it can't play, the still stays)
const Art = ({ art = FRANCHISE_ART, turn = FRANCHISE_TURN }) => (art.card
  ? <span className="ag-fr-art" aria-hidden="true"><img src={art.card} alt="" width="450" height="300" loading="lazy" decoding="async" draggable={false} onError={e => { e.currentTarget.parentNode.style.display = 'none' }} /><TrophyTurn base={turn.card} turns={24} className="ag-fr-turn" /></span>
  : null)

export default function FranchiseCard({ onClick, wide = false }) {
  const [c] = useState(franchiseCard)
  return (
    <button className={`ag-way ag-mc ag-mc--fr${wide ? ' ag-mc--fr-wide' : ' is-small'}`} style={c?.color ? { '--fr-team': c.color } : undefined} onClick={onClick} {...WARM}>
      <span className="ag-mc-head"><b>FRANCHISE<i className="ag-mc-tag">NEW</i></b><small>{c?.line ?? OPEN}</small></span>
      <Art />
    </button>
  )
}

// The classic Home's row (Settings → Classic Home): Squad Builder's row, with the mode's words
export function FranchiseCardClassic({ onClick }) {
  const [c] = useState(franchiseCard)
  return (
    <button className="ag-squad ag-squad--fr ag-pop" style={{ '--d': '350ms', ...(c?.color ? { '--fr-team': c.color } : null) }} onClick={onClick} {...WARM}>
      <Art />
      <span className="ag-card-txt">
        <span className="ag-eyebrow">{c?.line ? c.line.toUpperCase() : 'BE THE GM · EVERY SEASON'}</span>
        <span className="ag-card-title">FRANCHISE</span>
        <span className="ag-card-sub">{c ? 'The front office is as it was left.' : 'Take over a team as its GM. Build the players you want; its real roster fills every other spot.'}</span>
      </span>
    </button>
  )
}

// FRANCHISE on basketball's Home (NBA_FRANCHISE_LIVE): the same card, the NBA mode's note, the chrome basketball spinning
const warmNba = () => { import('./nba/NbaFranchise').catch(() => {}) }
export function NbaFranchiseCard({ onClick }) {
  const [c] = useState(nbaFranchiseCard)
  return (
    <button className="ag-way ag-mc ag-mc--fr ag-mc--fr-wide" style={c?.color ? { '--fr-team': c.color } : undefined} onClick={onClick} onPointerDown={warmNba} onFocus={warmNba}>
      <span className="ag-mc-head"><b>FRANCHISE<i className="ag-mc-tag">NEW</i></b><small>{c?.line ?? OPEN}</small></span>
      <Art art={NBA_FRANCHISE_ART} turn={NBA_FRANCHISE_TURN} />
    </button>
  )
}

