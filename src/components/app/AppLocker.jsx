import { useProgress, equip, owns, myVictory } from '../../lib/progress'
import { SLOTS, RARITY, ITEMS, itemById, DEFAULTS } from '../../lib/cosmetics'
import { getUsername } from '../../lib/discord'
import { sfx, haptic, previewVictory } from '../../lib/juice'
import { NameTag, AvatarBadge, ItemPreview } from './NameTag'
import { CoinPill } from './AppShop'
import { IconClose, IconCheck, IconPlay, IconBag, IconArrow } from './icons'

// The Locker (app): everything you own, in one place, one tap to wear it.
// Your look up top (avatar, name color + effect, nameplate), your victory
// effect and sound below it, then a row per slot.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

export default function AppLocker({ onClose }) {
  const p = useProgress()
  const name = getUsername(p.user) || 'Guest'
  const v = myVictory()
  const put = (slot, id) => {
    const cur = p.equip?.[slot] ?? null
    if (cur === id) return
    if (equip(slot, id)) {
      sfx('equip'); haptic('medium')
      if (slot === 'winFx' && id) previewVictory(id, null)
      if (slot === 'winSound' && id) setTimeout(() => sfx(id), 120)
    }
  }
  const owned = ITEMS.filter(i => owns(i.id))
  return (
    <div className="ag-screen lk">
      <div className="ag-screen-head">
        <div>
          <span className="ag-eyebrow">YOUR LOOK</span>
          <h1 className="ag-h1">Locker</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CoinPill />
          <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
        </div>
      </div>

      <div className="lk-hero ag-pop">
        <div className="lk-hero-id">
          <AvatarBadge self name={name} size={72} level={p.lvl.level} />
          <span className="lk-hero-name"><NameTag self name={name} /></span>
        </div>
        <div className="lk-hero-win">
          <span><b>VICTORY</b>{itemById(v.fx)?.name ?? 'Confetti'} · {itemById(v.sound)?.name ?? 'Air Horn'}</span>
          <button className="ag-chip" onClick={() => previewVictory(v.fx, v.sound)}><IconPlay size={12} /> PLAY IT</button>
        </div>
        <span className="lk-hero-count">{owned.filter(i => !i.free).length} items owned</span>
      </div>

      {SLOTS.map(sl => {
        const mine = ITEMS.filter(i => i.slot === sl.id && owns(i.id)).sort((a, b) => b.rarity - a.rarity)
        const cur = p.equip?.[sl.id] ?? DEFAULTS[sl.id]
        const hasNone = DEFAULTS[sl.id] === null
        return (
          <section key={sl.id} className="lk-slot">
            <div className="lk-slot-head">
              <span className="lk-slot-title">{sl.label.toUpperCase()}</span>
              <span className="lk-slot-cur">{cur ? itemById(cur)?.name : sl.id === 'avatar' ? 'Initial' : 'None'}</span>
            </div>
            <div className="lk-row">
              {hasNone && (
                <button className={`lk-tile${!cur ? ' is-on' : ''}`} style={{ '--rar': '#6ee7b7' }} onClick={() => put(sl.id, null)}>
                  <span className="lk-tile-stage">
                    {sl.id === 'avatar' ? <AvatarBadge name={name} size={50} cos={{}} /> : <span className="ip-name"><NameTag name={name} cos={{}} plate={false} /></span>}
                  </span>
                  <span className="lk-tile-name">{sl.id === 'avatar' ? 'Initial' : 'None'}</span>
                  {!cur && <span className="lk-tile-check"><IconCheck size={12} /></span>}
                </button>
              )}
              {mine.map(i => {
                const on = cur === i.id
                return (
                  <button key={i.id} className={`lk-tile${on ? ' is-on' : ''}`} style={{ '--rar': RARITY[i.rarity].color }} onClick={() => put(sl.id, i.id)}>
                    <span className="lk-tile-stage">{i.slot === 'avatar' ? <AvatarBadge cos={{ avatar: i.id }} name={name} size={50} /> : <ItemPreview item={i} name={name} />}</span>
                    <span className="lk-tile-name">{i.name}</span>
                    {on && <span className="lk-tile-check"><IconCheck size={12} /></span>}
                  </button>
                )
              })}
              <button className="lk-tile lk-tile--shop" onClick={() => nav(`shop:${sl.id}`)}>
                <span className="lk-tile-stage"><IconBag size={26} /></span>
                <span className="lk-tile-name">{mine.length || hasNone ? 'Get more' : 'Shop'}</span>
              </button>
            </div>
          </section>
        )
      })}

      <div className="lk-foot">
        <button className="ag-career-act ag-career-act--shop" onClick={() => nav('shop')}><IconBag size={18} /> SHOP FOR MORE <IconArrow size={14} /></button>
      </div>
    </div>
  )
}
