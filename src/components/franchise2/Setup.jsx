import { useMemo, useState } from 'react'
import { TEAMS, TEAM, buildTeams, calibrate, strength, lineup, sideGrade, SCHEMES, STYLES, POS_LABEL, DIVISIONS } from '../../lib/franchise2'
import { POSITIONS, CAPS, POS_NAME } from '../../lib/squad'
import { ovrOf, nameOf, faceOf } from '../../lib/squadSeason'
import { sfx, haptic } from '../../lib/juice'
import { IconClose, IconArrow, IconCheck } from '../app/icons'
import { AvatarBadge } from '../app/NameTag'
import { Logo, Face, Ovr, Count, teamVars, lastName } from './bits'

// SETUP: the team (the wall of 32 logos), the builds (how many, which spots: each made on the build page),
// the coach (a name, the player's own avatar, a scheme and a style), then the season.
const MAX_BUILDS = 8
const SCHEME_FX = { air: 'PASS GAME +', ground: 'RUN GAME +', blitz: 'PASS RUSH +', nofly: 'COVERAGE +', balanced: 'A BIT OF EVERYTHING' }
const STYLE_FX = { players: 'CHEMISTRY GROWS FASTER', developer: 'YOUNG PLAYERS GROW FASTER', motivator: 'CLUTCH IN BIG GAMES', recruiter: 'FREE AGENTS AND PROSPECTS' }

export default function Setup({ setup, owner, put, onBuild, onStart, onBack }) {
  const step = setup.step ?? 'team'
  const S = { ...setup }
  const go = (patch, s) => { put({ ...S, ...patch }); if (s) sfx(s) }
  return (
    <div className="ag-screen cr--team f2 f2-setup" style={setup.team ? teamVars(setup.team) : undefined}>
      <div className="ag-screen-head">
        <div>
          <span className="ag-eyebrow">NEW FRANCHISE · {step === 'team' ? '1' : step === 'builds' ? '2' : '3'} OF 3</span>
          <h1 className="ag-h1">{step === 'team' ? 'PICK A TEAM' : step === 'builds' ? 'YOUR PLAYERS' : 'YOUR COACH'}</h1>
        </div>
        <button className="ag-round-btn" onClick={step === 'team' ? onBack : () => go({ step: step === 'coach' ? 'builds' : 'team' }, 'tap')} aria-label="Back"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        {step === 'team' && <TeamWall pick={setup.team} onPick={t => go({ team: t }, 'tap')} onGo={() => go({ step: 'builds' }, 'whistle')} />}
        {step === 'builds' && <Builds S={S} go={go} onBuild={onBuild} />}
        {step === 'coach' && <Coach S={S} owner={owner} go={go} onStart={onStart} />}
      </div>
    </div>
  )
}

