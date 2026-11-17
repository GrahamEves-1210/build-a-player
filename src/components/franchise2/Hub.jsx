import { lazy, Suspense, useRef, useEffect, useState } from 'react'
import {
  TEAM, recText, strength, sideGrade, mySchedule, playWeek, simWeeks, chooseEvent, intoPlayoffs, simPlayoffs, userAlive, userBye,
  DIV_OF, ROUNDS, FINISH_TEXT, finishOf, REG_WEEKS, CONF_OF, CONFS,
} from '../../lib/franchise2'
import { closeSeason, statLine } from '../../lib/franchise2/awards'
import { fxList, lineOf, leagueWire } from '../../lib/franchise2/season'
import { startersOf } from '../../lib/franchise2/roster'
import { leagueStats } from '../../lib/franchise2/stats'
import { depthChart } from '../../lib/franchise2'
import { staffMen } from '../../lib/franchise2/coach'
import { tickerItems } from '../../lib/franchise2/news'
import { scoutsLeft, draftNews } from '../../lib/franchise2/draft'
import { GAMES } from '../../lib/minigames'
import { SIMPLE_GAMES } from '../../lib/minigamesSimple'
import { romanOf } from '../../lib/mg/kit'
import { sfx, haptic } from '../../lib/juice'
import { IconClose } from '../app/icons'
import { GamesSwitch as MomentsModes } from '../simFlow'
import { fkVars, KLogo, Chyron, Ticker, Scorebug, ManL3, BigRec, Stamp, TeamSlab, Tape, Go, Fold } from './kit'
import Gameday, { GameBoxSheet } from './Week'
import TeamTab from './Team'
import LeagueTab from './League'
import HistoryTab from './History'
import Offseason from './Offseason'
import DraftBoard from './Draft'
import { faceFor } from './dparts'
import { coachPhoto } from './coachFace'
import { memoF, peekF, idleRun, standingsOf, recordsOf, useLeagueWarm, warmKey, useStaged } from './perf'
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
const ORD = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
const TABS = [['season', 'Season'], ['team', 'Team'], ['league', 'League'], ['history', 'History']]
// (a wide screen: the season's extras open from the start; a phone keeps them one tap away)
const wide = () => { try { return window.matchMedia('(min-width: 900px)').matches } catch { return false } }
// the Team tab's faces drawn ahead while the hub sits idle (each drawn face is built once, then kept: faces.js), so
// the depth chart opens on faces already made
function useTeamFacesWarm(F) {
  useEffect(() => {
    const steps = []
    try {
      const C = depthChart(F, F.team), L = startersOf(F, F.team)
      const on = new Set(Object.values(L).map(p => p.i))
      for (const k of Object.keys(C)) for (const p of C[k]) steps.push(() => faceFor(F, p, F.team, !on.has(p.i)))
      const M = staffMen(F, F.team)
      for (const k of ['hc', 'oc', 'dc']) if (M?.[k]) steps.push(() => coachPhoto(M[k], F.team, true))
    } catch { return undefined }
    return idleRun(steps)
  }, [F])
}

