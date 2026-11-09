import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import QBAvatar from './QBAvatar'
import SiteFooter from './SiteFooter'
import { valToGrade } from '../utils/simulation'
import { useTapGuard } from '../lib/tapGuard'
import { useRailOn } from '../lib/ads'
import { IS_APP, APP_LOOK } from '../lib/platform'
import { sfx } from '../lib/juice'
import { rampAdd } from '../lib/ads'
import { useCountUp } from '../lib/useCountUp'
import { NameTag } from './app/NameTag'
import { RingCeremony, SeasonRewards } from './app/AppSeason'
import { TrophyArt, TrophyDefs } from './app/TrophyArt'
import { useOnLeave, momentsOn, MomentsToggle, readable, Pulse, ProgressDots, SimLoading, useSeasonReveal, useStaged, useTimerBar, TimerBar, SpeedSeg, useLiveGame, LiveBoard, ChampCard, OverCard, MissCard, WireLine, Checking } from './simFlow'
import { ShareSeasonButton } from './app/SeasonShare'
import { MLB_ATTR } from '../data/mlb-attrs'
import { MLB_TEAMS } from '../data/mlb-teams'
import { BASEBALL_POS, BASEBALL_POOL, BASEBALL_SLOTS, fmtBaseballHeight, baseballHands } from '../lib/baseballUi'
import { BASEBALL_AWARD, baseballAwardTags } from '../lib/baseballAwards'
import './baseball-season.css'

// ═════════════════════════════════════════════════════════════════════════════
// The baseball season page (BaseballApp's 'sim'): basketball's season page (BucketSimPage) in baseball's colours,
// the same five screens and the same buttons (the flow's pieces: components/simFlow.jsx):
//   the build · the regular season, game by game (the record ticks, a dot a game, the wire, the All-Star break as
//   the season passes it; then the division, the October field, his line, month by month, and the league leaders
//   tallied) · the postseason (Play Ball over the bracket, every game of his series live an inning at a time, a
//   bye or the next series on a timer, the World Series trophy or the exit) · awards night (the writers' ballots
//   read out one at a time) · the final report.
// It reads a season from utils/baseballSimulation.js through view() below: everything the page draws is
// gathered there, so the sim's field names are mapped in one place. The player is always the username
// (userName), never "You". The season is booked once (onFinal) when the regular season has played out, or when
// the page is left.
// Styling: components/baseball-season.css (bbs-*), on the shared sim page frame (simp-page / simp-col).
// ═════════════════════════════════════════════════════════════════════════════

