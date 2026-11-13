import { useMemo, useState } from 'react'
import { Panel, FrTable, Logo, Face, Steps, useWide } from '../frUi'
import { teamOf } from '../frTeams'
import { Frame, useOff } from './frame'
import { PlayerSheet, Sub, safe, up, plural, signed, tap } from './offUi'

// OFFSEASON 9 · NEW SEASON (the engine's newSeason, read once the league has turned over: phase 'regular',
// Week 1). The schedule, the power rankings, the owner's goals for the year, who grew and who slipped over the
// offseason, the rookies. The one button goes to Week 1 (onDone).

export default function NewSeason({ onDone }) {
  const { FR, F } = useOff()
  const wide = useWide()
  const ns = useMemo(() => safe(() => FR.newSeason(F), { year: F.year, goals: [], changes: [], schedule: [], rookies: [] }), [FR, F])
  const ranks = useMemo(() => safe(() => FR.powerRankings(F), []), [FR, F])
  const st = useMemo(() => safe(() => FR.teamState(F)), [FR, F])
  const owner = useMemo(() => safe(() => FR.ownerView(F)), [FR, F])
  const [pid, setPid] = useState(null)
  const [all, setAll] = useState(false)
  const us = teamOf(F.team)
  const first = ns.schedule.find(g => !g.bye)
  const mine = ranks.find(r => r.team.short === F.team)
  const up_ = ns.changes.filter(c => c.d > 0), down = ns.changes.filter(c => c.d <= 0)
  const sched = [
    { k: 'week', label: 'WK', w: 40, cls: 'fro-t-rk', render: g => g.week },
    { k: 'opp', label: 'OPPONENT', render: g => (g.bye || !g.opp ? <span className="fr-t-dim">BYE</span> : <span className="fr-t-team"><i className="fro-at">{g.home ? 'VS' : 'AT'}</i><Logo team={g.opp.short} size={20} />{wide ? g.opp.name : g.opp.nick}</span>) },
    { k: 'where', label: '', w: 64, align: 'r', cls: 'fr-t-lab fr-t-dim', render: g => (g.bye || !g.opp ? '' : g.home ? 'HOME' : 'AWAY') },
  ]
  const rk = [
    { k: 'rank', label: 'RK', w: 40, cls: 'fro-t-rk', val: r => r.rank, desc: false },
    { k: 'team', label: 'TEAM', val: r => r.team.name, render: r => <span className="fr-t-team"><Logo team={r.team.short} size={20} /><span className="fr-t-name">{wide ? r.team.name : r.team.nick}{r.blurb && <small className="fro-t-sub">{r.blurb}</small>}</span></span> },
    { k: 'state', label: 'STATE', w: 96, align: 'r', cls: 'fr-t-lab fr-t-dim', val: r => r.state, render: r => r.stateLabel },
  ]
  const change = c => (
    <button key={c.player.id} className="fr-row fro-man" onClick={() => { tap(); setPid(c.player.id) }}>
      <Face name={c.player.name} photo={FR.photoUrl(c.player.photo)} size={36} />
      <span className="fr-row-main">{c.player.name}<small>{c.player.slot} · AGE {c.player.age} · {up(c.text)}</small></span>
      <span className="fro-chg"><b>{c.player.ovr}</b><em className={c.d < 0 ? 'is-down' : undefined}>{signed(c.d)}</em></span>
    </button>
  )
  return (
    <Frame main={{ label: 'TO WEEK 1', onClick: onDone }}>
      <section className="fro-clock is-mine">
        <Logo team={F.team} size={52} />
        <span><small>THE {ns.year} SEASON</small><b>{up(us.name)}</b>{first && <em>WEEK {first.week} · {first.home ? 'HOME TO' : 'AT'} {up(first.opp.name)}</em>}</span>
      </section>
      <div className="fr-cols">
        <div className="fr-col">
          <Panel title="The schedule" meta={`${ns.schedule.filter(g => !g.bye && g.week <= 18).length} GAMES`}>
            <FrTable className="fro-fixed" cols={sched} rows={ns.schedule.filter(g => g.week <= 18)} rowKey={g => g.week} label="Schedule" />
          </Panel>
          <Panel title="Power rankings" meta={mine ? `${up(us.nick)} NO. ${mine.rank}` : null}
            action={<button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => { tap(); setAll(a => !a) }}>{all ? 'TOP TEN' : 'ALL 32'}</button>}>
            <FrTable className="fro-fixed" cols={rk} rows={all ? ranks : ranks.filter(r => r.rank <= 10 || r.team.short === F.team)} rowKey={r => r.team.short} rowClass={r => (r.team.short === F.team ? 'is-mine' : null)} label="Power rankings" />
          </Panel>
        </div>
        <div className="fr-col">
          <Panel title="The goals" meta={st?.directionLabel}>
            {ns.goals.map((g, i) => <div key={g.id} className="fro-goal is-open"><i>{i + 1}</i><span>{g.text}</span></div>)}
            {owner && <div className="fr-kv"><span>JOB SECURITY</span><b className="is-text">{owner.word} <Steps value={owner.security} low={owner.floor} label={`Job security ${Math.round(owner.security)} of 100`} /></b></div>}
            {st && <div className="fr-kv"><span>THE ROSTER READS</span><b className="is-text">{st.label} · No. {st.ratings.rank}</b></div>}
          </Panel>
          <Panel title="Over the offseason" meta={ns.changes.length ? plural(ns.changes.length, 'CHANGE') : null}>
            {up_.length > 0 && <Sub meta={String(up_.length)}>WHO GREW</Sub>}
            {up_.map(change)}
            {down.length > 0 && <Sub meta={String(down.length)}>WHO SLIPPED</Sub>}
            {down.map(change)}
            {!ns.changes.length && <div className="fr-empty">NO RATINGS MOVED</div>}
          </Panel>
          {ns.rookies.length > 0 && (
            <Panel title="The rookies" meta={plural(ns.rookies.length, 'PLAYER')}>
              {ns.rookies.map(p => (
                <button key={p.id} className="fr-row fro-man" onClick={() => { tap(); setPid(p.id) }}>
                  <Face name={p.name} photo={FR.photoUrl(p.photo)} size={36} />
                  <span className="fr-row-main">{p.name}<small>{p.slot} · {p.starter ? 'STARTER' : `NO. ${p.depth ?? ''} ON THE CHART`}</small></span>
                  <span className="fro-chg"><b>{p.ovr}</b><em>{p.grade}</em></span>
                </button>
              ))}
            </Panel>
          )}
        </div>
      </div>
      <PlayerSheet FR={FR} F={F} pid={pid} onClose={() => setPid(null)} />
    </Frame>
  )
}
