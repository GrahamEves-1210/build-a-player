// College Basketball: the small shared pieces of the mode's screens (positions, labels, logos) and its saves.
// The basketball counterpart of components/cfb/cfbShared.js, piece for piece.
//
// SAVING: a college season is kept on this device only (localStorage), as College Football's is, and for the same
// reasons: the live server checks every saved season against its own NBA rosters, and basketball's profile and
// achievement queries read `simulations` by leaving modes out. College seasons get their own table instead:
// supabase/cbb_mode.sql (NOT run). saveSeasonCloud below is the hook: it does nothing until CBB_CLOUD is true,
// the SQL has been run, and the server checks college builds.
import { seeded } from '../../lib/rng'
import { FIRST_NAMES, LAST_NAMES, pickName } from '../../lib/playerNames'
export const CBB_CLOUD = false

export const CBB_POS = {
  guard: { label: 'G', name: 'Guard', fig: '/basketballsilhouette.png', group: 'GUARDS AND WINGS' },
  big: { label: 'BIG', name: 'Big', fig: '/basketballsilhouette.png', group: 'BIGS' },
}

// The pool a build's wheels deal from: this season's rosters, or each school's legends (data/cbb-legends.js).
// Only the wheels change: the offers, the season against today's schools and the draft are the same either way.
export const CBB_POOLS = {
  current: { label: 'Current', tag: null, sub: '2026-27 ROSTERS' },
  alltime: { label: 'All-Time', tag: 'ALL-TIME', sub: 'SCHOOL LEGENDS' },
}
export const poolOf = v => (v === 'alltime' ? 'alltime' : 'current')

const CLASS = { FR: 'Freshman', SO: 'Sophomore', JR: 'Junior', SR: 'Senior', GR: 'Graduate' }
export const classLabel = y => (y ? CLASS[String(y).toUpperCase()] ?? String(y).toUpperCase() : null)

// Logos: a school College Football has keeps its files there (public/logos/cfb/), the rest are in public/logos/cbb/.
// The data's rows carry the path; the screens ask by the school's code once the data has loaded (registerLogos)
const LOGOS = {}
export function registerLogos(...lists) { for (const list of lists) for (const t of list ?? []) LOGOS[t.short] = t }
// (a chip's team is its logo's place under /logos/: 'cfb/DUKE' or 'cbb/GONZ', logoKey; the school's code alone works too)
export const logoKey = short => { const p = LOGOS[short]?.logo; return p ? p.replace('/logos/', '').replace('.png', '') : `cbb/${short}` }
export const cbbLogo = short => { const k = String(short ?? '').replace(/^c[bf]b\//, ''); return k ? LOGOS[k]?.logo ?? `/logos/cbb/${k}.png` : '' }
export const cbbLogoDark = short => { const k = String(short ?? '').replace(/^c[bf]b\//, ''); return k ? LOGOS[k]?.logoDark ?? LOGOS[k]?.logo ?? `/logos/cbb/${k}.png` : '' }
export const confLogo = c => c?.logo ?? `/logos/cbb/conf-${c?.id ?? c?.short}.png`

// ── the build or season in progress ─────────────────────────────────────────
const PROGRESS = 'bap_cbb_progress'
export function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS))
    return p && CBB_POS[p.pos] && p.build ? p : null
  } catch { return null }
}
export function saveProgress(p) { try { localStorage.setItem(PROGRESS, JSON.stringify(p)) } catch {} }
export function clearProgress() { try { localStorage.removeItem(PROGRESS) } catch {} }

// ── finished seasons (this device) ──────────────────────────────────────────
const SEASONS = 'bap_cbb_seasons'
const KEEP = 60
export function seasonsLocal() { try { const a = JSON.parse(localStorage.getItem(SEASONS)); return Array.isArray(a) ? a : [] } catch { return [] } }

