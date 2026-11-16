import { useEffect, useMemo, useState } from 'react'
import { TEAM, buildTeams, calibrate, strength, lineup, sideGrade, POS_LABEL, DIVISIONS, DIV_OF, realHC, coachGrade, newCoachBuild, linesDone } from '../../lib/franchise2'
import { coachPhoto } from './coachFace'
import { lastSeason } from '../../lib/franchise2/lastSeason'
import { rookieScale } from '../../lib/franchise2/contracts'
import { cleanName, nameOk, randomFirstLast, takenOn, freeNumbers, legalFor, pickNumber, rookieSlots } from '../../lib/franchise2/identity'
import { POSITIONS, CAPS, POS_NAME } from '../../lib/squad'
import { ovrOf } from '../../lib/squadSeason'
import { defaultFace, buildFaceUrl, FACE_KEYS } from '../../lib/franchise2/faces'
import { sfx, haptic } from '../../lib/juice'
import { IconClose, IconSpin, IconCaret } from '../app/icons'
import { Chyron, LowerThird, ManL3, BigNum, Fact, Go, TeamSlab, KLogo, fkVars, splitName } from './kit'
import { CoachSpin, StylePick, CoachWho, CoachReveal } from './CoachBuild'
import './setup.css'
import { teamKit } from '../../lib/franchise2/kits'

// SETUP: a new franchise, in the order a new GM's first week goes.
//   1 THE TEAM    the 32 logos by division; a team's card: last season, team OVR, its real head coach and stars
//   2 PLAYERS     how many of the player's own builds and where; each is made on the game's build page (App.jsx:
//                 onBuild out, `built` back, FranchiseMode), then named and numbered here. Builds are rookies.
//   3 THE COACH   spun like a player from the league's real head coaches (CoachBuild.jsx), a style, a name, a face
//   4 THE HIRE    the coach card, and the season starts
// The setup is saved in its slot after every change (FranchiseMode putSetup), so leaving for the build page and
// coming back, or a reload, picks up where it was.
const MAX_BUILDS = 8
const STEPS = [['team', 'TEAM'], ['builds', 'PLAYERS'], ['coach', 'COACH'], ['hire', 'HIRE']]
const GROUP = { team: 'team', card: 'team', builds: 'builds', coach: 'coach', style: 'coach', who: 'coach', hire: 'hire' }
const BACK = { card: 'team', builds: 'card', coach: 'builds', style: 'coach', who: 'style', hire: 'who' }

export default function Setup({ setup, owner, put, onBuild, onStart, onBack }) {
  const step = setup.step ?? 'team'
  const S = setup
  const go = (patch, s) => { put({ ...S, ...patch }); if (s) sfx(s) }
  const naming = S.naming && S.builds?.[S.naming] ? S.naming : null
  // the coach build: one per team (his own team's coach is never on the wheel)
  useEffect(() => {
    if (step === 'coach' && S.team && (!S.cb || S.cb.team !== S.team)) put({ ...S, cb: newCoachBuild(`${S.seed}-coach`, S.team) })
  }, [step, S.team]) // eslint-disable-line react-hooks/exhaustive-deps
  const back = () => {
    if (naming) return go({ naming: null }, 'back')
    if (step === 'team') return onBack()
    go({ step: BACK[step] }, 'back')
  }
  const at = STEPS.findIndex(([k]) => k === GROUP[step])
  return (
    <div className="fk-root fsu" style={S.team && step !== 'team' ? fkVars(S.team) : undefined}>
      <div className="fsu-top">
        <button type="button" className="fsu-x" onClick={back} aria-label={step === 'team' && !naming ? 'Close' : 'Back'}>
          {step === 'team' && !naming ? <IconClose size={16} /> : <IconCaret dir="left" size={18} />}
        </button>
        <ol className="fsu-steps" aria-label="New franchise">
          {STEPS.map(([k, label], i) => <li key={k} className={i < at ? 'is-done' : i === at ? 'is-on' : ''}><b>{i + 1}</b>{label}</li>)}
        </ol>
      </div>
      <div className="fsu-body" key={naming ? `n-${naming}` : step}>
        {naming ? <NameStep S={S} id={naming} owner={owner} onDone={patch => go({ ...patch, naming: null }, 'claim')} />
          : step === 'team' ? <TeamWall pick={S.team} onPick={t => go({ team: t, step: 'card' }, 'tap')} />
            : step === 'card' ? <TeamCard s={S.team} onPick={t => go({ team: t }, 'tap')} onGo={() => { go({ step: 'builds' }, 'whistle'); haptic('medium') }} />
              : step === 'builds' ? <Builds S={S} go={go} owner={owner} onBuild={onBuild} />
                : step === 'coach' ? (S.cb?.team === S.team ? <CoachSpin S={S} go={go} onDone={() => go({ step: 'style' }, 'whistle')} /> : null)
                  : step === 'style' ? <StylePick S={S} go={go} onDone={() => go({ step: 'who' }, 'tap')} />
                    : step === 'who' ? <CoachWho S={S} go={go} owner={owner} onDone={() => go({ step: 'hire' }, 'whistle')} />
                      : step === 'hire' && S.cb && linesDone(S.cb) ? <CoachReveal S={S} owner={owner} onStart={onStart} /> : null}
      </div>
    </div>
  )
}

