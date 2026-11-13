import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import SpinScreen, { setGradesHidden, gradesHiddenNow } from '../SpinScreen'
import Silhouette from '../Silhouette'
import ReportCard from '../ReportCard'
import TeamPickerModal from '../TeamPickerModal'
import CustomRatingsModal from '../CustomRatingsModal'
import SiteFeatures from '../SiteFeatures'
import SiteFooter from '../SiteFooter'
import Disclaimer from '../Disclaimer'
import { GUARD_TYPES, GUARD_CATEGORIES } from '../../data/nba-guards'
import { BIG_TYPES, BIG_CATEGORIES } from '../../data/nba-bigs'
import { BUCKET_ATTR } from '../../data/nba-attrs'
import { calcBucketOVR, getBucketGuardArchetype, getBucketBigArchetype } from '../../utils/bucketSimulation'
import { HEADSHOT_BASE } from '../../utils/simulation'
import { collegeOVR } from '../../utils/cfbOvr'
import { useDropMode, useDropSheet, DropBar, DropSheet, BuildComplete } from '../app/AppBuildTray'
import { IconGear, IconClose, IconPlay, IconSpin } from '../app/icons'
import SoundToggle from '../app/SoundToggle'
import { IS_APP } from '../../lib/platform'
import { sfx } from '../../lib/juice'
import { owns } from '../../lib/progress'
import { getUsername } from '../../lib/discord'
import { loadCBB, loadCBBLegends } from '../../lib/cbbLoad'
import { CBB_POS, CBB_POOLS, poolOf, classLabel, cbbLogo, cbbLogoDark, confLogo, registerLogos, logoKey, loadProgress, saveProgress, saveSeasonLocal, seasonsLocal, summaryOf, seasonEvent, photoLookup, seasonData } from './cbbShared'
import { barAt, offersFor, cardFor, stockOf, collegeStars } from './cbbRecruit'
import { Stars, OfferBoard } from './CBBOffers'
import CBBSimPage from './CBBSimPage'
import CBBDraft from './CBBDraft'
import CBBOffseason from './CBBOffseason'
import { CLASSES, CLASS_NAME, classAt, seasonsFrom, canDeclare, canComeBack, isUnder, classAge, draftAge, upgradePoints } from './cbbClass'
import { randomName } from '../../lib/playerNames'
import '../cfb/cfb.css'
import './cbb.css'

// ── College Basketball: a mode inside basketball (MORE WAYS TO PLAY), College Football's (components/cfb/CFBMode.jsx)
// screen for screen. Its own screens: the position pick (guard or big), the build (basketball's spin, figure, chips,
// report card, OVR, footer and Sandbox, on college rosters: a CONFERENCE wheel, then a starter from it), and the
// season (CBBSimPage), from which a build can ENTER THE NBA DRAFT as a new Career (CBBDraft), RETURN TO SCHOOL or
// TRANSFER and play one somewhere else.
// CLASS YEARS (the owner, 2026-11-11; cfbClass.js): he starts as a freshman, sophomore, junior or senior (the
// switch under his name on the offers) and plays from that class to the draft, a freshman up to four seasons, a
// senior one. Every season earns one to three upgrade points, spent on his traits in the offseason (CBBOffseason)
// on the way to the next one. Basketball's rule: he may enter the draft after any season (one-and-done); a senior
// can't come back. An underclassman who signs where the starter at his spot grades out better comes off the bench that year. Everything here,
// the rosters and the sim included, loads only when the mode opens (App.jsx: lazy).
// Current / All-Time (the switch on the first screen, cfbShared CBB_POOLS): All-Time deals each school's legends
// (data/cfb-legends.js) in place of this season's rosters. Only the wheels change: the offers, the season against
// today's schools, the portal and the draft are the same, and the seasons it plays are tagged All-Time
const ovrOf = pos => (b, t) => collegeOVR(calcBucketOVR(b, t, pos))
const POS = {
  guard: { types: GUARD_TYPES, attr: BUCKET_ATTR, cats: GUARD_CATEGORIES, ovr: ovrOf('guard'), arch: getBucketGuardArchetype },
  big: { types: BIG_TYPES, attr: BUCKET_ATTR, cats: BIG_CATEGORIES, ovr: ovrOf('big'), arch: getBucketBigArchetype },
}
const emptyBuild = pos => Object.fromEntries(POS[pos].types.map(t => [t, null]))
const newSeed = () => ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0) || 1

// Sandbox, the mode's own (basketball's switch and ratings stay basketball's): its switch and custom ratings
const SANDBOX_KEY = 'bap_cbb_sandbox'
const RATINGS_KEY = 'bap_cbb_custom_ratings'
const RATINGS_KEY_AT = 'bap_cbb_custom_ratings_alltime'   // (All-Time's own: a legend's edits never sit on a current player)
const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }

// The phone navbar's grades switch (Navbar.jsx keeps its own; this one is the same button)
function GradesSwitch() {
  const [hidden, setHidden] = useState(gradesHiddenNow)
  useEffect(() => { const on = e => setHidden(!!e.detail); window.addEventListener('bap:grades', on); return () => window.removeEventListener('bap:grades', on) }, [])
  return (
    <button className={`nav-grades${hidden ? ' is-off' : ''}`} onClick={() => setGradesHidden(!hidden)} aria-pressed={!hidden} aria-label={hidden ? 'Turn grades on' : 'Turn grades off'}>
      GRADES <b>{hidden ? 'OFF' : 'ON'}</b>
    </button>
  )
}