const TEAM_MAP = Object.fromEntries(MLB_TEAMS.map(t => [t.short, t]))
const LOGO = '/logos/mlb/'
const BOOKED = new WeakSet()   // a season is booked once, however often its page opens
// The app's season screens run on the website too (as basketball's: BucketSimPage APP_SIM)
const APP_SIM = IS_APP || APP_LOOK
const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return `${n}${s[(v - 20) % 10] || s[v] || s[0]}` }
const num = v => (Number.isFinite(+v) ? +v : 0)
// a rate as the scoreboard prints it: .312 (no leading zero), 1.045
const rate3 = v => (v == null || !Number.isFinite(+v) ? '–' : (+v >= 1 ? (+v).toFixed(3) : (+v).toFixed(3).replace(/^0/, '')))
const f2 = v => (v == null || !Number.isFinite(+v) ? '–' : (+v).toFixed(2))
const f1 = v => (v == null || !Number.isFinite(+v) ? '–' : (+v).toFixed(1))
// innings from outs: 6.2 is six and two-thirds
const ipOf = outs => `${Math.floor(outs / 3)}.${outs % 3}`
// (and in a sentence: 105 2/3 innings)
const ipWords = outs => `${Math.floor(outs / 3)}${outs % 3 ? ` ${outs % 3}/3` : ''}`
const outsOf = ip => { const n = +ip; if (!Number.isFinite(n)) return 0; const w = Math.floor(n); return w * 3 + Math.round((n - w) * 10) }
const teamName = short => TEAM_MAP[short]?.name ?? short ?? ''
const nickName = short => { const t = TEAM_MAP[short]; if (!t) return short ?? ''; const m = /\s(Red Sox|White Sox|Blue Jays)$/.exec(t.name); return t.nick ?? m?.[1] ?? String(t.name).split(' ').slice(-1)[0] }
const GRADE_COL = val0 => { const v = Math.round(val0 ?? 0); return v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444' }

// ── The calendar: 2026's season (Opening Day March 26, the All-Star Game July 14 in Philadelphia, the last
// day September 27). The sim dates every game ('Apr 3'); a game without a date is placed the way the schedule
// runs: about 32 by the end of April, 27 in May, 26 in June, 24 in July, 28 in August, 25 in September.
const MONTHS = ['MARCH/APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER']
const MON = { mar: 0, apr: 0, may: 1, jun: 2, jul: 3, aug: 4, sep: 5, oct: 5 }
const MONTH_GAMES = [32, 27, 26, 24, 28, 25]
const BREAK_AFTER = 96   // undated: the games before the break (85 through June, about 11 in July)
const monthOfIndex = (i, n) => {
  const k = Math.min(161, Math.round((i * 162) / Math.max(1, n)))
  let acc = 0
  for (let m = 0; m < MONTH_GAMES.length; m++) { acc += MONTH_GAMES[m]; if (k < acc) return m }
  return MONTHS.length - 1
}
// 'Apr 3' (or '2026-04-03') as [month index, day]
const dateParts = d => {
  const t = String(d ?? '').trim()
  const a = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})/.exec(t)
  if (a && MON[a[1].toLowerCase()] != null) return [MON[a[1].toLowerCase()], +a[2], a[1].toLowerCase()]
  const b = /^\d{4}-(\d{2})-(\d{2})/.exec(t)
  if (b) { const m = +b[1]; return [Math.max(0, Math.min(5, m - 4)), +b[2], ['', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct'][m]] }
  return null
}
// before the Midsummer Classic: through Sunday July 12 (the break runs July 13-16)
const beforeBreak = d => { const p = dateParts(d); return p ? (p[0] < 3 || (p[2] === 'jul' && p[1] <= 12)) : null }

// ── One game: the sim's game (utils/baseballSimulation.js: opponent, mySc, oppSc, won, date, home, innings,
// walkoff, ps, sat, and his line on it: a batter's gp, ab, h, doubles, triples, hr, rbi, r, bb, k, hbp, sb; a
// pitcher's app, gs, outs, h, er, bb, k, hr, dec) ──
function gameOf(g, i, n) {
  const opp = g.opponent?.short ?? g.opponent ?? g.opp ?? g.oppShort ?? null
  const rs = num(g.mySc ?? g.rs ?? g.runs)
  const ra = num(g.oppSc ?? g.ra ?? g.oppRuns)
  const won = g.won ?? (g.result ? g.result === 'W' : rs > ra)
  const L = g.line && typeof g.line === 'object' ? g.line : g
  const iso = typeof g.iso === 'string' ? g.iso : null   // ('2026-04-03': the game's date; `date` is 'Apr 3')
  const dp = dateParts(iso ?? g.date)
  return {
    i, opp: typeof opp === 'string' ? opp : null, home: g.home ?? null, rs, ra, won, extra: g.innings > 9 ? g.innings : null,
    walkoff: !!g.walkoff, walkedOff: !!g.walkedOff,
    month: dp ? dp[0] : monthOfIndex(i, n), date: g.date ?? null, iso,
    // his line that day (a batter's, or a pitcher's when he pitched)
    bat: { ab: num(L.ab), h: num(L.h), d: num(L.doubles ?? L.d), t: num(L.triples ?? L.t), hr: num(L.hr), rbi: num(L.rbi), r: num(L.r), bb: num(L.bb), so: num(L.k ?? L.so), sb: num(L.sb), hbp: num(L.hbp) },
    pit: { outs: Number.isFinite(L.outs) ? L.outs : outsOf(L.ip), h: num(L.h), er: num(L.er), bb: num(L.bb), so: num(L.k ?? L.so), hr: num(L.hr), dec: L.dec ?? null, gs: !!L.gs, sv: !!L.sv, hld: !!L.hld },
    // (sat: not in the lineup, or not his day on the mound)
    played: !g.sat && !!(g.gp || g.app || num(L.pa) > 0 || num(L.ab) > 0 || num(L.outs) > 0),
    raw: g,
  }
}
// a stretch of games, added up
function sumBat(gs) {
  const s = { g: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, r: 0, bb: 0, so: 0, sb: 0, hbp: 0 }
  for (const x of gs) { if (!x.played) continue; s.g++; for (const k of Object.keys(x.bat)) s[k] += x.bat[k] }
  const tb = s.h + s.d + 2 * s.t + 3 * s.hr
  s.avg = s.ab ? s.h / s.ab : null
  s.obp = s.ab + s.bb + s.hbp ? (s.h + s.bb + s.hbp) / (s.ab + s.bb + s.hbp) : null
  s.slg = s.ab ? tb / s.ab : null
  s.ops = s.obp != null && s.slg != null ? s.obp + s.slg : null
  return s
}
function sumPit(gs) {
  const s = { g: 0, gs: 0, outs: 0, h: 0, er: 0, bb: 0, so: 0, hr: 0, w: 0, l: 0, sv: 0, hld: 0 }
  for (const x of gs) {
    if (!x.played) continue
    s.g++; if (x.pit.gs) s.gs++
    s.outs += x.pit.outs; s.h += x.pit.h; s.er += x.pit.er; s.bb += x.pit.bb; s.so += x.pit.so; s.hr += x.pit.hr
    const d = String(x.pit.dec ?? '').toUpperCase(), R = x.raw
    if (R.w || d === 'W') s.w++; else if (R.l || d === 'L') s.l++
    if (R.sv || d === 'S' || d === 'SV') s.sv++; else if (R.hld || d === 'H' || d === 'HLD') s.hld++
  }
  s.ip = s.outs / 3
  s.era = s.outs ? (s.er * 27) / s.outs : null
  s.whip = s.outs ? ((s.h + s.bb) * 3) / s.outs : null
  return s
}
// the season's line as the sim totals it (falls back on the games added up)
// (the first of the sim's names that holds a number: a field can be a list somewhere, games are)
const nz = (...xs) => { for (const x of xs) if (x != null && typeof x !== 'object' && Number.isFinite(+x)) return +x; return null }
function seasonLine(r, pos, games) {
  // (the sim puts his line on the result itself; its `line` is the display copy, strings under 'G', 'W-L')
  const L = r.line && typeof r.line === 'object' && !('G' in r.line) && !('W-L' in r.line) ? r.line : r
  if (pos === 'pit') {
    const s = sumPit(games)
    const outs = nz(L.ipOuts, L.outs) ?? (L.ip != null ? outsOf(L.ip) : s.outs)
    const so = nz(L.so, L.k, L.ks, s.so)
    return {
      w: nz(L.w, L.pw, s.w), l: nz(L.l, L.pl, s.l), era: nz(L.era, s.era), g: nz(L.g, L.apps, s.g), gs: nz(L.gs, s.gs), outs,
      so, bb: nz(L.bb, s.bb), whip: nz(L.whip, s.whip), sv: nz(L.sv, L.saves, s.sv), fip: nz(L.fip), war: nz(L.war),
      h: nz(L.ha, L.h, s.h), er: nz(L.er, s.er), hr: nz(L.hra, L.hr, s.hr), k9: nz(L.k9) ?? (outs ? (so * 27) / outs : null), role: typeof (L.role ?? r.role) === 'string' ? (L.role ?? r.role) : null,
    }
  }
  const s = sumBat(games)
  return {
    g: nz(L.g, L.apps, s.g), pa: nz(L.pa, s.ab + s.bb + s.hbp), ab: nz(L.ab, s.ab), h: nz(L.h, L.hits, s.h), d: nz(L.d, L['2b'], L.doubles, s.d), t: nz(L.t, L['3b'], L.triples, s.t),
    hr: nz(L.hr, s.hr), rbi: nz(L.rbi, s.rbi), r: nz(L.r, L.runs, s.r), bb: nz(L.bb, s.bb), so: nz(L.so, L.k, s.so), sb: nz(L.sb, s.sb),
    avg: nz(L.avg, s.avg), obp: nz(L.obp, s.obp), slg: nz(L.slg, s.slg), ops: nz(L.ops, s.ops), opsPlus: nz(L.opsPlus, L.ops_plus), war: nz(L.war),
  }
}

// ── The postseason: a series (the sim's playoffRounds: { type: 'series', name 'AL Division Series', short
// 'ALDS', bestOf, opponent: { short }, won, wins, losses, games }; a bye: { type: 'bye' }) ──
const roundKey = s => {
  const t = String(s ?? '').toLowerCase()
  if (/world|^ws$/.test(t)) return 'ws'
  if (/champ|cs$/.test(t)) return 'lcs'
  if (/division|ds$/.test(t)) return 'ds'
  if (/wild|wc$/.test(t)) return 'wc'
  return null
}
const ROUND_BEST = { wc: 3, ds: 5, lcs: 7, ws: 7 }
function seriesOf(x, lg) {
  const key = roundKey(x.short ?? x.name)
  const opp = x.opponent?.short ?? (typeof x.opponent === 'string' ? x.opponent : null) ?? x.opp ?? null
  const w = num(x.wins), l = num(x.losses)
  const games = (x.games ?? []).map((g, i) => gameOf(g, i, 162))
  // (the LCS by the name a broadcast uses: the ALCS)
  const name = key === 'lcs' ? `${lg ?? ''}CS`.replace(/^CS$/, 'Championship Series') : x.name ?? 'Series'
  return { key, name, short: x.short ?? null, opp, w, l, won: x.won ?? w > l, best: x.bestOf ?? ROUND_BEST[key] ?? 7, games, raw: x }
}
const rowOf = (s, us) => ({ short: s.short, w: num(s.wins), l: num(s.losses), gb: s.gb ?? null, seed: s.seed ?? null, divRank: s.divRank ?? null, clinched: s.clinched ?? null, isUs: !!s.isUs || s.short === us })

// The result, in the shape this page draws (utils/baseballSimulation.js's contract is at the top of that file)
function view(r, pos) {
  const team = r.team ?? {}
  const meta = TEAM_MAP[team.short] ?? {}
  const lg = r.league ?? team.lg ?? team.league ?? meta.league ?? null
  const div = r.division ?? team.div ?? team.division ?? meta.division ?? null
  const all = (r.games ?? []).filter(g => g && typeof g === 'object' && !g.ps)
  const games = all.map((g, i) => gameOf(g, i, all.length))
  // the All-Star break: the games dated before it (undated: about 96 of 162)
  const dated = games.length && games.every(g => g.date)
  const breakAt = Number.isInteger(r.asbCut) ? r.asbCut : dated ? games.filter(g => beforeBreak(g.iso ?? g.date)).length : Math.round((BREAK_AFTER * games.length) / 162)
  const first = games.slice(0, breakAt), second = games.slice(breakAt)
  const rec = gs => `${gs.filter(g => g.won).length}-${gs.filter(g => !g.won).length}`
  // the division table, and the league's October field: the six seeds, then the first ones out
  const divRows = (r.divisions?.[lg]?.[div] ?? []).map(s => rowOf(s, team.short))
  const lgRows = (r.standings ?? []).map(s => rowOf(s, team.short))
  const field = lgRows.filter(s => s.seed).sort((a, b) => a.seed - b.seed).map(s => ({ ...s, div: s.seed <= 3 }))
  const out = (r.wildCardRace?.[lg] ?? []).map(s => rowOf(s, team.short)).filter(s => !s.seed)
  const made = !!r.madePlayoffs
  const seed = made ? (r.seed ?? field.find(s => s.isUs)?.seed ?? null) : null
  const di = divRows.findIndex(s => s.isUs)
  const divRank = r.divRank ?? (di >= 0 ? di + 1 : null)
  const divChamp = !!(r.divisionTitle ?? (made && divRank === 1))
  const rounds = (r.playoffRounds ?? []).filter(Boolean)
  const byeFirst = made && (rounds.some(x => x.type === 'bye') || !!r.hasBye)
  const series = rounds.filter(x => x.type !== 'bye').map(x => seriesOf(x, lg))
  const champ = !!r.champion
  const lastS = series[series.length - 1]
  const finish = champ ? 'WORLD SERIES CHAMPIONS'
    : !made ? (divRank ? `${ordinal(divRank)} IN THE ${lg ?? ''} ${div ?? ''}`.toUpperCase().replace(/\s+/g, ' ').trim() : 'NO OCTOBER')
    : lastS ? (lastS.key === 'ws' ? 'LOST THE WORLD SERIES' : `OUT IN THE ${lastS.name.toUpperCase()}`) : 'POSTSEASON'
  const line = seasonLine(r, pos, games)
  return { team, meta, lg, div, games, first, second, breakAt, rec, divRows, field, out, seed, divRank, made, divChamp, series, byeFirst, champ, finish, bracket: r.bracket ?? null, line, wins: r.wins ?? games.filter(g => g.won).length, losses: r.losses ?? games.filter(g => !g.won).length }
}

// ─── Pieces ──────────────────────────────────────────────────────────────────
function Logo({ short, size = 22, className = '' }) {
  const [bad, setBad] = useState(false)
  if (!short) return null
  if (bad) return <span className={`bbs-logo bbs-logo--txt ${className}`} style={{ width: size, height: size }}>{String(short).slice(0, 3)}</span>
  return <img className={`bbs-logo ${className}`} src={`${LOGO}${short}.png`} alt="" width={size} height={size} loading="lazy" decoding="async" onError={() => setBad(true)} />
}
// a section's header: the label block and a hairline
const Hd = ({ children, sub }) => <div className="bbs-hd"><h2>{children}</h2>{sub && <small>{sub}</small>}<i aria-hidden="true" /></div>
// a line as stat boxes
function Stats({ items }) {
  const list = items.filter(Boolean)
  return (
    <div className="bbs-stats" style={{ '--n': list.length }}>
      {list.map(([v, k, big]) => <div key={k} className={big ? 'is-big' : undefined}><b>{v}</b><small>{k}</small></div>)}
    </div>
  )
}
const batItems = (s, full = false) => [
  [rate3(s.avg), 'AVG', true], [s.hr ?? 0, 'HR', true], [s.rbi ?? 0, 'RBI', true], [rate3(s.ops), 'OPS'],
  full && [rate3(s.obp), 'OBP'], full && [rate3(s.slg), 'SLG'], [s.h ?? 0, 'H'], full && [s.d ?? 0, '2B'], full && [s.r ?? 0, 'R'],
  [s.bb ?? 0, 'BB'], full && [s.so ?? 0, 'K'], [s.sb ?? 0, 'SB'], full && s.opsPlus != null && [Math.round(s.opsPlus), 'OPS+'], full && s.war != null && [f1(s.war), 'WAR'],
]
const pitItems = (s, full = false) => [
  [`${s.w ?? 0}-${s.l ?? 0}`, 'W-L', true], [f2(s.era), 'ERA', true], [s.so ?? 0, 'K', true], [ipOf(s.outs ?? 0), 'IP'],
  [f2(s.whip), 'WHIP'], full && [s.bb ?? 0, 'BB'], (full || s.sv > 0) && [s.sv ?? 0, 'SV'], full && [s.g ?? 0, s.gs ? `G · ${s.gs} GS` : 'G'],
  full && s.fip != null && [f2(s.fip), 'FIP'], full && s.war != null && [f1(s.war), 'WAR'],
]
// his line in one game, the way a box score reads it
function gameLine(g, pos) {
  // (a pitcher's day off isn't a DNP)
  if (!g.played) return <small className="bbs-dnp">{pos === 'pit' ? '—' : 'DNP'}</small>
  if (pos === 'pit') {
    const p = g.pit
    if (!p.outs && !p.dec) return <small className="bbs-dnp">—</small>
    const dec = String(p.dec ?? '').toUpperCase()
    return <>{ipOf(p.outs)} IP, {p.er} ER, {p.so} K{dec ? <em className={`bbs-dec is-${dec.toLowerCase()}`}>{dec === 'SV' ? 'S' : dec}</em> : null}</>
  }
  const b = g.bat
  const bits = [`${b.h}-${b.ab}`, b.hr ? (b.hr > 1 ? `${b.hr} HR` : 'HR') : null, b.d ? (b.d > 1 ? `${b.d} 2B` : '2B') : null, b.t ? '3B' : null, b.rbi ? `${b.rbi} RBI` : null, b.bb ? (b.bb > 1 ? `${b.bb} BB` : 'BB') : null, b.sb ? (b.sb > 1 ? `${b.sb} SB` : 'SB') : null]
  return <>{bits.filter(Boolean).join(', ')}</>
}
function GameRow({ g, pos, post = null }) {
  return (
    <li className={`bbs-g ${g.won ? 'is-w' : 'is-l'}`}>
      <span className="bbs-g-n">{post ?? (g.iso ? `${+g.iso.slice(5, 7)}/${+g.iso.slice(8, 10)}` : g.date ?? g.i + 1)}</span>
      <span className="bbs-g-ha">{g.home === false ? '@' : 'vs'}</span>
      <span className="bbs-g-opp"><Logo short={g.opp} size={16} /><span>{g.opp ?? '—'}</span></span>
      <span className="bbs-g-res"><i>{g.won ? 'W' : 'L'}</i>{g.rs}-{g.ra}{g.extra ? <small> ({g.extra})</small> : null}</span>
      <span className="bbs-g-line">{gameLine(g, pos)}</span>
    </li>
  )
}
// a month: the club's record, his line, and the games under a tap
function Month({ m, games, pos, open: open0 = false }) {
  const [open, setOpen] = useState(open0)
  if (!games.length) return null
  const won = games.filter(g => g.won).length
  const s = pos === 'pit' ? sumPit(games) : sumBat(games)
  const line = pos === 'pit'
    ? (s.g ? `${s.w}-${s.l}, ${f2(s.era)} ERA, ${ipOf(s.outs)} IP, ${s.so} K${s.sv ? `, ${s.sv} SV` : ''}` : 'Did not pitch')
    : (s.g ? `${rate3(s.avg)}, ${s.hr} HR, ${s.rbi} RBI, ${rate3(s.ops)} OPS` : 'Did not play')
  return (
    <div className={`bbs-month${open ? ' is-open' : ''}`}>
      <button className="bbs-month-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <b>{MONTHS[m]}</b>
        <span className="bbs-month-rec">{won}-{games.length - won}</span>
        <span className="bbs-month-line">{line}</span>
        <i className="bbs-month-chev" aria-hidden="true" />
      </button>
      {open && <ol className="bbs-log">{(pos === 'pit' ? games.filter(g => g.played) : games).map(g => <GameRow key={g.i} g={g} pos={pos} />)}</ol>}
    </div>
  )
}
function Months({ games, pos }) {
  const by = useMemo(() => { const out = MONTHS.map(() => []); games.forEach(g => out[g.month].push(g)); return out }, [games])
  return <div className="bbs-months">{by.map((gs, m) => <Month key={m} m={m} games={gs} pos={pos} />)}</div>
}
// the division: W, L, PCT, GB, the club lit
function Standings({ rows, lg, div }) {
  if (!rows.length) return null
  return (
    <table className="bbs-table">
      <thead><tr><th className="bbs-c-team">{`${lg ?? ''} ${div ?? ''}`.trim() || 'Team'}</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead>
      <tbody>
        {rows.map(s => (
          <tr key={s.short} className={s.isUs ? 'is-us' : undefined}>
            <td className="bbs-c-team"><Logo short={s.short} size={18} /><span>{teamName(s.short)}</span></td>
            <td>{s.w}</td><td>{s.l}</td><td>{rate3(s.w + s.l ? s.w / (s.w + s.l) : 0)}</td><td>{s.gb ? (s.gb % 1 ? s.gb.toFixed(1) : s.gb) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
// the league's October field: the six seeds (three division winners, three wild cards) and the first ones out
function Field({ field, out, lg }) {
  if (!field.length) return null
  return (
    <ol className="bbs-field">
      {field.map(s => (
        <li key={s.short} className={s.isUs ? 'is-us' : undefined}>
          <span className="bbs-field-seed">{s.seed}</span><Logo short={s.short} size={18} />
          <span className="bbs-field-name">{teamName(s.short)}</span>
          <span className="bbs-field-tag">{s.seed <= 2 ? 'BYE' : s.div ? 'DIV' : 'WC'}</span>
          <span className="bbs-field-rec">{s.w}-{s.l}</span>
        </li>
      ))}
      {out.slice(0, 2).map(s => (
        <li key={s.short} className="is-out">
          <span className="bbs-field-seed">–</span><Logo short={s.short} size={18} />
          <span className="bbs-field-name">{teamName(s.short)}</span><span className="bbs-field-tag">OUT</span><span className="bbs-field-rec">{s.w}-{s.l}</span>
        </li>
      ))}
      {lg && <li className="bbs-field-note">The top two {lg} seeds have a bye to the Division Series</li>}
    </ol>
  )
}
// a series: the matchup, the result, the games
function Series({ s, us, pos, userName }) {
  const line = pos === 'pit' ? sumPit(s.games) : sumBat(s.games)
  const lineTxt = pos === 'pit'
    ? (line.g ? `${userName}: ${ipOf(line.outs)} IP, ${line.er} ER, ${line.so} K${line.w ? `, ${line.w} W` : ''}${line.sv ? `, ${line.sv} SV` : ''}` : null)
    : (line.g ? `${userName}: ${line.h}-for-${line.ab}${line.hr ? `, ${line.hr} HR` : ''}${line.rbi ? `, ${line.rbi} RBI` : ''}` : null)
  const swept = s.won ? s.l === 0 : s.w === 0
  return (
    <div className={`bbs-series${s.won ? ' is-won' : ' is-lost'}`}>
      <div className="bbs-series-head">
        <span className="bbs-series-teams"><Logo short={us} size={30} /><b>{s.w}</b><em>–</em><b>{s.l}</b><Logo short={s.opp} size={30} /></span>
        <span className="bbs-series-res">{s.won ? (swept ? `SWEPT THE ${nickName(s.opp).toUpperCase()}` : `BEAT THE ${nickName(s.opp).toUpperCase()}`) : (swept ? `SWEPT BY THE ${nickName(s.opp).toUpperCase()}` : `LOST TO THE ${nickName(s.opp).toUpperCase()}`)}<small>Best of {s.best}</small></span>
      </div>
      {s.games.length > 0 && <ol className="bbs-log is-post">{s.games.map((g, i) => <GameRow key={i} g={g} pos={pos} post={`G${i + 1}`} />)}</ol>}
      {lineTxt && <p className="bbs-note">{lineTxt}</p>}
    </div>
  )
}
// the bracket: each league's side, the series scores, the World Series
// upto: the round (0 the Wild Card Series … 3 the World Series) he's in: the rounds before it are played out, its
// matchups show without scores, the ones after are still to come
function Bracket({ bracket, us, upto = 99 }) {
  if (!bracket) return null
  // a series as the sim keeps it: { hi, lo, hiSeed, loSeed, wins: [hi, lo], winner }
  const cell = (m, k, ri) => {
    if (!m) return null
    if (ri > upto) return <div key={k} className="bbs-br-m is-tbd"><span className="bbs-br-t"><em>TBD</em><b /></span><span className="bbs-br-t"><em>TBD</em><b /></span></div>
    const known = ri < upto
    const rows = [[m.hi, m.hiSeed, m.wins?.[0]], [m.lo, m.loSeed, m.wins?.[1]]]
    return (
      <div key={k} className={`bbs-br-m${m.hi === us || m.lo === us ? ' is-us' : ''}`}>
        {rows.map(([t, sd, w], j) => <span key={j} className={`bbs-br-t${known && m.winner === t ? ' is-w' : ''}`}><Logo short={t} size={14} /><em>{sd ? <small className="bbs-br-seed">{sd}</small> : null}{t}</em><b>{known ? w ?? '' : ''}</b></span>)}
      </div>
    )
  }
  const cols = lg => {
    const b = bracket[lg]
    return b ? [['WILD CARD', (b.wc ?? []).filter(Boolean), 0], ['DIVISION', (b.ds ?? []).filter(Boolean), 1], [`${lg}CS`, b.cs ? [b.cs] : [], 2]] : []
  }
  return (
    <div className="bbs-bracket">
      {['AL', 'NL'].map(lg => (
        <div key={lg} className="bbs-br-lg">
          <span className="bbs-br-lgname">{lg === 'AL' ? 'AMERICAN LEAGUE' : 'NATIONAL LEAGUE'}</span>
          <div className="bbs-br-cols">
            {cols(lg).map(([name, list, ri]) => (
              <div key={name} className="bbs-br-col"><span className="bbs-br-rnd">{name}</span><div className="bbs-br-list">{list.map((m, i) => cell(m, i, ri))}</div></div>
            ))}
          </div>
        </div>
      ))}
      {bracket.ws && <div className="bbs-br-ws"><span className="bbs-br-rnd">WORLD SERIES</span>{cell(bracket.ws, 'ws', 3)}</div>}
    </div>
  )
}
// an award's race: the top of the ballot (the sim's `top` entries), the build lit and named by the username
// (the stat the race is decided on sits on the right, so the line leaves it out)
const entryLine = (e, unit) => (e.kind === 'pit' || e.era != null && e.avg == null
  ? [e.w != null && `${e.w}-${e.l ?? 0}`, unit !== 'era' && e.era != null && `${f2(e.era)} ERA`, unit !== 'k' && e.k != null && `${e.k} K`, unit !== 'sv' && e.sv > 0 && `${e.sv} SV`].filter(Boolean).join(', ')
  : [unit !== 'avg' && e.avg != null && rate3(e.avg), unit !== 'hr' && e.hr != null && `${e.hr} HR`, unit !== 'rbi' && e.rbi != null && `${e.rbi} RBI`].filter(Boolean).join(', '))
function Race({ list = [], userName, unit = 'war', n = 5 }) {
  if (!list?.length) return null
  const fmt = v => (v == null ? null : unit === 'avg' || unit === 'ops' ? rate3(v) : unit === 'era' ? f2(v) : unit === 'war' ? `${f1(v)} WAR` : v)
  return (
    <ol className="bbs-race">
      {list.slice(0, n).map((e, i) => (
        <li key={i} className={e.isPlayer ? 'is-us' : undefined}>
          <span className="bbs-race-rk">{e.rank ?? i + 1}</span>
          <Logo short={e.team} size={18} />
          <span className="bbs-race-name">{e.isPlayer ? userName : e.name ?? '–'}</span>
          <small className="bbs-race-line">{entryLine(e, unit)}</small>
          {fmt(e[unit]) != null && <b className="bbs-race-n">{fmt(e[unit])}</b>}
        </li>
      ))}
    </ol>
  )
}
// (the sim's awards object first: its top-level mvp / cyYoung / allStar are plain true / false)
const awardOf = (r, key) => r.awards?.[key] ?? (typeof r[key] === 'object' ? r[key] : null)
const wonIt = a => a === true || a?.won === true || a?.selected === true
function Award({ title, a, userName, unit = 'war', n = 5, note = null, ballot = false, me = null }) {
  if (!a || a.eligible === false) return null
  const won = wonIt(a)
  const by = a.winner ? ` · WON BY ${String(a.winner.isPlayer ? userName : a.winner.name ?? a.winner).toUpperCase()}` : ''
  // (a vote: the writers' ballot only reaches so far down; a leaders table counts everyone)
  const place = a.rank ? (ballot && a.rank > 15 ? 'NO VOTES' : ordinal(a.rank).toUpperCase()) : null
  const tag = won ? (a.unanimous ? 'UNANIMOUS' : 'WINNER') : place ? `${place}${by}` : by ? by.slice(3) : null
  const list = a.race ?? a.top ?? a.ballot ?? []
  const shown = list.slice(0, n)
  const mine = !won && me && a.rank > n && !shown.some(e => e.isPlayer) ? [{ ...me, isPlayer: true, rank: ballot && a.rank > 15 ? '–' : a.rank }] : []
  return (
    <div className={`bbs-award${won ? ' is-won' : ''}`}>
      <div className="bbs-award-head"><b>{title}</b>{tag && <span className="bbs-award-tag">{tag}</span>}</div>
      <Race list={[...shown, ...mine]} userName={userName} unit={unit} n={n + 1} />
      {note && <p className="bbs-note">{note}</p>}
    </div>
  )
}

// ─── The team spin (Simulate Season): the club he plays the season for ───────
const ITEM_H = 44, CENTER = 2, COPIES = 8
function TeamReel({ items, spinning, onStop }) {
  const [pos, setPos] = useState(0)
  const [anim, setAnim] = useState(false)
  const stopRef = useRef(onStop); stopRef.current = onStop
  useEffect(() => {
    if (!spinning || !items.length) return
    const w = Math.floor(Math.random() * items.length)
    setAnim(true); setPos((COPIES - 2) * items.length + w)
    const t = setTimeout(() => { stopRef.current?.(items[w]) }, 1750)
    return () => clearTimeout(t)
  }, [spinning]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => Array.from({ length: COPIES }, () => items).flat(), [items])
  return (
    <div className={`reel-outer${spinning ? ' reel-spinning' : ''}`}>
      <div className="reel-label">TEAM</div>
      <div className="reel-window">
        <div className="reel-selector" />
        <div className="reel-track" style={{ transform: `translate3d(0,${-(pos - CENTER) * ITEM_H}px,0)`, transition: anim ? 'transform 1.6s cubic-bezier(.12,.8,.22,1)' : 'none' }}>
          {rows.map((t, i) => (
            <div key={i} className="reel-row bbs-reel-row" style={{ height: ITEM_H }}>
              <Logo short={t.short} size={26} />
              <span className="bbs-reel-txt"><span className="reel-primary">{t.short}</span><span className="reel-secondary">{t.name}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
// Normal builds spin the clubs in the build; Sandbox (or anyTeam) any of the 30. Pick lists them.
export function BaseballTeamSpin({ isCustomMode, onTeamSelected, build = {}, anyTeam = false, eyebrow = null }) {
  const tapGuard = useTapGuard()
  const [phase, setPhase] = useState('idle')
  const [result, setResult] = useState(null)
  const [mode, setMode] = useState(isCustomMode ? 'pick' : 'spin')
  const [search, setSearch] = useState('')
  const inBuild = useMemo(() => [...new Set(Object.values(build).filter(Boolean).map(c => c.team))].map(s => TEAM_MAP[s]).filter(Boolean), [build])
  const pickPool = isCustomMode || anyTeam || !inBuild.length ? MLB_TEAMS : inBuild
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
        <div className="tpm-eyebrow">{eyebrow ?? 'Simulate Season'}</div>
        <div className="tpm-heading">{mode === 'pick' ? 'Pick a Team' : 'Spin a Team'}</div>
        <div className="tpm-mode-tabs">
          <button className={`tpm-tab${mode === 'spin' ? ' tpm-tab-active' : ''}`} onClick={() => { setMode('spin'); setResult(null); setSearch(''); setPhase('idle') }}>Spin</button>
          <button className={`tpm-tab${mode === 'pick' ? ' tpm-tab-active' : ''}`} onClick={() => { setMode('pick'); setResult(null); setPhase('idle') }}>Pick</button>
        </div>
        {mode === 'spin' ? (
          <>
            <div className="reels-wrap tpm-reels">
              <div className="reel-tri reel-tri-l" />
              <div className="reels-row"><TeamReel items={items} spinning={phase === 'spinning'} onStop={done} /></div>
              <div className="reel-tri reel-tri-r" />
            </div>
            <button className="spin-btn" onClick={() => { if (phase === 'idle') setPhase('spinning') }} disabled={phase !== 'idle'}>SPIN</button>
          </>
        ) : (
          <div className="tpm-pick-wrap">
            {result ? (
              <div className="tpm-result" style={{ '--tpm-color': result.color }}>
                <div className="tpm-result-bg" />
                <Logo short={result.short} size={96} className="tpm-result-logo" />
                <div className="tpm-result-name">{result.name}</div>
                <div className="tpm-result-abbr">{result.short}</div>
              </div>
            ) : (
              <>
                <div className="tpm-subheading">{pickPool === MLB_TEAMS ? 'Every club' : 'From the build'}</div>
                <input className="tpm-pick-search" placeholder="Search teams…" value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" />
                <div className="tpm-team-grid">
                  {shown.map(t => (
                    <button key={t.short} className="tpm-team-btn" style={{ '--t-color': t.color }} onClick={() => done(t)}>
                      <Logo short={t.short} size={40} className="tpm-team-logo" />
                      <span className="tpm-team-abbr">{t.short}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


// ─── Screens ─────────────────────────────────────────────────────────────────
// (basketball's order and buttons: the build · the regular season · the postseason · awards night · the final report)
function BuildList({ build, types, rows = 99 }) {
  return (
    <ol className="bbs-build">
      {types.filter(t => build[t]).map((t, i) => (
        <li key={t} className={i < rows ? 'is-in' : 'is-wait'}>
          <QBAvatar photo={build[t].photo} team={build[t].team} color={build[t].teamColor} size={34} logoDir={LOGO} faceCenter={build[t].faceCenter} />
          <span className="bbs-build-txt"><b>{MLB_ATTR[t]?.label ?? t}</b><small>{build[t].qbFull}{build[t].role ? ` · ${build[t].role}` : ''}</small></span>
          <span className="bbs-grade" style={{ background: GRADE_COL(build[t].val) }}>{valToGrade(build[t].val)}</span>
        </li>
      ))}
    </ol>
  )
}
function ScreenBuild({ r, build, types, arch, onNext }) {
  const ovr = useCountUp(r?.ovr ?? 0, { ms: 900 })
  const n = types.filter(t => build[t]).length
  const rows = useStaged(true, Array.from({ length: n }, (_, i) => 500 + i * 80))
  return (
    <div className="simp-screen bbs-screen">
      <div className="simp-ovr-hero"><div className="simp-ovr-num">{ovr || '–'}</div><div className="simp-ovr-lbl">OVR</div></div>
      <div className="simp-archetype">{arch}</div>
      <button className="simp-cta" onClick={() => { sfx('tap'); onNext() }}>Simulate Season</button>
      <section className="bbs-sec">
        <Hd sub={`${r.ovr} OVR`}>THE BUILD</Hd>
        <BuildList build={build} types={types} rows={rows} />
      </section>
    </div>
  )
}

// his line in one game, in words (the scoreboard's last line, a headline)
function lineText(g, pos) {
  if (!g.played) return null
  if (pos === 'pit') {
    const p = g.pit
    if (!p.outs && !p.dec) return null
    const dec = String(p.dec ?? '').toUpperCase()
    return `${ipWords(p.outs)} IP, ${p.er} ER, ${p.so} K${dec === 'W' ? ', the win' : dec === 'L' ? ', the loss' : dec === 'SV' || dec === 'S' ? ', the save' : ''}`
  }
  const b = g.bat
  return [`${b.h}-for-${b.ab}`, b.hr ? (b.hr > 1 ? `${b.hr} HR` : 'a homer') : null, b.d ? (b.d > 1 ? `${b.d} doubles` : 'a double') : null, b.t ? 'a triple' : null, b.rbi ? `${b.rbi} RBI` : null, b.sb ? `${b.sb > 1 ? `${b.sb} steals` : 'a steal'}` : null].filter(Boolean).join(', ')
}
const bigDay = (g, pos) => (pos === 'pit'
  ? g.played && g.pit.gs && (g.pit.so >= 10 || (g.pit.outs >= 27 && g.pit.er === 0))
  : g.played && (g.bat.hr >= 2 || g.bat.h >= 4 || g.bat.rbi >= 5))
// the wire: what the papers say as the games come in (the latest one shows)
function wireOf(v, n, { userName, pos, asgIn }) {
  const out = []
  const nick = nickName(v.team.short)
  let run = 0, skid = 0
  for (let i = 0; i < n; i++) {
    const g = v.games[i]
    run = g.won ? run + 1 : 0
    skid = g.won ? 0 : skid + 1
    const opp = nickName(g.opp)
    if (bigDay(g, pos)) out.push(`${userName} vs the ${opp}: ${lineText(g, pos)}`)
    else if (g.walkoff) out.push(`Walk-off: the ${nick} beat the ${opp} in their last at-bat`)
    else if (run >= 5 && run % 2 === 1) out.push(`The ${nick} have won ${run} straight`)
    else if (skid >= 5 && skid % 2 === 1) out.push(`The ${nick} have dropped ${skid} in a row`)
    if (i + 1 === v.breakAt && v.breakAt > 0) out.push(asgIn ? `All-Star: ${userName} is going to the Midsummer Classic` : `The break: the ${nick} at ${v.rec(v.first)}`)
    const nx = v.games[i + 1]
    if (nx && nx.month !== g.month) { const gs = v.games.slice(0, i + 1).filter(x => x.month === g.month); out.push(`${MONTHS[g.month].replace('MARCH/APRIL', 'April').toLowerCase().replace(/^./, c => c.toUpperCase())} in the books: the ${nick} ${gs.filter(x => x.won).length}-${gs.filter(x => !x.won).length}`) }
  }
  if (n >= v.games.length && v.games.length) out.push(v.made ? (v.divChamp ? `The ${nick} win the ${`${v.lg ?? ''} ${v.div ?? ''}`.trim()}` : `The ${nick} are going to October`) : `The ${nick} are out of the race`)
  return out
}

// dr: the season director's reveal (the moments on: SeasonMoments.jsx), else the season plays straight from the result
function ScreenSeason({ r, v, pos, onNext, onDone, userName, adsDisabled, seen, dr = null, M = null }) {
  const isPit = pos === 'pit'
  const P = BASEBALL_POS[pos] ?? BASEBALL_POS.bat
  const total = dr ? dr.total : v.games.length
  // basketball's pace: the 162 games in about six seconds
  const sr = useSeasonReveal(total, { pace: Math.max(20, Math.round(5600 / Math.max(1, total))), instant: seen || !!dr })
  const rv = dr ? { n: dr.k, phase: dr.done ? 'done' : dr.k === 0 ? 'loading' : 'playing', done: dr.done } : sr
  // (the director's games, read the way the page reads a game)
  const dg = useMemo(() => (dr ? dr.games.map((g, i) => gameOf(g, i, total)) : null), [dr?.k, dr?.done]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (rv.done) onDone?.() }, [rv.done]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (rv.done && !adsDisabled) rampAdd([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-square' }]) }, [rv.done]) // eslint-disable-line react-hooks/exhaustive-deps
  const k = useStaged(rv.done, [2700, 3050, 3700, 4300, 4900], seen)
  const shown = dr ? dg : v.games.slice(0, rv.n)
  const W = shown.filter(g => g.won).length
  const asg = awardOf(r, 'allStar')
  const asgIn = wonIt(asg)
  const wireOwn = useMemo(() => (dr ? [] : wireOf(v, rv.n, { userName, pos, asgIn })), [v, rv.n, !!dr]) // eslint-disable-line react-hooks/exhaustive-deps
  const wire = dr ? dr.headlines.filter(h => h.at <= dr.k).map(h => h.text) : wireOwn
  const month = shown.length ? MONTHS[shown[shown.length - 1].month] : 'OPENING DAY'
  const firstHalf = dr ? shown.slice(0, v.breakAt) : v.first
  const firstLine = isPit ? sumPit(firstHalf) : sumBat(firstHalf)
  // (the All-Star rosters come out at the break; with the moments on, the vote is the booked season's, so it shows at the end)
  const asgShow = v.breakAt > 0 && rv.n >= v.breakAt && (!dr || dr.done)
  const lgDiv = `${v.lg ?? ''} ${v.div ?? ''}`.trim()
  const me = { team: v.team.short, kind: isPit ? 'pit' : 'bat', ...v.line, k: v.line.so }
  const titles = isPit
    ? [['ERA TITLE', 'eraTitle', 'era', 5], ['STRIKEOUT LEADERS', 'kLeader', 'k', 5], v.line.role === 'CL' || v.line.role === 'RP' ? ['SAVES LEADERS', 'svLeader', 'sv', 3] : ['WINS LEADERS', 'winsLeader', 'w', 3]]
    : [['BATTING TITLE', 'battingTitle', 'avg', 5], ['HOME RUN LEADERS', 'hrLeader', 'hr', 5], ['RBI LEADERS', 'rbiLeader', 'rbi', 3]]
  const lineNow = rv.done ? v.line : (isPit ? sumPit(shown) : sumBat(shown))
  return (
    <div className="simp-screen bbs-screen">
      {rv.phase === 'loading' && <SimLoading />}
      {rv.phase !== 'loading' && (
        <>
          <div className="simp-eyebrow">Regular Season</div>
          <div className="simp-live-record"><span className="slr-w">{W}</span><span className="slr-sep">–</span><span className="slr-l">{shown.length - W}</span></div>
          <div className="bbs-live-sub">{rv.done ? `${total} GAMES · ${v.made ? (v.divChamp ? `${lgDiv} CHAMPIONS` : 'A WILD CARD') : `${ordinal(v.divRank ?? 0)} IN THE ${lgDiv}`}`.toUpperCase() : `${month} · ${total - shown.length} games left`}</div>
          <Pulse games={shown} total={total} playoffWins={Math.round((87 * total) / 162)} />
          <WireLine items={wire} />
          {dr && M && <M.MomentsLayer dr={dr} userName={userName} />}
          <div className="bsim-season-dots bbs-dots">{shown.map((g, i) => <span key={i} className={`bsim-sdot bsim-sdot--${g.won ? 'w' : 'l'}`} />)}</div>
          {/* the All-Star break, as the season passes it */}
          {asgShow && (
            <section className="bbs-sec ag-pop">
              <Hd sub={`JULY 14 · ${v.lg ?? 'MLB'}`}>THE ALL-STAR BREAK</Hd>
              <div className={`bbs-asg${asgIn ? ' is-in' : ''}`}>
                <b>{asgIn ? `${userName.toUpperCase()} IS AN ALL-STAR` : 'NOT AN ALL-STAR THIS YEAR'}</b>
                <span>{asgIn ? (asg?.starter ? `Voted in to start for the ${v.lg ?? ''} at ${asg.slot ?? P.word}` : `Named to the ${v.lg ?? ''} roster${asg?.slot ? ` at ${asg.slot}` : ''}`) : `Left off the ${v.lg ?? ''} roster`.replace('  ', ' ')}</span>
              </div>
              <p className="bbs-note">
                {isPit
                  ? (firstLine.g ? `First half: ${firstLine.w}-${firstLine.l}, ${f2(firstLine.era)} ERA, ${firstLine.so} strikeouts in ${ipWords(firstLine.outs)} innings${firstLine.sv ? `, ${firstLine.sv} saves` : ''}.` : null)
                  : (firstLine.g ? `First half: ${rate3(firstLine.avg)} with ${firstLine.hr} home runs and ${firstLine.rbi} RBI.` : null)}
                {' '}{v.team.name ?? teamName(v.team.short)} {v.rec(firstHalf)} at the break.
              </p>
            </section>
          )}
          {rv.done && (
            <div className="bbs-body">
              <section className="bbs-sec">
                <Hd sub={v.made ? (v.divChamp ? 'DIVISION CHAMPIONS' : 'A WILD CARD') : `${ordinal(v.divRank ?? 0).toUpperCase()} PLACE`}>{lgDiv ? lgDiv.toUpperCase() : 'THE DIVISION'}</Hd>
                <Standings rows={v.divRows} lg={v.lg} div={v.div} />
              </section>
              {v.field.length > 0 && (
                <section className="bbs-sec">
                  <Hd sub="SIX TEAMS IN">{`${v.lg ?? ''} POSTSEASON FIELD`.trim()}</Hd>
                  <Field field={v.field} out={v.out} lg={v.lg} />
                </section>
              )}
              {!adsDisabled && <div id="ramp-cntr1-square" className="simp-season-ad" />}
              <section className="bbs-sec">
                <Hd sub={`${userName} · THE REGULAR SEASON`}>{isPit ? 'PITCHING LINE' : 'SLASH LINE'}</Hd>
                {!isPit && <p className="bbs-slash"><b>{rate3(lineNow.avg)}</b><i>/</i><b>{rate3(lineNow.obp)}</b><i>/</i><b>{rate3(lineNow.slg)}</b><small>AVG / OBP / SLG</small></p>}
                <Stats items={isPit ? pitItems(lineNow, true) : batItems(lineNow, true)} />
              </section>
              <section className="bbs-sec">
                <Hd sub={`${v.wins}-${v.losses}`}>MONTH BY MONTH</Hd>
                <Months games={v.games} pos={pos} />
              </section>
              <section className="bbs-sec">
                <div className="sawd-title">League Leaders</div>
                {k === 0 && <div className="sawd-tallying"><div className="sawd-tally-dots"><span className="sawd-dot" /><span className="sawd-dot" /><span className="sawd-dot" /></div><div className="sawd-tally-lbl">The final numbers…</div></div>}
                {titles.map(([title, key, unit, n], i) => k >= i + 2 && (
                  <div key={key} className="ag-pop"><Award title={title} a={awardOf(r, key)} userName={userName} unit={unit} n={n} me={me} /></div>
                ))}
              </section>
              {k >= 5 && <button className="simp-cta simp-cta-in simp-cta--pin" onClick={() => { sfx('tap'); onNext() }}>{v.made ? 'Enter the Postseason' : 'The Postseason'}</button>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── The postseason: every game live, an inning at a time ─────────────────────
// A ballgame's line score from its final: the runs in bunches, the home side skipping the bottom of the ninth
// when it's ahead, a walk-off ending in the home half, extras tied after nine.
function lineScore(g) {
  const n = Math.max(9, g.extra ?? g.raw?.innings ?? 9)
  const homeMe = g.home !== false
  const H = homeMe ? g.rs : g.ra, A = homeMe ? g.ra : g.rs
  const top = Array(n).fill(0), bot = Array(n).fill(0)   // top: the visitors, bottom: the home side
  const spread = (arr, runs, upto) => { let left = runs; while (left > 0) { const c = Math.min(left, Math.random() < 0.35 ? 2 + Math.floor(Math.random() * 2) : 1); arr[Math.floor(Math.random() * upto)] += c; left -= c } }
  let lastBot = true
  if (H > A) {
    if (n > 9) { const aL = Math.min(A, Math.random() < 0.6 ? 1 : 0), T = A - aL; top[n - 1] = aL; bot[n - 1] = H - T; spread(top, T, 9); spread(bot, T, 9) }
    else if (homeMe ? g.walkoff : g.walkedOff) { const pre = Math.min(A, H - 1); bot[8] = H - pre; spread(bot, pre, 8); spread(top, A, 9) }
    else { lastBot = false; spread(bot, H, 8); spread(top, A, 9) }
  } else if (n > 9) { const hL = Math.min(H, Math.random() < 0.3 ? 1 : 0), T = H - hL; bot[n - 1] = hL; top[n - 1] = A - T; spread(top, T, 9); spread(bot, T, 9) }
  else { spread(top, A, 9); spread(bot, H, 9) }
  return { n, top, bot, lastBot, homeMe }
}
function GameLive({ g, label, us, pos, userName, speed, paused, onDone }) {
  const [ls] = useState(() => lineScore(g))
  const halves = ls.n * 2 - (ls.lastBot ? 0 : 1)
  const nickUs = nickName(us), nickOpp = nickName(g.opp)
  const [events] = useState(() => {
    const ev = []
    for (let i = 0; i < ls.n; i++) {
      for (const [h, arr] of [[0, ls.top], [1, ls.bot]]) {
        const runs = arr[i]
        if (!runs) continue
        const mine = (h === 1) === ls.homeMe
        const last = i === ls.n - 1 && h === 1 && runs > 0 && (mine ? g.won : !g.won) && ls.lastBot
        const who = mine ? nickUs : nickOpp
        ev.push({ t: ((i * 2 + h + 0.8) / halves) * 0.97, side: mine ? 'me' : 'opp', pts: runs, text: last ? `Walk-off in the ${ordinal(i + 1)}: the ${who} win it` : `${who} ${runs === 1 ? 'score a run' : `score ${runs}`} in the ${h ? 'bottom' : 'top'} of the ${ordinal(i + 1)}` })
      }
    }
    return ev
  })
  const gm = useLiveGame({ events, myFinal: g.rs, oppFinal: g.ra, speed, paused, onDone })
  const hi = Math.min(halves - 1, Math.floor(gm.t * halves))
  const inn = Math.floor(hi / 2)
  const mine = { short: us, color: readable(TEAM_MAP[us]?.color, TEAM_MAP[us]?.color2), logo: <Logo short={us} size={56} className="plf-team-logo-img" />, score: gm.my }
  const them = { short: g.opp, color: readable(TEAM_MAP[g.opp]?.color, TEAM_MAP[g.opp]?.color2, '#a1a1aa'), logo: <Logo short={g.opp} size={56} className="plf-team-logo-img" />, score: gm.opp }
  const [away, home] = ls.homeMe ? [them, mine] : [mine, them]
  const line = lineText(g, pos)
  return (
    <LiveBoard
      label={label} away={away} home={home} phase={gm.phase} badge={g.won ? 'W' : 'L'} badgeWin={g.won}
      status={(
        <div className="plf-status-row">
          <div className="plf-qtr-dots">{Array.from({ length: Math.min(ls.n, 12) }, (_, i) => <div key={i} className={`plf-qtr-dot${i < inn ? ' plf-qd-done' : i === inn ? ' plf-qd-active' : ''}`} />)}</div>
          <div className="plf-clock-box"><span className="plf-qtr-lbl">{hi % 2 ? 'BOT' : 'TOP'}</span><span className="plf-clk-sep">·</span><span className="plf-clock-time">{ordinal(inn + 1).toUpperCase()}</span></div>
        </div>
      )}
      progress={gm.t}
      evt={gm.phase === 'post' ? (line ? `${userName}: ${line}` : pos === 'pit' ? `${userName} did not pitch` : `${userName} did not play`) : gm.last?.text ?? null}
      post={g.won ? '✓ Won' : '✗ Lost'} postWin={g.won} postScore={`${g.rs} – ${g.ra}${g.extra ? ` (${g.extra})` : ''}`}
    />
  )
}

function ScreenPostseason({ r, v, pos, onNext, userName, adsDisabled, seen, onSeen }) {
  const us = v.team.short
  const series = v.series
  const lastS = series[series.length - 1]
  const seen0 = useRef(seen).current   // (watched before: it opens on the end, no ceremony again)
  const [started, setStarted] = useState(!!seen)
  const [si, setSi] = useState(seen ? Math.max(0, series.length - 1) : 0)
  const [gi, setGi] = useState(0)
  const [status, setStatus] = useState(seen ? 'end' : v.byeFirst ? 'bye' : 'playing')   // bye · playing · between · end
  const [log, setLog] = useState(() => (seen ? series.flatMap(s => s.games.map((g, i) => ({ s, g, i }))) : []))
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [popped, setPopped] = useState(!!seen)
  const [ringOpen, setRingOpen] = useState(false)
  useEffect(() => { if (status === 'end') onSeen?.() }, [status]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!APP_SIM || !popped || seen0) return
    const t = setTimeout(() => setRingOpen(true), 1300)
    return () => clearTimeout(t)
  }, [popped]) // eslint-disable-line react-hooks/exhaustive-deps
  const pct = useTimerBar(started && (status === 'between' || status === 'bye'), 2500, () => {
    if (status === 'bye') { setStatus('playing'); return }
    setSi(x => x + 1); setGi(0); setStatus('playing')
  })
  useEffect(() => { if (showLog && !adsDisabled && window.innerWidth <= 768) rampAdd([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-plf-log' }]) }, [showLog]) // eslint-disable-line react-hooks/exhaustive-deps
  const s = series[si]
  const gameDone = () => {
    setLog(l => [...l, { s, g: s.games[gi], i: gi }])
    if (gi < s.games.length - 1) setGi(gi + 1)
    else if (si < series.length - 1) setStatus('between')
    else setStatus('end')
  }
  const skip = () => { setLog(series.flatMap(x => x.games.map((g, i) => ({ s: x, g, i })))); setSi(series.length - 1); setGi(0); setStatus('end') }
  const done = status === 'end'
  // the bracket fills in as he goes: the rounds he's past, his round's matchups, the rest to come
  const ROUNDS = ['wc', 'ds', 'lcs', 'ws']
  const cur = done || !v.made ? 99 : !started || status === 'bye' ? (v.byeFirst ? 0 : ROUNDS.indexOf(series[0]?.key ?? 'wc')) : ROUNDS.indexOf(s?.key ?? 'wc') + (status === 'between' ? 1 : 0)
  const bracket = <section className="bbs-sec"><Hd sub={r.wsWinner && done ? `${teamName(r.wsWinner).toUpperCase()} WIN IT ALL` : 'THE BRACKET'}>OCTOBER</Hd>{v.bracket ? <Bracket bracket={v.bracket} us={us} upto={cur} /> : <p className="bbs-note">{r.wsWinner ? `The ${teamName(r.wsWinner)} won the World Series.` : 'The postseason played on.'}</p>}</section>

  if (!v.made) {
    return (
      <>
        <MissCard eyebrow="Postseason" title="Missed the Postseason" sub={`${v.wins}-${v.losses}${v.divRank ? ` · ${ordinal(v.divRank)} in the ${`${v.lg ?? ''} ${v.div ?? ''}`.trim()}` : ''}`} onNext={onNext} />
        <div className="bbs-body">{bracket}</div>
      </>
    )
  }
  if (!series.length) return <MissCard eyebrow="Postseason" title="October" onNext={onNext} />

  if (!started) {
    return (
      <div className="simp-screen bbs-screen">
        <div className="simp-eyebrow" style={{ textAlign: 'center' }}>Postseason</div>
        <div className="tipoff-header bbs-playball">
          <div className="tipoff-sub">No. {v.seed} Seed · {us}</div>
          <div className="bbs-first">{v.byeFirst ? 'A bye through the Wild Card Series, then the Division Series' : `First up: the ${series[0].name} vs the ${nickName(series[0].opp)}, best of ${series[0].best}`}</div>
          <button className="tipoff-spin-btn" onClick={() => { sfx('tap'); setStarted(true) }}>PLAY BALL</button>
        </div>
        <div className="bbs-body">{bracket}</div>
      </div>
    )
  }

  const gamesShown = s ? s.games.slice(0, status === 'playing' ? gi : s.games.length) : []
  const sw = gamesShown.filter(g => g.won).length, sl = gamesShown.length - sw
  const next = status === 'between' ? series[si + 1] : null
  const finalLine = lastS ? `${lastS.won ? 'Won' : 'Lost'} the series ${lastS.w}–${lastS.l} vs the ${teamName(lastS.opp)}` : ''
  const played = <section className="bbs-sec"><Hd sub={`${userName} IN OCTOBER`}>THE SERIES</Hd>{series.slice(0, done ? series.length : status === 'between' ? si + 1 : si).map((x, i) => <Series key={i} s={x} us={us} pos={pos} userName={userName} />)}</section>
  return (
    <div className="simp-screen bbs-screen">
      <div className="simp-eyebrow-row"><div className="simp-eyebrow">Postseason</div></div>
      {done && (
        <>
          {v.champ
            ? <ChampCard title="World Series Champions!" sub={`${lastS.w}–${lastS.l} vs the ${teamName(lastS.opp)} · World Series`}
                trophy={<span className="bbs-trophy-art"><TrophyDefs /><TrophyArt kind="ws" shine={1} /></span>} popped={popped} onPop={() => { setPopped(true); sfx('claim') }} cta="Awards Night →" onNext={onNext} />
            : <OverCard title={lastS?.key === 'ws' ? 'Lost the World Series' : 'Eliminated'} round={lastS?.key === 'ws' ? null : lastS?.name} line={finalLine} cta="Awards Night →" onNext={onNext} />}
          {ringOpen && (
            <RingCeremony team={{ name: v.team.name ?? teamName(us), color: v.team.color ?? TEAM_MAP[us]?.color, color2: v.team.color2 }} title="World Series Champions"
              score={`${lastS.w}–${lastS.l} over the ${teamName(lastS.opp)} in the World Series`} art={<span className="ag-ring-trophy bbs-ring-art"><TrophyDefs /><TrophyArt kind="ws" shine={1} /></span>}
              onClose={() => setRingOpen(false)} />
          )}
          <div className="bbs-body">{played}</div>
        </>
      )}
      {status === 'bye' && (
        <div className="bsim-playin-card bsim-playin-card--adv bbs-bye">
          <div className="bsim-playin-result">A Bye</div>
          <div className="bsim-playin-label">No. {v.seed} seed: the {nickName(us)} sit out the Wild Card Series and wait for a Division Series opponent</div>
          <TimerBar pct={pct} />
        </div>
      )}
      {(status === 'playing' || status === 'between') && s && (
        <>
          <div className="bsim-series-header">
            <span className="bsim-sh-round">{s.name}</span>
            <span className="bsim-sh-opp">vs {s.opp}{s.raw?.opponent?.seed ? ` · No. ${s.raw.opponent.seed}` : ''}</span>
          </div>
          <div className="bsim-mini-series">
            {gamesShown.map((g, i) => <span key={i} className={`bsim-ms-dot bsim-ms-dot--${g.won ? 'w' : 'l'}`}>{g.won ? 'W' : 'L'}</span>)}
            {Array.from({ length: Math.max(0, s.best - gamesShown.length) }, (_, i) => <span key={`e${i}`} className="bsim-ms-dot bsim-ms-dot--empty" />)}
            <span className="bsim-ms-score">{sw}–{sl}</span>
          </div>
          {status === 'between' ? (
            <div className="plf-game plf-game-won">
              <div className="plf-round-row"><div className="plf-round-lbl">{s.name} · Series Complete</div></div>
              <div className="plf-bw-inner">
                <div className="plf-bw-result"><span className="plf-bw-w">W</span><span className="plf-bw-score">Series {sw}–{sl}</span></div>
                <div className="plf-bw-adv">Advancing…</div>
                {next && <div className="plf-bw-next">Next up · {next.name} vs the {nickName(next.opp)}</div>}
              </div>
              <TimerBar pct={pct} />
            </div>
          ) : (
            <GameLive key={`${si}-${gi}`} g={s.games[gi]} us={us} pos={pos} userName={userName} speed={speed} paused={paused} onDone={gameDone} label={`${s.name} · Game ${gi + 1}`} />
          )}
          <div className="po-log-toggle-row">
            <SpeedSeg speed={speed} paused={paused} onSpeed={x => { setSpeed(x); setPaused(false) }} onPause={() => setPaused(true)} onSkip={skip} skipLabel={['Skip', 'Postseason']} />
            {log.length > 0 ? <button className="po-log-toggle-btn" onClick={() => setShowLog(x => !x)}>{showLog ? 'Hide' : 'View'} Game Log</button> : <div />}
          </div>
          {showLog && <ol className="bbs-log is-post">{log.map(({ s: x, g, i }, k) => <GameRow key={k} g={g} pos={pos} post={`${x.short ?? x.key?.toUpperCase()} G${i + 1}`} />)}</ol>}
          {showLog && !adsDisabled && <div id="ramp-cntr1-plf-log" className="plf-banner-ad" />}
        </>
      )}
      <div className="bbs-body">{bracket}</div>
    </div>
  )
}

// ── Awards night (basketball's GOAT Status): the writers' ballots, read out one at a time ──
function ScreenAwards({ r, v, pos, onNext, userName }) {
  const isPit = pos === 'pit'
  const me = { team: v.team.short, kind: isPit ? 'pit' : 'bat', ...v.line, k: v.line.so }
  const lg = v.lg ?? ''
  const list = [
    ...(isPit ? [[`${lg} CY YOUNG`, 'cyYoung', {}], [`${lg} MVP`, 'mvp', {}]] : [[`${lg} MVP`, 'mvp', {}]]),
    [`${lg} ROOKIE OF THE YEAR`, 'roy', { n: 3 }],
    ...(isPit && (v.line.role === 'RP' || v.line.role === 'CL' || wonIt(awardOf(r, 'reliever'))) ? [[`${lg} RELIEVER OF THE YEAR`, 'reliever', { unit: 'sv', n: 3 }]] : []),
    ...(!isPit ? [['HANK AARON AWARD', 'hankAaron', { unit: 'ops', n: 3 }]] : []),
  ].filter(([, key]) => awardOf(r, key) && awardOf(r, key).eligible !== false)
  const k = useStaged(true, [2200, ...list.map((_, i) => 2900 + i * 700), 2900 + list.length * 700 + 400])
  const big = list.find(([, key]) => wonIt(awardOf(r, key)))
  const shownTags = isPit ? ['cy', 'bmvp', 'rel', 'so', 'era', 'roy'] : ['bmvp', 'bat', 'hr', 'aaron', 'roy']
  const honors = baseballAwardTags(r).filter(t => !shownTags.includes(t))
  return (
    <div className="simp-screen goat-screen bbs-screen bbs-awards">
      <div className="goat-screen-title">AWARDS NIGHT</div>
      <div className="goat-page-title">The Writers' Vote</div>
      <div className="goat-eyebrow">{lg} · {String(r.season ?? r.year ?? 2026).toUpperCase()}</div>
      {k === 0 && <Checking label="Counting the ballots…" />}
      {k >= 1 && big && (
        <div className="goat-reveal-banner ag-pop">
          <div className="goat-reveal-you">{userName} wins the</div>
          <div className="goat-reveal-rank">{big[0].trim()}</div>
        </div>
      )}
      <div className="bbs-body">
        {list.map(([title, key, o], i) => k >= i + 2 && (
          <div key={key} className="ag-pop"><Award title={title.trim()} a={awardOf(r, key)} userName={userName} ballot me={me} {...o} /></div>
        ))}
        {k > list.length + 1 && honors.length > 0 && <div className="bbs-honors ag-pop">{honors.map(t => <span key={t}>{BASEBALL_AWARD[t]}</span>)}</div>}
      </div>
      {k > list.length + 1 && <button className="simp-cta simp-cta-in" onClick={() => { sfx('tap'); onNext() }} style={{ marginTop: 12 }}>Final Report →</button>}
    </div>
  )
}

function ScreenFinal({ r, v, pos, build, types, card, onReset, onBack, userName, isSalaryMode, adsDisabled, yearLabel }) {
  const isPit = pos === 'pit'
  const P = BASEBALL_POS[pos] ?? BASEBALL_POS.bat
  useEffect(() => { if (!adsDisabled) rampAdd([{ type: 'standard_iab_cntr1', selectorId: 'ramp-cntr1-sim' }]) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const bg = r.bestGame ? gameOf(r.bestGame, 0, 162) : null
  return (
    <div className="simp-screen bbs-screen">
      {APP_SIM && <SeasonRewards result={r} />}
      <div className="bbs-body">
        <section className="bbs-sec bbs-final">
          <div className={`bbs-final-head${v.champ ? ' is-champ' : ''}`}>
            <small>{userName} · {P.label} · {v.team.name ?? teamName(v.team.short)} · {yearLabel}</small>
            <b>{v.finish}</b>
            <span>{v.wins}-{v.losses}{v.made && v.seed ? ` · No. ${v.seed} seed` : ''}</span>
          </div>
          <Stats items={isPit ? pitItems(v.line, true) : batItems(v.line, true)} />
          {APP_SIM && card && <ShareSeasonButton card={card} className="bbs-share" />}
        </section>
        {bg && bg.played && (
          <section className="bbs-sec">
            <Hd>BEST GAME</Hd>
            <ol className="bbs-log"><GameRow g={bg} pos={pos} /></ol>
          </section>
        )}
        <section className="bbs-sec">
          <Hd sub={`${r.ovr} OVR`}><NameTag name={userName} self />'S BUILD</Hd>
          <BuildList build={build} types={types} />
        </section>
        <div id="ramp-cntr1-sim" className="ad-cntr1-mobile" />
        <div className="bbs-actions">
          {isSalaryMode
            ? <button className="bbs-btn is-main" onClick={onBack}>BACK TO SALARY</button>
            : <><button className="bbs-btn is-main" onClick={onReset}>NEW {P.label} BUILD</button><button className="bbs-btn" onClick={onBack}>BACK TO THE BUILD</button></>}
        </div>
      </div>
    </div>
  )
}

// ─── The page ────────────────────────────────────────────────────────────────
export default function BaseballSimPage({ result, build, types, pos = 'bat', pool = 'current', onBack, onReset, isSalaryMode = false, initialScreen = 0, onFinal = null, userName = 'Guest', arch = '', adsDisabled = false }) {
  const tapGuard = useTapGuard()
  // the season as played: the result, or the director's booked season once the moments have changed it
  const [live, setLive] = useState(result)
  const r = live ?? result
  const v = useMemo(() => (r ? view(r, pos) : null), [r, pos])
  const P = BASEBALL_POS[pos] ?? BASEBALL_POS.bat
  const LAST = 4
  // a season already booked (or reopened from View Results) opens on its final report
  const [reopened] = useState(() => initialScreen === 'final' || (result && BOOKED.has(result) && !isSalaryMode))
  const [screen, setScreen] = useState(() => (reopened ? LAST : 0))
  useRailOn(screen)   // each screen brings the bottom rail back
  const [seen, setSeen] = useState(() => (reopened ? { season: true, post: true } : {}))
  const [played, setPlayed] = useState(false)   // the regular season's last game is in

  // The moments (basketball's): on the app's look, while they're on. The director, baseball's story cards and its
  // record book load only then (lib/baseballDirector.js, SeasonMoments.jsx), so the default page stays light.
  const canMoments = APP_SIM && !isSalaryMode && !reopened && !!result?.games?.length
  const [M, setM] = useState(null)
  const [director, setDirector] = useState(null)
  const loading = useRef(null)
  const loadMoments = useCallback(() => {
    loading.current ??= Promise.all([import('./SeasonMoments'), import('../lib/baseballDirector')]).then(([a, b]) => { const m = { ...a, ...b }; setM(m); return m })
    return loading.current
  }, [])
  useEffect(() => {
    if (!canMoments) return
    if (momentsOn()) loadMoments()
    const on = () => { if (momentsOn()) loadMoments() }
    window.addEventListener('bap:moments-off', on)
    return () => window.removeEventListener('bap:moments-off', on)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // booked once: when the regular season has played out (basketball's moment), or on the way out
  const book = useCallback((res = live ?? result, leaving = false) => {
    if (!result || BOOKED.has(result)) return
    BOOKED.add(result); BOOKED.add(res)
    onFinal?.(res, leaving ? { leaving: true } : undefined)
  }, [result, live, onFinal])
  const handleFinal = final => { setLive(final); setPlayed(true); book(final) }
  useEffect(() => { if (screen === LAST) book() }, [screen, book])
  // (a real leave only, not React's development double mount: a season left mid-way is booked as far as it went)
  useOnLeave(() => { if (director && !director.finalized) book(director.finalize(), true); else book(undefined, true) })

  const card = useMemo(() => {
    if (!v) return null
    const ribbons = [v.champ && 'WORLD SERIES CHAMPIONS', ...baseballAwardTags(r).filter(t => t !== 'asg').map(t => BASEBALL_AWARD[t]), wonIt(awardOf(r, 'allStar')) && 'ALL-STAR'].filter(Boolean)
    const L = v.line
    return {
      sport: 'baseball', name: userName || 'Guest',
      tag: [P.label, isSalaryMode ? 'SALARY CAP' : BASEBALL_POOL[pool].label].join('  ·  '),
      hero: { value: r.ovr ?? '–', label: 'OVR' }, sub: arch && !/remaining$/.test(arch) ? arch : null,
      record: `${v.wins}-${v.losses}`, headline: v.finish, tier: v.champ ? 'champ' : v.made ? 'playoffs' : 'miss',
      ribbons: ribbons.slice(0, 3),
      team: v.team?.short ? { name: v.team.name ?? teamName(v.team.short), short: v.team.short, color: v.team.color, color2: v.team.color2, logo: `${LOGO}${v.team.short}.png` } : null,
      stats: pos === 'pit' ? [{ v: `${L.w}-${L.l}`, k: 'W-L' }, { v: f2(L.era), k: 'ERA' }, { v: L.so ?? 0, k: 'K' }] : [{ v: rate3(L.avg), k: 'AVG' }, { v: L.hr ?? 0, k: 'HR' }, { v: L.rbi ?? 0, k: 'RBI' }],
      chips: types.filter(t => build[t]).map(t => ({ label: MLB_ATTR[t]?.label ?? t, name: build[t].qbFull, photo: build[t].photo, faceCenter: build[t].faceCenter, val: build[t].val })),
      site: 'build-a-player.com/baseball',
    }
  }, [v]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!r || !v) return null
  const team = v.team
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
    loadMoments().then(m => { setDirector(d => d ?? m.oneOffDirector({ result, build, types, pos, mode: pool === 'alltime' ? 'alltime' : 'current', name: userName, attrMap: MLB_ATTR })); go() }).catch(() => go())
  }
  // (the ALL-TIME pool plays an era-neutral season: the sim calls it 'All-Time')
  const yearLabel = String(r.season ?? r.year ?? 2026)
  const lgDiv = `${v.lg ?? ''} ${v.div ?? ''}`.trim()
  const sz = build?.[BASEBALL_SLOTS[pos]?.size]
  const hands = baseballHands(build, pos)
  const after = screen >= 2 || seen.season || played
  const plate = screen === 0 ? (pool === 'current' ? 'OPENING DAY · MARCH 26' : 'OPENING DAY')
    : screen === 1 ? (after ? (v.made ? (v.divChamp ? `${lgDiv.toUpperCase()} CHAMPIONS · NO. ${v.seed} SEED` : `WILD CARD · NO. ${v.seed} SEED`) : `MISSED THE POSTSEASON · ${v.finish}`) : 'THE REGULAR SEASON')
    : screen === 2 ? (seen.post ? v.finish : 'OCTOBER') : screen === 3 ? 'AWARDS NIGHT' : v.finish
  const screens = [
    <ScreenBuild key="build" r={r} build={build} types={types} arch={arch} onNext={next} />,
    director && M && !seen.season
      ? <M.DirectedReveal key="season-dr" director={director} pace={35} onFinal={handleFinal}>
          {dr => <ScreenSeason r={r} v={v} pos={pos} onNext={next} userName={userName} adsDisabled={adsDisabled} seen={false} dr={dr} M={M} />}
        </M.DirectedReveal>
      : <ScreenSeason key="season" r={r} v={v} pos={pos} onNext={next} onDone={() => { setPlayed(true); if (!director) book(result) }} userName={userName} adsDisabled={adsDisabled} seen={!!seen.season} />,
    <ScreenPostseason key="post" r={r} v={v} pos={pos} onNext={next} userName={userName} adsDisabled={adsDisabled} seen={!!seen.post} onSeen={() => setSeen(s => ({ ...s, post: true }))} />,
    <ScreenAwards key="awards" r={r} v={v} pos={pos} onNext={next} userName={userName} />,
    <ScreenFinal key="final" r={r} v={v} pos={pos} build={build} types={types} card={card} onReset={() => { setScreen(0); onReset() }} onBack={() => { setScreen(0); onBack() }} userName={userName} isSalaryMode={isSalaryMode} adsDisabled={adsDisabled} yearLabel={yearLabel} />,
  ]
  const teamStyle = team ? { '--team-color': team.color ?? TEAM_MAP[team.short]?.color, '--team-color2': team.color2 ?? team.color } : undefined
  return (
    <div className={`simp-page bbs-page${v.champ && screen === LAST ? ' is-champ' : ''}`} style={teamStyle} onClickCapture={tapGuard.onClickCapture}>
      <div className="simp-col bbs-col">
        <div className="simp-top-bar bbs-topbar">
          {screen > 0 && !reopened && <button className="simp-back-btn" onClick={() => setScreen(s => Math.max(0, s - 1))}>← Back</button>}
          <ProgressDots screen={screen} total={screens.length} />
        </div>
        {/* the scorebug: the club, its record, where the season stands, who he is (every screen but awards night) */}
        {/* the moments switch above the scorebug (basketball's), while the season can have them */}
        {canMoments && screen < 2 && <div className="sts-moments-row"><MomentsToggle /></div>}
        {screen !== 3 && (
          <header className="bbs-hero">
            <div className="bbs-top-brand bbs-hero-brand">MLB <i>·</i> {yearLabel.toUpperCase()} SEASON{r.sandbox ? <em> · SANDBOX</em> : null}{isSalaryMode ? <em> · SALARY CAP</em> : null}</div>
            <div className="bbs-hero-team">
              <span className="bbs-hero-logo"><Logo short={team.short} size={58} /></span>
              <div>
                <small>{lgDiv || 'MLB'}{v.seed && after ? ` · NO. ${v.seed} SEED` : ''}</small>
                <h1>{team.name ?? teamName(team.short)}</h1>
              </div>
              {after ? <b className="bbs-hero-rec">{v.wins}-{v.losses}</b> : <span />}
            </div>
            <div className="bbs-hero-plate">{plate}</div>
            <div className="bbs-hero-who">
              <b>{userName}</b>
              <span>{P.label}{v.line.role ? ` · ${v.line.role}` : ''} · {arch}</span>
              <em>{r.ovr} OVR</em>
            </div>
            <div className="bbs-hero-bio">
              {sz?.height ? <span>{fmtBaseballHeight(sz.height)}{sz.weight ? ` · ${sz.weight} lb` : ''}</span> : null}
              {hands ? <span>B/T {hands}</span> : null}
              <span>{BASEBALL_POOL[pool]?.label}</span>
            </div>
          </header>
        )}
        {screens[screen]}
        <SiteFooter sport="baseball" />
      </div>
    </div>
  )
}
