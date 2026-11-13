import { useMemo } from 'react'
import { Panel, Switch, Seg, Steps, GradeRow } from './frUi'

// FRANCHISE: OFFICE. The GM's own desk: the owner (the goals, the job's security), the coaching staff, the cap,
// and the league's settings (changeable all season).
// SEAMS for the agents that come next (each is a panel or a screen opened from here; the selectors are ready):
//   TRADES          FR.tradeBlock / tradeAssets / tradeVerdict / proposeTrade
//   FREE AGENTS     FR.freeAgents / signFreeAgent
//   SCOUTING        FR.draftBoard / scoutProspect
//   STAFF MARKET    FR.coachMarket / hireCoach / fireCoach / hireBuiltCoach (./coach/CoachBuild.jsx builds one)
//   HISTORY         FR.history
// The offseason's own screens hang off the hub (FranchiseMode.jsx: ./offseason/Offseason.jsx).

export default function FrOffice({ FR, F, hub, act }) {
  const staff = useMemo(() => { try { return FR.staff(F) } catch { return null } }, [FR, F])
  const cap = useMemo(() => { try { return FR.capSheet(F) } catch { return null } }, [FR, F])
  const s = FR.settingsOf(F)
  const set = (k, v) => act(f => FR.setSetting(f, k, v))
  const owner = hub.owner, gm = hub.gm
  const coaches = [staff?.hc, staff?.oc, staff?.dc].filter(Boolean)
  return (
    <div className="fr-page">
      <div className="fr-cols is-even">
        <div className="fr-col">
          <Panel title="General manager" meta={String(gm.name).toUpperCase()}>
            <div className="fr-kv"><span>JOB SECURITY</span><b className="is-text">{owner?.word ?? gm.securityWord ?? ''} <Steps value={owner?.security ?? gm.security ?? 0} low={owner?.floor ?? 20} label={`Job security ${Math.round(owner?.security ?? gm.security ?? 0)} of 100`} /></b></div>
            <div className="fr-kv"><span>RECORD</span><b>{gm.record ?? '0-0'}</b></div>
            <div className="fr-kv"><span>CHAMPIONSHIPS</span><b className={gm.rings > 0 ? 'fr-t-gold' : undefined}>{gm.rings ?? 0}</b></div>
            {(owner?.goals ?? []).map(g => <div key={g.id} className="fr-kv"><span className="is-wrap">{String(g.text).toUpperCase()}</span><b className={`is-text${g.done === false ? ' fr-t-dim' : ''}`}>{g.done === true ? 'MET' : g.done === false ? 'MISSED' : g.progress}</b></div>)}
          </Panel>
          <Panel title="Coaching staff" meta={staff?.budget ? `${FR.moneyText(staff.budget.left)} LEFT` : null}>
            {coaches.map(c => (
              <div key={c.role} className="fr-coach">
                <div className="fr-row"><span className="fr-row-main">{c.name}<small>{String(c.roleName ?? c.role).toUpperCase()}{c.built ? ' · BUILT' : ''}{c.yrs ? ` · ${c.yrs} ${c.yrs === 1 ? 'YEAR' : 'YEARS'}` : ''}</small></span><b className="fr-t-num">{c.grade}</b></div>
                {c.role === 'HC' && c.ratings?.map(r => <GradeRow key={r.key} label={r.label} grade={r.grade} v={r.val} />)}
              </div>
            ))}
            {!coaches.length && <div className="fr-empty">NO STAFF ON FILE</div>}
          </Panel>
        </div>
        <div className="fr-col">
          {cap && (
            <Panel title="Salary cap" meta={cap.on ? String(F.year) : 'OFF'}>
              <div className="fr-kv"><span>CAP</span><b>{FR.moneyText(cap.cap)}</b></div>
              <div className="fr-kv"><span>PAYROLL</span><b>{FR.moneyText(cap.payroll)}</b></div>
              {cap.dead > 0 && <div className="fr-kv"><span>DEAD MONEY</span><b>{FR.moneyText(cap.dead)}</b></div>}
              <div className="fr-kv"><span>ROOM</span><b className={cap.space < 0 ? 'fr-t-red' : undefined}>{FR.moneyText(cap.space)}</b></div>
              {/* (no later year is named until it has been played: the seasons ahead by how far off they are) */}
              {cap.next?.map((n, i) => <div key={n.year} className="fr-kv"><span>{['NEXT SEASON', 'IN TWO SEASONS', 'IN THREE SEASONS'][i] ?? 'LATER'}</span><b>{FR.moneyText(n.committed)}</b></div>)}
            </Panel>
          )}
          <Panel title="League settings">
            <Switch label="Play the Moments" note="THE BIGGEST PLAYS, AS MINI GAMES" on={s.moments} onChange={v => { set('moments', v); set('calls', v) }} />
            <Switch label="Injuries" on={s.injuries} onChange={v => set('injuries', v)} />
            <Switch label="Salary cap" on={s.cap} onChange={v => set('cap', v)} />
            <Switch label="The owner can fire the GM" on={s.firing} onChange={v => set('firing', v)} />
            <div className="fr-row fr-row--seg"><span className="fr-row-main">Trades</span><Seg label="Trade difficulty" options={[['easy', 'EASY'], ['fair', 'FAIR'], ['hard', 'HARD']]} value={s.tradeAI} onChange={v => set('tradeAI', v)} /></div>
          </Panel>
          <Panel title="The staff handles">
            <Switch label="Depth chart" note="RE-SET EVERY WEEK" on={s.autoDepth} onChange={v => set('autoDepth', v)} />
            <Switch label="Upgrade points" note="SPENT AS THEY ARE EARNED" on={s.autoUpgrade} onChange={v => set('autoUpgrade', v)} />
            <Switch label="Roster holes" note="A SIGNING WHEN A SPOT IS SHORT" on={s.autoRoster} onChange={v => set('autoRoster', v)} />
          </Panel>
        </div>
      </div>
    </div>
  )
}
