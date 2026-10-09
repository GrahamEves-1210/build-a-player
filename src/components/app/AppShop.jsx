import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useProgress, buy, equip, owns, priceOf, lockReason, dealsFor, claimFreeCoins, msToReset, isPro, COINS, achStats, walletOpen, hasDiscord, claimDiscordCoins, DISCORD_COINS } from '../../lib/progress'
import { connectDiscord } from '../../lib/discord'
import { SLOTS, RARITY, ITEMS, itemById, itemsFor, BLURB, DEFAULTS } from '../../lib/cosmetics'
import { achById } from '../../lib/achievements'
import { getUsername } from '../../lib/discord'
import { sfx, haptic, previewVictory, warmVictory } from '../../lib/juice'
import { NameTag, AvatarBadge, ItemPreview } from './NameTag'
import { IconClose, IconLock, IconGift, IconCrown, IconPlay, IconArrow, IconStar, IconDiscord } from './icons'

// The shop (app): coins buy avatars, name colors and effects, nameplates and
// victory effects/sounds. BAP Pro opens the Pro Vault. Opened from Home (the
// coin pill) and Profile; lives over everything like Daily and Cards.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))
const TABS = [{ id: 'featured', label: 'Featured' }, ...SLOTS.map(s => ({ id: s.id, label: s.label }))]
const fmtLeft = ms => { const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000); return h ? `${h}h ${m}m` : `${m}m` }

function useCountTo(target, ms = 600) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const a = from.current, b = target
    if (a === b) return
    let raf, t0
    const step = now => { t0 ??= now; const t = Math.min(1, (now - t0) / ms); setV(Math.round(a + (b - a) * (1 - Math.pow(1 - t, 3)))); if (t < 1) raf = requestAnimationFrame(step); else from.current = b }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

const signIn = () => window.dispatchEvent(new CustomEvent('bap:auth'))

export function CoinPill({ onClick, className = '' }) {
  const p = useProgress()
  const n = useCountTo(p.coins ?? 0)
  // website: coins need an account
  if (!walletOpen()) {
    return (
      <button className={`coin-pill coin-pill--signin${className ? ` ${className}` : ''}`} onClick={signIn} aria-label="Sign in to earn coins">
        <span className="coin-ico" aria-hidden="true" />SIGN IN
      </button>
    )
  }
  const [bump, setBump] = useState(false)
  const prev = useRef(p.coins)
  useEffect(() => { if ((p.coins ?? 0) > (prev.current ?? 0)) { setBump(true); setTimeout(() => setBump(false), 520) } prev.current = p.coins }, [p.coins])
  return (
    <button className={`coin-pill${bump ? ' is-bump' : ''}${className ? ` ${className}` : ''}`} onClick={onClick ?? (() => nav('shop'))} aria-label={`${p.coins ?? 0} coins, open the shop`}>
      <span className="coin-ico" aria-hidden="true" />{n.toLocaleString()}
    </button>
  )
}

// Join the Discord: one-time coins (linking Discord also joins the server)
function DiscordCoins({ p }) {
  const [busy, setBusy] = useState(false)
  if (p.discordPaid) return null
  const linked = hasDiscord(p.user)
  const act = async () => {
    if (!p.signedIn) { signIn(); return }
    if (!linked) { setBusy(true); const { error } = await connectDiscord(); if (error) setBusy(false); return }
    if (claimDiscordCoins()) { sfx('purchase'); haptic('success') }
  }
  return (
    <div className="sh-section">
      <button className="sh-free sh-discord" onClick={act} disabled={busy}>
        <span className="sh-chest"><IconDiscord size={26} /></span>
        <span>
          <span className="sh-free-title">JOIN THE DISCORD</span>
          <span className="sh-free-sub">{linked ? `You're in — claim your ${DISCORD_COINS} coins` : `Connect Discord, join the server, get ${DISCORD_COINS} coins`}</span>
        </span>
        <span className="sh-free-go">{!p.signedIn ? 'SIGN IN' : linked ? 'CLAIM' : busy ? '…' : 'JOIN'}</span>
      </button>
    </div>
  )
}

