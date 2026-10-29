import { useEffect, useState } from 'react'
import { useProgress } from '../../lib/progress'
import { sellsHere, onStorefront } from '../../lib/storefront'
import { PRO_PRICE, perMonth } from '../../lib/webCheckout'
import { IS_APP } from '../../lib/platform'
import { IconArrow } from './icons'
import { useStorePrices, PRO_PLAN_ID } from '../../lib/iap'
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

// a big gold crown, faint, half off the card's right edge, and a sheen behind it
function ProArt() {
  return (
    <svg className="pro-card-art" viewBox="0 0 200 120" aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
      <defs><linearGradient id="pcg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#f5dc8a" stopOpacity=".05" /><stop offset="1" stopColor="#f5dc8a" stopOpacity=".4" /></linearGradient></defs>
      <path d="M95 -10 L165 130 M125 -10 L195 130" stroke="rgba(245,220,138,.07)" strokeWidth="14" />
      <g transform="translate(14 -12)">
        <path d="M112 92 L100 38 L132 62 L152 26 L172 62 L204 38 L192 92 Z" fill="url(#pcg)" stroke="rgba(245,220,138,.55)" strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="112" y="98" width="80" height="9" rx="3" fill="url(#pcg)" stroke="rgba(245,220,138,.45)" strokeWidth="2" />
        <circle cx="100" cy="36" r="5" fill="rgba(245,220,138,.6)" /><circle cx="152" cy="23" r="6" fill="#f5dc8a" /><circle cx="204" cy="36" r="5" fill="rgba(245,220,138,.6)" />
      </g>
    </svg>
  )
}

export function ProCard({ delay }) {
  const p = useProgress()
  const sells = useSells()
  const store = useStorePrices()
  if (p.pro || !sells) return null
  return (
    // Built like the mode cards (Career, Compete): an eyebrow, a display title, one line,
    // art behind, and the price where they keep their call to action
    <div className="pro-card-wrap">
    <button className="pro-card ag-pop" style={delay ? { '--d': delay } : undefined} onClick={() => nav('pro')}>
      <ProArt />
      <span className="ag-card-txt">
        <span className="ag-eyebrow">MEMBERSHIP</span>
        <span className="ag-card-title">BAP PRO</span>
        {/* website: the yearly plan's monthly figure, with what's billed; apps: the monthly plan as billed */}
        <span className="pro-card-price">
          {!IS_APP && perMonth(PRO_PRICE.year)
            ? <><b>{perMonth(PRO_PRICE.year)}</b><small>/MO · BILLED YEARLY</small></>
            : <><b>{store[PRO_PLAN_ID.month] ?? PRO_PRICE.month}</b><small>/MONTH</small></>}
        </span>
      </span>
      {/* the perks: one row of bullets in the middle (the whole card is the button) */}
      <span className="pro-card-mid">
        <ul className="pro-card-perks">
          {['+50% coins', 'No ads', 'Pro Vault', 'Discord role'].map(t => <li key={t}>{t}</li>)}
        </ul>
        {/* a call in words, not a box: the card is the button */}
        <span className="pro-card-go">GO PRO <IconArrow size={18} /></span>
      </span>
    </button>
    </div>
  )
}
