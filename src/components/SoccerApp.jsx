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
const SoccerSimPage = lazy(() => import('./SoccerSimPage'))
const SoccerTeamSpin = lazy(() => import('./SoccerSimPage').then(m => ({ default: m.SoccerTeamSpin })))
const SharedBuildPage = lazy(() => import('./SharedBuildPage'))
const ProfilePage = lazy(() => import('./ProfilePage'))
const PrivacyPage = lazy(() => import('./PrivacyPage'))
const AppLeaderboards = lazy(() => import('./app/AppLeaderboards'))
// (Squad Builder's soccer rosters and engine load with it: lib/squadSoccer.js, kept out of football's and basketball's)
const AppSquad = lazy(() => import('../lib/squadSeason').then(m => m.loadSquadSoccer()).then(() => import('./app/AppSquad')))
const AppCareer = lazy(() => import('./app/AppCareer'))
const CareerIntro = lazy(() => import('./app/AppCareer').then(m => ({ default: m.CareerIntro })))
const SoccerSalaryCap = lazy(() => import('./SoccerSalaryCap'))
const AppTraitAuction = lazy(() => import('./app/AppTraitAuction'))
import { SOCCER_ATTR, SOCCER_TYPES, SOCCER_CATEGORIES } from '../data/soccer-attrs'
import { SOCCER_STRIKERS, UCL_STRIKERS, WC_STRIKERS, WC2026_STRIKERS } from '../data/soccer-strikers'
import { SOCCER_CLUBS, UCL_CLUBS, SOCCER_ALL_CLUBS } from '../data/soccer-clubs'
import { migrateSoccerKeys } from '../data/soccer-attrs'
import { WC_NATIONS, WC_ALL_NATIONS } from '../data/soccer-nations'
import { soccerFaceKey } from '../lib/soccerFace'
import * as SoccerSim from '../utils/soccerSimulation'
import { HEADSHOT_BASE } from '../utils/simulation'
import { supabase, apiHeaders } from '../lib/supabase'
import { track } from '../lib/track'
import { blockReason, buildSig, markPlayed } from '../lib/saveGuard'
import { readLive, startLive, bookLive, leaveLive } from '../lib/seasonLive'
import { saveSeason, saveSalary } from '../lib/submit'
import { soccerModeOf, soccerRowStats, soccerAwardTags, soccerAwardName } from '../lib/soccerAwards'
import { IS_APP, APP_LOOK, setClassicLook } from '../lib/platform'
import { restorePro } from '../lib/webCheckout'
import AppHome from './app/AppHomeSwitch'   // today's Home, or the classic one (Settings → Classic Home)
import { BuildComplete, useFlip, StackEdge, StackSeam, useDropMode, useDropSheet, DropBar, DropSheet } from './app/AppBuildTray'
import { setLiveLock, liveLock, guardLeave } from '../lib/liveLock'
import { FORFEIT_RATING, dailyState } from '../lib/progress'
import { useAuction } from '../lib/auction'
import '../lib/soccerAuctionUi'   // the Trait Auction's soccer kit (the striker) and its cards
import { flagEmoji, ensureFlagFont } from '../lib/flagEmoji'
import { setSandboxGate, sandboxItemFor, sandboxLocked, clearSandboxHint } from './app/AppSandbox'
import { finishDiscordSignIn, getUsername } from '../lib/discord'
import { routePage, pageAtLoad, onRoutePop } from '../lib/routes'
import { SOCCER_SILHOUETTE, SOCCER_POOL, SOCCER_MODES, SOCCER_KIT_SLOT, SOCCER_SIZE_SLOT, soccerPoolOf, soccerArchetype } from '../lib/soccerUi'
import { encodeSoccerBuild, decodeSoccerBuild } from '../lib/soccerShare'
import { switchSport } from './app/AppHome'
import { StackedSilhouette } from './SplashScreen'
import { BASEBALL_LIVE } from '../lib/baseballLive'
import { SOCCER_LIVE } from '../lib/soccerLive'
import SoccerComingSoon from './SoccerComingSoon'

// ═════════════════════════════════════════════════════════════════════════════
// SOCCER: the third game, at /soccer (main.jsx mounts it while lib/soccerLive.js is on).
// Built like BucketApp: the same pages, the same build screen (SpinScreen / Silhouette /
// ReportCard with `isSoccer`) and the same shell. The striker is the only position (GK shows
// locked on Home). Pools keep their keys: 'current' = TOP DIVISIONS (clubs), 'alltime' =
// WORLD CUP (nations); the app's game modes stay 'classic' / 'all-time' like basketball's.
//
// The modes still to come plug in here (lib/soccerUi.js SOCCER_MODES says which are on):
//   Career        → openCareer / startCareerBuild / enterDraft, pages 'career-intro' 'career' 'career-build'
//   Salary Cap    → page 'salarycap' + handleSalaryCapConfirm (needs components/SoccerSalaryCap.jsx)
//   Squad Builder → openSquad / buildSquad / squadNext, pages 'squad' 'squad-build'
//   Boards        → page 'leaderboard' (AppLeaderboards sport 'soccer') and saveSoccerSeason below
// ═════════════════════════════════════════════════════════════════════════════

// the dev server's ?soccer=1 stays on every soccer address (a reload keeps soccer on)
const Q = import.meta.env.DEV && typeof location !== 'undefined' && /[?&]soccer=1\b/.test(location.search) ? '?soccer=1' : ''
const at = path => path + Q

