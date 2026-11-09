import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { BASEBALL_MODES_DB, BASEBALL_AWARD, rowBaseballAwards } from '../../lib/baseballAwards'
import { MLB_ATTR } from '../../data/mlb-attrs'
import { valToGrade } from '../../utils/simulation'
import { IconBaseball, IconTrophy, IconRing, IconMedal, IconStar } from './icons'
import './baseball-career.css'

// Profile → BASEBALL: the player's baseball career, the way the BASKETBALL section shows basketball's
// (ProfilePage's prf- cards). Batter and pitcher, Current and All-Time, each on its own tab like football's
// positions. Real box-score numbers: the club's record, World Series, the awards, HR / RBI / hits / OPS / WAR
// (a pitcher: W / K / IP / ERA / WAR), the best season and the best build. A row's columns: lib/baseballAwards.js.
// BaseballFriendCard: the same seasons, short, on another player's profile sheet (FriendProfile).

const COLS = 'game_mode,position,wins,losses,season_tds,season_ints,ppg,season_rating,season_pass_yds,champion,playoffs,finals_opp,season_award,ovr,archetype,build,team_short,created_at'
const gradeColor = v0 => { const v = Math.round(v0 ?? 0); return v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444' }
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0)
const sum = (rows, k) => rows.reduce((s, r) => s + num(r[k]), 0)
const fmt = v => Math.round(v).toLocaleString()
// .912, 1.034 (OPS the way a box score prints it)
const thr = v => { const s = Number(v).toFixed(3); return s.startsWith('0.') ? s.slice(1) : s }
// every award, the biggest first (lib/baseballAwards.js's order)
const AWARD_ORDER = rowBaseballAwards({ season_award: Object.keys(BASEBALL_AWARD).join(',') })
const ipOf = outs => `${Math.floor(outs / 3).toLocaleString()}${outs % 3 ? `.${outs % 3}` : ''}`

const TABS = [
  { id: 'bat', pos: 'bat', mode: BASEBALL_MODES_DB.current, label: 'Batter', star: false },
  { id: 'pit', pos: 'pit', mode: BASEBALL_MODES_DB.current, label: 'Pitcher', star: false },
  { id: 'bat-at', pos: 'bat', mode: BASEBALL_MODES_DB.alltime, label: 'All-Time Batter', star: true },
  { id: 'pit-at', pos: 'pit', mode: BASEBALL_MODES_DB.alltime, label: 'All-Time Pitcher', star: true },
]

// a season's headline line: WAR first, then what the position is judged on
export function baseballSeasonLine(r) {
  const war = r.season_rating != null ? `${num(r.season_rating).toFixed(1)} WAR` : null
  return (r.position === 'pit'
    ? [war, `${num(r.season_ints)} W`, Number(r.ppg) > 0 || r.ppg === 0 ? `${num(r.ppg).toFixed(2)} ERA` : null, `${num(r.season_tds)} K`]
    : [war, `${num(r.season_tds)} HR`, `${num(r.season_ints)} RBI`, Number(r.ppg) > 0 ? `${thr(r.ppg)} OPS` : null]
  ).filter(Boolean).join(' · ')
}

function careerOf(rows, pit) {
  if (!rows.length) return null
  const tags = rows.map(rowBaseballAwards)
  const n = t => tags.filter(x => x.includes(t)).length
  const withBuilds = rows.filter(r => r.build && r.ovr)
  const outs = sum(rows, 'season_pass_yds')
  // ERA over the whole career: each season's ERA weighted by its innings (its earned runs aren't kept)
  const eraRows = rows.filter(r => r.ppg != null && num(r.season_pass_yds) > 0)
  const eraOuts = sum(eraRows, 'season_pass_yds')
  const opsRows = rows.filter(r => Number(r.ppg) > 0)
  const awards = AWARD_ORDER.map(t => [t, n(t)]).filter(([, c]) => c > 0)
  return {
    count: rows.length,
    wins: sum(rows, 'wins'), losses: sum(rows, 'losses'),
    titles: rows.filter(r => r.champion).length,
    pennants: rows.filter(r => r.finals_opp).length,
    postseason: rows.filter(r => r.playoffs).length,
    mvp: n('bmvp'), cy: n('cy'), ss: n('ss'), gg: n('gg'), asg: n('asg'),
    awards,
    tds: sum(rows, 'season_tds'), ints: sum(rows, 'season_ints'), outs,
    ops: opsRows.length ? thr(sum(opsRows, 'ppg') / opsRows.length) : '–',
    era: eraOuts > 0 ? (eraRows.reduce((s, r) => s + num(r.ppg) * num(r.season_pass_yds), 0) / eraOuts).toFixed(2) : '–',
    war: sum(rows, 'season_rating').toFixed(1),
    perSeason: (sum(rows, 'season_tds') / rows.length).toFixed(1),
    avgOVR: (sum(rows, 'ovr') / rows.length).toFixed(1),
    best: rows.reduce((b, r) => (num(r.season_rating) > num(b.season_rating) ? r : b), rows[0]),
    bestBuild: withBuilds.length ? withBuilds.reduce((b, r) => (r.ovr > b.ovr ? r : b), withBuilds[0]) : null,
    pit,
  }
}

