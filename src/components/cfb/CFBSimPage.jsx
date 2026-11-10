import { useEffect, useMemo, useRef, useState } from 'react'
import { PlayoffGame } from '../LiveGame'
import { IconClose } from '../app/icons'
import { NameTag } from '../app/NameTag'
import { SeasonRewards, WeekStrip } from '../app/AppSeason'
import { Wire, Milestones, SeasonStory, useDirectedReveal } from '../app/AppSeasonPlus'
import { ShareSeasonButton } from '../app/SeasonShare'
import { Pulse, ProgressDots, SimLoading, LeadersBoard } from '../simFlow'
import { PlayoffLog, gradeColor, offDefGrade } from '../simParts'
import QBAvatar from '../QBAvatar'
import QBFigureOverlay from '../QBFigureOverlay'
import RBFigureOverlay from '../RBFigureOverlay'
import WRFigureOverlay from '../WRFigureOverlay'
import SiteFooter from '../SiteFooter'
import { valToGrade } from '../../utils/simulation'
import { createDirector, registerDirector } from '../../lib/seasonDirector'
import { useCountUp } from '../../lib/useCountUp'
import { useTapGuard } from '../../lib/tapGuard'
import { userScrolling } from '../../lib/userScroll'
import { useRailOn } from '../../lib/ads'
import { IS_APP } from '../../lib/platform'
import { sfx } from '../../lib/juice'
import { cfbLogo, cfbLogoDark, CFB_POS, pickOf, projText } from './cfbShared'

// ── College Football: the season ────────────────────────────────────────────
// A college season, a page a stage. The flow is football's season page (SimPage.jsx: the dot pager, the team card,
// the big live record, the pinned button, the playoff round strip with live games, the final report); what's on
// each page is college football's own, in the navy broadcast package (cfb.css): the schedule with logos and
// rankings, the AP poll week by week, the key games, his box-score game log, the conference standings, Selection
// Day, the bracket, the Heisman ceremony and the awards, a scouting report for the draft.
//   pre     PRE-SEASON: the OVR, the archetype, SIMULATE SEASON, the figure in school colours, the build
//   reg     REGULAR SEASON: live, week by week (record, pulse, wire, milestones, weeks, the schedule, the AP poll),
//           then his season line, the FBS leaders, the key games and his game log
//   ccg     CONFERENCE CHAMPIONSHIP: his title game live; the conference's game is only a result when he's not in
//           it (nobody watches someone else's title game). No page for the Independents: they play none
//   sel     SELECTION DAY: where he landed, the 12-team field, the committee's final top 25
//   post    THE PLAYOFF or THE BOWL: the round strip, each of his games live, the end of the road, the bracket
//   awards  THE HEISMAN: the ceremony (the finalists, the ballots counted, the winner), then the season's awards
//   draft   DRAFT STOCK: a scouting report (the projection in rounds and picks, the round track, his rank at the
//           position and on the big board, what scouts like and question, the position's board)
//   final   FINAL REPORT: rewards, story, the result, share, his season line, the postseason, the AP poll through
//           the final one, his full game log, the honors, the build, and what's next
// The player is the username (or Guest), never "you". Reduce Motion: no live reveal, no live games, no count.
// (reads runCFBSimulation's result, utils/cfbSimulation.js: football's keys plus result.cfb. view() gathers it)

