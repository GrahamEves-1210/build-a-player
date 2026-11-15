import { useEffect, useMemo, useState } from 'react'
import {
  TEAM, CTYPES, STYLES, cLetter, coachGrade, rOf, staffOf, staffMen, callerOf, setCalls, cvOf, hotSeat, myOpenings, fireMine, shortlist,
  interviewCoach, interviewsLeft, interviewView, offerCoach, closeCarousel, setCarStep, moveText, IV_N, records, recText,
} from '../../lib/franchise2'
import { sfx, haptic } from '../../lib/juice'
import { Chyron, LowerThird, Stamp, Go, KLogo, fkVars, splitName, reduced, BackBar, ActionBar } from './kit'
import { coachPhoto } from './coachFace'
import './staff.css'

// THE STAFF: a team's head coach and his two coordinators as the broadcast puts them up (a lower-third each: the
// face cut against the team's colour, the job, his five ratings as grades, who calls the plays). No overall number
// for a coach anywhere (owner): the grades, and one letter for the job in the box.
// Also the offseason's first stop, the COACHING CAROUSEL (lib/franchise2/carousel.js): Black Monday around the
// league, the new head coaches, then the player's own staff: keep or fire his coordinators, interview, hire.

const JOB = { hc: 'HC', oc: 'OC', dc: 'DC' }
const JOB_LONG = { hc: 'HEAD COACH', oc: 'OFFENSIVE COORDINATOR', dc: 'DEFENSIVE COORDINATOR' }
const SIDE_OF = { oc: 'off', dc: 'def' }
const SIDE_WORD = { off: 'OFFENSE', def: 'DEFENSE' }
const lastOf = n => splitName(n ?? '').last.toUpperCase()
const ORD = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH'}`
// his five ratings as an object, whoever he is (a staff man's array, the player's coach's own)
const fiveOf = (F, c) => (c?.mine ? F.coach?.r : rOf(c)) ?? null

// The five ratings in words a player reads at a glance: spelled out where there's room (full), a one-word form
// in a tight list (a candidate list, the league's new hires)
const CNAME = { talentDev: 'Develops players', offPlaycalling: 'Offense play-calling', defPlaycalling: 'Defense play-calling', culture: 'Team culture', situational: 'Game management' }
const CWORD = { talentDev: 'Develop', offPlaycalling: 'Offense', defPlaycalling: 'Defense', culture: 'Culture', situational: 'Game mgmt' }
// The five grades under a coach's lower-third. on: the rating in use (his play-calling, when he calls a side)
export function Grades({ r, on = [], hidden = false, reveal = false, delay = 0, full = true }) {
  return (
    <div className={`fst-g${full ? ' fst-g--full' : ''}${reveal ? ' is-reveal' : ''}`} role="list">
      {CTYPES.map((t, i) => (
        <span key={t} role="listitem" className={`fst-gc${on.includes(t) ? ' is-on' : ''}`} style={{ '--d': `${delay + i * 110}ms` }} title={CNAME[t]}>
          <small>{(full ? CNAME : CWORD)[t]}</small><b>{hidden || !r ? '?' : cLetter(r[t])}</b>
        </span>
      ))}
    </div>
  )
}
// A coach as a lower-third, his grades under it.
//   c: staff man / myHC / a pool man · role 'hc' | 'oc' | 'dc' · team · line · calls: ['off'] the sides he calls
export function StaffL3({ F, c, role, team, line, calls = [], size = 'm', mine, hidden = false, reveal = false, onClick, delay = 0, stamp, full = size !== 's' }) {
  const r = fiveOf(F, c)
  const on = calls.map(s => (s === 'off' ? 'offPlaycalling' : 'defPlaycalling'))
  return (
    <div className={`fst-man fst-man--${size}`} style={{ '--d': `${delay}ms` }}>
      <LowerThird name={c?.n ?? c?.name} pos={JOB[role]} team={team} photo={coachPhoto(c, team)} size={size} mine={mine} line={line} onClick={onClick} delay={delay}
        stat={hidden || !r ? { v: c?.ag ?? '-', label: 'AGE' } : { v: coachGrade(r, role), label: 'GRADE' }} />
      {stamp}
      <Grades r={r} on={on} hidden={hidden} reveal={reveal} delay={delay} full={full} />
    </div>
  )
}
// who calls the plays, the way a broadcast says it
function callLine(F, s, role) {
  const T = staffOf(F, s)
  const sides = ['off', 'def'].filter(x => (role === 'hc' ? T?.call?.[x] === 'hc' : T?.call?.[x] === role && SIDE_OF[role] === x))
  return sides
}
const callText = sides => (sides.length === 2 ? 'CALLS THE PLAYS' : sides.length ? `CALLS THE ${SIDE_WORD[sides[0]]}` : null)
// the head coach's record with this team (the seasons this league has played)
function hcRecord(F, s) {
  if (s === F.team) {
    const h = F.hist ?? []
    if (!h.length) return null
    const w = h.reduce((a, x) => a + x.w, 0), l = h.reduce((a, x) => a + x.l, 0), po = h.filter(x => x.fin !== 'out').length
    return `${h.length} ${h.length === 1 ? 'SEASON' : 'SEASONS'} · ${w}-${l}${po ? ` · ${po} PLAYOFF${po === 1 ? '' : 'S'}` : ''}`
  }
  const T = staffOf(F, s), rec = T?.rec ?? []
  if (!rec.length) return null
  return `${rec.reduce((a, x) => a + x[0], 0)}-${rec.reduce((a, x) => a + x[1], 0)} WITH THE ${TEAM[s].nick.toUpperCase()}`
}

