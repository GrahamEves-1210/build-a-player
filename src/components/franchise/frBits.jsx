import { GradeRow, Logo, Steps } from './frUi'
import { sfx, haptic } from '../../lib/juice'

// FRANCHISE: small pieces the in-season screens share (styles: franchise-wave2.css). Nothing here knows the
// engine: screens hand in plain values.
//   Fact        a label and a sentence beside it (the job, a team's read): the sentence wraps, the label doesn't
//   Sub         a ruled sub-heading inside a panel, with a count or a small button at its end
//   Five        a coach's five grades on one line (DEV · OFF · DEF · CUL · SIT)
//   CoachBlock  a coach: his name, his job, his grade, then the five (one line, or a bar each)
//   Bar         a short bar beside a figure (wear, a share of the cap, an award race)
//   TeamCell    a logo and a club's letters, for a table
//   Act         a row that does something (a player's sheet: extend, block, release)

export const tap = () => { sfx('tap'); haptic('light') }
export const up = s => String(s ?? '').toUpperCase()
// (the engine's sentences sometimes start on a number word: "five starters …")
export const cap = s => { const t = String(s ?? ''); return t ? t[0].toUpperCase() + t.slice(1) : t }
export const ord = n => { const v = n % 100; return `${n}${v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}` }
export const plural = (n, one, many = one === one.toUpperCase() ? `${one}S` : `${one}s`) => `${n} ${n === 1 ? one : many}`
// a first name down to its letter, for a phone's tables
export const shortName = name => String(name ?? '').replace(/^(\S)\S*\s+(?=\S)/, '$1. ')
export const safe = (fn, fallback = null) => { try { return fn() ?? fallback } catch { return fallback } }

// what a state is called when it is a noun: the three lists, the owner's yardstick
export const STATE_NOUN = { contend: 'CONTENDERS', retool: 'RETOOLING', rebuild: 'REBUILDING' }
export const STATE_AS = { contend: 'A CONTENDER', retool: 'A RETOOL', rebuild: 'A REBUILD' }
export const DIR_VERB = { contend: 'CONTEND', retool: 'RETOOL', rebuild: 'REBUILD' }

export const Fact = ({ label, children, strong = false }) => (
  <div className={`fr-fact${strong ? ' is-strong' : ''}`}><span>{label}</span><p>{children}</p></div>
)
export const Sub = ({ children, meta = null, action = null }) => (
  <div className="fr-sub"><span>{children}</span>{action ?? (meta != null && <small>{meta}</small>)}</div>
)
export const Five = ({ ratings }) => (
  <div className="fr-five">{(ratings ?? []).map(r => <span key={r.key}><small>{r.short}</small><b>{r.grade}</b></span>)}</div>
)
// c: the engine's CoachRow · full: a bar for each rating (else the five on one line) · note: a word after his job
export function CoachBlock({ c, full = false, note = null, money = null }) {
  if (!c) return null
  const plain = c.placeholder
  return (
    <div className="fr-coach">
      <div className="fr-row">
        <span className="fr-row-main">{c.name}<small>{up(c.roleName ?? c.role)}{c.built ? ' · BUILT' : ''}{c.interim ? ' · INTERIM' : ''}{note ? ` · ${note}` : ''}{money && c.yrs ? ` · ${money(c.salary)} · ${plural(c.yrs, 'YEAR')}` : ''}</small></span>
        {!plain && <b className="fr-t-num fr-coach-grade">{c.grade}</b>}
      </div>
      {!plain && (full ? c.ratings?.map(r => <GradeRow key={r.key} label={r.label} grade={r.grade} v={r.val} />) : <Five ratings={c.ratings} />)}
    </div>
  )
}
export const Bar = ({ v, max = 100, low = false }) => (
  <i className={`fr-bar${low ? ' is-low' : ''}`}><u style={{ width: `${Math.max(0, Math.min(100, (Number(v) || 0) / max * 100))}%` }} /></i>
)
export const TeamCell = ({ t, name = false, note = null }) => (
  <span className="fr-t-team"><Logo team={t.short} size={22} />{name ? t.name : t.short}{note && <i className="fr-t-clinch">{note}</i>}</span>
)
export function Act({ label, note = null, danger = false, disabled = false, onClick, chev = true }) {
  return (
    <button className={`fr-row fr-act${danger ? ' is-danger' : ''}`} disabled={disabled} onClick={() => { tap(); onClick() }}>
      <span className="fr-row-main">{label}</span>
      {note && <span className="fr-row-state">{note}</span>}
      {chev && <span className="fr-chev" />}
    </button>
  )
}
// job security: the word, the five steps
export const Security = ({ value, word, floor = 20 }) => (
  <b className="is-text">{word} <Steps value={value} low={floor} label={`Job security ${Math.round(value)} of 100`} /></b>
)
// a headline: what kind (or when), the line, the sentence under it; a tap opens who it is about
const NEWS_TAG = { game: 'GAME', award: 'AWARD', injury: 'INJURY', trade: 'TRADE', signing: 'SIGNING', draft: 'DRAFT', owner: 'OWNER', league: 'LEAGUE', milestone: 'PLAYER', staff: 'STAFF' }
export function NewsRow({ n, tag = null, mine = false, onClick = null }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`fr-news${mine ? ' is-mine' : ''}`} onClick={onClick ? () => { tap(); onClick() } : undefined}>
      <span className="fr-news-tag">{tag ?? NEWS_TAG[n.kind] ?? up(n.kind)}</span>
      <span className="fr-news-txt">{n.head}{n.body && <small>{n.body}</small>}</span>
    </Tag>
  )
}
