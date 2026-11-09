import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { SOCCER_MODES_DB, rowSoccerTags } from '../../lib/soccerAwards'
import { SOCCER_ATTR } from '../../data/soccer-attrs'
import { valToGrade } from '../../utils/simulation'
import { IconSoccer, IconTrophy } from './icons'

// Profile → SOCCER: the player's soccer career, the way the BASKETBALL section shows basketball's
// (ProfilePage's prf- cards). TOP DIVISIONS and WORLD CUP side by side, like Current and All-Time.
// Real football numbers: W-D-L, goals, assists, the average match rating, titles, Golden Boots and
// the Ballon d'Or (the World Cup's Golden Ball). A row's columns: lib/soccerAwards.js.

const COLS = 'game_mode,wins,losses,season_comp_pct,season_tds,season_ints,ppg,champion,playoffs,season_award,ovr,archetype,build,team_short,finals_opp,finals_series,created_at'
const gradeColor = v0 => { const v = Math.round(v0 ?? 0); return v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444' }
const sum = (rows, k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)

function careerOf(rows) {
  if (!rows.length) return null
  const rated = rows.filter(r => Number(r.ppg) > 0)
  const tags = rows.map(rowSoccerTags)
  const withBuilds = rows.filter(r => r.build && r.ovr)
  const goals = sum(rows, 'season_tds')
  return {
    count: rows.length,
    wins: sum(rows, 'wins'), draws: sum(rows, 'season_comp_pct'), losses: sum(rows, 'losses'),
    titles: rows.filter(r => r.champion).length,
    boots: tags.filter(t => t.includes('boot')).length,
    ballons: tags.filter(t => t.includes('bdor') || t.includes('gball')).length,
    goals, assists: sum(rows, 'season_ints'),
    perSeason: (goals / rows.length).toFixed(1),
    rating: rated.length ? (sum(rated, 'ppg') / rated.length).toFixed(2) : '–',
    avgOVR: (sum(rows, 'ovr') / rows.length).toFixed(1),
    best: rows.reduce((b, r) => ((r.season_tds ?? 0) > (b.season_tds ?? 0) ? r : b), rows[0]),
    bestBuild: withBuilds.length ? withBuilds.reduce((b, r) => (r.ovr > b.ovr ? r : b), withBuilds[0]) : null,
  }
}

export default function SoccerCareer({ user, show = true }) {
  const [rows, setRows] = useState(undefined)   // undefined: loading
  const [pool, setPool] = useState('current')
  useEffect(() => {
    if (!supabase || !user) { setRows(null); return }
    let live = true
    supabase.from('simulations').select(COLS).eq('user_id', user.id).in('game_mode', [SOCCER_MODES_DB.current, SOCCER_MODES_DB.alltime])
      .order('created_at', { ascending: false }).limit(1000)
      .then(({ data, error }) => { if (live) setRows(error ? null : data ?? []) }, () => { if (live) setRows(null) })
    return () => { live = false }
  }, [user])
  const split = { current: (rows ?? []).filter(r => r.game_mode === SOCCER_MODES_DB.current), alltime: (rows ?? []).filter(r => r.game_mode === SOCCER_MODES_DB.alltime) }
  const wc = pool === 'alltime'
  const c = careerOf(split[pool] ?? [])
  const anim = show ? 'prf-card-in' : ''

  if (rows === undefined) return (
    <div className={`prf-card ${anim}`} style={{ animationDelay: '0.25s' }}>
      <div className="prf-card-hd"><span className="prf-card-title">Career</span></div>
    </div>
  )

  return (
    <>
      <div className={`prf-cgame-toggle ${anim}`} style={{ animationDelay: '0.25s' }}>
        {[['current', 'Top Divisions'], ['alltime', 'World Cup']].map(([id, label]) => (
          <button key={id} className={`prf-cgame-btn${pool === id ? ' active' : ''}`} onClick={() => setPool(id)}>
            <div className="prf-cgame-icon-wrap"><IconSoccer size={16} />{id === 'alltime' && <span className="prf-cgame-star">★</span>}</div>
            <span className="prf-cgame-label">{label}</span>
          </button>
        ))}
      </div>

      {!c && (
        <div className={`prf-card prf-card-empty ${anim}`} style={{ animationDelay: '0.3s' }}>
          <div className="prf-card-hd"><span className="prf-card-title">Career</span></div>
          <div className="prf-empty-msg">{rows === null ? 'Couldn\'t load soccer seasons.' : `No ${wc ? 'World Cup' : 'Top Divisions'} seasons yet.`}</div>
        </div>
      )}

      {c && (
        <div className={`prf-card${wc ? ' prf-card-legend' : ''} ${anim}`} style={{ animationDelay: '0.3s' }}>
          <div className="prf-card-hd">
            <span className={`prf-card-title${wc ? ' prf-card-title-legend' : ''}`}>{wc ? '★ ' : ''}Career</span>
            <span className="prf-career-count">{c.count} {wc ? 'World Cup' : 'season'}{c.count !== 1 ? 's' : ''}</span>
          </div>
          <div className="prf-career-record">
            <span className="pcr-w">{c.wins}</span>
            <span className="pcr-sep">–</span>
            <span className="pcr-l" style={{ color: 'var(--ag-muted, #9aa7a0)' }}>{c.draws}</span>
            <span className="pcr-sep">–</span>
            <span className="pcr-l">{c.losses}</span>
            <span className="pcr-label">{wc ? 'Group Record' : 'League Record'}</span>
          </div>
          <div className="prf-career-grid">
            <div className="pcg-cell"><div className="pcg-val pcg-val-rings">{c.titles}</div><div className="pcg-lbl pcg-lbl-rings">{wc ? 'World Cups' : 'Titles'}</div></div>
            <div className="pcg-cell"><div className="pcg-val">{c.boots}</div><div className="pcg-lbl">Golden Boots</div></div>
            <div className="pcg-cell"><div className="pcg-val">{c.ballons}</div><div className="pcg-lbl">{wc ? 'Golden Balls' : 'Ballon d\'Ors'}</div></div>
            <div className="pcg-cell"><div className="pcg-val">{c.goals.toLocaleString()}</div><div className="pcg-lbl">Goals</div></div>
            <div className="pcg-cell"><div className="pcg-val">{c.assists.toLocaleString()}</div><div className="pcg-lbl">Assists</div></div>
            <div className="pcg-cell"><div className="pcg-val">{c.rating}</div><div className="pcg-lbl">Avg Rating</div></div>
            <div className="pcg-cell"><div className="pcg-val">{c.perSeason}</div><div className="pcg-lbl">{wc ? 'Goals a Cup' : 'Goals a Season'}</div></div>
            <div className="pcg-cell"><div className="pcg-val">{c.avgOVR}</div><div className="pcg-lbl">Avg OVR</div></div>
            <div className="pcg-cell"><div className="pcg-val">{c.count}</div><div className="pcg-lbl">{wc ? 'World Cups' : 'Seasons'}</div></div>
          </div>

          {c.best && (
            <div className="prf-best-season">
              <span className="pbs-lbl">{wc ? 'Best World Cup' : 'Best Season'}</span>
              <span className="pbs-val">
                {c.best.champion && <IconTrophy size="1em" className="ico-inline ico-gold" />}{c.best.champion ? ' ' : ''}
                {c.best.season_tds ?? 0} G · {c.best.season_ints ?? 0} A{Number(c.best.ppg) > 0 ? ` · ${(+c.best.ppg).toFixed(2)}` : ''}
                {rowSoccerTags(c.best).includes('boot') ? ' · Golden Boot' : ''}
              </span>
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
                      <span className="pbe-slot-attr">{SOCCER_ATTR[slot]?.shortLabel ?? slot}</span>
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
