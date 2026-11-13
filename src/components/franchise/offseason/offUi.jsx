import { useMemo, useRef } from 'react'
import { Panel, FrSheet, FrSheetHead, GradeRow, Steps, Logo, Face } from '../frUi'
import { sfx, haptic } from '../../../lib/juice'

// FRANCHISE · OFFSEASON: the pieces its stages share (styles: offseason.css, every class fro-). Nothing here
// decides anything: the screens hand in what the engine said (lib/franchise API.md section 6).
//   Fact, Sub, Said, Five, Bar, Pips      small ruled things
//   PosFilter                             the position row over a table
//   Who, Club                             a table's name cell (with a quiet second line), a club's logo and letters
//   CapStrip                              the cap, always in view where money moves
//   OfferPad                              years, money a year, the guaranteed share: one control each
//   PlayerSheet                           a player's sheet (ratings, deal, season, mood), with a stage's own top and foot

export const tap = () => { sfx('tap'); haptic('light') }
export const up = s => String(s ?? '').toUpperCase()
export const plural = (n, one, many = one === one.toUpperCase() ? `${one}S` : `${one}s`) => `${n} ${n === 1 ? one : many}`
export const ord = n => { const v = n % 100; return `${n}${v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}` }
export const safe = (fn, fallback = null) => { try { return fn() ?? fallback } catch { return fallback } }
export const cap1 = s => { const t = String(s ?? ''); return t ? t[0].toUpperCase() + t.slice(1) : t }
export const pct = v => `${Math.round((Number(v) || 0) * 100)}%`
export const height = inches => (inches ? `${Math.floor(inches / 12)}'${inches % 12}"` : null)
export const signed = d => (d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '0')

export const DRIVE_WORD = { MONEY: 'MONEY', RING: 'A RING', ROLE: 'A ROLE', LOYAL: 'LOYAL', MENTOR: 'MENTOR', COMPETITOR: 'COMPETITOR' }
export const POS_TABS = [['all', 'ALL'], ['qb', 'QB'], ['rb', 'RB'], ['wr', 'WR'], ['te', 'TE'], ['ol', 'OL'], ['dl', 'DL'], ['lb', 'LB'], ['db', 'DB'], ['k', 'K']]

export const Fact = ({ label, children, strong = false }) => (
  <div className={`fro-fact${strong ? ' is-strong' : ''}`}><span>{label}</span><p>{children}</p></div>
)
export const Sub = ({ children, meta = null }) => <div className="fro-sub"><span>{children}</span>{meta != null && <small>{meta}</small>}</div>
// somebody's words: who said it over what was said
export const Said = ({ who, children, flat = false }) => <p className={`fro-said${flat ? ' is-flat' : ''}`}><small>{who}</small>{children}</p>
export const Five = ({ ratings }) => (
  <div className="fro-five">{(ratings ?? []).map(r => <span key={r.key}><small>{r.short}</small><b>{r.grade}</b></span>)}</div>
)
export const Bar = ({ v, max = 100, team = false }) => (
  <i className={`fro-bar${team ? ' is-team' : ''}`}><u style={{ width: `${Math.max(0, Math.min(100, (Number(v) || 0) / max * 100))}%` }} /></i>
)
// n of max, as squares (a branch's level, how well a prospect is scouted)
export const Pips = ({ n, max = 3, label }) => (
  <span className="fro-pips" role="img" aria-label={label ?? `${n} of ${max}`}>{Array.from({ length: max }, (_, i) => <i key={i} className={i < n ? 'is-on' : undefined} />)}</span>
)

export function PosFilter({ value, onChange, options = POS_TABS, label = 'Position' }) {
  return (
    <div className="fro-pos" role="tablist" aria-label={label}>
      {options.map(([k, text]) => <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'is-on' : undefined} onClick={() => { if (value !== k) { tap(); onChange(k) } }}>{text}</button>)}
    </div>
  )
}
export const byPos = (rows, pos) => (pos === 'all' ? rows : rows.filter(r => r.pos === pos))

// a table's name cell: the name, a tag after it, a quiet line under it
export const Who = ({ name, tag = null, tagOut = false, sub = null }) => (
  <span className="fr-t-name">{name}{tag && <i className={tagOut ? 'is-out' : undefined}>{tag}</i>}{sub && <small className="fro-t-sub">{sub}</small>}</span>
)
export const Club = ({ t, name = false }) => (t ? <span className="fr-t-team"><Logo team={t.short} size={20} />{name ? t.name : t.short}</span> : null)