function ItemCard({ item, deal, equipped, onOpen, delay = 0, name }) {
  const mine = owns(item.id)
  const lock = mine ? null : lockReason(item.id)
  const price = deal ?? item.price
  return (
    <button className={`sh-card${mine ? ' is-owned' : ''}${equipped ? ' is-equipped' : ''}${lock ? ' is-locked' : ''}`} style={{ '--rar': RARITY[item.rarity].color, '--d': `${delay}ms` }} onClick={() => onOpen(item.id)}>
      <span className="sh-card-stage">
        {item.pro && <span className="sh-flag sh-flag--pro"><IconCrown size={11} /> PRO</span>}
        {!item.pro && item.ach && !mine && <span className="sh-flag sh-flag--ach"><IconStar size={10} /> REWARD</span>}
        {!item.pro && !item.ach && item.level && !mine && lock && <span className="sh-flag sh-flag--lvl"><IconLock size={10} /> LVL {item.level}</span>}
        {deal != null && !mine && <span className="sh-flag sh-flag--deal">-30%</span>}
        <ItemPreview item={item} name={name} />
      </span>
      <span className="sh-card-body">
        <span className="sh-card-name">{item.name}</span>
        <span className="sh-card-meta">
          <span className="sh-rar">{RARITY[item.rarity].name}</span>
          {mine ? <span className="sh-owned">{equipped ? 'EQUIPPED' : 'OWNED'}</span>
            : item.ach ? <span className="sh-owned" style={{ color: 'var(--ag-muted)' }}>EARN IT</span>
            : <span className="sh-price"><span className="coin-ico coin-ico--sm" />{price.toLocaleString()}{deal != null && <s>{item.price.toLocaleString()}</s>}</span>}
        </span>
      </span>
    </button>
  )
}

function DefaultCard({ slot, equipped, onPick, name }) {
  const label = slot === 'avatar' ? 'Initial' : 'None'
  return (
    <button className={`sh-card is-owned${equipped ? ' is-equipped' : ''}`} style={{ '--rar': '#6ee7b7' }} onClick={onPick}>
      <span className="sh-card-stage">
        {slot === 'avatar' ? <AvatarBadge name={name} size={58} cos={{}} /> : slot === 'plate' ? <NameTag name={name} cos={{}} className="ip-name" /> : <span className="ip-name"><NameTag name={name} cos={{}} plate={false} /></span>}
      </span>
      <span className="sh-card-body"><span className="sh-card-name">{label}</span><span className="sh-card-meta"><span className="sh-rar">Default</span><span className="sh-owned">{equipped ? 'EQUIPPED' : 'FREE'}</span></span></span>
    </button>
  )
}