// how far the season went, in a few words: the Home card, the recent-seasons list, the saved row
export function finishOf(r) {
  const c = r?.cbb ?? {}
  if (r?.champion) return 'National champions'
  const x = c.ncaa?.exit
  if (c.ncaa?.seed && x) return x === 'National Championship' ? 'National runner-up' : x === 'Final Four' ? 'Final Four' : x === 'Elite Eight' ? 'Elite Eight' : x === 'Sweet 16' ? 'Sweet 16' : x === 'Second Round' ? 'NCAA second round' : x === 'First Four' ? 'First Four' : 'NCAA first round'
  if (c.nit) return c.nit.won ? 'NIT champions' : 'NIT'
  return 'No postseason'
}
// a season, as the list keeps it (and as cbb_seasons would take it). r: runCBBSimulation's result
export function summaryOf(r, { pos, build, types, ovr, name, userName, pool = 'current' }) {
  const c = r.cbb ?? {}
  const W = c.awards?.wooden
  const ap = c.apPath ?? []
  const [w, l] = String(c.record?.final ?? `${r.wins}-${r.losses}`).split('-').map(Number)
  return {
    at: Date.now(), pos, pool: poolOf(pool), ovr: r.ovr ?? ovr, archetype: name, player: userName,
    team: r.team?.short, teamName: r.team?.school ?? r.team?.name, conf: r.team?.conf ?? null,
    wins: w, losses: l, record: `${w}-${l}`,
    finalRank: ap.length ? ap[ap.length - 1].rank ?? null : null,
    confChamp: !!c.confChamp, ncaa: !!c.ncaa?.seed, ncaaSeed: c.ncaa?.seed ?? null, finish: finishOf(r), finalFour: ['Final Four', 'National Championship'].includes(c.ncaa?.exit),
    title: !!r.champion,
    wooden: !!W?.userWon, woodenFinalist: !!W?.userFinalist,
    allAmerican: c.awards?.allAmerica?.user ?? null,
    ppg: r.ppg, rpg: r.rpg, apg: r.apg,
    draft: c.draft?.label ?? null,
    seed: r.seed ?? null,
    build: Object.fromEntries(types.filter(t => build[t]).map(t => [t, { p: build[t].qbFull, team: build[t].school, val: build[t].val }])),
  }
}
export function saveSeasonLocal(row, user) {
  try { localStorage.setItem(SEASONS, JSON.stringify([row, ...seasonsLocal()].slice(0, KEEP))) } catch {}
  saveSeasonCloud(row, user)
}
// THE HOOK (off): a signed-in player's season to its own table, never basketball's `simulations`
export async function saveSeasonCloud(row, user) {
  if (!CBB_CLOUD || !user?.id) return null
  const { supabase } = await import('../../lib/supabase')
  if (!supabase) return null
  return supabase.from('cbb_seasons').insert({
    user_id: user.id, position: row.pos, pool: row.pool, ovr: row.ovr, wins: row.wins, losses: row.losses, team: row.team, conf: row.conf,
    final_rank: row.finalRank, conf_champ: row.confChamp, ncaa_seed: row.ncaaSeed, finish: row.finish, national_champ: row.title,
    wooden: row.wooden, all_american: row.allAmerican, ppg: row.ppg, rpg: row.rpg, apg: row.apg, draft: row.draft, build: row.build,
  })
}

// A finished college season, as lib/progress.js books any season ('bap:season'): XP, coins, missions and
// achievements by the game's rules. sport 'cbb' keeps it out of the NBA counts (progress.js: cbbSeasons, never
// bucketSeasons), and localOnly because no database keeps it.
export function seasonEvent(r, pos, sandbox = false, pool = 'current') {
  const c = r.cbb ?? {}
  const [w, l] = String(c.record?.final ?? `${r.wins}-${r.losses}`).split('-').map(Number)
  return {
    sport: 'cbb', pos, mode: 'cbb', pool: poolOf(pool), localOnly: true, sandbox: !!sandbox,
    wins: w, losses: l, playoffs: !!c.ncaa?.seed, champion: !!r.champion,
    award: !!c.awards?.wooden?.userWon, awardName: 'Wooden Award',
    ovr: r.ovr, ref: r,
  }
}

// The one gap between a college grade and an NBA grade, both ways (the owner's rule for College Football,
// 2026-11-10, kept here): two steps on every trait (A+ to A-, B to C+); Size is his height and weight, the same
// at both levels
export const collegeGap = (pos, t) => (t === 'size' ? 0 : 2)

// The college season's draft projection, as the picks a Career's draft starts from (lib/career.js stockOf reads
// c.college.proj): the projection's own pick range of the NBA's 60; an undrafted grade is the last picks of the
// second round (Career drafts everyone: its draft has no free-agent pool)
export const pickOf = draft => (Array.isArray(draft?.pick) ? draft.pick : null)
export const draftProj = draft => (draft ? pickOf(draft) ?? [54, 60] : null)
// the projection in words: "Round 1 · Picks 3-5", "Rounds 1-2 · Picks 26-36", "Undrafted"
export function projText(draft) {
  const p = pickOf(draft)
  if (!Array.isArray(p)) return 'Undrafted'
  const a = Math.ceil(p[0] / 30), b = Math.ceil(p[1] / 30)
  return `${a === b ? `Round ${a}` : `Rounds ${a}-${b}`} · ${p[0] === p[1] ? `Pick ${p[0]}` : `Picks ${p[0]}-${p[1]}`}`
}

