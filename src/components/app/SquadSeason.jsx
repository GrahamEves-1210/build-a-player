import { Component, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { POS_LABEL, POS_NAME } from '../../lib/squad'
import {
  teamOf, logoOf, isTeamResult, seasonBox, seasonBoxReady, seasonBoxSoon, scheduleOf, roleOf, photoFor, fbMore, bkMore, teamGrade,
} from '../../lib/squadSeason'
import { HONOR_NAME, leadersOf } from '../../lib/teamSeason'
import { Bracket, WeekStrip } from './AppSeason'
import { sfx } from '../../lib/juice'
import { IconClose, IconTrophy, IconCaret } from './icons'

// SQUAD BUILDER: the season as the team played it (lib/squadSeason.js + lib/teamSeason.js).
// The team first (its record, how it ended, what it scored and gave up), then the builds' seasons,
// the playoffs, the team's leaders, every game (tap one for its box score) and the real
// teammates around the builds. The builds are labelled with the player's name (`owner`).

export const fmt = v => (typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1)) : v ?? '—')
const r1 = v => Math.round((v ?? 0) * 10) / 10
const pct1 = (m, a) => (a ? ((100 * m) / a).toFixed(1) : '0.0')
// the last name (a suffix rides along: Pittman III)
export const lastName = n => { const w = (n || '').split(' '); return w.length > 2 && /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(w[w.length - 1]) ? w.slice(-2).join(' ') : w[w.length - 1] }
// a face: the ESPN headshot, or the initial when there's none
export const Face = ({ src, name, mine = false, size = 44 }) => (
  <span className={`tk-hs sq-face${mine ? ' is-mine' : ''}`} style={{ width: size, height: size }}>{src ? <img src={src} alt="" loading="lazy" draggable={false} /> : (name || '?').slice(0, 1)}</span>
)

