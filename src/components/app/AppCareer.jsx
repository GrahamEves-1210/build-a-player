import { useEffect, useMemo, useRef, useState } from 'react'
import {
  POS_LABEL, POS_NAME, POS_ATTR, OFFENSE_POS, pastCareers, saveCareer, clearCareer, stockOf, answerInterview, setupInterviews, runDraft,
  startSeason, resumeSeason, advanceWeek, chooseMoment, resolveInjury, finishRegular, playoffRound, bookSeason, recordCombine, spendDev, demandTrade, nextSeason,
  OFF_STEPS, offStep, campDrill, lineup, depthChart, gradeOf, gradeOfOvr, ovrGradeVal, SPORT, sportOf,
  openTalks, ask, closeTalks, acceptTalks, ASKS, leverageOf,
  retire, canRetire, mustRetire, careerTotals, legacyOf, LEGACY_TIERS, STAT_LABEL, HEADLINE_STATS, careerCard, AWARD_NAME, MAX_SEASONS, goalsFor,
} from '../../lib/career'
import { GAME_LINE } from '../../lib/seasonDirector'
import { GAMES, pickPlayoffGame } from '../../lib/minigames'
import MiniGame from './MiniGame'
import { valToGrade, nflHeadshot } from '../../utils/simulation'
import { getUsername } from '../../lib/discord'
import { sfx, haptic, victory } from '../../lib/juice'
import { MomentCard, NowCard, RecordOverlay } from './AppSeasonPlus'
import Silhouette from '../Silhouette'
import { NameTag, AvatarBadge } from './NameTag'
import { IconClose, IconArrow, IconFlame, IconTrophy, IconStar, IconCrown, IconMedal, IconRing, IconCheck, IconShield, IconHelmet } from './icons'

// CAREER (football and basketball): the intro, the draft, the hub where a
// career is played (your model and traits, the season, the player, the team,
// the record so far) and the legacy screen. The engine is lib/career.js; what
// differs by sport comes from its SPORT table.

const gradeColor = v => (v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444')
const nick = name => (name || '').split(' ').slice(-1)[0]
const money = n => `$${n}M`
const RUN_DATE = { month: 'short', day: 'numeric' }
// a roster photo: a full URL (or, in a football career saved before, the headshot id)
const photoSrc = p => (p ? (String(p).includes('/') ? p : nflHeadshot(p)) : null)
// per-game averages keep one decimal; counts get commas
const fmt = v => (typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(1) : (v ?? 0).toLocaleString())

// ── Intro: what Career is, and the careers before this one ──────────────────
export function CareerIntro({ sport = 'nfl', onStart, onClose }) {
  const S = SPORT[sport] ?? SPORT.nfl
  const runs = useMemo(() => pastCareers(sport), [sport])
  const steps = [
    ['Build', 'Draft your player from traits, the same spins as a normal game. That build is who you take into the league.'],
    ['The draft', `Combine drills, then interviews with the teams picking near you. Your stock moves, draft day decides where you land, and the ${S.isBucket ? 'team' : 'offense'} around you matters.`],
    ['The career', `Season after season, ${S.isBucket ? 'game by game' : 'week by week'}: decisions, injuries, a ${S.isBucket ? 'rotation' : 'depth chart'} to win. Every offseason the roster turns over and the league moves.`],
    ['Legacy', 'Contracts, free agency, trade demands, retirement. Awards, records, the Hall of Fame, and where you rank among the all-time greats.'],
  ]
  return (
    <div className={`ag-screen ${S.screen} cr cr-intro`}>
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">MULTI-SEASON</span><h1 className="ag-h1">Career</h1></div>
        <button className="ag-round-btn" onClick={onClose} aria-label="Home"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <div className="cr-intro-hero ag-pop">
          <span className="cr-intro-kicker">ONE PLAYER. A WHOLE CAREER.</span>
          <p>Up to {MAX_SEASONS} seasons, about an hour of play, saved every step so you can leave and come back. {S.isBucket ? 'Guard or big.' : 'Offense: QB, RB, WR, TE.'}</p>
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
                  <b>{r.hof ? <><IconCrown size={13} /> Hall of Famer</> : r.tier}{(r.ranked ?? r.rank <= 15) ? ` · No. ${r.rank} all-time` : ''}</b>
                  <small>{new Date(r.at).toLocaleDateString(undefined, RUN_DATE)} · {r.seasons} seasons · {r.rings} {r.rings === 1 ? 'ring' : 'rings'} · {r.awards} {r.awards === 1 ? 'award' : 'awards'}</small>
                </span>
                <span className="tk-run-ovr"><b>{r.score}</b><small>LEGACY PTS</small></span>
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
        <span className="cr-trait-txt"><b>{(attr[t]?.label ?? t).replace('/', '/\u200b')}</b><small>{nick(ch?.qbFull) || '—'}{ch?.upgraded ? ` +${ch.upgraded}` : ''}{ch?.faded ? ` −${ch.faded}` : ''}</small></span>
        <span className="cr-trait-g" style={{ background: gradeColor(ch?.val ?? 0) }}>{canUp ? '+1' : valToGrade(ch?.val ?? 0)}</span>
      </div>
    )
  }
  return (
    <div className="cr-model-wrap ag-pop">
      <div className="cr-traits cr-traits--l">{c.types.slice(0, half).map(t => <Card key={t} t={t} />)}</div>
      <div className="cr-model">
        <Silhouette build={shown} types={c.types} attrMap={attr} isBucket={c.sport === 'bucket'} isRB={c.pos === 'rb'} isWR={c.pos === 'wr'} isTE={c.pos === 'te'} modelOnly />
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
      <div className="cr-legacy-top"><span className="ag-eyebrow">LEGACY TIER · {L.tier.toUpperCase()}</span><b>{L.score}<small> LEGACY PTS</small></b></div>
      <div className="cr-legacy-bar"><span style={{ width: `${Math.max(3, pct)}%` }} /></div>
      <div className="cr-legacy-foot"><span>{L.next ? `${L.next.at - L.score} more points to reach the ${L.next.name} tier` : 'The top tier'}</span><span>{L.ranked ? `No. ${L.rank} ${POS_LABEL[c.pos]} all-time` : `Outside the all-time top ${L.of}`}</span></div>
      <p className="cr-legacy-how">Points come from seasons played, {sportOf(c).honor}s, {sportOf(c).first} teams, {AWARD_NAME[c.pos]}s, rings, playoff runs and records.</p>
    </div>
  )
}