function useBaseballRows(uid) {
  const [rows, setRows] = useState(undefined)   // undefined: loading · null: couldn't load
  useEffect(() => {
    if (!supabase || !uid) { setRows(null); return }
    let live = true
    setRows(undefined)
    supabase.from('simulations').select(COLS).eq('user_id', uid).in('game_mode', [BASEBALL_MODES_DB.current, BASEBALL_MODES_DB.alltime])
      .order('created_at', { ascending: false }).limit(1000)
      .then(({ data, error }) => { if (live) setRows(error ? null : data ?? []) }, () => { if (live) setRows(null) })
    return () => { live = false }
  }, [uid])
  return rows
}
const rowsOf = (rows, tab) => (rows ?? []).filter(r => r.game_mode === tab.mode && (r.position === 'pit' ? 'pit' : 'bat') === tab.pos)

const Cell = ({ v, l, ring = false }) => (
  <div className="pcg-cell"><div className={`pcg-val${ring ? ' pcg-val-rings' : ''}`}>{v}</div><div className={`pcg-lbl${ring ? ' pcg-lbl-rings' : ''}`}>{l}</div></div>
)

export default function BaseballCareer({ user, show = true }) {
  const rows = useBaseballRows(user?.id)
  const [tabId, setTab] = useState(() => { try { return localStorage.getItem('baseballPosition') === 'pit' ? 'pit' : 'bat' } catch { return 'bat' } })
  const tab = TABS.find(t => t.id === tabId) ?? TABS[0]
  const at = tab.mode === BASEBALL_MODES_DB.alltime
  const pit = tab.pos === 'pit'
  const c = careerOf(rowsOf(rows, tab), pit)
  const anim = show ? 'prf-card-in' : ''

  if (rows === undefined) return (
    <div className={`prf-card ${anim}`} style={{ animationDelay: '0.25s' }}>
      <div className="prf-card-hd"><span className="prf-card-title">Career</span></div>
    </div>
  )

  return (
    <>
      <div className={`prf-cgame-toggle bbc-toggle ${anim}`} style={{ animationDelay: '0.25s' }}>
        {TABS.map(t => (
          <button key={t.id} className={`prf-cgame-btn${t.id === tab.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            <div className="prf-cgame-icon-wrap"><IconBaseball size={16} />{t.star && <span className="prf-cgame-star">★</span>}</div>
            <span className="prf-cgame-label">{t.label}</span>
          </button>
        ))}
      </div>

      {!c && (
        <div className={`prf-card prf-card-empty ${anim}`} style={{ animationDelay: '0.3s' }}>
          <div className="prf-card-hd"><span className="prf-card-title">Career</span></div>
          <div className="prf-empty-msg">{rows === null ? 'Couldn\'t load baseball seasons.' : `No ${at ? 'All-Time' : 'Current'} ${pit ? 'pitcher' : 'batter'} seasons yet.`}</div>
        </div>
      )}

      {c && (
        <div className={`prf-card${at ? ' prf-card-legend' : ''} ${anim}`} style={{ animationDelay: '0.3s' }}>
          <div className="prf-card-hd">
            <span className={`prf-card-title${at ? ' prf-card-title-legend' : ''}`}>{at ? '★ ' : ''}Career</span>
            <span className="prf-career-count">{c.count} season{c.count !== 1 ? 's' : ''}</span>
          </div>
          <div className="prf-career-record">
            <span className="pcr-w">{c.wins.toLocaleString()}</span>
            <span className="pcr-sep">–</span>
            <span className="pcr-l">{c.losses.toLocaleString()}</span>
            <span className="pcr-label">Team Record</span>
          </div>
          <div className="prf-career-grid">
            <Cell v={c.titles} l="World Series" ring />
            {pit
              ? <><Cell v={c.cy} l="Cy Youngs" /><Cell v={c.asg} l="All-Star" /></>
              : <><Cell v={c.mvp} l="MVPs" /><Cell v={c.ss} l="Silver Sluggers" /></>}
            {pit
              ? <><Cell v={fmt(c.ints)} l="Wins" /><Cell v={fmt(c.tds)} l="Strikeouts" /><Cell v={ipOf(c.outs)} l="Innings" /></>
              : <><Cell v={fmt(c.tds)} l="Home Runs" /><Cell v={fmt(c.ints)} l="RBI" /><Cell v={fmt(c.outs)} l="Hits" /></>}
            {pit
              ? <><Cell v={c.era} l="ERA" /><Cell v={c.war} l="WAR" /><Cell v={c.perSeason} l="K a Season" /></>
              : <><Cell v={c.ops} l="OPS" /><Cell v={c.war} l="WAR" /><Cell v={c.perSeason} l="HR a Season" /></>}
            <Cell v={c.pennants} l="Pennants" />
            <Cell v={c.postseason} l="Postseasons" />
            <Cell v={c.avgOVR} l="Avg OVR" />
          </div>

          {c.best && (
            <div className="prf-best-season">
              <span className="pbs-lbl">Best Season</span>
              <span className="pbs-val">
                {c.best.champion && <IconTrophy size="1em" className="ico-inline ico-gold" />}{c.best.champion ? ' ' : ''}
                {baseballSeasonLine(c.best)}
                {c.best.team_short ? ` · ${c.best.team_short} ${num(c.best.wins)}-${num(c.best.losses)}` : ''}
              </span>
            </div>
          )}
          {c.awards.length > 0 && (
            <div className="prf-best-season bbc-awards">
              <span className="pbs-lbl">Awards</span>
              <span className="pbs-val">{c.awards.map(([t, k]) => `${titleCase(BASEBALL_AWARD[t])}${k > 1 ? ` ×${k}` : ''}`).join(' · ')}</span>
            </div>
          )}
          {c.bestBuild && (
            <div className="prf-build-extremes">
              <div className="prf-build-extreme prf-build-extreme--best">
                <div className="pbe-header">
                  <span className="pbe-label">Best Build</span>
                  <span className="pbe-ovr">{c.bestBuild.ovr} OVR</span>
                  {c.bestBuild.archetype && <span className="pbe-arch">{c.bestBuild.archetype}</span>}
                </div>
                <div className="pbe-slots">
                  {Object.entries(c.bestBuild.build).map(([slot, d]) => (
                    <div key={slot} className="pbe-slot-row">
                      <span className="pbe-slot-attr">{MLB_ATTR[slot]?.shortLabel ?? slot}</span>
                      <span className="pbe-slot-qb">{d?.qb}</span>
                      <span className="pbe-slot-grade" style={{ background: gradeColor(d?.val), color: '#111111' }}>{valToGrade(d?.val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

// 'SILVER SLUGGER' → 'Silver Slugger' (MVP, ERA, LCS and the like stay capitals)
const KEEP = new Set(['MVP', 'ERA', 'LCS', 'MLB', 'ALL-MLB'])
const titleCase = s => String(s).split(' ').map(w => (KEEP.has(w) ? w : w.split('-').map(x => x.charAt(0) + x.slice(1).toLowerCase()).join('-'))).join(' ')

// Another player's baseball, short (FriendProfile): what's public about their seasons, only if they have any
export function BaseballFriendCard({ uid }) {
  const rows = useBaseballRows(uid)
  if (!rows?.length) return null
  const tags = rows.map(rowBaseballAwards)
  const n = t => tags.filter(x => x.includes(t)).length
  const best = pos => {
    const list = rows.filter(r => (r.position === 'pit' ? 'pit' : 'bat') === pos)
    return list.length ? list.reduce((b, r) => (num(r.season_rating) > num(b.season_rating) ? r : b), list[0]) : null
  }
  const bests = [best('bat'), best('pit')].filter(Boolean)
  return (
    <>
      <div className="fr-sub-head"><span className="ag-eyebrow">BASEBALL</span></div>
      <div className="fr-stats">
        <span><IconBaseball size={15} /><b>{rows.length.toLocaleString()}</b>SEASONS</span>
        <span><IconRing size={15} /><b>{rows.filter(r => r.champion).length.toLocaleString()}</b>WORLD SERIES</span>
        <span><IconMedal size={15} /><b>{n('bmvp')}</b>MVP</span>
        <span><IconStar size={15} /><b>{n('cy')}</b>CY YOUNG</span>
      </div>
      <div className="fr-builds">
        {bests.map(r => (
          <div key={r.position} className="fr-build">
            <span className="fr-build-ovr"><b>{r.ovr ?? '–'}</b><small>OVR</small></span>
            <span className="fr-build-main">
              <span className="fr-build-mode">Best {r.position === 'pit' ? 'Pitcher' : 'Batter'} Season · {r.game_mode === BASEBALL_MODES_DB.alltime ? 'All-Time' : 'Current'}</span>
              <span className="fr-build-arch">{baseballSeasonLine(r)}</span>
            </span>
            <span className="fr-build-rec">
              {r.wins != null && <b>{num(r.wins)}-{num(r.losses)}</b>}
              {r.champion && <i className="fr-ring" role="img" title="World Series champions" aria-label="Won the World Series"><IconTrophy size={13} /></i>}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
