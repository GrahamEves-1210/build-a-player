import { useEffect, useMemo, useState } from 'react'
import { Panel, FrTable, FrSheet, Seg, Stepper, Logo, useWide } from './frUi'
import { DIVISIONS } from './frTeams'
import { BoxScore } from './FrWeek'
import { Sub, Bar, TeamCell, NewsRow, up, shortName, safe } from './frBits'
import { PlayerSheet } from './FrPlayer'
import FrClubs, { ClubSheet } from './FrClubs'
import FrMarket from './FrMarket'

// FRANCHISE: LEAGUE. Six views behind one slim row, each with its own second row where it has more than one page:
//   STANDINGS   AFC · NFC (by division) · PLAYOFFS (the seeds, who is in the hunt, the bracket once it is set) ·
//               POWER (the rankings, each club with its state)
//   GAMES       SCORES (any week; a played game opens its box score) · SCHEDULE (the GM's own)
//   STATS       LEADERS (by category) · AWARDS (the seven races)
//   TEAMS       all 32 with their state; a club opens its page (FrClubs.jsx)
//   MARKET      OFFERS · BLOCK · BUILD A TRADE · FREE AGENTS (FrMarket.jsx)
//   NEWS        NEWS · MOVES (transactions) · INJURIES (the league's report)
// `jump` ({ view, sub, team, want }) lands on a view (the hub's ALL NEWS, a player's BUILD A TRADE).

const diff = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')
const pctText = p => (p >= 1 ? '1.000' : (Number(p) || 0).toFixed(3).slice(1))

