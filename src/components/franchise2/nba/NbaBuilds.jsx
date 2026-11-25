import { useMemo, useState } from 'react'
import { TEAM, photoOf, ovrOfAttrs, attrsOfBuild, buildSpot, buildSlot, buildSlots, buildCapNote, BUILD_MAX, CAP_SIM, FIRST_YEAR } from '../../../lib/franchise2/nba'
import { buildWaives } from '../../../lib/franchise2/nba/setup'
import { cleanName, nameOk, randomFirstLast } from '../../../lib/franchise2/identity'
import { defaultFace, buildFaceUrl, FACE_KEYS } from '../../../lib/franchise2/faces'
import { sfx, haptic } from '../../../lib/juice'
import { IconSpin } from '../../app/icons'
import { Chyron, LowerThird, Go, Fact, fkVars } from '../kit'
import { preview } from './NbaSetup'

// BASKETBALL FRANCHISE, the setup's players: up to three of the GM's own builds, each built on the game's build page
// (a guard or a big), then named, numbered and given a face here. Each takes a roster spot (builds.js).
//   S.picks [{ id, pos }] the spots in order · S.builds { [id]: { pos, build, types, sandbox, name, num, face } }
const NAME = { guard: 'GUARD', big: 'BIG' }
export const faceOf = (B, team) => buildFaceUrl({ pos: 'nba', face: B.face ?? defaultFace(B.name ?? 'build', 'nba'), kit: 'hoops' }, TEAM[team]?.color)
// a man's picture: his ESPN headshot, a build's drawn face, or none (the initials)
export const manPhoto = (F, p) => (!p ? null : p.b != null && F.builds?.[p.b] ? faceOf(F.builds[p.b], F.team) : p.h ? photoOf(p.n) : null)
const money = v => `$${(Math.round(v * 10) / 10).toFixed(1)}M`

