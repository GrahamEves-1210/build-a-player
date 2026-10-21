import { useEffect, useRef, useState } from 'react'
import { useProgress, claimPass, dayKey, walletOpen } from '../../lib/progress'
import { TIERS, TIER_XP, PASS_PRICE, passValue, nextSeason } from '../../lib/pass'
import { itemById, RARITY } from '../../lib/cosmetics'
import { openCheckout } from '../../lib/webCheckout'
import { sellsHere, onStorefront } from '../../lib/storefront'
import { IS_APP } from '../../lib/platform'
import { getUsername } from '../../lib/discord'
import { sfx, haptic } from '../../lib/juice'
import { AvatarBadge, ItemPreview } from './NameTag'
import { IconClose, IconLock, IconCheck, IconShield, IconBolt, IconCards, IconCrown, IconFlame } from './icons'
import './pass.css'

// The Builder Pass (lib/pass.js): the season's two reward tracks on the XP a player
// already earns. Free for everyone signed in; premium for the season's pass holders.
// Opened from Home, the Shop and More (AppTabBar screen 'pass').

const signIn = () => window.dispatchEvent(new CustomEvent('bap:auth'))
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000)

function useSells() {
  const [sells, setSells] = useState(sellsHere)
  useEffect(() => onStorefront(() => setSells(sellsHere())), [])
  return sells
}

// What a reward is, in a few words
export function rewardLabel(r) {
  if (!r) return ''
  if (r.coins) return `${r.coins.toLocaleString()} coins`
  if (r.freeze) return 'Streak freeze'
  if (r.boost) return `2x XP · ${r.boost} seasons`
  if (r.rush) return `Coin Rush · ${r.rush} seasons`
  if (r.hot) return `Hot Hand${r.hot > 1 ? ` ×${r.hot}` : ''}`
  if (r.heal) return `Quick Heal${r.heal > 1 ? ` ×${r.heal}` : ''}`
  if (r.pack) return `${r.pack} cards${r.min ? ` · ${['', 'Rare', 'Epic', 'Legend'][r.min]}+` : ''}`
  return itemById(r.item)?.name ?? 'Item'
}

export function RewardArt({ r, name }) {
  if (r.coins) return <span className="bp-art bp-art--coins"><span className="coin-ico" /></span>
  if (r.freeze) return <span className="bp-art bp-art--freeze"><IconShield size={20} /></span>
  if (r.boost) return <span className="bp-art bp-art--boost"><IconBolt size={20} /></span>
  if (r.rush) return <span className="bp-art bp-art--rush"><span className="coin-ico" /><i>2x</i></span>
  if (r.hot) return <span className="bp-art bp-art--hot"><IconFlame size={20} /></span>
  if (r.heal) return <span className="bp-art bp-art--heal"><b>+</b></span>
  if (r.pack) return <span className="bp-art bp-art--pack"><IconCards size={20} /></span>
  const item = itemById(r.item)
  if (!item) return <span className="bp-art" />
  if (item.slot === 'avatar') return <span className="bp-art bp-art--item"><AvatarBadge cos={{ avatar: item.id }} name={name} size={34} /></span>
  if (item.slot === 'court') return <span className="bp-art bp-art--item"><img src={item.thumb} alt="" loading="lazy" draggable={false} /></span>
  // names, effects and sounds: a small sample ("Aa" in the color, the effect's tile)
  return <span className={`bp-art bp-art--item bp-art--${item.slot}`}><ItemPreview item={item} name="Aa" /></span>
}

