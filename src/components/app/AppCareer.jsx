import { useEffect, useMemo, useRef, useState } from 'react'
import {
  POS_LABEL, POS_NAME, POS_ATTR, OFFENSE_POS, pastCareers, saveCareer, clearCareer, stockOf, answerTrivia, answerInterview, runDraft,
  startSeason, resumeSeason, advanceWeek, chooseMoment, resolveInjury, endSeason, spendDev, signOffer, demandTrade, nextSeason,
  retire, canRetire, mustRetire, careerTotals, legacyOf, LEGACY_TIERS, STAT_LABEL, HEADLINE_STATS, careerCard, AWARD_NAME, MAX_SEASONS, goalsFor,
} from '../../lib/career'
import { GAME_LINE } from '../../lib/seasonDirector'
import { valToGrade } from '../../utils/simulation'
import { sfx, haptic, victory } from '../../lib/juice'
import { MomentCard, NowCard } from './AppSeasonPlus'
import Silhouette from '../Silhouette'
import { NameTag } from './NameTag'
import { IconClose, IconArrow, IconFlame, IconTrophy, IconStar, IconCrown, IconMedal, IconRing, IconCheck, IconShield, IconHelmet } from './icons'

// CAREER (football): the intro, the draft, the hub where a career is played
// (your model and traits, the season week by week, the player, the team, the
// record so far) and the legacy screen. The engine is lib/career.js.