function genericHeadshot(skinHex) {
  if (!skinHex) return '/genericdark.webp'
  const r = parseInt(skinHex.slice(1, 3), 16), g = parseInt(skinHex.slice(3, 5), 16), b = parseInt(skinHex.slice(5, 7), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 155 ? '/genericlight.webp' : '/genericdark.webp'
}

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
// the page the address names (lib/routes.js): /soccer/home, /soccer/ranks… (the old /soccer/salary too)
const WANT = pageAtLoad('soccer')
const START_ON_SALARY = WANT === 'salarycap'
// the pages a refresh opens straight from the address (Career's hub opens on its saves; a build or a season needs
// what the reload lost: Home)
const OPEN_AT = ['leaderboard', 'auction', 'career-intro', 'squad', 'profile', 'privacy'].includes(WANT) ? WANT : WANT === 'career' ? 'career-intro' : null
try { if (IS_APP || localStorage.getItem('bap_subscribed') === '1' || localStorage.getItem('bap_ads_off') === '1') enableAdFreeMode() } catch {}

// ── The rosters ──────────────────────────────────────────────────────────────
// Clubs and nations by their 3-letter code (a club's code and a nation's can match: each
// pool reads its own map). A player's photo is his ESPN headshot (data/soccer-headshots.json).
const CLUB_MAP = Object.fromEntries(SOCCER_ALL_CLUBS.map(t => [t.short, t]))
// (WORLD CUP's nations are the 48 of history since 11-16; a 2026 nation from an old save or link still finds its row)
const NATION_MAP = Object.fromEntries(WC_ALL_NATIONS.map(t => [t.short, t]))
// the wheel: the Champions League's 36 clubs and their players (the owner, 2026-11-16); a Squad Builder squad
// still spins its club players from the domestic leagues it plays in (LEAGUE_*)
const TEAMS_OF = { current: UCL_CLUBS, alltime: WC_NATIONS }
const TEAM_MAP_OF = { current: CLUB_MAP, alltime: NATION_MAP, wc2026: NATION_MAP }
export const LOGO_DIR = { current: '/logos/soccer/', alltime: '/logos/nations/' }
// his ESPN photo, else his FotMob one (lib/soccerFace.js); neither: no face, the crest and the name carry it
const hsKey = soccerFaceKey
export const soccerPhoto = p => { const k = p?.headshot ?? hsKey(p); return k ? `${HEADSHOT_BASE}/${k}.webp` : null }
function enrich(p, pool) {
  const t = TEAM_MAP_OF[pool][p.team]
  return {
    ...p,
    color: t?.color ?? '#888888', color2: t?.color2 ?? '#444444', teamName: t?.name ?? p.team,
    // the wheel shows his real role (ST, LW, RW, AM, CM, DM, SS); the build is always a striker
    position: p.role ?? p.position ?? 'ST', buildPos: 'ST', skin: p.skin ?? null, faceCenter: p.faceCenter ?? null,
    headshot: hsKey(p), pool,
  }
}
const POOL_PLAYERS = { current: UCL_STRIKERS.map(p => enrich(p, 'current')), alltime: WC_STRIKERS.map(p => enrich(p, 'alltime')) }
const LEAGUE_PLAYERS = SOCCER_STRIKERS.map(p => enrich(p, 'current'))
// a World Cup link from before the legends (lib/soccerShare.js): the 2026 squads it was made from, read only for it
const SHARE_POOLS = { ...POOL_PLAYERS, get wc2026() { return WC2026_STRIKERS.map(p => ({ ...enrich(p, 'wc2026'), pool: 'alltime' })) } }
const _dedup = arr => { const s = new Set(); return arr.filter(p => { const k = `${p.name}|${p.team}`; if (s.has(k)) return false; s.add(k); return true }) }
const _byTeam = (a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name)
const CUSTOM_POOLS = { current: _dedup(POOL_PLAYERS.current).sort(_byTeam), alltime: _dedup(POOL_PLAYERS.alltime).sort(_byTeam) }
// the shirt: a club's name as it's said, a nation's name in full
const kitNickFor = pool => chip => {
  const t = TEAM_MAP_OF[pool][chip?.team]
  return t ? String(t.kit ?? t.name).toUpperCase() : chip?.team ?? null
}
const teamSub = t => t.name
// the World Cup wheel shows a nation's flag before its code (the owner, 2026-11-25: the flag, but keep both lines,
// the code over the name, as the wheel always had them); a club keeps its code alone
const teamFlag = t => { const f = flagEmoji(t.short); return f ? <><span className="flag-emoji">{f}</span>{' '}{t.short}</> : t.short }

// OVR and the striker's name for him (the sim's own, when it has one)
const calcOvr = (b, types) => Math.round(SoccerSim.calcSoccerOVR?.(b, types) ?? 0)
const archOf = (ovr, b, types) => (SoccerSim.getSoccerArchetype ?? soccerArchetype)(ovr, b, types)

// Home's pool cards: three stars each. ESPN has no photo for most of them, so these cards (only these) use FotMob's
// studio photos, framed like ESPN's, a little smaller (public/headshots/soccer/fm-<FotMob id>.webp: 300px on 600x436), Messi's too so the six match; Maradona's is his roster photo
// (the owner, 2026-11-25). The middle face is the big one.
const FACE_PICKS = {
  current: [['Lamine Yamal', 'soccer/fm-1467236'], ['Erling Haaland', 'soccer/fm-737066'], ['Kylian Mbappé', 'soccer/fm-701154']],
  alltime: [['Cristiano Ronaldo', 'soccer/fm-30893'], ['Diego Maradona', 'soccer/fmr-158546'], ['Lionel Messi', 'soccer/fm-30981']],
}
const HOME_FACES = Object.fromEntries(['current', 'alltime'].map(k => [k, FACE_PICKS[k].map(([n, id]) => {
  const p = POOL_PLAYERS[k].find(p => p.name === n)
  return { id: id ?? p?.headshot, color: p?.color ?? '#888888' }
}).filter(f => f.id)]))

// Squad Builder's header: the spot of the slot being built (a copy of lib/squad.js SOCCER_SHAPES' labels, so Home
// doesn't load the squad module)
const SHAPE_SPOTS = { '433': ['LW', 'ST', 'RW'], '4312': ['LS', 'RS', 'CAM'] }
const squadSpotLabel = (sq, id) => SHAPE_SPOTS[sq?.shape ?? '433']?.[sq?.lineup?.[id]] ?? 'ST'

// ── Home's figure: the striker's traits, colour by colour, falling into his silhouette ──
// (on public/st-silhouette.webp, measured off the art's outline the way football's are, SplashScreen.jsx: each
// band's height is its share of the art (flex), and each word sits on the widest solid stretch of its band: x is
// the % of the figure's box to move it off centre (his body is right of the art's middle), y a nudge in the word's
// own em (the classic splash draws him at other sizes). He is
// slim, so a word goes where it fits whole, a size down where the stretch is short: the long words on the chest
// and the hips, Size on the head, Pace on the thigh, Dribbling upright down the sock, "Power" (Shot Power) on the
// boot and the ball.)
const stBand = (t, o) => ({ label: o.label ?? SOCCER_ATTR[t]?.label ?? t, col: SOCCER_ATTR[t]?.hex ?? '#ffffff', ...o })
const SOCCER_SPLASH_ATTRS = [
  stBand('size',        { flex: 290, x: 14.9, y: '.45em' }),
  stBand('heading',     { flex: 140, x: 7.4, y: '.45em' }),
  stBand('composure',   { flex: 115, x: 5.6, sm: true }),
  stBand('passing',     { flex: 155, x: 6.7, y: '.45em', sm: true }),
  stBand('positioning', { flex: 115, x: 3.7, y: '.18em' }),
  stBand('finishing',   { flex: 115, x: 12.2, y: '-.38em', xs: true }),
  stBand('pace',        { flex: 130, x: 19.7, y: '-.25em', xs: true }),
  stBand('dribbling',   { flex: 230, x: 21.8, xs: true, v: true }),
  stBand('shotPower',   { flex: 246, x: 27.4, y: '-.72em', label: 'Power' }),
]
// (the art has empty margins round him: the box is drawn a little past the stage's figure box, so he stands as tall
// as the other figures)
const renderSoccerFigure = (pos, ready, fast) => (
  <div className="st-home-fig">
    <img src={SOCCER_SILHOUETTE.src} className="splash-figure" alt="" draggable={false} style={{ position: 'absolute', inset: 0 }} />
    <StackedSilhouette position="st" attrs={SOCCER_SPLASH_ATTRS} ready={ready} fast={fast} />
  </div>
)

// ── The classic look (Settings → Classic look): the old splash, soccer's way ──
function SoccerSplash({ onStart }) {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 80), t2 = setTimeout(() => setPhase(2), 420), t3 = setTimeout(() => setPhase(3), 800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])
  return (
    <div className={`splash-screen bucket-splash soccer-splash ${phase >= 1 ? 'splash-in' : ''}`}>
      <div className="splash-hero">
        <h1 className="sr-only">Build-A-Player Soccer: Build a Striker</h1>
        <div className="splash-header" style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'none' : 'translateY(-28px)' }}>
          <img src="/bap-mark.webp" alt="Build-A-Player" className="splash-logo-mark" draggable={false} />
          <div className="splash-title splash-title--small">BUIL<span className="logo-d">D</span><em>-<span className="logo-a">A</span>-</em>PLAYER</div>
          <div className="splash-pos-toggle" style={{ opacity: phase >= 3 ? 1 : 0 }}>
            <button className="splash-pos-btn splash-pos-btn--active">ST<span className="splash-pos-sub">STRIKER</span></button>
            <button className="splash-pos-btn" disabled aria-disabled="true">GK<span className="splash-pos-sub">COMING SOON</span></button>
          </div>
        </div>
        <div className="splash-figure-wrap bucket-figure-wrap" style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? 'none' : 'translateY(40px) scale(0.92)' }}>
          <div className="splash-figure-parallax">{renderSoccerFigure('st', phase >= 3, false)}</div>
        </div>
        <div className="splash-footer" style={{ opacity: phase >= 3 ? 1 : 0 }}>
          <div className="splash-modes">
            <button className="splash-mode-classic" onClick={() => onStart('classic', 'st')}>
              <div className="smode-title">Champions League</div>
              <div className="smode-badge">The 36 clubs of 2026-27</div>
              <div className="smode-cta">START DRAFTING
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </div>
            </button>
            <div className="splash-modes-secondary">
              <button className="splash-mode-alltime" onClick={() => onStart('all-time', 'st')}>
                <div className="smode-title">World Cup</div>
                <div className="smode-badge">48 nations across history</div>
              </button>
              {SOCCER_MODES.salary && (
                <button className="splash-mode-salarycap" onClick={() => onStart('salarycap', 'st')}>
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
          {BASEBALL_LIVE && (
            <button className="splash-minigame-btn splash-minigame-btn--baseball" onClick={() => { window.location.href = '/baseball' + (import.meta.env.DEV && /[?&]baseball=1\b/.test(window.location.search) ? '?baseball=1' : '') }}>
              <div className="splash-xlink-logo">BUIL<span className="splash-xlink-d">D</span><em className="splash-xlink-em splash-xlink-em--baseball">-<span className="splash-xlink-a">A</span>-</em>PLAYER</div>
              <div className="splash-mg-sub">BASEBALL BUILDER</div>
            </button>
          )}
          {!IS_APP && !APP_LOOK && <button className="splash-newlook" onClick={() => setClassicLook(false)}>Switch to the new look</button>}
        </div>
      </div>
      <SiteFeatures sport="soccer" />
      <SiteFooter sport="soccer" />
    </div>
  )
}

