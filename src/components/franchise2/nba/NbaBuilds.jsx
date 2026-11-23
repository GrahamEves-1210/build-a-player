import { useMemo, useState } from 'react'
import { TEAM, photoOf, ovrOfAttrs, attrsOfBuild, buildSpot, buildSlot, BUILD_MAX, CAP_SIM, FIRST_YEAR } from '../../../lib/franchise2/nba'
import { cleanName, nameOk, randomFirstLast } from '../../../lib/franchise2/identity'
import { defaultFace, buildFaceUrl, FACE_KEYS } from '../../../lib/franchise2/faces'
import { sfx } from '../../../lib/juice'
import { IconSpin } from '../../app/icons'
import { Chyron, LowerThird, Go, Fact, fkVars } from '../kit'
import { preview } from './NbaSetup'

// BASKETBALL FRANCHISE, the setup's players: up to three of the GM's own builds, each built on the game's build page
// (a guard or a big), then named, numbered and given a face here. Each one replaces the last man in his group.
//   S.picks [{ id, pos }] the spots in order · S.builds { [id]: { pos, build, types, sandbox, name, num, face } }
const NAME = { guard: 'GUARD', big: 'BIG' }
export const faceOf = (B, team) => buildFaceUrl({ pos: 'nba', face: B.face ?? defaultFace(B.name ?? 'build', 'nba'), kit: 'hoops' }, TEAM[team]?.color)
// a man's picture: his ESPN headshot, a build's drawn face, or none (the initials)
export const manPhoto = (F, p) => (!p ? null : p.b != null && F.builds?.[p.b] ? faceOf(F.builds[p.b], F.team) : p.h ? photoOf(p.n) : null)
const money = v => `$${(Math.round(v * 10) / 10).toFixed(1)}M`

export function NbaBuildsStep({ S, go, owner, onBuild, onNext }) {
  const picks = S.picks ?? []
  const add = pos => { const id = `b${Date.now().toString(36)}`; go({ picks: [...picks, { id, pos }] }, 'tap') }
  const drop = id => { const b = { ...(S.builds ?? {}) }; delete b[id]; go({ picks: picks.filter(p => p.id !== id), builds: b }, 'back') }
  const build = (p, k) => onBuild({ id: p.id, pos: p.pos, n: k + 1, of: picks.length })
  const ready = picks.every(p => S.builds?.[p.id]?.name)
  return (
    <div className="fsu-card nb-builds">
      <Chyron tone="ink" title="Your players" sub={`UP TO ${BUILD_MAX} OF YOUR OWN`} />
      {picks.map((p, k) => {
        const B = S.builds?.[p.id]
        if (!B?.name) {
          return (
            <div key={p.id} className="nb-build-row">
              <button type="button" className="fsu-empty" onClick={() => build(p, k)}>
                <span className="fsu-empty-pos">{p.pos === 'big' ? 'BIG' : 'G'}</span>
                <span className="fsu-empty-txt"><b>{B ? 'NAME HIM' : 'NOT BUILT'}</b><small>{NAME[p.pos]}</small></span>
                <span className="fsu-empty-go">{B ? 'NAME' : 'BUILD'}</span>
              </button>
              <button type="button" className="nb-link" onClick={() => drop(p.id)}>Remove</button>
            </div>
          )
        }
        const a = attrsOfBuild(B.pos, B.build), o = ovrOfAttrs(B.pos, a)
        return (
          <div key={p.id} className="nb-build-row">
            <LowerThird name={B.name} pos={buildSpot(B.pos, a)} num={B.num} ovr={o} photo={faceOf(B, S.team)} team={S.team} mine={owner} line={`ROOKIE · NO. ${buildSlot(o)} PICK`} size="s" />
            <span className="nb-fa-acts"><button type="button" onClick={() => build(p, k)}>Rebuild</button><button type="button" onClick={() => drop(p.id)}>Remove</button></span>
          </div>
        )
      })}
      {picks.length < BUILD_MAX && (
        <div className="nb-build-add">
          <button type="button" className="nb-tman" onClick={() => add('guard')}><b>+ Add a guard</b><em>PG, SG or SF</em></button>
          <button type="button" className="nb-tman" onClick={() => add('big')}><b>+ Add a big</b><em>PF or C</em></button>
        </div>
      )}
      <div className="fsu-acts"><Go onClick={onNext} disabled={!ready}>{picks.length ? 'Next: league rules' : 'No builds: league rules'}</Go></div>
    </div>
  )
}

// a build back from the build page: his face, his name and his number
export function NbaNameStep({ S, id, owner, onDone }) {
  const B = S.builds[id]
  const F = preview()
  const taken = useMemo(() => new Set([...F.teams[S.team].r.map(p => p.num), ...Object.entries(S.builds ?? {}).filter(([k]) => k !== id).map(([, x]) => x.num)].filter(n => n != null)), [S.team, id]) // eslint-disable-line react-hooks/exhaustive-deps
  const free = useMemo(() => Array.from({ length: 100 }, (_, n) => n).filter(n => !taken.has(n)), [taken])
  const [first, setFirst] = useState(() => B.name?.split(' ')[0] ?? '')
  const [last, setLast] = useState(() => B.name?.split(' ').slice(1).join(' ') ?? '')
  const [num, setNum] = useState(() => (B.num != null && !taken.has(B.num) ? B.num : free[(id.length * 7) % free.length]))
  const [all, setAll] = useState(false)
  const [page, setPage] = useState(0)
  // (the face he comes in with is the first of the eight, so one is always lit)
  const [face0] = useState(() => B.face ?? defaultFace(`${S.seed}-${id}`, 'nba'))
  const [face, setFace] = useState(face0)
  const faces = useMemo(() => Array.from({ length: 8 }, (_, k) => (page === 0 && k === 0 ? face0 : defaultFace(`${S.seed}-${id}-f${page}-${k}`, 'nba'))), [page]) // eslint-disable-line react-hooks/exhaustive-deps
  const a = attrsOfBuild(B.pos, B.build), o = ovrOfAttrs(B.pos, a)
  const slot = buildSlot(o)
  const deal = CAP_SIM.rookieScale(slot, FIRST_YEAR)
  const ok = nameOk(first, last)
  const shown = all ? free : free.slice(0, 18)
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
