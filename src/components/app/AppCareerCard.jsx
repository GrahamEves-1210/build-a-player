import { lazy, Suspense } from 'react'
import { useProgress, careerRings, careerSeasons, TITLE_LEVELS } from '../../lib/progress'
import { getUsername } from '../../lib/discord'
import { IconFlame, IconRing, IconStar, IconBag, IconMedal, IconCrown, IconPodium, IconArrow } from './icons'
import { TierChip, Form } from './OnlineRecord'
import { NameTag, AvatarBadge } from './NameTag'
import { CoinPill } from './AppShop'

const CardsStrip = lazy(() => import('./AppCards').then(m => ({ default: m.CardsStrip })))

// App: the top of the Profile page: the player card (level, title, XP) and the cards.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

export default function AppCareerCard({ user }) {
  const p = useProgress()
  const name = getUsername(user) || 'Player'
  const next = TITLE_LEVELS.find(t => t.level > p.lvl.level)
  const seasons = careerSeasons()
  return (
    <section className="ag-career">
      <div className="ag-career-top">
        <AvatarBadge self name={name} size={60} level={p.lvl.level} />
        <span className="ag-career-id">
          <span className="ag-career-name"><NameTag self name={name} /></span>
          <span className="ag-career-title">{p.lvl.title}{p.pro ? <i className="ag-pro-tag">PRO</i> : null}</span>
        </span>
        <CoinPill />
      </div>
      <div className="ag-career-actions">
        <button className="ag-career-act ag-career-act--shop" onClick={() => nav('shop')}><IconBag size={18} /> SHOP</button>
        <button className="ag-career-act" onClick={() => nav('locker')}><IconCrown size={18} /> LOCKER</button>
        <button className={`ag-career-act ag-career-act--wide${p.claimable ? ' ag-career-act--shop' : ''}`} onClick={() => nav('achievements')}><IconMedal size={18} /> ACHIEVEMENTS{p.claimable ? <span className="ag-tab-badge">{p.claimable}</span> : null}</button>
      </div>
      <div className="ag-career-xp">
        <span className="ag-xpbar ag-xpbar--big"><span style={{ width: `${Math.max(2, p.lvl.pct * 100)}%` }} /></span>
        <span className="ag-career-xpn">
          <b>LVL {p.lvl.level}</b> · {p.lvl.max ? 'MAX for this season' : `${p.lvl.into.toLocaleString()} / ${p.lvl.need.toLocaleString()} XP`}
          {next && <em> · {next.name} at {next.level}</em>}
          {p.bp && <em> · starts over next season</em>}
        </span>
      </div>
      <div className="ag-career-stats">
        <span><IconStar size={15} /><b>{seasons.toLocaleString()}</b>SEASONS</span>
        <span><IconRing size={15} /><b>{careerRings().toLocaleString()}</b>RINGS</span>
        <button onClick={() => nav('daily')}><IconFlame size={15} /><b>{p.streak.count}</b>STREAK</button>
      </div>
      <button className="ag-career-online" onClick={() => nav('online')}>
        <span className="ag-career-online-ico"><IconPodium size={16} /></span>
        <span className="ag-career-online-txt">
          <span><b>{p.stats?.online?.rating ?? 800}</b> ONLINE RATING <TierChip rating={p.stats?.online?.rating ?? 800} /></span>
          <small>{(p.stats?.online?.played ?? 0) ? `${p.stats.online.played} online games · best ${p.stats.online.best}` : 'Compete, Blacktop and 1v1 move it'}</small>
        </span>
        <IconArrow size={14} />
      </button>
      <Suspense fallback={<div className="ag-cards-tile" />}><CardsStrip /></Suspense>
    </section>
  )
}
