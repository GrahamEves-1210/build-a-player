// The Leaderboards page's data: which boards exist, and one board's rows.
//   loadBoard(id, { sport, position, friendIds, uid }) → { rows, error, mine }, never throws
//   peekBoard(id, opts)  the same result if it's in the cache, so a repeat visit paints at once
// Each board is one short read of an indexed or small table, cached here for 2 minutes and
// shared while in flight. Names, Pro badges and avatars come from one batched read of
// accounts (session cache, chunks of 150), shared by the boards loading at the same time.
// `mine` where a head count can't be exact (one row per player out of many seasons, or a
// list that only holds the top N) is only known while the player is inside the list read.
import { supabase } from './supabase'
import { seedCos } from './peopleCos'
import { tierFor, dayKey, weekOf, fetchWeeklyCup, POTD_COINS, CUP_COINS } from './progress'
import { LB_LIVE } from './lbLive'
import { OL_LIVE } from './olLive'

const TTL = 2 * 60 * 1000
const MAX_ROWS = 50
const CHUNK = 150
const ACCOUNT_COLS = 'id, username, cos, ads_disabled, subscription_status'

// ── Reads ─────────────────────────────────────────────────────────────────────
// A statement timeout (57014) is usually a cold start: one more try, then it's an error
async function read(build) {
  let r = await build()
  if (r.error?.code === '57014') {
    await new Promise(res => setTimeout(res, 700))
    r = await build()
  }
  if (r.error) throw r.error
  return r
}
const among = (q, col, ctx) => (ctx.ids ? q.in(col, ctx.ids) : q)
async function headCount(table, ctx, idCol, filter) {
  const { count } = await read(() => filter(among(supabase.from(table).select(idCol, { count: 'exact', head: true }), idCol, ctx)))
  return count ?? 0
}

// ── Cache ─────────────────────────────────────────────────────────────────────
const cache = new Map()   // key → { at, promise, value, done }
function memo(key, fn) {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.at < TTL) return hit.promise
  if (cache.size > 300) for (const [k, e] of cache) if (now - e.at >= TTL) cache.delete(k)
  const entry = { at: now, promise: null, value: null, done: false }
  entry.promise = Promise.resolve().then(fn).then(
    value => { entry.value = value; entry.done = true; return value },
    err => { if (cache.get(key) === entry) cache.delete(key); throw err },   // a failure is never kept
  )
  cache.set(key, entry)
  return entry.promise
}

// ── People: names, Pro and looks, from accounts ───────────────────────────────
const people = new Map()   // uid → { name, pro }
const asking = new Map()   // uid → the batch it's waiting on
let batch = null

function remember(r) {
  people.set(r.id, { name: r.username || null, pro: !!r.ads_disabled || r.subscription_status === 'active' })
  // {} for no look: cosFor would otherwise ask for this player again, one by one
  seedCos(r.id, r.cos || {})
}
async function flushBatch() {
  const { ids, done } = batch
  batch = null
  const chunks = []
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK))
  await Promise.all(chunks.map(async chunk => {
    try {
      const { data, error } = await supabase.from('accounts').select(ACCOUNT_COLS).in('id', chunk)
      if (error) return   // not remembered: the next board asks again
      for (const r of data ?? []) remember(r)
      for (const id of chunk) if (!people.has(id)) people.set(id, { name: null, pro: false })
    } catch {}
  }))
  ids.forEach(id => asking.delete(id))
  done()
}
function hydrate(ids) {
  const waits = new Set()
  for (const id of new Set(ids)) {
    if (!id || people.has(id)) continue
    if (!asking.has(id)) {
      if (!batch) {
        let done
        const promise = new Promise(res => { done = res })
        batch = { ids: [], promise, done }
        setTimeout(flushBatch, 30)
      }
      batch.ids.push(id)
      asking.set(id, batch.promise)
    }
    waits.add(asking.get(id))
  }
  return Promise.all(waits)
}

const cleanName = n => {
  const s = typeof n === 'string' ? n.trim() : ''
  return s && !/^you$/i.test(s) ? s : null
}
const display = v => Number(v).toLocaleString('en-US')
const plural = (n, word) => `${display(n)} ${word}${n === 1 ? '' : 's'}`
const finish = r => ({
  uid: r.uid ?? null,
  name: cleanName(people.get(r.uid)?.name) ?? cleanName(r.name) ?? 'Player',
  value: Number(r.value),
  display: r.display ?? display(r.value),
  sub: r.sub ?? null,
  coins: r.coins ?? null,
  pro: r.pro ?? !!people.get(r.uid)?.pro,
})

