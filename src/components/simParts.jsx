import { useEffect, useRef } from 'react'
import { userScrolling } from '../lib/userScroll'
import { dlBuildSpot } from '../utils/simulation'
import { spectrumColor } from '../lib/gradeColors'

// Pieces of football's season page (SimPage.jsx) that College Football's season page (cfb/CFBSimPage.jsx)
// draws too: kept here, light, so the college screens don't load SimPage and its NFL rosters to get them.
export function offDefGrade(val) {
  if (val >= 10) return 'A+'
  if (val >= 9)  return 'A'
  if (val >= 8)  return 'A-'
  if (val >= 7)  return 'B+'
  if (val >= 6)  return 'B'
  if (val >= 5)  return 'B-'
  if (val >= 4)  return 'C+'
  if (val >= 3)  return 'C'
  if (val >= 2)  return 'C-'
  return 'D'
}

// ESPN-style season line: one header row of abbreviations, one data row, with
// "Your Build" pinned as the first column (sticky so it stays put when the
// table scrolls sideways on a phone). Used for every position. `values` lets
// the final screen pass count-up animated numbers keyed by column; anything
// left out falls back to the raw result.
export const int0 = n => (typeof n === 'number' ? Math.round(n).toLocaleString() : n)
export const dec1 = n => (typeof n === 'number' ? n.toFixed(1) : n)