// A mode that's wired but not built for soccer yet (SOCCER_MODES): its name and where it stands
function SoccerSoon({ title, onBack }) {
  return (
    <div className="ag-screen ag-screen--soccer sc-soon">
      <div className="sc-soon-inner">
        <span className="sc-soon-tag">SOCCER · COMING SOON</span>
        <h1 className="sc-soon-title">{title}</h1>
        <button className="sc-soon-back" onClick={onBack}>BACK TO HOME</button>
      </div>
    </div>
  )
}

// /soccer's search and link-preview tags (scripts/prerender-soccer.mjs bakes the same into soccer.html)
const SOCCER_TITLE = 'Build-A-Player Soccer: Build a Striker — Soccer Player Creator & Simulator'
const SOCCER_DESC = 'Build a soccer player — spin the wheel to make your own striker from real players at Europe\'s top clubs or World Cup legends, then play a full season, chase the Golden Boot and the Ballon d\'Or. Free soccer player creator.'
const soccerHead = (
  <Helmet>
    <title>{SOCCER_TITLE}</title>
    <meta name="description" content={SOCCER_DESC} />
    <meta name="keywords" content="build a soccer player, create a soccer player, soccer player creator, football player builder, striker builder, soccer simulator, world cup game, ballon d'or game" />
    <link rel="canonical" href="https://build-a-player.com/soccer" />
    <meta property="og:title" content={SOCCER_TITLE} />
    <meta property="og:description" content={SOCCER_DESC} />
    <meta property="og:url" content="https://build-a-player.com/soccer" />
  </Helmet>
)

// A shared soccer build (/soccer?b=…), read once at load
const SHARED = (() => { try { const b = new URLSearchParams(window.location.search).get('b'); return b ? decodeSoccerBuild(b, SHARE_POOLS, soccerPhoto) : null } catch { return null } })()

// ── The season's save ─────────────────────────────────────────────────────────
// The row for the boards (lib/soccerAwards.js says which column holds what: game_mode 'soccer-classic' /
// 'soccer-all-time', goals in season_tds, assists in season_ints, the average rating in ppg, the awards
// as season_award tags). The live worker checks it with soccer's kit (lib/soccerKits.js) and needs its
// redeploy, and the database supabase/soccer_mode.sql, before it's taken.
export function soccerSeasonRow({ result, user, build, types, pool }) {
  return {
    user_id: user.id, username: getUsername(user),
    ovr: result.ovr, archetype: archOf(result.ovr, build, types),
    game_mode: soccerModeOf(pool), position: 'st',
    ...soccerRowStats(result),
    team_short: result.team?.short ?? null,
    build: Object.fromEntries(types.filter(t => build[t]).map(t => [t, { qb: build[t].qbFull, team: build[t].team, val: build[t].val, number: build[t].number ?? null }])),
  }
}
function saveSoccerSeason(args) {
  if (!SOCCER_MODES.boards) return
  const row = soccerSeasonRow(args)
  saveSeason('soccer', 'st', args.gameMode || 'classic', row)
    .then(({ error }) => { if (error && error.code !== '23505') console.error('[soccer save]', error.code, error.message) })
}

