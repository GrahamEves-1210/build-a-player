import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Silhouette from './Silhouette'
import QBAvatar from './QBAvatar'
import SiteFooter from './SiteFooter'
import { valToGrade } from '../utils/simulation'
import { useCountUp } from '../lib/useCountUp'
import { useTapGuard } from '../lib/tapGuard'
import { useRailOn } from '../lib/ads'
import { IS_APP, APP_LOOK } from '../lib/platform'
import { ShareSeasonButton } from './app/SeasonShare'
import { SOCCER_ATTR, SOCCER_CATEGORIES } from '../data/soccer-attrs'
import { UCL_CLUBS, SOCCER_ALL_CLUBS } from '../data/soccer-clubs'
import { WC_NATIONS, WC_ALL_NATIONS } from '../data/soccer-nations'
import * as SoccerSim from '../utils/soccerSimulation'
import { SOCCER_POOL, SOCCER_SIZE_SLOT } from '../lib/soccerUi'
import { rampAdd } from '../lib/ads'
import { sfx } from '../lib/juice'
import { NameTag } from './app/NameTag'
import { RingCeremony, SeasonRewards } from './app/AppSeason'
import { TrophyArt, TrophyDefs } from './app/TrophyArt'
import { useOnLeave, momentsOn, MomentsToggle, LeadersBoard, Pulse, ProgressDots, SimLoading, useSeasonReveal, useStaged, ChampCard, OverCard, MissCard, WireLine, Checking } from './simFlow'
import { MatchCentre, PlaySwitch, readSpeed, readPlay } from './SoccerMatchDay'
import { wcTableAt, wcOtherGame, uclMatchdays, uclTableAt, uclRoundOf } from '../lib/soccerMatch'
// (lib/seasonDirector.js setMomentsOff, without loading the director)
const setMomentsOff = off => { try { localStorage.setItem('bap_moments_off', off ? '1' : '0') } catch {} }
// The app's season screens run on the website too (as basketball's: BucketSimPage APP_SIM)
const APP_SIM = IS_APP || APP_LOOK

// ═════════════════════════════════════════════════════════════════════════════
// The soccer season page (SoccerApp's 'sim'): basketball's season page (BucketSimPage) in football's colours, the
// same five screens and the same buttons (the flow's pieces: components/simFlow.jsx). It reads a season from
// utils/soccerSimulation.js (its result contract is at the top of that file) and plays it out:
//   a club season (pool 'current', TOP DIVISIONS): the build · the league, match by match (the record ticks, the
//   table, his line, then the Golden Boot and the Player of the Season tallied) · the cups and Europe, every tie
//   played leg by leg on a live scoreboard · the Ballon d'Or (counted down) and the Golden Shoe · the final report.
//   a World Cup (pool 'alltime'): the build · the group · the knockouts, live, over the bracket · the awards
//   (Golden Boot, Golden Ball, Best Young Player) · the final report.
// The season is booked once (onFinal) when the league (or the group) has played out, or when the page is left.
// The striker is always the username (userName), never "You".
// Styling: app-game.css (ssp-*), on the shared sim page frame (simp-*, sts-*).
// ═════════════════════════════════════════════════════════════════════════════

