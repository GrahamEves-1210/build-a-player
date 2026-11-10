import { cfbLogo, cfbLogoDark } from './cfbShared'
import { LEAVES } from './cfbRecruit'

// The recruiting screens' pieces, shared by Career's Start in College (CareerCollege.jsx) and the one-off
// mode's offers and transfer portal (CFBMode.jsx): the stars, the offer board, the commit button.

export const Stars = ({ n }) => <span className="cfbr-stars" aria-label={`${n} stars`}>{'★'.repeat(n)}<i>{'★'.repeat(5 - n)}</i></span>

// The offers as a recruiting board: one row a school, its numbers in columns, and his role there.
// The job he'd be fighting for shows on the school he taps, in a line (a receiver's is the No. 3 spot:
// the third starting receiver).
// compete (the one-off mode): he plays wherever he signs, so a school where the man there grades out better
// is a job he has to win in camp (COMPETES), not a backup's role
const JOB = { qb: 'the starting job', rb: 'the starting job', wr: 'the No. 3 receiver spot' }
function jobLine(o, pos, compete) {
  const b = o.bar
  if (!b) return `${JOB[pos].charAt(0).toUpperCase() + JOB[pos].slice(1)} is open.`
  if (compete) return o.starts ? `Takes ${JOB[pos]} from ${b.name} (${b.ovr}).` : `Competes with ${b.name} (${b.ovr}) for ${JOB[pos]}.`
  const leaves = LEAVES.has(String(b.year ?? '').toUpperCase())
  if (o.starts) return `Beats out ${b.name} (${b.ovr}) for ${JOB[pos]}.${leaves && o.stay ? ` ${b.name.split(' ').pop()} is a senior.` : ''}`
  return `Backs up ${b.name} (${b.ovr}) for ${JOB[pos]}${leaves ? `, a senior: the job opens after this year` : ''}.`
}
export function OfferBoard({ offers, teamsBy, confOf, pos, picked, onPick, compete = false }) {
  return (
    <div className="cfbr-board" role="radiogroup" aria-label="Offers">
      <div className="cfbr-board-row is-head" aria-hidden="true"><span>SCHOOL</span><span className="is-conf">CONF</span><span>FPI</span><span>AP</span><span className="is-role">ROLE</span></div>
      {offers.map(o => {
        const t = teamsBy[o.short]
        if (!t) return null
        const on = picked === o.short
        return (
          <button key={o.short} type="button" role="radio" aria-checked={on} className={`cfbr-board-row${on ? ' is-on' : ''}${o.stay ? ' is-stay' : ''}`} onClick={() => onPick(o.short)}>
            <span className="cfbr-board-school">
              <img src={cfbLogoDark(t.short)} alt="" onError={e => { e.currentTarget.src = cfbLogo(t.short) }} />
              <b>{t.school}</b>
              {o.stay && <em>NOW</em>}
            </span>
            <span className="is-conf">{confOf[t.conf]?.short ?? ''}</span>
            <span className="is-num">{t.fpiRank ?? '–'}</span>
            <span className="is-num">{t.ap ?? '–'}</span>
            <span className="is-role"><i className={o.starts ? 'is-start' : ''}>{o.starts ? 'STARTER' : compete ? 'COMPETES' : 'BACKUP'}</i></span>
            {on && <span className="cfbr-board-job">{jobLine(o, pos, compete)}</span>}
          </button>
        )
      })}
    </div>
  )
}
// the commit button, pinned above the dock and the website's ad rail
export function CommitBar({ label, on, onGo }) {
  return (
    <div className="cfbr-commit-bar">
      <button className="cfbs-next cfbr-commit" disabled={!on} onClick={onGo}><b>{label}</b></button>
    </div>
  )
}
