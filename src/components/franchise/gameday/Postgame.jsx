import { useState } from 'react'
import Scorebug from './Scorebug'
import { Face, barOf } from './parts'

// After the final whistle: the final, the player of the game, the team totals, the box score for both teams (the
// user's built players marked), what the game was worth in XP, who got hurt, and every other final of the week.
// r: bridge.js's result (see its notes); every number here is the engine's.
const TABLES = [
  ['passing', 'PASSING', ['C/ATT', 'YDS', 'TD', 'INT']],
  ['rushing', 'RUSHING', ['CAR', 'YDS', 'TD']],
  ['receiving', 'RECEIVING', ['REC', 'YDS', 'TD']],
  ['defense', 'DEFENSE', ['TKL', 'SACK', 'INT', 'FF']],
  ['kicking', 'KICKING', ['FG', 'LONG', 'XP']],
]
const Name = ({ man }) => <span className={man.built ? 'frgd-built' : undefined}>{man.name}{man.pos && <small>{man.pos}</small>}</span>

function Box({ box }) {
  const any = TABLES.some(([k]) => box?.[k]?.length)
  if (!any) return <div className="frgd-none">No box score</div>
  return TABLES.map(([k, label, cols]) => !box[k]?.length ? null : (
    <table className="frgd-tbl" key={k}>
      <thead><tr><th>{label}</th>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>{box[k].map((row, i) => <tr key={row.man.id ?? i}><td><Name man={row.man} /></td>{cols.map((c, j) => <td key={c}>{row.cells[j] ?? '-'}</td>)}</tr>)}</tbody>
    </table>
  ))
}

export default function Postgame({ r, records = null }) {
  const opp = r.user === r.home ? r.away : r.home
  const [tab, setTab] = useState(r.user)
  const g = { home: r.home, away: r.away, score: r.score, ot: r.ot }
  const anyBuilt = Object.values(r.box?.[r.user] ?? {}).some(rows => rows.some(x => x.man.built))
  return (
    <>
      <Scorebug g={g} final title={!!r.title} records={records} />
      <div className="frgd-body">
        <div className="frgd-wrap frgd-cols">
          <div>
            {r.potg && (
              <section className="frgd-sec">
                <div className="frgd-h"><span>PLAYER OF THE GAME</span></div>
                <div className="frgd-potg">
                  <Face man={r.potg.man} size={64} />
                  <div>
                    <strong className={r.potg.man.built ? 'frgd-built' : undefined}>{r.potg.man.name}</strong>
                    <span>{[r.potg.man.pos, r.potg.man.team].filter(Boolean).join(' · ')}</span>
                    <em>{r.potg.line}</em>
                  </div>
                </div>
              </section>
            )}
            {r.quarters && (
              <section className="frgd-sec">
                <table className="frgd-tbl frgd-tbl--line">
                  <thead><tr><th>BY QUARTER</th>{r.quarters[r.away].map((_, i) => <th key={i}>{i > 3 ? 'OT' : i + 1}</th>)}<th>T</th></tr></thead>
                  <tbody>{[r.away, r.home].map(t => <tr key={t}><td>{t}</td>{r.quarters[t].map((n, i) => <td key={i}>{n}</td>)}<td><b>{r.score[t]}</b></td></tr>)}</tbody>
                </table>
              </section>
            )}
            {!!r.totals?.length && (
              <section className="frgd-sec">
                <div className="frgd-h"><i>{r.away}</i><span>TEAM STATS</span><i>{r.home}</i></div>
                {r.totals.map(t => <div className="frgd-tot" key={t.label}><b>{t[r.away]}</b><span>{t.label}</span><b>{t[r.home]}</b></div>)}
              </section>
            )}
            <section className="frgd-sec">
              <div className="frgd-h"><span>BOX SCORE</span></div>
              <div className="frgd-tabs" role="tablist">
                {[r.user, opp].map(t => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} style={{ '--bar': barOf(t).color }} onClick={() => setTab(t)}>{t}</button>)}
              </div>
              <Box box={r.box?.[tab]} />
              {anyBuilt && tab === r.user && <div className="frgd-key"><span className="frgd-built" />BUILT PLAYER</div>}
            </section>
          </div>
          <div>
            {!!r.xp?.length && (
              <section className="frgd-sec">
                <div className="frgd-h"><span>DEVELOPMENT</span>{r.xpTeam != null && <i>+{r.xpTeam.toLocaleString('en-US')} XP</i>}</div>
                {r.xp.map((x, i) => <div className="frgd-xp" key={x.man.id ?? i}><b><Name man={x.man} /></b><em>+{x.xp}<small>XP</small>{x.pts > 0 && <small>· {x.pts} {x.pts === 1 ? 'POINT' : 'POINTS'}</small>}</em></div>)}
              </section>
            )}
            <section className="frgd-sec">
              <div className="frgd-h"><span>INJURIES</span></div>
              {r.injuries?.length ? r.injuries.map((x, i) => (
                <div className="frgd-row" key={x.man.id ?? i}><span>{x.man.pos}</span><b>{x.man.name}<small>{x.what}</small></b><em className="is-out">{x.weeks ? `${x.weeks} ${x.weeks === 1 ? 'WEEK' : 'WEEKS'}` : x.status ?? 'DAY TO DAY'}</em></div>
              )) : <div className="frgd-none">None reported</div>}
            </section>
            {!!r.league?.length && (
              <section className="frgd-sec">
                <div className="frgd-h"><span>AROUND THE LEAGUE</span></div>
                <div className="frgd-lg">
                  {r.league.map(x => (
                    <div key={`${x.away}-${x.home}`}>
                      <span className={x.a > x.h ? 'is-w' : ''}>{x.away}</span><span className={x.a > x.h ? 'is-w' : ''}>{x.a}</span>
                      <span>{x.ot ? 'OT' : ''}</span>
                      <span className={x.h > x.a ? 'is-w' : ''}>{x.h}</span><span className={x.h > x.a ? 'is-w' : ''}>{x.home}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {!!r.headlines?.length && (
              <section className="frgd-sec">
                <div className="frgd-h"><span>HEADLINES</span></div>
                {r.headlines.map((h, i) => <div className="frgd-line" key={i}>{h}</div>)}
              </section>
            )}
          </div>
        </div>
        <div className="frgd-end" />
      </div>
    </>
  )
}
