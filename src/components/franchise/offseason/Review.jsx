import { useMemo, useState } from 'react'
import { Panel, FrTable, Seg, Face, Logo, Steps } from '../frUi'
import { teamOf } from '../frTeams'
import TrophyScene from '../TrophyScene'
import { Frame, useOff } from './frame'
import { Said, Sub, Who, Club, PlayerSheet, safe, up, plural, signed, tap } from './offUi'
import { isPro } from '../../../lib/progress'

// OFFSEASON 1 · SEASON REVIEW (the engine's seasonReview). The champions, the GM's own year and what ownership
// made of it, the awards, the club's own honours called out, All-Pro and the Pro Bowl, who retired, the Hall.
// A GM who has been let go picks his next job here (jobOffers / takeJob) before anything else; a Pro player can
// overturn it instead (overturnFiring), everyone else is told Pro can.
const seePro = () => { tap(); window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'pro' })) }

const AWARDS = [
  ['MVP', 'MOST VALUABLE PLAYER'], ['OPOY', 'OFFENSIVE PLAYER OF THE YEAR'], ['DPOY', 'DEFENSIVE PLAYER OF THE YEAR'], ['OROY', 'OFFENSIVE ROOKIE OF THE YEAR'],
  ['DROY', 'DEFENSIVE ROOKIE OF THE YEAR'], ['COY', 'COACH OF THE YEAR'], ['PROTECTOR', 'PROTECTOR OF THE YEAR'],
]

function Award({ FR, a, label, lead = false, mine = false, n = 0, onOpen }) {
  const p = a.player, who = p ?? a.coach
  const Tag = p ? 'button' : 'div'
  return (
    <Tag className={`fro-award${lead ? ' is-lead' : ''}${mine ? ' is-mine' : ''}`} style={{ '--n': n }} onClick={p ? () => { tap(); onOpen(p.id) } : undefined}>
      <small>{label}</small>
      <Face name={a.name} photo={p ? FR.photoUrl(p.photo) : null} size={lead ? 72 : 44} />
      <span className="fro-award-who">
        <b>{a.name}</b>
        <em>{[p ? p.slot : up(who?.roleName ?? 'Head Coach'), a.team?.name, a.line].filter(Boolean).join(' · ')}</em>
      </span>
      {a.team && <Logo team={a.team.short} size={lead ? 44 : 28} />}
    </Tag>
  )
}