// A render error in the new view never takes the result away: the old view takes over
export class SafeView extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e) { console.error('[squad] season view', e) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

// How the season ended
export function outcome(r) {
  if (r.sport === 'bucket') {
    if (r.champion) return 'NBA Champions'
    const last = r.rounds?.[r.rounds.length - 1]
    if (!r.rounds?.length) return `Missed the playoffs · ${r.seed}th in the ${r.conference === 'east' ? 'East' : 'West'}`
    if (last.type === 'playin' && !last.won) return 'Out in the Play-In'
    return `Lost in the ${last.name ?? 'playoffs'}${last.opponent ? ` to ${last.opponent}` : ''}${last.wins != null ? ` (${last.wins}-${last.losses})` : ''}`
  }
  if (r.champion) return 'Super Bowl Champions'
  if (!r.playoffs) return 'Missed the playoffs'
  const last = r.rounds?.[r.rounds.length - 1]
  return `Lost in the ${last?.round ?? 'playoffs'}${last ? ` to the ${lastName(last.opponent)}` : ''}`
}

// ── What a man did, in a line ────────────────────────────────────────────────
function fbSummary(pos, t = {}) {
  const g = k => t[k] ?? 0
  switch (pos) {
    case 'qb': return `${g('pc')}/${g('pa')} · ${fmt(g('py'))} YDS · ${g('ptd')} TD · ${g('int')} INT`
    case 'rb': return `${g('ra')} CAR · ${fmt(g('ry'))} YDS · ${g('rtd')} TD${g('rc') ? ` · ${g('rc')} REC` : ''}`
    case 'wr': case 'te': return `${g('rc')} REC · ${fmt(g('ryd'))} YDS · ${g('rctd')} TD`
    case 'dl': return `${g('sck')} SCK · ${g('tfl')} TFL · ${g('tk')} TKL`
    case 'lb': return `${g('tk')} TKL · ${g('sck')} SCK · ${g('dint')} INT`
    case 'ol': return `${g('sa')} SACKS ALLOWED · ${g('prs')} PRESSURES · ${g('pnk')} PANCAKES · ${g('pen')} PEN`
    case 'db': return `${g('tk')} TKL · ${g('dint')} INT · ${g('pbu')} PBU`
    default: return ''
  }
}
function bkSummary(t = {}) {
  const gp = Math.max(1, t.gp ?? 0), pg = k => fmt(r1((t[k] ?? 0) / gp))
  return `${pg('pts')} PTS · ${pg('reb')} REB · ${pg('ast')} AST · ${pg('mn')} MIN`
}
const FB_ORDER = ['qb', 'rb', 'wr', 'te', 'ol', 'dl', 'lb', 'db']
const FB_GROUP = { qb: 'QUARTERBACK', rb: 'RUNNING BACKS', wr: 'RECEIVERS', te: 'TIGHT ENDS', ol: 'OFFENSIVE LINE', dl: 'DEFENSIVE LINE', lb: 'LINEBACKERS', db: 'SECONDARY' }

// ── The team line: points for and against, the offense and the defense ──────
const TeamLine = memo(function TeamLine({ r, sport }) {
  const t = r.tt, gp = Math.max(1, t?.gp ?? 0), us = t?.us ?? {}, them = t?.them ?? {}
  const st = r.strength ?? {}
  const delta = (now, was) => { const a = teamGrade(sport, now), b = teamGrade(sport, was); return a === b ? null : <i className={(now ?? 0) > (was ?? 0) ? 'is-up' : 'is-down'}>from {b}</i> }
  const pct = (m, a) => `${fmt(r1(a ? (100 * m) / a : 0))}%`
  const more = sport === 'bucket'
    ? [`${pct(us.fgm, us.fga)} FG`, `${pct(us.tpm, us.tpa)} 3PT`, `${fmt(r1(us.reb / gp))} REB`, `${fmt(r1(us.ast / gp))} AST`]
    : [`${fmt(Math.round(us.yds / gp))} YDS/G`, `${fmt(Math.round(them.yds / gp))} ALLOWED`, `${them.sk ?? 0} SACKS`, `${them.to ?? 0} TAKEAWAYS`]
  return (
    <section className="sq-card sq-tl ag-pop" style={{ '--d': '40ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE TEAM · {sport === 'bucket' ? '82 GAMES' : `${gp} GAMES`}</span></div>
      <div className="sq-tl-cells">
        <span><small>{sport === 'bucket' ? 'PPG' : 'PTS/G'}</small><b>{fmt(r1(us.pts / gp))}</b></span>
        <span><small>OPP</small><b>{fmt(r1(them.pts / gp))}</b></span>
        <span><small>OFFENSE</small><b>{teamGrade(sport, st.off)}</b>{delta(st.off, st.baseOff)}</span>
        <span><small>DEFENSE</small><b>{teamGrade(sport, st.def)}</b>{delta(st.def, st.baseDef)}</span>
      </div>
      <p className="sq-tl-more">{more.join(' · ')}</p>
    </section>
  )
})

// ── The builds' seasons, front and centre ───────────────────────────────────
const BuildLines = memo(function BuildLines({ r, squad, owner, sport }) {
  const bySlot = Object.fromEntries((squad?.slots ?? []).map(s => [s.id, s]))
  const roster = r.roster
  return (
    <section className="sq-lines ag-pop" style={{ '--d': '80ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">{owner.toUpperCase()}'S BUILDS</span></div>
      {r.lines.map(l => {
        const p = roster.find(x => x.s === l.id)
        const t = p ? r.tot[p.k] : null
        const more = p ? (sport === 'bucket' ? bkMore(p.pos, t) : fbMore(p.pos, t)) : []
        const role = p ? roleOf(p, roster) : (l.tag ?? POS_LABEL[l.pos])
        return (
          <div key={l.id} className={`sq-line${l.award?.won ? ' is-award' : ''}`}>
            <div className="sq-line-top">
              <Face src={l.face} name={POS_LABEL[l.pos]} mine />
              <span className="sq-row-txt">
                <b>{l.name ?? POS_NAME[l.pos]}</b>
                <small>{role} · {owner}{bySlot[l.id] ? '' : ' · cut'}</small>
              </span>
              {l.award?.won && <span className="sq-award"><IconTrophy size={13} /> {l.award.name}</span>}
              {!l.award?.won && l.honor && <span className="sq-honor">{HONOR_NAME[l.honor]}</span>}
              <span className="sq-ovr"><b>{l.ovr}</b><small>OVR</small></span>
            </div>
            <div className="sq-stats">{l.stats.map(([k, v]) => <span key={k}><b>{fmt(v)}</b><small>{k}</small></span>)}</div>
            {(more.length > 0 || (l.award?.won && l.honor)) && <p className="sq-line-more">{[...(l.award?.won && l.honor ? [HONOR_NAME[l.honor]] : []), ...more].join(' · ')}</p>}
          </div>
        )
      })}
    </section>
  )
})

// ── A game in a list: tap it for the box score ──────────────────────────────
function GameRow({ g, sport, onOpen }) {
  const can = !!onOpen
  const Tag = can ? 'button' : 'div'
  return (
    <Tag className={`sq-game${g.won ? ' is-w' : ' is-l'}${g.po && sport !== 'bucket' ? ' is-po' : ''}`} {...(can && { onClick: () => onOpen(g), 'aria-label': `${g.label}, ${g.home ? 'vs' : 'at'} ${g.opp}, ${g.won ? 'won' : 'lost'} ${g.my} to ${g.op}` })}>
      <span className="sq-game-lbl">{g.po && sport !== 'bucket' ? g.label.replace(' ROUND', '').replace('CONFERENCE CHAMPIONSHIP', 'CONF. FINAL') : g.po ? `G${g.gm}` : g.label}</span>
      <img src={logoOf(sport, g.opp)} alt="" loading="lazy" />
      <span className="sq-game-opp">{g.home ? 'vs' : '@'} {g.opp}</span>
      <b className="sq-game-res"><i>{g.won ? 'W' : 'L'}</i> {g.my}-{g.op}{g.ot ? ` ${g.ot > 1 ? `${g.ot}OT` : 'OT'}` : ''}</b>
      {can && <IconCaret dir="right" size={11} className="sq-game-go" />}
    </Tag>
  )
}

// ── The playoffs: the bracket (football) or the series (basketball) ─────────
const Playoffs = memo(function Playoffs({ r, sport, games, onOpen }) {
  const [open, setOpen] = useState(null)
  if (sport === 'bucket') {
    if (!r.rounds?.length) return null
    return (
      <section className="sq-po ag-pop" style={{ '--d': '120ms' }}>
        <div className="ag-card-head"><span className="ag-eyebrow">PLAYOFFS · {r.seed} SEED IN THE {r.conference === 'east' ? 'EAST' : 'WEST'}</span></div>
        {r.rounds.map((x, i) => {
          const gs = games.filter(g => g.po && g.ri === i)
          const isOpen = open === i
          return (
            <div key={i} className="sq-po-grp">
              <button className={`sq-po-row${x.won ? ' is-w' : ' is-l'}`} onClick={() => { setOpen(isOpen ? null : i); sfx('tap') }} aria-expanded={isOpen}>
                <span>{x.type === 'playin' ? 'PLAY-IN' : (x.name ?? '').toUpperCase()}</span>
                {x.opponent && <img src={logoOf('bucket', x.opponent)} alt="" />}
                <b>{x.type === 'playin' ? (x.won ? 'IN' : 'OUT') : `${x.wins}-${x.losses}`}</b>
                <IconCaret dir={isOpen ? 'up' : 'down'} size={11} className="sq-po-caret" />
              </button>
              {isOpen && <div className="sq-po-games">{gs.map(g => <GameRow key={g.i} g={g} sport={sport} onOpen={onOpen} />)}</div>}
            </div>
          )
        })}
      </section>
    )
  }
  if (!r.playoffs) return null
  const po = games.filter(g => g.po)
  return (
    <section className="sq-po ag-pop" style={{ '--d': '120ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">PLAYOFFS</span></div>
      <Bracket rounds={r.rounds} gameIdx={r.rounds.length - 1} status={r.champion ? 'champion' : 'eliminated'} hasBye={r.hasBye} />
      <div className="sq-po-games">{po.map(g => <GameRow key={`p${g.i}`} g={g} sport={sport} onOpen={onOpen} />)}</div>
    </section>
  )
})

// ── Team leaders ─────────────────────────────────────────────────────────────
const Leaders = memo(function Leaders({ r, sport, owner, faces }) {
  const L = useMemo(() => leadersOf(sport, r.roster, r.tot), [r, sport])
  if (!L.length) return null
  const by = Object.fromEntries(r.roster.map(p => [p.k, p]))
  return (
    <section className="sq-card ag-pop" style={{ '--d': '140ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">TEAM LEADERS</span></div>
      {L.map(x => {
        const p = by[x.k], mine = !!p?.s
        return (
          <div key={x.key} className={`sq-lead${mine ? ' is-mine' : ''}`}>
            <span className="sq-lead-lbl">{x.label}</span>
            <Face src={photoFor(sport, p, faces)} name={p?.n} mine={mine} size={28} />
            <span className="sq-lead-who"><b>{mine ? p.n : lastName(p?.n)}</b><small>{roleOf(p, r.roster)}{mine ? ` · ${owner}` : ''}</small></span>
            <span className="sq-lead-val"><b>{fmt(x.val)}</b><small>{x.unit}</small></span>
          </div>
        )
      })}
    </section>
  )
})

// ── Every game ───────────────────────────────────────────────────────────────
const Schedule = memo(function Schedule({ sport, games, onOpen }) {
  const [all, setAll] = useState(false)
  const reg = games.filter(g => !g.po)
  const shown = sport === 'bucket' && !all ? reg.slice(-10) : reg
  return (
    <section className="sq-card ag-pop" style={{ '--d': '160ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">{sport === 'bucket' ? (all ? 'THE SEASON · 82 GAMES' : 'THE SEASON · LAST 10') : 'THE SEASON'}</span></div>
      {sport === 'bucket' && <div className="sq-log" aria-hidden="true">{reg.map(g => <i key={g.i} className={g.won ? 'is-w' : 'is-l'} />)}</div>}
      <div className="sq-games">{shown.map(g => <GameRow key={g.i} g={g} sport={sport} onOpen={onOpen} />)}</div>
      {sport === 'bucket' && <button className="ag-btn ag-btn--ghost sq-more-btn" onClick={() => { setAll(!all); sfx('tap') }}>{all ? 'LAST 10 GAMES' : 'ALL 82 GAMES'}</button>}
    </section>
  )
})

// ── The teammates around them: compact, by position ─────────────────────────
const Teammates = memo(function Teammates({ r, sport }) {
  const real = r.roster.filter(p => !p.s)
  if (!real.length) return null
  const row = p => (
    <div key={p.k} className="sq-mate">
      <Face src={photoFor(sport, p)} name={p.n} size={26} />
      <span className="sq-mate-who"><b>{lastName(p.n)}</b><small>{roleOf(p, r.roster)} · {p.o}{r.honors?.[p.k] ? ` · ${HONOR_NAME[r.honors[p.k]]}` : ''}</small></span>
      <span className="sq-mate-line">{sport === 'bucket' ? bkSummary(r.tot[p.k]) : fbSummary(p.pos, r.tot[p.k])}</span>
    </div>
  )
  return (
    <section className="sq-card sq-mates ag-pop" style={{ '--d': '180ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">SURROUNDING TALENT</span></div>
      {sport === 'bucket'
        ? real.map(row)
        : FB_ORDER.filter(pos => real.some(p => p.pos === pos)).map(pos => (
          <div key={pos} className="sq-mates-grp">
            <span className="sq-mates-pos">{FB_GROUP[pos]}</span>
            {real.filter(p => p.pos === pos).map(row)}
          </div>
        ))}
    </section>
  )
})

// ── One game's box score ─────────────────────────────────────────────────────
function FbTable({ head, rows }) {
  if (!rows.length) return null
  return (
    <div className="sq-bt sq-bt--fb">
      <div className="sq-bt-row sq-bt-head"><span>{head[0]}</span>{head.slice(1).map(h => <span key={h}>{h}</span>)}</div>
      {rows.map(x => <div key={x.k} className={`sq-bt-row${x.mine ? ' is-mine' : ''}`}><span className="sq-bt-name">{x.name}<small>{x.role}</small></span>{x.cells.map((c, i) => <span key={i}>{c}</span>)}</div>)}
    </div>
  )
}
const FB_CELLS = {
  qb: [['C/ATT', 'YDS', 'TD', 'INT'], g => [`${g('pc')}/${g('pa')}`, g('py'), g('ptd'), g('int')]],
  rb: [['CAR', 'YDS', 'TD', 'REC'], g => [g('ra'), g('ry'), g('rtd') + g('rctd'), g('rc')]],
  wr: [['REC', 'YDS', 'TD', 'TGT'], g => [g('rc'), g('ryd'), g('rctd'), g('tg')]],
  te: [['REC', 'YDS', 'TD', 'TGT'], g => [g('rc'), g('ryd'), g('rctd'), g('tg')]],
  dl: [['TKL', 'SCK', 'TFL', 'QBH'], g => [g('tk'), g('sck'), g('tfl'), g('qbh')]],
  lb: [['TKL', 'SCK', 'TFL', 'INT'], g => [g('tk'), g('sck'), g('tfl'), g('dint')]],
  db: [['TKL', 'INT', 'PBU', 'FF'], g => [g('tk'), g('dint'), g('pbu'), g('ff')]],
  ol: [['SCK', 'PRS', 'PNK', 'PEN'], g => [g('sa'), g('prs'), g('pnk'), g('pen')]],
}
function FootballBox({ r, game, owner, faces }) {
  const roster = r.roster, s = game.s
  const get = p => k => s[p.k]?.[k] ?? 0
  const mine = roster.filter(p => p.s)
  const real = roster.filter(p => !p.s)
  const row = (p, cells) => ({ k: p.k, name: lastName(p.n), role: roleOf(p, roster), cells })
  const pass = real.filter(p => p.pos === 'qb' && get(p)('pa'))
  const rush = real.filter(p => get(p)('ra'))
  const rec = real.filter(p => get(p)('tg'))
  const line = real.filter(p => p.pos === 'ol' && get(p)('sn'))
  const dfn = real.filter(p => ['dl', 'lb', 'db'].includes(p.pos) && (get(p)('tk') || get(p)('sck') || get(p)('dint') || get(p)('pbu')))
  return (
    <>
      {mine.length > 0 && (
        <div className="sq-box-sec">
          <span className="sq-box-h">{owner.toUpperCase()}'S BUILDS</span>
          {mine.map(p => {
            const [head, cells] = FB_CELLS[p.pos]
            return (
              <div key={p.k} className="sq-box-me">
                <Face src={faces[p.s]} name={POS_LABEL[p.pos]} mine size={32} />
                <span className="sq-row-txt"><b>{p.n}</b><small>{roleOf(p, roster)} · {owner}</small></span>
                <span className="sq-box-me-cells">{cells(get(p)).map((v, i) => <span key={i}><b>{fmt(v)}</b><small>{head[i]}</small></span>)}</span>
              </div>
            )
          })}
        </div>
      )}
      <div className="sq-box-sec">
        <span className="sq-box-h">TEAMMATES</span>
        <FbTable head={['PASSING', 'C/ATT', 'YDS', 'TD', 'INT']} rows={pass.map(p => row(p, FB_CELLS.qb[1](get(p))))} />
        <FbTable head={['RUSHING', 'CAR', 'YDS', 'TD', 'AVG']} rows={rush.map(p => { const g = get(p); return row(p, [g('ra'), g('ry'), g('rtd'), fmt(r1(g('ra') ? g('ry') / g('ra') : 0))]) })} />
        <FbTable head={['RECEIVING', 'REC', 'YDS', 'TD', 'TGT']} rows={rec.map(p => row(p, FB_CELLS.wr[1](get(p))))} />
        {line.length > 0 && <FbTable head={['BLOCKING', 'SCK', 'PRS', 'PNK', 'PEN']} rows={line.map(p => row(p, FB_CELLS.ol[1](get(p))))} />}
        <FbTable head={['DEFENSE', 'TKL', 'SCK', 'INT', 'PBU']} rows={dfn.map(p => { const g = get(p); return row(p, [g('tk'), g('sck'), g('dint'), g('pbu')]) })} />
      </div>
    </>
  )
}
function TeamStats({ sport, r, game, rows }) {
  const oppShort = game?.opp
  return (
    <div className="sq-box-sec">
      <span className="sq-box-h">TEAM</span>
      <div className="sq-tstat">
        <div className="sq-tstat-row sq-tstat-head"><span /><span><img src={logoOf(sport, r.team)} alt="" />{r.team}</span><span>{oppShort ? <><img src={logoOf(sport, oppShort)} alt="" />{oppShort}</> : 'OPP'}</span></div>
        {rows.map(([k, a, b]) => <div key={k} className="sq-tstat-row"><span>{k}</span><b>{fmt(a ?? 0)}</b><b>{b == null ? '' : fmt(b)}</b></div>)}
      </div>
    </div>
  )
}
const BK_HEAD = ['MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG', '3PT']
const bkCells = x => [x.mn ?? '', x.pts ?? 0, x.reb ?? 0, x.ast ?? 0, x.stl ?? 0, x.blk ?? 0, `${x.fgm ?? 0}-${x.fga ?? 0}`, `${x.tpm ?? 0}-${x.tpa ?? 0}`]
function BucketBox({ r, game, owner, faces }) {
  const roster = r.roster, s = game.s
  const order = [...roster.filter(p => p.s), ...roster.filter(p => !p.s && p.spot != null), ...roster.filter(p => !p.s && p.spot == null)]
  return (
    <div className="sq-box-sec">
      <div className="sq-bt sq-bt--bk" role="table">
        <div className="sq-bt-row sq-bt-head" role="row"><span>PLAYER</span>{BK_HEAD.map(h => <span key={h}>{h}</span>)}</div>
        {order.map(p => {
          const x = s[p.k] ?? {}
          const mine = !!p.s
          return (
            <div key={p.k} className={`sq-bt-row${mine ? ' is-mine' : ''}${!x.mn ? ' is-dnp' : ''}`} role="row">
              <span className="sq-bt-name">{mine ? <Face src={faces[p.s]} name={POS_LABEL[p.pos]} mine size={20} /> : null}{mine ? owner : lastName(p.n)}<small>{roleOf(p, roster)}</small></span>
              {x.mn ? bkCells(x).map((c, i) => <span key={i}>{c}</span>) : <span className="sq-bt-dnp">DNP</span>}
            </div>
          )
        })}
        <div className="sq-bt-row sq-bt-total" role="row"><span className="sq-bt-name">{r.team}<small>TEAM</small></span>{bkCells({ ...game.us, mn: 240 + 25 * (game.us.ot ?? 0) }).map((c, i) => <span key={i}>{c}</span>)}</div>
        <div className="sq-bt-row sq-bt-total is-opp" role="row"><span className="sq-bt-name">{game.g.opp}<small>OPP</small></span>{bkCells({ ...game.them, mn: '' }).map((c, i) => <span key={i}>{c}</span>)}</div>
      </div>
    </div>
  )
}
// (portal: the sheet over the page; false renders it in place)
export function BoxSheet({ r, sport, g, box, owner, faces, onClose, portal = true }) {
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const game = (g.po ? box.po : box.reg)[g.i]
  if (!game) return null
  const oppTeam = teamOf(sport, g.opp)
  const where = sport === 'bucket'
    ? (g.po ? `${g.round} · GAME ${g.gm}` : `GAME ${g.i + 1}`)
    : g.label
  const sheet = (
    <div className="ss-overlay sq-box-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ss-sheet sq-box" role="dialog" aria-modal="true" aria-labelledby="sq-box-title">
        <div className="ss-head">
          <span className="ag-eyebrow">{where} · {g.home ? 'VS' : 'AT'} {(oppTeam?.name ?? g.oppName ?? g.opp).toUpperCase()}</span>
          <button className="ss-close" onClick={onClose} aria-label="Close"><IconClose size={15} /></button>
        </div>
        <div className={`sq-box-score${g.won ? ' is-w' : ' is-l'}`} id="sq-box-title">
          <span className="sq-box-team"><img src={logoOf(sport, r.team)} alt="" /><b>{r.team}</b></span>
          <span className="sq-box-pts"><b>{g.my}</b><i>–</i><b>{g.op}</b></span>
          <span className="sq-box-team"><img src={logoOf(sport, g.opp)} alt="" /><b>{g.opp}</b></span>
          <span className="sq-box-final">{g.won ? 'WIN' : 'LOSS'}{g.ot ? ` · ${g.ot > 1 ? `${g.ot}OT` : 'OT'}` : ''}</span>
        </div>
        {sport === 'bucket'
          ? <BucketBox r={r} game={{ ...game, g }} owner={owner} faces={faces} />
          : <FootballBox r={r} game={game} owner={owner} faces={faces} />}
        <TeamStats sport={sport} r={r} game={g} rows={sport === 'bucket' ? [
          ['FG%', pct1(game.us.fgm, game.us.fga), pct1(game.them.fgm, game.them.fga)],
          ['3PT%', pct1(game.us.tpm, game.us.tpa), pct1(game.them.tpm, game.them.tpa)],
          ['FREE THROWS', `${game.us.ftm}-${game.us.fta}`, `${game.them.ftm}-${game.them.fta}`],
          ['REBOUNDS', game.us.reb, game.them.reb], ['ASSISTS', game.us.ast, game.them.ast], ['STEALS', game.us.stl, game.them.stl], ['TURNOVERS', game.us.to, game.them.to],
        ] : [
          ['TOTAL YARDS', game.us.yds, game.them.yds], ['PASSING', game.us.py, game.them.py], ['RUSHING', game.us.ry, game.them.ry],
          ['TOUCHDOWNS', game.us.td, game.them.td], ['FIELD GOALS', game.us.fg ?? 0, game.them.fg ?? 0], ['TURNOVERS', game.us.to, game.them.to], ['SACKED', game.us.sk, game.them.sk],
        ]} />
      </div>
    </div>
  )
  return portal ? createPortal(sheet, document.body) : sheet
}

// ── The season playing out (a season just simmed), the way Simulate Season plays one ──
// The weeks light up one by one with their scores and the record builds; then the playoffs, a round
// at a time; then the full results. SKIP goes straight to them. Reduce Motion skips it.
const reducedMotion = () => { try { return document.documentElement.classList.contains('bap-reduce-motion') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch { return false } }
function SeasonReveal({ r, sport, games, onDone }) {
  const reg = useMemo(() => games.filter(g => !g.po), [games])
  const rounds = r.rounds ?? []
  const bk = sport === 'bucket'
  const [k, setK] = useState(0)          // regular-season games shown
  const [po, setPo] = useState(-1)       // playoff round on now (-1: not yet)
  const [poDone, setPoDone] = useState(false)   // that round has its result
  const doneRef = useRef(onDone); doneRef.current = onDone
  useEffect(() => {
    let t, i = 0
    const step = bk ? 4 : 1, every = bk ? 90 : 190
    const regTick = () => {
      i = Math.min(reg.length, i + step); setK(i)
      if (i < reg.length) { t = setTimeout(regTick, every); return }
      t = setTimeout(() => (rounds.length ? poTick(0) : doneRef.current()), 900)
    }
    const poTick = n => {
      setPo(n); setPoDone(false)
      t = setTimeout(() => {
        setPoDone(true); sfx(rounds[n]?.won ? 'claim' : 'tap')
        t = setTimeout(() => (n + 1 < rounds.length && rounds[n]?.won ? poTick(n + 1) : doneRef.current()), n + 1 < rounds.length && rounds[n]?.won ? 750 : 1100)
      }, 850)
    }
    t = setTimeout(regTick, 400)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = reg.slice(0, k)
  const w = shown.filter(g => g.won).length, l = shown.length - w
  const last = shown.slice(-4).reverse()
  const inPo = po >= 0
  const team = teamOf(sport, r.team)
  const status = !inPo ? 'between' : !poDone ? 'live' : rounds[po]?.won ? (po === rounds.length - 1 ? 'champion' : 'between') : 'eliminated'
  return (
    <div className="sq-reveal">
      <div className="sq-hero ag-pop" style={{ '--tc': team?.color ?? 'var(--ag-a1)' }}>
        <img className="sq-hero-logo" src={logoOf(sport, r.team)} alt="" />
        <span className="sq-hero-txt">
          <span className="ag-eyebrow">{team?.name ?? r.team} · {inPo ? 'PLAYOFFS' : 'REGULAR SEASON'}</span>
          <b className="sq-hero-rec">{w}<i>–</i>{l}</b>
          <small className="sq-hero-out">{k < reg.length ? `${bk ? 'GAME' : 'WEEK'} ${k} OF ${reg.length}` : r.playoffs ? 'PLAYOFF BOUND' : 'MISSED THE PLAYOFFS'}</small>
        </span>
      </div>
      <section className="sq-po">
        {bk ? <div className="sq-log" aria-hidden="true">{reg.map((g, i) => <i key={i} className={i < k ? (g.won ? 'is-w' : 'is-l') : ''} />)}</div> : <WeekStrip games={r.games ?? []} revealed={k} />}
        {!inPo && <div className="sq-games">{last.map(g => <GameRow key={g.i} g={g} sport={sport} />)}</div>}
        {inPo && !bk && <Bracket rounds={rounds} gameIdx={po} status={status} hasBye={r.hasBye} />}
        {inPo && bk && rounds.slice(0, po + 1).map((x, i) => (
          <div key={i} className={`sq-po-row${i < po || poDone ? (x.won ? ' is-w' : ' is-l') : ''}`}>
            <span>{x.type === 'playin' ? 'PLAY-IN' : (x.name ?? '').toUpperCase()}</span>
            {x.opponent && <img src={logoOf('bucket', x.opponent)} alt="" />}
            <b>{i === po && !poDone ? 'LIVE' : x.type === 'playin' ? (x.won ? 'IN' : 'OUT') : `${x.wins}-${x.losses}`}</b>
          </div>
        ))}
        {inPo && !bk && poDone && <div className="sq-games">{games.filter(g => g.po && g.i === po).map(g => <GameRow key={g.i} g={g} sport={sport} />)}</div>}
      </section>
      <button className="ag-btn ag-btn--ghost sq-reveal-skip" onClick={() => { sfx('tap'); onDone() }}>SKIP TO THE RESULTS</button>
    </div>
  )
}

// ── The whole result ─────────────────────────────────────────────────────────
export function TeamResult({ sport, squad, owner, rewards, reveal = false, onRevealed }) {
  // (a result missing a list reads it as empty: a damaged save never takes the screen down)
  const raw = squad.last
  const r = useMemo(() => ({ ...raw, rounds: raw.rounds ?? [], lines: raw.lines ?? [], games: raw.games ?? [], honors: raw.honors ?? {} }), [raw])
  const team = teamOf(sport, r.team)
  const games = useMemo(() => scheduleOf(r).map(g => ({ ...g, ri: g.po && sport === 'bucket' ? unpackRound(r, g.i) : null })), [r, sport])
  const faces = useMemo(() => Object.fromEntries(r.lines.map(l => [l.id, l.face])), [r])
  const [playing, setPlaying] = useState(() => reveal && !reducedMotion())
  const finish = useCallback(() => { setPlaying(false); onRevealed?.() }, [onRevealed])
  useEffect(() => { if (reveal && !playing) onRevealed?.() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // every game's box score, played back once when the page is idle (a tap before then plays it back on the spot)
  const [box, setBox] = useState(() => seasonBoxReady(raw))
  useEffect(() => seasonBoxSoon(raw, setBox), [raw])
  const [open, setOpen] = useState(null)
  const canOpen = box !== null && isTeamResult(raw)
  const onOpen = useCallback(g => { setBox(b => (b === undefined ? seasonBox(raw) : b)); setOpen(g); sfx('tap') }, [raw])
  const closeBox = useCallback(() => setOpen(null), [])
  if (playing) return <SeasonReveal r={r} sport={sport} games={games} onDone={finish} />
  return (
    <>
      <div className={`sq-hero ag-pop${r.champion ? ' is-champ' : ''}`} style={{ '--tc': team?.color ?? 'var(--ag-a1)' }}>
        <img className="sq-hero-logo" src={logoOf(sport, r.team)} alt="" />
        <span className="sq-hero-txt">
          <span className="ag-eyebrow">{team?.name ?? r.team}</span>
          <b className="sq-hero-rec">{r.wins}<i>–</i>{r.losses}</b>
          <small className="sq-hero-out">{r.champion && <IconTrophy size={14} />} {outcome(r)}</small>
        </span>
      </div>
      {r.sandbox && <p className="sq-note">SANDBOX squad: just for fun, no XP or coins.</p>}
      <TeamLine r={r} sport={sport} />
      <BuildLines r={r} squad={squad} owner={owner} sport={sport} />
      {rewards}
      <Playoffs r={r} sport={sport} games={games} onOpen={canOpen ? onOpen : null} />
      <Leaders r={r} sport={sport} owner={owner} faces={faces} />
      <Schedule sport={sport} games={games} onOpen={canOpen ? onOpen : null} />
      <Teammates r={r} sport={sport} />
      {open && box && <BoxSheet r={r} sport={sport} g={open} box={box} owner={owner} faces={faces} onClose={closeBox} />}
    </>
  )
}
// a basketball playoff game's round (its place in result.rounds)
function unpackRound(r, i) { return r.pg?.[i]?.[5] ?? null }
export { isTeamResult }