// A list holding several rows per player, best first → each player's best
function onePerPlayer(list) {
  const seen = new Set()
  return list.filter(r => {
    const who = r.uid || (cleanName(r.name) ? `name:${r.name.trim().toLowerCase()}` : null)
    if (!who || seen.has(who)) return false
    seen.add(who)
    return true
  })
}
const placed = (r, rank) => ({ rank, value: Number(r.value), display: r.display ?? display(r.value), sub: r.sub ?? null })
function mineInList(list, uid) {
  if (!uid) return null
  const i = list.findIndex(r => r.uid === uid)
  return i >= 0 ? placed(list[i], i + 1) : null
}
const onlyAmong = (list, ctx) => (ctx.ids ? list.filter(r => ctx.ids.includes(r.uid)) : list)

// ── Online ────────────────────────────────────────────────────────────────────
const ONLINE_COL = { rating: 'rating', peak: 'best', played: 'played' }
const onlineRow = (r, col) => ({
  uid: r.user_id,
  value: r[col],
  sub: tierFor(col === 'best' ? r.best : r.rating)[1],
})
async function onlineBoard(id, ctx) {
  const col = ONLINE_COL[id]
  const { data } = await read(() => among(supabase.from('online_ratings').select('user_id,rating,best,played').gt('played', 0), 'user_id', ctx)
    .order(col, { ascending: false }).limit(MAX_ROWS))
  const list = (data ?? []).map(r => onlineRow(r, col))
  let mine = mineInList(list, ctx.uid)
  if (!mine && ctx.uid) {
    const own = await memo(`own-rating|${ctx.uid}`, () => read(() => supabase.from('online_ratings').select('user_id,rating,best,played').eq('user_id', ctx.uid).maybeSingle()))
    if (own.data?.played > 0) {
      const ahead = await headCount('online_ratings', ctx, 'user_id', q => q.gt('played', 0).gt(col, own.data[col]))
      mine = placed(onlineRow(own.data, col), ahead + 1)
    }
  }
  return { list, mine }
}

// ── Today ─────────────────────────────────────────────────────────────────────
async function dailyBoard(ctx) {
  const key = dayKey()
  const { data } = await read(() => among(supabase.from('daily_challenge_results').select('user_id,username,ovr,created_at').eq('day', key), 'user_id', ctx)
    .order('ovr', { ascending: false }).order('created_at', { ascending: true }).limit(MAX_ROWS))
  const toRow = r => ({ uid: r.user_id, name: r.username, value: r.ovr, sub: null })
  const list = (data ?? []).map(toRow)
  let mine = mineInList(list, ctx.uid)
  if (!mine && ctx.uid) {
    const own = await read(() => supabase.from('daily_challenge_results').select('user_id,username,ovr,created_at').eq('day', key).eq('user_id', ctx.uid).maybeSingle())
    if (own.data) {
      const { ovr, created_at: at } = own.data
      const ahead = await headCount('daily_challenge_results', ctx, 'user_id', q => q.eq('day', key).or(`ovr.gt.${ovr},and(ovr.eq.${ovr},created_at.lt."${at}")`))
      mine = placed(toRow(own.data), ahead + 1)
    }
  }
  return { list, mine }
}
// board_cache rows are { id, username, cos, day: { d, xp, g } }; its fallback's are
// { id, username, cos } with the tally on cos.today
// Same tiebreaks as the Salary Cap screens' own boards (no `picks`: it's most of the row)
const GRID = {
  nfl: {
    daily: 'qb_salary_cap_plays', infinite: 'qb_salary_infinite_plays', cols: 'user_id,username,overall_score,pass_yds,pass_tds,ints',
    tie: r => [(r.pass_tds ?? 0) - (r.ints ?? 0), r.pass_yds ?? 0],
    sub: r => (r.pass_yds == null ? null : `${display(r.pass_yds)} YDS · ${r.pass_tds ?? 0} TD`),
  },
  bucket: {
    daily: 'salary_cap_plays', infinite: 'salary_infinite_plays', cols: 'user_id,username,overall_score,ppg,apg,rpg',
    tie: r => [(r.ppg ?? 0) + (r.apg ?? 0) + (r.rpg ?? 0), 0],
    sub: r => (r.ppg == null ? null : `${r.ppg} PPG · ${r.rpg ?? 0} RPG · ${r.apg ?? 0} APG`),
  },
}
const gridRows = (data, g) => [...(data ?? [])].sort((a, b) => {
  if (b.overall_score !== a.overall_score) return b.overall_score - a.overall_score
  const x = g.tie(a), y = g.tie(b)
  return y[0] - x[0] || y[1] - x[1]
}).map(r => ({ uid: r.user_id, name: r.username, value: r.overall_score, sub: g.sub(r) }))
async function gridBoard(ctx) {
  const g = GRID[ctx.sport], key = dayKey()
  const { data } = await read(() => among(supabase.from(g.daily).select(g.cols).eq('date_str', key), 'user_id', ctx)
    .order('overall_score', { ascending: false }).limit(100))
  const list = onePerPlayer(gridRows(data, g))
  let mine = mineInList(list, ctx.uid)
  if (!mine && ctx.uid && (data?.length ?? 0) >= 100) {
    const own = await read(() => supabase.from(g.daily).select(g.cols).eq('date_str', key).eq('user_id', ctx.uid).order('overall_score', { ascending: false }).limit(1))
    if (own.data?.[0]) {
      const ahead = await headCount(g.daily, ctx, 'user_id', q => q.eq('date_str', key).gt('overall_score', own.data[0].overall_score))
      mine = placed(gridRows(own.data, g)[0], ahead + 1)
    }
  }
  return { list, mine }
}

