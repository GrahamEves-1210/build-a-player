import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  TEAM, recText, records, standings, strength, sideGrade, mySchedule, playWeek, simWeeks, chooseEvent, intoPlayoffs, simPlayoffs, userAlive, userBye,
  DIV_OF, ROUNDS, FINISH_TEXT, finishOf, REG_WEEKS, CONF_OF, CONFS,
} from '../../lib/franchise2'
import { closeSeason, statLine } from '../../lib/franchise2/awards'
import { fxList, lineOf, leagueWire } from '../../lib/franchise2/season'
import { startersOf } from '../../lib/franchise2/roster'
import { leagueStats } from '../../lib/franchise2/stats'
import { tickerItems } from '../../lib/franchise2/news'
import { GAMES } from '../../lib/minigames'
import { SIMPLE_GAMES } from '../../lib/minigamesSimple'
import { romanOf } from '../../lib/mg/kit'
import { sfx, haptic } from '../../lib/juice'
import { IconClose } from '../app/icons'
import { fkVars, KLogo, Chyron, Ticker, Scorebug, ManL3, BigRec, Stamp, Meter, TeamSlab, Versus, Tape, Go, Tag, Fact } from './kit'
import Gameday from './Week'
import TeamTab from './Team'
import LeagueTab from './League'
import HistoryTab from './History'
import Offseason from './Offseason'
import DraftBoard from './Draft'
import './season.css'

const TrophyScene = lazy(() => import('./TrophyScene'))
export const GAMES_MODES = [['advanced', 'ADVANCED'], ['simple', 'SIMPLE'], ['off', 'NONE']]
export const momentOpts = F => {
  const m = F.games ?? 'advanced'
  return { moments: m !== 'off', allow: m === 'simple' ? g => !!SIMPLE_GAMES[g] : g => !!GAMES[g] }
}
// the season's Super Bowl by its number (the 2026 season's is LXI)
export const sbName = F => `SUPER BOWL ${romanOf(F.year - 1965)}`
// a playoff round the way the league says it (the conference title game by its conference)
export const roundName = (F, rd, s = F.team) => (rd === 2 ? `${CONF_OF[s]} CHAMPIONSHIP` : rd === 3 ? sbName(F) : `${ROUNDS[rd]} ROUND`)
const ORD = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH'}`
const TABS = [['season', 'SEASON'], ['team', 'TEAM'], ['league', 'LEAGUE'], ['history', 'HISTORY']]

export default function Hub({ F, act, owner, onHome, onSlots, onDelete, onBuild }) {
  const [tab, setTab] = useState('season')
  const [live, setLive] = useState(() => (F.pend ? { pend: true } : null))   // a game on screen
  const [trophy, setTrophy] = useState(false)
  const [board, setBoard] = useState(false)
  const t = TEAM[F.team]
  const r = records(F)[F.team]
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
  const phaseText = F.phase === 'season' ? `WEEK ${F.wk + 1}` : F.phase === 'post' ? 'REGULAR SEASON OVER' : F.phase === 'playoffs' ? 'PLAYOFFS' : off ? 'OFFSEASON' : 'SEASON OVER'

  return (
    <div className="ag-screen f2 fk fk-root fh" style={fkVars(F.team)}>
      {live && <Gameday F={F} act={act} start={live} onDone={after} owner={owner} />}
      {trophy && <Suspense fallback={null}><TrophyScene team={{ name: t.name, color: t.color, color2: t.color2, short: t.short }} title={`${sbName(F)} CHAMPIONS`} line={`${F.year} · ${recText(r)}`} onDone={() => setTrophy(false)} /></Suspense>}
      {board && <DraftBoard F={F} act={act} onClose={() => setBoard(false)} />}
      <header className="fh-top">
        <span className="fh-top-slab"><KLogo s={F.team} size={40} /></span>
        <span className="fh-top-txt">
          <small>{F.sandbox && <b className="fh-sandbox">SANDBOX</b>}{t.name.replace(` ${t.nick}`, '').toUpperCase()}</small>
          <b>{t.nick.toUpperCase()}</b>
        </span>
        <span className="fh-top-when"><b>{F.year}</b><small>{phaseText}</small></span>
        <button className="fh-x" onClick={onHome} aria-label="Home"><IconClose size={16} /></button>
      </header>
      {!off && <Band F={F} r={r} />}
      <nav className="fh-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => { if (tab !== id) { setTab(id); sfx('tap') } }}>{id === 'season' && off ? 'OFFSEASON' : label}</button>
        ))}
      </nav>
      <div className="ag-screen-body fh-body">
        {tab === 'season' && (off ? <Offseason F={F} act={act} owner={owner} onBuild={onBuild} /> : <Season F={F} act={act} owner={owner} r={r} play={play} simToEnd={simToEnd} onBoard={() => { setBoard(true); sfx('tap') }} onTrophy={() => setTrophy(true)} />)}
        {tab === 'team' && <TeamTab F={F} act={act} owner={owner} />}
        {tab === 'league' && <LeagueTab F={F} />}
        {tab === 'history' && <HistoryTab F={F} owner={owner} onSlots={onSlots} onDelete={onDelete} />}
      </div>
      {tab === 'season' && !off && <LeagueTicker F={F} />}
    </div>
  )
}