// THE HUB: the team's header, four tabs, and the tab's screen. SEASON leads with the one thing to do next (the
// week's game, a front-office call, the playoffs, the offseason's current step); everything else sits beside it
// on a wide screen or under it on a phone.
export default function Hub({ F, act, owner, onHome, onSlots, onDelete, onBuild }) {
  const [tab, setTab] = useState('season')
  const [live, setLive] = useState(() => (F.pend ? { pend: true } : null))   // a game on screen
  const [trophy, setTrophy] = useState(false)
  const [board, setBoard] = useState(false)
  const scroll = useRef(null)
  const t = TEAM[F.team]
  const r = recordsOf(F)[F.team]
  const off = F.phase === 'off'
  useTeamFacesWarm(F)

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
  const phaseText = F.phase === 'season' ? `Week ${F.wk + 1}` : F.phase === 'post' ? 'Regular season over' : F.phase === 'playoffs' ? 'Playoffs' : off ? 'Offseason' : 'Season over'
  const toTab = id => { if (tab !== id) { setTab(id); sfx('tap'); scroll.current?.scrollTo(0, 0) } }

  return (
    <div className="ag-screen f2 fk fk-root fh" style={fkVars(F.team)}>
      {live && <Gameday F={F} act={act} start={live} onDone={after} owner={owner} />}
      {trophy && <Suspense fallback={null}><TrophyScene team={{ name: t.name, color: t.color, color2: t.color2, short: t.short }} title={`${sbName(F)} CHAMPIONS`} line={`${F.year} · ${recText(r)}`} onDone={() => setTrophy(false)} /></Suspense>}
      {board && <DraftBoard F={F} act={act} onClose={() => setBoard(false)} />}
      <div ref={scroll} className="fh-scroll">
        <header className="fh-top">
          <span className="fh-top-logo"><KLogo s={F.team} size={36} /></span>
          <span className="fh-top-txt">
            <b>{t.name}</b>
            <small>{F.year} · {phaseText}{F.sandbox && <em className="fh-sandbox">Sandbox</em>}</small>
          </span>
          <button className="fh-x" onClick={onHome} aria-label="Leave Franchise"><IconClose size={16} /><span>Exit</span></button>
        </header>
        {/* (the league's ticker and its week: at the top, under the team, owner 2026-11-16) */}
        {tab === 'season' && !off && <LeagueTicker F={F} />}
        <nav className="fh-tabs" role="tablist" aria-label="Franchise">
          <div className="fh-tabs-in">
            {TABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => toTab(id)}>{id === 'season' && off ? 'Offseason' : label}</button>
            ))}
          </div>
        </nav>
        <div className={`ag-screen-body fh-body fh-body--${tab}`}>
          {tab === 'season' && (off
            ? <Offseason F={F} act={act} owner={owner} onBuild={onBuild} foot={F.stage !== 'draft' ? <ScoutRow F={F} onBoard={() => { setBoard(true); sfx('tap') }} /> : null} />
            : <Season F={F} act={act} owner={owner} r={r} play={play} simToEnd={simToEnd} onBoard={() => { setBoard(true); sfx('tap') }} onTrophy={() => setTrophy(true)} />)}
          {tab === 'team' && <TeamTab F={F} act={act} owner={owner} />}
          {tab === 'league' && <LeagueTab F={F} owner={owner} act={act} />}
          {tab === 'history' && <HistoryTab F={F} owner={owner} act={act} onSlots={onSlots} onDelete={onDelete} />}
        </div>
      </div>
    </div>
  )
}

// ── SEASON ───────────────────────────────────────────────────────────────────
// The next thing to do first and biggest; on a wide screen the league around it on the right.
function Season({ F, act, owner, r, play, simToEnd, onBoard, onTrophy }) {
  const ph = F.phase
  const reg = ph === 'season' || ph === 'post'
  const side = useStaged(2, 1) > 1
  return (
    <div className="fh-grid">
      <div className="fh-main">
        {ph === 'season' && F.ev && <EventCard key={`${F.year}-${F.wk}-${F.ev.id}`} F={F} act={act} owner={owner} />}
        {ph === 'season' && !F.ev && <ThisWeek F={F} owner={owner} play={play} simToEnd={simToEnd} />}
        {ph === 'post' && <SeasonOver F={F} act={act} r={r} />}
        {ph === 'playoffs' && <PlayoffCard F={F} act={act} play={play} owner={owner} />}
        {ph === 'done' && <Champions F={F} act={act} onTrophy={onTrophy} />}
        {reg && <Glance F={F} r={r} />}
        {ph === 'season' && !F.ev && <MatchupMore F={F} owner={owner} />}
        {(ph === 'playoffs' || ph === 'done') && <PoBracket F={F} />}
      </div>
      <aside className="fh-side">
        {/* (the side column a frame after the game: the next thing to do is on screen first) */}
        {side && (
          <>
            {reg && F.log.length > 0 && <LastWeek F={F} owner={owner} />}
            {reg && <Ladder F={F} />}
            {reg && <Strip F={F} />}
            <ScoutRow F={F} onBoard={onBoard} />
            <GamesSwitch F={F} act={act} />
          </>
        )}
      </aside>
    </div>
  )
}