// ── Records ───────────────────────────────────────────────────────────────────
const MODES = {
  QB: ['classic', 'all-time'], RB: ['rb-classic', 'rb-all-time'], WR: ['wr-classic', 'wr-all-time'],
  TE: ['te-classic', 'te-all-time'], DB: ['db-classic', 'db-all-time'], DL: ['dl-classic', 'dl-all-time'], ...(LB_LIVE ? { LB: ['lb-classic', 'lb-all-time'] } : {}),
  ...(OL_LIVE ? { OL: ['ol-classic', 'ol-all-time'] } : {}),   // OL_LIVE: lib/olLive.js
}
const BUCKET_MODES = ['bucket-classic', 'bucket-all-time']
const modesFor = (sport, position) => (sport === 'bucket' ? BUCKET_MODES : MODES[position] ?? MODES.QB)
// The award a position's season pays (App.jsx awardType). Football only. RB, WR and TE share
// one counter on accounts (OPOY), so it can't be a record for any one of them. DL's (and LB's) DPOYs stay
// off classic_dpoys (that's DB's record): each one is a season tagged 'dpoy', counted from the seasons.
// OL's All-Pros have no counter at all: each one is a season tagged 'allpro'.
const AWARD = { QB: ['classic_mvps', 'MVP'], DB: ['classic_dpoys', 'DPOY'], DL: ['dl-classic', 'DPOY'], LB: ['lb-classic', 'DPOY'], OL: ['ol-classic', 'ALL-PRO'] }
const awardFor = (sport, position) => (sport === 'bucket' ? null : AWARD[position ?? 'QB'] ?? null)
// (salary_infinite_plays needs its overall_score index for this sort; it has had it since 11-03)
const BUCKET_INFINITE_INDEXED = true

