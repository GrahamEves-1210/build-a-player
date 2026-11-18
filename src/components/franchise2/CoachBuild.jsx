import { useMemo, useState } from 'react'
import { SlotReel } from '../SpinScreen'
import { TEAM, CTYPES, CLABEL, STYLES, RESPINS, cLetter, coachGrade, wheelOf, dealSpin, dealRespin, coachByName, takeLine, linesDone, realHC, FIRST_YEAR } from '../../lib/franchise2'
import { coachLook, coachFaceUrl } from '../../lib/franchise2/faces'
import { cleanName, nameOk } from '../../lib/franchise2/identity'
import { randomCoachName } from '../../lib/franchise2/coachNames'
import { letterColor } from '../../lib/gradeColors'
import { sfx, haptic } from '../../lib/juice'
import { IconSpin } from '../app/icons'
import { Chyron, LowerThird, BigNum, Go, Meter, KLogo, fkVars, splitName, reduced } from './kit'
import { coachPhoto, teamMark } from './coachFace'
import { teamKit } from '../../lib/franchise2/kits'

// THE COACH: built like a player. The wheel is the league's real head coaches (not the player's own team's); it
// lands on one, and the player takes ONE of his five ratings into the matching line of his coach. Five spins fill
// five lines; one respin a build, as with a player (lib/franchise2/coach.js deals every spin from the setup's seed,
// so a reload mid-spin deals the same man). Then a STYLE, a name and a face, and the coach card.
//   setup.cb: the build in progress (coach.js newCoachBuild) · setup.coach: { name, first, last, face, style }

const lastOf = n => splitName(n).last
const SHORT_LABEL = { talentDev: 'TALENT DEV.', offPlaycalling: 'OFF. PLAYCALLING', defPlaycalling: 'DEF. PLAYCALLING', culture: 'CULTURE', situational: 'SITUATIONAL' }

// ── 1. The spin ──────────────────────────────────────────────────────────────
export function CoachSpin({ S, go, onDone }) {
  const cb = S.cb
  const team = S.team
  const items = useMemo(() => wheelOf(team), [team])
  const [spinning, setSpinning] = useState(false)
  const [just, setJust] = useState(null)
  const landed = cb.cur && !spinning ? coachByName(cb.cur.t, cb.cur.c) : null
  const target = cb.cur ? items.find(c => c.name === cb.cur.c) ?? null : null
  const filled = CTYPES.filter(t => cb.lines[t]).length
  const done = linesDone(cb)
  const put = (patch, s) => go({ cb: { ...cb, ...patch } }, s)

  const spin = () => {
    if (spinning || cb.cur || done) return
    const cur = dealSpin(cb)
    put({ cur, n: cb.n + 1 })
    setJust(null)
    if (reduced()) { sfx('lock'); return }
    setSpinning(true)
  }
  const respin = () => {
    if (spinning || !cb.cur || cb.rs >= RESPINS) { sfx('deny'); return }
    put({ cur: dealRespin(cb), rs: cb.rs + 1 })
    if (reduced()) { sfx('lock'); return }
    setSpinning(true)
  }
  const take = type => {
    if (!landed || cb.lines[type]) return
    const next = takeLine(cb, type)
    go({ cb: next }, 'claim')
    haptic('success')
    setJust(type)
  }
  // (a coach has no overall number (owner): one letter for the lines taken so far)
  const grade = coachGrade(Object.fromEntries(CTYPES.filter(t => cb.lines[t]).map(t => [t, cb.lines[t].v])))
  return (
    <div className="fsu-cspin">
      <Chyron team={team} tag={`${Math.min(5, filled + (cb.cur ? 1 : 0)) || 1}/5`} title="Build your coach" sub="TAKE ONE RATING FROM EACH COACH" right={grade != null ? <span className="fsu-chy-ovr">{grade}<small>GRADE</small></span> : null} />
      <div className="fsu-reel reels-row">
        <SlotReel label="HEAD COACHES" items={items} spinning={spinning} idle={false} locked={!!landed}
          getDisplay={c => c.name.toUpperCase()} getSub={c => TEAM[c.team]?.name.toUpperCase()}
          target={spinning ? target : null} durationMs={1500} jitterMs={300}
          onStop={() => { setSpinning(false); haptic('medium') }} />
      </div>
      {landed && (
        <LowerThird key={landed.name} className="fsu-landed" name={landed.name} pos="HC" team={landed.team} photo={coachPhoto({ n: landed.name, ag: landed.age }, landed.team)} stat={{ v: coachGrade(landed.attrs), label: 'GRADE' }} line={TEAM[landed.team]?.name.toUpperCase()} />
      )}
      <div className={`fsu-lines${landed ? ' is-choosing' : ''}`} style={fkVars(team)}>
        {CTYPES.map((t, i) => {
          const L = cb.lines[t]
          const offer = landed && !L ? landed.attrs[t] : null
          const Tag = offer != null ? 'button' : 'div'
          return (
            <Tag key={t} type={offer != null ? 'button' : undefined} className={`fsu-line${L ? ' is-in' : ''}${offer != null ? ' is-offer' : ''}${just === t ? ' is-just' : ''}`} style={{ '--d': `${i * 40}ms` }} onClick={offer != null ? () => take(t) : undefined}>
              <span className="fsu-line-lbl"><b>{CLABEL[t]}</b>
                {L ? <small><KLogo s={L.t} size={14} />{lastOf(L.from).toUpperCase()}</small> : offer != null ? <small>TAKE FROM {lastOf(landed.name).toUpperCase()}</small> : <small>OPEN</small>}
              </span>
              <span className="fsu-line-v">
                {L ? <><b style={{ color: letterColor(cLetter(L.v)) }}>{cLetter(L.v)}</b></> : offer != null ? <><b style={{ color: letterColor(cLetter(offer)) }}>{cLetter(offer)}</b></> : <b className="is-dash">-</b>}
              </span>
            </Tag>
          )
        })}
      </div>
      <div className="fsu-acts">
        {done ? <Go onClick={onDone}>Pick a style</Go>
          : landed ? <Go ghost onClick={respin} disabled={cb.rs >= RESPINS}><IconSpin size={16} /> RESPIN · {Math.max(0, RESPINS - cb.rs)}</Go>
            : <Go onClick={spin} disabled={spinning}>{spinning ? 'Spinning' : filled ? 'Spin again' : 'Spin'}</Go>}
      </div>
    </div>
  )
}

