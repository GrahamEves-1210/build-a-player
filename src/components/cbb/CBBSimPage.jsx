import { useEffect, useMemo, useRef, useState } from 'react'
import { IconClose } from '../app/icons'
import { NameTag } from '../app/NameTag'
import { SeasonRewards } from '../app/AppSeason'
import { Wire, Milestones } from '../app/AppSeasonPlus'
import { ShareSeasonButton } from '../app/SeasonShare'
import { Pulse, ProgressDots, SimLoading, LeadersBoard } from '../simFlow'
import { gradeColor, offDefGrade } from '../simParts'
import QBAvatar from '../QBAvatar'
import { BucketModelFigure } from '../BucketSimPage'
import SiteFooter from '../SiteFooter'
import { valToGrade } from '../../utils/simulation'
import { useCountUp } from '../../lib/useCountUp'
import { useTapGuard } from '../../lib/tapGuard'
import { userScrolling } from '../../lib/userScroll'
import { useRailOn } from '../../lib/ads'
import { sfx } from '../../lib/juice'
import { cbbLogo, cbbLogoDark, logoKey, CBB_POS, pickOf, projText, finishOf } from './cbbShared'

// ── College Basketball: the season ──────────────────────────────────────────
// A college basketball season, a page a stage: College Football's season page (components/cfb/CFBSimPage.jsx: the
// dot pager, the team card, the live record, the pinned button, the round strip with live games, the ceremony,
// the scouting report, the final report, the same navy broadcast package), with college basketball's own content:
//   pre     PRE-SEASON: the OVR, the archetype, SIMULATE SEASON, the figure in school colours, the build
//   reg     REGULAR SEASON: live, game by game (record, pulse, wire, milestones, the schedule with rankings, the AP
//           poll), then his season line, the national scoring leaders, the key games, his game log, the standings
//   conf    CONFERENCE TOURNAMENT: his games live on the scoreboard, then the league's whole bracket
//   sel     SELECTION SUNDAY: his seed and region (or the NIT, or nothing), the 68 by region, the bubble, the AP's last poll
//   post    THE NCAA TOURNAMENT (or the NIT): the round strip, each of his games live, the bracket region by region
//   awards  THE WOODEN AWARD: the ceremony (the finalists, the ballots counted, the winner), then the season's awards
//   draft   NBA DRAFT STOCK: a scouting report (the projection in rounds and picks, his place on the board at his
//           position, what scouts like and question, the board)
//   final   FINAL REPORT: rewards, the result, share, his season line, the postseason, the poll, every game, honors,
//           the build, and what's next
// The player is the username (or Guest), never "you". Reduce Motion: no live reveal, no live games, no count.
// (reads runCBBSimulation's result, utils/cbbSimulation.js: result.cbb. view() gathers it)

const reduced = () => document.documentElement.classList.contains('bap-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const n = v => (v == null || Number.isNaN(+v) ? '–' : Math.round(+v).toLocaleString())
const f1 = v => (v == null || Number.isNaN(+v) ? '–' : (+v).toFixed(1))
const ordinal = k => `${k}${(k % 100 > 10 && k % 100 < 14) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[k % 10] ?? 'th'}`
const NCAA_ROUNDS = ['First Four', 'First Round', 'Second Round', 'Sweet 16', 'Elite Eight', 'Final Four', 'National Championship']
const isNcaa = g => g.event === 'NCAA Tournament'
const isNit = g => g.event === 'NIT'
const pollShort = label => (/^pre/i.test(label) ? 'PRE' : /^final/i.test(label) ? 'FINAL' : `W${String(label).replace(/\D+/g, '')}`)

function view(r, teams) {
  const c = r.cbb ?? {}
  const team = r.team ?? {}
  const T = short => teams[short] ?? { short, name: short, school: null }
  const names = Object.fromEntries((c.ncaa?.field ?? []).map(f => [f.short, f.short]))
  const school = short => T(short).school ?? names[short] ?? short
  const reg = (r.games ?? []).map(g => ({ ...g, post: false }))
  const post = (c.postseason ?? []).map(g => ({ ...g, post: true }))
  const confGames = post.filter(g => !isNcaa(g) && !isNit(g))
  const ncaaGames = post.filter(isNcaa), nitGames = post.filter(isNit)
  const ranks = (c.apPath ?? []).map(p => ({ label: p.label, ap: p.rank ?? null, rec: p.rec }))
  const finalRank = ranks.length ? ranks[ranks.length - 1].ap : null
  const champs = !!r.champion
  const x = c.ncaa?.exit
  const headline = champs ? 'National Champions'
    : c.ncaa?.seed ? (x === 'National Championship' ? 'Lost the National Championship' : x === 'Final Four' ? 'Final Four' : `NCAA Tournament — ${x === 'First Four' ? 'First Four' : x === 'First Round' ? 'First Round' : x}`)
    : c.nit ? (c.nit.won ? 'NIT Champions' : 'NIT')
    : 'No Postseason'
  return { c, team, T, school, conf: c.conf ?? null, reg, post, confGames, ncaaGames, nitGames, ranks, finalRank, champs, headline, record: c.record?.final ?? `${r.wins}-${r.losses}` }
}

const Hd = ({ children, sub }) => (
  <div className="cfbs-hd"><h2>{children}</h2>{sub && <small>{sub}</small>}<i aria-hidden="true" /></div>
)
const Logo = ({ short, size = 28, light = false }) => (
  <img className="cfbs-logo" src={light ? cbbLogo(short) : cbbLogoDark(short)} alt="" width={size} height={size} loading="lazy" draggable={false}
    onError={e => { if (!light && !e.currentTarget.dataset.f) { e.currentTarget.dataset.f = 1; e.currentTarget.src = cbbLogo(short) } else e.currentTarget.style.visibility = 'hidden' }} />
)
const gameLine = g => (g.min == null ? '' : `${g.pts} pts, ${g.reb} reb, ${g.ast} ast${g.stl >= 3 ? `, ${g.stl} stl` : ''}${g.blk >= 3 ? `, ${g.blk} blk` : ''}`)
const roundName = g => (isNcaa(g) ? (g.round === 'National Championship' ? 'National Championship' : `NCAA ${g.round}`) : isNit(g) ? g.round : `${g.event} · ${g.round}`)
const postTag = g => (isNcaa(g) ? ({ 'First Four': 'FIRST 4', 'First Round': 'NCAA R64', 'Second Round': 'NCAA R32', 'Sweet 16': 'SWEET 16', 'Elite Eight': 'ELITE 8', 'Final Four': 'FINAL 4', 'National Championship': 'TITLE' })[g.round] : isNit(g) ? 'NIT' : 'CONF T')

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
            {(i === 0 || i === pts.length - 1 || i % 4 === 0) && <text x={px} y={H + 10} className="cfbs-rank-wk">{pollShort(ranks[i].label)}</text>}
          </g>
        ))}
      </svg>
    </div>
  )
}
function Poll({ ranks, final = false }) {
  const now = ranks[ranks.length - 1]?.ap ?? null
  return (
    <section className="cfbp-sec">
      <Hd sub={now ? `${final ? 'FINAL · ' : ''}NO. ${now}` : final ? 'FINAL · UNRANKED' : 'UNRANKED'}>AP TOP 25</Hd>
      <RankPath ranks={ranks} />
    </section>
  )
}

// ── his season, as the graphic puts it up ──
const statLine = t => (!t ? [] : [['PPG', f1(t.ppg)], ['RPG', f1(t.rpg)], ['APG', f1(t.apg)], ['FG%', f1(t.fgPct)], ['3P%', f1(t.tpPct)]])
function SeasonLine({ totals, sub }) {
  const line = statLine(totals)
  const more = totals ? [['GP', n(totals.gp)], ['SPG', f1(totals.spg)], ['BPG', f1(totals.bpg)], ['FT%', f1(totals.ftPct)], ['HIGH', n(totals.high)]] : []
  return (
    <section className="cfbp-sec">
      <Hd sub={sub}>SEASON LINE</Hd>
      <div className="cfbs-stats" style={{ '--n': line.length }}>{line.map(([k, val]) => <div key={k}><b>{val}</b><small>{k}</small></div>)}</div>
      <div className="cfbs-stats cbbs-stats2" style={{ '--n': more.length }}>{more.map(([k, val]) => <div key={k}><b>{val}</b><small>{k}</small></div>)}</div>
    </section>
  )
}