export default function Review() {
  const { FR, F, o, act, toDirection } = useOff()
  const v = o.view
  const [pid, setPid] = useState(null)
  const [list, setList] = useState('allpro')
  const [film, setFilm] = useState(false)
  const us = teamOf(F.team)
  // (a GM who has just taken another job: the season on this page was still the club he left)
  const then = teamOf(useMemo(() => safe(() => FR.history(F).seasons.slice(-1)[0]?.user?.team), [FR, F]) ?? F.team)
  const owner = useMemo(() => safe(() => FR.ownerView(F)), [FR, F])
  const jobs = useMemo(() => (v.owner.fired ? safe(() => FR.jobOffers(F), []) : []), [FR, F, v.owner.fired])
  const champ = v.champion, won = champ?.short === F.team
  const mineAwards = AWARDS.filter(([k]) => v.awards[k]?.team?.short === F.team)
  // the club's own, one line a man: every list he is on
  const honors = []
  const honor = (p, name, label) => { const k = p?.id ?? name; let h = honors.find(x => x.k === k); if (!h) honors.push(h = { k, p, name, labels: [] }); if (!h.labels.includes(label)) h.labels.push(label) }
  for (const [k, label] of mineAwards) honor(v.awards[k].player, v.awards[k].name, label)
  for (const x of v.mine.allPro) honor(x.player, x.player.name, 'ALL-PRO')
  for (const x of v.mine.proBowl) honor(x.player, x.player.name, 'PRO BOWL')
  const rows = list === 'allpro' ? v.allPro : (v.proBowl[list] ?? [])
  const retired = [...v.retirements].sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0))
  const cols = [
    { k: 'slot', label: 'POS', w: 46, cls: 'fr-t-pos', val: r => r.slot },
    { k: 'name', label: 'PLAYER', val: r => r.player.name, render: r => <Who name={r.player.name} tag={r.player.team === F.team ? us.short : null} sub={r.player.line} /> },
    { k: 'team', label: 'TEAM', w: 74, val: r => r.player.team ?? '', render: r => <Club t={teamOf(r.player.team)} /> },
    { k: 'ovr', label: 'OVR', w: 44, align: 'r', cls: 'fr-t-num', val: r => r.player.ovr },
  ]
  const main = v.owner.fired && jobs.length
    ? { label: `TAKE THE ${up(jobs[0].team.nick)} JOB`, onClick: () => act(f => FR.takeJob(f, jobs[0].team.short), { say: true }) }
    : { label: 'THE DIRECTION', onClick: toDirection }
  return (
    <Frame main={main}>
      {champ && (
        <section className={`fro-champ${won ? ' is-mine' : ''}`}>
          <Logo team={champ.short} size={64} />
          <span><small>{v.year} SUPER BOWL CHAMPIONS</small><b>{up(champ.name)}</b></span>
          {won && <button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => { tap(); setFilm(true) }}>THE TROPHY</button>}
        </section>
      )}
      {v.owner.fired && (
        <Panel title="Relieved of his duties" meta={up(us.nick)}>
          <Said who="OWNERSHIP">{v.owner.verdict}</Said>
          {isPro()
            ? <div className="fro-opt"><span className="fr-row-main">OVERTURN THE FIRING<small>BAP PRO · OWNERSHIP KEEPS {up(F.gm?.name ?? 'THE GM')} ON</small></span>
                <button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => { tap(); act(f => FR.overturnFiring(f)) }}>KEEP THE JOB</button></div>
            : <p className="fr-note">BAP Pro can overturn a firing and keep the job. <button type="button" className="fro-link" onClick={seePro}>SEE PRO</button></p>}
          {jobs.length ? <>
            <Sub meta={plural(jobs.length, 'OFFER')}>WHERE {up(F.gm?.name ?? 'THE GM')} GOES NEXT</Sub>
            {jobs.map(j => (
              <div key={j.team.short} className="fro-job">
                <Logo team={j.team.short} size={36} />
                <span className="fr-row-main">{j.team.name}<small>{[j.record, `ROSTER NO. ${j.roster.rank}`, `${FR.moneyText(j.capSpace)} ROOM`].filter(Boolean).join(' · ')}</small></span>
                <button className="fr-btn fr-btn--sm" onClick={() => act(f => FR.takeJob(f, j.team.short), { say: true })}>TAKE IT</button>
                {j.pitch && <p>{j.pitch}</p>}
              </div>
            ))}
          </> : <p className="fr-note">No club has called yet. The job stays his for now.</p>}
        </Panel>
      )}
      {v.owner.kept && (
        <Panel title="Kept on" meta={up(us.nick)}>
          <Said who="OWNERSHIP">{`Ownership has reconsidered. ${F.gm?.name ?? 'The GM'} stays on as general manager of the ${us.name ?? us.nick}.`}</Said>
        </Panel>
      )}
      <div className="fr-cols fro-swap">
        <div className="fr-col">
          <Panel title="The awards" meta={String(v.year)}>
            {AWARDS.filter(([k]) => v.awards[k]).map(([k, label], n) => (
              <Award key={k} FR={FR} a={v.awards[k]} label={label} lead={k === 'MVP'} mine={v.awards[k].team?.short === F.team} n={n} onOpen={setPid} />
            ))}
          </Panel>
        </div>
        <div className="fr-col">
          <Panel title={`${then.nick} ${v.year}`} meta={v.user.seed ? `NO. ${v.user.seed} SEED` : then.short !== us.short ? `NOW WITH THE ${up(us.nick)}` : null}>
            <div className="fro-year"><b>{v.user.record}</b><span>{up(v.user.finish || (v.user.seed ? 'In the playoffs' : 'Out of the playoffs'))}</span></div>
            {!v.owner.fired && v.owner.verdict && <Said who="OWNERSHIP">{v.owner.verdict}</Said>}
            <div className="fr-kv"><span>JOB SECURITY</span><b className="is-text">{owner?.word ?? ''} <Steps value={v.owner.security} low={owner?.floor ?? 20} label={`Job security ${v.owner.security} of 100`} />{v.owner.delta !== 0 && <em className={`fro-delta${v.owner.delta < 0 ? ' is-down' : ''}`}>{signed(v.owner.delta)}</em>}</b></div>
            {v.owner.goals.length > 0 && <Sub meta={v.gm.pts ? `+${plural(v.gm.pts, 'STAFF POINT')}` : null}>THE GOALS</Sub>}
            {v.owner.goals.map(g => (
              <div key={g.id} className="fro-goal">
                <i className={g.done ? 'is-met' : undefined}>{g.done ? 'MET' : 'MISSED'}</i>
                <span>{g.text}<small>{String(g.progress ?? '').replace(/^(\d+) of \d+ wins$/, '$1 wins')}</small></span>
              </div>
            ))}
          </Panel>
          <Panel title={`${us.nick} honored`} meta={honors.length ? String(honors.length) : null}>
            {honors.length ? honors.map(h => (
              <button key={h.k} className="fr-row fro-man is-mine" disabled={!h.p} onClick={() => { tap(); setPid(h.p.id) }}>
                <Face name={h.name} photo={h.p ? FR.photoUrl(h.p.photo) : null} size={36} />
                <span className="fr-row-main">{h.name}<small>{[h.p?.slot, ...h.labels].filter(Boolean).join(' · ')}</small></span>
              </button>
            )) : <div className="fr-empty">NO {up(us.nick)} ON THE LISTS THIS YEAR</div>}
          </Panel>
        </div>
      </div>
      <Panel title="All-Pro and the Pro Bowl" meta={plural(rows.length, 'PLAYER')}>
        <Seg label="Honors list" value={list} onChange={setList} options={[['allpro', 'ALL-PRO'], ['AFC', 'AFC PRO BOWL'], ['NFC', 'NFC PRO BOWL']]} />
        <FrTable className="fro-fixed" cols={cols} rows={rows} rowKey={r => `${r.slot}${r.player.id}`} onRow={r => setPid(r.player.id)} rowClass={r => (r.player.team === F.team ? 'is-mine' : null)} label="Honors" />
      </Panel>
      <div className={v.hall.length ? 'fr-cols is-even' : 'fr-col'}>
        <Panel title="Retirements" meta={retired.length ? String(retired.length) : null}>
          {retired.length ? retired.slice(0, 16).map((r, i) => (
            <div key={i} className={`fro-ret${r.mine ? ' is-mine' : ''}`}>
              <i>{r.pos}</i>
              <span>{r.name}<small>{[`AGE ${r.age}`, r.team ? teamOf(r.team).nick.toUpperCase() : 'FREE AGENT', r.line].filter(Boolean).join(' · ')}</small></span>
            </div>
          )) : <div className="fr-empty">NOBODY OF NOTE RETIRED</div>}
        </Panel>
        {v.hall.length > 0 && (
        <Panel title="Hall of Fame" meta={v.hall.length ? `CLASS OF ${v.year}` : null} className="fro-hall">
          {v.hall.map((h, i) => (
            <div key={i} className={`fro-ret${h.mine ? ' is-mine' : ''}`}>
              <i>{h.pos}</i>
              <span>{h.name}<small>{[h.years, h.line].filter(Boolean).join(' · ')}</small></span>
            </div>
          ))}
        </Panel>
        )}
      </div>
      <PlayerSheet FR={FR} F={F} pid={pid} onClose={() => setPid(null)} seasonLabel={`${v.year} season`} />
      {film && champ && <TrophyScene team={{ name: champ.name, color: champ.color, color2: champ.color2, short: champ.short }} title={`${v.year} SUPER BOWL CHAMPIONS`} onDone={() => setFilm(false)} />}
    </Frame>
  )
}
