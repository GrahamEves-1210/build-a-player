import { useProgress, claimAch, achStats } from '../../lib/progress'
import { ACHIEVEMENTS, ACH_GROUPS } from '../../lib/achievements'
import { itemById } from '../../lib/cosmetics'
import { sfx, haptic } from '../../lib/juice'
import { GLYPHS } from './NameTag'
import { IconClose, IconCheck } from './icons'
import { CoinPill } from './AppShop'

// Achievements (app): every goal, its progress, and the reward waiting to be
// claimed (XP, coins, and a few cosmetics you can't buy).

export default function AppAchievements({ onClose }) {
  const p = useProgress()
  const st = achStats()
  const done = ACHIEVEMENTS.filter(a => p.ach?.[a.id]).length
  const pct = Math.round((done / ACHIEVEMENTS.length) * 100)
  const claim = a => {
    const r = claimAch(a.id)
    if (r) { sfx('claim'); haptic('success') }
  }
  const claimAll = () => {
    let any = false
    for (const a of ACHIEVEMENTS) if (p.ach?.[a.id] && !p.achClaimed?.[a.id]) { if (claimAch(a.id)) any = true }
    if (any) { sfx('claim'); haptic('success') }
  }
  // claimable first, then closest to done, then the rest
  const order = list => [...list].sort((a, b) => {
    const ca = p.ach?.[a.id] && !p.achClaimed?.[a.id], cb = p.ach?.[b.id] && !p.achClaimed?.[b.id]
    if (ca !== cb) return ca ? -1 : 1
    const da = !!p.ach?.[a.id], db = !!p.ach?.[b.id]
    if (da !== db) return da ? 1 : -1
    return (st[b.metric] ?? 0) / b.goal - (st[a.metric] ?? 0) / a.goal
  })
  return (
    <div className="ag-screen">
      <div className="ag-screen-head">
        <div>
          <span className="ag-eyebrow">LIFETIME GOALS</span>
          <h1 className="ag-h1">Achievements</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CoinPill />
          <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
        </div>
      </div>
      <div className="ach-summary ag-pop">
        <span className="ach-ring" style={{ '--p': pct }}><span>{pct}%</span></span>
        <span>
          <b>{done} OF {ACHIEVEMENTS.length} UNLOCKED</b>
          <small>{p.claimable ? `${p.claimable} reward${p.claimable > 1 ? 's' : ''} waiting` : 'Rewards: XP, coins and exclusive cosmetics'}</small>
          {p.claimable > 1 && <button className="ach-claim" style={{ marginTop: 8, display: 'block' }} onClick={claimAll}>CLAIM ALL</button>}
        </span>
      </div>
      {ACH_GROUPS.map(g => (
        <div key={g} className="ach-group">
          <div className="ach-group-title">{g.toUpperCase()}</div>
          {order(ACHIEVEMENTS.filter(a => a.group === g)).map((a, i) => {
            const unlocked = !!p.ach?.[a.id]
            const claimed = !!p.achClaimed?.[a.id]
            const now = Math.min(a.goal, st[a.metric] ?? 0)
            const Glyph = GLYPHS[a.glyph] ?? GLYPHS.star
            const item = a.item ? itemById(a.item) : null
            return (
              <div key={a.id} className={`ach-row ag-pop${unlocked ? (claimed ? ' is-done' : ' is-claim') : ''}`} style={{ '--d': `${i * 30}ms` }}>
                <span className="ach-ico">{claimed ? <IconCheck size={20} /> : <Glyph size={22} />}</span>
                <span className="ach-txt">
                  <span className="ach-title">{a.title}</span>
                  <span className="ach-desc" data-reward={`+${a.xp} XP${a.coins ? ` · +${a.coins} COINS` : ''}`}>{a.desc}{item ? ` · unlocks ${item.name}` : ''}</span>
                  {!unlocked && <span className="ach-bar"><span style={{ width: `${(now / a.goal) * 100}%` }} /></span>}
                </span>
                {unlocked && !claimed
                  ? <button className="ach-claim" onClick={() => claim(a)}>CLAIM</button>
                  : <span className="ach-reward">{claimed ? <span className="ach-done-tag">CLAIMED</span> : <span>{now.toLocaleString()}/{a.goal.toLocaleString()}</span>}<span><b>+{a.xp}</b> XP{a.coins ? <> · <b>+{a.coins}</b> C</> : null}</span></span>}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