// The build page's top bar: the game's navbar, with the mode in place of the position menu
function CBBNav({ pos, onHome, grades, era = 'current' }) {
  return (
    <header className="navbar cfb-nav">
      <div className="logo" onClick={onHome} style={{ cursor: 'pointer' }}>
        <div className="logo-text-stack">
          <img src="/bap-mark.webp" alt="Build-A-Player" className="logo-img-full" draggable={false} />
          <div className="logo-text-row">
            <div className="logo-text logo-text--small">Buil<span className="logo-d">d</span><em>-<span className="logo-a">A</span>-</em>Player</div>
          </div>
        </div>
      </div>
      <div className="nav-pos-dropdown">
        <span className="tab-pill tab-pill-qb active nav-pos-trigger nav-pos-trigger--static cfb-nav-pill">
          <span className="nav-pos-badge" style={{ '--pos-col': '#ffffff' }}>{CBB_POS[pos].label}</span>
          <span className="nav-pos-name">{era === 'alltime' ? 'All-Time' : 'College'} {CBB_POS[pos].name}</span>
        </span>
      </div>
      {grades && IS_APP && <GradesSwitch />}
      <div className="nav-right">
        {!IS_APP && (
          <>
            {grades && <GradesSwitch />}
            <SoundToggle className="nav-sound-btn" />
            <button className="ag-icon-btn nav-more-btn" onClick={() => window.dispatchEvent(new CustomEvent('bap:menu'))} aria-label="Settings and more"><IconGear size={21} /></button>
          </>
        )}
      </div>
    </header>
  )
}

// The way in: which position, plus where things stand (a build or a season to pick back up, the last few seasons)
function CBBEntry({ data, progress, seasons, era, onEra, onPick, onResume, onClose }) {
  const poolTag = progress && poolOf(progress.pool) === 'alltime' ? ' · All-Time' : ''
  const clsTag = progress?.cls0 != null ? ` · ${CLASS_NAME[classAt(progress.cls0, progress.history?.length ?? 0)]}` : ''
  const resumeLine = progress && (progress.result
    ? `${CBB_POS[progress.pos].label}${poolTag}${clsTag} · ${progress.result.team?.school ?? progress.result.team?.name ?? ''} ${progress.result.cbb?.record?.final ?? `${progress.result.wins}-${progress.result.losses}`}`
    : `${CBB_POS[progress.pos].label}${poolTag} · ${Object.values(progress.build ?? {}).filter(Boolean).length} of ${POS[progress.pos].types.length} traits`)
  return (
    <div className="ag-screen cfb-screen cfb-entry">
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">BASKETBALL</span><h1 className="ag-h1">College Basketball</h1></div>
        <button className="ag-round-btn" onClick={onClose} aria-label="Home"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        {progress && (
          <button className="cfb-resume" onClick={onResume}>
            <span className="cfb-resume-ico"><IconPlay size={16} /></span>
            <span><small>{progress.result ? (progress.off?.open ? 'OFFSEASON' : 'SEASON') : 'BUILD IN PROGRESS'}</small><b>{resumeLine}</b></span>
          </button>
        )}
        {/* the pool the wheels deal from: this season's rosters, or each school's legends. Only the wheels change */}
        <h2 className="cfb-label">PLAYER POOL</h2>
        <div className="cfb-pool" role="radiogroup" aria-label="Player pool">
          {Object.entries(CBB_POOLS).map(([k, p]) => (
            <button key={k} role="radio" aria-checked={era === k} className={`cfb-pool-opt${era === k ? ' is-on' : ''}`} onClick={() => { if (era !== k) { sfx('tap'); onEra(k) } }}>
              <b>{p.label.toUpperCase()}</b><small>{p.sub}</small>
            </button>
          ))}
        </div>
        <h2 className="cfb-label">PICK A POSITION</h2>
        <div className="cfb-pos-row" role="list">
          {Object.entries(CBB_POS).map(([k, p]) => (
            <button key={k} role="listitem" className={`cfb-pos cfb-pos--${k} cbb-pos`} onClick={() => { sfx('tap'); onPick(k) }}>
              <span className="cbb-pos-faces" aria-hidden="true">{p.faces.current.map(id => <img key={id} src={`/headshots/${id}.webp`} alt="" width="96" height="70" loading="lazy" decoding="async" draggable={false} />)}</span>
              <span className="cfb-pos-txt"><b>{p.label}</b><small>{p.sub}</small></span>
            </button>
          ))}
        </div>
        <section className="cfb-confs" aria-label="Conferences">
          <h2 className="cfb-label">THE CONFERENCES</h2>
          <div className="cfb-conf-strip">
            {data ? data.conferences.map(c => (
              <span key={c.id} className="cfb-conf-chip" title={c.name}>
                <img className="cfb-conf-plate" src={confLogo(c)} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} />
                <b>{c.short}</b><small>{c.teams}</small>
              </span>
            )) : <span className="cfb-wait">Loading the conferences…</span>}
          </div>
        </section>
        {seasons.length > 0 && (
          <section className="cfb-past" aria-label="Recent seasons">
            <h2 className="cfb-label">RECENT SEASONS</h2>
            {seasons.slice(0, 5).map(s => (
              <div key={s.at} className="cfb-past-row">
                <img src={cbbLogoDark(s.team)} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                <span className="cfb-past-main"><b>{s.teamName} {s.record}</b><small>{CBB_POS[s.pos]?.label ?? s.pos} · {s.ovr} OVR{s.finalRank ? ` · Final No. ${s.finalRank}` : ''}</small></span>
                <span className="cfb-past-tags">{s.pool === 'alltime' && <i className="is-at">ALL-TIME</i>}{s.sandbox && <i className="is-sb">SANDBOX</i>}{s.title && <i className="is-gold">NATIONAL CHAMPS</i>}{s.wooden && <i>WOODEN</i>}{!s.title && s.finalFour && <i>FINAL FOUR</i>}{!s.title && !s.finalFour && s.ncaa && <i>NCAA</i>}</span>
              </div>
            ))}
          </section>
        )}
        <Disclaimer sport="cbb" className="cfb-disclaimer" />
      </div>
    </div>
  )
}

