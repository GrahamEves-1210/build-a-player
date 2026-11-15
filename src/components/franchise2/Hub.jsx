import { lazy, Suspense, useMemo, useState } from 'react'
import {
  TEAM, recText, records, standings, strength, sideGrade, mySchedule, playWeek, simWeeks, chooseEvent, intoPlayoffs, simPlayoffs, userAlive, userBye,
  DIV_OF, ROUNDS, FINISH_TEXT, finishOf, REG_WEEKS, closeSeason, CONF_OF,
} from '../../lib/franchise2'
import { GAMES } from '../../lib/minigames'
import { SIMPLE_GAMES } from '../../lib/minigamesSimple'
import { sfx, haptic } from '../../lib/juice'
import { IconClose, IconArrow, IconTrophy } from '../app/icons'
import { Logo, Count, Meter, teamVars } from './bits'
import Gameday from './Week'
import TeamTab from './Team'
import LeagueTab, { Bracket } from './League'
import HistoryTab from './History'
import Offseason from './Offseason'
import DraftBoard from './Draft'

const TrophyScene = lazy(() => import('./TrophyScene'))
export const GAMES_MODES = [['advanced', 'ADVANCED'], ['simple', 'SIMPLE'], ['off', 'NONE']]
export const momentOpts = F => {
  const m = F.games ?? 'advanced'
  return { moments: m !== 'off', allow: m === 'simple' ? g => !!SIMPLE_GAMES[g] : g => !!GAMES[g] }
}

export default function Hub({ F, act, owner, onHome, onSlots, onDelete, onBuild }) {
  const [tab, setTab] = useState('season')
  const [live, setLive] = useState(() => (F.pend ? { pend: true } : null))   // a game on screen
  const [trophy, setTrophy] = useState(false)
  const [board, setBoard] = useState(false)
  const t = TEAM[F.team]
  const r = records(F)[F.team]
  const st = strength(F, F.team)
  const off = F.phase === 'off'

  // PLAY WEEK: the week's games; the player's own on screen (the scorebug, a moment if it comes, the final)
  const play = () => {
    const out = act(X => playWeek(X, momentOpts(X)))
    sfx('whistle'); haptic('medium')
    if (out?.pending) setLive({ pend: true })
    else if (out?.row) setLive({ row: out.row, news: out.news })
    else if (out?.champ && out.champ === F.team) setTrophy(true)
  }
  const simToEnd = () => { act(X => simWeeks(X, {})); sfx('flip') }
  const after = () => {
    setLive(null)
    if (F.phase === 'done' && F.po?.champ === F.team) setTrophy(true)
  }

  return (
    <div className="ag-screen cr--team f2 f2-hub" style={teamVars(F.team)}>
      {live && <Gameday F={F} act={act} start={live} onDone={after} owner={owner} />}
      {trophy && <Suspense fallback={null}><TrophyScene team={{ name: t.name, color: t.color, color2: t.color2, short: t.short }} title="SUPER BOWL CHAMPIONS" line={`${F.year} · ${recText(r)}`} onDone={() => setTrophy(false)} /></Suspense>}
      {board && <DraftBoard F={F} act={act} onClose={() => setBoard(false)} />}
      <div className="ag-screen-head">
        <div className="cr-head">
          <img src={t.logo} alt="" className="cr-head-logo" />
          <div className="cr-head-txt">
            <span className="ag-eyebrow cr-head-team">{F.sandbox && <b className="sb-tag">SANDBOX</b>}{t.name.toUpperCase()}</span>
            <h1 className="ag-h1 cr-head-name">{t.nick.toUpperCase()}</h1>
            <span className="cr-head-meta">{F.year} · {F.phase === 'season' ? `WEEK ${F.wk + 1}` : F.phase === 'playoffs' ? 'PLAYOFFS' : off ? 'OFFSEASON' : 'SEASON OVER'} · GM {owner.toUpperCase()}</span>
          </div>
        </div>
        <button className="ag-round-btn" onClick={onHome} aria-label="Home"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <TeamBand F={F} r={r} st={st} />
        <div className="ag-seg cr-tabs" role="tablist">
          <span className="ag-seg-pill cr-tabs-pill" style={{ '--i': ['season', 'team', 'league', 'history'].indexOf(tab) }} aria-hidden="true" />
          {[['season', off ? 'OFFSEASON' : 'SEASON'], ['team', 'TEAM'], ['league', 'LEAGUE'], ['history', 'HISTORY']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => { setTab(id); sfx('tap') }}>{label}</button>
          ))}
        </div>
        {tab === 'season' && (off ? <Offseason F={F} act={act} owner={owner} onBuild={onBuild} /> : <Season F={F} act={act} owner={owner} r={r} play={play} simToEnd={simToEnd} onBoard={() => { setBoard(true); sfx('tap') }} onTrophy={() => setTrophy(true)} />)}
        {tab === 'team' && <TeamTab F={F} act={act} owner={owner} />}
        {tab === 'league' && <LeagueTab F={F} />}
        {tab === 'history' && <HistoryTab F={F} owner={owner} onSlots={onSlots} onDelete={onDelete} />}
      </div>
    </div>
  )
}

