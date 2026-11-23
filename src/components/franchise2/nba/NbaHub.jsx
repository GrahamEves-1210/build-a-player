import { useEffect, useMemo, useRef, useState } from 'react'
import {
  TEAM, CONF_OF, CONF_NAME, DIV_OF, SHORTS, records, recText, pct, confOrder, gamesBack, streakText, nextMine, myGames, gameNo, dateText,
  playNext, simTo, startPostseason, playPoNight, simPostseason, mySeries, myPoGame, seriesText, ROUND_NAME, closeSeason, teamOvr,
  seasonText, CAP_SIM, nick, FINISH_TEXT, finishOf, nextStep,
} from '../../../lib/franchise2/nba'
import * as NBA from '../../../lib/franchise2/nba'
import { sfx, haptic } from '../../../lib/juice'
import { IconClose } from '../../app/icons'
import { GamesSwitch } from '../../simFlow'
import { LeagueRules } from '../Rules'
import { fkVars, KLogo, Ticker, Scorebug, Stamp, TeamSlab, Go, Fold, Chyron, Banner } from '../kit'
import { GAMES_MODES, GAMES_WHAT, CAP_WHAT, GAMES_CLS } from './NbaSetup'
import { NbaSchedule } from './NbaRoster'
import NbaGame, { NbaBox } from './NbaGame'
import NbaTeam from './NbaTeam'
import NbaLeague from './NbaLeague'
import NbaHistory from './NbaHistory'
import NbaOffseason, { Prospect } from './NbaOffseason'
import { createPortal } from 'react-dom'
import '../season.css'
import '../gameday.css'

const TABS = [['season', 'Season'], ['team', 'Team'], ['league', 'League'], ['history', 'History']]
export const ORD = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
export const money = v => (v == null ? '-' : `$${(Math.round(v * 10) / 10).toFixed(1)}M`)
export const momentOpts = F => ({ moments: (F.moments ?? 'advanced') !== 'off' })

export default function NbaHub({ F, act, owner, onHome, onSlots, onDelete, saveBad, onRetry }) {
  const [tab, setTab] = useState('season')
  const [live, setLive] = useState(() => (F.pend ? { pend: true } : null))
  const [teamView, setTeamView] = useState(null)
  const [run, setRun] = useState(null)   // (a stretch of nights being simmed, a few at a time: SimRun)
  const scroll = useRef(null)
  const t = TEAM[F.team]
  const R = records(F)
  const off = F.phase === 'off'
  if (import.meta.env.DEV) window.__nba = { F, act, L: NBA }   // (dev: the headless checks read the league)
  const toTab = (id, view = null) => { setTeamView(view); if (tab !== id) { setTab(id); sfx('tap'); scroll.current?.scrollTo(0, 0) } }
  // PLAY: the GM's next game on screen (the scorebug, a moment if it comes, the final)
  const play = () => {
    const before = F.log.length
    const out = act(X => (X.phase === 'season' ? playNext(X, momentOpts(X)) : playPoNight(X, momentOpts(X))))
    sfx('whistle'); haptic('medium')
    if (out?.pending) setLive({ pend: true })
    else if (F.log.length > before) setLive({ row: F.log[F.log.length - 1] })
  }
  // today: the day the next night is played (the deadline card's "today"); his game number when he plays tonight
  const ng = F.phase === 'season' ? nextMine(F) : null
  const sub = F.phase === 'season' ? `${dateText(F, Math.min(F.day, F.days - 1))} · ${!ng ? 'Regular season' : ng.d === F.day ? `Game ${gameNo(F, ng)}` : 'No game today'}`
    : off ? 'Offseason' : F.phase === 'post' ? 'Regular season over' : F.phase === 'playin' ? 'Play-in' : F.phase === 'playoffs' ? ROUND_NAME[F.po.rd].toLowerCase().replace(/(^|\s)\w/g, c => c.toUpperCase()) : 'Season over'
  return (
    <div className="ag-screen f2 fk fk-root fh nb" style={fkVars(F.team)}>
      {live && <NbaGame F={F} act={act} start={live} owner={owner} onDone={() => setLive(null)} />}
      {run && <SimRun F={F} act={act} run={run} onDone={() => setRun(null)} />}
      <div ref={scroll} className="fh-scroll">
        <header className="fh-top">
          <span className="fh-top-logo"><KLogo s={F.team} size={36} /></span>
          <span className="fh-top-txt">
            <b>{t.name}</b>
            <small>{seasonText(F.year)} · {sub}</small>
          </span>
          <button className="fh-x" onClick={onHome} aria-label="Leave Franchise"><IconClose size={16} /><span>Exit</span></button>
        </header>
        {saveBad && (
          <div className="nb-savebad" role="alert">
            <span><b>This league isn't saving</b>This device's browser storage is full, so recent changes aren't saved. Delete a save you don't need and it saves again; it keeps trying.</span>
            <button type="button" onClick={onRetry}>Try again</button>
          </div>
        )}
        {tab === 'season' && <LeagueTicker F={F} />}
        <nav className="fh-tabs" role="tablist" aria-label="Franchise">
          <div className="fh-tabs-in">
            {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => toTab(id)}>{id === 'season' && off ? 'Offseason' : label}</button>)}
          </div>
        </nav>
        <div className={`ag-screen-body fh-body fh-body--${tab}`}>
          {tab === 'season' && (off ? <NbaOffseason F={F} act={act} owner={owner} /> : <Season F={F} R={R} act={act} play={play} owner={owner} onSim={(to, label) => { setRun({ from: F.day, to, label }); sfx('flip') }} onTrades={() => toTab('team', 'trades')} />)}
          {tab === 'team' && <NbaTeam F={F} act={act} owner={owner} view={teamView} setView={setTeamView} />}
          {tab === 'league' && <NbaLeague F={F} act={act} owner={owner} />}
          {tab === 'history' && <NbaHistory F={F} owner={owner} onSlots={onSlots} onDelete={onDelete} />}
        </div>
      </div>
    </div>
  )
}