// every division with its four clubs in order (before the engine's standings are in: each club at its record)
export function useDivisions(FR, F) {
  return useMemo(() => {
    const st = safe(() => FR.standings(F))
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
  { k: 'pct', label: 'PCT', align: 'r', w: 46, render: r => pctText(r.pct) },
  { k: 'diff', label: 'DIFF', align: 'r', w: 46, render: r => diff(r.diff ?? 0) },
  { k: 'div', label: 'DIV', align: 'r', w: 40, cls: 'fr-t-dim', render: r => r.div || '0-0' },
  { k: 'strk', label: 'STRK', align: 'r', w: 44, cls: 'fr-t-dim', render: r => r.streak || '–' },
]
const COMPACT = ['team', 'w', 'l', 'pct', 'diff', 'strk']
// one division's table (compact: the hub's, without the tie and division columns)
export const DivisionTable = ({ division, compact = false, onRow = null }) => (
  <FrTable label={division.name} cols={compact ? STAND_COLS.filter(c => COMPACT.includes(c.k)) : STAND_COLS} rows={division.teams} rowKey={r => r.team.short} rowClass={r => (r.user ? 'is-mine' : null)} onRow={onRow} />
)
function Standings({ FR, F, conf, onClub }) {
  const divisions = useDivisions(FR, F)
  return (
    <div className="fr-cols is-even">
      {divisions.filter(d => d.conf === conf).map(d => <Panel key={d.name} title={d.name}><DivisionTable division={d} onRow={r => onClub(r.team.short)} /></Panel>)}
    </div>
  )
}

// the seven seeds, the clubs chasing them, and the bracket once the field is set
const CLINCH = { x: 'CLINCHED A PLAYOFF SPOT', y: 'CLINCHED THE DIVISION', z: 'CLINCHED THE FIRST SEED', e: 'ELIMINATED' }
function Picture({ FR, F, onClub, onBox }) {
  const pic = useMemo(() => safe(() => FR.playoffPicture(F)), [FR, F])
  if (!pic) return <Panel><div className="fr-empty">NO PLAYOFF PICTURE YET</div></Panel>
  const cols = [
    { k: 'seed', label: 'SEED', w: 46, cls: 'fr-t-rk', render: r => r.seed ?? '' },
    { k: 'team', label: 'TEAM', render: r => <TeamCell t={r.team} note={r.clinch && r.clinch !== 'e' ? r.clinch.toUpperCase() : null} /> },
    { k: 'rec', label: 'W-L', align: 'r', w: 56, cls: 'fr-t-num', render: r => `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}` },
    { k: 'conf', label: 'CONF', align: 'r', w: 50, cls: 'fr-t-dim', render: r => r.conf || '0-0' },
    { k: 'strk', label: 'STRK', align: 'r', w: 48, cls: 'fr-t-dim', render: r => r.streak || '–' },
  ]
  const rounds = pic.bracket?.rounds?.filter(r => r.games?.length) ?? []
  const marks = [...new Set(['AFC', 'NFC'].flatMap(c => pic[c]?.seeds ?? []).map(r => r.clinch).filter(k => k && k !== 'e'))]
  return (
    <>
      {pic.bracket?.champion && <Panel title="Champions"><div className="fr-row fr-vs"><Logo team={pic.bracket.champion.short} size={30} /><span className="fr-row-main fr-t-gold">{up(pic.bracket.champion.name)}<small>{F.year} SUPER BOWL CHAMPIONS</small></span></div></Panel>}
      {rounds.length > 0 && (
        <Panel title="The bracket">
          {rounds.map(r => (
            <div key={r.id}>
              <Sub>{up(r.name)}</Sub>
              {r.games.map(g => {
                const Tag = g.played ? 'button' : 'div'
                return (
                  <Tag key={g.id} className="fr-row" onClick={g.played ? () => onBox(g.id) : undefined}>
                    <span className="fr-row-main"><span className="fr-t-team"><Logo team={g.away.short} size={22} />{g.seeds?.[1] ? `${g.seeds[1]} ` : ''}{g.away.short}<small className="fr-t-at">@</small><Logo team={g.home.short} size={22} />{g.seeds?.[0] ? `${g.seeds[0]} ` : ''}{g.home.short}</span></span>
                    <b className="fr-t-num">{g.played ? `${g.as}-${g.hs}` : ''}</b>
                  </Tag>
                )
              })}
            </div>
          ))}
        </Panel>
      )}
      <div className="fr-cols is-even">
        {['AFC', 'NFC'].map(c => (
          <Panel key={c} title={`${c} playoff picture`} meta={pic.bracket ? 'THE FIELD' : 'IF THE SEASON ENDED TODAY'}>
            <FrTable label={`${c} seeds`} cols={cols} rows={pic[c]?.seeds ?? []} rowKey={r => r.team.short} rowClass={r => (r.user ? 'is-mine' : null)} onRow={r => onClub(r.team.short)} />
            {pic[c]?.hunt?.length > 0 && <>
              <Sub>{pic.bracket ? 'MISSED THE PLAYOFFS' : 'IN THE HUNT'}</Sub>
              <FrTable className="fr-table--nohead" label={`${c} in the hunt`} cols={cols.map(x => (x.k === 'seed' ? { ...x, label: '' } : x))} rows={pic[c].hunt.map(r => ({ ...r, seed: null }))} rowKey={r => r.team.short} rowClass={r => (r.user ? 'is-mine' : null)} onRow={r => onClub(r.team.short)} />
            </>}
          </Panel>
        ))}
      </div>
      {marks.length > 0 && <p className="fr-note">{marks.map(k => `${k.toUpperCase()}: ${CLINCH[k]}`).join(' · ')}</p>}
    </>
  )
}

const STATE_SHORT = { contend: 'CONTEND', retool: 'RETOOL', rebuild: 'REBUILD' }
function Power({ FR, F, wide, onClub }) {
  const rows = useMemo(() => safe(() => FR.powerRankings(F), []), [FR, F])
  const cols = [
    { k: 'rk', label: 'RK', w: 36, cls: 'fr-t-rk', render: r => r.rank },
    { k: 'mv', label: '', w: 34, cls: 'fr-t-move', render: r => (r.move > 0 ? <span className="fr-t-move is-up">UP {r.move}</span> : r.move < 0 ? `DN ${-r.move}` : '–') },
    { k: 'team', label: 'TEAM', cls: wide ? '' : 'fr-t-wrap', render: r => (wide ? <TeamCell t={r.team} name /> : <><TeamCell t={r.team} /><span className="fr-t-sub">{r.blurb}</span></>) },
    { k: 'rec', label: 'W-L', align: 'r', w: 50, cls: 'fr-t-num', render: r => r.record },
    { k: 'st', label: 'STATE', align: wide ? undefined : 'r', w: wide ? 120 : 74, cls: 'fr-t-lab fr-t-dim', render: r => (wide ? r.stateLabel : STATE_SHORT[r.state] ?? '') },
    ...(wide ? [{ k: 'blurb', label: '', cls: 'fr-t-dim', render: r => r.blurb }] : []),
  ]
  return <Panel title="Power rankings" meta={F.phase === 'offseason' ? `${F.year}` : `WEEK ${Math.min(F.week, 18)}`}><FrTable className={wide ? '' : 'fr-table--tight fr-table--tall'} label="Power rankings" cols={cols} rows={rows} rowKey={r => r.team.short} rowClass={r => (r.team.short === F.team ? 'is-mine' : null)} onRow={r => onClub(r.team.short)} empty="NO RANKINGS YET" /></Panel>
}

function Schedule({ FR, F, onBox }) {
  const rows = useMemo(() => FR.schedule(F), [FR, F])
  const cols = [
    { k: 'wk', label: 'WK', w: 44, cls: 'fr-t-lab fr-t-dim', render: r => (r.week <= 18 ? r.week : String(r.label).split(' ').map(w => w[0]).join('')) },
    { k: 'opp', label: 'OPPONENT', render: r => (r.bye ? <span className="fr-t-dim fr-t-lab">BYE</span> : <span className="fr-t-team"><small className="fr-t-at">{r.home ? 'vs' : '@'}</small><Logo team={r.opp.short} size={22} />{r.opp.name}</span>) },
    { k: 'res', label: 'RESULT', align: 'r', w: 96, render: r => (r.result ? <><b className={`fr-t-wl${r.result.won ? ' is-w' : ''}`}>{r.result.tied ? 'T' : r.result.won ? 'W' : 'L'}</b> {r.result.us}-{r.result.them}{r.result.ot ? ' OT' : ''}</> : r.bye ? '' : <span className="fr-t-lab fr-t-dim">{r.week === F.week && F.phase !== 'offseason' ? 'THIS WEEK' : ''}</span>) },
  ]
  return <Panel title="Schedule" meta={up(FR.teamRef(F.team)?.nick)}><FrTable label="Schedule" cols={cols} rows={rows} rowKey={r => r.week} rowClass={r => (r.week === F.week && F.phase !== 'offseason' ? 'is-mine' : null)} onRow={r => { if (r.result && r.gameId) onBox(r.gameId) }} /></Panel>
}

function Scores({ FR, F, onBox }) {
  const last = F.sched?.weeks?.length ?? 18
  const [week, setWeek] = useState(() => Math.min(last, Math.max(1, F.phase === 'offseason' ? last : F.week)))
  const games = useMemo(() => FR.weekGames(F, week), [FR, F, week])
  const label = week <= 18 ? `WEEK ${week}` : up(FR.PLAYOFF_ROUNDS?.find(r => r.week === week)?.name ?? `WEEK ${week}`)
  return (
    <Panel>
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
    </Panel>
  )
}

// ── stat leaders: a group at a time, each of its categories a short table ────
const GROUPS = [['pass', 'PASSING', ['passYds', 'passTD', 'rating']], ['rush', 'RUSHING', ['rushYds', 'rushTD', 'scrimmage']], ['rec', 'RECEIVING', ['recYds', 'rec', 'recTD']], ['def', 'DEFENSE', ['sacks', 'tackles', 'ints', 'tfl', 'ff']], ['kick', 'KICKING', ['points', 'fgm']]]
const whoCol = wide => ({ k: 'who', label: 'PLAYER', cls: 'fr-t-name', render: r => <>{wide ? r.player.name : shortName(r.player.name)}{r.player.built && <i>BUILT</i>}</> })
function Leaders({ FR, F, wide, onPlayer }) {
  const all = useMemo(() => safe(() => FR.leaders(F, 10), {}), [FR, F])
  const [grp, setGrp] = useState('pass')
  const cats = GROUPS.find(g => g[0] === grp)[2]
  const any = Object.values(all).some(l => l?.length)
  return (
    <>
      <Panel><Seg className="fr-seg--fit" label="Leaders" options={GROUPS.map(g => [g[0], g[1]])} value={grp} onChange={setGrp} /></Panel>
      {!any && <Panel><div className="fr-empty">NO GAMES PLAYED YET</div></Panel>}
      {any && (
        <div className={`fr-grid2${cats.length >= 3 ? ' is-three' : ''}`}>
          {cats.map(k => (
            <Panel key={k} title={FR.LEADER_LABELS?.[k] ?? k}>
              <FrTable label={FR.LEADER_LABELS?.[k] ?? k} rows={all[k] ?? []} rowKey={r => r.player.id} rowClass={r => (r.player.team === F.team ? 'is-mine' : null)} onRow={r => onPlayer(r.player.id)} empty="NOBODY QUALIFIES YET"
                cols={[{ k: 'rk', label: '', w: 34, cls: 'fr-t-rk', render: r => r.rank }, whoCol(true),
                  { k: 'tm', label: 'TEAM', w: 52, cls: 'fr-t-lab fr-t-dim', render: r => r.player.team },
                  { k: 'v', label: '', align: 'r', w: 62, cls: 'fr-t-num', render: r => r.text }]} />
            </Panel>
          ))}
        </div>
      )}
    </>
  )
}

const AWARDS = [['MVP', 'Most Valuable Player'], ['OPOY', 'Offensive Player of the Year'], ['DPOY', 'Defensive Player of the Year'], ['OROY', 'Offensive Rookie of the Year'], ['DROY', 'Defensive Rookie of the Year'], ['COY', 'Coach of the Year'], ['PROTECTOR', 'Protector of the Year']]
function Awards({ FR, F, onPlayer }) {
  const races = useMemo(() => safe(() => FR.awardRaces(F), {}), [FR, F])
  const any = AWARDS.some(([k]) => races[k]?.length)
  if (!any) return <Panel><div className="fr-empty">THE RACES OPEN ONCE GAMES ARE PLAYED</div></Panel>
  return (
    <div className="fr-grid2">
      {AWARDS.filter(([k]) => races[k]?.length).map(([k, name]) => (
        <Panel key={k} title={name}>
          <FrTable className="fr-table--tall" label={name} rows={races[k]} rowKey={r => r.rank} rowClass={r => (r.team?.short === F.team ? 'is-mine' : null)} onRow={r => { if (r.player) onPlayer(r.player.id) }}
            cols={[{ k: 'rk', label: '', w: 34, cls: 'fr-t-rk', render: r => r.rank },
              { k: 'who', label: k === 'COY' ? 'COACH' : 'PLAYER', cls: 'fr-t-name fr-t-wrap', render: r => <>{(r.player ?? r.coach)?.name}<span className="fr-t-sub">{r.player ? `${r.player.slot} · ` : ''}{r.line}</span></> },
              { k: 'tm', label: 'TEAM', w: 50, cls: 'fr-t-lab fr-t-dim', render: r => r.team?.short },
              { k: 'sh', label: 'RACE', align: 'r', w: 92, render: r => <><Bar v={r.share} max={Math.max(0.01, races[k][0].share)} />{Math.round(r.share * 100)}%</> }]} />
        </Panel>
      ))}
    </div>
  )
}

// ── news, moves, the league's injury report ──────────────────────────────────
const TX = { sign: 'SIGNED', release: 'RELEASED', trade: 'TRADE', draft: 'DRAFT', ir: 'TO IR', activate: 'ACTIVATED', extend: 'EXTENDED', tag: 'TAGGED', retire: 'RETIRED', hire: 'HIRED', fire: 'FIRED' }
function News({ FR, F, sub, wide, onPlayer, onClub }) {
  const news = useMemo(() => (sub === 'news' ? safe(() => FR.news(F, 60), []) : []), [FR, F, sub])
  // (the engine files a trade under both clubs: one line here, marked when the GM's club is in it)
  const tx = useMemo(() => {
    if (sub !== 'moves') return []
    const out = [], seen = new Map()
    for (const r of safe(() => FR.transactions(F, 120), [])) {
      const k = r.type === 'trade' ? `${r.year}|${r.week}|${r.text}` : null, was = k ? seen.get(k) : null
      if (was) { if (r.team?.short === F.team) was.mine = true; continue }
      const row = { ...r, mine: r.team?.short === F.team }
      if (k) seen.set(k, row)
      out.push(row)
    }
    return out.slice(0, 80)
  }, [FR, F, sub])
  const hurt = useMemo(() => (sub === 'injuries' ? FR.teams(F).flatMap(t => safe(() => FR.injuryReport(F, t.short), [])).sort((a, b) => b.ovr - a.ovr).slice(0, 60) : []), [FR, F, sub])
  const when = n => (n.year !== F.year ? `${n.year}` : n.week > 18 ? 'PLAYOFFS' : n.week > 0 ? `WEEK ${n.week}` : 'PRESEASON')
  if (sub === 'news') return (
    <Panel title="News" meta={`${F.year}`}>
      {news.map(n => <NewsRow key={n.id} n={n} tag={when(n)} mine={n.team?.short === F.team} onClick={n.pid != null ? () => onPlayer(n.pid) : n.team ? () => onClub(n.team.short) : null} />)}
      {!news.length && <div className="fr-empty">NO NEWS YET</div>}
    </Panel>
  )
  if (sub === 'moves') return (
    <Panel title="Transactions" meta={`${F.year}`}>
      {tx.map(r => <NewsRow key={r.id} n={{ head: r.text }} tag={TX[r.type] ?? up(r.type)} mine={r.mine} onClick={r.pid != null ? () => onPlayer(r.pid) : null} />)}
      {!tx.length && <div className="fr-empty">NO MOVES YET</div>}
    </Panel>
  )
  return (
    <Panel title="Injury report" meta={FR.settingsOf(F).injuries ? 'THE LEAGUE' : 'INJURIES OFF'}>
      <FrTable className="fr-table--tight fr-table--tall" label="Injury report" rows={hurt} empty="NOBODY ON THE REPORT" rowClass={r => (r.team === F.team ? 'is-mine' : null)} onRow={r => onPlayer(r.id)}
        cols={[{ k: 'pos', label: 'POS', w: 44, cls: 'fr-t-pos', render: r => r.slot },
          { k: 'name', label: 'PLAYER', cls: 'fr-t-name', render: r => <>{wide ? r.name : shortName(r.name)}<span className="fr-t-sub">{r.what}</span></> },
          { k: 'tm', label: 'TEAM', w: 48, cls: 'fr-t-lab fr-t-dim', render: r => r.team },
          { k: 'ovr', label: 'OVR', align: 'r', w: 38, cls: 'fr-t-num', render: r => r.ovr },
          { k: 'st', label: 'STATUS', align: 'r', w: wide ? 120 : 62, cls: 'fr-t-lab', render: r => (r.status === 'QUESTIONABLE' ? 'QUEST.' : r.status) },
          { k: 'wk', label: 'WKS', align: 'r', w: 40, render: r => (r.wk > 0 ? r.wk : '–') }]} />
    </Panel>
  )
}

const VIEWS = [['standings', 'STANDINGS'], ['games', 'GAMES'], ['stats', 'STATS'], ['teams', 'TEAMS'], ['market', 'MARKET'], ['news', 'NEWS']]
const SUBS = {
  standings: [['AFC', 'AFC'], ['NFC', 'NFC'], ['playoffs', 'PLAYOFFS'], ['power', 'POWER']],
  games: [['scores', 'SCORES'], ['schedule', 'SCHEDULE']],
  stats: [['leaders', 'LEADERS'], ['awards', 'AWARDS']],
  news: [['news', 'NEWS'], ['moves', 'MOVES'], ['injuries', 'INJURIES']],
}

export default function FrLeague({ FR, F, act, go, say, jump }) {
  const wide = useWide()
  const [view, setView] = useState(jump?.view ?? 'standings')
  const [subs, setSubs] = useState(() => ({ standings: FR.teamRef(F.team)?.conf ?? 'AFC', games: 'scores', stats: 'leaders', news: 'news' }))
  useEffect(() => { if (jump?.view) setView(jump.view) }, [jump])
  const [box, setBox] = useState(null)
  const [pid, setPid] = useState(null)
  const [club, setClub] = useState(null)
  const bs = useMemo(() => (box ? safe(() => FR.boxScore(F, box)) : null), [FR, F, box])
  const sub = subs[view]
  const p = { FR, F, wide, act, say, go, onPlayer: setPid, onClub: setClub, onBox: setBox }
  return (
    <div className="fr-page">
      <Panel title="League" meta={`${F.year} SEASON`} className="fr-panel--nav">
        <Seg className="fr-seg--fit" label="League" options={VIEWS} value={view} onChange={setView} />
        {SUBS[view] && <Seg className="fr-seg--sub" label={view} options={SUBS[view]} value={sub} onChange={v => setSubs(s => ({ ...s, [view]: v }))} />}
      </Panel>
      {view === 'standings' && (sub === 'playoffs' ? <Picture {...p} /> : sub === 'power' ? <Power {...p} /> : <Standings {...p} conf={sub} />)}
      {view === 'games' && (sub === 'schedule' ? <Schedule {...p} /> : <Scores {...p} />)}
      {view === 'stats' && (sub === 'awards' ? <Awards {...p} /> : <Leaders {...p} />)}
      {view === 'teams' && <FrClubs {...p} />}
      {view === 'market' && <FrMarket {...p} jump={jump?.view === 'market' ? jump : null} />}
      {view === 'news' && <News {...p} sub={sub} />}
      <FrSheet open={!!bs} onClose={() => setBox(null)} label="Box score"
        head={bs && <span className="fr-sheet-who"><b>{bs.away.team.short} {bs.away.score} · {bs.home.team.short} {bs.home.score}</b><small>{bs.week <= 18 ? `WEEK ${bs.week}` : 'PLAYOFFS'} · FINAL{bs.ot ? ' · OT' : ''}</small></span>}>
        {bs && <BoxScore FR={FR} box={bs} />}
      </FrSheet>
      <ClubSheet FR={FR} F={F} short={club} onClose={() => setClub(null)} onPlayer={setPid} go={go} />
      <PlayerSheet FR={FR} F={F} pid={pid} onClose={() => setPid(null)} act={act} say={say} go={(t, to) => { setClub(null); go(t, to) }} />
    </div>
  )
}
