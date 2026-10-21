import { supabase } from './supabase'
// Lightweight, fire-and-forget analytics logging. Never awaited at call sites —
// a failed insert (offline, RLS misconfigured, etc.) should never block or
// break the feature that triggered it. Each event also goes to Google Analytics
// (gtag, on the site and in the app), and carries this device's id (meta.dev) so
// a guest's days can be counted too (supabase/analytics_queries.sql).
const devId = () => { try { return localStorage.getItem('bap_dev_id') } catch { return null } }
export function track(event, { app = 'nfl', position = null, gameMode = null, userId = null, meta = null } = {}) {
  try { window.gtag?.('event', event, { app, position: position ?? undefined, game_mode: gameMode ?? undefined, ...(meta || {}) }) } catch {}
  if (!supabase) return
  supabase.from('analytics_events').insert({
    event,
    app,
    position,
    game_mode: gameMode,
    user_id: userId,
    meta: { ...(meta || {}), dev: devId() },
  }).then(({ error }) => {
    if (error) console.warn('[track]', event, error.message)
  })
}
