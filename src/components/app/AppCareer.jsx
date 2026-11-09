import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { LegacyIco, withLegacy } from './GainIcons'
import { seeded } from '../../lib/rng'
import { playoffWeather } from '../../utils/simulation'
import { createPortal } from 'react-dom'
import {
  POS_LABEL, POS_NAME, POS_ATTR, OFFENSE_POS, pastCareers, saveCareer, clearCareer, stockOf, answerInterview, setupInterviews, runDraft,
  startSeason, resumeSeason, advanceWeek, chooseMoment, resolveInjury, hotHand, canHotHand, hotHandOn, hotGames, finishRegular, playoffRound, bookSeason, recordCombine, skipCombine, spendDev, demandTrade, nextSeason,
  OFF_STEPS, offStep, campDrill, CAMP_LEGACY, dbSpot, dlSpot, dlSpotLabel, olSpot, OL_SPOT_NAME, combinePos, lineup, depthChart, gradeOf, gradeOfOvr, ovrGradeVal, SPORT, sportOf,
  openTalks, ask, closeTalks, acceptTalks, ASKS, askOdds, leverageOf,
  retire, canRetire, mustRetire, careerTotals, legacyOf, ALL_TIME, STAT_LABEL, HEADLINE_STATS, EXTRA_STATS, AWARD_NAME, MAX_SEASONS, retireReason, goalsFor, stockText, pickText, loadSlots, CAREER_SLOTS, maxedTrait, trainWindow, ladderNote, canUpgrade, upgradeCost, bodyWork, canBodyWork, bodyCost, BODY_MAX, upgradeBlock, legacyExtras,
  compsFor, seasonScore, unretire, canUnretire, comebackYear, COMEBACK_SEASONS, inTeamColors, roundOdds, playoffGame, cardOdds, gameCast, FACE_RATING,
  jerseyOf, numberRule, takenNumbers, numberClash, canChangeNumber, setNumber,
  GAMES_MODES, gamesMode, setGamesMode, legacyTiers, ensureSport, sportReady, careerBody, bodyText } from '../../lib/career'
import { GAME_LINE } from '../../lib/seasonDirector'
import { GAMES, pickPlayoffGame } from '../../lib/minigames'
import { momentSituation } from '../../lib/situations'
import MiniGame from './MiniGame'
import MiniGameSimple from './MiniGameSimple'
import { SIMPLE_GAMES } from '../../lib/minigamesSimple'
import PlayerComp from './PlayerComp'
import { valToGrade, nflHeadshot } from '../../utils/simulation'
import { sfx, haptic, victory } from '../../lib/juice'
import { useProgress, spendBoost } from '../../lib/progress'
import { MomentCard, NowCard, RecordOverlay, HonorOverlay } from './AppSeasonPlus'
import Silhouette from '../Silhouette'
import { getUsername } from '../../lib/discord'
import { romanOf } from '../../lib/mg/kit'
import { sellsHere, onStorefront } from '../../lib/storefront'
import { IconClose, IconArrow, IconFlame, IconTrophy, IconStar, IconCrown, IconMedal, IconRing, IconCheck, IconShield, IconHelmet, IconSpin, IconCaret } from './icons'
import './career-legacy.css'
import { CFB_LIVE } from '../../lib/cfbLive'
// START IN COLLEGE: the college phase and College Football's data load only for a career that's in it
const CareerCollege = lazy(() => import('../cfb/CareerCollege'))
const COLLEGE_POS = ['qb', 'wr', 'rb']   // the positions College Football has rosters for
const CLASS_WORD = { FR: 'Freshman', SO: 'Sophomore' }
import { seasonAnalytics, careerBests, TIER_WORD } from '../../lib/careerStats'
import { Scramble } from './MotionText'
import { motion } from 'motion/react'
import { SPRING_LAYOUT } from '../../lib/motion'

// CAREER (football and basketball): the intro, the draft, the hub where a
// career is played (your model and traits, the season, the player, the team,
// the record so far) and the legacy screen. The engine is lib/career.js; what
// differs by sport comes from its SPORT table.

