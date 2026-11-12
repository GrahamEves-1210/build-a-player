import { seeded } from '../../lib/rng'
import { FIRST_NAMES, LAST_NAMES, pickName } from '../../lib/playerNames'
// College Football: the small shared pieces of the mode's screens (positions, labels, logos) and its saves.
//
// SAVING: a college season is kept on this device only (localStorage). Football's boards can't take it:
// the live server checks every saved season against its own NFL rosters (live/src/submit.js →
// lib/verifyCore.js checkSeason) and would turn a college build away, and football's profile and
// achievement queries read `simulations` by leaving modes out (ProfilePage's QB query, lib/progress.js
// counts), so college rows there would be counted as NFL seasons. College seasons get their own table
// instead: supabase/cfb_mode.sql (NOT run). saveSeasonCloud below is the hook: it does nothing until
// CFB_CLOUD is true, the SQL has been run, and the server checks college builds.
export const CFB_CLOUD = false

export const CFB_POS = {
  qb: { label: 'QB', name: 'Quarterback', fig: '/qb-silhouette.webp' },
  wr: { label: 'WR', name: 'Wide Receiver', fig: '/wr-silhouette.png' },
  rb: { label: 'RB', name: 'Running Back', fig: '/rb-silhouette.webp' },
}

// The pool a build's wheels deal from: this season's rosters, or each school's legends (data/cfb-legends.js).
// Only the wheels change: the offers, the season against today's schools and the draft are the same either way.
// Kept with the build ('pool' on the saved progress) and on every finished season, so an All-Time season is
// never read as a current one (the list on the first screen, bap_cfb_seasons, cfb_seasons.pool)
export const CFB_POOLS = {
  current: { label: 'Current', tag: null, sub: '2026 ROSTERS' },
  alltime: { label: 'All-Time', tag: 'ALL-TIME', sub: 'SCHOOL LEGENDS' },
}
export const poolOf = v => (v === 'alltime' ? 'alltime' : 'current')

const CLASS = { FR: 'Freshman', SO: 'Sophomore', JR: 'Junior', SR: 'Senior', GR: 'Graduate' }
// 'RS-JR' → 'Redshirt Junior', 'SO' → 'Sophomore'
export function classLabel(y) {
  if (!y) return null
  const s = String(y).toUpperCase()
  const rs = s.startsWith('RS')
  const base = CLASS[s.replace(/^RS-?/, '')] ?? s
  return rs ? `Redshirt ${base}` : base
}
// short form for tight rows: 'RS-JR' stays, 'JR' stays
export const classShort = y => (y ? String(y).toUpperCase() : '')

export const cfbLogo = short => (short ? `/logos/cfb/${String(short).replace(/^cfb\//, '')}.png` : '')
export const cfbLogoDark = short => (short ? `/logos/cfb/dark/${String(short).replace(/^cfb\//, '')}.png` : '')
export const confLogo = c => c?.logo ?? `/logos/cfb/conf-${c?.id ?? c?.short}.png`

// ── the build or season in progress ─────────────────────────────────────────
const PROGRESS = 'bap_cfb_progress'
export function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS))
    return p && CFB_POS[p.pos] && p.build ? p : null
  } catch { return null }
}
export function saveProgress(p) { try { localStorage.setItem(PROGRESS, JSON.stringify(p)) } catch {} }
export function clearProgress() { try { localStorage.removeItem(PROGRESS) } catch {} }

// ── finished seasons (this device) ──────────────────────────────────────────
const SEASONS = 'bap_cfb_seasons'
const KEEP = 60
export function seasonsLocal() { try { const a = JSON.parse(localStorage.getItem(SEASONS)); return Array.isArray(a) ? a : [] } catch { return [] } }

// a season, as the list keeps it (and as cfb_seasons would take it). r: runCFBSimulation's result
export function summaryOf(r, { pos, build, types, ovr, name, userName, pool = 'current' }) {
  const c = r.cfb ?? {}
  const H = c.awards?.heisman
  const ap = c.apPath ?? []
  return {
    at: Date.now(), pos, pool: poolOf(pool), ovr: r.ovr ?? ovr, archetype: name, player: userName,
    team: r.team?.short, teamName: r.team?.school ?? r.team?.name, conf: r.team?.conf ?? null,
    wins: c.record?.final ? +c.record.final.split('-')[0] : r.wins, losses: c.record?.final ? +c.record.final.split('-')[1] : r.losses,
    record: c.record?.final ?? `${r.wins}-${r.losses}`,
    finalRank: ap.length ? ap[ap.length - 1].rank ?? null : null,
    confChamp: !!c.confChamp, cfp: !!c.cfpSeed, cfpSeed: c.cfpSeed ?? null,
    title: !!r.champion, bowl: c.bowl?.bowl ?? null,
    heisman: !!H?.userWon, heismanFinalist: !!H?.userFinalist,
    allAmerican: c.awards?.allAmerica?.user ?? null,
    draft: c.draft?.label ?? null,
    seed: r.seed ?? null,
    build: Object.fromEntries(types.filter(t => build[t]).map(t => [t, { qb: build[t].qbFull, team: build[t].school, val: build[t].val }])),
  }
}