// leaderboard_user_stats: one row per (game_mode, user_id), refreshed hourly
const STAT_COLS = 'user_id,username,wins,losses,rings,sims_count,total_ovr'
const STAT = {
  rings: { col: 'rings', sub: r => plural(r.sims_count ?? 0, 'season') },
  wins: { col: 'wins', sub: r => `${r.wins ?? 0}-${r.losses ?? 0}` },
  seasons: { col: 'sims_count', sub: r => (r.sims_count > 0 ? `${(r.total_ovr / r.sims_count).toFixed(1)} avg OVR` : null) },
}
async function statBoard(id, ctx, which = 0) {
  const { col, sub } = STAT[id], mode = modesFor(ctx.sport, ctx.position)[which]
  const toRow = r => ({ uid: r.user_id, name: r.username, value: r[col], sub: sub(r) })
  const { data } = await read(() => among(supabase.from('leaderboard_user_stats').select(STAT_COLS).eq('game_mode', mode).gt(col, 0), 'user_id', ctx)
    .order(col, { ascending: false }).limit(MAX_ROWS))
  const list = onePerPlayer((data ?? []).map(toRow))
  let mine = mineInList(list, ctx.uid)
  if (!mine && ctx.uid) {
    const own = await read(() => supabase.from('leaderboard_user_stats').select(STAT_COLS).eq('game_mode', mode).eq('user_id', ctx.uid).limit(1))
    const r = own.data?.[0]
    if (r?.[col] > 0) {
      const ahead = await headCount('leaderboard_user_stats', ctx, 'user_id', q => q.eq('game_mode', mode).gt(col, r[col]))
      mine = placed(toRow(r), ahead + 1)
    }
  }
  return { list, mine }
}
async function awardBoard(ctx) {
  const [col] = awardFor(ctx.sport, ctx.position)
  const toRow = r => ({ uid: r.id, name: r.username, value: r[col], sub: null })
  const { data } = await read(() => among(supabase.from('accounts').select(`${ACCOUNT_COLS}, ${col}`).gt(col, 0), 'id', ctx)
    .order(col, { ascending: false }).limit(MAX_ROWS))
  for (const r of data ?? []) remember(r)   // this read already has everything: nothing to hydrate
  const list = (data ?? []).map(toRow)
  let mine = mineInList(list, ctx.uid)
  if (!mine && ctx.uid) {
    const own = await read(() => supabase.from('accounts').select(`id, username, ${col}`).eq('id', ctx.uid).maybeSingle())
    if (own.data?.[col] > 0) {
      const ahead = await headCount('accounts', ctx, 'id', q => q.gt(col, own.data[col]))
      mine = placed(toRow(own.data), ahead + 1)
    }
  }
  return { list, mine }
}
async function dlAwardBoard(ctx, mode = 'dl-classic', tag = 'dpoy') {
  const { data } = await read(() => among(supabase.from('simulations').select('user_id,username').eq('game_mode', mode).eq('season_award', tag).not('build', 'is', null), 'user_id', ctx).limit(5000))
  const by = new Map()
  for (const r of data ?? []) if (r.user_id) by.set(r.user_id, { uid: r.user_id, name: r.username, value: (by.get(r.user_id)?.value ?? 0) + 1, sub: null })
  const list = [...by.values()].sort((a, b) => b.value - a.value)
  return { list, mine: mineInList(list, ctx.uid) }
}
async function gridBestBoard(ctx) {
  const g = GRID[ctx.sport]
  const best = only => read(() => only(among(supabase.from(g.infinite).select(g.cols), 'user_id', ctx))
    .order('overall_score', { ascending: false }).limit(100))
  // football's other positions play Infinite into the same table, tagged by pos
  // (supabase/salary_positions.sql): this board is QB's. Until that column exists the
  // table only has QB plays, so it's read as it is
  const { data } = ctx.sport === 'bucket' ? await best(q => q)
    : await best(q => q.eq('pos', 'qb')).catch(() => best(q => q))
  const list = onePerPlayer(gridRows(data, g))
  return { list, mine: mineInList(list, ctx.uid) }
}
async function depthBoard(ctx) {
  const { data } = await read(() => among(supabase.from('depth_chart_streaks').select('user_id,username,streak'), 'user_id', ctx)
    .order('streak', { ascending: false }).order('created_at', { ascending: true }).limit(100))
  const list = onePerPlayer((data ?? []).map(r => ({ uid: r.user_id, name: r.username, value: r.streak, sub: null })))
  return { list, mine: mineInList(list, ctx.uid) }
}