// ── The strip on the TEAM tab ────────────────────────────────────────────────
export function StaffStrip({ F, onOpen }) {
  const M = staffMen(F, F.team)
  return (
    <button type="button" className="fst-strip" style={fkVars(F.team)} onClick={onOpen} aria-label="Coaching staff">
      <span className="fst-strip-h"><b>COACHING STAFF</b><small>›</small></span>
      <span className="fst-strip-row">
        {['hc', 'oc', 'dc'].map(k => {
          const c = M[k], r = fiveOf(F, c)
          return (
            <span key={k} className="fst-chip">
              <span className="fst-chip-face">{c && <img src={coachPhoto(c, F.team)} alt="" draggable={false} />}</span>
              <span className="fst-chip-txt"><small>{JOB[k]}{r && <i>{coachGrade(r, k)}</i>}</small><b>{c ? lastOf(c.n) : 'OPEN'}</b></span>
            </span>
          )
        })}
      </span>
    </button>
  )
}

// ── The staff screen ─────────────────────────────────────────────────────────
export function StaffScreen({ F, act, owner, onBack }) {
  const M = staffMen(F, F.team), T = staffOf(F, F.team)
  const hot = hotSeat(F)
  const caller = side => callerOf(F, F.team, side)
  const flip = (side, who) => { if (T.call?.[side] === who) return; act(X => setCalls(X, side, who)); sfx('swap'); haptic('light') }
  return (
    <div className="fd fk fst fd-narrow">
      <BackBar label="Depth chart" title="Coaching staff" onBack={onBack} />
      <Chyron team={F.team} title="COACHING STAFF" tag={F.year} sub={`OFFENSE: ${lastOf(caller('off').c?.n)} · DEFENSE: ${lastOf(caller('def').c?.n)}`} />
      {hot && <HotSeat F={F} hot={hot} />}
      <StaffL3 F={F} c={M.hc} role="hc" team={F.team} size="l" mine={owner} calls={callLine(F, F.team, 'hc')} line={hcRecord(F, F.team) ?? STYLES[F.coach?.style]?.name ?? 'FIRST SEASON'} />
      {['oc', 'dc'].map((k, i) => M[k]
        ? <StaffL3 key={k} F={F} c={M[k]} role={k} team={F.team} calls={callLine(F, F.team, k)} delay={80 + i * 80} line={callText(callLine(F, F.team, k)) ?? `SINCE ${M[k].st ?? F.year} · AGE ${M[k].ag}`} />
        : <div key={k} className="fst-open"><b>{JOB_LONG[k]}</b><span>OPEN</span></div>)}
      <Chyron tone="ink" size="s" title="WHO CALLS THE PLAYS" />
      {['off', 'def'].map(side => {
        const co = side === 'off' ? 'oc' : 'dc', j = side === 'off' ? 'offPlaycalling' : 'defPlaycalling'
        return (
          <div key={side} className="fst-call" role="radiogroup" aria-label={`${SIDE_WORD[side]} play-caller`}>
            <span className="fst-call-l">{SIDE_WORD[side]}</span>
            {[['hc', M.hc], [co, M[co]]].map(([who, c]) => {
              const r = fiveOf(F, c), on = (T.call?.[side] ?? co) === who
              return (
                <button key={who} type="button" role="radio" aria-checked={on} disabled={!c} className={on ? 'is-on' : ''} style={fkVars(F.team)} onClick={() => flip(side, who)}>
                  <small>{JOB[who]}</small><b>{c ? lastOf(c.n) : 'OPEN'}</b><i>{r ? cLetter(r[j]) : '-'}</i>
                </button>
              )
            })}
          </div>
        )
      })}
      <p className="fst-note">Tap a coach to give him the calls. The grade is his play-calling on that side; you can change it any week.</p>
    </div>
  )
}
function HotSeat({ F, hot }) {
  return (
    <section className="fst-hot">
      <Chyron tone="l" size="s" title="HOT SEAT" right="THE OWNER" />
      <div className="fst-hot-b"><b>{hot.w}-{hot.l}</b><span>THE LAST {hot.n} SEASONS · NO PLAYOFFS</span></div>
    </section>
  )
}