export function saveSeasonLocal(row, user) {
  try { localStorage.setItem(SEASONS, JSON.stringify([row, ...seasonsLocal()].slice(0, KEEP))) } catch {}
  saveSeasonCloud(row, user)
}

// THE HOOK (off): a signed-in player's season to its own table, never football's `simulations`
export async function saveSeasonCloud(row, user) {
  if (!CFB_CLOUD || !user?.id) return null
  const { supabase } = await import('../../lib/supabase')
  if (!supabase) return null
  return supabase.from('cfb_seasons').insert({
    user_id: user.id, position: row.pos, ovr: row.ovr, wins: row.wins, losses: row.losses, team: row.team, conf: row.conf,
    final_rank: row.finalRank, conf_champ: row.confChamp, cfp_seed: row.cfpSeed, national_champ: row.title,
    heisman: row.heisman, all_american: row.allAmerican, draft: row.draft, build: row.build,
    // (All-Time seasons carry their pool: the column is supabase/cfb_alltime.sql, NOT run. A current season sends
    // nothing and takes the column's default, so current saves work whether or not that file has been run)
    ...(row.pool === 'alltime' ? { pool: 'alltime' } : {}),
  })
}

// A finished college season, as lib/progress.js books any season ('bap:season'): XP, coins, missions and
// achievements by football's rules. sport 'cfb' keeps it out of the NFL counts (progress.js: cfbSeasons,
// never nflSeasons or positions), and localOnly because no database keeps it (Salary Cap's way).
// The ref is the result, so the season page's rewards panel (AppSeason SeasonRewards) finds it.
export function seasonEvent(r, pos, sandbox = false, pool = 'current') {
  const c = r.cfb ?? {}
  const [w, l] = String(c.record?.final ?? `${r.wins}-${r.losses}`).split('-').map(Number)
  return {
    sport: 'cfb', pos, mode: 'cfb', pool: poolOf(pool), localOnly: true, sandbox: !!sandbox,
    wins: w, losses: l, playoffs: !!c.cfpSeed, champion: !!r.champion,
    award: !!c.awards?.heisman?.userWon, awardName: 'Heisman',
    ovr: r.ovr, ref: r,
  }
}

// The one gap between a college grade and an NFL grade, both ways: going to college adds it (Start in College),
// the jump to the pros takes it off (Enter the NFL Draft). Two steps on every trait (A+ to A-, B to C+),
// physical, skill and mental alike (the owner's rule, 2026-11-10; it was a full letter, three steps, for a day);
// Size is his height and weight, the same at both levels
export const collegeGap = (pos, t) => (t === 'size' ? 0 : 2)

// The college season's draft projection, as the picks a Career's draft starts from (lib/career.js stockOf reads
// c.college.proj): the projection's own pick range; an undrafted grade is the last picks of the seventh round
// (Career drafts everyone: its draft has no free-agent pool)
// (a season saved before the projection carried picks: the whole of its tier's range)
const TIER_SPAN = { top10: [1, 10], r1: [11, 32], day2: [33, 96], day3: [97, 224] }
export const pickOf = draft => (Array.isArray(draft?.pick) ? draft.pick : draft?.pick === undefined ? TIER_SPAN[draft?.tier] ?? null : null)
export function draftProj(draft) {
  if (!draft) return null
  return pickOf(draft) ?? (draft.tier === 'pfa' ? [193, 224] : [212, 224])
}
// the projection in words: "Round 1 · Picks 1-5", "Rounds 2-3 · Picks 55-79", "Undrafted"
export function projText(draft) {
  const p = pickOf(draft)
  if (!Array.isArray(p)) return 'Undrafted'
  const a = Math.ceil(p[0] / 32), b = Math.ceil(p[1] / 32)
  return `${a === b ? `Round ${a}` : `Rounds ${a}-${b}`} · ${p[0] === p[1] ? `Pick ${p[0]}` : `Picks ${p[0]}-${p[1]}`}`
}

// a real player's headshot by name and school (the Heisman ceremony, the draft board): pools from lib/cfbLoad.js
export function photoLookup(pools, base) {
  const m = new Map()
  for (const k of ['qb', 'rb', 'wr']) for (const p of pools?.[k] ?? []) if (p.headshot) m.set(`${p.name}|${p.team}`, `${base}/${p.headshot}.webp`)
  return (name, school) => m.get(`${name}|${school}`) ?? null
}

