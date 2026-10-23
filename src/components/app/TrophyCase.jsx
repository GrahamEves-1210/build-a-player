import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useProgress, tierFor, tierIndex } from '../../lib/progress'
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

// Profile → Trophy Case: the player's real hardware on lit shelves (seasons: rings,
// perfect seasons, the 90+ club; awards: MVP, OPOY, DPOY, All-Pro; live: online tier,
// Compete, Squad Builder, Blacktop), and the top-OVR saved season at each position.
// Tap a trophy or a build for the stats behind it.
// Saved seasons and award counters: lib/trophies.js. Live modes: lib/progress.js stats.

const TIER_GEM = { Rookie: '#9aa7a0', Starter: '#5EDBD8', Pro: '#60a5fa', 'All-Star': '#a78bfa', MVP: '#fb923c', Legend: '#f5dc8a' }
const ACCENT = 'var(--ag-a1, #4fd6b7)'
const ATTRS = { qb: ATTR, rb: RB_ATTR, wr: WR_ATTR, te: TE_ATTR, db: DB_ATTR, ol: OL_ATTR, guard: BUCKET_ATTR, big: BUCKET_ATTR }
const SPORT_TINT = { nfl: '#4fd6b7', bucket: '#fb923c' }

const n0 = v => (Number.isFinite(v) ? v : 0)
const fmt = v => n0(v).toLocaleString()

// The online tier lights at Starter: every rating starts in Rookie
const TIER_LIT = 900