// ── the schedule: a row a game, the school's logo, its ranking at tip-off, the score, his line ──
function GameRow({ g, v }) {
  return (
    <li className={`cfbs-game${g.won ? ' is-w' : ' is-l'}${g.post ? ' is-post' : ''}`}>
      <span className="cfbs-game-wk">{g.post ? postTag(g) : <>GM {g.g}<small>{g.meta?.date}</small></>}</span>
      <span className="cfbs-game-opp">
        <small>{g.neutral ? 'N' : g.home ? 'VS' : '@'}</small>
        <Logo short={g.oppShort} size={24} />
        <b>{(g.post && g.oppSeed ? g.oppSeed : g.meta?.oppRank) ? <em>{g.post && g.oppSeed ? g.oppSeed : g.meta.oppRank}</em> : null}{g.opponent}</b>
        {!g.post && g.confGame && <i className="cfbs-game-conf">CONF</i>}
      </span>
      <span className="cfbs-game-sc"><b>{g.won ? 'W' : 'L'}</b><span>{g.mySc}-{g.oppSc}{g.ot ? <small> {g.ot > 1 ? `${g.ot}OT` : 'OT'}</small> : null}</span></span>
      <span className="cfbs-game-line">{gameLine(g)}</span>
    </li>
  )
}
function Schedule({ v, shown, open }) {
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
        {v.reg.map((g, i) => (i < shown ? <GameRow key={i} g={g} v={v} /> : (
          <li key={i} className="cfbs-game is-up">
            <span className="cfbs-game-wk">GM {g.g}<small>{g.meta?.date}</small></span>
            <span className="cfbs-game-opp"><small>{g.neutral ? 'N' : g.home ? 'VS' : '@'}</small><Logo short={g.oppShort} size={24} /><b>{g.opponent}</b></span>
            <span className="cfbs-game-sc" />
            <span className="cfbs-game-line">{g.confGame ? `${v.conf?.short ?? 'Conference'} game` : g.meta?.event ?? 'Non-conference'}</span>
          </li>
        )))}
      </ol>
    </section>
  )
}

