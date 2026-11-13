import { useEffect, useMemo, useState } from 'react'
import { Panel, Switch, Seg, Steps, FrTable, FrSheet, Logo } from './frUi'
import { Fact, Sub, Security, TeamCell, tap, up, plural, safe, STATE_AS, DIR_VERB } from './frBits'
import { teamOf } from './frTeams'

// FRANCHISE: OFFICE. The GM's own desk, five views behind one slim row:
//   OWNER      the job's security, what ownership says about the direction, this season's goals read against
//              it, the verdict once a season is over, and the seasons so far
//   GM         the résumé: record, playoffs, championships, legacy
//   HISTORY    champions by year (a year opens its awards and All-Pro team), the record book, the Hall of Fame
//   SETTINGS   the league's toggles and what the staff handles (changeable all season)
//   SAVES      the three slots; the open one is saved after every change
// The staff itself is TEAM · STAFF; trades and free agents are LEAGUE · MARKET.
// SEAM for the offseason agent: the coaching market, the GM's tree and the draft board hang off the offseason
// stages (./offseason/Offseason.jsx), not here.

const VIEWS = [['owner', 'OWNER'], ['gm', 'GM'], ['history', 'HISTORY'], ['settings', 'SETTINGS'], ['saves', 'SAVES']]
const WEIGHT = { 3: 'THE BAR', 2: 'EXPECTED', 1: 'A BONUS' }
const AWARD_NAME = { MVP: 'MVP', OPOY: 'OFFENSIVE PLAYER', DPOY: 'DEFENSIVE PLAYER', OROY: 'OFFENSIVE ROOKIE', DROY: 'DEFENSIVE ROOKIE', COY: 'COACH OF THE YEAR', PROTECTOR: 'PROTECTOR' }
const whenOf = s => (s.phase === 'offseason' ? `${s.year} · OFFSEASON` : `${s.year} · ${s.week <= 18 ? `WEEK ${s.week}` : 'PLAYOFFS'}`)
const goalWord = g => (g.done === true ? 'MET' : g.done === false ? 'MISSED' : g.progress)

function Owner({ FR, F, hub, hist }) {
  const owner = useMemo(() => safe(() => FR.ownerView(F), hub.owner), [FR, F, hub])
  const st = useMemo(() => safe(() => FR.teamState(F)), [FR, F])
  const firing = FR.settingsOf(F).firing
  const sec = owner?.security ?? hub.gm.security ?? 0
  const seasons = hist?.seasons ?? []
  return (
    <div className="fr-cols is-even">
      <div className="fr-col">
        <Panel title="Job security">
          <div className="fr-kv"><span>STANDING</span><Security value={sec} word={owner?.word ?? hub.gm.securityWord ?? ''} floor={owner?.floor} /></div>
          <div className="fr-kv"><span>SECURITY</span><b>{Math.round(sec)}<small className="fr-t-dim"> / 100</small></b></div>
          <div className="fr-kv"><span>{firing ? 'THE OWNER MAKES A CHANGE BELOW' : 'THE OWNER CANNOT FIRE THE GM'}</span><b>{firing ? owner?.floor ?? 20 : ''}</b></div>
        </Panel>
        {st && (
          <Panel title="The direction" meta={st.agree ? 'OWNERSHIP AGREES' : 'AGAINST THE READ'}>
            <Fact label="THE ROSTER" strong>{st.label}<small>{st.window?.text}</small></Fact>
            <Fact label="GM'S DIRECTION" strong>{DIR_VERB[st.direction]}</Fact>
            <Fact label="OWNERSHIP">{st.ownerSays}</Fact>
          </Panel>
        )}
      </div>
      <div className="fr-col">
        <Panel title={`${F.year} goals`} meta={st ? `JUDGED AS ${STATE_AS[st.direction]}` : null}>
          {(owner?.goals ?? []).map(g => <Fact key={g.id} label={WEIGHT[g.weight] ?? 'GOAL'}>{g.text}<small>{goalWord(g)}</small></Fact>)}
          {!(owner?.goals ?? []).length && <div className="fr-empty">NO GOALS SET</div>}
          {owner?.verdict && <Fact label="THE VERDICT">{owner.verdict}</Fact>}
        </Panel>
        <Panel title="Season by season">
          <FrTable label="Seasons" rows={seasons.filter(s => s.user)} rowKey={r => r.year} empty="THE FIRST SEASON IS UNDER WAY"
            cols={[{ k: 'y', label: 'YEAR', w: 56, cls: 'fr-t-num', render: r => r.year }, { k: 't', label: 'TEAM', w: 70, render: r => <TeamCell t={teamOf(r.user.team)} /> },
              { k: 'r', label: 'W-L', align: 'r', w: 56, cls: 'fr-t-num', render: r => r.user.record }, { k: 'f', label: 'FINISH', cls: 'fr-t-wrap', render: r => r.user.finish || 'Missed the playoffs' }]} />
        </Panel>
      </div>
    </div>
  )
}