function Cell({ r, tier, track, reached, claimed, locked, name, onClaim, flash }) {
  if (!r) return <span className="bp-cell is-empty" aria-hidden="true" />
  const item = r.item ? itemById(r.item) : null
  const ready = reached && !claimed && !locked
  const state = claimed ? 'is-claimed' : ready ? 'is-ready' : locked ? 'is-locked' : 'is-ahead'
  return (
    <button className={`bp-cell bp-cell--${track} ${state}${flash ? ' is-flash' : ''}`} style={item ? { '--rar': RARITY[item.rarity].color } : undefined}
      onClick={ready ? () => onClaim(track, tier) : undefined} aria-disabled={!ready}
      aria-label={`Tier ${tier} ${track === 'p' ? 'premium' : 'free'}: ${rewardLabel(r)}${claimed ? ', claimed' : ready ? ', claim' : locked ? ', premium' : ''}`}>
      <RewardArt r={r} name={name} />
      <span className="bp-cell-txt">
        <span className="bp-cell-name">{rewardLabel(r)}</span>
        {item ? <span className="bp-cell-sub">{RARITY[item.rarity].name}</span> : r.pack ? <span className="bp-cell-sub">Card pack</span> : r.hot || r.heal ? <span className="bp-cell-sub">Career boost</span> : null}
      </span>
      <span className="bp-cell-state">
        {claimed ? <IconCheck size={14} /> : ready ? 'CLAIM' : locked ? <IconLock size={13} /> : null}
      </span>
    </button>
  )
}