const gradeColor = v0 => { const v = Math.round(v0 ?? 0); return v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444' }   // rounded like the letter (valToGrade)
// the last name (a suffix rides along: Harrison Jr.)
const nick = name => { const w = (name || '').split(' '); return w.length > 2 && /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(w[w.length - 1]) ? w.slice(-2).join(' ') : w[w.length - 1] }
const money = n => `$${n}M`
// soccer's helpers live in lib/careerSoccer.js (loaded only for soccer); these reach them once it's in
const sx = () => SPORT.soccer?.x ?? {}
const wageText = (n, short) => sx().wageText(n, short), soccerCur = short => sx().soccerCur(short), nationName = n => sx().nationName?.(n) ?? n, nationFlag = n => sx().nationFlag(n)
const signAcademy = (c, o) => sx().signAcademy(c, o), soccerRole = c => sx().role(c), rememberNation = n => sx().rememberNation?.(n), lastNation = () => sx().lastNation?.()
// a sport whose module loads on its own (soccer): the screen waits for it
function useSport(sport) {
  const [, bump] = useState(0)
  const ready = sportReady(sport)
  useEffect(() => { if (!ready) ensureSport(sport).then(() => bump(n => n + 1)) }, [sport, ready])
  return ready
}
// a contract's pay in the sport's own words: football and basketball a year in dollars, soccer a week in pounds or euros
const pay = (c, n, short = c?.team) => (c?.sport === 'soccer' ? wageText(n, short) : `${money(n)} a year`)
const earned = (c, n) => (c?.sport === 'soccer' ? `€${n}M` : money(n))
const RUN_DATE = { month: 'short', day: 'numeric' }
// a roster photo: a full URL (or, in a football career saved before, the headshot id)
const photoSrc = p => (p ? (String(p).includes('/') ? p : nflHeadshot(p)) : null)
const LEGACY_COLOR = { Starter: '#b9c4bd', Star: '#5edbd8', Superstar: '#b79bff', 'All-Time Great': '#f5dc8a', 'Squad Player': '#b9c4bd', 'World Class': '#b79bff', Legend: '#f5dc8a' }
export const legacyColor = c => LEGACY_COLOR[legacyOf(c).tier] ?? '#b9c4bd'
function CareerFace({ c, size = 34 }) {
  const ch = c.build?.[FACE_RATING[c.pos]] ?? null
  return (
    <span className="cr-me-face" style={{ width: size, height: size, borderColor: legacyColor(c) }}>
      {ch?.photo ? <img src={ch.photo} alt="" loading="lazy" /> : <span className="crl-init">{initials(c.name)}</span>}
    </span>
  )
}
// per-game averages keep one decimal; counts get commas
export const fmt = v => (typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(1) : (v ?? 0).toLocaleString())

// ── Career home: what Career is, your three save slots, past careers ────────
// a player's name: letters, spaces, apostrophes, hyphens, periods
const cleanName = v => v.replace(/[^A-Za-z\u00C0-\u017F' .-]/g, '').replace(/\s+/g, ' ').slice(0, 14)
// Random names for a new player: athlete-sounding, every combination plausible
const FIRST_NAMES = ['Marcus', 'Jalen', 'Tre', 'DeShawn', 'Cole', 'Isaiah', 'Brock', 'Malik', 'Darius', 'Kade', 'Xavier', 'Jordan', 'Bryce', 'Tyson', 'Elijah', 'Grant', 'Rashad', 'Mason', 'Caleb', 'Jaylen', 'Devin', 'Trey', 'Andre', 'Dominic', 'Quentin', 'Zion', 'Myles', 'Cam', 'Jace', 'Amari', 'Keon', 'Luca', 'Nico', 'Reggie', 'Terrell', 'Bo', 'Cooper', 'Dante', 'Gavin', 'Hunter', 'Jamal', 'Khalil', 'Lamont', 'Micah', 'Owen', 'Preston', 'Rome', 'Silas', 'Tavon', 'Wyatt']
const LAST_NAMES = ['Williams', 'Johnson', 'Carter', 'Brooks', 'Mitchell', 'Hayes', 'Coleman', 'Bennett', 'Sanders', 'Reed', 'Washington', 'Harrison', 'Fletcher', 'Dawson', 'Holloway', 'Pierce', 'Sterling', 'Vance', 'Whitfield', 'Graves', 'McKenzie', 'Ellison', 'Booker', 'Calloway', 'Dupree', 'Fontaine', 'Gaines', 'Hollins', 'Jennings', 'Kingsley', 'Lockhart', 'Maddox', 'Norwood', 'Okafor', 'Prescott', 'Quarles', 'Rhodes', 'Stokes', 'Thornton', 'Underwood', 'Varner', 'Whitaker', 'Yates', 'Abernathy', 'Blackwell', 'Crawford', 'Delgado', 'Easley', 'Freeman', 'Gentry']
const pickName = list => list[Math.floor(Math.random() * list.length)]
// the career's mini games mode, in a few words under the choice
const GAMES_WHAT = { advanced: 'Full-screen games', simple: 'Quick tap games', off: 'Simulated games' }
// A career mini game (combine drill, camp drill, playoff moment) in the career's own mode:
// SIMPLE plays the original quick games, ADVANCED the full-screen ones, OFF simulates it
// (empty: training camp, played in an empty stadium; the combine's drills are empty on their own, MgStage's EMPTY_GAMES)
export function CareerGame({ c, setCareer, skipAll = true, ...p }) {
  const mode = gamesMode(c)
  const onSkipAll = skipAll ? () => setCareer(setGamesMode(c, 'off')) : null
  // (a game that isn't in yet, either kind: played from the grade, so the career never stalls on it)
  if (!GAMES[p.game] && !SIMPLE_GAMES[p.game]) return <MiniGame {...p} sim onSkipAll={onSkipAll} />
  if (mode === 'simple') return <MiniGameSimple game={p.game} build={p.build} pos={c.pos} seed={p.seed} lock={p.lock} hard={p.hard} retry={p.retry} redo={p.redo} onDone={p.onDone} onSkipAll={onSkipAll} />
  return <MiniGame {...p} sim={mode === 'off'} onSkipAll={onSkipAll} />
}
const gameTitle = (c, game) => (gamesMode(c) === 'simple' ? SIMPLE_GAMES[game]?.title : null) ?? GAMES[game]?.title
function NewSlot({ S, onStart, onCancel }) {
  const [first, setFirst] = useState(''), [last, setLast] = useState('')
  // opens on the position last played; changing it here is all a new career needs
  const [pos, setPos] = useState(() => {
    let saved = null
    try { saved = localStorage.getItem(S.isBucket ? 'bucketPosition' : 'lastPosition') } catch {}
    return S.positions.includes(saved) ? saved : S.positions[0]
  })
  // a new name every tap (never the same one twice in a row)
  const randomize = () => {
    let f, l
    do { f = pickName(FIRST_NAMES); l = pickName(LAST_NAMES) } while (f === first && l === last)
    setFirst(f); setLast(l); sfx('tap')
  }
  const [games, setGames] = useState('advanced')
  const [start, setStart] = useState('draft')   // football QB, WR, RB: straight to the draft, or college first
  const college = CFB_LIVE && S.id === 'nfl' && COLLEGE_POS.includes(pos)
  const [nation, setNation] = useState(() => (S.isSoccer ? lastNation() ?? 'ENG' : null))
  const ok = first.trim().length >= 2 && last.trim().length >= 2
  return (
    <form className="cr-slot cr-slot--new" onSubmit={e => { e.preventDefault(); if (!ok) return; if (S.isSoccer) rememberNation(nation); onStart(`${first.trim()} ${last.trim()}`, pos, games, nation, college ? start : 'draft') }}>
      <span className="ag-eyebrow">POSITION</span>
      <div className="cr-pos" role="radiogroup" aria-label="Position" style={{ '--n': S.positions.length + (S.soon?.length ?? 0) }}>
        {S.positions.map(p => (
          <button key={p} type="button" role="radio" aria-checked={pos === p} className={pos === p ? 'is-on' : ''} onClick={() => { setPos(p); sfx('tap') }}>{POS_LABEL[p]}</button>
        ))}
        {(S.soon ?? []).map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={false} disabled className="is-soon">{label}<small>COMING SOON</small></button>)}
      </div>
      {S.isSoccer && (
        <>
          <span className="ag-eyebrow">NATIONALITY</span>
          <label className="cr-nation">
            <img src={nationFlag(nation)} alt="" />
            <select className="cr-name-in" value={nation} onChange={e => { setNation(e.target.value); sfx('tap') }} aria-label="Nationality">
              {(sx().SOCCER_NATIONS ?? []).map(n => <option key={n.short} value={n.short}>{n.name}</option>)}
            </select>
          </label>
        </>
      )}
      <span className="ag-eyebrow">NAME YOUR PLAYER</span>
      <div className="cr-name-row">
        <input className="cr-name-in" value={first} onChange={e => setFirst(cleanName(e.target.value))} placeholder="First name" autoComplete="off" autoFocus aria-label="First name" />
        <input className="cr-name-in" value={last} onChange={e => setLast(cleanName(e.target.value))} placeholder="Last name" autoComplete="off" aria-label="Last name" />
        <button type="button" className="cr-name-rand" onClick={randomize} aria-label="Random name" title="Random name"><IconSpin size={18} /></button>
      </div>
      {/* the career's mini games, for the whole career (it can still be changed on the career screen) */}
      {college && (
        <>
          <span className="ag-eyebrow cr-games-label">START</span>
          <div className="cr-pos cr-games" role="radiogroup" aria-label="Start" style={{ '--n': 2 }}>
            {[['draft', 'ENTER THE DRAFT'], ['college', 'START IN COLLEGE']].map(([m, label]) => (
              <button key={m} type="button" role="radio" aria-checked={start === m} className={start === m ? 'is-on' : ''} onClick={() => { setStart(m); sfx('tap') }}>{label}</button>
            ))}
          </div>
        </>
      )}
      <span className="ag-eyebrow cr-games-label">MINI GAMES</span>
      <div className="cr-pos cr-games" role="radiogroup" aria-label="Mini games" style={{ '--n': GAMES_MODES.length }}>
        {GAMES_MODES.map(([m, label]) => (
          <button key={m} type="button" role="radio" aria-checked={games === m} className={games === m ? 'is-on' : ''} onClick={() => { setGames(m); sfx('tap') }}>{label}<small>{GAMES_WHAT[m]}</small></button>
        ))}
      </div>
      <div className="cr-slot-acts">
        <button type="button" className="ag-btn ag-btn--ghost" onClick={onCancel}>CANCEL</button>
        <button type="submit" className="ag-btn ag-btn--gold cr-slot-go" disabled={!ok}>BUILD <IconArrow size={15} /></button>
      </div>
    </form>
  )
}
function SlotCard({ c, S, onOpen, onDelete }) {
  const [ask, setAsk] = useState(false)
  const L = legacyOf(c)
  const where = c.phase === 'college' ? `In college: ${c.college?.seasons?.length ? `${c.college.seasons[c.college.seasons.length - 1].schoolName ?? c.college.seasons[c.college.seasons.length - 1].school} · ${CLASS_WORD[c.college.seasons[c.college.seasons.length - 1].cls] ?? ''}` : 'Recruiting'}` : c.phase === 'draft' ? (c.sport === 'soccer' ? 'Academy prospect' : 'Draft prospect') : c.phase === 'retired' ? `Retired · ${L.tier}` : `Year ${c.year + 1} · ${c.season}`
  if (ask) return (
    <div className="cr-slot cr-slot--ask">
      <p>Delete <b>{c.name}</b>'s career? This can't be undone.</p>
      <div className="cr-slot-acts">
        <button className="ag-btn" onClick={() => setAsk(false)}>KEEP IT</button>
        <button className="ag-btn cr-del" onClick={() => { onDelete(); sfx('deny') }}>DELETE</button>
      </div>
    </div>
  )
  return (
    <div className="cr-slot">
      <button className="cr-slot-main" onClick={onOpen}>
        {c.team ? <img src={S.logo(c.team)} alt="" className="cr-slot-logo" /> : <span className="cr-slot-logo cr-slot-pos">{POS_LABEL[c.pos]}</span>}
        <span className="cr-slot-txt"><b>{c.name}</b><small>{POS_LABEL[c.pos]}{c.fit ? ` · ${nick(c.fit.name)}` : ''} · {where} · age {c.age}</small></span>
        <span className="cr-slot-ovr"><b>{c.ovr}</b><small>OVR</small></span>
      </button>
      <button className="cr-slot-x" onClick={() => setAsk(true)} aria-label={`Delete ${c.name}'s career`}>DELETE</button>
    </div>
  )
}
export function CareerIntro({ sport = 'nfl', uid = null, onOpen, onNew, onClose }) {
  const ready = useSport(sport)
  const S = SPORT[sport] ?? SPORT.nfl
  const runs = useMemo(() => pastCareers(sport), [sport])
  const [slots, setSlots] = useState(null)
  const [naming, setNaming] = useState(null)       // the empty slot being named
  useEffect(() => { let off = false; loadSlots(sport, uid).then(l => { if (!off) setSlots(l) }); return () => { off = true } }, [sport, uid])
  if (!ready) return null
  const steps = S.ui?.introSteps ?? [
    ['Build', 'Name your player and build them from traits, the same spins as a normal game. That build is who you take into the league.'],
    ['The draft', 'Combine drills, then interviews with the teams picking near his slot. His stock moves, draft day decides where he lands, and the team around him matters.'],
    ['The career', `Season after season, ${S.isBucket ? 'game by game' : 'week by week'}: decisions, injuries, a ${S.isBucket ? 'rotation' : 'depth chart'} to win. Every offseason the roster turns over and the league moves.`],
    ['Legacy', 'Contracts, free agency, trade demands, retirement. Awards, records, the Hall of Fame, and where the career ranks among the greatest ever.'],
  ]
  return (
    <div className={`ag-screen ${S.screen} cr cr-intro`}>
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">MULTI-SEASON</span><h1 className="ag-h1">Career</h1></div>
        <button className="ag-round-btn" onClick={onClose} aria-label="Home"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <section className="cr-slots ag-pop">
          <div className="ag-card-head"><span className="ag-eyebrow">SAVES · {CAREER_SLOTS} SLOTS</span></div>
          {!slots ? <div className="tk-runs-empty">Loading your saves…</div> : slots.map((c, i) => (
            c ? <SlotCard key={`c${i}`} c={c} S={S} onOpen={() => onOpen(c)} onDelete={() => { clearCareer(sport, uid, i); setSlots(l => l.map((x, k) => (k === i ? null : x))) }} />
              : naming === i ? <NewSlot key={`n${i}`} S={S} onStart={(name, pos, games, nation, start) => onNew(i, name, pos, games, start)} onCancel={() => setNaming(null)} />
              : <button key={`e${i}`} className="cr-slot cr-slot--empty" onClick={() => { setNaming(i); sfx('tap') }}><span>+</span> NEW CAREER <small>SLOT {i + 1}</small></button>
          ))}
        </section>
        <div className="cr-intro-hero ag-pop" style={{ '--d': '60ms' }}>
          <span className="cr-intro-kicker">ONE PLAYER. A WHOLE CAREER.</span>
          <p>Up to {MAX_SEASONS} seasons, saved every step so you can leave and come back. {S.ui?.posLine ?? (S.isSoccer ? 'A striker. Goalkeepers are coming soon.' : S.isBucket ? 'Guard or big.' : `${S.positions.slice(0, -1).map(p => POS_LABEL[p]).join(', ')} or ${POS_LABEL[S.positions[S.positions.length - 1]]}.`)}</p>
        </div>
        <ol className="tk-steps ag-pop" style={{ '--d': '80ms' }}>
          {steps.map(([t, d], i) => <li key={t}><span className="tk-step-n">{i + 1}</span><span className="tk-step-txt"><b>{t}</b><small>{d}</small></span></li>)}
        </ol>
        {runs.length > 0 && (
          <section className="tk-runs ag-pop" style={{ '--d': '160ms' }}>
            <div className="ag-card-head"><span className="ag-eyebrow">FINISHED CAREERS</span></div>
            {runs.map((r, i) => (
              // a finished career: who and what at a glance, three tidy rows (no wrapping run-on line)
              <div key={r.at + '-' + i} className={`cr-run${r.hof ? ' is-hof' : ''}`}>
                <span className="cr-run-logo">{r.team ? <img src={S.logo(r.team)} alt="" loading="lazy" /> : <b>{POS_LABEL[r.pos] ?? r.pos}</b>}</span>
                <span className="cr-run-name">{r.name || 'Unnamed'}</span>
                <span className="cr-run-pts"><b>{r.score}</b><small>LEGACY</small></span>
                <span className="cr-run-chips">
                  <i>{POS_LABEL[r.pos] ?? r.pos}</i>
                  {r.hof ? <i className="is-hof"><IconCrown size={11} /> {S.isSoccer ? 'LEGEND' : 'HALL OF FAME'}</i> : <i>{String(r.tier).toUpperCase()}</i>}
                  {(r.ranked ?? r.rank <= 15) && <i className="is-rank">NO. {r.rank} ALL-TIME</i>}
                  {r.comeback && <i>COMEBACK</i>}
                  {r.sandbox && <i className="is-sb">SANDBOX</i>}
                </span>
                <span className="cr-run-meta">{r.seasons} {r.seasons === 1 ? 'season' : 'seasons'} · {r.rings} {r.rings === 1 ? (S.isSoccer ? 'title' : 'ring') : (S.isSoccer ? 'titles' : 'rings')} · {r.awards} {S.ui?.award ?? (r.awards === 1 ? 'award' : 'awards')} · {new Date(r.at).toLocaleDateString(undefined, RUN_DATE)}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

// ── The player: model + the traits around it ─────────────────────────────────
// The model wears the team's colors (the chips keep their players, grades and faces)
function Model({ c, devPick }) {
  const attr = POS_ATTR[c.pos]
  // a trait that can't go up says why when it's tapped
  const [why, setWhy] = useState(null)
  const whyT = useRef(0)
  useEffect(() => () => clearTimeout(whyT.current), [])
  const tellWhy = t => { const w = upgradeBlock(c, t); if (!w) return; clearTimeout(whyT.current); setWhy({ text: w, k: Date.now() }); whyT.current = setTimeout(() => setWhy(null), 3200); sfx('tap') }
  const shown = useMemo(() => inTeamColors(c.build, c.fit, jerseyOf(c)), [c.build, c.fit, c.number, c.team, c.roster]) // eslint-disable-line react-hooks/exhaustive-deps
  const Card = ({ t }) => {
    const ch = c.build[t]
    const maxed = !!ch && maxedTrait(ch.val, ch, t)
    const canUp = !!devPick && canUpgrade(c, t)
    const cost = upgradeCost(ch?.val, c, t)
    // the trait's training window (the age ladder: the body first, then the technique), out
    // in the open: train it before it shuts (its own line under the player's name, so a phone
    // never cuts it off). Only while there's a point to spend: otherwise there's nothing to do
    // about it. A technique trait shows its window only as it nears the end
    const w0 = !maxed && (c.dev?.points ?? 0) > 0 ? trainWindow(c, t) : null
    const w = w0 && (w0.tier !== 'tech' || w0.left <= 4) ? w0 : null
    const winTag = !w ? null : !w.open ? <em className="cr-trait-win is-closed">CLOSED</em> : w.left <= 1 ? <em className="cr-trait-win is-last">LAST YEAR</em> : w.late ? <em className="cr-trait-win">2× COST</em> : <em className="cr-trait-win">TRAIN TO AGE {w.until}</em>
    return (
      <div className={`cr-trait${canUp ? ' can-up' : ''}`} onClick={canUp ? () => devPick(t) : () => tellWhy(t)} role="button">
        <span className="cr-trait-av">{ch?.photo ? <img src={ch.photo} alt="" /> : null}</span>
        <span className="cr-trait-txt"><b>{(attr[t]?.label ?? t).replace('/', '/\u200b')}</b><small>{nick(ch?.qbFull) || '—'}{ch?.upgraded ? ` +${ch.upgraded}` : ''}{ch?.faded ? ` −${ch.faded}` : ''}</small>{maxed ? <em className="cr-trait-max">MAXED</em> : winTag}</span>
        <span className="cr-trait-g" style={{ background: gradeColor(ch?.val ?? 0) }}>{valToGrade(ch?.val ?? 0)}{canUp && cost > 1 ? ` · ${cost} PTS` : ''}</span>
      </div>
    )
  }
  return (
    <div className="cr-model-wrap ag-pop">
      <div className={`cr-model${c.sport === 'bucket' || c.sport === 'soccer' || c.sport === 'baseball' ? ' cr-model--bucket' : ''}`}>
        <Silhouette build={shown} types={c.types} attrMap={attr} isBucket={c.sport === 'bucket'} isSoccer={c.sport === 'soccer'} {...(c.sport === 'baseball' ? { isBaseball: true, baseballPos: c.pos, logoDir: '/logos/mlb/' } : {})} isRB={c.pos === 'rb'} isWR={c.pos === 'wr'} isTE={c.pos === 'te'} isDB={c.pos === 'db'} isDL={c.pos === 'dl'} isLB={c.pos === 'lb'} isOL={c.pos === 'ol'} modelOnly />
        <span className="cr-model-ovr"><b>{c.ovr}</b><small>OVR</small></span>
      </div>
      <div className={`cr-traits${c.types.length % 2 ? ' is-list' : ''}`}>
        {devPick && (() => {
          const n = ladderNote(c)
          return n && <p className={`cr-train-note${n.last ? ' is-last' : ''}`}>{n.text}</p>
        })()}
        {c.types.map(t => <Card key={t} t={t} />)}
      </div>
      {/* body work: a point into durability, fewer games missed. Always shown: tapped when it can't go up, it says why */}
      {(() => {
        const maxed = (c.durability ?? 5) >= BODY_MAX, can = !!devPick && canBodyWork(c), cost = bodyCost(c)
        return (
          <div className="cr-traits is-list cr-body">
            <div className={`cr-trait${can ? ' can-up' : ''}`} onClick={can ? () => devPick('__body') : () => tellWhy('__body')} role="button">
              <span className="cr-trait-av" aria-hidden="true"><IconShield size={16} /></span>
              <span className="cr-trait-txt"><b>DURABILITY</b><small>Body work: fewer injuries, a longer career{c.bodyWork ? ` +${c.bodyWork}` : ''}</small>{maxed && <em className="cr-trait-max">MAXED</em>}</span>
              <span className="cr-trait-g" style={{ background: gradeColor((c.durability ?? 5) * 1.1) }}>{gradeOf((c.durability ?? 5) * 1.1)}{can && cost > 1 ? ` · ${cost} PTS` : ''}</span>
            </div>
          </div>
        )
      })()}
      {why && <p key={why.k} className="cr-why ag-pop" role="status">{why.text}</p>}
    </div>
  )
}
// the small extras on top of the resume: camp wins, shoe deals, money earned
function Extras({ c }) {
  const x = legacyExtras(c)
  const rows = [['Camp', x.camp], ['Shoe deals', x.shoe], ['Earnings', x.earnings]].filter(([, n]) => n > 0)
  if (!rows.length) return null
  return <p className="cr-legacy-extras">{rows.map(([k, n]) => <span key={k} className="gain">{k} +{n} <LegacyIco /></span>)}</p>
}

function LegacyMeter({ c }) {
  const L = legacyOf(c)
  const tierMin = [...legacyTiers(c)].reverse().find(([m]) => L.score >= m)[0]
  const pct = L.next ? Math.min(100, Math.round(((L.score - tierMin) / (L.next.at - tierMin)) * 100)) : 100
  return (
    <div className="cr-legacy">
      <div className="cr-legacy-top"><span className="ag-eyebrow">LEGACY TIER · {L.tier.toUpperCase()}</span><b><LegacyIco sm={false} /> {L.score}<small> LEGACY PTS</small></b></div>
      <div className="cr-legacy-bar"><span style={{ width: `${Math.max(3, pct)}%` }} /></div>
      <div className="cr-legacy-foot"><span>{L.next ? `${L.next.at - L.score} more points to reach the ${L.next.name} tier` : 'The top tier'}</span><span>{c.sport === 'soccer' ? (L.ranked ? `No. ${L.rank} attacker\u2019s career ever` : `Outside the top ${L.of} attackers ever`) : L.ranked ? `No. ${L.rank} ${POS_LABEL[c.pos]} career ever` : `Outside the top ${L.of} ${POS_LABEL[c.pos]} careers`}</span></div>
      {sportOf(c).ui?.legacyHow ? <p className="cr-legacy-how">{sportOf(c).ui.legacyHow}</p> : <p className="cr-legacy-how">Points come from seasons played, {sportOf(c).honor}s, {sportOf(c).first} teams, {c.pos === 'ol' ? '' : `${AWARD_NAME[c.pos]}s, `}rings, playoff runs, records and the career's numbers: the same formula that scores the all-time greats' real careers.</p>}
      <Extras c={c} />
    </div>
  )
}

// ── Draft ───────────────────────────────────────────────────────────────────
function Draft({ c, setCareer }) {
  const S = sportOf(c), logoFor = S.logo, teamName = short => S.teamOf(short).name
  const soccer = !!S.isSoccer
  const [step, setStep] = useState(c.step === 'trivia' ? 'interview' : c.step ?? 'combine')   // eslint-disable-line
  const [shown, setShown] = useState(0)
  // an answer lands: that team's interest, up or down, for a moment
  const [flash, setFlash] = useState(null)
  const flashT = useRef(null)
  const flashIt = (team, st) => { if (!st) return; clearTimeout(flashT.current); setFlash({ team, up: st > 0, k: Date.now() }); flashT.current = setTimeout(() => setFlash(null), 1300) }
  useEffect(() => () => clearTimeout(flashT.current), [])
  const range = stockText(c).toUpperCase()
  const go = s => { setStep(s); setCareer({ ...c, step: s }); sfx('tap') }
  const head = (kicker, title) => (
    <div className="ag-screen-head"><div><span className="ag-eyebrow">{kicker}</span><h1 className="ag-h1">{title}</h1></div><span className="cr-stock"><small>{soccer ? 'THE SCOUTS SAY' : 'PROJECTED'}</small><b>{range}</b></span></div>
  )
  // a career saved before the interviews had teams: set them up
  useEffect(() => { if (step === 'interview' && !c.draft.interviews?.[0]?.team) setCareer(setupInterviews({ ...c, step: 'interview' })) }, [step]) // eslint-disable-line
  // draft day: the picks tick by until yours
  useEffect(() => {
    if (step !== 'day' || !c.draft.picks) return
    if (shown >= c.draft.picks.length) return
    const id = setTimeout(() => { setShown(n => n + 1); sfx(shown + 1 === c.draft.picks.length ? 'claim' : 'tick') }, shown === 0 ? 600 : 900)
    return () => clearTimeout(id)
  }, [step, shown, c.draft.picks])
  // soccer's academy: the offers from the clubs, in place of draft day
  if (soccer && step === 'offers') {
    const offers = c.draft.offers ?? []
    return (
      <div className={`ag-screen ${S.screen} cr`}>
        {head('THE ACADEMY · FIRST CONTRACT', `${offers.length} ${offers.length === 1 ? 'club wants' : 'clubs want'} ${nick(c.name)}`)}
        <div className="ag-screen-body">
          <div className="cr-offers ag-pop">
            <span className="ag-eyebrow">PICK ONE · A FIRST PROFESSIONAL CONTRACT</span>
            {offers.map(o => (
              <button key={o.team} className="cr-offer" onClick={() => { setCareer(signAcademy(c, o)); sfx('purchase'); haptic('success') }}>
                <img src={logoFor(o.team)} alt="" />
                <span className="cr-offer-txt"><b>{o.fit.name}</b><small>{o.pitch}</small><i>{o.fit.conf} · {o.fit.status} · {o.stand.role === 'Starter' ? 'First choice' : `${o.stand.role === 'Rotation' ? 'Rotation' : 'Bench'}, behind ${o.stand.behind}`}{o.met ? ' · met him' : ''}</i></span>
                <span className="cr-offer-money"><b>{wageText(o.perYear, o.team).replace(' a week', '')}</b><small>A WEEK · {o.years} YRS</small></span>
              </button>
            ))}
          </div>
          <p className="cr-note">A bigger club is a bigger stage, and a longer wait for a place in the team. A smaller one plays him every week.</p>
          <Comp c={c} />
        </div>
      </div>
    )
  }
  if (step === 'combine') {
    const next = c.draft.combine.find(d => d.score == null)
    const allDone = !next
    return (
      <div className={`ag-screen ${S.screen} cr`}>
        {head(`${S.ui?.combine ?? (soccer ? 'ACADEMY TRIALS' : 'THE COMBINE')} · ${POS_LABEL[c.pos]}`, allDone ? (soccer ? `${nick(c.name)}'s trials` : `${nick(c.name)}'s numbers`) : next.label)}
        <div className="ag-screen-body">
          {c.college && <p className="cr-note cr-college">Out of College Football: {c.college.seasons?.length ? c.college.line : <>{c.college.schoolName ?? c.college.school}{c.college.line ? ` · ${c.college.line}` : ''}</>}</p>}
          {!allDone && <CareerGame c={c} setCareer={setCareer} skipAll={false} retry redo key={next.id} game={next.id} build={c.build} pos={combinePos(c)} seed={`${c.seed}-cb-${next.id}`} lock={`${c.seed}-cb-${next.id}`} onDone={res => setCareer(recordCombine(c, next.id, res.score, res.raw))} />}
          <div className="cr-drills ag-pop" style={{ '--d': '60ms' }}>
            {c.draft.combine.map((d, i) => (
              <div key={d.id} className={`cr-drill${d.score == null ? ' is-wait' : ''}`} style={{ '--d': `${80 + i * 70}ms` }}>
                <span className="cr-drill-txt"><b>{d.label}</b><small>{POS_ATTR[c.pos][d.trait]?.label ?? d.trait}</small></span>
                <span className="cr-drill-bar"><span style={{ width: `${d.pct == null ? 0 : Math.round(Math.max(6, Math.min(100, 50 + d.pct * 50)))}%`, background: (d.pct ?? 0) >= .35 ? '#22c55e' : (d.pct ?? 0) >= 0 ? '#eab308' : '#f97316' }} /></span>
                <b className="cr-drill-n">{d.text ?? '—'}</b>
              </div>
            ))}
          </div>
          {allDone ? (
            <>
              <p className="cr-note ag-pop">{S.ui?.combineDone ? S.ui.combineDone(c) : soccer ? `The scouts saw every trial, and their report moved with it. Next: the coaches and scouts at four clubs want to sit down with ${c.name}.` : `Scouts saw the whole workout, and the projection moved with it. Next: four teams picking near ${c.name}'s projected range want a sit-down.`}</p>
              <button className="ag-btn tk-intro-go" onClick={() => { setCareer(setupInterviews({ ...c, step: 'interview' })); setStep('interview'); sfx('tap') }}>{soccer ? 'MEET THE CLUBS' : 'THE INTERVIEWS'} <IconArrow size={16} /></button>
            </>
          ) : (
            <>
              <p className="cr-note">Three {soccer ? 'trials' : 'drills'}, one go each. The trait sets the range; how the {soccer ? 'trial' : 'drill'} goes sets the number.</p>
              <button className="ag-btn ag-btn--ghost" onClick={() => { setCareer(skipCombine(c)); sfx('tap') }}>{S.ui?.combineSkip ?? (soccer ? 'SKIP THE TRIALS' : 'SKIP COMBINE')}</button>
            </>
          )}
          {/* the comp, from the start of the pre-draft: who this build plays like */}
          <Comp c={c} />
        </div>
      </div>
    )
  }
  if (step === 'interview') {
    const list = c.draft.interviews ?? []
    if (!list[0]?.team) return null
    const i = list.findIndex(x => x.answer == null)
    const done = i < 0
    const it = list[i]
    return (
      <div className={`ag-screen ${S.screen} cr`}>
        {head(soccer ? 'THE SCOUTS AND COACHES' : 'THE INTERVIEWS', done ? (soccer ? 'Meetings done' : 'Interviews done') : `${soccer ? 'Meeting' : 'Interview'} ${i + 1} of ${list.length}`)}
        <div className="ag-screen-body">
          {flash && <div key={flash.k} className={`cr-flash${flash.up ? ' is-up' : ' is-down'}`} aria-live="polite"><img src={logoFor(flash.team)} alt="" /><span className="cr-flash-arrow"><IconCaret dir={flash.up ? 'up' : 'down'} size={14} /></span><small>INTEREST {flash.up ? 'UP' : 'DOWN'}</small></div>}
          <Comp c={c} />
          {i === 0 && (
            <div className="cr-howto ag-pop">
              <span className="ag-eyebrow">HOW INTERVIEWS WORK</span>
              <p>{soccer ? 'Four clubs at his level sit him down, one question each. A good answer raises that club\u2019s interest and lifts what the scouts think of him; a bad one does the opposite. A club that liked him is likelier to offer him a contract.' : 'Four teams picking near his projected range sit him down, one question each. A good answer raises that team\'s interest and moves his stock up about two picks; a bad one does the opposite. On draft day, a team that liked him is likelier to take him when he\'s still on the board at its pick.'}</p>
            </div>
          )}
          {!done ? (
            <div className="cr-q ag-pop" key={i}>
              <div className="cr-q-team"><img src={logoFor(it.team)} alt="" /><span><b>{teamName(it.team)}</b><small>{it.who.toUpperCase()}</small></span></div>
              <p className="cr-q-text">"{it.q}"</p>
              <div className="cr-q-opts">{it.a.map((a, k) => <button key={k} className="cr-q-opt" onClick={() => { setCareer(answerInterview(c, i, k)); flashIt(it.team, a.stock); sfx(a.stock > 0 ? 'claim' : a.stock < 0 ? 'deny' : 'tap') }}>{a.t}</button>)}</div>
            </div>
          ) : (
            <div className="cr-q ag-pop">
              {soccer
                ? <p className="cr-q-text">The meetings are done. The scouts have {c.name} down as <b>{stockText(c).toLowerCase()}</b>{(() => { const fans = list.filter(x => x.a[x.answer].stock > 0).map(x => teamName(x.team)); return fans.length ? `. ${fans.length > 1 ? `${fans.slice(0, -1).join(', ')} and ${fans[fans.length - 1]}` : fans[0]} came away the keenest.` : '. No club came away sold, so it comes down to the trials.' })()}</p>
                : <p className="cr-q-text">The interviews are done. {c.name} is projected to go <b>{stockText(c).toLowerCase()}</b>{(() => { const fans = list.filter(x => x.a[x.answer].stock > 0).map(x => nick(teamName(x.team))); return fans.length ? `. The ${fans.length > 1 ? `${fans.slice(0, -1).join(', ')} and ${fans[fans.length - 1]}` : fans[0]} came away the most interested.` : '. No team came away sold, so it comes down to need.' })()}</p>}
              <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { setCareer(runDraft({ ...c, step: 'day' })); setStep(soccer ? 'offers' : 'day'); setShown(0); sfx('whistle') }}>{soccer ? 'THE OFFERS' : 'DRAFT DAY'} <IconArrow size={16} /></button>
            </div>
          )}
        </div>
      </div>
    )
  }
  // day: the ticker, then the landing spot
  const picks = c.draft.picks ?? []
  const mine = c.draft.pick
  const landed = shown >= picks.length
  return (
    <div className={`ag-screen ${S.screen} cr cr--team`} style={landed ? teamVars(c.fit) : undefined}>
      <div className="ag-screen-head"><div><span className="ag-eyebrow">DRAFT DAY</span><h1 className="ag-h1">{landed ? 'Drafted' : 'On the clock'}</h1></div></div>
      <div className="ag-screen-body">
        <div className="cr-ticker ag-pop">
          {picks.slice(0, shown).map(p => (
            <div key={p.o} className={`cr-pick${p.you ? ' is-you' : ''}`}>
              <span className="cr-pick-n"><small>RD {p.round}</small>{p.slot}</span>
              <img src={logoFor(p.team)} alt="" />
              <span className="cr-pick-txt">{p.you ? <b><Scramble text={`${c.name} · ${POS_LABEL[c.pos]}`} ms={900} /></b> : <><b><Scramble text={p.player} ms={500} /></b><small>{p.pos}</small></>}{p.trade && <small className="cr-pick-trade">TRADED UP</small>}</span>
            </div>
          ))}
          {!landed && <div className="cr-pick is-wait"><span className="bt-dots"><i /><i /><i /></span> {picks[shown] ? `The ${nick(teamName(picks[shown].team))} are on the clock…` : ''}</div>}
        </div>
        {landed && mine && c.fit && (
          <>
            <div className="cr-land ag-pop" style={{ '--tc': c.fit.color }}>
              <img src={logoFor(c.team)} alt="" className="cr-land-logo" />
              <div className="cr-land-txt">
                <span className="ag-eyebrow">{pickText(mine.o, c.sport).toUpperCase()} · NO. {mine.o} OVERALL</span>
                <b>{c.fit.name}</b>
                <small>{S.x?.landText ? S.x.landText(c) : <>Rookie deal: {c.contract.years} yrs · {money(c.contract.perYear)} a year{c.contract.option ? (S.isBucket ? ' · team options' : ' · 5th-year option') : ''}</>}</small>
              </div>
            </div>
            <Lineup c={c} />
            <TeamFit c={c} />
            <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { setCareer({ ...c, phase: 'preseason', step: null }); sfx('purchase'); haptic('success') }}>{S.ui?.signDraft ?? 'SIGN THE ROOKIE DEAL'} <IconArrow size={16} /></button>
          </>
        )}
      </div>
    </div>
  )
}

// ── The player comp: who this build plays like (the build screen shows the same card) ──
const Comp = ({ c }) => <PlayerComp c={c} who={c.name.toUpperCase()} />

// ── The team around you ──────────────────────────────────────────────────────
const initials = n => (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('')
const shortName = n => { const p = (n || '').split(' '); return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : n }
// the screen wears the team's color (a near-black primary hands over to the second color)
const lum = hex => { const n = parseInt((hex || '#000').slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255 }
const teamVars = f => (f ? { '--tc': lum(f.color) < 0.12 ? f.color2 : f.color, '--tc2': lum(f.color) < 0.12 ? f.color : f.color2 } : undefined)
// the team's 1–10 ratings on the grade scale
const teamGrade = v => Math.min(11, v * 1.1)
function TeamFit({ c }) {
  const S = sportOf(c), f = c.fit
  // (a football career saved before the groups: rebuild them from the old fields)
  const groups = f.groups ?? [...(c.pos !== 'qb' ? [{ k: 'QB', v: f.qb, names: [f.qbName] }] : []), { k: 'O-LINE', v: f.ol, names: [] }, { k: 'WEAPONS', v: f.weapons, names: [] }]
  // the division from the team itself (a career saved before the NBA had divisions read "Western Conference")
  const div = S.teamOf(f.short)?.div ?? f.div
  const G = ({ k, v, sub }) => <span className="cr-fit-g"><b style={{ color: gradeColor(v) }}>{gradeOf(v)}</b><small>{k}</small>{sub && <i>{sub}</i>}</span>
  if (S.isSoccer) return (
    <div className="cr-fit ag-pop" style={{ '--d': '80ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE CLUB AROUND {c.name.toUpperCase()}</span><span className="cr-fit-status">{f.status}</span></div>
      <div className="cr-fit-grid">
        <G k="ATTACK" v={teamGrade(f.off)} /><G k="DEFENCE" v={teamGrade(f.def)} />
        {groups.map(g => <G key={g.k} k={g.k} v={g.v} sub={g.names?.length === 1 ? nick(g.names[0]) : null} />)}
      </div>
      <div className="cr-fit-meta"><span>{f.conf}</span></div>
    </div>
  )
  return (
    <div className="cr-fit ag-pop" style={{ '--d': '80ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE {S.isBucket ? 'TEAM' : S.isBaseball ? 'CLUB' : S.side?.[c.pos] === 'def' ? 'DEFENSE' : 'OFFENSE'} AROUND {c.name.toUpperCase()}</span><span className="cr-fit-status">{f.status}</span></div>
      <div className="cr-fit-grid">
        {groups.map(g => <G key={g.k} k={g.k} v={g.v} sub={g.names?.length === 1 ? nick(g.names[0]) : null} />)}
        {S.side?.[c.pos] === 'def' && <G k="OFFENSE" v={teamGrade(f.off)} />}<G k="DEFENSE" v={teamGrade(f.def)} />
      </div>
      <div className="cr-fit-meta"><span>{f.conf}{div && div !== f.conf ? ` · ${div}` : ''}</span></div>
    </div>
  )
}
// The starting offense on a field: you in your spot if you've won it
function Lineup({ c }) {
  const S = sportOf(c)
  const L = useMemo(() => lineup(c), [c.roster, c.ovr, c.name, c.lastRole, c.contract, c.pos, c.active?.k]) // eslint-disable-line
  if (S.isBaseball) return <Suspense fallback={null}><BaseballLineup c={c} /></Suspense>
  const dc = L.depth
  const Man = ({ p, slot }) => { if (!p) return <span className="crl-man is-empty" />; const age = p.you ? c.age : p.age; return (
    <span className={`crl-man${p.you ? ' is-you' : ''}`}>
      <span className="crl-face">
        {p.you ? <CareerFace c={c} size={S.isBucket || S.isSoccer ? 48 : 34} /> : p.photo ? <img src={photoSrc(p.photo)} alt="" loading="lazy" /> : <span className="crl-init">{initials(p.name)}</span>}
        <i style={{ background: gradeColor(ovrGradeVal(p.ovr)) }}>{p.ovr}</i>
      </span>
      {p.you ? <b className="cr-me-name" style={{ color: legacyColor(c) }}>{c.name}</b> : <b>{S.isBucket || S.isSoccer ? shortName(p.name) : nick(p.name)}</b>}
      {!S.isBucket && <small>{slot}</small>}
      {/* the starters' ages, like the bench's */}
      {age != null && <small className="crl-age">{S.isSoccer ? (p.rookie && age <= 20 ? 'ACADEMY · AGE ' : 'AGE ') : p.rookie ? (S.isBucket ? 'ROOKIE · AGE ' : 'ROOKIE ') : 'AGE '}{age}</small>}
    </span>
  ) }
  // a man in the formation: his place on the field; `low` drops his name a line, so the names along a crowded line of scrimmage clear each other
  const At = ({ p, slot, col, row, low, edge }) => (p ? <span className={`crl-at${low ? ' is-low' : ''}${edge ? ` is-${edge}` : ''}`} style={{ gridColumn: col, gridRow: row }}><Man p={p} slot={slot} /></span> : null)
  const last = dc.ahead[dc.ahead.length - 1]
  if (S.isSoccer) {
    const role = soccerRole(c)
    const supply = c.fit?.groups?.find(g => g.k === 'SUPPLY')?.names ?? []
    return (
      <div className="ag-card crl ag-pop">
        <div className="ag-card-head"><span className="ag-eyebrow">{c.fit?.name?.toUpperCase()} · THE FORWARDS</span><span className={`crl-role${dc.starter ? ' is-on' : ''}`}>{role === 'Starter' ? 'FIRST CHOICE' : role.toUpperCase()}</span></div>
        <div className="crl-field crl-field--court">
          <div className="crl-row">{dc.all.slice(0, 1).map(p => <Man key={p.name} p={p} slot="ST" />)}</div>
          <div className="crl-row">{dc.all.slice(1, 4).map(p => <Man key={p.name} p={p} slot="ST" />)}</div>
        </div>
        <div className="crl-bench">
          <span className="ag-eyebrow">THE NO. 9 SHIRT</span>
          {dc.all.map((p, i) => (
            <span key={p.name + i} className={`crl-depth${p.you ? ' is-you' : ''}`}><i>{i === 0 ? 'ST1' : `ST${i + 1}`}</i><b>{p.name}</b><small>{p.out ? <em className="crl-out">{p.out}</em> : `${p.ovr} OVR · age ${p.age}`}</small></span>
          ))}
          {supply.length > 0 && <><span className="ag-eyebrow">THE SUPPLY</span><p className="cr-note">{supply.join(', ')}</p></>}
        </div>
        {!dc.starter && last && <p className="cr-note">Behind {last.name} for now. Score when he gets his chances and the shirt is {c.name}'s: the manager picks on form.</p>}
      </div>
    )
  }
  return (
    <div className="ag-card crl ag-pop">
      <div className="ag-card-head"><span className="ag-eyebrow">{c.fit?.name?.toUpperCase()} · {S.isBucket ? 'STARTING FIVE' : S.side?.[c.pos] === 'def' ? 'STARTING DEFENSE' : 'STARTING OFFENSE'}</span><span className={`crl-role${dc.starter ? ' is-on' : ''}`}>{S.isBucket ? (dc.starter ? 'STARTER' : 'BENCH') : `${dc.starter ? 'STARTER' : 'BACKUP'} · ${dc.label}`}</span></div>
      {S.side?.[c.pos] === 'def' ? (
        // the defense, seen from behind it: the four down linemen on the line, a corner
        // out wide on each side, the linebackers behind the line and the safeties deep
        <div className="crl-field crl-form crl-form--def">
          {(() => {
            const dl = L.dl ?? [], edges = dl.filter(p => p.slot === 'edge'), dts = dl.filter(p => p.slot === 'dt')
            const mySlot = dbSpot(c)
            const db = (L.db ?? []).map(p => ({ ...p, slot: p.you ? mySlot : p.slot === 's' ? 's' : 'cb' }))
            const cbs = db.filter(p => p.slot === 'cb'), ss = db.filter(p => p.slot === 's')
            while (cbs.length > 2) ss.push(cbs.pop()); while (ss.length > 2) cbs.push(ss.pop())
            const front = [cbs[0], edges[0], dts[0], dts[1], edges[1], cbs[1]]
            const lbs = L.lb ?? [], back = lbs.length ? 3 : 2
            const tight = front.some(p => p && (p.you ? c.name : nick(p.name)).length > 8)
            return <>
              <i className="crl-los" />
              <At p={cbs[0]} slot="CB" col={1} row={1} edge="l" />
              <At p={edges[0]} slot="LEDGE" col={2} row={1} low={tight} />
              <At p={dts[0]} slot="DT1" col={3} row={1} />
              <At p={dts[1]} slot="DT2" col={4} row={1} low={tight} />
              <At p={edges[1]} slot="REDGE" col={5} row={1} />
              <At p={cbs[1]} slot="CB" col={6} row={1} edge="r" low={tight} />
              <At p={lbs[1]} slot="WILL" col={2} row={2} />
              <At p={lbs[0]} slot="MIKE" col="3 / 5" row={2} />
              <At p={lbs[2]} slot="SAM" col={5} row={2} />
              <At p={ss[0]} slot="S" col={2} row={back} />
              <At p={ss[1]} slot="S" col={5} row={back} />
            </>
          })()}
        </div>
      ) : S.isBucket ? (
        <div className="crl-field crl-field--court">
          <div className="crl-row">{L.guard.map(p => <Man key={p.name} p={p} slot={p.slot ?? 'G'} />)}</div>
          <div className="crl-row">{L.big.map(p => <Man key={p.name} p={p} slot={p.slot ?? 'F/C'} />)}</div>
        </div>
      ) : (
        // 11 personnel, seen from behind the offense: a receiver split wide on each side, the
        // five linemen with the tight end on the right, the slot off the line, the quarterback
        // under center and the back behind him
        <div className="crl-field crl-form crl-form--off">
          <i className="crl-los" />
          <At p={L.wr[0]} slot="WR" col={1} row={1} edge="l" />
          {L.ol.map((p, i) => <At key={p.name} p={p} slot={p.slot ?? ['LT', 'LG', 'C', 'RG', 'RT'][i]} col={i + 2} row={1} low={i % 2 === 0} />)}
          <At p={L.te[0]} slot="TE" col={7} row={1} />
          <At p={L.wr[1]} slot="WR" col={8} row={1} edge="r" low />
          <At p={L.wr[2]} slot="SLOT" col="1 / 3" row={2} />
          <At p={L.qb[0]} slot="QB" col={4} row={2} />
          <At p={L.rb[0]} slot="RB" col={4} row={3} />
        </div>
      )}
      {S.isBucket ? (
      <div className="crl-bench">
        <span className="ag-eyebrow">BENCH</span>
        {L.reserves.map((p, i) => (
          <span key={p.name + i} className={`crl-depth crl-depth--bench${p.you ? ' is-you' : ''}`}><b>{p.you ? c.name : p.name}</b><small>age {p.age}</small><em style={{ background: gradeColor(ovrGradeVal(p.ovr)) }}>{p.ovr}</em></span>
        ))}
      </div>
      ) : (
      <div className="crl-bench">
        <span className="ag-eyebrow">DEPTH CHART · {c.pos === 'ol' ? OL_SPOT_NAME[olSpot(c)] : c.pos === 'dl' ? (dlSpot(c) === 'dt' ? 'DEFENSIVE TACKLE' : 'EDGE') : c.pos === 'db' ? (dbSpot(c) === 's' ? 'SAFETY' : 'CORNERBACK') : POS_NAME[c.pos].toUpperCase()}</span>
        {dc.all.map((p, i) => (
          <span key={p.name + i} className={`crl-depth${p.you ? ' is-you' : ''}`}><i>{S.isBucket ? i + 1 : `${c.pos === 'ol' ? olSpot(c) : c.pos === 'dl' ? dlSpotLabel(dlSpot(c)) : c.pos === 'db' ? (dbSpot(c) === 's' ? 'S' : 'CB') : POS_LABEL[c.pos]}${i + 1}`}</i><b>{p.name}</b><small>{p.out ? <em className="crl-out">{p.out}</em> : `${p.ovr} OVR · age ${p.age}`}</small></span>
        ))}
      </div>
      )}
      {!dc.starter && last && <p className="cr-note">Behind {last.name} for now. Outplay him and the job comes to {c.name}: the {S.isBucket ? 'minutes open' : 'starter\'s spot opens'} with injuries, slumps and trades.</p>}
    </div>
  )
}

// ── Hub ─────────────────────────────────────────────────────────────────────
export default function AppCareer({ career: c, setCareer, user, onNewBuild, onExit }) {
  const [tab, setTab] = useState('season')
  const [recHit, setRecHit] = useState(null)       // an all-time record just fell
  const [honor, setHonor] = useState(null)         // an award or a title, just won
  const D = useRef(null)
  const boosts = useProgress().boosts ?? {}
  const ready = useSport(c?.sport ?? 'nfl')
  // the player's own name (picked when the career began); never "You"
  useEffect(() => { if (c && ready) saveCareer(c) }, [c, ready])
  useEffect(() => { if (ready && c?.phase === 'season' && c.active && !D.current) D.current = resumeSeason(c) }, [c?.phase, ready]) // eslint-disable-line
  if (!c || !ready) return null
  const S = sportOf(c), logoFor = S.logo
  if (c.phase === 'college') return <Suspense fallback={<div className="ag-screen ag-screen--wait" />}><CareerCollege c={c} setCareer={setCareer} onExit={onExit} /></Suspense>
  if (c.phase === 'draft') return <Draft c={c} setCareer={setCareer} />
  // the comeback (BAP Pro): back into the offseason he retired in, on the season tab
  if (c.phase === 'retired') return <Legacy c={c} setCareer={setCareer} user={user} onUnretire={() => { setCareer(unretire(c)); setTab('season'); sfx('whistle'); haptic('success') }} onNewBuild={onNewBuild} onExit={onExit} />

  const L = legacyOf(c)
  const begin = () => { const [n, d] = startSeason(c); D.current = d; setCareer(n); sfx('whistle'); haptic('medium') }
  const advance = () => {
    if (!D.current) D.current = resumeSeason(c)
    const [n, ev] = advanceWeek(c, D.current)
    setCareer(n)
    if (ev?.injury) { sfx('deny'); haptic('heavy'); return }
    if (ev?.game) { sfx(ev.game.won ? 'pop' : 'lock'); if (ev.hits?.some(h => h.big)) sfx('chime') }
    if (ev?.hits?.some(h => h.record)) setRecHit(D.current.records[D.current.records.length - 1])
    if (ev?.moment) haptic('medium')
  }
  const pick = o => { const [n, out] = chooseMoment(c, D.current, o); setCareer(n); return out }
  const injury = (play, heal = false) => {
    if (heal && !spendBoost('heal')) return
    const [n] = resolveInjury(c, D.current, play, heal); setCareer(n); sfx(heal ? 'claim' : 'tap')
  }
  // Hot Hand: spend one, then the next few games run a grade up
  const goHot = () => {
    if (!D.current) D.current = resumeSeason(c)
    if (!canHotHand(c, D.current) || !spendBoost('hot')) return
    setCareer(hotHand(c, D.current)); sfx('claim'); haptic('success')
  }
  // the regular season's over: straight to the offseason, or into the bracket
  const wrap = () => {
    if (!D.current) D.current = resumeSeason(c)
    const n = finishRegular(c, D.current); D.current = null
    if (n.phase === 'offseason') { afterBook(n) } else { setCareer(n); sfx('whistle') }
  }
  const book = () => afterBook(bookSeason(c))
  const afterBook = n => {
    const s = n.seasons[n.seasons.length - 1]
    window.dispatchEvent(new CustomEvent('bap:season', { detail: { sport: c.sport, pos: c.pos, mode: 'career', localOnly: true, sandbox: !!c.sandbox, wins: s.wins, losses: s.losses, playoffs: s.playoffs, champion: s.champion, award: s.award, awardName: s.awardName, ovr: c.ovr, ref: c.active?.final ?? null } }))
    setCareer(n); setTab('season')
    if (S.isSoccer && (s.trophies?.length || s.award || s.wc?.champion)) setHonor({
      colors: s.trophies?.length || s.wc?.champion ? [c.fit?.color, c.fit?.color2, '#ffffff'] : null,
      season: s.season, team: (s.teamName ?? '').toUpperCase(),
      title: s.award ? s.awardName : s.wc?.champion ? 'WORLD CHAMPIONS' : s.uclWon ? 'CHAMPIONS OF EUROPE' : s.champion ? `${String(s.league ?? 'LEAGUE').toUpperCase()} CHAMPIONS` : `${String(s.trophies[0]).toUpperCase()} WINNERS`,
      sub: [s.award ? 'The best player in the world' : null, ...(s.trophies ?? []), s.wc?.champion ? `The World Cup with ${nationName(c.nation)}` : null].filter(Boolean).join(' · '),
      line: `${s.stats.goals} goals · ${s.stats.assists} assists · ${s.stats.apps} apps`,
    })
    else if (s.champion || s.award) setHonor({
      colors: s.champion ? [c.fit?.color, c.fit?.color2, '#ffffff'] : null,
      season: s.season, team: (s.teamName ?? '').toUpperCase(),
      title: s.award && s.champion ? `${s.awardName} + ${S.ui?.champ ?? (S.isBucket ? 'CHAMPION' : 'SUPER BOWL')}` : s.award ? s.awardName : S.ui?.champs ? S.ui.champs : S.isBucket ? 'NBA CHAMPIONS' : 'SUPER BOWL CHAMPIONS',
      sub: s.award ? `${{ MVP: 'Most Valuable Player', OPOY: 'Offensive Player of the Year', DPOY: 'Defensive Player of the Year', 'CY YOUNG': 'The Cy Young Award', 'MVP + CY YOUNG': 'The MVP and the Cy Young' }[s.awardName] ?? s.awardName}${s.champion ? ', and a ring' : ''}` : `${s.wins}–${s.losses}, then all the way`,
      line: HEADLINE_STATS[c.pos].map(k => `${fmtK(S, k, s.stats[k])} ${STAT_LABEL[k]}`).join(' · '),
    })
    else sfx('complete')
  }
  const a = c.active
  const total = a?.base?.games?.length ?? 17
  const unitOne = S.isSoccer ? 'match' : 'game', unitMany = S.isSoccer ? 'matches' : 'games'
  // the record from the feed: single games (football) and runs of games (basketball)
  const played = a ? a.feed.flatMap(e => (e.g ? [e.g] : e.chunk ? e.games : [])) : []
  const wins = played.filter(g => g.won).length, draws = S.isSoccer ? played.filter(g => g.drawn).length : 0, losses = played.length - wins - draws
  const recText = S.isSoccer ? `${wins}–${draws}–${losses}` : `${wins}–${losses}`
  const seasonOver = a && a.k >= total && !a.moment && !a.injury && !a.po
  const last = c.seasons[c.seasons.length - 1]
  const cb = comebackYear(c)

  return (
    <div className={`ag-screen ${S.screen} cr cr-hub cr--team`} style={teamVars(c.fit)}>
      {recHit && <RecordOverlay record={recHit} name={c.name || 'Guest'} onClose={() => setRecHit(null)} />}
      {honor && !recHit && <HonorOverlay honor={honor} name={c.name || 'Guest'} onClose={() => setHonor(null)} />}
      <div className="ag-screen-head">
        <div className="cr-head">
          <img src={logoFor(c.team)} alt="" className="cr-head-logo" />
          {/* the team, the player (his name, not the account's look), then where he is in it */}
          <div className="cr-head-txt">
            <span className="ag-eyebrow cr-head-team">{c.sandbox && <b className="sb-tag">SANDBOX</b>}{c.fit?.name?.toUpperCase()}</span>
            <h1 className="ag-h1 cr-head-name" style={{ fontSize: (c.name ?? '').length > 14 ? 26 : (c.name ?? '').length > 10 ? 31 : 36 }}>{c.name} <small>{POS_LABEL[c.pos]}</small></h1>
            {/* the build's body (the Size chip's player), where a roster card puts it: after the age */}
            <span className="cr-head-meta">YEAR {c.year + 1} · AGE {c.age} · {careerBody(c) ? `${bodyText(careerBody(c), ' ')} · ` : ''}{S.isSoccer ? seasonOf(c.season) : c.season}</span>
            {cb && <span className="cr-head-cb">{cb.done ? 'COMEBACK · ALL SEASONS PLAYED' : `COMEBACK · YEAR ${cb.n} OF ${cb.of}`}</span>}
          </div>
        </div>
        <button className="ag-round-btn" onClick={onExit} aria-label="Home"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <LegacyMeter c={c} />
        <Model c={c} devPick={c.phase !== 'season' && c.dev.points > 0 ? t => { setCareer(t === '__body' ? bodyWork(c) : spendDev(c, t)); sfx('claim'); haptic('success') } : null} />
        {c.phase !== 'season' && c.dev.points > 0 && <div className="cr-devnote ag-pop"><IconStar size={14} /> <b>{c.dev.points}</b> development {c.dev.points === 1 ? 'point' : 'points'}: tap a trait to raise it.</div>}
        <GamesSwitch c={c} setCareer={setCareer} />
        {canChangeNumber(c) && numberClash(c) && <NumberClash c={c} setCareer={setCareer} />}
        <div className="ag-seg cr-tabs" role="tablist">
          {[['season', c.phase === 'offseason' ? 'OFFSEASON' : 'SEASON'], ['player', 'PLAYER'], ['team', 'TEAM'], ['career', 'CAREER']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => { setTab(id); sfx('tap') }}>{tab === id && <motion.span layoutId="seg-career" className="ag-seg-pill" transition={SPRING_LAYOUT} />}{label}</button>
          ))}
        </div>

        {tab === 'season' && c.phase === 'preseason' && (
          <section className="ag-card cr-sec ag-pop">
            <div className="ag-card-head"><span className="ag-eyebrow">SEASON {S.isSoccer ? seasonOf(c.season) : c.season} · {c.fit.status.toUpperCase()}</span></div>
            {c.aging?.length > 0 && <ul className="cr-bul">{c.aging.map((t, i) => <li key={i}>{/^(Still growing|A step forward)/.test(t) ? <IconFlame size={13} /> : <IconArrow size={13} className="cr-down" />} {t.replace(/^A step slower/, 'Father Time')}</li>)}</ul>}
            <div className="cr-goals"><span className="ag-eyebrow">THIS YEAR'S GOALS</span>{goalsFor(c).map(g => <span key={g.k} className="cr-goal">{g.label}</span>)}</div>
            {(() => { const dc = depthChart(c); if (S.x?.depthLine) return <p className={`cr-depthline${dc.starter ? ' is-on' : ''}`}>{S.x.depthLine(c, dc)}</p>; if (S.isSoccer) { const role = soccerRole(c); return <p className={`cr-depthline${dc.starter ? ' is-on' : ''}`}>{role === 'Starter' ? 'FIRST CHOICE · leads the line' : `${role.toUpperCase()} · behind ${dc.ahead[dc.ahead.length - 1].name}`}</p> } return <p className={`cr-depthline${dc.starter ? ' is-on' : ''}`}>{dc.starter ? `${dc.label} · the starter` : `${dc.label} · backup behind ${dc.ahead[dc.ahead.length - 1].name}`}</p> })()}
            <p className="cr-note">{c.loan ? `On loan from ${S.teamOf(c.loan.from).name} for the season. ` : ''}{c.contract.left} {c.contract.left === 1 ? 'year' : 'years'} left on the deal ({pay(c, c.contract.perYear)}). {c.contract.left === 1 && !c.loan ? 'Contract year: play for the next one.' : ''}</p>
            <button className="ag-btn ag-btn--gold tk-intro-go" onClick={begin}>START THE SEASON <IconArrow size={16} /></button>
          </section>
        )}

        {tab === 'season' && c.phase === 'season' && a && (
          <section className="cr-sec">
            <div className="cr-season-bar ag-pop">
              <span className="cr-rec"><b>{recText}</b><small>{S.isSoccer ? `${wins * 3 + draws} PTS · MATCH ${Math.min(a.k + 1, total)} OF ${total}` : `${S.gameWord} ${Math.min(a.k + 1, total)} OF ${total}`}</small></span>
              <div className="cr-goals cr-goals--inline">{c.goals.map(g => <span key={g.k} className="cr-goal">{g.label}</span>)}</div>
            </div>
            {a.injury && (
              <div className="sm-moment cr-injury ag-pop">
                <span className="ag-eyebrow">INJURY · {S.gameWord} {a.k}</span>
                <h3 className="sm-moment-title">{a.injury.kind}</h3>
                <p className="sm-moment-body">{a.injury.serious ? `The trainers don't need a second look. ${c.name}'s season is over.` : `The doctors say ${a.injury.games} ${a.injury.games === 1 ? unitOne : unitMany}. ${c.name} could play through it: not at his best for longer, and it can get worse.`}</p>
                <div className="sm-options">
                  <button className="sm-option" onClick={() => injury(false)}><b>{a.injury.serious ? 'Shut it down' : `Sit out ${a.injury.games} ${a.injury.games === 1 ? unitOne : unitMany}`}</b><small>Heal up. The {S.isSoccer ? 'club' : 'team'} plays on without him.</small></button>
                  {!a.injury.serious && <button className="sm-option" onClick={() => injury(true)}><b>Play through it</b><small>Two traits down for {a.injury.games + 2} {unitMany}. 35% it gets worse. Costs durability.</small></button>}
                  {!a.injury.serious && boosts.heal > 0 && <button className="sm-option cr-boost-opt" onClick={() => injury(false, true)}><b>Quick Heal: out {Math.max(1, Math.ceil(a.injury.games / 2))} {Math.ceil(a.injury.games / 2) <= 1 ? unitOne : unitMany}</b><small>Uses 1 of your {boosts.heal} Quick Heal{boosts.heal === 1 ? '' : 's'}. Back twice as fast.</small></button>}
                </div>
              </div>
            )}
            {a.moment && <MomentCard key={`${a.k}-${a.moment.id}`} moment={a.moment} onPick={pick} />}
            {hotHandOn(c) && <div className="cr-hot ag-pop"><IconFlame size={15} /> HOT HAND · two grades up through {S.isSoccer ? 'match' : S.gameWord.toLowerCase()} {a.hot.to}</div>}
            {!hotHandOn(c) && boosts.hot > 0 && canHotHand(c, D.current) && (
              <button className="cr-hot cr-hot--go ag-pop" onClick={goHot}><IconFlame size={15} /> USE HOT HAND <small>+2 every trait, next {Math.min(hotGames(c), total - a.k)} {S.isSoccer ? 'matches' : `${S.gameWord.toLowerCase()}s`} · {boosts.hot} left</small></button>
            )}
            {!a.moment && !a.injury && !seasonOver && !a.po && <button className="ag-btn ag-btn--gold tk-intro-go cr-advance" onClick={advance}>{S.isSoccer ? (Math.min(total, a.k + S.step) > a.k + 1 ? `PLAY MATCHES ${a.k + 1}–${Math.min(total, a.k + S.step)}` : `PLAY MATCH ${a.k + 1}`) : S.step > 1 ? `PLAY GAMES ${a.k + 1}–${Math.min(total, a.k + S.step)}` : `ADVANCE WEEK ${a.k + 1}`} <IconArrow size={16} /></button>}
            {a.po && <Playoffs c={c} setCareer={setCareer} onBook={book} />}
            {seasonOver && (
              <div className="ag-card cr-over ag-pop">
                <span className="ag-eyebrow">{S.isSoccer ? `THE LEAGUE IS DONE · ${recText} · ${wins * 3 + draws} PTS` : `REGULAR SEASON OVER · ${wins}–${losses}`}</span>
                {S.isSoccer ? <>
                  <p className="cr-note">{(wins * 3 + draws) / Math.max(1, played.length) >= 2 ? 'Up at the top of the table. Now the finals and the European nights, if the club got there.' : 'The league is in. The cup final and the European knockouts, if the club got there.'}</p>
                  <button className="ag-btn ag-btn--gold tk-intro-go" onClick={wrap}>THE FINAL TABLE <IconArrow size={16} /></button>
                </> : (() => { const pct = wins / Math.max(1, wins + losses); const sport = S.ui?.sportWord ?? (S.isBucket ? 'basketball' : 'football'); return <>
                  <p className="cr-note">{pct >= 0.58 ? `Playoff ${sport}. Let's see how far it goes.` : pct >= 0.45 ? (S.ui?.bubble ?? (S.isBucket ? 'On the bubble. The play-in might decide it.' : 'On the bubble. The tiebreakers decide it.')) : 'No postseason this year. Book it and move on.'}</p>
                  <button className="ag-btn ag-btn--gold tk-intro-go" onClick={wrap}>{pct >= 0.45 ? 'INTO THE PLAYOFFS' : 'WRAP THE SEASON'} <IconArrow size={16} /></button>
                </> })()}
              </div>
            )}
            <div className="cr-feed">
              {[...a.feed].reverse().map((e, i) => e.chunk ? (
                <Chunk key={`c${e.k}`} c={c} e={e} />
              ) : e.g ? (
                <div key={`g${e.k}`} className="cr-feed-game">
                  <NowCard game={e.g} pos={c.pos} sport={c.sport} team={{ short: c.team }} logoFor={x => logoFor(S.teams.find(t => t.short === x || t.name === x)?.short ?? x)} idx={e.k - 1} total={total} />
                  {(e.hits?.filter(h => h.big).length > 0 || e.headline?.length > 0) && (
                    <div className="cr-feed-lines">{e.hits?.filter(h => h.big).map(h => <span key={h.id} className="cr-ms"><IconStar size={12} /> {h.label}</span>)}{e.headline?.slice(0, 1).map((t, k) => <span key={k} className="cr-hl">{t}</span>)}</div>
                  )}
                </div>
              ) : e.note ? (
                <div key={`n${e.k}-${i}`} className="cr-feed-moment is-note"><span className="ag-eyebrow">{e.k ? `${S.gameWord} ${e.k} · ` : ''}{e.noteKind}</span><b>{e.note}</b></div>
              ) : e.moment ? (
                <div key={`m${e.k}-${i}`} className="cr-feed-moment"><span className="ag-eyebrow">{S.isSoccer ? `MATCH ${e.k + 1}` : S.isBaseball ? `GAME ${e.k + 1}` : `${S.gameWord} ${e.k}`} · {e.moment.title}</span><b>{e.option.label}</b>{e.outcome?.line && <small>{e.outcome.line}</small>}</div>
              ) : (
                <div key={`i${e.k}-${i}`} className="cr-feed-moment is-injury"><span className="ag-eyebrow">{S.gameWord} {e.k} · INJURY</span><b>{e.injuryText}</b></div>
              ))}
            </div>
          </section>
        )}

        {tab === 'season' && c.phase === 'offseason' && last && <Offseason c={c} setCareer={setCareer} last={last} setTab={setTab} user={user} />}
        {tab === 'player' && <><Player c={c} setCareer={setCareer} /><Comp c={c} /></>}
        {tab === 'team' && <><Lineup c={c} /><TeamFit c={c} /></>}
        {tab === 'career' && <CareerTab c={c} L={L} onDelete={() => { clearCareer(c.sport, c.uid, c.slot ?? 0); setCareer(null); onExit() }} />}
      </div>
    </div>
  )
}

// ── A run of games (basketball): the results strip, the best night, the averages ──
function Chunk({ c, e }) {
  const S = sportOf(c)
  const games = e.games ?? []
  const w = games.filter(g => g.won).length
  const on = games.filter(g => !g.sat)
  const avg = k => (on.length ? (on.reduce((s, g) => s + (g[k] ?? 0), 0) / on.length).toFixed(1) : '0')
  const best = [...on].sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0))[0]
  if (S.isBaseball) return <Suspense fallback={null}><BaseballChunk c={c} e={e} /></Suspense>
  if (S.isSoccer) {
    const played = games.filter(g => !g.sat && g.app)
    const sum = k => played.reduce((t, g) => t + (g[k] ?? 0), 0)
    const top = [...played].sort((a, b) => ((b.goals ?? 0) * 3 + (b.assists ?? 0) + (b.rating ?? 0) / 10) - ((a.goals ?? 0) * 3 + (a.assists ?? 0) + (a.rating ?? 0) / 10))[0]
    const d = games.filter(g => g.drawn).length
    return (
      <div className="ag-card cr-chunk">
        <div className="cr-chunk-head"><span className="ag-eyebrow">{e.k0 === e.k1 ? `MATCH ${e.k0}` : `MATCHES ${e.k0}–${e.k1}`}</span><b>{w}–{d}–{games.length - w - d}</b></div>
        <div className="cr-chunk-strip">{games.map(g => <span key={g.g} className={`${g.won ? 'is-w' : g.drawn ? 'is-d' : 'is-l'}${g.sat || !g.app ? ' is-sat' : ''}`} title={`${g.won ? 'W' : g.drawn ? 'D' : 'L'} ${g.mySc}–${g.oppSc} ${g.home ? 'vs' : 'at'} ${g.oppName ?? g.opponent}`}>{g.won ? 'W' : g.drawn ? 'D' : 'L'}</span>)}</div>
        {played.length > 0
          ? <p className="cr-chunk-line"><b>{sum('goals')}</b> {sum('goals') === 1 ? 'goal' : 'goals'} · <b>{sum('assists')}</b> {sum('assists') === 1 ? 'assist' : 'assists'} · <b>{played.length}</b> {played.length === 1 ? 'app' : 'apps'}{top && (top.goals || top.assists) ? <small>Best match: {GAME_LINE.st(top)} {top.home ? 'vs' : 'at'} {top.oppName ?? top.opponent}, {top.mySc}–{top.oppSc}</small> : null}</p>
          : <p className="cr-chunk-line"><small>Didn't play: {games.some(g => g.sat) ? 'out injured' : 'an unused sub'}.</small></p>}
        {(e.hits?.some(h => h.big) || e.headline?.length > 0) && (
          <div className="cr-feed-lines">{e.hits?.filter(h => h.big).map(h => <span key={h.id} className="cr-ms"><IconStar size={12} /> {h.label}</span>)}{e.headline?.slice(-1).map((t, k) => <span key={k} className="cr-hl">{t}</span>)}</div>
        )}
      </div>
    )
  }
  return (
    <div className="ag-card cr-chunk">
      <div className="cr-chunk-head"><span className="ag-eyebrow">{e.k0 === e.k1 ? `GAME ${e.k0}` : `GAMES ${e.k0}–${e.k1}`}</span><b>{w}–{games.length - w}</b></div>
      <div className="cr-chunk-strip">{games.map(g => <span key={g.g} className={`${g.won ? 'is-w' : 'is-l'}${g.sat ? ' is-sat' : ''}`} title={`${g.won ? 'W' : 'L'} ${g.mySc}–${g.oppSc} vs ${g.opponent}`}>{g.won ? 'W' : 'L'}</span>)}</div>
      {on.length > 0
        ? <p className="cr-chunk-line"><b>{avg('pts')}</b> pts · <b>{avg('reb')}</b> reb · <b>{avg('ast')}</b> ast{best && <small>Best night: {GAME_LINE[c.pos]?.(best)} vs {best.opponent}</small>}</p>
        : <p className="cr-chunk-line"><small>Didn't play: {S.isBucket ? 'out of the rotation' : 'on the bench'}.</small></p>}
      {(e.hits?.some(h => h.big) || e.headline?.length > 0) && (
        <div className="cr-feed-lines">{e.hits?.filter(h => h.big).map(h => <span key={h.id} className="cr-ms"><IconStar size={12} /> {h.label}</span>)}{e.headline?.slice(-1).map((t, k) => <span key={k} className="cr-hl">{t}</span>)}</div>
      )}
    </div>
  )
}

// ── The offseason, step by step: recap → contract → roster moves → camp ─────
const MOVE_TAG = { sign: 'SIGNED', draft: 'DRAFTED', retire: 'RETIRED', leave: 'GONE', rival: 'RIVAL' }
function Offseason({ c, setCareer, last, setTab, user }) {
  const step = c.off?.step ?? 'recap'
  const forced = mustRetire(c)
  const steps = OFF_STEPS.filter(([id]) => id !== 'contract' || c.off?.contract || Array.isArray(c.offers))
  const idx = Math.max(0, steps.findIndex(([id]) => id === step))
  const isLast = idx === steps.length - 1
  // (to the start of the next step, not all the way back up the page)
  const go = id => { setCareer(offStep(c, id)); sfx('tap'); requestAnimationFrame(() => document.querySelector('.cr-steps')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })) }
  const nextStep = steps[idx + 1]
  // the contract comes first: no moving on until it's signed (or nobody calls)
  const unsigned = steps[idx][0] === 'contract' && (c.offers?.length > 0 || c.talks || forced)
  const showActions = isLast || (steps[idx][0] === 'contract' && forced)
  return (
    <section className="cr-sec">
      <div className="cr-steps ag-pop" role="tablist" aria-label="Offseason">
        {steps.map(([id, label0], i) => { const label = c.sport === 'soccer' ? ({ contract: 'WINDOW', moves: 'SQUAD', camp: 'PRE-SEASON' })[id] ?? label0 : label0; return <button key={id} role="tab" aria-selected={i === idx} className={`cr-step${i === idx ? ' is-on' : i < idx ? ' is-done' : ''}`} disabled={i > idx} onClick={() => go(id)}>{i < idx ? <IconCheck size={11} /> : <span>{i + 1}</span>} {label}</button> })}
      </div>
      {steps[idx][0] === 'recap' && <Recap c={c} last={last} user={user} />}
      {steps[idx][0] === 'moves' && <Moves c={c} setCareer={setCareer} forced={forced} />}
      {steps[idx][0] === 'camp' && <Camp c={c} setCareer={setCareer} />}
      {steps[idx][0] === 'contract' && <Contract c={c} setCareer={setCareer} />}
      {!isLast && !unsigned && <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => go(nextStep[0])}>NEXT: {c.sport === 'soccer' ? ({ contract: 'THE WINDOW', moves: 'THE SQUAD', camp: 'PRE-SEASON' })[nextStep[0]] ?? nextStep[1] : nextStep[1]} <IconArrow size={16} /></button>}
      {showActions && forced && retireReason(c) !== 'nocalls' && (
        <p className="cr-note ag-pop">{retireReason(c) === 'comeback' ? `${COMEBACK_SEASONS} more seasons, as promised. ${c.name} hangs it up for good.` : retireReason(c) === 'age' ? (c.sport === 'soccer' ? `${c.name} is ${c.age}. The legs have made the call: time to hang up the boots.` : `${c.name} is ${c.age}. The body has made the call: this is the end of the road.`) : `${c.seasons.length} seasons: as long as a career runs here. Time to hang it up.`}</p>
      )}
      {showActions && (
        <div className="cr-actions ag-pop" style={{ '--d': '150ms' }}>
          {!forced && !(c.offers?.length) && <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { setCareer(nextSeason(c)); setTab('season'); sfx('tap'); document.querySelector('.cr-hub')?.scrollTo({ top: 0, behavior: 'smooth' }) }}>ON TO {c.season + 1} <IconArrow size={16} /></button>}
          {(canRetire(c) || forced) && <RetireButton c={c} setCareer={setCareer} forced={forced} />}
        </div>
      )}
    </section>
  )
}
// The numbers behind a season, all of them, each rated against the real league (lib/careerStats.js).
function Analytic({ a, best }) {
  const isBest = best != null && a.value === best
  return (
    <div className={`crs-row${a.tier ? ` is-${a.tier}` : ''}`}>
      <span className="crs-top">
        <span className="crs-name">{a.label}{isBest && <em>CAREER BEST</em>}</span>
        <b>{a.text}</b>
      </span>
      {a.mark != null && (
        <span className="crs-line">
          <span className="crs-bar" aria-hidden="true"><i style={{ width: `${a.mark}%` }} /><u /></span>
          <span className="crs-tier">{TIER_WORD[a.tier]}</span>
        </span>
      )}
    </div>
  )
}
export function Analytics({ c, s }) {
  const all = seasonAnalytics(c.pos, s)
  if (!all.length) return null
  const best = c.seasons.length > 1 ? careerBests(c.pos, c.seasons) : {}
  return (
    <div className="crs">
      <span className="ag-eyebrow">THE NUMBERS BEHIND IT</span>
      {all.map(a => <Analytic key={a.key} a={a} best={best[a.key]} />)}
    </div>
  )
}
// the top three by year (a season from before these existed has none)
function AnalyticsByYear({ c }) {
  const rows = c.seasons.map(s => ({ s, a: seasonAnalytics(c.pos, s) })).filter(r => r.a.length)
  if (!rows.length) return null
  const heads = rows[0].a.slice(0, 3)
  const best = careerBests(c.pos, c.seasons)
  return (
    <div className="ag-card cr-table crs-table ag-pop" style={{ '--d': '70ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE NUMBERS BY YEAR</span></div>
      <div className="crs-yr crs-yr--head"><span>YR</span>{heads.map(h => <span key={h.key}>{h.label}</span>)}</div>
      {[...rows].reverse().map(({ s, a }) => (
        <div key={s.year} className="crs-yr">
          <span>{s.season}</span>
          {a.slice(0, 3).map(x => <span key={x.key} className={`${x.tier ? `is-${x.tier}` : ''}${c.seasons.length > 1 && x.value === best[x.key] ? ' is-best' : ''}`}>{x.text}</span>)}
        </div>
      ))}
    </div>
  )
}

function Recap({ c, last, user }) {
  const S = sportOf(c)
  const met = last.goals.filter(g => g.met).length
  const card = useCardShare()
  const shareSeason = () => card.run(m => m.seasonShareCanvas(c, last, { username: getUsername(user) || c.owner || 'Guest' }), { title: `${c.name}'s ${last.season} season`, filename: `season-${last.season}-${String(c.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png` })
  if (S.isSoccer) return <Suspense fallback={null}><SoccerRecap c={c} last={last} card={card} shareSeason={shareSeason} /></Suspense>
  if (S.isBaseball) return <Suspense fallback={null}><BaseballRecap c={c} last={last} card={card} shareSeason={shareSeason} /></Suspense>
  return (
    <div className={`ag-card cr-wrap ag-pop${last.champion ? ' is-ring' : ''}`}>
      <div className="ag-card-head"><span className="ag-eyebrow">{last.season} · {last.wins}–{last.losses}{last.playoffs ? ' · PLAYOFFS' : ''}</span>{last.champion && <span className="cr-ring"><IconRing size={13} /> CHAMPIONS</span>}</div>
      <div className="cr-wrap-stats" style={EXTRA_STATS[c.pos] ? { gridTemplateColumns: 'repeat(3, 1fr)' } : undefined}>{[...HEADLINE_STATS[c.pos], ...(EXTRA_STATS[c.pos] ?? []).filter(k => last.stats[k] != null)].map(k => <span key={k}><b>{fmt(last.stats[k])}</b><small>{STAT_LABEL[k]}</small></span>)}<span><b>{last.missed}</b><small>GAMES MISSED</small></span></div>
      <div className="cr-badges">
        {last.award && <span className="cr-badge is-gold"><IconTrophy size={12} /> {last.awardName}</span>}
        {last.fmvp && <span className="cr-badge is-gold"><IconTrophy size={12} /> {S.finalsAward}</span>}
        {last.roy && <span className="cr-badge is-gold"><IconStar size={12} /> ROOKIE OF THE YEAR</span>}
        {last.allPro && <span className="cr-badge is-gold"><IconMedal size={12} /> {S.first.toUpperCase()}</span>}
        {last.proBowl && !last.allPro && <span className="cr-badge"><IconStar size={12} /> {S.honor.toUpperCase()}</span>}
        {last.benched > 0 && <span className="cr-badge">{c.sport === 'bucket' ? 'OFF THE BENCH' : last.benched >= last.wins + last.losses ? 'BACKUP ALL YEAR' : `${last.benched} GAMES AS THE BACKUP`}</span>}
        {last.records.map((r, i) => <span key={i} className="cr-badge is-rec"><IconFlame size={12} /> {r}</span>)}
      </div>
      {last.sb && <p className="cr-note">{last.sb.won ? `${S.final} champions${last.sb.series ? `, ${last.sb.mySc}–${last.sb.oppSc} in the series` : `: ${last.sb.mySc ?? ''}${last.sb.oppSc != null ? `–${last.sb.oppSc}` : ''}`}.` : `Lost the ${S.final}${last.sb.series ? ` ${last.sb.mySc}–${last.sb.oppSc}` : ''}. Close.`}</p>}
      <Analytics c={c} s={last} />
      {!last.sb && last.rounds?.length > 0 && <p className="cr-note">Playoffs: {last.rounds.map(r => `${r.won ? 'W' : 'L'} ${r.mySc}–${r.oppSc} ${nick(r.opponent)}`).join(' · ')}</p>}
      {last.goals.length > 0 && <div className="cr-goals"><span className="ag-eyebrow">GOALS · {met}/{last.goals.length}</span>{last.goals.map(g => <span key={g.k} className={`cr-goal${g.met ? ' is-met' : ' is-miss'}`}>{g.met ? <IconCheck size={11} /> : null} {g.label}</span>)}</div>}
      <button className="ag-btn ag-btn--ghost cl-season-share" onClick={shareSeason} disabled={card.busy}>{card.busy ? 'MAKING THE CARD…' : `SHARE THE ${last.season} SEASON`}</button>
      {card.img && <img src={card.img} alt={`${c.name}'s ${last.season} season card`} className="cl-preview" />}
      {card.img && <a className="ag-btn ag-btn--ghost cl-season-share" href={card.img} download={`season-${last.season}.png`}>SAVE THE IMAGE</a>}
      {card.failed && <p className="cr-note">{card.img ? "Couldn't open sharing here. Save the image instead." : "Couldn't make the card. Try again."}</p>}
    </div>
  )
}
// The jersey number: a quiet row on the PLAYER tab, changed after the signing and in any offseason; a sheet of the
// numbers the league allows at his spot, a teammate's crossed out (lib/career.js jerseyOf, numberRule)
const numWord = c => (c.sport === 'soccer' ? 'SHIRT' : 'JERSEY')
function Jersey({ c, setCareer }) {
  const [open, setOpen] = useState(false)
  const n = useMemo(() => jerseyOf(c), [c.number, c.team, c.roster, c.pos, c.sport]) // eslint-disable-line react-hooks/exhaustive-deps
  const can = !!setCareer && canChangeNumber(c)
  return (
    <div className="cr-contract cr-jersey">
      <span><span className="ag-eyebrow">{numWord(c)}</span><b>No. {n}</b></span>
      {can && <button type="button" className="cr-jersey-go" onClick={() => { setOpen(true); sfx('tap') }}>CHANGE</button>}
      {open && <NumberSheet c={c} cur={n} onPick={x => { setCareer(setNumber(c, x)); setOpen(false); sfx('tap') }} onClose={() => setOpen(false)} />}
    </div>
  )
}
// his pick is a new teammate's: one line, and the sheet
function NumberClash({ c, setCareer }) {
  const [open, setOpen] = useState(false)
  const who = numberClash(c), n = jerseyOf(c)
  return (
    <p className="cr-note cr-num-clash">
      No. {c.number} is taken here ({who}). No. {n} for now.<button type="button" className="cr-jersey-go" onClick={() => { setOpen(true); sfx('tap') }}>PICK A NUMBER</button>
      {open && <NumberSheet c={c} cur={n} onPick={x => { setCareer(setNumber(c, x)); setOpen(false); sfx('tap') }} onClose={() => setOpen(false)} />}
    </p>
  )
}
function NumberSheet({ c, cur, onPick, onClose }) {
  const rule = useMemo(() => numberRule(c), [c.pos, c.sport, c.build]) // eslint-disable-line react-hooks/exhaustive-deps
  const taken = useMemo(() => takenNumbers(c), [c.team, c.roster]) // eslint-disable-line react-hooks/exhaustive-deps
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => { const k = e => { if (e.key === 'Escape') close.current() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [])
  const spot = c.pos === 'dl' ? dlSpotLabel(dlSpot(c)) : POS_LABEL[c.pos] ?? ''
  return createPortal(
    <div className="ll-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ll-sheet cr-num-sheet" role="dialog" aria-modal="true" aria-labelledby="cr-num-title">
        <div className="ll-head"><span className="ag-eyebrow">{numWord(c)} NUMBER{spot ? ` · ${spot}` : ''}</span><button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={15} /></button></div>
        <h2 className="ll-title" id="cr-num-title">No. {cur}</h2>
        <p className="ll-body">{spot ? `${spot}: ` : ''}{rule.text}.{taken.size ? ' A crossed-out number is a teammate\'s.' : ''}</p>
        <div className="cr-num-grid">
          {rule.nums.map(x => {
            const who = taken.get(String(x)), on = String(x) === String(cur)
            return <button key={x} type="button" className={`cr-num${on ? ' is-on' : ''}${who ? ' is-taken' : ''}`} disabled={!!who} aria-pressed={on} aria-label={who ? `${x}, ${who}` : String(x)} onClick={() => (on ? onClose() : onPick(x))}>{x}</button>
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
// A yes or no in the app's own look (never the browser's box)
function AskSheet({ eyebrow, title, body, yes, no = 'NOT NOW', danger = false, onYes, onNo }) {
  return createPortal(
    <div className="ll-overlay" onClick={e => e.target === e.currentTarget && onNo()}>
      <div className="ll-sheet" role="alertdialog" aria-modal="true" aria-labelledby="cr-ask-title">
        <div className="ll-head"><span className="ag-eyebrow">{eyebrow}</span><button className="ag-round-btn" onClick={onNo} aria-label="Close"><IconClose size={15} /></button></div>
        <h2 className="ll-title" id="cr-ask-title">{title}</h2>
        <p className="ll-body">{body}</p>
        <div className="ll-actions">
          <button className="ag-btn ag-cta" onClick={onNo} autoFocus>{no}</button>
          <button className={`ag-btn ${danger ? 'll-leave' : 'ag-btn--ghost'}`} onClick={onYes}>{yes}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
function RetireButton({ c, setCareer, forced }) {
  const [ask, setAsk] = useState(false)
  const go = () => { setAsk(false); setCareer(retire(c)); victory({ big: true }) }
  return <>
    <button className={`ag-btn${forced ? ' ag-btn--gold tk-intro-go' : ' ag-btn--ghost'}`} onClick={() => { if (forced) go(); else { setAsk(true); sfx('tap') } }}>{forced ? 'HANG IT UP' : 'RETIRE'}</button>
    {ask && <AskSheet eyebrow="RETIREMENT" title={`Retire ${c.name}?`} body={c.unretired ? 'This time it\'s for good: there\'s no second comeback. The legacy and the Hall of Fame vote are final.' : 'The career is booked and the legacy is final.'} yes="RETIRE" no="KEEP PLAYING" onYes={go} onNo={() => setAsk(false)} />}
  </>
}
// The answer to a trade demand, right away: the new team, or a no
function TradeOverlay({ res, onClose }) {
  const S = sportOf(res.c)
  useEffect(() => { if (res.granted) victory({ big: false }); else sfx('deny'); const t = setTimeout(onClose, 6500); return () => clearTimeout(t) }, []) // eslint-disable-line
  const t = S.teamOf(res.granted ? res.c.team : res.from)
  if (S.isSoccer) return createPortal(
    <div className={`ag-ring sm-record cr-trade-res${res.granted ? ' is-yes' : ' is-no'}`} onClick={onClose} style={{ '--tc': lum(t.color) < 0.12 ? t.color2 : t.color }}>
      {res.granted && <div className="ag-ring-rays" />}
      <div className="ag-ring-inner">
        <span className="ag-eyebrow">TRANSFER REQUEST · {res.granted ? 'GRANTED' : 'TURNED DOWN'}</span>
        <img className="cr-trade-logo" src={S.logo(t.short)} alt="" />
        <h2 className="ag-ring-title">{res.granted ? `SOLD TO ${t.name.toUpperCase()}` : 'REQUEST TURNED DOWN'}</h2>
        <span className="ag-ring-score">{res.granted ? `${res.c.name} signs for ${t.name}.` : `${t.name} won't sell, and the dressing room heard about it.`}</span>
        <span className="sm-honor-line">Reputation −2</span>
        <span className="ag-ring-count">TAP TO CONTINUE</span>
      </div>
    </div>,
    document.body,
  )
  return createPortal(
    <div className={`ag-ring sm-record cr-trade-res${res.granted ? ' is-yes' : ' is-no'}`} onClick={onClose} style={{ '--tc': t.color2 && t.color === '#000000' ? t.color2 : t.color }}>
      {res.granted && <div className="ag-ring-rays" />}
      <div className="ag-ring-inner">
        <span className="ag-eyebrow">TRADE REQUEST · {res.granted ? 'GRANTED' : 'DENIED'}</span>
        <img className="cr-trade-logo" src={S.logo(t.short)} alt="" />
        <h2 className="ag-ring-title">{res.granted ? `TRADED TO THE ${t.name.toUpperCase()}` : 'REQUEST DENIED'}</h2>
        <span className="ag-ring-score">{res.granted ? `${res.c.name} is a ${t.nick ?? nick(t.name)} now.` : `The ${t.nick ?? nick(t.name)} said no, and the locker room heard about it.`}</span>
        <span className="sm-honor-line">Reputation −2</span>
        <span className="ag-ring-count">TAP TO CONTINUE</span>
      </div>
    </div>,
    document.body,
  )
}
function Moves({ c, setCareer, forced }) {
  const ev = c.events.filter(e => e.year === c.year + 1)
  const moves = c.off?.moves ?? []
  const dc = depthChart(c)
  const [askTrade, setAskTrade] = useState(false)
  const [tradeRes, setTradeRes] = useState(null)
  const doTrade = () => {
    setAskTrade(false)
    const from = c.team
    const next = demandTrade(c)
    setCareer(next)
    setTradeRes({ granted: next.team !== from, from, c: next })
  }
  return (
    <>
      {askTrade && (c.sport === 'soccer'
        ? <AskSheet eyebrow="TRANSFER REQUEST" title="Hand in a transfer request?" body={c.contract.noTrade ? 'His release clause means the club has to let him go. His reputation takes a hit.' : 'His reputation takes a hit, and the club can say no.'} yes="HAND IT IN" no="STAY PUT" danger onYes={doTrade} onNo={() => setAskTrade(false)} />
        : <AskSheet eyebrow="TRADE REQUEST" title="Demand a trade?" body="Reputation takes a hit, and the team can say no." yes="DEMAND IT" no="STAY PUT" danger onYes={doTrade} onNo={() => setAskTrade(false)} />)}
      {tradeRes && <TradeOverlay res={tradeRes} onClose={() => setTradeRes(null)} />}
      {ev.map((e, i) => <div key={i} className="ag-card cr-event ag-pop"><span className="ag-eyebrow">{c.fit?.name?.toUpperCase()}</span><p>{withLegacy(e.text)}</p></div>)}
      {moves.length > 0 && (
        <div className="ag-card cr-moves ag-pop" style={{ '--d': '40ms' }}>
          <span className="ag-eyebrow">{c.sport === 'soccer' ? 'COMINGS AND GOINGS' : 'ROSTER MOVES'}</span>
          {moves.map((m, i) => (
            <div key={i} className={`cr-move is-${m.kind}`}>
              <span className="crl-face crl-face--sm">{m.p?.photo ? <img src={photoSrc(m.p.photo)} alt="" loading="lazy" /> : <span className="crl-init">{initials(m.p?.name)}</span>}</span>
              <span className="cr-move-txt"><b>{m.text}</b><small>{m.pos === 'dl' || m.pos === 'ol' || c.sport === 'baseball' ? m.label : m.pos.toUpperCase()} · {m.p?.ovr ?? 70} OVR · age {m.p?.age}</small></span>
              <span className="cr-move-tag">{c.sport === 'soccer' ? ({ draft: 'ACADEMY', leave: 'SOLD' })[m.kind] ?? MOVE_TAG[m.kind] : MOVE_TAG[m.kind]}</span>
            </div>
          ))}
        </div>
      )}
      <div className={`ag-card cr-depthnote ag-pop${dc.starter ? ' is-on' : ''}`} style={{ '--d': '70ms' }}>
        <span className="ag-eyebrow">{c.sport === 'soccer' ? 'SQUAD ROLE' : c.sport === 'bucket' || c.sport === 'baseball' ? 'ROLE' : `DEPTH CHART · ${c.pos === 'ol' ? olSpot(c) : c.pos === 'dl' ? dlSpotLabel(dlSpot(c)) : c.pos === 'db' ? (dbSpot(c) === 's' ? 'S' : 'CB') : POS_LABEL[c.pos]}`}</span>
        {c.sport === 'soccer'
          ? <p>{dc.starter ? `${c.name} goes into pre-season as the first-choice No. 9.` : `${c.name} goes into pre-season ${soccerRole(c) === 'Rotation' ? 'in the rotation' : 'on the bench'}, behind ${dc.ahead[dc.ahead.length - 1].name}.`}</p>
          : sportOf(c).x?.campLine ? <p>{sportOf(c).x.campLine(c, dc)}</p>
          : <p>{dc.starter ? `${c.name} goes into camp as a starter.` : `${c.name} goes into camp ${c.sport === 'bucket' ? 'coming off the bench' : `as ${dc.label}`}, behind ${dc.ahead[dc.ahead.length - 1].name}.`}</p>}
        {!forced && !c.tradeAsked && c.contract.left > 0 && !c.loan && (c.sport === 'soccer' || !c.contract.noTrade) && <button className="ag-btn ag-btn--ghost cr-trade-btn" onClick={() => { setAskTrade(true); sfx('tap') }}>{c.sport === 'soccer' ? 'HAND IN A TRANSFER REQUEST' : 'DEMAND A TRADE'}</button>}
      </div>
      {c.off?.news?.length > 0 && <div className="ag-card cr-news ag-pop" style={{ '--d': '90ms' }}><span className="ag-eyebrow">{c.sport === 'soccer' ? 'AROUND EUROPE' : 'AROUND THE LEAGUE'}</span><ul className="cr-bul">{c.off.news.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
      <Lineup c={c} />
    </>
  )
}
function Camp({ c, setCareer }) {
  const game = useMemo(() => pickPlayoffGame(c.pos, `${c.seed}-camp-${c.year}`, [], gamesMode(c) === 'simple' ? g => !!SIMPLE_GAMES[g] : null), [c.seed, c.year, c.pos]) // eslint-disable-line
  const done = c.off?.camp
  return (
    <div className="ag-card cr-camp ag-pop">
      <span className="ag-eyebrow">TRAINING CAMP · {gameTitle(c, game)}</span>
      {done
        ? <p className="cr-note">{(done.won ?? done.bonus) ? <>Won the drill in front of the coaches: <span className="gain">+{done.legacy ?? 0} <LegacyIco /> legacy</span>{done.bonus ? ', and +1 development point.' : '. No development point this time.'}</> : 'Lost the drill. Nothing this year.'}</p>
        : <>
            <p className="cr-note">One hard drill in front of the coaching staff. Win it for <span className="gain">+{CAMP_LEGACY} <LegacyIco /> legacy</span> and a shot at a development point (the cleaner the win, the better the shot).</p>
            <CareerGame c={c} setCareer={setCareer} retry empty team={c.fit} opp={c.fit} pos={combinePos(c)} cast={gameCast(c)} key={game} game={game} build={c.build} hard seed={`${c.seed}-camp-${c.year}`} lock={`${c.seed}-camp-${c.year}`} onDone={res => setCareer(campDrill(c, res.score, game, res.hit))} />
          </>}
      {c.dev.points > 0 && <div className="cr-devnote"><IconStar size={14} /> <b>{c.dev.points}</b> development {c.dev.points === 1 ? 'point' : 'points'}: tap a trait on the player above to raise it.</div>}
    </div>
  )
}
function Contract({ c, setCareer }) {
  const logoFor = sportOf(c).logo
  const noCalls = Array.isArray(c.offers) && c.offers.length === 0
  if (c.talks) return <Talks c={c} setCareer={setCareer} />
  if (c.sport === 'soccer') return <Suspense fallback={null}><SoccerWindow c={c} setCareer={setCareer} noCalls={noCalls} /></Suspense>
  if (c.sport === 'baseball') return <Suspense fallback={null}><BaseballContract c={c} setCareer={setCareer} noCalls={noCalls} /></Suspense>
  if (noCalls) return <div className="ag-card cr-offer-wrap ag-pop"><span className="ag-eyebrow">FREE AGENCY</span><p className="cr-note">The phone didn't ring. At {c.age}, with last season on tape, nobody's calling. That's a career.</p></div>
  if (!c.offers?.length) return <div className="ag-card cr-offer-wrap ag-pop"><span className="ag-eyebrow">SIGNED</span><p className="cr-note">{c.decisions[c.decisions.length - 1]?.text}</p></div>
  return (
    <div className="cr-offers ag-pop">
      <span className="ag-eyebrow">CONTRACT'S UP · {c.offers.length} {c.offers.length === 1 ? 'OFFER' : 'OFFERS'} · TAP ONE TO TALK</span>
      {c.offers.map(o => (
        <button key={o.team} className={`cr-offer${o.kind === 'contender' ? ' is-contender' : ''}`} onClick={() => { setCareer(openTalks(c, o)); sfx('tap') }}>
          <img src={logoFor(o.team)} alt="" />
          <span className="cr-offer-txt"><b>{o.fit.name}</b><small>{o.pitch}</small><i>{o.stand ? (o.stand.starter ? 'Would start' : `Backup behind ${o.stand.behind}`) : o.fit.status} · {(o.fit.groups ?? [{ k: 'O-LINE', v: o.fit.ol }, { k: c.pos === 'qb' ? 'WEAPONS' : 'QB', v: c.pos === 'qb' ? o.fit.weapons : o.fit.qb }]).slice(0, 2).map(g => `${g.k.toLowerCase()} ${gradeOf(g.v)}`).join(' · ')}</i></span>
          <span className="cr-offer-money"><b>{money(o.perYear)}</b><small>× {o.years} {o.years === 1 ? 'YR' : 'YRS'}</small></span>
        </button>
      ))}
    </div>
  )
}

// The dashboard's Mini Games choice (the one made on the New Career screen, still changeable):
// SIMPLE, ADVANCED or OFF for the key moments, camp drills and the combine. PRACTICE opens the lab
function GamesSwitch({ c, setCareer }) {
  const mode = gamesMode(c)
  return (
    <div className="cr-gamesw cr-gamesw--3">
      <div className="cr-gamesw-top">
        <span><b>KEY MOMENTS MINI GAMES</b></span>
        <button className="cr-gamesw-practice" onClick={() => { sfx('tap'); window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'mglab' })) }}>PRACTICE <IconArrow size={12} /></button>
      </div>
      <div className="cr-pos cr-games" role="radiogroup" aria-label="Mini games" style={{ '--n': GAMES_MODES.length }}>
        {GAMES_MODES.map(([m, label]) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'is-on' : ''} onClick={() => { if (m !== mode) { setCareer(setGamesMode(c, m)); sfx('tap') } }}>{label}<small>{GAMES_WHAT[m]}</small></button>
        ))}
      </div>
    </div>
  )
}
function Player({ c, setCareer }) {
  const t = careerTotals(c)
  return (
    <section className="cr-sec">
      <div className="ag-card cr-player ag-pop">
        {careerBody(c) && <span className="ag-eyebrow cr-body">{(POS_NAME[c.pos] ?? '').toUpperCase()} · {bodyText(careerBody(c))} LBS</span>}
        <div className="cr-kv"><span><b>{c.age}</b><small>AGE</small></span><span><b>{gradeOf(c.durability * 1.1)}</b><small>DURABILITY</small></span><span><b>{gradeOf(c.rep * 1.1)}</b><small>REPUTATION</small></span><span><b>{c.dev.spent}</b><small>UPGRADES</small></span>{c.sport === 'soccer' && <><span><b>{t.caps ?? 0}</b><small>CAPS</small></span><span><b>{t.intlGoals ?? 0}</b><small>{(nationName(c.nation) ?? '').toUpperCase()} GOALS</small></span></>}</div>
        <div className="cr-contract">
          <span className="ag-eyebrow">CONTRACT</span>
          <b>{pay(c, c.contract.perYear)} · {c.contract.left} of {c.contract.years} {c.contract.years === 1 ? 'year' : 'years'} left</b>
          <small>{sportOf(c).x?.contractWord ? sportOf(c).x.contractWord(c) : c.sport === 'soccer' ? ({ rookie: 'First professional contract', ext: 'New deal', transfer: 'Transfer', fa: 'Free transfer', loan: `On loan from ${c.loan ? sportOf(c).teamOf(c.loan.from).name : 'his club'}` })[c.contract.kind] ?? 'Contract' : c.contract.kind === 'rookie' ? 'Rookie deal' : c.contract.kind === 'ext' ? 'Extension' : 'Free-agent deal'} · career earnings {earned(c, Math.round(t.earnings))}</small>
        </div>
        <Jersey c={c} setCareer={setCareer} />
        {c.injuries.length > 0 && <div className="cr-goals"><span className="ag-eyebrow">INJURY HISTORY</span>{c.injuries.map((i, k) => <span key={k} className="cr-goal is-miss">{i.year}: {i.kind}, {i.games} {c.sport === 'soccer' ? (i.games === 1 ? 'match' : 'matches') : i.games === 1 ? 'game' : 'games'}{i.played ? ' (played through)' : ''}</span>)}</div>}
        <p className="cr-note">{sportOf(c).primeNote(c.pos)} {sportOf(c).ui?.devNote ?? `Every offseason brings a development point; an award or ${sportOf(c).first} season brings two.`}</p>
      </div>
    </section>
  )
}

// The whole all-time list, the player slotted in where the legacy puts them
function RankList({ c, L }) {
  const box = useRef(null), me = useRef(null)
  const list = ALL_TIME[c.pos] ?? []
  const rows = [...list.slice(0, L.rank - 1).map(x => ({ ...x })), { you: true }, ...list.slice(L.rank - 1).map(x => ({ ...x, rank: x.rank + 1 }))]
  useEffect(() => { const b = box.current, m = me.current; if (b && m) b.scrollTop = m.offsetTop - b.clientHeight / 2 + m.clientHeight / 2 }, [L.rank])
  return (
    <div className="cr-rank-list" ref={box}>
      {rows.map((x, i) => x.you
        ? <span key="you" ref={me} className="cr-rank-row is-you"><i>{L.ranked ? L.rank : '—'}</i><b>{c.name}</b><em>{L.score}</em></span>
        : <span key={x.name} className="cr-rank-row"><i>{x.rank}</i><b>{x.name}</b><em>{x.score}</em></span>)}
    </div>
  )
}
// Every season, one row each and the career under them, like a player page on ESPN
const SEASON_COLS = {
  qb: ['compPct', 'passYds', 'tds', 'ints', 'rating', 'rushYds', 'rushTDs'],
  rb: ['rushYds', 'ypc', 'tds', 'recYds', 'fumbles'],
  wr: ['recs', 'recYds', 'ypr', 'tds', 'drops'], te: ['recs', 'recYds', 'ypr', 'tds', 'drops'],
  db: ['tackles', 'tfl', 'ints', 'pbus', 'ff', 'pickSixes', 'rtgA'],
  dl: ['sacks', 'tfl', 'tackles', 'qbHits', 'ff', 'fr', 'pbus', 'safeties'],
  lb: ['tackles', 'tfl', 'sacks', 'qbHits', 'pds', 'ints', 'ff', 'fr'],
  ol: ['grade', 'sacksA', 'prs', 'pancakes', 'pen', 'starts'],
  guard: ['ppg', 'rpg', 'apg', 'spg', 'bpg'], big: ['ppg', 'rpg', 'apg', 'spg', 'bpg'],
}
const COL_LABEL = { tfl: 'TFL', ff: 'FF' }
const gamesIn = s => s.stats.gp ?? (s.wins + s.losses - (s.missed ?? 0))
// a season's hardware, in words
export const honorsOf = (s, S, pos) => (S.honorsOf ? S.honorsOf(s, pos) : S.isSoccer ? [
  ...(s.trophies ?? []),
  s.wc?.champion && 'World Cup',
  s.award && S.ui.award,
  !s.award && s.bdo?.rank <= 10 && `${S.ui.award}: ${ordinalOf(s.bdo.rank)}`,
  s.allPro && (s.bootName ?? 'Golden Boot'),
  s.poty && (s.potyName ?? 'Player of the Season'),
  s.proBowl && !s.poty && 'Team of the Season',
  s.shoe && 'European Golden Shoe',
  s.roy && 'Kopa Trophy',
  s.fmvp && 'Man of the match in the final',
].filter(Boolean) : [
  s.champion && `${S.final} champion`,
  s.award && (AWARD_NAME[pos] ?? 'Season award'),
  s.fmvp && `${S.final} MVP`,
  s.roy && 'Rookie of the Year',
  s.allPro ? (S.isBucket ? 'All-NBA' : 'All-Pro') : s.proBowl ? (S.isBucket ? 'All-Star' : 'Pro Bowl') : null,
].filter(Boolean))
function SeasonTable({ c, t }) {
  const S = sportOf(c)
  // tap a year to open its numbers
  const [open, setOpen] = useState(null)
  const flip = y => { setOpen(o => (o === y ? null : y)); sfx('tap') }
  const cols = (SEASON_COLS[c.pos] ?? HEADLINE_STATS[c.pos]).filter(k => c.seasons.some(s => s.stats[k] != null))
  // a rate over the career: weighted by games, as the seasons carry no attempts to divide by
  const career = k => {
    if (t.stats[k] != null && (!S.rateKeys.includes(k) || S.averages?.[k])) return t.stats[k]
    const g = c.seasons.reduce((a, s) => a + gamesIn(s), 0)
    return g ? Math.round((c.seasons.reduce((a, s) => a + (s.stats[k] ?? 0) * gamesIn(s), 0) / g) * 10) / 10 : 0
  }
  return (
    <div className="ag-card cr-seasons ag-pop">
      <div className="ag-card-head"><span className="ag-eyebrow">SEASON BY SEASON</span></div>
      <div className="cr-seasons-scroll" tabIndex={0} role="region" aria-label="Season by season stats">
        <table>
          <thead>
            <tr><th scope="col">SEASON</th><th scope="col">TEAM</th><th scope="col">GP</th><th scope="col">W-L</th>{cols.map(k => <th key={k} scope="col">{STAT_LABEL[k] ?? COL_LABEL[k] ?? k.toUpperCase()}</th>)}<th scope="col" aria-label="Honors" /></tr>
          </thead>
          <tbody>
            {c.seasons.map(s => [
              <tr key={s.year} className={`cr-seasons-row${s.champion ? ' is-ring' : ''}${open === s.year ? ' is-open' : ''}`}
                tabIndex={0} aria-expanded={open === s.year} onClick={() => flip(s.year)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(s.year) } }}>
                <th scope="row"><IconArrow size={10} className="cr-seasons-chev" />{s.season}</th>
                <td className="cr-seasons-team"><img src={S.logo(s.team)} alt="" loading="lazy" />{s.team}</td>
                <td>{gamesIn(s)}</td>
                <td>{s.wins}-{s.losses}</td>
                {cols.map(k => <td key={k}>{(k === 'grade' || k === 'drops') && s.stats[k] == null ? '—' : fmt(s.stats[k])}</td>)}
                <td className="cr-seasons-ico">{s.champion && <IconRing size={13} />}{s.award && <IconTrophy size={13} />}{s.allPro ? <IconMedal size={13} /> : s.proBowl ? <IconStar size={13} /> : null}</td>
              </tr>,
              open === s.year && (
                <tr key={`${s.year}-more`} className="cr-seasons-more">
                  <td colSpan={cols.length + 5}>
                    <div className="cr-seasons-detail">
                      {honorsOf(s, S, c.pos).length > 0 && <p className="cr-seasons-honors">{honorsOf(s, S, c.pos).join(' · ')}</p>}
                      <Analytics c={c} s={s} />
                    </div>
                  </td>
                </tr>
              ),
            ])}
          </tbody>
          <tfoot>
            <tr><th scope="row">CAREER</th><td /><td>{t.games}</td><td>{t.wins}-{t.losses}</td>{cols.map(k => <td key={k}>{fmt(career(k))}</td>)}<td /></tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
function CareerTab({ c, L, onDelete }) {
  const [ask, setAsk] = useState(false)
  const S = sportOf(c)
  const t = careerTotals(c)
  const keys = HEADLINE_STATS[c.pos]
  return (
    <section className="cr-sec">
      {c.seasons.length > 0 && (S.isSoccer ? <Suspense fallback={null}><SoccerSeasonTable c={c} t={t} /></Suspense> : S.isBaseball ? <Suspense fallback={null}><BaseballSeasonTable c={c} t={t} /></Suspense> : <SeasonTable c={c} t={t} />)}
      <div className="ag-card cr-totals ag-pop">
        <div className="ag-card-head"><span className="ag-eyebrow">CAREER · {t.seasons} {t.seasons === 1 ? 'SEASON' : 'SEASONS'}</span></div>
        {S.isBaseball ? <Suspense fallback={null}><BaseballTotals c={c} t={t} /></Suspense> : S.isSoccer ? <div className="cr-kv">{[[t.stats.goals, 'GOALS'], [t.stats.assists, 'ASSISTS'], [t.stats.apps, 'APPS'], [t.trophies, 'TROPHIES'], [t.leagueTitles, 'LEAGUE TITLES'], [t.ucl, 'CHAMPIONS LEAGUES'], [t.awards, `${S.awardName.st}S`], [t.allPros, 'GOLDEN BOOTS'], [t.proBowls, 'TEAM OF THE SEASON'], [t.caps, 'CAPS'], [t.intlGoals, 'INTERNATIONAL GOALS']].map(([v, k]) => <span key={k}><b>{fmt(v ?? 0)}</b><small>{k}</small></span>)}</div>
        : <div className="cr-kv">{[...keys, ...(EXTRA_STATS[c.pos] ?? []).filter(k => t.stats[k] != null)].map(k => <span key={k}><b>{fmt(t.stats[k])}</b><small>{STAT_LABEL[k]}</small></span>)}<span><b>{t.rings}</b><small>RINGS</small></span>{c.pos !== 'ol' && <span><b>{t.awards}</b><small>{AWARD_NAME[c.pos]}</small></span>}<span><b>{t.proBowls}</b><small>{S.honors}</small></span><span><b>{t.allPros}</b><small>{S.first.toUpperCase()}</small></span></div>}
        <div className="cr-rank">
          <div className="cr-rank-head"><span className="ag-eyebrow">{S.isSoccer ? `GREATEST ATTACKERS · TOP ${L.of}` : `GREATEST ${S.isBucket ? '' : `${POS_LABEL[c.pos]} `}CAREERS · TOP ${L.of}`}</span><small>LEGACY PTS</small></div>
          <RankList c={c} L={L} />
          {!L.ranked && <small className="cr-rank-note">{L.above.score - L.score + 1} more legacy points to crack the top {L.of}.</small>}
        </div>
      </div>
      <AnalyticsByYear c={c} />
      {(c.decisions.length > 0 || c.events.length > 0) && (
        <div className="ag-card cr-log ag-pop" style={{ '--d': '90ms' }}>
          <div className="ag-card-head"><span className="ag-eyebrow">THE STORY</span></div>
          <ul className="cr-bul">{[...c.decisions.map(d => ({ ...d, kind: 'd' })), ...c.events.map(e => ({ ...e, kind: 'e' }))].sort((a, b) => b.year - a.year).map((x, i) => <li key={i}>{x.kind === 'd' ? <IconShield size={12} /> : <IconHelmet size={12} />} <small>Y{x.year}</small> {withLegacy(x.text)}</li>)}</ul>
        </div>
      )}
      <div className="cr-delete ag-pop">
        {ask ? (
          <><p>Delete <b>{c.name}</b>'s career? This can't be undone, and the slot opens up for a new one.</p>
          <div className="cr-slot-acts"><button className="ag-btn" onClick={() => setAsk(false)}>KEEP IT</button><button className="ag-btn cr-del" onClick={onDelete}>DELETE CAREER</button></div></>
        ) : <button className="cr-delete-btn" onClick={() => setAsk(true)}>Delete this career</button>}
      </div>
    </section>
  )
}

// ── Share cards (lib/careerShare.js): make the image, then the share sheet ──
function useCardShare() {
  const [img, setImg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const run = async (make, opts) => {
    if (busy) return
    setBusy(true); setFailed(false); sfx('tap')
    try {
      const m = await import('../../lib/careerShare')
      const canvas = await make(m)
      setImg(canvas.toDataURL('image/png'))
      const res = await m.shareCanvas(canvas, opts)
      if (res === 'shared' || res === 'downloaded') sfx('claim')
      else if (res === 'error') setFailed(true)
    } catch { setFailed(true) } finally { setBusy(false) }
  }
  return { img, busy, failed, run }
}
// the store can sell Pro here (the app outside the US App Store can't: lib/storefront.js)
function useSells() {
  const [sells, setSells] = useState(sellsHere)
  useEffect(() => onStorefront(() => setSells(sellsHere())), [])
  return sells
}
const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

// ── Legacy: the career, booked ───────────────────────────────────────────────
// One page, top to bottom: the tier and the Hall of Fame call, the big numbers,
// the trophy case, every season as a tile, the best one, where the career sits
// among the real greats; then the card to share, the comeback (BAP Pro), what's next.
const tcOf = (S, short) => { const t = S.teamOf(short); return lum(t.color) < 0.12 ? t.color2 : t.color }
const MARKS = { ring: IconRing, award: IconTrophy, first: IconMedal, honor: IconStar }
// a season's marks, the biggest first (a tile has room for two)
// One season of a finished career, in full: every number it has, the playoffs, the honors, what it cost
function SeasonOpen({ c, s, isBest, keys, S, logoFor, st }) {
  const rest = Object.keys(s.stats).filter(k => !keys.includes(k) && STAT_LABEL[k] && s.stats[k] != null && !(c.pos === 'db' && (k === 'tfl' || k === 'ff')))
  const hurt = c.injuries.filter(i => i.year === s.year)
  const met = (s.goals ?? []).filter(g => g.met).length
  return (
    <section key={s.year} className="ag-card cl-best cl-in" style={{ ...st, '--yc': tcOf(S, s.team) }}>
      <div className="cl-best-head">
        <img src={logoFor(s.team)} alt="" />
        <span><small>{isBest ? 'BEST SEASON' : 'SEASON'} · {S.isSoccer ? seasonOf(s.season) : s.season}</small><b>{s.teamName ?? S.teamOf(s.team).name}</b><em>Age {s.age} · {s.ovr} OVR · {S.isSoccer ? (s.trophies?.length ? s.trophies.join(', ') : `${ordinalOf(s.pos)} in ${inLeague(s.league)}`) : s.champion ? `${S.final} champions` : s.playoffs ? 'Playoffs' : 'No playoffs'}</em></span>
        <span className="cl-best-rec"><b>{S.isSoccer ? `${s.wins}–${s.draws}–${s.losses}` : `${s.wins}–${s.losses}`}</b><small>RECORD</small></span>
      </div>
      <div className="cl-big cl-big--sm">{keys.map(k => <span key={k}><b>{fmtK(S, k, s.stats[k])}</b><small>{STAT_LABEL[k]}</small></span>)}</div>
      {rest.length > 0 && <div className="cl-small cl-small--season">{rest.map(k => <span key={k}><b>{fmtK(S, k, s.stats[k])}</b><small>{STAT_LABEL[k]}</small></span>)}</div>}
      {(S.isSoccer || S.isBaseball) && honorsOf(s, S, c.pos).length > 0 && <div className="cr-badges">{honorsOf(s, S, c.pos).map(h => <span key={h} className="cr-badge is-gold"><IconTrophy size={12} /> {h.toUpperCase()}</span>)}</div>}
      {!S.isSoccer && !S.isBaseball && (s.award || s.allPro || s.proBowl || s.champion) && (
        <div className="cr-badges">
          {s.champion && <span className="cr-badge is-gold"><IconRing size={12} /> CHAMPIONS</span>}
          {s.award && <span className="cr-badge is-gold"><IconTrophy size={12} /> {s.awardName}</span>}
          {s.fmvp && <span className="cr-badge is-gold"><IconTrophy size={12} /> {S.finalsAward}</span>}
          {s.roy && <span className="cr-badge is-gold"><IconStar size={12} /> ROOKIE OF THE YEAR</span>}
          {s.allPro && <span className="cr-badge is-gold"><IconMedal size={12} /> {S.first.toUpperCase()}</span>}
          {s.proBowl && !s.allPro && <span className="cr-badge"><IconStar size={12} /> {S.honor.toUpperCase()}</span>}
        </div>
      )}
      <Analytics key={s.year} c={c} s={s} />
      <div className="cl-season-notes">
        {s.rounds?.length > 0 && <p><b>{S.isSoccer ? 'The big nights' : 'Playoffs'}</b> {s.rounds.map(r => (S.isSoccer ? `${r.won ? 'W' : 'L'} ${tieText(r)} ${r.opponent}` : `${r.won ? 'W' : 'L'} ${r.mySc}–${r.oppSc} ${String(r.opponent ?? '').split(' ').pop()}`)).join(' · ')}</p>}
        {S.isSoccer && s.wc?.called && <p><b>World Cup {s.wc.year}</b> {s.wc.champion ? 'Winners' : s.wc.finish}, {s.wc.goals} {s.wc.goals === 1 ? 'goal' : 'goals'}</p>}
        {(s.goals ?? []).length > 0 && <p><b>Goals</b> {met} of {s.goals.length} met</p>}
        {s.records?.length > 0 && <p><b>Records</b> {s.records.join(' · ')}</p>}
        {hurt.length > 0 && <p><b>Injuries</b> {hurt.map(i => `${i.kind}, ${i.games} ${i.games === 1 ? 'game' : 'games'}${i.played ? ' (played through)' : ''}`).join(' · ')}</p>}
        {s.missed > 0 && !hurt.length && <p><b>Missed</b> {s.missed} {S.isSoccer ? (s.missed === 1 ? 'match' : 'matches') : s.missed === 1 ? 'game' : 'games'}</p>}
      </div>
    </section>
  )
}

const marksOf = s => [s.champion && 'ring', s.award && 'award', s.allPro && 'first', s.proBowl && !s.allPro && 'honor'].filter(Boolean)
function Legacy({ c, setCareer, user, onUnretire, onNewBuild, onExit }) {
  const S = sportOf(c), logoFor = S.logo
  const L = legacyOf(c), t = careerTotals(c)
  const keys = HEADLINE_STATS[c.pos]
  const pro = useProgress().pro
  const sells = useSells()
  const card = useCardShare()
  const [askBack, setAskBack] = useState(false)
  const cb = comebackYear(c)
  const username = getUsername(user) || c.owner || 'Guest'
  const best = useMemo(() => (c.seasons.length > 1 ? c.seasons.reduce((b, s) => (seasonScore(c.pos, s) > seasonScore(c.pos, b) ? s : b)) : null), [c.seasons, c.pos])
  // the season open under the strip: tap one to read it; it opens on the best
  const [pickedYear, setPickedYear] = useState(null)
  const open = c.seasons.find(s => s.year === pickedYear) ?? best ?? c.seasons[0] ?? null
  // who the build plays like: an all-time great first, else the closest today
  const comp = useMemo(() => { const l = compsFor(c, 6, true); return l.find(x => x.era === 'all-time') ?? l[0] ?? null }, [c.build, c.pos, c.sport]) // eslint-disable-line react-hooks/exhaustive-deps
  // the all-time list around him: two above, two below
  const greats = ALL_TIME[c.pos] ?? []
  const at = L.rank - 1
  const rows = [...greats.slice(Math.max(0, at - 2), at), { me: true }, ...greats.slice(at, at + 2).map(x => ({ ...x, rank: x.rank + 1 }))]
  const years = c.seasons.length ? `${c.seasons[0].season}–${c.seasons[c.seasons.length - 1].season}` : ''
  const teams = t.teams.map(s => ({ s, n: c.seasons.filter(x => x.team === s).length }))
  const pick = c.draft?.pick
  const story = [
    S.isSoccer ? (pick?.team ? `Signed his first contract at ${S.teamOf(pick.team).name}, aged ${c.seasons[0]?.age ?? 17}.` : null) : pick ? `Drafted No. ${pick.o} overall in ${c.seasons[0]?.season ?? c.season}.` : null,
    S.isSoccer ? (teams.length === 1 ? `One club, start to finish: ${S.teamOf(teams[0].s).name}.` : `${teams.length} clubs.`) : teams.length === 1 ? `One team, start to finish: the ${S.teamOf(teams[0].s).name}.` : `${teams.length} teams.`,
    S.isSoccer && t.caps ? `${t.caps} caps and ${t.intlGoals} goals for ${nationName(c.nation)}.` : null,
    c.unretired && cb ? `Came out of retirement at ${c.unretired.age} for ${cb.played} more ${cb.played === 1 ? 'season' : 'seasons'}.` : null,
    `Retired${c.unretired ? ' for good' : ''} at ${c.age}.`,
  ].filter(Boolean).join(' ')
  const hardware = S.hardware ? S.hardware(t).map(([n, k, ico, gold]) => [n, k, ICONS[ico] ?? IconTrophy, gold]) : S.isSoccer ? [
    [t.awards, t.awards === 1 ? S.awardName.st : `${S.awardName.st}S`, IconCrown, true],
    [t.wc, t.wc === 1 ? 'WORLD CUP' : 'WORLD CUPS', IconTrophy, true],
    [t.ucl, t.ucl === 1 ? 'CHAMPIONS LEAGUE' : 'CHAMPIONS LEAGUES', IconTrophy, true],
    [t.leagueTitles, t.leagueTitles === 1 ? 'LEAGUE TITLE' : 'LEAGUE TITLES', IconTrophy, true],
    [t.cups, t.cups === 1 ? 'CUP' : 'CUPS', IconTrophy, false],
    [t.uel, 'EUROPA LEAGUE', IconTrophy, false],
    [t.allPros, t.allPros === 1 ? 'GOLDEN BOOT' : 'GOLDEN BOOTS', IconMedal, false],
    [t.shoes, t.shoes === 1 ? 'GOLDEN SHOE' : 'GOLDEN SHOES', IconMedal, false],
    [t.poty, 'PLAYER OF THE SEASON', IconStar, false],
    [t.proBowls, 'TEAM OF THE SEASON', IconStar, false],
    [t.kopa, 'KOPA TROPHY', IconStar, false],
    [t.records, t.records === 1 ? 'RECORD' : 'RECORDS', IconFlame, false],
  ].filter(([n]) => n > 0) : [
    [t.rings, t.rings === 1 ? 'RING' : 'RINGS', IconRing, true],
    [t.awards, t.awards === 1 ? AWARD_NAME[c.pos] : `${AWARD_NAME[c.pos]}S`, IconTrophy, true],
    [t.fmvps, S.finalsAward, IconTrophy, false],
    [t.roy ? 1 : 0, 'ROOKIE OF THE YEAR', IconStar, false],
    [t.allPros, S.first.toUpperCase(), IconMedal, false],
    [t.proBowls, t.proBowls === 1 ? S.honor.toUpperCase() : S.honors, IconStar, false],
    [t.records, t.records === 1 ? 'RECORD' : 'RECORDS', IconFlame, false],
  ].filter(([n]) => n > 0)
  const marks = [...new Set(c.seasons.flatMap(s => marksOf(s).slice(0, 2)))]
  const markName = { ring: S.ui?.champ ?? (S.isSoccer ? 'TROPHY' : S.isBucket ? 'TITLE' : 'SUPER BOWL'), award: AWARD_NAME[c.pos], first: S.first.toUpperCase(), honor: S.honor.toUpperCase() }
  const share = () => card.run(m => m.careerShareCanvas(c, { username }), { title: `${c.name}'s career`, filename: `career-${String(c.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png` })
  // the staged entrance: each section in turn, 100ms apart
  let n = 0
  const st = () => ({ '--i': n++ })
  return (
    <div className={`ag-screen ${S.screen} cr cr-legacy-screen cr--team cl`} style={teamVars(c.fit)}>
      {askBack && <AskSheet eyebrow="BAP PRO · THE COMEBACK" title={`Bring ${c.name} back?`} body={`Out of retirement for up to ${COMEBACK_SEASONS} more seasons, a year older. Once per career: the legacy and the Hall of Fame vote are redone when he retires for good.`} yes="UNRETIRE" no="STAY RETIRED" onYes={() => { setAskBack(false); onUnretire() }} onNo={() => setAskBack(false)} />}
      <div className="ag-screen-head cl-in" style={st()}>
        <div className="cl-head">
          <span className="ag-eyebrow">{c.unretired ? 'RETIRED FOR GOOD' : 'CAREER OVER'} · {years}</span>
          <h1 className="ag-h1" style={{ fontSize: (c.name ?? '').length > 14 ? 30 : (c.name ?? '').length > 10 ? 36 : 42 }}>{c.name}</h1>
          <span className="cl-tags"><i>{POS_NAME[c.pos].toUpperCase()}</i>{c.sport === 'soccer' && <i>{nationName(c.nation).toUpperCase()}</i>}<i>{t.seasons} {t.seasons === 1 ? 'SEASON' : 'SEASONS'}</i>{c.unretired && <i className="is-cb">COMEBACK</i>}{c.sandbox && <i>SANDBOX</i>}</span>
        </div>
        <button className="ag-round-btn" onClick={onExit} aria-label="Home"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <section className={`ag-card cl-hero cl-in${c.hof?.in ? ' is-hof' : ''}`} style={st()}>
          <div className="cl-tier-row">
            <span className="cl-tier"><small>LEGACY TIER</small><b>{L.tier}</b></span>
            <span className="cl-score"><b>{L.score}</b><small>LEGACY PTS</small></span>
          </div>
          <div className="cl-ladder" role="img" aria-label={`Legacy tier: ${L.tier}`}>
            {legacyTiers(c).map(([min, name]) => <span key={name} className={`${L.score >= min ? 'is-on' : ''}${L.tier === name ? ' is-cur' : ''}`}><i /><small>{name}</small></span>)}
          </div>
          {c.hof && (
            <div className={`cl-hof${c.hof.in ? ' is-in' : ''}`}>
              <IconCrown size={17} />
              <b>{S.isSoccer ? c.hof.ballot.toUpperCase() : c.hof.in ? `HALL OF FAME · ${c.hof.ballot.toUpperCase()}` : c.hof.ballot.toUpperCase()}</b>
              {!S.isSoccer && (c.hof.in || L.score >= 140) && <em>{c.hof.pct}%<small>OF THE VOTE</small></em>}
            </div>
          )}
          <p className="cl-story">{story}</p>
        </section>

        <section className="ag-card cl-in" style={st()}>
          <span className="ag-eyebrow cl-label">THE CAREER IN NUMBERS</span>
          <div className="cl-big">{keys.map(k => <span key={k}><b>{fmtK(S, k, t.stats[k])}</b><small>{STAT_LABEL[k]}{S.averages?.[k] ? ' · CAREER' : ''}</small></span>)}</div>
          <div className="cl-small">
            <span><b>{t.seasons}</b><small>SEASONS</small></span>
            <span><b>{S.isSoccer ? `${t.wins}–${t.draws ?? 0}–${t.losses}` : `${t.wins}–${t.losses}`}</b><small>RECORD</small></span>
            <span><b>{S.isSoccer ? t.caps ?? 0 : t.playoffs}</b><small>{S.isSoccer ? 'CAPS' : t.playoffs === 1 ? 'PLAYOFF YEAR' : 'PLAYOFF YEARS'}</small></span>
            <span><b>{earned(c, Math.round(t.earnings))}</b><small>EARNED</small></span>
          </div>
        </section>

        {S.isBaseball && c.seasons.some(s => s.champion || s.mvp || s.cy) && (
          <section className="ag-card cl-in" style={st()}>
            <span className="ag-eyebrow cl-label">THE BANNERS</span>
            <Suspense fallback={null}><BaseballBanners c={c} /></Suspense>
          </section>
        )}
        {S.isSoccer && c.seasons.some(s => (s.bdo?.rank ?? 99) <= 3) && (
          <section className="ag-card cl-in" style={st()}>
            <span className="ag-eyebrow cl-label">THE {S.awardName.st}</span>
            <Suspense fallback={null}><AwardBanners c={c} /></Suspense>
          </section>
        )}
        {hardware.length > 0 && (
          <section className="ag-card cl-in" style={st()}>
            <span className="ag-eyebrow cl-label">THE TROPHY CASE</span>
            <div className="cl-case">{hardware.map(([v, k, Ico, gold]) => <span key={k} className={`cl-trophy${gold ? ' is-gold' : ''}`}><Ico size={18} /><b>{v}</b><small>{k}</small></span>)}</div>
          </section>
        )}

        <section className="ag-card cl-in" style={st()}>
          <span className="ag-eyebrow cl-label">SEASON BY SEASON · TAP A YEAR</span>
          <div className="cl-strip">
            {c.seasons.map(s => {
              const ms = marksOf(s).slice(0, 2)
              const back = c.unretired && s.year >= c.unretired.year
              return (
                <button key={s.year} type="button" aria-pressed={s === open} onClick={() => { setPickedYear(s.year); sfx('tap') }} className={`cl-yr${s === best ? ' is-best' : ''}${s === open ? ' is-open' : ''}${s.champion || (S.isSoccer && s.trophies?.length) ? ' is-ring' : ''}${back ? ' is-cb' : ''}`} style={{ '--yc': tcOf(S, s.team) }} title={`${s.season} · ${s.teamName ?? s.team} · ${s.wins}–${s.losses}${s.champion ? ' · champions' : ''}${s.award ? ` · ${s.awardName}` : ''}`}>
                  <small>{s.season}</small>
                  <img src={logoFor(s.team)} alt={s.team} loading="lazy" />
                  <b>{S.isSoccer ? `${s.stats.goals}G` : `${s.wins}–${s.losses}`}</b>
                  <i>{ms.length ? ms.map(k => { const Ico = MARKS[k]; return <Ico key={k} size={13} className={`is-${k}`} /> }) : <em />}</i>
                </button>
              )
            })}
          </div>
          {(marks.length > 0 || best || c.unretired) && (
            <div className="cl-legend">
              {['ring', 'award', 'first', 'honor'].filter(k => marks.includes(k)).map(k => { const Ico = MARKS[k]; return <span key={k}><Ico size={12} className={`is-${k}`} /> {markName[k]}</span> })}
              {best && <span><i className="is-best" /> BEST SEASON</span>}
              {c.unretired && <span><i className="is-cb" /> COMEBACK</span>}
            </div>
          )}
        </section>

        {open && <SeasonOpen c={c} s={open} isBest={open === best} keys={keys} S={S} logoFor={logoFor} st={st()} />}
        <AnalyticsByYear c={c} />

        <section className="ag-card cl-greats cl-in" style={st()}>
          <div className="cl-greats-head">
            <span className="ag-eyebrow cl-label">AMONG THE GREATS</span>
            <span className="cl-rank">{L.ranked ? <>NO. <b>{L.rank}</b> {S.isSoccer ? 'ATTACKER' : S.isBucket ? 'CAREER' : `${POS_LABEL[c.pos]} CAREER`} EVER</> : <>OUTSIDE THE TOP {L.of}</>}</span>
          </div>
          <div className="cl-rows">
            {rows.map(x => x.me ? (
              <span key="me" className="cl-row is-me"><i>{L.ranked ? L.rank : '—'}</i><span className="cl-face"><CareerFace c={c} size={34} /></span><b>{c.name}</b><em>{L.score}</em></span>
            ) : (
              <span key={x.name} className="cl-row"><i>{x.rank}</i><span className="cl-face">{S.photo(x.name) ? <img src={S.photo(x.name)} alt="" loading="lazy" /> : <span className="crl-init">{initials(x.name)}</span>}</span><b>{x.name}</b><em>{x.score}</em></span>
            ))}
          </div>
          <p className="cl-note">{L.ranked ? (L.above ? `${L.above.score - L.score + 1} legacy points from passing ${L.above.name}.` : 'Ahead of every real career at the position.') : `${L.above.score - L.score + 1} legacy points short of the list.`} The greats are scored from their real careers with the same formula.</p>
          {comp && (
            <div className="cl-comp">
              <span className="cl-face">{comp.photo ? <img src={photoSrc(comp.photo)} alt="" loading="lazy" /> : <span className="crl-init">{initials(comp.name)}</span>}</span>
              <span><small>BUILT LIKE</small><b>{comp.name}</b></span>
              <em>{comp.match}%<small>MATCH</small></em>
            </div>
          )}
        </section>

        <section className="cl-acts cl-in" style={st()}>
          <button className="ag-btn ag-btn--gold tk-intro-go" onClick={share} disabled={card.busy}>{card.busy ? 'MAKING THE CARD…' : 'SHARE THE CAREER CARD'}</button>
          {card.img && <img src={card.img} alt={`${c.name}'s career card`} className="cl-preview" />}
        </section>

        {canUnretire(c) && (pro || sells) && (
          <section className="ag-card cl-back cl-in" style={st()}>
            <span className="cl-back-txt">
              <span className="ag-eyebrow"><IconCrown size={13} /> BAP PRO · THE COMEBACK</span>
              <b>One more run?</b>
              <small>{c.name} comes out of retirement for up to {COMEBACK_SEASONS} more seasons, a year older. Once per career.{pro ? '' : ' A BAP Pro feature.'}</small>
            </span>
            {pro
              ? <button className="ag-btn ag-btn--gold" onClick={() => { setAskBack(true); sfx('tap') }}>UNRETIRE</button>
              : <button className="ag-btn ag-btn--ghost cl-back-pro" onClick={() => { nav('pro'); sfx('tap') }}><IconCrown size={15} /> SEE PRO</button>}
          </section>
        )}

        <section className="cl-nav cl-in" style={st()}>
          <button className="ag-btn ag-btn--ghost" onClick={() => { clearCareer(c.sport, c.uid, c.slot ?? 0); setCareer(null); onNewBuild() }}>NEW CAREER</button>
          <button className="ag-btn ag-btn--ghost" onClick={onExit}>HOME</button>
        </section>
      </div>
    </div>
  )
}

// ── Playoffs: a round, its moment, the result ────────────────────────────────
function Playoffs({ c, setCareer, onBook }) {
  const S = sportOf(c), logoFor = S.logo
  const po = c.active.po
  const rd = po.rounds[po.idx]
  const last = po.line[po.line.length - 1]
  const [step, setStep] = useState(po.stage === 'done' ? 'result' : last && !rd?.played && po.line.length ? 'result' : 'card')
  // (Simple mode only deals the games with a quick version)
  // (football: a game that isn't close at the end deals a regular moment, not a last play)
  const game = useMemo(() => playoffGame(c, po, gamesMode(c) === 'simple' ? g => !!SIMPLE_GAMES[g] : null), [c.seed, c.year, po.idx]) // eslint-disable-line
  // (a sport can set the moment inside its game: baseball's inning, half and score agree with the series game it's in)
  const sit = useMemo(() => sportOf(c).x?.momentSit?.(c, po, game) ?? momentSituation(game, `${c.seed}-${c.year}-${po.idx}`, { us: c.team, them: rd?.opp }), [c.seed, c.year, po.idx, game]) // eslint-disable-line
  // the round's odds as it will be played (with Mini Games on None, no moment: the matchup's own)
  const noGames = gamesMode(c) === 'off'
  const odds = rd ? roundOdds(c, rd, game, noGames, po.idx) : null
  const pct = x => Math.min(99, Math.max(1, Math.round(x * 100)))
  const word = rd?.series ? 'series' : 'game'
  // (a last play in a series decides game 4: the score going in, and the series after it)
  const ss = odds?.state
  const serStakes = ss && `${ss.a > ss.b ? 'Up' : 'Down'} ${ss.a}–${ss.b} in the series. ${odds.game === 0 ? 'Win this one' : 'Land it'} and ${ss.a === 3 ? 'they sweep it' : `it’s ${ss.a + 1}–${ss.b}: about ${pct(ss.win)}% to take the series`}. ${odds.game === 0 ? (ss.b === 3 ? 'Lose it and they’re swept.' : `Lose it and it’s ${ss.a}–${ss.b + 1}: about ${pct(ss.lose)}%.`) : `Miss it: about ${pct(ss.miss)}%.`}`
  // (which kind it is: the last play decides it, or a big play with the rest of the game still to come)
  const stakes = !odds ? '' : serStakes ? serStakes : odds.hit === 1 ? `The last play. Land it: they win the ${word}. Miss it: ${odds.miss === 0 ? 'they’re out' : `about ${pct(odds.miss)}% to win`}.` : `${rd?.series ? '' : 'A big play, not the last one. '}Land it: about ${pct(odds.hit)}% to win. Miss it: about ${pct(odds.miss)}%.`
  if (S.isBaseball) return <Suspense fallback={null}><BaseballPostseason c={c} setCareer={setCareer} onBook={onBook} step={step} setStep={setStep} game={game} sit={sit} odds={odds} noGames={noGames} /></Suspense>
  if (S.isSoccer) return <Suspense fallback={null}><SoccerNights c={c} setCareer={setCareer} onBook={onBook} step={step} setStep={setStep} game={game} sit={sit} /></Suspense>
  if (po.stage === 'done' || step === 'result') {
    const x = last
    return (
      <div className="cr-po">
        {x && (
          <div className={`ag-card cr-po-result ag-pop${x.won ? ' is-w' : ' is-l'}`}>
            <span className="ag-eyebrow">FINAL · {x.name.toUpperCase()}</span>
            <div className="cr-po-board">
              {[[c.team, x.mySc, x.won], [x.opp, x.oppSc, !x.won]].map(([t, sc, up]) => (
                <div key={t} className={`cr-po-side${up ? ' is-up' : ''}`} style={{ '--tc': S.teamOf(t)?.color ?? '#26302c' }}>
                  <img src={logoFor(t)} alt="" />
                  <small>{t}</small>
                  <b>{sc}</b>
                </div>
              ))}
            </div>
            <b>{x.won ? (x.name === S.final ? 'Champions.' : `Through to the ${po.rounds[po.rounds.findIndex(r => r.name === x.name) + 1]?.name ?? 'next round'}.`) : `Season over in the ${x.name}.`}</b>
            <small>{GAME_LINE[c.pos]?.(x) ?? ''}{x.perGame ? ' a game' : ''} · {x.auto ? (x.series && Math.min(x.mySc, x.oppSc) >= 2 ? `${x.won ? 'won it' : 'lost it'} in ${['six', 'seven'][Math.min(x.mySc, x.oppSc) - 2]}` : x.won ? 'never in doubt' : 'never close') : `the moment went ${!(x.hit ?? x.score >= 0.5) ? 'wrong' : x.score >= 0.85 ? 'perfectly' : 'right'}`}{x.swing ? <> · {x.swing}</> : null}</small>
          </div>
        )}
        {po.stage === 'done'
          ? <button className="ag-btn ag-btn--gold tk-intro-go" onClick={onBook}>WRAP THE SEASON <IconArrow size={16} /></button>
          : <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { setStep('card'); sfx('tap') }}>NEXT ROUND <IconArrow size={16} /></button>}
      </div>
    )
  }
  if (step === 'game') return (
    <div className="cr-po">
      <div className="cr-po-head"><span className="ag-eyebrow">{rd.name.toUpperCase()} · vs {rd.oppName.toUpperCase()}</span><small className="cr-po-stakes">{sit.line}{sit.tail ? ` ${sit.tail}` : ''} {stakes}</small></div>
      <CareerGame weather={c.sport !== 'bucket' ? playoffWeather(rd.home === false ? rd.opp : c.team, rd.name === 'Super Bowl', seeded(`${c.seed}-${c.year}-${po.idx}-wx`)) : null} home={rd.home === false ? 'opp' : 'team'} superBowl={c.sport !== 'bucket' && rd.name === 'Super Bowl' ? romanOf((c.season ?? 2026) - 1965) : null} retry c={c} setCareer={setCareer} team={c.fit} pos={combinePos(c)} opp={sportOf(c).teamOf(rd.opp)} cast={gameCast(c, rd.opp)} situation={sit} key={`${po.idx}-${game}`} game={game} build={c.build} seed={`${c.seed}-${c.year}-${po.idx}`} lock={`${c.seed}-${c.year}-${po.idx}`} onDone={res => { setCareer(playoffRound(c, res.score, game, res.hit, res.raw?.pts ?? (game === 'fast-break' && res.raw ? (res.raw.made ?? 0) * 2 : null))); setStep('result') }} />
    </div>
  )
  return (
    <div className="cr-po">
      <div className="ag-card cr-po-card ag-pop">
        <span className="ag-eyebrow">PLAYOFFS · {rd.name.toUpperCase()}{rd.series ? ' · BEST OF 7' : ''}</span>
        <div className="cr-po-match"><img src={logoFor(c.team)} alt="" /><b>{c.team}</b><i>vs</i><b>{rd.opp}</b><img src={logoFor(rd.opp)} alt="" /></div>
        <small>{rd.home === null ? 'Neutral site' : rd.home ? 'At home' : 'On the road'} · {pct(cardOdds(c, po, gamesMode(c) === 'simple' ? g => !!SIMPLE_GAMES[g] : null, noGames))}% to win the {word}</small>
        <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { sfx('whistle'); if (noGames) { setCareer(playoffRound(c, null)); setStep('result') } else setStep('game') }}>PLAY THE {rd.series ? 'SERIES' : 'GAME'} <IconArrow size={16} /></button>
      </div>
      {po.line.length > 0 && <div className="cr-goals">{po.line.map(x => <span key={x.name} className={`cr-goal${x.won ? ' is-met' : ' is-miss'}`}>{x.name}: {x.won ? 'W' : 'L'} {x.mySc}–{x.oppSc}</span>)}</div>}
    </div>
  )
}

// ── Talks: one offer on the table; push, sign, or walk ───────────────────────
function Talks({ c, setCareer }) {
  const t = c.talks
  const lev = leverageOf(c)
  const moneyPushes = t.asked.filter(k => k === 'money').length
  const soccer = c.sport === 'soccer'
  // (football's words for the same asks: the clause that lets him leave, a place in the team in writing)
  const SOCCER_ASK = { money: ['HIGHER WAGES', '+8% a week'], years: ['ANOTHER YEAR', '+1 year, same wages'], notrade: ['RELEASE CLAUSE', 'A set fee lets him leave'], starter: ['FIRST-TEAM PROMISE', 'Regular starts in writing'] }
  return (
    <div className="ag-card cr-talks ag-pop">
      <div className="ag-card-head"><span className="ag-eyebrow">AT THE TABLE · {t.fit.name.toUpperCase()}</span><span className="cr-fit-status">{t.fit.status}</span></div>
      <div className="cr-talks-terms">
        {soccer
          ? <><span className="cr-offer-money"><b>{wageText(t.perYear, t.team).replace(' a week', '')}</b><small>A WEEK</small></span><span className="cr-offer-money"><b>{t.years}</b><small>{t.years === 1 ? 'YEAR' : 'YEARS'}</small></span><span className="cr-offer-money"><b>{soccerCur(t.team)}{r1(t.perYear * t.years)}M</b><small>TOTAL</small></span></>
          : <><span className="cr-offer-money"><b>{money(t.perYear)}</b><small>A YEAR</small></span><span className="cr-offer-money"><b>{t.years}</b><small>{t.years === 1 ? 'YEAR' : 'YEARS'}</small></span><span className="cr-offer-money"><b>{money(r1(t.perYear * t.years))}</b><small>TOTAL</small></span></>}
      </div>
      <div className="cr-badges">{t.noTrade && <span className="cr-badge is-gold"><IconShield size={12} /> {soccer ? 'RELEASE CLAUSE' : 'NO-TRADE'}</span>}{t.starter && <span className="cr-badge is-gold"><IconStar size={12} /> {soccer ? 'FIRST-TEAM PROMISE' : 'STARTER'}</span>}</div>
      <div className="cr-patience"><span className="ag-eyebrow">THEIR PATIENCE · LEVERAGE {['NONE', 'LOW', 'SOME', 'REAL', 'ALL OF IT'][lev]}</span><span className="cr-patience-dots">{Array.from({ length: t.max }, (_, i) => <i key={i} className={i < t.patience ? 'is-on' : ''} />)}</span></div>
      {t.lines.length > 0 && <p className="cr-talks-line">{t.lines[t.lines.length - 1]}</p>}
      {t.walked ? (
        <>
          <p className="cr-note">They pulled the offer. {c.offers?.length ? 'The other teams are still waiting.' : 'What\'s left is whatever the market has late.'}</p>
          <button className="ag-btn ag-btn--ghost" onClick={() => { setCareer(closeTalks(c)); sfx('tap') }}>BACK TO THE OFFERS</button>
        </>
      ) : (
        <>
          <div className="cr-asks">
            {Object.entries(ASKS).map(([k, a]) => {
              const used = k === 'money' ? moneyPushes >= 3 : t.asked.includes(k)
              const o = askOdds(c, k)
              return <button key={k} className="cr-ask" disabled={used} onClick={() => { const n = ask(c, k); setCareer(n); sfx(n.talks?.walked ? 'deny' : 'tap') }}><b>{soccer ? SOCCER_ASK[k][0] : a.label}</b><small>{soccer ? SOCCER_ASK[k][1] : a.sub}</small><small className="cr-ask-cost">costs {o.lo} · {Math.round(o.p * 100)}% it's {o.hi}</small></button>
            })}
          </div>
          <div className="cr-actions">
            <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { setCareer(acceptTalks(c)); sfx('purchase'); haptic('success') }}>SIGN · {soccer ? wageText(t.perYear, t.team).replace(' a week', ' A WEEK') : money(t.perYear)} × {t.years} {t.years === 1 ? 'YR' : 'YRS'}</button>
            <button className="ag-btn ag-btn--ghost" onClick={() => { setCareer(closeTalks(c)); sfx('tap') }}>WALK AWAY</button>
          </div>
        </>
      )}
    </div>
  )
}
const r1 = v => Math.round(v * 10) / 10

// ═════════════════════════════════════════════════════════════════════════════
// SOCCER's own screens: the season recap, the transfer window, the season-by-season table
// ═════════════════════════════════════════════════════════════════════════════
// (the Premier League and the Bundesliga take 'the'; La Liga, Serie A and Ligue 1 don't)
export const inLeague = n => (/^(Premier League|Bundesliga)$/.test(n ?? '') ? `the ${n}` : n ?? 'the league')
export const ordinalOf = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
// a season the way football writes it: 2026-27
export const seasonOf = y => `${y}-${String((y + 1) % 100).padStart(2, '0')}`
// a club's crest (a side outside the data has none: its initials)
export function ClubLogo({ S, short, extra, className = '' }) {
  if (extra) return <span className={`cr-club-init ${className}`}>{String(short ?? '?').slice(0, 3)}</span>
  return <img src={S.logo(short)} alt="" className={className} />
}
// a tie's score: one match, or both legs and the aggregate, and penalties when it went that far
export const tieText = x => {
  const legs = x.legs ?? [[x.mySc, x.oppSc]]
  const agg = legs.length > 1 ? ` (${legs.map(l => `${l[0]}–${l[1]}`).join(', ')})` : ''
  return `${x.mySc}–${x.oppSc}${agg}${x.pens ? (x.pens === 'won' ? ', won on penalties' : ', lost on penalties') : ''}`
}
// soccer's own screens (components/app/CareerSoccer.jsx): loaded only for a soccer career
const soccerScreen = name => lazy(() => import('./CareerSoccer').then(m => ({ default: m[name] })))
const SoccerRecap = soccerScreen('SoccerRecap'), SoccerWindow = soccerScreen('SoccerWindow'), SoccerSeasonTable = soccerScreen('SoccerSeasonTable'), AwardBanners = soccerScreen('AwardBanners'), SoccerNights = soccerScreen('SoccerNights')
// baseball's own screens (components/app/CareerBaseball.jsx): loaded only for a baseball career
const bbScreen = name => lazy(() => import('./CareerBaseball').then(m => ({ default: m[name] })))
const BaseballRecap = bbScreen('BaseballRecap'), BaseballContract = bbScreen('BaseballContract'), BaseballSeasonTable = bbScreen('BaseballSeasonTable'), BaseballTotals = bbScreen('BaseballTotals'), BaseballBanners = bbScreen('BaseballBanners'), BaseballPostseason = bbScreen('BaseballPostseason'), BaseballLineup = bbScreen('BaseballLineup'), BaseballChunk = bbScreen('BaseballChunk')
// a stat as its sport prints it (baseball's .312 and 2.45: S.fmtStat), else a count or a one-decimal rate
const fmtK = (S, k, v) => (S?.fmtStat ? S.fmtStat(k, v) : fmt(v))
const ICONS = { ring: IconRing, trophy: IconTrophy, crown: IconCrown, medal: IconMedal, star: IconStar, flame: IconFlame }
