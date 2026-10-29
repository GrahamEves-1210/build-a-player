import { useEffect, useState } from 'react'
import { useProgress } from '../../lib/progress'
import { sellsHere, onStorefront } from '../../lib/storefront'
import { PRO_PRICE, perMonth } from '../../lib/webCheckout'
import { IS_APP } from '../../lib/platform'
import { IconArrow, IconCrown } from './icons'
import { useStorePrices, PRO_PLAN_ID } from '../../lib/iap'
import './pass.css'

// BAP Pro, where players look: Home and the Shop (the Builder Pass is the strip, PassStrip.jsx).
// The app outside the US App Store doesn't sell (lib/storefront.js): no prices there,
// and no Pro card for someone who can't buy it.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))
const PERKS = ['+50% coins', 'No ads', 'Pro Vault', 'Discord role']

function useSells() {
  const [sells, setSells] = useState(sellsHere)
  useEffect(() => onStorefront(() => setSells(sellsHere())), [])
  return sells
}

// Two parts, one card (the whole card is the button): what it is and what you get on the
// left; the price and the call on the right, past a thin gold rule.
export function ProCard({ delay }) {
  const p = useProgress()
  const sells = useSells()
  const store = useStorePrices()
  if (p.pro || !sells) return null
  // website: the yearly plan's monthly figure, with what's billed; apps: the monthly plan as billed
  const yearly = !IS_APP && perMonth(PRO_PRICE.year)
  const amount = yearly || (store[PRO_PLAN_ID.month] ?? PRO_PRICE.month)
  return (
    <div className="pro-card-wrap">
      <button className="pro-card ag-pop" style={delay ? { '--d': delay } : undefined} onClick={() => nav('pro')}>
        <span className="pc-main">
          <span className="pc-title"><IconCrown size={20} />BAP PRO</span>
          <ul className="pc-perks">{PERKS.map(t => <li key={t}>{t}</li>)}</ul>
        </span>
        <span className="pc-side">
          <span className="pc-price"><b>{amount}</b><small>/mo</small></span>
          <span className="pc-bill">{yearly ? `billed ${PRO_PRICE.year} yearly` : 'billed monthly'}</span>
          <span className="pc-go">GO PRO <IconArrow size={14} /></span>
        </span>
      </button>
    </div>
  )
}
