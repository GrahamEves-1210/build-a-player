import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useProgress, tierFor, tierIndex } from '../../lib/progress'
import { achById } from '../../lib/achievements'
import { getUsername } from '../../lib/discord'
import { loadHardware, loadBestBuilds, loadTrophySeasons, seasonPos, modeName, seasonAwards, seasonDate } from '../../lib/trophies'
import { sfx, haptic } from '../../lib/juice'
import { TrophyArt, TrophyDefs } from './TrophyArt'
import { IconClose, IconFootball, IconBasketball, IconRing } from './icons'
import { HEADSHOT_BASE, nflHeadshot } from '../../utils/simulation'
import HEADSHOTS from '../../data/headshots.json'
import NBA_HEADSHOTS from '../../data/nba-headshots.json'
import { ATTR } from '../../data/qbs'
import { RB_ATTR } from '../../data/rbs'
import { WR_ATTR } from '../../data/wrs'
import { TE_ATTR } from '../../data/tes'
import { DB_ATTR } from '../../data/dbs'
import { OL_ATTR } from '../../data/ols'
import { BUCKET_ATTR } from '../../data/nba-attrs'
import './trophy-case.css'

// Profile → Trophy Case: the player's real hardware on lit shelves (rings, the
// season awards, perfect seasons, 90+ / 95+ builds, then the live modes), and the
// best saved season at each position. Tap a trophy or a build for where it came from.
// Saved seasons and award counters: lib/trophies.js. Live modes: lib/progress.js stats.

const TIER_GEM = { Rookie: '#9aa7a0', Starter: '#5EDBD8', Pro: '#60a5fa', 'All-Star': '#a78bfa', MVP: '#fb923c', Legend: '#f5dc8a' }
const ACCENT = 'var(--ag-a1, #4fd6b7)'
const ATTRS = { qb: ATTR, rb: RB_ATTR, wr: WR_ATTR, te: TE_ATTR, db: DB_ATTR, ol: OL_ATTR, guard: BUCKET_ATTR, big: BUCKET_ATTR }
const SPORT_TINT = { nfl: '#4fd6b7', bucket: '#fb923c' }

