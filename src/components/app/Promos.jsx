import { useEffect, useState } from 'react'
import { useProgress } from '../../lib/progress'
import { sellsHere, onStorefront } from '../../lib/storefront'
import { PRO_PRICE } from '../../lib/webCheckout'
import { IconCrown } from './icons'
import './pass.css'

// BAP Pro, where players look: Home and the Shop (the Builder Pass is the strip, PassStrip.jsx).
// The app outside the US App Store doesn't sell (lib/storefront.js): no prices there,
// and no Pro card for someone who can't buy it.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

function useSells() {
  const [sells, setSells] = useState(sellsHere)
  useEffect(() => onStorefront(() => setSells(sellsHere())), [])
  return sells
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
        <span className="pro-card-sub">+50% coins · Pro Vault included · No ads · Discord role</span>
      </span>
      <span className="pro-card-go">{PRO_PRICE.month}/MO</span>
    </button>
  )
}
