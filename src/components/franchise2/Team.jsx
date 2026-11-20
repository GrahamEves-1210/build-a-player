import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GROUP, OFF_GROUPS, DEF_GROUPS, ST_GROUPS, OL_SPOTS, depthChart, startersOf, moveInChart, setGroup, resetChart, staleChart, strength, sideGrade, capSheet, TEAM, outText, jersey } from '../../lib/franchise2'
import { sfx, haptic } from '../../lib/juice'
import { Chyron, BigNum, fkVars, BackBar, LowerThird } from './kit'
import { Man, CapBar, PlayerPage, dealText, money, faceFor, posText } from './dparts'
import { hurtText } from '../../lib/franchise2/copy'
import { StaffStrip, StaffScreen } from './Staff'
import { revOf, useStaged } from './perf'
import TradeScreen, { TradeStrip } from './Trades'

// TEAM: the depth chart. The order the games play: the starters on top of each room, the men behind them in the
// order they come in. Tap a man to move him (up, down, to the top, to the room next door) or open his page.
// The cap on top; tap it for where the money goes.
// (a slow phone: the chart is worked out once per change to the franchise, and a tap redraws only the rows it
// changes: each row is a memo of plain values)
const ROOM_NAME = { qb: 'QUARTERBACKS', rb: 'RUNNING BACKS', wr: 'WIDE RECEIVERS', te: 'TIGHT ENDS', ol: 'OFFENSIVE LINE', edge: 'EDGE RUSHERS', dt: 'INTERIOR LINE', lb: 'LINEBACKERS', cb: 'CORNERBACKS', s: 'SAFETIES', k: 'KICKER' }
const NEXT_DOOR = { edge: 'dt', dt: 'edge', cb: 's', s: 'cb' }

