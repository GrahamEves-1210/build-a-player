// #leaderboards on Discord: the Daily Challenge board every night at midnight New York time, and the Weekly Cup's
// final standings every Monday at midnight (the Cup's week runs Monday to Sunday, New York: supabase/weekly_cup.sql).
// Railway setting: LEADERBOARD_DISCORD_WEBHOOK (#leaderboards → Edit Channel → Integrations → Webhooks → New Webhook
// → Copy Webhook URL). Not set: nothing is posted.
//
// The clock is checked every minute; a post goes out from 12:05 AM (late Daily submissions for the day just ended get
// five minutes to land) until 5 AM, so a restart over midnight still posts. Each post is claimed first in board_cache
// (kind 'discord-daily' / 'discord-cup', the day or the week's Monday), so two servers or a restart never post twice;
// a failed post gives its claim back and tries again a minute later.

const CUP_START = '2026-10-29'   // keep in step with CUP_START in src/lib/progress.js
const CUP_COINS = [5000, 2000, 1000, 500, 500, 500, 500, 500, 500, 500]   // and CUP_COINS there
const TOP = 10
const TEAL = 0x2dd4a7

const POS = { qb: 'Quarterback', rb: 'Running Back', wr: 'Wide Receiver', te: 'Tight End', db: 'Defensive Back', guard: 'Guard', big: 'Big' }
const SPORT = { guard: 'Basketball', big: 'Basketball' }

// New York's date and time now
function nyNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(new Date()).map(x => [x.type, x.value]))
  return { day: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, minute: +p.minute, weekday: p.weekday }
}
const addDays = (key, n) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const dateLine = (key, opts) => new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts })
const nameOf = r => (r.username && String(r.username).trim()) || 'Guest'
const esc = s => String(s).replace(/([*_~`|>\\])/g, '\\$1')
const place = (i, line) => `\`${String(i + 1).padStart(2)}\` ${line}`

async function send(url, embed) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Build-A-Player', embeds: [embed], allowed_mentions: { parse: [] } }) })
  if (!r.ok) throw new Error(`Discord ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`)
}

// claim a post (false: already posted, or being posted by another server)
async function claim(supabase, kind, day) {
  const { error } = await supabase.from('board_cache').insert({ kind, day, rows: [] })
  if (!error) return true
  if (error.code !== '23505') console.error('[leaderboards] claim', kind, day, error.message)
  return false
}
const unclaim = (supabase, kind, day) => supabase.from('board_cache').delete().eq('kind', kind).eq('day', day)

async function dailyEmbed(supabase, day) {
  const { data, error, count } = await supabase.from('daily_challenge_results')
    .select('username,ovr,position,mode,created_at', { count: 'exact' })
    .eq('day', day).order('ovr', { ascending: false }).order('created_at', { ascending: true }).limit(TOP)
  if (error) throw new Error(`daily read: ${error.message}`)
  const rows = data ?? []
  const pos = rows[0]?.position, mode = rows[0]?.mode
  const what = pos ? `${SPORT[pos] ?? 'Football'} · ${POS[pos] ?? pos.toUpperCase()} · ${mode === 'all-time' ? 'All-Time' : 'Current'}` : null
  return {
    color: TEAL,
    title: `DAILY CHALLENGE · ${dateLine(day, { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}`,
    description: rows.length
      ? `${what ? `${what}\n` : ''}${(count ?? rows.length).toLocaleString('en-US')} build${(count ?? rows.length) === 1 ? '' : 's'} posted\n\n${rows.map((r, i) => place(i, `**${esc(nameOf(r))}** · ${r.ovr} OVR`)).join('\n')}`
      : 'No builds were posted.',
    footer: { text: 'Today\'s Daily is up now at build-a-player.com' },
  }
}

async function cupEmbed(supabase, monday) {
  const { data, error } = await supabase.rpc('weekly_cup', { p_start: monday })
  if (error) throw new Error(`cup read: ${error.message}`)
  const rows = (data ?? []).slice(0, TOP)
  const sunday = addDays(monday, 6)
  const span = `${dateLine(monday, { month: 'short', day: 'numeric' })} – ${dateLine(sunday, { month: 'short', day: 'numeric' })}`.toUpperCase()
  return {
    color: TEAL,
    title: `WEEKLY CUP · FINAL · ${span}`,
    description: rows.length
      ? `Every Daily OVR of the week, added up. The top ${CUP_COINS.length} are paid.\n\n${rows.map((r, i) =>
        place(i, `**${esc(nameOf(r))}** · ${r.total} (${r.days} day${r.days === 1 ? '' : 's'}) · ${CUP_COINS[i].toLocaleString('en-US')} coins`)).join('\n')}`
      : 'No one played the Daily this week.',
    footer: { text: 'A new Cup started Monday. Play the Daily every day to climb it.' },
  }
}

async function postOnce(supabase, url, kind, day, build) {
  if (!(await claim(supabase, kind, day))) return
  try {
    await send(url, await build())
    console.log(`[leaderboards] posted ${kind} ${day}`)
  } catch (e) {
    console.error(`[leaderboards] ${kind} ${day}`, e?.message)
    await unclaim(supabase, kind, day)
  }
}

let busy = false
export async function leaderboardTick(supabase, url = process.env.LEADERBOARD_DISCORD_WEBHOOK) {
  if (!url || busy) return
  const now = nyNow()
  if (now.hour >= 5 || (now.hour === 0 && now.minute < 5)) return
  busy = true
  try {
    const yesterday = addDays(now.day, -1)
    await postOnce(supabase, url, 'discord-daily', yesterday, () => dailyEmbed(supabase, yesterday))
    if (now.weekday === 'Mon') {
      const monday = addDays(now.day, -7)
      if (addDays(monday, 6) >= CUP_START) await postOnce(supabase, url, 'discord-cup', monday, () => cupEmbed(supabase, monday))
    }
  } finally { busy = false }
}

export function startLeaderboardPosts(supabase) {
  if (!process.env.LEADERBOARD_DISCORD_WEBHOOK) { console.log('[leaderboards] LEADERBOARD_DISCORD_WEBHOOK not set: no Discord posts'); return }
  setInterval(() => { leaderboardTick(supabase).catch(e => console.error('[leaderboards]', e?.message)) }, 60 * 1000)
  leaderboardTick(supabase).catch(() => {})
}

// for a test run: the two posts as they'd go out (scripts call this with a fake send)
export const _test = { dailyEmbed, cupEmbed, nyNow, addDays }
