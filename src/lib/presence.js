import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { liveKind } from './live'

// Players online: this device checks in once a minute (and when it moves to another
// mode) with where it is, and the answer is the live count, website and app together
// (supabase/presence.sql ping_presence). Home shows the total; the online modes show
// how many are in them. Nothing shows until a real count comes back.

const EVERY_MS = 60000
let counts = null                 // { total, areas: { home, compete, blacktop, … } }
const listeners = new Set()
let started = false, lastArea = null, timer = null

const devId = () => { try { return localStorage.getItem('bap_dev_id') } catch { return null } }
// where this device is: a live game it's in first, then the page it's on
function area() {
  const k = liveKind()
  if (k) return k === 'auction' ? 'auction' : k.startsWith('blacktop') || k === 'bt' ? 'blacktop' : k === 'compete' ? 'compete' : k
  const page = window.__bapPage?.page ?? 'splash'
  if (page === 'compete') return 'compete'
  if (page.startsWith('blacktop') || page.startsWith('versus')) return 'blacktop'
  if (page === 'career' || page.startsWith('career')) return 'career'
  if (page === 'takeover' || page.startsWith('takeover')) return 'takeover'
  if (page === 'game' || page === 'sim' || page === 'salarycap') return 'play'
  return 'home'
}

async function ping() {
  const dev = devId()
  if (!supabase || !dev || document.hidden) return
  lastArea = area()
  try {
    const { data, error } = await supabase.rpc('ping_presence', { p_dev: dev, p_area: lastArea })
    if (error || !data || typeof data.total !== 'number') return
    counts = data
    listeners.forEach(fn => fn())
  } catch {}
}

export function startPresence() {
  if (started || typeof window === 'undefined') return
  started = true
  setTimeout(ping, 1500)
  timer = setInterval(ping, EVERY_MS)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ping() })
  // a move to another mode checks in straight away (so the counts follow)
  window.addEventListener('bap:page', () => { setTimeout(() => { if (area() !== lastArea) ping() }, 1200) })
  void timer
}

export function usePresence() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) }, () => counts)
}
// "1.2K"
export const fmtCount = n => (n >= 10000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n))
