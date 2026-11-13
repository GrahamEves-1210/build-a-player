import { useMemo, useState } from 'react'
import { Panel, FrTicker, FrSheet, FrTable, Logo, Seg, Face } from './frUi'
import { Fact, Security, NewsRow, tap, up, cap, ord, plural, safe, STATE_AS, DIR_VERB } from './frBits'
import { sfx } from '../../lib/juice'
import { useDivisions, DivisionTable } from './FrLeague'

// FRANCHISE: the HUB. The week on one page. PLAY WEEK (pinned by the frame, FranchiseMode.jsx) is the one thing
// that has to be done; everything else here is optional and the staff does whatever is left open.
//   the bar at the top   where the team IS (the engine's read: CONTENDING / RETOOLING / REBUILDING) and where the
//                        GM is TAKING it (his direction). A tap opens the read and the three directions
//   an owner's call      a mid-season change of state, when the engine raises one: its own panel, first
//   THIS WEEK            the gameplan, practice, each front-office item (a sheet with its real choices and
//                        STAFF DECIDES), and the rows that send the GM to the tab the work is on
//   the staff's advice   the engine's lines for the direction the GM has declared
//   the news             the ticker, and the latest headlines (the whole list is LEAGUE · NEWS)
//   the owner            the goals, read against the direction, and the job's security

// (the owner's rule: no year is named before it has been played)
const noYear = (F, t) => String(t ?? '').replace(new RegExp(`the ${F.year + 1} class`, 'g'), 'the next draft class')
// a list of choices, one picked (the gameplan's two sides, a front-office item's options, the direction)
function Choices({ options, value, onChange, disabled = false }) {
  return options.map(o => (
    <button key={o.id} className={`fr-row fr-pick${value === o.id ? ' is-on' : ''}`} role="radio" aria-checked={value === o.id} disabled={disabled} onClick={() => { tap(); onChange(o.id) }}>
      <span className="fr-pick-box" aria-hidden="true" />
      <span className="fr-row-main">{o.label}{(o.good || o.text) && <small>{up(String(/^against/i.test(o.good ?? '') ? `BEST ${o.good}` : o.text ?? o.good).replace(/\.$/, ''))}</small>}</span>
      {o.state && <span className="fr-row-state">{o.state}</span>}
    </button>
  ))
}

function GameplanSheet({ FR, F, act, onClose }) {
  const plan = useMemo(() => safe(() => FR.pregame(F)?.gameplan), [FR, F])
  const report = useMemo(() => safe(() => FR.scoutingReport(F)), [FR, F])
  const [off, setOff] = useState(plan?.off?.id ?? 'balanced')
  const [def, setDef] = useState(plan?.def?.id ?? 'balanced')
  const opp = report?.opp
  return (
    <FrSheet open onClose={onClose} label="Gameplan"
      head={<span className="fr-sheet-who"><b>GAMEPLAN</b><small>{opp ? `${up(opp.name)} · ${report.record ?? ''}` : 'THIS WEEK'}</small></span>}
      foot={<><button className="fr-btn fr-btn--line" onClick={() => { tap(); onClose() }}>STAFF DECIDES</button><button className="fr-btn" onClick={() => { sfx('send'); act(f => FR.setGameplan(f, { off, def })); onClose() }}>SET THE PLAN</button></>}>
      {(report?.strengths?.length > 0 || report?.weaknesses?.length > 0) && (
        <Panel title="Scouting report">
          {report.strengths.map((t, i) => <Fact key={`s${i}`} label="THEY DO WELL">{t}</Fact>)}
          {report.weaknesses.map((t, i) => <Fact key={`w${i}`} label="THEY DO BADLY">{t}</Fact>)}
        </Panel>
      )}
      <Panel title="Offense" role="radiogroup"><Choices options={FR.GAMEPLANS.off} value={off} onChange={setOff} /></Panel>
      <Panel title="Defense" role="radiogroup"><Choices options={FR.GAMEPLANS.def} value={def} onChange={setDef} /></Panel>
    </FrSheet>
  )
}