// ── 1. The team ──────────────────────────────────────────────────────────────
// the league as it stands before anyone touches it (the same rosters every new franchise starts from)
let PREVIEW = null
function preview() {
  if (!PREVIEW) { const F = { seed: 'preview', nid: 1 }; buildTeams(F); calibrate(F); PREVIEW = F }
  return PREVIEW
}
function TeamWall({ pick, onPick }) {
  return (
    <div className="fsu-wall">
      <Chyron tone="ink" title="Pick a team" sub="32 TEAMS · 8 DIVISIONS" />
      {DIVISIONS.map((d, i) => (
        <div key={d.name} className="fsu-div" style={{ '--d': `${i * 30}ms` }}>
          <span className="fsu-div-lbl">{d.name.toUpperCase()}</span>
          <div className="fsu-div-row">
            {d.teams.map(s => (
              <button key={s} type="button" className={`fsu-tm${pick === s ? ' is-on' : ''}`} style={fkVars(s)} onClick={() => onPick(s)} aria-label={TEAM[s].name}>
                <KLogo s={s} size={44} />
                <small>{s}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
const ORDER = DIVISIONS.flatMap(d => d.teams)
function TeamCard({ s, onPick, onGo }) {
  const F = preview()
  const st = strength(F, s)
  const ls = lastSeason(s)
  const hc = realHC(s)
  const stars = Object.values(lineup(F.teams[s])).sort((a, b) => b.o - a.o).slice(0, 3)
  const i = ORDER.indexOf(s)
  const prev = ORDER[(i + 31) % 32], next = ORDER[(i + 1) % 32]
  return (
    <div className="fsu-card" key={s}>
      <div className="fsu-card-nav">
        <button type="button" onClick={() => onPick(prev)} aria-label={TEAM[prev].name}><IconCaret dir="left" size={14} /><KLogo s={prev} size={22} />{prev}</button>
        <span>{DIV_OF[s].toUpperCase()}</span>
        <button type="button" onClick={() => onPick(next)} aria-label={TEAM[next].name}>{next}<KLogo s={next} size={22} /><IconCaret dir="right" size={14} /></button>
      </div>
      <TeamSlab s={s} size="l" rec={ls?.rec} sub={ls ? `${ls.year} SEASON` : null} />
      {ls && <div className="fsu-last">{ls.div && <b>{DIV_OF[s].toUpperCase()} CHAMPIONS</b>}<span className={ls.champ ? 'is-gold' : ''}>{ls.end}</span></div>}
      <div className="fsu-card-nums">
        <BigNum v={st.ovr} label="TEAM OVR" size={58} />
        <Fact v={sideGrade(st.off)} label="OFFENSE" size={40} />
        <Fact v={sideGrade(st.def)} label="DEFENSE" size={40} />
      </div>
      {hc && (
        <>
          <Chyron tone="ink" size="s" title="Head coach" />
          <LowerThird name={hc.name} pos="HC" team={s} photo={coachPhoto({ n: hc.name, ag: hc.age }, s)} stat={{ v: coachGrade(hc.attrs), label: 'GRADE' }} line={hc.since === 2026 ? 'FIRST SEASON' : `SINCE ${hc.since}`} delay={60} />
        </>
      )}
      <Chyron tone="ink" size="s" title="Best players" />
      <div className="fsu-stars">
        {stars.map((p, k) => <ManL3 key={p.i} F={F} p={p} team={s} size="s" delay={120 + k * 60} />)}
      </div>
      <div className="fsu-acts"><Go onClick={onGo}>Take over the {TEAM[s].nick}</Go></div>
    </div>
  )
}

// ── 2. The players ───────────────────────────────────────────────────────────
// the man who starts at a position on the team now (the build would push him)
function starterAt(s, pos) {
  const F = preview()
  return Object.values(lineup(F.teams[s])).filter(p => p.p === pos).sort((a, b) => b.o - a.o)[0] ?? null
}
const lastName = n => splitName(n).last
function Builds({ S, go, owner, onBuild }) {
  const picks = S.picks ?? []
  const count = pos => picks.filter(p => p.pos === pos).length
  const can = pos => picks.length < MAX_BUILDS && count(pos) < CAPS.nfl[pos]
  const add = pos => { if (!can(pos)) { sfx('deny'); return } go({ picks: [...picks, { id: `${pos}${count(pos) + 1}-${Date.now().toString(36)}`, pos }] }, 'slot') }
  const drop = pos => {
    const last = [...picks].reverse().find(p => p.pos === pos)
    if (!last) return
    const builds = { ...S.builds }; delete builds[last.id]
    go({ picks: picks.filter(p => p !== last), builds }, 'tap')
  }
  const ordered = POSITIONS.nfl.flatMap(pos => picks.filter(p => p.pos === pos))
  const built = p => S.builds?.[p.id]
  const next = ordered.find(p => !built(p))
  const unnamed = ordered.find(p => built(p) && !built(p).name)
  const done = ordered.length > 0 && !next && !unnamed
  const build = p => { sfx('tap'); onBuild({ id: p.id, pos: p.pos, n: ordered.indexOf(p) + 1, of: ordered.length }) }
  // the rookie slot each one signs at (identity.js rookieSlots: by his OVR, no two at one pick)
  const ready = ordered.filter(built)
  const slots = rookieSlots(ready.map(p => built(p)))
  const slotOf = p => slots[ready.indexOf(p)]
  return (
    <div className="fsu-builds">
      <Chyron team={S.team} tag={`${picks.length}/${MAX_BUILDS}`} title="Your players" sub="ROOKIES · UP TO 8" />
      <div className="fsu-pos">
        {POSITIONS.nfl.map(pos => {
          const st = starterAt(S.team, pos)
          const n = count(pos)
          return (
            <div key={pos} className={`fsu-pos-row${n ? ' is-on' : ''}`}>
              <span className="fsu-pos-k"><b>{POS_LABEL[pos]}</b><small>{POS_NAME[pos].toUpperCase()}</small></span>
              <span className="fsu-pos-st">{st && <><small>STARTER</small><b>{lastName(st.n).toUpperCase()} {st.o}</b></>}</span>
              <span className="fsu-step">
                <button type="button" onClick={() => drop(pos)} disabled={!n} aria-label={`One fewer ${POS_NAME[pos]}`}>-</button>
                <b>{n}</b>
                <button type="button" onClick={() => add(pos)} disabled={!can(pos)} aria-label={`One more ${POS_NAME[pos]}`}>+</button>
              </span>
            </div>
          )
        })}
      </div>
      {ordered.length > 0 && <Chyron tone="ink" size="s" title="The roster spots" right={`${ready.length}/${ordered.length} BUILT`} />}
      <div className="fsu-blist">
        {ordered.map((p, k) => {
          const b = built(p)
          if (!b) return (
            <button key={p.id} type="button" className="fsu-empty" onClick={() => build(p)} style={{ '--d': `${k * 40}ms` }}>
              <span className="fsu-empty-pos">{POS_LABEL[p.pos]}</span>
              <span className="fsu-empty-txt"><b>NOT BUILT</b><small>{POS_NAME[p.pos].toUpperCase()}</small></span>
              <span className="fsu-empty-go">BUILD</span>
            </button>
          )
          const o = ovrOf(p.pos, b.build)
          const sl = slotOf(p)
          return (
            <LowerThird key={p.id} name={b.name || `${POS_LABEL[p.pos]} ${k + 1}`} pos={p.pos} num={b.num} ovr={o} photo={buildFaceUrl({ pos: p.pos, face: b.face ?? defaultFace(`${S.seed}-${p.id}`, p.pos) }, teamKit(S.team) ?? TEAM[S.team]?.color)} team={S.team} mine={owner}
              line={b.name ? (d => `ROOKIE DEAL · $${d.$.toFixed(1)}M · ${d.y} YRS`)(rookieScale(sl)) : 'NAME HIM'} onClick={() => go({ naming: p.id }, 'tap')} delay={k * 40} />
          )
        })}
      </div>
      <div className="fsu-acts">
        {done ? <Go onClick={() => { go({ step: 'coach' }, 'whistle'); haptic('medium') }}>Next: your coach</Go>
          : unnamed ? <Go onClick={() => go({ naming: unnamed.id }, 'tap')}>Name your {POS_LABEL[unnamed.pos]}</Go>
            : next ? <Go onClick={() => build(next)}>Build your {POS_LABEL[next.pos]}</Go>
              : <Go disabled>Add a player</Go>}
      </div>
    </div>
  )
}

// a build's face choices: eight made-up men for his position (faces.js defaultFace: the position's room, so a corner
// is drawn the way NFL corners look), a new eight a page (the MORE button spins the next page); the first of the
// first page is the face he starts with
function buildFaceChoices(key, pos, page) {
  return Array.from({ length: 8 }, (_, k) => ({ key: `${key}|${page}|${k}`, face: defaultFace(page || k ? `${key}|f${page}-${k}` : key, pos) }))
}
const sameFace = (a, b) => !!a && FACE_KEYS.every(k => a[k] === b.face[k])

// ── A build's name and number ────────────────────────────────────────────────
// First and last name (Career's name step: the same letters, the random-name button) and a number his position
// may wear and nobody on the team has. His rookie deal shows under it: the slot his OVR goes at in the draft.
//   used for the setup's builds and for Sandbox's prospects (FranchiseMode: NameSheet)
const RANGE = { qb: '0-19', ol: '50-79', dl: '50-79, 90-99', lb: '0-59, 90-99', db: '0-49' }
export function NameForm({ pos, build, team, taken, owner, slot, init, cta, onDone, faceKey, showNum = true }) {
  const [first, setFirst] = useState(() => init?.first ?? '')
  const [last, setLast] = useState(() => init?.last ?? '')
  const free = useMemo(() => freeNumbers(pos, taken), [pos, taken])
  const [num, setNum] = useState(() => (legalFor(pos, init?.num) && !taken.has(init.num) ? init.num : pickNumber(pos, taken)))
  const [all, setAll] = useState(false)
  const [face, setFace] = useState(() => init?.face ?? defaultFace(faceKey ?? `${first}-${last}-${pos}`, pos))
  const [page, setPage] = useState(0)
  const faces = useMemo(() => buildFaceChoices(faceKey ?? `${first}-${last}-${pos}`, pos, page), [faceKey, pos, page]) // eslint-disable-line react-hooks/exhaustive-deps
  const o = ovrOf(pos, build)
  const deal = slot ? rookieScale(slot) : null
  const ok = nameOk(first, last)
  const rand = () => { const n = randomFirstLast({ first, last }); setFirst(n.first); setLast(n.last); sfx('tap') }
  const shown = all ? free : free.slice(0, 18)
  return (
    <div className="fsu-nameform">
      <LowerThird size="l" name={`${first} ${last}`.trim() || POS_NAME[pos]} pos={pos} num={showNum ? num : null} ovr={o} photo={buildFaceUrl({ pos, face }, teamKit(team) ?? TEAM[team]?.color)} team={team} mine={owner}
        line={deal ? `ROOKIE DEAL · $${deal.$.toFixed(1)}M A YEAR` : null} />
      <span className="fsu-lbl">FACE</span>
      {/* his face the way the coach's is picked: a strip of made-up men who could play his position, MORE spins eight more */}
      <div className="fsu-faces fsu-faces--build" role="radiogroup" aria-label="Face">
        {faces.map(f => {
          const on = sameFace(face, f)
          return (
            <button key={f.key} type="button" role="radio" aria-checked={on} className={`fsu-face${on ? ' is-on' : ''}`} style={fkVars(team)} onClick={() => { setFace(f.face); sfx('tap') }}>
              <img src={buildFaceUrl({ pos, face: f.face }, teamKit(team) ?? TEAM[team]?.color)} alt="" draggable={false} />
            </button>
          )
        })}
        <button type="button" className="fsu-face fsu-face-more" onClick={() => { setPage(p => p + 1); sfx('flip') }}><IconSpin size={18} /><small>MORE</small></button>
      </div>
      <span className="fsu-lbl">NAME</span>
      <div className="fsu-name">
        <input className="fsu-in" value={first} onChange={e => setFirst(cleanName(e.target.value))} placeholder="FIRST" autoComplete="off" autoCapitalize="words" spellCheck={false} aria-label="First name" />
        <input className="fsu-in" value={last} onChange={e => setLast(cleanName(e.target.value))} placeholder="LAST" autoComplete="off" autoCapitalize="words" spellCheck={false} aria-label="Last name" />
        <button type="button" className="fsu-rand" onClick={rand} aria-label="Random name"><IconSpin size={18} /></button>
      </div>
      {showNum && <>
        <span className="fsu-lbl">NUMBER<small>{POS_LABEL[pos]} · {RANGE[pos] ?? '0-49, 80-89'}</small></span>
        <div className="fsu-nums" role="radiogroup" aria-label="Jersey number">
          {shown.map(n => <button key={n} type="button" role="radio" aria-checked={num === n} className={num === n ? 'is-on' : ''} onClick={() => { setNum(n); sfx('tap') }}>{n}</button>)}
          {!all && free.length > shown.length && <button type="button" className="fsu-nums-more" onClick={() => setAll(true)}>ALL</button>}
        </div>
      </>}
      {deal && (
        <div className="fsu-deal">
          <Fact v={`$${deal.$.toFixed(1)}M`} label="A YEAR" size={28} />
          <Fact v={`${deal.y} YRS`} label={deal.opt ? '+ 5TH-YEAR OPTION' : 'ROOKIE DEAL'} size={28} />
        </div>
      )}
      <div className="fsu-acts"><Go onClick={() => ok && onDone({ name: `${first.trim()} ${last.trim()}`, first: first.trim(), last: last.trim(), num, face })} disabled={!ok}>{cta}</Go></div>
    </div>
  )
}
function NameStep({ S, id, owner, onDone }) {
  const b = S.builds[id]
  const pick = (S.picks ?? []).find(p => p.id === id)
  const others = Object.entries(S.builds).filter(([k, x]) => k !== id && x?.num != null).map(([, x]) => x)
  const taken = useMemo(() => takenOn(S.team, others), [S.team, others.map(x => x.num).join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const ordered = POSITIONS.nfl.flatMap(pos => (S.picks ?? []).filter(p => p.pos === pos)).filter(p => S.builds[p.id])
  const slot = rookieSlots(ordered.map(p => S.builds[p.id]))[ordered.findIndex(p => p.id === id)]
  const n = splitName(b.name ?? '')
  return (
    <div className="fsu-namestep">
      <Chyron team={S.team} title={b.name ? 'Edit your player' : `Name your ${POS_LABEL[pick?.pos ?? b.pos]}`} sub="NAME, FACE AND NUMBER" />
      <NameForm pos={b.pos} build={b.build} team={S.team} taken={taken} owner={owner} slot={slot} init={{ first: n.first, last: n.last, num: b.num, face: b.face }} faceKey={`${S.seed}-${id}`} cta="Sign him"
        onDone={x => onDone({ builds: { ...S.builds, [id]: { ...b, name: x.name, num: x.num, face: x.face } } })} />
    </div>
  )
}