// ── THE COACHING CAROUSEL: the offseason's first stop ───────────────────────
export function Carousel({ F, act, owner }) {
  const car = F.car
  const step = car?.step ?? 'monday'
  const go = s => { act(X => setCarStep(X, s)); sfx('whistle') }
  if (!car) return <Go onClick={() => act(X => closeCarousel(X))}>THE AWARDS</Go>
  if (step === 'monday') return <Monday F={F} onNext={() => go('hires')} />
  if (step === 'hires') return <Hires F={F} onNext={() => go('staff')} />
  if (step === 'oc' || step === 'dc') return <Search key={step} F={F} act={act} owner={owner} k={step} onBack={() => go('staff')} />
  return <MyStaff F={F} act={act} owner={owner} onSearch={k => go(k)} />
}
// where a new head coach came from, short: "BILLS DC", "FMR BILLS HC", "OHIO STATE HC"
const ABBR = [['offensive coordinator', 'OC'], ['defensive coordinator', 'DC']]
function fromShort(e) {
  if (e.from) { let t = e.from; for (const [a, b] of ABBR) t = t.replace(a, b); return `FROM ${t.toUpperCase()}` }
  const w = (e.was ?? '').toUpperCase()
  return w ? (w.endsWith('HEAD COACH') ? w.replace('HEAD COACH', 'HC') : `FMR ${w.split(' · ')[0]}`) : null
}
// a team's record last season: "11-6"
function lastRec(F, s) { const r = records(F)[s]; return r ? recText(r) : '' }
const evs = (F, f) => (F.car?.ev ?? []).filter(f)
// the stamps land one after another, then rest (a tap on the list skips to the end)
function useStagger(n, gap = 170) {
  const [k, setK] = useState(() => (reduced() ? n : 0))
  useEffect(() => { if (k >= n) return; const t = setTimeout(() => setK(x => x + 1), k === 0 ? 300 : gap); return () => clearTimeout(t) }, [k, n, gap])
  return [k, () => setK(n)]
}
function Monday({ F, onNext }) {
  const out = evs(F, e => e.role === 'hc' && (e.k === 'fire' || e.k === 'ret'))
  const co = evs(F, e => e.role !== 'hc' && (e.k === 'fire' || e.k === 'ret') && !e.newHC)
  const [k, skip] = useStagger(out.length)
  const by = id => F.cpool.find(c => c.i === id)
  return (
    <div className="fst-car">
      <Chyron tone="ink" size="l" title="BLACK MONDAY" tag={F.year} sub={out.length ? `${out.filter(e => e.k === 'fire').length} HEAD COACHES FIRED${out.some(e => e.k === 'ret') ? ` · ${out.filter(e => e.k === 'ret').length} RETIRED` : ''}` : 'EVERY HEAD COACH KEEPS HIS JOB'} />
      <div className="fst-list" onClick={skip}>
        {out.map((e, i) => {
          const c = by(e.id) ?? { n: e.n, ag: e.ag }
          return (
            <div key={e.id} className={`fst-evt${i < k ? ' is-in' : ''}`}>
              <LowerThird name={e.n} pos="HC" team={e.s} photo={coachPhoto(c, e.s)} line={e.k === 'fire' ? `${TEAM[e.s].nick.toUpperCase()} · ${e.rec}${e.yrs > 1 ? ` · ${e.yrs} SEASONS` : ''}` : `${TEAM[e.s].nick.toUpperCase()} · AGE ${e.ag}`} />
              {i < k && <Stamp kind={e.k === 'fire' ? 'l' : 'ink'} quiet={reduced()}>{e.k === 'fire' ? 'FIRED' : 'RETIRED'}</Stamp>}
            </div>
          )
        })}
      </div>
      {co.length > 0 && (
        <>
          <Chyron tone="ink" size="s" title="COORDINATORS" right={co.length} />
          {co.map(e => <Wire key={`${e.k}-${e.id}`} F={F} e={e} />)}
        </>
      )}
      <ActionBar><Go onClick={onNext}>Next: New head coaches</Go></ActionBar>
    </div>
  )
}
function Wire({ F, e }) {
  return <div className={`fst-wire${e.mine ? ' is-me' : ''}`} style={fkVars(e.s)}><KLogo s={e.s} size={22} /><span>{moveText(F, e)}</span></div>
}
function Hires({ F, onNext }) {
  const hires = evs(F, e => e.k === 'hire' && e.role === 'hc')
  const [k, skip] = useStagger(hires.length, 200)
  const moves = evs(F, e => e.k === 'fire' && e.newHC)
  return (
    <div className="fst-car">
      <Chyron tone="ink" size="l" title="NEW HEAD COACHES" tag={F.year + 1} sub={hires.length ? `${hires.length} ${hires.length === 1 ? 'TEAM' : 'TEAMS'}` : 'NO OPENINGS THIS YEAR'} />
      <div className="fst-list" onClick={skip}>
        {hires.map((e, i) => {
          const c = staffOf(F, e.s)?.hc
          return (
            <div key={e.id} className={`fst-evt${i < k ? ' is-in' : ''}`}>
              <StaffL3 F={F} c={c ?? { n: e.n }} role="hc" team={e.s} line={[TEAM[e.s].nick.toUpperCase(), fromShort(e)].filter(Boolean).join(' · ')} calls={callLine(F, e.s, 'hc')} full={false} stamp={i < k ? <Stamp kind="w" quiet={reduced()}>HIRED</Stamp> : null} />
            </div>
          )
        })}
      </div>
      {moves.length > 0 && (
        <>
          <Chyron tone="ink" size="s" title="NEW STAFFS" sub="COORDINATORS LET GO BY A NEW HEAD COACH" />
          {moves.map(e => <Wire key={e.id} F={F} e={e} />)}
        </>
      )}
      <ActionBar><Go onClick={onNext}>Next: Your staff</Go></ActionBar>
    </div>
  )
}
// the side's season in one line: "OFFENSE 24TH IN POINTS · 19.4 A GAME"
function unitLine(F, k) {
  const rk = F.car?.ranks?.[F.team]?.[k === 'oc' ? 0 : 1]
  const h = F.hist?.[F.hist.length - 1], g = h ? Math.max(1, h.w + h.l + h.t) : 17
  if (!rk) return null
  return k === 'oc' ? `${ORD(rk)} IN POINTS · ${(h.pf / g).toFixed(1)} A GAME` : `${ORD(rk)} IN POINTS ALLOWED`
}
function MyStaff({ F, act, owner, onSearch }) {
  const M = staffMen(F, F.team)
  const [ask, setAsk] = useState(null)        // the coordinator the player is about to fire
  const hot = hotSeat(F)
  const left = evs(F, e => e.s === F.team && (e.k === 'leave' || (e.k === 'ret' && e.role !== 'hc')))
  const hired = evs(F, e => e.s === F.team && e.k === 'hire')
  const open = myOpenings(F)
  const fire = k => { act(X => fireMine(X, k)); setAsk(null); sfx('stamp'); haptic('heavy') }
  return (
    <div className="fst-car">
      <Chyron team={F.team} size="l" title="YOUR STAFF" tag={F.year + 1} sub={`${TEAM[F.team].nick.toUpperCase()} · HEAD COACH ${lastOf(F.coach?.name ?? owner)}`} />
      {hot && <HotSeat F={F} hot={hot} />}
      {left.map(e => (
        <div key={`l-${e.id}`} className="fst-gone" style={fkVars(e.to ?? F.team)}>
          {e.to && <KLogo s={e.to} size={34} />}
          <span><b>{e.n}</b><small>{e.k === 'leave' ? `${JOB_LONG[e.role]} · HIRED AS THE ${TEAM[e.to].nick.toUpperCase()} HEAD COACH` : `${JOB_LONG[e.role]} · RETIRES AT ${e.ag}`}</small></span>
          <Stamp kind="ink" quiet>{e.k === 'leave' ? 'GONE' : 'RETIRED'}</Stamp>
        </div>
      ))}
      {['oc', 'dc'].map((k, i) => {
        const c = M[k]
        if (!c) return (
          <div key={k} className="fst-job" style={fkVars(F.team)}>
            <span><small>OPEN</small><b>{JOB_LONG[k]}</b></span>
            <Go onClick={() => onSearch(k)} sub={`${interviewsLeft(F, k)} INTERVIEWS`}>HIRE ONE</Go>
          </div>
        )
        const isNew = hired.some(e => e.id === c.i)
        return (
          <div key={k} className="fst-keep">
            <StaffL3 F={F} c={c} role={k} team={F.team} delay={i * 90} calls={callLine(F, F.team, k)} line={isNew ? `NEW · ${callText(callLine(F, F.team, k)) ?? 'HC CALLS THE ' + SIDE_WORD[SIDE_OF[k]]}` : unitLine(F, k)} stamp={isNew ? <Stamp kind="w" quiet>HIRED</Stamp> : null} />
            {!isNew && (ask === k
              ? <div className="fd-two"><Go onClick={() => fire(k)}>FIRE HIM</Go><Go ghost onClick={() => { setAsk(null); sfx('back') }}>KEEP HIM</Go></div>
              : <button type="button" className="fst-fire" onClick={() => { setAsk(k); sfx('tap') }}>FIRE THE {k === 'oc' ? 'OC' : 'DC'}</button>)}
          </div>
        )
      })}
      {open.length
        ? <p className="fst-note">{open.length === 2 ? 'Both coordinator jobs are open' : `The ${JOB_LONG[open[0]].toLowerCase()} job is open`}. Leave a job open and a position coach on the staff is promoted.</p>
        : null}
      <ActionBar><Go onClick={() => { act(X => closeCarousel(X)); sfx('whistle') }} sub={open.length ? 'PROMOTE FROM WITHIN' : null}>Next: Awards</Go></ActionBar>
    </div>
  )
}