// a real player's headshot by name and school (the Wooden ceremony, the draft board)
export function photoLookup(pools, base) {
  const m = new Map()
  for (const k of ['guard', 'big']) for (const p of pools?.[k] ?? []) if (p.headshot) m.set(`${p.name}|${p.team}`, `${base}/${p.headshot}.webp`)
  return (name, school) => m.get(`${name}|${school}`) ?? null
}

// ── A later season's rosters (the second season on) ───────────────────────────────────────────────────────────
// The country moves on a year with him, the way a college basketball roster turns over:
//  · every senior is gone; anyone good enough to be a first-round pick declares, whatever his class (EARLY_OUT: a
//    freshman goes one-and-done at a lower bar than a junior, the way the draft pays for youth); everyone else moves
//    up a class and is a year better: one step on his two weakest traits (not his size).
//  · each school fills the spots it lost with a made-up player (gen: true, a name off lib/playerNames.js, no
//    photo): modeled on the man he replaces, a step down on about two traits in three, so a program stays the
//    program it is. He's a freshman, a sophomore or a junior out of the portal.
//  · each school's guards and bigs are put back in order, best first; the starters keep their count.
// Every season is made from the one before it, with the same seeds for everybody. seasonData(data, k): season k
// (0 = the first), the shared data untouched
const NEXT_CLASS = { FR: 'SO', SO: 'JR', JR: 'SR' }
const EARLY_OUT = { FR: 89, SO: 91, JR: 93 }
const NEW_CLASS = ['FR', 'FR', 'FR', 'SO', 'SO', 'JR']
const toChips = attrs => Object.fromEntries(Object.entries(attrs ?? {}).map(([t, v]) => [t, { type: t, val: v }]))
function nextYear(pools, k, sim) {
  const ovrOf = (pos, attrs) => sim?.calcCBBOVR?.(toChips(attrs), Object.keys(attrs ?? {}), pos) ?? null
  const reOvr = (pos, p, attrs) => { const a = ovrOf(pos, p.attrs), b = ovrOf(pos, attrs); return a == null || b == null ? p.ovr : Math.max(40, Math.min(99, (p.ovr ?? b) + (b - a))) }
  return Object.fromEntries(Object.entries(pools).map(([pos, list]) => {
    const names = new Set(list.map(p => p.name))
    const by = {}
    for (const p of list) (by[p.team] ??= []).push(p)
    const out = []
    for (const [team, was] of Object.entries(by)) {
      const r = seeded(`cbb-roster-${k}-${pos}-${team}`)
      const starters = was.filter(p => p.starter).length
      const room = []
      const gone = []
      for (const p of was) {
        const cls = String(p.year ?? 'SO').toUpperCase()
        if (!NEXT_CLASS[cls] || (p.ovr ?? 0) >= EARLY_OUT[cls]) { gone.push(p); continue }
        const weak = Object.keys(p.attrs ?? {}).filter(t => t !== 'size' && p.attrs[t] < 11).sort((a, b) => p.attrs[a] - p.attrs[b]).slice(0, 2)
        const attrs = { ...p.attrs, ...Object.fromEntries(weak.map(t => [t, p.attrs[t] + 1])) }
        room.push({ ...p, year: NEXT_CLASS[cls], attrs, ovr: reOvr(pos, p, attrs) })
      }
      for (const old of gone) {
        const attrs = Object.fromEntries(Object.entries(old.attrs ?? {}).map(([t, v]) => { const x = r(); return [t, t === 'size' ? v : Math.max(1, v - (x < 0.4 ? 0 : x < 0.9 ? 1 : 2))] }))
        let name
        for (let i = 0; i < 12 && (!name || names.has(name)); i++) name = `${pickName(FIRST_NAMES, r)} ${pickName(LAST_NAMES, r)}`
        names.add(name)
        const { espn, headshot, s27, s26, recruit, captain, ...rest } = old   // (the man who left: his school, colors, number and frame stay with the spot)
        room.push({ ...rest, name, short: name.split(' ').pop(), year: NEW_CLASS[Math.floor(r() * NEW_CLASS.length)], attrs, ovr: reOvr(pos, old, attrs), gen: true })
      }
      room.sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || (a.depth ?? 9) - (b.depth ?? 9))
      room.forEach((p, i) => out.push({ ...p, depth: i + 1, starter: i < starters }))
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
