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
import { tierFor, dayKey, weekOf, fetchPlayersOfDay, fetchWeeklyCup } from './progress'

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
const askedNames = new Map()   // lower-case username → uid | null (h2h rows only have a name)
let batch = null

function remember(r) {
  people.set(r.id, { name: r.username || null, pro: !!r.ads_disabled || r.subscription_status === 'active' })
  if (r.username) askedNames.set(r.username.toLowerCase(), r.id)
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
// Head-to-head names: no user_id on those rows, so the Pro badge goes by the current username
async function hydrateNames(names) {
  const need = [...new Set(names.filter(n => !askedNames.has(n.toLowerCase())))]
  if (!need.length) return
  try {
    const { data, error } = await supabase.from('accounts').select(ACCOUNT_COLS).in('username', need)
    if (error) return
    for (const r of data ?? []) remember(r)
    for (const n of need) if (!askedNames.has(n.toLowerCase())) askedNames.set(n.toLowerCase(), null)
  } catch {}
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
  display: display(r.value),
  sub: r.sub ?? null,
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
const placed = (r, rank) => ({ rank, value: Number(r.value), display: display(r.value), sub: r.sub ?? null })
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
async function h2hBoard(ctx) {
  await hydrate([ctx.uid, ...(ctx.ids ?? [])])
  const names = ctx.ids ? ctx.ids.map(id => cleanName(people.get(id)?.name)).filter(Boolean) : null
  if (names && !names.length) return { list: [], mine: null }
  const { data } = await read(() => {
    let q = supabase.rpc('get_h2h_leaderboard').order('wins', { ascending: false })
    if (names) q = q.in('username', names)
    return q.limit(MAX_ROWS)
  })
  const list = onePerPlayer((data ?? []).filter(r => cleanName(r.username)).map(r => ({
    uid: null, name: r.username, value: Number(r.wins), sub: `${Number(r.wins)}-${Number(r.losses)}`,
  })))
  await hydrateNames(list.map(r => r.name))
  for (const r of list) r.pro = !!people.get(askedNames.get(r.name.toLowerCase()))?.pro
  const myName = cleanName(people.get(ctx.uid)?.name)?.toLowerCase()
  const i = myName ? list.findIndex(r => r.name.toLowerCase() === myName) : -1
  return { list, mine: i >= 0 ? placed(list[i], i + 1) : null }
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
async function potdBoard(ctx) {
  const key = dayKey()
  const res = await memo(`raw-potd|${key}`, async () => {
    const r = await fetchPlayersOfDay(key)
    if (r.error) throw new Error('potd')
    return r
  })
  const all = (res.rows ?? []).map(r => {
    const t = r.day ?? r.cos?.today ?? {}
    return { uid: r.id, name: r.username, value: Number(t.xp) || 0, sub: t.g != null ? plural(t.g, 'game') : null }
  }).filter(r => r.value > 0)
  const list = onlyAmong(all, ctx)
  return { list, mine: mineInList(list, ctx.uid) }
}
async function cupBoard(ctx) {
  const week = weekOf()
  const res = await memo(`raw-cup|${week}`, async () => {
    const r = await fetchWeeklyCup(week)
    if (r.error) throw new Error('cup')
    return r
  })
  const all = (res.rows ?? []).map(r => ({ uid: r.user_id, name: r.username, value: Number(r.total) || 0, sub: r.days != null ? plural(Number(r.days), 'day') : null }))
  const list = onlyAmong(all, ctx)
  return { list, mine: mineInList(list, ctx.uid) }
}
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
  TE: ['te-classic', 'te-all-time'], DB: ['db-classic', 'db-all-time'], OL: ['ol-classic', null],
}
const BUCKET_MODES = ['bucket-classic', 'bucket-all-time']
const BUCKET_POS = { GUARD: 'guard', BIG: 'big' }
const modesFor = (sport, position) => (sport === 'bucket' ? BUCKET_MODES : MODES[position] ?? MODES.QB)
// The award a position's season pays (App.jsx awardType). Football only. RB, WR and TE share
// one counter on accounts (OPOY), so it can't be a record for any one of them.
const AWARD = { QB: ['classic_mvps', 'MVP'], DB: ['classic_dpoys', 'DPOY'] }
const awardFor = (sport, position) => (sport === 'bucket' ? null : AWARD[position ?? 'QB'] ?? null)
// salary_infinite_plays has no index on overall_score, and that sort times out (57014, about
// 3s of the database's time, each try). Turn this on once the index exists.
const BUCKET_INFINITE_INDEXED = false

// `build is not null` is what puts these on simulations_mode_ovr_wins / simulations_mode_pos_ovr
async function bestBoard(ctx, mode) {
  const pos = ctx.sport === 'bucket' ? BUCKET_POS[ctx.position] : null
  const { data } = await read(() => {
    let q = supabase.from('simulations').select('user_id,username,ovr,wins,losses').eq('game_mode', mode).not('build', 'is', null)
    if (pos) q = q.eq('position', pos)
    return among(q, 'user_id', ctx).order('ovr', { ascending: false }).order('wins', { ascending: false }).limit(200)
  })
  const list = onePerPlayer((data ?? []).map(r => ({ uid: r.user_id, name: r.username, value: r.ovr, sub: `${r.wins ?? 0}-${r.losses ?? 0}` })))
  return { list, mine: mineInList(list, ctx.uid) }
}
// leaderboard_user_stats: one row per (game_mode, user_id), refreshed hourly
const STAT_COLS = 'user_id,username,wins,losses,rings,sims_count,total_ovr'
const STAT = {
  rings: { col: 'rings', sub: r => plural(r.sims_count ?? 0, 'season') },
  wins: { col: 'wins', sub: r => `${r.wins ?? 0}-${r.losses ?? 0}` },
  seasons: { col: 'sims_count', sub: r => (r.sims_count > 0 ? `${(r.total_ovr / r.sims_count).toFixed(1)} avg OVR` : null) },
}
async function statBoard(id, ctx) {
  const { col, sub } = STAT[id], mode = modesFor(ctx.sport, ctx.position)[0]
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
async function gridBestBoard(ctx) {
  const g = GRID[ctx.sport]
  const { data } = await read(() => among(supabase.from(g.infinite).select(g.cols), 'user_id', ctx)
    .order('overall_score', { ascending: false }).limit(100))
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
  h2h: { load: h2hBoard },
  daily: { load: dailyBoard },
  potd: { load: potdBoard },
  cup: { load: cupBoard },
  grid: { scope: sportScope, load: gridBoard },
  best: {
    scope: ctx => `${modeScope(ctx)}|${ctx.sport === 'bucket' ? BUCKET_POS[ctx.position] ?? '' : ''}`,
    load: ctx => bestBoard(ctx, modesFor(ctx.sport, ctx.position)[0]),
  },
  bestAll: {
    ok: ctx => !!modesFor(ctx.sport, ctx.position)[1],
    scope: ctx => `${modeScope(ctx)}|${ctx.sport === 'bucket' ? BUCKET_POS[ctx.position] ?? '' : ''}`,
    load: ctx => bestBoard(ctx, modesFor(ctx.sport, ctx.position)[1]),
  },
  rings: { scope: modeScope, load: ctx => statBoard('rings', ctx) },
  wins: { scope: modeScope, load: ctx => statBoard('wins', ctx) },
  seasons: { scope: modeScope, load: ctx => statBoard('seasons', ctx) },
  awards: { ok: ctx => !!awardFor(ctx.sport, ctx.position), scope: ctx => awardFor(ctx.sport, ctx.position)?.[0], load: awardBoard },
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
    { id: 'rating', label: 'Rating', unit: 'RATING' },
    { id: 'peak', label: 'Best Ever', unit: 'BEST' },
    { id: 'played', label: 'Games', unit: 'GAMES' },
    { id: 'h2h', label: '1v1 Wins', unit: 'WINS' },
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
export function recordBoards(sport, position) {
  const ctx = contextOf({ sport, position })
  const award = awardFor(ctx.sport, ctx.position)
  return [
    { id: 'best', label: 'Best Season', unit: 'OVR', group: 'SEASONS' },
    ...(modesFor(ctx.sport, ctx.position)[1] ? [{ id: 'bestAll', label: 'Best All-Time Season', unit: 'OVR', group: 'SEASONS' }] : []),
    { id: 'rings', label: 'Most Rings', unit: 'RINGS', group: 'SEASONS' },
    { id: 'wins', label: 'Most Wins', unit: 'WINS', group: 'SEASONS' },
    { id: 'seasons', label: 'Most Seasons', unit: 'SEASONS', group: 'SEASONS' },
    ...(award ? [{ id: 'awards', label: `Most ${award[1]}s`, unit: `${award[1]}S`, group: 'SEASONS' }] : []),
    ...(BOARDS.gridBest.ok(ctx) ? [{ id: 'gridBest', label: 'Best Infinite Grid', unit: 'SCORE', group: 'MODES' }] : []),
    ...(BOARDS.depth.ok(ctx) ? [{ id: 'depth', label: 'Depth Chart Streak', unit: 'STREAK', group: 'MODES' }] : []),
  ]
}
// Basketball's filter only moves the two Best Season boards: the other records aren't kept by position
// (no OL: nobody plays it, and the old board had no tab for it either)
export const positionsFor = sport => (sport === 'bucket' ? Object.keys(BUCKET_POS) : Object.keys(MODES).filter(x => x !== 'OL'))

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