function ItemSheet({ id, onClose, name }) {
  const p = useProgress()
  const item = itemById(id)
  const [short, setShort] = useState(false)
  const [msg, setMsg] = useState('')
  const [bought, setBought] = useState(false)
  if (!item) return null
  const mine = owns(item.id)
  const lock = mine ? null : lockReason(item.id)
  const price = priceOf(item.id)
  const equipped = p.equip?.[item.slot] === item.id
  const isFx = item.slot === 'winFx' || item.slot === 'winSound'
  const doBuy = () => {
    const r = buy(item.id)
    if (r.ok) { setBought(true); setMsg(''); setTimeout(() => setBought(false), 1500) }
    else { setShort(true); setMsg(r.reason); sfx('deny'); haptic('light'); setTimeout(() => setShort(false), 450) }
  }
  const doEquip = () => {
    if (equipped && !isFx) { equip(item.slot, null); sfx('tap'); return }
    if (equip(item.slot, item.id)) { sfx('equip'); haptic('medium') }
  }
  const preview = () => (item.slot === 'winFx' ? previewVictory(item.id, null) : item.slot === 'winSound' ? sfx(item.id) : null)
  const ach = item.ach ? achById(item.ach) : null
  const achNow = ach ? Math.min(ach.goal, achStats()[ach.metric] ?? 0) : 0
  return createPortal(
    <div className="sh-sheet-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sh-sheet" style={{ '--rar': RARITY[item.rarity].color }} role="dialog" aria-label={item.name}>
        <div className="sh-grab" onClick={onClose} />
        <div className="sh-sheet-stage" onClick={isFx ? preview : undefined}>
          {isFx
            ? <span style={{ display: 'grid', placeItems: 'center', gap: 10 }}><ItemPreview item={item} big /><span className="ag-chip"><IconPlay size={12} /> TAP TO {item.slot === 'winSound' ? 'PLAY' : 'PREVIEW'}</span></span>
            : item.slot === 'avatar'
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}><AvatarBadge cos={{ avatar: item.id }} name={name} size={96} /><NameTag self name={name} className="sh-hero-name" /></span>
              : <ItemPreview item={item} name={name} big />}
        </div>
        <span className="sh-sheet-rar">{RARITY[item.rarity].name.toUpperCase()}{item.pro ? ' · PRO VAULT' : ''}{item.ach ? ' · ACHIEVEMENT REWARD' : ''}</span>
        <h2 className="sh-sheet-name">{item.name}</h2>
        <p className="sh-sheet-blurb">{BLURB[item.slot]}</p>
        {mine ? (
          <div className="sh-sheet-row">
            {isFx && <button className="sh-ghost" onClick={preview}>{item.slot === 'winSound' ? 'PLAY' : 'PREVIEW'}</button>}
            <button className={`sh-equip${equipped ? ' is-on' : ''}`} onClick={doEquip}>{equipped ? (isFx ? 'EQUIPPED' : 'TAKE IT OFF') : 'EQUIP'}</button>
          </div>
        ) : lock ? (
          <>
            <div className="sh-lock"><IconLock size={14} /> {lock.toUpperCase()}</div>
            {ach && <div className="sh-hint">{ach.desc} · {achNow.toLocaleString()}/{ach.goal.toLocaleString()} <button className="ag-chip" style={{ marginLeft: 6 }} onClick={() => { onClose(); nav('achievements') }}>VIEW</button></div>}
            {item.level && !item.ach && !item.pro && <div className="sh-hint">{p.signedIn ? <>You're level <b>{p.lvl.level}</b>. Seasons, missions and achievements all give XP.</> : <>Levels need an account. <b>Sign in</b> to start earning XP.</>}</div>}
            {item.pro && <div className="sh-hint">The Pro Vault is open to <b>BAP Pro</b> members.</div>}
          </>
        ) : (
          <>
            <div className="sh-sheet-row">
              {isFx && <button className="sh-ghost" onClick={preview}>{item.slot === 'winSound' ? 'PLAY' : 'PREVIEW'}</button>}
              <button className={`sh-buy${short ? ' is-short' : ''}`} onClick={doBuy}>BUY · <span className="coin-ico" />{price.toLocaleString()}</button>
            </div>
            {msg ? <div className="sh-hint">{msg}. Seasons, missions, achievements and the daily drop all pay <b>coins</b>.</div>
              : <div className="sh-hint">You have <b>{(p.coins ?? 0).toLocaleString()}</b> coins.</div>}
          </>
        )}
      </div>
      {bought && (
        <div className="sh-bought" style={{ '--rar': RARITY[item.rarity].color }}>
          <div className="sh-bought-card">
            <span className="ag-eyebrow">UNLOCKED</span>
            {item.slot === 'avatar' ? <AvatarBadge cos={{ avatar: item.id }} name={name} size={72} /> : <ItemPreview item={item} name={name} />}
            <span className="sh-bought-name">{item.name}</span>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

export default function AppShop({ onClose, tab: initialTab = 'featured' }) {
  useEffect(() => { warmVictory() }, [])   // victory sounds ready for previews
  const p = useProgress()
  const [tab, setTab] = useState(initialTab)
  const [open, setOpen] = useState(null)
  const name = getUsername(p.user) || 'Guest'
  const deals = useMemo(() => dealsFor(), [])
  const dealPrice = id => deals.find(d => d.id === id)?.price ?? null
  const pro = isPro()
  const ownedCount = ITEMS.filter(i => owns(i.id) && !i.free).length
  const reach = useMemo(() => ITEMS.filter(i => !owns(i.id) && !lockReason(i.id) && i.price && !i.ach && priceOf(i.id) <= Math.max(300, (p.coins ?? 0))).sort((a, b) => b.price - a.price).slice(0, 4), [p.coins, p.owned]) // eslint-disable-line react-hooks/exhaustive-deps
  const claim = () => {
    if (!p.freeReady) return
    const n = claimFreeCoins()
    if (n) { sfx('coin'); haptic('success') }
  }
  const pickDefault = slot => { equip(slot, null); sfx('tap') }
  const grid = (list, cls = '') => (
    <div className={`sh-grid${cls}`}>
      {list.map((i, k) => <ItemCard key={i.id} item={i} deal={dealPrice(i.id)} equipped={p.equip?.[i.slot] === i.id} onOpen={setOpen} delay={k * 30} name={name} />)}
    </div>
  )

  return (
    <div className="ag-screen sh">
      <div className="ag-screen-head">
        <div>
          <span className="ag-eyebrow">SPEND YOUR COINS</span>
          <h1 className="ag-h1">Shop</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="sh-locker-btn" onClick={() => nav('locker')}>LOCKER</button>
          <CoinPill onClick={() => setTab('featured')} />
          <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
        </div>
      </div>

      <div className="sh-hero ag-pop">
        <AvatarBadge self name={name} size={58} level={p.signedIn ? p.lvl.level : null} />
        <span style={{ minWidth: 0 }}>
          <NameTag self name={name} className="sh-hero-name" />
          <span className="sh-hero-sub">{ownedCount} owned · {!p.signedIn ? 'Sign in to level up' : `${p.lvl.title} · ${pro ? 'BAP Pro: Vault open' : 'Level ' + p.lvl.level}`}</span>
        </span>
      </div>

      <div className="sh-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`sh-tab${tab === t.id ? ' is-on' : ''}`} onClick={() => { setTab(t.id); sfx('tap') }}>
            {t.label}{t.id !== 'featured' && <b>{itemsFor(t.id).filter(i => owns(i.id)).length}/{itemsFor(t.id).length}</b>}
          </button>
        ))}
      </div>

      {tab === 'featured' ? (
        <>
          {!walletOpen() && (
            <div className="sh-section">
              <button className="sh-free sh-signin" onClick={signIn}>
                <span className="sh-chest"><IconStar size={26} /></span>
                <span>
                  <span className="sh-free-title">SIGN IN TO EARN COINS</span>
                  <span className="sh-free-sub">Coins and cards are saved to your account</span>
                </span>
                <span className="sh-free-go">SIGN IN</span>
              </button>
            </div>
          )}
          <DiscordCoins p={p} />
          <div className="sh-section">
            <button className={`sh-free${p.freeReady ? '' : ' is-claimed'}`} onClick={walletOpen() ? claim : signIn}>
              <span className="sh-chest"><IconGift size={28} /></span>
              <span>
                <span className="sh-free-title">DAILY DROP</span>
                <span className="sh-free-sub">{p.freeReady ? `${pro ? COINS.freePro : COINS.free} free coins today${pro ? ' (Pro doubles it)' : ''}` : `Next drop in ${fmtLeft(msToReset())}`}</span>
              </span>
              <span className="sh-free-go">{!walletOpen() ? 'SIGN IN' : p.freeReady ? 'CLAIM' : 'CLAIMED'}</span>
            </button>
          </div>
          <div className="sh-section">
            <div className="sh-section-head"><span className="sh-section-title">TODAY'S DEALS</span><span className="sh-section-note">30% off · new deals in {fmtLeft(msToReset())}</span></div>
            {grid(deals.map(d => itemById(d.id)).filter(Boolean), ' sh-grid--3')}
          </div>
          {reach.length > 0 && (
            <div className="sh-section">
              <div className="sh-section-head"><span className="sh-section-title">WITHIN REACH</span><span className="sh-section-note">What your coins can buy now</span></div>
              {grid(reach)}
            </div>
          )}
          <div className="sh-section">
            <div className="sh-vault">
              <div className="sh-vault-head">
                <span>
                  <span className="sh-vault-title"><IconCrown size={18} /> Pro Vault</span>
                  <span className="sh-vault-sub" style={{ display: 'block' }}>{pro ? 'Your BAP Pro membership opens these.' : 'Exclusive items for BAP Pro members.'}</span>
                </span>
              </div>
              {grid(ITEMS.filter(i => i.pro))}
            </div>
          </div>
          <div className="sh-section">
            <div className="sh-section-head"><span className="sh-section-title">EARNING COINS</span></div>
            <div className="ag-card" style={{ padding: 12, fontFamily: 'var(--ag-body)', fontSize: 13, lineHeight: 1.6, color: 'var(--ag-text-2)' }}>
              Every season pays {COINS.season}+ coins, more for wins, playoffs (+{COINS.playoffs}), titles (+{COINS.ring}) and awards (+{COINS.award}).
              Missions, login streaks, new cards, Takeover cities, Blacktop games and every level up pay too.
              <button className="ag-chip" style={{ marginTop: 8, display: 'flex' }} onClick={() => nav('achievements')}>ACHIEVEMENTS <IconArrow size={12} /></button>
            </div>
          </div>
        </>
      ) : (
        <div className="sh-section">
          <div className="sh-section-head"><span className="sh-section-title">{SLOTS.find(s => s.id === tab)?.label.toUpperCase()}</span><span className="sh-section-note">{BLURB[tab]}</span></div>
          <div className="sh-grid">
            {DEFAULTS[tab] === null && <DefaultCard slot={tab} equipped={!p.equip?.[tab]} onPick={() => pickDefault(tab)} name={name} />}
            {itemsFor(tab).sort((a, b) => (a.pro - b.pro) || (!!a.ach - !!b.ach) || (a.rarity - b.rarity) || (a.price - b.price)).map((i, k) => (
              <ItemCard key={i.id} item={i} deal={dealPrice(i.id)} equipped={p.equip?.[i.slot] === i.id} onOpen={setOpen} delay={k * 25} name={name} />
            ))}
          </div>
        </div>
      )}
      {open && <ItemSheet id={open} name={name} onClose={() => setOpen(null)} />}
    </div>
  )
}
