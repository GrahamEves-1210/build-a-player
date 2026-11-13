import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useSheetDrag, overlayMotion } from '../app/Sheet'
import { EASE_DRAWER } from '../../lib/motion'
import { sfx, haptic } from '../../lib/juice'
import { HEADSHOT_BASE } from '../../utils/simulation'
import { teamOf } from './frTeams'

// FRANCHISE: the shared pieces every screen of the mode is made of (styles: franchise.css).
//   FrShell      the frame: scorebug, page, pinned button, tab bar (phone) / left rail (desktop)
//   Bug          the scorebug header
//   Panel        a titled panel (title bar + rows)
//   FrTable      the dense sortable table
//   FrSheet      a sheet: up from the bottom on a phone, in from the right on a desktop
//   Confirm      a small yes / no box
//   FrMeters     two meters side by side (a negotiation's PATIENCE and INTEREST)
//   FrTicker     the news ticker: one headline at a time, by steps; rests through lib/fxPause.js
//   Logo, Face, Steps, Switch, Seg, Stepper
// Nothing here knows the engine: screens hand in plain values.

// ── which layout: a desktop is 1024 and up (franchise.css's one breakpoint) ─────────────────
const WIDE = '(min-width: 1024px)'
const subWide = fn => { const m = window.matchMedia(WIDE); m.addEventListener('change', fn); return () => m.removeEventListener('change', fn) }
export const useWide = () => useSyncExternalStore(subWide, () => window.matchMedia(WIDE).matches, () => false)

const tap = () => { sfx('tap'); haptic('light') }

// ── small things ────────────────────────────────────────────────────────────
export const Logo = ({ team, size = 24 }) => {
  const t = teamOf(team)
  return t.logo ? <img className="fr-logo" src={t.logo} width={size} height={size} alt="" draggable={false} loading="lazy" decoding="async" /> : null
}
// a headshot id (ESPN's, public/headshots) → its file; a full URL passes through
export const faceUrl = photo => (!photo ? null : /^(https?:|\/)/.test(photo) ? photo : String(photo).includes('.') ? `${HEADSHOT_BASE}/${photo}` : `${HEADSHOT_BASE}/${photo}.webp`)
const initialsOf = name => String(name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
// a player's face: the headshot, or his initials when there is none (or it fails to load)
export function Face({ name, photo, size = null }) {
  const [bad, setBad] = useState(false)
  const src = bad ? null : faceUrl(photo)
  return (
    <span className="fr-face" style={size ? { width: size, height: size, fontSize: Math.round(size * 0.38) } : undefined} aria-hidden="true">
      {initialsOf(name)}
      {src && <img src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBad(true)} />}
    </span>
  )
}
// five steps, filled from the left: value 0-100
export const Steps = ({ value, low = 25, label }) => {
  const v = Math.max(0, Math.min(100, Number(value) || 0)), n = Math.max(1, Math.min(5, Math.ceil(v / 20)))
  return <span className={`fr-steps${v < low ? ' is-low' : ''}`} role="img" aria-label={label ?? `${Math.round(v)} of 100`}>{[0, 1, 2, 3, 4].map(i => <i key={i} className={i < n ? 'is-on' : undefined} />)}</span>
}
// a row with a switch at its end
export function Switch({ label, note, on, onChange, disabled = false }) {
  return (
    <button className="fr-row" role="switch" aria-checked={!!on} disabled={disabled} onClick={() => { tap(); onChange(!on) }}>
      <span className="fr-row-main">{label}{note && <small>{note}</small>}</span>
      <span className="fr-switch" aria-hidden="true" />
    </button>
  )
}
// two or three views of one panel
export function Seg({ options, value, onChange, label }) {
  return (
    <div className="fr-seg" role="tablist" aria-label={label}>
      {options.map(o => { const [k, text] = Array.isArray(o) ? o : [o, o]; return <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'is-on' : undefined} onClick={() => { if (value !== k) { tap(); onChange(k) } }}>{text}</button> })}
    </div>
  )
}
// one at a time through a list (the weeks, the teams)
export function Stepper({ label, onPrev, onNext, prevLabel = 'Previous', nextLabel = 'Next' }) {
  return (
    <div className="fr-step">
      <button className="is-prev" onClick={onPrev ? () => { tap(); onPrev() } : undefined} disabled={!onPrev} aria-label={prevLabel} />
      <b>{label}</b>
      <button onClick={onNext ? () => { tap(); onNext() } : undefined} disabled={!onNext} aria-label={nextLabel} />
    </div>
  )
}
export function Panel({ title, meta, action, children, className = '', ...rest }) {
  return (
    <section className={`fr-panel${className ? ` ${className}` : ''}`} {...rest}>
      {title && <header className="fr-h"><h2>{title}</h2>{action ?? (meta != null && <small>{meta}</small>)}</header>}
      {children}
    </section>
  )
}

