import { Component, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { POS_LABEL, POS_NAME } from '../../lib/squad'
import {
  teamOf, logoOf, isTeamResult, seasonBox, seasonBoxReady, seasonBoxSoon, scheduleOf, roleOf, photoFor, fbMore, bkMore, teamGrade, soccerMatch, soccerOrdinal,
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
// (football's family suffixes: Vinícius Júnior is Vinícius Júnior, not Júnior; a Korean name puts the family name first,
// Son Heung-min is Son, not Heung-min)
export const lastName = n => {
  const w = (n || '').split(' ')
  if (w.length === 2 && /^(j[uú]nior|neto|filho|sobrinho)$/i.test(w[1])) return n
  if (w.length === 3 && /^(j[uú]nior|neto|filho|sobrinho)$/i.test(w[2])) return w.slice(-2).join(' ')
  if (w.length === 2 && /^[A-Z][a-z]+-[a-z]+$/.test(w[1]) && w[0].length <= 5) return w[0]
  return w.length > 2 && /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(w[w.length - 1]) ? w.slice(-2).join(' ') : w[w.length - 1]
}
// a face: the ESPN headshot, or the initial when there's none
export const Face = ({ src, name, mine = false, size = 44 }) => (
  <span className={`tk-hs sq-face${mine ? ' is-mine' : ''}`} style={{ width: size, height: size }}>{src ? <img src={src} alt="" loading="lazy" draggable={false} /> : (name || '?').slice(0, 1)}</span>
)

// A team's crest (soccer: a club's or a nation's; a side outside the data shows its initials)
export function TeamCrest({ sport, short, pool, className, size }) {
  const src = logoOf(sport, short, pool)
  if (src) return <img className={className} src={src} alt="" loading="lazy" style={size ? { width: size, height: size } : undefined} />
  return <span className={`sq-crest-init${className ? ` ${className}` : ''}`} style={size ? { width: size, height: size } : undefined}>{String(short ?? '?').slice(0, 3)}</span>
}
// soccer's record: W–D–L
export const soccerRecord = r => `${r.wins ?? 0}–${r.draws ?? 0}–${r.losses ?? 0}`

// A render error in the new view never takes the result away: the old view takes over
export class SafeView extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e) { console.error('[squad] season view', e) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

// How the season ended
export function outcome(r) {
  if (r.sport === 'soccer') {
    if (r.pool === 'alltime') return r.champion ? 'World Champions' : r.finish === 'Group stage' ? `Out in the group · ${soccerOrdinal(r.seed ?? 4)} in Group ${r.group ?? ''}` : /^(Runners-up|Third place|Fourth place)$/.test(r.finish ?? '') ? r.finish : `Out in the ${r.finish ?? 'knockouts'}`
    const lg = r.league?.name ?? 'the league'
    if (r.champion) return `${lg} Champions`
    if (r.relegated) return `Relegated · ${soccerOrdinal(r.seed)} in ${lg === 'the league' ? lg : `the ${lg}`}`
    return `${soccerOrdinal(r.seed ?? 0)} in ${/^(La Liga|Serie A|Ligue 1|Bundesliga)$/.test(lg) ? lg : `the ${lg}`}`
  }
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
// (owner 11-18: "really hard to look at and process". The game first: the final with the score by quarter, the two
// teams' lines side by side, the game's leaders; then the men's lines, one team at a time, in plain type: only the
// men who did something, the builds first and marked, no blocking tables)
// "J. Cook", "C.J. Stroud", "A. St. Brown", "M. Harrison Jr."
export const shortName = n => { const w = String(n ?? '').trim().split(/\s+/); if (w.length < 2) return w[0] ?? ''; return `${/\./.test(w[0]) ? w[0] : `${w[0][0]}.`} ${w.slice(1).join(' ')}` }
// the position, plain: QB, RB, WR, EDGE, LT (no depth number)
const posTag = (p, roster) => String(roleOf(p, roster) ?? POS_LABEL[p?.pos] ?? '').replace(/\d+$/, '')
// a team's short name, the way the broadcast says it: Bills, Commanders, Lakers
const nickOf = (sport, short, name) => lastName(teamOf(sport, short)?.name ?? name ?? short ?? '')
// (kept for Franchise's kicking table and any older caller)
export function FbTable({ head, rows }) {
  if (!rows.length) return null
  return (
    <div className="sq-bt sq-bt--fb">
      <div className="sq-bt-row sq-bt-head"><span>{head[0]}</span>{head.slice(1).map(h => <span key={h}>{h}</span>)}</div>
      {rows.map(x => <div key={x.k} className={`sq-bt-row${x.mine ? ' is-mine' : ''}`}><span className="sq-bt-name">{x.name}<small>{x.role}</small></span>{x.cells.map((c, i) => <span key={i}>{c}</span>)}</div>)}
    </div>
  )
}

// The final: both teams, the score by quarter when the game kept it, who won
function LineScore({ sport, us, them, home, my, op, q, status, live, story, nick = null, logo = null }) {
  // (the away team on top, the home team under it, as every scoreboard has it)
  const rows = [{ s: us, pts: my, q: q?.[0] }, { s: them, pts: op, q: q?.[1] }]
  if (home) rows.reverse()
  const nq = q ? Math.max(q[0]?.length ?? 0, q[1]?.length ?? 0) : 0
  const win = live || my === op ? null : my > op ? us : them
  return (
    <div className="bx-final">
      <div className={`bx-ls${nq ? ' has-q' : ''}`} style={{ '--nq': nq }}>
        <div className="bx-ls-row bx-ls-head">
          <span className={`bx-status${live ? ' is-live' : ''}`}>{status}</span>
          {Array.from({ length: nq }, (_, i) => <span key={i}>{i < 4 ? i + 1 : 'OT'}</span>)}
          {nq > 0 && <span>T</span>}
        </div>
        {rows.map(x => (
          <div key={x.s} className={`bx-ls-row${win === x.s ? ' is-win' : win ? ' is-lose' : ''}`}>
            <span className="bx-ls-team"><img src={logo ? logo(x.s) : logoOf(sport, x.s)} alt="" /><b>{nick ? nick(x.s) : nickOf(sport, x.s)}</b>{win === x.s && <i className="bx-ls-w" aria-label="won" />}</span>
            {Array.from({ length: nq }, (_, i) => <span key={i} className="bx-ls-q">{x.q?.[i] ?? 0}</span>)}
            <span className="bx-ls-pts">{x.pts}</span>
          </div>
        ))}
      </div>
      {story && <p className="bx-story">{story}</p>}
    </div>
  )
}

// The two teams' lines, side by side; the better number of each pair stands out
const LOWER_BETTER = /turnover|sack|penalt|interception|foul|yellow card/i
const numOf = v => (typeof v === 'number' ? v : /^\d+:\d\d$/.test(String(v)) ? (([m, s]) => +m * 60 + +s)(String(v).split(':')) : /%$/.test(String(v)) ? parseFloat(v) : null)
function TeamCompare({ sport, us, them, rows, logo = null }) {
  return (
    <section className="bx-sec">
      <h3 className="bx-h">Team stats</h3>
      <div className="bx-tc" role="table">
        <div className="bx-tc-row bx-tc-head" role="row"><span /><span><img src={logo ? logo(us) : logoOf(sport, us)} alt="" />{us}</span><span><img src={logo ? logo(them) : logoOf(sport, them)} alt="" />{them}</span></div>
        {rows.map(([k, a, b]) => {
          const x = numOf(a), y = numOf(b)
          const lead = x == null || y == null || x === y ? 0 : (LOWER_BETTER.test(k) ? x < y : x > y) ? 1 : 2
          return (
            <div key={k} className="bx-tc-row" role="row">
              <span className="bx-tc-k">{k}</span>
              <span className={lead === 1 ? 'is-lead' : lead === 2 ? 'is-back' : ''}>{fmt(a ?? 0)}</span>
              <span className={lead === 2 ? 'is-lead' : lead === 1 ? 'is-back' : ''}>{b == null ? '' : fmt(b)}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// The game's leaders: the best passer, runner, receiver and defender on either side
const join = parts => parts.filter(Boolean).join(' · ')
const FB_LEAD = [
  { k: 'Passing', ok: x => x.pa, v: x => x.py ?? 0, line: x => join([`${x.pc ?? 0}/${x.pa}`, `${fmt(x.py ?? 0)} yds`, `${x.ptd ?? 0} TD`, x.int ? `${x.int} INT` : null]) },
  { k: 'Rushing', ok: x => x.ra, v: x => x.ry ?? 0, line: x => join([`${x.ra} car`, `${fmt(x.ry ?? 0)} yds`, x.rtd ? `${x.rtd} TD` : null]) },
  { k: 'Receiving', ok: x => x.rc, v: x => x.ryd ?? 0, line: x => join([`${x.rc} rec`, `${fmt(x.ryd ?? 0)} yds`, x.rctd ? `${x.rctd} TD` : null]) },
  { k: 'Defense', ok: x => x.tk || x.sck || x.dint, v: x => (x.sck ?? 0) * 3 + (x.dint ?? 0) * 4 + (x.ff ?? 0) * 2 + (x.tk ?? 0) * 0.6 + (x.pbu ?? 0) * 0.5,
    line: x => join([x.tk ? `${x.tk} tkl` : null, x.sck ? `${fmt(x.sck)} ${x.sck === 1 ? 'sack' : 'sacks'}` : null, x.dint ? `${x.dint} INT` : null, x.ff ? `${x.ff} FF` : null]) },
]
const BK_LEAD = [
  { k: 'Points', ok: x => x.pts, v: x => x.pts ?? 0, line: x => join([`${x.pts} pts`, `${x.fgm ?? 0}-${x.fga ?? 0} FG`, x.tpm ? `${x.tpm} 3PT` : null]) },
  { k: 'Rebounds', ok: x => x.reb, v: x => x.reb ?? 0, line: x => `${x.reb} reb` },
  { k: 'Assists', ok: x => x.ast, v: x => x.ast ?? 0, line: x => `${x.ast} ast` },
]
function Leaders1({ sport, sides, each = false }) {
  const out = []
  // (each: every team's own leader in each, the way the NBA's box has it; otherwise the game's one)
  for (const c of sport === 'bucket' ? BK_LEAD : FB_LEAD) for (const pool of each ? sides.map(S => [S]) : [sides]) {
    let best = null
    for (const S of pool) for (const p of S.roster) { const x = S.s[p.k]; if (x && c.ok(x) && (!best || c.v(x) > best.v)) best = { v: c.v(x), p, x, S } }
    if (best && best.v > 0) out.push({ c, ...best })
  }
  if (!out.length) return null
  return (
    <section className="bx-sec">
      <h3 className="bx-h">Game leaders</h3>
      <div className="bx-lead">
        {out.map(({ c, p, x, S }) => (
          <div key={`${c.k}-${S.team}`} className={`bx-lead-row${p.s ? ' is-mine' : ''}`}>
            <span className="bx-lead-k">{c.k}</span>
            <img src={logoOf(sport, S.team)} alt="" />
            <span className="bx-lead-who"><b>{p.s ? p.n : shortName(p.n)}<small>{posTag(p, S.roster)} · {S.team}</small></b><span>{c.line(x)}</span></span>
          </div>
        ))}
      </div>
    </section>
  )
}

// One team's men: a table a part of the game, only the men with a line in it, the builds first
const FB_TABLES = [
  { k: 'Passing', head: ['C/ATT', 'YDS', 'TD', 'INT'], ok: x => x.pa, cells: x => [`${x.pc ?? 0}/${x.pa}`, x.py ?? 0, x.ptd ?? 0, x.int ?? 0], v: x => x.py ?? 0 },
  { k: 'Rushing', head: ['CAR', 'YDS', 'AVG', 'TD'], ok: x => x.ra, cells: x => [x.ra, x.ry ?? 0, fmt(r1((x.ry ?? 0) / x.ra)), x.rtd ?? 0], v: x => x.ry ?? 0 },
  { k: 'Receiving', head: ['REC', 'YDS', 'TD', 'TGT'], ok: x => x.rc || x.ryd, cells: x => [x.rc ?? 0, x.ryd ?? 0, x.rctd ?? 0, x.tg ?? 0], v: x => x.ryd ?? 0 },
  { k: 'Defense', head: ['TKL', 'SCK', 'INT', 'PBU'], ok: x => x.tk || x.sck || x.dint || x.pbu || x.ff, cells: x => [x.tk ?? 0, fmt(x.sck ?? 0), x.dint ?? 0, x.pbu ?? 0], v: x => (x.tk ?? 0) + (x.sck ?? 0) * 3 + (x.dint ?? 0) * 4, def: true },
  // (a lineman's line only for a build: the player's own lineman)
  { k: 'Blocking', head: ['SCK', 'PRS', 'PNK', 'PEN'], ok: x => x.sn || x.pnk || x.prs || x.sa, cells: x => [x.sa ?? 0, x.prs ?? 0, x.pnk ?? 0, x.pen ?? 0], v: () => 0, ol: true },
]
function StatTable({ title, head, rows, cap = 0 }) {
  const [all, setAll] = useState(false)
  if (!rows.length) return null
  // (a long table, the defense's: the first few, the rest a tap away; the builds always show)
  const shown = cap && !all && rows.length > cap + 1 ? rows.filter((x, i) => i < cap || x.mine) : rows
  return (
    <div className="bx-t" role="table" aria-label={title}>
      <div className="bx-t-row bx-t-head" role="row"><span className="bx-t-k">{title}</span>{head.map(h => <span key={h}>{h}</span>)}</div>
      {shown.map(x => (
        <div key={x.k} className={`bx-t-row${x.mine ? ' is-mine' : ''}`} role="row">
          <span className="bx-t-name"><b>{x.name}</b><small>{x.pos}</small></span>
          {x.cells.map((c, i) => <span key={i}>{fmt(c)}</span>)}
        </div>
      ))}
      {shown.length < rows.length && <button type="button" className="bx-t-more" onClick={() => { setAll(true); sfx('tap') }}>Show all {rows.length}</button>}
    </div>
  )
}
function TeamMen({ side, kick }) {
  const { roster, s } = side
  const tables = FB_TABLES.map(T => {
    const men = roster.filter(p => {
      const x = s[p.k]
      if (!x || !T.ok(x)) return false
      if (T.ol) return p.pos === 'ol' && !!p.s
      if (T.def) return ['dl', 'lb', 'db'].includes(p.pos) || !!p.s
      return true
    })
    // (the builds first; then the most yards, the most tackles)
    men.sort((a, b) => (!!b.s - !!a.s) || (T.v(s[b.k]) - T.v(s[a.k])))
    return { T, rows: men.map(p => ({ k: p.k, mine: !!p.s, name: p.s ? p.n : shortName(p.n), pos: posTag(p, roster), cells: T.cells(s[p.k]) })) }
  }).filter(x => x.rows.length)
  return (
    <>
      {tables.map(({ T, rows }) => <StatTable key={T.k} title={T.k} head={T.head} rows={rows} cap={T.def ? 6 : 0} />)}
      {kick && <StatTable title="Kicking" head={['FG', 'XP', 'LONG']} rows={[{ k: 'k', name: shortName(kick.n), pos: 'K', mine: !!kick.mine, cells: [`${kick.line[1]}/${kick.line[0]}`, `${kick.line[3]}/${kick.line[2]}`, kick.line[4] || '—'] }]} />}
      {!tables.length && !kick && <p className="bx-none">No player lines were kept for this team.</p>}
    </>
  )
}

const BK_HEAD = ['MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG', '3PT']
const bkCells = x => [x.mn ?? '', x.pts ?? 0, x.reb ?? 0, x.ast ?? 0, x.stl ?? 0, x.blk ?? 0, `${x.fgm ?? 0}-${x.fga ?? 0}`, `${x.tpm ?? 0}-${x.tpa ?? 0}`]
function BucketBox({ r, game }) {
  const roster = r.roster, s = game.s
  // (the builds first, then the starters, then the bench; a man who didn't play isn't listed)
  const order = [...roster.filter(p => p.s), ...roster.filter(p => !p.s && p.spot != null), ...roster.filter(p => !p.s && p.spot == null)].filter(p => s[p.k]?.mn)
  return (
    <div className="bx-scroll">
      <div className="bx-t bx-t--bk" role="table" aria-label="Players">
        <div className="bx-t-row bx-t-head" role="row"><span className="bx-t-k">Player</span>{BK_HEAD.map(h => <span key={h}>{h}</span>)}</div>
        {order.map(p => {
          const x = s[p.k] ?? {}
          return (
            <div key={p.k} className={`bx-t-row${p.s ? ' is-mine' : ''}`} role="row">
              <span className="bx-t-name"><b>{p.s ? p.n : shortName(p.n)}</b><small>{roleOf(p, roster)}</small></span>
              {bkCells(x).map((c, i) => <span key={i}>{c}</span>)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// The sheet. (portal: over the page; false renders it in place. Franchise's game day reads its box score with it too:
// rows the team lines it shows, status the line under the score (a live game's clock), children more sections at the
// end, onClose none: no close button)
// (opp: the other team's men, { r, game } (Franchise); kick: the two kickers' lines [ours, theirs] ({ n, line }: FGA, FGM,
// XPA, XPM, long); quarters: the points by quarter [ours, theirs]; story: the line under the final, the way the
// broadcast sums the game up. `all` and `label` are kept for older callers: the builds are always in the tables now)
// (table: draws a team's men in place of the stock table, (side, index) => node; with it a basketball box takes `opp`
// too, both teams' men and each team's leaders: NBA Franchise. g.where: the header's game, in place of the stock one)
export function BoxSheet({ r, sport, g, box, owner, onClose = null, portal = true, rows = null, status = null, children = null, className = '', opp = null, kick = null, quarters = null, story = null, live = false, table = null, nick = null, logo = null }) {
  useEffect(() => {
    if (!onClose) return undefined
    const k = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const [tab, setTab] = useState(0)
  const game = (g.po ? box.po : box.reg)[g.i]
  if (!game) return null
  const oppTeam = teamOf(sport, g.opp)
  const where = g.where ?? (sport === 'bucket'
    ? (g.po ? `${g.round} · GAME ${g.gm}` : `GAME ${g.i + 1}`)
    : g.label)
  const otTxt = g.ot ? ` · ${g.ot > 1 ? `${g.ot}OT` : 'OT'}` : ''
  const sides = [{ team: r.team, roster: r.roster, s: game.s }, ...(opp && (sport !== 'bucket' || table) ? [{ team: g.opp, roster: opp.r.roster, s: opp.game.s }] : [])]
  const mineCount = sport === 'bucket' ? r.roster.filter(p => p.s && game.s[p.k]?.mn).length : r.roster.filter(p => p.s && game.s[p.k]).length
  const teamRows = rows ?? (sport === 'bucket' ? [
    ['Field goals', `${game.us.fgm}-${game.us.fga}`, `${game.them.fgm}-${game.them.fga}`],
    ['Field goal %', `${pct1(game.us.fgm, game.us.fga)}%`, `${pct1(game.them.fgm, game.them.fga)}%`],
    ['3-pointers', `${game.us.tpm}-${game.us.tpa}`, `${game.them.tpm}-${game.them.tpa}`],
    ['Free throws', `${game.us.ftm}-${game.us.fta}`, `${game.them.ftm}-${game.them.fta}`],
    ['Rebounds', game.us.reb, game.them.reb], ['Assists', game.us.ast, game.them.ast], ['Steals', game.us.stl, game.them.stl], ['Blocks', game.us.blk, game.them.blk], ['Turnovers', game.us.to, game.them.to],
  ] : [
    ['Total yards', game.us.yds, game.them.yds], ['Passing yards', game.us.py, game.them.py], ['Rushing yards', game.us.ry, game.them.ry],
    ['Touchdowns', game.us.td, game.them.td], ['Field goals', game.us.fg ?? 0, game.them.fg ?? 0], ['Turnovers', game.us.to, game.them.to], ['Times sacked', game.us.sk, game.them.sk],
  ])
  const side = sides[Math.min(tab, sides.length - 1)]
  const sheet = (
    <div className={`ss-overlay sq-box-overlay ${className}`} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="ss-sheet sq-box" role={portal ? 'dialog' : 'region'} aria-modal={portal ? 'true' : undefined} aria-labelledby="sq-box-title">
        <div className="ss-head">
          <span className="bx-where" id="sq-box-title">{where} · {g.vs ?? (g.home ? 'vs' : 'at')} {oppTeam?.name ?? g.oppName ?? g.opp}</span>
          {onClose && <button className="ss-close" onClick={onClose} aria-label="Close"><IconClose size={15} /></button>}
        </div>
        <LineScore sport={sport} us={r.team} them={g.opp} home={g.home} my={g.my} op={g.op} q={quarters} live={live} story={story} nick={nick} logo={logo}
          status={status ?? `${g.tie ? 'Final · tie' : 'Final'}${otTxt}`} />
        <TeamCompare sport={sport} us={r.team} them={g.opp} rows={teamRows} logo={logo} />
        <Leaders1 sport={sport} sides={sides} each={!!table && sides.length > 1} />
        <section className="bx-sec">
          <h3 className="bx-h">Player stats</h3>
          {sides.length > 1 ? (
            <div className="bx-seg" role="tablist" aria-label="Team">
              {sides.map((x, i) => (
                <button key={x.team} type="button" role="tab" aria-selected={side === x} className={side === x ? 'is-on' : ''} onClick={() => { setTab(i); sfx('tap') }}>
                  <img src={logo ? logo(x.team) : logoOf(sport, x.team)} alt="" />{nick ? nick(x.team) : nickOf(sport, x.team)}
                </button>
              ))}
            </div>
          ) : <p className="bx-team1"><img src={logoOf(sport, r.team)} alt="" />{nickOf(sport, r.team)}</p>}
          {side === sides[0] && mineCount > 0 && <p className="bx-key"><i aria-hidden="true" />{owner}&rsquo;s {mineCount === 1 ? 'build' : 'builds'}</p>}
          {table ? table(side, sides.indexOf(side))
            : sport === 'bucket'
            ? <BucketBox r={r} game={game} />
            : <TeamMen key={side.team} side={side} kick={kick?.[side === sides[0] ? 0 : 1] ?? null} />}
        </section>
        {children}
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
          <span className="ag-eyebrow">{team?.name ?? r.team}{r.pool === 'alltime' ? ' · ALL-TIME' : ''} · {inPo ? 'PLAYOFFS' : 'REGULAR SEASON'}</span>
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


// ── Soccer: the season as the side played it ────────────────────────────────
// The side first (the record, where it finished, what it won), then the builds' lines, the awards
// races, the men around them up front, the league table (the World Cup: the group), the cup and
// Europe (the knockouts), and every match (tap one for who scored).
const SOCCER_ROUND = { league: 'LEAGUE', cup: 'CUP', ucl: 'CHAMPIONS LEAGUE', uel: 'EUROPA LEAGUE', wc: 'WORLD CUP' }
const tieScore = x => {
  const [my, op] = x.agg ?? x.legs?.[0] ?? [0, 0]
  return `${my}-${op}${x.sh ? ` (${x.sh[0]}-${x.sh[1]} P)` : x.et ? ' AET' : ''}`
}
// who an award went to: a man of the squad's (a build by its name and the player's, a real teammate by his), or the field's
function winnerOf(w, r, owner) {
  if (!w) return null
  if (w.k) {
    const p = r.roster?.find(x => x.k === w.k)
    return { name: p?.n ?? '—', sub: p?.s ? `${p.tag} · ${owner}` : `${p?.tag ?? ''} · ${r.team}`, mine: !!p?.s, ours: true, team: r.team }
  }
  return { name: w.name, sub: w.team, team: w.team, mine: false, ours: false }
}
const SoccerHead = memo(function SoccerHead({ r }) {
  const team = teamOf('soccer', r.team, r.pool)
  return (
    <div className={`sq-hero ag-pop${r.champion ? ' is-champ' : ''}`} style={{ '--tc': team?.color ?? 'var(--ag-a1)' }}>
      <TeamCrest sport="soccer" short={r.team} pool={r.pool} className="sq-hero-logo" />
      <span className="sq-hero-txt">
        <span className="ag-eyebrow">{team?.name ?? r.team}{r.pool === 'alltime' ? ` · GROUP ${r.group ?? ''}` : r.league ? ` · ${r.league.name.toUpperCase()}` : ''}</span>
        <b className="sq-hero-rec">{r.wins}<i>–</i>{r.draws}<i>–</i>{r.losses}</b>
        <small className="sq-hero-out">{r.champion && <IconTrophy size={14} />} {outcome(r)}</small>
      </span>
    </div>
  )
})
const SoccerTeamLine = memo(function SoccerTeamLine({ r }) {
  const st = r.strength ?? {}
  const delta = (now, was) => { const a = teamGrade('soccer', now, r.pool), b = teamGrade('soccer', was, r.pool); return a === b ? null : <i className={(now ?? 0) > (was ?? 0) ? 'is-up' : 'is-down'}>from {b}</i> }
  const games = r.pool === 'alltime' ? (r.fx ?? []).length : (r.wins + r.draws + r.losses)
  const gf = r.pool === 'alltime' ? (r.fx ?? []).reduce((a, f) => a + f.my, 0) : r.gf
  const ga = r.pool === 'alltime' ? (r.fx ?? []).reduce((a, f) => a + f.op, 0) : r.ga
  const more = r.pool === 'alltime'
    ? [`${r.points} PTS IN THE GROUP`, `${r.trophies?.length ? 'WORLD CHAMPIONS' : (r.finish ?? '').toUpperCase()}`]
    : [`${r.points} PTS`, `GD ${r.gd > 0 ? '+' : ''}${r.gd}`, ...(r.trophies?.length ? [r.trophies.join(' · ').toUpperCase()] : [])]
  return (
    <section className="sq-card sq-tl ag-pop" style={{ '--d': '40ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE SIDE · {games} {r.pool === 'alltime' ? 'MATCHES' : 'LEAGUE MATCHES'}</span></div>
      <div className="sq-tl-cells">
        <span><small>SCORED</small><b>{gf}</b></span>
        <span><small>CONCEDED</small><b>{ga}</b></span>
        <span><small>ATTACK</small><b>{teamGrade('soccer', st.off, r.pool)}</b>{delta(st.off, st.baseOff)}</span>
        <span><small>DEFENCE</small><b>{teamGrade('soccer', st.def, r.pool)}</b>{delta(st.def, st.baseDef)}</span>
      </div>
      <p className="sq-tl-more">{more.filter(Boolean).join(' · ')}</p>
    </section>
  )
})
const soccerMore = (t, club) => [
  ...(club && t.allGoals !== t.goals ? [`${t.allGoals} ${t.allGoals === 1 ? 'GOAL' : 'GOALS'} ALL COMPS`] : []),
  `${fmt(t.mins)} MIN`, `${t.shots} SHOTS`, `${fmt(r1(t.xg))} xG`, ...(t.hatTricks ? [`${t.hatTricks} HAT-TRICK${t.hatTricks > 1 ? 'S' : ''}`] : []), ...(t.motm ? [`${t.motm} MOTM`] : []),
]
const SoccerLines = memo(function SoccerLines({ r, squad, owner }) {
  const bySlot = Object.fromEntries((squad?.slots ?? []).map(s => [s.id, s]))
  const club = r.pool !== 'alltime'
  return (
    <section className="sq-lines ag-pop" style={{ '--d': '80ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">{owner.toUpperCase()}'S BUILDS{club ? ' · LEAGUE' : ''}</span></div>
      {r.lines.map(l => {
        const t = r.tot?.[`b:${l.id}`] ?? {}
        return (
          <div key={l.id} className={`sq-line${l.awards?.length ? ' is-award' : ''}`}>
            <div className="sq-line-top">
              <Face src={l.face} name={l.tag} mine />
              <span className="sq-row-txt">
                <b>{l.name ?? 'Striker'}</b>
                <small>{l.tag} · {owner}{bySlot[l.id] ? '' : ' · cut'}</small>
              </span>
              {l.awards?.[0] && <span className="sq-award"><IconTrophy size={13} /> {l.awards[0].toUpperCase()}</span>}
              {!l.awards?.length && l.honor && <span className="sq-honor">{l.honor.split(' · ')[0]}</span>}
              <span className="sq-ovr"><b>{l.ovr}</b><small>OVR</small></span>
            </div>
            <div className="sq-stats">{l.stats.map(([k, v]) => <span key={k}><b>{fmt(v)}</b><small>{k}</small></span>)}</div>
            <p className="sq-line-more">{[...(l.awards ?? []).slice(1).map(a => a.toUpperCase()), ...(l.awards?.length && l.honor ? [l.honor] : !l.awards?.length && l.honor?.includes(' · ') ? [l.honor.split(' · ').slice(1).join(' · ')] : []), ...soccerMore(t, club)].join(' · ')}</p>
          </div>
        )
      })}
    </section>
  )
})
// the awards: who won each, and the Golden Boot race
const SoccerAwards = memo(function SoccerAwards({ r, owner }) {
  const A = r.awards ?? {}
  const rows = [A.boot, A.poty, A.bdo, A.ball].filter(Boolean)
  if (!rows.length) return null
  const raceName = x => { const w = winnerOf(x, r, owner); return w }
  return (
    <section className="sq-card ag-pop" style={{ '--d': '100ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE AWARDS</span></div>
      {rows.map(a => {
        const w = winnerOf(a.winner, r, owner)
        return (
          <div key={a.name} className={`sq-lead${w?.mine ? ' is-mine' : ''}`}>
            <span className="sq-lead-lbl">{a.name.toUpperCase()}</span>
            {w?.ours ? <Face src={photoFor('soccer', r.roster.find(p => p.k === a.winner.k), Object.fromEntries((r.lines ?? []).map(l => [l.id, l.face])))} name={w.name} mine={w.mine} size={28} /> : <TeamCrest sport="soccer" short={w?.team} pool={r.pool} className="sq-crest-sm" />}
            <span className="sq-lead-who"><b>{w?.mine ? w.name : lastName(w?.name)}</b><small>{w?.sub}{a.shared ? ' · SHARED' : ''}</small></span>
            {a.winner?.goals != null && <span className="sq-lead-val"><b>{a.winner.goals}</b><small>GOALS</small></span>}
          </div>
        )
      })}
      {A.race?.length > 0 && (
        <div className="sq-race">
          <span className="sq-mates-pos">{(A.boot?.name ?? 'GOLDEN BOOT').toUpperCase()} RACE</span>
          {A.race.map((x, i) => {
            const w = raceName(x)
            return (
              <div key={`${x.k ?? x.name}-${i}`} className={`sq-race-row${w?.mine ? ' is-mine' : ''}`}>
                <span className="sq-race-n">{i + 1}</span>
                <TeamCrest sport="soccer" short={x.team} pool={r.pool} className="sq-crest-sm" />
                <span className="sq-race-who"><b>{w?.mine ? w.name : lastName(w?.name)}</b>{w?.mine && <small>{w.sub}</small>}</span>
                <b className="sq-race-g">{x.goals}</b>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
})
// the men up front who aren't builds: the side's own forwards (and the goals of the rest of the XI)
const SoccerMates = memo(function SoccerMates({ r }) {
  const real = (r.roster ?? []).filter(p => !p.s)
  return (
    <section className="sq-card sq-mates ag-pop" style={{ '--d': '120ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">SURROUNDING TALENT</span></div>
      {real.map(p => {
        const t = r.tot?.[p.k] ?? {}, m = r.mates?.find(x => x.k === p.k)
        return (
          <div key={p.k} className="sq-mate">
            <Face src={photoFor('soccer', p)} name={p.n} size={26} />
            <span className="sq-mate-who"><b>{lastName(p.n)}</b><small>{p.tag} · {p.o}{m?.awards?.length ? ` · ${m.awards.join(', ').toUpperCase()}` : m?.honor ? ` · ${m.honor}` : ''}</small></span>
            <span className="sq-mate-line">{t.goals} G · {t.assists} A · {t.apps} APPS</span>
          </div>
        )
      })}
      <div className="sq-mate">
        <span className="tk-hs sq-face" style={{ width: 26, height: 26 }}>XI</span>
        <span className="sq-mate-who"><b>The rest of the XI</b><small>MIDFIELD AND DEFENCE</small></span>
        <span className="sq-mate-line">{r.others ?? 0} G</span>
      </div>
    </section>
  )
})
// the league table (the World Cup: the group), the side's row lit
const SoccerTable = memo(function SoccerTable({ r }) {
  const [all, setAll] = useState(false)
  const rows = r.standings ?? []
  if (!rows.length) return null
  const club = r.pool !== 'alltime'
  const me = rows.findIndex(x => x.short === r.team)
  const size = rows.length
  // (the top four, the side's place and the bottom three; FULL TABLE shows the lot)
  const shown = all || !club ? rows : rows.filter((x, i) => i < 4 || Math.abs(i - me) <= 1 || i >= size - 3)
  const zone = i => (!club ? (i < 2 ? ' is-up' : '') : i < 4 ? ' is-up' : i >= size - 3 ? ' is-down' : '')
  return (
    <section className="sq-card ag-pop" style={{ '--d': '140ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">{club ? (r.league?.name ?? 'THE LEAGUE').toUpperCase() : `GROUP ${r.group ?? ''}`}</span></div>
      <div className="sq-table" role="table">
        <div className="sq-table-row sq-table-head" role="row"><span>#</span><span>{club ? 'CLUB' : 'NATION'}</span><span>P</span><span>W</span><span>D</span><span>L</span><span>GD</span><span>PTS</span></div>
        {shown.map((x, j) => {
          const i = rows.indexOf(x)
          const gap = j > 0 && i - rows.indexOf(shown[j - 1]) > 1
          return (
            <div key={x.short} className={`sq-table-row${x.short === r.team ? ' is-mine' : ''}${zone(i)}${gap ? ' is-gap' : ''}`} role="row">
              <span>{x.pos ?? i + 1}</span>
              <span className="sq-table-team"><TeamCrest sport="soccer" short={x.short} pool={r.pool} className="sq-crest-sm" /><b>{x.name ?? x.short}</b></span>
              <span>{x.played}</span><span>{x.wins}</span><span>{x.draws}</span><span>{x.losses}</span><span>{x.gd > 0 ? `+${x.gd}` : x.gd}</span><b>{x.points}</b>
            </div>
          )
        })}
      </div>
      {club && size > shown.length && <button className="ag-btn ag-btn--ghost sq-more-btn" onClick={() => { setAll(true); sfx('tap') }}>FULL TABLE</button>}
      {club && all && <button className="ag-btn ag-btn--ghost sq-more-btn" onClick={() => { setAll(false); sfx('tap') }}>SHORT TABLE</button>}
    </section>
  )
})
// the cup and Europe (the World Cup: the knockouts), tie by tie
const SoccerCups = memo(function SoccerCups({ r }) {
  const ties = r.rounds ?? []
  const club = r.pool !== 'alltime'
  const groups = club
    ? [[r.cup?.name ?? 'CUP', ties.filter(x => x.comp === 'cup'), r.cup?.result], ...(r.europe ? [[r.europe.name, ties.filter(x => x.comp === r.europe.comp), r.europe.result, r.europe.position]] : [])]
    : [['THE KNOCKOUTS', ties, r.finish]]
  if (!groups.some(([, list, res]) => list.length || res)) return null
  return (
    <section className="sq-po ag-pop" style={{ '--d': '160ms' }}>
      {groups.map(([name, list, res, place]) => (
        <div key={name} className="sq-cup">
          <div className="ag-card-head"><span className="ag-eyebrow">{String(name).toUpperCase()}{res ? ` · ${String(res).toUpperCase()}` : ''}</span></div>
          {place != null && <p className="sq-cup-note">{soccerOrdinal(place)} in the league phase</p>}
          {list.map((x, i) => (
            <div key={i} className={`sq-po-row${x.won ? ' is-w' : ' is-l'}`}>
              <span>{String(x.name ?? '').toUpperCase()}</span>
              <TeamCrest sport="soccer" short={x.o} pool={r.pool} className="sq-crest-sm" />
              <span className="sq-cup-opp">{x.on ?? x.o}</span>
              <b>{tieScore(x)}</b>
            </div>
          ))}
          {!list.length && <p className="sq-cup-note">{club && name === r.europe?.name ? 'Out in the league phase' : 'No ties played'}</p>}
        </div>
      ))}
    </section>
  )
})
function SoccerGameRow({ g, r, onOpen }) {
  const Tag = onOpen ? 'button' : 'div'
  const res = g.won ? 'W' : g.drawn ? 'D' : 'L'
  return (
    <Tag className={`sq-game${g.won ? ' is-w' : g.drawn ? ' is-d' : ' is-l'}${g.po ? ' is-po' : ''}`} {...(onOpen && { onClick: () => onOpen(g), 'aria-label': `${g.label}, ${g.home ? 'vs' : 'at'} ${g.oppName ?? g.opp}, ${g.my} to ${g.op}` })}>
      <span className="sq-game-lbl">{g.comp === 'league' ? g.label : (SOCCER_ROUND[g.comp] === 'WORLD CUP' ? g.label : `${g.comp === 'cup' ? 'CUP' : g.comp.toUpperCase()} · ${g.label}`).replace('LEAGUE PHASE', 'LP').replace('MATCHDAY ', 'MD')}</span>
      <TeamCrest sport="soccer" short={g.opp} pool={r.pool} />
      <span className="sq-game-opp">{g.neutral || g.home ? 'v' : 'at'} {g.oppName ?? g.opp}</span>
      <b className="sq-game-res"><i>{res}</i> {g.my}-{g.op}{g.sh ? ` (${g.sh[0]}-${g.sh[1]} P)` : g.et ? ' AET' : ''}</b>
      {onOpen && <IconCaret dir="right" size={11} className="sq-game-go" />}
    </Tag>
  )
}
const SoccerSchedule = memo(function SoccerSchedule({ r, games, onOpen }) {
  const [comp, setComp] = useState('league')
  const club = r.pool !== 'alltime'
  const tabs = club ? [['league', 'LEAGUE'], ['cups', 'CUP AND EUROPE']] : null
  const shown = !club ? games : comp === 'league' ? games.filter(g => g.comp === 'league') : games.filter(g => g.comp !== 'league')
  return (
    <section className="sq-card ag-pop" style={{ '--d': '180ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">{club ? 'EVERY MATCH' : 'THE WORLD CUP'}</span></div>
      {tabs && (
        <div className="ag-seg sq-seg" role="tablist" aria-label="Competition">
          {tabs.map(([id, text]) => <button key={id} role="tab" aria-selected={comp === id} className={comp === id ? 'is-on' : ''} onClick={() => { setComp(id); sfx('tap') }}>{comp === id && <span className="ag-seg-pill" />}{text}</button>)}
        </div>
      )}
      <div className="sq-games">{shown.map(g => <SoccerGameRow key={g.i} g={g} r={r} onOpen={onOpen} />)}</div>
    </section>
  )
})
// one match: the score, and what each man up front did
function SoccerMatchSheet({ r, g, owner, faces, onClose }) {
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const men = soccerMatch(r, g.i)
  const ours = men.reduce((a, m) => a + m.goals, 0)
  const team = teamOf('soccer', r.team, r.pool)
  return createPortal(
    <div className="ss-overlay sq-box-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ss-sheet sq-box" role="dialog" aria-modal="true" aria-labelledby="sq-box-title">
        <div className="ss-head">
          <span className="ag-eyebrow">{g.label} · {g.neutral ? 'V' : g.home ? 'VS' : 'AT'} {(g.oppName ?? g.opp ?? '').toUpperCase()}</span>
          <button className="ss-close" onClick={onClose} aria-label="Close"><IconClose size={15} /></button>
        </div>
        <div className={`sq-box-score${g.won ? ' is-w' : ' is-l'}`} id="sq-box-title">
          <span className="sq-box-team"><TeamCrest sport="soccer" short={r.team} pool={r.pool} /><b>{r.team}</b></span>
          <span className="sq-box-pts"><b>{g.my}</b><i>–</i><b>{g.op}</b></span>
          <span className="sq-box-team"><TeamCrest sport="soccer" short={g.opp} pool={r.pool} /><b>{g.opp}</b></span>
          <span className="sq-box-final">{g.won ? 'WIN' : g.drawn ? 'DRAW' : 'LOSS'}{g.sh ? ` · ${g.sh[0]}-${g.sh[1]} ON PENS` : g.et ? ' · AFTER EXTRA TIME' : ''}</span>
        </div>
        <div className="sq-box-sec">
          <span className="sq-box-h">{(team?.name ?? r.team).toUpperCase()} UP FRONT</span>
          {men.map(({ p, mins, goals, assists, rating }) => (
            <div key={p.k} className={`sq-box-me${mins ? '' : ' is-dnp'}`}>
              <Face src={p.s ? faces[p.s] : photoFor('soccer', p)} name={p.s ? p.tag : p.n} mine={!!p.s} size={32} />
              <span className="sq-row-txt"><b>{p.s ? p.n : lastName(p.n)}</b><small>{p.tag}{p.s ? ` · ${owner}` : ''}</small></span>
              <span className="sq-box-me-cells">{mins
                ? [['MIN', mins], ['G', goals], ['A', assists], ['RTG', rating ? fmt(r1(rating)) : '—']].map(([k, v]) => <span key={k}><b>{v}</b><small>{k}</small></span>)
                : <span className="sq-bt-dnp">DID NOT PLAY</span>}</span>
            </div>
          ))}
          {g.my - ours > 0 && <p className="sq-cup-note">The rest of the XI: {g.my - ours} {g.my - ours === 1 ? 'goal' : 'goals'}</p>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
// the season playing out: the matches light up one by one and the points build; then the knockouts
function SoccerReveal({ r, games, onDone }) {
  const club = r.pool !== 'alltime'
  const main = useMemo(() => (club ? games.filter(g => g.comp === 'league') : games), [games, club])
  const [k, setK] = useState(0)
  const doneRef = useRef(onDone); doneRef.current = onDone
  useEffect(() => {
    let t, i = 0
    const step = club ? 2 : 1, every = club ? 140 : 520
    const tick = () => {
      i = Math.min(main.length, i + step); setK(i)
      if (i < main.length) { t = setTimeout(tick, every); return }
      sfx(r.champion ? 'claim' : 'tap')
      t = setTimeout(() => doneRef.current(), 1100)
    }
    t = setTimeout(tick, 400)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = main.slice(0, k)
  const w = shown.filter(g => g.won).length, d = shown.filter(g => g.drawn).length, l = shown.length - w - d
  const team = teamOf('soccer', r.team, r.pool)
  return (
    <div className="sq-reveal">
      <div className="sq-hero ag-pop" style={{ '--tc': team?.color ?? 'var(--ag-a1)' }}>
        <TeamCrest sport="soccer" short={r.team} pool={r.pool} className="sq-hero-logo" />
        <span className="sq-hero-txt">
          <span className="ag-eyebrow">{team?.name ?? r.team} · {club ? (r.league?.name ?? 'THE LEAGUE').toUpperCase() : 'THE WORLD CUP'}</span>
          <b className="sq-hero-rec">{w}<i>–</i>{d}<i>–</i>{l}</b>
          <small className="sq-hero-out">{k < main.length ? `${club ? 'MATCHWEEK' : 'MATCH'} ${k} OF ${main.length}${club ? ` · ${w * 3 + d} PTS` : ''}` : outcome(r)}</small>
        </span>
      </div>
      <section className="sq-po">
        <div className="sq-log sq-log--soccer" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${club ? Math.ceil(main.length / 2) : main.length}, 1fr)` }}>{main.map((g, i) => <i key={i} className={i < k ? (g.won ? 'is-w' : g.drawn ? 'is-d' : 'is-l') : ''} />)}</div>
        <div className="sq-games">{shown.slice(-4).reverse().map(g => <SoccerGameRow key={g.i} g={g} r={r} />)}</div>
      </section>
      <button className="ag-btn ag-btn--ghost sq-reveal-skip" onClick={() => { sfx('tap'); onDone() }}>SKIP TO THE RESULTS</button>
    </div>
  )
}
function SoccerResult({ squad, owner, rewards, reveal, onRevealed }) {
  const raw = squad.last
  const r = useMemo(() => ({ ...raw, rounds: raw.rounds ?? [], lines: raw.lines ?? [], roster: raw.roster ?? [], tot: raw.tot ?? {} }), [raw])
  const games = useMemo(() => scheduleOf(r), [r])
  const faces = useMemo(() => Object.fromEntries(r.lines.map(l => [l.id, l.face])), [r])
  const [playing, setPlaying] = useState(() => reveal && !reducedMotion())
  const finish = useCallback(() => { setPlaying(false); onRevealed?.() }, [onRevealed])
  useEffect(() => { if (reveal && !playing) onRevealed?.() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(null)
  const onOpen = useCallback(g => { setOpen(g); sfx('tap') }, [])
  const close = useCallback(() => setOpen(null), [])
  if (playing) return <SoccerReveal r={r} games={games} onDone={finish} />
  return (
    <>
      <SoccerHead r={r} />
      {r.sandbox && <p className="sq-note">SANDBOX squad: just for fun, no XP or coins.</p>}
      <SoccerTeamLine r={r} />
      <SoccerLines r={r} squad={squad} owner={owner} />
      {rewards}
      <SoccerAwards r={r} owner={owner} />
      <SoccerMates r={r} />
      <SoccerTable r={r} />
      <SoccerCups r={r} />
      <SoccerSchedule r={r} games={games} onOpen={onOpen} />
      {open && <SoccerMatchSheet r={r} g={open} owner={owner} faces={faces} onClose={close} />}
    </>
  )
}

// ── The whole result ─────────────────────────────────────────────────────────
// (soccer has its own: the table, the cup and Europe)
export function TeamResult(props) {
  return props.sport === 'soccer' ? <SoccerResult {...props} /> : <SquadTeamResult {...props} />
}
function SquadTeamResult({ sport, squad, owner, rewards, reveal = false, onRevealed }) {
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
          <span className="ag-eyebrow">{team?.name ?? r.team}{r.pool === 'alltime' ? ' · ALL-TIME' : ''}</span>
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