// a build whose rookie deal takes the payroll past the tax or an apron: one plain line under him (the setup's
// preview league, the GM's team; each build read off the payroll the ones before him left)
const PAST = { tax: 'the luxury tax line', a1: 'the first apron', a2: 'the second apron' }
const LINE_OF = { tax: 'tax', a1: 'a1', a2: 'a2' }
// each build's own pick (builds.js buildSlots: no two share one), in the order the franchise makes them
const ovrOfBuild = B => ovrOfAttrs(B.pos, attrsOfBuild(B.pos, B.build))
function slotsOf(S) {
  const L = (S.picks ?? []).filter(p => S.builds?.[p.id])
  const n = buildSlots(L.map(p => ovrOfBuild(S.builds[p.id])))
  return Object.fromEntries(L.map((p, k) => [p.id, n[k]]))
}
function capNotes(S) {
  if (!S.team || S.rules?.cap === false) return {}
  const F = { ...preview(), team: S.team }
  const out = {}
  const slots = slotsOf(S)
  let prev = 0
  for (const p of S.picks ?? []) {
    const B = S.builds?.[p.id]
    if (!B?.name) continue
    const N = buildCapNote(F, ovrOfBuild(B), prev, slots[p.id])
    prev += N.add
    const k = N.after.over
    if (k !== N.before.over && PAST[k]) out[p.id] = `His ${money(N.add)} rookie deal takes the ${TEAM[S.team].nick} payroll to ${money(N.after.pay)}, past ${PAST[k]} (${money(N.after[LINE_OF[k]])}).`
  }
  return out
}
// THE PLAYERS, football's step in the NBA's terms (Setup.jsx Builds): how many guards and bigs, each built on the build
// page, then named. They're rookies on the roster: each takes a roster spot (a full roster waives its end of the bench
// to make room: builds.js waiveFor, its camp body first), signed at the slot his OVR goes at in the draft.
const GROUPS = [['guard', 'G', 'GUARD', 'PG, SG OR SF'], ['big', 'BIG', 'BIG', 'PF OR C']]
const POS_SHORT = { guard: 'G', big: 'BIG' }
export function NbaBuildsStep({ S, go, owner, onBuild, onNext }) {
  const picks = S.picks ?? []
  const notes = useMemo(() => capNotes(S), [S.team, S.picks, S.builds, S.rules?.cap]) // eslint-disable-line react-hooks/exhaustive-deps
  const count = pos => picks.filter(p => p.pos === pos).length
  const can = () => picks.length < BUILD_MAX
  const add = pos => { if (!can()) { sfx('deny'); return } go({ picks: [...picks, { id: `b${Date.now().toString(36)}`, pos }] }, 'slot') }
  const dropOne = pos => {
    const last = [...picks].reverse().find(p => p.pos === pos)
    if (!last) return
    const b = { ...(S.builds ?? {}) }; delete b[last.id]
    go({ picks: picks.filter(p => p !== last), builds: b }, 'tap')
  }
  // (in the order the step lists them: the guards, then the bigs)
  const ordered = GROUPS.flatMap(([g]) => picks.filter(p => p.pos === g))
  const built = p => S.builds?.[p.id]
  const next = ordered.find(p => !built(p))
  const unnamed = ordered.find(p => built(p) && !built(p).name)
  const done = !next && !unnamed
  const build = p => { sfx('tap'); onBuild({ id: p.id, pos: p.pos, n: ordered.indexOf(p) + 1, of: ordered.length, team: S.team }) }
  const ready = ordered.filter(p => built(p)?.name)
  const slots = slotsOf(S)
  // who a full roster lets go to make room for each build: read off the league this setup will start (its seed, its
  // rules: lib/franchise2/nba/setup.js), in the order the franchise puts the builds on, so the men named here are the
  // men the wire says were waived at tip-off
  const outs = useMemo(() => buildWaives(S), [S.seed, S.team, S.rules?.cap, S.rules?.inj, picks.map(p => `${p.id}${p.pos}`).join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const nick = TEAM[S.team].nick
  return (
    <div className="fsu-builds">
      <Chyron team={S.team} title="Build your players" right={`${picks.length} OF ${BUILD_MAX}`} sub="ROOKIES · EACH TAKES A ROSTER SPOT" />
      <div className="fsu-pos">
        {GROUPS.map(([pos, k, name, spots]) => {
          const n = count(pos)
          return (
            <div key={pos} className={`fsu-pos-row${n ? ' is-on' : ''}`}>
              <span className="fsu-pos-k"><b>{k}</b><small>{name}</small></span>
              <span className="fsu-pos-st"><small>PLAYS</small><b>{spots}</b></span>
              <span className="fsu-step">
                <button type="button" onClick={() => dropOne(pos)} disabled={!n} aria-label={`One fewer ${name.toLowerCase()}`}>-</button>
                <b>{n}</b>
                <button type="button" onClick={() => add(pos)} disabled={!can()} aria-label={`One more ${name.toLowerCase()}`}>+</button>
              </span>
            </div>
          )
        })}
      </div>
      {ordered.length > 0 && <Chyron tone="ink" size="s" title="The roster spots" right={`${ready.length}/${ordered.length} BUILT`} />}
      <div className="fsu-blist">
        {ordered.map((p, k) => {
          const B = built(p), m = outs[p.id]
          const room = m ? `The ${nick} waive ${m.n}${m.fl ? '' : ` (${m.o})`} to open a roster spot.` : null
          if (!B?.name) return (
            <button key={p.id} type="button" className="fsu-empty" onClick={() => (B ? go({ naming: p.id }, 'tap') : build(p))} style={{ '--d': `${k * 40}ms` }}>
              <span className="fsu-empty-pos">{POS_SHORT[p.pos]}</span>
              <span className="fsu-empty-txt"><b>{B ? 'NAME HIM' : 'NOT BUILT'}</b><small>{GROUPS.find(g => g[0] === p.pos)[2]}</small></span>
              <span className="fsu-empty-go">{B ? 'NAME' : 'BUILD'}</span>
            </button>
          )
          const a = attrsOfBuild(B.pos, B.build), o = ovrOfAttrs(B.pos, a)
          const slot = slots[p.id] ?? buildSlot(o), deal = CAP_SIM.rookieScale(slot, FIRST_YEAR)
          return (
            <div key={p.id} className="nb-build-row">
              <LowerThird name={B.name} pos={buildSpot(B.pos, a)} num={B.num} ovr={o} photo={faceOf(B, S.team)} team={S.team} mine={owner}
                line={`PICK ${slot} · ${money(Array.isArray(deal) ? deal[0] : deal)}`} onClick={() => go({ naming: p.id }, 'tap')} delay={k * 40} />
              {room && <p className="nb-build-cap">{room}</p>}
              {notes[p.id] && <p className="nb-build-cap">{notes[p.id]}</p>}
              <span className="nb-fa-acts"><button type="button" onClick={() => build(p)}>Rebuild</button></span>
            </div>
          )
        })}
      </div>
      <div className="fsu-acts">
        {done ? <Go onClick={() => { onNext(); haptic('medium') }}>{ordered.length ? 'Next: your coach' : 'No builds: your coach'}</Go>
          : unnamed ? <Go onClick={() => go({ naming: unnamed.id }, 'tap')}>Name your {POS_SHORT[unnamed.pos] === 'G' ? 'guard' : 'big'}</Go>
            : <Go onClick={() => build(next)}>Build your {next.pos === 'big' ? 'big' : 'guard'}</Go>}
      </div>
    </div>
  )
}

// a build back from the build page: his face, his name and his number
const COMMON = { guard: [1, 3, 0, 2, 5, 4, 7, 8, 11, 10, 13, 12, 14, 15, 20, 22, 23, 24, 30], big: [21, 32, 33, 34, 35, 12, 13, 15, 20, 22, 23, 24, 40, 41, 42, 44, 45, 50, 55] }
export function NbaNameStep({ S, id, owner, onDone }) {
  const B = S.builds[id]
  const F = preview()
  const taken = useMemo(() => new Set([...F.teams[S.team].r.map(p => p.num), ...Object.entries(S.builds ?? {}).filter(([k]) => k !== id).map(([, x]) => x.num)].filter(n => n != null)), [S.team, id]) // eslint-disable-line react-hooks/exhaustive-deps
  const free = useMemo(() => Array.from({ length: 100 }, (_, n) => n).filter(n => !taken.has(n)), [taken])
  const [first, setFirst] = useState(() => B.name?.split(' ')[0] ?? '')
  const [last, setLast] = useState(() => B.name?.split(' ').slice(1).join(' ') ?? '')
  // (his number until one is picked: the first free of the numbers guards and bigs wear, not whatever's left in the 70s)
  const [num, setNum] = useState(() => (B.num != null && !taken.has(B.num) ? B.num : (COMMON[B.pos] ?? COMMON.guard).find(n => !taken.has(n)) ?? free[0]))
  const [all, setAll] = useState(false)
  const [page, setPage] = useState(0)
  // (the face he comes in with is the first of the eight, so one is always lit)
  const [face0] = useState(() => B.face ?? defaultFace(`${S.seed}-${id}`, 'nba'))
  const [face, setFace] = useState(face0)
  const faces = useMemo(() => Array.from({ length: 8 }, (_, k) => (page === 0 && k === 0 ? face0 : defaultFace(`${S.seed}-${id}-f${page}-${k}`, 'nba'))), [page]) // eslint-disable-line react-hooks/exhaustive-deps
  const a = attrsOfBuild(B.pos, B.build), o = ovrOfAttrs(B.pos, a)
  const slot = slotsOf(S)[id] ?? buildSlot(o)
  const deal = CAP_SIM.rookieScale(slot, FIRST_YEAR)
  const ok = nameOk(first, last)
  // (the first numbers free, and always the one he's wearing)
  const shown = all ? free : [...new Set([...free.slice(0, 18), num])].sort((x, y) => x - y)
  const same = f => FACE_KEYS.every(k => f[k] === face[k])
  return (
    <div className="fsu-nameform">
      <LowerThird size="l" name={`${first} ${last}`.trim() || NAME[B.pos]} pos={buildSpot(B.pos, a)} num={num} ovr={o} photo={faceOf({ ...B, face }, S.team)} team={S.team} mine={owner} />
      <span className="fsu-lbl">FACE</span>
      <div className="fsu-faces fsu-faces--build" role="radiogroup" aria-label="Face">
        {faces.map((f, k) => (
          <button key={`${page}-${k}`} type="button" role="radio" aria-checked={same(f)} className={`fsu-face${same(f) ? ' is-on' : ''}`} style={fkVars(S.team)} onClick={() => { setFace(f); sfx('tap') }}>
            <img src={faceOf({ ...B, face: f }, S.team)} alt="" draggable={false} />
          </button>
        ))}
        <button type="button" className="fsu-face fsu-face-more" onClick={() => { setPage(p => p + 1); sfx('flip') }}><IconSpin size={18} /><small>MORE</small></button>
      </div>
      <span className="fsu-lbl">NAME</span>
      <div className="fsu-name">
        <input className="fsu-in" value={first} onChange={e => setFirst(cleanName(e.target.value))} placeholder="FIRST" autoComplete="off" autoCapitalize="words" spellCheck={false} aria-label="First name" />
        <input className="fsu-in" value={last} onChange={e => setLast(cleanName(e.target.value))} placeholder="LAST" autoComplete="off" autoCapitalize="words" spellCheck={false} aria-label="Last name" />
        <button type="button" className="fsu-rand" onClick={() => { const n = randomFirstLast({ first, last }); setFirst(n.first); setLast(n.last); sfx('tap') }} aria-label="Random name"><IconSpin size={18} /></button>
      </div>
      <span className="fsu-lbl">NUMBER<small>0-99 · NOT WORN ON THE {TEAM[S.team].nick.toUpperCase()}</small></span>
      <div className="fsu-nums" role="radiogroup" aria-label="Jersey number">
        {shown.map(n => <button key={n} type="button" role="radio" aria-checked={num === n} className={num === n ? 'is-on' : ''} onClick={() => { setNum(n); sfx('tap') }}>{n}</button>)}
        {!all && free.length > shown.length && <button type="button" className="fsu-nums-more" onClick={() => setAll(true)}>ALL</button>}
      </div>
      <div className="fsu-deal">
        <Fact v={`NO. ${slot}`} label="DRAFT SLOT" size={28} />
        <Fact v={money(Array.isArray(deal) ? deal[0] : deal)} label="ROOKIE SCALE · 4 YRS" size={28} />
      </div>
      <div className="fsu-acts">{!ok && <p className="fsu-hint">Give him a first and last name to sign him.</p>}<Go onClick={() => ok && onDone({ name: `${first.trim()} ${last.trim()}`, num, face })} disabled={!ok}>Sign him</Go></div>
    </div>
  )
}