// ── A later season's rosters (College Football mode and Career's Start in College: the second season on) ──────
// The country moves on a year with him, the way a roster really turns over:
//  · every senior (SR, RS-SR, GR) is gone, out of eligibility; a junior with a Day 2 grade or better (EARLY_OUT)
//    declares for the draft; everyone else moves up a class (FR → SO, RS-SO → RS-JR …) and is a year better: one
//    step on his two weakest traits (not his size), his overall moved by what that is worth.
//  · each school then fills the spots it lost. The data has no incoming classes, so the next man up is a made-up
//    player (gen: true, a name off lib/playerNames.js, no photo): modeled on the man he replaces, a step down on
//    about two traits in three, so a program stays the program it is and a new starter is a little greener than the
//    one who left. He's a freshman, a redshirt freshman, a sophomore or a junior out of the portal.
//  · each school's depth chart is rebuilt from who's there, best first.
// Every season is made from the one before it, with the same seeds for everybody: season three's rosters are the
// same country whoever plays it. seasonData(data, k): season k (0 = the first), the shared data untouched
const NEXT_CLASS = { FR: 'SO', SO: 'JR', JR: 'SR' }
const OUT_AFTER = new Set(['SR', 'GR', '5TH'])
const EARLY_OUT = { qb: 91, rb: 89, wr: 91 }   // a junior this good goes pro (about the draft board's Day 2 line)
const NEW_CLASS = ['FR', 'FR', 'RS-FR', 'RS-FR', 'SO', 'RS-SO', 'JR']
const toChips = attrs => Object.fromEntries(Object.entries(attrs ?? {}).map(([t, v]) => [t, { type: t, val: v }]))
function nextYear(pools, k, sim) {
  const ovrOf = (pos, attrs) => sim?.calcCFBOVR?.(toChips(attrs), Object.keys(attrs ?? {}), pos) ?? null
  // (a player's listed overall moves by what the change in his traits is worth on the build's own formula)
  const reOvr = (pos, p, attrs) => { const a = ovrOf(pos, p.attrs), b = ovrOf(pos, attrs); return a == null || b == null ? p.ovr : Math.max(40, Math.min(99, (p.ovr ?? b) + (b - a))) }
  return Object.fromEntries(Object.entries(pools).map(([pos, list]) => {
    const names = new Set(list.map(p => p.name))
    const by = {}
    for (const p of list) (by[p.team] ??= []).push(p)
    const out = []
    for (const [team, was] of Object.entries(by)) {
      const r = seeded(`cfb-roster-${k}-${pos}-${team}`)
      const room = []
      const gone = []
      for (const p of was) {
        const cur = String(p.year ?? 'SO').toUpperCase(), rs = cur.startsWith('RS-'), base = cur.replace(/^RS-/, '')
        if (OUT_AFTER.has(base) || !NEXT_CLASS[base] || (base === 'JR' && (p.ovr ?? 0) >= EARLY_OUT[pos])) { gone.push(p); continue }
        const weak = Object.keys(p.attrs ?? {}).filter(t => t !== 'size' && p.attrs[t] < 11).sort((a, b) => p.attrs[a] - p.attrs[b]).slice(0, 2)
        const attrs = { ...p.attrs, ...Object.fromEntries(weak.map(t => [t, p.attrs[t] + 1])) }
        room.push({ ...p, year: `${rs ? 'RS-' : ''}${NEXT_CLASS[base]}`, attrs, ovr: reOvr(pos, p, attrs) })
      }
      for (const old of gone) {
        const attrs = Object.fromEntries(Object.entries(old.attrs ?? {}).map(([t, v]) => { const x = r(); return [t, t === 'size' ? v : Math.max(1, v - (x < 0.4 ? 0 : x < 0.9 ? 1 : 2))] }))
        let name
        for (let i = 0; i < 12 && (!name || names.has(name)); i++) name = `${pickName(FIRST_NAMES, r)} ${pickName(LAST_NAMES, r)}`
        names.add(name)
        const { espn, headshot, s26, s25, captain, ...rest } = old   // (the man who left: his school, colors, number and frame stay with the spot)
        room.push({ ...rest, name, short: name.split(' ').pop(), year: NEW_CLASS[Math.floor(r() * NEW_CLASS.length)], attrs, ovr: reOvr(pos, old, attrs), gen: true })
      }
      room.sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || (a.depth ?? 9) - (b.depth ?? 9))
      room.forEach((p, i) => out.push({ ...p, depth: i + 1, starter: i === 0 }))
    }
    return [pos, out]
  }))
}
const seasonsCache = new WeakMap()
export function seasonData(data, season) {
  const k = Math.max(0, Math.min(8, Math.floor(season ?? 0)))
  if (!data || !k) return data
  const memo = seasonsCache.get(data) ?? new Map()
  seasonsCache.set(data, memo)
  if (!memo.has(k)) memo.set(k, { ...data, pools: nextYear(seasonData(data, k - 1).pools, k, data.sim), season: k })
  return memo.get(k)
}
