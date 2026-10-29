import { useEffect, useState } from 'react'
import { useProgress } from '../../lib/progress'
import { sellsHere, onStorefront } from '../../lib/storefront'
import { PRO_PRICE, perMonth } from '../../lib/webCheckout'
import { IS_APP } from '../../lib/platform'
import { useStorePrices, PRO_PLAN_ID } from '../../lib/iap'
import { IconCrown, IconCheck } from './icons'
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
  const store = useStorePrices()
  if (p.pro || !sells) return null
  return (
    <button className="pro-card ag-pop" style={delay ? { '--d': delay } : undefined} onClick={() => nav('pro')}>
      <span className="pro-card-txt">
        <span className="pro-card-title"><IconCrown size={18} /> BAP PRO</span>
        <span className="pro-card-perks">
          {['+50% coins from every game', 'Pro Vault looks included', 'No ads', 'Pro badge and Discord role'].map(t => <span key={t}><IconCheck size={13} />{t}</span>)}
        </span>
      </span>
      <span className="pro-card-cta">
        <span className="pro-card-go">GO PRO</span>
        {/* website: from the yearly plan's monthly figure, with what's billed; apps: the monthly plan as billed */}
        <small>{!IS_APP && perMonth(PRO_PRICE.year) ? <>from {perMonth(PRO_PRICE.year)}/mo<br />billed yearly</> : `${store[PRO_PLAN_ID.month] ?? PRO_PRICE.month} a month`}</small>
      </span>
    </button>
  )
}
