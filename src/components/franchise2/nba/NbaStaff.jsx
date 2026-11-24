import { useMemo, useState } from 'react'
import { TEAM, NC } from '../../../lib/franchise2/nba'
import { letterColor } from '../../../lib/gradeColors'
import { sfx, haptic } from '../../../lib/juice'
import { Chyron, Go, Stamp, BackBar, ActionBar, fkVars } from '../kit'
import { StaffL3 } from '../Staff'
import { NBA_STAFF, nbaCoachPhoto } from './nbaCoachLg'
import '../staff.css'

// BASKETBALL FRANCHISE, THE STAFF (football's Staff.jsx in the NBA's terms): the head coach the GM built and his three
// assistants as lower-thirds with their five grades; the owner's hot seat after a bad stretch. In the offseason the GM
// can let an assistant go and hire another (interviews show a candidate's grades: lib/franchise2/nba/coach.js); a job
// another team hired his man away from shows open, and camp promotes from within if he leaves it.
const ROLES = ['hc', ...NC.JOBS]
const lastOf = n => String(n ?? '').split(' ').slice(-1)[0].toUpperCase()
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 'S'}`

// the strip on the TEAM tab
export function NbaStaffStrip({ F, onOpen }) {
  const M = NC.staffMen(F, F.team)
  return (
    <button type="button" className="fst-strip" style={fkVars(F.team)} onClick={onOpen} aria-label="Coaching staff">
      <span className="fst-strip-h"><b>COACHING STAFF</b><small>›</small></span>
      <span className="fst-strip-row nb-fst-row">
        {ROLES.map(k => {
          const c = M[k], r = NBA_STAFF.five(F, c), g = r ? NC.coachGrade(r, k) : null, ph = c ? nbaCoachPhoto(c, F.team, true) : null
          return (
            <span key={k} className="fst-chip">
              <span className="fst-chip-face">{ph ? <img src={ph} alt="" draggable={false} /> : c ? <b className="nb-fst-init">{c.n.split(' ').map(w => w[0]).join('').slice(0, 2)}</b> : null}</span>
              <span className="fst-chip-txt"><small>{NC.JOB[k]}{g && <i style={{ color: letterColor(g) }}>{g}</i>}</small><b>{c ? lastOf(c.n) : 'OPEN'}</b></span>
            </span>
          )
        })}
      </span>
    </button>
  )
}

function hcLine(F) {
  const h = F.hist ?? []
  if (!h.length) return NC.STYLES[F.coach?.style]?.name ?? 'FIRST SEASON'
  const w = h.reduce((a, x) => a + x.w, 0), l = h.reduce((a, x) => a + x.l, 0), po = h.filter(x => x.finish !== 'lottery' && x.finish !== 'playin').length
  return `${plural(h.length, 'SEASON')} · ${w}-${l}${po ? ` · ${plural(po, 'PLAYOFF')}` : ''}`
}
export default function NbaStaffScreen({ F, act, owner, onBack }) {
  const [k, setK] = useState(null)
  const M = NC.staffMen(F, F.team)
  const hot = NC.hotSeat(F)
  const open = NC.staffWindow(F)
  if (k) return <Search F={F} act={act} k={k} onBack={() => { setK(null); sfx('back') }} />
  // (the candidates are made when the search opens, inside act so the save keeps them)
  const search = j => { act(X => { NC.staffCandidates(X, j) }); setK(j); sfx('tap') }
  const poached = (F.phase === 'off' && F.cev?.y === F.year ? F.cev.ev : []).filter(e => e.k === 'leave' && e.mine)
  return (
    <div className="fd fk fst fd-narrow">
      <BackBar label="Team" title="Coaching staff" onBack={onBack} />
      <Chyron team={F.team} title="COACHING STAFF" tag={F.year} sub={`${TEAM[F.team].nick.toUpperCase()} · HEAD COACH ${lastOf(M.hc?.n ?? owner)}`} />
      {hot && (
        <section className="fst-hot">
          <Chyron tone="l" size="s" title="HOT SEAT" right="THE OWNER" />
          <div className="fst-hot-b"><b>{hot.w}-{hot.l}</b><span>THE LAST {hot.n} SEASONS · NO PLAYOFFS</span></div>
        </section>
      )}
      {M.hc && <StaffL3 F={F} c={M.hc} role="hc" team={F.team} size="l" mine={M.hc.mine ? owner : undefined} lg={NBA_STAFF} line={M.hc.mine ? hcLine(F) : `SINCE ${M.hc.st}`} />}
      {poached.map(e => (
        <div key={e.n} className="fst-gone" style={fkVars(e.to)}>
          <span><b>{e.n}</b><small>{NC.JOB_LONG[e.role]} · HIRED AS THE {TEAM[e.to].nick.toUpperCase()} HEAD COACH</small></span>
          <Stamp kind="ink" quiet>GONE</Stamp>
        </div>
      ))}
      {NC.JOBS.map((j, i) => {
        const c = M[j]
        if (!c) return (
          <div key={j} className="fst-job" style={fkVars(F.team)}>
            <span><small>OPEN{open ? '' : ' · FILLED FROM WITHIN AT CAMP'}</small><b>{NC.JOB_LONG[j]}</b></span>
            {open && <Go onClick={() => search(j)} sub={`${NC.interviewsLeft(F, j)} INTERVIEWS LEFT`}>Hire one</Go>}
          </div>
        )
        const isNew = c.st === F.year + 1 && open
        return (
          <div key={j} className="fst-keep">
            <StaffL3 F={F} c={c} role={j} team={F.team} lg={NBA_STAFF} delay={80 + i * 80} line={isNew ? `NEW · ${NC.JOB_LONG[j]}` : NC.JOB_LONG[j]} stamp={isNew ? <Stamp kind="w" quiet>HIRED</Stamp> : null} />
            {open && <button type="button" className="fst-fire" onClick={() => search(j)}>FIND A REPLACEMENT</button>}
          </div>
        )
      })}
      <p className="fst-note">{open ? 'The offseason is when staffs change: interview candidates and hire one. A job left open is filled from within at camp.' : 'Staff changes wait for the offseason.'}</p>
    </div>
  )
}

// the search for job k: the candidates (an interview shows a man's grades), the man there now let go when one is hired
function Search({ F, act, k, onBack }) {
  const [sel, setSel] = useState(null)
  const list = useMemo(() => NC.staffCandidates(F, k), [F, k]) // eslint-disable-line react-hooks/exhaustive-deps
  const left = NC.interviewsLeft(F, k)
  const cur = NC.staffMen(F, F.team)[k]
  const c = sel != null ? list.find(x => x.i === sel) : null
  if (c) {
    const seen = NC.gradesKnown(F, c, k)
    const sit = () => { if (!act(X => NC.interviewStaff(X, k, c.i))) { sfx('deny'); return } sfx('flip'); haptic('medium') }
    const hire = () => { if (!act(X => NC.hireStaff(X, k, c.i))) { sfx('deny'); return } sfx('claim'); haptic('success'); onBack() }
    return (
      <div className="fst-car">
        <BackBar label="Candidates" title={c.n} onBack={() => { setSel(null); sfx('back') }} />
        <StaffL3 F={F} c={c} role={k} team={F.team} lg={NBA_STAFF} hidden={!seen} reveal={seen} line={[c.home ? `${TEAM[F.team].nick.toUpperCase()} ASSISTANT` : c.cv, `AGE ${c.ag}`].filter(Boolean).join(' · ')} />
        {!seen
          ? <><p className="fst-note">An interview shows his grades. {left} of {NC.IV_N} interviews left for this job.</p><ActionBar><Go onClick={sit} disabled={left <= 0}>{left > 0 ? 'Interview him' : 'No interviews left'}</Go></ActionBar></>
          : <><p className="fst-note">{cur ? `Hiring him lets ${cur.n} go.` : 'The job is open.'}</p><ActionBar><Go onClick={hire}>{`Hire ${lastOf(c.n)}`}</Go></ActionBar></>}
      </div>
    )
  }
  return (
    <div className="fst-car">
      <BackBar label="Coaching staff" title={`${NC.JOB[k]} search`} onBack={onBack} />
      <Chyron team={F.team} title={`${NC.JOB[k]} SEARCH`} right={`${left} OF ${NC.IV_N} INTERVIEWS LEFT`} sub={`${NC.JOB_LONG[k]} · TAP A CANDIDATE`} />
      {cur && <StaffL3 F={F} c={cur} role={k} team={F.team} size="s" lg={NBA_STAFF} line={`IN THE JOB SINCE ${cur.st ?? F.year}`} stamp={<Stamp kind="ink" quiet>NOW</Stamp>} />}
      {list.map((x, i) => (
        <StaffL3 key={x.i} F={F} c={x} role={k} team={F.team} size="s" lg={NBA_STAFF} hidden={!NC.gradesKnown(F, x, k)} delay={i * 35} onClick={() => { setSel(x.i); sfx('tap') }}
          line={[x.home ? `${TEAM[F.team].nick.toUpperCase()} ASSISTANT` : x.cv, `AGE ${x.ag}`].filter(Boolean).join(' · ')} />
      ))}
    </div>
  )
}