// ── 1. The team wall ─────────────────────────────────────────────────────────
function useLeaguePreview() {
  return useMemo(() => { const F = { seed: 'preview', nid: 1 }; buildTeams(F); calibrate(F); return F }, [])
}
function TeamWall({ pick, onPick, onGo }) {
  const F = useLeaguePreview()
  return (
    <>
      {pick && <TeamCard F={F} s={pick} onGo={onGo} />}
      <div className="f2-wall">
        {DIVISIONS.map(d => (
          <div key={d.name} className="f2-wall-div">
            <span className="f2-wall-lbl">{d.name.toUpperCase()}</span>
            <div className="f2-wall-row">
              {d.teams.map(s => (
                <button key={s} className={`f2-wall-team${pick === s ? ' is-on' : ''}`} style={teamVars(s)} onClick={() => onPick(s)} aria-label={TEAM[s].name}>
                  <Logo s={s} size={40} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
function TeamCard({ F, s, onGo }) {
  const st = strength(F, s)
  const best = Object.values(lineup(F.teams[s])).sort((a, b) => b.o - a.o).slice(0, 3)
  return (
    <section key={s} className="f2-tcard ag-pop" style={teamVars(s)}>
      <div className="f2-tcard-top">
        <Logo s={s} size={64} />
        <span className="f2-tcard-name"><small>{TEAM[s].name.split(' ').slice(0, -1).join(' ').toUpperCase()}</small><b>{TEAM[s].nick.toUpperCase()}</b></span>
        <span className="f2-tcard-ovr"><b><Count v={st.ovr} /></b><small>TEAM OVR</small></span>
      </div>
      <div className="f2-tcard-mid">
        <span className="f2-side"><small>OFFENSE</small><b>{sideGrade(st.off)}</b></span>
        <span className="f2-side"><small>DEFENSE</small><b>{sideGrade(st.def)}</b></span>
        <span className="f2-tcard-stars">
          {best.map(p => <span key={p.i} className="f2-tcard-star"><Face F={F} p={p} size={40} /><small>{lastName(p.n).toUpperCase()}</small></span>)}
        </span>
      </div>
      <button className="ag-btn ag-btn--gold f2-go" onClick={onGo}>START HERE <IconArrow size={16} /></button>
    </section>
  )
}

// ── 2. The builds ────────────────────────────────────────────────────────────
function Builds({ S, go, onBuild }) {
  const picks = S.picks ?? []
  const count = pos => picks.filter(p => p.pos === pos).length
  const add = pos => { if (picks.length >= MAX_BUILDS || count(pos) >= CAPS.nfl[pos]) { sfx('deny'); return } const n = picks.filter(p => p.pos === pos).length; go({ picks: [...picks, { id: `${pos}${n + 1}-${Date.now().toString(36)}`, pos }] }, 'slot') }
  const drop = pos => { const last = [...picks].reverse().find(p => p.pos === pos); if (!last) return; const builds = { ...S.builds }; delete builds[last.id]; go({ picks: picks.filter(p => p !== last), builds }, 'tap') }
  const ordered = POSITIONS.nfl.flatMap(pos => picks.filter(p => p.pos === pos))
  const done = ordered.length > 0 && ordered.every(p => S.builds?.[p.id])
  const next = ordered.find(p => !S.builds?.[p.id])
  const build = p => { sfx('tap'); onBuild({ id: p.id, pos: p.pos, n: ordered.indexOf(p) + 1, of: ordered.length }) }
  return (
    <>
      <section className="f2-panel f2-picker ag-pop">
        <div className="f2-h"><span className="ag-eyebrow">HOW MANY</span><b className="f2-h-n"><Count v={picks.length} ms={300} /><small>/{MAX_BUILDS}</small></b></div>
        <div className="f2-picker-rows">
          {POSITIONS.nfl.map(pos => (
            <div key={pos} className={`f2-pick${count(pos) ? ' is-on' : ''}`}>
              <span className="f2-pick-pos"><b>{POS_LABEL[pos]}</b><small>{POS_NAME[pos].toUpperCase()}</small></span>
              <button className="f2-step" onClick={() => drop(pos)} disabled={!count(pos)} aria-label={`One fewer ${POS_NAME[pos]}`}>−</button>
              <b className="f2-pick-n">{count(pos)}</b>
              <button className="f2-step" onClick={() => add(pos)} disabled={picks.length >= MAX_BUILDS || count(pos) >= CAPS.nfl[pos]} aria-label={`One more ${POS_NAME[pos]}`}>+</button>
            </div>
          ))}
        </div>
      </section>
      {ordered.length > 0 && (
        <section className="f2-panel f2-builds ag-pop" style={{ '--d': '60ms' }}>
          <div className="f2-h"><span className="ag-eyebrow">BUILD THEM</span></div>
          {ordered.map(p => {
            const b = S.builds?.[p.id]
            const o = b ? ovrOf(p.pos, b.build) : null
            return (
              <button key={p.id} className={`f2-brow${b ? ' is-done' : ''}`} onClick={() => build(p)}>
                <span className="f2-pos">{POS_LABEL[p.pos]}</span>
                {b ? <Face src={faceOf(b.build)} name={POS_LABEL[p.pos]} size={40} mine /> : <span className="f2-face is-empty" style={{ width: 40, height: 40 }} />}
                <span className="f2-brow-txt"><b>{b ? nameOf(p.pos, b.build) : 'NOT BUILT'}</b><small>{b ? (b.sandbox ? 'SANDBOX' : 'READY') : 'TAP TO BUILD'}</small></span>
                {b ? <Ovr o={o} size="s" /> : <IconArrow size={16} />}
              </button>
            )
          })}
        </section>
      )}
      {done ? <button className="ag-btn ag-btn--gold f2-go" onClick={() => go({ step: 'coach' }, 'whistle')}>NEXT: THE COACH <IconArrow size={16} /></button>
        : next ? <button className="ag-btn ag-btn--gold f2-go" onClick={() => build(next)}>BUILD YOUR {POS_LABEL[next.pos]} <IconArrow size={16} /></button>
          : <p className="f2-hint">ADD AT LEAST ONE PLAYER</p>}
    </>
  )
}

// ── 3. The coach ─────────────────────────────────────────────────────────────
// Built like a player: the card on top fills one line at a time (the scheme, then the style)
function Coach({ S, owner, go, onStart }) {
  const c = S.coach ?? { name: owner, scheme: null, style: null }
  const set = patch => go({ coach: { ...c, ...patch } }, 'slot')
  const stage = !c.scheme ? 'scheme' : !c.style ? 'style' : 'done'
  return (
    <>
      <CoachCard c={c} team={S.team} owner={owner} onName={name => go({ coach: { ...c, name } })} onClear={k => go({ coach: { ...c, [k]: null } }, 'tap')} />
      {stage === 'scheme' && <Choices title="SCHEME" list={Object.entries(SCHEMES).map(([id, x]) => [id, x.name, SCHEME_FX[id]])} onPick={id => { set({ scheme: id }); haptic('light') }} />}
      {stage === 'style' && <Choices title="STYLE" list={Object.entries(STYLES).map(([id, x]) => [id, x.name, STYLE_FX[id]])} onPick={id => { set({ style: id }); haptic('light') }} />}
      {stage === 'done' && <button className="ag-btn ag-btn--gold f2-go ag-pop" onClick={() => onStart({ ...c, name: (c.name || owner).trim() || owner })}>START THE SEASON <IconArrow size={16} /></button>}
    </>
  )
}
function Choices({ title, list, onPick }) {
  return (
    <section className="f2-choices ag-pop">
      <span className="ag-eyebrow">PICK A {title}</span>
      {list.map(([id, name, fx], i) => (
        <button key={id} className="f2-choice ag-pop" style={{ '--d': `${i * 40}ms` }} onClick={() => onPick(id)}>
          <b>{name}</b><small>{fx}</small>
        </button>
      ))}
    </section>
  )
}
export function CoachCard({ c, team, owner, onName, onClear, small = false }) {
  return (
    <section className={`f2-coach${small ? ' is-small' : ''} ag-pop`} style={teamVars(team)}>
      <div className="f2-coach-band"><Logo s={team} size={small ? 28 : 36} /><span>HEAD COACH</span></div>
      <div className="f2-coach-body">
        <AvatarBadge self name={c.name || owner} size={small ? 56 : 84} />
        <div className="f2-coach-txt">
          {onName ? <input className="f2-coach-name" value={c.name ?? ''} maxLength={16} placeholder={owner} onChange={e => onName(e.target.value.replace(/[^A-Za-z0-9' .-]/g, ''))} aria-label="Coach name" />
            : <b className="f2-coach-name">{c.name}</b>}
          <div className="f2-coach-lines">
            {[['SCHEME', c.scheme && SCHEMES[c.scheme].name, 'scheme'], ['STYLE', c.style && STYLES[c.style].name, 'style']].map(([k, v, key]) => (
              <button key={k} className={`f2-coach-line${v ? ' is-in' : ''}`} onClick={() => v && onClear?.(key)} disabled={!onClear || !v}>
                <small>{k}</small><b>{v ?? '—'}</b>{v && onClear && <IconCheck size={12} />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
export { TEAMS }
