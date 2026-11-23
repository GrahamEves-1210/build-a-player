import { useMemo, useState } from 'react'
import { GROUP, OFF_GROUPS, DEF_GROUPS, ST_GROUPS, OL_SPOTS, depthChart, startersOf, strength, sideGrade, TEAM, recText, records, teamSeasonStats, outText, leagueStats, whoIs } from '../../lib/franchise2'
import { sfx } from '../../lib/juice'
import { Chyron, BackBar, fkVars } from './kit'
import { Man, PlayerPage, dealText } from './dparts'
import { hurtText } from '../../lib/franchise2/copy'
import { memoF, warmKey } from './perf'
import './fd.css'

// A TEAM'S PAGE: any club's roster (its depth chart as it stands, read only) and its season in numbers, the way a
// broadcast's team page has them: each a game, with where it ranks in the league, and the team's leaders. The
// League tab's standings open it for any team; the Team tab opens the player's own on its numbers.
const ROOM_NAME = { qb: 'QUARTERBACKS', rb: 'RUNNING BACKS', wr: 'WIDE RECEIVERS', te: 'TIGHT ENDS', ol: 'OFFENSIVE LINE', edge: 'EDGE RUSHERS', dt: 'INTERIOR LINE', lb: 'LINEBACKERS', cb: 'CORNERBACKS', s: 'SAFETIES', k: 'KICKER' }
const SIDES = { off: OFF_GROUPS, def: DEF_GROUPS, st: ST_GROUPS }
export const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH'}`

export default function TeamPage({ F, s, owner, act, onBack, back = 'Back', start = 'roster' }) {
  const [tab, setTab] = useState(start)
  const [page, setPage] = useState(null)
  const r = records(F)[s]
  const st = useMemo(() => strength(F, s), [F, s, warmKey(F)]) // eslint-disable-line react-hooks/exhaustive-deps
  const name = `${TEAM[s].city ?? ''} ${TEAM[s].nick}`.trim()
  return (
    <div className="fd fk fd-narrow" style={fkVars(s)}>
      <BackBar label={back} title={TEAM[s].nick} onBack={onBack} />
      <Chyron team={s} title={TEAM[s].nick.toUpperCase()} tag={F.year} right={r && r.w + r.l + r.t ? recText(r) : null} sub={`${st.ovr} OVR · OFFENSE ${sideGrade(st.off)} · DEFENSE ${sideGrade(st.def)}`} />
      <div className="fd-seg" role="tablist" aria-label={name}>
        {[['roster', 'ROSTER'], ['stats', 'TEAM STATS']].map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => { setTab(k); sfx('tap') }}>{label}</button>)}
      </div>
      {tab === 'roster' ? <Roster F={F} s={s} owner={owner} onMan={setPage} /> : <Stats F={F} s={s} owner={owner} onMan={setPage} />}
      {page != null && <PlayerPage F={F} id={page} owner={owner} act={act} onClose={() => setPage(null)} />}
    </div>
  )
}

// ── The roster: the depth chart as the team has it ──────────────────────────
function Roster({ F, s, owner, onMan }) {
  const [side, setSide] = useState('off')
  const rooms = useMemo(() => {
    const C = depthChart(F, s), L = startersOf(F, s)
    const starting = new Set(Object.values(L).map(p => p.i))
    const slotOf = new Map(Object.entries(L).map(([k, p]) => [p.i, k]))
    const out = {}
    for (const k of [...OFF_GROUPS, ...DEF_GROUPS, ...ST_GROUPS]) {
      let up = 0
      out[k] = C[k].map((p, i) => {
        const starts = starting.has(p.i)
        const slot = p.in ? 'OUT' : starts ? (k === 'ol' ? OL_SPOTS[+(slotOf.get(p.i) ?? 'ol1').slice(2) - 1] : `${GROUP[k].label}${up + 1}`) : `${i + 1}`
        if (starts) up++
        return { p, starts, hurt: !!p.in, slot, line: p.in ? hurtText(F, p, outText) : p.rk === F.year ? `ROOKIE · ${dealText(p)}` : dealText(p) }
      })
    }
    return out
  }, [F, s, warmKey(F)]) // eslint-disable-line react-hooks/exhaustive-deps
  const n = F.teams[s].r.length
  return (
    <>
      <div className="fd-seg" role="tablist">
        {[['off', 'OFFENSE'], ['def', 'DEFENSE'], ['st', 'SPECIAL TEAMS']].map(([k, label]) => <button key={k} role="tab" aria-selected={side === k} className={side === k ? 'is-on' : ''} onClick={() => { setSide(k); sfx('tap') }}>{label}</button>)}
      </div>
      <p className="fd-hint">{n} PLAYERS · TAP ONE FOR HIS PAGE</p>
      <div className="fd-rooms">
        {SIDES[side].map((k, gi) => (
          <section key={k} className="fd-room" style={{ '--d': `${gi * 40}ms` }}>
            <div className="fd-room-h"><b>{ROOM_NAME[k]}</b><small>{rooms[k].length}</small></div>
            {rooms[k].map(x => (
              <div key={x.p.i} className={`fd-dc${x.starts ? ' is-start' : ''}${x.hurt ? ' is-hurt' : ''}`}>
                <span className="fd-dc-slot">{x.slot}</span>
                <Man F={F} p={x.p} s={s} owner={owner} size={x.starts ? 'm' : 's'} line={x.line} onClick={() => { onMan(x.p.i); sfx('tap') }} />
              </div>
            ))}
          </section>
        ))}
      </div>
    </>
  )
}

