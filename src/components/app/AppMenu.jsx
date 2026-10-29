import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { track } from '../../lib/track'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import FeedbackModal from '../FeedbackModal'
import { isMuted, setMuted } from '../../lib/juice'
import { IS_APP, PLAY_BILLING } from '../../lib/platform'
import { useStorePrices, PRO_PLAN_ID } from '../../lib/iap'
import { openCheckout, openBillingPortal, PRO_PRICE } from '../../lib/webCheckout'
import { sellsHere } from '../../lib/storefront'
import { isPro } from '../../lib/progress'
import { railPreviewOn, setRailPreview } from '../../lib/fakeRail'
import { IconQuestion, IconInfo, IconChat, IconDiscord, IconX, IconClose, IconShield, IconDoc, IconPodium, IconPlay, IconCrown, IconHome, IconGear, IconStar } from './icons'
import { useProgress } from '../../lib/progress'
import AppSettings from './AppSettings'
import { guardLeave } from '../../lib/liveLock'
import './pass.css'
import { useSheetDrag, sheetMotion, overlayMotion } from './Sheet'
import { EASE_OUT, SPRING_PANEL, useReducedMotionApp } from '../../lib/motion'

// App "More" sheet (gear on the home screen): tiles + a How to Play view.
// It slides in from its edge (the app: the bottom; the website: the top), drags back
// to close, and its height follows the view (menu, Pro, Settings) instead of snapping.

// a view slides in from the side it's opened toward (back: from the left)
const VIEW = {
  enter: d => ({ opacity: 0, x: d * 18 }),
  show: { opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE_OUT } },
  leave: d => ({ opacity: 0, x: d * -18, transition: { duration: 0.14 } }),
}

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

// BAP Pro: Stripe on the web (the app opens the checkout in the phone's browser),
// monthly or yearly. The Builder Pass is its own thing (lib/pass.js)
const PRO_PERKS = [
  ['No ads', 'Every page, on the website'],
  ['+50% coins from every game', 'Seasons, Compete and Blacktop. It stacks with Coin Rush'],
  ['The Pro Vault, included', 'Four members-only looks, yours while you\'re Pro: Diamond, Pro Aura, Pro Holo and Supernova'],
  ['Double the daily drop', 'The shop\'s free daily coins, doubled'],
  ['Pro badge and Discord role', 'Next to your name on the leaderboards, and a Pro role in the Discord (link Discord on your profile)'],
]