function LeagueTicker({ F }) {
  const items = useMemo(() => {
    const out = []
    const last = F.phase === 'season' ? F.day - 1 : null
    if (last != null) for (const g of F.sched.filter(x => x.d === last && x.hs != null)) out.push({ k: 'score', a: g.a, as: g.as, h: g.h, hs: g.hs, tag: g.ot ? 'F/OT' : 'FINAL' })
    for (const n of (F.news ?? []).slice(0, 8)) out.push({ k: 'news', tag: n.tag, s: n.s, text: n.text })
    return out
  }, [F, F.day, F.news?.length]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length) return null
  return <Ticker items={items} label="AROUND THE NBA" team={F.team} />
}

// ── SEASON ───────────────────────────────────────────────────────────────────
function Season({ F, R, act, play, owner, onTrades, onSim }) {
  const ph = F.phase
  return (
    <div className="fh-grid">
      <div className="fh-main">
        {ph === 'season' && <NextGame F={F} R={R} act={act} play={play} onTrades={onTrades} onSim={onSim} />}
        {ph === 'post' && <SeasonOver F={F} R={R} act={act} />}
        {(ph === 'playin' || ph === 'playoffs') && <PoCard F={F} act={act} play={play} />}
        {ph === 'done' && <Champions F={F} act={act} />}
        {(ph === 'season' || ph === 'post') && <Glance F={F} R={R} />}
        {(ph === 'playin' || ph === 'playoffs' || ph === 'done') && <Bracket F={F} />}
      </div>
      <aside className="fh-side">
        {F.log.length > 0 && <LastGame F={F} owner={owner} />}
        {(ph === 'season' || ph === 'post') && <ConfLadder F={F} R={R} />}
        {ph === 'season' && <Strip F={F} />}
        <ScoutRow F={F} act={act} />
        <GamesSwitch mode={F.moments ?? 'advanced'} modes={GAMES_MODES} what={GAMES_WHAT} title="Key moments" sub="the last possession of a close game"
          onPick={m => act(X => { X.moments = m })} cls={GAMES_CLS} />
        <LeagueRules value={{ cap: !F.noCap, inj: !F.noInj }} nick={TEAM[F.team].nick} capWhat={CAP_WHAT}
          onChange={r => act(X => { if (r.cap != null) { if (r.cap) delete X.noCap; else X.noCap = 1 } if (r.inj != null) { if (r.inj) delete X.noInj; else { X.noInj = 1; for (const s of SHORTS) for (const p of X.teams[s].r) delete p.inj } } })} />
      </aside>
    </div>
  )
}