// ── Draft ───────────────────────────────────────────────────────────────────
function Draft({ c, setCareer }) {
  const S = sportOf(c), logoFor = S.logo, teamName = short => S.teamOf(short).name
  const [step, setStep] = useState(c.step === 'trivia' ? 'interview' : c.step ?? 'combine')   // eslint-disable-line
  const [shown, setShown] = useState(0)
  const stock = stockOf(c)
  const range = `${stock.loP.round === stock.hiP.round ? `ROUND ${stock.loP.round}` : `ROUNDS ${stock.loP.round}–${stock.hiP.round}`} · PICKS ${stock.lo}–${stock.hi}`
  const go = s => { setStep(s); setCareer({ ...c, step: s }); sfx('tap') }
  const head = (kicker, title) => (
    <div className="ag-screen-head"><div><span className="ag-eyebrow">{kicker}</span><h1 className="ag-h1">{title}</h1></div><span className="cr-stock"><small>PROJECTED</small><b>{range}</b></span></div>
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
  if (step === 'combine') {
    const next = c.draft.combine.find(d => d.score == null)
    const allDone = !next
    return (
      <div className={`ag-screen ${S.screen} cr`}>
        {head(`THE COMBINE · ${POS_LABEL[c.pos]}`, allDone ? 'Your numbers' : next.label)}
        <div className="ag-screen-body">
          {!allDone && <MiniGame key={next.id} game={next.id} build={c.build} seed={`${c.seed}-cb-${next.id}`} onDone={res => setCareer(recordCombine(c, next.id, res.score))} />}
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
              <p className="cr-note ag-pop">Scouts saw the whole workout. Next: the teams picking around {c.name}'s projected slot want a sit-down.</p>
              <button className="ag-btn tk-intro-go" onClick={() => { setCareer(setupInterviews({ ...c, step: 'interview' })); setStep('interview'); sfx('tap') }}>THE INTERVIEWS <IconArrow size={16} /></button>
            </>
          ) : <p className="cr-note">Three drills, one go each. The trait sets the range; how the drill goes sets the number.</p>}
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
        {head('THE INTERVIEWS', done ? 'Interviews done' : `Interview ${i + 1} of ${list.length}`)}
        <div className="ag-screen-body">
          {!done ? (
            <div className="cr-q ag-pop" key={i}>
              <div className="cr-q-team"><img src={logoFor(it.team)} alt="" /><span><b>{teamName(it.team)}</b><small>{it.who.toUpperCase()}</small></span></div>
              <p className="cr-q-text">"{it.q}"</p>
              <div className="cr-q-opts">{it.a.map((a, k) => <button key={k} className="cr-q-opt" onClick={() => { setCareer(answerInterview(c, i, k)); sfx('tap') }}>{a.t}</button>)}</div>
            </div>
          ) : (
            <div className="cr-q ag-pop">
              <div className="cr-q-teams">{list.map(x => <img key={x.team} src={logoFor(x.team)} alt={teamName(x.team)} title={teamName(x.team)} />)}</div>
              <p className="cr-q-text">{list.map(x => nick(teamName(x.team))).join(', ')}: every room has its notes. The stock is set: <b>{range.toLowerCase()}</b>.</p>
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
    <div className={`ag-screen ${S.screen} cr cr--team`} style={landed ? teamVars(c.fit) : undefined}>
      <div className="ag-screen-head"><div><span className="ag-eyebrow">DRAFT DAY</span><h1 className="ag-h1">{landed ? 'Drafted' : 'On the clock'}</h1></div></div>
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
                <small>Rookie deal: {c.contract.years} yrs · {money(c.contract.perYear)} a year{c.contract.option ? (S.isBucket ? ' · team options' : ' · 5th-year option') : ''}</small>
              </div>
            </div>
            <Lineup c={c} />
            <TeamFit c={c} />
            <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { setCareer({ ...c, phase: 'preseason', step: null }); sfx('purchase'); haptic('success') }}>SIGN THE ROOKIE DEAL <IconArrow size={16} /></button>
          </>
        )}
      </div>
    </div>
  )
}

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
  const G = ({ k, v, sub }) => <span className="cr-fit-g"><b style={{ color: gradeColor(v) }}>{gradeOf(v)}</b><small>{k}</small>{sub && <i>{sub}</i>}</span>
  return (
    <div className="cr-fit ag-pop" style={{ '--d': '80ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE {S.isBucket ? 'TEAM' : 'OFFENSE'} AROUND {c.name.toUpperCase()}</span><span className="cr-fit-status">{f.status}</span></div>
      <div className="cr-fit-grid">
        {groups.map(g => <G key={g.k} k={g.k} v={g.v} sub={g.names?.length === 1 ? nick(g.names[0]) : null} />)}
        <G k="OFFENSE" v={teamGrade(f.off)} /><G k="DEFENSE" v={teamGrade(f.def)} />
      </div>
      <p className="cr-fit-note">{S.fitNote(f.groups ? f : { ...f, ol: f.ol, weapons: f.weapons, qb: f.qb }, c.pos)}
        {f.status === 'Rebuilding' ? ' Rebuilding team: more early touches, fewer wins.' : f.status === 'Contender' ? ' Contender: a shot at rings, and less patience.' : ''}</p>
      <div className="cr-fit-meta"><span>{f.conf}{f.div && f.div !== f.conf ? ` · ${f.div}` : ''}</span></div>
    </div>
  )
}
// The starting offense on a field: you in your spot if you've won it
function Lineup({ c }) {
  const S = sportOf(c)
  const L = useMemo(() => lineup(c), [c.roster, c.ovr, c.name, c.lastRole, c.contract, c.pos]) // eslint-disable-line
  const dc = L.depth
  const Man = ({ p, slot }) => !p ? <span className="crl-man is-empty" /> : (
    <span className={`crl-man${p.you ? ' is-you' : ''}`}>
      <span className="crl-face">
        {p.you ? <AvatarBadge self name={c.name} size={46} /> : p.photo ? <img src={photoSrc(p.photo)} alt="" loading="lazy" /> : <span className="crl-init">{initials(p.name)}</span>}
        <i style={{ background: gradeColor(ovrGradeVal(p.ovr)) }}>{gradeOfOvr(p.ovr)}</i>
      </span>
      <b>{p.you ? c.name : shortName(p.name)}</b>
      <small>{slot}{p.rookie ? ' · ROOKIE' : ''}</small>
    </span>
  )
  const last = dc.ahead[dc.ahead.length - 1]
  return (
    <div className="ag-card crl ag-pop">
      <div className="ag-card-head"><span className="ag-eyebrow">{c.fit?.name?.toUpperCase()} · {S.isBucket ? 'STARTING FIVE' : 'STARTING OFFENSE'}</span><span className={`crl-role${dc.starter ? ' is-on' : ''}`}>{dc.starter ? 'STARTER' : 'BACKUP'} · {dc.label}</span></div>
      {S.isBucket ? (
        <div className="crl-field crl-field--court">
          <div className="crl-row">{L.guard.map(p => <Man key={p.name} p={p} slot={p.slot ?? 'G'} />)}</div>
          <div className="crl-row">{L.big.map(p => <Man key={p.name} p={p} slot={p.slot ?? 'F/C'} />)}</div>
        </div>
      ) : (
        <div className="crl-field">
          <div className="crl-row"><Man p={L.wr[0]} slot="WR" /><Man p={L.wr[1]} slot="WR" /><Man p={L.te[0]} slot="TE" /><Man p={L.wr[2]} slot="WR" /></div>
          <div className="crl-row crl-row--ol">{L.ol.map((p, i) => <Man key={p.name} p={p} slot={p.slot ?? ['LT', 'LG', 'C', 'RG', 'RT'][i]} />)}</div>
          <div className="crl-row"><Man p={L.qb[0]} slot="QB" /></div>
          <div className="crl-row"><Man p={L.rb[0]} slot="RB" /></div>
        </div>
      )}
      <div className="crl-bench">
        <span className="ag-eyebrow">DEPTH CHART · {POS_NAME[c.pos].toUpperCase()}</span>
        {dc.all.map((p, i) => (
          <span key={p.name + i} className={`crl-depth${p.you ? ' is-you' : ''}`}><i>{S.isBucket ? i + 1 : `${POS_LABEL[c.pos]}${i + 1}`}</i><b>{p.name}</b><small>{gradeOfOvr(p.ovr)} · age {p.age}</small></span>
        ))}
      </div>
      {!dc.starter && last && <p className="cr-note">Behind {last.name} for now. Outplay him and the job comes to {c.name}: the {S.isBucket ? 'minutes open' : 'starter\'s spot opens'} with injuries, slumps and trades.</p>}
    </div>
  )
}

// ── Hub ─────────────────────────────────────────────────────────────────────
export default function AppCareer({ career: c, setCareer, user, onNewBuild, onExit }) {
  const [tab, setTab] = useState('season')
  const [recHit, setRecHit] = useState(null)       // an all-time record just fell
  const D = useRef(null)
  // the player is the username (Guest when signed out), never "You"
  const who = getUsername(user) || 'Guest'
  useEffect(() => { if (c && c.name !== who) setCareer({ ...c, name: who }) }, [who, c?.name]) // eslint-disable-line
  useEffect(() => { if (c) saveCareer(c) }, [c])
  useEffect(() => { if (c?.phase === 'season' && c.active && !D.current) D.current = resumeSeason(c) }, [c?.phase]) // eslint-disable-line
  if (!c) return null
  const S = sportOf(c), logoFor = S.logo
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
    if (ev?.hits?.some(h => h.record)) setRecHit(D.current.records[D.current.records.length - 1])
    if (ev?.moment) haptic('medium')
  }
  const pick = o => { const [n, out] = chooseMoment(c, D.current, o); setCareer(n); return out }
  const injury = play => { const [n, text] = resolveInjury(c, D.current, play); setCareer(n); sfx('tap') }
  // the regular season's over: straight to the offseason, or into the bracket
  const wrap = () => {
    if (!D.current) D.current = resumeSeason(c)
    const n = finishRegular(c, D.current); D.current = null
    if (n.phase === 'offseason') { afterBook(n) } else { setCareer(n); sfx('whistle') }
  }
  const book = () => afterBook(bookSeason(c))
  const afterBook = n => {
    const s = n.seasons[n.seasons.length - 1]
    window.dispatchEvent(new CustomEvent('bap:season', { detail: { sport: c.sport, pos: c.pos, mode: 'career', localOnly: true, wins: s.wins, losses: s.losses, playoffs: s.playoffs, champion: s.champion, award: s.award, awardName: s.awardName, ovr: c.ovr, ref: c.active?.final ?? null } }))
    setCareer(n); setTab('season')
    if (s.champion || s.award) victory({ big: s.champion }); else sfx('complete')
  }
  const a = c.active
  const total = a?.base?.games?.length ?? 17
  // the record from the feed: single games (football) and runs of games (basketball)
  const played = a ? a.feed.flatMap(e => (e.g ? [e.g] : e.chunk ? e.games : [])) : []
  const wins = played.filter(g => g.won).length, losses = played.length - wins
  const seasonOver = a && a.k >= total && !a.moment && !a.injury && !a.po
  const last = c.seasons[c.seasons.length - 1]

  return (
    <div className={`ag-screen ${S.screen} cr cr-hub cr--team`} style={teamVars(c.fit)}>
      {recHit && <RecordOverlay record={recHit} name={c.name || 'Guest'} onClose={() => setRecHit(null)} />}
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
            {c.aging?.length > 0 && <ul className="cr-bul">{c.aging.map((t, i) => <li key={i}><IconFlame size={13} /> {t}</li>)}</ul>}
            <div className="cr-goals"><span className="ag-eyebrow">THIS YEAR'S GOALS</span>{goalsFor(c).map(g => <span key={g.k} className="cr-goal">{g.label}</span>)}</div>
            {(() => { const dc = depthChart(c); return <p className={`cr-depthline${dc.starter ? ' is-on' : ''}`}>{dc.starter ? `${dc.label} · the starter` : `${dc.label} · backup behind ${dc.ahead[dc.ahead.length - 1].name}`}</p> })()}
            <p className="cr-note">{c.contract.left} {c.contract.left === 1 ? 'year' : 'years'} left on the deal ({money(c.contract.perYear)} a year). {c.contract.left === 1 ? 'Contract year: play for the next one.' : ''}</p>
            <button className="ag-btn ag-btn--gold tk-intro-go" onClick={begin}>START THE SEASON <IconArrow size={16} /></button>
          </section>
        )}

        {tab === 'season' && c.phase === 'season' && a && (
          <section className="cr-sec">
            <div className="cr-season-bar ag-pop">
              <span className="cr-rec"><b>{wins}–{losses}</b><small>{S.gameWord} {Math.min(a.k + 1, total)} OF {total}</small></span>
              <div className="cr-goals cr-goals--inline">{c.goals.map(g => <span key={g.k} className="cr-goal">{g.label}</span>)}</div>
            </div>
            {a.injury && (
              <div className="sm-moment cr-injury ag-pop">
                <span className="ag-eyebrow">INJURY · {S.gameWord} {a.k}</span>
                <h3 className="sm-moment-title">{a.injury.kind}</h3>
                <p className="sm-moment-body">{a.injury.serious ? 'The trainers don\'t need a second look. Your season is over.' : `The doctors say ${a.injury.games} ${a.injury.games === 1 ? 'game' : 'games'}. You could play through it: not at your best for longer, and it can get worse.`}</p>
                <div className="sm-options">
                  <button className="sm-option" onClick={() => injury(false)}><b>{a.injury.serious ? 'Shut it down' : `Sit out ${a.injury.games} ${a.injury.games === 1 ? 'game' : 'games'}`}</b><small>Heal up. The team plays on without you.</small></button>
                  {!a.injury.serious && <button className="sm-option" onClick={() => injury(true)}><b>Play through it</b><small>Two traits down for {a.injury.games + 2} games. 35% it gets worse.</small></button>}
                </div>
              </div>
            )}
            {a.moment && <MomentCard key={`${a.k}-${a.moment.id}`} moment={a.moment} onPick={pick} />}
            {!a.moment && !a.injury && !seasonOver && !a.po && <button className="ag-btn ag-btn--gold tk-intro-go cr-advance" onClick={advance}>{S.step > 1 ? `PLAY GAMES ${a.k + 1}–${Math.min(total, a.k + S.step)}` : `ADVANCE WEEK ${a.k + 1}`} <IconArrow size={16} /></button>}
            {a.po && <Playoffs c={c} setCareer={setCareer} onBook={book} />}
            {seasonOver && (
              <div className="ag-card cr-over ag-pop">
                <span className="ag-eyebrow">REGULAR SEASON OVER · {wins}–{losses}</span>
                {(() => { const pct = wins / Math.max(1, wins + losses); const sport = S.isBucket ? 'basketball' : 'football'; return <>
                  <p className="cr-note">{pct >= 0.58 ? `Playoff ${sport}. Let's see how far it goes.` : pct >= 0.45 ? (S.isBucket ? 'On the bubble. The play-in might decide it.' : 'On the bubble. The tiebreakers decide it.') : 'No postseason this year. Book it and move on.'}</p>
                  <button className="ag-btn ag-btn--gold tk-intro-go" onClick={wrap}>{pct >= 0.45 ? 'INTO THE PLAYOFFS' : 'WRAP THE SEASON'} <IconArrow size={16} /></button>
                </> })()}
              </div>
            )}
            <div className="cr-feed">
              {[...a.feed].reverse().map((e, i) => e.chunk ? (
                <Chunk key={`c${e.k}`} c={c} e={e} />
              ) : e.g ? (
                <div key={`g${e.k}`} className="cr-feed-game">
                  <NowCard game={e.g} pos={c.pos} sport={c.sport} team={{ short: c.team }} logoFor={logoFor} idx={e.k - 1} total={total} />
                  {(e.hits?.filter(h => h.big).length > 0 || e.headline?.length > 0) && (
                    <div className="cr-feed-lines">{e.hits?.filter(h => h.big).map(h => <span key={h.id} className="cr-ms"><IconStar size={12} /> {h.label}</span>)}{e.headline?.slice(0, 1).map((t, k) => <span key={k} className="cr-hl">{t}</span>)}</div>
                  )}
                </div>
              ) : e.note ? (
                <div key={`n${e.k}-${i}`} className="cr-feed-moment is-note"><span className="ag-eyebrow">{e.k ? `${S.gameWord} ${e.k} · ` : ''}{e.noteKind}</span><b>{e.note}</b></div>
              ) : e.moment ? (
                <div key={`m${e.k}-${i}`} className="cr-feed-moment"><span className="ag-eyebrow">{S.gameWord} {e.k} · {e.moment.title}</span><b>{e.option.label}</b>{e.outcome?.line && <small>{e.outcome.line}</small>}</div>
              ) : (
                <div key={`i${e.k}-${i}`} className="cr-feed-moment is-injury"><span className="ag-eyebrow">{S.gameWord} {e.k} · INJURY</span><b>{e.injuryText}</b></div>
              ))}
            </div>
          </section>
        )}

        {tab === 'season' && c.phase === 'offseason' && last && <Offseason c={c} setCareer={setCareer} last={last} setTab={setTab} />}
        {tab === 'player' && <Player c={c} />}
        {tab === 'team' && <><Lineup c={c} /><TeamFit c={c} /></>}
        {tab === 'career' && <CareerTab c={c} L={L} />}
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