// ── 2. The style ─────────────────────────────────────────────────────────────
export function StylePick({ S, go, onDone }) {
  const c = S.coach ?? {}
  return (
    <div className="fsu-style">
      <Chyron team={S.team} title="Coach style" />
      <div className="fsu-opts">
        {Object.entries(STYLES).map(([id, x], i) => (
          <button key={id} type="button" className={`fsu-opt${c.style === id ? ' is-on' : ''}`} style={{ ...fkVars(S.team), '--d': `${i * 50}ms` }} onClick={() => { go({ coach: { ...c, style: id } }, 'slot'); haptic('light') }}>
            <b>{x.name}</b><small>{x.fx}</small>
          </button>
        ))}
      </div>
      <div className="fsu-acts"><Go onClick={onDone} disabled={!c.style}>Name him</Go></div>
    </div>
  )
}

// ── 3. The name and the face ─────────────────────────────────────────────────
// faces: drawn coaches (lib/franchise2/faces.js coachLook), a strip of eight, from 34 to 61 the way the
// league's head coaches are, white and Black men in it (the league's staffs: mostly white, about a fifth Black). His face
// keeps the year it was picked (y), so he greys as the seasons go (coach.js myHC passes his age now).
// (ages the way the league's head coaches run: from the mid-thirties to the sixties, half of a strip under 45)
const COACH_AGES = [34, 37, 40, 43, 46, 50, 55, 61]
export function faceChoices(seed, page = 0) {
  const out = []
  let black = 0
  for (let k = 0; k < 80 && out.length < 8; k++) {
    const key = `coach-${seed}-${page}-${k}`, ag = COACH_AGES[(k + page * 3) % COACH_AGES.length]
    const g = coachLook(key, { ag }).g
    if (g !== 'b' && out.length >= 6 && black < 2) continue
    if (g === 'b') black++
    out.push({ key, coach: 1, g, ag, y: FIRST_YEAR })
  }
  return out
}
export const coachFace = (c, team) => (c?.face ? coachFaceUrl(c.face, teamKit(team) ?? TEAM[team]?.color, null, false, teamMark(team)) : null)
export function CoachWho({ S, go, owner, onDone }) {
  const c = S.coach ?? {}
  const [page, setPage] = useState(c.facePage ?? 0)
  const faces = useMemo(() => faceChoices(S.seed, page), [S.seed, page])
  const first = c.first ?? '', last = c.last ?? ''
  const set = (patch, s) => go({ coach: { ...c, ...patch } }, s)
  const rand = () => { const n = randomCoachName({ first, last }); set(n, 'tap') }
  const ok = nameOk(first, last) && c.face
  const name = `${first} ${last}`.trim()
  return (
    <div className="fsu-who">
      <Chyron team={S.team} title="Your coach" sub="NAME AND FACE" />
      <LowerThird className="fsu-who-prev" size="l" name={name || 'Head Coach'} pos="HC" team={S.team} photo={coachFace(c, S.team)} stat={{ v: coachGrade(Object.fromEntries(CTYPES.map(t => [t, S.cb.lines[t]?.v]))), label: 'GRADE' }} line={STYLES[c.style]?.name} />
      <div className="fsu-name">
        <input className="fsu-in" value={first} onChange={e => set({ first: cleanName(e.target.value) })} placeholder="FIRST" autoComplete="off" autoCapitalize="words" spellCheck={false} aria-label="Coach's first name" />
        <input className="fsu-in" value={last} onChange={e => set({ last: cleanName(e.target.value) })} placeholder="LAST" autoComplete="off" autoCapitalize="words" spellCheck={false} aria-label="Coach's last name" />
        <button type="button" className="fsu-rand" onClick={rand} aria-label="Random name"><IconSpin size={18} /></button>
      </div>
      <div className="fsu-faces" role="radiogroup" aria-label="Face">
        {faces.map(f => (
          <button key={f.key} type="button" role="radio" aria-checked={c.face?.key === f.key} className={`fsu-face${c.face?.key === f.key ? ' is-on' : ''}`} style={fkVars(S.team)} onClick={() => set({ face: f, facePage: page }, 'tap')}>
            <img src={coachFaceUrl(f, teamKit(S.team) ?? TEAM[S.team]?.color, null, false, teamMark(S.team))} alt="" draggable={false} />
          </button>
        ))}
        <button type="button" className="fsu-face fsu-face-more" onClick={() => { setPage(p => p + 1); sfx('flip') }}><IconSpin size={18} /><small>MORE</small></button>
      </div>
      <div className="fsu-acts">{!ok && <p className="fsu-hint">{!nameOk(first, last) ? (c.face ? 'Give him a first and last name to see the card.' : 'Give him a name and pick a face to see the card.') : 'Pick a face to see the card.'}</p>}<Go onClick={onDone} disabled={!ok}>See the card</Go></div>
    </div>
  )
}