// ── The team's band: the record, the streak, the OVR, hype and chemistry ─────
function TeamBand({ F, r, st }) {
  const s = F.streak ?? 0
  return (
    <section className="f2-band ag-pop">
      <div className="f2-band-top">
        <span className="f2-rec"><b><Count v={r.w} ms={500} /><i>–</i><Count v={r.l} ms={500} />{r.t ? <><i>–</i>{r.t}</> : null}</b>{Math.abs(s) >= 2 && <span className={`f2-streak ${s > 0 ? 'is-w' : 'is-l'}`}>{s > 0 ? 'W' : 'L'}{Math.abs(s)}</span>}</span>
        <span className="f2-band-ovr"><b><Count v={st.ovr} /></b><small>OVR</small></span>
        <span className="f2-band-sides"><span><small>OFF</small><b>{sideGrade(st.off)}</b></span><span><small>DEF</small><b>{sideGrade(st.def)}</b></span></span>
      </div>
      <div className="f2-band-meters">
        <Meter label="HYPE" v={F.hype} tone="hype" />
        <Meter label="CHEMISTRY" v={F.chem} tone="chem" />
      </div>
    </section>
  )
}

// ── SEASON ───────────────────────────────────────────────────────────────────
function Season({ F, act, owner, r, play, simToEnd, onBoard, onTrophy }) {
  const ph = F.phase
  return (
    <>
      {ph === 'season' && F.ev && <EventCard key={`${F.year}-${F.wk}-${F.ev.id}`} F={F} act={act} />}
      {ph === 'season' && !F.ev && <NextGame F={F} play={play} simToEnd={simToEnd} />}
      {ph === 'post' && <SeasonOver F={F} act={act} r={r} />}
      {ph === 'playoffs' && <PlayoffCard F={F} act={act} play={play} />}
      {ph === 'done' && <Champions F={F} act={act} onTrophy={onTrophy} />}
      {(ph === 'season' || ph === 'post') && <Strip F={F} />}
      {ph === 'season' && F.log.length > 0 && <LastGame F={F} />}
      {(ph === 'season' || ph === 'post') && <Ladder F={F} />}
      {ph !== 'done' && <button className="f2-scout ag-pop" style={{ '--d': '120ms' }} onClick={onBoard}><span><small>DRAFT BOARD</small><b>SCOUT THE CLASS</b></span><span className="f2-scout-pts"><b>{F.sp}</b><small>PTS</small></span><IconArrow size={14} /></button>}
      <GamesSwitch F={F} act={act} />
    </>
  )
}
// the week's game: the two logos, where, and the button
function NextGame({ F, play, simToEnd }) {
  const wk = mySchedule(F)[F.wk]
  const R = records(F)
  if (!wk) return null
  return (
    <section key={F.wk} className="f2-next ag-pop">
      <span className="ag-eyebrow">WEEK {F.wk + 1}{wk.bye ? ' · BYE' : DIV_OF[wk.opp] === DIV_OF[F.team] ? ' · DIVISION' : ''}</span>
      {wk.bye ? <div className="f2-next-bye">BYE WEEK</div> : (
        <div className="f2-next-match">
          <span className="f2-next-side" style={teamVars(F.team)}><Logo s={F.team} size={58} /><small>{recText(R[F.team])}</small></span>
          <span className="f2-next-at">{wk.home ? 'VS' : 'AT'}</span>
          <span className="f2-next-side" style={teamVars(wk.opp)}><Logo s={wk.opp} size={58} /><small>{recText(R[wk.opp])}</small></span>
        </div>
      )}
      {!wk.bye && <b className="f2-next-name">{wk.home ? '' : '@ '}{TEAM[wk.opp].nick.toUpperCase()}</b>}
      <button className="ag-btn ag-btn--gold f2-go" onClick={play}>{wk.bye ? 'SKIP THE BYE' : 'PLAY WEEK'} <IconArrow size={16} /></button>
      {F.wk < REG_WEEKS - 1 && <button className="f2-ghost" onClick={simToEnd}>SIM TO PLAYOFFS</button>}
    </section>
  )
}
// the schedule as logos that turn W/L as the season goes
export function Strip({ F }) {
  const sch = mySchedule(F)
  return (
    <section className="f2-strip ag-pop" style={{ '--d': '60ms' }} aria-label="Schedule">
      {sch.map((g, i) => {
        const res = g.us == null ? null : g.us > g.them ? 'w' : g.us < g.them ? 'l' : 't'
        return (
          <span key={i} className={`f2-wk${res ? ` is-${res}` : ''}${i === F.wk && F.phase === 'season' ? ' is-now' : ''}${g.bye ? ' is-bye' : ''}`}>
            {g.bye ? <small>BYE</small> : <Logo s={g.opp} size={24} />}
            <i>{res ? res.toUpperCase() : g.bye ? '' : g.home ? 'H' : 'A'}</i>
          </span>
        )
      })}
    </section>
  )
}
// the division: four logos, in order
export function Ladder({ F, div = DIV_OF[F.team], title = null }) {
  const S = useMemo(() => standings(F), [F, F.wk, F.phase]) // eslint-disable-line react-hooks/exhaustive-deps
  const list = S.div[div]
  return (
    <section className="f2-ladder ag-pop" style={{ '--d': '90ms' }}>
      <span className="ag-eyebrow">{title ?? div.toUpperCase()}</span>
      <div className="f2-ladder-row">
        {list.map((s, i) => (
          <span key={s} className={`f2-rung${s === F.team ? ' is-me' : ''}`} style={teamVars(s)}>
            <i>{i + 1}</i><Logo s={s} size={36} /><b>{recText(S.R[s])}</b>
          </span>
        ))}
      </div>
    </section>
  )
}
function LastGame({ F }) {
  const g = F.log[F.log.length - 1]
  const res = g.w ? 'w' : g.t ? 't' : 'l'
  return (
    <section className={`f2-last ag-pop is-${res}`} style={{ '--d': '80ms' }}>
      <span className={`f2-last-res is-${res}`}>{res.toUpperCase()}</span>
      <Logo s={g.opp} size={30} />
      <span className="f2-last-txt"><b>{g.us}–{g.them}{g.ot ? ' OT' : ''}</b><small>{g.hl}</small></span>
      <small className="f2-last-wk">WK {g.wk}</small>
    </section>
  )
}

