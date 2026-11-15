import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  TEAM, POS_LABEL, gradeOf, realOf, jersey, groupOf, GROUP, capSheet, cutCost, leagueStats, statLine, CAREER_KEYS, CAREER_LABEL,
  ratingsOf, marketKey, MARKET_LABEL, AWARD_SHORT, placeOf, slotName, cutMan, MIN,
} from '../../lib/franchise2'
import { genFace } from '../../lib/franchise2/faces'
import { outText } from '../../lib/franchise2/injury'
import { TYPES_OF } from '../../lib/squadSeason'
import { valToGrade } from '../../utils/simulation'
import { spectrumColor } from '../../lib/gradeColors'
import { ATTR } from '../../data/qbs'
import { RB_ATTR } from '../../data/rbs'
import { WR_ATTR } from '../../data/wrs'
import { TE_ATTR } from '../../data/tes'
import { OL_ATTR } from '../../data/ols'
import { DL_ATTR } from '../../data/dls'
import { LB_ATTR } from '../../data/lbs'
import { DB_ATTR } from '../../data/dbs'
import { sfx, haptic } from '../../lib/juice'
import { LowerThird, KLogo, Tag, Go, Fact, fkVars, BigNum } from './kit'
import { photoOf } from './bits'
import './fd.css'
import './fd2.css'

// D's parts: a man's face (a real man's photo, a build's own face, a made-up man's drawn face), a man as a
// lower-third on any of D's screens, the cap bar, a man's page (his ratings as grades, his deal, his seasons).

const LABELS = { qb: ATTR, rb: RB_ATTR, wr: WR_ATTR, te: TE_ATTR, ol: OL_ATTR, dl: DL_ATTR, lb: LB_ATTR, db: DB_ATTR }
export const money = v => (v >= 10 ? `$${Math.round(v)}M` : `$${(Math.round(v * 10) / 10).toFixed(1)}M`)
export const posText = p => (p.p === 'ol' ? (p.s ?? 'OL') : p.p === 'dl' || p.p === 'db' ? GROUP[groupOf(p)].label : POS_LABEL[p.p])
// a man's face: his photo, a build's own, or (a man the game made up) his drawn face; a real man without a photo:
// his initials
export function faceFor(F, p, s) {
  if (!p) return null
  const ph = photoOf(F, p, TEAM[s]?.color)
  if (ph) return ph
  if (p.b == null && !realOf(p.p, p.n)) return genFace(p, TEAM[s]?.color)
  return null
}
// a man as a lower-third (his team's colours, his number, his OVR; a build: his owner's name)
export function Man({ F, p, s, owner, size = 'm', line, stat, onClick, className = '', delay = 0 }) {
  if (!p) return null
  return <LowerThird name={p.n} pos={posText(p)} num={jersey(F, p)} ovr={stat ? null : p.o} stat={stat} photo={faceFor(F, p, s)} team={s} mine={p.b != null ? owner || 'GM' : null} line={line} size={size} onClick={onClick} className={className} delay={delay} />
}
// a deal in a few words: $12.5M · 3 YRS
export const dealText = p => (p.y > 0 ? `${money(p.$)} · ${p.y} ${p.y === 1 ? 'YR' : 'YRS'}` : 'DEAL UP')

