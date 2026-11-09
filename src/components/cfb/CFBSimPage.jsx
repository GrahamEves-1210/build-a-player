import { useEffect, useMemo, useRef, useState } from 'react'
import { PlayoffGame } from '../LiveGame'
import { IconClose } from '../app/icons'
import { SeasonRewards, WeekStrip } from '../app/AppSeason'
import { Wire, Milestones, useDirectedReveal } from '../app/AppSeasonPlus'
import { Pulse } from '../simFlow'
import { createDirector, registerDirector } from '../../lib/seasonDirector'
import { sfx } from '../../lib/juice'
import { cfbLogo, cfbLogoDark, CFB_POS } from './cfbShared'

// ── College Football: the season screen ─────────────────────────────────────
// A college broadcast package: deep navy, NCAA blue, white type. It plays out in stages, each one
// dropping in under the last, each opened by a button that says what comes next (football's sim
// seasons play out the same way):
//   0 the regular season, week by week (the schedule, the AP poll moving, key games, his game log)
//   1 conference championship week (the standings, the title game)
//   2 selection day (the CFP's final Top 25 and the 12-team field)
//   3 the Playoff or the bowl (the bracket, his games, the national title)
//   4 the awards (the Heisman ceremony, the position awards, the honors)
//   5 draft stock (and from there, ENTER THE NFL DRAFT)
// The player is the username (or Guest), never "you". Motion is one-shot and Reduce Motion skips it.
// (reads runCFBSimulation's result, utils/cfbSimulation.js: football's keys plus result.cfb. view() gathers it)

const POS_AWARD = { qb: 'daveyOBrien', wr: 'biletnikoff', rb: 'doakWalker' }
const reduced = () => document.documentElement.classList.contains('bap-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const n = v => (v == null || Number.isNaN(+v) ? '–' : Math.round(+v).toLocaleString())
const f1 = v => (v == null || Number.isNaN(+v) ? '–' : (+v).toFixed(1))
const ROUND_SHORT = { 'First Round': 'FIRST ROUND', Quarterfinal: 'QUARTERFINALS', Semifinal: 'SEMIFINALS', 'National Championship': 'TITLE GAME' }
const LAST = 5
// The regular season plays out on football's season director (lib/seasonDirector.js), the season exactly as
// simulated (locked: the polls, the Playoff and the awards come from these games): the record, the pulse, the wire,
// the milestones and the week strip, game by game. College's own: no NFL record chase, no "clinched a playoff
// berth" (six wins is a bowl, the committee picks the twelve), the school's nickname in the headlines
const CFB_COUNTS = {
  qb: { seasonPassYds: 'passYds', seasonTDs: 'tds', seasonINTs: 'ints', seasonRushYds: 'rushYds', seasonRushTDs: 'rushTDs', seasonSacks: 'sacks' },
  rb: { seasonRushYds: 'rushYds', seasonRushTDs: 'rushTDs', seasonCarries: 'carries', seasonRecYds: 'recYds', seasonRecTDs: 'recTDs', seasonRecs: 'recs', seasonFumbles: 'fumbles' },
  wr: { seasonRecs: 'rec', seasonRecYds: 'recYds', seasonRecTDs: 'recTDs', seasonTargets: 'targets' },
}
registerDirector('cfb', { counts: CFB_COUNTS, lines: { clinch: 99, out: -99 }, nick: t => t?.mascot ?? t?.school ?? t?.name, totals: () => {} })
const weekNo = label => (/^pre/i.test(label) ? 0 : /^final/i.test(label) ? 99 : Number(String(label).replace(/\D+/g, '')) || 0)
const pollShort = label => (/^pre/i.test(label) ? 'PRE' : /^final/i.test(label) ? 'FINAL' : `W${weekNo(label)}`)
const yardsOf = (g, pos) => (pos === 'qb' ? (g.passYds ?? 0) + (g.rushYds ?? 0) : pos === 'rb' ? (g.rushYds ?? 0) + (g.recYds ?? 0) : (g.recYds ?? 0))

// the result, in the shape this screen draws
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
  const cfpGames = after.filter(g => g.round && g.round !== 'Bowl')
  const lastCfp = cfpGames[cfpGames.length - 1]
  const champs = !!r.champion
  const confTitle = c.confChamp ? `${conf?.short ?? 'CONFERENCE'} CHAMPIONS · ` : ''
  const headline = champs ? 'NATIONAL CHAMPIONS'
    : c.cfpSeed ? `${confTitle}CFP ${String(lastCfp?.round ?? '').toUpperCase()}${lastCfp && !lastCfp.won ? ` · LOST TO ${school(lastCfp.oppShort).toUpperCase()}` : ''}`
    : c.bowl ? `${confTitle}${c.bowl.won ? 'WON' : 'LOST'} THE ${String(c.bowl.bowl ?? c.bowl.label).toUpperCase()}`
    : `${confTitle}NO BOWL`
  const rec = gs => `${gs.filter(g => g.won).length}-${gs.filter(g => !g.won).length}`
  return { c, team, T, school, conf, reg, post, ccg, after, ranks, finalRank, champs, headline, rec, record: c.record?.final ?? `${r.wins}-${r.losses}` }
}