function PracticeSheet({ FR, F, act, onClose }) {
  const roster = useMemo(() => FR.roster(F).filter(r => r.starter && !r.inj), [FR, F])
  const [intensity, setIntensity] = useState(F.practice?.intensity ?? 'half')
  const [focus, setFocus] = useState(() => (F.practice?.focus ?? []).filter(id => roster.some(r => r.id === id)).slice(0, 3))
  const flip = id => { tap(); setFocus(f => (f.includes(id) ? f.filter(x => x !== id) : f.length >= 3 ? f : [...f, id])) }
  const p = FR.PRACTICE.find(x => x.id === intensity)
  return (
    <FrSheet open onClose={onClose} label="Practice"
      head={<span className="fr-sheet-who"><b>PRACTICE</b><small>{p?.label} · {focus.length} OF 3 FOCUS PLAYERS</small></span>}
      foot={<button className="fr-btn" onClick={() => { sfx('send'); act(f => FR.setPractice(f, { intensity, focus })); onClose() }}>SET PRACTICE</button>}>
      <Panel title="Intensity">
        <Seg label="Intensity" options={FR.PRACTICE.map(x => [x.id, x.label])} value={intensity} onChange={setIntensity} />
        <div className="fr-kv"><span>XP</span><b>{p ? `${Math.round(p.xp * 100)}%` : ''}</b></div>
        <div className="fr-kv"><span>WEAR</span><b>{p ? (p.wear > 0 ? `+${p.wear}` : p.wear < 0 ? `−${-p.wear}` : '0') : ''}</b></div>
      </Panel>
      <Panel title="Focus players" meta="EXTRA XP · UP TO THREE">
        {roster.map(r => (
          <button key={r.id} className={`fr-row fr-pick${focus.includes(r.id) ? ' is-on' : ''}`} role="checkbox" aria-checked={focus.includes(r.id)} onClick={() => flip(r.id)}>
            <span className="fr-pick-box" aria-hidden="true" />
            <span className="fr-t-pos">{r.at ?? r.slot}</span>
            <span className="fr-row-main">{r.name}</span>
            <span className="fr-t-num">{r.ovr}</span>
          </button>
        ))}
      </Panel>
    </FrSheet>
  )
}

// a front-office item: what happened, its real choices, and STAFF DECIDES (the engine's `delegate`)
function OfficeSheet({ FR, F, act, say, id, onClose }) {
  const item = useMemo(() => safe(() => FR.officeItems(F).find(x => x.id === id)), [FR, F, id])
  const [pick, setPick] = useState(null)
  if (!item) return null
  const who = item.who
  const settle = opt => { sfx('send'); const next = act(f => FR.resolveOffice(f, item.id, opt)); if (next?.flash?.ok && next.flash.msg) say(next.flash.msg); onClose() }
  const staffPick = item.options?.find(o => o.id === item.delegate)
  return (
    <FrSheet open onClose={onClose} label={item.title}
      head={<>{who && <Face name={who.name} photo={FR.photoUrl(who.photo)} />}<span className="fr-sheet-who"><b>{up(item.title)}</b>{who && <small>{up(who.name)}{who.slot ? ` · ${who.slot}` : who.roleName ? ` · ${up(who.roleName)}` : ''}{who.ovr ? ` · ${who.ovr} OVR` : ''}</small>}</span></>}
      foot={<><button className="fr-btn fr-btn--line" onClick={() => settle('delegate')}>STAFF DECIDES</button><button className="fr-btn" disabled={!pick} onClick={() => settle(pick)}>DECIDE</button></>}>
      {item.body && <p className="fr-read">{item.body}</p>}
      <Panel title="The call" meta={staffPick ? `STAFF: ${staffPick.label}` : null} role="radiogroup"><Choices options={item.options ?? []} value={pick} onChange={setPick} /></Panel>
    </FrSheet>
  )
}