const reduced = () => document.documentElement.classList.contains('bap-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const n = v => (v == null || Number.isNaN(+v) ? '–' : Math.round(+v).toLocaleString())
const f1 = v => (v == null || Number.isNaN(+v) ? '–' : (+v).toFixed(1))
const ordinal = k => `${k}${(k % 100 > 10 && k % 100 < 14) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[k % 10] ?? 'th'}`
const POS_AWARD = { qb: 'daveyOBrien', wr: 'biletnikoff', rb: 'doakWalker' }
const POS_GROUP = { qb: 'QUARTERBACKS', rb: 'RUNNING BACKS', wr: 'WIDE RECEIVERS' }

// The regular season plays out on football's season director (lib/seasonDirector.js), the season exactly as
// simulated (locked: the polls, the Playoff and the awards come from these games). College's own: no NFL record
// chase, no "clinched a playoff berth" (six wins is a bowl, the committee picks the twelve), the nickname in the headlines
const CFB_COUNTS = {
  qb: { seasonPassYds: 'passYds', seasonTDs: 'tds', seasonINTs: 'ints', seasonRushYds: 'rushYds', seasonRushTDs: 'rushTDs', seasonSacks: 'sacks' },
  rb: { seasonRushYds: 'rushYds', seasonRushTDs: 'rushTDs', seasonCarries: 'carries', seasonRecYds: 'recYds', seasonRecTDs: 'recTDs', seasonRecs: 'recs', seasonFumbles: 'fumbles' },
  wr: { seasonRecs: 'rec', seasonRecYds: 'recYds', seasonRecTDs: 'recTDs', seasonTargets: 'targets' },
}
registerDirector('cfb', { counts: CFB_COUNTS, lines: { clinch: 99, out: -99 }, nick: t => t?.mascot ?? t?.school ?? t?.name, totals: () => {} })
const weekNo = label => (/^pre/i.test(label) ? 0 : /^final/i.test(label) ? 99 : Number(String(label).replace(/\D+/g, '')) || 0)
const pollShort = label => (/^pre/i.test(label) ? 'PRE' : /^final/i.test(label) ? 'FINAL' : `W${weekNo(label)}`)
const isCfp = g => !!g.round && g.round !== 'Bowl' && g.round !== 'Conference Championship'
const yardsOf = (g, pos) => (pos === 'qb' ? (g.passYds ?? 0) + (g.rushYds ?? 0) : pos === 'rb' ? (g.rushYds ?? 0) + (g.recYds ?? 0) : (g.recYds ?? 0))

// the result, in the shape these pages draw
function view(r, teams) {
  const c = r.cfb ?? {}
  const team = r.team ?? {}
  const T = short => teams[short] ?? { short, name: short, school: short }
  const school = short => T(short).school ?? T(short).name ?? short
  const conf = c.conf ?? null
  const reg = (r.games ?? []).map(g => ({ ...g, post: false }))
  const post = (c.postseason ?? []).map(g => ({ ...g, post: true }))
  const ccg = post.find(g => g.round === 'Conference Championship') ?? null
  const after = post.filter(g => g !== ccg)
  const ranks = (c.apPath ?? []).map(p => ({ label: p.label, ap: p.rank ?? null, rec: p.rec }))
  const finalRank = ranks.length ? ranks[ranks.length - 1].ap : null
  const cfpGames = after.filter(isCfp)
  const lastCfp = cfpGames[cfpGames.length - 1]
  const champs = !!r.champion
  const rec = gs => `${gs.filter(g => g.won).length}-${gs.filter(g => !g.won).length}`
  // the season's one line: the banner on the final report
  const headline = champs ? 'National Champions'
    : c.cfpSeed ? (lastCfp?.round === 'National Championship' ? 'Lost the National Championship' : `Eliminated — CFP ${lastCfp?.round ?? 'First Round'}`)
    : c.bowl ? `${c.bowl.won ? 'Won' : 'Lost'} the ${c.bowl.bowl ?? c.bowl.label}`
    : 'No Bowl'
  return { c, team, T, school, conf, reg, post, ccg, after, ranks, finalRank, champs, headline, rec, record: c.record?.final ?? `${r.wins}-${r.losses}` }
}

// a section's header: the NCAA blue label block and a hairline (the broadcast package)
const Hd = ({ children, sub }) => (
  <div className="cfbs-hd"><h2>{children}</h2>{sub && <small>{sub}</small>}<i aria-hidden="true" /></div>
)
// on the navy: ESPN's dark-background logo; on a white plate: the regular one
const Logo = ({ short, size = 28, light = false }) => (
  <img className="cfbs-logo" src={light ? cfbLogo(short) : cfbLogoDark(short)} alt="" width={size} height={size} loading="lazy" draggable={false}
    onError={e => { if (!light && !e.currentTarget.dataset.f) { e.currentTarget.dataset.f = 1; e.currentTarget.src = cfbLogo(short) } else e.currentTarget.style.visibility = 'hidden' }} />
)

const gameLine = (g, pos) => {
  if (pos === 'qb' && g.att === 0 && !g.rushAtt) return 'Did not play'
  if (pos === 'wr' && g.targets === 0) return 'No targets'
  if (pos === 'qb') return g.att != null ? `${g.comp}/${g.att}, ${n(g.passYds)} yds, ${g.tds ?? 0} TD${g.ints ? `, ${g.ints} INT` : ''}${g.rushTDs ? ` · ${g.rushTDs} rush TD` : ''}` : ''
  if (pos === 'rb') return g.carries != null ? `${g.carries} car, ${n(g.rushYds)} yds, ${(g.rushTDs ?? 0) + (g.recTDs ?? 0)} TD${g.recYds ? ` · ${n(g.recYds)} rec yds` : ''}` : ''
  return g.rec != null ? `${g.rec} rec, ${n(g.recYds)} yds${g.recTDs ? `, ${g.recTDs} TD` : ''}` : ''
}
// a postseason game's name: the title game, the CFP round (and its bowl), the bowl
const roundName = (g, v) => (g.round === 'Conference Championship' ? (g.title ?? `${v.conf?.short ?? 'Conference'} Championship`)
  : g.round === 'National Championship' ? 'CFP National Championship'
  : isCfp(g) ? `CFP ${g.round}${g.bowl ? ` · ${g.bowl}` : ''}`
  : (g.bowl ?? g.label ?? 'Bowl'))
const postLabel = g => (g.round === 'Conference Championship' ? (g.title ?? 'CONF TITLE') : g.round === 'National Championship' ? 'NATL TITLE' : g.bowl ?? g.label ?? g.round).toUpperCase()
// his postseason as football's playoff log takes it (NCAA passer rating in the rating spot, as the box score shows it)
const logRows = (games, v) => games.map(g => ({ ...g, round: roundName(g, v), opponent: v.school(g.oppShort), home: !!g.home || !!g.neutral, overtime: !!g.ot, rating: g.eff ?? g.rating }))

// ── the AP poll: one line through the season, then where he stood week by week ──
function RankPath({ ranks }) {
  if (!ranks.length) return null
  const W = 320, H = 98, top = 10, floor = 76
  const y = rk => (rk == null ? floor + 14 : top + ((rk - 1) / 24) * (floor - top))
  const x = i => 16 + (i * (W - 30)) / Math.max(1, ranks.length - 1)
  const pts = ranks.map((p, i) => [x(i), y(p.ap)])
  const best = ranks.reduce((b, p) => (p.ap != null && (b == null || p.ap < b) ? p.ap : b), null)
  const bestAt = ranks.findIndex(p => p.ap === best)
  const showVal = i => i === 0 || i === pts.length - 1 || i === bestAt
  return (
    <div className="cfbs-rank">
      <svg viewBox={`0 0 ${W} ${H + 14}`} role="img" aria-label={`AP poll: ${ranks.map(r => `${r.label} ${r.ap ? `No. ${r.ap}` : 'unranked'}`).join(', ')}`}>
        {[1, 10, 25].map(rk => (
          <g key={rk}><line x1="16" x2={W - 14} y1={y(rk)} y2={y(rk)} className="cfbs-rank-grid" /><text x="2" y={y(rk) + 3} className="cfbs-rank-axis">{rk}</text></g>
        ))}
        <line x1="16" x2={W - 14} y1={floor + 14} y2={floor + 14} className="cfbs-rank-grid is-nr" />
        <text x="2" y={floor + 17} className="cfbs-rank-axis">NR</text>
        {pts.length > 1 && <polyline points={pts.map(p => p.join(',')).join(' ')} className="cfbs-rank-line" />}
        {pts.map(([px, py], i) => (
          <g key={i}>
            <circle cx={px} cy={py} r={i === pts.length - 1 ? 4 : 2.6} className={`cfbs-rank-dot${ranks[i].ap == null ? ' is-nr' : ''}${i === pts.length - 1 ? ' is-last' : ''}`} />
            {showVal(i) && <text x={px} y={py - 7} className="cfbs-rank-val">{ranks[i].ap ?? 'NR'}</text>}
            {(i === 0 || i === pts.length - 1 || i % 3 === 0) && <text x={px} y={H + 10} className="cfbs-rank-wk">{pollShort(ranks[i].label)}</text>}
          </g>
        ))}
      </svg>
    </div>
  )
}
function RankMoves({ ranks }) {
  return (
    <ol className="cfbs-moves" aria-label="AP poll by week">
      {ranks.map((p, i) => {
        const prev = i ? ranks[i - 1].ap : null
        const d = p.ap != null && prev != null ? prev - p.ap : p.ap != null && i && prev == null ? 'in' : p.ap == null && prev != null ? 'out' : 0
        return (
          <li key={p.label} className={typeof d === 'number' ? (d > 0 ? 'is-up' : d < 0 ? 'is-down' : '') : d === 'in' ? 'is-up' : d === 'out' ? 'is-down' : ''}>
            <small>{pollShort(p.label)}</small>
            <b>{p.ap ?? 'NR'}</b>
            <em>{d === 'in' ? 'IN' : d === 'out' ? 'OUT' : d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : '–'}</em>
            <i>{p.rec}</i>
          </li>
        )
      })}
    </ol>
  )
}
function Poll({ ranks, final = false }) {
  const now = ranks[ranks.length - 1]?.ap ?? null
  return (
    <section className="cfbp-sec">
      <Hd sub={now ? `${final ? 'FINAL · ' : ''}NO. ${now}` : final ? 'FINAL · UNRANKED' : 'UNRANKED'}>AP TOP 25</Hd>
      <RankPath ranks={ranks} />
      <RankMoves ranks={ranks} />
    </section>
  )
}

// ── his season, as the graphic puts it up: five numbers ──
function statLine(t, pos) {
  if (!t) return []
  if (pos === 'qb') return [['PASS YDS', n(t.seasonPassYds)], ['TD', n(t.seasonTDs)], ['INT', n(t.seasonINTs)], ['CMP%', f1(t.seasonCompPct)], ['RUSH YDS', n(t.seasonRushYds)]]
  if (pos === 'rb') return [['RUSH YDS', n(t.seasonRushYds)], ['TD', n((t.seasonRushTDs ?? 0) + (t.seasonRecTDs ?? 0))], ['YPC', f1(t.seasonYPC)], ['REC', n(t.seasonRecs)], ['REC YDS', n(t.seasonRecYds)]]
  return [['REC', n(t.seasonRecs)], ['YDS', n(t.seasonRecYds)], ['TD', n(t.seasonRecTDs)], ['YPR', f1(t.seasonYPR)], ['LONG', n(t.seasonLong)]]
}
function SeasonLine({ totals, pos, sub }) {
  const line = statLine(totals, pos)
  return (
    <section className="cfbp-sec">
      <Hd sub={sub}>SEASON LINE</Hd>
      <div className="cfbs-stats" style={{ '--n': line.length }}>
        {line.map(([k, val]) => <div key={k}><b>{val}</b><small>{k}</small></div>)}
      </div>
    </section>
  )
}

// ── the schedule: a row a game, the school's logo, its ranking at kickoff, the score, his line ──
function GameRow({ g, v, pos }) {
  return (
    <li className={`cfbs-game${g.won ? ' is-w' : ' is-l'}${g.post ? ' is-post' : ''}`}>
      <span className="cfbs-game-wk">{g.post ? postLabel(g) : <>WK {weekNo(g.meta?.label ?? g.wk)}<small>{g.meta?.date}</small></>}</span>
      <span className="cfbs-game-opp">
        <small>{g.home && !g.neutral ? 'VS' : g.neutral ? 'N' : '@'}</small>
        <Logo short={g.oppShort} size={24} />
        <b>{(g.meta?.oppRank ?? (g.post ? g.oppSeed : null)) ? <em>{g.meta?.oppRank ?? g.oppSeed}</em> : null}{v.school(g.oppShort) !== g.oppShort ? v.school(g.oppShort) : g.opponent}</b>
        {!g.post && g.confGame && <i className="cfbs-game-conf" title="Conference game" />}
      </span>
      <span className="cfbs-game-sc"><b>{g.won ? 'W' : 'L'}</b><span>{g.mySc}-{g.oppSc}{g.ot ? <small> {g.ot > 1 ? `${g.ot}OT` : 'OT'}</small> : null}</span></span>
      <span className="cfbs-game-line">{gameLine(g, pos)}</span>
    </li>
  )
}
// (live: a fixed window that keeps the newest result in view, the games to come waiting under it; the season
// done: the whole schedule, open)
function Schedule({ v, pos, shown, open }) {
  const box = useRef(null)
  const follow = useRef(true)
  useEffect(() => {
    const el = box.current
    if (!el || open || !follow.current || userScrolling()) return
    const row = el.children[Math.max(0, shown - 1)]
    if (row) el.scrollTo({ top: Math.max(0, row.offsetTop - el.clientHeight + row.offsetHeight + 2), behavior: 'smooth' })
  }, [shown, open])
  const moved = () => { follow.current = false }
  return (
    <section className="cfbp-sec">
      <Hd sub={`${shown}/${v.reg.length}`}>SCHEDULE</Hd>
      <ol ref={box} className={`cfbs-sched cfbp-sched${open ? ' is-open' : ''}`} onTouchStart={moved} onWheel={moved}
        onScroll={e => { const el = e.currentTarget; if (el.scrollHeight - el.scrollTop - el.clientHeight < 8) follow.current = true }}>
        {v.reg.map((g, i) => (i < shown ? <GameRow key={i} g={g} v={v} pos={pos} /> : (
          <li key={i} className="cfbs-game is-up">
            <span className="cfbs-game-wk">WK {weekNo(g.meta?.label ?? g.wk)}<small>{g.meta?.date}</small></span>
            <span className="cfbs-game-opp"><small>{g.home && !g.neutral ? 'VS' : g.neutral ? 'N' : '@'}</small><Logo short={g.oppShort} size={24} /><b>{v.school(g.oppShort) !== g.oppShort ? v.school(g.oppShort) : g.opponent}</b></span>
            <span className="cfbs-game-sc" />
            <span className="cfbs-game-line">{g.confGame ? `${v.conf?.short ?? 'Conference'} game` : g.fcs ? 'FCS opponent' : 'Non-conference'}</span>
          </li>
        )))}
      </ol>
    </section>
  )
}

// ── the games that made the regular season: the biggest win, the one that got away, his best day ──
function KeyGames({ games, v, pos }) {
  const wins = games.filter(g => g.won), losses = games.filter(g => !g.won)
  const big = wins.filter(g => g.meta?.oppRank).sort((a, b) => a.meta.oppRank - b.meta.oppRank)[0] ?? wins.slice().sort((a, b) => (b.mySc - b.oppSc) - (a.mySc - a.oppSc))[0]
  const tough = losses.slice().sort((a, b) => (a.oppSc - a.mySc) - (b.oppSc - b.mySc))[0]
  const best = games.slice().sort((a, b) => yardsOf(b, pos) - yardsOf(a, pos)).find(g => g !== big && g !== tough)
  const cards = [
    big && { k: 'BIGGEST WIN', g: big },
    tough && { k: tough.oppSc - tough.mySc <= 7 ? 'ONE THAT GOT AWAY' : 'TOUGHEST LOSS', g: tough },
    best && { k: 'HIS BEST GAME', g: best },
  ].filter(Boolean)
  if (!cards.length) return null
  return (
    <section className="cfbp-sec">
      <Hd>KEY GAMES</Hd>
      <div className="cfbs-keys">
        {cards.map(({ k, g }) => (
          <div key={k} className={`cfbs-key${g.won ? '' : ' is-l'}`}>
            <small>{k} · WK {weekNo(g.meta?.label ?? g.wk)}</small>
            <span className="cfbs-key-opp"><Logo short={g.oppShort} size={30} /><b>{g.meta?.oppRank ? <em>{g.meta.oppRank}</em> : null}{v.school(g.oppShort)}</b><strong>{g.won ? 'W' : 'L'} {g.mySc}-{g.oppSc}</strong></span>
            <span className="cfbs-key-line">{gameLine(g, pos)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── his game log: the box score line, game by game, with the totals ──
const LOG = {
  qb: [['C/ATT', g => (g.att != null ? `${g.comp}/${g.att}` : '–')], ['YDS', g => n(g.passYds)], ['TD', g => n(g.tds)], ['INT', g => n(g.ints)], ['RUSH', g => n(g.rushYds)], ['RTD', g => n(g.rushTDs)]],
  rb: [['CAR', g => n(g.carries)], ['YDS', g => n(g.rushYds)], ['TD', g => n(g.rushTDs)], ['REC', g => n(g.recs)], ['RYDS', g => n(g.recYds)], ['LONG', g => n(g.long)]],
  wr: [['TGT', g => n(g.targets)], ['REC', g => n(g.rec)], ['YDS', g => n(g.recYds)], ['TD', g => n(g.recTDs)], ['LONG', g => n(g.long)]],
}
function BoxLog({ games, v, pos, totals, userName, sub = null }) {
  const cols = LOG[pos]
  const tot = pos === 'qb' ? [`${n(totals?.seasonCompletions)}/${n(totals?.seasonAttempts)}`, n(totals?.seasonPassYds), n(totals?.seasonTDs), n(totals?.seasonINTs), n(totals?.seasonRushYds), n(totals?.seasonRushTDs)]
    : pos === 'rb' ? [n(totals?.seasonCarries), n(totals?.seasonRushYds), n(totals?.seasonRushTDs), n(totals?.seasonRecs), n(totals?.seasonRecYds), n(totals?.seasonLong)]
    : [n(totals?.seasonTargets), n(totals?.seasonRecs), n(totals?.seasonRecYds), n(totals?.seasonRecTDs), n(totals?.seasonLong)]
  return (
    <section className="cfbp-sec">
      <Hd sub={sub ?? userName}>GAME LOG</Hd>
      <div className="cfbs-log-scroll">
        <table className="cfbs-log">
          <thead><tr><th className="is-l">WK</th><th className="is-l">OPP</th><th>RES</th>{cols.map(([k]) => <th key={k}>{k}</th>)}</tr></thead>
          <tbody>
            {games.map((g, i) => (
              <tr key={i} className={g.won ? '' : 'is-l'}>
                <td className="is-l">{g.post ? (g.round === 'Conference Championship' ? 'CCG' : g.round === 'Bowl' ? 'BOWL' : 'CFP') : weekNo(g.meta?.label ?? g.wk)}</td>
                <td className="is-l">{g.home && !g.neutral ? '' : g.neutral ? 'n ' : '@'}{v.T(g.oppShort).short ?? g.oppShort}</td>
                <td>{g.won ? 'W' : 'L'} {g.mySc}-{g.oppSc}</td>
                {cols.map(([k, f]) => <td key={k}>{f(g)}</td>)}
              </tr>
            ))}
          </tbody>
          {totals && <tfoot><tr><td className="is-l" colSpan={3}>TOTAL</td>{tot.map((x, i) => <td key={i}>{x}</td>)}</tr></tfoot>}
        </table>
      </div>
    </section>
  )
}

const MatchRow = ({ short, name, seed, sc, win, me }) => (
  <div className={`cfbs-mrow${win ? ' is-win' : ''}${me ? ' is-me' : ''}`}>
    {seed != null && <em>{seed}</em>}
    <Logo short={short} size={22} />
    <span>{name}</span>
    <b>{sc ?? ''}</b>
  </div>
)
// one game between two schools, with a header (the conference title game, a bowl, the title game)
function Match({ v, title, site, a, b, aSc, bSc, winner, aSeed, bSeed, foot = null, className = '' }) {
  const me = v.team.short
  return (
    <div className={`cfbs-match ${className}${winner === me ? ' is-won' : ''}`}>
      <div className="cfbs-match-hd"><b>{String(title).toUpperCase()}</b>{site && <small>{site}</small>}</div>
      <MatchRow short={a} name={v.school(a)} seed={aSeed} sc={aSc} win={winner === a} me={a === me} />
      <MatchRow short={b} name={v.school(b)} seed={bSeed} sc={bSc} win={winner === b} me={b === me} />
      {foot && <div className="cfbs-match-foot">{foot}</div>}
    </div>
  )
}

// the conference table: conference record (never the title game), the overall record, the AP ranking, the champion
function ConfTable({ v, champ = false }) {
  const s = v.c.myStanding
  if (!s) return null
  const me = v.team.short
  return (
    <table className="cfbs-table">
      <thead><tr><th /><th className="is-team">TEAM</th><th>CONF</th><th>ALL</th></tr></thead>
      <tbody>
        {s.teams.map((x, i) => (
          <tr key={x.short} className={x.short === me ? 'is-me' : undefined}>
            <td className="is-n">{i + 1}</td>
            <td className="is-team"><Logo short={x.short} size={20} /><span>{x.cfp && x.cfp <= 25 ? <em>{x.cfp}</em> : null}{v.school(x.short)}</span>{champ && x.short === s.champion && <i className="cfbs-champ">CHAMP</i>}</td>
            <td>{x.confW}-{x.confL}</td>
            <td>{champ ? (x.selection ?? `${x.w}-${x.l}`) : `${x.w}-${x.l}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// The 12-team Playoff, every game: first round on campus, the quarterfinal and semifinal bowls, the title game
const ROUND_SHORT = { 'First Round': 'FIRST ROUND', Quarterfinal: 'QUARTERFINALS', Semifinal: 'SEMIFINALS', 'National Championship': 'TITLE GAME' }
// While he's still playing, the bracket only shows what's happened: through (a round index in CFP_ROUNDS) is the
// last round with its matchups set, scoresThrough the last with its results in. Later rounds are TBD.
const CFP_ROUNDS = ['First Round', 'Quarterfinal', 'Semifinal', 'National Championship']
function CfpBracket({ v, through = 9, scoresThrough = 9 }) {
  const p = v.c.playoff
  if (!p?.games?.length) return null
  const me = v.team.short
  const rounds = CFP_ROUNDS.map((round, ri) => ({ round, ri, games: p.games.filter(g => g.round === round) })).filter(r => r.games.length)
  return (
    <div className="cfbs-bracket-scroll">
      <div className="cfbs-bracket" style={{ '--rounds': rounds.length }}>
        {rounds.map(r => (
          <div key={r.round} className="cfbs-round">
            <h3>{ROUND_SHORT[r.round] ?? r.round.toUpperCase()}</h3>
            <div className="cfbs-round-games">
              {r.games.map((g, i) => {
                if (r.ri > through) return (
                  <div key={i} className="cfbs-bgame is-tbd">
                    {g.bowl && r.round !== 'National Championship' && <small>{g.bowl}</small>}
                    <div className="cfbs-mrow"><span>TBD</span><b /></div>
                    <div className="cfbs-mrow"><span>TBD</span><b /></div>
                  </div>
                )
                const res = r.ri <= scoresThrough
                return (
                  <div key={i} className={`cfbs-bgame${g.hi === me || g.lo === me ? ' is-me' : ''}`}>
                    {g.bowl && r.round !== 'National Championship' && <small>{g.bowl}</small>}
                    <MatchRow short={g.hi} name={v.school(g.hi)} seed={g.hiSeed} sc={res ? g.hiSc : null} win={res && g.winner === g.hi} me={g.hi === me} />
                    <MatchRow short={g.lo} name={v.school(g.lo)} seed={g.loSeed} sc={res ? g.loSc : null} win={res && g.winner === g.lo} me={g.lo === me} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// football's playoff strip (AppSeason Bracket), the CFP's rounds: a top-four seed opens with a bye
const CFP_STAGES = [
  { id: 'r1', label: 'FIRST ROUND', test: /first/i },
  { id: 'qf', label: 'QUARTERFINAL', test: /quarter/i },
  { id: 'sf', label: 'SEMIFINAL', test: /semi/i },
  { id: 'nc', label: 'TITLE GAME', test: /national/i },
]
function CfpStrip({ rounds, gameIdx, status, hasBye }) {
  return (
    <div className="ag-bracket">
      {CFP_STAGES.map((st, i) => {
        const ri = rounds.findIndex(r => st.test.test(r.round))
        const r = ri >= 0 ? rounds[ri] : null
        const ended = status === 'eliminated' || status === 'champion'
        let state = 'pending'
        if (!r) state = hasBye && st.id === 'r1' ? 'bye' : ended ? 'out' : 'pending'
        else if (ri < gameIdx || (ri === gameIdx && (status === 'between' || status === 'champion'))) state = r.won ? 'won' : 'lost'
        else if (ri === gameIdx && status === 'eliminated') state = 'lost'
        else if (ri === gameIdx) state = 'live'
        return (
          <div key={st.id} className={`ag-bk is-${state}${st.id === 'nc' ? ' ag-bk--sb' : ''}`}>
            <span className="ag-bk-lbl">{st.label}</span>
            <span className="ag-bk-val">{state === 'bye' ? 'BYE' : state === 'won' || state === 'lost' ? `${r.mySc}-${r.oppSc}` : state === 'live' ? 'LIVE' : '—'}</span>
            {i < CFP_STAGES.length - 1 && <span className="ag-bk-link" />}
          </div>
        )
      })}
    </div>
  )
}

// One of his postseason games, live on football's playoff scoreboard (LiveGame.jsx): the round, the schools, the
// clock, each score as it lands
const lum = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? ''); if (!m) return 0.5; const x = parseInt(m[1], 16); return (0.2126 * (x >> 16) + 0.7152 * ((x >> 8) & 255) + 0.0722 * (x & 255)) / 255 }
// a school colour that shows on the dark scoreboard (Notre Dame's navy doesn't: its gold does)
const onDark = t => { const a = t.color ?? '#0a3d91', b = t.color2; return lum(a) < 0.22 && b && lum(b) > lum(a) && lum(b) < 0.95 ? b : lum(a) < 0.22 ? '#4f8fe8' : a }
function LiveGame({ v, g, onDone }) {
  const ccg = g.round === 'Conference Championship'
  const round = roundName(g, v)
  const bowl = g.bowl ?? g.label ?? 'Bowl'
  const fin = ccg || !isCfp(g) || g.round === 'National Championship'
  const champ = ccg ? `✓ ${v.conf?.short ?? 'Conference'} Champions` : g.round === 'National Championship' ? '✓ National Champions' : `✓ Won the ${bowl}`
  const lost = ccg ? '✗ Lost the title game' : isCfp(g) ? '✗ Eliminated' : `✗ Lost the ${bowl}`
  return (
    <PlayoffGame
      round={round} opponent={v.school(g.oppShort)} home={!!g.home && !g.neutral} weather={null}
      mySc={g.mySc} oppSc={g.oppSc} won={!!g.won} overtime={!!g.ot}
      teamColor={onDark(v.team)} textColor="#ffffff" teamAbbr={v.team.short} teamLogo={cfbLogo(v.team.short)}
      oppLogo={cfbLogo(g.oppShort)} oppAbbr={g.oppShort}
      finalWord={g.neutral || ccg || g.round === 'National Championship' ? round : null}
      isFinal={fin} champWord={champ} lossWord={lost} isAllTime={false} onDone={onDone}
    />
  )
}

// ── the figure in school colours, the build as rows (the pre-season page and the final report) ──
function Figure({ pos, build, team }) {
  if (!build || !team) return null
  const mono = Object.fromEntries(Object.entries(build).map(([k, x]) => [k, x ? { ...x, teamColor: team.color, teamColor2: team.color2, team: `cfb/${team.short}` } : x]))
  if (pos === 'wr') return (
    <div className="simp-team-model simp-team-model--rb">
      <div className="simp-team-model-glow" />
      <img src="/wr-silhouette.png" alt="" className="simp-sil-ghost" draggable={false} style={{ filter: 'brightness(0.55)' }} />
      <WRFigureOverlay build={mono} />
    </div>
  )
  if (pos === 'rb') return (
    <div className="simp-team-model simp-team-model--rb">
      <div className="simp-team-model-glow" />
      <img src="/rb-silhouette.webp" alt="" className="simp-sil-ghost" draggable={false} />
      <RBFigureOverlay build={mono} />
    </div>
  )
  return (
    <div className="simp-team-model">
      <div className="simp-team-model-glow" />
      <img src="/qb-silhouette.webp" alt="" className="simp-sil-ghost" draggable={false} />
      <QBFigureOverlay build={mono} className="player-qbfig" />
    </div>
  )
}
const rowsOf = (build, types, attrMap) => (build && types ? types.filter(t => build[t]).map(t => ({ key: t, label: attrMap?.[t]?.label ?? t, data: build[t], val: build[t].val })) : [])
function BuildRows({ rows, small = false, visible = rows.length }) {
  return (
    <div className={`simp-attr-table${small ? ' simp-attr-table-sm' : ''}`}>
      {rows.map(({ key, label, data, val }, i) => (
        <div key={key} className={`simp-attr-row${i < visible ? ' simp-row-visible' : ''}`}>
          <QBAvatar photo={data.photo} team={data.team} color={data.teamColor} size={small ? 36 : 46} />
          <div className="simp-attr-info">
            <span className="simp-attr-name">{label}</span>
            <span className="simp-attr-qb">{data.qbFull}</span>
          </div>
          <span className="simp-grade-circle" style={{ background: gradeColor(val), color: '#07120a' }}>{valToGrade(val)}</span>
        </div>
      ))}
    </div>
  )
}

// ── PRE-SEASON ──────────────────────────────────────────────────────────────
function PrePage({ r, pos, build, types, attrMap, archetype, team, onNext }) {
  const ovr = useCountUp(r.ovr, { run: !!r.ovr, ms: 900 })
  const rows = rowsOf(build, types, attrMap)
  const [vis, setVis] = useState(0)
  useEffect(() => {
    let i = 0, t
    const tick = () => { if (i >= rows.length) return; i++; setVis(i); t = setTimeout(tick, 80) }
    t = setTimeout(tick, 600)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="simp-screen">
      <div className="simp-ovr-hero">
        <div className="simp-ovr-num">{ovr || '–'}</div>
        <div className="simp-ovr-lbl">OVR</div>
      </div>
      <div className="simp-archetype">{archetype ?? r.archetype}</div>
      <button className="simp-cta" onClick={onNext}>Simulate Season</button>
      <Figure pos={pos} build={build} team={team} />
      <BuildRows rows={rows} visible={vis} />
    </div>
  )
}

// ── REGULAR SEASON ──────────────────────────────────────────────────────────
function RegPage({ r, v, pos, userName, live, nextLabel, onNext, onWeeks, onStory }) {
  // the season plays out a week at a time when it's new (Reduce Motion, or coming back to it: all at once)
  const [director] = useState(() => (live && !reduced()
    ? createDirector({ sport: 'cfb', pos, build: {}, team: v.team, simFn: () => r, base: { ...r, games: v.reg }, locked: true, seed: String(r.seed ?? 'cfb'), name: userName })
    : null))
  const dr = useDirectedReveal({ director, pace: 300, onFinal: f => onStory?.(f?.story ?? null) })
  const [loading, setLoading] = useState(!!director)
  useEffect(() => { if (!director) return; const t = setTimeout(() => setLoading(false), 600); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const weeks = director ? dr.k : v.reg.length
  useEffect(() => { if (director && dr.k > 0) sfx('tick') }, [dr.k]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onWeeks?.(weeks) }, [weeks]) // eslint-disable-line react-hooks/exhaustive-deps
  const done = !director || dr.done
  const shown = v.reg.slice(0, weeks)
  const w = shown.filter(g => g.won).length, l = shown.length - w
  // the polls so far: through the week just played
  const lastWk = weekNo(shown[shown.length - 1]?.meta?.label ?? 'Preseason')
  const polls = v.ranks.filter(p => !/^final/i.test(p.label) && (done ? weekNo(p.label) <= 15 : weekNo(p.label) <= (weeks ? lastWk + 1 : 0)))
  const L = v.c.leaders
  if (loading) return <div className="simp-screen"><SimLoading /></div>
  return (
    <div className="simp-screen">
      <div className="simp-eyebrow">Regular Season</div>
      <div className="simp-live-record">
        <span className="slr-w">{w}</span>
        <span className="slr-sep">–</span>
        <span className="slr-l">{l}</span>
      </div>
      <Pulse games={shown} total={v.reg.length} playoffWins={10} />
      {director && <Wire items={dr.headlines} />}
      {director && <Milestones items={dr.fresh} />}
      <WeekStrip games={v.reg.map((g, i) => ({ ...g, wk: weekNo(g.meta?.label ?? g.wk) || i }))} revealed={weeks} />
      <Schedule v={v} pos={pos} shown={weeks} open={done} />
      <Poll ranks={polls} />
      {done && (
        <>
          <SeasonLine totals={v.c.totals?.regular ?? r} pos={pos} sub={`${userName} · REGULAR SEASON`} />
          {L?.rows?.length > 0 && (
            <LeadersBoard title="FBS LEADERS" label={L.label} rank={L.rank} who={<NameTag name={userName} self />}
              rows={L.rows.slice(0, 6).map((x, i) => ({ rank: i + 1, me: x.isUser, name: x.isUser ? <NameTag name={userName} self /> : x.name, team: x.team, value: n(x.value) }))} />
          )}
          <KeyGames games={v.reg} v={v} pos={pos} />
          <BoxLog games={v.reg} v={v} pos={pos} totals={v.c.totals?.regular} userName={userName} />
          <button className="simp-cta simp-cta-in simp-cta--pin" onClick={onNext}>{nextLabel}</button>
        </>
      )}
    </div>
  )
}

// ── CONFERENCE CHAMPIONSHIP ─────────────────────────────────────────────────
function CcgPage({ v, pos, live, onNext }) {
  const s = v.c.myStanding
  const t0 = s?.title ?? null
  const me = v.team.short
  const g = v.ccg
  // only his own title game plays; the conference's, when he's not in it, is a result (no game to sit through)
  const [status, setStatus] = useState(g && live && !reduced() ? 'pre' : 'done')
  useEffect(() => { if (status !== 'pre') return; const t = setTimeout(() => setStatus('playing'), 500); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!g && !t0) return null
  const title = g?.title ?? t0?.title ?? `${v.conf?.short ?? 'Conference'} Championship`
  const confShort = v.conf?.short ?? 'conference'
  const place = (s?.teams?.findIndex(x => x.short === me) ?? -1) + 1
  const site = [g?.site, g?.date].filter(Boolean).join(' · ') || null
  return (
    <div className="simp-screen">
      {status !== 'done' ? (
        <>
          <div className="simp-eyebrow">{title}</div>
          {status === 'pre' ? <SimLoading label="Championship week…" /> : <LiveGame v={v} g={g} onDone={() => setStatus('done')} />}
        </>
      ) : (
        <div className="simp-screen-center cfbp-end" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="simp-eyebrow">{title}</div>
          {!g ? (
            <>
              <div className="plf-elim-title">{v.school(t0.winner)} wins the {confShort}</div>
              <div className="plf-elim-round">{v.school(me)} finished {ordinal(place || 1)} in the {confShort} and missed the title game</div>
            </>
          ) : g.won ? (
            <>
              <div className="plf-champ-label">{confShort} Champions</div>
              <div className="plf-champ-sub">{g.mySc} – {g.oppSc}{g.ot ? ' OT' : ''} · vs {v.school(g.oppShort)}</div>
            </>
          ) : (
            <>
              <div className="plf-elim-title">Lost the title game</div>
              <div className="plf-elim-score">{g.mySc} – {g.oppSc}{g.ot ? ' OT' : ''} · vs {v.school(g.oppShort)}</div>
            </>
          )}
          <button className="simp-cta" onClick={onNext}>Selection Day</button>
        </div>
      )}
      {status === 'done' && t0 && (
        <section className="cfbp-sec">
          <Hd sub={v.conf?.name}>{String(confShort).toUpperCase()} CHAMPIONSHIP</Hd>
          <Match v={v} title={title} site={site} a={t0.a} b={t0.b} aSc={t0.aSc} bSc={t0.bSc} winner={t0.winner}
            foot={t0.winner === me ? `${v.school(me).toUpperCase()} · ${String(confShort).toUpperCase()} CHAMPIONS` : `${v.school(t0.winner).toUpperCase()} · ${String(confShort).toUpperCase()} CHAMPIONS`} />
          {g && <p className="cfbs-note"><b>{v.userName}:</b> {gameLine(g, pos)}</p>}
        </section>
      )}
      <section className="cfbp-sec">
        <Hd sub={status === 'done' ? 'FINAL' : 'REGULAR SEASON'}>{String(confShort).toUpperCase()} STANDINGS</Hd>
        <ConfTable v={v} champ={status === 'done'} />
      </section>
    </div>
  )
}

// ── SELECTION DAY ───────────────────────────────────────────────────────────
function SelPage({ v, onNext }) {
  const c = v.c
  const me = v.team.short
  const last = c.cfpRankings?.[c.cfpRankings.length - 1]
  const field = c.playoff?.field ?? []
  const myRank = last?.top25?.find(t => t.short === me)?.rank ?? null
  const bowlName = c.bowl ? (c.bowl.bowl ?? c.bowl.label) : null
  const big = c.cfpSeed ? `No. ${c.cfpSeed} Seed` : bowlName ?? 'No Bowl'
  return (
    <div className="simp-screen">
      <div className="simp-eyebrow">Selection Day</div>
      <div className="cfbp-sel-big">{big}</div>
      <p className="cfbs-note cfbp-sel-note">{c.cfpSeed
        ? <><b>{v.school(me)} is in: the No. {c.cfpSeed} seed</b>{c.cfpSeed <= 4 ? ', with a first-round bye' : c.cfpSeed <= 8 ? ', at home in the first round' : ', on the road in the first round'}.</>
        : <><b>{v.school(me)} is out of the Playoff</b>{myRank ? `, No. ${myRank} in the committee's final rankings` : ', unranked in the committee\'s final rankings'}.{bowlName ? ` The ${bowlName} is next, against ${v.school(c.bowl.oppShort)}.` : ' No bowl took them.'}</>}</p>
      <section className="cfbp-sec">
        <Hd sub="12-TEAM FIELD">THE PLAYOFF</Hd>
        <ol className="cfbs-field" aria-label="The 12-team field">
          {field.map(f => (
            <li key={f.short} className={f.short === me ? 'is-me' : undefined}>
              <em>{f.seed}</em><Logo short={f.short} size={24} />
              <span><b>{v.school(f.short)}</b><small>{f.rec} · {f.conf}</small></span>
              <i className={f.bid === 'auto' ? 'is-auto' : ''}>{f.bid === 'auto' ? 'AUTO BID' : 'AT-LARGE'}</i>
            </li>
          ))}
        </ol>
      </section>
      {last && (
        <section className="cfbp-sec">
          <Hd sub={String(last.label).toUpperCase()}>CFP RANKINGS</Hd>
          <ol className="cfbs-top25">
            {last.top25.map(t => (
              <li key={t.short} className={t.short === me ? 'is-me' : undefined}><em>{t.rank}</em><Logo short={t.short} size={18} /><span>{v.school(t.short)}</span><small>{t.rec}</small></li>
            ))}
          </ol>
        </section>
      )}
      <button className="simp-cta simp-cta-in simp-cta--pin" onClick={onNext}>{c.cfpSeed ? 'Enter the Playoff' : bowlName ? `Play the ${bowlName}` : 'Bowl Season'}</button>
    </div>
  )
}

// ── THE PLAYOFF or THE BOWL ─────────────────────────────────────────────────
function PostPage({ v, live, onNext }) {
  const games = v.after
  const cfp = !!v.c.cfpSeed
  const lastI = games.length - 1
  const endState = () => (games[lastI]?.won ? 'champion' : 'eliminated')
  const play = live && !reduced() && games.length > 0
  const [gameIdx, setGameIdx] = useState(play ? 0 : Math.max(0, lastI))
  const [status, setStatus] = useState(play ? 'playing' : endState())
  const [started, setStarted] = useState(!play)
  useEffect(() => { if (!play) return; const t = setTimeout(() => setStarted(true), 500); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const fin = v.c.playoff?.games?.find(g => g.round === 'National Championship')
  const playoff = (
    <section className="cfbp-sec">
      <Hd sub="12 TEAMS">THE PLAYOFF</Hd>
      <CfpBracket v={v} />
      {fin && (
        <Match v={v} className="cfbs-title" title="CFP National Championship" site={[fin.site, fin.date].filter(Boolean).join(' · ')} a={fin.hi} b={fin.lo} aSeed={fin.hiSeed} bSeed={fin.loSeed} aSc={fin.hiSc} bSc={fin.loSc} winner={fin.winner}
          foot={`${v.school(fin.winner).toUpperCase()} · NATIONAL CHAMPIONS`} />
      )}
    </section>
  )

  if (!games.length) {
    const wins = v.reg.filter(g => g.won).length + (v.ccg?.won ? 1 : 0)
    return (
      <div className="simp-screen">
        <div className="simp-screen-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="simp-eyebrow">Bowl Season</div>
          <div className="simp-miss-title">No Bowl</div>
          <div className="plf-elim-round">{wins >= 6 ? `${v.record}: bowl eligible, but no bowl took them` : `${v.record}: six wins makes a team bowl eligible`}</div>
          <p className="cfbs-note"><b>{v.school(v.team.short)}</b> stayed home for the bowls.</p>
          <button className="simp-cta" onClick={onNext}>The Heisman</button>
        </div>
        {playoff}
      </div>
    )
  }

  const done = () => {
    const g = games[gameIdx]
    if (!g.won) { setStatus('eliminated'); return }
    if (gameIdx === lastI) { setStatus('champion'); return }
    setStatus('between')
    timer.current = setTimeout(() => { setGameIdx(i => i + 1); setStatus('playing') }, 2500)
  }
  const cur = games[gameIdx]
  const bowlName = g => g.bowl ?? g.label ?? 'Bowl'
  let inner
  if (status === 'champion') {
    inner = (
      <div className="simp-screen-center plf-champion-screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="simp-eyebrow">{cfp ? 'CFP National Championship' : bowlName(cur)}</div>
        <div className="plf-champ-label">{cfp ? 'National Champions' : `${bowlName(cur)} Champions`}</div>
        <div className="plf-champ-sub">{cur.mySc}–{cur.oppSc}{cur.ot ? ' OT' : ''} vs {v.school(cur.oppShort)}</div>
        <button className="simp-cta simp-cta-in" onClick={onNext}>The Heisman</button>
      </div>
    )
  } else if (status === 'eliminated') {
    const title = !cfp ? `Lost the ${bowlName(cur)}` : cur.round === 'National Championship' ? 'Lost the Title Game' : 'Eliminated'
    inner = (
      <div className="simp-screen-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="simp-eyebrow">Season Over</div>
        <div className="plf-elim-title">{title}</div>
        {cfp && cur.round !== 'National Championship' && <div className="plf-elim-round">{roundName(cur, v)}</div>}
        <div className="plf-elim-score">{cur.mySc} – {cur.oppSc}{cur.ot ? ' OT' : ''} · vs {v.school(cur.oppShort)}</div>
        <button className="simp-cta" onClick={onNext}>The Heisman</button>
      </div>
    )
  } else if (status === 'between') {
    const next = games[gameIdx + 1]
    inner = (
      <div className="plf-between-screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="plf-bw-result"><span className="plf-bw-w">W</span><span className="plf-bw-score">{cur.mySc}–{cur.oppSc}{cur.ot ? ' OT' : ''}</span></div>
        <div className="plf-bw-adv">Advancing…</div>
        {next && <div className="plf-bw-next">Next up · {roundName(next, v).replace(/^CFP /, '')}</div>}
      </div>
    )
  } else {
    inner = (
      <>
        <div className="simp-eyebrow">{cfp ? 'College Football Playoff' : bowlName(cur)}</div>
        {!started ? <SimLoading label={cfp ? 'Entering the Playoff…' : 'Bowl season…'} /> : <LiveGame key={gameIdx} v={v} g={cur} onDone={done} />}
      </>
    )
  }
  const ended = status === 'champion' || status === 'eliminated'
  const bowl = v.c.bowl
  return (
    <div className="simp-screen">
      {cfp && <CfpStrip rounds={games} gameIdx={gameIdx} status={status} hasBye={!!v.c.cfpSeed && v.c.cfpSeed <= 4} />}
      {inner}
      {started && <PlayoffLog title={cfp ? 'Playoff Game Log' : 'Bowl Game Log'} rounds={logRows(games.slice(0, status === 'playing' ? gameIdx : gameIdx + 1), v)} />}
      {ended && !cfp && bowl && (
        <section className="cfbp-sec">
          <Hd sub="BOWL SEASON">{String(bowlName(bowl)).toUpperCase()}</Hd>
          <Match v={v} title={bowlName(bowl)} site={[bowl.site, bowl.date].filter(Boolean).join(' · ')} a={v.team.short} b={bowl.oppShort} aSc={bowl.mySc} bSc={bowl.oppSc} winner={bowl.won ? v.team.short : bowl.oppShort} />
        </section>
      )}
      {ended && playoff}
      {cfp && !ended && started && (() => {
        // the bracket as it stands: his round's matchups, its results once his game is over, nothing past it
        const ri = Math.max(0, CFP_ROUNDS.indexOf(cur.round))
        return (
          <section className="cfbp-sec">
            <Hd sub="12 TEAMS">THE PLAYOFF</Hd>
            <CfpBracket v={v} through={ri} scoresThrough={status === 'between' ? ri : ri - 1} />
          </section>
        )
      })()}
    </div>
  )
}

// ── THE HEISMAN: the ceremony ───────────────────────────────────────────────
// Two graphics, as the broadcast runs them. First THE FINALISTS, in alphabetical order (the order they're seated
// in, and it gives nothing away): the face, the school, the line that got him to New York. Then the ballots are
// counted: every finalist's points fill in together, and the longest bar is the winner. Then THE VOTE: the same
// rows in the order they finished, the winner in gold, first-place votes beside the points, and where the build
// finished when he wasn't a finalist. Reduce Motion (or coming back to the page): THE VOTE, at once
const lastName = s => String(s ?? '').trim().split(/\s+/).slice(-1)[0] ?? ''
function Face({ short, photo, color }) {
  // the school's logo on a white plate is always there; the headshot goes over it once it has loaded (never an empty frame)
  const [on, setOn] = useState(false)
  return (
    <span className="cfbh-face" style={{ '--school': color ?? '#0a3d91' }}>
      <img className="cfbh-face-logo" src={cfbLogo(short)} alt="" draggable={false} onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
      {photo && <img className={`cfbh-face-photo${on ? ' is-on' : ''}`} src={photo} alt="" draggable={false} onLoad={() => setOn(true)} onError={e => { e.currentTarget.style.display = 'none' }} />}
    </span>
  )
}
function Heisman({ h, v, userName, userYear, photoOf, live, onDone }) {
  const quick = !live || reduced()
  const [phase, setPhase] = useState(quick ? 2 : 0)   // 0 the finalists · 1 the count · 2 the vote
  useEffect(() => {
    if (quick) { onDone?.(); return }
    const a = setTimeout(() => setPhase(1), 1500)
    const b = setTimeout(() => { setPhase(2); if (h?.userWon) sfx('complete', 2); onDone?.() }, 1500 + 2900)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // the count: every bar and its number at one even pace (the longest bar is still filling when the rest have stopped)
  const [k, setK] = useState(0)
  useEffect(() => {
    if (phase !== 1) return
    let raf, t0
    const step = now => { t0 ??= now; const t = Math.min(1, (now - t0) / 2600); setK(t); if (t < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase])
  const p = phase === 2 ? 1 : phase === 1 ? k : 0
  const fin = h?.finalists ?? []
  const w = h?.winner
  if (!w) return <p className="cfbs-note">No Heisman vote this season.</p>
  const isWinner = f => (f.isUser && w.isUser) || (f.name === w.name && f.team === w.team)
  const nameOf = f => (f.isUser ? userName : f.name)
  const rows = phase === 2 ? fin : [...fin].sort((a, b) => lastName(nameOf(a)).localeCompare(lastName(nameOf(b))))
  const top = Math.max(1, ...fin.map(f => f.pts ?? 0))
  const cls = f => (f.isUser ? userYear : f.year)
  return (
    <div className={`cfbh${phase === 2 ? ' is-done' : ''}`}>
      <div className="cfbh-hd"><b>THE HEISMAN TROPHY</b><small>NEW YORK CITY</small></div>
      <div className="cfbh-bar"><span>{phase === 0 ? 'THE FINALISTS' : phase === 1 ? 'COUNTING THE BALLOTS' : 'THE VOTE'}</span><small>{fin.length} FINALISTS · 3-2-1 POINTS</small></div>
      <p className="cfbh-call" aria-live="polite">{phase === 2
        ? <>The Heisman Trophy goes to <b>{nameOf(w)}</b>, {v.school(w.team)}.</>
        : phase === 1 ? 'The ballots are in.' : 'The finalists, in New York for the presentation.'}</p>
      <ol className="cfbh-list">
        {rows.map((f, i) => (
          <li key={`${f.name}|${f.team}`} className={`${f.isUser ? 'is-me' : ''}${phase === 2 && isWinner(f) ? ' is-win' : ''}`}>
            {phase === 2 && <span className="cfbh-place">{i + 1}</span>}
            <Face short={f.team} photo={f.isUser ? null : photoOf?.(f.name, f.team)} color={v.T(f.team).color} />
            <span className="cfbh-who">
              <b>{f.isUser ? <NameTag name={userName} self /> : f.name}</b>
              <small><Logo short={f.team} size={16} />{f.pos} · {v.school(f.team)}{cls(f) ? ` · ${cls(f)}` : ''}</small>
            </span>
            <span className="cfbh-pts">{phase > 0 ? <><b>{n((f.pts ?? 0) * p)}</b><small>PTS</small></> : null}</span>
            <span className="cfbh-line">{f.line}</span>
            <span className="cfbh-meter" aria-hidden="true"><i style={{ width: `${((f.pts ?? 0) / top) * p * 100}%` }} /></span>
            {phase === 2 && f.first != null && <span className="cfbh-votes">{n(f.first)} first-place {f.first === 1 ? 'vote' : 'votes'}</span>}
          </li>
        ))}
      </ol>
      {phase === 2 && !h.userFinalist && (
        <p className="cfbh-me">{h.userPlace ? <><b>{userName}</b> finished {ordinal(h.userPlace)} in the voting.</> : <><b>{userName}</b> did not receive a Heisman vote.</>}</p>
      )}
    </div>
  )
}
// the season's other awards: the position's, the player of the year awards, the All-America and all-conference teams
function awardRows(v, pos, userName, heisman = false) {
  const a = v.c.awards ?? {}
  if (a.lite) return []
  const who = x => (x?.isUser ? userName : x ? `${x.name}, ${v.school(x.team)}` : '–')
  const rows = []
  const h = a.heisman
  if (heisman && h?.winner) rows.push({ name: 'Heisman Trophy', state: h.userWon ? 'WINNER' : h.userFinalist ? 'FINALIST' : h.userPlace ? `${ordinal(h.userPlace).toUpperCase()} IN THE VOTE` : null, won: !!h.userWon, sub: h.userWon ? null : `Won by ${who(h.winner)}` })
  for (const k of [POS_AWARD[pos], 'maxwell', 'walterCamp']) {
    const x = a[k]
    if (x?.winner) rows.push({ name: x.award, state: x.userWon ? 'WINNER' : x.userFinalist ? 'FINALIST' : null, won: !!x.userWon, sub: x.userWon ? null : `Won by ${who(x.winner)}` })
  }
  const ac = a.allConference
  rows.push({ name: 'All-American', state: a.allAmerica?.user ? `${a.allAmerica.user.toUpperCase()} TEAM` : null, won: a.allAmerica?.user === 'first' })
  if (ac) rows.push({ name: `All-${ac.conf ?? v.conf?.short ?? 'Conference'}`, state: ac.user ? `${ac.user.toUpperCase()} TEAM` : null, won: ac.user === 'first' })
  if (a.confPOY?.winner) rows.push({ name: a.confPOY.award, state: a.confPOY.userWon ? 'WINNER' : null, won: !!a.confPOY.userWon, sub: a.confPOY.userWon ? null : `Won by ${who(a.confPOY.winner)}` })
  return rows
}
const AwardList = ({ rows }) => (
  <ul className="cfbs-awards">
    {rows.map(x => (
      <li key={x.name} className={x.won ? 'is-won' : x.state ? 'is-part' : 'is-none'}>
        <span>{x.name}{x.sub && <small>{x.sub}</small>}</span><b>{x.state ?? '–'}</b>
      </li>
    ))}
  </ul>
)
function AwardsPage({ v, pos, userName, userYear, photoOf, live, onNext }) {
  const [done, setDone] = useState(false)
  const rows = awardRows(v, pos, userName)
  return (
    <div className="simp-screen">
      <Heisman h={v.c.awards?.heisman} v={v} userName={userName} userYear={userYear} photoOf={photoOf} live={live} onDone={() => setDone(true)} />
      {done && rows.length > 0 && (
        <section className="cfbp-sec">
          <Hd sub={userName}>AWARDS</Hd>
          <AwardList rows={rows} />
        </section>
      )}
      {done && <button className="simp-cta simp-cta-in simp-cta--pin" onClick={onNext}>Draft Stock</button>}
    </div>
  )
}

// ── DRAFT STOCK: the scouting report ────────────────────────────────────────
// What scouts write about each trait, when it's a strength and when it's a question (the build's own grades)
const SCOUT = {
  qb: {
    arm: ['Drives the ball to the far hash and outside the numbers', 'The deep out and the far hash throw arrive late'],
    legs: ['Extends plays and is a real threat on designed runs', 'Wins from the pocket or not at all'],
    size: ['Prototype frame for the position', 'Undersized: batted balls and durability come up'],
    processing: ['Sets the protection and gets the offense into the right play', 'Slow to identify pressure before the snap'],
    leadership: ['The locker room follows him; coaches rave about him', 'Scouts want to see him take command of a huddle'],
    vision: ['Works through his progressions to the second and third read', 'Locks onto his first read'],
    playmaking: ['Makes off-schedule throws when the play breaks down', 'Struggles once the first look is taken away'],
    accuracy: ['Ball placement to all three levels', 'Sprays the ball, especially downfield'],
    'pocket-presence': ['Feels the rush and climbs the pocket with his eyes up', 'Drops his eyes when the rush gets home'],
  },
  rb: {
    speed: ['Home-run speed: a crease is a touchdown', 'Gets caught from behind in the open field'],
    burst: ['Hits the hole before it closes', 'Needs a runway to get going'],
    strength: ['Runs through arm tackles and finishes falling forward', 'Goes down on first contact too often'],
    size: ['Built to carry a full workload', 'Can his frame hold up to 250 carries?'],
    balance: ['Stays on his feet through contact', 'Knocked off his path too easily'],
    elusiveness: ['Makes the first defender miss in the hole', 'Not a make-you-miss runner in space'],
    vision: ['Patient: presses the hole and finds the cutback', 'Misses the cutback lane'],
    hands: ['A real option out of the backfield on third down', 'Not yet a factor in the passing game'],
    carrying: ['Puts the ball away in traffic', 'The ball has been on the ground'],
  },
  wr: {
    speed: ['Takes the top off a defense', 'Does not run away from corners'],
    bodyControl: ['Adjusts to the ball in the air and works the sideline', 'Struggles to adjust to off-target throws'],
    vertical: ['High-points the football in contested situations', 'Will not win many jump balls'],
    routeRunning: ['Sharp in and out of his breaks; creates separation', 'Rounds off his breaks'],
    release: ['Beats press coverage at the line', 'Can be jammed and rerouted by press corners'],
    hands: ['Plucks the ball away from his body', 'Too many drops and body catches'],
    awareness: ['Finds the soft spot against zone coverage', 'Still learning to read coverage on the move'],
    size: ['A big target with a wide catch radius', 'A smaller target who can be outmuscled at the catch point'],
    afterCatch: ['Turns a slant into a big play', 'Goes down where he catches it'],
  },
}
function scouting(r, v, pos, attrMap) {
  const u = v.c.user ?? {}
  const attrs = u.attrs ?? {}
  const rows = (u.types ?? Object.keys(attrs)).filter(t => attrs[t] != null && SCOUT[pos]?.[t]).map(t => ({ t, val: attrs[t] })).sort((a, b) => b.val - a.val)
  const lab = x => `${String(attrMap?.[x.t]?.label ?? x.t).toUpperCase()} · ${valToGrade(x.val)}`
  const like = [], ask = []
  const strong = rows.filter(x => x.val >= 8).slice(0, 3)
  for (const x of strong.length ? strong : rows.slice(0, 1)) like.push({ k: lab(x), text: SCOUT[pos][x.t][0] })
  for (const x of rows.filter(x => x.val <= 6).reverse().slice(0, 2)) ask.push({ k: lab(x), text: SCOUT[pos][x.t][1] })
  // the season on tape: his numbers, the ranked opponents, the hardware
  const t = v.c.totals?.full ?? r
  if (r.role === 'backup') ask.push({ k: 'TAPE', text: 'A backup year: there is little tape to grade' })
  else if (pos === 'qb') {
    if ((t.seasonTDs ?? 0) >= 25 && (t.seasonINTs ?? 0) * 4 <= t.seasonTDs) like.push({ k: 'PRODUCTION', text: `${n(t.seasonTDs)} touchdown passes against ${n(t.seasonINTs)} ${t.seasonINTs === 1 ? 'interception' : 'interceptions'}` })
    else if ((t.seasonPassYds ?? 0) >= 3500) like.push({ k: 'PRODUCTION', text: `${n(t.seasonPassYds)} passing yards` })
    if ((t.seasonINTs ?? 0) >= 10) ask.push({ k: 'TURNOVERS', text: `${n(t.seasonINTs)} interceptions` })
    if ((t.seasonCompPct ?? 100) < 60 && (t.seasonAttempts ?? 0) >= 150) ask.push({ k: 'EFFICIENCY', text: `Completed ${f1(t.seasonCompPct)}% of his passes` })
  } else if (pos === 'rb') {
    if ((t.seasonRushYds ?? 0) >= 1300) like.push({ k: 'PRODUCTION', text: `${n(t.seasonRushYds)} rushing yards at ${f1(t.seasonYPC)} a carry` })
    if ((t.seasonFumbles ?? 0) >= 4) ask.push({ k: 'BALL SECURITY', text: `${n(t.seasonFumbles)} fumbles` })
    if ((t.seasonYPC ?? 9) < 4.3 && (t.seasonCarries ?? 0) >= 100) ask.push({ k: 'EFFICIENCY', text: `${f1(t.seasonYPC)} yards a carry` })
  } else {
    if ((t.seasonRecYds ?? 0) >= 1100) like.push({ k: 'PRODUCTION', text: `${n(t.seasonRecs)} catches for ${n(t.seasonRecYds)} yards and ${n(t.seasonRecTDs)} touchdowns` })
    if ((t.catchRate ?? 100) < 56 && (t.seasonTargets ?? 0) >= 60) ask.push({ k: 'EFFICIENCY', text: `Caught ${f1(t.catchRate)}% of his targets` })
  }
  const ranked = [...v.reg, ...v.post].filter(g => g.meta?.oppRank || g.oppSeed)
  const rw = ranked.filter(g => g.won).length, rl = ranked.length - rw
  if (ranked.length >= 2 && rw > rl) like.push({ k: 'BIG GAMES', text: `${rw}-${rl} against ranked opponents` })
  if (ranked.length >= 3 && rw < rl) ask.push({ k: 'BIG GAMES', text: `${rw}-${rl} against ranked opponents` })
  const a = v.c.awards ?? {}
  if (a.heisman?.userWon) like.push({ k: 'HARDWARE', text: 'Heisman Trophy winner' })
  else if (a.heisman?.userFinalist) like.push({ k: 'HARDWARE', text: 'Heisman finalist' })
  else if (a.allAmerica?.user === 'first') like.push({ k: 'HARDWARE', text: 'First-team All-American' })
  if (v.team.tier === 'G5') ask.push({ k: 'COMPETITION', text: `Did it against ${v.conf?.short ?? 'Group of Six'} defenses, not the Power Four` })
  if (!ask.length) ask.push({ k: 'CLEAN REPORT', text: 'Scouts had to look hard for a hole in his game' })
  return { like: like.slice(0, 5), ask: ask.slice(0, 4) }
}
const TIER_SHORT = { top10: 'TOP 10', r1: 'RD 1', day2: 'RD 2-3', day3: 'RD 4-7', pfa: 'PFA', udfa: 'UDFA' }
function DraftPage({ r, v, pos, userName, userYear, attrMap, onNext }) {
  const d = v.c.draft
  if (!d) return <div className="simp-screen"><button className="simp-cta" onClick={onNext}>Final Report</button></div>
  const board = d.board ?? []
  const pick = pickOf(d)
  const [lo, hi] = pick ? [Math.ceil(pick[0] / 32), Math.ceil(pick[1] / 32)] : [null, null]
  const on = k => (k === 8 ? !pick : pick != null && k >= lo && k <= hi)
  const rank = d.boardRank ?? null
  const label = CFB_POS[pos].label
  const overall = d.overall ?? (pick ? Math.round((pick[0] + pick[1]) / 2) : null)
  const notes = scouting(r, v, pos, attrMap)
  const headline = d.eligible === false ? 'Not draft-eligible yet' : d.label
  const myRow = { name: userName, team: v.team.short, year: userYear ?? null, isUser: true, tier: d.tier, yds: null, td: null }
  const rows = board.map(x => (x.isUser ? { ...x, name: userName, year: userYear ?? null, tier: d.tier } : x))
  const Row = ({ x, k }) => (
    <tr className={x.isUser ? 'is-me' : undefined}>
      <td className="is-n">{k}</td>
      <td className="is-who"><Logo short={x.team} size={20} /><span><b>{x.isUser ? <NameTag name={userName} self /> : x.name}</b><small>{v.school(x.team)}{x.year ? ` · ${x.year}` : ''}</small></span></td>
      <td>{x.yds != null ? n(x.yds) : '–'}</td>
      <td>{x.td != null ? n(x.td) : '–'}</td>
      <td className="is-proj">{TIER_SHORT[x.tier] ?? '–'}</td>
    </tr>
  )
  const t = v.c.totals?.throughCCG ?? {}
  const mine = pos === 'qb' ? { yds: t.seasonPassYds, td: (t.seasonTDs ?? 0) + (t.seasonRushTDs ?? 0) } : pos === 'rb' ? { yds: t.seasonRushYds, td: (t.seasonRushTDs ?? 0) + (t.seasonRecTDs ?? 0) } : { yds: t.seasonRecYds, td: t.seasonRecTDs }
  return (
    <div className="simp-screen cfbp-draft">
      <section className="cfbp-sec">
        <Hd sub="SCOUTING REPORT">NFL DRAFT STOCK</Hd>
        <div className="cfbs-draft">
          <div className="cfbs-draft-top">
            <small>{userName} · {label} · {v.school(v.team.short)}{userYear ? ` · ${userYear}` : ''}</small>
            <b>{String(headline).toUpperCase()}</b>
            <em>{d.eligible === false ? d.note : pick ? projText(d) : 'Not projected to be drafted'}{d.eligible !== false && d.note ? ` · ${d.note}` : ''}</em>
          </div>
          <ol className="cfbs-draft-board" aria-label={`Projected: ${projText(d)}`}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(k => <li key={k} className={on(k) ? 'is-on' : undefined}><span>{k === 8 ? 'UDFA' : `RD ${k}`}</span></li>)}
          </ol>
          <div className="cfbs-stats cfbp-draft-nums" style={{ '--n': 3 }}>
            <div><b>{rank ? `No. ${rank}` : '–'}</b><small>{label} BOARD{d.boardOf ? ` · OF ${d.boardOf}` : ''}</small></div>
            <div><b>{overall ? `No. ${overall}` : 'NR'}</b><small>BIG BOARD</small></div>
            <div><b>{r.ovr}</b><small>COLLEGE OVR</small></div>
          </div>
        </div>
      </section>
      <section className="cfbp-sec">
        <Hd>WHAT SCOUTS LIKE</Hd>
        <ul className="cfbp-notes">{notes.like.map((x, i) => <li key={i}><b>{x.k}</b><span>{x.text}</span></li>)}</ul>
      </section>
      <section className="cfbp-sec">
        <Hd>THE QUESTIONS</Hd>
        <ul className="cfbp-notes is-ask">{notes.ask.map((x, i) => <li key={i}><b>{x.k}</b><span>{x.text}</span></li>)}</ul>
      </section>
      {rows.length > 0 && (
        <section className="cfbp-sec">
          <Hd sub={POS_GROUP[pos]}>THE BOARD</Hd>
          <table className="cfbp-board">
            <thead><tr><th>RK</th><th className="is-who">PROSPECT</th><th>YDS</th><th>TD</th><th>PROJ</th></tr></thead>
            <tbody>
              {rows.map((x, i) => <Row key={i} x={x.isUser ? { ...x, ...mine } : x} k={i + 1} />)}
              {rank != null && rank > rows.length && (
                <>
                  <tr className="is-gap" aria-hidden="true"><td colSpan={5}>···</td></tr>
                  <Row x={{ ...myRow, ...mine }} k={rank} />
                </>
              )}
            </tbody>
          </table>
        </section>
      )}
      <button className="simp-cta simp-cta-in simp-cta--pin" onClick={onNext}>Final Report</button>
    </div>
  )
}

// ── FINAL REPORT ────────────────────────────────────────────────────────────
function FinalPage({ r, v, pos, build, types, attrMap, archetype, userName, story, rewards, endActions, seasonNote, onDraft, onAgain, onReturn, onTransfer }) {
  const c = v.c
  const full = c.totals?.full ?? r
  const rows = rowsOf(build, types, attrMap)
  const tier = v.champs ? 'sfb-champ' : c.cfpSeed || c.bowl?.won || c.confChamp ? 'sfb-elim' : 'sfb-miss'
  const subBits = [c.confChamp ? `${v.conf?.short ?? 'Conference'} Champions` : null, `${v.record} Season`, `OVR ${r.ovr}`].filter(Boolean)
  const best = r.bestGame
  const honors = awardRows(v, pos, userName, true).filter(x => x.state)
  const shareCard = useMemo(() => {
    const t = c.totals?.full ?? {}
    const stats = pos === 'qb' ? [[n(t.seasonPassYds), 'YDS'], [n(t.seasonTDs), 'TD'], [n(t.seasonINTs), 'INT']]
      : pos === 'rb' ? [[n(t.seasonRushYds), 'RUSH YDS'], [n((t.seasonRushTDs ?? 0) + (t.seasonRecTDs ?? 0)), 'TD'], [f1(t.seasonYPC), 'YPC']]
      : [[n(t.seasonRecs), 'REC'], [n(t.seasonRecYds), 'YDS'], [n(t.seasonRecTDs), 'TD']]
    return {
      sport: 'nfl', name: userName || 'Guest',
      tag: [CFB_POS[pos].label, 'COLLEGE FOOTBALL'].join('  ·  '),
      hero: { value: r.ovr ?? '–', label: 'OVR' },
      sub: archetype && !/remaining$/.test(archetype) ? archetype : null,
      record: v.record, headline: v.headline.toUpperCase().replace(/ — /, ' · '),
      tier: v.champs ? 'champ' : c.cfpSeed ? 'playoffs' : 'miss',
      ribbons: [v.champs && 'NATIONAL CHAMPS', c.awards?.heisman?.userWon && 'HEISMAN'].filter(Boolean),
      team: { name: v.team.school ?? v.team.name, short: v.team.short, color: v.team.color, color2: v.team.color2, logo: cfbLogo(v.team.short) },
      stats: stats.map(([x, k]) => ({ v: x, k })),
      chips: rows.map(x => ({ label: x.label, name: x.data?.qbFull || x.data?.qb, photo: x.data?.photo, val: x.val })),
    }
  }, [r, v, c, pos, userName, archetype, rows.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const d = c.draft
  const school = v.school(v.team.short)
  return (
    <div className="simp-screen">
      {rewards && <SeasonRewards result={r} />}
      {story && <SeasonStory story={story} pos={pos} sport="nfl" name={userName} />}
      <div className={`simp-final-banner ${tier}`}>
        <div className="sfb-outcome">{v.headline}</div>
        <div className="sfb-sub">{subBits.join(' · ')}</div>
        {seasonNote && <div className="sfb-sub cfbp-banner-note">{seasonNote}</div>}
      </div>
      <ShareSeasonButton card={shareCard} />
      <SeasonLine totals={full} pos={pos} sub={`${userName} · ${v.post.length ? 'WITH THE POSTSEASON' : 'FULL SEASON'}`} />
      {v.post.length > 0 && <PlayoffLog title="Postseason Game Log" rounds={logRows(v.post, v)} />}
      <Figure pos={pos} build={build} team={v.team} />
      {honors.length > 0 && (
        <section className="cfbp-sec">
          <Hd sub={userName}>HONORS</Hd>
          <AwardList rows={honors} />
        </section>
      )}
      <Poll ranks={v.ranks} final />
      <BoxLog games={[...v.reg, ...v.post]} v={v} pos={pos} totals={full} userName={userName} sub={`${userName} · EVERY GAME`} />
      {rows.length > 0 && (
        <div className="simp-stat-section">
          <div className="simp-stat-group-lbl"><NameTag name={userName} self />'s Build</div>
          <BuildRows rows={rows} small />
        </div>
      )}
      {best && (
        <div className="simp-best-game">
          <div className="simp-section-lbl">Best Game</div>
          <div className="simp-best-body">
            <span className="sbg-week">Wk {weekNo(best.meta?.label ?? best.wk)}</span>
            <span className="sbg-opp">{best.home || best.neutral ? 'vs' : '@'} {v.school(best.oppShort)}</span>
            <span className="sbg-line">{gameLine(best, pos)}</span>
          </div>
        </div>
      )}
      {endActions ?? (
        <section className="cfbp-sec cfbp-next">
          <Hd sub={d ? `DRAFT STOCK · ${projText(d).toUpperCase()}` : null}>WHAT'S NEXT</Hd>
          <div className="simp-final-actions">
            <button className="simp-cta" onClick={() => { sfx('tap'); onDraft?.() }}>Enter the NFL Draft</button>
            {onReturn && <button className="simp-ghost" onClick={() => { sfx('tap'); onReturn() }}>Return to {school}</button>}
            {onTransfer && <button className="simp-ghost" onClick={() => { sfx('tap'); onTransfer() }}>Transfer</button>}
            <button className="simp-ghost" onClick={() => { sfx('tap'); onAgain?.() }}>New {CFB_POS[pos].label} Build</button>
          </div>
        </section>
      )}
      {/* the 32-0 cross-promo stays on the website, not in the app (football's final report) */}
      {!IS_APP && <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>
          If you are enjoying Build-A-Player, check out my college basketball game —{' '}
          <a href="https://32-0game.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>32-0game.com</a>
        </span>
        <a href="https://32-0game.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <img src="/32-0logocutout.png" alt="32-0" style={{ height: '32px', width: 'auto', background: 'white', borderRadius: '5px', padding: '2px 6px', display: 'block' }} />
        </a>
      </div>}
    </div>
  )
}

// ── the page ────────────────────────────────────────────────────────────────
// A saved stage: a page id ('pre' … 'final'), or an older save's number (0 the regular season, 1 the title game,
// 2 selection day, 3 the postseason, 4 the awards, 5 draft stock)
const OLD_STAGE = ['reg', 'ccg', 'sel', 'post', 'awards', 'draft']
function pageFrom(stage, pages) {
  let id = typeof stage === 'string' ? stage : typeof stage === 'number' ? (OLD_STAGE[Math.max(0, Math.min(5, Math.floor(stage)))] ?? 'reg') : pages[0]
  if (!pages.includes(id)) id = id === 'ccg' ? 'sel' : id === 'pre' ? 'reg' : pages[0]
  return id
}

// (photoOf(name, school): a real player's headshot, for the Heisman ceremony. onReturn / onTransfer: College Football
// mode's other ways on from a season (another year at the school, or at a new one); seasonNote: which season of his
// this is, when it isn't the first. A Career's college seasons: endActions in place of the mode's own buttons,
// roleNote beside his name, userYear his class (the mode's build has none), season the year on the graphic,
// rewards false when the season isn't booked here, no build: no pre-season page)
export default function CFBSimPage({ result: r, pos, userName, teams, archetype, build = null, types = null, attrMap = null, nav = null, story: storyIn = null, onStory, photoOf = null,
  stage: stageIn = 0, onStage, onAgain, onDraft, onReturn = null, onTransfer = null, onHome, endActions = null, roleNote = null, seasonNote = null, userYear = null, season = null, rewards = true }) {
  const v = useMemo(() => ({ ...view(r, teams), userName }), [r, teams, userName])
  const titleWeek = !!(v.ccg || v.c.myStanding?.title)
  const pages = useMemo(() => [build ? 'pre' : null, 'reg', titleWeek ? 'ccg' : null, 'sel', 'post', 'awards', 'draft', 'final'].filter(Boolean), [build, titleWeek])
  const [page, setPage] = useState(() => pageFrom(stageIn, pages))
  // the page came up from its button (play it live) or from a save (show it played out). The regular season from
  // an older save's 0 (or a Career's first look, which starts there) plays live, as it always did
  const [fresh, setFresh] = useState(() => (typeof stageIn !== 'string' && pageFrom(stageIn, pages) === 'reg' ? 'reg' : null))
  const [story, setStory] = useState(storyIn)
  const [weeks, setWeeks] = useState(page === 'reg' ? 0 : v.reg.length)
  const tapGuard = useTapGuard()
  const idx = pages.indexOf(page)
  useRailOn(page)   // each page of the season brings the bottom rail back (football's)
  const season_ = season ?? r.year ?? 2026
  const school = v.team.school ?? v.team.name

  const go = id => {
    tapGuard.mark()
    document.querySelector('.simp-page')?.scrollTo({ top: 0, behavior: 'instant' })
    window.scrollTo({ top: 0, behavior: 'instant' })
    sfx('tap')
    setFresh(id); setPage(id); onStage?.(id)
  }
  const after = id => pages[pages.indexOf(id) + 1]
  // a season opened from an older save's number (or a Career's first look) is saved by its page once the
  // regular season has played out, so coming back doesn't play it again
  useEffect(() => { if (page === 'reg' && weeks >= v.reg.length && typeof stageIn !== 'string') onStage?.('reg') }, [page, weeks]) // eslint-disable-line react-hooks/exhaustive-deps

  // the team card's line: the conference and where the poll has them
  const late = page === 'awards' || page === 'draft' || page === 'final'
  const polls = v.ranks.filter(p => !/^final/i.test(p.label))
  const apAt = page === 'pre' ? v.ranks[0]?.ap
    : page === 'reg' ? (() => { const sh = v.reg.slice(0, weeks); const lw = weekNo(sh[sh.length - 1]?.meta?.label ?? 'Preseason'); const ps = polls.filter(p => weekNo(p.label) <= (weeks ? lw + 1 : 0)); return ps[ps.length - 1]?.ap })()
    : late ? v.finalRank
    : polls[polls.length - 1]?.ap
  const apLine = apAt ? `${late ? 'FINAL AP' : 'AP'} NO. ${apAt}` : null
  const confShort = v.conf?.short ?? ''
  const team = v.team
  const regNext = pages.includes('ccg') ? (v.ccg ? `${confShort} Championship` : 'Championship Week') : 'Selection Day'
  const who = page === 'pre' ? seasonNote : [userName, CFB_POS[pos].label, roleNote ?? archetype ?? r.archetype].filter(Boolean).join(' · ')

  let el
  if (page === 'pre') el = <PrePage r={r} pos={pos} build={build} types={types} attrMap={attrMap} archetype={archetype} team={team} onNext={() => go('reg')} />
  else if (page === 'reg') el = <RegPage key="reg" r={r} v={v} pos={pos} userName={userName} live={fresh === 'reg'} nextLabel={regNext} onNext={() => go(after('reg'))} onWeeks={setWeeks} onStory={s => { setStory(s); onStory?.(s) }} />
  else if (page === 'ccg') el = <CcgPage key="ccg" v={v} pos={pos} live={fresh === 'ccg'} onNext={() => go('sel')} />
  else if (page === 'sel') el = <SelPage v={v} onNext={() => go('post')} />
  else if (page === 'post') el = <PostPage key="post" v={v} live={fresh === 'post'} onNext={() => go('awards')} />
  else if (page === 'awards') el = <AwardsPage key="awards" v={v} pos={pos} userName={userName} userYear={userYear} photoOf={photoOf} live={fresh === 'awards'} onNext={() => go('draft')} />
  else if (page === 'draft') el = <DraftPage r={r} v={v} pos={pos} userName={userName} userYear={userYear} attrMap={attrMap} onNext={() => go('final')} />
  else el = <FinalPage r={r} v={v} pos={pos} build={build} types={types} attrMap={attrMap} archetype={archetype ?? r.archetype} userName={userName} story={story} rewards={rewards} endActions={endActions} seasonNote={seasonNote} onDraft={onDraft} onAgain={onAgain} onReturn={onReturn} onTransfer={onTransfer} />

  return (
    <>
      {nav}
      <div className={`simp-page cfbp${nav ? '' : ' cfbp--dock'}${v.champs && late ? ' is-champ' : ''}`} style={{ '--team-color': team.color, '--team-color2': team.color2 }} onClickCapture={tapGuard.onClickCapture}>
        <div className="simp-col">
          {!nav && (
            <div className="cfbp-top">
              <span className="cfbs-top-brand">COLLEGE FOOTBALL <i>·</i> {season_} SEASON{r.sandbox ? <em> · SANDBOX</em> : null}</span>
              <button className="ag-round-btn" onClick={onHome} aria-label="Home"><IconClose size={16} /></button>
            </div>
          )}
          <div className="simp-top-bar">
            {(page === 'awards' || page === 'draft') && <button className="simp-back-btn" onClick={() => { const to = pages[idx - 1]; setFresh(null); setPage(to); onStage?.(to) }}>← Back</button>}
            <ProgressDots screen={idx} total={pages.length} />
          </div>
          <div className="simp-team-strip cfbp-strip">
            <div className="sts-top-row">
              <img src={team.logoDark ?? cfbLogoDark(team.short)} alt={team.short} className="sts-logo" onError={e => { if (!e.currentTarget.dataset.f) { e.currentTarget.dataset.f = 1; e.currentTarget.src = cfbLogo(team.short) } }} />
              <div className="sts-info">
                <div className="sts-name-wrap">
                  <span className="sts-city">{[confShort, apLine].filter(Boolean).join(' · ')}</span>
                  <span className="sts-nickname">{school}</span>
                </div>
                {who && <span className="cfbp-role">{who}</span>}
              </div>
              {(team.off != null || team.def != null) && (
                <div className="sts-grades">
                  {team.off != null && (
                    <div className="sts-grade-item">
                      <span className="sts-grade-key">OFF</span>
                      <div className="sts-grade-track"><div className="sts-grade-fill" style={{ width: `${team.off * 10}%` }} /></div>
                      <span className="sts-grade-badge">{offDefGrade(team.off)}</span>
                    </div>
                  )}
                  {team.def != null && (
                    <div className="sts-grade-item">
                      <span className="sts-grade-key">DEF</span>
                      <div className="sts-grade-track"><div className="sts-grade-fill" style={{ width: `${team.def * 10}%` }} /></div>
                      <span className="sts-grade-badge">{offDefGrade(team.def)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {el}
          <SiteFooter sport="nfl" />
        </div>
      </div>
    </>
  )
}
