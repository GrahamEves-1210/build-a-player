import { useEffect, useMemo, useRef, useState } from 'react'
import { PlayoffGame } from '../LiveGame'
import { IconClose } from '../app/icons'
import { NameTag } from '../app/NameTag'
import { SeasonRewards, WeekStrip } from '../app/AppSeason'
import { Wire, Milestones, SeasonStory, useDirectedReveal } from '../app/AppSeasonPlus'
import { ShareSeasonButton } from '../app/SeasonShare'
import { Pulse, ProgressDots, SimLoading, LeadersBoard, Checking } from '../simFlow'
import { StatLineTable, GameLog, PlayoffLog, gradeColor, offDefGrade } from '../simParts'
import QBAvatar from '../QBAvatar'
import QBFigureOverlay from '../QBFigureOverlay'
import RBFigureOverlay from '../RBFigureOverlay'
import WRFigureOverlay from '../WRFigureOverlay'
import SiteFooter from '../SiteFooter'
import { valToGrade } from '../../utils/simulation'
import { createDirector, registerDirector } from '../../lib/seasonDirector'
import { useCountUp } from '../../lib/useCountUp'
import { useTapGuard } from '../../lib/tapGuard'
import { useRailOn } from '../../lib/ads'
import { IS_APP } from '../../lib/platform'
import { sfx } from '../../lib/juice'
import { cfbLogo, cfbLogoDark, CFB_POS } from './cfbShared'

// ── College Football: the season ────────────────────────────────────────────
// Football's season page (SimPage.jsx), page for page, in the college blue: the dot pager, the team card, the
// pinned button, the same pieces (simParts.jsx, simFlow.jsx, AppSeason*), one page a stage:
//   pre    PRE-SEASON: the OVR, the archetype, SIMULATE SEASON, the figure in school colours, the build
//   reg    REGULAR SEASON: live, week by week (the record, the pulse, the wire, the milestones, the weeks, the
//          schedule, the AP poll), then his production and the Heisman watch
//   ccg    CONFERENCE CHAMPIONSHIP: his title game live (or the conference's, when he missed it), the standings.
//          No page for the Independents: they play no title game
//   sel    SELECTION DAY: the 12-team field, the committee's final top 25
//   post   THE PLAYOFF or THE BOWL: the round strip, each game live, the end of the road
//          → THE HEISMAN (the MVP card's ceremony)
//   draft  DRAFT STOCK (football's GOAT Status): the big board at his position, his slot
//   final  FINAL REPORT: rewards, story, the result, share, the postseason log, the figure, the production,
//          the honors, the build, his best game, ENTER THE NFL DRAFT and NEW BUILD
// The player is the username (or Guest), never "you". Reduce Motion: no live reveal, no live games.
// (reads runCFBSimulation's result, utils/cfbSimulation.js: football's keys plus result.cfb. view() gathers it)