// The three shelves. Each trophy: its count (n), one line on how it's won, and the
// stat rows behind it (facts: [label, value]; live ones show even before it's won).
// Seasons and awards: lib/trophies.js. Live: this device's progress stats.
function shelves(h, st, ach) {
  const on = st.online || {}
  const best = n0(on.best) || 800
  const tier = tierFor(best)[1]
  const cp = st.compete || {}
  const b2 = st.bt2 || {}, b1 = st.bt1 || {}
  const bt = { w: n0(st.btWins) + n0(b2.wins) + n0(b1.wins), g: n0(st.btGames) + n0(b2.games) + n0(b1.games), mvp: n0(st.btMvp) + n0(b2.mvp) + n0(b1.mvp) }
  const first = id => (ach?.[id] ? [['First', seasonDate(new Date(ach[id]).toISOString())]] : [])
  const bySport = a => [['Football', a.football], ['Basketball', a.bucket]].filter(([, v]) => v > 0).map(([k, v]) => [k, fmt(v)])
  return [
    { id: 'seasons', label: 'SEASONS', items: [
      { id: 'rings', art: 'rings', gem: ACCENT, label: 'RINGS', title: 'Rings', n: h.rings.total, rows: true,
        line: 'Win the title. Football or basketball.', facts: bySport(h.rings) },
      { id: 'perfect', art: 'perfect', gem: ACCENT, label: 'PERFECT', title: 'Perfect Seasons', n: h.perfect, rows: true,
        line: 'Go unbeaten in the regular season.' },
      { id: 'ovr90', art: h.ovr95 > 0 ? 'ovr95' : 'ovr90', gem: ACCENT, label: '90+ CLUB', title: '90+ Club', n: h.ovr90, rows: true,
        line: 'Play a season with a 90+ OVR build.',
        facts: [['90 to 94', fmt(h.ovr90 - h.ovr95)], ['95+', fmt(h.ovr95)]] },
    ] },
    { id: 'awards', label: 'AWARDS', items: [
      { id: 'mvp', art: 'mvp', label: 'MVP', title: 'MVP', n: h.mvp.total, rows: true, unlisted: h.mvp.unlisted,
        line: 'League MVP. QB in football, any build in basketball.', facts: bySport(h.mvp) },
      { id: 'opoy', art: 'opoy', label: 'OPOY', title: 'Offensive POY', n: h.opoy.total, rows: true, unlisted: h.opoy.unlisted,
        line: 'Top offensive season at RB, WR or TE.' },
      { id: 'dpoy', art: 'dpoy', label: 'DPOY', title: 'Defensive POY', n: h.dpoy.total, rows: true, unlisted: h.dpoy.unlisted,
        line: 'Top defender. DB in football, any build in basketball.', facts: bySport(h.dpoy) },
      { id: 'allpro', art: 'allpro', label: 'ALL-PRO', title: 'All-Pro', n: h.allpro, rows: true,
        line: 'Make All-Pro at OL in a Current season.' },
    ] },
    { id: 'live', label: 'LIVE', live: true, items: [
      { id: 'tier', art: 'tier', gem: TIER_GEM[tier], tier: tierIndex(best), label: 'TIER', title: 'Online Tier', n: best >= TIER_LIT ? 1 : 0, word: tier.toUpperCase(),
        line: 'Best online tier. Starter starts at 900.',
        facts: [['Best rating', fmt(best)], ['Rating now', fmt(on.rating ?? 800)], ['Games', fmt(on.played)]] },
      { id: 'compete', art: 'compete', label: 'POOL WINS', title: 'Compete Wins', n: n0(cp.wins),
        line: 'Finish first in a Compete pool.',
        facts: [['Pools', fmt(cp.played)], ['Top 3', fmt(cp.podiums)], ['Best streak', fmt(cp.bestStreak)], ...first('cpwin1')] },
      { id: 'squad', art: 'squad', gem: ACCENT, label: 'SQUAD TITLES', title: 'Squad Builder Titles', n: n0(st.sqTitles),
        line: 'Win a title with a Squad Builder team.',
        facts: [['Squad seasons', fmt(st.sqSeasons)], ...first('sqtitle')] },
      { id: 'blacktop', art: 'blacktop', label: 'BLACKTOP', title: 'Blacktop Wins', n: bt.w,
        line: 'Win on the Blacktop. 3v3, 2v2 or 1v1.',
        facts: [['Record', `${fmt(bt.w)}-${fmt(Math.max(0, bt.g - bt.w))}`],
          ...[['3v3 wins', st.btWins], ['2v2 wins', b2.wins], ['1v1 wins', b1.wins]].filter(([, v]) => n0(v) > 0 && n0(v) < bt.w).map(([k, v]) => [k, fmt(v)]),
          ['Game MVPs', fmt(bt.mvp)]] },
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
  const none = { football: 0, bucket: 0, total: 0, unlisted: 0 }
  const list = shelves(hw || { rings: none, perfect: 0, ovr90: 0, ovr95: 0, allpro: 0, mvp: none, opoy: none, dpoy: none }, hw ? p.stats || {} : {}, hw ? p.ach : null)
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
        {hw && <span className="tc-count" aria-label={`${won} of ${all.length} trophies`}><b>{won}</b>/{all.length}</span>}
      </div>

      <div className="tc-cab">
        {list.map((shelf, si) => (
          <div key={shelf.id} className={`tc-shelf${shelfOn[si] != null ? ' is-on' : ''}`} data-wave={si} ref={el => { shelfRefs.current[si] = el }}>
            <div className="tc-row" style={{ '--cols': shelf.items.length }}>
              {shelf.items.map((t, i) => {
                const lit = t.n > 0
                const delay = ((shelfOn[si] ?? 0) + i) * 100
                return (
                  <button key={t.id} type="button" className={`tc-item ${lit ? 'is-lit' : 'is-dim'}`} disabled={!hw}
                    style={{ '--d': `${delay}ms`, '--sd': `${delay + 320}ms` }}
                    onClick={() => tap({ trophy: { ...t, shelf: shelf.label, live: !!shelf.live } })}
                    aria-label={`${t.title}: ${lit ? (t.word || fmt(t.n)) : 'none yet'}`}>
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
        {!ready && <div className="tc-wait" aria-label="Loading trophies"><span /><span /><span /></div>}
        {hw === null && (
          <div className="tc-wait tc-wait--err" role="status">
            <p>Couldn't load trophies.</p>
            <button type="button" className="tc-retry" onClick={load}>RETRY</button>
          </div>
        )}
      </div>

      <div className="tc-sub-head">
        <span className="ag-eyebrow">BEST BUILDS</span>
        <small>TOP OVR AT EACH POSITION</small>
      </div>
      {best === undefined && <div className="tc-rail" aria-label="Loading best builds"><span className="tc-card-ghost" /><span className="tc-card-ghost" /><span className="tc-card-ghost" /></div>}
      {best === null && <p className="tc-note">Couldn't load builds. <button type="button" className="tc-link" onClick={load}>Retry</button></p>}
      {Array.isArray(best) && best.length === 0 && <p className="tc-note">No saved seasons yet.</p>}
      {Array.isArray(best) && best.length > 0 && (
        <div className={`tc-rail${railOn[0] != null ? ' is-on' : ''}`} data-wave={0} ref={el => { railRefs.current[0] = el }}>
          {best.map((row, i) => {
            const traits = traitsOf(row).sort((a, b) => n0(b.val) - n0(a.val))
            const sport = row.pos.sport
            return (
              <button key={row.pos.key} type="button" className={`tc-card${i === 0 ? ' is-top' : ''}`}
                style={{ '--d': `${Math.min(i, 6) * 100}ms`, '--bc': i === 0 ? 'var(--ag-gold-hi, #f2d675)' : SPORT_TINT[sport] }}
                onClick={() => tap({ build: row })}
                aria-label={`Best ${row.pos.label} build: ${row.ovr} OVR, ${row.wins ?? 0}-${row.losses ?? 0}, ${modeName(row).toLowerCase()}`}>
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

      {open?.trophy && <TrophySheet uid={uid} t={open.trophy} onClose={() => setOpen(null)} />}
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

// Stat rows: label left, value right
function Stats({ rows }) {
  if (!rows.length) return null
  return (
    <dl className="tc-stats">
      {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  )
}

function TrophySheet({ uid, t, onClose }) {
  const lit = t.n > 0
  const [seasons, setSeasons] = useState(t.rows && lit ? undefined : false)
  useEffect(() => {
    if (!t.rows || !lit) return
    let live = true
    loadTrophySeasons(uid, t.id).then(d => { if (live) setSeasons(d) }, () => { if (live) setSeasons(null) })
    return () => { live = false }
  }, [uid, t.id, t.rows, lit])
  const byOvr = t.id === 'ovr90'
  const listed = seasons?.list ?? []
  const unlisted = n0(t.unlisted)
  // the first season on file is the first one won only when every one of them is on file
  const first = seasons?.first && !unlisted ? [['First', `${seasonDate(seasons.first.created_at)} · ${seasonPos(seasons.first).label}`]] : []
  const rows = lit || t.live ? [...(t.facts ?? []), ...first] : []
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
      <p className="tc-desc">{t.line}</p>
      <Stats rows={rows} />

      {t.rows && lit && (
        <>
          {seasons === undefined && <div className="tc-wait tc-wait--inline" aria-label="Loading seasons"><span /><span /><span /></div>}
          {seasons === null && <p className="tc-note">Couldn't load seasons.</p>}
          {listed.length > 0 && (
            <div className="tc-sub-head tc-sub-head--sheet">
              <span className="ag-eyebrow">{byOvr ? 'TOP OVR' : 'LATEST'}</span>
              {unlisted > 0 && <small>+{fmt(unlisted)} NOT LISTED</small>}
            </div>
          )}
          {listed.length > 0 && <div className="tc-srows">{listed.map((r, i) => <SeasonRow key={i} row={r} />)}</div>}
          {seasons && !listed.length && unlisted > 0 && <p className="tc-note">All-Time awards aren't kept by season.</p>}
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
    <Sheet label={`Best ${pos.label} build`} eyebrow={`BEST ${pos.label} BUILD`} onClose={onClose}>
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
      <div className="tc-sub-head tc-sub-head--sheet"><span className="ag-eyebrow">BUILD</span><small>{traits.length} TRAITS</small></div>
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
