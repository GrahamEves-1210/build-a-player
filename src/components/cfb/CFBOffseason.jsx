import { useEffect, useRef, useState } from 'react'
import { valToGrade } from '../../utils/simulation'
import { gradeColor } from '../RatingsTable'
import { IconClose } from '../app/icons'
import { sfx } from '../../lib/juice'
import { CFB_POS } from './cfbShared'
import { CLASS_NAME, POINT_MARKS } from './cfbClass'
import { CommitBar } from './CFBOffers'

// ── THE OFFSEASON: a college season's upgrade points, spent on his traits before the next one ──
// One screen between two seasons, for the one-off mode (CFBMode.jsx) and Career's Start in College
// (CareerCollege.jsx): what the season earned (cfbClass upgradePoints: 1 to 3), his traits as Career shows them
// (the same rows, tapped to raise), and the button that starts the next season.
// The rules are Career's own (lib/career.js, loaded when this opens): a point is one grade on a trait, A+ to S
// costs two, nothing goes past S, Size moves twice at most and Speed three times (UPGRADE_CAP).
// career: the player as Career's rules read him ({ sport: 'nfl', pos, types, build, age, dev: { points } … }: a
// real career, or the one-off mode's stand-in); onCareer(next): after a point is spent.
// shown(t): the grade a trait reads at on this screen (Career's college build is his NFL build plus the college
// boost); ovr / ovrWas: his college overall now and when the season ended
const nick = name => { const w = (name || '').split(' '); return w.length > 2 && /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(w[w.length - 1]) ? w.slice(-2).join(' ') : w[w.length - 1] }

export default function CFBOffseason({ career: c, onCareer, who, pos, school, cls, nextCls, earned, attr, shown = null, ovr, ovrWas = null, cta, onGo, onClose, onReset = null }) {
  const [M, setM] = useState(null)   // lib/career.js: the upgrade rules
  const [why, setWhy] = useState(null)
  const whyT = useRef(0)
  useEffect(() => { let live = true; import('../../lib/career').then(m => { if (live) setM(m) }); return () => { live = false; clearTimeout(whyT.current) } }, [])
  const pts = c.dev?.points ?? 0
  const val = t => shown?.(t) ?? c.build[t]?.val ?? 0
  const tell = text => { clearTimeout(whyT.current); setWhy({ text, k: Date.now() }); whyT.current = setTimeout(() => setWhy(null), 3200); sfx('tap') }
  const tap = t => {
    if (!M) return
    if (M.canUpgrade(c, t)) { onCareer(M.spendDev(c, t)); setWhy(null); sfx('claim'); return }
    tell(pts <= 0 ? 'No upgrade points left.' : M.upgradeBlock(c, t) ?? 'That trait can’t go up right now.')
  }
  const rule = [[3, 'National honors: the Heisman ceremony, All-America, a national award or conference Player of the Year'], [2, `${POINT_MARKS[pos].charAt(0).toUpperCase() + POINT_MARKS[pos].slice(1)}, ten wins, a conference title or the Playoff`], [1, 'Any other season']]
  return (
    <div className="ag-screen cfb-screen cfbr cfbu">
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">{who.toUpperCase()} · {CFB_POS[pos].label} · {String(school ?? '').toUpperCase()}</span><h1 className="ag-h1">Offseason</h1></div>
        <button className="ag-round-btn" onClick={onClose} aria-label="Back"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <section className="cfbr-card cfbu-card">
          <div className="cfbr-who"><small>{CLASS_NAME[cls].toUpperCase()} SEASON · {String(earned.why).toUpperCase()}</small><b>+{earned.pts} {earned.pts === 1 ? 'Upgrade Point' : 'Upgrade Points'}</b></div>
          <div className="cfbr-rank">
            <span><b>{pts}</b><small>{pts === 1 ? 'POINT' : 'POINTS'} TO SPEND</small></span>
            <span><b>{ovr}{ovrWas != null && ovr !== ovrWas ? <i className="cfbu-up"> +{ovr - ovrWas}</i> : null}</b><small>OVR</small></span>
            <span><b>{CLASS_NAME[nextCls]}</b><small>NEXT SEASON</small></span>
          </div>
        </section>
        <section>
          <h2 className="cfb-label">TRAITS</h2>
          <div className="cr-traits cfbu-traits">
            {c.types.filter(t => c.build[t]).map(t => {
              const ch = c.build[t]
              const maxed = !!M && M.maxedTrait(ch.val, ch, t)
              const can = !!M && M.canUpgrade(c, t)
              const cost = M ? M.upgradeCost(ch.val, c, t) : 1
              return (
                <button type="button" key={t} className={`cr-trait${can ? ' can-up' : ''}`} onClick={() => tap(t)} aria-label={`${attr?.[t]?.label ?? t}, ${valToGrade(val(t))}${can ? ', raise it' : ''}`}>
                  <span className="cr-trait-av">{ch.photo ? <img src={ch.photo} alt="" /> : null}</span>
                  <span className="cr-trait-txt"><b>{(attr?.[t]?.label ?? t).replace('/', '/​')}</b><small>{nick(ch.qbFull) || '—'}{ch.upgraded ? ` +${ch.upgraded}` : ''}</small>{maxed ? <em className="cr-trait-max">MAXED</em> : null}</span>
                  <span className="cr-trait-g" style={{ background: gradeColor(val(t)) }}>{valToGrade(val(t))}{can && cost > 1 ? ` · ${cost} PTS` : ''}</span>
                </button>
              )
            })}
          </div>
          {why ? <p key={why.k} className="cr-why" role="status">{why.text}</p>
            : <p className="cfbs-note">{pts > 0 ? 'Tap a trait to raise it a grade. A+ to S costs 2 points.' : 'Every point is spent.'}{pts > 0 ? ' Points he keeps carry to next offseason.' : ''}</p>}
          {onReset && <button type="button" className="cfbs-btn cfbu-reset" onClick={() => { sfx('tap'); setWhy(null); onReset() }}>UNDO THIS OFFSEASON'S UPGRADES</button>}
        </section>
        <section>
          <h2 className="cfb-label">HOW POINTS ARE EARNED</h2>
          <table className="cfbd-table cfbu-rule">
            <tbody>{rule.map(([n, text]) => <tr key={n} className={earned.pts === n ? 'is-on' : undefined}><td className="is-g">{n}</td><td>{text}</td></tr>)}</tbody>
          </table>
        </section>
        <CommitBar label={cta} on onGo={onGo} />
      </div>
    </div>
  )
}
