import { useMemo, useState } from 'react'
import { Panel, FrTicker, FrSheet, Logo, Steps, Seg, Face } from './frUi'
import { sfx, haptic } from '../../lib/juice'
import { useDivisions, DivisionTable } from './FrLeague'

// FRANCHISE: the HUB. The week on one page: the news, the next game, THIS WEEK (every row a thing the GM can do,
// every one optional: whatever is open when the week is played is done by the staff) and where the franchise
// stands. The main button (PLAY WEEK) is pinned by the frame (FranchiseMode.jsx).
//
// A row of THIS WEEK opens its own sheet here (the gameplan, practice, a front-office item) or sends the GM to
// the tab the work is on (upgrade points and the depth chart: TEAM; scouting and trade offers: OFFICE).

const ord = n => { const s = ['TH', 'ST', 'ND', 'RD'], v = n % 100; return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}` }
const tap = () => { sfx('tap'); haptic('light') }

// a list of choices, one picked (the gameplan's two sides, a front-office item's options)
function Choices({ options, value, onChange }) {
  return options.map(o => (
    <button key={o.id} className={`fr-row fr-pick${value === o.id ? ' is-on' : ''}`} role="radio" aria-checked={value === o.id} onClick={() => { tap(); onChange(o.id) }}>
      <span className="fr-pick-box" aria-hidden="true" />
      <span className="fr-row-main">{o.label}{(o.good || o.text) && <small>{String(/^against/i.test(o.good ?? '') ? `BEST ${o.good}` : o.text ?? o.good).replace(/\.$/, '').toUpperCase()}</small>}</span>
    </button>
  ))
}

function GameplanSheet({ FR, F, act, onClose }) {
  const plan = useMemo(() => { try { return FR.pregame(F)?.gameplan ?? null } catch { return null } }, [FR, F])
  const report = useMemo(() => { try { return FR.scoutingReport(F) } catch { return null } }, [FR, F])
  const [off, setOff] = useState(plan?.off?.id ?? 'balanced')
  const [def, setDef] = useState(plan?.def?.id ?? 'balanced')
  const opp = report?.opp
  return (
    <FrSheet open onClose={onClose} label="Gameplan"
      head={<span className="fr-sheet-who"><b>GAMEPLAN</b><small>{opp ? `${opp.name.toUpperCase()} · ${report.record ?? ''}` : 'THIS WEEK'}</small></span>}
      foot={<><button className="fr-btn fr-btn--line" onClick={() => { tap(); onClose() }}>LEAVE IT TO THE STAFF</button><button className="fr-btn" onClick={() => { sfx('send'); act(f => FR.setGameplan(f, { off, def })); onClose() }}>SET THE PLAN</button></>}>
      {(report?.strengths?.length > 0 || report?.weaknesses?.length > 0) && (
        <Panel title="Scouting report">
          {report.strengths.map((t, i) => <div key={`s${i}`} className="fr-kv"><span>THEY DO WELL</span><b className="is-text">{t}</b></div>)}
          {report.weaknesses.map((t, i) => <div key={`w${i}`} className="fr-kv"><span>THEY DO BADLY</span><b className="is-text">{t}</b></div>)}
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

function OfficeSheet({ FR, F, act, id, onClose }) {
  const item = useMemo(() => { try { return FR.officeItems(F).find(x => x.id === id) ?? null } catch { return null } }, [FR, F, id])
  const [pick, setPick] = useState(null)
  if (!item) return null
  const who = item.who
  return (
    <FrSheet open onClose={onClose} label={item.title}
      head={<>{who && <Face name={who.name} photo={FR.photoUrl(who.photo)} />}<span className="fr-sheet-who"><b>{String(item.title).toUpperCase()}</b>{who && <small>{who.name.toUpperCase()}{who.slot ? ` · ${who.slot}` : who.roleName ? ` · ${String(who.roleName).toUpperCase()}` : ''}</small>}</span></>}
      foot={<><button className="fr-btn fr-btn--line" onClick={() => { act(f => FR.resolveOffice(f, item.id, 'delegate')); onClose() }}>STAFF DECIDES</button><button className="fr-btn" disabled={!pick} onClick={() => { sfx('send'); act(f => FR.resolveOffice(f, item.id, pick)); onClose() }}>DECIDE</button></>}>
      {item.body && <p className="fr-read">{item.body}</p>}
      <Panel title="The call" role="radiogroup"><Choices options={item.options ?? []} value={pick} onChange={setPick} /></Panel>
    </FrSheet>
  )
}

// where a row with no sheet of its own sends the GM
const TAB_FOR = { upgrades: 'team', injury: 'team', roster: 'team', scout: 'office', trade: 'office' }

export default function FrHub({ FR, F, hub, act, go, offseasonSeam }) {
  const [sheet, setSheet] = useState(null)   // { kind, id }
  const tasks = hub.tasks ?? []
  const open = tasks.filter(t => !t.done).length
  const onTask = t => { if (TAB_FOR[t.kind]) go(TAB_FOR[t.kind]); else setSheet({ kind: t.kind, id: t.id }) }
  const next = hub.next, last = hub.lastGame, off = hub.phase === 'offseason'
  const stages = useMemo(() => { if (!off) return null; try { return FR.offseason(F) } catch { return null } }, [FR, F, off])
  const us = hub.team
  const mine = useDivisions(FR, F).find(d => d.teams.some(r => r.user))
  const room = useMemo(() => { try { return FR.capSheet(F).space } catch { return hub.cap?.space ?? 0 } }, [FR, F, hub])
  const game = !off && next && !hub.bye ? [next.home ? next.opp : us, next.home ? us : next.opp] : null   // away, then home
  const recOf = t => (t.short === us.short ? hub.record.text : next?.oppRecord ?? '')
  return (
    <div className="fr-page">
      <div className="fr-cols">
        <div className="fr-col">
          {hub.headlines?.length > 0 && <FrTicker items={hub.headlines.map(n => n.head ?? n.text ?? n)} />}
          {off ? (
            <Panel title="Offseason" meta={stages?.stage ? `STAGE ${stages.stage.n} OF ${stages.stage.of}` : String(hub.year)}>
              {(stages?.stages ?? []).map(s => (
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
                  <span className="fr-row-main">{String(t.title).toUpperCase()}{t.detail && <small>{String(t.detail).toUpperCase()}</small>}</span>
                  <span className={`fr-row-state${t.done ? ' is-done' : ' is-due'}`}>{t.done ? 'DONE' : t.count > 1 ? `${t.count} OPEN` : 'OPEN'}</span>
                  <span className="fr-chev" />
                </button>
              ))}
            </Panel>
          )}
          {mine && <Panel title={mine.name} meta={hub.standing ? String(hub.standing).toUpperCase() : null}><DivisionTable division={mine} compact /></Panel>}
        </div>
        <div className="fr-col">
          {game ? (
            <Panel title="Next game" meta={next.label ?? hub.weekLabel}>
              {game.map((t, i) => (
                <div key={t.short} className={`fr-row fr-vs${t.short === us.short ? ' is-mine' : ''}`}>
                  <Logo team={t.short} size={30} />
                  <span className="fr-row-main">{t.name.toUpperCase()}<small>{i ? 'HOME' : 'AWAY'}</small></span>
                  <b className="fr-t-num">{recOf(t)}</b>
                </div>
              ))}
            </Panel>
          ) : !off && (
            <Panel title="Next game" meta={hub.weekLabel}><div className="fr-empty">{next?.eliminated ? 'THE SEASON IS OVER FOR THE ' + us.nick.toUpperCase() : 'BYE WEEK'}</div></Panel>
          )}
          <Panel title={us.nick} meta={`GM ${String(hub.gm.name).toUpperCase()}`}>
            {last && <div className="fr-kv"><span>LAST GAME</span><b>{last.tied ? 'T' : last.won ? 'W' : 'L'} {last.us}-{last.them}{last.ot ? ' OT' : ''} {last.home ? 'vs' : '@'} {last.opp.short}</b></div>}
            {hub.seed ? <div className="fr-kv"><span>PLAYOFF SEED</span><b>{ord(hub.seed)}</b></div> : null}
            <div className="fr-kv"><span>CAP ROOM</span><b>{FR.moneyText(room)}</b></div>
            <div className="fr-kv"><span>JOB SECURITY</span><b className="is-text">{hub.gm.securityWord ?? hub.owner?.word ?? ''} <Steps value={hub.gm.security ?? hub.owner?.security ?? 0} low={hub.owner?.floor ?? 20} label={`Job security ${Math.round(hub.gm.security ?? 0)} of 100`} /></b></div>
          </Panel>
          {hub.owner?.goals?.length > 0 && (
            <Panel title="Owner's goals">
              {hub.owner.goals.map(g => <div key={g.id} className="fr-kv"><span className="is-wrap">{String(g.text).toUpperCase()}</span><b className={`is-text${g.done === false ? ' fr-t-dim' : ''}`}>{g.done === true ? 'MET' : g.done === false ? 'MISSED' : g.progress}</b></div>)}
            </Panel>
          )}
        </div>
      </div>
      {sheet?.kind === 'gameplan' && <GameplanSheet FR={FR} F={F} act={act} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'practice' && <PracticeSheet FR={FR} F={F} act={act} onClose={() => setSheet(null)} />}
      {sheet && sheet.kind !== 'gameplan' && sheet.kind !== 'practice' && <OfficeSheet FR={FR} F={F} act={act} id={sheet.id} onClose={() => setSheet(null)} />}
    </div>
  )
}