function Gm({ hist, hub }) {
  const g = hist?.gm
  if (!g) return <Panel><div className="fr-empty">NO RÉSUMÉ ON FILE</div></Panel>
  const lines = g.résumé ?? g.resume ?? []
  return (
    <div className="fr-cols is-even">
      <Panel title="General manager" meta={up(g.name)}>
        <div className="fr-kv"><span>SEASONS COMPLETED</span><b>{g.seasons}</b></div>
        <div className="fr-kv"><span>REGULAR SEASON</span><b>{hub.gm.record ?? g.record}</b></div>
        <div className="fr-kv"><span>PLAYOFFS</span><b>{g.playoffs}</b></div>
        <div className="fr-kv"><span>CHAMPIONSHIPS</span><b className={g.rings > 0 ? 'fr-t-gold' : undefined}>{g.rings}{g.titles?.length ? <small className="fr-t-dim"> · {g.titles.join(', ')}</small> : null}</b></div>
        <div className="fr-kv"><span>LEGACY</span><b className="is-text">{g.legacyWord} <Steps value={g.legacy || 1} low={-1} label={`Legacy ${g.legacy} of 100`} /></b></div>
        {g.teams?.length > 0 && <div className="fr-kv"><span>CLUBS</span><b className="is-text">{g.teams.map(t => teamOf(t).nick).join(', ')}</b></div>}
      </Panel>
      <Panel title="The résumé">
        {lines.map((t, i) => <p key={i} className="fr-read fr-read--row">{t}</p>)}
        {!lines.length && <div className="fr-empty">NOTHING ON IT YET: THE FIRST SEASON IS UNDER WAY</div>}
      </Panel>
    </div>
  )
}

function History({ hist }) {
  const [sub, setSub] = useState('champs')
  const [year, setYear] = useState(null)
  const seasons = hist?.seasons ?? []
  const s = seasons.find(x => x.year === year)
  const rec = hist?.records ?? {}
  const recCols = [{ k: 'l', label: 'RECORD', cls: 'fr-t-wrap', render: r => r.label }, { k: 'v', label: '', align: 'r', w: 64, cls: 'fr-t-num', render: r => r.val },
    { k: 'n', label: 'HOLDER', cls: 'fr-t-wrap', render: r => <>{r.name}<span className="fr-t-sub">{[r.team, r.year].filter(Boolean).join(' · ')}</span></> }]
  return (
    <>
      <Panel><Seg label="History" options={[['champs', 'CHAMPIONS'], ['records', 'RECORDS'], ['hall', 'HALL OF FAME']]} value={sub} onChange={setSub} /></Panel>
      {sub === 'champs' && (
        <Panel title="Champions">
          <FrTable label="Champions" rows={seasons} rowKey={r => r.year} onRow={r => setYear(r.year)} empty="NO SEASON HAS BEEN PLAYED TO THE END YET"
            cols={[{ k: 'y', label: 'YEAR', w: 56, cls: 'fr-t-num', render: r => r.year }, { k: 'c', label: 'CHAMPION', render: r => (r.champion ? <TeamCell t={r.champion} /> : '–') },
              { k: 's', label: 'SCORE', align: 'r', w: 62, cls: 'fr-t-num', render: r => r.score }, { k: 'r', label: 'RUNNER-UP', render: r => (r.runnerUp ? <TeamCell t={r.runnerUp} /> : '–') },
              { k: 'm', label: 'MVP', cls: 'fr-t-dim fr-t-wrap', render: r => r.awards?.MVP?.name ?? '–' }]} />
        </Panel>
      )}
      {sub === 'records' && (
        <div className="fr-grid2 is-three">
          {[['season', 'Season records'], ['game', 'Game records'], ['team', 'Team records']].map(([k, title]) => (
            <Panel key={k} title={title}><FrTable className="fr-table--tall" label={title} rows={rec[k] ?? []} rowKey={r => r.key} cols={recCols} empty="NO RECORDS SET YET" /></Panel>
          ))}
        </div>
      )}
      {sub === 'hall' && (
        <Panel title="Hall of Fame">
          {(hist?.hall ?? []).map((h, i) => <Fact key={i} label={`${h.pos ?? ''} ${h.years ?? ''}`.trim()}>{h.name}<small>{h.line}</small></Fact>)}
          {!(hist?.hall ?? []).length && <div className="fr-empty">NOBODY FROM THIS FRANCHISE HAS GONE IN YET</div>}
        </Panel>
      )}
      <FrSheet open={!!s} onClose={() => setYear(null)} label="Season"
        head={s && <span className="fr-clubhead">{s.champion && <Logo team={s.champion.short} size={52} />}<span className="fr-sheet-who"><b>{s.year} SEASON</b><small>{s.champion ? `${up(s.champion.nick)} ${s.score}${s.runnerUp ? ` OVER THE ${up(s.runnerUp.nick)}` : ''}` : ''}</small></span></span>}>
        {s && <>
          {s.user && <Panel title="The GM's season"><div className="fr-kv"><span>{up(teamOf(s.user.team).nick)}</span><b className="is-text">{s.user.record} · {s.user.finish || 'Missed the playoffs'}</b></div></Panel>}
          <Panel title="Awards">
            {Object.entries(s.awards ?? {}).filter(([, a]) => a).map(([k, a]) => <Fact key={k} label={AWARD_NAME[k] ?? k}>{a.name}{a.team ? `, ${a.team}` : ''}<small>{a.line}</small></Fact>)}
          </Panel>
          {s.allPro?.length > 0 && <Panel title="All-Pro">{s.allPro.map((a, i) => <div key={i} className="fr-kv"><span>{a.slot}</span><b className="is-text">{a.name} · {a.team}</b></div>)}</Panel>}
        </>}
      </FrSheet>
    </>
  )
}