export default function TeamTab({ F, act, owner, tradeGo = false, onTradeGo }) {
  const [side, setSide] = useState('off')
  const [pick, setPick] = useState(null)       // the man picked to move (his id)
  const [page, setPage] = useState(null)       // a man's page open
  const [cap, setCap] = useState(false)
  const [staff, setStaff] = useState(false)   // the coaching staff (Staff.jsx)
  const [trades, setTrades] = useState(tradeGo)   // trades (Trades.jsx); the Season tab's offer note opens it
  useEffect(() => { if (tradeGo) { setTrades(true); onTradeGo?.() } }, [tradeGo]) // eslint-disable-line react-hooks/exhaustive-deps
  const rev = revOf(F)
  // the chart, who starts and each man's row (the same lower-third Man draws), once per change to the franchise
  const D = useMemo(() => {
    const C = depthChart(F, F.team), L = startersOf(F, F.team)
    const starting = new Set(Object.values(L).map(p => p.i))
    // (each starter's slot: the line by its spots, LT to RT, whoever's filling in)
    const slotOf = new Map(Object.entries(L).map(([k, p]) => [p.i, k]))
    const rooms = {}
    for (const k of [...OFF_GROUPS, ...DEF_GROUPS, ...ST_GROUPS]) {
      let up = 0
      rooms[k] = C[k].map((p, i) => {
        const starts = starting.has(p.i)
        const slot = starts ? (k === 'ol' ? OL_SPOTS[+(slotOf.get(p.i) ?? 'ol1').slice(2) - 1] : `${GROUP[k].label}${up + 1}`) : `${i + 1}`
        if (starts) up++
        const size = starts ? 'm' : 's'
        return {
          id: p.i, i, starts, hurt: !!p.in, fill: !!p.fl && !starts, slot: p.in ? 'OUT' : slot,
          name: p.n, pos: posText(p), num: jersey(F, p), ovr: p.o, photo: faceFor(F, p, F.team, size === 's'), mine: p.b != null ? owner || 'GM' : null,
          line: p.in ? hurtText(F, p, outText) : p.rk === F.year ? `ROOKIE · ${dealText(p)}` : dealText(p), size,
        }
      })
      rooms[k].short = C[k].filter(p => !p.in).length < GROUP[k].n
    }
    // (a backup rated past the starter ahead of him: the chart's out of date, and one tap sets it by rating)
    let stale = null
    try { stale = staleChart(F)[0] ?? null } catch { stale = null }
    return { rooms, st: strength(F, F.team), stale }
  }, [F, rev, owner]) // eslint-disable-line react-hooks/exhaustive-deps
  const { rooms, st, stale } = D
  const groups = side === 'off' ? OFF_GROUPS : side === 'def' ? DEF_GROUPS : ST_GROUPS
  // (opening the tab: the first two rooms on the first frame, the rest a room a frame, so a phone shows the first
  // screenful sooner; offense and defense swap whole, in place)
  const shown = useStaged(cap || staff ? 0 : groups.length, 2)
  // (the rows' taps read the latest state through one stable function)
  const api = useRef(null)
  api.current = {
    tap: id => { setPick(cur => (cur === id ? null : id)); sfx('tap'); haptic('light') },
    page: id => { setPage(id); setPick(null); sfx('tap') },
    move: (id, to) => { act(X => moveInChart(X, id, to)); sfx('swap'); haptic('medium') },
    group: (id, k) => { act(X => setGroup(X, id, k)); setPick(null); sfx('swap') },
  }
  const run = useCallback((k, ...a) => api.current[k](...a), [])
  // a tap anywhere off the picked man (and his buttons) lets him go
  useEffect(() => {
    if (pick == null) return
    const off = e => { if (!e.target.closest?.('.fd-dc.is-pick')) setPick(null) }
    document.addEventListener('pointerdown', off, true)
    return () => document.removeEventListener('pointerdown', off, true)
  }, [pick])
  // (the header, the cap and the staff change only with the franchise: a tap on a row leaves them be)
  const top = useMemo(() => (
    <>
      <Chyron team={F.team} title="DEPTH CHART" right={`${st.ovr} OVR`} sub={`OFFENSE ${sideGrade(st.off)} · DEFENSE ${sideGrade(st.def)}`} />
      <div className="fd-team-top">
        <CapBar F={F} onClick={() => { setCap(true); sfx('tap') }} />
        <StaffStrip F={F} onOpen={() => { setStaff(true); sfx('tap') }} />
        <TradeStrip F={F} onOpen={() => { setTrades(true); sfx('tap') }} />
      </div>
    </>
  ), [F, rev, st]) // eslint-disable-line react-hooks/exhaustive-deps
  if (trades) return <TradeScreen F={F} act={act} owner={owner} onBack={() => { setTrades(false); sfx('back') }} />
  if (staff) return <StaffScreen F={F} act={act} owner={owner} onBack={() => { setStaff(false); sfx('back') }} />
  if (cap) return <CapScreen F={F} owner={owner} act={act} onBack={() => { setCap(false); sfx('back') }} page={page} setPage={setPage} />
  return (
    <div className="fd fk">
      {top}
      <div className="fd-seg" role="tablist">
        {[['off', 'OFFENSE'], ['def', 'DEFENSE'], ['st', 'SPECIAL TEAMS']].map(([k, label]) => <button key={k} role="tab" aria-selected={side === k} className={side === k ? 'is-on' : ''} onClick={() => { setSide(k); setPick(null); sfx('tap') }}>{label}</button>)}
      </div>
      {stale ? (
        <div className="fd-stale">
          <span><b>Depth chart out of date</b>{stale.better.n} ({stale.better.o}) is behind {stale.starter.n} ({stale.starter.o})</span>
          <button type="button" onClick={() => { act(X => resetChart(X)); setPick(null); sfx('flip') }}>Reset by rating</button>
        </div>
      ) : <p className="fd-hint">Tap a player to move him</p>}
      <div className="fd-rooms">
      {groups.slice(0, shown).map((k, gi) => {
        const men = rooms[k]
        return (
          <section key={k} className="fd-room" style={{ '--d': `${gi * 40}ms` }}>
            <div className="fd-room-h"><b>{ROOM_NAME[k]}</b><small>{men.length}</small></div>
            {men.map(r => <DcRow key={r.id} {...r} team={F.team} last={men.length - 1} on={pick === r.id} next={NEXT_DOOR[k]} run={run} />)}
            {men.short && <div className="fd-dc fd-dc--empty"><span className="fd-dc-slot">+</span><span className="fd-empty">{NEXT_DOOR[k] ? `A ${GROUP[NEXT_DOOR[k]].label} FILLS IN` : 'SHORT A MAN'}</span></div>}
          </section>
        )
      })}
      </div>
      <button className="fd-reset" onClick={() => { act(X => resetChart(X)); setPick(null); sfx('flip') }}>Reset the chart by rating</button>
      {page != null && <PlayerPage F={F} id={page} owner={owner} act={act} onClose={() => setPage(null)} />}
    </div>
  )
}
// one man on the chart: his slot, his lower-third and (picked) what he can do
const DcRow = memo(function DcRow({ id, i, last, starts, hurt, fill, slot, on, next, run, team, name, pos, num, ovr, photo, mine, line, size }) {
  return (
    <div className={`fd-dc${starts ? ' is-start' : ''}${on ? ' is-pick' : ''}${hurt ? ' is-hurt' : ''}${fill ? ' is-fill' : ''}`}>
      <span className="fd-dc-slot">{slot}</span>
      <LowerThird name={name} pos={pos} num={num} ovr={ovr} photo={photo} team={team} mine={mine} line={line} size={size} onClick={() => run('tap', id)} />
      {on && (
        <div className="fd-dc-acts">
          <button onClick={() => run('page', id)}>Player page</button>
          <button disabled={i === 0} onClick={() => run('move', id, 0)}>To the top</button>
          <button disabled={i === 0} onClick={() => run('move', id, i - 1)}>▲ Up</button>
          <button disabled={i === last} onClick={() => run('move', id, i + 1)}>▼ Down</button>
          {next && <button onClick={() => run('group', id, next)}>Move to {GROUP[next].label}</button>}
        </div>
      )}
    </div>
  )
})

