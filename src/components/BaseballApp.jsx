import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo, lazy, Suspense } from 'react'
import { Helmet } from 'react-helmet-async'
import Navbar from './Navbar'
import SpinScreen from './SpinScreen'
import Silhouette from './Silhouette'
import ReportCard from './ReportCard'
import AuthModal from './AuthModal'
import CustomRatingsModal from './CustomRatingsModal'
import SiteFooter from './SiteFooter'
import SiteFeatures from './SiteFeatures'
import './baseball.css'
const BaseballSimPage = lazy(() => import('./BaseballSimPage'))
const BaseballTeamSpin = lazy(() => import('./BaseballSimPage').then(m => ({ default: m.BaseballTeamSpin })))
const SharedBuildPage = lazy(() => import('./SharedBuildPage'))
const ProfilePage = lazy(() => import('./ProfilePage'))
const PrivacyPage = lazy(() => import('./PrivacyPage'))
const AppLeaderboards = lazy(() => import('./app/AppLeaderboards'))
// (Squad Builder's baseball rosters and engine load with it: lib/squadBaseball.js, kept out of the other sports')
const AppSquad = lazy(() => import('../lib/squadSeason').then(m => m.loadSquadBaseball?.()).then(() => import('./app/AppSquad')))
const AppCareer = lazy(() => import('./app/AppCareer'))
const CareerIntro = lazy(() => import('./app/AppCareer').then(m => ({ default: m.CareerIntro })))
const AppCompete = lazy(() => import('./app/AppCompete'))
// Salary Cap's board is its own file (components/BaseballSalaryCap.jsx, the parallel of SoccerSalaryCap): picked up
// here as soon as it exists, so the Salary Cap agent only adds the file and turns BASEBALL_MODES.salary on
const SALARY_FILE = import.meta.glob('./BaseballSalaryCap.jsx')
const BaseballSalaryCap = lazy(() => (SALARY_FILE['./BaseballSalaryCap.jsx']?.() ?? Promise.resolve({ default: () => null })))
import CompeteHud from './app/CompeteHud'
import * as MLB_ATTRS from '../data/mlb-attrs'
import { MLB_TEAMS } from '../data/mlb-teams'
import { MLB_BATTERS } from '../data/mlb-batters'
import { MLB_PITCHERS } from '../data/mlb-pitchers'
import * as LEGEND_BATTERS from '../data/mlb-legend-batters'
import * as LEGEND_PITCHERS from '../data/mlb-legend-pitchers'
// (ESPN id → headshot file: a glob, so the app runs before the photo map exists; no map, no faces)
const HS_FILE = import.meta.glob('../data/mlb-headshots.json', { eager: true, import: 'default' })
const MLB_HEADSHOTS = HS_FILE['../data/mlb-headshots.json'] ?? {}
import * as BaseballSim from '../utils/baseballSimulation'
import { HEADSHOT_BASE } from '../utils/simulation'
import { supabase, apiHeaders } from '../lib/supabase'
import { track } from '../lib/track'
import { blockReason, buildSig, markPlayed } from '../lib/saveGuard'
import { saveSeason, saveSalary } from '../lib/submit'
import { baseballModeOf, baseballRowStats, baseballAwardTags, baseballAwardName, baseballMajorAward } from '../lib/baseballAwards'
import { IS_APP, APP_LOOK, setClassicLook } from '../lib/platform'
import { restorePro } from '../lib/webCheckout'
import AppHome from './app/AppHomeSwitch'   // today's Home, or the classic one (Settings → Classic Home)
import { BuildComplete, useFlip, StackEdge, StackSeam, useDropMode, useDropSheet, DropBar, DropSheet } from './app/AppBuildTray'
import { useCompete, botBuild, competeQueue } from '../lib/compete'
import { setLiveLock, liveLock, guardLeave } from '../lib/liveLock'
import { FORFEIT_RATING, dailyState } from '../lib/progress'
import { setSandboxGate, sandboxItemFor, sandboxLocked, clearSandboxHint } from './app/AppSandbox'
import { finishDiscordSignIn, getUsername } from '../lib/discord'
import { rampPage, HOME_UNITS, RAIL_UNITS, RAIL_UNITS_WITH_LEFT } from '../lib/ads'
import { BASEBALL_SILHOUETTE, BASEBALL_POOL, BASEBALL_POS, BASEBALL_MODES, BASEBALL_KEYS, BASEBALL_CATEGORIES, BASEBALL_SLOTS, baseballPoolOf, baseballPosOf, baseballArchetype, baseballHands } from '../lib/baseballUi'
import { encodeBaseballBuild, decodeBaseballBuild } from '../lib/baseballShare'
import { switchSport } from './app/AppHome'

// ═════════════════════════════════════════════════════════════════════════════
// BASEBALL: the fourth game, at /baseball (main.jsx mounts it while lib/baseballLive.js is on).
// Built like SoccerApp, with basketball's two positions: a BATTER ('bat') or a PITCHER ('pit'), each
// player on the wheel showing his real role (C, 1B … DH; SP, RP, CL). The same pages, the same build
// screen (SpinScreen / Silhouette / ReportCard with `isBaseball`) and the same shell. Pools keep their
// keys: 'current' = 2026 MLB rosters, 'alltime' = franchise legends; the app's game modes stay
// 'classic' / 'all-time' like basketball's. One team list (data/mlb-teams.js) serves both pools.
//
// The modes still to come plug in here (lib/baseballUi.js BASEBALL_MODES says which are on):
//   Career        → openCareer / startCareerBuild / enterDraft, pages 'career-intro' 'career' 'career-build'
//                   (lib/career.js ensureSport('baseball'): lib/careerBaseball.js)
//   Compete       → useCompete (sport 'baseball', pos 'bat' | 'pit'), page 'compete', lockInCompete
//   Salary Cap    → page 'salarycap' + handleSalaryCapConfirm (picks up components/BaseballSalaryCap.jsx)
//   Squad Builder → openSquad / buildSquad / squadNext, pages 'squad' 'squad-build' (lib/squadSeason loadSquadBaseball)
//   Boards        → page 'leaderboard' (AppLeaderboards sport 'baseball') and saveBaseballSeason below
// ═════════════════════════════════════════════════════════════════════════════

// the dev server's ?baseball=1 stays on every baseball address (a reload keeps baseball on)
const Q = import.meta.env.DEV && typeof location !== 'undefined' && /[?&]baseball=1\b/.test(location.search) ? '?baseball=1' : ''
const at = path => path + Q

const RAMP_AD_UNITS = ['bottom_rail', 'corner_ad_video', 'left_rail', 'standard_iab', 'video_bottom_rail']
const RAMP_FORCE_OFF = RAMP_AD_UNITS.map(unit => ({ unit, force: 'off' }))
function enableAdFreeMode() {
  document.documentElement.classList.add('ads-hidden')
  window.ramp = window.ramp || {}
  window.ramp.forceUnits = RAMP_FORCE_OFF
  window.ramp.que = window.ramp.que || []
  window.ramp.que.push(() => { window.ramp.forceUnits = RAMP_FORCE_OFF; try { window.ramp.destroyUnits('all') } catch {} })
  const hide = () => {
    document.querySelectorAll('[id^="pw-"],[id^="ramp-"],[class^="pw-"],[id^="adBanner"],[id*="bottom_rail"],[class*="bottom_rail"],[id*="video-bottom"],[class*="video-bottom"],[data-pw-desk-top],[data-pw-moat],.square-ad').forEach(el => {
      el.style.setProperty('display', 'none', 'important')
    })
  }
  hide()
  new MutationObserver(hide).observe(document.body, { childList: true, subtree: true })
}
const START_ON_SALARY = window.location.pathname === '/baseball/salary'
try { if (IS_APP || localStorage.getItem('bap_subscribed') === '1' || localStorage.getItem('bap_ads_off') === '1') enableAdFreeMode() } catch {}

