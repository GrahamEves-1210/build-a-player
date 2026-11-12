import { cbbLogo, cbbLogoDark } from './cbbShared'
import { LEAVES } from './cbbRecruit'

// The recruiting screens' pieces, shared by Career's Start in College (CareerCollegeHoops.jsx) and the one-off
// mode's offers and transfer portal (CBBMode.jsx): the stars, the offer board, the commit button.
// (College Football's board, CFBOffers.jsx, with basketball's columns: BPI in FPI's place, a starting spot for the job)

export const Stars = ({ n }) => <span className="cfbr-stars" aria-label={`${n} stars`}>{'★'.repeat(n)}<i>{'★'.repeat(5 - n)}</i></span>

// compete (an upperclassman in the one-off mode): he plays wherever he signs, so a school where the man there
// grades out better is a spot he has to win in practice (COMPETES); an underclassman behind a better starter
// comes off the bench there (BENCH)
const JOB = { guard: 'a starting spot in the backcourt', big: 'a starting spot in the frontcourt' }
function jobLine(o, pos, compete) {
  const b = o.bar
  if (!b) return `${JOB[pos].charAt(0).toUpperCase() + JOB[pos].slice(1)} is open.`
  if (compete) return o.starts ? `Takes ${JOB[pos]} from ${b.name} (${b.ovr}).` : `Competes with ${b.name} (${b.ovr}) for ${JOB[pos]}.`
  const leaves = LEAVES.has(String(b.year ?? '').toUpperCase())
  if (o.starts) return `Beats out ${b.name} (${b.ovr}) for ${JOB[pos]}.${leaves && o.stay ? ` ${b.name.split(' ').pop()} is a senior.` : ''}`
  return `Comes off the bench behind ${b.name} (${b.ovr})${leaves ? ', a senior: the spot opens after this year' : ''}.`
}
// The offers are listed and numbered by program prestige, the way a recruit's list reads: the blue bloods in the
// order the sport ranks them (titles, Final Fours, NBA players), then everyone else by this year's AP poll and BPI
const PRESTIGE = ['DUKE', 'KAN', 'UKY', 'UNC', 'CONN', 'UCLA', 'IND', 'MSU', 'VILL', 'ARIZ', 'GONZ', 'LOU', 'FLA', 'HOU', 'PUR', 'SYR', 'MICH', 'OSU', 'GTWN', 'ARK', 'TEX']
const standing = (o, t) => { const k = PRESTIGE.indexOf(o.short); return k >= 0 ? k : 100 + Math.min(t?.ap ?? 99, (t?.bpiRank ?? 999) / 2 + 20) * 10 + (t?.bpiRank ?? 999) / 100 }
export function OfferBoard({ offers, teamsBy, confOf, pos, picked, onPick, compete = false }) {
  const list = offers.filter(o => teamsBy[o.short]).sort((a, b) => standing(a, teamsBy[a.short]) - standing(b, teamsBy[b.short]))
  return (
    <div className="cfbr-board" role="radiogroup" aria-label="Offers">
      <div className="cfbr-board-row is-head" aria-hidden="true"><span>SCHOOL</span><span className="is-conf">CONF</span><span>BPI</span><span>AP</span><span className="is-role">ROLE</span></div>
      {list.map((o, i) => {
        const t = teamsBy[o.short]
        const on = picked === o.short
        return (
          <button key={o.short} type="button" role="radio" aria-checked={on} className={`cfbr-board-row${on ? ' is-on' : ''}${o.stay ? ' is-stay' : ''}`} onClick={() => onPick(o.short)}>
            <span className="cfbr-board-school">
              <i className="cfbr-board-n">{i + 1}</i>
              <img src={cbbLogoDark(t.short)} alt="" onError={e => { if (!e.currentTarget.dataset.f) { e.currentTarget.dataset.f = 1; e.currentTarget.src = cbbLogo(t.short) } }} />
              <b>{t.school}</b>
              {o.stay && <em>NOW</em>}
            </span>
            <span className="is-conf">{confOf[t.conf]?.short ?? ''}</span>
            <span className="is-num">{t.bpiRank ?? '–'}</span>
            <span className="is-num">{t.ap ?? '–'}</span>
            <span className="is-role"><i className={o.starts ? 'is-start' : ''}>{o.starts ? 'STARTER' : compete ? 'COMPETES' : 'BENCH'}</i></span>
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