// a section's header: the NCAA blue label block and a hairline
const Hd = ({ children, sub }) => (
  <div className="cfbs-hd"><h2>{children}</h2>{sub && <small>{sub}</small>}<i aria-hidden="true" /></div>
)
// on the navy: ESPN's dark-background logo; on a white plate: the regular one
const Logo = ({ short, size = 28, light = false }) => (
  <img className="cfbs-logo" src={light ? cfbLogo(short) : cfbLogoDark(short)} alt="" width={size} height={size} loading="lazy" draggable={false}
    onError={e => { if (!light && !e.currentTarget.dataset.f) { e.currentTarget.dataset.f = 1; e.currentTarget.src = cfbLogo(short) } else e.currentTarget.style.visibility = 'hidden' }} />
)

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
// the poll, week by week: where he stood and how far he moved
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

// the player's season, as the graphic puts it up
function statLine(t, pos) {
  if (!t) return []
  if (pos === 'qb') return [['PASS YDS', n(t.seasonPassYds)], ['TD', n(t.seasonTDs)], ['INT', n(t.seasonINTs)], ['CMP%', f1(t.seasonCompPct)], ['RUSH YDS', n(t.seasonRushYds)]]
  if (pos === 'rb') return [['RUSH YDS', n(t.seasonRushYds)], ['TD', n((t.seasonRushTDs ?? 0) + (t.seasonRecTDs ?? 0))], ['YPC', f1(t.seasonYPC)], ['REC', n(t.seasonRecs)], ['REC YDS', n(t.seasonRecYds)]]
  return [['REC', n(t.seasonRecs)], ['YDS', n(t.seasonRecYds)], ['TD', n(t.seasonRecTDs)], ['YPR', f1(t.seasonYPR)], ['LONG', n(t.seasonLong)]]
}
const gameLine = (g, pos) => {
  if (pos === 'qb' && g.att === 0 && !g.rushAtt) return 'Did not play'
  if (pos === 'wr' && g.targets === 0) return 'No targets'
  if (pos === 'qb') return g.att != null ? `${g.comp}/${g.att}, ${n(g.passYds)} yds, ${g.tds ?? 0} TD${g.ints ? `, ${g.ints} INT` : ''}${g.rushTDs ? ` · ${g.rushTDs} rush TD` : ''}` : ''
  if (pos === 'rb') return g.carries != null ? `${g.carries} car, ${n(g.rushYds)} yds, ${(g.rushTDs ?? 0) + (g.recTDs ?? 0)} TD` : ''
  return g.rec != null ? `${g.rec} rec, ${n(g.recYds)} yds${g.recTDs ? `, ${g.recTDs} TD` : ''}` : ''
}
const postLabel = g => (g.round === 'Conference Championship' ? (g.title ?? 'CONF TITLE') : g.round === 'National Championship' ? 'NATL TITLE' : g.bowl ?? g.label ?? g.round).toUpperCase()

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

// his game log: the box score lines, game by game, with the totals
const LOG = {
  qb: [['C/ATT', g => (g.att != null ? `${g.comp}/${g.att}` : '–')], ['YDS', g => n(g.passYds)], ['TD', g => n(g.tds)], ['INT', g => n(g.ints)], ['RUSH', g => n(g.rushYds)], ['RTD', g => n(g.rushTDs)]],
  rb: [['CAR', g => n(g.carries)], ['YDS', g => n(g.rushYds)], ['TD', g => n(g.rushTDs)], ['REC', g => n(g.recs)], ['RYDS', g => n(g.recYds)], ['LONG', g => n(g.long)]],
  wr: [['TGT', g => n(g.targets)], ['REC', g => n(g.rec)], ['YDS', g => n(g.recYds)], ['TD', g => n(g.recTDs)], ['LONG', g => n(g.long)]],
}
function GameLog({ games, v, pos, totals }) {
  const cols = LOG[pos]
  const tot = pos === 'qb' ? [`${n(totals?.seasonCompletions)}/${n(totals?.seasonAttempts)}`, n(totals?.seasonPassYds), n(totals?.seasonTDs), n(totals?.seasonINTs), n(totals?.seasonRushYds), n(totals?.seasonRushTDs)]
    : pos === 'rb' ? [n(totals?.seasonCarries), n(totals?.seasonRushYds), n(totals?.seasonRushTDs), n(totals?.seasonRecs), n(totals?.seasonRecYds), n(totals?.seasonLong)]
    : [n(totals?.seasonTargets), n(totals?.seasonRecs), n(totals?.seasonRecYds), n(totals?.seasonRecTDs), n(totals?.seasonLong)]
  return (
    <div className="cfbs-log-scroll">
      <table className="cfbs-log">
        <thead><tr><th className="is-l">WK</th><th className="is-l">OPP</th><th>RES</th>{cols.map(([k]) => <th key={k}>{k}</th>)}</tr></thead>
        <tbody>
          {games.map((g, i) => (
            <tr key={i} className={g.won ? '' : 'is-l'}>
              <td className="is-l">{g.post ? postLabel(g).split(' ')[0] : weekNo(g.meta?.label ?? g.wk)}</td>
              <td className="is-l">{g.home && !g.neutral ? '' : g.neutral ? 'n ' : '@'}{v.T(g.oppShort).short ?? g.oppShort}</td>
              <td>{g.won ? 'W' : 'L'} {g.mySc}-{g.oppSc}</td>
              {cols.map(([k, f]) => <td key={k}>{f(g)}</td>)}
            </tr>
          ))}
        </tbody>
        {totals && <tfoot><tr><td className="is-l" colSpan={3}>TOTAL</td>{tot.map((x, i) => <td key={i}>{x}</td>)}</tr></tfoot>}
      </table>
    </div>
  )
}

