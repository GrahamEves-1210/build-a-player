import { useMemo, useRef, useState } from 'react'
import { Panel, FrTable, FrSheet, FrSheetHead, GradeRow, Seg, Confirm, Logo, useWide } from '../frUi'
import { teamOf } from '../frTeams'
import CoachBuild from '../coach/CoachBuild'
import { Frame, useOff } from './frame'
import { Fact, Sub, Five, Bar, Pips, Who, safe, up, plural, tap } from './offUi'

// OFFSEASON 3 · STAFF (DESIGN.md section 8; the engine's staff stage). The head coach and the two coordinators
// with their five grades and their deals; who was hired away; fire and hire from the market of real coaches
// against ownership's coaching budget; BUILD A COACH (coach/CoachBuild.jsx) for the head job; the scouting
// director; the GM's own tree, bought with the staff points the owner's goals paid.
// Leaving the stage, the engine fills any job still open and renews a deal that ran out.

const ROLES = ['HC', 'OC', 'DC']
const JOB = { HC: 'HEAD COACH', OC: 'OFFENSIVE COORDINATOR', DC: 'DEFENSIVE COORDINATOR' }
const job = r => JOB[r].toLowerCase()
const ASK_AS = { HC: 'asHC', OC: 'asOC', DC: 'asDC' }
const callsText = c => (c.role === 'HC' ? (c.calls === 'off' ? 'CALLS THE OFFENSE' : c.calls === 'def' ? 'CALLS THE DEFENSE' : null) : c.calls ? 'CALLS THE PLAYS' : null)