// ── An event: a headline, two big buttons ────────────────────────────────────
const FX = { hype: 'HYPE', chem: 'CHEM', nx: 'NEXT GAME' }
const fxTags = fx => [
  ...Object.entries(FX).filter(([k]) => fx[k]).map(([k, n]) => [n, fx[k] > 0 ? 'up' : 'down']),
  ...(fx.trade ? [['TRADE', 'up']] : []), ...(fx.risk ? [['RISK', 'down']] : []), ...(fx.sit ? [['SITS 1 WEEK', 'down']] : []), ...(fx.grow ? [['GROWTH', 'up']] : []), ...(fx.pay ? [['+2 YEARS', 'up']] : []),
]
function EventCard({ F, act }) {
  const ev = F.ev
  const [done, setDone] = useState(null)
  const pick = i => { if (done) return; const out = act(X => chooseEvent(X, i)); setDone({ i, out }); sfx(i === 0 ? 'claim' : 'tap'); haptic('medium') }
  // (the answer shows for a beat; the next tap moves on)
  return (
    <section className="f2-event ag-pop">
      <span className="ag-eyebrow">THIS WEEK</span>
      <h2 className="f2-event-title">{done ? (done.out?.hurt ? `${done.out.hurt.toUpperCase()} AGGRAVATED IT` : done.out?.traded ? `ACQUIRED ${done.out.traded.toUpperCase()}` : ev.title) : ev.title}</h2>
      <div className="f2-event-opts">
        {[ev.a, ev.b].map(([label, fx], i) => (
          <button key={i} className={`f2-event-opt${done ? (done.i === i ? ' is-picked' : ' is-dim') : ''}`} onClick={() => pick(i)} disabled={!!done}>
            <b>{label}</b>
            <span className="f2-fx">{fxTags(fx).map(([n, d]) => <i key={n} className={`is-${d}`}>{n} {d === 'up' ? '▲' : '▼'}</i>)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

// ── The end of the regular season, the playoffs, the champion ───────────────
function SeasonOver({ F, act, r }) {
  const S = standings(F)
  const c = CONF_OF[F.team], seed = S.seeds[c].indexOf(F.team) + 1
  return (
    <section className="f2-next ag-pop">
      <span className="ag-eyebrow">REGULAR SEASON OVER</span>
      <b className="f2-big"><Count v={r.w} />–<Count v={r.l} />{r.t ? `–${r.t}` : ''}</b>
      <b className="f2-next-name">{seed ? `${c} · ${seed} SEED` : 'MISSED THE PLAYOFFS'}</b>
      <button className="ag-btn ag-btn--gold f2-go" onClick={() => { const inIt = act(X => intoPlayoffs(X)); if (!inIt) act(X => simPlayoffs(X)); sfx('whistle') }}>{seed ? 'INTO THE PLAYOFFS' : 'FINISH THE SEASON'} <IconArrow size={16} /></button>
    </section>
  )
}
function PlayoffCard({ F, act, play }) {
  const po = F.po, alive = userAlive(F), bye = userBye(F)
  const g = po.rounds[po.rd].find(x => x.h === F.team || x.a === F.team)
  return (
    <>
      <section className="f2-next ag-pop">
        <span className="ag-eyebrow">{ROUNDS[po.rd]}</span>
        {alive && g ? (
          <div className="f2-next-match">
            <span className="f2-next-side" style={teamVars(F.team)}><Logo s={F.team} size={58} /><small>{seedText(F, F.team)}</small></span>
            <span className="f2-next-at">{po.rd === 3 ? 'VS' : g.h === F.team ? 'VS' : 'AT'}</span>
            <span className="f2-next-side" style={teamVars(g.h === F.team ? g.a : g.h)}><Logo s={g.h === F.team ? g.a : g.h} size={58} /><small>{seedText(F, g.h === F.team ? g.a : g.h)}</small></span>
          </div>
        ) : <b className="f2-next-name">{bye ? 'FIRST-ROUND BYE' : FINISH_TEXT[finishOf(F, F.team)]}</b>}
        {alive && g && <button className="ag-btn ag-btn--gold f2-go" onClick={play}>PLAY THE {ROUNDS[po.rd]} <IconArrow size={16} /></button>}
        {alive && bye && <button className="ag-btn ag-btn--gold f2-go" onClick={play}>WATCH THE WILD CARD <IconArrow size={16} /></button>}
        {!alive && <button className="ag-btn ag-btn--gold f2-go" onClick={() => { act(X => simPlayoffs(X)); sfx('flip') }}>FINISH THE PLAYOFFS <IconArrow size={16} /></button>}
      </section>
      <Bracket F={F} />
    </>
  )
}
const seedText = (F, s) => { const c = CONF_OF[s]; return `${F.po.seeds[c].indexOf(s) + 1} SEED` }
function Champions({ F, act, onTrophy }) {
  const c = F.po.champ, mine = c === F.team
  return (
    <section className={`f2-champ ag-pop${mine ? ' is-mine' : ''}`} style={teamVars(c)}>
      <span className="ag-eyebrow">SUPER BOWL · {F.year}</span>
      <Logo s={c} size={96} />
      <b className="f2-champ-name">{TEAM[c].nick.toUpperCase()}</b>
      <small>{mine ? 'WORLD CHAMPIONS' : `BEAT THE ${TEAM[F.po.runner].nick.toUpperCase()} ${F.po.score}`}</small>
      {mine && <button className="f2-ghost" onClick={onTrophy}><IconTrophy size={14} /> THE TROPHY</button>}
      <button className="ag-btn ag-btn--gold f2-go" onClick={() => { act(X => closeSeason(X)); sfx('award') }}>TO THE OFFSEASON <IconArrow size={16} /></button>
    </section>
  )
}
// ADVANCED / SIMPLE / NONE for the moments (Career's switch)
function GamesSwitch({ F, act }) {
  const mode = F.games ?? 'advanced'
  return (
    <div className="cr-gamesw cr-gamesw--3 f2-gamesw">
      <div className="cr-gamesw-top"><span><b>KEY MOMENTS MINI GAMES</b></span></div>
      <div className="cr-pos cr-games" role="radiogroup" aria-label="Mini games" style={{ '--n': GAMES_MODES.length }}>
        {GAMES_MODES.map(([m, label]) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'is-on' : ''} onClick={() => { if (m !== mode) { act(X => { X.games = m }); sfx('tap') } }}>{label}</button>
        ))}
      </div>
    </div>
  )
}
