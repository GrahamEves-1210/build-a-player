import { useState } from 'react'
import AppCards from './AppCards'
import AppAchievements from './AppAchievements'
import { useProgress } from '../../lib/progress'
import { sfx } from '../../lib/juice'

// The HOF (dock → HOF): the card binder and the achievements, one screen with
// two tabs. Profile, the Shop and Online open it on the tab they mean.
//
// A tab stays mounted once it's been opened and is only hidden when it's off. Each is a whole
// screen with this toggle inside it: swapping them rebuilt everything on every tap, the new
// toggle fading and sliding in while dozens of entrance animations replayed around it.

export default function AppHall({ tab: startTab = 'cards', sport, onClose }) {
  const [tab, setTab] = useState(startTab)
  const [opened, setOpened] = useState({ [startTab]: true })
  const p = useProgress()
  const go = to => {
    if (to === tab) return
    setOpened(o => ({ ...o, [to]: true }))
    setTab(to)
    sfx('tap')
  }
  const tabs = (
    <div className="ag-seg hall-tabs" role="tablist" aria-label="HOF">
      <button role="tab" aria-selected={tab === 'cards'} className={tab === 'cards' ? 'is-on' : ''} onClick={() => go('cards')}>
        {tab === 'cards' && <span className="ag-seg-pill" />}
        CARDS <small>{Object.keys(p.cards ?? {}).length.toLocaleString()}</small>
      </button>
      <button role="tab" aria-selected={tab === 'achievements'} className={tab === 'achievements' ? 'is-on' : ''} onClick={() => go('achievements')}>
        {tab === 'achievements' && <span className="ag-seg-pill" />}
        ACHIEVEMENTS {p.claimable ? <span className="ag-tab-badge hall-badge">{p.claimable}</span> : null}
      </button>
    </div>
  )
  const pane = name => `hall-pane${tab === name ? '' : ' is-off'}${startTab === name ? '' : ' is-later'}`
  return (
    <>
      {opened.cards && <div className={pane('cards')}><AppCards sport={sport} onClose={onClose} hall={tabs} /></div>}
      {opened.achievements && <div className={pane('achievements')}><AppAchievements onClose={onClose} hall={tabs} /></div>}
    </>
  )
}