export function statCols(kind, r) {
  const gp = { key: 'gp', label: 'GP', dim: true, val: r.games?.length ?? 0 }
  switch (kind) {
    // OL columns are what he allowed (sacks, pressures, QB hits, flags) plus what he finished (pancakes) and ESPN's
    // pass/run block win rates, in short headers like every other position's (spelled out they wrapped four lines)
    case 'ol': return [
      gp,
      { key: 'sck',  label: 'SCK',  val: r.seasonSacksAllowed },
      { key: 'prs',  label: 'PRS',  val: r.seasonPressures },
      ...(r.seasonQBHits != null ? [{ key: 'qbh', label: 'HITS', val: r.seasonQBHits }] : []),
      { key: 'pen',  label: 'PEN',  val: r.seasonPenalties },
      { key: 'pnk',  label: 'PNK',  val: r.seasonPancakes },
      { key: 'pbwr', label: 'PBWR', val: r.seasonPBWR, fmt: n => `${dec1(n)}%` },
      { key: 'rbwr', label: 'RBWR', val: r.seasonRBWR, fmt: n => `${dec1(n)}%` },
      ...(r.seasonGrade != null ? [{ key: 'grd', label: 'Grade', val: r.seasonGrade, fmt: n => dec1(n) }] : []),
    ]
    case 'dl': return [
      gp,
      { key: 'sck', label: 'SCK', val: r.seasonSacks },
      { key: 'tfl', label: 'TFL', val: r.seasonTFL },
      { key: 'tkl', label: 'TKL', val: r.seasonTackles },
      { key: 'qbh', label: 'QB HITS', val: r.seasonQBHits },
      { key: 'ff',  label: 'FF',  val: r.seasonFF },
      { key: 'fr',  label: 'FR',  val: r.seasonFR },
      { key: 'pd',  label: 'PD',  val: r.seasonPBUs },
    ]
    case 'lb': return [
      gp,
      { key: 'tkl', label: 'TKL', val: r.seasonTackles },
      { key: 'tfl', label: 'TFL', val: r.seasonTFL },
      { key: 'sck', label: 'SCK', val: r.seasonSacks },
      { key: 'qbh', label: 'QB HITS', val: r.seasonQBHits },
      { key: 'pd',  label: 'PD',  val: r.seasonPDs },
      { key: 'int', label: 'INT', val: r.seasonINTs },
      { key: 'ff',  label: 'FF',  val: r.seasonFF },
      { key: 'fr',  label: 'FR',  val: r.seasonFR },
    ]
    case 'k': return [
      gp,
      { key: 'fg',   label: 'FG',   val: r.seasonFGA != null ? `${r.seasonFGM ?? 0}/${r.seasonFGA}` : null },
      { key: 'pct',  label: 'FG%',  val: r.seasonFGPct, fmt: n => `${n}%` },
      { key: 'lng',  label: 'LNG',  val: r.seasonLong },
      // (the ranges read short to long: 1-39, 40-49, then 50+)
      { key: 'u40',  label: '1-39', val: r.seasonRanges ? `${r.seasonRanges.u30[0] + r.seasonRanges.r30[0]}/${r.seasonRanges.u30[1] + r.seasonRanges.r30[1]}` : null },
      { key: 'r40',  label: '40-49', val: r.seasonRanges ? `${r.seasonRanges.r40[0]}/${r.seasonRanges.r40[1]}` : null },
      { key: 'r50',  label: '50+',  val: r.seasonRanges ? `${r.seasonRanges.r50[0]}/${r.seasonRanges.r50[1]}` : null },
      { key: 'xp',   label: 'XP',   val: r.seasonXPA != null ? `${r.seasonXPM ?? 0}/${r.seasonXPA}` : null },
      { key: 'pts',  label: 'PTS',  val: r.seasonPoints },
      { key: 'gw',   label: 'GW',   val: r.seasonGW },
    ]
    case 'db': return [
      gp,
      { key: 'tkl', label: 'TKL', val: r.seasonTackles },
      { key: 'tfl', label: 'TFL', val: r.seasonTFL },
      { key: 'pd',  label: 'PD',  val: r.seasonPBUs },
      { key: 'int', label: 'INT', val: r.seasonINTs },
      { key: 'td',  label: 'TD',  val: r.seasonPickSixes },
      { key: 'ff',  label: 'FF',  val: r.seasonFF ?? 0 },
    ]
    case 'rb': return [
      gp,
      { key: 'car',     label: 'CAR',     val: r.seasonCarries },
      { key: 'rushYds', label: 'YDS',     val: r.seasonRushYds, fmt: int0 },
      { key: 'ypc',     label: 'AVG',     val: r.seasonYPC, fmt: dec1 },
      { key: 'rushTD',  label: 'TD',      val: r.seasonRushTDs },
      { key: 'recYds',  label: 'REC YDS', val: r.seasonRecYds, fmt: int0 },
      { key: 'recTD',   label: 'REC TD',  val: r.seasonRecTDs },
      { key: 'fum',     label: 'FUM',     val: r.seasonFumbles },
      { key: 'lng',     label: 'LNG',     val: r.seasonLong },
    ]
    case 'wr':
    case 'te': return [
      gp,
      { key: 'tgt',    label: 'TGT', val: r.seasonTargets },
      { key: 'rec',    label: 'REC', val: r.seasonRecs },
      ...(r.seasonDrops != null ? [{ key: 'drp', label: 'DRP', val: r.seasonDrops }] : []),
      { key: 'recYds', label: 'YDS', val: r.seasonRecYds, fmt: int0 },
      { key: 'ypr',    label: 'AVG', val: r.seasonYPR, fmt: dec1 },
      { key: 'recTD',  label: 'TD',  val: r.seasonRecTDs },
      { key: 'lng',    label: 'LNG', val: r.seasonLong },
    ]
    default: return [
      gp,
      { key: 'cmp',     label: 'CMP%',    val: r.seasonCompPct, fmt: n => `${n}%` },
      { key: 'yds',     label: 'YDS',     val: r.seasonPassYds, fmt: int0 },
      { key: 'td',      label: 'TD',      val: r.seasonTDs },
      { key: 'int',     label: 'INT',     val: r.seasonINTs },
      { key: 'rtg',     label: 'RTG',     val: r.seasonRating },
      { key: 'rushYds', label: 'RSH YDS', val: r.seasonRushYds, fmt: int0 },
      { key: 'rushTD',  label: 'RSH TD',  val: r.seasonRushTDs },
      { key: 'sck',     label: 'SCK',     val: r.seasonSacks },
    ]
  }
}

