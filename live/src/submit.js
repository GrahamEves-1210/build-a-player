// Results the boards keep, checked here before they're saved (POST /api/submit/<kind>).
// The phone sends what it played; this server works out what's true (src/lib/verifyCore.js:
// real players at real ratings, the OVR they really make, the Daily's own spins) and saves
// it with the service key. The database still applies its own per-player checks
// (supabase/result_guards.sql reads the x-bap-user header as the player).
//
// Needs, on the Worker:
//   SUPABASE_URL, SUPABASE_ANON_KEY      [vars] in wrangler.toml (both public)
//   SUPABASE_SERVICE_ROLE_KEY            a secret: npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
// Without the secret every submit answers 503 and the game saves the old way.

import { checkDaily, checkSeason, checkSalaryCap } from '../../src/lib/verifyCore.js'
// soccer's season kit (its rosters and OVR) goes into verifyCore's checks from here
import '../../src/lib/soccerKits.js'
// baseball's season kit (its rosters and OVR, per position) the same way
import '../../src/lib/baseballKits.js'
import { soccerModeOf } from '../../src/lib/soccerAwards.js'
import { baseballModeOf } from '../../src/lib/baseballAwards.js'

const ORIGINS = [/^https:\/\/(www\.)?build-a-player\.com$/, /^https:\/\/([a-z0-9-]+\.)?build-a-player\.pages\.dev$/, /^https?:\/\/localhost(:\d+)?$/, /^capacitor:\/\/localhost$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/]
const corsFor = req => {
  const o = req.headers.get('Origin') || ''
  return ORIGINS.some(re => re.test(o))
    ? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Vary': 'Origin' }
    : {}
}
const json = (body, status, cors) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })

// the player, from their own session token
async function sessionUser(req, env) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } })
  if (!r.ok) return null
  const u = await r.json().catch(() => null)
  return u?.id ? u : null
}

async function insert(env, table, row, uid) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal', 'x-bap-user': uid,
    },
    body: JSON.stringify(row),
  })
  if (r.ok) return { ok: true }
  const e = await r.json().catch(() => ({}))
  return { ok: false, code: e.code ?? String(r.status), message: e.message ?? null }
}

// today or yesterday (a run that finished just after midnight), New York time like the game
const nyDay = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + offset * 86400000))
// what a build is saved as: who and which team per trait (the server's own ratings)
const slim = (build, extra = () => ({})) => Object.fromEntries(Object.entries(build).map(([t, c]) => [t, { qb: c.qbFull, team: c.team, val: c.val, ...extra(t) }]))

export async function handleSubmit(req, env, kind) {
  const cors = corsFor(req)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, cors)
  const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter(k => !env[k])
  if (missing.length) return json({ error: `not set up: ${missing.join(', ')}` }, 503, cors)
  const user = await sessionUser(req, env)
  if (!user) return json({ error: 'Sign in again.' }, 401, cors)
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return json({ error: 'bad request' }, 400, cors)

  if (kind === 'daily') {
    const day = String(body.day || '')
    if (day !== nyDay(0) && day !== nyDay(-1)) return json({ error: 'not today\'s Daily' }, 422, cors)
    const r = checkDaily(day, body.build)
    if (r.error) return json({ error: r.error }, 422, cors)
    const res = await insert(env, 'daily_challenge_results', { day, user_id: user.id, ovr: r.ovr, position: r.pos, mode: r.mode, build: slim(r.build) }, user.id)
    return json(res, res.ok || res.code === '23505' ? 200 : 502, cors)
  }

  if (kind === 'season') {
    const { sport, pos, mode, row } = body
    if (!row || typeof row !== 'object') return json({ error: 'bad request' }, 400, cors)
    const soccer = sport === 'soccer', baseball = sport === 'baseball'
    const r = checkSeason({ sport: sport === 'bucket' || soccer || baseball ? sport : 'nfl', pos, mode, build: row.build })
    if (r.error) return json({ error: r.error }, 422, cors)
    const keep = sport === 'bucket' || soccer || baseball ? t => ({ number: row.build?.[t]?.number ?? null }) : () => ({})
    // soccer: the board is the pool the build was checked against (lib/soccerAwards.js: soccer-classic / soccer-all-time,
    // the names lib/boards.js and the Trophy Case read); baseball the same, with its position (lib/baseballAwards.js)
    const board = soccer ? { game_mode: soccerModeOf(mode), position: 'st' }
      : baseball ? { game_mode: baseballModeOf(mode), position: pos === 'pit' ? 'pit' : 'bat' } : {}
    const res = await insert(env, 'simulations', { ...row, ...board, user_id: user.id, ovr: r.ovr, build: slim(r.build, keep) }, user.id)
    return json(res, res.ok || res.code === '23505' ? 200 : 502, cors)
  }

  // Salary Cap: a daily play (today's board, or yesterday's just after midnight) or an
  // Infinite one; the day's frozen board is read here and only trusted if it checks out
  if (kind === 'salary') {
    const { sport, infinite, date, picks, pos, sent } = body
    const bucket = sport === 'bucket', soccer = sport === 'soccer', baseball = sport === 'baseball'
    // each sport's own tables (soccer: supabase/soccer_salary.sql; baseball: supabase/baseball_salary.sql, batters only)
    // (a baseball play other than a batter's is turned away: there is no pitcher board)
    if (baseball && pos !== 'bat') return json({ error: 'unknown position' }, 422, cors)
    const T = baseball ? { grids: 'baseball_salary_cap_grids', daily: 'baseball_salary_cap_plays', infinite: 'baseball_salary_infinite_plays' }
      : soccer ? { grids: 'soccer_salary_cap_grids', daily: 'soccer_salary_cap_plays', infinite: 'soccer_salary_infinite_plays' }
      : bucket ? { grids: 'salary_cap_grids', daily: 'salary_cap_plays', infinite: 'salary_infinite_plays' }
      : { grids: 'qb_salary_cap_grids', daily: 'qb_salary_cap_plays', infinite: 'qb_salary_infinite_plays' }
    if (!infinite && date !== nyDay(0) && date !== nyDay(-1)) return json({ error: 'not today\'s board' }, 422, cors)
    let frozen = null
    if (!infinite) {
      const g = await fetch(`${env.SUPABASE_URL}/rest/v1/${T.grids}?date_str=eq.${date}&select=grid&limit=1`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }).catch(() => null)
      frozen = g?.ok ? ((await g.json().catch(() => null))?.[0]?.grid ?? null) : null
    }
    // football's position: QB, or another one's Infinite board (verifyCore.js checks it; the row carries it)
    const r = checkSalaryCap({ sport: baseball ? 'baseball' : soccer ? 'soccer' : bucket ? 'bucket' : 'nfl', date, infinite: !!infinite, picks, pos: baseball ? 'bat' : soccer ? 'st' : bucket ? (pos === 'big' ? 'big' : 'guard') : (typeof pos === 'string' ? pos : 'qb'), frozen, sent: sent || {} })
    if (r.error) return json({ error: r.error }, 422, cors)
    const table = infinite ? T.infinite : T.daily
    const res = await insert(env, table, { ...r.row, user_id: user.id, ...(infinite ? {} : { date_str: date }) }, user.id)
    return json(res, res.ok || res.code === '23505' ? 200 : 502, cors)
  }

  return json({ error: 'unknown result' }, 404, cors)
}