function ProView({ onVault }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [plan, setPlan] = useState('year')
  const pro = isPro()
  const store = useStorePrices()   // Android: Google Play's prices, in the player's currency
  const price = { month: store[PRO_PLAN_ID.month] ?? PRO_PRICE.month, year: store[PRO_PLAN_ID.year] ?? PRO_PRICE.year }
  useEffect(() => { if (!pro) track('pro_view') }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const subscribe = async () => {
    setErr(null); setBusy(true)
    const r = await openCheckout('pro', { plan })
    setBusy(false)
    if (r === 'error') setErr('Checkout didn\'t open. Try again.')
  }
  // members: Stripe's billing page (plan, card, cancel)
  const manage = async () => {
    setErr(null); setBusy(true)
    const r = await openBillingPortal()
    setBusy(false)
    if (r === 'error') setErr('The billing page didn\'t open. Try again.')
  }
  return (
    <div className="ag-pro-view">
      <div className={`ag-pro-hero ag-pop${pro ? ' is-on' : ''}`}>
        <span className="ag-pro-crown"><IconCrown size={30} /></span>
        <b>BAP PRO</b>
        <span>{pro ? 'Active — thanks for backing the game.' : 'Cancel anytime'}</span>
      </div>
      {!pro && sellsHere() && (
        <div className="ag-pro-plans" role="radiogroup" aria-label="Plan">
          <button role="radio" aria-checked={plan === 'month'} className={`ag-pro-plan${plan === 'month' ? ' is-on' : ''}`} onClick={() => setPlan('month')}>
            <small>MONTHLY</small><b>{price.month}</b><span>a month</span>
          </button>
          <button role="radio" aria-checked={plan === 'year'} className={`ag-pro-plan${plan === 'year' ? ' is-on' : ''}`} onClick={() => setPlan('year')}>
            <i>MOST POPULAR</i><small>YEARLY</small><b>{price.year}</b><span>a year · save {PRO_PRICE.save}</span>
          </button>
        </div>
      )}
      <ul className="ag-pro-perks">
        {PRO_PERKS.map(([t, d]) => (
          <li key={t} className="ag-pro-perk"><b>{t}</b> <small>{d}</small></li>
        ))}
      </ul>
      {pro ? (
        <>
          <button className="ag-btn ag-pro-cta" onClick={onVault}>OPEN THE PRO VAULT</button>
          <button className="ag-btn ag-btn--ghost ag-pro-manage" onClick={manage} disabled={busy}>{busy ? 'OPENING…' : 'MANAGE SUBSCRIPTION'}</button>
          <p className="ag-pro-note">{PLAY_BILLING ? "Change your plan or cancel in Google Play, or on Stripe's secure page if you joined on the website." : "Change your plan or card, or cancel, on Stripe's secure page (or in Google Play, if you joined on Android)."} Pro stays on until the end of the period you've paid for.</p>
        </>
      ) : sellsHere() ? (
        <>
          <button className="ag-btn ag-pro-cta" onClick={subscribe} disabled={busy}>{busy ? 'OPENING CHECKOUT…' : `GO PRO — ${plan === 'year' ? `${price.year}/YR` : `${price.month}/MO`}`}</button>
          <p className="ag-pro-note">{PLAY_BILLING ? 'Paid through Google Play. Pro carries over to the website on this account. ' : IS_APP ? 'Opens a secure Stripe checkout on build-a-player.com. Pro carries over to the app on this account. ' : ''}Renews automatically at {plan === 'year' ? `${price.year} a year` : `${price.month} a month`} until you cancel. Cancel anytime; Pro stays on until the end of the period you've paid for.</p>
        </>
      ) : null}
      {err && <p className="ag-pro-note ag-pro-note--err">{err}</p>}
    </div>
  )
}

const STEPS = [
  { title: 'SPIN',     body: 'Spin for a random team, then a random player from it.' },
  { title: 'PICK',     body: 'Take one trait from that player — their arm, speed, hands…' },
  { title: 'BUILD',    body: 'Keep spinning until every slot on your player is filled.' },
  { title: 'SIMULATE', body: 'Play the season. Make the playoffs, win the award, chase the ring.' },
]

function Tile({ tone, Icon, title, sub, onClick, delay, wide = false }) {
  return (
    <button className={`ag-tile ag-tile--${tone} ag-pop`} style={{ '--d': delay, ...(wide ? { gridColumn: '1 / -1' } : null) }} onClick={onClick}>
      <span className="ag-tile-icon"><Icon size={26} /></span>
      <span className="ag-tile-title">{title}</span>
      {sub && <span className="ag-tile-sub">{sub}</span>}
    </button>
  )
}

export default function AppMenu({ sport, onClose, initialView = 'menu' }) {
  const [view, setViewNow] = useState(initialView)       // 'menu' | 'howto' | 'pro' | 'settings'
  const [dir, setDir] = useState(1)
  const setView = v => { setDir(v === 'menu' ? -1 : 1); setViewNow(v) }
  const from = IS_APP ? 'bottom' : 'top'   // the website's sheet drops from the top (app-game.css)
  const { startDrag, dragProps } = useSheetDrag(from, onClose)
  const reduce = useReducedMotionApp()
  // the sheet's height: its content's, measured, so a new view grows or shrinks it smoothly
  const sheetRef = useRef(null)
  const innerRef = useRef(null)
  const [height, setHeight] = useState(null)
  useLayoutEffect(() => {
    const el = innerRef.current, sheet = sheetRef.current
    if (!el || !sheet || typeof ResizeObserver === 'undefined') return
    const cs = getComputedStyle(sheet)
    const extra = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((a, k) => a + (parseFloat(cs[k]) || 0), 0)
    const ro = new ResizeObserver(() => setHeight(Math.ceil(el.offsetHeight + extra)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const [feedbackUser, setFeedbackUser] = useState(null) // null = closed
  const [muted, setMutedState] = useState(isMuted)
  const [rail, setRailState] = useState(railPreviewOn)
  const signedIn = useProgress().signedIn
  const isBucket = sport === 'bucket'

  const openFeedback = async () => {
    const { data } = supabase ? await supabase.auth.getSession() : { data: null }
    setFeedbackUser(data?.session?.user ?? false)
  }
  // leaving the page asks first in a live game; links that open a new tab don't leave
  const go = fn => () => { onClose(); guardLeave(fn) }
  const goOut = fn => () => { onClose(); fn() }

  if (feedbackUser !== null) {
    return <FeedbackModal user={feedbackUser || null} isBucket={isBucket} onClose={() => { setFeedbackUser(null); onClose() }} />
  }

  const grab = <div className="ag-menu-grab" onPointerDown={startDrag} aria-hidden="true" />
  return createPortal(
    <motion.div className="ag-menu-overlay" {...overlayMotion} onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div ref={sheetRef} className={`ag-menu ag-menu--${sport}`} role="dialog" aria-label={view === 'howto' ? 'How to play' : view === 'pro' ? 'BAP Pro' : view === 'settings' ? 'Settings' : 'More'}
        {...sheetMotion(from)} {...dragProps}
        animate={{ y: 0, ...(height != null ? { height } : null), transition: { y: sheetMotion(from).animate.transition, height: reduce ? { duration: 0 } : SPRING_PANEL } }}>
        <div ref={innerRef}>
        {from === 'bottom' && grab}
        <div className="ag-menu-head" onPointerDown={startDrag}>
          {view !== 'menu' && !(view === 'pro' && initialView === 'pro')
            ? <button className="ag-menu-back" onClick={() => setView('menu')}>‹ BACK</button>
            : <span />}
          <h2 className="ag-menu-title">{view === 'howto' ? 'How to play' : view === 'pro' ? 'BAP Pro' : view === 'settings' ? 'Settings' : 'More'}</h2>
          <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
        </div>

        <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div key={view} custom={dir} variants={VIEW} initial="enter" animate="show" exit="leave">
        {view === 'settings' ? (
          <AppSettings signedIn={signedIn} onFeedback={openFeedback} onClose={onClose} />
        ) : view === 'pro' ? (
          <ProView onVault={go(() => nav('shop'))} />
        ) : view === 'howto' ? (
          <div className="ag-steps">
            {STEPS.map((s, i) => (
              <div key={s.title} className="ag-step ag-pop" style={{ '--d': `${i * 60}ms` }}>
                <span className="ag-step-num">{i + 1}</span>
                <span className="ag-step-txt">
                  <span className="ag-step-title">{s.title}</span>
                  <span className="ag-step-body">{s.body}</span>
                </span>
              </div>
            ))}
            <button className="ag-btn ag-cta ag-pop" style={{ '--d': '260ms' }} onClick={go(() => nav('play'))}>START DRAFTING</button>
          </div>
        ) : (
          <>
            <div className="ag-tiles">
              {/* website: the dock isn't on the game pages, so Home lives here too (Sign in and
                  BAP Pro are on Home's player card and the profile, not here: too many buttons) */}
              {!IS_APP && <Tile tone="mint" Icon={IconHome} title="HOME" sub="Modes and more" onClick={go(() => nav('home'))} delay="0ms" />}
              {/* the same guided tour as Home's How to play (it opens on Home) */}
              <Tile tone="mint" Icon={IconQuestion} title="HOW TO PLAY" sub="The guided tour" onClick={() => { onClose(); setTimeout(() => window.dispatchEvent(new CustomEvent('bap:tutorial')), 250) }} delay="0ms" />
              <Tile tone="gold" Icon={IconPodium} title="LEADERBOARDS" sub="Top builds" onClick={go(() => nav('leaderboard'))} delay="30ms" />
              <Tile tone="discord" Icon={IconDiscord} title="DISCORD" sub="Join the community" onClick={goOut(() => window.open('https://discord.gg/zdZBu2VjUD', '_blank'))} delay="60ms" />
              <Tile tone="ink" Icon={IconX} title="FOLLOW" sub="@Build_A_Player" onClick={goOut(() => window.open('https://x.com/Build_A_Player', '_blank'))} delay="90ms" />
              <Tile tone="purple" Icon={IconChat} title="FEEDBACK" sub="Ideas & bugs" onClick={openFeedback} delay="120ms" />
              <Tile tone="mint" Icon={IconStar} title="BUILDER PASS" sub="This season's rewards" onClick={go(() => nav('pass'))} delay="150ms" />
              {(isPro() || sellsHere()) && <Tile tone="gold" Icon={IconCrown} title="BAP PRO" sub={isPro() ? 'Active' : '+50% coins · Pro Vault'} onClick={() => setView('pro')} delay="180ms" />}
            </div>
            <button className={`ag-row-btn${muted ? ' ag-sound--off' : ''}`} onClick={() => { setMuted(!muted); setMutedState(!muted) }}>
              <span className="ag-sound-lbl">SOUND</span>
              <span className="ag-sound-switch"><span className="ag-sound-knob" /></span>
              <span className="ag-sound-state">{muted ? 'OFF' : 'ON'}</span>
            </button>
            <button className="ag-row-btn" onClick={() => setView('settings')}>
              <IconGear size={18} /><span className="ag-sound-lbl">SETTINGS · HELP · ACCOUNT</span>
            </button>
            {/* testing tools: only in a local dev build, never for players */}
            {import.meta.env.DEV && <button className={`ag-row-btn${rail ? '' : ' ag-sound--off'}`} onClick={() => { setRailPreview(!rail); setRailState(!rail) }}>
              <span className="ag-sound-lbl">AD RAIL PREVIEW</span>
              <span className="ag-sound-switch"><span className="ag-sound-knob" /></span>
              <span className="ag-sound-state">{rail ? 'ON' : 'OFF'}</span>
            </button>}
            {import.meta.env.DEV && IS_APP && (
              <button className="ag-row-btn" onClick={go(() => nav('soundlab'))}>
                <IconPlay size={18} /><span className="ag-sound-lbl">SOUND LAB · PICK THE SOUNDS</span>
              </button>
            )}
            {!IS_APP && (
              <button className="ag-row-btn" onClick={go(() => nav('wiki'))}>
                <IconDoc size={19} /><span className="ag-sound-lbl">PLAYER WIKI</span>
              </button>
            )}
            <button className="ag-row-btn" onClick={go(() => nav('about'))}>
              <IconInfo size={20} /><span className="ag-sound-lbl">ABOUT THE GAME</span>
            </button>
            <div className="ag-menu-links">
              <button onClick={go(() => { window.location.href = '/privacy' })}><IconShield size={15} /> Privacy</button>
              <button onClick={go(() => { window.location.href = '/terms' })}><IconDoc size={15} /> Terms</button>
            </div>
          </>
        )}
        </motion.div>
        </AnimatePresence>
        {from === 'top' && grab}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
