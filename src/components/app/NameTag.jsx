import { useProgress } from '../../lib/progress'
import { itemById } from '../../lib/cosmetics'
import { useCosOf } from '../../lib/peopleCos'
import {
  IconFootball, IconBasketball, IconCrown, IconFlame, IconBolt, IconStar, IconTrophy, IconMedal, IconRing,
  IconTarget, IconShield, IconCoin, IconPodium, IconClipboard, IconVersus, IconWhistle, IconHelmet, IconHoop,
} from './icons'
import '../../app-shop.css'

// Cosmetics, drawn: a username with its color, effect and nameplate, and the
// avatar badge. `cos` is { avatar, nameColor, nameFx, plate } (item ids) — the
// player's own when `self` (or when `uid` is mine), what another player shared
// (chat, lobbies), or looked up by their account id (`uid`: leaderboards, results).

// Whose look to draw: mine (live), the one passed in, or theirs by account id
function useCosFor({ self, cos, uid }) {
  const mine = useMyCos()
  const p = useProgress()
  const theirs = useCosOf(!self && !cos ? uid : null)
  if (self || (uid && uid === p.user?.id)) return mine
  return cos || theirs || {}
}

export const GLYPHS = {
  football: IconFootball, basketball: IconBasketball, crown: IconCrown, flame: IconFlame, bolt: IconBolt, star: IconStar,
  trophy: IconTrophy, medal: IconMedal, ring: IconRing, target: IconTarget, shield: IconShield, coin: IconCoin,
  podium: IconPodium, clipboard: IconClipboard, versus: IconVersus, whistle: IconWhistle, helmet: IconHelmet, hoop: IconHoop,
}

export function useMyCos() {
  const p = useProgress()
  return { avatar: p.equip?.avatar ?? null, nameColor: p.equip?.nameColor ?? null, nameFx: p.equip?.nameFx ?? null, plate: p.equip?.plate ?? null, winFx: p.equip?.winFx ?? null, winSound: p.equip?.winSound ?? null }
}

// Only ids the catalog knows are drawn (anything else a peer sends is ignored)
const known = (id, slot) => (itemById(id)?.slot === slot ? id : null)

export function NameText({ name, color, fx, className = '' }) {
  const nc = known(color, 'nameColor'), nfx = known(fx, 'nameFx')
  const text = name || 'Player'
  return (
    <span className={`nt${nc ? ` ${nc} nt-colored` : ''}${nfx ? ` ${nfx}` : ''}${className ? ` ${className}` : ''}`} data-text={text}>
      {nfx === 'nfx-wave'
        ? [...text].map((ch, i) => <span key={i} className="nt-ch" style={{ '--i': i }}>{ch === ' ' ? ' ' : ch}</span>)
        : text}
    </span>
  )
}

// A name with its look. plate: draw the nameplate behind it (cards, chat, lobby)
export function NameTag({ name, cos, uid = null, self = false, plate = true, className = '' }) {
  const c = useCosFor({ self, cos, uid })
  const pl = plate ? known(c.plate, 'plate') : null
  const inner = <NameText name={name} color={c.nameColor} fx={c.nameFx} />
  if (!pl) return <span className={`ntag${className ? ` ${className}` : ''}`}>{inner}</span>
  return <span className={`ntag np ${pl}${className ? ` ${className}` : ''}`}><span className="np-shine" aria-hidden="true" />{inner}</span>
}
export function AvatarBadge({ cos, uid = null, self = false, name, size = 44, level = null, className = '' }) {
  const c = useCosFor({ self, cos, uid })
  const av = itemById(known(c.avatar, 'avatar'))
  const initial = (name || '?').trim().slice(0, 1).toUpperCase()
  const Glyph = av && av.glyph !== 'mono' ? GLYPHS[av.glyph] : null
  return (
    <span className={`avb${av ? ` avp-${av.pal}${av.anim ? ` ava-${av.anim}` : ''}` : ' avp-none'}${className ? ` ${className}` : ''}`} style={{ width: size, height: size, '--avs': `${size}px` }}>
      <span className="avb-ring" aria-hidden="true" />
      {Glyph ? <Glyph size={Math.round(size * 0.56)} /> : <span className="avb-init">{initial}</span>}
      {level != null && <span className="avb-lvl">{level}</span>}
    </span>
  )
}

// Item previews for the shop tiles
export function ItemPreview({ item, name = 'Guest', big = false }) {
  if (!item) return null
  if (item.slot === 'avatar') return <AvatarBadge cos={{ avatar: item.id }} name={name} size={big ? 96 : 58} />
  if (item.slot === 'nameColor') return <span className="ip-name"><NameText name={name} color={item.id} /></span>
  if (item.slot === 'nameFx') return <span className="ip-name"><NameText name={name} color={big ? null : 'nc-ice'} fx={item.id} /></span>
  if (item.slot === 'plate') return <span className={`ntag np ${item.id} ip-plate`}><span className="np-shine" aria-hidden="true" /><NameText name={name} /></span>
  return <span className={`ip-fx ip-fx--${item.slot}`}><span className={`ip-fx-ico ip-${item.id}`} /></span>
}