// (a long name a size down in the matchup's half-width card: "Timberwolves", "Trail Blazers" at 360px)
const nickCls = s => (TEAM[s].nick.length >= 12 ? 'is-xlong' : TEAM[s].nick.length >= 9 ? 'is-long' : '')
const seedIn = (F, R, s) => confOrder(F, CONF_OF[s], R).indexOf(s) + 1
function NextGame({ F, R, act, play, onTrades, onSim }) {
  const g = nextMine(F)
  if (!g) return null
  const home = g.h === F.team, opp = home ? g.a : g.h
  const b2b = F.sched.some(x => x.d === g.d - 1 && (x.h === F.team || x.a === F.team))
  const kind = DIV_OF[opp] === DIV_OF[F.team] ? `${DIV_OF[F.team]} Division` : CONF_OF[opp] === CONF_OF[F.team] ? `${CONF_NAME[CONF_OF[F.team]]} Conference` : 'Interconference'
  const sim = (to, label) => <button type="button" className="fh-textbtn" onClick={() => onSim(to, label)}>{label}</button>
  const ddl = F.day <= F.ddl, asb = F.day < F.asb[0]
  const sub = s => `${seedIn(F, R, s) ? `${ORD(seedIn(F, R, s))} in the ${CONF_OF[s] === 'E' ? 'East' : 'West'}` : ''}`
  return (
    <section className="fh-next">
      <div className="fh-next-h"><b>{dateText(F, g.d)}</b><span>Game {gameNo(F, g)} · {home ? 'Home' : 'Away'}{b2b ? ' · 2nd of a back-to-back' : ''}</span></div>
      <div className="fh-mu">
        {[g.a, g.h].map((s, k) => (
          <div key={s} className={`fh-mu-t${s === F.team ? ' is-me' : ''}`} style={fkVars(s)}>
            <KLogo s={s} size={56} /><b className={nickCls(s)}>{TEAM[s].nick}</b><span>{recText(R[s])}</span><small>{R[s].g ? sub(s) : CONF_NAME[CONF_OF[s]]}</small>
          </div>
        )).reduce((a, x, i) => (i ? [...a, <span key="m" className="fh-mu-mid">at</span>, x] : [x]), [])}
      </div>
      <p className="fh-line">{kind}</p>
      {ddl && F.ddl - F.day <= 14 && <button type="button" className="fh-row nb-ddl" onClick={onTrades}><span><small>Trade deadline</small><b>{dateText(F, F.ddl)} · {F.ddl - F.day === 0 ? 'today' : `${F.ddl - F.day} days`}</b></span><i className="fh-row-go" aria-hidden="true">›</i></button>}
      <div className="fh-go">
        <Go onClick={play}>Play game {gameNo(F, g)}</Go>
        <div className="nb-sims">
          {sim(F.day + 7, 'Sim a week')}
          {ddl && F.day < F.ddl ? sim(F.ddl, 'Sim to the deadline') : asb ? sim(F.asb[0], 'Sim to the All-Star break') : null}
          {sim(F.days, 'Sim to the end')}
        </div>
      </div>
    </section>
  )
}

function Glance({ F, R }) {
  const r = R[F.team], seed = seedIn(F, R, F.team)
  const cap = CAP_SIM.capSheet(F, F.team)
  const OVER = { under: 'under the cap', cap: 'over the cap', tax: 'in the tax', a1: 'over the first apron', a2: 'over the second apron' }
  return (
    <section className="fh-glance" aria-label={TEAM[F.team].nick}>
      <span><small>Record</small><b>{recText(r)}</b><em>{r.g ? `${ORD(seed)} in the ${CONF_OF[F.team] === 'E' ? 'East' : 'West'}${r.st && Math.abs(r.st) >= 2 ? ` · ${streakText(r)}` : ''}` : CONF_NAME[CONF_OF[F.team]]}</em></span>
      <span><small>Team OVR</small><b>{teamOvr(F, F.team)}</b><em>{ORD(SHORTS.slice().sort((a, b) => teamOvr(F, b) - teamOvr(F, a)).indexOf(F.team) + 1)} in the NBA</em></span>
      <span><small>Payroll</small><b>{money(cap.pay)}</b><em>{F.noCap ? 'no cap' : OVER[cap.over]}</em></span>
    </section>
  )
}

