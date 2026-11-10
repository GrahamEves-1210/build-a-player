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
export function summaryOf(r, { pos, build, types, ovr, name, userName }) {
  const c = r.cfb ?? {}
  const H = c.awards?.heisman
  const ap = c.apPath ?? []
  return {
    at: Date.now(), pos, ovr: r.ovr ?? ovr, archetype: name, player: userName,
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
  })
}

// A finished college season, as lib/progress.js books any season ('bap:season'): XP, coins, missions and
// achievements by football's rules. sport 'cfb' keeps it out of the NFL counts (progress.js: cfbSeasons,
// never nflSeasons or positions), and localOnly because no database keeps it (Salary Cap's way).
// The ref is the result, so the season page's rewards panel (AppSeason SeasonRewards) finds it.
export function seasonEvent(r, pos, sandbox = false) {
  const c = r.cfb ?? {}
  const [w, l] = String(c.record?.final ?? `${r.wins}-${r.losses}`).split('-').map(Number)
  return {
    sport: 'cfb', pos, mode: 'cfb', localOnly: true, sandbox: !!sandbox,
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

// ── A later season's rosters (College Football mode: RETURN TO SCHOOL / TRANSFER) ─────────────────────────
// The country moves on a year with him: every junior and senior (RS-JR, RS-SR and GR too) is gone, drafted or out
// of eligibility, and everyone else moves up a class (FR → SO, RS-FR → RS-SO, SO → JR …). Each school's depth chart
// is rebuilt from who's left, best first, so its starters are the best of the old sophomores and freshmen.
// Ratings stay as they are (no development bump: a sophomore who starts is the player he was). A room nobody is
// left in stays empty: the season engine plays a stand-in at the school's level there (cfbSimulation unitFor),
// and the job reads as open. seasonData(data, k): season k (0 = the first), the shared data untouched
const NEXT_CLASS = { FR: 'SO', SO: 'JR', JR: 'SR', SR: 'SR', GR: 'GR' }
const GONE_AFTER = new Set(['JR', 'SR', 'GR', '5TH'])
function classAfter(y, k) {
  let cur = String(y ?? 'SO').toUpperCase()
  for (let i = 0; i < k; i++) {
    const rs = cur.startsWith('RS-')
    const base = cur.replace(/^RS-/, '')
    if (GONE_AFTER.has(base)) return null
    cur = `${rs ? 'RS-' : ''}${NEXT_CLASS[base] ?? base}`
  }
  return cur
}
function advancePools(pools, k) {
  return Object.fromEntries(Object.entries(pools).map(([pos, list]) => {
    const stay = list.map(p => ({ p, year: classAfter(p.year, k) })).filter(x => x.year)
    const by = {}
    for (const x of stay) (by[x.p.team] ??= []).push(x)
    const out = []
    for (const room of Object.values(by)) {
      room.sort((a, b) => (b.p.ovr ?? 0) - (a.p.ovr ?? 0) || (a.p.depth ?? 9) - (b.p.depth ?? 9))
      room.forEach((x, i) => out.push({ ...x.p, year: x.year, depth: i + 1, starter: i === 0 }))
    }
    return [pos, out]
  }))
}
// (the rosters run out of underclassmen after two moves: the freshmen of the first season are the juniors of the third.
// The data has no incoming classes, so a fourth season on plays the third season's rosters again)
const MAX_ADVANCE = 2
const seasonsCache = new WeakMap()
export function seasonData(data, season) {
  const k = Math.min(MAX_ADVANCE, season ?? 0)
  if (!data || !k) return data
  const memo = seasonsCache.get(data) ?? new Map()
  seasonsCache.set(data, memo)
  if (!memo.has(k)) memo.set(k, { ...data, pools: advancePools(data.pools, k), season: k })
  return memo.get(k)
}