// the games that made the regular season: the biggest win, the one that got away, his best day
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
  return (
    <div className="cfbs-keys">
      {cards.map(({ k, g }) => (
        <div key={k} className={`cfbs-key${g.won ? '' : ' is-l'}`}>
          <small>{k} · WK {weekNo(g.meta?.label ?? g.wk)}</small>
          <span className="cfbs-key-opp"><Logo short={g.oppShort} size={30} /><b>{g.meta?.oppRank ? <em>{g.meta.oppRank}</em> : null}{v.school(g.oppShort)}</b><strong>{g.won ? 'W' : 'L'} {g.mySc}-{g.oppSc}</strong></span>
          <span className="cfbs-key-line">{gameLine(g, pos)}</span>
        </div>
      ))}
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

function Standings({ v, final = false }) {
  const s = v.c.myStanding
  if (!s) return null
  const t = s.title
  const me = v.team.short
  return (
    <>
      <table className="cfbs-table">
        <thead><tr><th /><th className="is-team">TEAM</th><th>CONF</th><th>{final ? 'FINAL' : 'ALL'}</th></tr></thead>
        <tbody>
          {s.teams.map((x, i) => (
            <tr key={x.short} className={x.short === me ? 'is-me' : undefined}>
              <td className="is-n">{i + 1}</td>
              <td className="is-team"><Logo short={x.short} size={20} /><span>{x.ap ? <em>{x.ap}</em> : null}{v.school(x.short)}</span>{x.short === s.champion && <i className="cfbs-champ">CHAMP</i>}</td>
              <td>{x.confW}-{x.confL}</td>
              <td>{final ? (x.final ?? `${x.finalW ?? x.w}-${x.finalL ?? x.l}`) : (x.selection ?? `${x.w}-${x.l}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {t ? (
        <Match v={v} title={t.title ?? `${s.short} Championship`} site={[v.ccg?.site, v.ccg?.date].filter(Boolean).join(' · ') || null} a={t.a} b={t.b} aSc={t.aSc} bSc={t.bSc} winner={t.winner}
          foot={t.winner === me ? `${v.school(me).toUpperCase()} · ${String(s.short).toUpperCase()} CHAMPIONS` : `${v.school(t.winner).toUpperCase()} WIN THE ${String(s.short).toUpperCase()}`} />
      ) : <p className="cfbs-note">{s.short === 'Independents' ? 'Independents play no title game.' : `${s.short} champion: ${v.school(s.champion)}`}</p>}
      {v.ccg && <p className="cfbs-note"><b>{v.ccg.title}:</b> {gameLine(v.ccg, v.pos)}</p>}
    </>
  )
}

// Selection day: the committee's final Top 25 and the 12 in the field
function Selection({ v }) {
  const c = v.c
  const me = v.team.short
  const last = c.cfpRankings?.[c.cfpRankings.length - 1]
  const field = c.playoff?.field ?? []
  const myRank = last?.top25?.find(t => t.short === me)?.rank ?? null
  return (
    <>
      <p className="cfbs-note">{c.cfpSeed
        ? <><b>{v.school(me)} is in: the No. {c.cfpSeed} seed</b>{c.cfpSeed <= 4 ? ', with a first-round bye' : c.cfpSeed <= 8 ? ', at home in the first round' : ', on the road in the first round'}.</>
        : <><b>{v.school(me)} is out</b>{myRank ? `, No. ${myRank} in the final rankings` : ', unranked in the final rankings'}{c.bowl ? `. ${c.bowl.bowl ?? c.bowl.label} bound.` : '.'}</>}</p>
      <ol className="cfbs-field" aria-label="The 12-team field">
        {field.map(f => (
          <li key={f.short} className={f.short === me ? 'is-me' : undefined}>
            <em>{f.seed}</em><Logo short={f.short} size={24} />
            <span><b>{v.school(f.short)}</b><small>{f.rec} · {f.conf}</small></span>
            <i className={f.bid === 'auto' ? 'is-auto' : ''}>{f.bid === 'auto' ? 'AUTO BID' : 'AT-LARGE'}</i>
          </li>
        ))}
      </ol>
      {last && (
        <>
          <h3 className="cfbs-sub">CFP RANKINGS · {String(last.label).toUpperCase()}</h3>
          <ol className="cfbs-top25">
            {last.top25.map(t => (
              <li key={t.short} className={t.short === me ? 'is-me' : undefined}><em>{t.rank}</em><Logo short={t.short} size={18} /><span>{v.school(t.short)}</span><small>{t.rec}</small></li>
            ))}
          </ol>
        </>
      )}
    </>
  )
}

// The 12-team Playoff: first round on campus, the quarterfinal and semifinal bowls, the title game
function Bracket({ v }) {
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

function Postseason({ v, pos }) {
  const c = v.c
  const me = v.team.short
  const fin = c.playoff?.games?.find(g => g.round === 'National Championship')
  const bowl = c.bowl
  return (
    <>
      {v.after.length > 0 && <ol className="cfbs-sched">{v.after.map((g, i) => <GameRow key={i} g={g} v={v} pos={pos} />)}</ol>}
      {!c.cfpSeed && !bowl && <p className="cfbs-note"><b>{v.school(me)}</b> stayed home for the bowls.</p>}
      {bowl && (
        <Match v={v} title={bowl.bowl ?? bowl.label} site={[bowl.site, bowl.date].filter(Boolean).join(' · ')} a={me} b={bowl.oppShort} aSc={bowl.mySc} bSc={bowl.oppSc} winner={bowl.won ? me : bowl.oppShort} />
      )}
      <h3 className="cfbs-sub">THE PLAYOFF</h3>
      <Bracket v={v} />
      {fin && (
        <Match v={v} className="cfbs-title" title="CFP National Championship" site={[fin.site, fin.date].filter(Boolean).join(' · ')} a={fin.hi} b={fin.lo} aSeed={fin.hiSeed} bSeed={fin.loSeed} aSc={fin.hiSc} bSc={fin.loSc} winner={fin.winner}
          foot={`${v.school(fin.winner).toUpperCase()} · NATIONAL CHAMPIONS`} />
      )}
    </>
  )
}

// The Heisman ceremony: the finalists in New York, then the name. One reveal, when it comes into view
function Heisman({ h, v, userName }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!h) return
    if (reduced()) { setShown(true); return }
    const el = ref.current
    let t
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) { io.disconnect(); t = setTimeout(() => { setShown(true); if (h.userWon) sfx('complete', 2) }, 1400) }
    }, { threshold: 0.5 })
    io.observe(el)
    return () => { io.disconnect(); clearTimeout(t) }
  }, [h])
  if (!h) return null
  const fin = h.finalists ?? []
  const w = h.winner
  const isWinner = f => (f.isUser && w?.isUser) || (f.name === w?.name && f.team === w?.team)
  const nameOf = f => (f.isUser ? userName : f.name)
  return (
    <div ref={ref} className={`cfbs-heis${shown ? ' is-shown' : ''}`}>
      <div className="cfbs-heis-hd"><b>THE HEISMAN TROPHY</b><small>NEW YORK CITY</small></div>
      <p className="cfbs-heis-call" aria-live="polite">{shown && w
        ? <>The Heisman Trophy goes to <b>{nameOf(w)}</b>, {v.school(w.team)}</>
        : 'The finalists'}</p>
      <ol className="cfbs-heis-list">
        {fin.map((f, i) => (
          <li key={`${f.name}-${i}`} className={`${f.isUser ? 'is-me' : ''}${shown && isWinner(f) ? ' is-win' : ''}`}>
            <Logo short={f.team} size={30} />
            <span className="cfbs-heis-who"><b>{nameOf(f)}</b><small>{f.pos} · {v.school(f.team)}{(f.isUser && v.userYear ? v.userYear : f.year) ? ` · ${f.isUser && v.userYear ? v.userYear : f.year}` : ''}</small></span>
            <span className="cfbs-heis-line">{f.line}</span>
            <span className="cfbs-heis-pts">{shown && f.pts != null ? <><b>{n(f.pts)}</b><small>PTS</small></> : null}</span>
          </li>
        ))}
      </ol>
      {!h.userFinalist && (
        <p className="cfbs-note cfbs-heis-me">{h.userPlace ? `${userName} finished ${ordinal(h.userPlace)} in the voting.` : `${userName} didn't get Heisman votes.`}</p>
      )}
    </div>
  )
}
const ordinal = k => `${k}${(k % 100 > 10 && k % 100 < 14) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[k % 10] ?? 'th'}`

function Awards({ v, pos, userName }) {
  const a = v.c.awards ?? {}
  const who = x => (x?.isUser ? userName : x ? `${x.name}, ${v.school(x.team)}` : '–')
  const rows = [POS_AWARD[pos], 'maxwell', 'walterCamp'].map(k => a[k]).filter(Boolean).map(x => ({
    name: x.award, state: x.userWon ? 'WINNER' : x.userFinalist ? 'FINALIST' : null, won: !!x.userWon, sub: x.userWon ? null : `Won by ${who(x.winner)}`,
  }))
  const ac = a.allConference
  rows.push(
    { name: 'All-American', state: a.allAmerica?.user ? `${a.allAmerica.user.toUpperCase()} TEAM` : null, won: a.allAmerica?.user === 'first' },
    { name: `All-${ac?.conf ?? v.conf?.short ?? 'Conference'}`, state: ac?.user ? `${ac.user.toUpperCase()} TEAM` : null, won: ac?.user === 'first' },
  )
  if (a.confPOY) rows.push({ name: a.confPOY.award, state: a.confPOY.userWon ? 'WINNER' : null, won: !!a.confPOY.userWon, sub: a.confPOY.userWon ? null : `Won by ${who(a.confPOY.winner)}` })
  return (
    <>
      <Heisman h={a.heisman} v={v} userName={userName} />
      <ul className="cfbs-awards">
        {rows.map(x => (
          <li key={x.name} className={x.won ? 'is-won' : x.state ? 'is-part' : 'is-none'}>
            <span>{x.name}{x.sub && <small>{x.sub}</small>}</span><b>{x.state ?? '–'}</b>
          </li>
        ))}
      </ul>
    </>
  )
}

// where he'd go: a seven-round board and his mark on it
function Draft({ d, userName, pos, yr = null }) {
  if (!d) return null
  const [lo, hi] = Array.isArray(d.round) ? d.round : d.round ? [d.round, d.round] : [null, null]
  const on = k => (k === 8 ? lo == null : lo != null && k >= lo && k <= hi)
  return (
    <div className="cfbs-draft">
      <div className="cfbs-draft-top">
        <small>{userName} · {CFB_POS[pos].label} · {yr ?? d.year}</small>
        <b>{String(d.label).toUpperCase()}</b>
        {d.note && <em>{d.note}</em>}
      </div>
      <ol className="cfbs-draft-board" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(k => <li key={k} className={on(k) ? 'is-on' : undefined}><span>{k === 8 ? 'UDFA' : `RD ${k}`}</span></li>)}
      </ol>
    </div>
  )
}

// the button that plays the next part of the season
// One of his postseason games, live: the round, the schools, the clock and each score as it lands
const isCfp = g => !!g.round && g.round !== 'Bowl' && g.round !== 'Conference Championship'
// a school color that shows on the dark scoreboard (Notre Dame's navy doesn't: its gold does)
const lum = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? ''); if (!m) return 0.5; const n = parseInt(m[1], 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 }
const onDark = t => { const a = t.color ?? '#0a3d91', b = t.color2; return lum(a) < 0.22 && b && lum(b) > lum(a) && lum(b) < 0.95 ? b : lum(a) < 0.22 ? '#4f8fe8' : a }
function LiveGame({ v, g, onDone }) {
  // each game comes into view as it starts
  const box = useRef(null)
  useEffect(() => { const t = setTimeout(() => box.current?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' }), 120); return () => clearTimeout(t) }, [])
  const ccg = g.round === 'Conference Championship'
  const bowl = g.bowl ?? g.label ?? 'Bowl'
  const round = ccg ? (g.title ?? `${v.conf?.short ?? 'Conference'} Championship`)
    : !isCfp(g) ? bowl
    : g.round === 'National Championship' ? 'CFP National Championship'
    : `CFP ${g.round}${g.bowl ? ` · ${g.bowl}` : ''}`
  const fin = ccg || !isCfp(g) || g.round === 'National Championship'
  const side = g.teamShort ? (v.T(g.teamShort) ?? { short: g.teamShort }) : v.team
  const champ = g.other ? `✓ ${v.school(g.teamShort)} win the ${v.conf?.short ?? 'conference'} title` : ccg ? `✓ ${v.conf?.short ?? 'Conference'} Champions` : g.round === 'National Championship' ? '✓ National Champions' : `✓ Won the ${bowl}`
  const lost = ccg ? '✗ Lost the title game' : isCfp(g) ? '✗ Eliminated' : `✗ Lost the ${bowl}`
  return (
    <div ref={box}>
    <PlayoffGame
      round={round} opponent={v.school(g.oppShort)} home={!!g.home} weather={null}
      mySc={g.mySc} oppSc={g.oppSc} won={!!g.won} overtime={!!g.ot}
      teamColor={onDark(side)} textColor="#ffffff" teamAbbr={side.short} teamLogo={cfbLogo(side.short)}
      oppLogo={cfbLogo(g.oppShort)} oppAbbr={g.oppShort}
      finalWord={g.neutral || ccg || g.round === 'National Championship' ? round : null}
      isFinal={fin} champWord={champ} lossWord={lost} isAllTime={false} onDone={onDone}
    />
    </div>
  )
}

const Next = ({ label, sub, onClick }) => (
  <div className="cfbs-next-wrap">
    <button className="cfbs-next" onClick={() => { sfx('tap'); onClick() }}><b>{label}</b>{sub && <small>{sub}</small>}</button>
  </div>
)

// (a Career's college seasons: endActions in place of the mode's own buttons, roleNote beside his name, userYear his class,
// season the year on the graphic, rewards false when the season isn't booked here)
export default function CFBSimPage({ result: r, pos, userName, teams, archetype, stage: stageIn = 0, onStage, onBack, onAgain, onPositions, onDraft, onHome, endActions = null, roleNote = null, userYear = null, season = null, rewards = true }) {
  const v = useMemo(() => ({ ...view(r, teams), pos, userYear }), [r, teams, pos, userYear])
  // His postseason games play out live, one at a time, on football's playoff scoreboard (LiveGame.jsx)
  // before the stage's results drop in: the conference title game at stage 1, the Playoff or the bowl at
  // stage 3. While a game is live the page shows the stage before it (no score given away above it)
  const t0 = v.c.myStanding?.title ?? null
  const otherCCG = !v.ccg && t0 ? (() => { const aWon = t0.aSc > t0.bSc, w = aWon ? t0.a : t0.b, l = aWon ? t0.b : t0.a
    return { round: 'Conference Championship', title: t0.title, teamShort: w, oppShort: l, mySc: Math.max(t0.aSc, t0.bSc), oppSc: Math.min(t0.aSc, t0.bSc), won: true, ot: t0.ot, neutral: true, other: true } })() : null
  const liveFor = k => (k === 1 ? (v.ccg ? [v.ccg] : otherCCG ? [otherCCG] : []) : k === 3 ? v.after : [])
  const [live, setLive] = useState(null)   // { stage, i }: the stage being played, his game in it
  const stage = live ? live.stage - 1 : Math.max(0, Math.min(LAST, stageIn))
  const school = v.team.school ?? v.team.name
  const regW = v.reg.filter(g => g.won).length, regL = v.reg.length - regW
  // the regular season plays out a week at a time, once (Reduce Motion, or coming back to it: all at once)
  const [director] = useState(() => (stage > 0 || reduced() ? null
    : createDirector({ sport: 'cfb', pos, build: {}, team: v.team, simFn: () => r, base: { ...r, games: v.reg }, locked: true, seed: String(r.seed ?? 'cfb'), name: userName })))
  const dr = useDirectedReveal({ director, pace: 300, onFinal: null })
  const weeks = director ? dr.k : v.reg.length
  useEffect(() => { if (director && dr.k > 0) sfx('tick') }, [dr.k]) // eslint-disable-line react-hooks/exhaustive-deps
  const playing = !!director && !dr.done
  const shownReg = v.reg.slice(0, weeks)
  // the polls so far: through the week just played, all of them once the season's done
  const lastWk = weekNo(shownReg[shownReg.length - 1]?.meta?.label ?? 'Preseason')
  const polls = stage >= 3 ? v.ranks
    : stage >= 1 ? v.ranks.filter(p => !/^final/i.test(p.label))
    : v.ranks.filter(p => !/^final/i.test(p.label) && weekNo(p.label) <= (weeks ? lastWk + 1 : 0))
  const nowRank = polls[polls.length - 1]?.ap ?? null
  // the scorebug moves with the season
  const recNow = stage >= 3 ? v.record : stage >= 1 ? v.rec([...v.reg, ...(v.ccg ? [v.ccg] : [])]) : `${shownReg.filter(g => g.won).length}-${shownReg.filter(g => !g.won).length}`
  const confShort = String(v.conf?.short ?? 'CONFERENCE').toUpperCase()
  const plate = stage >= 3 ? v.headline
    : stage === 2 ? (v.c.cfpSeed ? `NO. ${v.c.cfpSeed} SEED IN THE PLAYOFF` : v.c.bowl ? `${String(v.c.bowl.bowl ?? v.c.bowl.label).toUpperCase()} BOUND` : 'NO BOWL')
    : stage === 1 ? (v.ccg ? `${confShort} TITLE GAME · ${v.ccg.won ? 'WON' : 'LOST'}` : `${confShort} · ${ordinal((v.c.myStanding?.teams?.findIndex(t => t.short === v.team.short) ?? -1) + 1 || 0).toUpperCase()} IN THE STANDINGS`)
    : playing ? `REGULAR SEASON · WEEK ${lastWk}` : `REGULAR SEASON · ${regW}-${regL}`
  // a new stage drops in under the last: bring it into view
  const secRefs = useRef({})
  const go = k => {
    onStage?.(k)
    if (liveFor(k).length && !reduced()) setLive({ stage: k, i: 0 })
    requestAnimationFrame(() => requestAnimationFrame(() => secRefs.current[k]?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })))
  }
  const sec = (k, children) => (
    <div ref={el => { secRefs.current[k] = el }} className={`cfbs-stage${stage === k && k > 0 ? ' is-new' : ''}`}>{children}</div>
  )
  const nextFor = [
    v.ccg ? { label: `SIMULATE THE ${confShort} TITLE GAME`, sub: `${school} vs ${v.school(v.ccg.oppShort)}` }
      : t0 ? { label: `SIMULATE THE ${confShort} TITLE GAME`, sub: `${v.school(t0.a)} vs ${v.school(t0.b)} · ${school} missed it` }
      : { label: 'CONFERENCE CHAMPIONSHIP WEEK', sub: `${school} missed the ${v.conf?.short ?? 'title'} game` },
    { label: 'SEE THE CFP FIELD', sub: 'Selection day: the final rankings and the 12' },
    v.c.cfpSeed ? { label: 'PLAY THE PLAYOFF', sub: `${school} · No. ${v.c.cfpSeed} seed` } : v.c.bowl ? { label: `PLAY THE ${String(v.c.bowl.bowl ?? v.c.bowl.label).toUpperCase()}`, sub: `${school} vs ${v.school(v.c.bowl.oppShort)}` } : { label: 'SEE BOWL SEASON', sub: 'The bowls and the Playoff' },
    { label: 'THE HEISMAN', sub: 'The ceremony in New York, then the awards' },
    { label: 'SEE HIS DRAFT STOCK', sub: 'Where the scouts have him' },
  ]
  const line = statLine(stage >= 3 ? v.c.totals?.full : v.c.totals?.regular ?? r, pos)
  const logGames = stage >= 3 ? [...v.reg, ...v.post] : stage >= 1 ? [...v.reg, ...(v.ccg ? [v.ccg] : [])] : shownReg
  return (
    <div className={`ag-screen cfb-screen cfbs${stage >= 3 && v.champs ? ' is-champ' : ''}`}>
      <div className="cfbs-top">
        <span className="cfbs-top-brand">COLLEGE FOOTBALL <i>·</i> {season ?? r.year ?? 2026} SEASON{r.sandbox ? <em> · SANDBOX</em> : null}</span>
        <button className="ag-round-btn" onClick={onHome} aria-label="Home"><IconClose size={16} /></button>
      </div>

      {/* the scorebug: school, record, ranking, where the season stands */}
      <header className="cfbs-hero" style={{ '--school': v.team.color ?? '#0a3d91' }}>
        <div className="cfbs-hero-team">
          <span className="cfbs-hero-logo"><Logo short={v.team.short} size={60} light /></span>
          <div>
            <small>{v.conf?.short ?? ''}{stage >= 3 ? (v.finalRank ? ` · FINAL AP NO. ${v.finalRank}` : ' · UNRANKED') : nowRank ? ` · AP NO. ${nowRank}` : ' · UNRANKED'}</small>
            <h1>{school}</h1>
          </div>
          <b className="cfbs-hero-rec">{recNow}</b>
        </div>
        <div className="cfbs-hero-plate">{plate}</div>
        <div className="cfbs-hero-who">
          <b>{userName}</b><span>{CFB_POS[pos].label} · {roleNote ?? archetype ?? r.archetype}</span><em>{r.ovr} OVR</em>
        </div>
      </header>

      <div className="cfbs-body">
        {/* 0 · the regular season */}
        <section className="cfbs-sec">
          <Hd sub={`${shownReg.filter(g => g.won).length}-${shownReg.filter(g => !g.won).length}`}>SCHEDULE</Hd>
          {/* football's live season: the pulse, the wire, the milestones, the week strip */}
          <div className="cfbs-live-season">
            <Pulse games={shownReg} total={v.reg.length} playoffWins={10} />
            {director && <Wire items={dr.headlines} />}
            {director && <Milestones items={dr.fresh} />}
            <WeekStrip games={v.reg.map((g, i) => ({ ...g, wk: weekNo(g.meta?.label ?? g.wk) || i }))} revealed={weeks} />
          </div>
          <ol className="cfbs-sched">
            {shownReg.map((g, i) => <GameRow key={i} g={g} v={v} pos={pos} />)}
            {stage >= 1 && v.ccg && <GameRow g={v.ccg} v={v} pos={pos} />}
            {stage >= 3 && v.after.map((g, i) => <GameRow key={`p${i}`} g={g} v={v} pos={pos} />)}
          </ol>
        </section>
        <section className="cfbs-sec">
          <Hd sub="AP TOP 25">RANKING</Hd>
          <RankPath ranks={polls} />
          <RankMoves ranks={polls} />
        </section>
        {!playing && (
          <>
            <section className="cfbs-sec">
              <Hd sub={`${userName} · ${stage >= 3 ? 'WITH THE POSTSEASON' : 'REGULAR SEASON'}`}>SEASON LINE</Hd>
              <div className="cfbs-stats" style={{ '--n': line.length }}>
                {line.map(([k, val]) => <div key={k}><b>{val}</b><small>{k}</small></div>)}
              </div>
            </section>
            <section className="cfbs-sec">
              <Hd>KEY GAMES</Hd>
              <KeyGames games={v.reg} v={v} pos={pos} />
            </section>
            <section className="cfbs-sec cfbs-sec--wide">
              <Hd sub={userName}>GAME LOG</Hd>
              <GameLog games={logGames} v={v} pos={pos} totals={stage >= 3 ? v.c.totals?.full : stage >= 1 ? v.c.totals?.throughCCG : v.c.totals?.regular} />
            </section>
          </>
        )}

        {stage >= 1 && sec(1, (
          <section className="cfbs-sec">
            <Hd sub={v.conf?.name}>{confShort} CHAMPIONSHIP WEEK</Hd>
            <Standings v={v} final={stage >= 3} />
          </section>
        ))}
        {stage >= 2 && sec(2, (
          <section className="cfbs-sec">
            <Hd sub="12-TEAM FIELD">SELECTION DAY</Hd>
            <Selection v={v} />
          </section>
        ))}
        {stage >= 3 && sec(3, (
          <section className="cfbs-sec">
            <Hd sub={v.c.cfpSeed ? `NO. ${v.c.cfpSeed} SEED` : 'BOWL SEASON'}>{v.c.cfpSeed ? 'COLLEGE FOOTBALL PLAYOFF' : 'POSTSEASON'}</Hd>
            <Postseason v={v} pos={pos} />
          </section>
        ))}
        {stage >= 4 && sec(4, (
          <section className="cfbs-sec">
            <Hd>AWARDS</Hd>
            <Awards v={v} pos={pos} userName={userName} />
          </section>
        ))}
        {stage >= 5 && sec(5, (
          <section className="cfbs-sec">
            <Hd sub={v.c.draft?.draftYear ? `${v.c.draft.draftYear} DRAFT` : null}>NFL DRAFT STOCK</Hd>
            <Draft d={v.c.draft} userName={userName} pos={pos} yr={v.userYear} />
            {rewards && <SeasonRewards result={r} />}
          </section>
        ))}

        {live && sec(live.stage, (
          <section className="cfbs-sec">
            <Hd sub={live.stage === 1 ? v.conf?.name : v.c.cfpSeed ? `NO. ${v.c.cfpSeed} SEED` : 'BOWL SEASON'}>{live.stage === 1 ? `${confShort} CHAMPIONSHIP` : v.c.cfpSeed ? 'COLLEGE FOOTBALL PLAYOFF' : 'POSTSEASON'}</Hd>
            <LiveGame v={v} g={liveFor(live.stage)[live.i]} key={`${live.stage}-${live.i}`} onDone={() => setLive(l => (l && l.i + 1 < liveFor(l.stage).length ? { ...l, i: l.i + 1 } : null))} />
            {live.i > 0 && !liveFor(live.stage)[0]?.other && <ol className="cfbs-sched cfbs-live-log">{liveFor(live.stage).slice(0, live.i).map((g, i) => <GameRow key={i} g={g} v={v} pos={pos} />)}</ol>}
          </section>
        ))}

        {!playing && !live && stage < LAST && <Next {...nextFor[stage]} onClick={() => go(stage + 1)} />}

        {stage >= LAST && endActions}
        {stage >= LAST && !endActions && (
          <div className="cfbs-actions">
            <button className="cfbs-btn is-main is-draft" onClick={() => { sfx('tap'); onDraft?.() }}>ENTER THE NFL DRAFT<small>A new Career, from the combine · {CFB_POS[pos].label}</small></button>
            <button className="cfbs-btn" onClick={() => { sfx('tap'); onAgain() }}>NEW {CFB_POS[pos].label} BUILD</button>
          </div>
        )}
      </div>
    </div>
  )
}
