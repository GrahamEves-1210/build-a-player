import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Bug, FrShell, Panel, GradeRow, Switch, Seg, Logo, Face, Confirm } from './frUi'
import { FR_TEAMS, DIVISIONS, teamOf, dressFor, inkOn } from './frTeams'
import { BUILD_POS, POS_LABEL, SETUP_STEPS, countAt, addPick, dropPick, patchPick, cleanName, previewLeague, teamPreview } from './frStore'
import { randomName } from '../../lib/playerNames'
import { sfx, haptic } from '../../lib/juice'
import { FRANCHISE_ART } from '../../lib/franchiseLive'

// FRANCHISE: the way in. The saves (three slots: continue, new, delete), then a new franchise in four steps:
//   1 PICK A TEAM       all 32, one at a time, with the numbers the engine gives the league it will start in
//   2 BUILD YOUR GUYS   which roster spots to build (Squad Builder's caps), each one built on the game's own
//                       build screen (App.jsx 'franchise-build': onBuild out, the build back in `built`) and named
//   3 THE HEAD COACH    keep the team's real one, or build one (SEAM: ./coach/CoachBuild.jsx, another agent's:
//                       props { team, onDone(coach | null), onBack() }, coach = { name, build }; while that file
//                       isn't there the step only offers KEEP)
//   4 THE LEAGUE        the GM's name, Play the Moments, injuries, the cap, what the staff handles
// The setup is plain data (frStore.js: saved on the device after every change).

const COACH = import.meta.glob('./coach/CoachBuild.jsx')
const loadCoach = COACH['./coach/CoachBuild.jsx']
const CoachBuild = loadCoach ? lazy(() => loadCoach().then(m => ({ default: m.default ?? m.CoachBuild }))) : null

const ORDER = DIVISIONS.flatMap(d => d.teams)
const stepLine = step => `NEW FRANCHISE · ${SETUP_STEPS.indexOf(step) + 1} OF ${SETUP_STEPS.length}`
const lastOf = name => { const p = String(name || '').replace(/\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i, '').split(' '); return p[p.length - 1] || name }
const tap = () => { sfx('tap'); haptic('light') }

// ── the saves ───────────────────────────────────────────────────────────────
const whenOf = s => (s.phase === 'offseason' ? `${s.year} · OFFSEASON` : `${s.year} · ${s.week <= 18 ? `WEEK ${s.week}` : ['WILD CARD', 'DIVISIONAL ROUND', 'CONFERENCE CHAMPIONSHIP', 'SUPER BOWL'][s.week - 19] ?? 'PLAYOFFS'}`)
export function Slots({ slots, setup, onOpen, onNew, onResume, onDelete, onDropSetup, onHome }) {
  const [ask, setAsk] = useState(null)   // { slot } | { setup: true }
  const gone = ask?.setup ? 'this setup' : ask ? `${teamOf(slots[ask.slot]?.team).nick}` : ''
  return (
    <>
      <FrShell bug={<Bug title="FRANCHISE" eyebrow="FOOTBALL" onExit={onHome} exit="HOME" />}>
        <div className="fr-page fr-page--narrow">
          {FRANCHISE_ART.hero && <img className="fr-hero" src={FRANCHISE_ART.hero} alt="" draggable={false} onError={e => { e.currentTarget.style.display = 'none' }} />}
          <Panel title="Franchises" meta="THREE SAVES">
            {slots.map(s => {
              const setting = !!setup && setup.slot === s.slot && s.empty
              if (setting) {
                const t = setup.team ? teamOf(setup.team) : null
                return (
                  <div key={s.slot} className="fr-row fr-slot">
                    <button className="fr-slot-open" onClick={() => { tap(); onResume() }}>
                      <span className="fr-slot-n">{s.slot + 1}</span>
                      {t ? <Logo team={t.short} size={34} /> : <span className="fr-slot-blank" />}
                      <span className="fr-row-main">{t ? t.nick.toUpperCase() : 'NEW FRANCHISE'}<small>SETUP IN PROGRESS</small></span>
                      <span className="fr-chev" />
                    </button>
                    <button className="fr-slot-del" onClick={() => { tap(); setAsk({ setup: true }) }}>DELETE</button>
                  </div>
                )
              }
              if (s.empty) return (
                <button key={s.slot} className="fr-row fr-slot-new" onClick={() => { tap(); onNew(s.slot) }}>
                  <span className="fr-slot-n">{s.slot + 1}</span>
                  <span className="fr-row-main fr-t-dim">EMPTY</span>
                  <span className="fr-row-state is-done">NEW FRANCHISE</span>
                  <span className="fr-chev" />
                </button>
              )
              const t = teamOf(s.team)
              return (
                <div key={s.slot} className="fr-row fr-slot">
                  <button className="fr-slot-open" onClick={() => { tap(); onOpen(s.slot) }}>
                    <span className="fr-slot-n">{s.slot + 1}</span>
                    <Logo team={s.team} size={34} />
                    <span className="fr-row-main">{t.nick.toUpperCase()}{s.rings > 0 && <i className="fr-rings">{s.rings}X CHAMPIONS</i>}<small>{whenOf(s)} · {s.record ?? '0-0'} · GM {String(s.gm ?? '').toUpperCase()}</small></span>
                    <span className="fr-chev" />
                  </button>
                  <button className="fr-slot-del" onClick={() => { tap(); setAsk({ slot: s.slot }) }}>DELETE</button>
                </div>
              )
            })}
          </Panel>
        </div>
      </FrShell>
      <Confirm open={!!ask} danger title={ask?.setup ? 'Delete this setup?' : `Delete the ${gone} franchise?`}
        body={ask?.setup ? 'The team and the builds picked so far are dropped.' : ask ? `${whenOf(slots[ask.slot])} · ${slots[ask.slot].record ?? '0-0'}. It can't be brought back.` : ''}
        yes="DELETE" no="KEEP IT" onNo={() => setAsk(null)} onYes={() => { const a = ask; setAsk(null); if (a.setup) onDropSetup(); else onDelete(a.slot) }} />
    </>
  )
}

