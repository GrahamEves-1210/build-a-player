import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import SpinScreen, { setGradesHidden, gradesHiddenNow } from '../SpinScreen'
import Silhouette from '../Silhouette'
import ReportCard from '../ReportCard'
import TeamPickerModal from '../TeamPickerModal'
import CustomRatingsModal from '../CustomRatingsModal'
import SiteFeatures from '../SiteFeatures'
import SiteFooter from '../SiteFooter'
import Disclaimer from '../Disclaimer'
import { TYPES, ATTR, CATEGORIES } from '../../data/qbs'
import { RB_TYPES, RB_ATTR } from '../../data/rbs'
import { WR_TYPES, WR_ATTR, WR_CATEGORIES } from '../../data/wrs'
import { HEADSHOT_BASE, calcOVR, calcOVRRB, calcOVRWR, getArchetype, getArchetypeRB, getArchetypeWR } from '../../utils/simulation'
import { useDropMode, useDropSheet, DropBar, DropSheet, BuildComplete } from '../app/AppBuildTray'
import { IconGear, IconClose, IconPlay } from '../app/icons'
import SoundToggle from '../app/SoundToggle'
import { IS_APP } from '../../lib/platform'
import { sfx } from '../../lib/juice'
import { getUsername } from '../../lib/discord'
import { loadCFB } from '../../lib/cfbLoad'
import { CFB_POS, classLabel, cfbLogo, cfbLogoDark, confLogo, loadProgress, saveProgress, saveSeasonLocal, seasonsLocal, summaryOf, seasonEvent, photoLookup } from './cfbShared'
import CFBSimPage from './CFBSimPage'
import CFBDraft from './CFBDraft'
import './cfb.css'

// ── College Football: a mode inside football (MORE WAYS TO PLAY). Its own screens: the position
// pick, the build (football's spin, figure, chips, report card, OVR, footer and Sandbox, on college
// rosters: a CONFERENCE wheel, then a starter from it), and the season (CFBSimPage), from which a
// build can ENTER THE NFL DRAFT as a new Career (CFBDraft), RETURN TO SCHOOL for another season or
// TRANSFER and play one somewhere else. The build has no class (no freshman or senior year): a season
// is a year, he's always draft-eligible, and going or staying is the player's call. Everything here,
// the rosters and the sim included, loads only when the mode opens (App.jsx: lazy)
const POS = {
  qb: { types: TYPES, attr: ATTR, cats: CATEGORIES, flags: {}, ovr: calcOVR, arch: getArchetype },
  wr: { types: WR_TYPES, attr: WR_ATTR, cats: WR_CATEGORIES, flags: { isWR: true }, ovr: calcOVRWR, arch: getArchetypeWR },
  rb: { types: RB_TYPES, attr: RB_ATTR, cats: undefined, flags: { isRB: true }, ovr: calcOVRRB, arch: getArchetypeRB },
}
const emptyBuild = pos => Object.fromEntries(POS[pos].types.map(t => [t, null]))
const newSeed = () => ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0) || 1

// Sandbox, the mode's own (football's switch and ratings stay football's): its switch and custom ratings
const SANDBOX_KEY = 'bap_cfb_sandbox'
const RATINGS_KEY = 'bap_cfb_custom_ratings'
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

// The build page's top bar: football's navbar, with the mode in place of the position menu
function CFBNav({ pos, onHome, grades }) {
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
          <span className="nav-pos-badge" style={{ '--pos-col': '#ffffff' }}>{CFB_POS[pos].label}</span>
          <span className="nav-pos-name">College {CFB_POS[pos].name}</span>
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
function CFBEntry({ data, progress, seasons, onPick, onResume, onClose }) {
  const resumeLine = progress && (progress.result
    ? `${CFB_POS[progress.pos].label} · ${progress.result.team?.school ?? progress.result.team?.name ?? ''} ${progress.result.cfb?.record?.final ?? `${progress.result.wins}-${progress.result.losses}`}`
    : `${CFB_POS[progress.pos].label} · ${Object.values(progress.build ?? {}).filter(Boolean).length} of ${POS[progress.pos].types.length} traits`)
  return (
    <div className="ag-screen cfb-screen cfb-entry">
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">FOOTBALL</span><h1 className="ag-h1">College Football</h1></div>
        <button className="ag-round-btn" onClick={onClose} aria-label="Home"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        {progress && (
          <button className="cfb-resume" onClick={onResume}>
            <span className="cfb-resume-ico"><IconPlay size={16} /></span>
            <span><small>{progress.result ? 'SEASON' : 'BUILD IN PROGRESS'}</small><b>{resumeLine}</b></span>
          </button>
        )}
        <h2 className="cfb-label">PICK A POSITION</h2>
        <div className="cfb-pos-row" role="list">
          {Object.entries(CFB_POS).map(([k, p]) => (
            <button key={k} role="listitem" className={`cfb-pos cfb-pos--${k}`} onClick={() => { sfx('tap'); onPick(k) }}>
              <img className="cfb-pos-fig" src={p.fig} alt="" draggable={false} />
              <span className="cfb-pos-txt"><b>{p.label}</b><small>{p.name.toUpperCase()}</small></span>
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
                <img src={cfbLogoDark(s.team)} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                <span className="cfb-past-main"><b>{s.teamName} {s.record}</b><small>{s.pos.toUpperCase()} · {s.ovr} OVR{s.finalRank ? ` · Final No. ${s.finalRank}` : ''}</small></span>
                <span className="cfb-past-tags">{s.sandbox && <i className="is-sb">SANDBOX</i>}{s.title && <i className="is-gold">NATIONAL CHAMPS</i>}{s.heisman && <i>HEISMAN</i>}{!s.title && s.cfp && <i>CFP</i>}</span>
              </div>
            ))}
          </section>
        )}
        <Disclaimer sport="cfb" className="cfb-disclaimer" />
      </div>
    </div>
  )
}