// ── The rosters ──────────────────────────────────────────────────────────────
// The 30 clubs by their code (both pools: a legend plays for his franchise). A player's photo is his ESPN
// headshot (data/mlb-headshots.json); no photo, no face (the cap logo and the name carry it).
const TYPES_OF = { bat: MLB_ATTRS.BAT_TYPES ?? BASEBALL_KEYS.bat, pit: MLB_ATTRS.PIT_TYPES ?? BASEBALL_KEYS.pit }
const CATS_OF = { bat: MLB_ATTRS.BAT_CATEGORIES ?? BASEBALL_CATEGORIES.bat, pit: MLB_ATTRS.PIT_CATEGORIES ?? BASEBALL_CATEGORIES.pit }
const ATTR = MLB_ATTRS.MLB_ATTR ?? {}
const TEAM_MAP = Object.fromEntries(MLB_TEAMS.map(t => [t.short, t]))
const LOGO_DIR = '/logos/mlb/'
const arrOf = (m, name) => m[name] ?? Object.values(m).find(v => Array.isArray(v)) ?? []
const hsKey = p => {
  const f = p?.espn != null ? MLB_HEADSHOTS[String(p.espn)] : null
  return f ? String(f).replace(/\.(webp|png|jpe?g)$/i, '') : null
}
const baseballPhoto = p => { const k = p?.headshot ?? hsKey(p); return k ? `${HEADSHOT_BASE}/${k}.webp` : null }
function enrich(p, pool, pos) {
  const t = TEAM_MAP[p.team]
  return {
    ...p,
    color: t?.color ?? '#888888', color2: t?.color2 ?? '#444444', teamName: p.club ?? t?.name ?? p.team,   // (a legend under the name he played for: Brooklyn Dodgers)
    // the wheel shows his real role (C … DH, SP / RP / CL); the build is a batter or a pitcher
    position: p.role ?? (pos === 'pit' ? 'P' : null), buildPos: pos, skin: p.skin ?? null, faceCenter: p.faceCenter ?? null,
    headshot: hsKey(p), pool,
  }
}
const POOL_PLAYERS = {
  bat: { current: MLB_BATTERS.map(p => enrich(p, 'current', 'bat')), alltime: arrOf(LEGEND_BATTERS, 'MLB_LEGEND_BATTERS').map(p => enrich(p, 'alltime', 'bat')) },
  pit: { current: MLB_PITCHERS.map(p => enrich(p, 'current', 'pit')), alltime: arrOf(LEGEND_PITCHERS, 'MLB_LEGEND_PITCHERS').map(p => enrich(p, 'alltime', 'pit')) },
}
const _dedup = arr => { const s = new Set(); return arr.filter(p => { const k = `${p.name}|${p.team}`; if (s.has(k)) return false; s.add(k); return true }) }
const _byTeam = (a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name)
const CUSTOM_POOLS = Object.fromEntries(['bat', 'pit'].map(pos => [pos, { current: _dedup(POOL_PLAYERS[pos].current).sort(_byTeam), alltime: _dedup(POOL_PLAYERS[pos].alltime).sort(_byTeam) }]))
// the jersey: the club's name as it's sewn on ("YANKEES", "RED SOX")
const TWO_WORD = /\s(Red Sox|White Sox|Blue Jays)$/
const nickOf = t => (t ? String(t.nick ?? t.kit ?? (TWO_WORD.exec(t.name)?.[1] ?? String(t.name).split(' ').slice(-1)[0])).toUpperCase() : null)
const kitNick = chip => nickOf(TEAM_MAP[chip?.team]) ?? chip?.team ?? null
const teamSub = t => nickOf(t) ?? t.name
// the player reel's second line: his last name and his real role ("Judge · RF", "Skenes · SP")
const playerSub = q => [q.name.split(' ').slice(1).join(' '), q.role].filter(Boolean).join(' · ')

// OVR and the build's name (the sim's own, when it has one)
const ovrOf = (b, types, pos) => Math.round(BaseballSim.calcBaseballOVR?.(b, types, pos) ?? 0)
const archFor = pos => (ovr, b, types) => (BaseballSim.getBaseballArchetype ?? baseballArchetype)(ovr, b, types, pos)

// a player as a build chip (Custom Ratings, the shared link): the photo, the hands and the size come with him
const chipOf = (p, slot, val, extra = {}) => ({
  type: slot, val, qb: p.short || p.name, qbFull: p.name, team: p.team,
  teamColor: p.color, teamColor2: p.color2, skinColor: p.skin, number: p.number, faceCenter: p.faceCenter,
  photo: baseballPhoto(p), captain: false, height: p.height ?? null, weight: p.weight ?? null,
  ...(p.role ? { role: p.role } : {}), ...(p.bats ? { bats: p.bats } : {}), ...(p.throws ? { throws: p.throws } : {}),
  ...extra,
})

// Home's pool cards: the best-known players in each pool with an ESPN photo, per position
const FACE_PICKS = {
  bat: { current: ['Aaron Judge', 'Shohei Ohtani', 'Juan Soto', 'Bobby Witt Jr.', 'Mookie Betts', 'Cal Raleigh'], alltime: ['Ken Griffey Jr.', 'Derek Jeter', 'Albert Pujols', 'Miguel Cabrera', 'David Ortiz', 'Ichiro Suzuki'] },
  pit: { current: ['Tarik Skubal', 'Paul Skenes', 'Zack Wheeler', 'Garrett Crochet', 'Yoshinobu Yamamoto', 'Chris Sale'], alltime: ['Clayton Kershaw', 'Justin Verlander', 'Max Scherzer', 'Mariano Rivera', 'Felix Hernandez', 'Roy Halladay'] },
}
function avgAttr(p) { const v = Object.values(p.attrs ?? {}); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0 }
const HOME_FACES = Object.fromEntries(['bat', 'pit'].map(pos => [pos, Object.fromEntries(['current', 'alltime'].map(k => {
  const list = POOL_PLAYERS[pos][k]
  const named = FACE_PICKS[pos][k].map(n => list.find(p => p.name === n && p.headshot)).filter(Boolean)
  const rest = [...list].filter(p => p.headshot && !named.includes(p)).sort((a, b) => avgAttr(b) - avgAttr(a))
  return [k, [...named, ...rest].slice(0, 3).map(p => ({ id: p.headshot, color: p.color }))]
}))]))

// ── Home's figure: the trait groups, colour by colour, falling into the silhouette ──
// One band per group (the build screen's tabs), not one per trait: ten bands on the basketball body put words on
// the head and across the gap between the legs, clipped. Each group's colour is one of its own traits' (lib
// data/mlb-attrs.js hex), so the figure stays many-coloured like the other sports'. Each word sits where the
// body is widest in its band: the chest and the top of the shorts (the waist is too narrow for a word, and the legs part inside the shorts); off: how far down the band its word sits, in ems. sm: an 8-letter word
const SPLASH_GROUPS = {
  bat: [
    { label: 'Mental', col: '#818cf8', flex: 40, at: 'end' },
    { label: 'Hitting', col: '#f87171', flex: 10, at: 'center', sm: true },
    { label: 'Athletic', col: '#4ade80', flex: 50, at: 'start', sm: true, off: 1.25 },
  ],
  pit: [
    { label: 'Mental', col: '#818cf8', flex: 34, at: 'end' },
    { label: 'Command', col: '#60a5fa', flex: 10, at: 'center', xs: true },   // (the chest holds the long word a size
    { label: 'Stuff', col: '#fb7185', flex: 10, at: 'center' },               //  down, the waist the short one)
    { label: 'Physical', col: '#fb923c', flex: 46, at: 'start', sm: true, off: .5 },
  ],
}
const SPLASH_ATTRS = SPLASH_GROUPS
function useRevealOnMount(ready) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { if (!ready) return; const t = setTimeout(() => setVisible(true), 360); return () => clearTimeout(t) }, [ready])
  return visible
}
function BaseballStackedSilhouette({ pos, ready, fast = false }) {
  const visible = useRevealOnMount(ready)
  const attrs = SPLASH_ATTRS[baseballPosOf(pos)]
  return (
    <div className="splash-stack-figure" style={{ WebkitMaskImage: `url(${BASEBALL_SILHOUETTE.src})`, maskImage: `url(${BASEBALL_SILHOUETTE.src})` }}>
      {attrs.map((a, i) => (
        <div key={a.label} className="splash-stack-band" style={{
          background: a.col, flex: a.flex, alignItems: a.at === 'end' ? 'flex-end' : a.at === 'start' ? 'flex-start' : 'center', opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : `translateY(-${i * 100}%)`,
          transitionDelay: visible ? `${(attrs.length - 1 - i) * (fast ? 24 : 170)}ms` : '0ms',
        }}>
          <span className={`splash-stack-band-label bb-band-label${a.sm ? ' is-sm' : a.xs ? ' is-xs' : ''}`} style={a.off ? { marginTop: `${a.off}em` } : undefined}>{a.label}</span>
        </div>
      ))}
    </div>
  )
}
const renderBaseballFigure = (pos, ready, fast) => (
  <>
    <img src={BASEBALL_SILHOUETTE.src} className="splash-figure" alt="" draggable={false} style={{ position: 'absolute', inset: 0 }} />
    <BaseballStackedSilhouette key={pos} pos={pos} ready={ready} fast={fast} />
  </>
)

