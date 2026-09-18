import { supabase } from './supabase'

// Lightweight, fire-and-forget analytics logging. Never awaited at call sites —
// a failed insert (offline, RLS misconfigured, etc.) should never block or
// break the feature that triggered it.
export function track(event, { app = 'nfl', position = null, gameMode = null, userId = null, meta = null } = {}) {
  if (!supabase) return
  supabase.from('analytics_events').insert({
    event,
    app,
    position,
    game_mode: gameMode,
    user_id: userId,
    meta,
  }).then(({ error }) => {
    if (error) console.warn('[track]', event, error.message)
  })
}