// ── Team stats: the season so far, a game at a time, ranked ───────────────────
const SECTION = [['off', 'OFFENSE'], ['def', 'DEFENSE'], ['to', 'TURNOVERS']]
function Stats({ F, s, owner, onMan }) {
  const tot = memoF(F, 'lstats', warmKey(F), () => { try { return leagueStats(F) } catch { return {} } })
  const T = useMemo(() => { try { return teamSeasonStats(F, s, { tot, who: whoIs(F) }) } catch { return null } }, [F, s, tot]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!T) return <div className="fd-none">TEAM STATS START AFTER WEEK 1</div>
  const games = `${T.gp} ${T.gp === 1 ? 'GAME' : 'GAMES'}`
  return (
    <>
      <p className="fd-hint">{F.phase === 'season' ? `THROUGH ${games}` : `${F.year} REGULAR SEASON`} · RANKED AGAINST THE LEAGUE{T.g < T.gp ? ` · YARDS AND TURNOVERS FROM THE LAST ${T.g}` : ''}</p>
      {SECTION.map(([k, title]) => {
        const rows = T.rows.filter(x => x.side === k)
        if (!rows.length) return null
        return (
          <section key={k} className="fd-tstats">
            <Chyron tone="ink" size="s" title={title} right="RANK" />
            {rows.map(x => (
              <div key={x.k} className={`fd-line fd-tstat${x.rank <= 5 ? ' is-top' : x.rank > x.of - 5 ? ' is-low' : ''}`}>
                <b>{x.label}</b><span>{x.txt}<small>{ordinal(x.rank)}</small></span>
              </div>
            ))}
          </section>
        )
      })}
      {T.leaders.length > 0 && <Chyron tone="ink" size="s" title="TEAM LEADERS" />}
      {T.leaders.map((l, i) => <Man key={l.k} F={F} p={l.p} s={s} owner={owner} size="s" stat={{ v: l.v, label: l.label }} line={l.txt} onClick={() => { onMan(l.p.i); sfx('tap') }} delay={i * 30} />)}
    </>
  )
}

// the Team tab's way in to the player's own numbers
export function StatsStrip({ F, onOpen }) {
  const T = useMemo(() => { try { return teamSeasonStats(F, F.team) } catch { return null } }, [F, warmKey(F)]) // eslint-disable-line react-hooks/exhaustive-deps
  const pts = T?.rows.find(x => x.k === 'ppg'), allowed = T?.rows.find(x => x.k === 'papg')
  return (
    <button type="button" className="fh-row tr-strip fd-stats-strip" style={fkVars(F.team)} onClick={onOpen}>
      <span><small>Team stats</small><b>{pts ? `${pts.txt} points a game · ${ordinal(pts.rank)}` : 'After Week 1'}</b><em>{allowed ? `${allowed.txt} allowed · ${ordinal(allowed.rank)}` : 'Every team ranked, game by game'}</em></span>
      <i className="fh-row-go" aria-hidden="true">›</i>
    </button>
  )
}