// ── The classic look (Settings → Classic look): the old splash, baseball's way ──
function BaseballSplash({ onStart }) {
  const [phase, setPhase] = useState(0)
  const [pos, setPos] = useState(() => { try { return baseballPosOf(localStorage.getItem('baseballPosition')) } catch { return 'bat' } })
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 80), t2 = setTimeout(() => setPhase(2), 420), t3 = setTimeout(() => setPhase(3), 800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])
  const go = mode => { try { localStorage.setItem('baseballPosition', pos) } catch {}; onStart(mode, pos) }
  return (
    <div className={`splash-screen bucket-splash baseball-splash ${phase >= 1 ? 'splash-in' : ''}`}>
      <div className="splash-hero">
        <h1 className="sr-only">Build-A-Player Baseball: Build a Batter or a Pitcher</h1>
        <div className="splash-header" style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'none' : 'translateY(-28px)' }}>
          <img src="/bap-mark.webp" alt="Build-A-Player" className="splash-logo-mark" draggable={false} />
          <div className="splash-title splash-title--small">BUIL<span className="logo-d">D</span><em>-<span className="logo-a">A</span>-</em>PLAYER</div>
          <div className="splash-pos-toggle" style={{ opacity: phase >= 3 ? 1 : 0 }}>
            {['bat', 'pit'].map(p => (
              <button key={p} className={`splash-pos-btn${pos === p ? ' splash-pos-btn--active' : ''}`} onClick={() => setPos(p)}>
                {BASEBALL_POS[p].label}<span className="splash-pos-sub">{BASEBALL_POS[p].sub}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="splash-figure-wrap bucket-figure-wrap" style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? 'none' : 'translateY(40px) scale(0.92)' }}>
          <div className="splash-figure-parallax">{renderBaseballFigure(pos, phase >= 3, false)}</div>
        </div>
        <div className="splash-footer" style={{ opacity: phase >= 3 ? 1 : 0 }}>
          <div className="splash-modes">
            <button className="splash-mode-classic" onClick={() => go('classic')}>
              <div className="smode-title">Current</div>
              <div className="smode-badge">{BASEBALL_POOL.current.line}</div>
              <div className="smode-cta">START DRAFTING
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </div>
            </button>
            <div className="splash-modes-secondary">
              <button className="splash-mode-alltime" onClick={() => go('all-time')}>
                <div className="smode-title">All-Time</div>
                <div className="smode-badge">{BASEBALL_POOL.alltime.line}</div>
              </button>
              {BASEBALL_MODES.salary && (
                <button className="splash-mode-salarycap" onClick={() => go('salarycap')}>
                  <div className="smode-daily-banner">DAILY</div>
                  <div className="smode-title">Salary Cap</div>
                  <div className="smode-badge">Build on a budget</div>
                </button>
              )}
            </div>
          </div>
          <button className="splash-minigame-btn splash-minigame-btn--player" onClick={() => switchSport('nfl')}>
            <div className="splash-xlink-logo">BUIL<span className="splash-xlink-d">D</span><em className="splash-xlink-em splash-xlink-em--player">-<span className="splash-xlink-a">A</span>-</em>PLAYER</div>
            <div className="splash-mg-sub">FOOTBALL BUILDER</div>
          </button>
          {!IS_APP && !APP_LOOK && <button className="splash-newlook" onClick={() => setClassicLook(false)}>Switch to the new look</button>}
        </div>
      </div>
      <SiteFeatures sport="baseball" />
      <SiteFooter sport="baseball" />
    </div>
  )
}

// A mode that's wired but not built for baseball yet (BASEBALL_MODES): its name and where it stands
function BaseballSoon({ title, onBack }) {
  return (
    <div className="ag-screen ag-screen--baseball bb-soon">
      <div className="bb-soon-inner">
        <span className="bb-soon-tag">BASEBALL · COMING SOON</span>
        <h1 className="bb-soon-title">{title}</h1>
        <button className="bb-soon-back" onClick={onBack}>BACK TO HOME</button>
      </div>
    </div>
  )
}

// /baseball's search and link-preview tags (scripts/prerender-baseball.mjs bakes the same into baseball.html)
const BASEBALL_TITLE = 'Build-A-Player Baseball: Build a Batter or Pitcher — MLB Player Creator & Simulator'
const BASEBALL_DESC = 'Build a baseball player — spin the wheel to make your own hitter or pitcher from real MLB players and franchise legends, then play a 162-game season, chase the MVP and the Cy Young, and win the World Series. Free baseball player creator.'
const baseballHead = (
  <Helmet>
    <title>{BASEBALL_TITLE}</title>
    <meta name="description" content={BASEBALL_DESC} />
    <meta name="keywords" content="build a baseball player, create a baseball player, mlb player creator, baseball player builder, pitcher builder, baseball simulator, mlb season simulator, world series game" />
    <link rel="canonical" href="https://build-a-player.com/baseball" />
    <meta property="og:title" content={BASEBALL_TITLE} />
    <meta property="og:description" content={BASEBALL_DESC} />
    <meta property="og:url" content="https://build-a-player.com/baseball" />
  </Helmet>
)

// A shared baseball build (/baseball?b=…), read once at load
const SHARED = (() => {
  try { const b = new URLSearchParams(window.location.search).get('b'); return b ? decodeBaseballBuild(b, POOL_PLAYERS, (p, t, v) => chipOf(p, t, v)) : null } catch { return null }
})()

// ── The season's save ─────────────────────────────────────────────────────────
// The row for the boards (lib/baseballAwards.js says which column holds what: game_mode 'baseball-classic' /
// 'baseball-all-time', position 'bat' / 'pit', the awards as season_award tags). Off until BASEBALL_MODES.boards:
// the live worker checks it with baseball's kit (lib/baseballKits.js, the worker only) and needs its redeploy,
// and the database its SQL, before it's taken.
function baseballSeasonRow({ result, user, build, types, pool, pos }) {
  return {
    user_id: user.id, username: getUsername(user),
    ovr: result.ovr, archetype: archFor(pos)(result.ovr, build, types),
    game_mode: baseballModeOf(pool), position: pos,
    ...baseballRowStats(result, pos),
    team_short: result.team?.short ?? null,
    build: Object.fromEntries(types.filter(t => build[t]).map(t => [t, { qb: build[t].qbFull, team: build[t].team, val: build[t].val, number: build[t].number ?? null }])),
  }
}
function saveBaseballSeason(args) {
  if (!BASEBALL_MODES.boards) return
  const row = baseballSeasonRow(args)
  saveSeason('baseball', args.pos, args.gameMode || 'classic', row)
    .then(({ error }) => { if (error && error.code !== '23505') console.error('[baseball save]', error.code, error.message) })
}