export default function AppPass({ onClose }) {
  const p = useProgress()
  const bp = p.bp
  const sells = useSells()
  const name = getUsername(p.user) || 'Guest'
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [flash, setFlash] = useState(null)
  const [got, setGot] = useState(null)
  const listRef = useRef(null)
  useEffect(() => { if (!got) return; const t = setTimeout(() => setGot(null), 1800); return () => clearTimeout(t) }, [got])

  // open on the tier you're on
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-tier="${Math.max(1, (bp?.tier ?? 1) - 1)}"]`)
    el?.scrollIntoView({ block: 'start' })
  }, [!!bp]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!bp) {
    const next = nextSeason(dayKey())
    return (
      <div className="ag-screen bp">
        <div className="ag-screen-head">
          <div><span className="ag-eyebrow">BUILDER PASS</span><h1 className="ag-h1">Between seasons</h1></div>
          <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
        </div>
        <div className="ag-screen-body"><p className="bp-note">{next ? `${next.name} starts ${new Date(`${next.start}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.` : 'The next season is on its way.'}</p></div>
      </div>
    )
  }

  const s = bp.season
  const value = passValue(s)
  const daysLeft = daysBetween(dayKey(), s.end)
  const maxed = bp.tier >= TIERS
  const signedIn = walletOpen()

  const claim = (track, tier) => {
    const r = claimPass(track, tier)
    if (!r) { sfx('deny'); return }
    setFlash(`${track}${tier}`); setTimeout(() => setFlash(null), 700)
    sfx(r.coins ? 'coins' : 'equip'); haptic('success')
    if (r.item && !r.dup) setGot(r.item)
  }
  const claimAll = () => {
    let n = 0
    for (let t = 1; t <= bp.tier; t++) {
      for (const tr of bp.owned ? ['f', 'p'] : ['f']) {
        const reward = (tr === 'p' ? s.premium : s.free)[t]
        if (reward && !bp.claimed[tr][t] && claimPass(tr, t)) n++
      }
    }
    if (n) { sfx('coins'); haptic('success') }
  }
  const buy = async () => {
    if (!signedIn) { signIn(); return }
    setErr(''); setBusy(true)
    const r = await openCheckout('pass', { season: s.id })
    setBusy(false)
    if (r === 'error') setErr('Checkout didn\'t open. Try again.')
  }

  return (
    <div className="ag-screen bp">
      <div className="ag-screen-head">
        <div>
          <span className="ag-eyebrow">BUILDER PASS · {s.name.toUpperCase()}</span>
          <h1 className="ag-h1">{s.title}</h1>
        </div>
        <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
      </div>

      <div className="ag-screen-body">
        <div className={`bp-hero ag-pop${bp.owned ? ' is-premium' : ''}`}>
          <div className="bp-hero-top">
            <span className="bp-tier"><small>TIER</small><b>{bp.tier}</b><small>/ {TIERS}</small></span>
            <span className="bp-hero-chips">
              <span className="ag-chip">{bp.over ? 'SEASON OVER · CLAIM BY ' + new Date(`${s.end}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `${daysLeft} ${daysLeft === 1 ? 'DAY' : 'DAYS'} LEFT`}</span>
              {bp.owned && <span className="ag-chip ag-chip--gold is-on"><IconCrown size={12} /> PREMIUM</span>}
              {p.boosts?.xp > 0 && <span className="ag-chip is-on"><IconBolt size={12} /> 2X XP · {p.boosts.xp}</span>}
              {p.boosts?.rush > 0 && <span className="ag-chip is-on"><span className="coin-ico coin-ico--sm" /> COIN RUSH · {p.boosts.rush}</span>}
            </span>
          </div>
          <div className="bp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={TIER_XP} aria-valuenow={maxed ? TIER_XP : bp.into} aria-label="XP to the next tier">
            <span style={{ width: `${maxed ? 100 : Math.min(100, (bp.into / TIER_XP) * 100)}%` }} />
          </div>
          <span className="bp-hero-sub">{!signedIn ? 'Sign in to start earning tiers.' : maxed ? `Every tier reached · ${bp.xp.toLocaleString()} XP this season` : `${bp.into.toLocaleString()} / ${TIER_XP} XP to tier ${bp.tier + 1} · seasons, missions, live games and the daily login all count`}</span>
          {!signedIn && <button className="ag-btn bp-cta" onClick={signIn}>SIGN IN</button>}
          {signedIn && bp.ready > 0 && <button className="ag-btn bp-cta" onClick={claimAll}>CLAIM ALL · {bp.ready}</button>}
        </div>

        {!bp.owned && sells && !bp.over && (
          <div className="bp-buy ag-pop" style={{ '--d': '60ms' }}>
            <span className="bp-buy-txt">
              <span className="ag-eyebrow">PREMIUM TRACK</span>
              <b>{value.items} pass-only items · {value.coins.toLocaleString()} coins</b>
              <small>Plus card packs, 2x XP boosts and streak freezes on every tier. Everything you've already reached unlocks at once.</small>
            </span>
            <button className="ag-btn ag-pro-cta bp-buy-btn" onClick={buy} disabled={busy}>{busy ? 'OPENING…' : `UNLOCK · ${PASS_PRICE}`}</button>
            <span className="bp-fine">{IS_APP ? 'Secure Stripe checkout on build-a-player.com. ' : ''}One payment for {s.name}, no subscription.</span>
            {err && <span className="bp-fine bp-fine--err">{err}</span>}
          </div>
        )}

        <div className="bp-track" ref={listRef}>
          <div className="bp-row bp-row--head" aria-hidden="true"><span>TIER</span><span>FREE</span><span className="bp-head-prem"><IconCrown size={12} /> PREMIUM</span></div>
          {Array.from({ length: TIERS }, (_, k) => k + 1).map(t => {
            const reached = signedIn && bp.started && t <= bp.tier
            return (
              <div key={t} data-tier={t} className={`bp-row${reached ? ' is-reached' : ''}${t === bp.tier ? ' is-now' : ''}`}>
                <span className="bp-num">{t}</span>
                <Cell r={s.free[t]} tier={t} track="f" reached={reached} claimed={!!bp.claimed.f[t]} locked={false} name={name} onClaim={claim} flash={flash === `f${t}`} />
                <Cell r={s.premium[t]} tier={t} track="p" reached={reached} claimed={!!bp.claimed.p[t]} locked={!bp.owned} name={name} onClaim={claim} flash={flash === `p${t}`} />
              </div>
            )
          })}
        </div>
        <p className="bp-note">A tier opens every {TIER_XP} XP you earn this season. Pass items are only on the pass; one you already bought pays coins instead. 2x XP and Coin Rush double your next seasons' XP or coins; Hot Hand and Quick Heal are for Career.</p>
      </div>

      {got && (
        <div className="sh-bought" style={{ '--rar': RARITY[itemById(got)?.rarity ?? 0].color }} onClick={() => setGot(null)}>
          <div className="sh-bought-card">
            <span className="ag-eyebrow">UNLOCKED · IN YOUR LOCKER</span>
            {itemById(got)?.slot === 'avatar' ? <AvatarBadge cos={{ avatar: got }} name={name} size={72} /> : <ItemPreview item={itemById(got)} name={name} />}
            <span className="sh-bought-name">{itemById(got)?.name}</span>
          </div>
        </div>
      )}
    </div>
  )
}