function Settings({ FR, F, act }) {
  const s = FR.settingsOf(F)
  const set = (k, v) => act(f => FR.setSetting(f, k, v))
  return (
    <div className="fr-cols is-even">
      <div className="fr-col">
        <Panel title="Game day">
          <Switch label="Play the Moments" note="THE BIGGEST PLAYS, AS MINI GAMES" on={s.moments} onChange={v => { set('moments', v); set('calls', v) }} />
        </Panel>
        <Panel title="League">
          <Switch label="Injuries" on={s.injuries} onChange={v => set('injuries', v)} />
          <Switch label="Salary cap" on={s.cap} onChange={v => set('cap', v)} />
          <Switch label="The owner can fire the GM" on={s.firing} onChange={v => set('firing', v)} />
          <div className="fr-row fr-row--seg"><span className="fr-row-main">Trades</span><Seg label="Trade difficulty" options={[['easy', 'EASY'], ['fair', 'FAIR'], ['hard', 'HARD']]} value={s.tradeAI} onChange={v => set('tradeAI', v)} /></div>
        </Panel>
      </div>
      <Panel title="The staff handles">
        <Switch label="Depth chart" note="RE-SET EVERY WEEK" on={s.autoDepth} onChange={v => set('autoDepth', v)} />
        <Switch label="Upgrade points" note="SPENT AS THEY ARE EARNED" on={s.autoUpgrade} onChange={v => set('autoUpgrade', v)} />
        <Switch label="Roster holes" note="A SIGNING WHEN A SPOT IS SHORT" on={s.autoRoster} onChange={v => set('autoRoster', v)} />
      </Panel>
    </div>
  )
}

function Saves({ FR, F, hub, slot, onSlots }) {
  const slots = useMemo(() => safe(() => FR.listSlots(), []), [FR, F])
  return (
    <div className="fr-page fr-page--narrow" style={{ margin: 0 }}>
      <Panel title="Saves" meta="SAVED AFTER EVERY CHANGE">
        {slots.map(s => {
          const here = s.slot === slot
          // (the open franchise is shown as it stands now, not as it was last written)
          const row = here ? { team: hub.team.short, year: hub.year, week: hub.week, phase: hub.phase, record: hub.record.text, gm: hub.gm.name, rings: hub.gm.rings } : s
          const t = s.empty && !here ? null : teamOf(row.team)
          return (
            <div key={s.slot} className={`fr-row fr-slotrow${here ? ' is-open' : ''}`} style={{ minHeight: 62 }}>
              <span className="fr-slot-n">{s.slot + 1}</span>
              {t ? <Logo team={t.short} size={34} /> : <span className="fr-slot-blank" />}
              <span className="fr-row-main">{t ? up(t.nick) : <span className="fr-t-dim">EMPTY</span>}{t && <small>{whenOf(row)} · {row.record ?? '0-0'} · GM {up(row.gm ?? '')}{row.rings > 0 ? ` · ${plural(row.rings, 'TITLE')}` : ''}</small>}</span>
              {here && <span className="fr-row-state is-done">OPEN</span>}
            </div>
          )
        })}
        <div className="fr-pad"><button className="fr-btn fr-btn--line fr-btn--wide" onClick={() => { tap(); onSlots() }}>ALL FRANCHISES</button></div>
      </Panel>
    </div>
  )
}

export default function FrOffice({ FR, F, hub, act, jump, slot = null, onSlots }) {
  const [view, setView] = useState(jump?.view ?? 'owner')
  useEffect(() => { if (jump?.view) setView(jump.view) }, [jump])
  const hist = useMemo(() => safe(() => FR.history(F)), [FR, F])
  return (
    <div className="fr-page">
      <Panel title="Office" meta={`GM ${up(hub.gm.name)}`} className="fr-panel--nav">
        <Seg className="fr-seg--fit" label="Office" options={VIEWS} value={view} onChange={setView} />
      </Panel>
      {view === 'owner' && <Owner FR={FR} F={F} hub={hub} hist={hist} />}
      {view === 'gm' && <Gm hist={hist} hub={hub} />}
      {view === 'history' && <History hist={hist} />}
      {view === 'settings' && <Settings FR={FR} F={F} act={act} />}
      {view === 'saves' && <Saves FR={FR} F={F} hub={hub} slot={slot} onSlots={onSlots} />}
    </div>
  )
}