const n0 = v => (Number.isFinite(v) ? v : 0)
const fmt = v => n0(v).toLocaleString()
const plural = (n, one, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`

// The three shelves: what each trophy is, how it's won, and the count behind it
function shelves(h, st, ach) {
  const on = st.online || {}
  const best = n0(on.best) || 800
  const tier = tierFor(best)[1]
  const cp = st.compete || {}
  const unlocked = id => (ach?.[id] ? { name: achById(id)?.title, at: ach[id] } : null)
  const split = a => [['Current', a.current], ['All-Time', a.allTime], ['Basketball', a.bucket]].filter(([, v]) => v > 0)
  return [
    { id: 'titles', label: 'TITLES & AWARDS', items: [
      { id: 'rings', art: 'rings', gem: ACCENT, label: 'RINGS', title: 'Championships', n: h.rings, rows: true,
        what: 'Saved seasons that ended with the title: a Super Bowl or an NBA championship.',
        how: 'Win the last game of a season, in either sport.' },
      { id: 'mvp', art: 'mvp', label: 'MVP', title: 'Most Valuable Player', n: h.mvp.total, rows: true, split: split(h.mvp), untagged: h.mvp.allTime,
        what: 'Season MVPs: QB seasons in football, and Build-A-Bucket seasons.',
        how: 'Have the best season in the league at QB, or in Build-A-Bucket.' },
      { id: 'opoy', art: 'opoy', label: 'OPOY', title: 'Offensive Player of the Year', n: h.opoy.total, rows: true, split: split(h.opoy), untagged: h.opoy.allTime,
        what: 'The league\'s best offensive season from an RB, WR or TE build.',
        how: 'Put up the best offensive season at RB, WR or TE.' },
      { id: 'dpoy', art: 'dpoy', label: 'DPOY', title: 'Defensive Player of the Year', n: h.dpoy.total, rows: true, split: split(h.dpoy), untagged: h.dpoy.allTime,
        what: 'The league\'s best defensive season: a DB build, or Build-A-Bucket\'s best defender.',
        how: 'Lock down the league at DB, or on defense in Build-A-Bucket.' },
    ] },
    { id: 'seasons', label: 'SEASONS & BUILDS', items: [
      { id: 'allpro', art: 'allpro', label: 'ALL-PRO', title: 'All-Pro', n: h.allpro, rows: true,
        what: 'Offensive line seasons voted All-Pro.',
        how: 'Build an OL good enough to make the All-Pro team.' },
      { id: 'perfect', art: 'perfect', gem: ACCENT, label: 'PERFECT', title: 'Perfect Season', n: h.perfect, rows: true,
        what: 'Regular seasons finished without a single loss.',
        how: 'Go the whole regular season unbeaten.' },
      { id: 'ovr90', art: 'ovr90', gem: ACCENT, label: '90+ BUILDS', title: '90+ OVR Builds', n: h.ovr90, rows: true,
        what: 'Saved seasons played with a build rated 90 or higher.',
        how: 'Spin a build that rates 90+ and play its season.' },
      { id: 'ovr95', art: 'ovr95', label: '95+ BUILDS', title: '95+ OVR Builds', n: h.ovr95, rows: true,
        what: 'Saved seasons played with a build rated 95 or higher. The rarest builds in the game.',
        how: 'Spin a build that rates 95+ and play its season.' },
    ] },
    { id: 'live', label: 'LIVE MODES', items: [
      { id: 'tier', art: 'tier', gem: TIER_GEM[tier], tier: tierIndex(best), label: 'BEST TIER', title: 'Best Online Tier', n: n0(on.played) > 0 ? 1 : 0, word: tier.toUpperCase(),
        what: 'The highest tier the online rating has reached. Compete pools, Blacktop and 1v1 games move it.',
        how: 'Play any online game to get rated.',
        facts: [['Best rating', fmt(best)], ['Rating now', fmt(on.rating ?? 800)], ['Online games', fmt(on.played)]],
        unlock: unlocked('legendtier') || unlocked('allstar') },
      { id: 'compete', art: 'compete', label: 'POOL WINS', title: 'Compete Pool Wins', n: n0(cp.wins),
        what: 'Compete pools finished in first place.',
        how: 'Out-build the whole pool in a Compete game.',
        facts: [['Pools won', fmt(cp.wins)], ['Top-3 finishes', fmt(cp.podiums)], ['Pools played', fmt(cp.played)], ['Best win streak', fmt(cp.bestStreak)]],
        unlock: unlocked('cpwin1') },
      { id: 'takeover', art: 'takeover', gem: ACCENT, label: 'TAKEOVERS', title: 'Takeover Runs', n: n0(st.tkRuns),
        what: 'Takeover roads finished with every city taken.',
        how: 'Take every city on a Takeover road.',
        facts: [['Roads finished', fmt(st.tkRuns)], ['Cities taken', fmt(st.tkCities)]],
        unlock: unlocked('tkrun') },
      { id: 'blacktop', art: 'blacktop', label: 'BLACKTOP WINS', title: 'Blacktop Wins', n: n0(st.btWins),
        what: 'Blacktop games won.',
        how: 'Win a Blacktop game.',
        facts: [['Wins', fmt(st.btWins)], ['Games', fmt(st.btGames)], ['Game MVPs', fmt(st.btMvp)]],
        unlock: unlocked('bt1') },
    ] },
  ]
}

// Sticky "has been seen" for the shelves (one observer; shelves that come into view
// together light up as a wave, top-left to bottom-right)
function useWave(count, ready) {
  const refs = useRef([])
  const [on, setOn] = useState({})
  useEffect(() => {
    if (!ready) return
    const els = refs.current.slice(0, count)
    if (typeof IntersectionObserver === 'undefined') { setOn(Object.fromEntries(els.map((_, i) => [i, i]))); return }
    const io = new IntersectionObserver(entries => {
      const hit = entries.filter(e => e.isIntersecting).map(e => +e.target.dataset.wave).sort((a, b) => a - b)
      if (!hit.length) return
      hit.forEach(i => els[i] && io.unobserve(els[i]))
      setOn(prev => { const next = { ...prev }; hit.forEach((s, k) => { if (next[s] == null) next[s] = k }); return next })
    }, { threshold: 0.3 })
    els.forEach(el => el && io.observe(el))
    return () => io.disconnect()
  }, [count, ready])
  return [refs, on]
}

// A face for a trait: the game's headshot, initials when there isn't one
function Face({ name, sport, size = 26 }) {
  const [bad, setBad] = useState(false)
  const id = sport === 'bucket' ? NBA_HEADSHOTS[name] : HEADSHOTS[name]
  const src = !id || bad ? null : sport === 'bucket' ? `${HEADSHOT_BASE}/nba/${id}.webp` : nflHeadshot(id)
  const init = String(name || '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span className="tc-face" style={{ width: size, height: size }} title={name}>
      {src ? <img src={src} alt="" loading="lazy" draggable={false} onError={() => setBad(true)} /> : <i>{init}</i>}
    </span>
  )
}

// The traits of a saved build, best first
const traitsOf = row => Object.entries(row?.build || {})
  .filter(([, d]) => d?.qb)
  .map(([type, d]) => ({ type, name: d.qb, team: d.team, val: Number.isFinite(d.val) ? d.val : null }))
const lastName = n => { const w = String(n).split(' '); return /^(jr\.?|sr\.?|ii|iii|iv)$/i.test(w[w.length - 1]) && w.length > 2 ? w[w.length - 2] : w[w.length - 1] }
const traitLabel = (pos, type) => ATTRS[pos]?.[type]?.label || type.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ')

function Marks({ row }) {
  const awards = seasonAwards(row)
  const perfect = row.losses === 0 && row.wins > 0
  if (!row.champion && !awards.length && !perfect) return null
  return (
    <span className="tc-marks">
      {row.champion && <i className="tc-mark tc-mark--ring" title="Champions"><IconRing size={12} /><span className="sr-only">Champions</span></i>}
      {awards.map(a => <i key={a} className="tc-mark tc-mark--award">{a}</i>)}
      {perfect && <i className="tc-mark">PERFECT</i>}
    </span>
  )
}

const SportIcon = ({ sport, size = 13, tint = false }) => {
  const style = tint ? { color: SPORT_TINT[sport] } : undefined
  return sport === 'bucket' ? <IconBasketball size={size} style={style} /> : <IconFootball size={size} style={style} />
}

export default function TrophyCase({ user }) {
  const uid = user?.id ?? null
  const name = getUsername(user) || 'Guest'
  const p = useProgress()
  const [hw, setHw] = useState(undefined)       // undefined: loading · null: couldn't load
  const [best, setBest] = useState(undefined)
  const [open, setOpen] = useState(null)        // { trophy } | { build }

  const load = useCallback(() => {
    if (!uid) return () => {}
    let live = true
    setHw(undefined); setBest(undefined)
    loadHardware(uid).then(d => { if (live) setHw(d) }, () => { if (live) setHw(null) })
    loadBestBuilds(uid).then(d => { if (live) setBest(d) }, () => { if (live) setBest(null) })
    return () => { live = false }
  }, [uid])
  useEffect(() => load(), [load])

  const ready = hw !== undefined
  const list = hw ? shelves(hw, p.stats || {}, p.ach) : shelves({ rings: 0, perfect: 0, ovr90: 0, ovr95: 0, allpro: 0, mvp: { total: 0 }, opoy: { total: 0 }, dpoy: { total: 0 } }, {}, null)
  const all = list.flatMap(s => s.items)
  const won = hw ? all.filter(t => t.n > 0).length : 0

  const [shelfRefs, shelfOn] = useWave(list.length, !!hw)
  const [railRefs, railOn] = useWave(1, Array.isArray(best) && best.length > 0)

  const tap = item => { sfx('tap'); haptic('light'); setOpen(item) }

  if (!uid) return null
  return (
    <section className="tc" aria-labelledby="tc-title">
      <TrophyDefs />
      <div className="tc-head">
        <h2 className="tc-title" id="tc-title">TROPHY CASE</h2>
        {hw && <span className="tc-count" aria-label={`${won} of ${all.length} trophies won`}><b>{won}</b>/{all.length}</span>}
      </div>

      <div className="tc-cab">
        {list.map((shelf, si) => (
          <div key={shelf.id} className={`tc-shelf${shelfOn[si] != null ? ' is-on' : ''}`} data-wave={si} ref={el => { shelfRefs.current[si] = el }}>
            <div className="tc-row">
              {shelf.items.map((t, i) => {
                const lit = t.n > 0
                const delay = ((shelfOn[si] ?? 0) + i) * 100
                return (
                  <button key={t.id} type="button" className={`tc-item ${lit ? 'is-lit' : 'is-dim'}`} disabled={!hw}
                    style={{ '--d': `${delay}ms`, '--sd': `${delay + 320}ms` }}
                    onClick={() => tap({ trophy: { ...t, shelf: shelf.label } })}
                    aria-label={`${t.title}: ${lit ? (t.word || fmt(t.n)) : 'not won yet'}`}>
                    <span className="tc-stage">
                      <span className="tc-beam" aria-hidden="true" />
                      <TrophyArt kind={t.art} gem={t.gem} tier={t.tier} shine={lit && shelfOn[si] != null ? 1 : 0} />
                    </span>
                    <span className="tc-tag">
                      <b>{lit ? (t.word || fmt(t.n)) : '–'}</b>
                      <small>{t.label}</small>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {!ready && <div className="tc-wait" aria-label="Loading the trophy case"><span /><span /><span /></div>}
        {hw === null && (
          <div className="tc-wait tc-wait--err" role="status">
            <p>Couldn't open the trophy case.</p>
            <button type="button" className="tc-retry" onClick={load}>RETRY</button>
          </div>
        )}
      </div>

      <div className="tc-sub-head">
        <span className="ag-eyebrow">BEST BUILDS</span>
        <small>TOP SEASON AT EACH POSITION</small>
      </div>
      {best === undefined && <div className="tc-rail" aria-label="Loading best builds"><span className="tc-card-ghost" /><span className="tc-card-ghost" /><span className="tc-card-ghost" /></div>}
      {best === null && <p className="tc-note">Couldn't load the best builds. <button type="button" className="tc-link" onClick={load}>Retry</button></p>}
      {Array.isArray(best) && best.length === 0 && <p className="tc-note">No saved seasons yet. Finish a season signed in and its build is kept here.</p>}
      {Array.isArray(best) && best.length > 0 && (
        <div className={`tc-rail${railOn[0] != null ? ' is-on' : ''}`} data-wave={0} ref={el => { railRefs.current[0] = el }}>
          {best.map((row, i) => {
            const traits = traitsOf(row).sort((a, b) => n0(b.val) - n0(a.val))
            const sport = row.pos.sport
            return (
              <button key={row.pos.key} type="button" className={`tc-card${i === 0 ? ' is-top' : ''}`}
                style={{ '--d': `${Math.min(i, 6) * 100}ms`, '--bc': i === 0 ? 'var(--ag-gold-hi, #f2d675)' : SPORT_TINT[sport] }}
                onClick={() => tap({ build: row })}
                aria-label={`Best ${row.pos.label} season: ${row.ovr} OVR, ${row.wins ?? 0}-${row.losses ?? 0}, ${modeName(row).toLowerCase()}`}>
                <span className="tc-card-top">
                  <span className="tc-card-pos"><SportIcon sport={sport} size={12} />{row.pos.label}</span>
                  <span className="tc-card-mode">{modeName(row)}</span>
                </span>
                <span className="tc-card-ovr"><b>{row.ovr}</b><small>OVR</small></span>
                {row.archetype && <span className="tc-card-arch">{row.archetype}</span>}
                <span className="tc-card-rec">
                  {row.wins != null && <b>{row.wins}-{row.losses ?? 0}</b>}
                  <Marks row={row} />
                </span>
                <span className="tc-card-faces">
                  {traits.slice(0, 3).map(t => <Face key={t.type} name={t.name} sport={sport} size={24} />)}
                  {traits.length > 3 && <em>+{traits.length - 3}</em>}
                </span>
                <span className="tc-card-names">{traits.slice(0, 3).map(t => lastName(t.name)).join(' · ')}</span>
                <span className="tc-card-date">{seasonDate(row.created_at)}</span>
              </button>
            )
          })}
        </div>
      )}

      {open?.trophy && <TrophySheet uid={uid} name={name} t={open.trophy} onClose={() => setOpen(null)} />}
      {open?.build && <BuildSheet row={open.build} onClose={() => setOpen(null)} />}
    </section>
  )
}

// A bottom sheet (a centred card on wide screens): Escape and the backdrop close it,
// focus goes to Close and comes back after
function Sheet({ label, eyebrow, onClose, children }) {
  const closeRef = useRef(null)
  const closeFn = useRef(onClose)
  closeFn.current = onClose
  useEffect(() => {
    const back = document.activeElement
    closeRef.current?.focus()
    const onKey = e => { if (e.key === 'Escape') closeFn.current() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      if (back && typeof back.focus === 'function' && document.contains(back)) back.focus()
    }
  }, [])
  return createPortal(
    <div className="tc-overlay" onClick={onClose}>
      <div className="tc-sheet" role="dialog" aria-modal="true" aria-label={label} onClick={e => e.stopPropagation()}>
        <TrophyDefs />
        <div className="tc-grab" aria-hidden="true" />
        <div className="tc-sheet-head">
          <span className="ag-eyebrow">{eyebrow}</span>
          <button ref={closeRef} type="button" className="tc-close" onClick={onClose} aria-label="Close"><IconClose size={18} /></button>
        </div>
        <div className="tc-sheet-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}

function SeasonRow({ row }) {
  const pos = seasonPos(row)
  return (
    <div className="tc-srow">
      <span className="tc-srow-ovr"><b>{row.ovr ?? '–'}</b><small>OVR</small></span>
      <span className="tc-srow-main">
        <span className="tc-srow-pos"><SportIcon sport={pos.sport} size={12} tint />{pos.label} · {modeName(row)}</span>
        <small>{[row.archetype, seasonDate(row.created_at)].filter(Boolean).join(' · ')}</small>
      </span>
      <span className="tc-srow-rec">
        {row.wins != null && <b>{row.wins}-{row.losses ?? 0}</b>}
        <Marks row={row} />
      </span>
    </div>
  )
}

function TrophySheet({ uid, name, t, onClose }) {
  const lit = t.n > 0
  const [seasons, setSeasons] = useState(t.rows && lit ? undefined : false)
  useEffect(() => {
    if (!t.rows || !lit) return
    let live = true
    loadTrophySeasons(uid, t.id).then(d => { if (live) setSeasons(d) }, () => { if (live) setSeasons(null) })
    return () => { live = false }
  }, [uid, t.id, t.rows, lit])
  const byOvr = t.id === 'ovr90' || t.id === 'ovr95'
  const listed = seasons?.list ?? []
  const first = seasons?.first
  return (
    <Sheet label={t.title} eyebrow={t.shelf} onClose={onClose}>
      <div className={`tc-hero${lit ? ' is-lit' : ' is-dim'}`}>
        <span className="tc-hero-beam" aria-hidden="true" />
        <TrophyArt kind={t.art} gem={t.gem} tier={t.tier} shine={lit ? 1 : 0} className="tc-hero-art" />
      </div>
      <div className="tc-hero-n">
        {lit ? <b>{t.word || fmt(t.n)}</b> : <b className="is-none">NOT YET</b>}
        <h3>{t.title}</h3>
      </div>
      <p className="tc-desc">{t.what}</p>
      {!lit && <p className="tc-desc tc-desc--how">Not on {name}'s shelf yet. {t.how}</p>}

      {lit && t.split?.length > 0 && (
        <div className="tc-facts">
          {t.split.map(([k, v]) => <span key={k}><small>{k.toUpperCase()}</small><b>{fmt(v)}</b></span>)}
        </div>
      )}
      {t.facts && (lit || t.id !== 'tier') && (
        <div className="tc-facts">
          {t.facts.map(([k, v]) => <span key={k}><small>{k.toUpperCase()}</small><b>{v}</b></span>)}
        </div>
      )}
      {lit && t.unlock?.at && <p className="tc-when">{t.unlock.name} unlocked {seasonDate(new Date(t.unlock.at).toISOString())}</p>}

      {t.rows && lit && (
        <>
          {seasons === undefined && <div className="tc-wait tc-wait--inline" aria-label="Loading seasons"><span /><span /><span /></div>}
          {seasons === null && <p className="tc-note">Couldn't load the seasons behind it.</p>}
          {first && <p className="tc-when">First {t.id === 'rings' ? 'won' : 'earned'} {seasonDate(first.created_at)} · {seasonPos(first).label} · {modeName(first)}</p>}
          {listed.length > 0 && (
            <>
              <div className="tc-sub-head tc-sub-head--sheet"><span className="ag-eyebrow">{byOvr ? 'BEST OF THEM' : listed.length === 1 ? 'THE SEASON' : 'LATEST'}</span></div>
              <div className="tc-srows">{listed.map((r, i) => <SeasonRow key={i} row={r} />)}</div>
            </>
          )}
          {seasons && !listed.length && t.untagged > 0 && <p className="tc-note">All-Time awards are counted on the account, not kept on their seasons.</p>}
          {listed.length > 0 && t.untagged > 0 && <p className="tc-note">{plural(t.untagged, 'All-Time award')} {t.untagged === 1 ? 'is' : 'are'} counted on the account but not kept on {t.untagged === 1 ? 'its season' : 'their seasons'}, so {t.untagged === 1 ? 'it isn\'t' : 'they aren\'t'} listed.</p>}
        </>
      )}
    </Sheet>
  )
}

function BuildSheet({ row, onClose }) {
  const pos = row.pos || seasonPos(row)
  const traits = traitsOf(row)
  const top = Math.max(...traits.map(t => n0(t.val)))
  return (
    <Sheet label={`Best ${pos.label} season`} eyebrow={`BEST ${pos.label} SEASON`} onClose={onClose}>
      <div className="tc-bhero" style={{ '--bc': SPORT_TINT[pos.sport] }}>
        <span className="tc-bhero-ovr"><b>{row.ovr}</b><small>OVR</small></span>
        <span className="tc-bhero-id">
          <span className="tc-bhero-pos"><SportIcon sport={pos.sport} size={14} tint />{pos.label} · {modeName(row)}</span>
          {row.archetype && <span className="tc-bhero-arch">{row.archetype}</span>}
          <span className="tc-bhero-rec">
            {row.wins != null && <b>{row.wins}-{row.losses ?? 0}</b>}
            {row.playoffs && !row.champion && <i className="tc-mark">PLAYOFFS</i>}
            <Marks row={row} />
          </span>
          <small>{seasonDate(row.created_at)}</small>
        </span>
      </div>
      <div className="tc-sub-head tc-sub-head--sheet"><span className="ag-eyebrow">THE BUILD</span><small>{traits.length} TRAITS</small></div>
      <div className="tc-traits">
        {traits.map((t, i) => (
          <div key={t.type} className="tc-trait" style={{ '--d': `${Math.min(i, 9) * 40}ms` }}>
            <Face name={t.name} sport={pos.sport} size={34} />
            <span className="tc-trait-main">
              <small>{traitLabel(pos.key, t.type)}</small>
              <b>{t.name}</b>
            </span>
            {t.team && <span className="tc-trait-team">{t.team}</span>}
            {t.val != null && <span className={`tc-trait-val${t.val === top ? ' is-top' : ''}`}>{t.val}</span>}
          </div>
        ))}
      </div>
    </Sheet>
  )
}
