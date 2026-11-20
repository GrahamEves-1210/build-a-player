import { useState } from 'react'
import { TEAM, POS_LABEL, campCuts, campCut, cutCost, cutRoom, capSheet, capOver, capCuts, capCut } from '../../lib/franchise2'
import { sfx, haptic } from '../../lib/juice'
import { Chyron, Go, ActionBar } from './kit'
import { Man, CapBar, PlayerPage, money } from './dparts'
import './cuts.css'

// THE CUT-DOWN (2026-11-19, players' reports: "releases should be manual"): after the draft, before the new season,
// every room on the player's team has to fit its limit. The game never cuts his men: he picks who goes, and sees
// what each release leaves on the cap (lib/franchise2/offseason.js campCuts, campCut). The league's teams cut their own.
// props: onDone, the new season (shown once no room is over its limit)
const ROOM = { qb: 'QUARTERBACKS', rb: 'RUNNING BACKS', wr: 'WIDE RECEIVERS', te: 'TIGHT ENDS', ol: 'OFFENSIVE LINE', dl: 'DEFENSIVE LINE', lb: 'LINEBACKERS', db: 'SECONDARY', k: 'KICKERS' }
const lastName = n => String(n).split(' ').filter(w => !/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(w)).slice(-1)[0] ?? n
export function CutDown({ F, act, owner, onDone }) {
  const [pick, setPick] = useState(null)
  const [page, setPage] = useState(null)
  const rooms = campCuts(F)
  const left = rooms.reduce((a, r) => a + r.have - r.max, 0)
  const gone = (F.fa ?? []).filter(p => p.cc)
  // (the season can't start over the cap: the front office restructures what it can when it starts, the rest is his)
  const cap = capSheet(F), over = left ? 0 : capOver(F), capMen = over ? capCuts(F) : []
  const man = pick != null ? [...rooms.flatMap(r => r.men), ...capMen.map(x => x.p)].find(p => p.i === pick) : null
  const c = man ? cutCost(man) : null
  const saves = man ? cutRoom(F, man) : 0
  const savesText = v => (v > 0 ? `saves ${money(v)} in cap room` : v < 0 ? `costs ${money(-v)} in cap room` : 'no cap savings')
  const release = () => {
    if (!man) return
    act(X => (campCuts(X).some(r => r.men.some(p => p.i === man.i)) ? campCut(X, man.i) : capCut(X, man.i)))
    setPick(null); sfx('swap'); haptic('medium')
  }
  return (
    <div className="fct fk">
      <Chyron team={F.team} title="ROSTER CUTS" tag={F.year + 1} size="l" sub={left ? `${TEAM[F.team].nick.toUpperCase()} · ${left} ${left === 1 ? 'PLAYER' : 'PLAYERS'} TO RELEASE · TAP ONE` : `${TEAM[F.team].nick.toUpperCase()} · THE ROSTER IS SET`} />
      <CapBar F={F} />
      {rooms.map(r => (
        <section key={r.pos} className="fct-room">
          <Chyron tone="ink" size="s" title={ROOM[r.pos] ?? POS_LABEL[r.pos]} sub={`${r.have} ON THE ROSTER · ROOM FOR ${r.max}`} right={`CUT ${r.have - r.max}`} />
          {[...r.men].sort((a, b) => b.o - a.o).map(p => {
            const k = cutCost(p)
            // (his deal and what cutting him leaves on the cap, in its own strip: the lower-third's line is too short for it)
            return (
              <div key={p.i} className={`fct-man${pick === p.i ? ' is-picked' : ''}`}>
                <Man F={F} p={p} s={F.team} owner={owner} size="m" line={`AGE ${p.ag}`} onClick={() => { setPick(x => (x === p.i ? null : p.i)); sfx('tap') }} />
                <div className="fct-cost"><span>{p.y > 0 ? `${money(p.$)} · ${p.y} ${p.y === 1 ? 'YR' : 'YRS'} LEFT` : 'DEAL UP'}</span><b className={k.dead > 0 ? 'fct-dead' : ''}>{k.dead > 0 ? `${money(k.dead)} DEAD IF CUT` : 'NO DEAD MONEY'}</b></div>
              </div>
            )
          })}
        </section>
      ))}
      {capMen.length > 0 && (
        <section className="fct-room">
          <Chyron tone="ink" size="s" title="OVER THE CAP" sub={`${money(over)} TO CLEAR BEFORE THE SEASON · THE RELEASES THAT SAVE THE MOST`} />
          {capMen.map(({ p, saves: v }) => {
            const k = cutCost(p)
            return (
              <div key={p.i} className={`fct-man${pick === p.i ? ' is-picked' : ''}`}>
                <Man F={F} p={p} s={F.team} owner={owner} size="m" line={`AGE ${p.ag}`} onClick={() => { setPick(x => (x === p.i ? null : p.i)); sfx('tap') }} />
                <div className="fct-cost"><span>{`${money(p.$)} · ${p.y} ${p.y === 1 ? 'YR' : 'YRS'} LEFT`}</span><b className={k.dead > 0 ? 'fct-dead' : ''}>{`SAVES ${money(v)}${k.dead > 0 ? ` · ${money(k.dead)} DEAD` : ''}`}</b></div>
              </div>
            )
          })}
        </section>
      )}
      {gone.length > 0 && (
        <section className="fct-room">
          <Chyron tone="ink" size="s" title="RELEASED" right={gone.length} />
          {gone.map(p => <Man key={p.i} F={F} p={p} s={F.team} owner={owner} size="s" line={`AGE ${p.ag} · FREE AGENT`} onClick={() => setPage(p.i)} />)}
        </section>
      )}
      {man ? (
        <ActionBar className="fct-act">
          <p className="fct-what"><b>{man.n}</b>{c.dead > 0 ? ` · ${money(c.dead)} dead money` : ' · no dead money'}{cap.nocap ? '' : ` · ${savesText(saves)}`}</p>
          <div className="fct-two">
            <Go onClick={release}>Release {lastName(man.n)}</Go>
            <Go ghost onClick={() => { setPick(null); sfx('back') }}>Keep him</Go>
          </div>
        </ActionBar>
      ) : (
        <ActionBar><Go onClick={() => { if (!left && !over) onDone() }} disabled={left > 0 || over > 0} sub={left ? `RELEASE ${left} MORE TO GET TO THE LIMIT` : over ? `${money(over)} OVER THE CAP · RELEASE A PLAYER TO GET UNDER` : null}>Start the {F.year + 1} season</Go></ActionBar>
      )}
      {page != null && <PlayerPage F={F} id={page} owner={owner} onClose={() => setPage(null)} />}
    </div>
  )
}