const gradeColor = v => (v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444')
const logoFor = short => `/logos/${short}.png`
const nick = name => (name || '').split(' ').slice(-1)[0]
const money = n => `$${n}M`
const RUN_DATE = { month: 'short', day: 'numeric' }

// ── Intro: what Career is, and the careers before this one ──────────────────
export function CareerIntro({ onStart, onClose }) {
  const runs = useMemo(() => pastCareers('nfl'), [])
  const steps = [
    ['Build', 'Draft your player from traits, the same spins as a normal game. That build is who you take into the league.'],
    ['The draft', 'Combine numbers, a test, the interviews. Your stock moves, then draft day decides where you land, and the offense around you matters.'],
    ['The career', 'Season after season, week by week, stopping at the moments that matter: decisions, injuries, surprises. A point to grow every offseason.'],
    ['Legacy', 'Contracts, free agency, trade demands, retirement. Awards, records, the Hall of Fame, and where you rank among the all-time greats.'],
  ]
  return (
    <div className="ag-screen ag-screen--nfl cr cr-intro">
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">FLAGSHIP · MULTI-SEASON</span><h1 className="ag-h1">Career</h1></div>
        <button className="ag-round-btn" onClick={onClose} aria-label="Home"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <div className="cr-intro-hero ag-pop">
          <span className="cr-intro-kicker">ONE PLAYER. A WHOLE CAREER.</span>
          <p>Up to {MAX_SEASONS} seasons, about an hour of play, saved every step so you can leave and come back. Offense for now: QB, RB, WR, TE.</p>
        </div>
        <ol className="tk-steps ag-pop" style={{ '--d': '80ms' }}>
          {steps.map(([t, d], i) => <li key={t}><span className="tk-step-n">{i + 1}</span><span className="tk-step-txt"><b>{t}</b><small>{d}</small></span></li>)}
        </ol>
        <button className="ag-btn ag-btn--gold tk-intro-go ag-pop" style={{ '--d': '130ms' }} onClick={onStart}>BUILD A PLAYER · START A CAREER <IconArrow size={16} /></button>
        <section className="tk-runs ag-pop" style={{ '--d': '160ms' }}>
          <div className="ag-card-head"><span className="ag-eyebrow">YOUR CAREERS</span></div>
          {runs.length === 0
            ? <div className="tk-runs-empty">No careers yet. The first one starts with a build.</div>
            : runs.map((r, i) => (
              <div key={r.at + '-' + i} className={`tk-run${r.hof ? ' is-won' : ''}`}>
                <span className="tk-run-pos">{POS_LABEL[r.pos] ?? r.pos}</span>
                <span className="tk-run-txt">
                  <b>{r.hof ? <><IconCrown size={13} /> Hall of Famer</> : r.tier} · No. {r.rank} all-time</b>
                  <small>{new Date(r.at).toLocaleDateString(undefined, RUN_DATE)} · {r.seasons} seasons · {r.rings} {r.rings === 1 ? 'ring' : 'rings'} · {r.awards} {r.awards === 1 ? 'award' : 'awards'}</small>
                </span>
                <span className="tk-run-ovr"><b>{r.score}</b><small>LEGACY</small></span>
              </div>
            ))}
        </section>
      </div>
    </div>
  )
}

// ── The player: model + the traits around it ─────────────────────────────────
// The model wears the team's colors (the chips keep their players, grades and faces)
const inTeamColors = (build, fit) => (fit ? Object.fromEntries(Object.entries(build).map(([t, ch]) => [t, ch ? { ...ch, teamColor: fit.color, teamColor2: fit.color2, team: fit.short } : ch])) : build)
function Model({ c, devPick }) {
  const attr = POS_ATTR[c.pos]
  const shown = useMemo(() => inTeamColors(c.build, c.fit), [c.build, c.fit])
  const half = Math.ceil(c.types.length / 2)
  const Card = ({ t }) => {
    const ch = c.build[t]
    const canUp = devPick && c.dev.points > 0 && (ch?.val ?? 11) < 11
    return (
      <div className={`cr-trait${canUp ? ' can-up' : ''}`} onClick={canUp ? () => devPick(t) : undefined} role={canUp ? 'button' : undefined}>
        <span className="cr-trait-av">{ch?.photo ? <img src={ch.photo} alt="" /> : null}</span>
        <span className="cr-trait-txt"><b>{attr[t]?.shortLabel ?? attr[t]?.label ?? t}</b><small>{nick(ch?.qbFull) || '—'}{ch?.upgraded ? ` +${ch.upgraded}` : ''}{ch?.faded ? ` −${ch.faded}` : ''}</small></span>
        <span className="cr-trait-g" style={{ background: gradeColor(ch?.val ?? 0) }}>{canUp ? '+1' : valToGrade(ch?.val ?? 0)}</span>
      </div>
    )
  }
  return (
    <div className="cr-model-wrap ag-pop">
      <div className="cr-traits cr-traits--l">{c.types.slice(0, half).map(t => <Card key={t} t={t} />)}</div>
      <div className="cr-model">
        <Silhouette build={shown} types={c.types} attrMap={attr} isRB={c.pos === 'rb'} isWR={c.pos === 'wr'} isTE={c.pos === 'te'} modelOnly />
        <span className="cr-model-ovr"><b>{c.ovr}</b><small>OVR</small></span>
      </div>
      <div className="cr-traits cr-traits--r">{c.types.slice(half).map(t => <Card key={t} t={t} />)}</div>
    </div>
  )
}
function LegacyMeter({ c }) {
  const L = legacyOf(c)
  const tierMin = [...LEGACY_TIERS].reverse().find(([m]) => L.score >= m)[0]
  const pct = L.next ? Math.min(100, Math.round(((L.score - tierMin) / (L.next.at - tierMin)) * 100)) : 100
  return (
    <div className="cr-legacy">
      <div className="cr-legacy-top"><span className="ag-eyebrow">LEGACY · {L.tier.toUpperCase()}</span><b>{L.score}</b></div>
      <div className="cr-legacy-bar"><span style={{ width: `${Math.max(3, pct)}%` }} /></div>
      <div className="cr-legacy-foot"><span>{L.next ? `${L.next.at - L.score} to ${L.next.name}` : 'Top of the ladder'}</span><span>No. {L.rank} {POS_LABEL[c.pos]} all-time</span></div>
    </div>
  )
}

// ── Draft ───────────────────────────────────────────────────────────────────
function Draft({ c, setCareer }) {
  const [step, setStep] = useState(c.step ?? 'combine')
  const [qi, setQi] = useState(0)
  const [shown, setShown] = useState(0)
  const stock = stockOf(c)
  const go = s => { setStep(s); setCareer({ ...c, step: s }); sfx('tap') }
  // draft day: the picks tick by until yours
  useEffect(() => {
    if (step !== 'day' || !c.draft.picks) return
    if (shown >= c.draft.picks.length) return
    const id = setTimeout(() => { setShown(n => n + 1); sfx(shown + 1 === c.draft.picks.length ? 'claim' : 'tick') }, shown === 0 ? 600 : 900)
    return () => clearTimeout(id)
  }, [step, shown, c.draft.picks])
  const range = `${stock.loP.round === stock.hiP.round ? `ROUND ${stock.loP.round}` : `ROUNDS ${stock.loP.round}–${stock.hiP.round}`} · PICKS ${stock.lo}–${stock.hi}`
  const head = (kicker, title) => (
    <div className="ag-screen-head"><div><span className="ag-eyebrow">{kicker}</span><h1 className="ag-h1">{title}</h1></div><span className="cr-stock"><small>PROJECTED</small><b>{range}</b></span></div>
  )
  if (step === 'combine') return (
    <div className="ag-screen ag-screen--nfl cr">
      {head(`THE COMBINE · ${POS_LABEL[c.pos]}`, 'Your numbers')}
      <div className="ag-screen-body">
        <Model c={c} />
        <div className="cr-drills ag-pop" style={{ '--d': '60ms' }}>
          {c.draft.combine.map((d, i) => (
            <div key={d.id} className="cr-drill" style={{ '--d': `${80 + i * 70}ms` }}>
              <span className="cr-drill-txt"><b>{d.label}</b><small>{POS_ATTR[c.pos][d.trait]?.label ?? d.trait}</small></span>
              <span className="cr-drill-bar"><span style={{ width: `${Math.round(Math.max(6, Math.min(100, 50 + d.pct * 50)))}%`, background: d.pct >= .35 ? '#22c55e' : d.pct >= 0 ? '#eab308' : '#f97316' }} /></span>
              <b className="cr-drill-n">{d.text}</b>
            </div>
          ))}
        </div>
        <p className="cr-note ag-pop">Scouts saw the whole workout. Next: the test and the interviews. Both move your stock.</p>
        <button className="ag-btn tk-intro-go" onClick={() => go('trivia')}>TAKE THE TEST <IconArrow size={16} /></button>
      </div>
    </div>
  )
  if (step === 'trivia') {
    const q = c.draft.trivia[qi]
    const done = c.draft.trivia.every(t => t.answer != null)
    const right = c.draft.trivia.filter(t => t.answer === t.c).length
    return (
      <div className="ag-screen ag-screen--nfl cr">
        {head('THE TEST', done ? `${right} of ${c.draft.trivia.length}` : `Question ${qi + 1} of ${c.draft.trivia.length}`)}
        <div className="ag-screen-body">
          {!done ? (
            <div className="cr-q ag-pop" key={qi}>
              <p className="cr-q-text">{q.q}</p>
              <div className="cr-q-opts">{q.a.map((a, i) => (
                <button key={i} className={`cr-q-opt${q.answer === i ? (i === q.c ? ' is-right' : ' is-wrong') : ''}${q.answer != null && i === q.c ? ' is-right' : ''}`} disabled={q.answer != null}
                  onClick={() => { setCareer(answerTrivia(c, qi, i)); sfx(i === q.c ? 'claim' : 'deny'); haptic('light'); setTimeout(() => setQi(k => Math.min(k + 1, c.draft.trivia.length - 1)), 700) }}>{a}</button>
              ))}</div>
            </div>
          ) : (
            <div className="cr-q ag-pop">
              <p className="cr-q-text">{right >= 4 ? 'Sharp. Coaches like a player who knows the game.' : right >= 2 ? 'Fine. Nothing that scares anyone off.' : 'Rough. A few teams quietly move you down their board.'}</p>
              <button className="ag-btn tk-intro-go" onClick={() => go('interview')}>THE INTERVIEWS <IconArrow size={16} /></button>
            </div>
          )}
        </div>
      </div>
    )
  }
  if (step === 'interview') {
    const i = c.draft.interviews.findIndex(x => x.answer == null)
    const done = i < 0
    const it = c.draft.interviews[i]
    return (
      <div className="ag-screen ag-screen--nfl cr">
        {head('THE INTERVIEWS', done ? 'Read like a pro' : `Room ${i + 1} of ${c.draft.interviews.length}`)}
        <div className="ag-screen-body">
          {!done ? (
            <div className="cr-q ag-pop" key={i}>
              <p className="cr-q-text">{it.q}</p>
              <div className="cr-q-opts">{it.a.map((a, k) => <button key={k} className="cr-q-opt" onClick={() => { setCareer(answerInterview(c, i, k)); sfx('tap') }}>{a.t}</button>)}</div>
            </div>
          ) : (
            <div className="cr-q ag-pop">
              <p className="cr-q-text">The scouts have their notes. Your stock is set: <b>{range.toLowerCase()}</b>.</p>
              <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { setCareer(runDraft({ ...c, step: 'day' })); setStep('day'); setShown(0); sfx('whistle') }}>DRAFT DAY <IconArrow size={16} /></button>
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
    <div className="ag-screen ag-screen--nfl cr">
      <div className="ag-screen-head"><div><span className="ag-eyebrow">DRAFT DAY</span><h1 className="ag-h1">{landed ? 'You\'re in' : 'On the clock'}</h1></div></div>
      <div className="ag-screen-body">
        <div className="cr-ticker ag-pop">
          {picks.slice(0, shown).map(p => (
            <div key={p.o} className={`cr-pick${p.you ? ' is-you' : ''}`}>
              <span className="cr-pick-n">{p.round}.{String(p.slot).padStart(2, '0')}</span>
              <img src={logoFor(p.team)} alt="" />
              <span className="cr-pick-txt">{p.you ? <b>{c.name} · {POS_LABEL[c.pos]}</b> : <><b>{p.player}</b><small>{p.pos}</small></>}</span>
            </div>
          ))}
          {!landed && <div className="cr-pick is-wait"><span className="bt-dots"><i /><i /><i /></span> pick {picks[shown]?.o ?? ''} is in…</div>}
        </div>
        {landed && mine && c.fit && (
          <>
            <div className="cr-land ag-pop" style={{ '--tc': c.fit.color }}>
              <img src={logoFor(c.team)} alt="" className="cr-land-logo" />
              <div className="cr-land-txt">
                <span className="ag-eyebrow">PICK {mine.o} · {c.fit.status.toUpperCase()}</span>
                <b>{c.fit.name}</b>
                <small>Rookie deal: {c.contract.years} yrs · {money(c.contract.perYear)} a year{c.contract.option ? ' · 5th-year option' : ''}</small>
              </div>
            </div>
            <TeamFit c={c} />
            <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { setCareer({ ...c, phase: 'preseason', step: null }); sfx('purchase'); haptic('success') }}>SIGN THE ROOKIE DEAL <IconArrow size={16} /></button>
          </>
        )}
      </div>
    </div>
  )
}

// ── The team around you ──────────────────────────────────────────────────────
function TeamFit({ c }) {
  const f = c.fit
  const G = ({ k, v, sub }) => <span className="cr-fit-g"><b style={{ color: gradeColor(v) }}>{v}</b><small>{k}</small>{sub && <i>{sub}</i>}</span>
  return (
    <div className="cr-fit ag-pop" style={{ '--d': '80ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE OFFENSE AROUND YOU</span><span className="cr-fit-status">{f.status}</span></div>
      <div className="cr-fit-grid">
        {c.pos !== 'qb' && <G k="QB" v={f.qb} sub={nick(f.qbName)} />}
        <G k="O-LINE" v={f.ol} sub={f.olNames.slice(0, 2).map(nick).join(', ')} />
        <G k="WEAPONS" v={f.weapons} sub={f.weaponNames.slice(0, 2).map(nick).join(', ')} />
        <G k="OFFENSE" v={f.off} /><G k="DEFENSE" v={f.def} />
      </div>
      <p className="cr-fit-note">{c.pos === 'qb'
        ? (f.ol < 5 ? 'A bad line hurts development: sacks, hits, hurried throws.' : f.weapons >= 8 ? 'Elite weapons make a quarterback\'s numbers.' : 'A workable line and honest weapons. Your play decides it.')
        : (f.qb >= 8 ? 'A real quarterback feeds you. Targets, yards, touchdowns.' : f.qb < 5 ? 'A weak quarterback caps a skill player. Fewer good balls.' : 'A middling quarterback. You\'ll have to make your own plays.')}
        {f.status === 'Rebuilding' ? ' Rebuilding team: more early reps, fewer wins.' : f.status === 'Contender' ? ' Contender: a shot at rings, and less patience.' : ''}
        {f.rival && f.rival.name !== c.name ? ` On the depth chart with you: ${f.rival.name}.` : ''}</p>
      <div className="cr-fit-meta"><span>{f.conf} · {f.div}</span></div>
    </div>
  )
}

// ── Hub ─────────────────────────────────────────────────────────────────────
export default function AppCareer({ career: c, setCareer, user, onNewBuild, onExit }) {
  const [tab, setTab] = useState(c?.phase === 'offseason' ? 'season' : 'season')
  const D = useRef(null)
  useEffect(() => { if (c) saveCareer(c) }, [c])
  useEffect(() => { if (c?.phase === 'season' && c.active && !D.current) D.current = resumeSeason(c) }, [c?.phase]) // eslint-disable-line
  if (!c) return null
  if (c.phase === 'draft') return <Draft c={c} setCareer={setCareer} />
  if (c.phase === 'retired') return <Legacy c={c} setCareer={setCareer} onNewBuild={onNewBuild} onExit={onExit} />

  const L = legacyOf(c)
  const begin = () => { const [n, d] = startSeason(c); D.current = d; setCareer(n); sfx('whistle'); haptic('medium') }
  const advance = () => {
    if (!D.current) D.current = resumeSeason(c)
    const [n, ev] = advanceWeek(c, D.current)
    setCareer(n)
    if (ev?.injury) { sfx('deny'); haptic('heavy'); return }
    if (ev?.game) { sfx(ev.game.won ? 'lock' : 'pop'); if (ev.hits?.some(h => h.big)) sfx('chime') }
    if (ev?.moment) haptic('medium')
  }
  const pick = o => { const [n, out] = chooseMoment(c, D.current, o); setCareer(n); return out }
  const injury = play => { const [n, text] = resolveInjury(c, D.current, play); setCareer(n); sfx('tap') }
  const wrap = () => {
    if (!D.current) D.current = resumeSeason(c)
    const [n, s, f] = endSeason(c, D.current); D.current = null
    window.dispatchEvent(new CustomEvent('bap:season', { detail: { sport: 'nfl', pos: c.pos, mode: 'career', localOnly: true, wins: s.wins, losses: s.losses, playoffs: s.playoffs, champion: s.champion, award: s.award, awardName: s.awardName, ovr: c.ovr, ref: f } }))
    setCareer(n); setTab('season')
    if (s.champion || s.award) victory({ big: s.champion }); else sfx('complete')
  }
  const a = c.active
  const total = a?.base?.games?.length ?? 17
  const wins = a ? a.feed.filter(e => e.g).filter(e => e.g.won).length : 0, losses = a ? a.feed.filter(e => e.g && !e.g.won).length : 0
  const seasonOver = a && a.k >= total && !a.moment && !a.injury
  const last = c.seasons[c.seasons.length - 1]

  return (
    <div className="ag-screen ag-screen--nfl cr cr-hub">
      <div className="ag-screen-head">
        <div className="cr-head">
          <img src={logoFor(c.team)} alt="" className="cr-head-logo" />
          <div>
            <span className="ag-eyebrow">{c.fit?.name?.toUpperCase()} · YEAR {c.year + 1} · AGE {c.age} · {c.season}</span>
            <h1 className="ag-h1"><NameTag name={c.name} self plate={false} /> <small>{POS_LABEL[c.pos]}</small></h1>
          </div>
        </div>
        <button className="ag-round-btn" onClick={onExit} aria-label="Home"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <LegacyMeter c={c} />
        <Model c={c} devPick={c.phase !== 'season' && c.dev.points > 0 ? t => { setCareer(spendDev(c, t)); sfx('claim'); haptic('success') } : null} />
        {c.phase !== 'season' && c.dev.points > 0 && <div className="cr-devnote ag-pop"><IconStar size={14} /> <b>{c.dev.points}</b> development {c.dev.points === 1 ? 'point' : 'points'}: tap a trait to raise it.</div>}
        <div className="ag-seg cr-tabs" role="tablist">
          {[['season', c.phase === 'offseason' ? 'OFFSEASON' : 'SEASON'], ['player', 'PLAYER'], ['team', 'TEAM'], ['career', 'CAREER']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => { setTab(id); sfx('tap') }}>{label}</button>
          ))}
        </div>

        {tab === 'season' && c.phase === 'preseason' && (
          <section className="ag-card cr-sec ag-pop">
            <div className="ag-card-head"><span className="ag-eyebrow">SEASON {c.season} · {c.fit.status.toUpperCase()}</span></div>
            {c.aging?.length > 0 && <ul className="cr-list">{c.aging.map((t, i) => <li key={i}><IconFlame size={13} /> {t}</li>)}</ul>}
            <div className="cr-goals"><span className="ag-eyebrow">THIS YEAR'S GOALS</span>{goalsFor(c).map(g => <span key={g.k} className="cr-goal">{g.label}</span>)}</div>
            <p className="cr-note">{c.contract.left} {c.contract.left === 1 ? 'year' : 'years'} left on your deal ({money(c.contract.perYear)} a year). {c.contract.left === 1 ? 'Contract year: play for the next one.' : ''}</p>
            <button className="ag-btn ag-btn--gold tk-intro-go" onClick={begin}>START THE SEASON <IconArrow size={16} /></button>
          </section>
        )}

        {tab === 'season' && c.phase === 'season' && a && (
          <section className="cr-sec">
            <div className="cr-season-bar ag-pop">
              <span className="cr-rec"><b>{wins}–{losses}</b><small>WEEK {Math.min(a.k + 1, total)} OF {total}</small></span>
              <div className="cr-goals cr-goals--inline">{c.goals.map(g => <span key={g.k} className="cr-goal">{g.label}</span>)}</div>
            </div>
            {a.injury && (
              <div className="sm-moment cr-injury ag-pop">
                <span className="ag-eyebrow">INJURY · WEEK {a.k}</span>
                <h3 className="sm-moment-title">{a.injury.kind}</h3>
                <p className="sm-moment-body">{a.injury.serious ? 'The trainers don\'t need a second look. Your season is over.' : `The doctors say ${a.injury.games} ${a.injury.games === 1 ? 'game' : 'games'}. You could play through it: not at your best for longer, and it can get worse.`}</p>
                <div className="sm-options">
                  <button className="sm-option" onClick={() => injury(false)}><b>{a.injury.serious ? 'Shut it down' : `Sit out ${a.injury.games} ${a.injury.games === 1 ? 'game' : 'games'}`}</b><small>Heal up. The team plays on without you.</small></button>
                  {!a.injury.serious && <button className="sm-option" onClick={() => injury(true)}><b>Play through it</b><small>Two traits down for {a.injury.games + 2} games. 35% it gets worse.</small></button>}
                </div>
              </div>
            )}
            {a.moment && <MomentCard key={`${a.k}-${a.moment.id}`} moment={a.moment} onPick={pick} />}
            {!a.moment && !a.injury && !seasonOver && <button className="ag-btn ag-btn--gold tk-intro-go cr-advance" onClick={advance}>ADVANCE WEEK {a.k + 1} <IconArrow size={16} /></button>}
            {seasonOver && (
              <div className="ag-card cr-over ag-pop">
                <span className="ag-eyebrow">REGULAR SEASON OVER · {wins}–{losses}</span>
                <p className="cr-note">{wins >= 10 ? 'Playoff football. Let\'s see how far it goes.' : wins >= 8 ? 'On the bubble. The tiebreakers decide it.' : 'No postseason this year. Book it and move on.'}</p>
                <button className="ag-btn ag-btn--gold tk-intro-go" onClick={wrap}>{wins >= 8 ? 'INTO THE PLAYOFFS' : 'WRAP THE SEASON'} <IconArrow size={16} /></button>
              </div>
            )}
            <div className="cr-feed">
              {[...a.feed].reverse().map((e, i) => e.g ? (
                <div key={`g${e.k}`} className="cr-feed-game">
                  <NowCard game={e.g} pos={c.pos} sport="nfl" team={{ short: c.team }} logoFor={logoFor} idx={e.k - 1} total={total} />
                  {(e.hits?.filter(h => h.big).length > 0 || e.headline?.length > 0) && (
                    <div className="cr-feed-lines">{e.hits?.filter(h => h.big).map(h => <span key={h.id} className="cr-ms"><IconStar size={12} /> {h.label}</span>)}{e.headline?.slice(0, 1).map((t, k) => <span key={k} className="cr-hl">{t}</span>)}</div>
                  )}
                </div>
              ) : e.moment ? (
                <div key={`m${e.k}-${i}`} className="cr-feed-moment"><span className="ag-eyebrow">WEEK {e.k} · {e.moment.title}</span><b>{e.option.label}</b>{e.outcome?.line && <small>{e.outcome.line}</small>}</div>
              ) : (
                <div key={`i${e.k}-${i}`} className="cr-feed-moment is-injury"><span className="ag-eyebrow">WEEK {e.k} · INJURY</span><b>{e.injuryText}</b></div>
              ))}
            </div>
          </section>
        )}

        {tab === 'season' && c.phase === 'offseason' && last && <Offseason c={c} setCareer={setCareer} last={last} setTab={setTab} />}
        {tab === 'player' && <Player c={c} />}
        {tab === 'team' && <TeamFit c={c} />}
        {tab === 'career' && <CareerTab c={c} L={L} />}
      </div>
    </div>
  )
}

function Offseason({ c, setCareer, last, setTab }) {
  const met = last.goals.filter(g => g.met).length
  const forced = mustRetire(c)
  const noCalls = Array.isArray(c.offers) && c.offers.length === 0
  const ev = c.events.filter(e => e.year === c.year + 1)
  return (
    <section className="cr-sec">
      <div className={`ag-card cr-wrap ag-pop${last.champion ? ' is-ring' : ''}`}>
        <div className="ag-card-head"><span className="ag-eyebrow">{last.season} · {last.wins}–{last.losses}{last.playoffs ? ' · PLAYOFFS' : ''}</span>{last.champion && <span className="cr-ring"><IconRing size={13} /> CHAMPIONS</span>}</div>
        <div className="cr-wrap-stats">{HEADLINE_STATS[c.pos].map(k => <span key={k}><b>{(last.stats[k] ?? 0).toLocaleString()}</b><small>{STAT_LABEL[k]}</small></span>)}<span><b>{last.missed}</b><small>MISSED</small></span></div>
        <div className="cr-badges">
          {last.award && <span className="cr-badge is-gold"><IconTrophy size={12} /> {last.awardName}</span>}
          {last.allPro && <span className="cr-badge is-gold"><IconMedal size={12} /> ALL-PRO</span>}
          {last.proBowl && !last.allPro && <span className="cr-badge"><IconStar size={12} /> PRO BOWL</span>}
          {last.records.map((r, i) => <span key={i} className="cr-badge is-rec"><IconFlame size={12} /> {r}</span>)}
        </div>
        {last.sb && <p className="cr-note">{last.sb.won ? `Super Bowl champions: ${last.sb.mySc ?? ''}${last.sb.oppSc != null ? `–${last.sb.oppSc}` : ''}.` : 'Lost the Super Bowl. Close.'}</p>}
        {!last.sb && last.rounds?.length > 0 && <p className="cr-note">Playoffs: {last.rounds.map(r => `${r.won ? 'W' : 'L'} ${r.mySc}–${r.oppSc} ${nick(r.opponent)}`).join(' · ')}</p>}
        <div className="cr-goals"><span className="ag-eyebrow">GOALS · {met}/{last.goals.length}</span>{last.goals.map(g => <span key={g.k} className={`cr-goal${g.met ? ' is-met' : ' is-miss'}`}>{g.met ? <IconCheck size={11} /> : null} {g.label}</span>)}</div>
      </div>
      {ev.map((e, i) => <div key={i} className="ag-card cr-event ag-pop" style={{ '--d': '60ms' }}><span className="ag-eyebrow">OFFSEASON</span><p>{e.text}</p></div>)}
      {c.dev.points > 0 && <button className="ag-card cr-dev ag-pop" style={{ '--d': '90ms' }} onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }}><IconStar size={16} /><span><b>{c.dev.points} development {c.dev.points === 1 ? 'point' : 'points'}</b><small>Tap a trait on your player to raise it</small></span></button>}
      {noCalls ? (
        <div className="ag-card cr-offer-wrap ag-pop"><span className="ag-eyebrow">FREE AGENCY</span><p className="cr-note">The phone didn't ring. At {c.age}, with last season on tape, nobody's calling. That's a career.</p></div>
      ) : c.offers?.length > 0 && (
        <div className="cr-offers ag-pop" style={{ '--d': '120ms' }}>
          <span className="ag-eyebrow">CONTRACT'S UP · {c.offers.length} OFFERS</span>
          {c.offers.map(o => (
            <button key={o.team} className={`cr-offer${o.kind === 'contender' ? ' is-contender' : ''}`} onClick={() => { setCareer(signOffer(c, o)); sfx('purchase'); haptic('success') }}>
              <img src={logoFor(o.team)} alt="" />
              <span className="cr-offer-txt"><b>{o.fit.name}</b><small>{o.pitch}</small><i>{o.fit.status} · OL {o.fit.ol} · {c.pos === 'qb' ? `weapons ${o.fit.weapons}` : `QB ${o.fit.qb}`}</i></span>
              <span className="cr-offer-money"><b>{money(o.perYear)}</b><small>× {o.years} YRS</small></span>
            </button>
          ))}
        </div>
      )}
      <div className="cr-actions ag-pop" style={{ '--d': '150ms' }}>
        {!forced && !(c.offers?.length) && <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { setCareer(nextSeason(c)); setTab('season'); sfx('tap'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>ON TO {c.season + 1} <IconArrow size={16} /></button>}
        {!forced && !c.tradeAsked && c.contract.left > 0 && <button className="ag-btn ag-btn--ghost" onClick={() => { if (confirm('Demand a trade? Your reputation takes a hit, and the team can say no.')) { setCareer(demandTrade(c)); sfx('deny') } }}>DEMAND A TRADE</button>}
        {(canRetire(c) || forced) && <button className={`ag-btn${forced ? ' ag-btn--gold tk-intro-go' : ' ag-btn--ghost'}`} onClick={() => { if (forced || confirm('Retire? The career is booked and the legacy is final.')) { setCareer(retire(c)); victory({ big: true }) } }}>{forced ? 'HANG IT UP' : 'RETIRE'}</button>}
      </div>
    </section>
  )
}

function Player({ c }) {
  const t = careerTotals(c)
  return (
    <section className="cr-sec">
      <div className="ag-card cr-player ag-pop">
        <div className="cr-kv"><span><b>{c.age}</b><small>AGE</small></span><span><b>{c.durability}</b><small>DURABILITY</small></span><span><b>{c.rep}</b><small>REPUTATION</small></span><span><b>{c.dev.spent}</b><small>UPGRADES</small></span></div>
        <div className="cr-contract">
          <span className="ag-eyebrow">CONTRACT</span>
          <b>{money(c.contract.perYear)} a year · {c.contract.left} of {c.contract.years} {c.contract.years === 1 ? 'year' : 'years'} left</b>
          <small>{c.contract.kind === 'rookie' ? 'Rookie deal' : c.contract.kind === 'ext' ? 'Extension' : 'Free-agent deal'} · career earnings {money(Math.round(t.earnings))}</small>
        </div>
        {c.injuries.length > 0 && <div className="cr-goals"><span className="ag-eyebrow">INJURY HISTORY</span>{c.injuries.map((i, k) => <span key={k} className="cr-goal is-miss">{i.year}: {i.kind}, {i.games} {i.games === 1 ? 'game' : 'games'}{i.played ? ' (played through)' : ''}</span>)}</div>}
        <p className="cr-note">Traits grow until about 25, hold through the prime, then the physical ones fade past {c.pos === 'qb' ? '33' : '31'}. Every offseason brings a development point; an award or All-Pro season brings two.</p>
      </div>
    </section>
  )
}

function CareerTab({ c, L }) {
  const t = careerTotals(c)
  const keys = HEADLINE_STATS[c.pos]
  return (
    <section className="cr-sec">
      <div className="ag-card cr-totals ag-pop">
        <div className="ag-card-head"><span className="ag-eyebrow">CAREER · {t.seasons} {t.seasons === 1 ? 'SEASON' : 'SEASONS'}</span></div>
        <div className="cr-kv">{keys.map(k => <span key={k}><b>{(t.stats[k] ?? 0).toLocaleString()}</b><small>{STAT_LABEL[k]}</small></span>)}<span><b>{t.rings}</b><small>RINGS</small></span><span><b>{t.awards}</b><small>{AWARD_NAME[c.pos]}</small></span><span><b>{t.proBowls}</b><small>PRO BOWLS</small></span><span><b>{t.allPros}</b><small>ALL-PRO</small></span></div>
        <div className="cr-rank"><span className="ag-eyebrow">ALL-TIME {POS_LABEL[c.pos]}S</span>
          {L.above && <span className="cr-rank-row"><i>{L.above.rank}</i><b>{L.above.name}</b><small>{L.above.score}</small></span>}
          <span className="cr-rank-row is-you"><i>{L.rank}</i><b>{c.name}</b><small>{L.score}</small></span>
          {L.below && <span className="cr-rank-row"><i>{L.rank + 1}</i><b>{L.below.name}</b><small>{L.below.score}</small></span>}
        </div>
      </div>
      {c.seasons.length > 0 && (
        <div className="ag-card cr-table ag-pop" style={{ '--d': '60ms' }}>
          <div className="cr-row cr-row--head"><span>YR</span><span>TEAM</span><span>W–L</span>{keys.map(k => <span key={k}>{STAT_LABEL[k]}</span>)}<span /></div>
          {[...c.seasons].reverse().map(s => (
            <div key={s.year} className={`cr-row${s.champion ? ' is-ring' : ''}`}>
              <span>{s.season}</span><span><img src={logoFor(s.team)} alt="" />{s.team}</span><span>{s.wins}–{s.losses}</span>
              {keys.map(k => <span key={k}>{(s.stats[k] ?? 0).toLocaleString()}</span>)}
              <span className="cr-row-ico">{s.champion && <IconRing size={12} />}{s.award && <IconTrophy size={12} />}{s.allPro ? <IconMedal size={12} /> : s.proBowl ? <IconStar size={12} /> : null}</span>
            </div>
          ))}
        </div>
      )}
      {(c.decisions.length > 0 || c.events.length > 0) && (
        <div className="ag-card cr-log ag-pop" style={{ '--d': '90ms' }}>
          <div className="ag-card-head"><span className="ag-eyebrow">THE STORY</span></div>
          <ul className="cr-list">{[...c.decisions.map(d => ({ ...d, kind: 'd' })), ...c.events.map(e => ({ ...e, kind: 'e' }))].sort((a, b) => b.year - a.year).map((x, i) => <li key={i}>{x.kind === 'd' ? <IconShield size={12} /> : <IconHelmet size={12} />} <small>Y{x.year}</small> {x.text}</li>)}</ul>
        </div>
      )}
    </section>
  )
}

// ── Legacy: the career, booked ───────────────────────────────────────────────
function Legacy({ c, setCareer, onNewBuild, onExit }) {
  const L = legacyOf(c), t = careerTotals(c), card = careerCard(c)
  const [img, setImg] = useState(null)
  const [busy, setBusy] = useState(false)
  const share = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { generateCareerCard, captureSilhouette } = await import('../../utils/generateShareCard')
      const fig = await captureSilhouette('.cr-model .sil-wrap')
      const canvas = await generateCareerCard(card, fig)
      const url = canvas.toDataURL('image/png'); setImg(url)
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
      const file = blob && new File([blob], `career-${c.name}-${POS_LABEL[c.pos]}.png`, { type: 'image/png' })
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `${c.name}'s career` }).catch(() => {})
      else { const a = document.createElement('a'); a.href = url; a.download = file?.name ?? 'career.png'; a.click() }
      sfx('claim')
    } finally { setBusy(false) }
  }
  return (
    <div className="ag-screen ag-screen--nfl cr cr-legacy-screen">
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">{c.seasons.length} SEASONS · {POS_NAME[c.pos].toUpperCase()}</span><h1 className="ag-h1">{c.hof?.in ? 'Hall of Famer' : L.tier}</h1></div>
        <button className="ag-round-btn" onClick={onExit} aria-label="Home"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <div className={`cr-final ag-pop${c.hof?.in ? ' is-hof' : ''}`}>
          <span className="cr-final-score"><b>{L.score}</b><small>LEGACY SCORE</small></span>
          <span className="cr-final-rank">No. <b>{L.rank}</b> {POS_LABEL[c.pos]} of all time{L.above ? <small>behind {L.above.name}, ahead of {L.below?.name ?? 'everyone else'}</small> : <small>Ahead of everyone</small>}</span>
          {c.hof && <span className={`cr-hof${c.hof.in ? ' is-in' : ''}`}><IconCrown size={14} /> {c.hof.in ? `HALL OF FAME · ${c.hof.ballot.toUpperCase()}` : c.hof.ballot.toUpperCase()} · {c.hof.pct}%</span>}
        </div>
        <Model c={c} />
        <div className="ag-card cr-totals ag-pop" style={{ '--d': '60ms' }}>
          <div className="cr-kv">{HEADLINE_STATS[c.pos].map(k => <span key={k}><b>{(t.stats[k] ?? 0).toLocaleString()}</b><small>{STAT_LABEL[k]}</small></span>)}<span><b>{t.rings}</b><small>RINGS</small></span><span><b>{t.awards}</b><small>{AWARD_NAME[c.pos]}</small></span><span><b>{t.proBowls}</b><small>PRO BOWLS</small></span><span><b>{t.allPros}</b><small>ALL-PRO</small></span><span><b>{t.records}</b><small>RECORDS</small></span><span><b>{money(Math.round(t.earnings))}</b><small>EARNED</small></span></div>
          <p className="cr-note">{t.teams.length === 1 ? `One team, start to finish: the ${c.fit?.name}.` : `${t.teams.length} teams: ${t.teams.join(', ')}.`} Drafted {c.draft.pick ? `pick ${c.draft.pick.o}` : ''}, retired at {c.age}.</p>
        </div>
        {img && <img src={img} alt="Career card" className="cr-card-preview ag-pop" />}
        <div className="cr-actions ag-pop" style={{ '--d': '90ms' }}>
          <button className="ag-btn ag-btn--gold tk-intro-go" onClick={share} disabled={busy}>{busy ? 'MAKING THE CARD…' : 'SHARE THE CAREER CARD'}</button>
          <button className="ag-btn" onClick={() => { clearCareer(c.sport, c.uid); setCareer(null); onNewBuild() }}>NEW CAREER</button>
          <button className="ag-btn ag-btn--ghost" onClick={onExit}>HOME</button>
        </div>
      </div>
    </div>
  )
}
