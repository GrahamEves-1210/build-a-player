import { useEffect, useMemo } from 'react'
import { TEAM, NC } from '../../../lib/franchise2/nba'
import { sfx, haptic } from '../../../lib/juice'
import { Chyron, Go, Stamp } from '../kit'
import { CoachReveal } from '../CoachBuild'
import { StaffL3 } from '../Staff'
import { NBA_COACH, NBA_STAFF } from './nbaCoachLg'
import { CAP_WHAT } from './NbaSetup'
import '../staff.css'

// BASKETBALL FRANCHISE, the setup's last step: THE HIRE. Football's coach card (CoachBuild.jsx CoachReveal) with the
// NBA's staff under it: the lead assistant (the offense), the defensive coordinator and the player development coach.
// The men in the jobs now stay unless the GM hires others: each job's search lists the man there and five candidates
// (assistants around the league, G League and overseas coaches), whose grades show once they've been interviewed
// (three interviews a job, Staff.jsx's search). Then the league rules again and tip-off.
//   setup.hire = { team, staff: { oc|dc|pd: candidate }, iv: { oc|dc|pd: [keys] } } · setup.hk the job being searched,
//   setup.hsel the candidate open
const JOB_LONG = NC.JOB_LONG
const lastOf = n => String(n ?? '').split(' ').slice(-1)[0].toUpperCase()
export const hireOf = S => (S.hire?.team === S.team ? S.hire : { team: S.team, staff: {}, iv: {} })
// the men the GM hired (none for a job he left alone): createNbaFranchise's setup.staff
export const hiresOf = S => Object.fromEntries(NC.JOBS.map(k => [k, hireOf(S).staff[k]]).filter(([, c]) => c && !c.home))

export default function NbaHire({ S, go, owner, onStart, rules, onRules, games }) {
  // (back from a job's search: that job in view, not the top of the card)
  useEffect(() => { if (!S.hk && S.hlast) document.querySelector(`[data-job="${S.hlast}"]`)?.scrollIntoView({ block: 'center', behavior: 'instant' }) }, [S.hk]) // eslint-disable-line react-hooks/exhaustive-deps
  if (S.hk) return <Search S={S} go={go} k={S.hk} />
  const H = hireOf(S)
  const lists = Object.fromEntries(NC.JOBS.map(k => [k, NC.setupCandidates(S.seed, S.team, k)]))
  return (
    <CoachReveal S={S} owner={owner} onStart={onStart} onRules={onRules} lg={NBA_COACH} capWhat={CAP_WHAT} extra={games} cta="Tip off">
      <section className="fst nb-hire">
        <Chyron team={S.team} size="s" title="The staff" right="KEEP OR HIRE" />
        {NC.JOBS.map((k, i) => {
          const c = H.staff[k] ?? lists[k][0]
          const isNew = !c.home
          return (
            <div key={k} className="fst-keep" data-job={k}>
              <StaffL3 c={c} role={k} team={S.team} size="s" full={false} lg={NBA_STAFF} delay={i * 60}
                line={isNew ? `${JOB_LONG[k]} · NEW HIRE` : `${JOB_LONG[k]} · SINCE ${c.st}`} stamp={isNew ? <Stamp kind="w" quiet>HIRED</Stamp> : null} />
              <button type="button" className="fst-fire" onClick={() => go({ hk: k, hsel: null }, 'tap')}>{isNew ? 'CHANGE' : 'INTERVIEW CANDIDATES'}</button>
            </div>
          )
        })}
        <p className="fst-note">{NC.JOB_WHAT.oc}, {NC.JOB_WHAT.dc.toLowerCase()}, {NC.JOB_WHAT.pd.toLowerCase()}: each one's grade counts with the head coach's.</p>
      </section>
    </CoachReveal>
  )
}

// a job's search: the man there now (his grades known), the candidates (an interview shows theirs), hire one
function Search({ S, go, k }) {
  const H = hireOf(S)
  const list = useMemo(() => NC.setupCandidates(S.seed, S.team, k), [S.seed, S.team, k])
  const iv = H.iv[k] ?? []
  const left = NC.IV_N - iv.length
  const cur = H.staff[k] ?? list[0]
  const put = (patch, s) => go({ hire: { ...H, ...patch } }, s)
  const sel = S.hsel != null ? list.find(c => c.key === S.hsel) : null
  if (sel) {
    const seen = sel.home || iv.includes(sel.key)
    const isCur = cur.key === sel.key
    const interview = () => { if (left <= 0) { sfx('deny'); return } put({ iv: { ...H.iv, [k]: [...iv, sel.key] } }, 'flip'); haptic('medium') }
    const hire = () => {
      const staff = { ...H.staff }
      if (sel.home) delete staff[k]; else staff[k] = sel
      go({ hire: { ...H, staff }, hk: null, hsel: null, hlast: k }, 'claim'); haptic('success')
    }
    return (
      <div className="fst-car">
        <Chyron team={S.team} title={sel.n} sub={JOB_LONG[k]} />
        <StaffL3 c={sel} role={k} team={S.team} lg={NBA_STAFF} hidden={!seen} reveal={seen && !sel.home} line={[sel.home ? `${TEAM[S.team].nick.toUpperCase()} ${JOB_LONG[k]}` : sel.cv, `AGE ${sel.ag}`].filter(Boolean).join(' · ')} />
        {!seen ? (
          <>
            <p className="fst-note">An interview shows his grades. {left} of {NC.IV_N} interviews left for this job.</p>
            <div className="fsu-acts"><Go onClick={interview} disabled={left <= 0}>{left > 0 ? 'Interview him' : 'No interviews left'}</Go><Go ghost onClick={() => go({ hsel: null }, 'back')}>Back to the candidates</Go></div>
          </>
        ) : (
          <div className="fsu-acts">
            {isCur ? <Go onClick={() => go({ hk: null, hsel: null, hlast: k }, 'back')}>{sel.home ? 'Keep him' : 'Back to the staff'}</Go> : <Go onClick={hire}>{sel.home ? 'Keep him' : `Hire ${lastOf(sel.n)}`}</Go>}
            <Go ghost onClick={() => go({ hsel: null }, 'back')}>Back to the candidates</Go>
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="fst-car">
      <Chyron team={S.team} title={`${NC.JOB[k]} search`} right={`${left} OF ${NC.IV_N} INTERVIEWS LEFT`} sub={`${JOB_LONG[k]} · TAP A CANDIDATE`} />
      {list.map((c, i) => {
        const known = c.home || iv.includes(c.key)
        return (
          <StaffL3 key={c.key} c={c} role={k} team={S.team} size="s" lg={NBA_STAFF} hidden={!known} delay={i * 35} onClick={() => go({ hsel: c.key }, 'tap')}
            stamp={cur.key === c.key ? <Stamp kind="w" quiet>{c.home ? 'IN THE JOB' : 'HIRED'}</Stamp> : null}
            line={[c.home ? `IN THE JOB SINCE ${c.st}` : c.cv, `AGE ${c.ag}`].filter(Boolean).join(' · ')} />
        )
      })}
      <div className="fsu-acts"><Go ghost onClick={() => go({ hk: null, hsel: null, hlast: k }, 'back')}>Back to the staff</Go></div>
    </div>
  )
}