// The schools offering him, as a recruiting board (Career's Start in College has the same board): his card (stars,
// where he ranks among the country's players at his spot, his OVR), the offers, and the button that signs him.
// The first school (SIMULATE SEASON) and the transfer portal (TRANSFER: his school is the row at the top while he
// can still go back, and the card says how the season just played moved his stock). Sandbox: any school at all
// (the player's own name: letters, spaces, apostrophes, periods and hyphens, like Career's)
const cleanName = v => v.replace(/[^A-Za-zÀ-ſ' .-]/g, '').replace(/\s+/g, ' ').replace(/^ /, '').slice(0, 22)

// onName (the first school only): the name on the card is a field. Whatever he's called here is his name for the
// college seasons and, through Enter the NBA Draft, his Career's; left empty, he goes by the username
// cls / onCls (the first school only): his class, the four-way switch under the name. compete: an upperclassman plays
// wherever he signs (a job to win in camp); an underclassman behind a better starter is that school's backup
function OffersScreen({ eyebrow, title, name, pos, ovr, card, stock, offers, teamsBy, confOf, current = null, onCommit, onClose, onAny, nameValue = '', onName = null, cls = null, onCls = null, compete = true }) {
  const [picked, setPicked] = useState(null)
  const sel = picked ? offers.find(o => o.short === picked) : null
  const schoolOf = short => String(teamsBy[short]?.school ?? short).toUpperCase()
  const label = !sel ? 'PICK A SCHOOL' : sel.stay ? `RETURN TO ${schoolOf(sel.short)}` : current ? `TRANSFER TO ${schoolOf(sel.short)}` : `COMMIT TO ${schoolOf(sel.short)}`
  const moved = card.stars !== card.base
  return (
    <div className="ag-screen cfb-screen cfbr cfbo">
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">{eyebrow}</span><h1 className="ag-h1">{title}</h1></div>
        <button className="ag-round-btn" onClick={onClose} aria-label="Back"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <section className="cfbr-card">
          <div className="cfbr-who"><small>{CBB_POS[pos].name.toUpperCase()}{current ? ` · ${String(teamsBy[current]?.school ?? current).toUpperCase()}` : ''}</small>{onName
            ? (
              <div className="cfbr-name">
                <span id="cfbr-name-l">NAME YOUR PLAYER</span>
                <div className="cfbr-name-row">
                <input className="cfbr-name-in" aria-labelledby="cfbr-name-l" value={nameValue} onChange={e => onName(cleanName(e.target.value))} placeholder="TYPE A NAME" autoComplete="off" autoCapitalize="words" spellCheck={false} enterKeyHint="done" aria-label="Player name" onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
                <svg className="cfbr-name-pen" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                {/* Career's random-name button, the same names (lib/playerNames.js): a new one every tap */}
                <button type="button" className="cfbr-name-rand" onClick={() => { onName(randomName(nameValue)); sfx('tap') }} aria-label="Random name" title="Random name"><IconSpin size={20} /></button>
                </div>
                {onCls && (
                  <>
                    <span className="cfbr-cls-l" id="cfbr-cls-l">CLASS<i>{seasonsFrom(CLASSES.indexOf(cls)) === 1 ? '1 SEASON' : `UP TO ${seasonsFrom(CLASSES.indexOf(cls))} SEASONS`}</i></span>
                    <div className="cfbr-cls" role="radiogroup" aria-labelledby="cfbr-cls-l">
                      {CLASSES.map((k, i) => <button key={k} type="button" role="radio" aria-checked={cls === k} className={cls === k ? 'is-on' : ''} onClick={() => { if (cls !== k) { onCls(i); sfx('tap') } }}>{CLASS_NAME[k].toUpperCase()}</button>)}
                    </div>
                  </>
                )}
              </div>
            )
            : <b>{name}</b>}</div>
          <Stars n={card.stars} />
          <div className="cfbr-rank">
            <span><b>No. {card.posRank}</b><small>{CBB_POS[pos].label} NATIONALLY</small></span>
            <span><b>{ovr}</b><small>OVR</small></span>
          </div>
          {stock && <p className="cfbo-stock">{stock.line}{moved ? ` A ${card.base}-star on talent, a ${card.stars}-star now.` : ''}</p>}
        </section>
        {/* the one commit button, above the board (not pinned over it): grey until a school is picked */}
        <div className="cfbo-commit"><button className="cfbs-next cfbr-commit" disabled={!sel} onClick={() => sel && onCommit(sel.short)}><b>{label}</b></button></div>
        <section>
          <h2 className="cfb-label">{current ? (offers.some(o => o.stay) ? 'STAY OR TRANSFER' : 'TRANSFER PORTAL OFFERS') : 'SCHOLARSHIP OFFERS'}</h2>
          <OfferBoard compete={compete} pos={pos} teamsBy={teamsBy} confOf={confOf} offers={offers} picked={picked} onPick={short => { setPicked(short); sfx('tap') }} />
        </section>
        {onAny && <button className="cfbs-btn cfbo-any" onClick={() => { sfx('tap'); onAny() }}>ANY SCHOOL<small>Sandbox: pick or spin any school in the country</small></button>}
      </div>
    </div>
  )
}

export default function CBBMode({ user, onHome, onCareer }) {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const saved = useMemo(loadProgress, [])
  const [progress, setProgress] = useState(saved)
  const [phase, setPhase] = useState('pick')   // 'pick' | 'build' | 'season'
  const [pos, setPos] = useState(saved?.pos ?? 'guard')
  // Current or All-Time: the pool this build's wheels deal from (cfbShared CBB_POOLS). era is the build's, kept with
  // it (a reload mid-build deals the same pool); pickEra is the switch on the first screen, which the next new build takes
  const [era, setEra] = useState(poolOf(saved?.pool))
  const [pickEra, setPickEra] = useState(poolOf(saved?.pool))
  const [legends, setLegends] = useState(null)
  const [build, setBuild] = useState(saved?.build ?? emptyBuild(saved?.pos ?? 'guard'))
  const [spin, setSpin] = useState(saved?.spin ?? null)
  const [result, setResult] = useState(saved?.result ?? null)
  const [stage, setStage] = useState(saved?.stage ?? 'pre')   // the season page it's on ('pre' … 'final'; an older save's number, CBBSimPage reads both)
  const [story, setStory] = useState(saved?.story ?? null)   // the regular season as it played out (the final report's season story)
  // the seasons this build has already played (RETURN TO SCHOOL, TRANSFER): each one's school, record, honors
  // and totals. The draft board reads his whole college career from them (cbbSimulation opts.career)
  const [history, setHistory] = useState(Array.isArray(saved?.history) ? saved.history : [])
  // CLASS YEARS (cfbClass.js). cls0: the class he started as (0 freshman … 3 senior), so his class this season is
  // cls0 plus the seasons behind him. (A run saved before classes had none and was always draft-eligible: it reads as
  // a junior's season, a senior's once he has come back twice, so the draft is still there for it.)
  // bank: upgrade points he hasn't spent. off: the offseason in progress ({ to: 'return' | 'transfer', build: the
  // build with this offseason's upgrades, left: points still to spend, open }); the build itself only changes when
  // the next season starts
  const [cls0, setCls0] = useState(() => (Number.isInteger(saved?.cls0) ? Math.max(0, Math.min(3, saved.cls0)) : saved?.result ? Math.max(0, 2 - (Array.isArray(saved.history) ? saved.history.length : 0)) : 0))
  const [bank, setBank] = useState(() => (Number.isFinite(saved?.bank) ? saved.bank : 0))
  const [off, setOff] = useState(() => (saved?.off?.build && saved?.result ? saved.off : null))
  const cls = classAt(cls0, history.length)
  const [moving, setMoving] = useState(false)   // the transfer portal (its offers screen)
  const [anyMove, setAnyMove] = useState(false)   // Sandbox: the transfer's any-school picker
  const [offering, setOffering] = useState(false)   // the first school: the scholarship offers
  const [activeDrag, setActiveDrag] = useState(null)
  const [activeCategory, setActiveCategory] = useState('skills')
  const [spinResetKey, setSpinResetKey] = useState(0)
  const [gameKey, setGameKey] = useState(0)
  const [spinPhase, setSpinPhase] = useState('idle')
  const [picker, setPicker] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [seasons, setSeasons] = useState(seasonsLocal)
  // Sandbox: on for this mode, the ratings it edits, Starters Only for this build
  // (Sandbox here is a 5,000-coin unlock, sandbox-cfb: AppSandbox asks to buy it; on only once it's owned)
  const [sandboxOn, setSandboxOn] = useState(() => readJSON(SANDBOX_KEY, false) === true && owns('sandbox-cbb'))
  const ratingsKey = era === 'alltime' ? RATINGS_KEY_AT : RATINGS_KEY
  const [customRatings, setCustomRatings] = useState(() => readJSON(ratingsKey, {}))
  useEffect(() => { setCustomRatings(readJSON(ratingsKey, {})) }, [ratingsKey])
  const [showCustom, setShowCustom] = useState(false)
  const [startersPick, setStartersPick] = useState(!!saved?.starters)
  // a build that had Sandbox on at any point stays a Sandbox build until it's reset (the game's rule)
  const tainted = useRef(sandboxOn || !!saved?.sandbox)
  useEffect(() => { if (sandboxOn) tainted.current = true }, [sandboxOn])
  const userName = getUsername(user) || 'Guest'
  // the player's name, typed on the first school's offers (kept with the build; empty: he goes by the username)
  const [playerName, setPlayerName] = useState(() => loadProgress()?.playerName ?? '')
  const who = playerName.trim() || userName
  const P = POS[pos]

  // the mode's colours: NCAA blue on its own screens only (cfb.css, html.is-cfb)
  useEffect(() => {
    document.documentElement.classList.add('is-cfb', 'is-cbb')
    return () => document.documentElement.classList.remove('is-cfb', 'is-cbb')
  }, [])
  useEffect(() => {
    let live = true
    loadCBB().then(d => { registerLogos(d.teams, d.others); if (live) setData(d) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])
  // (the legends: only once a build is All-Time)
  useEffect(() => {
    if (era !== 'alltime' || legends) return
    let live = true
    loadCBBLegends().then(l => { if (live) setLegends(l) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [era, legends])

  // the college pool, as the spin reads it: the school's logo through the team field
  // (public/logos/cfb/{short}.png), the school and its conference kept beside it.
  // Starters only (the owner's rule): one per school, so a conference deals its schools' QB1s,
  // RB1s or WR1s, never a backup, respins included. (The season still plays each team's real depth)
  const teamsBy = useMemo(() => Object.fromEntries((data?.teams ?? []).map(t => [t.short, t])), [data])
  // (every Division I team, for the season page: the schedule and the bracket name schools the mode doesn't spin)
  const teamsAll = useMemo(() => Object.fromEntries([...(data?.others ?? []), ...(data?.teams ?? [])].map(t => [t.short, t])), [data])
  // (the wheel always deals the first season's real rosters; the seasons after it play cbbShared seasonData's)
  // All-Time: the same rows from data/cfb-legends.js, a school's one to three greats at the spot (every one of them
  // is on the wheel: they're all 'starters'), with the years he played there where a current player has his class.
  // The legends don't age with the build's seasons: only the country he plays against does
  const pool = useMemo(() => (era === 'alltime' ? legends?.[pos] ?? [] : data?.pools[pos] ?? []).filter(p => p.starter === true).map(p => {
    const t = teamsBy[p.team]
    return {
      ...p,
      team: logoKey(p.team), school: p.team, conf: p.conf ?? t?.conf,
      teamName: t?.name ?? p.teamName ?? p.team,
      color: p.color ?? t?.color, color2: p.color2 ?? t?.color2,
      years: p.years ?? classLabel(p.year),   // (the position is already in the card's circle)
      headshot: p.headshot ?? undefined,
    }
  }), [data, legends, era, pos, teamsBy])
  // Sandbox's custom ratings, laid over the pool (its own store: RATINGS_KEY)
  const displayPool = useMemo(() => {
    const o = sandboxOn ? customRatings[pos] : null
    return o ? pool.map(p => (o[`${p.name}|${p.team}`] ? { ...p, attrs: { ...p.attrs, ...o[`${p.name}|${p.team}`] } } : p)) : pool
  }, [pool, sandboxOn, customRatings, pos])
  const byKey = useMemo(() => new Map(pool.map(p => [`${p.name}|${p.team}`, p])), [pool])
  // The conference wheel, weighted by size: each conference is on it once per two schools, so the
  // Big Ten (18) comes up nine times as often as the Independents (2), a school's own share of the
  // country. The wheel shows what it deals: the big ones fill more of it
  const confs = useMemo(() => (data?.conferences ?? []).flatMap(c => Array.from({ length: Math.max(1, Math.round((c.teams ?? 2) / 2)) }, () => ({ ...c, short: c.id, label: c.short }))), [data])
  const group = useMemo(() => ({
    key: 'conf', respin: 'CONF', logo: confLogo,
    display: c => {
      const [first, ...rest] = String(c.label).split(' ')
      return (
        <span className={`cfb-reel-conf${rest.length ? ' is-two' : ''}`}>
          <img className="cfb-conf-plate" src={confLogo(c)} alt="" draggable={false} onError={e => { e.currentTarget.style.display = 'none' }} />
          <span>{first}{rest.length ? <><br />{rest.join(' ')}</> : null}</span>
        </span>
      )
    },
  }), [])
  const schools = useMemo(() => (data?.teams ?? []).map(t => ({ ...t, logo: cbbLogo(t.short) })), [data])
  // a real player's headshot by name and school (the season page's Wooden ceremony)
  const photoOf = useMemo(() => photoLookup(data?.pools, HEADSHOT_BASE), [data])

  // a chip carries the college player's school, conference, class and size with it
  const withCollege = useCallback(chip => {
    const p = byKey.get(`${chip.qbFull}|${chip.team}`)
    const short = p?.school ?? String(chip.team).replace(/^c[bf]b\//, '')
    // (jerseyWord: the word across the chest. A college chip's team is its logo's place, 'cfb/DUKE' or 'cbb/GONZ': cbbShared logoKey)
    return { ...chip, cfb: true, cbb: true, school: short, jerseyWord: String(teamsBy[short]?.school ?? short).toUpperCase(), conf: p?.conf ?? null, year: p?.year ?? null, height: chip.height ?? p?.height ?? null, weight: chip.weight ?? p?.weight ?? null }
  }, [byKey, teamsBy])

  // kept on the device: a reload, or Home and back, picks the build (or the season) back up
  useEffect(() => {
    if (phase === 'pick') return
    const p = { pos, pool: era, build, spin, result, stage, story, history, playerName, cls0, bank, off, sandbox: tainted.current, starters: startersPick, at: Date.now() }
    saveProgress(p); setProgress(p)
  }, [phase, pos, era, build, spin, result, stage, story, history, startersPick, playerName, cls0, bank, off])

  const activeDragRef = useRef(activeDrag)
  activeDragRef.current = activeDrag
  const handleDrop = useCallback(() => {
    const drag = activeDragRef.current
    if (!drag) return
    setBuild(prev => ({ ...prev, [drag.type]: withCollege(drag) }))
    setActiveDrag(null)
    setSpinResetKey(k => k + 1)
  }, [withCollege])
  const handleChipTap = useCallback(chip => {
    setBuild(prev => (prev[chip.type] ? prev : { ...prev, [chip.type]: withCollege(chip) }))
    setSpinResetKey(k => k + 1)
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' })
  }, [withCollege])

  const freshBuild = useCallback(p => {
    setPos(p); setBuild(emptyBuild(p)); setSpin(null); setResult(null); setStage('pre'); setStory(null); setHistory([]); setPlayerName(''); setBank(0); setOff(null); setActiveDrag(null)
    setActiveCategory('skills'); setSpinResetKey(k => k + 1); setGameKey(k => k + 1); setStartersPick(false)
    tainted.current = sandboxOn
  }, [sandboxOn])
  // (a new build from the first screen takes its switch; Reset and a new build off the season page stay in the pool they're in)
  const start = (p, e = era) => { setEra(e); setPickEra(e); freshBuild(p); setPhase('build'); window.scrollTo(0, 0) }
  const resume = () => { setPickEra(era); setPhase(result ? 'season' : 'build'); window.scrollTo(0, 0) }
  const reset = useCallback(() => { freshBuild(pos); window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' }) }, [freshBuild, pos])

  // Sandbox: the game's switch, Starters Only (one wheel of every starter, no conference spin) and Custom Ratings
  const sandboxToggle = on => {
    try { localStorage.setItem(SANDBOX_KEY, JSON.stringify(!!on)) } catch {}
    setSandboxOn(!!on)
    if (!on && startersPick) { setStartersPick(false); reset() }   // off during a Starters Only build: it starts over, as a normal one
  }
  const startersOn = startersPick && sandboxOn
  const startersProp = phase === 'build' ? { on: startersOn, locked: spinPhase !== 'idle' || P.types.some(t => build[t]), onToggle: setStartersPick } : null
  const addChip = (p, overrides, type) => withCollege({
    type, val: overrides?.[type] ?? p.attrs?.[type] ?? 5, qb: p.short || p.name, qbFull: p.name,
    teamColor: p.color, teamColor2: p.color2, skinColor: p.skin, number: p.number, team: p.team, captain: !!p.captain, sandbox: true,
    photo: p.headshot ? `${HEADSHOT_BASE}/${p.headshot}.webp` : null, height: p.height, weight: p.weight,
  })

  const complete = P.types.every(t => build[t])
  const onSimulate = () => { if (result) { setPhase('season'); window.scrollTo(0, 0); return } setOffering(true); window.scrollTo(0, 0) }
  // A season at a school, simulated and booked, in his class that year (cfbClass.js: the engine is told it, and that
  // going or staying is his call). prior: the seasons he's already played (the board reads his whole college career);
  // b: the build it's played with (the offseason's upgrades on it); start: the class he started as
  // An underclassman who isn't better than the school's starter at his spot comes off the bench that year (the
  // engine's role 'bench'), unless the job was already his there; a junior or senior plays wherever he signs
  const startsAt = useCallback((short, prior, ovr, start = cls0) => {
    const k = prior.length, last = prior[k - 1]
    if (!isUnder(classAt(start, k)) || (last && last.school === short && last.role !== 'bench')) return true
    const bar = barAt(seasonData(data, k), short, pos)
    return !bar || ovr > (bar.ovr ?? 0)
  }, [data, pos, cls0])
  const playSeason = useCallback((team, prior = [], b = build, start = cls0) => {
    const build = b   // (everything below reads the build this season is played with)
    const seed = newSeed()
    const k = prior.length, year = classAt(start, k)
    const best = (k, order) => order.find(x => prior.some(s => s[k] === x)) ?? null
    // (a year off the bench is a year on campus, not a season on tape: the board counts the ones he started)
    const played = prior.filter(s => s.role !== 'bench')
    const career = prior.length ? { seasons: prior.length, wooden: best('wooden', ['won', 'finalist']), allAmerica: best('allAmerica', ['first', 'second']), totals: played.map(s => s.totals ?? {}), teams: played.map(s => ({ w: s.w, l: s.l, ncaa: !!s.ncaa, title: !!s.title, conf: !!s.confChamp })) } : null
    // (season two on: the rosters a year later, the seniors gone and their spots filled: cbbShared seasonData)
    const pools = k ? seasonData(data, k).pools : null
    const r = startsAt(team.short, prior, P.ovr(build, P.types), start)
      ? data.sim.runCBBSimulation(build, P.types, team, pos, seed, 'classic', null, { name: who, year, season: 2026 + k, ...(career ? { career } : {}), ...(pools ? { pools } : {}) })
      : data.sim.runCBBSimulation(build, P.types, team, pos, seed, 'classic', null, { name: who, year, season: 2026 + k, role: 'bench', ...(career ? { career } : {}), ...(pools ? { pools } : {}) })
    r.seed = r.seed ?? seed
    r.ovr = P.ovr(build, P.types)   // (the college overall the build page and the offseason show: utils/cfbOvr.js collegeOVR)
    const sb = tainted.current || P.types.some(t => build[t]?.sandbox)
    r.sandbox = sb
    r.pool = era   // (Current or All-Time: which pool the build was spun from)
    setResult(r); setStage('pre'); setStory(null)
    // kept on this device (cbbShared saveSeasonLocal; the boards hook is there for later), and booked
    // for XP, coins and achievements the way any season is (lib/progress.js; a Sandbox season pays nothing)
    saveSeasonLocal({ ...summaryOf(r, { pos, build, types: P.types, ovr: P.ovr(build, P.types), name: P.arch(P.ovr(build, P.types), build, P.types), userName, pool: era }), sandbox: sb }, sb ? null : user)
    window.dispatchEvent(new CustomEvent('bap:season', { detail: seasonEvent(r, pos, sb, era) }))
    setSeasons(seasonsLocal())
    setPhase('season')
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.querySelector('.simp-page')?.scrollTo({ top: 0, behavior: 'instant' })
  }, [data, build, P, pos, userName, who, user, era, cls0, startsAt])
  const teamPicked = useCallback(team => { setPicker(false); setOffering(false); setHistory([]); setBank(0); setOff(null); playSeason(team, []) }, [playSeason])
  // RETURN TO SCHOOL / TRANSFER: the season just played goes on his résumé, then the next year, a class older and
  // with the offseason's upgrades on the build, from the pre-season page, booked like any season
  const another = useCallback(team => {
    if (!result || !team) return
    const a = result.cbb?.awards ?? {}
    const rec = result.cbb?.record?.final ?? `${result.wins}-${result.losses}`
    const earned = upgradePoints(result, pos)
    const prior = [...history, {
      cls, role: result.role === 'bench' ? 'bench' : 'starter', pts: earned.pts,
      w: +String(rec).split('-')[0], l: +String(rec).split('-')[1], ncaa: !!result.cbb?.ncaa?.seed, title: !!result.champion, confChamp: !!result.cbb?.confChamp,
      school: result.team?.short, schoolName: result.team?.school ?? result.team?.name, record: result.cbb?.record?.final ?? `${result.wins}-${result.losses}`,
      wooden: a.wooden?.userWon ? 'won' : a.wooden?.userFinalist ? 'finalist' : null, allAmerica: a.allAmerica?.user ?? null,
      totals: Object.fromEntries(Object.entries(result.cbb?.totals?.full ?? {}).filter(([, x]) => typeof x === 'number')),
    }]
    // (the offseason's upgrades go on the build now; the points he didn't spend stay in the bank)
    const next = off?.build ?? build
    setBuild(next); setBank(off ? off.left : bank + earned.pts); setOff(null)
    setMoving(false); setAnyMove(false); setHistory(prior); playSeason(team, prior, next)
  }, [result, history, playSeason, cls, pos, off, build, bank])
  // THE OFFSEASON, on the way to the next season (Return to School) or the portal (Transfer): this season's points
  // go in with the ones he kept, to spend on his traits. Left and come back to, it's as he left it
  const openOff = to => {
    setOff(o => (o ? { ...o, to, open: true } : { to, build, left: bank + upgradePoints(result, pos).pts, open: true }))
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  // phones: the player is the screen and the spin drops down over it (the game's build)
  const drop = useDropMode(phase === 'build')
  const [dropOpen, setDropOpen] = useDropSheet(drop, build, P.types, spinResetKey)
  const ovrNow = complete ? P.ovr(build, P.types) : 0
  const close = () => { onHome() }

  // the offers: the same build gets the same schools (seeded from the build), a season later his stock moves them
  const confOf = useMemo(() => Object.fromEntries((data?.conferences ?? []).map(x => [x.id, x])), [data])
  const buildKey = useMemo(() => P.types.map(t => `${t}:${build[t]?.qbFull ?? ''}:${build[t]?.val ?? ''}`).join('|'), [build, P.types])
  // (his eligibility is his class: a senior is done; everyone else can come back, or transfer)
  const canReturn = canComeBack(cls)
  const nextBuild = off?.build ?? build   // (the build he takes into next season: this offseason's upgrades on it)
  const recruit = useMemo(() => {
    if (!offering || !data || !complete) return null
    const card = cardFor(data, data, pos, ovrNow)
    return { card, offers: offersFor(data, { stars: card.stars, ovr: ovrNow, pos, seed: `oneoff-${pos}-${buildKey}`, n: 10 }) }
  }, [offering, data, complete, pos, ovrNow, buildKey])
  const portal = useMemo(() => {
    if (!moving || !data || !result) return null
    const ovr = P.ovr(nextBuild, P.types)
    const next = seasonData(data, history.length + 1)   // (next season's rosters: who he'd be up against there)
    const cur = result.team?.short
    const stock = stockOf(result, result.team?.confShort ?? confOf[result.team?.conf]?.short, collegeStars(data, pos, ovr).stars)
    const card = cardFor(data, next, pos, ovr, stock)
    const away = offersFor(next, { stars: card.stars, ovr, pos, seed: `oneoff-portal-${pos}-${buildKey}-${history.length}-${result.seed}`, skip: [cur], n: 10, lift: stock.lift })
    const bar = barAt(next, cur, pos)
    const stay = { short: cur, stay: true, starts: !isUnder(classAt(cls0, history.length + 1)) || result.role !== 'bench' || !bar || ovr > (bar.ovr ?? 0), bar: bar ? { name: bar.name, ovr: bar.ovr, year: bar.year } : null }
    return { ovr, card, stock, offers: canReturn ? [stay, ...away] : away }
  }, [moving, data, result, nextBuild, P, history.length, pos, buildKey, confOf, canReturn, cls0])

  if (phase === 'pick') {
    return <CBBEntry data={data} progress={progress} seasons={seasons} era={pickEra} onEra={setPickEra} onPick={p => start(p, pickEra)} onResume={resume} onClose={close} />
  }
  if (!data || (era === 'alltime' && !legends)) {
    return (
      <div className="ag-screen cfb-screen cfb-loading">
        <div className="ag-screen-head"><div><span className="ag-eyebrow">BASKETBALL</span><h1 className="ag-h1">College Basketball</h1></div><button className="ag-round-btn" onClick={close} aria-label="Home"><IconClose size={16} /></button></div>
        <p className="cfb-wait">{failed ? 'College Basketball didn\'t load. Check the connection and open it again.' : era === 'alltime' && data ? 'Loading the legends…' : 'Loading the rosters…'}</p>
      </div>
    )
  }
  if (phase === 'season' && result && moving && portal) {
    return (
      <>
        <OffersScreen eyebrow={`${who.toUpperCase()} · TRANSFER PORTAL`} title="Transfer" name={who} pos={pos} ovr={portal.ovr}
          card={portal.card} stock={portal.stock} offers={portal.offers} teamsBy={teamsBy} confOf={confOf} current={result.team?.short} compete={!isUnder(classAt(cls0, history.length + 1))}
          onCommit={short => { sfx('whistle'); another(schools.find(t => t.short === short) ?? teamsBy[short]) }}
          onClose={() => setMoving(false)}
          onAny={sandboxOn ? () => setAnyMove(true) : null} />
        {anyMove && <TeamPickerModal onSelect={another} onCancel={() => setAnyMove(false)} build={nextBuild} anyTeam teams={schools.filter(t => t.short !== result.team?.short)} teamOf={c => c.school} eyebrow="College Basketball · Transfer" />}
      </>
    )
  }
  if (phase === 'season' && result && off?.open) {
    const earned = upgradePoints(result, pos)
    const nextCls = classAt(cls0, history.length + 1)
    const school = result.team?.school ?? result.team?.name
    const spent = off.left !== bank + earned.pts
    return (
      <CBBOffseason who={who} pos={pos} school={school} cls={cls} nextCls={nextCls} earned={earned} attr={P.attr}
        career={{ sport: 'bucket', pos, types: P.types, build: off.build, age: classAge(nextCls), year: 0, phase: 'offseason', name: who, dev: { points: off.left, spent: 0 }, decisions: [] }}
        onCareer={n => setOff({ ...off, build: n.build, left: n.dev.points })}
        ovr={P.ovr(off.build, P.types)} ovrWas={P.ovr(build, P.types)}
        cta={off.to === 'transfer' ? 'TRANSFER PORTAL' : `START ${CLASS_NAME[nextCls].toUpperCase()} SEASON`}
        onGo={() => { if (off.to === 'transfer') { sfx('tap'); setMoving(true); window.scrollTo({ top: 0, behavior: 'instant' }) } else { sfx('whistle'); another(schools.find(t => t.short === result.team?.short) ?? result.team) } }}
        onReset={spent ? () => setOff({ ...off, build, left: bank + earned.pts }) : null}
        onClose={() => setOff({ ...off, open: false })} />
    )
  }
  if (phase === 'build' && offering && recruit) {
    return (
      <>
        <OffersScreen eyebrow={`${who.toUpperCase()} · RECRUITING`} title="Offers" name={who} nameValue={playerName} onName={setPlayerName} pos={pos} ovr={ovrNow}
          card={recruit.card} offers={recruit.offers} teamsBy={teamsBy} confOf={confOf}
          cls={classAt(cls0, 0)} onCls={setCls0} compete={!isUnder(classAt(cls0, 0))}
          onCommit={short => { sfx('whistle'); teamPicked(schools.find(t => t.short === short) ?? teamsBy[short]) }}
          onClose={() => setOffering(false)}
          onAny={sandboxOn ? () => setPicker(true) : null} />
        {picker && <TeamPickerModal onSelect={teamPicked} onCancel={() => setPicker(false)} build={build} isPlus={sandboxOn} teams={schools} teamOf={c => c.school} eyebrow="College Basketball · Simulate Season" />}
      </>
    )
  }
  if (phase === 'season' && result) {
    return (
      <>
        {/* the season page (the navbar over it, as the game's season has it) */}
        <CBBSimPage result={result} build={build} types={P.types} attrMap={P.attr} pos={pos} userName={who} teams={teamsAll}
          archetype={P.arch(P.ovr(build, P.types), build, P.types)}
          nav={<CBBNav pos={pos} onHome={close} grades={false} era={era} />}
          stage={stage} onStage={setStage}
          story={story} onStory={setStory} photoOf={photoOf}
          key={result.seed}
          userYear={cls} season={2026 + history.length}
          roleNote={result.role === 'bench' ? `${CLASS_NAME[cls]} · off the bench behind ${result.starterName ?? 'the starter'}` : `${CLASS_NAME[cls]} · ${P.arch(P.ovr(build, P.types), build, P.types)}`}
          seasonNote={[era === 'alltime' ? 'All-Time build' : null, `${CLASS_NAME[cls]} season`, history.length ? (history[history.length - 1].school === result.team?.short ? `back at ${result.team?.school ?? result.team?.name}` : `transferred from ${history[history.length - 1].schoolName}`) : null].filter(Boolean).join(' · ')}
          onAgain={() => start(pos)}
          onDraft={canDeclare(cls) ? () => setDrafting(true) : null}
          onReturn={canReturn ? () => openOff('return') : null}
          nextNote={canReturn ? (canDeclare(cls) ? null : `${CLASS_NAME[classAt(cls0, history.length + 1)]} year is next. He can enter the NBA Draft after any season.`) : 'Out of eligibility: the NBA Draft is next.'}
          onTransfer={canReturn ? () => openOff('transfer') : null}
          onHome={close} />
        {drafting && (
          <CBBDraft build={build} types={P.types} pos={pos} result={result} user={user} userName={userName} playerName={who} sandbox={!!result.sandbox}
            cls={cls} age={draftAge(cls)} history={history}
            onCancel={() => setDrafting(false)}
            onDone={c => { setDrafting(false); onCareer?.(c) }} />
        )}
      </>
    )
  }

  const spinEl = (
    <SpinScreen
      build={build}
      activeDrag={activeDrag}
      onDragStart={setActiveDrag}
      onDragEnd={() => setActiveDrag(null)}
      activeCategory={activeCategory}
      resetKey={spinResetKey}
      onChipTap={handleChipTap}
      types={P.types}
      qbPool={displayPool}
      savedResult={spin}
      onSaveResult={setSpin}
      onPhaseChange={setSpinPhase}
      gameKey={gameKey}
      onReset={reset}
      adsDisabled={IS_APP}
      startersOnly={startersOn}
      isBucket
      teamsPool={confs}
      group={group}
      teamLabel="CONF"
      getTeamSub={() => ''}
      logoDir="/logos/"
      playerLabel={CBB_POS[pos].label}
      headshotsMap={{}}
      headshotsDir={`${HEADSHOT_BASE}/`}
      attrMap={P.attr}
      categoriesData={P.cats}
      key={`cbb-${era}-${pos}`}
    />
  )
  // the game's build page, as BucketApp.jsx renders it: the navbar, then the one scrolling box with the
  // spin, the figure, the report card and the site's footer (on the website the two sit straight
  // in #root, its flex column: a wrapper here cut that chain and the page couldn't scroll)
  const page = (
    <>
      <CBBNav pos={pos} onHome={close} grades={drop} era={era} />
      <div className="game-page-scroll">
        {drop && <DropBar open={dropOpen} setOpen={setDropOpen} build={build} types={P.types} attrMap={P.attr}
          waiting={spin?.selectedQB?.name ?? null} complete={complete} />}
        <main className={`game-layout ${drop ? 'mobile-build ag-drop' : 'mobile-spin'}`}>
          {drop ? <DropSheet open={dropOpen} setOpen={setDropOpen}>{spinEl}</DropSheet> : spinEl}
          <Silhouette
            build={build}
            activeDrag={activeDrag}
            onDrop={handleDrop}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            types={P.types}
            onReset={reset}
            isBucket
            categoriesData={P.cats}
            attrMap={P.attr}
            isCustomMode={sandboxOn}
            onOpenCustomModal={() => setShowCustom(true)}
            onSandboxToggle={sandboxToggle}
            sandboxStarters={startersProp}
            logoDir="/logos/"
          />
          <div className="right-panel-wrap">
            <ReportCard
              build={build}
              onSimulate={onSimulate}
              onReset={reset}
              types={P.types}
              hasResult={!!result}
              isBucket
              bucketPosition={pos}
              logoDir="/logos/"
              attrMap={P.attr}
              isCustomMode={sandboxOn}
              onOpenCustomModal={() => setShowCustom(true)}
              onSandboxToggle={sandboxToggle}
              sandboxStarters={startersProp}
            />
          </div>
        </main>
        <div className="build-footer-section">
          <SiteFeatures sport="bucket" className="build-site-features" />
          <SiteFooter sport="bucket" />
        </div>
      </div>
      {IS_APP && <BuildComplete complete={complete} ovr={ovrNow} name={ovrNow ? P.arch(ovrNow, build, P.types) : null} build={build} types={P.types} attrMap={P.attr} />}
      {showCustom && sandboxOn && (
        <CustomRatingsModal isBucket storageKey={ratingsKey} gameMode="classic" attrMap={P.attr} noPicks={startersOn}
          pool={[...pool].sort((a, b) => a.school.localeCompare(b.school) || a.name.localeCompare(b.name))}
          build={build} buildTypes={P.types}
          onClose={() => setShowCustom(false)}
          onSave={r => setCustomRatings(r)}
          onAddToBuild={(p, o, type) => { tainted.current = true; setBuild(prev => ({ ...prev, [type]: addChip(p, o, type) })); setShowCustom(false) }}
          onAddAllToBuild={(p, o) => { tainted.current = true; setBuild(prev => Object.fromEntries(P.types.map(t => [t, prev[t] ?? addChip(p, o, t)]))); setShowCustom(false) }} />
      )}
    </>
  )
  return IS_APP ? <div className="ag-game-host">{page}</div> : page
}
