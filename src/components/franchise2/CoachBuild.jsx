import { useMemo, useState } from 'react'
import { SlotReel } from '../SpinScreen'
import { TEAM, CTYPES, CLABEL, STYLES, RESPINS, cLetter, coachGrade, wheelOf, dealSpin, dealRespin, coachByName, takeLine, linesDone, realHC } from '../../lib/franchise2'
import { faceUrl, lookOf } from '../../lib/franchise2/faces'
import { cleanName, nameOk, randomFirstLast } from '../../lib/franchise2/identity'
import { sfx, haptic } from '../../lib/juice'
import { IconSpin } from '../app/icons'
import { Chyron, LowerThird, BigNum, Go, Meter, KLogo, fkVars, splitName, reduced } from './kit'
import { coachPhoto } from './coachFace'

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
                {L ? <><b>{cLetter(L.v)}</b></> : offer != null ? <><b>{cLetter(offer)}</b></> : <b className="is-dash">-</b>}
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
      <Chyron team={S.team} title="His style" sub="ONE PICK" />
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
// faces: made-up men (lib/franchise2/faces.js), a strip of eight that covers the league's backgrounds
const FACE_POS = ['qb', 'te', 'lb', 'ol', 'wr', 'db', 'dl', 'rb']
export function faceChoices(seed, page = 0) {
  const out = [], seen = new Set()
  for (let k = 0; k < 60 && out.length < 8; k++) {
    const key = `coach-${seed}-${page}-${k}`, pos = FACE_POS[k % FACE_POS.length]
    const g = lookOf(key, pos).g
    // one of each background first, then anyone
    if (out.length < 5 && seen.has(g)) continue
    seen.add(g); out.push({ key, pos })
  }
  return out
}
export const coachFace = (c, team) => (c?.face ? faceUrl(c.face.key, c.face.pos, TEAM[team]?.color) : null)
export function CoachWho({ S, go, owner, onDone }) {
  const c = S.coach ?? {}
  const [page, setPage] = useState(c.facePage ?? 0)
  const faces = useMemo(() => faceChoices(S.seed, page), [S.seed, page])
  const first = c.first ?? '', last = c.last ?? ''
  const set = (patch, s) => go({ coach: { ...c, ...patch } }, s)
  const rand = () => { const n = randomFirstLast({ first, last }); set(n, 'tap') }
  const ok = nameOk(first, last) && c.face
  const name = `${first} ${last}`.trim()
  return (
    <div className="fsu-who">
      <Chyron team={S.team} title="Your coach" sub="NAME AND FACE" />
      <LowerThird className="fsu-who-prev" size="l" name={name || owner} pos="HC" team={S.team} photo={coachFace(c, S.team)} stat={{ v: coachGrade(Object.fromEntries(CTYPES.map(t => [t, S.cb.lines[t]?.v]))), label: 'GRADE' }} line={STYLES[c.style]?.name} />
      <div className="fsu-name">
        <input className="fsu-in" value={first} onChange={e => set({ first: cleanName(e.target.value) })} placeholder="FIRST" autoComplete="off" autoCapitalize="words" spellCheck={false} aria-label="Coach's first name" />
        <input className="fsu-in" value={last} onChange={e => set({ last: cleanName(e.target.value) })} placeholder="LAST" autoComplete="off" autoCapitalize="words" spellCheck={false} aria-label="Coach's last name" />
        <button type="button" className="fsu-rand" onClick={rand} aria-label="Random name"><IconSpin size={18} /></button>
      </div>
      <div className="fsu-faces" role="radiogroup" aria-label="Face">
        {faces.map(f => (
          <button key={f.key} type="button" role="radio" aria-checked={c.face?.key === f.key} className={`fsu-face${c.face?.key === f.key ? ' is-on' : ''}`} style={fkVars(S.team)} onClick={() => set({ face: f, facePage: page }, 'tap')}>
            <img src={faceUrl(f.key, f.pos, TEAM[S.team]?.color)} alt="" draggable={false} />
          </button>
        ))}
        <button type="button" className="fsu-face fsu-face-more" onClick={() => { setPage(p => p + 1); sfx('flip') }}><IconSpin size={18} /><small>MORE</small></button>
      </div>
      <div className="fsu-acts"><Go onClick={onDone} disabled={!ok}>See the card</Go></div>
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
                <Meter label={SHORT_LABEL[t]} v={r[t] ?? 0} max={11} segs={11} team={team} show={cLetter(r[t])} />
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