// ── the cap: room, payroll, the limit (and what is already promised for next season) ───────────
export function CapStrip({ FR, F, extra = null }) {
  const c = useMemo(() => safe(() => FR.capSheet(F)), [FR, F])
  if (!c) return null
  const next = c.next?.[0]
  return (
    <div className="fro-cap" role="group" aria-label="Salary cap">
      <span className="is-lead"><small>CAP ROOM</small><b className={c.space < 0 ? 'fr-t-red' : undefined}>{FR.moneyText(c.space)}</b></span>
      <span><small>PAYROLL</small><b>{FR.moneyText(c.payroll)}</b></span>
      <span><small>THE CAP</small><b>{FR.moneyText(c.cap)}</b></span>
      {extra ?? (next && <span><small>{next.label}</small><b>{FR.moneyText(next.committed)}</b></span>)}
    </div>
  )
}

// ── an offer: years, money a year, the guaranteed share ────────────────────────────────────────
// value: { years, perYear, guaranteed (0-1) } · ask: his ask (the yardstick under each figure) · room: cap room now
const stepOf = v => (v >= 20 ? 1 : v >= 8 ? 0.5 : v >= 3 ? 0.25 : 0.05)
const r2 = v => Math.round(v * 100) / 100
function Ctl({ label, value, note, onLess, onMore, lessLabel, moreLabel }) {
  return (
    <div className="fro-ctl">
      <span>{label}</span>
      <button className="is-less" disabled={!onLess} onClick={() => { tap(); onLess() }} aria-label={lessLabel} />
      <b>{value}{note && <small>{note}</small>}</b>
      <button disabled={!onMore} onClick={() => { tap(); onMore() }} aria-label={moreLabel} />
    </div>
  )
}
export function OfferPad({ FR, value, ask, onChange, room = null, floor = 0.75 }) {
  const v = value, st = stepOf(v.perYear)
  const set = patch => onChange({ ...v, ...patch })
  const total = v.years * v.perYear, guar = total * v.guaranteed
  const ofAsk = ask?.perYear ? Math.round(v.perYear / ask.perYear * 100) : null
  return (
    <div className="fro-pad">
      <Ctl label="YEARS" value={v.years} note={ask ? `ASK ${ask.years}` : null} lessLabel="One year fewer" moreLabel="One year more"
        onLess={v.years > 1 ? () => set({ years: v.years - 1 }) : null} onMore={v.years < 6 ? () => set({ years: v.years + 1 }) : null} />
      <Ctl label="A YEAR" value={FR.moneyText(v.perYear)} note={ofAsk != null ? `${ofAsk}% OF ASK` : null} lessLabel="Less money a year" moreLabel="More money a year"
        onLess={v.perYear - st >= floor - 0.001 ? () => set({ perYear: r2(Math.max(floor, v.perYear - st)) }) : null} onMore={() => set({ perYear: r2(v.perYear + st) })} />
      <Ctl label="GUARANTEED" value={pct(v.guaranteed)} note={ask ? `ASK ${pct(ask.guaranteed)}` : null} lessLabel="Guarantee less" moreLabel="Guarantee more"
        onLess={v.guaranteed > 0.001 ? () => set({ guaranteed: Math.max(0, Math.round(v.guaranteed * 20 - 1) / 20) }) : null} onMore={v.guaranteed < 0.999 ? () => set({ guaranteed: Math.min(1, Math.round(v.guaranteed * 20 + 1) / 20) }) : null} />
      <div className="fro-pad-sum">
        <span><small>TOTAL</small><b>{FR.moneyText(r2(total))}</b></span>
        <span><small>GUARANTEED</small><b>{FR.moneyText(r2(guar))}</b></span>
        {room != null && <span><small>ROOM AFTER</small><b className={room - v.perYear < 0 ? 'fr-t-red' : undefined}>{FR.moneyText(r2(room - v.perYear))}</b></span>}
      </div>
    </div>
  )
}
export const meetAsk = ask => ({ years: ask.years, perYear: ask.perYear, guaranteed: ask.guaranteed })
// what a man is after, in a line
export const Drives = ({ FR, drives }) => (drives ?? []).map(d => <Fact key={d} label={DRIVE_WORD[d] ?? d}>{FR.DRIVE_TEXT?.[d] ?? ''}</Fact>)

// ── a player's sheet ───────────────────────────────────────────────────────────────────────────
const STAT_LABEL = { g: 'G', gs: 'GS', cmp: 'CMP', att: 'ATT', pct: 'PCT', yds: 'YDS', td: 'TD', int: 'INT', rtg: 'RTG', sk: 'SK', rushYds: 'RUSH', rushTD: 'R TD', ypc: 'AVG', rec: 'REC', recYds: 'REC YDS', recTD: 'REC TD', fum: 'FUM',
  tgt: 'TGT', ypr: 'AVG', long: 'LONG', sacksAllowed: 'SACKS ALW', pancakes: 'PANCAKES', tkl: 'TKL', sack: 'SACK', tfl: 'TFL', pd: 'PD', ff: 'FF', dTD: 'TD', fgm: 'FGM', fga: 'FGA', xpm: 'XPM', xpa: 'XPA', pts: 'PTS' }