// (only the component is exported, so Fast Refresh keeps the game's state when the data or the sim changes)
// ─── BaseballApp ──────────────────────────────────────────────────────────────
export default function BaseballApp() {
  const [page, setPage]               = useState(SHARED ? 'shared' : 'splash')
  const [gameMode, setGameMode]       = useState(null)   // 'classic' (Current) | 'all-time' | 'salarycap'
  const [position, setPosition]       = useState(() => { try { return baseballPosOf(localStorage.getItem('baseballPosition')) } catch { return 'bat' } })
  const pool = baseballPoolOf(gameMode)
  const [build, setBuild]             = useState({})
  const figureRef = useRef(null)
  const [activeDrag, setActiveDrag]   = useState(null)
  const [activeCategory, setActiveCategory] = useState(() => CATS_OF.bat[0].id)
  const [spinResetKey, setSpinResetKey] = useState(0)
  const [gameKey, setGameKey]         = useState(0)
  const [mobileView, setMobileView]   = useState('spin')
  const [user, setUser]               = useState(null)
  // Signing out while on the profile page: go Home, never fall through to whatever page sits under it
  const hadUserRef = useRef(false)
  useLayoutEffect(() => {
    if (user) { hadUserRef.current = true; return }
    if (hadUserRef.current && page === 'profile') {
      if (window.location.pathname.endsWith('/profile')) window.history.replaceState({}, '', window.location.pathname.slice(0, -8) || '/')
      setPage('splash')
    }
  }, [user, page])
  const [adsDisabled, setAdsDisabled] = useState(IS_APP)
  const [isSubscribed, setIsSubscribed] = useState(() => { try { return localStorage.getItem('bap_subscribed') === '1' } catch { return false } })
  const [showAuth, setShowAuth]       = useState(false)
  const [spinPhase, setSpinPhase]     = useState('idle')
  const [showTeamSpin, setShowTeamSpin] = useState(false)
  const [simResult, setSimResult]     = useState(null)
  const [simInitialScreen, setSimInitialScreen] = useState(0)
  const [salaryReturnDate, setSalaryReturnDate] = useState(null)   // Salary Cap reopens on the date just played
  const [savedSpinResult, setSavedSpinResult] = useState(() => {
    try { const r = JSON.parse(localStorage.getItem('bbb_spin_result')); return r?.starters ? null : r } catch { return null }
  })
  const [isCustomMode, setIsCustomMode] = useState(() => { try { return localStorage.getItem('bbb_custom_mode') === '1' } catch { return false } })
  const [customRatings, setCustomRatings] = useState(() => { try { return JSON.parse(localStorage.getItem('bbb_baseball_custom_ratings') || '{}') } catch { return {} } })
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [startersPick, setStartersPick] = useState(false)
  const [squad, setSquad] = useState(null)
  const squadRef = useRef(null); squadRef.current = squad
  const lastPlayRef = useRef(null)
  const activeDragRef = useRef(activeDrag)
  useLayoutEffect(() => { activeDragRef.current = activeDrag }, [activeDrag])

  const activeTypes = TYPES_OF[position]
  const activeCategories = CATS_OF[position]
  const calcOvr = useCallback((b, types) => ovrOf(b, types, position), [position])
  const archOf = useMemo(() => archFor(position), [position])
  const posMeta = BASEBALL_POS[position]
  const slots = BASEBALL_SLOTS[position]

  // once Sandbox is on in a build, the build stays marked until a reset (no toggle-off-and-save)
  const sandboxTainted = useRef(isCustomMode)
  useEffect(() => { if (isCustomMode) { sandboxTainted.current = true; clearSandboxHint() } }, [isCustomMode])

  // the rubber-band bounce only at the bottom of the build screen's scroll (as BucketApp)
  useEffect(() => {
    let startY = 0
    const onTouchStart = e => { startY = e.touches[0].clientY }
    const onTouchMove = e => {
      const el = e.target.closest?.('.game-page-scroll')
      if (!el) return
      if (e.touches[0].clientY - startY < 0 && el.scrollHeight - el.scrollTop - el.clientHeight <= 1) e.preventDefault()
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => { document.removeEventListener('touchstart', onTouchStart); document.removeEventListener('touchmove', onTouchMove) }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-sport', 'baseball')
    return () => document.documentElement.removeAttribute('data-sport')
  }, [])

  // the old website's bottom rail: its height into --ad-h (the new look measures --web-rail in AppTabBar)
  useEffect(() => {
    const root = document.documentElement
    let elObs = null
    const measure = () => {
      const el = document.querySelector('[id^="pw-oop"][data-pw-status="loaded"]')
      if (!el) { root.style.removeProperty('--ad-h'); return }
      const cs = window.getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') { root.style.setProperty('--ad-h', '0px'); return }
      let h = el.getBoundingClientRect().height
      if (h < 4) for (const c of el.querySelectorAll('iframe, div')) h = Math.max(h, c.getBoundingClientRect().height)
      const extra = h > 4 ? Math.max(0, Math.ceil(h) - 50) : 0
      if (extra > 0) root.style.setProperty('--ad-h', `${extra}px`); else root.style.removeProperty('--ad-h')
    }
    const attach = () => {
      elObs?.disconnect(); elObs = null
      const el = document.querySelector('[id^="pw-oop"][data-pw-status="loaded"]')
      if (el) { elObs = new MutationObserver(measure); elObs.observe(el, { attributes: true, attributeFilter: ['style', 'class'] }) }
    }
    measure()
    const bodyObs = new MutationObserver(() => { attach(); measure() })
    bodyObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-pw-status'] })
    return () => { bodyObs.disconnect(); elObs?.disconnect() }
  }, [])

  // back / forward between the baseball addresses
  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname
      if (path !== '/profile') setPage(p => (p === 'profile' ? 'game' : p))
      if (path !== '/baseball/simulate') setPage(p => (p === 'sim' ? 'game' : p))
      if (path !== '/baseball/leaderboard') setPage(p => (p === 'leaderboard' ? (IS_APP || APP_LOOK ? 'splash' : 'game') : p))
      if (path === '/baseball/salary') setPage(p => (p === 'splash' ? p : 'salarycap'))
      else setPage(p => (p === 'salarycap' ? 'splash' : p))
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // each page has its own address under /baseball (the ads follow the path; a refresh lands back in baseball)
  useEffect(() => {
    const target = page === 'sim' ? '/baseball/simulate' : page === 'leaderboard' ? '/baseball/leaderboard' : page === 'salarycap' ? '/baseball/salary' : null
    const here = window.location.pathname
    if (target) { if (here !== target) window.history.pushState({}, '', at(target)) }
    else if (['/baseball/simulate', '/baseball/leaderboard', '/baseball/salary'].includes(here) || (page !== 'profile' && here === '/profile') || (page !== 'shared' && new URLSearchParams(window.location.search).has('b'))) {
      window.history.replaceState({}, '', at('/baseball'))
    }
  }, [page])

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', page === 'splash' ? '#0b1220' : '#0a0f1a')
  }, [page])

  // the dock (AppTabBar): which page this is, and its taps
  useEffect(() => {
    if (!IS_APP && !APP_LOOK) return
    window.__bapPage = { page, sport: 'baseball' }
    window.dispatchEvent(new CustomEvent('bap:page', { detail: window.__bapPage }))
    if (['game', 'sim', 'salarycap', 'squad', 'squad-build', 'career', 'career-build'].includes(page)) lastPlayRef.current = page
  }, [page])
  const handleStartRef = useRef(null)
  const positionRef = useRef(position); positionRef.current = position
  useEffect(() => {
    if (!IS_APP && !APP_LOOK) return
    const onNav = e => {
      if (liveLock() && String(e.detail).split(':')[0] !== 'play') { guardLeave(() => onNav(e)); return }
      const to = e.detail
      if (to === 'home') setPage('splash')
      else if (to === 'play') {
        if (['game', 'sim', 'salarycap', 'squad', 'squad-build', 'career', 'career-build'].includes(page)) return
        const last = lastPlayRef.current
        if (last === 'squad' && squadRef.current) setPage('squad')
        else if (last === 'squad-build' && gameMode) setPage('squad-build')
        else if (last === 'career' && careerRef.current) setPage('career')
        else if (last === 'career-build' && gameMode) setPage('career-build')
        else if (gameMode) setPage(gameMode === 'salarycap' ? 'salarycap' : 'game')
        else handleStartRef.current?.('classic', positionRef.current)
      } else if (String(to).startsWith('mode:')) handleStartRef.current?.(String(to).slice(5), positionRef.current)
      else if (to === 'leaderboard') setPage('leaderboard')
      else if (to === 'salarycap') handleStartRef.current?.('salarycap', positionRef.current)
      else if (to === 'squad') openSquadRef.current?.()
      else if (to === 'career') openCareerRef.current?.()
      else if (to === 'profile') { if (user) { window.history.pushState({}, '', '/profile'); setPage('profile') } else window.dispatchEvent(new CustomEvent('bap:auth')) }
      else if (to === 'about') window.location.href = '/?about'
      else if (to === 'wiki') window.location.href = '/wiki'
      else if (to === 'compete') setPage('compete')
      // the Daily Challenge is a football or basketball day: it opens on its own side
      else if (to === 'daily-challenge') window.location.href = dailyState().sport === 'bucket' ? '/bucket?daily=1' : '/?daily=1'
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('bap:nav', onNav)
    return () => window.removeEventListener('bap:nav', onNav)
  }, [page, gameMode, user])

  // ads on every page change (lib/ads.js), the paths under /baseball like basketball's under /bucket
  useLayoutEffect(() => {
    if (page === 'splash') { rampPage({ ads: HOME_UNITS, path: '/baseball' }); return }
    const here = window.location.pathname
    const path = page === 'sim' ? '/baseball/simulate' : page === 'salarycap' ? '/baseball/salary' : page === 'leaderboard' ? '/baseball/leaderboard'
      : ['/baseball/simulate', '/baseball/leaderboard', '/baseball/salary'].includes(here) ? '/baseball' : here
    rampPage({ ads: page === 'sim' || page === 'salarycap' ? RAIL_UNITS_WITH_LEFT : RAIL_UNITS, path })
  }, [page])

  // the account, and Pro / ad-free from it (as BucketApp)
  useEffect(() => {
    if (!supabase) return
    const adFreeReturn = new URLSearchParams(window.location.search).get('ad_free') === '1'
    if (adFreeReturn) window.history.replaceState({}, '', window.location.pathname)
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (!u) { try { localStorage.removeItem('bap_subscribed'); localStorage.removeItem('bap_ads_off') } catch {}; return }
      let attempts = 0
      const check = () => supabase.from('accounts').select('ads_disabled,subscription_status').eq('id', u.id).single()
        .then(({ data: p }) => {
          if (adFreeReturn && !p?.ads_disabled && p?.subscription_status !== 'active') { if (++attempts < 10) setTimeout(check, 2000); else restorePro() }
          if (p?.ads_disabled || p?.subscription_status === 'active') { setAdsDisabled(true); enableAdFreeMode() }
          try { if (p?.ads_disabled) localStorage.setItem('bap_ads_off', '1'); else localStorage.removeItem('bap_ads_off') } catch {}
          if (p?.subscription_status === 'active') { setIsSubscribed(true); try { localStorage.setItem('bap_subscribed', '1') } catch {} }
          else { try { localStorage.removeItem('bap_subscribed') } catch {} }
        })
      check()
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      finishDiscordSignIn(session).then(u => { if (u) setUser(u) })
    })
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => { if (IS_APP || APP_LOOK) window.dispatchEvent(new CustomEvent('bap:pro')) }, [isSubscribed])

  useEffect(() => {
    try { if (savedSpinResult) localStorage.setItem('bbb_spin_result', JSON.stringify(savedSpinResult)); else localStorage.removeItem('bbb_spin_result') } catch {}
  }, [savedSpinResult])

  const buildCompleteTracked = useRef(false)
  useEffect(() => {
    const complete = activeTypes.every(t => build[t])
    if (complete && !buildCompleteTracked.current) { buildCompleteTracked.current = true; track('build_complete', { app: 'baseball', position, gameMode }) }
    else if (!complete) buildCompleteTracked.current = false
  }, [build, activeTypes, gameMode, position])

  // phones: the player is the screen and the spin drops down over it; the app flips Spin and Build
  const buildPage = page === 'game' || page === 'squad-build' || page === 'career-build'
  const drop = useDropMode((IS_APP || APP_LOOK) && gameMode !== 'salarycap' && buildPage)
  const [dropOpen, setDropOpen] = useDropSheet(drop, build, activeTypes, spinResetKey)
  const flip = useFlip(IS_APP && !drop && buildPage, mobileView, setMobileView)
  const buildComplete = activeTypes.every(t => build[t])
  useEffect(() => { if (IS_APP && buildComplete && buildPage) flip('build') }, [buildComplete]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!IS_APP && buildComplete && buildPage) window.__bapJuice?.sfx('complete', 2) }, [buildComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSandboxToggle = useCallback(on => { try { localStorage.setItem('bbb_custom_mode', on ? '1' : '0') } catch {}; setIsCustomMode(on) }, [])
  useEffect(() => { if (isCustomMode && sandboxLocked(page)) handleSandboxToggle(false) }, [page]) // eslint-disable-line react-hooks/exhaustive-deps
  setSandboxGate(sandboxItemFor(page))

  // Custom Ratings' keys: each position and pool its own ('baseball_bat', 'baseball_pit_legends' …)
  const ratingsKey = useCallback((pos, era) => `baseball_${pos}${era === 'all-time' || era === 'alltime' ? '_legends' : ''}`, [])
  // the pool the spins deal from: the position's players in this pool, with Sandbox's edits on top
  const currentPool = useMemo(() => {
    const base = POOL_PLAYERS[position][pool]
    if (!isCustomMode) return base
    const overrides = customRatings[ratingsKey(position, pool)] || {}
    if (!Object.keys(overrides).length) return base
    return base.map(p => { const o = overrides[`${p.name}|${p.team}`]; return o ? { ...p, attrs: { ...p.attrs, ...o } } : p })
  }, [position, pool, isCustomMode, customRatings, ratingsKey])

  const handleStart = useCallback((mode, pos0 = positionRef.current) => {
    const pos = baseballPosOf(pos0)
    if (mode === 'salarycap' && !BASEBALL_MODES.salary) { setGameMode(null); setPage('soon-salary'); return }
    if (IS_APP || APP_LOOK) { setSimResult(null); setSavedSpinResult(null); setMobileView('spin'); setSpinResetKey(k => k + 1); setGameKey(k => k + 1) }
    setGameMode(mode)
    setPosition(pos)
    try { localStorage.setItem('baseballPosition', pos) } catch {}
    setBuild(Object.fromEntries(TYPES_OF[pos].map(t => [t, null])))
    setActiveCategory(CATS_OF[pos][0].id)
    sandboxTainted.current = isCustomMode
    setStartersPick(false)
    try { localStorage.setItem('baseballPool', mode === 'all-time' ? 'all-time' : 'classic') } catch {}
    setPage(mode === 'salarycap' ? 'salarycap' : 'game')
    window.scrollTo(0, 0)
  }, [isCustomMode])
  handleStartRef.current = handleStart

  // ── COMPETE (when BASEBALL_MODES.compete): five-player pools on the same spins (lib/compete.js) ──
  // a queue per position and pool, the last one picked remembered
  const [competeQ, setCompeteQRaw] = useState(() => { try { return JSON.parse(localStorage.getItem('baseballCompete')) ?? { pos: 'bat', mode: 'current' } } catch { return { pos: 'bat', mode: 'current' } } })
  const setCompeteQ = q => { setCompeteQRaw(q); try { localStorage.setItem('baseballCompete', JSON.stringify(q)) } catch {} }
  const cp = useCompete({
    enabled: (IS_APP || APP_LOOK) && BASEBALL_MODES.compete, user, sport: 'baseball', pos: competeQ.pos, mode: competeQ.mode,
    botFor: (seed, idx, skill) => botBuild({ seed, idx, skill, teams: MLB_TEAMS, pool: POOL_PLAYERS[competeQ.pos].current, types: TYPES_OF[competeQ.pos], calcOvr: b => ovrOf(b, TYPES_OF[competeQ.pos], competeQ.pos) }),
  })
  const competeOn = BASEBALL_MODES.compete && cp.phase === 'build' && !cp.results[cp.me.vid]
  const competeKey = useRef(null)
  useEffect(() => {
    if (!competeOn || !cp.match || competeKey.current === cp.match.code) return
    competeKey.current = cp.match.code
    try { localStorage.setItem('bbb_custom_mode', '0') } catch {}
    setIsCustomMode(false)
    handleStart(cp.match.mode === 'alltime' ? 'all-time' : 'classic', cp.match.pos ?? competeQ.pos)
    sandboxTainted.current = false
  }, [competeOn, cp.match?.code]) // eslint-disable-line react-hooks/exhaustive-deps
  const lockInCompete = useCallback(() => {
    cp.submit(calcOvr(build, activeTypes), build)
    setGameMode(null); setBuild({}); setSavedSpinResult(null)
    setPage('compete')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [build, activeTypes, cp, calcOvr])
  const seedBuildRef = useRef(null); seedBuildRef.current = build
  const nextSeedSpin = useCallback(() => 1 + Math.max(-1, ...Object.values(seedBuildRef.current || {}).filter(Boolean).map(c => (Number.isInteger(c.spin?.i) ? c.spin.i : -1))), [])
  const competePlan = useMemo(() => (competeOn && cp.match ? { seed: cp.match.seed, getStart: nextSeedSpin, onSpin: () => {}, separateRespins: true, respinSeed: `${cp.match.seed}:${cp.me.vid}` } : null), [competeOn, cp.match?.code]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!competeOn) return
    setLiveLock({
      title: 'Leave the pool?',
      body: `The pool plays on without you. You finish last: ${FORFEIT_RATING} rating, no XP or coins, and it counts as a loss.`,
      forfeit: () => { cp.forfeit(); setGameMode(null); setBuild({}); setSavedSpinResult(null) },
    })
    return () => setLiveLock(null)
  }, [competeOn]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── SQUAD BUILDER (when BASEBALL_MODES.squad): lib/squad.js with sport 'baseball' ──
  const openSquadRef = useRef(null)
  const squadBuilding = useRef(null)
  const [squadPick, setSquadPick] = useState(false)
  const squadLib = useRef(null)
  useEffect(() => {
    if (!(IS_APP || APP_LOOK) || !BASEBALL_MODES.squad) return
    let live = true
    import('../lib/squad').then(m => {
      squadLib.current = m
      if (!live) return
      setSquad(m.loadSquad('baseball', user?.id))
      if (user?.id) m.syncSquadFromCloud('baseball', user.id).then(sq => { if (live) setSquad(sq) })
    })
    return () => { live = false }
  }, [user?.id])
  const putSquad = useCallback(sq => { setSquad(sq); if (sq) squadLib.current?.saveSquad(sq); else squadLib.current?.clearSquad('baseball', user?.id) }, [user?.id])
  const openSquad = useCallback(() => { setPage(BASEBALL_MODES.squad ? 'squad' : 'soon-squad'); window.scrollTo({ top: 0, behavior: 'instant' }) }, [])
  openSquadRef.current = openSquad
  // (each slot is a batter or a pitcher: slot.pos)
  const startSquadBuild = useCallback((slot, sq = squadRef.current) => {
    handleStart(sq?.pool === 'alltime' ? 'all-time' : 'classic', slot.pos)
    squadBuilding.current = slot.id
    if (sandboxLocked('squad-build')) sandboxTainted.current = false
    setPage('squad-build')
  }, [handleStart])
  const buildSquad = useCallback(sq => {
    const next = squadLib.current?.nextToBuild(sq)
    if (!next) { setPage('squad'); return }
    if (squadBuilding.current === next.id && position === baseballPosOf(next.pos) && gameMode === (sq.pool === 'alltime' ? 'all-time' : 'classic')) { setPage('squad-build'); return }
    startSquadBuild(next, sq)
  }, [startSquadBuild, gameMode, position])
  const squadNext = useCallback(() => {
    const L = squadLib.current
    const sq = squadRef.current, slot = L?.nextToBuild(sq)
    if (!slot) { setPage('squad'); return }
    const filled = L.fillSlot(sq, slot.id, build, activeTypes, isCustomMode || sandboxTainted.current)
    const next = L.nextToBuild(filled)
    if (!next && !filled.team) { putSquad({ ...filled, phase: 'team' }); setSquadPick(true); return }
    putSquad(next ? filled : { ...filled, phase: L.afterBuilding(filled) })
    if (next) startSquadBuild(next)
    else { squadBuilding.current = null; setGameMode(null); setBuild({}); setPage('squad') }
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [build, activeTypes, isCustomMode, putSquad, startSquadBuild])
  const squadPicked = useCallback(t => {
    setSquadPick(false)
    putSquad({ ...squadRef.current, team: t.short, phase: 'ready' })
    squadBuilding.current = null; setGameMode(null); setBuild({}); setPage('squad')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [putSquad])
  const squadLeft = squad ? squad.slots.filter(s => !s.build).length : 0

  // ── CAREER (when BASEBALL_MODES.career): lib/career.js with sport 'baseball' ──
  const [career, setCareer] = useState(null)
  const careerRef = useRef(null); careerRef.current = career
  const openCareerRef = useRef(null)
  useEffect(() => {
    if ((!IS_APP && !APP_LOOK) || !BASEBALL_MODES.career) return
    let off = false
    import('../lib/career').then(({ loadCareer, syncCareerFromCloud }) => {
      if (off) return
      setCareer(loadCareer('baseball', user?.id))
      if (user?.id) syncCareerFromCloud('baseball', user.id).then(c => { if (!off) setCareer(c) })
    })
    return () => { off = true }
  }, [user?.id])
  const careerNew = useRef({ slot: 0, name: null })
  const startCareerBuild = useCallback(pos => { handleStart('classic', pos ?? positionRef.current); setPage('career-build') }, [handleStart])
  const openCareer = useCallback(() => { setPage(BASEBALL_MODES.career ? 'career-intro' : 'soon-career'); window.scrollTo({ top: 0, behavior: 'instant' }) }, [])
  openCareerRef.current = openCareer
  const enterDraft = useCallback(async () => {
    const { newCareer, saveCareer, ensureSport } = await import('../lib/career')
    await ensureSport?.('baseball')
    const owner = getUsername(user) || 'Guest'
    const c = { ...newCareer({ sport: 'baseball', uid: user?.id ?? null, pos: position, build, name: careerNew.current.name || owner, slot: careerNew.current.slot, owner, games: careerNew.current.games }), sandbox: !!isCustomMode }
    saveCareer(c); setCareer(c); setGameMode(null); setBuild({}); setPage('career')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [user, build, isCustomMode, position])

  // the team spin lives in the season page's chunk: have it ready before it's needed
  useEffect(() => { if (buildPage || page === 'squad') import('./BaseballSimPage') }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── SALARY CAP (when BASEBALL_MODES.salary): components/BaseballSalaryCap.jsx calls this with its picks ──
  // capBuild: the ten traits from the picks (saveData.pos: a batter's or a pitcher's board); the season plays
  // at once (a club from the date, so View Results always shows the same season; Infinite: from the clock).
  // Like BucketApp: a fresh play earns season XP on the device and posts to the day's board.
  const handleSalaryCapConfirm = useCallback((capBuild, skipToEnd = false, dateStr = null, saveData = null) => {
    const capPos = baseballPosOf(saveData?.pos ?? positionRef.current)
    if (dateStr) setSalaryReturnDate(dateStr)
    setPosition(capPos)
    setBuild(capBuild)
    const dateSeed = dateStr ? parseInt(dateStr.replace(/-/g, ''), 10) : Date.now()
    let h = dateSeed | 0; h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) | 0; h ^= h >>> 16
    const club = MLB_TEAMS[Math.floor(((h >>> 0) / 0x100000000) * MLB_TEAMS.length)]
    const result = BaseballSim.runBaseballSimulation(capBuild, TYPES_OF[capPos], club, capPos, 'current', dateSeed, 'salarycap')
    setSimResult(result)
    if ((IS_APP || APP_LOOK) && !skipToEnd) {
      const tags = baseballAwardTags(result)
      window.dispatchEvent(new CustomEvent('bap:season', { detail: {
        sport: 'baseball', pos: capPos, mode: 'salarycap', localOnly: true, infinite: !!saveData?.infinite,
        wins: result.wins ?? 0, losses: result.losses ?? 0, playoffs: !!result.madePlayoffs,
        champion: !!result.champion, award: baseballMajorAward(tags), awardName: baseballAwardName(tags), awards: tags,
        ovr: result.ovr, ref: result,
      } }))
    }
    setSimInitialScreen(skipToEnd ? 'final' : 0)
    setPage('sim')
    window.scrollTo(0, 0)
    // the board: checked by the live server on its way in (lib/submit.js), with the season's OVR
    if (saveData?.userId && !saveData.noPost && supabase && !skipToEnd) {
      const row = { user_id: saveData.userId, username: saveData.username, picks: saveData.picks, overall_score: result.ovr, budget_used: saveData.totalCost, ...(saveData.row ?? {}) }
      saveSalary({ sport: 'baseball', infinite: !!saveData.infinite, date: dateStr, picks: saveData.picks, pos: capPos, sent: row },
        saveData.infinite ? row : { ...row, date_str: dateStr }, saveData.infinite ? 'baseball_salary_infinite_plays' : 'baseball_salary_cap_plays')
        .then(({ error }) => { if (error) console.error('[baseball-salary] save failed:', error) })
    }
  }, [])
  useEffect(() => { if (START_ON_SALARY) handleStart('salarycap') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = useCallback(() => {
    const drag = activeDragRef.current
    if (!drag) return
    setBuild(prev => ({ ...prev, [drag.type]: drag }))
    setActiveDrag(null)
    setSpinResetKey(k => k + 1)
  }, [])

  const handleReset = useCallback(() => {
    setBuild(Object.fromEntries(activeTypes.map(t => [t, null])))
    setActiveDrag(null)
    setSpinResetKey(k => k + 1)
    setGameKey(k => k + 1)
    setMobileView('spin')
    setActiveCategory(activeCategories[0].id)
    setSimResult(null)
    setSavedSpinResult(null)
    setShowTeamSpin(false)
    sandboxTainted.current = isCustomMode
    setPage(p => (p === 'career-build' || p === 'squad-build' ? p : 'game'))
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' })
  }, [activeTypes, activeCategories, isCustomMode])

  // the navbar's BATTER / PITCHER switch: a new build at the other position, same pool
  const switchPosition = useCallback(pos => {
    if (pos === position) return
    handleStart(gameMode === 'all-time' ? 'all-time' : 'classic', pos)
  }, [position, gameMode, handleStart])

  // a build that already played its season goes back to that season (Back to Build can't re-roll it)
  const replayOrSpin = useCallback(() => {
    if ((IS_APP || APP_LOOK) && simResult && gameMode !== 'salarycap') { setSimInitialScreen('final'); setPage('sim'); window.scrollTo({ top: 0, behavior: 'instant' }); return }
    setShowTeamSpin(true)
  }, [simResult, gameMode])

  // The season is booked once (BaseballSimPage calls this when the regular season has played out, or when it's left):
  // XP and coins, the board row. It never moves the page.
  const bookSeason = useCallback(result => {
    // (the season as played: with the moments on, the director's booked season, so View Results reopens that one)
    if (IS_APP || APP_LOOK) setSimResult(result)
    // the save guard (lib/saveGuard.js): Sandbox in any form, or a build that already saved a season,
    // saves nothing and earns no XP or coins
    const saveMode = baseballModeOf(pool)
    const saveBlock = blockReason({ mode: `${saveMode}-${position}`, build, types: activeTypes, pool: currentPool, sandboxOn: isCustomMode, tainted: sandboxTainted.current })
    const tags = baseballAwardTags(result)
    if (IS_APP || APP_LOOK) {
      window.dispatchEvent(new CustomEvent('bap:season', { detail: {
        sport: 'baseball', pos: position, mode: gameMode,
        wins: result.wins ?? 0, losses: result.losses ?? 0, playoffs: !!result.madePlayoffs,
        champion: !!result.champion, award: baseballMajorAward(tags), awardName: baseballAwardName(tags), awards: tags,
        ovr: result.ovr, sandbox: !!saveBlock, ref: result,
      } }))
    }
    track('simulate', { app: 'baseball', position, gameMode, userId: user?.id ?? null })
    if (!supabase || !user || saveBlock) return
    markPlayed(buildSig(`${saveMode}-${position}`, build, activeTypes))
    saveBaseballSeason({ result, user, build, types: activeTypes, pool, pos: position, gameMode })
  }, [build, activeTypes, user, gameMode, pool, position, isCustomMode, currentPool])
  // the old look books the season as it's picked, then shows it
  const commitSeason = useCallback(result => {
    setSimResult(result)
    bookSeason(result)
    setShowTeamSpin(false)
    setPage('sim')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [bookSeason])
  const commitRef = useRef(null); commitRef.current = commitSeason

  const handleTeamPicked = useCallback(team => {
    const result = BaseballSim.runBaseballSimulation(build, activeTypes, team, position, pool, null, 'classic')
    setSimResult(result)
    setSimInitialScreen(0)
    setShowTeamSpin(false)
    // the new look books the season when it's been watched through the regular season (BaseballSimPage onFinal)
    if (IS_APP || APP_LOOK) { setPage('sim'); window.scrollTo({ top: 0, behavior: 'instant' }); return }
    commitRef.current?.(result)
  }, [build, activeTypes, pool, position])

  const handleChipTap = useCallback(chip => {
    setBuild(prev => {
      if (prev[chip.type]) return prev
      const next = { ...prev, [chip.type]: chip }
      if (!IS_APP && activeTypes.every(t => next[t])) setMobileView('build')
      return next
    })
    setSpinResetKey(k => k + 1)
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' })
  }, [activeTypes])

  const handleHome = useCallback(() => {
    setPage('splash'); setGameMode(null); setBuild({}); setActiveDrag(null); setSpinResetKey(0); setMobileView('spin')
    sandboxTainted.current = isCustomMode
  }, [isCustomMode])

  // Starters Only (Sandbox, a plain build): one wheel of the pool's starters (each club's cleanup hitter or ace)
  const startersOk = !competeOn && page !== 'career-build' && page !== 'squad-build' && (gameMode === 'classic' || gameMode === 'all-time')
  const startersOn = startersPick && isCustomMode && startersOk
  useEffect(() => { if (startersPick && !startersOn) setStartersPick(false) }, [startersPick, startersOn])
  const startersProp = startersOk && page === 'game' ? { on: startersOn, locked: spinPhase !== 'idle' || activeTypes.some(t => build[t]), onToggle: setStartersPick } : null
  const sandboxSwitch = on => {
    if (on || !startersOn) { handleSandboxToggle(on); return }
    handleSandboxToggle(false); setStartersPick(false); handleReset(); sandboxTainted.current = false
  }
  const sandboxProp = !competeOn && buildPage && (gameMode === 'classic' || gameMode === 'all-time') ? sandboxSwitch : undefined

  // the Custom Ratings sheet: both pools behind its toggle (Current / All-Time), each position its own
  const customModal = !showCustomModal ? null : (
    <CustomRatingsModal
      attrMap={ATTR} eraLabels={['Current', 'All-Time']}
      storageKey="bbb_baseball_custom_ratings" ratingsKeyFor={era => ratingsKey(position, era)}
      noPicks={startersOn} gameMode={gameMode}
      pool={CUSTOM_POOLS[position][pool]} poolCurrent={CUSTOM_POOLS[position].current} poolLegends={CUSTOM_POOLS[position].alltime}
      build={build} buildTypes={activeTypes}
      onClose={() => setShowCustomModal(false)}
      onSave={r => { setCustomRatings(r); try { localStorage.setItem('bbb_baseball_custom_ratings', JSON.stringify(r)) } catch {} }}
      onAddToBuild={(p, o, slot) => { sandboxTainted.current = true; setBuild(prev => ({ ...prev, [slot]: chipOf(p, slot, o?.[slot] ?? p.attrs?.[slot] ?? 5, { sandbox: true }) })); setShowCustomModal(false) }}
      onAddAllToBuild={(p, o) => {
        sandboxTainted.current = true
        setBuild(prev => { const next = { ...prev }; activeTypes.forEach(slot => { if (!prev[slot]) next[slot] = chipOf(p, slot, o?.[slot] ?? p.attrs?.[slot] ?? 5, { sandbox: true }) }); return next })
        setShowCustomModal(false)
      }}
    />
  )

  const KEEP_GAME_ON = new Set(['splash', 'profile', 'leaderboard', 'privacy', 'compete'])
  const gameIsPlay = page === 'game' || (KEEP_GAME_ON.has(page) && lastPlayRef.current === 'game')
  const filledCount = activeTypes.filter(t => build[t]).length
  const shareLink = useMemo(() => {
    if (!buildComplete) return null
    const code = encodeBaseballBuild(build, activeTypes, position, pool, POOL_PLAYERS)
    return code ? `${window.location.origin}/baseball?b=${code}` : `${window.location.origin}/baseball`
  }, [buildComplete, build, activeTypes, pool, position])
  const userName = getUsername(user) || 'Guest'
  const hands = baseballHands(build, position)

  const navbarProps = {
    gradesToggle: drop && !competeOn,
    onReset: competeOn ? undefined : handleReset,
    onHome: handleHome,
    onSignIn: () => setShowAuth(true),
    onProfile: () => (user ? (window.history.pushState({}, '', '/profile'), setPage('profile')) : setShowAuth(true)),
    onAbout: () => { window.location.href = '/?about' },
    onLeaderboard: () => setPage('leaderboard'),
    onSubscribe: async () => {
      if (!user) { setShowAuth(true); return }
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/create-checkout`, { method: 'POST', headers: await apiHeaders(), body: JSON.stringify({ userId: user.id, email: user.email }) })
        const { url } = await res.json()
        if (url) window.location.href = url
      } catch {}
    },
    user,
    gameMode: gameMode === 'salarycap' && page !== 'salarycap' && page !== 'sim' ? null : gameMode,
    isPlus: isSubscribed,
    isBaseball: true,
    baseballPosition: position,
    // (a build in progress at the other position: the switch starts a new one, so not mid-squad, career or compete)
    onSwitchBaseballPosition: page === 'game' && !competeOn ? switchPosition : null,
  }

  const renderGame = parked => (
    <>
      {!parked && baseballHead}
      {!parked && !competeOn && <Navbar {...navbarProps} />}
      <div className="game-page-scroll">
        {competeOn && <CompeteHud cp={cp} />}
        {page === 'squad-build' && squad && <div className="cp-hud sq-hud" role="status"><span><small>SQUAD BUILDER · {(squadLib.current?.spotsFor(squad)[squadLib.current.spotsOf(squad)[squadBuilding.current]]?.name ?? posMeta.short).toUpperCase()} · PLAYER {squad.slots.length - squadLeft + 1} OF {squad.slots.length}</small></span><span className="cp-hud-dots">{squad.slots.map(s => <i key={s.id} className={s.build ? 'is-in' : ''} />)}</span></div>}
        {IS_APP && !drop && <StackEdge view={mobileView} build={build} types={activeTypes} attrMap={ATTR} onFlip={flip} waiting={savedSpinResult?.selectedQB?.name ?? null} complete={buildComplete} />}
        {drop && <DropBar open={dropOpen} setOpen={setDropOpen} build={build} types={activeTypes} attrMap={ATTR} waiting={savedSpinResult?.selectedQB?.name ?? null} complete={buildComplete} />}
        <main className={`game-layout ${drop ? 'mobile-build ag-drop' : IS_APP ? 'mobile-build ag-stack' : `mobile-${mobileView}`}${gameMode === 'all-time' ? ' alltime-mode' : ''}`}>
          {(el => (drop ? <DropSheet open={dropOpen} setOpen={setDropOpen}>{el}</DropSheet> : el))(<SpinScreen
            gradesHidden={competeOn}
            build={build}
            activeDrag={activeDrag}
            onDragStart={setActiveDrag}
            onDragEnd={() => setActiveDrag(null)}
            activeCategory={activeCategory}
            resetKey={spinResetKey}
            onChipTap={handleChipTap}
            types={activeTypes}
            qbPool={currentPool}
            savedResult={savedSpinResult}
            onSaveResult={setSavedSpinResult}
            onPhaseChange={setSpinPhase}
            gameKey={gameKey}
            onReset={competeOn ? undefined : handleReset}
            adsDisabled={adsDisabled}
            cardMeta={BASEBALL_MODES.cards && (IS_APP || APP_LOOK) && gameIsPlay && gameMode !== 'salarycap' ? { sport: 'baseball', pos: position, mode: gameMode } : null}
            seedPlan={competePlan}
            startersOnly={startersOn}
            key={competePlan ? `cp-${cp.match.code}` : `spin-${position}-${pool}`}
            paused={parked}
            isBaseball
            baseballPos={position}
            getPlayerSub={playerSub}
            isAllTime={pool === 'alltime'}
            attrMap={ATTR}
            categoriesData={activeCategories}
            teamsPool={MLB_TEAMS}
            teamLabel={BASEBALL_POOL[pool].team}
            getTeamSub={teamSub}
            logoDir={LOGO_DIR}
            playerLabel={posMeta.label}
            headshotsMap={{}}
            headshotsDir={`${HEADSHOT_BASE}/`}
            headshotFallback={() => null}
          />)}
          {IS_APP && !drop && <StackSeam build={build} types={activeTypes} onFlip={flip} />}
          <Silhouette
            isBaseball
            baseballPos={position}
            build={build}
            activeDrag={activeDrag}
            onDrop={handleDrop}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            types={activeTypes}
            onReset={competeOn ? undefined : handleReset}
            isPlus={isSubscribed}
            isCustomMode={isCustomMode}
            onOpenCustomModal={() => setShowCustomModal(true)}
            onSandboxToggle={sandboxProp}
            sandboxStarters={startersProp}
            attrMap={ATTR}
            categoriesData={activeCategories}
            figureRef={figureRef}
            logoDir={LOGO_DIR}
            kitNick={kitNick}
          />
          <div className="right-panel-wrap">
            <ReportCard
              isBaseball baseballPos={position} calcOvr={calcOvr} calcArch={archOf} sizeSlot={slots.size} shareLink={shareLink} hands={hands}
              build={build}
              onSimulate={page === 'squad-build' ? squadNext : page === 'career-build' ? enterDraft : competeOn ? lockInCompete : replayOrSpin}
              simLabel={page === 'squad-build' ? (squadLeft > 1 ? 'NEXT PLAYER' : squad?.team ? 'BACK TO THE SQUAD' : 'PICK A TEAM') : page === 'career-build' ? 'START THE CAREER' : competeOn ? 'LOCK IN' : undefined}
              onReset={competeOn ? undefined : handleReset}
              types={activeTypes}
              isPlus={isSubscribed}
              isCustomMode={isCustomMode}
              onOpenCustomModal={() => setShowCustomModal(true)}
              onSandboxToggle={sandboxProp}
              sandboxStarters={startersProp}
              attrMap={ATTR}
              logoDir={LOGO_DIR}
              isSalaryMode={gameMode === 'salarycap'}
            />
          </div>
        </main>
        <div className="build-footer-section">
          <SiteFeatures sport="baseball" className="build-site-features" />
          <SiteFooter sport="baseball" />
        </div>
      </div>

      {!parked && IS_APP && buildPage && <BuildComplete complete={buildComplete} ovr={buildComplete ? calcOvr(build, activeTypes) : 0} name={buildComplete ? archOf(calcOvr(build, activeTypes), build, activeTypes) : null} build={build} types={activeTypes} attrMap={ATTR} />}
      {!parked && showTeamSpin && <Suspense fallback={null}><BaseballTeamSpin isCustomMode={isCustomMode} onTeamSelected={handleTeamPicked} build={build} /></Suspense>}
      {!parked && squadPick && page === 'squad-build' && <Suspense fallback={null}><BaseballTeamSpin isCustomMode={false} onTeamSelected={squadPicked} build={build} anyTeam eyebrow="Squad Builder" /></Suspense>}
      {!parked && customModal}

      {gameMode !== 'salarycap' && !drop && <nav className="mobile-tab-bar">
        <button className={`mtab ${mobileView === 'spin' ? 'active' : ''}`} onClick={() => { setMobileView('spin'); window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' }) }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Spin
        </button>
        <div className="mtab-sep" />
        <button className={`mtab ${mobileView === 'build' ? 'active' : ''}`} onClick={() => { setMobileView('build'); window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' }) }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          Build
          {filledCount > 0 && <span className="mtab-badge">{filledCount}/{activeTypes.length}</span>}
        </button>
      </nav>}

      {!parked && showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuth={setUser} />}
    </>
  )
  const shell = overlay => (
    <>
      <div className={`ag-game-host${overlay ? ' is-parked' : ''}`}>{renderGame(!!overlay)}</div>
      {overlay}
    </>
  )
  const withGame = el => (IS_APP && gameMode && gameMode !== 'salarycap' && KEEP_GAME_ON.has(page) ? shell(el) : el)
  const backHome = () => { setPage('splash'); window.scrollTo({ top: 0, behavior: 'instant' }) }

  if (page === 'shared' && SHARED) {
    const sz = SHARED.build[BASEBALL_SLOTS[SHARED.pos].size]
    const ovr = ovrOf(SHARED.build, SHARED.types, SHARED.pos)
    return (
      <>
        {baseballHead}
        <Navbar {...navbarProps} baseballPosition={SHARED.pos} onSwitchBaseballPosition={null} />
        <Suspense fallback={null}>
          <SharedBuildPage build={SHARED.build} types={SHARED.types} attrMap={ATTR} logoDir={LOGO_DIR}
            ovr={ovr} arch={archFor(SHARED.pos)(ovr, SHARED.build, SHARED.types)}
            height={sz?.height ?? null} weight={sz?.weight ?? null}
            onPlay={() => { setPage('splash'); window.history.replaceState({}, '', at('/baseball')) }} />
        </Suspense>
      </>
    )
  }

  if (page === 'splash') {
    return withGame(
      <>
        {baseballHead}
        {(IS_APP || APP_LOOK) ? (
          <AppHome
            sport="baseball"
            user={user}
            onStart={handleStart}
            onSquad={openSquad}
            squad={squad}
            onCareer={openCareer}
            career={career}
            onCompete={() => setPage(BASEBALL_MODES.compete ? 'compete' : 'soon-compete')}
            soon={{ career: !BASEBALL_MODES.career, compete: !BASEBALL_MODES.compete, salary: !BASEBALL_MODES.salary, squad: !BASEBALL_MODES.squad }}
            faces={HOME_FACES}
            resume={competeOn ? { label: `Compete · pool ${cp.match.code}`, onClick: () => setPage('game') } : (gameMode && gameMode !== 'salarycap' && (simResult || Object.values(build).some(Boolean))) ? { label: `${posMeta.label} · ${BASEBALL_POOL[pool].label}`, onClick: () => window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'play' })) } : null}
            footer={IS_APP ? null : <><SiteFeatures sport="baseball" /><SiteFooter sport="baseball" /></>}
            renderBucketFigure={renderBaseballFigure}
          />
        ) : (
          <BaseballSplash onStart={handleStart} />
        )}
      </>
    )
  }

  // the modes still on their way to baseball: wired, with their page waiting (BASEBALL_MODES)
  if (page.startsWith('soon-')) {
    const title = { career: 'CAREER', compete: 'COMPETE', salary: 'SALARY CAP', squad: 'SQUAD BUILDER', boards: 'RANKS' }[page.slice(5)] ?? 'COMING SOON'
    return <BaseballSoon title={title} onBack={backHome} />
  }

  if (page === 'compete') {
    if (!BASEBALL_MODES.compete) return <BaseballSoon title="COMPETE" onBack={backHome} />
    // the queues: a batter's or a pitcher's, Current or All-Time
    const queues = ['bat', 'pit'].flatMap(p => ['current', 'alltime'].map(k => ({ pos: `${p}:${k}`, label: `${BASEBALL_POS[p].short} · ${BASEBALL_POOL[k].label}`, q: competeQueue('baseball', p, k) })))
    return withGame(
      <Suspense fallback={null}>
        <AppCompete cp={cp} au={null} sport="baseball" position={`${competeQ.pos}:${competeQ.mode}`} positions={queues}
          onPosition={k => { const [p, m] = String(k).split(':'); setCompeteQ({ pos: baseballPosOf(p), mode: m === 'alltime' ? 'alltime' : 'current' }) }}
          onHome={backHome} onResumeBuild={() => setPage('game')} onPlayAgain={() => cp.join()} />
      </Suspense>
    )
  }
  if (page === 'career-intro') {
    return (
      <Suspense fallback={null}>
        <CareerIntro sport="baseball" uid={user?.id ?? null} onOpen={c => { setCareer(c); setPage('career'); window.scrollTo({ top: 0, behavior: 'instant' }) }} onNew={(slot, name, pos, games) => { careerNew.current = { slot, name, games }; startCareerBuild(pos) }} onClose={backHome} />
      </Suspense>
    )
  }
  if (page === 'career' && career) {
    return <Suspense fallback={null}><AppCareer career={career} setCareer={setCareer} user={user} onNewBuild={openCareer} onExit={backHome} /></Suspense>
  }
  if (page === 'squad') {
    return (
      <Suspense fallback={null}>
        <AppSquad sport="baseball" squad={squad} setSquad={putSquad} user={user} onBuild={buildSquad} onExit={backHome}
          renderPicker={(onPick, b) => <Suspense fallback={null}><BaseballTeamSpin isCustomMode={!!squad?.sandbox} onTeamSelected={onPick} build={b} anyTeam eyebrow="Squad Builder" /></Suspense>} />
      </Suspense>
    )
  }
  if (page === 'salarycap') {
    // SALARY CAP: the day's board (components/BaseballSalaryCap.jsx); its picks play a season
    return (
      <Suspense fallback={null}>
        <BaseballSalaryCap onConfirm={handleSalaryCapConfirm} onBack={backHome} user={user} initialDateStr={salaryReturnDate} position={position} />
      </Suspense>
    )
  }

  if (page === 'sim') {
    return (
      <>
        <Navbar {...navbarProps} onSwitchBaseballPosition={null} />
        <Suspense fallback={null}>
          <BaseballSimPage
            result={simResult}
            build={build}
            types={activeTypes}
            pos={position}
            pool={pool}
            onBack={() => { setPage(gameMode === 'salarycap' ? 'salarycap' : 'game'); window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' }) }}
            onReset={handleReset}
            adsDisabled={adsDisabled}
            isSalaryMode={gameMode === 'salarycap'}
            initialScreen={simInitialScreen}
            onFinal={(IS_APP || APP_LOOK) && gameMode !== 'salarycap' ? bookSeason : null}
            userName={userName}
            arch={archOf(simResult?.ovr ?? calcOvr(build, activeTypes), build, activeTypes)}
          />
        </Suspense>
      </>
    )
  }

  if (page === 'leaderboard') {
    // BOARDS: AppLeaderboards with sport 'baseball' once lib/boards.js has baseball's boards
    if (!BASEBALL_MODES.boards) return withGame(<BaseballSoon title="RANKS" onBack={backHome} />)
    return withGame(<Suspense fallback={<div className="ag-screen ag-screen--wait" />}><AppLeaderboards sport="baseball" adsDisabled={adsDisabled} /></Suspense>)
  }

  if (page === 'privacy') {
    return withGame(
      <>
        <Navbar {...navbarProps} />
        <Suspense fallback={null}><PrivacyPage onBack={() => { setPage('game'); window.scrollTo({ top: 0, behavior: 'instant' }) }} /></Suspense>
      </>
    )
  }

  if (page === 'profile' && user) {
    // PROFILE: the account (a BASEBALL section with its seasons comes with the boards: lib/baseballAwards.js rows)
    return withGame(
      <>
        <Suspense fallback={null}>
          <ProfilePage
            user={user} build={build} types={activeTypes} isPlus={isSubscribed} isBaseball
            onBack={() => { if (IS_APP || APP_LOOK) { window.history.pushState({}, '', at('/baseball')); setPage('splash') } else window.history.back() }}
            onSignOut={() => { setUser(null); window.location.href = at('/baseball') }}
            onAdsDisabled={() => { setAdsDisabled(true); setIsSubscribed(true); enableAdFreeMode() }}
            onThemeChange={themeId => {
              try { localStorage.setItem('bap_theme', themeId) } catch {}
              if (themeId === 'default') document.documentElement.removeAttribute('data-theme')
              else document.documentElement.setAttribute('data-theme', themeId)
            }}
          />
        </Suspense>
      </>
    )
  }

  return IS_APP ? shell(null) : renderGame(false)
}