// ── 1: pick a team ──────────────────────────────────────────────────────────
function TeamPick({ FR, setup, onSetup, onNext, onBack }) {
  const [at, setAt] = useState(() => Math.max(0, ORDER.findIndex(t => t.short === setup.team)))
  const t = ORDER[at]
  // the league the numbers come from: built once, a moment after the screen is up
  const [P, setP] = useState(null)
  useEffect(() => { const id = setTimeout(() => setP(previewLeague(FR, setup.seed)), 40); return () => clearTimeout(id) }, [FR, setup.seed])
  const pv = useMemo(() => (P ? teamPreview(FR, P, t.short) : null), [FR, P, t.short])
  useEffect(() => { dressFor(t.short) }, [t.short])
  const go = i => { tap(); setAt((i + ORDER.length) % ORDER.length) }
  const swipe = useRef(null)
  const onDown = e => { swipe.current = [e.clientX, e.clientY] }
  const onUp = e => { const s = swipe.current; swipe.current = null; if (!s) return; const dx = e.clientX - s[0], dy = e.clientY - s[1]; if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) go(at + (dx < 0 ? 1 : -1)) }
  useEffect(() => {
    const onKey = e => { if (e.key === 'ArrowRight') setAt(i => (i + 1) % ORDER.length); else if (e.key === 'ArrowLeft') setAt(i => (i - 1 + ORDER.length) % ORDER.length) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const random = () => { let i = at; while (i === at) i = Math.floor(Math.random() * ORDER.length); sfx('swap'); haptic('medium'); setAt(i) }
  const take = () => { sfx('send'); haptic('medium'); onSetup({ ...setup, team: t.short, step: 'builds' }); onNext() }
  const coach = c => (c ? <b className="is-text">{c.name}{!c.placeholder && c.grade ? <em className="fr-kv-grade">{c.grade}</em> : null}</b> : <b className="is-text fr-t-dim">…</b>)
  const ink = inkOn(t.raw)
  return (
    <FrShell mainKey="team" bug={<Bug title="PICK A TEAM" eyebrow={stepLine('team')} onExit={onBack} exit="BACK" />}
      cta={<button className="fr-btn" onClick={take}>TAKE OVER THE {t.nick.toUpperCase()}</button>}>
      <div className="fr-page">
        <div className="fr-cols">
          <div className="fr-col">
            <section className="fr-plate" style={{ '--plate': t.raw, '--plate-2': t.color2, '--plate-ink': ink }} onPointerDown={onDown} onPointerUp={onUp} aria-label={`${t.name}, ${t.div}`}>
              <button className="fr-plate-go is-prev" onClick={() => go(at - 1)} aria-label="Previous team" />
              <Logo team={t.short} size={92} />
              <div className="fr-plate-txt"><small>{t.city.toUpperCase()}</small><b>{t.nick.toUpperCase()}</b><small>{t.div.toUpperCase()} · {at + 1} OF 32</small></div>
              <button className="fr-plate-go" onClick={() => go(at + 1)} aria-label="Next team" />
            </section>
            <Panel title="The roster" meta={pv?.ratings?.offRank ? `OFF NO. ${pv.ratings.offRank} · DEF NO. ${pv.ratings.defRank}` : 'STARTERS'}>
              {(pv?.groups ?? BUILD_POS.map(p => ({ key: p.label, label: p.name.toUpperCase(), grade: '', ovr: null }))).map(g => <GradeRow key={g.key} label={g.label} grade={g.grade || '–'} v={g.ovr == null ? 0 : (g.ovr - 60) / 3.5} />)}
            </Panel>
          </div>
          <div className="fr-col">
            <Panel title="The building">
              <div className="fr-kv"><span>CAP ROOM</span><b>{pv?.capSpace != null ? FR.moneyText(pv.capSpace) : '…'}</b></div>
              <div className="fr-kv"><span>HEAD COACH</span>{coach(pv?.staff?.hc)}</div>
              <div className="fr-kv"><span>OFFENSE</span>{coach(pv?.staff?.oc)}</div>
              <div className="fr-kv"><span>DEFENSE</span>{coach(pv?.staff?.dc)}</div>
            </Panel>
            <Panel title="All 32" action={<button className="fr-btn fr-btn--line fr-btn--sm" onClick={random}>RANDOM TEAM</button>}>
              {DIVISIONS.map(d => (
                <div key={d.div} className="fr-div">
                  <span>{d.div.toUpperCase()}</span>
                  {d.teams.map(x => <button key={x.short} className={x.short === t.short ? 'is-on' : undefined} aria-pressed={x.short === t.short} aria-label={x.name} onClick={() => go(ORDER.indexOf(x))}>{x.short}</button>)}
                </div>
              ))}
            </Panel>
          </div>
        </div>
      </div>
    </FrShell>
  )
}

// ── 2: build your guys ──────────────────────────────────────────────────────
function Builds({ FR, setup, onSetup, onNext, onBack, onBuild }) {
  const caps = FR.BUILD_CAPS
  const picks = setup.picks
  const built = picks.filter(p => p.build).length
  const todo = picks.find(p => !p.build)
  const total = BUILD_POS.reduce((n, p) => n + (caps[p.pos] ?? 0), 0)
  const build = p => { sfx('send'); haptic('medium'); onBuild({ id: p.id, pos: p.pos, n: picks.indexOf(p) + 1, of: picks.length }) }
  const t = teamOf(setup.team)
  return (
    <FrShell mainKey="builds" bug={<Bug title="BUILD YOUR GUYS" eyebrow={stepLine('builds')} onExit={onBack} exit="BACK" />}
      cta={todo ? <button className="fr-btn" onClick={() => build(todo)}>BUILD THE {POS_LABEL[todo.pos]}</button> : <button className="fr-btn" onClick={() => { sfx('send'); onSetup({ ...setup, step: 'coach' }); onNext() }}>CONTINUE</button>}>
      <div className="fr-page">
        <div className="fr-cols is-even">
          <Panel title="Roster spots" meta={`${picks.length} OF ${total}`}>
            {BUILD_POS.map(p => {
              const n = countAt(setup, p.pos), cap = caps[p.pos] ?? 0
              return (
                <div key={p.pos} className="fr-row fr-count">
                  <span className="fr-t-pos">{p.label}</span>
                  <span className="fr-row-main">{p.name}</span>
                  <span className="fr-count-ctl">
                    <button className="is-less" disabled={n === 0} aria-label={`One fewer ${p.name}`} onClick={() => { tap(); onSetup(dropPick(setup, p.pos)) }} />
                    <b aria-label={`${n} of ${cap}`}>{n}<small>/{cap}</small></b>
                    <button disabled={n >= cap} aria-label={`One more ${p.name}`} onClick={() => { tap(); onSetup(addPick(setup, p.pos)) }} />
                  </span>
                </div>
              )
            })}
          </Panel>
          <Panel title="The builds" meta={picks.length ? `${built} OF ${picks.length} BUILT` : null}>
            {!picks.length && <div className="fr-empty">NONE PICKED: THE {t.nick.toUpperCase()}' REAL ROSTER PLAYS EVERY SPOT</div>}
            {picks.map(p => (
              <div key={p.id} className="fr-row fr-build">
                <span className="fr-t-pos">{POS_LABEL[p.pos]}</span>
                <input className="fr-input" value={p.name} maxLength={22} spellCheck={false} autoComplete="off" aria-label={`${POS_LABEL[p.pos]} name`}
                  onChange={e => onSetup(patchPick(setup, p.id, { name: cleanName(e.target.value) }))} onBlur={() => { if (!p.name.trim()) onSetup(patchPick(setup, p.id, { name: randomName() })) }} />
                <button className="fr-btn fr-btn--quiet fr-btn--sm" onClick={() => { tap(); onSetup(patchPick(setup, p.id, { name: randomName(p.name) })) }}>NEW NAME</button>
                <span className="fr-build-state">{p.build ? <><b>{p.ovr}</b> OVR{p.arch ? ` · ${String(p.arch).toUpperCase()}` : ''}</> : 'NOT BUILT'}</span>
                <button className={`fr-btn fr-btn--sm${p.build ? ' fr-btn--line' : ''}`} onClick={() => build(p)}>{p.build ? 'REBUILD' : 'BUILD'}</button>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </FrShell>
  )
}

// ── 3: the head coach ───────────────────────────────────────────────────────
function CoachStep({ FR, setup, onSetup, onNext, onBack }) {
  const [building, setBuilding] = useState(false)
  const [P, setP] = useState(null)
  useEffect(() => { const id = setTimeout(() => setP(previewLeague(FR, setup.seed)), 40); return () => clearTimeout(id) }, [FR, setup.seed])
  const staff = useMemo(() => { try { return P ? FR.staff(P, setup.team) : null } catch { return null } }, [FR, P, setup.team])
  const real = staff?.hc ?? null, mine = setup.coach
  const next = coach => { sfx('send'); onSetup({ ...setup, coach, realCoach: real && !real.placeholder ? real.name : null, step: 'settings' }); onNext() }
  if (building && CoachBuild) {
    return (
      <Suspense fallback={<div className="fr" />}>
        <CoachBuild team={setup.team} onBack={() => setBuilding(false)} onDone={c => { setBuilding(false); onSetup({ ...setup, coach: c && c.build ? { name: c.name, build: c.build } : null }) }} />
      </Suspense>
    )
  }
  const keep = real && !real.placeholder ? `KEEP ${lastOf(real.name).toUpperCase()}` : 'KEEP THE HEAD COACH'
  // a built coach's five ratings, read off his build (each slot: { type, val })
  const mineRows = mine ? (Array.isArray(mine.build) ? mine.build : Object.values(mine.build ?? {})).filter(Boolean).map(s => ({ key: s.type, label: FR.COACH_LABEL?.[s.type] ?? String(s.type).toUpperCase(), val: s.val, grade: FR.gradeOf(s.val) })) : null
  const rows = mineRows ?? real?.ratings ?? []
  return (
    <FrShell mainKey="coach" bug={<Bug title="THE HEAD COACH" eyebrow={stepLine('coach')} onExit={onBack} exit="BACK" />}
      cta={mine
        ? <><button className="fr-btn fr-btn--line" onClick={() => { tap(); onSetup({ ...setup, coach: null }) }}>{keep}</button><button className="fr-btn" onClick={() => next(mine)}>CONTINUE</button></>
        : <>{CoachBuild && <button className="fr-btn fr-btn--line" onClick={() => { tap(); setBuilding(true) }}>BUILD THE COACH</button>}<button className="fr-btn" onClick={() => next(null)}>{keep}</button></>}>
      <div className="fr-page">
        <div className="fr-cols is-even">
          <Panel title="Head coach" meta={mine ? 'BUILT' : real?.record ?? null}>
            <div className="fr-row">{(mine || (real && !real.placeholder)) && <Face name={mine?.name ?? real.name} />}<span className="fr-row-main">{mine?.name ?? real?.name ?? '…'}<small>{teamOf(setup.team).name.toUpperCase()}</small></span>{!mine && real?.grade && <span className="fr-t-num">{real.grade}</span>}</div>
            {rows.map(r => <GradeRow key={r.key} label={r.label} grade={r.grade} v={r.val} />)}
          </Panel>
          <div className="fr-col">
            <Panel title="Coordinators">
              {[['OFFENSE', staff?.oc], ['DEFENSE', staff?.dc]].map(([k, c]) => (
                <div key={k} className="fr-kv"><span>{k}</span><b className="is-text">{c?.name ?? '…'}{c && !c.placeholder && c.grade ? <em className="fr-kv-grade">{c.grade}</em> : null}</b></div>
              ))}
            </Panel>
            {mine && real && <Panel title="On the market"><div className="fr-kv"><span>{real.name.toUpperCase()}</span><b className="is-text fr-t-dim">Replaced</b></div></Panel>}
          </div>
        </div>
      </div>
    </FrShell>
  )
}

// ── 4: the league ───────────────────────────────────────────────────────────
function LeagueSettings({ FR, setup, onSetup, onBack, onCreate, busy }) {
  const s = { ...FR.DEFAULT_SETTINGS, ...setup.settings }
  const set = patch => onSetup({ ...setup, settings: { ...setup.settings, ...patch } })
  const t = teamOf(setup.team)
  const built = setup.picks.filter(p => p.build).length
  return (
    <FrShell mainKey="settings" bug={<Bug title="THE LEAGUE" eyebrow={stepLine('settings')} onExit={onBack} exit="BACK" />}
      cta={<button className="fr-btn" disabled={busy} onClick={onCreate}>{busy ? 'SETTING UP THE LEAGUE' : 'START THE FRANCHISE'}</button>}>
      <div className="fr-page">
        <div className="fr-cols is-even">
          <div className="fr-col">
            <Panel title="General manager">
              <label className="fr-row fr-field"><span className="fr-row-state">NAME</span>
                <input className="fr-input" value={setup.gmName} maxLength={18} spellCheck={false} autoComplete="off" onChange={e => onSetup({ ...setup, gmName: cleanName(e.target.value).slice(0, 18) })} />
              </label>
              <div className="fr-kv"><span>TEAM</span><b className="is-text">{t.name}</b></div>
              <div className="fr-kv"><span>BUILT PLAYERS</span><b>{built}</b></div>
              <div className="fr-kv"><span>HEAD COACH</span><b className="is-text">{setup.coach ? setup.coach.name : setup.realCoach ?? "The team's own"}</b></div>
            </Panel>
            <Panel title="Game day">
              <Switch label="Play the Moments" note="THE BIGGEST PLAYS, AS MINI GAMES" on={s.moments} onChange={v => set({ moments: v, calls: v })} />
            </Panel>
          </div>
          <div className="fr-col">
            <Panel title="League">
              <Switch label="Injuries" on={s.injuries} onChange={v => set({ injuries: v })} />
              <Switch label="Salary cap" on={s.cap} onChange={v => set({ cap: v })} />
              <Switch label="The owner can fire the GM" on={s.firing} onChange={v => set({ firing: v })} />
              <div className="fr-row fr-row--seg"><span className="fr-row-main">Trades</span><Seg label="Trade difficulty" options={[['easy', 'EASY'], ['fair', 'FAIR'], ['hard', 'HARD']]} value={s.tradeAI} onChange={v => set({ tradeAI: v })} /></div>
            </Panel>
            <Panel title="The staff handles">
              <Switch label="Depth chart" note="RE-SET EVERY WEEK" on={s.autoDepth} onChange={v => set({ autoDepth: v })} />
              <Switch label="Upgrade points" note="SPENT AS THEY ARE EARNED" on={s.autoUpgrade} onChange={v => set({ autoUpgrade: v })} />
              <Switch label="Roster holes" note="A SIGNING WHEN A SPOT IS SHORT" on={s.autoRoster} onChange={v => set({ autoRoster: v })} />
            </Panel>
          </div>
        </div>
      </div>
    </FrShell>
  )
}

// the four steps; `step` is in the setup itself
export default function FrSetup({ FR, setup, onSetup, onBuild, onCreate, onLeave, busy }) {
  const step = SETUP_STEPS.includes(setup.step) && (setup.team || setup.step === 'team') ? setup.step : 'team'
  const to = s => onSetup({ ...setup, step: s })
  // (the team step dresses the screens in whichever club is up: TeamPick)
  useEffect(() => { if (step !== 'team') dressFor(setup.team) }, [setup.team, step])
  const nop = () => {}
  if (step === 'team') return <TeamPick FR={FR} setup={setup} onSetup={onSetup} onNext={nop} onBack={onLeave} />
  if (step === 'builds') return <Builds FR={FR} setup={setup} onSetup={onSetup} onNext={nop} onBack={() => to('team')} onBuild={onBuild} />
  if (step === 'coach') return <CoachStep FR={FR} setup={setup} onSetup={onSetup} onNext={nop} onBack={() => to('builds')} />
  return <LeagueSettings FR={FR} setup={setup} onSetup={onSetup} onBack={() => to('coach')} onCreate={onCreate} busy={busy} />
}