// ── The boards ────────────────────────────────────────────────────────────────
// scope: what the data depends on, so a board shared by sports or positions is one fetch
const sportScope = ctx => ctx.sport
const modeScope = ctx => modesFor(ctx.sport, ctx.position)[0]
const BOARDS = {
  rating: { load: ctx => onlineBoard('rating', ctx) },
  peak: { load: ctx => onlineBoard('peak', ctx) },
  played: { load: ctx => onlineBoard('played', ctx) },
  bt: { load: ctx => blacktopBoard(ctx, null) },
  bt1: { load: ctx => blacktopBoard(ctx, '1v1') },
  bt2: { load: ctx => blacktopBoard(ctx, '2v2') },
  bt3: { load: ctx => blacktopBoard(ctx, '3v3') },
  daily: { load: dailyBoard },
  potd: { load: potdBoard },
  cup: { load: cupBoard },
  grid: { scope: sportScope, load: gridBoard },
  rings: { scope: modeScope, load: ctx => statBoard('rings', ctx) },
  wins: { scope: modeScope, load: ctx => statBoard('wins', ctx) },
  ringsAll: { ok: ctx => !!modesFor(ctx.sport, ctx.position)[1], scope: ctx => modesFor(ctx.sport, ctx.position)[1], load: ctx => statBoard('rings', ctx, 1) },
  winsAll: { ok: ctx => !!modesFor(ctx.sport, ctx.position)[1], scope: ctx => modesFor(ctx.sport, ctx.position)[1], load: ctx => statBoard('wins', ctx, 1) },
  winPct: { scope: modeScope, load: ctx => rateBoard(ctx, RATE.winPct) },
  avgOvr: { scope: modeScope, load: ctx => rateBoard(ctx, RATE.avgOvr) },
  perSeason: { scope: modeScope, load: ctx => perSeasonBoard(ctx) },
  awards: { ok: ctx => !!awardFor(ctx.sport, ctx.position), scope: ctx => awardFor(ctx.sport, ctx.position)?.[0], load: ctx => (ctx.position === 'DL' ? dlAwardBoard(ctx) : ctx.position === 'LB' ? dlAwardBoard(ctx, 'lb-classic') : ctx.position === 'OL' ? dlAwardBoard(ctx, 'ol-classic', 'allpro') : awardBoard(ctx)) },
  gridBest: { ok: ctx => ctx.sport === 'nfl' || BUCKET_INFINITE_INDEXED, scope: sportScope, load: gridBestBoard },
  depth: { ok: ctx => ctx.sport === 'nfl', scope: sportScope, load: depthBoard },
}

function contextOf(opts) {
  const { sport, position, friendIds, uid } = opts ?? {}
  const ids = Array.isArray(friendIds) ? [...new Set(uid ? [...friendIds, uid] : friendIds)].sort() : null
  return { sport: sport === 'bucket' ? 'bucket' : 'nfl', position: position ? String(position).toUpperCase() : null, ids, uid: uid ?? null }
}
function keyOf(id, ctx) {
  return `${id}|${BOARDS[id]?.scope?.(ctx) ?? ''}|${ctx.uid ?? ''}|${ctx.ids ? ctx.ids.join(',') : '*'}`
}

// ── Exports ───────────────────────────────────────────────────────────────────
export function onlineBoards() {
  return [
    { id: 'rating', label: 'Online Rating', unit: 'ONLINE RATING' },
    { id: 'played', label: 'Games Played', unit: 'GAMES PLAYED' },
    { id: 'bt', label: 'Blacktop', unit: 'WINS' },
  ]
}
export function todayBoards() {
  return [
    { id: 'daily', label: 'Daily Puzzle', unit: 'OVR' },
    { id: 'potd', label: 'Players of the Day', unit: 'XP' },
    { id: 'cup', label: 'Weekly Cup', unit: 'PTS' },
    { id: 'grid', label: 'Daily Grid', unit: 'SCORE' },
  ]
}
// Blacktop's own choice: the total, or one size of game
export const blacktopModes = () => [{ id: 'bt', label: 'Total' }, { id: 'bt1', label: '1v1' }, { id: 'bt2', label: '2v2' }, { id: 'bt3', label: '3v3' }]
export function recordBoards(sport, position) {
  const ctx = contextOf({ sport, position })
  const award = awardFor(ctx.sport, ctx.position)
  return [
    { id: 'rings', label: 'Most Rings', unit: 'RINGS', group: 'CURRENT' },
    { id: 'wins', label: 'Most Wins', unit: 'WINS', group: 'CURRENT' },
    { id: 'winPct', label: 'Best Win %', unit: 'WIN %', group: 'CURRENT', note: `${MIN_SEASONS}+ SEASONS` },
    { id: 'avgOvr', label: 'Best Average OVR', unit: 'OVR', group: 'CURRENT', note: `${MIN_SEASONS}+ SEASONS` },
    { id: 'perSeason', label: perSeasonOf(ctx)[0], unit: perSeasonOf(ctx)[1], group: 'CURRENT', note: `${MIN_SEASONS}+ SEASONS` },
    ...(award ? [{ id: 'awards', label: `Most ${award[1]}s`, unit: `${award[1]}S`, group: 'CURRENT' }] : []),
    ...(modesFor(ctx.sport, ctx.position)[1] ? [
      { id: 'ringsAll', label: 'Most Rings', unit: 'RINGS', group: 'ALL-TIME' },
      { id: 'winsAll', label: 'Most Wins', unit: 'WINS', group: 'ALL-TIME' },
    ] : []),
    ...(BOARDS.gridBest.ok(ctx) ? [{ id: 'gridBest', label: 'Best Infinite Grid', unit: 'SCORE', group: 'MODES' }] : []),
    ...(BOARDS.depth.ok(ctx) ? [{ id: 'depth', label: 'Depth Chart Streak', unit: 'STREAK', group: 'MODES' }] : []),
  ]
}
// Basketball's filter only moves the two Best Season boards: the other records aren't kept by position
// (OL and LB only once they're live: MODES holds them only then)
export const positionsFor = sport => (sport === 'bucket' ? [] : Object.keys(MODES))