// ── The band under the header: the record, where it stands, the team's OVR and grades, chemistry ────────────
function Band({ F, r }) {
  const st = strength(F, F.team)
  const s = F.streak ?? 0
  const S = useMemo(() => standings(F), [F, F.wk, F.phase]) // eslint-disable-line react-hooks/exhaustive-deps
  const div = DIV_OF[F.team], place = S.div[div].indexOf(F.team) + 1
  return (
    <section className="fh-band">
      <div className="fh-band-rec">
        <BigRec w={r.w} l={r.l} t={r.t} size={64} />
        <span className="fh-band-place">
          <b>{ORD(place)}</b><small>{div.toUpperCase()}</small>
          {Math.abs(s) >= 2 && <Tag tone={s > 0 ? 'w' : 'l'}>{s > 0 ? 'WON' : 'LOST'} {Math.abs(s)}</Tag>}
        </span>
      </div>
      <div className="fh-band-nums">
        <Fact v={st.ovr} label="TEAM OVR" size={30} />
        <Fact v={sideGrade(st.off)} label="OFFENSE" size={30} />
        <Fact v={sideGrade(st.def)} label="DEFENSE" size={30} />
      </div>
      <Meter label="CHEMISTRY" v={F.chem} team={F.team} />
    </section>
  )
}

// ── SEASON ───────────────────────────────────────────────────────────────────
function Season({ F, act, owner, r, play, simToEnd, onBoard, onTrophy }) {
  const ph = F.phase
  return (
    <>
      {ph === 'season' && F.ev && <EventCard key={`${F.year}-${F.wk}-${F.ev.id}`} F={F} act={act} owner={owner} />}
      {ph === 'season' && !F.ev && <ThisWeek F={F} owner={owner} play={play} simToEnd={simToEnd} />}
      {ph === 'post' && <SeasonOver F={F} act={act} r={r} />}
      {ph === 'playoffs' && <PlayoffCard F={F} act={act} play={play} owner={owner} />}
      {ph === 'done' && <Champions F={F} act={act} onTrophy={onTrophy} />}
      {(ph === 'season' || ph === 'post') && F.log.length > 0 && <LastWeek F={F} />}
      {(ph === 'season' || ph === 'post') && <Strip F={F} />}
      {(ph === 'season' || ph === 'post') && <Ladder F={F} />}
      {ph !== 'done' && (
        <button className="fh-row fh-scout" onClick={onBoard}>
          <span><small>DRAFT BOARD</small><b>SCOUT THE {F.year + 1} CLASS</b></span>
          <span className="fh-scout-pts"><b>{F.sp}</b><small>SCOUT PTS</small></span>
        </button>
      )}
      <GamesSwitch F={F} act={act} />
    </>
  )
}

