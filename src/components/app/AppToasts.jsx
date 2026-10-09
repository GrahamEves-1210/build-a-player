import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { takeToasts, useProgress, markLevelSeen, levelUnlocks, RARITIES } from '../../lib/progress'
import { sfx, haptic, confetti } from '../../lib/juice'
import { IconFlame, IconCards, IconTarget, IconStar, IconCoin, IconMedal, IconPodium } from './icons'

// Top-of-screen toasts (login streak, mission complete, new card) and the
// full-screen level-up moment. Fed by lib/progress.js events.

const ICONS = { streak: IconFlame, mission: IconTarget, card: IconCards, xp: IconStar, coins: IconCoin, ach: IconMedal, online: IconPodium }
let nextId = 1

export default function AppToasts() {
  const [items, setItems] = useState([])
  const timers = useRef(new Map())

  useEffect(() => {
    const push = t => {
      if (t.kind === 'streak' || t.kind === 'mission') sfx('chime')
      else if (t.kind === 'coins') sfx('coin')
      const id = nextId++
      setItems(list => [...list.slice(-2), { id, ...t }])
      timers.current.set(id, setTimeout(() => setItems(list => list.filter(x => x.id !== id)), t.ms ?? 2600))
    }
    const drain = () => takeToasts().forEach(push)
    const onCard = e => {
      const c = e.detail
      if (!c.isNew && c.rank < 2) return
      push({ kind: 'card', rank: c.rank, title: c.isNew ? `NEW CARD · ${RARITIES[c.rank].toUpperCase()}` : `${RARITIES[c.rank].toUpperCase()} PULL`, sub: c.name, ms: 2200 })
      sfx('card', c.rank)
      if (c.rank >= 2 && c.isNew) haptic('medium')
    }
    drain()
    window.addEventListener('bap:toast', drain)
    window.addEventListener('bap:card', onCard)
    return () => {
      window.removeEventListener('bap:toast', drain)
      window.removeEventListener('bap:card', onCard)
      timers.current.forEach(clearTimeout)
    }
  }, [])

  if (!items.length) return null
  return createPortal(
    <div className="ag-toasts" aria-live="polite">
      {items.map(t => {
        const Icon = ICONS[t.kind] ?? IconStar
        return (
          <div key={t.id} className={`ag-toast ag-toast--${t.kind}${t.rank != null ? ` ag-rar-${t.rank}` : ''}`}
            onClick={() => setItems(list => list.filter(x => x.id !== t.id))}>
            <span className="ag-toast-icon"><Icon size={20} /></span>
            <span className="ag-toast-txt">
              <span className="ag-toast-title">{t.title}</span>
              {t.sub && <span className="ag-toast-sub">{t.sub}</span>}
            </span>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}

export function LevelUp({ hold }) {
  const p = useProgress()
  const show = !hold && p.seenLevel > 0 && p.lvl.level > p.seenLevel
  const fired = useRef(0)
  useEffect(() => {
    if (show && fired.current !== p.lvl.level) {
      fired.current = p.lvl.level
      setTimeout(() => { sfx('levelup'); haptic('success'); confetti(120) }, 250)
    }
  }, [show, p.lvl.level])
  if (!show) return null
  const { title, spots } = levelUnlocks(p.lvl.level, p.seenLevel)
  return createPortal(
    <div className="ag-levelup" onClick={markLevelSeen}>
      <div className="ag-levelup-card" onClick={e => e.stopPropagation()}>
        <span className="ag-eyebrow">LEVEL UP</span>
        <span className="ag-levelup-num">{p.lvl.level}</span>
        <span className="ag-levelup-title">{p.lvl.title}</span>
        {(title || spots.length > 0) && (
          <div className="ag-levelup-unlocks">
            {title && <span className="ag-unlock"><b>NEW TITLE</b>{title}</span>}
            {spots.map(s => <span key={s.id} className="ag-unlock"><b>NEW SPOTLIGHT</b><i className={`ag-swatch ag-swatch--${s.id}`} />{s.name}</span>)}
          </div>
        )}
        <button className="ag-btn ag-levelup-btn" onClick={markLevelSeen}>CONTINUE</button>
      </div>
    </div>,
    document.body,
  )
}