export async function loadBoard(id, opts) {
  const ctx = contextOf(opts)
  try {
    return await memo(keyOf(id, ctx), async () => {
      const def = BOARDS[id]
      if (!def || !supabase || (def.ok && !def.ok(ctx))) throw new Error(`no board ${id}`)
      if (ctx.ids && !ctx.ids.length) return { rows: [], error: false, mine: null }
      const { list, mine } = await def.load(ctx)
      const top = list.filter(r => r.value != null).slice(0, MAX_ROWS)
      await hydrate(top.map(r => r.uid))
      return { rows: top.map(finish), error: false, mine }
    })
  } catch {
    return { rows: [], error: true, mine: null }
  }
}

export function peekBoard(id, opts) {
  const e = cache.get(keyOf(id, contextOf(opts)))
  return e && e.done && Date.now() - e.at < TTL ? e.value : null
}

// Last week's Weekly Cup winner: only the first entry of its cache row
// Players of the Day: the top 20 (the Home board and the payout are still the top 5, from board_cache)
const POTD_SHOWN = 20
async function potdBoard(ctx) {
  const key = dayKey()
  const { data } = await read(() => among(supabase.from('accounts').select('id,username,cos').eq('cos->today->>d', key), 'id', ctx)
    .order('cos->today->xp', { ascending: false }).limit(POTD_SHOWN))
  const list = (data ?? []).filter(r => Number(r.cos?.today?.xp) > 0).map((r, i) => {
    const t = r.cos.today
    // (a prize is for a place on the whole board, so a friends-only list shows none)
    return { uid: r.id, name: r.username, value: Number(t.xp), sub: t.g != null ? plural(t.g, 'game') : null, coins: ctx.ids ? null : POTD_COINS[i] ?? null }
  })
  return { list, mine: mineInList(list, ctx.uid) }
}
async function cupBoard(ctx) {
  const week = weekOf()
  const res = await memo(`raw-cup|${week}`, async () => {
    const r = await fetchWeeklyCup(week)
    if (r.error) throw new Error('cup')
    return r
  })
  const all = (res.rows ?? []).map((r, i) => ({ uid: r.user_id, name: r.username, value: Number(r.total) || 0, sub: r.days != null ? plural(Number(r.days), 'day') : null, coins: CUP_COINS[i] ?? null }))
  const list = onlyAmong(all, ctx)
  return { list, mine: mineInList(list, ctx.uid) }
}