// ── This week: the matchup, told like the broadcast's preview ───────────────
function ThisWeek({ F, owner, play, simToEnd }) {
  const wk = mySchedule(F)[F.wk]
  const R = records(F)
  const S = useMemo(() => standings(F), [F, F.wk]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!wk) return null
  if (wk.bye) {
    return (
      <section className="fh-week">
        <Chyron team={F.team} tag={`WK ${F.wk + 1}`} title="Bye week" sub={`${recText(R[F.team])} · BACK IN WEEK ${F.wk + 2}`} />
        <div className="fh-go"><Go onClick={play}>ON TO WEEK {F.wk + 2}</Go></div>
      </section>
    )
  }
  const a = wk.home ? wk.opp : F.team, h = wk.home ? F.team : wk.opp
  const line = lineOf(F, a, h)
  const divGame = DIV_OF[wk.opp] === DIV_OF[F.team]
  const placeOf = s => { const d = DIV_OF[s]; return `${ORD(S.div[d].indexOf(s) + 1)} ${d.toUpperCase()}` }
  const sa = strength(F, a), sh = strength(F, h)
  const ppg = s => { const x = R[s], g = x.w + x.l + x.t; return g ? [x.pf / g, x.pa / g] : null }
  const pa = ppg(a), ph = ppg(h)
  return (
    <section className="fh-week">
      <Chyron team={F.team} tag={`WK ${F.wk + 1}`} title={`${TEAM[a].nick} at ${TEAM[h].nick}`} sub={divGame ? `${DIV_OF[F.team].toUpperCase()} GAME` : CONF_OF[a] === CONF_OF[h] ? `${CONF_OF[a]} GAME` : 'INTERCONFERENCE GAME'} />
      <Versus a={a} h={h} recA={R[a]} recH={R[h]} subA={placeOf(a)} subH={placeOf(h)} foot={<><span>{line.text}</span><span>O/U {line.total}</span></>} />
      <div className="fh-tape">
        <Tape label="OFFENSE" a={sa.off} h={sh.off} fa={sideGrade(sa.off)} fh={sideGrade(sh.off)} teamA={a} teamH={h} />
        <Tape label="DEFENSE" a={sa.def} h={sh.def} fa={sideGrade(sa.def)} fh={sideGrade(sh.def)} teamA={a} teamH={h} />
        {pa && ph && <Tape label="POINTS / GAME" a={pa[0]} h={ph[0]} fa={pa[0].toFixed(1)} fh={ph[0].toFixed(1)} teamA={a} teamH={h} />}
        {pa && ph && <Tape label="ALLOWED / GAME" a={pa[1]} h={ph[1]} fa={pa[1].toFixed(1)} fh={ph[1].toFixed(1)} teamA={a} teamH={h} lower />}
      </div>
      <KeyPlayers F={F} owner={owner} teams={[a, h]} />
      <div className="fh-go">
        <Go onClick={play} sub={`${wk.home ? 'VS' : 'AT'} ${TEAM[wk.opp].short}`}>PLAY WEEK {F.wk + 1}</Go>
        {F.wk < REG_WEEKS - 1 && <Go ghost onClick={simToEnd}>SIM TO THE PLAYOFFS</Go>}
      </div>
    </section>
  )
}
// two men a side the broadcast puts up: the quarterback and the best of the rest (the player's builds first on his own team)
function keyMen(F, s) {
  const L = Object.values(startersOf(F, s)).filter(p => !p.in)
  const qb = L.find(p => p.p === 'qb')
  const rest = L.filter(p => p !== qb).sort((x, y) => (s === F.team ? (y.b != null) - (x.b != null) : 0) || y.o - x.o)
  const first = s === F.team && rest[0]?.b != null && (!qb || qb.b == null) ? rest[0] : qb ?? rest[0]
  return [first, [qb, ...rest].find(p => p && p !== first) ?? null].filter(Boolean)
}
function KeyPlayers({ F, owner, teams }) {
  const tot = useMemo(() => { try { return leagueStats(F) } catch { return {} } }, [F, F.wk, F.po?.rd]) // eslint-disable-line react-hooks/exhaustive-deps
  const R = records(F)[F.team]
  const played = R.w + R.l + R.t > 0
  return (
    <div className="fh-keys">
      {teams.map(s => (
        <div key={s} className="fh-keys-side">
          <Chyron team={s} size="s" title={`${TEAM[s].nick} to watch`} />
          {keyMen(F, s).map((p, i) => <ManL3 key={p.i} F={F} p={p} team={s} owner={owner} size="s" delay={i * 60} line={played ? statLine(p, tot[String(p.i)] ?? {}) : null} />)}
        </div>
      ))}
    </div>
  )
}