// ── the games that made the regular season ──
function KeyGames({ games }) {
  const wins = games.filter(g => g.won), losses = games.filter(g => !g.won)
  const big = wins.filter(g => g.meta?.oppRank).sort((a, b) => a.meta.oppRank - b.meta.oppRank)[0] ?? wins.slice().sort((a, b) => (b.mySc - b.oppSc) - (a.mySc - a.oppSc))[0]
  const tough = losses.slice().sort((a, b) => (a.oppSc - a.mySc) - (b.oppSc - b.mySc))[0]
  const val = g => (g.pts ?? 0) + (g.reb ?? 0) + (g.ast ?? 0)
  const best = games.slice().sort((a, b) => val(b) - val(a)).find(g => g !== big && g !== tough)
  const cards = [big && { k: 'BIGGEST WIN', g: big }, tough && { k: tough.oppSc - tough.mySc <= 4 ? 'ONE THAT GOT AWAY' : 'TOUGHEST LOSS', g: tough }, best && { k: 'HIS BEST GAME', g: best }].filter(Boolean)
  if (!cards.length) return null
  return (
    <section className="cfbp-sec">
      <Hd>KEY GAMES</Hd>
      <div className="cfbs-keys">
        {cards.map(({ k, g }) => (
          <div key={k} className={`cfbs-key${g.won ? '' : ' is-l'}`}>
            <small>{k} · {g.meta?.date}</small>
            <span className="cfbs-key-opp"><Logo short={g.oppShort} size={30} /><b>{g.meta?.oppRank ? <em>{g.meta.oppRank}</em> : null}{g.opponent}</b><strong>{g.won ? 'W' : 'L'} {g.mySc}-{g.oppSc}</strong></span>
            <span className="cfbs-key-line">{gameLine(g)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── his game log: the box score line, game by game, with the totals ──
const LOG = [['MIN', g => n(g.min)], ['PTS', g => n(g.pts)], ['REB', g => n(g.reb)], ['AST', g => n(g.ast)], ['STL', g => n(g.stl)], ['BLK', g => n(g.blk)], ['FG', g => `${g.fgm}-${g.fga}`], ['3PT', g => `${g.tpm}-${g.tpa}`], ['FT', g => `${g.ftm}-${g.fta}`]]
function BoxLog({ games, totals, userName, sub = null }) {
  const tot = totals ? [f1(totals.mpg), f1(totals.ppg), f1(totals.rpg), f1(totals.apg), f1(totals.spg), f1(totals.bpg), `${f1(totals.fgPct)}%`, `${f1(totals.tpPct)}%`, `${f1(totals.ftPct)}%`] : null
  return (
    <section className="cfbp-sec">
      <Hd sub={sub ?? userName}>GAME LOG</Hd>
      <div className="cfbs-log-scroll">
        <table className="cfbs-log">
          <thead><tr><th className="is-l">GM</th><th className="is-l">OPP</th><th>RES</th>{LOG.map(([k]) => <th key={k}>{k}</th>)}</tr></thead>
          <tbody>
            {games.map((g, i) => (
              <tr key={i} className={g.won ? '' : 'is-l'}>
                <td className="is-l">{g.post ? (isNcaa(g) ? 'NCAA' : isNit(g) ? 'NIT' : 'CT') : g.g}</td>
                <td className="is-l">{g.neutral ? 'n ' : g.home ? '' : '@'}{g.oppShort}</td>
                <td>{g.won ? 'W' : 'L'} {g.mySc}-{g.oppSc}</td>
                {LOG.map(([k, f]) => <td key={k}>{f(g)}</td>)}
              </tr>
            ))}
          </tbody>
          {tot && <tfoot><tr><td className="is-l" colSpan={3}>PER GAME</td>{tot.map((x, i) => <td key={i}>{x}</td>)}</tr></tfoot>}
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
// the conference table: conference record, the overall record, the AP ranking
function ConfTable({ v }) {
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
            <td className="is-team"><div className="cfbs-tc"><Logo short={x.short} size={20} /><span>{x.ap ? <em>{x.ap}</em> : null}{v.school(x.short)}</span>{s.champions?.includes(x.short) && <i className="cfbs-champ">CHAMP</i>}</div></td>
            <td>{x.confW}-{x.confL}</td>
            <td>{x.w}-{x.l}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
// a bracket as columns of games (a conference tournament, a region). through / scoresThrough: while he's still
// playing it only shows what has happened
function Bracket({ v, rounds, through = 99, scoresThrough = 99 }) {
  const me = v.team.short
  return (
    <div className="cfbs-bracket-scroll">
      <div className="cfbs-bracket cbbs-bracket" style={{ '--rounds': rounds.length }}>
        {rounds.map((r, ri) => (
          <div key={r.name} className="cfbs-round">
            <h3>{String(r.name).toUpperCase()}</h3>
            <div className="cfbs-round-games">
              {r.games.map((g, i) => {
                if (ri > through) return <div key={i} className="cfbs-bgame is-tbd"><div className="cfbs-mrow"><span>TBD</span><b /></div><div className="cfbs-mrow"><span>TBD</span><b /></div></div>
                const res = ri <= scoresThrough
                return (
                  <div key={i} className={`cfbs-bgame${g.a === me || g.b === me ? ' is-me' : ''}`}>
                    <MatchRow short={g.a} name={v.school(g.a)} seed={g.aSeed} sc={res ? g.aSc : null} win={res && g.winner === g.a} me={g.a === me} />
                    <MatchRow short={g.b} name={v.school(g.b)} seed={g.bSeed} sc={res ? g.bSc : null} win={res && g.winner === g.b} me={g.b === me} />
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
// The NCAA Tournament, region by region (tabs: his region first), then the Final Four. roundAt: the last round
// with its matchups set (an index in NCAA_ROUNDS); scoresAt: the last with its results in
const REGION_ROUNDS = ['First Round', 'Second Round', 'Sweet 16', 'Elite Eight']
function NcaaBracket({ v, roundAt = 99, scoresAt = 99 }) {
  const p = v.c.ncaa
  const mine = p?.region ?? p?.regions?.[0]
  const [tab, setTab] = useState(mine)
  if (!p?.games?.length) return null
  const g2 = g => ({ a: g.hi, b: g.lo, aSeed: g.hiSeed, bSeed: g.loSeed, aSc: g.hiSc, bSc: g.loSc, winner: g.winner })
  const tabs = [...p.regions, 'Final Four']
  const regionRounds = reg => REGION_ROUNDS.map(name => ({ name, games: p.games.filter(g => g.region === reg && g.round === name).map(g2) }))
  const ffRounds = [{ name: 'Final Four', games: p.games.filter(g => g.round === 'Final Four').map(g2) }, { name: 'National Championship', games: p.games.filter(g => g.round === 'National Championship').map(g2) }]
  const ff = p.games.filter(g => g.round === 'First Four')
  return (
    <>
      <div className="cbbs-tabs" role="tablist" aria-label="Regions">
        {tabs.map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => { setTab(t); sfx('tap') }}>{t.toUpperCase()}{t === mine ? <i /> : null}</button>)}
      </div>
      {tab === 'Final Four'
        ? <Bracket v={v} rounds={ffRounds} through={roundAt - 5} scoresThrough={scoresAt - 5} />
        : <Bracket v={v} rounds={regionRounds(tab)} through={roundAt - 1} scoresThrough={scoresAt - 1} />}
      {tab !== 'Final Four' && ff.some(g => g.region === tab) && (
        <div className="cbbs-ff">
          <small>FIRST FOUR · DAYTON</small>
          {ff.filter(g => g.region === tab).map((g, i) => (
            <div key={i} className={`cfbs-bgame${g.hi === v.team.short || g.lo === v.team.short ? ' is-me' : ''}`}>
              <MatchRow short={g.hi} name={v.school(g.hi)} seed={g.hiSeed} sc={scoresAt >= 0 ? g.hiSc : null} win={scoresAt >= 0 && g.winner === g.hi} me={g.hi === v.team.short} />
              <MatchRow short={g.lo} name={v.school(g.lo)} seed={g.loSeed} sc={scoresAt >= 0 ? g.loSc : null} win={scoresAt >= 0 && g.winner === g.lo} me={g.lo === v.team.short} />
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ── a game live on the scoreboard: two halves, each basket as it lands (basketball's playoff scoreboard, college's clock) ──
const lum = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? ''); if (!m) return 0.5; const x = parseInt(m[1], 16); return (0.2126 * (x >> 16) + 0.7152 * ((x >> 8) & 255) + 0.0722 * (x & 255)) / 255 }
const onDark = t => { const a = t.color ?? '#0a3d91', b = t.color2; return lum(a) < 0.22 && b && lum(b) > lum(a) && lum(b) < 0.95 ? b : lum(a) < 0.22 ? '#4f8fe8' : a }
function timeline(my, opp) {
  const plays = (total, team) => { const out = []; let rem = total; while (rem > 0) { const p = rem >= 3 && Math.random() < 0.3 ? 3 : rem >= 2 ? 2 : 1; out.push({ team, pts: p }); rem -= p } return out }
  const all = [...plays(my, 'me'), ...plays(opp, 'opp')]
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]] }
  const step = 2400 / Math.max(1, all.length)
  return all.map((e, i) => ({ ...e, at: Math.round(step * i + Math.random() * step * 0.7 + 8) })).sort((a, b) => a.at - b.at)
}
function LiveGame({ v, g, onDone }) {
  const TICKS = 50
  const [phase, setPhase] = useState('pre')
  const [sec, setSec] = useState(0)
  const [sc, setSc] = useState([0, 0])
  const [events] = useState(() => timeline(g.mySc, g.oppSc))
  useEffect(() => {
    let t = 0, k = 0, my = 0, opp = 0, iv = null, end = null
    const pre = setTimeout(() => {
      setPhase('live')
      iv = setInterval(() => {
        t++
        const s = Math.min(2399, Math.round((t / TICKS) * 2400))
        while (k < events.length && events[k].at <= s) { if (events[k].team === 'me') my += events[k].pts; else opp += events[k].pts; k++ }
        setSec(s); setSc([my, opp])
        if (t >= TICKS) { clearInterval(iv); setSc([g.mySc, g.oppSc]); setPhase('post'); end = setTimeout(onDone, 1260) }
      }, 50)
    }, 600)
    return () => { clearTimeout(pre); clearInterval(iv); clearTimeout(end) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const half = sec < 1200 ? 0 : 1, left = 1200 - (sec % 1200)
  const me = { short: v.team.short, color: onDark(v.team), seed: g.mySeed, sc: sc[0] }
  const op = { short: g.oppShort, color: onDark(v.T(g.oppShort)), seed: g.oppSeed, sc: sc[1] }
  const [L, R] = g.home && !g.neutral ? [op, me] : [me, op]
  const Side = ({ x, right }) => (
    <div className={`plf-score-side${right ? ' plf-score-opp' : ''}`}>
      <img src={cbbLogo(x.short)} alt={x.short} className="plf-team-logo-img" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
      <div className="plf-team-abbr" style={{ color: x.color }}>{x.short}</div>
      {x.seed && <div className="plf-team-seed">#{x.seed}</div>}
      <div className="plf-score-num" style={{ color: x.color }}><span key={phase === 'post' ? 'f' : x.sc} className={phase === 'post' ? '' : 'plf-num-pop'}>{x.sc}</span></div>
    </div>
  )
  return (
    <div className={`plf-game${phase === 'post' ? (g.won ? ' plf-game-won' : ' plf-game-lost') : ''}`}>
      <div className="plf-round-row"><div className="plf-round-lbl">{roundName(g)}{g.site ? ` · ${g.site}` : ''}</div></div>
      <div className="plf-scoreboard">
        <Side x={L} />
        <div className="plf-score-mid">
          <span className="plf-at-sym">{g.neutral ? 'vs' : '@'}</span>
          {phase === 'live' ? <div className="plf-live-pill"><span className="plf-live-dot" />LIVE</div> : phase === 'post' ? <div className={`plf-result-badge ${g.won ? 'plf-rb-win' : 'plf-rb-loss'}`}>{g.won ? 'W' : 'L'}</div> : null}
        </div>
        <Side x={R} right />
      </div>
      <div className="plf-live-area" style={{ visibility: phase === 'live' ? 'visible' : 'hidden' }}>
        <div className="plf-status-row">
          <div className="plf-qtr-dots">{[0, 1].map(i => <div key={i} className={`plf-qtr-dot${i < half ? ' plf-qd-done' : i === half ? ' plf-qd-active' : ''}`} />)}</div>
          <div className="plf-clock-box"><span className="plf-qtr-lbl">{half ? '2ND HALF' : '1ST HALF'}</span><span className="plf-clk-sep">·</span><span className="plf-clock-time">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span></div>
        </div>
        <div className="plf-progress"><div className="plf-progress-fill" style={{ width: `${(sec / 2399) * 100}%` }} /></div>
      </div>
      <div className={`plf-post-line ${g.won ? 'plf-pl-won' : 'plf-pl-lost'}`} style={{ visibility: phase === 'post' ? 'visible' : 'hidden' }}>
        <span>{g.won ? '✓ Won' : '✗ Lost'}{g.ot ? ` in ${g.ot > 1 ? `${g.ot} overtimes` : 'overtime'}` : ''}</span>
        <span className="plf-post-score">{g.mySc} – {g.oppSc}</span>
      </div>
    </div>
  )
}
// his postseason games, as a log under the scoreboard
function PostLog({ title, games }) {
  if (!games.length) return null
  return (
    <section className="cfbp-sec">
      <Hd>{title.toUpperCase()}</Hd>
      <ol className="cfbs-sched is-open">{games.map((g, i) => <GameRow key={i} g={g} />)}</ol>
    </section>
  )
}
// a run of games played live, one after another, until he loses or the run ends (the conference tournament, the
// NCAA Tournament, the NIT). render({ gameIdx, status ('playing' | 'between' | 'out' | 'won'), started, cur })
function useRun(games, live) {
  const lastI = games.length - 1
  const play = live && !reduced() && games.length > 0
  const end = () => (games[lastI]?.won ? 'won' : 'out')
  const [gameIdx, setGameIdx] = useState(play ? 0 : Math.max(0, lastI))
  const [status, setStatus] = useState(play ? 'playing' : games.length ? end() : 'none')
  const [started, setStarted] = useState(!play)
  const timer = useRef(null)
  useEffect(() => { if (!play) return; const t = setTimeout(() => setStarted(true), 500); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), [])
  const done = () => {
    const g = games[gameIdx]
    if (!g.won) { setStatus('out'); return }
    if (gameIdx === lastI) { setStatus('won'); return }
    setStatus('between')
    timer.current = setTimeout(() => { setGameIdx(i => i + 1); setStatus('playing') }, 2200)
  }
  return { gameIdx, status, started, cur: games[gameIdx], done, ended: status === 'out' || status === 'won' || status === 'none', shown: games.slice(0, status === 'playing' ? gameIdx : gameIdx + 1) }
}
const Between = ({ cur, next }) => (
  <div className="plf-between-screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
    <div className="plf-bw-result"><span className="plf-bw-w">W</span><span className="plf-bw-score">{cur.mySc}–{cur.oppSc}{cur.ot ? ' OT' : ''}</span></div>
    <div className="plf-bw-adv">Advancing…</div>
    {next && <div className="plf-bw-next">Next up · {next.round}</div>}
  </div>
)
const Center = ({ children }) => <div className="simp-screen-center cfbp-end" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>{children}</div>

// ── the figure in school colours, the build as rows ──
function Figure({ build, team }) {
  if (!build || !team) return null
  // (the word across the chest is the school he plays for, whoever the chips came from)
  const worn = Object.fromEntries(Object.entries(build).map(([k, x]) => [k, x ? { ...x, jerseyWord: String(team.school ?? team.short).toUpperCase() } : x]))
  return <BucketModelFigure build={worn} team={{ color: team.color, color2: team.color2, short: logoKey(team.short) }} className="cbbp-figure" />
}
const rowsOf = (build, types, attrMap) => (build && types ? types.filter(t => build[t]).map(t => ({ key: t, label: attrMap?.[t]?.label ?? t, data: build[t], val: build[t].val })) : [])
function BuildRows({ rows, small = false, visible = rows.length }) {
  return (
    <div className={`simp-attr-table${small ? ' simp-attr-table-sm' : ''}`}>
      {rows.map(({ key, label, data, val }, i) => (
        <div key={key} className={`simp-attr-row${i < visible ? ' simp-row-visible' : ''}`}>
          <QBAvatar photo={data.photo} team={data.team} color={data.teamColor} size={small ? 36 : 46} />
          <div className="simp-attr-info"><span className="simp-attr-name">{label}</span><span className="simp-attr-qb">{data.qbFull}</span></div>
          <span className="simp-grade-circle" style={{ background: gradeColor(val), color: '#07120a' }}>{valToGrade(val)}</span>
        </div>
      ))}
    </div>
  )
}

// ── PRE-SEASON ──────────────────────────────────────────────────────────────
function PrePage({ r, build, types, attrMap, archetype, team, onNext }) {
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
      <div className="simp-ovr-hero"><div className="simp-ovr-num">{ovr || '–'}</div><div className="simp-ovr-lbl">OVR</div></div>
      <div className="simp-archetype">{archetype ?? r.archetype}</div>
      <button className="simp-cta" onClick={onNext}>Simulate Season</button>
      <Figure build={build} team={team} />
      <BuildRows rows={rows} visible={vis} />
    </div>
  )
}

// ── REGULAR SEASON ──────────────────────────────────────────────────────────
function RegPage({ r, v, userName, live, onNext, onGames }) {
  const total = v.reg.length
  const run = live && !reduced()
  const [k, setK] = useState(run ? 0 : total)
  const [loading, setLoading] = useState(run)
  useEffect(() => { if (!run) return; const t = setTimeout(() => setLoading(false), 600); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!run || loading || k >= total) return
    const t = setTimeout(() => { setK(x => x + 1); sfx('tick') }, 230)
    return () => clearTimeout(t)
  }, [run, loading, k, total])
  useEffect(() => { onGames?.(k) }, [k]) // eslint-disable-line react-hooks/exhaustive-deps
  const done = k >= total
  const shown = v.reg.slice(0, k)
  const w = shown.filter(g => g.won).length, l = shown.length - w
  const day = shown.length ? shown[shown.length - 1].meta?.day ?? 0 : -1
  const polls = (v.c.ap ?? []).filter(p => !/^final/i.test(p.label) && (done || p.day <= day)).map(p => ({ label: p.label, ap: p.myRank ?? null }))
  const wire = (v.c.wire ?? []).filter(x => x.at <= k), miles = (v.c.milestones ?? []).filter(x => x.at <= k)
  const L = v.c.leaders
  if (loading) return <div className="simp-screen"><SimLoading /></div>
  return (
    <div className="simp-screen">
      <div className="simp-eyebrow">Regular Season</div>
      <div className="simp-live-record"><span className="slr-w">{w}</span><span className="slr-sep">–</span><span className="slr-l">{l}</span></div>
      <Pulse games={shown} total={total} playoffWins={20} />
      {run && <Wire items={wire} />}
      <Milestones items={miles} />
      <Schedule v={v} shown={k} open={done} />
      <Poll ranks={polls} />
      {done && (
        <>
          <SeasonLine totals={v.c.totals?.regular} sub={`${userName} · REGULAR SEASON`} />
          {L?.rows?.length > 0 && (
            <LeadersBoard title="NATIONAL LEADERS" label={L.label} rank={L.rank} who={userName}
              rows={L.rows.slice(0, 6).map((x, i) => ({ rank: i + 1, me: x.isUser, name: x.isUser ? <NameTag name={userName} self /> : x.name, team: x.team, value: f1(x.value) }))} />
          )}
          <KeyGames games={v.reg} />
          <section className="cfbp-sec">
            <Hd sub="REGULAR SEASON">{String(v.conf?.short ?? 'CONFERENCE').toUpperCase()} STANDINGS</Hd>
            <ConfTable v={v} />
          </section>
          <BoxLog games={v.reg} totals={v.c.totals?.regular} userName={userName} />
          <button className="simp-cta simp-cta-in simp-cta--pin" onClick={onNext}>{v.conf?.short ?? 'Conference'} Tournament</button>
        </>
      )}
    </div>
  )
}

// ── CONFERENCE TOURNAMENT ───────────────────────────────────────────────────
function ConfPage({ v, live, onNext }) {
  const t = v.c.confTourney
  const games = v.confGames
  const run = useRun(games, live)
  const me = v.team.short
  const title = t?.title ?? `${v.conf?.short ?? 'Conference'} Tournament`
  const place = (v.c.myStanding?.teams?.findIndex(x => x.short === me) ?? -1) + 1
  let inner
  if (!games.length) {
    inner = <Center><div className="simp-eyebrow">{title}</div><div className="plf-elim-title">{v.school(t?.champion)} wins the {v.conf?.short}</div><div className="plf-elim-round">{v.school(me)} finished {ordinal(place || 1)} and did not make the bracket</div><button className="simp-cta" onClick={onNext}>Selection Sunday</button></Center>
  } else if (run.status === 'won') {
    inner = <Center><div className="simp-eyebrow">{title}</div><div className="plf-champ-label">{v.conf?.short} Tournament Champions</div><div className="plf-champ-sub">{run.cur.mySc} – {run.cur.oppSc}{run.cur.ot ? ' OT' : ''} · vs {run.cur.opponent} · an automatic bid</div><button className="simp-cta simp-cta-in" onClick={onNext}>Selection Sunday</button></Center>
  } else if (run.status === 'out') {
    inner = <Center><div className="simp-eyebrow">{title}</div><div className="plf-elim-title">Out in the {run.cur.round === 'Championship' ? 'title game' : String(run.cur.round).toLowerCase()}</div><div className="plf-elim-score">{run.cur.mySc} – {run.cur.oppSc}{run.cur.ot ? ' OT' : ''} · vs {run.cur.opponent}</div><button className="simp-cta" onClick={onNext}>Selection Sunday</button></Center>
  } else if (run.status === 'between') inner = <Between cur={run.cur} next={games[run.gameIdx + 1]} />
  else inner = <><div className="simp-eyebrow">{title}{t?.seed ? ` · No. ${t.seed} seed` : ''}</div>{!run.started ? <SimLoading label="Championship week…" /> : <LiveGame key={run.gameIdx} v={v} g={run.cur} onDone={run.done} />}</>
  return (
    <div className="simp-screen">
      {inner}
      {run.started && <PostLog title="Tournament Game Log" games={run.shown} />}
      {run.ended && t?.rounds?.length > 0 && (
        <section className="cfbp-sec">
          <Hd sub={t.site ?? v.conf?.name}>{title.toUpperCase()}</Hd>
          <Bracket v={v} rounds={t.rounds} />
        </section>
      )}
      {!run.ended && (
        <section className="cfbp-sec">
          <Hd sub="REGULAR SEASON">{String(v.conf?.short ?? '').toUpperCase()} STANDINGS</Hd>
          <ConfTable v={v} />
        </section>
      )}
    </div>
  )
}

// ── SELECTION SUNDAY ────────────────────────────────────────────────────────
function SelPage({ v, onNext }) {
  const c = v.c, p = c.ncaa ?? {}
  const me = v.team.short
  const last = c.ap?.[c.ap.length - 1]
  const [tab, setTab] = useState(p.region ?? p.regions?.[0])
  const inField = !!p.seed
  const big = inField ? `No. ${p.seed} Seed` : c.nit ? 'NIT' : 'Season Over'
  const first = v.ncaaGames[0] ?? v.nitGames[0]
  const bubble = (p.firstFourOut ?? []).includes(me)
  return (
    <div className="simp-screen">
      <div className="simp-eyebrow">Selection Sunday</div>
      <div className="cfbp-sel-big">{big}</div>
      <p className="cfbs-note cfbp-sel-note">{inField
        ? <><b>{v.school(me)} is in: the No. {p.seed} seed in the {p.region}</b>, {p.bid === 'auto' ? `with the ${v.conf?.short} automatic bid` : 'an at-large bid'}.{first ? ` ${first.round === 'First Four' ? 'The First Four in Dayton is first' : 'The first round is next'}, against ${first.oppSeed ? `No. ${first.oppSeed} ` : ''}${first.opponent}.` : ''}</>
        : <><b>{v.school(me)} is out of the NCAA Tournament</b> at {c.record?.selection}{bubble ? ', one of the first four left out' : ''}.{c.nit ? ` The NIT called: a No. ${c.nit.seed} seed.` : ' No postseason.'}</>}</p>
      <section className="cfbp-sec">
        <Hd sub="68 TEAMS">THE FIELD</Hd>
        <div className="cbbs-tabs" role="tablist" aria-label="Regions">
          {(p.regions ?? []).map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => { setTab(t); sfx('tap') }}>{t.toUpperCase()}{t === p.region ? <i /> : null}</button>)}
        </div>
        <ol className="cfbs-field cbbs-field" aria-label={`${tab} region`}>
          {(p.field ?? []).filter(f => f.region === tab).map(f => (
            <li key={f.short} className={f.short === me ? 'is-me' : undefined}>
              <em>{f.seed}</em><Logo short={f.short} size={24} />
              <span><b>{v.school(f.short)}</b><small>{f.rec} · {f.conf}{f.firstFour ? ' · First Four' : ''}</small></span>
              <i className={f.bid === 'auto' ? 'is-auto' : ''}>{f.bid === 'auto' ? 'AUTO BID' : 'AT-LARGE'}</i>
            </li>
          ))}
        </ol>
      </section>
      <section className="cfbp-sec">
        <Hd>THE BUBBLE</Hd>
        <p className="cfbs-note"><b>Last four in:</b> {(p.lastFourIn ?? []).map(v.school).join(', ')}</p>
        <p className="cfbs-note"><b>First four out:</b> {(p.firstFourOut ?? []).map(v.school).join(', ')}</p>
      </section>
      {last && (
        <section className="cfbp-sec">
          <Hd sub="FINAL POLL">AP TOP 25</Hd>
          <ol className="cfbs-top25">
            {last.top25.map(t => <li key={t.short} className={t.short === me ? 'is-me' : undefined}><em>{t.rank}</em><Logo short={t.short} size={18} /><span>{v.school(t.short)}</span><small>{t.rec}</small></li>)}
          </ol>
        </section>
      )}
      <button className="simp-cta simp-cta-in simp-cta--pin" onClick={onNext}>{inField ? 'The NCAA Tournament' : c.nit ? 'Play the NIT' : 'The Tournament'}</button>
    </div>
  )
}

// ── THE NCAA TOURNAMENT (or the NIT) ────────────────────────────────────────
const STRIP = [['First Round', 'ROUND OF 64'], ['Second Round', 'ROUND OF 32'], ['Sweet 16', 'SWEET 16'], ['Elite Eight', 'ELITE 8'], ['Final Four', 'FINAL FOUR'], ['National Championship', 'TITLE GAME']]
function RoundStrip({ games, gameIdx, status }) {
  const ended = status === 'out' || status === 'won'
  return (
    <div className="ag-bracket cbbs-strip">
      {STRIP.map(([round, label], i) => {
        const ri = games.findIndex(g => g.round === round)
        const g = ri >= 0 ? games[ri] : null
        let state = 'pending'
        if (!g) state = ended ? 'out' : 'pending'
        else if (ri < gameIdx || (ri === gameIdx && (status === 'between' || status === 'won'))) state = g.won ? 'won' : 'lost'
        else if (ri === gameIdx && status === 'out') state = 'lost'
        else if (ri === gameIdx) state = 'live'
        return (
          <div key={round} className={`ag-bk is-${state}${round === 'National Championship' ? ' ag-bk--sb' : ''}`}>
            <span className="ag-bk-lbl">{label}</span>
            <span className="ag-bk-val">{state === 'won' || state === 'lost' ? `${g.mySc}-${g.oppSc}` : state === 'live' ? 'LIVE' : '—'}</span>
            {i < STRIP.length - 1 && <span className="ag-bk-link" />}
          </div>
        )
      })}
    </div>
  )
}
function PostPage({ v, live, onNext }) {
  const p = v.c.ncaa ?? {}
  const inField = !!p.seed
  const games = inField ? v.ncaaGames : v.nitGames
  const run = useRun(games, live)
  const fin = p.games?.find(g => g.round === 'National Championship')
  const title = fin && (
    <div className="cfbs-match cfbs-title">
      <div className="cfbs-match-hd"><b>NATIONAL CHAMPIONSHIP</b><small>Ford Field, Detroit · Apr 5</small></div>
      <MatchRow short={fin.hi} name={v.school(fin.hi)} seed={fin.hiSeed} sc={fin.hiSc} win={fin.winner === fin.hi} me={fin.hi === v.team.short} />
      <MatchRow short={fin.lo} name={v.school(fin.lo)} seed={fin.loSeed} sc={fin.loSc} win={fin.winner === fin.lo} me={fin.lo === v.team.short} />
      <div className="cfbs-match-foot">{String(v.school(fin.winner)).toUpperCase()} · NATIONAL CHAMPIONS</div>
    </div>
  )
  const whole = <section className="cfbp-sec"><Hd sub="68 TEAMS">THE BRACKET</Hd><NcaaBracket v={v} />{title}</section>
  if (!games.length) {
    return (
      <div className="simp-screen">
        <Center><div className="simp-eyebrow">The Tournament</div><div className="simp-miss-title">No Postseason</div><div className="plf-elim-round">{v.record}: left out of the NCAA Tournament and the NIT</div><button className="simp-cta" onClick={onNext}>The Wooden Award</button></Center>
        {whole}
      </div>
    )
  }
  const cur = run.cur
  let inner
  if (run.status === 'won') inner = <Center><div className="simp-eyebrow">{inField ? 'National Championship' : 'NIT'}</div><div className="plf-champ-label">{inField ? 'National Champions' : 'NIT Champions'}</div><div className="plf-champ-sub">{cur.mySc}–{cur.oppSc}{cur.ot ? ' OT' : ''} vs {cur.opponent}</div><button className="simp-cta simp-cta-in" onClick={onNext}>The Wooden Award</button></Center>
  else if (run.status === 'out') inner = <Center><div className="simp-eyebrow">Season Over</div><div className="plf-elim-title">{inField ? (cur.round === 'National Championship' ? 'Lost the Title Game' : `Out in the ${cur.round}`) : 'Out of the NIT'}</div><div className="plf-elim-score">{cur.mySc} – {cur.oppSc}{cur.ot ? ' OT' : ''} · vs {cur.oppSeed ? `No. ${cur.oppSeed} ` : ''}{cur.opponent}</div><button className="simp-cta" onClick={onNext}>The Wooden Award</button></Center>
  else if (run.status === 'between') inner = <Between cur={cur} next={games[run.gameIdx + 1]} />
  else inner = <><div className="simp-eyebrow">{inField ? `NCAA Tournament · No. ${p.seed} seed · ${p.region}` : 'NIT'}</div>{!run.started ? <SimLoading label={inField ? 'The Tournament tips off…' : 'The NIT…'} /> : <LiveGame key={run.gameIdx} v={v} g={cur} onDone={run.done} />}</>
  const ri = NCAA_ROUNDS.indexOf(cur?.round)
  return (
    <div className="simp-screen">
      {inField && <RoundStrip games={games} gameIdx={run.gameIdx} status={run.status} />}
      {inner}
      {run.started && <PostLog title={inField ? 'Tournament Game Log' : 'NIT Game Log'} games={run.shown} />}
      {run.ended ? whole : inField && run.started && (
        <section className="cfbp-sec"><Hd sub="68 TEAMS">THE BRACKET</Hd><NcaaBracket v={v} roundAt={ri} scoresAt={run.status === 'between' ? ri : ri - 1} /></section>
      )}
    </div>
  )
}

// ── THE WOODEN AWARD: the ceremony ──────────────────────────────────────────
// Two graphics, as the broadcast runs them (College Football's Heisman ceremony, for the Wooden): THE FINALISTS in
// alphabetical order, the ballots counted with every bar filling together, then THE VOTE in the order they finished
const lastName = s => String(s ?? '').trim().split(/\s+/).slice(-1)[0] ?? ''
function Face({ short, photo, color }) {
  const [on, setOn] = useState(false)
  return (
    <span className="cfbh-face" style={{ '--school': color ?? '#0a3d91' }}>
      <img className="cfbh-face-logo" src={cbbLogo(short)} alt="" draggable={false} onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
      {photo && <img className={`cfbh-face-photo${on ? ' is-on' : ''}`} src={photo} alt="" draggable={false} onLoad={() => setOn(true)} onError={e => { e.currentTarget.style.display = 'none' }} />}
    </span>
  )
}
function Wooden({ h, v, userName, userYear, photoOf, live, onDone }) {
  const quick = !live || reduced()
  const [phase, setPhase] = useState(quick ? 2 : 0)
  useEffect(() => {
    if (quick) { onDone?.(); return }
    const a = setTimeout(() => setPhase(1), 1500)
    const b = setTimeout(() => { setPhase(2); if (h?.userWon) sfx('complete', 2); onDone?.() }, 1500 + 2900)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
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
  if (!w) return <p className="cfbs-note">No Wooden Award vote this season.</p>
  const isWinner = f => (f.isUser && w.isUser) || (f.name === w.name && f.team === w.team)
  const nameOf = f => (f.isUser ? userName : f.name)
  const rows = phase === 2 ? fin : [...fin].sort((a, b) => lastName(nameOf(a)).localeCompare(lastName(nameOf(b))))
  const top = Math.max(1, ...fin.map(f => f.pts ?? 0))
  const cls = f => (f.isUser ? userYear : f.year)
  return (
    <div className={`cfbh${phase === 2 ? ' is-done' : ''}`}>
      <div className="cfbh-hd"><b>THE JOHN R. WOODEN AWARD</b><small>LOS ANGELES</small></div>
      <div className="cfbh-bar"><span>{phase === 0 ? 'THE FINALISTS' : phase === 1 ? 'COUNTING THE BALLOTS' : 'THE VOTE'}</span><small>{fin.length} FINALISTS · NATIONAL PLAYER OF THE YEAR</small></div>
      <p className="cfbh-call" aria-live="polite">{phase === 2
        ? <>The Wooden Award goes to <b>{nameOf(w)}</b>, {v.school(w.team)}.</>
        : phase === 1 ? 'The ballots are in.' : 'The five finalists, in Los Angeles for the presentation.'}</p>
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
        <p className="cfbh-me">{h.userPlace ? <><b>{userName}</b> finished {ordinal(h.userPlace)} in the voting.</> : <><b>{userName}</b> did not receive a Wooden vote.</>}</p>
      )}
    </div>
  )
}
function awardRows(v, userName, wooden = false) {
  const a = v.c.awards ?? {}
  const who = x => (x?.isUser ? userName : x ? `${x.name}, ${v.school(x.team)}` : '–')
  const rows = []
  const h = a.wooden
  if (wooden && h?.winner) rows.push({ name: 'Wooden Award', state: h.userWon ? 'WINNER' : h.userFinalist ? 'FINALIST' : h.userPlace ? `${ordinal(h.userPlace).toUpperCase()} IN THE VOTE` : null, won: !!h.userWon, sub: h.userWon ? null : `Won by ${who(h.winner)}` })
  for (const k of ['naismith', 'posAward', 'dpoy', 'freshman', 'mop']) {
    const x = a[k]
    if (!x?.winner) continue
    if (k === 'freshman' && v.c.user?.year !== 'FR') continue
    rows.push({ name: x.award, state: x.userWon ? 'WINNER' : x.userFinalist && k !== 'mop' ? 'FINALIST' : null, won: !!x.userWon, sub: x.userWon ? null : `Won by ${who(x.winner)}` })
  }
  rows.push({ name: 'All-American', state: a.allAmerica?.user ? `${a.allAmerica.user.toUpperCase()} TEAM` : null, won: a.allAmerica?.user === 'first' })
  const ac = a.allConference
  if (ac) rows.push({ name: `All-${ac.conf ?? v.conf?.short ?? 'Conference'}`, state: ac.user ? `${ac.user.toUpperCase()} TEAM` : null, won: ac.user === 'first' })
  if (a.confPOY?.winner) rows.push({ name: a.confPOY.award, state: a.confPOY.userWon ? 'WINNER' : null, won: !!a.confPOY.userWon, sub: a.confPOY.userWon ? null : `Won by ${who(a.confPOY.winner)}` })
  return rows
}
const AwardList = ({ rows }) => (
  <ul className="cfbs-awards">
    {rows.map(x => <li key={x.name} className={x.won ? 'is-won' : x.state ? 'is-part' : 'is-none'}><span>{x.name}{x.sub && <small>{x.sub}</small>}</span><b>{x.state ?? '–'}</b></li>)}
  </ul>
)
function AllAmerica({ v, userName }) {
  const aa = v.c.awards?.allAmerica
  if (!aa) return null
  return (
    <section className="cfbp-sec">
      <Hd sub="THREE TEAMS OF FIVE">ALL-AMERICA</Hd>
      {[['FIRST TEAM', aa.first], ['SECOND TEAM', aa.second], ['THIRD TEAM', aa.third]].map(([label, list]) => (
        <div key={label} className="cbbs-aa">
          <small>{label}</small>
          <ol>{(list ?? []).map(x => <li key={`${x.name}|${x.team}`} className={x.isUser ? 'is-me' : undefined}><Logo short={x.team} size={18} /><b>{x.isUser ? userName : x.name}</b><span>{x.pos} · {v.school(x.team)}</span><i>{x.line}</i></li>)}</ol>
        </div>
      ))}
    </section>
  )
}
function AwardsPage({ v, userName, userYear, photoOf, live, onNext }) {
  const [done, setDone] = useState(false)
  const rows = awardRows(v, userName)
  return (
    <div className="simp-screen">
      <Wooden h={v.c.awards?.wooden} v={v} userName={userName} userYear={userYear} photoOf={photoOf} live={live} onDone={() => setDone(true)} />
      {done && rows.length > 0 && <section className="cfbp-sec"><Hd sub={userName}>AWARDS</Hd><AwardList rows={rows} /></section>}
      {done && <AllAmerica v={v} userName={userName} />}
      {done && <button className="simp-cta simp-cta-in simp-cta--pin" onClick={onNext}>Draft Stock</button>}
    </div>
  )
}

// ── NBA DRAFT STOCK: the scouting report ────────────────────────────────────
const SCOUT = {
  jumpShot: ['Shoots it off the catch and off the dribble; defenses can\'t go under', 'Defenses will sag off him until the jumper falls'],
  finishing: ['Finishes through contact and with either hand at the rim', 'Has trouble finishing over length'],
  passing: ['Sees the weak side and delivers on time', 'Looks for his own shot first'],
  handles: ['Gets to his spots against pressure', 'A loose handle against ball pressure'],
  perimeterDefense: ['Guards the other team\'s best perimeter scorer', 'Gets beaten off the dribble'],
  interiorDefense: ['Protects the rim without fouling', 'Gives ground in the post and is late as the helper'],
  rebounding: ['Rebounds out of his area on both ends', 'Gets pushed off the glass'],
  playmaking: ['A hub at the elbow: the offense can run through him', 'The ball stops when it goes into him'],
  speed: ['Pushes the pace and beats his man down the floor', 'A step slow in transition'],
  bounce: ['An above-the-rim athlete', 'Plays below the rim'],
  size: ['Positional size and length the league looks for', 'Undersized for his position at the next level'],
  basketballIQ: ['Makes the right read; rarely forces one', 'Shot selection and decisions come and go'],
  clutch: ['Wants the last shot and has made it', 'Scouts want to see him take over late'],
}
function scouting(r, v, attrMap) {
  const u = v.c.user ?? {}
  const attrs = u.attrs ?? {}
  const rows = (u.types ?? Object.keys(attrs)).filter(t => attrs[t] != null && SCOUT[t]).map(t => ({ t, val: attrs[t] })).sort((a, b) => b.val - a.val)
  const lab = x => `${String(attrMap?.[x.t]?.label ?? x.t).toUpperCase()} · ${valToGrade(x.val)}`
  const like = [], ask = []
  const strong = rows.filter(x => x.val >= 8).slice(0, 3)
  for (const x of strong.length ? strong : rows.slice(0, 1)) like.push({ k: lab(x), text: SCOUT[x.t][0] })
  for (const x of rows.filter(x => x.val <= 6).reverse().slice(0, 2)) ask.push({ k: lab(x), text: SCOUT[x.t][1] })
  const t = v.c.totals?.full ?? {}
  if (r.role === 'bench') ask.push({ k: 'TAPE', text: 'A year off the bench: there is little tape to grade' })
  else {
    if ((t.ppg ?? 0) >= 18) like.push({ k: 'PRODUCTION', text: `${f1(t.ppg)} points a game on ${f1(t.fgPct)}% shooting` })
    else if ((t.rpg ?? 0) >= 9) like.push({ k: 'PRODUCTION', text: `${f1(t.rpg)} rebounds a game` })
    else if ((t.apg ?? 0) >= 6) like.push({ k: 'PRODUCTION', text: `${f1(t.apg)} assists a game` })
    if ((t.topg ?? 0) >= 3.2) ask.push({ k: 'TURNOVERS', text: `${f1(t.topg)} turnovers a game` })
    if ((t.tpPct ?? 100) < 31 && (t.tpa ?? 0) >= 80) ask.push({ k: 'SHOOTING', text: `${f1(t.tpPct)}% from three` })
    if ((t.ftPct ?? 100) < 65 && (t.fta ?? 0) >= 80) ask.push({ k: 'FREE THROWS', text: `${f1(t.ftPct)}% at the line` })
  }
  const ranked = [...v.reg, ...v.post].filter(g => g.meta?.oppRank)
  const rw = ranked.filter(g => g.won).length, rl = ranked.length - rw
  if (ranked.length >= 3 && rw > rl) like.push({ k: 'BIG GAMES', text: `${rw}-${rl} against ranked opponents` })
  if (ranked.length >= 4 && rw < rl) ask.push({ k: 'BIG GAMES', text: `${rw}-${rl} against ranked opponents` })
  const a = v.c.awards ?? {}
  if (a.wooden?.userWon) like.push({ k: 'HARDWARE', text: 'Wooden Award winner' })
  else if (a.wooden?.userFinalist) like.push({ k: 'HARDWARE', text: 'Wooden Award finalist' })
  else if (a.allAmerica?.user) like.push({ k: 'HARDWARE', text: `${a.allAmerica.user.charAt(0).toUpperCase() + a.allAmerica.user.slice(1)}-team All-American` })
  if (u.year === 'FR' && r.role !== 'bench') like.push({ k: 'AGE', text: 'A freshman: teams draft what he will be at 23' })
  if (u.year === 'SR') ask.push({ k: 'AGE', text: 'A senior: older than the players drafted around him' })
  if (v.team.tier && v.team.tier !== 'HIGH') ask.push({ k: 'COMPETITION', text: `Did it in the ${v.conf?.short ?? 'league'}, not against a power-conference schedule` })
  if (!ask.length) ask.push({ k: 'CLEAN REPORT', text: 'Scouts had to look hard for a hole in his game' })
  return { like: like.slice(0, 5), ask: ask.slice(0, 4) }
}
const TIER_SHORT = { top5: 'TOP 5', lottery: 'LOTTERY', r1: 'RD 1', r2: 'RD 2', udfa: 'UDFA' }
const TRACK = [['top5', 'TOP 5'], ['lottery', 'LOTTERY'], ['r1', 'RD 1'], ['r2', 'RD 2'], ['udfa', 'UDFA']]
function DraftPage({ r, v, pos, userName, userYear, attrMap, onNext }) {
  const d = v.c.draft
  if (!d) return <div className="simp-screen"><button className="simp-cta" onClick={onNext}>Final Report</button></div>
  const pick = pickOf(d)
  const notes = scouting(r, v, attrMap)
  const rows = (d.board ?? []).map(x => (x.isUser ? { ...x, name: userName, year: userYear ?? x.year } : x))
  const mine = { name: userName, team: v.team.short, year: userYear ?? d.year, isUser: true, tier: d.tier, ppg: v.c.totals?.throughConf?.ppg, rpg: v.c.totals?.throughConf?.rpg, apg: v.c.totals?.throughConf?.apg }
  const Row = ({ x, k }) => (
    <tr className={x.isUser ? 'is-me' : undefined}>
      <td className="is-n">{k}</td>
      <td className="is-who"><Logo short={x.team} size={20} /><span><b>{x.isUser ? <NameTag name={userName} self /> : x.name}</b><small>{v.school(x.team)}{x.year ? ` · ${x.year}` : ''}</small></span></td>
      <td>{f1(x.ppg)}</td>
      <td>{f1(pos === 'big' ? x.rpg : x.apg)}</td>
      <td className="is-proj">{TIER_SHORT[x.tier] ?? '–'}</td>
    </tr>
  )
  return (
    <div className="simp-screen cfbp-draft">
      <section className="cfbp-sec">
        <Hd sub="SCOUTING REPORT">NBA DRAFT STOCK</Hd>
        <div className="cfbs-draft">
          <div className="cfbs-draft-top">
            <small>{userName} · {CBB_POS[pos].name.toUpperCase()} · {v.school(v.team.short)}{userYear ? ` · ${userYear}` : ''}</small>
            <b>{String(d.label).toUpperCase()}</b>
            <em>{pick ? projText(d) : 'Not projected to be drafted'}{d.note ? ` · ${d.note}` : ''}</em>
          </div>
          <ol className="cfbs-draft-board cbbs-draft-track" aria-label={`Projected: ${projText(d)}`}>
            {TRACK.map(([k, label]) => <li key={k} className={d.tier === k ? 'is-on' : undefined}><span>{label}</span></li>)}
          </ol>
          <div className="cfbs-stats cfbp-draft-nums" style={{ '--n': 3 }}>
            <div><b>{d.boardRank ? `No. ${d.boardRank}` : '–'}</b><small>{CBB_POS[pos].group}{d.boardOf ? ` · OF ${d.boardOf}` : ''}</small></div>
            <div><b>{d.overall ? `No. ${d.overall}` : 'NR'}</b><small>MOCK DRAFT</small></div>
            <div><b>{r.ovr}</b><small>COLLEGE OVR</small></div>
          </div>
        </div>
      </section>
      <section className="cfbp-sec"><Hd>WHAT SCOUTS LIKE</Hd><ul className="cfbp-notes">{notes.like.map((x, i) => <li key={i}><b>{x.k}</b><span>{x.text}</span></li>)}</ul></section>
      <section className="cfbp-sec"><Hd>THE QUESTIONS</Hd><ul className="cfbp-notes is-ask">{notes.ask.map((x, i) => <li key={i}><b>{x.k}</b><span>{x.text}</span></li>)}</ul></section>
      {rows.length > 0 && (
        <section className="cfbp-sec">
          <Hd sub={CBB_POS[pos].group}>THE BOARD</Hd>
          <table className="cfbp-board">
            <thead><tr><th>RK</th><th className="is-who">PROSPECT</th><th>PPG</th><th>{pos === 'big' ? 'RPG' : 'APG'}</th><th>PROJ</th></tr></thead>
            <tbody>
              {rows.map((x, i) => <Row key={i} x={x} k={i + 1} />)}
              {d.boardRank > rows.length && <><tr className="is-gap" aria-hidden="true"><td colSpan={5}>···</td></tr><Row x={mine} k={d.boardRank} /></>}
            </tbody>
          </table>
        </section>
      )}
      <button className="simp-cta simp-cta-in simp-cta--pin" onClick={onNext}>Final Report</button>
    </div>
  )
}

// ── FINAL REPORT ────────────────────────────────────────────────────────────
function FinalPage({ r, v, pos, build, types, attrMap, archetype, userName, rewards, endActions, seasonNote, onDraft, onAgain, onReturn, onTransfer, nextNote = null }) {
  const c = v.c
  const full = c.totals?.full
  const rows = rowsOf(build, types, attrMap)
  const deep = ['Sweet 16', 'Elite Eight', 'Final Four', 'National Championship'].includes(c.ncaa?.exit)
  const tier = v.champs ? 'sfb-champ' : c.ncaa?.seed || c.confChamp ? 'sfb-elim' : 'sfb-miss'
  const subBits = [c.confChamp ? `${v.conf?.short ?? 'Conference'} Tournament Champions` : c.confRegChamp ? `${v.conf?.short ?? 'Conference'} Champions` : null, `${v.record} Season`, `OVR ${r.ovr}`].filter(Boolean)
  const best = r.bestGame
  const honors = awardRows(v, userName, true).filter(x => x.state)
  const shareCard = useMemo(() => ({
    sport: 'bucket', name: userName || 'Guest',
    tag: [CBB_POS[pos].name.toUpperCase(), 'COLLEGE BASKETBALL'].join('  ·  '),
    hero: { value: r.ovr ?? '–', label: 'OVR' },
    sub: archetype && !/remaining$/.test(archetype) ? archetype : null,
    record: v.record, headline: v.headline.toUpperCase().replace(/ — /, ' · '),
    tier: v.champs ? 'champ' : c.ncaa?.seed ? 'playoffs' : 'miss',
    ribbons: [v.champs && 'NATIONAL CHAMPS', !v.champs && deep && finishOf(r).toUpperCase(), c.awards?.wooden?.userWon && 'WOODEN AWARD'].filter(Boolean),
    team: { name: v.team.school ?? v.team.name, short: v.team.short, color: v.team.color, color2: v.team.color2, logo: cbbLogo(v.team.short) },
    stats: [[f1(full?.ppg), 'PPG'], [f1(full?.rpg), 'RPG'], [f1(full?.apg), 'APG']].map(([x, k]) => ({ v: x, k })),
    chips: rows.map(x => ({ label: x.label, name: x.data?.qbFull || x.data?.qb, photo: x.data?.photo, val: x.val })),
  }), [r, v, c, pos, userName, archetype, rows.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const d = c.draft
  const school = v.school(v.team.short)
  return (
    <div className="simp-screen">
      {rewards && <SeasonRewards result={r} />}
      <div className={`simp-final-banner ${tier}`}>
        <div className="sfb-outcome">{v.headline}</div>
        <div className="sfb-sub">{subBits.join(' · ')}</div>
        {seasonNote && <div className="sfb-sub cfbp-banner-note">{seasonNote}</div>}
      </div>
      <ShareSeasonButton card={shareCard} />
      <SeasonLine totals={full} sub={`${userName} · ${v.post.length ? 'WITH THE POSTSEASON' : 'FULL SEASON'}`} />
      <PostLog title="Postseason" games={v.post} />
      <Figure build={build} team={v.team} />
      {honors.length > 0 && <section className="cfbp-sec"><Hd sub={userName}>HONORS</Hd><AwardList rows={honors} /></section>}
      <Poll ranks={v.ranks} final />
      <BoxLog games={[...v.reg, ...v.post]} totals={full} userName={userName} sub={`${userName} · EVERY GAME`} />
      {rows.length > 0 && <div className="simp-stat-section"><div className="simp-stat-group-lbl"><NameTag name={userName} self />'s Build</div><BuildRows rows={rows} small /></div>}
      {best && (
        <div className="simp-best-game">
          <div className="simp-section-lbl">Best Game</div>
          <div className="simp-best-body"><span className="sbg-week">{best.meta?.date}</span><span className="sbg-opp">{best.neutral ? 'vs' : best.home ? 'vs' : '@'} {best.opponent}</span><span className="sbg-line">{gameLine(best)}</span></div>
        </div>
      )}
      {endActions ?? (
        <section className="cfbp-sec cfbp-next">
          <Hd sub={d ? `DRAFT STOCK · ${projText(d).toUpperCase()}` : null}>WHAT'S NEXT</Hd>
          <div className="simp-final-actions">
            {onDraft && <button className="simp-cta" onClick={() => { sfx('tap'); onDraft() }}>Enter the NBA Draft</button>}
            {onReturn && <button className={onDraft ? 'simp-ghost' : 'simp-cta'} onClick={() => { sfx('tap'); onReturn() }}>Return to {school}</button>}
            {nextNote && <p className="cfbs-note cfbp-return-note">{nextNote}</p>}
            {onTransfer && <button className="simp-ghost" onClick={() => { sfx('tap'); onTransfer() }}>Transfer</button>}
            <button className="simp-ghost" onClick={() => { sfx('tap'); onAgain?.() }}>New {CBB_POS[pos].name} Build</button>
          </div>
        </section>
      )}
    </div>
  )
}

// ── the page ────────────────────────────────────────────────────────────────
const PAGES = ['pre', 'reg', 'conf', 'sel', 'post', 'awards', 'draft', 'final']
export default function CBBSimPage({ result: r, pos, userName, teams, archetype, build = null, types = null, attrMap = null, nav = null, photoOf = null,
  stage: stageIn = 'pre', onStage, onAgain, onDraft = null, onReturn = null, onTransfer = null, nextNote = null, onHome, endActions = null, roleNote = null, seasonNote = null, userYear = null, season = null, rewards = true }) {
  const v = useMemo(() => ({ ...view(r, teams), userName }), [r, teams, userName])
  const pages = useMemo(() => (build ? PAGES : PAGES.slice(1)), [build])
  const start = () => { const id = typeof stageIn === 'string' && pages.includes(stageIn) ? stageIn : pages[0]; return id }
  const [page, setPage] = useState(start)
  // (a page that came up from its button plays live; one opened from a save shows as played. A Career's first look
  // at a season starts on the regular season, live)
  const [fresh, setFresh] = useState(() => (typeof stageIn !== 'string' && pages[0] === 'reg' ? 'reg' : null))
  const [gamesShown, setGamesShown] = useState(page === 'reg' ? 0 : v.reg.length)
  const tapGuard = useTapGuard()
  const idx = pages.indexOf(page)
  useRailOn(page)
  const season_ = season ?? r.year ?? 2026
  const school = v.team.school ?? v.team.name
  const go = id => {
    tapGuard.mark()
    document.querySelector('.simp-page')?.scrollTo({ top: 0, behavior: 'instant' })
    window.scrollTo({ top: 0, behavior: 'instant' })
    sfx('tap')
    setFresh(id); setPage(id); onStage?.(id)
  }
  useEffect(() => { if (page === 'reg' && gamesShown >= v.reg.length && typeof stageIn !== 'string') onStage?.('reg') }, [page, gamesShown]) // eslint-disable-line react-hooks/exhaustive-deps
  const late = page === 'awards' || page === 'draft' || page === 'final' || page === 'post' || page === 'sel'
  const apNow = page === 'pre' ? v.ranks[0]?.ap
    : page === 'reg' ? (() => { const sh = v.reg.slice(0, gamesShown); const day = sh.length ? sh[sh.length - 1].meta?.day ?? 0 : -1; const ps = (v.c.ap ?? []).filter(p => p.day <= day && !/^final/i.test(p.label)); return ps[ps.length - 1]?.myRank ?? null })()
    : late ? v.finalRank : v.ranks[v.ranks.length - 2]?.ap
  const apLine = apNow ? `${late ? 'FINAL AP' : 'AP'} NO. ${apNow}` : null
  const confShort = v.conf?.short ?? ''
  const team = v.team
  const who = page === 'pre' ? seasonNote : [userName, CBB_POS[pos].name, roleNote ?? archetype ?? r.archetype].filter(Boolean).join(' · ')

  let el
  if (page === 'pre') el = <PrePage r={r} build={build} types={types} attrMap={attrMap} archetype={archetype} team={team} onNext={() => go('reg')} />
  else if (page === 'reg') el = <RegPage key="reg" r={r} v={v} userName={userName} live={fresh === 'reg'} onNext={() => go('conf')} onGames={setGamesShown} />
  else if (page === 'conf') el = <ConfPage key="conf" v={v} live={fresh === 'conf'} onNext={() => go('sel')} />
  else if (page === 'sel') el = <SelPage v={v} onNext={() => go('post')} />
  else if (page === 'post') el = <PostPage key="post" v={v} live={fresh === 'post'} onNext={() => go('awards')} />
  else if (page === 'awards') el = <AwardsPage key="awards" v={v} userName={userName} userYear={userYear} photoOf={photoOf} live={fresh === 'awards'} onNext={() => go('draft')} />
  else if (page === 'draft') el = <DraftPage r={r} v={v} pos={pos} userName={userName} userYear={userYear} attrMap={attrMap} onNext={() => go('final')} />
  else el = <FinalPage r={r} v={v} pos={pos} build={build} types={types} attrMap={attrMap} archetype={archetype ?? r.archetype} userName={userName} rewards={rewards} endActions={endActions} seasonNote={seasonNote} onDraft={onDraft} onAgain={onAgain} onReturn={onReturn} onTransfer={onTransfer} nextNote={nextNote} />

  return (
    <>
      {nav}
      <div className={`simp-page cfbp cbbp${nav ? '' : ' cfbp--dock'}${v.champs && late ? ' is-champ' : ''}`} style={{ '--team-color': team.color, '--team-color2': team.color2 }} onClickCapture={tapGuard.onClickCapture}>
        <div className="simp-col">
          {!nav && (
            <div className="cfbp-top">
              <span className="cfbs-top-brand">COLLEGE BASKETBALL <i>·</i> {season_}-{String(season_ + 1).slice(2)} SEASON{r.sandbox ? <em> · SANDBOX</em> : null}</span>
              <button className="ag-round-btn" onClick={onHome} aria-label="Home"><IconClose size={16} /></button>
            </div>
          )}
          <div className="simp-top-bar">
            {(page === 'awards' || page === 'draft') && <button className="simp-back-btn" onClick={() => { const to = pages[idx - 1]; setFresh(null); setPage(to); onStage?.(to) }}>← Back</button>}
            <ProgressDots screen={idx} total={pages.length} />
          </div>
          <div className="simp-team-strip cfbp-strip">
            <div className="sts-top-row">
              <img src={cbbLogoDark(team.short)} alt={team.short} className="sts-logo" onError={e => { if (!e.currentTarget.dataset.f) { e.currentTarget.dataset.f = 1; e.currentTarget.src = cbbLogo(team.short) } }} />
              <div className="sts-info">
                <div className="sts-name-wrap">
                  <span className="sts-city">{[confShort, apLine].filter(Boolean).join(' · ')}</span>
                  <span className="sts-nickname">{school}</span>
                </div>
                {who && <span className="cfbp-role">{who}</span>}
                {team.arena && page === 'pre' && <span className="cfbp-role cbbp-arena">{team.arena}{team.city ? ` · ${team.city}` : ''}</span>}
              </div>
              {(team.off != null || team.def != null) && (
                <div className="sts-grades">
                  {[['OFF', team.off], ['DEF', team.def]].filter(x => x[1] != null).map(([k, val]) => (
                    <div key={k} className="sts-grade-item">
                      <span className="sts-grade-key">{k}</span>
                      <div className="sts-grade-track"><div className="sts-grade-fill" style={{ width: `${val * 10}%` }} /></div>
                      <span className="sts-grade-badge">{offDefGrade(val)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {el}
          <SiteFooter sport="bucket" />
        </div>
      </div>
    </>
  )
}
