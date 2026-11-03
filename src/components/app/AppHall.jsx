import { useState } from 'react'
import AppCards from './AppCards'
import AppAchievements from './AppAchievements'
import { useProgress } from '../../lib/progress'
import { sfx, slideIn } from '../../lib/juice'
import { motion } from 'motion/react'
import { SPRING_LAYOUT } from '../../lib/motion'

// The Hall (dock → HALL): the card binder and the achievements, one screen with
// two tabs. Profile, the Shop and Online open it on the tab they mean.

export default function AppHall({ tab: startTab = 'cards', sport, onClose }) {
  const [tab, setTab] = useState(startTab)
  const p = useProgress()
  const tabs = (
    <div className="ag-seg hall-tabs" role="tablist" aria-label="The Hall">
      <button role="tab" aria-selected={tab === 'cards'} className={tab === 'cards' ? 'is-on' : ''} onClick={() => { if (tab === 'cards') return; slideIn(-1); setTab('cards'); sfx('tap') }}>
        {tab === 'cards' && <motion.span layoutId="seg-hall" className="ag-seg-pill" transition={SPRING_LAYOUT} />}
        CARDS <small>{Object.keys(p.cards ?? {}).length.toLocaleString()}</small>
      </button>
      <button role="tab" aria-selected={tab === 'achievements'} className={tab === 'achievements' ? 'is-on' : ''} onClick={() => { if (tab === 'achievements') return; slideIn(1); setTab('achievements'); sfx('tap') }}>
        {tab === 'achievements' && <motion.span layoutId="seg-hall" className="ag-seg-pill" transition={SPRING_LAYOUT} />}
        ACHIEVEMENTS {p.claimable ? <span className="ag-tab-badge hall-badge">{p.claimable}</span> : null}
      </button>
    </div>
  )
  return tab === 'achievements'
    ? <AppAchievements onClose={onClose} hall={tabs} />
    : <AppCards sport={sport} onClose={onClose} hall={tabs} />
}