const reduced = () => document.documentElement.classList.contains('bap-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const n = v => (v == null || Number.isNaN(+v) ? '–' : Math.round(+v).toLocaleString())
const f1 = v => (v == null || Number.isNaN(+v) ? '–' : (+v).toFixed(1))
const ordinal = k => `${k}${(k % 100 > 10 && k % 100 < 14) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[k % 10] ?? 'th'}`
const POS_AWARD = { qb: 'daveyOBrien', wr: 'biletnikoff', rb: 'doakWalker' }
const POS_PLURAL = { qb: 'QBs', rb: 'RBs', wr: 'WRs' }

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

// on the navy: ESPN's dark-background logo; on a white plate: the regular one
const Logo = ({ short, size = 28, light = false }) => (
  <img className="cfbs-logo" src={light ? cfbLogo(short) : cfbLogoDark(short)} alt="" width={size} height={size} loading="lazy" draggable={false}
    onError={e => { if (!light && !e.currentTarget.dataset.f) { e.currentTarget.dataset.f = 1; e.currentTarget.src = cfbLogo(short) } else e.currentTarget.style.visibility = 'hidden' }} />
)

const gameLine = (g, pos) => {
  if (pos === 'qb' && g.att === 0 && !g.rushAtt) return 'Did not play'
  if (pos === 'wr' && g.targets === 0) return 'No targets'
  if (pos === 'qb') return g.att != null ? `${g.comp}/${g.att} · ${n(g.passYds)} yds · ${g.tds ?? 0} TD · ${g.ints ?? 0} INT${g.rushTDs ? ` · ${g.rushTDs} rush TD` : ''}` : ''
  if (pos === 'rb') return g.carries != null ? `${g.carries} car · ${n(g.rushYds)} yds · ${(g.rushTDs ?? 0) + (g.recTDs ?? 0)} TD${g.recYds ? ` · ${n(g.recYds)} rec yds` : ''}` : ''
  return g.rec != null ? `${g.rec} rec · ${n(g.recYds)} yds${g.recTDs ? ` · ${g.recTDs} TD` : ''}` : ''
}
// a postseason game's name: the title game, the CFP round (and its bowl), the bowl
const roundName = (g, v) => (g.round === 'Conference Championship' ? (g.title ?? `${v.conf?.short ?? 'Conference'} Championship`)
  : g.round === 'National Championship' ? 'CFP National Championship'
  : isCfp(g) ? `CFP ${g.round}${g.bowl ? ` · ${g.bowl}` : ''}`
  : (g.bowl ?? g.label ?? 'Bowl'))
// his postseason as football's playoff log takes it (NCAA passer rating in the rating spot, as the box score shows it)
const logRows = (games, v) => games.map(g => ({ ...g, round: roundName(g, v), opponent: v.school(g.oppShort), home: !!g.home || !!g.neutral, overtime: !!g.ot, rating: g.eff ?? g.rating }))

// Poll by poll in the AP Top 25: one line, No. 1 at the top, unranked weeks on the floor
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

const MatchRow = ({ short, name, seed, sc, win, me }) => (
  <div className={`cfbs-mrow${win ? ' is-win' : ''}${me ? ' is-me' : ''}`}>
    {seed != null && <em>{seed}</em>}
    <Logo short={short} size={22} />
    <span>{name}</span>
    <b>{sc ?? ''}</b>
  </div>
)
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

// the conference table (records never include the title game)
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
            <td className="is-team"><Logo short={x.short} size={20} /><span>{v.school(x.short)}</span></td>
            <td>{x.confW}-{x.confL}</td>
            <td>{x.w}-{x.l}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// The 12-team Playoff, every game: first round on campus, the quarterfinal and semifinal bowls, the title game
const ROUND_SHORT = { 'First Round': 'FIRST ROUND', Quarterfinal: 'QUARTERFINALS', Semifinal: 'SEMIFINALS', 'National Championship': 'TITLE GAME' }
function CfpBracket({ v }) {
  const p = v.c.playoff
  if (!p?.games?.length) return null
  const me = v.team.short
  const rounds = ['First Round', 'Quarterfinal', 'Semifinal', 'National Championship'].map(round => ({ round, games: p.games.filter(g => g.round === round) })).filter(r => r.games.length)
  return (
    <div className="cfbs-bracket-scroll">
      <div className="cfbs-bracket" style={{ '--rounds': rounds.length }}>
        {rounds.map(r => (
          <div key={r.round} className="cfbs-round">
            <h3>{ROUND_SHORT[r.round] ?? r.round.toUpperCase()}</h3>
            <div className="cfbs-round-games">
              {r.games.map((g, i) => (
                <div key={i} className={`cfbs-bgame${g.hi === me || g.lo === me ? ' is-me' : ''}`}>
                  {g.bowl && r.round !== 'National Championship' && <small>{g.bowl}</small>}
                  <MatchRow short={g.hi} name={v.school(g.hi)} seed={g.hiSeed} sc={g.hiSc} win={g.winner === g.hi} me={g.hi === me} />
                  <MatchRow short={g.lo} name={v.school(g.lo)} seed={g.loSeed} sc={g.loSc} win={g.winner === g.lo} me={g.lo === me} />
                </div>
              ))}
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

// One postseason game, live on football's playoff scoreboard (LiveGame.jsx): the round, the schools, the clock,
// each score as it lands. (g.other: the conference's title game without him in it, the winner on the left)
const lum = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? ''); if (!m) return 0.5; const x = parseInt(m[1], 16); return (0.2126 * (x >> 16) + 0.7152 * ((x >> 8) & 255) + 0.0722 * (x & 255)) / 255 }
// a school colour that shows on the dark scoreboard (Notre Dame's navy doesn't: its gold does)
const onDark = t => { const a = t.color ?? '#0a3d91', b = t.color2; return lum(a) < 0.22 && b && lum(b) > lum(a) && lum(b) < 0.95 ? b : lum(a) < 0.22 ? '#4f8fe8' : a }
function LiveGame({ v, g, onDone }) {
  const ccg = g.round === 'Conference Championship'
  const round = roundName(g, v)
  const bowl = g.bowl ?? g.label ?? 'Bowl'
  const fin = ccg || !isCfp(g) || g.round === 'National Championship'
  const side = g.teamShort ? (v.T(g.teamShort) ?? { short: g.teamShort }) : v.team
  const champ = g.other ? `✓ ${v.school(g.teamShort)} wins the ${v.conf?.short ?? 'conference'}` : ccg ? `✓ ${v.conf?.short ?? 'Conference'} Champions` : g.round === 'National Championship' ? '✓ National Champions' : `✓ Won the ${bowl}`
  const lost = ccg ? '✗ Lost the title game' : isCfp(g) ? '✗ Eliminated' : `✗ Lost the ${bowl}`
  return (
    <PlayoffGame
      round={round} opponent={v.school(g.oppShort)} home={!!g.home && !g.neutral} weather={null}
      mySc={g.mySc} oppSc={g.oppSc} won={!!g.won} overtime={!!g.ot}
      teamColor={onDark(side)} textColor="#ffffff" teamAbbr={side.short} teamLogo={cfbLogo(side.short)}
      oppLogo={cfbLogo(g.oppShort)} oppAbbr={g.oppShort}
      finalWord={g.neutral || ccg || g.round === 'National Championship' ? round : null}
      isFinal={fin} champWord={champ} lossWord={lost} isAllTime={false} onDone={onDone}
    />
  )
}

// ── the figure in school colours, the build as rows (football's pre-season page and final report) ──
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
function RegPage({ r, v, pos, build, userName, live, nextLabel, onNext, onWeeks, onStory }) {
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
  const apNow = polls[polls.length - 1]?.ap ?? null
  const asGames = gs => gs.map(g => ({ ...g, wk: weekNo(g.meta?.label ?? g.wk), opponent: `${g.meta?.oppRank ? `No. ${g.meta.oppRank} ` : ''}${v.school(g.oppShort)}` }))
  const regLine = { ...r, ...(v.c.totals?.regular ?? {}), games: v.reg }
  if (pos === 'qb' && regLine.seasonEff != null) regLine.seasonRating = Math.round(regLine.seasonEff * 10) / 10
  const L = v.c.leaders
  return (
    <div className="simp-screen">
      {loading ? <SimLoading /> : (
        <>
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
          <GameLog games={asGames(shown)} total={v.reg.length} isRB={pos === 'rb'} isWR={pos === 'wr'} weekOf={i => weekNo(v.reg[i]?.meta?.label ?? i + 1)} />
          <div className="sm-log-wrap cfbp-poll">
            <div className="sm-log-head"><span>AP POLL</span><span>{apNow ? `NO. ${apNow}` : 'UNRANKED'}</span></div>
            <RankPath ranks={polls} />
          </div>
          {done && (
            <div className="simp-stat-section simp-totals-in">
              <div className="simp-eyebrow">Production</div>
              <StatLineTable result={regLine} build={build} userName={userName} kind={pos} />
              {L?.rows?.length > 0 && (
                <LeadersBoard title="FBS LEADERS" label={L.label} rank={L.rank} who={<NameTag name={userName} self />}
                  rows={L.rows.slice(0, 6).map((x, i) => ({ rank: i + 1, me: x.isUser, name: x.isUser ? <NameTag name={userName} self /> : x.name, team: x.team, value: n(x.value) }))} />
              )}
            </div>
          )}
          {done && <button className="simp-cta simp-cta-in simp-cta--pin" onClick={onNext}>{nextLabel}</button>}
        </>
      )}
    </div>
  )
}

// ── CONFERENCE CHAMPIONSHIP ─────────────────────────────────────────────────
function CcgPage({ v, live, onNext }) {
  const s = v.c.myStanding
  const t0 = s?.title ?? null
  const me = v.team.short
  // his title game, or (he missed it) the conference's: the winner on the left
  const g = v.ccg ?? (t0 ? (() => {
    const aWon = t0.aSc > t0.bSc
    return { round: 'Conference Championship', title: t0.title, teamShort: aWon ? t0.a : t0.b, oppShort: aWon ? t0.b : t0.a, mySc: Math.max(t0.aSc, t0.bSc), oppSc: Math.min(t0.aSc, t0.bSc), won: true, ot: t0.ot, neutral: true, other: true }
  })() : null)
  const [status, setStatus] = useState(live && !reduced() ? 'pre' : 'done')
  useEffect(() => { if (status !== 'pre') return; const t = setTimeout(() => setStatus('playing'), 500); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!g) return null
  const title = g.title ?? `${v.conf?.short ?? 'Conference'} Championship`
  const confShort = v.conf?.short ?? 'conference'
  const place = (s?.teams?.findIndex(x => x.short === me) ?? -1) + 1
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
          {g.other ? (
            <>
              <div className="plf-elim-title">{v.school(g.teamShort)} wins the {confShort}</div>
              <div className="plf-elim-score">{g.mySc} – {g.oppSc}{g.ot ? ' OT' : ''} · over {v.school(g.oppShort)}</div>
              <div className="plf-elim-round">{v.school(me)} finished {ordinal(place || 1)} in the {confShort}</div>
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
      <div className="simp-stat-section">
        <div className="simp-eyebrow">{confShort} Standings</div>
        <ConfTable v={v} />
      </div>
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
  const sched = v.reg.filter(g => g.won).length + (v.ccg?.won ? 1 : 0)
  const big = c.cfpSeed ? `No. ${c.cfpSeed} Seed` : bowlName ?? 'No Bowl'
  const sub = c.cfpSeed ? (c.cfpSeed <= 4 ? 'A first-round bye' : c.cfpSeed <= 8 ? 'At home in the first round' : 'On the road in the first round')
    : bowlName ? `vs ${v.school(c.bowl.oppShort)}${myRank ? ` · No. ${myRank} in the final rankings` : ''}`
    : sched >= 6 ? 'Bowl eligible, left out of the bowls' : `${sched} wins: six makes a team bowl eligible`
  return (
    <div className="simp-screen">
      <div className="simp-eyebrow">Selection Day</div>
      <div className="cfbp-sel-big">{big}</div>
      <div className="plf-elim-round cfbp-sel-sub">{sub}</div>
      <div className="simp-stat-section">
        <div className="simp-eyebrow">The 12-Team Field</div>
        <ol className="cfbs-field" aria-label="The 12-team field">
          {field.map(f => (
            <li key={f.short} className={f.short === me ? 'is-me' : undefined}>
              <em>{f.seed}</em><Logo short={f.short} size={24} />
              <span><b>{v.school(f.short)}</b><small>{f.rec} · {f.conf}</small></span>
              <i className={f.bid === 'auto' ? 'is-auto' : ''}>{f.bid === 'auto' ? 'AUTO BID' : 'AT-LARGE'}</i>
            </li>
          ))}
        </ol>
      </div>
      {last && (
        <div className="simp-stat-section">
          <div className="simp-eyebrow">CFP Rankings</div>
          <ol className="cfbs-top25">
            {last.top25.map(t => (
              <li key={t.short} className={t.short === me ? 'is-me' : undefined}><em>{t.rank}</em><Logo short={t.short} size={18} /><span>{v.school(t.short)}</span><small>{t.rec}</small></li>
            ))}
          </ol>
        </div>
      )}
      <button className="simp-cta simp-cta-in simp-cta--pin" onClick={onNext}>{c.cfpSeed ? 'Enter the Playoff' : bowlName ? `Play the ${bowlName}` : 'Season Summary'}</button>
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

  if (!games.length) {
    const wins = v.reg.filter(g => g.won).length + (v.ccg?.won ? 1 : 0)
    return (
      <div className="simp-screen simp-screen-center">
        <div className="simp-eyebrow">Postseason</div>
        <div className="simp-miss-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="24" cy="24" r="19" /><path d="M16 16l16 16M32 16L16 32" /></svg>
        </div>
        <div className="simp-miss-title">No Bowl</div>
        <div className="plf-elim-round">{wins >= 6 ? `${v.record}: bowl eligible, left out` : `${v.record}: a team needs six wins for a bowl`}</div>
        <button className="simp-cta" onClick={onNext}>Draft Stock</button>
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
        <button className="simp-cta simp-cta-in" onClick={onNext}>Draft Stock</button>
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
        <button className="simp-cta" onClick={onNext}>Draft Stock</button>
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
  const fin = v.c.playoff?.games?.find(g => g.round === 'National Championship')
  return (
    <div className="simp-screen">
      {cfp && <CfpStrip rounds={games} gameIdx={gameIdx} status={status} hasBye={!!v.c.cfpSeed && v.c.cfpSeed <= 4} />}
      {inner}
      {started && <PlayoffLog title={cfp ? 'Playoff Game Log' : 'Bowl Game Log'} rounds={logRows(games.slice(0, status === 'playing' ? gameIdx : gameIdx + 1), v)} />}
      {ended && (
        <div className="simp-stat-section">
          <div className="simp-eyebrow">The Playoff</div>
          <CfpBracket v={v} />
          {fin && (
            <Match v={v} className="cfbs-title" title="CFP National Championship" site={[fin.site, fin.date].filter(Boolean).join(' · ')} a={fin.hi} b={fin.lo} aSeed={fin.hiSeed} bSeed={fin.loSeed} aSc={fin.hiSc} bSc={fin.loSc} winner={fin.winner}
              foot={`${v.school(fin.winner).toUpperCase()} · NATIONAL CHAMPIONS`} />
          )}
        </div>
      )}
    </div>
  )
}

// ── THE HEISMAN: football's MVP card (MVPModal's markup), the college ceremony ──
const heisLines = (pos, t, rec) => {
  if (!t) return []
  const row = (k, x) => [k, x]
  const out = rec ? [row('Record', rec)] : []
  if (pos === 'qb') return [...out, row('Pass Yards', n(t.seasonPassYds)), row('Pass TDs', n(t.seasonTDs)), row('Interceptions', n(t.seasonINTs)), row('Comp %', `${f1(t.seasonCompPct)}%`), row('Rush Yards', n(t.seasonRushYds)), row('Rush TDs', n(t.seasonRushTDs))]
  if (pos === 'rb') return [...out, row('Rush Yards', n(t.seasonRushYds)), row('Yards / Carry', f1(t.seasonYPC)), row('Rush TDs', n(t.seasonRushTDs)), row('Rec Yards', n(t.seasonRecYds)), row('Rec TDs', n(t.seasonRecTDs))]
  return [...out, row('Receptions', n(t.seasonRecs)), row('Rec Yards', n(t.seasonRecYds)), row('Rec TDs', n(t.seasonRecTDs)), row('Yards / Catch', f1(t.seasonYPR))]
}
function HeismanModal({ v, pos, userName, season, photo, photoOf, onDismiss }) {
  const [phase, setPhase] = useState('loading')
  const [bar, setBar] = useState(0)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const quick = reduced()
    const a = setTimeout(() => setShown(true), 30)
    const b = setTimeout(() => setBar(100), 150)
    const c = setTimeout(() => setPhase('reveal'), quick ? 600 : 3200)
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c) }
  }, [])
  const h = v.c.awards?.heisman
  useEffect(() => { if (phase === 'reveal' && h?.userWon) sfx('complete', 2) }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps
  const me = v.c.totals?.throughCCG ?? {}
  const selRec = v.c.record?.selection
  const w = h?.winner
  const recOf = short => (short === v.team.short ? selRec : v.c.cfpRankings?.[v.c.cfpRankings.length - 1]?.top25?.find(t => t.short === short)?.rec ?? null)
  const pills = pos === 'qb' ? [[n((me.seasonPassYds ?? 0) + (me.seasonRushYds ?? 0)), 'Total Yds'], [n((me.seasonTDs ?? 0) + (me.seasonRushTDs ?? 0)), 'TDs'], [n(me.seasonINTs), 'INTs']]
    : pos === 'rb' ? [[n(me.seasonRushYds), 'Rush Yds'], [n((me.seasonRushTDs ?? 0) + (me.seasonRecTDs ?? 0)), 'TDs'], [f1(me.seasonYPC), 'YPC']]
    : [[n(me.seasonRecYds), 'Rec Yds'], [n(me.seasonRecs), 'Recs'], [n(me.seasonRecTDs), 'TDs']]
  const others = (h?.finalists ?? []).filter(f => !(f.isUser && h.userWon) && !(w && f.name === w.name && f.team === w.team))
  return (
    <div className={`mvp-overlay ${shown ? 'mvp-overlay-in' : ''}`}>
      <div className="mvp-card">
        <div className="mvp-eyebrow">{season} College Football</div>
        <div className="mvp-title">Heisman Trophy</div>
        {phase === 'loading' && (
          <div className="mvp-loading">
            <div className="mvp-votes-lbl">Counting Votes…</div>
            <div className="mvp-bar-track"><div className="mvp-bar-fill" style={{ width: `${bar}%`, transition: 'width 2.9s cubic-bezier(0.25,0,0.5,1)' }} /></div>
            <div className="mvp-stats-preview">
              <div className="mvp-stat-pill"><span>{selRec}</span><span>W–L</span></div>
              {pills.map(([x, k]) => <div key={k} className="mvp-stat-pill"><span>{x}</span><span>{k}</span></div>)}
            </div>
          </div>
        )}
        {phase === 'reveal' && (
          <div className="mvp-reveal">
            {!w ? (
              <div className="mvp-winner-name">No vote this season</div>
            ) : h.userWon ? (
              <>
                <div className="mvp-winner-tag mvp-winner-tag--you"><NameTag name={userName} self /> Wins the Heisman</div>
                <div className="mvp-avatar-wrap"><QBAvatar photo={photo} team={`cfb/${v.team.short}`} color={v.team.color} size={96} /></div>
                <div className="mvp-winner-name">{userName}</div>
                <div className="mvp-winner-sub">{v.school(v.team.short)}<span className="mvp-winner-pos">{CFB_POS[pos].label}</span></div>
                <div className="mvp-season-stats">{heisLines(pos, me, selRec).map(([k, x]) => <div key={k} className="mvp-stat-row"><span className="mvp-stat-label">{k}</span><span className="mvp-stat-val">{x}</span></div>)}</div>
              </>
            ) : (
              <>
                <div className="mvp-avatar-wrap"><QBAvatar photo={photoOf?.(w.name, w.team) ?? null} team={`cfb/${w.team}`} color={v.T(w.team).color} size={96} /></div>
                <div className="mvp-winner-name">{w.name}</div>
                <div className="mvp-winner-sub">{v.school(w.team)}<span className="mvp-winner-pos">{w.pos}{w.year ? ` · ${w.year}` : ''}</span></div>
                <div className="mvp-season-stats">{heisLines(String(w.pos).toLowerCase(), w.stats, recOf(w.team)).map(([k, x]) => <div key={k} className="mvp-stat-row"><span className="mvp-stat-label">{k}</span><span className="mvp-stat-val">{x}</span></div>)}</div>
              </>
            )}
            {w && (
              <div className="mvp-season-stats cfbp-heis-fin">
                {others.map(f => (
                  <div key={`${f.name}|${f.team}`} className={`mvp-stat-row${f.isUser ? ' is-me' : ''}`}>
                    <span className="mvp-stat-label">{f.isUser ? <NameTag name={userName} self /> : f.name} · {v.school(f.team)}</span>
                    <span className="mvp-stat-val">{n(f.pts)} pts</span>
                  </div>
                ))}
                {!h.userWon && !h.userFinalist && (
                  <div className="mvp-stat-row is-me"><span className="mvp-stat-label"><NameTag name={userName} self /></span><span className="mvp-stat-val">{h.userPlace ? `${ordinal(h.userPlace)} in the voting` : 'No votes'}</span></div>
                )}
              </div>
            )}
            <button className="mvp-continue" onClick={onDismiss}>Continue to Draft Stock</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── DRAFT STOCK: football's GOAT Status, as the big board at his position ──
function DraftCard({ rank, row, isPlayer, v, userName, photo = null }) {
  const short = isPlayer ? v.team.short : row?.team
  return (
    <div className={`goat-card${isPlayer ? ' goat-card--you' : ''}`} style={{ '--accent': isPlayer ? '#e8a820' : (v.T(short)?.color ?? 'rgba(255,255,255,0.15)') }}>
      <span className="goat-card-rank">{rank}</span>
      <QBAvatar photo={photo} team={short ? `cfb/${short}` : null} color={v.T(short)?.color} size={isPlayer ? 56 : 44} />
      <div className="goat-card-info">
        <span className="goat-card-name">{isPlayer ? <NameTag name={userName} self /> : (row?.name ?? '—')}</span>
        {short && <span className="goat-card-team">{v.school(short)}{row?.year ? ` · ${row.year}` : ''}</span>}
      </div>
    </div>
  )
}
function DraftPage({ v, pos, userName, userYear, live, photo, photoOf, onNext }) {
  const d = v.c.draft
  const board = d?.board ?? []
  const [phase, setPhase] = useState(live && !reduced() ? 'checking' : 'revealed')
  const listRef = useRef(null)
  useEffect(() => {
    if (phase !== 'checking') return
    const t = setTimeout(() => { setPhase('revealed'); setTimeout(() => listRef.current?.querySelector('.goat-card--you')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 700) }, 1800)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const rank = d?.boardRank ?? null
  const label = String(pos).toUpperCase()
  const year = d?.draftYear ?? 2027
  const onBoard = rank != null && rank <= board.length
  const cta = <button className="simp-cta simp-cta-in" onClick={onNext} style={{ marginBottom: 8 }}>Final Report →</button>
  return (
    <div className="simp-screen goat-screen cfbp-draft">
      <div className="goat-screen-title">DRAFT STOCK</div>
      <div className="goat-page-title">{year} NFL Draft</div>
      <div className="goat-eyebrow">TOP {Math.min(25, board.length || 25)} {POS_PLURAL[pos] ?? label} ON THE BOARD</div>
      {phase === 'checking' && <Checking label="Reading the board…" />}
      {phase === 'revealed' && !d && cta}
      {phase === 'revealed' && d && (
        <>
          <div className="goat-miss-card">
            <div className="goat-miss-title">{rank ? `No. ${rank} ${label} on the board` : `${userName} · ${userYear ?? d.year}`}</div>
            {/* (an underclassman who stays: that's the news, the board's grade under it) */}
            <div className="goat-miss-ovr cfbp-draft-tier">{d.eligible === false ? 'Not draft-eligible yet' : !d.declares ? 'Returns to school' : d.label}</div>
            {d.eligible !== false && !d.declares ? <div className="cfbp-draft-note">Board grade: {String(d.label).replace(/^Projected /, '').toLowerCase()}</div>
              : d.note && <div className="cfbp-draft-note">{d.note}</div>}
          </div>
          {cta}
          {board.length > 0 && (
            <div ref={listRef} className="goat-full-list goat-list-in">
              {board.map((row, i) => <DraftCard key={i} rank={i + 1} row={row} isPlayer={row.isUser} v={v} userName={userName} photo={row.isUser ? photo : photoOf?.(row.name, row.team)} />)}
              {rank && !onBoard && (
                <>
                  <div className="cfbp-draft-gap" aria-hidden="true">···</div>
                  <DraftCard rank={rank} row={{ year: userYear ?? d.year }} isPlayer v={v} userName={userName} photo={photo} />
                </>
              )}
            </div>
          )}
          {board.length > 0 && <button className="simp-cta simp-cta-in" onClick={onNext} style={{ marginTop: 12 }}>Final Report →</button>}
        </>
      )}
    </div>
  )
}

// ── FINAL REPORT ────────────────────────────────────────────────────────────
function Honors({ v, pos, userName }) {
  const a = v.c.awards ?? {}
  if (a.lite) return null
  const who = x => (x?.isUser ? userName : x ? `${x.name}, ${v.school(x.team)}` : '–')
  const h = a.heisman
  const rows = []
  if (h) rows.push({ name: 'Heisman Trophy', state: h.userWon ? 'WINNER' : h.userFinalist ? 'FINALIST' : h.userPlace ? `${ordinal(h.userPlace).toUpperCase()} IN VOTING` : null, won: !!h.userWon, sub: h.userWon ? null : h.winner ? `Won by ${who(h.winner)}` : null })
  for (const k of [POS_AWARD[pos], 'maxwell', 'walterCamp']) {
    const x = a[k]
    if (x) rows.push({ name: x.award, state: x.userWon ? 'WINNER' : x.userFinalist ? 'FINALIST' : null, won: !!x.userWon, sub: x.userWon ? null : x.winner ? `Won by ${who(x.winner)}` : null })
  }
  const ac = a.allConference
  rows.push({ name: 'All-American', state: a.allAmerica?.user ? `${a.allAmerica.user.toUpperCase()} TEAM` : null, won: a.allAmerica?.user === 'first' })
  if (ac) rows.push({ name: `All-${ac.conf ?? v.conf?.short ?? 'Conference'}`, state: ac.user ? `${ac.user.toUpperCase()} TEAM` : null, won: ac.user === 'first' })
  if (a.confPOY) rows.push({ name: a.confPOY.award, state: a.confPOY.userWon ? 'WINNER' : null, won: !!a.confPOY.userWon, sub: a.confPOY.userWon ? null : a.confPOY.winner ? `Won by ${who(a.confPOY.winner)}` : null })
  return (
    <ul className="cfbs-awards">
      {rows.map(x => (
        <li key={x.name} className={x.won ? 'is-won' : x.state ? 'is-part' : 'is-none'}>
          <span>{x.name}{x.sub && <small>{x.sub}</small>}</span><b>{x.state ?? '–'}</b>
        </li>
      ))}
    </ul>
  )
}
function FinalPage({ r, v, pos, build, types, attrMap, archetype, userName, story, rewards, endActions, onDraft, onAgain }) {
  const c = v.c
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), 200); return () => clearTimeout(t) }, [])
  const full = { ...r, ...(c.totals?.full ?? {}), games: [...v.reg, ...v.post] }
  if (pos === 'qb' && full.seasonEff != null) full.seasonRating = Math.round(full.seasonEff * 10) / 10
  const rows = rowsOf(build, types, attrMap)
  const tier = v.champs ? 'sfb-champ' : c.cfpSeed || c.bowl?.won || c.confChamp ? 'sfb-elim' : 'sfb-miss'
  const subBits = [c.confChamp ? `${v.conf?.short ?? 'Conference'} Champions` : null, `${v.record} Season`, `OVR ${r.ovr}`].filter(Boolean)
  const best = r.bestGame
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
  return (
    <div className="simp-screen">
      {rewards && <SeasonRewards result={r} />}
      {story && <SeasonStory story={story} pos={pos} sport="nfl" name={userName} />}
      <div className={`simp-final-banner ${tier}`}>
        <div className="sfb-outcome">{v.headline}</div>
        <div className="sfb-sub">{subBits.join(' · ')}</div>
      </div>
      <ShareSeasonButton card={shareCard} />
      {v.post.length > 0 && <PlayoffLog title="Postseason Game Log" rounds={logRows(v.post, v)} />}
      <Figure pos={pos} build={build} team={v.team} />
      <div className="simp-stat-section">
        <div className="simp-eyebrow">Production</div>
        <StatLineTable result={full} build={build} ready={show} userName={userName} kind={pos} />
      </div>
      <div className="simp-stat-section">
        <div className="simp-eyebrow">Honors</div>
        <Honors v={v} pos={pos} userName={userName} />
      </div>
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
            <span className="sbg-opp">{best.home && !best.neutral ? 'vs' : best.neutral ? 'vs' : '@'} {v.school(best.oppShort)}</span>
            <span className="sbg-line">{gameLine(best, pos)}</span>
          </div>
        </div>
      )}
      <div className="simp-final-actions">
        {endActions ?? (
          <>
            <button className="simp-cta" onClick={() => { sfx('tap'); onDraft?.() }}>Enter the NFL Draft</button>
            <button className="simp-ghost" onClick={() => { sfx('tap'); onAgain?.() }}>New {CFB_POS[pos].label} Build</button>
          </>
        )}
      </div>
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
const OLD_STAGE = ['reg', 'ccg', 'sel', 'post', 'post', 'draft']
function pageFrom(stage, pages) {
  let id = typeof stage === 'string' ? stage : typeof stage === 'number' ? (OLD_STAGE[Math.max(0, Math.min(5, Math.floor(stage)))] ?? 'reg') : pages[0]
  if (!pages.includes(id)) id = id === 'ccg' ? 'sel' : id === 'pre' ? 'reg' : pages[0]
  return id
}

// (photoOf(name, school): a real player's headshot, for the draft board and the Heisman. A Career's college seasons: endActions in place of the mode's own buttons, roleNote beside his name, userYear his class,
// season the year on the graphic, rewards false when the season isn't booked here, no build: no pre-season page)
export default function CFBSimPage({ result: r, pos, userName, teams, archetype, build = null, types = null, attrMap = null, nav = null, story: storyIn = null, onStory, photoOf = null,
  stage: stageIn = 0, onStage, onAgain, onDraft, onHome, endActions = null, roleNote = null, userYear = null, season = null, rewards = true }) {
  const v = useMemo(() => view(r, teams), [r, teams])
  const titleWeek = !!(v.ccg || v.c.myStanding?.title)
  const pages = useMemo(() => [build ? 'pre' : null, 'reg', titleWeek ? 'ccg' : null, 'sel', 'post', 'draft', 'final'].filter(Boolean), [build, titleWeek])
  const [page, setPage] = useState(() => pageFrom(stageIn, pages))
  // the page came up from its button (play it live) or from a save (show it played out). The regular season from
  // an older save's 0 (or a Career's first look, which starts there) plays live, as it always did
  const [fresh, setFresh] = useState(() => (typeof stageIn !== 'string' && pageFrom(stageIn, pages) === 'reg' ? 'reg' : null))
  const [story, setStory] = useState(storyIn)
  const [heis, setHeis] = useState(false)
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
  const polls = v.ranks.filter(p => !/^final/i.test(p.label))
  const apAt = page === 'pre' ? v.ranks[0]?.ap
    : page === 'reg' ? (() => { const sh = v.reg.slice(0, weeks); const lw = weekNo(sh[sh.length - 1]?.meta?.label ?? 'Preseason'); const ps = polls.filter(p => weekNo(p.label) <= (weeks ? lw + 1 : 0)); return ps[ps.length - 1]?.ap })()
    : page === 'draft' || page === 'final' ? v.finalRank
    : polls[polls.length - 1]?.ap
  const apLine = apAt ? `${(page === 'draft' || page === 'final') ? 'FINAL AP' : 'AP'} NO. ${apAt}` : null
  const confShort = v.conf?.short ?? ''
  const team = v.team

  const regNext = pages.includes('ccg') ? (v.ccg ? `${confShort} Championship` : 'Championship Week') : 'Selection Day'
  const photo = null   // (his card carries the school's logo, as football's GOAT list and MVP card do: no borrowed face)

  let el
  if (page === 'pre') el = <PrePage r={r} pos={pos} build={build} types={types} attrMap={attrMap} archetype={archetype} team={team} onNext={() => go('reg')} />
  else if (page === 'reg') el = <RegPage key="reg" r={r} v={v} pos={pos} build={build} userName={userName} live={fresh === 'reg'} nextLabel={regNext} onNext={() => go(after('reg'))} onWeeks={setWeeks} onStory={s => { setStory(s); onStory?.(s) }} />
  else if (page === 'ccg') el = <CcgPage key="ccg" v={v} live={fresh === 'ccg'} onNext={() => go('sel')} />
  else if (page === 'sel') el = <SelPage v={v} onNext={() => go('post')} />
  else if (page === 'post') el = <PostPage key="post" v={v} live={fresh === 'post'} onNext={() => { tapGuard.mark(); setHeis(true) }} />
  else if (page === 'draft') el = <DraftPage key="draft" v={v} pos={pos} userName={userName} userYear={userYear} live={fresh === 'draft'} photo={photo} photoOf={photoOf} onNext={() => go('final')} />
  else el = <FinalPage r={r} v={v} pos={pos} build={build} types={types} attrMap={attrMap} archetype={archetype ?? r.archetype} userName={userName} story={story} rewards={rewards} endActions={endActions} onDraft={onDraft} onAgain={onAgain} />

  return (
    <>
      {nav}
      <div className={`simp-page cfbp${v.champs && (page === 'final' || page === 'draft') ? ' is-champ' : ''}`} style={{ '--team-color': team.color, '--team-color2': team.color2 }} onClickCapture={tapGuard.onClickCapture}>
        <div className="simp-col">
          {!nav && (
            <div className="cfbp-top">
              <span className="cfbs-top-brand">COLLEGE FOOTBALL <i>·</i> {season_} SEASON{r.sandbox ? <em> · SANDBOX</em> : null}</span>
              <button className="ag-round-btn" onClick={onHome} aria-label="Home"><IconClose size={16} /></button>
            </div>
          )}
          <div className="simp-top-bar">
            {page === 'draft' && <button className="simp-back-btn" onClick={() => { setFresh(null); setPage('post'); onStage?.('post') }}>← Back</button>}
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
                {roleNote && <span className="cfbp-role">{userName} · {CFB_POS[pos].label} · {roleNote}</span>}
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
        {heis && <HeismanModal v={v} pos={pos} userName={userName} season={season_} photo={photo} photoOf={photoOf} onDismiss={() => { setHeis(false); go('draft') }} />}
      </div>
    </>
  )
}