// where the team is, and where the GM is taking it
function DirectionSheet({ FR, F, act, onClose }) {
  const st = useMemo(() => safe(() => FR.teamState(F)), [FR, F])
  const [pick, setPick] = useState(st?.direction ?? 'retool')
  const [said, setSaid] = useState(null)
  if (!st) return null
  const options = (FR.STATES ?? ['contend', 'retool', 'rebuild']).map(id => ({ id, label: DIR_VERB[id], text: FR.STATE_TEXT?.[id] ?? '', state: id === st.direction ? 'NOW' : id === st.state ? 'THE READ' : null }))
  const set = () => { sfx('send'); const next = act(f => FR.setDirection(f, pick)); if (next?.flash?.ok) setSaid(next.flash.msg ?? null) }
  return (
    <FrSheet open onClose={onClose} label="Direction"
      head={<span className="fr-sheet-who"><b>{up(st.nick)}: {st.label}</b><small>GM {up(F.gm?.name)} · DIRECTION {DIR_VERB[st.direction]}</small></span>}
      foot={st.canChange ? <button className="fr-btn" disabled={pick === st.direction} onClick={set}>SET THE DIRECTION</button> : null}>
      <p className="fr-said"><small>OWNERSHIP</small>{said ?? st.ownerSays}</p>
      <Panel title="The read" meta={st.record}>
        <Fact label="OUTLOOK" strong>{st.label}<small>{st.stateText}</small></Fact>
        <Fact label="WINDOW">{st.window?.text}</Fact>
        <Fact label="QUARTERBACK">{cap(st.qb?.text)}</Fact>
        <Fact label="HARDEST PART">{st.hardest}</Fact>
        <Fact label="BUILT ON">{st.upside}</Fact>
      </Panel>
      <Panel title="The direction" meta={st.canChange ? (F.phase === 'offseason' ? null : 'ONE CHANGE A SEASON') : 'SET FOR THE YEAR'} role="radiogroup">
        <Choices options={options} value={pick} onChange={setPick} disabled={!st.canChange} />
      </Panel>
    </FrSheet>
  )
}

// scouting points, spent a prospect at a time (the war room itself is the offseason's)
function ScoutSheet({ FR, F, act, onClose }) {
  const board = useMemo(() => safe(() => FR.draftBoard(F)), [FR, F])
  const rows = useMemo(() => (board?.prospects ?? []).slice(0, 60), [board])
  const pts = board?.pts ?? 0
  return (
    <FrSheet open onClose={onClose} label="Scouting"
      head={<span className="fr-sheet-who"><b>SCOUTING</b><small>{plural(pts, 'POINT')} TO SPEND · A TAP SPENDS ONE</small></span>}
      foot={<button className="fr-btn fr-btn--line" onClick={() => { tap(); onClose() }}>STAFF SCOUTS THE REST</button>}>
      <Panel title="The draft class" meta="TOP 60">
        <FrTable className="fr-table--tight" label="Prospects" rows={rows} onRow={pts > 0 ? r => act(f => FR.scoutProspect(f, r.id, 1)) : null} empty="NO BOARD YET"
          cols={[{ k: 'rk', label: 'RK', w: 34, cls: 'fr-t-rk', render: r => r.rank },
            { k: 'pos', label: 'POS', w: 42, cls: 'fr-t-pos', render: r => r.slot },
            { k: 'name', label: 'PROSPECT', cls: 'fr-t-name', render: r => <>{r.name}<span className="fr-t-sub">{r.college}</span></> },
            { k: 'range', label: 'GRADE', align: 'r', w: 70, cls: 'fr-t-lab', render: r => r.range?.text ?? '–' },
            { k: 'sc', label: 'SEEN', align: 'r', w: 44, cls: 'fr-t-dim', render: r => `${r.scouted ?? 0}/3` }]} />
      </Panel>
    </FrSheet>
  )
}

// where a row with no sheet of its own sends the GM
const GO_FOR = { upgrades: ['team', { view: 'develop' }], injury: ['team', { view: 'health' }], roster: ['team', { view: 'roster' }], trade: ['league', { view: 'market', sub: 'offers' }] }

// The offseason as the stage screens count it (offseason/frame.jsx RAIL): nine stages, the engine's in brackets
const OFF_RAIL = [
  { id: 'review', name: 'Season Review', at: ['review'] }, { id: 'direction', name: 'Direction', at: [] }, { id: 'staff', name: 'Coaching Staff', at: ['staff'] },
  { id: 'resign', name: 'Re-Sign Players', at: ['resign'] }, { id: 'fa', name: 'Free Agency', at: ['fa'] }, { id: 'draft', name: 'The Draft', at: ['draft'] },
  { id: 'udfa', name: 'Undrafted Free Agents', at: ['udfa'] }, { id: 'camp', name: 'Training Camp and Cuts', at: ['camp', 'cuts'] }, { id: 'season', name: 'New Season', at: [] },
]

