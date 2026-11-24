// #leaderboards on Discord: the Daily Challenge board every night at midnight New York time, and the Weekly Cup's
// final standings every Monday at midnight (the Cup's week runs Monday to Sunday, New York: supabase/weekly_cup.sql).
// Run by the Worker's cron (wrangler.toml [triggers]): Cloudflare's cron is in UTC, so it fires just after both
// possible midnights (4 AM UTC in summer time, 5 AM in winter) and a few times after, and the post goes out on the
// first run that finds it past midnight in New York (before 2 AM there).
// Secret: LEADERBOARD_DISCORD_WEBHOOK (#leaderboards → Edit Channel → Integrations → Webhooks → New Webhook → Copy
// Webhook URL; then `npx wrangler secret put LEADERBOARD_DISCORD_WEBHOOK`). Not set: nothing is posted.
// Each post is claimed first in board_cache (kind 'discord-daily' / 'discord-cup', the day or the week's Monday), so
// it goes out once; a failed post gives its claim back and the next run tries again.

const CUP_START = '2026-10-29'   // keep in step with CUP_START in src/lib/progress.js
const CUP_COINS = [5000, 2000, 1000, 500, 500, 500, 500, 500, 500, 500]   // and CUP_COINS there
const TOP = 10
const TEAL = 0x2dd4a7
const POS = { qb: 'Quarterback', rb: 'Running Back', wr: 'Wide Receiver', te: 'Tight End', db: 'Defensive Back', guard: 'Guard', big: 'Big' }
const SPORT = { guard: 'Basketball', big: 'Basketball' }

export function nyNow(at = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(at).map(x => [x.type, x.value]))
  return { day: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, minute: +p.minute, weekday: p.weekday }
}
export const addDays = (key, n) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const dateLine = (key, opts) => new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts })
const nameOf = r => (r.username && String(r.username).trim()) || 'Guest'
const esc = s => String(s).replace(/([*_~`|>\\])/g, '\\$1')
const place = (i, line) => `\`${String(i + 1).padStart(2)}\` ${line}`
const fmt = n => Number(n).toLocaleString('en-US')

// the database, with the service key (a reader can pass the public key: the boards are public)
export const restOf = (url, key) => (path, init = {}) => fetch(`${url}/rest/v1/${path}`, {
  ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

export async function dailyEmbed(rest, day) {
  const r = await rest(`daily_challenge_results?day=eq.${day}&select=username,ovr,position,mode,created_at&order=ovr.desc,created_at.asc&limit=${TOP}`, { headers: { Prefer: 'count=exact' } })
  if (!r.ok) throw new Error(`daily read ${r.status}`)
  const rows = await r.json()
  const count = Number((r.headers.get('content-range') ?? '').split('/')[1]) || rows.length
  const pos = rows[0]?.position, mode = rows[0]?.mode
  const what = pos ? `${SPORT[pos] ?? 'Football'} · ${POS[pos] ?? pos.toUpperCase()} · ${mode === 'all-time' ? 'All-Time' : 'Current'}` : null
  return {
    color: TEAL,
    title: `DAILY CHALLENGE · ${dateLine(day, { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}`,
    description: rows.length
      ? `${what ? `${what}\n` : ''}${fmt(count)} build${count === 1 ? '' : 's'} posted\n\n${rows.map((x, i) => place(i, `**${esc(nameOf(x))}** · ${x.ovr} OVR`)).join('\n')}`
      : 'No builds were posted.',
    footer: { text: 'Today\'s Daily is up now at build-a-player.com' },
  }
}

export async function cupEmbed(rest, monday) {
  const r = await rest('rpc/weekly_cup', { method: 'POST', body: JSON.stringify({ p_start: monday }) })
  if (!r.ok) throw new Error(`cup read ${r.status}`)
  const rows = (await r.json()).slice(0, TOP)
  const span = `${dateLine(monday, { month: 'short', day: 'numeric' })} – ${dateLine(addDays(monday, 6), { month: 'short', day: 'numeric' })}`.toUpperCase()
  return {
    color: TEAL,
    title: `WEEKLY CUP · FINAL · ${span}`,
    description: rows.length
      ? `Every Daily OVR of the week, added up. The top ${CUP_COINS.length} are paid.\n\n${rows.map((x, i) =>
        place(i, `**${esc(nameOf(x))}** · ${x.total} (${x.days} day${x.days === 1 ? '' : 's'}) · ${fmt(CUP_COINS[i])} coins`)).join('\n')}`
      : 'No one played the Daily this week.',
    footer: { text: 'A new Cup started Monday. Play the Daily every day to climb it.' },
  }
}

async function postOnce(rest, hook, kind, day, build) {
  // the claim: a second run (or a retry while this one is posting) finds the row and stops
  const c = await rest('board_cache', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ kind, day, rows: [] }) })
  if (!c.ok) { if (c.status !== 409) console.error('[leaderboards] claim', kind, day, c.status, await c.text().catch(() => '')); return }
  try {
    const embed = await build()
    const r = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Build-A-Player', embeds: [embed], allowed_mentions: { parse: [] } }) })
    if (!r.ok) throw new Error(`Discord ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`)
    console.log(`[leaderboards] posted ${kind} ${day}`)
  } catch (e) {
    console.error(`[leaderboards] ${kind} ${day}`, e?.message)
    await rest(`board_cache?kind=eq.${kind}&day=eq.${day}`, { method: 'DELETE' }).catch(() => {})
  }
}

export async function postLeaderboards(env, at = new Date()) {
  const hook = env.LEADERBOARD_DISCORD_WEBHOOK
  if (!hook || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return
  const now = nyNow(at)
  if (now.hour >= 2) return
  const rest = restOf(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const yesterday = addDays(now.day, -1)
  await postOnce(rest, hook, 'discord-daily', yesterday, () => dailyEmbed(rest, yesterday))
  if (now.weekday === 'Mon') {
    const monday = addDays(now.day, -7)
    if (addDays(monday, 6) >= CUP_START) await postOnce(rest, hook, 'discord-cup', monday, () => cupEmbed(rest, monday))
  }
}