// ── The cap: one bar ─────────────────────────────────────────────────────────
// the men's deals, the dead money, the rest of the 53, and what's left; the room big
export function CapBar({ F, s = F.team, onClick, extra = 0 }) {
  const c = capSheet(F, s)
  const room = Math.round((c.room - extra) * 10) / 10
  const k = v => `${Math.max(0, Math.min(100, (v / c.cap) * 100))}%`
  const Tag2 = onClick ? 'button' : 'div'
  return (
    <Tag2 className={`fd-cap${room < 0 ? ' is-over' : ''}${onClick ? ' is-tap' : ''}`} style={fkVars(s)} onClick={onClick} type={onClick ? 'button' : undefined}>
      <span className="fd-cap-top">
        <span className="fd-cap-room"><b>{room < 0 ? `-${money(-room)}` : money(room)}</b><small>{room < 0 ? 'OVER THE CAP' : 'CAP ROOM'}</small></span>
        <span className="fd-cap-of"><small>{c.year} CAP</small><b>{money(c.cap)}</b></span>
      </span>
      <span className="fd-cap-bar" aria-hidden="true">
        <i className="is-men" style={{ width: k(c.pay + extra) }} />
        {c.dead > 0 && <i className="is-dead" style={{ width: k(c.dead) }} />}
        <i className="is-rest" style={{ width: k(c.rest) }} />
      </span>
      <span className="fd-cap-key"><span><i className="is-men" />PLAYERS {money(c.pay + extra)}</span>{c.dead > 0 && <span><i className="is-dead" />DEAD {money(c.dead)}</span>}<span><i className="is-rest" />REST OF THE 53 {money(c.rest)}</span></span>
    </Tag2>
  )
}

// ── A man's ratings as the build page's grades ───────────────────────────────
function traitsFor(F, p) {
  if (p.b != null) return F.builds[p.b]?.build ?? {}
  return ratingsOf(p) ?? {}
}
export function Grades({ F, p }) {
  const T = TYPES_OF[p.p] ?? [], R = traitsFor(F, p), L = LABELS[p.p] ?? {}
  return (
    <div className="fd-grades">
      {T.map((t, i) => {
        const v = R[t]?.val ?? 5
        return (
          <span key={t} className="fd-grade" style={{ '--g': spectrumColor(v), '--k': Math.max(0.04, v / 11), '--d': `${i * 30}ms` }}>
            <small>{(L[t]?.label ?? t).toUpperCase()}</small>
            <i aria-hidden="true"><em /></i>
            <b>{valToGrade(v)}</b>
          </span>
        )
      })}
    </div>
  )
}

