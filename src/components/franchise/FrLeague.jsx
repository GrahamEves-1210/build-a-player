import { useMemo, useState } from 'react'
import { Panel, FrTable, FrSheet, Seg, Stepper, Logo } from './frUi'
import { DIVISIONS } from './frTeams'
import { BoxScore } from './FrWeek'

// FRANCHISE: LEAGUE. The standings by division, the GM's schedule, and every week's scores (a played game opens
// its box score when the engine still has it).
// SEAM: the Seg at the top has room for LEADERS, AWARDS, NEWS, TRANSACTIONS, POWER RANKINGS and HISTORY
// (FR.leaders, awardRaces, news, transactions, powerRankings, history).

const TeamCell = ({ t, note = null }) => <span className="fr-t-team"><Logo team={t.short} size={22} />{t.short}{note && <i className="fr-t-clinch">{note}</i>}</span>
const diff = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')

// every division with its four clubs in order (before the engine's standings are in: each club at its record)
export function useDivisions(FR, F) {
  return useMemo(() => {
    let st = null
    try { st = FR.standings(F) } catch {}
    if (st?.divisions?.length) return st.divisions
    const by = Object.fromEntries(FR.teams(F).map(t => [t.short, t]))
    return DIVISIONS.map(d => ({ name: d.div, conf: d.conf, teams: d.teams.map(t => { const r = by[t.short], [w, l, tt] = String(r?.record ?? '0-0').split('-').map(Number); return { team: r ?? t, w: w || 0, l: l || 0, t: tt || 0, pct: w + l ? w / (w + l) : 0, diff: 0, streak: '', div: '', seed: null, clinch: null, user: !!r?.user } }) }))
  }, [FR, F])
}
const STAND_COLS = [
  { k: 'team', label: 'TEAM', render: r => <TeamCell t={r.team} note={r.clinch && r.clinch !== 'e' ? r.clinch.toUpperCase() : null} /> },
  { k: 'w', label: 'W', align: 'r', w: 30, cls: 'fr-t-num', render: r => r.w },
  { k: 'l', label: 'L', align: 'r', w: 30, cls: 'fr-t-num', render: r => r.l },
  { k: 't', label: 'T', align: 'r', w: 26, cls: 'fr-t-dim', render: r => r.t },
  { k: 'pct', label: 'PCT', align: 'r', w: 46, render: r => (r.pct >= 1 ? '1.000' : (Number(r.pct) || 0).toFixed(3).slice(1)) },
  { k: 'diff', label: 'DIFF', align: 'r', w: 46, render: r => diff(r.diff ?? 0) },
  { k: 'div', label: 'DIV', align: 'r', w: 40, cls: 'fr-t-dim', render: r => r.div || '0-0' },
  { k: 'strk', label: 'STRK', align: 'r', w: 44, cls: 'fr-t-dim', render: r => r.streak || '–' },
]
const COMPACT = ['team', 'w', 'l', 'pct', 'diff', 'strk']
// one division's table (compact: the hub's, without the tie and division columns)
export const DivisionTable = ({ division, compact = false }) => (
  <FrTable label={division.name} cols={compact ? STAND_COLS.filter(c => COMPACT.includes(c.k)) : STAND_COLS} rows={division.teams} rowKey={r => r.team.short} rowClass={r => (r.user ? 'is-mine' : null)} />
)
function Standings({ FR, F, conf }) {
  const divisions = useDivisions(FR, F)
  return (
    <div className="fr-cols is-even">
      {divisions.filter(d => d.conf === conf).map(d => <Panel key={d.name} title={d.name}><DivisionTable division={d} /></Panel>)}
    </div>
  )
}

