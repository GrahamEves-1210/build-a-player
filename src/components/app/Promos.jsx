import { useEffect, useState } from 'react'
import { useProgress } from '../../lib/progress'
import { TIERS, TIER_XP, PASS_PRICE, daysLeft, daysLeftText } from '../../lib/pass'
import { dayKey } from '../../lib/progress'
import { sellsHere, onStorefront } from '../../lib/storefront'
import { PRO_PRICE } from '../../lib/webCheckout'
import { IconCrown } from './icons'
import './pass.css'

// The Builder Pass and BAP Pro, where players look: Home and the Shop.
// The app outside the US App Store doesn't sell (lib/storefront.js): no prices there,
// and no Pro card for someone who can't buy it.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

function useSells() {
  const [sells, setSells] = useState(sellsHere)
  useEffect(() => onStorefront(() => setSells(sellsHere())), [])
  return sells
}

export function PassCard({ delay }) {
  const p = useProgress()
  const sells = useSells()
  const bp = p.bp
  if (!bp) return null
  const maxed = bp.tier >= TIERS
  const sub = !p.signedIn ? 'Free rewards every other level · sign in to start'
    : bp.ready > 0 ? `${bp.ready} ${bp.ready === 1 ? 'reward' : 'rewards'} ready to claim`
    : bp.owned ? `${bp.season.name} · premium · ${maxed ? 'every level reached' : `${TIER_XP - bp.into} XP to level ${bp.tier + 1}`}`
    : `${bp.season.name} · free track${sells && !bp.over ? ` · premium ${PASS_PRICE}` : ''}`
  return (
    <button className={`bp-card ag-pop${bp.owned ? ' is-premium' : ''}`} style={delay ? { '--d': delay } : undefined} onClick={() => nav('pass')}>
      <span className="bp-card-tier"><small>LVL</small><b>{bp.tier}</b></span>
      <span className="bp-card-txt">
        <span className="bp-card-title">BUILDER PASS{!bp.over && <em className="bp-card-days">{daysLeftText(daysLeft(bp.season, dayKey()))}</em>}</span>
        <span className="bp-card-sub">{sub}</span>
        <span className="bp-bar" aria-hidden="true"><span style={{ width: `${maxed ? 100 : Math.min(100, (bp.into / TIER_XP) * 100)}%` }} /></span>
      </span>
      <span className={`bp-card-go${bp.ready > 0 ? '' : ' is-quiet'}`}>{bp.ready > 0 ? 'CLAIM' : 'OPEN'}</span>
    </button>
  )
}

export function ProCard({ delay }) {
  const p = useProgress()
  const sells = useSells()
  if (p.pro || !sells) return null
  return (
    <button className="pro-card ag-pop" style={delay ? { '--d': delay } : undefined} onClick={() => nav('pro')}>
      <span className="pro-card-crown"><IconCrown size={22} /></span>
      <span className="pro-card-txt">
        <span className="pro-card-title">BAP PRO</span>
        <span className="pro-card-sub">No ads · Pro Vault · 2x daily coins · Discord role</span>
      </span>
      <span className="pro-card-go">{PRO_PRICE.month}/MO</span>
    </button>
  )
}