// ── the scorebug ────────────────────────────────────────────────────────────
// team: a club's short (its plate, and its name on a desktop) · title: a setup screen's words in the team's place
// cells: [{ k, label, value, logo }] ruled off left to right · onExit + exit: the way out, at the right end
export function Bug({ team = null, title = null, eyebrow = null, cells = [], onExit, exit = 'EXIT' }) {
  const t = team ? teamOf(team) : null
  return (
    <header className="fr-bug">
      {t && <span className="fr-bug-plate"><Logo team={team} size={40} /></span>}
      {t && <span className="fr-bug-name"><small>{t.city.toUpperCase()}</small><b>{t.nick.toUpperCase()}</b></span>}
      {!t && title && <span className="fr-bug-title">{eyebrow && <small>{eyebrow}</small>}<b>{title}</b></span>}
      {cells.map(c => (
        <span key={c.k ?? c.label} className={`fr-bug-cell${c.logo ? ' fr-bug-next' : ''}`}>
          <small>{c.label}</small>
          <b>{c.logo && <Logo team={c.logo} size={22} />}{c.value}</b>
        </span>
      ))}
      <span className="fr-bug-fill" />
      {onExit && <button className="fr-bug-exit" onClick={() => { sfx('back'); onExit() }}>{exit}</button>}
    </header>
  )
}