function Schedule({ FR, F, onBox }) {
  const rows = useMemo(() => FR.schedule(F), [FR, F])
  const cols = [
    { k: 'wk', label: 'WK', w: 44, cls: 'fr-t-lab fr-t-dim', render: r => (r.week <= 18 ? r.week : String(r.label).split(' ').map(w => w[0]).join('')) },
    { k: 'opp', label: 'OPPONENT', render: r => (r.bye ? <span className="fr-t-dim fr-t-lab">BYE</span> : <span className="fr-t-team"><small className="fr-t-at">{r.home ? 'vs' : '@'}</small><Logo team={r.opp.short} size={22} />{r.opp.name}</span>) },
    { k: 'res', label: 'RESULT', align: 'r', w: 96, render: r => (r.result ? <><b className={`fr-t-wl${r.result.won ? ' is-w' : ''}`}>{r.result.tied ? 'T' : r.result.won ? 'W' : 'L'}</b> {r.result.us}-{r.result.them}{r.result.ot ? ' OT' : ''}</> : r.bye ? '' : <span className="fr-t-lab fr-t-dim">{r.week === F.week && F.phase !== 'offseason' ? 'THIS WEEK' : ''}</span>) },
  ]
  return <FrTable label="Schedule" cols={cols} rows={rows} rowKey={r => r.week} rowClass={r => (r.week === F.week && F.phase !== 'offseason' ? 'is-mine' : null)} onRow={r => { if (r.result && r.gameId) onBox(r.gameId) }} />
}

function Scores({ FR, F, onBox }) {
  const last = F.sched?.weeks?.length ?? 18
  const [week, setWeek] = useState(() => Math.min(last, Math.max(1, F.phase === 'offseason' ? last : F.week)))
  const games = useMemo(() => FR.weekGames(F, week), [FR, F, week])
  const label = week <= 18 ? `WEEK ${week}` : String(FR.PLAYOFF_ROUNDS?.find(r => r.week === week)?.name ?? `WEEK ${week}`).toUpperCase()
  return (
    <>
      <Stepper label={label} onPrev={week > 1 ? () => setWeek(week - 1) : null} onNext={week < last ? () => setWeek(week + 1) : null} prevLabel="Previous week" nextLabel="Next week" />
      {!games.length && <div className="fr-empty">NO GAMES</div>}
      <div className="fr-scores">
        {games.map(g => {
          const Tag = g.played ? 'button' : 'div'
          return (
            <Tag key={g.id} className={`fr-score${g.user ? ' is-mine' : ''}`} onClick={g.played ? () => onBox(g.id) : undefined}>
              {[[g.away, g.as, g.played && g.as > g.hs], [g.home, g.hs, g.played && g.hs > g.as]].map(([t, pts, won]) => (
                <span key={t.short} className={`fr-score-row${g.played && !won ? ' is-lost' : ''}`}><Logo team={t.short} size={22} /><b>{t.short}</b><em>{g.played ? pts : ''}</em></span>
              ))}
              {g.played && <span className="fr-score-tag">FINAL{g.ot ? ' · OT' : ''}</span>}
            </Tag>
          )
        })}
      </div>
    </>
  )
}

export default function FrLeague({ FR, F }) {
  const [view, setView] = useState('standings')
  const [box, setBox] = useState(null)
  const [conf, setConf] = useState(() => FR.teamRef(F.team)?.conf ?? 'AFC')
  const bs = useMemo(() => { if (!box) return null; try { return FR.boxScore(F, box) } catch { return null } }, [FR, F, box])
  return (
    <div className="fr-page">
      <Panel title="League" meta={`${F.year} SEASON`} className="fr-panel--seg">
        <Seg label="League" options={[['standings', 'STANDINGS'], ['schedule', 'SCHEDULE'], ['scores', 'SCORES']]} value={view} onChange={setView} />
        {view === 'standings' && <Seg label="Conference" options={['AFC', 'NFC']} value={conf} onChange={setConf} />}
        {view === 'schedule' && <Schedule FR={FR} F={F} onBox={setBox} />}
        {view === 'scores' && <Scores FR={FR} F={F} onBox={setBox} />}
      </Panel>
      {view === 'standings' && <Standings FR={FR} F={F} conf={conf} />}
      <FrSheet open={!!bs} onClose={() => setBox(null)} label="Box score"
        head={bs && <span className="fr-sheet-who"><b>{bs.away.team.short} {bs.away.score} · {bs.home.team.short} {bs.home.score}</b><small>{bs.week <= 18 ? `WEEK ${bs.week}` : 'PLAYOFFS'} · FINAL{bs.ot ? ' · OT' : ''}</small></span>}>
        {bs && <BoxScore FR={FR} box={bs} />}
      </FrSheet>
    </div>
  )
}