// ── Last week: the final and the line under it ───────────────────────────────
function LastWeek({ F }) {
  const g = F.log[F.log.length - 1]
  const a = g.home ? g.opp : F.team, h = g.home ? F.team : g.opp
  const as = g.home ? g.them : g.us, hs = g.home ? g.us : g.them
  return (
    <section className="fh-last">
      <Chyron tone="ink" size="s" tag={g.wk ? `WK ${g.wk}` : 'LAST'} title="Last week" right={<Stamp kind={g.w ? 'w' : g.t ? 't' : 'l'} quiet>{g.w ? 'W' : g.t ? 'T' : 'L'}</Stamp>} />
      <Scorebug a={a} h={h} as={as} hs={hs} final={g.ot ? 'F/OT' : 'FINAL'} />
      {g.sub && <p className="fh-last-sub">{g.sub}</p>}
    </section>
  )
}
// the schedule as logos that turn W/L as the season goes
export function Strip({ F }) {
  const sch = mySchedule(F)
  const box = useRef(null)
  // (this week in view: the two weeks before it show on the left)
  useEffect(() => { const el = box.current; if (el) el.scrollLeft = Math.max(0, (Math.min(F.wk, sch.length - 1) - 2) * 61) }, [F.wk]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="fh-strip-wrap">
      <Chyron tone="ink" size="s" title={`${F.year} schedule`} />
      <div ref={box} className="fh-strip" aria-label="Schedule">
        {sch.map((g, i) => {
          const res = g.us == null ? null : g.us > g.them ? 'w' : g.us < g.them ? 'l' : 't'
          return (
            <span key={i} className={`fh-wk${res ? ` is-${res}` : ''}${i === F.wk && F.phase === 'season' ? ' is-now' : ''}${g.bye ? ' is-bye' : ''}`}>
              <small>{g.wk}</small>
              {g.bye ? <em>BYE</em> : <span className="fh-wk-logo"><i>{g.home ? '' : '@'}</i><KLogo s={g.opp} size={26} /></span>}
              <b>{res ? `${res.toUpperCase()} ${g.us}-${g.them}` : g.bye ? '' : TEAM[g.opp].short}</b>
            </span>
          )
        })}
      </div>
    </section>
  )
}
// a division: four teams in order (League.jsx shows every division with it)
export function Ladder({ F, div = DIV_OF[F.team], title = null }) {
  const S = useMemo(() => standings(F), [F, F.wk, F.phase]) // eslint-disable-line react-hooks/exhaustive-deps
  const list = S.div[div]
  return (
    <section className="fh-ladder">
      <Chyron tone="ink" size="s" title={title ?? div} />
      {list.map((s, i) => (
        <div key={s} className={`fh-rung${s === F.team ? ' is-me' : ''}`} style={fkVars(s)}>
          <i>{i + 1}</i><KLogo s={s} size={30} /><b>{TEAM[s].nick.toUpperCase()}</b><span>{recText(S.R[s])}</span>
        </div>
      ))}
    </section>
  )
}