// ── THE CAP: where the money goes ────────────────────────────────────────────
function CapScreen({ F, owner, act, onBack, page, setPage }) {
  const t = F.teams[F.team], c = capSheet(F)
  const paid = t.r.filter(p => p.y > 0).sort((a, b) => b.$ - a.$)
  const top = paid.slice(0, 10)
  const share = Math.round((top.slice(0, 3).reduce((a, p) => a + p.$, 0) / c.cap) * 100)
  const next = t.r.filter(p => p.y === 1 && !p.fl).sort((a, b) => b.o - a.o)
  return (
    <div className="fd fk fd-narrow">
      <BackBar label="Depth chart" title="Salary cap" onBack={onBack} />
      <Chyron team={F.team} title="THE CAP" tag={c.year} sub={`${TEAM[F.team].nick.toUpperCase()} · ${paid.length} UNDER CONTRACT`} />
      <div className="fd-capbig" style={fkVars(F.team)}>
        {c.nocap ? <BigNum v="OFF" label="SALARY CAP" size={76} /> : <BigNum v={Math.abs(c.room) < 10 ? (Math.round(Math.abs(c.room) * 10) / 10).toFixed(1) : Math.round(Math.abs(c.room))} label={c.room < 0 ? '$M OVER THE CAP' : '$M CAP ROOM'} count={Math.abs(c.room) >= 10} size={76} tone={c.room < 0 ? 'l' : undefined} />}
        <span className="fd-capbig-r"><BigNum v={Math.round(c.used)} label="$M USED" size={34} /><BigNum v={share} label="% ON THE TOP 3" size={34} /></span>
      </div>
      <CapBar F={F} />
      {/* (the sum, line by line: what a first-time GM adds up against the bar) */}
      <Chyron tone="ink" size="s" title="WHERE THE MONEY GOES" />
      <div className="fd-line"><b>{c.year} salary cap</b><span>{money(c.base)}</span></div>
      {c.carry > 0 && <div className="fd-line"><b>Carried over from {c.year - 1} (room not used)</b><span>+{money(c.carry)}</span></div>}
      <div className="fd-line"><b>{paid.length} players under contract</b><span>{money(c.pay)}</span></div>
      {c.dead > 0 && <div className="fd-line"><b>Dead money (released or traded players)</b><span>{money(c.dead)}</span></div>}
      <div className="fd-line"><b>Rest of the 53: {Math.max(0, 53 - paid.length)} more roster spots, the punter, long snapper and practice squad</b><span>{money(c.rest)}</span></div>
      {!c.nocap && <div className="fd-line"><b>{c.room < 0 ? 'Over the cap' : 'Cap room'}</b><span>{c.room < 0 ? `-${money(-c.room)}` : money(c.room)}</span></div>}
      {!c.nocap && <p className="fd-cap-note">Room left unused at the end of the season carries over to next year's cap, up to a tenth of the cap.</p>}
      <Chyron tone="ink" size="s" title="BIGGEST CAP HITS" />
      {top.map((p, i) => <Man key={p.i} F={F} p={p} s={F.team} owner={owner} size="s" stat={{ v: money(p.$), label: `${p.y} ${p.y === 1 ? 'YR' : 'YRS'}` }} line={p.rc ? 'ROOKIE DEAL' : null} onClick={() => setPage(p.i)} delay={i * 30} />)}
      {c.dead > 0 && (
        <>
          <Chyron tone="ink" size="s" title="DEAD MONEY" right={money(c.dead)} />
          {(t.dead ?? []).map(([n, v], i) => <div key={i} className="fd-line"><b>{n}</b><span>{money(v)}</span></div>)}
        </>
      )}
      {next.length > 0 && (
        <>
          <Chyron tone="ink" size="s" title="DEALS UP AFTER THIS SEASON" right={next.length} />
          {next.slice(0, 8).map(p => <Man key={p.i} F={F} p={p} s={F.team} owner={owner} size="s" stat={{ v: money(p.$), label: 'FINAL YEAR' }} onClick={() => setPage(p.i)} />)}
        </>
      )}
      {page != null && <PlayerPage F={F} id={page} owner={owner} act={act} onClose={() => setPage(null)} />}
    </div>
  )
}