// ── The search: candidates, interviews, the offer ────────────────────────────
function Search({ F, act, owner, k, onBack }) {
  const [sel, setSel] = useState(null)
  const list = useMemo(() => shortlist(F, k, 8), [F, k, F.car?.mine?.[k]?.gone?.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const iv = F.car?.mine?.[k]?.iv ?? []
  const left = interviewsLeft(F, k)
  if (sel != null) return <Interview key={sel} F={F} act={act} owner={owner} k={k} id={sel} onBack={() => { setSel(null); sfx('back') }} onDone={onBack} />
  return (
    <div className="fst-car">
      <BackBar label="Your staff" title={`${JOB[k]} search`} onBack={onBack} />
      <Chyron team={F.team} title={`${JOB[k]} SEARCH`} right={`${left} OF ${IV_N} LEFT`} sub={`${JOB_LONG[k]} · TAP A CANDIDATE`} />
      {list.map((c, i) => {
        const seen = c.home || iv.includes(c.i)
        return <StaffL3 key={c.i} F={F} c={c} role={k} team={F.team} size="s" hidden={!seen} delay={i * 35} onClick={() => { setSel(c.i); sfx('tap') }}
          line={[c.home ? 'ON YOUR STAFF' : (c.cv ?? '').toUpperCase(), seen ? `AGE ${c.ag}` : null].filter(Boolean).join(' · ')} />
      })}
    </div>
  )
}
function Interview({ F, act, owner, k, id, onBack, onDone }) {
  const V = interviewView(F, k, id)
  const T = staffOf(F, F.team), side = SIDE_OF[k]
  const [calls, setCalls2] = useState(() => T.call?.[side] !== 'hc')
  const [res, setRes] = useState(null)
  const [shown, setShown] = useState(0)
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    if (!res || shown > res.board.length) return
    const t = setTimeout(() => { setShown(x => x + 1); if (shown < res.board.length) sfx('flip') }, reduced() ? 0 : shown === 0 ? 250 : 420)
    return () => clearTimeout(t)
  }, [res, shown])
  if (!V && !res) return <BackBar label="Candidates" onBack={onBack} />
  const c = res?.c ?? V.c
  const seen = res || V.seen
  const left = interviewsLeft(F, k)
  const sit = () => { const ok = act(X => interviewCoach(X, k, id)); if (!ok) { sfx('deny'); return } setFresh(true); sfx('flip'); haptic('medium') }
  const offer = () => { const r = act(X => offerCoach(X, k, id, { calls })); if (!r) { sfx('deny'); return } setRes(r); setShown(0); haptic('medium') }
  const won = res && res.to === F.team
  const hcName = lastOf(F.coach?.name ?? owner)
  return (
    <div className="fst-car">
      <BackBar label="Candidates" title={c.n} onBack={onBack} />
      <StaffL3 F={F} c={c} role={k} team={res && !won ? res.to : F.team} hidden={!seen} reveal={fresh} line={[res ? null : c.home ? `${TEAM[F.team].nick.toUpperCase()} POSITION COACH` : (c.cv ?? '').toUpperCase(), `AGE ${c.ag}`].filter(Boolean).join(' · ')} />
      {!seen && (
        <>
          <p className="fst-note">An interview shows his grades, who else wants him and what he wants. {left} of {IV_N} left.</p>
          <ActionBar><Go onClick={sit} disabled={left <= 0}>{left > 0 ? 'Interview him' : 'No interviews left'}</Go></ActionBar>
        </>
      )}
      {seen && !res && (
        <>
          <div className="fst-facts">
            <span><small>CALLING PLAYS</small><b>{V.wants ? 'WANTS TO' : 'OPEN TO EITHER'}</b></span>
            <span><small>{V.rivals.length ? 'ALSO INTERVIEWING' : 'OTHER TEAMS'}</small>{V.rivals.length ? <em>{V.rivals.map(x => <KLogo key={x.s} s={x.s} size={26} />)}</em> : <b>NONE</b>}</span>
          </div>
          <div className="fst-call" role="radiogroup" aria-label="Play-calling">
            <span className="fst-call-l">{SIDE_WORD[side]} PLAYS</span>
            <button type="button" role="radio" aria-checked={calls} className={calls ? 'is-on' : ''} style={fkVars(F.team)} onClick={() => { setCalls2(true); sfx('tap') }}><small>{JOB[k]}</small><b>{lastOf(c.n)}</b><i>{cLetter(V.r[side === 'off' ? 'offPlaycalling' : 'defPlaycalling'])}</i></button>
            <button type="button" role="radio" aria-checked={!calls} className={!calls ? 'is-on' : ''} style={fkVars(F.team)} onClick={() => { setCalls2(false); sfx('tap') }}><small>HC</small><b>{hcName}</b><i>{cLetter(F.coach?.r?.[side === 'off' ? 'offPlaycalling' : 'defPlaycalling'])}</i></button>
          </div>
          <ActionBar><Go onClick={offer}>Offer the job</Go></ActionBar>
        </>
      )}
      {res && (
        <>
          <Chyron tone="ink" size="s" title="THE OFFERS" right={res.board.length} />
          <div className="fd-reveal">
            {[...res.board].sort((a, b) => (a.s === F.team ? -1 : b.s === F.team ? 1 : 0)).map((b, j) => (
              <div key={b.s} className={`fd-offer${j < shown ? ' is-open' : ''}${shown > res.board.length - 1 && b.s === res.to ? ' is-win' : ''}`} style={fkVars(b.s)}>
                <KLogo s={b.s} size={34} />
                <b>{TEAM[b.s].nick.toUpperCase()}</b>
                <span className="fd-offer-v">{j < shown ? lastRec(F, b.s) : '-'}</span>
                <small>{j < shown ? (b.calls ? 'CALLS PLAYS' : 'NO CALLS') : ''}</small>
              </div>
            ))}
          </div>
          {shown > res.board.length && (
            <div className="fd-verdict">
              <Stamp kind={won ? 'w' : 'l'} big>{won ? 'HIRED' : 'GONE'}</Stamp>
              <b>{won ? `${TEAM[F.team].nick} hire ${c.n} as ${JOB_LONG[k].toLowerCase()}` : `${c.n} takes the ${TEAM[res.to].nick} job`}</b>
            </div>
          )}
          {shown > res.board.length && <ActionBar><Go onClick={won ? onDone : onBack}>{won ? 'Back to your staff' : 'Back to the candidates'}</Go></ActionBar>}
        </>
      )}
    </div>
  )
}
