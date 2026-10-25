import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { RARITIES } from '../../lib/progress'
import { sfx, haptic } from '../../lib/juice'
import { nflHeadshot, HEADSHOT_BASE } from '../../utils/simulation'
import HEADSHOTS from '../../data/headshots.json'
import NBA_HEADSHOTS from '../../data/nba-headshots.json'
import { NFL_TEAMS } from '../../data/nfl-teams'
import { NBA_TEAMS } from '../../data/nba-teams'
import { IconStar } from './icons'
import { useReducedMotionApp } from '../../lib/motion'

// A card pack opening (Builder Pass packs): the cards are dealt face down from the
// deck into a fan, then turn over one at a time, the rarest last (each card's own
// sound; a Legend glows). Cards from anywhere else still arrive as toasts (AppToasts).
// SHOW ALL turns the rest over at once; then tap anywhere, or NICE, to close.

const TEAM_COLOR = Object.fromEntries([...NFL_TEAMS.map(t => [`nfl:${t.short}`, t.color]), ...NBA_TEAMS.map(t => [`bucket:${t.short}`, t.color])])
const photoOf = c => (c.sport === 'bucket'
  ? (NBA_HEADSHOTS[c.name] ? `${HEADSHOT_BASE}/nba/${NBA_HEADSHOTS[c.name]}.webp` : '/genericdark.webp')
  : (nflHeadshot(HEADSHOTS[c.name]) ?? '/genericdark.webp'))
const lastName = n => { const p = String(n || '').split(' '); return p.length > 1 ? p.slice(1).join(' ') : n }

// where each card lands in the fan: spread across, tilted outward, the ends a little lower
// (five cards are a little narrower, so every name still shows past the next card)
const cardW = n => (n > 4 ? 94 : 104)
function fanOf(n, i) {
  const mid = (n - 1) / 2, k = n > 1 ? (i - mid) / mid : 0
  return { x: (i - mid) * (n > 4 ? 67 : 78), y: Math.abs(k) * 14, rotate: k * (n > 4 ? 12 : 9) }
}

export default function PackReveal({ cards: given, onClose }) {
  const reduce = useReducedMotionApp()
  const [cards] = useState(() => [...given].sort((a, b) => a.rank - b.rank))   // the rarest turns over last
  const n = cards.length
  const timers = useRef([])
  const [shown, setShown] = useState(reduce ? n : 0)   // how many have turned over
  const dealt = 280 + n * 110                            // when the last card has landed
  useEffect(() => {
    if (reduce) return
    timers.current = cards.map((c, i) => setTimeout(() => {
      setShown(s => Math.max(s, i + 1))
      sfx('card', c.rank)
      if (c.rank >= 2) haptic(c.rank >= 3 ? 'heavy' : 'medium')
    }, dealt + 250 + i * 420))
    return () => timers.current.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const showAll = () => {
    timers.current.forEach(clearTimeout)
    const best = cards[n - 1]
    setShown(n)
    sfx('card', best.rank)
    if (best.rank >= 2) haptic(best.rank >= 3 ? 'heavy' : 'medium')
  }
  const done = shown >= n
  const best = Math.max(...cards.map(c => c.rank))
  return createPortal(
    <motion.div className="pk" role="dialog" aria-label={`Card pack, ${n} cards`} onClick={() => done && onClose()}
      initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.2 } }} exit={{ opacity: 0, transition: { duration: 0.22 } }}>
      <span className="ag-eyebrow pk-eyebrow">CARD PACK · {n} {n === 1 ? 'CARD' : 'CARDS'}</span>
      <div className="pk-hand" style={{ '--pk-w': `${cardW(n)}px` }}>
        {cards.map((c, i) => {
          const f = fanOf(n, i)
          const up = i < shown
          return (
            <motion.div key={i} className={`pk-slot${up && c.rank >= 3 ? ' is-legend' : ''}`} style={{ zIndex: i }}
              initial={{ x: 0, y: 320, rotate: 0, scale: 0.6, opacity: 0 }}
              animate={{ x: f.x, y: f.y, rotate: f.rotate, scale: 1, opacity: 1, transition: { delay: 0.12 + i * 0.11, type: 'spring', stiffness: 240, damping: 24 } }}>
              <div className={`pk-flip${up ? ' is-up' : ''}`}>
                <div className="pk-back"><img src="/bap-mark.webp" alt="" draggable={false} /></div>
                <div className={`pk-front ag-ct ag-rar-${c.rank}`} style={{ '--tc': TEAM_COLOR[`${c.sport}:${c.team}`] ?? '#2a3a33' }}>
                  <div className="ag-ct-photo">
                    <img src={photoOf(c)} alt="" draggable={false} onError={e => { e.currentTarget.src = '/genericdark.webp' }} />
                  </div>
                  <div className="ag-ct-foot">
                    <span className="ag-ct-name">{lastName(c.name)}</span>
                    <span className="ag-ct-rar">{RARITIES[c.rank]}</span>
                  </div>
                  <span className={`ag-ct-tag${c.mode === 'all-time' ? ' ag-ct-tag--at' : ''}`}>{c.mode === 'all-time' ? <IconStar size={10} className="ag-ct-star" /> : null}{String(c.pos || '').toUpperCase()}</span>
                  {c.isNew && <span className="pk-new">NEW</span>}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
      <p className={`pk-sum${done ? ' is-on' : ''}`}>{done ? (best >= 3 ? 'A Legend in the pack!' : best >= 2 ? 'An Epic in the pack' : 'Added to your collection') : ' '}</p>
      <button className={`ag-btn pk-btn${done ? ' is-on' : ''}`} onClick={e => { e.stopPropagation(); if (done) onClose(); else showAll() }}>{done ? 'NICE' : 'SHOW ALL'}</button>
    </motion.div>,
    document.body,
  )
}
