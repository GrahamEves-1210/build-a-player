// Live chat safety: filter, block, report. Chat is for signed-in players only
// (the screens enforce that), messages are short and rate-limited, blocked
// players' lines never render, and a report lands in the feedback inbox with
// the room code and the text.

import { supabase } from './supabase'
import { getUsername } from './discord'

const BAD = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'asshole', 'bastard', 'slut', 'whore', 'fag', 'nigg', 'retard', 'kys', 'kill yourself', 'rape', 'nazi', 'porn', 'sex']
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' }
const norm = s => s.toLowerCase().replace(/[01345 7@$!]/g, c => LEET[c] ?? c).replace(/[^a-z]/g, '')

export const MAX_LEN = 120
export const MIN_GAP_MS = 1500

export function clean(text) {
  let out = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN)
  // strip urls / contact details: no off-platform contact between kids
  out = out.replace(/\b(https?:\/\/|www\.)\S+/gi, '[link]').replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[email]').replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[number]')
  const words = out.split(' ')
  return words.map(w => (BAD.some(b => norm(w).includes(b)) ? '*'.repeat(Math.max(3, w.length)) : w)).join(' ')
}

const BLOCK_KEY = 'bap_blocked'
export const blockedIds = () => { try { return new Set(JSON.parse(localStorage.getItem(BLOCK_KEY) || '[]')) } catch { return new Set() } }
export function block(uid) {
  if (!uid) return
  const s = blockedIds(); s.add(uid)
  try { localStorage.setItem(BLOCK_KEY, JSON.stringify([...s])) } catch {}
}
export function unblock(uid) {
  const s = blockedIds(); s.delete(uid)
  try { localStorage.setItem(BLOCK_KEY, JSON.stringify([...s])) } catch {}
}

export async function report({ room, mode, offender, text, user }) {
  if (!supabase) return false
  const { error } = await supabase.from('feedback').insert({
    kind: 'other',
    message: `REPORT [${mode} ${room}] ${offender.name || 'player'} (${offender.uid || offender.vid || '?'}): "${String(text || '').slice(0, 600)}"`,
    user_id: user?.id ?? null, username: user ? getUsername(user) : null,
    app: 'bucket', page: mode, user_agent: navigator.userAgent.slice(0, 300),
  })
  return !error
}

// Quick lines a player can send with one tap (no typing on the clock)
export const QUICK = ['GG', 'Nice pull!', 'Need a big', 'Lock him up', 'Shoot it!', 'Pass more', 'My bad', 'Let\'s go!']