// the scouting room: the draft board and the days the scouts have left (open all year: the spring's combine, visits
// and pro days are in it after the Super Bowl)
export function ScoutRow({ F, onBoard }) {
  const n = scoutsLeft(F)
  return (
    <button className="fh-row fh-scout" onClick={onBoard}>
      <span><small>Draft board</small><b>Scout the {F.year + 1} class</b></span>
      <span className="fh-scout-pts"><b>{n}</b><small>{n === 1 ? 'day left' : 'days left'}</small></span>
      <i className="fh-row-go" aria-hidden="true">›</i>
    </button>
  )
}

// ── The record, the team's rating and chemistry: three facts under the game ──
function Glance({ F, r }) {
  const st = strength(F, F.team)
  const s = F.streak ?? 0
  const S = standingsOf(F)
  const div = DIV_OF[F.team], place = S.div[div].indexOf(F.team) + 1
  return (
    <section className="fh-glance" aria-label={TEAM[F.team].nick}>
      <span><small>Record</small><b>{recText(r)}</b><em>{ORD(place)} in the {div}{Math.abs(s) >= 2 ? ` · ${s > 0 ? 'won' : 'lost'} ${Math.abs(s)}` : ''}</em></span>
      <span><small>Team OVR</small><b>{st.ovr}</b><em>Offense {sideGrade(st.off)} · Defense {sideGrade(st.def)}</em></span>
      <span><small>Chemistry</small><b>{Math.round(F.chem ?? 0)}</b><em>out of 100</em></span>
    </section>
  )
}