// ─── SoccerApp ────────────────────────────────────────────────────────────────
export default function SoccerApp() {
  // a season kept on the device (lib/seasonLive.js): after a reload its build, mode and season wait on CONTINUE
  // (a season saved before the nine ratings, 11-16: its build and types read with the new keys)
  const [liveAt] = useState(() => (SHARED ? null : migrateSoccerKeys(readLive('soccer'))))
  // (a link to the leaderboard, or a refresh on it, opens it: it needs nothing else set up)
  const [page, setPage]               = useState(SHARED ? 'shared' : SOCCER_LIVE && OPEN_AT ? OPEN_AT : 'splash')
  const [gameMode, setGameMode]       = useState(() => liveAt?.mode ?? null)   // 'classic' (Top Divisions) | 'all-time' (World Cup) | 'salarycap'
  const position = 'st'
  const pool = soccerPoolOf(gameMode)
  const [build, setBuild]             = useState(() => liveAt?.build ?? {})
  const figureRef = useRef(null)
  const [activeDrag, setActiveDrag]   = useState(null)
  const [activeCategory, setActiveCategory] = useState('skills')
  const [spinResetKey, setSpinResetKey] = useState(0)
  const [gameKey, setGameKey]         = useState(0)
  const [mobileView, setMobileView]   = useState('spin')
  const [user, setUser]               = useState(null)
  // Signing out while on the profile page: go Home, never fall through to whatever page sits under it
  const hadUserRef = useRef(false)
  useLayoutEffect(() => {
    if (user) { hadUserRef.current = true; return }
    if (hadUserRef.current && page === 'profile') {
      setPage('splash')
    }
  }, [user, page])
  const [adsDisabled, setAdsDisabled] = useState(IS_APP)
  const [isSubscribed, setIsSubscribed] = useState(() => { try { return localStorage.getItem('bap_subscribed') === '1' } catch { return false } })
  const [showAuth, setShowAuth]       = useState(false)
  const [spinPhase, setSpinPhase]     = useState('idle')
  const [showTeamSpin, setShowTeamSpin] = useState(false)
  const [simResult, setSimResult]     = useState(() => (liveAt ? (liveAt.booked ? liveAt.final : liveAt.base) : null))
  const [simInitialScreen, setSimInitialScreen] = useState(0)
  const [salaryReturnDate, setSalaryReturnDate] = useState(null)   // Salary Cap reopens on the date just played
  const [savedSpinResult, setSavedSpinResult] = useState(() => {
    try { const r = JSON.parse(localStorage.getItem('bas_spin_result')); return r?.starters ? null : r } catch { return null }
  })
  const [isCustomMode, setIsCustomMode] = useState(() => { try { return localStorage.getItem('bas_custom_mode') === '1' } catch { return false } })
  const [customRatings, setCustomRatings] = useState(() => { try { return migrateSoccerKeys(JSON.parse(localStorage.getItem('bas_soccer_custom_ratings') || '{}')) } catch { return {} } })
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [startersPick, setStartersPick] = useState(false)
  const [squad, setSquad] = useState(null)
  const squadRef = useRef(null); squadRef.current = squad
  const lastPlayRef = useRef(null)
  const activeDragRef = useRef(activeDrag)
  useLayoutEffect(() => { activeDragRef.current = activeDrag }, [activeDrag])

  const activeTypes = SOCCER_TYPES
  const activeCategories = SOCCER_CATEGORIES
  const logoDir = LOGO_DIR[pool]
  const kitNick = useMemo(() => kitNickFor(pool), [pool])

  // once Sandbox is on in a build, the build stays marked until a reset (no toggle-off-and-save)
  const sandboxTainted = useRef(isCustomMode)
  useEffect(() => { if (isCustomMode) { sandboxTainted.current = true; clearSandboxHint() } }, [isCustomMode])
  useEffect(() => { ensureFlagFont() }, [])   // (flags on Windows: lib/flagEmoji.js)

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
    document.documentElement.setAttribute('data-sport', 'soccer')
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


  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', page === 'splash' ? '#0a0a0a' : '#090a0d')
  }, [page])

  // the dock (AppTabBar): which page this is, and its taps
  useEffect(() => {
    if (!IS_APP && !APP_LOOK) return
    window.__bapPage = { page, sport: 'soccer' }
    window.dispatchEvent(new CustomEvent('bap:page', { detail: window.__bapPage }))
    if (['game', 'sim', 'salarycap', 'squad', 'squad-build', 'career', 'career-build'].includes(page)) lastPlayRef.current = page
  }, [page])
  const handleStartRef = useRef(null)
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
        // (a season played or in progress: straight back to it, as football's CONTINUE does: still playing, where it was)
        else if (gameMode && gameMode !== 'salarycap' && simResult) { const v = readLive('soccer'); setSimInitialScreen(v ? 0 : 'final'); setPage('sim') }
        else if (gameMode) setPage(gameMode === 'salarycap' ? 'salarycap' : 'game')
        else handleStartRef.current?.('classic')
      } else if (String(to).startsWith('mode:')) handleStartRef.current?.(String(to).slice(5))
      else if (to === 'leaderboard') setPage('leaderboard')
      else if (to === 'auction' || to === 'compete') setPage('auction')
      else if (to === 'salarycap') handleStartRef.current?.('salarycap')
      else if (to === 'squad') openSquadRef.current?.()
      else if (to === 'career') openCareerRef.current?.()
      else if (to === 'profile') { if (user) setPage('profile'); else window.dispatchEvent(new CustomEvent('bap:auth')) }
      else if (to === 'about') window.location.href = '/?about'
      else if (to === 'wiki') window.location.href = '/wiki'
      // the Daily Challenge is a football or basketball day: it opens on its own side
      else if (to === 'daily-challenge') window.location.href = dailyState().sport === 'bucket' ? '/bucket?daily=1' : '/?daily=1'
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('bap:nav', onNav)
    return () => window.removeEventListener('bap:nav', onNav)
  }, [page, gameMode, user, simResult])

  // the address and the ads on every page change (lib/routes.js, lib/ads.js); soccer switched off is its Home only
  useLayoutEffect(() => { routePage('soccer', SOCCER_LIVE ? page : 'splash') }, [page])

  // the account, and Pro / ad-free from it (as BucketApp)
  useEffect(() => {
    if (!supabase) return
    const adFreeReturn = new URLSearchParams(window.location.search).get('ad_free') === '1'
    if (adFreeReturn) window.history.replaceState({}, '', window.location.pathname)
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (!u) setPage(p => (p === 'profile' ? 'splash' : p))   // (/profile opened signed out: Home)
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
    try { if (savedSpinResult) localStorage.setItem('bas_spin_result', JSON.stringify(savedSpinResult)); else localStorage.removeItem('bas_spin_result') } catch {}
  }, [savedSpinResult])

  const buildCompleteTracked = useRef(false)
  useEffect(() => {
    const complete = activeTypes.every(t => build[t])
    if (complete && !buildCompleteTracked.current) { buildCompleteTracked.current = true; track('build_complete', { app: 'soccer', position, gameMode }) }
    else if (!complete) buildCompleteTracked.current = false
  }, [build, activeTypes, gameMode])

  // phones: the player is the screen and the spin drops down over it; the app flips Spin and Build
  const buildPage = page === 'game' || page === 'squad-build' || page === 'career-build'
  const drop = useDropMode((IS_APP || APP_LOOK) && gameMode !== 'salarycap' && buildPage)
  const [dropOpen, setDropOpen] = useDropSheet(drop, build, activeTypes, spinResetKey)
  const flip = useFlip(IS_APP && !drop && buildPage, mobileView, setMobileView)
  const buildComplete = activeTypes.every(t => build[t])
  useEffect(() => { if (IS_APP && buildComplete && buildPage) flip('build') }, [buildComplete]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!IS_APP && buildComplete && buildPage) window.__bapJuice?.sfx('complete', 2) }, [buildComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSandboxToggle = useCallback(on => { try { localStorage.setItem('bas_custom_mode', on ? '1' : '0') } catch {}; setIsCustomMode(on) }, [])
  useEffect(() => { if (isCustomMode && sandboxLocked(page)) handleSandboxToggle(false) }, [page]) // eslint-disable-line react-hooks/exhaustive-deps
  setSandboxGate(sandboxItemFor(page))

  // the pool the spins deal from: the clubs' attackers and midfielders or the nations', with Sandbox's edits on top
  // (a club squad in Squad Builder spins from the domestic leagues' players, not the Champions League's)
  const squadClubSpin = page === 'squad-build' && pool === 'current'
  const currentPool = useMemo(() => {
    const base = squadClubSpin ? LEAGUE_PLAYERS : POOL_PLAYERS[pool]
    if (!isCustomMode) return base
    const overrides = customRatings[`soccer_st${pool === 'alltime' ? '_wc' : ''}`] || {}
    if (!Object.keys(overrides).length) return base
    return base.map(p => { const o = overrides[`${p.name}|${p.team}`]; return o ? { ...p, attrs: { ...p.attrs, ...o } } : p })
  }, [pool, isCustomMode, customRatings, squadClubSpin])

  const handleStart = useCallback((mode, _pos = 'st') => {
    leaveLive('soccer', markPlayed)   // (a season left in progress: played, as a reload made it)
    if (mode === 'salarycap' && !SOCCER_MODES.salary) { setGameMode(null); setPage('soon-salary'); return }
    if (IS_APP || APP_LOOK) { setSimResult(null); setSavedSpinResult(null); setMobileView('spin'); setSpinResetKey(k => k + 1); setGameKey(k => k + 1) }
    setGameMode(mode)
    setBuild(Object.fromEntries(activeTypes.map(t => [t, null])))
    setActiveCategory(activeCategories[0].id)
    sandboxTainted.current = isCustomMode
    setStartersPick(false)
    try { localStorage.setItem('soccerPool', mode === 'all-time' ? 'all-time' : 'classic') } catch {}
    setPage(mode === 'salarycap' ? 'salarycap' : 'game')
    window.scrollTo(0, 0)
  }, [isCustomMode, activeTypes, activeCategories])
  handleStartRef.current = handleStart

  // ── SQUAD BUILDER (when SOCCER_MODES.squad): lib/squad.js with sport 'soccer' ──
  const openSquadRef = useRef(null)
  const squadBuilding = useRef(null)
  const [squadPick, setSquadPick] = useState(false)
  const squadLib = useRef(null)
  useEffect(() => {
    if (!(IS_APP || APP_LOOK) || !SOCCER_MODES.squad) return
    let live = true
    import('../lib/squad').then(m => {
      squadLib.current = m
      if (!live) return
      setSquad(m.loadSquad('soccer', user?.id))
      if (user?.id) m.syncSquadFromCloud('soccer', user.id).then(sq => { if (live) setSquad(sq) })
    })
    return () => { live = false }
  }, [user?.id])
  const putSquad = useCallback(sq => { setSquad(sq); if (sq) squadLib.current?.saveSquad(sq); else squadLib.current?.clearSquad('soccer', user?.id) }, [user?.id])
  const openSquad = useCallback(() => { setPage(SOCCER_MODES.squad ? 'squad' : 'soon-squad'); window.scrollTo({ top: 0, behavior: 'instant' }) }, [])
  openSquadRef.current = openSquad
  // (a World Cup squad spins its players from the World Cup pool, a club squad from the top divisions)
  const startSquadBuild = useCallback((slot, sq = squadRef.current) => {
    handleStart(sq?.pool === 'alltime' ? 'all-time' : 'classic')
    squadBuilding.current = slot.id
    if (sandboxLocked('squad-build')) sandboxTainted.current = false
    setPage('squad-build')
  }, [handleStart])
  const buildSquad = useCallback(sq => {
    const next = squadLib.current?.nextToBuild(sq)
    if (!next) { setPage('squad'); return }
    if (squadBuilding.current === next.id && gameMode === (sq.pool === 'alltime' ? 'all-time' : 'classic')) { setPage('squad-build'); return }
    startSquadBuild(next, sq)
  }, [startSquadBuild, gameMode])
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
  // the spot the player being built plays (lib/squad.js SOCCER_SHAPES: LW ST RW, or LS RS CAM), not always ST

  // ── CAREER (when SOCCER_MODES.career): lib/career.js with sport 'soccer' ──
  const [career, setCareer] = useState(null)
  const careerRef = useRef(null); careerRef.current = career
  const openCareerRef = useRef(null)
  useEffect(() => {
    if ((!IS_APP && !APP_LOOK) || !SOCCER_MODES.career) return
    let off = false
    import('../lib/career').then(({ loadCareer, syncCareerFromCloud }) => {
      if (off) return
      setCareer(loadCareer('soccer', user?.id))
      if (user?.id) syncCareerFromCloud('soccer', user.id).then(c => { if (!off) setCareer(c) })
    })
    return () => { off = true }
  }, [user?.id])
  const careerNew = useRef({ slot: 0, name: null })
  const startCareerBuild = useCallback(() => { handleStart('classic'); setPage('career-build') }, [handleStart])
  // ── TRAIT AUCTION (lib/auction.js, soccer's kit lib/soccerAuction.js): the striker, locked in while it's on ──
  const au = useAuction({ enabled: IS_APP || APP_LOOK, user, sport: 'soccer', pos: 'st' })
  const auctionLive = au.phase === 'auction'
  useEffect(() => {
    if (!auctionLive) return
    setLiveLock({
      title: 'Leave the auction?',
      body: `The auction goes on without you. You finish last: ${FORFEIT_RATING} rating, no XP or coins, and it counts as a loss.`,
      forfeit: () => au.forfeit(),
    })
    return () => setLiveLock(null)
  }, [auctionLive]) // eslint-disable-line react-hooks/exhaustive-deps
  const openCareer = useCallback(() => { setPage(SOCCER_MODES.career ? 'career-intro' : 'soon-career'); window.scrollTo({ top: 0, behavior: 'instant' }) }, [])
  openCareerRef.current = openCareer
  const enterDraft = useCallback(async () => {
    const { newCareer, saveCareer } = await import('../lib/career')
    const owner = getUsername(user) || 'Guest'
    const c = { ...newCareer({ sport: 'soccer', uid: user?.id ?? null, pos: 'st', build, name: careerNew.current.name || owner, slot: careerNew.current.slot, owner, games: careerNew.current.games, nation: careerNew.current.nation }), sandbox: !!isCustomMode, ...(careerNew.current.face ? { face: careerNew.current.face } : null) }
    saveCareer(c); setCareer(c); setGameMode(null); setBuild({}); setPage('career')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [user, build, isCustomMode])

  // the team spin lives in the season page's chunk: have it ready before it's needed
  useEffect(() => { if (buildPage || page === 'squad') import('./SoccerSimPage') }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── SALARY CAP (when SOCCER_MODES.salary): components/SoccerSalaryCap.jsx calls this with its picks ──
  // capBuild: the striker's ten traits from the picks; the season plays at once (a club from the
  // date, so View Results always shows the same season; Infinite: a club from the clock).
  // Like BucketApp: a fresh play earns season XP on the device and posts to the day's board.
  const handleSalaryCapConfirm = useCallback((capBuild, skipToEnd = false, dateStr = null, saveData = null) => {
    if (dateStr) setSalaryReturnDate(dateStr)
    setBuild(capBuild)
    const dateSeed = dateStr ? parseInt(dateStr.replace(/-/g, ''), 10) : Date.now()
    let h = dateSeed | 0; h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) | 0; h ^= h >>> 16
    const club = SOCCER_CLUBS[Math.floor(((h >>> 0) / 0x100000000) * SOCCER_CLUBS.length)]
    const result = SoccerSim.runSoccerSimulation(capBuild, activeTypes, club, 'current', dateSeed, 'salarycap')
    setSimResult(result)
    if ((IS_APP || APP_LOOK) && !skipToEnd) {
      window.dispatchEvent(new CustomEvent('bap:season', { detail: {
        sport: 'soccer', pos: 'st', mode: 'salarycap', localOnly: true, infinite: !!saveData?.infinite,
        wins: result.wins ?? 0, losses: result.losses ?? 0, playoffs: !!result.madePlayoffs,
        champion: !!result.champion, award: soccerAwardTags(result).length > 0, awardName: soccerAwardName(soccerAwardTags(result), SoccerSim.isUclResult?.(result)),
        ovr: result.ovr, ref: result,
      } }))
    }
    setSimInitialScreen(skipToEnd ? 'final' : 0)
    setPage('sim')
    window.scrollTo(0, 0)
    // the board: checked by the live server on its way in (lib/submit.js), with the season's OVR
    if (saveData?.userId && !saveData.noPost && supabase && !skipToEnd) {
      const row = {
        user_id: saveData.userId, username: saveData.username, picks: saveData.picks, overall_score: result.ovr,
        goals: saveData.goals, assists: saveData.assists, budget_used: saveData.totalCost,
      }
      saveSalary({ sport: 'soccer', infinite: !!saveData.infinite, date: dateStr, picks: saveData.picks, pos: 'st', sent: row },
        saveData.infinite ? row : { ...row, date_str: dateStr }, saveData.infinite ? 'soccer_salary_infinite_plays' : 'soccer_salary_cap_plays')
        .then(({ error }) => { if (error) console.error('[soccer-salary] save failed:', error) })
    }
  }, [activeTypes])
  useEffect(() => { if (START_ON_SALARY) handleStart('salarycap') }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Back / Forward (lib/routes.js): the page the address names, when it can still be shown; Home when it needs what's
  // gone. The dock's screens (/soccer/daily…) are AppTabBar's: the page stays.
  const popToRef = useRef(null)
  popToRef.current = ({ page: want, screen }) => {
    if (screen || want === page || !SOCCER_LIVE) return
    const built = !!gameMode && gameMode !== 'salarycap'
    const ok = !want ? false
      : want === 'profile' ? !!user
      : want === 'sim' ? !!simResult && !!gameMode
      : want === 'game' || want === 'squad-build' || want === 'career-build' ? built
      : want === 'career' ? !!careerRef.current
      : ['leaderboard', 'auction', 'career-intro', 'squad', 'privacy', 'salarycap', 'splash'].includes(want)
    if (ok && want === 'salarycap' && gameMode !== 'salarycap') { handleStart('salarycap'); return }
    setPage(ok ? want : 'splash')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  useEffect(() => onRoutePop('soccer', r => popToRef.current?.(r)), [])

  const handleDrop = useCallback(() => {
    const drag = activeDragRef.current
    if (!drag) return
    setBuild(prev => ({ ...prev, [drag.type]: drag }))
    setActiveDrag(null)
    setSpinResetKey(k => k + 1)
  }, [])

  const handleReset = useCallback(() => {
    leaveLive('soccer', markPlayed)
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

  // a build that already played its season goes back to that season (Back to Build can't re-roll it)
  const replayOrSpin = useCallback(() => {
    if ((IS_APP || APP_LOOK) && simResult && gameMode !== 'salarycap') { const v = readLive('soccer'); setSimInitialScreen(v && !v.booked && v.sig === buildSig(`soccer-${pool}-st`, build, activeTypes) ? 0 : 'final'); setPage('sim'); window.scrollTo({ top: 0, behavior: 'instant' }); return }
    setShowTeamSpin(true)
  }, [simResult, gameMode, build, activeTypes, pool])

  // The season is booked once (SoccerSimPage calls this when the league or the group has played out, or when it's left):
  // XP and coins, the board row. It never moves the page.
  const bookSeason = useCallback(result => {
    // (the season as played: with the moments on, the director's booked season, so View Results reopens that one)
    if (IS_APP || APP_LOOK) setSimResult(result)
    { const v = readLive('soccer'); if (v && !v.booked && v.sig === buildSig(`soccer-${pool}-st`, build, activeTypes)) bookLive(v, result) }
    // the save guard (lib/saveGuard.js): Sandbox in any form, or a build that already saved a season,
    // saves nothing and earns no XP or coins
    const saveMode = `soccer-${pool}`
    const saveBlock = blockReason({ mode: `${saveMode}-st`, build, types: activeTypes, pool: currentPool, sandboxOn: isCustomMode, tainted: sandboxTainted.current })
    if (IS_APP || APP_LOOK) {
      window.dispatchEvent(new CustomEvent('bap:season', { detail: {
        sport: 'soccer', pos: 'st', mode: gameMode,
        wins: result.wins ?? 0, losses: result.losses ?? 0, playoffs: !!result.madePlayoffs,
        champion: !!result.champion, award: soccerAwardTags(result).length > 0, awardName: soccerAwardName(soccerAwardTags(result), SoccerSim.isUclResult?.(result)), awards: soccerAwardTags(result),
        ovr: result.ovr, sandbox: !!saveBlock, ref: result,
      } }))
    }
    track('simulate', { app: 'soccer', position: 'st', gameMode, userId: user?.id ?? null })
    if (!supabase || !user || saveBlock) return
    markPlayed(buildSig(`${saveMode}-st`, build, activeTypes))
    saveSoccerSeason({ result, user, build, types: activeTypes, pool, gameMode })
  }, [build, activeTypes, user, gameMode, pool, isCustomMode, currentPool])
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
    const kept = (IS_APP || APP_LOOK) && page === 'game'
    const sig = buildSig(`soccer-${pool}-st`, build, activeTypes)
    // this build's season is already under way (a reload, or Simulate again): pick it back up, never a second run
    if (kept) {
      const v = readLive('soccer')
      if (v && !v.booked && v.sig === sig) {
        setSimResult(v.base); setSimInitialScreen(0); setShowTeamSpin(false); setPage('sim')
        window.scrollTo({ top: 0, behavior: 'instant' })
        return
      }
    }
    const result = SoccerSim.runSoccerSimulation(build, activeTypes, team, pool, null, 'classic')
    setSimResult(result)
    setSimInitialScreen(0)
    setShowTeamSpin(false)
    // kept on the device as it plays (lib/seasonLive.js)
    if (kept) startLive({ sig, mode: gameMode, pos: 'st', types: activeTypes, build, base: result, seed: Math.random().toString(36).slice(2, 8) }, 'soccer')
    // the new look books the season when it's been watched through the regular season (SoccerSimPage onFinal)
    if (IS_APP || APP_LOOK) { setPage('sim'); window.scrollTo({ top: 0, behavior: 'instant' }); return }
    commitRef.current?.(result)
  }, [build, activeTypes, pool, page, gameMode])
  // the kept season, for the sim page, when it's this build's (read as the page opens)
  const liveRec = useMemo(() => {
    if (page !== 'sim' || simInitialScreen !== 0 || !(IS_APP || APP_LOOK) || gameMode === 'salarycap') return null
    const v = readLive('soccer')
    return v && v.sig === buildSig(`soccer-${pool}-st`, build, activeTypes) ? v : null
  }, [page, simResult, simInitialScreen]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Starters Only (Sandbox, a plain build): one wheel of the pool's starters
  const startersOk = page !== 'career-build' && page !== 'squad-build' && (gameMode === 'classic' || gameMode === 'all-time')
  const startersOn = startersPick && isCustomMode && startersOk
  useEffect(() => { if (startersPick && !startersOn) setStartersPick(false) }, [startersPick, startersOn])
  const startersProp = startersOk && page === 'game' ? { on: startersOn, locked: spinPhase !== 'idle' || activeTypes.some(t => build[t]), onToggle: setStartersPick } : null
  const sandboxSwitch = on => {
    if (on || !startersOn) { handleSandboxToggle(on); return }
    handleSandboxToggle(false); setStartersPick(false); handleReset(); sandboxTainted.current = false
  }
  const sandboxProp = buildPage && (gameMode === 'classic' || gameMode === 'all-time') ? sandboxSwitch : undefined

  // the Custom Ratings sheet: both pools behind its toggle (Top Divisions / World Cup)
  const chipOf = (p, slot, val) => ({
    type: slot, val, qb: p.short || p.name, qbFull: p.name, team: p.team,
    teamColor: p.color, teamColor2: p.color2, skinColor: p.skin, number: p.number, faceCenter: p.faceCenter,
    photo: soccerPhoto(p), captain: false, sandbox: true, height: p.height ?? null, weight: p.weight ?? null,
  })
  const customModal = !showCustomModal ? null : (
    <CustomRatingsModal
      isSoccer attrMap={SOCCER_ATTR} eraLabels={[SOCCER_POOL.current.label.replace(/\b\w+/g, w => w[0] + w.slice(1).toLowerCase()), 'World Cup']}
      noPicks={startersOn} gameMode={gameMode}
      pool={CUSTOM_POOLS[pool]} poolCurrent={CUSTOM_POOLS.current} poolLegends={CUSTOM_POOLS.alltime}
      build={build} buildTypes={activeTypes}
      onClose={() => setShowCustomModal(false)}
      onSave={r => { setCustomRatings(r); try { localStorage.setItem('bas_soccer_custom_ratings', JSON.stringify(r)) } catch {} }}
      onAddToBuild={(p, o, slot) => { sandboxTainted.current = true; setBuild(prev => ({ ...prev, [slot]: chipOf(p, slot, o?.[slot] ?? p.attrs?.[slot] ?? 5) })) }}
      onAddAllToBuild={(p, o) => {
        sandboxTainted.current = true
        setBuild(prev => { const next = { ...prev }; activeTypes.forEach(slot => { if (!prev[slot]) next[slot] = chipOf(p, slot, o?.[slot] ?? p.attrs?.[slot] ?? 5) }); return next })
        setShowCustomModal(false)
      }}
    />
  )

  const KEEP_GAME_ON = new Set(['splash', 'profile', 'leaderboard', 'privacy', 'auction'])
  const gameIsPlay = page === 'game' || (KEEP_GAME_ON.has(page) && lastPlayRef.current === 'game')
  const filledCount = activeTypes.filter(t => build[t]).length
  const shareLink = useMemo(() => {
    if (!buildComplete) return null
    const code = encodeSoccerBuild(build, activeTypes, pool, POOL_PLAYERS)
    return code ? `${window.location.origin}/soccer?b=${code}` : `${window.location.origin}/soccer`
  }, [buildComplete, build, activeTypes, pool])
  const userName = getUsername(user) || 'Guest'

  const navbarProps = {
    gradesToggle: drop,
    onReset: handleReset,
    onHome: handleHome,
    onSignIn: () => setShowAuth(true),
    onProfile: () => (user ? setPage('profile') : setShowAuth(true)),
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
    isSoccer: true,
  }

  const renderGame = parked => (
    <>
      {!parked && soccerHead}
      {!parked && <Navbar {...navbarProps} />}
      <div className="game-page-scroll">
        {page === 'squad-build' && squad && <div className="cp-hud sq-hud" role="status"><span><small>SQUAD BUILDER · {squadSpotLabel(squad, squadBuilding.current)} · PLAYER {Math.min(squad.slots.length, squad.slots.length - squadLeft + 1)} OF {squad.slots.length}</small></span><span className="cp-hud-dots">{squad.slots.map(s => <i key={s.id} className={s.build ? 'is-in' : ''} />)}</span></div>}
        {IS_APP && !drop && <StackEdge view={mobileView} build={build} types={activeTypes} attrMap={SOCCER_ATTR} onFlip={flip} waiting={savedSpinResult?.selectedQB?.name ?? null} complete={buildComplete} />}
        {drop && <DropBar open={dropOpen} setOpen={setDropOpen} build={build} types={activeTypes} attrMap={SOCCER_ATTR} waiting={savedSpinResult?.selectedQB?.name ?? null} complete={buildComplete} />}
        <main className={`game-layout ${drop ? 'mobile-build ag-drop' : IS_APP ? 'mobile-build ag-stack' : `mobile-${mobileView}`}${gameMode === 'all-time' ? ' alltime-mode soccer-wc' : ''}`}>
          {(el => (drop ? <DropSheet open={dropOpen} setOpen={setDropOpen}>{el}</DropSheet> : el))(<SpinScreen
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
            onReset={handleReset}
            adsDisabled={adsDisabled}
            cardMeta={SOCCER_MODES.cards && (IS_APP || APP_LOOK) && gameIsPlay && gameMode !== 'salarycap' ? { sport: 'soccer', pos: 'st', mode: gameMode } : null}
            startersOnly={startersOn}
            key={`spin-${pool}`}
            paused={parked}
            isSoccer
            isAllTime={pool === 'alltime'}
            attrMap={SOCCER_ATTR}
            categoriesData={activeCategories}
            teamsPool={squadClubSpin ? SOCCER_CLUBS : TEAMS_OF[pool]}
            teamLabel={SOCCER_POOL[pool].team}
            getTeamSub={teamSub}
            getTeamDisplay={pool === 'alltime' && !squadClubSpin ? teamFlag : null}
            logoDir={logoDir}
            playerLabel="PLAYER"
            headshotsMap={{}}
            headshotsDir={`${HEADSHOT_BASE}/`}
            headshotFallback={() => null}
          />)}
          {IS_APP && !drop && <StackSeam build={build} types={activeTypes} onFlip={flip} />}
          <Silhouette
            isSoccer
            build={build}
            activeDrag={activeDrag}
            onDrop={handleDrop}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            types={activeTypes}
            onReset={handleReset}
            isPlus={isSubscribed}
            isCustomMode={isCustomMode}
            onOpenCustomModal={() => setShowCustomModal(true)}
            onSandboxToggle={sandboxProp}
            sandboxStarters={startersProp}
            attrMap={SOCCER_ATTR}
            categoriesData={activeCategories}
            figureRef={figureRef}
            logoDir={logoDir}
            kitNick={kitNick}
          />
          <div className="right-panel-wrap">
            <ReportCard
              isSoccer calcOvr={calcOvr} calcArch={archOf} sizeSlot={SOCCER_SIZE_SLOT} shareLink={shareLink}
              build={build}
              onSimulate={page === 'squad-build' ? squadNext : page === 'career-build' ? enterDraft : replayOrSpin}
              simLabel={page === 'squad-build' ? (squadLeft > 1 ? 'NEXT PLAYER' : squad?.team ? 'BACK TO THE SQUAD' : squad?.pool === 'alltime' ? 'PICK A NATION' : 'PICK A CLUB') : page === 'career-build' ? 'START THE CAREER' : pool === 'alltime' ? 'Play the World Cup' : undefined}
              onReset={handleReset}
              types={activeTypes}
              isPlus={isSubscribed}
              isCustomMode={isCustomMode}
              onOpenCustomModal={() => setShowCustomModal(true)}
              onSandboxToggle={sandboxProp}
              sandboxStarters={startersProp}
              attrMap={SOCCER_ATTR}
              logoDir={logoDir}
              isSalaryMode={gameMode === 'salarycap'}
            />
          </div>
        </main>
        <div className="build-footer-section">
          <SiteFeatures sport="soccer" className="build-site-features" />
          <SiteFooter sport="soccer" />
        </div>
      </div>

      {!parked && IS_APP && buildPage && <BuildComplete complete={buildComplete} ovr={buildComplete ? calcOvr(build, activeTypes) : 0} name={buildComplete ? archOf(calcOvr(build, activeTypes), build, activeTypes) : null} build={build} types={activeTypes} attrMap={SOCCER_ATTR} />}
      {!parked && showTeamSpin && <Suspense fallback={null}><SoccerTeamSpin pool={pool} isCustomMode={isCustomMode} onTeamSelected={handleTeamPicked} build={build} /></Suspense>}
      {!parked && squadPick && page === 'squad-build' && <Suspense fallback={null}><SoccerTeamSpin pool={squad?.pool === 'alltime' ? 'alltime' : 'current'} isCustomMode={false} onTeamSelected={squadPicked} build={build} anyTeam teams={squad?.pool === 'alltime' ? null : SOCCER_CLUBS} eyebrow="Squad Builder" /></Suspense>}
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
    return (
      <>
        {soccerHead}
        <Navbar {...navbarProps} />
        <Suspense fallback={null}>
          <SharedBuildPage build={SHARED.build} types={SHARED.types} attrMap={SOCCER_ATTR} logoDir={LOGO_DIR[SHARED.pool]}
            ovr={calcOvr(SHARED.build, SHARED.types)} arch={archOf(calcOvr(SHARED.build, SHARED.types), SHARED.build, SHARED.types)}
            height={SHARED.build[SOCCER_SIZE_SLOT]?.height ?? null} weight={SHARED.build[SOCCER_SIZE_SLOT]?.weight ?? null}
            onPlay={() => setPage('splash')} />
        </Suspense>
      </>
    )
  }

  if (page === 'splash' || !SOCCER_LIVE) {
    return withGame(
      <>
        {soccerHead}
        {!SOCCER_LIVE && <SoccerComingSoon />}
        {(IS_APP || APP_LOOK) ? (
          <AppHome
            sport="soccer"
            user={user}
            onStart={handleStart}
            onSquad={openSquad}
            squad={squad}
            onCareer={openCareer}
            career={career}
            onAuction={IS_APP || APP_LOOK ? () => setPage('auction') : null}
            soon={{ career: !SOCCER_MODES.career, salary: !SOCCER_MODES.salary, squad: !SOCCER_MODES.squad }}
            faces={HOME_FACES}
            resume={(gameMode && gameMode !== 'salarycap' && (simResult || Object.values(build).some(Boolean))) ? { label: `ST · ${SOCCER_POOL[pool].label}`, sub: simResult ? 'SEASON' : 'BUILD', onClick: () => window.dispatchEvent(new CustomEvent('bap:nav', { detail: 'play' })) } : null}
            footer={IS_APP ? null : <><SiteFeatures sport="soccer" /><SiteFooter sport="soccer" home /></>}
            renderBucketFigure={renderSoccerFigure}
          />
        ) : (
          <SoccerSplash onStart={handleStart} />
        )}
      </>
    )
  }

  // the modes still on their way to soccer: wired, with their page waiting (SOCCER_MODES)
  if (page.startsWith('soon-')) {
    const title = { career: 'CAREER', salary: 'SALARY CAP', squad: 'SQUAD BUILDER', boards: 'RANKS' }[page.slice(5)] ?? 'COMING SOON'
    return <SoccerSoon title={title} onBack={backHome} />
  }

  if (page === 'career-intro') {
    return (
      <Suspense fallback={null}>
        <CareerIntro sport="soccer" uid={user?.id ?? null} onOpen={c => { setCareer(c); setPage('career'); window.scrollTo({ top: 0, behavior: 'instant' }) }} onNew={(slot, name, _pos, games, nation, _spot, face) => { careerNew.current = { slot, name, games, nation, face }; startCareerBuild() }} onClose={backHome} />
      </Suspense>
    )
  }
  if (page === 'career' && career) {
    return <Suspense fallback={null}><AppCareer career={career} setCareer={setCareer} user={user} onNewBuild={openCareer} onExit={backHome} /></Suspense>
  }
  if (page === 'squad') {
    return (
      <Suspense fallback={null}>
        <AppSquad sport="soccer" squad={squad} setSquad={putSquad} user={user} onBuild={buildSquad} onExit={backHome}
          renderPicker={(onPick, b, sq) => <Suspense fallback={null}><SoccerTeamSpin pool={(sq ?? squad)?.pool === 'alltime' ? 'alltime' : 'current'} isCustomMode={!!squad?.sandbox} onTeamSelected={onPick} build={b} anyTeam teams={(sq ?? squad)?.pool === 'alltime' ? null : SOCCER_CLUBS} eyebrow="Squad Builder" /></Suspense>} />
      </Suspense>
    )
  }
  if (page === 'salarycap') {
    // SALARY CAP: the day's board (components/SoccerSalaryCap.jsx); its picks play a club season
    return (
      <Suspense fallback={null}>
        <SoccerSalaryCap onConfirm={handleSalaryCapConfirm} onBack={backHome} user={user} initialDateStr={salaryReturnDate} />
      </Suspense>
    )
  }

  if (page === 'sim') {
    return (
      <>
        <Navbar {...navbarProps} />
        <Suspense fallback={null}>
          <SoccerSimPage
            result={simResult}
            build={build}
            types={activeTypes}
            pool={pool}
            onBack={() => { setPage(gameMode === 'salarycap' ? 'salarycap' : 'game'); window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('.game-page-scroll')?.scrollTo({ top: 0, behavior: 'instant' }) }}
            onReset={handleReset}
            adsDisabled={adsDisabled}
            isSalaryMode={gameMode === 'salarycap'}
            initialScreen={simInitialScreen}
            live={liveRec}
            onFinal={(IS_APP || APP_LOOK) && gameMode !== 'salarycap' ? bookSeason : null}
            userName={userName}
            arch={archOf(simResult?.ovr ?? calcOvr(build, activeTypes), build, activeTypes)}
          />
        </Suspense>
      </>
    )
  }

  if (page === 'auction') {
    return withGame(
      <Suspense fallback={null}>
        <AppTraitAuction au={au} sport="soccer" position="st" positions={[{ pos: 'st', label: 'STRIKER' }]} onPosition={() => {}} onHome={() => setPage('splash')} />
      </Suspense>
    )
  }

  if (page === 'leaderboard') {
    // BOARDS: AppLeaderboards with sport 'soccer' once lib/boards.js has soccer's boards
    if (!SOCCER_MODES.boards) return withGame(<SoccerSoon title="RANKS" onBack={backHome} />)
    return withGame(<Suspense fallback={<div className="ag-screen ag-screen--wait" />}><AppLeaderboards sport="soccer" adsDisabled={adsDisabled} /></Suspense>)
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
    // PROFILE: the account, with the SOCCER section open (components/app/SoccerCareer.jsx) and the Trophy Case
    return withGame(
      <>
        <Suspense fallback={null}>
          <ProfilePage
            user={user} build={build} types={activeTypes} isPlus={isSubscribed} isSoccer
            onBack={() => { if (IS_APP || APP_LOOK) setPage('splash'); else window.history.back() }}
            onSignOut={() => { setUser(null); window.location.href = at('/soccer') }}
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