export function StatLineTable({ result, build, kind, values = {}, ready = true, userName = 'Guest' }) {
  const team = result.team
  const pos = kind === 'db' ? (build?.['size']?.subpos === 's' ? 'S' : 'CB') : kind === 'dl' ? (result.spot ?? (dlBuildSpot(build) === 'dt' ? 'DT' : 'EDGE')) : kind === 'ol' ? (result.spot ?? 'OL') : kind.toUpperCase()
  const cols = statCols(kind, result)
  return (
    <div className={`dbt${kind === 'ol' || kind === 'k' ? ' dbt--wrap' : ''}`} style={{ '--dbt-accent': team?.color ?? 'var(--border)' }}>
      <div className="dbt-scroll">
        <table className="dbt-table">
          <thead>
            <tr>
              <th scope="col" className="dbt-name">Player</th>
              {cols.map(c => <th key={c.key} scope="col">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="dbt-name">
                <span className="dbt-player">{userName}</span>
                <span className="dbt-meta">{team?.short ?? '—'} · {pos}</span>
              </th>
              {cols.map(c => {
                const raw = values[c.key] ?? c.val
                const shown = raw == null ? '–' : (c.fmt ? c.fmt(raw) : raw)
                return <td key={c.key} className={c.dim ? 'dbt-dim' : undefined}>{ready ? shown : '–'}</td>
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export const gradeColor = spectrumColor   // one shade a step (lib/gradeColors.js)

// App: every week of the season in one scrolling window. Played weeks show the
// result, weeks still to come wait as numbered rows, and the window keeps the
// newest result in view while the season plays out (scroll back any time).
// (weekOf: an upcoming row's week, when weeks aren't 1, 2, 3…: college's calendar runs Week 0 to Week 14 with byes)
export function GameLog({ games, total, isOL, isK = false, isDB, isDL, isLB = false, isTE, isWR, isRB, weekOf = i => i + 1 }) {
  const boxRef = useRef(null)
  const follow = useRef(true)
  useEffect(() => {
    const el = boxRef.current
    if (!el || !follow.current || userScrolling()) return
    const row = el.children[Math.max(0, games.length - 1)]
    if (row) el.scrollTo({ top: Math.max(0, row.offsetTop - el.clientHeight + row.offsetHeight + 4), behavior: 'smooth' })
  }, [games.length])
  // the player scrolls it: stop following; scroll back to the bottom to follow again
  const userMoved = () => { follow.current = false }
  const statFor = g => g.sat ? 'DNP' : (isK ? `${g.fgm}/${g.fga} FG · ${g.xpm}/${g.xpa} XP` : isOL ? `${g.pancakes} pnk · ${g.sacks} sck` : isLB ? `${g.tackles} tkl · ${g.sacks} sck` : isDL ? `${g.sacks} sck · ${g.tackles} tkl` : isDB ? `${g.tackles} tkl · ${g.ints} int` : (isWR || isTE) ? `${g.rec} rec · ${g.recYds} yds` : isRB ? `${g.rushYds} rush · ${g.rushTDs + g.recTDs} td` : `${g.passYds} yds · ${g.tds} td`)
  return (
    <div className="sm-log-wrap">
      <div className="sm-log-head"><span>SCHEDULE</span><span>{games.length}/{total}</span></div>
      <div
        ref={boxRef}
        className="simp-games-list sm-log"
        onTouchStart={userMoved} onWheel={userMoved}
        onScroll={e => { const el = e.currentTarget; if (el.scrollHeight - el.scrollTop - el.clientHeight < 8) follow.current = true }}
      >
        {Array.from({ length: total }, (_, i) => {
          const g = games[i]
          if (!g) return (
            <div key={`up-${i}`} className="simp-game-row sgr-up">
              <span className="sgr-wk">WK {weekOf(i)}</span>
              <span className="sgr-badge sgr-badge-up">–</span>
              <span className="sgr-opp sgr-opp-up">Upcoming</span>
            </div>
          )
          return (
            <div key={g.wk} className={`simp-game-row ${g.won ? 'sgr-w' : 'sgr-l'} sgr-in`}>
              <span className="sgr-wk">WK {g.wk}</span>
              <span className={`sgr-badge ${g.won ? 'sgr-badge-w' : 'sgr-badge-l'}`}>{g.won ? 'W' : 'L'}</span>
              <span className="sgr-opp"><span className="sgr-venue">{g.home ? 'vs' : '@'}</span>{g.opponent}{g.tags?.length > 0 && <span className="sm-tag sm-tag--row">{g.tags[0]}</span>}</span>
              <span className="sgr-score">{g.mySc}–{g.oppSc}</span>
              <span className="sgr-stat">{statFor(g)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Your line in a playoff game, whatever the position (the round carries its own stats)
export function poLine(r) {
  if (r.fga != null && r.xpa != null) return `${r.fgm ?? 0}/${r.fga} FG${r.long ? ` (long ${r.long})` : ''} · ${r.xpm ?? 0}/${r.xpa} XP · ${r.pts ?? 0} pts${r.gw ? ' · game-winner' : ''}`
  if (r.passYds != null) return `${r.passYds} pass yds · ${r.tds ?? 0} TD · ${r.ints ?? 0} INT${r.rating != null ? ` · ${Math.round(r.rating)} rtg` : ''}`
  if (r.carries != null) return `${r.carries} car · ${r.rushYds ?? 0} rush yds · ${r.recs ?? 0} rec · ${r.recYds ?? 0} rec yds · ${(r.rushTDs ?? 0) + (r.recTDs ?? 0)} TD`
  if (r.targets != null) return `${r.rec ?? 0} rec · ${r.recYds ?? 0} yds · ${r.recTDs ?? 0} TD · ${r.targets} tgt`
  // (a lineman first: his round carries the hits he allowed too, which read as a pass rusher's line below)
  if (r.pancakes != null) { const sk = r.sacks ?? r.sacksA ?? 0; return `${sk} ${sk === 1 ? 'sack' : 'sacks'} allowed · ${r.pressures ?? r.prs ?? 0} pressures · ${r.pancakes} pancakes` }
  if (r.pds != null) return `${r.tackles ?? 0} tkl · ${r.sacks ?? 0} sck · ${r.ints ?? 0} INT${r.ff ? ` · ${r.ff} FF` : ''}`
  if (r.qbHits != null) return `${r.sacks ?? 0} sck · ${r.tfl ?? 0} TFL · ${r.tackles ?? 0} tkl${r.ff ? ` · ${r.ff} FF` : ''}`
  if (r.tackles != null) return `${r.tackles} tkl · ${r.ints ?? 0} INT · ${r.pbus ?? 0} PD${r.ff ? ` · ${r.ff} FF` : ''}`
  return ''
}
// The playoff run, game by game: the round, the result, your line
// (a title game is on neutral ground: "vs", never "@")
const NEUTRAL = /^(Super Bowl|CFP National Championship|National Championship)/i
export function PlayoffLog({ rounds, title = 'Playoff Game Log' }) {
  if (!rounds?.length) return null
  return (
    <div className="po-glog">
      <div className="po-glog-hd">{title}</div>
      {rounds.map((r, i) => (
        <div key={i} className={`po-glog-row${r.won ? ' is-w' : ' is-l'}`}>
          <span className="po-glog-rd">{r.round}</span>
          <span className="po-glog-res"><b>{r.won ? 'W' : 'L'}</b> {r.mySc}–{r.oppSc}{r.overtime ? ' OT' : ''} {r.home || r.neutral || NEUTRAL.test(r.round ?? '') ? 'vs' : '@'} {r.opponent}</span>
          <span className="po-glog-line">{poLine(r)}</span>
        </div>
      ))}
    </div>
  )
}