export default function Staff() {
  const { FR, F, o, act, move } = useOff()
  const v = o.view, st = v.staff, money = FR.moneyText
  const wide = useWide()
  const [role, setRole] = useState('HC')        // the job the market is being read for
  const [cid, setCid] = useState(null)          // the coach whose sheet is open
  const [ask, setAsk] = useState(null)          // { kind: 'fire' | 'hire', role, coach }
  const [building, setBuilding] = useState(false)
  const market = useRef(null)
  const expired = r => v.market.openings.some(x => x.role === r && x.expired)
  const card = useMemo(() => (cid == null ? null : safe(() => FR.coachCard(F, cid))), [FR, F, cid])
  const kept = useRef(null); if (card) kept.current = card
  const c = card ?? kept.current
  const row = c ? v.market.coaches.find(x => x.id === c.id) ?? null : null
  const toMarket = r => { setRole(r); requestAnimationFrame(() => market.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })) }
  const run = fn => act(fn, { say: true })

  if (building) {
    return <CoachBuild team={F.team} onBack={() => setBuilding(false)} onDone={coach => { setBuilding(false); if (coach) run(f => FR.hireBuiltCoach(f, { name: coach.name, build: coach.build, identity: coach.identity })) }} />
  }
  const cols = [
    { k: 'name', label: 'COACH', val: r => r.name, render: r => <Who name={r.name} sub={`AGE ${r.age} · BEST AS ${r.best}${r.wants === 'HC' ? ' · HEAD JOBS ONLY' : ''}`} /> },
    { k: 'ovr', label: `AS ${role}`, w: 58, align: 'r', cls: 'fr-t-num', val: r => r.ovrAs[role] },
    ...(wide ? r5.map(([k, short]) => ({ k, label: short, w: 48, align: 'c', cls: 'fr-t-lab', val: r => r.ratings.find(x => x.key === k)?.val ?? 0, render: r => r.ratings.find(x => x.key === k)?.grade })) : []),
    { k: 'ask', label: 'ASKS', w: 68, align: 'r', cls: 'fr-t-num', val: r => r.ask[ASK_AS[role]], render: r => money(r.ask[ASK_AS[role]]) },
    { k: 'int', label: 'INTEREST', w: wide ? 110 : 62, align: 'r', val: r => r.interest, render: r => <>{wide && <Bar v={r.interest} team />}<span className="fr-t-num">{r.interest}</span></> },
  ]
  return (
    <Frame main={{ label: 'TO RE-SIGNING', onClick: () => move(f => FR.advanceStage(f)) }}
      side={{ label: 'DELEGATE', onClick: () => move(f => FR.advanceStage(f), 'THE STAFF SET ITSELF', 'Every job was filled and every deal was in place.') }}>
      <div className="fro-cap" role="group" aria-label="Coaching budget">
        <span className="is-lead"><small>BUDGET LEFT</small><b className={st.budget.left < 0 ? 'fr-t-red' : undefined}>{money(st.budget.left)}</b></span>
        <span><small>COMMITTED</small><b>{money(st.budget.used)}</b></span>
        <span><small>THE BUDGET</small><b>{money(st.budget.total)}</b></span>
        <span><small>STAFF POINTS</small><b>{v.tree.pts}</b></span>
      </div>
      <div className="fr-cols">
        <div className="fr-col">
          <Panel title="The staff" meta={up(teamOf(F.team).nick)}>
            {ROLES.map(r => {
              const m = st[r.toLowerCase()], up4 = expired(r)
              return (
                <div key={r} className="fro-coach">
                  <div className="fro-coach-top">
                    <small>{JOB[r]}</small>
                    {m ? <>
                      <b>{m.name}</b>
                      <em>{[`AGE ${m.age}`, m.record, m.built ? 'BUILT' : null, m.interim ? 'INTERIM' : null, callsText(m), up4 ? 'DEAL IS UP' : `${money(m.salary)} · ${plural(m.yrs, 'YEAR')}`].filter(Boolean).join(' · ')}</em>
                      <span className="fro-coach-ovr"><b>{m.ovr}</b><small>{m.grade}</small></span>
                    </> : <b className="is-open">OPEN</b>}
                  </div>
                  {m && <Five ratings={m.ratings} />}
                  <div className="fro-btns">
                    {m && up4 && <button className="fr-btn fr-btn--sm" onClick={() => run(f => FR.hireCoach(f, r, m.id))}>RE-SIGN</button>}
                    <button className={`fr-btn fr-btn--sm${m ? ' fr-btn--line' : ''}`} onClick={() => { tap(); toMarket(r) }}>{m ? 'REPLACE' : 'HIRE'}</button>
                    {r === 'HC' && <button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => { tap(); setBuilding(true) }}>BUILD A COACH</button>}
                    {m && <button className="fr-btn fr-btn--danger fr-btn--sm" onClick={() => { tap(); setAsk({ kind: 'fire', role: r, coach: m }) }}>FIRE</button>}
                  </div>
                </div>
              )
            })}
          </Panel>
          {v.market.poached.length > 0 && (
            <Panel title="Hired away" meta={plural(v.market.poached.length, 'COACH', 'COACHES')}>
              {[...v.market.poached].sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0)).map((x, i) => (
                <div key={i} className={`fr-row fro-man${x.mine ? ' is-mine' : ''}`}>
                  <Logo team={x.to.short} size={28} />
                  <span className="fr-row-main">{x.coach.name}<small>{up(x.from.nick)} COORDINATOR · NOW {up(x.to.nick)} {JOB[x.role] ?? 'HEAD COACH'}</small></span>
                </div>
              ))}
            </Panel>
          )}
          <Panel title="What this staff does">
            {st.effects.map((e, i) => <p key={i} className="fro-line">{e}</p>)}
          </Panel>
        </div>
        <div className="fr-col">
          <Panel title="Scouting director" meta={st.scout ? up(st.scout.specialty) : 'OPEN'}>
            {v.scouts.map(s => (
              <div key={s.id} className={`fro-opt${s.hired ? ' is-on' : ''}`}>
                <span className="fr-row-main">{s.name}<small>{s.specialty} · {money(s.salary)}</small></span>
                {s.hired ? <span className="fr-row-state is-done">IN THE JOB</span> : <button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => run(f => FR.hireScout(f, s.id))}>HIRE</button>}
                <p>{s.text}</p>
              </div>
            ))}
          </Panel>
          <Panel title="The GM's tree" meta={plural(v.tree.pts, 'POINT')}>
            {v.tree.branches.map(b => (
              <div key={b.id} className="fro-opt">
                <span className="fr-row-main">{b.name} <Pips n={b.level} max={b.max} label={`Level ${b.level} of ${b.max}`} /></span>
                {b.cost == null ? <span className="fr-row-state is-done">COMPLETE</span>
                  : <button className="fr-btn fr-btn--line fr-btn--sm" disabled={v.tree.pts < b.cost} onClick={() => act(f => FR.buyPerk(f, b.id))}>{plural(b.cost, 'PT')}</button>}
                <p>{b.effect}</p>
              </div>
            ))}
          </Panel>
        </div>
      </div>
      <Panel title="The coaching market" meta={plural(v.market.coaches.length, 'COACH', 'COACHES')}>
        <div ref={market} className="fro-anchor" />
        <Seg label="Hiring for" value={role} onChange={setRole} options={ROLES.map(r => [r, wide ? JOB[r] : r === 'HC' ? 'HEAD COACH' : r === 'OC' ? 'OFFENSE' : 'DEFENSE'])} />
        <FrTable className="fro-fixed" cols={cols} rows={v.market.coaches} sort={{ k: 'ovr', desc: true }} onRow={r => setCid(r.id)} label="Coaches on the market" empty="NO ONE IS LOOKING FOR WORK" />
      </Panel>

      <FrSheet open={!!card} onClose={() => setCid(null)} label={c?.name}
        head={c && <FrSheetHead name={c.name} line={[`AGE ${c.age}`, c.team ? up(teamOf(c.team).nick) : 'ON THE MARKET'].join(' · ')} big={row ? row.ovrAs[role] : c.ovr} bigLabel={row ? `AS ${role}` : 'OVR'} />}
        foot={c && row ? <button className="fr-btn" onClick={() => { tap(); setAsk({ kind: 'hire', role, coach: row }) }}>HIRE AS {JOB[role]} · {money(row.ask[ASK_AS[role]])}</button> : null}>
        {c && <>
          <Panel title="The five" meta={c.grade}>
            {c.ratings.map(r => <GradeRow key={r.key} label={r.label} grade={r.grade} v={r.val} />)}
          </Panel>
          {row && (
            <Panel title="The job" meta={row.wants === 'HC' ? 'HEAD JOBS ONLY' : null}>
              <div className="fr-kv"><span>INTEREST IN {up(teamOf(F.team).nick)}</span><b>{row.interest}</b></div>
              {ROLES.map(r => <div key={r} className="fr-kv"><span>AS {JOB[r]}</span><b className="is-text">{row.ovrAs[r]} overall · {money(row.ask[ASK_AS[r]])} a year</b></div>)}
              <div className="fr-kv"><span>BUDGET LEFT</span><b>{money(st.budget.left)}</b></div>
            </Panel>
          )}
          {c.effects?.length > 0 && <Panel title="What he brings">{c.effects.map((e, i) => { const [a, ...b] = String(e).split(': '); return b.length ? <Fact key={i} label={a}>{b.join(': ')}</Fact> : <p key={i} className="fro-line">{e}</p> })}</Panel>}
          {c.history?.length > 0 && (
            <Panel title="Record">
              {[...c.history].reverse().map((h, i) => <div key={i} className="fr-kv"><span>{h.year} · {h.team} {h.role}</span><b className="is-text">{h.w}-{h.l}{h.note ? ` · ${h.note}` : ''}</b></div>)}
            </Panel>
          )}
        </>}
      </FrSheet>
      <Confirm open={ask?.kind === 'fire'} danger title={`Fire ${ask?.coach?.name}?`} yes="FIRE HIM" no="KEEP HIM" onNo={() => setAsk(null)}
        body={ask?.kind === 'fire' ? `Half of this year's salary stays on the coaching budget, and ownership takes note. The ${job(ask.role)} job is open until someone is hired; the staff fills it if the stage ends first.` : ''}
        onYes={() => { const a = ask; setAsk(null); run(f => FR.fireCoach(f, a.role)) }} />
      <Confirm open={ask?.kind === 'hire'} title={`Hire ${ask?.coach?.name}?`} yes="HIRE HIM" no="NOT NOW" onNo={() => setAsk(null)}
        body={ask?.kind === 'hire' ? `${ask.coach.name} as ${job(ask.role)}: ${money(ask.coach.ask[ASK_AS[ask.role]])} a year.${st[ask.role.toLowerCase()] ? ` ${st[ask.role.toLowerCase()].name} is let go.` : ''}` : ''}
        onYes={() => { const a = ask; setAsk(null); const next = run(f => FR.hireCoach(f, a.role, a.coach.id)); if (next?.flash?.ok !== false) setCid(null) }} />
    </Frame>
  )
}
const r5 = [['talentDev', 'DEV'], ['offPlaycalling', 'OFF'], ['defPlaycalling', 'DEF'], ['culture', 'CUL'], ['situational', 'SIT']]