// ── This week: the game and the button ──────────────────────────────────────
const favText = l => (l.fav ? `${TEAM[l.fav].nick} favored by ${l.pts}` : 'Even game')
function ThisWeek({ F, play, simToEnd }) {
  const wk = mySchedule(F)[F.wk]
  const R = recordsOf(F)
  const S = standingsOf(F)
  if (!wk) return null
  const sim = F.wk < REG_WEEKS - 1 && <button type="button" className="fh-textbtn" onClick={simToEnd}>Sim to the playoffs</button>
  if (wk.bye) {
    return (
      <section className="fh-next">
        <div className="fh-next-h"><b>Week {F.wk + 1}</b><span>Bye week</span></div>
        <p className="fh-next-note">No game this week. Back on the field in Week {F.wk + 2}.</p>
        <div className="fh-go"><Go onClick={play}>On to Week {F.wk + 2}</Go>{sim}</div>
      </section>
    )
  }
  const a = wk.home ? wk.opp : F.team, h = wk.home ? F.team : wk.opp
  const divGame = DIV_OF[wk.opp] === DIV_OF[F.team]
  // (a place in the division only once games are played: at 0-0 nobody is 4th)
  const placeOf = s => { const d = DIV_OF[s], r = S.R?.[s]; return r && r.w + r.l + r.t > 0 ? `${ORD(S.div[d].indexOf(s) + 1)} ${d}` : d }
  const kind = divGame ? 'Division game' : CONF_OF[a] === CONF_OF[h] ? `${CONF_OF[a]} game` : 'Interconference game'
  return (
    <section className="fh-next">
      <div className="fh-next-h"><b>Week {F.wk + 1}</b><span>{kind} · {wk.home ? 'Home' : 'Away'}</span></div>
      <Matchup a={a} h={h} R={R} subA={placeOf(a)} subH={placeOf(h)} me={F.team} />
      <p className="fh-line">{favText(lineOf(F, a, h))}</p>
      <div className="fh-go">
        <Go onClick={play}>Play Week {F.wk + 1}</Go>
        {sim}
      </div>
    </section>
  )
}
// two teams side by side: away on the left, home on the right (the broadcast's order)
function Matchup({ a, h, R, subA, subH, mid = 'at', me }) {
  const side = (s, sub) => (
    <div className={`fh-mu-t${s === me ? ' is-me' : ''}`} style={fkVars(s)}>
      <KLogo s={s} size={56} />
      <b>{TEAM[s].nick}</b>
      <span>{recText(R[s])}</span>
      {sub && <small>{sub}</small>}
    </div>
  )
  return <div className="fh-mu">{side(a, subA)}<span className="fh-mu-mid">{mid}</span>{side(h, subH)}</div>
}
// under the game: how the teams compare, and the men to watch
function MatchupMore({ F, owner }) {
  const wk = mySchedule(F)[F.wk]
  if (!wk || wk.bye) return null
  const a = wk.home ? wk.opp : F.team, h = wk.home ? F.team : wk.opp
  return (
    <>
      <Compare F={F} a={a} h={h} />
      <Fold title="Players to watch" open={wide()}><KeyPlayers F={F} owner={owner} teams={[a, h]} /></Fold>
    </>
  )
}
function Compare({ F, a, h }) {
  const R = recordsOf(F)
  const sa = strength(F, a), sh = strength(F, h)
  const ppg = s => { const x = R[s], g = x.w + x.l + x.t; return g ? [x.pf / g, x.pa / g] : null }
  const pa = ppg(a), ph = ppg(h)
  return (
    <section className="fh-cmp">
      <div className="fh-cmp-h"><span style={fkVars(a)}><KLogo s={a} size={24} />{TEAM[a].short}</span><b>How they compare</b><span style={fkVars(h)}>{TEAM[h].short}<KLogo s={h} size={24} /></span></div>
      <Tape label="Team OVR" a={sa.off + sa.def} h={sh.off + sh.def} fa={sa.ovr} fh={sh.ovr} teamA={a} teamH={h} />
      <Tape label="Offense" a={sa.off} h={sh.off} fa={sideGrade(sa.off)} fh={sideGrade(sh.off)} teamA={a} teamH={h} />
      <Tape label="Defense" a={sa.def} h={sh.def} fa={sideGrade(sa.def)} fh={sideGrade(sh.def)} teamA={a} teamH={h} />
      {pa && ph && <Tape label="Points a game" a={pa[0]} h={ph[0]} fa={pa[0].toFixed(1)} fh={ph[0].toFixed(1)} teamA={a} teamH={h} />}
      {pa && ph && <Tape label="Allowed a game" a={pa[1]} h={ph[1]} fa={pa[1].toFixed(1)} fh={ph[1].toFixed(1)} teamA={a} teamH={h} lower />}
    </section>
  )
}
// two men a side the broadcast puts up: the quarterback and the best of the rest (the player's builds first on his own team)
function keyMen(F, s) {
  const L = Object.values(startersOf(F, s)).filter(p => !p.in && (p.p !== 'k' || p.b != null))
  const qb = L.find(p => p.p === 'qb')
  const rest = L.filter(p => p !== qb).sort((x, y) => (s === F.team ? (y.b != null) - (x.b != null) : 0) || y.o - x.o)
  const first = s === F.team && rest[0]?.b != null && (!qb || qb.b == null) ? rest[0] : qb ?? rest[0]
  return [first, [qb, ...rest].find(p => p && p !== first) ?? null].filter(Boolean)
}
function KeyPlayers({ F, owner, teams }) {
  // (each man's line once the league's boxes are in: useLeagueWarm)
  const ready = useLeagueWarm(F)
  const tot = ready ? memoF(F, 'lstats', warmKey(F), () => { try { return leagueStats(F) } catch { return {} } }) : null
  const R = recordsOf(F)[F.team]
  const played = R.w + R.l + R.t > 0 && !!tot
  return (
    <div className="fh-keys">
      {teams.map(s => (
        <div key={s} className="fh-keys-side">
          <span className="fh-keys-h" style={fkVars(s)}><KLogo s={s} size={22} />{TEAM[s].nick}</span>
          {keyMen(F, s).map((p, i) => <ManL3 key={p.i} F={F} p={p} team={s} owner={owner} size="s" delay={i * 60} line={played ? statLine(p, tot[String(p.i)] ?? {}) : null} />)}
        </div>
      ))}
    </div>
  )
}