function StatTable({ stat }) {
  const keys = Object.keys(stat ?? {}).filter(k => stat[k] != null)
  if (!keys.length) return null
  return (
    <div className="fr-table-wrap">
      <table className="fr-table fro-stat"><thead><tr>{keys.map(k => <th key={k} className="is-r">{STAT_LABEL[k] ?? k.toUpperCase()}</th>)}</tr></thead>
        <tbody><tr>{keys.map(k => <td key={k} className="is-r">{stat[k]}</td>)}</tr></tbody></table>
    </div>
  )
}
const has = stat => Object.values(stat ?? {}).some(v => v != null && v !== 0)
// pid: the man (null: closed) · top: a stage's own panels over his file · foot: its buttons · label: the season his line is from
export function PlayerSheet({ FR, F, pid, onClose, top = null, foot = null, seasonLabel = null }) {
  const card = useMemo(() => (pid == null ? null : safe(() => FR.playerCard(F, pid))), [FR, F, pid])
  const kept = useRef(null)
  if (card) kept.current = card
  const c = card ?? kept.current
  const con = c?.contract
  const money = v => FR.moneyText(v ?? 0)
  return (
    <FrSheet open={!!card} onClose={onClose} label={c?.name} foot={card ? foot : null}
      head={c && <FrSheetHead name={c.name} photo={FR.photoUrl(c.photo)} big={c.ovr} line={[c.at ?? c.slot, c.num != null ? `#${c.num}` : null, `AGE ${c.age}`, c.team ?? 'FREE AGENT'].filter(Boolean).join(' · ')} />}>
      {c && <>
        {top}
        {c.traits?.length > 0 && (
          <Panel title="Ratings" meta={c.arch ? up(c.arch) : c.grade}>
            {c.traits.map(t => <GradeRow key={t.key} label={up(t.label)} grade={t.grade} v={t.val} />)}
          </Panel>
        )}
        <Panel title="Contract" meta={!c.team ? 'FREE AGENT' : c.rookie ? 'ROOKIE DEAL' : con?.tag ? 'FRANCHISE TAG' : null}>
          {c.team ? <>
            <div className="fr-kv"><span>SALARY</span><b>{money(con?.salary ?? c.salary)}</b></div>
            <div className="fr-kv"><span>YEARS LEFT</span><b>{con?.yrs ?? c.yrs ?? 0}</b></div>
            <div className="fr-kv"><span>GUARANTEED LEFT</span><b>{money(con?.guar ?? c.guar)}</b></div>
            {con?.cut && (con.cut.dead > 0 || con.cut.saves > 0) && <div className="fr-kv"><span>IF RELEASED</span><b className="is-text">{money(con.cut.dead)} dead · {money(con.cut.saves)} saved</b></div>}
          </> : <div className="fr-kv"><span>STATUS</span><b className="is-text">On the market</b></div>}
        </Panel>
        {has(c.stats?.season) && <Panel title={seasonLabel ?? 'Last season'}><StatTable stat={c.stats.season} /></Panel>}
        {c.stats?.byYear?.length > 0 && has(c.stats?.career) && <Panel title="Career"><StatTable stat={c.stats.career} /></Panel>}
        {c.awards?.length > 0 && <Panel title="Honors">{c.awards.map((a, i) => <div key={i} className="fr-kv"><span>{a.year}</span><b className="is-text">{a.name}</b></div>)}</Panel>}
        <Panel title="Development" meta={c.devName ?? 'NOT KNOWN YET'}>
          {c.devText && <p className="fr-note">{c.devText}</p>}
          <div className="fr-kv"><span>MORALE</span><b className="is-text">{c.moodWord} <Steps value={c.mood} label={`Morale ${Math.round(c.mood)} of 100`} /></b></div>
          {(c.drives ?? []).length > 0 && <Drives FR={FR} drives={c.drives} />}
        </Panel>
        {(c.college || c.bodyText || c.draft) && (
          <Panel title="Bio">
            {c.bodyText ? <div className="fr-kv"><span>SIZE</span><b className="is-text">{c.bodyText}</b></div> : null}
            {c.college && <div className="fr-kv"><span>COLLEGE</span><b className="is-text">{c.college}</b></div>}
            {c.draft && <div className="fr-kv"><span>DRAFT</span><b className="is-text">{c.draft}</b></div>}
            <div className="fr-kv"><span>SEASONS</span><b>{c.exp === 0 ? 'ROOKIE' : c.exp}</b></div>
          </Panel>
        )}
      </>}
    </FrSheet>
  )
}
// a man in a row of a list: his face, his name over a quiet line, something at the end
export function Man({ FR, p, line = null, end = null, onClick = null, mine = false }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`fr-row fro-man${mine ? ' is-mine' : ''}`} onClick={onClick ? () => { tap(); onClick() } : undefined}>
      <Face name={p.name} photo={FR.photoUrl(p.photo)} size={36} />
      <span className="fr-row-main">{p.name}{line && <small>{line}</small>}</span>
      {end}
    </Tag>
  )
}