// ── the frame ───────────────────────────────────────────────────────────────
// tabs: [{ id, label, n }] (n: a count on the tab) · cta: the pinned button(s) · bare: no tabs (the setup screens)
export function FrShell({ bug, tabs = null, tab, onTab, cta = null, children, mainKey }) {
  const main = useRef(null)
  useEffect(() => { main.current?.scrollTo({ top: 0 }) }, [mainKey ?? tab])
  const nav = cls => tabs && (
    <nav className={cls} aria-label="Franchise">
      {tabs.map(t => (
        <button key={t.id} className={`fr-tab${tab === t.id ? ' is-on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => { if (tab !== t.id) { tap(); onTab(t.id) } }}>
          {t.label}{t.n > 0 && <i>{t.n}</i>}
        </button>
      ))}
    </nav>
  )
  return (
    <div className={`fr${tabs ? '' : ' is-bare'}${cta ? ' has-cta' : ''}`}>
      {bug}
      {nav('fr-rail')}
      <main className="fr-main" ref={main}>{children}</main>
      {cta && <div className="fr-cta">{cta}</div>}
      {nav('fr-tabs')}
    </div>
  )
}

// ── the table ───────────────────────────────────────────────────────────────
// cols: [{ k, label, title, align: 'r' | 'c', w, cls, val(row) (what it sorts by; none: not sortable), render(row),
//          desc (first tap sorts high to low; numbers default to it) }]
// rows: plain objects · rowKey(row) · onRow(row) (a tap opens something) · rowClass(row)
// sort: { k, desc } to start on · sub(row, i, sorted): a ruled sub-heading before a row (unsorted lists only)
export function FrTable({ cols, rows, rowKey = r => r.id, onRow = null, rowClass = null, sort: sort0 = null, empty = 'NOTHING HERE YET', label, className = '' }) {
  const [sort, setSort] = useState(sort0)
  const sorted = useMemo(() => {
    const col = sort && cols.find(c => c.k === sort.k)
    if (!col?.val) return rows
    const dir = sort.desc ? -1 : 1
    return [...rows].sort((a, b) => {
      const x = col.val(a), y = col.val(b)
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir
    })
  }, [rows, cols, sort])
  const flip = c => { tap(); setSort(s => (s?.k === c.k ? { k: c.k, desc: !s.desc } : { k: c.k, desc: c.desc ?? typeof c.val(rows[0] ?? {}) !== 'string' })) }
  const al = c => (c.align === 'r' ? ' is-r' : c.align === 'c' ? ' is-c' : '')
  return (
    <div className="fr-table-wrap">
      <table className={`fr-table${className ? ` ${className}` : ''}`} aria-label={label}>
        <thead>
          <tr>
            {cols.map(c => {
              const on = sort?.k === c.k
              return (
                <th key={c.k} scope="col" title={c.title} style={c.w ? { width: c.w } : undefined} className={`${c.val ? 'is-sortable' : ''}${on ? ` is-sorted${sort.desc ? ' is-desc' : ''}` : ''}${al(c)}${/fr-t-gap/.test(c.cls ?? '') ? ' fr-t-gap' : ''}`}
                  aria-sort={on ? (sort.desc ? 'descending' : 'ascending') : undefined} onClick={c.val ? () => flip(c) : undefined}>{c.label}</th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={rowKey(r)} className={`${onRow ? 'is-tap' : ''}${rowClass ? ` ${rowClass(r) ?? ''}` : ''}`} onClick={onRow ? () => { tap(); onRow(r) } : undefined}>
              {cols.map(c => <td key={c.k} className={`${c.cls ?? ''}${al(c)}`}>{c.render ? c.render(r) : c.val?.(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {!sorted.length && <div className="fr-empty">{empty}</div>}
    </div>
  )
}

// ── a sheet ─────────────────────────────────────────────────────────────────
// A phone: up from the bottom, dragged back down by its grabber or head. A desktop: a panel in from the right.
// Both stand on top of the website's ad rail (franchise.css .fr-overlay), and close on a tap outside or Escape.
// Keep it mounted and flip `open`: it slides back out.
//   head: what sits in the sheet's head (FrSheetHead makes a player's) · foot: its pinned buttons
export function FrSheet({ open, onClose, head, foot = null, children, label }) {
  const wide = useWide()
  const { startDrag, dragProps } = useSheetDrag('bottom', onClose)
  const downAt = useRef(null)   // a tap outside closes it: only a press that both started and ended on the dim
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  const slide = wide
    ? { initial: { x: '100%' }, animate: { x: 0, transition: { duration: 0.32, ease: EASE_DRAWER } }, exit: { x: '104%', transition: { duration: 0.22, ease: EASE_DRAWER } } }
    : { initial: { y: '100%' }, animate: { y: 0, transition: { duration: 0.36, ease: EASE_DRAWER } }, exit: { y: '105%', transition: { duration: 0.24, ease: EASE_DRAWER } } }
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="o" className="fr-overlay" {...overlayMotion} onPointerDown={e => { downAt.current = e.target === e.currentTarget ? [e.clientX, e.clientY] : null }}
          onClick={e => { const d = downAt.current; downAt.current = null; if (e.target === e.currentTarget && d && Math.hypot(e.clientX - d[0], e.clientY - d[1]) < 8) onClose() }}>
          <motion.div className="fr-sheet" role="dialog" aria-modal="true" aria-label={label} {...slide} {...(wide ? {} : dragProps)}>
            <div className="fr-sheet-grab" onPointerDown={wide ? undefined : startDrag} />
            <div className="fr-sheet-head" onPointerDown={wide ? undefined : startDrag}>
              {head}
              <button className="fr-sheet-x" onPointerDown={e => e.stopPropagation()} onClick={() => { sfx('back'); onClose() }} aria-label="Close" />
            </div>
            <div className="fr-sheet-body">{children}</div>
            {foot && <div className="fr-sheet-foot">{foot}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
// a player's head for a sheet: his face, his name, a line under it, and the big number on the right
export function FrSheetHead({ name, photo, line, big, bigLabel = 'OVR' }) {
  return (
    <>
      <Face name={name} photo={photo} />
      <span className="fr-sheet-who"><b>{name}</b>{line && <small>{line}</small>}</span>
      {big != null && <span className="fr-sheet-ovr"><b>{big}</b><small>{bigLabel}</small></span>}
    </>
  )
}
// a trait row: its name, its letter, a bar as long as the rating (v: 0-11)
export const GradeRow = ({ label, grade, v }) => (
  <div className="fr-grade"><span>{label}</span><b>{grade}</b><i><u style={{ width: `${Math.max(4, Math.min(100, (Number(v) || 0) / 11 * 100))}%` }} /></i></div>
)

// ── a small yes / no box ────────────────────────────────────────────────────
export function Confirm({ open, title, body, yes = 'YES', no = 'CANCEL', danger = false, onYes, onNo }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onNo() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onNo])
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="c" className="fr-overlay is-box" {...overlayMotion} onClick={e => { if (e.target === e.currentTarget) onNo() }}>
          <motion.div className="fr-box" role="alertdialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.18 } }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
            <div className="fr-box-body"><b>{title}</b>{body && <p>{body}</p>}</div>
            <div className="fr-box-foot">
              <button className="fr-btn fr-btn--line" onClick={() => { sfx('back'); onNo() }}>{no}</button>
              <button className={`fr-btn${danger ? ' fr-btn--danger' : ''}`} onClick={() => { sfx(danger ? 'deny' : 'tap'); haptic('medium'); onYes() }}>{yes}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ── two meters ──────────────────────────────────────────────────────────────
// a, b: { label, value (0-100), was (where it stood before the last move: a tick on the track and the change
// beside the figure), team (true: filled in the team colour), low (below this it turns red; default 25) }
function Meter({ label, value, was = null, team = false, low = 25 }) {
  const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
  const d = was == null ? 0 : v - Math.round(was)
  return (
    <div className={`fr-meter${team ? ' is-team' : ''}${v < low ? ' is-low' : ''}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
      <div className="fr-meter-top"><small>{label}</small><b>{v}{d !== 0 && <em className={d < 0 ? 'is-down' : undefined}>{d > 0 ? `+${d}` : `−${-d}`}</em>}</b></div>
      <div className="fr-meter-track"><span style={{ width: `${v}%` }} />{was != null && d !== 0 && <i style={{ left: `${Math.max(0, Math.min(100, was))}%` }} />}</div>
    </div>
  )
}
export const FrMeters = ({ a, b }) => <div className="fr-meters"><Meter {...a} /><Meter {...b} /></div>

// ── the news ticker ─────────────────────────────────────────────────────────
// One headline at a time; it changes by steps (never a crawl), and it rests: lib/fxPause.js lets anything that
// loops play for a few seconds while it's on screen, then marks it [data-fx-off] until it's scrolled back into
// view or tapped (the ticker joins that watch through fxPause's own class, ip-fx). Resting, it holds the headline
// it was on. A tap steps to the next one. Reduce Motion: no stepping on its own at all; a tap still steps.
export function FrTicker({ items, tag = 'NEWS', every = 2600 }) {
  const list = useMemo(() => (items ?? []).map(x => (typeof x === 'string' ? x : x?.text)).filter(Boolean), [items])
  const [i, setI] = useState(0)
  const el = useRef(null)
  useEffect(() => { setI(0) }, [list])
  useEffect(() => {
    const node = el.current
    if (!node || list.length < 2) return
    let id = 0
    const resting = () => node.hasAttribute('data-fx-off') || document.documentElement.classList.contains('bap-reduce-motion') || document.hidden
    const start = () => { clearInterval(id); if (!resting()) id = setInterval(() => { if (resting()) { clearInterval(id); return } setI(n => (n + 1) % list.length) }, every) }
    const mo = new MutationObserver(start)
    mo.observe(node, { attributes: true, attributeFilter: ['data-fx-off'] })
    start()
    return () => { clearInterval(id); mo.disconnect() }
  }, [list, every])
  if (!list.length) return null
  const at = i % list.length
  return (
    <div className="fr-ticker ip-fx" ref={el} role="button" tabIndex={0} aria-label={`${tag}: ${list[at]}. Next headline`} onClick={() => setI(n => (n + 1) % list.length)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setI(n => (n + 1) % list.length) } }}>
      <span className="fr-ticker-tag">{tag}</span>
      <span className="fr-ticker-line" aria-live="off"><span key={at}>{list[at]}</span></span>
      {list.length > 1 && <span className="fr-ticker-n">{at + 1}/{list.length}</span>}
    </div>
  )
}