function LastGame({ F, owner }) {
  const g = F.log[F.log.length - 1]
  const [box, setBox] = useState(false)
  const a = g.home ? g.opp : F.team, h = g.home ? F.team : g.opp
  const as = g.home ? g.them : g.us, hs = g.home ? g.us : g.them
  return (
    <section className="fh-last">
      <h3 className="fh-h"><b>{g.po ? g.po.toLowerCase().replace(/(^|\s)\w/g, c => c.toUpperCase()) : 'Last game'}</b><span className={`fh-res is-${g.w ? 'w' : 'l'}`}>{g.w ? 'Win' : 'Loss'}</span></h3>
      <Scorebug a={a} h={h} as={as} hs={hs} final={g.ot ? (g.ot > 1 ? `F/${g.ot}OT` : 'F/OT') : 'FINAL'} />
      {F.box?.[g.bx] && <button type="button" className="fh-textbtn" onClick={() => { setBox(true); sfx('tap') }}>Box score</button>}
      {box && <NbaBox F={F} b={F.box[g.bx]} owner={owner} onClose={() => setBox(false)} />}
    </section>
  )
}

function ConfLadder({ F, R }) {
  const c = CONF_OF[F.team]
  const L = confOrder(F, c, R)
  const lead = L[0]
  return (
    <section className="nb-ladder">
      <h3 className="fh-h"><b>{CONF_NAME[c]} Conference</b><span>GB</span></h3>
      <div className="fh-ladder">
        {L.map((s, k) => (
          <div key={s} className={`fh-rung nb-rung${s === F.team ? ' is-me' : ''}${k === 5 || k === 9 ? ' is-cut' : ''}`} style={fkVars(s)}>
            <i>{k + 1}</i><KLogo s={s} size={24} /><b>{TEAM[s].nick}</b><span>{recText(R[s])}<small>{k ? (gamesBack(R, lead, s) ? gamesBack(R, lead, s).toFixed(1).replace('.0', '') : '-') : '-'}</small></span>
          </div>
        ))}
      </div>
    </section>
  )
}
function Strip({ F }) {
  const G = myGames(F)
  const k = G.findIndex(g => g.hs == null)
  const shown = G.slice(Math.max(0, k - 5), Math.max(0, k - 5) + 10)
  const [all, setAll] = useState(false)
  return (
    <div className="fh-strip-wrap">
      <h3 className="fh-h"><b>Schedule</b><button type="button" className="nb-h-link" onClick={() => { setAll(true); sfx('tap') }}>Full schedule · {G.filter(g => g.hs != null).length} of 82 ›</button></h3>
      {all && <NbaSchedule F={F} onClose={() => setAll(false)} />}
      <div className="fh-strip">
        {shown.map(g => {
          const home = g.h === F.team, opp = home ? g.a : g.h
          const done = g.hs != null, won = done && (home ? g.hs > g.as : g.as > g.hs)
          return (
            <div key={`${g.d}-${opp}`} className={`fh-wk${done ? (won ? ' is-w' : ' is-l') : ''}${g === G[k] ? ' is-now' : ''}`}>
              <small>{dateText(F, g.d)}</small>
              <span className="fh-wk-logo">{!home && <i>@</i>}<KLogo s={opp} size={26} /></span>
              <b>{done ? `${won ? 'W' : 'L'} ${home ? g.hs : g.as}-${home ? g.as : g.hs}` : TEAM[opp].short}</b>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SeasonOver({ F, R, act }) {
  const r = R[F.team], seed = seedIn(F, R, F.team)
  const fate = seed <= 6 ? 'Into the playoffs' : seed <= 10 ? 'Into the play-in' : 'Out of the postseason'
  return (
    <section className="fh-next">
      <div className="fh-next-h"><b>Regular season over</b><span>{recText(r)} · {ORD(seed)} in the {CONF_OF[F.team] === 'E' ? 'East' : 'West'}</span></div>
      <Stamp kind={seed <= 10 ? 'w' : 'l'} big>{fate.toUpperCase()}</Stamp>
      <div className="fh-go"><Go onClick={() => { act(X => { startPostseason(X) }); sfx('whistle') }}>{seed <= 10 ? 'Start the postseason' : 'Watch the postseason'}</Go></div>
    </section>
  )
}

function PoCard({ F, act, play }) {
  const P = F.po
  const mine = myPoGame(F)
  const S = mySeries(F)
  const title = F.phase === 'playin' ? 'Play-In Tournament' : ROUND_NAME[P.rd]
  const bye = F.phase === 'playin' && (P.seeds[CONF_OF[F.team]].slice(0, 6).includes(F.team) || P.pi?.[CONF_OF[F.team]]?.w78 === F.team)
  const night = () => { act(X => { playPoNight(X) }); sfx('flip') }
  const all = () => { act(X => { simPostseason(X) }); sfx('flip') }
  return (
    <section className="fh-next">
      <div className="fh-next-h"><b>{title.toLowerCase().replace(/(^|\s)\w/g, c => c.toUpperCase())}</b><span>{S ? seriesText(S, F.team) : mine ? 'Win or go home' : bye ? 'Into the first round' : 'Out of the postseason'}</span></div>
      {mine ? (
        <>
          <div className="fh-mu">
            {[mine.a, mine.h].map(s => <div key={s} className={`fh-mu-t${s === F.team ? ' is-me' : ''}`} style={fkVars(s)}><KLogo s={s} size={56} /><b className={nickCls(s)}>{TEAM[s].nick}</b><small>{seedText(F, s)}</small></div>).reduce((a, x, i) => (i ? [...a, <span key="m" className="fh-mu-mid">at</span>, x] : [x]), [])}
          </div>
          <div className="fh-go"><Go onClick={play}>{mine.n && S ? `Play game ${mine.n}` : 'Play the game'}</Go><button type="button" className="fh-textbtn" onClick={all}>Sim the rest of the postseason</button></div>
        </>
      ) : (
        <div className="fh-go"><Go onClick={night}>Next night</Go><button type="button" className="fh-textbtn" onClick={all}>Sim the rest of the postseason</button></div>
      )}
    </section>
  )
}
export const seedText = (F, s) => { const c = CONF_OF[s], i = (F.po?.final?.[c] ?? F.po?.seeds?.[c] ?? []).indexOf(s); return i >= 0 ? `No. ${i + 1} ${c === 'E' ? 'East' : 'West'}` : '' }

// THE BRACKET, the NBA's way: the Finals on top once they're set, then each conference (East, West) with its rounds,
// the latest first, every team with its seed (1 v 8, 4 v 5, 3 v 6, 2 v 7), and the play-in under them
function Bracket({ F }) {
  const P = F.po
  if (!P) return null
  const rounds = [...(P.all ?? []), ...(P.stage === 'r' && P.S && !(P.all ?? []).includes(P.S) ? [P.S] : [])]
  const fin = rounds[3]?.[0] ?? null
  const now = F.phase === 'playin' ? 'Play-in' : F.phase === 'playoffs' ? ROUND_NAME[P.rd].toLowerCase().replace(/(^|\s)\w/g, c => c.toUpperCase()) : P.champ ? `${nick(P.champ)} win the title` : ''
  const confs = CONF_OF[F.team] === 'W' ? ['W', 'E'] : ['E', 'W']
  return (
    <section className="nb-bracket">
      <h3 className="fh-h"><b>Bracket</b><span>{now}</span></h3>
      {fin && (
        <div className="nb-round nb-finals">
          <small>NBA FINALS</small>
          <SeriesRow F={F} hi={fin.hi} lo={fin.lo} S={fin} big />
          <p className="nb-ser-note">{fin.done ? `${nick(fin.done)} win the series ${Math.max(fin.wh, fin.wl)}-${Math.min(fin.wh, fin.wl)}` : seriesText(fin)}</p>
        </div>
      )}
      <div className="nb-confs">
        {confs.map(c => (
          <div key={c} className="nb-conf">
            <h4 className="nb-conf-h">{CONF_NAME[c]} Conference</h4>
            {[2, 1, 0].map(k => {
              const list = (rounds[k] ?? []).filter(S => S.c === c)
              return list.length > 0 && (
                <div key={k} className="nb-round">
                  <small>{['First round', 'Conference semifinals', 'Conference finals'][k]}</small>
                  {list.map(S => <SeriesRow key={S.hi + S.lo} F={F} hi={S.hi} lo={S.lo} S={S} />)}
                </div>
              )
            })}
            {P.pi?.[c] || (P.cur ?? []).some(g => g.c === c && g.k) ? (
              <div className="nb-pi">
                <small>Play-in tournament</small>
                {piGames(P, c).map(g => <SeriesRow key={g.k} F={F} hi={g.h} lo={g.a} g={g} txt={g.k === '78' ? '7 v 8' : g.k === '910' ? '9 v 10' : 'For No. 8'} />)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
const piGames = (P, c) => { const x = P.pi?.[c] ?? {}; return [x.g78, x.g910, x.gl, ...(P.cur ?? []).filter(g => g.c === c && g.k)].filter((g, i, a) => g && a.findIndex(y => y && y.k === g.k) === i) }
// a team's seed in its conference (after the play-in, the seed it plays the playoffs as)
const seedOf = (F, s) => { const c = CONF_OF[s], i = (F.po?.final?.[c] ?? F.po?.seeds?.[c] ?? []).indexOf(s); return i >= 0 ? i + 1 : null }
function SeriesRow({ F, hi, lo, S, g, txt, big = false }) {
  const won = s => S?.done === s || (g?.hs != null && (s === g.h ? g.hs > g.as : g.as > g.hs))
  return (
    <div className={`nb-ser${hi === F.team || lo === F.team ? ' is-me' : ''}${big ? ' is-big' : ''}`}>
      {[hi, lo].map(s => (
        <span key={s} className={`nb-ser-t${(S?.done || g?.hs != null) && !won(s) ? ' is-out' : ''}`} style={fkVars(s)}>
          {seedOf(F, s) && <i className="nb-seed">{seedOf(F, s)}</i>}
          <KLogo s={s} size={big ? 30 : 22} /><b>{big ? TEAM[s].nick : TEAM[s].short}</b>{S && <em>{s === hi ? S.wh : S.wl}</em>}{g?.hs != null && <em>{s === g.h ? g.hs : g.as}</em>}
        </span>
      ))}
      {txt && <small>{txt}</small>}
    </div>
  )
}

// THE CHAMPIONS: who won it, the Finals (the series, the games), the Finals MVP and his series; then the GM's own end
function Champions({ F, act }) {
  const P = F.po
  const champ = P.champ, fin = P.all[3][0]
  const me = champ === F.team
  const loser = fin.done === fin.hi ? fin.lo : fin.hi
  const mvp = P.fmvp != null ? NBA.manOf(F, P.fmvp) : null
  const ml = mvp && (fin.st?.[mvp.i] ?? null)
  const per = k => (ml?.gp ? (ml[k] / ml.gp).toFixed(1) : null)
  const n = fin.g.length
  const finish = finishOf(F, F.team)
  // (the GM's season in a sentence with its subject: "The Celtics were eliminated in the first round")
  const mine = me ? null : FINISH_LINE[finish]?.(nick(F.team)) ?? null
  return (
    <section className={`fh-next${me ? ' is-sb' : ''}`}>
      <div className="fh-next-h"><b>{seasonText(F.year)} NBA champions</b><span>{nick(champ)} beat the {nick(loser)} {Math.max(fin.wh, fin.wl)}-{Math.min(fin.wh, fin.wl)}</span></div>
      <TeamSlab s={champ} size="l" sub="NBA CHAMPIONS" />
      {me && <Stamp kind="gold" big>CHAMPIONS</Stamp>}
      <div className="nb-champ-fin">
        <small>NBA FINALS · {n === 4 ? 'A SWEEP' : `IN ${n} GAMES`}</small>
        <div className="nb-champ-games">
          {fin.g.map((x, i) => { const aw = x.h === fin.hi ? fin.lo : fin.hi, wonBy = x.hs > x.as ? x.h : aw; return <span key={i} style={fkVars(wonBy)}><b>G{i + 1}</b>{wonBy} {Math.max(x.hs, x.as)}-{Math.min(x.hs, x.as)}{x.ot ? ` ${x.ot > 1 ? `${x.ot}OT` : 'OT'}` : ''}</span> })}
        </div>
      </div>
      {mvp && (
        <div className="nb-champ-mvp" style={fkVars(champ)}>
          <KLogo s={champ} size={36} />
          <span><small>Finals MVP</small><b>{mvp.n}</b>{ml && <em>{per('pts')} PPG · {per('reb')} RPG · {per('ast')} APG</em>}</span>
        </div>
      )}
      {mine && <p className="fh-next-note">{mine}.</p>}
      <div className="fh-go"><Go onClick={() => { act(X => { closeSeason(X) }); sfx('whistle') }}>Into the offseason</Go></div>
    </section>
  )
}
const FINISH_LINE = {
  finals: t => `The ${t} lost in the NBA Finals`, cf: t => `The ${t} were eliminated in the conference finals`, r2: t => `The ${t} were eliminated in the conference semifinals`,
  r1: t => `The ${t} were eliminated in the first round`, playin: t => `The ${t} were eliminated in the play-in tournament`, lottery: t => `The ${t} missed the postseason`,
}
export { Banner, Chyron, Fold }

// the scouting room: the next class on the board all season, a report a point (two a month in the season)
function ScoutRow({ F, act }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="fh-row fh-scout" onClick={() => { setOpen(true); sfx('tap') }}>
        <span><small>Draft board</small><b>Scout the {F.year + 1} class</b></span>
        <span className="fh-scout-pts"><b>{F.sp ?? 0}</b><small>{F.sp === 1 ? 'report left' : 'reports left'}</small></span>
        <i className="fh-row-go" aria-hidden="true">›</i>
      </button>
      {open && createPortal(
        <div className="ss-overlay nb-sheet-ov" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="fk fk-root nb-sheet" role="dialog" aria-label="Draft board" style={fkVars(F.team)}>
            <div className="nb-sheet-top"><b>{F.year + 1} big board · {F.sp ?? 0} reports</b><button className="fk-x" onClick={() => setOpen(false)} aria-label="Close">✕</button></div>
            <div className="nb-board">{(F.dc ?? []).slice(0, 40).map(p => <Prospect key={p.i} F={F} p={p} act={act} />)}</div>
          </div>
        </div>, document.body)}
    </>
  )
}

// SIMMING: the nights played a few at a time, so the screen never locks: the date, the GM's record counting, a bar
// to the end of the stretch, and STOP to pick it up from here (Reduce Motion: the same, it's not an animation)
function SimRun({ F, act, run, onDone }) {
  const [, tick] = useState(0)
  const stop = useRef(false)
  useEffect(() => {
    let t
    const step = () => {
      if (stop.current || F.phase !== 'season' || F.day >= run.to) { act(() => {}); onDone(); return }
      // (written to the save every 30 nights and when it stops, not every step)
      act(X => { simTo(X, Math.min(run.to, X.day + 2)) }, { save: Math.floor((F.day + 2) / 30) > Math.floor(F.day / 30) })
      tick(n => n + 1)
      t = setTimeout(step, 16)
    }
    t = setTimeout(step, 60)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const r = records(F)[F.team]
  const k = Math.max(0, Math.min(1, (F.day - run.from) / Math.max(1, run.to - run.from)))
  return createPortal(
    <div className="fk-root fk nb-run" style={fkVars(F.team)} role="status" aria-label="Simming">
      <div className="nb-run-in">
        <Chyron team={F.team} tag={F.day < F.days ? dateText(F, Math.min(F.day, F.days - 1)) : 'FINAL'} title={run.label} />
        <div className="nb-run-rec"><KLogo s={F.team} size={44} /><b>{recText(r)}</b><small>{TEAM[F.team].nick}</small></div>
        <div className="nb-run-bar"><i style={{ width: `${k * 100}%` }} /></div>
        <button type="button" className="fh-textbtn" onClick={() => { stop.current = true; sfx('tap') }}>Stop here</button>
      </div>
    </div>,
    document.body,
  )
}