const CLUB_MAP = Object.fromEntries(SOCCER_ALL_CLUBS.map(t => [t.short, t]))
// (an old result's 2026 nations still find their names: WC_ALL_NATIONS; the pick list is the 48 of history)
const NATION_MAP = Object.fromEntries(WC_ALL_NATIONS.map(t => [t.short, t]))
// the tournament's name: the all-time World Cup (WORLD CUP mode since 11-16), or a real year (an old result, Career)
const wcName = (season, fifa = false) => (season === 'All-Time' ? 'All-Time World Cup' : `${fifa ? 'FIFA ' : ''}World Cup ${season ?? ''}`.trim())
const LOGO = { current: '/logos/soccer/', alltime: '/logos/nations/' }
const teamOf = (short, pool) => (pool === 'alltime' ? NATION_MAP : CLUB_MAP)[short] ?? null
import { savePos, saveStop } from '../lib/seasonLive'
const BOOKED = new WeakSet()   // a season is booked once, however often its page opens
const GRADES = ['F', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S']

// how a broadcaster says it: in the Premier League, in the Bundesliga, but in La Liga, in Serie A, in Ligue 1
const inLeague = name => (/^(la liga|serie a|ligue 1)$/i.test(String(name ?? '').trim()) ? String(name) : `the ${name ?? 'league'}`)
// a match he didn't play, and why (soccerSimulation.js planOf; a moment's 'sit it out': seasonDirector)
const DNP_WHY = { inj: 'INJURED', knock: 'KNOCK', bench: 'UNUSED SUB', rest: 'RESTED' }
const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return `${n}${s[(v - 20) % 10] || s[v] || s[0]}` }
const one = v => (v == null || Number.isNaN(+v) ? '–' : (Math.round(v * 10) / 10).toFixed(1))
const pct = v => (v == null ? '–' : `${Math.round(v)}%`)
// a side's 0–100 rating as a grade, against its own pool: the top five leagues' clubs run about 80–100
// (Opta's power rankings), the World Cup's nations about 67–100 (data/soccer-clubs.js, soccer-nations.js)
const SCALE = { current: [78, 100], alltime: [65, 100] }
const teamFrac = (v, pool) => { const [lo, hi] = SCALE[pool] ?? SCALE.current; return Math.max(0, Math.min(1, ((v ?? lo) - lo) / (hi - lo))) }
const teamGrade = (v, pool) => GRADES[Math.round(teamFrac(v, pool) * 11)]
const teamMeter = (v, pool) => Math.max(4, Math.round(teamFrac(v, pool) * 100))
function gradeColor(val0) {
  const val = Math.round(val0 ?? 0)
  if (val >= 11) return '#a855f7'
  if (val >= 8) return '#3b82f6'
  if (val >= 5) return '#22c55e'
  if (val >= 2) return '#eab308'
  if (val >= 1) return '#f97316'
  return '#ef4444'
}
const COMP_TAG = { ucl: 'UCL', uel: 'UEL', uecl: 'UECL', wc: 'WC' }
const STAGE_TAG = { group: 'GRP', r32: 'R32', r16: 'R16', qf: 'QF', sf: 'SF', third: '3RD', final: 'FINAL' }
const STAGE_NAME = { r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-finals', sf: 'Semi-finals', third: 'Third-place play-off', final: 'Final' }
const WC_FINISH = {
  'Winners': 'WORLD CUP WINNERS', 'Runners-up': 'RUNNERS-UP', 'Third place': 'THIRD PLACE', 'Fourth place': 'FOURTH PLACE',
  'Quarter-finals': 'OUT IN THE QUARTER-FINALS', 'Round of 16': 'OUT IN THE ROUND OF 16', 'Round of 32': 'OUT IN THE ROUND OF 32', 'Group stage': 'OUT IN THE GROUP STAGE',
}
const BDO_FINISH = { winner: 'BALLON D\'OR WINNER', top3: 'THE BALLON D\'OR PODIUM', top10: 'IN THE BALLON D\'OR TOP 10', nominated: 'BALLON D\'OR NOMINEE' }
// A build's season is the Champions League (since 2026-11-16: utils/soccerSimulation.js uclSeason). A season kept from
// before that is a domestic one, and plays out on the domestic screens as it always did (isUclResult tells them apart).
const UCL_FINISH = {
  'Winners': 'CHAMPIONS LEAGUE WINNERS', 'Runners-up': 'RUNNERS-UP', 'Semi-finals': 'OUT IN THE SEMI-FINALS', 'Quarter-finals': 'OUT IN THE QUARTER-FINALS',
  'Round of 16': 'OUT IN THE ROUND OF 16', 'Knockout play-offs': 'OUT IN THE KNOCKOUT PLAY-OFFS', 'League phase': 'OUT IN THE LEAGUE PHASE',
}
const UCL_TAG = { po: 'PO', r16: 'R16', qf: 'QF', sf: 'SF', final: 'FINAL' }
// the league phase table's bands: 1st-8th the Round of 16, 9th-24th the play-offs, 25th-36th out
const UCL_INFO = { ucl: 8, uel: 16, down: 12 }
const fxTag = m => (m.comp === 'ucl' ? (m.stage === 'md' ? `MD${m.md ?? ''}` : UCL_TAG[m.stage] ?? 'UCL') : null)

// A crest: the club's or the nation's (a club without art gets its code)
// (a side outside the data, Europe's other clubs or a cup's lower-league one, has no art: `extra`)
function Crest({ short, pool, size = 22, className = '', extra = false }) {
  const [bad, setBad] = useState(extra)
  if (!short) return null
  if (bad) return <span className={`ssp-crest ssp-crest--txt ${className}`} style={{ width: size, height: size }}>{String(short).slice(0, 3)}</span>
  return <img className={`ssp-crest ${className}`} src={`${LOGO[pool]}${short}.png`} alt="" width={size} height={size} loading="lazy" decoding="async" onError={() => setBad(true)} />
}
// who an award entry is: the build is the username
const who = (e, userName) => (e?.isPlayer ? userName : e?.name ?? '–')

// a match's score as the scoreboard reads it (penalties after)
function scoreOf(m) {
  if (!m) return ''
  const pens = m.shootout ? ` (${m.shootout.my}–${m.shootout.opp} pens)` : ''
  return `${m.mySc}–${m.oppSc}${m.et && !m.shootout ? ' aet' : ''}${pens}`
}
const resultOf = m => (m.shootout ? (m.shootout.won ? 'W' : 'L') : m.result)

// ─── The team spin (Simulate Season): a club, or the nation at the World Cup ──
const ITEM_H = 44, CENTER = 2, COPIES = 8
function TeamReel({ items, spinning, onStop, label, pool }) {
  const track = useRef(null)
  // the row in the middle of the window: one whole copy in, so the rows above it are filled before the first spin
  // (from row 0 the window's top two rows were empty: the wheel looked unfinished)
  const [pos, setPos] = useState(items.length)
  const [anim, setAnim] = useState(false)
  useEffect(() => { if (!spinning) { setAnim(false); setPos(items.length) } }, [items]) // eslint-disable-line react-hooks/exhaustive-deps
  const stopRef = useRef(onStop); stopRef.current = onStop
  useEffect(() => {
    if (!spinning || !items.length) return
    const w = Math.floor(Math.random() * items.length)
    const target = (COPIES - 2) * items.length + w
    setAnim(true); setPos(target)
    const t = setTimeout(() => { stopRef.current?.(items[w]) }, 1750)
    return () => clearTimeout(t)
  }, [spinning]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => Array.from({ length: COPIES }, () => items).flat(), [items])
  return (
    <div className={`reel-outer${spinning ? ' reel-spinning' : ''}`}>
      <div className="reel-label">{label}</div>
      <div className="reel-window">
        <div className="reel-selector" />
        <div ref={track} className="reel-track" style={{ transform: `translate3d(0,${-(pos - CENTER) * ITEM_H}px,0)`, transition: anim ? 'transform 1.6s cubic-bezier(.12,.8,.22,1)' : 'none' }}>
          {rows.map((t, i) => (
            <div key={i} className="reel-row ssp-reel-row" style={{ height: ITEM_H }}>
              <Crest short={t.short} pool={pool} size={26} />
              <span className="ssp-reel-txt"><span className="reel-primary">{t.short}</span><span className="reel-secondary">{t.name}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
// `pool`: 'current' (a club) or 'alltime' (a nation). Normal builds spin the sides in the build; Sandbox (or
// anyTeam) any of them. Pick lists them to choose from. `teams`: the clubs to deal (a build's: the Champions
// League's 36; Squad Builder hands in the domestic leagues' clubs).
export function SoccerTeamSpin({ pool = 'current', isCustomMode, onTeamSelected, build = {}, anyTeam = false, eyebrow = null, teams = null }) {
  const tapGuard = useTapGuard()
  const all = teams ?? (pool === 'alltime' ? WC_NATIONS : UCL_CLUBS)
  const word = pool === 'alltime' ? 'Nation' : 'Club'
  const [phase, setPhase] = useState('idle')
  const [result, setResult] = useState(null)
  const [mode, setMode] = useState(isCustomMode ? 'pick' : 'spin')
  const [search, setSearch] = useState('')
  const inBuild = useMemo(() => {
    const shorts = [...new Set(Object.values(build).filter(Boolean).map(c => c.team))]
    return shorts.map(s => all.find(t => t.short === s)).filter(Boolean)
  }, [build, all])
  const pickPool = isCustomMode || anyTeam || !inBuild.length ? all : inBuild
  const items = useMemo(() => [...pickPool].sort(() => Math.random() - 0.5), [pickPool])
  const done = useCallback(team => { setResult(team); setPhase('done'); setTimeout(() => onTeamSelected(team), 450) }, [onTeamSelected])
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase()
    return s ? pickPool.filter(t => t.name.toLowerCase().includes(s) || t.short.toLowerCase().includes(s)) : pickPool
  }, [search, pickPool])
  const style = result ? { '--tpm-color': result.color, borderColor: `${result.color}55` } : undefined
  return (
    <div className="tpm-overlay" onClickCapture={tapGuard.onClickCapture}>
      <div className={`tpm-card${mode === 'pick' ? ' tpm-card-pick' : ''}`} style={style}>
        <div className="tpm-eyebrow">{eyebrow ?? (pool === 'alltime' ? 'The World Cup' : 'Simulate Season')}</div>
        <div className="tpm-heading">{mode === 'pick' ? `Pick a ${word}` : `Spin a ${word}`}</div>
        <div className="tpm-mode-tabs">
          <button className={`tpm-tab${mode === 'spin' ? ' tpm-tab-active' : ''}`} onClick={() => { if (phase !== 'idle') return; setMode('spin'); setResult(null); setSearch(''); setPhase('idle') }}>Spin</button>
          <button className={`tpm-tab${mode === 'pick' ? ' tpm-tab-active' : ''}`} onClick={() => { if (phase !== 'idle') return; setMode('pick'); setResult(null); setPhase('idle') }} disabled={phase !== 'idle'}>Pick</button>
        </div>
        {mode === 'spin' ? (
          <>
            <div className="reels-wrap tpm-reels">
              <div className="reel-tri reel-tri-l" />
              <div className="reels-row"><TeamReel items={items} spinning={phase === 'spinning'} onStop={done} label={SOCCER_POOL[pool].team} pool={pool} /></div>
              <div className="reel-tri reel-tri-r" />
            </div>
            <button className="spin-btn" onClick={() => { if (phase === 'idle') setPhase('spinning') }} disabled={phase !== 'idle'}>SPIN</button>
          </>
        ) : (
          <div className="tpm-pick-wrap">
            {result ? (
              <div className="tpm-result" style={{ '--tpm-color': result.color }}>
                <div className="tpm-result-bg" />
                <Crest short={result.short} pool={pool} size={96} className="tpm-result-logo" />
                <div className="tpm-result-name">{result.name}</div>
                <div className="tpm-result-abbr">{result.short}</div>
              </div>
            ) : (
              <>
                <div className="tpm-subheading">{pickPool === all ? `Every ${word.toLowerCase()}` : 'From the build'}</div>
                <input className="tpm-pick-search" placeholder={`Search ${pool === 'alltime' ? 'nations' : 'clubs'}…`} value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" />
                <div className="tpm-team-grid">
                  {shown.map(t => (
                    <button key={t.short} className="tpm-team-btn" style={{ '--t-color': t.color }} onClick={() => done(t)}>
                      <Crest short={t.short} pool={pool} size={40} className="tpm-team-logo" />
                      <span className="tpm-team-abbr">{t.short}</span>
                    </button>
                  ))}
                </div>
                {!shown.length && <p className="tpm-pick-none">No {pool === 'alltime' ? 'nation' : 'club'} matches "{search.trim()}".</p>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Pieces ──────────────────────────────────────────────────────────────────
function Section({ title, aside = null, children, className = '' }) {
  return (
    <section className={`ssp-sec ${className}`}>
      <header className="ssp-sec-head"><h3>{title}</h3>{aside && <span className="ssp-sec-aside">{aside}</span>}</header>
      {children}
    </section>
  )
}
// (big: two to a row; the small ones `small` to a row, so no row is left half full)
function Tiles({ items, small = 4 }) {
  return (
    <div className="ssp-tiles" style={{ '--sm': 12 / small }}>
      {items.filter(Boolean).map(([v, k, big]) => (
        <div key={k} className={`ssp-tile${big ? ' is-big' : ''}`}><b>{v}</b><small>{k}</small></div>
      ))}
    </div>
  )
}
// his season, as the broadcast graphic reads it
function StrikerLine({ r, title = 'THE SEASON', comps = true }) {
  const all = r.allComps ?? {}
  return (
    <Section title={title} aside={comps && all.goals != null && all.goals !== r.goals ? `${all.goals} in all competitions` : null}>
      <Tiles small={3} items={[
        [r.goals ?? 0, r.goals === 1 ? 'GOAL' : 'GOALS', true], [r.assists ?? 0, r.assists === 1 ? 'ASSIST' : 'ASSISTS', true],
        [`${r.apps ?? 0}`, r.starts != null ? `APPS · ${r.starts} STARTS` : 'APPS'],
        [one(r.xg), 'xG'], [r.shots ?? '–', 'SHOTS'], [pct(r.conversion), 'CONVERSION'],
        [one(r.avgRating), 'AVG RATING'], [r.motm ?? 0, r.motm === 1 ? 'PLAYER OF THE MATCH AWARD' : 'PLAYER OF THE MATCH AWARDS'],
      ]} />
      {(r.hatTricks > 0 || r.braces > 0 || r.pens > 0 || r.headers > 0) && (
        <p className="ssp-line-notes">
          {[r.hatTricks > 0 && `${r.hatTricks} ${r.hatTricks === 1 ? 'hat-trick' : 'hat-tricks'}`, r.braces > 0 && `${r.braces} ${r.braces === 1 ? 'brace' : 'braces'}`,
            r.headers > 0 && `${r.headers} with his head`, r.outside > 0 && `${r.outside} from outside the box`, r.pensTaken > 0 && `${r.pens}/${r.pensTaken} penalties`].filter(Boolean).join(' · ')}
        </p>
      )}
    </Section>
  )
}
// the league table, his club's row lit; Europe and the drop marked down the side
function LeagueTable({ rows = [], pool, info, compact = false }) {
  if (!rows.length) return null
  const n = rows.length
  const zone = pos => (!info ? '' : pos <= (info.ucl ?? 4) ? ' is-ucl' : pos <= (info.ucl ?? 4) + (info.uel ?? 1) ? ' is-uel' : pos > n - (info.down ?? 3) ? ' is-down' : '')
  return (
    <table className={`ssp-table${compact ? ' is-compact' : ''}`}>
      <thead><tr><th className="ssp-c-pos">#</th><th className="ssp-c-team">{pool === 'alltime' ? 'Nation' : 'Club'}</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th className="ssp-c-pts">Pts</th></tr></thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.short} className={`${row.isUs ? 'is-us' : ''}${zone(row.pos)}`}>
            <td className="ssp-c-pos">{row.pos}</td>
            <td className="ssp-c-team"><Crest short={row.short} pool={pool} size={18} extra={!!row.extra} /><span>{teamOf(row.short, pool)?.name ?? row.name ?? row.short}</span></td>
            <td>{row.played}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td>
            <td>{row.gd > 0 ? `+${row.gd}` : row.gd}</td><td className="ssp-c-pts">{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
// match by match: the competition, home or away, the score, his goals and assists, his rating
function Fixtures({ list = [], pool, league, initial = 10 }) {
  const [all, setAll] = useState(false)
  const shown = all ? list : list.slice(0, initial)
  return (
    <>
      <ol className="ssp-fx">
        {shown.map((m, i) => {
          const res = resultOf(m)
          const tag = fxTag(m) ?? (m.comp === 'league' ? (league?.short ?? 'LGE') : m.comp === 'cup' ? 'CUP' : m.stage ? STAGE_TAG[m.stage] ?? 'WC' : COMP_TAG[m.comp] ?? String(m.comp).toUpperCase())
          return (
            <li key={i} className={`ssp-fx-row is-${String(res).toLowerCase()}`}>
              <span className="ssp-fx-comp">{tag}</span>
              <span className="ssp-fx-ha">{m.neutral ? 'N' : m.home ? 'H' : 'A'}</span>
              <span className="ssp-fx-opp"><Crest short={m.opponent} pool={pool} size={18} extra={!!m.oppExtra} /><span>{teamOf(m.opponent, pool)?.name ?? m.oppName ?? m.opponent}</span></span>
              <span className="ssp-fx-score"><i>{res}</i>{scoreOf(m)}</span>
              <span className="ssp-fx-line">
                {m.app ? <>{Array.from({ length: Math.min(5, m.goals ?? 0) }, (_, k) => <b key={k} className="ssp-ball" aria-label="goal" />)}{m.goals > 5 ? <small>+{m.goals - 5}</small> : null}{m.assists > 0 && <small className="ssp-ast">{m.assists > 1 ? `${m.assists} A` : 'A'}</small>}</> : <small className="ssp-dnp">{DNP_WHY[m.why] ?? 'DNP'}</small>}
              </span>
              <span className={`ssp-fx-rt${m.motm ? ' is-motm' : ''}`}>{m.rating != null ? one(m.rating) : ''}</span>
            </li>
          )
        })}
      </ol>
      {list.length > initial && <button className="ssp-more" onClick={() => setAll(a => !a)}>{all ? 'FEWER MATCHES' : `ALL ${list.length} MATCHES`}</button>}
    </>
  )
}
// a knockout tie: the round, the opponent, the score (on aggregate over two legs), through or out
function Ties({ ties = [], pool }) {
  if (!ties.length) return null
  return (
    <ol className="ssp-ties">
      {ties.map((t, i) => {
        const legs = t.legs ?? []
        const one1 = legs.length === 1 ? legs[0] : null
        const line = one1 ? scoreOf(one1) : t.agg ? `${t.agg[0]}–${t.agg[1]} agg${t.shootout ? ` (${t.shootout.my}–${t.shootout.opp} pens)` : ''}` : legs.map(scoreOf).join(', ')
        const goals = legs.reduce((s, m) => s + (m.goals ?? 0), 0)
        return (
          <li key={i} className={`ssp-tie${t.won ? ' is-won' : ' is-out'}${t.final ? ' is-final' : ''}`}>
            <span className="ssp-tie-rnd">{t.name ?? t.round ?? ''}</span>
            <span className="ssp-tie-opp"><Crest short={t.opponent?.short} pool={pool} size={20} extra={!!t.opponent?.extra} /><span>{teamOf(t.opponent?.short, pool)?.name ?? t.opponent?.name ?? t.opponent?.short}</span></span>
            <span className="ssp-tie-score">{line}</span>
            <span className="ssp-tie-res">{t.won ? (t.final ? 'WON IT' : 'THROUGH') : 'OUT'}{goals > 0 ? <small>{goals} {goals === 1 ? 'goal' : 'goals'}</small> : null}</span>
          </li>
        )
      })}
    </ol>
  )
}
// an award's race: the top of the list, the build lit
// the leaders, and him in his place when he's further down (the tag says 8th: his row is there too)
function Race({ list = [], userName, pool, unit = 'goals', n = 6 }) {
  if (!list.length) return null
  const at = list.findIndex(e => e.isPlayer)
  const rows = (at >= n ? [...list.slice(0, n - 1).map((e, i) => [e, i]), [null, -1], [list[at], at]] : list.slice(0, n).map((e, i) => [e, i]))
  return (
    <ol className="ssp-race">
      {rows.map(([e, i], k) => (e == null ? <li key="gap" className="ssp-race-gap" aria-hidden="true">···</li> : (
        <li key={k} className={e.isPlayer ? 'is-us' : ''}>
          <span className="ssp-race-rk">{i + 1}</span>
          <Crest short={e.team} pool={pool} size={18} />
          <span className="ssp-race-name">{who(e, userName)}</span>
          {unit && e[unit] != null && <b className="ssp-race-n">{e[unit]}</b>}
        </li>
      )))}
    </ol>
  )
}
function Award({ title, won, tag, children }) {
  return (
    <div className={`ssp-award${won ? ' is-won' : ''}`}>
      <div className="ssp-award-head"><b>{title}</b>{tag && <span className="ssp-award-tag">{tag}</span>}</div>
      {children}
    </div>
  )
}

// ─── Screens ─────────────────────────────────────────────────────────────────
// (basketball's order and buttons: the build · the season · the knockouts · the legacy · the final report)
function ScreenBuild({ result, build, types, onNext, pool, arch, team, play = 'live', setPlay = null }) {
  const ovr = useCountUp(result?.ovr ?? 0, { ms: 900 })
  const [rows, setRows] = useState(0)
  const filled = types.filter(t => build[t])
  useEffect(() => {
    let i = 0, t = 0
    const tick = () => { if (i >= filled.length) return; i++; setRows(i); t = setTimeout(tick, 80) }
    t = setTimeout(tick, 500)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // the model in his side's colours, every part of the kit
  const mono = useMemo(() => (team ? Object.fromEntries(Object.entries(build).map(([k, v]) => [k, v ? { ...v, teamColor: team.color, teamColor2: team.color2, team: team.short } : v])) : build), [build, team])
  const kitNick = useCallback(c => (teamOf(c?.team, pool)?.name ?? c?.team ?? '').toUpperCase(), [pool])
  return (
    <div className="simp-screen ssp-build">
      <div className="ssp-build-head">
        <div className="ssp-build-ovr"><b>{ovr || '–'}</b><small>OVR</small></div>
        <div className="ssp-build-id"><span className="ssp-build-pos">Striker · {pool === 'alltime' ? 'All-Time World Cup' : `Champions League ${result?.season ?? ''}`}</span><span className="ssp-build-arch">{arch}</span></div>
      </div>
      <button className="simp-cta" onClick={onNext}>{pool === 'alltime' ? 'Simulate World Cup' : 'Simulate Season'}</button>
      {setPlay && <PlaySwitch mode={play} onPick={setPlay} />}
      <div className="ssp-build-body">
        <div className="cr-model cr-model--bucket ssp-model">
          <Silhouette isSoccer modelOnly build={mono} types={types} attrMap={SOCCER_ATTR} categoriesData={SOCCER_CATEGORIES} logoDir={LOGO[pool]} kitNick={kitNick} />
        </div>
        <BuildRows build={build} types={types} pool={pool} rows={rows} />
      </div>
    </div>
  )
}
function BuildRows({ build, types, pool, rows = 99, small = false }) {
  return (
    <div className={`simp-attr-table${small ? ' simp-attr-table-sm' : ''}`}>
      {types.filter(t => build[t]).map((t, i) => {
        const meta = SOCCER_ATTR[t] ?? { label: t }
        const d = build[t]
        return (
          <div key={t} className={`simp-attr-row${i < rows ? ' simp-row-visible' : ''}`}>
            <QBAvatar photo={d.photo} team={d.team} color={d.teamColor} size={small ? 36 : 46} logoDir={LOGO[pool]} faceCenter={d.faceCenter} />
            <div className="simp-attr-info"><span className="simp-attr-name">{meta.label}</span><span className="simp-attr-qb">{d.qbFull}</span></div>
            <span className="simp-grade-circle" style={{ background: gradeColor(d.val), color: '#07120a' }}>{valToGrade(d.val)}</span>
          </div>
        )
      })}
    </div>
  )
}

// his line over a stretch of matches (the group stage: the three he played)
function lineOf(ms) {
  const played = ms.filter(m => m.app)
  const rated = played.filter(m => m.rating != null)
  return {
    goals: played.reduce((s, m) => s + (m.goals ?? 0), 0), assists: played.reduce((s, m) => s + (m.assists ?? 0), 0), apps: played.length,
    shots: played.reduce((s, m) => s + (m.shots ?? 0), 0), xg: played.reduce((s, m) => s + (m.xg ?? 0), 0),
    avgRating: rated.length ? rated.reduce((s, m) => s + m.rating, 0) / rated.length : null, motm: played.filter(m => m.motm).length,
  }
}
// the wire: what the papers say as the matches come in (the latest one shows)
function wireOf(games, n, { userName, team, isWc, isUcl = false }) {
  const out = []
  const club = team?.name ?? 'The side'
  let run = 0, winless = 0, goals = 0
  const marks = [10, 20, 25, 30, 40]
  for (let i = 0; i < n; i++) {
    const m = games[i]
    const res = resultOf(m)
    const opp = teamOf(m.opponent, isWc ? 'alltime' : 'current')?.name ?? m.oppName ?? m.opponent
    run = res === 'W' ? run + 1 : 0
    winless = res === 'W' ? 0 : winless + 1
    const before = goals
    goals += m.goals ?? 0
    if ((m.goals ?? 0) >= 3) out.push(`Hat-trick for ${userName} against ${opp}`)
    else if ((m.goals ?? 0) === 2 && res === 'W') out.push(`A brace from ${userName} sinks ${opp}`)
    else if (run >= 3 && run % 2 === 1) out.push(`${club} make it ${run} wins in a row`)
    else if (winless >= 4 && winless % 2 === 0) out.push(`${club} without a win in ${winless}`)
    else if (res === 'W' && i === 0) out.push(`${club} open with a win over ${opp}`)
    const mk = marks.find(x => before < x && goals >= x)
    if (mk && !isWc && !isUcl) out.push(`${userName} reaches ${mk} league goals`)
  }
  return out
}

// dr: the season director's reveal (the moments on: SeasonMoments.jsx), else the season plays straight from the result
function ScreenSeason({ r, pool, info, onNext, onDone, userName, adsDisabled, seen, dr = null, M = null }) {
  const isWc = pool === 'alltime'
  const isUcl = !isWc && SoccerSim.isUclResult(r)
  // (the Champions League's league phase: eight matches, a beat each, as the World Cup's group)
  const short = isWc || isUcl
  const games = useMemo(() => (dr ? dr.all : isWc ? (r.games ?? []).filter(g => g.stage === 'group') : (r.games ?? [])), [r, isWc, dr?.all])
  const total = games.length
  // basketball's pace: the season in about six seconds (a group's three matches a beat each)
  const sr = useSeasonReveal(total, { pace: isWc ? 850 : isUcl ? 700 : Math.round(5600 / Math.max(1, total)), instant: seen || !!dr })
  const rv = dr ? { n: dr.k, phase: dr.done ? 'done' : dr.k === 0 ? 'loading' : 'playing', done: dr.done } : sr
  useEffect(() => { if (rv.done) onDone?.() }, [rv.done]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (rv.done && !adsDisabled && window.innerWidth <= 768) rampAdd([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-square' }]) }, [rv.done]) // eslint-disable-line react-hooks/exhaustive-deps
  // the season awards, tallied: the Golden Boot, then the Player of the Season, then the button
  const k = useStaged(rv.done, short ? [600] : [2700, 3050, 4100, 4700], seen)
  const shown = dr ? dr.games : games.slice(0, rv.n)
  const W = shown.filter(g => resultOf(g) === 'W').length, D = shown.filter(g => resultOf(g) === 'D').length, L = shown.length - W - D
  const wireOwn = useMemo(() => (dr ? [] : wireOf(games, rv.n, { userName, team: r.team, isWc, isUcl })), [games, rv.n, !!dr]) // eslint-disable-line react-hooks/exhaustive-deps
  const wire = dr ? dr.headlines.filter(h => h.at <= dr.k).map(h => h.text) : wireOwn
  const lg = r.league ?? {}
  const gb = r.goldenBoot, poty = r.playerOfSeason
  const head = isWc
    ? (r.seed === 1 ? 'TOP OF THE GROUP' : r.madePlayoffs ? `THROUGH IN ${ordinal(r.seed).toUpperCase()}` : `${ordinal(r.seed).toUpperCase()} · OUT IN THE GROUP`)
    : isUcl ? (r.seed === 1 ? 'TOP OF THE LEAGUE PHASE' : `${ordinal(r.seed ?? 0)} in the league phase`.toUpperCase())
    : r.champion ? `${String(lg.name ?? 'League').toUpperCase()} CHAMPIONS` : r.relegated ? 'RELEGATED' : `${ordinal(r.seed ?? 0)} in ${inLeague(lg.name)}`.toUpperCase()
  const cta = short ? (r.madePlayoffs ? 'Enter the Knockouts' : 'The Knockouts') : 'Enter the Knockouts'
  const band = isUcl ? (r.seed <= 8 ? 'Through to the Round of 16' : r.seed <= 24 ? 'Into the knockout play-offs' : 'Out of the competition') : null
  return (
    <div className="simp-screen ssp-season">
      {rv.phase === 'loading' && <SimLoading label={isWc ? 'Simulating the group…' : isUcl ? 'Simulating the league phase…' : 'Simulating season…'} />}
      {rv.phase !== 'loading' && (
        <>
          <div className="simp-eyebrow">{isWc ? `World Cup · Group ${r.conference}` : isUcl ? `Champions League · League phase · ${r.season}` : `${lg.name ?? 'League'} · ${r.season}`}</div>
          <div className="simp-live-record ssp-live-record">
            <span className="slr-w">{W}</span><span className="slr-sep">–</span><span className="slr-d">{D}</span><span className="slr-sep">–</span><span className="slr-l">{L}</span>
          </div>
          <div className="ssp-live-pts">{W * 3 + D} PTS · {total - shown.length > 0 ? `${total - shown.length} ${isWc ? 'to play' : 'matches left'}` : isWc ? 'the group is done' : isUcl ? 'the league phase is done' : 'full time on the season'}</div>
          {!isWc && <Pulse games={shown} total={total} step={g => (resultOf(g) === 'W' ? 1 : resultOf(g) === 'D' ? 0 : -1)} need={Math.round(total * 0.3)} />}
          <WireLine items={wire} />
          {dr && M && <M.MomentsLayer dr={dr} userName={userName} />}
          <div className="bsim-season-dots ssp-dots">
            {shown.map((g, i) => <span key={i} className={`bsim-sdot bsim-sdot--${resultOf(g) === 'W' ? 'w' : resultOf(g) === 'D' ? 'd' : 'l'}`} />)}
          </div>
          {rv.done && (
            <>
              <div className={`ssp-hero${(isWc ? r.seed <= 2 : isUcl ? r.seed === 1 : r.champion) ? ' is-champ' : ''}`}>
                <span className="ssp-eyebrow">{isWc ? `${wcName(r.season, true)} · Group ${r.conference}` : isUcl ? `Champions League ${r.season} · League phase` : `${lg.name} · ${r.season}`}</span>
                <h2 className="ssp-head">{head}</h2>
                <div className="ssp-record"><b>{r.wins}</b>W<b>{r.draws}</b>D<b>{r.losses}</b>L<em>·</em><b>{r.points}</b>PTS<em>·</em><b>{r.gf}</b>–<b>{r.ga}</b></div>
                {band && <span className="ssp-band">{band}</span>}
              </div>
              {isWc
                ? <Section title={`GROUP ${r.conference}`}><LeagueTable rows={r.standings} pool="alltime" compact /></Section>
                : isUcl ? (
                  <Section title="THE TABLE" aside={`${r.standings?.length ?? 36} clubs`}>
                    <LeagueTable rows={r.standings} pool="current" info={UCL_INFO} />
                    <p className="ssp-zone-key"><span className="is-ucl">1–8 Round of 16</span><span className="is-uel">9–24 knockout play-offs</span><span className="is-down">25–36 out</span></p>
                    {r.team?.inPlaceOf && <p className="ssp-line-notes">{r.team.name} play in the place of {r.standings.find(x => x.short === r.team.inPlaceOf)?.name ?? teamOf(r.team.inPlaceOf, 'current')?.name ?? r.team.inPlaceOf}, in pot {r.team.pot}.</p>}
                  </Section>
                )
                : <Section title="THE TABLE" aside={r.qualified ? { ucl: 'Champions League next season', uel: 'Europa League next season', uecl: 'Conference League next season' }[r.qualified] : null}><LeagueTable rows={r.standings} pool="current" info={info} /></Section>}
              {!adsDisabled && <div id="ramp-cntr1-square" className="simp-season-ad" />}
              {isWc ? <GroupLine ms={games} /> : isUcl ? <GroupLine ms={shown} title="THE LEAGUE PHASE" /> : <StrikerLine r={r} title={`THE ${String(lg.name ?? 'LEAGUE').toUpperCase()} SEASON`} comps={false} />}
              <Section title={isWc ? 'THE GROUP GAMES' : 'MATCH BY MATCH'}><Fixtures list={games} pool={pool} league={lg} initial={isWc ? 3 : isUcl ? 8 : 10} /></Section>
              {!short && gb?.race?.length > 0 && (() => {
                const top = gb.race.slice(0, 6)
                const meIn = top.some(e => e.isPlayer)
                const meE = gb.race.find(e => e.isPlayer) ?? { isPlayer: true, team: r.team?.short, goals: gb.goals }
                const rows = [...top.map((e, i) => ({ e, rank: i + 1 })), ...(meIn ? [] : [{ e: meE, rank: gb.rank }])]
                  .map(({ e, rank }) => ({ rank, me: !!e.isPlayer, name: e.isPlayer ? <NameTag name={userName} self /> : e.name, team: teamOf(e.team, 'current')?.name ?? e.team, value: e.goals ?? 0 }))
                return <LeadersBoard label="GOALS" rows={rows} rank={gb.rank} who={userName} />
              })()}
              {!short && (gb || poty) && (
                <>
                  <div className="sawd-title">Season Awards</div>
                  {k === 0 && <div className="sawd-tallying"><div className="sawd-tally-dots"><span className="sawd-dot" /><span className="sawd-dot" /><span className="sawd-dot" /></div><div className="sawd-tally-lbl">Tallying votes…</div></div>}
                  {k >= 2 && gb && (
                    <div className="ag-pop">
                      <Award title={String(gb.name ?? 'Golden Boot').toUpperCase()} won={gb.won} tag={gb.won ? (gb.shared ? 'SHARED' : 'WINNER') : `${ordinal(gb.rank)} · ${gb.goals} GOALS`}>
                        <p className="ssp-award-note">{gb.won ? `${userName}, ${gb.goals} league goals.` : `Won by ${who(gb.winner, userName)}${gb.winner?.goals != null ? `, ${gb.winner.goals} goals` : ''}.`}</p>
                      </Award>
                    </div>
                  )}
                  {k >= 3 && poty && (
                    <div className="ag-pop">
                      <Award title={String(poty.name ?? 'Player of the Season').toUpperCase()} won={poty.won} tag={poty.won ? 'WINNER' : `WON BY ${who(poty.winner, userName).toUpperCase()}`}>
                        {r.teamOfSeason && <p className="ssp-award-note">Named in the Team of the Season.</p>}
                      </Award>
                    </div>
                  )}
                </>
              )}
              {(short ? k >= 1 : k >= 4) && <button className="simp-cta simp-cta-in simp-cta--pin" onClick={onNext}>{cta}</button>}
            </>
          )}
        </>
      )}
    </div>
  )
}
function GroupLine({ ms, title = 'THE GROUP STAGE' }) {
  const s = lineOf(ms)
  return (
    <Section title={title}>
      <Tiles items={[[s.goals, s.goals === 1 ? 'GOAL' : 'GOALS', true], [s.assists, s.assists === 1 ? 'ASSIST' : 'ASSISTS', true], [s.apps, 'APPS'], [s.shots, 'SHOTS'], [one(s.xg), 'xG'], [one(s.avgRating), 'AVG RATING']]} />
    </Section>
  )
}

// ── The match day: the group (the league phase), match by match, live ────────
// The season director (the moments on: a Champions League season on the app's look) is driven a match at a time:
// before each match its stops are opened (lib/seasonDirector.js; a story card comes up before kick-off, an in-match
// moment at its minute inside the live match), and after each one it looks at the match for the milestones.
// Without a director the matches are the result's. A kept season (lib/seasonLive.js) saves its place as it goes.
const momentMinute = mo => { const t = `${mo?.title ?? ''} ${mo?.body ?? ''}`; const x = /(\d{2,3})(?:st|nd|rd|th)\s+minute/i.exec(t) ?? /(\d{2,3})'/.exec(t); const v = x ? Number(x[1]) : 84; return Math.max(60, Math.min(89, v)) }
function useMatchDriver({ director, total, live = null, onFinal = null, start = 0 }) {
  const [k, setK] = useState(() => {
    if (!director) return start
    if (!live) return 0
    const k0 = Math.min(Math.max(0, live.k | 0), director.total)
    for (let i = (live.snapK | 0) + 1; i <= k0; i++) director.observe(i)
    return k0
  })
  const [moment, setMoment] = useState(() => (live && director ? live.moment ?? null : null))
  const [fresh, setFresh] = useState([])
  const [record, setRecord] = useState(null)
  const [done, setDone] = useState(false)
  const [tick, setTick] = useState(0)
  const stopIdx = useRef(live && director ? live.stopIdx | 0 : 0)
  const fin = useRef(onFinal); fin.current = onFinal
  const keep = (at, mo) => { if (live && director) saveStop(live, { snap: director.snapshot(), snapK: at, stopIdx: stopIdx.current, moment: mo }) }
  // the stops due before match k is played (and, after the last match, the knockouts' stop, then the season booked)
  useEffect(() => {
    if (!director || moment || done) return
    let stop = director.stops[stopIdx.current]
    while (stop && k >= stop.at) {
      const mo = director.open(stop)
      stopIdx.current++
      keep(k, mo || null)
      if (mo) { setMoment(mo); return }
      stop = director.stops[stopIdx.current]
    }
    if (k >= director.total) { const f = director.finalize(); setDone(true); fin.current?.(f) }
  }, [k, moment, done, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const step = next => {
    if (director) {
      const hits = director.observe(next)
      if (hits.length) {
        setFresh(f => [...f, ...hits])
        if (hits.find(h => h.record)) setRecord(director.records[director.records.length - 1])
        else if (hits.some(h => h.big)) sfx('chime')
      }
      if (live) savePos(live, { k: next })
    }
  }
  const played = () => { const next = Math.min(total, k + 1); step(next); setK(next) }
  // straight on: to the next moment (the moments still stop it), or to the end
  const simOn = () => {
    let to = total
    if (director) { const s = director.stops[stopIdx.current]; if (s && s.at > k) to = Math.min(total, s.at) }
    for (let i = k + 1; i <= to; i++) step(i)
    setK(to)
  }
  const choose = option => { const out = director.choose(moment, option); keep(k, null); return out }
  const clear = () => { setMoment(null); setTick(t => t + 1) }
  const turnOff = () => { setMomentsOff(true); window.dispatchEvent(new Event('bap:moments-off')); keep(k, null); clear() }
  return { k, moment, fresh, record, clearRecord: () => setRecord(null), done: director ? done : k >= total, played, simOn, choose, clear, turnOff }
}

// the table part way through: his row and the rows around it (the Champions League's 36), the whole of it a tap away
function TableNow({ rows, pool, info = null, title, aside = null, around = 0, notes = null }) {
  const [all, setAll] = useState(false)
  if (!rows?.length) return null
  const at = rows.findIndex(x => x.isUs)
  const cut = around && !all && rows.length > around * 2 + 3
  const shown = cut ? rows.filter((x, i) => Math.abs(i - at) <= around || i === 0) : rows
  return (
    <Section title={title} aside={aside} className="smd-table">
      <LeagueTable rows={shown} pool={pool} info={info} compact />
      {notes}
      {cut || all ? <button className="ssp-more" onClick={() => setAll(a => !a)}>{all ? 'AROUND THEM ONLY' : `ALL ${rows.length} CLUBS`}</button> : null}
    </Section>
  )
}
// another match's line: Japan 1–1 Ghana
function OtherLine({ h, a, hs, as, pool, note = null }) {
  return (
    <li className="smd-other">
      <span className="smd-other-t"><Crest short={h} pool={pool} size={16} /><span>{teamOf(h, pool)?.name ?? h}</span></span>
      <b>{hs}–{as}{note ? <small className="smd-other-note">{note}</small> : null}</b>
      <span className="smd-other-t is-r"><span>{teamOf(a, pool)?.name ?? a}</span><Crest short={a} pool={pool} size={16} /></span>
    </li>
  )
}
const ctxTeam = (short, pool, extra = {}) => { const t = teamOf(short, pool); return { short, name: t?.name ?? extra.name ?? short, color: t?.color ?? extra.color, color2: t?.color2 ?? extra.color2, att: t?.att ?? extra.att, def: t?.def ?? extra.def } }
const crestNode = pool => (short, size, className = '', extra = false) => <Crest short={short} pool={pool} size={size} className={className} extra={extra} />
const logoUrl = pool => short => (teamOf(short, pool) ? `${LOGO[pool]}${short}.png` : null)

function ScreenMatchDay({ r, pool, onNext, onDone, userName, seen, director = null, M = null, kept = null, onFinal = null, play, speed, setSpeed, paused, setPaused }) {
  const isWc = pool === 'alltime'
  const team = r.team
  const us = team?.short
  const games0 = useMemo(() => (isWc ? (r.games ?? []).filter(g => g.stage === 'group') : (r.games ?? [])), [r, isWc])
  const total = director ? director.total : games0.length
  const drv = useMatchDriver({ director, total, live: kept, onFinal, start: seen ? games0.length : 0 })
  const k = drv.k
  const games = director ? director.games : games0
  const [held, setHeld] = useState(false)
  const [outcome, setOutcome] = useState(null)
  useEffect(() => { setHeld(false); setOutcome(null) }, [k])
  useEffect(() => { if (drv.done) onDone?.() }, [drv.done]) // eslint-disable-line react-hooks/exhaustive-deps
  const mds = useMemo(() => (!isWc && r.leaguePhase ? uclMatchdays(r.leaguePhase, us) : []), [r.leaguePhase, us, isWc])
  // the record counts a match from its full time (the table after it shows then too)
  const [ftK, setFtK] = useState(-1)
  const counted = Math.min(total, ftK === k ? k + 1 : k)
  const shown = games.slice(0, counted)
  const W = shown.filter(g => resultOf(g) === 'W').length, D = shown.filter(g => resultOf(g) === 'D').length, L = shown.length - W - D
  const compLine = isWc ? `${wcName(r.season)} · Group ${r.conference}` : `Champions League ${r.season} · League phase`
  const tableAt = n => (isWc ? wcTableAt(r.groupGames, r.standings, n, director ? games.slice(0, n) : null, us) : uclTableAt(r.leaguePhase, mds, n, r.standings, director ? games.slice(0, n) : null, us))
  const ctxFor = m => ({ key: `${r.season}|${us}|${isWc ? 'wc' : 'ucl'}|${m.g ?? ''}`, userName, pool, us: ctxTeam(us, pool, team), them: ctxTeam(m.opponent, pool, { name: m.oppName }), crest: crestNode(pool), logo: logoUrl(pool) })
  const momentsLayer = M && (drv.moment || drv.fresh.length || drv.record) ? (
    <M.MomentsLayer userName={userName} dr={{
      moment: drv.moment && (!drv.moment.inGame || held || k >= total) ? drv.moment : null, fresh: drv.fresh, record: drv.record, clearRecord: drv.clearRecord, turnOff: () => { const mo = drv.moment; drv.turnOff(); if (mo?.inGame) setOutcome({ to: games[k], line: null }) },
      choose: o => {
        const mo = drv.moment
        const out = drv.choose(o)
        setTimeout(() => { if (mo?.inGame) setOutcome({ to: director.games[k], line: out?.line ?? null }); drv.clear() }, out ? 1900 : 700)
        return out
      },
    }} />
  ) : null

  // ── the group (the league phase) played out: where they finished ──
  if (k >= total) {
    const head = isWc
      ? (r.seed === 1 ? 'TOP OF THE GROUP' : r.madePlayoffs ? `THROUGH IN ${ordinal(r.seed).toUpperCase()}` : `${ordinal(r.seed).toUpperCase()} · OUT IN THE GROUP`)
      : (r.seed === 1 ? 'TOP OF THE LEAGUE PHASE' : `${ordinal(r.seed ?? 0)} in the league phase`.toUpperCase())
    const band = !isWc ? (r.seed <= 8 ? 'Through to the Round of 16' : r.seed <= 24 ? 'Into the knockout play-offs' : 'Out of the competition') : null
    const waiting = director && !drv.done
    return (
      <div className="simp-screen ssp-season smd-screen">
        {momentsLayer}
        {!waiting && (
          <>
            <div className={`ssp-hero${(isWc ? r.seed <= 2 : r.seed <= 8) ? ' is-champ' : ''}`}>
              <span className="ssp-eyebrow">{compLine}</span>
              <h2 className="ssp-head">{head}</h2>
              <div className="ssp-record"><b>{r.wins}</b>W<b>{r.draws}</b>D<b>{r.losses}</b>L<em>·</em><b>{r.points}</b>PTS<em>·</em><b>{r.gf}</b>–<b>{r.ga}</b></div>
              {band && <span className="ssp-band">{band}</span>}
            </div>
            <button className="simp-cta smd-cta" onClick={onNext}>{r.madePlayoffs ? 'Enter the Knockouts' : isWc ? 'The Knockouts' : 'The Knockouts'}</button>
            {isWc
              ? <Section title={`GROUP ${r.conference}`}><LeagueTable rows={r.standings} pool="alltime" compact /></Section>
              : <TableNow rows={r.standings} pool="current" info={UCL_INFO} title="THE TABLE" aside={`${r.standings?.length ?? 36} clubs`} around={4}
                  notes={<p className="ssp-zone-key"><span className="is-ucl">1–8 Round of 16</span><span className="is-uel">9–24 knockout play-offs</span><span className="is-down">25–36 out</span></p>} />}
            <GroupLine ms={games} title={isWc ? 'THE GROUP STAGE' : 'THE LEAGUE PHASE'} />
            <Section title={isWc ? 'THE GROUP GAMES' : 'MATCH BY MATCH'}><Fixtures list={games} pool={pool} initial={8} /></Section>
          </>
        )}
      </div>
    )
  }

  // ── a match ──
  const m = games[k]
  const label = isWc ? `Group ${r.conference} · Matchday ${k + 1}` : `League phase · Matchday ${m.md ?? k + 1}`
  const inGame = drv.moment?.inGame
  const before = !isWc ? null : null
  const tAfter = tableAt(k + 1)
  const other = isWc ? wcOtherGame(r.groupGames, k + 1, us) : null
  const round = !isWc ? uclRoundOf(r.leaguePhase, mds, k + 1, r.standings) : []
  const after = (
    <>
      {isWc
        ? tAfter && <Section title={`GROUP ${r.conference} · AFTER MATCHDAY ${k + 1}`} className="smd-table"><LeagueTable rows={tAfter} pool="alltime" compact />{other && <ul className="smd-others"><li className="smd-others-h">Elsewhere in Group {r.conference}</li><OtherLine h={other[1]} a={other[2]} hs={other[3]} as={other[4]} pool={pool} /></ul>}</Section>
        : tAfter && <TableNow rows={tAfter} pool="current" info={UCL_INFO} title={`THE TABLE · AFTER MATCHDAY ${k + 1}`} around={3}
            notes={round.length > 0 && <ul className="smd-others"><li className="smd-others-h">Around Europe</li>{round.map((x, i) => <OtherLine key={i} h={x[0]} a={x[1]} hs={x[2]} as={x[3]} pool={pool} />)}</ul>} />}
    </>
  )
  return (
    <div className="simp-screen smd-screen">
      <div className="smd-top">
        <span className="smd-top-comp">{compLine}</span>
        <span className="smd-top-rec"><b>{W}</b>W <b>{D}</b>D <b>{L}</b>L · <b>{W * 3 + D}</b> PTS</span>
        <span className="smd-top-dots" aria-hidden="true">{games.slice(0, total).map((g, i) => <i key={i} className={i < counted ? `is-${resultOf(g).toLowerCase()}` : i === k ? 'is-now' : ''} />)}</span>
      </div>
      {drv.moment && !inGame ? momentsLayer : (
        <MatchCentre key={`${k}-${director ? 'd' : 'r'}`} item={{ m, label, kicker: isWc ? wcName(r.season, true) : `Champions League · ${m.home ? 'Home' : 'Away'}`, before, cap: inGame ? momentMinute(drv.moment) : null }}
          ctx={ctxFor(m)} play={drv.moment ? 'live' : play} speed={speed} paused={paused} onSpeed={v => { setSpeed(v); setPaused(false) }} onPause={() => setPaused(p => !p)}
          onNext={() => drv.played()} nextLabel={k + 1 >= total ? (isWc ? 'The group table' : 'The final table') : 'Next match'}
          after={after} onHeld={() => setHeld(true)} onFullTime={() => setFtK(k)} moment={inGame && held ? momentsLayer : (!drv.moment ? momentsLayer : null)} outcome={outcome}
          simAll={k + 1 < total ? <button type="button" className="smd-simall" onClick={drv.simOn}>{isWc ? 'Sim the rest of the group' : 'Sim the rest of the league phase'}</button> : null} />
      )}
    </div>
  )
}

// ── The knockouts: every match he plays, live, over the bracket ──────────────
const tieLine = t => {
  const legs = t.legs ?? []
  if (legs.length === 1) return scoreOf(legs[0])
  return t.agg ? `${t.agg[0]}–${t.agg[1]} on aggregate${t.shootout ? ` (${t.shootout.my}–${t.shootout.opp} pens)` : ''}` : legs.map(scoreOf).join(', ')
}
function ScreenKnockouts({ r, pool, onNext, userName, adsDisabled, seen, onSeen, play, speed, setSpeed, paused, setPaused }) {
  const isWc = pool === 'alltime'
  const isUcl = !isWc && SoccerSim.isUclResult(r)
  const ties = useMemo(() => (r.playoffRounds ?? []).filter(t => t?.legs?.length), [r])
  const legs = useMemo(() => ties.flatMap((t, ti) => t.legs.map((m, li) => ({ t, ti, li, m }))), [ties])
  const team = r.team
  const us = team?.short
  const compName = t => (isWc ? 'World Cup' : isUcl ? 'Champions League' : t.comp === 'cup' ? (r.cup?.name ?? 'The Cup') : (r.europe?.name ?? 'Europe'))
  const roundName = t => (isWc ? (STAGE_NAME[t.legs?.[0]?.stage] ?? t.name) : t.name)
  const title = t => (isWc || isUcl ? roundName(t) : `${compName(t)} ${roundName(t)}`)
  const oppOf = t => teamOf(t.opponent?.short, pool)?.name ?? t.opponent?.name ?? t.opponent?.short
  const last = ties[ties.length - 1]
  const champ = isWc ? !!r.champion : !!(last?.final && last.won)
  const seen0 = useRef(seen).current
  const [j, setJ] = useState(seen ? legs.length : 0)
  const [popped, setPopped] = useState(!!seen)
  const [ringOpen, setRingOpen] = useState(false)
  const end = j >= legs.length
  useEffect(() => { if (end) onSeen?.() }, [end]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!APP_SIM || !popped || seen0) return undefined
    const t = setTimeout(() => setRingOpen(true), 1300)
    return () => clearTimeout(t)
  }, [popped]) // eslint-disable-line react-hooks/exhaustive-deps
  const nextLbl = isWc || isUcl ? 'The Awards' : 'Ballon d\'Or'
  const tiesDone = end ? ties.length : legs.slice(0, j).filter(x => x.li === x.t.legs.length - 1).length
  const uclUpto = end ? 99 : (ties[tiesDone]?.roundIndex ?? 99)
  const bracket = isWc
    ? <Section title="THE BRACKET" className="smd-bracket"><Bracket bracket={r.bracket} us={us} upto={end ? 99 : tiesDone} /></Section>
    : isUcl ? <Section title="THE BRACKET" className="smd-bracket" aside={`${ordinal(r.seed ?? 0)} of ${r.standings?.length ?? 36} in the league phase`}><UclBracket bracket={r.bracket} us={us} upto={uclUpto} rows={r.standings} /></Section>
    : (
      <Section title="THE ROAD">
        {r.europe && <p className="ssp-europe-pos"><b>{r.europe.name}</b>: {ordinal(r.europe.position ?? 0)} in the league phase{r.europe.table?.length ? ` of ${r.europe.table.length}` : ''}{r.europe.result === 'League phase' ? ', out' : ''}</p>}
        <Ties ties={ties.slice(0, tiesDone).map(x => ({ ...x, name: title(x) }))} pool={pool} />
      </Section>
    )

  if (isWc && !r.madePlayoffs) return <MissCard eyebrow="The Knockouts" title="Out in the Group Stage" sub={`${ordinal(r.seed ?? 0)} in Group ${r.conference}`} cta={nextLbl} onNext={onNext} />
  if (isUcl && (!r.madePlayoffs || !ties.length)) {
    return (
      <div className="ssp-ucl-out">
        <MissCard eyebrow="The Knockouts" title="Out in the League Phase" sub={`${ordinal(r.seed ?? 0)} of ${r.standings?.length ?? 36}. The top 24 go through.`} cta={nextLbl} onNext={onNext} />
        <div className="simp-screen">{bracket}</div>
      </div>
    )
  }
  if (!ties.length) return <MissCard eyebrow="Cups & Europe" title="No Cup Run" sub="No knockout football this season." cta={nextLbl} onNext={onNext} />

  if (end) {
    const wonFinals = ties.filter(x => x.final && x.won && x !== last).map(compName)
    const endTitle = isWc
      ? ({ 'Runners-up': 'Lost the Final', 'Third place': 'Third Place', 'Fourth place': 'Fourth Place' }[r.finish] ?? 'Knocked Out')
      : last?.final ? 'Lost the Final' : 'Knocked Out'
    return (
      <div className="simp-screen smd-screen">
        <div className="simp-eyebrow-row"><div className="simp-eyebrow">{isWc ? 'The Knockouts' : isUcl ? 'Champions League' : 'Cups & Europe'}</div></div>
        {champ
          ? <ChampCard title={isWc ? 'World Champions' : `${compName(last)} Winners`} sub={`${tieLine(last)} v ${oppOf(last)} · ${roundName(last)}`}
              trophy={<span className="ssp-trophy-art"><TrophyDefs /><TrophyArt kind="mvp" shine={1} /></span>} popped={popped} onPop={() => { setPopped(true); sfx('claim') }} cta={nextLbl} onNext={onNext} />
          : <OverCard eyebrow={isWc ? 'Tournament Over' : 'Season Over'} title={endTitle} round={title(last)} line={`${last?.won ? 'Won' : 'Lost'} ${tieLine(last)} v ${oppOf(last)}`} cta={nextLbl} onNext={onNext}>
              {wonFinals.length > 0 && <div className="ssp-trophies ssp-end-won">{wonFinals.map(x => <span key={x} className="ssp-trophy">{x.toUpperCase()} WINNERS</span>)}</div>}
            </OverCard>}
        {bracket}
        <Section title="MATCH BY MATCH"><Fixtures list={legs.map(x => x.m)} pool={pool} initial={20} /></Section>
        {ringOpen && (
          <RingCeremony team={{ name: team?.name, color: team?.color, color2: team?.color2 }} title={isWc ? 'World Champions' : `${compName(last)} Winners`}
            score={`${tieLine(last)} v ${oppOf(last)}`} art={<span className="ag-ring-trophy ssp-ring-art"><TrophyDefs /><TrophyArt kind="mvp" shine={1} /></span>}
            onClose={() => setRingOpen(false)} />
        )}
      </div>
    )
  }

  const { t, li, m } = legs[j]
  const two = t.legs.length > 1
  const lastLeg = li === t.legs.length - 1
  const first = two && li > 0 ? t.legs[0] : null
  const final = !!t.final || m.stage === 'final'
  const label = `${title(t)}${two ? ` · ${li === 0 ? 'First' : 'Second'} leg` : ''}`
  const usName = team?.name ?? us
  const oppName = oppOf(t)
  const beforeLine = first ? `First leg: ${first.home ? `${usName} ${first.mySc}–${first.oppSc} ${oppName}` : `${oppName} ${first.oppSc}–${first.mySc} ${usName}`}` : null
  const outLine = lastLeg ? `${t.won ? (t.final ? `${usName} win the ${compName(t)}` : `${usName} go through`) : `${usName} are out`}${two || m.shootout || m.et ? `, ${tieLine(t)}` : ''}.` : (two ? `First leg to ${m.mySc > m.oppSc ? usName : m.mySc < m.oppSc ? oppName : 'neither side'}. The tie is ${m.mySc}–${m.oppSc} at half-way.` : null)
  // the rest of his round, once his match is done (the World Cup's, the Champions League's ties)
  const stage = m.stage ?? (isUcl ? ['po', 'r16', 'qf', 'sf', 'final'][t.roundIndex] : null)
  const others = lastLeg && r.bracket && stage && stage !== 'final' && stage !== 'third'
    ? (r.bracket[stage] ?? []).filter(x => (x.home ?? x.a) !== us && (x.away ?? x.b) !== us).slice(0, 8)
    : []
  const after = (
    <>
      {others.length > 0 && (
        <ul className="smd-others smd-others--ko">
          <li className="smd-others-h">The rest of the {roundName(t)}</li>
          {others.map((x, i) => <OtherLine key={i} h={x.home ?? x.a} a={x.away ?? x.b} hs={x.hs ?? x.sa} as={x.as ?? x.sb} pool={pool} note={x.pens ? `${x.pens[0]}–${x.pens[1]} pens` : x.et ? 'aet' : x.legs ? 'agg' : null} />)}
        </ul>
      )}
    </>
  )
  const ctx = { key: `${r.season}|${us}|ko|${j}`, userName, pool, us: ctxTeam(us, pool, team), them: ctxTeam(m.opponent, pool, { name: m.oppName }), crest: crestNode(pool), logo: logoUrl(pool) }
  const before = first ? [first.mySc, first.oppSc] : null
  return (
    <div className="simp-screen smd-screen">
      <div className="smd-top">
        <span className="smd-top-comp">{isWc ? wcName(r.season, true) : isUcl ? `Champions League ${r.season}` : compName(t)} · The Knockouts</span>
        <span className="smd-top-rec">{title(t)}{two ? ` · ${li === 0 ? 'first' : 'second'} leg` : ''}</span>
      </div>
      <MatchCentre key={j} item={{ m, label, kicker: final ? `${isWc ? wcName(r.season, true) : compName(t)}` : compName(t), before, final, beforeLine, tieLine: outLine }}
        ctx={ctx} play={final ? 'live' : play} speed={speed} paused={paused} onSpeed={v => { setSpeed(v); setPaused(false) }} onPause={() => setPaused(p => !p)}
        onNext={() => setJ(x => x + 1)} nextLabel={j + 1 >= legs.length ? (champ ? 'The trophy' : isWc ? 'Tournament over' : 'Season over') : lastLeg ? 'Next round' : 'Second leg'}
        autoNext={j + 1 < legs.length} after={after}
        simAll={j + 1 < legs.length ? <button type="button" className="smd-simall" onClick={() => setJ(legs.length)}>Sim to the end</button> : null} />
      {bracket}
    </div>
  )
}

// a World Cup bracket; `upto`: how many of his ties are played (the rounds after stay blank, the next one has no scores)
function Bracket({ bracket, us, upto = 99 }) {
  if (!bracket) return null
  const rounds = ['r32', 'r16', 'qf', 'sf', 'final'].filter(k => (k === 'final' ? bracket.final : bracket[k]?.length))
  return (
    <div className="ssp-bracket">
      {rounds.map((k, ri) => {
        const list = k === 'final' ? [bracket.final] : bracket[k]
        const known = ri < upto, open = ri === upto
        return (
          <div key={k} className="ssp-br-col">
            <span className="ssp-br-rnd">{STAGE_TAG[k]}</span>
            <div className="ssp-br-list">
            {list.map((m, i) => (
              <div key={i} className={`ssp-br-m${(known || open) && (m.home === us || m.away === us) ? ' is-us' : ''}`}>
                {[[m.home, m.hs, 0], [m.away, m.as, 1]].map(([s, g, j]) => (known || open
                  ? <span key={j} className={`ssp-br-t${known && m.winner === s ? ' is-w' : ''}`}><Crest short={s} pool="alltime" size={14} /><em>{s}</em><b>{known ? <>{g}{m.pens ? <small>({m.pens[j]})</small> : null}</> : ''}</b></span>
                  : <span key={j} className="ssp-br-t is-tbd"><em>TBD</em><b /></span>))}
              </div>
            ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// the Champions League's bracket: play-offs, Round of 16, quarter-finals, semi-finals, the final, each tie's aggregate
// (penalties after); `upto`: the round he's playing (the rounds before it have their scores, his its pairings)
const UCL_COLS = [['po', 'PO'], ['r16', 'R16'], ['qf', 'QF'], ['sf', 'SF'], ['final', 'FINAL']]
function UclBracket({ bracket, us, upto = 99, rows = [] }) {
  const noLogo = useMemo(() => new Set(rows.filter(x => x.extra).map(x => x.short)), [rows])
  if (!bracket) return null
  return (
    <div className="ssp-bracket ssp-bracket--ucl">
      {UCL_COLS.map(([k, tag], ri) => {
        const known = ri < upto, open = ri === upto
        return (
          <div key={k} className="ssp-br-col">
            <span className="ssp-br-rnd">{tag}</span>
            <div className="ssp-br-list">
              {(bracket[k] ?? []).map((t, i) => (
                <div key={i} className={`ssp-br-m${(known || open) && (t.a === us || t.b === us) ? ' is-us' : ''}`}>
                  {[[t.a, t.sa, 0], [t.b, t.sb, 1]].map(([s, g, j]) => (known || open
                    ? <span key={j} className={`ssp-br-t${known && t.winner === s ? ' is-w' : ''}`}><Crest short={s} pool="current" size={14} extra={noLogo.has(s)} /><em>{s}</em><b>{known ? <>{g}{t.pens ? <small>({t.pens[j]})</small> : null}</> : ''}</b></span>
                    : <span key={j} className="ssp-br-t is-tbd"><em>TBD</em><b /></span>))}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── The legacy screen (basketball's GOAT Status) ─────────────────────────────
// A club season: the Ballon d'Or, counted down to where he finished, then the Golden Shoe
// (seen: shown before, so Back from the final report finds it as it ended, not counted again)
function ScreenBallon({ r, onNext, userName, seen, onSeen }) {
  const bdo = r.ballonDor, shoe = r.goldenShoe
  const rank = bdo?.rank ?? 99
  const top = bdo?.top ?? []
  const inTop = rank <= Math.max(10, top.length)
  const [phase, setPhase] = useState(seen ? (inTop ? 'revealed' : 'miss') : 'checking')
  const [tk, setTk] = useState(seen ? rank : 11)
  useEffect(() => { onSeen?.(); if (seen) return; const t = setTimeout(() => setPhase(inTop ? 'ticker' : 'miss'), 2200); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase !== 'ticker') return
    if (tk <= rank) { const t = setTimeout(() => setPhase('revealed'), 1100); return () => clearTimeout(t) }
    const d = tk - rank
    const t = setTimeout(() => setTk(x => x - 1), d > 5 ? 170 : 290)
    return () => clearTimeout(t)
  }, [phase, tk, rank])
  // (the ticker shows who sits at each place once he's in: it never gives his place away)
  const at = tk <= 10 ? top[tk - 1] : null
  const tickEntry = at?.isPlayer ? null : at
  const verdict = rank === 1 ? `${userName} wins the Ballon d'Or` : `${userName} finishes ${ordinal(rank)}`
  return (
    <div className="simp-screen goat-screen ssp-legacy">
      <div className="goat-screen-title">BALLON D'OR</div>
      <div className="goat-page-title">The Best Player in the World</div>
      <div className="goat-eyebrow">{r.season}</div>
      {phase === 'checking' && <Checking label="Counting the votes…" />}
      {phase === 'ticker' && (
        <div className="goat-ticker" onClick={() => setPhase('revealed')}>
          <div className="goat-ticker-rank">#{Math.min(10, tk)}</div>
          {tickEntry ? <Crest short={tickEntry.team} pool="current" size={96} className="ssp-ticker-crest" /> : <span className="ssp-ticker-crest ssp-ticker-q">?</span>}
          <div className="goat-ticker-name">{tickEntry ? tickEntry.name : '…'}</div>
          <div className="goat-ticker-team">{tickEntry ? (teamOf(tickEntry.team, 'current')?.name ?? tickEntry.team) : ''}</div>
        </div>
      )}
      {phase === 'miss' && (
        <div className="goat-miss-card">
          <div className="goat-miss-title">{bdo?.finish === 'nominated' ? `${ordinal(rank)} in the Voting` : 'Not Nominated'}</div>
          <div className="goat-miss-ovr">OVR {r.ovr}</div>
          <div className="ssp-miss-note">{bdo?.finish === 'nominated' ? 'On the 30-man shortlist, outside the top ten' : 'Left off the 30-man shortlist'}</div>
        </div>
      )}
      {phase === 'revealed' && (
        <div className="goat-reveal-banner">
          <div className="goat-reveal-you">{verdict}</div>
          <div className="goat-reveal-rank">#{rank}</div>
        </div>
      )}
      {(phase === 'revealed' || phase === 'miss') && (
        <>
          <button className="simp-cta simp-cta-in" onClick={onNext} style={{ marginBottom: 8 }}>Final Report →</button>
          {bdo && (
            <Award title="BALLON D'OR" won={bdo.finish === 'winner'} tag={bdo.finish === 'winner' ? 'WINNER' : rank <= 30 ? ordinal(rank).toUpperCase() : 'NOT NOMINATED'}>
              <Race list={top} userName={userName} pool="current" unit={null} n={10} />
            </Award>
          )}
          {shoe && (
            <Award title="EUROPEAN GOLDEN SHOE" won={shoe.won} tag={shoe.won ? 'WINNER' : `${ordinal(shoe.rank)} IN EUROPE`}>
              <Race list={shoe.race} userName={userName} pool="current" n={5} />
            </Award>
          )}
          <button className="simp-cta simp-cta-in" onClick={onNext} style={{ marginTop: 12 }}>Final Report →</button>
        </>
      )}
    </div>
  )
}

// A World Cup: the tournament's awards, counted one at a time
function ScreenWcAwards({ r, onNext, userName, seen, onSeen }) {
  const gb = r.goldenBoot, ball = r.goldenBall, young = r.bestYoungPlayer
  const k = useStaged(true, [2200, 2900, 3600, 4300, 4900], !!seen)
  useEffect(() => { onSeen?.() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="simp-screen goat-screen ssp-legacy">
      <div className="goat-screen-title">THE AWARDS</div>
      <div className="goat-page-title">{wcName(r.season, true)}</div>
      <div className="goat-eyebrow">THE TOURNAMENT'S BEST</div>
      {k === 0 && <Checking label="Counting the votes…" />}
      {k >= 1 && <div className="ag-pop"><StrikerLine r={r} title="THE TOURNAMENT" comps={false} /></div>}
      {k >= 2 && gb && (
        <div className="ag-pop">
          <Award title="GOLDEN BOOT" won={gb.won} tag={gb.won ? 'WINNER' : `${ordinal(gb.rank)} · ${gb.goals} ${gb.goals === 1 ? 'GOAL' : 'GOALS'}`}>
            <Race list={gb.race} userName={userName} pool="alltime" />
          </Award>
        </div>
      )}
      {k >= 3 && ball && (
        <div className="ag-pop"><Award title={ball.medal ? ball.medal.toUpperCase() : 'GOLDEN BALL'} won={!!ball.medal} tag={ball.medal ? (ball.won ? 'THE BEST PLAYER AT THE WORLD CUP' : `GOLDEN BALL: ${who(ball.winner, userName).toUpperCase()}`) : `WON BY ${who(ball.winner, userName).toUpperCase()}`} /></div>
      )}
      {k >= 4 && young?.eligible && (
        <div className="ag-pop"><Award title="BEST YOUNG PLAYER" won={young.won} tag={young.won ? 'WINNER' : `WON BY ${who(young.winner, userName).toUpperCase()}`} /></div>
      )}
      {k >= 5 && <button className="simp-cta simp-cta-in" onClick={onNext} style={{ marginTop: 12 }}>Final Report →</button>}
    </div>
  )
}

// A Champions League season: UEFA's awards, counted one at a time (the top scorer, the Player of the Season, the Young
// Player of the Season, the Team of the Season)
function ScreenUclAwards({ r, onNext, userName, seen, onSeen }) {
  const gb = r.goldenBoot, poty = r.playerOfSeason, young = r.youngPlayer
  const k = useStaged(true, [2000, 2700, 3400, 4100, 4700], !!seen)
  useEffect(() => { onSeen?.() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="simp-screen goat-screen ssp-legacy">
      <div className="goat-screen-title">THE AWARDS</div>
      <div className="goat-page-title">Champions League {r.season}</div>
      <div className="goat-eyebrow">THE SEASON'S BEST</div>
      {k === 0 && <Checking label="Counting the votes…" />}
      {k >= 1 && <div className="ag-pop"><StrikerLine r={r} title="THE CAMPAIGN" comps={false} /></div>}
      {k >= 2 && gb && (
        <div className="ag-pop">
          <Award title="TOP SCORER" won={gb.won} tag={gb.won ? (gb.shared ? 'SHARED' : 'WINNER') : `${ordinal(gb.rank)} · ${gb.goals} ${gb.goals === 1 ? 'GOAL' : 'GOALS'}`}>
            <Race list={gb.race} userName={userName} pool="current" />
          </Award>
        </div>
      )}
      {k >= 3 && poty && (
        <div className="ag-pop">
          <Award title="PLAYER OF THE SEASON" won={poty.won} tag={poty.won ? 'WINNER' : `WON BY ${who(poty.winner, userName).toUpperCase()}`}>
            <Race list={poty.top} userName={userName} pool="current" unit={null} n={5} />
            {r.teamOfSeason && <p className="ssp-award-note">{userName} is named in the Team of the Season.</p>}
          </Award>
        </div>
      )}
      {k >= 4 && young?.eligible && (
        <div className="ag-pop"><Award title="YOUNG PLAYER OF THE SEASON" won={young.won} tag={young.won ? 'WINNER' : `WON BY ${who(young.winner, userName).toUpperCase()}`} /></div>
      )}
      {k >= 5 && <button className="simp-cta simp-cta-in" onClick={onNext} style={{ marginTop: 12 }}>Final Report →</button>}
    </div>
  )
}

function ScreenFinal({ r, pool, build, types, arch, onReset, onBack, userName, isSalaryMode, adsDisabled }) {
  const isWc = pool === 'alltime'
  const isUcl = !isWc && SoccerSim.isUclResult(r)
  const lg = r.league ?? {}
  const head = isWc ? (WC_FINISH[r.finish] ?? 'THE WORLD CUP')
    : isUcl ? (UCL_FINISH[r.finish] ?? 'THE CHAMPIONS LEAGUE')
    : r.champion ? `${String(lg.name ?? 'League').toUpperCase()} CHAMPIONS` : r.relegated ? 'RELEGATED' : `${ordinal(r.seed ?? 0)} in ${inLeague(lg.name)}`.toUpperCase()
  const ribbons = isWc
    ? [r.champion && 'WORLD CHAMPIONS', r.goldenBoot?.won && 'GOLDEN BOOT', r.goldenBall?.medal && r.goldenBall.medal.toUpperCase(), r.bestYoungPlayer?.won && 'BEST YOUNG PLAYER'].filter(Boolean)
    : isUcl
    ? [r.champion && 'CHAMPIONS LEAGUE WINNERS', r.goldenBoot?.won && (r.goldenBoot.shared ? 'JOINT TOP SCORER' : 'TOP SCORER'), r.playerOfSeason?.won && 'PLAYER OF THE SEASON', r.youngPlayer?.won && 'YOUNG PLAYER OF THE SEASON', r.teamOfSeason && 'TEAM OF THE SEASON'].filter(Boolean)
    : [...(r.trophies ?? []).map(t => t.toUpperCase()), r.goldenBoot?.won && String(r.goldenBoot.name ?? 'Golden Boot').toUpperCase(), r.playerOfSeason?.won && 'PLAYER OF THE SEASON', r.goldenShoe?.won && 'GOLDEN SHOE', BDO_FINISH[r.ballonDor?.finish]].filter(Boolean)
  const tier = r.champion ? 'champ' : r.madePlayoffs ? 'playoffs' : 'miss'
  const card = useMemo(() => ({
    sport: 'soccer', name: userName || 'Guest',
    tag: ['ST', isSalaryMode ? 'SALARY CAP' : SOCCER_POOL[pool].label].join('  ·  '),
    hero: { value: r.ovr ?? '–', label: 'OVR' }, sub: arch && !/remaining$/.test(arch) ? arch : null,
    record: `${r.wins}-${r.draws}-${r.losses}`, headline: head, tier,
    ribbons: ribbons.slice(0, 3),
    team: r.team ? { name: r.team.name, short: r.team.short, color: r.team.color, color2: r.team.color2, logo: `${LOGO[pool]}${r.team.short}.png` } : null,
    stats: [{ v: r.goals ?? 0, k: 'GOALS' }, { v: r.assists ?? 0, k: 'ASSISTS' }, { v: one(r.avgRating), k: 'RATING' }],
    chips: types.filter(t => build[t]).map(t => ({ label: SOCCER_ATTR[t]?.label ?? t, name: build[t].qbFull, photo: build[t].photo, faceCenter: build[t].faceCenter, val: build[t].val })),
    site: 'build-a-player.com/soccer',
  }), [r]) // eslint-disable-line react-hooks/exhaustive-deps
  const best = r.bestGame
  const bestOpp = best ? (teamOf(best.opponent, pool)?.name ?? best.oppName ?? best.opponent) : null
  return (
    <div className="simp-screen ssp-screen ssp-final">
      {APP_SIM && <SeasonRewards result={r} what={isWc ? 'tournament' : 'season'} />}
      <div className={`ssp-hero is-final${r.champion ? ' is-champ' : ''}`}>
        <span className="ssp-eyebrow">{userName} · ST · {isWc ? wcName(r.season) : isUcl ? `${r.team?.name} · Champions League ${r.season}` : `${r.team?.name} ${r.season}`}</span>
        <h2 className="ssp-head">{head}</h2>
        <div className="ssp-final-ovr"><b>{r.ovr}</b><small>OVR</small><span>{arch}</span></div>
        {ribbons.length > 0 && <div className="ssp-ribbons">{ribbons.map(x => <span key={x}>{x}</span>)}</div>}
      </div>
      {APP_SIM && <ShareSeasonButton card={card} className="ssp-share" what={isWc ? 'tournament' : 'season'} />}
      <Tiles items={[[r.goals ?? 0, `${isWc || isUcl ? '' : 'LEAGUE '}${r.goals === 1 ? 'GOAL' : 'GOALS'}`, true], [r.assists ?? 0, r.assists === 1 ? 'ASSIST' : 'ASSISTS', true], isWc || isUcl ? [r.apps ?? 0, 'APPS'] : [r.allComps?.goals ?? r.goals ?? 0, 'ALL COMPS'], [one(r.xg), 'xG'], [one(r.avgRating), 'AVG RATING']]} small={3} />
      {best && (
        <div className="simp-best-game">
          <div className="simp-section-lbl">Best Match</div>
          <div className="simp-best-body">
            <span className="sbg-week">{isWc ? (STAGE_TAG[best.stage] ?? 'WC') : fxTag(best) ?? `MW ${best.wk ?? best.g ?? ''}`}</span>
            <span className="sbg-opp">{best.home || best.neutral ? 'v' : 'at'} {bestOpp}</span>
            <span className="sbg-line">{scoreOf(best)} · {best.goals ?? 0} {best.goals === 1 ? 'goal' : 'goals'}{best.assists ? `, ${best.assists} ${best.assists === 1 ? 'assist' : 'assists'}` : ''}{best.rating != null ? ` · ${one(best.rating)}` : ''}</span>
          </div>
        </div>
      )}
      <div className="simp-stat-section">
        <div className="simp-stat-group-lbl"><NameTag name={userName} self /><span className="un-keep">'s</span> Build</div>
        <BuildRows build={build} types={types} pool={pool} small />
      </div>
      <div className="simp-final-actions">
        {isSalaryMode
          ? <button className="simp-cta" onClick={onBack}>← Back to Salary</button>
          : <><button className="simp-cta" onClick={onReset}>New Build</button><button className="ssp-ghost" onClick={onBack}>Back to Build</button></>}
      </div>
    </div>
  )
}

// ─── The page ────────────────────────────────────────────────────────────────
export default function SoccerSimPage({ result, build, types, pool = 'current', onBack, onReset, isSalaryMode = false, initialScreen = 0, onFinal = null, userName = 'Guest', arch = '', adsDisabled = false, live: kept = null }) {
  const tapGuard = useTapGuard()
  const isWc = pool === 'alltime'
  const LAST = 4
  // a season that's already booked opens on its final report: no second run at it
  // a season kept on the device (lib/seasonLive.js): booked, it opens on the screen it was left on (and is never booked
  // again); still playing, the director picks back up where it was
  const keptDone = !!kept?.booked
  const keptDir = !!kept && !kept.booked && !!kept.dir
  const [reopened] = useState(() => { if (keptDone && result) BOOKED.add(result); return initialScreen === 'final' || keptDone || (result && BOOKED.has(result) && !isSalaryMode) })
  const [screen, setScreen] = useState(() => (keptDone && kept.screen > 0 ? Math.min(LAST, kept.screen) : reopened ? LAST : kept && kept.screen > 0 ? 1 : 0))
  useRailOn(screen)   // each screen brings the bottom rail back
  useEffect(() => { if (kept) savePos(kept, { screen }) }, [screen]) // eslint-disable-line react-hooks/exhaustive-deps
  const isUcl = !isWc && SoccerSim.isUclResult(result)
  const info = useMemo(() => (isUcl ? UCL_INFO : !isWc && result?.league?.id ? SoccerSim.soccerLeagueInfo?.(result.league.id) : null), [isWc, isUcl, result])
  // what's been watched once plays back straight to its end (Back onto it)
  const [seen, setSeen] = useState(() => (keptDone ? { season: true, ko: kept.screen > 2, awards: kept.screen > 3 } : reopened ? { season: true, ko: true, awards: true } : {}))
  const awardsSeen = useCallback(() => setSeen(s => (s.awards ? s : { ...s, awards: true })), [])
  // the season as played: the result, or the director's booked season once the moments have changed it
  const [live, setLive] = useState(result)
  // how the matches play (every one live, or the results only), the clock's speed, the pause: kept across the screens
  const [play, setPlay] = useState(readPlay)
  const [speed, setSpeed] = useState(readSpeed)
  const [paused, setPaused] = useState(false)
  const r = live ?? result

  // The moments (basketball's): a club season on the app's look, while they're on. The director and its story cards
  // load only then (lib/soccerDirector.js, SeasonMoments.jsx), so the default page stays light.
  const canMoments = APP_SIM && !isWc && !isSalaryMode && !reopened && !!result?.games?.length
  const [M, setM] = useState(null)
  const [director, setDirector] = useState(null)
  const loading = useRef(null)
  const loadMoments = useCallback(() => {
    loading.current ??= Promise.all([import('./SeasonMoments'), import('../lib/soccerDirector')]).then(([a, b]) => { const m = { ...a, ...b }; setM(m); return m })
    return loading.current
  }, [])
  // (a season the director was playing: rebuilt from its seed and its state at the last stop)
  const directorOf = m => {
    const d = m.oneOffDirector({ result, build, types, name: userName, attrMap: SOCCER_ATTR, seed: kept && !keptDone ? kept.seed : null })
    return keptDir && kept.snap ? d.restore(kept.snap) : d
  }
  useEffect(() => { if (keptDir) loadMoments().then(m => setDirector(d => d ?? directorOf(m))) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!canMoments) return
    if (momentsOn()) loadMoments()
    const on = () => { if (momentsOn()) loadMoments() }
    window.addEventListener('bap:moments-off', on)
    return () => window.removeEventListener('bap:moments-off', on)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // booked once: when the season's been played out (basketball's moment), or on the way out
  const book = useCallback((res = live ?? result, leaving = false) => {
    if (!result || BOOKED.has(result)) return
    BOOKED.add(result); BOOKED.add(res)
    onFinal?.(res, leaving ? { leaving: true } : undefined)
  }, [result, live, onFinal])
  const handleFinal = final => { setLive(final); book(final) }
  useEffect(() => { if (screen === LAST) book() }, [screen, book])
  // (a real leave only, not React's development double mount: a season left mid-way is booked as far as it went)
  useOnLeave(() => { if (director && !director.finalized) book(director.finalize(), true); else if (!(keptDir && !director)) book(undefined, true) })   // (a kept season whose director hadn't loaded stays as it was)

  if (!result) return null
  const go = () => {
    tapGuard.mark()
    document.querySelector('.simp-page')?.scrollTo({ top: 0, behavior: 'instant' })
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (screen === 1) setSeen(x => ({ ...x, season: true }))
    setScreen(s => Math.min(LAST, s + 1))
  }
  // Simulate Season: with the moments on, the director takes the season (its module waited for, if it isn't in yet)
  const next = () => {
    if (screen !== 0 || director || !canMoments || !momentsOn()) { go(); return }
    tapGuard.mark()
    loadMoments().then(m => { setDirector(d => d ?? directorOf(m)); if (kept && !keptDone) saveStop(kept, { dir: true }); go() }).catch(() => go())
  }
  const team = result.team
  const reset = () => { setScreen(0); onReset() }
  const back = () => { setScreen(0); onBack() }
  // the Champions League and the World Cup are played a match at a time (SoccerMatchDay.jsx); a domestic season kept
  // from before 2026-11-16 plays out as it always did
  const matchDay = isWc || isUcl
  const live1 = { play, speed, setSpeed, paused, setPaused }
  const screens = [
    <ScreenBuild key="build" result={result} build={build} types={types} onNext={next} pool={pool} arch={arch} team={team} play={play} setPlay={setPlay} />,
    matchDay
      ? (director && M && !seen.season
        ? <ScreenMatchDay key="season-dr" r={r} pool={pool} onNext={next} userName={userName} seen={false} director={director} M={M} kept={kept && !keptDone ? kept : null} onFinal={handleFinal} {...live1} />
        : keptDir && !(director && M) ? null
        : <ScreenMatchDay key="season" r={r} pool={pool} onNext={next} onDone={() => { if (!director) book(result) }} userName={userName} seen={!!seen.season} M={M} {...live1} />)
    : director && M && !seen.season
      ? <M.DirectedReveal key="season-dr" director={director} pace={150} onFinal={handleFinal} live={kept && !keptDone ? kept : null}>
          {dr => <ScreenSeason r={r} pool={pool} info={info} onNext={next} userName={userName} adsDisabled={adsDisabled} seen={false} dr={{ ...dr, all: director.games }} M={M} />}
        </M.DirectedReveal>
      : keptDir && !(director && M) ? null   // (the director still loading: never the plain season, which would book the unsteered one)
      : <ScreenSeason key="season" r={r} pool={pool} info={info} onNext={next} onDone={() => { if (!director) book(result) }} userName={userName} adsDisabled={adsDisabled} seen={!!seen.season} />,
    <ScreenKnockouts key="ko" r={r} pool={pool} onNext={next} userName={userName} adsDisabled={adsDisabled} seen={!!seen.ko} onSeen={() => setSeen(s => ({ ...s, ko: true }))} {...live1} />,
    isWc ? <ScreenWcAwards key="awards" r={r} onNext={next} userName={userName} seen={!!seen.awards} onSeen={awardsSeen} /> : isUcl ? <ScreenUclAwards key="awards" r={r} onNext={next} userName={userName} seen={!!seen.awards} onSeen={awardsSeen} /> : <ScreenBallon key="ballon" r={r} onNext={next} userName={userName} seen={!!seen.awards} onSeen={awardsSeen} />,
    <ScreenFinal key="final" r={r} pool={pool} build={build} types={types} arch={arch} onReset={reset} onBack={back} userName={userName} isSalaryMode={isSalaryMode} adsDisabled={adsDisabled} />,
  ]
  const teamStyle = team ? { '--team-color': team.color, '--team-color2': team.color2 ?? team.color } : undefined
  const sub = isWc ? `${wcName(result.season)} · Group ${result.conference}` : `${result.league?.name ?? ''} · ${result.season}`
  // the size the build plays at: height and weight off his Strength player
  const sz = build?.[SOCCER_SIZE_SLOT]
  return (
    <div className="simp-page ssp-page" style={teamStyle} onClickCapture={tapGuard.onClickCapture}>
      <div className="simp-col">
        <div className="simp-top-bar">
          {screen > 0 && !reopened && <button className="simp-back-btn" onClick={() => setScreen(s => Math.max(0, s - 1))}>← Back</button>}
          <ProgressDots screen={screen} total={screens.length} />
        </div>
        {/* the moments switch sits above the team card (basketball's), while a club season can have them */}
        {canMoments && screen < 2 && <div className="sts-moments-row"><MomentsToggle /></div>}
        {team && screen === 0 && (
          <div className="simp-team-strip ssp-strip">
            <div className="sts-top-row">
              <Crest short={team.short} pool={pool} size={62} className="sts-logo" />
              <div className="sts-info">
                <div className="sts-name-wrap">
                  <span className="sts-city">{sub}</span>
                  <span className="sts-nickname">{team.name}</span>
                </div>
                {sz?.height ? <span className="ssp-strip-size">{Math.round(sz.height * 2.54)} cm{sz.weight ? ` · ${Math.round(sz.weight * 0.45359)} kg` : ''}</span> : null}
              </div>
              <div className="sts-grades">
                {[['ATT', team.att], ['DEF', team.def]].map(([k, v]) => (
                  <div key={k} className="sts-grade-item">
                    <span className="sts-grade-key">{k}</span>
                    <div className="sts-grade-track"><div className="sts-grade-fill" style={{ width: `${teamMeter(v, pool)}%` }} /></div>
                    <span className="sts-grade-badge">{teamGrade(v, pool)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {screens[screen]}
        {/* (the site's footer and its partner offer only once it's all played: never under a match) */}
        {screen === LAST && <SiteFooter sport="soccer" />}
      </div>
    </div>
  )
}
