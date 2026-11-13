import { useMemo } from 'react'
import { Panel } from '../frUi'
import { Frame, useOff } from './frame'
import { Fact, Said, Sub, safe, up, tap, cap1 } from './offUi'

// OFFSEASON 2 · DIRECTION (DESIGN.md section 9; the engine's teamState / setDirection). What the roster is, by
// the engine's read and why; the GM declares CONTEND, RETOOL or REBUILD; ownership answers and the goals follow.
// The engine's stage is still 'review': leaving this screen is what ends it (the new league year starts there).

const VERB = { contend: 'CONTEND', retool: 'RETOOL', rebuild: 'REBUILD' }
const GROUP = { QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', OL: 'OL', DL: 'DL', LB: 'LB', DB: 'DB', K: 'K' }

export default function Direction() {
  const { FR, F, o, act, move, toReview } = useOff()
  const d = o.direction
  const goals = useMemo(() => safe(() => FR.ownerView(F).goals, []), [FR, F])
  const league = useMemo(() => safe(() => FR.leagueStates(F)), [FR, F])
  const declare = s => { if (s !== d.direction) act(f => FR.setDirection(f, s)) }
  const on = () => move(f => FR.advanceStage(f))
  // DELEGATE: the staff follows the roster (the engine's own read), then the offseason moves on
  const hand = () => move(f => FR.advanceStage(d.direction === d.state ? f : FR.setDirection(f, d.state)), 'THE STAFF SET THE DIRECTION', `The club is ${FR.STATE_LABEL[d.state].toLowerCase()}, as the roster reads.`)
  return (
    <Frame main={{ label: 'TO THE STAFF', onClick: on }} side={{ label: 'DELEGATE', onClick: hand }}>
      <section className="fro-state">
        <small>THE ROSTER, AS IT STANDS</small>
        <b>{d.label}</b>
        <p>{d.stateText}</p>
        <div className="fro-state-ranks">
          <span><small>ROSTER</small><b>NO. {d.ratings.rank}</b></span>
          <span><small>OFFENSE</small><b>NO. {d.ratings.offRank}</b></span>
          <span><small>DEFENSE</small><b>NO. {d.ratings.defRank}</b></span>
          <span><small>LAST SEASON</small><b>{d.record}</b></span>
        </div>
      </section>
      <div className="fr-cols">
        <div className="fr-col">
          <Panel title="Why" meta={d.difficulty ? `${d.difficulty.word} JOB` : null}>
            <Fact label="THE WINDOW">{d.window?.text}</Fact>
            <Fact label="QUARTERBACK">{cap1(d.qb?.text)}</Fact>
            <Fact label="THE CAP">{d.capText} · {FR.moneyText(d.capSpace)}</Fact>
            <Fact label="DRAFT CAPITAL">{d.draft?.text} · {d.draft?.picks} picks, {d.draft?.firsts === 1 ? 'one first' : `${d.draft?.firsts} firsts`}</Fact>
            <Fact label="CORE AGE">{d.coreAge}</Fact>
            <Fact label="THE UPSIDE">{cap1(d.upside)}</Fact>
            <Fact label="THE HARD PART">{cap1(d.hardest)}</Fact>
            <div className="fro-groups" role="group" aria-label="Position groups">
              {(d.groups ?? []).map(g => <span key={g.slot} title={g.starter}><small>{GROUP[g.slot] ?? g.slot}</small><b>{g.grade}</b></span>)}
            </div>
          </Panel>
          {league && (
            <Panel title="Around the league">
              <div className="fro-three">
                {FR.STATES.map(s => <span key={s} className={s === d.state ? 'is-on' : undefined}><b>{league[s]?.length ?? 0}</b><small>{FR.STATE_LABEL[s]}</small></span>)}
              </div>
            </Panel>
          )}
        </div>
        <div className="fr-col">
          <Panel title={`${up(F.gm?.name ?? 'The GM')} declares`} meta={d.agree ? 'WITH THE READ' : 'AGAINST THE READ'}>
            {FR.STATES.map(s => (
              <button key={s} className={`fr-row fr-pick${d.direction === s ? ' is-on' : ''}`} aria-pressed={d.direction === s} onClick={() => { tap(); declare(s) }}>
                <span className="fr-pick-box" />
                <span className="fr-row-main">{VERB[s]}<small>{up(FR.STATE_TEXT[s])}</small></span>
                {s === d.state && <span className="fr-row-state is-done">THE READ</span>}
              </button>
            ))}
            <Said who="OWNERSHIP">{d.ownerSays}</Said>
          </Panel>
          <Panel title="What it sets" meta={d.directionLabel}>
            <Sub>OWNERSHIP'S GOALS</Sub>
            {goals.map((g, i) => <div key={g.id} className="fro-goal is-open"><i>{i + 1}</i><span>{g.text}</span></div>)}
            {(d.advice ?? []).length > 0 && <Sub>THE STAFF'S ADVICE</Sub>}
            {(d.advice ?? []).map((a, i) => <p key={i} className="fro-line">{cap1(a)}</p>)}
          </Panel>
          <button className="fr-btn fr-btn--quiet fr-btn--sm fro-back" onClick={() => { tap(); toReview() }}>BACK TO THE SEASON REVIEW</button>
        </div>
      </div>
    </Frame>
  )
}