// ── An event: a headline and two big answers, each showing what it does ─────
function EventCard({ F, act, owner }) {
  const ev = F.ev
  const [done, setDone] = useState(null)
  const pick = i => { if (done) return; setDone({ i }); sfx(i === 0 ? 'claim' : 'tap'); haptic('medium'); setTimeout(() => act(X => chooseEvent(X, i)), 650) }
  const mine = F.teams[F.team].r.find(p => p.i === ev.pid)
  const who = ev.pid == null ? null : mine ?? (ev.team ? F.teams[ev.team]?.r.find(p => p.i === ev.pid) : null) ?? (F.fa ?? []).find(p => p.i === ev.pid)
  return (
    <section className="fh-event">
      <Chyron team={F.team} tag={`WK ${F.wk + 1}`} title="Front office" />
      <h2 className="fh-event-title">{ev.title}</h2>
      {who && <ManL3 F={F} p={who} team={mine ? F.team : ev.team ?? null} owner={owner} />}
      <div className="fh-event-opts">
        {[ev.a, ev.b].map(([label], i) => (
          <button key={i} className={`fh-opt${done ? (done.i === i ? ' is-picked' : ' is-dim') : ''}`} onClick={() => pick(i)} disabled={!!done}>
            <b>{label}</b>
            <span className="fh-fx">{fxList(F, ev, i).map(([n, d]) => <i key={n} className={`is-${d}`}>{n}</i>)}</span>
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
  const won = S.div[DIV_OF[F.team]][0] === F.team
  return (
    <section className="fh-week">
      <Chyron team={F.team} tag={F.year} title="Regular season final" sub={seed ? `${c} · ${seed} SEED${won ? ` · ${DIV_OF[F.team].toUpperCase()} CHAMPIONS` : ''}` : 'OUT OF THE PLAYOFFS'} />
      <div className="fh-final-rec">
        <BigRec w={r.w} l={r.l} t={r.t} size={96} />
        {seed ? <Stamp kind="w" big delay={300}>{seed === 1 ? 'BYE' : 'CLINCHED'}</Stamp> : <Stamp kind="l" big delay={300}>OUT</Stamp>}
      </div>
      <div className="fh-go">
        <Go onClick={() => { const inIt = act(X => intoPlayoffs(X)); if (!inIt) act(X => simPlayoffs(X)); sfx('whistle') }}>{seed ? 'TO THE PLAYOFFS' : 'FINISH THE SEASON'}</Go>
      </div>
    </section>
  )
}
const seedOf = (F, s) => F.po.seeds[CONF_OF[s]].indexOf(s) + 1
function PlayoffCard({ F, act, play, owner }) {
  const po = F.po, alive = userAlive(F), bye = userBye(F)
  const g = po.rounds[po.rd].find(x => x.h === F.team || x.a === F.team)
  const sb = po.rd === 3
  const R = records(F)
  return (
    <>
      <section className="fh-week">
        <Chyron team={sb ? null : F.team} tone={sb ? 'gold' : 'team'} tag={sb ? romanOf(F.year - 1965) : 'PLAYOFFS'} title={roundName(F, po.rd)} sub={alive && g ? (sb ? 'NEUTRAL SITE' : `AT ${TEAM[g.h].name.toUpperCase()}`) : bye ? '1 SEED · FIRST-ROUND BYE' : FINISH_TEXT[finishOf(F, F.team)]} />
        {alive && g && (
          <>
            <Versus a={g.a} h={g.h} mid={sb ? 'VS' : 'AT'} recA={R[g.a]} recH={R[g.h]} subA={`${CONF_OF[g.a]} · ${seedOf(F, g.a)} SEED`} subH={`${CONF_OF[g.h]} · ${seedOf(F, g.h)} SEED`} foot={(() => { const l = lineOf(F, g.a, g.h, sb); return <><span>{l.text}</span><span>O/U {l.total}</span></> })()} />
            <KeyPlayers F={F} owner={owner} teams={[g.a, g.h]} />
          </>
        )}
        <div className="fh-go">
          {alive && g && <Go onClick={play}>PLAY THE {sb ? 'SUPER BOWL' : po.rd === 2 ? `${CONF_OF[F.team]} CHAMPIONSHIP` : `${ROUNDS[po.rd]} ROUND`}</Go>}
          {alive && bye && <Go onClick={play}>SIM THE WILD CARD ROUND</Go>}
          {!alive && <Go onClick={() => { act(X => simPlayoffs(X)); sfx('flip') }}>SIM THE REST OF THE PLAYOFFS</Go>}
        </div>
      </section>
      <PoBracket F={F} />
    </>
  )
}
// The bracket: each conference's rounds as logo against logo with the seeds, the winner lit; the Super Bowl last
function BrSide({ F, s, sc, win, done }) {
  return (
    <span className={`fh-br-side${s === F.team ? ' is-me' : ''}${done ? (win ? ' is-win' : ' is-out') : ''}`} style={fkVars(s)}>
      <i>{seedOf(F, s)}</i><KLogo s={s} size={22} /><b>{TEAM[s].short}</b><strong>{sc ?? ''}</strong>
    </span>
  )
}
function BrGame({ F, g }) {
  const done = g.hs != null
  return <div className="fh-br-game"><BrSide F={F} s={g.a} sc={g.as} win={g.as > g.hs} done={done} /><BrSide F={F} s={g.h} sc={g.hs} win={g.hs > g.as} done={done} /></div>
}
export function PoBracket({ F }) {
  const po = F.po
  if (!po) return null
  return (
    <section className="fh-bracket">
      <Chyron tone="ink" size="s" title={`${F.year} playoffs`} />
      {CONFS.map(c => (
        <div key={c} className="fh-br-conf">
          <span className="fh-br-label">{c}</span>
          <div className="fh-br-rounds">
            {[0, 1, 2].map(rd => (
              <div key={rd} className={`fh-br-round${rd === po.rd && !po.champ ? ' is-now' : ''}`}>
                <small>{rd === 2 ? 'TITLE GAME' : ROUNDS[rd]}</small>
                {rd === 0 && <div className="fh-br-game is-bye"><BrSide F={F} s={po.seeds[c][0]} /><em>BYE</em></div>}
                {(po.rounds[rd] ?? []).filter(g => g.c === c).map((g, i) => <BrGame key={i} F={F} g={g} />)}
                {!po.rounds[rd] && Array.from({ length: [3, 2, 1][rd] }, (_, i) => <div key={i} className="fh-br-game is-tbd"><span /><span /></div>)}
              </div>
            ))}
          </div>
        </div>
      ))}
      {po.rounds[3] && (
        <div className="fh-br-sb">
          <span className="fh-br-label is-gold">{sbName(F)}</span>
          {po.rounds[3].map((g, i) => <BrGame key={i} F={F} g={g} />)}
        </div>
      )}
    </section>
  )
}
function Champions({ F, act, onTrophy }) {
  const c = F.po.champ, mine = c === F.team
  const g = F.po.rounds[3]?.[0]
  return (
    <section className="fh-week fh-champ">
      <Chyron tone="gold" size="l" tag={romanOf(F.year - 1965)} title={sbName(F)} sub={`${TEAM[c].name.toUpperCase()} · ${F.year} CHAMPIONS`} />
      {g && <Scorebug a={g.a} h={g.h} as={g.as} hs={g.hs} final={g.ot ? 'F/OT' : 'FINAL'} label="SB" />}
      <div className="fh-champ-team">
        <TeamSlab s={c} size="l" rec={records(F)[c]} sub={`BEAT THE ${TEAM[F.po.runner].nick.toUpperCase()} ${F.po.score}`} />
        <Stamp kind="gold" big delay={250}>CHAMPIONS</Stamp>
      </div>
      <div className="fh-go">
        {mine && <Go ghost onClick={onTrophy}>THE TROPHY</Go>}
        <Go onClick={() => { act(X => closeSeason(X)); sfx('award') }}>TO THE OFFSEASON</Go>
      </div>
    </section>
  )
}

// ── ADVANCED / SIMPLE / NONE for the moments ────────────────────────────────
function GamesSwitch({ F, act }) {
  const mode = F.games ?? 'advanced'
  return (
    <section className="fh-games">
      <span className="fh-games-label">KEY MOMENTS</span>
      <div className="fh-seg" role="radiogroup" aria-label="Mini games">
        {GAMES_MODES.map(([m, label]) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'is-on' : ''} onClick={() => { if (m !== mode) { act(X => { X.games = m }); sfx('tap') } }}>{label}</button>
        ))}
      </div>
    </section>
  )
}

// ── The league along the bottom edge ─────────────────────────────────────────
function LeagueTicker({ F }) {
  const items = useMemo(() => { try { const x = tickerItems(F); return x?.length ? x : leagueWire(F) } catch { return leagueWire(F) } }, [F, F.wk, F.phase, F.po?.rd]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length) return null
  return <div className="fh-tick"><Ticker items={items} label={F.phase === 'playoffs' || F.phase === 'done' ? 'PLAYOFFS' : F.wk > 0 ? `WEEK ${Math.min(F.wk, REG_WEEKS)}` : 'AROUND THE LEAGUE'} /></div>
}
