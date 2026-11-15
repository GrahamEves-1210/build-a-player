import { useState } from 'react'
import { GROUP, OFF_GROUPS, DEF_GROUPS, OL_SPOTS, depthChart, startersOf, moveInChart, setGroup, resetChart, strength, sideGrade, capSheet, TEAM, outText } from '../../lib/franchise2'
import { sfx, haptic } from '../../lib/juice'
import { Chyron, BigNum, fkVars, BackBar } from './kit'
import { Man, CapBar, PlayerPage, dealText, money } from './dparts'
import { StaffStrip, StaffScreen } from './Staff'

// TEAM: the depth chart. The order the games play: the starters on top of each room, the men behind them in the
// order they come in. Tap a man to move him (up, down, to the top, to the room next door) or open his page.
// The cap on top; tap it for where the money goes.
const ROOM_NAME = { qb: 'QUARTERBACKS', rb: 'RUNNING BACKS', wr: 'WIDE RECEIVERS', te: 'TIGHT ENDS', ol: 'OFFENSIVE LINE', edge: 'EDGE RUSHERS', dt: 'INTERIOR LINE', lb: 'LINEBACKERS', cb: 'CORNERBACKS', s: 'SAFETIES' }
const NEXT_DOOR = { edge: 'dt', dt: 'edge', cb: 's', s: 'cb' }

export default function TeamTab({ F, act, owner }) {
  const [side, setSide] = useState('off')
  const [pick, setPick] = useState(null)       // the man picked to move (his id)
  const [page, setPage] = useState(null)       // a man's page open
  const [cap, setCap] = useState(false)
  const [staff, setStaff] = useState(false)   // the coaching staff (Staff.jsx)
  const C = depthChart(F, F.team), L = startersOf(F, F.team)
  const st = strength(F, F.team)
  const starting = new Set(Object.values(L).map(p => p.i))
  const groups = side === 'off' ? OFF_GROUPS : DEF_GROUPS
  const tap = p => { setPick(pick === p.i ? null : p.i); sfx('tap'); haptic('light') }
  const move = to => { const id = pick; act(X => moveInChart(X, id, to)); sfx('swap'); haptic('medium') }
  if (staff) return <StaffScreen F={F} act={act} owner={owner} onBack={() => { setStaff(false); sfx('back') }} />
  if (cap) return <CapScreen F={F} owner={owner} act={act} onBack={() => { setCap(false); sfx('back') }} page={page} setPage={setPage} />
  return (
    <div className="fd fk">
      <Chyron team={F.team} title="DEPTH CHART" tag={F.year} right={`${st.ovr} OVR`} sub={`OFFENSE ${sideGrade(st.off)} · DEFENSE ${sideGrade(st.def)} · TAP A PLAYER TO MOVE HIM`} />
      <div className="fd-team-top">
        <CapBar F={F} onClick={() => { setCap(true); sfx('tap') }} />
        <StaffStrip F={F} onOpen={() => { setStaff(true); sfx('tap') }} />
      </div>
      <div className="fd-seg" role="tablist">
        {[['off', 'OFFENSE'], ['def', 'DEFENSE']].map(([k, label]) => <button key={k} role="tab" aria-selected={side === k} className={side === k ? 'is-on' : ''} onClick={() => { setSide(k); setPick(null); sfx('tap') }}>{label}</button>)}
      </div>
      <div className="fd-rooms">
      {groups.map((k, gi) => {
        const men = C[k], n = GROUP[k].n
        let up = 0
        return (
          <section key={k} className="fd-room" style={{ '--d': `${gi * 40}ms` }}>
            <div className="fd-room-h"><b>{ROOM_NAME[k]}</b><small>{men.length}</small></div>
            {men.map((p, i) => {
              const starts = starting.has(p.i)
              const slot = starts ? (k === 'ol' ? OL_SPOTS[up] : `${GROUP[k].label}${up + 1}`) : `${i + 1}`
              if (starts) up++
              const on = pick === p.i
              return (
                <div key={p.i} className={`fd-dc${starts ? ' is-start' : ''}${on ? ' is-pick' : ''}${p.in ? ' is-hurt' : ''}`}>
                  <span className="fd-dc-slot">{p.in ? 'OUT' : slot}</span>
                  <Man F={F} p={p} s={F.team} owner={owner} size={starts ? 'm' : 's'} line={p.in ? outText(p) : p.rk === F.year ? `ROOKIE · ${dealText(p)}` : dealText(p)} onClick={() => tap(p)} />
                  {on && (
                    <div className="fd-dc-acts">
                      <button onClick={() => { setPage(p.i); setPick(null); sfx('tap') }}>Player page</button>
                      <button disabled={i === 0} onClick={() => move(0)}>To the top</button>
                      <button disabled={i === 0} onClick={() => move(i - 1)}>▲ Up</button>
                      <button disabled={i === men.length - 1} onClick={() => move(i + 1)}>▼ Down</button>
                      {NEXT_DOOR[k] && <button onClick={() => { act(X => setGroup(X, p.i, NEXT_DOOR[k])); setPick(null); sfx('swap') }}>Move to {GROUP[NEXT_DOOR[k]].label}</button>}
                    </div>
                  )}
                </div>
              )
            })}
            {men.filter(p => !p.in).length < n && <div className="fd-dc fd-dc--empty"><span className="fd-dc-slot">+</span><span className="fd-empty">{NEXT_DOOR[k] ? `A ${GROUP[NEXT_DOOR[k]].label} FILLS IN` : 'SHORT A MAN'}</span></div>}
          </section>
        )
      })}
      </div>
      <button className="fd-reset" onClick={() => { act(X => resetChart(X)); setPick(null); sfx('flip') }}>Reset the chart by rating</button>
      {page != null && <PlayerPage F={F} id={page} owner={owner} act={act} onClose={() => setPage(null)} />}
    </div>
  )
}

// ── THE CAP: where the money goes ────────────────────────────────────────────
function CapScreen({ F, owner, act, onBack, page, setPage }) {
  const t = F.teams[F.team], c = capSheet(F)
  const paid = t.r.filter(p => p.y > 0).sort((a, b) => b.$ - a.$)
  const top = paid.slice(0, 10)
  const share = Math.round((top.slice(0, 3).reduce((a, p) => a + p.$, 0) / c.cap) * 100)
  const next = t.r.filter(p => p.y === 1).sort((a, b) => b.o - a.o)
  return (
    <div className="fd fk fd-narrow">
      <BackBar label="Depth chart" title="Salary cap" onBack={onBack} />
      <Chyron team={F.team} title="THE CAP" tag={c.year} sub={`${TEAM[F.team].nick.toUpperCase()} · ${paid.length} UNDER CONTRACT`} />
      <div className="fd-capbig" style={fkVars(F.team)}>
        <BigNum v={Math.round(Math.abs(c.room))} label={c.room < 0 ? '$M OVER THE CAP' : '$M CAP ROOM'} size={76} tone={c.room < 0 ? 'l' : undefined} />
        <span className="fd-capbig-r"><BigNum v={Math.round(c.used)} label="$M USED" size={34} /><BigNum v={share} label="% ON THE TOP 3" size={34} /></span>
      </div>
      <CapBar F={F} />
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
          {next.slice(0, 8).map(p => <Man key={p.i} F={F} p={p} s={F.team} owner={owner} size="s" stat={{ v: money(p.$), label: 'NOW' }} onClick={() => setPage(p.i)} />)}
        </>
      )}
      {page != null && <PlayerPage F={F} id={page} owner={owner} act={act} onClose={() => setPage(null)} />}
    </div>
  )
}