// ── A man's page ─────────────────────────────────────────────────────────────
// his lower-third, his deal, his ratings, this season, and every season he's had (the one table in the mode)
const HON = { 1: 'PRO BOWL', 2: 'ALL-PRO' }
const CODE_NAME = { MVP: 'MVP', OPOY: 'OPOY', DPOY: 'DPOY', OROY: 'OROY', DROY: 'DROY' }
export function PlayerPage({ F, id, owner, act, onClose }) {
  const [sure, setSure] = useState(false)
  const found = useMemo(() => { for (const s of Object.keys(F.teams)) { const p = F.teams[s].r.find(x => x.i === id); if (p) return { p, s } } const p = (F.fa ?? []).find(x => x.i === id); return p ? { p, s: null } : null }, [F, id, F.teams[F.team].r.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  if (!found) return null
  const { p, s } = found
  const mine = s === F.team
  const st = leagueStats(F)[String(p.i)]
  const keys = CAREER_KEYS[p.p] ?? []
  // his seasons: the ones kept (a build's from his own career), this one if it's going
  const rows = p.b != null
    ? (F.builds[p.b]?.car ?? []).map(c => ({ y: c.y, s: F.team, gp: c.gp, v: keys.map(k => c.st?.[k] ?? 0), hon: c.hon === 'AP' ? 2 : c.hon === 'PB' ? 1 : 0, aw: c.aw ? [c.aw] : [] }))
    : (p.cr ?? []).map(r => ({ y: r[0], s: r[1], gp: r[2], v: r.slice(3, 3 + keys.length), hon: r[3 + keys.length] ?? 0, aw: r[4 + keys.length] ? String(r[4 + keys.length]).split(',') : [] }))
  const now = st?.gp && F.phase !== 'off' ? { y: F.year, s, gp: st.gp, v: keys.map(k => st[k] ?? 0), hon: 0, aw: [], live: true } : null
  const all = now ? [...rows, now] : rows
  const tot = keys.map((_, j) => all.reduce((a, r) => a + (r.v[j] ?? 0), 0))
  const cut = cutCost(p)
  const pl = mine ? placeOf(F, s, p.i) : null
  // (a team keeps the minimum at every spot: the last man in a room can't be let go)
  const canCut = mine && p.b == null && F.teams[s].r.filter(x => x.p === p.p).length > MIN[p.p]
  return createPortal(
    <div className="fd-sheet-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fd-sheet fk" role="dialog" aria-modal="true" aria-label={p.n}>
        <button className="fd-x" onClick={onClose} aria-label="Close">×</button>
        <Man F={F} p={p} s={s ?? F.team} owner={owner} size="l" line={s ? TEAM[s].nick.toUpperCase() : 'FREE AGENT'} />
        <div className="fd-facts">
          <Fact v={p.ag} label="AGE" />
          {pl && (p.in ? <Fact v={GROUP[pl.k].label} label={outText(p)} tone="l" />
            : <Fact v={pl.starts ? (pl.starts.startsWith('ol') ? slotName(pl.starts) : pl.starts.toUpperCase()) : `${GROUP[pl.k].label}${pl.at + 1}`} label={pl.starts ? 'STARTER' : 'DEPTH CHART'} />)}
          <Fact v={p.y > 0 ? money(p.$) : '—'} label={p.rc ? 'ROOKIE DEAL' : 'CAP HIT'} />
          <Fact v={p.y > 0 ? p.y : 0} label={p.y === 1 ? 'YEAR LEFT' : 'YEARS LEFT'} />
        </div>
        {p.in ? <div className="fd-hurt"><Tag tone="inj">{p.ij?.l ? String(p.ij.l).toUpperCase() : outText(p)}</Tag></div> : null}
        <div className="fd-h">RATINGS</div>
        <Grades F={F} p={p} />
        {now && (
          <>
            <div className="fd-h">{F.year} SEASON</div>
            <div className="fd-season">{statLine(p, st).split(' · ').map(x => { const [v, ...l] = x.split(' '); return <Fact key={x} v={v} label={l.join(' ')} size={30} /> })}<Fact v={st.gp} label="GAMES" size={30} /></div>
          </>
        )}
        {all.length > 0 && (
          <>
            <div className="fd-h">CAREER</div>
            <div className="fd-table-wrap">
              <table className="fd-table">
                <thead><tr><th>YEAR</th><th>TEAM</th><th>G</th>{keys.map(k => <th key={k}>{CAREER_LABEL[k]}</th>)}<th /></tr></thead>
                <tbody>
                  {all.map(r => (
                    <tr key={`${r.y}-${r.s}`} className={r.live ? 'is-live' : ''}>
                      <td>{r.y}</td><td><KLogo s={r.s} size={18} /></td><td>{r.gp}</td>
                      {r.v.map((v, j) => <td key={j}>{Number(v).toLocaleString('en-US')}</td>)}
                      <td className="fd-hon">{[...r.aw.map(a => CODE_NAME[a] ?? a), r.hon ? HON[r.hon] : null].filter(Boolean).join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
                {all.length > 1 && <tfoot><tr><td>TOTAL</td><td /><td>{all.reduce((a, r) => a + r.gp, 0)}</td>{tot.map((v, j) => <td key={j}>{Math.round(v).toLocaleString('en-US')}</td>)}<td /></tr></tfoot>}
              </table>
            </div>
          </>
        )}
        {canCut && act && (
          <div className="fd-cut">
            {sure
              ? <Go onClick={() => { act(X => cutMan(X, p.i)); sfx('swap'); haptic('medium'); onClose() }} sub={cut.dead > 0 ? `${money(cut.dead)} DEAD MONEY` : 'NO DEAD MONEY'}>RELEASE {String(p.n).split(' ').slice(-1)[0].toUpperCase()}</Go>
              : <Go ghost onClick={() => { setSure(true); sfx('deny') }} sub={`SAVES ${money(Math.max(0, cut.saves))}`}>RELEASE</Go>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
export { BigNum, MARKET_LABEL, marketKey, AWARD_SHORT, gradeOf }