export default function FrHub({ FR, F, hub, act, go, say, offseasonSeam }) {
  const [sheet, setSheet] = useState(null)   // { kind, id }
  const items = useMemo(() => safe(() => FR.officeItems(F), []), [FR, F])
  const call = items.find(o => o.kind === 'direction') ?? null   // the owner's call on a mid-season change of state
  // (the direction and the staff's advice have their own places on this page)
  // (a club that is out of the playoffs has no game to plan or practise for)
  const tasks = (hub.tasks ?? []).filter(t => t.kind !== 'direction' && t.kind !== 'advice' && t.id !== call?.id && !(hub.eliminated && (t.kind === 'practice' || t.kind === 'gameplan')))
  const open = tasks.filter(t => !t.done).length
  const onTask = t => { if (GO_FOR[t.kind]) go(...GO_FOR[t.kind]); else if (t.kind === 'office' && items.find(o => o.id === t.id)?.kind === 'trade-offer' && !items.find(o => o.id === t.id)?.options?.length) go('league', { view: 'market', sub: 'offers' }); else setSheet({ kind: t.kind, id: t.id }) }
  const next = hub.next, last = hub.lastGame, off = hub.phase === 'offseason'
  const stages = useMemo(() => (off ? safe(() => FR.offseason(F)) : null), [FR, F, off])
  const us = hub.team
  const mine = useDivisions(FR, F).find(d => d.teams.some(r => r.user))
  const room = useMemo(() => safe(() => FR.capSheet(F).space, hub.cap?.space ?? 0), [FR, F, hub])
  const st = useMemo(() => safe(() => FR.teamState(F)), [FR, F])
  const news = useMemo(() => safe(() => FR.news(F, 6), hub.headlines ?? []), [FR, F, hub])
  const game = !off && next && !hub.bye && next.opp ? [next.home ? next.opp : us, next.home ? us : next.opp] : null   // away, then home
  const recOf = t => (t.short === us.short ? hub.record.text : next?.oppRecord ?? '')
  const state = hub.state ?? st?.state, dir = hub.direction ?? st?.direction
  const advice = hub.advice ?? st?.advice ?? []
  const owner = hub.owner
  return (
    <div className="fr-page">
      {state && (
        <button className={`fr-statebar${dir && dir !== state ? ' is-split' : ''}`} onClick={() => { tap(); setSheet({ kind: 'direction' }) }} aria-label={`The ${us.nick} are ${hub.stateLabel}. Direction: ${DIR_VERB[dir]}. Open`}>
          <span><small>THE {up(us.nick)} ARE</small><b>{hub.stateLabel ?? st?.label}</b></span>
          <span className="fr-statebar-why"><p>{st?.window?.text}</p></span>
          <span><small>GM'S DIRECTION</small><b>{DIR_VERB[dir] ?? ''}</b></span>
        </button>
      )}
      <div className="fr-cols">
        <div className="fr-col">
          {call && (
            <Panel title={call.title} className="fr-event">
              <p className="fr-note" style={{ color: 'var(--fr-text)' }}>{call.body}</p>
              <div className="fr-pad"><button className="fr-btn fr-btn--wide" onClick={() => { tap(); setSheet({ kind: 'office', id: call.id }) }}>ANSWER THE OWNER</button></div>
            </Panel>
          )}
          {hub.headlines?.length > 0 && <FrTicker items={hub.headlines.map(n => n.head ?? n.text ?? n)} />}
          {off ? (
            <Panel title="Offseason" meta={stages?.stage ? `STAGE ${OFF_RAIL.findIndex(s => s.at.includes(stages.stage.id)) + 1} OF ${OFF_RAIL.length}` : String(hub.year)}>
              {OFF_RAIL.map((s, k) => { const n = OFF_RAIL.findIndex(r => r.at.includes(stages?.stage?.id)); return { ...s, done: n >= 0 && k < n, current: k === n } }).map(s => (
                <div key={s.id} className={`fr-row${s.current ? ' fr-row--now' : ''}`}>
                  <span className="fr-row-main">{s.name}</span>
                  <span className={`fr-row-state${s.done ? ' is-done' : s.current ? ' is-due' : ''}`}>{s.done ? 'DONE' : s.current ? 'NOW' : ''}</span>
                </div>
              ))}
              {!offseasonSeam && <p className="fr-note">The staff handles each stage as it is advanced.</p>}
            </Panel>
          ) : (
            <Panel title="This week" meta={open ? `${open} OPEN` : tasks.length ? 'ALL SET' : hub.weekLabel}
              action={open > 0 ? <button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => { sfx('send'); act(f => FR.delegateWeek(f)) }}>STAFF DOES THE REST</button> : null}>
              {!tasks.length && <div className="fr-empty">NOTHING WAITING ON THE GM</div>}
              {tasks.map(t => (
                <button key={t.id} className="fr-row" onClick={() => { tap(); onTask(t) }}>
                  <span className="fr-row-main">{up(t.title)}{t.detail && <small className="fr-task-detail">{up(noYear(F, t.detail))}</small>}</span>
                  <span className={`fr-row-state${t.done ? ' is-done' : ' is-due'}`}>{t.done ? 'DONE' : t.count > 1 ? `${t.count} OPEN` : 'OPEN'}</span>
                  <span className="fr-chev" />
                </button>
              ))}
            </Panel>
          )}
          {game ? (
            <Panel title="Next game" meta={next.label ?? hub.weekLabel}>
              {game.map((t, i) => (
                <div key={t.short} className={`fr-row fr-vs${t.short === us.short ? ' is-mine' : ''}`}>
                  <Logo team={t.short} size={30} />
                  <span className="fr-row-main">{up(t.name)}<small>{next.neutral ? 'NEUTRAL SITE' : i ? 'HOME' : 'AWAY'}</small></span>
                  <b className="fr-t-num">{recOf(t)}</b>
                </div>
              ))}
            </Panel>
          ) : !off && (
            <Panel title="Next game" meta={hub.weekLabel}><div className="fr-empty">{next?.eliminated ? up(hub.eliminated ?? `The season is over for the ${us.nick}`) : 'BYE WEEK'}</div></Panel>
          )}
          {advice.length > 0 && (
            <Panel title="From the staff" meta={dir ? `DIRECTION: ${DIR_VERB[dir]}` : null}>
              {advice.map((t, i) => <p key={i} className="fr-read fr-read--row">{cap(t)}</p>)}
            </Panel>
          )}
        </div>
        <div className="fr-col">
          <Panel title={us.nick} meta={`GM ${up(hub.gm.name)}${F.sandbox ? ' · SANDBOX' : ''}`}>
            {last && <div className="fr-kv"><span>LAST GAME</span><b>{last.tied ? 'T' : last.won ? 'W' : 'L'} {last.us}-{last.them}{last.ot ? ' OT' : ''} {last.home ? 'vs' : '@'} {last.opp.short}</b></div>}
            {hub.seed && (hub.record.w + hub.record.l + (hub.record.t ?? 0) > 0) ? <div className="fr-kv"><span>PLAYOFF SEED</span><b>{up(ord(hub.seed))}</b></div> : null}
            <div className="fr-kv"><span>CAP ROOM</span><b>{FR.moneyText(room)}</b></div>
          </Panel>
          {mine && <Panel title={mine.name} meta={hub.standing && (off || (hub.record?.w ?? 0) + (hub.record?.l ?? 0) + (hub.record?.t ?? 0) > 0) ? up(hub.standing) : null}><DivisionTable division={mine} compact /></Panel>}
          {owner && (
            <Panel title="The owner" meta={dir ? `JUDGED AS ${STATE_AS[dir]}` : null}>
              <div className="fr-kv"><span>JOB SECURITY</span><Security value={owner.security ?? hub.gm.security ?? 0} word={owner.word ?? hub.gm.securityWord ?? ''} floor={owner.floor} /></div>
              {(owner.goals ?? []).map(g => <div key={g.id} className="fr-kv"><span className="is-wrap">{up(g.text)}</span><b className={`is-text${g.done === false ? ' fr-t-dim' : ''}`}>{g.done === true ? 'MET' : g.done === false ? 'MISSED' : g.progress}</b></div>)}
            </Panel>
          )}
          {news.length > 0 && (
            <Panel title="News" action={<button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => { tap(); go('league', { view: 'news' }) }}>ALL NEWS</button>}>
              {news.map(n => <NewsRow key={n.id} n={n} mine={n.team?.short === us.short} />)}
            </Panel>
          )}
        </div>
      </div>
      {sheet?.kind === 'gameplan' && <GameplanSheet FR={FR} F={F} act={act} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'practice' && <PracticeSheet FR={FR} F={F} act={act} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'direction' && <DirectionSheet FR={FR} F={F} act={act} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'scout' && <ScoutSheet FR={FR} F={F} act={act} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'office' && <OfficeSheet FR={FR} F={F} act={act} say={say} id={sheet.id} onClose={() => setSheet(null)} />}
    </div>
  )
}