// ── Last week: the final and the line under it ───────────────────────────────
function LastWeek({ F, owner }) {
  const g = F.log[F.log.length - 1]
  const [box, setBox] = useState(false)
  const a = g.home ? g.opp : F.team, h = g.home ? F.team : g.opp
  const as = g.home ? g.them : g.us, hs = g.home ? g.us : g.them
  return (
    <section className="fh-last">
      <h3 className="fh-h"><b>Last week</b><span className={`fh-res is-${g.w ? 'w' : g.t ? 't' : 'l'}`}>{g.w ? 'Win' : g.t ? 'Tie' : 'Loss'}</span></h3>
      <Scorebug a={a} h={h} as={as} hs={hs} final={g.ot ? 'F/OT' : 'FINAL'} />
      {g.sub && <p className="fh-last-sub">{g.sub}</p>}
      {g.bx && <button type="button" className="fh-textbtn" onClick={() => { setBox(true); sfx('tap') }}>Box score</button>}
      {box && <GameBoxSheet F={F} row={g} owner={owner} portal onClose={() => setBox(false)} />}
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
      <h3 className="fh-h"><b>{F.year} schedule</b></h3>
      <div ref={box} className="fh-strip" aria-label="Schedule">
        {sch.map((g, i) => {
          const res = g.us == null ? null : g.us > g.them ? 'w' : g.us < g.them ? 'l' : 't'
          return (
            <span key={i} className={`fh-wk${res ? ` is-${res}` : ''}${i === F.wk && F.phase === 'season' ? ' is-now' : ''}${g.bye ? ' is-bye' : ''}`}>
              <small>{i === F.wk && F.phase === 'season' ? 'Next' : `Wk ${g.wk}`}</small>
              {g.bye ? <em>BYE</em> : <span className="fh-wk-logo"><i>{g.home ? 'vs' : '@'}</i><KLogo s={g.opp} size={26} /></span>}
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
  const S = standingsOf(F)
  const list = S.div[div]
  return (
    <section className="fh-ladder">
      <h3 className="fh-h"><b>{title ?? div}</b><span>W-L</span></h3>
      {list.map((s, i) => (
        <div key={s} className={`fh-rung${s === F.team ? ' is-me' : ''}`} style={fkVars(s)}>
          <i>{i + 1}</i><KLogo s={s} size={28} /><b>{TEAM[s].nick}</b><span>{recText(S.R[s])}</span>
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
    <section className="fh-next fh-event">
      <div className="fh-next-h"><b>Week {F.wk + 1}</b><span>Front office · pick one</span></div>
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
  const S = standingsOf(F)
  const c = CONF_OF[F.team], seed = S.seeds[c].indexOf(F.team) + 1
  const won = S.div[DIV_OF[F.team]][0] === F.team
  return (
    <section className="fh-next">
      <div className="fh-next-h"><b>Regular season final</b><span>{F.year}</span></div>
      <div className="fh-final-rec">
        <BigRec w={r.w} l={r.l} t={r.t} size={84} />
        {seed ? <Stamp kind="w" big delay={300}>{seed === 1 ? 'BYE' : 'IN'}</Stamp> : <Stamp kind="l" big delay={300}>OUT</Stamp>}
      </div>
      <p className="fh-next-note">{seed ? `${c} ${ORD(seed)} seed${won ? ` · ${DIV_OF[F.team]} champions` : ''}${seed === 1 ? ' · first-round bye' : ''}` : 'Out of the playoffs'}</p>
      <div className="fh-go">
        <Go onClick={() => { const inIt = act(X => intoPlayoffs(X)); if (!inIt) act(X => simPlayoffs(X)); sfx('whistle') }}>{seed ? 'On to the playoffs' : 'Finish the season'}</Go>
      </div>
    </section>
  )
}
const seedOf = (F, s) => F.po.seeds[CONF_OF[s]].indexOf(s) + 1
function PlayoffCard({ F, act, play, owner }) {
  const po = F.po, alive = userAlive(F), bye = userBye(F)
  const g = po.rounds[po.rd].find(x => x.h === F.team || x.a === F.team)
  const sb = po.rd === 3
  const R = recordsOf(F)
  const l = alive && g ? lineOf(F, g.a, g.h, sb) : null
  return (
    <>
      <section className={`fh-next${sb ? ' is-sb' : ''}`}>
        <div className="fh-next-h"><b>{roundName(F, po.rd)}</b><span>{alive && g ? (sb ? 'Neutral site' : `at ${TEAM[g.h].name}`) : bye ? 'First-round bye' : FINISH_TEXT[finishOf(F, F.team)]}</span></div>
        {alive && g && (
          <>
            <Matchup a={g.a} h={g.h} R={R} mid={sb ? 'vs' : 'at'} subA={`${CONF_OF[g.a]} ${ORD(seedOf(F, g.a))} seed`} subH={`${CONF_OF[g.h]} ${ORD(seedOf(F, g.h))} seed`} me={F.team} />
            <p className="fh-line">{favText(l)}</p>
          </>
        )}
        <div className="fh-go">
          {alive && g && <Go onClick={play}>Play the {sb ? 'Super Bowl' : po.rd === 2 ? `${CONF_OF[F.team]} Championship` : `${ROUNDS[po.rd].toLowerCase()} round`}</Go>}
          {alive && bye && <Go onClick={play}>Sim the wild card round</Go>}
          {!alive && <Go onClick={() => { act(X => simPlayoffs(X)); sfx('flip') }}>Sim the rest of the playoffs</Go>}
        </div>
      </section>
      {alive && g && <Fold title="Players to watch" open={wide()}><KeyPlayers F={F} owner={owner} teams={[g.a, g.h]} /></Fold>}
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
      <h3 className="fh-h"><b>{F.year} playoffs</b></h3>
      {CONFS.map(c => (
        <div key={c} className="fh-br-conf">
          <span className="fh-br-label">{c}</span>
          <div className="fh-br-rounds">
            {[0, 1, 2].map(rd => (
              <div key={rd} className={`fh-br-round${rd === po.rd && !po.champ ? ' is-now' : ''}`}>
                <small>{rd === 2 ? 'Title game' : ROUNDS[rd].toLowerCase()}</small>
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
    <section className="fh-next fh-champ">
      <Chyron tone="gold" size="l" tag={romanOf(F.year - 1965)} title={sbName(F)} sub={`${TEAM[c].name} · ${F.year} champions`} />
      {g && <Scorebug a={g.a} h={g.h} as={g.as} hs={g.hs} final={g.ot ? 'F/OT' : 'FINAL'} label="SB" />}
      <div className="fh-champ-team">
        <TeamSlab s={c} size="l" rec={recordsOf(F)[c]} sub={`BEAT THE ${TEAM[F.po.runner].nick.toUpperCase()} ${F.po.score}`} />
        <Stamp kind="gold" big delay={250}>CHAMPIONS</Stamp>
      </div>
      <div className="fh-go">
        <Go onClick={() => { act(X => closeSeason(X)); sfx('award') }}>On to the offseason</Go>
        {mine && <Go ghost onClick={onTrophy}>See the trophy</Go>}
      </div>
    </section>
  )
}

// ── ADVANCED / SIMPLE / NONE for the moments ── (Career's switch: simFlow.jsx GamesSwitch, in Franchise's kit)
export const GAMES_WHAT = { advanced: 'Call the play and run it', simple: 'Call the play', off: 'Simulated' }
export function GamesSwitch({ F, act }) {
  return (
    <MomentsModes mode={F.games ?? 'advanced'} modes={GAMES_MODES} what={GAMES_WHAT} title="Key moments" sub="the snaps you play in your games"
      onPick={m => act(X => { X.games = m })} cls={{ root: 'fh-games', top: 'fh-games-label', group: 'fh-seg' }} />
  )
}

// ── The league along the top, under the team's header ─────────────────────────────────────────
function LeagueTicker({ F }) {
  // (the reel once the league's week is in; until then the strip with its label, the same size, so nothing moves)
  const ready = useLeagueWarm(F)
  const key = [F.year, F.phase, F.wk, F.po?.rd ?? '', F.stage ?? '', F.news?.length ?? 0, F.ev?.id ?? ''].join('|')
  const last = useRef(null)
  const items = ready || peekF(F, 'tick', key) ? memoF(F, 'tick', key, () => {
    let x
    try { x = tickerItems(F) } catch { x = null }
    if (!x?.length) x = leagueWire(F)
    try { const d = draftNews(F) ?? []; if (d.length) x = [...x.slice(0, 6), ...d, ...x.slice(6)] } catch { /* (no class yet) */ }
    return x
  }) : last.current
  last.current = items
  const label = F.phase === 'playoffs' || F.phase === 'done' ? 'PLAYOFFS' : F.wk > 0 ? `WEEK ${Math.min(F.wk, REG_WEEKS)}` : 'AROUND THE LEAGUE'
  if (!items) return <div className="fh-tick"><div className="fk-tick"><span className="fk-tick-label">{label}</span><div className="fk-tick-win" /></div></div>
  if (!items.length) return null
  return <div className="fh-tick"><Ticker items={items} label={label} /></div>
}