// Blacktop, from the games the live server books (bots never count). Wins first, then fewest losses;
// a forfeit is a loss. All of it is one read, sliced by mode.
const blacktopRows = () => memo('raw-blacktop', async () => {
  const { data } = await read(() => supabase.from('vs_results').select('user_id,username,result,match_type').in('match_type', ['1v1', '2v2', '3v3']).limit(10000))
  return data ?? []
})
async function blacktopBoard(ctx, mode) {
  const by = new Map()
  for (const r of await blacktopRows()) {
    if (!r.user_id || (mode && r.match_type !== mode)) continue
    const o = by.get(r.user_id) ?? { uid: r.user_id, name: r.username, w: 0, l: 0 }
    if (r.result === 'win') o.w++; else o.l++
    by.set(r.user_id, o)
  }
  const all = onlyAmong([...by.values()].filter(o => o.w > 0).sort((a, b) => b.w - a.w || a.l - b.l), ctx)
    .map(o => ({ uid: o.uid, name: o.name, value: o.w, sub: `${o.w}-${o.l}` }))
  return { list: all, mine: mineInList(all, ctx.uid) }
}

// The records that take a real career to hold: rates, over everyone with enough seasons to count
export const MIN_SEASONS = 50
const qualified = (ctx, mode) => memo(`raw-q|${mode}|${ctx.ids ? ctx.ids.join() : '*'}`, async () => {
  const { data } = await read(() => among(supabase.from('leaderboard_user_stats').select('user_id,username,wins,losses,sims_count,total_ovr,total_pass_yds,total_tds,total_ppg').eq('game_mode', mode).gte('sims_count', MIN_SEASONS), 'user_id', ctx).limit(5000))
  return data ?? []
})
const seasonsOf = r => plural(r.sims_count, 'season')
const RATE = {
  winPct: { value: r => (r.wins + r.losses > 0 ? (r.wins / (r.wins + r.losses)) * 100 : null), display: v => `${v.toFixed(1)}%`, sub: r => `${display(r.wins)}-${display(r.losses)}` },
  avgOvr: { value: r => r.total_ovr / r.sims_count, display: v => v.toFixed(1), sub: seasonsOf },
}
// A season's production, by position. WR/TE keep receiving yards in total_pass_yds, RB rushing yards,
// DB tackles (with interceptions in total_tds), DL and LB tackles (with sacks in total_tds), OL pancakes (with sacks allowed
// in total_tds): see the simulations insert in App.jsx
const PER_SEASON = {
  QB: ['Passing Yards a Season', 'YDS', 'total_pass_yds', 0], RB: ['Rushing Yards a Season', 'YDS', 'total_pass_yds', 0],
  WR: ['Receiving Yards a Season', 'YDS', 'total_pass_yds', 0], TE: ['Receiving Yards a Season', 'YDS', 'total_pass_yds', 0],
  DB: ['Interceptions a Season', 'INT', 'total_tds', 1], DL: ['Sacks a Season', 'SCK', 'total_tds', 1], LB: ['Tackles a Season', 'TKL', 'total_pass_yds', 0], OL: ['Pancakes a Season', 'PNK', 'total_pass_yds', 0], bucket:['Points a Game', 'PPG', 'total_ppg', 1],
}
const perSeasonOf = ctx => PER_SEASON[ctx.sport === 'bucket' ? 'bucket' : ctx.position ?? 'QB'] ?? PER_SEASON.QB
async function rateBoard(ctx, rate) {
  const rows = await qualified(ctx, modesFor(ctx.sport, ctx.position)[0])
  const list = rows.map(r => {
    const v = rate.value(r)
    return v == null || !Number.isFinite(v) ? null : { uid: r.user_id, name: r.username, value: v, display: rate.display(v), sub: rate.sub(r) }
  }).filter(Boolean).sort((a, b) => b.value - a.value)
  return { list, mine: mineInList(list, ctx.uid) }
}
const perSeasonBoard = ctx => {
  const [, , col, dp] = perSeasonOf(ctx)
  return rateBoard(ctx, { value: r => (Number(r[col]) || 0) / r.sims_count, display: v => v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp }), sub: seasonsOf })
}

export async function lastWeekChampion() {
  if (!supabase) return null
  const week = weekOf(dayKey(-7))
  try {
    return await memo(`champion|${week}`, async () => {
      const { data } = await read(() => supabase.from('board_cache').select('top:rows->0').eq('kind', 'cup').eq('day', week).maybeSingle())
      const t = data?.top
      if (!t?.user_id) return null
      await hydrate([t.user_id])
      return { name: finish({ uid: t.user_id, name: t.username, value: 0 }).name, uid: t.user_id, display: display(t.total ?? 0) }
    })
  } catch {
    return null
  }
}