export default function CFBMode({ user, onHome, onCareer }) {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const saved = useMemo(loadProgress, [])
  const [progress, setProgress] = useState(saved)
  const [phase, setPhase] = useState('pick')   // 'pick' | 'build' | 'season'
  const [pos, setPos] = useState(saved?.pos ?? 'qb')
  const [build, setBuild] = useState(saved?.build ?? emptyBuild(saved?.pos ?? 'qb'))
  const [spin, setSpin] = useState(saved?.spin ?? null)
  const [result, setResult] = useState(saved?.result ?? null)
  const [stage, setStage] = useState(saved?.stage ?? 'pre')   // the season page it's on ('pre' … 'final'; an older save's number, CFBSimPage reads both)
  const [story, setStory] = useState(saved?.story ?? null)   // the regular season as it played out (the final report's season story)
  // the seasons this build has already played (RETURN TO SCHOOL, TRANSFER): each one's school, record, honors
  // and totals. The draft board reads his whole college career from them (cfbSimulation opts.career)
  const [history, setHistory] = useState(Array.isArray(saved?.history) ? saved.history : [])
  const [moving, setMoving] = useState(false)   // the transfer's team picker
  const [activeDrag, setActiveDrag] = useState(null)
  const [activeCategory, setActiveCategory] = useState('physical')
  const [spinResetKey, setSpinResetKey] = useState(0)
  const [gameKey, setGameKey] = useState(0)
  const [spinPhase, setSpinPhase] = useState('idle')
  const [picker, setPicker] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [seasons, setSeasons] = useState(seasonsLocal)
  // Sandbox: on for this mode, the ratings it edits, Starters Only for this build
  const [sandboxOn, setSandboxOn] = useState(() => readJSON(SANDBOX_KEY, false) === true)
  const [customRatings, setCustomRatings] = useState(() => readJSON(RATINGS_KEY, {}))
  const [showCustom, setShowCustom] = useState(false)
  const [startersPick, setStartersPick] = useState(!!saved?.starters)
  // a build that had Sandbox on at any point stays a Sandbox build until it's reset (football's rule)
  const tainted = useRef(sandboxOn || !!saved?.sandbox)
  useEffect(() => { if (sandboxOn) tainted.current = true }, [sandboxOn])
  const userName = getUsername(user) || 'Guest'
  const P = POS[pos]

  // the mode's colours: NCAA blue on its own screens only (cfb.css, html.is-cfb)
  useEffect(() => {
    document.documentElement.classList.add('is-cfb')
    return () => document.documentElement.classList.remove('is-cfb')
  }, [])
  useEffect(() => {
    let live = true
    loadCFB().then(d => { if (live) setData(d) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])

  // the college pool, as the spin reads it: the school's logo through the team field
  // (public/logos/cfb/{short}.png), the school and its conference kept beside it.
  // Starters only (the owner's rule): one per school, so a conference deals its schools' QB1s,
  // RB1s or WR1s, never a backup, respins included. (The season still plays each team's real depth)
  const teamsBy = useMemo(() => Object.fromEntries((data?.teams ?? []).map(t => [t.short, t])), [data])
  const pool = useMemo(() => (data?.pools[pos] ?? []).filter(p => p.starter === true).map(p => {
    const t = teamsBy[p.team]
    return {
      ...p,
      team: `cfb/${p.team}`, school: p.team, conf: p.conf ?? t?.conf,
      teamName: t?.name ?? p.teamName ?? p.team,
      color: p.color ?? t?.color, color2: p.color2 ?? t?.color2,
      years: classLabel(p.year),
      headshot: p.headshot ?? undefined,
    }
  }), [data, pos, teamsBy])
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
  const schools = useMemo(() => (data?.teams ?? []).map(t => ({ ...t, logo: cfbLogo(t.short) })), [data])
  // a real player's headshot by name and school (the season page's Heisman ceremony)
  const photoOf = useMemo(() => photoLookup(data?.pools, HEADSHOT_BASE), [data])

  // a chip carries the college player's school, conference, class and size with it
  const withCollege = useCallback(chip => {
    const p = byKey.get(`${chip.qbFull}|${chip.team}`)
    return { ...chip, cfb: true, school: p?.school ?? String(chip.team).replace(/^cfb\//, ''), conf: p?.conf ?? null, year: p?.year ?? null, height: chip.height ?? p?.height ?? null, weight: chip.weight ?? p?.weight ?? null }
  }, [byKey])

  // kept on the device: a reload, or Home and back, picks the build (or the season) back up
  useEffect(() => {
    if (phase === 'pick') return
    const p = { pos, build, spin, result, stage, story, history, sandbox: tainted.current, starters: startersPick, at: Date.now() }
    saveProgress(p); setProgress(p)
  }, [phase, pos, build, spin, result, stage, story, history, startersPick])

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
    setPos(p); setBuild(emptyBuild(p)); setSpin(null); setResult(null); setStage('pre'); setStory(null); setHistory([]); setActiveDrag(null)
    setActiveCategory('physical'); setSpinResetKey(k => k + 1); setGameKey(k => k + 1); setStartersPick(false)
    tainted.current = sandboxOn
  }, [sandboxOn])
  const start = p => { freshBuild(p); setPhase('build'); window.scrollTo(0, 0) }
  const resume = () => { setPhase(result ? 'season' : 'build'); window.scrollTo(0, 0) }
  const reset = useCallback(() => { freshBuild(pos); window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' }) }, [freshBuild, pos])

  // Sandbox: football's switch, Starters Only (one wheel of every starter, no conference spin) and Custom Ratings
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
  const onSimulate = () => { if (result) { setPhase('season'); window.scrollTo(0, 0); return } setPicker(true) }
  // A season at a school, simulated and booked. No class (noClass): just a year, always draft-eligible.
  // prior: the seasons he's already played (the board reads his whole college career)
  const playSeason = useCallback((team, prior = []) => {
    const seed = newSeed()
    const best = (k, order) => order.find(x => prior.some(s => s[k] === x)) ?? null
    const career = prior.length ? { seasons: prior.length, heisman: best('heisman', ['won', 'finalist']), allAmerica: best('allAmerica', ['first', 'second']), totals: prior.map(s => s.totals ?? {}) } : null
    const r = data.sim.runCFBSimulation(build, P.types, team, pos, seed, 'classic', null, { name: userName, noClass: true, ...(career ? { career } : {}) })
    r.seed = r.seed ?? seed
    const sb = tainted.current || P.types.some(t => build[t]?.sandbox)
    r.sandbox = sb
    setResult(r); setStage('pre'); setStory(null)
    // kept on this device (cfbShared saveSeasonLocal; the boards hook is there for later), and booked
    // for XP, coins and achievements the way any season is (lib/progress.js; a Sandbox season pays nothing)
    saveSeasonLocal({ ...summaryOf(r, { pos, build, types: P.types, ovr: P.ovr(build, P.types), name: P.arch(P.ovr(build, P.types), build, P.types), userName }), sandbox: sb }, sb ? null : user)
    window.dispatchEvent(new CustomEvent('bap:season', { detail: seasonEvent(r, pos, sb) }))
    setSeasons(seasonsLocal())
    setPhase('season')
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.querySelector('.simp-page')?.scrollTo({ top: 0, behavior: 'instant' })
  }, [data, build, P, pos, userName, user])
  const teamPicked = useCallback(team => { setPicker(false); setHistory([]); playSeason(team, []) }, [playSeason])
  // RETURN TO SCHOOL / TRANSFER: the season just played goes on his résumé, then another year (same build),
  // from the pre-season page, booked like any season
  const another = useCallback(team => {
    if (!result || !team) return
    const a = result.cfb?.awards ?? {}
    const prior = [...history, {
      school: result.team?.short, schoolName: result.team?.school ?? result.team?.name, record: result.cfb?.record?.final ?? `${result.wins}-${result.losses}`,
      heisman: a.heisman?.userWon ? 'won' : a.heisman?.userFinalist ? 'finalist' : null, allAmerica: a.allAmerica?.user ?? null,
      totals: Object.fromEntries(Object.entries(result.cfb?.totals?.full ?? {}).filter(([, x]) => typeof x === 'number')),
    }]
    setMoving(false); setHistory(prior); playSeason(team, prior)
  }, [result, history, playSeason])

  // phones: the player is the screen and the spin drops down over it (football's build)
  const drop = useDropMode(phase === 'build')
  const [dropOpen, setDropOpen] = useDropSheet(drop, build, P.types, spinResetKey)
  const ovrNow = complete ? P.ovr(build, P.types) : 0
  const close = () => { onHome() }

  if (phase === 'pick') {
    return <CFBEntry data={data} progress={progress} seasons={seasons} onPick={start} onResume={resume} onClose={close} />
  }
  if (!data) {
    return (
      <div className="ag-screen cfb-screen cfb-loading">
        <div className="ag-screen-head"><div><span className="ag-eyebrow">FOOTBALL</span><h1 className="ag-h1">College Football</h1></div><button className="ag-round-btn" onClick={close} aria-label="Home"><IconClose size={16} /></button></div>
        <p className="cfb-wait">{failed ? 'College Football didn\'t load. Check the connection and open it again.' : 'Loading the rosters…'}</p>
      </div>
    )
  }
  if (phase === 'season' && result) {
    return (
      <>
        {/* football's season page, page for page (the navbar over it, as App.jsx puts football's) */}
        <CFBSimPage result={result} build={build} types={P.types} attrMap={P.attr} pos={pos} userName={userName} teams={teamsBy}
          archetype={P.arch(P.ovr(build, P.types), build, P.types)}
          nav={<CFBNav pos={pos} onHome={close} grades={false} />}
          stage={stage} onStage={setStage}
          story={story} onStory={setStory} photoOf={photoOf}
          key={result.seed}
          seasonNote={history.length ? `Season ${history.length + 1} · ${history[history.length - 1].school === result.team?.short ? `back at ${result.team?.school ?? result.team?.name}` : `transferred from ${history[history.length - 1].schoolName}`}` : null}
          onAgain={() => start(pos)}
          onDraft={() => setDrafting(true)}
          onReturn={() => another(schools.find(t => t.short === result.team?.short) ?? result.team)}
          onTransfer={() => setMoving(true)}
          onHome={close} />
        {moving && <TeamPickerModal onSelect={another} onCancel={() => setMoving(false)} build={build} anyTeam teams={schools.filter(t => t.short !== result.team?.short)} teamOf={c => c.school} eyebrow="College Football · Transfer" />}
        {drafting && (
          <CFBDraft build={build} types={P.types} pos={pos} result={result} user={user} userName={userName} sandbox={!!result.sandbox}
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
      {...P.flags}
      teamsPool={confs}
      group={group}
      teamLabel="CONF"
      getTeamSub={() => ''}
      logoDir="/logos/"
      playerLabel={CFB_POS[pos].label}
      headshotsMap={{}}
      headshotsDir={`${HEADSHOT_BASE}/`}
      attrMap={P.attr}
      categoriesData={P.cats}
      key={`cfb-${pos}`}
    />
  )
  // football's build page, as App.jsx renders it: the navbar, then the one scrolling box with the
  // spin, the figure, the report card and the site's footer (on the website the two sit straight
  // in #root, its flex column: a wrapper here cut that chain and the page couldn't scroll)
  const page = (
    <>
      <CFBNav pos={pos} onHome={close} grades={drop} />
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
            {...P.flags}
            categoriesData={P.cats}
            attrMap={P.attr}
            isCustomMode={sandboxOn}
            onOpenCustomModal={() => setShowCustom(true)}
            onSandboxToggle={sandboxToggle}
            sandboxStarters={startersProp}
          />
          <div className="right-panel-wrap">
            <ReportCard
              build={build}
              onSimulate={onSimulate}
              onReset={reset}
              types={P.types}
              hasResult={!!result}
              {...P.flags}
              attrMap={P.attr}
              isCustomMode={sandboxOn}
              onOpenCustomModal={() => setShowCustom(true)}
              onSandboxToggle={sandboxToggle}
              sandboxStarters={startersProp}
            />
          </div>
        </main>
        <div className="build-footer-section">
          <SiteFeatures sport="nfl" className="build-site-features" />
          <SiteFooter sport="nfl" />
        </div>
      </div>
      {IS_APP && <BuildComplete complete={complete} ovr={ovrNow} name={ovrNow ? P.arch(ovrNow, build, P.types) : null} build={build} types={P.types} attrMap={P.attr} />}
      {picker && <TeamPickerModal onSelect={teamPicked} build={build} isPlus={sandboxOn} teams={schools} teamOf={c => c.school} eyebrow="College Football · Simulate Season" />}
      {showCustom && sandboxOn && (
        <CustomRatingsModal {...P.flags} storageKey={RATINGS_KEY} gameMode="classic" attrMap={P.attr} noPicks={startersOn}
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