// ── The coach card ───────────────────────────────────────────────────────────
// The finished coach as the broadcast puts him up: his face cut against the team's colour, HEAD COACH, the name,
// one letter grade in the box (no overall number for a coach), his style, then the five ratings, each a meter and its letter, with the coach it came from.
//   c: the franchise's coach (coach.js finishCoach) or the setup's (lines from cb) · team
export function CoachCard({ c, team, from, small = false, delay = 0 }) {
  const { first, last } = splitName(c.name)
  const r = c.r ?? {}
  return (
    <section className={`fsu-cc${small ? ' is-small' : ''}`} style={{ ...fkVars(team), '--d': `${delay}ms` }}>
      <div className="fsu-cc-top">
        <span className="fsu-cc-slab" aria-hidden="true">
          <span className="fsu-cc-hc">HC</span>
          {coachFace(c, team) ? <img src={coachFace(c, team)} alt="" draggable={false} /> : <b className="fsu-cc-init">{(first[0] ?? '') + (last[0] ?? '')}</b>}
        </span>
        <span className="fsu-cc-id">
          <small className="fsu-cc-job"><KLogo s={team} size={18} />HEAD COACH</small>
          <span className="fsu-cc-name">{first && <small>{first}</small>}<b>{last}</b></span>
          {c.style && <em className="fsu-cc-style">{STYLES[c.style]?.name}</em>}
        </span>
        <span className="fsu-cc-ovr"><BigNum v={coachGrade(r) ?? '-'} count={false} size={small ? 34 : 48} /><small>GRADE</small></span>
      </div>
      {!small && (
        <div className="fsu-cc-lines">
          {CTYPES.map((t, i) => {
            const src = from?.[t] ?? c.from?.[t]
            return (
              <div key={t} className="fsu-cc-line" style={{ '--d': `${delay + 200 + i * 90}ms` }}>
                <Meter label={SHORT_LABEL[t]} v={r[t] == null ? 0 : Math.round(r[t]) + 1} max={12} segs={12} team={team} show={cLetter(r[t])} color={letterColor(cLetter(r[t]))} />
                {src && <small className="fsu-cc-from"><KLogo s={src[1]} size={14} />{lastOf(src[0]).toUpperCase()}</small>}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
// the coach card on the setup's last screen: his lines from the spin
export function CoachReveal({ S, owner, onStart }) {
  const c = S.coach ?? {}
  const r = Object.fromEntries(CTYPES.map(t => [t, S.cb.lines[t]?.v ?? 5]))
  const from = Object.fromEntries(CTYPES.map(t => [t, S.cb.lines[t] ? [S.cb.lines[t].from, S.cb.lines[t].t] : null]))
  const name = `${c.first ?? ''} ${c.last ?? ''}`.trim() || owner
  const real = realHC(S.team)
  return (
    <div className="fsu-reveal">
      <Chyron team={S.team} title={`${TEAM[S.team].nick} hire ${lastOf(name)}`} sub={real ? `REPLACES ${real.name.toUpperCase()}` : 'HEAD COACH'} />
      <CoachCard c={{ ...c, name, r }} team={S.team} from={from} />
      <div className="fsu-acts"><Go onClick={onStart}>Start the season</Go></div>
    </div>
  )
}
