import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { takeToasts, useProgress, markLevelSeen, levelUnlocks, RARITIES } from '../../lib/progress'
import { sfx, haptic, confetti } from '../../lib/juice'
import { IconFlame, IconCards, IconTarget, IconStar, IconCoin, IconMedal, IconPodium } from './icons'
import { EASE_OUT, SPRING_LAYOUT } from '../../lib/motion'
import { RiseText } from './MotionText'

// Top-of-screen toasts (login streak, mission complete, new card) and the
// full-screen level-up moment. Fed by lib/progress.js events. A toast drops in,
// fades up and out when it's done, and the ones under it glide into its place.

const PackReveal = lazy(() => import('./PackReveal'))
const ICONS = { streak: IconFlame, mission: IconTarget, card: IconCards, xp: IconStar, coins: IconCoin, ach: IconMedal, online: IconPodium }
let nextId = 1

export default function AppToasts() {
  const [items, setItems] = useState([])
  const timers = useRef(new Map())
  const [pack, setPack] = useState(null)        // a card pack's cards, opened together (PackReveal)
  const packBuf = useRef([]), packT = useRef(0)

  useEffect(() => {
    const push = t => {
      if (t.kind === 'streak' || t.kind === 'mission') sfx('chime')
      else if (t.kind === 'coins') sfx('coins')   // the coin drop, like every coin claim
      const id = nextId++
      setItems(list => [...list.slice(-2), { id, ...t }])
      timers.current.set(id, setTimeout(() => setItems(list => list.filter(x => x.id !== id)), t.ms ?? 2600))
    }
    const drain = () => takeToasts().forEach(push)
    const onCard = e => {
      const c = e.detail
      // a pack's cards arrive together: they open as one pack, not a stack of toasts
      if (c.pack) {
        packBuf.current.push(c)
        clearTimeout(packT.current)
        packT.current = setTimeout(() => { const cards = packBuf.current.splice(0); if (cards.length) setPack(cards) }, 250)
        return
      }
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
      clearTimeout(packT.current)
    }
  }, [])

  return <>
    {createPortal(
    <div className="ag-toasts" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {items.map(t => {
          const Icon = ICONS[t.kind] ?? IconStar
          return (
            <motion.div key={t.id} layout className={`ag-toast ag-toast--${t.kind}${t.rank != null ? ` ag-rar-${t.rank}` : ''}`}
              initial={{ opacity: 0, y: -14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: EASE_OUT } }}
              exit={{ opacity: 0, y: -8, scale: 0.96, transition: { duration: 0.22, ease: EASE_OUT } }}
              transition={SPRING_LAYOUT}>
              <span className="ag-toast-icon"><Icon size={20} /></span>
              <span className="ag-toast-txt">
                <span className="ag-toast-title">{t.title}</span>
                {t.sub && <span className="ag-toast-sub">{t.sub}</span>}
              </span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>,
    document.body,
    )}
    <AnimatePresence>{pack && <Suspense key="pack" fallback={null}><PackReveal cards={pack} onClose={() => setPack(null)} /></Suspense>}</AnimatePresence>
  </>
}

export function LevelUp({ hold }) {
  const p = useProgress()
  const due = !hold && p.seenLevel > 0 && p.lvl.level > p.seenLevel
  // a claim's own animation (juice.js claimFx) plays out first, then the level-up
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!due) { setShow(false); return }
    const t = setTimeout(() => setShow(true), 950)
    return () => clearTimeout(t)
  }, [due])
  const fired = useRef(0)
  useEffect(() => {
    if (show && fired.current !== p.lvl.level) {
      fired.current = p.lvl.level
      setTimeout(() => { sfx('levelup'); haptic('success'); confetti(120) }, 250)
    }
  }, [show, p.lvl.level])
  if (!show || !due) return null
  const { title, spots } = levelUnlocks(p.lvl.level, p.seenLevel)
  return createPortal(
    <div className="ag-levelup" onClick={markLevelSeen}>
      <div className="ag-levelup-card" onClick={e => e.stopPropagation()}>
        <span className="ag-eyebrow">LEVEL UP</span>
        <span className="ag-levelup-numwrap"><img className="ag-levelup-star" src="/fx/star.webp" alt="" aria-hidden="true" draggable={false} /><span className="ag-levelup-num">{p.lvl.level}</span></span>
        <span className="ag-levelup-title"><RiseText text={p.lvl.title} delay={320} /></span>
        {(title || spots.length > 0) && (
          <div className="ag-levelup-unlocks">
            {title && <span className="ag-unlock"><b>NEW TITLE</b>{title}</span>}
            {spots.map(s => <span key={s.id} className="ag-unlock"><b>NEW SPOTLIGHT</b><i className={`ag-swatch ag-swatch--${s.id}`} />{s.name}</span>)}
          </div>
        )}
        {p.bp?.ready > 0 && <span className="ag-levelup-pass">{p.bp.ready === 1 ? 'A reward is' : `${p.bp.ready} rewards are`} waiting on the Builder Pass</span>}
        <button className="ag-btn ag-levelup-btn" onClick={markLevelSeen}>CONTINUE</button>
      </div>
    </div>,
    document.body,
  )
}