// ── The offseason, step by step: recap → roster moves → camp → contract ─────
const MOVE_TAG = { sign: 'SIGNED', draft: 'DRAFTED', retire: 'RETIRED', leave: 'GONE', rival: 'RIVAL' }
function Offseason({ c, setCareer, last, setTab }) {
  const step = c.off?.step ?? 'recap'
  const forced = mustRetire(c)
  const steps = OFF_STEPS.filter(([id]) => id !== 'contract' || c.off?.contract || Array.isArray(c.offers))
  const idx = Math.max(0, steps.findIndex(([id]) => id === step))
  const isLast = idx === steps.length - 1
  const go = id => { setCareer(offStep(c, id)); sfx('tap'); document.querySelector('.cr-hub')?.scrollTo({ top: 0, behavior: 'smooth' }) }
  const nextStep = steps[idx + 1]
  return (
    <section className="cr-sec">
      <div className="cr-steps ag-pop" role="tablist" aria-label="Offseason">
        {steps.map(([id, label], i) => <button key={id} role="tab" aria-selected={i === idx} className={`cr-step${i === idx ? ' is-on' : i < idx ? ' is-done' : ''}`} disabled={i > idx} onClick={() => go(id)}>{i < idx ? <IconCheck size={11} /> : <span>{i + 1}</span>} {label}</button>)}
      </div>
      {steps[idx][0] === 'recap' && <Recap c={c} last={last} />}
      {steps[idx][0] === 'moves' && <Moves c={c} />}
      {steps[idx][0] === 'camp' && <Camp c={c} setCareer={setCareer} />}
      {steps[idx][0] === 'contract' && <Contract c={c} setCareer={setCareer} />}
      {!isLast && <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => go(nextStep[0])}>NEXT: {nextStep[1]} <IconArrow size={16} /></button>}
      {isLast && (
        <div className="cr-actions ag-pop" style={{ '--d': '150ms' }}>
          {!forced && !(c.offers?.length) && <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { setCareer(nextSeason(c)); setTab('season'); sfx('tap'); document.querySelector('.cr-hub')?.scrollTo({ top: 0, behavior: 'smooth' }) }}>ON TO {c.season + 1} <IconArrow size={16} /></button>}
          {!forced && !c.tradeAsked && c.contract.left > 0 && <button className="ag-btn ag-btn--ghost" onClick={() => { if (confirm('Demand a trade? Reputation takes a hit, and the team can say no.')) { setCareer(demandTrade(c)); sfx('deny') } }}>DEMAND A TRADE</button>}
          {(canRetire(c) || forced) && <button className={`ag-btn${forced ? ' ag-btn--gold tk-intro-go' : ' ag-btn--ghost'}`} onClick={() => { if (forced || confirm('Retire? The career is booked and the legacy is final.')) { setCareer(retire(c)); victory({ big: true }) } }}>{forced ? 'HANG IT UP' : 'RETIRE'}</button>}
        </div>
      )}
    </section>
  )
}
function Recap({ c, last }) {
  const S = sportOf(c)
  const met = last.goals.filter(g => g.met).length
  return (
    <div className={`ag-card cr-wrap ag-pop${last.champion ? ' is-ring' : ''}`}>
      <div className="ag-card-head"><span className="ag-eyebrow">{last.season} · {last.wins}–{last.losses}{last.playoffs ? ' · PLAYOFFS' : ''}</span>{last.champion && <span className="cr-ring"><IconRing size={13} /> CHAMPIONS</span>}</div>
      <div className="cr-wrap-stats">{HEADLINE_STATS[c.pos].map(k => <span key={k}><b>{fmt(last.stats[k])}</b><small>{STAT_LABEL[k]}</small></span>)}<span><b>{last.missed}</b><small>SAT OUT</small></span></div>
      <div className="cr-badges">
        {last.award && <span className="cr-badge is-gold"><IconTrophy size={12} /> {last.awardName}</span>}
        {last.allPro && <span className="cr-badge is-gold"><IconMedal size={12} /> {S.first.toUpperCase()}</span>}
        {last.proBowl && !last.allPro && <span className="cr-badge"><IconStar size={12} /> {S.honor.toUpperCase()}</span>}
        {last.benched > 0 && <span className="cr-badge">{c.sport === 'bucket' ? 'OFF THE BENCH' : last.benched >= last.wins + last.losses ? 'BACKUP ALL YEAR' : `${last.benched} GAMES AS THE BACKUP`}</span>}
        {last.records.map((r, i) => <span key={i} className="cr-badge is-rec"><IconFlame size={12} /> {r}</span>)}
      </div>
      {last.sb && <p className="cr-note">{last.sb.won ? `${S.final} champions${last.sb.series ? `, ${last.sb.mySc}–${last.sb.oppSc} in the series` : `: ${last.sb.mySc ?? ''}${last.sb.oppSc != null ? `–${last.sb.oppSc}` : ''}`}.` : `Lost the ${S.final}${last.sb.series ? ` ${last.sb.mySc}–${last.sb.oppSc}` : ''}. Close.`}</p>}
      {!last.sb && last.rounds?.length > 0 && <p className="cr-note">Playoffs: {last.rounds.map(r => `${r.won ? 'W' : 'L'} ${r.mySc}–${r.oppSc} ${nick(r.opponent)}`).join(' · ')}</p>}
      <div className="cr-goals"><span className="ag-eyebrow">GOALS · {met}/{last.goals.length}</span>{last.goals.map(g => <span key={g.k} className={`cr-goal${g.met ? ' is-met' : ' is-miss'}`}>{g.met ? <IconCheck size={11} /> : null} {g.label}</span>)}</div>
    </div>
  )
}
function Moves({ c }) {
  const ev = c.events.filter(e => e.year === c.year + 1)
  const moves = c.off?.moves ?? []
  const dc = depthChart(c)
  return (
    <>
      {ev.map((e, i) => <div key={i} className="ag-card cr-event ag-pop"><span className="ag-eyebrow">{c.fit?.name?.toUpperCase()}</span><p>{e.text}</p></div>)}
      {moves.length > 0 && (
        <div className="ag-card cr-moves ag-pop" style={{ '--d': '40ms' }}>
          <span className="ag-eyebrow">ROSTER MOVES</span>
          {moves.map((m, i) => (
            <div key={i} className={`cr-move is-${m.kind}`}>
              <span className="crl-face crl-face--sm">{m.p?.photo ? <img src={photoSrc(m.p.photo)} alt="" loading="lazy" /> : <span className="crl-init">{initials(m.p?.name)}</span>}</span>
              <span className="cr-move-txt"><b>{m.text}</b><small>{m.pos.toUpperCase()} · {gradeOfOvr(m.p?.ovr ?? 70)} · age {m.p?.age}</small></span>
              <span className="cr-move-tag">{MOVE_TAG[m.kind]}</span>
            </div>
          ))}
        </div>
      )}
      <div className={`ag-card cr-depthnote ag-pop${dc.starter ? ' is-on' : ''}`} style={{ '--d': '70ms' }}>
        <span className="ag-eyebrow">DEPTH CHART · {POS_LABEL[c.pos]}</span>
        <p>{dc.starter ? `${c.name} goes into camp as a starter.` : `${c.name} goes into camp ${c.sport === 'bucket' ? 'coming off the bench' : `as ${dc.label}`}, behind ${dc.ahead[dc.ahead.length - 1].name}.`}</p>
      </div>
      {c.off?.news?.length > 0 && <div className="ag-card cr-news ag-pop" style={{ '--d': '90ms' }}><span className="ag-eyebrow">AROUND THE LEAGUE</span><ul className="cr-bul">{c.off.news.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
      <Lineup c={c} />
    </>
  )
}
function Camp({ c, setCareer }) {
  const game = useMemo(() => pickPlayoffGame(c.pos, `${c.seed}-camp-${c.year}`), [c.seed, c.year, c.pos])
  const done = c.off?.camp
  return (
    <div className="ag-card cr-camp ag-pop">
      <span className="ag-eyebrow">TRAINING CAMP · {GAMES[game]?.title}</span>
      {done
        ? <p className="cr-note">{done.bonus ? 'Won the drill in front of the coaches: +1 development point.' : 'Lost the drill. No bonus point this year.'}</p>
        : <>
            <p className="cr-note">One drill in front of the coaching staff. Win it for a bonus development point.</p>
            <MiniGame key={game} game={game} build={c.build} seed={`${c.seed}-camp-${c.year}`} onDone={res => setCareer(campDrill(c, res.score, game))} />
          </>}
      {c.dev.points > 0 && <div className="cr-devnote"><IconStar size={14} /> <b>{c.dev.points}</b> development {c.dev.points === 1 ? 'point' : 'points'}: tap a trait on the player above to raise it.</div>}
    </div>
  )
}
function Contract({ c, setCareer }) {
  const logoFor = sportOf(c).logo
  const noCalls = Array.isArray(c.offers) && c.offers.length === 0
  if (c.talks) return <Talks c={c} setCareer={setCareer} />
  if (noCalls) return <div className="ag-card cr-offer-wrap ag-pop"><span className="ag-eyebrow">FREE AGENCY</span><p className="cr-note">The phone didn't ring. At {c.age}, with last season on tape, nobody's calling. That's a career.</p></div>
  if (!c.offers?.length) return <div className="ag-card cr-offer-wrap ag-pop"><span className="ag-eyebrow">SIGNED</span><p className="cr-note">{c.decisions[c.decisions.length - 1]?.text}</p></div>
  return (
    <div className="cr-offers ag-pop">
      <span className="ag-eyebrow">CONTRACT'S UP · {c.offers.length} {c.offers.length === 1 ? 'OFFER' : 'OFFERS'} · TAP ONE TO TALK</span>
      {c.offers.map(o => (
        <button key={o.team} className={`cr-offer${o.kind === 'contender' ? ' is-contender' : ''}`} onClick={() => { setCareer(openTalks(c, o)); sfx('tap') }}>
          <img src={logoFor(o.team)} alt="" />
          <span className="cr-offer-txt"><b>{o.fit.name}</b><small>{o.pitch}</small><i>{o.stand ? (o.stand.starter ? 'Would start' : `Backup behind ${o.stand.behind}`) : o.fit.status} · {(o.fit.groups ?? [{ k: 'O-LINE', v: o.fit.ol }, { k: c.pos === 'qb' ? 'WEAPONS' : 'QB', v: c.pos === 'qb' ? o.fit.weapons : o.fit.qb }]).slice(0, 2).map(g => `${g.k.toLowerCase()} ${gradeOf(g.v)}`).join(' · ')}</i></span>
          <span className="cr-offer-money"><b>{money(o.perYear)}</b><small>× {o.years} YRS</small></span>
        </button>
      ))}
    </div>
  )
}

function Player({ c }) {
  const t = careerTotals(c)
  return (
    <section className="cr-sec">
      <div className="ag-card cr-player ag-pop">
        <div className="cr-kv"><span><b>{c.age}</b><small>AGE</small></span><span><b>{gradeOf(c.durability * 1.1)}</b><small>DURABILITY</small></span><span><b>{gradeOf(c.rep * 1.1)}</b><small>REPUTATION</small></span><span><b>{c.dev.spent}</b><small>UPGRADES</small></span></div>
        <div className="cr-contract">
          <span className="ag-eyebrow">CONTRACT</span>
          <b>{money(c.contract.perYear)} a year · {c.contract.left} of {c.contract.years} {c.contract.years === 1 ? 'year' : 'years'} left</b>
          <small>{c.contract.kind === 'rookie' ? 'Rookie deal' : c.contract.kind === 'ext' ? 'Extension' : 'Free-agent deal'} · career earnings {money(Math.round(t.earnings))}</small>
        </div>
        {c.injuries.length > 0 && <div className="cr-goals"><span className="ag-eyebrow">INJURY HISTORY</span>{c.injuries.map((i, k) => <span key={k} className="cr-goal is-miss">{i.year}: {i.kind}, {i.games} {i.games === 1 ? 'game' : 'games'}{i.played ? ' (played through)' : ''}</span>)}</div>}
        <p className="cr-note">{sportOf(c).primeNote(c.pos)} Every offseason brings a development point; an award or {sportOf(c).first} season brings two.</p>
      </div>
    </section>
  )
}

function CareerTab({ c, L }) {
  const S = sportOf(c), logoFor = S.logo
  const t = careerTotals(c)
  const keys = HEADLINE_STATS[c.pos]
  return (
    <section className="cr-sec">
      <div className="ag-card cr-totals ag-pop">
        <div className="ag-card-head"><span className="ag-eyebrow">CAREER · {t.seasons} {t.seasons === 1 ? 'SEASON' : 'SEASONS'}</span></div>
        <div className="cr-kv">{keys.map(k => <span key={k}><b>{fmt(t.stats[k])}</b><small>{STAT_LABEL[k]}</small></span>)}<span><b>{t.rings}</b><small>RINGS</small></span><span><b>{t.awards}</b><small>{AWARD_NAME[c.pos]}</small></span><span><b>{t.proBowls}</b><small>{S.honors}</small></span><span><b>{t.allPros}</b><small>{S.first.toUpperCase()}</small></span></div>
        <div className="cr-rank">
          <div className="cr-rank-head"><span className="ag-eyebrow">ALL-TIME {S.isBucket ? POS_NAME[c.pos].toUpperCase() : POS_LABEL[c.pos]}S · TOP {L.of}</span><small>LEGACY PTS</small></div>
          {L.above && <span className="cr-rank-row"><i>{L.above.rank}</i><b>{L.above.name}</b><em>{L.above.score}</em></span>}
          <span className="cr-rank-row is-you"><i>{L.ranked ? L.rank : '—'}</i><b>{c.name}</b><em>{L.score}</em></span>
          {L.below && <span className="cr-rank-row"><i>{L.rank + 1}</i><b>{L.below.name}</b><em>{L.below.score}</em></span>}
          {!L.ranked && <small className="cr-rank-note">{L.above.score - L.score + 1} more legacy points to crack the top {L.of}.</small>}
        </div>
      </div>
      {c.seasons.length > 0 && (
        <div className="ag-card cr-table ag-pop" style={{ '--d': '60ms' }}>
          <div className="cr-yr cr-yr--head"><span>YR</span><span>TEAM</span><span>W–L</span>{keys.map(k => <span key={k}>{STAT_LABEL[k]}</span>)}<span /></div>
          {[...c.seasons].reverse().map(s => (
            <div key={s.year} className={`cr-yr${s.champion ? ' is-ring' : ''}`}>
              <span>{s.season}</span><span><img src={logoFor(s.team)} alt="" />{s.team}</span><span>{s.wins}–{s.losses}</span>
              {keys.map(k => <span key={k}>{fmt(s.stats[k])}</span>)}
              <span className="cr-yr-ico">{s.champion && <IconRing size={12} />}{s.award && <IconTrophy size={12} />}{s.allPro ? <IconMedal size={12} /> : s.proBowl ? <IconStar size={12} /> : null}</span>
            </div>
          ))}
        </div>
      )}
      {(c.decisions.length > 0 || c.events.length > 0) && (
        <div className="ag-card cr-log ag-pop" style={{ '--d': '90ms' }}>
          <div className="ag-card-head"><span className="ag-eyebrow">THE STORY</span></div>
          <ul className="cr-bul">{[...c.decisions.map(d => ({ ...d, kind: 'd' })), ...c.events.map(e => ({ ...e, kind: 'e' }))].sort((a, b) => b.year - a.year).map((x, i) => <li key={i}>{x.kind === 'd' ? <IconShield size={12} /> : <IconHelmet size={12} />} <small>Y{x.year}</small> {x.text}</li>)}</ul>
        </div>
      )}
    </section>
  )
}

// ── Legacy: the career, booked ───────────────────────────────────────────────
function Legacy({ c, setCareer, onNewBuild, onExit }) {
  const S = sportOf(c)
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
    <div className={`ag-screen ${S.screen} cr cr-legacy-screen cr--team`} style={teamVars(c.fit)}>
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">{c.seasons.length} SEASONS · {POS_NAME[c.pos].toUpperCase()}</span><h1 className="ag-h1">{c.hof?.in ? 'Hall of Famer' : L.tier}</h1></div>
        <button className="ag-round-btn" onClick={onExit} aria-label="Home"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <div className={`cr-final ag-pop${c.hof?.in ? ' is-hof' : ''}`}>
          <span className="cr-final-score"><b>{L.score}</b><small>LEGACY POINTS</small></span>
          <span className="cr-final-rank">{L.ranked ? <>No. <b>{L.rank}</b> {S.isBucket ? POS_NAME[c.pos].toLowerCase() : POS_LABEL[c.pos]} of all time{L.above ? <small>behind {L.above.name}, ahead of {L.below?.name ?? 'everyone else'}</small> : <small>Ahead of everyone</small>}</> : <>Outside the all-time top {L.of}<small>{L.above.score - L.score + 1} legacy points short of {L.above.name}</small></>}</span>
          {c.hof && <span className={`cr-hof${c.hof.in ? ' is-in' : ''}`}><IconCrown size={14} /> {c.hof.in ? `HALL OF FAME · ${c.hof.ballot.toUpperCase()}` : c.hof.ballot.toUpperCase()} · {c.hof.pct}%</span>}
        </div>
        <Model c={c} />
        <div className="ag-card cr-totals ag-pop" style={{ '--d': '60ms' }}>
          <div className="cr-kv">{HEADLINE_STATS[c.pos].map(k => <span key={k}><b>{fmt(t.stats[k])}</b><small>{STAT_LABEL[k]}</small></span>)}<span><b>{t.rings}</b><small>RINGS</small></span><span><b>{t.awards}</b><small>{AWARD_NAME[c.pos]}</small></span><span><b>{t.proBowls}</b><small>{S.honors}</small></span><span><b>{t.allPros}</b><small>{S.first.toUpperCase()}</small></span><span><b>{t.records}</b><small>RECORDS</small></span><span><b>{money(Math.round(t.earnings))}</b><small>EARNED</small></span></div>
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

// ── Playoffs: a round, its moment, the result ────────────────────────────────
function Playoffs({ c, setCareer, onBook }) {
  const S = sportOf(c), logoFor = S.logo
  const po = c.active.po
  const rd = po.rounds[po.idx]
  const last = po.line[po.line.length - 1]
  const [step, setStep] = useState(po.stage === 'done' ? 'result' : last && !rd?.played && po.line.length ? 'result' : 'card')
  const game = useMemo(() => pickPlayoffGame(c.pos, `${c.seed}-${c.year}-${po.idx}`, po.line.map(x => x.game).filter(Boolean)), [c.seed, c.year, po.idx]) // eslint-disable-line
  const odds = Math.round((rd?.p ?? 0.5) * 100)
  if (po.stage === 'done' || step === 'result') {
    const x = last
    return (
      <div className="cr-po">
        {x && (
          <div className={`ag-card cr-po-result ag-pop${x.won ? ' is-w' : ' is-l'}`}>
            <span className="ag-eyebrow">{x.name.toUpperCase()} · {x.won ? 'W' : 'L'} {x.mySc}–{x.oppSc}</span>
            <b>{x.won ? (x.name === S.final ? 'Champions.' : `Through to the ${po.rounds[po.rounds.findIndex(r => r.name === x.name) + 1]?.name ?? 'next round'}.`) : `Season over in the ${x.name}.`}</b>
            <small>{GAME_LINE[c.pos]?.(x) ?? ''}{x.perGame ? ' a game' : ''} · the moment went {x.score >= 0.85 ? 'perfectly' : x.score >= 0.5 ? 'your way' : 'wrong'}</small>
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
      <div className="cr-po-head"><span className="ag-eyebrow">{rd.name.toUpperCase()} · vs {rd.oppName.toUpperCase()}</span></div>
      <MiniGame key={`${po.idx}-${game}`} game={game} build={c.build} seed={`${c.seed}-${c.year}-${po.idx}`} onDone={res => { setCareer(playoffRound(c, res.score, game)); setStep('result') }} />
    </div>
  )
  return (
    <div className="cr-po">
      <div className="ag-card cr-po-card ag-pop">
        <span className="ag-eyebrow">PLAYOFFS · {rd.name.toUpperCase()}{rd.series ? ' · BEST OF 7' : ''}</span>
        <div className="cr-po-match"><img src={logoFor(c.team)} alt="" /><b>{c.team}</b><i>vs</i><b>{rd.opp}</b><img src={logoFor(rd.opp)} alt="" /></div>
        <small>{rd.home === null ? 'Neutral site' : rd.home ? 'At home' : 'On the road'} · {odds}% to win · the {rd.series ? 'series' : 'game'} turns on one moment: <b>{GAMES[game]?.title}</b></small>
        <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { setStep('game'); sfx('whistle') }}>PLAY THE MOMENT <IconArrow size={16} /></button>
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
  return (
    <div className="ag-card cr-talks ag-pop">
      <div className="ag-card-head"><span className="ag-eyebrow">AT THE TABLE · {t.fit.name.toUpperCase()}</span><span className="cr-fit-status">{t.fit.status}</span></div>
      <div className="cr-talks-terms">
        <span className="cr-offer-money"><b>{money(t.perYear)}</b><small>A YEAR</small></span>
        <span className="cr-offer-money"><b>{t.years}</b><small>{t.years === 1 ? 'YEAR' : 'YEARS'}</small></span>
        <span className="cr-offer-money"><b>{money(r1(t.perYear * t.years))}</b><small>TOTAL</small></span>
      </div>
      <div className="cr-badges">{t.noTrade && <span className="cr-badge is-gold"><IconShield size={12} /> NO-TRADE</span>}{t.starter && <span className="cr-badge is-gold"><IconStar size={12} /> STARTER</span>}</div>
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
              return <button key={k} className="cr-ask" disabled={used} onClick={() => { setCareer(ask(c, k)); sfx(t.patience - a.cost < 0 ? 'deny' : 'tap') }}><b>{a.label}</b><small>{a.sub} · costs {a.cost}</small></button>
            })}
          </div>
          <div className="cr-actions">
            <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { setCareer(acceptTalks(c)); sfx('purchase'); haptic('success') }}>SIGN · {money(t.perYear)} × {t.years} {t.years === 1 ? 'YR' : 'YRS'}</button>
            <button className="ag-btn ag-btn--ghost" onClick={() => { setCareer(closeTalks(c)); sfx('tap') }}>WALK AWAY</button>
          </div>
        </>
      )}
    </div>
  )
}
const r1 = v => Math.round(v * 10) / 10
